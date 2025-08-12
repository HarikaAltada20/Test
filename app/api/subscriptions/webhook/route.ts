import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { subscriptionPlans, PRODUCT_IDS, PRICE_IDS } from '@/constants/subscriptionPlans';
import { ensureDefaultPaymentMethod } from '@/lib/payment-utils';

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
const describeEnv = () => {
  const mask = (val?: string | null) => (val ? `${val.slice(0, 6)}...${val.slice(-4)}` : 'undefined');
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = endpointSecret;
  return {
    mode: secretKey?.startsWith('sk_live_') ? 'live' : (secretKey?.startsWith('sk_test_') ? 'test' : 'unknown'),
    secretMasked: mask(secretKey),
    publishableMasked: mask(publishableKey),
    webhookMasked: mask(webhookSecret),
  };
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log('[Webhook] /api/subscriptions/webhook:start', { requestId, env: describeEnv() });

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
    console.error(`[Webhook] signature verification failed`, { requestId, message: err?.message, raw: err });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`📥 Subscription Webhook received: ${event.type}`, { requestId, eventId: event.id });
  
  // 🆕 COMPREHENSIVE EVENT TRACKING: Log all events for debugging
  try {
    const supabase = createServiceRoleClient();
    await supabase
      .from('webhook_events')
      .insert({
        event_type: event.type,
        event_id: event.id,
        object_id: (event.data.object as any).id,
        object_type: (event.data.object as any).object,
        created_at: event.created ? new Date(event.created * 1000).toISOString() : new Date().toISOString(),
        processed_at: new Date().toISOString(),
        request_id: requestId,
        metadata: (event.data.object as any).metadata || {},
        status: 'processing'
      })
      .single();
  } catch (logError) {
    console.error('❌ Failed to log webhook event:', { requestId, logError });
  }

  // CRITICAL: Always return 200 for valid webhooks to prevent retries
  // Even if processing fails, we acknowledge receipt to Stripe
  try {
    // Process the event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('🔍 Checkout session completed:', event.data.object);
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        console.log('🔍 Subscription created:', event.data.object);
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        console.log('🔍 Subscription updated:', event.data.object);
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        console.log('🔍 Subscription deleted:', event.data.object);
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'subscription_schedule.created':
        console.log('🔍 Subscription schedule created:', event.data.object);
        await handleSubscriptionScheduleCreated(event.data.object);
        break;

      case 'subscription_schedule.released':
        console.log('🔍 Subscription schedule released:', event.data.object);
        await handleSubscriptionScheduleReleased(event.data.object);
        break;

      case 'subscription_schedule.canceled':
        console.log('🔍 Subscription schedule canceled:', event.data.object);
        await handleSubscriptionScheduleCanceled(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        console.log('🔍 Invoice payment succeeded:', event.data.object);
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        console.log('🔍 Invoice payment failed:', event.data.object);
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'invoice.refunded' as any:
        console.log('🔍 Invoice refunded:', event.data.object);
        await handleInvoiceRefunded(event.data.object);
        break;

      case 'checkout.session.expired' as any:
        console.log('🔍 Checkout session expired:', event.data.object);
        await handleCheckoutSessionExpired(event.data.object);
        break;

      case 'checkout.session.canceled' as any:
        console.log('🔍 Checkout session canceled:', event.data.object);
        await handleCheckoutSessionCanceled(event.data.object);
        break;

      default:
        console.log(`🔔 Unhandled subscription event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`❌ Error processing subscription webhook ${event.type}:`, { requestId, message: (error as any)?.message || String(error) });
    try {
      console.error('📝 Event data:', JSON.stringify(event.data.object, null, 2));
    } catch {}
    
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
      console.error('❌ Failed to log webhook error:', { requestId, logError });
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
      
      // 🚨 CRITICAL FIX: Do NOT create subscription here - let handleSubscriptionCreated handle it
      // This prevents duplicate processing and race conditions
      console.log(`🛡️ Checkout session completed for subscription ${session.subscription}`);
      console.log(`💡 Subscription creation will be handled by customer.subscription.created webhook`);
      console.log(`🔒 This prevents duplicate processing and ensures proper order`);
      
      // 🆕 AUTO-SET DEFAULT PAYMENT METHOD FOR NEW SUBSCRIPTIONS
      // Set the payment method used in checkout as default for the customer
      console.log('🔍 Session details for payment method setting:', {
        customer: session.customer,
        payment_intent: session.payment_intent,
        subscription: session.subscription,
        mode: session.mode
      });

      if (session.customer) {
        console.log('✅ Customer found, proceeding to set default payment method');
        try {
          let paymentMethodId: string | null = null;

          // Try to get payment method from payment intent first (for one-time payments)
          if (session.payment_intent) {
            console.log('📋 Payment Intent found, trying to extract payment method...');
            const paymentIntent = await stripe().paymentIntents.retrieve(session.payment_intent);
            console.log('📋 Payment Intent details:', {
              id: paymentIntent.id,
              payment_method: paymentIntent.payment_method,
              payment_method_type: typeof paymentIntent.payment_method,
              status: paymentIntent.status
            });
            
            const paymentMethod = paymentIntent.payment_method;
            paymentMethodId = typeof paymentMethod === 'string' 
              ? paymentMethod 
              : (paymentMethod && typeof paymentMethod === 'object' && 'id' in paymentMethod) 
                ? paymentMethod.id 
                : null;
          }
          
          // If no payment method from payment intent, try to get it from the subscription (for subscription mode)
          if (!paymentMethodId && session.subscription) {
            console.log('📋 No payment intent, trying to get payment method from subscription...');
            const subscription = await stripe().subscriptions.retrieve(session.subscription);
            console.log('📋 Session Subscription details:', {
              id: subscription.id,
              default_payment_method: subscription.default_payment_method,
              status: subscription.status
            });
            
            paymentMethodId = subscription.default_payment_method ? String(subscription.default_payment_method) : null;
          }
          
          console.log(`🔑 Session Extracted Payment Method ID: ${paymentMethodId}`);
          
          if (paymentMethodId) {
            console.log(`🚀 Calling ensureDefaultPaymentMethod for session with customer: ${session.customer}, paymentMethod: ${paymentMethodId}`);
            const result = await ensureDefaultPaymentMethod(session.customer, paymentMethodId);
            console.log(`✅ Session ensureDefaultPaymentMethod result: ${result}`);
          } else {
            console.log('❌ No payment method ID found in session payment intent or subscription');
          }
        } catch (error: any) {
          console.error('❌ Error setting default payment method for session:', error);
          console.error('📝 Session Error details:', {
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace',
            customer: session.customer,
            payment_intent: session.payment_intent,
            subscription: session.subscription
          });
          // Don't fail the webhook - this is a nice-to-have feature
        }
      } else {
        console.log('❌ No customer found in session for payment method setting');
      }
      
    } catch (error) {
      console.error('❌ Error retrieving subscription from checkout session:', error);
    }
  } else {
    console.log('⚠️ Checkout session completed but no subscription found');
  }
}

async function handleCheckoutSessionExpired(session: any) {
  console.log('⚠️ Checkout session expired:', session.id);
  console.log('📋 Session metadata:', session.metadata);
  
  const { user_id, product_id } = session.metadata || {};
  
  if (!user_id || !product_id) {
    console.error('❌ Missing metadata in expired checkout session:', { user_id, product_id });
    return;
  }

    // 🚨 CRITICAL FIX: DO NOTHING to subscriptions table on checkout expiration
  // This prevents the bug where failed payments result in subscription status changes
  console.log(`🛡️ CRITICAL: NOT updating subscription status in database - preserving current state`);
  console.log(`💡 User's current subscription remains unchanged - no database modifications`);
  
  // 🚨 CRITICAL: DO NOT update user's profile - preserve their current working plan
  console.log(`🛡️ CRITICAL: NOT updating user profile - preserving current working subscription`);
  console.log(`💡 User will retain their current plan until they have a successful payment`);
  
  console.log(`🛑 Checkout session expired for user ${user_id}. Preserving current plan; NOT setting to free automatically.`);
  console.log(`💡 This prevents accidental downgrades when payments fail or are interrupted.`);
}

async function handleCheckoutSessionCanceled(session: any) {
  console.log('⚠️ Checkout session canceled:', session.id);
  console.log('📋 Session metadata:', session.metadata);
  
  const { user_id, product_id } = session.metadata || {};
  
  if (!user_id || !product_id) {
    console.error('❌ Missing metadata in canceled checkout session:', { user_id, product_id });
    return;
  }

  // 🚨 CRITICAL FIX: DO NOTHING to subscriptions table on checkout cancellation
  // This prevents the bug where failed payments result in subscription status changes
  console.log(`🛡️ CRITICAL: NOT updating subscription status in database - preserving current state`);
  console.log(`💡 User's current subscription remains unchanged - no database modifications`);
  
  // 🚨 CRITICAL: DO NOT update user's profile - preserve their current working plan
  console.log(`🛡️ CRITICAL: NOT updating user profile - preserving current working subscription`);
  console.log(`💡 User will retain their current plan until they have a successful payment`);
  
  console.log(`🛑 Checkout session canceled for user ${user_id}. Preserving current plan; NOT setting to free automatically.`);
      console.log(`💡 This prevents accidental downgrades when payments fail or are interrupted.`);
      
      // 🆕 CRITICAL SAFETY CHECK: Only update profile if user has a truly active subscription
      const supabase = createServiceRoleClient();
      const { data: activeSubs, error: activeError } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', user_id)
        .in('status', ['active', 'trialing', 'past_due'])
        .not('status', 'in', ['incomplete', 'incomplete_expired', 'canceled', 'unpaid']);
      
      if (activeError) {
        console.error('❌ Error checking for active subscriptions:', activeError);
        return;
      }
      
      if (activeSubs && activeSubs.length > 0) {
        console.log(`✅ User ${user_id} has ${activeSubs.length} active subscriptions, updating profile safely`);
        await updateAdvertiserProfileWithCurrentSubscription(user_id);
      } else {
        console.log(`⚠️ User ${user_id} has NO active subscriptions after checkout cancellation`);
        console.log(`🛡️ NOT updating profile to prevent accidental free plan assignment`);
        console.log(`💡 User will retain their last known plan until they have a working subscription`);
      }
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('🆕 Subscription created:', subscription.id);
  console.log(`📋 Subscription metadata:`, subscription.metadata);
  console.log(`📊 Subscription status: ${subscription.status}`);
  console.log(`💰 Subscription amount: ${subscription.items.data[0]?.price?.unit_amount} cents`);
  
  const { user_id, product_id, change_type, change_timing, old_subscription_id } = subscription.metadata || {};
  
  console.log(`🔍 Extracted metadata:`, {
    user_id,
    product_id,
    change_type,
    change_timing,
    old_subscription_id
  });
  
  if (!user_id || !product_id) {
    console.error('❌ Missing metadata in subscription:', { user_id, product_id });
    
    // Try to get user_id from customer metadata
    if (subscription.customer && typeof subscription.customer === 'string') {
      try {
        const customer = await stripe().customers.retrieve(subscription.customer);
        if (customer && !customer.deleted && customer.metadata?.user_id) {
          console.log('✅ Found user_id in customer metadata:', customer.metadata.user_id);
          
          // 🚨 CRITICAL FIX: Only create subscription in database if it's active
          // This prevents the bug where failed payments result in incomplete subscriptions being added
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            console.log(`✅ Subscription ${subscription.id} is active (status: ${subscription.status}), creating in database via customer metadata fallback`);
            await createSubscriptionInDatabase(subscription, customer.metadata.user_id, product_id || 'unknown');
          } else {
            console.log(`🛡️ CRITICAL: Subscription ${subscription.id} has status '${subscription.status}' - NOT creating in database via customer metadata fallback`);
            console.log(`💡 This prevents the bug where failed payments result in incomplete subscriptions being added`);
            console.log(`🔒 User's current plan is preserved until subscription becomes active`);
          }
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
  console.log(`🔄 Change type: ${change_type}, Change timing: ${change_timing}, Old subscription: ${old_subscription_id || 'none'}`);
  
  // 🚨 CRITICAL: Log the old subscription ID if present
  if (old_subscription_id) {
    console.log(`🆔 OLD SUBSCRIPTION ID FOUND: ${old_subscription_id}`);
    console.log(`💡 This subscription will be canceled ONLY after payment succeeds in handleInvoicePaymentSucceeded`);
    console.log(`🛡️ This prevents the bug where failed payments result in plan downgrades`);
    
    // 🆕 SAFETY CHECK: Verify the old subscription still exists and is active
    try {
      console.log(`🔍 Verifying old subscription ${old_subscription_id} still exists...`);
      const oldSubscription = await stripe().subscriptions.retrieve(old_subscription_id);
      console.log(`✅ Old subscription found:`, {
        id: oldSubscription.id,
        status: oldSubscription.status,
        current_period_end: (oldSubscription as any).current_period_end ? new Date((oldSubscription as any).current_period_end * 1000).toISOString() : 'unknown'
      });
      
      if (oldSubscription.status === 'active' || oldSubscription.status === 'trialing') {
        console.log(`✅ Old subscription ${old_subscription_id} is active and will be canceled after payment succeeds`);
        
        // 🆕 ADDITIONAL SAFETY: Check if this old subscription is already being processed
        console.log(`🔍 Checking if old subscription ${old_subscription_id} is already being processed...`);
        const supabase = createServiceRoleClient();
        const { data: existingSub, error: existingError } = await supabase
          .from('subscriptions')
          .select('id, status, updated')
          .eq('id', old_subscription_id)
          .single();
        
        if (existingError && existingError.code !== 'PGRST116') {
          console.error(`❌ Error checking existing subscription ${old_subscription_id}:`, existingError);
        } else if (existingSub) {
          console.log(`📊 Old subscription ${old_subscription_id} in database:`, {
            id: existingSub.id,
            status: existingSub.status,
            last_updated: existingSub.updated
          });
          
          // 🆕 CRITICAL SAFETY CHECK: If old subscription is already canceled, log warning
          if (existingSub.status === 'canceled') {
            console.warn(`⚠️ WARNING: Old subscription ${old_subscription_id} is already canceled in database!`);
            console.warn(`🚨 This suggests the old subscription was canceled prematurely - investigate this!`);
            console.warn(`📋 New subscription metadata:`, subscription.metadata);
            console.warn(`📊 Old subscription database status: ${existingSub.status}`);
          }
        } else {
          console.log(`ℹ️ Old subscription ${old_subscription_id} not found in database yet`);
        }
      } else {
        console.log(`⚠️ Old subscription ${old_subscription_id} is not active (status: ${oldSubscription.status}) - may have been already canceled`);
      }
    } catch (error) {
      console.error(`❌ Error verifying old subscription ${old_subscription_id}:`, error);
      console.log(`⚠️ Old subscription ${old_subscription_id} may not exist or be accessible`);
    }
  } else {
    console.log(`ℹ️ No old subscription ID - this is a new subscription, not an upgrade/downgrade`);
  }
  
  // 🆕 ADDITIONAL SAFETY: Log all existing subscriptions for this user before creating new one
  try {
    console.log(`🔍 Checking all existing subscriptions for user ${user_id} before creating new one...`);
    const supabase = createServiceRoleClient();
    const { data: allUserSubs, error: allSubsError } = await supabase
      .from('subscriptions')
      .select('id, status, price_id, created')
      .eq('user_id', user_id)
      .order('created', { ascending: false });
    
    if (allSubsError) {
      console.error('❌ Error checking all user subscriptions:', allSubsError);
    } else if (allUserSubs && allUserSubs.length > 0) {
      console.log(`📋 User ${user_id} has ${allUserSubs.length} total subscriptions:`, 
        allUserSubs.map(s => ({ id: s.id, status: s.status, price_id: s.price_id, created: s.created })));
      
      const activeSubs = allUserSubs.filter(s => ['active', 'trialing', 'past_due'].includes(s.status));
      if (activeSubs.length > 0) {
        console.log(`🛡️ User ${user_id} has ${activeSubs.length} active subscriptions that will be preserved:`, 
          activeSubs.map(s => ({ id: s.id, status: s.status, price_id: s.price_id })));
      }
    } else {
      console.log(`ℹ️ User ${user_id} has no existing subscriptions`);
    }
  } catch (error) {
    console.error('❌ Error in safety check for all user subscriptions:', error);
  }
  
  // 🚨 CRITICAL FIX: Only create subscription in database if it's active
  // This prevents the bug where failed payments result in incomplete subscriptions being added
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    console.log(`✅ Subscription ${subscription.id} is active (status: ${subscription.status}), creating in database`);
    await createSubscriptionInDatabase(subscription, user_id, product_id);
  } else {
    console.log(`🛡️ CRITICAL: Subscription ${subscription.id} has status '${subscription.status}' - NOT creating in database`);
    console.log(`💡 This prevents the bug where failed payments result in incomplete subscriptions being added`);
    console.log(`🔒 User's current plan is preserved until subscription becomes active`);
    console.log(`📋 Subscription metadata:`, subscription.metadata);
    
    // 🚨 CRITICAL: DO NOT add failed subscriptions to database
    // This prevents the bug where failed payments result in subscription status changes
    console.log(`🛡️ CRITICAL: NOT adding subscription to database - preserving current state`);
    console.log(`💡 User's current subscription remains unchanged - no database modifications`);
  }
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
          
          // 🚨 CRITICAL FIX: Only update subscription in database if it's active
          // This prevents the bug where failed payments result in subscription status changes
          if (subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due') {
            console.log(`✅ Subscription ${subscription.id} is active (status: ${subscription.status}), updating in database via customer metadata fallback`);
            const actualProductId = await getProductIdFromSubscription(subscription, product_id);
            await updateSubscriptionInDatabaseCorrect(subscription, customer.metadata.user_id, actualProductId);
          } else {
            console.log(`🛡️ CRITICAL: Subscription ${subscription.id} has status '${subscription.status}' - NOT updating in database via customer metadata fallback`);
            console.log(`💡 This prevents the bug where failed payments result in subscription status changes`);
          }
          return;
        }
      } catch (error) {
        console.error('❌ Error retrieving customer metadata:', error);
      }
    }
    
    console.error('❌ Cannot process subscription update without user_id');
    return;
  }

  // 🚨 CRITICAL FIX: Only update subscription in database if it's active
  // This prevents the bug where failed payments result in subscription status changes
  if (subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due') {
    console.log(`✅ Subscription ${subscription.id} is active (status: ${subscription.status}), updating in database`);
    
    // Get the product ID from the subscription items if not in metadata
    const actualProductId = await getProductIdFromSubscription(subscription, product_id);
    
    if (actualProductId) {
      await updateSubscriptionInDatabaseCorrect(subscription, user_id, actualProductId);
    } else {
      console.error('❌ Could not determine product ID for subscription update');
    }
  } else {
    console.log(`🛡️ CRITICAL: Subscription ${subscription.id} has status '${subscription.status}' - NOT updating in database`);
    console.log(`💡 This prevents the bug where failed payments result in subscription status changes`);
    console.log(`🔒 User's current plan is preserved until subscription becomes active`);
    
    // 🚨 CRITICAL: DO NOT update failed subscriptions in database
    // This prevents the bug where failed payments result in subscription status changes
    console.log(`🛡️ CRITICAL: NOT updating subscription in database - preserving current state`);
    console.log(`💡 User's current subscription remains unchanged - no database modifications`);
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
      
      // 🚨 CRITICAL FIX: Only create subscription in database if it's active
      // This prevents the bug where failed payments result in incomplete subscriptions being added
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        console.log(`✅ Scheduled subscription ${subscription.id} is active (status: ${subscription.status}), creating in database`);
        await createSubscriptionInDatabase(subscription, user_id, product_id);
      } else {
        console.log(`🛡️ CRITICAL: Scheduled subscription ${subscription.id} has status '${subscription.status}' - NOT creating in database`);
        console.log(`💡 This prevents the bug where failed payments result in incomplete subscriptions being added`);
        console.log(`🔒 User's current plan is preserved until subscription becomes active`);
      }
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
  console.log("Invoice", invoice);
  
  // Handle new Stripe invoice structure where subscription is nested
  let subscriptionId = invoice.subscription;
  if (!subscriptionId && invoice.parent?.subscription_details?.subscription) {
    subscriptionId = invoice.parent.subscription_details.subscription;
    console.log(`📋 Found subscription ID in parent.subscription_details: ${subscriptionId}`);
  }
  
  if (!subscriptionId) {
    console.log('⚠️ No subscription found in invoice - this may be a standalone invoice payment');
    return; // Not a subscription invoice
  }

  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  const { user_id, product_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('❌ Missing user_id in subscription for invoice');
    return;
  }

  // Update subscription with latest info (ensures data is fresh)
  if (product_id) {
    await updateSubscriptionInDatabaseCorrect(subscription, user_id, product_id);
  }

  console.log("Reached here - Invoice, subscription, user_id", invoice, subscription, user_id);

  // Log subscription payment to money_transactions table
  await logSubscriptionPaymentToTransactions(invoice, subscription, user_id);

  // 🆕 HANDLE OLD SUBSCRIPTION CANCELLATION AFTER SUCCESSFUL PAYMENT
  // This is the safe place to cancel old subscriptions - only after payment succeeds
  const { old_subscription_id } = subscription.metadata || {};
  if (old_subscription_id) {
    console.log(`🔄 Payment succeeded for new subscription ${subscription.id}, now safely canceling old subscription ${old_subscription_id}`);
    console.log(`🛡️ CRITICAL: Old subscription is only canceled AFTER payment succeeds - this prevents the bug where failed payments result in plan downgrades`);
    console.log(`📋 Old subscription ID from metadata: ${old_subscription_id}`);
    console.log(`✅ New subscription ID: ${subscription.id}`);
    console.log(`💰 Payment confirmed successful - safe to cancel old subscription`);
    
    // 🆕 ADDITIONAL SAFETY: Verify old subscription status before canceling
    try {
      console.log(`🔍 Verifying old subscription ${old_subscription_id} status before canceling...`);
      const oldSubscription = await stripe().subscriptions.retrieve(old_subscription_id);
      console.log(`📊 Old subscription status in Stripe: ${oldSubscription.status}`);
      
      if (oldSubscription.status === 'canceled') {
        console.log(`⚠️ Old subscription ${old_subscription_id} is already canceled in Stripe - no action needed`);
        return;
      }
      
      if (oldSubscription.status !== 'active' && oldSubscription.status !== 'trialing') {
        console.log(`⚠️ Old subscription ${old_subscription_id} is not active (status: ${oldSubscription.status}) - may have been already canceled`);
        return;
      }
      
      console.log(`✅ Old subscription ${old_subscription_id} is active and ready for cancellation`);
    } catch (error) {
      console.error(`❌ Error verifying old subscription ${old_subscription_id} before cancellation:`, error);
      console.log(`⚠️ Proceeding with cancellation attempt despite verification error`);
    }
    
    try {
      // Cancel the old subscription in Stripe
      console.log(`🔄 Canceling old subscription ${old_subscription_id} in Stripe...`);
      await stripe().subscriptions.update(old_subscription_id, { cancel_at_period_end: true });
      console.log(`✅ Successfully scheduled cancellation of old subscription ${old_subscription_id}`);
      
      // Also cancel it in our database
      console.log(`🔄 Canceling old subscription ${old_subscription_id} in database...`);
      const oldSubscription = await stripe().subscriptions.retrieve(old_subscription_id);
      if (oldSubscription) {
        await cancelSubscriptionInDatabase(oldSubscription, user_id);
        console.log(`✅ Successfully canceled old subscription ${old_subscription_id} in database`);
      } else {
        console.log(`⚠️ Old subscription ${old_subscription_id} not found in Stripe - may have been already canceled`);
      }
    } catch (error) {
      console.error(`❌ Error canceling old subscription ${old_subscription_id}:`, error);
      console.error(`📝 Error details:`, {
        message: (error as any)?.message || String(error),
        stack: (error as any)?.stack || 'No stack trace',
        old_subscription_id,
        new_subscription_id: subscription.id,
        user_id
      });
      // Don't fail the webhook - this is a cleanup operation
    }
  } else {
    console.log(`ℹ️ No old subscription to cancel - this is a new subscription, not an upgrade/downgrade`);
    console.log(`📋 Subscription metadata:`, subscription.metadata);
  }

  // 🆕 AUTO-SET DEFAULT PAYMENT METHOD FOR SUBSCRIPTIONS
  // Set the payment method used in this subscription payment as default for the customer
  console.log('🔍 Invoice details for payment method setting:', {
    customer: invoice.customer,
    payment_intent: invoice.payment_intent,
    subscription: invoice.subscription,
    status: invoice.status
  });

  if (invoice.customer) {
    console.log('✅ Invoice customer found, proceeding to set default payment method');
    try {
      let paymentMethodId: string | null = null;

      // Try to get payment method from payment intent first (for one-time payments)
      if (invoice.payment_intent) {
        console.log('📋 Invoice Payment Intent found, trying to extract payment method...');
        const paymentIntent = await stripe().paymentIntents.retrieve(invoice.payment_intent);
        console.log('📋 Invoice Payment Intent details:', {
          id: paymentIntent.id,
          payment_method: paymentIntent.payment_method,
          payment_method_type: typeof paymentIntent.payment_method,
          status: paymentIntent.status
        });
        
        const paymentMethod = paymentIntent.payment_method;
        paymentMethodId = typeof paymentMethod === 'string' 
          ? paymentMethod 
          : (paymentMethod && typeof paymentMethod === 'object' && 'id' in paymentMethod) 
            ? paymentMethod.id 
            : null;
      }
      
      // If no payment method from payment intent, try to get it from the subscription (for subscription mode)
      if (!paymentMethodId && invoice.subscription) {
        console.log('📋 No payment intent, trying to get payment method from subscription...');
        const subscription = await stripe().subscriptions.retrieve(invoice.subscription);
        console.log('📋 Invoice Subscription details:', {
          id: subscription.id,
          default_payment_method: subscription.default_payment_method,
          status: subscription.status
        });
        
        paymentMethodId = subscription.default_payment_method ? String(subscription.default_payment_method) : null;
      }
      
      console.log(`🔑 Invoice Extracted Payment Method ID: ${paymentMethodId}`);
      
      if (paymentMethodId) {
        console.log(`🚀 Calling ensureDefaultPaymentMethod for invoice with customer: ${invoice.customer}, paymentMethod: ${paymentMethodId}`);
        const result = await ensureDefaultPaymentMethod(invoice.customer, paymentMethodId);
        console.log(`✅ Invoice ensureDefaultPaymentMethod result: ${result}`);
      } else {
        console.log('❌ No payment method ID found in invoice payment intent or subscription');
      }
    } catch (error: any) {
      console.error('❌ Error setting default payment method for subscription:', error);
      console.error('📝 Invoice Error details:', {
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace',
        customer: invoice.customer,
        payment_intent: invoice.payment_intent,
        subscription: invoice.subscription
      });
      // Don't fail the webhook - this is a nice-to-have feature
    }
  } else {
    console.log('❌ No customer found in invoice for setting default payment method');
  }

  console.log(`✅ Payment processed for user ${user_id}, subscription updated`);
}

