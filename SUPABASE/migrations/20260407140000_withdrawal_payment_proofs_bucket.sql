-- Private bucket for admin-uploaded withdrawal payment proof files (images/videos).
-- API uses the service role to upload and to issue signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'withdrawal-payment-proofs',
  'withdrawal-payment-proofs',
  false
)
ON CONFLICT (id) DO UPDATE SET public = false;
