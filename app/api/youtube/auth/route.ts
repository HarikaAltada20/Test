import { createOAuthClient } from '@/lib/youtube-api';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto'; // Import crypto for generating random state

export async function GET(request: NextRequest) {
  try {
    const origin = new URL(request.url).origin;
    // Always use the same redirect URI for both web and mobile (like Instagram)
    // The mobile callback route will handle redirecting to the API callback
    const redirectUri = `${origin}/api/youtube/callback`;
    const oauth2Client = await createOAuthClient(redirectUri);
    
    console.log('YouTube auth: redirectUri:', redirectUri);

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

    // Generate auth URL with explicit parameters to force consent screen
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',           // Get refresh token for long-term access
      scope: scopes,
      // Force consent screen - this ensures users see YouTube permission screen
      // even if they've granted access before
      prompt: 'consent',
      // Don't include previously granted scopes - force fresh consent
      include_granted_scopes: false,
      state: state                      // Pass the RANDOM state value
    });
    
    // Log the generated URL for debugging
    console.log('YouTube OAuth URL generated:', authUrl.substring(0, 200) + '...');
    console.log('Contains prompt=consent:', authUrl.includes('prompt=consent'));

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