-- Bulk sync submission_views_credited for a contest (pending, verified, paid).
-- Used when post_contest_status → verification_complete or payouts_processed, and admin repair.

CREATE OR REPLACE FUNCTION public.sync_contest_submission_views_credited(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_rejected integer := 0;
  v_upserted integer := 0;
BEGIN
  IF p_contest_id IS NULL THEN
    RAISE EXCEPTION 'contest_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.contests c WHERE c.id = p_contest_id) THEN
    RAISE EXCEPTION 'contest not found';
  END IF;

  WITH deleted AS (
    DELETE FROM public.submission_views_credited svc
    USING public.submissions s
    WHERE s.id = svc.submission_id
      AND s.contest_id = p_contest_id
      AND s.status = 'rejected'
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_deleted_rejected FROM deleted;

  WITH upserted AS (
    INSERT INTO public.submission_views_credited (submission_id, credited_views, credited_at)
    SELECT
      s.id,
      GREATEST(COALESCE(s.views, 0), 0)::bigint,
      NOW()
    FROM public.submissions s
    WHERE s.contest_id = p_contest_id
      AND s.status IN ('pending', 'verified', 'paid')
    ON CONFLICT (submission_id) DO UPDATE
    SET
      credited_views = EXCLUDED.credited_views,
      credited_at = EXCLUDED.credited_at
    WHERE submission_views_credited.credited_views IS DISTINCT FROM EXCLUDED.credited_views
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_upserted FROM upserted;

  RETURN jsonb_build_object(
    'contest_id', p_contest_id,
    'deleted_rejected_credits', v_deleted_rejected,
    'upserted_or_updated', v_upserted
  );
END;
$$;

COMMENT ON FUNCTION public.sync_contest_submission_views_credited(uuid) IS
  'Sync submission_views_credited from submissions.views for pending/verified/paid rows in a contest; remove credits for rejected.';

GRANT EXECUTE ON FUNCTION public.sync_contest_submission_views_credited(uuid) TO service_role;
