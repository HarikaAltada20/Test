-- Byte size of uploaded payment proof file (set on upload; cleared when file removed)
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payment_proof_file_size_bytes bigint null;

COMMENT ON COLUMN public.withdrawal_requests.payment_proof_file_size_bytes IS 'Size in bytes of file in withdrawal-payment-proofs bucket; null if no file.';

DROP VIEW IF EXISTS public.admin_withdrawal_requests_list;

CREATE VIEW public.admin_withdrawal_requests_list AS
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
  u.username AS user_username
FROM public.withdrawal_requests wr
LEFT JOIN public.users u ON u.id = wr.user_id;
