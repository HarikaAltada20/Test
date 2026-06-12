-- Admin bulk email (AWS SES) — projects, campaigns, templates, tracking

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_email_campaign_status_enum') THEN
    CREATE TYPE public.admin_email_campaign_status_enum AS ENUM (
      'draft',
      'configured',
      'scheduled',
      'active',
      'paused',
      'completed',
      'partial'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_email_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  website_url text,
  target_audience text,
  use_platform_sender boolean NOT NULL DEFAULT false,
  root_domain text,
  subdomain_prefix text,
  full_domain text,
  ses_verification_status text NOT NULL DEFAULT 'pending',
  dns_records jsonb,
  default_sender_id uuid,
  created_by uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  daily_limit integer NOT NULL DEFAULT 300,
  schedule_from_time text NOT NULL DEFAULT '09:00',
  schedule_to_time text NOT NULL DEFAULT '21:00',
  schedule_timezone text NOT NULL DEFAULT 'UTC',
  schedule_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7],
  CONSTRAINT admin_email_projects_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_projects_ses_status_check
    CHECK (ses_verification_status IN ('pending', 'verified', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.admin_email_project_senders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.admin_email_projects (id) ON DELETE CASCADE,
  email text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  ses_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_project_senders_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_project_senders_email_unique UNIQUE (project_id, email)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_email_projects_default_sender_fkey'
  ) THEN
    ALTER TABLE public.admin_email_projects
      ADD CONSTRAINT admin_email_projects_default_sender_fkey
      FOREIGN KEY (default_sender_id) REFERENCES public.admin_email_project_senders (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  cta_text text,
  cta_url text,
  created_by uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_templates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.admin_email_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.admin_email_projects (id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.admin_email_campaign_status_enum NOT NULL DEFAULT 'draft',
  email_subject text,
  message_template text,
  from_email text,
  from_sender_id uuid REFERENCES public.admin_email_project_senders (id) ON DELETE SET NULL,
  recipient_mode text,
  filter_snapshot jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.users (id),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  use_project_schedule boolean NOT NULL DEFAULT true,
  daily_limit integer,
  schedule_from_time text,
  schedule_to_time text,
  schedule_timezone text,
  schedule_days integer[],
  stop_on_reply boolean NOT NULL DEFAULT false,
  contest_id uuid REFERENCES public.contests (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_campaigns_recipient_mode_check
    CHECK (recipient_mode IS NULL OR recipient_mode IN ('selected_user_ids', 'select_all_filtered'))
);

CREATE INDEX IF NOT EXISTS idx_admin_email_campaigns_project
  ON public.admin_email_campaigns (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_email_campaigns_status
  ON public.admin_email_campaigns (status);

CREATE TABLE IF NOT EXISTS public.admin_email_campaign_recipients (
  campaign_id uuid NOT NULL REFERENCES public.admin_email_campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  user_type_at_send text NOT NULL,
  email_delivery_status text NOT NULL DEFAULT 'pending',
  ses_message_id text,
  from_email text,
  skipped_reason text,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_campaign_recipients_pkey PRIMARY KEY (campaign_id, user_id),
  CONSTRAINT admin_email_campaign_recipients_status_check
    CHECK (email_delivery_status IN (
      'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'skipped', 'failed'
    ))
);

CREATE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_campaign
  ON public.admin_email_campaign_recipients (campaign_id);

CREATE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_status
  ON public.admin_email_campaign_recipients (campaign_id, email_delivery_status);

CREATE TABLE IF NOT EXISTS public.admin_email_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.admin_email_campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  tracking_id uuid NOT NULL DEFAULT gen_random_uuid(),
  opened_at timestamptz,
  clicked_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_tracking_tracking_id_unique UNIQUE (tracking_id),
  CONSTRAINT admin_email_tracking_campaign_user_unique UNIQUE (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.admin_email_tracking_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL REFERENCES public.admin_email_tracking (tracking_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_tracking_events_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_tracking_events_type_check
    CHECK (event_type IN ('open', 'click'))
);

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_suppressions_pkey PRIMARY KEY (email),
  CONSTRAINT email_suppressions_reason_check
    CHECK (reason IN ('bounce', 'complaint', 'unsubscribe'))
);

-- updated_at triggers
DROP TRIGGER IF EXISTS set_admin_email_projects_updated_at ON public.admin_email_projects;
CREATE TRIGGER set_admin_email_projects_updated_at
  BEFORE UPDATE ON public.admin_email_projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_admin_email_templates_updated_at ON public.admin_email_templates;
CREATE TRIGGER set_admin_email_templates_updated_at
  BEFORE UPDATE ON public.admin_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_admin_email_campaigns_updated_at ON public.admin_email_campaigns;
CREATE TRIGGER set_admin_email_campaigns_updated_at
  BEFORE UPDATE ON public.admin_email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_admin_email_campaign_recipients_updated_at ON public.admin_email_campaign_recipients;
CREATE TRIGGER set_admin_email_campaign_recipients_updated_at
  BEFORE UPDATE ON public.admin_email_campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.admin_email_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_project_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_email_projects_admin_all ON public.admin_email_projects;
CREATE POLICY admin_email_projects_admin_all ON public.admin_email_projects
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));

DROP POLICY IF EXISTS admin_email_project_senders_admin_all ON public.admin_email_project_senders;
CREATE POLICY admin_email_project_senders_admin_all ON public.admin_email_project_senders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));

DROP POLICY IF EXISTS admin_email_templates_admin_all ON public.admin_email_templates;
CREATE POLICY admin_email_templates_admin_all ON public.admin_email_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));

DROP POLICY IF EXISTS admin_email_campaigns_admin_all ON public.admin_email_campaigns;
CREATE POLICY admin_email_campaigns_admin_all ON public.admin_email_campaigns
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));

DROP POLICY IF EXISTS admin_email_campaign_recipients_admin_all ON public.admin_email_campaign_recipients;
CREATE POLICY admin_email_campaign_recipients_admin_all ON public.admin_email_campaign_recipients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));

DROP POLICY IF EXISTS admin_email_tracking_admin_all ON public.admin_email_tracking;
CREATE POLICY admin_email_tracking_admin_all ON public.admin_email_tracking
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));

DROP POLICY IF EXISTS email_suppressions_admin_all ON public.email_suppressions;
CREATE POLICY email_suppressions_admin_all ON public.email_suppressions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));
