import { createClient } from '@/utils/supabase/client';

export interface ActiveContestCountResult {
  success: boolean;
  activeCount: number;
  error?: string;
}

/**
 * Count active contests for a user based on the business rules (CLIENT-SIDE VERSION)
 * - pending_approval: Submitted for review
 * - approved: Approved and ready to publish  
 * - published with status 'upcoming' or 'active': Live contests
 */
export async function getActiveContestCount(userId: string, excludeContestId?: string): Promise<ActiveContestCountResult> {
  try {
    const supabase = createClient();
    
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
      console.log("excludeContestId", excludeContestId)
    // Count active contests based on business rules using the view's computed status
    const activeContests = contests.filter(contest => {
      console.log("contest.id", contest.id)
      console.log("excludeContestId", excludeContestId)
      if (excludeContestId && contest.id === excludeContestId) return false;
      // Rule 1: Contests in approval workflow are considered active
      if (contest.moderation_status === 'pending_approval' || 
          contest.moderation_status === 'approved') {
        return true;
      }
      // Rule 2: Published contests that are upcoming or active (live) are active
      if (contest.moderation_status === 'published') {
        return contest.status === 'upcoming' || contest.status === 'active';
      }
      return false;
    });

    // DEBUG: Log which contests are being counted as active
    console.log('Active contests (after exclude):', activeContests.map(c => ({id: c.id, moderation_status: c.moderation_status, status: c.status})));

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
 * Check if user can create a new contest based on their plan limits (CLIENT-SIDE VERSION)
 */
export async function canCreateNewContest(
  userId: string, 
  maxActiveContests: number,
  contestId?: string
): Promise<{ canCreate: boolean; currentCount: number; error?: string }> {
  
  const result = await getActiveContestCount(userId, contestId);
  
  if (!result.success) {
    return {
      canCreate: false,
      currentCount: 0,
      error: result.error
    };
  }

  const canCreate = result.activeCount < maxActiveContests;
  
  return {
    canCreate,
    currentCount: result.activeCount,
    error: canCreate ? undefined : `You have reached your plan limit of ${maxActiveContests} active contests. You currently have ${result.activeCount} active contests.`
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