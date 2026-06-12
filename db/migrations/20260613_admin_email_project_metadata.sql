-- Extended project metadata for admin email projects

ALTER TABLE public.admin_email_projects
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS target_audience text;

ALTER TABLE public.admin_email_projects
  ADD COLUMN IF NOT EXISTS send_interval_seconds integer DEFAULT 60;

UPDATE public.admin_email_projects
SET send_interval_seconds = 60
WHERE send_interval_seconds IS NULL;
