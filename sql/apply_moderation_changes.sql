-- Apply Contest Moderation System Changes
-- Run this file to add moderation functionality to contests

-- 1. Create moderation status enum
CREATE TYPE contest_moderation_status_enum AS ENUM (
    'draft',           -- Brand is still working on it
    'pending_approval', -- Submitted for admin review
    'approved',        -- Admin approved, ready to publish
    'published',       -- Contest is live
    'rejected'         -- Admin rejected, needs changes
);

-- 2. Add moderation fields to contests table
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

-- 3. Update contests_with_status view
DROP VIEW IF EXISTS contests_with_status;

CREATE VIEW contests_with_status AS
SELECT
  contests.id,
  contests.advertiser_id,
  contests.title,
  contests.platform,
  contests.start_date,
  contests.end_date,
  contests.thumbnail_url,
  contests.brief_html,
  contests.brief_json,
  contests.rules_html,
  contests.rules_json,
  contests.resources,
  contests.category,
  contests.inspiration_links,
  contests.created_at,
  contests.is_draft,
  contests.subscription_plan_of_user,
  contests.updated_at,
  contests.contest_type,
  contests.contest_based_details,
  contests.post_contest_status,
  contests.live_submission_count,
  contests.last_metrics_updated,
  contests.moderation_status,
  contests.submitted_for_approval_at,
  contests.approved_at,
  contests.approved_by,
  contests.published_at,
  contests.rejection_reason,
  -- Status logic: prioritize moderation_status, fallback to is_draft logic
  CASE
    -- If moderation_status exists, use it for moderation workflow
    WHEN contests.moderation_status = 'draft' THEN 'draft'::text
    WHEN contests.moderation_status = 'pending_approval' THEN 'pending_approval'::text
    WHEN contests.moderation_status = 'approved' THEN 'approved'::text
    WHEN contests.moderation_status = 'rejected' THEN 'rejected'::text
    WHEN contests.moderation_status = 'published' THEN
      -- For published contests, check time-based status
      CASE
        WHEN contests.start_date IS NULL OR contests.end_date IS NULL THEN 'incomplete'::text
        WHEN (now() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
        WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.start_date
        AND (now() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
        WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
        ELSE 'unknown'::text
      END
    -- Fallback to old logic for backward compatibility
    WHEN contests.is_draft = true THEN 'draft'::text
    WHEN contests.start_date IS NULL OR contests.end_date IS NULL THEN 'incomplete'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.start_date
    AND (now() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status
FROM contests;

-- Optional: Create helper functions for moderation workflow
CREATE OR REPLACE FUNCTION update_contest_moderation_status(
    contest_id UUID,
    new_status contest_moderation_status_enum,
    admin_user_id UUID DEFAULT NULL,
    rejection_reason_text TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Update the contest with new status and timestamps
    UPDATE contests SET
        moderation_status = new_status,
        submitted_for_approval_at = CASE 
            WHEN new_status = 'pending_approval' THEN NOW() 
            ELSE submitted_for_approval_at 
        END,
        approved_at = CASE 
            WHEN new_status = 'approved' THEN NOW() 
            ELSE approved_at 
        END,
        approved_by = CASE 
            WHEN new_status = 'approved' THEN admin_user_id 
            ELSE approved_by 
        END,
        published_at = CASE 
            WHEN new_status = 'published' THEN NOW() 
            ELSE published_at 
        END,
        rejection_reason = CASE 
            WHEN new_status = 'rejected' THEN rejection_reason_text 
            ELSE rejection_reason 
        END,
        -- Keep is_draft in sync for backward compatibility
        is_draft = CASE 
            WHEN new_status IN ('draft', 'rejected') THEN true 
            ELSE false 
        END,
        updated_at = NOW()
    WHERE id = contest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_edit_contest(
    contest_id UUID,
    edit_type TEXT DEFAULT 'content'  -- 'content' or 'dates'
) RETURNS boolean AS $$
DECLARE
    current_status contest_moderation_status_enum;
BEGIN
    SELECT moderation_status INTO current_status
    FROM contests 
    WHERE id = contest_id;
    
    -- Allow editing based on status and edit type
    RETURN CASE 
        WHEN current_status IN ('draft', 'rejected') THEN true
        WHEN current_status = 'approved' AND edit_type = 'dates' THEN true
        ELSE false
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
SELECT 'Contest moderation system successfully installed!' as message; 