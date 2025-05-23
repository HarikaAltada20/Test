import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri: clientRedirectUri } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 });
    }
    if (!clientRedirectUri) {
      return NextResponse.json({ error: 'Client redirect URI is missing' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_SECRET;
    
    console.log("Client ID:", clientId);
    console.log("Client Secret:", clientSecret);
    if (!clientId || !clientSecret) {
      console.error('Instagram client ID or secret is not configured in environment variables.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const form = new URLSearchParams();
    form.append('client_id', clientId);
    form.append('client_secret', clientSecret);
    form.append('grant_type', 'authorization_code');
    form.append('redirect_uri', clientRedirectUri); // Use the redirect_uri passed from the client, which should match the initial one
    form.append('code', code);

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: form,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Instagram token exchange error:', tokenData);
      return NextResponse.json(
        { error: tokenData.error_message || 'Failed to exchange code for token', details: tokenData },
        { status: tokenRes.status }
      );
    }

    // user_id from this response is the Instagram App-Scoped User ID if using Basic Display, or actual IG User ID for business.
    // The original brief was for basic display initially, then switched to business scopes.
    // For Business accounts, user_id returned here is the Instagram Account ID (a.k.a. Instagram Business Account ID).
    // This is what you need for /insights, /media etc for that business.
    // If you also need the Facebook Page ID linked to this IGBA, or the User accessing it, that would be a separate call or different handling.
    return NextResponse.json({ 
      access_token: tokenData.access_token, 
      user_id: tokenData.user_id // This is the Instagram Business Account ID (IGBA ID)
    });

  } catch (error: any) {
    console.error('Error in /api/instagram/exchange-token:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
} 