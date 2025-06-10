import { createClient } from "@/utils/supabase/client"

export async function completeLogout() {
  const supabase = createClient()
  localStorage.clear()
  sessionStorage.clear()
  await supabase.auth.signOut()
  // Only redirect if not already on the sign-in page
  // This hard redirect in completeLogout is fine when explicitly logging out.
      if (window.location.pathname !== '/auth/signin') {
      window.location.href = '/auth/signin'
  }
}

/**
 * Check if a user is authenticated on the client side.
 * This version primarily reports status and avoids auto-redirecting on common "no session" errors.
 * The calling function (e.g., a hook) should decide to redirect based on context.
 */
export async function checkClientAuth() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      // These are common errors if no valid session exists (e.g., user is logged out).
      // We should report them but not force a logout/redirect from this utility function.
      if (
        (error.name === 'AuthApiError' &&
          (error.message === 'User from sub claim in JWT does not exist' ||
            error.message === 'invalid claim: missing sub')) ||
        error.name === 'AuthSessionMissingError'
      ) {
        console.log("Client Auth Util: Invalid or missing session -", error.message);
        return { isAuthenticated: false, user: null, error: error, redirected: false } // Report error, no redirect here
      }
      
      // For other, potentially more significant auth errors, log them and return.
      console.error("Client Auth Util: Auth check error -", error);
      return { isAuthenticated: false, user: null, error, redirected: false }
    }

    // No error, user object might be null (logged out) or populated (logged in)
    return {
      isAuthenticated: !!data.user,
      user: data.user || null,
      error: null,
      redirected: false
    }
  } catch (err: any) {
    // Catch any other unexpected errors during the process
    console.error("Client Auth Util: Unexpected error checking auth -", err);
    // For truly unexpected errors, we still return the error.
    // The caller can decide if a completeLogout is needed.
    // await completeLogout(); // Removed aggressive logout here
    return { isAuthenticated: false, user: null, error: err, redirected: false }
  }
} 