-- ============================================================================
-- Migration: Update content_type constraint to support Twitter campaigns
-- Date: 2026-01-27
-- Description: Adds 'raid' and 'awareness' to the contests_content_type_check
--              constraint to support Twitter CPM raid and awareness campaigns
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE public.contests
DROP CONSTRAINT IF EXISTS contests_content_type_check;

-- Add the updated constraint with 'raid' and 'awareness' values
ALTER TABLE public.contests
ADD CONSTRAINT contests_content_type_check 
CHECK (
  content_type = ANY (
    ARRAY[
      'ugc'::text,
      'clipping'::text,
      'other'::text,
      'raid'::text,
      'awareness'::text
    ]
  )
);

-- Update the column comment to reflect the new values
COMMENT ON COLUMN public.contests.content_type IS 'Type of content required: ugc (User Generated Content), clipping (Short clips/repurposed content), other (Check Rules), raid (Twitter raid campaign), or awareness (Twitter awareness campaign)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
