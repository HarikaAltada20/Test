import { applyPayoutAdjustment } from "@/lib/payout-adjustment";

export type PayoutAdjustmentMode =
  | "cpm_only"
  | "milestone_only"
  | "bonus_only"
  | "combined"
  | "dual_rewards_only"
  | null;

export type ParsePayoutAdjustmentOptions = {
  /** When `contest_type` is `milestone`, `milestone_only` mode adjusts the main milestone reward. */
  contestType?: string | null;
};

export function parsePayoutAdjustment(
  percentageRaw: unknown,
  modeRaw: unknown,
  options?: ParsePayoutAdjustmentOptions,
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
  const contestType = options?.contestType ?? null;
  const shouldAdjustReward =
    hasAdjustment &&
    (mode === "combined" ||
      mode === "cpm_only" ||
      mode === "dual_rewards_only" ||
      (mode === "milestone_only" && contestType === "milestone"));
  const shouldAdjustBonus =
    hasAdjustment &&
    (mode === "combined" ||
      mode === "bonus_only" ||
      mode === "dual_rewards_only");

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
