import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
} from "@/lib/contest-type";
import { getPoolBudgetSpentCentsForDisplay } from "@/lib/contest-budget-tile-metrics";

type ContestBudgetSortInput = {
  contest_type?: string | null;
  contest_based_details?: {
    leaderboard_contest?: {
      total_prize?: number;
      total_budget?: number;
      budget_spent?: number;
    };
    cpm_contest?: {
      total_budget?: number;
      budget_spent?: number;
    };
    milestone_contest?: {
      total_budget_cents?: number;
      budget_spent?: number;
    };
    total_budget_cents?: number;
  } | null;
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
    const leaderboard = details.leaderboard_contest;
    if (leaderboard?.total_budget != null && leaderboard.total_budget > 0) {
      return getRemainingFromTotalAndSpent(
        leaderboard.total_budget,
        leaderboard.budget_spent,
      );
    }
    if (leaderboard?.total_prize != null && leaderboard.total_prize > 0) {
      return leaderboard.total_prize;
    }
    return -1;
  }

  if (contest.contest_type === "milestone") {
    const total = details.milestone_contest?.total_budget_cents ?? 0;
    return getRemainingFromTotalAndSpent(
      total,
      details.milestone_contest?.budget_spent,
    );
  }

  if (isCpmContestType(contest.contest_type)) {
    const total = getPoolBudgetCentsFromDetails(
      contest.contest_type,
      details,
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
    const leaderboard = details.leaderboard_contest;
    if (leaderboard?.total_budget != null && leaderboard.total_budget > 0) {
      return Math.max(0, leaderboard.budget_spent ?? 0);
    }
    return -1;
  }

  if (contest.contest_type === "milestone") {
    const total = details.milestone_contest?.total_budget_cents ?? 0;
    if (total <= 0) return -1;
    return Math.max(0, details.milestone_contest?.budget_spent ?? 0);
  }

  if (isCpmContestType(contest.contest_type)) {
    const total = getPoolBudgetCentsFromDetails(
      contest.contest_type,
      details,
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
