-- Migration: Add profile update reward claim tracking to creator profiles
-- Date: 2025-01-XX
-- Description: Adds a column to track if the creator has claimed the profile update reward ($0.50 bonus)

-- Add new column to creator_profiles table
ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS has_claimed_profile_reward BOOLEAN DEFAULT FALSE NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.creator_profiles.has_claimed_profile_reward IS 'Indicates if the creator has claimed the $0.50 profile update reward. Once true, profile editing is disabled.';

