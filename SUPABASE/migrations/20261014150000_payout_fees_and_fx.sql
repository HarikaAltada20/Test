-- Payout processing fees per method and an admin-set USD to INR rate.
--
-- WHAT THIS MIGRATION DOES:
--   1. payout_method_type_settings: adds fee_bps (basis points, 250 = 2.5%) and updated_by.
--   2. New singleton payout_settings with usd_inr_rate (default 90).
--   3. withdrawal_requests: adds fee/net/FX snapshot columns. Existing rows get a
--      zero fee and net = amount, so pending requests are unchanged.
--   4. Replaces create_withdrawal_request (creators) and
--      create_advertiser_withdrawal_request (brands). Both now snapshot the fee
--      and rate, and refuse the request if the caller saw a different fee or rate.
--   5. Appends fee columns to admin_withdrawal_requests_list.
--   6. admin_withdrawal_payee_groups also returns fee/net totals.
--   7. New admin_withdrawal_fee_revenue RPC for the admin dashboard.
--
-- Fee maths (must match lib/payout-fees.ts):
--   fee_cents  = round(amount * fee_bps / 10000), half up
--   net_cents  = amount - fee_cents
--   INR paise  = round(net_cents * usd_inr_rate), half up (UPI and bank transfer only)
--
-- Seeds every fee at 0, so nothing changes for users until an admin sets a fee.
--
-- ROLLBACK: restore create_withdrawal_request from 20260903120000, the advertiser
-- function and admin_withdrawal_payee_groups from their previous migrations, then
-- drop admin_withdrawal_fee_revenue, payout_settings and the new columns.

-- 1. Per-method fee -----------------------------------------------------------

ALTER TABLE public.payout_method_type_settings
  ADD COLUMN IF NOT EXISTS fee_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_by uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payout_method_type_settings_fee_bps_check'
  ) THEN
    ALTER TABLE public.payout_method_type_settings
      ADD CONSTRAINT payout_method_type_settings_fee_bps_check CHECK (fee_bps BETWEEN 0 AND 5000);
  END IF;
END $$;

COMMENT ON COLUMN public.payout_method_type_settings.fee_bps IS
  'Processing fee for withdrawals with this method, in basis points (250 = 2.5%). Max 50%.';

INSERT INTO public.payout_method_type_settings (method_type, is_paused)
VALUES ('crypto', false), ('upi', false), ('bank_transfer', false), ('skydo', false)
ON CONFLICT (method_type) DO NOTHING;

-- 2. Global payout settings (single row) --------------------------------------

