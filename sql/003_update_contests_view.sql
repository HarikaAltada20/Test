-- Drop existing view
DROP VIEW IF EXISTS contests_with_status;

-- Recreate view with moderation logic
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