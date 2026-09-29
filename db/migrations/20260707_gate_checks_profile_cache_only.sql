-- Gate checks use cached creator_profiles metrics (O(1) per submit).
-- Mirrors lib/creator-requirements.ts getCreatorRequirementsSnapshot().
-- Live submission scans removed; trust/quality counters are maintained by triggers.
--
-- Also clears any placeholder quality=1 backfill from an older migration 5 revision.

UPDATE public.submissions
SET quality_score = NULL, quality_score_backfilled = false
WHERE quality_score_backfilled = true;

-- Rebuild explicit-only quality caches after clearing placeholders.
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

UPDATE public.creator_profiles cp
SET has_explicit_quality_scores = EXISTS (
  SELECT 1
  FROM public.submissions s
  WHERE s.creator_id = cp.id
    AND s.status IN ('verified', 'paid')
    AND s.quality_score IS NOT NULL
    AND NOT COALESCE(s.quality_score_backfilled, false)
);

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
  v_min_quality integer;
  v_min_earnings bigint;
  v_min_views bigint;
  v_creator_score integer;
  v_creator_trust_number integer;
  v_creator_avg_quality numeric;
  v_creator_best_quality integer;
  v_creator_quality_sum numeric;
  v_creator_earnings bigint;
  v_creator_views bigint;
  v_verified integer;
  v_rejected integer;
  v_has_explicit boolean;
  v_profile_verified integer;
  v_profile_rejected integer;
  v_apply_quality_gates boolean;
BEGIN
  SELECT
    c.contest_format,
    c.trust_score,
    c.trust_number,
    c.min_avg_quality_score,
    c.min_best_quality_score,
    c.min_quality_score,
    c.min_platform_earnings,
    c.min_platform_views
  INTO
    v_format,
    v_min_trust,
    v_min_trust_number,
    v_min_avg_quality,
    v_min_best_quality,
    v_min_quality,
    v_min_earnings,
    v_min_views
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  IF COALESCE(v_format, 'video') = 'text_image' THEN
    RETURN NEW;
  END IF;

  IF v_min_trust IS NULL AND v_min_trust_number IS NULL
     AND v_min_avg_quality IS NULL AND v_min_best_quality IS NULL
     AND v_min_quality IS NULL
     AND v_min_earnings IS NULL AND v_min_views IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    (cp.trust_score_metrics->>'trust_score')::integer,
    (cp.trust_score_metrics->>'trust_number')::integer,
    cp.avg_quality_score,
    cp.best_quality_score,
    COALESCE(cp.quality_score_sum, 0),
    COALESCE(cp.total_money_won, 0)::bigint,
    COALESCE(cp.total_views, 0)::bigint,
    COALESCE(cp.has_explicit_quality_scores, false),
    COALESCE((cp.trust_score_metrics->>'verified_reels')::integer, 0),
    COALESCE((cp.trust_score_metrics->>'rejected_reels')::integer, 0)
  INTO
    v_creator_score,
    v_creator_trust_number,
    v_creator_avg_quality,
    v_creator_best_quality,
    v_creator_quality_sum,
    v_creator_earnings,
    v_creator_views,
    v_has_explicit,
    v_profile_verified,
    v_profile_rejected
  FROM public.creator_profiles cp
  WHERE cp.id = NEW.creator_id;

  v_apply_quality_gates := v_has_explicit OR v_profile_verified = 0;

  IF v_creator_score IS NULL OR v_creator_trust_number IS NULL THEN
    v_verified := v_profile_verified;
    v_rejected := v_profile_rejected;
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
     AND (v_min_avg_quality IS NOT NULL OR v_min_best_quality IS NOT NULL
          OR v_min_quality IS NOT NULL)
     AND v_profile_verified = 0 THEN
    IF COALESCE(v_profile_rejected, 0) > 0 THEN
      v_creator_avg_quality := NULL;
      v_creator_best_quality := NULL;
      v_creator_quality_sum := NULL;
    ELSE
      v_creator_avg_quality := 1;
      v_creator_best_quality := 1;
      v_creator_quality_sum := 1;
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

  IF v_apply_quality_gates AND v_min_quality IS NOT NULL AND (
    v_creator_quality_sum IS NULL OR v_creator_quality_sum < v_min_quality
  ) THEN
    RAISE EXCEPTION
      'min_quality_too_low: Creator total quality score (%) is below campaign minimum (%)',
      COALESCE(v_creator_quality_sum, 0), v_min_quality USING ERRCODE = 'check_violation';
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
