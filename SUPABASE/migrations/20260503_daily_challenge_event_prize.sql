-- Daily Challenge event prize configuration

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'competition_event'
      AND column_name = 'prize_amount_cents'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'competition_event'
      AND column_name = 'prize_amount_minor_units'
  ) THEN
    ALTER TABLE public.competition_event
      RENAME COLUMN prize_amount_cents TO prize_amount_minor_units;
  END IF;
END $$;

ALTER TABLE public.competition_event
  ADD COLUMN IF NOT EXISTS prize_amount_minor_units bigint NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS prize_currency text NOT NULL DEFAULT 'INR';

ALTER TABLE public.competition_event
  DROP CONSTRAINT IF EXISTS competition_event_prize_amount_check;

ALTER TABLE public.competition_event
  ADD CONSTRAINT competition_event_prize_amount_check
  CHECK (prize_amount_minor_units >= 0);

ALTER TABLE public.competition_event
  DROP CONSTRAINT IF EXISTS competition_event_prize_currency_check;

ALTER TABLE public.competition_event
  ADD CONSTRAINT competition_event_prize_currency_check
  CHECK (prize_currency ~ '^[A-Z]{3}$');

COMMENT ON COLUMN public.competition_event.prize_amount_minor_units IS
  'Daily Challenge prize per winner, stored in minor currency units such as paise for INR or cents for USD.';

COMMENT ON COLUMN public.competition_event.prize_currency IS
  'ISO currency code for Daily Challenge prize, e.g. INR or USD.';

DROP INDEX IF EXISTS public.idx_competition_event_active;

CREATE INDEX IF NOT EXISTS idx_competition_event_active
  ON public.competition_event (is_active, starts_at, ends_at);
