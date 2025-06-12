-- Clean contests table schema (no old data migration needed)

-- First drop the view that depends on old columns
DROP VIEW IF EXISTS public.contests_with_status;

-- Update contests table structure
ALTER TABLE public.contests 
ADD COLUMN IF NOT EXISTS rules_html TEXT,
ADD COLUMN IF NOT EXISTS rules_json JSONB;

-- Now drop old redundant columns (view is gone, so this will work)
ALTER TABLE public.contests 
DROP COLUMN IF EXISTS brief,
DROP COLUMN IF EXISTS rules;

-- Create indexes for rich text search
CREATE INDEX IF NOT EXISTS idx_contests_brief_html 
ON public.contests USING gin (to_tsvector('english'::regconfig, brief_html));

CREATE INDEX IF NOT EXISTS idx_contests_rules_html 
ON public.contests USING gin (to_tsvector('english'::regconfig, rules_html));

-- Update contests_with_status view to only include new fields
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
  CASE
    WHEN contests.is_draft THEN 'draft'::text
    WHEN contests.start_date IS NULL
    OR contests.end_date IS NULL THEN 'incomplete'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.start_date
    AND (now() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status
FROM contests;