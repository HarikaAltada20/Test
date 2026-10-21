-- Allow the admin withdrawal status summary (tab counts + totals) to be
-- filtered by payout method so tabs match the active payout method filter.

DROP FUNCTION IF EXISTS public.admin_withdrawal_status_summary();

CREATE OR REPLACE FUNCTION public.admin_withdrawal_status_summary(
  p_method_type text DEFAULT NULL
)
RETURNS TABLE (
  status text,
  request_count bigint,
  cash_amount_cents bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    wr.status::text,
    COUNT(*)::bigint AS request_count,
    COALESCE(
      SUM(
        CASE
          WHEN wr.amount_type = 'cash' THEN wr.amount
          ELSE 0
        END
      ),
      0
    )::bigint AS cash_amount_cents
  FROM public.withdrawal_requests wr
  WHERE p_method_type IS NULL
    OR lower(wr.payout_method_type_snapshot) = lower(p_method_type)
  GROUP BY wr.status;
$$;

COMMENT ON FUNCTION public.admin_withdrawal_status_summary(text) IS
  'Admin: per-status withdrawal request counts and cash amount totals (cents), optionally filtered by payout method type.';

REVOKE ALL ON FUNCTION public.admin_withdrawal_status_summary(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_status_summary(text) TO service_role;
