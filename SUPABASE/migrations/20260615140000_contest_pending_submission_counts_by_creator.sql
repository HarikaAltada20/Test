-- Aggregated pending submission counts per creator (creator-wise leaderboard badges).
-- Returns at most one row per creator id in p_creator_ids — O(creators on page), not O(submissions).

CREATE OR REPLACE FUNCTION public.contest_pending_submission_counts_by_creator(
  p_contest_id uuid,
  p_creator_ids uuid[]
)
RETURNS TABLE(creator_id uuid, pending_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.creator_id, COUNT(*)::bigint AS pending_count
  FROM public.submissions s
  WHERE s.contest_id = p_contest_id
    AND s.creator_id = ANY(p_creator_ids)
    AND s.status = 'pending'
  GROUP BY s.creator_id;
$$;

REVOKE ALL ON FUNCTION public.contest_pending_submission_counts_by_creator(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contest_pending_submission_counts_by_creator(uuid, uuid[]) TO authenticated, service_role;
