import { POST_CONTEST_STATUS } from "@/lib/constants-status";
import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
  isDualRewardsContestType,
} from "@/lib/contest-type";
import { getDualRewardsSubmissionPaidComponents } from "@/lib/dual-rewards-pool-budget";
import { computeMilestoneContestExpectedSpendCents } from "@/lib/milestone-contest-expected-spend";
import {
  calculateLeaderboardBudgetSpent,
  calculateTwitterCpmBudgetSpent,
  type Submission,
} from "@/lib/contest-utils-client";

export type BudgetTileMode = "filled" | "paid";

export type BudgetTileMetrics = {
  mode: BudgetTileMode;
  numeratorCents: number;
  denominatorCents: number;
  label: string;
};

export type BudgetTileSubmission = Submission & {
  id?: string;
  is_twitter_tweet?: boolean;
  deleted_at?: string | null;
  is_eligible?: boolean;
  paid_at?: string | null;
};

export type ContestBudgetTileInput = {
  contest_type?: string | null;
  post_contest_status?: string | null;
  max_earnings_per_creator?: number | null;
  contest_based_details?: Record<string, unknown> | null;
};

const FILLED_LABEL = "Budget filled / Campaign budget";
const PAID_LABEL = "Budget paid / Campaign budget";

function twitterExcludedFromBudget(s: BudgetTileSubmission): boolean {
  return (s as { is_twitter_tweet?: boolean }).is_twitter_tweet === true ||
    s.platform === "twitter"
    ? s.is_eligible === false ||
        (s.deleted_at != null && s.deleted_at !== "")
    : false;
}

function isPaidLike(s: BudgetTileSubmission): boolean {
  const st = s.status?.toLowerCase();
  return (
    st === "paid" ||
    s.paid === true ||
    Boolean(s.paid_at)
  );
}

function relevantSubmissions(submissions: BudgetTileSubmission[]): BudgetTileSubmission[] {
  return submissions.filter((s) => {
    const status = s.status?.toLowerCase();
    return (
      (status === "verified" || status === "paid") && !twitterExcludedFromBudget(s)
    );
  });
}

export function getBudgetTileMode(
  postContestStatus: string | null | undefined,
): BudgetTileMode {
  return postContestStatus === POST_CONTEST_STATUS.payouts_processed
    ? "paid"
    : "filled";
}

export function getBudgetTileLabel(mode: BudgetTileMode): string {
  return mode === "paid" ? PAID_LABEL : FILLED_LABEL;
}

/** Campaign pool / prize commitment in cents for tile denominator. */
export function getCampaignBudgetCents(contest: ContestBudgetTileInput): number {
  const details = contest.contest_based_details as Record<string, unknown> | null;
  const type = contest.contest_type;

  if (type === "leaderboard") {
    const lb = details?.leaderboard_contest as
      | { total_budget?: number; total_prize?: number }
      | undefined;
    if (lb?.total_budget && lb.total_budget > 0) return lb.total_budget;
    if (lb?.total_prize && lb.total_prize > 0) return lb.total_prize;
    return 0;
  }

  return getPoolBudgetCentsFromDetails(type, details);
}

function computeLeaderboardPrizePoolCents(
  submissions: BudgetTileSubmission[],
  prizes: Array<{ position: number; amount: number }>,
  paidOnly: boolean,
): number {
  if (!prizes.length) return 0;

  const pool = relevantSubmissions(submissions);
  const ranked = [...pool].sort(
    (a, b) => (b.views || 0) - (a.views || 0),
  );

  const candidates = paidOnly
    ? ranked.filter((s) => isPaidLike(s))
    : ranked;

  let total = 0;
  for (let i = 0; i < candidates.length; i++) {
    const rank = i + 1;
    const prizeForRank = prizes.find((p) => p.position === rank);
    if (prizeForRank) total += prizeForRank.amount;
  }
  return total;
}

function sumDualRewardsPaidCents(submissions: BudgetTileSubmission[]): number {
  let total = 0;
  for (const s of submissions) {
    if (twitterExcludedFromBudget(s)) continue;
    if (!isPaidLike(s)) continue;
    const paid = getDualRewardsSubmissionPaidComponents({
      id: String(s.id || ""),
      earnings: s.earnings,
      paid: s.paid,
      bonus_amount: s.bonus_amount,
      bonus_paid: s.bonus_paid,
      dual_rewards_payout: (s as { dual_rewards_payout?: unknown })
        .dual_rewards_payout,
    });
    total += paid.cpmCents + paid.milestoneCents;
  }
  return total;
}

