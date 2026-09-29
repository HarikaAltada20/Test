-- Payout method type settings: allow admin to pause specific payout methods (e.g. crypto) globally.
-- When paused, users cannot create new withdrawal requests using that method type.
--
-- WHAT THIS MIGRATION DOES:
--   1. Creates table payout_method_type_settings (method_type, is_paused, updated_at).
--   2. Seeds four method types (crypto, upi, bank_transfer, phantom) all enabled (is_paused = false).
--   3. Replaces create_withdrawal_request (creators) with same logic + pause check before creating request.
--   4. Replaces create_advertiser_withdrawal_request (advertisers) with same logic + pause check.
--
-- SAFETY:
--   - CREATE TABLE IF NOT EXISTS and ON CONFLICT DO NOTHING avoid errors on re-run.
--   - If a method_type is not in the table, (SELECT is_paused ...) returns NULL, and NULL = true is false, so we do NOT block (unknown types remain allowed).
--   - Function signatures and INSERT columns match your existing schema (see db/public_schema_only.sql). If your live DB has different column names or constraints, run a diff first.
--
-- ROLLBACK (if needed): Drop the table and restore the two functions from your schema backup (no pause check).

-- 1. Create table (admin-only writes via app; reads for create_withdrawal_request and public API)
CREATE TABLE IF NOT EXISTS public.payout_method_type_settings (
    method_type text PRIMARY KEY,
    is_paused boolean NOT NULL DEFAULT false,
    updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.payout_method_type_settings IS 'Global on/off for payout method types. When is_paused is true, users cannot request withdrawals using that method.';

-- 2. Seed known method types (all enabled by default)
INSERT INTO public.payout_method_type_settings (method_type, is_paused)
VALUES
    ('crypto', false),
    ('upi', false),
    ('bank_transfer', false),
    ('phantom', false)
ON CONFLICT (method_type) DO NOTHING;

-- 3. Add paused-method check to create_withdrawal_request (creators)
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(p_user_id uuid, p_payout_method_id uuid, p_amount integer, p_currency text, p_amount_type text, p_user_notes text, p_redeemed_item_description jsonb DEFAULT NULL::jsonb) RETURNS SETOF public.withdrawal_requests
    LANGUAGE plpgsql
    AS $$DECLARE
    v_payout_method_type TEXT := NULL;
    v_payout_method_details JSONB := NULL;
    new_request public.withdrawal_requests;
    current_coin_balance integer;
    current_cash_balance integer;
BEGIN
    -- 1. Check user's balance
    IF p_amount_type = 'cash' THEN
        SELECT cp.withdrawable_balance INTO current_cash_balance FROM public.creator_profiles cp WHERE cp.id = p_user_id;
        IF current_cash_balance IS NULL OR current_cash_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance. Requested: %, Available: %', p_amount, COALESCE(current_cash_balance, 0);
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        SELECT u.coins INTO current_coin_balance FROM public.users u WHERE u.id = p_user_id;
        IF current_coin_balance IS NULL OR current_coin_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient coin balance. Requested: %, Available: %', p_amount, COALESCE(current_coin_balance, 0);
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid amount type specified: %', p_amount_type;
    END IF;

    -- 2. Fetch payout method details if ID is provided
    IF p_payout_method_id IS NOT NULL THEN
        SELECT pm.method_type, pm.details INTO v_payout_method_type, v_payout_method_details
        FROM public.payout_methods pm
        WHERE pm.id = p_payout_method_id AND pm.user_id = p_user_id;

        IF v_payout_method_type IS NULL THEN
            RAISE EXCEPTION 'Payout method (ID: %) not found or does not belong to the user.', p_payout_method_id;
        END IF;

        -- 2b. Block if this payout method type is paused by admin
        IF (SELECT is_paused FROM public.payout_method_type_settings WHERE method_type = v_payout_method_type) = true THEN
            RAISE EXCEPTION 'This payment method is not available for now. Please try with a different payment method.';
        END IF;
    ELSIF p_amount_type = 'cash' THEN
        RAISE EXCEPTION 'Payout method ID is required for cash withdrawals.';
    END IF;

    -- 3. Create the withdrawal/redemption request
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

    -- 4. Deduct from user's balance
    IF p_amount_type = 'cash' THEN
        UPDATE public.creator_profiles
        SET withdrawable_balance = withdrawable_balance - p_amount
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount
        WHERE id = p_user_id;
    END IF;

    -- 5. Create a transaction record
    IF p_amount_type = 'cash' THEN
        INSERT INTO public.money_transactions (user_id, type, status, amount, currency, description, withdrawal_request_id)
        VALUES (p_user_id, 'withdrawal', 'pending', p_amount, p_currency, 'Cash withdrawal request initiated.', new_request.id);
    ELSIF p_amount_type = 'coins' THEN
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description, related_withdrawal_id)
        VALUES (p_user_id, 'redemption_request', 'pending', p_amount, 'Coin redemption request: ' || COALESCE((p_redeemed_item_description->>'name')::text, 'Item'), new_request.id);
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;$$;

