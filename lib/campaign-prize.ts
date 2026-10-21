import { resolveContestPoolBudgetCents } from "@/lib/video-platform-campaigns";

/**
 * Prize pool (cents) to show creators for a campaign. Leaderboard campaigns
 * keep their prize in leaderboard_contest.total_prize, which the shared pool
 * resolver doesn't read; every other type uses that resolver.
 */
export function resolveCampaignPrizeCents(
  contestType: string | null | undefined,
  details: Record<string, unknown> | null | undefined,
  platformCsv?: string | null,
): number {
  if (contestType === "leaderboard") {
    const leaderboard = details?.leaderboard_contest as { total_prize?: unknown } | undefined;
    const prize = Number(leaderboard?.total_prize);
    if (Number.isFinite(prize) && prize > 0) return Math.round(prize);
  }
  return resolveContestPoolBudgetCents(contestType, details, platformCsv);
}
