import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  creditCreatorWithdrawableBalance,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";

/** Split total cents across rows by non-negative weights; remainder by largest fractional parts. Equal split when all weights are 0. */
function distributeCentsByWeights(
  weights: number[],
  totalCents: number
): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const amounts = new Array(n).fill(0);
  if (totalCents <= 0) return amounts;

  const totalW = weights.reduce((a, b) => a + b, 0);
  if (totalW > 0) {
    const rawFracs = weights.map((w) => (totalCents * w) / totalW);
    let allocated = 0;
    for (let i = 0; i < n; i++) {
      amounts[i] = Math.floor(rawFracs[i]);
      allocated += amounts[i];
    }
    let rem = totalCents - allocated;
    const order = rawFracs
      .map((r, i) => ({ i, f: r - amounts[i] }))
      .sort((a, b) => b.f - a.f);
    for (let k = 0; k < rem; k++) {
      amounts[order[k % n].i] += 1;
    }
    return amounts;
  }

  const base = Math.floor(totalCents / n);
  let rem = totalCents - base * n;
  for (let i = 0; i < n; i++) {
    amounts[i] = base + (i < rem ? 1 : 0);
  }
  return amounts;
}

/**
 * POST /api/contests/[id]/pay-twitter-creator
 *
 * Pay a creator for their rank in a Twitter leaderboard contest
 * Payment is stored at the creator level in twitter_campaign_leaderboard table
 *
 * Body:
 * - creatorId: string (required)
 * - amountInCents?: number (optional custom amount, otherwise calculated from rank prize)
 * - isCustom?: boolean (optional, defaults to false)
 * - paymentProofUrl?: string (optional)
 * - paymentDescription?: string (optional)
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
      creatorId,
      amountInCents,
      isCustom,
      paymentProofUrl,
      paymentDescription,
      customRemarks,
    } = await request.json();

    // Validate input
    if (!creatorId) {
      return NextResponse.json(
        { error: "creatorId is required" },
        { status: 400 }
      );
    }

    // Verify admin access
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin && adminError) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get contest to verify it's a Twitter contest (include max_earnings_per_creator for CPM cap)
    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select(
        "id, title, advertiser_id, platform, contest_type, contest_based_details, post_contest_status, max_earnings_per_creator"
      )
      .eq("id", contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Verify contest is Twitter/X platform
    const platform = contest.platform?.toLowerCase();
    if (platform !== "twitter" && platform !== "x") {
      return NextResponse.json(
        { error: "This endpoint is only for Twitter contests" },
        { status: 400 }
      );
    }

    // Verify contest type is leaderboard or CPM
    if (
      contest.contest_type !== "leaderboard" &&
      contest.contest_type !== "cpm"
    ) {
      return NextResponse.json(
        { error: "This endpoint is only for leaderboard or CPM contests" },
        { status: 400 }
      );
    }

    // Verify post_contest_status allows payment (only verification_complete)
    if (contest.post_contest_status !== "verification_complete") {
      return NextResponse.json(
        {
          error:
            "Payments can only be processed when contest status is 'verification_complete'",
        },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Get leaderboard entry for this creator
    const { data: leaderboardEntry, error: leaderboardError } =
      await supabaseAdmin
        .from("twitter_campaign_leaderboard")
        .select(
          "id, creator_id, current_rank, total_points, earnings, paid_rank, moderation_status"
        )
        .eq("contest_id", contestId)
        .eq("creator_id", creatorId)
        .single();

    if (leaderboardError || !leaderboardEntry) {
      return NextResponse.json(
        { error: "Creator not found in leaderboard for this contest" },
        { status: 404 }
      );
    }

    // Block payment for rejected creators to avoid inconsistent state
    if (leaderboardEntry.moderation_status === "rejected") {
      return NextResponse.json(
        {
          error:
            "Cannot pay a rejected creator. Approve the creator first, then process payment.",
        },
        { status: 400 }
      );
    }

    // Check if already paid (unless this is a re-payment with custom amount)
    if (leaderboardEntry.moderation_status === "paid" && !isCustom) {
      return NextResponse.json(
        { error: "Creator has already been paid for this contest" },
        { status: 400 }
      );
    }

    // Get prize/CPM amount
    const contestDetails = contest.contest_based_details as any;
    const leaderboardContest = contestDetails?.leaderboard_contest;
    const cpmContest = contestDetails?.cpm_contest;
    const prizes = leaderboardContest?.prizes || [];

    let rewardAmount = 0;
    const customAmount = isCustom && amountInCents ? amountInCents : 0;

    if (customAmount > 0) {
      // Use custom amount
      rewardAmount = customAmount;
    } else if (contest.contest_type === "leaderboard") {
      // Calculate prize from rank
      if (!leaderboardEntry.current_rank) {
        return NextResponse.json(
          { error: "Creator does not have a rank in this contest" },
          { status: 400 }
        );
      }

      const prizeForRank = prizes.find(
        (p: any) => p.position === leaderboardEntry.current_rank
      );
      if (!prizeForRank) {
        return NextResponse.json(
          {
            error: `No prize configured for rank ${leaderboardEntry.current_rank}`,
          },
          { status: 400 }
        );
      }

      rewardAmount = prizeForRank.amount; // Already in cents
    } else if (contest.contest_type === "cpm") {
      // CPM-based Twitter contest: pay based on total_points and CPM rate (match expected reward in UI)
      if (!cpmContest || typeof cpmContest.cpm_rate_usd !== "number") {
        return NextResponse.json(
          { error: "CPM configuration is missing for this contest" },
          { status: 400 }
        );
      }

      const totalPoints = leaderboardEntry.total_points || 0;
      const rate = cpmContest.cpm_rate_usd; // dollars per 1000 points
      // Convert to cents: (points / 1000) * rate (USD) * 100
      rewardAmount = Math.round((totalPoints * rate * 100) / 1000);
      // Apply max_earnings_per_creator cap so credited amount = expected reward shown in modal
      const maxEarningsPerCreator =
        (contest as any).max_earnings_per_creator ??
        cpmContest.max_earnings_per_creator ??
        null;
      if (
        maxEarningsPerCreator != null &&
        rewardAmount > maxEarningsPerCreator
      ) {
        rewardAmount = maxEarningsPerCreator;
      }
    }

    if (rewardAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 }
      );
    }

    // Determine payout cycle for idempotency (similar to submissions)
    const [{ data: existingRewards }, { data: existingRefunds }] =
      await Promise.all([
        supabaseAdmin
          .from("money_transactions")
          .select("id")
          .eq("user_id", creatorId)
          .eq("type", "reward")
          .contains("metadata", {
            contest_id: contestId,
            twitter_creator_id: creatorId,
          }),
        supabaseAdmin
          .from("money_transactions")
          .select("id, remarks")
          .eq("user_id", creatorId)
          .eq("type", "refund")
          .contains("metadata", {
            contest_id: contestId,
            twitter_creator_id: creatorId,
          }),
      ] as any);

    const rewardsCount = (existingRewards || []).length;
    const refundsCount =
      (existingRefunds || [])?.filter(
        (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK
      ).length || 0;
    const nextCycle =
      rewardsCount > refundsCount ? rewardsCount : rewardsCount + 1;

    // Check for duplicate reward in this cycle
    const { data: rewardInThisCycle } = await supabaseAdmin
      .from("money_transactions")
      .select("id")
      .eq("user_id", creatorId)
      .eq("type", "reward")
      .contains("metadata", {
        contest_id: contestId,
        twitter_creator_id: creatorId,
        payout_cycle: nextCycle,
      });

    if (rewardInThisCycle && rewardInThisCycle.length > 0) {
      return NextResponse.json(
        { error: "Payment for this cycle has already been processed" },
        { status: 400 }
      );
    }

    // Credit creator wallet
    const creditRes = await creditCreatorWithdrawableBalance(
      creatorId,
      rewardAmount,
      customAmount > 0
        ? `Custom Twitter contest payment - ${contest.title || "Contest"}`
        : contest.contest_type === "cpm"
        ? `Twitter CPM contest reward - ${contest.title || "Contest"}`
        : `Twitter contest reward - ${contest.title || "Contest"}`,
      {
        remarks:
          customRemarks ||
          (customAmount > 0
            ? "Custom Twitter payout credited to creator wallet"
            : contest.contest_type === "cpm"
            ? "Standard Twitter CPM payout credited to creator wallet"
            : "Standard Twitter payout credited to creator wallet"),
        metadata: {
          contest_id: contestId,
          twitter_creator_id: creatorId,
          payout_type:
            customAmount > 0
              ? "custom"
              : contest.contest_type === "cpm"
              ? "standard_cpm"
              : "standard",
          payout_cycle: nextCycle,
          rank: leaderboardEntry.current_rank,
          prize_amount: rewardAmount,
          total_points: leaderboardEntry.total_points,
        },
      }
    );

    if (!creditRes.success) {
      return NextResponse.json(
        { error: `Failed to credit creator: ${creditRes.error}` },
        { status: 500 }
      );
    }

    // Update leaderboard entry with payment information
    const updateData: any = {
      paid_at: new Date().toISOString(),
      earnings: rewardAmount,
      paid_rank: leaderboardEntry.current_rank, // Store rank at payment time for audit
      moderation_status: "paid",
    };

    const { error: updateError } = await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .update(updateData)
      .eq("id", leaderboardEntry.id);

    if (updateError) {
      console.error(
        "[pay-twitter-creator] Error updating leaderboard:",
        updateError
      );
      return NextResponse.json(
        { error: "Failed to update leaderboard payment status" },
        { status: 500 }
      );
    }

    // Mark non-rejected tweets paid and set per-tweet earnings (DB + reversals; bulk CPM already does this).
    const { data: tweetsToPay, error: tweetsFetchError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("id, points, manual_points_adjustment")
      .eq("contest_id", contestId)
      .eq("creator_id", creatorId)
      .neq("moderation_status", "rejected")
      .order("id", { ascending: true });

    if (tweetsFetchError) {
      console.error(
        "[pay-twitter-creator] Error fetching tweets for earnings split:",
        tweetsFetchError
      );
    } else if (tweetsToPay?.length) {
      const weights =
        contest.contest_type === "cpm"
          ? tweetsToPay.map((t) => {
              const pts =
                (t.points || 0) + (t.manual_points_adjustment || 0);
              return Math.max(0, pts);
            })
          : tweetsToPay.map(() => 0);
      const earningsPerTweet = distributeCentsByWeights(weights, rewardAmount);

      const updateResults = await Promise.all(
        tweetsToPay.map((t, i) =>
          supabaseAdmin
            .from("twitter_campaign_tweets")
            .update({
              moderation_status: "paid",
              earnings: earningsPerTweet[i],
            })
            .eq("id", t.id)
            .eq("contest_id", contestId)
        )
      );
      const tweetUpdateErr = updateResults.find((r) => r.error)?.error;
      if (tweetUpdateErr) {
        console.error(
          "[pay-twitter-creator] Error updating tweets with earnings:",
          tweetUpdateErr
        );
      }
    } else {
      const { error: tweetsUpdateError } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .update({ moderation_status: "paid" })
        .eq("contest_id", contestId)
        .eq("creator_id", creatorId)
        .neq("moderation_status", "rejected");

      if (tweetsUpdateError) {
        console.error(
          "[pay-twitter-creator] Error updating tweets:",
          tweetsUpdateError
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment processed successfully",
      amount: rewardAmount,
      paid_rank: leaderboardEntry.current_rank,
      transactionId: creditRes.transactionId,
    });
  } catch (error: any) {
    console.error("[pay-twitter-creator] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
