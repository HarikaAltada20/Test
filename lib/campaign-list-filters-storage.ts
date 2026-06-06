export const BRAND_CONTEST_LIST_FILTERS_KEY = "gv-dashboard-contests-filters";
export const ADMIN_CONTEST_LIST_FILTERS_KEY = "gv-dashboard-admin-contests-filters";
export const OPPORTUNITIES_LIST_FILTERS_KEY = "gv-dashboard-opportunities-filters";

export const CONTEST_LIST_SORT_OPTIONS = [
  "created_at_desc",
  "created_at_asc",
  "start_date_desc",
  "start_date_asc",
  "end_date_asc",
  "end_date_desc",
  "value_desc",
  "value_asc",
  "budget_remaining_desc",
  "budget_remaining_asc",
  "cpm_rate_desc",
  "cpm_rate_asc",
  "submissions_desc",
  "submissions_asc",
] as const;

export const OPPORTUNITIES_SORT_OPTIONS = [
  "relevance_desc",
  "start_date_desc",
  "start_date_asc",
  "end_date_asc",
  "end_date_desc",
  "value_desc",
  "value_asc",
  "budget_remaining_desc",
  "budget_remaining_asc",
  "cpm_rate_desc",
  "cpm_rate_asc",
  "submissions_desc",
  "submissions_asc",
] as const;

export const CONTEST_TYPE_FILTER_OPTIONS = [
  "all",
  "leaderboard",
  "cpm",
  "milestone",
  "dual_rewards",
] as const;

export const CONTEST_FORMAT_FILTER_OPTIONS = ["all", "text_image", "video"] as const;

export const BRAND_POST_PHASE_FILTER_OPTIONS = [
  "all",
  "post_pending_review",
  "post_in_review",
  "post_payment_pending",
  "post_paid",
] as const;

export const OPPORTUNITIES_PLATFORM_FILTER_OPTIONS = [
  "all",
  "youtube",
  "instagram",
  "twitter",
  "tiktok",
] as const;

export const OPPORTUNITIES_MEDIA_TYPE_OPTIONS = ["all", "text", "media"] as const;

export const VIEW_MODE_OPTIONS = ["grid", "list"] as const;

export const PAGE_SIZE_OPTIONS = [9, 15, 21, 30] as const;

export type ContestListSortOption = (typeof CONTEST_LIST_SORT_OPTIONS)[number];
export type OpportunitiesSortOption = (typeof OPPORTUNITIES_SORT_OPTIONS)[number];
export type ContestTypeFilterOption = (typeof CONTEST_TYPE_FILTER_OPTIONS)[number];
export type ContestFormatFilterOption = (typeof CONTEST_FORMAT_FILTER_OPTIONS)[number];
export type BrandPostPhaseFilterOption =
  (typeof BRAND_POST_PHASE_FILTER_OPTIONS)[number];
export type OpportunitiesPlatformFilterOption =
  (typeof OPPORTUNITIES_PLATFORM_FILTER_OPTIONS)[number];
export type OpportunitiesMediaTypeOption = (typeof OPPORTUNITIES_MEDIA_TYPE_OPTIONS)[number];
export type ViewModeOption = (typeof VIEW_MODE_OPTIONS)[number];
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export type ContestListFilters = {
  sortOption: ContestListSortOption;
  platformFilter: string;
  contestTypeFilter: ContestTypeFilterOption;
  contestFormatFilter: ContestFormatFilterOption;
  postContestPhaseFilter: BrandPostPhaseFilterOption;
  viewMode: ViewModeOption;
  limit: PageSizeOption;
};

export type OpportunitiesListFilters = {
  mediaType: OpportunitiesMediaTypeOption;
  platformFilter: OpportunitiesPlatformFilterOption;
  typeFilter: ContestTypeFilterOption;
  sortOption: OpportunitiesSortOption;
  viewMode: ViewModeOption;
  limit: PageSizeOption;
};

export const DEFAULT_CONTEST_LIST_FILTERS: ContestListFilters = {
  sortOption: "created_at_desc",
  platformFilter: "all",
  contestTypeFilter: "all",
  contestFormatFilter: "all",
  postContestPhaseFilter: "all",
  viewMode: "grid",
  limit: 9,
};

