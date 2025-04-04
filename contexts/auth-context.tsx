"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { createClientSupabaseClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, role: "advertiser" | "creator") => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClientSupabaseClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
        router.refresh()
      })

      return () => {
        subscription.unsubscribe()
      }
    }

    getUser()
  }, [supabase, router])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, role: "advertiser" | "creator") => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    })

    if (error) throw error

    // Create user profile in the database
    if (data.user) {
      if (role === "advertiser") {
        await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email!,
          role: "advertiser",
        })

        await supabase.from("advertiser_profiles").insert({
          user_id: data.user.id,
          company_name: email.split("@")[0], // Temporary company name
        })
      } else {
        await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email!,
          role: "creator",
        })

        await supabase.from("creator_profiles").insert({
          user_id: data.user.id,
          username: email.split("@")[0], // Temporary username
        })
      }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

