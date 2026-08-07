import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";

export type LeaderboardPrize = { position?: number; amount?: number };

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
  if (st === "verified" || st === "paid") return true;
  if (paid === true) return true;
  return false;
}

/**
 * Sum views by creator for ranking-eligible rows only (verified / paid).
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
 * Intentionally omits submission IDs so concurrent pays for the same creator
 * share one wallet credit key for the current ledger generation.
 */
export function buildLeaderboardCreatorPrizeIdempotencyFields(params: {
  contestId: string;
  creatorId: string;
  paymentType: string;
}): Record<string, unknown> {
  return {
    contest_id: params.contestId,
    creator_id: params.creatorId,
    payment_type: params.paymentType,
    leaderboard_creator_prize: true,
  };
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

/**
 * Persist creator prize earnings (at most once) and mark verified siblings paid.
 * Prefers the transactional RPC; falls back to re-check + updates if undeployed.
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
  }

  const rpcMissing =
    rpcError &&
    (/function.*does not exist|could not find/i.test(rpcError.message || "") ||
      (rpcError as { code?: string }).code === "42883");

  if (rpcError && !rpcMissing) {
    return {
      ok: false,
      alreadyPaidCents: 0,
      remainingCents: 0,
      appliedEarningsCents: 0,
      markedPaidCount: 0,
      error: rpcError.message || "Failed to apply leaderboard creator payout",
    };
  }

  // Fallback when migration is not deployed yet: re-read then update.
  const paidBefore = await fetchCreatorLeaderboardPaidEarningsCents({
    supabaseAdmin: params.supabaseAdmin,
    contestId: params.contestId,
    creatorId: params.creatorId,
  });
  if (paidBefore.error) {
    return {
      ok: false,
      alreadyPaidCents: 0,
      remainingCents: 0,
      appliedEarningsCents: 0,
      markedPaidCount: 0,
      error: paidBefore.error,
    };
  }

  let alreadyPaidCents = paidBefore.paidCents;
  let remainingCents = Math.max(0, prizeCents - alreadyPaidCents);
  let appliedEarningsCents = 0;

  if (earningsSubmissionId && earningsCents > 0 && remainingCents > 0) {
    const applyCents = Math.min(remainingCents, earningsCents);
    const { data: updated, error: earnErr } = await params.supabaseAdmin
      .from("submissions")
      .update({
        earnings: applyCents,
        paid: true,
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", earningsSubmissionId)
      .eq("contest_id", params.contestId)
      .eq("creator_id", params.creatorId)
      .neq("paid", true)
      .select("id")
      .maybeSingle();

    if (earnErr) {
      return {
        ok: false,
        alreadyPaidCents,
        remainingCents,
        appliedEarningsCents: 0,
        markedPaidCount: 0,
        error: earnErr.message,
      };
    }
    if (updated) {
      appliedEarningsCents = applyCents;
      alreadyPaidCents += applyCents;
      remainingCents = Math.max(0, prizeCents - alreadyPaidCents);
    }
  }

  const { data: markedRows, error: siblingErr } = await params.supabaseAdmin
    .from("submissions")
    .update({
      paid: true,
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("contest_id", params.contestId)
    .eq("creator_id", params.creatorId)
    .eq("status", "verified")
    .neq("paid", true)
    .select("id");

  if (siblingErr) {
    return {
      ok: false,
      alreadyPaidCents,
      remainingCents,
      appliedEarningsCents,
      markedPaidCount: 0,
      error: siblingErr.message,
    };
  }

  return {
    ok: true,
    alreadyPaidCents,
    remainingCents,
    appliedEarningsCents,
    markedPaidCount: (markedRows || []).length,
    usedRpc: false,
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
      statusIn: ["verified", "paid"],
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
