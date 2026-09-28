import { getContentEmbedInfo } from "@/lib/content-embed";
import { buildCreatorProfileUrl } from "@/lib/report-export-links";
import { extractYoutubeId, isYoutubeShortUrl } from "@/lib/youtube-url";
import type { ReviewMetricsSource } from "./types";

export type ReviewPlatform = "youtube" | "instagram" | "tiktok" | "other";

export type ReviewMetricTone = "default" | "good" | "warn" | "bad";

export type ReviewMetricItem = {
  key: string;
  label: string;
  /** Formatted value; "-" when the platform or permissions don't provide it. */
  value: string;
  tone?: ReviewMetricTone;
};

export function resolveReviewPlatform(
  platform: string | null | undefined,
  contentLink: string | null | undefined,
): ReviewPlatform {
  const p = (platform || "").toLowerCase();
  if (p.includes("youtube")) return "youtube";
  if (p.includes("instagram")) return "instagram";
  if (p.includes("tiktok")) return "tiktok";
  const embed = getContentEmbedInfo(contentLink, { platform }).platform;
  return embed ?? "other";
}

/** YouTube caps Shorts at 3 minutes. */
const YOUTUBE_SHORT_MAX_SECONDS = 180;

/**
 * Portrait clips fill the stage height; long-form YouTube is shown 16:9.
 * Creators often submit Shorts as watch?v= / youtu.be links, so the URL alone
 * can't be trusted: a #shorts title or a <=3 min duration also counts.
 */
