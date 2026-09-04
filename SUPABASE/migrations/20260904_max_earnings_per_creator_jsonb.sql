-- Allow multi-platform max earnings maps on contests.max_earnings_per_creator.
-- Single-platform contests continue to store a plain cents number (as jsonb numeric).
-- Multi-platform shape:
-- {
--   "youtube": { "max_earnings_per_creator": 6000 },
--   "instagram": { "max_earnings_per_creator": 7000 },
--   "tiktok": { "max_earnings_per_creator": 8000 }
-- }

-- View depends on contests.max_earnings_per_creator type; drop before ALTER.
DROP VIEW IF EXISTS public.contests_with_status;

ALTER TABLE public.contests
  ALTER COLUMN max_earnings_per_creator TYPE jsonb
  USING CASE
    WHEN max_earnings_per_creator IS NULL THEN NULL
    ELSE to_jsonb(max_earnings_per_creator)
  END;

COMMENT ON COLUMN public.contests.max_earnings_per_creator IS
  'Per-contest creator earnings cap. Single-platform: cents number (jsonb numeric). Multi-platform: { youtube|instagram|tiktok: { max_earnings_per_creator: cents } }.';

-- Recreate contests_with_status (matches 20260715_post_campaign_submission_metrics.sql).
CREATE VIEW public.contests_with_status
WITH (security_invoker = on) AS
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
  CASE
    WHEN contests.moderation_status <> 'published'::public.contest_moderation_status_enum THEN NULL::text
    WHEN contests.start_date IS NULL OR contests.end_date IS NULL THEN 'incomplete'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.start_date
      AND (now() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status,
  contests.views_locked_at,
  contests.multiple_submissions_enabled,
  contests.max_submissions_per_creator,
  contests.content_type,
  contests.bonus_details,
  contests.max_earnings_per_creator,
  contests.categories,
  contests.subcategories,
  contests.interests,
  contests.region,
  contests.contest_format,
  contests.payout_adjustment_percentage,
  contests.payout_adjustment_mode,
  contests.trust_score,
  contests.trust_number,
  contests.min_avg_quality_score,
  contests.min_best_quality_score,
  contests.min_platform_earnings,
  contests.min_platform_views,
  contests.min_quality_score,
  contests.post_campaign_last_metrics_updated,
  contests.post_campaign_last_synced_at
FROM public.contests;

COMMENT ON VIEW public.contests_with_status IS
  'All contest columns plus computed status. max_earnings_per_creator is jsonb (cents number or platform-keyed map).';
