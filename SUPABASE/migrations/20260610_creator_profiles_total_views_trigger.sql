-- Keep creator_profiles.total_views in sync with submission_views_credited.
-- Application code should only upsert submission_views_credited; this trigger maintains the aggregate.

-- ============================================================================
-- 1. Recalculate helper (maintenance / one-off repairs)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_creator_total_views(p_creator_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH credited AS (
    SELECT COALESCE(SUM(svc.credited_views), 0)::bigint AS total
    FROM public.submissions s
    INNER JOIN public.submission_views_credited svc
      ON svc.submission_id = s.id
    WHERE s.creator_id = p_creator_id
      AND s.status <> 'rejected'
  )
  UPDATE public.creator_profiles cp
  SET total_views = credited.total
  FROM credited
  WHERE cp.id = p_creator_id
  RETURNING cp.total_views;
$$;

COMMENT ON FUNCTION public.recalculate_creator_total_views(uuid) IS
  'Recompute creator_profiles.total_views from submission_views_credited for one creator.';

-- ============================================================================
-- 2. Trigger: apply credited_views deltas atomically
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_creator_total_views_on_credited_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_delta bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT s.creator_id
    INTO v_creator_id
    FROM public.submissions s
    WHERE s.id = OLD.submission_id;

    IF v_creator_id IS NOT NULL AND COALESCE(OLD.credited_views, 0) <> 0 THEN
      UPDATE public.creator_profiles
      SET total_views = GREATEST(
        0,
        COALESCE(total_views, 0) - COALESCE(OLD.credited_views, 0)
      )
      WHERE id = v_creator_id;
    END IF;

    RETURN OLD;
  END IF;

  SELECT s.creator_id
  INTO v_creator_id
  FROM public.submissions s
  WHERE s.id = NEW.submission_id;

  IF v_creator_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_delta := COALESCE(NEW.credited_views, 0) - COALESCE(OLD.credited_views, 0);

  IF v_delta <> 0 THEN
    UPDATE public.creator_profiles
    SET total_views = GREATEST(0, COALESCE(total_views, 0) + v_delta)
    WHERE id = v_creator_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_creator_total_views_on_credited_change() IS
  'Incrementally updates creator_profiles.total_views when submission_views_credited rows change.';

DROP TRIGGER IF EXISTS on_submission_views_credited_update_creator_total_views
  ON public.submission_views_credited;

CREATE TRIGGER on_submission_views_credited_update_creator_total_views
  AFTER INSERT OR UPDATE OF credited_views OR DELETE
  ON public.submission_views_credited
  FOR EACH ROW
  EXECUTE FUNCTION public.update_creator_total_views_on_credited_change();

-- ============================================================================
-- 3. Backfill all creator_profiles.total_views from credited snapshots
-- ============================================================================

UPDATE public.creator_profiles cp
SET total_views = COALESCE(src.total_views, 0)
FROM (
  SELECT
    s.creator_id,
    SUM(svc.credited_views)::bigint AS total_views
  FROM public.submissions s
  INNER JOIN public.submission_views_credited svc
    ON svc.submission_id = s.id
  WHERE s.status <> 'rejected'
  GROUP BY s.creator_id
) src
WHERE cp.id = src.creator_id
  AND COALESCE(cp.total_views, 0) IS DISTINCT FROM COALESCE(src.total_views, 0);

-- Creators with no credited submissions should be zero
UPDATE public.creator_profiles cp
SET total_views = 0
WHERE COALESCE(cp.total_views, 0) <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.submissions s
    INNER JOIN public.submission_views_credited svc
      ON svc.submission_id = s.id
    WHERE s.creator_id = cp.id
      AND s.status <> 'rejected'
      AND COALESCE(svc.credited_views, 0) > 0
  );

-- ============================================================================
-- 4. Grants
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.recalculate_creator_total_views(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_creator_total_views_on_credited_change() TO service_role;
