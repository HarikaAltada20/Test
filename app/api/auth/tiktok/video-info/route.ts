import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TikTokApiClient } from "@/lib/tiktok/api/TikTokApiClient";

/**
 * GET /api/auth/tiktok/video-info?video_id=<id>
 *
 * Fetches TikTok video info using the authenticated user's access token.
 * Used by the submission page to preview a TikTok video before submitting.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const videoId = url.searchParams.get("video_id");

    if (!videoId) {
      return NextResponse.json(
        { error: "video_id parameter is required" },
        { status: 400 },
      );
    }

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

    // Fetch user's TikTok account from creator_profiles
    const { data: profile, error: profileError } = await supabase
      .from("creator_profiles")
      .select("tiktok_account")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tiktok_account) {
      return NextResponse.json(
        { error: "TikTok account not connected" },
        { status: 400 },
      );
    }

    const tiktokAccount = profile.tiktok_account as any;
    const accessToken = tiktokAccount.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "TikTok access token not found" },
        { status: 400 },
      );
    }

    // Check token expiry
    if (
      tiktokAccount.expires_at &&
      new Date(tiktokAccount.expires_at) <= new Date()
    ) {
      return NextResponse.json(
        { error: "TikTok token expired. Please reconnect your account." },
        { status: 401 },
      );
    }

    // Fetch video info using TikTok API
    const apiClient = new TikTokApiClient();
    const response = await apiClient.queryVideos(accessToken, [videoId]);

    const videos = response?.data?.videos || [];
    if (videos.length === 0) {
      return NextResponse.json(
        {
          error:
            "Video not found. Make sure the video belongs to your TikTok account.",
        },
        { status: 404 },
      );
    }

    const video = videos[0];

    return NextResponse.json({
      video: {
        id: video.id,
        title: video.title || video.video_description || "TikTok Video",
        share_url: video.share_url,
        cover_image_url: video.cover_image_url,
        duration: video.duration,
        create_time: video.create_time,
        view_count: video.view_count || 0,
        like_count: video.like_count || 0,
        comment_count: video.comment_count || 0,
        share_count: video.share_count || 0,
      },
    });
  } catch (error: any) {
    console.error("[TikTok Video Info] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch video info" },
      { status: 500 },
    );
  }
}
