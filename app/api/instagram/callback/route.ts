import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server'; // Ensure this points to server client
import dayjs from 'dayjs';
import {
    buildPostOAuthRedirectUrl,
    clearOAuthReturnToCookie,
    readOAuthReturnToCookie,
} from '@/lib/oauth-return-to';
import {
    computeSinceUntilForPreset,
    fetchUserAccountInsights,
} from '@/lib/instagram-account-insights';
import {
    mergeInstagramAnalyticsEntry,
    type InstagramAnalyticsEntry,
} from '@/lib/platform-social-archive';
import { duplicateSocialAccountLinkedMessage } from '@/lib/duplicate-social-account-message';

export const dynamic = 'force-dynamic'; // Ensures the route is not statically cached

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    // Doc: "#_" appended to redirect URI is not part of the code; searchParams excludes fragment, but strip defensively
    const rawCode = searchParams.get('code');
    const code = rawCode ? rawCode.replace(/#_.*$/, '').trim() : null;
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    const origin = new URL(request.url).origin;
    const cookieStore = await cookies();
    const oauthReturnTo = readOAuthReturnToCookie(cookieStore);

    const redirectAfterOAuth = (params: {
        success?: string;
        error?: string;
        message?: string;
    }) => {
        const response = NextResponse.redirect(
            buildPostOAuthRedirectUrl(origin, oauthReturnTo, params),
        );
        clearOAuthReturnToCookie(response);
        return response;
    };

    if (errorParam) {
        console.error(`Instagram authentication failed: ${errorDescription || errorParam}`);
        return redirectAfterOAuth({
            error: 'instagram_auth_failed',
            message: errorDescription || errorParam,
        });
    }

    if (!code) {
        console.error('No authorization code found from Instagram.');
        return redirectAfterOAuth({ error: 'instagram_no_code' });
    }

    const supabase = await createClient(); // Uses server-side client

    try {
        // 1. Get Supabase user (critical step, server-side)
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error('Supabase user not authenticated during Instagram callback:', userError?.message);
            // It might be better to redirect to sign-in if no user
            return NextResponse.redirect(new URL('/auth/signin?error=instagram_callback_no_user', request.url));
        }

        // 2. Exchange code for access token
        const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
        const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
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

        // Official Business login docs: success is { data: [ { access_token, user_id, permissions } ] }
        const payload = Array.isArray(tokenData.data) && tokenData.data[0]
            ? tokenData.data[0]
            : tokenData;
        const short_lived_user_access_token = payload.access_token;
        const instagram_user_id_from_token_exchange = payload.user_id;

        if (!short_lived_user_access_token || !instagram_user_id_from_token_exchange) {
            throw new Error('Short-lived User Access token or Instagram User ID not received from Instagram token exchange.');
        }

        // 2.1 Exchange short-lived token for a long-lived token
        const longLivedTokenRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${short_lived_user_access_token}`);
        const longLivedTokenData = await longLivedTokenRes.json();

        if (!longLivedTokenRes.ok || longLivedTokenData.error) {
            console.error('Failed to exchange short-lived token for long-lived token:', longLivedTokenData.error);
            // It's possible the short-lived token is still usable for a short period, 
            // but ideally, we want the long-lived one. Handle this based on requirements.
            // For now, let's throw an error if we can't get the long-lived token.
            throw new Error(longLivedTokenData.error?.message || `Failed to get long-lived token. Status: ${longLivedTokenRes.status}`);
        }

        const { access_token: long_lived_access_token, expires_in: long_lived_expires_in } = longLivedTokenData;

        if (!long_lived_access_token) {
            throw new Error('Long-lived access token not received from Instagram.');
        }
        
        const actualTokenExpiry = dayjs().add(long_lived_expires_in, 'seconds').toISOString();

        // 3. Fetch user profile using the LONG-LIVED User Access Token
        const profileRes = await fetch(`https://graph.instagram.com/me?fields=id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count&access_token=${long_lived_access_token}`);
        const profile = await profileRes.json();

        if (!profileRes.ok || profile.error) {
            console.error('Failed to fetch Instagram User profile (/me):', profile.error);
            throw new Error(`Failed to fetch Instagram User profile (/me): ${profile.error?.message || profileRes.statusText}`);
        }
        
        const globalInstagramUserID = profile.user_id || instagram_user_id_from_token_exchange;

        // --- REFINED: Check for duplicate connection within the switcher group ---
        const { data: vaultLinks } = await supabase
            .from('user_sessions_vault')
            .select('target_user_id')
            .eq('owner_user_id', user.id);

        const linkedAccountIds = vaultLinks?.map(link => link.target_user_id) || [];

        const { data: duplicateAccount, error: duplicateCheckError } = await supabase
            .from('creator_profiles')
            .select('id')
            .eq('instagram_account->>instagram_user_id', globalInstagramUserID)
            .neq('id', user.id)
            .maybeSingle();

        if (duplicateCheckError) {
            console.error('Error checking for duplicate Instagram account:', duplicateCheckError);
            throw new Error(`Failed to verify account uniqueness: ${duplicateCheckError.message}`);
        }

        if (duplicateAccount && linkedAccountIds.includes(duplicateAccount.id)) {
            console.warn(`Instagram account ${globalInstagramUserID} is already linked to user ${duplicateAccount.id} in the same switcher group`);
            // Log the blocked attempt
            try {
                const adminSupabase = (await import('@/utils/supabase/admin')).createAdminClient();
                await adminSupabase.rpc("log_action", { 
                    p_action: "social_link_blocked", 
                    p_metadata: { 
                        platform: 'instagram',
                        platform_user_id: globalInstagramUserID,
                        existing_owner_id: duplicateAccount.id,
                        reason: 'duplicate_within_switcher_group'
                    },
                    p_user_id: user.id
                });
            } catch (logErr) {
                console.warn('Failed to log blocked connection attempt:', logErr);
            }

            return redirectAfterOAuth({
                error: 'duplicate_account',
                message: await duplicateSocialAccountLinkedMessage(duplicateAccount.id, 'Instagram'),
            });
        }
        // --- END REFINED ---

        // 4. Store in Supabase (`creator_profiles.instagram_account`)
        const instagramAccountData = {
            access_token: long_lived_access_token, // Use long-lived token
            instagram_user_id: globalInstagramUserID,
            username: profile.username,
            profile_picture_url: profile.profile_picture_url,
            followers_count: profile.followers_count,
            follows_count: profile.follows_count,
            media_count: profile.media_count,
            account_type: profile.account_type,
            token_expiry: actualTokenExpiry, // Use actual expiry from long-lived token
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

        // Optional: seed "overall" account insights into instagram_archive (non-blocking)
        try {
            const { data: row } = await supabase
                .from('creator_profiles')
                .select('instagram_archive')
                .eq('id', user.id)
                .single();
            const nowSec = Math.floor(Date.now() / 1000);
            const { since, until, entryKey } = computeSinceUntilForPreset('overall', nowSec);
            const insights = await fetchUserAccountInsights(
                profile.id as string,
                long_lived_access_token,
                since,
                until
            );
            let entry: InstagramAnalyticsEntry;
            if (insights.kind === 'success') {
                entry = {
                    fetched_at: new Date().toISOString(),
                    since,
                    until,
                    preset: 'overall',
                    metrics: insights.metrics,
                };
            } else {
                entry = {
                    fetched_at: new Date().toISOString(),
                    since,
                    until,
                    preset: 'overall',
                    metrics: {},
                    error: insights.message || 'Insights unavailable',
                };
            }
            const merged = mergeInstagramAnalyticsEntry(row?.instagram_archive, entryKey, entry);
            const { error: archiveUpdateErr } = await supabase
                .from('creator_profiles')
                .update({ instagram_archive: merged as Record<string, unknown> })
                .eq('id', user.id);
            if (archiveUpdateErr) {
                console.warn('[instagram/callback] Optional analytics seed archive update failed:', archiveUpdateErr);
            }
        } catch (seedErr) {
            console.warn('[instagram/callback] Optional analytics seed skipped:', seedErr);
        }

        console.log('Instagram account connected successfully for user:', user.id);
        return redirectAfterOAuth({ success: 'instagram_connected' });

    } catch (err: any) {
        console.error('Error during Instagram server-side callback processing:', err);
        return redirectAfterOAuth({
            error: 'instagram_processing_failed',
            message: err.message || 'An unexpected error occurred.',
        });
    }
} 