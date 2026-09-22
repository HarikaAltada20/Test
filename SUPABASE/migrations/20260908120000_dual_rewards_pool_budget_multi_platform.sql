-- Multi-platform dual_rewards contests copy the shared prize pool under
-- youtube|instagram|tiktok instead of root total_budget_cents. The previous
-- helper only inspected root fields, so bulk pay failed with
-- "Contest prize pool is not configured". Do not sum platform copies.
--
-- Deploy before dual-rewards payouts on multi-platform contests. App code
-- refuses unlocked in-app pool commits when this helper is stale.

CREATE OR REPLACE FUNCTION public.dual_rewards_pool_budget_cents_from_contest(
  p_contest_type text,
  p_details jsonb
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_details jsonb;
  v_root bigint;
  v_ms bigint;
  v_cpm bigint;
  v_platform text;
  v_plat jsonb;
BEGIN
  IF p_contest_type IS DISTINCT FROM 'dual_rewards' THEN
    RETURN 0;
  END IF;

  v_details := COALESCE(p_details, '{}'::jsonb);

  v_root := NULLIF((v_details->>'total_budget_cents')::bigint, NULL);
  IF v_root IS NOT NULL AND v_root > 0 THEN
    RETURN v_root;
  END IF;

  v_ms := COALESCE((v_details->'milestone_contest'->>'total_budget_cents')::bigint, 0);
  v_cpm := COALESCE((v_details->'cpm_contest'->>'total_budget')::bigint, 0);
  IF v_ms > 0 AND v_cpm > 0 THEN
    RETURN GREATEST(v_ms, v_cpm);
  END IF;
  IF v_ms > 0 THEN
    RETURN v_ms;
  END IF;
  IF v_cpm > 0 THEN
    RETURN v_cpm;
  END IF;

  FOREACH v_platform IN ARRAY ARRAY['youtube', 'instagram', 'tiktok']
  LOOP
    v_plat := v_details->v_platform;
    IF v_plat IS NULL OR jsonb_typeof(v_plat) <> 'object' THEN
      CONTINUE;
    END IF;

    v_root := NULLIF((v_plat->>'total_budget_cents')::bigint, NULL);
    IF v_root IS NOT NULL AND v_root > 0 THEN
      RETURN v_root;
    END IF;

    v_ms := COALESCE((v_plat->'milestone_contest'->>'total_budget_cents')::bigint, 0);
    v_cpm := COALESCE((v_plat->'cpm_contest'->>'total_budget')::bigint, 0);
    IF v_ms > 0 AND v_cpm > 0 THEN
      RETURN GREATEST(v_ms, v_cpm);
    END IF;
    IF v_ms > 0 THEN
      RETURN v_ms;
    END IF;
    IF v_cpm > 0 THEN
      RETURN v_cpm;
    END IF;
  END LOOP;

  RETURN 0;
END;
$$;
