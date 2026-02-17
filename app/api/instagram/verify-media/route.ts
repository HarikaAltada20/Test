import { NextResponse } from 'next/server';

interface VerifyMediaRequest {
  mediaUrl: string;
  userAccessToken: string; // Renamed for clarity, this is the User Access Token
  userAppScopedId: string; // This is the IG Business Account ID
}

// Define a structure for the expected Instagram media details
// This should align with your `InstagramReel` interface on the client
interface InstagramMediaInfo {
    id: string;
    media_type: 'REEL' | 'VIDEO' | 'IMAGE' | 'CAROUSEL_ALBUM' | string; // Allow string for flexibility
    media_product_type?: 'REELS' | 'FEED' | 'STORY' | 'AD' | string; // Allow string for flexibility
    caption?: string;
    permalink: string;
    thumbnail_url?: string;
    timestamp: string;
    username?: string; // If fetched and available
}

// Function to get an App Access Token (cache this in a real app for performance/rate limits)
// This function is not used in the POST handler below but kept for potential other uses.
async function getAppAccessToken() {
  const appId = process.env.INSTAGRAM_CLIENT_ID;
  const appSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  
  console.log("--- DEBUG getAppAccessToken ---");
  console.log("Reminder: Ensure INSTAGRAM_CLIENT_ID (your App ID) and INSTAGRAM_CLIENT_SECRET are set in .env.local for server-side use.");
  console.log(`Raw App ID from env (INSTAGRAM_CLIENT_ID): ${process.env.INSTAGRAM_CLIENT_ID}`);
  console.log(`Raw App Secret from env (INSTAGRAM_CLIENT_SECRET length): ${process.env.INSTAGRAM_CLIENT_SECRET?.length || 0}`);
  console.log(`Using App ID: ${appId}`);
  console.log(`Using App Secret (is it defined?): ${!!appSecret}`);

  if (!appId || !appSecret) {
    console.error("CRITICAL: Instagram App ID (INSTAGRAM_CLIENT_ID) or App Secret (INSTAGRAM_CLIENT_SECRET) is MISSING in server environment variables.");
    throw new Error("Instagram App ID or Secret is not configured correctly in server environment variables. Check .env.local (ensure INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET are set) and restart the server.");
  }

  const appTokenUrl = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
  console.log(`Attempting to fetch App Access Token from URL: ${appTokenUrl}`); 

  const response = await fetch(appTokenUrl);
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: 'Failed to parse error response from Facebook API and response was not OK.', status: response.status, statusText: response.statusText };
    }
    console.error("Facebook API Error - Failed to fetch App Access Token:", errorData);
    throw new Error(`Failed to fetch App Access Token from Facebook. API responded with: ${JSON.stringify(errorData)}`);
  }
  const data = await response.json();
  console.log("--- END DEBUG getAppAccessToken ---");
  return data.access_token;
}

export function extractInstagramShortcode(url: string): string | null {
  if (!url) return null;

  // Regex to capture the shortcode from various Instagram URL patterns
  // Covers:
  // - /p/SHORTCODE/
  // - /reel/SHORTCODE/
  // - /tv/SHORTCODE/
  // - /reels/SHORTCODE/ (less common but good to cover)
  // Ignores query parameters
  const regex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i;
  const match = url.match(regex);

  return match ? match[1] : null;
}

export async function POST(request: Request) {
  try {
    const { mediaUrl, userAccessToken, userAppScopedId }: VerifyMediaRequest = await request.json();
    // console.log("Received for verification: mediaUrl, userAccessToken (length), userAppScopedId", mediaUrl, userAccessToken?.length, userAppScopedId);

    if (!mediaUrl || !userAccessToken || !userAppScopedId) {
      return NextResponse.json({ error: 'Missing required parameters: mediaUrl, userAccessToken, or userAppScopedId' }, { status: 400 });
    }

    const shortcode = extractInstagramShortcode(mediaUrl);

    if (!shortcode) {
      return NextResponse.json({ error: 'Invalid Instagram URL format' }, { status: 400 });
    }

    const fields = 'id,media_type,media_product_type,caption,permalink,thumbnail_url,timestamp,username';

    // Paginate through all user media so link submission works for reels not on the first page
    let nextUrl: string | null = `https://graph.instagram.com/${userAppScopedId}/media?fields=${fields}&access_token=${userAccessToken}&limit=50`;
    let foundMedia: any = null;

    while (nextUrl) {
      const igResponse = await fetch(nextUrl);
      if (!igResponse.ok) {
        let errorData;
        try {
          errorData = await igResponse.json();
        } catch (e) {
          errorData = { message: "Failed to parse error JSON from Instagram API.", instagram_status: igResponse.status, instagram_status_text: igResponse.statusText };
        }
        console.error('Instagram API Error fetching user media:', errorData);
        return NextResponse.json({
          error: 'Failed to fetch media from Instagram.',
          details: errorData
        }, { status: igResponse.status > 0 ? igResponse.status : 500 });
      }

      const igData = await igResponse.json();
      if (!igData.data || !Array.isArray(igData.data)) {
        console.error('Unexpected response structure from Instagram /media endpoint:', igData);
        return NextResponse.json({ error: 'Unexpected response structure from Instagram when fetching media.' }, { status: 500 });
      }

      for (const mediaItem of igData.data) {
        const apiMediaShortcode = extractInstagramShortcode(mediaItem.permalink);
        if (apiMediaShortcode && apiMediaShortcode === shortcode) {
          foundMedia = mediaItem;
          break;
        }
      }
      if (foundMedia) break;
      nextUrl = igData.paging?.next || null;
    }

    if (foundMedia) {
      const mediaInfo: InstagramMediaInfo = {
        id: foundMedia.id,
        media_type: foundMedia.media_product_type === 'REELS' ? 'REEL' : (foundMedia.media_type || 'VIDEO'),
        media_product_type: foundMedia.media_product_type,
        caption: foundMedia.caption || '',
        permalink: foundMedia.permalink,
        thumbnail_url: foundMedia.thumbnail_url,
        timestamp: foundMedia.timestamp,
        username: foundMedia.username,
      };
      return NextResponse.json({ valid: true, mediaInfo });
    } else {
      console.log(`Media with permalink ${mediaUrl} not found in user's (${userAppScopedId}) media after paginating.`);
      return NextResponse.json({
        valid: false,
        error: 'Media not found for the given URL. It may not belong to your connected account, or the link may be invalid.'
      }, { status: 404 });
    }

  } catch (error: any) {
    console.error('Error in /api/instagram/verify-media route handler:', error);
    // Differentiate known error types if possible
    if (error.name === 'FetchError') { // Node-fetch specific, or browser fetch network error
        return NextResponse.json({ error: 'Network error when trying to contact external services.', details: error.message }, { status: 503 }); // Service Unavailable
    }
    // TypeErrors can occur from request.json() if body is malformed or not present
    if (error instanceof TypeError && error.message.includes("Body has already been consumed") || error.message.includes("missing an argument")) {
        return NextResponse.json({ error: 'Invalid request format or body.', details: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'An unexpected server error occurred.' }, { status: 500 });
  }
}