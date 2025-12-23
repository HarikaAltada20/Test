-- ============================================================================
-- Test Data Seeding Script for Twitter Integration
-- Date: 2025-01-XX
-- Description: Creates test data for Twitter campaigns, participants, tweets, 
--              and leaderboard for development/testing purposes
-- ============================================================================
-- 
-- USAGE:
-- 1. Run this AFTER running add_twitter_integration.sql
-- 2. Make sure you have at least one advertiser and one creator user in your database
-- 3. Adjust the user IDs below to match your test users
-- ============================================================================

-- ============================================================================
-- STEP 1: Get Test User IDs (Replace with your actual test user IDs)
-- ============================================================================
-- Run these queries first to get your test user IDs, then update the variables below

-- Get an advertiser user ID:
-- SELECT id, email, username FROM users WHERE user_type = 'advertiser' LIMIT 1;

-- Get a creator user ID:
-- SELECT id, email, username FROM users WHERE user_type = 'creator' LIMIT 1;

-- ============================================================================
-- STEP 2: Set Test Variables (UPDATE THESE WITH YOUR TEST USER IDs)
-- ============================================================================

DO $$
DECLARE
  -- UPDATE THESE IDs with your actual test user IDs
  test_advertiser_id UUID := '00000000-0000-0000-0000-000000000001';  -- Replace with actual advertiser ID
  test_creator_id UUID := '00000000-0000-0000-0000-000000000002';     -- Replace with actual creator ID
  test_contest_id UUID;
BEGIN

-- ============================================================================
-- STEP 3: Create Test Twitter Campaign (Keyword/Hashtag Campaign)
-- ============================================================================

INSERT INTO public.contests (
  advertiser_id,
  title,
  platform,
  campaign_content_type,
  start_date,
  end_date,
  moderation_status,
  contest_type,
  contest_based_details,
  brief_html,
  rules_html
) VALUES (
  test_advertiser_id,
  'Test Twitter Campaign - DegenDAO Launch',
  'twitter',
  'text_image',
  NOW() - INTERVAL '1 day',  -- Started 1 day ago
  NOW() + INTERVAL '7 days',  -- Ends in 7 days
  'published',
  'leaderboard',
  jsonb_build_object(
    'twitter_campaign', jsonb_build_object(
      'campaign_type', 'raid',
      'keyword_config', jsonb_build_object(
        'keywords', jsonb_build_array('DegenDAO', 'token launch'),
        'hashtags', jsonb_build_array('#DegenDAO', '#TokenLaunch'),
        'required_mentions', jsonb_build_array('@DegenDAO'),
        'exclude_keywords', jsonb_build_array('scam', 'rug'),
        'min_engagement_threshold', 5,
        'case_sensitive', false
      ),
      'points_config', jsonb_build_object(
        'base_tweet_points', 10,
        'likes', 1,
        'replies', 5,
        'retweets', 3,
        'quote_reposts', 4,
        'impressions_multiplier', 0.001
      ),
      'auto_fetch_enabled', true,
      'fetch_interval_minutes', 15,
      'lookback_hours', 24,
      'allowed_tweet_types', jsonb_build_array('tweet', 'quote', 'retweet', 'reply')
    ),
    'leaderboard_contest', jsonb_build_object(
      'total_prize', 100000,  -- $1000 in cents
      'winner_count', 10,
      'prizes', jsonb_build_array(
        jsonb_build_object('position', 1, 'amount', 30000),
        jsonb_build_object('position', 2, 'amount', 20000),
        jsonb_build_object('position', 3, 'amount', 15000),
        jsonb_build_object('position', 4, 'amount', 10000),
        jsonb_build_object('position', 5, 'amount', 5000),
        jsonb_build_object('position', 6, 'amount', 4000),
        jsonb_build_object('position', 7, 'amount', 3000),
        jsonb_build_object('position', 8, 'amount', 2000),
        jsonb_build_object('position', 9, 'amount', 1000),
        jsonb_build_object('position', 10, 'amount', 1000)
      )
    )
  ),
  '<p>Test campaign for DegenDAO token launch. Tweet about the launch using #DegenDAO!</p>',
  '<p>1. Use hashtag #DegenDAO<br>2. Mention @DegenDAO<br>3. Minimum 5 total engagement</p>'
) RETURNING id INTO test_contest_id;

