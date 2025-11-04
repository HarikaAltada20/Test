/**
 * Solana Webhook Monitor API
 * Monitors Phantom wallet for new incoming transactions
 * Can be triggered by Qstash or other cron services
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  monitorWalletForNewTransactions,
  getParsedTransaction,
  extractMemoFromTransaction,
  extractTokenTransfer,
  parseMemo,
  lamportsToCents,
  PHANTOM_WALLET_ADDRESS,
  getTokenMintAddress,
} from '@/lib/solana-utils';
import { addToDepositBalance } from '@/lib/payment-utils';
import { sendSolanaPaymentConfirmationEmail } from '@/lib/email/solana-emails';

// Verify webhook is from authorized source (Qstash signature or API key)
function verifyWebhookAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.SOLANA_WEBHOOK_API_KEY;

  if (!apiKey) {
    // If no API key is set, allow requests (for testing)
    console.warn('⚠️ SOLANA_WEBHOOK_API_KEY not set. Webhook is not secured.');
    return true;
  }

  return authHeader === `Bearer ${apiKey}`;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    if (!verifyWebhookAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Starting Solana wallet monitoring...');

    // Check if wallet is configured
    if (!PHANTOM_WALLET_ADDRESS) {
      console.error('❌ Phantom wallet address not configured');
      return NextResponse.json(
        { error: 'Wallet not configured' },
        { status: 500 }
      );
    }

    const adminSupabase = createAdminClient();

    // Get last processed transaction signature
    const { data: lastTransaction } = await adminSupabase
      .from('solana_transactions')
      .select('transaction_signature, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastSignature = lastTransaction?.transaction_signature;
    console.log('📝 Last processed signature:', lastSignature || 'None');

    // Fetch new transactions
    const newTransactions = await monitorWalletForNewTransactions(
      PHANTOM_WALLET_ADDRESS,
      lastSignature
    );

    console.log(`📊 Found ${newTransactions.length} new transaction(s)`);

    if (newTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new transactions found',
        processedCount: 0,
      });
    }

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    // Process each transaction
    for (const signatureInfo of newTransactions) {
      const signature = signatureInfo.signature;
      console.log(`\n🔄 Processing transaction: ${signature}`);

      try {
        // Check if already processed
        const { data: existingTx } = await adminSupabase
          .from('solana_transactions')
          .select('id, balance_updated')
          .eq('transaction_signature', signature)
          .single();

        if (existingTx) {
          console.log('⏭️ Transaction already processed, skipping');
          results.push({
            signature,
            status: 'skipped',
            reason: 'already_processed',
          });
          continue;
        }

        // Get parsed transaction
        const parsedTx = await getParsedTransaction(signature);
        if (!parsedTx) {
          console.error('❌ Failed to fetch transaction');
          errorCount++;
          results.push({
            signature,
            status: 'error',
            reason: 'failed_to_fetch',
          });
          continue;
        }

        // Check if transaction succeeded
        if (parsedTx.meta?.err) {
          console.log('⚠️ Transaction failed on blockchain');
          results.push({
            signature,
            status: 'skipped',
            reason: 'blockchain_error',
          });
          continue;
        }

        // Extract memo
        const memo = extractMemoFromTransaction(parsedTx);
        if (!memo) {
          console.log('⚠️ No memo found, skipping');
          results.push({
            signature,
            status: 'skipped',
            reason: 'no_memo',
          });
          continue;
        }

        // Parse memo
        const parsedMemo = parseMemo(memo);
        if (!parsedMemo.isValid || !parsedMemo.referenceId) {
          console.log('⚠️ Invalid memo format, skipping');
          results.push({
            signature,
            status: 'skipped',
            reason: 'invalid_memo',
            memo,
          });
          continue;
        }

        console.log('📋 Parsed memo:', parsedMemo);

        // Find matching payment request
        const { data: paymentRequest, error: requestError } = await adminSupabase
          .from('solana_payment_requests')
          .select('*')
          .eq('reference_id', parsedMemo.referenceId)
          .eq('status', 'pending')
          .single();

        if (requestError || !paymentRequest) {
          console.log('⚠️ No matching payment request found');
          results.push({
            signature,
            status: 'skipped',
            reason: 'no_matching_request',
            referenceId: parsedMemo.referenceId,
          });
          continue;
        }

        // Check if expired
        if (new Date(paymentRequest.expires_at) < new Date()) {
          console.log('⚠️ Payment request expired');
          await adminSupabase
            .from('solana_payment_requests')
            .update({ status: 'expired' })
            .eq('id', paymentRequest.id);

          results.push({
            signature,
            status: 'skipped',
            reason: 'request_expired',
          });
          continue;
        }

        // Extract token transfer for both USDC and USDT
        let transfer = null;
        let tokenType: 'USDC' | 'USDT' = 'USDC';

        // Try to find transfer for requested token type
        transfer = extractTokenTransfer(
          parsedTx,
          PHANTOM_WALLET_ADDRESS,
          paymentRequest.token_type as 'USDC' | 'USDT'
        );
        tokenType = paymentRequest.token_type as 'USDC' | 'USDT';

        if (!transfer) {
          console.log(`⚠️ No ${paymentRequest.token_type} transfer found`);
          results.push({
            signature,
            status: 'skipped',
            reason: 'no_token_transfer',
            expectedToken: paymentRequest.token_type,
          });
          continue;
        }

        // Convert amount to cents
        const amountCents = lamportsToCents(transfer.amount);
        console.log(`💰 Amount received: $${(amountCents / 100).toFixed(2)} ${tokenType}`);

        // Verify amount (allow 1 cent tolerance)
        if (Math.abs(amountCents - paymentRequest.amount_requested) > 1) {
          console.log(
            `⚠️ Amount mismatch. Expected: $${(paymentRequest.amount_requested / 100).toFixed(2)}, Got: $${(amountCents / 100).toFixed(2)}`
          );
          results.push({
            signature,
            status: 'skipped',
            reason: 'amount_mismatch',
            expected: paymentRequest.amount_requested,
            received: amountCents,
          });
          continue;
        }

        // Record transaction
        const { data: solanaTransaction, error: txInsertError } = await adminSupabase
          .from('solana_transactions')
          .insert({
            user_id: paymentRequest.user_id,
            payment_request_id: paymentRequest.id,
            transaction_signature: signature,
            amount_received: amountCents,
            token_type: tokenType,
            token_mint_address: transfer.tokenMint,
            from_wallet: transfer.fromWallet,
            to_wallet: transfer.toWallet,
            memo,
            block_time: parsedTx.blockTime
              ? new Date(parsedTx.blockTime * 1000).toISOString()
              : null,
            slot: parsedTx.slot,
            status: 'confirmed',
            verification_status: 'verified',
            balance_updated: false,
            metadata: {
              verified_at: new Date().toISOString(),
              auto_processed: true,
            },
          })
          .select()
          .single();

        if (txInsertError) {
          console.error('❌ Error inserting transaction:', txInsertError);
          errorCount++;
          results.push({
            signature,
            status: 'error',
            reason: 'db_insert_failed',
            error: txInsertError.message,
          });
          continue;
        }

        // Credit user balance
        console.log(`💳 Crediting user ${paymentRequest.user_id} with ${amountCents} cents`);
        const balanceResult = await addToDepositBalance(
          paymentRequest.user_id,
          amountCents,
          signature
        );

        if (!balanceResult.success) {
          console.error('❌ Failed to update balance:', balanceResult.error);
          errorCount++;
          results.push({
            signature,
            status: 'error',
            reason: 'balance_update_failed',
            error: balanceResult.error,
          });
          continue;
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

        // Send confirmation email
        const { data: userData } = await adminSupabase
          .from('users')
          .select('email, username')
          .eq('id', paymentRequest.user_id)
          .single();

        if (userData?.email) {
          try {
            await sendSolanaPaymentConfirmationEmail({
              to: userData.email,
              username: userData.username || 'User',
              amount: amountCents / 100,
              tokenType,
              transactionSignature: signature,
              referenceId: parsedMemo.referenceId,
              newBalance: balanceResult.balance / 100,
            });
            console.log('📧 Confirmation email sent');
          } catch (emailError) {
            console.error('⚠️ Failed to send email:', emailError);
            // Don't fail the transaction if email fails
          }
        }

        console.log('✅ Transaction processed successfully');
        successCount++;
        processedCount++;
        results.push({
          signature,
          status: 'success',
          amount: amountCents / 100,
          tokenType,
          userId: paymentRequest.user_id,
        });
      } catch (error) {
        console.error(`❌ Error processing transaction ${signature}:`, error);
        errorCount++;
        results.push({
          signature,
          status: 'error',
          reason: 'unexpected_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `\n✅ Monitoring complete. Processed: ${processedCount}, Success: ${successCount}, Errors: ${errorCount}`
    );

    return NextResponse.json({
      success: true,
      message: 'Wallet monitoring completed',
      stats: {
        totalTransactions: newTransactions.length,
        processedCount,
        successCount,
        errorCount,
      },
      results,
    });
  } catch (error) {
    console.error('❌ Error in webhook monitor:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Solana webhook monitor is running',
    walletConfigured: !!PHANTOM_WALLET_ADDRESS,
    walletAddress: PHANTOM_WALLET_ADDRESS || 'Not configured',
  });
}

