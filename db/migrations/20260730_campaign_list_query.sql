-- Campaign list: SQL tab counts, region helper, and list-query indexes.
-- Enables grouped tab counts and faster filtered list reads.

-- ---------------------------------------------------------------------------
-- Region filter helper (opportunities)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_matches_user_countries(
  p_region jsonb,
  p_countries text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_region IS NULL
    OR p_region = '{}'::jsonb
    OR p_countries IS NULL
    OR cardinality(p_countries) = 0
    OR EXISTS (
      SELECT 1
      FROM jsonb_each(p_region) AS e(region_name, countries_json)
      CROSS JOIN LATERAL jsonb_array_elements_text(countries_json) AS rc(region_country)
      CROSS JOIN unnest(p_countries) AS uc(country)
      WHERE rc.region_country = uc.country
    );
$$;

COMMENT ON FUNCTION public.contest_matches_user_countries(jsonb, text[]) IS
  'True when contest has no region restriction or any user country is allowed.';

-- ---------------------------------------------------------------------------
-- Grouped tab + post-phase counts (single query)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.campaign_list_tab_counts(
  p_scope text,
  p_advertiser_id uuid DEFAULT NULL,
  p_contest_format text DEFAULT 'all',
  p_user_countries text[] DEFAULT NULL
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
BEGIN
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
        OR (p_advertiser_id IS NOT NULL AND c.advertiser_id = p_advertiser_id)
      )
      AND (
        p_scope <> 'opportunities'
        OR c.moderation_status = 'published'::public.contest_moderation_status_enum
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
            'text_image', 'text-image', 'text', 'image', ''
          )
        )
      )
      AND (
        p_scope <> 'opportunities'
        OR public.contest_matches_user_countries(c.region, p_user_countries)
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
          SELECT DISTINCT b.platform
          FROM base b
          WHERE b.platform IS NOT NULL AND b.platform <> ''
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

COMMENT ON FUNCTION public.campaign_list_tab_counts(text, uuid, text, text[]) IS
  'Grouped campaign tab counts, post-phase counts, and platforms for list filters.';

GRANT EXECUTE ON FUNCTION public.campaign_list_tab_counts(text, uuid, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_list_tab_counts(text, uuid, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.contest_matches_user_countries(jsonb, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contest_matches_user_countries(jsonb, text[]) TO service_role;

-- Published contest IDs visible to creators in given countries
CREATE OR REPLACE FUNCTION public.contest_ids_matching_user_countries(
  p_countries text[]
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.contests_with_status c
  WHERE c.moderation_status = 'published'::public.contest_moderation_status_enum
    AND public.contest_matches_user_countries(c.region, p_countries);
$$;

GRANT EXECUTE ON FUNCTION public.contest_ids_matching_user_countries(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contest_ids_matching_user_countries(text[]) TO service_role;

-- ---------------------------------------------------------------------------
-- List query indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contests_list_advertiser_created
  ON public.contests (advertiser_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contests_list_moderation_status
  ON public.contests (moderation_status);

CREATE INDEX IF NOT EXISTS idx_contests_list_platform
  ON public.contests (platform)
  WHERE platform IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contests_list_contest_type
  ON public.contests (contest_type)
  WHERE contest_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contests_list_published_dates
  ON public.contests (start_date, end_date)
  WHERE moderation_status = 'published';
