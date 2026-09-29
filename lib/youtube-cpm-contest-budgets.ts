import { updateVideoPlatformCpmContestBudgets } from "@/lib/cpm-contest-budget-cron";

/**
 * CPM budget rollup for YouTube (and multi-platform contests that include YouTube).
 * Used by the YouTube metrics cron and the queue processor after a refresh run completes.
 */
export async function updateYouTubeCpmContestBudgets(
  supabaseAdmin: { from: (t: string) => any },
  contestId?: string,
): Promise<void> {
  await updateVideoPlatformCpmContestBudgets(supabaseAdmin, {
    platform: "youtube",
    contestId,
    eligibility: "cron",
    logPrefix: "[youtube-cpm-contest-budgets]",
  });
}
