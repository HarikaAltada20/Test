-- Named campaign schedules (sidebar list + active selection)

ALTER TABLE public.admin_email_campaigns
  ADD COLUMN IF NOT EXISTS schedule_data jsonb;
