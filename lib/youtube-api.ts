// Flag to detect if we're running in a Node.js environment
const isNode = typeof window === 'undefined';

// Extract YouTube video ID from URL (works both client and server)
export function extractYoutubeId(url: string) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Since these functions use Node.js-specific modules, we'll only import them
// and use them in a server context. Client components should use the API endpoints instead.
export async function createOAuthClient() {
  if (!isNode) {
    throw new Error('This function can only be used in a server environment');
  }
  
  // Dynamically import in server environment only
  const { google } = await import('googleapis');
  const OAuth2 = google.auth.OAuth2;
  
  return new OAuth2(
    process.env.YOUTUBE_CLIENT_ID!,
    process.env.YOUTUBE_CLIENT_SECRET!,
    process.env.YOUTUBE_REDIRECT_URL!
  );
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
  
  const response = await youtube.search.list({
    auth: oauth2Client,
    part: ['snippet'],
    forMine: true,
    maxResults: 50,
    type: ['video']
  });
  
  return response.data.items;
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
  if (!isNode) {
    throw new Error('This function can only be used in a server environment');
  }
  
  const { google } = await import('googleapis');
  const youtube = google.youtube('v3');
  const oauth2Client = await createOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const response = await youtube.channels.list({
    auth: oauth2Client,
    part: ['snippet', 'statistics'],
    mine: true
  });
  
  return response.data.items?.[0];
} 