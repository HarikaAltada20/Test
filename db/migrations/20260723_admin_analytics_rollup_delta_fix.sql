-- Fix rollup delta apply: subtracting from a missing bucket must not INSERT
-- negative values (violates admin_analytics_*_rollup_nonneg CHECK).
-- Seen when Refresh Metrics UPDATEs post_campaign_submission_metrics rows.
--
-- DEPLOY ORDER: after 20260719_admin_analytics_daily_rollups.sql.

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

  IF p_count_delta < 0
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

  IF p_count_delta < 0
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
