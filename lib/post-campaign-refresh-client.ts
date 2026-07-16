/**
 * Pure helpers for post-campaign refresh polling / completion UX.
 * Kept out of contest-detail-client so unit tests can cover them.
 */

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

export function getPostCampaignStatusPath(
  platform: string | null | undefined,
): {
  statusPath: string;
  platformLabel: "YouTube" | "TikTok" | "Instagram";
  isYoutube: boolean;
  isTiktok: boolean;
} {
  const platformLower = (platform ?? "").toString().toLowerCase();
  const isYoutube = platformLower.includes("youtube");
  const isTiktok = platformLower.includes("tiktok");
  return {
    isYoutube,
    isTiktok,
    platformLabel: isYoutube ? "YouTube" : isTiktok ? "TikTok" : "Instagram",
    statusPath: isYoutube
      ? "youtube-metrics-refresh/status"
      : isTiktok
        ? "tiktok-metrics-refresh/status"
        : "instagram-insights-refresh/status",
  };
}
