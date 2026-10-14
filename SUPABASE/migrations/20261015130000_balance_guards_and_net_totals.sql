-- Stop signed-in users from changing balances themselves, and make admin
-- withdrawal totals show what is actually sent after fees.
--
-- Follow-up to 20261015120000_withdrawal_request_guards.sql.
--
-- WHY:
--   * Policies "Users can update their own creator profile" / "Advertisers can
--     update their own profile" allow every column, including
--     withdrawable_balance. A signed-in user could set their own balance.
--   * Money functions such as credit_creator_cash_atomic are SECURITY DEFINER and,
--     with Supabase's default function grants, callable by any signed-in user with
--     any user id and amount.
--   * The admin "Paid" card and payout chart summed the requested amount, which
--     overstates what was sent once fees apply.
--
-- WHAT THIS MIGRATION DOES:
--   1. Money functions can only be called by the service role (server code).
--   2. The two user cancel functions become SECURITY DEFINER, check the caller is
--      p_user_id, and lock the request row. Behaviour is otherwise unchanged.
--   3. BEFORE UPDATE guards: signed-in users cannot change withdrawable_balance,
--      total_money_won or the profile-reward flags on creator_profiles, nor
--      withdrawable_balance on advertiser_profiles. Server code (service role) and
--      SECURITY DEFINER functions are unaffected. Advertiser deposit balances are
--      not guarded here, because existing flows still update them with the user's
--      own session.
--   4. admin_withdrawal_status_summary also returns fee totals, and
--      admin_withdrawal_payout_series sums the amount after fees.
--
-- ROLLBACK: drop the two profile guard triggers, re-grant EXECUTE on the money
-- functions to authenticated, and restore the previous status summary / payout
-- series definitions.

