-- Optional admin payment proof for withdrawal requests (file path in storage + optional public URL link)
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payment_proof_link text,
  ADD COLUMN IF NOT EXISTS payment_proof_storage_path text;

COMMENT ON COLUMN public.withdrawal_requests.payment_proof_link IS 'Optional URL to payment proof (e.g. external receipt).';
COMMENT ON COLUMN public.withdrawal_requests.payment_proof_storage_path IS 'Optional path in withdrawal-payment-proofs bucket.';

-- Flat list for admin sorting/filtering by user fields (service role / admin API only)
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
  u.full_name AS user_full_name,
  u.email AS user_email,
  u.username AS user_username
FROM public.withdrawal_requests wr
LEFT JOIN public.users u ON u.id = wr.user_id;

COMMENT ON VIEW public.admin_withdrawal_requests_list IS 'Admin: withdrawal rows with user columns for sorting/export.';
