-- PC admin analytics scale: index + single-scan overview RPC.
--
-- DEPLOY ORDER: run after 20260717_post_campaign_security_fixes.sql.
-- On large prod tables, prefer CREATE INDEX CONCURRENTLY outside a
-- transaction during a maintenance window (see comment on index below).

-- Supports contest-scoped date-range scans used by admin_analytics_pc_*.
-- Mirrors idx_submissions_admin_analytics_contest_created on submissions.
CREATE INDEX IF NOT EXISTS idx_pc_metrics_contest_created
  ON public.post_campaign_submission_metrics (contest_id, created_at)
  INCLUDE (status, views, earnings, bonus_amount, platform);

-- One filtered pass: daily rollups + distinct contest IDs for the PC tab.
CREATE OR REPLACE FUNCTION public.admin_analytics_pc_overview(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS MATERIALIZED (
    SELECT
      pcs.contest_id,
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
  ),
  daily AS (
    SELECT
      scoped.contest_id,
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
    GROUP BY 1, 2, 3
  ),
  contest_ids AS (
    SELECT DISTINCT scoped.contest_id
    FROM scoped
  )
  SELECT jsonb_build_object(
    'daily',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'contest_id', d.contest_id,
            'day_key', d.day_key,
            'status', d.status,
            'submission_count', d.submission_count,
            'views_sum', d.views_sum,
            'likes_sum', d.likes_sum,
            'comments_sum', d.comments_sum,
            'shares_sum', d.shares_sum,
            'payouts_cents_sum', d.payouts_cents_sum
          )
          ORDER BY d.contest_id, d.day_key, d.status
        )
        FROM daily d
      ),
      '[]'::jsonb
    ),
    'contest_ids',
    COALESCE(
      (
        SELECT jsonb_agg(c.contest_id ORDER BY c.contest_id)
        FROM contest_ids c
      ),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION public.admin_analytics_pc_overview(timestamptz, timestamptz, uuid[]) IS
  'Single-scan PC admin analytics: daily rollups + contest IDs with overlay rows in range.';

REVOKE ALL ON FUNCTION public.admin_analytics_pc_overview(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_pc_overview(timestamptz, timestamptz, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_pc_overview(timestamptz, timestamptz, uuid[]) TO service_role;
