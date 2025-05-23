import { createClient } from "@/utils/supabase/client"
import { AuthError } from "@supabase/supabase-js"

export async function completeLogout() {
  const supabase = createClient()
  localStorage.clear()
  sessionStorage.clear()
  await supabase.auth.signOut()
  window.location.href = '/auth/signin'
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
      if (error.name === 'AuthSessionMissingError' || (error instanceof AuthError && error.status === 401)) {
        // This is an expected case for non-logged-in users.
        // You might choose to log it differently or not at all.
        // For now, let's avoid a console.error for this specific case.
        // console.info("Auth session not found (expected for guests):", error.message);
      } else {
        console.error("Auth check error (unexpected):", error)
      }
      return { isAuthenticated: false, user: null, error }
    }

    return {
      isAuthenticated: !!data.user,
      user: data.user || null,
      error: null
    }
  } catch (err: any) {
    console.error("Unexpected error during client auth check:", err)
    const errorToReturn = err instanceof Error ? err : new Error(String(err))
    return { isAuthenticated: false, user: null, error: errorToReturn }
  }
} 