export const DEFAULT_OPPORTUNITIES_LIST_FILTERS: OpportunitiesListFilters = {
  mediaType: "all",
  platformFilter: "all",
  typeFilter: "all",
  sortOption: "relevance_desc",
  viewMode: "grid",
  limit: 9,
};

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function pickString(
  value: unknown,
  fallback: string,
  allowed?: readonly string[],
): string {
  if (typeof value !== "string") return fallback;
  if (allowed && !allowed.includes(value)) return fallback;
  return value;
}

function pickPageSize(value: unknown, fallback: PageSizeOption): PageSizeOption {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;
  return PAGE_SIZE_OPTIONS.includes(numeric as PageSizeOption)
    ? (numeric as PageSizeOption)
    : fallback;
}

export function readStoredContestListFilters(
  storageKey: string,
  defaults: ContestListFilters = DEFAULT_CONTEST_LIST_FILTERS,
): ContestListFilters {
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<ContestListFilters>;
    return {
      sortOption: isOneOf(parsed.sortOption, CONTEST_LIST_SORT_OPTIONS)
        ? parsed.sortOption
        : defaults.sortOption,
      platformFilter: pickString(parsed.platformFilter, defaults.platformFilter),
      contestTypeFilter: isOneOf(parsed.contestTypeFilter, CONTEST_TYPE_FILTER_OPTIONS)
        ? parsed.contestTypeFilter
        : defaults.contestTypeFilter,
      contestFormatFilter: isOneOf(
        parsed.contestFormatFilter,
        CONTEST_FORMAT_FILTER_OPTIONS,
      )
        ? parsed.contestFormatFilter
        : defaults.contestFormatFilter,
      postContestPhaseFilter: isOneOf(
        parsed.postContestPhaseFilter,
        BRAND_POST_PHASE_FILTER_OPTIONS,
      )
        ? parsed.postContestPhaseFilter
        : defaults.postContestPhaseFilter,
      viewMode: isOneOf(parsed.viewMode, VIEW_MODE_OPTIONS)
        ? parsed.viewMode
        : defaults.viewMode,
      limit: pickPageSize(parsed.limit, defaults.limit),
    };
  } catch {
    return defaults;
  }
}

export function writeStoredContestListFilters(
  storageKey: string,
  filters: Partial<ContestListFilters>,
): void {
  if (typeof window === "undefined") return;

  try {
    const existing = readStoredContestListFilters(storageKey);
    const next = { ...existing, ...filters };
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

export function readStoredOpportunitiesListFilters(
  storageKey: string = OPPORTUNITIES_LIST_FILTERS_KEY,
  defaults: OpportunitiesListFilters = DEFAULT_OPPORTUNITIES_LIST_FILTERS,
): OpportunitiesListFilters {
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<OpportunitiesListFilters>;
    return {
      mediaType: isOneOf(parsed.mediaType, OPPORTUNITIES_MEDIA_TYPE_OPTIONS)
        ? parsed.mediaType
        : defaults.mediaType,
      platformFilter: isOneOf(
        parsed.platformFilter,
        OPPORTUNITIES_PLATFORM_FILTER_OPTIONS,
      )
        ? parsed.platformFilter
        : defaults.platformFilter,
      typeFilter: isOneOf(parsed.typeFilter, CONTEST_TYPE_FILTER_OPTIONS)
        ? parsed.typeFilter
        : defaults.typeFilter,
      sortOption: isOneOf(parsed.sortOption, OPPORTUNITIES_SORT_OPTIONS)
        ? parsed.sortOption
        : defaults.sortOption,
      viewMode: isOneOf(parsed.viewMode, VIEW_MODE_OPTIONS)
        ? parsed.viewMode
        : defaults.viewMode,
      limit: pickPageSize(parsed.limit, defaults.limit),
    };
  } catch {
    return defaults;
  }
}

export function writeStoredOpportunitiesListFilters(
  storageKey: string = OPPORTUNITIES_LIST_FILTERS_KEY,
  filters: Partial<OpportunitiesListFilters>,
): void {
  if (typeof window === "undefined") return;

  try {
    const existing = readStoredOpportunitiesListFilters(storageKey);
    const next = { ...existing, ...filters };
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}
