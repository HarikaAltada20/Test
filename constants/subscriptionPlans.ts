export const subscriptionPlans = [
  {
    id: 'free',
    name: 'Free',
    price: 10000,
    features: {
      maxActiveContests: 1,
      minContestBudget: 10000,
      maxWinnersPerContest: 10,
      commisionPercentage: 40,
    },
  },
  {
    id: 'bronze',
    name: 'Bronze',
    price: 10000,
    features: {
      maxActiveContests: 5,
      minContestBudget: 10000,
      maxWinnersPerContest: 10,
      commisionPercentage: 20,
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
      commisionPercentage: 15,
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
      commisionPercentage: 12,

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
      commisionPercentage: 10,
    },
  },
  {
    id: 'diamond',
    name: 'Diamond',
    price: 50000,
    features: {
      maxActiveContests: 100,
      minContestBudget: 5000,
      maxWinnersPerContest: 100,
      commisionPercentage: 10,
    },
  },
];

export const MAX_CONTEST_BUDGET = 100000; // Recommend contact for higher budget 