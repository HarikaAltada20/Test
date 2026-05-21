import type { SupabaseClient } from "@supabase/supabase-js";
import {
  debitCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import {
  computeDualRewardsSubmissionReversalDue,
  filterMoneyTxnsForContest,
  scaleDualReversalDuesToTotalCap,
  submissionIdFromMoneyTxnMetadata,
  type DualPoolSpendSubmissionRow,
  type DualRewardsSubmissionReversalDue,
} from "@/lib/dual-rewards-pool-budget";

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
  bonus_paid: boolean | null;
  bonus_amount: number | null;
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

function dueToRefundSummary(
  due: DualRewardsSubmissionReversalDue,
): BulkDualReversalRefundSummary {
  return {
    reward_refunded_cents: due.mainCents,
    bonus_refunded_cents: due.bonusCents,
    total_refunded_cents: due.totalCents,
    cpm_refunded_cents: due.mainCents,
    milestone_refunded_cents: due.bonusCents,
  };
}

/**
 * One atomic wallet debit per creator+contest for bulk paid → verified/pending/rejected.
 * Per-submission verify calls should pass skipWalletDebit: true for returned ids.
 */
export async function applyBulkDualRewardsWalletReversals(params: {
  supabaseAdmin: SupabaseClient;
  submissionIds: string[];
  contestTitle?: string;
}): Promise<BulkDualWalletReversalResult> {
  const ids = params.submissionIds.map(String).filter(Boolean);
  if (ids.length === 0) {
    return { ok: true, skipWalletDebitIds: new Set(), refundSummaryBySubmissionId: new Map() };
  }

  const { data: rows, error: rowsErr } = await params.supabaseAdmin
    .from("submissions")
    .select(
      "id, contest_id, creator_id, status, earnings, paid, bonus_paid, bonus_amount, dual_rewards_payout, contests!inner(contest_type, title)",
    )
    .in("id", ids);

  if (rowsErr) {
    return { ok: false, error: rowsErr.message };
  }

  const dualRows = (rows || []).filter(
    (r: { contests?: { contest_type?: string } }) =>
      r.contests?.contest_type === "dual_rewards",
  ) as (SubmissionRow & { contests?: { title?: string } })[];

  if (dualRows.length === 0) {
    return { ok: true, skipWalletDebitIds: new Set(), refundSummaryBySubmissionId: new Map() };
  }

  const skipWalletDebitIds = new Set<string>();
  const refundSummaryBySubmissionId = new Map<string, BulkDualReversalRefundSummary>();

  const byCreatorContest = new Map<string, SubmissionRow[]>();
  for (const row of dualRows) {
    const key = `${row.creator_id}:${row.contest_id}`;
    const list = byCreatorContest.get(key) || [];
    list.push(row);
    byCreatorContest.set(key, list);
  }

  for (const [, groupRows] of byCreatorContest) {
    const creatorId = groupRows[0].creator_id;
    const contestId = groupRows[0].contest_id;
    const contestTitle =
      params.contestTitle ||
      (groupRows[0] as { contests?: { title?: string } }).contests?.title ||
      "Contest";

    const { data: contestSubRows } = await params.supabaseAdmin
      .from("submissions")
      .select("id")
      .eq("contest_id", contestId)
      .eq("creator_id", creatorId);

    const contestSubmissionIds = new Set(
      (contestSubRows || []).map((r: { id: string }) => String(r.id)),
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
        String(row.status || "").toLowerCase() === "paid" || row.paid === true;
      const due = computeDualRewardsSubmissionReversalDue({
        submissionRow: toSpendRow(row),
        submissionId: row.id,
        rewardTxns,
        refundTxns,
        reversalRemark: REVERSAL_TRANSACTION_REMARK,
        wasPaidBeforeReversal: wasPaid,
      });
      perSubDue.set(row.id, due);
      totalDueCents += due.totalCents;
      refundSummaryBySubmissionId.set(row.id, dueToRefundSummary(due));
      skipWalletDebitIds.add(row.id);
    }

    if (totalDueCents <= 0) {
      continue;
    }

    const { data: profile, error: profileErr } = await params.supabaseAdmin
      .from("creator_profiles")
      .select("withdrawable_balance")
      .eq("id", creatorId)
      .single();

    if (profileErr || !profile) {
      return {
        ok: false,
        error: profileErr?.message || "Creator profile not found",
        failedSubmissionIds: groupRows.map((r) => r.id),
      };
    }

    const availableCents = Math.max(
      0,
      Math.round(Number(profile.withdrawable_balance) || 0),
    );

    let debitCents = totalDueCents;
    if (availableCents < totalDueCents) {
      if (availableCents <= 0) {
        const selectedIds = new Set(groupRows.map((r) => r.id));
        const selectedRewardSum = rewardTxns
          .filter((tx) =>
            selectedIds.has(submissionIdFromMoneyTxnMetadata(tx.metadata)),
          )
          .reduce((s, tx) => s + Math.max(0, Number(tx.amount) || 0), 0);
        const alreadyReversedCents = refundTxns
          .filter(
            (tx) =>
              selectedIds.has(submissionIdFromMoneyTxnMetadata(tx.metadata)) &&
              (!tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK),
          )
          .reduce((s, tx) => s + Math.max(0, Number(tx.amount) || 0), 0);

        for (const row of groupRows) {
          skipWalletDebitIds.delete(row.id);
          refundSummaryBySubmissionId.delete(row.id);
        }
        return {
          ok: false,
          error:
            `Insufficient withdrawable balance for bulk reversal: need ${totalDueCents}¢ ` +
            `for ${groupRows.length} selected submission(s), but none is available. ` +
            (alreadyReversedCents > 0
              ? `${alreadyReversedCents}¢ already recorded as reversed in the ledger. `
              : "") +
            `Credited for selection was ${selectedRewardSum}¢.`,
          failedSubmissionIds: groupRows.map((r) => r.id),
        };
      }

      const scaled = scaleDualReversalDuesToTotalCap(perSubDue, availableCents);
      perSubDue.clear();
      for (const [id, due] of scaled) {
        perSubDue.set(id, due);
        refundSummaryBySubmissionId.set(id, dueToRefundSummary(due));
      }
      debitCents = availableCents;
      totalDueCents = debitCents;
    }

    const debitRes = await debitCreatorWithdrawableBalance(
      creatorId,
      debitCents,
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

    for (const row of groupRows) {
      const due = perSubDue.get(row.id);
      if (!due || due.totalCents <= 0) continue;

      if (due.mainCents > 0) {
        await logTransactionAsAdmin(
          creatorId,
          "refund",
          due.mainCents,
          "success",
          `Reversal of contest reward - ${contestTitle}`,
          {
            remarks: REVERSAL_TRANSACTION_REMARK,
            paymentMethod: "refund",
            metadata: {
              submission_id: row.id,
              contest_id: contestId,
              bulk_dual_rewards_reversal: true,
            },
          },
        );
      }
      for (const bonus of due.bonusReversals) {
        if (bonus.amount <= 0) continue;
        await logTransactionAsAdmin(
          creatorId,
          "refund",
          bonus.amount,
          "success",
          `Reversal of contest bonus - ${contestTitle}`,
          {
            remarks: REVERSAL_TRANSACTION_REMARK,
            paymentMethod: "refund",
            metadata: {
              submission_id: row.id,
              source_submission_id: row.id,
              contest_id: contestId,
              payout_component: bonus.bonusType,
              bulk_dual_rewards_reversal: true,
            },
          },
        );
      }
    }
  }

  return {
    ok: true,
    skipWalletDebitIds,
    refundSummaryBySubmissionId,
  };
}
