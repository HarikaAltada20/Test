-- Fixes from the v2 access review.
--
--   1. Grant-existing-submitters only counts active Twitter participants
--      (removing someone from the access list now deactivates them instead of
--      deleting their participation history).
--   2. Restricted-campaign previews and applications respect the campaign's
--      region, like the opportunities list already does.
--   3. Re-approving an approved application whose access was removed restores
--      access (result 'already_approved' when nothing changed).
--   4. contest_applications_page: one query for the brand's applications list
--      (search is a database join, not a capped id list).
--   5. At most one unread "new application" notification per brand and campaign.
--   6. Application question limits enforced in the database.
--   7. Admins are never hidden by list_only_to_eligible in the list RPCs.
--
-- Apply after db/migrations/20261016_access_polish.sql. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Existing submitters: active Twitter participants only
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
      AND COALESCE(p.is_active, true)
  ) x
  JOIN public.users u ON u.id = x.creator_id
  ON CONFLICT (contest_id, user_id) DO NOTHING;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.contest_access_grant_existing_submitters() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Region checks for previews and applications
-- ---------------------------------------------------------------------------

-- Countries of the signed-in caller, resolved the same way as the
-- opportunities list (creator profile, then signup geo data).
CREATE OR REPLACE FUNCTION public.current_user_countries()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.o_user_countries
  FROM public.campaign_list_authorize_caller('opportunities', NULL, NULL) a;
$$;

REVOKE ALL ON FUNCTION public.current_user_countries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_countries() TO service_role;

