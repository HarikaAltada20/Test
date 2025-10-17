-- Backfill creator metrics with correct values
-- This script recalculates all creator metrics from existing data

-- ============================================================================
-- 1. Backfill total_submissions_made
-- ============================================================================

UPDATE public.creator_profiles cp
SET total_submissions_made = (
  SELECT COUNT(*)
  FROM public.submissions s
  WHERE s.creator_id = cp.id
);

-- ============================================================================
-- 2. Backfill total_contests_participated (count distinct contests)
-- ============================================================================

UPDATE public.creator_profiles cp
SET total_contests_participated = (
  SELECT COUNT(DISTINCT s.contest_id)
  FROM public.submissions s
  WHERE s.creator_id = cp.id
);

-- ============================================================================
-- 3. Backfill total_submissions_won (count paid submissions)
-- ============================================================================

UPDATE public.creator_profiles cp
SET total_submissions_won = (
  SELECT COUNT(*)
  FROM public.submissions s
  WHERE s.creator_id = cp.id
    AND s.status = 'paid'
);

-- ============================================================================
-- 4. Backfill total_contests_won (count distinct contests with at least one paid submission)
-- ============================================================================

-- First, ensure creator_contest_wins table has correct data
TRUNCATE public.creator_contest_wins;

INSERT INTO public.creator_contest_wins (creator_id, contest_id, first_win_submission_id, created_at)
SELECT 
  s.creator_id,
  s.contest_id,
  (
    SELECT id 
    FROM public.submissions 
    WHERE creator_id = s.creator_id 
      AND contest_id = s.contest_id 
      AND status = 'paid'
    ORDER BY created_at ASC
    LIMIT 1
  ) as first_win_submission_id,
  MIN(s.created_at) as created_at
FROM public.submissions s
WHERE s.status = 'paid'
GROUP BY s.creator_id, s.contest_id
ON CONFLICT (creator_id, contest_id) DO NOTHING;

-- Now update total_contests_won from creator_contest_wins
UPDATE public.creator_profiles cp
SET total_contests_won = (
  SELECT COUNT(*)
  FROM public.creator_contest_wins ccw
  WHERE ccw.creator_id = cp.id
);

-- ============================================================================
-- 5. Ensure no NULL values (set to 0 if NULL)
-- ============================================================================

UPDATE public.creator_profiles
SET 
  total_submissions_made = COALESCE(total_submissions_made, 0),
  total_submissions_won = COALESCE(total_submissions_won, 0),
  total_contests_participated = COALESCE(total_contests_participated, 0),
  total_contests_won = COALESCE(total_contests_won, 0)
WHERE 
  total_submissions_made IS NULL
  OR total_submissions_won IS NULL
  OR total_contests_participated IS NULL
  OR total_contests_won IS NULL;

-- ============================================================================
-- 6. Display summary of updated metrics
-- ============================================================================

SELECT 
  COUNT(*) as total_creators,
  SUM(total_submissions_made) as total_submissions_made,
  SUM(total_submissions_won) as total_submissions_won,
  SUM(total_contests_participated) as total_contests_participated,
  SUM(total_contests_won) as total_contests_won
FROM public.creator_profiles;

-- Show creators with metrics
SELECT 
  u.username,
  cp.total_submissions_made,
  cp.total_submissions_won,
  cp.total_contests_participated,
  cp.total_contests_won
FROM public.creator_profiles cp
JOIN public.users u ON u.id = cp.id
WHERE cp.total_submissions_made > 0
ORDER BY cp.total_submissions_made DESC
LIMIT 20;

