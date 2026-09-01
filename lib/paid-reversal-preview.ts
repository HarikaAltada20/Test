/**
 * Client-side estimates for paid → non-paid status changes (verify-submission reversal).
 * Twitter rows use a different API; amounts are not estimated here (see paidTwitterCount).
 */

import { getDualRewardsSubmissionPaidComponents } from "@/lib/dual-rewards-pool-budget";
import { submissionHasUnclearedPayment } from "@/lib/contest-detail-submission-status-counts";
import {
  getCpmGrantedCentsFromSubmission,
  getMilestoneLadderGrantedCentsFromSubmission,
  getMostVerifiedBonusPaidCentsFromSubmission,
  tryDualRewardGrantedBreakdownFromStoredPayout,
} from "@/lib/dual-rewards-payout";

export type PaidReversalPreview = {
  updateCount: number;
  paidNonTwitterCount: number;
  paidTwitterCount: number;
  rewardCents: number;
  bonusCents: number;
  /** Most-verified views/reels bonus (creator-level, from milestone_bonus_paid). */
  mostVerifiedBonusCents: number;
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
  milestone_bonus_paid?: unknown;
  metadata?: { milestone_bonus_paid?: unknown } | null;
  creator_id?: string | null;
  is_twitter_tweet?: boolean | null;
  moderation_status?: string | null;
};

function submissionCreatorKey(sub: SubmissionLike): string {
  return String(sub.creator_id ?? "").trim();
}

function paidReversalRowAmounts(sub: SubmissionLike): {
  rewardCents: number;
  bonusCents: number;
} {
  const stored = tryDualRewardGrantedBreakdownFromStoredPayout(sub);
  if (stored?.isPaid) {
    return { rewardCents: stored.cpmCents, bonusCents: stored.milestoneCents };
  }

  const cpmCents = getCpmGrantedCentsFromSubmission(sub);
  const milestoneCents = getMilestoneLadderGrantedCentsFromSubmission(sub);
  if (cpmCents > 0 || milestoneCents > 0) {
    return { rewardCents: cpmCents, bonusCents: milestoneCents };
  }

  let rewardCents = Math.max(0, Number(sub.earnings) || 0);
  let bonusCents = sub.bonus_paid
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
  if (dualTotal > rewardCents + bonusCents) {
    rewardCents = dualPaid.cpmCents;
    bonusCents = dualPaid.milestoneCents;
  }
  return { rewardCents, bonusCents };
}

export function submissionIsPaidRow(
  sub: SubmissionLike | null | undefined,
): boolean {
  if (!sub) return false;
  const isTwitter = sub.is_twitter_tweet === true;
  const st = String(
    isTwitter ? sub.moderation_status || sub.status || "" : sub.status || "",
  ).toLowerCase();
  if (st === "paid") return true;
  return submissionHasUnclearedPayment(sub);
}

export function summarizePaidReversalPreview(
  submissions: readonly SubmissionLike[],
  ids: string[],
): PaidReversalPreview {
  let paidNonTwitterCount = 0;
  let paidTwitterCount = 0;
  let rewardCents = 0;
  let bonusCents = 0;
  const mostVerifiedBonusByCreator = new Map<string, number>();

  for (const id of ids) {
    const sub = submissions.find((s) => s.id === id);
    if (!sub || !submissionIsPaidRow(sub)) continue;

    const isTwitter = sub.is_twitter_tweet === true;
    if (isTwitter) {
      paidTwitterCount++;
      continue;
    }
    paidNonTwitterCount++;

    const rowAmounts = paidReversalRowAmounts(sub);
    rewardCents += rowAmounts.rewardCents;
    bonusCents += rowAmounts.bonusCents;

    const creatorKey = submissionCreatorKey(sub);
    const mvPaid = getMostVerifiedBonusPaidCentsFromSubmission(sub).totalCents;
    if (creatorKey && mvPaid > 0) {
      mostVerifiedBonusByCreator.set(
        creatorKey,
        Math.max(mostVerifiedBonusByCreator.get(creatorKey) ?? 0, mvPaid),
      );
    }
  }

  const mostVerifiedBonusCents = Array.from(
    mostVerifiedBonusByCreator.values(),
  ).reduce((sum, cents) => sum + cents, 0);

  return {
    updateCount: ids.length,
    paidNonTwitterCount,
    paidTwitterCount,
    rewardCents,
    bonusCents,
    mostVerifiedBonusCents,
    totalCents: rewardCents + bonusCents + mostVerifiedBonusCents,
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
