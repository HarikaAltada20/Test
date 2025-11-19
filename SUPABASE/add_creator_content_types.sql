-- Migration: Add content type fields to creator profiles
-- Date: 2025-01-XX
-- Description: Adds fields for content types creators create and are interested in

-- Add new columns to creator_profiles table
ALTER TABLE public.creator_profiles
ADD COLUMN IF NOT EXISTS type_of_content JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS other_type_of_content JSONB DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.creator_profiles.type_of_content IS 'JSONB array of content types the creator creates (max 3 selections). Stored as JSON array: ["crypto-financial", "education", ...]. Values: crypto-financial, education, dating, food-drink, games-toys, health-wellness, home-living, pets-animals, sports-outdoors, technology, other';
COMMENT ON COLUMN public.creator_profiles.other_type_of_content IS 'JSONB array of content types the creator is interested in creating (unlimited selections). Stored as JSON array: ["crypto-financial", "education", ...]. Values: crypto-financial, education, dating, food-drink, games-toys, health-wellness, home-living, pets-animals, sports-outdoors, technology, other';

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_creator_profiles_type_of_content ON public.creator_profiles USING GIN(type_of_content) WHERE type_of_content IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_profiles_other_type_of_content ON public.creator_profiles USING GIN(other_type_of_content) WHERE other_type_of_content IS NOT NULL;

