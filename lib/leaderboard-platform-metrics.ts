/**
 * Platform tab metrics (YouTube / Instagram / TikTok) from submissions.
 *
 * Total winnings = sum of submissions.earnings where status is paid, per platform.
 * Requires DB function from:
 *   db/migrations/20260805_creator_platform_leaderboard_metrics_rpc.sql
 * (run once in Supabase SQL Editor). Without it, a slower paginated fallback is used.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformSubmissionMetrics = {
  contestWins: Map<string, number>;
  contestParticipations: Map<string, number>;
  submissionsWon: Map<string, number>;
  submissionsMade: Map<string, number>;
  winnings: Map<string, number>;
  views: Map<string, number>;
};

const SUBMISSIONS_PAGE_SIZE = 1000;

type RpcPlatformMetricsRow = {
  creator_id: string;
  winnings: string | number;
  submissions_made: string | number;
  submissions_won: string | number;
  contests_participated: string | number;
  contests_won: string | number;
  total_views: string | number;
};

export function cachePlatformSubmissionMetrics(
  metrics: PlatformSubmissionMetrics,
): Record<string, [string, number][]> {
  return {
    contestWins: Array.from(metrics.contestWins.entries()),
    contestParticipations: Array.from(metrics.contestParticipations.entries()),
    submissionsWon: Array.from(metrics.submissionsWon.entries()),
    submissionsMade: Array.from(metrics.submissionsMade.entries()),
    winnings: Array.from(metrics.winnings.entries()),
    views: Array.from(metrics.views.entries()),
  };
}

export function loadPlatformSubmissionMetricsFromCache(
  cached: Record<string, [string, number][]>,
): PlatformSubmissionMetrics {
  return {
    contestWins: new Map(cached.contestWins),
    contestParticipations: new Map(cached.contestParticipations),
    submissionsWon: new Map(cached.submissionsWon),
    submissionsMade: new Map(cached.submissionsMade),
    winnings: new Map(cached.winnings),
    views: new Map(cached.views),
  };
}

function isMissingPlatformMetricsRpc(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("could not find the function") ||
    message.includes("function public.get_creator_platform_leaderboard_metrics") ||
    message.includes("schema cache")
  );
}

/**
 * Fallback when migration is not applied yet — paginates submission rows.
 * Disabled in production unless ALLOW_LEADERBOARD_METRICS_FALLBACK=true.
 */
