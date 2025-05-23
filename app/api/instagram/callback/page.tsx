"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// No longer need client-side Supabase or dayjs here

export default function InstagramCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>('Processing Instagram authentication...');

    useEffect(() => {
        const handleAuth = async () => {
            const code = searchParams.get('code');
            const errorParam = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');

            if (errorParam) {
                const fullError = `Instagram authentication failed: ${errorDescription || errorParam}`;
                setError(fullError);
                setMessage(null);
                router.push(`/dashboard/settings?error=${encodeURIComponent(fullError)}`);
                return;
            }

            if (!code) {
                const noCodeError = 'No authorization code found from Instagram.';
                setError(noCodeError);
                setMessage(null);
                router.push(`/dashboard/settings?error=${encodeURIComponent(noCodeError)}`);
                return;
            }

            try {
                const clientSideRedirectUri = `${window.location.origin}/api/instagram/callback`;

                const response = await fetch('/api/instagram/exchange-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        code: code,
                        redirectUri: clientSideRedirectUri
                    }),
                });

                const data = await response.json();

                if (!response.ok || data.error) {
                    throw new Error(data.error || `Server responded with status ${response.status}`);
                }

                // Server now handles everything, so if we get here, it's a success.
                setMessage('Instagram account connected successfully! Redirecting...');
                router.push('/dashboard/settings?success=instagram_connected');

            } catch (err: any) {
                console.error('Error during Instagram authentication processing:', err);
                const authProcessingError = `Error processing Instagram authentication: ${err.message}`;
                setError(authProcessingError);
                setMessage(null);
                router.push(`/dashboard/settings?error=${encodeURIComponent(authProcessingError)}`);
            }
        };

        handleAuth();
    }, [searchParams, router]); // Removed supabase from dependencies

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px', textAlign: 'center' }}>
            {message && <p>{message}</p>}
            {error && (
                <div style={{ color: 'red', marginTop: '20px' }}>
                    <p>Error: {error}</p>
                    <button
                        onClick={() => router.push('/dashboard/settings')}
                        style={{ marginTop: '10px', padding: '10px 20px', cursor: 'pointer' }}
                    >
                        Go to Settings
                    </button>
                </div>
            )}
            {!message && !error && <p>Loading...</p>}
        </div>
    );
} 