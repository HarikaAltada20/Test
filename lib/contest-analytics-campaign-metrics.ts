import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";

export type PlatformCampaignMetrics = {
  submissions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  saved: number;
};

export type CampaignMetricCardDef = {
  label: string;
  value: number;
};

function platformKey(platform: string | null | undefined): string {
  return (platform ?? "").toLowerCase();
}

function submissionViews(
  sub: ContestAnalyticsExportSubmission,
  platform: string,
): number {
  const stats = sub.other_stats ?? {};
  const nested = stats[platform] as Record<string, unknown> | undefined;
  const platformViews = Number(nested?.views ?? 0);
  const directViews = Number(sub.views ?? 0);
  if (platform === "instagram") {
    const reach = Number(nested?.reach ?? 0);
    const igViews = platformViews;
    if (Math.max(directViews, igViews) === 0 && reach > 0) return reach;
    return Math.max(directViews, igViews);
  }
  if (platform === "tiktok") {
    const fromStats = Number(nested?.view_count ?? nested?.views ?? NaN);
    if (Number.isFinite(fromStats) && fromStats > 0) return fromStats;
    return Math.max(0, directViews);
  }
  return platformViews > 0 ? platformViews : directViews;
}

function nestedMetric(
  sub: ContestAnalyticsExportSubmission,
  platform: string,
  keys: string[],
): number {
  const stats = sub.other_stats ?? {};
  const nested = (stats[platform] as Record<string, unknown> | undefined) ?? stats;
  for (const key of keys) {
    const value = Number(nested?.[key] ?? 0);
    if (value > 0) return value;
  }
  return 0;
}

export function computePlatformCampaignMetrics(
  subs: ContestAnalyticsExportSubmission[],
  platform: string | null | undefined,
): PlatformCampaignMetrics {
  const p = platformKey(platform);
  const metrics: PlatformCampaignMetrics = {
    submissions: subs.length,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    reach: 0,
    saved: 0,
  };

  for (const sub of subs) {
    metrics.views += submissionViews(sub, p);
    metrics.likes += nestedMetric(sub, p, ["likes", "like_count"]);
    metrics.comments += nestedMetric(sub, p, ["comments", "comment_count", "replies"]);
    metrics.shares += nestedMetric(sub, p, ["shares", "share_count", "retweets"]);
    metrics.reach += nestedMetric(sub, p, ["reach"]);
    metrics.saved += nestedMetric(sub, p, ["saved", "saves"]);
  }

  return metrics;
}

export function getPlatformCampaignMetricCards(
  subs: ContestAnalyticsExportSubmission[],
  platform: string | null | undefined,
): CampaignMetricCardDef[] {
  const p = platformKey(platform);
  const m = computePlatformCampaignMetrics(subs, platform);

  if (p === "instagram") {
    return [
      { label: "Submissions", value: m.submissions },
      { label: "Views", value: m.views },
      { label: "Likes", value: m.likes },
      { label: "Comments", value: m.comments },
      { label: "Shares", value: m.shares },
      { label: "Reach", value: m.reach },
      { label: "Saved", value: m.saved },
    ];
  }

  if (p === "youtube") {
    return [
      { label: "Submissions", value: m.submissions },
      { label: "Views", value: m.views },
      { label: "Likes", value: m.likes },
      { label: "Comments", value: m.comments },
    ];
  }

  if (p === "tiktok") {
    return [
      { label: "Submissions", value: m.submissions },
      { label: "Views", value: m.views },
      { label: "Likes", value: m.likes },
      { label: "Comments", value: m.comments },
      { label: "Shares", value: m.shares },
    ];
  }

  return [
    { label: "Submissions", value: m.submissions },
    { label: "Views", value: m.views },
    { label: "Likes", value: m.likes },
    { label: "Comments", value: m.comments },
    { label: "Shares", value: m.shares },
  ];
}

export function platformCampaignMetricsToRows(
  subs: ContestAnalyticsExportSubmission[],
  platform: string | null | undefined,
): [string, string][] {
  return getPlatformCampaignMetricCards(subs, platform).map((card) => [
    card.label,
    card.value.toLocaleString(),
  ]);
}
