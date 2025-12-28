import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * POST /api/contests/[id]/moderate-creator
 * 
 * Approve or reject a creator for a Twitter campaign
 * This sets moderation_status and rejection_reason on twitter_campaign_leaderboard
 * and also updates all tweets from that creator
 * 
 * Body:
 * - creatorId: string
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
    const { creatorId, action, reason } = await request.json();

    // Validate input
    if (!creatorId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "creatorId and action (approve/reject) are required" },
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
    const moderationStatus = action === "approve" ? "approved" : "rejected";

    // Update twitter_campaign_leaderboard
    const leaderboardUpdateData: any = {
      moderation_status: moderationStatus,
    };

    if (action === "reject") {
      leaderboardUpdateData.rejection_reason = reason;
    } else {
      leaderboardUpdateData.rejection_reason = null;
    }

    const { error: leaderboardUpdateError } = await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .update(leaderboardUpdateData)
      .eq("contest_id", contestId)
      .eq("creator_id", creatorId);

    if (leaderboardUpdateError) {
      console.error("[moderate-creator] Error updating leaderboard:", leaderboardUpdateError);
      return NextResponse.json(
        { error: "Failed to update leaderboard" },
        { status: 500 }
      );
    }

    // Also update all tweets from this creator
    if (action === "reject") {
      // For reject, update all tweets at once with rejection reason
      const tweetUpdateData: any = {
        moderation_status: moderationStatus,
        manual_points_reason: reason, // Store rejection reason
      };

      const { error: tweetUpdateError } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .update(tweetUpdateData)
        .eq("contest_id", contestId)
        .eq("creator_id", creatorId);

      if (tweetUpdateError) {
        console.error("[moderate-creator] Error updating tweets:", tweetUpdateError);
        // Don't fail the request if tweet update fails, leaderboard is already updated
      }
    } else {
      // On approve, only clear reason if there's no manual points adjustment
      // We'll update each tweet individually to preserve manual points reasons
      const { data: tweets } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select("id, manual_points_adjustment, manual_points_reason")
        .eq("contest_id", contestId)
        .eq("creator_id", creatorId);

      if (tweets) {
        for (const tweet of tweets) {
          const individualUpdate: any = {
            moderation_status: moderationStatus,
          };
          // Only clear reason if there's no manual points adjustment
          if (!tweet.manual_points_adjustment || tweet.manual_points_adjustment === 0) {
            individualUpdate.manual_points_reason = null;
          }
          await supabaseAdmin
            .from("twitter_campaign_tweets")
            .update(individualUpdate)
            .eq("id", tweet.id);
        }
      }
    }

    // Trigger leaderboard recalculation
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      await fetch(`${baseUrl}/api/contests/${contestId}/twitter-refresh-tweets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (refreshError) {
      console.error("[moderate-creator] Error refreshing leaderboard:", refreshError);
      // Don't fail the request if leaderboard refresh fails
    }

    return NextResponse.json({
      success: true,
      message: `Creator ${action === "approve" ? "approved" : "rejected"} successfully`,
    });
  } catch (error: any) {
    console.error("[moderate-creator] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

