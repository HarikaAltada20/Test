import type {
  ContestListSortOption,
  OpportunitiesSortOption,
} from "@/lib/campaign-list-filters-storage";
import {
  compareContestBudgetRemaining,
  compareContestBudgetUsed,
} from "@/lib/contest-budget-remaining-sort";
import {
  getAdminApprovalPercent,
  type ContestListMetricsContest,
} from "@/lib/contest-list-card-metrics";
import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
} from "@/lib/contest-type";

/**
 * CRITICAL: Always sort the full filtered set, then paginate.
 * Never sort only the current lazy-loaded page — that breaks highest-views order.
 */

export type CampaignListSortableContest = ContestListMetricsContest & {
  id: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
  contest_type?: string | null;
  contest_based_details?: Record<string, unknown> | null;
  post_contest_status?: string | null;
};

function getContestValueForSort(contest: CampaignListSortableContest): number {
  const details = contest.contest_based_details as {
    leaderboard_contest?: { total_prize?: number };
    cpm_contest?: { total_budget?: number };
    milestone_contest?: { total_budget_cents?: number };
  } | null;

  if (
    contest.contest_type === "leaderboard" &&
    details?.leaderboard_contest?.total_prize
  ) {
    return details.leaderboard_contest.total_prize;
  }
  if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
    return details.cpm_contest.total_budget;
  }
  if (
    contest.contest_type === "milestone" &&
    details?.milestone_contest?.total_budget_cents
  ) {
    return details.milestone_contest.total_budget_cents;
  }
  if (contest.contest_type === "dual_rewards" && details) {
    return getPoolBudgetCentsFromDetails(contest.contest_type, details);
  }
  return 0;
}

function getCpmRate(contest: CampaignListSortableContest): number {
  const details = contest.contest_based_details as {
    cpm_contest?: { cpm_rate_usd?: number };
  } | null;
  if (
    isCpmContestType(contest.contest_type) &&
    details?.cpm_contest?.cpm_rate_usd
  ) {
    return details.cpm_contest.cpm_rate_usd;
  }
  return -1;
}

export function sortCampaignsForList<T extends CampaignListSortableContest>(
  contests: T[],
  sortOption: ContestListSortOption | OpportunitiesSortOption,
): T[] {
  const sorted = [...contests];

  sorted.sort((a, b) => {
    switch (sortOption) {
      case "created_at_desc":
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      case "created_at_asc":
        return (
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
        );
      case "start_date_desc":
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return (
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );
      case "start_date_asc":
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return (
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        );
      case "end_date_asc":
        if (!a.end_date) return 1;
        if (!b.end_date) return -1;
        return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
      case "end_date_desc":
        if (!a.end_date) return 1;
        if (!b.end_date) return -1;
        return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
      case "value_desc":
      case "value_asc": {
        const valueA = getContestValueForSort(a);
        const valueB = getContestValueForSort(b);
        return sortOption === "value_desc" ? valueB - valueA : valueA - valueB;
      }
      case "budget_remaining_desc":
      case "budget_remaining_asc":
        return compareContestBudgetRemaining(a, b, sortOption);
      case "budget_used_desc":
      case "budget_used_asc":
        return compareContestBudgetUsed(a, b, sortOption);
      case "approval_rate_desc":
      case "approval_rate_asc": {
        const approvalA = getAdminApprovalPercent(a);
        const approvalB = getAdminApprovalPercent(b);
        return sortOption === "approval_rate_desc"
          ? approvalB - approvalA
          : approvalA - approvalB;
      }
      case "views_desc":
      case "views_asc": {
        const viewsA =
          a.not_rejected_views !== null && a.not_rejected_views !== undefined
            ? a.not_rejected_views
            : -1;
        const viewsB =
          b.not_rejected_views !== null && b.not_rejected_views !== undefined
            ? b.not_rejected_views
            : -1;
        if (viewsA === -1 && viewsB === -1) return 0;
        if (viewsA === -1) return 1;
        if (viewsB === -1) return -1;
        return sortOption === "views_desc" ? viewsB - viewsA : viewsA - viewsB;
      }
      case "cpm_rate_desc":
      case "cpm_rate_asc": {
        const rateA = getCpmRate(a);
        const rateB = getCpmRate(b);
        if (rateA === -1 && rateB === -1) return 0;
        if (rateA === -1) return 1;
        if (rateB === -1) return -1;
        return sortOption === "cpm_rate_desc" ? rateB - rateA : rateA - rateB;
      }
      case "submissions_desc":
      case "submissions_asc": {
        const countA = a.live_submission_count ?? -1;
        const countB = b.live_submission_count ?? -1;
        if (countA === -1 && countB === -1) return 0;
        if (countA === -1) return 1;
        if (countB === -1) return -1;
        return sortOption === "submissions_desc"
          ? countB - countA
          : countA - countB;
      }
      case "relevance_desc": {
        const rank = (c: CampaignListSortableContest) => {
          if (c.status === "active") return 0;
          if (c.status === "upcoming") return 1;
          if (c.status === "ended") return 2;
          return 3;
        };
        const d = rank(a) - rank(b);
        if (d !== 0) return d;
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      }
      default:
        return 0;
    }
  });

  return sorted;
}
