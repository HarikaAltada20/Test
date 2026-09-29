-- Batch/incremental contest_stats write path.
-- Status/moderation use cheap counter/view deltas (bulk-safe).
-- Remove per-row full recompute on views / impressions (metrics jobs + cron refresh instead).
-- Optional: SET LOCAL app.skip_contest_stats_refresh = '1' then call refresh_contest_stats once.
-- Contest_id moves still full-recompute both sides.

COMMENT ON TABLE public.contest_stats IS
  'Cached list-card metrics per contest. Status/moderation use incremental deltas; views/impressions refresh after metrics jobs and stale cron.';

-- DROP first: CREATE OR REPLACE cannot rename input params (e.g. p_moderation_status → p_status).
DROP FUNCTION IF EXISTS public.contest_stats_submission_bucket(public.submission_status_enum);
DROP FUNCTION IF EXISTS public.contest_stats_twitter_bucket(text);
DROP FUNCTION IF EXISTS public.contest_stats_apply_delta(uuid, bigint, integer, integer, integer);
DROP FUNCTION IF EXISTS public.contest_stats_skip_refresh();

CREATE OR REPLACE FUNCTION public.contest_stats_submission_bucket(
  p_status public.submission_status_enum
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status IN (
      'verified'::public.submission_status_enum,
      'paid'::public.submission_status_enum
    ) THEN 'verified'
    WHEN p_status = 'rejected'::public.submission_status_enum THEN 'rejected'
    ELSE 'pending'
  END;
$$;

CREATE OR REPLACE FUNCTION public.contest_stats_twitter_bucket(
  p_status text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(COALESCE(p_status, 'pending'))
    WHEN 'verified' THEN 'verified'
    WHEN 'paid' THEN 'verified'
    WHEN 'rejected' THEN 'rejected'
    ELSE 'pending'
  END;
$$;

CREATE OR REPLACE FUNCTION public.contest_stats_apply_delta(
  p_contest_id uuid,
  p_views_delta bigint,
  p_verified_delta integer,
  p_pending_delta integer,
  p_rejected_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_contest_id IS NULL THEN
    RETURN;
  END IF;
  IF p_views_delta = 0
     AND p_verified_delta = 0
     AND p_pending_delta = 0
     AND p_rejected_delta = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.contest_stats (
    contest_id,
    not_rejected_views,
    verified_submission_count,
    pending_submission_count,
    rejected_submission_count,
    updated_at
  )
  VALUES (
    p_contest_id,
    GREATEST(p_views_delta, 0),
    GREATEST(p_verified_delta, 0),
    GREATEST(p_pending_delta, 0),
    GREATEST(p_rejected_delta, 0),
    now()
  )
  ON CONFLICT (contest_id) DO UPDATE SET
    not_rejected_views = GREATEST(
      0,
      public.contest_stats.not_rejected_views + p_views_delta
    ),
    verified_submission_count = GREATEST(
      0,
      public.contest_stats.verified_submission_count + p_verified_delta
    ),
    pending_submission_count = GREATEST(
      0,
      public.contest_stats.pending_submission_count + p_pending_delta
    ),
    rejected_submission_count = GREATEST(
      0,
      public.contest_stats.rejected_submission_count + p_rejected_delta
    ),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.contest_stats_skip_refresh()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.skip_contest_stats_refresh', true), '') IN ('1', 'true', 'on');
$$;

-- Submissions: status / membership only (not views) — incremental deltas
CREATE OR REPLACE FUNCTION public.contest_stats_on_submission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_bucket text;
  v_new_bucket text;
  v_old_views bigint;
  v_new_views bigint;
  v_views_delta bigint;
  v_verified_delta integer := 0;
  v_pending_delta integer := 0;
  v_rejected_delta integer := 0;
BEGIN
  IF public.contest_stats_skip_refresh() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Skip pure views-only updates (bulk metrics sync).
  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id THEN
    RETURN NEW;
  END IF;

  -- Contest moves: full recompute both sides (views + counters stay correct).
  IF TG_OP = 'UPDATE'
     AND OLD.contest_id IS DISTINCT FROM NEW.contest_id THEN
    IF OLD.contest_id IS NOT NULL THEN
      PERFORM public.refresh_contest_stats(OLD.contest_id);
    END IF;
    IF NEW.contest_id IS NOT NULL THEN
      PERFORM public.refresh_contest_stats(NEW.contest_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_new_bucket := public.contest_stats_submission_bucket(NEW.status);
    v_new_views := CASE
      WHEN NEW.status IS DISTINCT FROM 'rejected'::public.submission_status_enum
        THEN GREATEST(COALESCE(NEW.views, 0), 0)
      ELSE 0
    END;
    v_verified_delta := CASE WHEN v_new_bucket = 'verified' THEN 1 ELSE 0 END;
    v_pending_delta := CASE WHEN v_new_bucket = 'pending' THEN 1 ELSE 0 END;
    v_rejected_delta := CASE WHEN v_new_bucket = 'rejected' THEN 1 ELSE 0 END;
    PERFORM public.contest_stats_apply_delta(
      NEW.contest_id,
      v_new_views,
      v_verified_delta,
      v_pending_delta,
      v_rejected_delta
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old_bucket := public.contest_stats_submission_bucket(OLD.status);
    v_old_views := CASE
      WHEN OLD.status IS DISTINCT FROM 'rejected'::public.submission_status_enum
        THEN GREATEST(COALESCE(OLD.views, 0), 0)
      ELSE 0
    END;
    v_verified_delta := CASE WHEN v_old_bucket = 'verified' THEN -1 ELSE 0 END;
    v_pending_delta := CASE WHEN v_old_bucket = 'pending' THEN -1 ELSE 0 END;
    v_rejected_delta := CASE WHEN v_old_bucket = 'rejected' THEN -1 ELSE 0 END;
    PERFORM public.contest_stats_apply_delta(
      OLD.contest_id,
      -v_old_views,
      v_verified_delta,
      v_pending_delta,
      v_rejected_delta
    );
    RETURN OLD;
  END IF;

  -- UPDATE status (same contest_id)
  v_old_bucket := public.contest_stats_submission_bucket(OLD.status);
  v_new_bucket := public.contest_stats_submission_bucket(NEW.status);
  v_old_views := CASE
    WHEN OLD.status IS DISTINCT FROM 'rejected'::public.submission_status_enum
      THEN GREATEST(COALESCE(OLD.views, 0), 0)
    ELSE 0
  END;
  v_new_views := CASE
    WHEN NEW.status IS DISTINCT FROM 'rejected'::public.submission_status_enum
      THEN GREATEST(COALESCE(NEW.views, 0), 0)
    ELSE 0
  END;
  v_views_delta := v_new_views - v_old_views;

  IF v_old_bucket IS DISTINCT FROM v_new_bucket THEN
    IF v_old_bucket = 'verified' THEN v_verified_delta := v_verified_delta - 1; END IF;
    IF v_old_bucket = 'pending' THEN v_pending_delta := v_pending_delta - 1; END IF;
    IF v_old_bucket = 'rejected' THEN v_rejected_delta := v_rejected_delta - 1; END IF;
    IF v_new_bucket = 'verified' THEN v_verified_delta := v_verified_delta + 1; END IF;
    IF v_new_bucket = 'pending' THEN v_pending_delta := v_pending_delta + 1; END IF;
    IF v_new_bucket = 'rejected' THEN v_rejected_delta := v_rejected_delta + 1; END IF;
  END IF;

  PERFORM public.contest_stats_apply_delta(
    NEW.contest_id,
    v_views_delta,
    v_verified_delta,
    v_pending_delta,
    v_rejected_delta
  );
  RETURN NEW;
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
  v_old_bucket text;
  v_new_bucket text;
  v_old_views bigint;
  v_new_views bigint;
  v_views_delta bigint;
  v_verified_delta integer := 0;
  v_pending_delta integer := 0;
  v_rejected_delta integer := 0;
  v_old_active boolean;
  v_new_active boolean;
BEGIN
  IF public.contest_stats_skip_refresh() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Skip pure impressions-only updates (bulk metrics sync).
  IF TG_OP = 'UPDATE'
     AND OLD.moderation_status IS NOT DISTINCT FROM NEW.moderation_status
     AND OLD.contest_id IS NOT DISTINCT FROM NEW.contest_id
     AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN
    RETURN NEW;
  END IF;

  -- Contest moves: full recompute both sides.
  IF TG_OP = 'UPDATE'
     AND OLD.contest_id IS DISTINCT FROM NEW.contest_id THEN
    IF OLD.contest_id IS NOT NULL THEN
      PERFORM public.refresh_contest_stats(OLD.contest_id);
    END IF;
    IF NEW.contest_id IS NOT NULL THEN
      PERFORM public.refresh_contest_stats(NEW.contest_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL THEN
      RETURN NEW;
    END IF;
    v_new_bucket := public.contest_stats_twitter_bucket(NEW.moderation_status);
    v_new_views := CASE
      WHEN lower(COALESCE(NEW.moderation_status, 'pending')) <> 'rejected'
        THEN GREATEST(COALESCE(NEW.impressions, 0), 0)
      ELSE 0
    END;
    v_verified_delta := CASE WHEN v_new_bucket = 'verified' THEN 1 ELSE 0 END;
    v_pending_delta := CASE WHEN v_new_bucket = 'pending' THEN 1 ELSE 0 END;
    v_rejected_delta := CASE WHEN v_new_bucket = 'rejected' THEN 1 ELSE 0 END;
    PERFORM public.contest_stats_apply_delta(
      NEW.contest_id,
      v_new_views,
      v_verified_delta,
      v_pending_delta,
      v_rejected_delta
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NOT NULL THEN
      RETURN OLD;
    END IF;
    v_old_bucket := public.contest_stats_twitter_bucket(OLD.moderation_status);
    v_old_views := CASE
      WHEN lower(COALESCE(OLD.moderation_status, 'pending')) <> 'rejected'
        THEN GREATEST(COALESCE(OLD.impressions, 0), 0)
      ELSE 0
    END;
    v_verified_delta := CASE WHEN v_old_bucket = 'verified' THEN -1 ELSE 0 END;
    v_pending_delta := CASE WHEN v_old_bucket = 'pending' THEN -1 ELSE 0 END;
    v_rejected_delta := CASE WHEN v_old_bucket = 'rejected' THEN -1 ELSE 0 END;
    PERFORM public.contest_stats_apply_delta(
      OLD.contest_id,
      -v_old_views,
      v_verified_delta,
      v_pending_delta,
      v_rejected_delta
    );
    RETURN OLD;
  END IF;

  -- UPDATE moderation / soft-delete (same contest_id)
  v_old_active := OLD.deleted_at IS NULL;
  v_new_active := NEW.deleted_at IS NULL;
  v_old_bucket := public.contest_stats_twitter_bucket(OLD.moderation_status);
  v_new_bucket := public.contest_stats_twitter_bucket(NEW.moderation_status);
  v_old_views := CASE
    WHEN v_old_active
         AND lower(COALESCE(OLD.moderation_status, 'pending')) <> 'rejected'
      THEN GREATEST(COALESCE(OLD.impressions, 0), 0)
    ELSE 0
  END;
  v_new_views := CASE
    WHEN v_new_active
         AND lower(COALESCE(NEW.moderation_status, 'pending')) <> 'rejected'
      THEN GREATEST(COALESCE(NEW.impressions, 0), 0)
    ELSE 0
  END;
  v_views_delta := v_new_views - v_old_views;

  IF v_old_active THEN
    IF v_old_bucket = 'verified' THEN v_verified_delta := v_verified_delta - 1; END IF;
    IF v_old_bucket = 'pending' THEN v_pending_delta := v_pending_delta - 1; END IF;
    IF v_old_bucket = 'rejected' THEN v_rejected_delta := v_rejected_delta - 1; END IF;
  END IF;
  IF v_new_active THEN
    IF v_new_bucket = 'verified' THEN v_verified_delta := v_verified_delta + 1; END IF;
    IF v_new_bucket = 'pending' THEN v_pending_delta := v_pending_delta + 1; END IF;
    IF v_new_bucket = 'rejected' THEN v_rejected_delta := v_rejected_delta + 1; END IF;
  END IF;

  PERFORM public.contest_stats_apply_delta(
    NEW.contest_id,
    v_views_delta,
    v_verified_delta,
    v_pending_delta,
    v_rejected_delta
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contest_stats_on_twitter_tweet_change ON public.twitter_campaign_tweets;
CREATE TRIGGER trg_contest_stats_on_twitter_tweet_change
  AFTER INSERT OR UPDATE OF moderation_status, contest_id, deleted_at OR DELETE
  ON public.twitter_campaign_tweets
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_stats_on_twitter_tweet_change();

COMMENT ON FUNCTION public.refresh_contest_stats(uuid) IS
  'Full recompute of contest_stats. Prefer incremental triggers for status changes; call after metrics jobs or when skipping triggers via app.skip_contest_stats_refresh.';

COMMENT ON FUNCTION public.contest_stats_apply_delta(uuid, bigint, integer, integer, integer) IS
  'Apply cheap counter/view deltas from status/moderation triggers (bulk-safe).';

REVOKE ALL ON FUNCTION public.contest_stats_apply_delta(uuid, bigint, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contest_stats_apply_delta(uuid, bigint, integer, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.contest_stats_apply_delta(uuid, bigint, integer, integer, integer) TO service_role;

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
