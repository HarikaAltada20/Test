import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { stripe } from "./stripe";
import { formatCurrencyFromCents } from "./currency-utils";
import {
  subscriptionPlans,
  getPlanByProductId,
  getPlanByName,
  getPriceId,
} from "@/constants/subscriptionPlans";
import type {
  SubscriptionPlan,
  UserSubscription,
  SubscriptionPayment,
  SubscriptionUpgradeOptions,
  CreateSubscriptionParams,
} from "./subscription-types";

// Re-export types from the types file for backward compatibility
export type {
SubscriptionPlan,
UserSubscription,
SubscriptionPayment,
SubscriptionUpgradeOptions,
CreateSubscriptionParams
} from './subscription-types';

// Get subscription plan by product ID (from constants - faster than DB)
export function getSubscriptionPlanById(
  productId: string
): SubscriptionPlan | null {
  const plan = getPlanByProductId(productId);
  return plan || null;
}

// Get subscription plan by name (from constants)
export function getSubscriptionPlanByName(
  planName: string
): SubscriptionPlan | null {
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

/**
 * Check if a user has EVER had a paid subscription (lifetime).
 *
 * "Paid" here means the Stripe price for the subscription had unit_amount > 0,
 * even if the first invoice was discounted to 0 via a coupon or promotion code.
 *
 * This is used to ensure that free trials are truly one‑time: once a user has
 * ever been on any paid plan (even via a fully‑discounted first period),
 * they are no longer eligible for plan‑level free trials.
 */
export async function hasUserEverHadPaidSubscription(
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  // Look for any historical subscription rows for this user that point to a
  // paid Stripe price. We include canceled and past states as well to capture
  // previous paid plans, not just the current one.
  const {
    data: subRow,
    error: subError,
  } = await supabase
    .from("subscriptions")
    .select("id, price_id")
    .eq("user_id", userId)
    .in("status", [
      "active",
      "trialing",
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
    ])
    .order("created", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (subError) {
    // PGRST116 just means "no rows" – i.e. truly new user
    if ((subError as any).code !== "PGRST116") {
      console.error(
        "Error checking historical subscriptions for user:",
        userId,
        subError
      );
    }
    return false;
  }

  if (!subRow?.price_id) {
    return false;
  }

  const {
    data: priceRow,
    error: priceError,
  } = await supabase
    .from("prices")
    .select("unit_amount")
    .eq("id", subRow.price_id)
    .single();

  if (priceError) {
    if ((priceError as any).code !== "PGRST116") {
      console.error(
        "Error fetching price for historical subscription:",
        subRow.price_id,
        priceError
      );
    }
    return false;
  }

  const unitAmount = priceRow?.unit_amount ?? 0;
  return unitAmount > 0;
}

// Get user's current subscription from new database structure
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const supabase = await createClient();

  // First, get subscription info from advertiser_profiles
  const { data: profileData, error: profileError } = await supabase
    .from("advertiser_profiles")
    .select("subscription_info")
    .eq("id", userId)
    .single();

  if (profileError) {
    // PGRST116 just means no subscription found - this is normal for new users
    if (profileError.code !== "PGRST116") {
      console.error("Error fetching subscription info:", profileError);
    } else {
      // This is expected - user has no subscription yet
      console.log(
        "User has no subscription yet (PGRST116) - this is normal"
      );
    }
    return null;
  }

  if (!profileData?.subscription_info) {
    console.log(
      "User has no subscription_info in profile - this is normal for new users"
    );
    return null;
  }

  const subscriptionInfo = profileData.subscription_info;

  // Handle free plans (no Stripe subscription)
  if (
    !subscriptionInfo.subscription_id ||
    subscriptionInfo.subscription_id === "free-plan"
  ) {
    // For free plans, create a virtual subscription object
    const freePlan = getSubscriptionPlanById(subscriptionInfo.product_id);
    if (!freePlan || freePlan.price > 0) {
      console.error(
        "Invalid free plan configuration:",
        subscriptionInfo.product_id
      );
      return null;
    }

    return {
      id: "free-plan",
      user_id: userId,
      product_id: subscriptionInfo.product_id,
      price_id: subscriptionInfo.price_id,
      status: "active",
      current_period_start: new Date(),
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ), // 30 days (monthly) for free plan
      cancel_at_period_end: false,
      trial_start: undefined,
      trial_end: undefined,
      subscription_info: subscriptionInfo,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  // Get full subscription details from subscriptions table for paid plans
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionInfo.subscription_id)
    .eq("user_id", userId)
    .single();

  if (subError) {
    // PGRST116 means subscription not found in subscriptions table
    if (subError.code === "PGRST116") {
      console.log(
        "Subscription not found in subscriptions table - this might be a data inconsistency"
      );
      return null;
    } else {
      console.error("Error fetching subscription details:", subError);
      return null;
    }
  }

  if (!subscription) {
    console.log("No subscription data returned");
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
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start)
      : undefined,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end)
      : undefined,
    subscription_info: subscriptionInfo,
    created_at: new Date(subscription.created),
    updated_at: new Date(subscription.updated),
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

/** Admin/service-role plan lookup for operating on another user's account. */
export async function getUserPlanFeaturesAsAdmin(
  userId: string,
): Promise<SubscriptionPlan["features"] | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("advertiser_profiles")
    .select("subscription_info")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching brand subscription (admin):", error);
  }

  const productId = data?.subscription_info?.product_id;
  if (productId) {
    const plan = getSubscriptionPlanById(productId);
    if (plan?.features) return plan.features;
  }

  const explorerPlan = getSubscriptionPlanByName("EXPLORER");
  return explorerPlan?.features || null;
}

