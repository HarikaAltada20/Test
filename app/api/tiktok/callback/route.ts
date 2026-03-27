import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import dayjs from 'dayjs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    const baseRedirectUrl = new URL('/dashboard/settings', request.url);

    if (errorParam) {
        console.error(`TikTok authentication failed: ${errorDescription || errorParam}`);
        baseRedirectUrl.searchParams.set('error', 'tiktok_auth_failed');
        baseRedirectUrl.searchParams.set('message', errorDescription || errorParam);
        return NextResponse.redirect(baseRedirectUrl);
    }

    if (!code) {
        console.error('No authorization code found from TikTok.');
        baseRedirectUrl.searchParams.set('error', 'tiktok_no_code');
        return NextResponse.redirect(baseRedirectUrl);
    }

    // Extract code_verifier from state
    let codeVerifier = null;
    if (state) {
        try {
            const stateData = JSON.parse(decodeURIComponent(state));
            codeVerifier = stateData.code_verifier;
        } catch (err) {
            console.error('Failed to parse state parameter:', err);
        }
    }

    if (!codeVerifier) {
        console.error('No code verifier found in state.');
        baseRedirectUrl.searchParams.set('error', 'tiktok_no_code_verifier');
        baseRedirectUrl.searchParams.set('message', 'PKCE verification failed. Please try again.');
        return NextResponse.redirect(baseRedirectUrl);
    }

    const supabase = await createClient();

    try {
        // Debug logging
        console.log('TikTok callback received');
        console.log('Code:', code ? 'Present' : 'Missing');
        console.log('State:', state ? 'Present' : 'Missing');
        console.log('Code Verifier:', codeVerifier ? 'Present' : 'Missing');
        
        // 1. Get Supabase user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error('Supabase user not authenticated during TikTok callback:', userError?.message);
            baseRedirectUrl.searchParams.set('error', 'supabase_user_not_found');
            baseRedirectUrl.searchParams.set('message', 'User session not found. Please sign in again.');
            return NextResponse.redirect(new URL('/auth/signin?error=tiktok_callback_no_user', request.url));
        }

        // 2. Exchange code for access token
        const clientId = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_ID;
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
        const serverSideRedirectUri = `${new URL(request.url).origin}/api/tiktok/callback`;

        if (!clientId || !clientSecret) {
            console.error('TikTok client ID or secret is not configured.');
            throw new Error('Server configuration error: TikTok app credentials missing.');
        }

        const tokenExchangeRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_key: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                redirect_uri: serverSideRedirectUri,
                code: code,
                code_verifier: codeVerifier, // Add PKCE code verifier
            }),
        });

        const tokenData = await tokenExchangeRes.json();

        if (!tokenExchangeRes.ok || tokenData.error) {
            console.error('Failed to exchange TikTok code for token:', tokenData);
            throw new Error(tokenData.error_description || `Failed to exchange code for token. Status: ${tokenExchangeRes.status}`);
        }

        const { access_token, refresh_token, expires_in, scope, refresh_expires_in } = tokenData;

        if (!access_token) {
            throw new Error('Access token not received from TikTok.');
        }

        const actualTokenExpiry = dayjs().add(expires_in, 'seconds').toISOString();
        const refreshExpiry = dayjs().add(refresh_expires_in, 'seconds').toISOString();

        // 3. Fetch user profile using the access token
        const profileRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,bio,follower_count,following_count,likes_count,video_count', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`,
            },
        });

        const profileData = await profileRes.json();

        if (!profileRes.ok || profileData.error) {
            console.error('Failed to fetch TikTok user profile:', profileData.error);
            throw new Error(`Failed to fetch TikTok user profile: ${profileData.error?.message || profileRes.statusText}`);
        }

        const userProfile = profileData.data.user;

        // 4. Store in Supabase (`creator_profiles.tiktok_account`)
        const tiktokAccountData = {
            provider: "tiktok",
            access_token: access_token,
            refresh_token: refresh_token,
            token_expiry: actualTokenExpiry,
            refresh_token_expiry: refreshExpiry,
            username: userProfile.display_name,
            profile_picture_url: userProfile.avatar_url,
            followers_count: userProfile.follower_count,
            follows_count: userProfile.following_count,
            likes_count: userProfile.likes_count,
            video_count: userProfile.video_count,
            bio: userProfile.bio,
            tiktok_user_id: userProfile.open_id,
            union_id: userProfile.union_id,
            updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
            .from('creator_profiles')
            .update({
                tiktok_account: tiktokAccountData as any,
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('Supabase update error for TikTok account:', updateError);
            throw new Error(`Failed to update creator profile with TikTok data: ${updateError.message}`);
        }

        console.log('TikTok account connected successfully for user:', user.id);
        baseRedirectUrl.searchParams.set('success', 'tiktok_connected');
        return NextResponse.redirect(baseRedirectUrl);

    } catch (err: any) {
        console.error('Error during TikTok server-side callback processing:', err);
        baseRedirectUrl.searchParams.set('error', 'tiktok_processing_failed');
        baseRedirectUrl.searchParams.set('message', err.message || 'An unexpected error occurred.');
        return NextResponse.redirect(baseRedirectUrl);
    }
}
