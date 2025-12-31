-- ============================================================================
-- Migration: Move Twitter fields from columns to contest_based_details JSONB
-- Date: 2025-01-XX
-- Description: Migrates twitter_targets, twitter_keywords, twitter_mentions
--              from direct columns to contest_based_details.twitter_campaign
-- ============================================================================

-- ============================================================================
-- 1. MIGRATE EXISTING DATA (if any exists)
-- ============================================================================
-- Update contests that have Twitter data in columns to JSONB structure

UPDATE public.contests
SET contest_based_details = COALESCE(contest_based_details, '{}'::jsonb) ||
  jsonb_build_object(
    'twitter_campaign',
    jsonb_build_object(
      'campaign_type', 
      CASE 
        WHEN content_type = 'raid' THEN 'raid'
        WHEN content_type = 'awareness' THEN 'awareness'
      END,
      'keywords', COALESCE(twitter_keywords, ARRAY[]::text[]),
      'mentions', COALESCE(twitter_mentions, ARRAY[]::text[]),
      'raid_target', 
      CASE 
        WHEN twitter_targets IS NOT NULL THEN twitter_targets
        ELSE NULL
      END
    )
  )
WHERE (
  twitter_keywords IS NOT NULL 
  OR twitter_mentions IS NOT NULL 
  OR twitter_targets IS NOT NULL
)
AND (contest_based_details->'twitter_campaign') IS NULL;

-- ============================================================================
-- 2. CREATE PERFORMANCE INDEXES FOR JSONB QUERIES
-- ============================================================================

-- GIN index for entire twitter_campaign object (for existence checks)
CREATE INDEX IF NOT EXISTS idx_contests_twitter_campaign 
ON public.contests USING GIN ((contest_based_details->'twitter_campaign'));

-- GIN index for keywords array (for filtering/searching)
CREATE INDEX IF NOT EXISTS idx_contests_twitter_keywords 
ON public.contests USING GIN ((contest_based_details->'twitter_campaign'->'keywords'));

-- GIN index for mentions array (for filtering/searching)
CREATE INDEX IF NOT EXISTS idx_contests_twitter_mentions 
ON public.contests USING GIN ((contest_based_details->'twitter_campaign'->'mentions'));

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
-- 2.5. DROP VIEW (to remove dependency before dropping columns)
-- ============================================================================

DROP VIEW IF EXISTS public.contests_with_status;

-- ============================================================================
-- 2.6. DROP REDUNDANT campaign_content_type (if it exists)
-- ============================================================================
-- campaign_content_type is redundant with contest_format (both store 'video' or 'text_image')
-- contest_format is the source of truth used in the codebase

DROP INDEX IF EXISTS idx_contests_campaign_content_type;
ALTER TABLE public.contests DROP COLUMN IF EXISTS campaign_content_type;

-- ============================================================================
-- 3. DROP OLD COLUMNS (twitter_* on contests)
-- ============================================================================
-- We now treat contest_based_details.twitter_campaign as the single source of
-- truth for Twitter campaign configuration. There is no runtime code
-- depending on the legacy twitter_* columns on contests, so we can safely
-- drop them. These statements are idempotent via IF EXISTS.

ALTER TABLE public.contests DROP COLUMN IF EXISTS twitter_targets;
ALTER TABLE public.contests DROP COLUMN IF EXISTS twitter_keywords;
ALTER TABLE public.contests DROP COLUMN IF EXISTS twitter_mentions;

-- ============================================================================
-- 3.5. RECREATE VIEW (without Twitter columns and campaign_content_type)
-- ============================================================================

CREATE VIEW public.contests_with_status WITH (security_invoker='on') AS
SELECT
  id,
  advertiser_id,
  title,
  platform,
  start_date,
  end_date,
  thumbnail_url,
  resources,
  category,
  inspiration_links,
  tracking_links,
  created_at,
  subscription_info_of_user,
  updated_at,
  contest_type,
  contest_based_details,
  live_submission_count,
  post_contest_status,
  brief_html,
  brief_json,
  last_metrics_updated,
  rules_html,
  rules_json,
  moderation_status,
  submitted_for_approval_at,
  approved_at,
  approved_by,
  published_at,
  rejection_reason,
  payment_details,
  CASE
    WHEN moderation_status <> 'published'::contest_moderation_status_enum THEN NULL::text
    WHEN start_date IS NULL
    OR end_date IS NULL THEN 'incomplete'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) < start_date THEN 'upcoming'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= start_date
    AND (now() AT TIME ZONE 'UTC'::text) < end_date THEN 'active'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status,
  views_locked_at,
  multiple_submissions_enabled,
  max_submissions_per_creator,
  content_type,
  bonus_details,
  max_earnings_per_creator,
  categories,
  subcategories,
  interests,
  region,
  contest_format
  -- NOTE: twitter_targets, twitter_keywords, twitter_mentions removed
  -- NOTE: campaign_content_type removed (redundant with contest_format)
  -- Twitter data is now in contest_based_details.twitter_campaign JSONB
FROM
  contests;

-- ============================================================================
-- 4. UPDATE COLUMN COMMENTS
-- ============================================================================

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
    "campaign_type": "raid"|"awareness",
    
    // For keyword/hashtag campaigns:
    "keywords": ["keyword1", "keyword2"],
    "mentions": ["@mention1", "@mention2"],
    "keywords_requirement_mode": "all" | "any",  // Optional
    "mentions_requirement_mode": "all" | "any",  // Optional
    
    // For raid/awareness campaigns:
    "raid_target": {
      "link": "https://x.com/user/status/1234567890",
      "description": "Optional description",
      "metrics": {
        "likes": 1000,
        "comments": 100,
        "retweets": 500,
        "quote_reposts": 200
      },
      "keywords_requirement_mode": "",  // Empty for raid campaigns
      "mentions_requirement_mode": ""   // Empty for raid campaigns
    }
  }
}';

-- ============================================================================
-- 5. HELPER FUNCTIONS FOR JSONB QUERIES (Optional but recommended)
-- ============================================================================

-- Function to get Twitter keywords from contest
CREATE OR REPLACE FUNCTION get_twitter_keywords(contest_id UUID)
RETURNS TEXT[] AS $$
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(contest_based_details->'twitter_campaign'->'keywords')
  )
  FROM public.contests
  WHERE id = contest_id;
$$ LANGUAGE SQL STABLE;

-- Function to get Twitter mentions from contest
CREATE OR REPLACE FUNCTION get_twitter_mentions(contest_id UUID)
RETURNS TEXT[] AS $$
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(contest_based_details->'twitter_campaign'->'mentions')
  )
  FROM public.contests
  WHERE id = contest_id;
$$ LANGUAGE SQL STABLE;

-- Function to get Twitter campaign type
CREATE OR REPLACE FUNCTION get_twitter_campaign_type(contest_id UUID)
RETURNS TEXT AS $$
  SELECT contest_based_details->'twitter_campaign'->>'campaign_type'
  FROM public.contests
  WHERE id = contest_id;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

