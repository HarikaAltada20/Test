-- Lead bundles (groups) for admin email campaigns

CREATE TABLE IF NOT EXISTS public.admin_email_lead_bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.admin_email_projects (id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  source_campaign_id uuid REFERENCES public.admin_email_campaigns (id) ON DELETE SET NULL,
  total_leads integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_lead_bundles_pkey PRIMARY KEY (id),
  CONSTRAINT admin_email_lead_bundles_status_check
    CHECK (status IN ('active', 'completed', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_admin_email_lead_bundles_project
  ON public.admin_email_lead_bundles (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_email_lead_bundles_status
  ON public.admin_email_lead_bundles (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_email_lead_bundle_members (
  bundle_id uuid NOT NULL REFERENCES public.admin_email_lead_bundles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_lead_bundle_members_pkey PRIMARY KEY (bundle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_lead_bundle_members_user
  ON public.admin_email_lead_bundle_members (user_id);

DROP TRIGGER IF EXISTS set_admin_email_lead_bundles_updated_at ON public.admin_email_lead_bundles;
CREATE TRIGGER set_admin_email_lead_bundles_updated_at
  BEFORE UPDATE ON public.admin_email_lead_bundles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.admin_email_lead_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_lead_bundle_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_email_lead_bundles_admin_all ON public.admin_email_lead_bundles;
CREATE POLICY admin_email_lead_bundles_admin_all ON public.admin_email_lead_bundles
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS admin_email_lead_bundle_members_admin_all ON public.admin_email_lead_bundle_members;
CREATE POLICY admin_email_lead_bundle_members_admin_all ON public.admin_email_lead_bundle_members
  FOR ALL USING (true) WITH CHECK (true);
