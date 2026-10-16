-- Structured payout record on each withdrawal (Skydo payout ID, UTR, amounts, credit date).
--
--   1. withdrawal_requests.payout_details jsonb (NULL until a payout is recorded).
--      Owners can't edit it: withdrawal_requests_guard_user_update locks every column
--      that isn't on its allow-list, including new ones.
--   2. Index on payout_details->>'payout_id' so re-imports can spot payouts already recorded.
--   3. admin_withdrawal_requests_list: appends payout_details (end of the column list,
--      as CREATE OR REPLACE VIEW requires).
--   4. admin_record_withdrawal_payout(): saves payout_details and, when asked, marks the
--      request paid through the existing admin_set_withdrawal_status, in one transaction.
--
-- admin_notes is not touched by any of this.
-- Safe to re-run.
--
-- ROLLBACK: drop admin_record_withdrawal_payout, re-run section 5 of
-- 20261014150000_payout_fees_and_fx.sql, then drop the index and the column.

-- 1. Column --------------------------------------------------------------------------

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_details jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_payout_details_object_check'
  ) THEN
    ALTER TABLE public.withdrawal_requests
      ADD CONSTRAINT withdrawal_requests_payout_details_object_check
      CHECK (payout_details IS NULL OR jsonb_typeof(payout_details) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.withdrawal_requests.payout_details IS
  'Payout record set by admins, e.g. {"provider":"skydo","payout_id":"pout_…","utr":"…","payout_amount_usd":14.1,"amount_settled_inr":1331.47,"date_of_credit":"2026-10-16",…}. A Skydo payout covering several requests is stored on each of them.';

-- 2. Lookup by payout ID ---------------------------------------------------------------

CREATE INDEX IF NOT EXISTS withdrawal_requests_payout_id_idx
  ON public.withdrawal_requests ((payout_details->>'payout_id'))
  WHERE payout_details IS NOT NULL;

-- 3. Admin list view: append payout_details --------------------------------------------

CREATE OR REPLACE VIEW public.admin_withdrawal_requests_list AS
SELECT
  wr.id,
  wr.user_id,
  wr.payout_method_id,
  wr.amount,
  wr.currency,
  wr.status,
  wr.processed_at,
  wr.transaction_reference,
  wr.admin_notes,
  wr.user_notes,
  wr.created_at,
  wr.updated_at,
  wr.amount_type,
  wr.payout_method_type_snapshot,
  wr.payout_method_details_snapshot,
  wr.cancelled_at,
  wr.cancellation_reason,
  wr.redeemed_item_description,
  wr.payment_proof_link,
  wr.payment_proof_storage_path,
  wr.payment_proof_file_size_bytes,
  u.full_name AS user_full_name,
  u.email AS user_email,
  u.username AS user_username,
  wr.fee_bps,
  wr.fee_cents,
  wr.net_amount_cents,
  wr.payout_currency,
  wr.fx_rate_snapshot,
  wr.net_amount_local_minor,
  u.user_type AS user_type,
  wr.payout_details
FROM public.withdrawal_requests wr
LEFT JOIN public.users u ON u.id = wr.user_id;

-- 4. Record a payout (and optionally mark paid) -----------------------------------------

CREATE OR REPLACE FUNCTION public.admin_record_withdrawal_payout(
  p_request_id uuid,
  p_payout_details jsonb,
  p_transaction_reference text DEFAULT NULL,
  p_mark_paid boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_payout_details IS NULL OR jsonb_typeof(p_payout_details) <> 'object' THEN
    RAISE EXCEPTION 'payout_details must be a JSON object';
  END IF;

  SELECT status INTO v_status
  FROM public.withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  -- Marking paid only ever moves an approved request; anything else is left alone so a
  -- double click or a second admin can't pay twice.
  IF p_mark_paid AND v_status <> 'approved' THEN
    RAISE EXCEPTION 'Request is %; only approved requests can be marked paid', v_status;
  END IF;

  UPDATE public.withdrawal_requests
  SET payout_details = p_payout_details,
      updated_at = NOW()
  WHERE id = p_request_id;

  IF p_mark_paid THEN
    -- Same path as the Mark Paid button: paid time, money_transactions status, UTR.
    PERFORM public.admin_set_withdrawal_status(
      p_request_id, 'processed', NULLIF(btrim(p_transaction_reference), ''), NULL, NULL
    );
    RETURN 'processed';
  END IF;

  IF p_transaction_reference IS NOT NULL AND btrim(p_transaction_reference) <> '' THEN
    UPDATE public.withdrawal_requests
    SET transaction_reference = left(btrim(p_transaction_reference), 500)
    WHERE id = p_request_id;
  END IF;

  RETURN v_status;
END;
$$;

COMMENT ON FUNCTION public.admin_record_withdrawal_payout(uuid, jsonb, text, boolean) IS
  'Admin: save payout_details on a withdrawal and optionally mark it paid (approved only), atomically.';

REVOKE ALL ON FUNCTION public.admin_record_withdrawal_payout(uuid, jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_withdrawal_payout(uuid, jsonb, text, boolean) TO service_role;
