-- Migration to add missing fields to contests_with_status view
-- Just add the missing brief_html and brief_json fields

-- Must drop first to avoid column position conflicts
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
  contests.brief,
  contests.brief_html,     -- Added missing field
  contests.brief_json,     -- Added missing field
  contests.rules,
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
  CASE
    WHEN contests.is_draft THEN 'draft'::text
    WHEN contests.start_date IS NULL
    OR contests.end_date IS NULL THEN 'incomplete'::text
    WHEN (NOW() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
    WHEN (NOW() AT TIME ZONE 'UTC'::text) >= contests.start_date
    AND (NOW() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
    WHEN (NOW() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status
FROM
  public.contests;

COMMENT ON VIEW public.contests_with_status IS 'Contests view with brief_html and brief_json fields added for rich text editor support'; 