import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';

// Service role client for webhooks - bypasses RLS for Stripe operations
// Only used in webhook context where there's no user session
function createServiceRoleClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
}

const endpointSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  if (!sig) {
    console.error('No Stripe signature found');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  if (!endpointSecret) {
    console.error('No webhook secret configured');
    return NextResponse.json({ error: 'No webhook secret configured' }, { status: 500 });
  }

  let event;

  try {
    event = stripe().webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed:`, err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`📥 Subscription Webhook received: ${event.type}`);

  // CRITICAL: Always return 200 for valid webhooks to prevent retries
  // Even if processing fails, we acknowledge receipt to Stripe
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'subscription_schedule.created':
        await handleSubscriptionScheduleCreated(event.data.object);
        break;

      case 'subscription_schedule.released':
        await handleSubscriptionScheduleReleased(event.data.object);
        break;

      case 'subscription_schedule.canceled':
        await handleSubscriptionScheduleCanceled(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`🔔 Unhandled subscription event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`❌ Error processing subscription webhook ${event.type}:`, error);
    console.error('📝 Event data:', JSON.stringify(event.data.object, null, 2));
    
    // Log error but still return 200 to prevent retries
    // Add error to internal logging system if available
    try {
      const supabase = createServiceRoleClient();
      await supabase
        .from('webhook_errors')
        .insert({
          event_type: event.type,
          event_id: event.id,
          error_message: error instanceof Error ? error.message : String(error),
          event_data: event.data.object,
          created_at: new Date().toISOString()
        })
        .single();
    } catch (logError) {
      console.error('❌ Failed to log webhook error:', logError);
    }
  }

  // ALWAYS return 200 to acknowledge receipt and prevent retries
  return NextResponse.json({ 
    received: true, 
    event_type: event.type,
    event_id: event.id,
    processed_at: new Date().toISOString()
  });
}

