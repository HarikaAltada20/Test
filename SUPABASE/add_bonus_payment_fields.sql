-- Add bonus payment tracking fields to submissions table
-- Migration: Add paid, paid_at, bonus_paid, bonus_paid_at columns

-- Add paid field (tracks if CPM/leaderboard earnings have been paid)
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE NOT NULL;

-- Add paid_at timestamp
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add bonus_paid field (tracks if flat fee bonus has been paid)
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS bonus_paid BOOLEAN DEFAULT FALSE NOT NULL;

-- Add bonus_paid_at timestamp
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS bonus_paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for paid status queries
CREATE INDEX IF NOT EXISTS idx_submissions_paid ON public.submissions(paid);

-- Create index for bonus_paid status queries
CREATE INDEX IF NOT EXISTS idx_submissions_bonus_paid ON public.submissions(bonus_paid);

-- Create composite index for contest payment queries
CREATE INDEX IF NOT EXISTS idx_submissions_contest_paid ON public.submissions(contest_id, paid, bonus_paid);

-- Add comment to explain the fields
COMMENT ON COLUMN public.submissions.paid IS 'Indicates if CPM/leaderboard earnings have been paid to creator';
COMMENT ON COLUMN public.submissions.paid_at IS 'Timestamp when CPM/leaderboard earnings were paid';
COMMENT ON COLUMN public.submissions.bonus_paid IS 'Indicates if flat fee bonus has been paid to creator';
COMMENT ON COLUMN public.submissions.bonus_paid_at IS 'Timestamp when flat fee bonus was paid';

