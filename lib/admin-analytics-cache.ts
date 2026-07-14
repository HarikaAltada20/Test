import { unstable_cache, revalidateTag } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  aggregateAdminAnalytics,
  aggregateAdminAnalyticsFromDailyRows,
  type AdminAnalyticsAdvertiserOption,
  type AdminAnalyticsBaseStatus,
  type AdminAnalyticsContest,
  type AdminAnalyticsContestType,
  type AdminAnalyticsDailyAggregateRow,
  type AdminAnalyticsPlatform,
  type AdminAnalyticsSeriesPoint,
  type AdminAnalyticsSubmission,
  type AdminAnalyticsSummary,
  type AdminAnalyticsViewsByStatus,
} from "@/lib/admin-analytics";

export const ADMIN_ANALYTICS_CACHE_SECONDS = 30 * 60;
export const ADMIN_ANALYTICS_CACHE_TAG = "admin-analytics-overview";

const CONTEST_ID_CHUNK = 400;
const SUBMISSION_CHUNK = 1000;

export type AdminAnalyticsOverviewPayload = {
  from: string;
  to: string;
  platforms: AdminAnalyticsPlatform[];
  types: AdminAnalyticsContestType[];
  statuses: AdminAnalyticsBaseStatus[];
  advertiserIds: string[];
  summary: AdminAnalyticsSummary;
  series: AdminAnalyticsSeriesPoint[];
  viewsByStatus: AdminAnalyticsViewsByStatus;
  campaigns: { id: string; title: string }[];
  allAdvertisers: AdminAnalyticsAdvertiserOption[];
  allCampaigns: {
    id: string;
    title: string;
    platform: string | null;
    contest_type: string | null;
    advertiser_id: string | null;
  }[];
  selectedCampaignCount: number;
};

function normalizeDayKey(dayKey: string): string {
  return String(dayKey).slice(0, 10);
}

function isMissingRpcError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("admin_analytics_overview_daily") &&
    (m.includes("could not find") ||
      m.includes("does not exist") ||
      m.includes("schema cache") ||
      m.includes("function"))
  );
}

/** Legacy path: pull submission rows into Node (slow at scale). */
async function fetchSubmissionsInRange(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<AdminAnalyticsSubmission[]> {
  if (contestIds.length === 0) return [];

  let all: AdminAnalyticsSubmission[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    let rangeFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, contest_id, created_at, status, platform, views, earnings, bonus_amount, other_stats",
        )
        .in("contest_id", idChunk)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(rangeFrom, rangeFrom + SUBMISSION_CHUNK - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all = all.concat(data as AdminAnalyticsSubmission[]);
      if (data.length < SUBMISSION_CHUNK) break;
      rangeFrom += SUBMISSION_CHUNK;
    }
  }

  return all;
}

