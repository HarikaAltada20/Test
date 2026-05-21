import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  creditCreatorWithdrawableBalance,
  debitCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import {
  buildMilestoneMostVerifiedBonusByCreatorMap,
  type MilestoneBudgetSubmission,
} from "@/lib/milestone-contest-expected-spend";
import { isMilestoneContestType, isDualRewardsContestType } from "@/lib/contest-type";
import {
  fetchDualRewardsPoolSpendRows,
  getDualRewardsPoolBudgetCents,
  getDualRewardsSubmissionPaidComponents,
  validateDualRewardsPoolBudget,
} from "@/lib/dual-rewards-pool-budget";
import {
  adjustBonusCents,
  parsePayoutAdjustment,
} from "@/lib/payout-rules";

function normalizeStatus(raw: string | null | undefined): string {
  const t = String(raw || "pending").toLowerCase();
  return t === "approved" ? "verified" : t;
}

function isVerifiedLike(st: string): boolean {
  return st === "verified" || st === "paid" || st === "approved";
}

/**
 * POST /api/contests/[id]/mark-milestone-most-verified-bonus
 * Admin: credit creator wallet and record bonus_amount on a submission for
 * milestone "most verified views" or "most verified reels" winner payout.
 *
 * Body: { creatorId: string, track: "views" | "reels", reversal?: boolean }
 * When `reversal` is true, debits the creator by the net amount paid for that
 * track (from ledger), logs a refund row, and decrements `milestone_bonus_paid` / `bonus_amount` on the same submission used for payouts.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: contestId } = await params;
    const body = await request.json();
    const creatorId = body?.creatorId as string | undefined;
    const track = body?.track as "views" | "reels" | undefined;
    const reversal = Boolean(body?.reversal);

    if (!creatorId || (track !== "views" && track !== "reels")) {
      return NextResponse.json(
        { error: "creatorId and track ('views' | 'reels') are required" },
        { status: 400 },
      );
    }

    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: contest, error: contestError } = await supabaseAdmin
      .from("contests")
      .select(
        "id, title, contest_type, contest_based_details, post_contest_status, payout_adjustment_percentage, payout_adjustment_mode",
      )
      .eq("id", contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    if (!isMilestoneContestType(contest.contest_type)) {
      return NextResponse.json(
        { error: "Contest is not a milestone or dual rewards contest" },
        { status: 400 },
      );
    }

    if (contest.post_contest_status !== "verification_complete") {
      return NextResponse.json(
        {
          error:
            "Most verified milestone bonuses can only be marked when contest post-status is verification_complete",
        },
        { status: 400 },
      );
    }

    const bonus = (contest.contest_based_details as any)?.milestone_contest
      ?.bonus;
    if (!bonus?.enabled) {
      return NextResponse.json(
        { error: "Milestone bonus is not enabled for this contest" },
        { status: 400 },
      );
    }

    const { data: subs, error: subsError } = await supabaseAdmin
      .from("submissions")
      .select(
        "id, creator_id, status, views, created_at, bonus_paid, bonus_amount, milestone_bonus_paid, metadata, earnings, paid, dual_rewards_payout",
      )
      .eq("contest_id", contestId);

    if (subsError) {
      return NextResponse.json(
        { error: subsError.message || "Failed to load submissions" },
        { status: 500 },
      );
    }

    const submissions = (subs || []) as MilestoneBudgetSubmission[];
    const map = buildMilestoneMostVerifiedBonusByCreatorMap(submissions, bonus);
    const row = map.get(creatorId);
    if (!row) {
      return NextResponse.json(
        { error: "No bonus data for this creator" },
        { status: 400 },
      );
    }

    const V = row.viewsExpectedCents;
    const R = row.expectedCents;

    const { data: paidRewards, error: paidRewardsError } = await supabaseAdmin
      .from("money_transactions")
      .select("amount, metadata")
      .eq("user_id", creatorId)
      .eq("type", "reward")
      .eq("status", "success")
      .contains("metadata", { contest_id: contestId });

    if (paidRewardsError) {
      return NextResponse.json(
        {
          error:
            paidRewardsError.message ||
            "Failed to load creator reward history for milestone bonus",
        },
        { status: 500 },
      );
    }

    const { data: paidRefunds, error: paidRefundsError } = await supabaseAdmin
      .from("money_transactions")
      .select("amount, metadata, remarks")
      .eq("user_id", creatorId)
      .eq("type", "refund")
      .eq("status", "success")
      .contains("metadata", { contest_id: contestId });

    if (paidRefundsError) {
      return NextResponse.json(
        {
          error:
            paidRefundsError.message ||
            "Failed to load creator refund history for milestone bonus",
        },
        { status: 500 },
      );
    }

    const viewsBonusType = "milestone_most_verified_views";
    const reelsBonusType = "milestone_most_verified_reels";
    const rewardedByTrack = (paidRewards || []).reduce(
      (sum, tx: any) => {
        const bt = String(tx?.metadata?.bonus_type || "");
        const amt = Number(tx?.amount) || 0;
        if (bt === viewsBonusType) sum.views += amt;
        if (bt === reelsBonusType) sum.reels += amt;
        return sum;
      },
      { views: 0, reels: 0 },
    );
    const refundedByTrack = (paidRefunds || []).reduce(
      (sum, tx: any) => {
        if (tx.remarks && tx.remarks !== REVERSAL_TRANSACTION_REMARK) {
          return sum;
        }
        const bt = String(tx?.metadata?.bonus_type || "");
        const amt = Number(tx?.amount) || 0;
        if (bt === viewsBonusType) sum.views += amt;
        if (bt === reelsBonusType) sum.reels += amt;
        return sum;
      },
      { views: 0, reels: 0 },
    );
    const paidByTrack = {
      views: Math.max(0, rewardedByTrack.views - refundedByTrack.views),
      reels: Math.max(0, rewardedByTrack.reels - refundedByTrack.reels),
    };

    if (reversal) {
      const reversalAmount =
        track === "views" ? paidByTrack.views : paidByTrack.reels;
      if (reversalAmount <= 0) {
        return NextResponse.json(
          { error: "Nothing paid for this track to reverse" },
          { status: 400 },
        );
      }

      const creatorSubs = (subs || []).filter(
        (s: any) => s.creator_id === creatorId,
      );

      const verifiedLike = creatorSubs.filter((s: any) =>
        isVerifiedLike(normalizeStatus(s.status)),
      );
      const withBonus = creatorSubs.filter((s: any) => s.bonus_paid === true);
      let target: (typeof creatorSubs)[0] | undefined;
      if (withBonus.length > 0) {
        target = [...withBonus].sort(
          (a: any, b: any) =>
            (Number(b.bonus_amount) || 0) - (Number(a.bonus_amount) || 0),
        )[0];
      } else if (verifiedLike.length > 0) {
        target = [...verifiedLike].sort(
          (a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )[0];
      }

      if (!target) {
        return NextResponse.json(
          {
            error:
              "No submission found for this creator to update bonus records",
          },
          { status: 400 },
        );
      }

      const debitRes = await debitCreatorWithdrawableBalance(
        creatorId,
        reversalAmount,
      );
      if (!debitRes.success) {
        return NextResponse.json(
          { error: debitRes.error || "Failed to debit creator balance" },
          { status: 400 },
        );
      }

      const paidTrackRefundsForCycle = (paidRefunds || []).filter(
        (tx: any) =>
          (!tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK) &&
          String(tx?.metadata?.bonus_type || "") ===
            `milestone_most_verified_${track}`,
      ).length;
      const nextReversalCycle = paidTrackRefundsForCycle + 1;

      const refundLogged = await logTransactionAsAdmin(
        creatorId,
        "refund",
        reversalAmount,
        "success",
        `Reversal: Milestone most verified ${
          track === "views" ? "views" : "reels"
        } bonus — ${contest.title || "Contest"}`,
        {
          remarks: REVERSAL_TRANSACTION_REMARK,
          paymentMethod: "refund",
          metadata: {
            contest_id: contestId,
            bonus_type: `milestone_most_verified_${track}`,
            submission_id: `${target.id}:milestone_most_verified_${track}:reverse`,
            source_submission_id: target.id,
            payout_cycle: nextReversalCycle,
          },
        },
      );

      if (!refundLogged) {
        await creditCreatorWithdrawableBalance(
          creatorId,
          reversalAmount,
          `Rollback: milestone MV bonus reversal ledger log failed (${contestId} ${track})`,
          {
            idempotencyKey: `milestone_mv_bonus_rev_log_fail:${contestId}:${creatorId}:${track}:${nextReversalCycle}`,
            metadata: { contest_id: contestId },
          },
        );
        return NextResponse.json(
          {
            error:
              "Could not record the refund transaction; creator balance was restored.",
          },
          { status: 500 },
        );
      }

      const prevAmount = Number(target.bonus_amount) || 0;
      const prevMeta =
        target?.metadata && typeof target.metadata === "object"
          ? { ...target.metadata }
          : {};
      const prevTrackPaidRawFromColumn =
        (target as any)?.milestone_bonus_paid &&
        typeof (target as any).milestone_bonus_paid === "object"
          ? (target as any).milestone_bonus_paid
          : null;
      const prevTrackPaidRawFromMeta =
        prevMeta?.milestone_bonus_paid &&
        typeof prevMeta.milestone_bonus_paid === "object"
          ? prevMeta.milestone_bonus_paid
          : null;
      const prevTrackPaidRaw =
        prevTrackPaidRawFromColumn || prevTrackPaidRawFromMeta || {};
      const prevTrackPaid = {
        views: Number(prevTrackPaidRaw?.views || 0),
        reels: Number(prevTrackPaidRaw?.reels || 0),
      };
      const nextTrackPaid = {
        views:
          track === "views"
            ? Math.max(0, prevTrackPaid.views - reversalAmount)
            : prevTrackPaid.views,
        reels:
          track === "reels"
            ? Math.max(0, prevTrackPaid.reels - reversalAmount)
            : prevTrackPaid.reels,
      };
      const newBonusAmount = Math.max(0, prevAmount - reversalAmount);
      const stillBonusPaid =
        newBonusAmount > 0 ||
        nextTrackPaid.views > 0 ||
        nextTrackPaid.reels > 0;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { milestone_bonus_paid: _legacyMilestoneBonusPaid, ...metaWithoutLegacy } =
        prevMeta || {};

      const { error: updErr } = await supabaseAdmin
        .from("submissions")
        .update({
          bonus_paid: stillBonusPaid,
          bonus_paid_at: stillBonusPaid ? (target as any).bonus_paid_at : null,
          bonus_amount: newBonusAmount,
          milestone_bonus_paid: nextTrackPaid,
          metadata: metaWithoutLegacy,
        })
        .eq("id", target.id);

      if (updErr) {
        console.error(
          "[mark-milestone-most-verified-bonus] reversal submission update failed",
          updErr,
        );
        return NextResponse.json(
          {
            error:
              updErr.message ||
              "Wallet was debited and refund logged, but updating the submission failed. Reconcile manually.",
          },
          { status: 500 },
        );
      }

      revalidateLeaderboardCache(contestId);
      return NextResponse.json({
        success: true,
        reversedCents: reversalAmount,
        submissionId: target.id,
        track,
      });
    }

    const payoutAdjustment = parsePayoutAdjustment(
      (contest as any).payout_adjustment_percentage,
      (contest as any).payout_adjustment_mode,
      { contestType: contest.contest_type },
    );

    const configuredCents = track === "views" ? V : R;
    if (configuredCents <= 0) {
      return NextResponse.json(
        {
          error:
            track === "views"
              ? "This creator is not eligible for the most verified views bonus"
              : "This creator is not eligible for the most verified reels bonus",
        },
        { status: 400 },
      );
    }

    const targetTotalForTrack = adjustBonusCents(configuredCents, {
      shouldAdjustBonus:
        payoutAdjustment.shouldAdjustMostVerifiedMilestoneBonus,
      percentage: payoutAdjustment.percentage,
    });
    const alreadyPaid =
      track === "views" ? paidByTrack.views : paidByTrack.reels;
    const creditCents = Math.max(0, targetTotalForTrack - alreadyPaid);

    if (creditCents <= 0) {
      return NextResponse.json(
        { error: "Nothing to pay for this track (already recorded as paid)" },
        { status: 400 },
      );
    }

    const creatorSubs = (subs || []).filter(
      (s: any) => s.creator_id === creatorId,
    );

    const verifiedLike = creatorSubs.filter((s: any) =>
      isVerifiedLike(normalizeStatus(s.status)),
    );

    const withBonus = creatorSubs.filter((s: any) => s.bonus_paid === true);
    let target: (typeof creatorSubs)[0] | undefined;
    if (withBonus.length > 0) {
      target = [...withBonus].sort(
        (a: any, b: any) =>
          (Number(b.bonus_amount) || 0) - (Number(a.bonus_amount) || 0),
      )[0];
    } else if (verifiedLike.length > 0) {
      target = [...verifiedLike].sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )[0];
    }

    if (!target) {
      return NextResponse.json(
        {
          error:
            "No verified submission found for this creator to attach the bonus record",
        },
        { status: 400 },
      );
    }

    if (isDualRewardsContestType(contest.contest_type)) {
      const poolBudgetCents = getDualRewardsPoolBudgetCents(contest as any);
      if (poolBudgetCents > 0) {
        const poolFetch = await fetchDualRewardsPoolSpendRows(
          supabaseAdmin,
          contestId,
        );
        if (poolFetch.error) {
          return NextResponse.json(
            {
              error: "Failed to verify contest pool budget",
              details: poolFetch.error,
            },
            { status: 500 },
          );
        }
        const paidComponents = getDualRewardsSubmissionPaidComponents({
          id: String(target.id),
          earnings: target.earnings,
          paid: target.paid,
          bonus_amount: target.bonus_amount,
          bonus_paid: target.bonus_paid,
          dual_rewards_payout: (target as { dual_rewards_payout?: unknown })
            .dual_rewards_payout,
        });
        const poolCheck = validateDualRewardsPoolBudget({
          poolBudgetCents,
          rows: poolFetch.rows ?? [],
          targetSubmissionId: String(target.id),
          targetAfter: {
            cpmCents: paidComponents.cpmCents,
            milestoneCents: paidComponents.milestoneCents + creditCents,
          },
        });
        if (!poolCheck.allowed) {
          return NextResponse.json(
            {
              error: poolCheck.error,
              details: {
                poolBudgetCents: poolCheck.poolBudgetCents,
                projectedSpentCents: poolCheck.projectedSpentCents,
                remainingCents: poolCheck.remainingCents,
                additionalBonusCents: creditCents,
              },
            },
            { status: 400 },
          );
        }
      }
    }

    const paidTrackRewardsCount = (paidRewards || []).filter(
      (tx: any) =>
        String(tx?.metadata?.bonus_type || "") ===
        `milestone_most_verified_${track}`,
    ).length;
    const paidTrackRefundsCount = (paidRefunds || []).filter(
      (tx: any) =>
        (!tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK) &&
        String(tx?.metadata?.bonus_type || "") ===
          `milestone_most_verified_${track}`,
    ).length;
    const nextBonusCycle =
      paidTrackRewardsCount > paidTrackRefundsCount
        ? paidTrackRewardsCount
        : paidTrackRewardsCount + 1;
    const milestoneMvBonusIdempotencyKey = `milestone_mv_bonus:v2:${contestId}:${creatorId}:${track}:cycle:${nextBonusCycle}`;

    const creditResult = await creditCreatorWithdrawableBalance(
      creatorId,
      creditCents,
      `Milestone most verified ${track === "views" ? "views" : "reels"} bonus — ${
        contest.title || "Contest"
      }`,
      {
        idempotencyKey: milestoneMvBonusIdempotencyKey,
        remarks: `Milestone most_verified_${track} bonus (contest ${contestId})`,
        metadata: {
          contest_id: contestId,
          bonus_type: `milestone_most_verified_${track}`,
          submission_id: `${target.id}:milestone_most_verified_${track}`,
          source_submission_id: target.id,
          payout_cycle: nextBonusCycle,
        },
      },
    );

    if (!creditResult.success) {
      return NextResponse.json(
        {
          error: creditResult.error || "Failed to credit creator balance",
        },
        { status: 500 },
      );
    }

    const prevAmount = target.bonus_paid
      ? Number(target.bonus_amount) || 0
      : 0;
    const prevMeta =
      target?.metadata && typeof target.metadata === "object"
        ? { ...target.metadata }
        : {};
    // Prefer the first-class column; fall back to legacy metadata during rollout.
    const prevTrackPaidRawFromColumn =
      (target as any)?.milestone_bonus_paid &&
      typeof (target as any).milestone_bonus_paid === "object"
        ? (target as any).milestone_bonus_paid
        : null;
    const prevTrackPaidRawFromMeta =
      prevMeta?.milestone_bonus_paid &&
      typeof prevMeta.milestone_bonus_paid === "object"
        ? prevMeta.milestone_bonus_paid
        : null;
    const prevTrackPaidRaw =
      prevTrackPaidRawFromColumn || prevTrackPaidRawFromMeta || {};
    const prevTrackPaid = {
      views: Number(prevTrackPaidRaw?.views || 0),
      reels: Number(prevTrackPaidRaw?.reels || 0),
    };
    const nextTrackPaid =
      track === "views"
        ? {
            views: prevTrackPaid.views + creditCents,
            reels: prevTrackPaid.reels,
          }
        : {
            views: prevTrackPaid.views,
            reels: prevTrackPaid.reels + creditCents,
          };

    // Remove the legacy key from metadata (the column is the source of truth now).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { milestone_bonus_paid: _legacyMilestoneBonusPaid, ...metaWithoutLegacy } =
      prevMeta || {};

    const { error: updErr } = await supabaseAdmin
      .from("submissions")
      .update({
        bonus_paid: true,
        bonus_paid_at: new Date().toISOString(),
        bonus_amount: prevAmount + creditCents,
        milestone_bonus_paid: nextTrackPaid,
        metadata: metaWithoutLegacy,
      })
      .eq("id", target.id);

    if (updErr) {
      return NextResponse.json(
        {
          error:
            updErr.message ||
            "Bonus was credited but failed to update submission — retry safely; duplicate wallet credits are suppressed by idempotency.",
        },
        { status: 500 },
      );
    }
    revalidateLeaderboardCache(contestId);

    return NextResponse.json({
      success: true,
      creditedCents: creditCents,
      submissionId: target.id,
      track,
    });
  } catch (e: any) {
    console.error("[mark-milestone-most-verified-bonus]", e);
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
