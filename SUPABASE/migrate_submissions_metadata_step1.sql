-- Step 1: Rename the column from description to metadata
ALTER TABLE submissions 
RENAME COLUMN description TO metadata; 