import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { youtube_v3 } from 'googleapis';

type Schema$Video = youtube_v3.Schema$Video;
type Schema$CommentThread = youtube_v3.Schema$CommentThread;

interface VideoItem {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
    favoriteCount?: string;
  };
}

interface CommentItem {
  id?: string;
  snippet?: {
    topLevelComment?: {
      snippet?: {
        textDisplay?: string;
        authorDisplayName?: string;
        likeCount?: number;
        publishedAt?: string;
      };
    };
  };
}

// Flag to detect if we're running in a Node.js environment
const isNode = typeof window === 'undefined';

// Extract YouTube video ID from URL (works both client and server)
export function extractYoutubeId(url: string) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:&\S+)?/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Since these functions use Node.js-specific modules, we'll only import them
// and use them in a server context. Client components should use the API endpoints instead.
export async function createOAuthClient(): Promise<OAuth2Client> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`
  );

  return oauth2Client;
}

export async function getAuthUrl(oauth2Client: any) {
  if (!isNode) {
    throw new Error('This function can only be used in a server environment');
  }
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.readonly'],
    prompt: 'consent' // Force consent screen to always get a refresh token
  });
}

export async function getUserVideos(accessToken: string) {
  if (!isNode) {
    throw new Error('This function can only be used in a server environment');
  }
  
  const { google } = await import('googleapis');
  const youtube = google.youtube('v3');
  const oauth2Client = await createOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const channelResponse = await youtube.channels.list({
    part: ['contentDetails'],
    mine: true,
    access_token: accessToken
  });

  const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  
  if (!uploadsPlaylistId) {
    throw new Error('No uploads playlist found for the channel.');
  }

  // Get videos from the uploads playlist
  const videosResponse = await youtube.playlistItems.list({
    part: ['snippet', 'contentDetails'], // contentDetails contains videoId
    playlistId: uploadsPlaylistId,
    maxResults: 50, // Fetch up to 50 items for client-side pagination
    access_token: accessToken
  });

  const videoItems = videosResponse.data.items?.filter(item => item.contentDetails?.videoId);

  if (!videoItems || videoItems.length === 0) {
    return []; // Return empty array if no video items found
  }
  
  const videoIds = videoItems.map(item => item.contentDetails!.videoId) as string[];

  // Get detailed statistics and status for each video
  const videoDetailsResponse = await youtube.videos.list({
    part: ['statistics', 'snippet', 'status'], // Ensure status is fetched
    id: videoIds,
    access_token: accessToken
  });

  // Filter for public videos and then format the response
  const publicVideos = videoDetailsResponse.data.items?.filter(
    (video) => video.status?.privacyStatus === 'public'
  );

  return publicVideos?.map((video) => ({
    id: { videoId: video.id! }, 
    snippet: {
      title: video.snippet?.title || undefined,
      description: video.snippet?.description || undefined,
      publishedAt: video.snippet?.publishedAt || undefined,
      thumbnails: {
        default: video.snippet?.thumbnails?.default,
        medium: video.snippet?.thumbnails?.medium,
        high: video.snippet?.thumbnails?.high
      }
    },
    statistics: video.statistics 
  })) || [];
}

export async function getVideoStats(videoId: string, accessToken: string) {
  if (!isNode) {
    throw new Error('This function can only be used in a server environment');
  }
  
  const { google } = await import('googleapis');
  const youtube = google.youtube('v3');
  const oauth2Client = await createOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const response = await youtube.videos.list({
    auth: oauth2Client,
    part: ['statistics'],
    id: [videoId]
  });
  
  return response.data.items?.[0]?.statistics;
}

export async function getChannelInfo(accessToken: string) {
  const youtube = google.youtube('v3');
  
  try {
    // First get the channel ID for the authenticated user
    const response = await youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      mine: true,
      access_token: accessToken
    });

    if (!response.data.items?.[0]) {
      throw new Error('No channel found');
    }

    return response.data.items[0];
  } catch (error) {
    console.error('Error fetching channel info:', error);
    throw error;
  }
}

// Get channel videos
export async function getChannelVideos(accessToken: string, maxResults = 50) {
  const youtube = google.youtube('v3');
  
  try {
    // First get the channel ID
    const channelResponse = await youtube.channels.list({
      part: ['contentDetails'],
      mine: true,
      access_token: accessToken
    });

    const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    
    if (!uploadsPlaylistId) {
      throw new Error('No uploads playlist found');
    }

    // Get videos from the uploads playlist
    const videosResponse = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults,
      access_token: accessToken
    });

    // Get detailed statistics for each video
    const videoIds = videosResponse.data.items?.map(item => item.contentDetails?.videoId).filter(Boolean) as string[];
    
    if (videoIds.length === 0) {
      return [];
    }

    const videoStatsResponse = await youtube.videos.list({
      part: ['statistics', 'snippet'],
      id: videoIds,
      access_token: accessToken
    });

    // Combine video details with statistics
    return videoStatsResponse.data.items?.map((video: Schema$Video) => ({
      id: { videoId: video.id },
      snippet: video.snippet,
      statistics: video.statistics
    }));
  } catch (error) {
    console.error('Error fetching channel videos:', error);
    throw error;
  }
}

// Verify video ownership
export async function verifyVideoOwnership(accessToken: string, videoId: string) {
  const youtube = google.youtube('v3');
  
  try {
    // Get the channel ID for the authenticated user
    const channelResponse = await youtube.channels.list({
      part: ['id'],
      mine: true,
      access_token: accessToken
    });

    const channelId = channelResponse.data.items?.[0]?.id || '';
    
    if (!channelId) {
      throw new Error('No channel found for the authenticated user.');
    }

    // Get video details, including snippet, statistics, and status
    const videoResponse = await youtube.videos.list({
      part: ['snippet', 'statistics', 'status'], // Added statistics and status
      id: [videoId],
      access_token: accessToken
    });

    const video = videoResponse.data.items?.[0];
    
    if (!video) {
      throw new Error('Video not found on YouTube.');
    }

    // Check if the video belongs to the authenticated channel and is public
    const isOwned = video.snippet?.channelId === channelId;
    const isPublic = video.status?.privacyStatus === 'public';

    if (!isOwned) {
      return {
        valid: false,
        videoInfo: video, // Return video info even if not owned, for error message context
        error: 'not_owned'
      };
    }

    if (!isPublic) {
      return {
        valid: false,
        videoInfo: video,
        error: 'not_public'
      };
    }

    return {
      valid: true,
      videoInfo: video // This now includes snippet, statistics, and status
    };
  } catch (error) {
    console.error('Error verifying video ownership:', error);
    // Re-throw the error or handle it by returning a specific structure
    // For now, re-throwing to be caught by the API route
    throw error;
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: string;
  refresh_token?: string;
}> {
  try {
    const oauth2Client = await createOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    const expiresAt = new Date(Date.now() + (credentials.expiry_date! - Date.now())).toISOString();

    return {
      access_token: credentials.access_token!,
      expires_at: expiresAt,
      refresh_token: credentials.refresh_token || undefined
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

// Get video metrics
export async function getVideoMetrics(accessToken: string, videoId: string) {
  const youtube = google.youtube('v3');
  
  try {
    const [videoResponse, commentsResponse] = await Promise.all([
      youtube.videos.list({
        part: ['statistics', 'snippet'],
        id: [videoId],
        access_token: accessToken
      }),
      youtube.commentThreads.list({
        part: ['snippet'],
        videoId,
        maxResults: 100,
        access_token: accessToken
      })
    ]);

    const video = videoResponse.data.items?.[0];
    
    if (!video) {
      throw new Error('Video not found');
    }

    return {
      title: video.snippet?.title,
      views: parseInt(video.statistics?.viewCount || '0'),
      likes: parseInt(video.statistics?.likeCount || '0'),
      comments: parseInt(video.statistics?.commentCount || '0'),
      commentDetails: commentsResponse.data.items?.map((comment: Schema$CommentThread) => ({
        id: comment.id || undefined,
        text: comment.snippet?.topLevelComment?.snippet?.textDisplay,
        author: comment.snippet?.topLevelComment?.snippet?.authorDisplayName,
        likeCount: comment.snippet?.topLevelComment?.snippet?.likeCount,
        publishedAt: comment.snippet?.topLevelComment?.snippet?.publishedAt
      })),
      favorites: parseInt(video.statistics?.favoriteCount || '0'),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching video metrics:', error);
    throw error;
  }
} 