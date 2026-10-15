-- Stop signed-in users from changing sensitive columns on their own `users` row.
--
-- WHY:
--   Policies "Users can update their own data" / "Users can update their own
--   profile" allow every column, and "Users can insert their own user record"
--   allows any values. A signed-in user could set user_type = 'admin' (which the
--   admin panel trusts), give themselves coins or earnings, or reactivate a
--   deactivated account.
--
-- WHAT THIS MIGRATION DOES (signed-in roles authenticated/anon only; server code
-- using the service role and SECURITY DEFINER functions are unaffected):
--   INSERT: user_type must be 'creator' or 'advertiser'; coins, earnings and
--           referral counts must be empty or 0.
--   UPDATE: user_type can never become or stop being 'admin', and can switch
--           between creator and advertiser only before the username is set
--           (during sign-up). coins, total_lifetime_coins_earned,
--           affiliate_earnings, other_earnings, advertisers_referred,
--           creators_referred and is_active cannot be changed.
--   Normal edits (name, photo, email, username, login history, geo data) still work.
--
-- ROLLBACK: DROP TRIGGER users_guard_user_insert / users_guard_user_update ON public.users.

CREATE OR REPLACE FUNCTION public.users_guard_user_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_locked text[] := ARRAY[
    'coins', 'total_lifetime_coins_earned', 'affiliate_earnings', 'other_earnings',
    'advertisers_referred', 'creators_referred', 'is_active'
  ];
  v_col text;
  v_new jsonb;
  v_old jsonb;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  v_new := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_type IS DISTINCT FROM 'creator' AND NEW.user_type IS DISTINCT FROM 'advertiser' THEN
      RAISE EXCEPTION 'Account type must be creator or advertiser.' USING ERRCODE = '42501';
    END IF;
    FOREACH v_col IN ARRAY v_locked LOOP
      CONTINUE WHEN v_col = 'is_active';
      IF coalesce((v_new ->> v_col)::numeric, 0) <> 0 THEN
        RAISE EXCEPTION 'You can''t set % yourself.', v_col USING ERRCODE = '42501';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);

  IF NEW.user_type IS DISTINCT FROM OLD.user_type THEN
    IF OLD.user_type = 'admin' OR NEW.user_type = 'admin' THEN
      RAISE EXCEPTION 'You can''t change this account type.' USING ERRCODE = '42501';
    END IF;
    IF OLD.username IS NOT NULL AND btrim(OLD.username) <> '' THEN
      RAISE EXCEPTION 'Account type can only be chosen during sign-up.' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOREACH v_col IN ARRAY v_locked LOOP
    IF (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN
      RAISE EXCEPTION 'You can''t change % yourself.', v_col USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_user_insert ON public.users;
CREATE TRIGGER users_guard_user_insert
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_user_write();

DROP TRIGGER IF EXISTS users_guard_user_update ON public.users;
CREATE TRIGGER users_guard_user_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_user_write();