CREATE OR REPLACE FUNCTION public.get_contest_preview(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_region jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.region INTO v_region
  FROM public.contests c
  WHERE c.id = p_contest_id
    AND c.moderation_status = 'published'::public.contest_moderation_status_enum
    AND c.access_mode = 'restricted';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT public.contest_matches_user_countries(v_region, public.current_user_countries())
     AND NOT public.can_access_contest(p_contest_id) THEN
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

CREATE OR REPLACE FUNCTION public.get_contest_previews(p_contest_ids uuid[])
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_countries text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_countries := public.current_user_countries();

  RETURN QUERY
  SELECT public.contest_preview_card_json(c.id)
    || jsonb_build_object('my_application_status', a.status)
  FROM public.contests c
  LEFT JOIN public.contest_applications a
    ON a.contest_id = c.id AND a.user_id = v_uid
  WHERE c.id = ANY (p_contest_ids[1:200])
    AND c.moderation_status = 'published'::public.contest_moderation_status_enum
    AND c.access_mode = 'restricted'
    AND (
      public.contest_matches_user_countries(c.region, v_countries)
      OR public.can_access_contest(c.id)
    );
END;
$$;

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

  SELECT c.id, c.end_date, c.applications_open, c.region INTO v_contest
  FROM public.contests c
  WHERE c.id = p_contest_id
    AND c.moderation_status = 'published'::public.contest_moderation_status_enum
    AND c.access_mode = 'restricted';

  IF NOT FOUND
     OR (
       NOT public.contest_matches_user_countries(v_contest.region, public.current_user_countries())
       AND NOT public.can_access_contest(p_contest_id)
     ) THEN
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

-- ---------------------------------------------------------------------------
-- 3. Re-approve restores access
-- ---------------------------------------------------------------------------

-- Approve (from pending, rejected, or approved-but-removed; adds the creator to
-- the access list) or reject (from pending). The row lock serialises
-- concurrent reviewers. 'already_approved' means nothing changed.
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
  v_uid      uuid := auth.uid();
  v_app      record;
  v_reason   text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_inserted boolean;
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

    INSERT INTO public.contest_access_list
      (contest_id, user_id, source, source_application_id, added_by)
    VALUES
      (v_app.contest_id, v_app.user_id, 'application', v_app.id, v_uid)
    ON CONFLICT ON CONSTRAINT contest_access_list_pkey DO NOTHING;
    v_inserted := FOUND;

    IF v_app.status = 'approved' AND NOT v_inserted THEN
      RETURN QUERY SELECT 'already_approved'::text, v_app.id, v_app.contest_id, v_app.user_id;
      RETURN;
    END IF;

    UPDATE public.contest_applications a
    SET status = 'approved',
        rejection_reason = NULL,
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
    WHERE a.id = v_app.id;

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

REVOKE ALL ON FUNCTION public.get_contest_preview(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_contest_previews(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_contest_application(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_contest_application(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contest_preview(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_contest_previews(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_contest_application(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_contest_application(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Brand applications list in one query
-- ---------------------------------------------------------------------------

-- Server-only (the API route checks the caller can manage the campaign).
-- Returns { total, counts: { status: n }, rows: [application + on_access_list] }.
-- p_status 'all' or NULL lists every status; p_search matches usernames.
CREATE OR REPLACE FUNCTION public.contest_applications_page(
  p_contest_id uuid,
  p_status text,
  p_search text,
  p_offset integer,
  p_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text := NULLIF(NULLIF(btrim(COALESCE(p_status, '')), ''), 'all');
  v_search text := lower(NULLIF(btrim(COALESCE(p_search, '')), ''));
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_limit  integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_counts jsonb;
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(s.status, s.n), '{}'::jsonb) INTO v_counts
  FROM (
    SELECT a.status, count(*) AS n
    FROM public.contest_applications a
    WHERE a.contest_id = p_contest_id
    GROUP BY a.status
  ) s;

  SELECT count(*) INTO v_total
  FROM public.contest_applications a
  LEFT JOIN public.users u ON u.id = a.user_id
  WHERE a.contest_id = p_contest_id
    AND (v_status IS NULL OR a.status = v_status)
    AND (v_search IS NULL OR strpos(lower(COALESCE(u.username, '')), v_search) > 0);

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC, r.id), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      a.id,
      a.contest_id,
      a.user_id,
      a.status,
      a.answers,
      a.rejection_reason,
      a.reviewed_at,
      a.created_at,
      EXISTS (
        SELECT 1 FROM public.contest_access_list l
        WHERE l.contest_id = a.contest_id AND l.user_id = a.user_id
      ) AS on_access_list
    FROM public.contest_applications a
    LEFT JOIN public.users u ON u.id = a.user_id
    WHERE a.contest_id = p_contest_id
      AND (v_status IS NULL OR a.status = v_status)
      AND (v_search IS NULL OR strpos(lower(COALESCE(u.username, '')), v_search) > 0)
    ORDER BY a.created_at DESC, a.id
    OFFSET v_offset
    LIMIT v_limit
  ) r;

  RETURN jsonb_build_object('total', v_total, 'counts', v_counts, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.contest_applications_page(uuid, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contest_applications_page(uuid, text, text, integer, integer)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 5. One unread "new application" notification per brand and campaign
-- ---------------------------------------------------------------------------

-- Collapse existing unread duplicates so the unique index can be built.
DELETE FROM public.user_notifications n
USING public.user_notifications keep
WHERE n.notification_type = 'campaign_application_received'
  AND keep.notification_type = 'campaign_application_received'
  AND NOT n.is_read AND NOT keep.is_read
  AND n.user_id = keep.user_id
  AND n.contest_id = keep.contest_id
  AND (n.created_at, n.id) < (keep.created_at, keep.id);

CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_application_received_unread
  ON public.user_notifications (user_id, contest_id)
  WHERE notification_type = 'campaign_application_received' AND NOT is_read;

-- ---------------------------------------------------------------------------
-- 6. Application question limits
-- ---------------------------------------------------------------------------

-- NULL, or an array of 2-10 strings, each 1-100 characters after trimming.
CREATE OR REPLACE FUNCTION public.application_question_options_valid(p_options jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_options IS NULL THEN true
    WHEN jsonb_typeof(p_options) <> 'array' THEN false
    ELSE jsonb_array_length(p_options) BETWEEN 2 AND 10
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_options) o
        WHERE jsonb_typeof(o) <> 'string'
           OR length(btrim(o #>> '{}')) NOT BETWEEN 1 AND 100
      )
  END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contest_application_questions_options_valid'
  ) THEN
    ALTER TABLE public.contest_application_questions
      ADD CONSTRAINT contest_application_questions_options_valid
      CHECK (public.application_question_options_valid(options));
  END IF;
END;
$$;

-- At most 10 questions per campaign. Locking the campaign row serialises
-- concurrent saves; rows inserted earlier in the same statement are counted.
CREATE OR REPLACE FUNCTION public.contest_application_questions_enforce_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.contests c WHERE c.id = NEW.contest_id FOR UPDATE;

  IF (
    SELECT count(*) FROM public.contest_application_questions q
    WHERE q.contest_id = NEW.contest_id
  ) >= 10 THEN
    RAISE EXCEPTION 'A campaign can have at most 10 application questions'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.contest_application_questions_enforce_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS contest_application_questions_enforce_limit ON public.contest_application_questions;
CREATE TRIGGER contest_application_questions_enforce_limit
  BEFORE INSERT ON public.contest_application_questions
  FOR EACH ROW EXECUTE FUNCTION public.contest_application_questions_enforce_limit();

-- ---------------------------------------------------------------------------
-- 7. Campaign list RPCs: admins are never hidden by list_only_to_eligible
--    (copied from 20261016_access_polish.sql; only that condition changes)
-- ---------------------------------------------------------------------------

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
        NOT (
          COALESCE(p_eligible_only, false)
          OR EXISTS (
            SELECT 1 FROM public.contests lc
            WHERE lc.id = c.id AND lc.list_only_to_eligible AND NOT public.is_current_user_admin()
          )
        )
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
        NOT (
          COALESCE(p_eligible_only, false)
          OR EXISTS (
            SELECT 1 FROM public.contests lc
            WHERE lc.id = c.id AND lc.list_only_to_eligible AND NOT public.is_current_user_admin()
          )
        )
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
