-- Rename total_other_earnings to affiliate_earnings in users table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'total_other_earnings'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'affiliate_earnings'
  ) THEN
    ALTER TABLE public.users
      RENAME COLUMN total_other_earnings TO affiliate_earnings;
  END IF;
END $$;

-- Update index name if it exists
DROP INDEX IF EXISTS idx_users_total_other_earnings;
DROP INDEX IF EXISTS idx_users_other_earnings_gt0;

CREATE INDEX IF NOT EXISTS idx_users_affiliate_earnings
  ON public.users (affiliate_earnings);

CREATE INDEX IF NOT EXISTS idx_users_affiliate_earnings_gt0
  ON public.users (affiliate_earnings) WHERE (affiliate_earnings > 0);

