-- 1. Create exec_sql function if it doesn't exist
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- 2. Update contest-assets bucket configuration to set file size limit to 20MB
UPDATE storage.buckets
SET file_size_limit = 20971520  -- 20MB in bytes
WHERE name = 'contest-assets';

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
SELECT 'contest-assets', 'contest-assets', true, 20971520
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'contest-assets');

-- 3. Create the contests_with_status view
DROP VIEW IF EXISTS public.contests_with_status;

-- Create a view that calculates contest status based on start_date and end_date
CREATE OR REPLACE VIEW public.contests_with_status AS
SELECT 
  c.*,
  CASE
    WHEN c.is_draft THEN 'draft'
    WHEN c.start_date IS NULL OR c.end_date IS NULL THEN 'incomplete'
    WHEN c.start_date > NOW() THEN 'upcoming'
    WHEN c.start_date <= NOW() AND c.end_date > NOW() THEN 'live'
    WHEN c.end_date <= NOW() THEN 'completed'
    ELSE 'unknown'
  END AS status
FROM contests c;

-- Grant access to the view
GRANT SELECT ON public.contests_with_status TO service_role;
GRANT SELECT ON public.contests_with_status TO authenticated;
GRANT SELECT ON public.contests_with_status TO anon; 