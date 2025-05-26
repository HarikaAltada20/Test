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

        const performAuthCheck = async () => {
            if (!isMounted) return;
            setIsLoading(true);

            const authResult = await checkClientAuth();

            if (!isMounted) return;

            setUser(authResult.user);
            setIsAuthenticated(authResult.isAuthenticated);
            setError(authResult.error);

            if (options.redirectTo) {
                if (!authResult.isAuthenticated) {
                    console.log(`useClientAuth: Not authenticated or error (${authResult.error?.message}). Redirecting to ${options.redirectTo}`);
                    router.push(options.redirectTo);
                    setIsLoading(false);
                    return;
                }

                if (authResult.isAuthenticated && options.requiredUserType) {
                    const userType = authResult.user?.user_metadata?.user_type;
                    if (userType !== options.requiredUserType) {
                        console.log(`useClientAuth: User type mismatch. Redirecting to ${options.redirectTo}`);
                        router.push(options.redirectTo);
                        setIsLoading(false);
                        return;
                    }
                }
            }
            setIsLoading(false);
        };

        performAuthCheck();

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.redirectTo, options.requiredUserType]);

    const logout = async () => {
        try {
            await completeLogout();
            setUser(null);
            setIsAuthenticated(false);
            setError(null);
        } catch (err) {
            console.error("Error during logout in useClientAuth:", err);
            if (typeof window !== 'undefined') {
                window.location.href = '/auth/signin';
            }
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