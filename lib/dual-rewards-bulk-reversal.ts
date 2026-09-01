import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";
import {
  debitCreatorReversalClawback,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import {
  computeDualRewardsSubmissionReversalDue,
  filterMoneyTxnsForContest,
  submissionIdFromMoneyTxnMetadata,
  type DualPoolSpendSubmissionRow,
  type DualRewardsSubmissionReversalDue,
} from "@/lib/dual-rewards-pool-budget";
import { fetchByIdsInChunks } from "@/lib/supabase-in-id-chunks";
import {
  buildSubmissionPaidReversalUpdate,
  buildSubmissionPaidStateClearUpdate,
} from "@/lib/dual-rewards-payout";
import { submissionHasUnclearedPayment } from "@/lib/contest-detail-submission-status-counts";

export type BulkDualReversalRefundSummary = {
  reward_refunded_cents: number;
  bonus_refunded_cents: number;
  total_refunded_cents: number;
  cpm_refunded_cents: number;
  milestone_refunded_cents: number;
};

export type BulkDualWalletReversalResult =
  | {
      ok: true;
      skipWalletDebitIds: Set<string>;
      refundSummaryBySubmissionId: Map<string, BulkDualReversalRefundSummary>;
    }
  | { ok: false; error: string; failedSubmissionIds?: string[] };

type SubmissionRow = {
  id: string;
  contest_id: string;
  creator_id: string;
  status: string | null;
  earnings: number | null;
  paid: boolean | null;
  paid_at: string | null;
  bonus_paid: boolean | null;
  bonus_paid_at: string | null;
  bonus_amount: number | null;
  milestone_bonus_paid: unknown;
  metadata: { milestone_bonus_paid?: unknown } | null;
  dual_rewards_payout: unknown;
};

function toSpendRow(row: SubmissionRow): DualPoolSpendSubmissionRow {
  return {
    id: row.id,
    earnings: row.earnings,
    paid: row.paid,
    bonus_amount: row.bonus_amount,
    bonus_paid: row.bonus_paid,
    dual_rewards_payout: row.dual_rewards_payout,
  };
}

type ContestJoinRow = {
  contest_type?: string | null;
  title?: string | null;
};

/** Supabase may type `contests!inner(...)` as an object or a one-element array. */
function contestJoinFromRow(row: {
  contests?: ContestJoinRow | ContestJoinRow[] | null;
}): ContestJoinRow | null {
  const contests = row.contests;
  if (contests == null) return null;
  return Array.isArray(contests) ? (contests[0] ?? null) : contests;
}

function dueToRefundSummary(
  due: DualRewardsSubmissionReversalDue,
): BulkDualReversalRefundSummary {
  const total = Math.max(0, Math.round(due.totalCents));
  if (total <= 0) {
    return {
      reward_refunded_cents: 0,
      bonus_refunded_cents: 0,
      total_refunded_cents: 0,
      cpm_refunded_cents: 0,
      milestone_refunded_cents: 0,
    };
  }
  return {
    reward_refunded_cents: due.mainCents,
    bonus_refunded_cents: due.bonusCents,
    total_refunded_cents: total,
    cpm_refunded_cents: due.mainCents,
    milestone_refunded_cents: due.bonusCents,
  };
}

const STANDARD_BULK_REVERSAL_CONTEST_TYPES = new Set([
  "milestone",
  "cpm",
  "leaderboard",
]);

function isBulkReversalContestType(contestType: string | null | undefined): boolean {
  return (
    contestType === "dual_rewards" ||
    STANDARD_BULK_REVERSAL_CONTEST_TYPES.has(String(contestType || ""))
  );
}

/** One money_transactions refund row for bulk milestone payout reversal. */
export async function logMilestoneBulkReversalRefund(params: {
  creatorId: string;
  contestId: string;
  contestTitle: string;
  submissionCount: number;
  totalCents: number;
  milestoneCents: number;
  bonusCents: number;
  breakdown: Array<{
    submission_id: string;
    milestone_cents: number;
    bonus_cents: number;
  }>;
}): Promise<boolean> {
  const totalCents = Math.max(0, Math.round(params.totalCents));
  if (totalCents <= 0) return true;

  return logTransactionAsAdmin(
    params.creatorId,
    "refund",
    totalCents,
    "success",
    `Bulk reversal for ${params.submissionCount} submissions in contest: ${
      params.contestTitle || "Contest"
    }`,
    {
      remarks: REVERSAL_TRANSACTION_REMARK,
      paymentMethod: "refund",
      metadata: {
        contest_id: params.contestId,
        milestone_refunded_cents: Math.max(
          0,
          Math.round(params.milestoneCents),
        ),
        bonus_refunded_cents: Math.max(0, Math.round(params.bonusCents)),
        bulk_payment_reversal: true,
        submission_count: params.submissionCount,
        breakdown: params.breakdown,
      },
    },
  );
}

/** One money_transactions refund row for bulk standard payout reversal (CPM + bonus). */
export async function logStandardBulkReversalRefund(params: {
  creatorId: string;
  contestId: string;
  contestTitle: string;
  submissionCount: number;
  totalCents: number;
  cpmCents: number;
  bonusCents: number;
  breakdown: Array<{
    submission_id: string;
    cpm_amount: number;
    bonus_amount: number;
  }>;
}): Promise<boolean> {
  const totalCents = Math.max(0, Math.round(params.totalCents));
  if (totalCents <= 0) return true;

  return logTransactionAsAdmin(
    params.creatorId,
    "refund",
    totalCents,
    "success",
    `Bulk reversal for ${params.submissionCount} submissions in contest: ${
      params.contestTitle || "Contest"
    }`,
    {
      remarks: REVERSAL_TRANSACTION_REMARK,
      paymentMethod: "refund",
      metadata: {
        contest_id: params.contestId,
        reward_refunded_cents: Math.max(0, Math.round(params.cpmCents)),
        bonus_refunded_cents: Math.max(0, Math.round(params.bonusCents)),
        bulk_payment_reversal: true,
        submission_count: params.submissionCount,
        breakdown: params.breakdown,
      },
    },
  );
}
export async function logDualRewardsBulkReversalRefund(params: {
  creatorId: string;
  contestId: string;
  contestTitle: string;
  submissionCount: number;
  totalCents: number;
  cpmCents: number;
  milestoneCents: number;
  breakdown: Array<{
    submission_id: string;
    cpm_cents: number;
    milestone_cents: number;
  }>;
}): Promise<boolean> {
  const totalCents = Math.max(0, Math.round(params.totalCents));
  if (totalCents <= 0) return true;

  return logTransactionAsAdmin(
    params.creatorId,
    "refund",
    totalCents,
    "success",
    `Bulk reversal for ${params.submissionCount} submissions in contest: ${
      params.contestTitle || "Contest"
    }`,
    {
      remarks: REVERSAL_TRANSACTION_REMARK,
      paymentMethod: "refund",
      metadata: {
        contest_id: params.contestId,
        cpm_refunded_cents: Math.max(0, Math.round(params.cpmCents)),
        milestone_refunded_cents: Math.max(0, Math.round(params.milestoneCents)),
        dual_rewards_reversal: true,
        bulk_dual_rewards_reversal: true,
        submission_count: params.submissionCount,
        breakdown: params.breakdown,
      },
    },
  );
}

/** One money_transactions refund row per submission (CPM + milestone combined). */
export async function logDualRewardsReversalRefund(params: {
  creatorId: string;
  submissionId: string;
  contestId: string;
  contestTitle: string;
  cpmCents: number;
  milestoneCents: number;
  bulkReversal?: boolean;
}): Promise<boolean> {
  const cpmCents = Math.max(0, Math.round(params.cpmCents));
  const milestoneCents = Math.max(0, Math.round(params.milestoneCents));
  const totalCents = cpmCents + milestoneCents;
  if (totalCents <= 0) return true;

  return logTransactionAsAdmin(
    params.creatorId,
    "refund",
    totalCents,
    "success",
    `Reversal of contest payout - ${params.contestTitle}`,
    {
      remarks: REVERSAL_TRANSACTION_REMARK,
      paymentMethod: "refund",
      metadata: {
        submission_id: params.submissionId,
        contest_id: params.contestId,
        cpm_refunded_cents: cpmCents,
        milestone_refunded_cents: milestoneCents,
        dual_rewards_reversal: true,
        ...(params.bulkReversal ? { bulk_dual_rewards_reversal: true } : {}),
      },
    },
  );
}

function submissionLeftPaidModeration(status: string | null | undefined): boolean {
  const normalized = String(status || "").toLowerCase();
  return (
    normalized === "pending" ||
    normalized === "verified" ||
    normalized === "approved" ||
    normalized === "rejected"
  );
}

function submissionWasPaidBeforeReversal(row: SubmissionRow): boolean {
  if (String(row.status || "").toLowerCase() === "paid") return true;
  return submissionHasUnclearedPayment(row);
}

async function clearPaidFlagsAfterReversal(
  supabaseAdmin: SupabaseClient,
  groupRows: SubmissionRow[],
  perSubDue: Map<string, DualRewardsSubmissionReversalDue>,
  opts?: { onlyWhenDueCleared?: boolean },
): Promise<void> {
  for (const row of groupRows) {
    if (!submissionHasUnclearedPayment(row)) continue;
    const due = perSubDue.get(row.id) ?? {
      totalCents: 0,
      mainCents: 0,
      bonusCents: 0,
      bonusReversals: [],
    };
    if (opts?.onlyWhenDueCleared && due.totalCents > 0) {
      continue;
    }
    const paidRowInput = {
      earnings: row.earnings,
      paid: row.paid,
      paid_at: row.paid_at,
      bonus_paid: row.bonus_paid,
      bonus_paid_at: row.bonus_paid_at,
      bonus_amount: row.bonus_amount,
      milestone_bonus_paid: row.milestone_bonus_paid as never,
      metadata: row.metadata as never,
      dual_rewards_payout: row.dual_rewards_payout,
    };
    const updatePayload = submissionLeftPaidModeration(row.status)
      ? buildSubmissionPaidStateClearUpdate(paidRowInput)
      : buildSubmissionPaidReversalUpdate(paidRowInput, {
          mainCents: due.mainCents,
          bonusCents: due.bonusCents,
          bonusReversals: due.bonusReversals,
        });
    const { error: clearPaidErr } = await supabaseAdmin
      .from("submissions")
      .update(updatePayload)
      .eq("id", row.id);
    if (clearPaidErr) {
      console.error(
        "[dual-rewards-bulk-reversal] Failed to clear paid flags after refund:",
        row.id,
        clearPaidErr,
      );
    }
  }
}

/**
 * Safety sweep after bulk moderation wallet finalize: any row not in `paid`
 * status must not retain paid/earnings flags (prevents pending+paid drift).
 */
export async function reconcileStalePaidFlagsForSubmissionIds(
  supabaseAdmin: SupabaseClient,
  submissionIds: string[],
): Promise<void> {
  const ids = submissionIds.map(String).filter(Boolean);
  if (ids.length === 0) return;

  await fetchByIdsInChunks({
    ids,
    fetchChunk: async (chunkIds) => {
      const result = await supabaseAdmin
        .from("submissions")
        .select(
          "id, status, earnings, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount, milestone_bonus_paid, metadata, dual_rewards_payout",
        )
        .in("id", chunkIds)
        .neq("status", "paid");
      if (result.error) {
        console.error(
          "[dual-rewards-bulk-reversal] reconcile stale paid flags fetch failed:",
          result.error,
        );
        return { data: [], error: result.error };
      }

      for (const row of result.data || []) {
        if (!submissionHasUnclearedPayment(row)) continue;
        const { error } = await supabaseAdmin
          .from("submissions")
          .update(
            buildSubmissionPaidStateClearUpdate({
              earnings: row.earnings,
              paid: row.paid,
              paid_at: row.paid_at,
              bonus_paid: row.bonus_paid,
              bonus_paid_at: row.bonus_paid_at,
              bonus_amount: row.bonus_amount,
              milestone_bonus_paid: row.milestone_bonus_paid as never,
              metadata: row.metadata as never,
              dual_rewards_payout: row.dual_rewards_payout,
            }),
          )
          .eq("id", row.id);
        if (error) {
          console.error(
            "[dual-rewards-bulk-reversal] reconcile stale paid flags update failed:",
            row.id,
            error,
          );
        }
      }
      return { data: [], error: null };
    },
  });
}

/**
 * One atomic wallet debit per creator+contest for bulk paid → verified/pending/rejected.
 * Per-submission verify calls should pass skipWalletDebit: true for returned ids.
 *
 * @param forceWasPaidBeforeReversal — use when status was already moved off `paid`
 *   (queue defer-to-end path) so dues still use earnings/ledger like a live paid reversal.
 */
export async function applyBulkDualRewardsWalletReversals(params: {
  supabaseAdmin: SupabaseClient;
  submissionIds: string[];
  contestTitle?: string;
  forceWasPaidBeforeReversal?: boolean;
}): Promise<BulkDualWalletReversalResult> {
  const ids = params.submissionIds.map(String).filter(Boolean);
  if (ids.length === 0) {
    return { ok: true, skipWalletDebitIds: new Set(), refundSummaryBySubmissionId: new Map() };
  }

  const { data: rows, error: rowsErr } = await fetchByIdsInChunks({
    ids,
    fetchChunk: async (chunkIds) => {
      const result = await params.supabaseAdmin
        .from("submissions")
        .select(
          "id, contest_id, creator_id, status, earnings, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount, milestone_bonus_paid, metadata, dual_rewards_payout, contests!inner(contest_type, title)",
        )
        .in("id", chunkIds);
      return {
        data: (result.data || null) as Array<
          SubmissionRow & {
            contests?: ContestJoinRow | ContestJoinRow[] | null;
          }
        > | null,
        error: result.error,
      };
    },
  });

  if (rowsErr) {
    return { ok: false, error: rowsErr.message };
  }

  const eligibleRows = (rows || []).filter((r) => {
    const contest = contestJoinFromRow(
      r as SubmissionRow & {
        contests?: ContestJoinRow | ContestJoinRow[] | null;
      },
    );
    return isBulkReversalContestType(contest?.contest_type);
  }) as SubmissionRow[];

  if (eligibleRows.length === 0) {
    return { ok: true, skipWalletDebitIds: new Set(), refundSummaryBySubmissionId: new Map() };
  }

  const skipWalletDebitIds = new Set<string>();
  const refundSummaryBySubmissionId = new Map<string, BulkDualReversalRefundSummary>();

  const byCreatorContest = new Map<string, SubmissionRow[]>();
  for (const row of eligibleRows) {
    const key = `${row.creator_id}:${row.contest_id}`;
    const list = byCreatorContest.get(key) || [];
    list.push(row);
    byCreatorContest.set(key, list);
  }

  for (const [, groupRows] of byCreatorContest) {
    const creatorId = groupRows[0].creator_id;
    const contestId = groupRows[0].contest_id;
    const sourceRow = (rows || []).find(
      (r) => String(r.id) === String(groupRows[0].id),
    );
    const contestTitle =
      params.contestTitle ||
      contestJoinFromRow(
        sourceRow as { contests?: ContestJoinRow | ContestJoinRow[] | null },
      )?.title ||
      "Contest";

    const contestType =
      contestJoinFromRow(
        sourceRow as { contests?: ContestJoinRow | ContestJoinRow[] | null },
      )?.contest_type ?? null;
    const isDualRewards = contestType === "dual_rewards";

    const { data: contestSubRows, error: contestSubErr } =
      await fetchContestSubmissionsAllPages(
      params.supabaseAdmin,
      contestId,
      "id",
      {
        creatorId,
        order: { column: "created_at", ascending: true },
      },
    );

    if (contestSubErr) {
      console.error(
        "[dual-rewards-bulk-reversal] Failed to load contest submissions:",
        contestId,
        contestSubErr,
      );
      return {
        ok: false,
        error: `Failed to load contest submissions for reversal: ${
          contestSubErr instanceof Error
            ? contestSubErr.message
            : String(
                (contestSubErr as { message?: string })?.message ||
                  contestSubErr,
              )
        }`,
        failedSubmissionIds: groupRows.map((r) => r.id),
      };
    }

    const contestSubmissionIds = new Set(
      (contestSubRows || []).map((r) => String(r.id)),
    );
    for (const r of groupRows) {
      contestSubmissionIds.add(String(r.id));
    }

    const [{ data: rewardTxnsAll }, { data: refundTxnsAll }] = await Promise.all([
      params.supabaseAdmin
        .from("money_transactions")
        .select("id, amount, metadata")
        .eq("user_id", creatorId)
        .eq("type", "reward"),
      params.supabaseAdmin
        .from("money_transactions")
        .select("id, amount, remarks, metadata")
        .eq("user_id", creatorId)
        .eq("type", "refund"),
    ]);

    const rewardTxns = filterMoneyTxnsForContest(
      rewardTxnsAll,
      contestId,
      contestSubmissionIds,
    );
    const refundTxns = filterMoneyTxnsForContest(
      refundTxnsAll,
      contestId,
      contestSubmissionIds,
    );

    const perSubDue = new Map<string, DualRewardsSubmissionReversalDue>();
    let totalDueCents = 0;

    for (const row of groupRows) {
      const wasPaid =
        params.forceWasPaidBeforeReversal === true ||
        submissionWasPaidBeforeReversal(row);
      const due = computeDualRewardsSubmissionReversalDue({
        submissionRow: toSpendRow(row),
        submissionId: row.id,
        rewardTxns,
        refundTxns,
        reversalRemark: REVERSAL_TRANSACTION_REMARK,
        wasPaidBeforeReversal: wasPaid,
      });
      perSubDue.set(row.id, due);
      if (due.totalCents <= 0) {
        continue;
      }
      totalDueCents += due.totalCents;
      refundSummaryBySubmissionId.set(row.id, dueToRefundSummary(due));
      skipWalletDebitIds.add(row.id);
    }

    if (totalDueCents <= 0) {
      await clearPaidFlagsAfterReversal(
        params.supabaseAdmin,
        groupRows,
        perSubDue,
        { onlyWhenDueCleared: true },
      );
      await reconcileStalePaidFlagsForSubmissionIds(
        params.supabaseAdmin,
        groupRows.map((r) => r.id),
      );
      continue;
    }

    const debitCents = totalDueCents;
    let walletDebitApplied = false;

    if (debitCents > 0) {
      const debitOperationKey = `bulk_paid_reversal:v1:${createHash("sha256")
        .update(
          JSON.stringify({
            contestId,
            creatorId,
            submissionIds: groupRows
              .map((row) => String(row.id))
              .sort((a, b) => a.localeCompare(b)),
            rewardTransactionIds: rewardTxns
              .map((row: any) => String(row.id || ""))
              .filter(Boolean)
              .sort((a: string, b: string) => a.localeCompare(b)),
            refundTransactionIds: refundTxns
              .map((row: any) => String(row.id || ""))
              .filter(Boolean)
              .sort((a: string, b: string) => a.localeCompare(b)),
            debitCents,
          }),
        )
        .digest("hex")
        .slice(0, 48)}`;
      const debitRes = await debitCreatorReversalClawback(
        creatorId,
        debitCents,
        { idempotencyKey: debitOperationKey },
      );
      if (!debitRes.success) {
        for (const row of groupRows) {
          skipWalletDebitIds.delete(row.id);
          refundSummaryBySubmissionId.delete(row.id);
        }
        return {
          ok: false,
          error: `Failed to reverse creator credit (${debitCents}¢ for ${groupRows.length} submission(s)): ${debitRes.error}`,
          failedSubmissionIds: groupRows.map((r) => r.id),
        };
      }
      walletDebitApplied = true;
    }

    if (totalDueCents > 0 && !walletDebitApplied) {
      return {
        ok: false,
        error: `Wallet debit was not applied for ${totalDueCents}¢ reversal. Paid flags were not cleared.`,
        failedSubmissionIds: groupRows.map((r) => r.id),
      };
    }

    const isMilestone = contestType === "milestone";

    const refundBreakdownDual: Array<{
      submission_id: string;
      cpm_cents: number;
      milestone_cents: number;
    }> = [];
    const refundBreakdownMilestone: Array<{
      submission_id: string;
      milestone_cents: number;
      bonus_cents: number;
    }> = [];
    const refundBreakdownStandard: Array<{
      submission_id: string;
      cpm_amount: number;
      bonus_amount: number;
    }> = [];
    let refundCpmTotal = 0;
    let refundMilestoneTotal = 0;
    let refundSubmissionCount = 0;

    for (const row of groupRows) {
      const due = perSubDue.get(row.id);
      if (!due || due.totalCents <= 0) continue;
      if (isDualRewards) {
        refundBreakdownDual.push({
          submission_id: row.id,
          cpm_cents: due.mainCents,
          milestone_cents: due.bonusCents,
        });
      } else if (isMilestone) {
        refundBreakdownMilestone.push({
          submission_id: row.id,
          milestone_cents: due.mainCents,
          bonus_cents: due.bonusCents,
        });
      } else {
        refundBreakdownStandard.push({
          submission_id: row.id,
          cpm_amount: due.mainCents,
          bonus_amount: due.bonusCents,
        });
      }
      refundCpmTotal += due.mainCents;
      refundMilestoneTotal += due.bonusCents;
      refundSubmissionCount++;
    }

    if (refundSubmissionCount > 0) {
      let refundLogged = true;
      if (isDualRewards && refundBreakdownDual.length > 0) {
        refundLogged = await logDualRewardsBulkReversalRefund({
          creatorId,
          contestId,
          contestTitle,
          submissionCount: refundSubmissionCount,
          totalCents: refundCpmTotal + refundMilestoneTotal,
          cpmCents: refundCpmTotal,
          milestoneCents: refundMilestoneTotal,
          breakdown: refundBreakdownDual,
        });
      } else if (isMilestone && refundBreakdownMilestone.length > 0) {
        refundLogged = await logMilestoneBulkReversalRefund({
          creatorId,
          contestId,
          contestTitle,
          submissionCount: refundSubmissionCount,
          totalCents: refundCpmTotal + refundMilestoneTotal,
          milestoneCents: refundCpmTotal,
          bonusCents: refundMilestoneTotal,
          breakdown: refundBreakdownMilestone,
        });
      } else if (refundBreakdownStandard.length > 0) {
        refundLogged = await logStandardBulkReversalRefund({
          creatorId,
          contestId,
          contestTitle,
          submissionCount: refundSubmissionCount,
          totalCents: refundCpmTotal + refundMilestoneTotal,
          cpmCents: refundCpmTotal,
          bonusCents: refundMilestoneTotal,
          breakdown: refundBreakdownStandard,
        });
      }
      if (!refundLogged) {
        return {
          ok: false,
          error:
            "Wallet debit succeeded but failed to log refund in money_transactions. Retry the same moderation action.",
          failedSubmissionIds: groupRows.map((r) => r.id),
        };
      }
    }

    await clearPaidFlagsAfterReversal(
      params.supabaseAdmin,
      groupRows,
      perSubDue,
      { onlyWhenDueCleared: true },
    );
  }

  return {
    ok: true,
    skipWalletDebitIds,
    refundSummaryBySubmissionId,
  };
}
