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