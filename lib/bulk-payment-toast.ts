/** Toast title/variant for bulk pay summaries (dual, CPM, milestone, etc.). */
export function getBulkPaymentToastMeta(
  successCount: number,
  skippedCount: number,
): { title: string; variant: "success" | "destructive" } {
  if (successCount === 0 && skippedCount > 0) {
    return {
      title: "Bulk payment completed — nothing paid",
      variant: "destructive",
    };
  }
  if (skippedCount > 0) {
    return {
      title: "Bulk payment completed with skips",
      variant: "success",
    };
  }
  return { title: "Bulk payment successful", variant: "success" };
}

export type DualBulkPaymentToastTotals = {
  successCount: number;
  skippedCount: number;
  totalCpmCents: number;
  totalMilestoneCents: number;
};

function formatUsdFromCents(cents: number): string {
  return `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
}

/** Dual-rewards bulk pay: match CPM/milestone bulk toast field layout. */
export function formatDualBulkPaymentToastDescription(
  totals: DualBulkPaymentToastTotals,
): string {
  const totalPaidCents = totals.totalCpmCents + totals.totalMilestoneCents;
  return [
    `Paid items: ${totals.successCount}`,
    `Skipped: ${totals.skippedCount}`,
    ``,
    `CPM : ${formatUsdFromCents(totals.totalCpmCents)}`,
    `Milestone: ${formatUsdFromCents(totals.totalMilestoneCents)}`,
    `Total paid: ${formatUsdFromCents(totalPaidCents)}`,
  ].join("\n");
}

export type RefundReversalSummaryCents = {
  reward_refunded_cents: number;
  bonus_refunded_cents: number;
  total_refunded_cents: number;
  cpm_refunded_cents?: number;
  milestone_refunded_cents?: number;
  refunded_count?: number;
  skipped_count?: number;
  is_dual_rewards?: boolean;
};

/** Single-line refund/reversal summary for verification toasts. */
export function formatRefundReversalToastLine(
  summary: RefundReversalSummaryCents,
  formatMoney: (cents: number) => string,
  options?: { isDualRewards?: boolean },
): string {
  const total = Math.max(0, Number(summary.total_refunded_cents) || 0);
  if (total <= 0) {
    return "No wallet debit (nothing on record to refund).";
  }

  if (options?.isDualRewards) {
    const cpmCents =
      summary.cpm_refunded_cents ?? summary.reward_refunded_cents ?? 0;
    const milestoneCents =
      summary.milestone_refunded_cents ?? summary.bonus_refunded_cents ?? 0;
    return `${formatMoney(cpmCents)} CPM reversed, ${formatMoney(milestoneCents)} milestone reversed (${formatMoney(total)} total).`;
  }

  const reward = Math.max(0, Number(summary.reward_refunded_cents) || 0);
  const bonus = Math.max(0, Number(summary.bonus_refunded_cents) || 0);
  if (bonus > 0) {
    return `${formatMoney(reward)} reward reversed, ${formatMoney(bonus)} bonus reversed (${formatMoney(total)} total).`;
  }
  return `${formatMoney(reward)} reversed (${formatMoney(total)} total).`;
}

export type BulkModerationRefundToastInput = {
  actionText: string;
  successCount: number;
  failedCount?: number;
  qualityScoreLine?: string | null;
  refundedCount?: number | null;
  skippedCount?: number | null;
  rewardCents: number;
  bonusCents: number;
  totalCents: number;
  cpmCents?: number;
  milestoneCents?: number;
  isDualRewards?: boolean;
};

/**
 * One-line bulk moderation toast, matching video contest refund toasts:
 * "Successfully Verified 17 submission(s). Refunded 15 · Skipped 2. $3.21 reversed ($3.21 total)."
 */
export function formatBulkModerationRefundToast(
  input: BulkModerationRefundToastInput,
): string {
  const successCount = Math.max(0, Number(input.successCount) || 0);
  const failedCount = Math.max(0, Number(input.failedCount) || 0);
  const parts: string[] = [
    `Successfully ${input.actionText} ${successCount} submission(s).`,
  ];
  if (input.qualityScoreLine) {
    parts[0] += ` ${input.qualityScoreLine}`;
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} failed.`);
  }

  const refundedCount =
    input.refundedCount == null
      ? null
      : Math.max(0, Number(input.refundedCount) || 0);
  const skippedCount =
    input.skippedCount == null
      ? null
      : Math.max(0, Number(input.skippedCount) || 0);
  const totalCents = Math.max(0, Number(input.totalCents) || 0);
  const showPaidReversalStats =
    totalCents > 0 || (refundedCount != null && refundedCount > 0);

  if (showPaidReversalStats) {
    const refunded = refundedCount ?? 0;
    const skipped = skippedCount ?? 0;
    if (skipped > 0) {
      parts.push(`Refunded ${refunded} · Skipped ${skipped}.`);
    } else {
      parts.push(`Refunded ${refunded}.`);
    }
    parts.push(
      formatRefundReversalToastLine(
        {
          reward_refunded_cents: input.rewardCents,
          bonus_refunded_cents: input.bonusCents,
          total_refunded_cents: totalCents,
          cpm_refunded_cents: input.cpmCents ?? input.rewardCents,
          milestone_refunded_cents: input.milestoneCents ?? input.bonusCents,
        },
        formatUsdFromCents,
        { isDualRewards: input.isDualRewards === true },
      ),
    );
  }

  return parts.join(" ");
}
