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
      remainingCents?: number;
    }
  | {
      allowed: false;
      error: string;
      poolBudgetCents: number;
      projectedSpentCents: number;
      remainingCents: number;
    };

export const DUAL_REWARDS_POOL_NOT_CONFIGURED_ERROR =
  "Contest prize pool is not configured";

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

export function poolBudgetNotConfiguredResult(
  projectedSpentCents = 0,
): DualPoolBudgetCheckResult {
  return {
    allowed: false,
    error: DUAL_REWARDS_POOL_NOT_CONFIGURED_ERROR,
    poolBudgetCents: 0,
    projectedSpentCents,
    remainingCents: 0,
  };
}

export function validateDualRewardsPoolBudget(params: {
  poolBudgetCents: number;
  rows: DualPoolSpendSubmissionRow[];
  targetSubmissionId: string;
  targetAfter: DualPoolSpendComponents;
  requirePositivePool?: boolean;
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
    if (params.requirePositivePool !== false) {
      return poolBudgetNotConfiguredResult(projectedSpentCents);
    }
    return { allowed: true, poolBudgetCents, projectedSpentCents };
  }

  if (projectedSpentCents <= poolBudgetCents) {
    return {
      allowed: true,
      poolBudgetCents,
      projectedSpentCents,
      remainingCents: poolBudgetCents - projectedSpentCents,
    };
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

function parseRpcPoolBudgetResult(raw: unknown): DualPoolBudgetCheckResult {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const allowed = o.allowed === true;
  const poolBudgetCents = Math.max(
    0,
    Math.round(Number(o.pool_budget_cents) || 0),
  );
  const projectedSpentCents = Math.max(
    0,
    Math.round(Number(o.projected_spent_cents) || 0),
  );
  const remainingCents = Math.max(
    0,
    Math.round(Number(o.remaining_cents) || 0),
  );
  if (allowed) {
    return {
      allowed: true,
      poolBudgetCents,
      projectedSpentCents,
      remainingCents,
    };
  }
  return {
    allowed: false,
    error:
      typeof o.error === "string" && o.error.trim()
        ? o.error
        : "Contest prize pool budget check failed",
    poolBudgetCents,
    projectedSpentCents,
    remainingCents,
  };
}

/**
 * Serialized pool check (Postgres advisory lock). Falls back to in-app validation
 * if the RPC is not deployed yet.
 */
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
  const targetCpm = Math.max(0, Math.round(targetAfter.cpmCents));
  const targetMs = Math.max(0, Math.round(targetAfter.milestoneCents));

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    "dual_rewards_assert_pool_budget",
    {
      p_contest_id: contestId,
      p_target_submission_id: targetSubmissionId,
      p_target_cpm_cents: targetCpm,
      p_target_milestone_cents: targetMs,
    },
  );

  if (!rpcError && rpcData != null) {
    return parseRpcPoolBudgetResult(rpcData);
  }

  const rpcMissing =
    rpcError &&
    (/function.*does not exist|could not find/i.test(rpcError.message) ||
      rpcError.code === "42883");

  if (!rpcMissing) {
    return {
      allowed: false,
      error: `Failed to verify contest pool budget: ${rpcError?.message || "unknown"}`,
      poolBudgetCents,
      projectedSpentCents: 0,
      remainingCents: 0,
    };
  }

  if (poolBudgetCents <= 0) {
    return poolBudgetNotConfiguredResult();
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
    targetAfter: { cpmCents: targetCpm, milestoneCents: targetMs },
    requirePositivePool: true,
  });
}

/** HTTP-friendly helper for dual-rewards payout routes. */
export async function checkDualRewardsPoolBudgetForPayment(params: {
  supabaseAdmin: SupabaseClient;
  contest: {
    id?: string;
    contest_type?: string | null;
    contest_based_details?: unknown;
    total_budget?: number | null;
  };
  contestId: string;
  targetSubmissionId: string;
  targetAfter: DualPoolSpendComponents;
}): Promise<
  | { ok: true; check: DualPoolBudgetCheckResult }
  | { ok: false; check: DualPoolBudgetCheckResult }
> {
  const check = await assertDualRewardsPoolBudgetAllowsPayment(
    params.supabaseAdmin,
    params.contest,
    params.contestId,
    params.targetSubmissionId,
    params.targetAfter,
  );
  if (check.allowed) {
    return { ok: true, check };
  }
  return { ok: false, check };
}
