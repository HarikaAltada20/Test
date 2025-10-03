-- Verification: Check that contests_with_status view includes new columns
-- Run this after executing update_contests_with_status_view.sql

-- =====================================================
-- 1. Verify View Exists
-- =====================================================
SELECT 
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE viewname = 'contests_with_status';

-- Expected: 1 row showing the view exists

-- =====================================================
-- 2. Check View Columns
-- =====================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'contests_with_status'
  AND column_name IN (
    'multiple_submissions_enabled',
    'max_submissions_per_creator',
    'content_type',
    'bonus_details',
    'max_earnings_per_creator',
    'status'  -- computed field
  )
ORDER BY column_name;

-- Expected: 6 rows showing all new columns

-- =====================================================
-- 3. Test Query on View
-- =====================================================
SELECT 
  id,
  title,
  status,
  multiple_submissions_enabled,
  max_submissions_per_creator,
  content_type,
  bonus_details,
  max_earnings_per_creator
FROM contests_with_status
ORDER BY created_at DESC
LIMIT 5;

-- Expected: Should return without errors, showing all columns

-- =====================================================
-- 4. Verify Computed Status Still Works
-- =====================================================
SELECT 
  status,
  COUNT(*) as count
FROM contests_with_status
GROUP BY status
ORDER BY count DESC;

-- Expected: Should show statuses like 'active', 'ended', 'upcoming', etc.

-- =====================================================
-- RESULTS INTERPRETATION
-- =====================================================
-- If all queries run successfully:
-- ✅ View updated successfully
-- ✅ New columns available
-- ✅ Status computation still works
-- ✅ Ready to use

-- If any query fails:
-- ❌ Check error message
-- ❌ Verify migration SQL ran completely
-- ❌ Check that add_new_contest_features.sql was run first

