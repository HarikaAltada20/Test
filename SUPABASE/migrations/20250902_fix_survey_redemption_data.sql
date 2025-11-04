-- Fix any data inconsistencies in survey_redemptions table
-- Run this if you're getting type mismatch errors

-- Check current state
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  -- Verify columns exist
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'survey_redemptions'
    AND column_name IN ('survey_button_clicked', 'survey_reward_claimed');
  
  IF col_count < 2 THEN
    RAISE NOTICE 'Migration not applied yet. Please run 20250902_add_survey_redemption_tracking.sql first.';
  ELSE
    -- Clean up any NULL values
    UPDATE public.survey_redemptions
    SET 
      survey_button_clicked = COALESCE(survey_button_clicked, false),
      survey_reward_claimed = COALESCE(survey_reward_claimed, false)
    WHERE survey_button_clicked IS NULL OR survey_reward_claimed IS NULL;
    
    RAISE NOTICE 'Data cleanup completed.';
  END IF;
END $$;

