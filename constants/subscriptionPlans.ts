
// TEST IDs
// TEST Product IDs
// export const PRODUCT_IDS = {
//   EXPLORER: 'prod_Slij7SgNUxACLp',
//   STARTER: 'prod_SlilUeFqolEC7W',
//   BUILDER: 'prod_Slinc7mb1e30Ef',
//   CHAMPION: 'prod_SlioxThbvGeLga',
// } as const;

// // TEST Price IDs
// export const PRICE_IDS = {
//   EXPLORER_MONTHLY: 'price_1RqBIUDCKN2LN0Qe2c097HHM',
//   STARTER_MONTHLY: 'price_1RqBK8DCKN2LN0QeVe68F0Ec',
//   STARTER_YEARLY: 'price_1RqBKXDCKN2LN0Qe81Nq90bP',
//   BUILDER_MONTHLY: 'price_1RqBLcDCKN2LN0QendahSoUJ',
//   BUILDER_YEARLY: 'price_1RqBLcDCKN2LN0QeoHdipPyN',
//   CHAMPION_MONTHLY: 'price_1RqBMjDCKN2LN0QenUgKtYgD',
//   CHAMPION_YEARLY: 'price_1RqBMjDCKN2LN0QeFgcfIR2I',
// } as const;



// PRODUCTION IDs
// PRODUCTION Product IDs
export const PRODUCT_IDS = {
  EXPLORER: 'prod_SgtEmTCYKfROTo',
  STARTER: 'prod_SgtFZrrxO3IdP7',
  BUILDER: 'prod_SgtGPsQZ79Mcej',
  CHAMPION: 'prod_SgtHIEckuTjVRV',
} as const;

// PRODUCTION Price IDs
export const PRICE_IDS = {
  EXPLORER_MONTHLY: 'price_1RlVS3JEc43ljUHzS4i9LI2Y',
  STARTER_MONTHLY: 'price_1RlVT2JEc43ljUHzv7w3fJnJ',
  STARTER_YEARLY: 'price_1RlVWNJEc43ljUHzF1hvHU6j',
  BUILDER_MONTHLY: 'price_1RlVU7JEc43ljUHzZ5ranvXu',
  BUILDER_YEARLY: 'price_1RlVUMJEc43ljUHzIvgrheDm',
  CHAMPION_MONTHLY: 'price_1RlVVPJEc43ljUHzsGSTVwc6',
  CHAMPION_YEARLY: 'price_1RlVVgJEc43ljUHzyWf2569f',
} as const;


