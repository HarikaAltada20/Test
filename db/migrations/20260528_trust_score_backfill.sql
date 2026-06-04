-- One-time: set trust metrics default for everyone, then recalc from submissions.

UPDATE public.creator_profiles
SET trust_score_metrics = jsonb_build_object(
  'trust_score', 100,
  'total_reels', 0,
  'verified_reels', 0,
  'rejected_reels', 0,
  'pending_reels', 0,
  'updated_at', now()
);

WITH counts AS (
  SELECT
    s.creator_id,
    COUNT(*)::integer AS total_reels,
    COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer AS verified_reels,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::integer AS rejected_reels,
    COUNT(*) FILTER (WHERE s.status = 'pending')::integer AS pending_reels
  FROM public.submissions s
  WHERE s.creator_id IS NOT NULL
  GROUP BY s.creator_id
)
UPDATE public.creator_profiles cp
SET trust_score_metrics = jsonb_build_object(
  'trust_score',
    CASE
      WHEN COALESCE(c.total_reels, 0) = 0 THEN 100
      ELSE GREATEST(
        0,
        ROUND(100 - (c.rejected_reels::numeric / c.total_reels::numeric) * 100)
      )::integer
    END,
  'total_reels', COALESCE(c.total_reels, 0),
  'verified_reels', COALESCE(c.verified_reels, 0),
  'rejected_reels', COALESCE(c.rejected_reels, 0),
  'pending_reels', COALESCE(c.pending_reels, 0),
  'updated_at', now()
)
FROM counts c
WHERE cp.id = c.creator_id;
