-- Update contests_with_status view to include payment_details column
-- Drop the existing view and recreate it with the new column

DROP VIEW IF EXISTS public.contests_with_status;

CREATE VIEW public.contests_with_status AS
SELECT
  contests.id,
  contests.advertiser_id,
  contests.title,
  contests.platform,
  contests.start_date,
  contests.end_date,
  contests.thumbnail_url,
  contests.resources,
  contests.category,
  contests.inspiration_links,
  contests.created_at,
  contests.subscription_plan_of_user,
  contests.updated_at,
  contests.contest_type,
  contests.contest_based_details,
  contests.live_submission_count,
  contests.post_contest_status,
  contests.brief_html,
  contests.brief_json,
  contests.last_metrics_updated,
  contests.rules_html,
  contests.rules_json,
  contests.moderation_status,
  contests.submitted_for_approval_at,
  contests.approved_at,
  contests.approved_by,
  contests.published_at,
  contests.rejection_reason,
  contests.payment_details,  -- Added payment_details column
  CASE
    WHEN contests.moderation_status <> 'published'::contest_moderation_status_enum THEN NULL::text
    WHEN contests.start_date IS NULL
    OR contests.end_date IS NULL THEN 'incomplete'::text
    WHEN (NOW() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
    WHEN (NOW() AT TIME ZONE 'UTC'::text) >= contests.start_date
    AND (NOW() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
    WHEN (NOW() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status
FROM
  contests;

-- Add comment explaining the view
COMMENT ON VIEW public.contests_with_status IS 'View that includes all contest columns plus computed status field and payment_details for easy querying';

SELECT 'contests_with_status view updated successfully with payment_details column!' as message; 