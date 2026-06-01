-- One admin notification per support message (app code creates these).

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS support_message_id uuid
    REFERENCES public.queries (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_support_message_admin
  ON public.user_notifications (support_message_id)
  WHERE notification_type = 'support_user_message'
    AND support_message_id IS NOT NULL;