-- ============================================================================
-- STEP 4: Add Twitter Account to Creator Profile
-- ============================================================================

UPDATE public.creator_profiles
SET twitter_account = jsonb_build_object(
  'username', 'test_creator_handle',
  'name', 'Test Creator',
  'verified', false,
  'profile_picture_url', 'https://pbs.twimg.com/profile_images/default.jpg',
  'bio', 'Test creator account for Twitter integration',
  'media_count', 50,
  'tweet_count', 500,
  'following_count', 200,
  'followers_count', 1000,
  'twitter_id', '1234567890',
  'updated_at', NOW()::text
)
WHERE id = test_creator_id;

-- ============================================================================
-- STEP 5: Add Creator as Participant
-- ============================================================================

INSERT INTO public.twitter_campaign_participants (
  contest_id,
  creator_id,
  twitter_username,
  is_active,
  joined_at
) VALUES (
  test_contest_id,
  test_creator_id,
  'test_creator_handle',
  true,
  NOW() - INTERVAL '12 hours'
) ON CONFLICT (contest_id, creator_id) DO NOTHING;

-- ============================================================================
-- STEP 6: Create Test Tweets (Mix of eligible and ineligible)
-- ============================================================================

-- Eligible Tweet 1
INSERT INTO public.twitter_campaign_tweets (
  contest_id,
  creator_id,
  tweet_id,
  tweet_url,
  twitter_username,
  tweet_text,
  tweet_created_at,
  tweet_type,
  is_eligible,
  eligibility_reason,
  filter_status,
  likes,
  replies,
  retweets,
  quote_reposts,
  impressions,
  points,
  points_calculated_at
) VALUES (
  test_contest_id,
  test_creator_id,
  'tweet_001',
  'https://x.com/test_creator_handle/status/tweet_001',
  'test_creator_handle',
  'Excited for #DegenDAO token launch! @DegenDAO is going to the moon 🚀',
  NOW() - INTERVAL '10 hours',
  'tweet',
  true,
  'Contains required hashtag #DegenDAO and mention @DegenDAO',
  'eligible',
  25,
  5,
  10,
  2,
  500,
  10 + (25 * 1) + (5 * 5) + (10 * 3) + (2 * 4),  -- 10 + 25 + 25 + 30 + 8 = 98
  NOW()
);

-- Eligible Tweet 2
INSERT INTO public.twitter_campaign_tweets (
  contest_id,
  creator_id,
  tweet_id,
  tweet_url,
  twitter_username,
  tweet_text,
  tweet_created_at,
  tweet_type,
  is_eligible,
  eligibility_reason,
  filter_status,
  likes,
  replies,
  retweets,
  impressions,
  points
) VALUES (
  test_contest_id,
  test_creator_id,
  'tweet_002',
  'https://x.com/test_creator_handle/status/tweet_002',
  'test_creator_handle',
  'Just bought some #DegenDAO tokens! @DegenDAO #TokenLaunch',
  NOW() - INTERVAL '8 hours',
  'tweet',
  true,
  'Contains required keywords and hashtags',
  'eligible',
  50,
  8,
  15,
  1200,
  10 + (50 * 1) + (8 * 5) + (15 * 3)  -- 10 + 50 + 40 + 45 = 145
);

-- Ineligible Tweet (missing mention)
INSERT INTO public.twitter_campaign_tweets (
  contest_id,
  creator_id,
  tweet_id,
  tweet_url,
  twitter_username,
  tweet_text,
  tweet_created_at,
  tweet_type,
  is_eligible,
  eligibility_reason,
  filter_status,
  likes,
  replies,
  retweets,
  points
) VALUES (
  test_contest_id,
  test_creator_id,
  'tweet_003',
  'https://x.com/test_creator_handle/status/tweet_003',
  'test_creator_handle',
  'Just talking about random stuff #DegenDAO',
  NOW() - INTERVAL '6 hours',
  'tweet',
  false,
  'Missing required mention @DegenDAO',
  'filtered_out',
  3,
  0,
  1,
  0
);

