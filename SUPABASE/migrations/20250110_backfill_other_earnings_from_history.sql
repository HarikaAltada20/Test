-- Backfill other_earnings column from historical transaction data
-- This calculates what users should have in other_earnings based on past:
-- 1. Referral signup bonuses (50 cents for creators who used referral codes)
-- 2. Coupon redemptions (from money_transactions with coupon remarks)
-- 3. Survey bonus claims (40 cents from survey rewards)

DO $$
DECLARE
  user_record RECORD;
  referral_bonus INTEGER := 0;
  coupon_earnings INTEGER := 0;
  survey_bonus INTEGER := 0;
  total_other_earnings INTEGER := 0;
BEGIN
  -- Loop through all users
  FOR user_record IN 
    SELECT id, user_type, referred_by 
    FROM public.users
  LOOP
    total_other_earnings := 0;
    referral_bonus := 0;
    coupon_earnings := 0;
    survey_bonus := 0;
    
    -- 1. Calculate referral signup bonus (50 cents for creators who used a referral code)
    IF user_record.user_type = 'creator' 
       AND user_record.referred_by IS NOT NULL 
       AND user_record.referred_by != '' 
       AND EXISTS (
         SELECT 1 
         FROM public.money_transactions 
         WHERE user_id = user_record.id 
           AND type = 'referral_signup_bonus'
           AND status = 'success'
       ) THEN
      referral_bonus := 50;
    END IF;
    
    -- 2. Calculate coupon redemptions from money_transactions
    -- Look for reward transactions with coupon remarks
    SELECT COALESCE(SUM(amount), 0)
    INTO coupon_earnings
    FROM public.money_transactions
    WHERE user_id = user_record.id
      AND type = 'reward'
      AND status = 'success'
      AND (remarks LIKE 'coupon:%' OR description LIKE '%Coupon%');
    
    -- 3. Calculate survey bonus (40 cents)
    IF EXISTS (
      SELECT 1 
      FROM public.money_transactions 
      WHERE user_id = user_record.id 
        AND type = 'reward'
        AND status = 'success'
        AND (remarks = 'survey_completion_bonus' OR description LIKE '%Survey%' OR description LIKE '%survey%')
    ) THEN
      survey_bonus := 40;
    END IF;
    
    -- Sum all earnings
    total_other_earnings := referral_bonus + coupon_earnings + survey_bonus;
    
    -- Update the user's other_earnings (always update, even if 0)
    UPDATE public.users
    SET other_earnings = total_other_earnings
    WHERE id = user_record.id;
    
  END LOOP;
END $$;

