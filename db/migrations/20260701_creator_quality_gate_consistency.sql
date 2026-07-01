-- Fix app/DB quality gate consistency for creators without cached profile metrics.
-- Safe to run after 20260630_quality_score_and_creator_requirements.sql.

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
    COALESCE(cp.total_views, 0)::bigint
  INTO
    v_creator_score,
    v_creator_trust_number,
    v_creator_avg_quality,
    v_creator_best_quality,
    v_creator_earnings,
    v_creator_views
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

  IF v_min_avg_quality IS NOT NULL OR v_min_best_quality IS NOT NULL THEN
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
          AND s.quality_score IS NOT NULL;
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

  IF v_min_best_quality IS NOT NULL AND (
    v_creator_best_quality IS NULL OR v_creator_best_quality < v_min_best_quality
  ) THEN
    RAISE EXCEPTION
      'best_quality_too_low: Creator best quality (%) is below campaign minimum (%)',
      COALESCE(v_creator_best_quality, 0), v_min_best_quality USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_avg_quality IS NOT NULL AND (
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

CREATE OR REPLACE FUNCTION public.init_creator_profile_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_creator_trust_score_metrics(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_profiles_init_metrics ON public.creator_profiles;

CREATE TRIGGER creator_profiles_init_metrics
  AFTER INSERT ON public.creator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.init_creator_profile_metrics();

-- Profiles that should default to 1/1 but were never synced.
UPDATE public.creator_profiles cp
SET
  avg_quality_score = 1,
  best_quality_score = 1
WHERE cp.avg_quality_score IS NULL
  AND cp.best_quality_score IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.creator_id = cp.id
      AND s.status = 'rejected'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.creator_id = cp.id
      AND s.status IN ('verified', 'paid')
  );
