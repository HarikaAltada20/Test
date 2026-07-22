import { createAdminClient } from "@/utils/supabase/admin";
import type { ContestListCardStats } from "@/lib/contest-list-card-stats";

export type ContestStatsRow = {
  contest_id: string;
  not_rejected_views: number;
  verified_submission_count: number;
  pending_submission_count: number;
  rejected_submission_count: number;
};

/**
 * Recompute contest_stats for one contest (or all when omitted).
 * Prefer DB triggers; call this after bulk metric updates that bypass row triggers.
 */
export async function refreshContestStats(
  contestId?: string | null,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("refresh_contest_stats", {
    p_contest_id: contestId ?? null,
  });

  if (error) {
    console.error(
      "[contest-stats] refresh_contest_stats failed:",
      error.message,
    );
  }
}

export async function loadContestStatsByContestIds(
  contestIds: string[],
): Promise<Map<string, ContestStatsRow>> {
  const map = new Map<string, ContestStatsRow>();
  if (contestIds.length === 0) return map;

  const supabase = createAdminClient();
  const CHUNK = 200;

  for (let i = 0; i < contestIds.length; i += CHUNK) {
    const chunk = contestIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("contest_stats")
      .select(
        "contest_id, not_rejected_views, verified_submission_count, pending_submission_count, rejected_submission_count",
      )
      .in("contest_id", chunk);

    if (error) {
      console.error("[contest-stats] load failed:", error.message);
      break;
    }

    for (const row of data || []) {
      map.set(row.contest_id, {
        contest_id: row.contest_id,
        not_rejected_views: Number(row.not_rejected_views) || 0,
        verified_submission_count: Number(row.verified_submission_count) || 0,
        pending_submission_count: Number(row.pending_submission_count) || 0,
        rejected_submission_count: Number(row.rejected_submission_count) || 0,
      });
    }
  }

  return map;
}

export function contestStatsToListCardStats(
  stats: ContestStatsRow | undefined,
  lastMetricsUpdated: string | null = null,
): ContestListCardStats {
  return {
    verified_submission_count: stats?.verified_submission_count ?? 0,
    pending_submission_count: stats?.pending_submission_count ?? 0,
    rejected_submission_count: stats?.rejected_submission_count ?? 0,
    not_rejected_views: stats?.not_rejected_views ?? 0,
    last_metrics_updated: lastMetricsUpdated,
  };
}
