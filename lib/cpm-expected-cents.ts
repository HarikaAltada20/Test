import { getCpmEligibleViewsFromRow } from "@/lib/cpm-eligible-views";
import { resolveCpmContestConfigForPlatform } from "@/lib/video-platform-campaigns";

export type CpmExpectedCentsRow = {
  views?: number | null;
  platform?: string | null;
  other_stats?: unknown;
  manual_points_adjustment?: number | null;
  is_twitter_tweet?: boolean;
};

/**
 * Formula CPM cents for a submission using that platform's rate and view source.
 */
export function computeCpmRawCentsForRow(
  row: CpmExpectedCentsRow,
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): number {
  const cfg = resolveCpmContestConfigForPlatform(
    details,
    row.platform,
    contestPlatformCsv,
  );
  if (!cfg || !(cfg.cpm_rate_usd > 0)) return 0;

  const platform = String(row.platform || "").toLowerCase();
  const isTwitter =
    row.is_twitter_tweet === true ||
    platform === "twitter" ||
    platform === "x";

  if (isTwitter) {
    const stats =
      row.other_stats && typeof row.other_stats === "object"
        ? (row.other_stats as Record<string, unknown>)
        : {};
    const basePoints = Number(stats.base_points || 0);
    const manual = Number(row.manual_points_adjustment || 0);
    const totalPoints = Math.max(basePoints + manual, 0);
    return Math.max(Math.round((totalPoints * cfg.cpm_rate_usd * 100) / 1000), 0);
  }

  let views = getCpmEligibleViewsFromRow(row);
  const minViews =
    cfg.min_views == null ? null : Number(cfg.min_views);
  const maxViews =
    cfg.max_views == null ? null : Number(cfg.max_views);
  if (minViews != null && Number.isFinite(minViews) && views < minViews) {
    views = 0;
  }
  if (maxViews != null && Number.isFinite(maxViews) && views > maxViews) {
    views = maxViews;
  }
  return Math.max(Math.round((views * cfg.cpm_rate_usd * 100) / 1000), 0);
}
