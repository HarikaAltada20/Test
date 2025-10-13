-- Migration script to populate new metrics columns with existing data
-- Run this after adding the new columns and tables

-- 1. Populate total_submissions_made from existing submissions
UPDATE public.creator_profiles 
SET total_submissions_made = (
  SELECT COUNT(*) 
  FROM public.submissions 
  WHERE submissions.creator_id = creator_profiles.id
)
WHERE EXISTS (
  SELECT 1 FROM public.submissions WHERE submissions.creator_id = creator_profiles.id
);

-- 2. Populate total_submissions_won from existing paid submissions
UPDATE public.creator_profiles 
SET total_submissions_won = (
  SELECT COUNT(*) 
  FROM public.submissions 
  WHERE submissions.creator_id = creator_profiles.id 
  AND submissions.status = 'paid'
)
WHERE EXISTS (
  SELECT 1 FROM public.submissions 
  WHERE submissions.creator_id = creator_profiles.id 
  AND submissions.status = 'paid'
);

-- 3. Populate creator_contest_wins from existing paid submissions
-- This ensures contest-level wins are tracked correctly
INSERT INTO public.creator_contest_wins (creator_id, contest_id, first_win_submission_id)
SELECT DISTINCT 
  s.creator_id, 
  s.contest_id, 
  (SELECT id FROM public.submissions s2 
   WHERE s2.creator_id = s.creator_id 
   AND s2.contest_id = s.contest_id 
   AND s2.status = 'paid' 
   ORDER BY s2.created_at ASC 
   LIMIT 1) as first_win_submission_id
FROM public.submissions s
WHERE s.status = 'paid'
GROUP BY s.creator_id, s.contest_id
ON CONFLICT (creator_id, contest_id) DO NOTHING;

-- Note: We no longer need to populate creator_contest_participations
-- because participations are calculated dynamically from submissions table

-- 4. Update total_contests_won to reflect actual contest wins (not submission wins)
-- This fixes the issue where multiple submissions winning counted as multiple contest wins
UPDATE public.creator_profiles 
SET total_contests_won = (
  SELECT COUNT(*) 
  FROM public.creator_contest_wins 
  WHERE creator_contest_wins.creator_id = creator_profiles.id
)
WHERE EXISTS (
  SELECT 1 FROM public.creator_contest_wins 
  WHERE creator_contest_wins.creator_id = creator_profiles.id
);

-- 5. Reset total_contests_won to 0 for creators who don't have any contest wins
UPDATE public.creator_profiles 
SET total_contests_won = 0
WHERE total_contests_won IS NULL OR total_contests_won = 0;

-- 6. Ensure total_submissions_made and total_submissions_won are not NULL
UPDATE public.creator_profiles 
SET 
  total_submissions_made = COALESCE(total_submissions_made, 0),
  total_submissions_won = COALESCE(total_submissions_won, 0);

-- 7. Verify the migration results
SELECT 
  'Migration Summary' as info,
  COUNT(*) as total_creators,
  SUM(total_submissions_made) as total_submissions_made,
  SUM(total_submissions_won) as total_submissions_won,
  SUM(total_contests_participated) as total_contests_participated,
  SUM(total_contests_won) as total_contests_won
FROM public.creator_profiles;

-- 8. Show some sample data to verify correctness
SELECT 
  'Sample Creator Data' as info,
  id,
  total_submissions_made,
  total_submissions_won,
  total_contests_participated,
  total_contests_won
FROM public.creator_profiles 
WHERE total_submissions_made > 0 
LIMIT 5;
