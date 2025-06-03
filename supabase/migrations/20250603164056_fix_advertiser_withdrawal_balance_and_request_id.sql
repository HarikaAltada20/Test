-- Fix advertiser withdrawal function: Request ID linking and balance deduction
-- Issue 1: withdrawal_request_id not being set in transactions  
-- Issue 2: Balance deduction was incorrect (withdrawable_balance is stored in cents)

-- money_transactions already has withdrawal_request_id column
-- coin_transactions uses related_withdrawal_id column (checking if it exists)
ALTER TABLE public.coin_transactions 
ADD COLUMN IF NOT EXISTS related_withdrawal_id UUID REFERENCES public.withdrawal_requests(id);

-- Drop and recreate the function with fixes
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
        -- FIXED: withdrawable_balance is stored in cents (like creators)
        SELECT COALESCE(withdrawable_balance, 0) INTO v_advertiser_withdrawable_balance
        FROM public.advertiser_profiles ap
        WHERE ap.id = p_user_id;
        
        IF v_advertiser_withdrawable_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance for advertiser. Requested: %, Available: %', p_amount, v_advertiser_withdrawable_balance;
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        -- Check coin balance from users table
        SELECT COALESCE(coins, 0) INTO v_user_coins
        FROM public.users u
        WHERE u.id = p_user_id;
        
        IF v_user_coins < p_amount THEN
            RAISE EXCEPTION 'Insufficient coin balance. Requested: %, Available: %', p_amount, v_user_coins;
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
        -- FIXED: withdrawable_balance is in cents, so subtract cents directly
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance - p_amount
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount
        WHERE id = p_user_id;
    END IF;

    -- 6. Create a transaction record with proper linking
    IF p_amount_type = 'cash' THEN
        -- money_transactions uses withdrawal_request_id
        INSERT INTO public.money_transactions (user_id, type, status, amount, currency, description, withdrawal_request_id)
        VALUES (p_user_id, 'withdrawal', 'pending', p_amount, p_currency, 'Advertiser withdrawal request initiated.', new_request.id);
    ELSIF p_amount_type = 'coins' THEN
        -- coin_transactions uses related_withdrawal_id (matching creators' pattern)
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description, related_withdrawal_id)
        VALUES (p_user_id, 'redemption_request', 'pending', p_amount, 'Advertiser coin redemption request: ' || COALESCE((p_redeemed_item_description->>'name')::text, 'Item'), new_request.id);
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;
$$;

-- Update the cancellation function  
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
        -- FIXED: withdrawable_balance is in cents, so add cents directly
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance + v_request.amount
        WHERE id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins + v_request.amount
        WHERE id = p_user_id;
    ELSE
        RAISE WARNING 'Unknown amount_type for advertiser request ID: %', p_request_id;
    END IF;

    -- 5. Update transaction records using proper column names
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.money_transactions
        SET status = 'cancelled'
        WHERE withdrawal_request_id = p_request_id AND user_id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.coin_transactions
        SET status = 'cancelled'
        WHERE related_withdrawal_id = p_request_id AND user_id = p_user_id;
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error cancelling advertiser withdrawal request %: %', p_request_id, SQLERRM;
        RETURN FALSE;
END;
$$;

-- Update coin transaction type constraint to include redemption_request
DO $$
BEGIN
    -- Check if the constraint allows 'redemption_request' type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'coin_transactions_type_check' 
        AND check_clause LIKE '%redemption_request%'
    ) THEN
        -- Drop the old constraint
        ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
        
        -- Add the new constraint with redemption_request included
        ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_type_check 
        CHECK ((type = ANY (ARRAY['referral_bonus'::text, 'spent'::text, 'earned'::text, 'bonus'::text, 'redemption_request'::text])));
    END IF;
END
$$;

COMMENT ON FUNCTION public.create_advertiser_withdrawal_request IS 'FIXED: Creates advertiser withdrawal requests with proper balance deduction (cents), correct column linking, and transaction types matching creators pattern.';
COMMENT ON FUNCTION public.cancel_advertiser_withdrawal_request_by_user IS 'FIXED: Cancels advertiser withdrawal requests with proper balance refund and transaction status updates.'; 