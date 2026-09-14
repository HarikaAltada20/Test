-- Expand quality score scale from 1–3 to 1–5.
-- Remap existing scores: 1→3, 2→4, 3→5 (new = old + 2).
-- Contest min_avg / min_best gates also get +2 to preserve relative meaning.
-- Sum gate (min_quality_score) is intentionally left unchanged.
--
-- Deploy: run this migration BEFORE deploying the app that accepts scores 4–5.

-- ---------------------------------------------------------------------------
-- 1. Drop old 1–3 CHECK constraints
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_quality_score_range'
  ) THEN
    ALTER TABLE public.submissions DROP CONSTRAINT submissions_quality_score_range;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contests_min_best_quality_score_range'
  ) THEN
    ALTER TABLE public.contests DROP CONSTRAINT contests_min_best_quality_score_range;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contests_min_avg_quality_score_range'
  ) THEN
    ALTER TABLE public.contests DROP CONSTRAINT contests_min_avg_quality_score_range;
  END IF;
END $$;

-- bulk_submission_moderation_jobs.quality_score may be an inline CHECK; drop by discovering it
DO $$
DECLARE
  v_conname text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'bulk_submission_moderation_jobs'
  ) THEN
    FOR v_conname IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'bulk_submission_moderation_jobs'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%quality_score%'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.bulk_submission_moderation_jobs DROP CONSTRAINT %I',
        v_conname
      );
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Replace quality contribution / incremental sync for 1–5 (before remap)
-- ---------------------------------------------------------------------------
-- Return type gains score4/score5; must DROP before recreate.
DROP FUNCTION IF EXISTS public._submission_quality_contribution(text, integer, boolean);

