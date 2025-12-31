-- ============================================================================
-- Migration: Add Moderation Status and Manual Points Adjustment for Twitter Campaigns
-- Description: Adds accept/reject functionality and manual points adjustment
--              for Twitter campaign tweets (automated fetching system)
-- Note: This does NOT modify the submissions table - that's for manual submissions
--       (YouTube/Instagram). Twitter uses automated tweet fetching.
-- ============================================================================

-- ============================================================================
-- 1. ADD COLUMNS TO TWITTER_CAMPAIGN_TWEETS TABLE
-- ============================================================================

ALTER TABLE public.twitter_campaign_tweets
ADD COLUMN IF NOT EXISTS moderation_status TEXT 
  CHECK (moderation_status IN ('pending', 'approved', 'rejected')) 
  DEFAULT 'pending';

ALTER TABLE public.twitter_campaign_tweets
ADD COLUMN IF NOT EXISTS manual_points_adjustment INTEGER DEFAULT 0;

ALTER TABLE public.twitter_campaign_tweets
ADD COLUMN IF NOT EXISTS manual_points_reason TEXT NULL;

COMMENT ON COLUMN public.twitter_campaign_tweets.moderation_status IS 'Moderation status for brand/admin review: pending, approved, rejected';
COMMENT ON COLUMN public.twitter_campaign_tweets.manual_points_adjustment IS 'Manual points adjustment (+ or -) added by brand/admin. Added to calculated points.';
COMMENT ON COLUMN public.twitter_campaign_tweets.manual_points_reason IS 'Reason for manual points adjustment (required when adjustment is non-zero)';

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_moderation_status 
ON public.twitter_campaign_tweets(contest_id, moderation_status) 
WHERE moderation_status IS NOT NULL;

-- ============================================================================
-- 2. ADD COLUMNS TO TWITTER_CAMPAIGN_LEADERBOARD TABLE
-- ============================================================================

ALTER TABLE public.twitter_campaign_leaderboard
ADD COLUMN IF NOT EXISTS manual_points_adjustment INTEGER DEFAULT 0;

ALTER TABLE public.twitter_campaign_leaderboard
ADD COLUMN IF NOT EXISTS manual_points_reason TEXT NULL;

COMMENT ON COLUMN public.twitter_campaign_leaderboard.manual_points_adjustment IS 'Manual points adjustment (+ or -) for the creator. This is aggregated from individual tweet adjustments or set directly.';
COMMENT ON COLUMN public.twitter_campaign_leaderboard.manual_points_reason IS 'Reason for manual points adjustment (required when adjustment is non-zero)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

