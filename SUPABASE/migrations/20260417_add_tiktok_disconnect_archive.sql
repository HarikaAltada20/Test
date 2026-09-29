-- Add TikTok disconnect archive storage on creator_profiles
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS tiktok_archive JSONB DEFAULT NULL;

COMMENT ON COLUMN public.creator_profiles.tiktok_archive IS 'TikTok: disconnect_snapshots history; tokens redacted.';
