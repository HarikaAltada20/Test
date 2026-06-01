-- Store QStash message id so scheduled campaigns can be cancelled before delivery.

ALTER TABLE public.admin_notification_campaigns
  ADD COLUMN IF NOT EXISTS qstash_message_id text;
