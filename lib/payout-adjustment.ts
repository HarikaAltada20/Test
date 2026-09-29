/**
 * Apply contest-level payout adjustment (percentage reduction) to an amount in cents.
 * @param amountCents - Amount in cents (e.g. CPM or bonus)
 * @param percentage - Reduction percentage (0–100). 0 or 100 returns 0 for 100, unchanged for 0.
 * @returns Adjusted amount in cents (rounded, never negative)
 */
export function applyPayoutAdjustment(
  amountCents: number,
  percentage: number
): number {
  if (percentage >= 100) return 0;
  if (percentage <= 0) return amountCents;
  return Math.max(
    0,
    Math.round(amountCents * ((100 - percentage) / 100))
  );
}
