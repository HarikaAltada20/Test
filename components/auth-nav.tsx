"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

export function AuthNav() {
    const pathname = usePathname()
    const { user, signOut } = useAuth()

    if (user) {
        return (
            <div className="flex items-center space-x-4">
                <Link
                    href="/dashboard"
                    className={cn(
                        "text-sm font-medium transition-colors hover:text-primary",
                        pathname.startsWith("/dashboard") ? "text-primary" : "text-muted-foreground",
                    )}
                >
                    Dashboard
                </Link>
                <Button variant="ghost" onClick={signOut}>
                    Sign Out
                </Button>
            </div>
        )
    }

    return (
        <Link href="/login">
            <Button>Login</Button>
        </Link>
    )
}
