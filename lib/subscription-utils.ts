import { createClient } from '@/utils/supabase/server';
import { stripe } from './stripe';
import { formatCurrencyFromCents } from './currency-utils';
import { subscriptionPlans, getPlanByProductId, getPlanByName, getPriceId } from '@/constants/subscriptionPlans';
import type {
  SubscriptionPlan,
  UserSubscription,
  SubscriptionPayment,
  SubscriptionUpgradeOptions,
  CreateSubscriptionParams
} from './subscription-types';

// Re-export types from the types file for backward compatibility
export type {
  SubscriptionPlan,
  UserSubscription,
  SubscriptionPayment,
  SubscriptionUpgradeOptions,
  CreateSubscriptionParams
} from './subscription-types';

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

// Note: convertDbPlanToSubscriptionPlan function removed as we now use constants instead of database

// Check if plan is free
export function isFreePlan(productId: string): boolean {
  const plan = getSubscriptionPlanById(productId);
  return plan?.price === 0;
}

// Get user's current subscription from new database structure
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const supabase = await createClient();
  
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
    } else {
      // This is expected - user has no subscription yet
      console.log('User has no subscription yet (PGRST116) - this is normal');
    }
    return null;
  }

  if (!profileData?.subscription_info) {
    console.log('User has no subscription_info in profile - this is normal for new users');
    return null;
  }

  const subscriptionInfo = profileData.subscription_info;
  
  // Handle free plans (no Stripe subscription)
  if (!subscriptionInfo.subscription_id || subscriptionInfo.subscription_id === 'free-plan') {
    // For free plans, create a virtual subscription object
    const freePlan = getSubscriptionPlanById(subscriptionInfo.product_id);
    if (!freePlan || freePlan.price > 0) {
      console.error('Invalid free plan configuration:', subscriptionInfo.product_id);
      return null;
    }

    return {
      id: 'free-plan',
      user_id: userId,
      product_id: subscriptionInfo.product_id,
      price_id: subscriptionInfo.price_id,
      status: 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days (monthly) for free plan
      cancel_at_period_end: false,
      trial_start: undefined,
      trial_end: undefined,
      subscription_info: subscriptionInfo,
      created_at: new Date(),
      updated_at: new Date()
    };
  }
  
  // Get full subscription details from subscriptions table for paid plans
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionInfo.subscription_id)
    .eq('user_id', userId)
    .single();

  if (subError) {
    // PGRST116 means subscription not found in subscriptions table
    if (subError.code === 'PGRST116') {
      console.log('Subscription not found in subscriptions table - this might be a data inconsistency');
      return null;
    } else {
      console.error('Error fetching subscription details:', subError);
      return null;
    }
  }

  if (!subscription) {
    console.log('No subscription data returned');
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

// Get user's plan features from subscription_info
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

// Create or get Stripe customer
export async function createOrGetStripeCustomer(userId: string): Promise<string | null> {
  const supabase = await createClient();
  
  // Check if user already has a Stripe customer ID in customers table
  const { data: customer, error } = await supabase
    .from('customers')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching customer record:', error);
    return null;
  }

  // If we have a customer ID, verify it exists in Stripe
  if (customer?.stripe_customer_id) {
    try {
      // Verify customer exists in Stripe
      await stripe().customers.retrieve(customer.stripe_customer_id);
      console.log('✅ Verified existing Stripe customer:', customer.stripe_customer_id);
      return customer.stripe_customer_id;
    } catch (stripeError: any) {
      if (stripeError.code === 'resource_missing') {
        console.log('⚠️ Customer exists in database but not in Stripe, recreating...');
        // Customer doesn't exist in Stripe, we'll recreate it
      } else {
        console.error('Error verifying Stripe customer:', stripeError);
        return null;
      }
    }
  }

  // Get user email from our users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (userError || !userData?.email) {
    console.error('No email found for user:', userId, userError);
    return null;
  }

  try {
    // Create new Stripe customer
    console.log('🔧 Creating new Stripe customer for:', userData.email);
    const stripeCustomer = await stripe().customers.create({
      email: userData.email,
      metadata: {
        user_id: userId
      }
    });

    console.log('✅ Created new Stripe customer:', stripeCustomer.id);

    // Save customer ID to customers table (upsert in case record exists)
    const { error: upsertError } = await supabase
      .from('customers')
      .upsert({ 
        id: userId, 
        stripe_customer_id: stripeCustomer.id 
      });

    if (upsertError) {
      console.error('Error saving customer record:', upsertError);
      return null;
    }

    return stripeCustomer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    return null;
  }
}

