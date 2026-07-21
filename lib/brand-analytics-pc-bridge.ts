import {
  ADMIN_ANALYTICS_BASE_STATUSES,
  type AdminAnalyticsBaseStatus,
  type AdminAnalyticsPlatform,
  type AdminAnalyticsSeriesPoint,
} from "@/lib/admin-analytics";
import {
  getCachedAdminAnalyticsOverview,
  parseContestTypesParam,
  parseIdListParam,
  type AdminAnalyticsSource,
} from "@/lib/admin-analytics-cache";
import type { BrandAnalyticsSeriesPoint } from "@/lib/brand-analytics-graph";
import {
  parseBrandAnalyticsDateRange,
  validateBrandAnalyticsDateRange,
} from "@/lib/brand-analytics-query";

/** Video platforms only — PC overlay metrics exclude Twitter/text campaigns. */
export function brandVideoPlatformsFromSearchParams(
  searchParams: URLSearchParams,
): AdminAnalyticsPlatform[] {
  const contentType = (searchParams.get("contentType") ?? "video")
    .trim()
    .toLowerCase();
  const videoPlatform = (searchParams.get("videoPlatform") ?? "all")
    .trim()
    .toLowerCase();
  const tiktokParam = searchParams.get("tiktok");
  const tiktokAnalytics = tiktokParam === "true" || tiktokParam === "1";
  const platforms: AdminAnalyticsPlatform[] = [];

  if (contentType === "video") {
    if (videoPlatform === "all") {
      platforms.push("youtube", "instagram", "tiktok");
    } else if (videoPlatform === "youtube_instagram") {
      platforms.push("youtube", "instagram");
    } else if (videoPlatform === "youtube_tiktok") {
      platforms.push("youtube", "tiktok");
    } else if (videoPlatform === "instagram_tiktok") {
      platforms.push("instagram", "tiktok");
    } else if (videoPlatform === "youtube") {
      platforms.push("youtube");
    } else if (videoPlatform === "instagram") {
      platforms.push("instagram");
    } else if (videoPlatform === "tiktok") {
      platforms.push("tiktok");
    } else {
      platforms.push("youtube", "instagram");
      if (tiktokAnalytics) platforms.push("tiktok");
    }
  }

  return platforms;
}

export function brandStatusesFromSearchParams(
  searchParams: URLSearchParams,
): AdminAnalyticsBaseStatus[] {
  const notRejected = searchParams.get("notRejected") === "true";
  const statusRaw = searchParams.get("status")?.trim().toLowerCase() ?? "";
  if (notRejected) return ["pending", "verified", "paid"];
  if (!statusRaw || statusRaw === "all") {
    return [...ADMIN_ANALYTICS_BASE_STATUSES];
  }
  if (statusRaw === "verifiedpaid") return ["verified", "paid"];
  if (
    statusRaw === "pending" ||
    statusRaw === "verified" ||
    statusRaw === "paid" ||
    statusRaw === "rejected"
  ) {
    return [statusRaw];
  }
  return [...ADMIN_ANALYTICS_BASE_STATUSES];
}

export function mapAdminSeriesToBrandSeries(
  series: AdminAnalyticsSeriesPoint[],
): BrandAnalyticsSeriesPoint[] {
  return series.map((point) => ({
    date: point.date,
    label: point.label,
    views: point.views,
    likes: point.likes,
    comments: point.comments,
    shares: point.shares,
    pendingViews: point.pendingViews,
    verifiedViews: point.verifiedViews,
    paidViews: point.paidViews,
    rejectedViews: point.rejectedViews,
  }));
}

export async function fetchBrandRollupAnalytics(
  advertiserId: string,
  searchParams: URLSearchParams,
  source: AdminAnalyticsSource,
) {
  const dateRange = parseBrandAnalyticsDateRange(searchParams);
  const dateValidation = validateBrandAnalyticsDateRange(dateRange);
  if (!dateValidation.ok) {
    throw new Error(dateValidation.error);
  }

  const platforms = brandVideoPlatformsFromSearchParams(searchParams);
  const contestTypes = parseContestTypesParam(searchParams.get("type"));
  const statuses = brandStatusesFromSearchParams(searchParams);
  const contestIds = parseIdListParam(searchParams.get("contestIds"));

  const result = await getCachedAdminAnalyticsOverview({
    fromIso: dateRange.from.toISOString(),
    toIso: dateRange.to.toISOString(),
    platforms,
    contestTypes,
    statuses,
    contestIds,
    advertiserIds: [advertiserId],
    source,
  });

  if (source === "pc_submissions") {
    return {
      from: result.from,
      to: result.to,
      summary: result.pc.summary,
      series: result.pc.series,
      viewsByStatus: result.pc.viewsByStatus,
      campaigns: result.pc.allCampaigns ?? [],
      allCampaigns: result.allCampaigns,
      dataSource: source,
    };
  }

  return {
    from: result.from,
    to: result.to,
    summary: result.summary,
    series: result.series,
    viewsByStatus: result.viewsByStatus,
    campaigns: result.campaigns,
    allCampaigns: result.allCampaigns,
    dataSource: source,
  };
}
