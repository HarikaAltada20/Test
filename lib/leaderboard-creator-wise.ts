import type { SupabaseClient } from "@supabase/supabase-js";

export type CreatorAggRow = {
  creator_id: string;
  total_views: number;
  total_earnings: number;
  submission_count: number;
  submission_ranks: number[];
  /** Minimum global submission rank among this creator's eligible submissions (tiebreak vs other creators). */
  best_rank: number;
  has_paid_submission: boolean;
  platform: string | null;
};

type RpcCreatorRow = {
  creator_id: string;
  total_views: string | number;
  total_earnings: string | number;
  submission_count: number;
  submission_ranks: number[] | null;
  best_submission_rank: number;
  has_paid_submission: boolean;
  platform: string | null;
};

/**
 * Per-creator aggregates for the whole contest, sorted like the public creator-wise leaderboard.
 * Implemented as a single DB function (window + GROUP BY) — O(rows) in Postgres, not N HTTP round-trips.
 */
export async function getSortedCreatorAggregates(
  supabase: SupabaseClient,
  contestId: string,
): Promise<CreatorAggRow[]> {
  const { data, error } = await supabase.rpc("contest_sorted_creator_aggregates", {
    p_contest_id: contestId,
  });

  if (error) {
    throw new Error(
      `contest_sorted_creator_aggregates: ${error.message}. Apply migration 20260329_contest_leaderboard_snapshot_functions.sql if missing.`,
    );
  }

  const rows = (data ?? []) as RpcCreatorRow[];
  return rows.map((row) => ({
    creator_id: row.creator_id,
    total_views: Number(row.total_views),
    total_earnings: Number(row.total_earnings),
    submission_count: row.submission_count,
    submission_ranks: row.submission_ranks ?? [],
    best_rank: row.best_submission_rank,
    has_paid_submission: row.has_paid_submission,
    platform: row.platform ?? null,
  }));
}
