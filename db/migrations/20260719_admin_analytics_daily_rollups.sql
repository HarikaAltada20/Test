-- Precomputed daily rollups for admin analytics (submissions + PC overlay).
-- Analytics reads thousands of rollup rows, not millions of source rows.
--
-- DEPLOY ORDER: run after 20260718_pc_metrics_admin_analytics_scale.sql.
-- Initial backfill scans source tables once; run during a maintenance window on
-- large prod. Incremental triggers keep rollups current after deploy.

-- ---------------------------------------------------------------------------
-- Rollup tables (contest × day × status × platform)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_analytics_submission_daily_rollup (
  contest_id uuid NOT NULL,
  day_key date NOT NULL,
  status text NOT NULL,
  platform text NOT NULL,
  submission_count bigint NOT NULL DEFAULT 0,
  views_sum bigint NOT NULL DEFAULT 0,
  likes_sum bigint NOT NULL DEFAULT 0,
  comments_sum bigint NOT NULL DEFAULT 0,
  shares_sum bigint NOT NULL DEFAULT 0,
  payouts_cents_sum bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, day_key, status, platform),
  CONSTRAINT admin_analytics_submission_daily_rollup_nonneg
    CHECK (
      submission_count >= 0
      AND views_sum >= 0
      AND likes_sum >= 0
      AND comments_sum >= 0
      AND shares_sum >= 0
      AND payouts_cents_sum >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_analytics_submission_rollup_day
  ON public.admin_analytics_submission_daily_rollup (day_key, contest_id);

CREATE TABLE IF NOT EXISTS public.admin_analytics_pc_daily_rollup (
  contest_id uuid NOT NULL,
  day_key date NOT NULL,
  status text NOT NULL,
  platform text NOT NULL,
  submission_count bigint NOT NULL DEFAULT 0,
  views_sum bigint NOT NULL DEFAULT 0,
  likes_sum bigint NOT NULL DEFAULT 0,
  comments_sum bigint NOT NULL DEFAULT 0,
  shares_sum bigint NOT NULL DEFAULT 0,
  payouts_cents_sum bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, day_key, status, platform),
  CONSTRAINT admin_analytics_pc_daily_rollup_nonneg
    CHECK (
      submission_count >= 0
      AND views_sum >= 0
      AND likes_sum >= 0
      AND comments_sum >= 0
      AND shares_sum >= 0
      AND payouts_cents_sum >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_analytics_pc_rollup_day
  ON public.admin_analytics_pc_daily_rollup (day_key, contest_id);

COMMENT ON TABLE public.admin_analytics_submission_daily_rollup IS
  'Pre-aggregated admin analytics buckets for submissions; maintained by trigger + backfill.';

COMMENT ON TABLE public.admin_analytics_pc_daily_rollup IS
  'Pre-aggregated admin analytics buckets for post_campaign_submission_metrics.';

-- ---------------------------------------------------------------------------
-- Shared bucket helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_analytics_normalize_status(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(COALESCE(p_status, '')) = 'approved' THEN 'verified'
    WHEN lower(COALESCE(p_status, '')) IN (
      'pending', 'verified', 'paid', 'rejected'
    ) THEN lower(p_status)
    ELSE 'unknown'
  END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_compute_row_metrics(
  p_created_at timestamptz,
  p_status text,
  p_row_platform text,
  p_contest_platform text,
  p_contest_details jsonb,
  p_views bigint,
  p_other_stats jsonb,
  p_earnings bigint,
  p_bonus_amount bigint
)
RETURNS TABLE (
  day_key date,
  status text,
  platform text,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  payouts_cents bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH norm AS (
    SELECT public.admin_analytics_normalize_platform(
      COALESCE(p_row_platform, p_contest_platform),
      p_contest_details
    ) AS platform
  )
  SELECT
    (p_created_at AT TIME ZONE 'UTC')::date AS day_key,
    public.admin_analytics_normalize_status(p_status) AS status,
    norm.platform,
    public.admin_analytics_submission_views(
      COALESCE(p_views, 0),
      norm.platform,
      COALESCE(p_other_stats, '{}'::jsonb)
    ) AS views,
    public.admin_analytics_json_stat(
      COALESCE(p_other_stats, '{}'::jsonb),
      norm.platform,
      ARRAY['likes', 'like_count']
    ) AS likes,
    public.admin_analytics_json_stat(
      COALESCE(p_other_stats, '{}'::jsonb),
      norm.platform,
      ARRAY['comments', 'comment_count', 'replies']
    ) AS comments,
    public.admin_analytics_json_stat(
      COALESCE(p_other_stats, '{}'::jsonb),
      norm.platform,
      ARRAY['shares', 'share_count', 'retweets']
    ) AS shares,
    CASE
      WHEN lower(COALESCE(p_status, '')) = 'paid'
        OR COALESCE(p_earnings, 0) > 0
      THEN (COALESCE(p_earnings, 0) + COALESCE(p_bonus_amount, 0))::bigint
      ELSE 0::bigint
    END AS payouts_cents
  FROM norm;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_apply_submission_rollup_delta(
  p_contest_id uuid,
  p_day_key date,
  p_status text,
  p_platform text,
  p_count_delta bigint,
  p_views_delta bigint,
  p_likes_delta bigint,
  p_comments_delta bigint,
  p_shares_delta bigint,
  p_payouts_delta bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_count_delta = 0
    AND p_views_delta = 0
    AND p_likes_delta = 0
    AND p_comments_delta = 0
    AND p_shares_delta = 0
    AND p_payouts_delta = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_analytics_submission_daily_rollup AS r (
    contest_id,
    day_key,
    status,
    platform,
    submission_count,
    views_sum,
    likes_sum,
    comments_sum,
    shares_sum,
    payouts_cents_sum
  )
  VALUES (
    p_contest_id,
    p_day_key,
    p_status,
    p_platform,
    p_count_delta,
    p_views_delta,
    p_likes_delta,
    p_comments_delta,
    p_shares_delta,
    p_payouts_delta
  )
  ON CONFLICT (contest_id, day_key, status, platform) DO UPDATE SET
    submission_count = GREATEST(0, r.submission_count + p_count_delta),
    views_sum = GREATEST(0, r.views_sum + p_views_delta),
    likes_sum = GREATEST(0, r.likes_sum + p_likes_delta),
    comments_sum = GREATEST(0, r.comments_sum + p_comments_delta),
    shares_sum = GREATEST(0, r.shares_sum + p_shares_delta),
    payouts_cents_sum = GREATEST(0, r.payouts_cents_sum + p_payouts_delta);

  DELETE FROM public.admin_analytics_submission_daily_rollup
  WHERE contest_id = p_contest_id
    AND day_key = p_day_key
    AND status = p_status
    AND platform = p_platform
    AND submission_count <= 0
    AND views_sum <= 0
    AND likes_sum <= 0
    AND comments_sum <= 0
    AND shares_sum <= 0
    AND payouts_cents_sum <= 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_apply_pc_rollup_delta(
  p_contest_id uuid,
  p_day_key date,
  p_status text,
  p_platform text,
  p_count_delta bigint,
  p_views_delta bigint,
  p_likes_delta bigint,
  p_comments_delta bigint,
  p_shares_delta bigint,
  p_payouts_delta bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_count_delta = 0
    AND p_views_delta = 0
    AND p_likes_delta = 0
    AND p_comments_delta = 0
    AND p_shares_delta = 0
    AND p_payouts_delta = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_analytics_pc_daily_rollup AS r (
    contest_id,
    day_key,
    status,
    platform,
    submission_count,
    views_sum,
    likes_sum,
    comments_sum,
    shares_sum,
    payouts_cents_sum
  )
  VALUES (
    p_contest_id,
    p_day_key,
    p_status,
    p_platform,
    p_count_delta,
    p_views_delta,
    p_likes_delta,
    p_comments_delta,
    p_shares_delta,
    p_payouts_delta
  )
  ON CONFLICT (contest_id, day_key, status, platform) DO UPDATE SET
    submission_count = GREATEST(0, r.submission_count + p_count_delta),
    views_sum = GREATEST(0, r.views_sum + p_views_delta),
    likes_sum = GREATEST(0, r.likes_sum + p_likes_delta),
    comments_sum = GREATEST(0, r.comments_sum + p_comments_delta),
    shares_sum = GREATEST(0, r.shares_sum + p_shares_delta),
    payouts_cents_sum = GREATEST(0, r.payouts_cents_sum + p_payouts_delta);

  DELETE FROM public.admin_analytics_pc_daily_rollup
  WHERE contest_id = p_contest_id
    AND day_key = p_day_key
    AND status = p_status
    AND platform = p_platform
    AND submission_count <= 0
    AND views_sum <= 0
    AND likes_sum <= 0
    AND comments_sum <= 0
    AND shares_sum <= 0
    AND payouts_cents_sum <= 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_submission_row_in_scope(p_platform text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_platform IN ('youtube', 'tiktok', 'instagram');
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_pc_row_in_scope(p_platform text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_platform IN ('youtube', 'tiktok', 'instagram', 'unknown');
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_submissions_rollup_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_platform text;
  c_details jsonb;
  m record;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT c.platform, c.contest_based_details
    INTO c_platform, c_details
    FROM public.contests c
    WHERE c.id = OLD.contest_id;

    SELECT * INTO m
    FROM public.admin_analytics_compute_row_metrics(
      OLD.created_at,
      OLD.status::text,
      OLD.platform,
      c_platform,
      c_details,
      COALESCE(OLD.views, 0)::bigint,
      COALESCE(OLD.other_stats, '{}'::jsonb),
      COALESCE(OLD.earnings, 0)::bigint,
      COALESCE(OLD.bonus_amount, 0)::bigint
    );

    IF public.admin_analytics_submission_row_in_scope(m.platform) THEN
      PERFORM public.admin_analytics_apply_submission_rollup_delta(
        OLD.contest_id,
        m.day_key,
        m.status,
        m.platform,
        -1,
        -m.views,
        -m.likes,
        -m.comments,
        -m.shares,
        -m.payouts_cents
      );
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT c.platform, c.contest_based_details
    INTO c_platform, c_details
    FROM public.contests c
    WHERE c.id = NEW.contest_id;

    SELECT * INTO m
    FROM public.admin_analytics_compute_row_metrics(
      NEW.created_at,
      NEW.status::text,
      NEW.platform,
      c_platform,
      c_details,
      COALESCE(NEW.views, 0)::bigint,
      COALESCE(NEW.other_stats, '{}'::jsonb),
      COALESCE(NEW.earnings, 0)::bigint,
      COALESCE(NEW.bonus_amount, 0)::bigint
    );

    IF public.admin_analytics_submission_row_in_scope(m.platform) THEN
      PERFORM public.admin_analytics_apply_submission_rollup_delta(
        NEW.contest_id,
        m.day_key,
        m.status,
        m.platform,
        1,
        m.views,
        m.likes,
        m.comments,
        m.shares,
        m.payouts_cents
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_pc_rollup_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_platform text;
  c_details jsonb;
  m record;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT c.platform, c.contest_based_details
    INTO c_platform, c_details
    FROM public.contests c
    WHERE c.id = OLD.contest_id;

    SELECT * INTO m
    FROM public.admin_analytics_compute_row_metrics(
      OLD.created_at,
      OLD.status::text,
      OLD.platform,
      c_platform,
      c_details,
      COALESCE(OLD.views, 0)::bigint,
      COALESCE(OLD.other_stats, '{}'::jsonb),
      COALESCE(OLD.earnings, 0)::bigint,
      COALESCE(OLD.bonus_amount, 0)::bigint
    );

    IF public.admin_analytics_pc_row_in_scope(m.platform) THEN
      PERFORM public.admin_analytics_apply_pc_rollup_delta(
        OLD.contest_id,
        m.day_key,
        m.status,
        m.platform,
        -1,
        -m.views,
        -m.likes,
        -m.comments,
        -m.shares,
        -m.payouts_cents
      );
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT c.platform, c.contest_based_details
    INTO c_platform, c_details
    FROM public.contests c
    WHERE c.id = NEW.contest_id;

    SELECT * INTO m
    FROM public.admin_analytics_compute_row_metrics(
      NEW.created_at,
      NEW.status::text,
      NEW.platform,
      c_platform,
      c_details,
      COALESCE(NEW.views, 0)::bigint,
      COALESCE(NEW.other_stats, '{}'::jsonb),
      COALESCE(NEW.earnings, 0)::bigint,
      COALESCE(NEW.bonus_amount, 0)::bigint
    );

    IF public.admin_analytics_pc_row_in_scope(m.platform) THEN
      PERFORM public.admin_analytics_apply_pc_rollup_delta(
        NEW.contest_id,
        m.day_key,
        m.status,
        m.platform,
        1,
        m.views,
        m.likes,
        m.comments,
        m.shares,
        m.payouts_cents
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- Initial backfill (one-time full scan per source table)
-- ---------------------------------------------------------------------------

INSERT INTO public.admin_analytics_submission_daily_rollup (
  contest_id,
  day_key,
  status,
  platform,
  submission_count,
  views_sum,
  likes_sum,
  comments_sum,
  shares_sum,
  payouts_cents_sum
)
SELECT
  s.contest_id,
  m.day_key,
  m.status,
  m.platform,
  COUNT(*)::bigint,
  COALESCE(SUM(m.views), 0)::bigint,
  COALESCE(SUM(m.likes), 0)::bigint,
  COALESCE(SUM(m.comments), 0)::bigint,
  COALESCE(SUM(m.shares), 0)::bigint,
  COALESCE(SUM(m.payouts_cents), 0)::bigint
FROM public.submissions s
LEFT JOIN public.contests c ON c.id = s.contest_id
CROSS JOIN LATERAL public.admin_analytics_compute_row_metrics(
  s.created_at,
  s.status::text,
  s.platform,
  c.platform,
  c.contest_based_details,
  COALESCE(s.views, 0)::bigint,
  COALESCE(s.other_stats, '{}'::jsonb),
  COALESCE(s.earnings, 0)::bigint,
  COALESCE(s.bonus_amount, 0)::bigint
) AS m
WHERE public.admin_analytics_submission_row_in_scope(m.platform)
GROUP BY s.contest_id, m.day_key, m.status, m.platform
ON CONFLICT (contest_id, day_key, status, platform) DO UPDATE SET
  submission_count = EXCLUDED.submission_count,
  views_sum = EXCLUDED.views_sum,
  likes_sum = EXCLUDED.likes_sum,
  comments_sum = EXCLUDED.comments_sum,
  shares_sum = EXCLUDED.shares_sum,
  payouts_cents_sum = EXCLUDED.payouts_cents_sum;

INSERT INTO public.admin_analytics_pc_daily_rollup (
  contest_id,
  day_key,
  status,
  platform,
  submission_count,
  views_sum,
  likes_sum,
  comments_sum,
  shares_sum,
  payouts_cents_sum
)
SELECT
  pcs.contest_id,
  m.day_key,
  m.status,
  m.platform,
  COUNT(*)::bigint,
  COALESCE(SUM(m.views), 0)::bigint,
  COALESCE(SUM(m.likes), 0)::bigint,
  COALESCE(SUM(m.comments), 0)::bigint,
  COALESCE(SUM(m.shares), 0)::bigint,
  COALESCE(SUM(m.payouts_cents), 0)::bigint
FROM public.post_campaign_submission_metrics pcs
LEFT JOIN public.contests c ON c.id = pcs.contest_id
CROSS JOIN LATERAL public.admin_analytics_compute_row_metrics(
  pcs.created_at,
  pcs.status::text,
  pcs.platform,
  c.platform,
  c.contest_based_details,
  COALESCE(pcs.views, 0)::bigint,
  COALESCE(pcs.other_stats, '{}'::jsonb),
  COALESCE(pcs.earnings, 0)::bigint,
  COALESCE(pcs.bonus_amount, 0)::bigint
) AS m
WHERE public.admin_analytics_pc_row_in_scope(m.platform)
GROUP BY pcs.contest_id, m.day_key, m.status, m.platform
ON CONFLICT (contest_id, day_key, status, platform) DO UPDATE SET
  submission_count = EXCLUDED.submission_count,
  views_sum = EXCLUDED.views_sum,
  likes_sum = EXCLUDED.likes_sum,
  comments_sum = EXCLUDED.comments_sum,
  shares_sum = EXCLUDED.shares_sum,
  payouts_cents_sum = EXCLUDED.payouts_cents_sum;

DROP TRIGGER IF EXISTS trg_admin_analytics_submissions_rollup
  ON public.submissions;
CREATE TRIGGER trg_admin_analytics_submissions_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_analytics_submissions_rollup_trigger();

DROP TRIGGER IF EXISTS trg_admin_analytics_pc_rollup
  ON public.post_campaign_submission_metrics;
CREATE TRIGGER trg_admin_analytics_pc_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.post_campaign_submission_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_analytics_pc_rollup_trigger();

-- ---------------------------------------------------------------------------
-- Read paths: rollup tables (not raw submissions / PC metrics)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_analytics_daily(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  day_key date,
  status text,
  submission_count bigint,
  views_sum bigint,
  likes_sum bigint,
  comments_sum bigint,
  shares_sum bigint,
  payouts_cents_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.day_key,
    r.status,
    SUM(r.submission_count)::bigint AS submission_count,
    COALESCE(SUM(r.views_sum), 0)::bigint AS views_sum,
    COALESCE(SUM(r.likes_sum), 0)::bigint AS likes_sum,
    COALESCE(SUM(r.comments_sum), 0)::bigint AS comments_sum,
    COALESCE(SUM(r.shares_sum), 0)::bigint AS shares_sum,
    COALESCE(SUM(r.payouts_cents_sum), 0)::bigint AS payouts_cents_sum
  FROM public.admin_analytics_submission_daily_rollup r
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND r.contest_id = ANY (p_contest_ids)
    AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
    AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
    AND public.admin_analytics_submission_row_in_scope(r.platform)
  GROUP BY r.day_key, r.status
  ORDER BY r.day_key, r.status;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_pc_overview(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      r.contest_id,
      r.day_key,
      r.status,
      r.submission_count,
      r.views_sum,
      r.likes_sum,
      r.comments_sum,
      r.shares_sum,
      r.payouts_cents_sum
    FROM public.admin_analytics_pc_daily_rollup r
    WHERE p_contest_ids IS NOT NULL
      AND cardinality(p_contest_ids) > 0
      AND r.contest_id = ANY (p_contest_ids)
      AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
      AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
      AND public.admin_analytics_pc_row_in_scope(r.platform)
  ),
  daily AS (
    SELECT
      filtered.contest_id,
      filtered.day_key,
      filtered.status,
      SUM(filtered.submission_count)::bigint AS submission_count,
      COALESCE(SUM(filtered.views_sum), 0)::bigint AS views_sum,
      COALESCE(SUM(filtered.likes_sum), 0)::bigint AS likes_sum,
      COALESCE(SUM(filtered.comments_sum), 0)::bigint AS comments_sum,
      COALESCE(SUM(filtered.shares_sum), 0)::bigint AS shares_sum,
      COALESCE(SUM(filtered.payouts_cents_sum), 0)::bigint AS payouts_cents_sum
    FROM filtered
    GROUP BY filtered.contest_id, filtered.day_key, filtered.status
  ),
  contest_ids AS (
    SELECT DISTINCT filtered.contest_id
    FROM filtered
  )
  SELECT jsonb_build_object(
    'daily',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'contest_id', d.contest_id,
            'day_key', d.day_key,
            'status', d.status,
            'submission_count', d.submission_count,
            'views_sum', d.views_sum,
            'likes_sum', d.likes_sum,
            'comments_sum', d.comments_sum,
            'shares_sum', d.shares_sum,
            'payouts_cents_sum', d.payouts_cents_sum
          )
          ORDER BY d.contest_id, d.day_key, d.status
        )
        FROM daily d
      ),
      '[]'::jsonb
    ),
    'contest_ids',
    COALESCE(
      (
        SELECT jsonb_agg(c.contest_id ORDER BY c.contest_id)
        FROM contest_ids c
      ),
      '[]'::jsonb
    )
  );
$$;

-- Lightweight contest catalog for admin analytics filters (one query, no pagination).
CREATE OR REPLACE FUNCTION public.admin_analytics_contest_catalog()
RETURNS TABLE (
  id uuid,
  title text,
  platform text,
  contest_type text,
  contest_based_details jsonb,
  payment_details jsonb,
  moderation_status text,
  start_date timestamptz,
  end_date timestamptz,
  advertiser_id uuid,
  company_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.title,
    c.platform,
    c.contest_type,
    c.contest_based_details,
    c.payment_details,
    c.moderation_status,
    c.start_date,
    c.end_date,
    c.advertiser_id,
    ap.company_name
  FROM public.contests c
  LEFT JOIN public.advertiser_profiles ap ON ap.id = c.advertiser_id
  ORDER BY c.created_at DESC;
$$;

COMMENT ON FUNCTION public.admin_analytics_daily(timestamptz, timestamptz, uuid[]) IS
  'Daily submission rollups from admin_analytics_submission_daily_rollup (precomputed).';

COMMENT ON FUNCTION public.admin_analytics_pc_overview(timestamptz, timestamptz, uuid[]) IS
  'PC admin analytics from admin_analytics_pc_daily_rollup (precomputed).';

COMMENT ON FUNCTION public.admin_analytics_contest_catalog() IS
  'Contest metadata for admin analytics filters; avoids paginating contests in Node.';

REVOKE ALL ON FUNCTION public.admin_analytics_normalize_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_compute_row_metrics(
  timestamptz, text, text, text, jsonb, bigint, jsonb, bigint, bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_apply_submission_rollup_delta(
  uuid, date, text, text, bigint, bigint, bigint, bigint, bigint, bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_apply_pc_rollup_delta(
  uuid, date, text, text, bigint, bigint, bigint, bigint, bigint, bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_submission_row_in_scope(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_pc_row_in_scope(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_contest_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics_contest_catalog() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.admin_analytics_contest_catalog() TO service_role;
