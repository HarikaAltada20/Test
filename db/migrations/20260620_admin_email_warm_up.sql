-- Admin email warm-up accounts (sender reputation building)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_email_warm_up_status_enum') THEN
    CREATE TYPE public.admin_email_warm_up_status_enum AS ENUM (
      'pending',
      'active',
      'paused',
      'completed',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_email_warm_up_stage_enum') THEN
    CREATE TYPE public.admin_email_warm_up_stage_enum AS ENUM (
      'foundation',
      'growth',
      'expansion',
      'ready'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_email_warm_up_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.admin_email_projects (id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.admin_email_project_senders (id) ON DELETE SET NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  warm_up_status public.admin_email_warm_up_status_enum NOT NULL DEFAULT 'pending',
  current_stage public.admin_email_warm_up_stage_enum NOT NULL DEFAULT 'foundation',
  daily_limit integer NOT NULL DEFAULT 10,
  emails_sent_today integer NOT NULL DEFAULT 0,
  total_emails_sent integer NOT NULL DEFAULT 0,
  campaign_daily_limit integer NOT NULL DEFAULT 30,
  campaign_sent_today integer NOT NULL DEFAULT 0,
  current_health_score integer NOT NULL DEFAULT 0,
  best_health_score integer NOT NULL DEFAULT 0,
  is_ready_for_sending boolean NOT NULL DEFAULT false,
  start_date timestamptz,
  target_completion_date timestamptz,
  last_send_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_warm_up_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_warm_up_accounts_project_email_unique UNIQUE (project_id, email),
  CONSTRAINT admin_email_warm_up_accounts_health_score_check
    CHECK (current_health_score >= 0 AND current_health_score <= 100),
  CONSTRAINT admin_email_warm_up_accounts_best_health_score_check
    CHECK (best_health_score >= 0 AND best_health_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_accounts_project
  ON public.admin_email_warm_up_accounts (project_id, warm_up_status);

CREATE TABLE IF NOT EXISTS public.admin_email_warm_up_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.admin_email_projects (id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  company text,
  is_active boolean NOT NULL DEFAULT true,
  emails_received integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_warm_up_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_warm_up_recipients_project_email_unique UNIQUE (project_id, email)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_recipients_project
  ON public.admin_email_warm_up_recipients (project_id, is_active);

CREATE TABLE IF NOT EXISTS public.admin_email_warm_up_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.admin_email_projects (id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_warm_up_templates_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_templates_project
  ON public.admin_email_warm_up_templates (project_id, is_active);
