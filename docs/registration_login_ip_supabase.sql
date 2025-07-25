-- Remove registration_ip and ip_address columns if they exist
ALTER TABLE public.users
DROP COLUMN IF EXISTS registration_ip,
DROP COLUMN IF EXISTS ip_address;

-- Add registration_info JSONB column for detailed registration metadata
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS registration_info JSONB DEFAULT '{}'; 