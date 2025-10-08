export interface Submission {
    paid: boolean;
    earnings: number | null;
    bonus_paid: boolean;
    bonus_amount?: number;
    creator_id: string;
    created_at: string;
    status?: string;
    views?: number;
}

/**
 * Calculate actual budget spent for leaderboard contests based on submissions
 * This matches the logic used in BudgetProgress component
 * Client-side version that doesn't import server-side dependencies
 */
export function calculateLeaderboardBudgetSpent(submissions: Submission[], flatFeeBonus: number): number {
  if (!submissions?.length || flatFeeBonus <= 0) return 0;

  // Filter to verified or paid submissions
  const relevantSubmissions = submissions.filter(s => {
    const status = s.status?.toLowerCase();
    return status === 'verified' || status === 'paid';
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