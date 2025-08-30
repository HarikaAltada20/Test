-- Payouts & Ranking: Normal (non-concurrent) index build script
-- Purpose: Keep payouts fast/correct and prevent duplicate rewards, while supporting re‑pay after refund.

-- ORDER 1: Speed up status tabs (Pending/Verified/Rejected/Paid, Verified+Paid) sorted by views
CREATE INDEX IF NOT EXISTS idx_submissions_contest_status_views
ON public.submissions (contest_id, status, views DESC);

-- ORDER 2 (optional but recommended): Deterministic ties + fast time-based sorts
CREATE INDEX IF NOT EXISTS idx_submissions_contest_status_views_created
ON public.submissions (contest_id, status, views DESC, created_at ASC);

-- ORDER 3 (optional, for All tab): Fast sort by views and time when no status filter is applied
CREATE INDEX IF NOT EXISTS idx_submissions_contest_views
ON public.submissions (contest_id, views DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_contest_created
ON public.submissions (contest_id, created_at ASC);

-- ORDER 4: Rare fallback during reversals – keep lookups fast
CREATE INDEX IF NOT EXISTS idx_money_tx_user_type
ON public.money_transactions (user_id, type);

CREATE INDEX IF NOT EXISTS idx_money_tx_submission_id
ON public.money_transactions ((metadata->>'submission_id'));

-- ORDER 5: Safety – allow one reward per submission per payout cycle (prevents double pay in same cycle)
DROP INDEX IF EXISTS ux_reward_per_submission;
CREATE UNIQUE INDEX IF NOT EXISTS ux_reward_per_submission_cycle
ON public.money_transactions (
  (metadata->>'submission_id'),
  COALESCE(NULLIF(metadata->>'payout_cycle','')::int, 1)
)
WHERE type = 'reward';

-- ORDER 6: Backfill payout_cycle for legacy rewards so the unique rule works immediately
UPDATE public.money_transactions
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('payout_cycle', 1)
WHERE type = 'reward' AND (metadata->>'payout_cycle') IS NULL;

-- ORDER 7 (optional): Refresh planner stats
ANALYZE public.submissions;
ANALYZE public.money_transactions;

-- How to run (Supabase → SQL Editor):
-- 1) Paste this entire file, 2) Run. Normal CREATE INDEX blocks writes briefly but is fastest.
-- If tables are huge in the future, use CONCURRENTLY variants and uncheck "run in a single transaction".

