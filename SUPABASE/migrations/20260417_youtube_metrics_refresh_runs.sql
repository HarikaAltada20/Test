-- YouTube metrics / analytics refresh runs (queue-based). At most one active run per contest.
CREATE TABLE IF NOT EXISTS public.youtube_metrics_refresh_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  scope text NOT NULL CHECK (scope IN ('basic', 'core', 'traffic', 'demographics', 'all')),
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_youtube_refresh_runs_one_active
  ON public.youtube_metrics_refresh_runs (contest_id)
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_youtube_refresh_runs_contest_id
  ON public.youtube_metrics_refresh_runs (contest_id);

CREATE INDEX IF NOT EXISTS idx_youtube_refresh_runs_status
  ON public.youtube_metrics_refresh_runs (status)
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_submissions_youtube_queue_batch
  ON public.submissions (contest_id, id)
  WHERE platform ILIKE '%youtube%' AND content_link IS NOT NULL;

COMMENT ON TABLE public.youtube_metrics_refresh_runs IS 'Tracks YouTube refresh runs (basic Data API and/or Analytics API scopes). At most one active run per contest.';
COMMENT ON COLUMN public.youtube_metrics_refresh_runs.scope IS 'basic=Data API; core/traffic/demographics=Analytics API; all=basic+all analytics.';
