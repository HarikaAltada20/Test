import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  ADMIN_ANALYTICS_BASE_STATUSES,
  type AdminAnalyticsBaseStatus,
  type AdminAnalyticsDailySqlRow,
  normalizeAnalyticsPlatform,
  normalizeSubmissionStatus,
} from "@/lib/admin-analytics";
import type { BrandAnalyticsDataSource } from "@/lib/brand-analytics-query";
import { normalizeBrandPlatformKey } from "@/lib/brand-analytics-graph";

export const BRAND_ANALYTICS_CACHE_SECONDS = 5 * 60;
export const BRAND_ANALYTICS_CACHE_TAG = "brand-analytics";

export type BrandContestRow = {
  id: string;
  title: string | null;
  platform: string | null;
  contest_type: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  contest_based_details: unknown;
  live_submission_count?: number | null;
  moderation_status?: string | null;
  status?: string | null;
  post_contest_status?: string | null;
  payment_details?: unknown;
};

export type BrandContestRollupRow = {
  contest_id: string;
  status: string;
  platform: string;
  submission_count: number;
  views_sum: number;
  likes_sum: number;
  comments_sum: number;
  shares_sum: number;
  payouts_cents_sum: number;
};

export type BrandTwitterDailyRow = {
  day_key: string;
  status: string;
  submission_count: number;
  views_sum: number;
  likes_sum: number;
  comments_sum: number;
  shares_sum: number;
  quote_reposts_sum: number;
};

export type BrandTwitterContestRow = {
  contest_id: string;
  status: string;
  submission_count: number;
  views_sum: number;
  likes_sum: number;
  comments_sum: number;
  shares_sum: number;
  quote_reposts_sum: number;
};

export type BrandCreatorRollupRow = {
  creator_id: string;
  contest_type: string;
  platform: string;
  status: string;
  submission_count: number;
  views_sum: number;
  earnings_cents_sum: number;
  first_created_at: string | null;
  last_created_at: string | null;
};

export type BrandAnalyticsQueryContext = {
  advertiserId: string;
  dateFrom: Date;
  dateTo: Date;
  dataSource: BrandAnalyticsDataSource;
  contentType: "video" | "text_image";
  videoPlatform: string;
  tiktokAnalytics: boolean;
  twitterAnalytics: boolean;
  contestTypeSet: Set<string> | null;
  contestIdSet: Set<string> | null;
  submissionStatus: string | null;
  notRejected: boolean;
};

export type BrandAnalyticsBundle = {
  ctx: BrandAnalyticsQueryContext;
  allBrandContests: BrandContestRow[];
  scopedContests: BrandContestRow[];
  videoContestIds: string[];
  twitterContestIds: string[];
  dailyRows: AdminAnalyticsDailySqlRow[];
  contestRollup: BrandContestRollupRow[];
  twitterDaily: BrandTwitterDailyRow[];
  twitterContestRollup: BrandTwitterContestRow[];
  pcContestIds: string[];
};

export type BrandAnalyticsCreatorsBundle = BrandAnalyticsBundle & {
  creatorRollup: BrandCreatorRollupRow[];
  twitterCreatorRollup: BrandCreatorRollupRow[];
};

function isMissingRpcError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("could not find the function") ||
    (msg.includes("function") && msg.includes("does not exist")) ||
    msg.includes("schema cache")
  );
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

