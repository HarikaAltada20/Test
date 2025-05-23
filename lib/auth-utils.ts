import { createClient } from "@/utils/supabase/client"

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
      console.error("Auth check error:", error)
      return { isAuthenticated: false, user: null, error }
    }

    return {
      isAuthenticated: !!data.user,
      user: data.user || null,
      error: null
    }
  } catch (err) {
    console.error("Unexpected error checking auth:", err)
    return { isAuthenticated: false, user: null, error: err }
  }
} 