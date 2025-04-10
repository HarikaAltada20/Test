"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClientSupabaseClient } from "@/lib/supabase/client"
import { type User as SupabaseUser } from "@supabase/supabase-js"

interface User extends SupabaseUser {
  avatar_url?: string;
  full_name?: string;
}

interface AuthContextValue {
  isLoading: boolean
  user: User | null
  error: string | null
  signUp: (email: string, password: string, fullName?: string, role?: "advertiser" | "creator") => Promise<{ success: boolean, emailConfirmationRequired: boolean, error: string | null }>
  signIn: (email: string, password: string) => Promise<{ success: boolean, error: string | null }>
  signOut: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientSupabaseClient()

  useEffect(() => {
    const getUser = async () => {
      setIsLoading(true)
      try {
        // First get session
        const { data: { session } } = await supabase.auth.getSession()

        // Then verify with getUser if session exists
        if (session) {
          const { data: { user } } = await supabase.auth.getUser()
          setUser(user as User || null)
        }

        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            // On auth state change, verify with getUser()
            if (session) {
              const { data: { user: verifiedUser } } = await supabase.auth.getUser()
              setUser(verifiedUser as User || null)
            } else {
              setUser(null)
            }
          }
        )

        return () => {
          authListener.subscription.unsubscribe()
        }
      } catch (error: any) {
        setError(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    getUser()
  }, [supabase.auth])

  const signUp = async (email: string, password: string, fullName?: string, role?: "advertiser" | "creator") => {
    setIsLoading(true)
    setError(null)
    try {
      // First check if user already exists in the users table
      const { data: existingUserCheck, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      // If the user already exists in our database, show a friendly error
      if (existingUserCheck) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role || 'advertiser',
          }
        }
      })

      if (error) throw error

      // Create user profile after sign up
      if (data.user) {
        try {
          // Insert new user record
          const { error: userError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email,
              full_name: fullName,
              role: role || 'advertiser',
              wallet_balance: 0,
              currency_code: 'USD'
            })

          if (userError) {
            // Check if it's a duplicate key error
            if (userError.message && userError.message.includes("violates unique constraint") &&
              userError.message.includes("users_email_key")) {
              throw new Error("An account with this email already exists. Please sign in instead.");
            }
            throw userError;
          }
        } catch (insertError: any) {
          // If there was an error creating the user profile, we should also delete the auth user
          // to prevent orphaned auth accounts
          await supabase.auth.admin.deleteUser(data.user.id);
          throw insertError;
        }
      }

      // Check if email confirmation is required
      const emailConfirmationRequired = !data.session;

      return {
        success: true,
        emailConfirmationRequired,
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
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      router.push('/')
    } catch (error: any) {
      setError(error.message)
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

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        user,
        error,
        signUp,
        signIn,
        signOut,
        forgotPassword,
        resetPassword,
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

