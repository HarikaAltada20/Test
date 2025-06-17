-- Create moderation status enum
CREATE TYPE contest_moderation_status_enum AS ENUM (
    'draft',           -- Brand is still working on it
    'pending_approval', -- Submitted for admin review
    'approved',        -- Admin approved, ready to publish
    'published',       -- Contest is live
    'rejected'         -- Admin rejected, needs changes
); 