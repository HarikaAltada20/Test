-- Restricted campaigns with applications (Phase 3).
--
-- A Restricted campaign is listed for every creator as a preview. Creators
-- answer the brand's questions to apply; approving an application adds the
-- creator to contest_access_list (source 'application'), after which the
-- existing access checks (can_access_contest, RLS, submission and Twitter
-- triggers) give them the full campaign. Non-members never read the full
-- contests row: previews come only from the SECURITY DEFINER functions below.
--
-- Apply after db/migrations/20261013_private_campaign_hardening.sql.
-- Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Preview columns on contests (not exposed on contests_with_status)
-- ---------------------------------------------------------------------------

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS preview_description text,
  ADD COLUMN IF NOT EXISTS applications_open boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contests_preview_description_length'
  ) THEN
    ALTER TABLE public.contests
      ADD CONSTRAINT contests_preview_description_length
      CHECK (preview_description IS NULL OR length(preview_description) <= 2000);
  END IF;
END;
$$;

COMMENT ON COLUMN public.contests.access_mode IS
  'public: visible to everyone. private: visible only to contest_access_list members (plus owner/admins). restricted: everyone sees a preview (get_contest_preview); creators apply and approved applicants join contest_access_list.';
COMMENT ON COLUMN public.contests.preview_description IS
  'Restricted campaigns: text shown to creators who do not have access yet.';
