-- Create ENUM for Contest Type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_type_enum') THEN
        CREATE TYPE public.contest_type_enum AS ENUM ('leaderboard', 'cpm');
    END IF;
END$$;

-- Create ENUM for Submission Status if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status_enum') THEN
        CREATE TYPE public.submission_status_enum AS ENUM ('pending', 'verified', 'rejected', 'paid');
    END IF;
END$$;

-- Modify public.contests table
ALTER TABLE public.contests
ADD COLUMN IF NOT EXISTS contest_type public.contest_type_enum,
ADD COLUMN IF NOT EXISTS contest_based_details JSONB;

-- Drop old leaderboard-specific columns. 
-- Using CASCADE to also drop dependent objects like the 'contests_with_status' view.
-- This view will likely need to be recreated or adjusted based on the new schema.
ALTER TABLE public.contests
DROP COLUMN IF EXISTS prizes CASCADE,
DROP COLUMN IF EXISTS total_prize CASCADE,
DROP COLUMN IF EXISTS winner_count CASCADE;

-- Optional: If inspiration_links currently stores a single text but should store multiple,
-- you might want to change its type to JSONB. Example (uncomment and adapt if needed):
-- ALTER TABLE public.contests
--   ALTER COLUMN inspiration_links TYPE JSONB USING jsonb_build_array(inspiration_links::text);
-- For now, assuming inspiration_links as text (or already JSONB) is acceptable.

-- Modify public.submissions table
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS earnings NUMERIC(10, 2) DEFAULT 0.00, -- Assuming precision 10, scale 2 for currency
ADD COLUMN IF NOT EXISTS last_insights_update TIMESTAMPTZ;

-- Drop the old text-based status column if it exists
-- This is safe if you are okay with cleaning existing submission statuses as per testing environment.
-- For production with existing data, a more careful data migration would be needed.
ALTER TABLE public.submissions
DROP COLUMN IF EXISTS status;

-- Add the new enum-based status column
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS status public.submission_status_enum DEFAULT 'pending';

-- The column 'is_verified BOOLEAN' from your provided schema for 'submissions' (supabase/migrations/20250524072600_remote_schema.sql)
-- already exists. The 'submission_status_enum' includes a 'verified' state, which can be used in conjunction
-- with 'is_verified'. Your admin verification workflow would update both as necessary.
-- For example, setting status to 'verified' and is_verified to TRUE.

-- Ensure views and earnings columns are compatible (they likely are based on schema but good to be explicit if needed)
-- For example, if earnings needed a specific precision:
-- ALTER TABLE public.submissions
-- ALTER COLUMN earnings TYPE NUMERIC(10, 2);
-- The existing schema has NUMERIC for earnings and INTEGER for views, which are fine. 

-- Add a view that includes contest status
CREATE OR REPLACE VIEW contests_with_status AS
SELECT
  *,
  CASE
    WHEN is_draft THEN 'Draft'
    WHEN NOW() < start_date THEN 'Upcoming'
    WHEN NOW() >= start_date AND NOW() < end_date THEN 'Active'
    WHEN NOW() >= end_date THEN 'Ended'
    ELSE 'Unknown' -- Should ideally not happen with valid dates
  END AS status
FROM
  contests; 