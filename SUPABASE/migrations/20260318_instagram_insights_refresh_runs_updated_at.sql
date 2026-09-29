-- Add updated_at to instagram_insights_refresh_runs for consistent "last updated" tracking.
ALTER TABLE instagram_insights_refresh_runs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN instagram_insights_refresh_runs.updated_at IS 'Last time this run row was updated (progress, status changes, etc.).';

