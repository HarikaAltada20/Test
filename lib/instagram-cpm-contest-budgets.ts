import { updateVideoPlatformCpmContestBudgets } from "@/lib/cpm-contest-budget-cron";

/**
 * CPM budget rollup for Instagram (and multi-platform contests that include it).
 * Kept out of lib/instagram-insights.ts so client bundles that import
 * classifyInsightsError / fetch helpers do not pull next/headers via
 * persist-contest-budget-spent → contest-service.
 */
export async function updateCpmContestBudgets(
  supabaseAdmin: { from: (t: string) => any },
  contestId?: string,
): Promise<void> {
  await updateVideoPlatformCpmContestBudgets(supabaseAdmin, {
    platform: "instagram",
    contestId,
    eligibility: "refresh",
    logPrefix: "[instagram-cpm-contest-budgets]",
  });
}
