-- Project-level warm-up enable flag

ALTER TABLE public.admin_email_projects
  ADD COLUMN IF NOT EXISTS warm_up_enabled boolean NOT NULL DEFAULT false;
