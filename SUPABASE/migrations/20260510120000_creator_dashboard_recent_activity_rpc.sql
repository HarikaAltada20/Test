-- Latest submission per contest for the signed-in creator, then the 3 most recently
-- active contests. One round-trip, minimal rows over the wire.
-- DISTINCT ON: for each contest_id, Postgres keeps the first row after ORDER BY
-- contest_id, created_at DESC — i.e. the most recent submission per contest.

CREATE OR REPLACE FUNCTION public.creator_dashboard_recent_activity()
RETURNS TABLE (
  id uuid,
  title text,
  thumbnail_url text,
  platform text,
  last_submission_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.title,
    c.thumbnail_url,
    c.platform,
    s.created_at AS last_submission_at
  FROM (
    SELECT DISTINCT ON (contest_id)
      contest_id,
      created_at
    FROM public.submissions
    WHERE creator_id = (SELECT auth.uid())
      AND contest_id IS NOT NULL
    ORDER BY contest_id, created_at DESC
  ) s
  INNER JOIN public.contests c ON c.id = s.contest_id
  ORDER BY s.created_at DESC
  LIMIT 3;
$$;

GRANT EXECUTE ON FUNCTION public.creator_dashboard_recent_activity() TO authenticated;
