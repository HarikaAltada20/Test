-- Per-period prize amounts (shared currency) + snapshot prize at lock time.

ALTER TABLE public.competition_event
  ADD COLUMN IF NOT EXISTS weekly_prize_minor_units bigint,
  ADD COLUMN IF NOT EXISTS monthly_prize_minor_units bigint;

UPDATE public.competition_event
SET
  weekly_prize_minor_units = COALESCE(weekly_prize_minor_units, prize_amount_minor_units),
  monthly_prize_minor_units = COALESCE(monthly_prize_minor_units, prize_amount_minor_units)
WHERE weekly_prize_minor_units IS NULL
   OR monthly_prize_minor_units IS NULL;

ALTER TABLE public.competition_event
  ALTER COLUMN weekly_prize_minor_units SET DEFAULT 5000,
  ALTER COLUMN monthly_prize_minor_units SET DEFAULT 5000;

ALTER TABLE public.competition_event
  ALTER COLUMN weekly_prize_minor_units SET NOT NULL,
  ALTER COLUMN monthly_prize_minor_units SET NOT NULL;

ALTER TABLE public.competition_event
  DROP CONSTRAINT IF EXISTS competition_event_weekly_prize_check;

ALTER TABLE public.competition_event
  ADD CONSTRAINT competition_event_weekly_prize_check
  CHECK (weekly_prize_minor_units >= 0);

ALTER TABLE public.competition_event
  DROP CONSTRAINT IF EXISTS competition_event_monthly_prize_check;

ALTER TABLE public.competition_event
  ADD CONSTRAINT competition_event_monthly_prize_check
  CHECK (monthly_prize_minor_units >= 0);

COMMENT ON COLUMN public.competition_event.prize_amount_minor_units IS
  'Daily Challenge daily-period prize per winner (minor units).';

COMMENT ON COLUMN public.competition_event.weekly_prize_minor_units IS
  'Daily Challenge weekly-period prize per winner (minor units).';

COMMENT ON COLUMN public.competition_event.monthly_prize_minor_units IS
  'Daily Challenge monthly-period prize per winner (minor units).';

ALTER TABLE public.competition_daily_winner_snapshot
  ADD COLUMN IF NOT EXISTS prize_minor_units bigint,
  ADD COLUMN IF NOT EXISTS prize_currency text;

ALTER TABLE public.competition_daily_winner_snapshot
  DROP CONSTRAINT IF EXISTS competition_daily_winner_snapshot_prize_currency_check;

ALTER TABLE public.competition_daily_winner_snapshot
  ADD CONSTRAINT competition_daily_winner_snapshot_prize_currency_check
  CHECK (prize_currency IS NULL OR prize_currency ~ '^[A-Z]{3}$');
