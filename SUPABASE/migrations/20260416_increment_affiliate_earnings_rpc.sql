-- Canonical name for crediting affiliate income into users.affiliate_earnings (cents).
CREATE OR REPLACE FUNCTION public.increment_affiliate_earnings(
  p_user_id uuid,
  p_amount integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.users
  SET
    affiliate_earnings = coalesce(affiliate_earnings, 0) + p_amount,
    updated_at = now()
  WHERE id = p_user_id;

  GET DIAGNOSTICS rows_updated = row_count;
  RETURN rows_updated > 0;
END;
$$;

COMMENT ON FUNCTION public.increment_affiliate_earnings(uuid, integer) IS
  'Adds p_amount cents to users.affiliate_earnings for the given user (affiliate / referral wallet credits).';

REVOKE ALL ON FUNCTION public.increment_affiliate_earnings(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_affiliate_earnings(uuid, integer) TO service_role;

-- Legacy name: delegate so old clients/scripts keep working.
CREATE OR REPLACE FUNCTION public.increment_other_earnings(
  p_user_id uuid,
  p_amount integer
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.increment_affiliate_earnings(p_user_id, p_amount);
$$;

COMMENT ON FUNCTION public.increment_other_earnings(uuid, integer) IS
  'Deprecated alias for increment_affiliate_earnings; use increment_affiliate_earnings.';

REVOKE ALL ON FUNCTION public.increment_other_earnings(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_other_earnings(uuid, integer) TO service_role;