/**
 * Cancel any existing subscription schedules for a customer
 * This ensures only one active schedule exists per customer
 */
async function cancelExistingSubscriptionSchedules(customerId: string, userId: string) {
  try {
    console.log(`🔍 Fetching existing subscription schedules for customer: ${customerId}`);
    
    // Get all subscription schedules for this customer
    const schedules = await stripe().subscriptionSchedules.list({
      customer: customerId,
      limit: 100, // Get all schedules
    });

    console.log(`📋 Found ${schedules.data.length} existing schedules`);

    // Filter schedules that are not yet canceled or completed
    const activeSchedules = schedules.data.filter(schedule => 
      schedule.status === 'not_started' || schedule.status === 'active'
    );

    console.log(`📋 Found ${activeSchedules.length} active schedules to cancel`);

    // Cancel each active schedule
    for (const schedule of activeSchedules) {
      try {
        console.log(`❌ Canceling existing schedule: ${schedule.id} (status: ${schedule.status})`);
        await stripe().subscriptionSchedules.cancel(schedule.id);
        console.log(`✅ Successfully canceled schedule: ${schedule.id}`);
      } catch (cancelError) {
        console.error(`❌ Failed to cancel schedule ${schedule.id}:`, cancelError);
        // Continue with other schedules even if one fails
      }
    }

    if (activeSchedules.length > 0) {
      console.log(`✅ Canceled ${activeSchedules.length} existing subscription schedules`);
    } else {
      console.log('✅ No existing active schedules found');
    }

  } catch (error) {
    console.error('❌ Error fetching/canceling existing subscription schedules:', error);
    // Don't throw error - we still want to create the new schedule
    // This is a cleanup operation, not critical for the main flow
  }
}

