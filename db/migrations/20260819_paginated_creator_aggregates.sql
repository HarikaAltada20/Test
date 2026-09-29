-- Paginated creator-wise leaderboard: ranking + aggregation in SQL, only return requested page.
-- Replaces the unpaginated contest_sorted_creator_aggregates which returned ALL rows.

DROP FUNCTION IF EXISTS public.contest_sorted_creator_aggregates_page(uuid, int, int);

CREATE OR REPLACE FUNCTION public.contest_sorted_creator_aggregates_page(
  p_contest_id uuid,
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  creator_id uuid,
  total_views bigint,
  total_earnings numeric,
  submission_count int,
  submission_ranks integer[],
  best_submission_rank int,
  has_paid_submission boolean,
  platform text,
  pending_submission_count int,
  total_creator_count bigint
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
  ),
  counted AS (
    SELECT *, count(*) OVER ()::bigint AS total_creator_count
    FROM agg
    ORDER BY total_views DESC, best_submission_rank ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    c.creator_id,
    c.total_views,
    c.total_earnings,
    c.submission_count,
    c.submission_ranks,
    c.best_submission_rank,
    c.has_paid_submission,
    c.platform,
    c.pending_submission_count,
    c.total_creator_count
  FROM counted c;
$$;

GRANT EXECUTE ON FUNCTION public.contest_sorted_creator_aggregates_page(uuid, int, int) TO anon, authenticated;
