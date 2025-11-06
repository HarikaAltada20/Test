-- Backfill NULL values in other_earnings column to 0 for existing rows
-- This migration fixes any NULL values that may exist from before the column was properly set up
DO $$
BEGIN
  -- Check if column exists first
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'other_earnings'
  ) THEN
    -- Update all rows where other_earnings is NULL to 0
    UPDATE public.users
    SET other_earnings = 0
    WHERE other_earnings IS NULL;
    
    -- Ensure the column has a default value for future inserts
    ALTER TABLE public.users
      ALTER COLUMN other_earnings SET DEFAULT 0;
    
    -- Try to add NOT NULL constraint (only if column is nullable)
    -- This will work if the column currently allows NULLs
    BEGIN
      ALTER TABLE public.users
        ALTER COLUMN other_earnings SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      -- If it fails (e.g., constraint already exists or column already has NOT NULL), just continue
      RAISE NOTICE 'Column other_earnings constraint status: %', SQLERRM;
    END;
  END IF;
END $$;

