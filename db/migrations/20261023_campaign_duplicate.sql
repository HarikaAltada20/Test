-- Duplicate a campaign into a new draft ("Copy an existing campaign").
--
-- The copy itself is made by POST /api/campaigns/duplicate with the service
-- role, after it has checked who may copy what. This migration only adds the
-- link from a copy to the campaign it was made from, for the "Copied from"
-- banner in the wizard and for reporting.
--
-- Safe to run more than once. Apply after 20261020_campaign_access_final.sql.

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS duplicated_from_contest_id uuid
    REFERENCES public.contests(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contests.duplicated_from_contest_id IS
  'Campaign this draft was copied from (set by the duplicate API). Null when the original is deleted.';

CREATE INDEX IF NOT EXISTS contests_duplicated_from_contest_id_idx
  ON public.contests (duplicated_from_contest_id)
  WHERE duplicated_from_contest_id IS NOT NULL;

-- Brands insert and update their own contests directly, so they can't set
-- this column themselves: their inserts get null and their updates keep the
-- old value. Clearing it is always allowed, because deleting the original
-- clears it on every copy (ON DELETE SET NULL runs as an UPDATE). Server
-- code using the service role (auth.uid() is null) and admins may set it.
CREATE OR REPLACE FUNCTION public.contests_guard_duplicated_from()
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
    NEW.duplicated_from_contest_id := NULL;
  ELSIF NEW.duplicated_from_contest_id IS NOT NULL
    AND NEW.duplicated_from_contest_id IS DISTINCT FROM OLD.duplicated_from_contest_id THEN
    NEW.duplicated_from_contest_id := OLD.duplicated_from_contest_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.contests_guard_duplicated_from() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS contests_guard_duplicated_from ON public.contests;
CREATE TRIGGER contests_guard_duplicated_from
  BEFORE INSERT OR UPDATE OF duplicated_from_contest_id ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.contests_guard_duplicated_from();
