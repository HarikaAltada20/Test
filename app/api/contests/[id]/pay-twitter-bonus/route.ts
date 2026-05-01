import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  creditCreatorWithdrawableBalance,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";

/**
 * POST /api/contests/[id]/pay-twitter-bonus
 *
 * Credit only the flat fee bonus for a Twitter tweet (no main reward).
 * Used when "Mark as bonus paid" is selected for a Twitter submission.
 *
 * Body:
 * - tweetId: string (twitter_campaign_tweets.id, required)
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
    const { tweetId } = await request.json();

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
        "id, title, platform, contest_type, contest_based_details, post_contest_status"
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

    if (contest.post_contest_status !== "verification_complete") {
      return NextResponse.json(
        {
          error:
            "Payments can only be processed when contest status is 'verification_complete'",
        },
        { status: 400 }
      );
    }

    const contestDetails =
      contest.contest_type === "cpm"
        ? (contest.contest_based_details as any)?.cpm_contest
        : (contest.contest_based_details as any)?.leaderboard_contest;

    const flatFeeBonus = contestDetails?.flat_fee_bonus || 0;
    const totalBudget = contestDetails?.total_budget || null;
    const flatFeeBonusCap = contestDetails?.flat_fee_bonus_cap || null;

    if (flatFeeBonus <= 0) {
      return NextResponse.json(
        { error: "No flat fee bonus configured for this contest" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: tweet, error: tweetError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("id, creator_id, moderation_status")
      .eq("id", tweetId)
      .eq("contest_id", contestId)
      .single();

    if (tweetError || !tweet) {
      return NextResponse.json(
        { error: "Tweet not found for this contest" },
        { status: 404 }
      );
    }

    // For bonuses we rely on contest-level verification state and idempotency;
    // do not block on per-tweet moderation_status here.
    const creatorId = tweet.creator_id;
    if (!creatorId) {
      return NextResponse.json(
        { error: "Tweet has no creator" },
        { status: 400 }
      );
    }

    // Already credited bonus for this tweet? (idempotent) Use net = rewards - refunds
    // so that after a reversal (e.g. "Mark both paid" then refund per creator), bonus can be paid again per tweet.
    // Creator-level reversal (moderate-creator) logs refund with contest_id + twitter_creator_id + bonus_type (no tweet_id).
    const [
      { data: tweetBonusRewards },
      { data: tweetBonusRefunds },
      { data: creatorBonusRewards },
      { data: creatorBonusRefunds },
      { data: contestBonusRewards },
      { data: contestBonusRefunds },
    ] = await Promise.all([
      supabaseAdmin
        .from("money_transactions")
        .select("id, amount")
        .eq("user_id", creatorId)
        .eq("type", "reward")
        .contains("metadata", {
          contest_id: contestId,
          tweet_id: tweetId,
          bonus_type: "flat_fee",
        }),
      supabaseAdmin
        .from("money_transactions")
        .select("id, amount, remarks")
        .eq("user_id", creatorId)
        .eq("type", "refund")
        .contains("metadata", {
          contest_id: contestId,
          tweet_id: tweetId,
          bonus_type: "flat_fee",
        }),
      supabaseAdmin
        .from("money_transactions")
        .select("amount")
        .eq("user_id", creatorId)
        .eq("type", "reward")
        .contains("metadata", {
          contest_id: contestId,
          bonus_type: "flat_fee",
        }),
      supabaseAdmin
        .from("money_transactions")
        .select("id, amount, remarks")
        .eq("user_id", creatorId)
        .eq("type", "refund")
        .contains("metadata", {
          contest_id: contestId,
          twitter_creator_id: creatorId,
          bonus_type: "flat_fee",
        }),
      supabaseAdmin
        .from("money_transactions")
        .select("amount")
        .eq("type", "reward")
        .contains("metadata", {
          contest_id: contestId,
          bonus_type: "flat_fee",
        }),
      supabaseAdmin
        .from("money_transactions")
        .select("amount, remarks")
        .eq("type", "refund")
        .contains("metadata", {
          contest_id: contestId,
          bonus_type: "flat_fee",
        }),
    ] as any);

    const tweetRewardSum = (tweetBonusRewards || []).reduce(
      (s: number, r: any) => s + (r.amount || 0),
      0
    );
    const tweetRefundSum = (tweetBonusRefunds || [])
      .filter(
        (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK
      )
      .reduce((s: number, r: any) => s + (r.amount || 0), 0);
    const creatorRewardSum = (creatorBonusRewards || []).reduce(
      (s: number, r: any) => s + (r.amount || 0),
      0
    );
    const creatorRefundSum = (creatorBonusRefunds || [])
      .filter(
        (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK
      )
      .reduce((s: number, r: any) => s + (r.amount || 0), 0);
    // Creator-level reversal (e.g. moderate-creator "Mark both paid" then reject): one refund row, no tweet_id
    const creatorBonusFullyReversed =
      creatorRefundSum > 0 && creatorRefundSum >= creatorRewardSum;
    const netBonusForTweet = creatorBonusFullyReversed
      ? 0
      : Math.max(0, tweetRewardSum - tweetRefundSum);

    if (netBonusForTweet >= flatFeeBonus) {
      return NextResponse.json(
        {
          error: "Bonus for this tweet has already been paid",
          alreadyPaid: true,
        },
        { status: 400 }
      );
    }

    // Current bonus spent for this contest (net: rewards - refunds) so reversals free budget/cap
    const contestRewardSum = (contestBonusRewards || []).reduce(
      (s: number, r: any) => s + (r.amount || 0),
      0
    );
    const contestRefundSum = (contestBonusRefunds || [])
      .filter(
        (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK
      )
      .reduce((s: number, r: any) => s + (r.amount || 0), 0);
    const currentBonusSpent = Math.max(0, contestRewardSum - contestRefundSum);

    if (contest.contest_type === "leaderboard" && totalBudget != null) {
      if (currentBonusSpent + flatFeeBonus > totalBudget) {
        return NextResponse.json(
          {
            error: "Total budget exceeded",
            details: {
              currentSpent: currentBonusSpent,
              bonusAmount: flatFeeBonus,
              budgetLimit: totalBudget,
            },
          },
          { status: 400 }
        );
      }
    }

    if (contest.contest_type === "cpm" && flatFeeBonusCap != null) {
      if (currentBonusSpent + flatFeeBonus > flatFeeBonusCap) {
        return NextResponse.json(
          {
            error: "Flat fee bonus cap exceeded",
            details: {
              currentSpent: currentBonusSpent,
              bonusAmount: flatFeeBonus,
              capLimit: flatFeeBonusCap,
            },
          },
          { status: 400 }
        );
      }
    }

    const bonusRewardsCount = (tweetBonusRewards || []).length;
    const bonusRefundsCount = (tweetBonusRefunds || [])
      .filter((r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK)
      .length;
    const nextBonusCycle =
      bonusRewardsCount > bonusRefundsCount
        ? bonusRewardsCount
        : bonusRewardsCount + 1;

    const twitterFlatFeeBonusKey = `twitter_flat_fee_bonus:v2:${contestId}:${tweetId}:cycle:${nextBonusCycle}`;

    const creditResult = await creditCreatorWithdrawableBalance(
      creatorId,
      flatFeeBonus,
      `Flat fee bonus for Twitter submission - ${contest.title || "Contest"}`,
      {
        idempotencyKey: twitterFlatFeeBonusKey,
        remarks: "Flat fee bonus credited to creator wallet",
        metadata: {
          contest_id: contestId,
          tweet_id: tweetId,
          bonus_type: "flat_fee",
          payout_cycle: nextBonusCycle,
        },
      }
    );

    if (!creditResult.success) {
      return NextResponse.json(
        { error: `Failed to credit bonus: ${creditResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Flat fee bonus paid successfully",
      amount: flatFeeBonus,
      transactionId: creditResult.transactionId,
    });
  } catch (error: any) {
    console.error("[pay-twitter-bonus] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
