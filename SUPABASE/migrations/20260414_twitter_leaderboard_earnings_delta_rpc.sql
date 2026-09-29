-- Atomic read-modify-write for twitter_campaign_leaderboard.earnings (CPM aggregate from per-tweet pays/reversals).
-- Avoids lost updates when multiple tweets for the same creator are paid or reversed concurrently.

CREATE OR REPLACE FUNCTION public.add_twitter_leaderboard_cpm_earnings_delta(
  p_contest_id uuid,
  p_creator_id uuid,
  p_delta_cents integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new integer;
BEGIN
  IF p_delta_cents IS NULL OR p_delta_cents = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.twitter_campaign_leaderboard lb
  SET earnings = GREATEST(0, COALESCE(lb.earnings, 0) + p_delta_cents)
  WHERE lb.contest_id = p_contest_id
    AND lb.creator_id = p_creator_id
  RETURNING lb.earnings INTO v_new;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.add_twitter_leaderboard_cpm_earnings_delta(uuid, uuid, integer) IS
  'Atomically adds p_delta_cents to twitter_campaign_leaderboard.earnings (CPM running total). Negative delta for reversals; result floored at 0.';

REVOKE ALL ON FUNCTION public.add_twitter_leaderboard_cpm_earnings_delta(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_twitter_leaderboard_cpm_earnings_delta(uuid, uuid, integer) TO service_role;
