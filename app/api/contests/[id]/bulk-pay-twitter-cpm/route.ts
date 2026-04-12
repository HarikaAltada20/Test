import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  creditCreatorWithdrawableBalance,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import { applyPayoutAdjustment } from "@/lib/payout-adjustment";

type PaymentType = "standard" | "bonus" | "both";

/**
 * POST /api/contests/[id]/bulk-pay-twitter-cpm
 *
 * Single wallet transaction for multiple verified Twitter CPM tweets (same creator).
 * Instagram/YouTube use /api/admin/bulk-payment; Twitter rows live in twitter_campaign_tweets.
 *
 * Body: { tweet_ids: string[], payment_type: PaymentType, creator_id: string }
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

    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin && adminError) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id: contestId } = await params;
    const body = await request.json();
    const {
      tweet_ids: tweetIdsRaw,
      payment_type: paymentType,
      creator_id: creatorId,
    } = body as {
      tweet_ids?: string[];
      payment_type?: PaymentType;
      creator_id?: string;
    };

    if (!tweetIdsRaw?.length || !creatorId) {
      return NextResponse.json(
        { error: "tweet_ids (non-empty) and creator_id are required" },
        { status: 400 }
      );
    }
    if (!["standard", "bonus", "both"].includes(paymentType || "")) {
      return NextResponse.json(
        { error: "payment_type must be standard, bonus, or both" },
        { status: 400 }
      );
    }

    const tweetIds = [...new Set(tweetIdsRaw.map(String))];

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
        { error: "This endpoint is only for Twitter/X contests" },
        { status: 400 }
      );
    }
    if (contest.contest_type !== "cpm") {
      return NextResponse.json(
        { error: "Bulk Twitter payout is only for CPM contests" },
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

    const flatFeeBonus = cpmContest.flat_fee_bonus || 0;
    const flatFeeBonusCap = cpmContest.flat_fee_bonus_cap ?? null;
    const maxEarningsPerCreator =
      contest.max_earnings_per_creator ?? cpmContest.max_earnings_per_creator ?? null;

    const payoutAdjustmentPercentage =
      typeof contest.payout_adjustment_percentage === "number"
        ? contest.payout_adjustment_percentage
        : typeof contest.payout_adjustment_percentage === "string"
          ? parseFloat(contest.payout_adjustment_percentage) || 0
          : 0;
    const payoutAdjustmentMode = contest.payout_adjustment_mode as
      | "cpm_only"
      | "bonus_only"
      | "combined"
      | null;
    const hasPayoutAdjustment =
      payoutAdjustmentPercentage > 0 && !!payoutAdjustmentMode;
    const shouldAdjustReward =
      hasPayoutAdjustment &&
      (payoutAdjustmentMode === "combined" ||
        payoutAdjustmentMode === "cpm_only");
    const shouldAdjustBonus =
      hasPayoutAdjustment &&
      (payoutAdjustmentMode === "combined" ||
        payoutAdjustmentMode === "bonus_only");

    const supabaseAdmin = createAdminClient();

    const { data: tweets, error: tweetsError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select(
        "id, creator_id, points, manual_points_adjustment, moderation_status, tweet_created_at"
      )
      .eq("contest_id", contestId)
      .in("id", tweetIds);

    if (tweetsError || !tweets?.length) {
      return NextResponse.json(
        { error: "Failed to fetch tweets for this contest" },
        { status: 500 }
      );
    }

    for (const t of tweets) {
      if (t.creator_id !== creatorId) {
        return NextResponse.json(
          { error: "All tweets must belong to the specified creator" },
          { status: 400 }
        );
      }
    }

    const sorted = [...tweets].sort(
      (a, b) =>
        new Date(a.tweet_created_at || 0).getTime() -
        new Date(b.tweet_created_at || 0).getTime()
    );

    const cpmRate = cpmContest.cpm_rate_usd;

    const [
      { data: creatorRewards },
      { data: creatorRefunds },
    ] = await Promise.all([
      supabaseAdmin
        .from("money_transactions")
        .select("amount, metadata")
        .eq("user_id", creatorId)
        .eq("type", "reward"),
      supabaseAdmin
        .from("money_transactions")
        .select("amount, metadata, remarks")
        .eq("user_id", creatorId)
        .eq("type", "refund"),
    ] as any);

    const metaMatchesContest = (m: any) =>
      m && String(m.contest_id) === String(contestId);

    let totalCreatorCpmRewards = 0;
    let totalCreatorCpmRefunds = 0;
    (creatorRewards || []).forEach((r: any) => {
      if (!metaMatchesContest(r.metadata)) return;
      const pt = r.metadata?.payout_type;
      if (pt === "twitter_cpm_bulk") {
        const tc = Number(r.metadata?.total_cpm);
        if (!Number.isNaN(tc) && tc > 0) {
          totalCreatorCpmRewards += tc;
        }
        return;
      }
      if (pt === "twitter_cpm_tweet" || pt === "twitter_cpm_tweet_custom") {
        totalCreatorCpmRewards += Number(r.amount) || 0;
      }
    });
    (creatorRefunds || []).forEach((r: any) => {
      if (!metaMatchesContest(r.metadata)) return;
      if (r.remarks && r.remarks !== REVERSAL_TRANSACTION_REMARK) return;
      const pt = r.metadata?.payout_type;
      if (pt === "twitter_cpm_bulk") {
        const tc = Number(r.metadata?.total_cpm);
        if (!Number.isNaN(tc) && tc > 0) {
          totalCreatorCpmRefunds += tc;
        }
        return;
      }
      if (pt === "twitter_cpm_tweet" || pt === "twitter_cpm_tweet_custom") {
        totalCreatorCpmRefunds += Number(r.amount) || 0;
      }
    });
    let runningCapTotal = Math.max(
      0,
      totalCreatorCpmRewards - totalCreatorCpmRefunds
    );

    const [
      { data: contestBonusRewards },
      { data: contestBonusRefunds },
    ] = await Promise.all([
      supabaseAdmin
        .from("money_transactions")
        .select("amount, metadata, created_at")
        .eq("type", "reward")
        .contains("metadata", { contest_id: contestId, bonus_type: "flat_fee" }),
      supabaseAdmin
        .from("money_transactions")
        .select("amount, metadata, remarks")
        .eq("type", "refund")
        .contains("metadata", { contest_id: contestId, bonus_type: "flat_fee" }),
    ] as any);

    const contestBonusRewardSum = (contestBonusRewards || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0
    );
    const contestBonusRefundSum = (contestBonusRefunds || [])
      .filter(
        (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK
      )
      .reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    let contestBonusSpentNet = Math.max(
      0,
      contestBonusRewardSum - contestBonusRefundSum
    );

    const netBonusForTweet = (tweetId: string): number => {
      let tweetR = 0;
      let tweetRef = 0;
      let bulkR = 0;
      (contestBonusRewards || []).forEach((r: any) => {
        const m = r.metadata || {};
        if (String(m.contest_id) !== String(contestId)) return;
        if (m.bonus_type !== "flat_fee") return;
        if (m.tweet_id != null && String(m.tweet_id) === String(tweetId)) {
          tweetR += Number(r.amount) || 0;
        }
        const br = m.twitter_bulk_bonus_breakdown;
        if (br && typeof br === "object" && br[String(tweetId)] != null) {
          bulkR += Number(br[String(tweetId)]) || 0;
        }
      });
      (contestBonusRefunds || [])
        .filter(
          (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK
        )
        .forEach((r: any) => {
          const m = r.metadata || {};
          if (String(m.contest_id) !== String(contestId)) return;
          if (m.tweet_id != null && String(m.tweet_id) === String(tweetId)) {
            tweetRef += Number(r.amount) || 0;
          }
        });
      return Math.max(0, tweetR + bulkR - tweetRef);
    };

    const cpmBreakdown: Record<string, number> = {};
    const bonusBreakdown: Record<string, number> = {};
    let skippedCount = 0;

    for (const tweet of sorted) {
      if (tweet.moderation_status === "rejected") {
        skippedCount++;
        continue;
      }
      if (
        tweet.moderation_status !== "verified" &&
        tweet.moderation_status !== "paid"
      ) {
        skippedCount++;
        continue;
      }

      const tweetId = tweet.id;

      if (paymentType !== "bonus") {
        if (tweet.moderation_status === "paid") {
          // CPM already recorded for this tweet
        } else {
          const [{ data: twRewards }, { data: twRefunds }] = await Promise.all([
            supabaseAdmin
              .from("money_transactions")
              .select("amount")
              .eq("user_id", creatorId)
              .eq("type", "reward")
              .contains("metadata", { contest_id: contestId, tweet_id: tweetId }),
            supabaseAdmin
              .from("money_transactions")
              .select("amount")
              .eq("user_id", creatorId)
              .eq("type", "refund")
              .contains("metadata", { contest_id: contestId, tweet_id: tweetId }),
          ] as any);
          const twR = (twRewards || []).reduce(
            (s: number, x: any) => s + (Number(x.amount) || 0),
            0
          );
          const twRef = (twRefunds || []).reduce(
            (s: number, x: any) => s + (Number(x.amount) || 0),
            0
          );
          if (twR - twRef > 0) {
            skippedCount++;
          } else {
            const basePoints = tweet.points || 0;
            const manualAdj = tweet.manual_points_adjustment || 0;
            const totalPoints = Math.max(0, basePoints + manualAdj);
            let raw = Math.round((totalPoints * cpmRate * 100) / 1000);
            if (raw > 0 && maxEarningsPerCreator != null) {
              const remaining = maxEarningsPerCreator - runningCapTotal;
              if (remaining <= 0) {
                raw = 0;
              } else {
                raw = Math.min(raw, remaining);
              }
            }
            const adjusted =
              raw > 0 && shouldAdjustReward
                ? applyPayoutAdjustment(raw, payoutAdjustmentPercentage)
                : raw;
            if (adjusted > 0) {
              runningCapTotal += adjusted;
              cpmBreakdown[String(tweetId)] = adjusted;
            } else {
              skippedCount++;
            }
          }
        }
      }

      if (paymentType !== "standard" && flatFeeBonus > 0) {
        const existingBonus = netBonusForTweet(String(tweetId));
        if (existingBonus >= flatFeeBonus) {
          if (paymentType === "bonus") skippedCount++;
        } else {
          let bonusAmt = flatFeeBonus;
          if (flatFeeBonusCap != null) {
            const remainingCap = flatFeeBonusCap - contestBonusSpentNet;
            if (remainingCap <= 0) {
              bonusAmt = 0;
            } else if (remainingCap < bonusAmt) {
              bonusAmt = remainingCap;
            }
          }
          const adjustedBonus =
            bonusAmt > 0 && shouldAdjustBonus
              ? applyPayoutAdjustment(bonusAmt, payoutAdjustmentPercentage)
              : bonusAmt;
          if (adjustedBonus > 0) {
            bonusBreakdown[String(tweetId)] =
              (bonusBreakdown[String(tweetId)] || 0) + adjustedBonus;
            contestBonusSpentNet += adjustedBonus;
          } else if (paymentType === "bonus") {
            skippedCount++;
          }
        }
      }
    }

    const paidCount = new Set([
      ...Object.keys(cpmBreakdown),
      ...Object.keys(bonusBreakdown),
    ]).size;

    const totalCpm = Object.values(cpmBreakdown).reduce((a, b) => a + b, 0);
    const totalBonus = Object.values(bonusBreakdown).reduce((a, b) => a + b, 0);
    const totalAmount = totalCpm + totalBonus;

    if (totalAmount <= 0) {
      return NextResponse.json(
        {
          error:
            "No payments to process. Tweets may already be paid or caps/budget exhausted.",
        },
        { status: 400 }
      );
    }

    const creditMetadata: Record<string, unknown> = {
      contest_id: contestId,
      twitter_creator_id: creatorId,
      payout_type: "twitter_cpm_bulk",
      payment_type: paymentType,
      cpm_breakdown:
        Object.keys(cpmBreakdown).length > 0 ? cpmBreakdown : undefined,
      twitter_bulk_bonus_breakdown:
        Object.keys(bonusBreakdown).length > 0 ? bonusBreakdown : undefined,
      total_cpm: totalCpm,
      total_bonus: totalBonus,
      tweet_count: tweetIds.length,
    };
    if (totalBonus > 0) {
      creditMetadata.bonus_type = "flat_fee";
    }

    const creditRes = await creditCreatorWithdrawableBalance(
      creatorId,
      totalAmount,
      `Twitter CPM bulk payment — ${contest.title || "Contest"}`,
      {
        remarks: `Twitter CPM bulk (${paymentType})`,
        metadata: creditMetadata,
      }
    );

    if (!creditRes.success) {
      return NextResponse.json(
        { error: `Failed to credit creator: ${creditRes.error}` },
        { status: 500 }
      );
    }

    for (const [tid, cents] of Object.entries(cpmBreakdown)) {
      const { error: upErr } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .update({ moderation_status: "paid", earnings: cents })
        .eq("id", tid)
        .eq("contest_id", contestId);
      if (upErr) {
        console.error("[bulk-pay-twitter-cpm] Tweet update failed:", tid, upErr);
      }
    }

    if (totalCpm > 0) {
      const { error: rpcErr } = await supabaseAdmin.rpc(
        "add_twitter_leaderboard_cpm_earnings_delta",
        {
          p_contest_id: contestId,
          p_creator_id: creatorId,
          p_delta_cents: totalCpm,
        }
      );
      if (rpcErr) {
        console.error(
          "[bulk-pay-twitter-cpm] Leaderboard earnings delta RPC failed:",
          rpcErr
        );
        return NextResponse.json(
          {
            error:
              "Payment credited but leaderboard earnings could not be updated. Please contact support.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Bulk Twitter CPM payment processed",
      data: {
        total_amount: totalAmount,
        total_cpm: totalCpm,
        total_bonus: totalBonus,
        paid_count: paidCount,
        skipped_count: skippedCount,
        transaction_id: creditRes.transactionId,
        cpm_breakdown: cpmBreakdown,
        bonus_breakdown: bonusBreakdown,
      },
    });
  } catch (error: any) {
    console.error("[bulk-pay-twitter-cpm] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
