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
  const stats =
    row.other_stats && typeof row.other_stats === "object"
      ? (row.other_stats as Record<string, unknown>)
      : {};

  if (platform.includes("tiktok")) {
    const tiktok =
      stats.tiktok && typeof stats.tiktok === "object"
        ? (stats.tiktok as Record<string, unknown>)
        : {};
    const tiktokViews = Number(tiktok.view_count ?? tiktok.views ?? 0);
    if (Number.isFinite(tiktokViews) && tiktokViews > 0) return tiktokViews;
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
