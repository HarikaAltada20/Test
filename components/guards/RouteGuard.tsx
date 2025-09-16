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
            <div className="flex items-center justify-center h-[78vh]">
                <div className="text-center">
                  
                    <div className="flex flex-col items-center justify-center space-y-4">
    
      <div className="relative flex items-center justify-center">
      
        <svg
          className="h-28 w-28 animate-spin-slow text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 
               3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 
               3.31.826 2.37 2.37a1.724 1.724 0 
               001.065 2.572c1.756.426 1.756 2.924 
               0 3.35a1.724 1.724 0 00-1.066 
               2.573c.94 1.543-.826 3.31-2.37 
               2.37a1.724 1.724 0 00-2.572 
               1.065c-.426 1.756-2.924 
               1.756-3.35 0a1.724 1.724 0 
               00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 
               1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 
               0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 
               2.37-2.37.996.608 2.296.07 
               2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>

        <svg
          className="h-16 w-16 absolute right-[-30px] top-16 animate-spin-slow-reverse text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 
               3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 
               3.31.826 2.37 2.37a1.724 1.724 0 
               001.065 2.572c1.756.426 1.756 2.924 
               0 3.35a1.724 1.724 0 00-1.066 
               2.573c.94 1.543-.826 3.31-2.37 
               2.37a1.724 1.724 0 00-2.572 
               1.065c-.426 1.756-2.924 
               1.756-3.35 0a1.724 1.724 0 
               00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 
               1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 
               0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 
               2.37-2.37.996.608 2.296.07 
               2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>

     
    </div>
                    <p className="text-muted-foreground mt-6">Verifying access permissions...</p>
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