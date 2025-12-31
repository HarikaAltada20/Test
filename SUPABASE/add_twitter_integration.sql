-- ============================================================================
-- Migration: Twitter Integration - Complete Database Schema
-- Date: 2025-01-XX
-- Description: Adds Twitter campaign support with separate tables for 
--              high-volume tweet tracking, leaderboards, and participants
-- ============================================================================

-- ============================================================================
-- 1. EXTEND EXISTING TABLES
-- ============================================================================

-- Add Twitter account to creator_profiles (similar to YouTube/Instagram)
ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS twitter_account JSONB DEFAULT NULL;

COMMENT ON COLUMN public.creator_profiles.twitter_account IS 'Twitter/X account connection data stored as JSONB. Structure matches twitterProfile API response:
{
  "username": "creator_handle",              // From twitterProfile.profile
  "name": "Display Name",                    // From twitterProfile.name
  "verified": false,                        // From twitterProfile.blue_verified
  "profile_picture_url": "https://...",      // From twitterProfile.avatar
  "bio": "User bio text...",                // From twitterProfile.desc
  "media_count": 150,                       // From twitterProfile.media_count
  "tweet_count": 1200,                      // From twitterProfile.statuses_count
  "following_count": 200,                   // From twitterProfile.friends_count
  "followers_count": 5000,                  // From twitterProfile.sub_count
  "twitter_id": "1234567890",               // From twitterProfile.rest_id
  "updated_at": "2025-01-15T10:30:00Z"      // ISO timestamp
}';

-- Add campaign_content_type to contests (to distinguish video vs text/image)
ALTER TABLE public.contests
ADD COLUMN IF NOT EXISTS campaign_content_type TEXT 
CHECK (campaign_content_type IN ('video', 'text_image')) 
DEFAULT NULL;

COMMENT ON COLUMN public.contests.campaign_content_type IS 'Type of campaign content:
- "video": YouTube, Instagram videos, Twitter videos
- "text_image": Twitter text/image posts, LinkedIn posts
- NULL: Legacy campaigns (backward compatible)';

-- Create index for filtering by content type
CREATE INDEX IF NOT EXISTS idx_contests_campaign_content_type 
ON public.contests(campaign_content_type) 
WHERE campaign_content_type IS NOT NULL;

-- ============================================================================
-- 2. TWITTER CAMPAIGN PARTICIPANTS TABLE
-- ============================================================================
-- Tracks which creators have joined a Twitter campaign
-- This is separate from submissions since creators don't manually submit

CREATE TABLE IF NOT EXISTS public.twitter_campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twitter_username TEXT NOT NULL,  -- Snapshot at join time
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,  -- Can be deactivated if account disconnected
  last_tweet_fetched_at TIMESTAMPTZ,  -- Last time we fetched their tweets
  total_tweets_tracked INTEGER DEFAULT 0,  -- Count of tweets we've tracked
  UNIQUE(contest_id, creator_id)  -- One entry per creator per campaign
);

COMMENT ON TABLE public.twitter_campaign_participants IS 'Tracks creators who have joined Twitter campaigns. 
Creators join by connecting their Twitter account. System auto-fetches their tweets.';

CREATE INDEX idx_twitter_participants_contest 
ON public.twitter_campaign_participants(contest_id);

CREATE INDEX idx_twitter_participants_creator 
ON public.twitter_campaign_participants(creator_id);

CREATE INDEX idx_twitter_participants_active 
ON public.twitter_campaign_participants(contest_id, is_active) 
WHERE is_active = true;

-- ============================================================================
-- 3. TWITTER CAMPAIGN TWEETS TABLE
-- ============================================================================
-- High-volume table for tracking individual tweets
-- This is separate from submissions because:
-- 1. High volume (thousands of tweets per campaign)
-- 2. Tweets can be deleted
-- 3. Different lifecycle than video submissions

