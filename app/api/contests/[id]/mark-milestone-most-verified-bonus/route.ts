import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  creditCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import { buildWalletRollbackDebitIdempotencyKey } from "@/lib/bulk-payment-rollback";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import {
  clawbackMostVerifiedBonusForCreator,
  computeMostVerifiedBonusPaidByTrack,
} from "@/lib/milestone-most-verified-bonus-clawback";
import {
  buildMilestoneMostVerifiedBonusByCreatorMapFromDetails,
  collectMilestoneBonusConfigs,
  type MilestoneBudgetSubmission,
} from "@/lib/milestone-contest-expected-spend";
import { isMilestoneContestType, isDualRewardsContestType } from "@/lib/contest-type";
import {
  checkDualRewardsPoolBudgetForPayment,
  rollbackDualRewardsPoolCommitIfNeeded,
  getDualRewardsSubmissionPaidComponents,
  type DualPoolBudgetPaymentResult,
  type DualPoolSpendComponents,
} from "@/lib/dual-rewards-pool-budget";
import {
  adjustBonusCents,
  parsePayoutAdjustment,
} from "@/lib/payout-rules";
import {
  buildDualRewardsPayoutPersistValue,
  dualRewardsPayoutForMilestoneTotal,
} from "@/lib/dual-rewards-payout";

function normalizeStatus(raw: string | null | undefined): string {
  const t = String(raw || "pending").toLowerCase();
  return t === "approved" ? "verified" : t;
}

function isVerifiedLike(st: string): boolean {
  return st === "verified" || st === "paid" || st === "approved";
}

type MilestoneMostVerifiedSubmissionRow = MilestoneBudgetSubmission & {
  dual_rewards_payout?: unknown;
  bonus_paid_at?: string | null;
};

