-- Admin dashboard submission/views growth charts
-- Aggregates in Postgres instead of loading every submission row into Node.
-- View helpers mirror admin_analytics_* (also defined in 20260714) so growth
-- and analytics pages use the same Instagram/TikTok/YouTube view rules.

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

CREATE OR REPLACE FUNCTION public.admin_submission_growth_daily(
  p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  day_key date,
  contest_type text,
  status text,
  submission_count bigint,
  views_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (s.created_at AT TIME ZONE 'UTC')::date AS day_key,
    c.contest_type::text AS contest_type,
    -- Same rules as admin_analytics_daily / normalizeSubmissionStatus:
    -- legacy "approved" → verified; NULL/empty/other → unknown
    CASE
      WHEN lower(COALESCE(s.status::text, '')) = 'approved' THEN 'verified'
      WHEN lower(COALESCE(s.status::text, '')) IN (
        'pending', 'verified', 'paid', 'rejected'
      ) THEN lower(s.status::text)
      ELSE 'unknown'
    END AS status,
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
    ), 0)::bigint AS views_sum
  FROM public.submissions s
  LEFT JOIN public.contests c ON c.id = s.contest_id
  WHERE p_since IS NULL OR s.created_at >= p_since
  GROUP BY 1, 2, 3;
$$;

CREATE OR REPLACE FUNCTION public.admin_submission_creators_by_day(
  p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  day_key date,
  contest_type text,
  creator_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (s.created_at AT TIME ZONE 'UTC')::date AS day_key,
    c.contest_type::text AS contest_type,
    array_agg(DISTINCT s.creator_id) FILTER (WHERE s.creator_id IS NOT NULL) AS creator_ids
  FROM public.submissions s
  LEFT JOIN public.contests c ON c.id = s.contest_id
  WHERE p_since IS NULL OR s.created_at >= p_since
  GROUP BY 1, 2;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_json_stat(jsonb, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_normalize_platform(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_submission_views(bigint, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_submission_growth_daily(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_submission_creators_by_day(timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_analytics_json_stat(jsonb, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_normalize_platform(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_submission_views(bigint, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_submission_growth_daily(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_submission_creators_by_day(timestamptz) TO service_role;

-- Speeds date-range scans for growth RPCs. Does not INCLUDE other_stats
-- (JSONB is large; view helpers still heap-fetch). On large prod tables,
-- prefer CREATE INDEX CONCURRENTLY outside a transaction during a
-- maintenance window, then drop this IF NOT EXISTS from the migrate run.
CREATE INDEX IF NOT EXISTS idx_submissions_admin_growth_daily
ON public.submissions (created_at, contest_id, status)
INCLUDE (views, creator_id);
