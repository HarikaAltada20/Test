-- Skydo verification status + admin payout methods view.
-- Requires 20261005120000_skydo_payout_method.sql to be applied first.
--
--   1. payout_methods: skydo_status (email_pending | email_sent | verified), status audit columns, admin_notes.
--   2. enforce_skydo_payout_rules(): new Skydo rows start at email_pending; owners cannot change
--      status / audit / admin_notes columns (service role used by admin APIs is unrestricted).
--   3. withdrawal_requests trigger: reject requests to a Skydo method that is not verified.
--   4. admin_payout_methods_view + admin_payout_methods_summary() for the admin Payout Methods page
--      (service role only).
--
-- Safe to re-run.

-- 1. Columns
ALTER TABLE public.payout_methods
    ADD COLUMN IF NOT EXISTS skydo_status text,
    ADD COLUMN IF NOT EXISTS skydo_status_updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS skydo_status_updated_by uuid,
    ADD COLUMN IF NOT EXISTS admin_notes text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payout_methods_skydo_status_check'
    ) THEN
        ALTER TABLE public.payout_methods
            ADD CONSTRAINT payout_methods_skydo_status_check
            CHECK (skydo_status IS NULL OR skydo_status IN ('email_pending', 'email_sent', 'verified'));
    END IF;
END $$;

UPDATE public.payout_methods
SET skydo_status = 'email_pending'
WHERE method_type = 'skydo' AND skydo_status IS NULL;

CREATE INDEX IF NOT EXISTS payout_methods_type_skydo_status_created_idx
    ON public.payout_methods (method_type, skydo_status, created_at DESC);

-- 2. Payout method rules
CREATE OR REPLACE FUNCTION public.enforce_skydo_payout_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_is_owner boolean;
    v_email text;
    v_balance integer;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.method_type = 'skydo' AND v_uid IS NOT NULL AND v_uid = OLD.user_id THEN
            RAISE EXCEPTION 'Skydo payout method is permanent and cannot be removed. Please contact support if you need help.';
        END IF;
        RETURN OLD;
    END IF;

    v_is_owner := v_uid IS NOT NULL AND v_uid = NEW.user_id;

    IF TG_OP = 'UPDATE' AND v_is_owner THEN
        IF OLD.method_type = 'skydo' AND (
            NEW.method_type IS DISTINCT FROM 'skydo'
            OR lower(trim(COALESCE(NEW.details->>'email', ''))) IS DISTINCT FROM lower(trim(COALESCE(OLD.details->>'email', '')))
        ) THEN
            RAISE EXCEPTION 'Skydo email is permanent and cannot be changed. Please contact support if you need help.';
        END IF;

        NEW.skydo_status := OLD.skydo_status;
        NEW.skydo_status_updated_at := OLD.skydo_status_updated_at;
        NEW.skydo_status_updated_by := OLD.skydo_status_updated_by;
        NEW.admin_notes := OLD.admin_notes;
    END IF;

    IF TG_OP = 'INSERT' AND v_is_owner THEN
        NEW.admin_notes := NULL;
        NEW.skydo_status_updated_at := NULL;
        NEW.skydo_status_updated_by := NULL;
    END IF;

    IF NEW.method_type <> 'skydo' THEN
        NEW.skydo_status := NULL;
        RETURN NEW;
    END IF;

    v_email := lower(trim(COALESCE(NEW.details->>'email', '')));
    IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'Please enter a valid email address for Skydo payouts.';
    END IF;

    IF TG_OP = 'INSERT' OR OLD.method_type IS DISTINCT FROM 'skydo' THEN
        IF EXISTS (
            SELECT 1 FROM public.payout_methods pm
            WHERE pm.user_id = NEW.user_id AND pm.method_type = 'skydo' AND pm.id <> NEW.id
        ) THEN
            RAISE EXCEPTION 'You can only add one Skydo payout method.';
        END IF;

        SELECT GREATEST(
            COALESCE((SELECT cp.withdrawable_balance FROM public.creator_profiles cp WHERE cp.id = NEW.user_id), 0),
            COALESCE((SELECT ap.withdrawable_balance FROM public.advertiser_profiles ap WHERE ap.id = NEW.user_id), 0)
        ) INTO v_balance;

        IF v_balance < 500 THEN
            RAISE EXCEPTION 'You need at least $5 in your withdrawable balance to add Skydo as a payout method.';
        END IF;

        IF v_is_owner OR NEW.skydo_status IS NULL THEN
            NEW.skydo_status := 'email_pending';
        END IF;
    END IF;

    NEW.details := jsonb_build_object('email', v_email);
    NEW.friendly_name := COALESCE(NULLIF(trim(NEW.friendly_name), ''), 'Skydo');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payout_methods_skydo_rules ON public.payout_methods;
CREATE TRIGGER payout_methods_skydo_rules
    BEFORE INSERT OR UPDATE OR DELETE ON public.payout_methods
    FOR EACH ROW EXECUTE FUNCTION public.enforce_skydo_payout_rules();

-- 3. Block withdrawals to unverified Skydo methods
CREATE OR REPLACE FUNCTION public.enforce_skydo_withdrawal_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type text;
    v_status text;
BEGIN
    IF NEW.payout_method_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT pm.method_type, pm.skydo_status INTO v_type, v_status
    FROM public.payout_methods pm
    WHERE pm.id = NEW.payout_method_id;

    IF v_type = 'skydo' AND v_status IS DISTINCT FROM 'verified' THEN
        RAISE EXCEPTION 'Your Skydo payout method is not verified yet. You can withdraw to it once verification is complete.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS withdrawal_requests_skydo_verified ON public.withdrawal_requests;
CREATE TRIGGER withdrawal_requests_skydo_verified
    BEFORE INSERT ON public.withdrawal_requests
    FOR EACH ROW EXECUTE FUNCTION public.enforce_skydo_withdrawal_verified();

-- 4. Admin view + summary
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
    lower(concat_ws(' ', u.full_name, u.email, u.username, pm.friendly_name, pm.details::text)) AS search_text
FROM public.payout_methods pm
JOIN public.users u ON u.id = pm.user_id
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
        'added_last_24h', (SELECT count(*) FROM public.payout_methods WHERE created_at >= now() - interval '24 hours'),
        'added_last_7d', (SELECT count(*) FROM public.payout_methods WHERE created_at >= now() - interval '7 days')
    );
$$;

REVOKE ALL ON FUNCTION public.admin_payout_methods_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_payout_methods_summary() TO service_role;
