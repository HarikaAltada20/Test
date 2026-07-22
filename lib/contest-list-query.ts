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
} from "@/lib/campaign-list-filters-storage";
import { enrichContestWithCalculatedBudgets } from "@/lib/contest-service";
import {
  enrichContestsWithListCardStats,
  type ContestListCardStats,
} from "@/lib/contest-list-card-stats";
import { sortCampaignsForList } from "@/lib/contest-list-sort";
import { isCountryInContestRegions } from "@/lib/region-utils";

export { sortCampaignsForList } from "@/lib/contest-list-sort";

/**
 * CRITICAL: Always filter → sort (full matching set) → then paginate.
 * Never sort only the current page — that breaks views/highest-views order
 * under lazy loading.
 */

export type CampaignListTabId =
  | "all"
  | "draft"
  | "pending_approval"
  | "ready"
  | "upcoming"
  | "live"
  | "ended"
  | "rejected";

export type OpportunitiesStatusTab = "all" | "live" | "upcoming" | "ended";

export type CampaignListTabCounts = Record<CampaignListTabId, number>;

export type PostPhaseCounts = {
  post_pending_review: number;
  post_in_review: number;
  post_payment_pending: number;
  post_paid: number;
};

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
  advertiser_profiles?: { company_name?: string } | null;
  [key: string]: unknown;
};

export type ContestWithStats = LightweightContest & ContestListCardStats;

const KNOWN_POST_CONTEST_STATUSES = new Set([
  "pending_review",
  "in_review",
  "verification_complete",
  "payments_processed",
]);

const DEFAULT_SELECT =
  "id, advertiser_id, title, platform, contest_type, contest_format, content_type, moderation_status, status, post_contest_status, start_date, end_date, created_at, live_submission_count, contest_based_details, last_metrics_updated, thumbnail_url, brief_html, resources, category, inspiration_links, tracking_links, updated_at, payment_details, views_locked_at, multiple_submissions_enabled, max_submissions_per_creator, bonus_details, max_earnings_per_creator, categories, subcategories, interests, region, published_at, submitted_for_approval_at, approved_at, rejection_reason, trust_score, trust_number, min_avg_quality_score, min_best_quality_score, min_quality_score, min_platform_earnings, min_platform_views";

const SELECT_WITH_ADVERTISER = `${DEFAULT_SELECT}, advertiser_profiles!advertiser_id(company_name)`;

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
  /** Opportunities-only: text vs media (Twitter text_image). */
  mediaType?: "all" | "text" | "media";
  /** Creator countries for region filtering (opportunities). */
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

function contestMatchesPostPhase(
  c: LightweightContest,
  phase: Exclude<BrandPostPhaseFilterOption, "all">,
): boolean {
  if (c.moderation_status !== "published" || c.status !== "ended") {
    return false;
  }
  const s = c.post_contest_status ?? "";
  switch (phase) {
    case "post_pending_review":
      return (
        !s ||
        !KNOWN_POST_CONTEST_STATUSES.has(s) ||
        s === "pending_review"
      );
    case "post_in_review":
      return s === "in_review";
    case "post_payment_pending":
      return s === "verification_complete";
    case "post_paid":
      return s === "payments_processed";
    default:
      return false;
  }
}

function matchesTab(
  c: LightweightContest,
  tab: string,
  scope: ListCampaignsParams["scope"],
): boolean {
  if (scope === "opportunities") {
    if (c.moderation_status !== "published") return false;
    if (tab === "all") return Boolean(c.status);
    if (tab === "live") return c.status === "active";
    if (tab === "upcoming") return c.status === "upcoming";
    if (tab === "ended") return c.status === "ended";
    return true;
  }

  switch (tab) {
    case "all":
      return true;
    case "draft":
      return c.moderation_status === "draft";
    case "pending_approval":
      return c.moderation_status === "pending_approval";
    case "ready":
      return c.moderation_status === "approved";
    case "live":
      return c.moderation_status === "published" && c.status === "active";
    case "upcoming":
      return c.moderation_status === "published" && c.status === "upcoming";
    case "ended":
      return c.moderation_status === "published" && c.status === "ended";
    case "rejected":
      return c.moderation_status === "rejected";
    default:
      return true;
  }
}

function matchesFormat(
  c: LightweightContest,
  format: string | undefined,
): boolean {
  if (!format || format === "all") return true;
  const fmt = (c.contest_format || "").toLowerCase();
  if (format === "text_image") {
    return (
      fmt === "text_image" ||
      fmt === "text-image" ||
      fmt === "text" ||
      fmt === "image" ||
      fmt === ""
    );
  }
  if (format === "video") {
    return fmt === "video";
  }
  return true;
}

