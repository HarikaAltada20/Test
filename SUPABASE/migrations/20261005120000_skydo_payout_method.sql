-- Skydo payout method (email only).
--
-- Rules:
--   * method_type = 'skydo', details = { "email": "<lowercased, trimmed>" }.
--   * Can only be added when the user's withdrawable balance is >= 500 cents ($5)
--     (creator_profiles or advertiser_profiles, whichever is larger).
--   * At most one Skydo method per user.
--   * Permanent for the owner: the owner cannot change the email / type or delete it.
--     Admins (auth.uid() differs from owner), service role (auth.uid() IS NULL) and the
--     users ON DELETE CASCADE are not blocked.
--
-- Safe to re-run.

INSERT INTO public.payout_method_type_settings (method_type, is_paused)
VALUES ('skydo', false)
ON CONFLICT (method_type) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS payout_methods_one_skydo_per_user
    ON public.payout_methods (user_id)
    WHERE method_type = 'skydo';

CREATE OR REPLACE FUNCTION public.enforce_skydo_payout_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_email text;
    v_balance integer;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.method_type = 'skydo' AND v_uid IS NOT NULL AND v_uid = OLD.user_id THEN
            RAISE EXCEPTION 'Skydo payout method is permanent and cannot be removed. Please contact support if you need help.';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.method_type = 'skydo' AND v_uid IS NOT NULL AND v_uid = OLD.user_id THEN
        IF NEW.method_type IS DISTINCT FROM 'skydo'
           OR lower(trim(COALESCE(NEW.details->>'email', ''))) IS DISTINCT FROM lower(trim(COALESCE(OLD.details->>'email', ''))) THEN
            RAISE EXCEPTION 'Skydo email is permanent and cannot be changed. Please contact support if you need help.';
        END IF;
    END IF;

    IF NEW.method_type <> 'skydo' THEN
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
