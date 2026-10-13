-- Notification types for restricted-campaign applications and access grants.
-- Run outside a transaction: ALTER TYPE ... ADD VALUE can't be used in the
-- same transaction that later uses the new value. Run after 20261014.

DO $$
BEGIN
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'campaign_application_approved';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'campaign_application_rejected';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'campaign_application_received';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'campaign_access_granted';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
