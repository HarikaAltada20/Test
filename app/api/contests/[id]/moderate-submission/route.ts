import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

/**
 * POST /api/contests/[id]/moderate-submission
 * 
 * Accept or reject a Twitter campaign tweet
 * Note: This is for Twitter campaigns only (automated fetching system)
 * For manual submissions (YouTube/Instagram), use the existing verify-submission endpoint
 * 
 * Body:
 * - tweetId: string (twitter_campaign_tweets.id)
 * - action: "approve" | "reject"
 * - reason?: string (required for reject)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    const { tweetId, action, reason } = await request.json();

    // Validate input
    if (!tweetId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "tweetId and action (approve/reject) are required" },
        { status: 400 }
      );
    }

    if (action === "reject" && !reason) {
      return NextResponse.json(
        { error: "Reason is required when rejecting" },
        { status: 400 }
      );
    }

    // Check if user is admin or contest owner
    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    const isAdmin = userData?.user_type === "admin";

    // Get contest to verify ownership
    let contestQuery = supabase
      .from("contests")
      .select("id, advertiser_id")
      .eq("id", contestId);

    if (!isAdmin) {
      contestQuery = contestQuery.eq("advertiser_id", user.id);
    }

    const { data: contest, error: contestError } = await contestQuery.single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: "Contest not found or access denied" },
        { status: 404 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const moderationStatus = action === "approve" ? "verified" : "rejected";

    // Update Twitter campaign tweet
    const updateData: any = {
      moderation_status: moderationStatus,
    };

    if (action === "reject") {
      // Store rejection reason in manual_points_reason field
      // (we can add a separate rejection_reason column later if needed)
      updateData.manual_points_reason = reason;
    } else {
      // Clear reason on approve (unless there's a manual points adjustment)
      const { data: existingTweet } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select("manual_points_adjustment, manual_points_reason")
        .eq("id", tweetId)
        .single();

      // Only clear reason if there's no manual points adjustment
      if (!existingTweet?.manual_points_adjustment || existingTweet.manual_points_adjustment === 0) {
        updateData.manual_points_reason = null;
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .update(updateData)
      .eq("id", tweetId)
      .eq("contest_id", contestId);

    if (updateError) {
      console.error("[moderate-submission] Error updating tweet:", updateError);
      return NextResponse.json(
        { error: "Failed to update tweet" },
        { status: 500 }
      );
    }

    // Recalculate leaderboard for this creator after moderation
    const { data: tweet } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("creator_id")
      .eq("id", tweetId)
      .single();

    if (tweet?.creator_id) {
      // Trigger leaderboard recalculation
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      try {
        await fetch(`${baseUrl}/api/contests/${contestId}/twitter-refresh-tweets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (refreshError) {
        console.error("[moderate-submission] Error refreshing leaderboard:", refreshError);
        // Don't fail the request if leaderboard refresh fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tweet ${action === "approve" ? "approved" : "rejected"} successfully`,
    });
  } catch (error: any) {
    console.error("[moderate-submission] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

