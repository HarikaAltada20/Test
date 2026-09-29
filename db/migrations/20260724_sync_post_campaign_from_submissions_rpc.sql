-- Set-based sync: copy submissions → post_campaign_submission_metrics in one statement.
--
-- DEPLOY ORDER: run after 20260715_post_campaign_submission_metrics.sql
-- (needs full overlay columns). Safe to run after later PC migrations too.
--
-- Default: preserve overlay views/other_stats/insights on conflict.
-- p_overwrite_metrics = true copies those from submissions (rare admin path).

CREATE OR REPLACE FUNCTION public.sync_post_campaign_from_submissions(
  p_contest_id uuid,
  p_overwrite_metrics boolean DEFAULT false
)
RETURNS TABLE (
  synced bigint,
  inserted bigint,
  updated bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_synced bigint := 0;
  v_inserted bigint := 0;
  v_updated bigint := 0;
BEGIN
  IF p_contest_id IS NULL THEN
    RAISE EXCEPTION 'p_contest_id is required';
  END IF;

  WITH src AS (
    SELECT
      s.id AS submission_id,
      s.contest_id,
      s.creator_id,
      s.content_link,
      COALESCE(s.views, 0)::bigint AS views,
      s.metadata,
      COALESCE(s.other_stats, '{}'::jsonb) AS other_stats,
      s.created_at,
      s.video_id,
      s.video_title,
      s.video_thumbnail_url,
      s.platform,
      s.last_insights_update,
      s.insights_status,
      s.status,
      s.earnings,
      s.views_locked,
      COALESCE(s.affiliate_paid, false) AS affiliate_paid,
      s.affiliate_metadata,
      COALESCE(s.paid, false) AS paid,
      s.paid_at,
      COALESCE(s.bonus_paid, false) AS bonus_paid,
      s.bonus_paid_at,
      COALESCE(s.bonus_amount, 0) AS bonus_amount,
      s.milestone_bonus_paid,
      s.dual_rewards_payout,
      s.quality_score,
      COALESCE(s.quality_score_backfilled, false) AS quality_score_backfilled,
      s.updated_at AS submission_updated_at
    FROM public.submissions s
    WHERE s.contest_id = p_contest_id
  ),
  upserted AS (
    INSERT INTO public.post_campaign_submission_metrics AS pc (
      submission_id,
      contest_id,
      creator_id,
      content_link,
      views,
      metadata,
      other_stats,
      created_at,
      video_id,
      video_title,
      video_thumbnail_url,
      platform,
      last_insights_update,
      insights_status,
      status,
      earnings,
      views_locked,
      affiliate_paid,
      affiliate_metadata,
      paid,
      paid_at,
      bonus_paid,
      bonus_paid_at,
      bonus_amount,
      milestone_bonus_paid,
      dual_rewards_payout,
      quality_score,
      quality_score_backfilled,
      submission_updated_at,
      synced_at,
      updated_at
    )
    SELECT
      src.submission_id,
      src.contest_id,
      src.creator_id,
      src.content_link,
      src.views,
      src.metadata,
      src.other_stats,
      src.created_at,
      src.video_id,
      src.video_title,
      src.video_thumbnail_url,
      src.platform,
      src.last_insights_update,
      src.insights_status,
      src.status,
      src.earnings,
      src.views_locked,
      src.affiliate_paid,
      src.affiliate_metadata,
      src.paid,
      src.paid_at,
      src.bonus_paid,
      src.bonus_paid_at,
      src.bonus_amount,
      src.milestone_bonus_paid,
      src.dual_rewards_payout,
      src.quality_score,
      src.quality_score_backfilled,
      src.submission_updated_at,
      v_now,
      v_now
    FROM src
    ON CONFLICT (submission_id) DO UPDATE SET
      contest_id = EXCLUDED.contest_id,
      creator_id = EXCLUDED.creator_id,
      content_link = EXCLUDED.content_link,
      metadata = EXCLUDED.metadata,
      created_at = EXCLUDED.created_at,
      video_id = EXCLUDED.video_id,
      video_title = EXCLUDED.video_title,
      video_thumbnail_url = EXCLUDED.video_thumbnail_url,
      platform = EXCLUDED.platform,
      status = EXCLUDED.status,
      earnings = EXCLUDED.earnings,
      views_locked = EXCLUDED.views_locked,
      affiliate_paid = EXCLUDED.affiliate_paid,
      affiliate_metadata = EXCLUDED.affiliate_metadata,
      paid = EXCLUDED.paid,
      paid_at = EXCLUDED.paid_at,
      bonus_paid = EXCLUDED.bonus_paid,
      bonus_paid_at = EXCLUDED.bonus_paid_at,
      bonus_amount = EXCLUDED.bonus_amount,
      milestone_bonus_paid = EXCLUDED.milestone_bonus_paid,
      dual_rewards_payout = EXCLUDED.dual_rewards_payout,
      quality_score = EXCLUDED.quality_score,
      quality_score_backfilled = EXCLUDED.quality_score_backfilled,
      submission_updated_at = EXCLUDED.submission_updated_at,
      synced_at = EXCLUDED.synced_at,
      updated_at = EXCLUDED.updated_at,
      views = CASE
        WHEN p_overwrite_metrics THEN EXCLUDED.views
        ELSE pc.views
      END,
      other_stats = CASE
        WHEN p_overwrite_metrics THEN EXCLUDED.other_stats
        ELSE pc.other_stats
      END,
      last_insights_update = CASE
        WHEN p_overwrite_metrics THEN EXCLUDED.last_insights_update
        ELSE pc.last_insights_update
      END,
      insights_status = CASE
        WHEN p_overwrite_metrics THEN EXCLUDED.insights_status
        ELSE pc.insights_status
      END
    RETURNING (xmax = 0) AS was_inserted
  )
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE was_inserted)::bigint,
    COUNT(*) FILTER (WHERE NOT was_inserted)::bigint
  INTO v_synced, v_inserted, v_updated
  FROM upserted;

  synced := COALESCE(v_synced, 0);
  inserted := COALESCE(v_inserted, 0);
  updated := COALESCE(v_updated, 0);
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.sync_post_campaign_from_submissions(uuid, boolean) IS
  'Copy contest submissions into post_campaign_submission_metrics. On conflict updates snapshot fields; preserves overlay metrics unless p_overwrite_metrics.';

REVOKE ALL ON FUNCTION public.sync_post_campaign_from_submissions(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_post_campaign_from_submissions(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_post_campaign_from_submissions(uuid, boolean) TO service_role;
