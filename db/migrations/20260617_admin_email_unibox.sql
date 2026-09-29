-- Admin email Unibox — sent + inbound reply threads

CREATE TABLE IF NOT EXISTS public.admin_email_unibox_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.admin_email_projects (id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.admin_email_campaigns (id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  contact_email text NOT NULL,
  contact_name text,
  subject text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  reply_count integer NOT NULL DEFAULT 0,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  latest_snippet text,
  latest_direction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_unibox_threads_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_threads_last_message
  ON public.admin_email_unibox_threads (last_message_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_threads_campaign
  ON public.admin_email_unibox_threads (campaign_id, last_message_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_threads_contact
  ON public.admin_email_unibox_threads (lower(contact_email));

CREATE TABLE IF NOT EXISTS public.admin_email_unibox_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.admin_email_unibox_threads (id) ON DELETE CASCADE,
  direction text NOT NULL,
  project_id uuid REFERENCES public.admin_email_projects (id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.admin_email_campaigns (id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  from_email text NOT NULL,
  from_name text,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  body_text text,
  body_html text,
  snippet text,
  ses_message_id text,
  in_reply_to_message_id text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_unibox_messages_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_unibox_messages_direction_check
    CHECK (direction IN ('outbound', 'inbound'))
);

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_messages_thread
  ON public.admin_email_unibox_messages (thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_messages_ses_id
  ON public.admin_email_unibox_messages (ses_message_id)
  WHERE ses_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_email_unibox_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.admin_email_unibox_messages (id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text,
  size_bytes integer,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_unibox_attachments_pkey PRIMARY KEY (id)
);

DROP TRIGGER IF EXISTS set_admin_email_unibox_threads_updated_at ON public.admin_email_unibox_threads;
CREATE TRIGGER set_admin_email_unibox_threads_updated_at
  BEFORE UPDATE ON public.admin_email_unibox_threads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.admin_email_unibox_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_unibox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_unibox_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_email_unibox_threads_admin_all ON public.admin_email_unibox_threads;
CREATE POLICY admin_email_unibox_threads_admin_all ON public.admin_email_unibox_threads
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));

DROP POLICY IF EXISTS admin_email_unibox_messages_admin_all ON public.admin_email_unibox_messages;
CREATE POLICY admin_email_unibox_messages_admin_all ON public.admin_email_unibox_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));

DROP POLICY IF EXISTS admin_email_unibox_attachments_admin_all ON public.admin_email_unibox_attachments;
CREATE POLICY admin_email_unibox_attachments_admin_all ON public.admin_email_unibox_attachments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type = 'admin'));

-- Backfill outbound threads from already-sent campaign recipients
INSERT INTO public.admin_email_unibox_threads (
  project_id,
  campaign_id,
  user_id,
  contact_email,
  contact_name,
  subject,
  last_message_at,
  reply_count,
  is_read,
  latest_snippet,
  latest_direction,
  created_at,
  updated_at
)
SELECT DISTINCT ON (r.campaign_id, r.user_id)
  c.project_id,
  r.campaign_id,
  r.user_id,
  lower(u.email),
  coalesce(nullif(trim(u.full_name), ''), u.username),
  coalesce(c.email_subject, 'No subject'),
  r.updated_at,
  0,
  true,
  left(regexp_replace(coalesce(c.message_template, ''), '<[^>]+>', '', 'g'), 200),
  'outbound',
  r.created_at,
  r.updated_at
FROM public.admin_email_campaign_recipients r
JOIN public.admin_email_campaigns c ON c.id = r.campaign_id
JOIN public.users u ON u.id = r.user_id
WHERE r.email_delivery_status IN ('sent', 'delivered', 'opened', 'clicked')
  AND u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.admin_email_unibox_threads t
    WHERE t.campaign_id = r.campaign_id
      AND t.user_id = r.user_id
  )
ORDER BY r.campaign_id, r.user_id, r.updated_at DESC;

INSERT INTO public.admin_email_unibox_messages (
  thread_id,
  direction,
  project_id,
  campaign_id,
  user_id,
  from_email,
  from_name,
  to_email,
  to_name,
  subject,
  body_text,
  body_html,
  snippet,
  ses_message_id,
  created_at
)
SELECT
  t.id,
  'outbound',
  t.project_id,
  t.campaign_id,
  t.user_id,
  coalesce(r.from_email, c.from_email, ''),
  'Game of Creators',
  lower(u.email),
  coalesce(nullif(trim(u.full_name), ''), u.username),
  coalesce(c.email_subject, 'No subject'),
  left(coalesce(c.message_template, ''), 10000),
  coalesce(c.message_template, ''),
  left(regexp_replace(coalesce(c.message_template, ''), '<[^>]+>', '', 'g'), 200),
  r.ses_message_id,
  r.updated_at
FROM public.admin_email_unibox_threads t
JOIN public.admin_email_campaign_recipients r
  ON r.campaign_id = t.campaign_id AND r.user_id = t.user_id
JOIN public.admin_email_campaigns c ON c.id = t.campaign_id
JOIN public.users u ON u.id = t.user_id
WHERE r.email_delivery_status IN ('sent', 'delivered', 'opened', 'clicked')
  AND NOT EXISTS (
    SELECT 1
    FROM public.admin_email_unibox_messages m
    WHERE m.thread_id = t.id AND m.direction = 'outbound'
  );

-- Backfill ses_message_id on unibox outbound messages from campaign recipients
UPDATE public.admin_email_unibox_messages m
SET ses_message_id = r.ses_message_id
FROM public.admin_email_campaign_recipients r
WHERE m.direction = 'outbound'
  AND m.campaign_id = r.campaign_id
  AND m.user_id = r.user_id
  AND m.ses_message_id IS NULL
  AND r.ses_message_id IS NOT NULL;