CREATE TABLE IF NOT EXISTS public.payout_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  usd_inr_rate numeric(10, 4) NOT NULL DEFAULT 90 CHECK (usd_inr_rate BETWEEN 1 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

COMMENT ON TABLE public.payout_settings IS
  'Single row of global payout settings. usd_inr_rate converts UPI and bank transfer payouts to INR.';

INSERT INTO public.payout_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payout_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payout_settings TO service_role;

-- 3. Snapshot columns on each withdrawal --------------------------------------

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS fee_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cents bigint NULL,
  ADD COLUMN IF NOT EXISTS payout_currency text NULL,
  ADD COLUMN IF NOT EXISTS fx_rate_snapshot numeric(10, 4) NULL,
  ADD COLUMN IF NOT EXISTS net_amount_local_minor bigint NULL;

COMMENT ON COLUMN public.withdrawal_requests.amount IS
  'Requested (gross) amount in cents, deducted from the balance. Refunded in full on reject/cancel.';
COMMENT ON COLUMN public.withdrawal_requests.fee_bps IS 'Processing fee rate at creation, basis points.';
COMMENT ON COLUMN public.withdrawal_requests.fee_cents IS 'Processing fee in cents (USD) kept by the platform once paid.';
COMMENT ON COLUMN public.withdrawal_requests.net_amount_cents IS 'amount - fee_cents. What is sent, in USD cents.';
COMMENT ON COLUMN public.withdrawal_requests.payout_currency IS 'INR for UPI and bank transfer, USD otherwise.';
COMMENT ON COLUMN public.withdrawal_requests.fx_rate_snapshot IS 'USD to INR rate at creation (INR payouts only).';
COMMENT ON COLUMN public.withdrawal_requests.net_amount_local_minor IS 'Amount to send in INR paise (INR payouts only).';

UPDATE public.withdrawal_requests
SET net_amount_cents = amount - fee_cents
WHERE net_amount_cents IS NULL;

-- Any insert that does not compute net (older code paths) gets net = amount - fee.
CREATE OR REPLACE FUNCTION public.withdrawal_requests_fill_net()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.net_amount_cents IS NULL THEN
    NEW.net_amount_cents := NEW.amount - COALESCE(NEW.fee_cents, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS withdrawal_requests_fill_net ON public.withdrawal_requests;
CREATE TRIGGER withdrawal_requests_fill_net
  BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.withdrawal_requests_fill_net();

ALTER TABLE public.withdrawal_requests ALTER COLUMN net_amount_cents SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_fee_net_check'
  ) THEN
    ALTER TABLE public.withdrawal_requests
      ADD CONSTRAINT withdrawal_requests_fee_net_check
      CHECK (fee_cents >= 0 AND net_amount_cents = amount - fee_cents);
  END IF;
END $$;

-- 4a. Shared quote used by both request functions ------------------------------

CREATE OR REPLACE FUNCTION public._payout_fee_quote(
  p_method_type text,
  p_amount bigint,
  OUT fee_bps integer,
  OUT fee_cents bigint,
  OUT net_cents bigint,
  OUT payout_currency text,
  OUT fx_rate numeric,
  OUT net_local_minor bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(s.fee_bps, 0) INTO fee_bps
  FROM public.payout_method_type_settings s
  WHERE s.method_type = p_method_type;
  fee_bps := COALESCE(fee_bps, 0);

  fee_cents := round(p_amount::numeric * fee_bps / 10000)::bigint;
  net_cents := p_amount - fee_cents;

  IF p_method_type IN ('upi', 'bank_transfer') THEN
    payout_currency := 'INR';
    SELECT ps.usd_inr_rate INTO fx_rate FROM public.payout_settings ps WHERE ps.id;
    fx_rate := COALESCE(fx_rate, 90);
    net_local_minor := round(net_cents::numeric * fx_rate)::bigint;
  ELSE
    payout_currency := 'USD';
    fx_rate := NULL;
    net_local_minor := NULL;
  END IF;
END;
$$;

-- SECURITY DEFINER so the request functions (which run as the caller) can read
-- payout_settings. It only returns the fee quote, nothing user-specific.
REVOKE ALL ON FUNCTION public._payout_fee_quote(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._payout_fee_quote(text, bigint) TO authenticated, service_role;

-- 4b. Creators ------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_withdrawal_request(uuid, uuid, integer, text, text, text, jsonb);

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

-- 4c. Brands (advertisers) ------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_advertiser_withdrawal_request(uuid, uuid, integer, text, text, text, jsonb);

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
    IF p_amount_type = 'cash' THEN
        SELECT COALESCE(ap.withdrawable_balance, 0) INTO current_cash_balance
        FROM public.advertiser_profiles ap WHERE ap.id = p_user_id;
        IF COALESCE(current_cash_balance, 0) < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash balance. Requested: %, Available: %', p_amount, COALESCE(current_cash_balance, 0);
        END IF;
    ELSIF p_amount_type = 'coins' THEN
        SELECT COALESCE(u.coins, 0) INTO current_coin_balance
        FROM public.users u WHERE u.id = p_user_id;
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

-- 5. Admin list view: append fee columns -----------------------------------------

CREATE OR REPLACE VIEW public.admin_withdrawal_requests_list AS
SELECT
  wr.id,
  wr.user_id,
  wr.payout_method_id,
  wr.amount,
  wr.currency,
  wr.status,
  wr.processed_at,
  wr.transaction_reference,
  wr.admin_notes,
  wr.user_notes,
  wr.created_at,
  wr.updated_at,
  wr.amount_type,
  wr.payout_method_type_snapshot,
  wr.payout_method_details_snapshot,
  wr.cancelled_at,
  wr.cancellation_reason,
  wr.redeemed_item_description,
  wr.payment_proof_link,
  wr.payment_proof_storage_path,
  wr.payment_proof_file_size_bytes,
  u.full_name AS user_full_name,
  u.email AS user_email,
  u.username AS user_username,
  wr.fee_bps,
  wr.fee_cents,
  wr.net_amount_cents,
  wr.payout_currency,
  wr.fx_rate_snapshot,
  wr.net_amount_local_minor,
  u.user_type AS user_type
FROM public.withdrawal_requests wr
LEFT JOIN public.users u ON u.id = wr.user_id;

-- 6. Payee groups: add fee and net totals -----------------------------------------

DROP FUNCTION IF EXISTS public.admin_withdrawal_payee_groups(text, text, timestamptz, timestamptz, integer, integer);

CREATE OR REPLACE FUNCTION public.admin_withdrawal_payee_groups(
  p_tab text DEFAULT 'all',
  p_method_type text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  method text,
  destination text,
  currency text,
  amount_type text,
  total_cents bigint,
  request_count bigint,
  usernames text[],
  names text[],
  statuses jsonb,
  latest_created_at timestamptz,
  request_ids uuid[],
  total_groups bigint,
  total_requests bigint,
  fee_cents bigint,
  net_cents bigint,
  net_local_minor bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH filtered AS (
    SELECT
      v.id,
      v.amount,
      v.fee_cents AS fee,
      v.net_amount_cents AS net,
      v.net_amount_local_minor AS net_local,
      v.status::text AS status,
      v.created_at,
      v.user_username,
      v.user_full_name,
      lower(coalesce(v.payout_method_type_snapshot, '')) AS m,
      coalesce(v.payout_method_details_snapshot, '{}'::jsonb) AS d,
      upper(coalesce(nullif(v.currency, ''), 'USD')) AS cur,
      coalesce(nullif(v.amount_type, ''), 'cash') AS atype
    FROM public.admin_withdrawal_requests_list v
    WHERE
      CASE lower(coalesce(p_tab, 'all'))
        WHEN 'pending' THEN v.status = 'pending'
        WHEN 'in_review' THEN v.status = 'in_review'
        WHEN 'approved' THEN v.status = 'approved'
        WHEN 'paid' THEN v.status = 'processed'
        WHEN 'rejected' THEN v.status IN ('rejected', 'cancelled')
        WHEN 'forfeited' THEN v.status = 'forfeited'
        WHEN 'failed' THEN v.status = 'failed'
        ELSE true
      END
      AND (p_method_type IS NULL
        OR lower(v.payout_method_type_snapshot) = lower(p_method_type))
      AND (p_from IS NULL OR v.created_at >= p_from)
      AND (p_to IS NULL OR v.created_at <= p_to)
  ),
  keyed AS (
    SELECT
      f.*,
      -- Case-sensitive: only leading/trailing [ \t\n\r\f\v] is ignored.
      CASE
        WHEN f.m = 'skydo' THEN btrim(coalesce(f.d->>'email', ''), f.ws)
        WHEN f.m = 'upi' THEN btrim(coalesce(f.d->>'upi_id', ''), f.ws)
        WHEN f.m = 'bank_transfer' THEN
          CASE
            WHEN btrim(coalesce(f.d->>'account_number', ''), f.ws) = '' THEN ''
            WHEN btrim(coalesce(nullif(f.d->>'ifsc_code', ''), f.d->>'swift_bic_code', ''), f.ws) = '' THEN
              btrim(coalesce(f.d->>'account_number', ''), f.ws)
            ELSE
              btrim(coalesce(f.d->>'account_number', ''), f.ws)
              || ' / '
              || btrim(coalesce(nullif(f.d->>'ifsc_code', ''), f.d->>'swift_bic_code', ''), f.ws)
          END
        WHEN f.m IN ('crypto', 'phantom') THEN btrim(coalesce(f.d->>'wallet_address', ''), f.ws)
        ELSE ''
      END AS dest
    FROM (
      SELECT filtered.*, E' \t\n\r\f' || chr(11) AS ws FROM filtered
    ) f
  ),
  normalised AS (
    SELECT
      k.*,
      CASE WHEN k.m = '' THEN 'unknown' ELSE k.m END AS gm,
      CASE WHEN k.dest = '' THEN 'Missing payee details' ELSE k.dest END AS gd
    FROM keyed k
  ),
  status_counts AS (
    SELECT n.gm, n.gd, n.cur, n.atype,
      jsonb_object_agg(n.status, n.cnt) AS statuses
    FROM (
      SELECT gm, gd, cur, atype, status, COUNT(*) AS cnt
      FROM normalised
      GROUP BY gm, gd, cur, atype, status
    ) n
    GROUP BY n.gm, n.gd, n.cur, n.atype
  ),
  groups AS (
    SELECT
      n.gm,
      n.gd,
      n.cur,
      n.atype,
      COALESCE(SUM(n.amount), 0)::bigint AS total_cents,
      COUNT(*)::bigint AS request_count,
      array_remove(array_agg(DISTINCT n.user_username), NULL) AS usernames,
      array_remove(array_agg(DISTINCT n.user_full_name), NULL) AS names,
      MAX(n.created_at) AS latest_created_at,
      array_agg(n.id ORDER BY n.created_at DESC) AS request_ids,
      COALESCE(SUM(n.fee), 0)::bigint AS fee_cents,
      COALESCE(SUM(n.net), 0)::bigint AS net_cents,
      -- Only when every request in the group has an INR amount (older requests do not).
      CASE WHEN COUNT(n.net_local) = COUNT(*) THEN SUM(n.net_local) END::bigint AS net_local_minor
    FROM normalised n
    GROUP BY n.gm, n.gd, n.cur, n.atype
  )
  SELECT
    g.gm,
    g.gd,
    g.cur,
    g.atype,
    g.total_cents,
    g.request_count,
    g.usernames,
    g.names,
    sc.statuses,
    g.latest_created_at,
    g.request_ids,
    COUNT(*) OVER ()::bigint AS total_groups,
    (SUM(g.request_count) OVER ())::bigint AS total_requests,
    g.fee_cents,
    g.net_cents,
    g.net_local_minor
  FROM groups g
  JOIN status_counts sc
    ON sc.gm = g.gm AND sc.gd = g.gd AND sc.cur = g.cur AND sc.atype = g.atype
  ORDER BY g.total_cents DESC, g.gm, g.gd, g.cur, g.atype
  LIMIT greatest(coalesce(p_limit, 25), 1)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.admin_withdrawal_payee_groups(text, text, timestamptz, timestamptz, integer, integer) IS
  'Admin: withdrawal requests grouped by payout destination (method + normalised destination + currency + amount type), paginated by group.';

REVOKE ALL ON FUNCTION public.admin_withdrawal_payee_groups(text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_payee_groups(text, text, timestamptz, timestamptz, integer, integer) TO service_role;

-- 7. Fee revenue for the admin dashboard -------------------------------------------
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
      CASE WHEN u.user_type = 'advertiser' THEN 'brand' ELSE 'creator' END AS pt,
      wr.status,
      wr.amount,
      wr.fee_cents,
      wr.processed_at,
      wr.created_at
    FROM public.withdrawal_requests wr
    LEFT JOIN public.users u ON u.id = wr.user_id
    WHERE coalesce(nullif(wr.amount_type, ''), 'cash') = 'cash'
  )
  SELECT
    b.m,
    b.pt,
    COUNT(*) FILTER (WHERE b.status = 'processed'
      AND (p_from IS NULL OR b.processed_at >= p_from)
      AND (p_to IS NULL OR b.processed_at <= p_to))::bigint,
    COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'processed'
      AND (p_from IS NULL OR b.processed_at >= p_from)
      AND (p_to IS NULL OR b.processed_at <= p_to)), 0)::bigint,
    COALESCE(SUM(b.fee_cents) FILTER (WHERE b.status = 'processed'
      AND (p_from IS NULL OR b.processed_at >= p_from)
      AND (p_to IS NULL OR b.processed_at <= p_to)), 0)::bigint,
    COUNT(*) FILTER (WHERE b.status IN ('pending', 'in_review', 'approved')
      AND (p_from IS NULL OR b.created_at >= p_from)
      AND (p_to IS NULL OR b.created_at <= p_to))::bigint,
    COALESCE(SUM(b.fee_cents) FILTER (WHERE b.status IN ('pending', 'in_review', 'approved')
      AND (p_from IS NULL OR b.created_at >= p_from)
      AND (p_to IS NULL OR b.created_at <= p_to)), 0)::bigint
  FROM base b
  GROUP BY b.m, b.pt
  ORDER BY b.m, b.pt;
$$;

COMMENT ON FUNCTION public.admin_withdrawal_fee_revenue(timestamptz, timestamptz) IS
  'Admin: processing fees earned on paid withdrawals and expected on open ones, by method and payer type.';

REVOKE ALL ON FUNCTION public.admin_withdrawal_fee_revenue(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_fee_revenue(timestamptz, timestamptz) TO service_role;
