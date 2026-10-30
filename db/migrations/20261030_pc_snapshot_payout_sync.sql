-- Keep post-campaign (PC) rows in step with payouts and moderation.
--
-- A PC row is a copy of a submission taken at "Sync from Submissions". Metric
-- refreshes only touch views/engagement, and payouts only write to
-- public.submissions, so status / paid / earnings / bonuses on the PC copy went
-- stale whenever a creator was paid after the sync. PC analytics (Total Payouts,
-- Effective CPM, Paid / Verified filters, creator earnings) then under-reported.
--
-- This trigger copies the payout and moderation fields from a submission to its
-- PC row whenever they change. Views and other metrics are never touched. The
-- existing PC rollup triggers on post_campaign_submission_metrics apply the
-- deltas to the analytics rollups.
--
-- The backfill at the end fixes rows that already drifted.
--
-- Safe to run more than once. Apply after 20261023_campaign_duplicate.sql.

CREATE OR REPLACE FUNCTION public.sync_pc_snapshot_from_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.post_campaign_submission_metrics pc
  SET
    status = NEW.status,
    paid = COALESCE(NEW.paid, false),
    paid_at = NEW.paid_at,
    earnings = NEW.earnings,
    bonus_paid = COALESCE(NEW.bonus_paid, false),
    bonus_paid_at = NEW.bonus_paid_at,
    bonus_amount = COALESCE(NEW.bonus_amount, 0),
    milestone_bonus_paid = NEW.milestone_bonus_paid,
    dual_rewards_payout = NEW.dual_rewards_payout,
    views_locked = NEW.views_locked,
    affiliate_paid = COALESCE(NEW.affiliate_paid, false),
    affiliate_metadata = NEW.affiliate_metadata,
    submission_updated_at = NEW.updated_at,
    updated_at = now()
  WHERE pc.submission_id = NEW.id
    AND (
      pc.status IS DISTINCT FROM NEW.status
      OR pc.paid IS DISTINCT FROM COALESCE(NEW.paid, false)
      OR pc.paid_at IS DISTINCT FROM NEW.paid_at
      OR pc.earnings IS DISTINCT FROM NEW.earnings
      OR pc.bonus_paid IS DISTINCT FROM COALESCE(NEW.bonus_paid, false)
      OR pc.bonus_paid_at IS DISTINCT FROM NEW.bonus_paid_at
      OR pc.bonus_amount IS DISTINCT FROM COALESCE(NEW.bonus_amount, 0)
      OR pc.milestone_bonus_paid IS DISTINCT FROM NEW.milestone_bonus_paid
      OR pc.dual_rewards_payout IS DISTINCT FROM NEW.dual_rewards_payout
      OR pc.views_locked IS DISTINCT FROM NEW.views_locked
      OR pc.affiliate_paid IS DISTINCT FROM COALESCE(NEW.affiliate_paid, false)
      OR pc.affiliate_metadata IS DISTINCT FROM NEW.affiliate_metadata
    );
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_pc_snapshot_from_submission() IS
  'Copies payout/moderation fields (never metrics) from a submission to its post-campaign row.';

DROP TRIGGER IF EXISTS submissions_sync_pc_snapshot ON public.submissions;

CREATE TRIGGER submissions_sync_pc_snapshot
  AFTER UPDATE OF
    status, paid, paid_at, earnings, bonus_paid, bonus_paid_at, bonus_amount,
    milestone_bonus_paid, dual_rewards_payout, views_locked, affiliate_paid,
    affiliate_metadata
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pc_snapshot_from_submission();

-- One-time backfill of rows that already drifted.
UPDATE public.post_campaign_submission_metrics pc
SET
  status = s.status,
  paid = COALESCE(s.paid, false),
  paid_at = s.paid_at,
  earnings = s.earnings,
  bonus_paid = COALESCE(s.bonus_paid, false),
  bonus_paid_at = s.bonus_paid_at,
  bonus_amount = COALESCE(s.bonus_amount, 0),
  milestone_bonus_paid = s.milestone_bonus_paid,
  dual_rewards_payout = s.dual_rewards_payout,
  views_locked = s.views_locked,
  affiliate_paid = COALESCE(s.affiliate_paid, false),
  affiliate_metadata = s.affiliate_metadata,
  submission_updated_at = s.updated_at,
  updated_at = now()
FROM public.submissions s
WHERE s.id = pc.submission_id
  AND (
    pc.status IS DISTINCT FROM s.status
    OR pc.paid IS DISTINCT FROM COALESCE(s.paid, false)
    OR pc.paid_at IS DISTINCT FROM s.paid_at
    OR pc.earnings IS DISTINCT FROM s.earnings
    OR pc.bonus_paid IS DISTINCT FROM COALESCE(s.bonus_paid, false)
    OR pc.bonus_paid_at IS DISTINCT FROM s.bonus_paid_at
    OR pc.bonus_amount IS DISTINCT FROM COALESCE(s.bonus_amount, 0)
    OR pc.milestone_bonus_paid IS DISTINCT FROM s.milestone_bonus_paid
    OR pc.dual_rewards_payout IS DISTINCT FROM s.dual_rewards_payout
    OR pc.views_locked IS DISTINCT FROM s.views_locked
    OR pc.affiliate_paid IS DISTINCT FROM COALESCE(s.affiliate_paid, false)
    OR pc.affiliate_metadata IS DISTINCT FROM s.affiliate_metadata
  );
