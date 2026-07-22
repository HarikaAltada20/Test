-- Paginated campaign list IDs (filter + sort + limit in SQL).
-- Includes sort-key helpers for budget/value/approval/CPM so list pages
-- never load the full campaign set into application memory.

-- ---------------------------------------------------------------------------
-- Safe jsonb numeric casts — corrupt values sort as NULL instead of failing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_list_json_numeric(p_text text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN btrim(p_text)::numeric;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.contest_list_json_float8(p_text text)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN btrim(p_text)::double precision;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contest_list_json_numeric(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contest_list_json_float8(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.contest_list_json_numeric(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contest_list_json_float8(text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Pool / prize value (cents) — mirrors lib/contest-list-sort getContestValueForSort
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_list_sort_value_cents(
  p_contest_type text,
  p_details jsonb
)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_details IS NULL OR p_contest_type IS NULL THEN NULL
    WHEN p_contest_type = 'leaderboard' THEN
      CASE
        WHEN COALESCE(
          public.contest_list_json_numeric(p_details->'leaderboard_contest'->>'total_prize'),
          0
        ) > 0
          THEN ROUND(
            public.contest_list_json_numeric(p_details->'leaderboard_contest'->>'total_prize')
          )::bigint
        ELSE NULL
      END
    WHEN p_contest_type = 'cpm' THEN
      CASE
        WHEN COALESCE(
          public.contest_list_json_numeric(p_details->'cpm_contest'->>'total_budget'),
          0
        ) > 0
          THEN ROUND(
            public.contest_list_json_numeric(p_details->'cpm_contest'->>'total_budget')
          )::bigint
        ELSE NULL
      END
    WHEN p_contest_type = 'milestone' THEN
      CASE
        WHEN COALESCE(
          public.contest_list_json_numeric(
            p_details->'milestone_contest'->>'total_budget_cents'
          ),
          0
        ) > 0
          THEN ROUND(
            public.contest_list_json_numeric(
              p_details->'milestone_contest'->>'total_budget_cents'
            )
          )::bigint
        ELSE NULL
      END
    WHEN p_contest_type = 'dual_rewards' THEN
      CASE
        WHEN COALESCE(
          public.contest_list_json_numeric(p_details->>'total_budget_cents'),
          0
        ) > 0
          THEN ROUND(
            public.contest_list_json_numeric(p_details->>'total_budget_cents')
          )::bigint
        WHEN COALESCE(
          public.contest_list_json_numeric(
            p_details->'milestone_contest'->>'total_budget_cents'
          ),
          0
        ) > 0
          AND COALESCE(
            public.contest_list_json_numeric(p_details->'cpm_contest'->>'total_budget'),
            0
          ) > 0
          THEN ROUND(
            GREATEST(
              public.contest_list_json_numeric(
                p_details->'milestone_contest'->>'total_budget_cents'
              ),
              public.contest_list_json_numeric(p_details->'cpm_contest'->>'total_budget')
            )
          )::bigint
        WHEN COALESCE(
          public.contest_list_json_numeric(
            p_details->'milestone_contest'->>'total_budget_cents'
          ),
          0
        ) > 0
          THEN ROUND(
            public.contest_list_json_numeric(
              p_details->'milestone_contest'->>'total_budget_cents'
            )
          )::bigint
        WHEN COALESCE(
          public.contest_list_json_numeric(p_details->'cpm_contest'->>'total_budget'),
          0
        ) > 0
          THEN ROUND(
            public.contest_list_json_numeric(p_details->'cpm_contest'->>'total_budget')
          )::bigint
        ELSE NULL
      END
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- CPM rate — mirrors getCpmRate (only cpm / dual_rewards)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_list_sort_cpm_rate(
  p_contest_type text,
  p_details jsonb
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_contest_type IN ('cpm', 'dual_rewards')
      AND COALESCE(
        public.contest_list_json_float8(p_details->'cpm_contest'->>'cpm_rate_usd'),
        -1
      ) >= 0
      THEN public.contest_list_json_float8(p_details->'cpm_contest'->>'cpm_rate_usd')
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- Budget spent (cents) from stored JSON — mirrors getContestBudgetSpentForSort
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_list_sort_budget_spent_cents(
  p_contest_type text,
  p_details jsonb
)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_details IS NULL OR p_contest_type IS NULL THEN NULL
    WHEN p_contest_type = 'leaderboard' THEN
      CASE
        WHEN COALESCE(
          public.contest_list_json_numeric(p_details->'leaderboard_contest'->>'total_budget'),
          0
        ) > 0
          THEN GREATEST(
            0,
            ROUND(
              COALESCE(
                public.contest_list_json_numeric(
                  p_details->'leaderboard_contest'->>'budget_spent'
                ),
                0
              )
            )::bigint
          )
        ELSE NULL
      END
    WHEN p_contest_type = 'milestone' THEN
      CASE
        WHEN COALESCE(
          public.contest_list_json_numeric(
            p_details->'milestone_contest'->>'total_budget_cents'
          ),
          0
        ) > 0
          THEN GREATEST(
            0,
            ROUND(
              COALESCE(
                public.contest_list_json_numeric(
                  p_details->'milestone_contest'->>'budget_spent'
                ),
                0
              )
            )::bigint
          )
        ELSE NULL
      END
    WHEN p_contest_type = 'cpm' THEN
      CASE
        WHEN COALESCE(
          public.contest_list_json_numeric(p_details->'cpm_contest'->>'total_budget'),
          0
        ) > 0
          THEN GREATEST(
            0,
            ROUND(
              COALESCE(
                public.contest_list_json_numeric(p_details->'cpm_contest'->>'budget_spent'),
                0
              )
            )::bigint
          )
        ELSE NULL
      END
    WHEN p_contest_type = 'dual_rewards' THEN
      CASE
        WHEN public.contest_list_sort_value_cents(p_contest_type, p_details) IS NULL THEN NULL
        WHEN COALESCE(
          public.contest_list_json_numeric(p_details->>'pool_budget_spent_cents'),
          -1
        ) >= 0
          THEN GREATEST(
            0,
            ROUND(
              public.contest_list_json_numeric(p_details->>'pool_budget_spent_cents')
            )::bigint
          )
        ELSE LEAST(
          public.contest_list_sort_value_cents(p_contest_type, p_details),
          GREATEST(
            0,
            ROUND(
              COALESCE(
                public.contest_list_json_numeric(p_details->'cpm_contest'->>'budget_spent'),
                0
              )
              + COALESCE(
                public.contest_list_json_numeric(
                  p_details->'milestone_contest'->>'budget_spent'
                ),
                0
              )
            )::bigint
          )
        )
      END
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- Budget remaining (cents) — mirrors getContestBudgetRemainingForSort
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_list_sort_budget_remaining_cents(
  p_contest_type text,
  p_details jsonb
)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_details IS NULL OR p_contest_type IS NULL THEN NULL
    WHEN p_contest_type = 'leaderboard' THEN
      CASE
        WHEN COALESCE(
          public.contest_list_json_numeric(p_details->'leaderboard_contest'->>'total_budget'),
          0
        ) > 0 THEN
          GREATEST(
            0,
            ROUND(
              public.contest_list_json_numeric(
                p_details->'leaderboard_contest'->>'total_budget'
              )
            )::bigint
            - GREATEST(
              0,
              ROUND(
                COALESCE(
                  public.contest_list_json_numeric(
                    p_details->'leaderboard_contest'->>'budget_spent'
                  ),
                  0
                )
              )::bigint
            )
          )
        WHEN COALESCE(
          public.contest_list_json_numeric(p_details->'leaderboard_contest'->>'total_prize'),
          0
        ) > 0
          THEN ROUND(
            public.contest_list_json_numeric(p_details->'leaderboard_contest'->>'total_prize')
          )::bigint
        ELSE NULL
      END
    WHEN p_contest_type = 'milestone' THEN
      CASE
        WHEN COALESCE(
          public.contest_list_json_numeric(
            p_details->'milestone_contest'->>'total_budget_cents'
          ),
          0
        ) > 0 THEN
          GREATEST(
            0,
            ROUND(
              public.contest_list_json_numeric(
                p_details->'milestone_contest'->>'total_budget_cents'
              )
            )::bigint
            - GREATEST(
              0,
              ROUND(
                COALESCE(
                  public.contest_list_json_numeric(
                    p_details->'milestone_contest'->>'budget_spent'
                  ),
                  0
                )
              )::bigint
            )
          )
        ELSE NULL
      END
    WHEN p_contest_type IN ('cpm', 'dual_rewards') THEN
      CASE
        WHEN public.contest_list_sort_value_cents(p_contest_type, p_details) IS NULL THEN NULL
        ELSE GREATEST(
          0,
          public.contest_list_sort_value_cents(p_contest_type, p_details)
          - COALESCE(
            public.contest_list_sort_budget_spent_cents(p_contest_type, p_details),
            0
          )
        )
      END
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- Approval % — mirrors getAdminApprovalPercent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_list_sort_approval_percent(
  p_status text,
  p_verified integer,
  p_pending integer,
  p_rejected integer,
  p_live_submission_count integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN GREATEST(
      COALESCE(p_live_submission_count, 0),
      COALESCE(p_verified, 0) + COALESCE(p_pending, 0) + COALESCE(p_rejected, 0)
    ) <= 0 THEN 0
    ELSE LEAST(
      100,
      ROUND(
        (
          CASE
            WHEN p_status = 'ended'
              THEN COALESCE(p_verified, 0) + COALESCE(p_pending, 0)
            ELSE COALESCE(p_verified, 0)
          END::numeric
          / GREATEST(
            COALESCE(p_live_submission_count, 0),
            COALESCE(p_verified, 0) + COALESCE(p_pending, 0) + COALESCE(p_rejected, 0)
          )::numeric
        ) * 100
      )::integer
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.contest_list_sort_value_cents(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contest_list_sort_cpm_rate(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contest_list_sort_budget_spent_cents(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contest_list_sort_budget_remaining_cents(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contest_list_sort_approval_percent(text, integer, integer, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.contest_list_sort_value_cents(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contest_list_sort_cpm_rate(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contest_list_sort_budget_spent_cents(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contest_list_sort_budget_remaining_cents(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contest_list_sort_approval_percent(text, integer, integer, integer, integer) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Paginated list IDs (filter + sort + limit), all list sorts included
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
  p_user_countries text[] DEFAULT NULL
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
        OR public.contest_matches_user_countries(c.region, v_user_countries)
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
        COALESCE(p_platform, 'all') = 'all'
        OR c.platform = p_platform
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
          -- Parity with opportunities client: media = video format only
          p_media_type = 'media'
          AND lower(coalesce(c.contest_format, '')) = 'video'
        )
        OR (
          -- Parity with opportunities client: text = text_image format only
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

COMMENT ON FUNCTION public.campaign_list_page_ids(
  text, uuid, text, text, integer, integer, text, text, text, text, text, text, text[]
) IS
  'Returns { total, ids } for one campaign list page after SQL filter/sort (incl. budget/value/approval/CPM).';

REVOKE ALL ON FUNCTION public.campaign_list_page_ids(
  text, uuid, text, text, integer, integer, text, text, text, text, text, text, text[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.campaign_list_page_ids(
  text, uuid, text, text, integer, integer, text, text, text, text, text, text, text[]
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.campaign_list_page_ids(
  text, uuid, text, text, integer, integer, text, text, text, text, text, text, text[]
) TO service_role;
