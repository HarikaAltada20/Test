-- Daily Challenge creator metrics RPC
-- Moves leaderboard aggregation into Postgres so the app does not rely on
-- PostgREST aggregate select syntax, which can be disabled in production.

CREATE OR REPLACE FUNCTION public.get_daily_challenge_creator_metrics(
  p_event_start timestamptz DEFAULT NULL,
  p_event_end timestamptz DEFAULT NULL,
  p_range_start timestamptz DEFAULT NULL,
  p_range_end timestamptz DEFAULT NULL,
  p_min_views_per_reel bigint DEFAULT 100
)
RETURNS TABLE (
  creator_id uuid,
  username text,
  full_name text,
  profile_picture_url text,
  pending_views bigint,
  verified_views bigint,
  pending_reels bigint,
  verified_reels bigint,
  total_views bigint,
  total_reels bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      s.creator_id,
      lower(COALESCE(s.status::text, 'pending')) AS normalized_status,
      GREATEST(COALESCE(s.views, 0), 0)::bigint AS safe_views
    FROM public.submissions s
    WHERE s.creator_id IS NOT NULL
      AND lower(COALESCE(s.status::text, 'pending')) IN ('pending', 'verified', 'paid')
      AND (p_event_start IS NULL OR s.created_at >= p_event_start)
      AND (p_event_end IS NULL OR s.created_at <= p_event_end)
      AND (p_range_start IS NULL OR s.created_at >= p_range_start)
      AND (p_range_end IS NULL OR s.created_at < p_range_end)
  ),
  aggregated AS (
    SELECT
      f.creator_id,
      COALESCE(SUM(f.safe_views) FILTER (WHERE f.normalized_status = 'pending'), 0)::bigint AS pending_views,
      COALESCE(SUM(f.safe_views) FILTER (WHERE f.normalized_status <> 'pending'), 0)::bigint AS verified_views,
      COUNT(*) FILTER (
        WHERE f.normalized_status = 'pending'
          AND f.safe_views >= GREATEST(COALESCE(p_min_views_per_reel, 0), 0)
      )::bigint AS pending_reels,
      COUNT(*) FILTER (
        WHERE f.normalized_status <> 'pending'
          AND f.safe_views >= GREATEST(COALESCE(p_min_views_per_reel, 0), 0)
      )::bigint AS verified_reels,
      COALESCE(SUM(f.safe_views), 0)::bigint AS total_views,
      COUNT(*)::bigint AS total_reels
    FROM filtered f
    GROUP BY f.creator_id
  )
  SELECT
    a.creator_id,
    u.username,
    u.full_name,
    u.profile_picture_url,
    a.pending_views,
    a.verified_views,
    a.pending_reels,
    a.verified_reels,
    a.total_views,
    a.total_reels
  FROM aggregated a
  LEFT JOIN public.users u ON u.id = a.creator_id;
$$;

REVOKE ALL ON FUNCTION public.get_daily_challenge_creator_metrics(
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  bigint
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_daily_challenge_creator_metrics(
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  bigint
) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_submissions_daily_challenge_metrics
ON public.submissions (created_at, status, creator_id)
WHERE creator_id IS NOT NULL
  AND status IN ('pending', 'verified', 'paid');

CREATE INDEX IF NOT EXISTS idx_submissions_daily_challenge_reels
ON public.submissions (created_at, views, status, creator_id)
WHERE creator_id IS NOT NULL
  AND status IN ('pending', 'verified', 'paid');
