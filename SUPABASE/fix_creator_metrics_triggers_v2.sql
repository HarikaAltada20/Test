-- SCALABLE Creator Metrics Triggers - V2
-- This version is optimized for scale (1000+ contests, 100K+ submissions, 10K+ creators)
-- Updates metrics immediately when submission status changes, with full reversal support

-- ============================================================================
-- 1. Function to update total_contests_participated (SCALABLE VERSION)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_creator_contests_participated_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  existing_submission_count INTEGER;
BEGIN
  -- Check if creator already has a submission for this contest
  SELECT COUNT(*) INTO existing_submission_count
  FROM public.submissions
  WHERE creator_id = NEW.creator_id 
    AND contest_id = NEW.contest_id
    AND id != NEW.id; -- Exclude the current submission being inserted
  
  -- If this is the first submission for this contest, increment total_contests_participated
  IF existing_submission_count = 0 THEN
    UPDATE public.creator_profiles
    SET total_contests_participated = COALESCE(total_contests_participated, 0) + 1
    WHERE id = NEW.creator_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Function to increment total_submissions_made (SIMPLE INCREMENT)
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_creator_submissions_made()
RETURNS TRIGGER AS $$
BEGIN
  -- Simple increment - no need to count anything
  UPDATE public.creator_profiles 
  SET total_submissions_made = COALESCE(total_submissions_made, 0) + 1
  WHERE id = NEW.creator_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Function to handle submission wins when status changes to 'paid'
-- ============================================================================

CREATE OR REPLACE FUNCTION update_creator_wins_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  existing_contest_win BOOLEAN;
BEGIN
  -- Case 1: Status changed FROM something TO 'paid' (new win)
  IF (OLD.status IS DISTINCT FROM 'paid') AND (NEW.status = 'paid') THEN
    
    -- Increment total_submissions_won
    UPDATE public.creator_profiles
    SET total_submissions_won = COALESCE(total_submissions_won, 0) + 1
    WHERE id = NEW.creator_id;
    
    -- Check if creator already has a contest win for this contest
    SELECT EXISTS (
      SELECT 1 FROM public.creator_contest_wins
      WHERE creator_id = NEW.creator_id AND contest_id = NEW.contest_id
    ) INTO existing_contest_win;
    
    -- If no existing contest win, create one and increment total_contests_won
    IF NOT existing_contest_win THEN
      -- Insert into creator_contest_wins
      INSERT INTO public.creator_contest_wins (creator_id, contest_id, first_win_submission_id, created_at)
      VALUES (NEW.creator_id, NEW.contest_id, NEW.id, NOW())
      ON CONFLICT (creator_id, contest_id) DO NOTHING;
      
      -- Increment total_contests_won (only if insert was successful)
      IF FOUND THEN
        UPDATE public.creator_profiles
        SET total_contests_won = COALESCE(total_contests_won, 0) + 1
        WHERE id = NEW.creator_id;
      END IF;
    END IF;
    
  -- Case 2: Status changed FROM 'paid' TO something else (reversal)
  ELSIF (OLD.status = 'paid') AND (NEW.status IS DISTINCT FROM 'paid') THEN
    
    -- Decrement total_submissions_won
    UPDATE public.creator_profiles
    SET total_submissions_won = GREATEST(0, COALESCE(total_submissions_won, 0) - 1)
    WHERE id = NEW.creator_id;
    
    -- Check if this was the first (and possibly only) win for this contest
    DECLARE
      first_win_id UUID;
      other_wins_count INTEGER;
    BEGIN
      -- Get the first_win_submission_id for this contest
      SELECT first_win_submission_id INTO first_win_id
      FROM public.creator_contest_wins
      WHERE creator_id = NEW.creator_id AND contest_id = NEW.contest_id;
      
      -- If this submission was the first win, we need to handle contest win removal
      IF first_win_id = NEW.id THEN
        -- Check if there are other paid submissions for this contest
        SELECT COUNT(*) INTO other_wins_count
        FROM public.submissions
        WHERE creator_id = NEW.creator_id 
          AND contest_id = NEW.contest_id
          AND id != NEW.id
          AND status = 'paid';
        
        -- If no other wins exist, remove the contest win and decrement total_contests_won
        IF other_wins_count = 0 THEN
          DELETE FROM public.creator_contest_wins
          WHERE creator_id = NEW.creator_id AND contest_id = NEW.contest_id;
          
          UPDATE public.creator_profiles
          SET total_contests_won = GREATEST(0, COALESCE(total_contests_won, 0) - 1)
          WHERE id = NEW.creator_id;
        ELSE
          -- Update first_win_submission_id to another paid submission
          UPDATE public.creator_contest_wins
          SET first_win_submission_id = (
            SELECT id FROM public.submissions
            WHERE creator_id = NEW.creator_id 
              AND contest_id = NEW.contest_id
              AND status = 'paid'
            ORDER BY created_at ASC
            LIMIT 1
          )
          WHERE creator_id = NEW.creator_id AND contest_id = NEW.contest_id;
        END IF;
      END IF;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Drop old triggers and create new optimized ones
