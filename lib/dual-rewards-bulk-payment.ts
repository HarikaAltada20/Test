import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  creditCreatorWithdrawableBalance,
  debitCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import { applyPayoutAdjustment } from "@/lib/payout-adjustment";
import {
  dualRewardsPayoutAdjustmentAppliesToCpm,
  dualRewardsPayoutAdjustmentAppliesToMilestone,
  parsePayoutAdjustment,
} from "@/lib/payout-rules";
import {
  buildDualRewardsPayoutPersistValue,
  getDualRemainingPayableCents,
  type DualRewardPayoutScope,
} from "@/lib/dual-rewards-payout";
import { loadDualCreatorCapMaps } from "@/lib/dual-rewards-payout-eligibility";
import {
  checkDualRewardsPoolBudgetForPayment,
  getDualRewardsSubmissionPaidComponents,
  rollbackDualRewardsPoolCommitIfNeeded,
  type DualPoolBudgetPaymentResult,
} from "@/lib/dual-rewards-pool-budget";
import { MetricsService } from "@/lib/metrics-service";

type DualBulkSubmissionRow = {
  id: string;
  creator_id: string;
  status: string | null;
  paid: boolean | null;
  bonus_paid: boolean | null;
  bonus_amount: number | null;
  earnings: number | null;
  created_at: string;
  dual_rewards_payout: unknown;
  video_title?: string | null;
  views?: number | null;
  platform?: string | null;
  other_stats?: unknown;
};

export type DualRewardsBulkBreakdownItem = {
  submission_id: string;
  video_title: string;
  cpm_amount: number;
  milestone_amount: number;
  created_at: string;
};

function paymentTypeToComponent(
  paymentType: string,
): DualRewardPayoutScope {
  if (paymentType === "bonus") return "milestone";
  if (paymentType === "both") return "both";
  return "cpm";
}

