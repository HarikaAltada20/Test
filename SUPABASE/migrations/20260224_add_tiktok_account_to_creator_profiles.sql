-- ============================================================================
-- Migration: TikTok Integration (same pattern as Instagram / YouTube)
-- Description: Adds tiktok_account to creator_profiles for TikTok contests.
-- ============================================================================

-- 1. Add TikTok account to creator_profiles (same pattern as youtube_account, instagram_account)
ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS tiktok_account JSONB DEFAULT NULL;

COMMENT ON COLUMN public.creator_profiles.tiktok_account IS 'TikTok account connection data stored as JSONB. Example structure:
{
  "username": "creator_handle",
  "display_name": "Display Name",
  "avatar_url": "https://...",
  "bio": "User bio text...",
  "followers_count": 5000,
  "following_count": 200,
  "likes_count": 12000,
  "video_count": 42,
  "tiktok_id": "1234567890123456789",
  "verified": false,
  "updated_at": "2025-01-15T10:30:00Z"
}';

-- 2. (Optional) If you use campaign_content_type on contests, set it for tiktok
--    Uncomment the block below if your contests table has campaign_content_type.
/*
UPDATE public.contests
SET campaign_content_type = 'video'
WHERE platform = 'tiktok'
  AND (campaign_content_type IS NULL OR campaign_content_type != 'video');
*/