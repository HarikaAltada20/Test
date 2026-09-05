/**
 * Resolve which video platforms to refresh for multi-platform campaigns.
 * Fixed queue order: YouTube → Instagram → TikTok.
 * Multi-platform Refresh Metrics uses YouTube scope "all" (basic+core+traffic+demographics).
 */

import {
  parsePostCampaignVideoPlatforms,
  type PostCampaignVideoPlatform,
} from "@/lib/post-campaign-platforms";
import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";
import {
  ALL_PLATFORM_TAB,
  type PlatformTabValue,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

/** Canonical refresh order for hybrid video contests. */
export const METRICS_REFRESH_PLATFORM_ORDER: readonly PostCampaignVideoPlatform[] =
  ["youtube", "instagram", "tiktok"] as const;

/** YouTube scope used when refreshing a multi-platform campaign. */
export const MULTI_PLATFORM_YOUTUBE_REFRESH_SCOPE: YouTubeRefreshScope = "all";

const PLATFORM_SET = new Set<string>(METRICS_REFRESH_PLATFORM_ORDER);

export function isMetricsRefreshVideoPlatform(
  value: string | null | undefined,
): value is PostCampaignVideoPlatform {
  return typeof value === "string" && PLATFORM_SET.has(value);
}

/**
 * Normalize a request body `platforms` array into unique video platforms.
 * Invalid tokens are dropped (not an error).
 */
export function parseRequestedRefreshPlatforms(
  raw: unknown,
): PostCampaignVideoPlatform[] {
  if (!Array.isArray(raw)) return [];
  const out: PostCampaignVideoPlatform[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const token = item.trim().toLowerCase();
    if (!isMetricsRefreshVideoPlatform(token)) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out;
}

/**
 * Platforms to refresh from the submissions UI tab.
 * Single tab → that platform only (if in campaign).
 * All → every campaign platform, ordered YouTube → Instagram → TikTok.
 */
export function platformsForRefreshTab(
  tab: PlatformTabValue,
  campaignPlatforms: readonly VideoContestPlatform[],
): PostCampaignVideoPlatform[] {
  const allowed = new Set(campaignPlatforms);
  if (tab === ALL_PLATFORM_TAB) {
    return METRICS_REFRESH_PLATFORM_ORDER.filter((p) => allowed.has(p));
  }
  if (isMetricsRefreshVideoPlatform(tab) && allowed.has(tab)) {
    return [tab];
  }
  return METRICS_REFRESH_PLATFORM_ORDER.filter((p) => allowed.has(p));
}

/**
 * Intersect campaign/allowed platforms with an optional request filter,
 * then sort into YouTube → Instagram → TikTok.
 */
export function resolveMetricsRefreshPlatformQueue(options: {
  /** Platforms present on the contest / overlay. */
  allowedPlatforms: readonly PostCampaignVideoPlatform[];
  /** Optional client filter (tab or explicit list). Empty = all allowed. */
  requestedPlatforms?: readonly PostCampaignVideoPlatform[];
}): PostCampaignVideoPlatform[] {
  const allowed = new Set(options.allowedPlatforms);
  const requested = options.requestedPlatforms ?? [];
  const selected =
    requested.length > 0
      ? requested.filter((p) => allowed.has(p))
      : [...allowed];
  return METRICS_REFRESH_PLATFORM_ORDER.filter((p) => selected.includes(p));
}

/**
 * Parse contest.platform CSV into ordered video platforms for live refresh.
 * Prefer VIDEO_CONTEST_PLATFORMS order over CSV first-seen order.
 */
export function resolveLiveContestVideoPlatforms(
  contestPlatform: string | null | undefined,
): PostCampaignVideoPlatform[] {
  const parsed = parsePostCampaignVideoPlatforms(contestPlatform);
  return METRICS_REFRESH_PLATFORM_ORDER.filter((p) => parsed.includes(p));
}

export function serializeRefreshPlatforms(
  platforms: readonly PostCampaignVideoPlatform[],
): string {
  return platforms.join(",");
}

/**
 * YouTube enqueue scope for Refresh Metrics.
 * Multi-platform campaigns refresh full YouTube analytics (all), not basic-only.
 */
export function youtubeScopeForMetricsRefresh(options: {
  campaignPlatformCount: number;
  requestedScope?: YouTubeRefreshScope | null;
}): YouTubeRefreshScope {
  if (options.requestedScope) return options.requestedScope;
  return options.campaignPlatformCount > 1
    ? MULTI_PLATFORM_YOUTUBE_REFRESH_SCOPE
    : "basic";
}

export type SequentialRefreshPlatformPollState = {
  /** Run exists and belongs to this refresh window. */
  tracked: boolean;
  /** Tracked run is completed/failed/cancelled. */
  terminal: boolean;
};

/**
 * Index of the platform the UI should poll / wait on for a sequential chain.
 * Returns `platformsLength` when every platform is tracked + terminal (done).
 */
export function resolveSequentialRefreshPollIndex(
  states: readonly SequentialRefreshPlatformPollState[],
): number {
  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    if (!s?.tracked || !s.terminal) return i;
  }
  return states.length;
}
