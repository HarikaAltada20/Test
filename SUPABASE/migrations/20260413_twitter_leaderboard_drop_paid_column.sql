-- Single source of truth: payment at creator level is moderation_status = 'paid'
-- (with paid_at, earnings, paid_rank as metadata). Drop redundant boolean `paid`.

-- Align any legacy rows where paid was true but status was not updated
UPDATE public.twitter_campaign_leaderboard
SET moderation_status = 'paid'
WHERE COALESCE(paid, false) = true
  AND moderation_status IS DISTINCT FROM 'paid';

DROP INDEX IF EXISTS public.idx_twitter_leaderboard_paid;

ALTER TABLE public.twitter_campaign_leaderboard
  DROP COLUMN IF EXISTS paid;

CREATE INDEX IF NOT EXISTS idx_twitter_leaderboard_moderation_paid
  ON public.twitter_campaign_leaderboard (contest_id)
  WHERE moderation_status = 'paid';

COMMENT ON COLUMN public.twitter_campaign_leaderboard.moderation_status IS
  'Creator-level workflow: pending, verified (approved, unpaid), rejected, paid (approved and creator-level payout recorded — use paid_at/earnings/paid_rank for details).';
