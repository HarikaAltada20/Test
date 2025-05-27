import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient, refreshAccessToken } from '@/lib/youtube-api';
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
      console.log(`Metrics API: Token for user ${user.id} needs refresh. Old expiry: ${youtubeAccount.expires_at}`);
      try {
        const newTokens = await refreshAccessToken(youtubeAccount.refresh_token);
        
        let newExpiresAt;
        if (newTokens.expires_at) { // Assuming refreshAccessToken returns expires_at as string ISO
          newExpiresAt = newTokens.expires_at; 
        } else {
          // Fallback: This case should ideally not happen if refreshAccessToken is robust
          newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
          console.warn('YouTube metrics refresh: newTokens.expires_at not found, defaulting to 1 hour.');
        }

        youtubeAccount.access_token = newTokens.access_token;
        youtubeAccount.refresh_token = newTokens.refresh_token || youtubeAccount.refresh_token;
        youtubeAccount.expires_at = newExpiresAt;
        youtubeAccount.updated_at = new Date().toISOString();

        const { error: updateError } = await supabase
          .from('creator_profiles')
          .update({
            youtube_account: youtubeAccount,
            updated_at: new Date().toISOString() // Also update the top-level updated_at
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`Metrics API: Error updating token for user ${user.id} after refresh:`, updateError);
          // Decide if we should throw or try to proceed with old token if still valid for a bit
          // For now, throwing to be consistent with previous logic if update fails
          throw updateError;
        }
        console.log(`Metrics API: Token for user ${user.id} refreshed. New expiry: ${newExpiresAt}`);
      } catch (refreshError) {
        console.error(`Metrics API: Failed to refresh token for user ${user.id}:`, refreshError);
        // If refresh fails, we might still try to use the old token if the API call is critical
        // or return an error indicating refresh failure. For now, returning an error.
        return NextResponse.json({ error: 'Failed to refresh YouTube token' }, { status: 401 });
      }
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