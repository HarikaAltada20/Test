import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient } from '@/lib/youtube-api';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const videoId = request.nextUrl.searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's YouTube account
    const { data: profile, error: profileError } = await supabase
      .from('creator_profiles')
      .select('youtube_account')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.youtube_account) {
      return NextResponse.json({ error: 'YouTube account not connected' }, { status: 401 });
    }

    const youtubeAccount = profile.youtube_account;

    // Check if token is expired and needs refresh
    if (new Date(youtubeAccount.expires_at) <= new Date()) {
      const oauth2Client = await createOAuthClient();
      oauth2Client.setCredentials({
        refresh_token: youtubeAccount.refresh_token,
        access_token: youtubeAccount.access_token
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update the tokens in the database
      const expiresAt = new Date(Date.now() + (credentials.expiry_date! - Date.now())).toISOString();
      youtubeAccount.access_token = credentials.access_token;
      youtubeAccount.refresh_token = credentials.refresh_token || youtubeAccount.refresh_token;
      youtubeAccount.expires_at = expiresAt;

      await supabase
        .from('creator_profiles')
        .update({
          youtube_account: youtubeAccount,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
    }

    // Initialize YouTube API
    const youtube = google.youtube('v3');
    
    // Get video statistics
    const videoResponse = await youtube.videos.list({
      part: ['statistics', 'snippet'],
      id: [videoId],
      access_token: youtubeAccount.access_token
    });

    if (!videoResponse.data.items?.[0]) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const video = videoResponse.data.items[0];
    
    // Get video comments (optional, as it requires additional API quota)
    const commentsResponse = await youtube.commentThreads.list({
      part: ['snippet'],
      videoId: videoId,
      maxResults: 100,
      access_token: youtubeAccount.access_token
    });

    // Compile metrics
    const metrics = {
      title: video.snippet?.title,
      views: parseInt(video.statistics?.viewCount || '0'),
      likes: parseInt(video.statistics?.likeCount || '0'),
      comments: parseInt(video.statistics?.commentCount || '0'),
      commentDetails: commentsResponse.data.items?.map(comment => ({
        id: comment.id,
        text: comment.snippet?.topLevelComment?.snippet?.textDisplay,
        author: comment.snippet?.topLevelComment?.snippet?.authorDisplayName,
        likeCount: comment.snippet?.topLevelComment?.snippet?.likeCount,
        publishedAt: comment.snippet?.topLevelComment?.snippet?.publishedAt
      })),
      favorites: parseInt(video.statistics?.favoriteCount || '0'),
      updated_at: new Date().toISOString()
    };

    // Store metrics in database (optional)
    const { error: metricsError } = await supabase
      .from('video_metrics')
      .upsert({
        video_id: videoId,
        metrics,
        updated_at: new Date().toISOString()
      });

    if (metricsError) {
      console.error('Error storing metrics:', metricsError);
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching video metrics:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch video metrics' },
      { status: 500 }
    );
  }
} 