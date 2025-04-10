import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { extractYoutubeId, getUserVideos } from '@/lib/youtube-api';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    const videoId = extractYoutubeId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the session to check if the user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get the user's YouTube account info
    const { data: accountData } = await supabase
      .from('creator_youtube_accounts')
      .select('*')
      .eq('creator_id', session.user.id)
      .single();
    
    if (!accountData || !accountData.access_token) {
      return NextResponse.json(
        { error: 'YouTube account not connected' },
        { status: 404 }
      );
    }
    
    // Get user's YouTube videos
    const videos = await getUserVideos(accountData.access_token);
    
    // Find the video in the user's videos
    const videoInfo = videos?.find(video => video.id?.videoId === videoId);
    
    if (!videoInfo) {
      return NextResponse.json(
        { valid: false, message: 'This video does not belong to your YouTube channel' },
        { status: 200 }
      );
    }
    
    // Return the video info
    return NextResponse.json({
      valid: true,
      videoId,
      videoInfo
    });
  } catch (error: any) {
    console.error('Error verifying YouTube video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify YouTube video' },
      { status: 500 }
    );
  }
} 