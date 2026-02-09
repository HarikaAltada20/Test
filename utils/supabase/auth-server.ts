import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Returns true if the error indicates no valid session (missing/invalid refresh token or no session).
 * In these cases the server should treat the user as signed out instead of throwing.
 */
export function isRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; name?: string }
  if (e.code === 'refresh_token_not_found') return true
  if (e.name === 'AuthSessionMissingError') return true
  if (e.name === 'AuthApiError' && e.message) {
    if (/Refresh Token Not Found|Invalid Refresh Token/i.test(e.message)) return true
  }
  return false
}

export type GetUserSafeResult = { data: { user: User | null } }

/**
 * Server-side safe getUser: calls supabase.auth.getUser() and on "refresh token not found",
 * "auth session missing", or similar no-session errors returns { data: { user: null } } instead of throwing.
 * Use this in Server Components and middleware to avoid unhandled auth errors and 500s.
 */
export async function getUserSafe(
  supabase: SupabaseClient
): Promise<GetUserSafeResult> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error && isRefreshTokenError(error)) {
      return { data: { user: null } }
    }
    if (error) throw error
    return { data: { user: data.user ?? null } }
  } catch (err) {
    if (isRefreshTokenError(err)) {
      return { data: { user: null } }
    }
    throw err
  }
}
