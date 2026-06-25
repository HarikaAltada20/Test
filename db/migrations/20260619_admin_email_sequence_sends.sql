-- Multi-step email sequence execution: per-step sends and recipient progress

ALTER TABLE public.admin_email_campaign_recipients
  ADD COLUMN IF NOT EXISTS current_step_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_email_scheduled_at timestamptz;

ALTER TABLE public.admin_email_campaign_recipients
  DROP CONSTRAINT IF EXISTS admin_email_campaign_recipients_status_check;

ALTER TABLE public.admin_email_campaign_recipients
  ADD CONSTRAINT admin_email_campaign_recipients_status_check
  CHECK (email_delivery_status IN (
    'pending',
    'in_sequence',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'skipped',
    'failed'
  ));

CREATE TABLE IF NOT EXISTS public.admin_email_sequence_step_sends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.admin_email_campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  step_id uuid NOT NULL,
  variant_id uuid,
  tracking_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ses_message_id text,
  email_delivery_status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_sequence_step_sends_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_sequence_step_sends_unique UNIQUE (campaign_id, user_id, step_number),
  CONSTRAINT admin_email_sequence_step_sends_status_check
    CHECK (email_delivery_status IN (
      'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
    ))
);

CREATE INDEX IF NOT EXISTS idx_admin_email_sequence_step_sends_campaign
  ON public.admin_email_sequence_step_sends (campaign_id, step_number);

CREATE INDEX IF NOT EXISTS idx_admin_email_sequence_step_sends_variant
  ON public.admin_email_sequence_step_sends (campaign_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_sequence
  ON public.admin_email_campaign_recipients (campaign_id, email_delivery_status, next_email_scheduled_at);

ALTER TABLE public.admin_email_tracking
  ADD COLUMN IF NOT EXISTS step_number integer NOT NULL DEFAULT 1;

ALTER TABLE public.admin_email_tracking
  DROP CONSTRAINT IF EXISTS admin_email_tracking_campaign_user_unique;

CREATE UNIQUE INDEX IF NOT EXISTS admin_email_tracking_campaign_user_step_unique
  ON public.admin_email_tracking (campaign_id, user_id, step_number);

ALTER TABLE public.admin_email_sequence_step_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_email_sequence_step_sends_admin_all
  ON public.admin_email_sequence_step_sends;
CREATE POLICY admin_email_sequence_step_sends_admin_all
  ON public.admin_email_sequence_step_sends
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));
