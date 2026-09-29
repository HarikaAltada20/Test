-- Keep campaign platform matching aligned with the list filter UI.
-- "all" shows every campaign. Multiple-platform filters match an exact pair
-- or the exact YouTube + Instagram + TikTok set; Twitter is single-only.

CREATE OR REPLACE FUNCTION public.contest_matches_campaign_platform_filter(
  p_contest_platform text,
  p_filter text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH normalized AS (
    SELECT lower(btrim(coalesce(p_filter, 'all'))) AS raw_filter
  ),
  parsed AS (
    SELECT
      raw_filter,
      CASE WHEN raw_filter LIKE 'multiple:%' THEN 'multiple' ELSE 'single' END AS match_mode,
      CASE
        WHEN raw_filter IN ('multiple:', 'multiple:all')
          THEN 'youtube,instagram,tiktok'
        WHEN raw_filter LIKE 'multiple:%'
          THEN btrim(substr(raw_filter, length('multiple:') + 1))
        WHEN raw_filter LIKE 'single:%'
          THEN btrim(substr(raw_filter, length('single:') + 1))
        ELSE raw_filter
      END AS filter_value
    FROM normalized
  ),
  token_sets AS (
    SELECT
      match_mode,
      filter_value,
      public.contest_platform_tokens(p_contest_platform) AS campaign_tokens,
      public.contest_platform_tokens(filter_value) AS filter_tokens
    FROM parsed
  )
  SELECT CASE
    WHEN match_mode = 'single' AND filter_value IN ('', 'all') THEN true
    WHEN match_mode = 'multiple' THEN
      cardinality(filter_tokens) BETWEEN 2 AND 3
      AND filter_tokens <@ ARRAY['youtube', 'instagram', 'tiktok']::text[]
      AND campaign_tokens <@ filter_tokens
      AND filter_tokens <@ campaign_tokens
    ELSE cardinality(campaign_tokens) = 1 AND campaign_tokens && filter_tokens
  END
  FROM token_sets;
$$;

REVOKE ALL ON FUNCTION public.contest_matches_campaign_platform_filter(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contest_matches_campaign_platform_filter(text, text)
  TO authenticated, service_role;
