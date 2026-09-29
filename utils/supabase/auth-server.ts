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

/** Session cookies only (not PKCE code-verifier). Matches chunked tokens too. */
export const SUPABASE_AUTH_TOKEN_COOKIE = /^sb-.*-auth-token(?:\.\d+)?$/

/** True when request/storage has a Supabase session cookie (not merely a PKCE verifier). */
export function cookieListHasSupabaseAuthToken(
  cookies: ReadonlyArray<{ name: string }>
): boolean {
  return cookies.some(({ name }) => SUPABASE_AUTH_TOKEN_COOKIE.test(name))
}

const REFRESH_RETRY_MS = 220

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type GetUserSafeMeta = {
  /** First getUser failed with a refresh-token error; second attempt returned a user. */
  refreshedAfterRetry?: boolean
  /** Refresh-token error(s) after retry; caller must NOT treat this like a hard logout wipe. */
  refreshErrorSoftNull?: boolean
}

export type GetUserSafeResult = {
  data: { user: User | null }
  meta?: GetUserSafeMeta
}

type GetUserOnceResult = {
  user: User | null
  refreshError: boolean
  otherError?: unknown
}

async function getUserOnce(
  supabase: SupabaseClient
): Promise<GetUserOnceResult> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error && isRefreshTokenError(error)) {
      return { user: null, refreshError: true }
    }
    if (error) {
      return { user: null, refreshError: false, otherError: error }
    }
    return { user: data.user ?? null, refreshError: false }
  } catch (err) {
    if (isRefreshTokenError(err)) {
      return { user: null, refreshError: true }
    }
    throw err
  }
}

/**
 * Server-side safe getUser. On refresh-token races / missing session errors:
 * retries once, then returns null WITHOUT signing out.
 *
 * Concurrent refreshes (middleware + layout + browser autoRefresh) often produce
 * `refresh_token_not_found` for the loser even when another request just succeeded.
 * Calling signOut(local) there wipes a still-valid session — do not do that here.
 *
 * Middleware may call {@link clearAuthCookiesIfTrulyDead} when cookies are
 * confirmed empty/unusable after this soft null.
 */
export async function getUserSafe(
  supabase: SupabaseClient
): Promise<GetUserSafeResult> {
  const first = await getUserOnce(supabase)
  if (first.otherError) throw first.otherError
  if (first.user) {
    return { data: { user: first.user } }
  }

  if (!first.refreshError) {
    return { data: { user: null } }
  }

  console.log('[auth] refresh_token_error_initial')
  await sleep(REFRESH_RETRY_MS)

  const second = await getUserOnce(supabase)
  if (second.otherError) throw second.otherError
  if (second.user) {
    console.log('[auth] refresh_race_retry_succeeded')
    return {
      data: { user: second.user },
      meta: { refreshedAfterRetry: true },
    }
  }

  console.log('[auth] refresh_error_soft_null')
  return {
    data: { user: null },
    meta: { refreshErrorSoftNull: true },
  }
}

/**
 * Middleware-only: clear auth cookies when getUser failed AND there is no
 * usable session left in cookie storage. If a session cookie payload still
 * exists, assume a concurrent refresh race and leave cookies alone.
 *
 * @returns true if cookies were cleared as truly dead
 */
export async function clearAuthCookiesIfTrulyDead(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const session = data.session

  if (session?.access_token || session?.refresh_token) {
    console.log('[auth] skip_cookie_clear: session_still_present')
    return false
  }

  await supabase.auth.signOut({ scope: 'local' })
  console.log('[auth] cleared_truly_dead_cookies')
  return true
}

/**
 * Read user from cookie session without calling the Auth API (`/auth/v1/user`).
 * Use on routes where middleware already refreshed the session
 * (`/`, `/dashboard/*`, `/auth/*`, `/choose-username`).
 * Keep {@link getUserSafe} / `getUser` for middleware refresh and API mutations.
 */
export async function getSessionUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}
