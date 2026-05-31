-- Notify  admin when a creator/brand sends a support message

DO $$
BEGIN
  BEGIN
    ALTER TYPE public.admin_notification_type_enum
      ADD VALUE IF NOT EXISTS 'support_user_message';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.support_notify_admins_on_user_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread public.support_threads%ROWTYPE;
  v_user_email text;
  v_user_username text;
  v_preview text;
  v_label text;
  v_who text;
  v_body text;
BEGIN
  IF NEW.sender_role = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_thread
  FROM public.support_threads
  WHERE id = NEW.thread_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT u.email, u.username
  INTO v_user_email, v_user_username
  FROM public.users u
  WHERE u.id = v_thread.user_id;

  v_preview := left(NEW.body, 200);
  IF length(NEW.body) > 200 THEN
    v_preview := v_preview || '...';
  END IF;

  v_label := CASE NEW.sender_role
    WHEN 'advertiser' THEN 'Brand'
    WHEN 'creator' THEN 'Creator'
    ELSE 'User'
  END;

  v_who := COALESCE(NULLIF(trim(v_user_username), ''), v_user_email, 'User');
  v_body := v_label || ' · ' || v_who || ': ' || v_preview;

  INSERT INTO public.user_notifications (
    user_id,
    notification_type,
    support_thread_id,
    title,
    message_resolved
  )
  SELECT
    u.id,
    'support_user_message'::public.admin_notification_type_enum,
    NEW.thread_id,
    'New support message',
    v_body
  FROM public.users u
  WHERE u.user_type = 'admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_messages_notify_admins_on_insert ON public.support_messages;

CREATE TRIGGER support_messages_notify_admins_on_insert
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.support_notify_admins_on_user_message();
