-- Scale creator-wise pending badges: compute pending count in the same pass as
-- contest_sorted_creator_aggregates (no second query per page load).
--
-- Postgres cannot change RETURNS TABLE columns via CREATE OR REPLACE alone;
-- drop the old signature first, then recreate with pending_submission_count.

DROP FUNCTION IF EXISTS public.contest_sorted_creator_aggregates(uuid);

CREATE FUNCTION public.contest_sorted_creator_aggregates(p_contest_id uuid)
RETURNS TABLE (
  creator_id uuid,
  total_views bigint,
  total_earnings numeric,
  submission_count int,
  submission_ranks integer[],
  best_submission_rank int,
  has_paid_submission boolean,
  platform text,
  pending_submission_count int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT
      s.id,
      s.creator_id,
      coalesce(s.views, 0)::bigint AS v,
      coalesce(s.earnings, 0)::numeric AS e,
      s.created_at,
      s.status,
      s.platform::text AS platform
    FROM submissions s
    WHERE s.contest_id = p_contest_id
      AND s.status <> 'rejected'
  ),
  ranked AS (
    SELECT
      e.id,
      e.creator_id,
      e.v,
      e.e,
      e.created_at,
      e.status,
      e.platform,
      ROW_NUMBER() OVER (ORDER BY e.v DESC, e.created_at ASC)::int AS submission_rank
    FROM eligible e
  ),
  agg AS (
    SELECT
      r.creator_id,
      sum(r.v)::bigint AS total_views,
      sum(r.e)::numeric AS total_earnings,
      count(*)::int AS submission_count,
      count(*) FILTER (WHERE r.status = 'pending')::int AS pending_submission_count,
      bool_or(r.status = 'paid') AS has_paid_submission,
      min(r.submission_rank)::int AS best_submission_rank,
      coalesce(array_agg(r.submission_rank ORDER BY r.submission_rank), ARRAY[]::int[]) AS submission_ranks,
      (array_agg(r.platform ORDER BY r.v DESC))[1] AS platform
    FROM ranked r
    GROUP BY r.creator_id
  )
  SELECT
    a.creator_id,
    a.total_views,
    a.total_earnings,
    a.submission_count,
    a.submission_ranks,
    a.best_submission_rank,
    a.has_paid_submission,
    a.platform,
    a.pending_submission_count
  FROM agg a
  ORDER BY a.total_views DESC, a.best_submission_rank ASC;
$$;

GRANT EXECUTE ON FUNCTION public.contest_sorted_creator_aggregates(uuid) TO anon, authenticated;

-- Supports pending count lookups by contest + creator (creator-wise page slice).
CREATE INDEX IF NOT EXISTS idx_submissions_contest_creator_pending
ON public.submissions (contest_id, creator_id)
WHERE status = 'pending';