COMMENT ON COLUMN public.contests.applications_open IS
  'Restricted campaigns: false pauses new applications.';

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contest_application_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id  uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  position    integer NOT NULL CHECK (position >= 0),
  prompt      text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND 300),
  kind        text NOT NULL
              CHECK (kind IN ('short_text', 'long_text', 'url', 'single_choice', 'yes_no')),
  options     jsonb CHECK (
                options IS NULL
                OR (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 10)
              ),
  required    boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_application_questions_choice_options
    CHECK (kind <> 'single_choice' OR options IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS contest_application_questions_contest
  ON public.contest_application_questions (contest_id, position);

-- answers is a snapshot: [{ question_id, prompt, kind, answer }], so editing
-- questions later never changes what an applicant saw and answered.
CREATE TABLE IF NOT EXISTS public.contest_applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id       uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  answers          jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason text CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 500),
  reviewed_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_applications_contest_user_key UNIQUE (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS contest_applications_contest_status
  ON public.contest_applications (contest_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS contest_applications_user
  ON public.contest_applications (user_id);

-- ---------------------------------------------------------------------------
-- 3. Access list: new source + application reference
-- ---------------------------------------------------------------------------

ALTER TABLE public.contest_access_list
  ADD COLUMN IF NOT EXISTS source_application_id uuid
    REFERENCES public.contest_applications(id) ON DELETE SET NULL;

ALTER TABLE public.contest_access_list
  DROP CONSTRAINT IF EXISTS contest_access_list_source_check;
ALTER TABLE public.contest_access_list
  ADD CONSTRAINT contest_access_list_source_check
  CHECK (source IN ('saved_list', 'manual', 'existing_submitter', 'invite_link', 'application'));

-- ---------------------------------------------------------------------------
-- 4. Row-level security. Applications have no write policies: creators and
--    brands only write through the functions below.
-- ---------------------------------------------------------------------------

ALTER TABLE public.contest_application_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brand or admin manages application questions" ON public.contest_application_questions;
CREATE POLICY "Brand or admin manages application questions" ON public.contest_application_questions
  TO authenticated
  USING (public.can_manage_contest_access(contest_id))
  WITH CHECK (public.can_manage_contest_access(contest_id));

DROP POLICY IF EXISTS "Creators read own applications" ON public.contest_applications;
CREATE POLICY "Creators read own applications" ON public.contest_applications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Brand or admin reads campaign applications" ON public.contest_applications;
CREATE POLICY "Brand or admin reads campaign applications" ON public.contest_applications
  FOR SELECT
  TO authenticated
  USING (public.can_manage_contest_access(contest_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contest_application_questions TO authenticated;
GRANT SELECT ON public.contest_applications TO authenticated;
GRANT ALL ON public.contest_application_questions, public.contest_applications TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Preview functions
-- ---------------------------------------------------------------------------

-- Card fields safe to show to creators without access. Internal: callers
-- decide visibility. Twitter campaign details are reduced to campaign_type.
CREATE OR REPLACE FUNCTION public.contest_preview_card_json(p_contest_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'advertiser_id', c.advertiser_id,
    'title', c.title,
    'platform', c.platform,
    'contest_type', c.contest_type,
    'contest_format', c.contest_format,
    'content_type', c.content_type,
    'moderation_status', c.moderation_status,
    'status', CASE
      WHEN c.moderation_status <> 'published'::public.contest_moderation_status_enum THEN NULL::text
      WHEN c.start_date IS NULL OR c.end_date IS NULL THEN 'incomplete'
      WHEN (now() AT TIME ZONE 'UTC') < c.start_date THEN 'upcoming'
      WHEN (now() AT TIME ZONE 'UTC') < c.end_date THEN 'active'
      ELSE 'ended'
    END,
    'post_contest_status', c.post_contest_status,
    'start_date', c.start_date,
    'end_date', c.end_date,
    'created_at', c.created_at,
    'published_at', c.published_at,
    'thumbnail_url', c.thumbnail_url,
    'contest_based_details', CASE
      WHEN c.contest_based_details ? 'twitter_campaign' THEN
        (c.contest_based_details - 'twitter_campaign')
        || jsonb_build_object(
          'twitter_campaign',
          jsonb_strip_nulls(jsonb_build_object(
            'campaign_type', c.contest_based_details -> 'twitter_campaign' -> 'campaign_type'
          ))
        )
      ELSE c.contest_based_details
    END,
    'bonus_details', c.bonus_details,
    'multiple_submissions_enabled', c.multiple_submissions_enabled,
    'max_submissions_per_creator', c.max_submissions_per_creator,
    'max_earnings_per_creator', c.max_earnings_per_creator,
    'categories', c.categories,
    'subcategories', c.subcategories,
    'interests', c.interests,
    'region', c.region,
    'trust_score', c.trust_score,
    'trust_number', c.trust_number,
    'min_avg_quality_score', c.min_avg_quality_score,
    'min_best_quality_score', c.min_best_quality_score,
    'min_quality_score', c.min_quality_score,
    'min_platform_earnings', c.min_platform_earnings,
    'min_platform_views', c.min_platform_views,
    'access_mode', c.access_mode,
    'preview_description', c.preview_description,
    'applications_open', c.applications_open,
    'brand_name', b.brand_name,
    'advertiser_profiles', jsonb_build_object('company_name', b.brand_name),
    'has_ended', c.end_date IS NOT NULL AND (now() AT TIME ZONE 'UTC') >= c.end_date,
    'is_preview', true
  )
  FROM public.contests c
  LEFT JOIN public.advertiser_profiles ap ON ap.id = c.advertiser_id
  LEFT JOIN public.users u ON u.id = c.advertiser_id
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      NULLIF(btrim(ap.company_name), ''),
      NULLIF(btrim(u.full_name), ''),
      u.username
    )::text AS brand_name
  ) b
  WHERE c.id = p_contest_id;
$$;

-- Campaign page preview for a published Restricted campaign, with the
-- questions and the caller's own application. NULL for anything else, so
-- private campaigns stay invisible.
CREATE OR REPLACE FUNCTION public.get_contest_preview(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.contests c
    WHERE c.id = p_contest_id
      AND c.moderation_status = 'published'::public.contest_moderation_status_enum
      AND c.access_mode = 'restricted'
  ) THEN
    RETURN NULL;
  END IF;

  RETURN public.contest_preview_card_json(p_contest_id)
    || jsonb_build_object(
      'has_access', public.can_access_contest(p_contest_id),
      'questions', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'position', q.position,
            'prompt', q.prompt,
            'kind', q.kind,
            'options', q.options,
            'required', q.required
          )
          ORDER BY q.position, q.created_at
        )
        FROM public.contest_application_questions q
        WHERE q.contest_id = p_contest_id
      ), '[]'::jsonb),
      'my_application', (
        SELECT jsonb_build_object(
          'id', a.id,
          'status', a.status,
          'rejection_reason', a.rejection_reason,
          'answers', a.answers,
          'created_at', a.created_at,
          'reviewed_at', a.reviewed_at
        )
        FROM public.contest_applications a
        WHERE a.contest_id = p_contest_id AND a.user_id = v_uid
      )
    );
END;
$$;

-- Card previews for the opportunities list (rows RLS hid from the caller).
CREATE OR REPLACE FUNCTION public.get_contest_previews(p_contest_ids uuid[])
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.contest_preview_card_json(c.id)
    || jsonb_build_object('my_application_status', a.status)
  FROM public.contests c
  LEFT JOIN public.contest_applications a
    ON a.contest_id = c.id AND a.user_id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND c.id = ANY (p_contest_ids[1:200])
    AND c.moderation_status = 'published'::public.contest_moderation_status_enum
    AND c.access_mode = 'restricted';
