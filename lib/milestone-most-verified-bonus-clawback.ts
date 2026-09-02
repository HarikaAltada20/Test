import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";
import {
  creditCreatorWithdrawableBalance,
  debitCreatorReversalClawback,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import { buildWalletRollbackDebitIdempotencyKey } from "@/lib/bulk-payment-rollback";
import { isDualRewardsContestType } from "@/lib/contest-type";
import {
  getDualRewardsSubmissionPaidComponents,
} from "@/lib/dual-rewards-pool-budget";
import {
  dualRewardsPayoutForMilestoneTotal,
} from "@/lib/dual-rewards-payout";
import type { MilestoneBudgetSubmission } from "@/lib/milestone-contest-expected-spend";

export type MvBonusTrack = "views" | "reels";

const VIEWS_BONUS_TYPE = "milestone_most_verified_views";
const REELS_BONUS_TYPE = "milestone_most_verified_reels";

type MilestoneMostVerifiedSubmissionRow = MilestoneBudgetSubmission & {
  dual_rewards_payout?: unknown;
  bonus_paid_at?: string | null;
};

function normalizeStatus(raw: string | null | undefined): string {
  const t = String(raw || "pending").toLowerCase();
  return t === "approved" ? "verified" : t;
}

function isVerifiedLike(st: string): boolean {
  return st === "verified" || st === "paid" || st === "approved";
}

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

export function mvBonusTrackPaidCentsOnSubmission(
  row: Pick<
    MilestoneMostVerifiedSubmissionRow,
    "milestone_bonus_paid" | "metadata"
  > | null | undefined,
  track: MvBonusTrack,
): number {
  if (!row) return 0;
  const fromColumn =
    row.milestone_bonus_paid && typeof row.milestone_bonus_paid === "object"
      ? row.milestone_bonus_paid
      : null;
  const meta = submissionMetadataRecord(row.metadata);
  const fromMeta =
    meta.milestone_bonus_paid && typeof meta.milestone_bonus_paid === "object"
      ? meta.milestone_bonus_paid
      : null;
  const raw = (fromColumn || fromMeta || {}) as { views?: number; reels?: number };
  const cents = Number(raw[track] || 0);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

/** Ledger already clawed back, but the submission row still shows the track as paid. */
export function shouldReconcileMvBonusTrackWithoutDebit(
  ledgerNetCents: number,
  trackPaidOnSubmissionCents: number,
): boolean {
  return ledgerNetCents <= 0 && trackPaidOnSubmissionCents > 0;
}

export function computeMostVerifiedBonusPaidByTrack(
  paidRewards: Array<{ amount?: number | null; metadata?: unknown }> | null | undefined,
  paidRefunds: Array<{
    amount?: number | null;
    metadata?: unknown;
    remarks?: string | null;
  }> | null | undefined,
): { views: number; reels: number } {
  const rewardedByTrack = (paidRewards || []).reduce(
    (sum, tx) => {
      const bt = String((tx as { metadata?: { bonus_type?: string } })?.metadata?.bonus_type || "");
      const amt = Number(tx?.amount) || 0;
      if (bt === VIEWS_BONUS_TYPE) sum.views += amt;
      if (bt === REELS_BONUS_TYPE) sum.reels += amt;
      return sum;
    },
    { views: 0, reels: 0 },
  );
  const refundedByTrack = (paidRefunds || []).reduce(
    (sum, tx) => {
      if (tx.remarks && tx.remarks !== REVERSAL_TRANSACTION_REMARK) {
        return sum;
      }
      const bt = String((tx as { metadata?: { bonus_type?: string } })?.metadata?.bonus_type || "");
      const amt = Number(tx?.amount) || 0;
      if (bt === VIEWS_BONUS_TYPE) sum.views += amt;
      if (bt === REELS_BONUS_TYPE) sum.reels += amt;
      return sum;
    },
    { views: 0, reels: 0 },
  );
  return {
    views: Math.max(0, rewardedByTrack.views - refundedByTrack.views),
    reels: Math.max(0, rewardedByTrack.reels - refundedByTrack.reels),
  };
}

function pickTargetSubmission(
  creatorSubs: MilestoneMostVerifiedSubmissionRow[],
): MilestoneMostVerifiedSubmissionRow | undefined {
  const verifiedLike = creatorSubs.filter((s) =>
    isVerifiedLike(normalizeStatus(s.status)),
  );
  const withBonus = creatorSubs.filter((s) => s.bonus_paid === true);
  if (withBonus.length > 0) {
    return [...withBonus].sort(
      (a, b) => (Number(b.bonus_amount) || 0) - (Number(a.bonus_amount) || 0),
    )[0];
  }
  if (verifiedLike.length > 0) {
    return [...verifiedLike].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )[0];
  }
  return undefined;
}

async function clawbackMostVerifiedBonusTrack(params: {
  supabaseAdmin: SupabaseClient;
  contestId: string;
  contestTitle: string;
  contestType: string | null | undefined;
  creatorId: string;
  track: MvBonusTrack;
  reversalAmount: number;
  submissions: MilestoneMostVerifiedSubmissionRow[];
  paidRefunds: Array<{
    amount?: number | null;
    metadata?: unknown;
    remarks?: string | null;
  }>;
  /** Wallet + refund ledger already settled; only repair submission flags. */
  walletAlreadySettled?: boolean;
}): Promise<{ ok: boolean; reversedCents: number; error?: string }> {
  const {
    supabaseAdmin,
    contestId,
    contestTitle,
    contestType,
    creatorId,
    track,
    reversalAmount,
    submissions,
    paidRefunds,
    walletAlreadySettled = false,
  } = params;

  if (reversalAmount <= 0) {
    return { ok: true, reversedCents: 0 };
  }

  const creatorSubs = submissions.filter((s) => s.creator_id === creatorId);
  const target = pickTargetSubmission(creatorSubs);
  if (!target) {
    if (walletAlreadySettled) {
      return { ok: true, reversedCents: 0 };
    }
    return {
      ok: false,
      reversedCents: 0,
      error: "No submission found for this creator to update bonus records",
    };
  }

  if (!walletAlreadySettled) {
    const paidTrackRefundsForCycle = paidRefunds.filter(
      (tx) =>
        (!tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK) &&
        String((tx as { metadata?: { bonus_type?: string } })?.metadata?.bonus_type || "") ===
          `milestone_most_verified_${track}`,
    ).length;
    const nextReversalCycle = paidTrackRefundsForCycle + 1;

    const reversalDebitKey = buildWalletRollbackDebitIdempotencyKey({
      payoutOperationKey: `milestone_mv_bonus_rev:v1:${contestId}:${creatorId}:${track}:cycle:${nextReversalCycle}`,
      reason: "milestone_mv_bonus_reversal",
    });
    const debitRes = await debitCreatorReversalClawback(creatorId, reversalAmount, {
      idempotencyKey: reversalDebitKey,
    });
    if (!debitRes.success) {
      return {
        ok: false,
        reversedCents: 0,
        error: debitRes.error || "Failed to debit creator balance",
      };
    }

    const refundLogged = await logTransactionAsAdmin(
      creatorId,
      "refund",
      reversalAmount,
      "success",
      `Reversal: Milestone most verified ${
        track === "views" ? "views" : "reels"
      } bonus — ${contestTitle || "Contest"}`,
      {
        remarks: REVERSAL_TRANSACTION_REMARK,
        paymentMethod: "refund",
        metadata: {
          contest_id: contestId,
          bonus_type: `milestone_most_verified_${track}`,
          submission_id: `${target.id}:milestone_most_verified_${track}:reverse`,
          source_submission_id: target.id,
          payout_cycle: nextReversalCycle,
          wallet_rollback_debit_key: reversalDebitKey,
          wallet_rollback_already_applied: Boolean(debitRes.alreadyApplied),
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
      return {
        ok: false,
        reversedCents: 0,
        error:
          "Could not record the refund transaction; creator balance was restored.",
      };
    }
  }

  const prevAmount = Number(target.bonus_amount) || 0;
  const prevMeta = submissionMetadataRecord(target.metadata);
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
    views: Number((prevTrackPaidRaw as { views?: number }).views || 0),
    reels: Number((prevTrackPaidRaw as { reels?: number }).reels || 0),
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

  const reversalSubmissionUpdate: Record<string, unknown> = {
    bonus_paid: stillBonusPaid,
    bonus_paid_at: stillBonusPaid ? target.bonus_paid_at : null,
    bonus_amount: newBonusAmount,
    milestone_bonus_paid: nextTrackPaid,
    metadata: metaWithoutLegacy,
  };

  if (isDualRewardsContestType(contestType)) {
    const paidComponents = getDualRewardsSubmissionPaidComponents({
      id: String(target.id),
      earnings: target.earnings,
      paid: target.paid,
      bonus_amount: target.bonus_amount,
      bonus_paid: target.bonus_paid,
      dual_rewards_payout: target.dual_rewards_payout,
    });
    reversalSubmissionUpdate.dual_rewards_payout =
      dualRewardsPayoutForMilestoneTotal(
        target.dual_rewards_payout,
        paidComponents.cpmCents,
        Math.max(0, paidComponents.milestoneCents - reversalAmount),
      );
  }

  const { error: updErr } = await supabaseAdmin
    .from("submissions")
    .update(reversalSubmissionUpdate)
    .eq("id", target.id);

  if (updErr) {
    console.error(
      "[milestone-most-verified-bonus-clawback] submission update failed",
      updErr,
    );
    return {
      ok: false,
      reversedCents: walletAlreadySettled ? 0 : reversalAmount,
      error:
        updErr.message ||
        (walletAlreadySettled
          ? "Could not update submission bonus flags after wallet clawback."
          : "Wallet was debited and refund logged, but updating the submission failed."),
    };
  }

  return {
    ok: true,
    reversedCents: walletAlreadySettled ? 0 : reversalAmount,
  };
}

/**
 * Claw back paid Most Verified bonus (views/reels tracks) for one creator.
 * Uses ledger net paid per track; allows negative creator balance.
 */
export async function clawbackMostVerifiedBonusForCreator(params: {
  supabaseAdmin: SupabaseClient;
  contestId: string;
  contestTitle?: string;
  contestType?: string | null;
  creatorId: string;
  tracks?: MvBonusTrack[];
  submissions?: MilestoneMostVerifiedSubmissionRow[];
}): Promise<{
  ok: boolean;
  reversedCents: number;
  byTrack: { views: number; reels: number };
  error?: string;
}> {
  const tracks = params.tracks ?? (["views", "reels"] as MvBonusTrack[]);
  const contestTitle = params.contestTitle || "Contest";

  const [{ data: paidRewards, error: rewardsErr }, { data: paidRefunds, error: refundsErr }] =
    await Promise.all([
      params.supabaseAdmin
        .from("money_transactions")
        .select("amount, metadata")
        .eq("user_id", params.creatorId)
        .eq("type", "reward")
        .eq("status", "success")
        .contains("metadata", { contest_id: params.contestId }),
      params.supabaseAdmin
        .from("money_transactions")
        .select("amount, metadata, remarks")
        .eq("user_id", params.creatorId)
        .eq("type", "refund")
        .eq("status", "success")
        .contains("metadata", { contest_id: params.contestId }),
    ]);

  if (rewardsErr || refundsErr) {
    return {
      ok: false,
      reversedCents: 0,
      byTrack: { views: 0, reels: 0 },
      error:
        rewardsErr?.message ||
        refundsErr?.message ||
        "Failed to load creator transaction history",
    };
  }

  const paidByTrack = computeMostVerifiedBonusPaidByTrack(paidRewards, paidRefunds);

  let submissions = params.submissions;
  if (!submissions) {
    const { data: subs, error: subsErr } =
      await fetchContestSubmissionsAllPages<MilestoneMostVerifiedSubmissionRow>(
        params.supabaseAdmin,
        params.contestId,
        "id, creator_id, status, views, created_at, bonus_paid, bonus_amount, milestone_bonus_paid, metadata, earnings, paid, dual_rewards_payout, bonus_paid_at",
        { order: { column: "created_at", ascending: true } },
      );
    if (subsErr) {
      return {
        ok: false,
        reversedCents: 0,
        byTrack: { views: 0, reels: 0 },
        error: String((subsErr as { message?: string })?.message ?? subsErr),
      };
    }
    submissions = subs || [];
  }

  const byTrack = { views: 0, reels: 0 };
  let totalReversed = 0;

  for (const track of tracks) {
    const ledgerNet =
      track === "views" ? paidByTrack.views : paidByTrack.reels;
    const target = pickTargetSubmission(
      submissions.filter((s) => s.creator_id === params.creatorId),
    );
    const rowTrackPaid = mvBonusTrackPaidCentsOnSubmission(target, track);
    const walletAlreadySettled = shouldReconcileMvBonusTrackWithoutDebit(
      ledgerNet,
      rowTrackPaid,
    );
    const reversalAmount = walletAlreadySettled ? rowTrackPaid : ledgerNet;
    if (reversalAmount <= 0) continue;

    const result = await clawbackMostVerifiedBonusTrack({
      supabaseAdmin: params.supabaseAdmin,
      contestId: params.contestId,
      contestTitle,
      contestType: params.contestType,
      creatorId: params.creatorId,
      track,
      reversalAmount,
      submissions,
      paidRefunds: paidRefunds || [],
      walletAlreadySettled,
    });

    if (!result.ok) {
      return {
        ok: false,
        reversedCents: totalReversed,
        byTrack,
        error: result.error,
      };
    }

    byTrack[track] = result.reversedCents;
    totalReversed += result.reversedCents;
  }

  return { ok: true, reversedCents: totalReversed, byTrack };
}
