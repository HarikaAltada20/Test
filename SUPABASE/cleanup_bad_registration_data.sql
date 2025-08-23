-- Script to clean up bad registration data
-- This script fixes:
-- 1. IP addresses of "0.0.0.0" in registration_info
-- 2. String "undefined" values in creator_profiles

BEGIN;

-- 1. Fix registration_info with IP "0.0.0.0"
-- Option A: Set entire registration_info to NULL if it only contains bad IP
UPDATE users 
SET registration_info = NULL 
WHERE registration_info->>'ip_address' = '0.0.0.0'
  AND jsonb_array_length(jsonb_object_keys(registration_info)) <= 2; -- Only ip_address and timestamp

-- Option B: Remove just the bad ip_address but keep other data
UPDATE users 
SET registration_info = registration_info - 'ip_address'
WHERE registration_info->>'ip_address' = '0.0.0.0'
  AND jsonb_array_length(jsonb_object_keys(registration_info)) > 2; -- Has other useful data

-- 2. Fix "undefined" string values in creator_profiles
UPDATE creator_profiles 
SET bio = NULL 
WHERE bio = 'undefined';

UPDATE creator_profiles 
SET youtube_account = NULL 
WHERE youtube_account::text = '"undefined"';

UPDATE creator_profiles 
SET instagram_account = NULL 
WHERE instagram_account::text = '"undefined"';

-- 3. Optional: Log what we're fixing before we fix it
-- Uncomment these to see what will be affected:

-- SELECT 'Users with bad IP' as issue, count(*) 
-- FROM users 
-- WHERE registration_info->>'ip_address' = '0.0.0.0';

-- SELECT 'Creator profiles with undefined bio' as issue, count(*) 
-- FROM creator_profiles 
-- WHERE bio = 'undefined';

-- SELECT 'Creator profiles with undefined youtube_account' as issue, count(*) 
-- FROM creator_profiles 
-- WHERE youtube_account::text = '"undefined"';

-- SELECT 'Creator profiles with undefined instagram_account' as issue, count(*) 
-- FROM creator_profiles 
-- WHERE instagram_account::text = '"undefined"';

COMMIT;
