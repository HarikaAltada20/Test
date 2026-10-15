-- Admin Payout Methods v3: flag Skydo emails that are already verified on another account.
-- Requires 20261005140000_admin_payout_view_v2.sql.
--
-- Skydo KYC belongs to the email, so the same verified email can be reused on several
-- Game of Creators accounts. A new account that adds it still starts at email_pending;
-- these columns let admins see that and verify it in one click (never automatically).
--
--   1. payout_methods.skydo_verified_via ('manual' | 'known_email'), owner-proof.
--   2. Index on the Skydo email for the peer lookups below.
--   3. admin_payout_methods_view: appends skydo_email, email_account_count,
--      email_verified_peer_count, email_verified_peers, known_verified,
--      next_action_rank, skydo_verified_via.
--   4. admin_payout_methods_summary(): adds skydo_known_verified and skydo_known_pending;
--      skydo_overdue no longer counts rows that only need the one-click verify.
--   5. admin_payout_method_email_groups(): Skydo methods grouped by email, paginated by group.
--
-- Safe to re-run. New view columns are appended at the end, as CREATE OR REPLACE VIEW requires.

-- 1. Audit column
ALTER TABLE public.payout_methods
    ADD COLUMN IF NOT EXISTS skydo_verified_via text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payout_methods_skydo_verified_via_check'
    ) THEN
        ALTER TABLE public.payout_methods
            ADD CONSTRAINT payout_methods_skydo_verified_via_check
            CHECK (skydo_verified_via IS NULL OR skydo_verified_via IN ('manual', 'known_email'));
    END IF;
END $$;

-- Owners can never set or change it; admin APIs use the service role (auth.uid() IS NULL).
CREATE OR REPLACE FUNCTION public.protect_skydo_verified_via()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NOT NULL AND v_uid = NEW.user_id THEN
        IF TG_OP = 'INSERT' THEN
            NEW.skydo_verified_via := NULL;
        ELSE
            NEW.skydo_verified_via := OLD.skydo_verified_via;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payout_methods_protect_skydo_verified_via ON public.payout_methods;
CREATE TRIGGER payout_methods_protect_skydo_verified_via
    BEFORE INSERT OR UPDATE ON public.payout_methods
    FOR EACH ROW EXECUTE FUNCTION public.protect_skydo_verified_via();

-- 2. Email lookups
CREATE INDEX IF NOT EXISTS payout_methods_skydo_email_idx
    ON public.payout_methods (lower(details->>'email'))
    WHERE method_type = 'skydo';

-- 3. View
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
    COALESCE(pm.skydo_status_updated_at, pm.created_at) AS stage_since,
    -- v3
    CASE WHEN pm.method_type = 'skydo' THEN lower(pm.details->>'email') END AS skydo_email,
    COALESCE(se.account_count, 0) AS email_account_count,
    COALESCE(se.verified_peer_count, 0) AS email_verified_peer_count,
    COALESCE(se.verified_peers, '[]'::jsonb) AS email_verified_peers,
    (
        pm.method_type = 'skydo'
        AND COALESCE(pm.skydo_status, 'email_pending') <> 'verified'
        AND COALESCE(se.verified_peer_count, 0) > 0
    ) AS known_verified,
    CASE
        WHEN pm.method_type <> 'skydo' THEN 4
        WHEN COALESCE(pm.skydo_status, 'email_pending') <> 'verified'
             AND COALESCE(se.verified_peer_count, 0) > 0 THEN 0
        WHEN COALESCE(pm.skydo_status, 'email_pending') = 'email_pending' THEN 1
        WHEN pm.skydo_status = 'email_sent' THEN 2
        ELSE 3
    END AS next_action_rank,
    pm.skydo_verified_via
