import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";

export type LeaderboardPrize = { position?: number; amount?: number };

/**
 * Twitter text/image leaderboard contests pay via pay-twitter-creator, not this
 * submissions-table ranking path.
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

export type LeaderboardRankableSubmission = {
  id: string;
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
  if (st === "verified" || st === "approved" || st === "paid") return true;
  if (paid === true) return true;
  return false;
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
 * Rank eligible submissions by views desc, then submission id asc (stable ties).
 */
export function rankLeaderboardSubmissionsByViews(
  rows: readonly LeaderboardRankableSubmission[],
): LeaderboardRankableSubmission[] {
  return rows
    .filter((row) => isLeaderboardRankingEligibleStatus(row.status, row.paid))
    .slice()
    .sort((a, b) => {
      const viewsA = Math.max(0, Number(a.views) || 0);
      const viewsB = Math.max(0, Number(b.views) || 0);
      return viewsB - viewsA || String(a.id).localeCompare(String(b.id));
    });
}

/** Map each eligible submission id → prize cents for its contest-wide rank. */
export function buildLeaderboardPrizeCentsBySubmissionId(
  rows: readonly LeaderboardRankableSubmission[],
  prizes: LeaderboardPrize[] | null | undefined,
): Map<string, number> {
  const ranked = rankLeaderboardSubmissionsByViews(rows);
  const map = new Map<string, number>();
  ranked.forEach((row, index) => {
    map.set(String(row.id), prizeCentsForLeaderboardRank(prizes, index + 1));
  });
  return map;
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
 * Clamp a prize/reward to the remaining creator max-earnings budget.
 * Matches creator-wise Expected Reward capping (UI) so pay cannot exceed what admins see.
 */
export function applyCreatorMaxEarningsCapCents(params: {
  amountCents: number;
  alreadyPaidCents: number;
  maxEarningsCents: number | null | undefined;
}): number {
  const amount = Math.max(0, Math.round(Number(params.amountCents) || 0));
  const max = Number(params.maxEarningsCents);
  if (!Number.isFinite(max) || max <= 0) return amount;
  const already = Math.max(0, Math.round(Number(params.alreadyPaidCents) || 0));
  const remaining = Math.max(0, Math.round(max) - already);
  return Math.min(amount, remaining);
}

/**
 * Per-submission prize for non-Twitter leaderboard contests.
 * Ranks verified/approved/paid submissions by views (id asc tie-break), then maps to prize.
 *
 * Money rule (matches historical verify-submission / payout-processor pay math):
 * prizes are per submission (contest-wide views rank), not one prize per creator.
 * A creator with two ranked submissions can receive two prizes
 * (still subject to max_earnings_per_creator when callers apply the cap).
 *
 * Creator-wise Expected Reward in the UI must sum these submission prizes so it
 * does not drift from what bulk-payment / verify-submission actually credit.
 */
export async function computeNonTwitterLeaderboardSubmissionPrizeCents(params: {
  supabaseAdmin: SupabaseClient;
  contestId: string;
  submissionId: string;
  views?: number | null;
  prizes: LeaderboardPrize[] | null | undefined;
}): Promise<{ prizeCents: number; rank: number | null; error?: string }> {
  const prizes = Array.isArray(params.prizes) ? params.prizes : [];
  if (prizes.length === 0) {
    return { prizeCents: 0, rank: null };
  }

  const submissionId = String(params.submissionId);
  // submission_status_enum only has verified/paid (not "approved"). Never send
  // "approved" to PostgREST — it errors: invalid input value for enum.
  const { data: rows, error, truncated } = await fetchContestSubmissionsAllPages(
    params.supabaseAdmin,
    params.contestId,
    "id, views, status, paid",
    {
      statusIn: ["verified", "paid"],
      order: { column: "views", ascending: false },
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

  const list = ((rows || []) as LeaderboardRankableSubmission[]).slice();
  if (!list.some((row) => String(row.id) === submissionId)) {
    list.push({
      id: submissionId,
      views: params.views ?? 0,
      status: "verified",
      paid: false,
    });
  }

  const ranked = rankLeaderboardSubmissionsByViews(list);
  const rankIndex = ranked.findIndex((row) => String(row.id) === submissionId);
  if (rankIndex < 0) {
    return { prizeCents: 0, rank: null };
  }

  const rank = rankIndex + 1;
  return {
    prizeCents: prizeCentsForLeaderboardRank(prizes, rank),
    rank,
  };
}
