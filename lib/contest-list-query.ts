import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONTEST_LIST_SORT_OPTIONS,
  OPPORTUNITIES_SORT_OPTIONS,
  PAGE_SIZE_OPTIONS,
  type ContestFormatFilterOption,
  type ContestListSortOption,
  type ContestTypeFilterOption,
  type BrandPostPhaseFilterOption,
  type OpportunitiesSortOption,
  type CampaignListTabCounts,
  type CampaignListTabId,
  type PostPhaseCounts,
  SSR_CAMPAIGN_LIST_DEFAULTS,
} from "@/lib/campaign-list-filters-storage";
import type { ContestListCardStats } from "@/lib/contest-list-card-stats";
import { enrichContestWithCalculatedBudgets } from "@/lib/contest-service";

export { sortCampaignsForList } from "@/lib/contest-list-sort";
export {
  SSR_CAMPAIGN_LIST_DEFAULTS,
  type CampaignListTabCounts,
  type CampaignListTabId,
  type PostPhaseCounts,
};

/**
 * Filter in SQL → sort → paginate (campaign_list_page_ids + hydrate).
 * Tab counts use a grouped SQL RPC. Stats read from contest_stats via embed.
 */

export type OpportunitiesStatusTab = "all" | "live" | "upcoming" | "ended";

export type LightweightContest = {
  id: string;
  advertiser_id?: string;
  title?: string | null;
  platform?: string | null;
  contest_type?: string | null;
  contest_format?: string | null;
  content_type?: string | null;
  moderation_status?: string | null;
  status?: string | null;
  post_contest_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  live_submission_count?: number | null;
  contest_based_details?: Record<string, unknown> | null;
  last_metrics_updated?: string | null;
  region?: Record<string, string[]> | null;
  advertiser_profiles?: { company_name?: string } | null;
  contest_stats?:
    | {
        not_rejected_views?: number | null;
        verified_submission_count?: number | null;
        pending_submission_count?: number | null;
        rejected_submission_count?: number | null;
      }
    | Array<{
        not_rejected_views?: number | null;
        verified_submission_count?: number | null;
        pending_submission_count?: number | null;
        rejected_submission_count?: number | null;
      }>
    | null;
  [key: string]: unknown;
};

export type ContestWithStats = LightweightContest & ContestListCardStats;

const STATS_EMBED =
  "contest_stats(not_rejected_views, verified_submission_count, pending_submission_count, rejected_submission_count)";

const DEFAULT_SELECT =
  "id, advertiser_id, title, platform, contest_type, contest_format, content_type, moderation_status, status, post_contest_status, start_date, end_date, created_at, live_submission_count, contest_based_details, last_metrics_updated, thumbnail_url, brief_html, resources, category, inspiration_links, tracking_links, updated_at, payment_details, views_locked_at, multiple_submissions_enabled, max_submissions_per_creator, bonus_details, max_earnings_per_creator, categories, subcategories, interests, region, published_at, submitted_for_approval_at, approved_at, rejection_reason, trust_score, trust_number, min_avg_quality_score, min_best_quality_score, min_quality_score, min_platform_earnings, min_platform_views";

const SELECT_WITH_STATS = `${DEFAULT_SELECT}, ${STATS_EMBED}`;
const SELECT_WITH_ADVERTISER_STATS = `${DEFAULT_SELECT}, advertiser_profiles!advertiser_id(company_name), ${STATS_EMBED}`;

/** All supported list sorts paginate in SQL via campaign_list_page_ids. */
const SQL_SORTABLE = new Set<string>([
  ...CONTEST_LIST_SORT_OPTIONS,
  ...OPPORTUNITIES_SORT_OPTIONS,
]);

/**
 * Sorts PostgREST can approximate without campaign_list_page_ids.
 * Budget/value/approval/CPM/relevance need the SQL RPC — never silently remap.
 */
