-- Bulk queue progress RPCs, bulk job RLS, and leaderboard parity (Twitter merge + platform sorts).
-- Required by: process-bulk-payment-queue, process-bulk-verify-queue, /api/creators/leaderboard
-- Run after: 20260820_bulk_payment_jobs.sql, 20260820_bulk_submission_moderation_jobs.sql, 20260819_creator_leaderboard_rpc.sql

-- =============================================================================
-- 1. Atomic bulk job progress (avoids read-modify-write races in queue workers)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.touch_bulk_payment_job_running(p_job_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bulk_payment_jobs
  SET
    status = 'running',
    started_at = COALESCE(started_at, now()),
    updated_at = now()
  WHERE id = p_job_id
    AND status IN ('queued', 'running');
$$;

CREATE OR REPLACE FUNCTION public.apply_bulk_payment_job_batch_progress(
  p_job_id uuid,
  p_processed_delta integer,
  p_success_delta integer,
  p_failed_delta integer,
  p_amount_delta bigint,
  p_cpm_delta bigint,
  p_bonus_delta bigint,
  p_milestone_delta bigint,
  p_mark_completed boolean,
  p_error_message text DEFAULT NULL,
  p_queue_offset integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bulk_payment_jobs
  SET
    processed_count = processed_count + GREATEST(0, COALESCE(p_processed_delta, 0)),
    success_count = success_count + GREATEST(0, COALESCE(p_success_delta, 0)),
    failed_count = failed_count + GREATEST(0, COALESCE(p_failed_delta, 0)),
    total_amount_cents = total_amount_cents + COALESCE(p_amount_delta, 0),
    total_cpm_cents = total_cpm_cents + COALESCE(p_cpm_delta, 0),
    total_bonus_cents = total_bonus_cents + COALESCE(p_bonus_delta, 0),
    total_milestone_cents = total_milestone_cents + COALESCE(p_milestone_delta, 0),
    queue_offset = CASE
      WHEN p_queue_offset IS NOT NULL THEN GREATEST(0, p_queue_offset)
      ELSE queue_offset
    END,
    status = CASE WHEN p_mark_completed THEN 'completed' ELSE 'running' END,
    error_message = COALESCE(p_error_message, error_message),
    finished_at = CASE WHEN p_mark_completed THEN now() ELSE finished_at END,
    updated_at = now()
  WHERE id = p_job_id
    AND status IN ('queued', 'running');
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_bulk_submission_moderation_job_running(p_job_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bulk_submission_moderation_jobs
  SET
    status = 'running',
    started_at = COALESCE(started_at, now()),
    updated_at = now()
  WHERE id = p_job_id
    AND status IN ('queued', 'running');
$$;

CREATE OR REPLACE FUNCTION public.apply_bulk_submission_moderation_job_batch_progress(
  p_job_id uuid,
  p_processed_delta integer,
  p_success_delta integer,
  p_failed_delta integer,
  p_mark_completed boolean,
  p_error_message text DEFAULT NULL,
  p_queue_offset integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bulk_submission_moderation_jobs
  SET
    processed_count = processed_count + GREATEST(0, COALESCE(p_processed_delta, 0)),
    success_count = success_count + GREATEST(0, COALESCE(p_success_delta, 0)),
    failed_count = failed_count + GREATEST(0, COALESCE(p_failed_delta, 0)),
    queue_offset = CASE
      WHEN p_queue_offset IS NOT NULL THEN GREATEST(0, p_queue_offset)
      ELSE queue_offset
    END,
    status = CASE WHEN p_mark_completed THEN 'completed' ELSE 'running' END,
    error_message = COALESCE(p_error_message, error_message),
    finished_at = CASE WHEN p_mark_completed THEN now() ELSE finished_at END,
    updated_at = now()
  WHERE id = p_job_id
    AND status IN ('queued', 'running');
END;
$$;

REVOKE ALL ON FUNCTION public.touch_bulk_payment_job_running(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_bulk_payment_job_batch_progress(uuid, integer, integer, integer, bigint, bigint, bigint, bigint, boolean, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_bulk_submission_moderation_job_running(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_bulk_submission_moderation_job_batch_progress(uuid, integer, integer, integer, boolean, text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.touch_bulk_payment_job_running(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_bulk_payment_job_batch_progress(uuid, integer, integer, integer, bigint, bigint, bigint, bigint, boolean, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_bulk_submission_moderation_job_running(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_bulk_submission_moderation_job_batch_progress(uuid, integer, integer, integer, boolean, text, integer) TO service_role;

-- =============================================================================
-- 2. Restrict bulk job tables to service role (API uses createAdminClient)
-- =============================================================================

ALTER TABLE public.bulk_payment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_submission_moderation_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bulk_payment_jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.bulk_submission_moderation_jobs FROM anon, authenticated;
GRANT ALL ON TABLE public.bulk_payment_jobs TO service_role;
GRANT ALL ON TABLE public.bulk_submission_moderation_jobs TO service_role;

-- Upgrade path: durable job payloads + queue cursor (slim Redis queue refs).
ALTER TABLE public.bulk_payment_jobs
  ADD COLUMN IF NOT EXISTS payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS queue_offset integer NOT NULL DEFAULT 0;

ALTER TABLE public.bulk_submission_moderation_jobs
  ADD COLUMN IF NOT EXISTS payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS queue_offset integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.bulk_payment_jobs.payload IS
  'Durable job data: { "items": [{ "creatorId", "submissionIds" }] }';
COMMENT ON COLUMN public.bulk_payment_jobs.queue_offset IS
  'Creator index for the next queue batch (0-based into payload.items).';

COMMENT ON COLUMN public.bulk_submission_moderation_jobs.payload IS
  'Durable job data: { "submissionIds": [...], optional wallet preflight fields }';
COMMENT ON COLUMN public.bulk_submission_moderation_jobs.queue_offset IS
  'Submission index for the next queue batch (0-based into payload.submissionIds).';

-- =============================================================================
-- 3. Leaderboard: merge Twitter into all-platform rankings + summary
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_creator_leaderboard_page(
  p_sort_by    text    DEFAULT 'winnings',
  p_limit      int     DEFAULT 25,
  p_offset     int     DEFAULT 0
)
RETURNS TABLE (
  user_id              uuid,
  username             text,
  full_name            text,
  profile_picture_url  text,
  user_type            text,
  total_lifetime_coins_earned bigint,
  advertisers_referred int,
  creators_referred    int,
  affiliate_earnings   numeric,
  other_earnings       numeric,
  youtube_account      jsonb,
  instagram_account    jsonb,
  twitter_account      jsonb,
  tiktok_account       jsonb,
  total_money_won      numeric,
  total_contests_won   int,
  total_contests_participated int,
  total_views          bigint,
  total_submissions_made int,
  total_submissions_won int,
  total_count          bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH twitter_contests AS (
    SELECT id FROM public.contests WHERE platform = 'twitter'
  ),
  twitter_lb AS (
    SELECT
      lb.creator_id,
      COALESCE(SUM(lb.earnings), 0)::bigint AS winnings,
      COUNT(DISTINCT lb.contest_id) FILTER (
        WHERE lower(lb.moderation_status) <> 'rejected'
      )::bigint AS contests_participated,
      COUNT(*) FILTER (
        WHERE lower(lb.moderation_status) = 'paid'
      )::bigint AS contests_won,
      COALESCE(SUM(lb.total_impressions), 0)::bigint AS total_views
    FROM public.twitter_campaign_leaderboard lb
    WHERE lb.contest_id IN (SELECT id FROM twitter_contests)
    GROUP BY lb.creator_id
  ),
  twitter_participants AS (
    SELECT
      p.creator_id,
      COALESCE(SUM(p.total_tweets_tracked), 0)::bigint AS submissions_made
    FROM public.twitter_campaign_participants p
    WHERE p.contest_id IN (SELECT id FROM twitter_contests)
    GROUP BY p.creator_id
  ),
  twitter_paid AS (
    SELECT
      t.creator_id,
      COUNT(*)::bigint AS submissions_won
    FROM public.twitter_campaign_tweets t
    WHERE t.contest_id IN (SELECT id FROM twitter_contests)
      AND t.moderation_status = 'paid'
    GROUP BY t.creator_id
  ),
  twitter_metrics AS (
    SELECT
      COALESCE(lb.creator_id, pm.creator_id, pw.creator_id) AS creator_id,
      COALESCE(lb.winnings, 0)::bigint AS winnings,
      COALESCE(pm.submissions_made, 0)::bigint AS submissions_made,
      COALESCE(pw.submissions_won, 0)::bigint AS submissions_won,
      COALESCE(lb.contests_participated, 0)::bigint AS contests_participated,
      COALESCE(lb.contests_won, 0)::bigint AS contests_won,
      COALESCE(lb.total_views, 0)::bigint AS total_views
    FROM twitter_lb lb
    FULL OUTER JOIN twitter_participants pm ON pm.creator_id = lb.creator_id
    FULL OUTER JOIN twitter_paid pw ON pw.creator_id = COALESCE(lb.creator_id, pm.creator_id)
  ),
  base AS (
    SELECT
      u.id,
      u.username,
      u.full_name,
      u.profile_picture_url,
      u.user_type,
      COALESCE(u.total_lifetime_coins_earned, 0)::bigint AS total_lifetime_coins_earned,
      COALESCE(u.advertisers_referred, 0)::int AS advertisers_referred,
      COALESCE(u.creators_referred, 0)::int AS creators_referred,
      COALESCE(u.affiliate_earnings, 0)::numeric AS affiliate_earnings,
      COALESCE(u.other_earnings, 0)::numeric AS other_earnings,
      cp.youtube_account,
      cp.instagram_account,
      cp.twitter_account,
      cp.tiktok_account,
      (COALESCE(cp.total_money_won, 0) + COALESCE(tm.winnings, 0))::numeric AS total_money_won,
      (COALESCE(cp.total_contests_won, 0) + COALESCE(tm.contests_won, 0))::int AS total_contests_won,
      (COALESCE(cp.total_contests_participated, 0) + COALESCE(tm.contests_participated, 0))::int AS total_contests_participated,
      (COALESCE(cp.total_views, 0) + COALESCE(tm.total_views, 0))::bigint AS total_views,
      (COALESCE(cp.total_submissions_made, 0) + COALESCE(tm.submissions_made, 0))::int AS total_submissions_made,
      (COALESCE(cp.total_submissions_won, 0) + COALESCE(tm.submissions_won, 0))::int AS total_submissions_won
    FROM public.users u
    LEFT JOIN public.creator_profiles cp ON cp.id = u.id
    LEFT JOIN twitter_metrics tm ON tm.creator_id = u.id
    WHERE u.is_active = true
      AND u.user_type IN ('creator', 'advertiser')
  ),
  counted AS (
    SELECT *, count(*) OVER ()::bigint AS total_count
    FROM base
    ORDER BY
      CASE p_sort_by
        WHEN 'winnings' THEN total_money_won
        WHEN 'affiliate_and_other_earnings' THEN affiliate_earnings + other_earnings
        ELSE 0
      END DESC,
      CASE p_sort_by
        WHEN 'contests_won' THEN total_contests_won
        WHEN 'contests_participated' THEN total_contests_participated
        WHEN 'submissions_won' THEN total_submissions_won
        WHEN 'submissions_made' THEN total_submissions_made
        WHEN 'verified_views' THEN total_views
        WHEN 'referrals' THEN advertisers_referred + creators_referred
        WHEN 'total_coins' THEN total_lifetime_coins_earned
        ELSE 0
      END DESC,
      total_contests_participated DESC,
      total_submissions_made DESC,
      id ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    c.id,
    c.username,
    c.full_name,
    c.profile_picture_url,
    c.user_type,
    c.total_lifetime_coins_earned,
    c.advertisers_referred,
    c.creators_referred,
    c.affiliate_earnings,
    c.other_earnings,
    c.youtube_account,
    c.instagram_account,
    c.twitter_account,
    c.tiktok_account,
    c.total_money_won,
    c.total_contests_won,
    c.total_contests_participated,
    c.total_views,
    c.total_submissions_made,
    c.total_submissions_won,
    c.total_count
  FROM counted c;
$$;

CREATE OR REPLACE FUNCTION public.get_creator_leaderboard_summary()
RETURNS TABLE (
  total_creators       bigint,
  instagram_creators   bigint,
  youtube_creators     bigint,
  twitter_creators     bigint,
  tiktok_creators      bigint,
  total_contests_won   bigint,
  total_submissions_won bigint,
  total_contests_participated bigint,
  total_submissions_made bigint,
  total_referrals      bigint,
  total_advertisers_referred bigint,
  total_creators_referred bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH twitter_contests AS (
    SELECT id FROM public.contests WHERE platform = 'twitter'
  ),
  twitter_totals AS (
    SELECT
      COALESCE(COUNT(*) FILTER (
        WHERE lower(lb.moderation_status) = 'paid'
      ), 0)::bigint AS contests_won,
      COALESCE(COUNT(DISTINCT (lb.creator_id, lb.contest_id)) FILTER (
        WHERE lower(lb.moderation_status) <> 'rejected'
      ), 0)::bigint AS contests_participated,
      COALESCE(SUM(lb.total_impressions), 0)::bigint AS total_views
    FROM public.twitter_campaign_leaderboard lb
    WHERE lb.contest_id IN (SELECT id FROM twitter_contests)
  ),
  twitter_submissions AS (
    SELECT
      COALESCE(SUM(p.total_tweets_tracked), 0)::bigint AS submissions_made
    FROM public.twitter_campaign_participants p
    WHERE p.contest_id IN (SELECT id FROM twitter_contests)
  ),
  twitter_paid_tweets AS (
    SELECT COUNT(*)::bigint AS submissions_won
    FROM public.twitter_campaign_tweets t
    WHERE t.contest_id IN (SELECT id FROM twitter_contests)
      AND t.moderation_status = 'paid'
  ),
  profile_totals AS (
    SELECT
      COUNT(*) FILTER (WHERE u.user_type = 'creator' AND cp.id IS NOT NULL)::bigint AS total_creators,
      COUNT(*) FILTER (WHERE cp.instagram_account IS NOT NULL)::bigint AS instagram_creators,
      COUNT(*) FILTER (WHERE cp.youtube_account IS NOT NULL)::bigint AS youtube_creators,
      COUNT(*) FILTER (WHERE cp.twitter_account IS NOT NULL)::bigint AS twitter_creators,
      COUNT(*) FILTER (WHERE cp.tiktok_account IS NOT NULL)::bigint AS tiktok_creators,
      COALESCE(SUM(cp.total_contests_won), 0)::bigint AS total_contests_won,
      COALESCE(SUM(cp.total_submissions_won), 0)::bigint AS total_submissions_won,
      COALESCE(SUM(cp.total_contests_participated), 0)::bigint AS total_contests_participated,
      COALESCE(SUM(cp.total_submissions_made), 0)::bigint AS total_submissions_made,
      COALESCE(SUM(COALESCE(u.advertisers_referred, 0) + COALESCE(u.creators_referred, 0)), 0)::bigint AS total_referrals,
      COALESCE(SUM(u.advertisers_referred), 0)::bigint AS total_advertisers_referred,
      COALESCE(SUM(u.creators_referred), 0)::bigint AS total_creators_referred
    FROM public.users u
    LEFT JOIN public.creator_profiles cp ON cp.id = u.id
    WHERE u.is_active = true
      AND u.user_type IN ('creator', 'advertiser')
  )
  SELECT
    pt.total_creators,
    pt.instagram_creators,
    pt.youtube_creators,
    pt.twitter_creators,
    pt.tiktok_creators,
    pt.total_contests_won + tt.contests_won AS total_contests_won,
    pt.total_submissions_won + tp.submissions_won AS total_submissions_won,
    pt.total_contests_participated + tt.contests_participated AS total_contests_participated,
    pt.total_submissions_made + ts.submissions_made AS total_submissions_made,
    pt.total_referrals,
    pt.total_advertisers_referred,
    pt.total_creators_referred
  FROM profile_totals pt
  CROSS JOIN twitter_totals tt
  CROSS JOIN twitter_submissions ts
  CROSS JOIN twitter_paid_tweets tp;
$$;

-- Platform page: include all creators when sorting by referrals/coins/affiliate.
CREATE OR REPLACE FUNCTION public.get_platform_leaderboard_page(
  p_platform   text,
  p_sort_by    text    DEFAULT 'winnings',
  p_limit      int     DEFAULT 25,
  p_offset     int     DEFAULT 0
)
RETURNS TABLE (
  user_id              uuid,
  username             text,
  full_name            text,
  profile_picture_url  text,
  user_type            text,
  total_lifetime_coins_earned bigint,
  advertisers_referred int,
  creators_referred    int,
  affiliate_earnings   numeric,
  other_earnings       numeric,
  youtube_account      jsonb,
  instagram_account    jsonb,
  twitter_account      jsonb,
  tiktok_account       jsonb,
  platform_winnings        bigint,
  platform_submissions_won bigint,
  platform_submissions_made bigint,
  platform_contests_participated bigint,
  platform_contests_won    bigint,
  platform_views           bigint,
  total_count              bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH platform_metrics AS (
    SELECT
      s.creator_id,
      COALESCE(SUM(s.earnings) FILTER (WHERE s.status = 'paid'), 0)::bigint AS winnings,
      COUNT(*)::bigint AS submissions_made,
      COUNT(*) FILTER (WHERE s.status = 'paid')::bigint AS submissions_won,
      COUNT(DISTINCT s.contest_id)::bigint AS contests_participated,
      COUNT(DISTINCT s.contest_id) FILTER (WHERE s.status = 'paid')::bigint AS contests_won,
      COALESCE(SUM(COALESCE(s.views, 0)), 0)::bigint AS total_views
    FROM public.submissions s
    WHERE s.creator_id IS NOT NULL
      AND s.contest_id IS NOT NULL
      AND lower(trim(s.platform)) = lower(trim(p_platform))
    GROUP BY s.creator_id
  ),
  base AS (
    SELECT
      u.id,
      u.username,
      u.full_name,
      u.profile_picture_url,
      u.user_type,
      COALESCE(u.total_lifetime_coins_earned, 0)::bigint AS total_lifetime_coins_earned,
      COALESCE(u.advertisers_referred, 0)::int AS advertisers_referred,
      COALESCE(u.creators_referred, 0)::int AS creators_referred,
      COALESCE(u.affiliate_earnings, 0)::numeric AS affiliate_earnings,
      COALESCE(u.other_earnings, 0)::numeric AS other_earnings,
      cp.youtube_account,
      cp.instagram_account,
      cp.twitter_account,
      cp.tiktok_account,
      COALESCE(pm.winnings, 0)::bigint AS platform_winnings,
      COALESCE(pm.submissions_won, 0)::bigint AS platform_submissions_won,
      COALESCE(pm.submissions_made, 0)::bigint AS platform_submissions_made,
      COALESCE(pm.contests_participated, 0)::bigint AS platform_contests_participated,
      COALESCE(pm.contests_won, 0)::bigint AS platform_contests_won,
      COALESCE(pm.total_views, 0)::bigint AS platform_views
    FROM public.users u
    LEFT JOIN public.creator_profiles cp ON cp.id = u.id
    LEFT JOIN platform_metrics pm ON pm.creator_id = u.id
    WHERE u.is_active = true
      AND u.user_type = 'creator'
      AND (
        p_sort_by IN ('referrals', 'total_coins', 'affiliate_and_other_earnings')
        OR pm.creator_id IS NOT NULL
      )
  ),
  counted AS (
    SELECT *, count(*) OVER ()::bigint AS total_count
    FROM base
    ORDER BY
      CASE p_sort_by
        WHEN 'winnings' THEN platform_winnings
        WHEN 'affiliate_and_other_earnings' THEN (affiliate_earnings + other_earnings)::bigint
        ELSE 0::bigint
      END DESC,
      CASE p_sort_by
        WHEN 'contests_won' THEN platform_contests_won
        WHEN 'contests_participated' THEN platform_contests_participated
        WHEN 'submissions_won' THEN platform_submissions_won
        WHEN 'submissions_made' THEN platform_submissions_made
        WHEN 'verified_views' THEN platform_views
        WHEN 'referrals' THEN (advertisers_referred + creators_referred)::bigint
        WHEN 'total_coins' THEN total_lifetime_coins_earned
        ELSE 0::bigint
      END DESC,
      platform_contests_participated DESC,
      platform_submissions_made DESC,
      id ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    c.id,
    c.username,
    c.full_name,
    c.profile_picture_url,
    c.user_type,
    c.total_lifetime_coins_earned,
    c.advertisers_referred,
    c.creators_referred,
    c.affiliate_earnings,
    c.other_earnings,
    c.youtube_account,
    c.instagram_account,
    c.twitter_account,
    c.tiktok_account,
    c.platform_winnings,
    c.platform_submissions_won,
    c.platform_submissions_made,
    c.platform_contests_participated,
    c.platform_contests_won,
    c.platform_views,
    c.total_count
  FROM counted c;
$$;

-- Twitter page: same global-sort inclusion rule as platform page.
CREATE OR REPLACE FUNCTION public.get_twitter_leaderboard_page(
  p_sort_by    text    DEFAULT 'winnings',
  p_limit      int     DEFAULT 25,
  p_offset     int     DEFAULT 0
)
RETURNS TABLE (
  user_id              uuid,
  username             text,
  full_name            text,
  profile_picture_url  text,
  user_type            text,
  total_lifetime_coins_earned bigint,
  advertisers_referred int,
  creators_referred    int,
  affiliate_earnings   numeric,
  other_earnings       numeric,
  youtube_account      jsonb,
  instagram_account    jsonb,
  twitter_account      jsonb,
  tiktok_account       jsonb,
  platform_winnings        bigint,
  platform_submissions_won bigint,
  platform_submissions_made bigint,
  platform_contests_participated bigint,
  platform_contests_won    bigint,
  platform_views           bigint,
  total_count              bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH twitter_contests AS (
    SELECT id FROM public.contests WHERE platform = 'twitter'
  ),
  lb_metrics AS (
    SELECT
      lb.creator_id,
      COALESCE(SUM(lb.earnings), 0)::bigint AS winnings,
      COUNT(DISTINCT lb.contest_id) FILTER (
        WHERE lower(lb.moderation_status) <> 'rejected'
      )::bigint AS contests_participated,
      COUNT(*) FILTER (
        WHERE lower(lb.moderation_status) = 'paid'
      )::bigint AS contests_won,
      COALESCE(SUM(lb.total_impressions), 0)::bigint AS total_views
    FROM public.twitter_campaign_leaderboard lb
    WHERE lb.contest_id IN (SELECT id FROM twitter_contests)
    GROUP BY lb.creator_id
  ),
  participant_metrics AS (
    SELECT
      p.creator_id,
      COALESCE(SUM(p.total_tweets_tracked), 0)::bigint AS submissions_made
    FROM public.twitter_campaign_participants p
    WHERE p.contest_id IN (SELECT id FROM twitter_contests)
    GROUP BY p.creator_id
  ),
  tweet_metrics AS (
    SELECT
      t.creator_id,
      COUNT(*)::bigint AS submissions_won
    FROM public.twitter_campaign_tweets t
    WHERE t.contest_id IN (SELECT id FROM twitter_contests)
      AND t.moderation_status = 'paid'
    GROUP BY t.creator_id
  ),
  combined AS (
    SELECT
      COALESCE(lb.creator_id, pm.creator_id, tm.creator_id) AS creator_id,
      COALESCE(lb.winnings, 0)::bigint AS winnings,
      COALESCE(pm.submissions_made, 0)::bigint AS submissions_made,
      COALESCE(tm.submissions_won, 0)::bigint AS submissions_won,
      COALESCE(lb.contests_participated, 0)::bigint AS contests_participated,
      COALESCE(lb.contests_won, 0)::bigint AS contests_won,
      COALESCE(lb.total_views, 0)::bigint AS total_views
    FROM lb_metrics lb
    FULL OUTER JOIN participant_metrics pm ON pm.creator_id = lb.creator_id
    FULL OUTER JOIN tweet_metrics tm ON tm.creator_id = COALESCE(lb.creator_id, pm.creator_id)
  ),
  base AS (
    SELECT
      u.id,
      u.username,
      u.full_name,
      u.profile_picture_url,
      u.user_type,
      COALESCE(u.total_lifetime_coins_earned, 0)::bigint AS total_lifetime_coins_earned,
      COALESCE(u.advertisers_referred, 0)::int AS advertisers_referred,
      COALESCE(u.creators_referred, 0)::int AS creators_referred,
      COALESCE(u.affiliate_earnings, 0)::numeric AS affiliate_earnings,
      COALESCE(u.other_earnings, 0)::numeric AS other_earnings,
      cp.youtube_account,
      cp.instagram_account,
      cp.twitter_account,
      cp.tiktok_account,
      COALESCE(c.winnings, 0)::bigint AS platform_winnings,
      COALESCE(c.submissions_won, 0)::bigint AS platform_submissions_won,
      COALESCE(c.submissions_made, 0)::bigint AS platform_submissions_made,
      COALESCE(c.contests_participated, 0)::bigint AS platform_contests_participated,
      COALESCE(c.contests_won, 0)::bigint AS platform_contests_won,
      COALESCE(c.total_views, 0)::bigint AS platform_views
    FROM public.users u
    LEFT JOIN public.creator_profiles cp ON cp.id = u.id
    LEFT JOIN combined c ON c.creator_id = u.id
    WHERE u.is_active = true
      AND u.user_type = 'creator'
      AND (
        p_sort_by IN ('referrals', 'total_coins', 'affiliate_and_other_earnings')
        OR c.creator_id IS NOT NULL
      )
  ),
  counted AS (
    SELECT *, count(*) OVER ()::bigint AS total_count
    FROM base
    ORDER BY
      CASE p_sort_by
        WHEN 'winnings' THEN platform_winnings
        WHEN 'affiliate_and_other_earnings' THEN (affiliate_earnings + other_earnings)::bigint
        ELSE 0::bigint
      END DESC,
      CASE p_sort_by
        WHEN 'contests_won' THEN platform_contests_won
        WHEN 'contests_participated' THEN platform_contests_participated
        WHEN 'submissions_won' THEN platform_submissions_won
        WHEN 'submissions_made' THEN platform_submissions_made
        WHEN 'verified_views' THEN platform_views
        WHEN 'referrals' THEN (advertisers_referred + creators_referred)::bigint
        WHEN 'total_coins' THEN total_lifetime_coins_earned
        ELSE 0::bigint
      END DESC,
      platform_contests_participated DESC,
      platform_submissions_made DESC,
      id ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    c.id,
    c.username,
    c.full_name,
    c.profile_picture_url,
    c.user_type,
    c.total_lifetime_coins_earned,
    c.advertisers_referred,
    c.creators_referred,
    c.affiliate_earnings,
    c.other_earnings,
    c.youtube_account,
    c.instagram_account,
    c.twitter_account,
    c.tiktok_account,
    c.platform_winnings,
    c.platform_submissions_won,
    c.platform_submissions_made,
    c.platform_contests_participated,
    c.platform_contests_won,
    c.platform_views,
    c.total_count
  FROM counted c;
$$;