export async function processDualRewardsBulkPayment(params: {
  supabaseAdmin: SupabaseClient;
  contest: Record<string, unknown>;
  contestId: string;
  creatorId: string;
  submissionIds: string[];
  paymentType: "standard" | "bonus" | "both";
  bulkPayIdempotencyKey: string;
  adminUserId: string;
}): Promise<NextResponse> {
  const {
    supabaseAdmin,
    contest,
    contestId,
    creatorId,
    submissionIds,
    paymentType,
    bulkPayIdempotencyKey,
    adminUserId,
  } = params;

  const { data: submissions, error: submissionsError } = await supabaseAdmin
    .from("submissions")
    .select("*")
    .in("id", submissionIds)
    .eq("contest_id", contestId);

  if (submissionsError || !submissions || submissions.length === 0) {
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 },
    );
  }

  const mismatchedCreatorSubmission = submissions.find(
    (s) => String(s.creator_id || "") !== creatorId,
  );
  if (mismatchedCreatorSubmission) {
    return NextResponse.json(
      {
        error:
          "creator_id does not match one or more selected submissions. Refusing to process payout.",
      },
      { status: 400 },
    );
  }

  const component = paymentTypeToComponent(paymentType);
  const verifiedSubmissions = (submissions as DualBulkSubmissionRow[]).filter(
    (s) => {
      const st = String(s.status || "").toLowerCase();
      if (st === "verified" || st === "approved") return true;
      if (paymentType === "bonus") {
        const isPaidRow = st === "paid" || s.paid === true;
        return isPaidRow && s.bonus_paid !== true;
      }
      return false;
    },
  );

  if (verifiedSubmissions.length === 0) {
    return NextResponse.json(
      {
        error:
          paymentType === "bonus"
            ? "No eligible submissions found. Bonus can be paid on verified rows, or already-paid rows whose milestone has not been paid yet."
            : "No verified submissions found",
      },
      { status: 400 },
    );
  }

  const sortedSubmissions = [...verifiedSubmissions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const milestoneContest = (contest.contest_based_details as any)
    ?.milestone_contest;
  const milestones = Array.isArray(milestoneContest?.milestones)
    ? milestoneContest.milestones
    : [];
  const cpmCfg = (contest.contest_based_details as any)?.cpm_contest;
  const maxCap = Number(
    contest.max_earnings_per_creator ??
      cpmCfg?.max_earnings_per_creator ??
      0,
  );

  const capResult = await loadDualCreatorCapMaps(
    supabaseAdmin,
    contestId,
    creatorId,
    milestones,
    cpmCfg,
    maxCap,
  );
  if (capResult.error) {
    return NextResponse.json(
      {
        error: "Failed to compute dual rewards payout eligibility",
        details: capResult.error,
      },
      { status: 500 },
    );
  }

  const payoutAdjustment = parsePayoutAdjustment(
    contest.payout_adjustment_percentage,
    contest.payout_adjustment_mode,
    { contestType: "dual_rewards" },
  );
  const adjPct = payoutAdjustment.percentage;
  const adjMode = payoutAdjustment.mode;
  const hasAdj = adjPct > 0 && !!adjMode;
  const adjCpm = hasAdj && dualRewardsPayoutAdjustmentAppliesToCpm(adjMode);
  const adjMs =
    hasAdj && dualRewardsPayoutAdjustmentAppliesToMilestone(adjMode);

  const breakdown: DualRewardsBulkBreakdownItem[] = [];
  const poolCommits: {
    submissionId: string;
    commit: DualPoolBudgetPaymentResult;
  }[] = [];
  let skippedCount = 0;

  for (const sub of sortedSubmissions) {
    const cpmCappedBase =
      capResult.maps!.cpmCappedBySubmissionId.get(String(sub.id)) ?? 0;
    const milestoneCappedBase =
      capResult.maps!.milestoneCappedBySubmissionId.get(String(sub.id)) ?? 0;
    const cpmExpected = adjCpm
      ? applyPayoutAdjustment(cpmCappedBase, adjPct)
      : cpmCappedBase;
    const milestoneExpected = adjMs
      ? applyPayoutAdjustment(milestoneCappedBase, adjPct)
      : milestoneCappedBase;

    const { cpmRemaining, milestoneRemaining, totalRemaining } =
      getDualRemainingPayableCents(
        component,
        cpmExpected,
        milestoneExpected,
        sub.dual_rewards_payout,
      );

    if (totalRemaining <= 0) {
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
      cpmCents:
        paidComponents.cpmCents +
        (component === "milestone" ? 0 : cpmRemaining),
      milestoneCents:
        paidComponents.milestoneCents +
        (component === "cpm" ? 0 : milestoneRemaining),
    };

    const poolResult = await checkDualRewardsPoolBudgetForPayment({
      supabaseAdmin,
      contest: contest as any,
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
          prior.commit,
        );
      }
      const denied = poolResult.check;
      return NextResponse.json(
        {
          error: denied.error,
          details: {
            poolBudgetCents: denied.poolBudgetCents,
            projectedSpentCents: denied.projectedSpentCents,
            remainingCents: denied.remainingCents,
            submission_id: sub.id,
          },
        },
        { status: 400 },
      );
    }
    poolCommits.push({ submissionId: String(sub.id), commit: poolResult });

    const cpmAmount = component === "milestone" ? 0 : cpmRemaining;
    const milestoneAmount = component === "cpm" ? 0 : milestoneRemaining;
    breakdown.push({
      submission_id: String(sub.id),
      video_title: sub.video_title || "Untitled",
      cpm_amount: cpmAmount,
      milestone_amount: milestoneAmount,
      created_at: sub.created_at,
    });
  }

  const totalAmount = breakdown.reduce(
    (sum, row) => sum + row.cpm_amount + row.milestone_amount,
    0,
  );
  const totalCpmPaid = breakdown.reduce((sum, row) => sum + row.cpm_amount, 0);
  const totalMilestonePaid = breakdown.reduce(
    (sum, row) => sum + row.milestone_amount,
    0,
  );
  const paidCount = breakdown.length;

  if (totalAmount <= 0 || paidCount === 0) {
    for (const prior of poolCommits) {
      await rollbackDualRewardsPoolCommitIfNeeded(
        supabaseAdmin,
        contestId,
        prior.submissionId,
        prior.commit,
      );
    }
    return NextResponse.json(
      {
        error:
          "No dual rewards payments to process. Submissions may already be paid or have $0 expected for this component.",
      },
      { status: 400 },
    );
  }

  const contestTitle = String(contest.title || "Contest");
  const creditResult = await creditCreatorWithdrawableBalance(
    creatorId,
    totalAmount,
    `Bulk payment for ${paidCount} submissions in contest: ${contestTitle}`,
    {
      idempotencyKey: bulkPayIdempotencyKey,
      remarks: `Bulk payment: ${paymentType}`,
      metadata: {
        contest_id: contestId,
        payment_type: paymentType,
        submission_count: paidCount,
        total_cpm: totalCpmPaid,
        total_milestone: totalMilestonePaid,
        dual_rewards_bulk_reward: true,
        breakdown,
      },
    },
  );

  if (!creditResult.success) {
    for (const prior of poolCommits) {
      await rollbackDualRewardsPoolCommitIfNeeded(
        supabaseAdmin,
        contestId,
        prior.submissionId,
        prior.commit,
      );
    }
    return NextResponse.json(
      { error: `Failed to credit wallet: ${creditResult.error}` },
      { status: 500 },
    );
  }

  const updateFailures: { submission_id: string; message: string }[] = [];
  const appliedSubmissionIds: string[] = [];

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
    const nextPayout = {
      cpm_cents: paidComponents.cpmCents + item.cpm_amount,
      milestone_cents: paidComponents.milestoneCents + item.milestone_amount,
    };

    const updatePayload: Record<string, unknown> = {
      dual_rewards_payout: buildDualRewardsPayoutPersistValue(nextPayout, {
        updatedBy: adminUserId,
        customRemarks: `dual_component:${component}`,
      }),
    };

    if (paymentType !== "bonus" && item.cpm_amount > 0) {
      updatePayload.earnings =
        nextPayout.cpm_cents + nextPayout.milestone_cents;
      updatePayload.paid = true;
      updatePayload.paid_at = new Date().toISOString();
      updatePayload.status = "paid";
    } else if (
      paymentType === "bonus" &&
      item.milestone_amount > 0 &&
      item.cpm_amount <= 0
    ) {
      updatePayload.earnings =
        nextPayout.cpm_cents + nextPayout.milestone_cents;
      updatePayload.paid = true;
      updatePayload.paid_at = new Date().toISOString();
      updatePayload.status = "paid";
    } else if (item.milestone_amount > 0 || item.cpm_amount > 0) {
      updatePayload.earnings =
        nextPayout.cpm_cents + nextPayout.milestone_cents;
    }

    let updateQuery = supabaseAdmin
      .from("submissions")
      .update(updatePayload)
      .eq("id", item.submission_id);

    if (paymentType !== "bonus" && item.cpm_amount > 0) {
      updateQuery = updateQuery.neq("paid", true);
    }

    const { data: updatedRows, error: updateError } = await updateQuery
      .select("id")
      .maybeSingle();

    if (updateError) {
      updateFailures.push({
        submission_id: item.submission_id,
        message: updateError.message,
      });
    } else if (!updatedRows) {
      updateFailures.push({
        submission_id: item.submission_id,
        message:
          "Submission was already claimed by another payout request. Wallet credit will be rolled back if this request applied fresh funds.",
      });
    } else {
      appliedSubmissionIds.push(item.submission_id);
    }
  }

  if (updateFailures.length > 0) {
    if (!creditResult.alreadyApplied) {
      const rollback = await debitCreatorWithdrawableBalance(
        creatorId,
        totalAmount,
      );
      if (rollback.success) {
        await logTransactionAsAdmin(
          creatorId,
          "refund",
          totalAmount,
          "success",
          `Rollback: dual rewards bulk payment row update failed for ${contestTitle}`,
          {
            remarks: REVERSAL_TRANSACTION_REMARK,
            paymentMethod: "refund",
            metadata: {
              contest_id: contestId,
              payout_type: "dual_rewards_bulk_payment_rollback",
              original_reward_transaction_id: creditResult.transactionId,
              payout_operation_key: bulkPayIdempotencyKey,
              update_failures: updateFailures,
            },
          },
        );
      }
    }

    for (const prior of poolCommits) {
      await rollbackDualRewardsPoolCommitIfNeeded(
        supabaseAdmin,
        contestId,
        prior.submissionId,
        prior.commit,
      );
    }

    return NextResponse.json(
      {
        error:
          creditResult.alreadyApplied
            ? "Payout credit was already applied earlier, but one or more submission rows still could not be reconciled. Retry or contact support."
            : "Submission rows could not be marked paid. Fresh wallet credit was rolled back where possible; retry after resolving the listed rows.",
        updateFailures,
        transaction_id: creditResult.transactionId,
        already_applied_idempotent: Boolean(creditResult.alreadyApplied),
        payout_operation_key: bulkPayIdempotencyKey,
      },
      { status: 500 },
    );
  }

  if (appliedSubmissionIds.length > 0) {
    const { data: paidRows, error: paidRowsErr } = await supabaseAdmin
      .from("submissions")
      .select("id, views, creator_id, platform, other_stats")
      .in("id", appliedSubmissionIds);
    if (paidRowsErr) {
      console.error(
        "[dual-rewards-bulk-payment] Failed to load submissions for view credit:",
        paidRowsErr,
      );
    } else {
      try {
        await MetricsService.creditSubmissionViewsForCreators(paidRows || []);
      } catch (creditErr) {
        console.error(
          "[dual-rewards-bulk-payment] Failed to credit submission views:",
          creditErr,
        );
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: `Successfully paid ${paidCount} submissions`,
    data: {
      total_amount: totalAmount,
      total_cpm: totalCpmPaid,
      total_milestone: totalMilestonePaid,
      paid_count: paidCount,
      skipped_count: skippedCount,
      breakdown,
      transaction_id: creditResult.transactionId,
      payout_idempotent_retry: Boolean(creditResult.alreadyApplied),
      payout_operation_key: bulkPayIdempotencyKey,
    },
  });
}
