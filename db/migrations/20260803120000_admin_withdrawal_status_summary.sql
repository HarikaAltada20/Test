-- Aggregate withdrawal totals/counts in the DB instead of loading every row
-- into the admin list API.

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
  ON public.withdrawal_requests (status);

CREATE OR REPLACE FUNCTION public.admin_withdrawal_status_summary()
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
  GROUP BY wr.status;
$$;

COMMENT ON FUNCTION public.admin_withdrawal_status_summary() IS
  'Admin: per-status withdrawal request counts and cash amount totals (cents).';

REVOKE ALL ON FUNCTION public.admin_withdrawal_status_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_status_summary() TO service_role;
