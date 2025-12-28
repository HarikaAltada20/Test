-- ============================================================================
-- Migration: Raid Campaign Feature - Unified Twitter Campaign Metrics
-- Description: Adds unified metrics table for all Twitter campaigns (awareness + raid)
--              and support for tracking raid engagements
-- ============================================================================

-- ============================================================================
-- 1. ADD TARGET_TWEET_ID TO EXISTING TWITTER_CAMPAIGN_TWEETS TABLE
-- ============================================================================

ALTER TABLE public.twitter_campaign_tweets
ADD COLUMN IF NOT EXISTS target_tweet_id TEXT NULL;

COMMENT ON COLUMN public.twitter_campaign_tweets.target_tweet_id IS 'For raid campaigns: The target tweet ID this engagement is for. NULL for awareness/keyword campaigns. Used to filter engagements on specific target tweet.';

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_target 
ON public.twitter_campaign_tweets(contest_id, target_tweet_id) 
WHERE target_tweet_id IS NOT NULL;

-- ============================================================================
-- 2. CREATE UNIFIED TWITTER CAMPAIGN METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.twitter_campaign_metrics (
  contest_id UUID PRIMARY KEY REFERENCES public.contests(id) ON DELETE CASCADE,
  
  -- Campaign type identification
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('raid', 'awareness')),
  
  -- ============================================
  -- COMMON METRICS (for all campaign types)
  -- ============================================
  total_filtered_tweets INTEGER DEFAULT 0,  -- Total eligible tweets/submissions
  total_participants INTEGER DEFAULT 0,     -- Current number of active participants
  max_participants INTEGER DEFAULT NULL,    -- Future: participant limit (NULL = unlimited)
  
  -- Aggregated engagement metrics (from all eligible tweets)
  total_likes INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_quote_reposts INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,          -- Combined points (regular + raid)
  
  -- ============================================
  -- RAID TARGETS (copied from contests at creation/edit)
  -- ============================================
  target_tweet_id TEXT NULL,               -- Target tweet ID for raid campaigns
  target_tweet_url TEXT NULL,              -- Target tweet URL
  
  -- Target metrics (what we want to achieve)
  target_likes INTEGER DEFAULT NULL,           -- TARGET (from contests JSONB)
  target_comments INTEGER DEFAULT NULL,        -- TARGET (from contests JSONB)
  target_retweets INTEGER DEFAULT NULL,        -- TARGET (from contests JSONB)
  target_quote_reposts INTEGER DEFAULT NULL,   -- TARGET (from contests JSONB)
  
  -- ============================================
  -- RAID CURRENT METRICS (updated from API)
  -- ============================================
  target_current_likes INTEGER DEFAULT NULL,    -- CURRENT (from API)
  target_current_comments INTEGER DEFAULT NULL, -- CURRENT (from API)
  target_current_retweets INTEGER DEFAULT NULL,
  target_current_quote_reposts INTEGER DEFAULT NULL,
  target_current_views INTEGER DEFAULT NULL,
  
  -- ============================================
  -- STATUS
  -- ============================================
  targets_reached BOOLEAN DEFAULT NULL,         -- CALCULATED (current >= target)
  
  -- ============================================
  -- TRACKING
  -- ============================================
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.twitter_campaign_metrics IS 'Unified metrics table for all Twitter campaigns (awareness, raid). Stores aggregated metrics, participant counts, and raid-specific target tweet metrics. Targets are synced from contests.contest_based_details on create/edit.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_twitter_campaign_metrics_contest 
ON public.twitter_campaign_metrics(contest_id);

CREATE INDEX IF NOT EXISTS idx_twitter_campaign_metrics_type 
ON public.twitter_campaign_metrics(campaign_type);

CREATE INDEX IF NOT EXISTS idx_twitter_campaign_metrics_target 
ON public.twitter_campaign_metrics(contest_id, target_tweet_id) 
WHERE target_tweet_id IS NOT NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

