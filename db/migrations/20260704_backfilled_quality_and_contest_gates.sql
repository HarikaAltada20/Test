-- Backfilled-quality gate rules + server-side contest requirement validation.
-- Run after 20260703_backfill_quality_scores_and_reconcile.sql.
--
-- 1. Tracks whether a creator has verify-time quality scores (not migration backfill).
-- 2. Skips min avg/best quality campaign gates until at least one explicit score exists.
-- 3. Validates contest creator-requirement fields on insert/update (including brand direct writes).

CREATE OR REPLACE FUNCTION public.sync_creator_explicit_quality_flag(p_creator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_explicit boolean;
BEGIN
  IF p_creator_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.creator_id = p_creator_id
      AND s.status IN ('verified', 'paid')
      AND s.quality_score IS NOT NULL
      AND s.quality_score_backfilled = false
  )
  INTO v_has_explicit;

  UPDATE public.creator_profiles
  SET has_explicit_quality_scores = COALESCE(v_has_explicit, false)
  WHERE id = p_creator_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_submission_metrics_change(
  p_creator_id uuid,
  p_old_status public.submission_status_enum,
  p_old_quality integer,
  p_new_status public.submission_status_enum,
  p_new_quality integer
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
  FROM public._submission_quality_contribution(p_old_status::text, p_old_quality);
  SELECT * INTO v_new_q
  FROM public._submission_quality_contribution(p_new_status::text, p_new_quality);

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
    IF v_creator_avg_quality IS NULL OR v_creator_best_quality IS NULL THEN
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

CREATE OR REPLACE FUNCTION public.validate_contest_creator_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.contest_format, 'video') = 'text_image' THEN
    NEW.trust_score := NULL;
    NEW.trust_number := NULL;
    NEW.min_avg_quality_score := NULL;
    NEW.min_best_quality_score := NULL;
    NEW.min_quality_score := NULL;
    NEW.min_platform_earnings := NULL;
    NEW.min_platform_views := NULL;
    RETURN NEW;
  END IF;

  IF NEW.trust_score IS NOT NULL
     AND (NEW.trust_score < 0 OR NEW.trust_score > 100) THEN
    RAISE EXCEPTION 'trust_score must be between 0 and 100, or null'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.min_platform_earnings IS NOT NULL AND NEW.min_platform_earnings <= 0 THEN
    RAISE EXCEPTION 'min_platform_earnings must be a positive integer (cents), or null'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.min_platform_views IS NOT NULL AND NEW.min_platform_views <= 0 THEN
    RAISE EXCEPTION 'min_platform_views must be a positive integer, or null'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contests_validate_creator_requirements ON public.contests;

CREATE TRIGGER contests_validate_creator_requirements
  BEFORE INSERT OR UPDATE OF
    contest_format,
    trust_score,
    trust_number,
    min_avg_quality_score,
    min_best_quality_score,
    min_quality_score,
    min_platform_earnings,
    min_platform_views
  ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_contest_creator_requirements();

-- Backfill explicit-quality flag for all creators (historical scores are backfilled).
UPDATE public.creator_profiles
SET has_explicit_quality_scores = false;

DO $$
DECLARE
  v_profile_id uuid;
BEGIN
  FOR v_profile_id IN SELECT cp.id FROM public.creator_profiles cp
  LOOP
    PERFORM public.sync_creator_explicit_quality_flag(v_profile_id);
  END LOOP;
END $$;
