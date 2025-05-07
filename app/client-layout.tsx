"use client"

import React from "react"
import { AuthProvider } from "@/contexts/auth-context"
import { SupabaseProvider } from "@/contexts/supabase-context"
import { Toaster } from "@/components/ui/toaster"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <SupabaseProvider>
            <AuthProvider>
                {children}
                <Toaster />
            </AuthProvider>
        </SupabaseProvider>
    )
} 