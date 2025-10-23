/**
 * Solana Payment Verification API
 * Verifies a transaction and updates user balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  PHANTOM_WALLET_ADDRESS,
} from '@/lib/solana-utils';
import { verifyTransactionSimple } from '@/lib/solana-utils-no-memo';
import { addToDepositBalance, logTransaction } from '@/lib/payment-utils';
import { sendSolanaPaymentConfirmationEmail } from '@/lib/email/solana-emails';

export async function POST(request: NextRequest) {
  try {
    const { transactionSignature, referenceId } = await request.json();

    // Validate input
    if (!transactionSignature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
        { status: 400 }
      );
    }

    if (!referenceId) {
      return NextResponse.json(
        { error: 'Reference ID is required' },
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

    // Check if transaction already processed
    const { data: existingTx } = await supabase
      .from('solana_transactions')
      .select('id, status, balance_updated')
      .eq('transaction_signature', transactionSignature)
      .single();

    if (existingTx?.balance_updated) {
      return NextResponse.json(
        { error: 'Transaction already processed', transaction: existingTx },
        { status: 400 }
      );
    }

    // Get payment request
    const { data: paymentRequest, error: requestError } = await supabase
      .from('solana_payment_requests')
      .select('*')
      .eq('reference_id', referenceId)
      .eq('user_id', user.id)
      .single();

    if (requestError || !paymentRequest) {
      return NextResponse.json(
        { error: 'Payment request not found or does not belong to you' },
        { status: 404 }
      );
    }

    // Check if payment request is still valid
    if (paymentRequest.status === 'completed') {
      return NextResponse.json(
        { error: 'Payment request already completed' },
        { status: 400 }
      );
    }

    if (paymentRequest.status === 'expired') {
      return NextResponse.json(
        { error: 'Payment request has expired' },
        { status: 400 }
      );
    }

    if (new Date(paymentRequest.expires_at) < new Date()) {
      // Auto-expire
      await supabase
        .from('solana_payment_requests')
        .update({ status: 'expired' })
        .eq('id', paymentRequest.id);

      return NextResponse.json(
        { error: 'Payment request has expired' },
        { status: 400 }
      );
    }

    // Verify transaction on blockchain (no memo required - Phantom-friendly)
    console.log('🔍 Verifying transaction:', transactionSignature);
    console.log('📋 Payment request details:', {
      amount: paymentRequest.amount_requested,
      tokenType: paymentRequest.token_type,
      createdAt: paymentRequest.created_at
    });
    
    const verificationResult = await verifyTransactionSimple(
      transactionSignature,
      PHANTOM_WALLET_ADDRESS,
      paymentRequest.token_type as 'USDC' | 'USDT',
      paymentRequest.amount_requested,
      new Date(paymentRequest.created_at)
    );

    if (!verificationResult.isValid) {
      console.error('❌ Transaction verification failed:', verificationResult.error);

      // Log failed verification attempt
      const adminSupabase = createAdminClient();
      await adminSupabase.from('solana_transactions').insert({
        user_id: user.id,
        payment_request_id: paymentRequest.id,
        transaction_signature: transactionSignature,
        amount_received: 0,
        token_type: paymentRequest.token_type,
        token_mint_address: '',
        from_wallet: '',
        to_wallet: PHANTOM_WALLET_ADDRESS,
        status: 'failed',
        verification_status: 'invalid',
        balance_updated: false,
        metadata: {
          error: verificationResult.error,
        },
      });

      return NextResponse.json(
        {
          error: verificationResult.error || 'Transaction verification failed',
          details: 'The transaction could not be verified on the blockchain',
        },
        { status: 400 }
      );
    }

    console.log('✅ Transaction verified successfully');

    const transaction = verificationResult.transaction!;

    // Use admin client to bypass RLS
    const adminSupabase = createAdminClient();

    // Record transaction in database
    const { data: solanaTransaction, error: txInsertError } = await adminSupabase
      .from('solana_transactions')
      .insert({
        user_id: user.id,
        payment_request_id: paymentRequest.id,
        transaction_signature: transactionSignature,
        amount_received: transaction.amount,
        token_type: transaction.tokenType,
        token_mint_address: transaction.tokenMintAddress,
        from_wallet: transaction.fromWallet,
        to_wallet: transaction.toWallet,
        memo: transaction.memo,
        block_time: transaction.blockTime
          ? new Date(transaction.blockTime * 1000).toISOString()
          : null,
        slot: transaction.slot,
        status: transaction.status,
        verification_status: 'verified',
        balance_updated: false,
        metadata: {
          verified_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (txInsertError) {
      console.error('Error inserting transaction:', txInsertError);
      return NextResponse.json(
        { error: 'Failed to record transaction' },
        { status: 500 }
      );
    }

    // Add amount to user's deposit balance using the improved function
    console.log('💰 Crediting user balance:', transaction.amount, 'cents');
    const balanceResult = await addToDepositBalance(
      user.id,
      transaction.amount,
      transactionSignature, // Use signature as payment intent ID
      'phantom' // Specify payment method
    );

    if (!balanceResult.success) {
      console.error('Failed to update balance:', balanceResult.error);
      return NextResponse.json(
        { error: 'Failed to update balance. Please contact support.' },
        { status: 500 }
      );
    }
    
    // Mark transaction as balance updated
    await adminSupabase
      .from('solana_transactions')
      .update({ balance_updated: true })
      .eq('id', solanaTransaction.id);

    // Mark payment request as completed
    await adminSupabase
      .from('solana_payment_requests')
      .update({ status: 'completed' })
      .eq('id', paymentRequest.id);

    // Get user details for email
    const { data: userData } = await supabase
      .from('users')
      .select('email, username')
      .eq('id', user.id)
      .single();

    // Send confirmation email
    if (userData?.email) {
      try {
        await sendSolanaPaymentConfirmationEmail({
          to: userData.email,
          username: userData.username || 'User',
          amount: transaction.amount / 100, // Convert cents to dollars
          tokenType: transaction.tokenType,
          transactionSignature,
          referenceId,
          newBalance: balanceResult.balance / 100, // Convert cents to dollars
        });
        console.log('📧 Confirmation email sent to:', userData.email);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the request if email fails
      }
    }

    console.log('✅ Payment processed successfully');

    return NextResponse.json({
      success: true,
      message: 'Payment verified and balance updated successfully',
      transaction: {
        id: solanaTransaction.id,
        signature: transactionSignature,
        amount: transaction.amount / 100, // Return in dollars
        tokenType: transaction.tokenType,
        status: transaction.status,
        newBalance: balanceResult.balance / 100, // Return in dollars
      },
    });
  } catch (error) {
    console.error('Error in payment verification endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get transaction status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const signature = searchParams.get('signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
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

    // Get transaction
    const { data: transaction, error: txError } = await supabase
      .from('solana_transactions')
      .select('*')
      .eq('transaction_signature', signature)
      .eq('user_id', user.id)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error('Error fetching transaction status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