async function handleInvoicePaymentFailed(invoice: any) {
  console.log('❌ Invoice payment failed:', invoice.id);
  
  // Handle new Stripe invoice structure where subscription is nested
  let subscriptionId = invoice.subscription;
  if (!subscriptionId && invoice.parent?.subscription_details?.subscription) {
    subscriptionId = invoice.parent.subscription_details.subscription;
    console.log(`📋 Found subscription ID in parent.subscription_details: ${subscriptionId}`);
  }
  
  if (!subscriptionId) {
    console.log('⚠️ No subscription found in invoice - this may be a standalone invoice payment');
    return; // Not a subscription invoice
  }

  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  const { user_id, product_id, old_subscription_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('❌ Missing user_id in subscription for failed invoice');
    return;
  }

  console.log(`❌ Payment failed for user ${user_id}, subscription ${subscriptionId}`);
  console.log(`🛡️ CRITICAL: NOT updating user profile - preserving current working subscription`);
  console.log(`📋 Failed subscription metadata:`, subscription.metadata);

  // 🚨 CRITICAL FIX: DO NOTHING to subscriptions table on payment failure
  // This prevents the bug where failed payments result in subscription status changes
  console.log(`🛡️ CRITICAL: NOT updating subscription status in database - preserving current state`);
  console.log(`💡 User's current subscription remains unchanged - no database modifications`);
  
  // 🚨 CRITICAL: DO NOT update user's profile - preserve their current working plan
  console.log(`🛡️ CRITICAL: NOT updating user profile - preserving current working subscription`);
  console.log(`💡 User will retain their current plan until they have a successful payment`);

  // Log failed subscription payment to money_transactions table
  await logFailedSubscriptionPaymentToTransactions(invoice, subscription, user_id);

  console.log(`✅ Payment failure handled - user's current plan preserved`);
}

