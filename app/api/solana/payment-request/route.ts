/**
 * Solana Payment Request API
 * Creates a payment request for Phantom Wallet USDC/USDT top-up
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  generateReferenceId,
  createPaymentMemo,
  PHANTOM_WALLET_ADDRESS,
  PAYMENT_EXPIRATION_HOURS,
  isWalletConfigured,
} from '@/lib/solana-utils';

export async function POST(request: NextRequest) {
  try {
    // Verify Phantom wallet is configured
    if (!isWalletConfigured()) {
      return NextResponse.json(
        { error: 'Solana wallet not configured. Please contact support.' },
        { status: 500 }
      );
    }

    const { amount, tokenType } = await request.json();

    // Validate input
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be greater than 0.' },
        { status: 400 }
      );
    }

    if (!tokenType || !['USDC', 'USDT'].includes(tokenType)) {
      return NextResponse.json(
        { error: 'Invalid token type. Must be USDC or USDT.' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is an advertiser
    const { data: profile, error: profileError } = await supabase
      .from('advertiser_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Only advertisers can make Solana deposits' },
        { status: 403 }
      );
    }

    // Get user details for memo
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('username, email')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: 'Failed to fetch user details' },
        { status: 500 }
      );
    }

    const username = userData.username || userData.email?.split('@')[0] || 'user';

    // Generate unique reference ID
    let referenceId = generateReferenceId();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure reference ID is unique
    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from('solana_payment_requests')
        .select('id')
        .eq('reference_id', referenceId)
        .single();

      if (!existing) break;

      referenceId = generateReferenceId();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique reference ID. Please try again.' },
        { status: 500 }
      );
    }

    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);

    // Create memo
    const memo = createPaymentMemo(username, amount, referenceId);

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + PAYMENT_EXPIRATION_HOURS);

    // Create payment request
    const { data: paymentRequest, error: insertError } = await supabase
      .from('solana_payment_requests')
      .insert({
        user_id: user.id,
        reference_id: referenceId,
        amount_requested: amountInCents,
        token_type: tokenType,
        status: 'pending',
        memo,
        wallet_address: PHANTOM_WALLET_ADDRESS,
        expires_at: expiresAt.toISOString(),
        metadata: {
          username,
          created_via: 'web',
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating payment request:', insertError);
      return NextResponse.json(
        { error: 'Failed to create payment request' },
        { status: 500 }
      );
    }

    console.log('✅ Payment request created:', {
      referenceId,
      userId: user.id,
      amount: amountInCents,
      tokenType,
    });

    // Return payment request details
    return NextResponse.json({
      success: true,
      paymentRequest: {
        id: paymentRequest.id,
        referenceId,
        amount: amountInCents / 100, // Return in dollars
        amountCents: amountInCents,
        tokenType,
        memo,
        walletAddress: PHANTOM_WALLET_ADDRESS,
        expiresAt: expiresAt.toISOString(),
        instructions: {
          step1: 'Open your Phantom Wallet app',
          step2: `Send exactly $${(amountInCents / 100).toFixed(2)} ${tokenType} to the wallet address below`,
          step3: 'Include the memo exactly as shown (case-sensitive)',
          step4: 'Your balance will be updated within 1-2 minutes after payment confirmation',
        },
      },
    });
  } catch (error) {
    console.error('Error in payment request endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const referenceId = searchParams.get('referenceId');
    const status = searchParams.get('status');

    // Build query
    let query = supabase
      .from('solana_payment_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (referenceId) {
      query = query.eq('reference_id', referenceId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: paymentRequests, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching payment requests:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch payment requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentRequests: paymentRequests || [],
    });
  } catch (error) {
    console.error('Error in payment request GET endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

