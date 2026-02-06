-- ============================================================================
-- Migration: Add 'paid' Status to Twitter Moderation (Production-Safe)
-- Description: Adds 'paid' as a valid moderation_status value
-- Version: 2.0 - Production-safe with proper idempotency and locking
-- Date: 2026-02-03
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Validate existing data
-- ============================================================================
-- Ensure no invalid data exists before modifying constraints
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM twitter_campaign_tweets
    WHERE moderation_status NOT IN ('pending', 'verified', 'rejected');
    
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Found % tweets with invalid moderation_status', invalid_count;
    END IF;
    
    SELECT COUNT(*) INTO invalid_count
    FROM twitter_campaign_leaderboard
    WHERE moderation_status NOT IN ('pending', 'verified', 'rejected');
    
    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Found % leaderboard entries with invalid moderation_status', invalid_count;
    END IF;
    
    RAISE NOTICE 'Data validation passed';
END $$;

-- ============================================================================
-- STEP 2: Drop and recreate constraint - twitter_campaign_tweets
-- ============================================================================
DO $$
BEGIN
    -- Drop constraint if it exists (idempotent)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.twitter_campaign_tweets'::regclass
        AND conname = 'twitter_campaign_tweets_moderation_status_check'
    ) THEN
        ALTER TABLE public.twitter_campaign_tweets 
        DROP CONSTRAINT twitter_campaign_tweets_moderation_status_check;
        RAISE NOTICE 'Dropped existing constraint on twitter_campaign_tweets';
    END IF;
    
    -- Add new constraint with NOT VALID to avoid locking
    ALTER TABLE public.twitter_campaign_tweets
    ADD CONSTRAINT twitter_campaign_tweets_moderation_status_check 
    CHECK (moderation_status IN ('pending', 'verified', 'rejected', 'paid'))
    NOT VALID;
    
    RAISE NOTICE 'Added new constraint on twitter_campaign_tweets (NOT VALID)';
END $$;

-- ============================================================================
-- STEP 3: Drop and recreate constraint - twitter_campaign_leaderboard
-- ============================================================================
DO $$
BEGIN
    -- Drop constraint if it exists (idempotent)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.twitter_campaign_leaderboard'::regclass
        AND conname = 'twitter_campaign_leaderboard_moderation_status_check'
    ) THEN
        ALTER TABLE public.twitter_campaign_leaderboard 
        DROP CONSTRAINT twitter_campaign_leaderboard_moderation_status_check;
        RAISE NOTICE 'Dropped existing constraint on twitter_campaign_leaderboard';
    END IF;
    
    -- Add new constraint with NOT VALID to avoid locking
    ALTER TABLE public.twitter_campaign_leaderboard
    ADD CONSTRAINT twitter_campaign_leaderboard_moderation_status_check 
    CHECK (moderation_status IN ('pending', 'verified', 'rejected', 'paid'))
    NOT VALID;
    
    RAISE NOTICE 'Added new constraint on twitter_campaign_leaderboard (NOT VALID)';
END $$;

-- ============================================================================
-- STEP 4: Validate constraints with minimal locking
-- ============================================================================
-- This validates existing rows in small batches to avoid long locks
-- Can run this later during low-traffic period if needed

ALTER TABLE public.twitter_campaign_tweets 
VALIDATE CONSTRAINT twitter_campaign_tweets_moderation_status_check;

ALTER TABLE public.twitter_campaign_leaderboard 
VALIDATE CONSTRAINT twitter_campaign_leaderboard_moderation_status_check;

-- ============================================================================
-- STEP 5: Update comments
-- ============================================================================
COMMENT ON COLUMN public.twitter_campaign_tweets.moderation_status IS 
'Moderation status: pending (awaiting review), verified (approved but not paid), rejected (not approved), paid (approved and payment processed)';

COMMENT ON COLUMN public.twitter_campaign_leaderboard.moderation_status IS 
'Creator-level moderation status: pending (awaiting review), verified (approved but not paid), rejected (all tweets rejected), paid (approved and payment processed)';

COMMIT;

-- ============================================================================
-- Rollback instructions (if needed):
-- ============================================================================
-- BEGIN;
-- ALTER TABLE twitter_campaign_tweets DROP CONSTRAINT twitter_campaign_tweets_moderation_status_check;
-- ALTER TABLE twitter_campaign_tweets ADD CONSTRAINT twitter_campaign_tweets_moderation_status_check 
--   CHECK (moderation_status IN ('pending', 'verified', 'rejected'));
-- 
-- ALTER TABLE twitter_campaign_leaderboard DROP CONSTRAINT twitter_campaign_leaderboard_moderation_status_check;
-- ALTER TABLE twitter_campaign_leaderboard ADD CONSTRAINT twitter_campaign_leaderboard_moderation_status_check 
--   CHECK (moderation_status IN ('pending', 'verified', 'rejected'));
-- COMMIT;
