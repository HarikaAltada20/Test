import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient, getChannelInfo } from '@/lib/youtube-api';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const supabase = createRouteHandlerClient({ cookies });
  
  if (!code) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=no_code', request.url));
  }
  
  try {
    // Get tokens from YouTube
    const oauth2Client = await createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    
    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Get channel information
    const channelInfo = await getChannelInfo(tokens.access_token!);
    
    // Calculate expiration time (default to 1 hour if expires_in not provided)
    const expiresIn = (tokens as any).expires_in || 3600;
    const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
    
    // Store tokens and channel info in database
    await supabase
      .from('creator_youtube_accounts')
      .upsert({
        creator_id: session.user.id,
        channel_id: channelInfo?.id,
        channel_title: channelInfo?.snippet?.title,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt
      });
    
    return NextResponse.redirect(new URL('/dashboard/settings?youtube_connected=true', request.url));
  } catch (error) {
    console.error('YouTube OAuth error:', error);
    return NextResponse.redirect(new URL('/dashboard/settings?error=youtube_connection_failed', request.url));
  }
} 