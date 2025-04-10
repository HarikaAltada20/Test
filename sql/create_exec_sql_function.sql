-- Create a function that allows executing arbitrary SQL
-- This needs to be executed with admin privileges in Supabase
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$; 