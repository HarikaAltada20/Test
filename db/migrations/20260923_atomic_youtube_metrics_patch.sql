-- Apply before deploying the matching application change. All YouTube refresh
-- writers must send only the fields they fetched, not an old other_stats snapshot.
-- Execute with service_role only. This function does not bypass table RLS.
CREATE OR REPLACE FUNCTION public.patch_youtube_submission_metrics(
  p_submission_id uuid,
  p_youtube_patch jsonb,
  p_row_patch jsonb,
  p_post_campaign boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_stats jsonb;
  current_youtube jsonb;
  next_youtube jsonb;
  next_stats jsonb;
  campaign_id uuid;
  campaign_status text;
  campaign_locked_at timestamptz;
  entry record;
  nested_entry record;
  nested_patch jsonb;
BEGIN
  IF jsonb_typeof(p_youtube_patch) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_row_patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'YouTube metric patches must be JSON objects';
  END IF;

  -- Serialize writers before reading the existing JSON. A later writer sees
  -- the previous writer's committed analytics, including other refresh scopes.
  IF p_post_campaign THEN
    SELECT other_stats INTO current_stats
    FROM public.post_campaign_submission_metrics
    WHERE submission_id = p_submission_id FOR UPDATE;
  ELSE
    SELECT other_stats, contest_id INTO current_stats, campaign_id
    FROM public.submissions WHERE id = p_submission_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT p_post_campaign THEN
    SELECT post_contest_status, views_locked_at
    INTO campaign_status, campaign_locked_at
    FROM public.contests WHERE id = campaign_id FOR SHARE;
    IF NOT FOUND OR campaign_locked_at IS NOT NULL
       OR campaign_status IN ('in_review', 'verification_complete', 'payouts_processed') THEN
      RETURN false;
    END IF;
  END IF;

  -- Support legacy stringified JSON without silently discarding malformed data.
  IF jsonb_typeof(current_stats) = 'string' THEN
    current_stats := (current_stats #>> '{}')::jsonb;
  END IF;
  current_stats := COALESCE(current_stats, '{}'::jsonb);
  IF jsonb_typeof(current_stats) <> 'object' THEN
    RAISE EXCEPTION 'Existing YouTube other_stats is not a JSON object';
  END IF;
  current_youtube := current_stats - ARRAY['youtube', 'instagram', 'tiktok', 'twitter', 'x'];
  IF jsonb_typeof(current_stats->'youtube') = 'object' THEN
    current_youtube := current_youtube || (current_stats->'youtube');
  END IF;
  next_youtube := current_youtube;

  FOR entry IN SELECT key, value FROM jsonb_each(p_youtube_patch) LOOP
    -- Empty API responses do not erase saved analytics. Zero remains valid.
    IF entry.value = 'null'::jsonb OR entry.value = '{}'::jsonb THEN CONTINUE; END IF;
    IF entry.key IN ('demographics', 'traffic_source_details')
       AND jsonb_typeof(entry.value) = 'object' THEN
      nested_patch := CASE WHEN jsonb_typeof(next_youtube->entry.key) = 'object'
        THEN next_youtube->entry.key ELSE '{}'::jsonb END;
      FOR nested_entry IN SELECT key, value FROM jsonb_each(entry.value) LOOP
        IF nested_entry.value IN ('null'::jsonb, '{}'::jsonb, '[]'::jsonb) THEN CONTINUE; END IF;
        nested_patch := nested_patch || jsonb_build_object(nested_entry.key, nested_entry.value);
      END LOOP;
      next_youtube := next_youtube || jsonb_build_object(entry.key, nested_patch);
    ELSIF entry.value <> '[]'::jsonb OR entry.key = 'bot_flags' THEN
      next_youtube := next_youtube || jsonb_build_object(entry.key, entry.value);
    END IF;
  END LOOP;
  next_stats := current_stats || jsonb_build_object('youtube', next_youtube);

  IF p_post_campaign THEN
    UPDATE public.post_campaign_submission_metrics SET
      other_stats = next_stats,
      views = CASE WHEN p_row_patch ? 'views' THEN (p_row_patch->>'views')::bigint ELSE views END,
      insights_status = p_row_patch->>'insights_status',
      last_insights_update = (p_row_patch->>'last_insights_update')::timestamptz,
      updated_at = (p_row_patch->>'updated_at')::timestamptz
    WHERE submission_id = p_submission_id;
  ELSE
    UPDATE public.submissions SET
      other_stats = next_stats,
      views = CASE WHEN p_row_patch ? 'views' THEN (p_row_patch->>'views')::bigint ELSE views END,
      insights_status = p_row_patch->>'insights_status',
      last_insights_update = (p_row_patch->>'last_insights_update')::timestamptz,
      updated_at = (p_row_patch->>'updated_at')::timestamptz
    WHERE id = p_submission_id;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_youtube_submission_metrics(uuid, jsonb, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_youtube_submission_metrics(uuid, jsonb, jsonb, boolean)
  TO service_role;
