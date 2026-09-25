/**
 * Skip Google API work when a submission already succeeded for the same
 * YouTube refresh scope within a short window (default 10 minutes).
 */

import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";
import { getExistingYouTubeStats } from "@/lib/youtube-other-stats";

export const YT_SKIP_RECENT_OK_DEFAULT_MS = 10 * 60 * 1000;

export function getYoutubeSkipRecentOkMs(): number {
  const raw = process.env.YT_SKIP_RECENT_OK_MS;
  if (raw == null || raw === "") return YT_SKIP_RECENT_OK_DEFAULT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return YT_SKIP_RECENT_OK_DEFAULT_MS;
  return Math.floor(n);
}

export function getYouTubeLastOkScopes(
  otherStats: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const youtube = getExistingYouTubeStats(otherStats);
  const raw = youtube.last_ok_scopes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (typeof value === "string" && value.length > 0) out[key] = value;
  }
  return out;
}

export function buildLastOkScopesPatch(
  scope: YouTubeRefreshScope,
  nowIso: string,
  existingStats: Record<string, unknown>,
): Record<string, string> {
  const prev = getYouTubeLastOkScopes({ youtube: existingStats });
  return { ...prev, [scope]: nowIso };
}

export function shouldSkipRecentOkYouTubeRefresh(options: {
  scope: YouTubeRefreshScope;
  insightsStatus: string | null | undefined;
  otherStats: Record<string, unknown> | null | undefined;
  nowMs?: number;
  maxAgeMs?: number;
}): boolean {
  if (options.insightsStatus !== "ok") return false;
  const stamp = getYouTubeLastOkScopes(options.otherStats)[options.scope];
  if (!stamp) return false;
  const stampMs = new Date(stamp).getTime();
  if (Number.isNaN(stampMs)) return false;
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? getYoutubeSkipRecentOkMs();
  return nowMs - stampMs < maxAgeMs;
}
