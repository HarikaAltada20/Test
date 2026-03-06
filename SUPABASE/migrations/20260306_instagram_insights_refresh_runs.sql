-- Instagram insights refresh runs: one row per refresh run per contest.
-- Partial unique index ensures at most one active (pending/running) run per contest.
CREATE TABLE IF NOT EXISTS instagram_insights_refresh_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_submissions integer NOT NULL DEFAULT 0,
  processed_submissions integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  permanent_failure_count integer NOT NULL DEFAULT 0,
  temporary_failure_count integer NOT NULL DEFAULT 0,
  skipped_recent_count integer NOT NULL DEFAULT 0,
  current_batch_index integer NOT NULL DEFAULT 0,
  total_batches integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  last_batch_completed_at timestamptz,
  error_message text
);

CREATE UNIQUE INDEX idx_instagram_refresh_runs_one_active ON instagram_insights_refresh_runs (contest_id) WHERE status IN ('pending', 'running');
CREATE INDEX idx_instagram_refresh_runs_contest_id ON instagram_insights_refresh_runs (contest_id);
CREATE INDEX idx_instagram_refresh_runs_status ON instagram_insights_refresh_runs (status) WHERE status IN ('pending', 'running');

-- Add insights_status to submissions for Instagram (ok, permanent_failure, temporary_failure).
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS insights_status text;

-- Composite index for cursor-based batch query: contest_id, platform, last_insights_update, id.
CREATE INDEX IF NOT EXISTS idx_submissions_instagram_insights_batch ON submissions (contest_id, platform, last_insights_update ASC NULLS FIRST, id) WHERE platform = 'instagram' AND video_id IS NOT NULL;

-- Index for admin filters by insights_status.
CREATE INDEX IF NOT EXISTS idx_submissions_insights_status ON submissions (contest_id, insights_status) WHERE platform = 'instagram';

COMMENT ON TABLE instagram_insights_refresh_runs IS 'Tracks each Instagram insights refresh run (queue-based). At most one active run per contest.';
COMMENT ON COLUMN submissions.insights_status IS 'Instagram insights fetch result: ok, permanent_failure, temporary_failure.';
