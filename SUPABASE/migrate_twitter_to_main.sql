-- ============================================================================
-- Migration: Twitter Integration - Complete Migration for Main Database
-- Date: 2025-01-XX
-- Description: Complete Twitter campaign support migration for production
--              Includes all tables, columns, indexes, and views
--              Run this on the main database to enable Twitter functionality
-- ============================================================================
-- 
-- USAGE:
-- 1. Run this migration on your main/production Supabase database
-- 2. This migration is idempotent (safe to run multiple times)
-- 3. All changes use IF NOT EXISTS / IF EXISTS for safety
-- ============================================================================

-- ============================================================================
-- PART 1: EXTEND EXISTING TABLES
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

-- Add contest_format column to contests table (if it doesn't exist)
ALTER TABLE public.contests
ADD COLUMN IF NOT EXISTS contest_format TEXT DEFAULT 'video';

COMMENT ON COLUMN public.contests.contest_format IS 'Format of the contest: "video" for video contests, "text_image" for Twitter/text-based contests';

-- ============================================================================
-- PART 2: TWITTER CAMPAIGN PARTICIPANTS TABLE
-- ============================================================================
-- Tracks which creators have joined a Twitter campaign

CREATE TABLE IF NOT EXISTS public.twitter_campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twitter_username TEXT NOT NULL,  -- Snapshot at join time
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,  -- Can be deactivated if account disconnected
  last_tweet_fetched_at TIMESTAMPTZ,  -- Last time we fetched their tweets
  total_tweets_tracked INTEGER DEFAULT 0,  -- Count of tweets we've tracked
  last_checked_at TIMESTAMPTZ,  -- Last time we checked for new tweets
  UNIQUE(contest_id, creator_id)  -- One entry per creator per campaign
);

COMMENT ON TABLE public.twitter_campaign_participants IS 'Tracks creators who have joined Twitter campaigns. 
Creators join by connecting their Twitter account. System auto-fetches their tweets.';

CREATE INDEX IF NOT EXISTS idx_twitter_participants_contest 
ON public.twitter_campaign_participants(contest_id);

CREATE INDEX IF NOT EXISTS idx_twitter_participants_creator 
ON public.twitter_campaign_participants(creator_id);

CREATE INDEX IF NOT EXISTS idx_twitter_participants_active 
ON public.twitter_campaign_participants(contest_id, is_active) 
WHERE is_active = true;

-- ============================================================================
-- PART 3: TWITTER CAMPAIGN TWEETS TABLE
-- ============================================================================
-- High-volume table for tracking individual tweets

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
  
  -- Moderation (added in later migration)
  moderation_status TEXT CHECK (moderation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  manual_points_adjustment INTEGER DEFAULT 0,
  manual_points_reason TEXT NULL,
  
  -- Raid target (for raid campaigns)
  target_tweet_id TEXT NULL,
  
  -- Prevent duplicates
  UNIQUE(contest_id, tweet_id)
);

COMMENT ON TABLE public.twitter_campaign_tweets IS 'Tracks individual tweets fetched for Twitter campaigns.
High-volume table - can contain thousands of tweets per campaign.
Tweets are auto-fetched, filtered, and points are calculated based on engagement.';

