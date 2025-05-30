-- Migration to update withdrawal RPC functions

-- Drop the old version of create_withdrawal_request if it exists (assuming 5 arguments)
-- Adjust the argument types if your old function had a different signature.
DROP FUNCTION IF EXISTS public.create_withdrawal_request(UUID, UUID, INTEGER, TEXT, TEXT);

-- Function to create a withdrawal request with payout details snapshot
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
    p_user_id UUID,
    p_payout_method_id UUID,
    p_amount_cents INTEGER,
    p_currency TEXT,
    p_amount_type TEXT, -- Added: 'cash' or 'coins'
    p_user_notes TEXT DEFAULT NULL
)
RETURNS SETOF public.withdrawal_requests -- Assuming the function returns the created row
LANGUAGE plpgsql
AS $$
DECLARE
    v_payout_method_type TEXT;
    v_payout_method_details JSONB;
    new_request public.withdrawal_requests;
BEGIN
    -- 1. Check user's balance (ensure this logic is robust and handles cash/coins separately)
    -- This part is illustrative and needs to be adapted to your actual balance checking logic.
    -- For example, for 'cash' from creator_profiles.withdrawable_balance_cents
    -- For 'coins' from users.coins
    IF p_amount_type = 'cash' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.creator_profiles cp
            WHERE cp.id = p_user_id AND cp.withdrawable_balance_cents >= p_amount_cents
        ) THEN
            RAISE EXCEPTION 'Insufficient cash balance';
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = p_user_id AND u.coins >= p_amount_cents -- Assuming p_amount_cents here is actually coin amount
        ) THEN
            RAISE EXCEPTION 'Insufficient coin balance';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid amount type specified';
    END IF;

    -- 2. Fetch payout method details for snapshot
    SELECT pm.method_type, pm.details INTO v_payout_method_type, v_payout_method_details
    FROM public.payout_methods pm
    WHERE pm.id = p_payout_method_id AND pm.user_id = p_user_id;

    IF v_payout_method_type IS NULL THEN
        RAISE EXCEPTION 'Payout method not found or does not belong to the user';
    END IF;

    -- 3. Create the withdrawal request
    INSERT INTO public.withdrawal_requests (
        user_id,
        payout_method_id,
        amount_cents,
        currency,
        amount_type, -- New field
        status,
        user_notes,
        payout_method_type_snapshot, -- New field
        payout_method_details_snapshot -- New field
    )
    VALUES (
        p_user_id,
        p_payout_method_id,
        p_amount_cents,
        p_currency,
        p_amount_type,
        'pending', -- Default status
        p_user_notes,
        v_payout_method_type,
        v_payout_method_details
    )
    RETURNING * INTO new_request;

    -- 4. Deduct from user's balance (ensure this logic is robust)
    IF p_amount_type = 'cash' THEN
        UPDATE public.creator_profiles
        SET withdrawable_balance_cents = withdrawable_balance_cents - p_amount_cents
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount_cents -- Assuming p_amount_cents is coin amount
        WHERE id = p_user_id;
    END IF;

    -- 5. Optionally, create a transaction record in money_transactions or coin_transactions
    -- This step depends on your existing transaction logging strategy.
    -- Example for cash:
    IF p_amount_type = 'cash' THEN
        INSERT INTO public.money_transactions (user_id, type, status, amount, description)
        VALUES (p_user_id, 'withdrawal', 'pending', p_amount_cents / 100.0, 'Withdrawal request ID: ' || new_request.id::text);
    END IF;
    -- Example for coins (if you have a similar table):
    -- IF p_amount_type = 'coins' THEN
    --     INSERT INTO public.coin_transactions (user_id, type, status, coins, description)
    --     VALUES (p_user_id, 'withdrawal_request', 'pending', p_amount_cents, 'Coin withdrawal request ID: ' || new_request.id::text);
    -- END IF;

    RETURN NEXT new_request;
    RETURN;
END;
$$;

-- Function to cancel a withdrawal request by user with cancellation details
CREATE OR REPLACE FUNCTION public.cancel_withdrawal_request_by_user(
    p_request_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN -- Returns true on success, false or raises error on failure
LANGUAGE plpgsql
AS $$
DECLARE
    v_request public.withdrawal_requests%ROWTYPE;
BEGIN
    -- 1. Fetch the request to ensure it exists, belongs to the user, and is pending
    SELECT * INTO v_request
    FROM public.withdrawal_requests wr
    WHERE wr.id = p_request_id AND wr.user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request not found or access denied';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Withdrawal request is not in a cancellable state (must be pending)';
    END IF;

    -- 2. Update the request status and add cancellation details
    UPDATE public.withdrawal_requests
    SET status = 'cancelled', -- Or your withdrawal_status_enum type
        cancelled_at = NOW(),
        cancellation_reason = 'Cancelled by user',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- 3. Refund the amount to the user's balance
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.creator_profiles
        SET withdrawable_balance_cents = withdrawable_balance_cents + v_request.amount_cents
        WHERE id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins + v_request.amount_cents -- Assuming amount_cents for coins is the coin quantity
        WHERE id = p_user_id;
    ELSE
        RAISE WARNING 'Unknown amount_type for request ID: %', p_request_id; 
        -- Decide if this should be an error or just a warning
    END IF;

    -- 4. Optionally, update or create a transaction record
    -- Example for cash:
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.money_transactions
        SET status = 'cancelled' -- Or 'failed' or a specific cancellation status
        WHERE type = 'withdrawal' 
          AND description LIKE 'Withdrawal request ID: ' || v_request.id::text
          AND user_id = p_user_id;
        -- Or insert a new reversal transaction
    END IF;
    -- Example for coins:
    -- IF v_request.amount_type = 'coins' THEN
    --    UPDATE public.coin_transactions
    --    SET status = 'cancelled' 
    --    WHERE type = 'withdrawal_request' AND description LIKE 'Coin withdrawal request ID: ' || v_request.id::text;
    -- END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error or handle as needed
        RAISE WARNING 'Error cancelling withdrawal request %: %', p_request_id, SQLERRM;
        RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.create_withdrawal_request IS 'Creates a new withdrawal request, snapshots payout method details, updates user balance, and logs transaction. Handles both cash and coin withdrawals.';
COMMENT ON FUNCTION public.cancel_withdrawal_request_by_user IS 'Cancels a pending withdrawal request for a user, records cancellation details, and refunds the amount to the user balance.'; 