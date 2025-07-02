import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripe, formatAmountForStripe } from '@/lib/stripe';
import { getAdvertiserDepositBalance, logTransaction } from '@/lib/payment-utils';

export async function POST(request: NextRequest) {
  try {
    const { contestId, amount, paymentMethod } = await request.json();
    
    // Validate inputs
    if (!contestId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid contest ID or amount' },
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
      .select('id, advertiser_id, total_prize, title')
      .eq('id', contestId)
      .eq('advertiser_id', user.id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: 'Contest not found or access denied' },
        { status: 404 }
      );
    }

    // Get current deposit balance
    const balanceResult = await getAdvertiserDepositBalance(user.id);
    if (!balanceResult.success) {
      return NextResponse.json(
        { error: 'Failed to fetch balance' },
        { status: 500 }
      );
    }

    const currentBalance = balanceResult.balance;

    // Handle different payment methods
    if (paymentMethod === 'wallet') {
      // Pay entirely from wallet (amount comes in dollars, convert to cents for database)
      const amountInCents = Math.round(amount * 100);
      
      if (currentBalance < amountInCents) {
        return NextResponse.json(
          { 
            error: 'Insufficient wallet balance',
            currentBalance: currentBalance / 100, // Convert to dollars for error message
            required: amount
          },
          { status: 400 }
        );
      }

      // Deduct from wallet balance (both in cents)
      const newBalance = currentBalance - amountInCents;
      const { error: updateError } = await supabase
        .from('advertiser_profiles')
        .update({ available_deposit_balance: newBalance })
        .eq('id', user.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to process wallet payment' },
          { status: 500 }
        );
      }

      // Log transaction in cents (consistent with database storage)
      await logTransaction(
        user.id,
        'contest_payment',
        amountInCents,
        'success',
        `Contest payment for "${contest.title}" (ID: ${contestId})`,
        undefined,
        'Payment completed successfully'
      );

      return NextResponse.json({
        success: true,
        paymentMethod: 'wallet',
        amountFromWallet: amount,
        remainingBalance: newBalance / 100, // Convert back to dollars for response
      });

    } else if (paymentMethod === 'stripe') {
      // Pay entirely via Stripe
      const paymentIntent = await stripe().paymentIntents.create({
        amount: formatAmountForStripe(amount),
        currency: 'usd',
        metadata: {
          userId: user.id,
          type: 'contest_payment',
          contestId,
          amount: amount.toString(),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Log pending transaction in cents (consistent with database storage)
      const amountInCents = Math.round(amount * 100);
      await logTransaction(
        user.id,
        'contest_payment',
        amountInCents,
        'pending',
        `Contest payment via Stripe for "${contest.title}" (ID: ${contestId}) - Payment Intent: ${paymentIntent.id}`,
        paymentIntent.id,  // 🚀 OPTIMIZATION: Store payment_intent_id for fast lookups
        'Processing payment...'
      );

      return NextResponse.json({
        success: true,
        paymentMethod: 'stripe',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountFromStripe: amount,
      });

    } else if (paymentMethod === 'split') {
      // Split payment between wallet and Stripe
      const { walletAmount } = await request.json();
      
      if (!walletAmount || walletAmount < 0 || walletAmount > currentBalance) {
        return NextResponse.json(
          { error: 'Invalid wallet amount for split payment' },
          { status: 400 }
        );
      }

      const stripeAmount = amount - walletAmount;
      
      if (stripeAmount <= 0) {
        return NextResponse.json(
          { error: 'Invalid Stripe amount for split payment' },
          { status: 400 }
        );
      }

      // Convert amounts to cents for database operations
      const walletAmountInCents = Math.round(walletAmount * 100);
      const stripeAmountInCents = Math.round(stripeAmount * 100);
      
      // Deduct from wallet first (both amounts in cents)
      const newBalance = currentBalance - walletAmountInCents;
      const { error: updateError } = await supabase
        .from('advertiser_profiles')
        .update({ available_deposit_balance: newBalance })
        .eq('id', user.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to process wallet portion of split payment' },
          { status: 500 }
        );
      }

      // Create Stripe payment intent for remaining amount
      const paymentIntent = await stripe().paymentIntents.create({
        amount: formatAmountForStripe(stripeAmount),
        currency: 'usd',
        metadata: {
          userId: user.id,
          type: 'contest_payment',
          contestId,
          amount: stripeAmount.toString(),
          walletAmount: walletAmount.toString(),
          totalAmount: amount.toString(),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Log transactions in cents (consistent with database storage)
      await Promise.all([
        logTransaction(
          user.id,
          'contest_payment',
          walletAmountInCents,
          'success',
          `Contest payment (wallet portion) for "${contest.title}" (ID: ${contestId})`,
          undefined,  // No payment intent ID for wallet portion
          'Payment completed successfully'
        ),
        logTransaction(
          user.id,
          'contest_payment',
          stripeAmountInCents,
          'pending',
          `Contest payment (Stripe portion) for "${contest.title}" (ID: ${contestId}) - Payment Intent: ${paymentIntent.id}`,
          paymentIntent.id,  // 🚀 OPTIMIZATION: Store payment_intent_id for fast lookups
          'Processing payment...'
        )
      ]);

      return NextResponse.json({
        success: true,
        paymentMethod: 'split',
        amountFromWallet: walletAmount,
        amountFromStripe: stripeAmount,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        remainingBalance: newBalance / 100, // Convert back to dollars for response
      });
    }

  } catch (error) {
    console.error('Error in contest payment endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 