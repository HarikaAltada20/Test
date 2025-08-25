-- Test queries to verify the fixes are working

-- 1. Check for any new users with bad IP data (should be 0)
SELECT 
  email,
  registration_info,
  created_at
FROM users 
WHERE registration_info->>'ip_address' = '0.0.0.0'
  AND created_at > NOW() - INTERVAL '1 hour';

-- 2. Check recent registrations have proper IP handling
SELECT 
  email,
  registration_info->>'ip_address' as ip,
  created_at
FROM users 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 3. Check for creator profiles with "undefined" strings (should be 0)
SELECT 
  id,
  bio,
  youtube_account,
  instagram_account,
  created_at
FROM creator_profiles 
WHERE (bio = 'undefined' 
   OR youtube_account::text = '"undefined"' 
   OR instagram_account::text = '"undefined"')
  AND created_at > NOW() - INTERVAL '1 hour';

-- 4. Check recent creator profiles have proper NULL values
SELECT 
  id,
  bio,
  youtube_account,
  instagram_account,
  created_at
FROM creator_profiles 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- 5. Overall data quality check for last 24 hours
SELECT 
  'Recent registrations' as metric,
  COUNT(*) as count
FROM users 
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Bad IP addresses' as metric,
  COUNT(*) as count
FROM users 
WHERE registration_info->>'ip_address' = '0.0.0.0'
  AND created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Undefined bio values' as metric,
  COUNT(*) as count
FROM creator_profiles 
WHERE bio = 'undefined'
  AND created_at > NOW() - INTERVAL '24 hours';
