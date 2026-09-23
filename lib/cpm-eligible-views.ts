/**
 * View count used for CPM math. Matches contest-detail
 * `getCpmBasisViewCountForSubmission`: TikTok prefers other_stats view_count,
 * Instagram prefers nested views then reach.
 */
export function getCpmEligibleViewsFromRow(row: {
  views?: number | null;
  platform?: string | null;
  other_stats?: unknown;
}): number {
  const platform = String(row.platform || "").toLowerCase();
  const parsedStats =
    typeof row.other_stats === "string"
      ? (() => {
          try {
            return JSON.parse(row.other_stats) as unknown;
          } catch {
            return null;
          }
        })()
      : row.other_stats;
  const stats =
    parsedStats && typeof parsedStats === "object"
      ? (parsedStats as Record<string, unknown>)
      : {};

  const firstPositive = (...values: unknown[]): number => {
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  };

  if (platform.includes("tiktok")) {
    const tiktok =
      stats.tiktok && typeof stats.tiktok === "object"
        ? (stats.tiktok as Record<string, unknown>)
        : {};
    const tiktokViews = firstPositive(
      tiktok.view_count,
      tiktok.views,
      tiktok.viewCount,
      stats.view_count,
      stats.views,
      row.views,
    );
    if (tiktokViews > 0) return tiktokViews;
  }

  let raw = Number(row.views ?? 0);
  if (!Number.isFinite(raw)) raw = 0;

  if (platform.includes("instagram")) {
    const ig =
      stats.instagram && typeof stats.instagram === "object"
        ? (stats.instagram as Record<string, unknown>)
        : stats;
    const igViews = Number(ig.views ?? 0);
    if (Number.isFinite(igViews)) raw = Math.max(raw, igViews);
    const reach = Number(ig.reach ?? 0);
    if (raw === 0 && Number.isFinite(reach) && reach > 0) raw = reach;
  }

  return Math.max(0, raw);
}
