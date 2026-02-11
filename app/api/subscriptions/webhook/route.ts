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
        // Handle invoice.refunded and other events generically
        if ((event as any).type === 'invoice.refunded') {
          await handleInvoiceRefunded((event as any).data.object);
        } else {
          console.log(`🔔 Unhandled subscription event type: ${event.type}`);
        }
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
            console.log('📋 Subscription details:', {
              id: subscription.id,
              default_payment_method: subscription.default_payment_method,
              status: subscription.status
            });

            paymentMethodId = subscription.default_payment_method ? String(subscription.default_payment_method) : null;
          }

          console.log(`🔑 Extracted Payment Method ID: ${paymentMethodId}`);

          if (paymentMethodId) {
            console.log(`🚀 Calling ensureDefaultPaymentMethod with customer: ${session.customer}, paymentMethod: ${paymentMethodId}`);
            const result = await ensureDefaultPaymentMethod(session.customer, paymentMethodId);
            console.log(`✅ ensureDefaultPaymentMethod result: ${result}`);
          } else {
            console.log('❌ No payment method ID found in payment intent or subscription');
          }
        } catch (error: any) {
          console.error('❌ Error setting default payment method for new subscription:', error);
          console.error('📝 Error details:', {
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace',
            customer: session.customer,
            payment_intent: session.payment_intent,
            subscription: session.subscription
          });
          // Don't fail the webhook - this is a nice-to-have feature
        }
      } else {
        console.log('❌ No customer found for setting default payment method');
      }
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

  const { user_id, product_id, upgrade_type, old_subscription_id } = subscription.metadata || {};

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
  console.log(`🔄 Upgrade type: ${upgrade_type}, Old subscription: ${old_subscription_id}`);
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