async function handleInvoiceRefunded(invoice: any) {
  console.log('💰 Invoice refunded:', invoice.id);
  
  // Handle new Stripe invoice structure where subscription is nested
  let subscriptionId = invoice.subscription;
  if (!subscriptionId && invoice.parent?.subscription_details?.subscription) {
    subscriptionId = invoice.parent.subscription_details.subscription;
    console.log(`📋 Found subscription ID in parent.subscription_details: ${subscriptionId}`);
  }
  
  if (!subscriptionId) {
    console.log('⚠️ No subscription found in invoice - this may be a standalone invoice payment');
    return; // Not a subscription invoice
  }

  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  const { user_id, product_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('❌ Missing user_id in subscription for refunded invoice');
    return;
  }

  // Log refunded subscription payment to money_transactions table
  await logSubscriptionRefundToTransactions(invoice, subscription, user_id);

  console.log(`💰 Payment refunded for user ${user_id}, subscription status updated`);
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
    
    // 🚨 CRITICAL SAFETY CHECK: NEVER cancel existing subscriptions in this function
    console.log(`🛡️ CRITICAL SAFETY: createSubscriptionInDatabase will NEVER cancel existing subscriptions`);
    console.log(`💡 This function is ONLY for creating new subscriptions - old subscriptions are preserved`);
    console.log(`🔒 User's current plan is protected until payment succeeds for new subscription`);
    
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

    // 🚨 CRITICAL FIX: Do NOT cancel existing subscriptions here!
    // This was causing the bug where old subscriptions were canceled before payment succeeded
    // Old subscriptions are now only canceled in handleInvoicePaymentSucceeded AFTER successful payment
    console.log(`🛡️ NOT canceling existing subscriptions for user ${userId} - waiting for successful payment confirmation`);
    console.log(`💡 This prevents the bug where failed payments result in plan downgrades`);
    console.log(`🔒 User's current plan is preserved until new subscription payment succeeds`);
    console.log(`✅ This ensures no service interruption and prevents accidental downgrades`);
    
    // 🆕 SAFETY CHECK: Log existing active subscriptions for debugging
    try {
      const { data: existingActiveSubscriptions, error: activeError } = await supabase
        .from('subscriptions')
        .select('id, status, price_id')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'past_due']);
      
      if (activeError) {
        console.error('❌ Error checking existing active subscriptions:', activeError);
      } else if (existingActiveSubscriptions && existingActiveSubscriptions.length > 0) {
        console.log(`📋 User ${userId} has ${existingActiveSubscriptions.length} existing active subscriptions:`, 
          existingActiveSubscriptions.map(s => ({ id: s.id, status: s.status, price_id: s.price_id })));
        console.log(`🛡️ These will be preserved until payment succeeds for new subscription ${subscription.id}`);
      } else {
        console.log(`ℹ️ User ${userId} has no existing active subscriptions`);
      }
    } catch (error) {
      console.error('❌ Error in safety check for existing subscriptions:', error);
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

    // 🚨 CRITICAL FIX: Only update advertiser profile if subscription is active
    // This prevents the bug where failed payments result in plan downgrades
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      const stripePriceId = subscription.items.data[0].price.id;
      console.log(`🔄 Calling updateAdvertiserProfilePlan for user ${userId} with price ${stripePriceId}`);
      console.log(`✅ Subscription ${subscription.id} is active, updating profile safely`);
      await updateAdvertiserProfilePlan(userId, stripePriceId, subscription.id);
    } else {
      console.log(`🛡️ CRITICAL SAFETY: Subscription ${subscription.id} has status '${subscription.status}' - NOT updating profile`);
      console.log(`💡 This prevents the bug where failed payments result in plan downgrades`);
      console.log(`🔒 User's current plan is preserved until subscription becomes active`);
      
      // 🚨 CRITICAL FIX: Check if user has any truly active subscriptions before updating profile
      // This prevents the bug where failed payments result in plan downgrades
      try {
        const { data: activeSubs, error: activeError } = await supabase
          .from('subscriptions')
          .select('id, status')
          .eq('user_id', userId)
          .in('status', ['active', 'trialing', 'past_due'])
          .not('status', 'in', ['incomplete', 'incomplete_expired', 'canceled', 'unpaid']);
        
        if (activeError) {
          console.error('❌ Error checking for active subscriptions:', activeError);
          console.log(`🛡️ NOT updating profile due to error - preserving current plan`);
          return;
        }
        
        if (activeSubs && activeSubs.length > 0) {
          console.log(`✅ User ${userId} has ${activeSubs.length} active subscriptions, updating profile safely`);
          await updateAdvertiserProfileWithCurrentSubscription(userId);
        } else {
          console.log(`⚠️ User ${userId} has NO active subscriptions after failed payment`);
          console.log(`🛡️ NOT updating profile to prevent accidental free plan assignment`);
          console.log(`💡 User will retain their last known plan until they have a working subscription`);
        }
      } catch (error) {
        console.error('❌ Error in safety check for active subscriptions:', error);
        console.log(`🛡️ NOT updating profile due to error - preserving current plan`);
      }
    }

    console.log(`✅ Created new subscription: ${subscription.id} for user ${userId}`);
    
    // Double-check: Ensure advertiser profile was updated correctly
    try {
      const supabase = createServiceRoleClient();
      const { data: finalProfile, error: finalError } = await supabase
        .from('advertiser_profiles')
        .select('subscription_info')
        .eq('id', userId)
        .single();
        
      if (finalError) {
        console.error('❌ Error checking final advertiser profile state:', finalError);
      } else {
        console.log(`✅ Final advertiser profile subscription_info:`, finalProfile.subscription_info);
      }
    } catch (verifyError) {
      console.error('❌ Error verifying final profile state:', verifyError);
    }
    
    // No need to handle oldSubscriptionId from metadata anymore - we handle all active subscriptions above
    
  } catch (error) {
    console.error('❌ Error in createSubscriptionInDatabase:', error);
  }
}

