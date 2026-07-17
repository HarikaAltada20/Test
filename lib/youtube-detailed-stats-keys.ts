/** Keys under other_stats.youtube (or legacy root) that detailed / UI analytics depend on. */
export const YOUTUBE_DETAILED_ANALYTICS_KEYS = [
  "estimated_minutes_watched",
  "avg_view_duration_seconds",
  "avg_view_percentage",
  "engaged_views",
  "dislikes",
  "shares",
  "subscribers_gained",
  "subscribers_lost",
  "videos_added_to_playlists",
  "videos_removed_from_playlists",
  "traffic_sources",
  "traffic_source_details",
  "subscribed_status",
  "demographics",
  "devices",
  "audience_retention",
  "bot_score",
  "bot_flags",
  "last_traffic_update",
  "last_demographics_update",
] as const;

export type YouTubeDetailedAnalyticsKey =
  (typeof YOUTUBE_DETAILED_ANALYTICS_KEYS)[number];

export function detailedAnalyticsKeysPresent(
  stats: Record<string, unknown>,
): YouTubeDetailedAnalyticsKey[] {
  return YOUTUBE_DETAILED_ANALYTICS_KEYS.filter((k) => stats[k] != null);
}

const BASIC_ONLY_KEYS = new Set([
  "views",
  "likes",
  "comments",
  "duration_seconds",
  "analytics_needs_reauth",
  "last_basic_update",
  "insights_error",
]);

/** True when youtube stats contain only basic cron fields (likely stripped). */
export function isYoutubeStatsBasicOnly(stats: Record<string, unknown>): boolean {
  const keys = Object.keys(stats);
  const detailed = detailedAnalyticsKeysPresent(stats);
  return (
    keys.length > 0 &&
    detailed.length === 0 &&
    keys.every((k) => BASIC_ONLY_KEYS.has(k))
  );
}
