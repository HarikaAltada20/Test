-- Add moderation fields to contests table
ALTER TABLE contests 
ADD COLUMN moderation_status contest_moderation_status_enum DEFAULT 'draft',
ADD COLUMN submitted_for_approval_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN approved_by UUID REFERENCES auth.users(id),
ADD COLUMN published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rejection_reason TEXT;

-- Create index for performance
CREATE INDEX idx_contests_moderation_status ON contests(moderation_status);

-- Update existing contests to set moderation_status based on is_draft
UPDATE contests SET 
    moderation_status = CASE 
        WHEN is_draft = true THEN 'draft'
        ELSE 'published'  -- Existing non-draft contests are considered published
    END
WHERE moderation_status IS NULL; 