function sumPaidEarningsAndBonuses(submissions: BudgetTileSubmission[]): number {
  let total = 0;
  for (const s of submissions) {
    if (twitterExcludedFromBudget(s)) continue;
    if (isPaidLike(s) && s.earnings != null) {
      total += Math.max(0, Number(s.earnings) || 0);
    }
    if (s.bonus_paid && s.bonus_amount != null) {
      total += Math.max(0, Number(s.bonus_amount) || 0);
    }
  }
  return total;
}

function computeMilestoneFilledCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
): number {
  const milestoneContest = (
    contest.contest_based_details as {
      milestone_contest?: {
        milestones?: Array<{
          target_views: number;
          payout_cents: number;
          winner_limit: number | null;
        }>;
        bonus?: unknown;
      };
    } | null
  )?.milestone_contest;

  const rows = submissions.map((s) => ({
    id: String(s.id || ""),
    creator_id: s.creator_id,
    created_at: s.created_at,
    status: s.status,
    paid: s.paid,
    paid_at: s.paid_at,
    earnings: s.earnings,
    deleted_at: s.deleted_at,
    views: s.views,
    platform: s.platform,
    other_stats: s.other_stats,
    bonus_paid: s.bonus_paid,
    bonus_amount: s.bonus_amount,
  }));

  return computeMilestoneContestExpectedSpendCents(rows, milestoneContest);
}

function computeCpmFilledCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
  includeFlatFeeBonus: boolean,
): number {
  const details = contest.contest_based_details as {
    cpm_contest?: {
      cpm_rate_usd?: number;
      min_views?: number;
      max_views?: number;
      flat_fee_bonus?: number;
      flat_fee_bonus_cap?: number | null;
      max_earnings_per_creator?: number | null;
    };
  } | null;
  const cpm = details?.cpm_contest;
  const rate = cpm?.cpm_rate_usd || 0;
  if (rate <= 0) return 0;

  const dollars = calculateTwitterCpmBudgetSpent(
    submissions,
    rate,
    contest.max_earnings_per_creator ?? cpm?.max_earnings_per_creator ?? null,
    cpm?.min_views,
    cpm?.max_views,
    includeFlatFeeBonus ? cpm?.flat_fee_bonus || 0 : 0,
    includeFlatFeeBonus ? cpm?.flat_fee_bonus_cap ?? null : null,
  );
  return Math.round(dollars * 100);
}

function computeDualRewardsFilledCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
): number {
  const cpmCents = computeCpmFilledCents(contest, submissions, false);
  const milestoneCents = computeMilestoneFilledCents(contest, submissions);
  return cpmCents + milestoneCents;
}

export function computeBudgetFilledCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
): number {
  const type = contest.contest_type;
  if (!type) return 0;

  if (type === "leaderboard") {
    const lb = (
      contest.contest_based_details as {
        leaderboard_contest?: {
          flat_fee_bonus?: number;
          prizes?: Array<{ position: number; amount: number }>;
        };
      } | null
    )?.leaderboard_contest;
    const flatFeeBonus = lb?.flat_fee_bonus || 0;
    const bonusDollars = calculateLeaderboardBudgetSpent(submissions, flatFeeBonus);
    const bonusCents = Math.round(bonusDollars * 100);
    const prizeCents = computeLeaderboardPrizePoolCents(
      submissions,
      lb?.prizes || [],
      false,
    );
    return bonusCents + prizeCents;
  }

  if (type === "milestone") {
    return computeMilestoneFilledCents(contest, submissions);
  }

  if (isDualRewardsContestType(type)) {
    return computeDualRewardsFilledCents(contest, submissions);
  }

  if (isCpmContestType(type)) {
    return computeCpmFilledCents(contest, submissions, true);
  }

  return 0;
}

export function computeBudgetPaidCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
): number {
  const type = contest.contest_type;
  if (!type) return 0;

  if (type === "leaderboard") {
    const lb = (
      contest.contest_based_details as {
        leaderboard_contest?: {
          prizes?: Array<{ position: number; amount: number }>;
        };
      } | null
    )?.leaderboard_contest;
    const prizeCents = computeLeaderboardPrizePoolCents(
      submissions,
      lb?.prizes || [],
      true,
    );
    let paidBonuses = 0;
    for (const s of submissions) {
      if (twitterExcludedFromBudget(s)) continue;
      if (s.bonus_paid && s.bonus_amount != null) {
        paidBonuses += Math.max(0, Number(s.bonus_amount) || 0);
      }
    }
    return prizeCents + paidBonuses;
  }

  if (isDualRewardsContestType(type)) {
    return sumDualRewardsPaidCents(submissions);
  }

  return sumPaidEarningsAndBonuses(submissions);
}