function matchesMediaType(
  c: LightweightContest,
  mediaType: string | undefined,
): boolean {
  if (!mediaType || mediaType === "all") return true;
  const isTextImage =
    c.contest_format === "text_image" || c.content_type === "text_image";
  if (mediaType === "text") return isTextImage;
  if (mediaType === "media") return !isTextImage;
  return true;
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

function computeTabCounts(
  contests: LightweightContest[],
  scope: ListCampaignsParams["scope"],
): CampaignListTabCounts {
  const counts = emptyTabCounts();
  for (const c of contests) {
    counts.all += 1;
    if (scope === "opportunities") {
      if (c.moderation_status !== "published") continue;
      if (c.status === "active") counts.live += 1;
      else if (c.status === "upcoming") counts.upcoming += 1;
      else if (c.status === "ended") counts.ended += 1;
      continue;
    }
    if (c.moderation_status === "draft") counts.draft += 1;
    else if (c.moderation_status === "pending_approval")
      counts.pending_approval += 1;
    else if (c.moderation_status === "approved") counts.ready += 1;
    else if (c.moderation_status === "rejected") counts.rejected += 1;
    else if (c.moderation_status === "published") {
      if (c.status === "active") counts.live += 1;
      else if (c.status === "upcoming") counts.upcoming += 1;
      else if (c.status === "ended") counts.ended += 1;
    }
  }
  return counts;
}

function computePostPhaseCounts(contests: LightweightContest[]): PostPhaseCounts {
  const ended = contests.filter(
    (c) => c.moderation_status === "published" && c.status === "ended",
  );
  return {
    post_pending_review: ended.filter((c) =>
      contestMatchesPostPhase(c, "post_pending_review"),
    ).length,
    post_in_review: ended.filter((c) =>
      contestMatchesPostPhase(c, "post_in_review"),
    ).length,
    post_payment_pending: ended.filter((c) =>
      contestMatchesPostPhase(c, "post_payment_pending"),
    ).length,
    post_paid: ended.filter((c) =>
      contestMatchesPostPhase(c, "post_paid"),
    ).length,
  };
}

async function fetchLightweightContests(
  supabase: SupabaseClient,
  params: Pick<
    ListCampaignsParams,
    "scope" | "advertiserId"
  >,
): Promise<LightweightContest[]> {
  const selectClause =
    params.scope === "admin" ? SELECT_WITH_ADVERTISER : DEFAULT_SELECT;

  let query = supabase
    .from("contests_with_status")
    .select(selectClause)
    .order("created_at", { ascending: false });

  if (params.scope === "advertiser" && params.advertiserId) {
    query = query.eq("advertiser_id", params.advertiserId);
  }

  if (params.scope === "opportunities") {
    query = query.eq("moderation_status", "published");
  }

  // Page through PostgREST max rows so admin lists stay complete for sorting.
  const PAGE = 1000;
  const all: LightweightContest[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) {
      console.error("[contest-list-query] fetch failed:", error.message);
      break;
    }
    const rows = (data || []) as unknown as LightweightContest[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

async function attachListCardStats(
  contests: LightweightContest[],
): Promise<ContestWithStats[]> {
  if (contests.length === 0) return [];
  const enriched = await enrichContestsWithListCardStats(contests);
  return enriched as ContestWithStats[];
}

/**
 * List campaigns with server-side filter → sort (full set) → paginate → enrich page.
 * Views sort uses contest_stats across ALL matching campaigns, not just the page.
 */
export async function listCampaignsPaginated(
  params: ListCampaignsParams,
): Promise<ListCampaignsResult> {
  const page = Math.max(1, params.page || 1);
  const limit = parseListLimit(String(params.limit));
  const tab = params.tab || "all";

  const lightweight = await fetchLightweightContests(params.supabase, params);

  // Format filter applies to tab counts (same as previous client behavior).
  const formatFiltered = lightweight.filter((c) =>
    matchesFormat(c, params.contestFormat),
  );

  const tabCounts = computeTabCounts(formatFiltered, params.scope);
  const postPhaseCounts = computePostPhaseCounts(formatFiltered);

  let filtered = formatFiltered.filter((c) =>
    matchesTab(c, tab, params.scope),
  );

  if (
    params.postContestPhase &&
    params.postContestPhase !== "all" &&
    (tab === "all" || tab === "ended")
  ) {
    filtered = filtered.filter((c) =>
      contestMatchesPostPhase(
        c,
        params.postContestPhase as Exclude<BrandPostPhaseFilterOption, "all">,
      ),
    );
  }

  if (params.platform && params.platform !== "all") {
    filtered = filtered.filter((c) => c.platform === params.platform);
  }

  if (params.contestType && params.contestType !== "all") {
    filtered = filtered.filter((c) => c.contest_type === params.contestType);
  }

  if (params.search?.trim()) {
    const term = params.search.trim().toLowerCase();
    filtered = filtered.filter((c) =>
      (c.title || "").toLowerCase().includes(term),
    );
  }

  if (params.scope === "opportunities") {
    filtered = filtered.filter((c) => matchesMediaType(c, params.mediaType));
  }

  if (params.userCountries && params.userCountries.length > 0) {
    const countries = params.userCountries;
    filtered = filtered.filter((c) => {
      const region = c.region as Record<string, string[]> | null | undefined;
      if (!region || Object.keys(region).length === 0) return true;
      return countries.some((country) =>
        isCountryInContestRegions(country, region),
      );
    });
  }

  const platforms = new Set(
    filtered.map((c) => c.platform).filter(Boolean) as string[],
  );

  // Attach stats for the FULL filtered set before sorting (views/approval/submissions).
  const withStats = await attachListCardStats(filtered);
  const sorted = sortCampaignsForList(withStats, params.sort);

  const total = sorted.length;
  const offset = (page - 1) * limit;
  const pageRows = sorted.slice(offset, offset + limit);

  // Heavy budget enrichment only for the current page.
  const enrichedPage = await Promise.all(
    pageRows.map(async (contest) => {
      const withBudgets = await enrichContestWithCalculatedBudgets(
        contest as any,
        params.supabase,
      );
      return {
        ...withBudgets,
        verified_submission_count: contest.verified_submission_count,
        pending_submission_count: contest.pending_submission_count,
        rejected_submission_count: contest.rejected_submission_count,
        not_rejected_views: contest.not_rejected_views,
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
    availablePlatforms: ["all", ...Array.from(platforms).sort()],
  };
}
