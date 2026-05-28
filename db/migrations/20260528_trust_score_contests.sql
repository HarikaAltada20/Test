-- Per-campaign minimum trust score (brand/admin).

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS trust_score integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contests_trust_score_range'
  ) THEN
    ALTER TABLE public.contests
      ADD CONSTRAINT contests_trust_score_range
      CHECK (trust_score IS NULL OR (trust_score >= 0 AND trust_score <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.contests.trust_score IS 'Optional. NULL = no trust requirement for this campaign. Set 0-100 to require creator trust_score >= this value to submit.';

CREATE INDEX IF NOT EXISTS idx_contests_trust_score
  ON public.contests (trust_score)
  WHERE trust_score IS NOT NULL;
