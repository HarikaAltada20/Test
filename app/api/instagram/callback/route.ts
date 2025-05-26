import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // Ensure this points to server client
import dayjs from 'dayjs';

export const dynamic = 'force-dynamic'; // Ensures the route is not statically cached

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    const baseRedirectUrl = new URL('/dashboard/settings', request.url);

    if (errorParam) {
        console.error(`Instagram authentication failed: ${errorDescription || errorParam}`);
        baseRedirectUrl.searchParams.set('error', 'instagram_auth_failed');
        baseRedirectUrl.searchParams.set('message', errorDescription || errorParam);
        return NextResponse.redirect(baseRedirectUrl);
    }

    if (!code) {
        console.error('No authorization code found from Instagram.');
        baseRedirectUrl.searchParams.set('error', 'instagram_no_code');
        return NextResponse.redirect(baseRedirectUrl);
    }

    const supabase = await createClient(); // Uses server-side client

    try {
        // 1. Get Supabase user (critical step, server-side)
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error('Supabase user not authenticated during Instagram callback:', userError?.message);
            baseRedirectUrl.searchParams.set('error', 'supabase_user_not_found');
            baseRedirectUrl.searchParams.set('message', 'User session not found. Please sign in again.');
            // It might be better to redirect to sign-in if no user
            return NextResponse.redirect(new URL('/auth/signin?error=instagram_callback_no_user', request.url));
        }

        // 2. Exchange code for access token
        const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
        const clientSecret = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_SECRET;
        // The redirect_uri for the token exchange must exactly match the one configured in the Instagram App settings
        // and used in the initial authorization request.
        const serverSideRedirectUri = `${new URL(request.url).origin}/api/instagram/callback`;


        if (!clientId || !clientSecret) {
            console.error('Instagram client ID or secret is not configured.');
            throw new Error('Server configuration error: Instagram app credentials missing.');
        }

        const form = new URLSearchParams();
        form.append('client_id', clientId);
        form.append('client_secret', clientSecret);
        form.append('grant_type', 'authorization_code');
        form.append('redirect_uri', serverSideRedirectUri);
        form.append('code', code);

        const tokenExchangeRes = await fetch('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            body: form,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const tokenData = await tokenExchangeRes.json();

        if (!tokenExchangeRes.ok || tokenData.error_message) {
            console.error('Failed to exchange Instagram code for token:', tokenData);
            throw new Error(tokenData.error_message || `Failed to exchange code for token. Status: ${tokenExchangeRes.status}`);
        }

        const { access_token: user_access_token, user_id: instagram_user_id_from_token_exchange } = tokenData;

        if (!user_access_token || !instagram_user_id_from_token_exchange) {
            throw new Error('User Access token or Instagram User ID not received from Instagram token exchange.');
        }

        // 3. Fetch user profile using the User Access Token
        const profileRes = await fetch(`https://graph.instagram.com/me?fields=id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count&access_token=${user_access_token}`);
        const profile = await profileRes.json();

        if (!profileRes.ok || profile.error) {
            console.error('Failed to fetch Instagram User profile (/me):', profile.error);
            throw new Error(`Failed to fetch Instagram User profile (/me): ${profile.error?.message || profileRes.statusText}`);
        }
        
        const globalInstagramUserID = profile.user_id || instagram_user_id_from_token_exchange;

        // 4. Store in Supabase (`creator_profiles.instagram_account`)
        const instagramAccountData = {
            access_token: user_access_token,
            instagram_user_id: globalInstagramUserID,
            username: profile.username,
            profile_picture_url: profile.profile_picture_url,
            followers_count: profile.followers_count,
            follows_count: profile.follows_count,
            media_count: profile.media_count,
            account_type: profile.account_type,
            token_expiry: dayjs().add(59, 'days').toISOString(), // Instagram long-lived tokens last 60 days, refresh before.
            name_of_account: profile.name,
            app_scoped_user_id: profile.id,
            updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
            .from('creator_profiles')
            .update({
                instagram_account: instagramAccountData as any, // Consider defining a stricter type
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('Supabase update error for Instagram account:', updateError);
            throw new Error(`Failed to update creator profile with Instagram data: ${updateError.message}`);
        }

        console.log('Instagram account connected successfully for user:', user.id);
        baseRedirectUrl.searchParams.set('success', 'instagram_connected');
        return NextResponse.redirect(baseRedirectUrl);

    } catch (err: any) {
        console.error('Error during Instagram server-side callback processing:', err);
        baseRedirectUrl.searchParams.set('error', 'instagram_processing_failed');
        baseRedirectUrl.searchParams.set('message', err.message || 'An unexpected error occurred.');
        return NextResponse.redirect(baseRedirectUrl);
    }
} 