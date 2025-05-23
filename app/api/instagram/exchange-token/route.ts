import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';

interface InstagramTokenResponse {
  access_token: string;
  user_id: number; // This is the app-scoped user ID (IGSID) from token exchange
}

// Simplified interface based on user's /me sample response fields
interface InstagramUserProfile {
  id: string; // Standard global ID from Instagram Graph API /me endpoint
  user_id?: string; // User-provided field from their /me sample, capture if present
  username: string;
  name?: string;
  account_type: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL';
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

async function getInstagramMeProfile(accessToken: string): Promise<InstagramUserProfile | null> {
  try {
    // Fields as per user's sample response for /me, ensuring 'id' is primary.
    const fields = 'id,user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count';
    const userProfileUrl = `https://graph.instagram.com/me?fields=${fields}&access_token=${accessToken}`;
    const profileResponse = await fetch(userProfileUrl);
    const profileData = await profileResponse.json();

    if (!profileResponse.ok || profileData.error) {
      console.error('Error fetching Instagram user profile via /me:', profileData.error);
      let errorMessage = 'Failed to fetch Instagram user profile via /me';
      if (profileData.error && profileData.error.message) {
        errorMessage += `: ${profileData.error.message} (Code: ${profileData.error.code}, Type: ${profileData.error.type})`;
      }
      throw new Error(errorMessage);
    }
    return profileData as InstagramUserProfile;
  } catch (error) {
    console.error('Exception in getInstagramMeProfile:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body; // State and clientCallbackUri are not strictly needed by this simplified backend endpoint

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

    const appRegisteredRedirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`;

    const tokenParams = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID!,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: appRegisteredRedirectUri,
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
    const appScopedUserIdToStore = tokenData.user_id?.toString(); // IGSID from token exchange, store this.

    const longLivedTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET!}&access_token=${shortLivedAccessToken}`;
    const longLivedTokenRes = await fetch(longLivedTokenUrl);
    const longLivedTokenData = await longLivedTokenRes.json();

    if (!longLivedTokenRes.ok || longLivedTokenData.error) {
      console.error('Error exchanging for long-lived Instagram token in /exchange-token:', longLivedTokenData.error);
      throw new Error(longLivedTokenData.error?.message || 'Failed to get long-lived Instagram token');
    }
    
    const longLivedAccessToken = longLivedTokenData.access_token;
    const expiresInSeconds = longLivedTokenData.expires_in;

    // Step 3: Get Instagram User Profile using only /me
    const userProfile = await getInstagramMeProfile(longLivedAccessToken);

    if (!userProfile || !userProfile.id) { // Ensure we have the profile and the main 'id' field
      console.error('Failed to fetch Instagram /me profile or ID missing in /exchange-token.');
      throw new Error('Failed to fetch Instagram user profile or main user ID from /me.');
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
      instagram_user_id: userProfile.id, // Using userProfile.id as the global, unique IG user ID
      app_scoped_user_id: appScopedUserIdToStore, // Storing the IGSID from token exchange
      username: userProfile.username,
      name_of_account: userProfile.name || userProfile.username,
      profile_picture_url: userProfile.profile_picture_url,
      account_type: userProfile.account_type,
      access_token: longLivedAccessToken,
      token_expiry: tokenExpiry,
      followers_count: userProfile.followers_count,
      follows_count: userProfile.follows_count,
      media_count: userProfile.media_count,
      user_id_debug: userProfile.user_id, // Storing the user_id field from /me for debugging if it exists
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