-- ============================================================================

-- Drop all existing submission-related triggers
DROP TRIGGER IF EXISTS on_new_submission_increment_metrics ON public.submissions;
DROP TRIGGER IF EXISTS on_new_submission_update_participation ON public.submissions;
DROP TRIGGER IF EXISTS on_submission_status_change_update_wins ON public.submissions;

-- Create trigger for submissions_made (on INSERT)
CREATE TRIGGER on_new_submission_increment_metrics
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION increment_creator_submissions_made();

-- Create trigger for contests_participated (on INSERT)
CREATE TRIGGER on_new_submission_update_participation
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_creator_contests_participated_on_insert();

-- Create trigger for wins (on UPDATE of status column)
CREATE TRIGGER on_submission_status_change_update_wins
  AFTER UPDATE OF status ON public.submissions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_creator_wins_on_status_change();

-- ============================================================================
-- 5. Grant necessary permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION increment_creator_submissions_made() TO anon;
GRANT EXECUTE ON FUNCTION increment_creator_submissions_made() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_creator_submissions_made() TO service_role;

GRANT EXECUTE ON FUNCTION update_creator_contests_participated_on_insert() TO anon;
GRANT EXECUTE ON FUNCTION update_creator_contests_participated_on_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION update_creator_contests_participated_on_insert() TO service_role;

GRANT EXECUTE ON FUNCTION update_creator_wins_on_status_change() TO anon;
GRANT EXECUTE ON FUNCTION update_creator_wins_on_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION update_creator_wins_on_status_change() TO service_role;

-- ============================================================================
-- 6. Comments for documentation
-- ============================================================================

COMMENT ON FUNCTION increment_creator_submissions_made() IS 'Increments total_submissions_made when a submission is created (O(1) operation)';
COMMENT ON FUNCTION update_creator_contests_participated_on_insert() IS 'Updates total_contests_participated by checking if this is the first submission for this contest (O(1) query)';
COMMENT ON FUNCTION update_creator_wins_on_status_change() IS 'Handles total_submissions_won and total_contests_won when submission status changes to/from paid, with full reversal support';

-- ============================================================================
-- 7. Create indexes for performance
-- ============================================================================

-- Index for checking existing submissions by creator+contest (used in participation trigger)
CREATE INDEX IF NOT EXISTS idx_submissions_creator_contest 
ON public.submissions(creator_id, contest_id);

-- Index for checking paid submissions by creator+contest (used in reversal logic)
CREATE INDEX IF NOT EXISTS idx_submissions_creator_contest_status 
ON public.submissions(creator_id, contest_id, status);

-- Index for finding earliest paid submission (used in reversal logic)
CREATE INDEX IF NOT EXISTS idx_submissions_creator_contest_created 
ON public.submissions(creator_id, contest_id, created_at);

-- Index on status column for trigger efficiency
CREATE INDEX IF NOT EXISTS idx_submissions_status 
ON public.submissions(status);

-- ============================================================================
-- PERFORMANCE NOTES:
-- ============================================================================
-- 
-- 1. total_submissions_made: O(1) - simple increment, no queries
-- 
-- 2. total_contests_participated: O(1) - single query to check if creator
--    has any other submissions for this contest (indexed lookup)
-- 
-- 3. total_submissions_won: O(1) - simple increment/decrement
-- 
-- 4. total_contests_won: O(1) or O(log n) depending on case:
--    - New win: O(1) - just check if contest_win exists (indexed)
--    - Reversal: O(log n) - may need to find next earliest paid submission
--    - Still very efficient with proper indexes
-- 
-- All operations use indexed queries, so they scale well even with
-- 100K+ submissions and 10K+ creators.

