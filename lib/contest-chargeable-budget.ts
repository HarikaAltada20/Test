import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";

export type ContestForChargeableBudget = {
  id: string;
  contest_type?: string | null;
  contest_based_details?: Record<string, unknown> | null;
};

function sumLeaderboardPrizes(
  prizes: Array<{ amount?: number | null }> | undefined,
): number {
  if (!prizes?.length) return 0;
  return prizes.reduce((sum, prize) => sum + (Number(prize.amount) || 0), 0);
}

/** Prize-pool base (before commission) stored in contest_based_details. Client-safe (no server imports). */
export function getChargeableBudgetCents(
  contest: ContestForChargeableBudget,
): number {
  const contestType = contest.contest_type;
  const details = contest.contest_based_details;

  if (contestType === "leaderboard") {
    const leaderboard = (details?.leaderboard_contest ?? {}) as {
      total_prize?: number | null;
      total_budget?: number | null;
      flat_fee_bonus?: number | null;
      prizes?: Array<{ amount?: number | null }>;
    };

    const totalPrize =
      typeof leaderboard.total_prize === "number" && leaderboard.total_prize > 0
        ? leaderboard.total_prize
        : sumLeaderboardPrizes(leaderboard.prizes);

    if (totalPrize <= 0) return 0;

    const flatFeeBonus = Number(leaderboard.flat_fee_bonus) || 0;
    const bonusBudget = Number(leaderboard.total_budget) || 0;
    if (flatFeeBonus > 0 && bonusBudget > 0) {
      return totalPrize + bonusBudget;
    }

    return totalPrize;
  }

  return getPoolBudgetCentsFromDetails(
    contestType,
    (details ?? null) as Parameters<typeof getPoolBudgetCentsFromDetails>[1],
  );
}
