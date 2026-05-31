-- Row Level Security for support chat (authenticated users + admins)

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- ---------- support_threads: customers ----------

DROP POLICY IF EXISTS "Users select own support threads" ON public.support_threads;
CREATE POLICY "Users select own support threads"
  ON public.support_threads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own support threads" ON public.support_threads;
CREATE POLICY "Users insert own support threads"
  ON public.support_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own support threads" ON public.support_threads;
CREATE POLICY "Users update own support threads"
  ON public.support_threads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- support_threads: admins ----------

DROP POLICY IF EXISTS "Admins manage all support threads" ON public.support_threads;
CREATE POLICY "Admins manage all support threads"
  ON public.support_threads
  FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------- support_messages: customers ----------

DROP POLICY IF EXISTS "Users select messages on own threads" ON public.support_messages;
CREATE POLICY "Users select messages on own threads"
  ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_threads st
      WHERE st.id = support_messages.thread_id
        AND st.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users insert messages on own threads" ON public.support_messages;
CREATE POLICY "Users insert messages on own threads"
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.support_threads st
      WHERE st.id = thread_id
        AND st.user_id = auth.uid()
        AND st.status <> 'closed'
    )
  );

-- ---------- support_messages: admins ----------

DROP POLICY IF EXISTS "Admins manage all support messages" ON public.support_messages;
CREATE POLICY "Admins manage all support messages"
  ON public.support_messages
  FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------- user_notifications: customers ----------

DROP POLICY IF EXISTS "Users select own notifications" ON public.user_notifications;
CREATE POLICY "Users select own notifications"
  ON public.user_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.user_notifications;
CREATE POLICY "Users update own notifications"
  ON public.user_notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inserts for user_notifications: support_admin_reply (SECURITY DEFINER) + service_role only

GRANT SELECT, INSERT, UPDATE ON public.support_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
