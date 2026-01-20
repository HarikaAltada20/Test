import { createClient } from '@/utils/supabase/server';

export interface Submission {
    id: string;
    paid: boolean;
    earnings: number | null;
    bonus_paid: boolean;
    bonus_amount?: number;
    creator_id: string;
    created_at: string;
    status?: string;
    views?: number;
    platform?: string;
    other_stats?: any;
    manual_points_adjustment?: number;
}

export interface ActiveContestCountResult {
  success: boolean;
  activeCount: number;
  error?: string;
}

/**
 * Count active contests for a user based on the business rules:
 * - pending_approval: Submitted for review
 * - approved: Approved and ready to publish  
 * - published with status 'upcoming' or 'active': Live contests
 */
export async function getActiveContestCount(userId: string): Promise<ActiveContestCountResult> {
  try {
    const supabase = await createClient();
    
    // Get all contests for the user with their current status (leveraging contests_with_status view)
    const { data: contests, error } = await supabase
      .from('contests_with_status')
      .select('id, moderation_status, status')
      .eq('advertiser_id', userId);

    if (error) {
      console.error('Error fetching contests for active count:', error);
      return {
        success: false,
        activeCount: 0,
        error: 'Failed to fetch contests'
      };
    }

    if (!contests) {
      return {
        success: true,
        activeCount: 0
      };
    }

    // Count active contests based on business rules using the view's computed status
    const activeContests = contests.filter(contest => {
      // Rule 1: Contests in approval workflow are considered active
      if (contest.moderation_status === 'pending_approval' || 
          contest.moderation_status === 'approved') {
        return true;
      }

      // Rule 2: Published contests that are upcoming or active (live) are active
      // The view already computes the correct status, so we can use it directly
      if (contest.moderation_status === 'published') {
        return contest.status === 'upcoming' || contest.status === 'active';
      }

      return false;
    });

    return {
      success: true,
      activeCount: activeContests.length
    };
    
  } catch (error) {
    console.error('Error in getActiveContestCount:', error);
    return {
      success: false,
      activeCount: 0,
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Check if user can create a new contest based on their plan limits
 * @param userId - The user's ID
 * @param maxActiveContests - Maximum number of active contests allowed
 * @param excludeContestId - Optional contest ID to exclude from count (for editing existing contests)
 */
export async function canCreateNewContest(
  userId: string, 
  maxActiveContests: number,
  excludeContestId?: string
): Promise<{ canCreate: boolean; currentCount: number; error?: string }> {
  
  const result = await getActiveContestCount(userId);
  
  if (!result.success) {
    return {
      canCreate: false,
      currentCount: 0,
      error: result.error
    };
  }

  // If editing an existing contest, we need to check if it's currently counted as active
  let adjustedCount = result.activeCount;
  if (excludeContestId) {
    const supabase = await createClient();
    const { data: contest } = await supabase
      .from('contests_with_status')
      .select('id, moderation_status, status')
      .eq('id', excludeContestId)
      .single();
    
    // If the contest being edited is currently counted as active, subtract 1
    if (contest) {
      const isCurrentlyActive = 
        contest.moderation_status === 'pending_approval' || 
        contest.moderation_status === 'approved' ||
        (contest.moderation_status === 'published' && 
         (contest.status === 'upcoming' || contest.status === 'active'));
      
      if (isCurrentlyActive) {
        adjustedCount = Math.max(0, adjustedCount - 1);
      }
    }
  }

  const canCreate = adjustedCount < maxActiveContests;
  
  return {
    canCreate,
    currentCount: adjustedCount,
    error: canCreate ? undefined : `You have reached your plan limit of ${maxActiveContests} active contests. You currently have ${adjustedCount} active contests.`
  };
}

/**
 * Get commission amount based on plan percentage and prize pool
 */
export function calculateCommission(prizePoolInCents: number, commissionPercentage: number): number {
  return Math.round(prizePoolInCents * (commissionPercentage / 100));
}

/**
 * Get total amount to pay (prize pool + commission)
 */
export function calculateTotalAmount(prizePoolInCents: number, commissionPercentage: number): number {
  const commission = calculateCommission(prizePoolInCents, commissionPercentage);
  return prizePoolInCents + commission;
}

/**
 * Calculate actual budget spent for leaderboard contests based on submissions
 * This matches the logic used in BudgetProgress component
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

/**
 * Calculate actual budget spent for Twitter CPM contests based on submissions
 * This matches the logic used in BudgetProgress component for Twitter CPM
 */
export function calculateTwitterCpmBudgetSpent(
  submissions: Submission[], 
  cpmRate: number,
  maxEarningsPerCreator?: number | null,
  minViews?: number,
  maxViews?: number
): number {
  console.log(`[Twitter CPM Budget] Starting calculation with:`, {
    totalSubmissions: submissions?.length || 0,
    cpmRate,
    maxEarningsPerCreator,
    minViews,
    maxViews
  });

  if (!submissions?.length || cpmRate <= 0) {
    console.log(`[Twitter CPM Budget] Early return: no submissions or invalid cpmRate`);
    return 0;
  }

  // Filter to verified or paid submissions
  const relevantSubmissions = submissions.filter(s => {
    const status = s.status?.toLowerCase();
    return status === 'verified' || status === 'paid';
  });

  console.log(`[Twitter CPM Budget] Relevant submissions after filter: ${relevantSubmissions.length}/${submissions.length}`);

  // Sort by created_at to respect "first submitted, first paid" logic
  const sortedSubmissions = [...relevantSubmissions].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateA - dateB;
  });

  // Group submissions by creator to apply cap correctly
  const creatorEarnings = new Map<string, { cpmTotal: number }>();

  console.log(`[Twitter CPM Budget] Processing ${sortedSubmissions.length} submissions:`);

  for (const sub of sortedSubmissions) {
    const creatorId = sub.creator_id;
    if (!creatorEarnings.has(creatorId)) {
      creatorEarnings.set(creatorId, { cpmTotal: 0 });
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
      
      console.log(`[Twitter CPM Budget] Twitter submission ${sub.id}:`, {
        creatorId,
        status: sub.status,
        basePoints,
        manualPointsAdjustment,
        totalPoints,
        cpmRate,
        calculation: `(${totalPoints} * ${cpmRate}) / 1000`,
        submissionEarnings: submissionEarnings.toFixed(2),
        currentCreatorTotal: creatorData.cpmTotal.toFixed(2)
      });
    } else if (sub.paid && sub.earnings != null) {
      // Use actual paid earnings from database for non-Twitter platforms (YouTube, Instagram)
      submissionEarnings = sub.earnings / 100; // Convert cents to dollars
      
      console.log(`[Twitter CPM Budget] Non-Twitter paid submission ${sub.id}:`, {
        creatorId,
        platform: submissionPlatform,
        status: sub.status,
        paidEarnings: sub.earnings,
        submissionEarnings: submissionEarnings.toFixed(2),
        currentCreatorTotal: creatorData.cpmTotal.toFixed(2)
      });
    } else {
      // Note: For Twitter contests, this branch should not be reached as Twitter is handled above
      // Calculate expected earnings for verified unpaid (YouTube, Instagram)
      let views = sub.views || 0;
      if (minViews != null && views < minViews) views = 0;
      if (maxViews != null && views > maxViews) views = maxViews;
      submissionEarnings = (views * cpmRate) / 1000;
      
      console.log(`[Twitter CPM Budget] Non-Twitter verified submission ${sub.id}:`, {
        creatorId,
        platform: submissionPlatform,
        status: sub.status,
        originalViews: sub.views,
        adjustedViews: views,
        cpmRate,
        calculation: `(${views} * ${cpmRate}) / 1000`,
        submissionEarnings: submissionEarnings.toFixed(2),
        currentCreatorTotal: creatorData.cpmTotal.toFixed(2)
      });
    }

    // Apply creator cap if configured
    if (maxEarningsPerCreator) {
      const maxInDollars = maxEarningsPerCreator / 100;
      const remainingCap = maxInDollars - creatorData.cpmTotal;
      
      if (remainingCap > 0) {
        const actualEarnings = Math.min(submissionEarnings, remainingCap);
        creatorData.cpmTotal += actualEarnings;
        
        console.log(`[Twitter CPM Budget] Creator cap applied for ${creatorId}:`, {
          maxEarningsPerCreator: maxInDollars.toFixed(2),
          previousTotal: (creatorData.cpmTotal - actualEarnings).toFixed(2),
          submissionEarnings: submissionEarnings.toFixed(2),
          remainingCap: remainingCap.toFixed(2),
          actualEarnings: actualEarnings.toFixed(2),
          newTotal: creatorData.cpmTotal.toFixed(2)
        });
      } else {
        console.log(`[Twitter CPM Budget] Creator cap reached for ${creatorId}:`, {
          maxEarningsPerCreator: maxInDollars.toFixed(2),
          currentTotal: creatorData.cpmTotal.toFixed(2),
          submissionEarnings: submissionEarnings.toFixed(2),
          remainingCap: remainingCap.toFixed(2),
          addedEarnings: "0.00"
        });
      }
    } else {
      creatorData.cpmTotal += submissionEarnings;
      
      console.log(`[Twitter CPM Budget] No creator cap for ${creatorId}:`, {
        previousTotal: (creatorData.cpmTotal - submissionEarnings).toFixed(2),
        submissionEarnings: submissionEarnings.toFixed(2),
        newTotal: creatorData.cpmTotal.toFixed(2)
      });
    }
  }

  // Sum up all creator earnings
  let totalCpmSpent = 0;
  const creatorBreakdown: Array<{creatorId: string, total: number}> = [];
  
  for (const [creatorId, earnings] of creatorEarnings) {
    totalCpmSpent += earnings.cpmTotal;
    creatorBreakdown.push({
      creatorId,
      total: earnings.cpmTotal
    });
  }

  console.log(`[Twitter CPM Budget] Final calculation:`, {
    totalCreators: creatorEarnings.size,
    creatorBreakdown: creatorBreakdown.map(c => ({
      creatorId: c.creatorId,
      total: c.total.toFixed(2)
    })),
    totalCpmSpent: totalCpmSpent.toFixed(2),
    totalCpmSpentCents: Math.round(totalCpmSpent * 100)
  });

  return totalCpmSpent;
}