-- Post-campaign security & concurrency fixes.
-- Run after 20260715 and 20260716.

-- ---------------------------------------------------------------------------
-- RLS: scope post-campaign overlay like submissions (not world-readable).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Metrics refresh runs: one active run per (contest_id, metrics_target).
-- ---------------------------------------------------------------------------
ALTER TABLE public.instagram_insights_refresh_runs
  ADD COLUMN IF NOT EXISTS metrics_target text NOT NULL DEFAULT 'submissions';

ALTER TABLE public.youtube_metrics_refresh_runs
  ADD COLUMN IF NOT EXISTS metrics_target text NOT NULL DEFAULT 'submissions';

ALTER TABLE public.tiktok_metrics_refresh_runs
  ADD COLUMN IF NOT EXISTS metrics_target text NOT NULL DEFAULT 'submissions';

ALTER TABLE public.instagram_insights_refresh_runs
  DROP CONSTRAINT IF EXISTS instagram_insights_refresh_runs_metrics_target_check;
ALTER TABLE public.instagram_insights_refresh_runs
  ADD CONSTRAINT instagram_insights_refresh_runs_metrics_target_check
  CHECK (metrics_target IN ('submissions', 'post_campaign'));

ALTER TABLE public.youtube_metrics_refresh_runs
  DROP CONSTRAINT IF EXISTS youtube_metrics_refresh_runs_metrics_target_check;
ALTER TABLE public.youtube_metrics_refresh_runs
  ADD CONSTRAINT youtube_metrics_refresh_runs_metrics_target_check
  CHECK (metrics_target IN ('submissions', 'post_campaign'));

ALTER TABLE public.tiktok_metrics_refresh_runs
  DROP CONSTRAINT IF EXISTS tiktok_metrics_refresh_runs_metrics_target_check;
ALTER TABLE public.tiktok_metrics_refresh_runs
  ADD CONSTRAINT tiktok_metrics_refresh_runs_metrics_target_check
  CHECK (metrics_target IN ('submissions', 'post_campaign'));

DROP INDEX IF EXISTS public.idx_instagram_refresh_runs_one_active;
CREATE UNIQUE INDEX idx_instagram_refresh_runs_one_active
  ON public.instagram_insights_refresh_runs (contest_id, metrics_target)
  WHERE status IN ('pending', 'running');

DROP INDEX IF EXISTS public.idx_youtube_refresh_runs_one_active;
CREATE UNIQUE INDEX idx_youtube_refresh_runs_one_active
  ON public.youtube_metrics_refresh_runs (contest_id, metrics_target)
  WHERE status IN ('pending', 'running');

DROP INDEX IF EXISTS public.idx_tiktok_refresh_runs_one_active;
CREATE UNIQUE INDEX idx_tiktok_refresh_runs_one_active
  ON public.tiktok_metrics_refresh_runs (contest_id, metrics_target)
  WHERE status IN ('pending', 'running');

COMMENT ON COLUMN public.instagram_insights_refresh_runs.metrics_target IS
  'submissions = live contest submissions; post_campaign = post_campaign_submission_metrics overlay.';
COMMENT ON COLUMN public.youtube_metrics_refresh_runs.metrics_target IS
  'submissions = live contest submissions; post_campaign = post_campaign_submission_metrics overlay.';
COMMENT ON COLUMN public.tiktok_metrics_refresh_runs.metrics_target IS
  'submissions = live contest submissions; post_campaign = post_campaign_submission_metrics overlay.';

-- ---------------------------------------------------------------------------
-- Admin analytics RPCs: service_role only (admin route uses service client).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_analytics_pc_daily(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_pc_daily(timestamptz, timestamptz, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_pc_daily(timestamptz, timestamptz, uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.admin_analytics_pc_contest_ids(timestamptz, timestamptz, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_pc_contest_ids(timestamptz, timestamptz, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_pc_contest_ids(timestamptz, timestamptz, uuid[]) TO service_role;
