-- Update submissions table to rename description field to metadata and change type to jsonb
-- This allows storing structured metadata for rejections and payments

-- Step 1: Rename the column from description to metadata
ALTER TABLE submissions 
RENAME COLUMN description TO metadata;

-- Step 2: Change the column type from text to jsonb with proper conversion
-- Handle null values and empty strings properly
ALTER TABLE submissions 
ALTER COLUMN metadata TYPE jsonb USING 
  CASE 
    WHEN metadata IS NULL THEN NULL
    WHEN metadata = '' THEN NULL
    ELSE metadata::jsonb
  END;

-- Step 3: Add a comment to document the new metadata structure
COMMENT ON COLUMN submissions.metadata IS 'JSON metadata for submission actions. 
For rejections: {"type": "rejection", "reason": "string", "timestamp": "ISO date", "updatedBy": "user_id"}
For payments: {"type": "payment", "paymentProofUrl": "string", "paymentDescription": "string", "timestamp": "ISO date", "updatedBy": "user_id"}';

-- Step 4: Create an index on the metadata for better query performance (after type change)
CREATE INDEX IF NOT EXISTS idx_submissions_metadata_type 
ON submissions USING gin ((metadata->>'type'));

-- Step 5: Create an index on the metadata timestamp for sorting (after type change)
CREATE INDEX IF NOT EXISTS idx_submissions_metadata_timestamp 
ON submissions USING gin ((metadata->>'timestamp')); 