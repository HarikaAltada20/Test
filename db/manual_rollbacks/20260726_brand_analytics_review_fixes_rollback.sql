-- MANUAL ROLLBACK ONLY. Do not place this file in the automatic migration path.
--
-- Before running:
--   1. Deploy the application version from before 20260726.
--   2. Pause submission/refresh workers to avoid concurrent rollup writes.
--   3. Run this whole file once.
--
-- This restores the four rollup delta functions and two trigger functions to
-- their pre-20260726 implementations, then removes the reconciliation objects.
-- Read-only analytics RPCs are intentionally retained because they are also
-- present in the current 20260725 migration and are harmless to older app code.
-- This rollback does not rewrite rollup data.

BEGIN;

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

  IF NOT FOUND THEN
    IF p_count_delta < 0
      OR p_views_delta < 0
      OR p_likes_delta < 0
      OR p_comments_delta < 0
      OR p_shares_delta < 0
      OR p_payouts_delta < 0 THEN
      RETURN;
    END IF;

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
    );
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

  IF NOT FOUND THEN
    IF p_count_delta < 0
      OR p_views_delta < 0
      OR p_likes_delta < 0
      OR p_comments_delta < 0
      OR p_shares_delta < 0
      OR p_payouts_delta < 0 THEN
      RETURN;
    END IF;

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
    );
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

  IF NOT FOUND THEN
    IF p_count_delta < 0 OR p_views_delta < 0 OR p_earnings_delta < 0 THEN
      RETURN;
    END IF;

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
    );
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

  IF NOT FOUND THEN
    IF p_count_delta < 0 OR p_views_delta < 0 OR p_earnings_delta < 0 THEN
      RETURN;
    END IF;

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
    );
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

CREATE OR REPLACE FUNCTION public.admin_analytics_submissions_rollup_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_platform text;
  c_details jsonb;
  m record;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT c.platform, c.contest_based_details
    INTO c_platform, c_details
    FROM public.contests c
    WHERE c.id = OLD.contest_id;

    SELECT * INTO m
    FROM public.admin_analytics_compute_row_metrics(
      OLD.created_at,
      OLD.status::text,
      OLD.platform,
      c_platform,
      c_details,
      COALESCE(OLD.views, 0)::bigint,
      COALESCE(OLD.other_stats, '{}'::jsonb),
      COALESCE(OLD.earnings, 0)::bigint,
      COALESCE(OLD.bonus_amount, 0)::bigint
    );

    IF public.admin_analytics_submission_row_in_scope(m.platform) THEN
      PERFORM public.admin_analytics_apply_submission_rollup_delta(
        OLD.contest_id,
        m.day_key,
        m.status,
        m.platform,
        -1,
        -m.views,
        -m.likes,
        -m.comments,
        -m.shares,
        -m.payouts_cents
      );

      IF OLD.creator_id IS NOT NULL THEN
        PERFORM public.admin_analytics_apply_creator_rollup_delta(
          OLD.contest_id,
          OLD.creator_id,
          m.day_key,
          m.status,
          m.platform,
          -1,
          -m.views,
          -m.payouts_cents
        );
      END IF;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT c.platform, c.contest_based_details
    INTO c_platform, c_details
    FROM public.contests c
    WHERE c.id = NEW.contest_id;

    SELECT * INTO m
    FROM public.admin_analytics_compute_row_metrics(
      NEW.created_at,
      NEW.status::text,
      NEW.platform,
      c_platform,
      c_details,
      COALESCE(NEW.views, 0)::bigint,
      COALESCE(NEW.other_stats, '{}'::jsonb),
      COALESCE(NEW.earnings, 0)::bigint,
      COALESCE(NEW.bonus_amount, 0)::bigint
    );

    IF public.admin_analytics_submission_row_in_scope(m.platform) THEN
      PERFORM public.admin_analytics_apply_submission_rollup_delta(
        NEW.contest_id,
        m.day_key,
        m.status,
        m.platform,
        1,
        m.views,
        m.likes,
        m.comments,
        m.shares,
        m.payouts_cents
      );

      IF NEW.creator_id IS NOT NULL THEN
        PERFORM public.admin_analytics_apply_creator_rollup_delta(
          NEW.contest_id,
          NEW.creator_id,
          m.day_key,
          m.status,
          m.platform,
          1,
          m.views,
          m.payouts_cents
        );
      END IF;
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
  c_platform text;
  c_details jsonb;
  m record;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT c.platform, c.contest_based_details
    INTO c_platform, c_details
    FROM public.contests c
    WHERE c.id = OLD.contest_id;

    SELECT * INTO m
    FROM public.admin_analytics_compute_row_metrics(
      OLD.created_at,
      OLD.status::text,
      OLD.platform,
      c_platform,
      c_details,
      COALESCE(OLD.views, 0)::bigint,
      COALESCE(OLD.other_stats, '{}'::jsonb),
      COALESCE(OLD.earnings, 0)::bigint,
      COALESCE(OLD.bonus_amount, 0)::bigint
    );

    IF public.admin_analytics_pc_row_in_scope(m.platform) THEN
      PERFORM public.admin_analytics_apply_pc_rollup_delta(
        OLD.contest_id,
        m.day_key,
        m.status,
        m.platform,
        -1,
        -m.views,
        -m.likes,
        -m.comments,
        -m.shares,
        -m.payouts_cents
      );

      IF OLD.creator_id IS NOT NULL THEN
        PERFORM public.admin_analytics_apply_pc_creator_rollup_delta(
          OLD.contest_id,
          OLD.creator_id,
          m.day_key,
          m.status,
          m.platform,
          -1,
          -m.views,
          -m.payouts_cents
        );
      END IF;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT c.platform, c.contest_based_details
    INTO c_platform, c_details
    FROM public.contests c
    WHERE c.id = NEW.contest_id;

    SELECT * INTO m
    FROM public.admin_analytics_compute_row_metrics(
      NEW.created_at,
      NEW.status::text,
      NEW.platform,
      c_platform,
      c_details,
      COALESCE(NEW.views, 0)::bigint,
      COALESCE(NEW.other_stats, '{}'::jsonb),
      COALESCE(NEW.earnings, 0)::bigint,
      COALESCE(NEW.bonus_amount, 0)::bigint
    );

    IF public.admin_analytics_pc_row_in_scope(m.platform) THEN
      PERFORM public.admin_analytics_apply_pc_rollup_delta(
        NEW.contest_id,
        m.day_key,
        m.status,
        m.platform,
        1,
        m.views,
        m.likes,
        m.comments,
        m.shares,
        m.payouts_cents
      );

      IF NEW.creator_id IS NOT NULL THEN
        PERFORM public.admin_analytics_apply_pc_creator_rollup_delta(
          NEW.contest_id,
          NEW.creator_id,
          m.day_key,
          m.status,
          m.platform,
          1,
          m.views,
          m.payouts_cents
        );
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_analytics_submissions_rollup
  ON public.submissions;
CREATE TRIGGER trg_admin_analytics_submissions_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_analytics_submissions_rollup_trigger();

DROP TRIGGER IF EXISTS trg_admin_analytics_pc_rollup
  ON public.post_campaign_submission_metrics;
CREATE TRIGGER trg_admin_analytics_pc_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.post_campaign_submission_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_analytics_pc_rollup_trigger();

DROP FUNCTION IF EXISTS public.admin_analytics_reconcile_recent_rollups(
  integer, boolean
);
DROP FUNCTION IF EXISTS public.admin_analytics_reconcile_rollups(
  date, date, boolean
);
DROP TABLE IF EXISTS public.admin_analytics_rollup_reconciliation_runs;

COMMIT;
