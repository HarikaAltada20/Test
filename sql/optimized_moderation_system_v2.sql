-- Optimized Contest Moderation System v2
-- Keeps moderation_status and status separate for clarity

-- 1. Create moderation status enum
CREATE TYPE contest_moderation_status_enum AS ENUM (
    'draft',
    'pending_approval', 
    'approved',
    'published',
    'rejected'
);

-- 2. Update contests table (remove is_draft, add moderation fields)
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
CREATE INDEX idx_contests_published_at ON contests(published_at) WHERE published_at IS NOT NULL;

-- 4. Update view with separated concerns
DROP VIEW IF EXISTS contests_with_status;
CREATE VIEW contests_with_status AS
SELECT 
  contests.*,
  -- Keep moderation_status as-is for approval workflow
  contests.moderation_status,
  -- Status only matters for published contests (lifecycle status)
  CASE
    WHEN contests.moderation_status != 'published' THEN NULL
    WHEN contests.moderation_status = 'published' THEN
      CASE
        WHEN contests.start_date IS NULL OR contests.end_date IS NULL THEN 'incomplete'::text
        WHEN NOW() < contests.start_date THEN 'upcoming'::text
        WHEN NOW() >= contests.start_date AND NOW() < contests.end_date THEN 'active'::text
        WHEN NOW() >= contests.end_date THEN 'ended'::text
        ELSE 'unknown'::text
      END
    ELSE NULL
  END AS status
FROM contests;

-- Success message
SELECT 'Optimized contest moderation system v2 installed - separated concerns!' as message; 