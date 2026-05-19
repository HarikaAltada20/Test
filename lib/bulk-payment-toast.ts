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

/** Dual-rewards bulk pay: match CPM/milestone bulk toast field layout. */
export function formatDualBulkPaymentToastDescription(
  totals: DualBulkPaymentToastTotals,
): string {
  const totalPaidCents = totals.totalCpmCents + totals.totalMilestoneCents;
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  return [
    `Paid items: ${totals.successCount}`,
    `Skipped: ${totals.skippedCount}`,
    ``,
    `CPM : ${fmt(totals.totalCpmCents)}`,
    `Milestone: ${fmt(totals.totalMilestoneCents)}`,
    `Total paid: ${fmt(totalPaidCents)}`,
  ].join("\n");
}

export type RefundReversalSummaryCents = {
  reward_refunded_cents: number;
  bonus_refunded_cents: number;
  total_refunded_cents: number;
  cpm_refunded_cents?: number;
  milestone_refunded_cents?: number;
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

  return `${formatMoney(summary.reward_refunded_cents)} reward reversed, ${formatMoney(summary.bonus_refunded_cents)} bonus reversed (${formatMoney(total)} total).`;
}
