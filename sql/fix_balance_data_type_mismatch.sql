-- Fix available_deposit_balance data type mismatch
-- The issue: Database uses DECIMAL but code expects INTEGER (cents)
-- This script ensures consistent data types and proper conversion

-- Step 1: Check current data type
DO $$
DECLARE
    current_type TEXT;
BEGIN
    SELECT data_type INTO current_type
    FROM information_schema.columns 
    WHERE table_name = 'advertiser_profiles' 
    AND column_name = 'available_deposit_balance';
    
    RAISE NOTICE 'Current available_deposit_balance data type: %', current_type;
END $$;

-- Step 2: If the column is still DECIMAL/NUMERIC, convert it to INTEGER (cents)
DO $$
DECLARE
    current_type TEXT;
BEGIN
    SELECT data_type INTO current_type
    FROM information_schema.columns 
    WHERE table_name = 'advertiser_profiles' 
    AND column_name = 'available_deposit_balance';
    
    IF current_type IN ('numeric', 'decimal') THEN
        RAISE NOTICE 'Converting DECIMAL balance to INTEGER (cents)...';
        
        -- Add temporary column for cents
        ALTER TABLE advertiser_profiles 
        ADD COLUMN IF NOT EXISTS available_deposit_balance_cents INTEGER DEFAULT 0;
        
        -- Convert existing decimal values (dollars) to integer (cents)
        UPDATE advertiser_profiles 
        SET available_deposit_balance_cents = ROUND(COALESCE(available_deposit_balance, 0) * 100);
        
        -- Drop the old decimal column
        ALTER TABLE advertiser_profiles DROP COLUMN available_deposit_balance;
        
        -- Rename the new column
        ALTER TABLE advertiser_profiles 
        RENAME COLUMN available_deposit_balance_cents TO available_deposit_balance;
        
        -- Add NOT NULL constraint
        ALTER TABLE advertiser_profiles 
        ALTER COLUMN available_deposit_balance SET NOT NULL;
        
        -- Recreate index
        DROP INDEX IF EXISTS idx_advertiser_profiles_balance;
        CREATE INDEX idx_advertiser_profiles_balance 
        ON advertiser_profiles(available_deposit_balance);
        
        RAISE NOTICE 'Successfully converted balance column to INTEGER (cents)';
    ELSE
        RAISE NOTICE 'Balance column is already INTEGER type, no conversion needed';
    END IF;
END $$;

-- Step 3: Add comment to document the data type
COMMENT ON COLUMN advertiser_profiles.available_deposit_balance IS 'Balance stored in cents (INTEGER) for consistency with money_transactions.amount';

-- Step 4: Verify the conversion
DO $$
DECLARE
    current_type TEXT;
    sample_balance INTEGER;
BEGIN
    SELECT data_type INTO current_type
    FROM information_schema.columns 
    WHERE table_name = 'advertiser_profiles' 
    AND column_name = 'available_deposit_balance';
    
    SELECT available_deposit_balance INTO sample_balance
    FROM advertiser_profiles 
    LIMIT 1;
    
    RAISE NOTICE 'Final data type: %, Sample balance: % cents', current_type, COALESCE(sample_balance, 0);
END $$;

SELECT 'Balance data type mismatch fixed successfully!' as message; 