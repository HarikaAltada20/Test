-- Roll back 20260728_brand_analytics_engagement_rollups.sql.
--
-- Removes reach/saved rollup storage and restores the previous
-- per-contest RPC return shape. Source submission metrics are unchanged.

BEGIN;

SELECT pg_advisory_xact_lock(71026, 1);

DROP TRIGGER IF EXISTS trg_admin_analytics_engagement_submissions
  ON public.submissions;
DROP TRIGGER IF EXISTS trg_admin_analytics_engagement_pc
  ON public.post_campaign_submission_metrics;

DROP FUNCTION IF EXISTS public.admin_analytics_engagement_rollup_trigger();
DROP FUNCTION IF EXISTS public.admin_analytics_compute_engagement_metrics(
  text, text, jsonb, jsonb
);

DROP FUNCTION IF EXISTS public.brand_analytics_contest_rollup(
  timestamptz, timestamptz, uuid[]
);
CREATE FUNCTION public.brand_analytics_contest_rollup(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  contest_id uuid,
  status text,
  platform text,
  submission_count bigint,
  views_sum bigint,
  likes_sum bigint,
  comments_sum bigint,
  shares_sum bigint,
  payouts_cents_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.contest_id,
    r.status,
    r.platform,
    SUM(r.submission_count)::bigint,
    COALESCE(SUM(r.views_sum), 0)::bigint,
    COALESCE(SUM(r.likes_sum), 0)::bigint,
    COALESCE(SUM(r.comments_sum), 0)::bigint,
    COALESCE(SUM(r.shares_sum), 0)::bigint,
    COALESCE(SUM(r.payouts_cents_sum), 0)::bigint
  FROM public.admin_analytics_submission_daily_rollup r
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND r.contest_id = ANY (p_contest_ids)
    AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
    AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
    AND public.admin_analytics_submission_row_in_scope(r.platform)
  GROUP BY r.contest_id, r.status, r.platform
  ORDER BY r.contest_id, r.status, r.platform;
$$;

DROP FUNCTION IF EXISTS public.brand_analytics_pc_contest_rollup(
  timestamptz, timestamptz, uuid[]
);
CREATE FUNCTION public.brand_analytics_pc_contest_rollup(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  contest_id uuid,
  status text,
  platform text,
  submission_count bigint,
  views_sum bigint,
  likes_sum bigint,
  comments_sum bigint,
  shares_sum bigint,
  payouts_cents_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.contest_id,
    r.status,
    r.platform,
    SUM(r.submission_count)::bigint,
    COALESCE(SUM(r.views_sum), 0)::bigint,
    COALESCE(SUM(r.likes_sum), 0)::bigint,
    COALESCE(SUM(r.comments_sum), 0)::bigint,
    COALESCE(SUM(r.shares_sum), 0)::bigint,
    COALESCE(SUM(r.payouts_cents_sum), 0)::bigint
  FROM public.admin_analytics_pc_daily_rollup r
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND r.contest_id = ANY (p_contest_ids)
    AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
    AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
    AND public.admin_analytics_pc_row_in_scope(r.platform)
  GROUP BY r.contest_id, r.status, r.platform
  ORDER BY r.contest_id, r.status, r.platform;
$$;

ALTER TABLE public.admin_analytics_submission_daily_rollup
  DROP CONSTRAINT IF EXISTS
    admin_analytics_submission_daily_rollup_engagement_nonneg,
  DROP COLUMN IF EXISTS reach_sum,
  DROP COLUMN IF EXISTS saved_sum;

ALTER TABLE public.admin_analytics_pc_daily_rollup
  DROP CONSTRAINT IF EXISTS admin_analytics_pc_daily_rollup_engagement_nonneg,
  DROP COLUMN IF EXISTS reach_sum,
  DROP COLUMN IF EXISTS saved_sum;

REVOKE ALL ON FUNCTION public.brand_analytics_contest_rollup(
  timestamptz, timestamptz, uuid[]
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.brand_analytics_pc_contest_rollup(
  timestamptz, timestamptz, uuid[]
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.brand_analytics_contest_rollup(
  timestamptz, timestamptz, uuid[]
) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_pc_contest_rollup(
  timestamptz, timestamptz, uuid[]
) TO service_role;

COMMIT;
