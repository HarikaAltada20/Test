-- Hardening delta: explicitly remove account-switch RPC execute grants from
-- anon/authenticated and allow only service_role (plus owner postgres).

DO $$
BEGIN
  IF to_regprocedure('public.account_switch_link_shared_pool(uuid,uuid,text,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.account_switch_link_shared_pool(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.account_switch_link_shared_pool(UUID, UUID, TEXT, TEXT, TEXT) TO service_role';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.account_switch_unlink_from_pool(uuid,uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.account_switch_unlink_from_pool(UUID, UUID) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.account_switch_unlink_from_pool(UUID, UUID) TO service_role';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.account_switch_propagate_refresh_tokens(uuid,uuid,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.account_switch_propagate_refresh_tokens(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.account_switch_propagate_refresh_tokens(UUID, UUID, TEXT, TEXT) TO service_role';
  END IF;
END
$$;
