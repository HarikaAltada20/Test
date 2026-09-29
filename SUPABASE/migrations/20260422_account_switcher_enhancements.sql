-- Account switcher: email hint for re-link, Google OAuth pending row, device session tracking (max 3 per user in app logic)

ALTER TABLE public.user_sessions_vault
  ADD COLUMN IF NOT EXISTS linked_target_email TEXT;

COMMENT ON COLUMN public.user_sessions_vault.linked_target_email IS
  'Target account email at link time; shown only to vault owner for re-link UX.';

CREATE TABLE IF NOT EXISTS public.account_switch_oauth_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  encrypted_owner_refresh TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_switch_oauth_pending_expires
  ON public.account_switch_oauth_pending (expires_at);

ALTER TABLE public.account_switch_oauth_pending ENABLE ROW LEVEL SECURITY;

-- No user-facing policies: only service role (admin client) touches this table.

CREATE TABLE IF NOT EXISTS public.user_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, refresh_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_device_sessions_user_last_seen
  ON public.user_device_sessions (user_id, last_seen_at DESC);

ALTER TABLE public.user_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own device sessions"
  ON public.user_device_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own device sessions"
  ON public.user_device_sessions
  FOR DELETE
  USING (auth.uid() = user_id);
