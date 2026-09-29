-- Precomputed per-campaign list stats (views + submission status counts).
-- Enables server-side ORDER BY views before LIMIT/OFFSET so lazy pages stay correct.

CREATE TABLE IF NOT EXISTS public.contest_stats (
  contest_id uuid PRIMARY KEY REFERENCES public.contests(id) ON DELETE CASCADE,
  not_rejected_views bigint NOT NULL DEFAULT 0,
  verified_submission_count integer NOT NULL DEFAULT 0,
  pending_submission_count integer NOT NULL DEFAULT 0,
  rejected_submission_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_stats_nonneg CHECK (
    not_rejected_views >= 0
    AND verified_submission_count >= 0
    AND pending_submission_count >= 0
    AND rejected_submission_count >= 0
  )
);

CREATE INDEX IF NOT EXISTS contest_stats_not_rejected_views_desc_idx
  ON public.contest_stats (not_rejected_views DESC);

CREATE INDEX IF NOT EXISTS contest_stats_verified_submission_count_desc_idx
  ON public.contest_stats (verified_submission_count DESC);

COMMENT ON TABLE public.contest_stats IS
  'Cached list-card metrics per contest. Rows seeded empty on migrate; filled by status triggers, metrics jobs, and refresh-stale-contest-stats cron.';

-- ---------------------------------------------------------------------------
-- Recompute one contest (or all when p_contest_id is null)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_contest_stats(p_contest_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH contest_ids AS (
    SELECT c.id
    FROM public.contests c
    WHERE p_contest_id IS NULL OR c.id = p_contest_id
  ),
  submission_agg AS (
    SELECT
      s.contest_id,
      COALESCE(SUM(
        CASE
          WHEN s.status IS DISTINCT FROM 'rejected'::public.submission_status_enum
            THEN GREATEST(COALESCE(s.views, 0), 0)
          ELSE 0
        END
      ), 0)::bigint AS views_sum,
      COUNT(*) FILTER (
        WHERE s.status IN (
          'verified'::public.submission_status_enum,
          'paid'::public.submission_status_enum
        )
      )::integer AS verified_count,
      COUNT(*) FILTER (
        WHERE s.status = 'pending'::public.submission_status_enum
          OR s.status IS NULL
      )::integer AS pending_count,
      COUNT(*) FILTER (
        WHERE s.status = 'rejected'::public.submission_status_enum
      )::integer AS rejected_count
    FROM public.submissions s
    INNER JOIN contest_ids ci ON ci.id = s.contest_id
    GROUP BY s.contest_id
  ),
  twitter_agg AS (
    SELECT
      t.contest_id,
      COALESCE(SUM(
        CASE
          WHEN lower(COALESCE(t.moderation_status, 'pending')) <> 'rejected'
            THEN GREATEST(COALESCE(t.impressions, 0), 0)
          ELSE 0
        END
      ), 0)::bigint AS views_sum,
      COUNT(*) FILTER (
        WHERE lower(COALESCE(t.moderation_status, 'pending')) IN ('verified', 'paid')
      )::integer AS verified_count,
      COUNT(*) FILTER (
        WHERE lower(COALESCE(t.moderation_status, 'pending')) = 'pending'
      )::integer AS pending_count,
      COUNT(*) FILTER (
        WHERE lower(COALESCE(t.moderation_status, 'pending')) = 'rejected'
      )::integer AS rejected_count
    FROM public.twitter_campaign_tweets t
    INNER JOIN contest_ids ci ON ci.id = t.contest_id
    WHERE t.deleted_at IS NULL
    GROUP BY t.contest_id
  ),
  upserted AS (
    INSERT INTO public.contest_stats (
      contest_id,
      not_rejected_views,
      verified_submission_count,
      pending_submission_count,
      rejected_submission_count,
      updated_at
    )
    SELECT
      ci.id,
      COALESCE(sa.views_sum, 0) + COALESCE(ta.views_sum, 0),
      COALESCE(sa.verified_count, 0) + COALESCE(ta.verified_count, 0),
      COALESCE(sa.pending_count, 0) + COALESCE(ta.pending_count, 0),
      COALESCE(sa.rejected_count, 0) + COALESCE(ta.rejected_count, 0),
      now()
    FROM contest_ids ci
    LEFT JOIN submission_agg sa ON sa.contest_id = ci.id
    LEFT JOIN twitter_agg ta ON ta.contest_id = ci.id
    ON CONFLICT (contest_id) DO UPDATE SET
      not_rejected_views = EXCLUDED.not_rejected_views,
      verified_submission_count = EXCLUDED.verified_submission_count,
      pending_submission_count = EXCLUDED.pending_submission_count,
      rejected_submission_count = EXCLUDED.rejected_submission_count,
      updated_at = EXCLUDED.updated_at
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_updated FROM upserted;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.refresh_contest_stats(uuid) IS
  'Recompute contest_stats for one contest (or all contests when null).';

-- Triggers invoke this as SECURITY DEFINER; callers must not be able to
-- trigger a full-catalog recompute (p_contest_id NULL).
REVOKE ALL ON FUNCTION public.refresh_contest_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_contest_stats(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_contest_stats(uuid) TO service_role;

-- Ensure row exists when a contest is created
CREATE OR REPLACE FUNCTION public.contest_stats_ensure_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contest_stats (contest_id)
  VALUES (NEW.id)
  ON CONFLICT (contest_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contest_stats_ensure_row ON public.contests;
CREATE TRIGGER trg_contest_stats_ensure_row
  AFTER INSERT ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_stats_ensure_row();

-- Refresh when submission status/views change
CREATE OR REPLACE FUNCTION public.contest_stats_on_submission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest_id uuid;
BEGIN
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
  AFTER INSERT OR UPDATE OF status, views, contest_id OR DELETE
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_stats_on_submission_change();

-- Refresh when Twitter tweet moderation/impressions change
CREATE OR REPLACE FUNCTION public.contest_stats_on_twitter_tweet_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest_id uuid;
BEGIN
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
  AFTER INSERT OR UPDATE OF moderation_status, impressions, contest_id, deleted_at OR DELETE
  ON public.twitter_campaign_tweets
  FOR EACH ROW
  EXECUTE FUNCTION public.contest_stats_on_twitter_tweet_change();

-- Seed empty contest_stats rows only (fast). Full views/count recompute is
-- deferred to metrics jobs + /api/cron/refresh-stale-contest-stats so this
-- migration stays short on large catalogs.
INSERT INTO public.contest_stats (contest_id)
SELECT c.id
FROM public.contests c
ON CONFLICT (contest_id) DO NOTHING;

ALTER TABLE public.contest_stats ENABLE ROW LEVEL SECURITY;

-- Own contests, published campaigns (opportunity cards), or admin — not open SELECT.
DROP POLICY IF EXISTS contest_stats_select_authenticated ON public.contest_stats;
CREATE POLICY contest_stats_select_authenticated
  ON public.contest_stats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND (
          c.advertiser_id = auth.uid()
          OR c.moderation_status = 'published'::public.contest_moderation_status_enum
          OR EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.user_type = 'admin'
          )
        )
    )
  );
