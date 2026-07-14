import { createClient } from "@/utils/supabase/client"
import { isRefreshTokenError } from "@/utils/supabase/auth-server"

const CLIENT_AUTH_RETRY_MS = 250
/** Prefer local session when access token has this many seconds left (no Auth API). */
const SESSION_TRUST_SECONDS = 60

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function completeLogout() {
  const supabase = createClient()
  // Revoke server-side session everywhere before wiping storage (tokens live in storage).
  await supabase.auth.signOut({ scope: 'global' })
  localStorage.clear()
  sessionStorage.clear()
  // Only redirect if not already on the sign-in page
  // This hard redirect in completeLogout is fine when explicitly logging out.
  if (window.location.pathname !== '/auth/signin') {
    window.location.href = '/auth/signin'
  }
}

export type ClientAuthResult = {
  isAuthenticated: boolean
  user: any | null
  error: any | null
  redirected: boolean
  /** True when first check failed with a refresh-like error and retry recovered. */
  recoveredAfterRetry?: boolean
  /** True when we trusted getSession and skipped Auth API. */
  usedLocalSession?: boolean
}

async function getUserAuthResult(): Promise<ClientAuthResult> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      if (
        isRefreshTokenError(error) ||
        (error.name === 'AuthApiError' &&
          (error.message === 'User from sub claim in JWT does not exist' ||
            error.message === 'invalid claim: missing sub')) ||
        error.name === 'AuthSessionMissingError'
      ) {
        console.log("Client Auth Util: Invalid or missing session -", error.message);
        return { isAuthenticated: false, user: null, error: error, redirected: false }
      }

      console.error("Client Auth Util: Auth check error -", error);
      return { isAuthenticated: false, user: null, error, redirected: false }
    }

    return {
      isAuthenticated: !!data.user,
      user: data.user || null,
      error: null,
      redirected: false
    }
  } catch (err: any) {
    console.error("Client Auth Util: Unexpected error checking auth -", err);
    return { isAuthenticated: false, user: null, error: err, redirected: false }
  }
}

/**
 * Check if a user is authenticated on the client side.
 * Prefers local getSession when the access token is not near expiry (no Auth API).
 * Otherwise getUser (may refresh), with one retry on refresh-token races.
 * Does not call completeLogout / global signOut on soft failures.
 */
export async function checkClientAuth(
  options: { retryOnRefreshError?: boolean } = {}
): Promise<ClientAuthResult> {
  const { retryOnRefreshError = true } = options
  const supabase = createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      const expiresAt = session.expires_at ?? 0
      const secondsLeft = expiresAt - Math.floor(Date.now() / 1000)
      if (secondsLeft > SESSION_TRUST_SECONDS) {
        return {
          isAuthenticated: true,
          user: session.user,
          error: null,
          redirected: false,
          usedLocalSession: true,
        }
      }
    }
  } catch {
    // Fall through to getUser
  }

  const first = await getUserAuthResult()

  if (first.isAuthenticated || !retryOnRefreshError) {
    return first
  }

  const looksLikeRefreshRace =
    first.error != null && isRefreshTokenError(first.error)

  if (!looksLikeRefreshRace) {
    return first
  }

  console.log('[auth] client_refresh_error_retrying')
  await sleep(CLIENT_AUTH_RETRY_MS)
  const second = await getUserAuthResult()

  if (second.isAuthenticated) {
    console.log('[auth] client_refresh_race_retry_succeeded')
    return { ...second, recoveredAfterRetry: true }
  }

  console.log('[auth] client_refresh_error_still_unauthenticated')
  return second
}
