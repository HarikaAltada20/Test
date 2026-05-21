/**
 * Client-side estimates for paid → non-paid status changes (verify-submission reversal).
 * Twitter rows use a different API; amounts are not estimated here (see paidTwitterCount).
 */

import { getDualRewardsSubmissionPaidComponents } from "@/lib/dual-rewards-pool-budget";

export type PaidReversalPreview = {
  updateCount: number;
  paidNonTwitterCount: number;
  paidTwitterCount: number;
  rewardCents: number;
  bonusCents: number;
  totalCents: number;
};

type SubmissionLike = {
  id: string;
  status?: string | null;
  paid?: boolean | null;
  earnings?: number | null;
  bonus_paid?: boolean | null;
  bonus_amount?: number | null;
  dual_rewards_payout?: unknown;
  is_twitter_tweet?: boolean | null;
  moderation_status?: string | null;
};

export function submissionIsPaidRow(
  sub: SubmissionLike | null | undefined,
): boolean {
  if (!sub) return false;
  const isTwitter = sub.is_twitter_tweet === true;
  const st = String(
    isTwitter ? sub.moderation_status || sub.status || "" : sub.status || "",
  ).toLowerCase();
  if (st === "paid") return true;
  if (sub.paid === true) return true;
  return false;
}

export function summarizePaidReversalPreview(
  submissions: readonly SubmissionLike[],
  ids: string[],
): PaidReversalPreview {
  let paidNonTwitterCount = 0;
  let paidTwitterCount = 0;
  let rewardCents = 0;
  let bonusCents = 0;

  for (const id of ids) {
    const sub = submissions.find((s) => s.id === id);
    if (!sub || !submissionIsPaidRow(sub)) continue;

    const isTwitter = sub.is_twitter_tweet === true;
    if (isTwitter) {
      paidTwitterCount++;
      continue;
    }
    paidNonTwitterCount++;

    let rowReward = Math.max(0, Number(sub.earnings) || 0);
    let rowBonus = sub.bonus_paid
      ? Math.max(0, Number(sub.bonus_amount) || 0)
      : 0;
    const dualPaid = getDualRewardsSubmissionPaidComponents({
      id: sub.id,
      earnings: sub.earnings,
      paid: sub.paid,
      bonus_amount: sub.bonus_amount,
      bonus_paid: sub.bonus_paid,
      dual_rewards_payout: sub.dual_rewards_payout,
    });
    const dualTotal = dualPaid.cpmCents + dualPaid.milestoneCents;
    if (dualTotal > rowReward + rowBonus) {
      rowReward = dualPaid.cpmCents;
      rowBonus = dualPaid.milestoneCents;
    }
    rewardCents += rowReward;
    bonusCents += rowBonus;
  }

  return {
    updateCount: ids.length,
    paidNonTwitterCount,
    paidTwitterCount,
    rewardCents,
    bonusCents,
    totalCents: rewardCents + bonusCents,
  };
}

export function selectionIncludesPaidRow(
  submissions: readonly SubmissionLike[],
  ids: string[],
): boolean {
  for (const id of ids) {
    const sub = submissions.find((s) => s.id === id);
    if (submissionIsPaidRow(sub)) return true;
  }
  return false;
}
