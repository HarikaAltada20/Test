/**
 * Highest-platform-only campaigns: review (which freezes views) may start only
 * after every campaign platform has had a views refresh that began after the
 * campaign end date, so each creator's best platform uses final views.
 */
import { isPostContestMetricsLocked } from "@/lib/contest-metrics-refresh-eligibility";
import { countEligibleLiveSubmissionsForPlatform } from "@/lib/eligible-live-submissions-for-refresh";
import {
  isHighestPlatformPayoutOnly,
  type HighestPlatformContest,
} from "@/lib/highest-platform-payout";
import {
  VIDEO_PLATFORM_LABELS,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

/** Each platform's metrics refresh-run table. */
export const PLATFORM_REFRESH_RUN_TABLES: Record<VideoContestPlatform, string> = {
  youtube: "youtube_metrics_refresh_runs",
  instagram: "instagram_insights_refresh_runs",
  tiktok: "tiktok_metrics_refresh_runs",
};

/** YouTube run scopes that refresh views (core/traffic/demographics are analytics only). */
export const YOUTUBE_VIEWS_REFRESH_SCOPES = ["basic", "all", "all_standard"];

/**
 * True when this status change freezes views on a highest-platform-only
 * campaign whose views are not frozen yet (normally → in_review).
 */
export function requiresFinalRefreshBeforeReview(
  contest: HighestPlatformContest & { views_locked_at?: string | null },
  currentStatus: string | null | undefined,
  nextStatus: string,
): boolean {
  return (
    isHighestPlatformPayoutOnly(contest) &&
    !contest.views_locked_at &&
    !isPostContestMetricsLocked(currentStatus) &&
    isPostContestMetricsLocked(nextStatus)
  );
}

export function finalRefreshRequiredMessage(
  platforms: VideoContestPlatform[],
): string {
  const names = platforms.map((p) => VIDEO_PLATFORM_LABELS[p]).join(", ");
  return `Refresh every platform (${names}) after the campaign end date before starting review, so each creator's best platform uses final views.`;
}

/**
 * Campaign platforms with no completed submissions refresh that started after
 * `endDate` (platforms with no submissions to refresh are skipped).
 */
export async function platformsMissingRefreshAfterEnd(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
  platforms: VideoContestPlatform[],
  endDate: string,
): Promise<{ missing: VideoContestPlatform[]; error: string | null }> {
  const missing: VideoContestPlatform[] = [];
  for (const platform of platforms) {
    let query = supabase
      .from(PLATFORM_REFRESH_RUN_TABLES[platform])
      .select("id")
      .eq("contest_id", contestId)
      .eq("status", "completed")
      .gt("started_at", endDate)
      // Pre-migration rows have no metrics_target; they refreshed submissions.
      .or("metrics_target.is.null,metrics_target.eq.submissions");
    if (platform === "youtube") {
      query = query.in("scope", YOUTUBE_VIEWS_REFRESH_SCOPES);
    }
    const { data, error } = await query.limit(1);
    if (error) {
      return { missing: [], error: String(error.message || error) };
    }
    if (data?.length) continue;
    // Refresh skips a platform with nothing to refresh, so it never gets a run.
    const eligible = await countEligibleLiveSubmissionsForPlatform(
      supabase,
      contestId,
      platform,
    );
    if (eligible > 0) missing.push(platform);
  }
  return { missing, error: null };
}