const POSTGREST_SAFE_SORTS = new Set<string>([
  "created_at_desc",
  "created_at_asc",
  "start_date_desc",
  "start_date_asc",
  "end_date_desc",
  "end_date_asc",
  "views_desc",
  "views_asc",
  "submissions_desc",
  "submissions_asc",
]);

export type ListCampaignsParams = {
  supabase: SupabaseClient;
  scope: "advertiser" | "admin" | "opportunities";
  advertiserId?: string;
  tab?: CampaignListTabId | OpportunitiesStatusTab;
  sort: ContestListSortOption | OpportunitiesSortOption;
  page: number;
  limit: number;
  platform?: string;
  contestType?: ContestTypeFilterOption | string;
  contestFormat?: ContestFormatFilterOption | string;
  postContestPhase?: BrandPostPhaseFilterOption | string;
  search?: string;
  mediaType?: "all" | "text" | "media";
  userCountries?: string[];
};

export type ListCampaignsResult = {
  contests: Array<
    ContestWithStats & {
      advertiser_name?: string;
      contest_based_details: Record<string, unknown> | null;
    }
  >;
  total: number;
  page: number;
  limit: number;
  tabCounts: CampaignListTabCounts;
  postPhaseCounts: PostPhaseCounts;
  availablePlatforms: string[];
};

function isContestListSort(
  sort: string,
): sort is ContestListSortOption {
  return (CONTEST_LIST_SORT_OPTIONS as readonly string[]).includes(sort);
}

function isOpportunitiesSort(
  sort: string,
): sort is OpportunitiesSortOption {
  return (OPPORTUNITIES_SORT_OPTIONS as readonly string[]).includes(sort);
}

