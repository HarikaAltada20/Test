import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";

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

export type CreatorAggregateSubmissionRow = {
  creator_id?: string | null;
  views?: number | null;
  earnings?: number | null;
  status?: string | null;
  platform?: string | null;
  created_at?: string | null;
};

function leaderboardVideoPlatformFilter(
  platform?: string | null,
): "youtube" | "instagram" | "tiktok" | null {
  const value = String(platform || "")
    .toLowerCase()
    .trim();
  if (value === "youtube" || value === "instagram" || value === "tiktok") {
    return value;
  }
  return null;
}

/**
 * Group eligible submissions into creator-wise ranks.
 * Matches contest_sorted_creator_aggregates_page: views desc, created_at asc,
 * then creators by total_views desc / best rank asc.
 */
export function aggregateCreatorsFromSubmissions(
  submissions: CreatorAggregateSubmissionRow[],
  page: number = 1,
  limit: number = 25,
  platform?: string | null,
): PaginatedCreatorAggResult {
  const platformFilter = leaderboardVideoPlatformFilter(platform);
  const eligible = submissions.filter((row) => {
    if (!row.creator_id) return false;
    if (!platformFilter) return true;
    return leaderboardVideoPlatformFilter(row.platform) === platformFilter;
  });

  const ranked = [...eligible].sort((a, b) => {
    const viewsA = Number(a.views) || 0;
    const viewsB = Number(b.views) || 0;
    if (viewsB !== viewsA) return viewsB - viewsA;
    const createdA = a.created_at || "";
    const createdB = b.created_at || "";
    if (createdA < createdB) return -1;
    if (createdA > createdB) return 1;
    return 0;
  });

  const byCreator = new Map<string, CreatorAggRow>();
  ranked.forEach((row, index) => {
    const creatorId = String(row.creator_id);
    const rank = index + 1;
    const views = Number(row.views) || 0;
    const earnings = Number(row.earnings) || 0;
    const existing = byCreator.get(creatorId);
    if (!existing) {
      byCreator.set(creatorId, {
        creator_id: creatorId,
        total_views: views,
        total_earnings: earnings,
        submission_count: 1,
        submission_ranks: [rank],
        best_rank: rank,
        has_paid_submission: row.status === "paid",
        platform: leaderboardVideoPlatformFilter(row.platform) ?? row.platform ?? null,
        pending_submission_count: row.status === "pending" ? 1 : 0,
      });
      return;
    }
    existing.total_views += views;
    existing.total_earnings += earnings;
    existing.submission_count += 1;
    existing.submission_ranks.push(rank);
    existing.best_rank = Math.min(existing.best_rank, rank);
    if (row.status === "paid") existing.has_paid_submission = true;
    if (row.status === "pending") {
      existing.pending_submission_count =
        (existing.pending_submission_count ?? 0) + 1;
    }
  });

  const allRows = [...byCreator.values()].sort((a, b) => {
    if (b.total_views !== a.total_views) return b.total_views - a.total_views;
    return a.best_rank - b.best_rank;
  });

  const from = Math.max(0, (page - 1) * limit);
  return {
    rows: allRows.slice(from, from + limit),
    totalEntries: allRows.length,
  };
}

/**
 * Per-creator aggregates for the whole contest — paginated in SQL.
 * Only the requested page of creators is returned; ranking/sorting happens in Postgres.
 * When `platform` is set, aggregates only that platform's non-rejected submissions.
 */
export async function getSortedCreatorAggregates(
  supabase: SupabaseClient,
  contestId: string,
  page: number = 1,
  limit: number = 25,
  platform?: string | null,
): Promise<PaginatedCreatorAggResult> {
  const platformFilter = leaderboardVideoPlatformFilter(platform);
  if (platformFilter) {
    const { data, error } = await fetchContestSubmissionsAllPages<
      CreatorAggregateSubmissionRow
    >(supabase, contestId, "creator_id, views, earnings, status, platform, created_at", {
      statusNeq: "rejected",
      platform: platformFilter,
      order: [
        { column: "views", ascending: false, nullsFirst: false },
        { column: "created_at", ascending: true },
      ],
    });
    if (error) {
      throw new Error(
        `Failed to fetch platform creator aggregates: ${
          (error as { message?: string })?.message || String(error)
        }`,
      );
    }
    return aggregateCreatorsFromSubmissions(
      data || [],
      page,
      limit,
      platformFilter,
    );
  }

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
