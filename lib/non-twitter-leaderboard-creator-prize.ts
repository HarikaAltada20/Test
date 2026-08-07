import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";

export type LeaderboardPrize = { position?: number; amount?: number };

export type LeaderboardEligibleSubmissionRow = {
  creator_id?: string | null;
  views?: number | null;
  status?: string | null;
  paid?: boolean | null;
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

/**
 * Creator-level prize for non-Twitter leaderboard contests.
 * Matches creator-wise UI: rank eligible creators by total views, then map to prize.
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

  const { data: rows, error } = await fetchContestSubmissionsAllPages(
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
