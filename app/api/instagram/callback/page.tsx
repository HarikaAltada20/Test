"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import dayjs from 'dayjs';

export default function InstagramCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>('Processing Instagram authentication...');

    useEffect(() => {
        const handleAuth = async () => {
            const code = searchParams.get('code');
            const errorParam = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');

            if (errorParam) {
                setError(`Instagram authentication failed: ${errorDescription || errorParam}`);
                setMessage(null);
                // Optionally redirect or show a button to go back
                router.push('/dashboard/settings?error=instagram_auth_failed');
                return;
            }

            if (!code) {
                setError('No authorization code found from Instagram.');
                setMessage(null);
                router.push('/dashboard/settings?error=instagram_no_code');
                return;
            }

            try {
                // 1. Exchange code for access token via our server-side route
                const clientSideRedirectUri = `${window.location.origin}/api/instagram/callback`;

                const tokenExchangeRes = await fetch('/api/instagram/exchange-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        code: code,
                        redirectUri: clientSideRedirectUri // Send the redirect_uri used by the client
                    }),
                });

                if (!tokenExchangeRes.ok) {
                    const errorData = await tokenExchangeRes.json();
                    throw new Error(`Failed to exchange code via server: ${errorData.error || tokenExchangeRes.statusText}`);
                }

                const { access_token: user_access_token, user_id: instagram_user_id_from_token_exchange } = await tokenExchangeRes.json();

                if (!user_access_token || !instagram_user_id_from_token_exchange) {
                    throw new Error('User Access token or Instagram User ID not received from server.');
                }

                // 2. Fetch user profile using the /me endpoint and the User Access Token
                const profileRes = await fetch(`https://graph.instagram.com/me?fields=id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count&access_token=${user_access_token}`);
                const profile = await profileRes.json(); // This profile contains app_scoped_user_id as 'id' and the global instagram_user_id as 'user_id'

                if (!profileRes.ok || profile.error) {
                    throw new Error(`Failed to fetch Instagram User profile (/me): ${profile.error?.message || profileRes.statusText}`);
                }

                // The 'id' field from /me is the app-scoped ID. The 'user_id' field is the global Instagram User ID.
                // Let's ensure we store the global IG User ID for consistency if available, otherwise the one from token exchange.
                const globalInstagramUserID = profile.user_id || instagram_user_id_from_token_exchange;

                // 3. Get Supabase user
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    throw new Error('User not authenticated in Supabase.');
                }

                // 4. Store in Supabase (`creator_profiles.instagram_account`)
                const instagramAccountData = {
                    access_token: user_access_token,
                    instagram_user_id: globalInstagramUserID, // Store the global Instagram User ID
                    username: profile.username,
                    profile_picture_url: profile.profile_picture_url,
                    followers_count: profile.followers_count,
                    follows_count: profile.follows_count,
                    media_count: profile.media_count,
                    account_type: profile.account_type, // Store account type
                    token_expiry: dayjs().add(59, 'days').toISOString(),
                    name_of_account: profile.name, // User's name or business name if applicable from /me
                    app_scoped_user_id: profile.id, // Store the app-scoped ID as well, might be useful
                    updated_at: new Date().toISOString(),
                };

                const { error: updateError } = await supabase
                    .from('creator_profiles')
                    .update({
                        instagram_account: instagramAccountData as any, // Cast to any to match Json type, consider defining a stricter type for instagram_account
                    })
                    .eq('id', user.id);

                if (updateError) {
                    console.error('Supabase update error:', updateError);
                    throw new Error(`Failed to update creator profile: ${updateError.message}`);
                }

                setMessage('Instagram account connected successfully! Redirecting...');
                router.push('/dashboard/settings?success=instagram_connected');

            } catch (err: any) {
                console.error('Instagram auth error:', err);
                setError(`Error during Instagram authentication: ${err.message}`);
                setMessage(null);
                // Optionally redirect with a more specific error
                // router.push(`/dashboard/settings?error=instagram_failed&message=${encodeURIComponent(err.message)}`);
            }
        };

        handleAuth();
    }, [searchParams, router, supabase]);

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