function submissionMetadataRecord(
  metadata: MilestoneMostVerifiedSubmissionRow["metadata"],
): Record<string, unknown> {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
  ) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
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

    const { isAdmin, user: adminUser } = await verifyAdminAccess();
    if (!isAdmin || !adminUser) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: contest, error: contestError } = await supabaseAdmin
      .from("contests")
      .select(
        "id, title, contest_type, platform, contest_based_details, post_contest_status, payout_adjustment_percentage, payout_adjustment_mode",
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

    const details =
      (contest.contest_based_details as Record<string, unknown> | null) || null;
    const contestPlatform = (contest as { platform?: string | null }).platform;
    const bonusConfigs = collectMilestoneBonusConfigs(details, contestPlatform);
    if (bonusConfigs.length === 0) {
      return NextResponse.json(
        { error: "Milestone bonus is not enabled for this contest" },
        { status: 400 },
      );
    }

    const { data: subs, error: subsError } =
      await fetchContestSubmissionsAllPages<MilestoneMostVerifiedSubmissionRow>(
        supabaseAdmin,
        contestId,
        "id, creator_id, status, views, created_at, bonus_paid, bonus_amount, milestone_bonus_paid, metadata, earnings, paid, dual_rewards_payout, platform, other_stats",
        { order: { column: "created_at", ascending: true } },
      );

    if (subsError) {
      return NextResponse.json(
        {
          error:
            String((subsError as { message?: string })?.message ?? subsError) ||
            "Failed to load submissions",
        },
        { status: 500 },
      );
    }

    const submissions = subs || [];
    const map = buildMilestoneMostVerifiedBonusByCreatorMapFromDetails(
      submissions,
      details,
      contestPlatform,
    );
    const row =
      map.get(String(creatorId).trim()) ??
      map.get(creatorId);
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

    const paidByTrack = computeMostVerifiedBonusPaidByTrack(
      paidRewards,
      paidRefunds,
    );

    if (reversal) {
      const clawback = await clawbackMostVerifiedBonusForCreator({
        supabaseAdmin,
        contestId,
        contestTitle: contest.title || "Contest",
        contestType: contest.contest_type,
        creatorId,
        tracks: [track],
        submissions,
      });
      if (!clawback.ok) {
        return NextResponse.json(
          { error: clawback.error || "Failed to reverse Most Verified bonus" },
          { status: clawback.reversedCents > 0 ? 500 : 400 },
        );
      }
      const reversalAmount =
        track === "views" ? clawback.byTrack.views : clawback.byTrack.reels;
      if (reversalAmount <= 0) {
        return NextResponse.json(
          { error: "Nothing paid for this track to reverse" },
          { status: 400 },
        );
      }

      revalidateLeaderboardCache(contestId);
      return NextResponse.json({
        success: true,
        reversedCents: reversalAmount,
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

    const creatorSubs = submissions.filter((s) => s.creator_id === creatorId);

    const verifiedLike = creatorSubs.filter((s) =>
      isVerifiedLike(normalizeStatus(s.status)),
    );

    const withBonus = creatorSubs.filter((s) => s.bonus_paid === true);
    let target: MilestoneMostVerifiedSubmissionRow | undefined;
    if (withBonus.length > 0) {
      target = [...withBonus].sort(
        (a, b) => (Number(b.bonus_amount) || 0) - (Number(a.bonus_amount) || 0),
      )[0];
    } else if (verifiedLike.length > 0) {
      target = [...verifiedLike].sort(
        (a, b) =>
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

    let dualRewardsPoolCommit: DualPoolBudgetPaymentResult | undefined;
    let dualPaidComponents: DualPoolSpendComponents | null = null;

    if (isDualRewardsContestType(contest.contest_type)) {
      dualPaidComponents = getDualRewardsSubmissionPaidComponents({
        id: String(target.id),
        earnings: target.earnings,
        paid: target.paid,
        bonus_amount: target.bonus_amount,
        bonus_paid: target.bonus_paid,
        dual_rewards_payout: target.dual_rewards_payout,
      });
      dualRewardsPoolCommit = await checkDualRewardsPoolBudgetForPayment({
        supabaseAdmin,
        contest: contest as any,
        contestId,
        targetSubmissionId: String(target.id),
        targetAfter: {
          cpmCents: dualPaidComponents.cpmCents,
          milestoneCents: dualPaidComponents.milestoneCents + creditCents,
        },
      });
      if (!dualRewardsPoolCommit.ok) {
        const denied = dualRewardsPoolCommit.check;
        return NextResponse.json(
          {
            error: denied.error,
            details: {
              poolBudgetCents: denied.poolBudgetCents,
              projectedSpentCents: denied.projectedSpentCents,
              remainingCents: denied.remainingCents,
              additionalBonusCents: creditCents,
            },
          },
          { status: 400 },
        );
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
      await rollbackDualRewardsPoolCommitIfNeeded(
        supabaseAdmin,
        contestId,
        String(target.id),
        dualRewardsPoolCommit,
      );
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
    const prevMeta = submissionMetadataRecord(target.metadata);
    // Prefer the first-class column; fall back to legacy metadata during rollout.
    const prevTrackPaidRawFromColumn =
      target.milestone_bonus_paid &&
      typeof target.milestone_bonus_paid === "object"
        ? target.milestone_bonus_paid
        : null;
    const prevTrackPaidRawFromMeta =
      prevMeta.milestone_bonus_paid &&
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

    const creditSubmissionUpdate: Record<string, unknown> = {
      bonus_paid: true,
      bonus_paid_at: new Date().toISOString(),
      bonus_amount: prevAmount + creditCents,
      milestone_bonus_paid: nextTrackPaid,
      metadata: metaWithoutLegacy,
    };

    if (dualPaidComponents) {
      creditSubmissionUpdate.dual_rewards_payout =
        buildDualRewardsPayoutPersistValue(
          {
            cpm_cents: dualPaidComponents.cpmCents,
            milestone_cents: dualPaidComponents.milestoneCents + creditCents,
          },
          {
            updatedBy: adminUser.id,
            customRemarks: `Milestone most verified ${track} bonus`,
          },
        );
    }

    const { error: updErr } = await supabaseAdmin
      .from("submissions")
      .update(creditSubmissionUpdate)
      .eq("id", target.id);

    if (updErr) {
      await rollbackDualRewardsPoolCommitIfNeeded(
        supabaseAdmin,
        contestId,
        String(target.id),
        dualRewardsPoolCommit,
      );
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
