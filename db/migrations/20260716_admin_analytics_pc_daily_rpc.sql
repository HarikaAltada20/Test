-- Admin analytics: daily post-campaign overlay metrics by status.
-- Same columns as admin_analytics_daily so Node can reuse one aggregator.
--
-- DEPLOY ORDER: run after 20260715_post_campaign_submission_metrics.sql,
-- before 20260717_post_campaign_security_fixes.sql.

CREATE OR REPLACE FUNCTION public.admin_analytics_pc_daily(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  day_key date,
  status text,
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
  WITH scoped AS (
    SELECT
      (pcs.created_at AT TIME ZONE 'UTC')::date AS day_key,
      CASE
        WHEN lower(COALESCE(pcs.status::text, '')) = 'approved' THEN 'verified'
        WHEN lower(COALESCE(pcs.status::text, '')) IN (
          'pending', 'verified', 'paid', 'rejected'
        ) THEN lower(pcs.status::text)
        ELSE 'unknown'
      END AS status,
      public.admin_analytics_normalize_platform(
        COALESCE(pcs.platform, c.platform),
        c.contest_based_details
      ) AS platform,
      public.admin_analytics_submission_views(
        COALESCE(pcs.views, 0)::bigint,
        public.admin_analytics_normalize_platform(
          COALESCE(pcs.platform, c.platform),
          c.contest_based_details
        ),
        COALESCE(pcs.other_stats, '{}'::jsonb)
      ) AS views,
      public.admin_analytics_json_stat(
        COALESCE(pcs.other_stats, '{}'::jsonb),
        public.admin_analytics_normalize_platform(
          COALESCE(pcs.platform, c.platform),
          c.contest_based_details
        ),
        ARRAY['likes', 'like_count']
      ) AS likes,
      public.admin_analytics_json_stat(
        COALESCE(pcs.other_stats, '{}'::jsonb),
        public.admin_analytics_normalize_platform(
          COALESCE(pcs.platform, c.platform),
          c.contest_based_details
        ),
        ARRAY['comments', 'comment_count', 'replies']
      ) AS comments,
      public.admin_analytics_json_stat(
        COALESCE(pcs.other_stats, '{}'::jsonb),
        public.admin_analytics_normalize_platform(
          COALESCE(pcs.platform, c.platform),
          c.contest_based_details
        ),
        ARRAY['shares', 'share_count', 'retweets']
      ) AS shares,
      CASE
        WHEN lower(COALESCE(pcs.status::text, '')) = 'paid'
          OR COALESCE(pcs.earnings, 0) > 0
        THEN (COALESCE(pcs.earnings, 0) + COALESCE(pcs.bonus_amount, 0))::bigint
        ELSE 0::bigint
      END AS payouts_cents
    FROM public.post_campaign_submission_metrics pcs
    LEFT JOIN public.contests c ON c.id = pcs.contest_id
    WHERE p_contest_ids IS NOT NULL
      AND cardinality(p_contest_ids) > 0
      AND pcs.contest_id = ANY (p_contest_ids)
      AND pcs.created_at >= p_from
      AND pcs.created_at <= p_to
  )
  SELECT
    scoped.day_key,
    scoped.status,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(scoped.views), 0)::bigint AS views_sum,
    COALESCE(SUM(scoped.likes), 0)::bigint AS likes_sum,
    COALESCE(SUM(scoped.comments), 0)::bigint AS comments_sum,
    COALESCE(SUM(scoped.shares), 0)::bigint AS shares_sum,
    COALESCE(SUM(scoped.payouts_cents), 0)::bigint AS payouts_cents_sum
  FROM scoped
  WHERE scoped.platform IN ('youtube', 'tiktok', 'instagram')
     OR scoped.platform = 'unknown'
  GROUP BY 1, 2;
$$;

COMMENT ON FUNCTION public.admin_analytics_pc_daily(timestamptz, timestamptz, uuid[]) IS
  'Daily post-campaign overlay metric rollups for admin analytics (views/likes/comments/shares/payouts by status). day_key uses pcs.created_at (submission date), not refresh time — intentional for trend charts.';

REVOKE ALL ON FUNCTION public.admin_analytics_pc_daily(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_analytics_pc_daily(timestamptz, timestamptz, uuid[]) TO service_role;

-- Distinct contest IDs that have post-campaign overlay rows in range.
CREATE OR REPLACE FUNCTION public.admin_analytics_pc_contest_ids(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (contest_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT pcs.contest_id
  FROM public.post_campaign_submission_metrics pcs
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND pcs.contest_id = ANY (p_contest_ids)
    AND pcs.created_at >= p_from
    AND pcs.created_at <= p_to;
$$;

COMMENT ON FUNCTION public.admin_analytics_pc_contest_ids(timestamptz, timestamptz, uuid[]) IS
  'Contest IDs with post-campaign overlay rows in the given date range (admin analytics).';

REVOKE ALL ON FUNCTION public.admin_analytics_pc_contest_ids(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_analytics_pc_contest_ids(timestamptz, timestamptz, uuid[]) TO service_role;
