import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterMoneyTxnsForContest,
  type MoneyTxnRow,
} from "@/lib/dual-rewards-pool-budget";
import { REVERSAL_TRANSACTION_REMARK } from "@/lib/payment-utils";

type MoneyTxnWithId = MoneyTxnRow & { id?: string };

const SUBMISSION_ID_CHUNK_SIZE = 80;

async function fetchContestSubmissionIds(
  supabase: SupabaseClient,
  contestId: string,
): Promise<{ ids: Set<string>; errorMessage: string | null }> {
  const { data, error } = await supabase
    .from("submissions")
    .select("id")
    .eq("contest_id", contestId);

  if (error) {
    return { ids: new Set(), errorMessage: error.message };
  }

  return {
    ids: new Set((data || []).map((row) => String(row.id))),
    errorMessage: null,
  };
}

function chunkIds(ids: string[], size: number): string[][] {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

function dedupeMoneyTxnsById(rows: MoneyTxnWithId[]): MoneyTxnWithId[] {
  const byId = new Map<string, MoneyTxnWithId>();
  for (const row of rows) {
    const id = String(row.id ?? "");
    if (id) byId.set(id, row);
  }
  return [...byId.values()];
}

function filterContestLedgerRows(
  rows: MoneyTxnRow[] | null | undefined,
  contestId: string,
  contestSubmissionIds: ReadonlySet<string>,
): MoneyTxnRow[] {
  return filterMoneyTxnsForContest(rows, contestId, contestSubmissionIds);
}

function ledgerFingerprint(txnIds: string[]): string {
  if (txnIds.length === 0) return "empty";
  return createHash("sha256")
    .update(txnIds.map(String).sort().join(","))
    .digest("hex")
    .slice(0, 32);
}

async function fetchCreatorMoneyTxnsScopedToContest(params: {
  supabase: SupabaseClient;
  creatorId: string;
  contestId: string;
  type: "reward" | "refund";
  submissionIds: string[];
  select: string;
}): Promise<{ rows: MoneyTxnWithId[]; errorMessage: string | null }> {
  const { supabase, creatorId, contestId, type, submissionIds, select } =
    params;

  const queries: PromiseLike<{
    data: MoneyTxnWithId[] | null;
    error: { message: string } | null;
  }>[] = [
    supabase
      .from("money_transactions")
      .select(select)
      .eq("user_id", creatorId)
      .eq("type", type)
      .contains("metadata", { contest_id: contestId }),
  ];

  for (const chunk of chunkIds(submissionIds, SUBMISSION_ID_CHUNK_SIZE)) {
    queries.push(
      supabase
        .from("money_transactions")
        .select(select)
        .eq("user_id", creatorId)
        .eq("type", type)
        .in("metadata->>submission_id", chunk),
    );
    queries.push(
      supabase
        .from("money_transactions")
        .select(select)
        .eq("user_id", creatorId)
        .eq("type", type)
        .in("metadata->>source_submission_id", chunk),
    );
  }

  const results = await Promise.all(queries);
  const merged: MoneyTxnWithId[] = [];
  for (const result of results) {
    if (result.error) {
      return { rows: [], errorMessage: result.error.message };
    }
    merged.push(...((result.data || []) as MoneyTxnWithId[]));
  }

  return { rows: dedupeMoneyTxnsById(merged), errorMessage: null };
}

export type ContestPayoutLedgerLoaded = {
  rewardRows: MoneyTxnRow[];
  refundRows: MoneyTxnRow[];
  contestSubmissionIds: Set<string>;
};

/**
 * Contest-scoped reward + refund rows for a creator (includes bulk rows whose
 * metadata only lists `contest_id` or per-submission `breakdown` entries).
 */
export async function loadContestPayoutLedgerRows(
  supabase: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<ContestPayoutLedgerLoaded | { errorMessage: string }> {
  const { ids: contestSubmissionIds, errorMessage: subErr } =
    await fetchContestSubmissionIds(supabase, contestId);
  if (subErr) {
    return { errorMessage: subErr };
  }

  const submissionIdList = [...contestSubmissionIds];

  const [rewardFetch, refundFetch] = await Promise.all([
    fetchCreatorMoneyTxnsScopedToContest({
      supabase,
      creatorId,
      contestId,
      type: "reward",
      submissionIds: submissionIdList,
      select: "id, amount, metadata",
    }),
    fetchCreatorMoneyTxnsScopedToContest({
      supabase,
      creatorId,
      contestId,
      type: "refund",
      submissionIds: submissionIdList,
      select: "id, amount, remarks, metadata",
    }),
  ]);

  const errorMessage = rewardFetch.errorMessage || refundFetch.errorMessage;
  if (errorMessage) {
    return { errorMessage };
  }

  return {
    rewardRows: filterContestLedgerRows(
      rewardFetch.rows,
      contestId,
      contestSubmissionIds,
    ),
    refundRows: filterContestLedgerRows(
      refundFetch.rows,
      contestId,
      contestSubmissionIds,
    ),
    contestSubmissionIds,
  };
}

export type ContestPayoutLedgerState = {
  generation: number;
  fingerprint: string;
  rewardCount: number;
  refundCount: number;
};

export function contestPayoutLedgerStateFromLoaded(
  loaded: ContestPayoutLedgerLoaded,
): ContestPayoutLedgerState {
  const allIds = [...loaded.rewardRows, ...loaded.refundRows]
    .map((row) => String((row as MoneyTxnWithId).id ?? ""))
    .filter(Boolean);

  return {
    generation: allIds.length,
    fingerprint: ledgerFingerprint(allIds),
    rewardCount: loaded.rewardRows.length,
    refundCount: loaded.refundRows.length,
  };
}

/** Single fetch: ledger rows, idempotency state, and contest wallet net. */
export async function loadContestPayoutLedgerBundle(
  supabase: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<
  | {
      loaded: ContestPayoutLedgerLoaded;
      state: ContestPayoutLedgerState;
      walletNetCents: number;
    }
  | { errorMessage: string }
> {
  const loaded = await loadContestPayoutLedgerRows(
    supabase,
    creatorId,
    contestId,
  );
  if ("errorMessage" in loaded) {
    return loaded;
  }

  return {
    loaded,
    state: contestPayoutLedgerStateFromLoaded(loaded),
    walletNetCents: contestLedgerNetFromLoaded(loaded),
  };
}

/** Immutable idempotency payload shared by bulk / dual-rewards payout routes. */
export function buildContestPayoutIdempotencyPayload(
  base: Record<string, unknown>,
  ledger: ContestPayoutLedgerState,
): Record<string, unknown> {
  return {
    ...base,
    // Each completed pay→refund cycle bumps both counts. A new pay after refund
    // always sees a fresh (rewardCount, refundCount) pair — supports unlimited cycles.
    contest_ledger_reward_count: ledger.rewardCount,
    contest_ledger_refund_count: ledger.refundCount,
    contest_payout_ledger_fingerprint: ledger.fingerprint,
  };
}

export type PayoutCreditAttemptResult = {
  success: boolean;
  alreadyApplied?: boolean;
  error?: string;
  transactionId?: string;
};

/**
 * Credit creator wallet, retrying with fresh idempotency keys when a prior key was
 * consumed but wallet net still shows an unpaid shortfall (pay→refund→pay loops).
 */
export async function creditWithWalletShortfallRetry(params: {
  payableCents: number;
  walletNetBeforePay: number;
  baseIdempotencyKey: string;
  ledger: ContestPayoutLedgerState;
  credit: (idempotencyKey: string) => Promise<PayoutCreditAttemptResult>;
  maxShortfallAttempts?: number;
}): Promise<PayoutCreditAttemptResult> {
  const payableCents = Math.max(0, Math.round(params.payableCents));
  if (payableCents <= 0) {
    return { success: true, alreadyApplied: false };
  }

  let effectiveWalletNet = Math.max(0, Math.round(params.walletNetBeforePay));
  const maxAttempts = Math.max(1, params.maxShortfallAttempts ?? 5);

  let result = await params.credit(params.baseIdempotencyKey);
  if (!result.success) {
    return result;
  }
  if (!result.alreadyApplied) {
    effectiveWalletNet = payableCents;
  }

  let attempt = 0;
  while (
    result.success &&
    result.alreadyApplied &&
    payableCents > effectiveWalletNet &&
    attempt < maxAttempts
  ) {
    attempt += 1;
    const shortfallCents = payableCents - effectiveWalletNet;
    const bumpedKey = `${params.baseIdempotencyKey}:ledger_r${params.ledger.rewardCount}_f${params.ledger.refundCount}:shortfall_${shortfallCents}:n${attempt}`;
    result = await params.credit(bumpedKey);
    if (!result.success) {
      return result;
    }
    if (!result.alreadyApplied) {
      effectiveWalletNet = payableCents;
    }
  }

  return result;
}

/** Gross contest wallet net from ledger rows (rewards − reversal refunds). */
export function sumContestLedgerNetCents(
  rewardRows: MoneyTxnRow[],
  refundRows: MoneyTxnRow[],
): number {
  const grossRewards = rewardRows.reduce(
    (sum, tx) => sum + Math.max(0, Number(tx.amount) || 0),
    0,
  );
  const grossRefunds = refundRows
    .filter((tx) => !tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK)
    .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount) || 0), 0);
  return Math.max(0, grossRewards - grossRefunds);
}

