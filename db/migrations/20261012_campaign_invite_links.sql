-- Invite links for Private campaigns (Phase 2).
--
-- A brand or admin creates a link for a campaign; any signed-in creator who
-- redeems it is added to contest_access_list with source 'invite_link'.
-- Links can expire (expires_at) and/or cap joins (max_uses). Revoking a link
-- stops new joins; creators who already joined keep access.
--
-- Apply after db/migrations/20261010_campaign_access_private.sql.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contest_invite_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id  uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE CHECK (length(token) >= 24),
  label       text CHECK (label IS NULL OR length(btrim(label)) BETWEEN 1 AND 60),
  expires_at  timestamptz,
  max_uses    integer CHECK (max_uses IS NULL OR max_uses > 0),
  use_count   integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  revoked_at  timestamptz,
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contest_invite_links_contest
  ON public.contest_invite_links (contest_id, created_at DESC);

COMMENT ON COLUMN public.contest_invite_links.expires_at IS 'NULL = never expires.';
COMMENT ON COLUMN public.contest_invite_links.max_uses IS 'NULL = unlimited joins.';

-- ---------------------------------------------------------------------------
-- 2. Access list: new source + link reference
-- ---------------------------------------------------------------------------

ALTER TABLE public.contest_access_list
  ADD COLUMN IF NOT EXISTS source_invite_link_id uuid
    REFERENCES public.contest_invite_links(id) ON DELETE SET NULL;

ALTER TABLE public.contest_access_list
  DROP CONSTRAINT IF EXISTS contest_access_list_source_check;
ALTER TABLE public.contest_access_list
  ADD CONSTRAINT contest_access_list_source_check
  CHECK (source IN ('saved_list', 'manual', 'existing_submitter', 'invite_link'));

-- ---------------------------------------------------------------------------
-- 3. Row-level security: only the campaign's brand and admins manage links.
--    Creators never read this table; they go through the functions below.
-- ---------------------------------------------------------------------------

ALTER TABLE public.contest_invite_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brand or admin manages invite links" ON public.contest_invite_links;
CREATE POLICY "Brand or admin manages invite links" ON public.contest_invite_links
  TO authenticated
  USING (public.can_manage_contest_access(contest_id))
  WITH CHECK (public.can_manage_contest_access(contest_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contest_invite_links TO authenticated;
GRANT ALL ON public.contest_invite_links TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Functions
-- ---------------------------------------------------------------------------

-- Status order matters: a revoked link stays revoked even after the campaign
-- ends; a campaign that went public no longer needs the link at all.
CREATE OR REPLACE FUNCTION public.contest_invite_link_status(p_link_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN l.revoked_at IS NOT NULL THEN 'revoked'
      WHEN c.access_mode = 'public' THEN 'public'
      WHEN c.end_date IS NOT NULL AND c.end_date < now() THEN 'ended'
      WHEN l.expires_at IS NOT NULL AND l.expires_at <= now() THEN 'expired'
      WHEN l.max_uses IS NOT NULL AND l.use_count >= l.max_uses THEN 'full'
      ELSE 'active'
    END
    FROM public.contest_invite_links l
    JOIN public.contests c ON c.id = l.contest_id
    WHERE l.id = p_link_id
  ), 'not_found');
$$;

-- Landing-page preview. Returns only display fields, never the full campaign.
CREATE OR REPLACE FUNCTION public.get_contest_invite_preview(p_token text)
RETURNS TABLE (
  contest_id     uuid,
  title          text,
  brand_name     text,
  thumbnail_url  text,
  is_published   boolean,
  link_status    text,
  already_member boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_link_id    uuid;
  v_contest_id uuid;
BEGIN
  SELECT l.id, l.contest_id INTO v_link_id, v_contest_id
  FROM public.contest_invite_links l
  WHERE l.token = p_token;

  IF v_link_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text,
      false, 'not_found'::text, false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.title::text,
    COALESCE(
      NULLIF(btrim(ap.company_name), ''),
      NULLIF(btrim(u.full_name), ''),
      u.username
    )::text,
    c.thumbnail_url::text,
    c.moderation_status::text = 'published',
    public.contest_invite_link_status(v_link_id),
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.contest_access_list a
        WHERE a.contest_id = c.id AND a.user_id = auth.uid()
      )
    )
  FROM public.contests c
  LEFT JOIN public.advertiser_profiles ap ON ap.id = c.advertiser_id
  LEFT JOIN public.users u ON u.id = c.advertiser_id
  WHERE c.id = v_contest_id;
END;
$$;

-- Redeem for the signed-in creator. The link row is locked so concurrent
-- redemptions can't exceed max_uses. Returns a result code instead of raising
-- so the UI can show a friendly message.
CREATE OR REPLACE FUNCTION public.redeem_contest_invite(p_token text)
RETURNS TABLE (contest_id uuid, result text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_uid        uuid := auth.uid();
  v_link_id    uuid;
  v_contest_id uuid;
  v_status     text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'not_signed_in'::text;
    RETURN;
  END IF;

  SELECT l.id, l.contest_id INTO v_link_id, v_contest_id
  FROM public.contest_invite_links l
  WHERE l.token = p_token
  FOR UPDATE;

  IF v_link_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'not_found'::text;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = v_uid AND u.user_type = 'creator'
  ) THEN
    RETURN QUERY SELECT v_contest_id, 'not_creator'::text;
    RETURN;
  END IF;

  -- Already on the list: never consumes a slot, even if the link is no longer active.
  IF EXISTS (
    SELECT 1 FROM public.contest_access_list a
    WHERE a.contest_id = v_contest_id AND a.user_id = v_uid
  ) THEN
    RETURN QUERY SELECT v_contest_id, 'already_member'::text;
    RETURN;
  END IF;

  v_status := public.contest_invite_link_status(v_link_id);
  IF v_status <> 'active' THEN
    RETURN QUERY SELECT v_contest_id, v_status;
    RETURN;
  END IF;

  INSERT INTO public.contest_access_list
    (contest_id, user_id, source, source_invite_link_id, added_by)
  VALUES
    (v_contest_id, v_uid, 'invite_link', v_link_id, v_uid)
  ON CONFLICT ON CONSTRAINT contest_access_list_pkey DO NOTHING;

  IF FOUND THEN
    UPDATE public.contest_invite_links l
    SET use_count = l.use_count + 1
    WHERE l.id = v_link_id;
    RETURN QUERY SELECT v_contest_id, 'joined'::text;
  ELSE
    RETURN QUERY SELECT v_contest_id, 'already_member'::text;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.contest_invite_link_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contest_invite_preview(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_contest_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contest_invite_link_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_contest_invite_preview(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_contest_invite(text) TO authenticated, service_role;
