-- Verification Queries for Phase 1 Migration
-- Run these after applying add_new_contest_features.sql

-- =====================================================
-- 1. Verify New Columns Exist
-- =====================================================
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'contests'
  AND column_name IN (
    'multiple_submissions_enabled',
    'max_submissions_per_creator',
    'content_type',
    'bonus_details',
    'max_earnings_per_creator'
  )
ORDER BY column_name;

-- Expected: 5 rows showing all new columns

-- =====================================================
-- 2. Verify Indexes Were Created
-- =====================================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'contests'
  AND indexname IN (
    'idx_contests_content_type',
    'idx_contests_multiple_submissions'
  );

-- Expected: 2 rows showing the new indexes

-- =====================================================
-- 3. Check Existing Contests (Backward Compatibility)
-- =====================================================
SELECT 
  id,
  title,
  contest_type,
  moderation_status,
  multiple_submissions_enabled,
  max_submissions_per_creator,
  content_type,
  CASE 
    WHEN bonus_details IS NULL THEN 'NULL'
    ELSE 'HAS DATA'
  END as bonus_status,
  max_earnings_per_creator,
  created_at
FROM contests
ORDER BY created_at DESC
LIMIT 10;

-- Expected: All existing contests have safe defaults:
-- - multiple_submissions_enabled = false
-- - max_submissions_per_creator = 1
-- - content_type = NULL
-- - bonus_details = NULL
-- - max_earnings_per_creator = NULL

-- =====================================================
-- 4. Verify contest_based_details Structure (Sample)
-- =====================================================
SELECT 
  id,
  title,
  contest_type,
  contest_based_details
FROM contests
WHERE contest_type = 'leaderboard'
  AND moderation_status = 'published'
LIMIT 3;

-- Check structure is intact for existing contests

SELECT 
  id,
  title,
  contest_type,
  contest_based_details
FROM contests
WHERE contest_type = 'cpm'
  AND moderation_status = 'published'
LIMIT 3;

-- =====================================================
-- 5. Test Query: Find Contests with Multiple Submissions
-- =====================================================
SELECT 
  id,
  title,
  multiple_submissions_enabled,
  max_submissions_per_creator
FROM contests
WHERE multiple_submissions_enabled = true;

-- Expected: Empty or new contests only (after testing)

-- =====================================================
-- 6. Test Query: Find Contests with Flat Fee Bonus
-- =====================================================
-- Leaderboard contests
SELECT 
  id,
  title,
  contest_type,
  (contest_based_details->'leaderboard_contest'->>'flat_fee_bonus')::integer as flat_fee_cents
FROM contests
WHERE contest_type = 'leaderboard'
  AND contest_based_details->'leaderboard_contest'->'flat_fee_bonus' IS NOT NULL;

-- CPM contests
SELECT 
  id,
  title,
  contest_type,
  (contest_based_details->'cpm_contest'->>'flat_fee_bonus')::integer as flat_fee_cents
FROM contests
WHERE contest_type = 'cpm'
  AND contest_based_details->'cpm_contest'->'flat_fee_bonus' IS NOT NULL;

-- Expected: Empty initially (until you create test contests)

-- =====================================================
-- 7. Test Query: Find Contests by Content Type
-- =====================================================
SELECT 
  content_type,
  COUNT(*) as count
FROM contests
WHERE content_type IS NOT NULL
GROUP BY content_type
ORDER BY count DESC;

-- Expected: Empty initially

-- =====================================================
-- 8. Test Query: Find Contests with Bonus Details
-- =====================================================
SELECT 
  id,
  title,
  bonus_details->>'description_html' as bonus_html
FROM contests
WHERE bonus_details IS NOT NULL
LIMIT 5;

-- Expected: Empty initially

-- =====================================================
-- 9. Performance Check: Verify Indexes Are Used
-- =====================================================
EXPLAIN ANALYZE
SELECT *
FROM contests
WHERE content_type = 'ugc';

-- Should show "Index Scan using idx_contests_content_type"

EXPLAIN ANALYZE
SELECT *
FROM contests
WHERE multiple_submissions_enabled = true;

-- Should show "Index Scan using idx_contests_multiple_submissions"

-- =====================================================
-- 10. Count Summary
-- =====================================================
SELECT 
  COUNT(*) as total_contests,
  COUNT(*) FILTER (WHERE multiple_submissions_enabled = true) as with_multiple_submissions,
  COUNT(*) FILTER (WHERE content_type IS NOT NULL) as with_content_type,
  COUNT(*) FILTER (WHERE bonus_details IS NOT NULL) as with_bonuses,
  COUNT(*) FILTER (WHERE max_earnings_per_creator IS NOT NULL) as with_earnings_cap
FROM contests;

-- Shows adoption of new features

-- =====================================================
-- RESULTS INTERPRETATION
-- =====================================================
-- If all queries run successfully:
-- ✅ Migration successful
-- ✅ Backward compatible
-- ✅ Indexes created
-- ✅ Ready for testing

-- If any query fails:
-- ❌ Check error message
-- ❌ Verify migration SQL ran completely
-- ❌ Check Supabase logs

