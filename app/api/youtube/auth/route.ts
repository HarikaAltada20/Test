import { createOAuthClient, getAuthUrl } from '@/lib/youtube-api';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto'; // Import crypto for generating random state

export async function GET(request: NextRequest) {
  try {
    const origin = new URL(request.url).origin;
    // Always use the same redirect URI for both web and mobile (like Instagram)
    // The mobile callback route will handle redirecting to the API callback
    const redirectUri = `${origin}/api/youtube/callback`;
    const oauth2Client = await createOAuthClient(redirectUri);

    // Generate a secure random state value
    const state = crypto.randomBytes(16).toString('hex');

    // Generate auth URL — scopes are defined once in getAuthUrl (lib/youtube-api.ts)
    const authUrl = await getAuthUrl(oauth2Client, {
      state,
      include_granted_scopes: false,
    });
    
    console.log("YouTube auth: initiating OAuth flow");

    // Create a response object to set the cookie
    const response = NextResponse.redirect(authUrl);

    // Set the state cookie
    response.cookies.set('youtube_oauth_state', state, {
      path: '/',          // Set path to root to ensure it's sent to the callback
      httpOnly: true,     // Prevent client-side script access
      secure: process.env.NODE_ENV === 'production', // Use secure flag in production
      sameSite: 'lax',    // Recommended for OAuth flows
      maxAge: 60 * 15     // Expire after 15 minutes
    });

    return response; // Return the response with the cookie set

  } catch (error) {
    console.error('Error initiating YouTube OAuth:', error);
    const errorUrl = new URL('/dashboard/settings', request.url);
    errorUrl.searchParams.set('error', 'youtube_auth_failed');
    // Don't set the cookie on error
    return NextResponse.redirect(errorUrl);
  }
} 