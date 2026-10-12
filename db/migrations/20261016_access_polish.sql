-- Campaign access polish (Phase 4).
--
--   1. contests.list_only_to_eligible: public campaigns can be listed only to
--      creators who meet their requirements.
--   2. is_current_user_admin(): caller-scoped admin check. Policies and helpers
--      move onto it and authenticated loses access to is_platform_admin(uuid),
--      which could be used to probe whether any user id is an admin.
--   3. get_contest_invite_preview hides campaign details unless the link is
--      usable (or the campaign is public, or the caller is already a member).
--   4. Switching a campaign to Public revokes its active invite links.
--   5. Opportunities list RPCs honour list_only_to_eligible. Bodies are copied
--      from 20261014; only the eligibility condition changes.
--
-- Apply after 20261014_campaign_restricted_applications.sql and
-- 20261015_campaign_access_notification_types.sql. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Eligible-only listing flag
-- ---------------------------------------------------------------------------

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS list_only_to_eligible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contests.list_only_to_eligible IS
  'Public campaigns only: list in Opportunities only to creators who meet the requirements.';

-- ---------------------------------------------------------------------------
-- 2. Caller-scoped admin check
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.user_type = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_access_contest(p_contest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contests c
    WHERE c.id = p_contest_id
      AND (
        c.access_mode = 'public'
        OR (
          auth.uid() IS NOT NULL
          AND (
            c.advertiser_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.contest_access_list a
              WHERE a.contest_id = c.id AND a.user_id = auth.uid()
            )
            OR public.is_current_user_admin()
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_contest_access(p_contest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_current_user_admin()
    OR EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = p_contest_id AND c.advertiser_id = auth.uid()
    )
  );
$$;

DROP POLICY IF EXISTS "Brand or admin manages own allowlists" ON public.brand_allowlists;
CREATE POLICY "Brand or admin manages own allowlists" ON public.brand_allowlists
  TO authenticated
  USING (advertiser_id = auth.uid() OR public.is_current_user_admin())
  WITH CHECK (advertiser_id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Brand or admin manages own allowlist members" ON public.brand_allowlist_members;
CREATE POLICY "Brand or admin manages own allowlist members" ON public.brand_allowlist_members
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_allowlists l
      WHERE l.id = allowlist_id
        AND (l.advertiser_id = auth.uid() OR public.is_current_user_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_allowlists l
      WHERE l.id = allowlist_id
        AND (l.advertiser_id = auth.uid() OR public.is_current_user_admin())
    )
  );

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Invite preview: no campaign details behind a dead link
-- ---------------------------------------------------------------------------

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
  v_status     text;
  v_member     boolean;
BEGIN
  SELECT l.id, l.contest_id INTO v_link_id, v_contest_id
  FROM public.contest_invite_links l
  WHERE l.token = p_token;

  IF v_link_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text,
      false, 'not_found'::text, false;
    RETURN;
  END IF;

  v_status := public.contest_invite_link_status(v_link_id);
  v_member := auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contest_access_list a
    WHERE a.contest_id = v_contest_id AND a.user_id = auth.uid()
  );

  IF v_status NOT IN ('active', 'public') AND NOT v_member THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::text,
      false, v_status, false;
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
    v_member
  FROM public.contests c
  LEFT JOIN public.advertiser_profiles ap ON ap.id = c.advertiser_id
  LEFT JOIN public.users u ON u.id = c.advertiser_id
  WHERE c.id = v_contest_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_contest_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contest_invite_preview(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Going public revokes active invite links
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.revoke_invite_links_when_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.access_mode = 'public' AND OLD.access_mode IS DISTINCT FROM 'public' THEN
    UPDATE public.contest_invite_links l
    SET revoked_at = now()
    WHERE l.contest_id = NEW.id
      AND l.revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_invite_links_when_public() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS contests_revoke_invite_links_when_public ON public.contests;
CREATE TRIGGER contests_revoke_invite_links_when_public
  AFTER UPDATE OF access_mode ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_invite_links_when_public();

-- ---------------------------------------------------------------------------
-- 5. Campaign list RPCs: eligibility filter also applies when the campaign
--    sets list_only_to_eligible. Bodies copied from 20261014.
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
            WHERE lc.id = c.id AND lc.list_only_to_eligible
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
            WHERE lc.id = c.id AND lc.list_only_to_eligible
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
