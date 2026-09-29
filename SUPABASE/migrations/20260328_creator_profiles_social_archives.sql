-- Platform disconnect archives + Instagram analytics cache (JSONB on creator_profiles)
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS instagram_archive JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS youtube_archive JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS twitter_archive JSONB DEFAULT NULL;

COMMENT ON COLUMN public.creator_profiles.instagram_archive IS 'Instagram: analytics cache (entries by range) + disconnect_snapshots; tokens must be redacted in snapshots.';
COMMENT ON COLUMN public.creator_profiles.youtube_archive IS 'YouTube: disconnect_snapshots history; tokens redacted.';
COMMENT ON COLUMN public.creator_profiles.twitter_archive IS 'Twitter/X: disconnect_snapshots history; tokens redacted.';
