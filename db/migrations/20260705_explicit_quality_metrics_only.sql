-- Explicit-only quality aggregates + verified quality enforcement.
-- Run after 20260704_backfilled_quality_and_contest_gates.sql.
--
-- 1. Incremental quality counters track only verify-time scores (not migration backfill).
-- 2. Gate trigger always evaluates explicit-only avg/best when quality gates apply.
-- 3. Verified/paid submissions must carry quality_score (API + direct writes).

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
  score3 integer
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

  IF COALESCE(p_backfilled, false) THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF public._submission_status_bucket(p_status) <> 'verified' THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_quality IS NULL OR p_quality < 1 OR p_quality > 3 THEN
    RETURN NEXT;
    RETURN;
  END IF;

  quality_sum := p_quality;
  scored_count := 1;
  IF p_quality = 1 THEN score1 := 1;
  ELSIF p_quality = 2 THEN score2 := 1;
  ELSE score3 := 1;
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
    coalesce(cp.quality_score_counts, jsonb_build_object('score1', 0, 'score2', 0, 'score3', 0))
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
      'score3', v_score3
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

  IF COALESCE(v_verified, 0) > 0 THEN
    SELECT
      COALESCE(SUM(s.quality_score), 0),
      COUNT(*) FILTER (WHERE s.quality_score IS NOT NULL)::integer,
      COUNT(*) FILTER (WHERE s.quality_score = 1)::integer,
      COUNT(*) FILTER (WHERE s.quality_score = 2)::integer,
      COUNT(*) FILTER (WHERE s.quality_score = 3)::integer
    INTO v_sum, v_scored, v_score1, v_score2, v_score3
    FROM public.submissions s
    WHERE s.creator_id = p_creator_id
      AND s.status IN ('verified', 'paid')
      AND s.quality_score IS NOT NULL
      AND s.quality_score_backfilled = false;

    IF COALESCE(v_scored, 0) > 0 THEN
      v_avg := ROUND(v_sum / v_scored, 2);
      v_best := CASE
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
      'score3', COALESCE(v_score3, 0)
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
    AND s.quality_score IS NOT NULL
    AND s.quality_score_backfilled = false;

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

CREATE OR REPLACE FUNCTION public.trg_sync_creator_trust_after_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.creator_id IS NOT NULL THEN
      PERFORM public.apply_submission_metrics_change(
        OLD.creator_id,
        OLD.status,
        OLD.quality_score,
        NULL,
        NULL,
        OLD.quality_score_backfilled,
        false
      );
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.creator_id IS NOT NULL THEN
      PERFORM public.apply_submission_metrics_change(
        NEW.creator_id,
        NULL,
        NULL,
        NEW.status,
        NEW.quality_score,
        false,
        NEW.quality_score_backfilled
      );
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.creator_id IS DISTINCT FROM NEW.creator_id THEN
    IF OLD.creator_id IS NOT NULL THEN
      PERFORM public.apply_submission_metrics_change(
        OLD.creator_id,
        OLD.status,
        OLD.quality_score,
        NULL,
        NULL,
        OLD.quality_score_backfilled,
        false
      );
    END IF;
    IF NEW.creator_id IS NOT NULL THEN
      PERFORM public.apply_submission_metrics_change(
        NEW.creator_id,
        NULL,
        NULL,
        NEW.status,
        NEW.quality_score,
        false,
        NEW.quality_score_backfilled
      );
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.quality_score IS DISTINCT FROM NEW.quality_score
     OR OLD.quality_score_backfilled IS DISTINCT FROM NEW.quality_score_backfilled THEN
    PERFORM public.apply_submission_metrics_change(
      NEW.creator_id,
      OLD.status,
      OLD.quality_score,
      NEW.status,
      NEW.quality_score,
      OLD.quality_score_backfilled,
      NEW.quality_score_backfilled
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_sync_trust_metrics ON public.submissions;

CREATE TRIGGER submissions_sync_trust_metrics
  AFTER INSERT OR UPDATE OF status, creator_id, quality_score, quality_score_backfilled OR DELETE
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_creator_trust_after_submission();

-- Rebuild incremental quality counters from explicit scores only.
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
    AND s.quality_score_backfilled = false
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

UPDATE public.creator_profiles cp
SET
  quality_score_sum = 0,
  scored_verified_count = 0,
  quality_score_counts = jsonb_build_object('score1', 0, 'score2', 0, 'score3', 0)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.submissions s
  WHERE s.creator_id = cp.id
    AND s.status IN ('verified', 'paid')
    AND s.quality_score IS NOT NULL
    AND s.quality_score_backfilled = false
);

