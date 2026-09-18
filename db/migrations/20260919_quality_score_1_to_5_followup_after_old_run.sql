-- Follow-up ONLY for environments that already ran the OLD
-- 20260915_quality_score_scale_1_to_5.sql (scores already remapped +2).
--
-- Safe: does NOT remap quality scores again.
-- Does: (1) mark conversion complete, (2) patch eligibility fn to 1–5.
--
-- Run once in Supabase SQL Editor, then run the VERIFY queries at the bottom.

BEGIN;

CREATE TABLE IF NOT EXISTS public.quality_score_scale_1_to_5_migration_state (
  migration_name text PRIMARY KEY
    CHECK (migration_name = 'quality_score_scale_1_to_5'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.quality_score_scale_1_to_5_migration_state FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.contest_matches_creator_eligibility(
  p_contest_format text,
  p_trust_score integer,
  p_trust_number integer,
  p_min_avg_quality numeric,
  p_min_best_quality integer,
  p_min_quality integer,
  p_min_platform_earnings bigint,
  p_min_platform_views bigint,
  p_creator_trust_score_pct numeric,
  p_creator_trust_number integer,
  p_creator_avg_quality numeric,
  p_creator_best_quality integer,
  p_creator_quality_sum numeric,
  p_creator_earnings_cents bigint,
  p_creator_views bigint,
  p_creator_verified_reels integer,
  p_creator_has_explicit_quality boolean
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_min_trust integer;
  v_min_trust_number integer;
  v_min_avg numeric;
  v_min_best integer;
  v_min_quality integer;
  v_min_earnings bigint;
  v_min_views bigint;
  v_apply_quality boolean;
  v_trust_pct numeric := COALESCE(p_creator_trust_score_pct, 0);
  v_trust_number integer := COALESCE(p_creator_trust_number, 0);
  v_earnings bigint := COALESCE(p_creator_earnings_cents, 0);
  v_views bigint := COALESCE(p_creator_views, 0);
BEGIN
  IF COALESCE(p_contest_format, 'video') = 'text_image' THEN
    RETURN true;
  END IF;

  v_min_trust := CASE
    WHEN p_trust_score IS NOT NULL AND p_trust_score > 0 THEN p_trust_score
    ELSE NULL
  END;
  v_min_trust_number := p_trust_number;
  v_min_avg := CASE
    WHEN p_min_avg_quality IS NOT NULL
         AND p_min_avg_quality >= 1
         AND p_min_avg_quality <= 5
      THEN p_min_avg_quality
    ELSE NULL
  END;
  v_min_best := CASE
    WHEN p_min_best_quality IS NOT NULL
         AND p_min_best_quality >= 1
         AND p_min_best_quality <= 5
      THEN p_min_best_quality
    ELSE NULL
  END;
  v_min_quality := CASE
    WHEN p_min_quality IS NOT NULL AND p_min_quality > 0 THEN p_min_quality
    ELSE NULL
  END;
  v_min_earnings := CASE
    WHEN p_min_platform_earnings IS NOT NULL AND p_min_platform_earnings > 0
      THEN p_min_platform_earnings
    ELSE NULL
  END;
  v_min_views := CASE
    WHEN p_min_platform_views IS NOT NULL AND p_min_platform_views > 0
      THEN p_min_platform_views
    ELSE NULL
  END;

  IF v_min_trust IS NULL
     AND v_min_trust_number IS NULL
     AND v_min_avg IS NULL
     AND v_min_best IS NULL
     AND v_min_quality IS NULL
     AND v_min_earnings IS NULL
     AND v_min_views IS NULL THEN
    RETURN true;
  END IF;

  v_apply_quality :=
    COALESCE(p_creator_has_explicit_quality, false)
    OR COALESCE(p_creator_verified_reels, 0) = 0;

  IF v_min_trust IS NOT NULL AND v_trust_pct < v_min_trust THEN
    RETURN false;
  END IF;
  IF v_min_trust_number IS NOT NULL AND v_trust_number < v_min_trust_number THEN
    RETURN false;
  END IF;
  IF v_apply_quality AND v_min_best IS NOT NULL AND (
    p_creator_best_quality IS NULL OR p_creator_best_quality < v_min_best
  ) THEN
    RETURN false;
  END IF;
  IF v_apply_quality AND v_min_avg IS NOT NULL AND (
    p_creator_avg_quality IS NULL OR p_creator_avg_quality < v_min_avg
  ) THEN
    RETURN false;
  END IF;
  IF v_apply_quality AND v_min_quality IS NOT NULL AND (
    p_creator_quality_sum IS NULL OR p_creator_quality_sum < v_min_quality
  ) THEN
    RETURN false;
  END IF;
  IF v_min_earnings IS NOT NULL AND v_earnings < v_min_earnings THEN
    RETURN false;
  END IF;
  IF v_min_views IS NOT NULL AND v_views < v_min_views THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.contest_matches_creator_eligibility(
  text, integer, integer, numeric, integer, integer, bigint, bigint,
  numeric, integer, numeric, integer, numeric, bigint, bigint, integer, boolean
) IS
  'True when creator snapshot meets 1–5 quality and other contest gates (parity with isCreatorEligibleForContest).';

INSERT INTO public.quality_score_scale_1_to_5_migration_state (migration_name)
VALUES ('quality_score_scale_1_to_5')
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
