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
  total_submissions?: number | null;
  processed_submissions?: number | null;
  reviewed_count?: number | null;
  scope?: string | null;
};

export function isTrackedPostCampaignRun(
  run: {
    id: string;
    status?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
  },
  options: {
    activeRunId?: string;
    refreshStartedMs: number;
    skewMs?: number;
  },
): boolean {
  const { activeRunId, refreshStartedMs, skewMs = 120_000 } = options;

  // Exact id always wins (chainContinue / enqueue returned this run).
  if (activeRunId && run.id === activeRunId) return true;

  const terminal = isTerminalPostCampaignRunStatus(run.status);

  if (run.started_at) {
    const runStartMs = new Date(run.started_at).getTime();
    if (Number.isNaN(runStartMs)) return false;

    // Terminal runs from a prior refresh must not count as "this chain done"
    // (otherwise IG/TT paint as COMPLETED the moment YT finishes).
    // Allow only a tiny clock skew.
    if (terminal) {
      return runStartMs >= refreshStartedMs - 5_000;
    }

    // Active pending/running: allow enqueue race skew.
    if (runStartMs >= refreshStartedMs - skewMs) {
      return true;
    }
    return false;
  }

  // No started_at: only accept non-terminal if finished_at is in window (rare).
  if (!terminal && run.finished_at) {
    const finishedMs = new Date(run.finished_at).getTime();
    if (!Number.isNaN(finishedMs) && finishedMs >= refreshStartedMs - skewMs) {
      return true;
    }
  }

  return false;
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

/**
 * Live Refresh Metrics toast body: totals + success / temp / permanent / skipped.
 */
export function formatLiveMetricsRefreshToastDescription(
  run: PostCampaignRefreshRunCounts,
  options?: { scope?: string | null; includeReviewed?: boolean },
): string {
  const total = run.total_submissions ?? 0;
  const processed = run.processed_submissions ?? 0;
  const parts = [
    `Total submissions ${total}`,
    `Processed ${processed}`,
  ];
  if (options?.includeReviewed) {
    parts.push(`Reviewed ${run.reviewed_count ?? 0}`);
  }
  if (options?.scope) {
    parts.unshift(`Scope: ${options.scope}`);
  }
  parts.push(
    `Success ${run.success_count ?? 0}`,
    `Temporary failure ${run.temporary_failure_count ?? 0}`,
    `Permanent failure ${run.permanent_failure_count ?? 0}`,
    `Skipped ${run.skipped_recent_count ?? 0}`,
  );
  return `${parts.join(" · ")}.`;
}

export function liveMetricsRefreshToastTitle(
  platform: "youtube" | "instagram" | "tiktok",
  status: string | null | undefined,
): string {
  const label =
    platform === "youtube"
      ? "YouTube"
      : platform === "instagram"
        ? "Instagram"
        : "TikTok";
  if (status === "failed") return `${label} refresh failed`;
  if (status === "cancelled") return `${label} refresh cancelled`;
  return `${label} refresh completed`;
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