-- 4. Add paused-method check to create_advertiser_withdrawal_request (advertisers)
CREATE OR REPLACE FUNCTION public.create_advertiser_withdrawal_request(p_user_id uuid, p_payout_method_id uuid, p_amount integer, p_currency text, p_amount_type text, p_user_notes text DEFAULT NULL::text, p_redeemed_item_description jsonb DEFAULT NULL::jsonb) RETURNS SETOF public.withdrawal_requests
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_payout_method_type TEXT := NULL;
    v_payout_method_details JSONB := NULL;
    new_request public.withdrawal_requests;
    current_coin_balance INTEGER;
    current_cash_balance INTEGER;
BEGIN
    -- 1. Check user's balance
    IF p_amount_type = 'cash' THEN
        SELECT COALESCE(ap.withdrawable_balance, 0) INTO current_cash_balance
        FROM public.advertiser_profiles ap WHERE ap.id = p_user_id;
        IF current_cash_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance. Requested: %, Available: %', p_amount, current_cash_balance;
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        SELECT COALESCE(u.coins, 0) INTO current_coin_balance
        FROM public.users u WHERE u.id = p_user_id;
        IF current_coin_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient coin balance. Requested: %, Available: %', p_amount, current_coin_balance;
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid amount type specified: %', p_amount_type;
    END IF;

    -- 2. Fetch payout method details if ID is provided
    IF p_payout_method_id IS NOT NULL THEN
        SELECT pm.method_type, pm.details INTO v_payout_method_type, v_payout_method_details
        FROM public.payout_methods pm
        WHERE pm.id = p_payout_method_id AND pm.user_id = p_user_id;

        IF v_payout_method_type IS NULL THEN
            RAISE EXCEPTION 'Payout method not found or does not belong to the user';
        END IF;

        -- 2b. Block if this payout method type is paused by admin
        IF (SELECT is_paused FROM public.payout_method_type_settings WHERE method_type = v_payout_method_type) = true THEN
            RAISE EXCEPTION 'This payment method is not available for now. Please try with a different payment method.';
        END IF;
    ELSIF p_amount_type = 'cash' THEN
        RAISE EXCEPTION 'Payout method ID is required for cash withdrawals';
    END IF;

    -- 3. Create the withdrawal request
    INSERT INTO public.withdrawal_requests (
        user_id, payout_method_id, amount, currency, amount_type, status, user_notes,
        payout_method_type_snapshot, payout_method_details_snapshot, redeemed_item_description
    )
    VALUES (
        p_user_id, p_payout_method_id, p_amount, p_currency, p_amount_type, 'pending', p_user_notes,
        v_payout_method_type, v_payout_method_details,
        CASE WHEN p_amount_type = 'coins' THEN p_redeemed_item_description ELSE NULL END
    )
    RETURNING * INTO new_request;

    -- 4. Deduct from user's balance
    IF p_amount_type = 'cash' THEN
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance - p_amount
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount
        WHERE id = p_user_id;
    END IF;

    -- 5. Create transaction record
    IF p_amount_type = 'cash' THEN
        INSERT INTO public.money_transactions (user_id, type, status, amount, description)
        VALUES (p_user_id, 'withdrawal', 'pending', p_amount, 'Advertiser withdrawal request ID: ' || new_request.id::text);
    ELSIF p_amount_type = 'coins' THEN
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description)
        VALUES (p_user_id, 'redemption', 'pending', p_amount, 'Advertiser coin redemption: ' || COALESCE((p_redeemed_item_description->>'name')::text, 'Item'));
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;
$$;
