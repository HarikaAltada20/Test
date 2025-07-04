-- Prevent negative balances at the database level
-- This ensures that even if application logic fails, negative balances are impossible

-- Add check constraint to prevent negative balances
ALTER TABLE advertiser_profiles 
ADD CONSTRAINT check_positive_balance 
CHECK (available_deposit_balance >= 0);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT check_positive_balance ON advertiser_profiles IS 
'Prevents negative wallet balances to ensure atomic transaction integrity'; 