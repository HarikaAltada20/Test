import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

export function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return cookieStore.then(cookies => cookies.get(name)?.value ?? "")
        },
        async set(name: string, value: string, options: { path?: string }) {
          cookieStore.then(cookies => cookies.set({ name, value, ...options }))
        },
        async remove(name: string, options: { path?: string }) {
          cookieStore.then(cookies => cookies.set({ name, value: "", ...options }))
        },
      },
    }
  )
}