// Helper function to update advertiser profile with correct subscription info (JSONB)
async function updateAdvertiserProfilePlan(userId: string, stripePriceId: string, subscriptionId?: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`📋 Getting active subscription info for user: ${userId}`);
    
    // Get current subscription info for comparison
    const { data: currentProfile, error: currentError } = await supabase
      .from('advertiser_profiles')
      .select('subscription_info')
      .eq('id', userId)
      .single();
    
    if (currentError) {
      console.error('❌ Error fetching current advertiser profile:', currentError);
    } else {
      console.log(`📊 Current subscription_info:`, currentProfile?.subscription_info);
    }
    
    // SIMPLIFIED APPROACH: Get subscription details directly from subscriptions table
    // This is much more reliable than looking up via prices table
    // 🚨 CRITICAL FIX: Exclude failed/incomplete subscriptions - only consider truly active ones
    const { data: activeSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
      .not('status', 'in', ['incomplete', 'incomplete_expired', 'canceled', 'unpaid'])
      .order('created', { ascending: false })
      .limit(1)
      .single();
    
    if (subError || !activeSubscription) {
      console.error(`❌ Could not find active subscription for user ${userId}:`, subError);
      return;
    }
    
    console.log(`✅ Found active subscription: ${activeSubscription.id} - Price: ${activeSubscription.price_id}`);
    
    // Get product info from prices table for display purposes
    const { data: priceData, error: priceError } = await supabase
      .from('prices')
      .select(`
        id,
        product_id,
        unit_amount,
        products!inner(id, name)
      `)
      .eq('id', activeSubscription.price_id)
      .single();
    
    let productId, productName, priceAmount;
    
    if (priceError || !priceData || !priceData.products) {
      console.warn(`⚠️ Could not find product details for price ID ${activeSubscription.price_id}, using subscription data`);
      // Fallback to subscription data
      productId = 'unknown';
      productName = 'Unknown Product';
      priceAmount = 0;
    } else {
      productId = priceData.product_id;
      productName = (priceData.products as any).name;
      priceAmount = priceData.unit_amount;
      console.log(`✅ Found product: ${productId} (${productName}) - Amount: ${priceAmount} cents`);
    }
    
    // Determine if this is a downgrade by comparing amounts
    const currentAmount = currentProfile?.subscription_info?.price_amount || 0;
    const isDowngrade = priceAmount < currentAmount;
    console.log(`💰 Price comparison: ${currentAmount} → ${priceAmount} (${isDowngrade ? 'DOWNGRADE' : 'UPGRADE/SAME'})`);
    
    // Update subscription_info JSONB field with correct structure using subscription table data
    const newSubscriptionInfo = {
      product_id: productId,
      price_id: activeSubscription.price_id,
      subscription_id: activeSubscription.id,
      price_amount: priceAmount,
      status: activeSubscription.status,
      current_period_start: activeSubscription.current_period_start,
      current_period_end: activeSubscription.current_period_end,
      cancel_at_period_end: activeSubscription.cancel_at_period_end,
      last_synced: new Date().toISOString()
    };
    
    console.log(`📝 New subscription_info from subscription table:`, newSubscriptionInfo);
    
    await updateAdvertiserProfileWithSubscriptionInfo(userId, newSubscriptionInfo);
    
  } catch (error) {
    console.error('❌ Error updating advertiser profile plan:', error);
  }
}

