-- Migration: Add categories, subcategories, and interests columns to contests table
-- Date: 2025-01-XX
-- Description: Adds categories, subcategories, and interests as JSONB columns to replace the single category field

-- Add new columns to contests table
ALTER TABLE public.contests
ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subcategories JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.contests.categories IS 'JSONB array of category IDs selected for this contest (max 3). Stored as JSON array: ["beauty", "fashion", "tech"]';
COMMENT ON COLUMN public.contests.subcategories IS 'JSONB object grouping subcategories by category. Stored as JSON object: {"beauty": ["Skincare", "Makeup", "Haircare"], "sports": ["Football / Soccer", "Basketball"], ...}. This format avoids repeating category names and groups subcategories efficiently.';
COMMENT ON COLUMN public.contests.interests IS 'JSONB array of interests selected for this contest. Stored as JSON array: ["Beauty", "Skincare", "Makeup", ...]';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contests_categories ON public.contests USING GIN(categories) WHERE categories IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contests_subcategories ON public.contests USING GIN(subcategories) WHERE subcategories IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contests_interests ON public.contests USING GIN(interests) WHERE interests IS NOT NULL;

-- Note: The old 'category' column is kept for backward compatibility but should not be used for new contests

-- Update contests_with_status view to include new columns
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

