-- Remove credited view snapshots when submissions are rejected (or reverted from verified/paid to pending).
-- Keeps creator_profiles.total_views accurate via the submission_views_credited trigger.

-- ============================================================================
-- 1. Harden recalculate helper: never count rejected submissions
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

-- ============================================================================
-- 2. DB trigger: auto-delete credited row on reject / verification revert
-- ============================================================================

CREATE OR REPLACE FUNCTION public.uncredit_submission_views_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    (NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected')
    OR (
      NEW.status = 'pending'
      AND OLD.status IN ('verified', 'paid')
    )
  ) THEN
    DELETE FROM public.submission_views_credited
    WHERE submission_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.uncredit_submission_views_on_status_change() IS
  'Deletes submission_views_credited when a submission is rejected or reverted from verified/paid to pending.';

DROP TRIGGER IF EXISTS on_submission_status_uncredit_views
  ON public.submissions;

CREATE TRIGGER on_submission_status_uncredit_views
  AFTER UPDATE OF status
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.uncredit_submission_views_on_status_change();

GRANT EXECUTE ON FUNCTION public.uncredit_submission_views_on_status_change() TO service_role;

-- ============================================================================
-- 3. One-time cleanup: remove stale credits for already-rejected submissions
-- ============================================================================

DELETE FROM public.submission_views_credited svc
USING public.submissions s
WHERE s.id = svc.submission_id
  AND s.status = 'rejected';

-- Reconcile creator_profiles.total_views after cleanup (idempotent)
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
