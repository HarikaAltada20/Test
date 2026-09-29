/** Root keys in other_stats that belong to other platforms, not YouTube metrics. */
const NON_YOUTUBE_ROOT_KEYS = new Set([
  "instagram",
  "tiktok",
  "twitter",
  "x",
]);

/**
 * Parse submission.other_stats whether stored as JSON object or legacy string.
 */
export function parseSubmissionOtherStats(
  raw: unknown,
): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Collect all YouTube metric fields from nested `youtube` and legacy root-level keys.
 */
export function getExistingYouTubeStats(
  otherStatsRaw: unknown,
): Record<string, unknown> {
  const otherStats = parseSubmissionOtherStats(otherStatsRaw);
  const nested =
    otherStats.youtube &&
    typeof otherStats.youtube === "object" &&
    !Array.isArray(otherStats.youtube)
      ? ({ ...(otherStats.youtube as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};

  const legacyRoot: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(otherStats)) {
    if (key === "youtube" || NON_YOUTUBE_ROOT_KEYS.has(key)) continue;
    legacyRoot[key] = value;
  }

  return { ...legacyRoot, ...nested };
}

/** Merge youtube metrics into other_stats without dropping sibling platform keys. */
export function buildOtherStatsWithYoutube(
  otherStatsRaw: unknown,
  youtubePatch: Record<string, unknown>,
): Record<string, unknown> {
  const otherStats = parseSubmissionOtherStats(otherStatsRaw);
  const existingYoutube = getExistingYouTubeStats(otherStatsRaw);
  return {
    ...otherStats,
    youtube: { ...existingYoutube, ...youtubePatch },
  };
}

/** True when a non-null plain object has at least one key. */
export function hasNonEmptyRecord(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}