async function updateAdvertiserProfileWithSubscriptionInfo(userId: string, subscriptionInfo: any) {
  const supabase = createServiceRoleClient();
  
  console.log(`📝 Updating advertiser profile with subscription_info:`, subscriptionInfo);
  console.log(`👤 User ID: ${userId}`);
  
  // First check if the advertiser profile exists
  const { data: existingProfile, error: checkError } = await supabase
    .from('advertiser_profiles')
    .select('id, subscription_info')
    .eq('id', userId)
    .single();
    
  if (checkError) {
    console.error('❌ Error checking advertiser profile existence:', checkError);
    return;
  }
  
  if (!existingProfile) {
    console.error('❌ Advertiser profile not found for user:', userId);
    return;
  }
  
  console.log(`📊 Current profile subscription_info:`, existingProfile.subscription_info);
  
  // Force update with retry logic
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    const { error: profileError } = await supabase
      .from('advertiser_profiles')
      .update({ subscription_info: subscriptionInfo })
      .eq('id', userId);

    if (profileError) {
      retryCount++;
      console.error(`❌ Error updating advertiser profile subscription_info (attempt ${retryCount}):`, profileError);
      
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying in 1 second...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      console.log(`✅ Updated advertiser profile subscription_info successfully:`, subscriptionInfo);
      
      // Verify the update
      const { data: verifyData, error: verifyError } = await supabase
        .from('advertiser_profiles')
        .select('subscription_info')
        .eq('id', userId)
        .single();
        
      if (verifyError) {
        console.error('❌ Error verifying update:', verifyError);
      } else {
        console.log(`✅ Verified updated subscription_info:`, verifyData.subscription_info);
      }
      
      break;
    }
  }
  
  if (retryCount >= maxRetries) {
    console.error(`❌ Failed to update advertiser profile after ${maxRetries} attempts`);
  }
}

