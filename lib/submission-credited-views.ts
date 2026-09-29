/**
 * View count used when crediting submission_views_credited → creator_profiles.total_views.
 * Aligns with contest-detail CPM / metrics display where platform stats can exceed the column.
 */

export type SubmissionViewsCreditRow = {
  views?: number | null;
  platform?: string | null;
  other_stats?: unknown;
};

export function getSubmissionViewsForCrediting(
  row: SubmissionViewsCreditRow,
): number {
  const platform = String(row.platform || "").toLowerCase();
  const baseViews = Number(row.views ?? 0);

  if (platform.includes("tiktok")) {
    const stats = (row.other_stats || {}) as Record<string, unknown>;
    const t = (stats.tiktok ?? {}) as Record<string, unknown>;
    const fromStats = Number(t.view_count ?? t.views ?? NaN);
    if (Number.isFinite(fromStats) && fromStats > 0) {
      return Math.max(0, Math.floor(fromStats));
    }
    return Number.isFinite(baseViews) ? Math.max(0, Math.floor(baseViews)) : 0;
  }

  if (platform.includes("instagram")) {
    const stats = (row.other_stats || {}) as Record<string, unknown>;
    const ig =
      stats.instagram && typeof stats.instagram === "object"
        ? (stats.instagram as Record<string, unknown>)
        : stats;
    const igViews = Number(ig.views ?? 0);
    let raw = Math.max(baseViews, igViews);
    const reach = Number(ig.reach ?? 0);
    if (raw === 0 && reach > 0) raw = reach;
    return Math.max(0, Math.floor(raw));
  }

  return Number.isFinite(baseViews) ? Math.max(0, Math.floor(baseViews)) : 0;
}

export const CONTEST_VIEWS_SYNC_FAILED_MESSAGE =
  "Views could not be updated on creator profiles, so the status change was not applied. Please try again.";
