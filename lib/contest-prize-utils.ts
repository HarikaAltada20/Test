/**
 * Leaderboard prize amounts are stored in cents. Occasionally a single prize
 * entry can drift (e.g. dollars entered twice) while total_prize stays correct.
 * Reconcile individual prizes against the trusted total pool.
 */
export function reconcileLeaderboardPrizeAmounts(
  amounts: number[],
  totalPrizeInCents: number,
): number[] {
  if (!amounts.length || totalPrizeInCents <= 0) {
    return amounts;
  }

  const sum = amounts.reduce((acc, val) => acc + val, 0);
  if (sum === totalPrizeInCents) {
    return amounts;
  }

  const fixed = [...amounts];

  for (let i = 0; i < fixed.length; i++) {
    if (fixed[i] > totalPrizeInCents) {
      const othersSum = fixed.reduce(
        (acc, val, idx) => (idx === i ? acc : acc + val),
        0,
      );
      fixed[i] = Math.max(0, totalPrizeInCents - othersSum);
    }
  }

  const fixedSum = fixed.reduce((acc, val) => acc + val, 0);
  if (fixedSum !== totalPrizeInCents && fixed.length > 0) {
    const tailSum = fixed.slice(1).reduce((acc, val) => acc + val, 0);
    fixed[0] = Math.max(0, totalPrizeInCents - tailSum);
  }

  return fixed;
}
