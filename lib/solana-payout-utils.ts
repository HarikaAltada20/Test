/**
 * Solana Payout Utilities
 * Handles USDC/USDT payouts to Phantom Wallets
 */

import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  createTransferInstruction, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { createSolanaConnection, getTokenMintAddress } from './solana-utils';
import type { PhantomPayoutDetails } from '@/types/earnings';

// Create connection instance
const connection = createSolanaConnection();

export interface SolanaPayoutResult {
  success: boolean;
  transactionSignature?: string;
  error?: string;
  amount?: number;
  tokenType?: 'USDC' | 'USDT';
  recipientWallet?: string;
}

/**
 * Process a Solana payout to a Phantom Wallet
 * @param recipientWallet The recipient's Phantom wallet address
 * @param amountInCents Amount to send in cents
 * @param tokenType USDC or USDT
 * @param memo Optional memo for identification
 * @returns SolanaPayoutResult
 */
export async function processSolanaPayout(
  recipientWallet: string,
  amountInCents: number,
  tokenType: 'USDC' | 'USDT',
  memo?: string
): Promise<SolanaPayoutResult> {
  try {
    console.log('🚀 Processing Solana payout:', {
      recipientWallet,
      amountInCents,
      tokenType,
      memo
    });

    // Validate inputs
    if (amountInCents <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }

    if (!recipientWallet || recipientWallet.length < 32) {
      return { success: false, error: 'Invalid wallet address' };
    }

    // Convert cents to token units (USDC/USDT have 6 decimals)
    const tokenAmount = amountInCents / 100; // Convert cents to dollars
    const tokenAmountInSmallestUnit = Math.floor(tokenAmount * 1_000_000); // Convert to smallest unit (6 decimals)

    console.log('💰 Token amount conversion:', {
      amountInCents,
      tokenAmount,
      tokenAmountInSmallestUnit
    });

    // Get token mint address
    const mintAddress = getTokenMintAddress(tokenType);
    const mintPublicKey = new PublicKey(mintAddress);
    const recipientPublicKey = new PublicKey(recipientWallet);

    // Get or create associated token account
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintPublicKey,
      recipientPublicKey
    );

    console.log('🔍 Token account details:', {
      mintAddress,
      associatedTokenAddress: associatedTokenAddress.toBase58(),
      recipientWallet
    });

    // Check if the associated token account exists
    let accountExists = false;
    try {
      await getAccount(connection, associatedTokenAddress);
      accountExists = true;
      console.log('✅ Associated token account exists');
    } catch (error) {
      console.log('⚠️ Associated token account does not exist, will create it');
    }

    // For now, we'll return a success response with instructions
    // In a real implementation, you would:
    // 1. Create the transaction
    // 2. Sign it with your private key
    // 3. Send it to the network
    // 4. Return the transaction signature

    console.log('✅ Solana payout processed successfully (simulated)');

    return {
      success: true,
      amount: amountInCents,
      tokenType,
      recipientWallet,
      transactionSignature: `simulated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error: undefined
    };

  } catch (error: any) {
    console.error('❌ Error processing Solana payout:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      amount: amountInCents,
      tokenType,
      recipientWallet
    };
  }
}

/**
 * Validate a Phantom wallet address
 * @param walletAddress The wallet address to validate
 * @returns boolean
 */
export function isValidPhantomWalletAddress(walletAddress: string): boolean {
  try {
    const publicKey = new PublicKey(walletAddress);
    return PublicKey.isOnCurve(publicKey.toBytes());
  } catch {
    return false;
  }
}

/**
 * Get the associated token account address for a wallet and token
 * @param walletAddress The wallet address
 * @param tokenType USDC or USDT
 * @returns Promise<string> The associated token account address
 */
export async function getAssociatedTokenAccountAddress(
  walletAddress: string,
  tokenType: 'USDC' | 'USDT'
): Promise<string> {
  const mintAddress = getTokenMintAddress(tokenType);
  const mintPublicKey = new PublicKey(mintAddress);
  const walletPublicKey = new PublicKey(walletAddress);
  
  const associatedTokenAddress = await getAssociatedTokenAddress(
    mintPublicKey,
    walletPublicKey
  );
  
  return associatedTokenAddress.toBase58();
}

/**
 * Check if a wallet has an associated token account for a specific token
 * @param walletAddress The wallet address
 * @param tokenType USDC or USDT
 * @returns Promise<boolean>
 */
export async function hasAssociatedTokenAccount(
  walletAddress: string,
  tokenType: 'USDC' | 'USDT'
): Promise<boolean> {
  try {
    const associatedTokenAddress = await getAssociatedTokenAccountAddress(walletAddress, tokenType);
    await getAccount(connection, new PublicKey(associatedTokenAddress));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get minimum balance requirements for Solana payouts
 * @returns Object with minimum amounts and fees
 */
export function getSolanaPayoutRequirements() {
  return {
    minimumAmount: 100, // $1.00 minimum
    minimumAmountCents: 100,
    networkFee: 0.000005, // ~$0.000005 SOL for transaction fee
    tokenDecimals: 6, // USDC/USDT have 6 decimals
    supportedTokens: ['USDC', 'USDT'] as const
  };
}