FROM public.payout_methods pm
JOIN public.users u ON u.id = pm.user_id
LEFT JOIN public.users upd ON upd.id = pm.skydo_status_updated_by
LEFT JOIN public.creator_profiles cp ON cp.id = pm.user_id
LEFT JOIN public.advertiser_profiles ap ON ap.id = pm.user_id
LEFT JOIN LATERAL (
    SELECT count(*)::integer AS withdrawal_count, max(w.created_at) AS last_withdrawal_at
    FROM public.withdrawal_requests w
    WHERE w.payout_method_id = pm.id
) wr ON true
LEFT JOIN LATERAL (
    SELECT
        count(*)::integer AS account_count,
        (count(*) FILTER (WHERE o.id <> pm.id AND o.skydo_status = 'verified'))::integer AS verified_peer_count,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', o.id,
                    'user_id', o.user_id,
                    'name', ou.full_name,
                    'username', ou.username
                )
                ORDER BY o.skydo_status_updated_at NULLS LAST, o.created_at
            ) FILTER (WHERE o.id <> pm.id AND o.skydo_status = 'verified'),
            '[]'::jsonb
        ) AS verified_peers
    FROM public.payout_methods o
    JOIN public.users ou ON ou.id = o.user_id
    WHERE pm.method_type = 'skydo'
      AND o.method_type = 'skydo'
      AND lower(o.details->>'email') = lower(pm.details->>'email')
) se ON true;

REVOKE ALL ON public.admin_payout_methods_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_payout_methods_view TO service_role;

-- 4. Summary
CREATE OR REPLACE FUNCTION public.admin_payout_methods_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH known AS (
        SELECT pm.id, COALESCE(pm.skydo_status, 'email_pending') AS status
        FROM public.payout_methods pm
        WHERE pm.method_type = 'skydo'
          AND COALESCE(pm.skydo_status, 'email_pending') <> 'verified'
          AND EXISTS (
              SELECT 1 FROM public.payout_methods o
              WHERE o.method_type = 'skydo'
                AND o.id <> pm.id
                AND o.skydo_status = 'verified'
                AND lower(o.details->>'email') = lower(pm.details->>'email')
          )
    )
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
            SELECT count(*) FROM public.payout_methods pm
            WHERE pm.method_type = 'skydo'
              AND pm.skydo_status = 'email_pending'
              AND COALESCE(pm.skydo_status_updated_at, pm.created_at) < now() - interval '24 hours'
              AND NOT EXISTS (SELECT 1 FROM known k WHERE k.id = pm.id)
        ),
        'skydo_known_verified', (SELECT count(*) FROM known),
        'skydo_known_pending', (SELECT count(*) FROM known WHERE status = 'email_pending'),
        'added_last_24h', (SELECT count(*) FROM public.payout_methods WHERE created_at >= now() - interval '24 hours'),
        'added_last_7d', (SELECT count(*) FROM public.payout_methods WHERE created_at >= now() - interval '7 days')
    );
$$;

REVOKE ALL ON FUNCTION public.admin_payout_methods_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_payout_methods_summary() TO service_role;

-- 5. Group by Skydo email
-- A group is returned when ANY of its members matches the filters, and it always
-- lists ALL members, so a verified account shows next to the pending one.
-- Filters mirror buildAdminPayoutQuery() in lib/admin-payout-methods.ts.
DROP FUNCTION IF EXISTS public.admin_payout_method_email_groups(
    text, text, boolean, boolean, text, boolean, timestamptz, timestamptz, text, text, integer, integer
);