export const subscriptionPlans = [
  {
    // Use real Stripe product ID instead of UUID
    id: PRODUCT_IDS.EXPLORER,
    name: 'EXPLORER',
    displayName: 'Explorer Plan',
    price: 0, // $0.00/month
    // Add monthly and yearly price IDs from Stripe
    prices: {
      monthly: {
        id: PRICE_IDS.EXPLORER_MONTHLY,
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
      analytics: 'Advanced', // Basic analytics for contest performance
      support: 'basic', // Standard support
      description: 'Entry-level users, startups, or small businesses wanting to test the platform',
    },
  },
  {
    // Use real Stripe product ID instead of UUID
    id: PRODUCT_IDS.STARTER,
    name: 'STARTER',
    displayName: 'Starter Plan',
    price: 10000, // $100.00/month in cents
    trialDays: 30, // 30-day free trial
    // Add monthly and yearly price IDs from Stripe
    prices: {
      monthly: {
        id: PRICE_IDS.STARTER_MONTHLY,
        amount: 10000, // $100.00 in cents
        interval: 'month'
      },
      yearly: {
        id: PRICE_IDS.STARTER_YEARLY,
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
      analytics: 'Advanced', // Basic analytics and contest performance insights
      support: 'basic', // Standard support
      description: 'Small to medium-sized businesses that want to run more contests and grow their presence',
    },
  },
  {
    // Use real Stripe product ID instead of UUID
    id: PRODUCT_IDS.BUILDER,
    name: 'BUILDER',
    displayName: 'Builder Plan',
    price: 25000, // $250.00/month in cents
    // Add monthly and yearly price IDs from Stripe
    prices: {
      monthly: {
        id: PRICE_IDS.BUILDER_MONTHLY,
        amount: 25000, // $250.00 in cents
        interval: 'month'
      },
      yearly: {
        id: PRICE_IDS.BUILDER_YEARLY,
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
      analytics: 'Advanced', // Advanced analytics and contest performance reports
      support: 'priority', // Prioritized customer support
      description: 'Medium to large brands scaling their presence and want more contests and flexibility',
    },
  },
  {
    // Use real Stripe product ID instead of UUID
    id: PRODUCT_IDS.CHAMPION,
    name: 'CHAMPION',
    displayName: 'Champion Plan',
    price: 50000, // $500.00/month in cents
    // Add monthly and yearly price IDs from Stripe
    prices: {
      monthly: {
        id: PRICE_IDS.CHAMPION_MONTHLY,
        amount: 50000, // $500.00 in cents
        interval: 'month'
      },
      yearly: {
        id: PRICE_IDS.CHAMPION_YEARLY,
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
      analytics: 'Advanced',
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

export const HIGH_BUDGET_THRESHOLD = Infinity; // No upper limit - removed $1000 restriction
export const MIN_PRIZE_PER_WINNER = 500  // $5.00 in cents
export const MAX_PRIZE_PER_WINNER = Infinity  // No upper limit - removed $1000 restriction

// CPM Rate Limits (per 1000 views)
export const MIN_CPM_RATE = 0.1  // $0.10 per 1000 views
export const MAX_CPM_RATE = 100  // $100.00 per 1000 views

// Contest Date and Duration Limits
export const MIN_DAYS_UNTIL_START = 2  // Contest must start at least 2 days from today (1 day gap)
export const MIN_CONTEST_DURATION_DAYS = 3  // Minimum contest duration in days
export const MAX_CONTEST_DURATION_DAYS = 28  // Maximum contest duration in days
export const DEFAULT_PRIZE_ALLOCATIONS = {
    1: 5000, // $50.00
    2: 3000, // $30.00
    3: 2000, // $20.00

  }

export const WITHDRAWAL_FEE_PERCENTAGE = 10; // 10% fee
export const MIN_WITHDRAWAL_AMOUNT = 500; // $5.00 in cents

// --- Timeout and Duration Constants ---
// Toast and notification timeouts
export const TOAST_DURATION_SHORT = 3000; // 3 seconds
export const TOAST_DURATION_MEDIUM = 5000; // 5 seconds
export const TOAST_DURATION_LONG = 10000; // 10 seconds
export const TOAST_DURATION_EXTENDED = 6000; // 6 seconds
export const TOAST_REMOVE_DELAY = 5000; // 5 seconds - reasonable duration for toast notifications

// API connection timeouts
export const API_TIMEOUT_SHORT = 5000; // 5 seconds
export const API_TIMEOUT_MEDIUM = 10000; // 10 seconds
export const API_TIMEOUT_LONG = 20000; // 20 seconds

// --- Default Values ---
// Default prize pool and budget values (in cents)
export const DEFAULT_TOTAL_PRIZE_POOL = 10000; // $100.00 in cents
export const DEFAULT_WINNER_AMOUNTS = [5000, 3000, 2000]; // $50, $30, $20 in cents
export const DEFAULT_WINNER_COUNT = 3;

// --- Form Limits and Placeholders ---
// Wallet top-up limits
export const WALLET_TOP_UP_MAX_AMOUNT = 10000; // $100.00 maximum top-up

// Form placeholder values (in dollars for display)
export const FORM_PLACEHOLDER_SMALL_AMOUNT = 10000; // $100.00
export const FORM_PLACEHOLDER_LARGE_AMOUNT = 1000000; // $10,000.00

// --- Plan Comparison Thresholds ---
// Price thresholds for plan comparison logic
export const PLAN_PRICE_THRESHOLD_STARTER = 10000; // $100.00 in cents (Starter plan price)

// Budget threshold for plan feature comparison (high minimum budget indicates lower-tier plan)
export const HIGH_MIN_BUDGET_THRESHOLD = 10000; // $100.00 in cents 

