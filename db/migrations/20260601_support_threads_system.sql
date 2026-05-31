-- In-built support system: threads, messages, notifications, user chat flag

-- Notification type enum (includes support_reply)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_notification_type_enum') THEN
    CREATE TYPE public.admin_notification_type_enum AS ENUM ('public', 'support_reply');
  ELSE
    BEGIN
      ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'support_reply';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- users.support_chat_* columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS support_chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS support_chat_disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS support_chat_disabled_by uuid REFERENCES public.users (id),
  ADD COLUMN IF NOT EXISTS support_chat_disable_reason text;

-- support_threads
CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  user_type text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
  subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_threads_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_support_threads_user_last_message
  ON public.support_threads (user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_threads_last_message
  ON public.support_threads (last_message_at);

-- support_messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads (id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('creator', 'advertiser', 'admin')),
  sender_user_id uuid NOT NULL REFERENCES public.users (id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_support_messages_thread_created
  ON public.support_messages (thread_id, created_at ASC);

-- user_notifications
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  campaign_id uuid,
  notification_type public.admin_notification_type_enum NOT NULL,
  support_thread_id uuid REFERENCES public.support_threads (id) ON DELETE SET NULL,
  title text,
  message_template text,
  message_resolved text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON public.user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications (user_id)
  WHERE is_read = false;

-- Backfill legacy queries into support_threads + support_messages
INSERT INTO public.support_threads (
  id,
  user_id,
  user_type,
  status,
  subject,
  created_at,
  updated_at,
  last_message_at
)
SELECT
  q.id,
  q.user_id,
  q.user_type,
  'open',
  left(q.query_text, 120),
  q.created_at,
  q.created_at,
  q.created_at
FROM public.queries q
WHERE q.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.support_threads st WHERE st.id = q.id
  );

INSERT INTO public.support_messages (
  thread_id,
  sender_role,
  sender_user_id,
  body,
  created_at
)
SELECT
  q.id,
  COALESCE(NULLIF(q.user_type, ''), 'creator'),
  q.user_id,
  q.query_text,
  q.created_at
FROM public.queries q
WHERE q.user_id IS NOT NULL
  AND q.query_text IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.support_messages sm WHERE sm.thread_id = q.id
  );

-- Transactional admin reply (message + thread update + notification)
CREATE OR REPLACE FUNCTION public.support_admin_reply(
  p_thread_id uuid,
  p_admin_user_id uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread public.support_threads%ROWTYPE;
  v_message_id uuid;
  v_notification_id uuid;
  v_preview text;
BEGIN
  SELECT * INTO v_thread
  FROM public.support_threads
  WHERE id = p_thread_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'thread_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.support_messages (thread_id, sender_role, sender_user_id, body)
  VALUES (p_thread_id, 'admin', p_admin_user_id, p_body)
  RETURNING id INTO v_message_id;

  UPDATE public.support_threads
  SET
    status = 'replied',
    last_message_at = now(),
    updated_at = now()
  WHERE id = p_thread_id;

  v_preview := left(p_body, 200);
  IF length(p_body) > 200 THEN
    v_preview := v_preview || '...';
  END IF;

  INSERT INTO public.user_notifications (
    user_id,
    notification_type,
    support_thread_id,
    title,
    message_resolved
  )
  VALUES (
    v_thread.user_id,
    'support_reply',
    p_thread_id,
    'Support replied',
    v_preview
  )
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object(
    'message_id', v_message_id,
    'notification_id', v_notification_id,
    'thread_id', p_thread_id,
    'status', 'replied',
    'last_message_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.support_admin_reply(uuid, uuid, text) TO service_role;

-- RLS policies: see db/migrations/20260603_support_rls_policies.sql
