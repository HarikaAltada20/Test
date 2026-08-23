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
import { buildWalletRollbackDebitIdempotencyKey } from "@/lib/bulk-payment-rollback";
import {
  acquireCreatorContestPayoutLease,
  releaseCreatorContestPayoutLease,
  type CreatorContestPayoutLease,
} from "@/lib/creator-contest-payout-lease";
import {
  authorizeQueueWorker,
  readQueuedActorUserId,
} from "@/lib/queue/queue-worker-auth";

/** Split total cents across rows by non-negative weights; remainder by largest fractional parts. Equal split when all weights are 0. */
function distributeCentsByWeights(
  weights: number[],
  totalCents: number,
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

async function rollbackTwitterCreatorWalletCredit(params: {
  creatorId: string;
  rewardAmount: number;
  contestId: string;
  contestTitle: string;
  payKey: string;
  reason: string;
  transactionId?: string | null;
  extraMetadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string; alreadyApplied?: boolean }> {
  const rollbackDebitKey = buildWalletRollbackDebitIdempotencyKey({
    payoutOperationKey: params.payKey,
    reason: params.reason,
  });
  const debitRes = await debitCreatorWithdrawableBalance(
    params.creatorId,
    params.rewardAmount,
    { idempotencyKey: rollbackDebitKey },
  );
  if (!debitRes.success) {
    return {
      ok: false,
      error: debitRes.error || "Unknown wallet rollback failure",
    };
  }

  const refundLogged = await logTransactionAsAdmin(
    params.creatorId,
    "refund",
    params.rewardAmount,
    "success",
    `Rollback: Twitter creator payment ${params.reason} - ${params.contestTitle}`,
    {
      remarks: REVERSAL_TRANSACTION_REMARK,
      paymentMethod: "refund",
      metadata: {
        contest_id: params.contestId,
        twitter_creator_id: params.creatorId,
        payout_type: "twitter_creator_rollback",
        original_reward_transaction_id: params.transactionId,
        payout_operation_key: params.payKey,
        wallet_rollback_debit_key: rollbackDebitKey,
        wallet_rollback_already_applied: Boolean(debitRes.alreadyApplied),
        rollback_reason: params.reason,
        ...(params.extraMetadata || {}),
      },
    },
  );

  if (!refundLogged && !debitRes.alreadyApplied) {
    return {
      ok: false,
      alreadyApplied: Boolean(debitRes.alreadyApplied),
      error:
        "Wallet debit succeeded but refund ledger row could not be written",
    };
  }

  return {
    ok: true,
    alreadyApplied: Boolean(debitRes.alreadyApplied),
  };
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
  { params }: { params: Promise<{ id: string }> },
) {
  let payoutLease: CreatorContestPayoutLease | null = null;
  try {
    const queueAuth = authorizeQueueWorker(request);
    if (queueAuth.fromQueue && !queueAuth.authorized) {
      return queueAuth.response!;
    }

    const { id: contestId } = await params;
    const body = await request.json();
    const {
      creatorId,
      amountInCents,
      isCustom,
      paymentProofUrl,
      paymentDescription,
      customRemarks,
    } = body;

    // Validate input
    if (!creatorId) {
      return NextResponse.json(
        { error: "creatorId is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();
    let contest: {
      id: string;
      title: string | null;
      advertiser_id: string;
      platform: string | null;
      contest_type: string | null;
      contest_based_details: unknown;
      post_contest_status: string | null;
      max_earnings_per_creator: number | null;
      payout_adjustment_percentage: number | null;
      payout_adjustment_mode: string | null;
    } | null = null;

    if (queueAuth.fromQueue) {
      const actorId = readQueuedActorUserId(body);
      if (!actorId) {
        return NextResponse.json(
          { error: "admin_user_id is required for queued bulk payment" },
          { status: 400 },
        );
      }
      const { data, error: contestError } = await supabaseAdmin
        .from("contests")
        .select(
          "id, title, advertiser_id, platform, contest_type, contest_based_details, post_contest_status, max_earnings_per_creator, payout_adjustment_percentage, payout_adjustment_mode",
        )
        .eq("id", contestId)
        .single();
      if (contestError || !data) {
        return NextResponse.json({ error: "Contest not found" }, { status: 404 });
      }
      contest = data;
    } else {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Verify admin access
      const { isAdmin, error: adminError } = await verifyAdminAccess();
      if (!isAdmin) {
        return NextResponse.json(
          { error: adminError || "Admin access required" },
          { status: 403 },
        );
      }

      // Get contest to verify it's a Twitter contest (include max_earnings_per_creator for CPM cap)
      const { data, error: contestError } = await supabase
        .from("contests")
        .select(
          "id, title, advertiser_id, platform, contest_type, contest_based_details, post_contest_status, max_earnings_per_creator, payout_adjustment_percentage, payout_adjustment_mode",
        )
        .eq("id", contestId)
        .single();

      if (contestError || !data) {
        return NextResponse.json({ error: "Contest not found" }, { status: 404 });
      }
      contest = data;
    }

    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Verify contest is Twitter/X platform
    const platform = contest.platform?.toLowerCase();
    if (platform !== "twitter" && platform !== "x") {
      return NextResponse.json(
        { error: "This endpoint is only for Twitter contests" },
        { status: 400 },
      );
    }

    // Verify contest type is leaderboard or CPM
    if (
      contest.contest_type !== "leaderboard" &&
      contest.contest_type !== "cpm"
    ) {
      return NextResponse.json(
        { error: "This endpoint is only for leaderboard or CPM contests" },
        { status: 400 },
      );
    }

    // Verify post_contest_status allows payment (only verification_complete)
    if (contest.post_contest_status !== "verification_complete") {
      return NextResponse.json(
        {
          error:
            "Payments can only be processed when contest status is 'verification_complete'",
        },
        { status: 400 },
      );
    }

    const leaseResult = await acquireCreatorContestPayoutLease({
      contestId,
      creatorId: String(creatorId),
    });
    if (!leaseResult.ok) {
      return NextResponse.json(
        { error: leaseResult.error },
        { status: leaseResult.busy ? 409 : 500 },
      );
    }
    payoutLease = leaseResult.lease;

    // Get leaderboard entry for this creator
    const { data: leaderboardEntry, error: leaderboardError } =
      await supabaseAdmin
        .from("twitter_campaign_leaderboard")
        .select(
          "id, creator_id, current_rank, total_points, manual_points_adjustment, earnings, paid_rank, paid_at, moderation_status",
        )
        .eq("contest_id", contestId)
        .eq("creator_id", creatorId)
        .single();

    if (leaderboardError || !leaderboardEntry) {
      return NextResponse.json(
        { error: "Creator not found in leaderboard for this contest" },
        { status: 404 },
      );
    }

    // Block payment for rejected creators to avoid inconsistent state
    if (leaderboardEntry.moderation_status === "rejected") {
      return NextResponse.json(
        {
          error:
            "Cannot pay a rejected creator. Approve the creator first, then process payment.",
        },
        { status: 400 },
      );
    }

    // Leaderboard prizes are one-time. CPM creator payments may be topped up when
    // points (for example creator-level manual points) increase after tweet payout.
    if (
      contest.contest_type === "leaderboard" &&
      leaderboardEntry.moderation_status === "paid" &&
      !isCustom
    ) {
      return NextResponse.json(
        { error: "Creator has already been paid for this contest" },
        { status: 400 },
      );
    }

    // Get prize/CPM amount
    const contestDetails = contest.contest_based_details as any;
    const payoutAdjustment = parsePayoutAdjustment(
      (contest as any).payout_adjustment_percentage,
      (contest as any).payout_adjustment_mode,
      { contestType: contest.contest_type },
    );
    const leaderboardContest = contestDetails?.leaderboard_contest;
    const cpmContest = contestDetails?.cpm_contest;
    const prizes = leaderboardContest?.prizes || [];

    let rewardAmount = 0;
    /** Fresh CPM points used for pay math + transaction metadata (not stale leaderboard cache). */
    let computedTotalPoints: number | null = null;
    const parsedCustomAmount = Number(amountInCents);
    if (
      isCustom &&
      (!Number.isFinite(parsedCustomAmount) || parsedCustomAmount <= 0)
    ) {
      return NextResponse.json(
        { error: "Custom amount must be a positive number of cents" },
        { status: 400 },
      );
    }
    const customAmount = isCustom ? Math.round(parsedCustomAmount) : 0;

    if (customAmount > 0) {
      // Use custom amount
      rewardAmount = customAmount;
    } else if (contest.contest_type === "leaderboard") {
      // Calculate prize from rank
      if (!leaderboardEntry.current_rank) {
        return NextResponse.json(
          { error: "Creator does not have a rank in this contest" },
          { status: 400 },
        );
      }

      const prizeForRank = prizes.find(
        (p: any) => p.position === leaderboardEntry.current_rank,
      );
      if (!prizeForRank) {
        return NextResponse.json(
          {
            error: `No prize configured for rank ${leaderboardEntry.current_rank}`,
          },
          { status: 400 },
        );
      }

      rewardAmount = prizeForRank.amount; // Already in cents
    } else if (contest.contest_type === "cpm") {
      // CPM-based Twitter contest: pay based on total_points and CPM rate (match expected reward in UI)
      if (!cpmContest || typeof cpmContest.cpm_rate_usd !== "number") {
        return NextResponse.json(
          { error: "CPM configuration is missing for this contest" },
          { status: 400 },
        );
      }

      // Derive fresh points from tweet rows instead of trusting the cached
      // leaderboard total, which can be stale/zero while creator-wise UI has
      // current points. Add the creator-level manual adjustment exactly once.
      const { data: creatorTweetsForPoints, error: creatorTweetsPointsError } =
        await supabaseAdmin
          .from("twitter_campaign_tweets")
          .select("points, manual_points_adjustment")
          .eq("contest_id", contestId)
          .eq("creator_id", creatorId)
          .neq("moderation_status", "rejected");

      if (creatorTweetsPointsError) {
        return NextResponse.json(
          {
            error: "Failed to calculate the creator's current CPM points",
            details: creatorTweetsPointsError.message,
          },
          { status: 500 },
        );
      }

      const tweetPoints = (creatorTweetsForPoints || []).reduce(
        (sum: number, tweet: any) =>
          sum +
          Math.max(
            0,
            (Number(tweet.points) || 0) +
              (Number(tweet.manual_points_adjustment) || 0),
          ),
        0,
      );
      const totalPoints = Math.max(
        0,
        tweetPoints +
          (Number((leaderboardEntry as any).manual_points_adjustment) || 0),
      );
      computedTotalPoints = totalPoints;
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
        { status: 400 },
      );
    }
    if (!isCustom) {
      rewardAmount = adjustRewardCents(rewardAmount, {
        shouldAdjustReward: payoutAdjustment.shouldAdjustReward,
        percentage: payoutAdjustment.percentage,
      });
    }

    if (rewardAmount <= 0) {
      return NextResponse.json(
        { error: "Reward became zero after payout adjustment" },
        { status: 400 },
      );
    }

    // Determine payout cycle for idempotency (similar to submissions)
    const [{ data: existingRewardsRaw }, { data: existingRefundsRaw }] =
      await Promise.all([
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount, metadata")
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

    const isCreatorLevelReward = (row: any) => {
      const metadata = row?.metadata || {};
      const payoutType = String(metadata.payout_type || "");
      return (
        !metadata.tweet_id &&
        !metadata.bonus_type &&
        (payoutType === "twitter_cpm_creator" ||
          payoutType === "standard" ||
          payoutType === "custom")
      );
    };
    const isPerTweetOrBulkCpm = (row: any) => {
      const metadata = row?.metadata || {};
      const payoutType = String(metadata.payout_type || "");
      return (
        Boolean(metadata.tweet_id) ||
        payoutType === "twitter_cpm_tweet" ||
        payoutType === "twitter_cpm_tweet_custom" ||
        payoutType === "twitter_cpm_bulk"
      );
    };
    const cpmAmountForHistoryRow = (row: any) => {
      const metadata = row?.metadata || {};
      if (metadata.payout_type === "twitter_cpm_bulk") {
        const totalCpm = Number(metadata.total_cpm);
        return Number.isFinite(totalCpm) && totalCpm > 0 ? totalCpm : 0;
      }
      return Number(row?.amount) || 0;
    };

    const existingRewards = (existingRewardsRaw || []).filter(
      isCreatorLevelReward,
    );
    const existingRefunds = (existingRefundsRaw || []).filter(
      (row: any) =>
        (!row.remarks || row.remarks === REVERSAL_TRANSACTION_REMARK) &&
        isCreatorLevelReward(row),
    );

    if (contest.contest_type === "cpm") {
      const partialCpmRewards = (existingRewardsRaw || [])
        .filter(isPerTweetOrBulkCpm)
        .reduce(
          (sum: number, row: any) => sum + cpmAmountForHistoryRow(row),
          0,
        );
      const partialCpmRefunds = (existingRefundsRaw || [])
        .filter(
          (row: any) =>
            (!row.remarks || row.remarks === REVERSAL_TRANSACTION_REMARK) &&
            isPerTweetOrBulkCpm(row),
        )
        .reduce(
          (sum: number, row: any) => sum + cpmAmountForHistoryRow(row),
          0,
        );

      const netPartialCpmPaid = Math.max(
        0,
        partialCpmRewards - partialCpmRefunds,
      );
      const creatorLevelCpmRewards = existingRewards.reduce(
        (sum: number, row: any) => sum + (Number(row?.amount) || 0),
        0,
      );
      const creatorLevelCpmRefunds = existingRefunds.reduce(
        (sum: number, row: any) => sum + (Number(row?.amount) || 0),
        0,
      );
      const netCreatorLevelCpmPaid = Math.max(
        0,
        creatorLevelCpmRewards - creatorLevelCpmRefunds,
      );

      if (!isCustom) {
        // Creator-wise CPM pays the creator-level Expected Reward. If tweets or
        // the creator were already partially paid, only credit the difference.
        rewardAmount = Math.max(
          0,
          rewardAmount - netPartialCpmPaid - netCreatorLevelCpmPaid,
        );
      }

      if (rewardAmount <= 0) {
        return NextResponse.json(
          {
            error: "Creator has already received the full expected CPM reward.",
          },
          { status: 400 },
        );
      }
    }

    const rewardsCount = existingRewards.length;
    const refundsCount = existingRefunds.length || 0;
    const hasUnreconciledCreatorReward =
      rewardsCount > refundsCount &&
      leaderboardEntry.moderation_status !== "paid";
    const nextCycle = hasUnreconciledCreatorReward
      ? rewardsCount
      : rewardsCount + 1;

    // Only creator-level rewards share this cycle sequence. Per-tweet payments
    // also use payout_cycle, but must not block a creator-level CPM top-up.
    const rewardInThisCycle = existingRewards.filter(
      (row: any) => Number(row?.metadata?.payout_cycle) === nextCycle,
    );

    const hasRewardInThisCycle = Boolean(
      rewardInThisCycle && rewardInThisCycle.length > 0,
    );
    const canReconcileExistingReward =
      hasRewardInThisCycle && leaderboardEntry.moderation_status !== "paid";
    if (hasRewardInThisCycle && !canReconcileExistingReward) {
      return NextResponse.json(
        { error: "Payment for this cycle has already been processed" },
        { status: 400 },
      );
    }

    const twitterCreatorPayKey =
      customAmount > 0
        ? `twitter_creator_pay:v1:${contestId}:${creatorId}:cycle:${nextCycle}:amt:${rewardAmount}`
        : `twitter_creator_pay:v1:${contestId}:${creatorId}:cycle:${nextCycle}`;

    const creditRes: {
      success: boolean;
      transactionId?: string;
      alreadyApplied?: boolean;
      error?: string;
    } = canReconcileExistingReward
      ? {
          success: true,
          transactionId: rewardInThisCycle?.[0]?.id,
          alreadyApplied: true,
        }
      : await creditCreatorWithdrawableBalance(
          creatorId,
          rewardAmount,
          customAmount > 0
            ? `Custom Twitter contest payment - ${contest.title || "Contest"}`
            : contest.contest_type === "cpm"
              ? `Twitter CPM contest reward - ${contest.title || "Contest"}`
              : `Twitter contest reward - ${contest.title || "Contest"}`,
          {
            idempotencyKey: twitterCreatorPayKey,
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
                    ? "twitter_cpm_creator"
                    : "standard",
              payout_cycle: nextCycle,
              rank: leaderboardEntry.current_rank,
              prize_amount: rewardAmount,
              total_points:
                computedTotalPoints ?? leaderboardEntry.total_points,
            },
          },
        );

    if (!creditRes.success) {
      return NextResponse.json(
        { error: `Failed to credit creator: ${creditRes.error}` },
        { status: 500 },
      );
    }

    // Update leaderboard payment status. For CPM, do not write the credit delta
    // as earnings — reconcile after tweet rows update sets the sum of paid tweet
    // earnings (avoids Reward Granted under-reporting on top-ups).
    const updateData: Record<string, unknown> = {
      paid_at: new Date().toISOString(),
      paid_rank: leaderboardEntry.current_rank, // Store rank at payment time for audit
      moderation_status: "paid",
    };
    if (contest.contest_type !== "cpm") {
      updateData.earnings = rewardAmount;
    }

    const { error: updateError } = await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .update(updateData)
      .eq("id", leaderboardEntry.id);

    if (updateError) {
      console.error(
        "[pay-twitter-creator] Error updating leaderboard:",
        updateError,
      );
      if (!creditRes.alreadyApplied) {
        await rollbackTwitterCreatorWalletCredit({
          creatorId,
          rewardAmount,
          contestId,
          contestTitle: contest.title || "Contest",
          payKey: twitterCreatorPayKey,
          reason: "leaderboard_update_failed",
          transactionId: creditRes.transactionId,
        });
      }
      return NextResponse.json(
        { error: "Failed to update leaderboard payment status" },
        { status: 500 },
      );
    }

    // Mark non-rejected tweets paid and set per-tweet earnings (DB + reversals; bulk CPM already does this).
    const { data: tweetsToPay, error: tweetsFetchError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select(
        "id, points, manual_points_adjustment, moderation_status, earnings",
      )
      .eq("contest_id", contestId)
      .eq("creator_id", creatorId)
      .neq("moderation_status", "rejected")
      .order("id", { ascending: true });

    if (tweetsFetchError) {
      console.error(
        "[pay-twitter-creator] Error fetching tweets for earnings split:",
        tweetsFetchError,
      );
      if (!creditRes.alreadyApplied) {
        const debitRes = await rollbackTwitterCreatorWalletCredit({
          creatorId,
          rewardAmount,
          contestId,
          contestTitle: contest.title || "Contest",
          payKey: twitterCreatorPayKey,
          reason: "tweet_fetch_failed",
          transactionId: creditRes.transactionId,
        });
        if (!debitRes.ok) {
          return NextResponse.json(
            {
              error:
                "Creator was credited but tweets could not be loaded for earnings split, and automatic wallet rollback failed. Contact support immediately.",
              details: debitRes.error,
            },
            { status: 500 },
          );
        }
      }
      await supabaseAdmin
        .from("twitter_campaign_leaderboard")
        .update({
          paid_at: leaderboardEntry.paid_at,
          earnings: leaderboardEntry.earnings,
          paid_rank: leaderboardEntry.paid_rank,
          moderation_status: leaderboardEntry.moderation_status,
        })
        .eq("id", leaderboardEntry.id);
      return NextResponse.json(
        {
          error: creditRes.alreadyApplied
            ? "Creator payout existed, but tweets could not be loaded to reconcile earnings. Retry or contact support."
            : "Creator payment tweet fetch failed. Wallet credit was rolled back; retry.",
          details: tweetsFetchError.message,
        },
        { status: 500 },
      );
    } else if (tweetsToPay?.length) {
      const unpaidTweets = tweetsToPay.filter(
        (tweet) => tweet.moderation_status !== "paid",
      );
      // A creator can need a top-up after every tweet was paid (for example when
      // creator-level manual points are added later). Spread that delta over the
      // existing paid tweets so their sum still reconciles to the creator total.
      const tweetsNeedingMainPayment =
        unpaidTweets.length > 0 ? unpaidTweets : tweetsToPay;
      const weights =
        contest.contest_type === "cpm"
          ? tweetsNeedingMainPayment.map((t) => {
              const pts = (t.points || 0) + (t.manual_points_adjustment || 0);
              return Math.max(0, pts);
            })
          : tweetsNeedingMainPayment.map(() => 0);
      const earningsPerTweet = distributeCentsByWeights(weights, rewardAmount);

      const updateResults = await Promise.all(
        tweetsNeedingMainPayment.map((t, i) =>
          supabaseAdmin
            .from("twitter_campaign_tweets")
            .update({
              moderation_status: "paid",
              earnings:
                (t.moderation_status === "paid"
                  ? Math.max(0, Number(t.earnings) || 0)
                  : 0) + earningsPerTweet[i],
            })
            .eq("id", t.id)
            .eq("contest_id", contestId),
        ),
      );
      const tweetUpdateErr = updateResults.find((r) => r.error)?.error;
      if (tweetUpdateErr) {
        console.error(
          "[pay-twitter-creator] Error updating tweets with earnings:",
          tweetUpdateErr,
        );
        if (!creditRes.alreadyApplied) {
          const debitRes = await rollbackTwitterCreatorWalletCredit({
            creatorId,
            rewardAmount,
            contestId,
            contestTitle: contest.title || "Contest",
            payKey: twitterCreatorPayKey,
            reason: "tweet_update_failed",
            transactionId: creditRes.transactionId,
          });
          if (!debitRes.ok) {
            console.error(
              "[pay-twitter-creator] CRITICAL: wallet rollback failed after tweet update error:",
              debitRes.error,
            );
            return NextResponse.json(
              {
                error:
                  "Creator payment could not be reconciled and automatic wallet rollback failed. Contact support immediately.",
                details: debitRes.error,
              },
              { status: 500 },
            );
          }
        }
        await supabaseAdmin
          .from("twitter_campaign_leaderboard")
          .update({
            paid_at: leaderboardEntry.paid_at,
            earnings: leaderboardEntry.earnings,
            paid_rank: leaderboardEntry.paid_rank,
            moderation_status: leaderboardEntry.moderation_status,
          })
          .eq("id", leaderboardEntry.id);
        await Promise.all(
          tweetsNeedingMainPayment.map((t) =>
            supabaseAdmin
              .from("twitter_campaign_tweets")
              .update({
                moderation_status: t.moderation_status,
                earnings: t.earnings,
              })
              .eq("id", t.id)
              .eq("contest_id", contestId),
          ),
        );
        return NextResponse.json(
          {
            error: creditRes.alreadyApplied
              ? "Creator payout existed, but tweet rows could not be reconciled. Retry or contact support."
              : "Creator payment row updates failed. Wallet credit was rolled back; retry after resolving tweets.",
          },
          { status: 500 },
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
          tweetsUpdateError,
        );
        if (!creditRes.alreadyApplied) {
          const debitRes = await rollbackTwitterCreatorWalletCredit({
            creatorId,
            rewardAmount,
            contestId,
            contestTitle: contest.title || "Contest",
            payKey: twitterCreatorPayKey,
            reason: "tweet_status_update_failed",
            transactionId: creditRes.transactionId,
          });
          if (!debitRes.ok) {
            return NextResponse.json(
              {
                error:
                  "Creator payment could not be reconciled and automatic wallet rollback failed. Contact support immediately.",
                details: debitRes.error,
              },
              { status: 500 },
            );
          }
        }
        await supabaseAdmin
          .from("twitter_campaign_leaderboard")
          .update({
            paid_at: leaderboardEntry.paid_at,
            earnings: leaderboardEntry.earnings,
            paid_rank: leaderboardEntry.paid_rank,
            moderation_status: leaderboardEntry.moderation_status,
          })
          .eq("id", leaderboardEntry.id);
        return NextResponse.json(
          {
            error: creditRes.alreadyApplied
              ? "Creator payout existed, but tweet rows could not be reconciled. Retry or contact support."
              : "Creator payment row updates failed. Wallet credit was rolled back; retry after resolving tweets.",
          },
          { status: 500 },
        );
      }
    }

    // CPM: keep leaderboard.earnings aligned with sum of paid tweet earnings
    // (prevents drift if an earlier additive delta left a stale total).
    if (contest.contest_type === "cpm") {
      const { reconcileTwitterLeaderboardCpmEarnings } =
        await import("@/lib/twitter/reconcile-leaderboard-cpm-earnings");
      const reconciled = await reconcileTwitterLeaderboardCpmEarnings(
        contestId,
        creatorId,
        supabaseAdmin,
      );
      if (!reconciled.ok) {
        console.error(
          "[pay-twitter-creator] Leaderboard earnings reconcile failed:",
          reconciled.error,
        );
        if (!creditRes.alreadyApplied) {
          const debitRes = await rollbackTwitterCreatorWalletCredit({
            creatorId,
            rewardAmount,
            contestId,
            contestTitle: contest.title || "Contest",
            payKey: twitterCreatorPayKey,
            reason: "leaderboard_reconcile_failed",
            transactionId: creditRes.transactionId,
            extraMetadata: { reconcile_error: reconciled.error },
          });
          if (!debitRes.ok) {
            console.error(
              "[pay-twitter-creator] CRITICAL: wallet rollback failed after reconcile error:",
              debitRes.error,
            );
            return NextResponse.json(
              {
                error:
                  "Creator was credited but leaderboard earnings could not be reconciled, and automatic wallet rollback failed. Contact support immediately.",
                details: debitRes.error,
              },
              { status: 500 },
            );
          }
        }
        await supabaseAdmin
          .from("twitter_campaign_leaderboard")
          .update({
            paid_at: leaderboardEntry.paid_at,
            earnings: leaderboardEntry.earnings,
            paid_rank: leaderboardEntry.paid_rank,
            moderation_status: leaderboardEntry.moderation_status,
          })
          .eq("id", leaderboardEntry.id);
        if (tweetsToPay?.length) {
          const unpaidTweets = tweetsToPay.filter(
            (tweet) => tweet.moderation_status !== "paid",
          );
          const tweetsNeedingMainPayment =
            unpaidTweets.length > 0 ? unpaidTweets : tweetsToPay;
          await Promise.all(
            tweetsNeedingMainPayment.map((t) =>
              supabaseAdmin
                .from("twitter_campaign_tweets")
                .update({
                  moderation_status: t.moderation_status,
                  earnings: t.earnings,
                })
                .eq("id", t.id)
                .eq("contest_id", contestId),
            ),
          );
        }
        return NextResponse.json(
          {
            error: creditRes.alreadyApplied
              ? "Creator payout existed, but leaderboard earnings could not be reconciled. Retry or contact support."
              : "Creator payment succeeded in wallet but leaderboard earnings reconcile failed. Wallet credit was rolled back; retry.",
            details: reconciled.error,
          },
          { status: 500 },
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
      { status: 500 },
    );
  } finally {
    await releaseCreatorContestPayoutLease(payoutLease);
  }
}
