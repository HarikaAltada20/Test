import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// Endpoint to fetch Twitter campaign metrics for display
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contestId } = await params;

    if (!contestId) {
      return NextResponse.json(
        { error: "Contest ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch metrics from twitter_campaign_metrics table
    const { data: metrics, error } = await supabase
      .from("twitter_campaign_metrics")
      .select("*")
      .eq("contest_id", contestId)
      .maybeSingle();

    if (error) {
      console.error("[twitter-metrics] Error fetching metrics", error);
      return NextResponse.json(
        { error: "Failed to fetch metrics" },
        { status: 500 }
      );
    }

    // If no metrics exist yet, return empty/default values
    if (!metrics) {
      return NextResponse.json({
        success: true,
        metrics: {
          total_filtered_tweets: 0,
          total_participants: 0,
          total_likes: 0,
          total_replies: 0,
          total_retweets: 0,
          total_quote_reposts: 0,
          total_impressions: 0,
          total_points: 0,
          campaign_type: null,
          target_tweet_id: null,
          target_tweet_url: null,
          target_likes: null,
          target_comments: null,
          target_retweets: null,
          target_quote_reposts: null,
          target_current_likes: null,
          target_current_comments: null,
          target_current_retweets: null,
          target_current_quote_reposts: null,
          target_current_views: null,
          targets_reached: null,
          last_updated_at: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error: any) {
    console.error("[twitter-metrics] Unexpected error", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

