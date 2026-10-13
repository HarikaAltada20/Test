-- Final campaign access features.
--
--   1. Saved lists: "used in N campaigns" and the first members, per list.
--   2. Access tab: when each saved list last added creators, and how many
--      list members aren't on the campaign yet.
--   3. Brand campaign list: pending application counts in one query.
--   4. Invite page: platform, dates and prize details for live links.
--   5. Applications tab: sort (newest, oldest, most followers) and a
--      "meets requirements" state and filter per applicant.
--   6. Creator campaign list: access filter (open / apply / invited / applied).
--   7. "Notify me when applications reopen": waitlist table, join/leave
--      functions and a trigger that notifies when applications reopen.
--
-- Apply after 20261019_applications_reopened_notification_type.sql (run that
-- one first, on its own). Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Saved list summaries
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS contest_access_list_source_allowlist
  ON public.contest_access_list (source_allowlist_id)
  WHERE source_allowlist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS brand_allowlist_members_list_added
  ON public.brand_allowlist_members (allowlist_id, added_at, user_id);

-- Server-only (the API checks the caller owns the lists).
-- campaign_count: campaigns with creators imported from the list.
-- preview: the first three members (id, username, name, photo).
CREATE OR REPLACE FUNCTION public.brand_allowlist_summaries(p_allowlist_ids uuid[])
RETURNS TABLE (allowlist_id uuid, campaign_count bigint, preview jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    l.id,
    (
      SELECT count(DISTINCT a.contest_id)
      FROM public.contest_access_list a
      WHERE a.source_allowlist_id = l.id
    ),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id', u.id,
            'username', u.username,
            'full_name', u.full_name,
            'profile_picture_url', u.profile_picture_url
          )
          ORDER BY m.added_at, m.user_id
        )
        FROM (
          SELECT bm.user_id, bm.added_at
          FROM public.brand_allowlist_members bm
          WHERE bm.allowlist_id = l.id
          ORDER BY bm.added_at, bm.user_id
          LIMIT 3
        ) m
        JOIN public.users u ON u.id = m.user_id
      ),
      '[]'::jsonb
    )
  FROM public.brand_allowlists l
  WHERE l.id = ANY (p_allowlist_ids);
$$;

