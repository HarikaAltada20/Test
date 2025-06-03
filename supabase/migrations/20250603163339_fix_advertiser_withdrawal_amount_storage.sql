-- Fix the amount storage bug in advertiser withdrawal functions
-- The money_transactions table should store amounts in cents, not dollars

-- Drop and recreate the function with the fix
DROP FUNCTION IF EXISTS public.create_advertiser_withdrawal_request(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, JSONB);

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
    v_payout_method_type TEXT;
    v_payout_method_details JSONB;
    v_advertiser_withdrawable_balance INTEGER := 0;
    v_user_coins INTEGER := 0;
    new_request public.withdrawal_requests;
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
        -- Check advertiser balance from advertiser_profiles
        SELECT COALESCE(withdrawable_balance, 0) * 100 INTO v_advertiser_withdrawable_balance
        FROM public.advertiser_profiles ap
        WHERE ap.id = p_user_id;
        
        IF v_advertiser_withdrawable_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance for advertiser';
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        -- Check coin balance from users table
        SELECT COALESCE(coins, 0) INTO v_user_coins
        FROM public.users u
        WHERE u.id = p_user_id;
        
        IF v_user_coins < p_amount THEN
            RAISE EXCEPTION 'Insufficient coin balance';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid amount type specified';
    END IF;

    -- 3. Fetch payout method details for snapshot
    SELECT pm.method_type, pm.details INTO v_payout_method_type, v_payout_method_details
    FROM public.payout_methods pm
    WHERE pm.id = p_payout_method_id AND pm.user_id = p_user_id;

    IF v_payout_method_type IS NULL THEN
        RAISE EXCEPTION 'Payout method not found or does not belong to the user';
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
        redeemed_item_description,
        payout_method_type_snapshot,
        payout_method_details_snapshot
    )
    VALUES (
        p_user_id,
        p_payout_method_id,
        p_amount,
        p_currency,
        p_amount_type,
        'pending',
        p_user_notes,
        p_redeemed_item_description,
        v_payout_method_type,
        v_payout_method_details
    )
    RETURNING * INTO new_request;

    -- 5. Deduct from advertiser's balance
    IF p_amount_type = 'cash' THEN
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance - (p_amount / 100.0)
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount
        WHERE id = p_user_id;
    END IF;

    -- 6. Create a transaction record
    -- FIXED: Store amount in cents for money_transactions, not dollars
    IF p_amount_type = 'cash' THEN
        INSERT INTO public.money_transactions (user_id, type, status, amount, description)
        VALUES (p_user_id, 'withdrawal', 'pending', p_amount, 'Advertiser withdrawal request ID: ' || new_request.id::text);
    ELSIF p_amount_type = 'coins' THEN
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description)
        VALUES (p_user_id, 'withdrawal_request', 'pending', p_amount, 'Advertiser coin withdrawal request ID: ' || new_request.id::text);
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;
$$;

-- Also fix the cancellation function for consistency
DROP FUNCTION IF EXISTS public.cancel_advertiser_withdrawal_request_by_user(UUID, UUID);

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
    -- 1. Verify user is an advertiser and fetch the request
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
        RAISE EXCEPTION 'Withdrawal request not found or access denied';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Withdrawal request is not in a cancellable state (must be pending)';
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
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance + (v_request.amount / 100.0)
        WHERE id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins + v_request.amount
        WHERE id = p_user_id;
    ELSE
        RAISE WARNING 'Unknown amount_type for advertiser request ID: %', p_request_id;
    END IF;

    -- 5. Update transaction records
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.money_transactions
        SET status = 'cancelled'
        WHERE type = 'withdrawal' 
          AND description LIKE 'Advertiser withdrawal request ID: ' || v_request.id::text
          AND user_id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.coin_transactions
        SET status = 'cancelled'
        WHERE type = 'withdrawal_request' 
          AND description LIKE 'Advertiser coin withdrawal request ID: ' || v_request.id::text
          AND user_id = p_user_id;
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error cancelling advertiser withdrawal request %: %', p_request_id, SQLERRM;
        RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.create_advertiser_withdrawal_request IS 'Creates a new withdrawal request specifically for advertisers, snapshots payout method details, updates advertiser balance, and logs transaction. FIXED: Stores amounts in cents in money_transactions table.';
COMMENT ON FUNCTION public.cancel_advertiser_withdrawal_request_by_user IS 'Cancels a pending withdrawal request for advertisers, records cancellation details, and refunds the amount to the advertiser balance.'; 