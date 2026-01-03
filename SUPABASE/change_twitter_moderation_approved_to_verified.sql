-- ============================================================================
-- Migration: Change Twitter Moderation Status from "approved" to "verified"
-- Description: Changes moderation_status values from "approved" to "verified"
--              in both twitter_campaign_tweets and twitter_campaign_leaderboard
--              to simplify code and make it consistent with submissions table
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP CHECK CONSTRAINT: twitter_campaign_tweets
-- ============================================================================
-- Drop the constraint FIRST before updating data

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.twitter_campaign_tweets'::regclass
      AND contype = 'c'
      AND conname LIKE '%moderation_status%';
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.twitter_campaign_tweets DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No moderation_status constraint found on twitter_campaign_tweets';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: DROP CHECK CONSTRAINT: twitter_campaign_leaderboard
-- ============================================================================

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.twitter_campaign_leaderboard'::regclass
      AND contype = 'c'
      AND conname LIKE '%moderation_status%';
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.twitter_campaign_leaderboard DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No moderation_status constraint found on twitter_campaign_leaderboard';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: UPDATE EXISTING DATA: twitter_campaign_tweets
-- ============================================================================

UPDATE public.twitter_campaign_tweets
SET moderation_status = 'verified'
WHERE moderation_status = 'approved';

-- ============================================================================
-- STEP 4: UPDATE EXISTING DATA: twitter_campaign_leaderboard
-- ============================================================================

UPDATE public.twitter_campaign_leaderboard
SET moderation_status = 'verified'
WHERE moderation_status = 'approved';

-- ============================================================================
-- STEP 5: ADD NEW CHECK CONSTRAINT: twitter_campaign_tweets
-- ============================================================================

ALTER TABLE public.twitter_campaign_tweets
ADD CONSTRAINT twitter_campaign_tweets_moderation_status_check 
CHECK (moderation_status IN ('pending', 'verified', 'rejected'));

-- ============================================================================
-- STEP 6: ADD NEW CHECK CONSTRAINT: twitter_campaign_leaderboard
-- ============================================================================

ALTER TABLE public.twitter_campaign_leaderboard
ADD CONSTRAINT twitter_campaign_leaderboard_moderation_status_check 
CHECK (moderation_status IN ('pending', 'verified', 'rejected'));

-- ============================================================================
-- STEP 7: UPDATE COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.twitter_campaign_tweets.moderation_status IS 
'Moderation status for brand/admin review: pending, verified, rejected';

COMMENT ON COLUMN public.twitter_campaign_leaderboard.moderation_status IS 
'Moderation status for creator-level review: pending, verified, rejected. When rejected, all tweets from this creator are considered rejected.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