function dualRewardsStoredNestedSpendCents(
  details: Record<string, unknown> | null | undefined,
): number {
  const cpm = (
    details?.cpm_contest as { budget_spent?: number } | undefined
  )?.budget_spent;
  const milestone = (
    details?.milestone_contest as { budget_spent?: number } | undefined
  )?.budget_spent;
  return Math.max(0, Number(cpm) || 0) + Math.max(0, Number(milestone) || 0);
}

/**
 * Unified pool spend for budget trackers (list cards, sort, opportunities).
 * Dual rewards: never sum nested budget_spent blindly — use enriched root field or cap.
 */
export function getPoolBudgetSpentCentsForDisplay(
  contest: ContestBudgetTileInput,
  submissions?: BudgetTileSubmission[],
): number {
  const type = contest.contest_type;
  const details = contest.contest_based_details as Record<string, unknown> | null;

  if (isDualRewardsContestType(type)) {
    if (submissions && submissions.length > 0) {
      const tile = resolveBudgetTileMetrics(contest, submissions);
      return tile?.numeratorCents ?? 0;
    }

    const pool = getCampaignBudgetCents(contest);
    const enriched = details?.pool_budget_spent_cents;
    if (typeof enriched === "number" && enriched >= 0) {
      return enriched;
    }

    const nestedSum = dualRewardsStoredNestedSpendCents(details);
    return pool > 0 ? Math.min(nestedSum, pool) : nestedSum;
  }

  if (type === "leaderboard") {
    const lb = details?.leaderboard_contest as { budget_spent?: number } | undefined;
    return Math.max(0, Number(lb?.budget_spent) || 0);
  }

  if (type === "milestone") {
    const ms = details?.milestone_contest as { budget_spent?: number } | undefined;
    return Math.max(0, Number(ms?.budget_spent) || 0);
  }

  if (isCpmContestType(type)) {
    const cpm = details?.cpm_contest as { budget_spent?: number } | undefined;
    return Math.max(0, Number(cpm?.budget_spent) || 0);
  }

  return 0;
}

export function resolveBudgetTileMetrics(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
): BudgetTileMetrics | null {
  const denominatorCents = getCampaignBudgetCents(contest);
  if (denominatorCents <= 0) return null;

  const mode = getBudgetTileMode(contest.post_contest_status);
  let numeratorCents =
    mode === "paid"
      ? computeBudgetPaidCents(contest, submissions)
      : computeBudgetFilledCents(contest, submissions);
  numeratorCents = Math.max(0, numeratorCents);

  return {
    mode,
    numeratorCents,
    denominatorCents,
    label: getBudgetTileLabel(mode),
  };
}

/** Map twitter_campaign_tweets rows into budget submission shape for CPM contests. */
export function mapTwitterTweetsToBudgetSubmissions(
  tweets: Array<{
    id: string;
    creator_id?: string | null;
    tweet_created_at?: string | null;
    created_at?: string | null;
    moderation_status?: string | null;
    points?: number | null;
    manual_points_adjustment?: number | null;
    earnings?: number | null;
    impressions?: number | null;
    is_eligible?: boolean | null;
    deleted_at?: string | null;
  }>,
): BudgetTileSubmission[] {
  return tweets.map((tweet) => {
    const basePoints = tweet.points || 0;
    const manualAdj = tweet.manual_points_adjustment || 0;
    const status = tweet.moderation_status || "pending";
    const isPaid = status === "paid";
    return {
      id: tweet.id,
      creator_id: tweet.creator_id || "",
      created_at: tweet.tweet_created_at || tweet.created_at || new Date(0).toISOString(),
      status,
      paid: isPaid,
      earnings: isPaid && tweet.earnings != null ? tweet.earnings : null,
      bonus_paid: false,
      views: tweet.impressions || 0,
      platform: "twitter",
      is_twitter_tweet: true,
      is_eligible: tweet.is_eligible === true,
      deleted_at: tweet.deleted_at,
      other_stats: {
        base_points: basePoints,
      },
      manual_points_adjustment: manualAdj,
    };
  });
}
