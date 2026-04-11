import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TikTokApiClient } from "@/lib/tiktok/api/TikTokApiClient";
import { ensureFreshTikTokToken } from "@/lib/tiktok/ensure-fresh-tiktok-token";

/**
 * GET /api/auth/tiktok/videos?cursor=<cursor>
 *
 * Fetches the authenticated user's TikTok video list using the Display API.
 * Returns paginated results with video details (title, thumbnail, metrics, etc.).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") || undefined;

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const tokenResult = await ensureFreshTikTokToken(supabase, user.id);
    if (!tokenResult.ok) {
      return NextResponse.json(
        {
          error: tokenResult.error,
          expired: tokenResult.expired ?? false,
        },
        { status: tokenResult.expired ? 401 : 400 },
      );
    }
    const accessToken = tokenResult.accessToken;

    // Fetch video list using TikTok API
    const apiClient = new TikTokApiClient();
    const response = await apiClient.getVideoList(accessToken, cursor);

    const videos = (response?.data?.videos || []).map((video: any) => ({
      id: video.id,
      title: video.title || video.video_description || "TikTok Video",
      share_url: video.share_url,
      cover_image_url: video.cover_image_url,
      duration: video.duration,
      create_time: video.create_time,
      video_description: video.video_description,
      view_count: video.view_count || 0,
      like_count: video.like_count || 0,
      comment_count: video.comment_count || 0,
      share_count: video.share_count || 0,
    }));

    const hasMore = response?.data?.has_more || false;
    const nextCursor = response?.data?.cursor || null;

    return NextResponse.json({
      videos,
      hasMore,
      nextCursor,
    });
  } catch (error: any) {
    console.error("[TikTok Videos] Error:", error);

    // Handle token expiry errors
    if (error.name === "InvalidTokenException") {
      return NextResponse.json(
        {
          error:
            "TikTok token expired or invalid. Please reconnect your account.",
          expired: true,
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch TikTok videos" },
      { status: 500 },
    );
  }
}