async function fetchDailyRowsForContests(
  supabase: ReturnType<typeof createAdminClient>,
  rpcName: "admin_analytics_daily" | "admin_analytics_pc_overview",
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<{ dailyRows: AdminAnalyticsDailySqlRow[]; pcContestIds: string[] }> {
  if (contestIds.length === 0) {
    return { dailyRows: [], pcContestIds: [] };
  }

  const CONTEST_ID_CHUNK = 500;
  const dailyChunks: AdminAnalyticsDailySqlRow[] = [];
  const pcContestIds = new Set<string>();

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    if (rpcName === "admin_analytics_daily") {
      const { data, error } = await supabase.rpc("admin_analytics_daily", {
        p_from: fromIso,
        p_to: toIso,
        p_contest_ids: idChunk,
      });
      if (error) {
        if (isMissingRpcError(error)) {
          throw new Error(
            "Brand analytics RPCs are not deployed. Apply migrations 20260714_admin_analytics_daily_rpc.sql and 20260719_admin_analytics_daily_rollups.sql.",
          );
        }
        throw new Error(`Failed to aggregate brand analytics: ${error.message}`);
      }
      dailyChunks.push(...((data ?? []) as AdminAnalyticsDailySqlRow[]));
    } else {
      const { data, error } = await supabase.rpc("admin_analytics_pc_overview", {
        p_from: fromIso,
        p_to: toIso,
        p_contest_ids: idChunk,
      });
      if (error) {
        if (isMissingRpcError(error)) {
          throw new Error(
            "Brand analytics PC RPCs are not deployed. Apply migrations 20260718_pc_metrics_admin_analytics_scale.sql and 20260719_admin_analytics_daily_rollups.sql.",
          );
        }
        throw new Error(
          `Failed to aggregate brand PC analytics: ${error.message}`,
        );
      }
      const payload =
        typeof data === "string"
          ? (JSON.parse(data) as {
              daily?: (AdminAnalyticsDailySqlRow & { contest_id?: string })[];
              contest_ids?: string[];
            })
          : ((data ?? {}) as {
              daily?: (AdminAnalyticsDailySqlRow & { contest_id?: string })[];
              contest_ids?: string[];
            });
      for (const id of payload.contest_ids ?? []) {
        const normalized = String(id ?? "");
        if (normalized) pcContestIds.add(normalized);
      }
      for (const row of payload.daily ?? []) {
        const contestId = String(row.contest_id ?? "");
        if (contestId) pcContestIds.add(contestId);
        dailyChunks.push({
          day_key: row.day_key,
          status: row.status,
          submission_count: row.submission_count,
          views_sum: row.views_sum,
          likes_sum: row.likes_sum,
          comments_sum: row.comments_sum,
          shares_sum: row.shares_sum,
          payouts_cents_sum: row.payouts_cents_sum,
        });
      }
    }
  }

  return { dailyRows: mergeDailyRows(dailyChunks), pcContestIds: [...pcContestIds] };
}

async function fetchContestRollup(
  supabase: ReturnType<typeof createAdminClient>,
  rpcName: "brand_analytics_contest_rollup" | "brand_analytics_pc_contest_rollup",
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<BrandContestRollupRow[]> {
  if (contestIds.length === 0) return [];

  const CONTEST_ID_CHUNK = 500;
  const rows: BrandContestRollupRow[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc(rpcName, {
      p_from: fromIso,
      p_to: toIso,
      p_contest_ids: idChunk,
    });
    if (error) {
      if (isMissingRpcError(error)) {
        throw new Error(
          "Brand analytics contest rollup RPC is not deployed. Apply migration 20260720_brand_analytics_scale.sql.",
        );
      }
      throw new Error(
        `Failed to load brand contest rollup: ${error.message}`,
      );
    }
    for (const row of (data ?? []) as BrandContestRollupRow[]) {
      rows.push({
        contest_id: String(row.contest_id),
        status: String(row.status ?? "unknown").toLowerCase(),
        platform: String(row.platform ?? "unknown").toLowerCase(),
        submission_count: Number(row.submission_count) || 0,
        views_sum: Number(row.views_sum) || 0,
        likes_sum: Number(row.likes_sum) || 0,
        comments_sum: Number(row.comments_sum) || 0,
        shares_sum: Number(row.shares_sum) || 0,
        payouts_cents_sum: Number(row.payouts_cents_sum) || 0,
      });
    }
  }

  return rows;
}

async function fetchTwitterDaily(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<BrandTwitterDailyRow[]> {
  if (contestIds.length === 0) return [];

  const CONTEST_ID_CHUNK = 500;
  const map = new Map<string, BrandTwitterDailyRow>();

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc("brand_analytics_twitter_daily", {
      p_from: fromIso,
      p_to: toIso,
      p_contest_ids: idChunk,
    });
    if (error) {
      if (isMissingRpcError(error)) {
        throw new Error(
          "Brand analytics Twitter RPC is not deployed. Apply migration 20260720_brand_analytics_scale.sql.",
        );
      }
      throw new Error(`Failed to load Twitter daily rollup: ${error.message}`);
    }
    for (const row of (data ?? []) as BrandTwitterDailyRow[]) {
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
          quote_reposts_sum: Number(row.quote_reposts_sum) || 0,
        });
      } else {
        existing.submission_count += Number(row.submission_count) || 0;
        existing.views_sum += Number(row.views_sum) || 0;
        existing.likes_sum += Number(row.likes_sum) || 0;
        existing.comments_sum += Number(row.comments_sum) || 0;
        existing.shares_sum += Number(row.shares_sum) || 0;
        existing.quote_reposts_sum += Number(row.quote_reposts_sum) || 0;
      }
    }
  }

  return Array.from(map.values());
}

