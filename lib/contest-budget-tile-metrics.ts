import { POST_CONTEST_STATUS } from "@/lib/constants-status";
import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
  isDualRewardsContestType,
} from "@/lib/contest-type";
import { getDualRewardsSubmissionPaidComponents } from "@/lib/dual-rewards-pool-budget";
import { computeCpmRawCentsForRow } from "@/lib/cpm-expected-cents";
import { buildDualRewardCreatorCapSplitMapsByPlatform } from "@/lib/dual-rewards-creator-cap";
import {
  buildMilestoneSubmissionPayoutCentsMapFromDetails,
  computeMilestoneContestExpectedSpendCentsFromDetails,
  computeMilestoneCreatorBonusExpectedCentsFromDetails,
} from "@/lib/milestone-contest-expected-spend";
import {
  calculateTwitterCpmBudgetSpent,
  type Submission,
} from "@/lib/contest-utils-client";
import {
  isMultiPlatformVideoContest,
  readPersistedPlatformCampaigns,
  resolveCpmContestConfigForPlatform,
  resolveContestPoolBudgetCents,
  resolveMaxEarningsCentsForSubmission,
  isKeyedMaxEarningsMap,
  sumPersistedPlatformCampaignsChargeableCents,
} from "@/lib/video-platform-campaigns";
import { buildLeaderboardPrizeCentsBySubmissionIdForContest } from "@/lib/non-twitter-leaderboard-creator-prize";
import { buildFlatFeeBonusExpectedCentsBySubmissionId } from "@/lib/twitter-cpm-bonus-expected";

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
  metadata?: unknown;
  milestone_bonus_paid?: unknown;
};

export type ContestBudgetTileInput = {
  contest_type?: string | null;
  post_contest_status?: string | null;
  max_earnings_per_creator?: unknown;
  bonus_details?: unknown;
  contest_based_details?: Record<string, unknown> | null;
  platform?: string | null;
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
    const multi = sumPersistedPlatformCampaignsChargeableCents(details);
    if (multi != null && multi > 0) return multi;
    const lb = details?.leaderboard_contest as
      | { total_budget?: number; total_prize?: number }
      | undefined;
    if (lb?.total_budget && lb.total_budget > 0) return lb.total_budget;
    if (lb?.total_prize && lb.total_prize > 0) return lb.total_prize;
    return 0;
  }

  const multi = resolveContestPoolBudgetCents(type, details, contest.platform);
  if (multi > 0) return multi;
  return getPoolBudgetCentsFromDetails(type, details);
}

function computeLeaderboardPrizePoolCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
  paidOnly: boolean,
): number {
  const details =
    (contest.contest_based_details as Record<string, unknown> | null) ?? null;
  const fallbackPrizes = (
    details?.leaderboard_contest as
      | { prizes?: Array<{ position: number; amount: number }> }
      | undefined
  )?.prizes;
  const pool = relevantSubmissions(submissions);
  const prizeBySubmissionId = buildLeaderboardPrizeCentsBySubmissionIdForContest(
    {
      rows: pool.map((s) => ({
        id: String(s.id || ""),
        views: s.views,
        status: s.status,
        paid: s.paid,
        platform: s.platform,
      })),
      details,
      contestPlatform: contest.platform,
      fallbackPrizes: fallbackPrizes || [],
    },
  );

  let total = 0;
  for (const s of pool) {
    if (paidOnly && !isPaidLike(s)) continue;
    total += prizeBySubmissionId.get(String(s.id || "")) || 0;
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
  const details =
    (contest.contest_based_details as Record<string, unknown> | null) ?? null;

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
    metadata: s.metadata,
    milestone_bonus_paid: s.milestone_bonus_paid,
  }));

  return computeMilestoneContestExpectedSpendCentsFromDetails(
    rows,
    details,
    contest.platform,
  );
}

function computeCpmFilledCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
  includeFlatFeeBonus: boolean,
): number {
  const details =
    (contest.contest_based_details as Record<string, unknown> | null) ?? null;
  const cpm = details?.cpm_contest as
    | {
        cpm_rate_usd?: number;
        min_views?: number;
        max_views?: number;
        flat_fee_bonus?: number;
        flat_fee_bonus_cap?: number | null;
        max_earnings_per_creator?: number | null;
      }
    | undefined;
  const fallback = resolveCpmContestConfigForPlatform(
    details,
    null,
    contest.platform,
  );
  const rate = fallback?.cpm_rate_usd || cpm?.cpm_rate_usd || 0;

  const dollars = calculateTwitterCpmBudgetSpent(
    submissions,
    rate,
    resolveMaxEarningsCentsForSubmission(contest, contest.platform) ??
      cpm?.max_earnings_per_creator ??
      null,
    fallback?.min_views ?? cpm?.min_views,
    fallback?.max_views ?? cpm?.max_views,
    includeFlatFeeBonus
      ? fallback?.flat_fee_bonus || cpm?.flat_fee_bonus || 0
      : 0,
    includeFlatFeeBonus
      ? fallback?.flat_fee_bonus_cap ?? cpm?.flat_fee_bonus_cap ?? null
      : null,
    undefined,
    (sub) => {
      const cfg = resolveCpmContestConfigForPlatform(
        details,
        sub.platform,
        contest.platform,
      );
      if (!cfg) return null;
      return {
        cpmRate: cfg.cpm_rate_usd,
        minViews: cfg.min_views,
        maxViews: cfg.max_views,
      };
    },
    isKeyedMaxEarningsMap(contest.max_earnings_per_creator)
      ? (sub) => resolveMaxEarningsCentsForSubmission(contest, sub.platform)
      : undefined,
  );
  return Math.round(dollars * 100);
}

