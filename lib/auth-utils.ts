import { createClient } from "@/utils/supabase/client"

/**
 * Performs a complete logout clearing all session and cache data
 * To be used for client-side rendering
 */
export async function completeLogout() {
  // Create a supabase client
  const supabase = createClient()

  // Clear all local storage
  localStorage.clear()

  // Clear all session storage
  sessionStorage.clear()

  // Sign out from Supabase to remove server-side session
  await supabase.auth.signOut()

  // Redirect to sign-in page
  window.location.href = '/auth/signin'
}

/**
 * Check if a user is authenticated on the client side
 * Returns an object with isAuthenticated flag and user data
 */
export async function checkClientAuth() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error("Auth check error:", error)
      return { isAuthenticated: false, user: null, error }
    }

    return {
      isAuthenticated: !!data.session,
      user: data.session?.user || null,
      error: null
    }
  } catch (err) {
    console.error("Unexpected error checking auth:", err)
    return { isAuthenticated: false, user: null, error: err }
  }
} 