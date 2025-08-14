// Subscription types that can be safely imported in client components
// No server-side dependencies here

export interface SubscriptionPlan {
  id: string; // Stripe product ID (prod_...)
  name: string;
  displayName?: string;
  price: number; // in cents
  prices?: {
    monthly?: {
      id: string; // Stripe price ID
      amount: number;
      interval: string;
    };
    yearly?: {
      id: string; // Stripe price ID
      amount: number;
      interval: string;
    };
  };
  features: {
    maxActiveContests: number;
    minContestBudget: number;
    maxWinnersPerContest: number;
    commissionPercentage: number;
    contestTypes: string[];
    analytics: string;
    support: string;
    description: string;
  };
}

export interface UserSubscription {
  id: string; // Stripe subscription ID
  user_id: string;
  product_id: string; // Stripe product ID
  price_id: string; // Stripe price ID
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  trial_start?: Date;
  trial_end?: Date;
  subscription_info?: {
    product_id: string;
    price_id: string;
    subscription_id: string;
    last_synced: string;
  };
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionPayment {
  id: string;
  user_id: string;
  subscription_id: string;
  plan_id: string;
  amount_cents: number;
  currency: string;
  billing_period_start: Date;
  billing_period_end: Date;
  payment_status: 'pending' | 'paid' | 'failed';
  stripe_invoice_id?: string;
  stripe_payment_intent_id?: string;
  paid_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionUpgradeOptions {
  upgradeType: 'immediate' | 'scheduled';
  targetPlanId: string;
  scheduledDate?: Date;
}

export interface CreateSubscriptionParams {
  userId: string;
  productId: string; // Stripe product ID
  priceId: string; // Stripe price ID
  upgradeOptions?: {
    // Timing of the change
    upgradeType: 'immediate' | 'scheduled';
    // Direction of the change (optional; used for accurate logging/labeling)
    changeType?: 'upgrade' | 'downgrade';
    scheduledDate?: Date;
    oldSubscriptionId?: string; // For safe upgrades - old subscription to cancel after new one is successful
  };
  trialDays?: number;
} 