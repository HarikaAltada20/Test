-- Trust Score %: 100 − (rejected ÷ verified × 100)
-- Trust Number: verified_reels − rejected_reels
--  per-campaign minimum trust_number on contests.

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS trust_number integer NULL;

COMMENT ON COLUMN public.contests.trust_number IS 'Optional. NULL = no trust number requirement. Creator trust_number (verified − rejected) must be >= this value to submit.';

CREATE INDEX IF NOT EXISTS idx_contests_trust_number
  ON public.contests (trust_number)
  WHERE trust_number IS NOT NULL;

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
  IF p_creator_id IS NULL THEN
    RETURN;
  END IF;

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
    v_score := 100;
  ELSE
    v_score := GREATEST(
      0,
      LEAST(
        100,
        ROUND(100 - (v_rejected::numeric / v_verified::numeric) * 100)
      )
    )::integer;
  END IF;

  UPDATE public.creator_profiles
  SET trust_score_metrics = jsonb_build_object(
    'trust_score', v_score,
    'trust_number', v_trust_number,
    'total_reels', COALESCE(v_total, 0),
    'verified_reels', COALESCE(v_verified, 0),
    'rejected_reels', COALESCE(v_rejected, 0),
    'pending_reels', COALESCE(v_pending, 0),
    'updated_at', now()
  )
  WHERE id = p_creator_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_submission_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_trust integer;
  v_min_trust_number integer;
  v_format text;
  v_creator_score integer;
  v_creator_trust_number integer;
  v_verified integer;
  v_rejected integer;
BEGIN
  SELECT c.trust_score, c.trust_number, c.contest_format
  INTO v_min_trust, v_min_trust_number, v_format
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  IF COALESCE(v_format, 'video') = 'text_image' THEN
    RETURN NEW;
  END IF;

  IF (v_min_trust IS NULL OR v_min_trust <= 0)
     AND v_min_trust_number IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    (cp.trust_score_metrics->>'trust_score')::integer,
    (cp.trust_score_metrics->>'trust_number')::integer
  INTO v_creator_score, v_creator_trust_number
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
      v_creator_score := 100;
    ELSE
      v_creator_score := GREATEST(
        0,
        LEAST(
          100,
          ROUND(100 - (v_rejected::numeric / v_verified::numeric) * 100)
        )
      )::integer;
    END IF;
  END IF;

  IF v_min_trust IS NOT NULL AND v_min_trust > 0
     AND v_creator_score < v_min_trust THEN
    RAISE EXCEPTION
      'trust_score_too_low: Creator trust score (%) is below campaign minimum (%)',
      v_creator_score,
      v_min_trust
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_trust_number IS NOT NULL
     AND v_creator_trust_number < v_min_trust_number THEN
    RAISE EXCEPTION
      'trust_number_too_low: Creator trust number (%) is below campaign minimum (%)',
      v_creator_trust_number,
      v_min_trust_number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Recompute all creator trust metrics with the new formula and trust_number.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.creator_profiles LOOP
    PERFORM public.sync_creator_trust_score_metrics(r.id);
  END LOOP;
END $$;
