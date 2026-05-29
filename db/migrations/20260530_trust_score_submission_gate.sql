-- Enforce video-campaign minimum trust score on submission insert (server-side).

CREATE OR REPLACE FUNCTION public.enforce_submission_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_trust integer;
  v_format text;
  v_creator_score integer;
  v_total integer;
  v_rejected integer;
BEGIN
  SELECT c.trust_score, c.contest_format
  INTO v_min_trust, v_format
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  -- Trust gate applies to video campaigns only (text_image = Twitter-style).
  IF COALESCE(v_format, 'video') = 'text_image' THEN
    RETURN NEW;
  END IF;

  IF v_min_trust IS NULL OR v_min_trust <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT (cp.trust_score_metrics->>'trust_score')::integer
  INTO v_creator_score
  FROM public.creator_profiles cp
  WHERE cp.id = NEW.creator_id;

  IF v_creator_score IS NULL THEN
    SELECT
      COUNT(*)::integer,
      COUNT(*) FILTER (WHERE s.status = 'rejected')::integer
    INTO v_total, v_rejected
    FROM public.submissions s
    WHERE s.creator_id = NEW.creator_id;

    IF COALESCE(v_total, 0) = 0 THEN
      v_creator_score := 100;
    ELSE
      v_creator_score := GREATEST(
        0,
        LEAST(
          100,
          ROUND(100 - (v_rejected::numeric / v_total::numeric) * 100)
        )
      )::integer;
    END IF;
  END IF;

  IF v_creator_score < v_min_trust THEN
    RAISE EXCEPTION
      'trust_score_too_low: Creator trust score (%) is below campaign minimum (%)',
      v_creator_score,
      v_min_trust
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_enforce_trust_score ON public.submissions;

CREATE TRIGGER submissions_enforce_trust_score
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submission_trust_score();
