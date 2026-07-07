import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildContestPayoutIdempotencyPayload,
  creditWithWalletShortfallRetry,
  loadContestPayoutLedgerBundle,
  loadContestPayoutMoneyTxnsForSubmissionIds,
} from "@/lib/contest-payout-idempotency";
import { loadDualCreatorCapMaps } from "@/lib/dual-rewards-payout-eligibility";
import {
  applyDualRewardsPayUpdateOptimisticGuards,
  buildDualRewardsBulkRollbackRevertPayload,
  buildDualRewardsPayUpdateGuardContext,
  buildDualRewardsSubmissionPayUpdatePayload,
  getDualRemainingPayableCents,
  parseDualRewardsPayoutJson,
  type DualRewardPayoutScope,
} from "@/lib/dual-rewards-payout";
import {
  checkDualRewardsPoolBudgetForPayment,
  computeSubmissionGrossWalletNetCents,
  getDualRewardsSubmissionPaidComponents,
  rollbackDualRewardsPoolCommitIfNeeded,
  type DualPoolBudgetPaymentResult,
} from "@/lib/dual-rewards-pool-budget";
import { creditDualRewardsBulkPayment } from "@/lib/dual-rewards-reward-credit";
import {
  dualRewardsPayoutAdjustmentAppliesToCpm,
  dualRewardsPayoutAdjustmentAppliesToMilestone,
  parsePayoutAdjustment,
} from "@/lib/payout-rules";
import { applyPayoutAdjustment } from "@/lib/payout-adjustment";
import { MetricsService } from "@/lib/metrics-service";
import {
  debitCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import type { MilestonePayoutRule } from "@/lib/contest-utils-client";

export type DualRewardsBulkBreakdownRow = {
  submission_id: string;
  cpm_cents: number;
  milestone_cents: number;
  /** Pool was already reserved earlier; only mark the row paid (no wallet credit). */
  finalizeOnly?: boolean;
};

function paymentTypeToComponent(
  paymentType: string,
): DualRewardPayoutScope {
  if (paymentType === "bonus") return "milestone";
  if (paymentType === "both") return "both";
  return "cpm";
}

function breakdownPayableCents(
  breakdown: DualRewardsBulkBreakdownRow[],
): number {
  return breakdown.reduce(
    (sum, item) =>
      item.finalizeOnly ? sum : sum + item.cpm_cents + item.milestone_cents,
    0,
  );
}

function breakdownWalletNetCents(
  breakdown: DualRewardsBulkBreakdownRow[],
  rewardTxns: Parameters<typeof computeSubmissionGrossWalletNetCents>[0],
  refundTxns: Parameters<typeof computeSubmissionGrossWalletNetCents>[1],
): number {
  return breakdown.reduce((sum, item) => {
    if (item.finalizeOnly) return sum;
    return (
      sum +
      computeSubmissionGrossWalletNetCents(
        rewardTxns,
        refundTxns,
        item.submission_id,
        REVERSAL_TRANSACTION_REMARK,
      )
    );
  }, 0);
}

export async function executeDualRewardsBulkPayment(params: {
  supabaseAdmin: SupabaseClient;
  adminUserId: string;
  contest: Record<string, unknown>;
  contestId: string;
  creatorId: string;
  submissionIds: string[];
  paymentType: "standard" | "bonus" | "both";
}): Promise<
  | {
      ok: true;
      paidCount: number;
      appliedCount: number;
      requestedCount: number;
      skippedCount: number;
      totalAmount: number;
      totalCpm: number;
      totalMilestone: number;
      breakdown: DualRewardsBulkBreakdownRow[];
      transactionId?: string;
      payoutOperationKey: string;
      alreadyApplied: boolean;
    }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const {
    supabaseAdmin,
    adminUserId,
    contest,
    contestId,
    creatorId,
    submissionIds,
    paymentType,
  } = params;

  const component = paymentTypeToComponent(paymentType);
  const contestTitle = String(contest.title || "Contest");

  const { data: submissions, error: submissionsError } = await supabaseAdmin
    .from("submissions")
    .select("*")
    .in("id", submissionIds)
    .eq("contest_id", contestId);

  if (submissionsError || !submissions?.length) {
    return {
      ok: false,
      status: 500,
      error: "Failed to fetch submissions",
    };
  }

  const mismatched = submissions.find(
    (s) => String(s.creator_id || "") !== creatorId,
  );
  if (mismatched) {
    return {
      ok: false,
      status: 400,
      error:
        "creator_id does not match one or more selected submissions. Refusing to process payout.",
    };
  }

  const verifiedSubmissions = submissions.filter((s) => {
    const st = String(s.status || "").toLowerCase();
    if (st === "verified" || st === "approved") return true;
    if (paymentType === "bonus") {
      const isPaidRow = st === "paid" || s.paid === true;
      return isPaidRow && s.bonus_paid !== true;
    }
    return false;
  });

  if (verifiedSubmissions.length === 0) {
    return {
      ok: false,
      status: 400,
      error:
        paymentType === "bonus"
          ? "No eligible submissions found for milestone bulk payment."
          : "No verified submissions found",
    };
  }

  const sortedSubmissions = [...verifiedSubmissions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const milestoneContest = (contest.contest_based_details as any)
    ?.milestone_contest;
  const milestones = Array.isArray(milestoneContest?.milestones)
    ? (milestoneContest.milestones as MilestonePayoutRule[])
    : [];
  const cpmCfg = (contest.contest_based_details as any)?.cpm_contest;
  const maxCap = Math.max(
    0,
    Math.round(
      Number(
        contest.max_earnings_per_creator ??
          cpmCfg?.max_earnings_per_creator ??
          0,
      ) || 0,
    ),
  );

  const capResult = await loadDualCreatorCapMaps(
    supabaseAdmin,
    contestId,
    creatorId,
    milestones,
    cpmCfg,
    maxCap,
  );
  if (capResult.error || !capResult.maps) {
    return {
      ok: false,
      status: 500,
      error: "Failed to compute dual rewards payout eligibility",
      details: capResult.error,
    };
  }

  const { milestoneCappedBySubmissionId, cpmCappedBySubmissionId } =
    capResult.maps;

  const payoutAdjustment = parsePayoutAdjustment(
    contest.payout_adjustment_percentage as number | null | undefined,
    contest.payout_adjustment_mode as string | null | undefined,
    { contestType: "dual_rewards" },
  );
  const pct = payoutAdjustment.percentage;
  const mode = payoutAdjustment.mode;
  const hasAdj = pct > 0 && !!mode;
  const adjCpm = hasAdj && dualRewardsPayoutAdjustmentAppliesToCpm(mode);
  const adjMs =
    hasAdj && dualRewardsPayoutAdjustmentAppliesToMilestone(mode);

  const breakdown: DualRewardsBulkBreakdownRow[] = [];
  const poolCommits: { submissionId: string; result: DualPoolBudgetPaymentResult }[] =
    [];
  let skippedCount = 0;

  const batchSubmissionIds = sortedSubmissions.map((s) => String(s.id));
  const moneyTxnLoad = await loadContestPayoutMoneyTxnsForSubmissionIds(
    supabaseAdmin,
    creatorId,
    contestId,
    batchSubmissionIds,
  );
  if ("errorMessage" in moneyTxnLoad) {
    return {
      ok: false,
      status: 500,
      error: "Failed to load contest payout ledger for dual rewards bulk pay",
      details: moneyTxnLoad.errorMessage,
    };
  }
  const { rewardRows: rewardTxns, refundRows: refundTxns } = moneyTxnLoad;

  for (const sub of sortedSubmissions) {
    const cpmCappedBase =
      cpmCappedBySubmissionId.get(String(sub.id)) ??
      Math.max(0, Math.round(Number(sub.earnings) || 0));
    const milestoneCappedBase =
      milestoneCappedBySubmissionId.get(String(sub.id)) ?? 0;
    const cpmExpected = adjCpm
      ? applyPayoutAdjustment(cpmCappedBase, pct)
      : cpmCappedBase;
    const milestoneExpected = adjMs
      ? applyPayoutAdjustment(milestoneCappedBase, pct)
      : milestoneCappedBase;

    const walletNetCents = computeSubmissionGrossWalletNetCents(
      rewardTxns,
      refundTxns,
      String(sub.id),
      REVERSAL_TRANSACTION_REMARK,
    );

    const { cpmRemaining, milestoneRemaining, totalRemaining } =
      getDualRemainingPayableCents(
        component,
        cpmExpected,
        milestoneExpected,
        sub.dual_rewards_payout,
        { walletNetCents },
      );

    if (totalRemaining <= 0) {
      const isUnpaidRow =
        sub.paid !== true &&
        !["paid"].includes(String(sub.status || "").toLowerCase());
      const reserved = parseDualRewardsPayoutJson(sub.dual_rewards_payout);
      if (
        isUnpaidRow &&
        reserved &&
        walletNetCents > 0 &&
        (reserved.cpm_cents > 0 || reserved.milestone_cents > 0)
      ) {
        const coversCpm =
          component === "milestone" || reserved.cpm_cents >= cpmExpected;
        const coversMs =
          component === "cpm" || reserved.milestone_cents >= milestoneExpected;
        if (coversCpm && coversMs) {
          breakdown.push({
            submission_id: String(sub.id),
            cpm_cents: 0,
            milestone_cents: 0,
            finalizeOnly: true,
          });
          continue;
        }
      }
      skippedCount++;
      continue;
    }

    const payCpm =
      component === "milestone" ? 0 : Math.min(cpmRemaining, totalRemaining);
    const payMilestone =
      component === "cpm"
        ? 0
        : component === "milestone"
          ? milestoneRemaining
          : milestoneRemaining;

    if (payCpm + payMilestone <= 0) {
      skippedCount++;
      continue;
    }

    const paidComponents = getDualRewardsSubmissionPaidComponents({
      id: String(sub.id),
      earnings: sub.earnings,
      paid: sub.paid,
      bonus_amount: sub.bonus_amount,
      bonus_paid: sub.bonus_paid,
      dual_rewards_payout: sub.dual_rewards_payout,
    });

    const targetAfter = {
      cpmCents: paidComponents.cpmCents + payCpm,
      milestoneCents: paidComponents.milestoneCents + payMilestone,
    };

    const poolResult = await checkDualRewardsPoolBudgetForPayment({
      supabaseAdmin,
      contest,
      contestId,
      targetSubmissionId: String(sub.id),
      targetAfter,
    });

    if (!poolResult.ok) {
      for (const prior of poolCommits) {
        await rollbackDualRewardsPoolCommitIfNeeded(
          supabaseAdmin,
          contestId,
          prior.submissionId,
          prior.result,
        );
      }
      const denied = poolResult.check;
      return {
        ok: false,
        status: 400,
        error: denied.error,
        details: {
          poolBudgetCents: denied.poolBudgetCents,
          projectedSpentCents: denied.projectedSpentCents,
          remainingCents: denied.remainingCents,
          submission_id: sub.id,
          attemptedCpmCents: payCpm,
          attemptedMilestoneCents: payMilestone,
        },
      };
    }

    poolCommits.push({ submissionId: String(sub.id), result: poolResult });
    breakdown.push({
      submission_id: String(sub.id),
      cpm_cents: payCpm,
      milestone_cents: payMilestone,
    });
  }

  const totalCpm = breakdown.reduce(
    (s, r) => s + (r.finalizeOnly ? 0 : r.cpm_cents),
    0,
  );
  const totalMilestone = breakdown.reduce(
    (s, r) => s + (r.finalizeOnly ? 0 : r.milestone_cents),
    0,
  );
  const totalAmount = totalCpm + totalMilestone;
  const requestedCount = breakdown.length;

  if (totalAmount <= 0) {
    if (!breakdown.some((r) => r.finalizeOnly)) {
      return {
        ok: false,
        status: 400,
        error:
          "No dual rewards payments to process. Selected submissions may already be paid or have $0 expected.",
        details: { skipped_count: skippedCount },
      };
    }
  }

  const ledgerBundle = await loadContestPayoutLedgerBundle(
    supabaseAdmin,
    creatorId,
    contestId,
  );
  if ("errorMessage" in ledgerBundle) {
    return {
      ok: false,
      status: 500,
      error:
        "Cannot verify payout ledger for safe idempotency. Try again or contact support.",
      details: ledgerBundle.errorMessage,
    };
  }
  const payoutLedgerState = ledgerBundle.state;

  const requestedSubmissionIds = [...submissionIds].map(String).sort();
  const operationSeed = JSON.stringify(
    buildContestPayoutIdempotencyPayload(
      {
        contest_id: contestId,
        creator_id: creatorId,
        payment_type: paymentType,
        contest_type: "dual_rewards",
        requested_submission_ids: requestedSubmissionIds,
        payout_adjustment_percentage: payoutAdjustment.percentage,
        payout_adjustment_mode: payoutAdjustment.mode ?? null,
      },
      payoutLedgerState,
    ),
  );
  const payoutOperationKey = `bulk_pay_dual_v1:${createHash("sha256")
    .update(operationSeed)
    .digest("hex")
    .slice(0, 48)}`;

  const payableCents = breakdownPayableCents(breakdown);
  const walletNetBeforePay = breakdownWalletNetCents(
    breakdown,
    rewardTxns,
    refundTxns,
  );

  const creditResult =
    payableCents > 0
      ? await creditWithWalletShortfallRetry({
          payableCents,
          walletNetBeforePay,
          baseIdempotencyKey: payoutOperationKey,
          ledger: payoutLedgerState,
          credit: (idempotencyKey) =>
            creditDualRewardsBulkPayment({
              creatorId,
              contestId,
              contestTitle,
              paidCount: requestedCount,
              totalCents: totalAmount,
              totalCpmCents: totalCpm,
              totalMilestoneCents: totalMilestone,
              paymentType,
              idempotencyKey,
              breakdown,
            }),
        })
      : {
          success: true as const,
          alreadyApplied: false,
          transactionId: undefined,
        };

  if (!creditResult.success) {
    for (const prior of poolCommits) {
      await rollbackDualRewardsPoolCommitIfNeeded(
        supabaseAdmin,
        contestId,
        prior.submissionId,
        prior.result,
      );
    }
    return {
      ok: false,
      status: 500,
      error: `Failed to credit wallet: ${creditResult.error}`,
    };
  }

  const updateFailures: { submission_id: string; message: string }[] = [];
  const appliedIds: string[] = [];

  for (const item of breakdown) {
    const sub = sortedSubmissions.find((s) => String(s.id) === item.submission_id);
    if (!sub) continue;

    const paidComponents = getDualRewardsSubmissionPaidComponents({
      id: item.submission_id,
      earnings: sub.earnings,
      paid: sub.paid,
      bonus_amount: sub.bonus_amount,
      bonus_paid: sub.bonus_paid,
      dual_rewards_payout: sub.dual_rewards_payout,
    });

    const nextPayout = item.finalizeOnly
      ? {
          cpm_cents: paidComponents.cpmCents,
          milestone_cents: paidComponents.milestoneCents,
        }
      : {
          cpm_cents: paidComponents.cpmCents + item.cpm_cents,
          milestone_cents: paidComponents.milestoneCents + item.milestone_cents,
        };

    const updatePayload = buildDualRewardsSubmissionPayUpdatePayload({
      split: nextPayout,
      updatedBy: adminUserId,
      customRemarks: `dual_component:${component}`,
    });

    let updateQuery = supabaseAdmin
      .from("submissions")
      .update(updatePayload)
      .eq("id", item.submission_id);

    const poolEntry = poolCommits.find(
      (p) => p.submissionId === item.submission_id,
    );
    const poolCommitted =
      !item.finalizeOnly &&
      poolEntry?.result.ok === true &&
      poolEntry.result.check.committed === true;

    const guardContext = buildDualRewardsPayUpdateGuardContext(
      sub,
      paidComponents,
      nextPayout,
      poolCommitted,
    );

    updateQuery = applyDualRewardsPayUpdateOptimisticGuards(
      updateQuery,
      guardContext.snapshot,
      guardContext.paidComponents,
      item,
    );

    const { data: updatedRow, error: updateError } = await updateQuery
      .select("id")
      .maybeSingle();

    if (updateError || !updatedRow) {
      updateFailures.push({
        submission_id: item.submission_id,
        message:
          updateError?.message ||
          "Submission was already claimed by another payout request.",
      });
    } else {
      appliedIds.push(item.submission_id);
    }
  }

  if (updateFailures.length > 0) {
    let walletRollbackFailed = false;
    let walletRollbackError: string | undefined;

    if (!creditResult.alreadyApplied) {
      const rollback = await debitCreatorWithdrawableBalance(
        creatorId,
        payableCents,
      );
      if (rollback.success) {
        await logTransactionAsAdmin(
          creatorId,
          "refund",
          payableCents,
          "success",
          `Rollback: bulk payment row update failed for ${contestTitle}`,
          {
            remarks: REVERSAL_TRANSACTION_REMARK,
            paymentMethod: "refund",
            metadata: {
              contest_id: contestId,
              payout_type: "bulk_dual_rewards_rollback",
              original_reward_transaction_id: creditResult.transactionId,
              payout_operation_key: payoutOperationKey,
              update_failures: updateFailures,
            },
          },
        );
      } else {
        walletRollbackFailed = true;
        walletRollbackError = rollback.error;
        console.error(
          "[dual-rewards-bulk-payment] CRITICAL: wallet rollback failed after submission update failure:",
          {
            creatorId,
            contestId,
            payableCents,
            payoutOperationKey,
            transactionId: creditResult.transactionId,
            updateFailures,
            error: rollback.error,
          },
        );
      }

      for (const id of appliedIds) {
        const item = breakdown.find((b) => b.submission_id === id);
        const sub = sortedSubmissions.find((s) => String(s.id) === id);
        if (!item || !sub) continue;

        const priorComponents = getDualRewardsSubmissionPaidComponents({
          id,
          earnings: sub.earnings,
          paid: sub.paid,
          bonus_amount: sub.bonus_amount,
          bonus_paid: sub.bonus_paid,
          dual_rewards_payout: sub.dual_rewards_payout,
        });
        const revertPayload = buildDualRewardsBulkRollbackRevertPayload(
          priorComponents,
          item,
        );
        await supabaseAdmin.from("submissions").update(revertPayload).eq("id", id);
      }

      for (const prior of poolCommits) {
        await rollbackDualRewardsPoolCommitIfNeeded(
          supabaseAdmin,
          contestId,
          prior.submissionId,
          prior.result,
        );
      }
    }

    return {
      ok: false,
      status: 500,
      error: creditResult.alreadyApplied
        ? "Payout credit was already applied earlier, but one or more submission rows still could not be reconciled. Retry or contact support."
        : walletRollbackFailed
          ? "Submission rows could not be marked paid and wallet rollback failed. Manual reconciliation required — see details."
          : "Submission rows could not be marked paid. Fresh wallet credit was rolled back where possible; retry after resolving the listed rows.",
      details: {
        updateFailures,
        transaction_id: creditResult.transactionId,
        already_applied_idempotent: Boolean(creditResult.alreadyApplied),
        payout_operation_key: payoutOperationKey,
        applied_count: appliedIds.length,
        requested_count: requestedCount,
        payable_cents: payableCents,
        wallet_rollback_failed: walletRollbackFailed,
        wallet_rollback_error: walletRollbackError,
        reconciliation_hint:
          walletRollbackFailed || creditResult.alreadyApplied
            ? "Compare money_transactions reward/refund rows for payout_operation_key and submission dual_rewards_payout JSON."
            : undefined,
      },
    };
  }

  if (appliedIds.length > 0) {
    const { data: paidRows } = await supabaseAdmin
      .from("submissions")
      .select("id, views, creator_id, platform, other_stats")
      .in("id", appliedIds);
    try {
      await MetricsService.creditSubmissionViewsForCreators(paidRows || []);
    } catch (e) {
      console.error("[dual-rewards-bulk-payment] view credit failed:", e);
    }
  }

  const appliedCount = appliedIds.length;

  return {
    ok: true,
    paidCount: appliedCount,
    appliedCount,
    requestedCount,
    skippedCount,
    totalAmount,
    totalCpm,
    totalMilestone,
    breakdown,
    transactionId: creditResult.transactionId,
    payoutOperationKey,
    alreadyApplied: Boolean(creditResult.alreadyApplied),
  };
}
