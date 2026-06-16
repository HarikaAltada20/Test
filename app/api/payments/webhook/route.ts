import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  updateTransactionStatus,
  ensureDefaultPaymentMethod,
  logTransactionAsAdmin,
  finalizeContestPaymentFromStripe,
} from '@/lib/payment-utils';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    console.log('🔔 WEBHOOK RECEIVED!');
    console.log('📍 Environment:', process.env.NODE_ENV);
    console.log('🌐 Webhook Secret configured:', !!process.env.STRIPE_WEBHOOK_SECRET);
    console.log('📝 Webhook body length:', body.length);

    if (!signature) {
      console.error('❌ No signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    console.log('🔐 Webhook signature: Present');

    let event: Stripe.Event;

    try {
      event = stripe().webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      console.log('✅ Webhook signature verified successfully');
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('📦 Event type:', event.type);

    // Only log events we actually handle to reduce noise
    const handledEvents = [
      'payment_intent.succeeded',
      'payment_intent.payment_failed'
    ];

    if (!handledEvents.includes(event.type)) {
      console.log(`ℹ️ Ignoring unhandled event type: ${event.type}`);
      return NextResponse.json({ received: true });
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
    const supabase = createAdminClient();
    
    console.log('=== WEBHOOK DEBUG ===');
    console.log('Payment Intent ID:', paymentIntent.id);
    console.log('Customer ID:', paymentIntent.customer);
    console.log('Metadata:', paymentIntent.metadata);
    
    // Check if this is a subscription-related payment intent
    // Subscription payments are handled by the /api/subscriptions/webhook via invoice.payment_succeeded
    if (isSubscriptionPaymentIntent(paymentIntent)) {
      console.log('🔄 Ignoring subscription payment intent - will be handled by subscription webhook');
      return;
    }
    
    const { userId, type, amount } = paymentIntent.metadata;
    console.log('userId:', userId, 'type:', type, 'amount:', amount, 'customerId:', paymentIntent.customer);
    
    if (!userId || !type || !amount) {
      console.error('Missing required metadata:', { userId, type, amount });
      return;
    }

    if (type === 'wallet_topup') {
      // IDEMPOTENCY CHECK: Prevent duplicate processing of the same payment intent
      console.log(`🔍 Checking if payment intent ${paymentIntent.id} has already been processed...`);
      
      const { data: existingTransaction, error: checkError } = await supabase
        .from('money_transactions')
        .select('id, status')
        .eq('payment_intent_id', paymentIntent.id)
        .eq('status', 'success')
        .single();

      if (!checkError && existingTransaction) {
        console.log(`⚠️ DUPLICATE WEBHOOK: Payment intent ${paymentIntent.id} already processed successfully. Skipping.`);
        console.log(`⚠️ Existing transaction ID: ${existingTransaction.id}`);
        return; // Exit early to prevent duplicate processing
      }

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned (expected for new transactions)
        console.error('❌ Error checking for existing transaction:', checkError);
        return;
      }

      console.log(`✅ Payment intent ${paymentIntent.id} is new, proceeding with processing...`);

      // The metadata amount is in DOLLARS, so convert to cents for database storage
      const amountInDollars = parseFloat(amount);
      const amountInCents = Math.round(amountInDollars * 100);
      
      console.log(`💰 Converting $${amountInDollars} to ${amountInCents} cents for database`);
      console.log(`👤 Customer ID: ${paymentIntent.customer}`);
      
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

      // Update existing pending transaction to success, or create one if Checkout
      // did not produce a payment_intent at session creation time
      const updateSuccess = await updateTransactionStatus(
        paymentIntent.id,
        'success',
        `Wallet top-up completed - Payment Intent: ${paymentIntent.id}`,
        'Wallet topped up successfully'
      );

      if (!updateSuccess) {
        console.log(
          '📝 No pending transaction found — creating success deposit record'
        );
        const customerId =
          typeof paymentIntent.customer === 'string'
            ? paymentIntent.customer
            : paymentIntent.customer?.id;

        const logged = await logTransactionAsAdmin(
          userId,
          'deposit',
          amountInCents,
          'success',
          `Wallet top-up completed - Payment Intent: ${paymentIntent.id}`,
          {
            paymentIntentId: paymentIntent.id,
            remarks: 'Wallet topped up successfully',
            paymentMethod: 'stripe',
            metadata: customerId
              ? { stripe_customer_id: customerId }
              : undefined,
          }
        );
        console.log(
          `Transaction record created: ${logged ? 'SUCCESS' : 'FAILED'}`
        );
      }

      console.log(`Deposit successful: $${amountInDollars} (${amountInCents} cents) added to user ${userId}`);
      console.log(
        `Transaction logged: ${updateSuccess ? 'UPDATED_PENDING' : 'CREATED_NEW'}`
      );
      console.log(`Customer ID: ${paymentIntent.customer}`);
    }

    if (type === 'contest_payment' || type === 'contest_payment_split') {
      const finalizeResult = await finalizeContestPaymentFromStripe(paymentIntent);

      if (!finalizeResult.success) {
        console.error(
          'Contest payment finalization failed:',
          finalizeResult.error,
        );
        return;
      }

      if (finalizeResult.alreadyProcessed) {
        console.log(
          `Contest payment intent ${paymentIntent.id} already processed`,
        );
      } else {
        console.log(
          `Contest payment finalized for contest ${paymentIntent.metadata.contestId}`,
        );
      }
    }

    // Set default payment method for contest payments only.
    // Wallet top-ups use one-time Checkout — the PM is not attached to the customer.
    if (
      paymentIntent.customer &&
      paymentIntent.payment_method &&
      type !== 'wallet_topup'
    ) {
      await ensureDefaultPaymentMethod(
        paymentIntent.customer,
        paymentIntent.payment_method
      );
    }

  } catch (error) {
    console.error('Error processing payment success:', error);
  }
}

async function handlePaymentFailure(paymentIntent: any) {
  try {
    // Use service role client for webhook operations (bypasses RLS)
    const supabase = createAdminClient();
    
    const { userId, type, amount, contestId, walletAmount, totalAmount } = paymentIntent.metadata;
    const amountInDollars = parseFloat(amount);

    // Generate user-friendly failure remark
    const failureRemark = generateWebhookFailureRemark(
      paymentIntent.last_payment_error?.message,
      paymentIntent.last_payment_error?.code
    );

    if (type === 'contest_payment_split') {
      // Handle split payment failure - ensure no partial deductions
      console.log('🔄 Processing split payment failure - ensuring atomic rollback');
      
      try {
        // Since we implemented atomic transactions, wallet should NOT have been deducted yet
        // But let's verify and fix if there was any partial deduction
        const { data: contest } = await supabase
          .from('contests')
          .select('payment_details')
          .eq('id', contestId)
          .single();

        if (contest?.payment_details) {
          const paymentDetails = typeof contest.payment_details === 'string' 
            ? JSON.parse(contest.payment_details) 
            : contest.payment_details;

          // Update contest payment details to failed status
          const updatedPaymentDetails = {
            ...paymentDetails,
            payment_status: 'failed',
            failure_reason: failureRemark,
            failed_at: new Date().toISOString(),
            wallet_deduction_pending: false // Clear the pending flag since payment failed
          };

          await supabase
            .from('contests')
            .update({ payment_details: updatedPaymentDetails })
            .eq('id', contestId);

          console.log('✅ Split payment failure processed - no rollback needed due to atomic design');
        }
      } catch (error) {
        console.error('❌ Error handling split payment failure:', error);
      }

      // Update Stripe transaction status
      const updateSuccess = await updateTransactionStatus(
        paymentIntent.id,
        'failed',
        `Split payment failed - Contest: ${contestId}, Payment Intent: ${paymentIntent.id}`,
        failureRemark
      );

      console.log(`Split payment failed for user ${userId}: Stripe portion $${amountInDollars} failed, wallet portion not deducted (atomic design)`);
      console.log(`Transaction status updated to failed: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);
    } else {
      // Handle regular payment failures
      const updateSuccess = await updateTransactionStatus(
        paymentIntent.id,
        'failed',
        `Payment failed - Payment Intent: ${paymentIntent.id}`,
        failureRemark
      );

      console.log(`Payment failed for user ${userId}: $${amountInDollars}`);
      console.log(`Transaction status updated to failed: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);
    }

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

// Helper function to determine if a payment intent is subscription-related
function isSubscriptionPaymentIntent(paymentIntent: any): boolean {
  // Subscription payment intents typically have these characteristics:
  // 1. They have an invoice associated with them
  // 2. They don't have our custom metadata (userId, type, amount)
  // 3. They're created automatically by Stripe for subscription billing
  
  const hasInvoice = paymentIntent.invoice;
  const hasCustomMetadata = paymentIntent.metadata && 
    (paymentIntent.metadata.userId || paymentIntent.metadata.type || paymentIntent.metadata.amount);
  
  // If it has an invoice but no custom metadata, it's likely a subscription payment
  if (hasInvoice && !hasCustomMetadata) {
    return true;
  }
  
  // If it has no metadata at all, it's likely a subscription payment
  if (!paymentIntent.metadata || Object.keys(paymentIntent.metadata).length === 0) {
    return true;
  }
  
  return false;
} 