// Update advertiser profile with current active subscription data from database
async function updateAdvertiserProfileWithCurrentSubscription(userId: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`🔄 Getting current active subscription for user ${userId} to update profile`);
    
    // 🚨 CRITICAL FIX: Exclude failed/incomplete subscriptions - only consider truly active ones
    // This prevents the bug where failed payments result in plan downgrades
    const { data: activeSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
      .not('status', 'in', ['incomplete', 'incomplete_expired', 'canceled', 'unpaid'])
      .order('created', { ascending: false })
      .limit(1)
      .single();
    
    if (subError || !activeSubscription) {
      console.error(`❌ Could not find active subscription for user ${userId}:`, subError);
      return;
    }
    
    console.log(`✅ Found current active subscription: ${activeSubscription.id}`);
    
    // Get product info from prices table
    const { data: priceData, error: priceError } = await supabase
      .from('prices')
      .select(`
        id,
        product_id,
        unit_amount,
        products!inner(id, name)
      `)
      .eq('id', activeSubscription.price_id)
      .single();
    
    let productId, priceAmount;
    
    if (priceError || !priceData || !priceData.products) {
      console.warn(`⚠️ Could not find product details for price ID ${activeSubscription.price_id}, using fallback`);
      productId = 'unknown';
      priceAmount = 0;
    } else {
      productId = priceData.product_id;
      priceAmount = priceData.unit_amount;
    }
    
    // Update subscription_info with current active subscription data
    const currentSubscriptionInfo = {
      product_id: productId,
      price_id: activeSubscription.price_id,
      subscription_id: activeSubscription.id,
      price_amount: priceAmount,
      status: activeSubscription.status,
      current_period_start: activeSubscription.current_period_start,
      current_period_end: activeSubscription.current_period_end,
      cancel_at_period_end: activeSubscription.cancel_at_period_end,
      last_synced: new Date().toISOString()
    };
    
    console.log(`📝 Updating profile with current subscription info:`, currentSubscriptionInfo);
    
    await updateAdvertiserProfileWithSubscriptionInfo(userId, currentSubscriptionInfo);
    
  } catch (error) {
    console.error('❌ Error updating advertiser profile with current subscription:', error);
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

    // 🚨 CRITICAL FIX: Only update advertiser profile if subscription is active
    // This prevents the bug where failed payments result in plan downgrades
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      const stripePriceId = subscription.items.data[0].price.id;
      console.log(`🔄 Calling updateAdvertiserProfilePlan for user ${userId} with price ${stripePriceId}`);
      console.log(`✅ Subscription ${subscription.id} is active, updating profile safely`);
      await updateAdvertiserProfilePlan(userId, stripePriceId, subscription.id);
    } else {
      console.log(`🛡️ CRITICAL SAFETY: Subscription ${subscription.id} has status '${subscription.status}' - NOT updating profile`);
      console.log(`💡 This prevents the bug where failed payments result in plan downgrades`);
      console.log(`🔒 User's current plan is preserved until subscription becomes active`);
      
      // 🚨 CRITICAL FIX: Check if user has any truly active subscriptions before updating profile
      // This prevents the bug where failed payments result in plan downgrades
      try {
        const { data: activeSubs, error: activeError } = await supabase
          .from('subscriptions')
          .select('id, status')
          .eq('user_id', userId)
          .in('status', ['active', 'trialing', 'past_due'])
          .not('status', 'in', ['incomplete', 'incomplete_expired', 'canceled', 'unpaid']);
        
        if (activeError) {
          console.error('❌ Error checking for active subscriptions:', activeError);
          console.log(`🛡️ NOT updating profile due to error - preserving current plan`);
          return;
        }
        
        if (activeSubs && activeSubs.length > 0) {
          console.log(`✅ User ${userId} has ${activeSubs.length} active subscriptions, updating profile safely`);
          await updateAdvertiserProfileWithCurrentSubscription(userId);
        } else {
          console.log(`⚠️ User ${userId} has NO active subscriptions after failed payment`);
          console.log(`🛡️ NOT updating profile to prevent accidental free plan assignment`);
          console.log(`💡 User will retain their last known plan until they have a working subscription`);
        }
      } catch (error) {
        console.error('❌ Error in safety check for active subscriptions:', error);
        console.log(`🛡️ NOT updating profile due to error - preserving current plan`);
      }
    }

    console.log(`✅ Updated subscription for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('❌ Error in updateSubscriptionInDatabase:', error);
  }
}

// Cancel subscription using correct schema
async function cancelSubscriptionInDatabase(subscription: any, userId: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`Canceling subscription in database for user ${userId}: ${subscription.id}`);
    
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

    // Check if user has any other ACTIVE subscriptions before setting to free plan
    // 🚨 CRITICAL FIX: Exclude failed/incomplete subscriptions - only consider truly active ones
    const { data: otherActiveSubscriptions, error: activeError } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
      .not('status', 'in', ['incomplete', 'incomplete_expired', 'canceled', 'unpaid'])
      .neq('id', subscription.id); // Exclude the subscription we just canceled

    if (activeError) {
      console.error('❌ Error checking for other active subscriptions:', activeError);
      return;
    }

    if (otherActiveSubscriptions && otherActiveSubscriptions.length > 0) {
      console.log(`✅ User has ${otherActiveSubscriptions.length} other active subscriptions, NOT setting to free plan`);
      console.log(`🔄 Other active subscriptions:`, otherActiveSubscriptions.map(s => s.id));
      
      // Update profile with current active subscription data instead of leaving it unchanged
      console.log(`🔄 Updating profile with current active subscription data`);
      await updateAdvertiserProfileWithCurrentSubscription(userId);
    } else {
      // SAFETY: do NOT force-set to free automatically on deletion
      // Keep last known subscription_info to avoid accidental downgrades when payments fail
      console.log(`🛑 No other active subscriptions found. Preserving last known plan; not setting free automatically.`);
      console.log(`💡 This prevents accidental downgrades when payments fail or subscriptions are canceled.`);
    }

    console.log(`✅ Canceled subscription for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('❌ Error in cancelSubscriptionInDatabase:', error);
  }
}

