-- Daily Challenge refresh cooldown using a shared event-level timestamp
-- (same model as contests.last_metrics_updated).

-- Cleanup prior per-user model (safe if not present).
DROP FUNCTION IF EXISTS public.daily_challenge_consume_refresh(uuid, integer, text);
DROP TABLE IF EXISTS public.daily_challenge_refresh_control;

ALTER TABLE public.competition_event
  ADD COLUMN IF NOT EXISTS leaderboard_last_refreshed_at timestamptz;

COMMENT ON COLUMN public.competition_event.leaderboard_last_refreshed_at IS
  'Last time Daily Challenge leaderboard refresh was accepted for this event.';

CREATE OR REPLACE FUNCTION public.competition_consume_leaderboard_refresh(
  p_event_id uuid,
  p_cooldown_ms integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_last timestamptz;
  v_next timestamptz;
  v_remaining_ms bigint;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'p_event_id is required';
  END IF;

  IF p_cooldown_ms IS NULL OR p_cooldown_ms < 0 THEN
    RAISE EXCEPTION 'p_cooldown_ms must be >= 0';
  END IF;

  -- Per-event lock to make check + update atomic under concurrency.
  PERFORM pg_advisory_xact_lock(
    hashtext('competition_leaderboard_refresh'),
    hashtext(p_event_id::text)
  );

  SELECT leaderboard_last_refreshed_at
  INTO v_last
  FROM public.competition_event
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'competition event not found: %', p_event_id;
  END IF;

  IF v_last IS NOT NULL THEN
    v_next := v_last + (p_cooldown_ms::text || ' milliseconds')::interval;
    IF v_next > v_now THEN
      v_remaining_ms := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_next - v_now)) * 1000))::bigint;
      RETURN json_build_object(
        'allowed', false,
        'last_refreshed_at', v_last,
        'next_refresh_available_at', v_next,
        'remaining_ms', v_remaining_ms
      );
    END IF;
  END IF;

  UPDATE public.competition_event
  SET
    leaderboard_last_refreshed_at = v_now,
    updated_at = now()
  WHERE id = p_event_id;

  RETURN json_build_object(
    'allowed', true,
    'last_refreshed_at', v_now,
    'next_refresh_available_at', v_now + (p_cooldown_ms::text || ' milliseconds')::interval,
    'remaining_ms', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.competition_consume_leaderboard_refresh(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.competition_consume_leaderboard_refresh(uuid, integer) TO service_role;
