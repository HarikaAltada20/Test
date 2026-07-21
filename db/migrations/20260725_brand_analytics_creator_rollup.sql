-- Brand analytics: per-creator daily rollups for scalable creator leaderboards.
-- DEPLOY ORDER: run after 20260720_brand_analytics_scale.sql.

-- ---------------------------------------------------------------------------
-- Creator rollup tables (contest × creator × day × status × platform)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_analytics_creator_daily_rollup (
  contest_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  day_key date NOT NULL,
  status text NOT NULL,
  platform text NOT NULL,
  submission_count bigint NOT NULL DEFAULT 0,
  views_sum bigint NOT NULL DEFAULT 0,
  earnings_cents_sum bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, creator_id, day_key, status, platform),
  CONSTRAINT admin_analytics_creator_daily_rollup_nonneg
    CHECK (
      submission_count >= 0
      AND views_sum >= 0
      AND earnings_cents_sum >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_analytics_creator_rollup_contest_day
  ON public.admin_analytics_creator_daily_rollup (contest_id, day_key);

CREATE INDEX IF NOT EXISTS idx_admin_analytics_creator_rollup_creator_day
  ON public.admin_analytics_creator_daily_rollup (creator_id, day_key);

CREATE TABLE IF NOT EXISTS public.admin_analytics_pc_creator_daily_rollup (
  contest_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  day_key date NOT NULL,
  status text NOT NULL,
  platform text NOT NULL,
  submission_count bigint NOT NULL DEFAULT 0,
  views_sum bigint NOT NULL DEFAULT 0,
  earnings_cents_sum bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, creator_id, day_key, status, platform),
  CONSTRAINT admin_analytics_pc_creator_daily_rollup_nonneg
    CHECK (
      submission_count >= 0
      AND views_sum >= 0
      AND earnings_cents_sum >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_analytics_pc_creator_rollup_contest_day
  ON public.admin_analytics_pc_creator_daily_rollup (contest_id, day_key);

CREATE INDEX IF NOT EXISTS idx_admin_analytics_pc_creator_rollup_creator_day
  ON public.admin_analytics_pc_creator_daily_rollup (creator_id, day_key);

-- ---------------------------------------------------------------------------
-- Delta writers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_analytics_apply_creator_rollup_delta(
  p_contest_id uuid,
  p_creator_id uuid,
  p_day_key date,
  p_status text,
  p_platform text,
  p_count_delta bigint,
  p_views_delta bigint,
  p_earnings_delta bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_creator_id IS NULL THEN
    RETURN;
  END IF;

  IF p_count_delta = 0
    AND p_views_delta = 0
    AND p_earnings_delta = 0 THEN
    RETURN;
  END IF;

  UPDATE public.admin_analytics_creator_daily_rollup AS r
  SET
    submission_count = GREATEST(0, r.submission_count + p_count_delta),
    views_sum = GREATEST(0, r.views_sum + p_views_delta),
    earnings_cents_sum = GREATEST(0, r.earnings_cents_sum + p_earnings_delta)
  WHERE r.contest_id = p_contest_id
    AND r.creator_id = p_creator_id
    AND r.day_key = p_day_key
    AND r.status = p_status
    AND r.platform = p_platform;

  IF NOT FOUND THEN
    IF p_count_delta < 0 OR p_views_delta < 0 OR p_earnings_delta < 0 THEN
      RETURN;
    END IF;

    INSERT INTO public.admin_analytics_creator_daily_rollup (
      contest_id,
      creator_id,
      day_key,
      status,
      platform,
      submission_count,
      views_sum,
      earnings_cents_sum
    )
    VALUES (
      p_contest_id,
      p_creator_id,
      p_day_key,
      p_status,
      p_platform,
      p_count_delta,
      p_views_delta,
      p_earnings_delta
    );
  END IF;

  DELETE FROM public.admin_analytics_creator_daily_rollup
  WHERE contest_id = p_contest_id
    AND creator_id = p_creator_id
    AND day_key = p_day_key
    AND status = p_status
    AND platform = p_platform
    AND submission_count <= 0
    AND views_sum <= 0
    AND earnings_cents_sum <= 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_apply_pc_creator_rollup_delta(
  p_contest_id uuid,
  p_creator_id uuid,
  p_day_key date,
  p_status text,
  p_platform text,
  p_count_delta bigint,
  p_views_delta bigint,
  p_earnings_delta bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_creator_id IS NULL THEN
    RETURN;
  END IF;

  IF p_count_delta = 0
    AND p_views_delta = 0
    AND p_earnings_delta = 0 THEN
    RETURN;
  END IF;

  UPDATE public.admin_analytics_pc_creator_daily_rollup AS r
  SET
    submission_count = GREATEST(0, r.submission_count + p_count_delta),
    views_sum = GREATEST(0, r.views_sum + p_views_delta),
    earnings_cents_sum = GREATEST(0, r.earnings_cents_sum + p_earnings_delta)
  WHERE r.contest_id = p_contest_id
    AND r.creator_id = p_creator_id
    AND r.day_key = p_day_key
    AND r.status = p_status
    AND r.platform = p_platform;

  IF NOT FOUND THEN
    IF p_count_delta < 0 OR p_views_delta < 0 OR p_earnings_delta < 0 THEN
      RETURN;
    END IF;

    INSERT INTO public.admin_analytics_pc_creator_daily_rollup (
      contest_id,
      creator_id,
      day_key,
      status,
      platform,
      submission_count,
      views_sum,
      earnings_cents_sum
    )
    VALUES (
      p_contest_id,
      p_creator_id,
      p_day_key,
      p_status,
      p_platform,
      p_count_delta,
      p_views_delta,
      p_earnings_delta
    );
  END IF;

  DELETE FROM public.admin_analytics_pc_creator_daily_rollup
  WHERE contest_id = p_contest_id
    AND creator_id = p_creator_id
    AND day_key = p_day_key
    AND status = p_status
    AND platform = p_platform
    AND submission_count <= 0
    AND views_sum <= 0
    AND earnings_cents_sum <= 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- Extend submission / PC triggers to maintain creator rollups
-- ---------------------------------------------------------------------------

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

      IF OLD.creator_id IS NOT NULL THEN
        PERFORM public.admin_analytics_apply_creator_rollup_delta(
          OLD.contest_id,
          OLD.creator_id,
          m.day_key,
          m.status,
          m.platform,
          -1,
          -m.views,
          -m.payouts_cents
        );
      END IF;
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

      IF NEW.creator_id IS NOT NULL THEN
        PERFORM public.admin_analytics_apply_creator_rollup_delta(
          NEW.contest_id,
          NEW.creator_id,
          m.day_key,
          m.status,
          m.platform,
          1,
          m.views,
          m.payouts_cents
        );
      END IF;
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

      IF OLD.creator_id IS NOT NULL THEN
        PERFORM public.admin_analytics_apply_pc_creator_rollup_delta(
          OLD.contest_id,
          OLD.creator_id,
          m.day_key,
          m.status,
          m.platform,
          -1,
          -m.views,
          -m.payouts_cents
        );
      END IF;
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

      IF NEW.creator_id IS NOT NULL THEN
        PERFORM public.admin_analytics_apply_pc_creator_rollup_delta(
          NEW.contest_id,
          NEW.creator_id,
          m.day_key,
          m.status,
          m.platform,
          1,
          m.views,
          m.payouts_cents
        );
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- Initial backfill
-- ---------------------------------------------------------------------------

INSERT INTO public.admin_analytics_creator_daily_rollup (
  contest_id,
  creator_id,
  day_key,
  status,
  platform,
  submission_count,
  views_sum,
  earnings_cents_sum
)
SELECT
  s.contest_id,
  s.creator_id,
  m.day_key,
  m.status,
  m.platform,
  COUNT(*)::bigint,
  COALESCE(SUM(m.views), 0)::bigint,
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
WHERE s.creator_id IS NOT NULL
  AND public.admin_analytics_submission_row_in_scope(m.platform)
GROUP BY s.contest_id, s.creator_id, m.day_key, m.status, m.platform
ON CONFLICT (contest_id, creator_id, day_key, status, platform) DO UPDATE SET
  submission_count = EXCLUDED.submission_count,
  views_sum = EXCLUDED.views_sum,
  earnings_cents_sum = EXCLUDED.earnings_cents_sum;

INSERT INTO public.admin_analytics_pc_creator_daily_rollup (
  contest_id,
  creator_id,
  day_key,
  status,
  platform,
  submission_count,
  views_sum,
  earnings_cents_sum
)
SELECT
  pcs.contest_id,
  pcs.creator_id,
  m.day_key,
  m.status,
  m.platform,
  COUNT(*)::bigint,
  COALESCE(SUM(m.views), 0)::bigint,
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
WHERE pcs.creator_id IS NOT NULL
  AND public.admin_analytics_pc_row_in_scope(m.platform)
GROUP BY pcs.contest_id, pcs.creator_id, m.day_key, m.status, m.platform
ON CONFLICT (contest_id, creator_id, day_key, status, platform) DO UPDATE SET
  submission_count = EXCLUDED.submission_count,
  views_sum = EXCLUDED.views_sum,
  earnings_cents_sum = EXCLUDED.earnings_cents_sum;

-- ---------------------------------------------------------------------------
-- Read paths: rollup-backed creator aggregates
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.brand_analytics_by_creator(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  creator_id uuid,
  contest_type text,
  platform text,
  status text,
  submission_count bigint,
  views_sum bigint,
  earnings_cents_sum bigint,
  first_created_at timestamptz,
  last_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.creator_id,
    c.contest_type::text AS contest_type,
    r.platform,
    r.status,
    SUM(r.submission_count)::bigint AS submission_count,
    COALESCE(SUM(r.views_sum), 0)::bigint AS views_sum,
    COALESCE(SUM(r.earnings_cents_sum), 0)::bigint AS earnings_cents_sum,
    (MIN(r.day_key)::timestamp AT TIME ZONE 'UTC') AS first_created_at,
    (((MAX(r.day_key) + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 second') AS last_created_at
  FROM public.admin_analytics_creator_daily_rollup r
  INNER JOIN public.contests c ON c.id = r.contest_id
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND r.contest_id = ANY (p_contest_ids)
    AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
    AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
    AND public.admin_analytics_submission_row_in_scope(r.platform)
  GROUP BY r.creator_id, c.contest_type, r.platform, r.status;
$$;

CREATE OR REPLACE FUNCTION public.brand_analytics_pc_by_creator(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  creator_id uuid,
  contest_type text,
  platform text,
  status text,
  submission_count bigint,
  views_sum bigint,
  earnings_cents_sum bigint,
  first_created_at timestamptz,
  last_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.creator_id,
    c.contest_type::text AS contest_type,
    r.platform,
    r.status,
    SUM(r.submission_count)::bigint AS submission_count,
    COALESCE(SUM(r.views_sum), 0)::bigint AS views_sum,
    COALESCE(SUM(r.earnings_cents_sum), 0)::bigint AS earnings_cents_sum,
    (MIN(r.day_key)::timestamp AT TIME ZONE 'UTC') AS first_created_at,
    (((MAX(r.day_key) + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 second') AS last_created_at
  FROM public.admin_analytics_pc_creator_daily_rollup r
  INNER JOIN public.contests c ON c.id = r.contest_id
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND r.contest_id = ANY (p_contest_ids)
    AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
    AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
    AND public.admin_analytics_pc_row_in_scope(r.platform)
  GROUP BY r.creator_id, c.contest_type, r.platform, r.status;
$$;

COMMENT ON TABLE public.admin_analytics_creator_daily_rollup IS
  'Per-creator daily submission rollups for brand analytics creator leaderboards.';

COMMENT ON TABLE public.admin_analytics_pc_creator_daily_rollup IS
  'Per-creator daily PC overlay rollups for brand analytics creator leaderboards.';

-- Internal rollup writers are invoked by SECURITY DEFINER trigger functions.
-- Do not expose direct execution to API roles.
REVOKE ALL ON FUNCTION public.admin_analytics_apply_creator_rollup_delta(
  uuid, uuid, date, text, text, bigint, bigint, bigint
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_analytics_apply_pc_creator_rollup_delta(
  uuid, uuid, date, text, text, bigint, bigint, bigint
) FROM PUBLIC, anon, authenticated;
