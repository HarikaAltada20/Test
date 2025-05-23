import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';

export const dynamic = 'force-dynamic';

interface InstagramTokenResponse {
  access_token: string;
  user_id: number; // This is the app-scoped user ID (IGSID)
}

interface InstagramMediaCountResponse {
  media_count: number;
}

interface InstagramUserProfile {
  id: string; // Actual global Instagram User ID
  username: string;
  account_type: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL';
  media_count?: number; // From a separate call if needed for basic user data
  name?: string; // Full name, if available and permitted
  profile_picture_url?: string; // if available and permitted
  followers_count?: number; // Requires Business/Creator account and advanced permissions
  follows_count?: number; // Requires Business/Creator account and advanced permissions
}


async function getInstagramUserDetails(accessToken: string, igUserId: string): Promise<InstagramUserProfile | null> {
  try {
    const fields = 'id,username,account_type,name,profile_picture_url';
    const userProfileUrl = `https://graph.instagram.com/${igUserId}?fields=${fields}&access_token=${accessToken}`;
    const profileResponse = await fetch(userProfileUrl);
    const profileData = await profileResponse.json();

    if (!profileResponse.ok || profileData.error) {
      console.error('Error fetching Instagram user profile:', profileData.error);
      throw new Error(profileData.error?.message || 'Failed to fetch Instagram user profile');
    }
    return profileData as InstagramUserProfile;
  } catch (error) {
    console.error('Exception in getInstagramUserDetails:', error);
    return null;
  }
}

async function getInstagramBusinessUserDetails(accessToken: string, igBusinessAccountId: string): Promise<InstagramUserProfile | null> {
    // For business accounts, we often get the IG User ID (associated with a Facebook Page)
    // and need to fetch details using that.
    // The required fields might differ or need more permissions.
    try {
        const fields = 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,account_type';
        // Note: The `igBusinessAccountId` might be the same as `igUserId` if it's a creator account not linked to a FB page
        // or it might be a distinct ID for a business account linked to a page.
        const userProfileUrl = `https://graph.facebook.com/v19.0/${igBusinessAccountId}?fields=instagram_business_account{${fields}}&access_token=${accessToken}`;
        
        const profileResponse = await fetch(userProfileUrl);
        const profileData = await profileResponse.json();

        if (!profileResponse.ok || profileData.error) {
            console.error('Error fetching Instagram Business user profile:', profileData.error);
            throw new Error(profileData.error?.message || 'Failed to fetch Instagram Business user profile');
        }
        // The data is nested under instagram_business_account
        return profileData.instagram_business_account ? profileData.instagram_business_account : profileData as InstagramUserProfile;

    } catch (error) {
        console.error('Exception in getInstagramBusinessUserDetails:', error);
        return null;
    }
}


