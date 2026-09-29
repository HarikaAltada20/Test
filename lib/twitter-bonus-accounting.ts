/**
 * Helpers for summing the *bonus-only* portion of `money_transactions` rows
 * tied to Twitter contests' flat-fee bonus cap.
 *
 * Twitter bulk payouts (`payout_type === "twitter_cpm_bulk"`) store CPM + bonus
 * combined in `amount`, with the bonus-only slice in `metadata.total_bonus`
 * (and per-tweet split in `metadata.twitter_bulk_bonus_breakdown`). Summing
 * `amount` for cap-tracking would double-count the CPM portion.
 *
 * Single-tweet / per-creator bonus rows store bonus-only in `amount`, so they
 * fall through to the default branch.
 */

export type BonusTransactionRow = {
  amount?: number | null;
  metadata?: Record<string, any> | null;
  remarks?: string | null;
};

/** Bonus-only cents for one money_transactions row. */
export function bonusAmountFromTransaction(row: BonusTransactionRow): number {
  const meta = (row?.metadata || {}) as Record<string, any>;
  if (meta.payout_type === "twitter_cpm_bulk") {
    const totalBonus = Number(meta.total_bonus);
    if (Number.isFinite(totalBonus) && totalBonus > 0) return totalBonus;
    const breakdown = meta.twitter_bulk_bonus_breakdown;
    if (breakdown && typeof breakdown === "object") {
      let sum = 0;
      for (const value of Object.values(breakdown)) {
        const cents = Number(value);
        if (Number.isFinite(cents) && cents > 0) sum += cents;
      }
      return sum;
    }
    return 0;
  }
  return Number(row?.amount) || 0;
}

export function sumBonusRewards(rows: BonusTransactionRow[]): number {
  return (rows || []).reduce((s, r) => s + bonusAmountFromTransaction(r), 0);
}

export function sumBonusRefunds(
  rows: BonusTransactionRow[],
  options: { reversalRemark: string },
): number {
  return (rows || [])
    .filter((r) => !r?.remarks || r.remarks === options.reversalRemark)
    .reduce((s, r) => s + bonusAmountFromTransaction(r), 0);
}
