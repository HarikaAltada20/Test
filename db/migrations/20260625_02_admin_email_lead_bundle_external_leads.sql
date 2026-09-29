-- Allow lead bundle members without a platform user account (email-only leads)

ALTER TABLE public.admin_email_lead_bundle_members
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS user_type text;

UPDATE public.admin_email_lead_bundle_members
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.admin_email_lead_bundle_members
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.admin_email_lead_bundle_members
  DROP CONSTRAINT IF EXISTS admin_email_lead_bundle_members_pkey;

ALTER TABLE public.admin_email_lead_bundle_members
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.admin_email_lead_bundle_members
  ADD CONSTRAINT admin_email_lead_bundle_members_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_email_lead_bundle_members_bundle_user
  ON public.admin_email_lead_bundle_members (bundle_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_email_lead_bundle_members_bundle_email
  ON public.admin_email_lead_bundle_members (bundle_id, lower(email))
  WHERE user_id IS NULL;

ALTER TABLE public.admin_email_lead_bundle_members
  DROP CONSTRAINT IF EXISTS admin_email_lead_bundle_members_identity_check;

ALTER TABLE public.admin_email_lead_bundle_members
  ADD CONSTRAINT admin_email_lead_bundle_members_identity_check
  CHECK (
    user_id IS NOT NULL
    OR (email IS NOT NULL AND length(trim(email)) > 0)
  );

-- Keep total_leads and processed_count aligned with actual member rows.
UPDATE public.admin_email_lead_bundles b
SET
  total_leads = counts.member_count,
  processed_count = counts.member_count
FROM (
  SELECT bundle_id, COUNT(*)::int AS member_count
  FROM public.admin_email_lead_bundle_members
  GROUP BY bundle_id
) counts
WHERE b.id = counts.bundle_id
  AND (
    b.total_leads IS DISTINCT FROM counts.member_count
    OR b.processed_count IS DISTINCT FROM counts.member_count
  );

UPDATE public.admin_email_lead_bundles b
SET total_leads = 0, processed_count = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.admin_email_lead_bundle_members m
  WHERE m.bundle_id = b.id
)
AND (b.total_leads <> 0 OR b.processed_count <> 0);
