-- Track processed inbound S3 objects (idempotent sync)

CREATE TABLE IF NOT EXISTS public.admin_email_inbound_processed (
  s3_key text NOT NULL,
  ses_message_id text,
  thread_id uuid REFERENCES public.admin_email_unibox_threads (id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_inbound_processed_pkey PRIMARY KEY (s3_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_inbound_processed_at
  ON public.admin_email_inbound_processed (processed_at DESC);

ALTER TABLE public.admin_email_inbound_processed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_email_inbound_processed_admin_all ON public.admin_email_inbound_processed;
CREATE POLICY admin_email_inbound_processed_admin_all ON public.admin_email_inbound_processed
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));