$$;

-- ---------------------------------------------------------------------------
-- 6. Application functions. Result codes instead of exceptions so the UI can
--    show friendly messages.
-- ---------------------------------------------------------------------------

-- p_answers: [{ "question_id": uuid, "answer": text }]
CREATE OR REPLACE FUNCTION public.submit_contest_application(
  p_contest_id uuid,
  p_answers jsonb
)
RETURNS TABLE (application_id uuid, result text, detail text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_uid      uuid := auth.uid();
  v_contest  record;
  v_answers  jsonb := CASE WHEN jsonb_typeof(p_answers) = 'array' THEN p_answers ELSE '[]'::jsonb END;
  v_snapshot jsonb := '[]'::jsonb;
  v_q        record;
  v_answer   text;
  v_valid    boolean;
  v_id       uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'not_signed_in'::text, NULL::text;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = v_uid AND u.user_type = 'creator'
  ) THEN
    RETURN QUERY SELECT NULL::uuid, 'not_creator'::text, NULL::text;
    RETURN;
  END IF;

  SELECT c.id, c.end_date, c.applications_open INTO v_contest
  FROM public.contests c
  WHERE c.id = p_contest_id
    AND c.moderation_status = 'published'::public.contest_moderation_status_enum
    AND c.access_mode = 'restricted';

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'not_found'::text, NULL::text;
    RETURN;
  END IF;

  IF v_contest.end_date IS NOT NULL AND (now() AT TIME ZONE 'UTC') >= v_contest.end_date THEN
    RETURN QUERY SELECT NULL::uuid, 'ended'::text, NULL::text;
    RETURN;
  END IF;

  IF NOT v_contest.applications_open THEN
    RETURN QUERY SELECT NULL::uuid, 'closed'::text, NULL::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contest_access_list a
    WHERE a.contest_id = p_contest_id AND a.user_id = v_uid
  ) THEN
    RETURN QUERY SELECT NULL::uuid, 'already_member'::text, NULL::text;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contest_applications a
    WHERE a.contest_id = p_contest_id AND a.user_id = v_uid AND a.status <> 'withdrawn'
  ) THEN
    RETURN QUERY SELECT NULL::uuid, 'already_applied'::text, NULL::text;
    RETURN;
  END IF;

  FOR v_q IN
    SELECT q.id, q.prompt, q.kind, q.options, q.required
    FROM public.contest_application_questions q
    WHERE q.contest_id = p_contest_id
    ORDER BY q.position, q.created_at
  LOOP
    SELECT NULLIF(btrim(e ->> 'answer'), '') INTO v_answer
    FROM jsonb_array_elements(v_answers) e
    WHERE e ->> 'question_id' = v_q.id::text
    LIMIT 1;

    IF v_answer IS NULL THEN
      IF v_q.required THEN
        RETURN QUERY SELECT NULL::uuid, 'invalid_answers'::text, v_q.id::text;
        RETURN;
      END IF;
      CONTINUE;
    END IF;

    v_valid := CASE v_q.kind
      WHEN 'short_text' THEN length(v_answer) <= 300
      WHEN 'long_text' THEN length(v_answer) <= 3000
      WHEN 'url' THEN length(v_answer) <= 500 AND v_answer ~* '^https?://[^[:space:]]+$'
      WHEN 'single_choice' THEN COALESCE(v_q.options ? v_answer, false)
      WHEN 'yes_no' THEN v_answer IN ('yes', 'no')
      ELSE false
    END;

    IF NOT v_valid THEN
      RETURN QUERY SELECT NULL::uuid, 'invalid_answers'::text, v_q.id::text;
      RETURN;
    END IF;

    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'question_id', v_q.id,
      'prompt', v_q.prompt,
      'kind', v_q.kind,
      'answer', v_answer
    ));
  END LOOP;

  INSERT INTO public.contest_applications AS ca (contest_id, user_id, answers)
  VALUES (p_contest_id, v_uid, v_snapshot)
  ON CONFLICT ON CONSTRAINT contest_applications_contest_user_key DO UPDATE
    SET status = 'pending',
        answers = EXCLUDED.answers,
        rejection_reason = NULL,
        reviewed_by = NULL,
        reviewed_at = NULL,
        created_at = now(),
        updated_at = now()
    WHERE ca.status = 'withdrawn'
  RETURNING ca.id INTO v_id;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'already_applied'::text, NULL::text;
  ELSE
    RETURN QUERY SELECT v_id, 'submitted'::text, NULL::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_contest_application(p_contest_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'not_signed_in';
  END IF;

  UPDATE public.contest_applications a
  SET status = 'withdrawn', updated_at = now()
  WHERE a.contest_id = p_contest_id AND a.user_id = v_uid AND a.status = 'pending'
  RETURNING a.id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN 'withdrawn';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contest_applications a
    WHERE a.contest_id = p_contest_id AND a.user_id = v_uid
  ) THEN
    RETURN 'not_pending';
  END IF;
  RETURN 'not_found';
