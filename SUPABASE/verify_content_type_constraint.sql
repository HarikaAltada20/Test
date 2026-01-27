-- ============================================================================
-- Verification Script: Check content_type constraint for Twitter campaigns
-- Date: 2026-01-27
-- Description: Verifies the current constraint and what values are allowed
-- ============================================================================

-- 1. Check the current constraint definition
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'contests_content_type_check'
AND conrelid = 'public.contests'::regclass;

-- 2. Check if there are any existing contests with 'raid' or 'awareness' content_type
SELECT 
    id,
    title,
    platform,
    content_type,
    contest_type,
    moderation_status
FROM public.contests
WHERE content_type IN ('raid', 'awareness')
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check all distinct content_type values currently in the database
SELECT 
    content_type,
    COUNT(*) as count,
    COUNT(CASE WHEN platform = 'twitter' THEN 1 END) as twitter_count
FROM public.contests
GROUP BY content_type
ORDER BY count DESC;

-- 4. Check recent Twitter contests and their content_type values
SELECT 
    id,
    title,
    platform,
    content_type,
    contest_type,
    contest_based_details->'twitter_campaign'->>'campaign_type' as twitter_campaign_type,
    moderation_status,
    created_at
FROM public.contests
WHERE platform = 'twitter'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Verify the constraint allows only: 'ugc', 'clipping', 'other'
-- This query will show what the constraint currently allows
SELECT 
    'Current constraint allows: ugc, clipping, other' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'contests_content_type_check'
            AND pg_get_constraintdef(oid) LIKE '%ugc%'
            AND pg_get_constraintdef(oid) LIKE '%clipping%'
            AND pg_get_constraintdef(oid) LIKE '%other%'
            AND pg_get_constraintdef(oid) NOT LIKE '%raid%'
            AND pg_get_constraintdef(oid) NOT LIKE '%awareness%'
        ) THEN 'CONSTRAINT NEEDS UPDATE - Missing raid and awareness'
        ELSE 'Constraint may already be updated or different'
    END as status;

-- ============================================================================
-- END OF VERIFICATION
-- ============================================================================
