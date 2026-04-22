-- Hardening delta: explicitly remove account-switch RPC execute grants from
-- anon/authenticated and allow only service_role (plus owner postgres).

REVOKE ALL ON FUNCTION public.account_switch_link_shared_pool(UUID, UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_switch_link_shared_pool(UUID, UUID, TEXT, TEXT, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.account_switch_unlink_from_pool(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_switch_unlink_from_pool(UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.account_switch_propagate_refresh_tokens(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_switch_propagate_refresh_tokens(UUID, UUID, TEXT, TEXT)
  TO service_role;