// Log subscription payment to money_transactions table
async function logSubscriptionPaymentToTransactions(invoice: any, subscription: any, userId: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`💰 Logging subscription payment to money_transactions for user ${userId}`);
    
    // Get product details for better transaction description
    const priceId = subscription.items.data[0].price.id;
    const { data: priceData, error: priceError } = await supabase
      .from('prices')
      .select(`
        id,
        unit_amount,
        products!inner(id, name, description)
      `)
      .eq('id', priceId)
      .single();
    
    let productName = 'Unknown Subscription';
    let productDescription = 'Subscription payment';
    
    if (!priceError && priceData && priceData.products) {
      productName = (priceData.products as any).name;
      productDescription = (priceData.products as any).description || `Subscription payment for ${productName}`;
    }
    
    // Calculate amount in cents (Stripe stores amounts in cents)
    const amountInCents = invoice.amount_paid || 0;
    
    // Create comprehensive metadata for subscription payment
    const metadata = {
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscription.id,
      product_name: productName,
      subscription_status: subscription.status,
      billing_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
      billing_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
      invoice_number: invoice.number,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      subscription_plan: productName,
      webhook_source: 'subscription_webhook',
      stripe_price_id: priceId,
      subscription_metadata: subscription.metadata,
      invoice_metadata: invoice.metadata,
      collection_method: invoice.collection_method,
      billing_reason: invoice.billing_reason,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      total: invoice.total,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      status_transitions: invoice.status_transitions,
      created_at: new Date().toISOString()
    };
    
    // Determine if this is a new subscription, upgrade, or downgrade
    const subscriptionMetadata = subscription.metadata || {};
    const upgradeType = subscriptionMetadata.upgrade_type;
    const oldSubscriptionId = subscriptionMetadata.old_subscription_id;
    
    console.log(`🔍 Subscription metadata analysis:`, {
      subscription_id: subscription.id,
      upgrade_type: upgradeType,
      old_subscription_id: oldSubscriptionId,
      full_metadata: subscriptionMetadata
    });
    
    let description = '';
    if (oldSubscriptionId) {
      // This is an upgrade or downgrade - check the upgrade_type from metadata
      if (upgradeType === 'upgrade') {
        description = `Upgrade to ${productName} Plan`;
      } else if (upgradeType === 'downgrade') {
        description = `Downgrade to ${productName} Plan`;
      } else if (upgradeType === 'immediate') {
        // Fallback for legacy immediate upgrades - assume upgrade
        description = `Upgrade to ${productName} Plan`;
      } else {
        // Default to upgrade if we can't determine
        description = `Plan changed to ${productName} Plan`;
      }
    } else {
      // This is a new subscription
      description = `Subscribed to ${productName} Plan`;
    }
    
    console.log(`📝 Final description: "${description}" for subscription ${subscription.id}`);
    
    // Format the plan start date properly
    const planStartDate = subscription.current_period_start 
      ? new Date(subscription.current_period_start * 1000).toLocaleDateString() 
      : (() => {
          // Fallback: try to get from created timestamp or use current date
          console.log(`⚠️ No current_period_start found for subscription ${subscription.id}, using fallback`);
          if (subscription.created) {
            return new Date(subscription.created * 1000).toLocaleDateString();
          }
          return new Date().toLocaleDateString();
        })();
    
    // Create transaction record using the new subscription_payment type
    const transactionData = {
      user_id: userId,
      type: 'subscription_payment', // Use dedicated subscription_payment type
      amount: amountInCents, // Store in cents as per your system
      currency: invoice.currency?.toUpperCase() || 'USD',
      status: 'success', // Use 'success' for subscription payments
      payment_intent_id: invoice.payment_intent,
      description: description, // Dynamic description based on subscription type
      remarks: `Subscription payment for ${productName} plan. Plan starts from ${planStartDate}. Price ID: ${priceId}`, // Include start date and price ID
      payment_method: 'stripe', // Indicate this was paid via Stripe
      metadata: metadata, // Store comprehensive metadata
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`📝 Inserting subscription payment transaction:`, {
      user_id: userId,
      amount: amountInCents,
      product_name: productName,
      subscription_id: subscription.id,
      type: 'subscription_payment'
    });
    
    const { data: transaction, error: insertError } = await supabase
      .from('money_transactions')
      .insert(transactionData)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error logging subscription payment to money_transactions:', insertError);
      return;
    }
    
    console.log(`✅ Successfully logged subscription payment transaction: ${transaction.id}`);
    console.log(`💰 Amount: ${amountInCents} cents (${(amountInCents / 100).toFixed(2)} USD)`);
    console.log(`📦 Product: ${productName}`);
    console.log(`🔗 Invoice: ${invoice.id}, Subscription: ${subscription.id}`);
    
  } catch (error) {
    console.error('❌ Error in logSubscriptionPaymentToTransactions:', error);
  }
} 

