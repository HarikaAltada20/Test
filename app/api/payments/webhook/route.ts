import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { updateTransactionStatus } from '@/lib/payment-utils';

export async function POST(request: NextRequest) {
  console.log('🔔 WEBHOOK RECEIVED!');
  console.log('📍 Environment:', process.env.NODE_ENV);
  console.log('🌐 Webhook Secret configured:', !!process.env.STRIPE_WEBHOOK_SECRET);
  
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

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    let event;
    try {
      event = stripe().webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      console.log('✅ Webhook signature verified successfully');
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      console.error('🔧 Debug info:');
      console.error('  - Signature length:', signature?.length || 0);
      console.error('  - Body length:', body.length);
      console.error('  - Webhook secret length:', process.env.STRIPE_WEBHOOK_SECRET?.length || 0);
      
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
    
    console.log('=== WEBHOOK DEBUG ===');
    console.log('Payment Intent ID:', paymentIntent.id);
    console.log('Metadata:', paymentIntent.metadata);
    
    // Check if this is a subscription-related payment intent
    // Subscription payments are handled by the /api/subscriptions/webhook via invoice.payment_succeeded
    if (isSubscriptionPaymentIntent(paymentIntent)) {
      console.log('🔄 Ignoring subscription payment intent - will be handled by subscription webhook');
      return;
    }
    
    const { userId, type, amount } = paymentIntent.metadata;
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

    if (type === 'contest_payment' || type === 'contest_payment_split') {
      // Update existing pending contest payment transaction
      const { contestId, walletAmount, totalAmount } = paymentIntent.metadata;
      const amountInDollars = parseFloat(amount);
      
      // For split payments, we need to process wallet deduction atomically
      if (type === 'contest_payment_split') {
        console.log('🔄 Processing split payment success - deducting wallet amount');
        
        const walletAmountInDollars = parseFloat(walletAmount || '0');
        const walletAmountInCents = Math.round(walletAmountInDollars * 100);
        
        console.log(`💰 Split payment details: Stripe $${amountInDollars}, Wallet $${walletAmountInDollars}`);
        
        if (walletAmountInCents > 0) {
          // Deduct wallet amount from user's balance
          const { data: profile, error: balanceError } = await supabase
            .from('advertiser_profiles')
            .select('available_deposit_balance')
            .eq('id', userId)
            .single();

          if (balanceError) {
            console.error('❌ Error fetching user balance for wallet deduction:', balanceError);
          } else {
            const currentBalance = profile?.available_deposit_balance || 0;
            const newBalance = currentBalance - walletAmountInCents;
            
            console.log(`💾 Deducting wallet: ${currentBalance} -> ${newBalance} cents (${walletAmountInCents} cents deducted)`);
            
            // CRITICAL: Prevent negative balances
            if (newBalance < 0) {
              console.error(`🚨 CRITICAL: Wallet deduction would create negative balance! Current: ${currentBalance}, Deducting: ${walletAmountInCents}`);
            } else {
              // Update balance
              const { error: updateBalanceError } = await supabase
                .from('advertiser_profiles')
                .update({ available_deposit_balance: newBalance })
                .eq('id', userId);

              if (updateBalanceError) {
                console.error('❌ CRITICAL: Error deducting wallet amount:', updateBalanceError);
              } else {
                console.log('✅ Wallet balance deducted successfully');
                
                // Log wallet transaction using service role client (bypasses RLS)
                try {
                  console.log(`📝 Attempting to log wallet transaction: User=${userId}, Amount=${walletAmountInCents} cents`);
                  
                  // Use service role client directly for wallet transaction logging
                  const walletTransactionData = {
                    user_id: userId,
                    type: 'contest_payment',
                    status: 'success',
                    amount: walletAmountInCents,
                    description: `Contest payment (wallet portion) for contest ${contestId} - Split payment completed`,
                    payment_intent_id: null, // No payment intent for wallet portion
                    payment_method: 'split',
                    remarks: 'Wallet portion of split payment completed successfully',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  };

                  console.log('💾 Inserting wallet transaction with service role:', walletTransactionData);

                  const { data: walletTransactionResult, error: walletLogError } = await supabase
                    .from('money_transactions')
                    .insert(walletTransactionData)
                    .select()
                    .single();

                  const walletLogSuccess = !walletLogError;
                  
                  if (walletLogSuccess) {
                    console.log(`✅ Wallet transaction logged successfully:`, {
                      id: walletTransactionResult?.id,
                      amount: walletAmountInCents,
                      user_id: userId,
                      payment_method: 'split'
                    });
                  } else {
                    console.error(`❌ CRITICAL: Wallet transaction logging FAILED:`, {
                      user: userId,
                      amount: walletAmountInCents,
                      error: walletLogError
                    });
                  }
                } catch (logError) {
                  console.error(`❌ CRITICAL: Exception during wallet transaction logging:`, logError);
                }
              }
            }
          }
        }
      }
      
      const updateSuccess = await updateTransactionStatus(
        paymentIntent.id,
        'success',
        `Contest payment completed - Contest: ${contestId}, Payment Intent: ${paymentIntent.id}`,
        'Contest payment completed successfully'
      );

      // Update contest payment details to 'completed' status
      try {
        
        // Get current payment details and update status
        const { data: contest, error: fetchError } = await supabase
          .from('contests')
          .select('payment_details')
          .eq('id', contestId)
          .single();

        if (!fetchError && contest?.payment_details) {
          const paymentDetails = typeof contest.payment_details === 'string' 
            ? JSON.parse(contest.payment_details) 
            : contest.payment_details;

          // Update payment status and paid_at timestamp
          const updatedPaymentDetails = {
            ...paymentDetails,
            payment_status: 'completed',
            paid_at: new Date().toISOString(),
            total_amount_paid: paymentDetails.total_amount_paid || Math.round(amountInDollars * 100), // Ensure total_amount_paid is set
            wallet_deduction_pending: false // Clear the pending flag for split payments
          };

          const { error: updateError } = await supabase
            .from('contests')
            .update({ payment_details: updatedPaymentDetails })
            .eq('id', contestId);

          if (updateError) {
            console.error('Error updating contest payment details:', updateError);
          } else {
            console.log('✅ Contest payment details updated to completed');
          }
        }
      } catch (error) {
        console.error('Error updating contest payment details:', error);
      }

      if (type === 'contest_payment_split') {
        console.log(`Split payment successful: Stripe $${amountInDollars} + Wallet $${parseFloat(walletAmount || '0')} for contest ${contestId}`);
      } else {
        console.log(`Contest payment successful: $${amountInDollars} for contest ${contestId}`);
      }
      console.log(`Transaction status updated: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);
    }

  } catch (error) {
    console.error('Error processing payment success:', error);
  }
}

async function handlePaymentFailure(paymentIntent: any) {
  try {
    // Use service role client for webhook operations (bypasses RLS)
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
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