async function handleCheckoutSessionCompleted(session: any) {
  console.log('✅ Checkout session completed:', session.id);
  console.log('📋 Session metadata:', session.metadata);
  
  const { user_id, product_id } = session.metadata || {};
  
  if (!user_id || !product_id) {
    console.error('❌ Missing metadata in checkout session:', { user_id, product_id });
    return;
  }

  // Get the subscription from the session
  if (session.subscription) {
    console.log(`🔗 Checkout session has subscription: ${session.subscription}`);
    try {
      const subscription = await stripe().subscriptions.retrieve(session.subscription);
      console.log(`📊 Retrieved subscription status: ${subscription.status}`);
      
      await createSubscriptionInDatabase(subscription, user_id, product_id);
    } catch (error) {
      console.error('❌ Error retrieving subscription from session:', error);
    }
  } else {
    console.log('⚠️ Checkout session completed but no subscription found - might be a one-time payment');
  }
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('🆕 Subscription created:', subscription.id);
  console.log(`📊 Subscription status: ${subscription.status}`);
  console.log('📋 Subscription metadata:', subscription.metadata);
  
  const { user_id, product_id } = subscription.metadata || {};
  
  if (!user_id || !product_id) {
    console.error('❌ Missing metadata in subscription:', { user_id, product_id });
    
    // Try to get user_id from customer metadata
    if (subscription.customer && typeof subscription.customer === 'string') {
      try {
        const customer = await stripe().customers.retrieve(subscription.customer);
        if (customer && !customer.deleted && customer.metadata?.user_id) {
          console.log('✅ Found user_id in customer metadata:', customer.metadata.user_id);
          await createSubscriptionInDatabase(subscription, customer.metadata.user_id, product_id || 'unknown');
          return;
        }
      } catch (error) {
        console.error('❌ Error retrieving customer metadata:', error);
      }
    }
    
    console.error('❌ Cannot process subscription without user_id');
    return;
  }

  console.log(`👤 Processing subscription for user: ${user_id}, product: ${product_id}`);
  await createSubscriptionInDatabase(subscription, user_id, product_id);
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log('🔄 Subscription updated:', subscription.id);
  console.log(`📊 New status: ${subscription.status}`);
  
  const { user_id, product_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('❌ Missing user_id in subscription metadata');
    
    // Try to get user_id from customer metadata as fallback
    if (subscription.customer && typeof subscription.customer === 'string') {
      try {
        const customer = await stripe().customers.retrieve(subscription.customer);
        if (customer && !customer.deleted && customer.metadata?.user_id) {
          console.log('✅ Found user_id in customer metadata:', customer.metadata.user_id);
          const actualProductId = await getProductIdFromSubscription(subscription, product_id);
          await updateSubscriptionInDatabaseCorrect(subscription, customer.metadata.user_id, actualProductId);
          return;
        }
      } catch (error) {
        console.error('❌ Error retrieving customer metadata:', error);
      }
    }
    
    console.error('❌ Cannot process subscription update without user_id');
    return;
  }

  // Get the product ID from the subscription items if not in metadata
  const actualProductId = await getProductIdFromSubscription(subscription, product_id);
  
  if (actualProductId) {
    await updateSubscriptionInDatabaseCorrect(subscription, user_id, actualProductId);
  } else {
    console.error('❌ Could not determine product ID for subscription update');
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  console.log('❌ Subscription deleted:', subscription.id);
  
  const { user_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('❌ Missing user_id in subscription metadata');
    return;
  }

  await cancelSubscriptionInDatabase(subscription, user_id);
}

async function handleSubscriptionScheduleCreated(schedule: any) {
  console.log('📅 Subscription schedule created:', schedule.id);
  console.log('📋 Schedule metadata:', schedule.metadata);
  
  const { user_id, product_id, scheduled_change_type } = schedule.metadata || {};
  
  if (!user_id || !product_id) {
    console.error('❌ Missing metadata in subscription schedule:', { user_id, product_id });
    return;
  }

  console.log(`📅 Scheduled ${scheduled_change_type || 'change'} created for user: ${user_id}, product: ${product_id}`);
  // Schedule created - no action needed, just logging
}

async function handleSubscriptionScheduleReleased(schedule: any) {
  console.log('✅ Subscription schedule released (new subscription created):', schedule.id);
  console.log('📋 Released schedule metadata:', schedule.metadata);
  
  const { user_id, product_id, scheduled_change_type } = schedule.metadata || {};
  
  if (!user_id || !product_id) {
    console.error('❌ Missing metadata in released subscription schedule:', { user_id, product_id });
    return;
  }

  console.log(`✅ Scheduled ${scheduled_change_type || 'change'} activated for user: ${user_id}, product: ${product_id}`);
  
  // When a schedule is released, it creates a new subscription
  // The new subscription will be handled by the normal subscription.created webhook
  // We just need to update our advertiser_profiles to reflect the new subscription
  
  try {
    const supabase = createServiceRoleClient();
    
    // Get the subscription that was created from this schedule
    if (schedule.subscription) {
      const subscription = await stripe().subscriptions.retrieve(schedule.subscription);
      await createSubscriptionInDatabase(subscription, user_id, product_id);
    }
  } catch (error) {
    console.error('❌ Error processing released subscription schedule:', error);
  }
}

async function handleSubscriptionScheduleCanceled(schedule: any) {
  console.log('❌ Subscription schedule canceled:', schedule.id);
  console.log('📋 Canceled schedule metadata:', schedule.metadata);
  
  const { user_id, scheduled_change_type } = schedule.metadata || {};
  
  if (!user_id) {
    console.error('❌ Missing user_id in canceled subscription schedule:', user_id);
    return;
  }

  console.log(`❌ Scheduled ${scheduled_change_type || 'change'} canceled for user: ${user_id}`);
  // Schedule canceled - no action needed, user will continue on current plan
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  console.log('💰 Invoice payment succeeded:', invoice.id);
  
  if (!invoice.subscription) {
    return; // Not a subscription invoice
  }

  const subscription = await stripe().subscriptions.retrieve(invoice.subscription);
  const { user_id, product_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('❌ Missing user_id in subscription for invoice');
    return;
  }

  // Update subscription with latest info (ensures data is fresh)
  if (product_id) {
    await updateSubscriptionInDatabaseCorrect(subscription, user_id, product_id);
  }

  console.log(`✅ Payment processed for user ${user_id}, subscription updated`);
}

async function handleInvoicePaymentFailed(invoice: any) {
  console.log('❌ Invoice payment failed:', invoice.id);
  
  if (!invoice.subscription) {
    return; // Not a subscription invoice
  }

  const subscription = await stripe().subscriptions.retrieve(invoice.subscription);
  const { user_id, product_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('❌ Missing user_id in subscription for failed invoice');
    return;
  }

  // Update subscription status (Stripe will mark it as past_due, etc.)
  if (product_id) {
    await updateSubscriptionInDatabaseCorrect(subscription, user_id, product_id);
  }

  console.log(`💸 Payment failed for user ${user_id}, subscription status updated`);
}

// Helper function to extract product ID from subscription
async function getProductIdFromSubscription(subscription: any, fallbackProductId?: string): Promise<string> {
  if (fallbackProductId) {
    return fallbackProductId;
  }
  
  if (subscription.items?.data?.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    try {
      const price = await stripe().prices.retrieve(priceId);
      return price.product as string;
    } catch (error) {
      console.error('❌ Error retrieving product from price:', error);
    }
  }
  
  return 'unknown';
}

async function createSubscriptionInDatabase(subscription: any, userId: string, productId: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`Creating subscription in database for user ${userId}: ${subscription.id}`);
    
    // Helper function to safely convert Stripe timestamp to ISO string
    const safeTimestamp = (timestamp: number | null | undefined, useCurrentTimeAsFallback: boolean = false): string | null => {
      if (!timestamp || timestamp <= 0) {
        if (useCurrentTimeAsFallback) {
          console.warn(`⚠️ Using current time as fallback for undefined timestamp`);
          return new Date().toISOString();
        }
        return null;
      }
      try {
        return new Date(timestamp * 1000).toISOString();
      } catch (error) {
        console.error(`❌ Invalid timestamp: ${timestamp}`, error);
        if (useCurrentTimeAsFallback) {
          return new Date().toISOString();
        }
        return null;
      }
    };

    // Check if subscription already exists
    const { data: existingSubscription, error: existingError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscription.id)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('❌ Error checking existing subscription:', existingError);
      return;
    }

    // Cancel ALL existing active subscriptions for this user BEFORE creating new one
    const { data: activeSubscriptions, error: activeError } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due']);

    if (activeError) {
      console.error('❌ Error fetching active subscriptions:', activeError);
    } else if (activeSubscriptions && activeSubscriptions.length > 0) {
      console.log(`🔄 Found ${activeSubscriptions.length} active subscriptions for user ${userId}, canceling them...`);
      
      for (const activeSub of activeSubscriptions) {
        if (activeSub.id !== subscription.id) {
          console.log(`🔄 Canceling old subscription: ${activeSub.id}`);
          
          // Cancel in Stripe first
          try {
            await stripe().subscriptions.cancel(activeSub.id, {
              invoice_now: false,
              prorate: false
            });
            console.log(`✅ Successfully cancelled old Stripe subscription: ${activeSub.id}`);
          } catch (stripeError) {
            console.error(`❌ Error canceling old subscription ${activeSub.id} in Stripe:`, stripeError);
          }

          // Then update database
          const { error: cancelError } = await supabase
            .from('subscriptions')
            .update({ 
              status: 'canceled',
              cancel_at_period_end: false,
              updated: new Date().toISOString(),
              canceled_at: new Date().toISOString(),
              ended_at: new Date().toISOString()
            })
            .eq('id', activeSub.id);

          if (cancelError) {
            console.error(`❌ Error canceling old subscription ${activeSub.id} in database:`, cancelError);
          } else {
            console.log(`✅ Successfully cancelled old subscription ${activeSub.id} in database`);
          }
        }
      }
    }

    // Handle period start/end with proper constraint logic
    const currentTime = new Date();
    const periodStart = safeTimestamp(subscription.current_period_start, true);
    const periodEnd = safeTimestamp(subscription.current_period_end, false) || 
                     (() => {
                       const endTime = new Date(currentTime);
                       endTime.setMonth(endTime.getMonth() + 1); // Add 1 month for fallback
                       return endTime.toISOString();
                     })();

    const subscriptionData = {
      id: subscription.id,
      user_id: userId,
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      quantity: subscription.items.data[0].quantity || 1,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      trial_start: safeTimestamp(subscription.trial_start),
      trial_end: safeTimestamp(subscription.trial_end),
      cancel_at: safeTimestamp(subscription.cancel_at),
      canceled_at: safeTimestamp(subscription.canceled_at),
      ended_at: safeTimestamp(subscription.ended_at),
      stripe_metadata: subscription.metadata || {},
      internal_notes: `Created via webhook on ${new Date().toISOString()}`
    };

    if (existingSubscription) {
      console.log(`📝 Subscription ${subscription.id} already exists, updating it`);
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', subscription.id);

      if (updateError) {
        console.error('❌ Error updating subscription:', updateError);
        return;
      }
    } else {
      console.log(`📝 Creating new subscription: ${subscription.id}`);
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert(subscriptionData);

      if (insertError) {
        console.error('❌ Error creating subscription:', insertError);
        return;
      }
    }

    // Update advertiser profile
    const stripePriceId = subscription.items.data[0].price.id;
    await updateAdvertiserProfilePlan(userId, stripePriceId, subscription.id);

    console.log(`✅ Created new subscription: ${subscription.id} for user ${userId}`);
    
    // No need to handle oldSubscriptionId from metadata anymore - we handle all active subscriptions above
    
  } catch (error) {
    console.error('❌ Error in createSubscriptionInDatabase:', error);
  }
}

