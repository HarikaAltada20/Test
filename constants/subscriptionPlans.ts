export const subscriptionPlans = [
  {
    id: 'bronze',
    name: 'Bronze',
    price: 10000,
    features: {
      maxActiveContests: 5,
      minContestBudget: 10000,
      maxWinnersPerContest: 10,
      accessToCreators: true,
      contestBranding: 'Basic Templates',
      analytics: true,
      support: 'Standard',
    },
  },
  {
    id: 'silver',
    name: 'Silver',
    price: 20000,
    features: {
      maxActiveContests: 10,
      minContestBudget: 7500,
      maxWinnersPerContest: 20,
      accessToCreators: true,
      contestBranding: 'Improved Templates',
      analytics: true,
      support: 'Standard',
    },
  },
  {
    id: 'gold',
    name: 'Gold',
    price: 30000,
    features: {
      maxActiveContests: 20,
      minContestBudget: 5000,
      maxWinnersPerContest: 30,
      accessToCreators: true,
      contestBranding: 'Advanced Styling',
      analytics: true,
      support: 'Standard',
    },
  },
  {
    id: 'platinum',
    name: 'Platinum',
    price: 40000,
    features: {
      maxActiveContests: 30,
      minContestBudget: 5000,
      maxWinnersPerContest: 50,
      accessToCreators: true,
      contestBranding: 'Full Brand Styling',
      analytics: true,
      support: 'Standard',
    },
  },
  {
    id: 'diamond',
    name: 'Diamond',
    price: 50000,
    features: {
      maxActiveContests: Infinity,
      minContestBudget: 5000,
      maxWinnersPerContest: Infinity,
      accessToCreators: true,
      contestBranding: 'Custom Designs by Our Team',
      analytics: true,
      support: 'Standard',
    },
  },
];

export const MAX_CONTEST_BUDGET = 100000; // Recommend contact for higher budget 