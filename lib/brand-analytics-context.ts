import type { BrandAnalyticsQueryContext } from "@/lib/brand-analytics-cache";
import {
  parseBrandAnalyticsDateRange,
  parseBrandContestIdSet,
  parseBrandContestTypeSet,
  parseBrandAnalyticsSource,
  validateBrandAnalyticsDateRange,
} from "@/lib/brand-analytics-query";

export function parseBrandAnalyticsContext(
  advertiserId: string,
  searchParams: URLSearchParams,
): { ok: true; ctx: BrandAnalyticsQueryContext } | { ok: false; error: string } {
  const dateRange = parseBrandAnalyticsDateRange(searchParams);
  const dateValidation = validateBrandAnalyticsDateRange(dateRange);
  if (!dateValidation.ok) {
    return { ok: false, error: dateValidation.error };
  }

  const source = parseBrandAnalyticsSource(searchParams);
  const isPc = source === "pc_submissions";
  const submissionStatusRaw = searchParams.get("status");
  const submissionStatus = submissionStatusRaw?.trim().toLowerCase() || null;
  const notRejected = searchParams.get("notRejected") === "true";
  const contentType = (searchParams.get("contentType") ?? "video")
    .trim()
    .toLowerCase() as "video" | "text_image";
  const videoPlatform = (searchParams.get("videoPlatform") ?? "all")
    .trim()
    .toLowerCase();
  const tiktokParam = searchParams.get("tiktok");
  const tiktokAnalytics = tiktokParam === "true" || tiktokParam === "1";
  const twitterParam = searchParams.get("twitter");
  const twitterAnalytics = isPc
    ? false
    : twitterParam === "true" || twitterParam === "1";

  return {
    ok: true,
    ctx: {
      advertiserId,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      dataSource: source,
      contentType,
      videoPlatform,
      tiktokAnalytics,
      twitterAnalytics,
      contestTypeSet: parseBrandContestTypeSet(searchParams),
      contestIdSet: parseBrandContestIdSet(searchParams),
      submissionStatus,
      notRejected,
    },
  };
}

export function resolveBrandActiveFilter(
  searchParams: URLSearchParams,
): string {
  const notRejected = searchParams.get("notRejected") === "true";
  const statusRaw = (searchParams.get("status") ?? "all").trim().toLowerCase();
  if (notRejected) return "not_rejected";
  if (statusRaw === "verifiedpaid") return "verifiedPaid";
  return statusRaw;
}
