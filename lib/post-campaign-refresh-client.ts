/**
 * Pure helpers for post-campaign refresh polling / completion UX.
 * Kept out of contest-detail-client so unit tests can cover them.
 */

import {
  parsePostCampaignVideoPlatforms,
  postCampaignPlatformLabel,
  postCampaignStatusPathForPlatform,
  primaryPostCampaignVideoPlatform,
  type PostCampaignVideoPlatform,
} from "@/lib/post-campaign-platforms";

export type PostCampaignRefreshRunCounts = {
  success_count?: number | null;
  temporary_failure_count?: number | null;
  permanent_failure_count?: number | null;
  skipped_recent_count?: number | null;
};

export function isTrackedPostCampaignRun(
  run: { id: string; started_at?: string | null },
  options: {
    activeRunId?: string;
    refreshStartedMs: number;
    skewMs?: number;
  },
): boolean {
  const { activeRunId, refreshStartedMs, skewMs = 10_000 } = options;
  if (activeRunId) return run.id === activeRunId;
  if (!run.started_at) return false;
  const runStartMs = new Date(run.started_at).getTime();
  return !Number.isNaN(runStartMs) && runStartMs >= refreshStartedMs - skewMs;
}

export function isTerminalPostCampaignRunStatus(
  status: string | null | undefined,
): boolean {
  return (
    status === "completed" || status === "failed" || status === "cancelled"
  );
}

export function formatPostCampaignRefreshToastDescription(
  run: PostCampaignRefreshRunCounts,
  options?: { scope?: string },
): string {
  const counts = `Success ${run.success_count ?? 0} · Temporary failure ${run.temporary_failure_count ?? 0} · Permanent failure ${run.permanent_failure_count ?? 0} · Skipped ${run.skipped_recent_count ?? 0}.`;
  if (options?.scope) {
    return `Scope: ${options.scope} · ${counts}`;
  }
  return counts;
}

export type PostCampaignStatusPathInfo = {
  platform: PostCampaignVideoPlatform;
  statusPath: string;
  platformLabel: "YouTube" | "TikTok" | "Instagram";
  isYoutube: boolean;
  isTiktok: boolean;
};

function statusInfoFor(
  platform: PostCampaignVideoPlatform,
): PostCampaignStatusPathInfo {
  return {
    platform,
    statusPath: postCampaignStatusPathForPlatform(platform),
    platformLabel: postCampaignPlatformLabel(platform),
    isYoutube: platform === "youtube",
    isTiktok: platform === "tiktok",
  };
}

/**
 * Resolve status polling target(s) for a contest platform string.
 * Hybrid contests return one entry per platform (order preserved).
 * Legacy single-entry helper keeps the primary platform for older callers.
 */
export function getPostCampaignStatusPaths(
  platform: string | null | undefined,
): PostCampaignStatusPathInfo[] {
  const parsed = parsePostCampaignVideoPlatforms(platform);
  if (parsed.length === 0) {
    // Preserve prior default when platform is missing/unknown.
    return [statusInfoFor("instagram")];
  }
  return parsed.map(statusInfoFor);
}

export function getPostCampaignStatusPath(
  platform: string | null | undefined,
): {
  statusPath: string;
  platformLabel: "YouTube" | "TikTok" | "Instagram";
  isYoutube: boolean;
  isTiktok: boolean;
} {
  const primary =
    primaryPostCampaignVideoPlatform(platform) ?? "instagram";
  const info = statusInfoFor(primary);
  return {
    statusPath: info.statusPath,
    platformLabel: info.platformLabel,
    isYoutube: info.isYoutube,
    isTiktok: info.isTiktok,
  };
}