export function isVerticalReviewContent(
  platform: ReviewPlatform,
  contentLink: string | null | undefined,
  hints?: { title?: string | null; durationSeconds?: number | null },
): boolean {
  if (platform === "instagram" || platform === "tiktok") return true;
  if (platform !== "youtube") return true;
  if (isYoutubeShortUrl(contentLink)) return true;
  if (hints?.title && /#shorts?\b/i.test(hints.title)) return true;
  const duration = hints?.durationSeconds;
  return (
    duration != null &&
    Number.isFinite(duration) &&
    duration > 0 &&
    duration <= YOUTUBE_SHORT_MAX_SECONDS
  );
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "-";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    const m = minutes % 60;
    return m > 0 ? `${hours.toLocaleString()}h ${m}m` : `${hours.toLocaleString()}h`;
  }
  if (minutes > 0) {
    const s = seconds % 60;
    return s > 0 ? `${minutes}m ${s}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

function positiveOrDash(
  value: number | null | undefined,
  format: (v: number) => string = formatCompact,
): string {
  return value != null && Number.isFinite(value) && value > 0
    ? format(value)
    : "-";
}

/** Same thresholds as the submissions table's "Avg View %" column. */
function avgViewTone(pct: number | undefined): ReviewMetricTone {
  if (!pct || pct <= 0) return "default";
  if (pct < 10) return "bad";
  if (pct < 30) return "warn";
  return "good";
}

export function botScoreTone(score: number | null | undefined): ReviewMetricTone {
  if (score == null) return "default";
  if (score >= 60) return "bad";
  if (score >= 30) return "warn";
  return "good";
}

/** Engagement column on the video (Reels-style right rail). */
export function buildRailMetrics(
  platform: ReviewPlatform,
  m: ReviewMetricsSource,
  canSeeCore: boolean,
): ReviewMetricItem[] {
  const sharesVisible = platform !== "youtube" || canSeeCore;
  return [
    { key: "likes", label: "Likes", value: formatCompact(m.likes ?? 0) },
    { key: "comments", label: "Comments", value: formatCompact(m.comments ?? 0) },
    {
      key: "shares",
      label: "Shares",
      value: sharesVisible ? formatCompact(m.shares ?? 0) : "-",
    },
    { key: "views", label: "Views", value: formatCompact(m.views ?? 0) },
  ];
}

/**
 * Stored engagement rate, or interactions ÷ views (reach as fallback) when the
 * platform didn't report one — Instagram insights usually omit it.
 */
export function computeEngagementRate(m: ReviewMetricsSource): number | null {
  if (m.engagement_rate && m.engagement_rate > 0) return m.engagement_rate;
  const base = (m.views ?? 0) > 0 ? (m.views ?? 0) : (m.reach ?? 0);
  if (base <= 0) return null;
  const summed =
    (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
  const interactions =
    m.total_interactions && m.total_interactions > 0 ? m.total_interactions : summed;
  return interactions > 0 ? (interactions / base) * 100 : null;
}

function engagementTone(er: number | null): ReviewMetricTone {
  if (er == null || er <= 0) return "default";
  if (er < 1) return "bad";
  if (er < 3) return "warn";
  return "good";
}

/** Meta returns a percentage; some responses use 0–1 fractions. */
function normalizeSkipRate(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  const pct = value > 0 && value <= 1 ? value * 100 : value;
  return pct > 100 ? null : pct;
}

function skipRateTone(pct: number | null): ReviewMetricTone {
  if (pct == null) return "default";
  if (pct > 70) return "bad";
  if (pct > 50) return "warn";
  return "good";
}

function instagramAvgWatchPercent(
  m: ReviewMetricsSource,
  clipSeconds: number | null,
): number | null {
  const ms = m.avg_watch_time_ms ?? 0;
  if (ms <= 0 || !clipSeconds || clipSeconds <= 0) return null;
  return (ms / 1000 / clipSeconds) * 100;
}

function instagramWatchTone(pct: number | null): ReviewMetricTone {
  if (pct == null) return "default";
  if (pct < 25) return "bad";
  if (pct < 50) return "warn";
  return "good";
}

function clipLengthValue(clipSeconds: number | null): string {
  return positiveOrDash(clipSeconds ?? undefined, (v) => formatDurationMs(v * 1000));
}

/** Stored clip length, else what the player reported (Instagram Graph has none). */
export function resolveClipSeconds(
  m: ReviewMetricsSource,
  playerSeconds: number | null | undefined,
): number | null {
  const stored = m.duration_seconds;
  if (stored != null && Number.isFinite(stored) && stored > 0) return stored;
  return playerSeconds && playerSeconds > 0 ? playerSeconds : null;
}

/** Performance grid in the side panel, ordered per platform. */
export function buildPerformanceMetrics(
  platform: ReviewPlatform,
  m: ReviewMetricsSource,
  canSeeCore: boolean,
  clipSeconds: number | null = null,
): ReviewMetricItem[] {
  const core = (value: string) => (canSeeCore ? value : "-");
  const er = computeEngagementRate(m);
  const erItem: ReviewMetricItem = {
    key: "er",
    label: "Engagement",
    value: er != null ? `${er.toFixed(2)}%` : "-",
    tone: engagementTone(er),
  };

  if (platform === "youtube") {
    return [
      { key: "views", label: "Views", value: formatCompact(m.views ?? 0) },
      {
        key: "engaged_views",
        label: "Engaged views",
        value: core(positiveOrDash(m.engaged_views)),
      },
      {
        key: "avg_view_pct",
        label: "Avg view %",
        value: core(
          positiveOrDash(m.avg_view_percentage, (v) => `${v.toFixed(1)}%`),
        ),
        tone: canSeeCore ? avgViewTone(m.avg_view_percentage) : "default",
      },
      {
        key: "avg_duration",
        label: "Avg duration",
        value: core(
          positiveOrDash(m.avg_view_duration_seconds, (v) =>
            formatDurationMs(v * 1000),
          ),
        ),
      },
      {
        key: "watch_time",
        label: "Watch time",
        value: core(
          positiveOrDash(m.estimated_minutes_watched, (v) =>
            formatDurationMs(v * 60_000),
          ),
        ),
      },
      {
        key: "subs",
        label: "Subs gained",
        value: core(positiveOrDash(m.subscribers_gained, (v) => `+${formatCompact(v)}`)),
      },
      {
        key: "subs_lost",
        label: "Subs lost",
        value: core(positiveOrDash(m.subscribers_lost, (v) => `-${formatCompact(v)}`)),
      },
      { key: "likes", label: "Likes", value: formatCompact(m.likes ?? 0) },
      { key: "comments", label: "Comments", value: formatCompact(m.comments ?? 0) },
      {
        key: "shares",
        label: "Shares",
        value: core(positiveOrDash(m.shares)),
      },
      {
        key: "dislikes",
        label: "Dislikes",
        value: core(formatCompact(m.dislikes ?? 0)),
      },
      {
        key: "playlist_adds",
        label: "Playlist adds",
        value: core(positiveOrDash(m.videos_added_to_playlists)),
      },
      erItem,
      { key: "clip", label: "Clip length", value: clipLengthValue(clipSeconds) },
    ];
  }

  if (platform === "instagram") {
    const skip = normalizeSkipRate(m.reels_skip_rate);
    const watchPct = instagramAvgWatchPercent(m, clipSeconds);
    return [
      { key: "views", label: "Views", value: formatCompact(m.views ?? 0) },
      { key: "reach", label: "Reach", value: positiveOrDash(m.reach) },
      { key: "likes", label: "Likes", value: formatCompact(m.likes ?? 0) },
      { key: "comments", label: "Comments", value: formatCompact(m.comments ?? 0) },
      { key: "shares", label: "Shares", value: formatCompact(m.shares ?? 0) },
      { key: "saves", label: "Saves", value: positiveOrDash(m.saves) },
      { key: "reposts", label: "Reposts", value: positiveOrDash(m.reposts) },
      {
        key: "interactions",
        label: "Interactions",
        value: positiveOrDash(m.total_interactions),
      },
      erItem,
      {
        key: "skip",
        label: "Skip rate (3s)",
        value: skip != null ? `${skip.toFixed(1)}%` : "-",
        tone: skipRateTone(skip),
      },
      {
        key: "avg_watch",
        label: "Avg watch time",
        value: positiveOrDash(m.avg_watch_time_ms, formatDurationMs),
      },
      {
        key: "avg_watch_pct",
        label: "Avg watch %",
        value: watchPct != null ? `${watchPct.toFixed(0)}%` : "-",
        tone: instagramWatchTone(watchPct),
      },
      {
        key: "total_watch",
        label: "Watch time",
        value: positiveOrDash(m.total_watch_time_ms, formatDurationMs),
      },
      { key: "clip", label: "Clip length", value: clipLengthValue(clipSeconds) },
    ];
  }

  return [
    { key: "views", label: "Views", value: formatCompact(m.views ?? 0) },
    { key: "likes", label: "Likes", value: formatCompact(m.likes ?? 0) },
    { key: "comments", label: "Comments", value: formatCompact(m.comments ?? 0) },
    { key: "shares", label: "Shares", value: formatCompact(m.shares ?? 0) },
    erItem,
    { key: "clip", label: "Clip length", value: clipLengthValue(clipSeconds) },
  ];
}

export type ModerationOptions = {
  /** Paid clips can only be reversed from the table (needs the reversal flow). */
  locked: boolean;
  canApprove: boolean;
  canReject: boolean;
  canMoveToPending: boolean;
};

export function getModerationOptions(status: string): ModerationOptions {
  switch (status) {
    case "paid":
      return { locked: true, canApprove: false, canReject: false, canMoveToPending: false };
    case "verified":
    case "approved":
      return { locked: false, canApprove: false, canReject: true, canMoveToPending: true };
    case "rejected":
      return { locked: false, canApprove: true, canReject: false, canMoveToPending: true };
    default:
      return { locked: false, canApprove: true, canReject: true, canMoveToPending: false };
  }
}

export function platformLabel(
  platform: ReviewPlatform,
  vertical: boolean,
): string {
  switch (platform) {
    case "youtube":
      return vertical ? "YouTube Short" : "YouTube";
    case "instagram":
      return "Instagram Reel";
    case "tiktok":
      return "TikTok";
    default:
      return "Video";
  }
}

/** YouTube opens in the Shorts player for Shorts and the watch page for long-form. */
export function getReviewOpenUrl(
  platform: ReviewPlatform,
  contentLink: string | null | undefined,
  vertical: boolean,
): string | null {
  if (!contentLink) return null;
  if (platform !== "youtube") return contentLink;
  const id = extractYoutubeId(contentLink);
  if (!id) return contentLink;
  return vertical
    ? `https://www.youtube.com/shorts/${id}`
    : `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Creator's public profile on the submission platform. YouTube handles may be a
 * raw channel id (`UC…`) when the channel has no custom URL.
 */
export function getCreatorProfileUrl(
  platform: ReviewPlatform,
  username: string | null | undefined,
): string | null {
  const handle = String(username || "").trim();
  if (!handle || handle === "Unknown User") return null;
  if (platform === "youtube" && /^UC[\w-]{22}$/.test(handle)) {
    return `https://www.youtube.com/channel/${handle}`;
  }
  return buildCreatorProfileUrl(handle, platform);
}

export function originalLinkLabel(platform: ReviewPlatform): string {
  switch (platform) {
    case "youtube":
      return "Open on YouTube";
    case "instagram":
      return "Open on Instagram";
    case "tiktok":
      return "Open on TikTok";
    default:
      return "Open original";
  }
}
