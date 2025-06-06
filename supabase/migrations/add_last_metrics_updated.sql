-- Add last_metrics_updated column to contests table
-- This tracks when contest metrics (views, budget, etc.) were last updated by cron jobs
-- Separate from updated_at which tracks when contest details were last edited

ALTER TABLE contests 
ADD COLUMN last_metrics_updated TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment to explain the column purpose
COMMENT ON COLUMN contests.last_metrics_updated IS 'Timestamp when contest metrics (views, budget, leaderboard) were last updated by cron jobs';

-- Create index for efficient querying of refresh eligibility
CREATE INDEX idx_contests_last_metrics_updated ON contests (last_metrics_updated); 