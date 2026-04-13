import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  debitCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import { syncTwitterLeaderboardFromTweets } from "@/lib/twitter/sync-twitter-leaderboard-from-tweets";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";

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
      .select("id, creator_id, moderation_status, earnings")
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

      // Fetch all rewards and refunds for this tweet so we can split reward-granted vs bonus
      const [
        { data: rewardTxns, error: rewardErr },
        { data: refundTxns, error: refundErr },
      ] = await Promise.all([
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount, metadata")
          .eq("user_id", creatorId)
          .eq("type", "reward")
          .contains("metadata", { contest_id: contestId, tweet_id: tweetId }),
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount, metadata, remarks")
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

      // Tweet CPM reward (reward granted) = rewards without bonus_type; exclude flat_fee bonus
      const tweetRewardTxns = (rewardTxns || []).filter(
        (tx: any) =>
          !(tx.metadata && (tx.metadata as any).bonus_type === "flat_fee")
      );
      const tweetRefundTxns = (refundTxns || []).filter(
        (tx: any) =>
          !(tx.metadata && (tx.metadata as any).bonus_type === "flat_fee") &&
          (!tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK)
      );
      const tweetRewardSum = tweetRewardTxns.reduce(
        (sum: number, tx: any) => sum + (tx.amount || 0),
        0
      );
      const tweetRefundSum = tweetRefundTxns.reduce(
        (sum: number, tx: any) => sum + (tx.amount || 0),
        0
      );
      const tweetReversalAmount = Math.max(0, tweetRewardSum - tweetRefundSum);

      // CPM to reverse: prefer net from money_transactions (per-tweet metadata).
      // Fallback: stored twitter_campaign_tweets.earnings when payouts used bulk metadata
      // without per-tweet tweet_id on the reward row (idempotent after first refund logs tweet_id).
      const storedCpmCents = Math.round(
        Number((currentTweet as any).earnings) || 0,
      );
      let cpmReversalCents = tweetReversalAmount;
      if (cpmReversalCents <= 0 && storedCpmCents > 0) {
        cpmReversalCents = storedCpmCents;
      }

      // Flat fee bonus = rewards/refunds with bonus_type "flat_fee"
      const bonusRewardTxns = (rewardTxns || []).filter(
        (tx: any) =>
          tx.metadata && (tx.metadata as any).bonus_type === "flat_fee"
      );
      const bonusRefundTxns = (refundTxns || []).filter(
        (tx: any) =>
          tx.metadata &&
          (tx.metadata as any).bonus_type === "flat_fee" &&
          (!tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK)
      );
      const bonusRewardSum = bonusRewardTxns.reduce(
        (sum: number, tx: any) => sum + (tx.amount || 0),
        0
      );
      const bonusRefundSum = bonusRefundTxns.reduce(
        (sum: number, tx: any) => sum + (tx.amount || 0),
        0
      );
      const bonusReversalAmount = Math.max(0, bonusRewardSum - bonusRefundSum);

      const totalReversalAmount = cpmReversalCents + bonusReversalAmount;

      if (totalReversalAmount > 0) {
        const debitRes = await debitCreatorWithdrawableBalance(
          creatorId,
          totalReversalAmount
        );
        if (!debitRes.success) {
          return NextResponse.json(
            { error: `Failed to reverse tweet payment: ${debitRes.error}` },
            { status: 500 }
          );
        }

        const contestTitle = (contest as any)?.title || "Contest";

        // Log reward-granted reversal (CPM tweet reward) so cash transaction shows correct value
        if (cpmReversalCents > 0) {
          const logged = await logTransactionAsAdmin(
            creatorId,
            "refund",
            cpmReversalCents,
            "success",
            `Reversal of Twitter CPM tweet reward - ${contestTitle}`,
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
          if (!logged) {
            console.error(
              "[moderate-submission] Failed to log tweet reward refund for tweet:",
              tweetId,
              "amount:",
              cpmReversalCents
            );
            return NextResponse.json(
              {
                error:
                  "Reversal debit succeeded but failed to log reward refund in transaction history.",
              },
              { status: 500 }
            );
          }
        }

        // Log bonus reversal separately so cash transaction shows bonus amount correctly
        if (bonusReversalAmount > 0) {
          const logged = await logTransactionAsAdmin(
            creatorId,
            "refund",
            bonusReversalAmount,
            "success",
            `Reversal of Twitter contest flat-fee bonus - ${contestTitle}`,
            {
              remarks: REVERSAL_TRANSACTION_REMARK,
              paymentMethod: "refund",
              metadata: {
                contest_id: contestId,
                twitter_creator_id: creatorId,
                tweet_id: tweetId,
                bonus_type: "flat_fee",
              },
            }
          );
          if (!logged) {
            console.error(
              "[moderate-submission] Failed to log bonus refund for tweet:",
              tweetId,
              "amount:",
              bonusReversalAmount
            );
            return NextResponse.json(
              {
                error:
                  "Reversal debit succeeded but failed to log bonus refund in transaction history.",
              },
              { status: 500 }
            );
          }
        }

        // Decrement leaderboard CPM aggregate only (atomic; safe for concurrent reversals)
        if (cpmReversalCents > 0) {
          const { error: rpcErr } = await supabaseAdmin.rpc(
            "add_twitter_leaderboard_cpm_earnings_delta",
            {
              p_contest_id: contestId,
              p_creator_id: creatorId,
              p_delta_cents: -cpmReversalCents,
            }
          );
          if (rpcErr) {
            console.error(
              "[moderate-submission] Leaderboard earnings delta RPC failed:",
              rpcErr
            );
            return NextResponse.json(
              {
                error:
                  "Reversal processed but failed to update leaderboard earnings. Please retry or contact support.",
              },
              { status: 500 }
            );
          }
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

    // Leaving "paid": clear stored CPM cents so SSR/UI never show stale granted amounts
    if (
      isTwitterCpm &&
      currentTweet.moderation_status === "paid" &&
      action !== "paid"
    ) {
      updateData.earnings = null;
    }

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

    // DB-only leaderboard recompute (no Twitter/RapidAPI; preserve refresh cooldown metadata)
    if (currentTweet?.creator_id) {
      try {
        await syncTwitterLeaderboardFromTweets(contestId, supabaseAdmin, {
          preserveRefreshMetadata: true,
        });
        revalidateLeaderboardCache(contestId);
      } catch (refreshError) {
        console.error(
          "[moderate-submission] Error syncing leaderboard:",
          refreshError
        );
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
