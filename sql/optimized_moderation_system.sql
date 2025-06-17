-- Optimized Contest Moderation System
-- Fresh implementation - no backward compatibility

-- 1. Create moderation status enum
CREATE TYPE contest_moderation_status_enum AS ENUM (
    'draft',           -- Brand is still working on it
    'pending_approval', -- Submitted for admin review
    'approved',        -- Admin approved, ready to publish
    'published',       -- Contest is live
    'rejected'         -- Admin rejected, needs changes
);

-- 2. Update contests table
ALTER TABLE contests 
DROP COLUMN IF EXISTS is_draft,
ADD COLUMN moderation_status contest_moderation_status_enum DEFAULT 'draft',
ADD COLUMN submitted_for_approval_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN approved_by UUID REFERENCES auth.users(id),
ADD COLUMN published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rejection_reason TEXT;

-- 3. Create indexes
CREATE INDEX idx_contests_moderation_status ON contests(moderation_status);
CREATE INDEX idx_contests_submitted_for_approval ON contests(submitted_for_approval_at) WHERE submitted_for_approval_at IS NOT NULL;
CREATE INDEX idx_contests_published_at ON contests(published_at) WHERE published_at IS NOT NULL;

-- 4. Update view
DROP VIEW IF EXISTS contests_with_status;
CREATE VIEW contests_with_status AS
SELECT *,
  CASE
    WHEN moderation_status = 'draft' THEN 'draft'::text
    WHEN moderation_status = 'pending_approval' THEN 'pending_approval'::text
    WHEN moderation_status = 'approved' THEN 'approved'::text
    WHEN moderation_status = 'rejected' THEN 'rejected'::text
    WHEN moderation_status = 'published' THEN
      CASE
        WHEN start_date IS NULL OR end_date IS NULL THEN 'incomplete'::text
        WHEN NOW() < start_date THEN 'upcoming'::text
        WHEN NOW() >= start_date AND NOW() < end_date THEN 'active'::text
        WHEN NOW() >= end_date THEN 'ended'::text
        ELSE 'unknown'::text
      END
    ELSE 'unknown'::text
  END AS status
FROM contests;

-- 5. Create utility functions for moderation workflow
CREATE OR REPLACE FUNCTION submit_contest_for_approval(contest_id UUID)
RETURNS JSON AS $$
DECLARE
    contest_record RECORD;
    validation_errors TEXT[] := '{}';