// Create Stripe checkout session for subscription
export async function createSubscriptionCheckoutSession(
  params: CreateSubscriptionParams
): Promise<{ sessionId: string; url: string } | null> {
  const { userId, productId, priceId, upgradeOptions, trialDays = 0 } = params;

  try {
    const customerId = await createOrGetStripeCustomer(userId);
    if (!customerId) {
      throw new Error('Failed to create or get Stripe customer');
    }

    // CRITICAL: Cancel any existing subscription schedules for this customer
    console.log('🔍 Canceling existing schedules before creating checkout session...');
    await cancelExistingSubscriptionSchedules(customerId, userId);

    const plan = getSubscriptionPlanById(productId);
    if (!plan) {
      throw new Error('Invalid plan ID');
    }

    // Create checkout session
    const session = await stripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Add metadata to session itself for checkout.session.completed webhook
      metadata: {
        user_id: userId,
        product_id: productId,
        upgrade_type: upgradeOptions?.upgradeType || 'immediate',
        ...(upgradeOptions?.oldSubscriptionId && { old_subscription_id: upgradeOptions.oldSubscriptionId }),
      },
      subscription_data: {
        trial_period_days: trialDays > 0 ? trialDays : undefined,
        // Also add metadata to subscription for customer.subscription.created webhook
        metadata: {
          user_id: userId,
          product_id: productId,
          upgrade_type: upgradeOptions?.upgradeType || 'immediate',
          ...(upgradeOptions?.oldSubscriptionId && { old_subscription_id: upgradeOptions.oldSubscriptionId }),
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/failed?error=payment_cancelled`,
      allow_promotion_codes: true,
    });

    return {
      sessionId: session.id,
      url: session.url || '',
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return null;
  }
}

// Update subscription in database (called by webhooks)
export async function updateSubscriptionInDatabase(
  userId: string,
  subscriptionData: {
    subscription_id: string;
    product_id: string;
    price_id: string;
    status: string;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    trial_start?: Date;
    trial_end?: Date;
  }
): Promise<boolean> {
  const supabase = await createClient();

  try {
    // Update or insert subscription in subscriptions table using database function
    const { error: subscriptionError } = await supabase.rpc('update_subscription', {
      p_subscription_id: subscriptionData.subscription_id,
      p_user_id: userId,
      p_status: subscriptionData.status,
      p_price_id: subscriptionData.price_id,
      p_current_period_start: subscriptionData.current_period_start.toISOString(),
      p_current_period_end: subscriptionData.current_period_end.toISOString(),
      p_cancel_at_period_end: subscriptionData.cancel_at_period_end,
      p_trial_start: subscriptionData.trial_start?.toISOString() || null,
      p_trial_end: subscriptionData.trial_end?.toISOString() || null,
      p_quantity: 1,
      p_metadata: {},
      p_internal_notes: null,
      p_canceled_at: null,
      p_cancel_at: null,
      p_ended_at: subscriptionData.status === 'canceled' ? new Date().toISOString() : null
    });

    if (subscriptionError) {
      console.error('Error updating subscription:', subscriptionError);
      return false;
    }

    // Update subscription_info in advertiser_profiles
    const subscriptionInfo = {
      product_id: subscriptionData.product_id,
      price_id: subscriptionData.price_id,
      subscription_id: subscriptionData.subscription_id,
      last_synced: new Date().toISOString()
    };

    const { error: profileError } = await supabase
      .from('advertiser_profiles')
      .update({ subscription_info: subscriptionInfo })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating advertiser profile subscription_info:', profileError);
      return false;
    }

    console.log(`✅ Successfully updated subscription for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error in updateSubscriptionInDatabase:', error);
    return false;
  }
}

// Schedule subscription upgrade (simplified - immediate upgrade only for now)
export async function scheduleSubscriptionUpgrade(
  userId: string,
  targetPlanId: string,
  upgradeDate: Date
): Promise<boolean> {
  // For now, just do immediate upgrade
  // TODO: Implement scheduled upgrades if needed
  return upgradeSubscription(userId, targetPlanId);
}

// Cancel subscription upgrade (use subscription cancellation instead)
export async function cancelSubscriptionUpgrade(userId: string): Promise<boolean> {
  return cancelUserSubscription(userId, false);
}

// Helper function to upgrade subscription immediately - DEPRECATED
// Use the database function 'update_subscription' instead
async function upgradeSubscription(userId: string, targetProductId: string): Promise<boolean> {
  console.warn('upgradeSubscription is deprecated. Use the database function update_subscription instead.');
  return false;
}

// Helper function to cancel user subscription
async function cancelUserSubscription(userId: string, immediately: boolean = false): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase.rpc('cancel_subscription', {
      user_uuid: userId,
      cancel_immediately: immediately
    });

    if (error) {
      console.error('Error canceling subscription:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in cancel subscription:', error);
    return false;
  }
}

// Get Stripe customer portal URL
export async function getCustomerPortalUrl(userId: string): Promise<string | null> {
  let customerId: string | null = null;
  
  try {
    console.log('🔧 Getting customer portal URL for user:', userId);
    
    customerId = await createOrGetStripeCustomer(userId);
    if (!customerId) {
      console.error('❌ Failed to create or get Stripe customer for user:', userId);
      return null;
    }

    console.log('✅ Got customer ID:', customerId);

    const returnUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`
      : 'http://localhost:3000/dashboard/billing';
      
    console.log('🔧 Using return URL:', returnUrl);
    
    const portalSession = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    console.log('✅ Portal session created:', portalSession.url);
    return portalSession.url;
  } catch (error) {
    console.error('❌ Error creating customer portal session:', error);
    
    // If there's a configuration error and we have a customer ID, try fallback
    if (error instanceof Error && error.message.includes('configuration') && customerId) {
      console.log('⚠️ Configuration error detected, trying alternative approach...');
      
      try {
        // Try without any extra parameters
        const returnUrl = process.env.NEXT_PUBLIC_APP_URL 
          ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`
          : 'http://localhost:3000/dashboard/billing';
          
        const portalSession = await stripe().billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });
        
        console.log('✅ Portal session created with fallback:', portalSession.url);
        return portalSession.url;
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        
        // Final fallback: use the test portal URL if we're in test mode
        if (process.env.NODE_ENV === 'development' || process.env.STRIPE_SECRET_KEY?.includes('sk_test_')) {
          console.log('🔄 Using test portal URL as final fallback');
          return 'https://billing.stripe.com/p/login/test_cNi4gz0638qReRoenE0VO02';
        }
        
        return null;
      }
    }
    
    return null;
  }
}

// Check if user can upgrade to a specific plan
export async function canUpgradeToPlan(currentPlanId: string, targetPlanId: string): Promise<boolean> {
  const currentPlan = await getSubscriptionPlanById(currentPlanId);
  const targetPlan = await getSubscriptionPlanById(targetPlanId);

  if (!currentPlan || !targetPlan) {
    return false;
  }

  return targetPlan.price > currentPlan.price;
}

// Check if user can downgrade to a specific plan
export async function canDowngradeToPlan(currentPlanId: string, targetPlanId: string): Promise<boolean> {
  const currentPlan = await getSubscriptionPlanById(currentPlanId);
  const targetPlan = await getSubscriptionPlanById(targetPlanId);

  if (!currentPlan || !targetPlan) {
    return false;
  }

  return targetPlan.price < currentPlan.price;
}

