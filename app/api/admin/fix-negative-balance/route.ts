import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logTransaction } from '@/lib/payment-utils';

export async function POST(request: NextRequest) {
  try {
    const { userId, contestId } = await request.json();
    
    if (!userId || !contestId) {
      return NextResponse.json(
        { error: 'Missing userId or contestId' },
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

    console.log('🔧 STARTING NEGATIVE BALANCE RECOVERY ..');

    // Get current advertiser profile
    const { data: advertiser, error: advertiserError } = await supabase
      .from('advertiser_profiles')
      .select('id, available_deposit_balance')
      .eq('id', userId)
      .single();

    if (advertiserError || !advertiser) {
      return NextResponse.json(
        { error: 'Advertiser not found' },
        { status: 404 }
      );
    }

    console.log(`📊 Current balance: ${advertiser.available_deposit_balance} cents`);

    // Get contest payment details
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

    console.log('📋 Payment Details:', JSON.stringify(paymentDetails, null, 2));

    // Calculate what the wallet amounts should be
    const correctedWalletAmounts = [];
    const walletTransactionsToLog = [];
    let totalWalletUsed = 0;

    for (let i = 0; i < paymentDetails.payment_intent_ids.length; i++) {
      const stripeAmount = paymentDetails.stripe_amounts_paid[i] || 0;
      const changeAmount = paymentDetails.amount_changes[i] || 0;
      const expectedWalletAmount = Math.max(0, changeAmount - stripeAmount);
      
      correctedWalletAmounts.push(expectedWalletAmount);
      totalWalletUsed += expectedWalletAmount;

      // Check if we need to log this wallet transaction
      if (expectedWalletAmount > 0) {
        const paymentIntentId = paymentDetails.payment_intent_ids[i];
        const changeType = paymentDetails.change_history[i];
        
        walletTransactionsToLog.push({
          paymentIntentId,
          amount: expectedWalletAmount,
          description: `Contest payment (wallet portion) for contest ${contestId} - ${changeType} (RECOVERY)`,
          remarks: 'Wallet portion recovered from negative balance fix'
        });
      }
    }

    console.log(`💰 Corrected wallet amounts: ${JSON.stringify(correctedWalletAmounts)}`);
    console.log(`💸 Total wallet used: ${totalWalletUsed} cents`);

    // Calculate what the balance should be
    const originalBalance = paymentDetails.original_wallet_balance || 0;
    const correctBalance = originalBalance - totalWalletUsed;
    
    console.log(`🏦 Original balance: ${originalBalance} cents`);
    console.log(`🎯 Correct balance should be: ${correctBalance} cents`);
    console.log(`❌ Current balance: ${advertiser.available_deposit_balance} cents`);

    // Update the balance to the correct amount
    const { error: balanceUpdateError } = await supabase
      .from('advertiser_profiles')
      .update({ available_deposit_balance: correctBalance })
      .eq('id', userId);

    if (balanceUpdateError) {
      console.error('❌ Error updating balance:', balanceUpdateError);
      return NextResponse.json(
        { error: 'Failed to update balance' },
        { status: 500 }
      );
    }

    // Update payment details with correct wallet amounts
    const updatedPaymentDetails = {
      ...paymentDetails,
      wallet_amounts_used: correctedWalletAmounts,
      wallet_deduction_pending: false,
      last_updated: new Date().toISOString()
    };

    const { error: paymentUpdateError } = await supabase
      .from('contests')
      .update({ payment_details: updatedPaymentDetails })
      .eq('id', contestId);

    if (paymentUpdateError) {
      console.error('❌ Error updating payment details:', paymentUpdateError);
      return NextResponse.json(
        { error: 'Failed to update payment details' },
        { status: 500 }
      );
    }

    // Log all the missing wallet transactions
    const logResults = [];
    for (const transaction of walletTransactionsToLog) {
      const logResult = await logTransaction(
        userId,
        'contest_payment',
        transaction.amount,
        'success',
        transaction.description,
        undefined, // No payment intent for wallet portion
        transaction.remarks,
        'split'
      );
      logResults.push({ ...transaction, logged: logResult });
    }

    console.log('✅ RECOVERY COMPLETED');

    return NextResponse.json({
      success: true,
      message: 'Negative balance and missing transactions fixed',
      recovery: {
        balanceChange: {
          before: advertiser.available_deposit_balance,
          after: correctBalance,
          difference: correctBalance - advertiser.available_deposit_balance
        },
        paymentDetails: {
          before: paymentDetails.wallet_amounts_used,
          after: correctedWalletAmounts
        },
        transactionsLogged: logResults.length,
        totalWalletRecovered: totalWalletUsed
      }
    });

  } catch (error) {
    console.error('Error in negative balance recovery:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 