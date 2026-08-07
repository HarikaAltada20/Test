import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";

type LeaderboardPrize = { position?: number; amount?: number };

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
    "creator_id, views, status",
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

  const viewsByCreator = new Map<string, number>();
  for (const row of rows || []) {
    const creatorId = String((row as { creator_id?: string }).creator_id || "");
    if (!creatorId) continue;
    const views = Math.max(0, Number((row as { views?: number }).views) || 0);
    viewsByCreator.set(creatorId, (viewsByCreator.get(creatorId) || 0) + views);
  }

  if (!viewsByCreator.has(params.creatorId)) {
    return { prizeCents: 0, rank: null };
  }

  const ranked = Array.from(viewsByCreator.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const rank = ranked.findIndex(([id]) => id === params.creatorId) + 1;
  if (rank <= 0) {
    return { prizeCents: 0, rank: null };
  }

  const prizeForRank = prizes.find((p) => Number(p.position) === rank);
  const prizeCents = Math.max(0, Math.round(Number(prizeForRank?.amount) || 0));
  return { prizeCents, rank };
}
