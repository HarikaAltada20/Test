import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  debitCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";

/**
 * POST /api/contests/[id]/moderate-submission
 *
 * Accept or reject a Twitter campaign tweet
 * Note: This is for Twitter campaigns only (automated fetching system)
 * For manual submissions (YouTube/Instagram), use the existing verify-submission endpoint
 *
 * Body:
 * - tweetId: string (twitter_campaign_tweets.id)
 * - action: "approve" | "reject" | "pending" | "paid"
 * - reason?: string (required for reject)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    const { tweetId, action, reason } = await request.json();

    const validActions = ["approve", "reject", "pending", "paid"];
    if (!tweetId || !action || !validActions.includes(action)) {
      return NextResponse.json(
        {
          error: `tweetId and action (${validActions.join("/")}) are required`,
        },
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

    // Get contest to verify ownership and type (for CPM reversal)
    let contestQuery = supabase
      .from("contests")
      .select("id, advertiser_id, platform, contest_type, title")
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

    // Fetch current tweet state before any update (for per-tweet reversal)
    const { data: currentTweet, error: tweetFetchError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("id, creator_id, moderation_status")
      .eq("id", tweetId)
      .eq("contest_id", contestId)
      .single();

    if (tweetFetchError || !currentTweet) {
      return NextResponse.json(
        { error: "Tweet not found for this contest" },
        { status: 404 }
      );
    }

    const platform = (contest as any).platform?.toLowerCase();
    const isTwitterCpm =
      (platform === "twitter" || platform === "x") &&
      (contest as any).contest_type === "cpm";

    // Per-tweet reversal: when changing a paid CPM tweet away from paid, debit creator by that tweet's paid amount
    if (
      currentTweet.moderation_status === "paid" &&
      action !== "paid" &&
      isTwitterCpm &&
      currentTweet.creator_id
    ) {
      const creatorId = currentTweet.creator_id;

      // Amount paid for this tweet = rewards for this tweet - refunds for this tweet
      const [
        { data: rewardTxns, error: rewardErr },
        { data: refundTxns, error: refundErr },
      ] = await Promise.all([
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount")
          .eq("user_id", creatorId)
          .eq("type", "reward")
          .contains("metadata", { contest_id: contestId, tweet_id: tweetId }),
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount")
          .eq("user_id", creatorId)
          .eq("type", "refund")
          .contains("metadata", { contest_id: contestId, tweet_id: tweetId }),
      ] as any);

      if (rewardErr || refundErr) {
        const msg = rewardErr?.message || refundErr?.message || "unknown";
        return NextResponse.json(
          { error: `Failed to fetch transactions for reversal: ${msg}` },
          { status: 500 }
        );
      }

      const totalRewards = (rewardTxns || []).reduce(
        (sum: number, tx: any) => sum + (tx.amount || 0),
        0
      );
      const totalRefunds = (refundTxns || []).reduce(
        (sum: number, tx: any) => sum + (tx.amount || 0),
        0
      );
      const reversalAmount = Math.max(0, totalRewards - totalRefunds);

      if (reversalAmount > 0) {
        const debitRes = await debitCreatorWithdrawableBalance(
          creatorId,
          reversalAmount
        );
        if (!debitRes.success) {
          return NextResponse.json(
            { error: `Failed to reverse tweet payment: ${debitRes.error}` },
            { status: 500 }
          );
        }

        await logTransactionAsAdmin(
          creatorId,
          "refund",
          reversalAmount,
          "success",
          `Reversal of Twitter CPM tweet reward - ${(contest as any)?.title || "Contest"}`,
          {
            remarks: REVERSAL_TRANSACTION_REMARK,
            paymentMethod: "refund",
            metadata: {
              contest_id: contestId,
              twitter_creator_id: creatorId,
              tweet_id: tweetId,
              payout_type: "twitter_cpm_tweet_reversal",
            },
          }
        );

        // Decrement leaderboard earnings for this creator
        const { data: leaderboardEntry } = await supabaseAdmin
          .from("twitter_campaign_leaderboard")
          .select("id, earnings")
          .eq("contest_id", contestId)
          .eq("creator_id", creatorId)
          .single();

        if (leaderboardEntry) {
          const currentEarnings = leaderboardEntry.earnings ?? 0;
          await supabaseAdmin
            .from("twitter_campaign_leaderboard")
            .update({
              earnings: Math.max(0, currentEarnings - reversalAmount),
            })
            .eq("id", leaderboardEntry.id);
        }
      }
    }

    const moderationStatus =
      action === "approve"
        ? "verified"
        : action === "reject"
        ? "rejected"
        : action === "paid"
        ? "paid"
        : "pending";

    // Update Twitter campaign tweet
    const updateData: any = {
      moderation_status: moderationStatus,
    };

    if (action === "reject") {
      // Store rejection reason in manual_points_reason field
      updateData.manual_points_reason = reason;
    } else if (action !== "paid") {
      // Clear reason on approve/pending (unless there's a manual points adjustment)
      const { data: existingTweet } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select("manual_points_adjustment, manual_points_reason")
        .eq("id", tweetId)
        .single();

      if (
        !existingTweet?.manual_points_adjustment ||
        existingTweet.manual_points_adjustment === 0
      ) {
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
    if (currentTweet?.creator_id) {
      // Trigger leaderboard recalculation by calling the refresh endpoint on the current host
      const requestUrl = new URL(request.url);
      const origin = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
      try {
        await fetch(
          `${origin}/api/contests/${contestId}/twitter-refresh-tweets`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (refreshError) {
        console.error(
          "[moderate-submission] Error refreshing leaderboard:",
          refreshError
        );
        // Don't fail the request if leaderboard refresh fails
      }
    }

    const actionMessage =
      action === "approve"
        ? "approved"
        : action === "reject"
        ? "rejected"
        : action === "paid"
        ? "marked as paid"
        : "set to pending";
    return NextResponse.json({
      success: true,
      message: `Tweet ${actionMessage} successfully`,
    });
  } catch (error: any) {
    console.error("[moderate-submission] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
