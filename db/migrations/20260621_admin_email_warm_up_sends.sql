-- Individual warm-up email send records (for tracking opens, clicks, bounces)

CREATE TABLE IF NOT EXISTS public.admin_email_warm_up_sends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.admin_email_warm_up_accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.admin_email_projects (id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_first_name text,
  template_id uuid REFERENCES public.admin_email_warm_up_templates (id) ON DELETE SET NULL,
  subject text NOT NULL,
  body text NOT NULL,
  message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  is_delivered boolean NOT NULL DEFAULT false,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  is_bounced boolean NOT NULL DEFAULT false,
  is_complained boolean NOT NULL DEFAULT false,
  bounce_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_warm_up_sends_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_sends_account
  ON public.admin_email_warm_up_sends (account_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_sends_message_id
  ON public.admin_email_warm_up_sends (message_id)
  WHERE message_id IS NOT NULL;

-- Daily metrics rollup per sender account
CREATE TABLE IF NOT EXISTS public.admin_email_warm_up_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.admin_email_warm_up_accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.admin_email_projects (id) ON DELETE CASCADE,
  date date NOT NULL,
  sends_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  bounced_count integer NOT NULL DEFAULT 0,
  complained_count integer NOT NULL DEFAULT 0,
  health_score integer NOT NULL DEFAULT 0,
  stage public.admin_email_warm_up_stage_enum NOT NULL DEFAULT 'foundation',
  stage_progression_triggered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_warm_up_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_warm_up_metrics_account_date_unique UNIQUE (account_id, date)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_metrics_account
  ON public.admin_email_warm_up_metrics (account_id, date DESC);
