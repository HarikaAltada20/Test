import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";
import { parseVideoContestPlatforms } from "@/lib/video-platform-campaigns";
import { parseSubmissionOtherStats } from "@/lib/youtube-other-stats";

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

const NESTED_PLATFORM_KEYS = ["instagram", "youtube", "tiktok"] as const;

const LIKE_KEYS = ["likes", "like_count", "likeCount", "likes_count"];
const COMMENT_KEYS = [
  "comments",
  "comment_count",
  "comments_count",
  "replies",
];
const SHARE_KEYS = [
  "shares",
  "share_count",
  "shares_count",
  "retweets",
  "reposts",
];
const REACH_KEYS = ["reach"];
const SAVED_KEYS = ["saved", "saves"];

function platformKey(platform: string | null | undefined): string {
  return (platform ?? "").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function firstPositive(
  obj: Record<string, unknown> | undefined,
  keys: string[],
): number {
  if (!obj) return 0;
  for (const key of keys) {
    const value = Number(obj[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function displayPlatformKey(platform: string | null | undefined): string {
  const parsed = parseVideoContestPlatforms(platform);
  if (parsed.length === 1) return parsed[0];
  return platformKey(platform);
}

function resolveSubmissionPlatform(
  sub: ContestAnalyticsExportSubmission,
  contestPlatform: string | null | undefined,
): string {
  const fromSub = parseVideoContestPlatforms(sub.platform);
  if (fromSub.length > 0) return fromSub[0];

  const stats = parseSubmissionOtherStats(sub.other_stats);
  for (const key of NESTED_PLATFORM_KEYS) {
    if (isRecord(stats[key])) return key;
  }

  const fromContest = parseVideoContestPlatforms(contestPlatform);
  if (fromContest.length === 1) return fromContest[0];

  return platformKey(contestPlatform);
}

function submissionViews(
  sub: ContestAnalyticsExportSubmission,
  platform: string,
): number {
  const stats = parseSubmissionOtherStats(sub.other_stats);
  const nested = isRecord(stats[platform]) ? stats[platform] : undefined;
  const platformViews = Number(nested?.views ?? 0);
  const directViews = Number(sub.views ?? 0);
  if (platform === "instagram") {
    const reach = Number(nested?.reach ?? 0);
    const igViews = Number.isFinite(platformViews) ? platformViews : 0;
    if (Math.max(directViews, igViews) === 0 && reach > 0) return reach;
    return Math.max(directViews, igViews);
  }
  if (platform === "tiktok") {
    const fromStats = Number(nested?.view_count ?? nested?.views ?? NaN);
    if (Number.isFinite(fromStats) && fromStats > 0) return fromStats;
    return Math.max(0, directViews);
  }
  return platformViews > 0 ? platformViews : Math.max(0, directViews);
}

function nestedMetric(
  sub: ContestAnalyticsExportSubmission,
  platform: string,
  keys: string[],
): number {
  const stats = parseSubmissionOtherStats(sub.other_stats);
  const nested = isRecord(stats[platform]) ? stats[platform] : undefined;
  const fromNested = firstPositive(nested, keys);
  if (fromNested > 0) return fromNested;

  const fromRoot = firstPositive(stats, keys);
  if (fromRoot > 0) return fromRoot;

  // Multi-platform contests pass a CSV like "youtube,instagram,tiktok", which is
  // not a nested other_stats key. Fall back to known per-platform buckets.
  if (!nested) {
    for (const key of NESTED_PLATFORM_KEYS) {
      const extra = stats[key];
      if (!isRecord(extra)) continue;
      const value = firstPositive(extra, keys);
      if (value > 0) return value;
    }
  }

  return 0;
}

export function computePlatformCampaignMetrics(
  subs: ContestAnalyticsExportSubmission[],
  platform: string | null | undefined,
): PlatformCampaignMetrics {
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
    const p = resolveSubmissionPlatform(sub, platform);
    metrics.views += submissionViews(sub, p);
    metrics.likes += nestedMetric(sub, p, LIKE_KEYS);
    metrics.comments += nestedMetric(sub, p, COMMENT_KEYS);
    metrics.shares += nestedMetric(sub, p, SHARE_KEYS);
    metrics.reach += nestedMetric(sub, p, REACH_KEYS);
    metrics.saved += nestedMetric(sub, p, SAVED_KEYS);
  }

  return metrics;
}

export function getPlatformCampaignMetricCards(
  subs: ContestAnalyticsExportSubmission[],
  platform: string | null | undefined,
): CampaignMetricCardDef[] {
  const p = displayPlatformKey(platform);
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
