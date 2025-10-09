-- Add new metrics columns to creator_profiles table
-- This supports the new submission-based metrics system

-- Add new columns for submission tracking
ALTER TABLE public.creator_profiles 
ADD COLUMN IF NOT EXISTS total_submissions_made INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_submissions_won INTEGER DEFAULT 0;

-- Create table for contest-level wins tracking (idempotent)
-- This ensures a creator can only win a contest once, regardless of how many submissions win
CREATE TABLE IF NOT EXISTS public.creator_contest_wins (
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  first_win_submission_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (creator_id, contest_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_creator_contest_wins_creator_id 
ON public.creator_contest_wins(creator_id);

CREATE INDEX IF NOT EXISTS idx_creator_contest_wins_contest_id 
ON public.creator_contest_wins(contest_id);

-- Add comments for documentation
COMMENT ON COLUMN public.creator_profiles.total_submissions_made IS 'Total number of submissions made across all contests';
COMMENT ON COLUMN public.creator_profiles.total_submissions_won IS 'Total number of submissions that won (got paid)';
COMMENT ON TABLE public.creator_contest_wins IS 'Tracks contest-level wins to ensure idempotent counting (one win per creator per contest)';
COMMENT ON COLUMN public.creator_contest_wins.first_win_submission_id IS 'The first submission that won for this creator in this contest';

-- Create function to increment total_submissions_made when a submission is created
CREATE OR REPLACE FUNCTION increment_creator_submissions_made()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment total_submissions_made for the creator
  UPDATE public.creator_profiles 
  SET total_submissions_made = total_submissions_made + 1
  WHERE id = NEW.creator_id;
  
  -- Note: We don't need to track participations in a separate table
  -- because we can calculate it from submissions table: COUNT(DISTINCT contest_id)
  -- This is simple and accurate for our scale
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically increment submissions_made
DROP TRIGGER IF EXISTS on_new_submission_increment_metrics ON public.submissions;
CREATE TRIGGER on_new_submission_increment_metrics
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION increment_creator_submissions_made();
