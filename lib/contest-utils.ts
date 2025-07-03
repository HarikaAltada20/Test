import { createClient } from '@/utils/supabase/server';

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
 */
export async function canCreateNewContest(
  userId: string, 
  maxActiveContests: number
): Promise<{ canCreate: boolean; currentCount: number; error?: string }> {
  
  const result = await getActiveContestCount(userId);
  
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