function normalizeBudgetStatus(raw: unknown): string {
  const st = String(raw || "").toLowerCase();
  return st === "approved" ? "verified" : st;
}

/**
 * Dual CPM + milestone expected after the same combined per-creator cap as
 * contest-detail Expected Reward. Creator bonus is not included.
 */
export function computeDualRewardsCpmMilestoneFilledCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
): number {
  const details =
    (contest.contest_based_details as Record<string, unknown> | null) ?? null;
  const rows = submissions
    .filter((s) => !twitterExcludedFromBudget(s))
    .map((s) => ({
      id: String(s.id || ""),
      creator_id: s.creator_id,
      created_at: s.created_at,
      status: normalizeBudgetStatus(s.status),
      paid: s.paid,
      paid_at: s.paid_at,
      earnings: s.earnings,
      deleted_at: s.deleted_at,
      views: s.views,
      platform: s.platform,
      other_stats: s.other_stats,
    }))
    .filter((row) => {
      const st = row.status;
      return st === "pending" || st === "verified" || st === "paid";
    });

  const milestoneMap = buildMilestoneSubmissionPayoutCentsMapFromDetails(
    rows,
    details,
    contest.platform,
  );
  const keyed = isKeyedMaxEarningsMap(contest.max_earnings_per_creator);
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const creatorId = String(row.creator_id || "");
    if (!creatorId) continue;
    const list = grouped.get(creatorId) || [];
    list.push(row);
    grouped.set(creatorId, list);
  }

  let total = 0;
  for (const list of grouped.values()) {
    const dualRows = list.map((sub) => ({
      id: sub.id,
      created_at: sub.created_at,
      platform: sub.platform,
      mRawCents: Number(milestoneMap.get(sub.id) || 0),
      cRawCents: computeCpmRawCentsForRow(sub, details, contest.platform),
    }));
    const maps = buildDualRewardCreatorCapSplitMapsByPlatform(
      dualRows,
      (platform) =>
        resolveMaxEarningsCentsForSubmission(contest, platform) ?? 0,
      { keyedCaps: keyed },
    );
    for (const sub of list) {
      const st = sub.status;
      if (st !== "verified" && st !== "paid") continue;
      total +=
        (maps.cpmCappedBySubmissionId.get(sub.id) ?? 0) +
        (maps.milestoneCappedBySubmissionId.get(sub.id) ?? 0);
    }
  }
  return total;
}

function computeDualRewardsFilledCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
): number {
  const cpmMilestoneCents = computeDualRewardsCpmMilestoneFilledCents(
    contest,
    submissions,
  );
  const bonusCents = computeMilestoneCreatorBonusExpectedCentsFromDetails(
    submissions.map((s) => ({
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
      metadata: s.metadata,
      milestone_bonus_paid: s.milestone_bonus_paid,
    })),
    (contest.contest_based_details as Record<string, unknown> | null) ?? null,
    contest.platform,
  );
  return cpmMilestoneCents + bonusCents;
}

export function computeBudgetFilledCents(
  contest: ContestBudgetTileInput,
  submissions: BudgetTileSubmission[],
): number {
  const type = contest.contest_type;
  if (!type) return 0;

  if (type === "leaderboard") {
    const prizeCents = computeLeaderboardPrizePoolCents(
      contest,
      submissions,
      false,
    );
    const bonusMap = buildFlatFeeBonusExpectedCentsBySubmissionId(
      contest,
      relevantSubmissions(submissions).map((s) => ({
        id: String(s.id || ""),
        created_at: s.created_at,
        status: s.status,
        paid: s.paid,
        platform: s.platform,
      })),
    );
    let bonusCents = 0;
    for (const cents of bonusMap.values()) bonusCents += cents;
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
      contest,
      submissions,
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

function contestHasKeyedPlatformPayouts(
  contest: ContestBudgetTileInput,
): boolean {
  if (isMultiPlatformVideoContest(contest.platform)) return true;
  const campaigns = readPersistedPlatformCampaigns(
    contest.contest_based_details as Record<string, unknown> | null,
  );
  return Object.keys(campaigns).length > 1;
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
 * Dual / multi-platform: prefer persisted pool_budget_spent_cents (live
 * verified+paid expected). Do not treat leftover root nested budget_spent as
 * the tracker — those leftovers are from before per-platform payouts.
 */
export function getPoolBudgetSpentCentsForDisplay(
  contest: ContestBudgetTileInput,
  submissions?: BudgetTileSubmission[],
): number {
  const type = contest.contest_type;
  const details = contest.contest_based_details as Record<string, unknown> | null;
  const multi = contestHasKeyedPlatformPayouts(contest);

  if (submissions && submissions.length > 0) {
    const tile = resolveBudgetTileMetrics(contest, submissions);
    return tile?.numeratorCents ?? 0;
  }

  const enriched = details?.pool_budget_spent_cents;
  if (typeof enriched === "number" && enriched >= 0) {
    return enriched;
  }

  if (isDualRewardsContestType(type)) {
    if (multi) return 0;
    const pool = getCampaignBudgetCents(contest);
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
