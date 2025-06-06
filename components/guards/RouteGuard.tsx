"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Shield, ArrowLeft } from 'lucide-react'

interface RouteGuardProps {
    children: React.ReactNode
    allowedUserTypes: ('advertiser' | 'creator' | 'admin')[]
    fallbackPath?: string
}

export function RouteGuard({
    children,
    allowedUserTypes,
    fallbackPath
}: RouteGuardProps) {
    const [userType, setUserType] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isAuthorized, setIsAuthorized] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const supabase = createClient()

    useEffect(() => {
        async function checkAccess() {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    router.push('/auth/signin')
                    return
                }

                const { data: userData, error } = await supabase
                    .from('users')
                    .select('user_type')
                    .eq('id', user.id)
                    .single()

                if (error || !userData) {
                    console.error('Error fetching user type:', error)
                    setIsLoading(false)
                    return
                }

                const fetchedUserType = userData.user_type
                setUserType(fetchedUserType)

                const authorized = allowedUserTypes.includes(fetchedUserType as any)
                setIsAuthorized(authorized)

                if (!authorized) {
                    // Show unauthorized toast
                    toast({
                        title: "Access Denied",
                        description: `This page is only available for ${allowedUserTypes.join(' and ')} accounts.`,
                        variant: "destructive",
                    })

                    // Redirect to appropriate fallback
                    const defaultFallback = fetchedUserType === 'creator'
                        ? '/dashboard/opportunities'
                        : fetchedUserType === 'admin'
                            ? '/dashboard'
                            : '/dashboard/contests'

                    setTimeout(() => {
                        router.push(fallbackPath || defaultFallback)
                    }, 2000)
                }

            } catch (error) {
                console.error('Route guard error:', error)
            } finally {
                setIsLoading(false)
            }
        }

        checkAccess()

        // Check for unauthorized redirect from middleware
        const error = searchParams.get('error')
        if (error === 'unauthorized') {
            toast({
                title: "Unauthorized Access",
                description: "You don't have permission to access that page.",
                variant: "destructive",
            })
        }
    }, [allowedUserTypes, fallbackPath, router, searchParams, supabase.auth, toast])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Shield className="h-12 w-12 animate-pulse text-blue-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">Verifying access permissions...</p>
                </div>
            </div>
        )
    }

    if (!isAuthorized) {
        const userTypeDisplay = userType === 'advertiser' ? 'Brand' : userType === 'admin' ? 'Admin' : 'Creator'
        const allowedDisplay = allowedUserTypes.map(type =>
            type === 'advertiser' ? 'Brand' : type === 'admin' ? 'Admin' : 'Creator'
        ).join(' and ')

        return (
            <div className="container mx-auto py-8 px-4">
                <Alert variant="destructive" className="max-w-md mx-auto">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold">Access Denied</h3>
                                <p className="text-sm mt-1">
                                    This page is only available for {allowedDisplay} accounts.
                                    You are currently logged in as a {userTypeDisplay}.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.back()}
                                >
                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                    Go Back
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        const defaultPath = userType === 'creator'
                                            ? '/dashboard/opportunities'
                                            : userType === 'admin'
                                                ? '/dashboard'
                                                : '/dashboard/contests'
                                        router.push(fallbackPath || defaultPath)
                                    }}
                                >
                                    Go to Dashboard
                                </Button>
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return <>{children}</>
}

// Helper hook for easy route protection
export function useRouteGuard(allowedUserTypes: ('advertiser' | 'creator')[]) {
    const [userType, setUserType] = useState<string | null>(null)
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
    const supabase = createClient()

    useEffect(() => {
        async function checkAccess() {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) return

                const { data: userData } = await supabase
                    .from('users')
                    .select('user_type')
                    .eq('id', user.id)
                    .single()

                if (userData) {
                    const fetchedUserType = userData.user_type
                    setUserType(fetchedUserType)
                    setIsAuthorized(allowedUserTypes.includes(fetchedUserType as any))
                }
            } catch (error) {
                console.error('Route guard hook error:', error)
                setIsAuthorized(false)
            }
        }

        checkAccess()
    }, [allowedUserTypes, supabase.auth])

    return { userType, isAuthorized }
} 