export function contestLedgerNetFromLoaded(
  loaded: ContestPayoutLedgerLoaded | { errorMessage: string },
): number {
  if ("errorMessage" in loaded) {
    return 0;
  }
  return sumContestLedgerNetCents(
    loaded.rewardRows ?? [],
    loaded.refundRows ?? [],
  );
}

/**
 * Ledger state for payout idempotency. Uses the same contest-matching rules as
 * dual-rewards reversal (bulk breakdown rows, contest_id, submission_id).
 */
export async function getContestPayoutLedgerState(
  supabase: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<{ state: ContestPayoutLedgerState; errorMessage: string | null }> {
  const bundle = await loadContestPayoutLedgerBundle(
    supabase,
    creatorId,
    contestId,
  );
  if ("errorMessage" in bundle) {
    return {
      state: {
        generation: 0,
        fingerprint: "empty",
        rewardCount: 0,
        refundCount: 0,
      },
      errorMessage: bundle.errorMessage,
    };
  }

  return { state: bundle.state, errorMessage: null };
}

/**
 * Count refund rows logged for this creator + contest (metadata.contest_id).
 * Increments when reversing paid submissions, so bulk/Twitter bulk idempotency keys
 * change after refunds and legitimate re-payouts are not suppressed. Count all
 * refund reasons because any refund can reopen payout headroom.
 *
 * Same count on immediate retry (no refunds in between) → same idempotency → safe dedupe.
 */
export async function countRefundsForCreatorContest(
  supabase: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<{ count: number; errorMessage: string | null }> {
  const { state, errorMessage } = await getContestPayoutLedgerState(
    supabase,
    creatorId,
    contestId,
  );
  return { count: state.refundCount, errorMessage };
}

/** Reward rows for this creator + contest (includes bulk dual-rewards rewards). */
export async function countRewardsForCreatorContest(
  supabase: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<{ count: number; errorMessage: string | null }> {
  const { state, errorMessage } = await getContestPayoutLedgerState(
    supabase,
    creatorId,
    contestId,
  );
  return { count: state.rewardCount, errorMessage };
}

/**
 * Monotonic ledger generation for payout idempotency: advances on every reward or
 * refund so pay → refund → re-pay and rollback retries get distinct keys.
 */
export async function getContestPayoutLedgerGeneration(
  supabase: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<{ generation: number; errorMessage: string | null }> {
  const { state, errorMessage } = await getContestPayoutLedgerState(
    supabase,
    creatorId,
    contestId,
  );
  return { generation: state.generation, errorMessage };
}
