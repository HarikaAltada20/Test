import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient, getChannelInfo } from '@/lib/youtube-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieStore = await cookies();
  const storedStateCookie = cookieStore.get('youtube_oauth_state');
  const storedState = storedStateCookie?.value;

  console.log('Callback invoked');
  console.log('State from URL:', state);
  console.log('State from cookie:', storedState);

  if (!state || !storedState || state !== storedState) {
    console.error('State mismatch or missing state cookie.');
    const errorUrl = new URL('/dashboard/settings?error=state_mismatch', request.url);
    const response = NextResponse.redirect(errorUrl);
    response.cookies.set({
        name: 'youtube_oauth_state',
        value: '',
        maxAge: 0,
        path: '/'
    });
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  let response: NextResponse;

  try {
    console.log('Callback invoked - using createServerClient (get only)');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error during getSession:', sessionError);
      response = NextResponse.redirect(new URL('/auth/signin?error=session_error', request.url));
      response.cookies.set({ name: 'youtube_oauth_state', value: '', maxAge: 0, path: '/' });
      return response;
    }

    if (!session?.user) {
      console.error('No session found during YouTube callback AFTER getSession');
      response = NextResponse.redirect(new URL('/auth/signin?error=no_session', request.url));
      response.cookies.set({ name: 'youtube_oauth_state', value: '', maxAge: 0, path: '/' });
      return response;
    }

    console.log('Session found during callback for user:', session.user.id);
    
    if (!code) {
      console.log('No code found, redirecting');
      response = NextResponse.redirect(new URL('/dashboard/settings?error=no_code', request.url));
      response.cookies.set({ name: 'youtube_oauth_state', value: '', maxAge: 0, path: '/' });
      return response;
    }

    const oauth2Client = await createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('Received YouTube tokens');

    const channelInfo = await getChannelInfo(tokens.access_token!);
    
    if (!channelInfo) {
      console.error('Failed to fetch channel info with token');
      throw new Error('Failed to fetch channel information');
    }
    
    console.log('Fetched channel info:', channelInfo.snippet?.title);

    const expiresIn = tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600;
    const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
    
    const youtubeAccount = {
      channel_id: channelInfo.id,
      channel_title: channelInfo.snippet?.title,
      channel_description: channelInfo.snippet?.description,
      channel_custom_url: channelInfo.snippet?.customUrl,
      subscriber_count: channelInfo.statistics?.subscriberCount,
      video_count: channelInfo.statistics?.videoCount,
      view_count: channelInfo.statistics?.viewCount,
      channel_thumbnail: channelInfo.snippet?.thumbnails?.default?.url,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_at: expiresAt,
      scopes: tokens.scope?.split(' '),
      updated_at: new Date().toISOString()
    };

    console.log('Updating creator profile for user:', session.user.id);
    const { error: updateError } = await supabase
      .from('creator_profiles')
      .update({
        youtube_account: youtubeAccount
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error updating creator profile:', updateError);
      throw updateError;
    }

    console.log('Creator profile updated successfully');

    const redirectUrl = '/dashboard/settings?success=youtube_connected';
    console.log('Redirecting to:', redirectUrl);
    response = NextResponse.redirect(new URL(redirectUrl, request.url));

    response.cookies.set({ name: 'youtube_oauth_state', value: '', maxAge: 0, path: '/' });

    return response;

  } catch (error) {
    console.error('YouTube OAuth error:', error);
    const errorUrl = new URL('/dashboard/settings', request.url);
    errorUrl.searchParams.set('error', 'youtube_connection_failed');
    errorUrl.searchParams.set('message', error instanceof Error ? error.message : 'Failed to connect YouTube account');
    response = NextResponse.redirect(errorUrl);
    response.cookies.set({ name: 'youtube_oauth_state', value: '', maxAge: 0, path: '/' });
    return response;
  }
} 