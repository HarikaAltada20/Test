-- Migrate user region column from text to JSONB format
-- This migration converts the existing region (text) and country (text) columns
-- into a single region JSONB column with format: { "Region Name": ["Country"] }
-- Example: { "North America": ["United States"] }

-- Step 1: Create a temporary column to store the JSONB data
ALTER TABLE public.users
ADD COLUMN region_jsonb jsonb NULL;

-- Step 2: Convert existing country/region data to JSONB format
-- Only convert rows where both region and country are valid
UPDATE public.users
SET region_jsonb = jsonb_build_object(users.region, ARRAY[users.country])
WHERE region IS NOT NULL 
  AND country IS NOT NULL 
  AND region::text != 'null'
  AND country::text != 'null'
  AND trim(region::text) != ''
  AND trim(country::text) != '';

-- Step 3: Drop the old columns and rename the new one
ALTER TABLE public.users
DROP COLUMN IF EXISTS country,
DROP COLUMN IF EXISTS region;

ALTER TABLE public.users
RENAME COLUMN region_jsonb TO region;

-- Step 4: Update column comment
COMMENT ON COLUMN public.users.region IS 'User''s region and country stored as JSONB object where keys are region names and values are arrays of country names. Example: {"North America": ["United States"]}';

-- Step 5: Update indexes
-- Drop old indexes
DROP INDEX IF EXISTS idx_users_region;
DROP INDEX IF EXISTS idx_users_country;

-- Create new GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_region ON public.users USING gin (region) WHERE region IS NOT NULL;

