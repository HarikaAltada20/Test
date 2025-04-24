"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { UsernameSetupModal } from "@/components/username-setup-modal"

export function withUsernameCheck<P extends object>(
    Component: React.ComponentType<P>
) {
    return function WithUsernameCheck(props: P) {
        const { user, isLoading, needsUsername } = useAuth()
        const [hasError, setHasError] = useState(false)

        // Handle errors during auth checking
        useEffect(() => {
            // Reset error state when auth state changes
            if (!isLoading) {
                setHasError(false)
            }

            // Add global error handler for Supabase API errors
            const handleFetchError = (event: ErrorEvent) => {
                // Only handle Supabase API errors
                if (event.message.includes('supabase') ||
                    (event.error && event.error.stack && event.error.stack.includes('supabase'))) {
                    console.warn('Caught Supabase API error during hot reload, will retry when stable')
                    setHasError(true)
                    // Prevent the error from bubbling up to the console
                    event.preventDefault()
                }
            }

            window.addEventListener('error', handleFetchError)
            return () => window.removeEventListener('error', handleFetchError)
        }, [isLoading])

        // Only show username setup if user is logged in, not loading, and needs username
        // Also make sure we're not in an error state from a hot reload
        const showUsernameSetup = user && !isLoading && needsUsername && !hasError

        return (
            <>
                {showUsernameSetup && <UsernameSetupModal />}
                <Component {...props} />
            </>
        )
    }
} 