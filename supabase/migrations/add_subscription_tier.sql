-- Add subscription_tier column to advertiser_profiles table
ALTER TABLE advertiser_profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'bronze';

-- Create subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'bronze',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_subscription_tier ON advertiser_profiles(subscription_tier);

-- Update types definition (this is for reference only and doesn't directly modify the database)
COMMENT ON COLUMN advertiser_profiles.subscription_tier IS 'The subscription tier for this advertiser (bronze, silver, gold, platinum, diamond)'; 