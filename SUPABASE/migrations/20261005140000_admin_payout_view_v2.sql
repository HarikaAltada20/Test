-- Admin Payout Methods page v2.
-- Requires 20261005130000_skydo_verification_and_admin_payout_view.sql.
--
--   * admin_payout_methods_view: appends status_updated_by_name and stage_since
--     (when the row entered its current Skydo stage).
--   * admin_payout_methods_summary(): adds skydo_overdue (email_pending for more than 24 hours).
--
-- Safe to re-run. New view columns are appended at the end, as CREATE OR REPLACE VIEW requires.

CREATE OR REPLACE VIEW public.admin_payout_methods_view
WITH (security_invoker = true) AS
SELECT
    pm.id,
    pm.user_id,
    pm.method_type,
    pm.details,
    pm.friendly_name,
    pm.is_default,
    pm.created_at,
    pm.updated_at,
    pm.skydo_status,
    pm.skydo_status_updated_at,
    pm.skydo_status_updated_by,
    pm.admin_notes,
    u.full_name,
    u.email,
    u.username,
    u.user_type,
    u.is_active,
    u.created_at AS user_created_at,
    u.geo_data->>'country' AS country,
    COALESCE(cp.withdrawable_balance, ap.withdrawable_balance, 0) AS withdrawable_balance,
    COALESCE(wr.withdrawal_count, 0) AS withdrawal_count,
    wr.last_withdrawal_at,
    lower(concat_ws(' ', u.full_name, u.email, u.username, pm.friendly_name, pm.details::text)) AS search_text,
    upd.full_name AS status_updated_by_name,
    COALESCE(pm.skydo_status_updated_at, pm.created_at) AS stage_since
FROM public.payout_methods pm
JOIN public.users u ON u.id = pm.user_id
LEFT JOIN public.users upd ON upd.id = pm.skydo_status_updated_by
LEFT JOIN public.creator_profiles cp ON cp.id = pm.user_id
LEFT JOIN public.advertiser_profiles ap ON ap.id = pm.user_id
LEFT JOIN LATERAL (
    SELECT count(*)::integer AS withdrawal_count, max(w.created_at) AS last_withdrawal_at
    FROM public.withdrawal_requests w
    WHERE w.payout_method_id = pm.id
) wr ON true;

REVOKE ALL ON public.admin_payout_methods_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_payout_methods_view TO service_role;

CREATE OR REPLACE FUNCTION public.admin_payout_methods_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'total', (SELECT count(*) FROM public.payout_methods),
        'by_method_type', COALESCE((
            SELECT jsonb_object_agg(method_type, c)
            FROM (SELECT method_type, count(*) AS c FROM public.payout_methods GROUP BY method_type) t
        ), '{}'::jsonb),
        'by_skydo_status', COALESCE((
            SELECT jsonb_object_agg(skydo_status, c)
            FROM (
                SELECT skydo_status, count(*) AS c FROM public.payout_methods
                WHERE method_type = 'skydo' AND skydo_status IS NOT NULL
                GROUP BY skydo_status
            ) t
        ), '{}'::jsonb),
        'skydo_overdue', (
            SELECT count(*) FROM public.payout_methods
            WHERE method_type = 'skydo'
              AND skydo_status = 'email_pending'
              AND COALESCE(skydo_status_updated_at, created_at) < now() - interval '24 hours'
        ),
        'added_last_24h', (SELECT count(*) FROM public.payout_methods WHERE created_at >= now() - interval '24 hours'),
        'added_last_7d', (SELECT count(*) FROM public.payout_methods WHERE created_at >= now() - interval '7 days')
    );
$$;

REVOKE ALL ON FUNCTION public.admin_payout_methods_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_payout_methods_summary() TO service_role;
