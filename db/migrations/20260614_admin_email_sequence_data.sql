-- Multi-step email sequence stored as JSON on campaign (UI + future drip sends)

ALTER TABLE public.admin_email_campaigns
  ADD COLUMN IF NOT EXISTS sequence_data jsonb;
