import type { SupabaseClient } from "@supabase/supabase-js";

type PendingCountRow = {
  creator_id: string;
  pending_count: number | string;
};

/** Scalable pending counts for creator-wise leaderboard (one grouped DB query). */
export async function fetchPendingSubmissionCountsByCreator(
  supabase: SupabaseClient,
  contestId: string,
  creatorIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (creatorIds.length === 0) return counts;

  const { data, error } = await supabase.rpc(
    "contest_pending_submission_counts_by_creator",
    {
      p_contest_id: contestId,
      p_creator_ids: creatorIds,
    },
  );

  if (error) {
    console.error(
      "contest_pending_submission_counts_by_creator:",
      error.message,
    );
    return counts;
  }

  for (const row of (data ?? []) as PendingCountRow[]) {
    if (!row?.creator_id) continue;
    const n = Number(row.pending_count);
    if (n > 0) counts.set(row.creator_id, n);
  }

  return counts;
}
