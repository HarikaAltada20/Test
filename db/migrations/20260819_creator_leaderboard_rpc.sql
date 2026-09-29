-- =============================================================================
-- Creator leaderboard: rank + paginate in SQL instead of fetching all users.
--
-- Replaces the load-everyone-sort-in-Node pattern in /api/creators/leaderboard.
-- Returns only the requested page of ranked creators with pre-joined profile
-- data, avoiding the costly LEFT JOIN LATERAL + full table scan.
-- =============================================================================

-- 1. Index for the hot predicate: (user_type, id) WHERE is_active
CREATE INDEX IF NOT EXISTS idx_users_active_type_id
  ON public.users (user_type, id)
  WHERE is_active = true;

-- 2. Main leaderboard RPC: returns a ranked, paginated page of creators.
--    Sorting is done in SQL on the requested metric column.
--    Profile fields are fetched via a plain JOIN (no lateral/row_to_json).
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
  -- creator_profiles columns
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
  -- window total
  total_count          bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
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
      COALESCE(cp.total_money_won, 0)::numeric AS total_money_won,
      COALESCE(cp.total_contests_won, 0)::int AS total_contests_won,
      COALESCE(cp.total_contests_participated, 0)::int AS total_contests_participated,
      COALESCE(cp.total_views, 0)::bigint AS total_views,
      COALESCE(cp.total_submissions_made, 0)::int AS total_submissions_made,
      COALESCE(cp.total_submissions_won, 0)::int AS total_submissions_won
    FROM public.users u
    LEFT JOIN public.creator_profiles cp ON cp.id = u.id
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
      -- tie-breakers
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

REVOKE ALL ON FUNCTION public.get_creator_leaderboard_page(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_leaderboard_page(text, int, int)
  TO anon, authenticated, service_role;

-- 3. Summary stats RPC: returns aggregate counts without fetching all rows.
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
    AND u.user_type IN ('creator', 'advertiser');
$$;

REVOKE ALL ON FUNCTION public.get_creator_leaderboard_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_leaderboard_summary()
  TO anon, authenticated, service_role;

-- =============================================================================
-- 4. Platform-specific leaderboard page (youtube / instagram / tiktok).
--    Joins users + profiles + submission aggregates for the given platform,
--    ranks and paginates in SQL. Only creators with activity on the platform
--    are returned (unless sorting by referrals/coins/affiliate which include
--    all users).
-- =============================================================================
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
  -- platform-specific metrics from submissions
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
    INNER JOIN platform_metrics pm ON pm.creator_id = u.id
    WHERE u.is_active = true
      AND u.user_type = 'creator'
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

REVOKE ALL ON FUNCTION public.get_platform_leaderboard_page(text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_leaderboard_page(text, text, int, int)
  TO anon, authenticated, service_role;

-- =============================================================================
-- 5. Twitter platform leaderboard page.
--    Aggregates from twitter_campaign_leaderboard, twitter_campaign_participants,
--    and twitter_campaign_tweets — all in SQL with GROUP BY + LIMIT/OFFSET.
-- =============================================================================
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
      c.winnings AS platform_winnings,
      c.submissions_won AS platform_submissions_won,
      c.submissions_made AS platform_submissions_made,
      c.contests_participated AS platform_contests_participated,
      c.contests_won AS platform_contests_won,
      c.total_views AS platform_views
    FROM combined c
    INNER JOIN public.users u ON u.id = c.creator_id
    LEFT JOIN public.creator_profiles cp ON cp.id = u.id
    WHERE u.is_active = true
      AND u.user_type = 'creator'
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

REVOKE ALL ON FUNCTION public.get_twitter_leaderboard_page(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_twitter_leaderboard_page(text, int, int)
  TO anon, authenticated, service_role;

-- 6. Index for twitter_campaign_leaderboard lookups by contest
CREATE INDEX IF NOT EXISTS idx_twitter_campaign_lb_contest_creator
  ON public.twitter_campaign_leaderboard (contest_id, creator_id);

-- 7. Index for twitter_campaign_participants lookups
CREATE INDEX IF NOT EXISTS idx_twitter_campaign_participants_contest_creator
  ON public.twitter_campaign_participants (contest_id, creator_id);

-- 8. Index for twitter_campaign_tweets paid lookups
CREATE INDEX IF NOT EXISTS idx_twitter_campaign_tweets_paid
  ON public.twitter_campaign_tweets (contest_id, creator_id)
  WHERE moderation_status = 'paid';

-- 9. Index for contests platform filter
CREATE INDEX IF NOT EXISTS idx_contests_platform
  ON public.contests (platform);
