-- Expand Daily Challenge winner snapshots from daily-only to day/week/month periods.

ALTER TABLE public.competition_daily_winner_snapshot
  ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'day',
  ADD COLUMN IF NOT EXISTS period_start timestamptz,
  ADD COLUMN IF NOT EXISTS period_end timestamptz;

UPDATE public.competition_daily_winner_snapshot
SET
  period = COALESCE(period, 'day'),
  period_start = COALESCE(period_start, (snapshot_date::text || ' 00:00:00+05:30')::timestamptz),
  period_end = COALESCE(period_end, ((snapshot_date::text || ' 00:00:00+05:30')::timestamptz + interval '1 day'))
WHERE period_start IS NULL
   OR period_end IS NULL
   OR period IS NULL;

ALTER TABLE public.competition_daily_winner_snapshot
  ALTER COLUMN period_start SET NOT NULL,
  ALTER COLUMN period_end SET NOT NULL;

ALTER TABLE public.competition_daily_winner_snapshot
  DROP CONSTRAINT IF EXISTS competition_daily_winner_snapshot_period_check;

ALTER TABLE public.competition_daily_winner_snapshot
  ADD CONSTRAINT competition_daily_winner_snapshot_period_check
  CHECK (period IN ('day', 'week', 'month'));

ALTER TABLE public.competition_daily_winner_snapshot
  DROP CONSTRAINT IF EXISTS competition_daily_winner_snapshot_period_range_check;

ALTER TABLE public.competition_daily_winner_snapshot
  ADD CONSTRAINT competition_daily_winner_snapshot_period_range_check
  CHECK (period_end > period_start);

ALTER TABLE public.competition_daily_winner_snapshot
  DROP CONSTRAINT IF EXISTS competition_daily_winner_snapshot_unique;

ALTER TABLE public.competition_daily_winner_snapshot
  DROP CONSTRAINT IF EXISTS competition_daily_winner_snapshot_period_unique;

ALTER TABLE public.competition_daily_winner_snapshot
  ADD CONSTRAINT competition_daily_winner_snapshot_period_unique
  UNIQUE (event_id, period, period_start, period_end, category);

DROP INDEX IF EXISTS public.idx_competition_daily_snapshot_lookup;

CREATE INDEX IF NOT EXISTS idx_competition_daily_snapshot_lookup
  ON public.competition_daily_winner_snapshot (event_id, period, period_start DESC);
