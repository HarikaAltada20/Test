export const subscriptionPlans = [
  {
    id: 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198',
    name: 'FREE',
    price: 0,
    features: {
      maxActiveContests: 1,
      minContestBudget: 10000,
      maxWinnersPerContest: 3,
      commisionPercentage: 50,
    },
  },
  {
    id: '0477016e-7751-4049-bc57-19012004a05b',
    name: 'BRONZE',
    price: 10000,
    features: {
      maxActiveContests: 5,
      minContestBudget: 10000,
      maxWinnersPerContest: 10,
      commisionPercentage: 20,
    },
  },
  {
    id: '4107627f-4ccb-4f1e-ad1a-fdc723e6a5ef',
    name: 'SILVER',
    price: 20000,
    features: {
      maxActiveContests: 10,
      minContestBudget: 7500,
      maxWinnersPerContest: 20,
      commisionPercentage: 15,
    },
  },
  {
    id: '0f094792-1ef6-4334-b169-f98d21ca0fbd',
    name: 'GOLD',
    price: 30000,
    features: {
      maxActiveContests: 20,
      minContestBudget: 5000,
      maxWinnersPerContest: 30,
      commisionPercentage: 12,
    },
  },
  {
    id: 'f7630717-5578-4988-922f-255ca4c985c4',
    name: 'PLATINUM',
    price: 40000,
    features: {
      maxActiveContests: 30,
      minContestBudget: 5000,
      maxWinnersPerContest: 50,
      commisionPercentage: 10,
    },
  },
  {
    id: '79a96d6b-ba5c-453c-bbca-49937ba05ad6',
    name: 'DIAMOND',
    price: 50000,
    features: {
      maxActiveContests: 100,
      minContestBudget: 5000,
      maxWinnersPerContest: 100,
      commisionPercentage: 10,
    },
  },
];

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