CREATE TABLE IF NOT EXISTS public.twitter_campaign_tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Tweet identification
  tweet_id TEXT NOT NULL,  -- Twitter tweet ID (string)
  tweet_url TEXT NOT NULL,
  twitter_username TEXT NOT NULL,  -- Snapshot at fetch time
  
  -- Tweet content (snapshot at fetch time - important for deleted tweets)
  tweet_text TEXT NOT NULL,
  tweet_created_at TIMESTAMPTZ NOT NULL,  -- When tweet was posted on Twitter
  tweet_media_urls JSONB DEFAULT '[]'::jsonb,  -- Array of media URLs if any
  tweet_type TEXT CHECK (tweet_type IN ('tweet', 'quote', 'retweet', 'reply')) DEFAULT 'tweet',
  
  -- Eligibility & filtering
  is_eligible BOOLEAN DEFAULT false,
  eligibility_reason TEXT,  -- Why it's eligible or not
  filter_status TEXT DEFAULT 'pending' CHECK (filter_status IN ('pending', 'eligible', 'filtered_out', 'deleted')),
  
  -- Engagement metrics (snapshots - updated periodically)
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  quote_reposts INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,  -- If available via API
  
  -- Points calculation
  points INTEGER DEFAULT 0,
  points_calculated_at TIMESTAMPTZ,
  
  -- Tracking metadata
  first_fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_metrics_fetch_at TIMESTAMPTZ,  -- Last time we fetched metrics from Twitter
  
  -- Deletion tracking
  is_deleted BOOLEAN DEFAULT false,  -- Tweet deleted on Twitter
  deleted_at TIMESTAMPTZ,
  deletion_detected_at TIMESTAMPTZ,
  
  -- Prevent duplicates
  UNIQUE(contest_id, tweet_id)
);

COMMENT ON TABLE public.twitter_campaign_tweets IS 'Tracks individual tweets fetched for Twitter campaigns.
High-volume table - can contain thousands of tweets per campaign.
Tweets are auto-fetched, filtered, and points are calculated based on engagement.';

-- Indexes for performance
CREATE INDEX idx_twitter_tweets_contest 
ON public.twitter_campaign_tweets(contest_id);

CREATE INDEX idx_twitter_tweets_creator 
ON public.twitter_campaign_tweets(creator_id);

CREATE INDEX idx_twitter_tweets_eligible 
ON public.twitter_campaign_tweets(contest_id, is_eligible, filter_status) 
WHERE is_eligible = true AND filter_status = 'eligible';

CREATE INDEX idx_twitter_tweets_points 
ON public.twitter_campaign_tweets(contest_id, creator_id, points DESC);

CREATE INDEX idx_twitter_tweets_updated 
ON public.twitter_campaign_tweets(contest_id, last_updated_at DESC);

CREATE INDEX idx_twitter_tweets_deleted 
ON public.twitter_campaign_tweets(contest_id, is_deleted) 
WHERE is_deleted = false;

CREATE INDEX idx_twitter_tweets_tweet_id 
ON public.twitter_campaign_tweets(tweet_id);

CREATE INDEX idx_twitter_tweets_created_at 
ON public.twitter_campaign_tweets(tweet_created_at DESC);

-- ============================================================================
-- 4. TWITTER CAMPAIGN LEADERBOARD TABLE
-- ============================================================================
-- Aggregated points per creator for fast leaderboard queries
-- This prevents expensive aggregations on the high-volume tweets table

CREATE TABLE IF NOT EXISTS public.twitter_campaign_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Aggregated metrics (sum of all eligible tweets)
  total_points INTEGER DEFAULT 0,
  total_eligible_tweets INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_quote_reposts INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  
  -- Ranking
  current_rank INTEGER,
  
  -- Refresh tracking (hourly cooldown)
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_refresh_available_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  refresh_count INTEGER DEFAULT 0,  -- Track how many times refreshed
  
  -- Prevent duplicates
  UNIQUE(contest_id, creator_id)
);

COMMENT ON TABLE public.twitter_campaign_leaderboard IS 'Aggregated leaderboard for Twitter campaigns.
Points and metrics are aggregated from twitter_campaign_tweets table.
Updated when users click "Refresh Metrics" button (hourly cooldown).';

-- Indexes for leaderboard queries
CREATE INDEX idx_twitter_leaderboard_contest 
ON public.twitter_campaign_leaderboard(contest_id);

