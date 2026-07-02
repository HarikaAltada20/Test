-- Incremental creator trust + quality metrics (O(1) per submission change).
-- Replaces full-table COUNT/AVG scans in the submission sync trigger.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS quality_score_sum numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scored_verified_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score_counts jsonb NOT NULL DEFAULT jsonb_build_object(
    'score1', 0,
    'score2', 0,
    'score3', 0
  );

COMMENT ON COLUMN public.creator_profiles.quality_score_sum IS 'Sum of quality_score values on verified/paid submissions (incremental cache).';
COMMENT ON COLUMN public.creator_profiles.scored_verified_count IS 'Count of verified/paid submissions with a quality_score (incremental cache).';
COMMENT ON COLUMN public.creator_profiles.quality_score_counts IS 'Tier counts for quality scores 1–3 on verified/paid submissions (incremental cache).';

CREATE OR REPLACE FUNCTION public._submission_status_bucket(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_status, '')) IN ('verified', 'paid') THEN 'verified'
    WHEN lower(coalesce(p_status, '')) = 'rejected' THEN 'rejected'
    WHEN lower(coalesce(p_status, '')) = 'pending' THEN 'pending'
    ELSE 'other'
  END;
$$;

CREATE OR REPLACE FUNCTION public._submission_quality_contribution(
  p_status text,
  p_quality integer
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
      AND s.quality_score IS NOT NULL;

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

CREATE OR REPLACE FUNCTION public.sync_creator_trust_score_metrics(p_creator_id uuid)
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
  v_score integer;
  v_trust_number integer;
BEGIN
  IF p_creator_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::integer,
    COUNT(*) FILTER (WHERE s.status = 'pending')::integer
  INTO v_total, v_verified, v_rejected, v_pending
  FROM public.submissions s
  WHERE s.creator_id = p_creator_id;

  v_trust_number := COALESCE(v_verified, 0) - COALESCE(v_rejected, 0);

  IF COALESCE(v_verified, 0) = 0 THEN
    IF COALESCE(v_rejected, 0) > 0 THEN
      v_score := 0;
    ELSE
      v_score := 100;
    END IF;
  ELSE
    v_score := GREATEST(
      0,
      LEAST(
        100,
        ROUND((v_trust_number::numeric / v_verified::numeric) * 100)
      )
    )::integer;
  END IF;

  UPDATE public.creator_profiles
  SET
    trust_score_metrics = jsonb_build_object(
      'trust_score', v_score,
      'trust_number', v_trust_number,
      'total_reels', COALESCE(v_total, 0),
      'verified_reels', COALESCE(v_verified, 0),
      'rejected_reels', COALESCE(v_rejected, 0),
      'pending_reels', COALESCE(v_pending, 0),
      'updated_at', now()
    )
  WHERE id = p_creator_id;

  PERFORM public.sync_creator_quality_metrics(p_creator_id);
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
        NULL
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
        NEW.quality_score
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
        NULL
      );
    END IF;
    IF NEW.creator_id IS NOT NULL THEN
      PERFORM public.apply_submission_metrics_change(
        NEW.creator_id,
        NULL,
        NULL,
        NEW.status,
        NEW.quality_score
      );
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.quality_score IS DISTINCT FROM NEW.quality_score THEN
    PERFORM public.apply_submission_metrics_change(
      NEW.creator_id,
      OLD.status,
      OLD.quality_score,
      NEW.status,
      NEW.quality_score
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_sync_trust_metrics ON public.submissions;

CREATE TRIGGER submissions_sync_trust_metrics
  AFTER INSERT OR UPDATE OF status, creator_id, quality_score OR DELETE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_creator_trust_after_submission();

-- Backfill incremental quality counters from submissions (set-based; avoids
-- re-running full per-profile sync already done in 20260630).
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
  quality_score_sum = scored.quality_sum,
  scored_verified_count = scored.scored_count,
  quality_score_counts = jsonb_build_object(
    'score1', scored.score1,
    'score2', scored.score2,
    'score3', scored.score3
  )
FROM scored
WHERE cp.id = scored.creator_id;
