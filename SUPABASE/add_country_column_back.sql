-- Add country column back to users table
-- This column stores the user's country detected from IP address
-- The country column was previously dropped in migrate_region_to_jsonb.sql
-- but we need it back to store country separately from region

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS country text NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.users.country IS 'User''s country detected from IP address (e.g., "United States", "India")';

-- Create index for efficient country-based queries
CREATE INDEX IF NOT EXISTS idx_users_country ON public.users USING btree (country) WHERE country IS NOT NULL;

