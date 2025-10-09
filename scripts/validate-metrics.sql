-- Metrics System Validation Script
-- Run this after deploying the new metrics system to verify everything is working correctly

-- 1. Check if new columns exist
SELECT 
  'Schema Check' as test_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'creator_profiles' 
      AND column_name IN ('total_submissions_made', 'total_submissions_won')
    ) THEN 'PASS' 
    ELSE 'FAIL' 
  END as result;

-- 2. Check if new table exists
SELECT 
  'Table Check' as test_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'creator_contest_wins'
    ) THEN 'PASS' 
    ELSE 'FAIL' 
  END as result;

-- 3. Check if trigger exists
SELECT 
  'Trigger Check' as test_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_new_submission_increment_metrics'
    ) THEN 'PASS' 
    ELSE 'FAIL' 
  END as result;

-- 4. Check for duplicate contest wins (should be 0)
SELECT 
  'Duplicate Contest Wins Check' as test_type,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM (
        SELECT creator_id, contest_id, COUNT(*) 
        FROM creator_contest_wins 
        GROUP BY creator_id, contest_id 
        HAVING COUNT(*) > 1
      ) duplicates
    ) = 0 THEN 'PASS' 
    ELSE 'FAIL' 
  END as result;

-- 5. Check metrics consistency
SELECT 
  'Metrics Consistency Check' as test_type,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM creator_profiles cp
      WHERE cp.total_submissions_made != (
        SELECT COUNT(*) FROM submissions WHERE creator_id = cp.id
      )
      OR cp.total_submissions_won != (
        SELECT COUNT(*) FROM submissions WHERE creator_id = cp.id AND status = 'paid'
      )
    ) = 0 THEN 'PASS' 
    ELSE 'FAIL' 
  END as result;

-- 6. Check contest wins consistency
SELECT 
  'Contest Wins Consistency Check' as test_type,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM creator_profiles cp
      WHERE cp.total_contests_won != (
        SELECT COUNT(*) FROM creator_contest_wins WHERE creator_id = cp.id
      )
    ) = 0 THEN 'PASS' 
    ELSE 'FAIL' 
  END as result;

-- 7. Summary statistics
SELECT 
  'Summary Statistics' as test_type,
  'DATA' as result,
  COUNT(*) as total_creators,
  SUM(total_submissions_made) as total_submissions_made,
  SUM(total_submissions_won) as total_submissions_won,
  SUM(total_contests_participated) as total_contests_participated,
  SUM(total_contests_won) as total_contests_won
FROM creator_profiles;

-- 8. Sample data check (show first 5 creators with submissions)
SELECT 
  'Sample Data Check' as test_type,
  'DATA' as result,
  cp.id as creator_id,
  cp.total_submissions_made,
  cp.total_submissions_won,
  cp.total_contests_participated,
  cp.total_contests_won,
  (SELECT COUNT(*) FROM submissions WHERE creator_id = cp.id) as actual_submissions,
  (SELECT COUNT(*) FROM submissions WHERE creator_id = cp.id AND status = 'paid') as actual_wins,
  (SELECT COUNT(*) FROM creator_contest_wins WHERE creator_id = cp.id) as actual_contest_wins
FROM creator_profiles cp
WHERE cp.total_submissions_made > 0
ORDER BY cp.total_submissions_made DESC
LIMIT 5;

-- 9. Check for any NULL values in new columns
SELECT 
  'NULL Values Check' as test_type,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM creator_profiles 
      WHERE total_submissions_made IS NULL 
      OR total_submissions_won IS NULL
    ) = 0 THEN 'PASS' 
    ELSE 'FAIL' 
  END as result;

-- 10. Check for negative values
SELECT 
  'Negative Values Check' as test_type,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM creator_profiles 
      WHERE total_submissions_made < 0 
      OR total_submissions_won < 0
      OR total_contests_won < 0
    ) = 0 THEN 'PASS' 
    ELSE 'FAIL' 
  END as result;
