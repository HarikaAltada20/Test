-- Daily Challenge: all-event winner history indexes + reward summary / top creators RPCs.
-- Eligible winners with a recorded winner_creator_id are treated as paid rewards.

CREATE INDEX IF NOT EXISTS idx_competition_daily_snapshot_history
  ON public.competition_daily_winner_snapshot (period_start DESC, snapshot_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_competition_daily_snapshot_period_category
  ON public.competition_daily_winner_snapshot (period, category, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_competition_daily_snapshot_winners
  ON public.competition_daily_winner_snapshot (winner_creator_id, period_start DESC)
  WHERE winner_creator_id IS NOT NULL AND is_eligible = true;

CREATE OR REPLACE FUNCTION public.get_daily_challenge_rewards_summary(
  p_event_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_paid_minor_units bigint,
  daily_paid_minor_units bigint,
  weekly_paid_minor_units bigint,
  monthly_paid_minor_units bigint,
  total_reward_count bigint,
  daily_reward_count bigint,
  weekly_reward_count bigint,
  monthly_reward_count bigint,
  prize_currency text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH paid AS (
    SELECT
      s.period,
      COALESCE(s.prize_minor_units, 0)::bigint AS prize_minor_units,
      COALESCE(NULLIF(upper(trim(s.prize_currency)), ''), 'INR') AS prize_currency
    FROM public.competition_daily_winner_snapshot s
    WHERE s.winner_creator_id IS NOT NULL
      AND s.is_eligible = true
      AND (p_event_id IS NULL OR s.event_id = p_event_id)
  ),
  currency AS (
    SELECT COALESCE(
      (
        SELECT p.prize_currency
        FROM paid p
        GROUP BY p.prize_currency
        ORDER BY COUNT(*) DESC, p.prize_currency ASC
        LIMIT 1
      ),
      'INR'
    ) AS prize_currency
  )
  SELECT
    COALESCE(SUM(p.prize_minor_units), 0)::bigint AS total_paid_minor_units,
    COALESCE(SUM(p.prize_minor_units) FILTER (WHERE p.period = 'day'), 0)::bigint AS daily_paid_minor_units,
    COALESCE(SUM(p.prize_minor_units) FILTER (WHERE p.period = 'week'), 0)::bigint AS weekly_paid_minor_units,
    COALESCE(SUM(p.prize_minor_units) FILTER (WHERE p.period = 'month'), 0)::bigint AS monthly_paid_minor_units,
    COUNT(*)::bigint AS total_reward_count,
    COUNT(*) FILTER (WHERE p.period = 'day')::bigint AS daily_reward_count,
    COUNT(*) FILTER (WHERE p.period = 'week')::bigint AS weekly_reward_count,
    COUNT(*) FILTER (WHERE p.period = 'month')::bigint AS monthly_reward_count,
    c.prize_currency
  FROM currency c
  LEFT JOIN paid p ON true
  GROUP BY c.prize_currency;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_challenge_top_creators(
  p_limit integer DEFAULT 10,
  p_event_id uuid DEFAULT NULL
)
RETURNS TABLE (
  creator_id uuid,
  username text,
  full_name text,
  profile_picture_url text,
  win_count bigint,
  total_paid_minor_units bigint,
  daily_wins bigint,
  weekly_wins bigint,
  monthly_wins bigint,
  prize_currency text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH paid AS (
    SELECT
      s.winner_creator_id AS creator_id,
      s.period,
      COALESCE(s.prize_minor_units, 0)::bigint AS prize_minor_units,
      COALESCE(NULLIF(upper(trim(s.prize_currency)), ''), 'INR') AS prize_currency
    FROM public.competition_daily_winner_snapshot s
    WHERE s.winner_creator_id IS NOT NULL
      AND s.is_eligible = true
      AND (p_event_id IS NULL OR s.event_id = p_event_id)
  ),
  aggregated AS (
    SELECT
      p.creator_id,
      COUNT(*)::bigint AS win_count,
      COALESCE(SUM(p.prize_minor_units), 0)::bigint AS total_paid_minor_units,
      COUNT(*) FILTER (WHERE p.period = 'day')::bigint AS daily_wins,
      COUNT(*) FILTER (WHERE p.period = 'week')::bigint AS weekly_wins,
      COUNT(*) FILTER (WHERE p.period = 'month')::bigint AS monthly_wins,
      COALESCE(
        (
          SELECT p2.prize_currency
          FROM paid p2
          WHERE p2.creator_id = p.creator_id
          GROUP BY p2.prize_currency
          ORDER BY COUNT(*) DESC, p2.prize_currency ASC
          LIMIT 1
        ),
        'INR'
      ) AS prize_currency
    FROM paid p
    GROUP BY p.creator_id
  )
  SELECT
    a.creator_id,
    COALESCE(u.username, u.full_name, 'Creator') AS username,
    u.full_name,
    u.profile_picture_url,
    a.win_count,
    a.total_paid_minor_units,
    a.daily_wins,
    a.weekly_wins,
    a.monthly_wins,
    a.prize_currency
  FROM aggregated a
  LEFT JOIN public.users u ON u.id = a.creator_id
  ORDER BY a.total_paid_minor_units DESC, a.win_count DESC, a.creator_id ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 10));
$$;

REVOKE ALL ON FUNCTION public.get_daily_challenge_rewards_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_daily_challenge_top_creators(integer, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_daily_challenge_rewards_summary(uuid)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_daily_challenge_top_creators(integer, uuid)
  TO authenticated, service_role;
