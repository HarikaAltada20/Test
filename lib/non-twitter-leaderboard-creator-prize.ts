import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildContestPayoutIdempotencyPayload,
  type ContestPayoutLedgerState,
} from "@/lib/contest-payout-idempotency";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";

export type LeaderboardPrize = { position?: number; amount?: number };

/** Shared wallet idempotency prefix for verify-submission + bulk-payment. */
export const LEADERBOARD_CREATOR_PRIZE_IDEMPOTENCY_PREFIX =
  "leaderboard_creator_prize:v1:";

/**
 * Twitter text/image leaderboard contests pay via pay-twitter-creator, not this
 * submissions-table creator-prize path.
 */
export function isTwitterTextImageLeaderboardContest(contest: {
  contest_type?: string | null;
  platform?: string | null;
  contest_format?: string | null;
}): boolean {
  if (contest.contest_type !== "leaderboard") return false;
  const platform = String(contest.platform || "").toLowerCase();
  return (
    (platform === "twitter" || platform === "x") &&
    contest.contest_format === "text_image"
  );
}

export type LeaderboardEligibleSubmissionRow = {
  creator_id?: string | null;
  views?: number | null;
  status?: string | null;
  paid?: boolean | null;
  earnings?: number | null;
};

/** Statuses that count toward non-Twitter leaderboard ranking (matches payout server). */
export function isLeaderboardRankingEligibleStatus(
  status: string | null | undefined,
  paid?: boolean | null,
): boolean {
  const st = String(status || "").toLowerCase();
  if (st === "verified" || st === "approved" || st === "paid") return true;
  if (paid === true) return true;
  return false;
}

/**
 * Sum views by creator for ranking-eligible rows only (verified / approved / paid).
 * Uses the submissions.views column — same source as bulk payout.
 */
export function accumulateLeaderboardViewsByCreator(
  rows: readonly LeaderboardEligibleSubmissionRow[],
): Map<string, number> {
  const viewsByCreator = new Map<string, number>();
  for (const row of rows) {
    if (!isLeaderboardRankingEligibleStatus(row.status, row.paid)) continue;
    const creatorId = String(row.creator_id || "");
    if (!creatorId) continue;
    const views = Math.max(0, Number(row.views) || 0);
    viewsByCreator.set(creatorId, (viewsByCreator.get(creatorId) || 0) + views);
  }
  return viewsByCreator;
}

