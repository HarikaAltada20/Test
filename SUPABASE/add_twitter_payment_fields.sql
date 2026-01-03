-- ============================================================================
-- Migration: Add Payment Fields to Twitter Campaign Leaderboard
-- Description: Adds payment tracking fields to twitter_campaign_leaderboard table
--              to support creator payments for Twitter leaderboard contests
-- Date: 2025-01-XX
-- ============================================================================

-- ============================================================================
-- ADD PAYMENT COLUMNS TO TWITTER_CAMPAIGN_LEADERBOARD TABLE
-- ============================================================================

ALTER TABLE public.twitter_campaign_leaderboard
ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS earnings INTEGER DEFAULT 0, -- Amount in cents
ADD COLUMN IF NOT EXISTS paid_rank INTEGER NULL; -- Audit/historical record (rank is locked by post_contest_status)

COMMENT ON COLUMN public.twitter_campaign_leaderboard.paid IS 'Whether this creator has been paid for their rank in this contest';
COMMENT ON COLUMN public.twitter_campaign_leaderboard.paid_at IS 'Timestamp when payment was processed';
COMMENT ON COLUMN public.twitter_campaign_leaderboard.earnings IS 'Amount paid to creator in cents (based on rank prize)';
COMMENT ON COLUMN public.twitter_campaign_leaderboard.paid_rank IS 'Rank at time of payment (audit/historical record - rank is locked by post_contest_status)';

-- Index for filtering paid/unpaid creators
CREATE INDEX IF NOT EXISTS idx_twitter_leaderboard_paid 
ON public.twitter_campaign_leaderboard(contest_id, paid) 
WHERE paid = true;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
