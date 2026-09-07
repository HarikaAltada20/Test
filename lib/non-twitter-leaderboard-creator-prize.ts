import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";
import {
  isVideoContestPlatform,
  parseVideoContestPlatforms,
  resolveLeaderboardPrizeRankingPlan,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

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
  platform?: string | null;
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

/** Competition rank: equal view counts share a rank; the next rank is skipped. */
function leaderboardRankAtIndex(
  ranked: readonly LeaderboardRankableSubmission[],
  index: number,
): number {
  if (index <= 0) return 1;
  const currentViews = Math.max(0, Number(ranked[index]?.views) || 0);
  for (let i = index - 1; i >= 0; i--) {
    const previousViews = Math.max(0, Number(ranked[i]?.views) || 0);
    if (previousViews !== currentViews) return i + 2;
  }
  return 1;
}

/** Map each eligible submission id → prize cents for its contest-wide rank. */
export function buildLeaderboardPrizeCentsBySubmissionId(
  rows: readonly LeaderboardRankableSubmission[],
  prizes: LeaderboardPrize[] | null | undefined,
): Map<string, number> {
  const ranked = rankLeaderboardSubmissionsByViews(rows);
  const map = new Map<string, number>();
  ranked.forEach((row, index) => {
    map.set(
      String(row.id),
      prizeCentsForLeaderboardRank(
        prizes,
        leaderboardRankAtIndex(ranked, index),
      ),
    );
  });
  return map;
}

function videoPlatformForSubmission(
  platform?: string | null,
  contestPlatformCsv?: string | null,
): VideoContestPlatform | null {
  const fromRow = parseVideoContestPlatforms(platform)[0];
  if (fromRow) return fromRow;
  if (isVideoContestPlatform(platform)) return platform;
  return parseVideoContestPlatforms(contestPlatformCsv)[0] ?? null;
}

function mergePrizeMaps(maps: Array<Map<string, number>>): Map<string, number> {
  const merged = new Map<string, number>();
  for (const map of maps) {
    for (const [id, cents] of map) merged.set(id, cents);
  }
  return merged;
}

/**
 * Multi-platform leaderboard expected reward / pay:
 * - Same prize structure on every platform → rank in the All tab (contest-wide).
 * - Different prizes per platform → rank within each platform against that ladder.
 */
export function buildLeaderboardPrizeCentsBySubmissionIdForContest(params: {
  rows: readonly LeaderboardRankableSubmission[];
  details?: Record<string, unknown> | null;
  contestPlatform?: string | null;
  fallbackPrizes?: LeaderboardPrize[] | null;
}): Map<string, number> {
  const plan = resolveLeaderboardPrizeRankingPlan(
    params.details,
    params.contestPlatform,
  );
  const sharedPrizes =
    plan.sharedPrizes.length > 0
      ? plan.sharedPrizes
      : Array.isArray(params.fallbackPrizes)
        ? params.fallbackPrizes
        : [];

  if (plan.leaderboardPlatforms.length < 2 || plan.rankAcrossAllPlatforms) {
    const scoped =
      plan.leaderboardPlatforms.length >= 2
        ? params.rows.filter((row) => {
            const key = videoPlatformForSubmission(
              row.platform,
              params.contestPlatform,
            );
            return key != null && plan.leaderboardPlatforms.includes(key);
          })
        : params.rows;
    return buildLeaderboardPrizeCentsBySubmissionId(scoped, sharedPrizes);
  }

  return mergePrizeMaps(
    plan.leaderboardPlatforms.map((platform) => {
      const platformRows = params.rows.filter(
        (row) =>
          videoPlatformForSubmission(row.platform, params.contestPlatform) ===
          platform,
      );
      return buildLeaderboardPrizeCentsBySubmissionId(
        platformRows,
        plan.prizesByPlatform[platform] ?? [],
      );
    }),
  );
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
 * Test helper — previously cleared an in-process TTL cache. Ranking is always
 * fetched fresh now (stale cache could overpay when verifies landed mid-pay).
 */
export function clearLeaderboardPrizeCacheForTests(): void {
  // no-op (kept for test import stability)
}

/**
 * Load leaderboard prize map (verified/paid by views).
 * Always fetches fresh — money paths must not reuse rankings after concurrent
 * verify/pay changes the eligible set.
 *
 * Multi-platform: ranks All-tab when prizes match; otherwise ranks each
 * platform against that platform's prize ladder.
 */
export async function fetchNonTwitterLeaderboardPrizeMap(params: {
  supabaseAdmin: SupabaseClient;
  contestId: string;
  prizes: LeaderboardPrize[] | null | undefined;
  contestBasedDetails?: Record<string, unknown> | null;
  contestPlatform?: string | null;
  /**
   * @deprecated Ignored — ranking is always fresh to avoid overpay from stale ranks.
   */
  bypassCache?: boolean;
}): Promise<{
  prizeBySubmissionId: Map<string, number>;
  rankingRows: LeaderboardRankableSubmission[];
  error?: string;
}> {
  const prizes = Array.isArray(params.prizes) ? params.prizes : [];
  const plan = resolveLeaderboardPrizeRankingPlan(
    params.contestBasedDetails,
    params.contestPlatform,
  );
  const hasPlatformPrizes = plan.leaderboardPlatforms.some(
    (platform) => (plan.prizesByPlatform[platform] ?? []).length > 0,
  );
  if (prizes.length === 0 && plan.sharedPrizes.length === 0 && !hasPlatformPrizes) {
    return {
      prizeBySubmissionId: new Map(),
      rankingRows: [],
    };
  }

  // submission_status_enum only has verified/paid (not "approved"). Never send
  // "approved" to PostgREST — it errors: invalid input value for enum.
  const { data: rows, error, truncated } = await fetchContestSubmissionsAllPages(
    params.supabaseAdmin,
    params.contestId,
    "id, views, status, paid, platform",
    {
      statusIn: ["verified", "paid"],
      order: { column: "views", ascending: false },
    },
  );

  if (error) {
    return {
      prizeBySubmissionId: new Map(),
      rankingRows: [],
      error: String((error as { message?: string })?.message ?? error),
    };
  }

  if (truncated) {
    return {
      prizeBySubmissionId: new Map(),
      rankingRows: [],
      error:
        "Contest has too many verified/paid submissions to rank safely; contact support before paying.",
    };
  }

  const rankingRows = (rows || []) as LeaderboardRankableSubmission[];
  const prizeBySubmissionId = buildLeaderboardPrizeCentsBySubmissionIdForContest(
    {
      rows: rankingRows,
      details: params.contestBasedDetails,
      contestPlatform: params.contestPlatform,
      fallbackPrizes: prizes,
    },
  );

  return { prizeBySubmissionId, rankingRows };
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
  platform?: string | null;
  prizes: LeaderboardPrize[] | null | undefined;
  contestBasedDetails?: Record<string, unknown> | null;
  contestPlatform?: string | null;
}): Promise<{ prizeCents: number; rank: number | null; error?: string }> {
  const prizes = Array.isArray(params.prizes) ? params.prizes : [];
  const submissionId = String(params.submissionId);
  const fetched = await fetchNonTwitterLeaderboardPrizeMap({
    supabaseAdmin: params.supabaseAdmin,
    contestId: params.contestId,
    prizes,
    contestBasedDetails: params.contestBasedDetails,
    contestPlatform: params.contestPlatform,
  });
  if (fetched.error) {
    return { prizeCents: 0, rank: null, error: fetched.error };
  }

  const rankingParams = {
    details: params.contestBasedDetails,
    contestPlatform: params.contestPlatform,
    fallbackPrizes: prizes,
  };

  const cachedPrize = fetched.prizeBySubmissionId.get(submissionId);
  if (cachedPrize != null) {
    const ranked = rankLeaderboardSubmissionsForRankLookup(
      fetched.rankingRows,
      submissionId,
      params.platform,
      rankingParams,
    );
    const rankIndex = ranked.findIndex((row) => String(row.id) === submissionId);
    return {
      prizeCents: cachedPrize,
      rank:
        rankIndex >= 0 ? leaderboardRankAtIndex(ranked, rankIndex) : null,
    };
  }

  // Submission not yet in verified/paid set (e.g. mid-verify) — rank with synthetic row.
  const list = fetched.rankingRows.slice();
  list.push({
    id: submissionId,
    views: params.views ?? 0,
    status: "verified",
    paid: false,
    platform: params.platform ?? null,
  });

  const prizeBySubmissionId = buildLeaderboardPrizeCentsBySubmissionIdForContest(
    {
      rows: list,
      ...rankingParams,
    },
  );
  const ranked = rankLeaderboardSubmissionsForRankLookup(
    list,
    submissionId,
    params.platform,
    rankingParams,
  );
  const rankIndex = ranked.findIndex((row) => String(row.id) === submissionId);
  if (rankIndex < 0) {
    return { prizeCents: 0, rank: null };
  }

  return {
    prizeCents: prizeBySubmissionId.get(submissionId) ?? 0,
    rank: leaderboardRankAtIndex(ranked, rankIndex),
  };
}

function rankLeaderboardSubmissionsForRankLookup(
  rows: readonly LeaderboardRankableSubmission[],
  submissionId: string,
  submissionPlatform: string | null | undefined,
  rankingParams: {
    details?: Record<string, unknown> | null;
    contestPlatform?: string | null;
  },
): LeaderboardRankableSubmission[] {
  const plan = resolveLeaderboardPrizeRankingPlan(
    rankingParams.details,
    rankingParams.contestPlatform,
  );
  if (plan.leaderboardPlatforms.length < 2 || plan.rankAcrossAllPlatforms) {
    const scoped =
      plan.leaderboardPlatforms.length >= 2
        ? rows.filter((row) => {
            const key = videoPlatformForSubmission(
              row.platform,
              rankingParams.contestPlatform,
            );
            return key != null && plan.leaderboardPlatforms.includes(key);
          })
        : rows;
    return rankLeaderboardSubmissionsByViews(scoped);
  }

  const targetPlatform =
    videoPlatformForSubmission(
      rows.find((row) => String(row.id) === submissionId)?.platform ??
        submissionPlatform,
      rankingParams.contestPlatform,
    ) ?? plan.leaderboardPlatforms[0];
  return rankLeaderboardSubmissionsByViews(
    rows.filter(
      (row) =>
        videoPlatformForSubmission(
          row.platform,
          rankingParams.contestPlatform,
        ) === targetPlatform,
    ),
  );
}
