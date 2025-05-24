import { createClient } from "@/utils/supabase/client"

export async function completeLogout() {
  const supabase = createClient()
  localStorage.clear()
  sessionStorage.clear()
  await supabase.auth.signOut()
  // Only redirect if not already on the sign-in page
  if (window.location.pathname !== '/auth/signin') {
    window.location.href = '/auth/signin'
  }
}

/**
 * Check if a user is authenticated on the client side
 * Returns an object with isAuthenticated flag and user data
 */
export async function checkClientAuth() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      // Specifically check for errors indicating an invalid JWT, non-existent user, or missing session
      if (
        (error.name === 'AuthApiError' &&
          (error.message === 'User from sub claim in JWT does not exist' ||
            error.message === 'invalid claim: missing sub')) ||
        error.name === 'AuthSessionMissingError'
      ) {
        console.log("Invalid or missing session. Clearing session and redirecting to sign-in.")
        await completeLogout()
        // Return a specific object to indicate redirection and prevent further processing
        return { isAuthenticated: false, user: null, error: null, redirected: true }
      }
      // Log other authentication errors
      console.error("Auth check error:", error)
      return { isAuthenticated: false, user: null, error }
    }

    return {
      isAuthenticated: !!data.user,
      user: data.user || null,
      error: null
    }
  } catch (err) {
    // Catch any other unexpected errors during the process
    console.error("Unexpected error checking auth:", err)
    // Attempt to clear session and redirect as a fallback for unexpected issues
    await completeLogout()
    return { isAuthenticated: false, user: null, error: err, redirected: true }
  }
} 