-- Eligible Quote Tweet
INSERT INTO public.twitter_campaign_tweets (
  contest_id,
  creator_id,
  tweet_id,
  tweet_url,
  twitter_username,
  tweet_text,
  tweet_created_at,
  tweet_type,
  is_eligible,
  eligibility_reason,
  filter_status,
  likes,
  replies,
  retweets,
  quote_reposts,
  impressions,
  points
) VALUES (
  test_contest_id,
  test_creator_id,
  'tweet_004',
  'https://x.com/test_creator_handle/status/tweet_004',
  'test_creator_handle',
  'This is amazing! @DegenDAO #TokenLaunch https://x.com/original/status/123',
  NOW() - INTERVAL '4 hours',
  'quote',
  true,
  'Quote tweet with required hashtag and mention',
  'eligible',
  100,
  20,
  30,
  5,
  5000,
  10 + (100 * 1) + (20 * 5) + (30 * 3) + (5 * 4)  -- 10 + 100 + 100 + 90 + 20 = 320
);

-- ============================================================================
-- STEP 7: Create Leaderboard Entry
-- ============================================================================

INSERT INTO public.twitter_campaign_leaderboard (
  contest_id,
  creator_id,
  total_points,
  total_eligible_tweets,
  total_likes,
  total_replies,
  total_retweets,
  total_quote_reposts,
  total_impressions,
  current_rank,
  last_refreshed_at,
  next_refresh_available_at
) VALUES (
  test_contest_id,
  test_creator_id,
  563,  -- Sum of points from eligible tweets (98 + 145 + 320)
  3,    -- 3 eligible tweets
  175,  -- Sum of likes (25 + 50 + 100)
  33,   -- Sum of replies (5 + 8 + 20)
  55,   -- Sum of retweets (10 + 15 + 30)
  7,    -- Sum of quote reposts (2 + 5)
  6700, -- Sum of impressions (500 + 1200 + 5000)
  1,    -- Rank 1
  NOW(),
  NOW() + INTERVAL '1 hour'
) ON CONFLICT (contest_id, creator_id) 
DO UPDATE SET
  total_points = EXCLUDED.total_points,
  total_eligible_tweets = EXCLUDED.total_eligible_tweets,
  total_likes = EXCLUDED.total_likes,
  total_replies = EXCLUDED.total_replies,
  total_retweets = EXCLUDED.total_retweets,
  total_quote_reposts = EXCLUDED.total_quote_reposts,
  total_impressions = EXCLUDED.total_impressions,
  current_rank = EXCLUDED.current_rank;

RAISE NOTICE 'Test data created successfully!';
RAISE NOTICE 'Contest ID: %', test_contest_id;
RAISE NOTICE 'Creator ID: %', test_creator_id;
RAISE NOTICE 'Advertiser ID: %', test_advertiser_id;

END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify the test data was created correctly

-- Check contest
-- SELECT id, title, platform, campaign_content_type, moderation_status 
-- FROM contests 
-- WHERE platform = 'twitter' 
-- ORDER BY created_at DESC LIMIT 1;

-- Check participant
-- SELECT * FROM twitter_campaign_participants 
-- WHERE contest_id = (SELECT id FROM contests WHERE platform = 'twitter' LIMIT 1);

-- Check tweets
-- SELECT 
--   tweet_id,
--   tweet_text,
--   is_eligible,
--   filter_status,
--   points,
--   likes,
--   replies,
--   retweets
-- FROM twitter_campaign_tweets 
-- WHERE contest_id = (SELECT id FROM contests WHERE platform = 'twitter' LIMIT 1)
-- ORDER BY points DESC;

-- Check leaderboard
-- SELECT 
--   l.*,
--   u.username,
--   u.full_name
-- FROM twitter_campaign_leaderboard l
-- JOIN users u ON u.id = l.creator_id
-- WHERE contest_id = (SELECT id FROM contests WHERE platform = 'twitter' LIMIT 1)
-- ORDER BY total_points DESC;


