-- Batch/incremental contest_stats write path.
-- Keep cheap refreshes on status / insert / delete / contest_id moves.
-- Remove per-row full recompute on views / impressions (metrics jobs + cron refresh instead).

COMMENT ON TABLE public.contest_stats IS
  'Cached list-card metrics per contest. Status/moderation changes refresh via triggers; views/impressions refresh after metrics jobs and stale cron.';

-- Submissions: status / membership only (not views)
CREATE OR REPLACE FUNCTION public.contest_stats_on_submission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest_id uuid;
BEGIN
  -- Skip pure views-only updates (bulk metrics sync). Status/contest_id still refresh.
  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id THEN
    RETURN NEW;
  END IF;

  v_contest_id := COALESCE(NEW.contest_id, OLD.contest_id);
  IF v_contest_id IS NOT NULL THEN
    PERFORM public.refresh_contest_stats(v_contest_id);
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.contest_id IS DISTINCT FROM NEW.contest_id
     AND OLD.contest_id IS NOT NULL THEN
    PERFORM public.refresh_contest_stats(OLD.contest_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_contest_stats_on_submission_change ON public.submissions;
CREATE TRIGGER trg_contest_stats_on_submission_change
  AFTER INSERT OR UPDATE OF status, contest_id OR DELETE
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_stats_on_submission_change();

-- Twitter tweets: moderation / soft-delete / membership only (not impressions)
CREATE OR REPLACE FUNCTION public.contest_stats_on_twitter_tweet_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest_id uuid;
BEGIN
  -- Skip pure impressions-only updates (bulk metrics sync).
  IF TG_OP = 'UPDATE'
     AND OLD.moderation_status IS NOT DISTINCT FROM NEW.moderation_status
     AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id
     AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN
    RETURN NEW;
  END IF;

  v_contest_id := COALESCE(NEW.contest_id, OLD.contest_id);
  IF v_contest_id IS NOT NULL THEN
    PERFORM public.refresh_contest_stats(v_contest_id);
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.contest_id IS DISTINCT FROM NEW.contest_id
     AND OLD.contest_id IS NOT NULL THEN
    PERFORM public.refresh_contest_stats(OLD.contest_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_contest_stats_on_twitter_tweet_change ON public.twitter_campaign_tweets;
CREATE TRIGGER trg_contest_stats_on_twitter_tweet_change
  AFTER INSERT OR UPDATE OF moderation_status, contest_id, deleted_at OR DELETE
  ON public.twitter_campaign_tweets
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_stats_on_twitter_tweet_change();

COMMENT ON FUNCTION public.refresh_contest_stats(uuid) IS
  'Recompute contest_stats for one contest (or all when null). Call after metrics jobs; status triggers still invoke per contest.';

-- Safety-net: contests whose metrics landed after stats refresh, or missing stats rows.
CREATE OR REPLACE FUNCTION public.find_stale_contest_stats_ids(
  p_limit integer DEFAULT 50,
  p_stale_minutes integer DEFAULT 15
)
RETURNS TABLE (contest_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    -- Metrics bumped after last stats recompute
    SELECT c.id AS contest_id, 1 AS priority, c.last_metrics_updated AS sort_at
    FROM public.contests c
    LEFT JOIN public.contest_stats cs ON cs.contest_id = c.id
    WHERE c.last_metrics_updated IS NOT NULL
      AND (
        cs.updated_at IS NULL
        OR c.last_metrics_updated > cs.updated_at + interval '1 second'
      )

    UNION ALL

    -- Live published campaigns with old stats (repair silent drift).
    -- `status` is computed on contests_with_status, not a contests column.
    SELECT c.id AS contest_id, 2 AS priority, cs.updated_at AS sort_at
    FROM public.contests c
    INNER JOIN public.contest_stats cs ON cs.contest_id = c.id
    WHERE c.moderation_status = 'published'::public.contest_moderation_status_enum
      AND c.start_date IS NOT NULL
      AND c.end_date IS NOT NULL
      AND (now() AT TIME ZONE 'UTC') >= c.start_date
      AND (now() AT TIME ZONE 'UTC') < c.end_date
      AND cs.updated_at < now() - make_interval(mins => GREATEST(p_stale_minutes, 1))

    UNION ALL

    -- Contests with no stats row at all
    SELECT c.id AS contest_id, 0 AS priority, c.created_at AS sort_at
    FROM public.contests c
    LEFT JOIN public.contest_stats cs ON cs.contest_id = c.id
    WHERE cs.contest_id IS NULL
  )
  SELECT contest_id
  FROM (
    SELECT DISTINCT ON (candidates.contest_id)
      candidates.contest_id,
      candidates.priority,
      candidates.sort_at
    FROM candidates
    ORDER BY candidates.contest_id, candidates.priority ASC, candidates.sort_at DESC NULLS LAST
  ) ranked
  ORDER BY ranked.priority ASC, ranked.sort_at DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

REVOKE ALL ON FUNCTION public.find_stale_contest_stats_ids(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_stale_contest_stats_ids(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_stale_contest_stats_ids(integer, integer) TO service_role;