// Helper function to update advertiser profile with correct subscription info (JSONB)
async function updateAdvertiserProfilePlan(userId: string, stripePriceId: string, subscriptionId?: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`📋 Looking up product info for price ID: ${stripePriceId}`);
    
    // Look up product info from products table via prices
    const { data: priceData, error: priceError } = await supabase
      .from('prices')
      .select(`
        id,
        product_id,
        products!inner(id, name)
      `)
      .eq('id', stripePriceId)
      .single();
        
    if (priceError || !priceData || !priceData.products) {
      console.error(`❌ Could not find product for price ID ${stripePriceId}:`, priceError);
      return;
    }
    
    const productId = priceData.product_id;
    const productName = (priceData.products as any).name;
    console.log(`✅ Found product: ${productId} (${productName})`);
    
    // Update subscription_info JSONB field with correct structure
    await updateAdvertiserProfileWithSubscriptionInfo(userId, {
      product_id: productId,
      price_id: stripePriceId,
      subscription_id: subscriptionId || null,
      last_synced: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error updating advertiser profile plan:', error);
  }
}

async function updateAdvertiserProfileWithSubscriptionInfo(userId: string, subscriptionInfo: any) {
  const supabase = createServiceRoleClient();
  
  console.log(`📝 Updating advertiser profile with subscription_info:`, subscriptionInfo);
  const { error: profileError } = await supabase
    .from('advertiser_profiles')
    .update({ subscription_info: subscriptionInfo })
    .eq('id', userId);

  if (profileError) {
    console.error('❌ Error updating advertiser profile subscription_info:', profileError);
  } else {
    console.log(`✅ Updated advertiser profile subscription_info:`, subscriptionInfo);
  }
}

