-- Enforce closed thread rules in admin reply RPC

CREATE OR REPLACE FUNCTION public.support_admin_reply(
  p_thread_id uuid,
  p_admin_user_id uuid,
  p_body text,
  p_close_thread boolean DEFAULT false
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
  v_new_status text;
BEGIN
  SELECT * INTO v_thread
  FROM public.support_threads
  WHERE id = p_thread_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'thread_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_thread.status = 'closed' THEN
    RAISE EXCEPTION 'thread_closed' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.support_messages (thread_id, sender_role, sender_user_id, body)
  VALUES (p_thread_id, 'admin', p_admin_user_id, p_body)
  RETURNING id INTO v_message_id;

  v_new_status := CASE WHEN p_close_thread THEN 'closed' ELSE 'replied' END;

  UPDATE public.support_threads
  SET
    status = v_new_status,
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
    'status', v_new_status,
    'last_message_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.support_admin_reply(uuid, uuid, text, boolean) TO service_role;
