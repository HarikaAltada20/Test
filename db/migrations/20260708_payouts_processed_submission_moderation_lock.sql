-- Block submission / Twitter moderation and payout field changes after contest payouts_processed.
-- Complements API checks in verify-submission, moderate-submission, and moderate-creator.
--
-- DEPLOY: Run this migration and deploy app code in the same release window.
-- See docs/CAMPAIGN_OPTIMIZATION_DEPLOY.md § "Payout moderation lock (migration 10)".
-- App-only deploy leaves illegal DB updates possible; migration-only deploy may block
-- legitimate admin paths until the matching app is live.

CREATE OR REPLACE FUNCTION public.contest_submission_moderation_locked(p_contest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT c.post_contest_status = 'payouts_processed'::public.post_contest_status_enum
      FROM public.contests c
      WHERE c.id = p_contest_id
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_submission_moderation_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked boolean;
  v_moderation_changed boolean;
BEGIN
  v_moderation_changed :=
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.paid IS DISTINCT FROM NEW.paid
    OR OLD.paid_at IS DISTINCT FROM NEW.paid_at
    OR OLD.bonus_paid IS DISTINCT FROM NEW.bonus_paid
    OR OLD.bonus_paid_at IS DISTINCT FROM NEW.bonus_paid_at
    OR OLD.bonus_amount IS DISTINCT FROM NEW.bonus_amount
    OR OLD.earnings IS DISTINCT FROM NEW.earnings
    OR OLD.dual_rewards_payout IS DISTINCT FROM NEW.dual_rewards_payout;

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

DROP TRIGGER IF EXISTS submissions_enforce_moderation_lock ON public.submissions;

CREATE TRIGGER submissions_enforce_moderation_lock
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submission_moderation_lock();

CREATE OR REPLACE FUNCTION public.enforce_twitter_tweet_moderation_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked boolean;
  v_moderation_changed boolean;
BEGIN
  v_moderation_changed :=
    OLD.moderation_status IS DISTINCT FROM NEW.moderation_status
    OR OLD.manual_points_reason IS DISTINCT FROM NEW.manual_points_reason
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

DROP TRIGGER IF EXISTS twitter_campaign_tweets_enforce_moderation_lock ON public.twitter_campaign_tweets;

CREATE TRIGGER twitter_campaign_tweets_enforce_moderation_lock
  BEFORE UPDATE ON public.twitter_campaign_tweets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_twitter_tweet_moderation_lock();

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

DROP TRIGGER IF EXISTS twitter_campaign_leaderboard_enforce_moderation_lock ON public.twitter_campaign_leaderboard;

CREATE TRIGGER twitter_campaign_leaderboard_enforce_moderation_lock
  BEFORE UPDATE ON public.twitter_campaign_leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_twitter_leaderboard_moderation_lock();

COMMENT ON FUNCTION public.contest_submission_moderation_locked(uuid) IS
  'True when contests.post_contest_status is payouts_processed for the given contest.';
