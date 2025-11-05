/**
 * Solana Payout Processing API
 * Processes USDC/USDT payouts to Phantom Wallets
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { processSolanaPayout } from '@/lib/solana-payout-utils';
import { logTransaction } from '@/lib/payment-utils';
import type { PhantomPayoutDetails } from '@/types/earnings';

export async function POST(request: NextRequest) {
  try {
    const { 
      withdrawalRequestId, 
      recipientWallet, 
      amountInCents, 
      tokenType, 
      memo,
      adminNotes 
    } = await request.json();

    // Validate required fields
    if (!withdrawalRequestId || !recipientWallet || !amountInCents || !tokenType) {
      return NextResponse.json(
        { error: 'Missing required fields: withdrawalRequestId, recipientWallet, amountInCents, tokenType' },
        { status: 400 }
      );
    }

    // Validate token type
    if (!['USDC', 'USDT'].includes(tokenType)) {
      return NextResponse.json(
        { error: 'Invalid token type. Must be USDC or USDT' },
        { status: 400 }
      );
    }

    // Validate amount
    if (amountInCents <= 0) {
      return NextResponse.json(
        { error: 'Amount must be positive' },
        { status: 400 }
      );
    }

    console.log('🚀 Processing Solana payout:', {
      withdrawalRequestId,
      recipientWallet,
      amountInCents,
      tokenType,
      memo
    });

    // Get withdrawal request details
    const adminSupabase = createAdminClient();
    const { data: withdrawalRequest, error: withdrawalError } = await adminSupabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawalRequestId)
      .single();

    if (withdrawalError || !withdrawalRequest) {
      return NextResponse.json(
        { error: 'Withdrawal request not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (withdrawalRequest.status === 'processed') {
      return NextResponse.json(
        { error: 'Withdrawal request already processed' },
        { status: 400 }
      );
    }

    // Update status to processing
    await adminSupabase
      .from('withdrawal_requests')
      .update({ 
        status: 'in_review',
        admin_notes: adminNotes || 'Processing Solana payout...'
      })
      .eq('id', withdrawalRequestId);

    // Process the Solana payout
    const payoutResult = await processSolanaPayout(
      recipientWallet,
      amountInCents,
      tokenType as 'USDC' | 'USDT',
      memo
    );

    if (!payoutResult.success) {
      // Update status to failed
      await adminSupabase
        .from('withdrawal_requests')
        .update({ 
          status: 'failed',
          admin_notes: `Payout failed: ${payoutResult.error}`
        })
        .eq('id', withdrawalRequestId);

      return NextResponse.json(
        { 
          error: payoutResult.error || 'Payout processing failed',
          success: false 
        },
        { status: 500 }
      );
    }

    // Update withdrawal request with success
    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        transaction_reference: payoutResult.transactionSignature,
        admin_notes: `Payout processed successfully. Transaction: ${payoutResult.transactionSignature}`
      })
      .eq('id', withdrawalRequestId);

    // Log the payout transaction
    await logTransaction(
      withdrawalRequest.user_id,
      'withdrawal',
      amountInCents,
      'success',
      `Payout to Phantom Wallet (${tokenType})`,
      payoutResult.transactionSignature,
      `Payout processed to ${recipientWallet}`,
      'solana',
      {
        withdrawal_request_id: withdrawalRequestId,
        recipient_wallet: recipientWallet,
        token_type: tokenType,
        transaction_signature: payoutResult.transactionSignature,
        processed_at: new Date().toISOString()
      }
    );

    console.log('✅ Solana payout processed successfully:', {
      withdrawalRequestId,
      transactionSignature: payoutResult.transactionSignature,
      amount: payoutResult.amount,
      tokenType: payoutResult.tokenType
    });

    return NextResponse.json({
      success: true,
      message: 'Payout processed successfully',
      transactionSignature: payoutResult.transactionSignature,
      amount: payoutResult.amount,
      tokenType: payoutResult.tokenType,
      recipientWallet: payoutResult.recipientWallet
    });

  } catch (error) {
    console.error('❌ Error processing Solana payout:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false 
      },
      { status: 500 }
    );
  }
}

// Get payout status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const withdrawalRequestId = searchParams.get('withdrawalRequestId');

    if (!withdrawalRequestId) {
      return NextResponse.json(
        { error: 'withdrawalRequestId is required' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data: withdrawalRequest, error } = await adminSupabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawalRequestId)
      .single();

    if (error || !withdrawalRequest) {
      return NextResponse.json(
        { error: 'Withdrawal request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      withdrawalRequest
    });

  } catch (error) {
    console.error('❌ Error fetching payout status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