/** Sort creators by total views desc, then id asc for stable ties. */
export function rankCreatorsByTotalViews(
  viewsByCreator: Map<string, number>,
): Array<[string, number]> {
  return Array.from(viewsByCreator.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
}

export function rankOfCreator(
  viewsByCreator: Map<string, number>,
  creatorId: string,
): number | null {
  if (!viewsByCreator.has(creatorId)) return null;
  const ranked = rankCreatorsByTotalViews(viewsByCreator);
  const rank = ranked.findIndex(([id]) => id === creatorId) + 1;
  return rank > 0 ? rank : null;
}

export function prizeCentsForLeaderboardRank(
  prizes: LeaderboardPrize[] | null | undefined,
  rank: number | null,
): number {
  if (rank == null || rank <= 0) return 0;
  const list = Array.isArray(prizes) ? prizes : [];
  const prizeForRank = list.find((p) => Number(p.position) === rank);
  return Math.max(0, Math.round(Number(prizeForRank?.amount) || 0));
}

export function sumPaidEarningsCents(
  rows: readonly { earnings?: number | null; paid?: boolean | null }[],
): number {
  return rows.reduce((sum, row) => {
    if (row.paid !== true) return sum;
    return sum + Math.max(0, Number(row.earnings) || 0);
  }, 0);
}

/**
 * Idempotency fields for creator-level leaderboard prizes.
 * Intentionally omits submission IDs, payment_type (standard vs both), and
 * payout-adjustment fields so verify-submission and bulk-payment (and concurrent
 * standard/both) share one wallet credit key for the current ledger generation.
 */
export function buildLeaderboardCreatorPrizeIdempotencyFields(params: {
  contestId: string;
  creatorId: string;
}): Record<string, unknown> {
  return {
    contest_id: params.contestId,
    creator_id: params.creatorId,
    leaderboard_creator_prize: true,
  };
}

/**
 * Canonical wallet idempotency key for the creator prize (not bonus).
 * Must be identical in verify-submission and bulk-payment.
 */
export function buildLeaderboardCreatorPrizeIdempotencyKey(params: {
  contestId: string;
  creatorId: string;
  ledger: ContestPayoutLedgerState;
}): string {
  const seed = JSON.stringify(
    buildContestPayoutIdempotencyPayload(
      buildLeaderboardCreatorPrizeIdempotencyFields({
        contestId: params.contestId,
        creatorId: params.creatorId,
      }),
      params.ledger,
    ),
  );
  return `${LEADERBOARD_CREATOR_PRIZE_IDEMPOTENCY_PREFIX}${createHash("sha256")
    .update(seed)
    .digest("hex")
    .slice(0, 40)}`;
}

export async function fetchCreatorLeaderboardPaidEarningsCents(params: {
  supabaseAdmin: SupabaseClient;
  contestId: string;
  creatorId: string;
}): Promise<{ paidCents: number; error?: string }> {
  const { data, error } = await fetchContestSubmissionsAllPages(
    params.supabaseAdmin,
    params.contestId,
    "earnings, paid",
    {
      creatorId: params.creatorId,
      paid: true,
      order: { column: "created_at", ascending: true },
    },
  );
  if (error) {
    return {
      paidCents: 0,
      error: String((error as { message?: string })?.message ?? error),
    };
  }
  return {
    paidCents: sumPaidEarningsCents(
      (data || []) as Array<{ earnings?: number | null; paid?: boolean | null }>,
    ),
  };
}

export type ApplyLeaderboardCreatorPayoutResult = {
  ok: boolean;
  alreadyPaidCents: number;
  remainingCents: number;
  appliedEarningsCents: number;
  markedPaidCount: number;
  error?: string;
  usedRpc?: boolean;
};

function parseApplyRpcResult(raw: unknown): ApplyLeaderboardCreatorPayoutResult | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const obj = row as Record<string, unknown>;
  if (obj.ok === false) return null;
  return {
    ok: true,
    alreadyPaidCents: Math.max(0, Number(obj.already_paid_cents) || 0),
    remainingCents: Math.max(0, Number(obj.remaining_cents) || 0),
    appliedEarningsCents: Math.max(0, Number(obj.applied_earnings_cents) || 0),
    markedPaidCount: Math.max(0, Number(obj.marked_paid_count) || 0),
    usedRpc: true,
  };
}

function isRpcMissingError(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  return (
    /function.*does not exist|could not find/i.test(error.message || "") ||
    error.code === "42883"
  );
}

/** True when paid earnings already cover the creator prize (safe to mark-paid-only). */
export function isLeaderboardCreatorPrizeFullyPaid(
  alreadyPaidCents: number,
  prizeCents: number,
): boolean {
  const prize = Math.max(0, Math.round(prizeCents) || 0);
  if (prize <= 0) return false;
  return Math.max(0, Math.round(alreadyPaidCents) || 0) >= prize;
}

/**
 * How much of a fresh wallet credit to roll back after the payout RPC.
 *
 * Verify + bulk share one idempotency key, so only one request actually credits.
 * The other may still win the RPC and write prize earnings (`applied=0`,
 * `remaining=0` on the creditor). Rolling back in that case leaves the creator
 * marked paid with earnings but $0 wallet — keep the credit instead.
 *
 * Roll back the unapplied portion only when the prize is still owed, or when
 * this request applied a partial amount below what it credited.
 */
export function leaderboardPrizeWalletExcessToRollback(params: {
  freshCreditedCents: number;
  appliedEarningsCents: number;
  remainingCents: number;
}): number {
  const fresh = Math.max(0, Math.round(params.freshCreditedCents) || 0);
  const applied = Math.max(0, Math.round(params.appliedEarningsCents) || 0);
  const remaining = Math.max(0, Math.round(params.remainingCents) || 0);
  if (fresh <= 0 || applied >= fresh) return 0;
  // Concurrent request landed earnings under the shared credit — keep funding.
  if (remaining === 0 && applied === 0) return 0;
  return fresh - applied;
}

