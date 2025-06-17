-- Function to update contest moderation status with proper transitions
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

-- Function to check if contest can be edited based on status
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