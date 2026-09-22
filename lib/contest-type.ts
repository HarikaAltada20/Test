/**
 * Contest type helpers. "dual_rewards" combines per-view (CPM) pay with milestone unlocks.
 */
export function isCpmContestType(contestType: string | null | undefined) {
  return contestType === "cpm" || contestType === "dual_rewards";
}

export function isMilestoneContestType(contestType: string | null | undefined) {
  return contestType === "milestone" || contestType === "dual_rewards";
}

/** Milestone-only campaigns (excludes dual_rewards, which has its own CPM + milestone split). */
export function isMilestoneOnlyContestType(
  contestType: string | null | undefined,
) {
  return contestType === "milestone";
}

export function isDualRewardsContestType(
  contestType: string | null | undefined,
) {
  return contestType === "dual_rewards";
}

/** contest_based_details shape for pool reads */
export type ContestBasedDetailsForPool = {
  /** Dual rewards: unified pool (cents) at root; preferred over nested legacy fields. */
  total_budget_cents?: number | null;
  cpm_contest?: { total_budget?: number | null } | null;
  milestone_contest?: { total_budget_cents?: number | null } | null;
} | null;

/** Multi-platform contests copy the shared pool under these keys (do not sum). */
const POOL_BUDGET_PLATFORM_KEYS = ["youtube", "instagram", "tiktok"] as const;

function readDirectPoolBudgetCents(
  contestType: string | null | undefined,
  details: ContestBasedDetailsForPool,
): number {
  if (!details) return 0;
  if (contestType === "dual_rewards") {
    const root = details.total_budget_cents;
    if (typeof root === "number" && root > 0) return root;
    const ms = details.milestone_contest?.total_budget_cents ?? 0;
    const cpm = details.cpm_contest?.total_budget ?? 0;
    // Legacy: nested budgets may mirror the same pool — never sum both.
    if (ms > 0 && cpm > 0) return Math.max(ms, cpm);
    return ms > 0 ? ms : cpm > 0 ? cpm : 0;
  }
  if (contestType === "cpm") {
    const cpm = details.cpm_contest?.total_budget;
    return typeof cpm === "number" ? cpm : 0;
  }
  if (contestType === "milestone") {
    const ms = details.milestone_contest?.total_budget_cents;
    return typeof ms === "number" ? ms : 0;
  }
  return 0;
}

/**
 * Unified prize pool in cents from contest_based_details.
 * Dual rewards: prefer root total_budget_cents; else legacy milestone_contest.total_budget_cents or cpm_contest.total_budget.
 * Multi-platform: when root payout is empty, use the shared pool copied under youtube|instagram|tiktok (do not sum).
 */
export function getPoolBudgetCentsFromDetails(
  contestType: string | null | undefined,
  details: ContestBasedDetailsForPool,
): number {
  const direct = readDirectPoolBudgetCents(contestType, details);
  if (direct > 0) return direct;
  if (!details || typeof details !== "object") return 0;

  const record = details as Record<string, unknown>;
  for (const key of POOL_BUDGET_PLATFORM_KEYS) {
    const nested = record[key];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
      continue;
    }
    const cents = readDirectPoolBudgetCents(
      contestType,
      nested as ContestBasedDetailsForPool,
    );
    if (cents > 0) return cents;
  }
  return 0;
}
