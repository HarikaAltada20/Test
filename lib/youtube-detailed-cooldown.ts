export type YoutubeDetailedRefreshType =
  | "core"
  | "traffic"
  | "demographics"
  | "all"
  | "all_standard";

export type YoutubeDetailedLastUpdated = {
  core?: string | null;
  traffic?: string | null;
  demographics?: string | null;
};

/**
 * Timestamp used to gate a detailed YouTube refresh.
 * Per-scope buttons use that scope. "all" / "all_standard" use the newest
 * timestamp so a recent Core refresh still blocks Refresh all.
 */
export function youtubeDetailedCooldownTimestamp(
  type: YoutubeDetailedRefreshType,
  ytLast: YoutubeDetailedLastUpdated,
): string | null {
  if (type === "core") return ytLast.core ?? null;
  if (type === "traffic") return ytLast.traffic ?? null;
  if (type === "demographics") return ytLast.demographics ?? null;
  const timestamps = [ytLast.core, ytLast.traffic, ytLast.demographics].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return timestamps.reduce<string | null>(
    (newest, current) => (!newest || current > newest ? current : newest),
    null,
  );
}
