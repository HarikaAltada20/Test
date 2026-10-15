-- Per-campaign control over what brands see about applicants to a Restricted
-- campaign (connected accounts, follower counts, scores, basics).
-- Only admins may change it; brands see everything unless an admin turns a
-- field off. Keys missing from the object default to visible.

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS applicant_visibility jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.contests.applicant_visibility IS
  'Admin-only. { field: false } hides that applicant detail from the brand. Fields: accounts, followers, trust, quality, activity, basics.';

-- Brands can insert and update their own contests directly, so they can't set
-- this column: their inserts get the default and their updates keep the old
-- value. Server code using the service role (auth.uid() is null) and admins
-- may change it.
CREATE OR REPLACE FUNCTION public.contests_guard_applicant_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.applicant_visibility := '{}'::jsonb;
  ELSIF NEW.applicant_visibility IS DISTINCT FROM OLD.applicant_visibility THEN
    NEW.applicant_visibility := OLD.applicant_visibility;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contests_guard_applicant_visibility ON public.contests;
CREATE TRIGGER contests_guard_applicant_visibility
  BEFORE INSERT OR UPDATE OF applicant_visibility ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.contests_guard_applicant_visibility();
