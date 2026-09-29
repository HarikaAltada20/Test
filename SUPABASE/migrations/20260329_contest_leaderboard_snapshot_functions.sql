-- Scalable leaderboard helpers: single-pass SQL instead of N count queries + chunked full-table scans.
-- Recommended index (apply separately if missing): submissions(contest_id) WHERE status <> 'rejected';

-- Per-creator aggregates for creator-wise leaderboard (same sort as previous JS: views desc, tiebreak by best submission rank)
CREATE OR REPLACE FUNCTION public.contest_sorted_creator_aggregates(p_contest_id uuid)
RETURNS TABLE (
  creator_id uuid,
  total_views bigint,
  total_earnings numeric,
  submission_count int,
  submission_ranks integer[],
  best_submission_rank int,
  has_paid_submission boolean,
  platform text
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
    a.platform
  FROM agg a
  ORDER BY a.total_views DESC, a.best_submission_rank ASC;
$$;

-- One round-trip for /my-submission: all submission-wise ranks for this creator + creator-wise totals/rank
CREATE OR REPLACE FUNCTION public.contest_my_leaderboard_snapshot(
  p_contest_id uuid,
  p_creator_id uuid,
  p_submission_ids uuid[]
)
RETURNS jsonb
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
      s.status
    FROM submissions s
    WHERE s.contest_id = p_contest_id
      AND s.status <> 'rejected'
  ),
  ranked AS (
    SELECT
      e.id,
      ROW_NUMBER() OVER (ORDER BY e.v DESC, e.created_at ASC)::int AS rnk
    FROM eligible e
  ),
  creator_totals AS (
    SELECT
      e.creator_id,
      sum(e.v)::bigint AS total_views,
      sum(e.e)::numeric AS total_earnings
    FROM eligible e
    GROUP BY e.creator_id
  ),
  creator_ranked AS (
    SELECT
      ct.creator_id,
      ct.total_views,
      ct.total_earnings,
      ROW_NUMBER() OVER (ORDER BY ct.total_views DESC, ct.creator_id)::int AS creator_rank
    FROM creator_totals ct
  )
  SELECT jsonb_build_object(
    'submission_ranks', (
      SELECT coalesce(
        jsonb_object_agg(u.id::text, to_jsonb(r.rnk)),
        '{}'::jsonb
      )
      FROM unnest(p_submission_ids) AS u(id)
      LEFT JOIN ranked r ON r.id = u.id
    ),
    'creator_wise', (
      SELECT jsonb_build_object(
        'total_views', cr.total_views,
        'total_earnings', cr.total_earnings,
        'creator_rank', cr.creator_rank
      )
      FROM creator_ranked cr
      WHERE cr.creator_id = p_creator_id
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.contest_sorted_creator_aggregates(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contest_my_leaderboard_snapshot(uuid, uuid, uuid[]) TO anon, authenticated;
