-- Fast aggregates for public landing pages (avoids SELECT * of all rows)
CREATE OR REPLACE FUNCTION public.sum_submission_views()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(views), 0)::bigint FROM public.submissions;
$$;

CREATE OR REPLACE FUNCTION public.sum_creator_total_money_won()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(total_money_won), 0)::bigint FROM public.creator_profiles;
$$;

GRANT EXECUTE ON FUNCTION public.sum_submission_views() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sum_creator_total_money_won() TO anon, authenticated;
