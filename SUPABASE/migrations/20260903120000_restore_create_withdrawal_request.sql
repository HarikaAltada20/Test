-- Repair: 20260902120000 originally replaced create_withdrawal_request and
-- dropped the paused-method check plus pending money/coin ledger inserts.
-- Safe to re-run. Only extra behavior vs 20260314 is the negative-balance
-- withdrawal error after a clawback.

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_user_id uuid,
  p_payout_method_id uuid,
  p_amount integer,
  p_currency text,
  p_amount_type text,
  p_user_notes text,
  p_redeemed_item_description jsonb DEFAULT NULL::jsonb
)
RETURNS SETOF public.withdrawal_requests
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_payout_method_type TEXT := NULL;
    v_payout_method_details JSONB := NULL;
    new_request public.withdrawal_requests;
    current_coin_balance integer;
    current_cash_balance integer;
BEGIN
    IF p_amount_type = 'cash' THEN
        SELECT cp.withdrawable_balance INTO current_cash_balance FROM public.creator_profiles cp WHERE cp.id = p_user_id;
        IF current_cash_balance IS NULL THEN
            current_cash_balance := 0;
        END IF;
        IF current_cash_balance < 0 THEN
            RAISE EXCEPTION 'Outstanding balance must be cleared before withdrawing. Current balance: % cents', current_cash_balance;
        END IF;
        IF current_cash_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance. Requested: %, Available: %', p_amount, current_cash_balance;
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        SELECT u.coins INTO current_coin_balance FROM public.users u WHERE u.id = p_user_id;
        IF current_coin_balance IS NULL OR current_coin_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient coin balance. Requested: %, Available: %', p_amount, COALESCE(current_coin_balance, 0);
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid amount type specified: %', p_amount_type;
    END IF;

    IF p_payout_method_id IS NOT NULL THEN
        SELECT pm.method_type, pm.details INTO v_payout_method_type, v_payout_method_details
        FROM public.payout_methods pm
        WHERE pm.id = p_payout_method_id AND pm.user_id = p_user_id;

        IF v_payout_method_type IS NULL THEN
            RAISE EXCEPTION 'Payout method (ID: %) not found or does not belong to the user.', p_payout_method_id;
        END IF;

        IF (SELECT is_paused FROM public.payout_method_type_settings WHERE method_type = v_payout_method_type) = true THEN
            RAISE EXCEPTION 'This payment method is not available for now. Please try with a different payment method.';
        END IF;
    ELSIF p_amount_type = 'cash' THEN
        RAISE EXCEPTION 'Payout method ID is required for cash withdrawals.';
    END IF;

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

    IF p_amount_type = 'cash' THEN
        UPDATE public.creator_profiles
        SET withdrawable_balance = withdrawable_balance - p_amount
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount
        WHERE id = p_user_id;
    END IF;

    IF p_amount_type = 'cash' THEN
        INSERT INTO public.money_transactions (user_id, type, status, amount, currency, description, withdrawal_request_id)
        VALUES (p_user_id, 'withdrawal', 'pending', p_amount, p_currency, 'Cash withdrawal request initiated.', new_request.id);
    ELSIF p_amount_type = 'coins' THEN
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description, related_withdrawal_id)
        VALUES (p_user_id, 'redemption_request', 'pending', p_amount, 'Coin redemption request: ' || COALESCE((p_redeemed_item_description->>'name')::text, 'Item'), new_request.id);
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;
$$;