CREATE OR REPLACE FUNCTION public._submission_quality_contribution(
  p_status text,
  p_quality integer,
  p_backfilled boolean DEFAULT false
)
RETURNS TABLE (
  quality_sum numeric,
  scored_count integer,
  score1 integer,
  score2 integer,
  score3 integer,
  score4 integer,
  score5 integer
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  quality_sum := 0;
  scored_count := 0;
  score1 := 0;
  score2 := 0;
  score3 := 0;
  score4 := 0;
  score5 := 0;

  IF COALESCE(p_backfilled, false) THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF public._submission_status_bucket(p_status) <> 'verified' THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_quality IS NULL OR p_quality < 1 OR p_quality > 5 THEN
    RETURN NEXT;
    RETURN;
  END IF;

  quality_sum := p_quality;
  scored_count := 1;
  IF p_quality = 1 THEN score1 := 1;
  ELSIF p_quality = 2 THEN score2 := 1;
  ELSIF p_quality = 3 THEN score3 := 1;
  ELSIF p_quality = 4 THEN score4 := 1;
  ELSE score5 := 1;
  END IF;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_submission_metrics_change(
  p_creator_id uuid,
  p_old_status public.submission_status_enum,
  p_old_quality integer,
  p_new_status public.submission_status_enum,
  p_new_quality integer,
  p_old_backfilled boolean DEFAULT false,
  p_new_backfilled boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_verified integer;
  v_rejected integer;
  v_pending integer;
  v_quality_sum numeric;
  v_scored_count integer;
  v_counts jsonb;
  v_old_bucket text;
  v_new_bucket text;
  v_old_q record;
  v_new_q record;
  v_trust_number integer;
  v_trust_score integer;
  v_avg numeric;
  v_best integer;
  v_score1 integer;
  v_score2 integer;
  v_score3 integer;
  v_score4 integer;
  v_score5 integer;
BEGIN
  IF p_creator_id IS NULL THEN
    RETURN;
  END IF;

  IF p_old_status IS NULL AND p_new_status IS NULL THEN
    RETURN;
  END IF;

  SELECT
    coalesce((cp.trust_score_metrics->>'total_reels')::integer, 0),
    coalesce((cp.trust_score_metrics->>'verified_reels')::integer, 0),
    coalesce((cp.trust_score_metrics->>'rejected_reels')::integer, 0),
    coalesce((cp.trust_score_metrics->>'pending_reels')::integer, 0),
    coalesce(cp.quality_score_sum, 0),
    coalesce(cp.scored_verified_count, 0),
    coalesce(
      cp.quality_score_counts,
      jsonb_build_object(
        'score1', 0, 'score2', 0, 'score3', 0, 'score4', 0, 'score5', 0
      )
    )
  INTO
    v_total,
    v_verified,
    v_rejected,
    v_pending,
    v_quality_sum,
    v_scored_count,
    v_counts
  FROM public.creator_profiles cp
  WHERE cp.id = p_creator_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_old_bucket := CASE
    WHEN p_old_status IS NULL THEN NULL
    ELSE public._submission_status_bucket(p_old_status::text)
  END;
  v_new_bucket := CASE
    WHEN p_new_status IS NULL THEN NULL
    ELSE public._submission_status_bucket(p_new_status::text)
  END;

  IF p_old_status IS NOT NULL AND v_old_bucket = 'verified' THEN
    v_verified := v_verified - 1;
  ELSIF p_old_status IS NOT NULL AND v_old_bucket = 'rejected' THEN
    v_rejected := v_rejected - 1;
  ELSIF p_old_status IS NOT NULL AND v_old_bucket = 'pending' THEN
    v_pending := v_pending - 1;
  END IF;

  IF p_new_status IS NOT NULL AND v_new_bucket = 'verified' THEN
    v_verified := v_verified + 1;
  ELSIF p_new_status IS NOT NULL AND v_new_bucket = 'rejected' THEN
    v_rejected := v_rejected + 1;
  ELSIF p_new_status IS NOT NULL AND v_new_bucket = 'pending' THEN
    v_pending := v_pending + 1;
  END IF;

  IF p_old_status IS NULL AND p_new_status IS NOT NULL THEN
    v_total := v_total + 1;
  ELSIF p_new_status IS NULL AND p_old_status IS NOT NULL THEN
    v_total := v_total - 1;
  END IF;

  SELECT * INTO v_old_q
  FROM public._submission_quality_contribution(
    p_old_status::text,
    p_old_quality,
    COALESCE(p_old_backfilled, false)
  );
  SELECT * INTO v_new_q
  FROM public._submission_quality_contribution(
    p_new_status::text,
    p_new_quality,
    COALESCE(p_new_backfilled, false)
  );

  v_quality_sum := coalesce(v_quality_sum, 0)
    - coalesce(v_old_q.quality_sum, 0)
    + coalesce(v_new_q.quality_sum, 0);
  v_scored_count := greatest(
    0,
    coalesce(v_scored_count, 0)
      - coalesce(v_old_q.scored_count, 0)
      + coalesce(v_new_q.scored_count, 0)
  );
  v_quality_sum := greatest(0, coalesce(v_quality_sum, 0));

  v_score1 := greatest(
    0,
    coalesce((v_counts->>'score1')::integer, 0)
      - coalesce(v_old_q.score1, 0)
      + coalesce(v_new_q.score1, 0)
  );
  v_score2 := greatest(
    0,
    coalesce((v_counts->>'score2')::integer, 0)
      - coalesce(v_old_q.score2, 0)
      + coalesce(v_new_q.score2, 0)
  );
  v_score3 := greatest(
    0,
    coalesce((v_counts->>'score3')::integer, 0)
      - coalesce(v_old_q.score3, 0)
      + coalesce(v_new_q.score3, 0)
  );
  v_score4 := greatest(
    0,
    coalesce((v_counts->>'score4')::integer, 0)
      - coalesce(v_old_q.score4, 0)
      + coalesce(v_new_q.score4, 0)
  );
  v_score5 := greatest(
    0,
    coalesce((v_counts->>'score5')::integer, 0)
      - coalesce(v_old_q.score5, 0)
      + coalesce(v_new_q.score5, 0)
  );

  v_total := greatest(0, coalesce(v_total, 0));
  v_verified := greatest(0, coalesce(v_verified, 0));
  v_rejected := greatest(0, coalesce(v_rejected, 0));
  v_pending := greatest(0, coalesce(v_pending, 0));

  v_trust_number := v_verified - v_rejected;

  IF v_verified = 0 THEN
    IF v_rejected > 0 THEN
      v_trust_score := 0;
    ELSE
      v_trust_score := 100;
    END IF;
  ELSE
    v_trust_score := greatest(
      0,
      least(100, round((v_trust_number::numeric / v_verified::numeric) * 100))
    )::integer;
  END IF;

  IF v_verified > 0 THEN
    IF v_scored_count > 0 THEN
      v_avg := round(v_quality_sum / v_scored_count, 2);
      v_best := CASE
        WHEN v_score5 > 0 THEN 5
        WHEN v_score4 > 0 THEN 4
        WHEN v_score3 > 0 THEN 3
        WHEN v_score2 > 0 THEN 2
        WHEN v_score1 > 0 THEN 1
        ELSE NULL
      END;
    ELSE
      v_avg := NULL;
      v_best := NULL;
    END IF;
  ELSIF v_rejected > 0 THEN
    v_avg := NULL;
    v_best := NULL;
  ELSE
    v_avg := 1;
    v_best := 1;
  END IF;

  UPDATE public.creator_profiles
  SET
    trust_score_metrics = jsonb_build_object(
      'trust_score', v_trust_score,
      'trust_number', v_trust_number,
      'total_reels', v_total,
      'verified_reels', v_verified,
      'rejected_reels', v_rejected,
      'pending_reels', v_pending,
      'updated_at', now()
    ),
    avg_quality_score = v_avg,
    best_quality_score = v_best,
    quality_score_sum = v_quality_sum,
    scored_verified_count = v_scored_count,
    quality_score_counts = jsonb_build_object(
      'score1', v_score1,
      'score2', v_score2,
      'score3', v_score3,
      'score4', v_score4,
      'score5', v_score5
    )
  WHERE id = p_creator_id;

  PERFORM public.sync_creator_explicit_quality_flag(p_creator_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_creator_quality_metrics(p_creator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified integer;
  v_rejected integer;
  v_avg numeric;
  v_best integer;
  v_sum numeric;
  v_scored integer;
  v_score1 integer;
  v_score2 integer;
  v_score3 integer;
  v_score4 integer;
  v_score5 integer;
BEGIN
  IF p_creator_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::integer
  INTO v_verified, v_rejected
  FROM public.submissions s
  WHERE s.creator_id = p_creator_id;

  v_sum := 0;
  v_scored := 0;
  v_score1 := 0;
  v_score2 := 0;
  v_score3 := 0;
  v_score4 := 0;
  v_score5 := 0;

  IF COALESCE(v_verified, 0) > 0 THEN
    SELECT
      COALESCE(SUM(s.quality_score), 0),
      COUNT(*) FILTER (WHERE s.quality_score IS NOT NULL)::integer,
      COUNT(*) FILTER (WHERE s.quality_score = 1)::integer,
      COUNT(*) FILTER (WHERE s.quality_score = 2)::integer,
      COUNT(*) FILTER (WHERE s.quality_score = 3)::integer,
      COUNT(*) FILTER (WHERE s.quality_score = 4)::integer,
      COUNT(*) FILTER (WHERE s.quality_score = 5)::integer
    INTO v_sum, v_scored, v_score1, v_score2, v_score3, v_score4, v_score5
    FROM public.submissions s
    WHERE s.creator_id = p_creator_id
      AND s.status IN ('verified', 'paid')
      AND s.quality_score IS NOT NULL
      AND NOT COALESCE(s.quality_score_backfilled, false);

    IF COALESCE(v_scored, 0) > 0 THEN
      v_avg := ROUND(v_sum / v_scored, 2);
      v_best := CASE
        WHEN v_score5 > 0 THEN 5
        WHEN v_score4 > 0 THEN 4
        WHEN v_score3 > 0 THEN 3
        WHEN v_score2 > 0 THEN 2
        WHEN v_score1 > 0 THEN 1
        ELSE NULL
      END;
    ELSE
      v_avg := NULL;
      v_best := NULL;
    END IF;
  ELSIF COALESCE(v_rejected, 0) > 0 THEN
    v_avg := NULL;
    v_best := NULL;
  ELSE
    v_avg := 1;
    v_best := 1;
  END IF;

  UPDATE public.creator_profiles
  SET
    avg_quality_score = v_avg,
    best_quality_score = v_best,
    quality_score_sum = COALESCE(v_sum, 0),
    scored_verified_count = COALESCE(v_scored, 0),
    quality_score_counts = jsonb_build_object(
      'score1', COALESCE(v_score1, 0),
      'score2', COALESCE(v_score2, 0),
      'score3', COALESCE(v_score3, 0),
      'score4', COALESCE(v_score4, 0),
      'score5', COALESCE(v_score5, 0)
    )
  WHERE id = p_creator_id;
END;
$$;

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
  v_expected_score4 integer;
  v_expected_score5 integer;
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
    COUNT(*) FILTER (WHERE s.quality_score = 3)::integer,
    COUNT(*) FILTER (WHERE s.quality_score = 4)::integer,
    COUNT(*) FILTER (WHERE s.quality_score = 5)::integer
  INTO
    v_expected_sum,
    v_expected_scored,
    v_expected_score1,
    v_expected_score2,
    v_expected_score3,
    v_expected_score4,
    v_expected_score5
  FROM public.submissions s
  WHERE s.creator_id = p_creator_id
    AND s.status IN ('verified', 'paid')
    AND s.quality_score IS NOT NULL
    AND NOT COALESCE(s.quality_score_backfilled, false);

  SELECT
    COALESCE(cp.quality_score_sum, 0),
    COALESCE(cp.scored_verified_count, 0),
    COALESCE(
      cp.quality_score_counts,
      jsonb_build_object(
        'score1', 0, 'score2', 0, 'score3', 0, 'score4', 0, 'score5', 0
      )
    )
  INTO v_actual_sum, v_actual_scored, v_actual_counts
  FROM public.creator_profiles cp
  WHERE cp.id = p_creator_id;

  IF v_actual_sum IS DISTINCT FROM COALESCE(v_expected_sum, 0)
     OR v_actual_scored IS DISTINCT FROM COALESCE(v_expected_scored, 0)
     OR COALESCE((v_actual_counts->>'score1')::integer, 0) IS DISTINCT FROM COALESCE(v_expected_score1, 0)
     OR COALESCE((v_actual_counts->>'score2')::integer, 0) IS DISTINCT FROM COALESCE(v_expected_score2, 0)
     OR COALESCE((v_actual_counts->>'score3')::integer, 0) IS DISTINCT FROM COALESCE(v_expected_score3, 0)
     OR COALESCE((v_actual_counts->>'score4')::integer, 0) IS DISTINCT FROM COALESCE(v_expected_score4, 0)
     OR COALESCE((v_actual_counts->>'score5')::integer, 0) IS DISTINCT FROM COALESCE(v_expected_score5, 0) THEN
    v_drift := true;
    UPDATE public.creator_profiles
    SET
      quality_score_sum = COALESCE(v_expected_sum, 0),
      scored_verified_count = COALESCE(v_expected_scored, 0),
      quality_score_counts = jsonb_build_object(
        'score1', COALESCE(v_expected_score1, 0),
        'score2', COALESCE(v_expected_score2, 0),
        'score3', COALESCE(v_expected_score3, 0),
        'score4', COALESCE(v_expected_score4, 0),
        'score5', COALESCE(v_expected_score5, 0)
      )
    WHERE id = p_creator_id;
    PERFORM public.sync_creator_quality_metrics(p_creator_id);
  END IF;

  RETURN v_drift;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_verified_submission_quality_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_verified boolean;
  v_old_verified boolean;
BEGIN
  v_new_verified := public._submission_status_bucket(NEW.status::text) = 'verified';

  IF NOT v_new_verified THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_old_verified := false;
  ELSE
    v_old_verified := public._submission_status_bucket(OLD.status::text) = 'verified';
  END IF;

  -- Require score only when entering verified/paid (new verify). Legacy rows may keep NULL.
  IF NOT v_old_verified THEN
    IF NEW.quality_score IS NULL OR NEW.quality_score < 1 OR NEW.quality_score > 5 THEN
      RAISE EXCEPTION
        'verified_submission_requires_quality_score: verified/paid submissions require quality_score between 1 and 5 when verified'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Remap existing scores and contest avg/best gates (+2)
--    Disable sync trigger so bulk remap does not drift counters mid-update.
-- ---------------------------------------------------------------------------
ALTER TABLE public.submissions DISABLE TRIGGER submissions_sync_trust_metrics;

UPDATE public.submissions
SET quality_score = quality_score + 2
WHERE quality_score BETWEEN 1 AND 3;

ALTER TABLE public.submissions ENABLE TRIGGER submissions_sync_trust_metrics;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bulk_submission_moderation_jobs'
      AND column_name = 'quality_score'
  ) THEN
    UPDATE public.bulk_submission_moderation_jobs
    SET quality_score = quality_score + 2
    WHERE quality_score BETWEEN 1 AND 3;
  END IF;
END $$;

UPDATE public.contests
SET min_best_quality_score = min_best_quality_score + 2
WHERE min_best_quality_score BETWEEN 1 AND 3;

UPDATE public.contests
SET min_avg_quality_score = min_avg_quality_score + 2
WHERE min_avg_quality_score IS NOT NULL
  AND min_avg_quality_score >= 1
  AND min_avg_quality_score <= 3;

-- ---------------------------------------------------------------------------
-- 4. Rebuild creator profile quality caches from remapped submissions
-- ---------------------------------------------------------------------------
WITH scored AS (
  SELECT
    s.creator_id,
    COALESCE(SUM(s.quality_score), 0)::numeric(12, 2) AS quality_sum,
    COUNT(*)::integer AS scored_count,
    COUNT(*) FILTER (WHERE s.quality_score = 1)::integer AS score1,
    COUNT(*) FILTER (WHERE s.quality_score = 2)::integer AS score2,
    COUNT(*) FILTER (WHERE s.quality_score = 3)::integer AS score3,
    COUNT(*) FILTER (WHERE s.quality_score = 4)::integer AS score4,
    COUNT(*) FILTER (WHERE s.quality_score = 5)::integer AS score5
  FROM public.submissions s
  WHERE s.status IN ('verified', 'paid')
    AND s.quality_score IS NOT NULL
    AND NOT COALESCE(s.quality_score_backfilled, false)
  GROUP BY s.creator_id
)
UPDATE public.creator_profiles cp
SET
  quality_score_sum = COALESCE(scored.quality_sum, 0),
  scored_verified_count = COALESCE(scored.scored_count, 0),
  quality_score_counts = jsonb_build_object(
    'score1', COALESCE(scored.score1, 0),
    'score2', COALESCE(scored.score2, 0),
    'score3', COALESCE(scored.score3, 0),
    'score4', COALESCE(scored.score4, 0),
    'score5', COALESCE(scored.score5, 0)
  )
FROM scored
WHERE cp.id = scored.creator_id;

UPDATE public.creator_profiles cp
SET
  quality_score_sum = 0,
  scored_verified_count = 0,
  quality_score_counts = jsonb_build_object(
    'score1', 0, 'score2', 0, 'score3', 0, 'score4', 0, 'score5', 0
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.submissions s
  WHERE s.creator_id = cp.id
    AND s.status IN ('verified', 'paid')
    AND s.quality_score IS NOT NULL
    AND NOT COALESCE(s.quality_score_backfilled, false)
);

WITH creator_counts AS (
  SELECT
    s.creator_id,
    COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer AS verified,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::integer AS rejected
  FROM public.submissions s
  WHERE s.creator_id IS NOT NULL
  GROUP BY s.creator_id
),
explicit_quality AS (
  SELECT
    s.creator_id,
    ROUND(AVG(s.quality_score)::numeric, 2) AS avg_quality,
    CASE
      WHEN COUNT(*) FILTER (WHERE s.quality_score = 5) > 0 THEN 5
      WHEN COUNT(*) FILTER (WHERE s.quality_score = 4) > 0 THEN 4
      WHEN COUNT(*) FILTER (WHERE s.quality_score = 3) > 0 THEN 3
      WHEN COUNT(*) FILTER (WHERE s.quality_score = 2) > 0 THEN 2
      WHEN COUNT(*) FILTER (WHERE s.quality_score = 1) > 0 THEN 1
      ELSE NULL
    END AS best_quality
  FROM public.submissions s
  WHERE s.creator_id IS NOT NULL
    AND s.status IN ('verified', 'paid')
    AND s.quality_score IS NOT NULL
    AND NOT COALESCE(s.quality_score_backfilled, false)
  GROUP BY s.creator_id
)
UPDATE public.creator_profiles cp
SET
  avg_quality_score = CASE
    WHEN COALESCE(cc.verified, 0) > 0 THEN eq.avg_quality
    WHEN COALESCE(cc.rejected, 0) > 0 THEN NULL
    ELSE 1
  END,
  best_quality_score = CASE
    WHEN COALESCE(cc.verified, 0) > 0 THEN eq.best_quality
    WHEN COALESCE(cc.rejected, 0) > 0 THEN NULL
    ELSE 1
  END
FROM creator_counts cc
LEFT JOIN explicit_quality eq ON eq.creator_id = cc.creator_id
WHERE cp.id = cc.creator_id;

-- Profiles with no submissions keep defaults; ensure empty counts include score4/5
UPDATE public.creator_profiles
SET quality_score_counts = jsonb_build_object(
  'score1', 0, 'score2', 0, 'score3', 0, 'score4', 0, 'score5', 0
)
WHERE quality_score_counts IS NULL
   OR NOT (quality_score_counts ? 'score4')
   OR NOT (quality_score_counts ? 'score5');

ALTER TABLE public.creator_profiles
  ALTER COLUMN quality_score_counts SET DEFAULT jsonb_build_object(
    'score1', 0, 'score2', 0, 'score3', 0, 'score4', 0, 'score5', 0
  );

COMMENT ON COLUMN public.submissions.quality_score IS
  '1–5 quality rating assigned at verify time. NULL for pending/rejected. Legacy unscored verified may stay NULL.';
COMMENT ON COLUMN public.creator_profiles.quality_score_counts IS
  'Tier counts for quality scores 1–5 on verified/paid submissions (incremental cache).';

-- ---------------------------------------------------------------------------
-- 5. Re-add CHECK constraints for 1–5
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_quality_score_range'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_quality_score_range
      CHECK (quality_score IS NULL OR (quality_score >= 1 AND quality_score <= 5));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contests_min_best_quality_score_range'
  ) THEN
    ALTER TABLE public.contests
      ADD CONSTRAINT contests_min_best_quality_score_range
      CHECK (
        min_best_quality_score IS NULL
        OR (min_best_quality_score >= 1 AND min_best_quality_score <= 5)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contests_min_avg_quality_score_range'
  ) THEN
    ALTER TABLE public.contests
      ADD CONSTRAINT contests_min_avg_quality_score_range
      CHECK (
        min_avg_quality_score IS NULL
        OR (min_avg_quality_score >= 1 AND min_avg_quality_score <= 5)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bulk_submission_moderation_jobs'
      AND column_name = 'quality_score'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'bulk_submission_moderation_jobs_quality_score_check'
    ) THEN
      ALTER TABLE public.bulk_submission_moderation_jobs
        ADD CONSTRAINT bulk_submission_moderation_jobs_quality_score_check
        CHECK (quality_score IS NULL OR quality_score IN (1, 2, 3, 4, 5));
    END IF;
  END IF;
END $$;
