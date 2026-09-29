export type BonusAllocation = {
  amount: number;
  reason: "allocated" | "partial_remainder" | "cap_exhausted" | "ineligible";
};

/**
 * Allocates flat-fee bonus while respecting remaining cap/budget.
 * Policy: allow partial remainder when remaining > 0 but < requested bonus.
 */
export function allocateFlatFeeBonusCents(
  requestedBonusCents: number,
  remainingBudgetCents: number | null,
): BonusAllocation {
  const requested = Math.max(0, Math.round(requestedBonusCents || 0));
  if (requested <= 0) return { amount: 0, reason: "ineligible" };
  if (remainingBudgetCents == null) return { amount: requested, reason: "allocated" };

  const remaining = Math.max(0, Math.round(remainingBudgetCents));
  if (remaining <= 0) return { amount: 0, reason: "cap_exhausted" };
  if (remaining >= requested) return { amount: requested, reason: "allocated" };
  return { amount: remaining, reason: "partial_remainder" };
}
