-- TikTok metrics refresh runs: one row per refresh run per contest.
-- Partial unique index ensures at most one active (pending/running) run per contest.
CREATE TABLE IF NOT EXISTS public.tiktok_metrics_refresh_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_submissions integer NOT NULL DEFAULT 0,
  processed_submissions integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  permanent_failure_count integer NOT NULL DEFAULT 0,
  temporary_failure_count integer NOT NULL DEFAULT 0,
  skipped_recent_count integer NOT NULL DEFAULT 0,
  reviewed_count integer NOT NULL DEFAULT 0,
  current_batch_index integer NOT NULL DEFAULT 0,
  total_batches integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  last_batch_completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  error_message text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_refresh_runs_one_active ON public.tiktok_metrics_refresh_runs (contest_id) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_tiktok_refresh_runs_contest_id ON public.tiktok_metrics_refresh_runs (contest_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_refresh_runs_status ON public.tiktok_metrics_refresh_runs (status) WHERE status IN ('pending', 'running');

-- Composite index for cursor-based batch query: contest_id, platform, last_insights_update, id.
CREATE INDEX IF NOT EXISTS idx_submissions_tiktok_metrics_batch ON public.submissions (contest_id, platform, last_insights_update ASC NULLS FIRST, id) WHERE platform = 'tiktok' AND (video_id IS NOT NULL OR content_link IS NOT NULL);

-- Index for admin filters by insights_status.
CREATE INDEX IF NOT EXISTS idx_submissions_tiktok_insights_status ON public.submissions (contest_id, insights_status) WHERE platform = 'tiktok';

COMMENT ON TABLE public.tiktok_metrics_refresh_runs IS 'Tracks each TikTok metrics refresh run (queue-based). At most one active run per contest.';
