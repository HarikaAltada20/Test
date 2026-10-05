-- Let owners remove their Skydo payout method while it is still email_pending,
-- so they can replace a mistyped email. Once an admin moves it to email_sent or
-- verified it is permanent for the owner again.
-- Requires 20261005130000_skydo_verification_and_admin_payout_view.sql.
--
-- Only the DELETE branch changes; the email still can't be edited in place.
-- Safe to re-run.

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
        IF OLD.method_type = 'skydo'
           AND v_uid IS NOT NULL AND v_uid = OLD.user_id
           AND COALESCE(OLD.skydo_status, 'email_pending') <> 'email_pending' THEN
            RAISE EXCEPTION 'Your Skydo email can''t be removed after Skydo has emailed you. Please contact support if you need help.';
        END IF;
        RETURN OLD;
    END IF;

    v_is_owner := v_uid IS NOT NULL AND v_uid = NEW.user_id;

    IF TG_OP = 'UPDATE' AND v_is_owner THEN
        IF OLD.method_type = 'skydo' AND (
            NEW.method_type IS DISTINCT FROM 'skydo'
            OR lower(trim(COALESCE(NEW.details->>'email', ''))) IS DISTINCT FROM lower(trim(COALESCE(OLD.details->>'email', '')))
        ) THEN
            RAISE EXCEPTION 'Skydo email can''t be edited. While it is pending you can remove it and add a different one.';
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
