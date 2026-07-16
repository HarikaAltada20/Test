import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  ADMIN_ANALYTICS_PLATFORMS,
  ADMIN_ANALYTICS_CONTEST_TYPES,
  ADMIN_ANALYTICS_BASE_STATUSES,
  aggregateAdminAnalyticsFromDailyRows,
  expandStatusFilterIds,
  getContestAdvertiserName,
  getSubmissionMetricBundle,
  isAdminAnalyticsContestType,
  isAdminAnalyticsPlatform,
  isApprovedAnalyticsContest,
  normalizeAnalyticsPlatform,
  normalizeSubmissionStatus,
  type AdminAnalyticsAdvertiserOption,
  type AdminAnalyticsBaseStatus,
  type AdminAnalyticsContest,
  type AdminAnalyticsContestType,
  type AdminAnalyticsDailySqlRow,
  type AdminAnalyticsPlatform,
  type AdminAnalyticsSeriesPoint,
  type AdminAnalyticsStatusFilterId,
  type AdminAnalyticsSummary,
  type AdminAnalyticsViewsByStatus,
} from "@/lib/admin-analytics";

/** 30-min TTL for analytics KPI cards + All Campaigns graph. */
export const ADMIN_ANALYTICS_CACHE_SECONDS = 30 * 60;

export const ADMIN_ANALYTICS_CACHE_TAG = "admin-analytics-overview";

export type AdminAnalyticsOverviewParams = {
  fromIso: string;
  toIso: string;
  platforms: AdminAnalyticsPlatform[];
  contestTypes: AdminAnalyticsContestType[];
  statuses: AdminAnalyticsBaseStatus[];
  /** null = all; [] = none; [...] = specific */
  contestIds: string[] | null;
  /** null = all; [] = none; [...] = specific */
  advertiserIds: string[] | null;
};

