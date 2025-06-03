-- Migration to create advertiser-specific withdrawal RPC functions
-- This keeps creator and advertiser withdrawal logic completely separate

-- Create advertiser-specific withdrawal request function
CREATE OR REPLACE FUNCTION public.create_advertiser_withdrawal_request(
    p_user_id UUID,
    p_payout_method_id UUID,
    p_amount INTEGER, -- Amount in cents for cash, or coin quantity for coins
    p_currency TEXT,
    p_amount_type TEXT, -- 'cash' or 'coins'
    p_user_notes TEXT DEFAULT NULL,
    p_redeemed_item_description JSONB DEFAULT NULL
)
RETURNS SETOF public.withdrawal_requests
LANGUAGE plpgsql
AS $$
DECLARE
    v_payout_method_type TEXT := NULL;
    v_payout_method_details JSONB := NULL;
    new_request public.withdrawal_requests;
    current_coin_balance INTEGER;
    current_cash_balance_dollars NUMERIC;
    current_cash_balance_cents INTEGER;
BEGIN
    -- 1. Verify user is an advertiser
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = p_user_id AND user_type = 'advertiser'
    ) THEN
        RAISE EXCEPTION 'User not found or not an advertiser';
    END IF;

    -- 2. Check advertiser's balance based on amount type
    IF p_amount_type = 'cash' THEN
        -- Get balance in dollars, convert to cents for comparison
        SELECT COALESCE(withdrawable_balance, 0) INTO current_cash_balance_dollars
        FROM public.advertiser_profiles ap
        WHERE ap.id = p_user_id;
        
        current_cash_balance_cents := ROUND(current_cash_balance_dollars * 100);
        
        IF current_cash_balance_cents < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance. Requested: % cents, Available: % cents', p_amount, current_cash_balance_cents;
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        -- Check coin balance from users table
        SELECT COALESCE(coins, 0) INTO current_coin_balance
        FROM public.users u
        WHERE u.id = p_user_id;
        
        IF current_coin_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient coin balance. Requested: %, Available: %', p_amount, current_coin_balance;
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid amount type specified: %', p_amount_type;
    END IF;

    -- 3. Fetch payout method details if ID is provided
    IF p_payout_method_id IS NOT NULL THEN
        SELECT pm.method_type, pm.details INTO v_payout_method_type, v_payout_method_details
        FROM public.payout_methods pm
        WHERE pm.id = p_payout_method_id AND pm.user_id = p_user_id;

        IF v_payout_method_type IS NULL THEN
            RAISE EXCEPTION 'Payout method (ID: %) not found or does not belong to the user', p_payout_method_id;
        END IF;
    ELSIF p_amount_type = 'cash' THEN
        RAISE EXCEPTION 'Payout method ID is required for cash withdrawals';
    END IF;

    -- 4. Create the withdrawal request
    INSERT INTO public.withdrawal_requests (
        user_id,
        payout_method_id,
        amount,
        currency,
        amount_type,
        status,
        user_notes,
        payout_method_type_snapshot,
        payout_method_details_snapshot,
        redeemed_item_description
    )
    VALUES (
        p_user_id,
        p_payout_method_id,
        p_amount,
        p_currency,
        p_amount_type,
        'pending',
        p_user_notes,
        v_payout_method_type,
        v_payout_method_details,
        CASE
            WHEN p_amount_type = 'coins' THEN p_redeemed_item_description
            ELSE NULL
        END
    )
    RETURNING * INTO new_request;

    -- 5. Deduct from advertiser's balance
    IF p_amount_type = 'cash' THEN
        -- Convert cents back to dollars for storage
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance - (p_amount / 100.0)
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount
        WHERE id = p_user_id;
    END IF;

    -- 6. Create transaction records with proper request ID linking
    IF p_amount_type = 'cash' THEN
        -- Store amount in dollars for money_transactions, link with withdrawal_request_id
        INSERT INTO public.money_transactions (user_id, type, status, amount, currency, description, withdrawal_request_id)
        VALUES (p_user_id, 'withdrawal', 'pending', p_amount / 100.0, p_currency, 'Advertiser withdrawal request ID: ' || new_request.id::text, new_request.id);
    ELSIF p_amount_type = 'coins' THEN
        -- Store coins as coins, link with related_withdrawal_id (matching creator pattern)
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description, related_withdrawal_id)
        VALUES (p_user_id, 'redemption', 'pending', p_amount, 'Advertiser coin redemption request: ' || COALESCE((p_redeemed_item_description->>'name')::text, 'Item'), new_request.id);
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;
$$;

-- Create advertiser-specific withdrawal cancellation function
CREATE OR REPLACE FUNCTION public.cancel_advertiser_withdrawal_request_by_user(
    p_request_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_request public.withdrawal_requests%ROWTYPE;
BEGIN
    -- 1. Verify user is an advertiser
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = p_user_id AND user_type = 'advertiser'
    ) THEN
        RAISE EXCEPTION 'User not found or not an advertiser';
    END IF;

    -- 2. Fetch the request to ensure it exists, belongs to the user, and is pending
    SELECT * INTO v_request
    FROM public.withdrawal_requests wr
    WHERE wr.id = p_request_id AND wr.user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request (ID: %) not found for user (ID: %) or access denied', p_request_id, p_user_id;
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Withdrawal request (ID: %) is not in a cancellable state. Current status: %', p_request_id, v_request.status;
    END IF;

    -- 3. Update the request status and add cancellation details
    UPDATE public.withdrawal_requests
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = 'Cancelled by advertiser',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- 4. Refund the amount to the advertiser's balance
    IF v_request.amount_type = 'cash' THEN
        -- Convert cents back to dollars for advertiser balance
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance + (v_request.amount / 100.0)
        WHERE id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins + v_request.amount
        WHERE id = p_user_id;
    ELSE
        RAISE WARNING 'Unknown amount_type (%) for advertiser request ID: % during cancellation. Balance not restored.', v_request.amount_type, p_request_id;
    END IF;

    -- 5. Update status of related transaction records
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.money_transactions
        SET status = 'cancelled'
        WHERE type = 'withdrawal'
          AND withdrawal_request_id = v_request.id
          AND user_id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.coin_transactions
        SET status = 'cancelled'
        WHERE type = 'redemption'
          AND related_withdrawal_id = v_request.id
          AND user_id = p_user_id;
    END IF;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error cancelling advertiser withdrawal request % for user %: SQLSTATE: %, SQLERRM: %', p_request_id, p_user_id, SQLSTATE, SQLERRM;
        RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.create_advertiser_withdrawal_request IS 'Creates a new withdrawal request specifically for advertisers, snapshots payout method details, updates advertiser balance, and logs transaction. Handles both cash and coin withdrawals with proper request ID linking.';
COMMENT ON FUNCTION public.cancel_advertiser_withdrawal_request_by_user IS 'Cancels a pending withdrawal request for advertisers, records cancellation details, and refunds the amount to the advertiser balance with proper transaction status updates.'; 