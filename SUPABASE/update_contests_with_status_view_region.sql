-- Update contests_with_status view to include region column
-- This should be run after add_region_column_to_contests.sql

CREATE OR REPLACE VIEW public.contests_with_status WITH (security_invoker='on') AS
 SELECT contests.id,
    contests.advertiser_id,
    contests.title,
    contests.platform,
    contests.start_date,
    contests.end_date,
    contests.thumbnail_url,
    contests.resources,
    contests.category, -- Deprecated: Use categories column instead
    contests.categories,
    contests.subcategories,
    contests.interests,
    contests.region,
    contests.inspiration_links,
    contests.tracking_links,
    contests.created_at,
    contests.subscription_info_of_user,
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
    contests.payment_details,
    -- Computed status field (must come BEFORE new columns to match existing queries)
        CASE
            WHEN (contests.moderation_status <> 'published'::public.contest_moderation_status_enum) THEN NULL::text
            WHEN ((contests.start_date IS NULL) OR (contests.end_date IS NULL)) THEN 'incomplete'::text
            WHEN ((now() AT TIME ZONE 'UTC'::text) < contests.start_date) THEN 'upcoming'::text
            WHEN (((now() AT TIME ZONE 'UTC'::text) >= contests.start_date) AND ((now() AT TIME ZONE 'UTC'::text) < contests.end_date)) THEN 'active'::text
            WHEN ((now() AT TIME ZONE 'UTC'::text) >= contests.end_date) THEN 'ended'::text
            ELSE 'unknown'::text
        END AS status,
    contests.views_locked_at,
    contests.multiple_submissions_enabled,
    contests.max_submissions_per_creator,
    contests.content_type,
    contests.bonus_details,
    contests.max_earnings_per_creator
   FROM public.contests;

