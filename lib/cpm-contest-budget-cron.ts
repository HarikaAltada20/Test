/**
 * Shared CPM budget_spent rollup for YouTube / Instagram / TikTok metrics crons.
 *
 * Multi-platform contests store:
 * - contests.platform as CSV (e.g. "youtube,instagram,tiktok")
 * - max_earnings_per_creator as a keyed jsonb map
 * - CPM rates under contest_based_details.youtube|instagram|tiktok
 *
 * Persist via persistContestBudgetSpent (platform-aware caps + nested CPM config)
 * instead of dividing max_earnings_per_creator as a bare number (NaN on maps).
 */

import { persistContestBudgetSpent } from "@/lib/persist-contest-budget-spent";
import {
  isContestEligibleForScheduledMetricsCron,
  isContestEligibleForScheduledMetricsRefresh,
  SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER,
} from "@/lib/contest-metrics-refresh-eligibility";
import {
  contestHasUsableCpmRate,
  parseVideoContestPlatforms,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";
import type { SupabaseClient } from "@supabase/supabase-js";

type EligibilityMode = "cron" | "refresh";

export async function updateVideoPlatformCpmContestBudgets(
  supabaseAdmin: { from: (t: string) => any },
  options: {
    platform: VideoContestPlatform;
    contestId?: string;
    /** "cron" = published + live/ended window (YouTube). "refresh" = unlocked only. */
    eligibility?: EligibilityMode;
    logPrefix?: string;
  },
): Promise<void> {
  const {
    platform,
    contestId,
    eligibility = "refresh",
    logPrefix = "[cpm-contest-budget-cron]",
  } = options;

  try {
    let query = supabaseAdmin
      .from("contests")
      .select(
        "id, platform, contest_based_details, views_locked_at, post_contest_status, start_date, end_date, moderation_status",
      )
      .eq("contest_type", "cpm")
      .not("contest_based_details", "is", null)
      .is("views_locked_at", null)
      .or(SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER);

    if (eligibility === "cron") {
      query = query
        .eq("moderation_status", "published")
        .not("start_date", "is", null)
        .not("end_date", "is", null)
        .lte("start_date", new Date().toISOString());
    }

    if (contestId) {
      query = query.eq("id", contestId);
    }

    const { data: contests, error } = await query;
    if (error || !contests?.length) {
      return;
    }

    const eligible = contests.filter((contest: Record<string, any>) => {
      if (eligibility === "cron") {
        if (!isContestEligibleForScheduledMetricsCron(contest)) return false;
      } else if (!isContestEligibleForScheduledMetricsRefresh(contest)) {
        return false;
      }

      const platforms = parseVideoContestPlatforms(contest.platform);
      if (!platforms.includes(platform)) return false;

      return contestHasUsableCpmRate(
        contest.contest_based_details as Record<string, unknown> | null,
        contest.platform,
      );
    });

    if (!eligible.length) return;

    for (const contest of eligible) {
      const ok = await persistContestBudgetSpent(
        contest.id,
        supabaseAdmin as SupabaseClient,
      );
      if (!ok) {
        console.error(`${logPrefix} persist failed:`, contest.id);
        continue;
      }

      const now = new Date().toISOString();
      await supabaseAdmin
        .from("contests")
        .update({ last_metrics_updated: now, updated_at: now })
        .eq("id", contest.id);
    }
  } catch (error) {
    console.error(`${logPrefix} CPM budget update failed:`, error);
  }
}