export function parseListPage(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function parseListLimit(raw: string | null | undefined): number {
  const n = Number(raw);
  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n;
  return 9;
}

export function parseContestListSort(
  raw: string | null | undefined,
): ContestListSortOption {
  if (raw && isContestListSort(raw)) return raw;
  return "created_at_desc";
}

export function parseOpportunitiesSort(
  raw: string | null | undefined,
): OpportunitiesSortOption {
  if (raw && isOpportunitiesSort(raw)) return raw;
  return "relevance_desc";
}

const MEDIA_TYPES = new Set(["all", "text", "media"]);

export function parseOpportunitiesMediaType(
  raw: string | null | undefined,
): "all" | "text" | "media" {
  if (raw && MEDIA_TYPES.has(raw)) {
    return raw as "all" | "text" | "media";
  }
  return "all";
}

function emptyTabCounts(): CampaignListTabCounts {
  return {
    all: 0,
    draft: 0,
    pending_approval: 0,
    ready: 0,
    upcoming: 0,
    live: 0,
    ended: 0,
    rejected: 0,
  };
}

function emptyPostPhaseCounts(): PostPhaseCounts {
  return {
    post_pending_review: 0,
    post_in_review: 0,
    post_payment_pending: 0,
    post_paid: 0,
  };
}

function flattenContestStats(
  contest: LightweightContest,
): ContestWithStats {
  const embedded = contest.contest_stats;
  const stats = Array.isArray(embedded) ? embedded[0] : embedded;

  const { contest_stats: _drop, ...rest } = contest;
  return {
    ...rest,
    verified_submission_count: Number(stats?.verified_submission_count) || 0,
    pending_submission_count: Number(stats?.pending_submission_count) || 0,
    rejected_submission_count: Number(stats?.rejected_submission_count) || 0,
    not_rejected_views: Number(stats?.not_rejected_views) || 0,
    last_metrics_updated: contest.last_metrics_updated ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterableQuery = any;

function applyContestFormatFilter(
  query: FilterableQuery,
  contestFormat: string | undefined,
): FilterableQuery {
  if (!contestFormat || contestFormat === "all") return query;
  if (contestFormat === "video") {
    return query.eq("contest_format", "video");
  }
  // Do not treat null/empty format as text_image (would mis-bucket unknown rows).
  return query.in("contest_format", [
    "text_image",
    "text-image",
    "text",
    "image",
  ]);
}

function applyTabFilter(
  query: FilterableQuery,
  tab: string,
  scope: ListCampaignsParams["scope"],
): FilterableQuery {
  if (scope === "opportunities") {
    if (tab === "live") return query.eq("status", "active");
    if (tab === "upcoming") return query.eq("status", "upcoming");
    if (tab === "ended") return query.eq("status", "ended");
    return query.not("status", "is", null);
  }

  switch (tab) {
    case "draft":
      return query.eq("moderation_status", "draft");
    case "pending_approval":
      return query.eq("moderation_status", "pending_approval");
    case "ready":
      return query.eq("moderation_status", "approved");
    case "live":
      return query.eq("moderation_status", "published").eq("status", "active");
    case "upcoming":
      return query
        .eq("moderation_status", "published")
        .eq("status", "upcoming");
    case "ended":
      return query.eq("moderation_status", "published").eq("status", "ended");
    case "rejected":
      return query.eq("moderation_status", "rejected");
    default:
      return query;
  }
}

function applyPostPhaseFilter(
  query: FilterableQuery,
  phase: string | undefined,
  tab: string,
): FilterableQuery {
  if (!phase || phase === "all" || (tab !== "all" && tab !== "ended")) {
    return query;
  }

  let q = query;
  if (tab === "all") {
    q = q.eq("moderation_status", "published").eq("status", "ended");
  }

  switch (phase) {
    case "post_pending_review":
      // null / pending_review / unknown — anything except the later phases
      return q.or(
        "post_contest_status.is.null,post_contest_status.eq.pending_review,post_contest_status.not.in.(in_review,verification_complete,payouts_processed)",
      );
    case "post_in_review":
      return q.eq("post_contest_status", "in_review");
    case "post_payment_pending":
      return q.eq("post_contest_status", "verification_complete");
    case "post_paid":
      return q.eq("post_contest_status", "payouts_processed");
    default:
      return q;
  }
}

function applySqlOrder(
  query: FilterableQuery,
  sort: string,
): FilterableQuery {
  switch (sort) {
    case "created_at_asc":
      return query.order("created_at", { ascending: true });
    case "start_date_desc":
      return query.order("start_date", {
        ascending: false,
        nullsFirst: false,
      });
    case "start_date_asc":
      return query.order("start_date", { ascending: true, nullsFirst: false });
    case "end_date_desc":
      return query.order("end_date", { ascending: false, nullsFirst: false });
    case "end_date_asc":
      return query.order("end_date", { ascending: true, nullsFirst: false });
    case "views_desc":
      return query.order("not_rejected_views", {
        ascending: false,
        foreignTable: "contest_stats",
        nullsFirst: false,
      });
    case "views_asc":
      return query.order("not_rejected_views", {
        ascending: true,
        foreignTable: "contest_stats",
        nullsFirst: false,
      });
    case "submissions_desc":
      return query.order("live_submission_count", {
        ascending: false,
        nullsFirst: false,
      });
    case "submissions_asc":
      return query.order("live_submission_count", {
        ascending: true,
        nullsFirst: false,
      });
    case "relevance_desc":
      // Fallback only: true live→upcoming→ended ranking requires campaign_list_page_ids.
      return query
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
    case "created_at_desc":
    default:
      return query.order("created_at", { ascending: false });
  }
}

function assertAdvertiserScoped(params: ListCampaignsParams): void {
  if (params.scope === "advertiser" && !params.advertiserId) {
    throw new Error(
      "Advertiser campaign list requires advertiserId (fail closed)",
    );
  }
}

function applyListFilters(
  query: FilterableQuery,
  params: ListCampaignsParams,
): FilterableQuery {
  let q = query;

  assertAdvertiserScoped(params);
  if (params.scope === "advertiser") {
    q = q.eq("advertiser_id", params.advertiserId as string);
  }

  if (params.scope === "opportunities") {
    q = q.eq("moderation_status", "published");
  }

  q = applyContestFormatFilter(q, params.contestFormat);

  const tab = params.tab || "all";
  q = applyTabFilter(q, tab, params.scope);
  q = applyPostPhaseFilter(q, params.postContestPhase, tab);

  if (params.platform && params.platform !== "all") {
    q = q.eq("platform", params.platform);
  }

  if (params.contestType && params.contestType !== "all") {
    q = q.eq("contest_type", params.contestType);
  }

  if (params.search?.trim()) {
    q = q.ilike("title", `%${params.search.trim()}%`);
  }

  // Parity with opportunities client: text = text_image, media = video only.
  if (params.scope === "opportunities" && params.mediaType === "text") {
    q = q.eq("contest_format", "text_image");
  }

  if (params.scope === "opportunities" && params.mediaType === "media") {
    q = q.eq("contest_format", "video");
  }

  return q;
}

function isRpcAuthzError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42501") return true;
  const msg = error.message || "";
  return /authentication required|admin access required|permission denied|invalid campaign list scope/i.test(
    msg,
  );
}

async function fetchTabCountsFromRpc(
  supabase: SupabaseClient,
  params: ListCampaignsParams,
): Promise<{
  tabCounts: CampaignListTabCounts;
  postPhaseCounts: PostPhaseCounts;
  availablePlatforms: string[];
} | null> {
  const { data, error } = await supabase.rpc("campaign_list_tab_counts", {
    p_scope: params.scope,
    p_advertiser_id:
      params.scope === "advertiser" ? params.advertiserId ?? null : null,
    p_contest_format: params.contestFormat || "all",
    p_user_countries:
      params.scope === "opportunities" ? params.userCountries ?? null : null,
  });

  if (error || !data) {
    if (isRpcAuthzError(error)) {
      console.error(
        "[contest-list-query] tab counts RPC authz failed:",
        error?.message,
      );
      throw new Error(error?.message || "Forbidden");
    }
    console.warn("[contest-list-query] tab counts RPC failed:", error?.message);
    return null;
  }

  const payload = data as {
    tabCounts?: CampaignListTabCounts;
    postPhaseCounts?: PostPhaseCounts;
    availablePlatforms?: string[];
  };

  return {
    tabCounts: { ...emptyTabCounts(), ...payload.tabCounts },
    postPhaseCounts: {
      ...emptyPostPhaseCounts(),
      ...payload.postPhaseCounts,
    },
    availablePlatforms: Array.isArray(payload.availablePlatforms)
      ? payload.availablePlatforms
      : ["all"],
  };
}

async function fetchFilteredPageSql(
  supabase: SupabaseClient,
  params: ListCampaignsParams,
  offset: number,
  limit: number,
): Promise<{ rows: LightweightContest[]; total: number }> {
  const { data: pagePayload, error: pageError } = await supabase.rpc(
    "campaign_list_page_ids",
    {
      p_scope: params.scope,
      p_advertiser_id:
        params.scope === "advertiser" ? params.advertiserId ?? null : null,
      p_tab: params.tab || "all",
      p_sort: params.sort,
      p_offset: offset,
      p_limit: limit,
      p_platform: params.platform || "all",
      p_contest_type: params.contestType || "all",
      p_contest_format: params.contestFormat || "all",
      p_post_contest_phase: params.postContestPhase || "all",
      p_search: params.search || "",
      p_media_type: params.mediaType || "all",
      p_user_countries:
        params.scope === "opportunities" ? params.userCountries ?? null : null,
    },
  );

  if (pageError || !pagePayload) {
    if (isRpcAuthzError(pageError)) {
      console.error(
        "[contest-list-query] page ids RPC authz failed:",
        pageError?.message,
      );
      throw new Error(pageError?.message || "Forbidden");
    }
    if (!POSTGREST_SAFE_SORTS.has(params.sort)) {
      console.error(
        "[contest-list-query] campaign_list_page_ids unavailable for sort:",
        params.sort,
        pageError?.message,
      );
      throw new Error(
        "Campaign list pagination RPC unavailable. Apply db/migrations/20260731_campaign_list_page_ids.sql",
      );
    }
    console.warn(
      "[contest-list-query] page ids RPC failed, falling back to PostgREST range:",
      pageError?.message,
    );
    return fetchFilteredPageViaPostgrest(supabase, params, offset, limit);
  }

  const payload = pagePayload as { total?: number; ids?: string[] };
  const ids = Array.isArray(payload.ids) ? payload.ids.filter(Boolean) : [];
  const total = Number(payload.total) || 0;

  if (ids.length === 0) {
    return { rows: [], total };
  }

  const selectClause =
    params.scope === "admin" ? SELECT_WITH_ADVERTISER_STATS : SELECT_WITH_STATS;

  // Dynamic select strings are not in generated Database types.
  const { data, error } = await (supabase
    .from("contests_with_status")
    .select(selectClause)
    .in("id", ids) as FilterableQuery);

  if (error) {
    console.error("[contest-list-query] page hydrate failed:", error.message);
    throw new Error(`Campaign list hydrate failed: ${error.message}`);
  }

  const byId = new Map(
    ((data || []) as LightweightContest[]).map((row) => [row.id, row]),
  );
  const rows = ids
    .map((id) => byId.get(id))
    .filter((row): row is LightweightContest => Boolean(row));

  // Partial hydrate (RLS / race) — keep RPC total so pagination stays honest.
  if (rows.length === 0 && ids.length > 0) {
    console.warn(
      "[contest-list-query] hydrate returned no rows for page ids (RLS or stale ids)",
    );
    return { rows: [], total };
  }

  return { rows, total };
}

/**
 * Resolve opportunity-visible contest IDs via SQL (auth.uid countries).
 * Always call for opportunities — empty countries must still exclude geo-locked rows.
 */
async function resolveOpportunityRegionIds(
  supabase: SupabaseClient,
  userCountries: string[] | undefined,
): Promise<string[]> {
  const { data, error: regionError } = await supabase.rpc(
    "contest_ids_matching_user_countries",
    { p_countries: userCountries ?? [] },
  );
  if (regionError) {
    console.error(
      "[contest-list-query] region ids failed:",
      regionError.message,
    );
    throw new Error(`Opportunity region filter failed: ${regionError.message}`);
  }
  return (data as string[] | null) || [];
}

/** Legacy PostgREST range path when campaign_list_page_ids is unavailable. */
async function fetchFilteredPageViaPostgrest(
  supabase: SupabaseClient,
  params: ListCampaignsParams,
  offset: number,
  limit: number,
): Promise<{ rows: LightweightContest[]; total: number }> {
  assertAdvertiserScoped(params);

  let regionIds: string[] | null = null;
  if (params.scope === "opportunities") {
    regionIds = await resolveOpportunityRegionIds(
      supabase,
      params.userCountries,
    );
    if (regionIds.length === 0) return { rows: [], total: 0 };
  }

  let countQuery = applyListFilters(
    supabase.from("contests_with_status").select("id", {
      count: "exact",
      head: true,
    }),
    params,
  );
  if (regionIds) countQuery = countQuery.in("id", regionIds);

  const { count, error: countError } = await countQuery;

  if (countError) {
    console.error("[contest-list-query] count failed:", countError.message);
    throw new Error(`Campaign list count failed: ${countError.message}`);
  }

  const selectClause =
    params.scope === "admin" ? SELECT_WITH_ADVERTISER_STATS : SELECT_WITH_STATS;

  let dataQuery = applyListFilters(
    supabase.from("contests_with_status").select(selectClause),
    params,
  );
  if (regionIds) dataQuery = dataQuery.in("id", regionIds);

  dataQuery = applySqlOrder(dataQuery, params.sort);
  const { data, error } = await dataQuery.range(offset, offset + limit - 1);

  if (error) {
    console.error("[contest-list-query] page fetch failed:", error.message);
    throw new Error(`Campaign list page fetch failed: ${error.message}`);
  }

  return { rows: (data || []) as LightweightContest[], total: count ?? 0 };
}

/**
 * List campaigns with SQL filter → sort → paginate. Tab counts via grouped RPC.
 *
 * Budget/value sorts use stored contest_based_details / contest_stats (SQL helpers).
 * Card enrichment may recompute live spend for display — order follows stored metrics.
 */
export async function listCampaignsPaginated(
  params: ListCampaignsParams,
): Promise<ListCampaignsResult> {
  assertAdvertiserScoped(params);

  const page = Math.max(1, params.page || 1);
  const limit = parseListLimit(String(params.limit));
  const offset = (page - 1) * limit;

  const countsPromise = fetchTabCountsFromRpc(params.supabase, params);

  // All known sorts are SQL-backed. Unknown sorts still use the page RPC with
  // created_at_desc fallback inside campaign_list_page_ids.
  const sortForSql = SQL_SORTABLE.has(params.sort)
    ? params.sort
    : params.scope === "opportunities"
      ? "relevance_desc"
      : "created_at_desc";

  const { rows, total: sqlTotal } = await fetchFilteredPageSql(
    params.supabase,
    { ...params, sort: sortForSql as ListCampaignsParams["sort"] },
    offset,
    limit,
  );
  const total = sqlTotal;
  const pageRows = rows.map((row) => flattenContestStats(row));

  const countsFromRpc = await countsPromise;
  if (!countsFromRpc) {
    console.error(
      "[contest-list-query] campaign_list_tab_counts unavailable; apply db/migrations/20260730_campaign_list_query.sql (not loading full campaign set)",
    );
  }
  const tabCounts = countsFromRpc?.tabCounts ?? emptyTabCounts();
  const postPhaseCounts =
    countsFromRpc?.postPhaseCounts ?? emptyPostPhaseCounts();
  const availablePlatforms = countsFromRpc?.availablePlatforms ?? ["all"];

  // Keep full availablePlatforms from tab-counts RPC.
  // Never shrink the dropdown to the current page when a platform filter is on.

  // Budget trackers need live budget_spent (stored JSON is often 0 until
  // metrics refresh). Enrich only this page — not the full campaign set —
  // so tab switches stay fast while cards show real spend.
  // Note: list order still follows SQL stored-metric sort keys above.
  const enrichedPage = await Promise.all(
    pageRows.map(async (contest) => {
      const withBudget = await enrichContestWithCalculatedBudgets(
        {
          ...contest,
          contest_based_details:
            (contest.contest_based_details as Record<string, unknown> | null) ??
            {},
        },
        params.supabase,
      );

      return {
        ...contest,
        ...withBudget,
        // Keep list-card stats from contest_stats embed (do not lose them).
        not_rejected_views: contest.not_rejected_views,
        verified_submission_count: contest.verified_submission_count,
        pending_submission_count: contest.pending_submission_count,
        rejected_submission_count: contest.rejected_submission_count,
        contest_based_details:
          (withBudget.contest_based_details as Record<string, unknown> | null) ??
          null,
        advertiser_name:
          (
            contest as {
              advertiser_profiles?: { company_name?: string };
            }
          ).advertiser_profiles?.company_name || undefined,
      };
    }),
  );

  return {
    contests: enrichedPage as ListCampaignsResult["contests"],
    total,
    page,
    limit,
    tabCounts,
    postPhaseCounts,
    availablePlatforms,
  };
}
