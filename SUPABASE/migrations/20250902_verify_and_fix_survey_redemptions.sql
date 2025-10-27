-- Verify and fix survey_redemptions table structure
-- Run this to check if migration was applied correctly

-- Step 1: Check if columns exist
DO $$
DECLARE
  button_clicked_exists BOOLEAN;
  reward_claimed_exists BOOLEAN;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'survey_redemptions'
      AND column_name = 'survey_button_clicked'
  ) INTO button_clicked_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'survey_redemptions'
      AND column_name = 'survey_reward_claimed'
  ) INTO reward_claimed_exists;
  
  IF NOT button_clicked_exists OR NOT reward_claimed_exists THEN
    RAISE NOTICE '⚠️ Columns missing! Applying migration...';
    
    -- Add columns if they don't exist
    ALTER TABLE public.survey_redemptions
      ADD COLUMN IF NOT EXISTS survey_button_clicked BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS survey_reward_claimed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS survey_button_clicked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS survey_reward_claimed_at TIMESTAMPTZ;
    
    -- Set NOT NULL constraints
    ALTER TABLE public.survey_redemptions
      ALTER COLUMN survey_button_clicked SET NOT NULL,
      ALTER COLUMN survey_reward_claimed SET NOT NULL,
      ALTER COLUMN survey_button_clicked SET DEFAULT false,
      ALTER COLUMN survey_reward_claimed SET DEFAULT false;
    
    RAISE NOTICE '✅ Columns added successfully!';
  ELSE
    RAISE NOTICE '✅ Columns already exist';
  END IF;
END $$;

-- Step 2: Clean up any NULL or invalid values
UPDATE public.survey_redemptions
SET 
  survey_button_clicked = COALESCE(survey_button_clicked, false),
  survey_reward_claimed = COALESCE(survey_reward_claimed, false)
WHERE survey_button_clicked IS NULL 
   OR survey_reward_claimed IS NULL;

-- Step 3: Verify table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'survey_redemptions'
ORDER BY ordinal_position;

