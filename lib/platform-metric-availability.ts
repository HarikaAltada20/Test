/**
 * Metrics that exist on only one video platform. Shared metrics
 * (views, likes, comments, shares) are omitted and always apply.
 */

const YOUTUBE_ONLY_METRIC_IDS = new Set([
  "dislikes",
  "avg_view_pct",
  "watch_time",
  "avg_duration",
  "clip_duration",
  "engaged_views",
  "subs_gained",
  "bot_score",
  "top_traffic_source",
  "youtube_analytics",
  "analytics",
]);

const INSTAGRAM_ONLY_METRIC_IDS = new Set([
  "reposts",
  "saves",
  "reach",
  "interactions",
  "avg_watch_time",
  "total_watch_time",
  "reel_duration",
  "avg_watch_pct",
  "reels_skip_rate",
  "instagram_insights",
]);

const TIKTOK_ONLY_METRIC_IDS = new Set([
  "total_interactions",
  "total_engagement",
  "engagement_rate",
]);

function platformKey(platform: string | null | undefined): string {
  return String(platform || "").toLowerCase();
}

export function videoPlatformHasMetric(
  platform: string | null | undefined,
  metricId: string,
): boolean {
  const raw = platformKey(platform);
  if (YOUTUBE_ONLY_METRIC_IDS.has(metricId)) return raw.includes("youtube");
  if (INSTAGRAM_ONLY_METRIC_IDS.has(metricId)) return raw.includes("instagram");
  if (TIKTOK_ONLY_METRIC_IDS.has(metricId)) return raw.includes("tiktok");
  return true;
}

export function creatorGroupHasMetric(
  submissions: Array<{ platform?: string | null }> | undefined,
  metricId: string,
): boolean {
  const rows = submissions || [];
  if (YOUTUBE_ONLY_METRIC_IDS.has(metricId)) {
    return rows.some((s) => platformKey(s.platform).includes("youtube"));
  }
  if (INSTAGRAM_ONLY_METRIC_IDS.has(metricId)) {
    return rows.some((s) => platformKey(s.platform).includes("instagram"));
  }
  if (TIKTOK_ONLY_METRIC_IDS.has(metricId)) {
    return rows.some((s) => platformKey(s.platform).includes("tiktok"));
  }
  return true;
}
