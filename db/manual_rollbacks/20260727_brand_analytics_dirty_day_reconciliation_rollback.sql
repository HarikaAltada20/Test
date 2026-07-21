-- MANUAL ROLLBACK ONLY.
--
-- Run this file only to remove the dirty-day tracking introduced by
-- 20260727_brand_analytics_dirty_day_reconciliation.sql.
-- Existing analytics rollup data is intentionally retained.

BEGIN;

DROP TRIGGER IF EXISTS trg_admin_analytics_rollup_dirty_submissions
  ON public.submissions;
DROP TRIGGER IF EXISTS trg_admin_analytics_rollup_dirty_pc
  ON public.post_campaign_submission_metrics;

DROP FUNCTION IF EXISTS public.admin_analytics_reconcile_dirty_rollups(
  integer, boolean
);
DROP FUNCTION IF EXISTS public.admin_analytics_mark_submission_rollup_dirty();
DROP FUNCTION IF EXISTS public.admin_analytics_mark_rollup_dirty_day(date);

DROP TABLE IF EXISTS public.admin_analytics_rollup_dirty_days;

COMMIT;
