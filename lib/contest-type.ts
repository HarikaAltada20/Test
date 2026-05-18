/**
 * Contest type helpers. "dual_rewards" combines per-view (CPM) pay with milestone unlocks.
 */
export function isCpmContestType(contestType: string | null | undefined) {
  return contestType === "cpm" || contestType === "dual_rewards";
}

export function isMilestoneContestType(contestType: string | null | undefined) {
  return contestType === "milestone" || contestType === "dual_rewards";
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

/**
 * Unified prize pool in cents from contest_based_details.
 * Dual rewards: prefer root total_budget_cents; else legacy milestone_contest.total_budget_cents or cpm_contest.total_budget.
 */
export function getPoolBudgetCentsFromDetails(
  contestType: string | null | undefined,
  details: ContestBasedDetailsForPool,
): number {
  if (!details) return 0;
  if (contestType === "dual_rewards") {
    const root = details.total_budget_cents;
    if (typeof root === "number" && root > 0) return root;
    // For dual rewards, if root is missing, sum the components
    const ms = details.milestone_contest?.total_budget_cents || 0;
    const cpm = details.cpm_contest?.total_budget || 0;
    return ms + cpm;
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