CREATE OR REPLACE FUNCTION public.admin_payout_method_email_groups(
    p_search text DEFAULT NULL,
    p_skydo_status text DEFAULT NULL,
    p_known boolean DEFAULT false,
    p_overdue boolean DEFAULT false,
    p_user_type text DEFAULT NULL,
    p_is_default boolean DEFAULT NULL,
    p_created_from timestamptz DEFAULT NULL,
    p_created_to timestamptz DEFAULT NULL,
    p_sort text DEFAULT 'next_action',
    p_order text DEFAULT 'asc',
    p_limit integer DEFAULT 25,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    email text,
    account_count integer,
    names text[],
    member_ids uuid[],
    pending_count integer,
    sent_count integer,
    verified_count integer,
    known_count integer,
    total_balance bigint,
    oldest_waiting_since timestamptz,
    latest_added_at timestamptz,
    min_next_action_rank integer,
    total_groups bigint,
    total_methods bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH skydo AS (
        SELECT v.*
        FROM public.admin_payout_methods_view v
        WHERE v.method_type = 'skydo' AND v.skydo_email IS NOT NULL
    ),
    matching AS (
        SELECT DISTINCT s.skydo_email
        FROM skydo s
        WHERE (p_search IS NULL OR strpos(s.search_text, lower(p_search)) > 0)
          AND (p_skydo_status IS NULL OR s.skydo_status = p_skydo_status)
          AND (NOT COALESCE(p_known, false) OR s.known_verified)
          AND (NOT COALESCE(p_overdue, false) OR (
                s.skydo_status = 'email_pending'
                AND NOT s.known_verified
                AND s.stage_since < now() - interval '24 hours'
              ))
          AND (p_user_type IS NULL OR s.user_type = p_user_type)
          AND (p_is_default IS NULL OR COALESCE(s.is_default, false) = p_is_default)
          AND (p_created_from IS NULL OR s.created_at >= p_created_from)
          AND (p_created_to IS NULL OR s.created_at <= p_created_to)
    ),
    groups AS (
        SELECT
            s.skydo_email AS email,
            count(*)::integer AS account_count,
            array_agg(COALESCE(s.full_name, s.username, s.email) ORDER BY s.created_at) AS names,
            array_agg(s.id ORDER BY s.next_action_rank, s.stage_since) AS member_ids,
            (count(*) FILTER (WHERE COALESCE(s.skydo_status, 'email_pending') = 'email_pending'))::integer AS pending_count,
            (count(*) FILTER (WHERE s.skydo_status = 'email_sent'))::integer AS sent_count,
            (count(*) FILTER (WHERE s.skydo_status = 'verified'))::integer AS verified_count,
            (count(*) FILTER (WHERE s.known_verified))::integer AS known_count,
            COALESCE(sum(s.withdrawable_balance), 0)::bigint AS total_balance,
            min(s.stage_since) FILTER (WHERE COALESCE(s.skydo_status, 'email_pending') <> 'verified') AS oldest_waiting_since,
            max(s.created_at) AS latest_added_at,
            min(s.next_action_rank)::integer AS min_next_action_rank
        FROM skydo s
        JOIN matching m ON m.skydo_email = s.skydo_email
        GROUP BY s.skydo_email
    )
    SELECT
        g.*,
        count(*) OVER ()::bigint AS total_groups,
        (sum(g.account_count) OVER ())::bigint AS total_methods
    FROM groups g
    ORDER BY
        CASE WHEN p_sort IN ('next_action', 'skydo_status') AND p_order = 'asc' THEN g.min_next_action_rank END ASC,
        CASE WHEN p_sort IN ('next_action', 'skydo_status') AND p_order = 'desc' THEN g.min_next_action_rank END DESC,
        CASE WHEN p_sort IN ('skydo_email', 'full_name', 'email') AND p_order = 'asc' THEN g.email END ASC,
        CASE WHEN p_sort IN ('skydo_email', 'full_name', 'email') AND p_order = 'desc' THEN g.email END DESC,
        CASE WHEN p_sort = 'stage_since' AND p_order = 'asc' THEN g.oldest_waiting_since END ASC NULLS LAST,
        CASE WHEN p_sort = 'stage_since' AND p_order = 'desc' THEN g.oldest_waiting_since END DESC NULLS LAST,
        CASE WHEN p_sort = 'created_at' AND p_order = 'asc' THEN g.latest_added_at END ASC,
        CASE WHEN p_sort = 'created_at' AND p_order = 'desc' THEN g.latest_added_at END DESC,
        CASE WHEN p_sort = 'withdrawable_balance' AND p_order = 'asc' THEN g.total_balance END ASC,
        CASE WHEN p_sort = 'withdrawable_balance' AND p_order = 'desc' THEN g.total_balance END DESC,
        CASE WHEN p_sort = 'email_account_count' AND p_order = 'asc' THEN g.account_count END ASC,
        CASE WHEN p_sort = 'email_account_count' AND p_order = 'desc' THEN g.account_count END DESC,
        g.oldest_waiting_since ASC NULLS LAST,
        g.account_count DESC,
        g.email ASC
    LIMIT greatest(coalesce(p_limit, 25), 1)
    OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.admin_payout_method_email_groups(
    text, text, boolean, boolean, text, boolean, timestamptz, timestamptz, text, text, integer, integer
) IS 'Admin: Skydo payout methods grouped by email, paginated by group.';

REVOKE ALL ON FUNCTION public.admin_payout_method_email_groups(
    text, text, boolean, boolean, text, boolean, timestamptz, timestamptz, text, text, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_payout_method_email_groups(
    text, text, boolean, boolean, text, boolean, timestamptz, timestamptz, text, text, integer, integer
) TO service_role;
