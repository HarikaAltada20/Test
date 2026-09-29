/** Client-safe Instagram clip / insights metric helpers. */

/** Pin Graph version per Meta guidance for post-2025 insight metrics. */
export const IG_GRAPH_VERSION = "v25.0";

/**
 * Feed / non-Reel insights. Do NOT include reels_skip_rate or ig_reels_* —
 * Graph rejects the entire batch (code 100) if those are requested on IMAGE/FEED.
 */
export const IG_FEED_INSIGHTS_METRICS =
  "reach,likes,comments,shares,saved,total_interactions,views,reposts";

/** Safe fallback when a typed metric list still fails validation. */
export const IG_BASE_INSIGHTS_METRICS =
  "reach,likes,comments,shares,saved,total_interactions,views";

/**
 * Reel insights including optional skip rate + watch-time metrics.
 * Only use when media_product_type === "REELS".
 */
export const IG_REELS_INSIGHTS_METRICS =
  "reach,likes,comments,shares,saved,total_interactions,views,reposts,reels_skip_rate,ig_reels_avg_watch_time,ig_reels_video_view_total_time";

/** Reel metrics without skip rate (keep reposts + watch time). */
export const IG_REELS_INSIGHTS_METRICS_CORE =
  "reach,likes,comments,shares,saved,total_interactions,views,reposts,ig_reels_avg_watch_time,ig_reels_video_view_total_time";

/** Optional metrics to fetch separately when omitted from the main response. */
export const IG_OPTIONAL_REELS_METRICS = "reposts,reels_skip_rate";
export const IG_OPTIONAL_FEED_METRICS = "reposts";

export function insightsMetricsForMediaProductType(
  mediaProductType: string | null | undefined,
): string {
  const t = String(mediaProductType || "").toUpperCase();
  return t === "REELS" ? IG_REELS_INSIGHTS_METRICS : IG_FEED_INSIGHTS_METRICS;
}

export function coreInsightsMetricsForMediaProductType(
  mediaProductType: string | null | undefined,
): string {
  const t = String(mediaProductType || "").toUpperCase();
  return t === "REELS" ? IG_REELS_INSIGHTS_METRICS_CORE : IG_BASE_INSIGHTS_METRICS;
}

/** @deprecated Graph does not expose video_duration; kept for numeric parsing helpers. */
export function parseInstagramVideoDuration(
  raw: unknown,
): number | null {
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseFloat(raw)
        : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed > 6000 ? Math.round(parsed / 1000) : Math.round(parsed);
}

/**
 * Format `reels_skip_rate` for tables.
 * Meta returns a percentage; some responses use 0–1 fractions — normalize for display.
 */
export function formatReelsSkipRate(
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "—";
  const pct = value > 0 && value <= 1 ? value * 100 : value;
  if (pct > 100) return "—";
  return `${pct.toFixed(1)}%`;
}

/**
 * Avg watch % = avg watch time ÷ reel duration.
 * Computed only — never stored. May exceed 100% when replays inflate avg watch.
 */
export function computeAvgWatchPercent(
  avgWatchTimeMs: number | null | undefined,
  durationSeconds: number | null | undefined,
): number | null {
  const ms = Number(avgWatchTimeMs);
  const duration = Number(durationSeconds);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return (ms / 1000 / duration) * 100;
}

export function formatAvgWatchPercent(
  avgWatchTimeMs: number | null | undefined,
  durationSeconds: number | null | undefined,
): string {
  const pct = computeAvgWatchPercent(avgWatchTimeMs, durationSeconds);
  if (pct == null) return "—";
  return `${pct.toFixed(1)}%`;
}

/**
 * Whether to retry /insights with a narrower metric list.
 * Only for invalid/unsupported metric-list errors — never for permanent media,
 * token errors, rate limits, or generic temporary failures.
 */
export function shouldRetryInsightsWithoutOptionalMetrics(error: {
  code?: number;
  error_subcode?: number;
  message?: string;
}): boolean {
  const code = error.code;
  const subcode = error.error_subcode;
  // permanent_media (100/33) and account_token (190)
  if (code === 100 && subcode === 33) return false;
  if (code === 190) return false;

  const message = String(error.message || "").toLowerCase();
  const looksLikeInvalidMetric =
    /metric|reposts|reels_skip_rate|invalid parameter|nonexisting field|tried accessing nonexisting/.test(
      message,
    );

  // Graph often uses code 100 for invalid params; exclude permanent_media above.
  // Avoid bare "unsupported" — that matches permanent-media "Unsupported get request".
  if (code === 100 && subcode !== 33) {
    return looksLikeInvalidMetric || !message;
  }

  return looksLikeInvalidMetric;
}
