-- Preserve reach and saved metrics in scalable brand-analytics contest cards.
--
-- Run after 20260727_brand_analytics_dirty_day_reconciliation.sql.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure(
    'public.admin_analytics_reconcile_dirty_rollups(integer,boolean)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Prerequisite missing: apply 20260727_brand_analytics_dirty_day_reconciliation.sql first';
  END IF;
END $$;

-- Block analytics-changing writes while the new columns are backfilled.
SELECT pg_advisory_xact_lock(71026, 1);

ALTER TABLE public.admin_analytics_submission_daily_rollup
  ADD COLUMN IF NOT EXISTS reach_sum bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saved_sum bigint NOT NULL DEFAULT 0;

ALTER TABLE public.admin_analytics_pc_daily_rollup
  ADD COLUMN IF NOT EXISTS reach_sum bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saved_sum bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_analytics_submission_daily_rollup_engagement_nonneg'
      AND conrelid =
        'public.admin_analytics_submission_daily_rollup'::regclass
  ) THEN
    ALTER TABLE public.admin_analytics_submission_daily_rollup
      ADD CONSTRAINT admin_analytics_submission_daily_rollup_engagement_nonneg
      CHECK (reach_sum >= 0 AND saved_sum >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_analytics_pc_daily_rollup_engagement_nonneg'
      AND conrelid = 'public.admin_analytics_pc_daily_rollup'::regclass
  ) THEN
    ALTER TABLE public.admin_analytics_pc_daily_rollup
      ADD CONSTRAINT admin_analytics_pc_daily_rollup_engagement_nonneg
      CHECK (reach_sum >= 0 AND saved_sum >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_analytics_compute_engagement_metrics(
  p_row_platform text,
  p_contest_platform text,
  p_contest_details jsonb,
  p_other_stats jsonb
)
RETURNS TABLE (
  platform text,
  reach bigint,
  saved bigint
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
    norm.platform,
    public.admin_analytics_json_stat(
      COALESCE(p_other_stats, '{}'::jsonb),
      norm.platform,
      ARRAY['reach', 'total_reach', 'accounts_reached']
    ) AS reach,
    public.admin_analytics_json_stat(
      COALESCE(p_other_stats, '{}'::jsonb),
      norm.platform,
      ARRAY['saved', 'saves', 'save_count', 'saved_count']
    ) AS saved
  FROM norm;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_engagement_rollup_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_c_platform text;
  old_c_details jsonb;
  new_c_platform text;
  new_c_details jsonb;
  old_m record;
  new_m record;
  old_status text;
  new_status text;
  old_day date;
  new_day date;
  old_in_scope boolean := false;
  new_in_scope boolean := false;
  same_bucket boolean := false;
  is_pc boolean := TG_TABLE_NAME = 'post_campaign_submission_metrics';
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id
    AND OLD.created_at IS NOT DISTINCT FROM NEW.created_at
    AND OLD.status IS NOT DISTINCT FROM NEW.status
    AND OLD.platform IS NOT DISTINCT FROM NEW.platform
    AND OLD.other_stats IS NOT DISTINCT FROM NEW.other_stats THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock_shared(71026, 1);

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT c.platform, c.contest_based_details
    INTO old_c_platform, old_c_details
    FROM public.contests c
    WHERE c.id = OLD.contest_id;

    SELECT * INTO old_m
    FROM public.admin_analytics_compute_engagement_metrics(
      OLD.platform,
      old_c_platform,
      old_c_details,
      COALESCE(OLD.other_stats, '{}'::jsonb)
    );

    old_status := public.admin_analytics_normalize_status(OLD.status::text);
    old_day := (OLD.created_at AT TIME ZONE 'UTC')::date;
    old_in_scope := CASE
      WHEN is_pc THEN public.admin_analytics_pc_row_in_scope(old_m.platform)
      ELSE public.admin_analytics_submission_row_in_scope(old_m.platform)
    END;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_OP = 'UPDATE'
      AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id THEN
      new_c_platform := old_c_platform;
      new_c_details := old_c_details;
    ELSE
      SELECT c.platform, c.contest_based_details
      INTO new_c_platform, new_c_details
      FROM public.contests c
      WHERE c.id = NEW.contest_id;
    END IF;

    SELECT * INTO new_m
    FROM public.admin_analytics_compute_engagement_metrics(
      NEW.platform,
      new_c_platform,
      new_c_details,
      COALESCE(NEW.other_stats, '{}'::jsonb)
    );

    new_status := public.admin_analytics_normalize_status(NEW.status::text);
    new_day := (NEW.created_at AT TIME ZONE 'UTC')::date;
    new_in_scope := CASE
      WHEN is_pc THEN public.admin_analytics_pc_row_in_scope(new_m.platform)
      ELSE public.admin_analytics_submission_row_in_scope(new_m.platform)
    END;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    same_bucket :=
      old_in_scope
      AND new_in_scope
      AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id
      AND old_day IS NOT DISTINCT FROM new_day
      AND old_status IS NOT DISTINCT FROM new_status
      AND old_m.platform IS NOT DISTINCT FROM new_m.platform;
  END IF;

  IF same_bucket THEN
    IF is_pc THEN
      UPDATE public.admin_analytics_pc_daily_rollup AS r
      SET
        reach_sum = GREATEST(
          0,
          r.reach_sum + new_m.reach - old_m.reach
        ),
        saved_sum = GREATEST(
          0,
          r.saved_sum + new_m.saved - old_m.saved
        )
      WHERE r.contest_id = NEW.contest_id
        AND r.day_key = new_day
        AND r.status = new_status
        AND r.platform = new_m.platform;
    ELSE
      UPDATE public.admin_analytics_submission_daily_rollup AS r
      SET
        reach_sum = GREATEST(
          0,
          r.reach_sum + new_m.reach - old_m.reach
        ),
        saved_sum = GREATEST(
          0,
          r.saved_sum + new_m.saved - old_m.saved
        )
      WHERE r.contest_id = NEW.contest_id
        AND r.day_key = new_day
        AND r.status = new_status
        AND r.platform = new_m.platform;
    END IF;
    RETURN NEW;
  END IF;

  IF old_in_scope THEN
    IF is_pc THEN
      UPDATE public.admin_analytics_pc_daily_rollup AS r
      SET
        reach_sum = GREATEST(0, r.reach_sum - old_m.reach),
        saved_sum = GREATEST(0, r.saved_sum - old_m.saved)
      WHERE r.contest_id = OLD.contest_id
        AND r.day_key = old_day
        AND r.status = old_status
        AND r.platform = old_m.platform;
    ELSE
      UPDATE public.admin_analytics_submission_daily_rollup AS r
      SET
        reach_sum = GREATEST(0, r.reach_sum - old_m.reach),
        saved_sum = GREATEST(0, r.saved_sum - old_m.saved)
      WHERE r.contest_id = OLD.contest_id
        AND r.day_key = old_day
        AND r.status = old_status
        AND r.platform = old_m.platform;
    END IF;
  END IF;

  IF new_in_scope THEN
    IF is_pc THEN
      INSERT INTO public.admin_analytics_pc_daily_rollup (
        contest_id,
        day_key,
        status,
        platform,
        reach_sum,
        saved_sum
      )
      VALUES (
        NEW.contest_id,
        new_day,
        new_status,
        new_m.platform,
        new_m.reach,
        new_m.saved
      )
      ON CONFLICT (contest_id, day_key, status, platform)
      DO UPDATE SET
        reach_sum =
          public.admin_analytics_pc_daily_rollup.reach_sum
          + EXCLUDED.reach_sum,
        saved_sum =
          public.admin_analytics_pc_daily_rollup.saved_sum
          + EXCLUDED.saved_sum;
    ELSE
      INSERT INTO public.admin_analytics_submission_daily_rollup (
        contest_id,
        day_key,
        status,
        platform,
        reach_sum,
        saved_sum
      )
      VALUES (
        NEW.contest_id,
        new_day,
        new_status,
        new_m.platform,
        new_m.reach,
        new_m.saved
      )
      ON CONFLICT (contest_id, day_key, status, platform)
      DO UPDATE SET
        reach_sum =
          public.admin_analytics_submission_daily_rollup.reach_sum
          + EXCLUDED.reach_sum,
        saved_sum =
          public.admin_analytics_submission_daily_rollup.saved_sum
          + EXCLUDED.saved_sum;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- A BEFORE trigger makes the engagement delta run before the existing base
-- rollup's AFTER trigger. This preserves correct insert/delete ordering.
DROP TRIGGER IF EXISTS trg_admin_analytics_engagement_submissions
  ON public.submissions;
CREATE TRIGGER trg_admin_analytics_engagement_submissions
  BEFORE INSERT OR DELETE OR UPDATE OF
    contest_id,
    created_at,
    status,
    platform,
    other_stats
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_analytics_engagement_rollup_trigger();

DROP TRIGGER IF EXISTS trg_admin_analytics_engagement_pc
  ON public.post_campaign_submission_metrics;
CREATE TRIGGER trg_admin_analytics_engagement_pc
  BEFORE INSERT OR DELETE OR UPDATE OF
    contest_id,
    created_at,
    status,
    platform,
    other_stats
  ON public.post_campaign_submission_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_analytics_engagement_rollup_trigger();

-- Backfill every existing bucket while source writes are blocked.
UPDATE public.admin_analytics_submission_daily_rollup
SET reach_sum = 0, saved_sum = 0;

WITH expected AS (
  SELECT
    s.contest_id,
    (s.created_at AT TIME ZONE 'UTC')::date AS day_key,
    public.admin_analytics_normalize_status(s.status::text) AS status,
    m.platform,
    COALESCE(SUM(m.reach), 0)::bigint AS reach_sum,
    COALESCE(SUM(m.saved), 0)::bigint AS saved_sum
  FROM public.submissions s
  LEFT JOIN public.contests c ON c.id = s.contest_id
  CROSS JOIN LATERAL public.admin_analytics_compute_engagement_metrics(
    s.platform,
    c.platform,
    c.contest_based_details,
    COALESCE(s.other_stats, '{}'::jsonb)
  ) AS m
  WHERE public.admin_analytics_submission_row_in_scope(m.platform)
  GROUP BY 1, 2, 3, 4
)
UPDATE public.admin_analytics_submission_daily_rollup AS r
SET reach_sum = e.reach_sum, saved_sum = e.saved_sum
FROM expected e
WHERE r.contest_id = e.contest_id
  AND r.day_key = e.day_key
  AND r.status = e.status
  AND r.platform = e.platform;

UPDATE public.admin_analytics_pc_daily_rollup
SET reach_sum = 0, saved_sum = 0;

WITH expected AS (
  SELECT
    pcs.contest_id,
    (pcs.created_at AT TIME ZONE 'UTC')::date AS day_key,
    public.admin_analytics_normalize_status(pcs.status::text) AS status,
    m.platform,
    COALESCE(SUM(m.reach), 0)::bigint AS reach_sum,
    COALESCE(SUM(m.saved), 0)::bigint AS saved_sum
  FROM public.post_campaign_submission_metrics pcs
  LEFT JOIN public.contests c ON c.id = pcs.contest_id
  CROSS JOIN LATERAL public.admin_analytics_compute_engagement_metrics(
    pcs.platform,
    c.platform,
    c.contest_based_details,
    COALESCE(pcs.other_stats, '{}'::jsonb)
  ) AS m
  WHERE public.admin_analytics_pc_row_in_scope(m.platform)
  GROUP BY 1, 2, 3, 4
)
UPDATE public.admin_analytics_pc_daily_rollup AS r
SET reach_sum = e.reach_sum, saved_sum = e.saved_sum
FROM expected e
WHERE r.contest_id = e.contest_id
  AND r.day_key = e.day_key
  AND r.status = e.status
  AND r.platform = e.platform;

-- PostgreSQL requires dropping these functions before extending their
-- table-shaped return type.
DROP FUNCTION public.brand_analytics_contest_rollup(
  timestamptz, timestamptz, uuid[]
);
CREATE FUNCTION public.brand_analytics_contest_rollup(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  contest_id uuid,
  status text,
  platform text,
  submission_count bigint,
  views_sum bigint,
  likes_sum bigint,
  comments_sum bigint,
  shares_sum bigint,
  reach_sum bigint,
  saved_sum bigint,
  payouts_cents_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.contest_id,
    r.status,
    r.platform,
    SUM(r.submission_count)::bigint,
    COALESCE(SUM(r.views_sum), 0)::bigint,
    COALESCE(SUM(r.likes_sum), 0)::bigint,
    COALESCE(SUM(r.comments_sum), 0)::bigint,
    COALESCE(SUM(r.shares_sum), 0)::bigint,
    COALESCE(SUM(r.reach_sum), 0)::bigint,
    COALESCE(SUM(r.saved_sum), 0)::bigint,
    COALESCE(SUM(r.payouts_cents_sum), 0)::bigint
  FROM public.admin_analytics_submission_daily_rollup r
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND r.contest_id = ANY (p_contest_ids)
    AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
    AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
    AND public.admin_analytics_submission_row_in_scope(r.platform)
  GROUP BY r.contest_id, r.status, r.platform
  ORDER BY r.contest_id, r.status, r.platform;
$$;

DROP FUNCTION public.brand_analytics_pc_contest_rollup(
  timestamptz, timestamptz, uuid[]
);
CREATE FUNCTION public.brand_analytics_pc_contest_rollup(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[]
)
RETURNS TABLE (
  contest_id uuid,
  status text,
  platform text,
  submission_count bigint,
  views_sum bigint,
  likes_sum bigint,
  comments_sum bigint,
  shares_sum bigint,
  reach_sum bigint,
  saved_sum bigint,
  payouts_cents_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.contest_id,
    r.status,
    r.platform,
    SUM(r.submission_count)::bigint,
    COALESCE(SUM(r.views_sum), 0)::bigint,
    COALESCE(SUM(r.likes_sum), 0)::bigint,
    COALESCE(SUM(r.comments_sum), 0)::bigint,
    COALESCE(SUM(r.shares_sum), 0)::bigint,
    COALESCE(SUM(r.reach_sum), 0)::bigint,
    COALESCE(SUM(r.saved_sum), 0)::bigint,
    COALESCE(SUM(r.payouts_cents_sum), 0)::bigint
  FROM public.admin_analytics_pc_daily_rollup r
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND r.contest_id = ANY (p_contest_ids)
    AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
    AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
    AND public.admin_analytics_pc_row_in_scope(r.platform)
  GROUP BY r.contest_id, r.status, r.platform
  ORDER BY r.contest_id, r.status, r.platform;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_reconcile_engagement_rollups(
  p_from_day date,
  p_to_day date,
  p_repair boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_repair boolean := COALESCE(p_repair, true);
  v_submission_drift bigint := 0;
  v_pc_drift bigint := 0;
BEGIN
  IF p_from_day IS NULL OR p_to_day IS NULL OR p_from_day > p_to_day THEN
    RAISE EXCEPTION 'A valid from/to day range is required';
  END IF;
  IF (p_to_day - p_from_day) > 30 THEN
    RAISE EXCEPTION 'Engagement reconciliation is limited to 31 days';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION
      'Engagement reconciliation must run in a READ COMMITTED transaction';
  END IF;

  PERFORM pg_advisory_xact_lock(71026, 1);

  CREATE TEMP TABLE IF NOT EXISTS analytics_expected_submission_engagement (
    contest_id uuid NOT NULL,
    day_key date NOT NULL,
    status text NOT NULL,
    platform text NOT NULL,
    reach_sum bigint NOT NULL,
    saved_sum bigint NOT NULL,
    PRIMARY KEY (contest_id, day_key, status, platform)
  ) ON COMMIT DROP;
  TRUNCATE analytics_expected_submission_engagement;

  INSERT INTO analytics_expected_submission_engagement
  SELECT
    s.contest_id,
    (s.created_at AT TIME ZONE 'UTC')::date,
    public.admin_analytics_normalize_status(s.status::text),
    m.platform,
    COALESCE(SUM(m.reach), 0)::bigint,
    COALESCE(SUM(m.saved), 0)::bigint
  FROM public.submissions s
  LEFT JOIN public.contests c ON c.id = s.contest_id
  CROSS JOIN LATERAL public.admin_analytics_compute_engagement_metrics(
    s.platform,
    c.platform,
    c.contest_based_details,
    COALESCE(s.other_stats, '{}'::jsonb)
  ) AS m
  WHERE s.created_at >= p_from_day::timestamp AT TIME ZONE 'UTC'
    AND s.created_at <
      (p_to_day + 1)::timestamp AT TIME ZONE 'UTC'
    AND public.admin_analytics_submission_row_in_scope(m.platform)
  GROUP BY 1, 2, 3, 4;

  WITH actual AS (
    SELECT r.*
    FROM public.admin_analytics_submission_daily_rollup r
    WHERE r.day_key BETWEEN p_from_day AND p_to_day
  )
  SELECT COUNT(*)::bigint
  INTO v_submission_drift
  FROM analytics_expected_submission_engagement e
  FULL JOIN actual a
    USING (contest_id, day_key, status, platform)
  WHERE COALESCE(e.reach_sum, 0) IS DISTINCT FROM COALESCE(a.reach_sum, 0)
    OR COALESCE(e.saved_sum, 0) IS DISTINCT FROM COALESCE(a.saved_sum, 0);

  CREATE TEMP TABLE IF NOT EXISTS analytics_expected_pc_engagement (
    contest_id uuid NOT NULL,
    day_key date NOT NULL,
    status text NOT NULL,
    platform text NOT NULL,
    reach_sum bigint NOT NULL,
    saved_sum bigint NOT NULL,
    PRIMARY KEY (contest_id, day_key, status, platform)
  ) ON COMMIT DROP;
  TRUNCATE analytics_expected_pc_engagement;

  INSERT INTO analytics_expected_pc_engagement
  SELECT
    pcs.contest_id,
    (pcs.created_at AT TIME ZONE 'UTC')::date,
    public.admin_analytics_normalize_status(pcs.status::text),
    m.platform,
    COALESCE(SUM(m.reach), 0)::bigint,
    COALESCE(SUM(m.saved), 0)::bigint
  FROM public.post_campaign_submission_metrics pcs
  LEFT JOIN public.contests c ON c.id = pcs.contest_id
  CROSS JOIN LATERAL public.admin_analytics_compute_engagement_metrics(
    pcs.platform,
    c.platform,
    c.contest_based_details,
    COALESCE(pcs.other_stats, '{}'::jsonb)
  ) AS m
  WHERE pcs.created_at >= p_from_day::timestamp AT TIME ZONE 'UTC'
    AND pcs.created_at <
      (p_to_day + 1)::timestamp AT TIME ZONE 'UTC'
    AND public.admin_analytics_pc_row_in_scope(m.platform)
  GROUP BY 1, 2, 3, 4;

  WITH actual AS (
    SELECT r.*
    FROM public.admin_analytics_pc_daily_rollup r
    WHERE r.day_key BETWEEN p_from_day AND p_to_day
  )
  SELECT COUNT(*)::bigint
  INTO v_pc_drift
  FROM analytics_expected_pc_engagement e
  FULL JOIN actual a
    USING (contest_id, day_key, status, platform)
  WHERE COALESCE(e.reach_sum, 0) IS DISTINCT FROM COALESCE(a.reach_sum, 0)
    OR COALESCE(e.saved_sum, 0) IS DISTINCT FROM COALESCE(a.saved_sum, 0);

  IF v_repair THEN
    INSERT INTO public.admin_analytics_submission_daily_rollup (
      contest_id,
      day_key,
      status,
      platform,
      reach_sum,
      saved_sum
    )
    SELECT
      contest_id,
      day_key,
      status,
      platform,
      reach_sum,
      saved_sum
    FROM analytics_expected_submission_engagement
    ON CONFLICT (contest_id, day_key, status, platform)
    DO UPDATE SET
      reach_sum = EXCLUDED.reach_sum,
      saved_sum = EXCLUDED.saved_sum;

    UPDATE public.admin_analytics_submission_daily_rollup r
    SET reach_sum = 0, saved_sum = 0
    WHERE r.day_key BETWEEN p_from_day AND p_to_day
      AND NOT EXISTS (
        SELECT 1
        FROM analytics_expected_submission_engagement e
        WHERE e.contest_id = r.contest_id
          AND e.day_key = r.day_key
          AND e.status = r.status
          AND e.platform = r.platform
      );

    INSERT INTO public.admin_analytics_pc_daily_rollup (
      contest_id,
      day_key,
      status,
      platform,
      reach_sum,
      saved_sum
    )
    SELECT
      contest_id,
      day_key,
      status,
      platform,
      reach_sum,
      saved_sum
    FROM analytics_expected_pc_engagement
    ON CONFLICT (contest_id, day_key, status, platform)
    DO UPDATE SET
      reach_sum = EXCLUDED.reach_sum,
      saved_sum = EXCLUDED.saved_sum;

    UPDATE public.admin_analytics_pc_daily_rollup r
    SET reach_sum = 0, saved_sum = 0
    WHERE r.day_key BETWEEN p_from_day AND p_to_day
      AND NOT EXISTS (
        SELECT 1
        FROM analytics_expected_pc_engagement e
        WHERE e.contest_id = r.contest_id
          AND e.day_key = r.day_key
          AND e.status = r.status
          AND e.platform = r.platform
      );
  END IF;

  RETURN jsonb_build_object(
    'fromDay', p_from_day,
    'toDay', p_to_day,
    'repaired', v_repair,
    'driftBuckets', jsonb_build_object(
      'submissions', v_submission_drift,
      'pcSubmissions', v_pc_drift
    )
  );
END;
$$;

-- Keep the existing cron command unchanged while adding engagement repair to
-- each dirty day it processes.
CREATE OR REPLACE FUNCTION public.admin_analytics_reconcile_dirty_rollups(
  p_max_days integer DEFAULT 7,
  p_repair boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_days integer := GREATEST(1, LEAST(COALESCE(p_max_days, 7), 31));
  v_repair boolean := COALESCE(p_repair, true);
  v_day date;
  v_result jsonb;
  v_engagement_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_processed integer := 0;
  v_remaining bigint := 0;
  v_submission_drift bigint := 0;
  v_pc_drift bigint := 0;
  v_creator_drift bigint := 0;
  v_pc_creator_drift bigint := 0;
  v_submission_engagement_drift bigint := 0;
  v_pc_engagement_drift bigint := 0;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION
      'Dirty rollup reconciliation must run in a READ COMMITTED transaction';
  END IF;

  PERFORM pg_advisory_xact_lock(71026, 1);

  FOR v_day IN
    SELECT d.day_key
    FROM public.admin_analytics_rollup_dirty_days d
    GROUP BY d.day_key
    ORDER BY MIN(d.marked_at), d.day_key
    LIMIT v_max_days
  LOOP
    v_result := public.admin_analytics_reconcile_rollups(
      v_day,
      v_day,
      v_repair
    );
    v_engagement_result :=
      public.admin_analytics_reconcile_engagement_rollups(
        v_day,
        v_day,
        v_repair
      );

    v_processed := v_processed + 1;
    v_submission_drift := v_submission_drift
      + COALESCE((v_result #>> '{driftBuckets,submissions}')::bigint, 0);
    v_pc_drift := v_pc_drift
      + COALESCE((v_result #>> '{driftBuckets,pcSubmissions}')::bigint, 0);
    v_creator_drift := v_creator_drift
      + COALESCE((v_result #>> '{driftBuckets,creators}')::bigint, 0);
    v_pc_creator_drift := v_pc_creator_drift
      + COALESCE((v_result #>> '{driftBuckets,pcCreators}')::bigint, 0);
    v_submission_engagement_drift := v_submission_engagement_drift
      + COALESCE(
        (v_engagement_result #>> '{driftBuckets,submissions}')::bigint,
        0
      );
    v_pc_engagement_drift := v_pc_engagement_drift
      + COALESCE(
        (v_engagement_result #>> '{driftBuckets,pcSubmissions}')::bigint,
        0
      );
    v_results := v_results || jsonb_build_array(
      v_result || jsonb_build_object('engagement', v_engagement_result)
    );

    IF v_repair THEN
      DELETE FROM public.admin_analytics_rollup_dirty_days d
      WHERE d.day_key = v_day;
    END IF;
  END LOOP;

  SELECT COUNT(DISTINCT d.day_key)::bigint
  INTO v_remaining
  FROM public.admin_analytics_rollup_dirty_days d;

  RETURN jsonb_build_object(
    'processedDays', v_processed,
    'remainingDays', v_remaining,
    'repaired', v_repair,
    'driftBuckets', jsonb_build_object(
      'submissions', v_submission_drift,
      'pcSubmissions', v_pc_drift,
      'creators', v_creator_drift,
      'pcCreators', v_pc_creator_drift,
      'submissionEngagement', v_submission_engagement_drift,
      'pcSubmissionEngagement', v_pc_engagement_drift
    ),
    'days', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_compute_engagement_metrics(
  text, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_analytics_engagement_rollup_trigger()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_analytics_reconcile_engagement_rollups(
  date, date, boolean
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_analytics_reconcile_dirty_rollups(
  integer, boolean
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.brand_analytics_contest_rollup(
  timestamptz, timestamptz, uuid[]
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.brand_analytics_pc_contest_rollup(
  timestamptz, timestamptz, uuid[]
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.brand_analytics_contest_rollup(
  timestamptz, timestamptz, uuid[]
) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_pc_contest_rollup(
  timestamptz, timestamptz, uuid[]
) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_reconcile_engagement_rollups(
  date, date, boolean
) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_reconcile_dirty_rollups(
  integer, boolean
) TO service_role;

COMMIT;
