import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import {
  parseDualRewardsPayoutJson,
  splitDualReversalRefundFromPayout,
} from "@/lib/dual-rewards-payout";

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

export type MoneyTxnRow = {
  amount?: number | null;
  remarks?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DualRewardsSubmissionReversalDue = {
  totalCents: number;
  mainCents: number;
  bonusCents: number;
  bonusReversals: { bonusType: string; amount: number }[];
};

export function submissionIdFromMoneyTxnMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string {
  const m = metadata ?? {};
  return String(
    (m.submission_id as string) ||
      (m.source_submission_id as string) ||
      "",
  );
}

export function moneyTxnBelongsToContest(params: {
  tx: MoneyTxnRow;
  contestId: string;
  contestSubmissionIds: ReadonlySet<string>;
}): boolean {
  const m = params.tx.metadata ?? {};
  if (String(m.contest_id || "") === String(params.contestId)) return true;
  const sid = submissionIdFromMoneyTxnMetadata(m);
  return sid.length > 0 && params.contestSubmissionIds.has(sid);
}

export function filterMoneyTxnsForContest(
  rows: MoneyTxnRow[] | null | undefined,
  contestId: string,
  contestSubmissionIds: ReadonlySet<string>,
): MoneyTxnRow[] {
  return (rows ?? []).filter((tx) =>
    moneyTxnBelongsToContest({ tx, contestId, contestSubmissionIds }),
  );
}

export function computeSubmissionGrossWalletNetCents(
  rewardTxns: MoneyTxnRow[],
  refundTxns: MoneyTxnRow[],
  submissionId: string,
  reversalRemark: string,
): number {
  const sid = String(submissionId);
  const isSubTx = (tx: MoneyTxnRow) =>
    submissionIdFromMoneyTxnMetadata(tx.metadata) === sid;
  const isReversalRefund = (tx: MoneyTxnRow) =>
    !tx.remarks || tx.remarks === reversalRemark;
  const sum = (rows: MoneyTxnRow[]) =>
    rows.reduce((s, tx) => s + Math.max(0, Number(tx.amount) || 0), 0);

  const grossRewards = sum(rewardTxns.filter(isSubTx));
  const grossRefunds = sum(
    refundTxns.filter((tx) => isSubTx(tx) && isReversalRefund(tx)),
  );
  return Math.max(0, grossRewards - grossRefunds);
}

export function resolveDualRewardsPaidReversalAmounts(
  row: DualPoolSpendSubmissionRow,
  ledgerMainCents: number,
  ledgerBonusCents: number,
  submissionWalletNetCents?: number,
): { mainCents: number; bonusCents: number; totalCents: number } {
  const paid = getDualRewardsSubmissionPaidComponents(row);
  const dualTotal = paid.cpmCents + paid.milestoneCents;
  const main = Math.max(0, Math.round(Number(ledgerMainCents) || 0));
  const bonus = Math.max(0, Math.round(Number(ledgerBonusCents) || 0));
  const ledgerTotal = main + bonus;
  const walletNet = Math.max(
    ledgerTotal,
    Math.max(0, Math.round(Number(submissionWalletNetCents) || 0)),
  );

  const splitFromTotal = (total: number) => {
    const { cpmCents, milestoneCents } = splitDualReversalRefundFromPayout(
      row.dual_rewards_payout,
      total,
      main,
      bonus,
    );
    return {
      mainCents: cpmCents,
      bonusCents: milestoneCents,
      totalCents: total,
    };
  };

  const hasDualJson = parseDualRewardsPayoutJson(row.dual_rewards_payout) != null;

  if (walletNet > ledgerTotal) {
    if (hasDualJson && dualTotal >= walletNet) {
      return {
        mainCents: paid.cpmCents,
        bonusCents: paid.milestoneCents,
        totalCents: dualTotal,
      };
    }
    return splitFromTotal(walletNet);
  }

  if (dualTotal <= 0) {
    return { mainCents: main, bonusCents: bonus, totalCents: ledgerTotal };
  }

  if (dualTotal > ledgerTotal && walletNet <= 0) {
    return {
      mainCents: paid.cpmCents,
      bonusCents: paid.milestoneCents,
      totalCents: dualTotal,
    };
  }

  if (walletNet > 0) {
    return splitFromTotal(walletNet);
  }

  return { mainCents: main, bonusCents: bonus, totalCents: ledgerTotal };
}

/** Granted amount to reverse for one dual-rewards submission (matches per-row UI breakdown). */
export function computeDualRewardsSubmissionReversalDue(params: {
  submissionRow: DualPoolSpendSubmissionRow;
  submissionId: string;
  rewardTxns: MoneyTxnRow[];
  refundTxns: MoneyTxnRow[];
  reversalRemark: string;
  wasPaidBeforeReversal: boolean;
}): DualRewardsSubmissionReversalDue {
  const {
    submissionRow,
    submissionId,
    rewardTxns,
    refundTxns,
    reversalRemark,
    wasPaidBeforeReversal,
  } = params;
  const sid = String(submissionId);

  const isReversalRefund = (tx: MoneyTxnRow) =>
    !tx.remarks || tx.remarks === reversalRemark;
  const isMainSubmissionTx = (tx: MoneyTxnRow) => {
    const m = tx.metadata ?? {};
    return (
      submissionIdFromMoneyTxnMetadata(m) === sid &&
      !m.bonus_type &&
      !m.payout_component
    );
  };
  const isBonusSubmissionTx = (tx: MoneyTxnRow) => {
    const m = tx.metadata ?? {};
    if (!m.bonus_type && !m.payout_component) return false;
    return submissionIdFromMoneyTxnMetadata(m) === sid;
  };
  const sumAmount = (rows: MoneyTxnRow[]) =>
    rows.reduce((s, tx) => s + Math.max(0, Number(tx.amount) || 0), 0);

  const mainRewardNet = Math.max(
    0,
    sumAmount(rewardTxns.filter(isMainSubmissionTx)) -
      sumAmount(
        refundTxns.filter(
          (tx) => isReversalRefund(tx) && isMainSubmissionTx(tx),
        ),
      ),
  );
  const earningsCents = Math.max(0, Number(submissionRow.earnings) || 0);
  let mainReversalAmount = wasPaidBeforeReversal
    ? Math.max(mainRewardNet, earningsCents)
    : mainRewardNet;

  const submissionWalletNet = computeSubmissionGrossWalletNetCents(
    rewardTxns,
    refundTxns,
    submissionId,
    reversalRemark,
  );

  // Verified / pending review only — no wallet credit was released; do not treat
  // row earnings or dual_rewards_payout JSON as money to reverse.
  if (!wasPaidBeforeReversal && submissionWalletNet <= 0) {
    return {
      totalCents: 0,
      mainCents: 0,
      bonusCents: 0,
      bonusReversals: [],
    };
  }

  const bonusByType = new Map<string, number>();
  for (const tx of rewardTxns.filter(isBonusSubmissionTx)) {
    const m = tx.metadata ?? {};
    const key = String(
      m.bonus_type || m.payout_component || "milestone",
    );
    bonusByType.set(key, (bonusByType.get(key) || 0) + (Number(tx.amount) || 0));
  }
  for (const tx of refundTxns.filter(
    (tx) => isReversalRefund(tx) && isBonusSubmissionTx(tx),
  )) {
    const m = tx.metadata ?? {};
    const key = String(
      m.bonus_type || m.payout_component || "milestone",
    );
    bonusByType.set(key, (bonusByType.get(key) || 0) - (Number(tx.amount) || 0));
  }
  let bonusReversals = Array.from(bonusByType.entries())
    .map(([bonusType, amount]) => ({
      bonusType,
      amount: Math.max(0, amount),
    }))
    .filter((row) => row.amount > 0);
  let bonusReversalAmount = bonusReversals.reduce(
    (sum, row) => sum + row.amount,
    0,
  );

  const storedBonusCents =
    submissionRow.bonus_paid === true
      ? Math.max(0, Number(submissionRow.bonus_amount) || 0)
      : 0;
  if (storedBonusCents > bonusReversalAmount) {
    bonusReversalAmount = storedBonusCents;
    bonusReversals = [
      { bonusType: "milestone", amount: storedBonusCents },
    ];
  }

  const paid = getDualRewardsSubmissionPaidComponents(submissionRow);
  const paidTotal = paid.cpmCents + paid.milestoneCents;

  const isSubTx = (tx: MoneyTxnRow) =>
    submissionIdFromMoneyTxnMetadata(tx.metadata) === sid;
  const grossRewardCents = sumAmount(rewardTxns.filter(isSubTx));

  // Wallet ledger net (rewards − reversal refunds) is the primary due amount.
  let dualDueCents = submissionWalletNet;

  const recordedGrantCents = getDualRewardsRecordedGrantCents(submissionRow);
  if (
    wasPaidBeforeReversal &&
    recordedGrantCents > 0 &&
    submissionWalletNet > recordedGrantCents
  ) {
    dualDueCents = recordedGrantCents;
  }

  if (dualDueCents <= 0 && wasPaidBeforeReversal) {
    dualDueCents = Math.min(
      paidTotal > 0 ? paidTotal : 0,
      grossRewardCents,
      Math.max(mainReversalAmount + bonusReversalAmount, earningsCents + storedBonusCents),
    );
  }

  if (grossRewardCents > 0) {
    dualDueCents = Math.min(dualDueCents, grossRewardCents);
  }

  let mainCents = mainReversalAmount;
  let bonusCents = bonusReversalAmount;
  let totalCents = dualDueCents;

  if (dualDueCents > 0) {
    const split = splitDualReversalRefundFromPayout(
      submissionRow.dual_rewards_payout,
      dualDueCents,
      mainReversalAmount,
      bonusReversalAmount,
    );
    mainCents = split.cpmCents;
    bonusCents = split.milestoneCents;
    totalCents = dualDueCents;
    if (bonusCents > 0) {
      const milestoneType =
        bonusReversals.find((r) => r.bonusType === "milestone")?.bonusType ??
        bonusReversals[0]?.bonusType ??
        "milestone";
      bonusReversals = [{ bonusType: milestoneType, amount: bonusCents }];
    } else {
      bonusReversals = [];
    }
  }

  return {
    totalCents,
    mainCents,
    bonusCents,
    bonusReversals,
  };
}

/** Cents recorded on the submission row (earnings/bonus + dual_rewards_payout). */
export function getDualRewardsRecordedGrantCents(
  row: DualPoolSpendSubmissionRow,
): number {
  const paid = getDualRewardsSubmissionPaidComponents(row);
  const paidTotal = paid.cpmCents + paid.milestoneCents;
  const legacyMain = Math.max(0, Math.round(Number(row.earnings) || 0));
  const legacyBonus =
    row.bonus_paid === true
      ? Math.max(0, Math.round(Number(row.bonus_amount) || 0))
      : 0;
  const legacyTotal = legacyMain + legacyBonus;
  return Math.max(paidTotal, legacyTotal);
}

function scaleOneDualReversalDue(
  due: DualRewardsSubmissionReversalDue,
  newTotalCents: number,
): DualRewardsSubmissionReversalDue {
  const newTotal = Math.max(0, Math.round(newTotalCents));
  if (newTotal <= 0) {
    return {
      totalCents: 0,
      mainCents: 0,
      bonusCents: 0,
      bonusReversals: [],
    };
  }
  if (due.totalCents <= 0) {
    return { ...due, totalCents: newTotal, mainCents: newTotal, bonusCents: 0 };
  }
  const mainCents = Math.min(
    due.mainCents,
    Math.round((due.mainCents * newTotal) / due.totalCents),
  );
  const bonusCents = Math.max(0, newTotal - mainCents);
  let bonusReversals = due.bonusReversals;
  if (bonusCents > 0) {
    const milestoneType =
      due.bonusReversals.find((r) => r.bonusType === "milestone")?.bonusType ??
      due.bonusReversals[0]?.bonusType ??
      "milestone";
    bonusReversals = [{ bonusType: milestoneType, amount: bonusCents }];
  } else {
    bonusReversals = [];
  }
  return {
    totalCents: newTotal,
    mainCents,
    bonusCents,
    bonusReversals,
  };
}

/**
 * When ledger net exceeds withdrawable balance (e.g. refunds logged without wallet debits),
 * scale per-submission dues so the bulk debit matches what can actually be recovered.
 */
export function scaleDualReversalDuesToTotalCap(
  dues: Map<string, DualRewardsSubmissionReversalDue>,
  capTotalCents: number,
): Map<string, DualRewardsSubmissionReversalDue> {
  const cap = Math.max(0, Math.round(capTotalCents));
  let sum = 0;
  for (const due of dues.values()) {
    sum += due.totalCents;
  }
  if (sum <= 0 || cap >= sum) {
    return new Map(dues);
  }

  const ids = [...dues.keys()];
  const scaled = new Map<string, DualRewardsSubmissionReversalDue>();
  const fractions: { id: string; frac: number; floor: number }[] = [];
  let floored = 0;

  for (const id of ids) {
    const due = dues.get(id)!;
    const exact = (due.totalCents * cap) / sum;
    const floor = Math.floor(exact);
    fractions.push({ id, frac: exact - floor, floor });
    floored += floor;
    scaled.set(id, scaleOneDualReversalDue(due, floor));
  }

  let remainder = cap - floored;
  fractions.sort((a, b) => b.frac - a.frac);
  for (const f of fractions) {
    if (remainder <= 0) break;
    const due = dues.get(f.id)!;
    scaled.set(f.id, scaleOneDualReversalDue(due, f.floor + 1));
    remainder--;
  }

  return scaled;
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
  const { data, error } = await fetchContestSubmissionsAllPages(
    supabaseAdmin,
    contestId,
    POOL_SPEND_SELECT,
    { order: { column: "created_at", ascending: true } },
  );

  if (error) {
    return { error: String((error as { message?: string })?.message ?? error) };
  }

  return {
    rows: (data || []).map((row) => ({
      id: String(row.id),
      earnings: row.earnings as number | null | undefined,
      paid: row.paid as boolean | null | undefined,
      bonus_amount: row.bonus_amount as number | null | undefined,
      bonus_paid: row.bonus_paid as boolean | null | undefined,
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
  options?: { commit?: boolean },
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

/** Roll back pool reservation after credit or submission persist fails. */
export async function rollbackDualRewardsPoolCommitIfNeeded(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  targetSubmissionId: string,
  poolPayment: DualPoolBudgetPaymentResult | undefined,
): Promise<{ rolledBack: boolean; error?: string }> {
  if (!poolPayment?.ok || !poolPayment.check.committed) {
    return { rolledBack: false };
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
}): Promise<DualPoolBudgetPaymentResult> {
  const commit = params.commit !== false;
  const check = await assertDualRewardsPoolBudgetAllowsPayment(
    params.supabaseAdmin,
    params.contest,
    params.contestId,
    params.targetSubmissionId,
    params.targetAfter,
    { commit },
  );
  if (check.allowed) {
    return { ok: true, check };
  }
  return { ok: false, check };
}
