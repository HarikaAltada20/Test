// Client-side subscription utilities
// Uses client-side Supabase client only - safe for client components

import { createClient } from '@/utils/supabase/client';
import { subscriptionPlans, getPlanByProductId, getPlanByName } from '@/constants/subscriptionPlans';
import type { SubscriptionPlan, UserSubscription } from './subscription-types';

// Get subscription plan by product ID (from constants - faster than DB)
export function getSubscriptionPlanById(productId: string): SubscriptionPlan | null {
  const plan = getPlanByProductId(productId);
  return plan || null;
}

// Get subscription plan by name (from constants)
export function getSubscriptionPlanByName(planName: string): SubscriptionPlan | null {
  const plan = getPlanByName(planName);
  return plan || null;
}

// Get all subscription plans (from constants)
export function getAllSubscriptionPlans(): SubscriptionPlan[] {
  return subscriptionPlans;
}

// Check if plan is free
export function isFreePlan(productId: string): boolean {
  const plan = getSubscriptionPlanById(productId);
  return plan?.price === 0;
}

// Get user's current subscription from new database structure (CLIENT-SIDE VERSION)
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const supabase = createClient();
  
  // First, get subscription info from advertiser_profiles
  const { data: profileData, error: profileError } = await supabase
    .from('advertiser_profiles')
    .select('subscription_info')
    .eq('id', userId)
    .single();

  if (profileError) {
    // PGRST116 just means no subscription found - this is normal for new users
    if (profileError.code !== 'PGRST116') {
      console.error('Error fetching subscription info:', profileError);
    }
    return null;
  }

  if (!profileData?.subscription_info) {
    return null;
  }

  const subscriptionInfo = profileData.subscription_info;
  
  // If no subscription_id, user has free plan
  if (!subscriptionInfo.subscription_id) {
    return {
      id: 'free',
      user_id: userId,
      product_id: subscriptionInfo.product_id,
      price_id: subscriptionInfo.price_id,
      status: 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days (monthly) for free plan
      cancel_at_period_end: false,
      subscription_info: subscriptionInfo,
      created_at: new Date(),
      updated_at: new Date()
    };
  }
  
  // Get full subscription details from subscriptions table
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionInfo.subscription_id)
    .eq('user_id', userId)
    .single();

  if (subError || !subscription) {
    console.error('Error fetching subscription details:', subError);
    return null;
  }

  return {
    id: subscription.id,
    user_id: subscription.user_id,
    product_id: subscriptionInfo.product_id,
    price_id: subscription.price_id,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start),
    current_period_end: new Date(subscription.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_start: subscription.trial_start ? new Date(subscription.trial_start) : undefined,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end) : undefined,
    subscription_info: subscriptionInfo,
    created_at: new Date(subscription.created),
    updated_at: new Date(subscription.updated)
  };
}

// Get user's plan features from subscription_info (CLIENT-SIDE VERSION)
export async function getUserPlanFeatures(userId: string): Promise<SubscriptionPlan['features'] | null> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    // Default to EXPLORER plan features
    const explorerPlan = getSubscriptionPlanByName('EXPLORER');
    return explorerPlan?.features || null;
  }

  const plan = getSubscriptionPlanById(subscription.product_id);
  return plan?.features || null;
}

// Format plan price for display
export function formatPlanPrice(plan: SubscriptionPlan): string {
  if (plan.price === 0) {
    return 'Free';
  }
  return `$${(plan.price / 100).toFixed(0)}/month`;
}

// Check if subscription is expiring soon
export function isSubscriptionExpiringSoon(subscription: UserSubscription, daysThreshold: number = 7): boolean {
  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  return subscription.current_period_end <= threshold;
}

// Get subscription status text for display
export function getSubscriptionStatusText(subscription: UserSubscription): string {
  switch (subscription.status) {
    case 'active':
      return subscription.cancel_at_period_end ? 'Canceling' : 'Active';
    case 'trialing':
      return 'Trial';
    case 'past_due':
      return 'Past Due';
    case 'canceled':
      return 'Canceled';
    case 'incomplete':
      return 'Incomplete';
    case 'incomplete_expired':
      return 'Expired';
    case 'unpaid':
      return 'Unpaid';
    default:
      return 'Unknown';
  }
} 