COMMENT ON COLUMN public.twitter_campaign_tweets.moderation_status IS 'Moderation status for brand/admin review: pending, approved, rejected';
COMMENT ON COLUMN public.twitter_campaign_tweets.manual_points_adjustment IS 'Manual points adjustment (+ or -) added by brand/admin. Added to calculated points.';
COMMENT ON COLUMN public.twitter_campaign_tweets.manual_points_reason IS 'Reason for manual points adjustment (required when adjustment is non-zero)';
COMMENT ON COLUMN public.twitter_campaign_tweets.target_tweet_id IS 'For raid campaigns: The target tweet ID this engagement is for. NULL for awareness/keyword campaigns.';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_twitter_tweets_contest 
ON public.twitter_campaign_tweets(contest_id);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_creator 
ON public.twitter_campaign_tweets(creator_id);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_eligible 
ON public.twitter_campaign_tweets(contest_id, is_eligible, filter_status) 
WHERE is_eligible = true AND filter_status = 'eligible';

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_points 
ON public.twitter_campaign_tweets(contest_id, creator_id, points DESC);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_updated 
ON public.twitter_campaign_tweets(contest_id, last_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_deleted 
ON public.twitter_campaign_tweets(contest_id, is_deleted) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_tweet_id 
ON public.twitter_campaign_tweets(tweet_id);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_created_at 
ON public.twitter_campaign_tweets(tweet_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_moderation_status 
ON public.twitter_campaign_tweets(contest_id, moderation_status) 
WHERE moderation_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_twitter_tweets_target 
ON public.twitter_campaign_tweets(contest_id, target_tweet_id) 
WHERE target_tweet_id IS NOT NULL;

-- ============================================================================
-- PART 4: TWITTER CAMPAIGN LEADERBOARD TABLE
-- ============================================================================
-- Aggregated points per creator for fast leaderboard queries

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
  
  -- Moderation (creator-level)
  moderation_status TEXT CHECK (moderation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  rejection_reason TEXT NULL,
  
  -- Manual points adjustment
  manual_points_adjustment INTEGER DEFAULT 0,
  manual_points_reason TEXT NULL,
  
  -- Prevent duplicates
  UNIQUE(contest_id, creator_id)
);

COMMENT ON TABLE public.twitter_campaign_leaderboard IS 'Aggregated leaderboard for Twitter campaigns.
Points and metrics are aggregated from twitter_campaign_tweets table.
Updated when users click "Refresh Metrics" button (hourly cooldown).';

COMMENT ON COLUMN public.twitter_campaign_leaderboard.moderation_status IS 'Moderation status for creator-level review: pending, approved, rejected. When rejected, all tweets from this creator are considered rejected.';
COMMENT ON COLUMN public.twitter_campaign_leaderboard.rejection_reason IS 'Reason for rejecting the creator (applies to all their tweets in this contest)';
COMMENT ON COLUMN public.twitter_campaign_leaderboard.manual_points_adjustment IS 'Manual points adjustment (+ or -) for the creator. This is aggregated from individual tweet adjustments or set directly.';
COMMENT ON COLUMN public.twitter_campaign_leaderboard.manual_points_reason IS 'Reason for manual points adjustment (required when adjustment is non-zero)';

-- Indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_twitter_leaderboard_contest 
ON public.twitter_campaign_leaderboard(contest_id);

CREATE INDEX IF NOT EXISTS idx_twitter_leaderboard_rank 
ON public.twitter_campaign_leaderboard(contest_id, current_rank ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_twitter_leaderboard_points 
ON public.twitter_campaign_leaderboard(contest_id, total_points DESC);

CREATE INDEX IF NOT EXISTS idx_twitter_leaderboard_refresh 
ON public.twitter_campaign_leaderboard(contest_id, next_refresh_available_at);

CREATE INDEX IF NOT EXISTS idx_twitter_leaderboard_moderation_status 
ON public.twitter_campaign_leaderboard(contest_id, moderation_status) 
WHERE moderation_status IS NOT NULL;

-- ============================================================================
-- PART 5: TWITTER CAMPAIGN METRICS TABLE
-- ============================================================================
-- Unified metrics table for all Twitter campaigns (awareness + raid)

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
-- PART 6: TRIGGERS & FUNCTIONS
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
DROP TRIGGER IF EXISTS update_twitter_tweets_updated_at ON public.twitter_campaign_tweets;
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
DROP TRIGGER IF EXISTS increment_participant_tweet_count_trigger ON public.twitter_campaign_tweets;
CREATE TRIGGER increment_participant_tweet_count_trigger
AFTER INSERT ON public.twitter_campaign_tweets
FOR EACH ROW
EXECUTE FUNCTION increment_participant_tweet_count();

-- ============================================================================
-- PART 7: JSONB INDEXES FOR CONTEST_BASED_DETAILS
-- ============================================================================
-- Performance indexes for Twitter campaign queries

-- GIN index for entire twitter_campaign object (for existence checks)
CREATE INDEX IF NOT EXISTS idx_contests_twitter_campaign 
ON public.contests USING GIN ((contest_based_details->'twitter_campaign'));

-- GIN index for keywords array (for filtering/searching)
CREATE INDEX IF NOT EXISTS idx_contests_twitter_keywords 
ON public.contests USING GIN ((contest_based_details->'twitter_campaign'->'keyword_config'->'keywords'));

-- GIN index for hashtags array (for filtering/searching)
CREATE INDEX IF NOT EXISTS idx_contests_twitter_hashtags 
ON public.contests USING GIN ((contest_based_details->'twitter_campaign'->'keyword_config'->'hashtags'));

-- Composite index for platform + twitter_campaign (common query pattern)
CREATE INDEX IF NOT EXISTS idx_contests_platform_twitter 
ON public.contests(platform) 
WHERE platform = 'twitter' 
AND (contest_based_details->'twitter_campaign') IS NOT NULL;

-- Index for campaign_type filtering
CREATE INDEX IF NOT EXISTS idx_contests_twitter_campaign_type 
ON public.contests((contest_based_details->'twitter_campaign'->>'campaign_type'))
WHERE (contest_based_details->'twitter_campaign') IS NOT NULL;

-- ============================================================================
-- PART 8: HELPER FUNCTIONS FOR JSONB QUERIES
-- ============================================================================

-- Function to get Twitter campaign type
CREATE OR REPLACE FUNCTION get_twitter_campaign_type(contest_id UUID)
RETURNS TEXT AS $$
  SELECT contest_based_details->'twitter_campaign'->>'campaign_type'
  FROM public.contests
  WHERE id = contest_id;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- PART 9: UPDATE CONTEST_BASED_DETAILS COMMENT
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

For Twitter campaigns (platform = "twitter" and contest_format = "text_image"):
{
  "twitter_campaign": {
    "campaign_type": "raid" | "awareness",
    
    // For keyword/hashtag campaigns:
    "keyword_config": {
      "keywords": ["keyword1", "keyword2"],
      "hashtags": ["#hashtag1", "#hashtag2"],
      "required_mentions": ["@mention1", "@mention2"],
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
-- PART 10: UPDATE CONTESTS_WITH_STATUS VIEW
-- ============================================================================
-- Ensure the view includes all necessary columns (idempotent)

-- Drop the view first to avoid column ordering conflicts
DROP VIEW IF EXISTS public.contests_with_status;

CREATE VIEW public.contests_with_status WITH (security_invoker='on') AS
SELECT
  contests.id,
  contests.advertiser_id,
  contests.title,
  contests.platform,
  contests.start_date,
  contests.end_date,
  contests.thumbnail_url,
  contests.resources,
  contests.category,
  contests.inspiration_links,
  contests.tracking_links,
  contests.created_at,
  contests.subscription_info_of_user,
  contests.updated_at,
  contests.contest_type,
  contests.contest_based_details,
  contests.live_submission_count,
  contests.post_contest_status,
  contests.brief_html,
  contests.brief_json,
  contests.last_metrics_updated,
  contests.rules_html,
  contests.rules_json,
  contests.moderation_status,
  contests.submitted_for_approval_at,
  contests.approved_at,
  contests.approved_by,
  contests.published_at,
  contests.rejection_reason,
  contests.payment_details,
  CASE
    WHEN contests.moderation_status <> 'published'::contest_moderation_status_enum THEN NULL::text
    WHEN contests.start_date IS NULL OR contests.end_date IS NULL THEN 'incomplete'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.start_date
    AND (now() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status,
  contests.views_locked_at,
  contests.multiple_submissions_enabled,
  contests.max_submissions_per_creator,
  contests.content_type,
  contests.bonus_details,
  contests.max_earnings_per_creator,
  contests.categories,
  contests.subcategories,
  contests.interests,
  contests.region,
  contests.contest_format
FROM
  contests;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify the migration was successful:

-- Check tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name LIKE 'twitter_%' 
-- ORDER BY table_name;

-- Check indexes:
-- SELECT indexname FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND indexname LIKE 'idx_twitter_%' 
-- ORDER BY indexname;

-- Check columns on creator_profiles:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'creator_profiles' 
-- AND column_name = 'twitter_account';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
