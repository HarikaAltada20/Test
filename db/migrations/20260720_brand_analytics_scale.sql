-- Brand analytics: DB-side aggregates for advertiser dashboards at 10M+ submissions.
-- Reuses admin_analytics_submission_daily_rollup / admin_analytics_pc_daily_rollup when present.
-- Twitter paths aggregate twitter_campaign_tweets in SQL (no row streaming to Node).

-- ---------------------------------------------------------------------------
-- Per-contest rollups (submissions)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.brand_analytics_contest_rollup(
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
    SUM(r.submission_count)::bigint AS submission_count,
    COALESCE(SUM(r.views_sum), 0)::bigint AS views_sum,
    COALESCE(SUM(r.likes_sum), 0)::bigint AS likes_sum,
    COALESCE(SUM(r.comments_sum), 0)::bigint AS comments_sum,
    COALESCE(SUM(r.shares_sum), 0)::bigint AS shares_sum,
    COALESCE(SUM(r.payouts_cents_sum), 0)::bigint AS payouts_cents_sum
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

-- ---------------------------------------------------------------------------
-- Per-contest rollups (PC overlay)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.brand_analytics_pc_contest_rollup(
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
    SUM(r.submission_count)::bigint AS submission_count,
    COALESCE(SUM(r.views_sum), 0)::bigint AS views_sum,
    COALESCE(SUM(r.likes_sum), 0)::bigint AS likes_sum,
    COALESCE(SUM(r.comments_sum), 0)::bigint AS comments_sum,
    COALESCE(SUM(r.shares_sum), 0)::bigint AS shares_sum,
    COALESCE(SUM(r.payouts_cents_sum), 0)::bigint AS payouts_cents_sum
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

-- ---------------------------------------------------------------------------
-- Twitter: daily + per-contest + per-creator (live aggregate; volume is lower)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.brand_analytics_twitter_daily(
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
  quote_reposts_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (t.tweet_created_at AT TIME ZONE 'UTC')::date AS day_key,
    public.admin_analytics_normalize_status(t.moderation_status::text) AS status,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(COALESCE(t.impressions, 0)), 0)::bigint AS views_sum,
    COALESCE(SUM(COALESCE(t.likes, 0)), 0)::bigint AS likes_sum,
    COALESCE(SUM(COALESCE(t.replies, 0)), 0)::bigint AS comments_sum,
    COALESCE(SUM(COALESCE(t.retweets, 0)), 0)::bigint AS shares_sum,
    COALESCE(SUM(COALESCE(t.quote_reposts, 0)), 0)::bigint AS quote_reposts_sum
  FROM public.twitter_campaign_tweets t
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND t.contest_id = ANY (p_contest_ids)
    AND t.tweet_created_at >= p_from
    AND t.tweet_created_at <= p_to
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

CREATE OR REPLACE FUNCTION public.brand_analytics_twitter_contest_rollup(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  contest_id uuid,
  status text,
  submission_count bigint,
  views_sum bigint,
  likes_sum bigint,
  comments_sum bigint,
  shares_sum bigint,
  quote_reposts_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.contest_id,
    public.admin_analytics_normalize_status(t.moderation_status::text) AS status,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(COALESCE(t.impressions, 0)), 0)::bigint AS views_sum,
    COALESCE(SUM(COALESCE(t.likes, 0)), 0)::bigint AS likes_sum,
    COALESCE(SUM(COALESCE(t.replies, 0)), 0)::bigint AS comments_sum,
    COALESCE(SUM(COALESCE(t.retweets, 0)), 0)::bigint AS shares_sum,
    COALESCE(SUM(COALESCE(t.quote_reposts, 0)), 0)::bigint AS quote_reposts_sum
  FROM public.twitter_campaign_tweets t
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND t.contest_id = ANY (p_contest_ids)
    AND t.tweet_created_at >= p_from
    AND t.tweet_created_at <= p_to
  GROUP BY t.contest_id, 2
  ORDER BY t.contest_id, 2;
$$;

CREATE OR REPLACE FUNCTION public.brand_analytics_twitter_creator_rollup(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  creator_id uuid,
  contest_type text,
  status text,
  submission_count bigint,
  views_sum bigint,
  earnings_cents_sum bigint,
  first_created_at timestamptz,
  last_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.creator_id,
    c.contest_type::text AS contest_type,
    public.admin_analytics_normalize_status(t.moderation_status::text) AS status,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(COALESCE(t.impressions, 0)), 0)::bigint AS views_sum,
    0::bigint AS earnings_cents_sum,
    MIN(t.tweet_created_at) AS first_created_at,
    MAX(t.tweet_created_at) AS last_created_at
  FROM public.twitter_campaign_tweets t
  INNER JOIN public.contests c ON c.id = t.contest_id
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND t.contest_id = ANY (p_contest_ids)
    AND t.tweet_created_at >= p_from
    AND t.tweet_created_at <= p_to
    AND t.creator_id IS NOT NULL
  GROUP BY t.creator_id, c.contest_type, 3;
$$;

-- ---------------------------------------------------------------------------
-- Video submissions: per-creator rollup (one SQL pass; returns ~creators rows)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.brand_analytics_by_creator(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  creator_id uuid,
  contest_type text,
  platform text,
  status text,
  submission_count bigint,
  views_sum bigint,
  earnings_cents_sum bigint,
  first_created_at timestamptz,
  last_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.creator_id,
    c.contest_type::text AS contest_type,
    public.admin_analytics_normalize_platform(
      COALESCE(s.platform, c.platform),
      c.contest_based_details
    ) AS platform,
    public.admin_analytics_normalize_status(s.status::text) AS status,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(
      public.admin_analytics_submission_views(
        COALESCE(s.views, 0)::bigint,
        public.admin_analytics_normalize_platform(
          COALESCE(s.platform, c.platform),
          c.contest_based_details
        ),
        COALESCE(s.other_stats, '{}'::jsonb)
      )
    ), 0)::bigint AS views_sum,
    COALESCE(SUM(
      CASE
        WHEN lower(COALESCE(s.status::text, '')) = 'paid'
          OR COALESCE(s.earnings, 0) > 0
        THEN (COALESCE(s.earnings, 0) + COALESCE(s.bonus_amount, 0))::bigint
        ELSE 0::bigint
      END
    ), 0)::bigint AS earnings_cents_sum,
    MIN(s.created_at) AS first_created_at,
    MAX(s.created_at) AS last_created_at
  FROM public.submissions s
  INNER JOIN public.contests c ON c.id = s.contest_id
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND s.contest_id = ANY (p_contest_ids)
    AND s.created_at >= p_from
    AND s.created_at <= p_to
    AND s.creator_id IS NOT NULL
    AND public.admin_analytics_submission_row_in_scope(
      public.admin_analytics_normalize_platform(
        COALESCE(s.platform, c.platform),
        c.contest_based_details
      )
    )
  GROUP BY s.creator_id, c.contest_type, 3, 4;
$$;

CREATE INDEX IF NOT EXISTS idx_twitter_campaign_tweets_contest_created
  ON public.twitter_campaign_tweets (contest_id, tweet_created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_brand_creator_agg
  ON public.submissions (contest_id, created_at)
  INCLUDE (creator_id, status, views, earnings, bonus_amount, platform);

-- PC overlay: per-creator rollup
CREATE OR REPLACE FUNCTION public.brand_analytics_pc_by_creator(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  creator_id uuid,
  contest_type text,
  platform text,
  status text,
  submission_count bigint,
  views_sum bigint,
  earnings_cents_sum bigint,
  first_created_at timestamptz,
  last_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pcs.creator_id,
    c.contest_type::text AS contest_type,
    public.admin_analytics_normalize_platform(
      COALESCE(pcs.platform, c.platform),
      c.contest_based_details
    ) AS platform,
    public.admin_analytics_normalize_status(pcs.status::text) AS status,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(
      public.admin_analytics_submission_views(
        COALESCE(pcs.views, 0)::bigint,
        public.admin_analytics_normalize_platform(
          COALESCE(pcs.platform, c.platform),
          c.contest_based_details
        ),
        COALESCE(pcs.other_stats, '{}'::jsonb)
      )
    ), 0)::bigint AS views_sum,
    COALESCE(SUM(
      CASE
        WHEN lower(COALESCE(pcs.status::text, '')) = 'paid'
          OR COALESCE(pcs.earnings, 0) > 0
        THEN (COALESCE(pcs.earnings, 0) + COALESCE(pcs.bonus_amount, 0))::bigint
        ELSE 0::bigint
      END
    ), 0)::bigint AS earnings_cents_sum,
    MIN(pcs.created_at) AS first_created_at,
    MAX(pcs.created_at) AS last_created_at
  FROM public.post_campaign_submission_metrics pcs
  INNER JOIN public.contests c ON c.id = pcs.contest_id
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND pcs.contest_id = ANY (p_contest_ids)
    AND pcs.created_at >= p_from
    AND pcs.created_at <= p_to
    AND pcs.creator_id IS NOT NULL
    AND public.admin_analytics_pc_row_in_scope(
      public.admin_analytics_normalize_platform(
        COALESCE(pcs.platform, c.platform),
        c.contest_based_details
      )
    )
  GROUP BY pcs.creator_id, c.contest_type, 3, 4;
$$;

-- Top submissions for one creator (leaderboard detail panel)
CREATE OR REPLACE FUNCTION public.brand_analytics_creator_top_submissions(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[],
  p_creator_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  views bigint,
  created_at timestamptz,
  platform text,
  status text,
  earnings bigint,
  contest_id uuid,
  contest_title text,
  contest_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    public.admin_analytics_submission_views(
      COALESCE(s.views, 0)::bigint,
      public.admin_analytics_normalize_platform(
        COALESCE(s.platform, c.platform),
        c.contest_based_details
      ),
      COALESCE(s.other_stats, '{}'::jsonb)
    ) AS views,
    s.created_at,
    COALESCE(s.platform, c.platform)::text AS platform,
    s.status::text,
    COALESCE(s.earnings, 0)::bigint AS earnings,
    s.contest_id,
    c.title AS contest_title,
    c.contest_type::text AS contest_type
  FROM public.submissions s
  INNER JOIN public.contests c ON c.id = s.contest_id
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND s.contest_id = ANY (p_contest_ids)
    AND s.creator_id = p_creator_id
    AND s.created_at >= p_from
    AND s.created_at <= p_to
  ORDER BY views DESC NULLS LAST, s.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
$$;

COMMENT ON FUNCTION public.brand_analytics_contest_rollup(timestamptz, timestamptz, uuid[]) IS
  'Per-contest submission metric rollups for brand analytics (reads admin_analytics_submission_daily_rollup).';

REVOKE ALL ON FUNCTION public.brand_analytics_creator_top_submissions(timestamptz, timestamptz, uuid[], uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.brand_analytics_pc_by_creator(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.brand_analytics_contest_rollup(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.brand_analytics_pc_contest_rollup(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.brand_analytics_twitter_daily(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.brand_analytics_twitter_contest_rollup(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.brand_analytics_twitter_creator_rollup(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.brand_analytics_by_creator(timestamptz, timestamptz, uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.brand_analytics_creator_top_submissions(timestamptz, timestamptz, uuid[], uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_pc_by_creator(timestamptz, timestamptz, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_contest_rollup(timestamptz, timestamptz, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_pc_contest_rollup(timestamptz, timestamptz, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_twitter_daily(timestamptz, timestamptz, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_twitter_contest_rollup(timestamptz, timestamptz, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_twitter_creator_rollup(timestamptz, timestamptz, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_by_creator(timestamptz, timestamptz, uuid[]) TO service_role;
