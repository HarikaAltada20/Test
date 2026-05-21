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

export type DualPoolBudgetCheckAllowed = {
  allowed: true;
  poolBudgetCents: number;
  projectedSpentCents: number;
  remainingCents?: number;
  committed?: boolean;
  previousDualRewardsPayout?: unknown | null;
};

export type DualPoolBudgetCheckDenied = {
  allowed: false;
  error: string;
  poolBudgetCents: number;
  projectedSpentCents: number;
  remainingCents: number;
  committed?: boolean;
};

export type DualPoolBudgetCheckResult =
  | DualPoolBudgetCheckAllowed
  | DualPoolBudgetCheckDenied;

export type DualPoolBudgetPaymentResult =
  | { ok: true; check: DualPoolBudgetCheckAllowed }
  | { ok: false; check: DualPoolBudgetCheckDenied };

export const DUAL_REWARDS_POOL_NOT_CONFIGURED_ERROR =
  "Contest prize pool is not configured";

const POOL_SPEND_SELECT =
  "id, earnings, paid, bonus_amount, bonus_paid, dual_rewards_payout";

function readDualPayoutFieldCents(
  raw: unknown,
  key: "cpm_cents" | "milestone_cents",
): number | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const camelKey = key === "cpm_cents" ? "cpmCents" : "milestoneCents";
  const n = Number(o[key] ?? o[camelKey]);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function legacyDualPaidComponents(
  row: DualPoolSpendSubmissionRow,
): DualPoolSpendComponents {
  const cpmCents =
    row.paid === true ? Math.max(0, Math.round(Number(row.earnings) || 0)) : 0;
  const milestoneCents =
    row.bonus_paid === true
      ? Math.max(0, Math.round(Number(row.bonus_amount) || 0))
      : 0;
  return { cpmCents, milestoneCents };
}

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
  const cpmFromJson = readDualPayoutFieldCents(row.dual_rewards_payout, "cpm_cents");
  const msFromJson = readDualPayoutFieldCents(
    row.dual_rewards_payout,
    "milestone_cents",
  );
  if (cpmFromJson != null || msFromJson != null) {
    const legacy = legacyDualPaidComponents(row);
    return {
      cpmCents: cpmFromJson ?? legacy.cpmCents,
      milestoneCents: msFromJson ?? legacy.milestoneCents,
    };
  }
  return legacyDualPaidComponents(row);
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
  const committed = o.committed === true;
  const previousDualRewardsPayout = Object.prototype.hasOwnProperty.call(
    o,
    "previous_dual_rewards_payout",
  )
    ? o.previous_dual_rewards_payout
    : undefined;
  if (allowed) {
    return {
      allowed: true,
      poolBudgetCents,
      projectedSpentCents,
      remainingCents,
      committed,
      previousDualRewardsPayout,
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
    committed: false,
  };
}

function isRpcMissingError(rpcError: { message?: string; code?: string } | null) {
  return (
    rpcError &&
    (/function.*does not exist|could not find/i.test(rpcError.message || "") ||
      rpcError.code === "42883")
  );
}

/**
 * Serialized pool check (Postgres advisory lock). When `commit` is true, persists
 * `dual_rewards_payout` on the target row in the same DB transaction so concurrent
 * payouts cannot both pass validation.
 */
