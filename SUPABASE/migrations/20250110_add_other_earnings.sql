-- Add other_earnings to users table (in cents) to track referral signup, coupon, and survey rewards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'other_earnings'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN other_earnings integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Helpful index for querying earners quickly
CREATE INDEX IF NOT EXISTS idx_users_other_earnings
  ON public.users (other_earnings);

