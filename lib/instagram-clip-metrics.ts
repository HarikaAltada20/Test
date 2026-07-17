/** Client-safe Instagram clip / insights metric helpers. */

/** Parse Graph `video_duration` (seconds, or ms when value is very large). */
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
  // Graph may return seconds (or occasionally ms for very large values).
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
 * Whether to retry /insights without optional metrics (reposts, reels_skip_rate).
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
    /metric|reposts|reels_skip_rate|invalid parameter|nonexisting field|unsupported/.test(
      message,
    );

  // Graph often uses code 100 for invalid params; exclude permanent_media above.
  if (code === 100 && subcode !== 33) {
    return looksLikeInvalidMetric || !message;
  }

  return looksLikeInvalidMetric;
}
