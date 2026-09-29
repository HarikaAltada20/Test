-- Backfill views_locked_at for contests already in a metrics-locked post-contest status.
-- Ensures legacy cron paths that only check views_locked_at IS NULL skip in_review campaigns.

UPDATE public.contests
SET views_locked_at = COALESCE(updated_at, now())
WHERE views_locked_at IS NULL
  AND post_contest_status IN (
    'in_review',
    'verification_complete',
    'payouts_processed'
  );