async function resolveUserIdForSubscription(
  subscriptionId: string,
  subscriptionMetadata: Record<string, string> | null,
  customerId: string | null
): Promise<string | null> {
  const fromMeta = subscriptionMetadata?.user_id;
  if (fromMeta) return fromMeta;

  if (customerId) {
    try {
      const customer = await stripe().customers.retrieve(customerId);
      if (customer && !(customer as any).deleted && (customer as any).metadata?.user_id) {
        console.log(`✅ Resolved user_id from customer metadata: ${(customer as any).metadata.user_id}`);
        return (customer as any).metadata.user_id;
      }
    } catch (e) {
      console.warn('Could not resolve user_id from customer:', e);
    }
  }

  const supabase = createServiceRoleClient();
  const { data: subRow, error } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('id', subscriptionId)
    .limit(1)
    .maybeSingle();

  if (!error && subRow?.user_id) {
    console.log(`✅ Resolved user_id from subscriptions table: ${subRow.user_id}`);
    return subRow.user_id;
  }
  return null;
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
  const product_id = subscription.metadata?.product_id ?? null;
  let user_id: string | null = subscription.metadata?.user_id ?? null;
  if (!user_id) {
    user_id = await resolveUserIdForSubscription(
      subscriptionId,
      subscription.metadata || null,
      typeof invoice.customer === 'string' ? invoice.customer : null
    );
  }
  if (!user_id) {
    console.error('❌ Could not resolve user_id for subscription (invoice.payment_succeeded). Transaction will not be logged.');
    return;
  }

  // Update subscription with latest info (ensures data is fresh)
  if (product_id) {
    await updateSubscriptionInDatabaseCorrect(subscription, user_id, product_id);
  }

  console.log("Reached here - Invoice, subscription, user_id", invoice, subscription, user_id);

  // Log subscription payment to money_transactions table
  await logSubscriptionPaymentToTransactions(invoice, subscription, user_id);

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
  const product_id = subscription.metadata?.product_id ?? null;
  let user_id: string | null = subscription.metadata?.user_id ?? null;
  if (!user_id) {
    user_id = await resolveUserIdForSubscription(
      subscriptionId,
      subscription.metadata || null,
      typeof invoice.customer === 'string' ? invoice.customer : null
    );
  }
  if (!user_id) {
    console.error('❌ Could not resolve user_id for subscription (invoice.payment_failed).');
    return;
  }

  // Update subscription status (Stripe will mark it as past_due, etc.)
  if (product_id) {
    await updateSubscriptionInDatabaseCorrect(subscription, user_id, product_id);
  }

  // Log failed subscription payment to money_transactions table
  await logFailedSubscriptionPaymentToTransactions(invoice, subscription, user_id);

  console.log(`💸 Payment failed for user ${user_id}, subscription status updated`);
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
      .select('id, status, price_id')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due']);

    if (activeError) {
      console.error('❌ Error fetching active subscriptions:', activeError);
    } else if (activeSubscriptions && activeSubscriptions.length > 0) {
      console.log(`🔄 Found ${activeSubscriptions.length} active subscriptions for user ${userId}, canceling them...`);

      // Detect if this is a downgrade by comparing prices
      const newPriceId = subscription.items.data[0].price.id;
      const oldPriceId = activeSubscriptions[0]?.price_id;
      console.log(`💰 Price change: ${oldPriceId} → ${newPriceId}`);

      for (const activeSub of activeSubscriptions) {
        if (activeSub.id !== subscription.id) {
          console.log(`🔄 Canceling old subscription: ${activeSub.id}`);

          // Cancel in Stripe first - be more aggressive for downgrades
          try {
            await stripe().subscriptions.cancel(activeSub.id, {
              invoice_now: false,
              prorate: false
            });
            console.log(`✅ Successfully cancelled old Stripe subscription: ${activeSub.id}`);
          } catch (stripeError) {
            console.error(`❌ Error canceling old subscription ${activeSub.id} in Stripe:`, stripeError);

            // For downgrades, try to force cancel even if it fails
            try {
              await stripe().subscriptions.update(activeSub.id, {
                cancel_at_period_end: true
              });
              console.log(`⚠️ Set subscription ${activeSub.id} to cancel at period end as fallback`);
            } catch (fallbackError) {
              console.error(`❌ Fallback cancellation also failed for ${activeSub.id}:`, fallbackError);
            }
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

    // Update advertiser profile - CRITICAL for all subscription changes
    const stripePriceId = subscription.items.data[0].price.id;
    console.log(`🔄 Calling updateAdvertiserProfilePlan for user ${userId} with price ${stripePriceId}`);
    await updateAdvertiserProfilePlan(userId, stripePriceId, subscription.id);

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
    const { data: activeSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
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

    // Determine actual price amount based on subscription status
    // During trial, price_amount should be 0, otherwise use the plan price
    const actualPriceAmount = (activeSubscription.status === 'trialing') ? 0 : priceAmount;
    console.log(`💰 Price calculation: Plan amount=${priceAmount}, Status=${activeSubscription.status}, Actual amount=${actualPriceAmount}`);

    // Determine if this is a downgrade by comparing amounts
    const currentAmount = currentProfile?.subscription_info?.price_amount || 0;
    const isDowngrade = actualPriceAmount < currentAmount;
    console.log(`💰 Price comparison: ${currentAmount} → ${actualPriceAmount} (${isDowngrade ? 'DOWNGRADE' : 'UPGRADE/SAME'})`);

    // Update subscription_info JSONB field with correct structure using subscription table data
    const newSubscriptionInfo = {
      product_id: productId,
      price_id: activeSubscription.price_id,
      subscription_id: activeSubscription.id,
      price_amount: actualPriceAmount,
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

    // Get current active subscription from database
    const { data: activeSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
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

    // Determine actual price amount based on subscription status
    // During trial, price_amount should be 0, otherwise use the plan price
    const actualPriceAmount = (activeSubscription.status === 'trialing') ? 0 : priceAmount;
    console.log(`💰 Current subscription price calculation: Plan amount=${priceAmount}, Status=${activeSubscription.status}, Actual amount=${actualPriceAmount}`);

    // Update subscription_info with current active subscription data
    const currentSubscriptionInfo = {
      product_id: productId,
      price_id: activeSubscription.price_id,
      subscription_id: activeSubscription.id,
      price_amount: actualPriceAmount,
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
    const { data: otherActiveSubscriptions, error: activeError } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
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
      console.log(`🆓 No other active subscriptions found, setting user to free plan`);

      // Only set to free plan if no other active subscriptions exist
      const freeSubscriptionInfo = {
        product_id: PRODUCT_IDS.EXPLORER, // EXPLORER (free plan)
        price_id: PRICE_IDS.EXPLORER_MONTHLY, // Free price
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

      console.log(`✅ Updated advertiser profile to free plan`);
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

   
    const { data: existing } = await supabase
      .from('money_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'subscription_payment')
      .eq('status', 'success')
      .contains('metadata', { stripe_invoice_id: invoice.id })
      .limit(1)
      .maybeSingle();
    if (existing) {
      console.log(`⚠️ Subscription payment already logged for invoice ${invoice.id}, skipping duplicate`);
      return;
    }

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
      `).eq('id', priceId)
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
          return new Date().toLocaleDateString();
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