-- Add affiliate flags to submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'affiliate_paid'
  ) THEN
    ALTER TABLE public.submissions
      ADD COLUMN affiliate_paid boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'affiliate_metadata'
  ) THEN
    ALTER TABLE public.submissions
      ADD COLUMN affiliate_metadata jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_affiliate_paid ON public.submissions (affiliate_paid);


