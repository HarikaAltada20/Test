-- Create a function that will work with Supabase RPC
-- Note: In PostgreSQL, need to avoid ambiguous column references

-- First, drop any existing versions to avoid conflicts
DROP PROCEDURE IF EXISTS handle_referral;
DROP FUNCTION IF EXISTS handle_referral;

-- Create the function with parameters exactly matching the RPC call
CREATE OR REPLACE FUNCTION handle_referral(
  referrer_id UUID,      -- First parameter 
  referred_id UUID,      -- Second parameter
  ref_code TEXT,         -- Renamed from referral_code to avoid ambiguity
  referred_type TEXT     -- Fourth parameter
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER   -- This allows the function to bypass RLS
AS $$
BEGIN
  -- Update the referred user
  UPDATE users 
  SET 
    coins = 200, -- 100 welcome + 100 referral bonus
    referred_by = ref_code  -- Using the parameter, not column
  WHERE id = referred_id;
  
  -- Record referral bonus transaction for referred user
  INSERT INTO coin_transactions (
    user_id, 
    type, 
    status, 
    coins, 
    description,
    created_at
  ) VALUES (
    referred_id,
    'referral_bonus',
    'success',
    100,
    'Bonus for using referral code ' || ref_code,  -- Using parameter
    NOW()
  );
  
  -- Update referrer statistics based on referred user type
  IF referred_type = 'creator' THEN
    UPDATE users 
    SET 
      coins = coins + 100,
      creators_referred = creators_referred + 1
    WHERE id = referrer_id;
  ELSE
    UPDATE users 
    SET 
      coins = coins + 100,
      advertisers_referred = advertisers_referred + 1
    WHERE id = referrer_id;
  END IF;
  
  -- Since this is a SECURITY DEFINER function, it can bypass RLS
  -- We can now create a transaction for the referrer too
  INSERT INTO coin_transactions (
    user_id, 
    type, 
    status, 
    coins, 
    description,
    created_at
  ) VALUES (
    referrer_id,
    'referral_bonus',
    'success',
    100,
    'Referral bonus for inviting new ' || referred_type,
    NOW()
  );
END;
$$; 