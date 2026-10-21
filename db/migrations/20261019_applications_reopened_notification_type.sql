-- Notification type for "applications are open again" (creators who asked
-- to be told when a paused Restricted campaign reopens).
-- Run outside a transaction: ALTER TYPE ... ADD VALUE can't be used in the
-- same transaction that later uses the new value. Run before
-- 20261020_campaign_access_final.sql.

DO $$
BEGIN
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'campaign_applications_reopened';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
