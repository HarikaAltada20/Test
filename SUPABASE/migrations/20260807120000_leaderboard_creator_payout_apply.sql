-- Atomically apply non-Twitter leaderboard creator prize earnings + sibling mark-paid.
-- Serializes concurrent pays for the same (contest, creator) via advisory xact lock so
-- only one request can write prize earnings even when wallet idempotency already deduped.
-- REQUIRED in production: app code fails closed if this function is missing (no fallback).
--
-- Sibling mark-paid runs ONLY when remaining prize is 0 (avoids "paid with $0" lock-in).
-- Marked siblings get earnings = 0 so stale projections cannot inflate already-paid sums.

CREATE OR REPLACE FUNCTION public.apply_non_twitter_leaderboard_creator_payout(
  p_contest_id uuid,
  p_creator_id uuid,
  p_prize_cents bigint,
  p_earnings_submission_id uuid DEFAULT NULL,
  p_earnings_cents bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid bigint := 0;
  v_remaining bigint := 0;
  v_apply bigint := 0;
  v_marked int := 0;
  v_now timestamptz := NOW();
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('leaderboard_creator_prize'),
    hashtext(p_contest_id::text || ':' || p_creator_id::text)
  );

  SELECT COALESCE(SUM(GREATEST(COALESCE(earnings, 0), 0)), 0)::bigint
  INTO v_paid
  FROM submissions
  WHERE contest_id = p_contest_id
    AND creator_id = p_creator_id
    AND paid IS TRUE;

  v_remaining := GREATEST(0, COALESCE(p_prize_cents, 0) - v_paid);

  IF p_earnings_submission_id IS NOT NULL
     AND COALESCE(p_earnings_cents, 0) > 0
     AND v_remaining > 0 THEN
    v_apply := LEAST(v_remaining, COALESCE(p_earnings_cents, 0));

    UPDATE submissions
    SET
      earnings = v_apply,
      paid = TRUE,
      status = 'paid',
      paid_at = v_now
    WHERE id = p_earnings_submission_id
      AND contest_id = p_contest_id
      AND creator_id = p_creator_id
      AND COALESCE(paid, FALSE) IS NOT TRUE
      AND LOWER(COALESCE(status, '')) IN ('verified', 'approved');

    IF FOUND THEN
      v_paid := v_paid + v_apply;
      v_remaining := GREATEST(0, COALESCE(p_prize_cents, 0) - v_paid);
    ELSE
      v_apply := 0;
    END IF;
  END IF;

  -- Only mark siblings when the creator prize is fully covered. Otherwise a missed
  -- earnings UPDATE + mark-all would lock the creator as paid with $0 remaining prize.
  IF v_remaining = 0 THEN
    WITH updated AS (
      UPDATE submissions
      SET
        earnings = 0,
        paid = TRUE,
        status = 'paid',
        paid_at = v_now
      WHERE contest_id = p_contest_id
        AND creator_id = p_creator_id
        AND LOWER(COALESCE(status, '')) IN ('verified', 'approved')
        AND COALESCE(paid, FALSE) IS NOT TRUE
      RETURNING id
    )
    SELECT COUNT(*)::int INTO v_marked FROM updated;
  END IF;

  RETURN jsonb_build_object(
    'already_paid_cents', v_paid,
    'remaining_cents', v_remaining,
    'applied_earnings_cents', v_apply,
    'marked_paid_count', v_marked,
    'ok', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_non_twitter_leaderboard_creator_payout(uuid, uuid, bigint, uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_non_twitter_leaderboard_creator_payout(uuid, uuid, bigint, uuid, bigint) TO service_role;
