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
