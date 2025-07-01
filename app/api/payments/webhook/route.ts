import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { updateTransactionStatus } from '@/lib/payment-utils';

export async function POST(request: NextRequest) {
  console.log('🔔 WEBHOOK RECEIVED!');
  
  try {
    const body = await request.text();
    const signature = (await headers()).get('stripe-signature');

    console.log('📝 Webhook body length:', body.length);
    console.log('🔐 Webhook signature:', signature ? 'Present' : 'Missing');

    if (!signature) {
      console.error('❌ No Stripe signature found');
      return NextResponse.json(
        { error: 'No Stripe signature found' },
        { status: 400 }
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    console.log(`📦 Event type: ${event.type}`);
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('✅ Processing payment success...');
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        console.log('❌ Processing payment failure...');
        await handlePaymentFailure(event.data.object);
        break;
      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error in webhook handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentIntent: any) {
  try {
    // Use service role client for webhook operations (bypasses RLS)
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { userId, type, amount } = paymentIntent.metadata;

    console.log('=== WEBHOOK DEBUG ===');
    console.log('Payment Intent ID:', paymentIntent.id);
    console.log('Metadata:', paymentIntent.metadata);
    console.log('userId:', userId, 'type:', type, 'amount:', amount);
    
    if (!userId || !type || !amount) {
      console.error('Missing required metadata:', { userId, type, amount });
      return;
    }

    if (type === 'wallet_topup') {
      // The metadata amount is in DOLLARS, so convert to cents for database storage
      const amountInDollars = parseFloat(amount);
      const amountInCents = Math.round(amountInDollars * 100);
      
      console.log(`💰 Converting $${amountInDollars} to ${amountInCents} cents for database`);
      
      const { data, error } = await supabase
        .from('advertiser_profiles')
        .select('available_deposit_balance')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching current balance:', error);
        return;
      }

      console.log('📊 Current balance from DB:', data?.available_deposit_balance);
      const newBalance = (data?.available_deposit_balance || 0) + amountInCents;
      
      console.log(`💾 Attempting to update balance from ${data?.available_deposit_balance || 0} to ${newBalance} for user ${userId}`);
      
      const { error: updateError, data: updateData } = await supabase
        .from('advertiser_profiles')
        .update({ available_deposit_balance: newBalance })
        .eq('id', userId)
        .select();

      if (updateError) {
        console.error('❌ CRITICAL: Error updating deposit balance:', updateError);
        console.error('❌ CRITICAL: Update error details:', JSON.stringify(updateError, null, 2));
        return;
      }

      console.log('✅ Balance update successful:', updateData);

      // Update existing pending transaction to success
      const updateSuccess = await updateTransactionStatus(
        paymentIntent.id,
        'success',
        `Wallet top-up completed - Payment Intent: ${paymentIntent.id}`,
        'Wallet topped up successfully'
      );

      console.log(`Deposit successful: $${amountInDollars} (${amountInCents} cents) added to user ${userId}`);
      console.log(`Transaction status updated: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);
    }

    if (type === 'contest_payment') {
      // Update existing pending contest payment transaction
      const { contestId } = paymentIntent.metadata;
      const amountInDollars = parseFloat(amount);
      
      const updateSuccess = await updateTransactionStatus(
        paymentIntent.id,
        'success',
        `Contest payment completed - Contest: ${contestId}, Payment Intent: ${paymentIntent.id}`,
        'Contest payment completed successfully'
      );

      console.log(`Contest payment successful: $${amountInDollars} for contest ${contestId}`);
      console.log(`Contest transaction updated: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);
    }

  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailure(paymentIntent: any) {
  try {
    const { userId, type, amount } = paymentIntent.metadata;
    const amountInDollars = parseFloat(amount);

    // Generate user-friendly failure remark
    const failureRemark = generateWebhookFailureRemark(
      paymentIntent.last_payment_error?.message,
      paymentIntent.last_payment_error?.code
    );

    // Update existing pending transaction to failed (instead of creating new one)
    const updateSuccess = await updateTransactionStatus(
      paymentIntent.id,
      'failed',
      `Payment failed - Payment Intent: ${paymentIntent.id}`,
      failureRemark
    );

    console.log(`Payment failed for user ${userId}: $${amountInDollars}`);
    console.log(`Transaction status updated to failed: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// Helper function to generate user-friendly failure remarks for webhook
function generateWebhookFailureRemark(errorMessage?: string, errorCode?: string): string {
  if (!errorMessage) return 'Payment could not be processed';
  
  const message = errorMessage.toLowerCase();
  
  if (message.includes('declined') || message.includes('card_declined')) {
    return 'Your card was declined by the bank';
  }
  if (message.includes('insufficient') || message.includes('funds')) {
    return 'Insufficient funds in your account';
  }
  if (message.includes('expired') || message.includes('card_expired')) {
    return 'Your card has expired';
  }
  if (message.includes('incorrect') || message.includes('invalid')) {
    return 'Please check your card information';
  }
  if (message.includes('security') || message.includes('cvc')) {
    return 'Card security verification failed';
  }
  if (message.includes('network') || message.includes('connection')) {
    return 'Network error - please try again';
  }
  
  return 'Payment could not be processed';
} 