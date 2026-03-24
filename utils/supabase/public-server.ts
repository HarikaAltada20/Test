import { createClient } from "@supabase/supabase-js";

/**
 * Anon Supabase client without reading request cookies.
 * Use for public, cacheable server data (e.g. marketing aggregates) so
 * `unstable_cache` stays stable across requests.
 */
export function createPublicServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
