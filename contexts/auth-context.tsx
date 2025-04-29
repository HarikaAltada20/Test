"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseClient } from "@/lib/supabase/client"
import { type User as SupabaseUser } from "@supabase/supabase-js"

interface User extends SupabaseUser {
  avatar_url?: string;
  full_name?: string;
}

interface AuthContextValue {
  isLoading: boolean
  user: User | null
  error: string | null
  needsUsername: boolean
  signUp: (email: string, password: string, fullName?: string, user_type?: "advertiser" | "creator", referralCode?: string) => Promise<{ success: boolean, emailConfirmationRequired: boolean, error: string | null }>
  signIn: (email: string, password: string) => Promise<{ success: boolean, error: string | null }>
  signOut: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (password: string) => Promise<void>
  updateUsername: (username: string) => Promise<{ success: boolean, error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [needsUsername, setNeedsUsername] = useState<boolean>(false)
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    const getUser = async () => {
      setIsLoading(true)
      try {
        // First check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (session) {
          // If we have a session, get the user
          const { data: { user }, error: userError } = await supabase.auth.getUser()

          if (userError) {
            throw userError
          }

          if (user) {
            setUser(user as User)
          }
        } else {
          setUser(null)
        }

        // Set up auth state change listener
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
              if (userError) {
                console.error('Error verifying user:', userError)
                setUser(null)
                return
              }
              setUser(verifiedUser as User || null)
            } else if (event === 'SIGNED_OUT') {
              setUser(null)
            }
          }
        )

        return () => {
          authListener.subscription.unsubscribe()
        }
      } catch (error: any) {
        console.error("Auth initialization error:", error)

        // Check if the error indicates the user associated with the token doesn't exist
        if (error?.code === 'user_not_found' || (error?.message && error.message.includes('User not found'))) {
          console.warn("User from token not found in Supabase. Signing out.");
          // Clear the invalid session by signing out
          await supabase.auth.signOut(); // Don't need to handle signOut errors here, just clear the local session
          setUser(null); // Ensure user state is cleared
        } else {
          // For other errors, set the error state
          setError(error.message);
          setUser(null);
        }
      } finally {
        setIsLoading(false)
      }
    }

    getUser()
  }, [supabase.auth])

  useEffect(() => {
    // Check if user needs to set a username
    const checkUsername = async () => {
      if (user && !isLoading) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();  // Use maybeSingle instead of single to avoid the error

          if (error) {
            console.warn('Error checking username:', error.message);
            // Don't update state on error during hot reload
            if (!error.message.includes('JWT') && !error.message.includes('auth')) {
              setNeedsUsername(false);
            }
            return;
          }

          setNeedsUsername(!data?.username);
        } catch (err) {
          console.warn('Unexpected error checking username:', err);
          // Don't change state on unexpected errors during hot reload
        }
      }
    };

    checkUsername();
  }, [user, isLoading]);

  const signUp = async (email: string, password: string, fullName?: string, user_type?: "advertiser" | "creator", referralCode?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Remove the pre-check for existing user by email
      /*
      const { data: existingUserCheck, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUserCheck) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }
      */

      // If referral code was provided, store it in sessionStorage
      if (referralCode) {
        // Check if the referral code exists using maybeSingle()
        const { data: referrerCheck, error: referrerError } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referralCode)
          .maybeSingle(); // <-- Changed to maybeSingle()

        // Handle error checking referrer (ignoring null data)
        if (referrerError) {
          console.error("Error checking referral code:", referrerError);
          // Optionally, decide if this error should prevent signup or just log
          // For now, let's throw a generic error, but you might adjust this
          throw new Error("Could not verify referral code. Please try again later.");
        }

        // If referrerCheck is null, the code is invalid
        if (!referrerCheck) {
          throw new Error("Invalid referral code. Please check and try again.");
        }

        // Store the referral code in sessionStorage
        sessionStorage.setItem('referralCode', referralCode);
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            user_type: user_type || 'creator',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error

      // Redirect to OTP verification page
      window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`;

      return {
        success: true,
        emailConfirmationRequired: true,
        error: null
      };
    } catch (error: any) {
      let errorMessage = error.message;

      // Make the error message more user-friendly
      if (errorMessage.includes("violates unique constraint") && errorMessage.includes("users_email_key")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (errorMessage.includes("User already registered")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      }

      setError(errorMessage);
      return {
        success: false,
        emailConfirmationRequired: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Handle specific error types and provide more user-friendly messages
        let errorMessage = error.message;
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "The email or password you entered is incorrect";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Please confirm your email address before signing in";
        }

        throw new Error(errorMessage);
      }

      return { success: true, error: null };
    } catch (error: any) {
      setError(error.message)
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // First clear user state
      setUser(null)

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Sign out error:", error)
        throw error
      }

      // Redirect to login page instead of home page
      window.location.href = '/auth/signin'
    } catch (error: any) {
      console.error("Sign out failed:", error)
      setError(error.message)
      // Even if there's an error, we should redirect to login page
      window.location.href = '/auth/signin'
    } finally {
      setIsLoading(false)
    }
  }

  const forgotPassword = async (email: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const resetPassword = async (password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })
      if (error) throw error

      // Redirect to sign in page
      router.push('/auth/signin')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const updateUsername = async (username: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUser) {
        throw new Error("This username is already taken. Please choose another one.");
      }

      // Update the username
      const { error } = await supabase
        .from('users')
        .update({ username })
        .eq('id', user?.id);

      if (error) throw error

      // Update the local state
      setNeedsUsername(false)

      return { success: true, error: null };
    } catch (error: any) {
      setError(error.message)
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        user,
        error,
        needsUsername,
        signUp,
        signIn,
        signOut,
        forgotPassword,
        resetPassword,
        updateUsername,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

