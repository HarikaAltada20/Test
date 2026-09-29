-- =============================================================================
-- Platform leaderboard metrics (YouTube / Instagram / TikTok tabs)
--
-- Total winnings on platform tabs must come from submissions.earnings (paid rows)
-- filtered by submissions.platform. Scanning rows in the app does not scale.
--
-- Apply in Supabase SQL Editor (or your migration runner) BEFORE deploying the
-- app that calls get_creator_platform_leaderboard_metrics.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_creator_platform_leaderboard_metrics(
  p_platform text
)
RETURNS TABLE (
  creator_id uuid,
  winnings bigint,
  submissions_made bigint,
  submissions_won bigint,
  contests_participated bigint,
  contests_won bigint,
  total_views bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.creator_id,
    COALESCE(SUM(s.earnings) FILTER (WHERE s.status = 'paid'), 0)::bigint AS winnings,
    COUNT(*)::bigint AS submissions_made,
    COUNT(*) FILTER (WHERE s.status = 'paid')::bigint AS submissions_won,
    COUNT(DISTINCT s.contest_id)::bigint AS contests_participated,
    COUNT(DISTINCT s.contest_id) FILTER (WHERE s.status = 'paid')::bigint AS contests_won,
    COALESCE(SUM(COALESCE(s.views, 0)), 0)::bigint AS total_views
  FROM public.submissions s
  WHERE s.creator_id IS NOT NULL
    AND s.contest_id IS NOT NULL
    AND lower(trim(s.platform)) = lower(trim(p_platform))
  GROUP BY s.creator_id;
$$;

REVOKE ALL ON FUNCTION public.get_creator_platform_leaderboard_metrics(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_platform_leaderboard_metrics(text)
  TO anon, authenticated, service_role;

-- Expression index matches the RPC predicate (lower(trim(platform))).
CREATE INDEX IF NOT EXISTS idx_submissions_platform_creator_leaderboard_norm
ON public.submissions ((lower(trim(platform))), creator_id)
WHERE creator_id IS NOT NULL
  AND contest_id IS NOT NULL;

-- Keep a plain composite for equality filters that use stored platform casing.
CREATE INDEX IF NOT EXISTS idx_submissions_platform_creator_leaderboard
ON public.submissions (platform, creator_id)
WHERE creator_id IS NOT NULL
  AND contest_id IS NOT NULL;
