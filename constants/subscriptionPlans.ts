export const subscriptionPlans = [
  {
    id: 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198',
    name: 'EXPLORER',
    displayName: 'Explorer Plan',
    price: 0, // $0.00/month
    features: {
      maxActiveContests: 1,
      minContestBudget: 10000, // $100.00 in cents
      maxWinnersPerContest: 3,
      commisionPercentage: 50,
      contestTypes: ['leaderboard'], // Leaderboard-based contests only
      analytics: 'basic', // Basic analytics for contest performance
      support: 'basic', // Standard support
      description: 'Entry-level users, startups, or small businesses wanting to test the platform',
    },
  },
  {
    id: '0477016e-7751-4049-bc57-19012004a05b',
    name: 'STARTER',
    displayName: 'Starter Plan',
    price: 10000, // $100.00/month in cents
    features: {
      maxActiveContests: 5,
      minContestBudget: 10000, // $100.00 in cents
      maxWinnersPerContest: 10,
      commisionPercentage: 20,
      contestTypes: ['leaderboard', 'cpm'], // Leaderboard-based and CPM-based contests
      analytics: 'basic', // Basic analytics and contest performance insights
      support: 'basic', // Standard support
      description: 'Small to medium-sized businesses that want to run more contests and grow their presence',
    },
  },
  {
    id: '4107627f-4ccb-4f1e-ad1a-fdc723e6a5ef',
    name: 'BUILDER',
    displayName: 'Builder Plan',
    price: 25000, // $250.00/month in cents
    features: {
      maxActiveContests: 15,
      minContestBudget: 7500, // $75.00 in cents
      maxWinnersPerContest: 25,
      commisionPercentage: 12,
      contestTypes: ['leaderboard', 'cpm'], // Leaderboard-based and CPM-based contests
      analytics: 'advanced', // Advanced analytics and contest performance reports
      support: 'priority', // Prioritized customer support
      description: 'Medium to large brands scaling their presence and want more contests and flexibility',
    },
  },
  {
    id: '0f094792-1ef6-4334-b169-f98d21ca0fbd',
    name: 'CHAMPION',
    displayName: 'Champion Plan',
    price: 50000, // $500.00/month in cents
    features: {
      maxActiveContests: 50,
      minContestBudget: 5000, // $50.00 in cents
      maxWinnersPerContest: 50,
      commisionPercentage: 10,
      contestTypes: ['leaderboard', 'cpm'], // Leaderboard-based and CPM-based contests
      analytics: 'comprehensive', // Comprehensive analytics and performance dashboards
      support: 'premium', // Premium, Dedicated 24/7 customer support
      description: 'Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support',
    },
  },
];

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