// Log failed subscription payment to money_transactions table
async function logFailedSubscriptionPaymentToTransactions(invoice: any, subscription: any, userId: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`💰 Logging failed subscription payment to money_transactions for user ${userId}`);
    
    // Get product details for better transaction description
    const priceId = subscription.items.data[0].price.id;
    const { data: priceData, error: priceError } = await supabase
      .from('prices')
      .select(`
        id,
        unit_amount,
        products!inner(id, name, description)
      `)
      .eq('id', priceId)
      .single();
    
    let productName = 'Unknown Subscription';
    let productDescription = 'Subscription payment';
    
    if (!priceError && priceData && priceData.products) {
      productName = (priceData.products as any).name;
      productDescription = (priceData.products as any).description || `Subscription payment for ${productName}`;
    }
    
    // Calculate amount in cents (Stripe stores amounts in cents)
    const amountInCents = invoice.amount_paid || 0;
    
    // Format the plan start date properly
    const planStartDate = subscription.current_period_start 
      ? new Date(subscription.current_period_start * 1000).toLocaleDateString() 
      : (() => {
          // Fallback: try to get from created timestamp or use current date
          console.log(`⚠️ No current_period_start found for failed payment subscription ${subscription.id}, using fallback`);
          if (subscription.created) {
            return new Date(subscription.created * 1000).toLocaleDateString();
          }
          return new Date().toLocaleDateString();
        })();
    
    // Create comprehensive metadata for failed subscription payment
    const metadata = {
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscription.id,
      product_name: productName,
      subscription_status: subscription.status,
      billing_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
      billing_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
      invoice_number: invoice.number,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      subscription_plan: productName,
      webhook_source: 'subscription_webhook',
      stripe_price_id: priceId,
      subscription_metadata: subscription.metadata,
      invoice_metadata: invoice.metadata,
      collection_method: invoice.collection_method,
      billing_reason: invoice.billing_reason,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      total: invoice.total,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      status_transitions: invoice.status_transitions,
      failure_reason: 'Payment failed',
      created_at: new Date().toISOString()
    };
    
    // Create transaction record using the new subscription_payment type
    const transactionData = {
      user_id: userId,
      type: 'subscription_payment', // Use dedicated subscription_payment type
      amount: amountInCents, // Store in cents as per your system
      currency: invoice.currency?.toUpperCase() || 'USD',
      status: 'failed',
      payment_intent_id: invoice.payment_intent,
      description: `Payment Failed for ${productName} Plan`, // Updated description
      remarks: `Payment failed for ${productName} plan. Plan starts from ${planStartDate}. Price ID: ${priceId}`, // Include start date and price ID
      payment_method: 'stripe', // Indicate this was attempted via Stripe
      metadata: metadata, // Store comprehensive metadata
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`📝 Inserting failed subscription payment transaction:`, {
      user_id: userId,
      amount: amountInCents,
      product_name: productName,
      subscription_id: subscription.id,
      type: 'subscription_payment'
    });
    
    const { data: transaction, error: insertError } = await supabase
      .from('money_transactions')
      .insert(transactionData)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error logging failed subscription payment to money_transactions:', insertError);
      return;
    }
    
    console.log(`✅ Successfully logged failed subscription payment transaction: ${transaction.id}`);
    console.log(`💰 Amount: ${amountInCents} cents (${(amountInCents / 100).toFixed(2)} USD)`);
    console.log(`📦 Product: ${productName}`);
    console.log(`🔗 Invoice: ${invoice.id}, Subscription: ${subscription.id}`);
    
  } catch (error) {
    console.error('❌ Error in logFailedSubscriptionPaymentToTransactions:', error);
  }
} 

// Log subscription refund to money_transactions table
async function logSubscriptionRefundToTransactions(invoice: any, subscription: any, userId: string) {
  const supabase = createServiceRoleClient();
  
  try {
    console.log(`💰 Logging subscription refund to money_transactions for user ${userId}`);
    
    // Get product details for better transaction description
    const priceId = subscription.items.data[0].price.id;
    const { data: priceData, error: priceError } = await supabase
      .from('prices')
      .select(`
        id,
        unit_amount,
        products!inner(id, name, description)
      `)
      .eq('id', priceId)
      .single();
    
    let productName = 'Unknown Subscription';
    let productDescription = 'Subscription refund';
    
    if (!priceError && priceData && priceData.products) {
      productName = (priceData.products as any).name;
      productDescription = `Subscription refund for ${productName}`;
    }
    
    // Calculate refund amount in cents (negative amount for refunds)
    const refundAmountInCents = -(invoice.amount_refunded || 0);
    
    // Format the plan start date properly
    const planStartDate = subscription.current_period_start 
      ? new Date(subscription.current_period_start * 1000).toLocaleDateString() 
      : (() => {
          // Fallback: try to get from created timestamp or use current date
          console.log(`⚠️ No current_period_start found for refund subscription ${subscription.id}, using fallback`);
          if (subscription.created) {
            return new Date(subscription.created * 1000).toLocaleDateString();
          }
          return new Date().toISOString();
        })();
    
    // Create comprehensive metadata for subscription refund
    const metadata = {
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscription.id,
      product_name: productName,
      subscription_status: subscription.status,
      billing_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
      billing_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
      invoice_number: invoice.number,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      subscription_plan: productName,
      webhook_source: 'subscription_webhook',
      stripe_price_id: priceId,
      subscription_metadata: subscription.metadata,
      invoice_metadata: invoice.metadata,
      collection_method: invoice.collection_method,
      billing_reason: invoice.billing_reason,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      total: invoice.total,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      amount_refunded: invoice.amount_refunded,
      status_transitions: invoice.status_transitions,
      refund_reason: 'Subscription refund',
      created_at: new Date().toISOString()
    };
    
    // Create transaction record using the new subscription_refund type
    const transactionData = {
      user_id: userId,
      type: 'subscription_refund', // Use subscription_refund type for refunds
      amount: refundAmountInCents, // Store as negative amount for refunds
      currency: invoice.currency?.toUpperCase() || 'USD',
      status: 'success', // Use 'success' for successful refunds
      payment_intent_id: invoice.payment_intent,
      description: `${productName} Plan Refund`, // Keep refund description simple
      remarks: `Refund for ${productName} plan. Plan started from ${planStartDate}. Price ID: ${priceId}`, // Include start date and price ID
      payment_method: 'refund', // Indicate this is a refund
      metadata: metadata, // Store comprehensive metadata
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`📝 Inserting subscription refund transaction:`, {
      user_id: userId,
      amount: refundAmountInCents,
      product_name: productName,
      subscription_id: subscription.id,
      type: 'subscription_refund'
    });
    
    const { data: transaction, error: insertError } = await supabase
      .from('money_transactions')
      .insert(transactionData)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error logging subscription refund to money_transactions:', insertError);
      return;
    }
    
    console.log(`✅ Successfully logged subscription refund transaction: ${transaction.id}`);
    console.log(`💰 Refund Amount: ${refundAmountInCents} cents (${(refundAmountInCents / 100).toFixed(2)} USD)`);
    console.log(`📦 Product: ${productName}`);
    console.log(`🔗 Invoice: ${invoice.id}, Subscription: ${subscription.id}`);
    
  } catch (error) {
    console.error('❌ Error in logSubscriptionRefundToTransactions:', error);
  }
}