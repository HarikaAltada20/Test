export interface Submission {
  paid: boolean;
  earnings: number | null;
  bonus_paid: boolean;
  bonus_amount?: number;
  creator_id: string;
  created_at: string;
  status?: string;
  is_eligible?: boolean;
  deleted_at?: string | null;
  views?: number;
  platform?: string;
  other_stats?: any;
  manual_points_adjustment?: number;
}

export interface MilestoneSubmissionLike {
  creator_id: string | null;
  created_at: string;
  status?: string;
  deleted_at?: string | null;
  views?: number | null;
}

/**
 * Calculate actual budget spent for leaderboard contests based on submissions
 * This matches the logic used in BudgetProgress component
 * Client-side version that doesn't import server-side dependencies
 */
export function calculateLeaderboardBudgetSpent(
  submissions: Submission[],
  flatFeeBonus: number
): number {
  if (!submissions?.length || flatFeeBonus <= 0) return 0;

  const twitterExcludedFromBudget = (s: Submission) =>
    (s as any).is_twitter_tweet === true || s.platform === "twitter"
      ? s.is_eligible === false ||
        (s.deleted_at != null && s.deleted_at !== "")
      : false;

  const relevantSubmissions = submissions.filter((s) => {
    const status = s.status?.toLowerCase();
    return (
      (status === "verified" || status === "paid") && !twitterExcludedFromBudget(s)
    );
  });

  // Sort by created_at to respect "first submitted, first paid" logic
  const sortedSubmissions = [...relevantSubmissions].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateA - dateB;
  });

  // Group submissions by creator to apply cap correctly
  const creatorEarnings = new Map<string, { bonusTotal: number }>();
  const flatFeeBonusInDollars = flatFeeBonus / 100; // Convert cents to dollars

  for (const sub of sortedSubmissions) {
    const creatorId = sub.creator_id;
    if (!creatorEarnings.has(creatorId)) {
      creatorEarnings.set(creatorId, { bonusTotal: 0 });
    }

    const creatorData = creatorEarnings.get(creatorId)!;

    // Calculate bonus earnings
    if (sub.bonus_paid && sub.bonus_amount != null) {
      // Use actual paid bonus from database
      creatorData.bonusTotal += sub.bonus_amount / 100; // Convert cents to dollars
    } else {
      // Calculate expected bonus for verified unpaid
      creatorData.bonusTotal += flatFeeBonusInDollars;
    }
  }

  // Sum up all creator bonus totals
  let totalBonusSpent = 0;
  for (const [, creatorData] of creatorEarnings) {
    totalBonusSpent += creatorData.bonusTotal;
  }

  return totalBonusSpent;
}

/**
 * Calculate actual budget spent for Twitter CPM contests based on submissions
 * This matches the logic used in BudgetProgress component for Twitter CPM
 * Client-side version that doesn't import server-side dependencies
 */
export function calculateTwitterCpmBudgetSpent(
  submissions: Submission[],
  cpmRate: number,
  maxEarningsPerCreator?: number | null,
  minViews?: number,
  maxViews?: number,
  flatFeeBonus?: number,
  flatFeeBonusCap?: number | null,
  creatorManualAdjustments?: Record<string, number>
): number {
  if (!submissions?.length || cpmRate <= 0) return 0;

  const flatFeeBonusInDollars =
    flatFeeBonus && flatFeeBonus > 0 ? flatFeeBonus / 100 : 0;
  const bonusCapInDollars = flatFeeBonusCap ? flatFeeBonusCap / 100 : null;

  const twitterExcludedFromBudget = (s: Submission) =>
    (s as any).is_twitter_tweet === true || s.platform === "twitter"
      ? s.is_eligible === false ||
        (s.deleted_at != null && s.deleted_at !== "")
      : false;

  const relevantSubmissions = submissions.filter((s) => {
    const status = s.status?.toLowerCase();
    return (
      (status === "verified" || status === "paid") && !twitterExcludedFromBudget(s)
    );
  });

  // Sort by created_at to respect "first submitted, first paid" logic
  const sortedSubmissions = [...relevantSubmissions].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateA - dateB;
  });

  // Group submissions by creator to apply cap correctly
  const creatorEarnings = new Map<
    string,
    { cpmTotal: number; bonusTotal: number }
  >();
  let totalBonusSpentSoFar = 0;

  for (const sub of sortedSubmissions) {
    const creatorId = sub.creator_id;
    if (!creatorEarnings.has(creatorId)) {
      creatorEarnings.set(creatorId, { cpmTotal: 0, bonusTotal: 0 });
    }

    const creatorData = creatorEarnings.get(creatorId)!;

    // Calculate CPM earnings based on platform
    let submissionEarnings = 0;
    const submissionPlatform = sub.platform?.toLowerCase();

    if (submissionPlatform === "twitter") {
      const basePoints = sub.other_stats?.base_points || 0;
      const manualPointsAdjustment = sub.manual_points_adjustment || 0;
      const totalPoints = basePoints + manualPointsAdjustment;
      submissionEarnings = (totalPoints * cpmRate) / 1000;
    } else if (sub.paid && sub.earnings != null) {
      // Use actual paid earnings from database for non-Twitter platforms (YouTube, Instagram)
      submissionEarnings = sub.earnings / 100;
    } else {
      // Calculate expected earnings for verified unpaid (YouTube, Instagram)
      let views = sub.views || 0;
      if (minViews != null && views < minViews) views = 0;
      if (maxViews != null && views > maxViews) views = maxViews;
      submissionEarnings = (views * cpmRate) / 1000;
    }

    // Apply creator cap if configured
    if (maxEarningsPerCreator) {
      const maxInDollars = maxEarningsPerCreator / 100;
      const remainingCap = maxInDollars - creatorData.cpmTotal;
      if (remainingCap > 0) {
        creatorData.cpmTotal += Math.min(submissionEarnings, remainingCap);
      }
    } else {
      creatorData.cpmTotal += submissionEarnings;
    }

    // Include flat fee bonus for verified submissions (cap respected across contest)
    if (flatFeeBonusInDollars > 0) {
      if (
        bonusCapInDollars === null ||
        totalBonusSpentSoFar + flatFeeBonusInDollars <= bonusCapInDollars
      ) {
        creatorData.bonusTotal += flatFeeBonusInDollars;
        totalBonusSpentSoFar += flatFeeBonusInDollars;
      }
    }
  }

  // Sum up all creator earnings
  let totalCpmSpent = 0;
  let totalBonusSpent = 0;
  if (
    creatorManualAdjustments &&
    Object.keys(creatorManualAdjustments).length > 0
  ) {
    const capInDollars =
      maxEarningsPerCreator != null ? maxEarningsPerCreator / 100 : null;

    for (const [creatorId, adjustmentPoints] of Object.entries(
      creatorManualAdjustments
    )) {
      if (!adjustmentPoints) continue;
      const creatorData = creatorEarnings.get(creatorId);
      if (!creatorData) continue;

      let adjustmentEarnings = (adjustmentPoints * cpmRate) / 1000;
      if (capInDollars != null) {
        const remainingCap = Math.max(capInDollars - creatorData.cpmTotal, 0);
        if (remainingCap <= 0) continue;
        adjustmentEarnings = Math.min(adjustmentEarnings, remainingCap);
      }

      creatorData.cpmTotal += adjustmentEarnings;
    }
  }

  for (const [, earnings] of creatorEarnings) {
    totalCpmSpent += earnings.cpmTotal;
    totalBonusSpent += earnings.bonusTotal;
  }

  return totalCpmSpent + totalBonusSpent;
}

