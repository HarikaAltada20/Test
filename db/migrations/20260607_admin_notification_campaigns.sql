-- Admin notification campaigns (bulk send from User Management)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_notification_campaign_status_enum') THEN
    CREATE TYPE public.admin_notification_campaign_status_enum AS ENUM (
      'scheduled',
      'pending',
      'processing',
      'completed',
      'partial',
      'failed',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_notification_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.users (id),
  notification_type public.admin_notification_type_enum NOT NULL,
  message_template text NOT NULL,
  recipient_mode text NOT NULL,
  filter_snapshot jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  status public.admin_notification_campaign_status_enum NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  timezone_label text,
  qstash_message_id text,
  contest_id uuid REFERENCES public.contests (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT admin_notification_campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT admin_notification_campaigns_recipient_mode_check
    CHECK (recipient_mode IN ('selected_user_ids', 'select_all_filtered'))
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_campaigns_created_by
  ON public.admin_notification_campaigns (created_by);

CREATE INDEX IF NOT EXISTS idx_admin_notification_campaigns_created_at
  ON public.admin_notification_campaigns (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notification_campaigns_scheduled_due
  ON public.admin_notification_campaigns (scheduled_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_admin_notification_campaigns_contest_id
  ON public.admin_notification_campaigns (contest_id)
  WHERE contest_id IS NOT NULL;

ALTER TABLE public.admin_notification_campaigns
  ADD COLUMN IF NOT EXISTS qstash_message_id text;

ALTER TABLE public.admin_notification_campaigns
  ADD COLUMN IF NOT EXISTS contest_id uuid REFERENCES public.contests (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.admin_notification_campaign_recipients (
  campaign_id uuid NOT NULL REFERENCES public.admin_notification_campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  user_type_at_send text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending',
  CONSTRAINT admin_notification_campaign_recipients_pkey PRIMARY KEY (campaign_id, user_id),
  CONSTRAINT admin_notification_campaign_recipients_delivery_status_check
    CHECK (delivery_status IN ('pending', 'delivered', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_campaign_recipients_campaign
  ON public.admin_notification_campaign_recipients (campaign_id);

-- Link user_notifications to campaigns (column may already exist from support migration)
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS campaign_id uuid;

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS contest_id uuid REFERENCES public.contests (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_notifications_campaign_id_fkey'
  ) THEN
    ALTER TABLE public.user_notifications
      ADD CONSTRAINT user_notifications_campaign_id_fkey
      FOREIGN KEY (campaign_id) REFERENCES public.admin_notification_campaigns (id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.admin_notification_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_notification_campaigns_admin_select ON public.admin_notification_campaigns;
CREATE POLICY admin_notification_campaigns_admin_select
  ON public.admin_notification_campaigns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS admin_notification_campaigns_admin_insert ON public.admin_notification_campaigns;
CREATE POLICY admin_notification_campaigns_admin_insert
  ON public.admin_notification_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.user_type = 'admin'
    )
  );

ALTER TABLE public.admin_notification_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_notification_campaign_recipients_admin_select ON public.admin_notification_campaign_recipients;
CREATE POLICY admin_notification_campaign_recipients_admin_select
  ON public.admin_notification_campaign_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.user_type = 'admin'
    )
  );