// Get subscription payment history (simplified - use existing money_transactions table)
export async function getSubscriptionPaymentHistory(userId: string): Promise<SubscriptionPayment[]> {
  const supabase = await createClient();

  // Use your existing money_transactions table for payment history
  const { data, error } = await supabase
    .from('money_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('transaction_type', 'subscription_payment')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payment history:', error);
    return [];
  }

  // Convert to SubscriptionPayment format
  return data.map((transaction: any) => ({
    id: transaction.id,
    user_id: transaction.user_id,
    subscription_id: '', // Not tracked in money_transactions
    plan_id: '', // Could be added to transaction_metadata
    amount_cents: transaction.amount_cents,
    currency: 'USD', // Default
    billing_period_start: new Date(transaction.created_at),
    billing_period_end: new Date(transaction.created_at),
    payment_status: transaction.status === 'completed' ? 'paid' : 'pending',
    stripe_invoice_id: transaction.gateway_transaction_id,
    paid_at: transaction.status === 'completed' ? new Date(transaction.created_at) : undefined,
    created_at: new Date(transaction.created_at),
    updated_at: new Date(transaction.updated_at || transaction.created_at)
  }));
}

// Record subscription payment (use existing money_transactions system)
export async function recordSubscriptionPayment(
  paymentData: Omit<SubscriptionPayment, 'id' | 'created_at' | 'updated_at'>
): Promise<boolean> {
  const supabase = await createClient();

  try {
    // Record in your existing money_transactions table
    const { error } = await supabase
      .from('money_transactions')
      .insert([{
        user_id: paymentData.user_id,
        amount_cents: paymentData.amount_cents,
        transaction_type: 'subscription_payment',
        status: paymentData.payment_status === 'paid' ? 'completed' : 'pending',
        gateway: 'stripe', // Assume stripe for now
        gateway_transaction_id: paymentData.stripe_invoice_id,
        transaction_metadata: {
          subscription_id: paymentData.subscription_id,
          plan_id: paymentData.plan_id,
          billing_period_start: paymentData.billing_period_start.toISOString(),
          billing_period_end: paymentData.billing_period_end.toISOString()
        }
      }]);

    if (error) {
      console.error('Error recording subscription payment:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error recording payment:', error);
    return false;
  }
}

// Format plan price for display
export function formatPlanPrice(plan: SubscriptionPlan): string {
  if (plan.price === 0) {
    return 'Free';
  }
  return `${formatCurrencyFromCents(plan.price)}/month`;
}

// Get plan comparison data
export async function getPlanComparison(currentPlanId: string, targetPlanId: string): Promise<{
  priceDifference: number;
  featureDifferences: string[];
  isUpgrade: boolean;
}> {
  const currentPlan = await getSubscriptionPlanById(currentPlanId);
  const targetPlan = await getSubscriptionPlanById(targetPlanId);

  if (!currentPlan || !targetPlan) {
    return {
      priceDifference: 0,
      featureDifferences: [],
      isUpgrade: false
    };
  }

  const priceDifference = targetPlan.price - currentPlan.price;
  const isUpgrade = priceDifference > 0;

  const featureDifferences = [];
  
  if (targetPlan.features.maxActiveContests !== currentPlan.features.maxActiveContests) {
    featureDifferences.push(`Contest limit: ${currentPlan.features.maxActiveContests} → ${targetPlan.features.maxActiveContests}`);
  }
  
  if (targetPlan.features.commissionPercentage !== currentPlan.features.commissionPercentage) {
    featureDifferences.push(`Commission: ${currentPlan.features.commissionPercentage}% → ${targetPlan.features.commissionPercentage}%`);
  }
  
  if (targetPlan.features.maxWinnersPerContest !== currentPlan.features.maxWinnersPerContest) {
    featureDifferences.push(`Max winners: ${currentPlan.features.maxWinnersPerContest} → ${targetPlan.features.maxWinnersPerContest}`);
  }

  return {
    priceDifference,
    featureDifferences,
    isUpgrade
  };
}

// Check if subscription is about to expire
export function isSubscriptionExpiringSoon(subscription: UserSubscription, daysThreshold: number = 7): boolean {
  const now = new Date();
  const daysUntilExpiration = Math.ceil((subscription.current_period_end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiration <= daysThreshold;
}

// Get subscription status display text
export function getSubscriptionStatusText(subscription: UserSubscription): string {
  if (subscription.cancel_at_period_end) {
    return `Canceling on ${subscription.current_period_end.toDateString()}`;
  }
  
  if (subscription.status === 'active') {
    return `Active until ${subscription.current_period_end.toDateString()}`;
  }
  
  return subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1);
} 