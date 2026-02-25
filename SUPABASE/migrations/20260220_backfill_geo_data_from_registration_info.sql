-- Backfill users.geo_data from registration_info
-- Run this in Supabase SQL Editor.
-- Column format: { "ip": "...", "geo_data": { "country", "country_code", "state", "city", "lat", "lon", "processed_at" } }
-- Reads from nested registration_info.geo_data and/or top-level keys (country, country_code, state, city, lat, lon, etc.).
-- If registration_info has only ip_address and no country/city/state, run: npm run backfill-geo-data (fetches from IP via API).

-- Ensure column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'geo_data'
  ) THEN
    ALTER TABLE public.users ADD COLUMN geo_data jsonb DEFAULT NULL;
  END IF;
END $$;

-- Inline safe numeric: use 0 when null/empty/invalid (avoids invalid input syntax for type numeric)
-- Step 1: registration_info has nested geo_data -> build normalized { ip, geo_data } with key fallbacks
UPDATE public.users u
SET
  geo_data = jsonb_build_object(
    'ip',
    TRIM(COALESCE(
      u.registration_info->>'ip',
      u.registration_info->>'ip_address',
      (u.login_history->0)->>'ip_address',
      ''
    )),
    'geo_data',
    jsonb_build_object(
      'country',
      COALESCE(
        u.registration_info->'geo_data'->>'country',
        u.registration_info->'geo_data'->>'countryName',
        u.registration_info->'geo_data'->>'country_name',
        u.registration_info->>'country',
        ''
      ),
      'country_code',
      COALESCE(
        u.registration_info->'geo_data'->>'country_code',
        u.registration_info->'geo_data'->>'countryCode',
        u.registration_info->>'country_code',
        u.registration_info->>'countryCode',
        ''
      ),
      'state',
      COALESCE(
        u.registration_info->'geo_data'->>'state',
        u.registration_info->'geo_data'->>'regionName',
        u.registration_info->'geo_data'->>'region',
        u.registration_info->>'state',
        u.registration_info->>'region',
        u.registration_info->>'regionName',
        ''
      ),
      'city',
      COALESCE(
        u.registration_info->'geo_data'->>'city',
        u.registration_info->>'city',
        ''
      ),
      'lat',
      CASE
        WHEN (u.registration_info->'geo_data'->>'lat') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->'geo_data'->>'lat')::numeric
        WHEN (u.registration_info->'geo_data'->>'latitude') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->'geo_data'->>'latitude')::numeric
        WHEN (u.registration_info->>'lat') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'lat')::numeric
        WHEN (u.registration_info->>'latitude') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'latitude')::numeric
        ELSE 0
      END,
      'lon',
      CASE
        WHEN (u.registration_info->'geo_data'->>'lon') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->'geo_data'->>'lon')::numeric
        WHEN (u.registration_info->'geo_data'->>'lng') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->'geo_data'->>'lng')::numeric
        WHEN (u.registration_info->'geo_data'->>'longitude') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->'geo_data'->>'longitude')::numeric
        WHEN (u.registration_info->>'lon') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'lon')::numeric
        WHEN (u.registration_info->>'longitude') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'longitude')::numeric
        WHEN (u.registration_info->>'lng') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'lng')::numeric
        ELSE 0
      END,
      'processed_at',
      COALESCE(
        u.registration_info->'geo_data'->>'processed_at',
        u.registration_info->>'processed_at',
        (now() AT TIME ZONE 'utc')::text
      )
    )
  ),
  updated_at = COALESCE(u.updated_at, now())
WHERE u.registration_info IS NOT NULL
  AND u.registration_info ? 'geo_data'
  AND jsonb_typeof(u.registration_info->'geo_data') = 'object';

-- Step 2: ip/ip_address present but no nested geo_data or geo_data column empty -> build from top-level (and nested if present)
UPDATE public.users u
SET
  geo_data = jsonb_build_object(
    'ip',
    TRIM(COALESCE(
      u.registration_info->>'ip',
      u.registration_info->>'ip_address',
      (u.login_history->0)->>'ip_address',
      ''
    )),
    'geo_data',
    jsonb_build_object(
      'country',
      COALESCE(
        u.registration_info->'geo_data'->>'country',
        u.registration_info->>'country',
        u.registration_info->>'country_name',
        u.registration_info->>'countryName',
        ''
      ),
      'country_code',
      COALESCE(
        u.registration_info->'geo_data'->>'country_code',
        u.registration_info->>'country_code',
        u.registration_info->>'countryCode',
        ''
      ),
      'state',
      COALESCE(
        u.registration_info->'geo_data'->>'state',
        u.registration_info->>'state',
        u.registration_info->>'region',
        u.registration_info->>'regionName',
        ''
      ),
      'city',
      COALESCE(
        u.registration_info->'geo_data'->>'city',
        u.registration_info->>'city',
        ''
      ),
      'lat',
      CASE
        WHEN (u.registration_info->'geo_data'->>'lat') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->'geo_data'->>'lat')::numeric
        WHEN (u.registration_info->>'lat') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'lat')::numeric
        WHEN (u.registration_info->>'latitude') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'latitude')::numeric
        ELSE 0
      END,
      'lon',
      CASE
        WHEN (u.registration_info->'geo_data'->>'lon') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->'geo_data'->>'lon')::numeric
        WHEN (u.registration_info->>'lon') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'lon')::numeric
        WHEN (u.registration_info->>'longitude') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'longitude')::numeric
        WHEN (u.registration_info->>'lng') ~ '^-?[0-9]+\.?[0-9]*$' THEN (u.registration_info->>'lng')::numeric
        ELSE 0
      END,
      'processed_at',
      COALESCE(
        u.registration_info->'geo_data'->>'processed_at',
        u.registration_info->>'processed_at',
        (now() AT TIME ZONE 'utc')::text
      )
    )
  ),
  updated_at = COALESCE(u.updated_at, now())
WHERE u.registration_info IS NOT NULL
  AND (u.registration_info ? 'ip_address' OR u.registration_info ? 'ip')
  AND (u.geo_data IS NULL OR u.geo_data = 'null'::jsonb OR NOT (u.geo_data ? 'geo_data'));

-- Step 3: no IP in registration_info (or no registration_info) but have login_history IP -> set geo_data.ip from latest login for backfill script
UPDATE public.users u
SET
  geo_data = jsonb_build_object(
    'ip',
    TRIM((u.login_history->0)->>'ip_address'),
    'geo_data',
    jsonb_build_object(
      'country', '',
      'country_code', '',
      'state', '',
      'city', '',
      'lat', 0,
      'lon', 0,
      'processed_at', (now() AT TIME ZONE 'utc')::text
    )
  ),
  updated_at = COALESCE(u.updated_at, now())
WHERE (u.registration_info IS NULL OR NOT (u.registration_info ? 'ip') AND NOT (u.registration_info ? 'ip_address'))
  AND jsonb_array_length(COALESCE(u.login_history, '[]'::jsonb)) > 0
  AND TRIM(COALESCE((u.login_history->0)->>'ip_address', '')) <> ''
  AND (u.geo_data IS NULL OR u.geo_data = 'null'::jsonb OR NOT (u.geo_data ? 'geo_data') OR (u.geo_data->'geo_data'->>'country') IS NULL OR (u.geo_data->'geo_data'->>'country') = '');
