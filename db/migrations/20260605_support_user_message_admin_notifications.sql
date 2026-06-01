-- Notification type for admin alerts when a user sends a support message.
-- Notifications are created by app code (lib/support/admin-notifications.ts), not a DB trigger.

DO $$
BEGIN
  BEGIN
    ALTER TYPE public.admin_notification_type_enum
      ADD VALUE IF NOT EXISTS 'support_user_message';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
