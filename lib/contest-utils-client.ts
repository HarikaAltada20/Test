export interface Submission {
  paid: boolean;
  earnings: number | null;
  bonus_paid: boolean;
  bonus_amount?: number;
  creator_id: string;
  created_at: string;
  status?: string;
  filter_status?: string;
  views?: number;
  platform?: string;
  other_stats?: any;
  manual_points_adjustment?: number;
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

  // Filter to verified or paid submissions, but exclude filtered_out ones
  const relevantSubmissions = submissions.filter((s) => {
    const status = s.status?.toLowerCase();
    const filterStatus = s.filter_status?.toLowerCase();
    return (status === "verified" || status === "paid") && filterStatus !== "filtered_out";
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

  // Filter to verified or paid submissions, but exclude filtered_out ones
  const relevantSubmissions = submissions.filter((s) => {
    const status = s.status?.toLowerCase();
    const filterStatus = s.filter_status?.toLowerCase();
    return (status === "verified" || status === "paid") && filterStatus !== "filtered_out";
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
