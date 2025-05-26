import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient, getChannelInfo, verifyVideoOwnership, extractYoutubeId } from '@/lib/youtube-api';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  return handleVerification(request);
}

export async function POST(request: NextRequest) {
  return handleVerification(request);
}

async function handleVerification(request: NextRequest) {
  const supabase = await createClient();

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
      const verificationResult = await verifyVideoOwnership(youtubeAccount.access_token, videoId);
      
      if (!verificationResult.valid) {
        let errorMessage = 'Video verification failed.';
        if (verificationResult.error === 'not_owned') {
          errorMessage = 'This video does not belong to your YouTube channel.';
        } else if (verificationResult.error === 'not_public') {
          errorMessage = 'This video is not public. Please select a public video.';
        } else if (verificationResult.videoInfo && verificationResult.videoInfo.snippet) {
          // Fallback if error type is not specific but videoInfo exists
          errorMessage = `Could not verify video: ${verificationResult.videoInfo.snippet.title}. It might not be public or belong to your channel.`;
        }
        return NextResponse.json({ error: errorMessage }, { status: 403 });
      }

      // Destructure the parts from videoInfo for the response
      const { id: videoInfoId, snippet, statistics } = verificationResult.videoInfo;

      return NextResponse.json({
        valid: true,
        videoInfo: {
          id: { videoId: videoInfoId }, // Ensure consistent structure with YouTubeVideo interface
          snippet: snippet,
          statistics: statistics // Pass along the statistics
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