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
  pending_submission_count?: number;
};

export type PaginatedCreatorAggResult = {
  rows: CreatorAggRow[];
  totalEntries: number;
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
  pending_submission_count?: number | null;
  total_creator_count?: string | number | null;
};

/**
 * Per-creator aggregates for the whole contest — paginated in SQL.
 * Only the requested page of creators is returned; ranking/sorting happens in Postgres.
 */
export async function getSortedCreatorAggregates(
  supabase: SupabaseClient,
  contestId: string,
  page: number = 1,
  limit: number = 25,
): Promise<PaginatedCreatorAggResult> {
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc("contest_sorted_creator_aggregates_page", {
    p_contest_id: contestId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    // Fallback to legacy unpaginated RPC if the new one isn't deployed yet
    if (error.message.includes("contest_sorted_creator_aggregates_page")) {
      return getSortedCreatorAggregatesLegacy(supabase, contestId, page, limit);
    }
    throw new Error(
      `contest_sorted_creator_aggregates_page: ${error.message}. Apply migration 20260819_paginated_creator_aggregates.sql.`,
    );
  }

  const rows = (data ?? []) as RpcCreatorRow[];
  const totalEntries = rows.length > 0 ? Number(rows[0].total_creator_count ?? 0) : 0;

  return {
    rows: rows.map((row) => ({
      creator_id: row.creator_id,
      total_views: Number(row.total_views),
      total_earnings: Number(row.total_earnings),
      submission_count: row.submission_count,
      submission_ranks: row.submission_ranks ?? [],
      best_rank: row.best_submission_rank,
      has_paid_submission: row.has_paid_submission,
      platform: row.platform ?? null,
      ...(row.pending_submission_count != null
        ? { pending_submission_count: Number(row.pending_submission_count) }
        : {}),
    })),
    totalEntries,
  };
}

/** Fallback: calls the old unpaginated RPC and slices in JS. Remove once migration is applied. */
async function getSortedCreatorAggregatesLegacy(
  supabase: SupabaseClient,
  contestId: string,
  page: number,
  limit: number,
): Promise<PaginatedCreatorAggResult> {
  const { data, error } = await supabase.rpc("contest_sorted_creator_aggregates", {
    p_contest_id: contestId,
  });

  if (error) {
    throw new Error(
      `contest_sorted_creator_aggregates: ${error.message}. Apply migration 20260329_contest_leaderboard_snapshot_functions.sql if missing.`,
    );
  }

  const allRows = ((data ?? []) as RpcCreatorRow[]).map((row) => ({
    creator_id: row.creator_id,
    total_views: Number(row.total_views),
    total_earnings: Number(row.total_earnings),
    submission_count: row.submission_count,
    submission_ranks: row.submission_ranks ?? [],
    best_rank: row.best_submission_rank,
    has_paid_submission: row.has_paid_submission,
    platform: row.platform ?? null,
    ...(row.pending_submission_count != null
      ? { pending_submission_count: Number(row.pending_submission_count) }
      : {}),
  }));

  const from = (page - 1) * limit;
  return {
    rows: allRows.slice(from, from + limit),
    totalEntries: allRows.length,
  };
}
