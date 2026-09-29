-- Inbound warm-up emails received by sender accounts (inbox placement)

CREATE TABLE IF NOT EXISTS public.admin_email_warm_up_received (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.admin_email_warm_up_accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.admin_email_projects (id) ON DELETE CASCADE,
  from_email text NOT NULL,
  ses_message_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_warm_up_received_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_received_account
  ON public.admin_email_warm_up_received (account_id, received_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_email_warm_up_received_ses_message_id
  ON public.admin_email_warm_up_received (ses_message_id)
  WHERE ses_message_id IS NOT NULL;
