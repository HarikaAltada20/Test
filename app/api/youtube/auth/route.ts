import { createOAuthClient } from '@/lib/youtube-api';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto'; // Import crypto for generating random state

export async function GET(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || '';
    const isMobileApp = userAgent.includes('GameOfCreators-Mobile');
    const redirectUri = isMobileApp
      ? `${process.env.NEXT_PUBLIC_APP_URL}/mobile/youtube/callback`
      : `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`;

    const oauth2Client = await createOAuthClient(redirectUri);
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/dashboard/settings'; // Keep returnTo if needed elsewhere, but don't use as state

    // Generate a secure random state value
    const state = crypto.randomBytes(16).toString('hex');

    // Define all required scopes for full YouTube integration
    const scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',      // Read access to YouTube data
    ];
      // 'https://www.googleapis.com/auth/youtube.force-ssl',     // SSL access
      // 'https://www.googleapis.com/auth/youtubepartner',        // Access to YouTube Content Owner features
      // 'https://www.googleapis.com/auth/youtube.channel-memberships.creator', // Access to channel memberships
      // 'https://www.googleapis.com/auth/youtube.upload'         // Upload access (if needed in future)

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',           // Get refresh token for long-term access
      scope: scopes,
      prompt: 'consent',                // Always show consent screen to get refresh token
      include_granted_scopes: true,     // Include previously granted scopes
      state: state                      // Pass the RANDOM state value
    });

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
    errorUrl.searchParams.set('message', error instanceof Error ? error.message : 'Failed to initiate YouTube authentication');
    // Don't set the cookie on error
    return NextResponse.redirect(errorUrl);
  }
} 