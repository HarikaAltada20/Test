import type { BrandContestRow } from "@/lib/brand-analytics-cache";
import { normalizeBrandPlatformKey } from "@/lib/brand-analytics-graph";
import {
  getBudgetTileLabel,
  getBudgetTileMode,
  getCampaignBudgetCents,
  getPoolBudgetSpentCentsForDisplay,
  type BudgetTileMetrics,
  type ContestBudgetTileInput,
} from "@/lib/contest-budget-tile-metrics";

function toContestBudgetInput(contest: BrandContestRow): ContestBudgetTileInput {
  return {
    contest_type: contest.contest_type,
    post_contest_status: contest.post_contest_status,
    max_earnings_per_creator: contest.max_earnings_per_creator ?? null,
    contest_based_details: contest.contest_based_details as
      | Record<string, unknown>
      | null
      | undefined,
  };
}

export async function fetchTwitterLeaderboardPaidByContest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (contestIds.length === 0) return result;

  const CONTEST_ID_CHUNK = 200;
  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase.rpc(
      "brand_analytics_twitter_paid_by_contest",
      { p_contest_ids: idChunk },
    );

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const contestId = String(row.contest_id ?? "");
      if (!contestId) continue;
      result.set(contestId, Number(row.paid_cents) || 0);
    }
  }

  return result;
}

export function resolveContestBudgetTile(
  contest: BrandContestRow,
  rollupPayoutsCents: number,
  twitterLeaderboardPaidCents?: number,
): BudgetTileMetrics | null {
  const contestInput = toContestBudgetInput(contest);
  const denominatorCents = getCampaignBudgetCents(contestInput);
  if (denominatorCents <= 0) return null;

  const mode = getBudgetTileMode(contest.post_contest_status);
  let numeratorCents =
    mode === "paid"
      ? Math.max(0, rollupPayoutsCents)
      : getPoolBudgetSpentCentsForDisplay(contestInput);

  if (
    mode === "paid" &&
    normalizeBrandPlatformKey(contest) === "twitter" &&
    twitterLeaderboardPaidCents != null &&
    twitterLeaderboardPaidCents > 0
  ) {
    numeratorCents = twitterLeaderboardPaidCents;
  }

  numeratorCents = Math.max(0, numeratorCents);

  return {
    mode,
    numeratorCents,
    denominatorCents,
    label: getBudgetTileLabel(mode),
  };
}
