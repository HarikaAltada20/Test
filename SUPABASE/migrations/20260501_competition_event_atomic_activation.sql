-- Ensure a single active competition event and provide atomic activation helper.

-- If historical data has multiple active rows, keep the latest by starts_at and deactivate the rest.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      ORDER BY starts_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.competition_event
  WHERE is_active = true
)
UPDATE public.competition_event ce
SET is_active = false, updated_at = now()
FROM ranked r
WHERE ce.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS competition_event_single_active_idx
ON public.competition_event (is_active)
WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.competition_set_sole_active(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'p_event_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.competition_event WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'competition event not found: %', p_event_id;
  END IF;

  -- Serialize active-event flips to avoid transient unique-index conflicts
  -- when multiple admins activate different events concurrently.
  PERFORM pg_advisory_xact_lock(hashtext('competition_set_sole_active'));

  UPDATE public.competition_event
  SET is_active = false, updated_at = now()
  WHERE is_active = true
    AND id <> p_event_id;

  UPDATE public.competition_event
  SET is_active = true, updated_at = now()
  WHERE id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.competition_set_sole_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.competition_set_sole_active(uuid) TO service_role;
