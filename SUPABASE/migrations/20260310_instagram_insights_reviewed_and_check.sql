-- Add reviewed_count to Instagram insights refresh runs (submissions considered per run).
ALTER TABLE instagram_insights_refresh_runs
  ADD COLUMN IF NOT EXISTS reviewed_count integer NOT NULL DEFAULT 0;

-- Constrain insights_status to allowed values (ok, temporary_failure, permanent_failure).
-- Existing NULL or valid values pass; invalid values must be fixed before applying.
ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_insights_status_check;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_insights_status_check
  CHECK (insights_status IS NULL OR insights_status IN ('ok', 'temporary_failure', 'permanent_failure'));

COMMENT ON COLUMN instagram_insights_refresh_runs.reviewed_count IS 'Total submissions reviewed (considered) in this run. Processed = actually updated.';
