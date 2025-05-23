import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
// dayjs is not needed here anymore as token expiry is handled by client or long-lived token

interface InstagramShortLivedTokenResponse {
  access_token: string;
  user_id: number; // This is the App-Scoped User ID (IGSID) or Instagram Business Account ID
}

interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string; // Should be 'bearer'
  expires_in: number; // Seconds until expiry, typically for 60 days
}

// No profile fetching functions needed in this simplified backend route

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // clientCallbackUri from body is the redirect_uri used in the client's initial auth redirect to Instagram
    const { code, redirectUri: clientRegisteredRedirectUri } = body; 

    if (!code) {
      return NextResponse.json({ error: 'No code provided for token exchange.' }, { status: 400 });
    }
    if (!clientRegisteredRedirectUri) {
      return NextResponse.json({ error: 'Client redirect URI is missing from request body.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !user) {
      console.error('Supabase session error or no user in /exchange-token:', sessionError);
      return NextResponse.json({ error: 'User not authenticated in Supabase.' }, { status: 401 });
    }
    console.log('Supabase session found in /exchange-token for user:', user.id);

    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID!;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET!; // Use non-public for server-side

    if (!clientId || !clientSecret) {
        console.error('Instagram client ID or server secret is not configured.');
        return NextResponse.json({ error: 'Server configuration error for Instagram auth.' }, { status: 500 });
    }

    // Step 1: Exchange code for a short-lived access token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: clientRegisteredRedirectUri, // This MUST match the URI used in the initial auth request
      code: code,
    });

    const shortLivedTokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });
    const shortLivedTokenData: InstagramShortLivedTokenResponse = await shortLivedTokenRes.json();

    if (!shortLivedTokenRes.ok || !shortLivedTokenData.access_token) {
      console.error('Error exchanging code for short-lived Instagram token:', (shortLivedTokenData as any).error_message || shortLivedTokenData);
      throw new Error((shortLivedTokenData as any).error_message || 'Failed to exchange code for short-lived Instagram token');
    }

    const shortLivedAccessToken = shortLivedTokenData.access_token;
    const instagramAppScopedUserId = shortLivedTokenData.user_id; // Capture this before it's gone

    // Step 2: Exchange short-lived token for a long-lived token
    const longLivedTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortLivedAccessToken}`;
    const longLivedTokenRes = await fetch(longLivedTokenUrl);
    const longLivedTokenData: InstagramLongLivedTokenResponse = await longLivedTokenRes.json();

    if (!longLivedTokenRes.ok || !longLivedTokenData.access_token) {
      console.error('Error exchanging for long-lived Instagram token:', (longLivedTokenData as any).error || longLivedTokenData);
      // Don't fail the whole flow if long-lived token fails; return short-lived one with its app_scoped_id.
      // Client can decide how to handle it (e.g. shorter session, prompt again sooner)
      // Or, you might choose to throw an error here if long-lived is essential.
      console.warn('Failed to get long-lived token, returning short-lived token details.');
      return NextResponse.json({
        access_token: shortLivedAccessToken, // short-lived
        user_id: instagramAppScopedUserId, // App-Scoped ID or Business Account ID
        token_type: 'bearer', // Standard type
        expires_in: 3600 // Approx. 1 hour for short-lived tokens
      });
    }
    
    console.log('Successfully obtained long-lived Instagram token for user:', user.id);
    // Return the long-lived token and the original user_id from the short-lived token exchange
    return NextResponse.json({
        access_token: longLivedTokenData.access_token, // long-lived
        user_id: instagramAppScopedUserId, // App-Scoped ID or Business Account ID from initial exchange
        token_type: longLivedTokenData.token_type,
        expires_in: longLivedTokenData.expires_in
    });

  } catch (error: any) {
    console.error('Full error in /api/instagram/exchange-token:', error);
    return NextResponse.json(
        { error: error.message || 'An unknown error occurred during Instagram token exchange.' }, 
        { status: 500 }
    );
  }
} 