/** Whether a pool commit should be rolled back after a payout step fails. */
export function shouldRollbackDualRewardsPoolCommit(
  poolPayment: DualPoolBudgetPaymentResult | undefined,
  options?: { walletCredited?: boolean },
): boolean {
  if (options?.walletCredited) return false;
  return !!(poolPayment?.ok && poolPayment.check.committed);
}

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
  options?: {
    commit?: boolean;
    /** Full JSON written on commit (avoids partial cpm/milestone-only rows). */
    commitPayout?: Record<string, unknown>;
  },
): Promise<DualPoolBudgetCheckResult> {
  const poolBudgetCents = getDualRewardsPoolBudgetCents(contest);
  const targetCpm = Math.max(0, Math.round(targetAfter.cpmCents));
  const targetMs = Math.max(0, Math.round(targetAfter.milestoneCents));
  const commit = options?.commit === true;

  const rpcArgs: Record<string, unknown> = {
    p_contest_id: contestId,
    p_target_submission_id: targetSubmissionId,
    p_target_cpm_cents: targetCpm,
    p_target_milestone_cents: targetMs,
  };
  if (commit) {
    rpcArgs.p_commit = true;
    if (
      options?.commitPayout &&
      typeof options.commitPayout === "object" &&
      !Array.isArray(options.commitPayout)
    ) {
      rpcArgs.p_commit_payout = options.commitPayout;
    }
  }

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    "dual_rewards_assert_pool_budget",
    rpcArgs,
  );

  if (!rpcError && rpcData != null) {
    const parsed = parseRpcPoolBudgetResult(rpcData);
    if (commit && parsed.allowed && parsed.committed !== true) {
      return {
        allowed: false,
        error:
          "Pool budget commit did not persist (deploy migration 20260521130000_dual_rewards_pool_budget_commit)",
        poolBudgetCents: parsed.poolBudgetCents,
        projectedSpentCents: parsed.projectedSpentCents,
        remainingCents: parsed.remainingCents ?? 0,
        committed: false,
      };
    }
    return parsed;
  }

  if (!isRpcMissingError(rpcError)) {
    return {
      allowed: false,
      error: `Failed to verify contest pool budget: ${rpcError?.message || "unknown"}`,
      poolBudgetCents,
      projectedSpentCents: 0,
      remainingCents: 0,
      committed: false,
    };
  }

  if (commit) {
    return {
      allowed: false,
      error:
        "Pool budget commit RPC is not deployed; run Supabase migrations before processing dual-rewards payouts",
      poolBudgetCents,
      projectedSpentCents: 0,
      remainingCents: 0,
      committed: false,
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
      committed: false,
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

/** Undo a pool commit when wallet credit fails after dual_rewards_payout was reserved. */
export async function rollbackDualRewardsPoolCommit(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  targetSubmissionId: string,
  previousDualRewardsPayout: unknown | null | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("submissions")
    .update({ dual_rewards_payout: previousDualRewardsPayout ?? null })
    .eq("id", targetSubmissionId)
    .eq("contest_id", contestId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type DualRewardsPoolRollbackOptions = {
  /**
   * When true, the creator wallet was already credited — do not roll back pool
   * reservation (retry must only complete submission flags / payout JSON).
   */
  walletCredited?: boolean;
};

/** Roll back pool reservation only when wallet credit did not succeed. */
export async function rollbackDualRewardsPoolCommitIfNeeded(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  targetSubmissionId: string,
  poolPayment: DualPoolBudgetPaymentResult | undefined,
  options?: DualRewardsPoolRollbackOptions,
): Promise<{ rolledBack: boolean; skippedBecauseWalletCredited?: boolean; error?: string }> {
  if (!shouldRollbackDualRewardsPoolCommit(poolPayment, options)) {
    return {
      rolledBack: false,
      skippedBecauseWalletCredited: options?.walletCredited === true,
    };
  }
  const result = await rollbackDualRewardsPoolCommit(
    supabaseAdmin,
    contestId,
    targetSubmissionId,
    poolPayment.check.previousDualRewardsPayout,
  );
  return result.ok
    ? { rolledBack: true }
    : { rolledBack: false, error: result.error };
}

/** HTTP-friendly helper for dual-rewards payout routes (commits pool slot by default). */
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
  /** When false, dry-run only (no dual_rewards_payout write). Default true for payouts. */
  commit?: boolean;
  /** Full payout JSON persisted on commit (recommended). */
  commitPayout?: Record<string, unknown>;
}): Promise<DualPoolBudgetPaymentResult> {
  const commit = params.commit !== false;
  const check = await assertDualRewardsPoolBudgetAllowsPayment(
    params.supabaseAdmin,
    params.contest,
    params.contestId,
    params.targetSubmissionId,
    params.targetAfter,
    { commit, commitPayout: params.commitPayout },
  );
  if (check.allowed) {
    return { ok: true, check };
  }
  return { ok: false, check };
}