DO $$
DECLARE
  v_creator_id uuid;
BEGIN
  FOR v_creator_id IN
    SELECT DISTINCT s.creator_id
    FROM public.submissions s
    WHERE s.creator_id IS NOT NULL
  LOOP
    PERFORM public.sync_creator_quality_metrics(v_creator_id);
    PERFORM public.sync_creator_explicit_quality_flag(v_creator_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_submission_creator_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_format text;
  v_min_trust integer;
  v_min_trust_number integer;
  v_min_avg_quality numeric;
  v_min_best_quality integer;
  v_min_earnings bigint;
  v_min_views bigint;
  v_creator_score integer;
  v_creator_trust_number integer;
  v_creator_avg_quality numeric;
  v_creator_best_quality integer;
  v_creator_earnings bigint;
  v_creator_views bigint;
  v_verified integer;
  v_rejected integer;
  v_apply_quality_gates boolean;
BEGIN
  SELECT
    c.contest_format,
    c.trust_score,
    c.trust_number,
    c.min_avg_quality_score,
    c.min_best_quality_score,
    c.min_platform_earnings,
    c.min_platform_views
  INTO
    v_format,
    v_min_trust,
    v_min_trust_number,
    v_min_avg_quality,
    v_min_best_quality,
    v_min_earnings,
    v_min_views
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  IF COALESCE(v_format, 'video') = 'text_image' THEN
    RETURN NEW;
  END IF;

  IF v_min_trust IS NULL AND v_min_trust_number IS NULL
     AND v_min_avg_quality IS NULL AND v_min_best_quality IS NULL
     AND v_min_earnings IS NULL AND v_min_views IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    (cp.trust_score_metrics->>'trust_score')::integer,
    (cp.trust_score_metrics->>'trust_number')::integer,
    cp.avg_quality_score,
    cp.best_quality_score,
    COALESCE(cp.total_money_won, 0)::bigint,
    COALESCE(cp.total_views, 0)::bigint,
    COALESCE(cp.has_explicit_quality_scores, false)
  INTO
    v_creator_score,
    v_creator_trust_number,
    v_creator_avg_quality,
    v_creator_best_quality,
    v_creator_earnings,
    v_creator_views,
    v_apply_quality_gates
  FROM public.creator_profiles cp
  WHERE cp.id = NEW.creator_id;

  IF v_creator_score IS NULL OR v_creator_trust_number IS NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer,
      COUNT(*) FILTER (WHERE s.status = 'rejected')::integer
    INTO v_verified, v_rejected
    FROM public.submissions s
    WHERE s.creator_id = NEW.creator_id;

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
     AND (v_min_avg_quality IS NOT NULL OR v_min_best_quality IS NOT NULL) THEN
    IF v_verified IS NULL OR v_rejected IS NULL THEN
      SELECT
        COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer,
        COUNT(*) FILTER (WHERE s.status = 'rejected')::integer
      INTO v_verified, v_rejected
      FROM public.submissions s
      WHERE s.creator_id = NEW.creator_id;
    END IF;

    IF COALESCE(v_verified, 0) > 0 THEN
      SELECT
        ROUND(AVG(s.quality_score)::numeric, 2),
        MAX(s.quality_score)::integer
      INTO v_creator_avg_quality, v_creator_best_quality
      FROM public.submissions s
      WHERE s.creator_id = NEW.creator_id
        AND s.status IN ('verified', 'paid')
        AND s.quality_score IS NOT NULL
        AND s.quality_score_backfilled = false;
    ELSIF COALESCE(v_rejected, 0) > 0 THEN
      v_creator_avg_quality := NULL;
      v_creator_best_quality := NULL;
    ELSE
      v_creator_avg_quality := 1;
      v_creator_best_quality := 1;
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

CREATE OR REPLACE FUNCTION public.enforce_verified_submission_quality_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public._submission_status_bucket(NEW.status::text) = 'verified' THEN
    IF NEW.quality_score IS NULL OR NEW.quality_score < 1 OR NEW.quality_score > 3 THEN
      RAISE EXCEPTION
        'verified_submission_requires_quality_score: verified/paid submissions require quality_score between 1 and 3'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_enforce_verified_quality_score ON public.submissions;

CREATE TRIGGER submissions_enforce_verified_quality_score
  BEFORE INSERT OR UPDATE OF status, quality_score
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_verified_submission_quality_score();
