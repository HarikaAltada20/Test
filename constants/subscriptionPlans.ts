export const subscriptionPlans = [
  {
    id: 'bronze',
    name: 'Bronze',
    price: 100,
    features: {
      maxActiveContests: 5,
      minContestBudget: 100,
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
    price: 200,
    features: {
      maxActiveContests: 10,
      minContestBudget: 75,
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
    price: 300,
    features: {
      maxActiveContests: 20,
      minContestBudget: 50,
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
    price: 400,
    features: {
      maxActiveContests: 30,
      minContestBudget: 50,
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
    price: 500,
    features: {
      maxActiveContests: Infinity,
      minContestBudget: 50,
      maxWinnersPerContest: Infinity,
      accessToCreators: true,
      contestBranding: 'Custom Designs by Our Team',
      analytics: true,
      support: 'Standard',
    },
  },
];

export const MAX_CONTEST_BUDGET = 1000; // Recommend contact for higher budget 