export type AdminAnalyticsOverviewResult = {
  from: string;
  to: string;
  platforms: AdminAnalyticsPlatform[];
  types: AdminAnalyticsContestType[];
  statuses: AdminAnalyticsBaseStatus[];
  advertiserIds: string[];
  /** Locked post-review submissions metrics. */
  summary: AdminAnalyticsSummary;
  series: AdminAnalyticsSeriesPoint[];
  viewsByStatus: AdminAnalyticsViewsByStatus;
  /** Post-campaign overlay metrics (same shape as submissions). */
  pc: {
    summary: AdminAnalyticsSummary;
    series: AdminAnalyticsSeriesPoint[];
    viewsByStatus: AdminAnalyticsViewsByStatus;
    /** Campaigns that have PC overlay rows in range (for PC tab filter). */
    allCampaigns: {
      id: string;
      title: string;
      platform: string | null;
      contest_type: string | null;
      advertiser_id: string | null;
    }[];
    selectedCampaignCount: number;
  };
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

async function fetchAllContests(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<AdminAnalyticsContest[]> {
  const CHUNK = 1000;
  let all: AdminAnalyticsContest[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("contests")
      .select(
        "id, title, platform, contest_type, contest_based_details, payment_details, moderation_status, start_date, end_date, advertiser_id, advertiser_profiles!advertiser_id(company_name)",
      )
      .order("created_at", { ascending: false })
      .range(from, from + CHUNK - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all = all.concat(data as AdminAnalyticsContest[]);
    if (data.length < CHUNK) break;
    from += CHUNK;
  }
  return all;
}

function mergeDailyRows(
  rows: AdminAnalyticsDailySqlRow[],
): AdminAnalyticsDailySqlRow[] {
  const map = new Map<string, AdminAnalyticsDailySqlRow>();
  for (const row of rows) {
    const dayKey = String(row.day_key).slice(0, 10);
    const status = String(row.status ?? "unknown").toLowerCase();
    const key = `${dayKey}|${status}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        day_key: dayKey,
        status,
        submission_count: Number(row.submission_count) || 0,
        views_sum: Number(row.views_sum) || 0,
        likes_sum: Number(row.likes_sum) || 0,
        comments_sum: Number(row.comments_sum) || 0,
        shares_sum: Number(row.shares_sum) || 0,
        payouts_cents_sum: Number(row.payouts_cents_sum) || 0,
      });
      continue;
    }
    existing.submission_count += Number(row.submission_count) || 0;
    existing.views_sum += Number(row.views_sum) || 0;
    existing.likes_sum += Number(row.likes_sum) || 0;
    existing.comments_sum += Number(row.comments_sum) || 0;
    existing.shares_sum += Number(row.shares_sum) || 0;
    existing.payouts_cents_sum += Number(row.payouts_cents_sum) || 0;
  }
  return Array.from(map.values());
}

/**
 * DB-side daily aggregates (SUM/GROUP BY). Contest IDs are chunked for RPC
 * payload limits; results are merged in Node (compact day×status rows only).
 */
async function fetchAnalyticsDailyRows(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<AdminAnalyticsDailySqlRow[]> {
  if (contestIds.length === 0) return [];

  const CONTEST_ID_CHUNK = 500;
  const chunks: AdminAnalyticsDailySqlRow[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc("admin_analytics_daily", {
      p_from: fromIso,
      p_to: toIso,
      p_contest_ids: idChunk,
    });
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      const msg = (error.message ?? "").toLowerCase();
      const missingRpc =
        code === "PGRST202" ||
        code === "42883" ||
        msg.includes("could not find the function") ||
        (msg.includes("function") && msg.includes("does not exist")) ||
        msg.includes("schema cache");
      if (missingRpc) {
        throw new Error(
          "Admin analytics RPCs are not deployed yet. Apply SUPABASE migration 20260714_admin_analytics_daily_rpc.sql before using this page.",
        );
      }
      throw new Error(
        `Failed to aggregate admin analytics: ${error.message}`,
      );
    }
    chunks.push(...((data ?? []) as AdminAnalyticsDailySqlRow[]));
  }

  return mergeDailyRows(chunks);
}

function mergePcDailyRows(
  rows: AdminAnalyticsDailySqlRow[],
): AdminAnalyticsDailySqlRow[] {
  return mergeDailyRows(rows);
}

function isMissingRpcError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("could not find the function") ||
    (msg.includes("function") && msg.includes("does not exist")) ||
    msg.includes("schema cache") ||
    (msg.includes("post_campaign_submission_metrics") &&
      msg.includes("does not exist"))
  );
}

/**
 * Daily PC overlay metrics. Prefers RPC; falls back to row scan + Node rollup
 * if the migration is not applied yet.
 */
async function fetchPcAnalyticsDailyRows(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
  contestsById: Map<string, AdminAnalyticsContest>,
): Promise<AdminAnalyticsDailySqlRow[]> {
  if (contestIds.length === 0) return [];

  const CONTEST_ID_CHUNK = 500;
  const chunks: AdminAnalyticsDailySqlRow[] = [];
  let useFallback = false;

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc("admin_analytics_pc_daily", {
      p_from: fromIso,
      p_to: toIso,
      p_contest_ids: idChunk,
    });
    if (error) {
      if (isMissingRpcError(error)) {
        useFallback = true;
        break;
      }
      console.warn(
        "[admin-analytics] PC daily RPC failed; PC analytics will be empty:",
        error.message,
      );
      return [];
    }
    const rows = (data ?? []) as AdminAnalyticsDailySqlRow[];
    // Old count-only RPC has no views_sum — treat as missing and fall back.
    if (
      rows.length > 0 &&
      rows[0] != null &&
      !("views_sum" in rows[0]) &&
      !("likes_sum" in rows[0])
    ) {
      useFallback = true;
      break;
    }
    chunks.push(...rows);
  }

  if (!useFallback) {
    return mergePcDailyRows(chunks);
  }

  const fallback: AdminAnalyticsDailySqlRow[] = [];
  const PAGE = 1000;
  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from("post_campaign_submission_metrics")
        .select(
          "contest_id, created_at, status, platform, views, other_stats, earnings, bonus_amount",
        )
        .in("contest_id", idChunk)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) {
        if (isMissingRpcError(error)) return [];
        console.warn(
          "[admin-analytics] PC daily fallback failed:",
          error.message,
        );
        return [];
      }
      const rows = data ?? [];
      for (const row of rows) {
        const created = row.created_at as string | null;
        if (!created) continue;
        const contest = contestsById.get(String(row.contest_id));
        const metrics = getSubmissionMetricBundle(
          {
            id: "",
            contest_id: String(row.contest_id),
            created_at: created,
            status: (row.status as string | null) ?? null,
            platform: (row.platform as string | null) ?? null,
            views: Number(row.views) || 0,
            earnings: Number(row.earnings) || 0,
            bonus_amount: Number(row.bonus_amount) || 0,
            other_stats:
              (row.other_stats as Record<string, unknown> | null) ?? null,
          },
          contest?.platform,
          contest?.contest_based_details,
        );
        const status = normalizeSubmissionStatus(
          (row.status as string | null) ?? null,
        );
        const paid =
          String(row.status ?? "").toLowerCase() === "paid" ||
          Number(row.earnings || 0) > 0;
        const payoutsCents = paid
          ? Math.round(
              (Number(row.earnings) || 0) + (Number(row.bonus_amount) || 0),
            )
          : 0;
        fallback.push({
          day_key: created.slice(0, 10),
          status,
          submission_count: 1,
          views_sum: metrics.views,
          likes_sum: metrics.likes,
          comments_sum: metrics.comments,
          shares_sum: metrics.shares,
          payouts_cents_sum: payoutsCents,
        });
      }
      if (rows.length < PAGE) break;
    }
  }
  return mergePcDailyRows(fallback);
}

/**
 * Contest IDs that have at least one post-campaign overlay row in range.
 */
async function fetchPcContestIds(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  if (contestIds.length === 0) return out;

  const CONTEST_ID_CHUNK = 500;
  let useFallback = false;

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc("admin_analytics_pc_contest_ids", {
      p_from: fromIso,
      p_to: toIso,
      p_contest_ids: idChunk,
    });
    if (error) {
      if (isMissingRpcError(error)) {
        useFallback = true;
        break;
      }
      console.warn(
        "[admin-analytics] PC contest-ids RPC failed:",
        error.message,
      );
      return out;
    }
    for (const row of data ?? []) {
      const id = String((row as { contest_id?: string }).contest_id ?? "");
      if (id) out.add(id);
    }
  }

  if (!useFallback) return out;

  const PAGE = 1000;
  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from("post_campaign_submission_metrics")
        .select("contest_id")
        .in("contest_id", idChunk)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .range(offset, offset + PAGE - 1);
      if (error) {
        if (isMissingRpcError(error)) return out;
        console.warn(
          "[admin-analytics] PC contest-ids fallback failed:",
          error.message,
        );
        return out;
      }
      const rows = data ?? [];
      for (const row of rows) {
        const id = String(row.contest_id ?? "");
        if (id) out.add(id);
      }
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

async function fetchAdvertiserUsers(
  supabase: ReturnType<typeof createAdminClient>,
  advertiserIds: string[],
): Promise<Map<string, { full_name: string | null; email: string | null }>> {
  const map = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (advertiserIds.length === 0) return map;

  const CHUNK = 150;
  for (let i = 0; i < advertiserIds.length; i += CHUNK) {
    const chunk = advertiserIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      map.set(row.id, {
        full_name: row.full_name ?? null,
        email: row.email ?? null,
      });
    }
  }
  return map;
}

function buildAdvertiserOptions(
  contests: AdminAnalyticsContest[],
  usersById: Map<string, { full_name: string | null; email: string | null }>,
): AdminAnalyticsAdvertiserOption[] {
  const byId = new Map<string, AdminAnalyticsAdvertiserOption>();
  for (const c of contests) {
    if (!c.advertiser_id || byId.has(c.advertiser_id)) continue;
    byId.set(c.advertiser_id, {
      id: c.advertiser_id,
      name: getContestAdvertiserName(c, usersById.get(c.advertiser_id)),
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function loadAdminAnalyticsOverview(
  params: AdminAnalyticsOverviewParams,
): Promise<AdminAnalyticsOverviewResult> {
  const from = new Date(params.fromIso);
  const to = new Date(params.toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }
  if (from.getTime() > to.getTime()) {
    throw new Error("Invalid date range: from must be before to");
  }

  const supabase = createAdminClient();
  const contests = await fetchAllContests(supabase);

  const videoApprovedContests = contests.filter(
    (c) =>
      isApprovedAnalyticsContest(c) &&
      isAdminAnalyticsPlatform(
        normalizeAnalyticsPlatform(c.platform, c.contest_based_details),
      ),
  );

  const contestTypeSet = new Set(params.contestTypes);
  const platformSet = new Set(params.platforms);
  // Scope by type/platform only — not contest start/end dates — so late
  // submissions after end_date still count when created_at is in range.
  const contestsInRange = videoApprovedContests.filter((c) => {
    const type = (c.contest_type ?? "").toLowerCase();
    if (!isAdminAnalyticsContestType(type) || !contestTypeSet.has(type)) {
      return false;
    }
    const p = normalizeAnalyticsPlatform(c.platform, c.contest_based_details);
    return isAdminAnalyticsPlatform(p) && platformSet.has(p);
  });

  const advertiserIdSet =
    params.advertiserIds == null ? null : new Set(params.advertiserIds);

  const contestsForScope = advertiserIdSet
    ? contestsInRange.filter(
        (c) => c.advertiser_id && advertiserIdSet.has(c.advertiser_id),
      )
    : contestsInRange;

  const scopedContestIds =
    params.contestIds == null
      ? contestsForScope.map((c) => c.id)
      : contestsForScope
          .filter((c) => params.contestIds!.includes(c.id))
          .map((c) => c.id);

  const contestsById = new Map(
    contestsForScope.map((c) => [c.id, c] as const),
  );

  const contestsForScopeIds = contestsForScope.map((c) => c.id);

  const [dailyRows, pcDailyRows, pcContestIdSet] = await Promise.all([
    fetchAnalyticsDailyRows(
      supabase,
      scopedContestIds,
      from.toISOString(),
      to.toISOString(),
    ),
    fetchPcAnalyticsDailyRows(
      supabase,
      scopedContestIds,
      from.toISOString(),
      to.toISOString(),
      contestsById,
    ),
    // Full advertiser/type/platform scope (not contest-id filter) so the PC
    // campaigns dropdown lists every campaign with overlay data.
    fetchPcContestIds(
      supabase,
      contestsForScopeIds,
      from.toISOString(),
      to.toISOString(),
    ),
  ]);

  const aggregateInputBase = {
    contests: contestsForScope,
    from,
    to,
    contestIds: params.contestIds,
    advertiserIds: params.advertiserIds,
    statuses: params.statuses,
  };

  const aggregated = aggregateAdminAnalyticsFromDailyRows({
    ...aggregateInputBase,
    dailyRows,
  });
  const pcAggregated = aggregateAdminAnalyticsFromDailyRows({
    ...aggregateInputBase,
    dailyRows: pcDailyRows,
  });

  const advertiserIdsForLabels = [
    ...new Set(
      contestsInRange
        .map((c) => c.advertiser_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const advertiserUsers = await fetchAdvertiserUsers(
    supabase,
    advertiserIdsForLabels,
  );
  const allAdvertisers = buildAdvertiserOptions(
    contestsInRange,
    advertiserUsers,
  );

  const allCampaigns = contestsForScope
    .map((c) => ({
      id: c.id,
      title: (c.title || "Untitled campaign").trim() || "Untitled campaign",
      platform: c.platform,
      contest_type: c.contest_type,
      advertiser_id: c.advertiser_id ?? null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const pcAllCampaigns = allCampaigns.filter((c) => pcContestIdSet.has(c.id));
  const pcSelectedCampaignCount =
    params.contestIds == null
      ? pcAllCampaigns.length
      : pcAllCampaigns.filter((c) => params.contestIds!.includes(c.id)).length;

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    platforms: params.platforms,
    types: params.contestTypes,
    statuses: params.statuses,
    advertiserIds: params.advertiserIds ?? [],
    summary: aggregated.summary,
    series: aggregated.series,
    viewsByStatus: aggregated.viewsByStatus,
    pc: {
      summary: pcAggregated.summary,
      series: pcAggregated.series,
      viewsByStatus: pcAggregated.viewsByStatus,
      allCampaigns: pcAllCampaigns,
      selectedCampaignCount: pcSelectedCampaignCount,
    },
    campaigns: aggregated.campaigns,
    allAdvertisers,
    allCampaigns,
    selectedCampaignCount: aggregated.campaigns.length,
  };
}

function normalizeListKey(ids: string[] | null): string {
  if (ids == null) return "__all__";
  if (ids.length === 0) return "__none__";
  return [...ids].sort().join(",");
}

function buildCacheKeyParts(params: AdminAnalyticsOverviewParams): string[] {
  return [
    ADMIN_ANALYTICS_CACHE_TAG,
    "v4-pc-campaigns",
    params.fromIso,
    params.toIso,
    [...params.platforms].sort().join(","),
    [...params.contestTypes].sort().join(","),
    [...params.statuses].sort().join(","),
    normalizeListKey(params.advertiserIds),
    normalizeListKey(params.contestIds),
  ];
}

function canonicalizeParams(
  params: AdminAnalyticsOverviewParams,
): AdminAnalyticsOverviewParams {
  return {
    fromIso: params.fromIso,
    toIso: params.toIso,
    platforms: [...params.platforms].sort(),
    contestTypes: [...params.contestTypes].sort(),
    statuses: [...params.statuses].sort(),
    contestIds:
      params.contestIds == null ? null : [...params.contestIds].sort(),
    advertiserIds:
      params.advertiserIds == null ? null : [...params.advertiserIds].sort(),
  };
}

/**
 * KPI cards + All Campaigns series, cached 30 minutes per filter set.
 * Uses Postgres daily rollups (not raw submissions). TTL-only — no tag busting.
 */
export async function getCachedAdminAnalyticsOverview(
  params: AdminAnalyticsOverviewParams,
): Promise<AdminAnalyticsOverviewResult> {
  const normalized = canonicalizeParams(params);
  const keyParts = buildCacheKeyParts(normalized);
  const serialized = JSON.stringify(normalized);

  return unstable_cache(
    async () =>
      loadAdminAnalyticsOverview(
        JSON.parse(serialized) as AdminAnalyticsOverviewParams,
      ),
    keyParts,
    {
      revalidate: ADMIN_ANALYTICS_CACHE_SECONDS,
      tags: [ADMIN_ANALYTICS_CACHE_TAG],
    },
  )();
}

export function parsePlatformsParam(raw: string | null): AdminAnalyticsPlatform[] {
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "all") {
    return [...ADMIN_ANALYTICS_PLATFORMS];
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is AdminAnalyticsPlatform =>
      (ADMIN_ANALYTICS_PLATFORMS as string[]).includes(p),
    );
  return parts.length > 0 ? parts : [...ADMIN_ANALYTICS_PLATFORMS];
}

export function parseStatusesParam(raw: string | null): AdminAnalyticsBaseStatus[] {
  if (raw?.trim().toLowerCase() === "__none__") {
    return [];
  }
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "all") {
    return [...ADMIN_ANALYTICS_BASE_STATUSES];
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase()) as AdminAnalyticsStatusFilterId[];
  return expandStatusFilterIds(
    parts.filter((p): p is AdminAnalyticsStatusFilterId =>
      (ADMIN_ANALYTICS_BASE_STATUSES as string[]).includes(p),
    ),
  );
}

/** null = all; [] = none; [...] = specific ids */
export function parseIdListParam(raw: string | null): string[] | null {
  if (raw?.trim().toLowerCase() === "__none__") return [];
  if (!raw || !raw.trim()) return null;
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

export function parseContestTypesParam(
  raw: string | null,
): AdminAnalyticsContestType[] {
  if (raw?.trim().toLowerCase() === "__none__") {
    return [];
  }
  if (!raw || raw.trim() === "" || raw.trim().toLowerCase() === "all") {
    return [...ADMIN_ANALYTICS_CONTEST_TYPES];
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(isAdminAnalyticsContestType);
  return parts;
}