/**
 * Persist creator prize earnings (at most once) and mark verified/approved
 * siblings paid with earnings=0 — but only when remaining prize is 0.
 * Requires the transactional RPC (advisory lock). No non-atomic fallback —
 * concurrent pays could otherwise write prize earnings onto multiple rows.
 */
export async function applyNonTwitterLeaderboardCreatorPayout(params: {
  supabaseAdmin: SupabaseClient;
  contestId: string;
  creatorId: string;
  prizeCents: number;
  /** Submission that should receive prize earnings when remaining > 0. */
  earningsSubmissionId?: string | null;
  earningsCents?: number;
}): Promise<ApplyLeaderboardCreatorPayoutResult> {
  const prizeCents = Math.max(0, Math.round(params.prizeCents));
  const earningsCents = Math.max(0, Math.round(params.earningsCents || 0));
  const earningsSubmissionId = params.earningsSubmissionId
    ? String(params.earningsSubmissionId)
    : null;

  const { data: rpcData, error: rpcError } = await params.supabaseAdmin.rpc(
    "apply_non_twitter_leaderboard_creator_payout",
    {
      p_contest_id: params.contestId,
      p_creator_id: params.creatorId,
      p_prize_cents: prizeCents,
      p_earnings_submission_id: earningsSubmissionId,
      p_earnings_cents: earningsCents,
    },
  );

  if (!rpcError) {
    const parsed = parseApplyRpcResult(rpcData);
    if (parsed) return parsed;
    return {
      ok: false,
      alreadyPaidCents: 0,
      remainingCents: 0,
      appliedEarningsCents: 0,
      markedPaidCount: 0,
      error: "Leaderboard payout RPC returned an unexpected result",
    };
  }

  return {
    ok: false,
    alreadyPaidCents: 0,
    remainingCents: 0,
    appliedEarningsCents: 0,
    markedPaidCount: 0,
    error: isRpcMissingError(rpcError)
      ? "Leaderboard payout RPC is not deployed. Apply migration 20260807120000_leaderboard_creator_payout_apply.sql before paying."
      : rpcError.message || "Failed to apply leaderboard creator payout",
  };
}

/**
 * Creator-level prize for non-Twitter leaderboard contests.
 * Ranks verified/paid creators by total views (same eligibility as payout), then maps to prize.
 */
export async function computeNonTwitterLeaderboardCreatorPrizeCents(params: {
  supabaseAdmin: SupabaseClient;
  contestId: string;
  creatorId: string;
  prizes: LeaderboardPrize[] | null | undefined;
}): Promise<{ prizeCents: number; rank: number | null; error?: string }> {
  const prizes = Array.isArray(params.prizes) ? params.prizes : [];
  if (prizes.length === 0) {
    return { prizeCents: 0, rank: null };
  }

  const { data: rows, error, truncated } = await fetchContestSubmissionsAllPages(
    params.supabaseAdmin,
    params.contestId,
    "creator_id, views, status, paid",
    {
      statusIn: ["verified", "approved", "paid"],
      order: { column: "created_at", ascending: true },
    },
  );

  if (error) {
    return {
      prizeCents: 0,
      rank: null,
      error: String((error as { message?: string })?.message ?? error),
    };
  }

  if (truncated) {
    return {
      prizeCents: 0,
      rank: null,
      error:
        "Contest has too many verified/paid submissions to rank safely; contact support before paying.",
    };
  }

  const viewsByCreator = accumulateLeaderboardViewsByCreator(
    (rows || []) as LeaderboardEligibleSubmissionRow[],
  );

  const rank = rankOfCreator(viewsByCreator, params.creatorId);
  if (rank == null) {
    return { prizeCents: 0, rank: null };
  }

  return {
    prizeCents: prizeCentsForLeaderboardRank(prizes, rank),
    rank,
  };
}
