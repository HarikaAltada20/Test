import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logTransaction } from '@/lib/payment-utils';

export async function POST(request: NextRequest) {
  try {
    const { contestId, paymentIntentId } = await request.json();
    
    if (!contestId || !paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing contestId or paymentIntentId' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('advertiser_profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (profile?.user_type !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get the contest and its payment details
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, advertiser_id, payment_details')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: 'Contest not found' },
        { status: 404 }
      );
    }

    const paymentDetails = typeof contest.payment_details === 'string' 
      ? JSON.parse(contest.payment_details) 
      : contest.payment_details;

    if (!paymentDetails) {
      return NextResponse.json(
        { error: 'No payment details found' },
        { status: 404 }
      );
    }

    // Find the payment intent index
    const paymentIntentIndex = paymentDetails.payment_intent_ids.findIndex(
      (id: string) => id === paymentIntentId
    );

    if (paymentIntentIndex === -1) {
      return NextResponse.json(
        { error: 'Payment intent not found in payment details' },
        { status: 404 }
      );
    }

    // Calculate the expected wallet amount based on original balance and total amount
    const originalBalance = paymentDetails.original_wallet_balance || 0;
    const stripeAmount = paymentDetails.stripe_amounts_paid[paymentIntentIndex] || 0;
    const totalAmount = paymentDetails.total_amount_paid;
    const expectedWalletAmount = totalAmount - stripeAmount;

    console.log('🔧 FIXING PAYMENT DETAILS');
    console.log(`📊 Original balance: ${originalBalance}`);
    console.log(`💳 Stripe amount: ${stripeAmount}`);
    console.log(`💰 Total amount: ${totalAmount}`);
    console.log(`🏦 Expected wallet amount: ${expectedWalletAmount}`);
    console.log(`📋 Current wallet amounts: ${JSON.stringify(paymentDetails.wallet_amounts_used)}`);

    // Update the wallet amount
    const updatedWalletAmounts = [...paymentDetails.wallet_amounts_used];
    updatedWalletAmounts[paymentIntentIndex] = expectedWalletAmount;

    const updatedPaymentDetails = {
      ...paymentDetails,
      wallet_amounts_used: updatedWalletAmounts,
      wallet_deduction_pending: false,
      last_updated: new Date().toISOString()
    };

    // Update the contest payment details
    const { error: updateError } = await supabase
      .from('contests')
      .update({ payment_details: updatedPaymentDetails })
      .eq('id', contestId);

    if (updateError) {
      console.error('❌ Error updating payment details:', updateError);
      return NextResponse.json(
        { error: 'Failed to update payment details' },
        { status: 500 }
      );
    }

    // Log the wallet transaction if it doesn't exist
    if (expectedWalletAmount > 0) {
      await logTransaction(
        contest.advertiser_id,
        'contest_payment',
        expectedWalletAmount,
        'success',
        `Contest payment (wallet portion) for contest ${contestId} - Split payment completed (FIXED)`,
        undefined,
        'Wallet portion of split payment completed successfully',
        'split'
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Payment details fixed successfully',
      before: {
        wallet_amounts_used: paymentDetails.wallet_amounts_used,
        wallet_deduction_pending: paymentDetails.wallet_deduction_pending
      },
      after: {
        wallet_amounts_used: updatedWalletAmounts,
        wallet_deduction_pending: false
      },
      walletTransactionLogged: expectedWalletAmount > 0
    });

  } catch (error) {
    console.error('Error in fix payment details endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 