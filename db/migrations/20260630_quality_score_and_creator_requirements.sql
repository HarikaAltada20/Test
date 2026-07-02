-- Quality scores, creator profile caches, and expanded campaign minimums.
--
-- Quality rules (sync_creator_quality_metrics):
--   0 verified, 0 rejected → default 1/3 (new creator or only pending)
--   0 verified, rejected > 0 → null (cannot calculate)
--   verified > 0 → avg/max from scored verified submissions
--
-- Trust rules (sync_creator_trust_score_metrics):
--   Trust Number = verified − rejected
--   Trust Score % = (trust_number ÷ verified) × 100; 100 if no verified/rejected, 0 if rejected only

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS quality_score integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_quality_score_range'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_quality_score_range
      CHECK (quality_score IS NULL OR (quality_score >= 1 AND quality_score <= 3));
  END IF;
END $$;

COMMENT ON COLUMN public.submissions.quality_score IS '1–3 quality rating assigned at verify time. NULL for pending/rejected.';

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS avg_quality_score numeric(6,2) NULL,
  ADD COLUMN IF NOT EXISTS best_quality_score integer NULL;

COMMENT ON COLUMN public.creator_profiles.avg_quality_score IS 'Average quality_score across verified/paid submissions. Default 1 when no verified/rejected reels; null when rejected but none verified.';
COMMENT ON COLUMN public.creator_profiles.best_quality_score IS 'Max quality_score across verified/paid submissions. Default 1 when no verified/rejected reels; null when rejected but none verified.';

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS min_avg_quality_score numeric(4,2) NULL,
  ADD COLUMN IF NOT EXISTS min_best_quality_score integer NULL,
  ADD COLUMN IF NOT EXISTS min_platform_earnings bigint NULL,
  ADD COLUMN IF NOT EXISTS min_platform_views bigint NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contests_min_best_quality_score_range'
  ) THEN
    ALTER TABLE public.contests
      ADD CONSTRAINT contests_min_best_quality_score_range
      CHECK (min_best_quality_score IS NULL OR (min_best_quality_score >= 1 AND min_best_quality_score <= 3));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contests_min_avg_quality_score_range'
  ) THEN
    ALTER TABLE public.contests
      ADD CONSTRAINT contests_min_avg_quality_score_range
      CHECK (min_avg_quality_score IS NULL OR (min_avg_quality_score >= 1 AND min_avg_quality_score <= 3));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_creator_quality_metrics(p_creator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified integer;
  v_rejected integer;
  v_avg numeric;
  v_best integer;
BEGIN
  IF p_creator_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::integer
  INTO v_verified, v_rejected
  FROM public.submissions s
  WHERE s.creator_id = p_creator_id;

  IF COALESCE(v_verified, 0) > 0 THEN
    SELECT
      ROUND(AVG(s.quality_score)::numeric, 2),
      MAX(s.quality_score)::integer
    INTO v_avg, v_best
    FROM public.submissions s
    WHERE s.creator_id = p_creator_id
      AND s.status IN ('verified', 'paid')
      AND s.quality_score IS NOT NULL;
  ELSIF COALESCE(v_rejected, 0) > 0 THEN
    v_avg := NULL;
    v_best := NULL;
  ELSE
    v_avg := 1;
    v_best := 1;
  END IF;

  UPDATE public.creator_profiles
  SET
    avg_quality_score = v_avg,
    best_quality_score = v_best
  WHERE id = p_creator_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_creator_trust_score_metrics(p_creator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_verified integer;
  v_rejected integer;
  v_pending integer;
  v_score integer;
  v_trust_number integer;
BEGIN
  IF p_creator_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::integer,
    COUNT(*) FILTER (WHERE s.status = 'pending')::integer
  INTO v_total, v_verified, v_rejected, v_pending
  FROM public.submissions s
  WHERE s.creator_id = p_creator_id;

  v_trust_number := COALESCE(v_verified, 0) - COALESCE(v_rejected, 0);

  IF COALESCE(v_verified, 0) = 0 THEN
    IF COALESCE(v_rejected, 0) > 0 THEN
      v_score := 0;
    ELSE
      v_score := 100;
    END IF;
  ELSE
    v_score := GREATEST(
      0,
      LEAST(
        100,
        ROUND((v_trust_number::numeric / v_verified::numeric) * 100)
      )
    )::integer;
  END IF;

  UPDATE public.creator_profiles
  SET
    trust_score_metrics = jsonb_build_object(
      'trust_score', v_score,
      'trust_number', v_trust_number,
      'total_reels', COALESCE(v_total, 0),
      'verified_reels', COALESCE(v_verified, 0),
      'rejected_reels', COALESCE(v_rejected, 0),
      'pending_reels', COALESCE(v_pending, 0),
      'updated_at', now()
    )
  WHERE id = p_creator_id;

  PERFORM public.sync_creator_quality_metrics(p_creator_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_submission_creator_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_format text;
  v_min_trust integer;
  v_min_trust_number integer;
  v_min_avg_quality numeric;
  v_min_best_quality integer;
  v_min_earnings bigint;
  v_min_views bigint;
  v_creator_score integer;
  v_creator_trust_number integer;
  v_creator_avg_quality numeric;
  v_creator_best_quality integer;
  v_creator_earnings bigint;
  v_creator_views bigint;
  v_verified integer;
  v_rejected integer;
BEGIN
  SELECT
    c.contest_format,
    c.trust_score,
    c.trust_number,
    c.min_avg_quality_score,
    c.min_best_quality_score,
    c.min_platform_earnings,
    c.min_platform_views
  INTO
    v_format,
    v_min_trust,
    v_min_trust_number,
    v_min_avg_quality,
    v_min_best_quality,
    v_min_earnings,
    v_min_views
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  IF COALESCE(v_format, 'video') = 'text_image' THEN
    RETURN NEW;
  END IF;

  IF v_min_trust IS NULL AND v_min_trust_number IS NULL
     AND v_min_avg_quality IS NULL AND v_min_best_quality IS NULL
     AND v_min_earnings IS NULL AND v_min_views IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    (cp.trust_score_metrics->>'trust_score')::integer,
    (cp.trust_score_metrics->>'trust_number')::integer,
    cp.avg_quality_score,
    cp.best_quality_score,
    COALESCE(cp.total_money_won, 0)::bigint,
    COALESCE(cp.total_views, 0)::bigint
  INTO
    v_creator_score,
    v_creator_trust_number,
    v_creator_avg_quality,
    v_creator_best_quality,
    v_creator_earnings,
    v_creator_views
  FROM public.creator_profiles cp
  WHERE cp.id = NEW.creator_id;

  IF v_creator_score IS NULL OR v_creator_trust_number IS NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer,
      COUNT(*) FILTER (WHERE s.status = 'rejected')::integer
    INTO v_verified, v_rejected
    FROM public.submissions s
    WHERE s.creator_id = NEW.creator_id;

    v_creator_trust_number := COALESCE(v_verified, 0) - COALESCE(v_rejected, 0);

    IF COALESCE(v_verified, 0) = 0 THEN
      IF COALESCE(v_rejected, 0) > 0 THEN
        v_creator_score := 0;
      ELSE
        v_creator_score := 100;
      END IF;
    ELSE
      v_creator_score := GREATEST(
        0,
        LEAST(
          100,
          ROUND((v_creator_trust_number::numeric / v_verified::numeric) * 100)
        )
      )::integer;
    END IF;
  END IF;

  IF v_min_avg_quality IS NOT NULL OR v_min_best_quality IS NOT NULL THEN
    IF v_creator_avg_quality IS NULL OR v_creator_best_quality IS NULL THEN
      IF v_verified IS NULL OR v_rejected IS NULL THEN
        SELECT
          COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer,
          COUNT(*) FILTER (WHERE s.status = 'rejected')::integer
        INTO v_verified, v_rejected
        FROM public.submissions s
        WHERE s.creator_id = NEW.creator_id;
      END IF;

      IF COALESCE(v_verified, 0) > 0 THEN
        SELECT
          ROUND(AVG(s.quality_score)::numeric, 2),
          MAX(s.quality_score)::integer
        INTO v_creator_avg_quality, v_creator_best_quality
        FROM public.submissions s
        WHERE s.creator_id = NEW.creator_id
          AND s.status IN ('verified', 'paid')
          AND s.quality_score IS NOT NULL;
      ELSIF COALESCE(v_rejected, 0) > 0 THEN
        v_creator_avg_quality := NULL;
        v_creator_best_quality := NULL;
      ELSE
        v_creator_avg_quality := 1;
        v_creator_best_quality := 1;
      END IF;
    END IF;
  END IF;

  IF v_min_trust IS NOT NULL AND v_min_trust > 0 AND v_creator_score < v_min_trust THEN
    RAISE EXCEPTION
      'trust_score_too_low: Creator trust score (%) is below campaign minimum (%)',
      v_creator_score, v_min_trust USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_trust_number IS NOT NULL AND v_creator_trust_number < v_min_trust_number THEN
    RAISE EXCEPTION
      'trust_number_too_low: Creator trust number (%) is below campaign minimum (%)',
      v_creator_trust_number, v_min_trust_number USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_best_quality IS NOT NULL AND (
    v_creator_best_quality IS NULL OR v_creator_best_quality < v_min_best_quality
  ) THEN
    RAISE EXCEPTION
      'best_quality_too_low: Creator best quality (%) is below campaign minimum (%)',
      COALESCE(v_creator_best_quality, 0), v_min_best_quality USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_avg_quality IS NOT NULL AND (
    v_creator_avg_quality IS NULL OR v_creator_avg_quality < v_min_avg_quality
  ) THEN
    RAISE EXCEPTION
      'avg_quality_too_low: Creator average quality (%) is below campaign minimum (%)',
      COALESCE(v_creator_avg_quality, 0), v_min_avg_quality USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_earnings IS NOT NULL AND v_min_earnings > 0
     AND v_creator_earnings < v_min_earnings THEN
    RAISE EXCEPTION
      'platform_earnings_too_low: Creator platform earnings (%) are below campaign minimum (%)',
      v_creator_earnings, v_min_earnings USING ERRCODE = 'check_violation';
  END IF;

  IF v_min_views IS NOT NULL AND v_min_views > 0
     AND v_creator_views < v_min_views THEN
    RAISE EXCEPTION
      'platform_views_too_low: Creator platform views (%) are below campaign minimum (%)',
      v_creator_views, v_min_views USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_enforce_trust_score ON public.submissions;
DROP TRIGGER IF EXISTS submissions_enforce_creator_requirements ON public.submissions;

CREATE TRIGGER submissions_enforce_creator_requirements
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submission_creator_requirements();

CREATE OR REPLACE FUNCTION public.init_creator_profile_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_creator_trust_score_metrics(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_profiles_init_metrics ON public.creator_profiles;

CREATE TRIGGER creator_profiles_init_metrics
  AFTER INSERT ON public.creator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.init_creator_profile_metrics();

-- Historical verified/paid submissions keep quality_score NULL until explicitly
-- scored at verify time or via admin quality-score APIs. Quality gates only
-- consider submissions with a quality_score assigned.

-- Recompute creator trust + quality caches in batches (progress via NOTICE).
DO $$
DECLARE
  v_last_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_batch_size constant integer := 500;
  v_batch_ids uuid[];
  v_batch_len integer;
  v_total integer := 0;
  v_profile_count integer;
  v_profile_id uuid;
BEGIN
  SELECT COUNT(*)::integer INTO v_profile_count FROM public.creator_profiles;
  RAISE NOTICE 'creator metrics backfill: starting for % profiles (batch size %)',
    v_profile_count, v_batch_size;

  LOOP
    SELECT ARRAY_AGG(batch.id ORDER BY batch.id)
    INTO v_batch_ids
    FROM (
      SELECT cp.id
      FROM public.creator_profiles cp
      WHERE cp.id > v_last_id
      ORDER BY cp.id
      LIMIT v_batch_size
    ) batch;

    v_batch_len := COALESCE(array_length(v_batch_ids, 1), 0);
    EXIT WHEN v_batch_len = 0;

    FOREACH v_profile_id IN ARRAY v_batch_ids
    LOOP
      PERFORM public.sync_creator_trust_score_metrics(v_profile_id);
    END LOOP;

    v_last_id := v_batch_ids[v_batch_len];
    v_total := v_total + v_batch_len;
    RAISE NOTICE 'creator metrics backfill: processed % / % profiles',
      v_total, v_profile_count;
  END LOOP;

  RAISE NOTICE 'creator metrics backfill: complete (% profiles)', v_total;
END $$;

-- Recreate contests_with_status so new contest columns are exposed to the app.
-- DROP required: CREATE OR REPLACE cannot insert columns mid-list (Postgres matches by position).
DROP VIEW IF EXISTS public.contests_with_status;

CREATE VIEW public.contests_with_status
WITH (security_invoker = on) AS
SELECT
  contests.id,
  contests.advertiser_id,
  contests.title,
  contests.platform,
  contests.start_date,
  contests.end_date,
  contests.thumbnail_url,
  contests.resources,
  contests.category,
  contests.inspiration_links,
  contests.tracking_links,
  contests.created_at,
  contests.subscription_info_of_user,
  contests.updated_at,
  contests.contest_type,
  contests.contest_based_details,
  contests.live_submission_count,
  contests.post_contest_status,
  contests.brief_html,
  contests.brief_json,
  contests.last_metrics_updated,
  contests.rules_html,
  contests.rules_json,
  contests.moderation_status,
  contests.submitted_for_approval_at,
  contests.approved_at,
  contests.approved_by,
  contests.published_at,
  contests.rejection_reason,
  contests.payment_details,
  CASE
    WHEN contests.moderation_status <> 'published'::public.contest_moderation_status_enum THEN NULL::text
    WHEN contests.start_date IS NULL OR contests.end_date IS NULL THEN 'incomplete'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) < contests.start_date THEN 'upcoming'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.start_date
      AND (now() AT TIME ZONE 'UTC'::text) < contests.end_date THEN 'active'::text
    WHEN (now() AT TIME ZONE 'UTC'::text) >= contests.end_date THEN 'ended'::text
    ELSE 'unknown'::text
  END AS status,
  contests.views_locked_at,
  contests.multiple_submissions_enabled,
  contests.max_submissions_per_creator,
  contests.content_type,
  contests.bonus_details,
  contests.max_earnings_per_creator,
  contests.categories,
  contests.subcategories,
  contests.interests,
  contests.region,
  contests.payout_adjustment_percentage,
  contests.payout_adjustment_mode,
  contests.trust_score,
  contests.trust_number,
  contests.contest_format,
  contests.min_avg_quality_score,
  contests.min_best_quality_score,
  contests.min_platform_earnings,
  contests.min_platform_views
FROM public.contests;

COMMENT ON VIEW public.contests_with_status IS
  'All contest columns plus computed status. Includes trust_score, trust_number, quality minimums, and platform earnings/views gates.';
