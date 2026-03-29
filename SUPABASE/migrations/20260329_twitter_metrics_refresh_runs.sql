-- Twitter metrics refresh runs (queue-based): mirrors instagram_insights_refresh_runs pattern.
-- At most one active (pending/running) run per contest.

CREATE TABLE IF NOT EXISTS twitter_metrics_refresh_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  is_raid boolean NOT NULL DEFAULT false,
  creator_scope_id uuid NULL,
  total_batches integer NOT NULL DEFAULT 1,
  current_batch_index integer NOT NULL DEFAULT 0,
  total_participants integer NOT NULL DEFAULT 0,
  processed_participants integer NOT NULL DEFAULT 0,
  tweets_upserted integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  last_batch_completed_at timestamptz,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_twitter_metrics_refresh_runs_one_active
  ON twitter_metrics_refresh_runs (contest_id)
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_twitter_metrics_refresh_runs_contest_id
  ON twitter_metrics_refresh_runs (contest_id);

CREATE INDEX IF NOT EXISTS idx_twitter_metrics_refresh_runs_status
  ON twitter_metrics_refresh_runs (status)
  WHERE status IN ('pending', 'running');

COMMENT ON TABLE twitter_metrics_refresh_runs IS 'Tracks each Twitter metrics refresh run (Redis queue). At most one active run per contest.';
COMMENT ON COLUMN twitter_metrics_refresh_runs.creator_scope_id IS 'When set, this run only refreshes metrics for this creator (creator-only feed refresh).';
