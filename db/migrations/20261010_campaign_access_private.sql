-- Private campaigns with saved brand allowlists (Phase 1).
--
-- Access rule: a campaign is visible to a creator when access_mode = 'public',
-- or there is a contest_access_list row for (campaign, creator). Brands always
-- see their own campaigns and admins see everything (existing policies).
-- Submitting additionally requires the existing creator requirements unless the
-- campaign sets access_list_skips_requirements.
--
-- Apply after SUPABASE/migrations/20260904_max_earnings_per_creator_jsonb.sql and
-- db/migrations/20260925_campaign_platform_filter_constraints.sql (the list RPC
-- bodies below are copied from 20260904 with only the access filter added).

-- ---------------------------------------------------------------------------
-- 1. Campaign columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS access_list_skips_requirements boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contests_access_mode_check'
  ) THEN
    ALTER TABLE public.contests
      ADD CONSTRAINT contests_access_mode_check
      CHECK (access_mode IN ('public', 'restricted', 'private'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.contests.access_mode IS
  'public: visible to everyone. private: visible only to contest_access_list members (plus owner/admins). restricted: reserved for a later phase.';
COMMENT ON COLUMN public.contests.access_list_skips_requirements IS
  'When true, creators on contest_access_list skip trust/quality/earnings/views requirements.';

-- Expose the access columns on contests_with_status. Column list copied from
-- SUPABASE/migrations/20260904_max_earnings_per_creator_jsonb.sql with the two
-- new columns appended: CREATE OR REPLACE may only add columns at the end, and
-- fails (instead of silently dropping anything) if the live view differs.
CREATE OR REPLACE VIEW public.contests_with_status
WITH (security_invoker = on) AS
SELECT
  contests.id,
  contests.advertiser_id,
  contests.title,
  contests.platform,
  contests.start_date,
  contests.end_date,
  contests.thumbnail_url,
  contests.resources,
  contests.category,
  contests.inspiration_links,
  contests.tracking_links,
  contests.created_at,
  contests.subscription_info_of_user,
  contests.updated_at,
  contests.contest_type,
  contests.contest_based_details,
  contests.live_submission_count,
  contests.post_contest_status,
  contests.brief_html,
  contests.brief_json,
  contests.last_metrics_updated,
  contests.rules_html,
  contests.rules_json,
  contests.moderation_status,
  contests.submitted_for_approval_at,
  contests.approved_at,
  contests.approved_by,
  contests.published_at,
  contests.rejection_reason,
  contests.payment_details,
  CASE
    WHEN contests.moderation_status <> 'published'::public.contest_moderation_status_enum THEN NULL::text
    WHEN contests.start_date IS NULL OR contests.end_date IS NULL THEN 'incomplete'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.start_date
      AND (now() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status,
  contests.views_locked_at,
  contests.multiple_submissions_enabled,
  contests.max_submissions_per_creator,
  contests.content_type,
  contests.bonus_details,
  contests.max_earnings_per_creator,
  contests.categories,
  contests.subcategories,
  contests.interests,
  contests.region,
  contests.contest_format,
  contests.payout_adjustment_percentage,
  contests.payout_adjustment_mode,
  contests.trust_score,
  contests.trust_number,
  contests.min_avg_quality_score,
  contests.min_best_quality_score,
  contests.min_platform_earnings,
  contests.min_platform_views,
  contests.min_quality_score,
  contests.post_campaign_last_metrics_updated,
  contests.post_campaign_last_synced_at,
  contests.access_mode,
  contests.access_list_skips_requirements
FROM public.contests;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.brand_allowlists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES public.advertiser_profiles(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  member_count  integer NOT NULL DEFAULT 0,
  created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS brand_allowlists_name_per_brand
  ON public.brand_allowlists (advertiser_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.brand_allowlist_members (
  allowlist_id uuid NOT NULL REFERENCES public.brand_allowlists(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (allowlist_id, user_id)
);

CREATE INDEX IF NOT EXISTS brand_allowlist_members_user
  ON public.brand_allowlist_members (user_id);

CREATE TABLE IF NOT EXISTS public.contest_access_list (
  contest_id          uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source              text NOT NULL
                      CHECK (source IN ('saved_list', 'manual', 'existing_submitter')),
  source_allowlist_id uuid REFERENCES public.brand_allowlists(id) ON DELETE SET NULL,
  added_by            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS contest_access_list_user
  ON public.contest_access_list (user_id);

-- ---------------------------------------------------------------------------
-- 3. member_count maintenance (statement-level so bulk inserts stay cheap)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.brand_allowlist_members_count_ins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.brand_allowlists b
  SET member_count = b.member_count + d.n,
      updated_at = now()
  FROM (
    SELECT allowlist_id, count(*)::integer AS n
    FROM new_rows
    GROUP BY allowlist_id
  ) d
  WHERE b.id = d.allowlist_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.brand_allowlist_members_count_del()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.brand_allowlists b
  SET member_count = GREATEST(0, b.member_count - d.n),
      updated_at = now()
  FROM (
    SELECT allowlist_id, count(*)::integer AS n
    FROM old_rows
    GROUP BY allowlist_id
  ) d
  WHERE b.id = d.allowlist_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS brand_allowlist_members_count_ins ON public.brand_allowlist_members;
CREATE TRIGGER brand_allowlist_members_count_ins
  AFTER INSERT ON public.brand_allowlist_members
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.brand_allowlist_members_count_ins();

DROP TRIGGER IF EXISTS brand_allowlist_members_count_del ON public.brand_allowlist_members;
CREATE TRIGGER brand_allowlist_members_count_del
  AFTER DELETE ON public.brand_allowlist_members
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.brand_allowlist_members_count_del();

-- ---------------------------------------------------------------------------
-- 4. Access helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id AND u.user_type = 'admin'
  );
$$;

-- Caller-scoped (auth.uid()) so it can't be used to probe other users' access.
-- SECURITY DEFINER: reads contests/contest_access_list without re-entering RLS.
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
            OR public.is_platform_admin(auth.uid())
          )
        )
      )
  );
$$;

-- Owner brand or admin may manage a campaign's access list.
CREATE OR REPLACE FUNCTION public.can_manage_contest_access(p_contest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = p_contest_id AND c.advertiser_id = auth.uid()
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_contest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_contest_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_contest(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_contest_access(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Row-level security
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public can view published contests" ON public.contests;
CREATE POLICY "Public can view published contests" ON public.contests
  FOR SELECT
  USING (
    moderation_status = 'published'::public.contest_moderation_status_enum
    AND (access_mode = 'public' OR public.can_access_contest(id))
  );

ALTER TABLE public.brand_allowlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_allowlist_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_access_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brand or admin manages own allowlists" ON public.brand_allowlists;
CREATE POLICY "Brand or admin manages own allowlists" ON public.brand_allowlists
  TO authenticated
  USING (advertiser_id = auth.uid() OR public.is_platform_admin(auth.uid()))
  WITH CHECK (advertiser_id = auth.uid() OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Brand or admin manages own allowlist members" ON public.brand_allowlist_members;
CREATE POLICY "Brand or admin manages own allowlist members" ON public.brand_allowlist_members
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_allowlists l
      WHERE l.id = allowlist_id
        AND (l.advertiser_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_allowlists l
      WHERE l.id = allowlist_id
        AND (l.advertiser_id = auth.uid() OR public.is_platform_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Creators read own campaign access" ON public.contest_access_list;
CREATE POLICY "Creators read own campaign access" ON public.contest_access_list
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Brand or admin manages campaign access" ON public.contest_access_list;
CREATE POLICY "Brand or admin manages campaign access" ON public.contest_access_list
  TO authenticated
  USING (public.can_manage_contest_access(contest_id))
  WITH CHECK (public.can_manage_contest_access(contest_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_allowlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_allowlist_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contest_access_list TO authenticated;
GRANT ALL ON public.brand_allowlists, public.brand_allowlist_members, public.contest_access_list
  TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Campaign list RPCs: hide non-public campaigns from opportunities unless
--    the caller has access. Bodies copied from 20260904; only the
--    access filter is new. The access_mode check comes first so
--    can_access_contest() only runs for non-public rows.
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
    AND (c.access_mode = 'public' OR public.can_access_contest(c.id));
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
        OR c.access_mode = 'public'
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
        OR c.access_mode = 'public'
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

-- ---------------------------------------------------------------------------
-- 7. Submission gate: access check + optional requirement bypass.
--    Body copied from 20260707_gate_checks_profile_cache_only.sql; the access
--    block before the text_image early return is new.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_submission_creator_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_format text;
  v_access_mode text;
  v_skip_requirements boolean;
  v_on_access_list boolean;
  v_min_trust integer;
  v_min_trust_number integer;
  v_min_avg_quality numeric;
  v_min_best_quality integer;
  v_min_quality integer;
  v_min_earnings bigint;
  v_min_views bigint;
  v_creator_score integer;
  v_creator_trust_number integer;
  v_creator_avg_quality numeric;
  v_creator_best_quality integer;
  v_creator_quality_sum numeric;
  v_creator_earnings bigint;
  v_creator_views bigint;
  v_verified integer;
  v_rejected integer;
  v_has_explicit boolean;
  v_profile_verified integer;
  v_profile_rejected integer;
  v_apply_quality_gates boolean;
BEGIN
  SELECT
    c.contest_format,
    COALESCE(c.access_mode, 'public'),
    COALESCE(c.access_list_skips_requirements, false),
    c.trust_score,
    c.trust_number,
    c.min_avg_quality_score,
    c.min_best_quality_score,
    c.min_quality_score,
    c.min_platform_earnings,
    c.min_platform_views
  INTO
    v_format,
    v_access_mode,
    v_skip_requirements,
    v_min_trust,
    v_min_trust_number,
    v_min_avg_quality,
    v_min_best_quality,
    v_min_quality,
    v_min_earnings,
    v_min_views
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  v_on_access_list := EXISTS (
    SELECT 1 FROM public.contest_access_list a
    WHERE a.contest_id = NEW.contest_id AND a.user_id = NEW.creator_id
  );

  IF v_access_mode <> 'public' AND NOT v_on_access_list THEN
    RAISE EXCEPTION
      'campaign_access_denied: Creator is not on this private campaign''s access list'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_on_access_list AND v_skip_requirements THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_format, 'video') = 'text_image' THEN
    RETURN NEW;
  END IF;

  IF v_min_trust IS NULL AND v_min_trust_number IS NULL
     AND v_min_avg_quality IS NULL AND v_min_best_quality IS NULL
     AND v_min_quality IS NULL
     AND v_min_earnings IS NULL AND v_min_views IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    (cp.trust_score_metrics->>'trust_score')::integer,
    (cp.trust_score_metrics->>'trust_number')::integer,
    cp.avg_quality_score,
    cp.best_quality_score,
    COALESCE(cp.quality_score_sum, 0),
    COALESCE(cp.total_money_won, 0)::bigint,
    COALESCE(cp.total_views, 0)::bigint,
    COALESCE(cp.has_explicit_quality_scores, false),
    COALESCE((cp.trust_score_metrics->>'verified_reels')::integer, 0),
    COALESCE((cp.trust_score_metrics->>'rejected_reels')::integer, 0)
  INTO
    v_creator_score,
    v_creator_trust_number,
    v_creator_avg_quality,
    v_creator_best_quality,
    v_creator_quality_sum,
    v_creator_earnings,
    v_creator_views,
    v_has_explicit,
    v_profile_verified,
    v_profile_rejected
  FROM public.creator_profiles cp
  WHERE cp.id = NEW.creator_id;

  v_apply_quality_gates := v_has_explicit OR v_profile_verified = 0;

  IF v_creator_score IS NULL OR v_creator_trust_number IS NULL THEN
    v_verified := v_profile_verified;
    v_rejected := v_profile_rejected;
    v_creator_trust_number := COALESCE(v_verified, 0) - COALESCE(v_rejected, 0);

    IF COALESCE(v_verified, 0) = 0 THEN
      IF COALESCE(v_rejected, 0) > 0 THEN
        v_creator_score := 0;
      ELSE
        v_creator_score := 100;
      END IF;
    ELSE
      v_creator_score := GREATEST(
        0,
        LEAST(
          100,
          ROUND((v_creator_trust_number::numeric / v_verified::numeric) * 100)
        )
      )::integer;
    END IF;
  END IF;

  IF v_apply_quality_gates
     AND (v_min_avg_quality IS NOT NULL OR v_min_best_quality IS NOT NULL
          OR v_min_quality IS NOT NULL)
     AND v_profile_verified = 0 THEN
    IF COALESCE(v_profile_rejected, 0) > 0 THEN
      v_creator_avg_quality := NULL;
      v_creator_best_quality := NULL;
      v_creator_quality_sum := NULL;
    ELSE
      v_creator_avg_quality := 1;
      v_creator_best_quality := 1;
      v_creator_quality_sum := 1;
    END IF;
  END IF;

  IF v_min_trust IS NOT NULL AND v_min_trust > 0 AND v_creator_score < v_min_trust THEN
    RAISE EXCEPTION
      'trust_score_too_low: Creator trust score (%) is below campaign minimum (%)',
      v_creator_score, v_min_trust USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_trust_number IS NOT NULL AND v_creator_trust_number < v_min_trust_number THEN
    RAISE EXCEPTION
      'trust_number_too_low: Creator trust number (%) is below campaign minimum (%)',
      v_creator_trust_number, v_min_trust_number USING ERRCODE = 'check_violation';
  END IF;

  IF v_apply_quality_gates AND v_min_best_quality IS NOT NULL AND (
    v_creator_best_quality IS NULL OR v_creator_best_quality < v_min_best_quality
  ) THEN
    RAISE EXCEPTION
      'best_quality_too_low: Creator best quality (%) is below campaign minimum (%)',
      COALESCE(v_creator_best_quality, 0), v_min_best_quality USING ERRCODE = 'check_violation';
  END IF;

  IF v_apply_quality_gates AND v_min_avg_quality IS NOT NULL AND (
    v_creator_avg_quality IS NULL OR v_creator_avg_quality < v_min_avg_quality
  ) THEN
    RAISE EXCEPTION
      'avg_quality_too_low: Creator average quality (%) is below campaign minimum (%)',
      COALESCE(v_creator_avg_quality, 0), v_min_avg_quality USING ERRCODE = 'check_violation';
  END IF;

  IF v_apply_quality_gates AND v_min_quality IS NOT NULL AND (
    v_creator_quality_sum IS NULL OR v_creator_quality_sum < v_min_quality
  ) THEN
    RAISE EXCEPTION
      'min_quality_too_low: Creator total quality score (%) is below campaign minimum (%)',
      COALESCE(v_creator_quality_sum, 0), v_min_quality USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_earnings IS NOT NULL AND v_min_earnings > 0
     AND v_creator_earnings < v_min_earnings THEN
    RAISE EXCEPTION
      'platform_earnings_too_low: Creator platform earnings (%) are below campaign minimum (%)',
      v_creator_earnings, v_min_earnings USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_views IS NOT NULL AND v_min_views > 0
     AND v_creator_views < v_min_views THEN
    RAISE EXCEPTION
      'platform_views_too_low: Creator platform views (%) are below campaign minimum (%)',
      v_creator_views, v_min_views USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Public -> non-public: existing submitters keep access.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.contest_access_grant_existing_submitters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.contest_access_list (contest_id, user_id, source, added_by)
  SELECT DISTINCT NEW.id, s.creator_id, 'existing_submitter', auth.uid()
  FROM public.submissions s
  JOIN public.users u ON u.id = s.creator_id
  WHERE s.contest_id = NEW.id
    AND s.creator_id IS NOT NULL
  ON CONFLICT (contest_id, user_id) DO NOTHING;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS contests_access_grant_existing_submitters ON public.contests;
CREATE TRIGGER contests_access_grant_existing_submitters
  AFTER UPDATE OF access_mode ON public.contests
  FOR EACH ROW
  WHEN (OLD.access_mode = 'public' AND NEW.access_mode <> 'public')
  EXECUTE FUNCTION public.contest_access_grant_existing_submitters();
