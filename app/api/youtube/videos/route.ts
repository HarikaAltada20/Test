import { NextRequest, NextResponse } from 'next/server';
import { getUserVideos, refreshAccessToken } from '@/lib/youtube-api';
import { createClient } from '@/utils/supabase/server';
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Authentication error:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('creator_profiles')
      .select('youtube_account')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching creator profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch creator profile' }, { status: 500 });
    }

    if (!profile?.youtube_account) {
      return NextResponse.json({ error: 'No YouTube account connected' }, { status: 404 });
    }

    let accessToken = profile.youtube_account.access_token;

    if (profile.youtube_account.expires_at && new Date(profile.youtube_account.expires_at) <= new Date()) {
      try {
        const newTokens = await refreshAccessToken(profile.youtube_account.refresh_token);
        
        const { error: updateError } = await supabase
          .from('creator_profiles')
          .update({
            youtube_account: {
              ...profile.youtube_account,
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token || profile.youtube_account.refresh_token,
              expires_at: newTokens.expires_at,
              updated_at: new Date().toISOString(),
              needs_reconnect: false,
            }
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating tokens:', updateError);
          return NextResponse.json({ error: 'Failed to refresh YouTube token' }, { status: 500 });
        }
        accessToken = newTokens.access_token;
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        await supabase
          .from('creator_profiles')
          .update({
            youtube_account: {
              ...profile.youtube_account,
              needs_reconnect: true,
              updated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        return NextResponse.json({ error: 'YouTube token expired and refresh failed' }, { status: 401 });
      }
    }

    const pageToken = request.nextUrl.searchParams.get('pageToken') || undefined;
    const { videos, nextPageToken } = await getUserVideos(accessToken, pageToken);
    
    return NextResponse.json({ videos, nextPageToken });

  } catch (error: any) {
    console.error('Error in YouTube videos endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch YouTube videos' },
      { status: 500 }
    );
  }
} 