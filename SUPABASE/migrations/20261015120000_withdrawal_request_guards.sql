-- Protect withdrawal requests from edits by their owners, and make fee revenue
-- reporting read only the rows in the requested period.
--
-- Follow-up to 20261014150000_payout_fees_and_fx.sql (PR #204 review).
--
-- WHY:
--   The table policy "Users can update their own withdrawal requests" lets a
--   signed-in user change any column of their own request, and "Users can insert
--   their own withdrawal requests" lets them insert rows directly. Through the
--   API a user could zero their fee, raise the INR amount, raise `amount` on a
--   pending request and then cancel it (the cancel refunds the edited amount),
--   or insert a request that never debited their balance.
--
-- WHAT THIS MIGRATION DOES:
--   1. BEFORE UPDATE guard: signed-in users (role authenticated/anon) may only
--      cancel their own pending request. Every other column must stay the same.
--      Admin routes (service role) and SECURITY DEFINER functions are unaffected.
--   2. BEFORE INSERT guard: signed-in users cannot insert rows directly.
--   3. create_withdrawal_request and create_advertiser_withdrawal_request become
--      SECURITY DEFINER (so their insert passes the guard), check that the caller
--      is p_user_id, and lock the balance row (FOR UPDATE) to stop double spends.
--   4. admin_withdrawal_fee_revenue filters rows by period and status before
--      aggregating, using the existing status and processed_at indexes.
--
-- Function signatures are unchanged, so no app change or deploy order is needed.
--
-- ROLLBACK: drop the two triggers and their functions, and re-run sections 4b, 4c
-- and 7 of 20261014150000_payout_fees_and_fx.sql.

-- 1. Owners may only cancel their own pending request ------------------------------

CREATE OR REPLACE FUNCTION public.withdrawal_requests_guard_user_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  -- Columns the user-facing cancel flow may change. Everything else is locked,
  -- including any column added later.
  v_allowed text[] := ARRAY['status', 'cancelled_at', 'cancellation_reason', 'updated_at', 'user_notes'];
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - v_allowed) IS DISTINCT FROM (to_jsonb(OLD) - v_allowed) THEN
    RAISE EXCEPTION 'Withdrawal requests can only be cancelled, not edited.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'pending' AND NEW.status = 'cancelled') THEN
    RAISE EXCEPTION 'Only a pending withdrawal request can be cancelled.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS withdrawal_requests_guard_user_update ON public.withdrawal_requests;
CREATE TRIGGER withdrawal_requests_guard_user_update
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.withdrawal_requests_guard_user_update();

-- 2. No direct inserts by signed-in users -----------------------------------------

CREATE OR REPLACE FUNCTION public.withdrawal_requests_guard_user_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Withdrawal requests must be created through the withdrawal form.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS withdrawal_requests_guard_user_insert ON public.withdrawal_requests;
CREATE TRIGGER withdrawal_requests_guard_user_insert
  BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.withdrawal_requests_guard_user_insert();

-- 3a. Creators -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_user_id uuid,
  p_payout_method_id uuid,
  p_amount integer,
  p_currency text,
  p_amount_type text,
  p_user_notes text,
  p_redeemed_item_description jsonb DEFAULT NULL::jsonb,
  p_expected_fee_bps integer DEFAULT NULL,
  p_expected_usd_inr_rate numeric DEFAULT NULL
)
RETURNS SETOF public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payout_method_type TEXT := NULL;
    v_payout_method_details JSONB := NULL;
    new_request public.withdrawal_requests;
    current_coin_balance integer;
    current_cash_balance integer;
    v_fee_bps integer := 0;
    v_fee_cents bigint := 0;
    v_net_cents bigint := p_amount;
    v_payout_currency text := NULL;
    v_fx_rate numeric := NULL;
    v_net_local bigint := NULL;
