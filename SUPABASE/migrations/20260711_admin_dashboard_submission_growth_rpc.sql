-- Admin dashboard submission/views growth charts
-- Aggregates in Postgres instead of loading every submission row into Node.

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
    lower(COALESCE(s.status::text, 'pending')) AS status,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(GREATEST(COALESCE(s.views, 0), 0)), 0)::bigint AS views_sum
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

REVOKE ALL ON FUNCTION public.admin_submission_growth_daily(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_submission_creators_by_day(timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_submission_growth_daily(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_submission_creators_by_day(timestamptz) TO service_role;

CREATE INDEX IF NOT EXISTS idx_submissions_admin_growth_daily
ON public.submissions (created_at, contest_id, status)
INCLUDE (views, creator_id);
