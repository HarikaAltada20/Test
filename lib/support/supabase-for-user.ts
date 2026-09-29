import { createAdminClient } from "@/utils/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUserRow } from "@/lib/support/auth";

/**
 * Server-side support DB access after session verification.
 * Uses service role so writes work even if RLS policies are not yet applied;
 * all queries must filter by the authenticated user id in route handlers.
 */
export function supportDbForUser(_user: AuthUserRow): SupabaseClient {
  return createAdminClient();
}
