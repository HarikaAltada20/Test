ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS dual_rewards_payout jsonb;

COMMENT ON COLUMN public.submissions.dual_rewards_payout IS
  'Dual-rewards contests: JSON with cpm_cents, milestone_cents, and when set from admin pay: type, timestamp, updatedBy, customRemarks. Null when not applicable.';

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_dual_rewards_payout_shape;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_dual_rewards_payout_shape CHECK (
    dual_rewards_payout IS NULL
    OR jsonb_typeof(dual_rewards_payout) = 'object'
  );