export async function fetchAdminAnalyticsDailyRows(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<AdminAnalyticsDailyAggregateRow[]> {
  if (contestIds.length === 0) return [];

  const all: AdminAnalyticsDailyAggregateRow[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc(
      "admin_analytics_overview_daily",
      {
        p_from: fromIso,
        p_to: toIso,
        p_contest_ids: idChunk,
      },
    );
    if (error) {
      throw new Error(
        `Failed to aggregate admin analytics: ${error.message}`,
      );
    }
    for (const row of (data ?? []) as AdminAnalyticsDailyAggregateRow[]) {
      all.push({
        ...row,
        day_key: normalizeDayKey(row.day_key),
        submission_count: Number(row.submission_count) || 0,
        views_sum: Number(row.views_sum) || 0,
        likes_sum: Number(row.likes_sum) || 0,
        comments_sum: Number(row.comments_sum) || 0,
        shares_sum: Number(row.shares_sum) || 0,
        payout_cents_sum: Number(row.payout_cents_sum) || 0,
        approved_count: Number(row.approved_count) || 0,
      });
    }
  }

  return all;
}

function analyticsCacheKey(parts: {
  fromIso: string;
  toIso: string;
  platforms: AdminAnalyticsPlatform[];
  contestTypes: AdminAnalyticsContestType[];
  statuses: AdminAnalyticsBaseStatus[];
  contestIds: string[] | null;
  advertiserIds: string[] | null;
  scopedContestIds: string[];
}): string {
  return [
    parts.fromIso,
    parts.toIso,
    [...parts.platforms].sort().join(","),
    [...parts.contestTypes].sort().join(","),
    [...parts.statuses].sort().join(","),
    parts.contestIds == null ? "all" : [...parts.contestIds].sort().join(","),
    parts.advertiserIds == null
      ? "all"
      : [...parts.advertiserIds].sort().join(","),
    [...parts.scopedContestIds].sort().join(","),
  ].join("|");
}

export async function loadAdminAnalyticsOverview(input: {
  contestsForScope: AdminAnalyticsContest[];
  contestsInRange: AdminAnalyticsContest[];
  scopedContestIds: string[];
  from: Date;
  to: Date;
  platforms: AdminAnalyticsPlatform[];
  contestTypes: AdminAnalyticsContestType[];
  statuses: AdminAnalyticsBaseStatus[];
  contestIds: string[] | null;
  advertiserIds: string[] | null;
  allAdvertisers: AdminAnalyticsAdvertiserOption[];
}): Promise<AdminAnalyticsOverviewPayload> {
  const supabase = createAdminClient();
  const fromIso = input.from.toISOString();
  const toIso = input.to.toISOString();

  let aggregated;
  try {
    const dailyRows = await fetchAdminAnalyticsDailyRows(
      supabase,
      input.scopedContestIds,
      fromIso,
      toIso,
    );
    aggregated = aggregateAdminAnalyticsFromDailyRows({
      contests: input.contestsForScope,
      dailyRows,
      from: input.from,
      to: input.to,
      platforms: input.platforms,
      contestTypes: input.contestTypes,
      contestIds: input.contestIds,
      advertiserIds: input.advertiserIds,
      statuses: input.statuses,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isMissingRpcError(message)) throw error;
    console.warn(
      "[admin-analytics] RPC missing; falling back to row fetch:",
      message,
    );
    const submissions = await fetchSubmissionsInRange(
      supabase,
      input.scopedContestIds,
      fromIso,
      toIso,
    );
    aggregated = aggregateAdminAnalytics({
      contests: input.contestsForScope,
      submissions,
      from: input.from,
      to: input.to,
      platforms: input.platforms,
      contestTypes: input.contestTypes,
      contestIds: input.contestIds,
      advertiserIds: input.advertiserIds,
      statuses: input.statuses,
    });
  }

  const allCampaigns = input.contestsForScope
    .map((c) => ({
      id: c.id,
      title: (c.title || "Untitled campaign").trim() || "Untitled campaign",
      platform: c.platform,
      contest_type: c.contest_type,
      advertiser_id: c.advertiser_id ?? null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    from: fromIso,
    to: toIso,
    platforms: input.platforms,
    types: input.contestTypes,
    statuses: input.statuses,
    advertiserIds: input.advertiserIds ?? [],
    summary: aggregated.summary,
    series: aggregated.series,
    viewsByStatus: aggregated.viewsByStatus,
    campaigns: aggregated.campaigns,
    allAdvertisers: input.allAdvertisers,
    allCampaigns,
    selectedCampaignCount:
      input.contestIds == null
        ? aggregated.campaigns.length
        : input.contestIds.length,
  };
}

/** 30-min cache keyed by filters — same TTL idea as admin dashboard graph cache. */
export async function getCachedAdminAnalyticsOverview(input: {
  contestsForScope: AdminAnalyticsContest[];
  contestsInRange: AdminAnalyticsContest[];
  scopedContestIds: string[];
  from: Date;
  to: Date;
  platforms: AdminAnalyticsPlatform[];
  contestTypes: AdminAnalyticsContestType[];
  statuses: AdminAnalyticsBaseStatus[];
  contestIds: string[] | null;
  advertiserIds: string[] | null;
  allAdvertisers: AdminAnalyticsAdvertiserOption[];
}): Promise<AdminAnalyticsOverviewPayload> {
  const key = analyticsCacheKey({
    fromIso: input.from.toISOString(),
    toIso: input.to.toISOString(),
    platforms: input.platforms,
    contestTypes: input.contestTypes,
    statuses: input.statuses,
    contestIds: input.contestIds,
    advertiserIds: input.advertiserIds,
    scopedContestIds: input.scopedContestIds,
  });

  return unstable_cache(
    () => loadAdminAnalyticsOverview(input),
    [ADMIN_ANALYTICS_CACHE_TAG, key],
    {
      revalidate: ADMIN_ANALYTICS_CACHE_SECONDS,
      tags: [ADMIN_ANALYTICS_CACHE_TAG],
    },
  )();
}

export function revalidateAdminAnalyticsCaches(): void {
  try {
    revalidateTag(ADMIN_ANALYTICS_CACHE_TAG);
  } catch (e) {
    console.warn("[admin-analytics-cache] revalidateTag failed:", e);
  }
}
