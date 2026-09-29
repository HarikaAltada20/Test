-- Constrain withdrawal_requests.status to allowed values only.
-- Invalid existing values (e.g. typos or test data) are set to 'failed' before adding the constraint.

-- 1. Normalize invalid statuses to 'failed' (no refund; safe fallback for bad data)
UPDATE public.withdrawal_requests
SET status = 'failed',
    updated_at = COALESCE(updated_at, NOW())
WHERE status IS NULL
   OR status NOT IN (
     'pending',
     'in_review',
     'approved',
     'processed',
     'rejected',
     'cancelled',
     'failed',
     'forfeited'
   );

-- 2. Add CHECK constraint so only these values are allowed
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_status_check
  CHECK (status IN (
    'pending',
    'in_review',
    'approved',
    'processed',
    'rejected',
    'cancelled',
    'failed',
    'forfeited'
  ));

COMMENT ON COLUMN public.withdrawal_requests.status IS 'Current status of the withdrawal request. Allowed: pending, in_review, approved, processed, rejected, cancelled, failed, forfeited.';
