-- Trust score metrics cached on creator profile (default score 100 for all rows).
-- Recomputed in app when submissions are verified/rejected.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS trust_score_metrics jsonb NOT NULL DEFAULT jsonb_build_object(
    'trust_score', 100,
    'total_reels', 0,
    'verified_reels', 0,
    'rejected_reels', 0,
    'pending_reels', 0,
    'updated_at', now()
  );

COMMENT ON COLUMN public.creator_profiles.trust_score_metrics IS 'JSON trust snapshot: trust_score, percentages, reels counts, and updated_at.';

CREATE INDEX IF NOT EXISTS idx_creator_profiles_trust_score
  ON public.creator_profiles (((trust_score_metrics->>'trust_score')::integer));
