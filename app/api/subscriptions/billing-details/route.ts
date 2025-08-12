import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscription, getSubscriptionPlanById } from '@/lib/subscription-utils';
import { stripe } from '@/lib/stripe';
import { subscriptionPlans, PRICE_IDS } from '@/constants/subscriptionPlans';

export async function GET(request: NextRequest) {
  try {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log('[API] GET /api/subscriptions/billing-details:start', { requestId });
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an advertiser
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (userError || userData?.user_type !== 'advertiser') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get current subscription
    const subscription = await getUserSubscription(user.id);
    
    if (!subscription) {
      console.log('[API] /subscriptions/billing-details:none', { requestId, userId: user.id });
      return NextResponse.json({
        billingDetails: null,
        scheduledChanges: [],
        message: 'No subscription found'
      });
    }

    // Get plan details
    const plan = getSubscriptionPlanById(subscription.product_id);
    
    // Calculate billing details
    const now = new Date();
    const periodStart = new Date(subscription.current_period_start);
    const periodEnd = new Date(subscription.current_period_end);
    const daysUntilNextBilling = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    const billingDetails = {
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      nextBillingDate: periodEnd.toISOString(),
      daysUntilNextBilling: Math.max(0, daysUntilNextBilling),
      isCanceled: subscription.status === 'canceled',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      status: subscription.status,
      amount: plan?.price || 0,
      currency: 'usd'
    };

    // Fetch scheduled changes from Stripe (if subscription exists)
    let scheduledChanges: Array<{
      id: string;
      type: 'upgrade' | 'downgrade';
      targetPlan: any;
      scheduledDate: string;
      priceDifference: number;
      status: string;
    }> = [];
    
    if (subscription.id !== 'free-plan' && subscription.id) {
      try {
        console.log('[API] 🔍 Fetching scheduled changes for subscription:', { requestId, subscriptionId: subscription.id });
        
        // Get subscription schedules for this customer
        const customerId = await getStripeCustomerId(user.id);
        console.log('👤 Customer ID:', customerId);
        
        if (customerId) {
          const schedules = await stripe().subscriptionSchedules.list({
            customer: customerId,
            limit: 10
          });

          console.log('📅 Found schedules:', schedules.data.length);
          console.log('📅 Schedule statuses:', schedules.data.map(s => ({ id: s.id, status: s.status })));

          scheduledChanges = schedules.data
            .filter(schedule => schedule.status === 'active' || schedule.status === 'not_started')
            .map(schedule => {
              console.log('🔍 Processing schedule:', schedule.id);
              
                             const phase = schedule.phases[0];
               const priceId = phase.items[0]?.price;
               console.log('💰 Price ID from schedule:', priceId);
               
               const targetPlan = getSubscriptionPlanByPriceId(typeof priceId === 'string' ? priceId : priceId?.id || '');
              console.log('📋 Target plan found:', targetPlan?.displayName || 'null');
              
              if (targetPlan && plan) {
                const priceDifference = targetPlan.price - plan.price;
                const changeType = priceDifference > 0 ? 'upgrade' : 'downgrade';
                
                console.log('✅ Creating scheduled change:', {
                  type: changeType,
                  from: plan.displayName,
                  to: targetPlan.displayName,
                  priceDifference
                });
                
                                 return {
                   id: schedule.id,
                   type: changeType as 'upgrade' | 'downgrade',
                   targetPlan: targetPlan,
                   scheduledDate: new Date(schedule.phases[0]?.start_date ? schedule.phases[0].start_date * 1000 : Date.now()).toISOString(),
                   priceDifference: priceDifference,
                   status: schedule.status
                 };
              }
              
              console.log('❌ No target plan found for price ID:', priceId);
              return null;
            })
            .filter(change => change !== null);
            
          console.log('✅ Final scheduled changes:', scheduledChanges.length);
        } else {
          console.log('❌ No customer ID found');
        }
      } catch (error) {
        console.error('❌ Error fetching scheduled changes:', { requestId, error });
        // Don't fail the entire request if scheduled changes can't be fetched
      }
    } else {
      console.log('❌ No subscription ID or free plan');
    }

        // Fallback: Check subscription metadata for scheduled changes
    if (scheduledChanges.length === 0 && subscription.cancel_at_period_end) {
      console.log('🔍 Checking subscription metadata for scheduled changes...');
      
      // Try to get the actual subscription from Stripe to check metadata
      try {
        const stripeSubscription = await stripe().subscriptions.retrieve(subscription.id);
        console.log('📋 Subscription metadata:', stripeSubscription.metadata);
        
        // Check if there's a scheduled replacement in metadata
        if (stripeSubscription.metadata.scheduled_replacement) {
          console.log('✅ Found scheduled replacement in metadata:', stripeSubscription.metadata.scheduled_replacement);
          
          // Try to get the schedule details
          const schedule = await stripe().subscriptionSchedules.retrieve(stripeSubscription.metadata.scheduled_replacement);
          console.log('📅 Schedule details:', schedule);
          
                      if (schedule && schedule.phases && schedule.phases.length > 0) {
              console.log('📋 Schedule status check:', schedule.status);
              
              // Only process if schedule is active or not_started
              if (schedule.status === 'canceled') {
                console.log('❌ Schedule is canceled, skipping...');
                scheduledChanges = [];
              } else if (schedule.status === 'active' || schedule.status === 'not_started') {
                                 const phase = schedule.phases[0];
                 const priceId = phase.items[0]?.price;
                 const targetPlan = getSubscriptionPlanByPriceId(typeof priceId === 'string' ? priceId : priceId?.id || '');
                
                if (targetPlan && plan) {
                  const priceDifference = targetPlan.price - plan.price;
                  const changeType = priceDifference > 0 ? 'upgrade' : 'downgrade';
                  
                  // Fix the date conversion issue
                  let scheduledDate;
                  try {
                    // Try to get the start date from the phase
                    const phase = schedule.phases[0];
                    if (phase && phase.start_date) {
                      scheduledDate = new Date(phase.start_date * 1000).toISOString();
                    } else {
                      // Fallback to current period end
                      scheduledDate = new Date(subscription.current_period_end).toISOString();
                    }
                  } catch (dateError) {
                    console.error('❌ Date conversion error:', dateError);
                    // Fallback to current period end
                    scheduledDate = new Date(subscription.current_period_end).toISOString();
                  }

                  scheduledChanges = [{
                    id: schedule.id,
                    type: changeType,
                    targetPlan: targetPlan,
                    scheduledDate: scheduledDate,
                    priceDifference: priceDifference,
                    status: schedule.status
                  }];
                  
                  console.log('✅ Created scheduled change from metadata');
                } else {
                  console.log('❌ Could not resolve target plan or current plan');
                  scheduledChanges = [];
                }
              } else {
                console.log('❌ Schedule status not valid for processing:', schedule.status);
                scheduledChanges = [];
              }
            } else {
              console.log('❌ No valid schedule phases found');
              scheduledChanges = [];
            }
        }
      } catch (error) {
        console.error('❌ Error checking subscription metadata:', error);
        
        // Final fallback: Use database metadata if Stripe fails
        console.log('🔍 Trying database metadata fallback...');
        try {
                     // Parse the stripe_metadata from the subscription
           const metadata = JSON.parse((subscription as any).stripe_metadata || '{}');
          console.log('📋 Database metadata:', metadata);
          
                      if (metadata.scheduled_replacement && metadata.cancel_reason) {
              console.log('✅ Found scheduled replacement in database metadata:', metadata.scheduled_replacement);
              
              // First, check if the schedule is still active by querying Stripe
              try {
                const schedule = await stripe().subscriptionSchedules.retrieve(metadata.scheduled_replacement);
                if (schedule.status === 'canceled') {
                  console.log('❌ Database metadata schedule is canceled, skipping...');
                  scheduledChanges = [];
                } else {
                  // Extract target plan from cancel_reason
                  const cancelReason = metadata.cancel_reason;
                  let targetPlanName = '';
                  
                  if (cancelReason.includes('scheduled_upgrade_to_BUILDER')) {
                    targetPlanName = 'BUILDER';
                  } else if (cancelReason.includes('scheduled_upgrade_to_CHAMPION')) {
                    targetPlanName = 'CHAMPION';
                  } else if (cancelReason.includes('scheduled_downgrade_to_STARTER')) {
                    targetPlanName = 'STARTER';
                  } else if (cancelReason.includes('scheduled_downgrade_to_EXPLORER')) {
                    targetPlanName = 'EXPLORER';
                  }
                  
                  if (targetPlanName) {
                    const targetPlan = subscriptionPlans.find(p => p.name === targetPlanName);
                    if (targetPlan && plan) {
                      const priceDifference = targetPlan.price - plan.price;
                      const changeType = priceDifference > 0 ? 'upgrade' : 'downgrade';
                      
                      scheduledChanges = [{
                        id: metadata.scheduled_replacement,
                        type: changeType,
                        targetPlan: targetPlan,
                        scheduledDate: new Date(subscription.current_period_end).toISOString(),
                        priceDifference: priceDifference,
                        status: schedule.status
                      }];
                      
                      console.log('✅ Created scheduled change from database metadata');
                    }
                  }
                }
              } catch (scheduleError) {
                console.error('❌ Error checking schedule status from database metadata:', scheduleError);
                scheduledChanges = [];
              }
            }
        } catch (dbError) {
          console.error('❌ Error parsing database metadata:', dbError);
        }
      }
    }

    console.log('[API] /subscriptions/billing-details:success', { requestId, hasScheduledChanges: scheduledChanges.length > 0 });
    return NextResponse.json({
      billingDetails,
      scheduledChanges,
      message: 'Billing details retrieved successfully'
    });

  } catch (error) {
    console.error('[API] /subscriptions/billing-details:error', { message: (error as any)?.message || String(error), raw: error });
    return NextResponse.json(
      { error: 'Failed to fetch billing details' },
      { status: 500 }
    );
  }
}

