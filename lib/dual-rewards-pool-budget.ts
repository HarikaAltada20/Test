import type { SupabaseClient } from "@supabase/supabase-js";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import { parseDualRewardsPayoutJson } from "@/lib/dual-rewards-payout";

export type DualPoolSpendSubmissionRow = {
  id: string;
  earnings?: number | null;
  paid?: boolean | null;
  bonus_amount?: number | null;
  bonus_paid?: boolean | null;
  dual_rewards_payout?: unknown;
};

export type DualPoolSpendComponents = {
  cpmCents: number;
  milestoneCents: number;
};

export type DualPoolBudgetCheckResult =
  | {
      allowed: true;
      poolBudgetCents: number;
      projectedSpentCents: number;
    }
  | {
      allowed: false;
      error: string;
      poolBudgetCents: number;
      projectedSpentCents: number;
      remainingCents: number;
    };

const POOL_SPEND_SELECT =
  "id, earnings, paid, bonus_amount, bonus_paid, dual_rewards_payout";

/** Paid CPM + milestone cents recorded for one submission (JSON preferred). */
export function getDualRewardsSubmissionPaidComponents(
  row: DualPoolSpendSubmissionRow,
): DualPoolSpendComponents {
  const dual = parseDualRewardsPayoutJson(row.dual_rewards_payout);
  if (dual) {
    return {
      cpmCents: Math.max(0, Math.round(dual.cpm_cents)),
      milestoneCents: Math.max(0, Math.round(dual.milestone_cents)),
    };
  }
  const cpmCents =
    row.paid === true ? Math.max(0, Math.round(Number(row.earnings) || 0)) : 0;
  const milestoneCents =
    row.bonus_paid === true
      ? Math.max(0, Math.round(Number(row.bonus_amount) || 0))
      : 0;
  return { cpmCents, milestoneCents };
}

/** Sum paid components across all contest submissions. */
export function sumDualRewardsContestPaidSpentCents(
  rows: DualPoolSpendSubmissionRow[],
): number {
  let total = 0;
  for (const row of rows) {
    const { cpmCents, milestoneCents } =
      getDualRewardsSubmissionPaidComponents(row);
    total += cpmCents + milestoneCents;
  }
  return total;
}

/**
 * Projected contest spend after applying `targetAfter` on one submission
 * (all other rows keep current paid components).
 */
export function computeDualRewardsProjectedPoolSpentCents(
  rows: DualPoolSpendSubmissionRow[],
  targetSubmissionId: string,
  targetAfter: DualPoolSpendComponents,
): number {
  let total = 0;
  const targetId = String(targetSubmissionId);
  const afterCpm = Math.max(0, Math.round(targetAfter.cpmCents));
  const afterMs = Math.max(0, Math.round(targetAfter.milestoneCents));

  for (const row of rows) {
    if (String(row.id) === targetId) {
      total += afterCpm + afterMs;
    } else {
      const { cpmCents, milestoneCents } =
        getDualRewardsSubmissionPaidComponents(row);
      total += cpmCents + milestoneCents;
    }
  }
  return total;
}

export function getDualRewardsPoolBudgetCents(contest: {
  contest_type?: string | null;
  contest_based_details?: unknown;
  total_budget?: number | null;
}): number {
  const fromDetails = getPoolBudgetCentsFromDetails(
    contest.contest_type,
    contest.contest_based_details as Parameters<
      typeof getPoolBudgetCentsFromDetails
    >[1],
  );
  if (fromDetails > 0) return fromDetails;
  const rowBudget = Number((contest as { total_budget?: number }).total_budget);
  return Number.isFinite(rowBudget) && rowBudget > 0 ? rowBudget : 0;
}

export function validateDualRewardsPoolBudget(params: {
  poolBudgetCents: number;
  rows: DualPoolSpendSubmissionRow[];
  targetSubmissionId: string;
  targetAfter: DualPoolSpendComponents;
}): DualPoolBudgetCheckResult {
  const poolBudgetCents = Math.max(
    0,
    Math.round(Number(params.poolBudgetCents) || 0),
  );
  const projectedSpentCents = computeDualRewardsProjectedPoolSpentCents(
    params.rows,
    params.targetSubmissionId,
    params.targetAfter,
  );

  if (poolBudgetCents <= 0) {
    return { allowed: true, poolBudgetCents, projectedSpentCents };
  }

  if (projectedSpentCents <= poolBudgetCents) {
    return { allowed: true, poolBudgetCents, projectedSpentCents };
  }

  return {
    allowed: false,
    error: "Contest prize pool budget would be exceeded",
    poolBudgetCents,
    projectedSpentCents,
    remainingCents: Math.max(0, poolBudgetCents - projectedSpentCents),
  };
}

export async function fetchDualRewardsPoolSpendRows(
  supabaseAdmin: SupabaseClient,
  contestId: string,
): Promise<
  | { rows: DualPoolSpendSubmissionRow[]; error?: undefined }
  | { rows?: undefined; error: string }
> {
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select(POOL_SPEND_SELECT)
    .eq("contest_id", contestId);

  if (error) {
    return { error: error.message };
  }

  return {
    rows: (data || []).map((row) => ({
      id: String(row.id),
      earnings: row.earnings,
      paid: row.paid,
      bonus_amount: row.bonus_amount,
      bonus_paid: row.bonus_paid,
      dual_rewards_payout: row.dual_rewards_payout,
    })),
  };
}

/** Load rows and validate a projected payout against the contest pool. */
export async function assertDualRewardsPoolBudgetAllowsPayment(
  supabaseAdmin: SupabaseClient,
  contest: {
    id?: string;
    contest_type?: string | null;
    contest_based_details?: unknown;
    total_budget?: number | null;
  },
  contestId: string,
  targetSubmissionId: string,
  targetAfter: DualPoolSpendComponents,
): Promise<DualPoolBudgetCheckResult> {
  const poolBudgetCents = getDualRewardsPoolBudgetCents(contest);
  if (poolBudgetCents <= 0) {
    return {
      allowed: true,
      poolBudgetCents: 0,
      projectedSpentCents: 0,
    };
  }

  const fetchResult = await fetchDualRewardsPoolSpendRows(
    supabaseAdmin,
    contestId,
  );
  if (fetchResult.error) {
    return {
      allowed: false,
      error: `Failed to load contest spend for pool check: ${fetchResult.error}`,
      poolBudgetCents,
      projectedSpentCents: 0,
      remainingCents: 0,
    };
  }

  return validateDualRewardsPoolBudget({
    poolBudgetCents,
    rows: fetchResult.rows ?? [],
    targetSubmissionId,
    targetAfter,
  });
}
