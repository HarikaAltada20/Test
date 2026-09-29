-- Allow earnings-only repair of twitter_campaign_leaderboard after payouts_processed.
-- Additive per-tweet / bulk deltas can leave leaderboard.earnings higher than SUM(tweet.earnings).

CREATE OR REPLACE FUNCTION public.enforce_twitter_leaderboard_moderation_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked boolean;
  v_moderation_changed boolean;
BEGIN
  -- Opt-in skip for reconcile_twitter_leaderboard_cpm_earnings (session-local).
  IF current_setting('app.skip_twitter_leaderboard_moderation_lock', true) = '1' THEN
    RETURN NEW;
  END IF;

  v_moderation_changed :=
    OLD.moderation_status IS DISTINCT FROM NEW.moderation_status
    OR OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason
    OR COALESCE(OLD.earnings, 0) IS DISTINCT FROM COALESCE(NEW.earnings, 0)
    OR COALESCE(OLD.bonus_paid, false) IS DISTINCT FROM COALESCE(NEW.bonus_paid, false)
    OR COALESCE(OLD.bonus_amount, 0) IS DISTINCT FROM COALESCE(NEW.bonus_amount, 0);

  IF NOT v_moderation_changed THEN
    RETURN NEW;
  END IF;

  v_locked := public.contest_submission_moderation_locked(NEW.contest_id);
  IF v_locked THEN
    RAISE EXCEPTION
      'submission_moderation_locked: Submission status cannot be changed after payouts are processed. Contest is fully finalized.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_twitter_leaderboard_cpm_earnings(
  p_contest_id uuid,
  p_creator_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum integer;
BEGIN
  SELECT COALESCE(SUM(earnings), 0)::integer
  INTO v_sum
  FROM public.twitter_campaign_tweets
  WHERE contest_id = p_contest_id
    AND creator_id = p_creator_id
    AND moderation_status = 'paid';

  PERFORM set_config('app.skip_twitter_leaderboard_moderation_lock', '1', true);

  UPDATE public.twitter_campaign_leaderboard
  SET earnings = v_sum
  WHERE contest_id = p_contest_id
    AND creator_id = p_creator_id;

  RETURN v_sum;
END;
$$;

COMMENT ON FUNCTION public.reconcile_twitter_leaderboard_cpm_earnings(uuid, uuid) IS
  'Sets twitter_campaign_leaderboard.earnings = SUM(paid tweet earnings). Safe after payouts_processed.';

REVOKE ALL ON FUNCTION public.reconcile_twitter_leaderboard_cpm_earnings(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_twitter_leaderboard_cpm_earnings(uuid, uuid) TO service_role;
