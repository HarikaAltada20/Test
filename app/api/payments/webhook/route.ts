import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { updateTransactionStatus, logTransaction } from '@/lib/payment-utils';

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
            total_amount_paid: paymentDetails.total_amount_paid || Math.round(amountInDollars * 100) // Ensure total_amount_paid is set
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

      console.log(`Contest payment successful: $${amountInDollars} for contest ${contestId}`);
      console.log(`Transaction status updated: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);
    }

    if (type === 'contest_payment_split') {
      // Handle atomic split payment completion
      const { contestId, walletAmount, totalAmount } = paymentIntent.metadata;
      const stripeAmountInDollars = parseFloat(amount);
      const walletAmountInDollars = parseFloat(walletAmount);
      const totalAmountInDollars = parseFloat(totalAmount);
      
      console.log('🔄 Processing atomic split payment completion');
      console.log(`💰 Wallet: $${walletAmountInDollars}, Stripe: $${stripeAmountInDollars}, Total: $${totalAmountInDollars}`);

      try {
        // Get contest payment details to find original wallet balance
        const { data: contest, error: fetchError } = await supabase
          .from('contests')
          .select('payment_details')
          .eq('id', contestId)
          .single();

        if (fetchError || !contest?.payment_details) {
          console.error('❌ Failed to fetch contest payment details:', fetchError);
          return;
        }

        const paymentDetails = typeof contest.payment_details === 'string' 
          ? JSON.parse(contest.payment_details) 
          : contest.payment_details;

        const originalWalletBalance = paymentDetails.original_wallet_balance;
        if (!originalWalletBalance) {
          console.error('❌ No original wallet balance found for atomic rollback');
          return;
        }

        // NOW perform atomic wallet deduction (Stripe has succeeded)
        const walletAmountInCents = Math.round(walletAmountInDollars * 100);
        const newBalance = originalWalletBalance - walletAmountInCents;
        
        console.log(`💳 Deducting ${walletAmountInCents} cents from wallet (${originalWalletBalance} → ${newBalance})`);

        const { error: updateError } = await supabase
          .from('advertiser_profiles')
          .update({ available_deposit_balance: newBalance })
          .eq('id', userId);

        if (updateError) {
          console.error('❌ CRITICAL: Failed to deduct wallet amount after Stripe success:', updateError);
          // TODO: This requires manual intervention - Stripe succeeded but wallet deduction failed
          return;
        }

        // Log successful wallet transaction now that both payments completed
        console.log('🔄 Attempting to log wallet transaction...');
        console.log(`💳 Wallet transaction details: ${walletAmountInCents} cents for user ${userId}`);
        
        try {
          const walletLogResult = await logTransaction(
            userId,
            'contest_payment',
            walletAmountInCents,
            'success',
            `Contest payment (wallet portion) for contest ${contestId} - Split payment completed`,
            undefined, // No payment intent for wallet portion
            'Wallet portion of split payment completed successfully',
            'split'
          );
          console.log(`📝 Wallet transaction logged: ${walletLogResult ? 'SUCCESS' : 'FAILED'}`);
          
          if (!walletLogResult) {
            console.error('❌ CRITICAL: Failed to log wallet transaction in split payment webhook');
          }
        } catch (logError) {
          console.error('❌ ERROR logging wallet transaction:', logError);
        }

        // Update Stripe transaction status
        const updateSuccess = await updateTransactionStatus(
          paymentIntent.id,
          'success',
          `Contest payment (Stripe portion) completed - Contest: ${contestId}, Payment Intent: ${paymentIntent.id}`,
          'Stripe portion of split payment completed successfully'
        );

        // Update contest payment details to 'completed' status
        // Update the wallet amount in the payment details since it was deferred
        const updatedWalletAmounts = [...paymentDetails.wallet_amounts_used];
        
        // Find the entry that corresponds to this payment (should be 0 and have wallet_deduction_pending: true)
        const lastIndex = updatedWalletAmounts.length - 1;
        if (lastIndex >= 0 && paymentDetails.wallet_deduction_pending) {
          // Update the last entry with the actual wallet amount deducted
          updatedWalletAmounts[lastIndex] = walletAmountInCents;
          console.log(`📝 Updated wallet_amounts_used[${lastIndex}] from ${paymentDetails.wallet_amounts_used[lastIndex]} to ${walletAmountInCents}`);
        } else {
          console.warn(`⚠️ Unexpected state: lastIndex=${lastIndex}, wallet_deduction_pending=${paymentDetails.wallet_deduction_pending}`);
          console.warn(`⚠️ Current wallet_amounts_used:`, paymentDetails.wallet_amounts_used);
          // Fallback: add the wallet amount as a new entry if we can't find the right place
          updatedWalletAmounts.push(walletAmountInCents);
        }

        const updatedPaymentDetails = {
          ...paymentDetails,
          payment_status: 'completed',
          paid_at: new Date().toISOString(),
          total_amount_paid: Math.round(totalAmountInDollars * 100), // Store in cents
          wallet_amounts_used: updatedWalletAmounts,
          wallet_deduction_pending: false // Clear the pending flag
        };

        const { error: paymentUpdateError } = await supabase
          .from('contests')
          .update({ payment_details: updatedPaymentDetails })
          .eq('id', contestId);

        if (paymentUpdateError) {
          console.error('❌ Error updating contest payment details:', paymentUpdateError);
        } else {
          console.log('✅ Split payment completed successfully - both wallet and Stripe portions processed');
        }

        console.log(`Split payment successful: $${walletAmountInDollars} (wallet) + $${stripeAmountInDollars} (Stripe) = $${totalAmountInDollars} for contest ${contestId}`);
        console.log(`Transaction status updated: ${updateSuccess ? 'SUCCESS' : 'FAILED'}`);

      } catch (error) {
        console.error('❌ Error processing split payment completion:', error);
      }
    }

  } catch (error) {
    console.error('Error handling payment success:', error);
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