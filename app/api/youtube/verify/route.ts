import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient, getChannelInfo, verifyVideoOwnership, extractYoutubeId } from '@/lib/youtube-api';

export async function GET(request: NextRequest) {
  return handleVerification(request);
}

export async function POST(request: NextRequest) {
  return handleVerification(request);
}

async function handleVerification(request: NextRequest) {
  const cookieStore = await cookies();
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

  try {
    // Get video URL from request body for POST requests
    let videoId: string | null = null;
    if (request.method === 'POST') {
      const body = await request.json();
      if (!body.videoUrl) {
        return NextResponse.json({ error: 'No video URL provided' }, { status: 400 });
      }
      videoId = extractYoutubeId(body.videoUrl);
      if (!videoId) {
        return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
      }
    }

    // Verify user authentication with server
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get creator profile with YouTube account info
    const { data: profile, error: profileError } = await supabase
      .from('creator_profiles')
      .select('youtube_account')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.youtube_account) {
      return NextResponse.json({ error: 'No YouTube account connected' }, { status: 404 });
    }

    const youtubeAccount = profile.youtube_account;
    const oauth2Client = await createOAuthClient();

    // Check if token needs refresh
    if (new Date(youtubeAccount.expires_at) <= new Date()) {
      try {
        oauth2Client.setCredentials({
          refresh_token: youtubeAccount.refresh_token,
          access_token: youtubeAccount.access_token
        });

        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update tokens in database
        const expiresIn = credentials.expiry_date ? 
          Math.floor((credentials.expiry_date - Date.now()) / 1000) : 
          3600;
        
        const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
        
        youtubeAccount.access_token = credentials.access_token;
        youtubeAccount.expires_at = expiresAt;

        await supabase
          .from('creator_profiles')
          .update({
            youtube_account: youtubeAccount
          })
          .eq('id', user.id);

      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
      }
    }

    // For GET requests, just return channel info
    if (request.method === 'GET') {
      const channelInfo = await getChannelInfo(youtubeAccount.access_token);
      return NextResponse.json({
        channelId: channelInfo?.id,
        channelTitle: channelInfo?.snippet?.title,
        isConnected: true
      });
    }

    // For POST requests, verify video ownership
    if (videoId) {
      const { valid, videoInfo } = await verifyVideoOwnership(youtubeAccount.access_token, videoId);
      
      if (!valid) {
        return NextResponse.json({ error: 'This video does not belong to your YouTube channel' }, { status: 403 });
      }

      return NextResponse.json({
        valid: true,
        videoInfo: {
          id: { videoId: videoInfo.id },
          snippet: videoInfo.snippet
        }
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error) {
    console.error('Error verifying YouTube account:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to verify YouTube account' 
    }, { status: 500 });
  }
} 