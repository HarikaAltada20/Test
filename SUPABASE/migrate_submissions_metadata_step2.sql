-- Step 2: Change the column type from text to jsonb with proper conversion
-- Handle null values and empty strings properly
ALTER TABLE submissions 
ALTER COLUMN metadata TYPE jsonb USING 
  CASE 
    WHEN metadata IS NULL THEN NULL
    WHEN metadata = '' THEN NULL
    ELSE metadata::jsonb
  END; 