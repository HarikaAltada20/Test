-- Allow admin reversal clawbacks to debit below zero (creator owes platform).
-- Default p_allow_negative_balance = false preserves existing rollback safety.

-- Remove legacy 2-arg overload so PostgREST cannot resolve the old function
-- when p_allow_negative_balance is passed (CREATE OR REPLACE adds an overload).
DROP FUNCTION IF EXISTS public.creator_payout_debit_atomic(uuid, bigint);

CREATE OR REPLACE FUNCTION public.creator_payout_debit_atomic(
  p_creator_id uuid,
  p_amount_cents bigint,
  p_allow_negative_balance boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal bigint;
  v_won bigint;
  v_new_bal bigint;
  v_new_won bigint;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('creator_wallet_debit'),
    hashtext(p_creator_id::text)
  );

  SELECT
    COALESCE(cp.withdrawable_balance, 0)::bigint,
    COALESCE(cp.total_money_won, 0)::bigint
  INTO v_bal, v_won
  FROM public.creator_profiles cp
  WHERE cp.id = p_creator_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator profile not found for %', p_creator_id;
  END IF;

  IF NOT COALESCE(p_allow_negative_balance, false) AND v_bal < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient withdrawable balance to reverse % cents (have %)', p_amount_cents, v_bal;
  END IF;

  v_new_bal := v_bal - p_amount_cents;
  v_new_won := GREATEST(0::bigint, v_won - p_amount_cents);

  UPDATE public.creator_profiles cp
  SET
    withdrawable_balance = v_new_bal,
    total_money_won = v_new_won
  WHERE cp.id = p_creator_id;

  RETURN json_build_object(
    'new_balance', v_new_bal,
    'new_total_won', v_new_won
  );
END;
$$;

REVOKE ALL ON FUNCTION public.creator_payout_debit_atomic(uuid, bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_payout_debit_atomic(uuid, bigint, boolean) TO service_role;

DROP FUNCTION IF EXISTS public.creator_payout_debit_idempotent_atomic(uuid, bigint, text);

CREATE OR REPLACE FUNCTION public.creator_payout_debit_idempotent_atomic(
  p_creator_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text,
  p_allow_negative_balance boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing_amount bigint;
  v_bal bigint;
  v_won bigint;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(p_creator_id::text),
    hashtext(v_key)
  );

  SELECT amount_cents INTO v_existing_amount
  FROM public.creator_wallet_debit_operations
  WHERE creator_id = p_creator_id
    AND idempotency_key = v_key;

  IF FOUND THEN
    IF v_existing_amount <> p_amount_cents THEN
      RAISE EXCEPTION 'idempotency key amount mismatch';
    END IF;
    SELECT COALESCE(withdrawable_balance, 0)::bigint INTO v_bal
    FROM public.creator_profiles
    WHERE id = p_creator_id;
    RETURN json_build_object(
      'new_balance', v_bal,
      'already_applied', true
    );
  END IF;

  SELECT
    COALESCE(withdrawable_balance, 0)::bigint,
    COALESCE(total_money_won, 0)::bigint
  INTO v_bal, v_won
  FROM public.creator_profiles
  WHERE id = p_creator_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator profile not found for %', p_creator_id;
  END IF;

  IF NOT COALESCE(p_allow_negative_balance, false) AND v_bal < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient withdrawable balance to reverse % cents (have %)', p_amount_cents, v_bal;
  END IF;

  UPDATE public.creator_profiles
  SET withdrawable_balance = v_bal - p_amount_cents,
      total_money_won = GREATEST(0::bigint, v_won - p_amount_cents)
  WHERE id = p_creator_id;

  INSERT INTO public.creator_wallet_debit_operations (
    creator_id,
    idempotency_key,
    amount_cents
  ) VALUES (
    p_creator_id,
    v_key,
    p_amount_cents
  );

  RETURN json_build_object(
    'new_balance', v_bal - p_amount_cents,
    'already_applied', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.creator_payout_debit_idempotent_atomic(uuid, bigint, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_payout_debit_idempotent_atomic(uuid, bigint, text, boolean) TO service_role;

-- Clearer withdrawal error when creator owes money (negative balance).
-- Keep pause-check + pending ledger inserts from 20260314_payout_method_type_settings.sql.
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
    -- 1. Check user's balance
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
END;
$$;
