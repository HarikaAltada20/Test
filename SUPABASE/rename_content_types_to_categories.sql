-- Migration: Rename content type columns to categories and subcategories
-- Date: 2025-01-XX
-- Description: Renames type_of_content to categories and other_type_of_content to subcategories

-- Rename columns
ALTER TABLE public.creator_profiles
RENAME COLUMN type_of_content TO categories;

ALTER TABLE public.creator_profiles
RENAME COLUMN other_type_of_content TO subcategories;

-- Update comments for documentation
COMMENT ON COLUMN public.creator_profiles.categories IS 'JSONB array of content categories the creator creates (max 3 selections). Stored as JSON array: ["beauty", "fashion", ...]';
COMMENT ON COLUMN public.creator_profiles.subcategories IS 'JSONB array of content subcategories the creator is interested in creating (unlimited selections). Stored as JSON array of objects: [{"category": "beauty", "subcategory": "Skincare"}, ...]';

-- Rename indexes
DROP INDEX IF EXISTS idx_creator_profiles_type_of_content;
DROP INDEX IF EXISTS idx_creator_profiles_other_type_of_content;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_categories ON public.creator_profiles USING GIN(categories) WHERE categories IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_profiles_subcategories ON public.creator_profiles USING GIN(subcategories) WHERE subcategories IS NOT NULL;