BEGIN
    -- Callers can only create requests for themselves (server code using the service role may act for anyone).
    IF COALESCE(auth.role(), '') <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Not allowed to create a withdrawal for another user.';
    END IF;

    IF p_amount_type = 'cash' THEN
        -- FOR UPDATE: two requests at the same moment cannot both pass the balance check.
        SELECT cp.withdrawable_balance INTO current_cash_balance FROM public.creator_profiles cp WHERE cp.id = p_user_id FOR UPDATE;
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
        SELECT u.coins INTO current_coin_balance FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
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

    IF p_amount_type = 'cash' THEN
        SELECT fq.fee_bps, fq.fee_cents, fq.net_cents, fq.payout_currency, fq.fx_rate, fq.net_local_minor
        INTO v_fee_bps, v_fee_cents, v_net_cents, v_payout_currency, v_fx_rate, v_net_local
        FROM public._payout_fee_quote(v_payout_method_type, p_amount) fq;
        IF (p_expected_fee_bps IS NOT NULL AND p_expected_fee_bps <> v_fee_bps)
           OR (p_expected_usd_inr_rate IS NOT NULL AND v_fx_rate IS NOT NULL AND p_expected_usd_inr_rate <> v_fx_rate) THEN
            RAISE EXCEPTION 'Fees were just updated. Please review the new amount and try again.';
        END IF;
        IF v_net_cents <= 0 THEN
            RAISE EXCEPTION 'This amount is too small to withdraw after the processing fee.';
        END IF;
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
        redeemed_item_description,
        fee_bps,
        fee_cents,
        net_amount_cents,
        payout_currency,
        fx_rate_snapshot,
        net_amount_local_minor
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
        END,
        v_fee_bps,
        v_fee_cents,
        v_net_cents,
        v_payout_currency,
        v_fx_rate,
        v_net_local
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
        INSERT INTO public.money_transactions (user_id, type, status, amount, currency, description, withdrawal_request_id, metadata)
        VALUES (
            p_user_id, 'withdrawal', 'pending', p_amount, p_currency, 'Cash withdrawal request initiated.', new_request.id,
            jsonb_build_object(
                'fee_bps', new_request.fee_bps,
                'fee_cents', new_request.fee_cents,
                'net_amount_cents', new_request.net_amount_cents,
                'payout_currency', new_request.payout_currency,
                'fx_rate', new_request.fx_rate_snapshot,
                'net_amount_local_minor', new_request.net_amount_local_minor
            )
        );
    ELSIF p_amount_type = 'coins' THEN
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description, related_withdrawal_id)
        VALUES (p_user_id, 'redemption_request', 'pending', p_amount, 'Coin redemption request: ' || COALESCE((p_redeemed_item_description->>'name')::text, 'Item'), new_request.id);
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.create_withdrawal_request(uuid, uuid, integer, text, text, text, jsonb, integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(uuid, uuid, integer, text, text, text, jsonb, integer, numeric) TO authenticated, service_role;

-- 3b. Brands (advertisers) ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_advertiser_withdrawal_request(
  p_user_id uuid,
  p_payout_method_id uuid,
  p_amount integer,
  p_currency text,
  p_amount_type text,
  p_user_notes text DEFAULT NULL::text,
  p_redeemed_item_description jsonb DEFAULT NULL::jsonb,
  p_expected_fee_bps integer DEFAULT NULL,
  p_expected_usd_inr_rate numeric DEFAULT NULL
)
RETURNS SETOF public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payout_method_type TEXT := NULL;
    v_payout_method_details JSONB := NULL;
    new_request public.withdrawal_requests;
    current_coin_balance INTEGER;
    current_cash_balance INTEGER;
    v_fee_bps integer := 0;
    v_fee_cents bigint := 0;
    v_net_cents bigint := p_amount;
    v_payout_currency text := NULL;
    v_fx_rate numeric := NULL;
    v_net_local bigint := NULL;
BEGIN
    -- Callers can only create requests for themselves (server code using the service role may act for anyone).
    IF COALESCE(auth.role(), '') <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Not allowed to create a withdrawal for another user.';
    END IF;

    IF p_amount_type = 'cash' THEN
        -- FOR UPDATE: two requests at the same moment cannot both pass the balance check.
        SELECT COALESCE(ap.withdrawable_balance, 0) INTO current_cash_balance
        FROM public.advertiser_profiles ap WHERE ap.id = p_user_id FOR UPDATE;
        IF COALESCE(current_cash_balance, 0) < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance. Requested: %, Available: %', p_amount, COALESCE(current_cash_balance, 0);
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        SELECT COALESCE(u.coins, 0) INTO current_coin_balance
        FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
        IF COALESCE(current_coin_balance, 0) < p_amount THEN
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
            RAISE EXCEPTION 'Payout method not found or does not belong to the user';
        END IF;

        IF (SELECT is_paused FROM public.payout_method_type_settings WHERE method_type = v_payout_method_type) = true THEN
            RAISE EXCEPTION 'This payment method is not available for now. Please try with a different payment method.';
        END IF;
    ELSIF p_amount_type = 'cash' THEN
        RAISE EXCEPTION 'Payout method ID is required for cash withdrawals';
    END IF;

    IF p_amount_type = 'cash' THEN
        SELECT fq.fee_bps, fq.fee_cents, fq.net_cents, fq.payout_currency, fq.fx_rate, fq.net_local_minor
        INTO v_fee_bps, v_fee_cents, v_net_cents, v_payout_currency, v_fx_rate, v_net_local
        FROM public._payout_fee_quote(v_payout_method_type, p_amount) fq;
        IF (p_expected_fee_bps IS NOT NULL AND p_expected_fee_bps <> v_fee_bps)
           OR (p_expected_usd_inr_rate IS NOT NULL AND v_fx_rate IS NOT NULL AND p_expected_usd_inr_rate <> v_fx_rate) THEN
            RAISE EXCEPTION 'Fees were just updated. Please review the new amount and try again.';
        END IF;
        IF v_net_cents <= 0 THEN
            RAISE EXCEPTION 'This amount is too small to withdraw after the processing fee.';
        END IF;
    END IF;

    INSERT INTO public.withdrawal_requests (
        user_id, payout_method_id, amount, currency, amount_type, status, user_notes,
        payout_method_type_snapshot, payout_method_details_snapshot, redeemed_item_description,
        fee_bps, fee_cents, net_amount_cents, payout_currency, fx_rate_snapshot, net_amount_local_minor
    )
    VALUES (
        p_user_id, p_payout_method_id, p_amount, p_currency, p_amount_type, 'pending', p_user_notes,
        v_payout_method_type, v_payout_method_details,
        CASE WHEN p_amount_type = 'coins' THEN p_redeemed_item_description ELSE NULL END,
        v_fee_bps,
        v_fee_cents,
        v_net_cents,
        v_payout_currency,
        v_fx_rate,
        v_net_local
    )
    RETURNING * INTO new_request;

    IF p_amount_type = 'cash' THEN
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance - p_amount
        WHERE id = p_user_id;
    ELSIF p_amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins - p_amount
        WHERE id = p_user_id;
    END IF;

    IF p_amount_type = 'cash' THEN
        INSERT INTO public.money_transactions (user_id, type, status, amount, description, metadata)
        VALUES (
            p_user_id, 'withdrawal', 'pending', p_amount, 'Advertiser withdrawal request ID: ' || new_request.id::text,
            jsonb_build_object(
                'withdrawal_request_id', new_request.id,
                'fee_bps', new_request.fee_bps,
                'fee_cents', new_request.fee_cents,
                'net_amount_cents', new_request.net_amount_cents,
                'payout_currency', new_request.payout_currency,
                'fx_rate', new_request.fx_rate_snapshot,
                'net_amount_local_minor', new_request.net_amount_local_minor
            )
        );
    ELSIF p_amount_type = 'coins' THEN
        INSERT INTO public.coin_transactions (user_id, type, status, coins, description)
        VALUES (p_user_id, 'redemption', 'pending', p_amount, 'Advertiser coin redemption: ' || COALESCE((p_redeemed_item_description->>'name')::text, 'Item'));
    END IF;

    RETURN NEXT new_request;
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.create_advertiser_withdrawal_request(uuid, uuid, integer, text, text, text, jsonb, integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_advertiser_withdrawal_request(uuid, uuid, integer, text, text, text, jsonb, integer, numeric) TO authenticated, service_role;

-- 4. Fee revenue: filter rows first, then aggregate ---------------------------------
-- Earned = paid (processed) withdrawals, by processed_at.
-- Expected = pending / in_review / approved withdrawals, by created_at.

CREATE OR REPLACE FUNCTION public.admin_withdrawal_fee_revenue(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  method text,
  payer_type text,
  paid_count bigint,
  paid_gross_cents bigint,
  paid_fee_cents bigint,
  expected_count bigint,
  expected_fee_cents bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH base AS (
    SELECT
      coalesce(nullif(lower(wr.payout_method_type_snapshot), ''), 'unknown') AS m,
      wr.user_id,
      (wr.status = 'processed') AS is_paid,
      wr.amount,
      wr.fee_cents
    FROM public.withdrawal_requests wr
    WHERE wr.status = 'processed'
      AND (p_from IS NULL OR wr.processed_at >= p_from)
      AND (p_to IS NULL OR wr.processed_at <= p_to)
      AND coalesce(nullif(wr.amount_type, ''), 'cash') = 'cash'
    UNION ALL
    SELECT
      coalesce(nullif(lower(wr.payout_method_type_snapshot), ''), 'unknown'),
      wr.user_id,
      false,
      wr.amount,
      wr.fee_cents
    FROM public.withdrawal_requests wr
    WHERE wr.status IN ('pending', 'in_review', 'approved')
      AND (p_from IS NULL OR wr.created_at >= p_from)
      AND (p_to IS NULL OR wr.created_at <= p_to)
      AND coalesce(nullif(wr.amount_type, ''), 'cash') = 'cash'
  )
  SELECT
    b.m,
    CASE WHEN u.user_type = 'advertiser' THEN 'brand' ELSE 'creator' END,
    COUNT(*) FILTER (WHERE b.is_paid)::bigint,
    COALESCE(SUM(b.amount) FILTER (WHERE b.is_paid), 0)::bigint,
    COALESCE(SUM(b.fee_cents) FILTER (WHERE b.is_paid), 0)::bigint,
    COUNT(*) FILTER (WHERE NOT b.is_paid)::bigint,
    COALESCE(SUM(b.fee_cents) FILTER (WHERE NOT b.is_paid), 0)::bigint
  FROM base b
  LEFT JOIN public.users u ON u.id = b.user_id
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

COMMENT ON FUNCTION public.admin_withdrawal_fee_revenue(timestamptz, timestamptz) IS
  'Admin: processing fees earned on paid withdrawals and expected on open ones, by method and payer type.';

REVOKE ALL ON FUNCTION public.admin_withdrawal_fee_revenue(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_fee_revenue(timestamptz, timestamptz) TO service_role;

-- Each half of the query reads only its own status and date window.
CREATE INDEX IF NOT EXISTS withdrawal_requests_status_processed_at_idx
  ON public.withdrawal_requests (status, processed_at);
CREATE INDEX IF NOT EXISTS withdrawal_requests_status_created_at_idx
  ON public.withdrawal_requests (status, created_at);
