-- Post-campaign metrics overlay: refreshed independently of locked submissions.
--
-- DEPLOY ORDER (required before enabling Post Campaign UI / refresh routes):
--   1) 20260715_post_campaign_submission_metrics.sql  (this file)
--   2) 20260716_admin_analytics_pc_daily_rpc.sql
--   3) 20260717_post_campaign_security_fixes.sql
-- Do not deploy app code that references metrics_target / PC RPCs until all three run.

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS post_campaign_last_metrics_updated timestamp with time zone;

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS post_campaign_last_synced_at timestamp with time zone;

COMMENT ON COLUMN public.contests.post_campaign_last_metrics_updated IS
  'Last time post-campaign submission metrics were refreshed (independent of submissions.last_metrics_updated).';

COMMENT ON COLUMN public.contests.post_campaign_last_synced_at IS
  'Last time submissions were synced into the post-campaign overlay (rate-limits sync, including first sync).';

-- Append column via CREATE OR REPLACE (safe if prior definition matches 20260630).
-- Avoid DROP VIEW: dependents keep working; REPLACE fails loudly if column order/types diverge.
-- Pre-prod gate: compare live contests_with_status columns to the SELECT below.
CREATE OR REPLACE VIEW public.contests_with_status
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
  'All contest columns plus computed status. Includes trust/quality gates, post_campaign_last_metrics_updated, and post_campaign_last_synced_at.';

-- Base table (no-op if an older metrics-only version already exists).
CREATE TABLE IF NOT EXISTS public.post_campaign_submission_metrics (
  submission_id uuid PRIMARY KEY REFERENCES public.submissions(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  views bigint DEFAULT 0,
  other_stats jsonb,
  last_insights_update timestamp with time zone,
  insights_status text,
  synced_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Upgrade / ensure full submission snapshot columns (safe on both new + existing tables).
-- Must run BEFORE indexes that reference these columns.
ALTER TABLE public.post_campaign_submission_metrics
  ADD COLUMN IF NOT EXISTS creator_id uuid,
  ADD COLUMN IF NOT EXISTS content_link text,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS video_id text,
  ADD COLUMN IF NOT EXISTS video_title text,
  ADD COLUMN IF NOT EXISTS video_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS status public.submission_status_enum,
  ADD COLUMN IF NOT EXISTS earnings bigint,
  ADD COLUMN IF NOT EXISTS views_locked bigint,
  ADD COLUMN IF NOT EXISTS affiliate_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS affiliate_metadata jsonb,
  ADD COLUMN IF NOT EXISTS paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS bonus_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS bonus_amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS milestone_bonus_paid jsonb,
  ADD COLUMN IF NOT EXISTS dual_rewards_payout jsonb,
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS quality_score_backfilled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_updated_at timestamp with time zone;

-- Backfill snapshot fields from submissions for any rows missing creator_id.
UPDATE public.post_campaign_submission_metrics pc
SET
  creator_id = s.creator_id,
  content_link = s.content_link,
  metadata = s.metadata,
  created_at = s.created_at,
  video_id = s.video_id,
  video_title = s.video_title,
  video_thumbnail_url = s.video_thumbnail_url,
  platform = s.platform,
  status = s.status,
  earnings = s.earnings,
  views_locked = s.views_locked,
  affiliate_paid = s.affiliate_paid,
  affiliate_metadata = s.affiliate_metadata,
  paid = s.paid,
  paid_at = s.paid_at,
  bonus_paid = s.bonus_paid,
  bonus_paid_at = s.bonus_paid_at,
  bonus_amount = s.bonus_amount,
  milestone_bonus_paid = s.milestone_bonus_paid,
  dual_rewards_payout = s.dual_rewards_payout,
  quality_score = s.quality_score,
  quality_score_backfilled = COALESCE(s.quality_score_backfilled, false),
  submission_updated_at = s.updated_at,
  views = COALESCE(pc.views, s.views),
  other_stats = COALESCE(pc.other_stats, s.other_stats),
  last_insights_update = COALESCE(pc.last_insights_update, s.last_insights_update),
  insights_status = COALESCE(pc.insights_status, s.insights_status)
FROM public.submissions s
WHERE s.id = pc.submission_id
  AND pc.creator_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_campaign_submission_metrics_contest_id
  ON public.post_campaign_submission_metrics (contest_id);

CREATE INDEX IF NOT EXISTS idx_post_campaign_submission_metrics_creator_id
  ON public.post_campaign_submission_metrics (contest_id, creator_id);

COMMENT ON TABLE public.post_campaign_submission_metrics IS
  'Full snapshot of each submission for post-campaign review. Sync copies all submission fields; refresh updates metrics only. Original submissions table is never modified.';

ALTER TABLE public.post_campaign_submission_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_campaign_metrics_select_authenticated"
  ON public.post_campaign_submission_metrics;

DROP POLICY IF EXISTS "post_campaign_metrics_admins_all"
  ON public.post_campaign_submission_metrics;
CREATE POLICY "post_campaign_metrics_admins_all"
  ON public.post_campaign_submission_metrics
  FOR ALL
  TO authenticated
  USING (
    (SELECT users.user_type FROM public.users WHERE users.id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT users.user_type FROM public.users WHERE users.id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "post_campaign_metrics_advertisers_select"
  ON public.post_campaign_submission_metrics;
CREATE POLICY "post_campaign_metrics_advertisers_select"
  ON public.post_campaign_submission_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = post_campaign_submission_metrics.contest_id
        AND c.advertiser_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "post_campaign_metrics_creators_select"
  ON public.post_campaign_submission_metrics;

DROP POLICY IF EXISTS "post_campaign_metrics_service_role_all"
  ON public.post_campaign_submission_metrics;
CREATE POLICY "post_campaign_metrics_service_role_all"
  ON public.post_campaign_submission_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
