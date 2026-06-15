-- Backfill ses_message_id on unibox outbound messages from campaign recipients

UPDATE public.admin_email_unibox_messages m
SET ses_message_id = r.ses_message_id
FROM public.admin_email_campaign_recipients r
WHERE m.direction = 'outbound'
  AND m.campaign_id = r.campaign_id
  AND m.user_id = r.user_id
  AND m.ses_message_id IS NULL
  AND r.ses_message_id IS NOT NULL;
