-- Serialized dual-rewards prize pool check (advisory lock per contest).
-- Mirrors lib/dual-rewards-pool-budget.ts so concurrent admin payouts cannot exceed the pool.

CREATE OR REPLACE FUNCTION public.dual_rewards_submission_paid_cents(
  p_earnings bigint,
  p_paid boolean,
  p_bonus_amount bigint,
  p_bonus_paid boolean,
  p_dual_rewards_payout jsonb
)
RETURNS TABLE (cpm_cents bigint, milestone_cents bigint)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cpm bigint := 0;
  v_ms bigint := 0;
  v_has_cpm boolean := false;
  v_has_ms boolean := false;
BEGIN
  IF p_dual_rewards_payout IS NOT NULL
    AND jsonb_typeof(p_dual_rewards_payout) = 'object'
  THEN
    IF p_dual_rewards_payout ? 'cpm_cents'
      AND (p_dual_rewards_payout->>'cpm_cents') ~ '^-?\d+$'
    THEN
      v_cpm := GREATEST(0, (p_dual_rewards_payout->>'cpm_cents')::bigint);
      v_has_cpm := true;
    END IF;
    IF p_dual_rewards_payout ? 'milestone_cents'
      AND (p_dual_rewards_payout->>'milestone_cents') ~ '^-?\d+$'
    THEN
      v_ms := GREATEST(0, (p_dual_rewards_payout->>'milestone_cents')::bigint);
      v_has_ms := true;
    END IF;
  END IF;

  IF NOT v_has_cpm THEN
    IF COALESCE(p_paid, false) THEN
      v_cpm := GREATEST(0, COALESCE(p_earnings, 0));
    ELSE
      v_cpm := 0;
    END IF;
  END IF;

  IF NOT v_has_ms THEN
    IF COALESCE(p_bonus_paid, false) THEN
      v_ms := GREATEST(0, COALESCE(p_bonus_amount, 0));
    ELSE
      v_ms := 0;
    END IF;
  END IF;

  RETURN QUERY SELECT v_cpm, v_ms;
END;
$$;

CREATE OR REPLACE FUNCTION public.dual_rewards_pool_budget_cents_from_contest(
  p_contest_type text,
  p_details jsonb,
  p_total_budget bigint
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_root bigint;
  v_ms bigint;
  v_cpm bigint;
BEGIN
  IF p_contest_type IS DISTINCT FROM 'dual_rewards' THEN
    RETURN 0;
  END IF;

  IF p_details IS NULL THEN
    p_details := '{}'::jsonb;
  END IF;

  v_root := NULLIF((p_details->>'total_budget_cents')::bigint, NULL);
  IF v_root IS NOT NULL AND v_root > 0 THEN
    RETURN v_root;
  END IF;

  v_ms := COALESCE((p_details->'milestone_contest'->>'total_budget_cents')::bigint, 0);
  v_cpm := COALESCE((p_details->'cpm_contest'->>'total_budget')::bigint, 0);
  IF v_ms > 0 AND v_cpm > 0 THEN
    RETURN GREATEST(v_ms, v_cpm);
  END IF;
  IF v_ms > 0 THEN
    RETURN v_ms;
  END IF;
  IF v_cpm > 0 THEN
    RETURN v_cpm;
  END IF;

  IF p_total_budget IS NOT NULL AND p_total_budget > 0 THEN
    RETURN p_total_budget;
  END IF;

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.dual_rewards_assert_pool_budget(
  p_contest_id uuid,
  p_target_submission_id uuid,
  p_target_cpm_cents bigint,
  p_target_milestone_cents bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest record;
  v_pool_budget bigint;
  v_projected bigint := 0;
  v_row record;
  v_cpm bigint;
  v_ms bigint;
  v_paid record;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('dual_rewards_pool'),
    hashtext(p_contest_id::text)
  );

  SELECT
    c.id,
    c.contest_type::text AS contest_type,
    c.contest_based_details,
    c.total_budget
  INTO v_contest
  FROM public.contests c
  WHERE c.id = p_contest_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Contest not found',
      'pool_budget_cents', 0,
      'projected_spent_cents', 0,
      'remaining_cents', 0
    );
  END IF;

  IF v_contest.contest_type IS DISTINCT FROM 'dual_rewards' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Contest is not dual_rewards',
      'pool_budget_cents', 0,
      'projected_spent_cents', 0,
      'remaining_cents', 0
    );
  END IF;

  v_pool_budget := public.dual_rewards_pool_budget_cents_from_contest(
    v_contest.contest_type,
    v_contest.contest_based_details,
    v_contest.total_budget
  );

  IF v_pool_budget <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Contest prize pool is not configured',
      'pool_budget_cents', 0,
      'projected_spent_cents', 0,
      'remaining_cents', 0
    );
  END IF;

  FOR v_row IN
    SELECT
      s.id,
      s.earnings,
      s.paid,
      s.bonus_amount,
      s.bonus_paid,
      s.dual_rewards_payout
    FROM public.submissions s
    WHERE s.contest_id = p_contest_id
  LOOP
    IF v_row.id = p_target_submission_id THEN
      v_cpm := GREATEST(0, COALESCE(p_target_cpm_cents, 0));
      v_ms := GREATEST(0, COALESCE(p_target_milestone_cents, 0));
    ELSE
      SELECT * INTO v_paid
      FROM public.dual_rewards_submission_paid_cents(
        v_row.earnings,
        v_row.paid,
        v_row.bonus_amount,
        v_row.bonus_paid,
        v_row.dual_rewards_payout
      );
      v_cpm := v_paid.cpm_cents;
      v_ms := v_paid.milestone_cents;
    END IF;

    v_projected := v_projected + v_cpm + v_ms;
  END LOOP;

  IF v_projected > v_pool_budget THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Contest prize pool budget would be exceeded',
      'pool_budget_cents', v_pool_budget,
      'projected_spent_cents', v_projected,
      'remaining_cents', GREATEST(0, v_pool_budget - v_projected)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'pool_budget_cents', v_pool_budget,
    'projected_spent_cents', v_projected,
    'remaining_cents', GREATEST(0, v_pool_budget - v_projected)
  );
END;
$$;

COMMENT ON FUNCTION public.dual_rewards_assert_pool_budget IS
  'Locks contest pool, sums paid CPM+milestone cents, rejects if projected spend exceeds configured pool.';

GRANT EXECUTE ON FUNCTION public.dual_rewards_assert_pool_budget TO service_role;
