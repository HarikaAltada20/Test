-- Migration: Add profile reward claimed_at timestamp to creator profiles
-- Date: 2025-01-XX
-- Description: Adds a timestamp column to track when the profile update reward was claimed

-- Add new column to creator_profiles table
ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS profile_reward_claimed_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.creator_profiles.profile_reward_claimed_at IS 'Timestamp when the profile update reward ($0.50 bonus) was claimed.';

