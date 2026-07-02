-- Backfill historical quality scores + metrics reconciliation helpers.
-- Run after 20260702_incremental_creator_metrics.sql.

-- Default historical verified/paid submissions to 1/3 so existing creators are not
-- blocked by quality gates before admins re-score individually.
UPDATE public.submissions
SET quality_score = 1
WHERE status IN ('verified', 'paid')
  AND quality_score IS NULL;

-- Rebuild incremental quality counters after backfill.
WITH scored AS (
  SELECT
    s.creator_id,
    COALESCE(SUM(s.quality_score), 0)::numeric(12, 2) AS quality_sum,
    COUNT(*)::integer AS scored_count,
    COUNT(*) FILTER (WHERE s.quality_score = 1)::integer AS score1,
    COUNT(*) FILTER (WHERE s.quality_score = 2)::integer AS score2,
    COUNT(*) FILTER (WHERE s.quality_score = 3)::integer AS score3
  FROM public.submissions s
  WHERE s.status IN ('verified', 'paid')
    AND s.quality_score IS NOT NULL
  GROUP BY s.creator_id
)
UPDATE public.creator_profiles cp
SET
  quality_score_sum = COALESCE(scored.quality_sum, 0),
  scored_verified_count = COALESCE(scored.scored_count, 0),
  quality_score_counts = jsonb_build_object(
    'score1', COALESCE(scored.score1, 0),
    'score2', COALESCE(scored.score2, 0),
    'score3', COALESCE(scored.score3, 0)
  )
FROM scored
WHERE cp.id = scored.creator_id;

-- Refresh avg/best quality for creators with backfilled submissions.
DO $$
DECLARE
  v_creator_id uuid;
BEGIN
  FOR v_creator_id IN
    SELECT DISTINCT s.creator_id
    FROM public.submissions s
    WHERE s.status IN ('verified', 'paid')
      AND s.quality_score IS NOT NULL
  LOOP
    PERFORM public.sync_creator_quality_metrics(v_creator_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_creator_profile_metrics(p_creator_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected_sum numeric(12, 2);
  v_expected_scored integer;
  v_expected_score1 integer;
  v_expected_score2 integer;
  v_expected_score3 integer;
  v_actual_sum numeric(12, 2);
  v_actual_scored integer;
  v_actual_counts jsonb;
  v_drift boolean := false;
BEGIN
  IF p_creator_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM public.sync_creator_trust_score_metrics(p_creator_id);

  SELECT
    COALESCE(SUM(s.quality_score), 0)::numeric(12, 2),
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE s.quality_score = 1)::integer,
    COUNT(*) FILTER (WHERE s.quality_score = 2)::integer,
    COUNT(*) FILTER (WHERE s.quality_score = 3)::integer
  INTO
    v_expected_sum,
    v_expected_scored,
    v_expected_score1,
    v_expected_score2,
    v_expected_score3
  FROM public.submissions s
  WHERE s.creator_id = p_creator_id
    AND s.status IN ('verified', 'paid')
    AND s.quality_score IS NOT NULL;

  SELECT
    COALESCE(cp.quality_score_sum, 0),
    COALESCE(cp.scored_verified_count, 0),
    COALESCE(cp.quality_score_counts, jsonb_build_object('score1', 0, 'score2', 0, 'score3', 0))
  INTO v_actual_sum, v_actual_scored, v_actual_counts
  FROM public.creator_profiles cp
  WHERE cp.id = p_creator_id;

  IF v_actual_sum IS DISTINCT FROM COALESCE(v_expected_sum, 0)
     OR v_actual_scored IS DISTINCT FROM COALESCE(v_expected_scored, 0)
     OR COALESCE((v_actual_counts->>'score1')::integer, 0) IS DISTINCT FROM COALESCE(v_expected_score1, 0)
     OR COALESCE((v_actual_counts->>'score2')::integer, 0) IS DISTINCT FROM COALESCE(v_expected_score2, 0)
     OR COALESCE((v_actual_counts->>'score3')::integer, 0) IS DISTINCT FROM COALESCE(v_expected_score3, 0) THEN
    v_drift := true;
    UPDATE public.creator_profiles
    SET
      quality_score_sum = COALESCE(v_expected_sum, 0),
      scored_verified_count = COALESCE(v_expected_scored, 0),
      quality_score_counts = jsonb_build_object(
        'score1', COALESCE(v_expected_score1, 0),
        'score2', COALESCE(v_expected_score2, 0),
        'score3', COALESCE(v_expected_score3, 0)
      )
    WHERE id = p_creator_id;
    PERFORM public.sync_creator_quality_metrics(p_creator_id);
  END IF;

  RETURN v_drift;
END;
$$;

COMMENT ON FUNCTION public.reconcile_creator_profile_metrics(uuid) IS
  'Full recompute of trust/quality caches; repairs incremental quality counter drift when detected.';

CREATE OR REPLACE FUNCTION public.reconcile_creator_profile_metrics_batch(
  p_batch_size integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_batch_ids uuid[];
  v_batch_len integer;
  v_profile_id uuid;
  v_drift_count integer := 0;
  v_batch_size integer := GREATEST(1, LEAST(COALESCE(p_batch_size, 500), 2000));
BEGIN
  LOOP
    SELECT ARRAY_AGG(batch.id ORDER BY batch.id)
    INTO v_batch_ids
    FROM (
      SELECT cp.id
      FROM public.creator_profiles cp
      WHERE cp.id > v_last_id
      ORDER BY cp.id
      LIMIT v_batch_size
    ) batch;

    v_batch_len := COALESCE(array_length(v_batch_ids, 1), 0);
    EXIT WHEN v_batch_len = 0;

    FOREACH v_profile_id IN ARRAY v_batch_ids
    LOOP
      IF public.reconcile_creator_profile_metrics(v_profile_id) THEN
        v_drift_count := v_drift_count + 1;
      END IF;
    END LOOP;

    v_last_id := v_batch_ids[v_batch_len];
  END LOOP;

  RETURN v_drift_count;
END;
$$;

COMMENT ON FUNCTION public.reconcile_creator_profile_metrics_batch(integer) IS
  'Nightly/ops job: reconcile all creator profile metrics; returns count of profiles with repaired drift.';