// Update subscription using correct schema
async function updateSubscriptionInDatabaseCorrect(subscription: any, userId: string, productId: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`Updating subscription in database for user ${userId}: ${subscription.id}`);
    
    // Helper function to safely convert Stripe timestamp to ISO string
    const safeTimestamp = (timestamp: number | null | undefined, useCurrentTimeAsFallback: boolean = false): string | null => {
      if (!timestamp || timestamp <= 0) {
        if (useCurrentTimeAsFallback) {
          console.warn(`⚠️ Using current time as fallback for undefined timestamp`);
          return new Date().toISOString();
        }
        return null;
      }
      try {
        return new Date(timestamp * 1000).toISOString();
      } catch (error) {
        console.error(`❌ Invalid timestamp: ${timestamp}`, error);
        if (useCurrentTimeAsFallback) {
          return new Date().toISOString();
        }
        return null;
      }
    };

    // Handle undefined period dates with fallbacks for updates
    const updateData: any = {
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      quantity: subscription.items.data[0].quantity || 1,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated: new Date().toISOString(),
      trial_start: safeTimestamp(subscription.trial_start),
      trial_end: safeTimestamp(subscription.trial_end),
      cancel_at: safeTimestamp(subscription.cancel_at),
      canceled_at: safeTimestamp(subscription.canceled_at),
      ended_at: safeTimestamp(subscription.ended_at),
      stripe_metadata: subscription.metadata || {},
      internal_notes: `Updated via webhook on ${new Date().toISOString()}`
    };

    // Only update period dates if they are valid (not undefined)
    if (subscription.current_period_start) {
      updateData.current_period_start = safeTimestamp(subscription.current_period_start);
    }
    if (subscription.current_period_end) {
      updateData.current_period_end = safeTimestamp(subscription.current_period_end);
    }

    // Update the subscription using Stripe subscription ID as primary key
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscription.id);

    if (subscriptionError) {
      console.error('❌ Error updating subscription:', subscriptionError);
      return;
    }

    // Update advertiser profile if plan changed
    const stripePriceId = subscription.items.data[0].price.id;
    await updateAdvertiserProfilePlan(userId, stripePriceId, subscription.id);

    console.log(`✅ Updated subscription for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('❌ Error in updateSubscriptionInDatabase:', error);
  }
}

// Cancel subscription using correct schema
async function cancelSubscriptionInDatabase(subscription: any, userId: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`Canceling subscription in database for user ${userId}`);
    
    // Helper function to safely convert Stripe timestamp to ISO string
    const safeTimestamp = (timestamp: number | null | undefined): string | null => {
      if (!timestamp || timestamp <= 0) return null;
      try {
        return new Date(timestamp * 1000).toISOString();
      } catch (error) {
        console.error(`❌ Invalid timestamp: ${timestamp}`, error);
        return null;
      }
    };

    // Update subscription status to canceled using Stripe subscription ID
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: false,
        updated: new Date().toISOString(),
        canceled_at: safeTimestamp(subscription.canceled_at) || new Date().toISOString(),
        ended_at: safeTimestamp(subscription.ended_at) || new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (subscriptionError) {
      console.error('❌ Error canceling subscription:', subscriptionError);
      return;
    }

    // Set user back to free plan (EXPLORER) using subscription_info JSONB
    const freeSubscriptionInfo = {
      product_id: 'prod_Sduka9mKXu35Ii', // EXPLORER (free plan)
      price_id: 'price_1RicueDCKN2LN0QeqyngXhRM', // Free price
      subscription_id: null,
      last_synced: new Date().toISOString()
    };

    const { error: profileError } = await supabase
      .from('advertiser_profiles')
      .update({ subscription_info: freeSubscriptionInfo })
      .eq('id', userId);

    if (profileError) {
      console.error('❌ Error updating advertiser profile to free plan:', profileError);
      return;
    }

    console.log(`✅ Canceled subscription for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('❌ Error in cancelSubscriptionInDatabase:', error);
  }
} 