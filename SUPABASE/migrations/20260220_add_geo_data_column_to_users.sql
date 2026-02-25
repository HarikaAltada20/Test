-- Add geo_data column to public.users for registration geo (single source of truth for map/admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'geo_data'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN geo_data jsonb DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.users.geo_data IS 'Geo data at registration: country, country_code, state, city, lat, lon, processed_at';
