-- Allow campaign recipients without a platform user account (email-only leads)

ALTER TABLE public.admin_email_campaign_recipients
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS username text;

UPDATE public.admin_email_campaign_recipients
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.admin_email_campaign_recipients
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.admin_email_campaign_recipients
  DROP CONSTRAINT IF EXISTS admin_email_campaign_recipients_pkey;

ALTER TABLE public.admin_email_campaign_recipients
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.admin_email_campaign_recipients
  ALTER COLUMN user_type_at_send DROP NOT NULL;

ALTER TABLE public.admin_email_campaign_recipients
  ADD CONSTRAINT admin_email_campaign_recipients_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_campaign_user
  ON public.admin_email_campaign_recipients (campaign_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_email_campaign_recipients_campaign_email
  ON public.admin_email_campaign_recipients (campaign_id, lower(recipient_email))
  WHERE user_id IS NULL;

ALTER TABLE public.admin_email_campaign_recipients
  DROP CONSTRAINT IF EXISTS admin_email_campaign_recipients_identity_check;

ALTER TABLE public.admin_email_campaign_recipients
  ADD CONSTRAINT admin_email_campaign_recipients_identity_check
  CHECK (
    user_id IS NOT NULL
    OR (recipient_email IS NOT NULL AND length(trim(recipient_email)) > 0)
  );
