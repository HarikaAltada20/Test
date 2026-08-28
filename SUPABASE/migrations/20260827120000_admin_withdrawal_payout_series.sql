-- Daily cash payout series for admin withdrawals chart (bucket by processed_at UTC).

DROP INDEX IF EXISTS public.idx_withdrawal_requests_processed_paid;

CREATE INDEX idx_withdrawal_requests_processed_paid
  ON public.withdrawal_requests (processed_at)
  WHERE status = 'processed'
    AND amount_type = 'cash'
    AND processed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_withdrawal_payout_series(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  day date,
  amount_cents bigint,
  payout_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    (wr.processed_at AT TIME ZONE 'UTC')::date AS day,
    COALESCE(SUM(wr.amount), 0)::bigint AS amount_cents,
    COUNT(*)::bigint AS payout_count
  FROM public.withdrawal_requests wr
  WHERE wr.status = 'processed'
    AND wr.amount_type = 'cash'
    AND wr.processed_at IS NOT NULL
    AND (p_from IS NULL OR wr.processed_at >= p_from)
    AND (p_to IS NULL OR wr.processed_at <= p_to)
  GROUP BY (wr.processed_at AT TIME ZONE 'UTC')::date
  ORDER BY day ASC;
$$;

COMMENT ON FUNCTION public.admin_withdrawal_payout_series(timestamptz, timestamptz) IS
  'Admin: daily cash payout totals (cents) and counts for processed cash withdrawals by processed_at UTC day.';

REVOKE ALL ON FUNCTION public.admin_withdrawal_payout_series(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_payout_series(timestamptz, timestamptz) TO service_role;
