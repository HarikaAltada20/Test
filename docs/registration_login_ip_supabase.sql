-- Add registration_ip and login_history columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS registration_ip TEXT,
ADD COLUMN IF NOT EXISTS login_history JSONB DEFAULT '[]';

-- Remove old ip_address column if it exists
ALTER TABLE public.users
DROP COLUMN IF EXISTS ip_address; 