async function fetchTwitterContestRollup(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<BrandTwitterContestRow[]> {
  if (contestIds.length === 0) return [];

  const CONTEST_ID_CHUNK = 500;
  const rows: BrandTwitterContestRow[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc(
      "brand_analytics_twitter_contest_rollup",
      {
        p_from: fromIso,
        p_to: toIso,
        p_contest_ids: idChunk,
      },
    );
    if (error) {
      if (isMissingRpcError(error)) {
        throw new Error(
          "Brand analytics Twitter RPC is not deployed. Apply migration 20260720_brand_analytics_scale.sql.",
        );
      }
      throw new Error(
        `Failed to load Twitter contest rollup: ${error.message}`,
      );
    }
    for (const row of (data ?? []) as BrandTwitterContestRow[]) {
      rows.push({
        contest_id: String(row.contest_id),
        status: String(row.status ?? "unknown").toLowerCase(),
        submission_count: Number(row.submission_count) || 0,
        views_sum: Number(row.views_sum) || 0,
        likes_sum: Number(row.likes_sum) || 0,
        comments_sum: Number(row.comments_sum) || 0,
        shares_sum: Number(row.shares_sum) || 0,
        quote_reposts_sum: Number(row.quote_reposts_sum) || 0,
      });
    }
  }

  return rows;
}

async function fetchCreatorRollup(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<BrandCreatorRollupRow[]> {
  if (contestIds.length === 0) return [];

  const CONTEST_ID_CHUNK = 500;
  const rows: BrandCreatorRollupRow[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc("brand_analytics_by_creator", {
      p_from: fromIso,
      p_to: toIso,
      p_contest_ids: idChunk,
    });
    if (error) {
      if (isMissingRpcError(error)) {
        throw new Error(
          "Brand analytics creator RPC is not deployed. Apply migration 20260720_brand_analytics_scale.sql.",
        );
      }
      throw new Error(`Failed to load creator rollup: ${error.message}`);
    }
    for (const row of (data ?? []) as BrandCreatorRollupRow[]) {
      rows.push({
        creator_id: String(row.creator_id),
        contest_type: String(row.contest_type ?? "unknown"),
        platform: String(row.platform ?? "unknown").toLowerCase(),
        status: String(row.status ?? "unknown").toLowerCase(),
        submission_count: Number(row.submission_count) || 0,
        views_sum: Number(row.views_sum) || 0,
        earnings_cents_sum: Number(row.earnings_cents_sum) || 0,
        first_created_at: row.first_created_at ?? null,
        last_created_at: row.last_created_at ?? null,
      });
    }
  }

  return rows;
}

async function fetchTwitterCreatorRollup(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<BrandCreatorRollupRow[]> {
  if (contestIds.length === 0) return [];

  const CONTEST_ID_CHUNK = 500;
  const rows: BrandCreatorRollupRow[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc(
      "brand_analytics_twitter_creator_rollup",
      {
        p_from: fromIso,
        p_to: toIso,
        p_contest_ids: idChunk,
      },
    );
    if (error) {
      if (isMissingRpcError(error)) {
        throw new Error(
          "Brand analytics Twitter creator RPC is not deployed. Apply migration 20260720_brand_analytics_scale.sql.",
        );
      }
      throw new Error(
        `Failed to load Twitter creator rollup: ${error.message}`,
      );
    }
    for (const row of (data ?? []) as BrandCreatorRollupRow[]) {
      rows.push({
        creator_id: String(row.creator_id),
        contest_type: String(row.contest_type ?? "unknown"),
        platform: "twitter",
        status: String(row.status ?? "unknown").toLowerCase(),
        submission_count: Number(row.submission_count) || 0,
        views_sum: Number(row.views_sum) || 0,
        earnings_cents_sum: Number(row.earnings_cents_sum) || 0,
        first_created_at: row.first_created_at ?? null,
        last_created_at: row.last_created_at ?? null,
      });
    }
  }

  return rows;
}

async function fetchAdvertiserContests(
  supabase: ReturnType<typeof createAdminClient>,
  advertiserId: string,
): Promise<BrandContestRow[]> {
  const CHUNK = 1000;
  let all: BrandContestRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("contests_with_status")
      .select(
        "id, title, platform, contest_type, start_date, end_date, created_at, contest_based_details, live_submission_count, moderation_status, status, post_contest_status, payment_details",
      )
      .eq("advertiser_id", advertiserId)
      .order("created_at", { ascending: false })
      .range(from, from + CHUNK - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all = all.concat(data as BrandContestRow[]);
    if (data.length < CHUNK) break;
    from += CHUNK;
  }
  return all;
}

export function resolveAllowedPlatforms(ctx: BrandAnalyticsQueryContext): string[] {
  const platforms: string[] = [];
  const isPc = ctx.dataSource === "pc_submissions";

  if (ctx.contentType === "video") {
    if (ctx.videoPlatform === "all") {
      platforms.push("youtube", "instagram", "tiktok");
    } else if (ctx.videoPlatform === "youtube_instagram") {
      platforms.push("youtube", "instagram");
    } else if (ctx.videoPlatform === "youtube_tiktok") {
      platforms.push("youtube", "tiktok");
    } else if (ctx.videoPlatform === "instagram_tiktok") {
      platforms.push("instagram", "tiktok");
    } else if (
      ["youtube", "instagram", "tiktok"].includes(ctx.videoPlatform)
    ) {
      platforms.push(ctx.videoPlatform);
    } else {
      platforms.push("youtube", "instagram");
      if (ctx.tiktokAnalytics) platforms.push("tiktok");
    }
  }

  if (!isPc && ctx.twitterAnalytics) {
    platforms.push("twitter");
  }

  if (platforms.length === 0) {
    return isPc
      ? ["youtube", "instagram", "tiktok"]
      : ["youtube", "instagram", "tiktok", "twitter"];
  }

  return platforms;
}

export function resolveStatusBases(ctx: BrandAnalyticsQueryContext): AdminAnalyticsBaseStatus[] {
  if (ctx.notRejected) {
    return ["pending", "verified", "paid"];
  }
  const status = ctx.submissionStatus?.trim().toLowerCase() ?? null;
  if (!status || status === "all") {
    return [...ADMIN_ANALYTICS_BASE_STATUSES];
  }
  if (status === "verifiedpaid") {
    return ["verified", "paid"];
  }
  if ((ADMIN_ANALYTICS_BASE_STATUSES as string[]).includes(status)) {
    return [status as AdminAnalyticsBaseStatus];
  }
  return [...ADMIN_ANALYTICS_BASE_STATUSES];
}

export function statusMatchesFilter(
  status: string,
  ctx: BrandAnalyticsQueryContext,
): boolean {
  const normalized = normalizeSubmissionStatus(status);
  if (normalized === "unknown") return false;
  const bases = resolveStatusBases(ctx);
  return bases.includes(normalized);
}

function filterContests(
  contests: BrandContestRow[],
  ctx: BrandAnalyticsQueryContext,
  options?: { ignoreContestIds?: boolean },
): BrandContestRow[] {
  let list = contests;

  if (ctx.contestTypeSet !== null) {
    list = list.filter((c) =>
      ctx.contestTypeSet!.has((c.contest_type ?? "").toString().toLowerCase()),
    );
  }

  if (!options?.ignoreContestIds && ctx.contestIdSet !== null) {
    list = list.filter((c) => ctx.contestIdSet!.has(c.id));
  }

  const allowed = new Set(resolveAllowedPlatforms(ctx));
  list = list.filter((c) =>
    allowed.has(normalizeBrandPlatformKey(c)),
  );

  return list;
}

function videoContestIdsFromContests(contests: BrandContestRow[]): string[] {
  return contests
    .filter((c) => normalizeBrandPlatformKey(c) !== "twitter")
    .map((c) => c.id);
}

function twitterContestIdsFromContests(
  contests: BrandContestRow[],
): string[] {
  return contests
    .filter((c) => normalizeBrandPlatformKey(c) === "twitter")
    .map((c) => c.id);
}

async function loadBrandAnalyticsBundle(
  ctx: BrandAnalyticsQueryContext,
): Promise<BrandAnalyticsBundle> {
  const supabase = createAdminClient();
  const fromIso = ctx.dateFrom.toISOString();
  const toIso = ctx.dateTo.toISOString();
  const isPc = ctx.dataSource === "pc_submissions";

  const allBrandContests = await fetchAdvertiserContests(
    supabase,
    ctx.advertiserId,
  );
  // Scope = type/platform filters only (dropdown + per-contest rollups).
  // Scoped = also respects selected campaign ids (metric totals + graph).
  const contestsForScope = filterContests(allBrandContests, ctx, {
    ignoreContestIds: true,
  });
  const scopedContests = filterContests(allBrandContests, ctx);

  const scopeVideoContestIds = videoContestIdsFromContests(contestsForScope);
  const scopedVideoContestIds = videoContestIdsFromContests(scopedContests);
  const scopeTwitterContestIds = isPc
    ? []
    : twitterContestIdsFromContests(contestsForScope);
  const scopedTwitterContestIds = isPc
    ? []
    : twitterContestIdsFromContests(scopedContests);

  const dailyRpc = isPc ? "admin_analytics_pc_overview" : "admin_analytics_daily";
  const contestRpc = isPc
    ? "brand_analytics_pc_contest_rollup"
    : "brand_analytics_contest_rollup";

  const [dailyResult, contestRollup, twitterDaily, twitterContestRollup] =
    await Promise.all([
      fetchDailyRowsForContests(
        supabase,
        dailyRpc,
        scopedVideoContestIds,
        fromIso,
        toIso,
      ),
      fetchContestRollup(
        supabase,
        contestRpc,
        scopeVideoContestIds,
        fromIso,
        toIso,
      ),
      fetchTwitterDaily(
        supabase,
        scopedTwitterContestIds,
        fromIso,
        toIso,
      ),
      fetchTwitterContestRollup(
        supabase,
        scopeTwitterContestIds,
        fromIso,
        toIso,
      ),
    ]);

  return {
    ctx,
    allBrandContests,
    scopedContests,
    videoContestIds: scopedVideoContestIds,
    twitterContestIds: scopedTwitterContestIds,
    dailyRows: dailyResult.dailyRows,
    contestRollup,
    twitterDaily,
    twitterContestRollup,
    pcContestIds: dailyResult.pcContestIds,
  };
}

async function loadBrandAnalyticsCreatorsBundle(
  ctx: BrandAnalyticsQueryContext,
): Promise<BrandAnalyticsCreatorsBundle> {
  const base = await loadBrandAnalyticsBundle(ctx);
  const supabase = createAdminClient();
  const fromIso = ctx.dateFrom.toISOString();
  const toIso = ctx.dateTo.toISOString();
  const isPc = ctx.dataSource === "pc_submissions";

  const [creatorRollup, twitterCreatorRollup] = await Promise.all([
    isPc
      ? Promise.resolve([] as BrandCreatorRollupRow[])
      : fetchCreatorRollup(
          supabase,
          base.videoContestIds,
          fromIso,
          toIso,
        ),
    fetchTwitterCreatorRollup(
      supabase,
      base.twitterContestIds,
      fromIso,
      toIso,
    ),
  ]);

  if (isPc) {
    // PC creator rollup uses post_campaign_submission_metrics via brand_analytics_by_creator
    // on PC contest ids — reuse creator RPC against PC table via separate path if needed.
    // For PC, aggregate from contest rollup is insufficient for per-creator; use RPC on PC metrics.
    const pcCreatorRows = await fetchCreatorRollupFromPc(
      supabase,
      base.videoContestIds,
      fromIso,
      toIso,
    );
    return {
      ...base,
      creatorRollup: pcCreatorRows,
      twitterCreatorRollup,
    };
  }

  return {
    ...base,
    creatorRollup,
    twitterCreatorRollup,
  };
}

/** PC metrics share submissions schema fields; scan grouped in SQL via brand_analytics_by_creator on contest scope only for standard submissions. */
async function fetchCreatorRollupFromPc(
  supabase: ReturnType<typeof createAdminClient>,
  contestIds: string[],
  fromIso: string,
  toIso: string,
): Promise<BrandCreatorRollupRow[]> {
  if (contestIds.length === 0) return [];

  const CONTEST_ID_CHUNK = 500;
  const rows: BrandCreatorRollupRow[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc(
      "brand_analytics_pc_by_creator",
      {
        p_from: fromIso,
        p_to: toIso,
        p_contest_ids: idChunk,
      },
    );
    if (error) {
      if (isMissingRpcError(error)) {
        // Fall back to standard creator rollup on submissions if PC-specific RPC missing
        return fetchCreatorRollup(supabase, contestIds, fromIso, toIso);
      }
      throw new Error(`Failed to load PC creator rollup: ${error.message}`);
    }
    for (const row of (data ?? []) as BrandCreatorRollupRow[]) {
      rows.push({
        creator_id: String(row.creator_id),
        contest_type: String(row.contest_type ?? "unknown"),
        platform: String(row.platform ?? "unknown").toLowerCase(),
        status: String(row.status ?? "unknown").toLowerCase(),
        submission_count: Number(row.submission_count) || 0,
        views_sum: Number(row.views_sum) || 0,
        earnings_cents_sum: Number(row.earnings_cents_sum) || 0,
        first_created_at: row.first_created_at ?? null,
        last_created_at: row.last_created_at ?? null,
      });
    }
  }

  return rows;
}

function buildCacheKeyParts(
  prefix: string,
  ctx: BrandAnalyticsQueryContext,
): string[] {
  const contestIdsKey =
    ctx.contestIdSet === null
      ? "__all__"
      : ctx.contestIdSet.size === 0
        ? "__none__"
        : [...ctx.contestIdSet].sort().join(",");
  const typeKey =
    ctx.contestTypeSet === null
      ? "__all__"
      : ctx.contestTypeSet.size === 0
        ? "__none__"
        : [...ctx.contestTypeSet].sort().join(",");

  return [
    BRAND_ANALYTICS_CACHE_TAG,
    prefix,
    ctx.advertiserId,
    ctx.dataSource,
    ctx.dateFrom.toISOString(),
    ctx.dateTo.toISOString(),
    ctx.contentType,
    ctx.videoPlatform,
    ctx.tiktokAnalytics ? "1" : "0",
    ctx.twitterAnalytics ? "1" : "0",
    typeKey,
    contestIdsKey,
    ctx.notRejected ? "not_rejected" : (ctx.submissionStatus ?? "all"),
  ];
}

function serializeContext(ctx: BrandAnalyticsQueryContext): string {
  return JSON.stringify({
    ...ctx,
    dateFrom: ctx.dateFrom.toISOString(),
    dateTo: ctx.dateTo.toISOString(),
    contestTypeSet:
      ctx.contestTypeSet === null ? null : [...ctx.contestTypeSet],
    contestIdSet: ctx.contestIdSet === null ? null : [...ctx.contestIdSet],
  });
}

function deserializeContext(raw: string): BrandAnalyticsQueryContext {
  const parsed = JSON.parse(raw) as BrandAnalyticsQueryContext & {
    dateFrom: string;
    dateTo: string;
    contestTypeSet: string[] | null;
    contestIdSet: string[] | null;
  };
  return rehydrateBrandAnalyticsContext({
    ...parsed,
    dateFrom: new Date(parsed.dateFrom),
    dateTo: new Date(parsed.dateTo),
    contestTypeSet:
      parsed.contestTypeSet === null
        ? null
        : new Set(parsed.contestTypeSet),
    contestIdSet:
      parsed.contestIdSet === null ? null : new Set(parsed.contestIdSet),
  });
}

/** unstable_cache JSON round-trip turns Set fields into arrays. */
export function rehydrateBrandAnalyticsContext(
  ctx: BrandAnalyticsQueryContext,
): BrandAnalyticsQueryContext {
  const contestTypeSet =
    ctx.contestTypeSet === null
      ? null
      : ctx.contestTypeSet instanceof Set
        ? ctx.contestTypeSet
        : new Set(
            Array.isArray(ctx.contestTypeSet) ? ctx.contestTypeSet : [],
          );
  const contestIdSet =
    ctx.contestIdSet === null
      ? null
      : ctx.contestIdSet instanceof Set
        ? ctx.contestIdSet
        : new Set(Array.isArray(ctx.contestIdSet) ? ctx.contestIdSet : []);

  return {
    ...ctx,
    dateFrom:
      ctx.dateFrom instanceof Date ? ctx.dateFrom : new Date(ctx.dateFrom),
    dateTo: ctx.dateTo instanceof Date ? ctx.dateTo : new Date(ctx.dateTo),
    contestTypeSet,
    contestIdSet,
  };
}

function rehydrateBrandAnalyticsBundle(
  bundle: BrandAnalyticsBundle,
): BrandAnalyticsBundle {
  return {
    ...bundle,
    ctx: rehydrateBrandAnalyticsContext(bundle.ctx),
  };
}

function rehydrateBrandAnalyticsCreatorsBundle(
  bundle: BrandAnalyticsCreatorsBundle,
): BrandAnalyticsCreatorsBundle {
  return {
    ...rehydrateBrandAnalyticsBundle(bundle),
    creatorRollup: bundle.creatorRollup,
    twitterCreatorRollup: bundle.twitterCreatorRollup,
  };
}

export async function getCachedBrandAnalyticsBundle(
  ctx: BrandAnalyticsQueryContext,
): Promise<BrandAnalyticsBundle> {
  const keyParts = buildCacheKeyParts("core-v1", ctx);
  const serialized = serializeContext(ctx);
  const bundle = await unstable_cache(
    async () => loadBrandAnalyticsBundle(deserializeContext(serialized)),
    keyParts,
    {
      revalidate: BRAND_ANALYTICS_CACHE_SECONDS,
      tags: [BRAND_ANALYTICS_CACHE_TAG],
    },
  )();
  return rehydrateBrandAnalyticsBundle(bundle);
}

export async function getCachedBrandAnalyticsCreatorsBundle(
  ctx: BrandAnalyticsQueryContext,
): Promise<BrandAnalyticsCreatorsBundle> {
  const keyParts = buildCacheKeyParts("creators-v1", ctx);
  const serialized = serializeContext(ctx);
  const bundle = await unstable_cache(
    async () =>
      loadBrandAnalyticsCreatorsBundle(deserializeContext(serialized)),
    keyParts,
    {
      revalidate: BRAND_ANALYTICS_CACHE_SECONDS,
      tags: [BRAND_ANALYTICS_CACHE_TAG],
    },
  )();
  return rehydrateBrandAnalyticsCreatorsBundle(bundle);
}

export function contestTotalsFromRollup(
  contestId: string,
  rollup: BrandContestRollupRow[],
  ctx: BrandAnalyticsQueryContext,
): {
  submissions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  payoutsCents: number;
} {
  let submissions = 0;
  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let payoutsCents = 0;

  for (const row of rollup) {
    if (row.contest_id !== contestId) continue;
    if (!statusMatchesFilter(row.status, ctx)) continue;
    submissions += row.submission_count;
    views += row.views_sum;
    likes += row.likes_sum;
    comments += row.comments_sum;
    shares += row.shares_sum;
    payoutsCents += row.payouts_cents_sum;
  }

  return { submissions, views, likes, comments, shares, payoutsCents };
}

export function twitterContestTotalsFromRollup(
  contestId: string,
  rollup: BrandTwitterContestRow[],
  ctx: BrandAnalyticsQueryContext,
): {
  submissions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  quoteReposts: number;
} {
  let submissions = 0;
  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let quoteReposts = 0;

  for (const row of rollup) {
    if (row.contest_id !== contestId) continue;
    if (!statusMatchesFilter(row.status, ctx)) continue;
    submissions += row.submission_count;
    views += row.views_sum;
    likes += row.likes_sum;
    comments += row.comments_sum;
    shares += row.shares_sum;
    quoteReposts += row.quote_reposts_sum;
  }

  return { submissions, views, likes, comments, shares, quoteReposts };
}

export function sumDailyRows(
  rows: AdminAnalyticsDailySqlRow[],
  ctx: BrandAnalyticsQueryContext,
  options?: { allStatuses?: boolean },
): {
  submissions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  payoutsCents: number;
} {
  let submissions = 0;
  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let payoutsCents = 0;

  for (const row of rows) {
    const st = normalizeSubmissionStatus(row.status);
    if (st === "unknown") continue;
    if (!options?.allStatuses && !statusMatchesFilter(row.status, ctx)) {
      continue;
    }
    submissions += Number(row.submission_count) || 0;
    views += Number(row.views_sum) || 0;
    likes += Number(row.likes_sum) || 0;
    comments += Number(row.comments_sum) || 0;
    shares += Number(row.shares_sum) || 0;
    payoutsCents += Number(row.payouts_cents_sum) || 0;
  }

  return { submissions, views, likes, comments, shares, payoutsCents };
}

export function sumTwitterDailyRows(
  rows: BrandTwitterDailyRow[],
  ctx: BrandAnalyticsQueryContext,
  options?: { allStatuses?: boolean },
): {
  submissions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  quoteReposts: number;
} {
  let submissions = 0;
  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let quoteReposts = 0;

  for (const row of rows) {
    const st = normalizeSubmissionStatus(row.status);
    if (st === "unknown") continue;
    if (!options?.allStatuses && !statusMatchesFilter(row.status, ctx)) {
      continue;
    }
    submissions += row.submission_count;
    views += row.views_sum;
    likes += row.likes_sum;
    comments += row.comments_sum;
    shares += row.shares_sum;
    quoteReposts += row.quote_reposts_sum;
  }

  return { submissions, views, likes, comments, shares, quoteReposts };
}

export function countByStatusFromDaily(
  rows: AdminAnalyticsDailySqlRow[],
  twitterRows: BrandTwitterDailyRow[],
): {
  verified: number;
  paid: number;
  pending: number;
  rejected: number;
} {
  const counts = { verified: 0, paid: 0, pending: 0, rejected: 0 };
  for (const row of rows) {
    const st = normalizeSubmissionStatus(row.status);
    const count = Number(row.submission_count) || 0;
    if (st === "verified") counts.verified += count;
    else if (st === "paid") counts.paid += count;
    else if (st === "pending") counts.pending += count;
    else if (st === "rejected") counts.rejected += count;
  }
  for (const row of twitterRows) {
    const st = normalizeSubmissionStatus(row.status);
    if (st === "verified") counts.verified += row.submission_count;
    else if (st === "paid") counts.paid += row.submission_count;
    else if (st === "pending") counts.pending += row.submission_count;
    else if (st === "rejected") counts.rejected += row.submission_count;
  }
  return counts;
}

export function countByStatusFiltered(
  rows: AdminAnalyticsDailySqlRow[],
  twitterRows: BrandTwitterDailyRow[],
  ctx: BrandAnalyticsQueryContext,
): {
  verified: number;
  paid: number;
  pending: number;
  rejected: number;
} {
  const counts = { verified: 0, paid: 0, pending: 0, rejected: 0 };
  for (const row of rows) {
    if (!statusMatchesFilter(row.status, ctx)) continue;
    const st = normalizeSubmissionStatus(row.status);
    const count = Number(row.submission_count) || 0;
    if (st === "verified") counts.verified += count;
    else if (st === "paid") counts.paid += count;
    else if (st === "pending") counts.pending += count;
    else if (st === "rejected") counts.rejected += count;
  }
  for (const row of twitterRows) {
    if (!statusMatchesFilter(row.status, ctx)) continue;
    const st = normalizeSubmissionStatus(row.status);
    if (st === "verified") counts.verified += row.submission_count;
    else if (st === "paid") counts.paid += row.submission_count;
    else if (st === "pending") counts.pending += row.submission_count;
    else if (st === "rejected") counts.rejected += row.submission_count;
  }
  return counts;
}

export { normalizeAnalyticsPlatform };