-- 1. Money functions: server only ------------------------------------------------
-- Covers every overload by name, in case live signatures differ from the repo.

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'credit_creator_cash_atomic',
        'credit_advertiser_cash_atomic',
        'creator_payout_credit_atomic',
        'creator_payout_debit_atomic',
        'creator_payout_debit_idempotent_atomic',
        'grant_referral_cash_bonus'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- 2. User cancel functions --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_withdrawal_request_by_user(p_request_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.withdrawal_requests%ROWTYPE;
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Not allowed to cancel another user''s withdrawal.';
    END IF;

    SELECT * INTO v_request
    FROM public.withdrawal_requests wr
    WHERE wr.id = p_request_id AND wr.user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request (ID: %) not found for user (ID: %) or access denied.', p_request_id, p_user_id;
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Withdrawal request (ID: %) is not in a cancellable state. Current status: %.', p_request_id, v_request.status;
    END IF;

    UPDATE public.withdrawal_requests
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = 'Cancelled by user',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Refund the full requested amount (the fee is only kept on paid requests).
    IF v_request.amount_type = 'cash' THEN
        UPDATE public.creator_profiles
        SET withdrawable_balance = withdrawable_balance + v_request.amount
        WHERE id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins + v_request.amount
        WHERE id = p_user_id;
    END IF;

    IF v_request.amount_type = 'cash' THEN
        UPDATE public.money_transactions
        SET status = 'cancelled'
        WHERE type = 'withdrawal'
          AND withdrawal_request_id = v_request.id
          AND user_id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.coin_transactions
        SET status = 'cancelled'
        WHERE related_withdrawal_id = v_request.id
          AND user_id = p_user_id;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_advertiser_withdrawal_request_by_user(p_request_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.withdrawal_requests%ROWTYPE;
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Not allowed to cancel another user''s withdrawal.';
    END IF;

    SELECT * INTO v_request
    FROM public.withdrawal_requests wr
    WHERE wr.id = p_request_id AND wr.user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request not found or access denied';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Withdrawal request is not in a cancellable state';
    END IF;

    UPDATE public.withdrawal_requests
    SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Cancelled by advertiser', updated_at = NOW()
    WHERE id = p_request_id;

    IF v_request.amount_type = 'cash' THEN
        UPDATE public.advertiser_profiles
        SET withdrawable_balance = withdrawable_balance + v_request.amount
        WHERE id = p_user_id;
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.users
        SET coins = coins + v_request.amount
        WHERE id = p_user_id;
    END IF;

    IF v_request.amount_type = 'cash' THEN
        UPDATE public.money_transactions
        SET status = 'cancelled'
        WHERE type = 'withdrawal'
          AND user_id = p_user_id
          AND (
            description = 'Advertiser withdrawal request ID: ' || v_request.id::text
            OR metadata->>'withdrawal_request_id' = v_request.id::text
          );
    ELSIF v_request.amount_type = 'coins' THEN
        UPDATE public.coin_transactions
        SET status = 'cancelled'
        WHERE type = 'redemption' AND description LIKE 'Advertiser coin redemption: %' AND user_id = p_user_id;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_withdrawal_request_by_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_withdrawal_request_by_user(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_advertiser_withdrawal_request_by_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_advertiser_withdrawal_request_by_user(uuid, uuid) TO authenticated, service_role;

-- 3. Balance columns: no edits by signed-in users -----------------------------------

CREATE OR REPLACE FUNCTION public.guard_profile_money_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  -- Passed as trigger arguments, so each table lists its own protected columns.
  v_col text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  FOREACH v_col IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW) -> v_col) IS DISTINCT FROM (to_jsonb(OLD) -> v_col) THEN
      RAISE EXCEPTION 'You can''t change % yourself.', v_col USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_profiles_guard_money ON public.creator_profiles;
CREATE TRIGGER creator_profiles_guard_money
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_money_columns(
    'withdrawable_balance', 'total_money_won', 'has_claimed_profile_reward', 'profile_reward_claimed_at'
  );

DROP TRIGGER IF EXISTS advertiser_profiles_guard_money ON public.advertiser_profiles;
CREATE TRIGGER advertiser_profiles_guard_money
  BEFORE UPDATE ON public.advertiser_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_money_columns('withdrawable_balance');

-- 4a. Status summary: add fee totals --------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_withdrawal_status_summary(text);

CREATE OR REPLACE FUNCTION public.admin_withdrawal_status_summary(
  p_method_type text DEFAULT NULL
)
RETURNS TABLE (
  status text,
  request_count bigint,
  cash_amount_cents bigint,
  cash_fee_cents bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    wr.status::text,
    COUNT(*)::bigint AS request_count,
    COALESCE(SUM(CASE WHEN wr.amount_type = 'cash' THEN wr.amount ELSE 0 END), 0)::bigint AS cash_amount_cents,
    COALESCE(SUM(CASE WHEN wr.amount_type = 'cash' THEN wr.fee_cents ELSE 0 END), 0)::bigint AS cash_fee_cents
  FROM public.withdrawal_requests wr
  WHERE p_method_type IS NULL
    OR lower(wr.payout_method_type_snapshot) = lower(p_method_type)
  GROUP BY wr.status;
$$;

COMMENT ON FUNCTION public.admin_withdrawal_status_summary(text) IS
  'Admin: per-status withdrawal request counts, requested cash totals and fee totals (cents), optionally filtered by payout method type.';

REVOKE ALL ON FUNCTION public.admin_withdrawal_status_summary(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_status_summary(text) TO service_role;

-- 4b. Payout chart: amount actually sent ----------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_withdrawal_payout_series(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  day date,
  amount_cents bigint,
  payout_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    (wr.processed_at AT TIME ZONE 'UTC')::date AS day,
    COALESCE(SUM(wr.net_amount_cents), 0)::bigint AS amount_cents,
    COUNT(*)::bigint AS payout_count
  FROM public.withdrawal_requests wr
  WHERE wr.status = 'processed'
    AND wr.amount_type = 'cash'
    AND wr.processed_at IS NOT NULL
    AND (p_from IS NULL OR wr.processed_at >= p_from)
    AND (p_to IS NULL OR wr.processed_at <= p_to)
  GROUP BY (wr.processed_at AT TIME ZONE 'UTC')::date
  ORDER BY day ASC;
$$;

COMMENT ON FUNCTION public.admin_withdrawal_payout_series(timestamptz, timestamptz) IS
  'Admin: daily cash sent after fees (cents) and counts for processed cash withdrawals by processed_at UTC day.';

REVOKE ALL ON FUNCTION public.admin_withdrawal_payout_series(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_payout_series(timestamptz, timestamptz) TO service_role;