async function fetchPlatformSubmissionMetricsPaginated(
  supabase: SupabaseClient,
  platformValue: string,
): Promise<PlatformSubmissionMetrics> {
  const creatorContestMap = new Map<string, Set<string>>();
  const creatorPaidContestMap = new Map<string, Set<string>>();
  const creatorSubmissionsWonMap = new Map<string, number>();
  const creatorSubmissionsMadeMap = new Map<string, number>();
  const creatorWinningsMap = new Map<string, number>();
  const creatorViewsMap = new Map<string, number>();

  const normalizedPlatform = platformValue.trim().toLowerCase();
  let offset = 0;
  let page: {
    creator_id: string | null;
    contest_id: string | null;
    status: string | null;
    earnings: number | null;
    views: number | null;
    platform?: string | null;
  }[] = [];

  do {
    // Case-insensitive match aligned with RPC lower(trim(platform)).
    const { data, error } = await supabase
      .from("submissions")
      .select("creator_id, contest_id, status, earnings, views, platform")
      .ilike("platform", normalizedPlatform)
      .order("id", { ascending: true })
      .range(offset, offset + SUBMISSIONS_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Failed to load submissions for platform=${platformValue}: ${error.message}`,
      );
    }

    page = data || [];
    // ilike can match unexpected patterns; enforce exact trimmed lowercase equality.
    const matched = page.filter(
      (sub) => (sub.platform || "").trim().toLowerCase() === normalizedPlatform,
    );
    matched.forEach((sub) => {
      const creatorId = sub.creator_id;
      const contestId = sub.contest_id;
      if (!creatorId || !contestId) return;

      if (!creatorContestMap.has(creatorId)) {
        creatorContestMap.set(creatorId, new Set());
      }
      creatorContestMap.get(creatorId)!.add(contestId);

      creatorSubmissionsMadeMap.set(
        creatorId,
        (creatorSubmissionsMadeMap.get(creatorId) || 0) + 1,
      );
      creatorViewsMap.set(
        creatorId,
        (creatorViewsMap.get(creatorId) || 0) + (Number(sub.views) || 0),
      );

      if (sub.status === "paid") {
        creatorSubmissionsWonMap.set(
          creatorId,
          (creatorSubmissionsWonMap.get(creatorId) || 0) + 1,
        );
        creatorWinningsMap.set(
          creatorId,
          (creatorWinningsMap.get(creatorId) || 0) + (Number(sub.earnings) || 0),
        );

        if (!creatorPaidContestMap.has(creatorId)) {
          creatorPaidContestMap.set(creatorId, new Set());
        }
        creatorPaidContestMap.get(creatorId)!.add(contestId);
      }
    });

    offset += SUBMISSIONS_PAGE_SIZE;
  } while (page.length === SUBMISSIONS_PAGE_SIZE);

  const contestWins = new Map<string, number>();
  creatorPaidContestMap.forEach((contestSet, creatorId) => {
    contestWins.set(creatorId, contestSet.size);
  });

  const contestParticipations = new Map<string, number>();
  creatorContestMap.forEach((contestSet, creatorId) => {
    contestParticipations.set(creatorId, contestSet.size);
  });

  return {
    contestWins,
    contestParticipations,
    submissionsWon: creatorSubmissionsWonMap,
    submissionsMade: creatorSubmissionsMadeMap,
    winnings: creatorWinningsMap,
    views: creatorViewsMap,
  };
}

function rowsToPlatformSubmissionMetrics(
  rows: RpcPlatformMetricsRow[],
): PlatformSubmissionMetrics {
  const contestWins = new Map<string, number>();
  const contestParticipations = new Map<string, number>();
  const submissionsWon = new Map<string, number>();
  const submissionsMade = new Map<string, number>();
  const winnings = new Map<string, number>();
  const views = new Map<string, number>();

  for (const row of rows) {
    const creatorId = row.creator_id;
    if (!creatorId) continue;

    winnings.set(creatorId, Number(row.winnings) || 0);
    submissionsMade.set(creatorId, Number(row.submissions_made) || 0);
    submissionsWon.set(creatorId, Number(row.submissions_won) || 0);
    contestParticipations.set(
      creatorId,
      Number(row.contests_participated) || 0,
    );
    contestWins.set(creatorId, Number(row.contests_won) || 0);
    views.set(creatorId, Number(row.total_views) || 0);
  }

  return {
    contestWins,
    contestParticipations,
    submissionsWon,
    submissionsMade,
    winnings,
    views,
  };
}

/**
 * Per-creator aggregates for a video platform tab (youtube / instagram / tiktok).
 * Single GROUP BY in Postgres — O(creators), not O(submissions).
 */
export async function fetchPlatformSubmissionMetrics(
  supabase: SupabaseClient,
  platformValue: string,
): Promise<PlatformSubmissionMetrics> {
  const { data, error } = await supabase.rpc(
    "get_creator_platform_leaderboard_metrics",
    { p_platform: platformValue },
  );

  if (error) {
    if (isMissingPlatformMetricsRpc(error)) {
      const allowFallback =
        process.env.ALLOW_LEADERBOARD_METRICS_FALLBACK === "true" ||
        process.env.NODE_ENV !== "production";

      console.error(
        `[leaderboard] get_creator_platform_leaderboard_metrics missing. Apply migration 20260805_creator_platform_leaderboard_metrics_rpc.sql. fallbackAllowed=${allowFallback}`,
      );

      if (!allowFallback) {
        throw new Error(
          "Platform leaderboard metrics RPC is not deployed. Apply migration 20260805_creator_platform_leaderboard_metrics_rpc.sql before serving platform tabs in production.",
        );
      }

      return fetchPlatformSubmissionMetricsPaginated(supabase, platformValue);
    }

    throw new Error(
      `get_creator_platform_leaderboard_metrics: ${error.message}`,
    );
  }

  return rowsToPlatformSubmissionMetrics((data ?? []) as RpcPlatformMetricsRow[]);
}
