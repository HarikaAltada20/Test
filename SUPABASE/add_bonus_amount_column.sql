-- Migration: Add bonus_amount column to submissions table
-- Description: Stores the actual bonus amount paid for each submission (in cents)
-- Date: 2025-10-07

-- Add bonus_amount column to submissions table
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS bonus_amount INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.submissions.bonus_amount IS 'Flat fee bonus amount paid for this submission (in cents). Separate from CPM earnings.';

-- Update existing records where bonus was paid to set bonus_amount
-- This is a one-time backfill based on current contest settings
-- Run this carefully in production after verifying the flat_fee_bonus values

-- Example backfill query (run this separately after reviewing contest settings):
-- UPDATE public.submissions s
-- SET bonus_amount = COALESCE(
--   (c.contest_based_details->'cpm_contest'->>'flat_fee_bonus')::integer,
--   (c.contest_based_details->'leaderboard_contest'->>'flat_fee_bonus')::integer,
--   0
-- )
-- FROM public.contests c
-- WHERE s.contest_id = c.id
-- AND s.bonus_paid = true
-- AND s.bonus_amount = 0;

-- Create index for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_submissions_bonus_amount 
ON public.submissions(bonus_amount) 
WHERE bonus_amount > 0;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'submissions' 
AND column_name = 'bonus_amount';

