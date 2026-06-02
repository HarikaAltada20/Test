import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  creditCreatorWithdrawableBalance,
  debitCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import { adjustRewardCents, parsePayoutAdjustment } from "@/lib/payout-rules";

/**
 * POST /api/contests/[id]/pay-twitter-tweet
 *
 * Pay for a single Twitter CPM tweet (per-tweet payment).
 * When marking a specific tweet as paid in the creator submission modal,
 * only that tweet's reward is granted and added to the creator's withdrawal balance.
 *
 * Body:
 * - tweetId: string (twitter_campaign_tweets.id, required)
 * - paymentProofUrl?: string (optional, custom pay)
 * - paymentDescription?: string (optional, custom pay)
 * - amountInCents?: number (optional, custom amount; used when isCustom is true)
 * - isCustom?: boolean (optional; when true, use amountInCents instead of CPM calculation)
 * - customRemarks?: string (optional)
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
    const {
      tweetId,
      paymentProofUrl,
      paymentDescription,
      amountInCents: customAmountInCents,
      isCustom,
      customRemarks,
    } = await request.json();

    if (!tweetId) {
      return NextResponse.json(
        { error: "tweetId is required" },
        { status: 400 }
      );
    }

    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 }
      );
    }

    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select(
        "id, title, platform, contest_type, contest_based_details, post_contest_status, max_earnings_per_creator, payout_adjustment_percentage, payout_adjustment_mode"
      )
      .eq("id", contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const platform = contest.platform?.toLowerCase();
    if (platform !== "twitter" && platform !== "x") {
      return NextResponse.json(
        { error: "This endpoint is only for Twitter contests" },
        { status: 400 }
      );
    }

    if (contest.contest_type !== "cpm") {
      return NextResponse.json(
        {
          error:
            "Per-tweet payment is only for Twitter CPM contests. Use pay-twitter-creator for leaderboard.",
        },
        { status: 400 }
      );
    }

    if (contest.post_contest_status !== "verification_complete") {
      return NextResponse.json(
        {
          error:
            "Payments can only be processed when contest status is 'verification_complete'",
        },
        { status: 400 }
      );
    }

    const cpmContest = (contest.contest_based_details as any)?.cpm_contest;
    const payoutAdjustment = parsePayoutAdjustment(
      (contest as any).payout_adjustment_percentage,
      (contest as any).payout_adjustment_mode,
      { contestType: contest.contest_type },
    );
    if (!cpmContest || typeof cpmContest.cpm_rate_usd !== "number") {
      return NextResponse.json(
        { error: "CPM configuration is missing for this contest" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: tweet, error: tweetError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("id, creator_id, points, manual_points_adjustment, moderation_status")
      .eq("id", tweetId)
      .eq("contest_id", contestId)
      .single();

    if (tweetError || !tweet) {
      return NextResponse.json(
        { error: "Tweet not found for this contest" },
        { status: 404 }
      );
    }

    if (tweet.moderation_status === "rejected") {
      return NextResponse.json(
        { error: "Cannot pay a rejected tweet" },
        { status: 400 }
      );
    }

    if (tweet.moderation_status === "paid") {
      return NextResponse.json(
        { error: "This tweet has already been paid" },
        { status: 400 }
      );
    }

    const creatorId = tweet.creator_id;
    if (!creatorId) {
      return NextResponse.json(
        { error: "Tweet has no creator" },
        { status: 400 }
      );
    }

    // Already paid for this specific tweet? (idempotent) — allow re-pay after full refund
    const [
      { data: existingTweetRewards },
      { data: existingTweetRefunds },
    ] = await Promise.all([
      supabaseAdmin
        .from("money_transactions")
        .select("id, amount")
        .eq("user_id", creatorId)
        .eq("type", "reward")
        .contains("metadata", { contest_id: contestId, tweet_id: tweetId }),
      supabaseAdmin
        .from("money_transactions")
        .select("id, amount, remarks")
        .eq("user_id", creatorId)
        .eq("type", "refund")
        .contains("metadata", { contest_id: contestId, tweet_id: tweetId }),
    ] as any);

    const totalRewardsForTweet = (existingTweetRewards || []).reduce(
      (sum: number, row: any) => sum + (row.amount || 0),
      0
    );
    const totalRefundsForTweet = (existingTweetRefunds || [])
      .filter((row: any) => !row.remarks || row.remarks === REVERSAL_TRANSACTION_REMARK)
      .reduce((sum: number, row: any) => sum + (row.amount || 0), 0);
    const netPaidForTweet = totalRewardsForTweet - totalRefundsForTweet;
    const canReconcileExistingReward =
      netPaidForTweet > 0 && tweet.moderation_status !== "paid";
    if (netPaidForTweet > 0 && !canReconcileExistingReward) {
      return NextResponse.json(
        { error: "This tweet has already been paid", alreadyPaid: true },
        { status: 400 }
      );
    }

    const useCustomAmount =
      isCustom && customAmountInCents != null && customAmountInCents > 0;
    let rewardAmount: number;

    if (useCustomAmount) {
      rewardAmount = Math.round(Number(customAmountInCents));
      if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
        return NextResponse.json(
          { error: "Custom amount must be greater than zero" },
          { status: 400 }
        );
      }
    } else {
      // Include manual_points_adjustment so reward matches expected reward in UI
      const basePoints = tweet.points || 0;
      const manualAdjustment = tweet.manual_points_adjustment || 0;
      const totalPoints = Math.max(0, basePoints + manualAdjustment);
      const rate = cpmContest.cpm_rate_usd;
      rewardAmount = Math.round((totalPoints * rate * 100) / 1000);

      rewardAmount = adjustRewardCents(rewardAmount, {
        shouldAdjustReward: payoutAdjustment.shouldAdjustReward,
        percentage: payoutAdjustment.percentage,
      });

      if (rewardAmount <= 0) {
        return NextResponse.json(
          { error: "Tweet has no points or reward amount is zero" },
          { status: 400 }
        );
      }

      const maxEarningsPerCreator =
        (contest as any).max_earnings_per_creator ??
        cpmContest.max_earnings_per_creator ??
        null;

      if (maxEarningsPerCreator != null) {
        const [
          { data: creatorRewards },
          { data: creatorRefunds },
        ] = await Promise.all([
          supabaseAdmin
            .from("money_transactions")
            .select("amount, metadata")
            .eq("user_id", creatorId)
            .eq("type", "reward")
            .contains("metadata", {
              contest_id: contestId,
              twitter_creator_id: creatorId,
            }),
          supabaseAdmin
            .from("money_transactions")
            .select("amount, metadata, remarks")
            .eq("user_id", creatorId)
            .eq("type", "refund")
            .contains("metadata", {
              contest_id: contestId,
              twitter_creator_id: creatorId,
            }),
        ] as any);

        const cpmAmountForHistoryRow = (row: any) => {
          const metadata = row?.metadata || {};
          if (metadata.payout_type === "twitter_cpm_bulk") {
            const totalCpm = Number(metadata.total_cpm);
            return Number.isFinite(totalCpm) && totalCpm > 0 ? totalCpm : 0;
          }
          return Number(row?.amount) || 0;
        };
        const isCreatorCpmHistory = (row: any) => {
          const payoutType = String(row?.metadata?.payout_type || "");
          return (
            payoutType === "twitter_cpm_bulk" ||
            payoutType === "twitter_cpm_tweet" ||
            payoutType === "twitter_cpm_tweet_custom" ||
            payoutType === "twitter_cpm_creator" ||
            payoutType === "standard_cpm"
          );
        };
        const totalCreatorRewards = (creatorRewards || [])
          .filter(isCreatorCpmHistory)
          .reduce(
            (sum: number, row: any) => sum + cpmAmountForHistoryRow(row),
            0
          );
        const totalCreatorRefunds = (creatorRefunds || [])
          .filter(
            (row: any) =>
              (!row.remarks || row.remarks === REVERSAL_TRANSACTION_REMARK) &&
              isCreatorCpmHistory(row),
          )
          .reduce(
            (sum: number, row: any) => sum + cpmAmountForHistoryRow(row),
            0
          );
        const alreadyCredited = Math.max(
          0,
          totalCreatorRewards - totalCreatorRefunds
        );
        const remaining = maxEarningsPerCreator - alreadyCredited;
        if (remaining <= 0) {
          return NextResponse.json(
            {
              error:
                "Creator has already reached max earnings for this contest",
            },
            { status: 400 }
          );
        }
        rewardAmount = Math.min(rewardAmount, remaining);
      }
    }

    const rewardsCount = (existingTweetRewards || []).length;
    const refundsCount = (existingTweetRefunds || [])
      .filter((r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK)
      .length;
    const nextCycle = rewardsCount > refundsCount ? rewardsCount : rewardsCount + 1;

    const twitterTweetPayKey = useCustomAmount
      ? `twitter_tweet_pay:v2:${contestId}:${tweetId}:cycle:${nextCycle}:amt:${rewardAmount}`
      : `twitter_tweet_pay:v2:${contestId}:${tweetId}:cycle:${nextCycle}`;

    const creditRes: {
      success: boolean;
      transactionId?: string;
      alreadyApplied?: boolean;
      error?: string;
    } = canReconcileExistingReward
      ? {
          success: true,
          transactionId: existingTweetRewards?.[0]?.id,
          alreadyApplied: true,
        }
      : await creditCreatorWithdrawableBalance(
          creatorId,
          rewardAmount,
          useCustomAmount
            ? `Custom tweet payment - ${contest.title || "Contest"}`
            : `Twitter CPM tweet reward - ${contest.title || "Contest"}`,
          {
            idempotencyKey: twitterTweetPayKey,
            remarks:
              customRemarks?.trim() ||
              (useCustomAmount
                ? "Custom per-tweet payout credited to creator wallet"
                : "Per-tweet CPM payout credited to creator wallet"),
            metadata: {
              contest_id: contestId,
              twitter_creator_id: creatorId,
              tweet_id: tweetId,
              payout_type: useCustomAmount ? "twitter_cpm_tweet_custom" : "twitter_cpm_tweet",
              payout_cycle: nextCycle,
              prize_amount: rewardAmount,
              ...(useCustomAmount ? { is_custom: true } : {}),
              ...(tweet.points != null ? { points: (tweet.points || 0) + (tweet.manual_points_adjustment || 0) } : {}),
              ...(paymentProofUrl?.trim()
                ? { paymentProofUrl: paymentProofUrl.trim() }
                : {}),
              ...(paymentDescription?.trim()
                ? { paymentDescription: paymentDescription.trim() }
                : {}),
            },
          }
        );

    if (!creditRes.success) {
      return NextResponse.json(
        { error: `Failed to credit creator: ${creditRes.error}` },
        { status: 500 }
      );
    }

    const { data: updatedTweetRows, error: updateTweetErr } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .update({ moderation_status: "paid", earnings: rewardAmount })
      .eq("id", tweetId)
      .eq("contest_id", contestId)
      .neq("moderation_status", "paid")
      .select("id")
      .maybeSingle();

    if (updateTweetErr || !updatedTweetRows?.length) {
      console.error(
        "[pay-twitter-tweet] Error updating tweet:",
        updateTweetErr
      );
      if (!creditRes.alreadyApplied) {
        const debitRes = await debitCreatorWithdrawableBalance(
          creatorId,
          rewardAmount,
        );
        if (debitRes.success) {
          await logTransactionAsAdmin(
            creatorId,
            "refund",
            rewardAmount,
            "success",
            `Rollback: Twitter tweet payment row update failed - ${
              contest.title || "Contest"
            }`,
            {
              remarks: REVERSAL_TRANSACTION_REMARK,
              paymentMethod: "refund",
              metadata: {
                contest_id: contestId,
                twitter_creator_id: creatorId,
                tweet_id: tweetId,
                payout_type: "twitter_cpm_tweet_rollback",
                original_reward_transaction_id: creditRes.transactionId,
              },
            },
          );
        } else {
          console.error(
            "[pay-twitter-tweet] CRITICAL: wallet rollback failed after tweet update error:",
            debitRes.error,
          );
          return NextResponse.json(
            {
              error:
                "Tweet payment could not be saved and automatic wallet rollback failed. Contact support immediately.",
              details: debitRes.error,
            },
            { status: 500 },
          );
        }
      }
      return NextResponse.json(
        {
          error: creditRes.alreadyApplied
            ? "Tweet row could not be reconciled with an existing payout. Retry or contact support."
            : "Tweet payment could not be saved. Wallet credit was rolled back; retry after resolving the row state.",
        },
        { status: 500 }
      );
    }

    // CPM aggregate on leaderboard (atomic; safe for concurrent per-tweet pays)
    const { error: rpcErr } = await supabaseAdmin.rpc(
      "add_twitter_leaderboard_cpm_earnings_delta",
      {
        p_contest_id: contestId,
        p_creator_id: creatorId,
        p_delta_cents: rewardAmount,
      }
    );
    if (rpcErr) {
      console.error(
        "[pay-twitter-tweet] Leaderboard earnings delta RPC failed:",
        rpcErr
      );
      return NextResponse.json({
        success: true,
        warning:
          "Tweet payment was credited and marked paid, but leaderboard earnings could not be updated automatically.",
        amount: rewardAmount,
        tweetId,
        creatorId,
        transactionId: creditRes.transactionId,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Tweet payment processed successfully",
      amount: rewardAmount,
      tweetId,
      creatorId,
      transactionId: creditRes.transactionId,
    });
  } catch (error: any) {
    console.error("[pay-twitter-tweet] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
