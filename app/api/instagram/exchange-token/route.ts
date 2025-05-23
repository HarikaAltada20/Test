import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers'; // Though not directly used for state here, it initializes the context for Supabase server client
import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';

interface InstagramTokenResponse {
  access_token: string;
  user_id: number; // This is the app-scoped user ID (IGSID)
}

interface InstagramUserProfile {
  id: string; // Actual global Instagram User ID
  username: string;
  account_type: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL';
  media_count?: number;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  instagram_business_account?: { id: string };
}

async function getInstagramMeProfile(accessToken: string): Promise<InstagramUserProfile | null> {
  try {
    const fields = 'id,username,account_type,media_count,name,profile_picture_url,instagram_business_account';
    const userProfileUrl = `https://graph.instagram.com/me?fields=${fields}&access_token=${accessToken}`;
    const profileResponse = await fetch(userProfileUrl);
    const profileData = await profileResponse.json();
    if (!profileResponse.ok || profileData.error) {
      console.error('Error fetching Instagram user profile via /me:', profileData.error);
      throw new Error(profileData.error?.message || 'Failed to fetch Instagram user profile via /me');
    }
    return profileData as InstagramUserProfile;
  } catch (error) {
    console.error('Exception in getInstagramMeProfile:', error);
    return null;
  }
}

async function getInstagramBusinessUserDetails(accessToken: string, igBusinessAccountId: string): Promise<InstagramUserProfile | null> {
    try {
        const fields = 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,account_type';
        const userProfileUrl = `https://graph.facebook.com/v19.0/${igBusinessAccountId}?fields=instagram_business_account{${fields}}&access_token=${accessToken}`;
        const profileResponse = await fetch(userProfileUrl);
        const profileData = await profileResponse.json();
        if (!profileResponse.ok || profileData.error) {
            console.error('Error fetching Instagram Business user profile:', profileData.error);
            throw new Error(profileData.error?.message || 'Failed to fetch Instagram Business user profile');
        }
        return profileData.instagram_business_account ? profileData.instagram_business_account : profileData as InstagramUserProfile;
    } catch (error) {
        console.error('Exception in getInstagramBusinessUserDetails:', error);
        return null;
    }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state, redirectUri: clientCallbackUri } = body;

    // Optional: Re-validate state if desired, though primary validation is client-side for this pattern.
    // This route is protected by Supabase auth below.

    if (!code) {
      return NextResponse.json({ error: 'No code provided for token exchange.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !user) {
      console.error('Supabase session error or no user in /exchange-token:', sessionError);
      return NextResponse.json({ error: 'User not authenticated in Supabase.' }, { status: 401 });
    }
    console.log('Supabase session found in /exchange-token for user:', user.id);

    // Step 1: Exchange code for a short-lived access token
    // IMPORTANT: The redirect_uri here MUST EXACTLY MATCH the one used in the initial auth request to Instagram (/api/instagram/callback page)
    // and registered in your Instagram app settings.
    const appRegisteredRedirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`;

    const tokenParams = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID!,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: appRegisteredRedirectUri, // Use the redirect URI registered in IG app settings
      code: code,
    });

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error_message) {
      console.error('Error exchanging Instagram code for token in /exchange-token:', tokenData.error_message || tokenData);
      throw new Error(tokenData.error_message || 'Failed to exchange Instagram code for token');
    }

    const shortLivedAccessToken = tokenData.access_token;
    // const instagramAppScopedUserId = tokenData.user_id; // This is the IGSID, available if needed

    // Step 2: Exchange short-lived token for a long-lived token
    const longLivedTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET!}&access_token=${shortLivedAccessToken}`;
    const longLivedTokenRes = await fetch(longLivedTokenUrl);
    const longLivedTokenData = await longLivedTokenRes.json();

    if (!longLivedTokenRes.ok || longLivedTokenData.error) {
      console.error('Error exchanging for long-lived Instagram token in /exchange-token:', longLivedTokenData.error);
      throw new Error(longLivedTokenData.error?.message || 'Failed to get long-lived Instagram token');
    }
    
    const longLivedAccessToken = longLivedTokenData.access_token;
    const expiresInSeconds = longLivedTokenData.expires_in;

    // Step 3: Get Instagram User Profile
    let userProfile = await getInstagramMeProfile(longLivedAccessToken);
    let appScopedUserIdToStore = tokenData.user_id?.toString(); // IGSID from token exchange

    if (!userProfile) {
      console.error('Failed to fetch Instagram /me profile in /exchange-token.');
      throw new Error('Failed to fetch Instagram user profile using /me.');
    }
    
    // If /me was successful, userProfile.id is the global IG User ID.
    // If it has an instagram_business_account.id, try to get enhanced details.
    if (userProfile.instagram_business_account?.id) {
        console.log('Fetched /me profile, attempting enhanced business details for ID:', userProfile.instagram_business_account.id);
        const businessDetails = await getInstagramBusinessUserDetails(longLivedAccessToken, userProfile.instagram_business_account.id);
        if (businessDetails) userProfile = { ...userProfile, ...businessDetails };
        else console.warn('Failed to fetch enhanced business details for business account.');
    } else if (userProfile.account_type === 'BUSINESS' || userProfile.account_type === 'MEDIA_CREATOR') {
        console.log(`Fetched /me profile (${userProfile.account_type}), attempting enhanced business details using user's own global ID: ${userProfile.id}`);
        const businessDetails = await getInstagramBusinessUserDetails(longLivedAccessToken, userProfile.id);
        if (businessDetails) userProfile = { ...userProfile, ...businessDetails };
    }

    if (userProfile.account_type !== 'BUSINESS' && userProfile.account_type !== 'MEDIA_CREATOR') {
        console.warn(`User connected a ${userProfile.account_type} Instagram account. This is not supported.`);
        return NextResponse.json({
            error: `Please connect an Instagram Business or Creator account. You connected a ${userProfile.account_type} account.`
        }, { status: 400 });
    }

    const tokenExpiry = dayjs().add(expiresInSeconds, 'seconds').toISOString();
    const instagramAccountData = {
      provider: 'instagram',
      instagram_user_id: userProfile.id, // Global IG User ID from /me
      app_scoped_user_id: appScopedUserIdToStore,
      username: userProfile.username,
      name_of_account: userProfile.name || userProfile.username,
      profile_picture_url: userProfile.profile_picture_url,
      account_type: userProfile.account_type,
      access_token: longLivedAccessToken,
      token_expiry: tokenExpiry,
      followers_count: userProfile.followers_count,
      follows_count: userProfile.follows_count,
      media_count: userProfile.media_count,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('creator_profiles')
      .update({ instagram_account: instagramAccountData, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating creator profile in /exchange-token:', updateError);
      throw updateError;
    }

    console.log('Successfully connected Instagram & updated profile in /exchange-token for user:', user.id);
    return NextResponse.json({ success: true, message: 'Instagram account connected successfully.' });

  } catch (error: any) {
    console.error('Full error in /api/instagram/exchange-token:', error);
    return NextResponse.json(
        { error: error.message || 'An unknown error occurred during Instagram token exchange.' }, 
        { status: 500 }
    );
  }
} 