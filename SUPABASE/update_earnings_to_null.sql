-- Migration: Update earnings column to use NULL as default
-- This makes the logic much cleaner: NULL = not calculated, 0 = didn't win, >0 = won

-- Step 1: Update the column default
ALTER TABLE submissions ALTER COLUMN earnings DROP DEFAULT;
ALTER TABLE submissions ALTER COLUMN earnings SET DEFAULT NULL;

-- Step 2: Update existing verified submissions that have earnings = 0 to NULL
-- This assumes that if a contest hasn't reached payouts_processed stage, 
-- earnings = 0 means "not calculated yet" rather than "didn't win"
UPDATE submissions 
SET earnings = NULL 
WHERE earnings = 0 
  AND status = 'verified' 
  AND contest_id IN (
    SELECT id FROM contests 
    WHERE post_contest_status IS NULL 
       OR post_contest_status != 'payouts_processed'
  );

-- Step 3: Verify the changes
-- Check how many submissions now have NULL earnings
SELECT 
  status,
  COUNT(*) as total_submissions,
  COUNT(CASE WHEN earnings IS NULL THEN 1 END) as null_earnings,
  COUNT(CASE WHEN earnings = 0 THEN 1 END) as zero_earnings,
  COUNT(CASE WHEN earnings > 0 THEN 1 END) as positive_earnings
FROM submissions 
GROUP BY status; 