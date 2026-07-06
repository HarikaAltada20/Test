import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  debitCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import {
  sumBonusRewards,
  sumBonusRefunds,
} from "@/lib/twitter-bonus-accounting";
import { syncTwitterLeaderboardFromTweets } from "@/lib/twitter/sync-twitter-leaderboard-from-tweets";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import {
  postContestStatusLocksSubmissionModeration,
  SUBMISSION_MODERATION_LOCKED_MESSAGE,
} from "@/lib/post-contest-moderation-lock";

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      .select("id, advertiser_id, post_contest_status")
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

    if (postContestStatusLocksSubmissionModeration(contest.post_contest_status)) {
      return NextResponse.json(
        { error: SUBMISSION_MODERATION_LOCKED_MESSAGE },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();

    let refund: {
      mainCents: number;
      bonusCents: number;
      totalCents: number;
    } | null = null;

    const moderationStatus = action === "approve" ? "verified" : "rejected";

    // Get current leaderboard entry to check if creator is paid
    const { data: currentLeaderboardEntry, error: fetchError } =
      await supabaseAdmin
        .from("twitter_campaign_leaderboard")
        .select("moderation_status, earnings")
        .eq("contest_id", contestId)
        .eq("creator_id", creatorId)
        .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 is "not found", which is acceptable
      console.error(
        "[moderate-creator] Error fetching leaderboard entry:",
        fetchError
      );
      return NextResponse.json(
        { error: "Failed to fetch leaderboard entry" },
        { status: 500 }
      );
    }

    // Handle payment reversal if creator is currently paid and status is being changed away from paid
    if (currentLeaderboardEntry?.moderation_status === "paid") {
      let mainReversalAmount = currentLeaderboardEntry.earnings || 0;

      if (!mainReversalAmount || mainReversalAmount <= 0) {
        // Fallback: main reward = rewards (contest_id + twitter_creator_id) - prior main reversals (refunds without bonus_type)
        const [
          { data: rewardTxns, error: rewardErr },
          { data: mainRefundTxns, error: refundErr },
        ] = await Promise.all([
          supabaseAdmin
            .from("money_transactions")
            .select("id, amount")
            .eq("user_id", creatorId)
            .eq("type", "reward")
            .contains("metadata", {
              contest_id: contestId,
              twitter_creator_id: creatorId,
            }),
          supabaseAdmin
            .from("money_transactions")
            .select("id, amount, remarks, metadata")
            .eq("user_id", creatorId)
            .eq("type", "refund")
            .contains("metadata", {
              contest_id: contestId,
              twitter_creator_id: creatorId,
            }),
        ] as any);

        if (rewardErr || refundErr) {
          const message = rewardErr?.message || refundErr?.message || "unknown";
          return NextResponse.json(
            { error: `Failed to fetch transactions for reversal: ${message}` },
            { status: 500 }
          );
        }

        const totalMainRewards = (rewardTxns || []).reduce(
          (sum: number, tx: any) => sum + (tx.amount || 0),
          0
        );
        const mainRefunds = (mainRefundTxns || []).filter(
          (tx: any) =>
            (!tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK) &&
            !(tx.metadata && (tx.metadata as any).bonus_type)
        );
        const totalMainReversals = mainRefunds.reduce(
          (sum: number, tx: any) => sum + (tx.amount || 0),
          0
        );
        mainReversalAmount = Math.max(0, totalMainRewards - totalMainReversals);
      }

      // Bonus reversal: flat_fee bonuses credited for this creator+contest minus any
      // already reversed. Twitter CPM bulk payouts (`payout_type=twitter_cpm_bulk`)
      // pack `CPM + bonus` into `amount`, with the bonus-only slice in
      // `metadata.total_bonus`. Summing `amount` would refund CPM twice (once via
      // mainReversalAmount, again here), so we use bonus-only accounting.
      const [
        { data: bonusRewardTxns, error: bonusRewardErr },
        { data: bonusRefundTxns, error: bonusRefundErr },
      ] = await Promise.all([
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount, metadata")
          .eq("user_id", creatorId)
          .eq("type", "reward")
          .contains("metadata", {
            contest_id: contestId,
            bonus_type: "flat_fee",
          }),
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount, metadata, remarks")
          .eq("user_id", creatorId)
          .eq("type", "refund")
          .contains("metadata", {
            contest_id: contestId,
            bonus_type: "flat_fee",
          }),
      ] as any);

      if (bonusRewardErr || bonusRefundErr) {
        const message =
          bonusRewardErr?.message || bonusRefundErr?.message || "unknown";
        return NextResponse.json(
          {
            error: `Failed to fetch bonus transactions for reversal: ${message}`,
          },
          { status: 500 }
        );
      }

      const bonusCredited = sumBonusRewards(bonusRewardTxns || []);
      const bonusAlreadyReversed = sumBonusRefunds(bonusRefundTxns || [], {
        reversalRemark: REVERSAL_TRANSACTION_REMARK,
      });
      const bonusReversalAmount = Math.max(
        0,
        bonusCredited - bonusAlreadyReversed
      );

      const totalReversalAmount = mainReversalAmount + bonusReversalAmount;

      if (totalReversalAmount > 0) {
        const debitRes = await debitCreatorWithdrawableBalance(
          creatorId,
          totalReversalAmount
        );
        if (!debitRes.success) {
          return NextResponse.json(
            { error: `Failed to reverse creator credit: ${debitRes.error}` },
            { status: 500 }
          );
        }

        const contestTitle = (contest as any)?.title || "Contest";

        if (mainReversalAmount > 0) {
          const mainRefundLogged = await logTransactionAsAdmin(
            creatorId,
            "refund",
            mainReversalAmount,
            "success",
            `Reversal of Twitter CPM creator reward — ${contestTitle}`,
            {
              remarks: REVERSAL_TRANSACTION_REMARK,
              paymentMethod: "refund",
              metadata: {
                contest_id: contestId,
                twitter_creator_id: creatorId,
              },
            }
          );
          if (!mainRefundLogged) {
            console.error(
              "[moderate-creator] Failed to log main reward refund for creator:",
              creatorId,
              "amount:",
              mainReversalAmount
            );
            return NextResponse.json(
              {
                error:
                  "Reversal debit succeeded but failed to log reward refund in transaction history. Please contact support.",
              },
              { status: 500 }
            );
          }
        }

        if (bonusReversalAmount > 0) {
          const bonusRefundLogged = await logTransactionAsAdmin(
            creatorId,
            "refund",
            bonusReversalAmount,
            "success",
            `Reversal of Twitter CPM bonus — ${contestTitle}`,
            {
              remarks: REVERSAL_TRANSACTION_REMARK,
              paymentMethod: "refund",
              metadata: {
                contest_id: contestId,
                twitter_creator_id: creatorId,
                bonus_type: "flat_fee",
              },
            }
          );
          if (!bonusRefundLogged) {
            console.error(
              "[moderate-creator] Failed to log bonus refund for creator:",
              creatorId,
              "amount:",
              bonusReversalAmount
            );
            return NextResponse.json(
              {
                error:
                  "Reversal debit succeeded but failed to log bonus refund in transaction history. Please contact support.",
              },
              { status: 500 }
            );
          }
        }

        refund = {
          mainCents: mainReversalAmount,
          bonusCents: bonusReversalAmount,
          totalCents: mainReversalAmount + bonusReversalAmount,
        };
      }
    }

    // Update twitter_campaign_leaderboard
    const leaderboardUpdateData: any = {
      moderation_status: moderationStatus,
    };

    if (action === "reject") {
      leaderboardUpdateData.rejection_reason = reason;
    } else {
      leaderboardUpdateData.rejection_reason = null;
    }

    // Clear payment metadata if creator was paid (reversal handled above; moderation_status becomes verified/rejected)
    if (currentLeaderboardEntry?.moderation_status === "paid") {
      leaderboardUpdateData.paid_at = null;
      leaderboardUpdateData.earnings = null;
      leaderboardUpdateData.paid_rank = null;
    }

    const { error: leaderboardUpdateError } = await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .update(leaderboardUpdateData)
      .eq("contest_id", contestId)
      .eq("creator_id", creatorId);

    if (leaderboardUpdateError) {
      console.error(
        "[moderate-creator] Error updating leaderboard:",
        leaderboardUpdateError
      );
      return NextResponse.json(
        { error: "Failed to update leaderboard" },
        { status: 500 }
      );
    }

    // If the creator was paid before this moderation, the wallet credit + bonus were
    // reversed above. Clear bonus state on every tweet for this creator+contest so
    // twitter_campaign_tweets matches money_transactions — otherwise rows still show
    // bonus_paid=true even though no bonus is on record.
    if (currentLeaderboardEntry?.moderation_status === "paid") {
      const { error: tweetBonusClearError } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .update({
          bonus_paid: false,
          bonus_paid_at: null,
          bonus_amount: null,
          earnings: null,
        })
        .eq("contest_id", contestId)
        .eq("creator_id", creatorId);

      if (tweetBonusClearError) {
        console.error(
          "[moderate-creator] Error clearing tweet bonus columns after reversal:",
          tweetBonusClearError,
        );
      }
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
        console.error(
          "[moderate-creator] Error updating tweets:",
          tweetUpdateError
        );
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
          if (
            !tweet.manual_points_adjustment ||
            tweet.manual_points_adjustment === 0
          ) {
            individualUpdate.manual_points_reason = null;
          }
          await supabaseAdmin
            .from("twitter_campaign_tweets")
            .update(individualUpdate)
            .eq("id", tweet.id);
        }
      }
    }

    try {
      await syncTwitterLeaderboardFromTweets(contestId, supabaseAdmin, {
        preserveRefreshMetadata: true,
      });
      revalidateLeaderboardCache(contestId);
    } catch (refreshError) {
      console.error(
        "[moderate-creator] Error syncing leaderboard:",
        refreshError
      );
    }

    return NextResponse.json({
      success: true,
      message: `Creator ${
        action === "approve" ? "approved" : "rejected"
      } successfully`,
      refund,
    });
  } catch (error: any) {
    console.error("[moderate-creator] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
