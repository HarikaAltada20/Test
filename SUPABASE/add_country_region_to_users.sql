-- Add country and region columns to users table for IP-based region filtering
-- These columns store the user's detected country and region from their IP address
-- Note: ip_address column already exists in users table, so we use that instead of creating a new one

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS country text NULL,
ADD COLUMN IF NOT EXISTS region text NULL,
ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone NULL;

-- Add comments to document the columns
COMMENT ON COLUMN public.users.country IS 'User''s country detected from IP address (e.g., "United States", "India")';
COMMENT ON COLUMN public.users.region IS 'User''s region detected from IP address (e.g., "North America", "Asia")';
COMMENT ON COLUMN public.users.location_updated_at IS 'Timestamp when the user''s location (country/region) was last updated';

-- Create index for efficient region-based queries
CREATE INDEX IF NOT EXISTS idx_users_region ON public.users USING btree (region) WHERE region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_country ON public.users USING btree (country) WHERE country IS NOT NULL;

