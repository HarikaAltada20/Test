-- Ensure essential indexes for analytics scalability
-- Safe to run multiple times (IF NOT EXISTS where supported)

-- Index for lookups by contest_id
CREATE INDEX IF NOT EXISTS idx_submissions_contest_id ON public.submissions (contest_id);

-- Composite index for status+contest_id filters/aggregations
CREATE INDEX IF NOT EXISTS idx_submissions_status_contest_id ON public.submissions (status, contest_id);

-- Optional: covering index for created_at sorts within contest
CREATE INDEX IF NOT EXISTS idx_submissions_contest_created_at ON public.submissions (contest_id, created_at DESC);
