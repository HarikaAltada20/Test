"use client";

import { useState, useEffect } from "react";
import { checkClientAuth, completeLogout } from "@/lib/auth-utils";
import { useRouter } from "next/navigation";

interface ClientAuthOptions {
    redirectTo?: string;
    requiredUserType?: "advertiser" | "creator";
}

export function useClientAuth(options: ClientAuthOptions = {}) {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
                setIsLoading(true);
                const { isAuthenticated, user, error } = await checkClientAuth();

                if (!isMounted) return;

                if (error) {
                    setError(error);
                    setIsAuthenticated(false);
                    setUser(null);

                    if (options.redirectTo) {
                        router.push(options.redirectTo);
                    }
                    return;
                }

                setIsAuthenticated(isAuthenticated);
                setUser(user);

                // Handle redirect if not authenticated
                if (!isAuthenticated && options.redirectTo) {
                    router.push(options.redirectTo);
                    return;
                }

                // Check for required user type
                if (isAuthenticated && options.requiredUserType) {
                    const userType = user?.user_metadata?.user_type;

                    if (userType !== options.requiredUserType) {
                        // Unauthorized for this user type, redirect if needed
                        if (options.redirectTo) {
                            router.push(options.redirectTo);
                        }
                    }
                }
            } catch (err) {
                if (!isMounted) return;
                setError(err);
                setIsAuthenticated(false);
                setUser(null);

                if (options.redirectTo) {
                    router.push(options.redirectTo);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        checkAuth();

        return () => {
            isMounted = false;
        };
    }, [options.redirectTo, options.requiredUserType, router]);

    const logout = async () => {
        try {
            await completeLogout();
            // The completeLogout function handles the redirect
        } catch (err) {
            console.error("Error during logout:", err);
            // Force a hard redirect as a fallback
            window.location.href = '/auth/signin';
        }
    };

    return {
        user,
        isLoading,
        isAuthenticated,
        error,
        logout
    };
} 