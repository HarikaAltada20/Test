import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripe, formatAmountForStripe } from '@/lib/stripe';
import { processContestPaymentV2, PaymentDetails } from '@/lib/payment-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contestId, amount, paymentMethod, commissionPercentage, walletAmount, changeType, isIncrease, isDecrease } = body;
    
    // Validate inputs
    if (!contestId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid contest ID or amount' },
        { status: 400 }
      );
    }

    if (!commissionPercentage || commissionPercentage < 0) {
      return NextResponse.json(
        { error: 'Invalid commission percentage' },
        { status: 400 }
      );
    }

    if (!paymentMethod || !['wallet', 'stripe', 'split'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // Get user from session
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is an advertiser
    const { data: profile, error: profileError } = await supabase
      .from('advertiser_profiles')
      .select('id, available_deposit_balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Only advertisers can create contests' },
        { status: 403 }
      );
    }

    // Verify contest belongs to the user and get current contest status
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, advertiser_id, title, contest_based_details, payment_details')
      .eq('id', contestId)
      .eq('advertiser_id', user.id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: 'Contest not found or access denied' },
        { status: 404 }
      );
    }

    // Determine if this is initial payment or budget change
    const existingPaymentDetails = contest.payment_details as PaymentDetails | null;
    const budgetChangeType = isIncrease ? 'increase' : isDecrease ? 'decrease' : undefined;

    // Calculate prize pool from total amount (working backwards from commission)
    const totalAmountInCents = Math.round(amount * 100);
    const commissionRate = commissionPercentage / 100;
    const prizePoolInCents = Math.round(totalAmountInCents / (1 + commissionRate));

    // Use the new payment processing function
    const paymentResult = await processContestPaymentV2(
      user.id,
      contestId,
      prizePoolInCents,
      commissionPercentage,
      `Contest payment for "${contest.title}" (ID: ${contestId})`,
      paymentMethod !== 'stripe', // useWalletFirst
      existingPaymentDetails || undefined,
      budgetChangeType
    );

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error },
        { status: 400 }
      );
    }

    // Store the updated payment details in the contest
    if (paymentResult.paymentDetails) {
      const { error: updateError } = await supabase
        .from('contests')
        .update({ payment_details: paymentResult.paymentDetails })
        .eq('id', contestId)
        .eq('advertiser_id', user.id);

      if (updateError) {
        console.error('Error storing payment details:', updateError);
        return NextResponse.json(
          { error: 'Failed to store payment details' },
          { status: 500 }
        );
      }
    }

    // Format response based on payment method
    const response: any = {
      success: true,
      paymentMethod: paymentResult.paymentMethod,
      paymentDetails: paymentResult.paymentDetails
    };

    if (paymentResult.amountFromWallet && paymentResult.amountFromWallet > 0) {
      response.amountFromWallet = paymentResult.amountFromWallet / 100; // Convert to dollars
    }

    if (paymentResult.amountFromStripe && paymentResult.amountFromStripe > 0) {
      response.amountFromStripe = paymentResult.amountFromStripe / 100; // Convert to dollars
    }

    if (paymentResult.paymentIntent) {
      response.clientSecret = paymentResult.paymentIntent.client_secret;
      response.paymentIntentId = paymentResult.paymentIntent.id;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in contest payment endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 