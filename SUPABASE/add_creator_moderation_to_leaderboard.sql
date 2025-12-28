-- ============================================================================
-- Migration: Add Creator-Level Moderation to Twitter Campaign Leaderboard
-- Description: Adds moderation_status and rejection_reason columns to 
--              twitter_campaign_leaderboard for creator-level moderation
-- ============================================================================

-- ============================================================================
-- ADD COLUMNS TO TWITTER_CAMPAIGN_LEADERBOARD TABLE
-- ============================================================================

ALTER TABLE public.twitter_campaign_leaderboard
ADD COLUMN IF NOT EXISTS moderation_status TEXT 
  CHECK (moderation_status IN ('pending', 'approved', 'rejected')) 
  DEFAULT 'pending';

ALTER TABLE public.twitter_campaign_leaderboard
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

COMMENT ON COLUMN public.twitter_campaign_leaderboard.moderation_status IS 'Moderation status for creator-level review: pending, approved, rejected. When rejected, all tweets from this creator are considered rejected.';
COMMENT ON COLUMN public.twitter_campaign_leaderboard.rejection_reason IS 'Reason for rejecting the creator (applies to all their tweets in this contest)';

CREATE INDEX IF NOT EXISTS idx_twitter_leaderboard_moderation_status 
ON public.twitter_campaign_leaderboard(contest_id, moderation_status) 
WHERE moderation_status IS NOT NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

