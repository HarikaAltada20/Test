import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterMoneyTxnsForContest,
  type MoneyTxnRow,
} from "@/lib/dual-rewards-pool-budget";

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

/**
 * Contest-scoped reward + refund rows for a creator (includes bulk rows whose
 * metadata only lists `contest_id` or per-submission `breakdown` entries).
 */
export async function loadContestPayoutLedgerRows(
  supabase: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<
  | {
      rewardRows: MoneyTxnRow[];
      refundRows: MoneyTxnRow[];
      contestSubmissionIds: Set<string>;
      errorMessage?: undefined;
    }
  | { errorMessage: string }
> {
  const { ids: contestSubmissionIds, errorMessage: subErr } =
    await fetchContestSubmissionIds(supabase, contestId);
  if (subErr) {
    return { errorMessage: subErr };
  }

  const [{ data: rewardRowsAll, error: rewardErr }, { data: refundRowsAll, error: refundErr }] =
    await Promise.all([
      supabase
        .from("money_transactions")
        .select("id, amount, metadata")
        .eq("user_id", creatorId)
        .eq("type", "reward"),
      supabase
        .from("money_transactions")
        .select("id, amount, remarks, metadata")
        .eq("user_id", creatorId)
        .eq("type", "refund"),
    ]);

  const errorMessage = rewardErr?.message || refundErr?.message;
  if (errorMessage) {
    return { errorMessage };
  }

  return {
    rewardRows: filterContestLedgerRows(
      rewardRowsAll as MoneyTxnRow[] | null,
      contestId,
      contestSubmissionIds,
    ),
    refundRows: filterContestLedgerRows(
      refundRowsAll as MoneyTxnRow[] | null,
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

/**
 * Ledger state for payout idempotency. Uses the same contest-matching rules as
 * dual-rewards reversal (bulk breakdown rows, contest_id, submission_id).
 */
export async function getContestPayoutLedgerState(
  supabase: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<{ state: ContestPayoutLedgerState; errorMessage: string | null }> {
  const loaded = await loadContestPayoutLedgerRows(supabase, creatorId, contestId);
  if ("errorMessage" in loaded && loaded.errorMessage) {
    return {
      state: {
        generation: 0,
        fingerprint: "empty",
        rewardCount: 0,
        refundCount: 0,
      },
      errorMessage: loaded.errorMessage,
    };
  }

  const rewardRows = loaded.rewardRows ?? [];
  const refundRows = loaded.refundRows ?? [];
  const allIds = [...rewardRows, ...refundRows].map((row) =>
    String((row as { id?: string }).id ?? ""),
  ).filter(Boolean);

  return {
    state: {
      generation: allIds.length,
      fingerprint: ledgerFingerprint(allIds),
      rewardCount: rewardRows.length,
      refundCount: refundRows.length,
    },
    errorMessage: null,
  };
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
