import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { creditCreatorWithdrawableBalance } from "@/lib/payment-utils";

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
    if (!isAdmin && adminError) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select(
        "id, title, platform, contest_type, contest_based_details, post_contest_status, max_earnings_per_creator"
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
        .select("id, amount")
        .eq("user_id", creatorId)
        .eq("type", "refund")
        .contains("metadata", { contest_id: contestId, tweet_id: tweetId }),
    ] as any);

    const totalRewardsForTweet = (existingTweetRewards || []).reduce(
      (sum: number, row: any) => sum + (row.amount || 0),
      0
    );
    const totalRefundsForTweet = (existingTweetRefunds || []).reduce(
      (sum: number, row: any) => sum + (row.amount || 0),
      0
    );
    const netPaidForTweet = totalRewardsForTweet - totalRefundsForTweet;
    if (netPaidForTweet > 0) {
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
      if (rewardAmount <= 0) {
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
            .select("amount")
            .eq("user_id", creatorId)
            .eq("type", "reward")
            .contains("metadata", {
              contest_id: contestId,
              twitter_creator_id: creatorId,
            }),
          supabaseAdmin
            .from("money_transactions")
            .select("amount")
            .eq("user_id", creatorId)
            .eq("type", "refund")
            .contains("metadata", {
              contest_id: contestId,
              twitter_creator_id: creatorId,
            }),
        ] as any);

        const totalCreatorRewards = (creatorRewards || []).reduce(
          (sum: number, row: any) => sum + (row.amount || 0),
          0
        );
        const totalCreatorRefunds = (creatorRefunds || []).reduce(
          (sum: number, row: any) => sum + (row.amount || 0),
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

    const creditRes = await creditCreatorWithdrawableBalance(
      creatorId,
      rewardAmount,
      useCustomAmount
        ? `Custom tweet payment - ${contest.title || "Contest"}`
        : `Twitter CPM tweet reward - ${contest.title || "Contest"}`,
      {
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

    const { error: updateTweetErr } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .update({ moderation_status: "paid" })
      .eq("id", tweetId)
      .eq("contest_id", contestId);

    if (updateTweetErr) {
      console.error(
        "[pay-twitter-tweet] Error updating tweet:",
        updateTweetErr
      );
      return NextResponse.json(
        { error: "Failed to update tweet payment status" },
        { status: 500 }
      );
    }

    // Update leaderboard earnings for this creator (sum of paid tweets; do not set paid/paid_at so only this tweet shows paid)
    const { data: leaderboardEntry } = await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .select("id, earnings")
      .eq("contest_id", contestId)
      .eq("creator_id", creatorId)
      .single();

    if (leaderboardEntry) {
      const currentEarnings = leaderboardEntry.earnings || 0;
      await supabaseAdmin
        .from("twitter_campaign_leaderboard")
        .update({ earnings: currentEarnings + rewardAmount })
        .eq("id", leaderboardEntry.id);
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
