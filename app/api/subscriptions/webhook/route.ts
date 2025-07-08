import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  if (!sig) {
    console.error('No Stripe signature found');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event;

  try {
    event = stripe().webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed:`, err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`📥 Webhook received: ${event.type}`);

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

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`🔔 Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session: any) {
  console.log('✅ Checkout session completed:', session.id);
  
  const { user_id, product_id } = session.metadata || {};
  
  if (!user_id || !product_id) {
    console.error('Missing metadata in checkout session:', { user_id, product_id });
    return;
  }

  // Get the subscription from the session
  if (session.subscription) {
    const subscription = await stripe().subscriptions.retrieve(session.subscription);
    await createSubscriptionInDatabase(subscription, user_id, product_id);
  }
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('🆕 Subscription created:', subscription.id);
  
  const { user_id, product_id } = subscription.metadata || {};
  
  if (!user_id || !product_id) {
    console.error('Missing metadata in subscription:', { user_id, product_id });
    return;
  }

  await createSubscriptionInDatabase(subscription, user_id, product_id);
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log('🔄 Subscription updated:', subscription.id);
  
  const { user_id, product_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('Missing user_id in subscription metadata');
    return;
  }

  // Get the product ID from the subscription items if not in metadata
  let actualProductId = product_id;
  if (!actualProductId && subscription.items?.data?.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    // Get product ID from price using Stripe API
    const price = await stripe().prices.retrieve(priceId);
    actualProductId = price.product as string;
  }

  if (actualProductId) {
    await updateSubscriptionInDatabase(subscription, user_id, actualProductId);
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  console.log('❌ Subscription deleted:', subscription.id);
  
  const { user_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('Missing user_id in subscription metadata');
    return;
  }

  await cancelSubscriptionInDatabase(subscription, user_id);
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  console.log('💰 Invoice payment succeeded:', invoice.id);
  
  if (!invoice.subscription) {
    return; // Not a subscription invoice
  }

  const subscription = await stripe().subscriptions.retrieve(invoice.subscription);
  const { user_id, product_id } = subscription.metadata || {};
  
  if (!user_id) {
    console.error('Missing user_id in subscription for invoice');
    return;
  }

  // Update subscription with latest info (ensures data is fresh)
  if (product_id) {
    await updateSubscriptionInDatabase(subscription, user_id, product_id);
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
    console.error('Missing user_id in subscription for failed invoice');
    return;
  }

  // Update subscription status (Stripe will mark it as past_due, etc.)
  if (product_id) {
    await updateSubscriptionInDatabase(subscription, user_id, product_id);
  }

  console.log(`💸 Payment failed for user ${user_id}, subscription status updated`);
}

// Create new subscription using database function
async function createSubscriptionInDatabase(subscription: any, userId: string, productId: string) {
  const supabase = await createClient();
  
  try {
    console.log(`Creating subscription in database for user ${userId}`);
    
    // Use the database function to create subscription
    const { error: subscriptionError } = await supabase.rpc('create_subscription', {
      stripe_subscription_id: subscription.id,
      user_uuid: userId,
      subscription_status: subscription.status,
      stripe_price_id: subscription.items.data[0].price.id,
      period_start: subscription.current_period_start 
        ? new Date(subscription.current_period_start * 1000).toISOString() 
        : new Date().toISOString(),
      period_end: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString() 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default 30 days from now
      cancel_at_period_end_param: subscription.cancel_at_period_end || false,
      trial_start_param: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      trial_end_param: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      cancel_at_param: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      subscription_quantity: subscription.items.data[0].quantity || 1,
      stripe_metadata_param: subscription.metadata || {},
      internal_notes_param: `Created via webhook on ${new Date().toISOString()}`
    });

    if (subscriptionError) {
      console.error('Error creating subscription:', subscriptionError);
      return;
    }

    console.log(`✅ Created subscription for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('Error in createSubscriptionInDatabase:', error);
  }
}

// Update subscription using database function
async function updateSubscriptionInDatabase(subscription: any, userId: string, productId: string) {
  const supabase = await createClient();
  
  try {
    console.log(`Updating subscription in database for user ${userId}`);
    
    // Use the database function to update subscription
    const { error: subscriptionError } = await supabase.rpc('update_subscription', {
      stripe_subscription_id: subscription.id,
      new_status: subscription.status,
      new_price_id: subscription.items.data[0].price.id,
      new_period_start: subscription.current_period_start 
        ? new Date(subscription.current_period_start * 1000).toISOString() 
        : new Date().toISOString(),
      new_period_end: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000).toISOString() 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      new_quantity: subscription.items.data[0].quantity || 1,
      cancel_at_period_end_param: subscription.cancel_at_period_end || false,
      trial_start_param: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      trial_end_param: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      canceled_at_param: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      cancel_at_param: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      ended_at_param: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null,
      stripe_metadata_param: subscription.metadata || {},
      internal_notes_param: `Updated via webhook on ${new Date().toISOString()}`
    });

    if (subscriptionError) {
      console.error('Error updating subscription:', subscriptionError);
      return;
    }

    console.log(`✅ Updated subscription for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('Error in updateSubscriptionInDatabase:', error);
  }
}

// Cancel subscription using database function
async function cancelSubscriptionInDatabase(subscription: any, userId: string) {
  const supabase = await createClient();
  
  try {
    console.log(`Canceling subscription in database for user ${userId}`);
    
    // Use the database function to cancel subscription
    // (This function already handles setting user back to EXPLORER plan)
    const { error: subscriptionError } = await supabase.rpc('cancel_subscription', {
      stripe_subscription_id: subscription.id,
      canceled_at_param: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString(),
      ended_at_param: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null,
      cancel_at_param: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      cancellation_reason: 'customer_request'
    });

    if (subscriptionError) {
      console.error('Error canceling subscription:', subscriptionError);
      return;
    }

    // Note: Database function already handles setting user back to EXPLORER plan
    // No need to manually update advertiser_profiles here

    console.log(`✅ Canceled subscription for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('Error in cancelSubscriptionInDatabase:', error);
  }
} 