CREATE INDEX idx_twitter_leaderboard_rank 
ON public.twitter_campaign_leaderboard(contest_id, current_rank ASC NULLS LAST);

CREATE INDEX idx_twitter_leaderboard_points 
ON public.twitter_campaign_leaderboard(contest_id, total_points DESC);

CREATE INDEX idx_twitter_leaderboard_refresh 
ON public.twitter_campaign_leaderboard(contest_id, next_refresh_available_at);

-- ============================================================================
-- 5. TRIGGERS & FUNCTIONS
-- ============================================================================

-- Function to update last_updated_at timestamp
CREATE OR REPLACE FUNCTION update_twitter_tweet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for twitter_campaign_tweets
CREATE TRIGGER update_twitter_tweets_updated_at
BEFORE UPDATE ON public.twitter_campaign_tweets
FOR EACH ROW
EXECUTE FUNCTION update_twitter_tweet_updated_at();

-- Function to increment participant tweet count
CREATE OR REPLACE FUNCTION increment_participant_tweet_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.twitter_campaign_participants
  SET total_tweets_tracked = total_tweets_tracked + 1,
      last_tweet_fetched_at = NOW()
  WHERE contest_id = NEW.contest_id 
    AND creator_id = NEW.creator_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update participant stats when tweet is inserted
CREATE TRIGGER increment_participant_tweet_count_trigger
AFTER INSERT ON public.twitter_campaign_tweets
FOR EACH ROW
EXECUTE FUNCTION increment_participant_tweet_count();

-- ============================================================================
-- 6. UPDATE CONTEST_BASED_DETAILS COMMENT
-- ============================================================================
-- Document the Twitter campaign structure in contest_based_details

COMMENT ON COLUMN public.contests.contest_based_details IS 'Contains contest-type-specific details. Money values are stored in cents as integers.

For Leaderboard contests:
{
  "leaderboard_contest": {
    "prizes": [{"position": 1, "amount": 10000}, ...],
    "total_prize": 50000,
    "winner_count": 3,
    "flat_fee_bonus": 1000
  }
}

For CPM contests:
{
  "cpm_contest": {
    "cpm_rate_usd": 5.00,
    "min_views": 1000,
    "max_views": 100000,
    "total_budget": 100000,
    "budget_spent": 0,
    "terms_conditions": "...",
    "flat_fee_bonus": 1000
  }
}

For Twitter campaigns (campaign_content_type = "text_image"):
{
  "twitter_campaign": {
    "campaign_type": "raid" | "awareness",
    
    // For keyword/hashtag campaigns:
    "keyword_config": {
      "keywords": ["DegenDAO", "token launch"],
      "hashtags": ["#DegenDAO", "#TokenLaunch"],
      "required_mentions": ["@DegenDAO"],
      "exclude_keywords": ["scam", "rug"],
      "min_engagement_threshold": 10,
      "case_sensitive": false
    },
    
    // For raid campaigns:
    "raid_target": {
      "tweet_url": "https://x.com/user/status/1234567890",
      "tweet_id": "1234567890",
      "target_engagement": {
        "likes": 1000,
        "comments": 100,
        "retweets": 500,
        "quote_reposts": 200
      }
    },
    
    // Points configuration (for both types):
    "points_config": {
      "base_tweet_points": 10,
      "likes": 1,
      "replies": 5,
      "retweets": 3,
      "quote_reposts": 4,
      "impressions_multiplier": 0.001
    },
    
    // Auto-fetch settings:
    "auto_fetch_enabled": true,
    "fetch_interval_minutes": 15,
    "lookback_hours": 24,
    "max_participants": null,
    
    // Tweet type filters:
    "allowed_tweet_types": ["tweet", "quote", "retweet", "reply"],
    
    // Target metrics (optional):
    "target_metrics": {
      "total_likes": 10000,
      "total_comments": 1000,
      "total_impressions": 100000
    }
  }
}';

-- ============================================================================
-- 7. BACKFILL EXISTING DATA (if needed)
-- ============================================================================

-- Set campaign_content_type for existing contests
UPDATE public.contests
SET campaign_content_type = 'video'
WHERE platform IN ('youtube', 'instagram')
  AND campaign_content_type IS NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
