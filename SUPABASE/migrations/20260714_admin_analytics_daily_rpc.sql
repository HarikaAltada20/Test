-- Admin analytics: aggregate submission metrics in Postgres by day/status
-- instead of loading every submission (+ other_stats) into Node.

CREATE OR REPLACE FUNCTION public.admin_analytics_json_stat(
  p_stats jsonb,
  p_platform text,
  p_keys text[]
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  nested jsonb;
  key text;
  v numeric;
BEGIN
  IF p_stats IS NULL OR p_keys IS NULL OR cardinality(p_keys) = 0 THEN
    RETURN 0;
  END IF;

  nested := COALESCE(p_stats -> p_platform, p_stats);

  FOREACH key IN ARRAY p_keys LOOP
    BEGIN
      v := NULLIF(nested ->> key, '')::numeric;
    EXCEPTION WHEN others THEN
      v := NULL;
    END;
    IF v IS NOT NULL AND v > 0 THEN
      RETURN GREATEST(0, trunc(v))::bigint;
    END IF;
  END LOOP;

  FOREACH key IN ARRAY p_keys LOOP
    BEGIN
      v := NULLIF(p_stats ->> key, '')::numeric;
    EXCEPTION WHEN others THEN
      v := NULL;
    END;
    IF v IS NOT NULL AND v > 0 THEN
      RETURN GREATEST(0, trunc(v))::bigint;
    END IF;
  END LOOP;

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_normalize_platform(
  p_platform text,
  p_contest_based_details jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(COALESCE(p_platform, '')) IN ('x', 'twitter') THEN 'twitter'
    WHEN lower(COALESCE(p_platform, '')) IN ('tiktok', 'tik_tok', 'tik-tok') THEN 'tiktok'
    WHEN lower(COALESCE(p_platform, '')) IN ('youtube', 'instagram') THEN lower(p_platform)
    WHEN p_contest_based_details ? 'twitter_campaign' THEN 'twitter'
    ELSE 'unknown'
  END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_submission_views(
  p_views bigint,
  p_platform text,
  p_stats jsonb
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  platform text := lower(COALESCE(p_platform, ''));
  direct bigint := GREATEST(COALESCE(p_views, 0), 0);
  from_stats bigint;
  reach bigint;
BEGIN
  IF platform = 'instagram' THEN
    from_stats := public.admin_analytics_json_stat(
      p_stats, 'instagram', ARRAY['views', 'view_count']
    );
    reach := public.admin_analytics_json_stat(
      p_stats, 'instagram', ARRAY['reach']
    );
    IF GREATEST(direct, from_stats) = 0 AND reach > 0 THEN
      RETURN reach;
    END IF;
    RETURN GREATEST(direct, from_stats);
  ELSIF platform = 'tiktok' THEN
    from_stats := public.admin_analytics_json_stat(
      p_stats, 'tiktok', ARRAY['view_count', 'views']
    );
    IF from_stats > 0 THEN
      RETURN from_stats;
    END IF;
    RETURN direct;
  ELSIF platform = 'youtube' THEN
    from_stats := public.admin_analytics_json_stat(
      p_stats, 'youtube', ARRAY['views', 'view_count']
    );
    IF from_stats > 0 THEN
      RETURN from_stats;
    END IF;
    RETURN direct;
  ELSE
    RETURN direct;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_daily(
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
      (s.created_at AT TIME ZONE 'UTC')::date AS day_key,
      CASE
        WHEN lower(COALESCE(s.status::text, '')) = 'approved' THEN 'verified'
        WHEN lower(COALESCE(s.status::text, '')) IN (
          'pending', 'verified', 'paid', 'rejected'
        ) THEN lower(s.status::text)
        ELSE 'unknown'
      END AS status,
      public.admin_analytics_normalize_platform(
        COALESCE(s.platform, c.platform),
        c.contest_based_details
      ) AS platform,
      public.admin_analytics_submission_views(
        COALESCE(s.views, 0)::bigint,
        public.admin_analytics_normalize_platform(
          COALESCE(s.platform, c.platform),
          c.contest_based_details
        ),
        COALESCE(s.other_stats, '{}'::jsonb)
      ) AS views,
      public.admin_analytics_json_stat(
        COALESCE(s.other_stats, '{}'::jsonb),
        public.admin_analytics_normalize_platform(
          COALESCE(s.platform, c.platform),
          c.contest_based_details
        ),
        ARRAY['likes', 'like_count']
      ) AS likes,
      public.admin_analytics_json_stat(
        COALESCE(s.other_stats, '{}'::jsonb),
        public.admin_analytics_normalize_platform(
          COALESCE(s.platform, c.platform),
          c.contest_based_details
        ),
        ARRAY['comments', 'comment_count', 'replies']
      ) AS comments,
      public.admin_analytics_json_stat(
        COALESCE(s.other_stats, '{}'::jsonb),
        public.admin_analytics_normalize_platform(
          COALESCE(s.platform, c.platform),
          c.contest_based_details
        ),
        ARRAY['shares', 'share_count', 'retweets']
      ) AS shares,
      CASE
        WHEN lower(COALESCE(s.status::text, '')) = 'paid'
          OR COALESCE(s.earnings, 0) > 0
        THEN (COALESCE(s.earnings, 0) + COALESCE(s.bonus_amount, 0))::bigint
        ELSE 0::bigint
      END AS payouts_cents
    FROM public.submissions s
    LEFT JOIN public.contests c ON c.id = s.contest_id
    WHERE p_contest_ids IS NOT NULL
      AND cardinality(p_contest_ids) > 0
      AND s.contest_id = ANY (p_contest_ids)
      AND s.created_at >= p_from
      AND s.created_at <= p_to
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
  GROUP BY 1, 2;
$$;

COMMENT ON FUNCTION public.admin_analytics_daily(timestamptz, timestamptz, uuid[]) IS
  'Daily submission metric rollups for admin analytics (views/likes/comments/shares/payouts by status).';

REVOKE ALL ON FUNCTION public.admin_analytics_json_stat(jsonb, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_normalize_platform(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_submission_views(bigint, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_daily(timestamptz, timestamptz, uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_analytics_json_stat(jsonb, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_normalize_platform(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_submission_views(bigint, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_daily(timestamptz, timestamptz, uuid[]) TO service_role;

-- Supports contest-scoped date-range scans used by admin_analytics_daily.
CREATE INDEX IF NOT EXISTS idx_submissions_admin_analytics_contest_created
ON public.submissions (contest_id, created_at)
INCLUDE (status, views, earnings, bonus_amount, platform);