export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = await createClient();
  let response: NextResponse;

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  const storedStateCookie = cookieStore.get('instagram_oauth_state');
  const storedState = storedStateCookie?.value;

  // Clear the state cookie regardless of success or failure
  if (storedStateCookie) {
    cookieStore.set({ name: 'instagram_oauth_state', value: '', maxAge: 0, path: '/' });
  }

  if (errorParam) {
    console.error('Instagram OAuth error:', errorDescription || errorParam);
    const errorUrl = new URL('/dashboard/settings', request.url);
    errorUrl.searchParams.set('error', 'instagram_connection_failed');
    errorUrl.searchParams.set('message', errorDescription || errorParam);
    return NextResponse.redirect(errorUrl);
  }

  if (!state || !storedState || state !== storedState) {
    console.error('State mismatch or missing state cookie for Instagram OAuth.');
    const errorUrl = new URL('/dashboard/settings?error=instagram_state_mismatch', request.url);
    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    console.error('No code found in Instagram callback.');
    const errorUrl = new URL('/dashboard/settings?error=instagram_no_code', request.url);
    return NextResponse.redirect(errorUrl);
  }

  try {
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !user) {
      console.error('Supabase session error or no user during Instagram callback:', sessionError);
      const errorUrl = new URL('/auth/signin?error=session_error_instagram_callback', request.url);
      return NextResponse.redirect(errorUrl);
    }

    console.log('Supabase session found during Instagram callback for user:', user.id);

    // Step 1: Exchange code for a short-lived access token
    // IMPORTANT: The redirect_uri here MUST EXACTLY MATCH the one used in the initial auth request.
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
    const redirectUri = `${appBaseUrl}/api/instagram/callback`;

    const tokenParams = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID!,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code,
    });

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error_message) {
      console.error('Error exchanging Instagram code for token:', tokenData.error_message || tokenData);
      throw new Error(tokenData.error_message || 'Failed to exchange Instagram code for token');
    }

    const shortLivedAccessToken = tokenData.access_token;
    const instagramAppScopedUserId = tokenData.user_id; // This is the IGSID

    // Step 2: Exchange short-lived token for a long-lived token
    const longLivedTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET!}&access_token=${shortLivedAccessToken}`;
    const longLivedTokenRes = await fetch(longLivedTokenUrl);
    const longLivedTokenData = await longLivedTokenRes.json();

    if (!longLivedTokenRes.ok || longLivedTokenData.error) {
      console.error('Error exchanging for long-lived Instagram token:', longLivedTokenData.error);
      throw new Error(longLivedTokenData.error?.message || 'Failed to get long-lived Instagram token');
    }
    
    const longLivedAccessToken = longLivedTokenData.access_token;
    const expiresInSeconds = longLivedTokenData.expires_in; // typically 60 days

    // Step 3: Get Instagram User Profile
    // We try fetching business details first, as it can provide richer info like followers.
    // The instagramAppScopedUserId from the token exchange might be the business account ID or a user ID.
    let userProfile = await getInstagramBusinessUserDetails(longLivedAccessToken, instagramAppScopedUserId.toString());
    
    // If business details fetch failed or didn't return a proper account_type (e.g. personal account connected)
    // fallback to basic user details. The ID from token exchange (instagramAppScopedUserId) is the key.
    if (!userProfile || !userProfile.account_type) {
        console.log('Falling back to basic Instagram user details for ID:', instagramAppScopedUserId.toString())
        userProfile = await getInstagramUserDetails(longLivedAccessToken, instagramAppScopedUserId.toString());
    }

    if (!userProfile) {
      console.error('Failed to fetch Instagram user profile after token exchange.');
      throw new Error('Failed to fetch Instagram user profile.');
    }
    
    // Ensure account type is suitable
    if (userProfile.account_type !== 'BUSINESS' && userProfile.account_type !== 'MEDIA_CREATOR') {
        console.warn(`User connected a ${userProfile.account_type} Instagram account. Reverting connection.`);
        const errorUrl = new URL('/dashboard/settings', request.url);
        errorUrl.searchParams.set('error', 'instagram_account_type_invalid');
        errorUrl.searchParams.set('message', `Please connect an Instagram Business or Creator account. You connected a ${userProfile.account_type} account.`);
        return NextResponse.redirect(errorUrl);
    }


    const tokenExpiry = dayjs().add(expiresInSeconds, 'seconds').toISOString();

    const instagramAccountData = {
      provider: 'instagram',
      instagram_user_id: userProfile.id, // Actual global IG User ID
      app_scoped_user_id: instagramAppScopedUserId.toString(),
      username: userProfile.username,
      name_of_account: userProfile.name || userProfile.username, // Use username as fallback for name
      profile_picture_url: userProfile.profile_picture_url,
      account_type: userProfile.account_type,
      access_token: longLivedAccessToken,
      token_expiry: tokenExpiry,
      // Optional fields, might not always be available or might need separate permissions/calls
      followers_count: userProfile.followers_count,
      follows_count: userProfile.follows_count,
      media_count: userProfile.media_count, // Often part of business account details
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('creator_profiles')
      .update({
        instagram_account: instagramAccountData,
        updated_at: new Date().toISOString(),
       })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating creator profile with Instagram data:', updateError);
      throw updateError;
    }

    console.log('Successfully connected Instagram account for user - :', user.id);
    const successUrl = new URL('/dashboard/settings?success=instagram_connected', request.url);
    response = NextResponse.redirect(successUrl);
    return response;

  } catch (error: any) {
    console.error('Full Instagram OAuth flow error:', error);
    const errorUrl = new URL('/dashboard/settings', request.url);
    errorUrl.searchParams.set('error', 'instagram_connection_failed');
    errorUrl.searchParams.set('message', error.message || 'An unknown error occurred during Instagram connection.');
    response = NextResponse.redirect(errorUrl);
    // Ensure cookie is cleared even in error paths within the try-catch
    // (already handled above, but good to be mindful)
    return response;
  }
} 