export const subscriptionPlans = [
  {
    // Use real Stripe product ID instead of UUID
    id: 'prod_Sduka9mKXu35Ii',
    name: 'EXPLORER',
    displayName: 'Explorer Plan',
    price: 0, // $0.00/month
    // Add monthly and yearly price IDs from Stripe
    prices: {
      monthly: {
        id: 'price_1RicueDCKN2LN0QeqyngXhRM',
        amount: 0, // $0.00 in cents
        interval: 'month'
      }
      // No yearly option for free plan
    },
    features: {
      maxActiveContests: 1,
      minContestBudget: 10000, // $100.00 in cents
      maxWinnersPerContest: 3,
      commissionPercentage: 50,
      contestTypes: ['leaderboard'], // Leaderboard-based contests only
      analytics: 'basic', // Basic analytics for contest performance
      support: 'basic', // Standard support
      description: 'Entry-level users, startups, or small businesses wanting to test the platform',
    },
  },
  {
    // Use real Stripe product ID instead of UUID
    id: 'prod_Sdum3O1ZM4wK1v',
    name: 'STARTER',
    displayName: 'Starter Plan',
    price: 10000, // $100.00/month in cents
    // Add monthly and yearly price IDs from Stripe
    prices: {
      monthly: {
        id: 'price_1RicwmDCKN2LN0QeMBwxwt1K',
        amount: 10000, // $100.00 in cents
        interval: 'month'
      },
      yearly: {
        id: 'price_1Rid6wDCKN2LN0Qemz2ugwmI',
        amount: 100000, // $1,000.00 in cents (saves $200/year)
        interval: 'year'
      }
    },
    features: {
      maxActiveContests: 5,
      minContestBudget: 10000, // $100.00 in cents
      maxWinnersPerContest: 10,
      commissionPercentage: 20,
      contestTypes: ['leaderboard', 'cpm'], // Leaderboard-based and CPM-based contests
      analytics: 'basic', // Basic analytics and contest performance insights
      support: 'basic', // Standard support
      description: 'Small to medium-sized businesses that want to run more contests and grow their presence',
    },
  },
  {
    // Use real Stripe product ID instead of UUID
    id: 'prod_SdunoupDPLZfkU',
    name: 'BUILDER',
    displayName: 'Builder Plan',
    price: 25000, // $250.00/month in cents
    // Add monthly and yearly price IDs from Stripe
    prices: {
      monthly: {
        id: 'price_1RicxUDCKN2LN0Qe3f13Nmel',
        amount: 25000, // $250.00 in cents
        interval: 'month'
      },
      yearly: {
        id: 'price_1Rid7PDCKN2LN0QeDCQwHKCB',
        amount: 250000, // $2,500.00 in cents (saves $500/year)
        interval: 'year'
      }
    },
    features: {
      maxActiveContests: 15,
      minContestBudget: 7500, // $75.00 in cents
      maxWinnersPerContest: 25,
      commissionPercentage: 12,
      contestTypes: ['leaderboard', 'cpm'], // Leaderboard-based and CPM-based contests
      analytics: 'advanced', // Advanced analytics and contest performance reports
      support: 'priority', // Prioritized customer support
      description: 'Medium to large brands scaling their presence and want more contests and flexibility',
    },
  },
  {
    // Use real Stripe product ID instead of UUID
    id: 'prod_Sdunp5Rbb6V8Ax',
    name: 'CHAMPION',
    displayName: 'Champion Plan',
    price: 50000, // $500.00/month in cents
    // Add monthly and yearly price IDs from Stripe
    prices: {
      monthly: {
        id: 'price_1RicyCDCKN2LN0Qe7g4JO6RF',
        amount: 50000, // $500.00 in cents
        interval: 'month'
      },
      yearly: {
        id: 'price_1Rid7nDCKN2LN0QesH6RO4pO',
        amount: 500000, // $5,000.00 in cents (saves $1,000/year)
        interval: 'year'
      }
    },
    features: {
      maxActiveContests: 50,
      minContestBudget: 5000, // $50.00 in cents
      maxWinnersPerContest: 50,
      commissionPercentage: 10,
      contestTypes: ['leaderboard', 'cpm'], // Leaderboard-based and CPM-based contests
      analytics: 'comprehensive', // Comprehensive analytics and performance dashboards
      support: 'premium', // Premium, Dedicated 24/7 customer support
      description: 'Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support',
    },
  },
];

// Helper function to get plan by product ID (new system)
export function getPlanByProductId(productId: string) {
  return subscriptionPlans.find(plan => plan.id === productId);
}

// Helper function to get plan by name (backward compatibility)
export function getPlanByName(name: string) {
  return subscriptionPlans.find(plan => plan.name === name);
}

// Helper function to get price ID for a plan and interval
export function getPriceId(productId: string, interval: 'monthly' | 'yearly' = 'monthly') {
  const plan = getPlanByProductId(productId);
  if (!plan?.prices) return null;
  
  return interval === 'yearly' ? plan.prices.yearly?.id : plan.prices.monthly?.id;
}

// Common features for all plans
export const COMMON_PLAN_FEATURES = {
  lifetimeAccessToWinningSubmissions: true,
  validateContentOrganically: true,
  // Removed "Access to 5,000+ creators" as requested
};

export const HIGH_BUDGET_THRESHOLD = 100000; // Recommend contact for higher budget 
export const MIN_PRIZE_PER_WINNER = 500  // $5.00 in cents
export const MAX_PRIZE_PER_WINNER = 100000  // $1,000.00 in cents
export const DEFAULT_PRIZE_ALLOCATIONS = {
    1: 5000, // $50.00
    2: 3000, // $30.00
    3: 2000, // $20.00

  }

export const WITHDRAWAL_FEE_PERCENTAGE = 10; // 10% fee
export const MIN_WITHDRAWAL_AMOUNT = 2000; // $20.00 in cents

