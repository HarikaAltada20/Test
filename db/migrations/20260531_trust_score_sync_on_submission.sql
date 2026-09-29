-- Recompute creator_profiles.trust_score_metrics when submissions change (insert / status update).

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

  IF COALESCE(v_total, 0) = 0 THEN
    v_score := 100;
  ELSE
    v_score := GREATEST(
      0,
      LEAST(
        100,
        ROUND(100 - (v_rejected::numeric / v_total::numeric) * 100)
      )
    )::integer;
  END IF;

  UPDATE public.creator_profiles
  SET trust_score_metrics = jsonb_build_object(
    'trust_score', v_score,
    'total_reels', COALESCE(v_total, 0),
    'verified_reels', COALESCE(v_verified, 0),
    'rejected_reels', COALESCE(v_rejected, 0),
    'pending_reels', COALESCE(v_pending, 0),
    'updated_at', now()
  )
  WHERE id = p_creator_id;
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
      PERFORM public.sync_creator_trust_score_metrics(OLD.creator_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.creator_id IS NOT NULL THEN
    PERFORM public.sync_creator_trust_score_metrics(NEW.creator_id);
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.creator_id IS DISTINCT FROM NEW.creator_id
    AND OLD.creator_id IS NOT NULL THEN
    PERFORM public.sync_creator_trust_score_metrics(OLD.creator_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_sync_trust_metrics ON public.submissions;

CREATE TRIGGER submissions_sync_trust_metrics
  AFTER INSERT OR UPDATE OF status, creator_id OR DELETE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_creator_trust_after_submission();

-- Gate check: always use live submission counts (not stale cached profile score).
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

  IF COALESCE(v_format, 'video') = 'text_image' THEN
    RETURN NEW;
  END IF;

  IF v_min_trust IS NULL OR v_min_trust <= 0 THEN
    RETURN NEW;
  END IF;

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
