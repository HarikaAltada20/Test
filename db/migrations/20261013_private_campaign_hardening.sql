-- Private campaign hardening (run after 20261010 and 20261012).
--   1. Submissions of non-public campaigns are no longer world-readable.
--   2. Twitter campaign joins respect the access list.
--   3. Going private keeps existing Twitter participants (not only submitters).
-- Re-runnable.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Submissions read policy
-- ---------------------------------------------------------------------------

-- Campaigns whose submissions the caller may read via the public policy:
-- every public campaign plus private ones the caller is listed on.
-- Owner brands, admins and the submitting creator keep their own policies.
-- Returned as a set so the policy evaluates it once per query, not per row.
CREATE OR REPLACE FUNCTION public.viewable_submission_contest_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id FROM public.contests c WHERE c.access_mode = 'public'
  UNION
  SELECT a.contest_id FROM public.contest_access_list a WHERE a.user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.viewable_submission_contest_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viewable_submission_contest_ids()
  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public can view all submissions for leaderboard" ON public.submissions;
DROP POLICY IF EXISTS "Public can view submissions of viewable campaigns" ON public.submissions;
CREATE POLICY "Public can view submissions of viewable campaigns" ON public.submissions
  FOR SELECT
  USING (contest_id IN (SELECT public.viewable_submission_contest_ids()));

-- ---------------------------------------------------------------------------
-- 2. Twitter joins: same access gate as the submission trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.twitter_participant_enforce_campaign_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access_mode text;
BEGIN
  SELECT c.access_mode INTO v_access_mode
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  IF v_access_mode IS NULL OR v_access_mode = 'public' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contest_access_list a
    WHERE a.contest_id = NEW.contest_id AND a.user_id = NEW.creator_id
  ) THEN
    RAISE EXCEPTION
      'campaign_access_denied: Creator is not on this private campaign''s access list'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- Existing participants of campaigns that are already private keep access.
INSERT INTO public.contest_access_list (contest_id, user_id, source)
SELECT DISTINCT p.contest_id, p.creator_id, 'existing_submitter'
FROM public.twitter_campaign_participants p
JOIN public.contests c ON c.id = p.contest_id
JOIN public.users u ON u.id = p.creator_id
WHERE c.access_mode <> 'public'
ON CONFLICT (contest_id, user_id) DO NOTHING;

DROP TRIGGER IF EXISTS twitter_participants_enforce_campaign_access
  ON public.twitter_campaign_participants;
CREATE TRIGGER twitter_participants_enforce_campaign_access
  BEFORE INSERT OR UPDATE OF contest_id, creator_id
  ON public.twitter_campaign_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.twitter_participant_enforce_campaign_access();

-- ---------------------------------------------------------------------------
-- 3. Public -> non-public: keep submitters and Twitter participants
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.contest_access_grant_existing_submitters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.contest_access_list (contest_id, user_id, source, added_by)
  SELECT NEW.id, x.creator_id, 'existing_submitter', auth.uid()
  FROM (
    SELECT s.creator_id FROM public.submissions s
    WHERE s.contest_id = NEW.id AND s.creator_id IS NOT NULL
    UNION
    SELECT p.creator_id FROM public.twitter_campaign_participants p
    WHERE p.contest_id = NEW.id AND p.creator_id IS NOT NULL
  ) x
  JOIN public.users u ON u.id = x.creator_id
  ON CONFLICT (contest_id, user_id) DO NOTHING;
  RETURN NULL;
END;
$$;

COMMIT;
