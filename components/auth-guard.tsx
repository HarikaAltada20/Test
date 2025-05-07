"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Skeleton } from "@/components/ui/skeleton"

interface AuthGuardProps {
    children: React.ReactNode
    requiredUserType?: "advertiser" | "creator" | null // Optional: specific user type required
}

export function AuthGuard({ children, requiredUserType = null }: AuthGuardProps) {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

    useEffect(() => {
        const checkAuthorization = async () => {
            // Skip check while still loading
            if (isLoading) return

            // Not authenticated
            if (!user) {
                console.log("User not authenticated, redirecting to login")
                router.push("/auth/signin")
                return
            }

            // Check for specific user type if required
            if (requiredUserType !== null) {
                try {
                    // Fetch user data from API or get from context
                    const userType = user?.user_metadata?.user_type

                    if (userType !== requiredUserType) {
                        console.log(`User type mismatch: required ${requiredUserType}, got ${userType}`)
                        setIsAuthorized(false)
                        return
                    }
                } catch (error) {
                    console.error("Error checking user type:", error)
                    setIsAuthorized(false)
                    return
                }
            }

            // User is authenticated and passes any role checks
            setIsAuthorized(true)
        }

        checkAuthorization()
    }, [user, isLoading, router, requiredUserType])

    // Still loading or checking authorization
    if (isLoading || isAuthorized === null) {
        return (
            <div className="flex flex-col space-y-3 p-10">
                <Skeleton className="h-[125px] w-[250px] rounded-xl" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        )
    }

    // Not authorized with specific role
    if (isAuthorized === false) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                    <p className="mb-4">You don't have the required permissions to access this page.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        )
    }

    // Authorized
    return <>{children}</>
} 