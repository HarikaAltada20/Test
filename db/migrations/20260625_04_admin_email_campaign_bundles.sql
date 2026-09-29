-- Track lead bundles attached to email campaigns

CREATE TABLE IF NOT EXISTS public.admin_email_campaign_bundles (
  campaign_id uuid NOT NULL REFERENCES public.admin_email_campaigns (id) ON DELETE CASCADE,
  bundle_id uuid NOT NULL REFERENCES public.admin_email_lead_bundles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_email_campaign_bundles_pkey PRIMARY KEY (campaign_id, bundle_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_campaign_bundles_bundle
  ON public.admin_email_campaign_bundles (bundle_id);

ALTER TABLE public.admin_email_campaign_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_email_campaign_bundles_admin_all ON public.admin_email_campaign_bundles;
CREATE POLICY admin_email_campaign_bundles_admin_all ON public.admin_email_campaign_bundles
  FOR ALL USING (true) WITH CHECK (true);
