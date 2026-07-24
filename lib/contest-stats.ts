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
 * Prefer status/moderation DB triggers (incremental deltas) for counters; call
 * this once after bulk views/impressions sync (metrics jobs) and from the
 * stale-stats cron. Also call after SET LOCAL app.skip_contest_stats_refresh.
 * @returns true when the RPC succeeded.
 */
export async function refreshContestStats(
  contestId?: string | null,
): Promise<boolean> {
  // Keep QStash safety-net schedule alive without Vercel Cron.
  try {
    const { ensureRefreshStaleContestStatsScheduleOnce } = await import(
      "@/lib/qstash"
    );
    ensureRefreshStaleContestStatsScheduleOnce();
  } catch {
    // optional
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("refresh_contest_stats", {
    p_contest_id: contestId ?? null,
  });

  if (error) {
    console.error(
      "[contest-stats] refresh_contest_stats failed:",
      {
        contestId: contestId ?? null,
        message: error.message,
        code: error.code,
        details: error.details,
      },
    );
    return false;
  }
  return true;
}

/**
 * Refresh stats for many contests after a metrics job finishes.
 * One full recompute per contest (not per submission row).
 */
export async function refreshContestStatsForContestIds(
  contestIds: string[],
  options?: { concurrency?: number },
): Promise<void> {
  const unique = [...new Set(contestIds.filter(Boolean))];
  if (unique.length === 0) return;

  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 5, 10));
  let index = 0;

  let failures = 0;

  async function worker() {
    while (index < unique.length) {
      const contestId = unique[index++];
      const ok = await refreshContestStats(contestId);
      if (!ok) failures += 1;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () =>
      worker(),
    ),
  );

  if (failures > 0) {
    console.error(
      `[contest-stats] refreshContestStatsForContestIds: ${failures}/${unique.length} failed`,
    );
  }
}

/**
 * Safety-net: contests whose metrics landed after the last stats recompute,
 * missing stats rows, or active campaigns with old stats.
 */
export async function findStaleContestStatsIds(
  limit = 50,
  staleMinutes = 15,
): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("find_stale_contest_stats_ids", {
    p_limit: limit,
    p_stale_minutes: staleMinutes,
  });

  if (error) {
    console.error(
      "[contest-stats] find_stale_contest_stats_ids failed:",
      error.message,
    );
    return [];
  }

  if (!Array.isArray(data)) return [];
  return data
    .map((row) =>
      typeof row === "string"
        ? row
        : (row as { contest_id?: string })?.contest_id,
    )
    .filter((id): id is string => Boolean(id));
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