END;
$$;

-- Approve (from pending or rejected; adds the creator to the access list) or
-- reject (from pending). The row lock serialises concurrent reviewers.
CREATE OR REPLACE FUNCTION public.review_contest_application(
  p_application_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (result text, application_id uuid, contest_id uuid, user_id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_uid    uuid := auth.uid();
  v_app    record;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RETURN QUERY SELECT 'invalid_decision'::text, p_application_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT a.id, a.contest_id, a.user_id, a.status INTO v_app
  FROM public.contest_applications a
  WHERE a.id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, p_application_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_uid IS NULL OR NOT public.can_manage_contest_access(v_app.contest_id) THEN
    RETURN QUERY SELECT 'forbidden'::text, v_app.id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF p_decision = 'approve' THEN
    IF v_app.status NOT IN ('pending', 'rejected', 'approved') THEN
      RETURN QUERY SELECT 'invalid_state'::text, v_app.id, v_app.contest_id, v_app.user_id;
      RETURN;
    END IF;

    IF v_app.status <> 'approved' THEN
      UPDATE public.contest_applications a
      SET status = 'approved',
          rejection_reason = NULL,
          reviewed_by = v_uid,
          reviewed_at = now(),
          updated_at = now()
      WHERE a.id = v_app.id;

      INSERT INTO public.contest_access_list
        (contest_id, user_id, source, source_application_id, added_by)
      VALUES
        (v_app.contest_id, v_app.user_id, 'application', v_app.id, v_uid)
      ON CONFLICT ON CONSTRAINT contest_access_list_pkey DO NOTHING;
    END IF;

    RETURN QUERY SELECT 'approved'::text, v_app.id, v_app.contest_id, v_app.user_id;
    RETURN;
  END IF;

  IF v_app.status <> 'pending' THEN
    RETURN QUERY SELECT 'invalid_state'::text, v_app.id, v_app.contest_id, v_app.user_id;
    RETURN;
  END IF;

  IF v_reason IS NOT NULL AND length(v_reason) > 500 THEN
    v_reason := left(v_reason, 500);
  END IF;

  UPDATE public.contest_applications a
  SET status = 'rejected',
      rejection_reason = v_reason,
      reviewed_by = v_uid,
      reviewed_at = now(),
      updated_at = now()
  WHERE a.id = v_app.id;

  RETURN QUERY SELECT 'rejected'::text, v_app.id, v_app.contest_id, v_app.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_review_contest_applications(
  p_application_ids uuid[],
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (result text, application_id uuid, contest_id uuid, user_id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_id uuid;
BEGIN
  FOREACH v_id IN ARRAY COALESCE(p_application_ids[1:200], ARRAY[]::uuid[])
  LOOP
    RETURN QUERY SELECT * FROM public.review_contest_application(v_id, p_decision, p_reason);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.contest_preview_card_json(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_preview(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_contest_previews(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_contest_application(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_contest_application(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_contest_application(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bulk_review_contest_applications(uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contest_preview_card_json(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_contest_preview(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_contest_previews(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_contest_application(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_contest_application(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_contest_application(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_review_contest_applications(uuid[], text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Campaign list RPCs: Restricted campaigns are listed for every creator
--    (as previews). Bodies copied from 20261010; only the access filter
--    changes from access_mode = 'public' to access_mode IN ('public', 'restricted').
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.contest_ids_matching_user_countries(
  p_countries text[]
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_countries text[];
  v_unused_advertiser_id uuid;
BEGIN
  SELECT *
  INTO v_unused_advertiser_id, v_countries
  FROM public.campaign_list_authorize_caller(
    'opportunities',
    NULL,
    p_countries
  );

  RETURN QUERY
  SELECT c.id
  FROM public.contests_with_status c
  WHERE c.moderation_status = 'published'::public.contest_moderation_status_enum
    AND public.contest_matches_user_countries(c.region, v_countries)
    AND (c.access_mode IN ('public', 'restricted') OR public.can_access_contest(c.id));
END;
$$;

REVOKE ALL ON FUNCTION public.contest_ids_matching_user_countries(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contest_ids_matching_user_countries(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contest_ids_matching_user_countries(text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.campaign_list_page_ids(
  p_scope text,
  p_advertiser_id uuid DEFAULT NULL,
  p_tab text DEFAULT 'all',
  p_sort text DEFAULT 'created_at_desc',
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 9,
  p_platform text DEFAULT 'all',
  p_contest_type text DEFAULT 'all',
  p_contest_format text DEFAULT 'all',
  p_post_contest_phase text DEFAULT 'all',
  p_search text DEFAULT '',
  p_media_type text DEFAULT 'all',
  p_user_countries text[] DEFAULT NULL,
  p_eligible_only boolean DEFAULT false,
  p_creator_trust_score_pct numeric DEFAULT NULL,
  p_creator_trust_number integer DEFAULT NULL,
  p_creator_avg_quality numeric DEFAULT NULL,
  p_creator_best_quality integer DEFAULT NULL,
  p_creator_quality_sum numeric DEFAULT NULL,
  p_creator_earnings_cents bigint DEFAULT NULL,
  p_creator_views bigint DEFAULT NULL,
  p_creator_verified_reels integer DEFAULT NULL,
  p_creator_has_explicit_quality boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 9), 1), 100);
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_total bigint;
  v_ids uuid[];
  v_advertiser_id uuid;
  v_user_countries text[];
BEGIN
  SELECT *
  INTO v_advertiser_id, v_user_countries
  FROM public.campaign_list_authorize_caller(
    p_scope,
    p_advertiser_id,
    p_user_countries
  );

  WITH base AS (
    SELECT
      c.id,
      c.status,
      c.created_at,
      c.start_date,
      c.end_date,
      c.live_submission_count,
      c.moderation_status,
      c.post_contest_status,
      c.contest_type,
      c.contest_based_details,
      COALESCE(cs.not_rejected_views, 0)::bigint AS not_rejected_views,
      COALESCE(cs.verified_submission_count, 0)::integer AS verified_submission_count,
      COALESCE(cs.pending_submission_count, 0)::integer AS pending_submission_count,
      COALESCE(cs.rejected_submission_count, 0)::integer AS rejected_submission_count,
      public.contest_list_sort_value_cents(
        c.contest_type::text,
        c.contest_based_details
      ) AS sort_value_cents,
      public.contest_list_sort_cpm_rate(
        c.contest_type::text,
        c.contest_based_details
      ) AS sort_cpm_rate,
      public.contest_list_sort_budget_spent_cents(
        c.contest_type::text,
        c.contest_based_details
      ) AS sort_budget_spent_cents,
      public.contest_list_sort_budget_remaining_cents(
        c.contest_type::text,
        c.contest_based_details
      ) AS sort_budget_remaining_cents,
      public.contest_list_sort_approval_percent(
        c.status,
        COALESCE(cs.verified_submission_count, 0),
        COALESCE(cs.pending_submission_count, 0),
        COALESCE(cs.rejected_submission_count, 0),
        c.live_submission_count
      ) AS sort_approval_percent
    FROM public.contests_with_status c
    LEFT JOIN public.contest_stats cs ON cs.contest_id = c.id
    WHERE
      (
        p_scope <> 'advertiser'
        OR (v_advertiser_id IS NOT NULL AND c.advertiser_id = v_advertiser_id)
      )
      AND (
        p_scope <> 'opportunities'
        OR c.moderation_status = 'published'::public.contest_moderation_status_enum
      )
      AND (
        p_scope <> 'opportunities'
        OR c.access_mode IN ('public', 'restricted')
        OR public.can_access_contest(c.id)
      )
      AND (
        p_scope <> 'opportunities'
        OR public.contest_matches_user_countries(c.region, v_user_countries)
      )
      AND (
        NOT COALESCE(p_eligible_only, false)
        OR p_scope <> 'opportunities'
        OR public.contest_matches_creator_eligibility(
          c.contest_format,
          c.trust_score,
          c.trust_number,
          c.min_avg_quality_score,
          c.min_best_quality_score,
          c.min_quality_score,
          c.min_platform_earnings,
          c.min_platform_views,
          p_creator_trust_score_pct,
          p_creator_trust_number,
          p_creator_avg_quality,
          p_creator_best_quality,
          p_creator_quality_sum,
          p_creator_earnings_cents,
          p_creator_views,
          p_creator_verified_reels,
          p_creator_has_explicit_quality
        )
        OR EXISTS (
          SELECT 1
          FROM public.contest_access_list a
          JOIN public.contests ac ON ac.id = a.contest_id
          WHERE a.contest_id = c.id
            AND a.user_id = auth.uid()
            AND ac.access_mode <> 'public'
            AND ac.access_list_skips_requirements
        )
      )
      AND (
        COALESCE(p_contest_format, 'all') = 'all'
        OR (
          p_contest_format = 'video'
          AND lower(coalesce(c.contest_format, '')) = 'video'
        )
        OR (
          p_contest_format = 'text_image'
          AND lower(coalesce(c.contest_format, '')) IN (
            'text_image', 'text-image', 'text', 'image'
          )
        )
      )
      AND (
        public.contest_matches_campaign_platform_filter(c.platform, p_platform)
      )
      AND (
        COALESCE(p_contest_type, 'all') = 'all'
        OR c.contest_type::text = p_contest_type
      )
      AND (
        v_search IS NULL
        OR c.title ILIKE '%' || v_search || '%'
      )
      AND (
        p_scope <> 'opportunities'
        OR COALESCE(p_media_type, 'all') = 'all'
        OR (
          p_media_type = 'media'
          AND lower(coalesce(c.contest_format, '')) = 'video'
        )
        OR (
          p_media_type = 'text'
          AND lower(coalesce(c.contest_format, '')) = 'text_image'
        )
      )
      AND (
        CASE
          WHEN p_scope = 'opportunities' THEN
            CASE COALESCE(p_tab, 'all')
              WHEN 'live' THEN c.status = 'active'
              WHEN 'upcoming' THEN c.status = 'upcoming'
              WHEN 'ended' THEN c.status = 'ended'
              ELSE c.status IS NOT NULL
            END
          ELSE
            CASE COALESCE(p_tab, 'all')
              WHEN 'draft' THEN
                c.moderation_status = 'draft'::public.contest_moderation_status_enum
              WHEN 'pending_approval' THEN
                c.moderation_status = 'pending_approval'::public.contest_moderation_status_enum
              WHEN 'ready' THEN
                c.moderation_status = 'approved'::public.contest_moderation_status_enum
              WHEN 'live' THEN
                c.moderation_status = 'published'::public.contest_moderation_status_enum
                AND c.status = 'active'
              WHEN 'upcoming' THEN
                c.moderation_status = 'published'::public.contest_moderation_status_enum
                AND c.status = 'upcoming'
              WHEN 'ended' THEN
                c.moderation_status = 'published'::public.contest_moderation_status_enum
                AND c.status = 'ended'
              WHEN 'rejected' THEN
                c.moderation_status = 'rejected'::public.contest_moderation_status_enum
              ELSE TRUE
            END
        END
      )
      AND (
        COALESCE(p_post_contest_phase, 'all') = 'all'
        OR COALESCE(p_tab, 'all') NOT IN ('all', 'ended')
        OR (
          c.moderation_status = 'published'::public.contest_moderation_status_enum
          AND c.status = 'ended'
          AND (
            (
              p_post_contest_phase = 'post_pending_review'
              AND (
                c.post_contest_status IS NULL
                OR c.post_contest_status = 'pending_review'::public.post_contest_status_enum
                OR c.post_contest_status NOT IN (
                  'in_review'::public.post_contest_status_enum,
                  'verification_complete'::public.post_contest_status_enum,
                  'payouts_processed'::public.post_contest_status_enum
                )
              )
            )
            OR (
              p_post_contest_phase = 'post_in_review'
              AND c.post_contest_status = 'in_review'::public.post_contest_status_enum
            )
            OR (
              p_post_contest_phase = 'post_payment_pending'
              AND c.post_contest_status = 'verification_complete'::public.post_contest_status_enum
            )
            OR (
              p_post_contest_phase = 'post_paid'
              AND c.post_contest_status = 'payouts_processed'::public.post_contest_status_enum
            )
          )
        )
      )
  ),
  ordered AS (
    SELECT
      b.id,
      row_number() OVER (
        ORDER BY
          CASE
            WHEN p_sort = 'relevance_desc' THEN
              CASE b.status
                WHEN 'active' THEN 0
                WHEN 'upcoming' THEN 1
                WHEN 'ended' THEN 2
                ELSE 3
              END
            ELSE 0
          END ASC,
          CASE p_sort
            WHEN 'created_at_asc' THEN EXTRACT(EPOCH FROM b.created_at)
            WHEN 'start_date_asc' THEN EXTRACT(EPOCH FROM b.start_date)
            WHEN 'end_date_asc' THEN EXTRACT(EPOCH FROM b.end_date)
            WHEN 'views_asc' THEN b.not_rejected_views::double precision
            WHEN 'submissions_asc' THEN b.live_submission_count::double precision
            WHEN 'value_asc' THEN b.sort_value_cents::double precision
            WHEN 'budget_remaining_asc' THEN b.sort_budget_remaining_cents::double precision
            WHEN 'budget_used_asc' THEN b.sort_budget_spent_cents::double precision
            WHEN 'approval_rate_asc' THEN b.sort_approval_percent::double precision
            WHEN 'cpm_rate_asc' THEN b.sort_cpm_rate
            ELSE NULL
          END ASC NULLS LAST,
          CASE p_sort
            WHEN 'created_at_desc' THEN EXTRACT(EPOCH FROM b.created_at)
            WHEN 'relevance_desc' THEN EXTRACT(EPOCH FROM b.created_at)
            WHEN 'start_date_desc' THEN EXTRACT(EPOCH FROM b.start_date)
            WHEN 'end_date_desc' THEN EXTRACT(EPOCH FROM b.end_date)
            WHEN 'views_desc' THEN b.not_rejected_views::double precision
            WHEN 'submissions_desc' THEN b.live_submission_count::double precision
            WHEN 'value_desc' THEN b.sort_value_cents::double precision
            WHEN 'budget_remaining_desc' THEN b.sort_budget_remaining_cents::double precision
            WHEN 'budget_used_desc' THEN b.sort_budget_spent_cents::double precision
            WHEN 'approval_rate_desc' THEN b.sort_approval_percent::double precision
            WHEN 'cpm_rate_desc' THEN b.sort_cpm_rate
            ELSE EXTRACT(EPOCH FROM b.created_at)
          END DESC NULLS LAST,
          b.id ASC
      ) AS sort_pos
    FROM base b
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM base
  ),
  page AS (
    SELECT o.id, o.sort_pos
    FROM ordered o
    WHERE o.sort_pos > v_offset
      AND o.sort_pos <= v_offset + v_limit
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(
      (SELECT array_agg(p.id ORDER BY p.sort_pos) FROM page p),
      ARRAY[]::uuid[]
    )
  INTO v_total, v_ids;

  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'ids', to_jsonb(COALESCE(v_ids, ARRAY[]::uuid[]))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.campaign_list_tab_counts(
  p_scope text,
  p_advertiser_id uuid DEFAULT NULL,
  p_contest_format text DEFAULT 'all',
  p_user_countries text[] DEFAULT NULL,
  p_eligible_only boolean DEFAULT false,
  p_creator_trust_score_pct numeric DEFAULT NULL,
  p_creator_trust_number integer DEFAULT NULL,
  p_creator_avg_quality numeric DEFAULT NULL,
  p_creator_best_quality integer DEFAULT NULL,
  p_creator_quality_sum numeric DEFAULT NULL,
  p_creator_earnings_cents bigint DEFAULT NULL,
  p_creator_views bigint DEFAULT NULL,
  p_creator_verified_reels integer DEFAULT NULL,
  p_creator_has_explicit_quality boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tab_counts jsonb;
  v_post_phase jsonb;
  v_platforms jsonb;
  v_advertiser_id uuid;
  v_user_countries text[];
BEGIN
  SELECT *
  INTO v_advertiser_id, v_user_countries
  FROM public.campaign_list_authorize_caller(
    p_scope,
    p_advertiser_id,
    p_user_countries
  );

  WITH base AS (
    SELECT
      c.id,
      c.moderation_status,
      c.status,
      c.post_contest_status,
      c.platform,
      c.contest_format
    FROM public.contests_with_status c
    WHERE
      (
        p_scope <> 'advertiser'
        OR (v_advertiser_id IS NOT NULL AND c.advertiser_id = v_advertiser_id)
      )
      AND (
        p_scope <> 'opportunities'
        OR c.moderation_status = 'published'::public.contest_moderation_status_enum
      )
      AND (
        p_scope <> 'opportunities'
        OR c.access_mode IN ('public', 'restricted')
        OR public.can_access_contest(c.id)
      )
      AND (
        p_contest_format = 'all'
        OR (
          p_contest_format = 'video'
          AND lower(coalesce(c.contest_format, '')) = 'video'
        )
        OR (
          p_contest_format = 'text_image'
          AND lower(coalesce(c.contest_format, '')) IN (
            'text_image', 'text-image', 'text', 'image'
          )
        )
      )
      AND (
        p_scope <> 'opportunities'
        OR public.contest_matches_user_countries(c.region, v_user_countries)
      )
      AND (
        NOT COALESCE(p_eligible_only, false)
        OR p_scope <> 'opportunities'
        OR public.contest_matches_creator_eligibility(
          c.contest_format,
          c.trust_score,
          c.trust_number,
          c.min_avg_quality_score,
          c.min_best_quality_score,
          c.min_quality_score,
          c.min_platform_earnings,
          c.min_platform_views,
          p_creator_trust_score_pct,
          p_creator_trust_number,
          p_creator_avg_quality,
          p_creator_best_quality,
          p_creator_quality_sum,
          p_creator_earnings_cents,
          p_creator_views,
          p_creator_verified_reels,
          p_creator_has_explicit_quality
        )
        OR EXISTS (
          SELECT 1
          FROM public.contest_access_list a
          JOIN public.contests ac ON ac.id = a.contest_id
          WHERE a.contest_id = c.id
            AND a.user_id = auth.uid()
            AND ac.access_mode <> 'public'
            AND ac.access_list_skips_requirements
        )
      )
  ),
  tab_agg AS (
    SELECT
      count(*)::integer AS all_count,
      count(*) FILTER (
        WHERE moderation_status = 'draft'::public.contest_moderation_status_enum
      )::integer AS draft,
      count(*) FILTER (
        WHERE moderation_status = 'pending_approval'::public.contest_moderation_status_enum
      )::integer AS pending_approval,
      count(*) FILTER (
        WHERE moderation_status = 'approved'::public.contest_moderation_status_enum
      )::integer AS ready,
      count(*) FILTER (
        WHERE moderation_status = 'published'::public.contest_moderation_status_enum
          AND status = 'upcoming'
      )::integer AS upcoming,
      count(*) FILTER (
        WHERE moderation_status = 'published'::public.contest_moderation_status_enum
          AND status = 'active'
      )::integer AS live,
      count(*) FILTER (
        WHERE moderation_status = 'published'::public.contest_moderation_status_enum
          AND status = 'ended'
      )::integer AS ended,
      count(*) FILTER (
        WHERE moderation_status = 'rejected'::public.contest_moderation_status_enum
      )::integer AS rejected
    FROM base
  ),
  ended_base AS (
    SELECT *
    FROM base
    WHERE moderation_status = 'published'::public.contest_moderation_status_enum
      AND status = 'ended'
  ),
  post_agg AS (
    SELECT
      count(*) FILTER (
        WHERE post_contest_status IS NULL
          OR post_contest_status = 'pending_review'::public.post_contest_status_enum
          OR post_contest_status NOT IN (
            'in_review'::public.post_contest_status_enum,
            'verification_complete'::public.post_contest_status_enum,
            'payouts_processed'::public.post_contest_status_enum
          )
      )::integer AS post_pending_review,
      count(*) FILTER (
        WHERE post_contest_status = 'in_review'::public.post_contest_status_enum
      )::integer AS post_in_review,
      count(*) FILTER (
        WHERE post_contest_status = 'verification_complete'::public.post_contest_status_enum
      )::integer AS post_payment_pending,
      count(*) FILTER (
        WHERE post_contest_status = 'payouts_processed'::public.post_contest_status_enum
      )::integer AS post_paid
    FROM ended_base
  ),
  platform_agg AS (
    SELECT coalesce(
      (
        SELECT jsonb_agg(p.platform ORDER BY p.platform)
        FROM (
          SELECT DISTINCT tok AS platform
          FROM base b
          CROSS JOIN LATERAL unnest(public.contest_platform_tokens(b.platform)) AS tok
          WHERE tok IS NOT NULL AND tok <> ''
        ) p
      ),
      '[]'::jsonb
    ) AS platforms
  )
  SELECT
    jsonb_build_object(
      'all', t.all_count,
      'draft', t.draft,
      'pending_approval', t.pending_approval,
      'ready', t.ready,
      'upcoming', t.upcoming,
      'live', t.live,
      'ended', t.ended,
      'rejected', t.rejected
    ),
    jsonb_build_object(
      'post_pending_review', p.post_pending_review,
      'post_in_review', p.post_in_review,
      'post_payment_pending', p.post_payment_pending,
      'post_paid', p.post_paid
    ),
    jsonb_build_array('all') || coalesce(pa.platforms, '[]'::jsonb)
  INTO v_tab_counts, v_post_phase, v_platforms
  FROM tab_agg t
  CROSS JOIN post_agg p
  CROSS JOIN platform_agg pa;

  RETURN jsonb_build_object(
    'tabCounts', v_tab_counts,
    'postPhaseCounts', v_post_phase,
    'availablePlatforms', v_platforms
  );
END;
$$;

COMMIT;
