import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

/**
 * POST /api/contests/[id]/adjust-manual-points
 * 
 * Add or subtract manual points for Twitter campaign tweets
 * Note: This is for Twitter campaigns only (automated fetching system)
 * 
 * Body:
 * - adjustmentType: "twitter_tweet" | "twitter_leaderboard"
 * - tweetId?: string (for twitter_tweet - individual tweet adjustment)
 * - creatorId?: string (for twitter_leaderboard - applies to all their tweets)
 * - points: number (can be positive or negative)
 * - reason: string (required)
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
    const { adjustmentType, tweetId, creatorId, points, reason } = await request.json();

    // Validate input
    if (!adjustmentType || !["twitter_tweet", "twitter_leaderboard"].includes(adjustmentType)) {
      return NextResponse.json(
        { error: "Invalid adjustmentType. Must be 'twitter_tweet' or 'twitter_leaderboard'" },
        { status: 400 }
      );
    }

    if (typeof points !== "number" || isNaN(points)) {
      return NextResponse.json(
        { error: "points must be a valid number" },
        { status: 400 }
      );
    }

    if (!reason || reason.trim() === "") {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    if (adjustmentType === "twitter_leaderboard" && !creatorId) {
      return NextResponse.json(
        { error: "creatorId is required for twitter_leaderboard" },
        { status: 400 }
      );
    }

    if (adjustmentType === "twitter_tweet" && !tweetId) {
      return NextResponse.json(
        { error: "tweetId is required for twitter_tweet" },
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

    if (adjustmentType === "twitter_tweet") {
      // Update Twitter tweet manual points
      const { error: updateError } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .update({
          manual_points_adjustment: points,
          manual_points_reason: reason,
        })
        .eq("id", tweetId)
        .eq("contest_id", contestId);

      if (updateError) {
        console.error("[adjust-manual-points] Error updating tweet:", updateError);
        return NextResponse.json(
          { error: "Failed to update tweet points" },
          { status: 500 }
        );
      }

      // Recalculate leaderboard for this creator
      // Get the creator_id from the tweet
      const { data: tweet } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select("creator_id")
        .eq("id", tweetId)
        .single();

      if (tweet?.creator_id) {
        await recalculateTwitterLeaderboard(contestId, tweet.creator_id, supabaseAdmin);
      }
    } else if (adjustmentType === "twitter_leaderboard") {
      // Update leaderboard manual points (applies to all tweets for this creator)
      const { error: updateError } = await supabaseAdmin
        .from("twitter_campaign_leaderboard")
        .update({
          manual_points_adjustment: points,
          manual_points_reason: reason,
        })
        .eq("contest_id", contestId)
        .eq("creator_id", creatorId);

      if (updateError) {
        console.error("[adjust-manual-points] Error updating leaderboard:", updateError);
        return NextResponse.json(
          { error: "Failed to update leaderboard points" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Manual points adjusted successfully",
    });
  } catch (error: any) {
    console.error("[adjust-manual-points] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

/**
 * Recalculate Twitter leaderboard for a specific creator
 * This aggregates points from all their tweets (including manual adjustments)
 */
async function recalculateTwitterLeaderboard(
  contestId: string,
  creatorId: string,
  supabaseAdmin: any
): Promise<void> {
  // Get all tweets for this creator
  const { data: tweets } = await supabaseAdmin
    .from("twitter_campaign_tweets")
    .select("points, manual_points_adjustment")
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId)
    .eq("is_eligible", true)
    .in("moderation_status", ["pending", "verified"]); // Only count pending/verified

  // Calculate total points (base points + manual adjustments)
  let totalPoints = 0;
  let totalEligibleTweets = 0;

  if (tweets) {
    tweets.forEach((tweet: any) => {
      const basePoints = tweet.points || 0;
      const manualAdjustment = tweet.manual_points_adjustment || 0;
      totalPoints += basePoints + manualAdjustment;
      totalEligibleTweets += 1;
    });
  }

  // Get existing leaderboard entry
  const { data: existingLeaderboard } = await supabaseAdmin
    .from("twitter_campaign_leaderboard")
    .select("manual_points_adjustment")
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  // Add leaderboard-level manual adjustment if exists
  const leaderboardManualAdjustment = existingLeaderboard?.manual_points_adjustment || 0;
  totalPoints += leaderboardManualAdjustment;

  // Get existing entry to preserve refresh_count
  const { data: existingEntry } = await supabaseAdmin
    .from("twitter_campaign_leaderboard")
    .select("refresh_count")
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  // Update or create leaderboard entry
  await supabaseAdmin
    .from("twitter_campaign_leaderboard")
    .upsert(
      {
        contest_id: contestId,
        creator_id: creatorId,
        total_points: totalPoints,
        total_eligible_tweets: totalEligibleTweets,
        last_refreshed_at: new Date().toISOString(),
        // Preserve refresh_count if it exists, otherwise default to 0
        refresh_count: existingEntry?.refresh_count ?? 0,
      },
      {
        onConflict: "contest_id,creator_id",
      }
    );

  // Re-rank all creators
  await rerankTwitterLeaderboard(contestId, supabaseAdmin);
}

/**
 * Re-rank all creators in the leaderboard
 */
async function rerankTwitterLeaderboard(
  contestId: string,
  supabaseAdmin: any
): Promise<void> {
  const { data: allEntries } = await supabaseAdmin
    .from("twitter_campaign_leaderboard")
    .select("creator_id, total_points")
    .eq("contest_id", contestId)
    .order("total_points", { ascending: false });

  if (!allEntries) return;

  // Update ranks
  const updates = allEntries.map((entry: any, index: number) => ({
    contest_id: contestId,
    creator_id: entry.creator_id,
    current_rank: index + 1,
  }));

  for (const update of updates) {
    await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .update({ current_rank: update.current_rank })
      .eq("contest_id", update.contest_id)
      .eq("creator_id", update.creator_id);
  }
}

