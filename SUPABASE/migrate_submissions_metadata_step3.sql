-- Step 3: Add a comment to document the new metadata structure
COMMENT ON COLUMN submissions.metadata IS 'JSON metadata for submission actions. 
For rejections: {"type": "rejection", "reason": "string", "timestamp": "ISO date", "updatedBy": "user_id"}
For payments: {"type": "payment", "paymentProofUrl": "string", "paymentDescription": "string", "timestamp": "ISO date", "updatedBy": "user_id"}';

-- Step 4: Create an index on the metadata for better query performance (after type change)
-- Using BTREE index for text values extracted from JSONB
CREATE INDEX IF NOT EXISTS idx_submissions_metadata_type 
ON submissions USING btree ((metadata->>'type'));

-- Step 5: Create an index on the metadata timestamp for sorting (after type change)
-- Using BTREE index for timestamp values extracted from JSONB
CREATE INDEX IF NOT EXISTS idx_submissions_metadata_timestamp 
ON submissions USING btree ((metadata->>'timestamp')); 

-- Performance and Safety Hardening for payouts

-- 1) Leaderboard/CPM rank and filters
CREATE INDEX IF NOT EXISTS idx_submissions_contest_status_views
ON submissions (contest_id, status, views DESC);

-- 2) Fast lookup for reward/refund scans (fallback path only)
CREATE INDEX IF NOT EXISTS idx_money_tx_user_type
ON money_transactions (user_id, type);

CREATE INDEX IF NOT EXISTS idx_money_tx_submission_id
ON money_transactions ((metadata->>'submission_id'));

-- 3) Ensure at most one reward transaction per submission (idempotency)
DROP INDEX IF EXISTS ux_reward_per_submission;
-- Allow multiple payout cycles on the same submission, but only one reward per cycle
CREATE UNIQUE INDEX IF NOT EXISTS ux_reward_per_submission_cycle
ON money_transactions (
  (metadata->>'submission_id'),
  COALESCE(NULLIF(metadata->>'payout_cycle','')::int, 1)
)
WHERE type = 'reward';