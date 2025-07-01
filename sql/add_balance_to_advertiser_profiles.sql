-- Add available_deposit_balance column to advertiser_profiles
ALTER TABLE advertiser_profiles 
ADD COLUMN IF NOT EXISTS available_deposit_balance DECIMAL(10, 2) DEFAULT 0.00;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_balance 
ON advertiser_profiles(available_deposit_balance);

-- Update existing records to have 0 balance if NULL
UPDATE advertiser_profiles 
SET available_deposit_balance = 0.00 
WHERE available_deposit_balance IS NULL; 