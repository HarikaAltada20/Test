/**
 * Stable debit idempotency key for payout rollback paths.
 * Prevents double-debit when a server timeout retries after a successful debit.
 */
export function buildWalletRollbackDebitIdempotencyKey(params: {
  payoutOperationKey: string;
  reason: string;
}): string {
  const payoutKey = String(params.payoutOperationKey || "")
    .trim()
    .slice(0, 160);
  const reason = String(params.reason || "rollback")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]+/g, "_")
    .slice(0, 64);
  return `wallet_rollback:v1:${payoutKey}:${reason || "rollback"}`;
}

/**
 * Split a fresh (non-idempotent) bulk wallet credit into prize vs bonus
 * components so failed row updates can revert the correct submission flags.
 */
export function splitFreshBulkCreditCents(params: {
  paymentType: "standard" | "bonus" | "both";
  payableTotalAmount: number;
  payableTotalMainPaid: number;
  totalBonusPaid: number;
  alreadyApplied: boolean;
}): { freshPrizeCreditedCents: number; freshBonusCreditedCents: number } {
  if (params.alreadyApplied) {
    return { freshPrizeCreditedCents: 0, freshBonusCreditedCents: 0 };
  }

  const total = Math.max(0, Math.round(params.payableTotalAmount) || 0);
  if (total <= 0) {
    return { freshPrizeCreditedCents: 0, freshBonusCreditedCents: 0 };
  }

  if (params.paymentType === "bonus") {
    return {
      freshPrizeCreditedCents: 0,
      freshBonusCreditedCents: total,
    };
  }

  if (params.paymentType === "standard") {
    return {
      freshPrizeCreditedCents: total,
      freshBonusCreditedCents: 0,
    };
  }

  const prize = Math.max(0, Math.round(params.payableTotalMainPaid) || 0);
  const bonus = Math.max(0, Math.round(params.totalBonusPaid) || 0);
  return {
    freshPrizeCreditedCents: prize,
    freshBonusCreditedCents: bonus,
  };
}

/**
 * Decide which submission flags to clear after a wallet rollback.
 */
export function bulkPaymentRollbackRevertFlags(params: {
  paymentType: "standard" | "bonus" | "both";
  prizeRollbackCents: number;
  bonusRollbackCents: number;
  rollbackCents: number;
  hadBonusPaidUpdate: boolean;
}): { revertPrize: boolean; revertBonus: boolean } {
  const componentsTracked =
    Math.max(0, params.prizeRollbackCents) +
    Math.max(0, params.bonusRollbackCents);
  const useFallbackComponentRevert =
    componentsTracked === 0 && params.rollbackCents > 0;

  const revertPrize =
    params.paymentType !== "bonus" &&
    (params.prizeRollbackCents > 0 || useFallbackComponentRevert);

  const revertBonus =
    params.hadBonusPaidUpdate &&
    (params.bonusRollbackCents > 0 ||
      (useFallbackComponentRevert && params.paymentType !== "standard"));

  return { revertPrize, revertBonus };
}