BEGIN
    -- Get contest details
    SELECT * INTO contest_record FROM contests WHERE id = contest_id;
    
    if contest_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Contest not found');
    END IF;
    
    -- Validate contest is in correct state
    IF contest_record.moderation_status NOT IN ('draft', 'rejected') THEN
        RETURN json_build_object('success', false, 'error', 'Contest can only be submitted from draft or rejected status');
    END IF;
    
    -- Validate required fields
    IF contest_record.title IS NULL OR trim(contest_record.title) = '' THEN
        validation_errors := array_append(validation_errors, 'Title is required');
    END IF;
    
    IF contest_record.brief_html IS NULL OR trim(contest_record.brief_html) = '' THEN
        validation_errors := array_append(validation_errors, 'Brief is required');
    END IF;
    
    IF contest_record.start_date IS NULL OR contest_record.end_date IS NULL THEN
        validation_errors := array_append(validation_errors, 'Start and end dates are required');
    END IF;
    
    IF contest_record.start_date >= contest_record.end_date THEN
        validation_errors := array_append(validation_errors, 'End date must be after start date');
    END IF;
    
    -- Return validation errors if any
    IF array_length(validation_errors, 1) > 0 THEN
        RETURN json_build_object('success', false, 'errors', validation_errors);
    END IF;
    
    -- Update contest status
    UPDATE contests SET
        moderation_status = 'pending_approval',
        submitted_for_approval_at = NOW(),
        updated_at = NOW()
    WHERE id = contest_id;
    
    RETURN json_build_object('success', true, 'message', 'Contest submitted for approval');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION moderate_contest(
    contest_id UUID,
    action TEXT, -- 'approve' or 'reject'
    admin_user_id UUID,
    rejection_reason_text TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    contest_record RECORD;
BEGIN
    -- Get contest details
    SELECT * INTO contest_record FROM contests WHERE id = contest_id;
    
    IF contest_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Contest not found');
    END IF;
    
    -- Validate contest is pending approval
    IF contest_record.moderation_status != 'pending_approval' THEN
        RETURN json_build_object('success', false, 'error', 'Contest is not pending approval');
    END IF;
    
    -- Validate action
    IF action NOT IN ('approve', 'reject') THEN
        RETURN json_build_object('success', false, 'error', 'Action must be approve or reject');
    END IF;
    
    -- Validate rejection reason
    IF action = 'reject' AND (rejection_reason_text IS NULL OR trim(rejection_reason_text) = '') THEN
        RETURN json_build_object('success', false, 'error', 'Rejection reason is required');
    END IF;
    
    -- Update contest based on action
    IF action = 'approve' THEN
        UPDATE contests SET
            moderation_status = 'approved',
            approved_at = NOW(),
            approved_by = admin_user_id,
            rejection_reason = NULL, -- Clear any previous rejection reason
            updated_at = NOW()
        WHERE id = contest_id;
        
        RETURN json_build_object('success', true, 'message', 'Contest approved successfully');
    ELSE
        UPDATE contests SET
            moderation_status = 'rejected',
            rejection_reason = rejection_reason_text,
            updated_at = NOW()
        WHERE id = contest_id;
        
        RETURN json_build_object('success', true, 'message', 'Contest rejected successfully');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION publish_contest(contest_id UUID)
RETURNS JSON AS $$
DECLARE
    contest_record RECORD;
BEGIN
    -- Get contest details
    SELECT * INTO contest_record FROM contests WHERE id = contest_id;
    
    IF contest_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Contest not found');
    END IF;
    
    -- Validate contest is approved
    IF contest_record.moderation_status != 'approved' THEN
        RETURN json_build_object('success', false, 'error', 'Contest must be approved before publishing');
    END IF;
    
    -- Validate dates are still in future
    IF contest_record.start_date <= NOW() THEN
        RETURN json_build_object('success', false, 'error', 'Cannot publish contest with past start date');
    END IF;
    
    -- Publish contest
    UPDATE contests SET
        moderation_status = 'published',
        published_at = NOW(),
        updated_at = NOW()
    WHERE id = contest_id;
    
    RETURN json_build_object('success', true, 'message', 'Contest published successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create helpful views for different user types
CREATE VIEW admin_contest_queue AS
SELECT 
    c.*,
    u.full_name as brand_name,
    u.email as brand_email,
    ap.company_name,
    -- Time since submission
    EXTRACT(EPOCH FROM (NOW() - c.submitted_for_approval_at))/3600 as hours_pending
FROM contests_with_status c
JOIN users u ON c.advertiser_id = u.id
LEFT JOIN advertiser_profiles ap ON c.advertiser_id = ap.id
WHERE c.moderation_status = 'pending_approval'
ORDER BY c.submitted_for_approval_at ASC;

CREATE VIEW brand_contests_summary AS
SELECT 
    advertiser_id,
    COUNT(*) as total_contests,
    COUNT(*) FILTER (WHERE moderation_status = 'draft') as draft_count,
    COUNT(*) FILTER (WHERE moderation_status = 'pending_approval') as pending_count,
    COUNT(*) FILTER (WHERE moderation_status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE moderation_status = 'published') as published_count,
    COUNT(*) FILTER (WHERE moderation_status = 'rejected') as rejected_count
FROM contests
GROUP BY advertiser_id;

-- Success message
SELECT 'Optimized contest moderation system installed successfully!' as message; 