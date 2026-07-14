-- Admin analytics overview: aggregate submissions in Postgres
-- instead of loading every row (with other_stats) into Node.
-- Supports large view totals (billions) via SUM/GROUP BY.

-- Numeric metric from jsonb: try nested platform object, then root keys.
CREATE OR REPLACE FUNCTION public.admin_analytics_stat_num(
  p_stats jsonb,
  p_platform text,
  p_keys text[]
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_nested jsonb;
  v_key text;
  v_raw text;
  v_num numeric;
BEGIN
  IF p_stats IS NULL OR p_keys IS NULL THEN
    RETURN 0;
  END IF;

  IF p_platform IS NOT NULL AND length(trim(p_platform)) > 0 THEN
    v_nested := p_stats -> lower(trim(p_platform));
  END IF;

  IF v_nested IS NOT NULL AND jsonb_typeof(v_nested) = 'object' THEN
    FOREACH v_key IN ARRAY p_keys LOOP
      v_raw := v_nested ->> v_key;
      IF v_raw IS NOT NULL AND v_raw ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
        v_num := v_raw::numeric;
        IF v_num > 0 THEN
          RETURN trunc(v_num)::bigint;
        END IF;
      END IF;
    END LOOP;
  END IF;

  FOREACH v_key IN ARRAY p_keys LOOP
    v_raw := p_stats ->> v_key;
    IF v_raw IS NOT NULL AND v_raw ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
      v_num := v_raw::numeric;
      IF v_num > 0 THEN
        RETURN trunc(v_num)::bigint;
      END IF;
    END IF;
  END LOOP;

  RETURN 0;
END;
$$;

-- Views aligned with lib/admin-analytics getSubmissionMetricBundle.
CREATE OR REPLACE FUNCTION public.admin_analytics_submission_views(
  p_views bigint,
  p_platform text,
  p_other_stats jsonb
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_platform text := lower(COALESCE(NULLIF(trim(p_platform), ''), ''));
  v_direct bigint := GREATEST(COALESCE(p_views, 0), 0);
  v_from_stats bigint;
  v_reach bigint;
BEGIN
  IF v_platform = 'instagram' THEN
    v_from_stats := public.admin_analytics_stat_num(
      p_other_stats, 'instagram', ARRAY['views', 'view_count']
    );
    v_reach := public.admin_analytics_stat_num(
      p_other_stats, 'instagram', ARRAY['reach']
    );
    IF GREATEST(v_direct, v_from_stats) = 0 AND v_reach > 0 THEN
      RETURN v_reach;
    END IF;
    RETURN GREATEST(v_direct, v_from_stats);
  ELSIF v_platform = 'tiktok' OR v_platform = 'tik_tok' OR v_platform = 'tik-tok' THEN
    v_from_stats := public.admin_analytics_stat_num(
      p_other_stats, 'tiktok', ARRAY['view_count', 'views']
    );
    IF v_from_stats > 0 THEN
      RETURN v_from_stats;
    END IF;
    RETURN v_direct;
  ELSIF v_platform = 'youtube' THEN
    v_from_stats := public.admin_analytics_stat_num(
      p_other_stats, 'youtube', ARRAY['views', 'view_count']
    );
    IF v_from_stats > 0 THEN
      RETURN v_from_stats;
    END IF;
    RETURN v_direct;
  END IF;

  RETURN v_direct;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_overview_daily(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  day_key date,
  contest_id uuid,
  status text,
  submission_count bigint,
  views_sum bigint,
  likes_sum bigint,
  comments_sum bigint,
  shares_sum bigint,
  payout_cents_sum bigint,
  approved_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (s.created_at AT TIME ZONE 'UTC')::date AS day_key,
    s.contest_id,
    CASE
      WHEN lower(COALESCE(s.status::text, '')) = 'approved' THEN 'verified'
      WHEN lower(COALESCE(s.status::text, '')) IN ('pending', 'verified', 'paid', 'rejected')
        THEN lower(s.status::text)
      ELSE 'unknown'
    END AS status,
    COUNT(*)::bigint AS submission_count,
    COALESCE(
      SUM(
        public.admin_analytics_submission_views(
          s.views,
          COALESCE(s.platform::text, c.platform::text),
          s.other_stats
        )
      ),
      0
    )::bigint AS views_sum,
    COALESCE(
      SUM(
        public.admin_analytics_stat_num(
          s.other_stats,
          lower(COALESCE(s.platform::text, c.platform::text, '')),
          ARRAY['likes', 'like_count']
        )
      ),
      0
    )::bigint AS likes_sum,
    COALESCE(
      SUM(
        public.admin_analytics_stat_num(
          s.other_stats,
          lower(COALESCE(s.platform::text, c.platform::text, '')),
          ARRAY['comments', 'comment_count', 'replies']
        )
      ),
      0
    )::bigint AS comments_sum,
    COALESCE(
      SUM(
        public.admin_analytics_stat_num(
          s.other_stats,
          lower(COALESCE(s.platform::text, c.platform::text, '')),
          ARRAY['shares', 'share_count', 'retweets']
        )
      ),
      0
    )::bigint AS shares_sum,
    COALESCE(
      SUM(
        CASE
          WHEN lower(COALESCE(s.status::text, '')) = 'paid'
            OR COALESCE(s.earnings, 0) > 0
          THEN COALESCE(s.earnings, 0) + COALESCE(s.bonus_amount, 0)
          ELSE 0
        END
      ),
      0
    )::bigint AS payout_cents_sum,
    COALESCE(
      SUM(
        CASE
          WHEN lower(COALESCE(s.status::text, '')) IN ('verified', 'paid', 'approved')
          THEN 1
          ELSE 0
        END
      ),
      0
    )::bigint AS approved_count
  FROM public.submissions s
  LEFT JOIN public.contests c ON c.id = s.contest_id
  WHERE s.created_at >= p_from
    AND s.created_at <= p_to
    AND p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND s.contest_id = ANY (p_contest_ids)
  GROUP BY 1, 2, 3;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_stat_num(jsonb, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_submission_views(bigint, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_overview_daily(timestamptz, timestamptz, uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_analytics_stat_num(jsonb, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_submission_views(bigint, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_overview_daily(timestamptz, timestamptz, uuid[]) TO service_role;

-- Speed contest+date range scans for the RPC (growth index already helps created_at).
CREATE INDEX IF NOT EXISTS idx_submissions_analytics_contest_created
ON public.submissions (contest_id, created_at)
INCLUDE (status, views, earnings, bonus_amount, platform);
