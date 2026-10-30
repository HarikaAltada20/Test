import { fetchAllRows } from "@/lib/supabase-fetch-all";
import type { BrandDashboardDateFilter } from "@/lib/brand-dashboard-stats";

type ViewsRow = {
  views: number | null;
};

export type ContestForViews = {
  id: string;
  post_campaign_last_synced_at?: string | null;
};

const CONTEST_ID_CHUNK = 100;

async function sumViewsForContests(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: "post_campaign_submission_metrics" | "submissions",
  contestIds: string[],
  dateFilter: BrandDashboardDateFilter,
): Promise<{ views: number; error: string | null }> {
  const idColumn =
    table === "post_campaign_submission_metrics" ? "submission_id" : "id";
  let views = 0;

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await fetchAllRows<ViewsRow>((from, to) => {
      let query = supabase
        .from(table)
        .select(`${idColumn}, views`)
        .in("contest_id", idChunk)
        .neq("status", "rejected")
        .order(idColumn, { ascending: true })
        .range(from, to);

      if (dateFilter) {
        query = query
          .gte("created_at", dateFilter.from.toISOString())
          .lte("created_at", dateFilter.to.toISOString());
      }

      return query;
    });

    if (error) return { views, error: error.message };

    views += (data ?? []).reduce(
      (sum, row) => sum + Math.max(0, Number(row.views) || 0),
      0,
    );
  }

  return { views, error: null };
}

/**
 * Views on the advertiser's campaigns, excluding rejected submissions.
 * Each campaign is counted from exactly one source so nothing is doubled:
 * - post-campaign synced → post_campaign_submission_metrics (final snapshot)
 * - live / upcoming / ended but not synced yet → submissions (live counts)
 * Both tables hold the submission's own created_at, so the date window matches.
 * Pass `dateFilter: null` for true all-time.
 */
export async function sumAdvertiserCampaignViews(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contests: ContestForViews[],
  dateFilter: BrandDashboardDateFilter = null,
): Promise<{ totalViews: number; error: string | null }> {
  const syncedIds: string[] = [];
  const liveIds: string[] = [];
  for (const contest of contests) {
    if (contest.post_campaign_last_synced_at) syncedIds.push(contest.id);
    else liveIds.push(contest.id);
  }

  const [synced, live] = await Promise.all([
    sumViewsForContests(
      supabase,
      "post_campaign_submission_metrics",
      syncedIds,
      dateFilter,
    ),
    sumViewsForContests(supabase, "submissions", liveIds, dateFilter),
  ]);

  return {
    totalViews: synced.views + live.views,
    error: synced.error ?? live.error,
  };
}
