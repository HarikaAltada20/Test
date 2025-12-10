-- ============================================================================
-- Twitter Integration Setup Verification Script
-- Date: 2025-01-XX
-- Description: Run this script to verify Twitter integration is set up correctly
-- ============================================================================

-- ============================================================================
-- 1. CHECK TABLES EXIST
-- ============================================================================

SELECT 
  'Tables Check' as check_type,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ All tables exist'
    ELSE '❌ Missing tables: ' || (3 - COUNT(*))::text || ' missing'
  END as status,
  COUNT(*) as tables_found
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'twitter_campaign_participants',
    'twitter_campaign_tweets',
    'twitter_campaign_leaderboard'
  );

-- ============================================================================
-- 2. CHECK COLUMNS ADDED TO EXISTING TABLES
-- ============================================================================

-- Check creator_profiles.twitter_account
SELECT 
  'Creator Profiles Column' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'creator_profiles' 
        AND column_name = 'twitter_account'
    ) THEN '✅ twitter_account column exists'
    ELSE '❌ twitter_account column missing'
  END as status;

-- Check contests.campaign_content_type
SELECT 
  'Contests Column' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'contests' 
        AND column_name = 'campaign_content_type'
    ) THEN '✅ campaign_content_type column exists'
    ELSE '❌ campaign_content_type column missing'
  END as status;

-- ============================================================================
-- 3. CHECK INDEXES
-- ============================================================================

SELECT 
  'Indexes Check' as check_type,
  COUNT(*) as indexes_found,
  CASE 
    WHEN COUNT(*) >= 15 THEN '✅ All indexes created'
    ELSE '⚠️ Some indexes may be missing (expected ~15)'
  END as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND (
    tablename LIKE 'twitter_%' 
    OR indexname LIKE 'idx_twitter_%'
    OR indexname LIKE 'idx_contests_campaign_content_type'
  );

-- ============================================================================
-- 4. CHECK FUNCTIONS & TRIGGERS
-- ============================================================================

-- Check functions
SELECT 
  'Functions Check' as check_type,
  COUNT(*) as functions_found,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ Functions exist'
    ELSE '⚠️ Some functions may be missing'
  END as status
FROM pg_proc 
WHERE proname IN (
  'update_twitter_tweet_updated_at',
  'increment_participant_tweet_count'
);

-- Check triggers
SELECT 
  'Triggers Check' as check_type,
  COUNT(*) as triggers_found,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✅ Triggers exist'
    ELSE '⚠️ Some triggers may be missing'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'twitter_campaign_tweets'
  AND t.tgname IN (
    'update_twitter_tweets_updated_at',
    'increment_participant_tweet_count_trigger'
  );

-- ============================================================================
-- 5. CHECK TEST DATA (if seeded)
-- ============================================================================

SELECT 
  'Test Data Check' as check_type,
  (SELECT COUNT(*) FROM contests WHERE platform = 'twitter') as twitter_contests,
  (SELECT COUNT(*) FROM twitter_campaign_participants) as participants,
  (SELECT COUNT(*) FROM twitter_campaign_tweets) as tweets,
  (SELECT COUNT(*) FROM twitter_campaign_leaderboard) as leaderboard_entries,
  CASE 
    WHEN (SELECT COUNT(*) FROM contests WHERE platform = 'twitter') > 0 
      THEN '✅ Test data found'
    ELSE '⚠️ No test data (run seed_twitter_test_data.sql)'
  END as status;

-- ============================================================================
-- 6. CHECK CONSTRAINTS
-- ============================================================================

SELECT 
  'Constraints Check' as check_type,
  COUNT(*) as unique_constraints,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ Unique constraints exist'
    ELSE '⚠️ Some constraints may be missing'
  END as status
FROM information_schema.table_constraints
WHERE constraint_type = 'UNIQUE'
  AND table_schema = 'public'
  AND (
    table_name LIKE 'twitter_%'
    OR constraint_name LIKE '%twitter%'
  );

-- ============================================================================
-- 7. SUMMARY REPORT
-- ============================================================================

SELECT 
  '=== SUMMARY ===' as summary,
  '' as details;

SELECT 
  'Total Twitter Tables' as metric,
  COUNT(*)::text as value
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'twitter_%';

SELECT 
  'Total Twitter Indexes' as metric,
  COUNT(*)::text as value
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename LIKE 'twitter_%';

SELECT 
  'Twitter Contests Created' as metric,
  COUNT(*)::text as value
FROM contests 
WHERE platform = 'twitter';

SELECT 
  'Test Participants' as metric,
  COUNT(*)::text as value
FROM twitter_campaign_participants;

SELECT 
  'Test Tweets Tracked' as metric,
  COUNT(*)::text as value
FROM twitter_campaign_tweets;

SELECT 
  'Leaderboard Entries' as metric,
  COUNT(*)::text as value
FROM twitter_campaign_leaderboard;

-- ============================================================================
-- 8. SAMPLE QUERIES TO TEST FUNCTIONALITY
-- ============================================================================

-- Get all Twitter campaigns
-- SELECT id, title, platform, campaign_content_type, moderation_status
-- FROM contests 
-- WHERE platform = 'twitter';

-- Get participants for a campaign
-- SELECT 
--   p.*,
--   u.username,
--   u.full_name
-- FROM twitter_campaign_participants p
-- JOIN users u ON u.id = p.creator_id
-- WHERE p.contest_id = 'YOUR_CONTEST_ID';

-- Get eligible tweets with points
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
-- WHERE contest_id = 'YOUR_CONTEST_ID'
--   AND is_eligible = true
-- ORDER BY points DESC;

-- Get leaderboard
-- SELECT 
--   l.*,
--   u.username,
--   u.full_name
-- FROM twitter_campaign_leaderboard l
-- JOIN users u ON u.id = l.creator_id
-- WHERE l.contest_id = 'YOUR_CONTEST_ID'
-- ORDER BY l.total_points DESC;
