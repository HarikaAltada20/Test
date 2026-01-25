import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  creditCreatorWithdrawableBalance,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";

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

    // Get contest to verify it's a Twitter contest
    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select(
        "id, title, advertiser_id, platform, contest_type, contest_based_details, post_contest_status"
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
          "id, creator_id, current_rank, total_points, paid, earnings, paid_rank"
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

    // Check if already paid (unless this is a re-payment with custom amount)
    if (leaderboardEntry.paid && !isCustom) {
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
      // CPM-based Twitter contest: pay based on total_points and CPM rate
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
      paid: true,
      paid_at: new Date().toISOString(),
      earnings: rewardAmount,
      paid_rank: leaderboardEntry.current_rank, // Store rank at payment time for audit
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
