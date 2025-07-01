import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createTopUpPaymentIntent, logTransaction } from '@/lib/payment-utils';

export async function POST(request: NextRequest) {
  try {
    const { amount } = await request.json();
    
    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
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
      .select('id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Only advertisers can make deposits' },
        { status: 403 }
      );
    }

    // Convert dollars to cents for storage and logging
    const amountInCents = Math.round(amount * 100);
    console.log('Amount in cents:', amountInCents);

    // Create payment intent (expects dollars)
    console.log('🔍 Creating payment intent for user:', user.id, 'amount:', amount);
    const paymentIntent = await createTopUpPaymentIntent(user.id, amount);
    
    if (!paymentIntent) {
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      );
    }

    // Log pending transaction in CENTS (consistent with database)
    await logTransaction(
      user.id,
      'deposit',
      amountInCents,
      'pending',
      `Wallet top-up initiated - Payment Intent: ${paymentIntent.id}`,
      paymentIntent.id,  // 🚀 OPTIMIZATION: Store payment_intent_id for fast lookups
      'Processing payment...'
    );

    console.log('Payment intent created:', paymentIntent);
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    });

  } catch (error) {
    console.error('Error in deposit endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 