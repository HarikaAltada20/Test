-- Align dual_rewards_submission_paid_cents with TS: per-field JSON with legacy fallback.

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