REVOKE ALL ON FUNCTION public.brand_allowlist_summaries(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_allowlist_summaries(uuid[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Saved list sync status for one campaign
-- ---------------------------------------------------------------------------

-- Server-only (the API checks the caller can manage the campaign).
-- last_added_at: the latest time a creator was added from the list.
-- new_members: list members not on the campaign (what a sync would add).
CREATE OR REPLACE FUNCTION public.contest_saved_list_sync_status(p_contest_id uuid)
RETURNS TABLE (allowlist_id uuid, last_added_at timestamptz, new_members bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    a.source_allowlist_id,
    max(a.added_at),
    (
      SELECT count(*)
      FROM public.brand_allowlist_members m
      WHERE m.allowlist_id = a.source_allowlist_id
        AND NOT EXISTS (
          SELECT 1 FROM public.contest_access_list x
          WHERE x.contest_id = p_contest_id AND x.user_id = m.user_id
        )
    )
  FROM public.contest_access_list a
  WHERE a.contest_id = p_contest_id
    AND a.source_allowlist_id IS NOT NULL
  GROUP BY a.source_allowlist_id;
$$;

REVOKE ALL ON FUNCTION public.contest_saved_list_sync_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contest_saved_list_sync_status(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Pending application counts for a page of campaigns
-- ---------------------------------------------------------------------------

-- Runs as the caller, so row-level security limits it to campaigns the
-- caller may review (their own, or any for admins).
CREATE OR REPLACE FUNCTION public.contest_pending_application_counts(p_contest_ids uuid[])
RETURNS TABLE (contest_id uuid, pending bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT a.contest_id, count(*)
  FROM public.contest_applications a
  WHERE a.contest_id = ANY (p_contest_ids)
    AND a.status = 'pending'
  GROUP BY a.contest_id;
$$;

REVOKE ALL ON FUNCTION public.contest_pending_application_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contest_pending_application_counts(uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Invite preview: platform, dates and prize details
--    (copied from 20261016_access_polish.sql; new columns at the end).
--    The return type changes, so the old function is dropped first.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_contest_invite_preview(text);

CREATE FUNCTION public.get_contest_invite_preview(p_token text)
RETURNS TABLE (
  contest_id            uuid,
  title                 text,
  brand_name            text,
  thumbnail_url         text,
  is_published          boolean,
  link_status           text,
  already_member        boolean,
  platform              text,
  contest_type          text,
  start_date            timestamptz,
  end_date              timestamptz,
  contest_based_details jsonb
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
  v_status     text;
  v_member     boolean;
BEGIN
  SELECT l.id, l.contest_id INTO v_link_id, v_contest_id
  FROM public.contest_invite_links l
  WHERE l.token = p_token;

  IF v_link_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text,
      false, 'not_found'::text, false,
      NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz, NULL::jsonb;
    RETURN;
  END IF;

  v_status := public.contest_invite_link_status(v_link_id);
  v_member := auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contest_access_list a
    WHERE a.contest_id = v_contest_id AND a.user_id = auth.uid()
  );

  -- Dead links show no campaign details.
  IF v_status NOT IN ('active', 'public') AND NOT v_member THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text,
      false, v_status, false,
      NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz, NULL::jsonb;
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
    v_status,
    v_member,
    c.platform::text,
    c.contest_type::text,
    c.start_date,
    c.end_date,
    -- Same trimming as the Restricted preview: no Twitter campaign internals.
    CASE
      WHEN c.contest_based_details ? 'twitter_campaign' THEN
        (c.contest_based_details - 'twitter_campaign')
        || jsonb_build_object(
          'twitter_campaign',
          jsonb_strip_nulls(jsonb_build_object(
            'campaign_type', c.contest_based_details -> 'twitter_campaign' -> 'campaign_type'
          ))
        )
      ELSE c.contest_based_details
    END
  FROM public.contests c
  LEFT JOIN public.advertiser_profiles ap ON ap.id = c.advertiser_id
  LEFT JOIN public.users u ON u.id = c.advertiser_id
  WHERE c.id = v_contest_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_contest_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contest_invite_preview(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Applications: requirement state, follower sort and filter
-- ---------------------------------------------------------------------------

-- A stored social account as an object. Some rows hold the JSON as a string.
CREATE OR REPLACE FUNCTION public.social_account_object(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_parsed jsonb;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_value) = 'object' THEN
    RETURN p_value;
  END IF;
  IF jsonb_typeof(p_value) = 'string' THEN
    BEGIN
      v_parsed := (p_value #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
    IF jsonb_typeof(v_parsed) = 'object' THEN
      RETURN v_parsed;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- A whole number from a JSON number or numeric string; NULL for anything
-- else or out of range, so one odd stored value never breaks a query.
CREATE OR REPLACE FUNCTION public.safe_bigint(p_value jsonb)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_value) IN ('number', 'string')
      AND btrim(p_value #>> '{}') ~ '^-?[0-9]{1,15}(\.[0-9]+)?$'
    THEN round(btrim(p_value #>> '{}')::numeric)::bigint
  END;
$$;

-- A non-negative follower count, or NULL.
CREATE OR REPLACE FUNCTION public.social_count(p_value jsonb)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN public.safe_bigint(p_value) >= 0 THEN public.safe_bigint(p_value) END;
$$;

-- Biggest follower count across a creator's connected accounts
-- (same fields as publicSocialAccount in lib/campaign-applicant-profile.ts).
CREATE OR REPLACE FUNCTION public.creator_top_follower_count(p_profile public.creator_profiles)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_yt jsonb := public.social_account_object(p_profile.youtube_account);
  v_ig jsonb := public.social_account_object(p_profile.instagram_account);
  v_tt jsonb := public.social_account_object(p_profile.tiktok_account);
  v_tw jsonb := public.social_account_object(p_profile.twitter_account);
BEGIN
  RETURN GREATEST(
    COALESCE(public.social_count(v_yt -> 'subscriber_count'), public.social_count(v_yt -> 'subscriberCount')),
    COALESCE(public.social_count(v_ig -> 'followers_count'), public.social_count(v_ig -> 'follower_count')),
    COALESCE(public.social_count(v_tt -> 'follower_count'), public.social_count(v_tt -> 'followers_count')),
    COALESCE(
      public.social_count(v_tw -> 'followers_count'),
      public.social_count(public.social_account_object(v_tw -> 'public_metrics') -> 'followers_count')
    )
  );
END;
$$;

-- Whether an applicant meets a campaign's creator requirements:
--   'skipped' - the campaign lets listed creators skip requirements (approval lists them)
--   'none'    - the campaign has no requirements
--   'meets' / 'below'
-- Mirrors enforce_submission_creator_requirements (cached profile metrics,
-- same fallbacks) so the label matches what happens when they submit.
CREATE OR REPLACE FUNCTION public.contest_application_requirement_state(
  p_contest public.contests,
  p_profile public.creator_profiles
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_score integer;
  v_number integer;
  v_avg numeric;
  v_best integer;
  v_sum numeric;
  v_verified integer;
  v_rejected integer;
  v_explicit boolean;
  v_apply_quality boolean;
BEGIN
  IF COALESCE(p_contest.access_list_skips_requirements, false) THEN
    RETURN 'skipped';
  END IF;

  IF COALESCE(p_contest.contest_format, 'video') = 'text_image'
     OR (
       COALESCE(p_contest.trust_score, 0) <= 0
       AND p_contest.trust_number IS NULL
       AND NOT COALESCE(p_contest.min_avg_quality_score BETWEEN 1 AND 5, false)
       AND NOT COALESCE(p_contest.min_best_quality_score BETWEEN 1 AND 5, false)
       AND COALESCE(p_contest.min_quality_score, 0) <= 0
       AND COALESCE(p_contest.min_platform_earnings, 0) <= 0
       AND COALESCE(p_contest.min_platform_views, 0) <= 0
     ) THEN
    RETURN 'none';
  END IF;

  -- Same fields as the submission trigger, read without failing on odd values.
  v_score := public.safe_bigint(p_profile.trust_score_metrics -> 'trust_score');
  v_number := public.safe_bigint(p_profile.trust_score_metrics -> 'trust_number');
  v_verified := COALESCE(public.safe_bigint(p_profile.trust_score_metrics -> 'verified_reels'), 0);
  v_rejected := COALESCE(public.safe_bigint(p_profile.trust_score_metrics -> 'rejected_reels'), 0);
  v_avg := p_profile.avg_quality_score;
  v_best := p_profile.best_quality_score;
  v_sum := COALESCE(p_profile.quality_score_sum, 0);
  v_explicit := COALESCE(p_profile.has_explicit_quality_scores, false);
  v_apply_quality := v_explicit OR v_verified = 0;

  IF v_score IS NULL OR v_number IS NULL THEN
    v_number := v_verified - v_rejected;
    IF v_verified = 0 THEN
      v_score := CASE WHEN v_rejected > 0 THEN 0 ELSE 100 END;
    ELSE
      v_score := GREATEST(0, LEAST(100, ROUND((v_number::numeric / v_verified::numeric) * 100)))::integer;
    END IF;
  END IF;

  IF v_apply_quality AND v_verified = 0 THEN
    IF v_rejected > 0 THEN
      v_avg := NULL;
      v_best := NULL;
      v_sum := NULL;
    ELSE
      v_avg := 1;
      v_best := 1;
      v_sum := 1;
    END IF;
  END IF;

  RETURN CASE
    WHEN public.contest_matches_creator_eligibility(
      p_contest.contest_format,
      p_contest.trust_score,
      p_contest.trust_number,
      p_contest.min_avg_quality_score,
      p_contest.min_best_quality_score,
      p_contest.min_quality_score,
      p_contest.min_platform_earnings,
      p_contest.min_platform_views,
      v_score,
      v_number,
      v_avg,
      v_best,
      v_sum,
      COALESCE(p_profile.total_money_won, 0)::bigint,
      COALESCE(p_profile.total_views, 0)::bigint,
      v_verified,
      v_explicit
    ) THEN 'meets'
    ELSE 'below'
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.creator_top_follower_count(public.creator_profiles) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contest_application_requirement_state(public.contests, public.creator_profiles)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.creator_top_follower_count(public.creator_profiles) TO service_role;
GRANT EXECUTE ON FUNCTION public.contest_application_requirement_state(public.contests, public.creator_profiles)
  TO service_role;

-- New optional sort and requirements filter; the old five-argument version
-- is dropped so calls without them resolve to this one.
DROP FUNCTION IF EXISTS public.contest_applications_page(uuid, text, text, integer, integer);

-- Server-only (the API route checks the caller can manage the campaign).
-- Returns { total, counts: { status: n }, rows: [application + on_access_list + requirement_state] }.
-- p_sort: newest (default) | oldest | followers. p_requirements: all | meets | below
-- ('meets' includes campaigns with no requirements or that skip them).
CREATE OR REPLACE FUNCTION public.contest_applications_page(
  p_contest_id uuid,
  p_status text,
  p_search text,
  p_offset integer,
  p_limit integer,
  p_sort text DEFAULT 'newest',
  p_requirements text DEFAULT 'all'
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
  v_sort   text := CASE WHEN p_sort IN ('oldest', 'followers') THEN p_sort ELSE 'newest' END;
  v_req    text := CASE WHEN p_requirements IN ('meets', 'below') THEN p_requirements END;
  v_contest public.contests;
  v_counts jsonb;
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  SELECT * INTO v_contest FROM public.contests c WHERE c.id = p_contest_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('total', 0, 'counts', '{}'::jsonb, 'rows', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_object_agg(s.status, s.n), '{}'::jsonb) INTO v_counts
  FROM (
    SELECT a.status, count(*) AS n
    FROM public.contest_applications a
    WHERE a.contest_id = p_contest_id
    GROUP BY a.status
  ) s;

  WITH matched AS (
    SELECT
      a.id,
      a.contest_id,
      a.user_id,
      a.status,
      a.answers,
      a.rejection_reason,
      a.reviewed_at,
      a.created_at,
      public.contest_application_requirement_state(v_contest, cp) AS requirement_state,
      CASE WHEN v_sort = 'followers' THEN public.creator_top_follower_count(cp) END AS top_followers
    FROM public.contest_applications a
    LEFT JOIN public.users u ON u.id = a.user_id
    LEFT JOIN public.creator_profiles cp ON cp.id = a.user_id
    WHERE a.contest_id = p_contest_id
      AND (v_status IS NULL OR a.status = v_status)
      AND (v_search IS NULL OR strpos(lower(COALESCE(u.username, '')), v_search) > 0)
  ),
  filtered AS (
    SELECT
      m.*,
      row_number() OVER (
        ORDER BY
          CASE WHEN v_sort = 'followers' THEN m.top_followers END DESC NULLS LAST,
          CASE WHEN v_sort = 'oldest' THEN m.created_at END ASC,
          m.created_at DESC,
          m.id
      ) AS pos
    FROM matched m
    WHERE v_req IS NULL
       OR (v_req = 'meets' AND m.requirement_state <> 'below')
       OR (v_req = 'below' AND m.requirement_state = 'below')
  )
  SELECT
    (SELECT count(*) FROM filtered),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', f.id,
            'contest_id', f.contest_id,
            'user_id', f.user_id,
            'status', f.status,
            'answers', f.answers,
            'rejection_reason', f.rejection_reason,
            'reviewed_at', f.reviewed_at,
            'created_at', f.created_at,
            'requirement_state', f.requirement_state,
            'on_access_list', EXISTS (
              SELECT 1 FROM public.contest_access_list l
              WHERE l.contest_id = f.contest_id AND l.user_id = f.user_id
            )
          )
          ORDER BY f.pos
        )
        FROM filtered f
        WHERE f.pos > v_offset AND f.pos <= v_offset + v_limit
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'counts', v_counts, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.contest_applications_page(uuid, text, text, integer, integer, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contest_applications_page(uuid, text, text, integer, integer, text, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Creator campaign list: access filter
--    (copied from 20261017_access_review_fixes.sql; adds p_access and its
--    condition only). The signature changes, so the old one is dropped.
--    p_access: all | open (Public) | apply (Restricted, not joined or applied)
--              | invited (on the access list) | applied (any application)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.campaign_list_page_ids(
  text, uuid, text, text, integer, integer, text, text, text, text, text, text, text[],
  boolean, numeric, integer, numeric, integer, numeric, bigint, bigint, integer, boolean
);

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
  p_creator_has_explicit_quality boolean DEFAULT NULL,
  p_access text DEFAULT 'all'
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
        p_scope <> 'opportunities'
        OR COALESCE(p_access, 'all') = 'all'
        OR (p_access = 'open' AND c.access_mode = 'public')
        OR (
          p_access = 'apply'
          AND c.access_mode = 'restricted'
          AND NOT EXISTS (
            SELECT 1 FROM public.contest_access_list al
            WHERE al.contest_id = c.id AND al.user_id = auth.uid()
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.contest_applications ap
            WHERE ap.contest_id = c.id AND ap.user_id = auth.uid()
              AND ap.status <> 'withdrawn'
          )
        )
        OR (
          p_access = 'invited'
          AND c.access_mode <> 'public'
          AND EXISTS (
            SELECT 1 FROM public.contest_access_list al
            WHERE al.contest_id = c.id AND al.user_id = auth.uid()
          )
        )
        OR (
          p_access = 'applied'
          AND EXISTS (
            SELECT 1 FROM public.contest_applications ap
            WHERE ap.contest_id = c.id AND ap.user_id = auth.uid()
          )
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

REVOKE ALL ON FUNCTION public.campaign_list_page_ids(
  text, uuid, text, text, integer, integer, text, text, text, text, text, text, text[],
  boolean, numeric, integer, numeric, integer, numeric, bigint, bigint, integer, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_list_page_ids(
  text, uuid, text, text, integer, integer, text, text, text, text, text, text, text[],
  boolean, numeric, integer, numeric, integer, numeric, bigint, bigint, integer, boolean, text
) TO authenticated, service_role;

-- Opportunities "Apply to join" looks up the caller's applications per campaign.
CREATE INDEX IF NOT EXISTS contest_applications_user_contest
  ON public.contest_applications (user_id, contest_id);

-- ---------------------------------------------------------------------------
-- 7. "Notify me when applications reopen"
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contest_application_waitlist (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS contest_application_waitlist_user
  ON public.contest_application_waitlist (user_id);

COMMENT ON TABLE public.contest_application_waitlist IS
  'Creators to notify when a paused Restricted campaign accepts applications again. Rows are removed once notified.';

-- Creators read their own rows; all writes go through the functions below.
ALTER TABLE public.contest_application_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators read own waitlist entries" ON public.contest_application_waitlist;
CREATE POLICY "Creators read own waitlist entries" ON public.contest_application_waitlist
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Results: joined | already_joined | not_signed_in | not_found | applications_open
--          | ended | has_access | already_applied
CREATE OR REPLACE FUNCTION public.join_application_waitlist(p_contest_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_contest record;
BEGIN
  IF v_user IS NULL THEN
    RETURN 'not_signed_in';
  END IF;

  SELECT c.access_mode, c.moderation_status::text AS moderation_status,
         c.applications_open, c.end_date, c.region
  INTO v_contest
  FROM public.contests c
  WHERE c.id = p_contest_id;

  IF NOT FOUND
     OR v_contest.access_mode <> 'restricted'
     OR v_contest.moderation_status <> 'published'
     OR NOT public.contest_matches_user_countries(v_contest.region, public.current_user_countries()) THEN
    RETURN 'not_found';
  END IF;
  IF v_contest.end_date IS NOT NULL AND now() >= v_contest.end_date THEN
    RETURN 'ended';
  END IF;
  IF v_contest.applications_open THEN
    RETURN 'applications_open';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contest_access_list a
    WHERE a.contest_id = p_contest_id AND a.user_id = v_user
  ) THEN
    RETURN 'has_access';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contest_applications a
    WHERE a.contest_id = p_contest_id AND a.user_id = v_user AND a.status = 'pending'
  ) THEN
    RETURN 'already_applied';
  END IF;

  INSERT INTO public.contest_application_waitlist (contest_id, user_id)
  VALUES (p_contest_id, v_user)
  ON CONFLICT DO NOTHING;

  RETURN CASE WHEN FOUND THEN 'joined' ELSE 'already_joined' END;
END;
$$;

-- Results: left | not_signed_in
CREATE OR REPLACE FUNCTION public.leave_application_waitlist(p_contest_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'not_signed_in';
  END IF;
  DELETE FROM public.contest_application_waitlist w
  WHERE w.contest_id = p_contest_id AND w.user_id = auth.uid();
  RETURN 'left';
END;
$$;

REVOKE ALL ON FUNCTION public.join_application_waitlist(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_application_waitlist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_application_waitlist(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_application_waitlist(uuid) TO authenticated, service_role;

-- When a published, live Restricted campaign starts accepting applications
-- again, notify everyone waiting (except creators who got access meanwhile)
-- and clear the waitlist. Runs for every way applications_open can change.
CREATE OR REPLACE FUNCTION public.contest_notify_application_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_title text := COALESCE(NULLIF(btrim(NEW.title), ''), 'a campaign');
  v_brand text;
BEGIN
  IF NEW.access_mode <> 'restricted'
     OR NEW.moderation_status::text <> 'published'
     OR (NEW.end_date IS NOT NULL AND now() >= NEW.end_date) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    NULLIF(btrim(ap.company_name), ''),
    NULLIF(btrim(u.full_name), ''),
    u.username,
    'The brand'
  )
  INTO v_brand
  FROM public.users u
  LEFT JOIN public.advertiser_profiles ap ON ap.id = u.id
  WHERE u.id = NEW.advertiser_id;

  INSERT INTO public.user_notifications (user_id, contest_id, notification_type, title, message_resolved)
  SELECT
    w.user_id,
    NEW.id,
    'campaign_applications_reopened'::public.admin_notification_type_enum,
    'Applications are open: ' || v_title,
    COALESCE(v_brand, 'The brand') || ' is accepting applications for ' || v_title || ' again.'
  FROM public.contest_application_waitlist w
  WHERE w.contest_id = NEW.id
    AND NOT EXISTS (
      SELECT 1 FROM public.contest_access_list a
      WHERE a.contest_id = NEW.id AND a.user_id = w.user_id
    );

  DELETE FROM public.contest_application_waitlist w WHERE w.contest_id = NEW.id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.contest_notify_application_waitlist() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS contests_notify_application_waitlist ON public.contests;
CREATE TRIGGER contests_notify_application_waitlist
  AFTER UPDATE OF applications_open ON public.contests
  FOR EACH ROW
  WHEN (OLD.applications_open IS DISTINCT FROM NEW.applications_open AND NEW.applications_open)
  EXECUTE FUNCTION public.contest_notify_application_waitlist();

COMMIT;
