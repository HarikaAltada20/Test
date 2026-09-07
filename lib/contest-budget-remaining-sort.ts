import {
  isCpmContestType,
} from "@/lib/contest-type";
import { getPoolBudgetSpentCentsForDisplay } from "@/lib/contest-budget-tile-metrics";
import {
  resolveContestPoolBudgetCents,
  resolveLeaderboardFlatFeeBonusBudgetCents,
} from "@/lib/video-platform-campaigns";

type ContestBudgetSortInput = {
  contest_type?: string | null;
  platform?: string | null;
  post_contest_status?: string | null;
  contest_based_details?: Record<string, unknown> | null;
};

function getRemainingFromTotalAndSpent(
  total: number,
  budgetSpent?: number | null,
): number {
  if (total <= 0) return -1;
  const spent = Math.max(0, budgetSpent ?? 0);
  const clampedSpent = Math.min(spent, total);
  return Math.max(total - clampedSpent, 0);
}

/** Remaining pool budget (cents) for list sorting; -1 when not applicable. */
export function getContestBudgetRemainingForSort(
  contest: ContestBudgetSortInput,
): number {
  const details = contest.contest_based_details;
  if (!details || !contest.contest_type) return -1;

  if (contest.contest_type === "leaderboard") {
    const bonusBudget = resolveLeaderboardFlatFeeBonusBudgetCents(
      details,
      contest.platform,
    );
    if (bonusBudget > 0) {
      return getRemainingFromTotalAndSpent(
        bonusBudget,
        getPoolBudgetSpentCentsForDisplay({
          contest_type: contest.contest_type,
          post_contest_status: contest.post_contest_status,
          contest_based_details: details,
          platform: contest.platform,
        }),
      );
    }
    const leaderboard = details.leaderboard_contest as
      | { total_prize?: number }
      | undefined;
    if (leaderboard?.total_prize != null && leaderboard.total_prize > 0) {
      return leaderboard.total_prize;
    }
    return -1;
  }

  if (contest.contest_type === "milestone") {
    const milestone = details.milestone_contest as
      | { total_budget_cents?: number; budget_spent?: number }
      | undefined;
    const total = milestone?.total_budget_cents ?? 0;
    return getRemainingFromTotalAndSpent(total, milestone?.budget_spent);
  }

  if (isCpmContestType(contest.contest_type)) {
    const total = resolveContestPoolBudgetCents(
      contest.contest_type,
      details,
      contest.platform,
    );
    if (total <= 0) return -1;

    const spent = getPoolBudgetSpentCentsForDisplay({
      contest_type: contest.contest_type,
      post_contest_status: (contest as { post_contest_status?: string | null })
        .post_contest_status,
      contest_based_details: details,
    });

    return getRemainingFromTotalAndSpent(total, spent);
  }

  return -1;
}

export function compareContestBudgetRemaining(
  a: ContestBudgetSortInput,
  b: ContestBudgetSortInput,
  order: "budget_remaining_desc" | "budget_remaining_asc",
): number {
  const remA = getContestBudgetRemainingForSort(a);
  const remB = getContestBudgetRemainingForSort(b);

  if (remA === -1 && remB === -1) return 0;
  if (remA === -1) return 1;
  if (remB === -1) return -1;

  return order === "budget_remaining_desc" ? remB - remA : remA - remB;
}

/** Spent pool budget (cents) for list sorting; -1 when not applicable. */
export function getContestBudgetSpentForSort(
  contest: ContestBudgetSortInput,
): number {
  const details = contest.contest_based_details;
  if (!details || !contest.contest_type) return -1;

  if (contest.contest_type === "leaderboard") {
    const bonusBudget = resolveLeaderboardFlatFeeBonusBudgetCents(
      details,
      contest.platform,
    );
    if (bonusBudget <= 0) return -1;
    return Math.max(
      0,
      getPoolBudgetSpentCentsForDisplay({
        contest_type: contest.contest_type,
        post_contest_status: contest.post_contest_status,
        contest_based_details: details,
        platform: contest.platform,
      }),
    );
  }

  if (contest.contest_type === "milestone") {
    const milestone = details.milestone_contest as
      | { total_budget_cents?: number; budget_spent?: number }
      | undefined;
    const total = milestone?.total_budget_cents ?? 0;
    if (total <= 0) return -1;
    return Math.max(0, milestone?.budget_spent ?? 0);
  }

  if (isCpmContestType(contest.contest_type)) {
    const total = resolveContestPoolBudgetCents(
      contest.contest_type,
      details,
      contest.platform,
    );
    if (total <= 0) return -1;

    return Math.max(
      0,
      getPoolBudgetSpentCentsForDisplay({
        contest_type: contest.contest_type,
        post_contest_status: (contest as { post_contest_status?: string | null })
          .post_contest_status,
        contest_based_details: details,
      }),
    );
  }

  return -1;
}

export function compareContestBudgetUsed(
  a: ContestBudgetSortInput,
  b: ContestBudgetSortInput,
  order: "budget_used_desc" | "budget_used_asc",
): number {
  const spentA = getContestBudgetSpentForSort(a);
  const spentB = getContestBudgetSpentForSort(b);

  if (spentA === -1 && spentB === -1) return 0;
  if (spentA === -1) return 1;
  if (spentB === -1) return -1;

  return order === "budget_used_desc" ? spentB - spentA : spentA - spentB;
}
