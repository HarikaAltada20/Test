-- Atomically reserve pool spend by persisting dual_rewards_payout under the contest advisory lock.
-- Prevents concurrent admin payouts from both passing a check-then-pay race.

-- Replace 4-arg assert from 20260521120000; CREATE OR REPLACE alone would add a second overload.
DROP FUNCTION IF EXISTS public.dual_rewards_assert_pool_budget(uuid, uuid, bigint, bigint);
DROP FUNCTION IF EXISTS public.dual_rewards_assert_pool_budget(uuid, uuid, bigint, bigint, boolean);
DROP FUNCTION IF EXISTS public.dual_rewards_pool_budget_cents_from_contest(text, jsonb, bigint);

CREATE OR REPLACE FUNCTION public.dual_rewards_assert_pool_budget(
  p_contest_id uuid,
  p_target_submission_id uuid,
  p_target_cpm_cents bigint,
  p_target_milestone_cents bigint,
  p_commit boolean DEFAULT false
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
  v_previous jsonb;
  v_new_payout jsonb;
  v_target_cpm bigint;
  v_target_ms bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('dual_rewards_pool'),
    hashtext(p_contest_id::text)
  );

  SELECT
    c.id,
    c.contest_type::text AS contest_type,
    c.contest_based_details
  INTO v_contest
  FROM public.contests c
  WHERE c.id = p_contest_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Contest not found',
      'pool_budget_cents', 0,
      'projected_spent_cents', 0,
      'remaining_cents', 0,
      'committed', false
    );
  END IF;

  IF v_contest.contest_type IS DISTINCT FROM 'dual_rewards' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Contest is not dual_rewards',
      'pool_budget_cents', 0,
      'projected_spent_cents', 0,
      'remaining_cents', 0,
      'committed', false
    );
  END IF;

  v_pool_budget := public.dual_rewards_pool_budget_cents_from_contest(
    v_contest.contest_type,
    v_contest.contest_based_details
  );

  IF v_pool_budget <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Contest prize pool is not configured',
      'pool_budget_cents', 0,
      'projected_spent_cents', 0,
      'remaining_cents', 0,
      'committed', false
    );
  END IF;

  v_target_cpm := GREATEST(0, COALESCE(p_target_cpm_cents, 0));
  v_target_ms := GREATEST(0, COALESCE(p_target_milestone_cents, 0));

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
      v_cpm := v_target_cpm;
      v_ms := v_target_ms;
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
      'remaining_cents', GREATEST(0, v_pool_budget - v_projected),
      'committed', false
    );
  END IF;

  IF COALESCE(p_commit, false) THEN
    SELECT s.dual_rewards_payout
    INTO v_previous
    FROM public.submissions s
    WHERE s.id = p_target_submission_id
      AND s.contest_id = p_contest_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'error', 'Target submission not found for this contest',
        'pool_budget_cents', v_pool_budget,
        'projected_spent_cents', v_projected,
        'remaining_cents', GREATEST(0, v_pool_budget - v_projected),
        'committed', false
      );
    END IF;

    v_new_payout := COALESCE(v_previous, '{}'::jsonb);
    IF jsonb_typeof(v_new_payout) IS DISTINCT FROM 'object' THEN
      v_new_payout := '{}'::jsonb;
    END IF;

    v_new_payout :=
      v_new_payout
      || jsonb_build_object(
        'cpm_cents', v_target_cpm,
        'milestone_cents', v_target_ms
      );

    UPDATE public.submissions
    SET dual_rewards_payout = v_new_payout
    WHERE id = p_target_submission_id
      AND contest_id = p_contest_id;

    RETURN jsonb_build_object(
      'allowed', true,
      'pool_budget_cents', v_pool_budget,
      'projected_spent_cents', v_projected,
      'remaining_cents', GREATEST(0, v_pool_budget - v_projected),
      'committed', true,
      'previous_dual_rewards_payout', v_previous
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'pool_budget_cents', v_pool_budget,
    'projected_spent_cents', v_projected,
    'remaining_cents', GREATEST(0, v_pool_budget - v_projected),
    'committed', false
  );
END;
$$;

COMMENT ON FUNCTION public.dual_rewards_assert_pool_budget(uuid, uuid, bigint, bigint, boolean) IS
  'Locks contest pool, validates projected CPM+milestone spend; optional p_commit persists dual_rewards_payout on the target row in the same transaction.';

GRANT EXECUTE ON FUNCTION public.dual_rewards_assert_pool_budget(uuid, uuid, bigint, bigint, boolean) TO service_role;