export function getPlanFeaturesFromProductId(
  productId: string | null | undefined,
): SubscriptionPlan["features"] | null {
  if (!productId) return null;
  return getSubscriptionPlanById(productId)?.features ?? null;
}

function getStripeCustomerErrorMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const stripeError = error as { type?: string; code?: string };
  if (stripeError.type === "StripeAuthenticationError") {
    return "Card payments are temporarily unavailable. Please use Solana or contact support.";
  }

  return null;
}

async function resolveUserEmailForStripe(userId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: userData, error: userError } = await admin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (userData?.email) {
    return userData.email;
  }

  if (userError && userError.code !== "PGRST116") {
    console.error("Error fetching user email:", userId, userError);
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(userId);

  if (authError || !authData.user?.email) {
    console.error("No email found for user:", userId, authError);
    return null;
  }

  return authData.user.email;
}

// Create or get Stripe customer
export async function createOrGetStripeCustomer(
  userId: string,
): Promise<string | null> {
  const admin = createAdminClient();

  const { data: customer, error } = await admin
    .from("customers")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching customer record:", error);
    return null;
  }

  if (customer?.stripe_customer_id) {
    try {
      await stripe().customers.retrieve(customer.stripe_customer_id);
      console.log(
        "✅ Verified existing Stripe customer:",
        customer.stripe_customer_id,
      );
      return customer.stripe_customer_id;
    } catch (stripeError: any) {
      if (stripeError.code === "resource_missing") {
        console.log(
          "⚠️ Customer exists in database but not in Stripe, recreating...",
        );
      } else {
        const stripeMessage = getStripeCustomerErrorMessage(stripeError);
        if (stripeMessage) {
          throw new Error(stripeMessage);
        }
        console.error("Error verifying Stripe customer:", stripeError);
        return null;
      }
    }
  }

  const email = await resolveUserEmailForStripe(userId);
  if (!email) {
    return null;
  }

  try {
    console.log("🔧 Creating new Stripe customer for:", email);
    const stripeCustomer = await stripe().customers.create({
      email,
      metadata: {
        user_id: userId,
      },
    });

    console.log("✅ Created new Stripe customer:", stripeCustomer.id);

    const { error: upsertError } = await admin.from("customers").upsert({
      id: userId,
      stripe_customer_id: stripeCustomer.id,
    });

    if (upsertError) {
      console.error("Error saving customer record:", upsertError);
      return null;
    }

    return stripeCustomer.id;
  } catch (error) {
    const stripeMessage = getStripeCustomerErrorMessage(error);
    if (stripeMessage) {
      throw new Error(stripeMessage);
    }
    console.error("Error creating Stripe customer:", error);
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

// Debug logging for trial configuration
console.log(`🔍 Trial configuration for plan ${productId}:`);
console.log(`  - Plan trialDays: ${plan.trialDays}`);
console.log(`  - Passed trialDays: ${trialDays}`);
console.log(`  - Plan price: ${plan.price}`);
console.log(`  - Plan name: ${plan.name}`);

// Create checkout session
const sessionConfig: any = {
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
success_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/failed?error=payment_cancelled`,
allow_promotion_codes: true,
};

// Add trial configuration only if trial days are specified
if (trialDays && trialDays > 0) {
sessionConfig.subscription_data = {
trial_period_days: trialDays,
// Also add metadata to subscription for customer.subscription.created webhook
metadata: {
user_id: userId,
product_id: productId,
upgrade_type: upgradeOptions?.upgradeType || 'immediate',
...(upgradeOptions?.oldSubscriptionId && { old_subscription_id: upgradeOptions.oldSubscriptionId }),
},
};
console.log(`✅ Configured trial with ${trialDays} days`);
} else {
console.log(`ℹ️ No trial configured - regular subscription`);
}

console.log(`🔧 Creating Stripe session with config:`, JSON.stringify(sessionConfig, null, 2));

const session = await stripe().checkout.sessions.create(sessionConfig);

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

// Check if subscription is in trial period
export function isSubscriptionInTrial(subscription: UserSubscription): boolean {
  if (subscription.status === 'trialing') {
    return true;
  }
  
  return !!(subscription.trial_start && subscription.trial_end && 
           new Date(subscription.trial_start).getTime() <= new Date().getTime() && 
           new Date().getTime() <= new Date(subscription.trial_end).getTime());
}

// Get trial days remaining
export function getTrialDaysRemaining(subscription: UserSubscription): number {
  if (!isSubscriptionInTrial(subscription) || !subscription.trial_end) {
    return 0;
  }
  
  const now = new Date();
  const trialEnd = new Date(subscription.trial_end);
  const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return Math.max(0, daysRemaining);
}

// Check if user is eligible for trial on a specific plan
export function isEligibleForTrial(plan: SubscriptionPlan, currentSubscription: UserSubscription | null): boolean {
// Only new users (no subscription or free plan) are eligible for trials
if (currentSubscription && currentSubscription.id !== "free-plan") {
return false;
}
  
// Only plans with trialDays are eligible
if (!plan.trialDays || plan.trialDays <= 0) {
return false;
}
  
// Only paid plans are eligible for trials
if (plan.price === 0) {
return false;
}
  
return true;
}

// Get trial display text for a plan
export function getTrialDisplayText(plan: SubscriptionPlan, currentSubscription: UserSubscription | null): string | null {
if (!isEligibleForTrial(plan, currentSubscription)) {
return null;
}
  
return `${plan.trialDays}-day free trial`;
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