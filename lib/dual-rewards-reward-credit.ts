import { creditCreatorWithdrawableBalance } from "@/lib/payment-utils";

export type DualRewardsBulkBreakdownItem = {
  submission_id: string;
  cpm_cents: number;
  milestone_cents: number;
};

/** One bulk money_transactions reward row for dual-rewards (total CPM + milestone). */
export async function creditDualRewardsBulkPayment(params: {
  creatorId: string;
  contestId: string;
  contestTitle: string;
  paidCount: number;
  totalCents: number;
  totalCpmCents: number;
  totalMilestoneCents: number;
  paymentType: string;
  idempotencyKey: string;
  breakdown: DualRewardsBulkBreakdownItem[];
}): Promise<{
  success: boolean;
  error?: string;
  alreadyApplied?: boolean;
  transactionId?: string;
}> {
  const totalCents = Math.max(0, Math.round(params.totalCents));
  if (totalCents <= 0) {
    return { success: true };
  }

  const creditRes = await creditCreatorWithdrawableBalance(
    params.creatorId,
    totalCents,
    `Bulk payment for ${params.paidCount} submissions in contest: ${
      params.contestTitle || "Contest"
    }`,
    {
      idempotencyKey: params.idempotencyKey,
      remarks: `Bulk payment: ${params.paymentType}`,
      metadata: {
        contest_id: params.contestId,
        payment_type: params.paymentType,
        submission_count: params.paidCount,
        cpm_cents: Math.max(0, Math.round(params.totalCpmCents)),
        milestone_cents: Math.max(0, Math.round(params.totalMilestoneCents)),
        dual_rewards_reward: true,
        bulk_dual_rewards_payment: true,
        breakdown: params.breakdown,
      },
    },
  );

  return {
    success: creditRes.success,
    error: creditRes.error,
    alreadyApplied: creditRes.alreadyApplied,
    transactionId: creditRes.transactionId,
  };
}

/** One money_transactions reward row per submission (CPM + milestone combined). */
export async function creditDualRewardsSubmissionReward(params: {
  creatorId: string;
  submissionId: string;
  contestId: string;
  contestTitle: string;
  cpmCents: number;
  milestoneCents: number;
  payoutCycle: number;
  idempotencyKey: string;
  remarks?: string | null;
  payoutType?: "standard" | "custom";
}): Promise<{ success: boolean; error?: string; alreadyApplied?: boolean }> {
  const cpmCents = Math.max(0, Math.round(params.cpmCents));
  const milestoneCents = Math.max(0, Math.round(params.milestoneCents));
  const totalCents = cpmCents + milestoneCents;
  if (totalCents <= 0) {
    return { success: true };
  }

  const creditRes = await creditCreatorWithdrawableBalance(
    params.creatorId,
    totalCents,
    params.payoutType === "custom"
      ? `Custom contest payment credited - ${params.contestTitle}`
      : `Contest payout credited - ${params.contestTitle}`,
    {
      idempotencyKey: params.idempotencyKey,
      remarks:
        params.remarks ?? "Dual rewards payout credited to creator wallet",
      metadata: {
        contest_id: params.contestId,
        submission_id: params.submissionId,
        cpm_cents: cpmCents,
        milestone_cents: milestoneCents,
        dual_rewards_reward: true,
        payout_cycle: params.payoutCycle,
        payout_type: params.payoutType ?? "standard",
      },
    },
  );

  return {
    success: creditRes.success,
    error: creditRes.error,
    alreadyApplied: creditRes.alreadyApplied,
  };
}
