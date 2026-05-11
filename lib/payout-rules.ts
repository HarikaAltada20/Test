import { applyPayoutAdjustment } from "@/lib/payout-adjustment";

export type PayoutAdjustmentMode = "cpm_only" | "bonus_only" | "combined" | null;

export function parsePayoutAdjustment(
  percentageRaw: unknown,
  modeRaw: unknown,
): {
  percentage: number;
  mode: PayoutAdjustmentMode;
  hasAdjustment: boolean;
  shouldAdjustReward: boolean;
  shouldAdjustBonus: boolean;
} {
  const parsedPct =
    typeof percentageRaw === "number"
      ? percentageRaw
      : typeof percentageRaw === "string"
        ? parseFloat(percentageRaw) || 0
        : 0;
  const percentage = Math.max(0, parsedPct);
  const mode = (modeRaw ?? null) as PayoutAdjustmentMode;
  const hasAdjustment = percentage > 0 && !!mode;
  const shouldAdjustReward =
    hasAdjustment && (mode === "combined" || mode === "cpm_only");
  const shouldAdjustBonus =
    hasAdjustment && (mode === "combined" || mode === "bonus_only");

  return {
    percentage,
    mode,
    hasAdjustment,
    shouldAdjustReward,
    shouldAdjustBonus,
  };
}

export function adjustRewardCents(
  amountCents: number,
  adjustment: { shouldAdjustReward: boolean; percentage: number },
): number {
  if (!adjustment.shouldAdjustReward || amountCents <= 0) return amountCents;
  return applyPayoutAdjustment(amountCents, adjustment.percentage);
}

export function adjustBonusCents(
  amountCents: number,
  adjustment: { shouldAdjustBonus: boolean; percentage: number },
): number {
  if (!adjustment.shouldAdjustBonus || amountCents <= 0) return amountCents;
  return applyPayoutAdjustment(amountCents, adjustment.percentage);
}

export function clampNonNegative(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
