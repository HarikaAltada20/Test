-- Group admin withdrawal requests by payout destination in SQL so the grouped
-- admin view only loads one page of groups instead of every matching row.
-- Destination normalisation must stay in sync with payoutDestination() in
-- lib/admin-withdrawals-list.ts.

CREATE OR REPLACE FUNCTION public.admin_withdrawal_payee_groups(
  p_tab text DEFAULT 'all',
  p_method_type text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  method text,
  destination text,
  currency text,
  amount_type text,
  total_cents bigint,
  request_count bigint,
  usernames text[],
  names text[],
  statuses jsonb,
  latest_created_at timestamptz,
  request_ids uuid[],
  total_groups bigint,
  total_requests bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH filtered AS (
    SELECT
      v.id,
      v.amount,
      v.status::text AS status,
      v.created_at,
      v.user_username,
      v.user_full_name,
      lower(coalesce(v.payout_method_type_snapshot, '')) AS m,
      coalesce(v.payout_method_details_snapshot, '{}'::jsonb) AS d,
      upper(coalesce(nullif(v.currency, ''), 'USD')) AS cur,
      coalesce(nullif(v.amount_type, ''), 'cash') AS atype
    FROM public.admin_withdrawal_requests_list v
    WHERE
      CASE lower(coalesce(p_tab, 'all'))
        WHEN 'pending' THEN v.status = 'pending'
        WHEN 'in_review' THEN v.status = 'in_review'
        WHEN 'approved' THEN v.status = 'approved'
        WHEN 'paid' THEN v.status = 'processed'
        WHEN 'rejected' THEN v.status IN ('rejected', 'cancelled')
        WHEN 'forfeited' THEN v.status = 'forfeited'
        WHEN 'failed' THEN v.status = 'failed'
        ELSE true
      END
      AND (p_method_type IS NULL
        OR lower(v.payout_method_type_snapshot) = lower(p_method_type))
      AND (p_from IS NULL OR v.created_at >= p_from)
      AND (p_to IS NULL OR v.created_at <= p_to)
  ),
  keyed AS (
    SELECT
      f.*,
      -- Case-sensitive: only leading/trailing [ \t\n\r\f\v] is ignored.
      CASE
        WHEN f.m = 'skydo' THEN btrim(coalesce(f.d->>'email', ''), f.ws)
        WHEN f.m = 'upi' THEN btrim(coalesce(f.d->>'upi_id', ''), f.ws)
        WHEN f.m = 'bank_transfer' THEN
          CASE
            WHEN btrim(coalesce(f.d->>'account_number', ''), f.ws) = '' THEN ''
            WHEN btrim(coalesce(nullif(f.d->>'ifsc_code', ''), f.d->>'swift_bic_code', ''), f.ws) = '' THEN
              btrim(coalesce(f.d->>'account_number', ''), f.ws)
            ELSE
              btrim(coalesce(f.d->>'account_number', ''), f.ws)
              || ' / '
              || btrim(coalesce(nullif(f.d->>'ifsc_code', ''), f.d->>'swift_bic_code', ''), f.ws)
          END
        WHEN f.m IN ('crypto', 'phantom') THEN btrim(coalesce(f.d->>'wallet_address', ''), f.ws)
        ELSE ''
      END AS dest
    FROM (
      SELECT filtered.*, E' \t\n\r\f' || chr(11) AS ws FROM filtered
    ) f
  ),
  normalised AS (
    SELECT
      k.*,
      CASE WHEN k.m = '' THEN 'unknown' ELSE k.m END AS gm,
      CASE WHEN k.dest = '' THEN 'Missing payee details' ELSE k.dest END AS gd
    FROM keyed k
  ),
  status_counts AS (
    SELECT n.gm, n.gd, n.cur, n.atype,
      jsonb_object_agg(n.status, n.cnt) AS statuses
    FROM (
      SELECT gm, gd, cur, atype, status, COUNT(*) AS cnt
      FROM normalised
      GROUP BY gm, gd, cur, atype, status
    ) n
    GROUP BY n.gm, n.gd, n.cur, n.atype
  ),
  groups AS (
    SELECT
      n.gm,
      n.gd,
      n.cur,
      n.atype,
      COALESCE(SUM(n.amount), 0)::bigint AS total_cents,
      COUNT(*)::bigint AS request_count,
      array_remove(array_agg(DISTINCT n.user_username), NULL) AS usernames,
      array_remove(array_agg(DISTINCT n.user_full_name), NULL) AS names,
      MAX(n.created_at) AS latest_created_at,
      array_agg(n.id ORDER BY n.created_at DESC) AS request_ids
    FROM normalised n
    GROUP BY n.gm, n.gd, n.cur, n.atype
  )
  SELECT
    g.gm,
    g.gd,
    g.cur,
    g.atype,
    g.total_cents,
    g.request_count,
    g.usernames,
    g.names,
    sc.statuses,
    g.latest_created_at,
    g.request_ids,
    COUNT(*) OVER ()::bigint AS total_groups,
    (SUM(g.request_count) OVER ())::bigint AS total_requests
  FROM groups g
  JOIN status_counts sc
    ON sc.gm = g.gm AND sc.gd = g.gd AND sc.cur = g.cur AND sc.atype = g.atype
  ORDER BY g.total_cents DESC, g.gm, g.gd, g.cur, g.atype
  LIMIT greatest(coalesce(p_limit, 25), 1)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.admin_withdrawal_payee_groups(text, text, timestamptz, timestamptz, integer, integer) IS
  'Admin: withdrawal requests grouped by payout destination (method + normalised destination + currency + amount type), paginated by group.';

REVOKE ALL ON FUNCTION public.admin_withdrawal_payee_groups(text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_withdrawal_payee_groups(text, text, timestamptz, timestamptz, integer, integer) TO service_role;
