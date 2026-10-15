-- Notification types for Review before posting (content drafts).
-- Run this file on its own, outside a transaction, BEFORE
-- db/migrations/20261022_review_before_posting.sql: ALTER TYPE ... ADD VALUE
-- can't be used in the same transaction that adds it, and that migration
-- builds indexes on these values.

DO $$
BEGIN
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'content_draft_submitted';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'content_draft_approved';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'content_draft_revision_requested';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'content_draft_rejected';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.admin_notification_type_enum ADD VALUE IF NOT EXISTS 'content_draft_comment';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
