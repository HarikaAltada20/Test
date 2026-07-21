import { getUtcMonthsAgoRange } from "@/lib/admin-date-range";

export type BrandAnalyticsDataSource = "submissions" | "pc_submissions";

export const BRAND_ANALYTICS_DEFAULT_MONTHS = 12;
export const BRAND_ANALYTICS_MAX_RANGE_DAYS = 366;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseBrandAnalyticsSource(
  searchParams: URLSearchParams,
): BrandAnalyticsDataSource {
  return searchParams.get("source")?.trim().toLowerCase() === "pc_submissions"
    ? "pc_submissions"
    : "submissions";
}

export type BrandAnalyticsDateRange = { from: Date; to: Date };

/** Parse `from` / `to` ISO query params (defaults to last 12 months). */
export function parseBrandAnalyticsDateRange(
  searchParams: URLSearchParams,
): BrandAnalyticsDateRange {
  const defaultRange = getUtcMonthsAgoRange(BRAND_ANALYTICS_DEFAULT_MONTHS);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : defaultRange.from;
  const to = toParam ? new Date(toParam) : defaultRange.to;
  return { from, to };
}

export function validateBrandAnalyticsDateRange(range: BrandAnalyticsDateRange):
  | { ok: true }
  | { ok: false; error: string } {
  if (
    Number.isNaN(range.from.getTime()) ||
    Number.isNaN(range.to.getTime())
  ) {
    return { ok: false, error: "Invalid date range" };
  }
  if (range.from.getTime() > range.to.getTime()) {
    return {
      ok: false,
      error: "Invalid date range: from must be before to",
    };
  }
  const spanDays =
    (range.to.getTime() - range.from.getTime()) / MS_PER_DAY;
  if (spanDays > BRAND_ANALYTICS_MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: `Invalid date range: maximum span is ${BRAND_ANALYTICS_MAX_RANGE_DAYS} days`,
    };
  }
  return { ok: true };
}

/** `null` = all campaigns; empty set = none selected. */
export function parseBrandContestIdSet(
  searchParams: URLSearchParams,
): Set<string> | null {
  const contestIdsParam = searchParams.get("contestIds");
  if (!contestIdsParam) return null;
  if (contestIdsParam === "__none__") return new Set();
  return new Set(
    contestIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function applyBrandContestIdSet<T extends { id: string }>(
  contests: T[],
  contestIdSet: Set<string> | null,
): T[] {
  if (contestIdSet === null) return contests;
  return contests.filter((c) => contestIdSet.has(c.id));
}

export function parseBrandContestTypeSet(
  searchParams: URLSearchParams,
): Set<string> | null {
  const typeParamRaw = (searchParams.get("type") ?? "all").trim().toLowerCase();
  if (typeParamRaw === "all" || typeParamRaw === "") return null;
  if (typeParamRaw === "__none__") return new Set();
  return new Set(
    typeParamRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isTimestampInRange(
  value: string | null | undefined,
  from: Date,
  to: Date,
): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  return t >= from.getTime() && t <= to.getTime();
}

export type BuildBrandAnalyticsParamsInput = {
  activeFilter?: string;
  contentType: "video" | "text_image";
  videoPlatform: string;
  videoTiktok: boolean;
  twitterAnalytics: boolean;
  contestTypeParam: string;
  selectedContestIds: string[] | null;
  dateRange: BrandAnalyticsDateRange;
  dataSource?: BrandAnalyticsDataSource;
};

/** Build query string shared by brand analytics pages and APIs. */
export function buildBrandAnalyticsQueryString(
  input: BuildBrandAnalyticsParamsInput,
): string {
  const params = new URLSearchParams();
  if (input.dataSource === "pc_submissions") {
    params.set("source", "pc_submissions");
  }
  if (input.activeFilter && input.activeFilter !== "all") {
    if (input.activeFilter === "not_rejected") {
      params.set("notRejected", "true");
    } else {
      params.set("status", input.activeFilter);
    }
  }
  params.set("contentType", input.contentType);
  params.set("videoPlatform", input.videoPlatform);
  params.set("tiktok", input.videoTiktok ? "true" : "false");
  params.set("twitter", input.twitterAnalytics ? "true" : "false");
  if (input.contestTypeParam !== "all") {
    params.set("type", input.contestTypeParam);
  }
  if (input.selectedContestIds != null) {
    if (input.selectedContestIds.length === 0) {
      params.set("contestIds", "__none__");
    } else {
      params.set("contestIds", input.selectedContestIds.join(","));
    }
  }
  params.set("from", input.dateRange.from.toISOString());
  params.set("to", input.dateRange.to.toISOString());
  return params.toString();
}
