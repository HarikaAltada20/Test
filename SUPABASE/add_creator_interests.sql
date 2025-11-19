-- Migration: Add interests field to creator profiles
-- Date: 2025-01-XX
-- Description: Adds interests field for creators to select their interests

-- Add new column to creator_profiles table
ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.creator_profiles.interests IS 'JSONB array of interests selected by the creator. Stored as JSON array: ["Beauty", "Fashion", "Fitness", ...]';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_creator_profiles_interests ON public.creator_profiles USING GIN(interests) WHERE interests IS NOT NULL;

