/**
 * Convert watch-time values from TikTok APIs to milliseconds.
 * Assumes numeric seconds unless the value is implausibly large (then treat as ms).
 */
export function watchTimeToMsSeconds(value: number): number {
  if (!value || !Number.isFinite(value)) return 0;
  if (value > 3 * 3600) return Math.round(value);
  return Math.round(value * 1000);
}