// Helper function to get Stripe customer ID
async function getStripeCustomerId(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    // Get customer ID from customers table (not advertiser_profiles)
    const { data: customer, error } = await supabase
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching customer record:', error);
      return null;
    }

    if (!customer?.stripe_customer_id) {
      console.log('❌ No customer ID found for user:', userId);
      return null;
    }

    console.log('✅ Found customer ID:', customer.stripe_customer_id);
    return customer.stripe_customer_id;
  } catch (error) {
    console.error('Error getting Stripe customer ID:', error);
    return null;
  }
}

// Helper function to get plan by Stripe price ID
function getSubscriptionPlanByPriceId(priceId: string): any {
  console.log('🔍 Looking for plan with price ID:', priceId);
  console.log('📋 Available price IDs:', subscriptionPlans.map(p => ({
    plan: p.displayName,
    monthly: p.prices?.monthly?.id,
    yearly: p.prices?.yearly?.id
  })));
  
  // Find the plan that has this price ID
  for (const plan of subscriptionPlans) {
    if (plan.prices?.monthly?.id === priceId || plan.prices?.yearly?.id === priceId) {
      console.log('✅ Found plan:', plan.displayName);
      return plan;
    }
  }
  
  console.log('❌ No plan found for price ID:', priceId);
  return null;
} 