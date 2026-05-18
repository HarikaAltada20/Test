import { applyPayoutAdjustment } from "@/lib/payout-adjustment";

export type PayoutAdjustmentMode =
  | "cpm_only"
  | "milestone_only"
  | "bonus_only"
  | "bonus"
  | "combined"
  /** Dual rewards: CPM + milestone ladder only (excludes most-verified bonus and flat-fee bonus adjustment). */
  | "cpm_and_milestone"
  | "dual_rewards_only"
  | null;

export type ParsePayoutAdjustmentOptions = {
  /** Pass `contest_type` so `milestone_only` applies to milestone and dual_rewards ladder pay. */
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
  /** Milestone "most verified" views/reels bonus (and dual_rewards equivalent). */
  shouldAdjustMostVerifiedMilestoneBonus: boolean;
} {
  const parsedPct =
    typeof percentageRaw === "number"
      ? percentageRaw
      : typeof percentageRaw === "string"
        ? parseFloat(percentageRaw) || 0
        : 0;
  const percentage = Math.max(0, parsedPct);
  const raw = (modeRaw ?? null) as string | null;
  /** Legacy rows used `most_verified_bonus_only`; normalize to `bonus` for return + UI. */
  const wasLegacyMostVerifiedOnly = raw === "most_verified_bonus_only";
  const mode: PayoutAdjustmentMode = wasLegacyMostVerifiedOnly
    ? "bonus"
    : ((raw ?? null) as PayoutAdjustmentMode);
  const hasAdjustment = percentage > 0 && !!mode;
  const contestType = options?.contestType ?? null;
  const shouldAdjustReward =
    hasAdjustment &&
    (mode === "combined" ||
      mode === "cpm_and_milestone" ||
      mode === "cpm_only" ||
      mode === "dual_rewards_only" ||
      (mode === "milestone_only" &&
        (contestType === "milestone" || contestType === "dual_rewards")));
  const shouldAdjustBonus =
    hasAdjustment &&
    (mode === "combined" ||
      mode === "bonus_only" ||
      mode === "dual_rewards_only");
  const shouldAdjustMostVerifiedMilestoneBonus =
    hasAdjustment &&
    (mode === "combined" ||
      mode === "dual_rewards_only" ||
      (mode === "bonus_only" && contestType !== "dual_rewards") ||
      (mode === "bonus" &&
        (contestType === "dual_rewards" || wasLegacyMostVerifiedOnly)));

  return {
    percentage,
    mode,
    hasAdjustment,
    shouldAdjustReward,
    shouldAdjustBonus,
    shouldAdjustMostVerifiedMilestoneBonus,
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
