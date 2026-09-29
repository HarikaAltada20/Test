-- Follow-up fixes for brand analytics migrations.
--
-- Run this file AFTER:
--   1. 20260719_admin_analytics_daily_rollups.sql (+ backfill)
--   2. 20260723_admin_analytics_rollup_delta_fix.sql
--   3. 20260720_brand_analytics_scale.sql
--   4. 20260725_brand_analytics_creator_rollup.sql
--
-- This migration:
--   - makes rollup increments concurrency-safe
--   - skips analytics-neutral submission updates
--   - applies metric refreshes as one net delta per unchanged bucket
--   - adds a bounded reconciliation/repair function for rollup drift
--   - adds aggregate Twitter payout lookup
--   - adds accurate creator monthly timelines
--   - adds PC creator top-submission lookup
--
-- It does not repeat the large creator-rollup backfill.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.admin_analytics_submission_daily_rollup') IS NULL
    OR to_regclass('public.admin_analytics_pc_daily_rollup') IS NULL
    OR to_regclass('public.admin_analytics_creator_daily_rollup') IS NULL
    OR to_regclass('public.admin_analytics_pc_creator_daily_rollup') IS NULL THEN
    RAISE EXCEPTION
      'Brand analytics rollup tables are missing. Apply migrations through 20260725 before this migration.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_analytics_apply_submission_rollup_delta(
  p_contest_id uuid,
  p_day_key date,
  p_status text,
  p_platform text,
  p_count_delta bigint,
  p_views_delta bigint,
  p_likes_delta bigint,
  p_comments_delta bigint,
  p_shares_delta bigint,
  p_payouts_delta bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_count_delta = 0
    AND p_views_delta = 0
    AND p_likes_delta = 0
    AND p_comments_delta = 0
    AND p_shares_delta = 0
    AND p_payouts_delta = 0 THEN
    RETURN;
  END IF;

  -- count_delta = 0 is a metric-only refresh. It must update an existing
  -- bucket, never create a count-zero bucket if prior rollup data is missing.
  IF p_count_delta <= 0
    OR p_views_delta < 0
    OR p_likes_delta < 0
    OR p_comments_delta < 0
    OR p_shares_delta < 0
    OR p_payouts_delta < 0 THEN
    UPDATE public.admin_analytics_submission_daily_rollup AS r
    SET
      submission_count = GREATEST(0, r.submission_count + p_count_delta),
      views_sum = GREATEST(0, r.views_sum + p_views_delta),
      likes_sum = GREATEST(0, r.likes_sum + p_likes_delta),
      comments_sum = GREATEST(0, r.comments_sum + p_comments_delta),
      shares_sum = GREATEST(0, r.shares_sum + p_shares_delta),
      payouts_cents_sum = GREATEST(0, r.payouts_cents_sum + p_payouts_delta)
    WHERE r.contest_id = p_contest_id
      AND r.day_key = p_day_key
      AND r.status = p_status
      AND r.platform = p_platform;
  ELSE
    INSERT INTO public.admin_analytics_submission_daily_rollup (
      contest_id,
      day_key,
      status,
      platform,
      submission_count,
      views_sum,
      likes_sum,
      comments_sum,
      shares_sum,
      payouts_cents_sum
    )
    VALUES (
      p_contest_id,
      p_day_key,
      p_status,
      p_platform,
      p_count_delta,
      p_views_delta,
      p_likes_delta,
      p_comments_delta,
      p_shares_delta,
      p_payouts_delta
    )
    ON CONFLICT (contest_id, day_key, status, platform)
    DO UPDATE SET
      submission_count =
        public.admin_analytics_submission_daily_rollup.submission_count
        + EXCLUDED.submission_count,
      views_sum =
        public.admin_analytics_submission_daily_rollup.views_sum
        + EXCLUDED.views_sum,
      likes_sum =
        public.admin_analytics_submission_daily_rollup.likes_sum
        + EXCLUDED.likes_sum,
      comments_sum =
        public.admin_analytics_submission_daily_rollup.comments_sum
        + EXCLUDED.comments_sum,
      shares_sum =
        public.admin_analytics_submission_daily_rollup.shares_sum
        + EXCLUDED.shares_sum,
      payouts_cents_sum =
        public.admin_analytics_submission_daily_rollup.payouts_cents_sum
        + EXCLUDED.payouts_cents_sum;
  END IF;

  DELETE FROM public.admin_analytics_submission_daily_rollup
  WHERE contest_id = p_contest_id
    AND day_key = p_day_key
    AND status = p_status
    AND platform = p_platform
    AND submission_count <= 0
    AND views_sum <= 0
    AND likes_sum <= 0
    AND comments_sum <= 0
    AND shares_sum <= 0
    AND payouts_cents_sum <= 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_apply_pc_rollup_delta(
  p_contest_id uuid,
  p_day_key date,
  p_status text,
  p_platform text,
  p_count_delta bigint,
  p_views_delta bigint,
  p_likes_delta bigint,
  p_comments_delta bigint,
  p_shares_delta bigint,
  p_payouts_delta bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_count_delta = 0
    AND p_views_delta = 0
    AND p_likes_delta = 0
    AND p_comments_delta = 0
    AND p_shares_delta = 0
    AND p_payouts_delta = 0 THEN
    RETURN;
  END IF;

  IF p_count_delta <= 0
    OR p_views_delta < 0
    OR p_likes_delta < 0
    OR p_comments_delta < 0
    OR p_shares_delta < 0
    OR p_payouts_delta < 0 THEN
    UPDATE public.admin_analytics_pc_daily_rollup AS r
    SET
      submission_count = GREATEST(0, r.submission_count + p_count_delta),
      views_sum = GREATEST(0, r.views_sum + p_views_delta),
      likes_sum = GREATEST(0, r.likes_sum + p_likes_delta),
      comments_sum = GREATEST(0, r.comments_sum + p_comments_delta),
      shares_sum = GREATEST(0, r.shares_sum + p_shares_delta),
      payouts_cents_sum = GREATEST(0, r.payouts_cents_sum + p_payouts_delta)
    WHERE r.contest_id = p_contest_id
      AND r.day_key = p_day_key
      AND r.status = p_status
      AND r.platform = p_platform;
  ELSE
    INSERT INTO public.admin_analytics_pc_daily_rollup (
      contest_id,
      day_key,
      status,
      platform,
      submission_count,
      views_sum,
      likes_sum,
      comments_sum,
      shares_sum,
      payouts_cents_sum
    )
    VALUES (
      p_contest_id,
      p_day_key,
      p_status,
      p_platform,
      p_count_delta,
      p_views_delta,
      p_likes_delta,
      p_comments_delta,
      p_shares_delta,
      p_payouts_delta
    )
    ON CONFLICT (contest_id, day_key, status, platform)
    DO UPDATE SET
      submission_count =
        public.admin_analytics_pc_daily_rollup.submission_count
        + EXCLUDED.submission_count,
      views_sum =
        public.admin_analytics_pc_daily_rollup.views_sum
        + EXCLUDED.views_sum,
      likes_sum =
        public.admin_analytics_pc_daily_rollup.likes_sum
        + EXCLUDED.likes_sum,
      comments_sum =
        public.admin_analytics_pc_daily_rollup.comments_sum
        + EXCLUDED.comments_sum,
      shares_sum =
        public.admin_analytics_pc_daily_rollup.shares_sum
        + EXCLUDED.shares_sum,
      payouts_cents_sum =
        public.admin_analytics_pc_daily_rollup.payouts_cents_sum
        + EXCLUDED.payouts_cents_sum;
  END IF;

  DELETE FROM public.admin_analytics_pc_daily_rollup
  WHERE contest_id = p_contest_id
    AND day_key = p_day_key
    AND status = p_status
    AND platform = p_platform
    AND submission_count <= 0
    AND views_sum <= 0
    AND likes_sum <= 0
    AND comments_sum <= 0
    AND shares_sum <= 0
    AND payouts_cents_sum <= 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_apply_creator_rollup_delta(
  p_contest_id uuid,
  p_creator_id uuid,
  p_day_key date,
  p_status text,
  p_platform text,
  p_count_delta bigint,
  p_views_delta bigint,
  p_earnings_delta bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_creator_id IS NULL THEN
    RETURN;
  END IF;

  IF p_count_delta = 0
    AND p_views_delta = 0
    AND p_earnings_delta = 0 THEN
    RETURN;
  END IF;

  IF p_count_delta <= 0 OR p_views_delta < 0 OR p_earnings_delta < 0 THEN
    UPDATE public.admin_analytics_creator_daily_rollup AS r
    SET
      submission_count = GREATEST(0, r.submission_count + p_count_delta),
      views_sum = GREATEST(0, r.views_sum + p_views_delta),
      earnings_cents_sum = GREATEST(0, r.earnings_cents_sum + p_earnings_delta)
    WHERE r.contest_id = p_contest_id
      AND r.creator_id = p_creator_id
      AND r.day_key = p_day_key
      AND r.status = p_status
      AND r.platform = p_platform;
  ELSE
    INSERT INTO public.admin_analytics_creator_daily_rollup (
      contest_id,
      creator_id,
      day_key,
      status,
      platform,
      submission_count,
      views_sum,
      earnings_cents_sum
    )
    VALUES (
      p_contest_id,
      p_creator_id,
      p_day_key,
      p_status,
      p_platform,
      p_count_delta,
      p_views_delta,
      p_earnings_delta
    )
    ON CONFLICT (contest_id, creator_id, day_key, status, platform)
    DO UPDATE SET
      submission_count =
        public.admin_analytics_creator_daily_rollup.submission_count
        + EXCLUDED.submission_count,
      views_sum =
        public.admin_analytics_creator_daily_rollup.views_sum
        + EXCLUDED.views_sum,
      earnings_cents_sum =
        public.admin_analytics_creator_daily_rollup.earnings_cents_sum
        + EXCLUDED.earnings_cents_sum;
  END IF;

  DELETE FROM public.admin_analytics_creator_daily_rollup
  WHERE contest_id = p_contest_id
    AND creator_id = p_creator_id
    AND day_key = p_day_key
    AND status = p_status
    AND platform = p_platform
    AND submission_count <= 0
    AND views_sum <= 0
    AND earnings_cents_sum <= 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_apply_pc_creator_rollup_delta(
  p_contest_id uuid,
  p_creator_id uuid,
  p_day_key date,
  p_status text,
  p_platform text,
  p_count_delta bigint,
  p_views_delta bigint,
  p_earnings_delta bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_creator_id IS NULL THEN
    RETURN;
  END IF;

  IF p_count_delta = 0
    AND p_views_delta = 0
    AND p_earnings_delta = 0 THEN
    RETURN;
  END IF;

  IF p_count_delta <= 0 OR p_views_delta < 0 OR p_earnings_delta < 0 THEN
    UPDATE public.admin_analytics_pc_creator_daily_rollup AS r
    SET
      submission_count = GREATEST(0, r.submission_count + p_count_delta),
      views_sum = GREATEST(0, r.views_sum + p_views_delta),
      earnings_cents_sum = GREATEST(0, r.earnings_cents_sum + p_earnings_delta)
    WHERE r.contest_id = p_contest_id
      AND r.creator_id = p_creator_id
      AND r.day_key = p_day_key
      AND r.status = p_status
      AND r.platform = p_platform;
  ELSE
    INSERT INTO public.admin_analytics_pc_creator_daily_rollup (
      contest_id,
      creator_id,
      day_key,
      status,
      platform,
      submission_count,
      views_sum,
      earnings_cents_sum
    )
    VALUES (
      p_contest_id,
      p_creator_id,
      p_day_key,
      p_status,
      p_platform,
      p_count_delta,
      p_views_delta,
      p_earnings_delta
    )
    ON CONFLICT (contest_id, creator_id, day_key, status, platform)
    DO UPDATE SET
      submission_count =
        public.admin_analytics_pc_creator_daily_rollup.submission_count
        + EXCLUDED.submission_count,
      views_sum =
        public.admin_analytics_pc_creator_daily_rollup.views_sum
        + EXCLUDED.views_sum,
      earnings_cents_sum =
        public.admin_analytics_pc_creator_daily_rollup.earnings_cents_sum
        + EXCLUDED.earnings_cents_sum;
  END IF;

  DELETE FROM public.admin_analytics_pc_creator_daily_rollup
  WHERE contest_id = p_contest_id
    AND creator_id = p_creator_id
    AND day_key = p_day_key
    AND status = p_status
    AND platform = p_platform
    AND submission_count <= 0
    AND views_sum <= 0
    AND earnings_cents_sum <= 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- Lower-write trigger maintenance
--
-- Shared advisory locks do not serialize normal submission writes. They only
-- coordinate those writes with the exclusive lock used by reconciliation.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_analytics_submissions_rollup_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_c_platform text;
  old_c_details jsonb;
  new_c_platform text;
  new_c_details jsonb;
  old_m record;
  new_m record;
  old_in_scope boolean := false;
  new_in_scope boolean := false;
  same_base_bucket boolean := false;
  same_creator_bucket boolean := false;
BEGIN
  -- Metric refresh jobs often update timestamps or bookkeeping fields even
  -- when analytics values did not change. Avoid all rollup work in that case.
  IF TG_OP = 'UPDATE'
    AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id
    AND OLD.creator_id IS NOT DISTINCT FROM NEW.creator_id
    AND OLD.created_at IS NOT DISTINCT FROM NEW.created_at
    AND OLD.status IS NOT DISTINCT FROM NEW.status
    AND OLD.platform IS NOT DISTINCT FROM NEW.platform
    AND OLD.views IS NOT DISTINCT FROM NEW.views
    AND OLD.other_stats IS NOT DISTINCT FROM NEW.other_stats
    AND OLD.earnings IS NOT DISTINCT FROM NEW.earnings
    AND OLD.bonus_amount IS NOT DISTINCT FROM NEW.bonus_amount THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock_shared(71026, 1);

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT c.platform, c.contest_based_details
    INTO old_c_platform, old_c_details
    FROM public.contests c
    WHERE c.id = OLD.contest_id;

    SELECT * INTO old_m
    FROM public.admin_analytics_compute_row_metrics(
      OLD.created_at,
      OLD.status::text,
      OLD.platform,
      old_c_platform,
      old_c_details,
      COALESCE(OLD.views, 0)::bigint,
      COALESCE(OLD.other_stats, '{}'::jsonb),
      COALESCE(OLD.earnings, 0)::bigint,
      COALESCE(OLD.bonus_amount, 0)::bigint
    );

    old_in_scope :=
      public.admin_analytics_submission_row_in_scope(old_m.platform);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_OP = 'UPDATE'
      AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id THEN
      new_c_platform := old_c_platform;
      new_c_details := old_c_details;
    ELSE
      SELECT c.platform, c.contest_based_details
      INTO new_c_platform, new_c_details
      FROM public.contests c
      WHERE c.id = NEW.contest_id;
    END IF;

    SELECT * INTO new_m
    FROM public.admin_analytics_compute_row_metrics(
      NEW.created_at,
      NEW.status::text,
      NEW.platform,
      new_c_platform,
      new_c_details,
      COALESCE(NEW.views, 0)::bigint,
      COALESCE(NEW.other_stats, '{}'::jsonb),
      COALESCE(NEW.earnings, 0)::bigint,
      COALESCE(NEW.bonus_amount, 0)::bigint
    );

    new_in_scope :=
      public.admin_analytics_submission_row_in_scope(new_m.platform);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    same_base_bucket :=
      old_in_scope
      AND new_in_scope
      AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id
      AND old_m.day_key IS NOT DISTINCT FROM new_m.day_key
      AND old_m.status IS NOT DISTINCT FROM new_m.status
      AND old_m.platform IS NOT DISTINCT FROM new_m.platform;

    same_creator_bucket :=
      same_base_bucket
      AND OLD.creator_id IS NOT NULL
      AND OLD.creator_id IS NOT DISTINCT FROM NEW.creator_id;
  END IF;

  IF same_base_bucket THEN
    -- A normal metrics refresh remains in the same bucket, so one net update
    -- replaces the previous subtract-then-add pair.
    PERFORM public.admin_analytics_apply_submission_rollup_delta(
      NEW.contest_id,
      new_m.day_key,
      new_m.status,
      new_m.platform,
      0,
      new_m.views - old_m.views,
      new_m.likes - old_m.likes,
      new_m.comments - old_m.comments,
      new_m.shares - old_m.shares,
      new_m.payouts_cents - old_m.payouts_cents
    );
  ELSE
    IF old_in_scope THEN
      PERFORM public.admin_analytics_apply_submission_rollup_delta(
        OLD.contest_id,
        old_m.day_key,
        old_m.status,
        old_m.platform,
        -1,
        -old_m.views,
        -old_m.likes,
        -old_m.comments,
        -old_m.shares,
        -old_m.payouts_cents
      );
    END IF;

    IF new_in_scope THEN
      PERFORM public.admin_analytics_apply_submission_rollup_delta(
        NEW.contest_id,
        new_m.day_key,
        new_m.status,
        new_m.platform,
        1,
        new_m.views,
        new_m.likes,
        new_m.comments,
        new_m.shares,
        new_m.payouts_cents
      );
    END IF;
  END IF;

  IF same_creator_bucket THEN
    PERFORM public.admin_analytics_apply_creator_rollup_delta(
      NEW.contest_id,
      NEW.creator_id,
      new_m.day_key,
      new_m.status,
      new_m.platform,
      0,
      new_m.views - old_m.views,
      new_m.payouts_cents - old_m.payouts_cents
    );
  ELSE
    IF old_in_scope AND TG_OP IN ('UPDATE', 'DELETE')
      AND OLD.creator_id IS NOT NULL THEN
      PERFORM public.admin_analytics_apply_creator_rollup_delta(
        OLD.contest_id,
        OLD.creator_id,
        old_m.day_key,
        old_m.status,
        old_m.platform,
        -1,
        -old_m.views,
        -old_m.payouts_cents
      );
    END IF;

    IF new_in_scope AND TG_OP IN ('INSERT', 'UPDATE')
      AND NEW.creator_id IS NOT NULL THEN
      PERFORM public.admin_analytics_apply_creator_rollup_delta(
        NEW.contest_id,
        NEW.creator_id,
        new_m.day_key,
        new_m.status,
        new_m.platform,
        1,
        new_m.views,
        new_m.payouts_cents
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_pc_rollup_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_c_platform text;
  old_c_details jsonb;
  new_c_platform text;
  new_c_details jsonb;
  old_m record;
  new_m record;
  old_in_scope boolean := false;
  new_in_scope boolean := false;
  same_base_bucket boolean := false;
  same_creator_bucket boolean := false;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id
    AND OLD.creator_id IS NOT DISTINCT FROM NEW.creator_id
    AND OLD.created_at IS NOT DISTINCT FROM NEW.created_at
    AND OLD.status IS NOT DISTINCT FROM NEW.status
    AND OLD.platform IS NOT DISTINCT FROM NEW.platform
    AND OLD.views IS NOT DISTINCT FROM NEW.views
    AND OLD.other_stats IS NOT DISTINCT FROM NEW.other_stats
    AND OLD.earnings IS NOT DISTINCT FROM NEW.earnings
    AND OLD.bonus_amount IS NOT DISTINCT FROM NEW.bonus_amount THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock_shared(71026, 1);

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT c.platform, c.contest_based_details
    INTO old_c_platform, old_c_details
    FROM public.contests c
    WHERE c.id = OLD.contest_id;

    SELECT * INTO old_m
    FROM public.admin_analytics_compute_row_metrics(
      OLD.created_at,
      OLD.status::text,
      OLD.platform,
      old_c_platform,
      old_c_details,
      COALESCE(OLD.views, 0)::bigint,
      COALESCE(OLD.other_stats, '{}'::jsonb),
      COALESCE(OLD.earnings, 0)::bigint,
      COALESCE(OLD.bonus_amount, 0)::bigint
    );

    old_in_scope := public.admin_analytics_pc_row_in_scope(old_m.platform);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_OP = 'UPDATE'
      AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id THEN
      new_c_platform := old_c_platform;
      new_c_details := old_c_details;
    ELSE
      SELECT c.platform, c.contest_based_details
      INTO new_c_platform, new_c_details
      FROM public.contests c
      WHERE c.id = NEW.contest_id;
    END IF;

    SELECT * INTO new_m
    FROM public.admin_analytics_compute_row_metrics(
      NEW.created_at,
      NEW.status::text,
      NEW.platform,
      new_c_platform,
      new_c_details,
      COALESCE(NEW.views, 0)::bigint,
      COALESCE(NEW.other_stats, '{}'::jsonb),
      COALESCE(NEW.earnings, 0)::bigint,
      COALESCE(NEW.bonus_amount, 0)::bigint
    );

    new_in_scope := public.admin_analytics_pc_row_in_scope(new_m.platform);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    same_base_bucket :=
      old_in_scope
      AND new_in_scope
      AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id
      AND old_m.day_key IS NOT DISTINCT FROM new_m.day_key
      AND old_m.status IS NOT DISTINCT FROM new_m.status
      AND old_m.platform IS NOT DISTINCT FROM new_m.platform;

    same_creator_bucket :=
      same_base_bucket
      AND OLD.creator_id IS NOT NULL
      AND OLD.creator_id IS NOT DISTINCT FROM NEW.creator_id;
  END IF;

  IF same_base_bucket THEN
    PERFORM public.admin_analytics_apply_pc_rollup_delta(
      NEW.contest_id,
      new_m.day_key,
      new_m.status,
      new_m.platform,
      0,
      new_m.views - old_m.views,
      new_m.likes - old_m.likes,
      new_m.comments - old_m.comments,
      new_m.shares - old_m.shares,
      new_m.payouts_cents - old_m.payouts_cents
    );
  ELSE
    IF old_in_scope THEN
      PERFORM public.admin_analytics_apply_pc_rollup_delta(
        OLD.contest_id,
        old_m.day_key,
        old_m.status,
        old_m.platform,
        -1,
        -old_m.views,
        -old_m.likes,
        -old_m.comments,
        -old_m.shares,
        -old_m.payouts_cents
      );
    END IF;

    IF new_in_scope THEN
      PERFORM public.admin_analytics_apply_pc_rollup_delta(
        NEW.contest_id,
        new_m.day_key,
        new_m.status,
        new_m.platform,
        1,
        new_m.views,
        new_m.likes,
        new_m.comments,
        new_m.shares,
        new_m.payouts_cents
      );
    END IF;
  END IF;

  IF same_creator_bucket THEN
    PERFORM public.admin_analytics_apply_pc_creator_rollup_delta(
      NEW.contest_id,
      NEW.creator_id,
      new_m.day_key,
      new_m.status,
      new_m.platform,
      0,
      new_m.views - old_m.views,
      new_m.payouts_cents - old_m.payouts_cents
    );
  ELSE
    IF old_in_scope AND TG_OP IN ('UPDATE', 'DELETE')
      AND OLD.creator_id IS NOT NULL THEN
      PERFORM public.admin_analytics_apply_pc_creator_rollup_delta(
        OLD.contest_id,
        OLD.creator_id,
        old_m.day_key,
        old_m.status,
        old_m.platform,
        -1,
        -old_m.views,
        -old_m.payouts_cents
      );
    END IF;

    IF new_in_scope AND TG_OP IN ('INSERT', 'UPDATE')
      AND NEW.creator_id IS NOT NULL THEN
      PERFORM public.admin_analytics_apply_pc_creator_rollup_delta(
        NEW.contest_id,
        NEW.creator_id,
        new_m.day_key,
        new_m.status,
        new_m.platform,
        1,
        new_m.views,
        new_m.payouts_cents
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Do not invoke the trigger at all when an UPDATE statement only touches
-- bookkeeping columns such as updated_at, synced_at, or insights_status.
DROP TRIGGER IF EXISTS trg_admin_analytics_submissions_rollup
  ON public.submissions;
CREATE TRIGGER trg_admin_analytics_submissions_rollup
  AFTER INSERT OR DELETE OR UPDATE OF
    contest_id,
    creator_id,
    created_at,
    status,
    platform,
    views,
    other_stats,
    earnings,
    bonus_amount
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_analytics_submissions_rollup_trigger();

DROP TRIGGER IF EXISTS trg_admin_analytics_pc_rollup
  ON public.post_campaign_submission_metrics;
CREATE TRIGGER trg_admin_analytics_pc_rollup
  AFTER INSERT OR DELETE OR UPDATE OF
    contest_id,
    creator_id,
    created_at,
    status,
    platform,
    views,
    other_stats,
    earnings,
    bonus_amount
  ON public.post_campaign_submission_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_analytics_pc_rollup_trigger();

-- ---------------------------------------------------------------------------
-- Bounded drift detection and repair
--
-- Reconcile small UTC date windows (normally 1-2 days) during low traffic.
-- The exclusive advisory lock waits for active rollup triggers and temporarily
-- makes new metric-changing writes wait, preventing a repair/write race.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_analytics_rollup_reconciliation_runs (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  from_day date NOT NULL,
  to_day date NOT NULL,
  repaired boolean NOT NULL,
  drift_buckets jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_analytics_rollup_reconciliation_started
  ON public.admin_analytics_rollup_reconciliation_runs (started_at DESC);

CREATE OR REPLACE FUNCTION public.admin_analytics_reconcile_rollups(
  p_from_day date,
  p_to_day date,
  p_repair boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at timestamptz := clock_timestamp();
  v_repair boolean := COALESCE(p_repair, true);
  v_submission_drift bigint := 0;
  v_pc_drift bigint := 0;
  v_creator_drift bigint := 0;
  v_pc_creator_drift bigint := 0;
  v_result jsonb;
BEGIN
  IF p_from_day IS NULL OR p_to_day IS NULL THEN
    RAISE EXCEPTION 'Reconciliation requires both from_day and to_day';
  END IF;

  IF p_from_day > p_to_day THEN
    RAISE EXCEPTION 'Reconciliation from_day must be on or before to_day';
  END IF;

  IF (p_to_day - p_from_day) > 30 THEN
    RAISE EXCEPTION
      'Reconciliation is limited to 31 days per call; process larger ranges in chunks';
  END IF;

  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION
      'Rollup reconciliation must run in a READ COMMITTED transaction';
  END IF;

  -- Normal submission writes hold the matching shared transaction lock.
  PERFORM pg_advisory_xact_lock(71026, 1);

  DROP TABLE IF EXISTS pg_temp.analytics_expected_submission_rows;
  DROP TABLE IF EXISTS pg_temp.analytics_expected_pc_rows;
  DROP TABLE IF EXISTS pg_temp.analytics_expected_submission;
  DROP TABLE IF EXISTS pg_temp.analytics_expected_pc;
  DROP TABLE IF EXISTS pg_temp.analytics_expected_creator;
  DROP TABLE IF EXISTS pg_temp.analytics_expected_pc_creator;

  CREATE TEMP TABLE analytics_expected_submission_rows
  ON COMMIT DROP
  AS
  SELECT
    s.contest_id,
    s.creator_id,
    m.day_key,
    m.status,
    m.platform,
    m.views,
    m.likes,
    m.comments,
    m.shares,
    m.payouts_cents
  FROM public.submissions s
  LEFT JOIN public.contests c ON c.id = s.contest_id
  CROSS JOIN LATERAL public.admin_analytics_compute_row_metrics(
    s.created_at,
    s.status::text,
    s.platform,
    c.platform,
    c.contest_based_details,
    COALESCE(s.views, 0)::bigint,
    COALESCE(s.other_stats, '{}'::jsonb),
    COALESCE(s.earnings, 0)::bigint,
    COALESCE(s.bonus_amount, 0)::bigint
  ) AS m
  WHERE s.contest_id IS NOT NULL
    AND s.created_at >= (p_from_day::timestamp AT TIME ZONE 'UTC')
    AND s.created_at < ((p_to_day + 1)::timestamp AT TIME ZONE 'UTC')
    AND public.admin_analytics_submission_row_in_scope(m.platform);

  CREATE TEMP TABLE analytics_expected_pc_rows
  ON COMMIT DROP
  AS
  SELECT
    pcs.contest_id,
    pcs.creator_id,
    m.day_key,
    m.status,
    m.platform,
    m.views,
    m.likes,
    m.comments,
    m.shares,
    m.payouts_cents
  FROM public.post_campaign_submission_metrics pcs
  LEFT JOIN public.contests c ON c.id = pcs.contest_id
  CROSS JOIN LATERAL public.admin_analytics_compute_row_metrics(
    pcs.created_at,
    pcs.status::text,
    pcs.platform,
    c.platform,
    c.contest_based_details,
    COALESCE(pcs.views, 0)::bigint,
    COALESCE(pcs.other_stats, '{}'::jsonb),
    COALESCE(pcs.earnings, 0)::bigint,
    COALESCE(pcs.bonus_amount, 0)::bigint
  ) AS m
  WHERE pcs.contest_id IS NOT NULL
    AND pcs.created_at >= (p_from_day::timestamp AT TIME ZONE 'UTC')
    AND pcs.created_at < ((p_to_day + 1)::timestamp AT TIME ZONE 'UTC')
    AND public.admin_analytics_pc_row_in_scope(m.platform);

  CREATE TEMP TABLE analytics_expected_submission
  ON COMMIT DROP
  AS
  SELECT
    contest_id,
    day_key,
    status,
    platform,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(views), 0)::bigint AS views_sum,
    COALESCE(SUM(likes), 0)::bigint AS likes_sum,
    COALESCE(SUM(comments), 0)::bigint AS comments_sum,
    COALESCE(SUM(shares), 0)::bigint AS shares_sum,
    COALESCE(SUM(payouts_cents), 0)::bigint AS payouts_cents_sum
  FROM pg_temp.analytics_expected_submission_rows
  GROUP BY contest_id, day_key, status, platform;

  CREATE UNIQUE INDEX ON analytics_expected_submission (
    contest_id, day_key, status, platform
  );

  CREATE TEMP TABLE analytics_expected_pc
  ON COMMIT DROP
  AS
  SELECT
    contest_id,
    day_key,
    status,
    platform,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(views), 0)::bigint AS views_sum,
    COALESCE(SUM(likes), 0)::bigint AS likes_sum,
    COALESCE(SUM(comments), 0)::bigint AS comments_sum,
    COALESCE(SUM(shares), 0)::bigint AS shares_sum,
    COALESCE(SUM(payouts_cents), 0)::bigint AS payouts_cents_sum
  FROM pg_temp.analytics_expected_pc_rows
  GROUP BY contest_id, day_key, status, platform;

  CREATE UNIQUE INDEX ON analytics_expected_pc (
    contest_id, day_key, status, platform
  );

  CREATE TEMP TABLE analytics_expected_creator
  ON COMMIT DROP
  AS
  SELECT
    contest_id,
    creator_id,
    day_key,
    status,
    platform,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(views), 0)::bigint AS views_sum,
    COALESCE(SUM(payouts_cents), 0)::bigint AS earnings_cents_sum
  FROM pg_temp.analytics_expected_submission_rows
  WHERE creator_id IS NOT NULL
  GROUP BY contest_id, creator_id, day_key, status, platform;

  CREATE UNIQUE INDEX ON analytics_expected_creator (
    contest_id, creator_id, day_key, status, platform
  );

  CREATE TEMP TABLE analytics_expected_pc_creator
  ON COMMIT DROP
  AS
  SELECT
    contest_id,
    creator_id,
    day_key,
    status,
    platform,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(views), 0)::bigint AS views_sum,
    COALESCE(SUM(payouts_cents), 0)::bigint AS earnings_cents_sum
  FROM pg_temp.analytics_expected_pc_rows
  WHERE creator_id IS NOT NULL
  GROUP BY contest_id, creator_id, day_key, status, platform;

  CREATE UNIQUE INDEX ON analytics_expected_pc_creator (
    contest_id, creator_id, day_key, status, platform
  );

  SELECT COUNT(*)::bigint
  INTO v_submission_drift
  FROM pg_temp.analytics_expected_submission e
  FULL OUTER JOIN (
    SELECT *
    FROM public.admin_analytics_submission_daily_rollup
    WHERE day_key BETWEEN p_from_day AND p_to_day
  ) a USING (contest_id, day_key, status, platform)
  WHERE e.contest_id IS NULL
    OR a.contest_id IS NULL
    OR ROW(
      e.submission_count,
      e.views_sum,
      e.likes_sum,
      e.comments_sum,
      e.shares_sum,
      e.payouts_cents_sum
    ) IS DISTINCT FROM ROW(
      a.submission_count,
      a.views_sum,
      a.likes_sum,
      a.comments_sum,
      a.shares_sum,
      a.payouts_cents_sum
    );

  SELECT COUNT(*)::bigint
  INTO v_pc_drift
  FROM pg_temp.analytics_expected_pc e
  FULL OUTER JOIN (
    SELECT *
    FROM public.admin_analytics_pc_daily_rollup
    WHERE day_key BETWEEN p_from_day AND p_to_day
  ) a USING (contest_id, day_key, status, platform)
  WHERE e.contest_id IS NULL
    OR a.contest_id IS NULL
    OR ROW(
      e.submission_count,
      e.views_sum,
      e.likes_sum,
      e.comments_sum,
      e.shares_sum,
      e.payouts_cents_sum
    ) IS DISTINCT FROM ROW(
      a.submission_count,
      a.views_sum,
      a.likes_sum,
      a.comments_sum,
      a.shares_sum,
      a.payouts_cents_sum
    );

  SELECT COUNT(*)::bigint
  INTO v_creator_drift
  FROM pg_temp.analytics_expected_creator e
  FULL OUTER JOIN (
    SELECT *
    FROM public.admin_analytics_creator_daily_rollup
    WHERE day_key BETWEEN p_from_day AND p_to_day
  ) a USING (contest_id, creator_id, day_key, status, platform)
  WHERE e.contest_id IS NULL
    OR a.contest_id IS NULL
    OR ROW(
      e.submission_count,
      e.views_sum,
      e.earnings_cents_sum
    ) IS DISTINCT FROM ROW(
      a.submission_count,
      a.views_sum,
      a.earnings_cents_sum
    );

  SELECT COUNT(*)::bigint
  INTO v_pc_creator_drift
  FROM pg_temp.analytics_expected_pc_creator e
  FULL OUTER JOIN (
    SELECT *
    FROM public.admin_analytics_pc_creator_daily_rollup
    WHERE day_key BETWEEN p_from_day AND p_to_day
  ) a USING (contest_id, creator_id, day_key, status, platform)
  WHERE e.contest_id IS NULL
    OR a.contest_id IS NULL
    OR ROW(
      e.submission_count,
      e.views_sum,
      e.earnings_cents_sum
    ) IS DISTINCT FROM ROW(
      a.submission_count,
      a.views_sum,
      a.earnings_cents_sum
    );

  IF v_repair AND v_submission_drift > 0 THEN
    DELETE FROM public.admin_analytics_submission_daily_rollup a
    WHERE a.day_key BETWEEN p_from_day AND p_to_day
      AND NOT EXISTS (
        SELECT 1
        FROM pg_temp.analytics_expected_submission e
        WHERE e.contest_id = a.contest_id
          AND e.day_key = a.day_key
          AND e.status = a.status
          AND e.platform = a.platform
      );

    INSERT INTO public.admin_analytics_submission_daily_rollup (
      contest_id, day_key, status, platform, submission_count, views_sum,
      likes_sum, comments_sum, shares_sum, payouts_cents_sum
    )
    SELECT
      contest_id, day_key, status, platform, submission_count, views_sum,
      likes_sum, comments_sum, shares_sum, payouts_cents_sum
    FROM pg_temp.analytics_expected_submission
    ON CONFLICT (contest_id, day_key, status, platform) DO UPDATE SET
      submission_count = EXCLUDED.submission_count,
      views_sum = EXCLUDED.views_sum,
      likes_sum = EXCLUDED.likes_sum,
      comments_sum = EXCLUDED.comments_sum,
      shares_sum = EXCLUDED.shares_sum,
      payouts_cents_sum = EXCLUDED.payouts_cents_sum;
  END IF;

  IF v_repair AND v_pc_drift > 0 THEN
    DELETE FROM public.admin_analytics_pc_daily_rollup a
    WHERE a.day_key BETWEEN p_from_day AND p_to_day
      AND NOT EXISTS (
        SELECT 1
        FROM pg_temp.analytics_expected_pc e
        WHERE e.contest_id = a.contest_id
          AND e.day_key = a.day_key
          AND e.status = a.status
          AND e.platform = a.platform
      );

    INSERT INTO public.admin_analytics_pc_daily_rollup (
      contest_id, day_key, status, platform, submission_count, views_sum,
      likes_sum, comments_sum, shares_sum, payouts_cents_sum
    )
    SELECT
      contest_id, day_key, status, platform, submission_count, views_sum,
      likes_sum, comments_sum, shares_sum, payouts_cents_sum
    FROM pg_temp.analytics_expected_pc
    ON CONFLICT (contest_id, day_key, status, platform) DO UPDATE SET
      submission_count = EXCLUDED.submission_count,
      views_sum = EXCLUDED.views_sum,
      likes_sum = EXCLUDED.likes_sum,
      comments_sum = EXCLUDED.comments_sum,
      shares_sum = EXCLUDED.shares_sum,
      payouts_cents_sum = EXCLUDED.payouts_cents_sum;
  END IF;

  IF v_repair AND v_creator_drift > 0 THEN
    DELETE FROM public.admin_analytics_creator_daily_rollup a
    WHERE a.day_key BETWEEN p_from_day AND p_to_day
      AND NOT EXISTS (
        SELECT 1
        FROM pg_temp.analytics_expected_creator e
        WHERE e.contest_id = a.contest_id
          AND e.creator_id = a.creator_id
          AND e.day_key = a.day_key
          AND e.status = a.status
          AND e.platform = a.platform
      );

    INSERT INTO public.admin_analytics_creator_daily_rollup (
      contest_id, creator_id, day_key, status, platform,
      submission_count, views_sum, earnings_cents_sum
    )
    SELECT
      contest_id, creator_id, day_key, status, platform,
      submission_count, views_sum, earnings_cents_sum
    FROM pg_temp.analytics_expected_creator
    ON CONFLICT (contest_id, creator_id, day_key, status, platform)
    DO UPDATE SET
      submission_count = EXCLUDED.submission_count,
      views_sum = EXCLUDED.views_sum,
      earnings_cents_sum = EXCLUDED.earnings_cents_sum;
  END IF;

  IF v_repair AND v_pc_creator_drift > 0 THEN
    DELETE FROM public.admin_analytics_pc_creator_daily_rollup a
    WHERE a.day_key BETWEEN p_from_day AND p_to_day
      AND NOT EXISTS (
        SELECT 1
        FROM pg_temp.analytics_expected_pc_creator e
        WHERE e.contest_id = a.contest_id
          AND e.creator_id = a.creator_id
          AND e.day_key = a.day_key
          AND e.status = a.status
          AND e.platform = a.platform
      );

    INSERT INTO public.admin_analytics_pc_creator_daily_rollup (
      contest_id, creator_id, day_key, status, platform,
      submission_count, views_sum, earnings_cents_sum
    )
    SELECT
      contest_id, creator_id, day_key, status, platform,
      submission_count, views_sum, earnings_cents_sum
    FROM pg_temp.analytics_expected_pc_creator
    ON CONFLICT (contest_id, creator_id, day_key, status, platform)
    DO UPDATE SET
      submission_count = EXCLUDED.submission_count,
      views_sum = EXCLUDED.views_sum,
      earnings_cents_sum = EXCLUDED.earnings_cents_sum;
  END IF;

  v_result := jsonb_build_object(
    'fromDay', p_from_day,
    'toDay', p_to_day,
    'repaired', v_repair,
    'driftBuckets', jsonb_build_object(
      'submissions', v_submission_drift,
      'pcSubmissions', v_pc_drift,
      'creators', v_creator_drift,
      'pcCreators', v_pc_creator_drift
    )
  );

  INSERT INTO public.admin_analytics_rollup_reconciliation_runs (
    started_at,
    from_day,
    to_day,
    repaired,
    drift_buckets
  )
  VALUES (
    v_started_at,
    p_from_day,
    p_to_day,
    v_repair,
    v_result->'driftBuckets'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_analytics_reconcile_rollups(
  date, date, boolean
) IS
  'Compares and optionally repairs all four analytics rollups for a bounded UTC date range. Run small ranges during low traffic.';

CREATE OR REPLACE FUNCTION public.admin_analytics_reconcile_recent_rollups(
  p_days integer DEFAULT 2,
  p_repair boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 2), 31));
BEGIN
  RETURN public.admin_analytics_reconcile_rollups(
    (clock_timestamp() AT TIME ZONE 'UTC')::date - (v_days - 1),
    (clock_timestamp() AT TIME ZONE 'UTC')::date,
    COALESCE(p_repair, true)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_analytics_reconcile_recent_rollups(
  integer, boolean
) IS
  'Scheduler entry point for recent rollup reconciliation; defaults to today and yesterday in UTC.';

CREATE OR REPLACE FUNCTION public.brand_analytics_twitter_paid_by_contest(
  p_contest_ids uuid[]
)
RETURNS TABLE (
  contest_id uuid,
  paid_cents bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.contest_id,
    COALESCE(SUM(COALESCE(l.earnings, 0)), 0)::bigint AS paid_cents
  FROM public.twitter_campaign_leaderboard l
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND l.contest_id = ANY (p_contest_ids)
  GROUP BY l.contest_id;
$$;

CREATE OR REPLACE FUNCTION public.brand_analytics_creator_monthly(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[],
  p_creator_id uuid
)
RETURNS TABLE (
  month_key date,
  status text,
  submission_count bigint,
  views_sum bigint,
  earnings_cents_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', r.day_key::timestamp)::date AS month_key,
    r.status,
    SUM(r.submission_count)::bigint AS submission_count,
    COALESCE(SUM(r.views_sum), 0)::bigint AS views_sum,
    COALESCE(SUM(r.earnings_cents_sum), 0)::bigint AS earnings_cents_sum
  FROM public.admin_analytics_creator_daily_rollup r
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND r.contest_id = ANY (p_contest_ids)
    AND r.creator_id = p_creator_id
    AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
    AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
    AND public.admin_analytics_submission_row_in_scope(r.platform)
  GROUP BY 1, r.status
  ORDER BY 1, r.status;
$$;

CREATE OR REPLACE FUNCTION public.brand_analytics_pc_creator_monthly(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[],
  p_creator_id uuid
)
RETURNS TABLE (
  month_key date,
  status text,
  submission_count bigint,
  views_sum bigint,
  earnings_cents_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', r.day_key::timestamp)::date AS month_key,
    r.status,
    SUM(r.submission_count)::bigint AS submission_count,
    COALESCE(SUM(r.views_sum), 0)::bigint AS views_sum,
    COALESCE(SUM(r.earnings_cents_sum), 0)::bigint AS earnings_cents_sum
  FROM public.admin_analytics_pc_creator_daily_rollup r
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND r.contest_id = ANY (p_contest_ids)
    AND r.creator_id = p_creator_id
    AND r.day_key >= (p_from AT TIME ZONE 'UTC')::date
    AND r.day_key <= (p_to AT TIME ZONE 'UTC')::date
    AND public.admin_analytics_pc_row_in_scope(r.platform)
  GROUP BY 1, r.status
  ORDER BY 1, r.status;
$$;

CREATE OR REPLACE FUNCTION public.brand_analytics_twitter_creator_monthly(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[],
  p_creator_id uuid
)
RETURNS TABLE (
  month_key date,
  status text,
  submission_count bigint,
  views_sum bigint,
  earnings_cents_sum bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', t.tweet_created_at AT TIME ZONE 'UTC')::date AS month_key,
    public.admin_analytics_normalize_status(t.moderation_status::text) AS status,
    COUNT(*)::bigint AS submission_count,
    COALESCE(SUM(COALESCE(t.impressions, 0)), 0)::bigint AS views_sum,
    0::bigint AS earnings_cents_sum
  FROM public.twitter_campaign_tweets t
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND t.contest_id = ANY (p_contest_ids)
    AND t.creator_id = p_creator_id
    AND t.tweet_created_at >= p_from
    AND t.tweet_created_at <= p_to
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

CREATE OR REPLACE FUNCTION public.brand_analytics_pc_creator_top_submissions(
  p_from timestamptz,
  p_to timestamptz,
  p_contest_ids uuid[],
  p_creator_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  views bigint,
  created_at timestamptz,
  platform text,
  status text,
  earnings bigint,
  contest_id uuid,
  contest_title text,
  contest_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pcs.submission_id AS id,
    public.admin_analytics_submission_views(
      COALESCE(pcs.views, 0)::bigint,
      public.admin_analytics_normalize_platform(
        COALESCE(pcs.platform, c.platform),
        c.contest_based_details
      ),
      COALESCE(pcs.other_stats, '{}'::jsonb)
    ) AS views,
    pcs.created_at,
    COALESCE(pcs.platform, c.platform)::text AS platform,
    pcs.status::text,
    COALESCE(pcs.earnings, 0)::bigint AS earnings,
    pcs.contest_id,
    c.title AS contest_title,
    c.contest_type::text AS contest_type
  FROM public.post_campaign_submission_metrics pcs
  INNER JOIN public.contests c ON c.id = pcs.contest_id
  WHERE p_contest_ids IS NOT NULL
    AND cardinality(p_contest_ids) > 0
    AND pcs.contest_id = ANY (p_contest_ids)
    AND pcs.creator_id = p_creator_id
    AND pcs.created_at >= p_from
    AND pcs.created_at <= p_to
    AND public.admin_analytics_pc_row_in_scope(
      public.admin_analytics_normalize_platform(
        COALESCE(pcs.platform, c.platform),
        c.contest_based_details
      )
    )
  ORDER BY views DESC NULLS LAST, pcs.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_apply_submission_rollup_delta(
  uuid, date, text, text, bigint, bigint, bigint, bigint, bigint, bigint
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_analytics_apply_pc_rollup_delta(
  uuid, date, text, text, bigint, bigint, bigint, bigint, bigint, bigint
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_analytics_apply_creator_rollup_delta(
  uuid, uuid, date, text, text, bigint, bigint, bigint
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_analytics_apply_pc_creator_rollup_delta(
  uuid, uuid, date, text, text, bigint, bigint, bigint
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_analytics_reconcile_rollups(
  date, date, boolean
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_analytics_reconcile_recent_rollups(
  integer, boolean
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_analytics_rollup_reconciliation_runs
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.brand_analytics_twitter_paid_by_contest(
  uuid[]
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.brand_analytics_creator_monthly(
  timestamptz, timestamptz, uuid[], uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.brand_analytics_pc_creator_monthly(
  timestamptz, timestamptz, uuid[], uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.brand_analytics_twitter_creator_monthly(
  timestamptz, timestamptz, uuid[], uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.brand_analytics_pc_creator_top_submissions(
  timestamptz, timestamptz, uuid[], uuid, integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.brand_analytics_twitter_paid_by_contest(
  uuid[]
) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_creator_monthly(
  timestamptz, timestamptz, uuid[], uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_pc_creator_monthly(
  timestamptz, timestamptz, uuid[], uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_twitter_creator_monthly(
  timestamptz, timestamptz, uuid[], uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.brand_analytics_pc_creator_top_submissions(
  timestamptz, timestamptz, uuid[], uuid, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_reconcile_rollups(
  date, date, boolean
) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_reconcile_recent_rollups(
  integer, boolean
) TO service_role;
GRANT SELECT ON TABLE public.admin_analytics_rollup_reconciliation_runs
  TO service_role;

COMMIT;