export type MilestonePayoutRule = {
  target_views: number;
  payout_cents: number;
  winner_limit: number | null;
};

/**
 * Expected milestone payout per creator (cents), using the same rules as budget spent:
 * sum of verified/paid views per creator, highest qualifying milestone (non-cumulative),
 * earliest verified submission breaks ties when a milestone has winner_limit.
 */
export function computeMilestoneCreatorExpectedPayoutCentsByCreator(
  submissions: MilestoneSubmissionLike[],
  milestones: MilestonePayoutRule[]
): Map<string, number> {
  const result = new Map<string, number>();
  if (!submissions?.length || !milestones?.length) return result;

  const relevantSubmissions = submissions.filter((s) => {
    const status = s.status?.toLowerCase();
    return (
      (status === "verified" || status === "paid") && s.deleted_at == null
    );
  });

  const creatorViews = new Map<string, number>();
  const creatorEarliestVerification = new Map<string, number>();

  for (const sub of relevantSubmissions) {
    const creatorId = sub.creator_id;
    if (!creatorId) continue;
    const views = sub.views || 0;
    creatorViews.set(creatorId, (creatorViews.get(creatorId) || 0) + views);

    const time = new Date(sub.created_at).getTime();
    if (
      !creatorEarliestVerification.has(creatorId) ||
      time < creatorEarliestVerification.get(creatorId)!
    ) {
      creatorEarliestVerification.set(creatorId, time);
    }
  }

  const sortedMilestones = [...milestones].sort(
    (a, b) => b.target_views - a.target_views
  );

  const milestoneWinners = new Map<number, number>();

  const sortedCreators = Array.from(creatorViews.keys()).sort((a, b) => {
    return (
      (creatorEarliestVerification.get(a) || 0) -
      (creatorEarliestVerification.get(b) || 0)
    );
  });

  for (const creatorId of sortedCreators) {
    const totalViews = creatorViews.get(creatorId) || 0;
    let payoutCents = 0;

    for (const milestone of sortedMilestones) {
      if (totalViews >= milestone.target_views) {
        if (milestone.winner_limit != null) {
          const currentWinners =
            milestoneWinners.get(milestone.target_views) || 0;
          if (currentWinners >= milestone.winner_limit) {
            continue;
          }
          milestoneWinners.set(milestone.target_views, currentWinners + 1);
        }

        payoutCents = milestone.payout_cents;
        break;
      }
    }

    result.set(creatorId, payoutCents);
  }

  return result;
}

/**
 * Calculate actual budget spent for milestone contests based on submissions
 * Each creator receives payout only for the highest milestone reached (non-cumulative)
 */
export function calculateMilestoneBudgetSpent(
  submissions: Submission[],
  milestones: MilestonePayoutRule[]
): number {
  const byCreator = computeMilestoneCreatorExpectedPayoutCentsByCreator(
    submissions,
    milestones
  );
  let totalSpentCents = 0;
  for (const cents of byCreator.values()) {
    totalSpentCents += cents;
  }
  return totalSpentCents / 100;
}

