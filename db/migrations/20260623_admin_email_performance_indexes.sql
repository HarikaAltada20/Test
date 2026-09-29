-- Performance indexes for admin email: campaigns, unibox, warm-up, delivery queue.
-- Targets hot list/filter/sort paths used by the admin email dashboard and cron jobs.

-- ---------------------------------------------------------------------------
-- Projects & senders
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_admin_email_projects_created_at
  ON public.admin_email_projects (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_email_projects_warm_up_enabled
  ON public.admin_email_projects (id)
  WHERE warm_up_enabled = true;

CREATE INDEX IF NOT EXISTS idx_admin_email_project_senders_project
  ON public.admin_email_project_senders (project_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_admin_email_project_senders_default
  ON public.admin_email_project_senders (project_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_admin_email_templates_created_at
  ON public.admin_email_templates (created_at DESC);

-- ---------------------------------------------------------------------------
-- Campaigns & recipients (list, delivery queue, analytics)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_admin_email_campaigns_status_started
  ON public.admin_email_campaigns (status, started_at ASC NULLS FIRST)
  WHERE status IN ('active', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_admin_email_campaigns_project_status
  ON public.admin_email_campaigns (project_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_campaign_status
  ON public.admin_email_campaign_recipients (campaign_id, email_delivery_status);

CREATE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_pending
  ON public.admin_email_campaign_recipients (campaign_id, user_id)
  WHERE email_delivery_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_in_sequence
  ON public.admin_email_campaign_recipients (campaign_id, next_email_scheduled_at ASC NULLS LAST, user_id)
  WHERE email_delivery_status = 'in_sequence';

CREATE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_ses_message_id
  ON public.admin_email_campaign_recipients (ses_message_id)
  WHERE ses_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_user
  ON public.admin_email_campaign_recipients (user_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_admin_email_tracking_campaign
  ON public.admin_email_tracking (campaign_id);

CREATE INDEX IF NOT EXISTS idx_admin_email_tracking_events_tracking
  ON public.admin_email_tracking_events (tracking_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_email_sequence_step_sends_ses
  ON public.admin_email_sequence_step_sends (ses_message_id)
  WHERE ses_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_email_sequence_step_sends_user
  ON public.admin_email_sequence_step_sends (campaign_id, user_id, step_number);

-- ---------------------------------------------------------------------------
-- Unibox (thread list, unread count, inbound matching)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_threads_inbox
  ON public.admin_email_unibox_threads (last_message_at DESC)
  WHERE is_deleted = false AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_threads_unread
  ON public.admin_email_unibox_threads (last_message_at DESC)
  WHERE is_deleted = false AND is_archived = false AND is_read = false;

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_threads_project
  ON public.admin_email_unibox_threads (project_id, last_message_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_threads_user
  ON public.admin_email_unibox_threads (user_id, last_message_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_messages_to_outbound
  ON public.admin_email_unibox_messages (to_email, created_at DESC)
  WHERE direction = 'outbound';

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_messages_from_inbound
  ON public.admin_email_unibox_messages (from_email, created_at DESC)
  WHERE direction = 'inbound';

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_messages_campaign_user
  ON public.admin_email_unibox_messages (campaign_id, user_id, direction);

CREATE INDEX IF NOT EXISTS idx_admin_email_unibox_attachments_message
  ON public.admin_email_unibox_attachments (message_id);

CREATE INDEX IF NOT EXISTS idx_admin_email_inbound_processed_ses
  ON public.admin_email_inbound_processed (ses_message_id)
  WHERE ses_message_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Warm-up (accounts list, health scoring, recipient rotation)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_accounts_status
  ON public.admin_email_warm_up_accounts (warm_up_status, project_id)
  WHERE warm_up_status IN ('active', 'paused', 'completed');

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_accounts_active
  ON public.admin_email_warm_up_accounts (project_id, id)
  WHERE warm_up_status = 'active';

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_accounts_health
  ON public.admin_email_warm_up_accounts (current_health_score DESC);

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_accounts_email
  ON public.admin_email_warm_up_accounts (lower(email));

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_recipients_rotation
  ON public.admin_email_warm_up_recipients (project_id, emails_received ASC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_admin_email_warm_up_recipients_email
  ON public.admin_email_warm_up_recipients (project_id, lower(email))
  WHERE is_active = true;
