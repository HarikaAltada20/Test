-- Migration: Convert available_deposit_balance from dollars to cents for consistency
-- This ensures both available_deposit_balance and money_transactions.amount use the same unit (cents)

-- Step 1: Add a new column in cents
ALTER TABLE advertiser_profiles 
ADD COLUMN IF NOT EXISTS available_deposit_balance_cents INTEGER DEFAULT 0;

-- Step 2: Convert existing dollar values to cents
UPDATE advertiser_profiles 
SET available_deposit_balance_cents = ROUND(available_deposit_balance * 100)
WHERE available_deposit_balance IS NOT NULL;

-- Step 3: Handle any NULL values
UPDATE advertiser_profiles 
SET available_deposit_balance_cents = 0 
WHERE available_deposit_balance_cents IS NULL;

-- Step 4: Drop the old decimal column
ALTER TABLE advertiser_profiles DROP COLUMN available_deposit_balance;

-- Step 5: Rename the new column to the original name
ALTER TABLE advertiser_profiles 
RENAME COLUMN available_deposit_balance_cents TO available_deposit_balance;

-- Step 6: Add NOT NULL constraint
ALTER TABLE advertiser_profiles 
ALTER COLUMN available_deposit_balance SET NOT NULL;

-- Step 7: Recreate the index with the new column
DROP INDEX IF EXISTS idx_advertiser_profiles_balance;
CREATE INDEX idx_advertiser_profiles_balance 
ON advertiser_profiles(available_deposit_balance);

-- Add a comment to document the change
COMMENT ON COLUMN advertiser_profiles.available_deposit_balance IS 'Balance stored in cents for consistency with money_transactions.amount'; 