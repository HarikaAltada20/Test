import type { MetricsRunTable } from "@/lib/post-campaign-enqueue-guards";

/** Video platforms that post-campaign metrics refresh supports. */
export type PostCampaignVideoPlatform = "youtube" | "instagram" | "tiktok";

const VIDEO_PLATFORMS: readonly PostCampaignVideoPlatform[] = [
  "youtube",
  "tiktok",
  "instagram",
] as const;

function classifyToken(token: string): PostCampaignVideoPlatform | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  // Exact / prefix first so hybrid tokens stay unambiguous.
  if (t === "youtube" || t.startsWith("youtube")) return "youtube";
  if (t === "tiktok" || t.startsWith("tiktok")) return "tiktok";
  if (t === "instagram" || t.startsWith("instagram")) return "instagram";
  if (t.includes("youtube")) return "youtube";
  if (t.includes("tiktok")) return "tiktok";
  if (t.includes("instagram")) return "instagram";
  return null;
}

/**
 * Parse contest.platform into all video platforms present.
 * Preserves first-seen order (e.g. "youtube,instagram" → youtube then instagram).
 * Does not prefer Instagram just because it was checked first in an if-chain.
 */
export function parsePostCampaignVideoPlatforms(
  platform: string | null | undefined,
): PostCampaignVideoPlatform[] {
  const raw = (platform ?? "").toLowerCase().trim();
  if (!raw) return [];

  const tokens = raw
    .split(/[,+/|&]+|\band\b|\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const ordered: PostCampaignVideoPlatform[] = [];
  const add = (p: PostCampaignVideoPlatform) => {
    if (!ordered.includes(p)) ordered.push(p);
  };

  for (const token of tokens) {
    const matched = classifyToken(token);
    if (matched) add(matched);
  }

  // Unseparated hybrid soup (rare): collect every match in stable priority.
  if (ordered.length === 0) {
    for (const p of VIDEO_PLATFORMS) {
      if (raw.includes(p)) add(p);
    }
  }

  return ordered;
}

/** Classify a single submission/overlay platform field. */
export function classifyPostCampaignSubmissionPlatform(
  platform: string | null | undefined,
): PostCampaignVideoPlatform | null {
  const parsed = parsePostCampaignVideoPlatforms(platform);
  return parsed[0] ?? null;
}

/**
 * Platforms to refresh: prefer distinct platforms from overlay/submission rows
 * (accurate for hybrid contests), else fall back to contest.platform.
 */
export function resolvePostCampaignRefreshPlatforms(options: {
  contestPlatform?: string | null;
  rowPlatforms?: Array<string | null | undefined>;
}): PostCampaignVideoPlatform[] {
  const fromRows: PostCampaignVideoPlatform[] = [];
  for (const raw of options.rowPlatforms ?? []) {
    const p = classifyPostCampaignSubmissionPlatform(raw);
    if (p && !fromRows.includes(p)) fromRows.push(p);
  }
  if (fromRows.length > 0) return fromRows;
  return parsePostCampaignVideoPlatforms(options.contestPlatform);
}

export function primaryPostCampaignVideoPlatform(
  platform: string | null | undefined,
): PostCampaignVideoPlatform | null {
  return parsePostCampaignVideoPlatforms(platform)[0] ?? null;
}

export function metricsRunTableForPlatform(
  platform: PostCampaignVideoPlatform,
): MetricsRunTable {
  switch (platform) {
    case "instagram":
      return "instagram_insights_refresh_runs";
    case "youtube":
      return "youtube_metrics_refresh_runs";
    case "tiktok":
      return "tiktok_metrics_refresh_runs";
  }
}

export function postCampaignPlatformLabel(
  platform: PostCampaignVideoPlatform,
): "YouTube" | "TikTok" | "Instagram" {
  switch (platform) {
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
  }
}

export function postCampaignStatusPathForPlatform(
  platform: PostCampaignVideoPlatform,
): string {
  switch (platform) {
    case "youtube":
      return "youtube-metrics-refresh/status";
    case "tiktok":
      return "tiktok-metrics-refresh/status";
    case "instagram":
      return "instagram-insights-refresh/status";
  }
}

export function postCampaignEnqueuePathForPlatform(
  contestId: string,
  platform: PostCampaignVideoPlatform,
): string {
  switch (platform) {
    case "youtube":
      return `/api/contests/${contestId}/youtube-metrics-refresh/enqueue`;
    case "tiktok":
      return `/api/contests/${contestId}/tiktok-metrics-refresh/enqueue`;
    case "instagram":
      return `/api/contests/${contestId}/instagram-insights-refresh/enqueue`;
  }
}
