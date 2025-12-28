-- ============================================================================
-- Migration: Remove raid_points column (not needed - using total_points only)
-- Description: Drops the raid_points column from twitter_campaign_leaderboard
--              since we only need total_points to track all points
-- ============================================================================

-- Drop the raid_points column if it exists
ALTER TABLE public.twitter_campaign_leaderboard
DROP COLUMN IF EXISTS raid_points;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

