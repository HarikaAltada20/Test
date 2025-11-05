/**
 * Simplified Solana Verification (No Memo Required)
 * Works with Phantom Wallet's limitations
 */

import {
  getParsedTransaction,
  lamportsToCents,
  PHANTOM_WALLET_ADDRESS,
  getTokenMintAddress,
  createSolanaConnection,
} from './solana-utils';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

import type { SolanaTransaction } from './solana-utils';

// Create connection instance
const connection = createSolanaConnection();

/**
 * Extract SPL token transfer with better wallet matching
 */
const extractTokenTransferRobust = async (
  transaction: any,
  targetWallet: string,
  tokenType: 'USDC' | 'USDT'
): Promise<{
  amount: number;
  fromWallet: string;
  toWallet: string;
  tokenMint: string;
} | null> => {
  try {
    const instructions = transaction.transaction.message.instructions;
    const tokenMintAddress = getTokenMintAddress(tokenType);
    
    // Get the associated token account for the target wallet
    const targetWalletPubkey = new PublicKey(targetWallet);
    const tokenMintPubkey = new PublicKey(tokenMintAddress);
    const associatedTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      targetWalletPubkey
    );
    const associatedTokenAccountStr = associatedTokenAccount.toBase58();

    console.log('🔍 Looking for token transfers:', {
      targetWallet,
      tokenMintAddress,
      associatedTokenAccount: associatedTokenAccountStr,
      instructionCount: instructions.length
    });

    for (const instruction of instructions) {
      if (!('parsed' in instruction)) continue;

      const parsed = instruction.parsed;
      console.log('📋 Checking instruction:', parsed.type, parsed.info);

      // Check for SPL token transfer
      if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
        const info = parsed.info;
        console.log('💰 Found token transfer:', {
          type: parsed.type,
          mint: info.mint,
          source: info.source,
          destination: info.destination,
          amount: info.amount || info.tokenAmount?.amount
        });

        // Verify it's a supported token mint (USDC or USDT)
        const expectedUSDC = getTokenMintAddress('USDC');
        const expectedUSDT = getTokenMintAddress('USDT');
        
        // Check for exact matches first
        const isUSDC = info.mint === expectedUSDC;
        const isUSDT = info.mint === expectedUSDT;
        
        // If not exact match, check if it's a test token that might be used as USDC
        let actualTokenType: 'USDC' | 'USDT';
        if (isUSDC) {
          actualTokenType = 'USDC';
        } else if (isUSDT) {
          actualTokenType = 'USDT';
        } else {
          // Check if it's a test token that might be used as USDC
          // Some test environments use USDT mint as USDC test token
          if (info.mint === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
            // This is the USDT devnet mint, but might be used as USDC test
            actualTokenType = 'USDC'; // Treat as USDC for test purposes
            console.log('⚠️  Using USDT devnet mint as USDC test token');
          } else {
            console.log('❌ Unsupported token mint:', info.mint, 'expected USDC or USDT');
            console.log('Expected USDC:', expectedUSDC);
            console.log('Expected USDT:', expectedUSDT);
            continue;
          }
        }

        console.log('✅ Found supported token:', actualTokenType, 'mint:', info.mint);

        // Check if destination matches our wallet or associated token account
        const destination = info.destination;
        
        // Check if destination is our wallet directly or our associated token account
        let isValidDestination = destination === targetWallet || destination === associatedTokenAccountStr;
        
        // If not a direct match, check if the destination is an ATA owned by our wallet
        if (!isValidDestination) {
          try {
            const destinationPubkey = new PublicKey(destination);
            const accountInfo = await connection.getAccountInfo(destinationPubkey);
            if (!accountInfo) {
              throw new Error('Token account not found');
            }
            const owner = new PublicKey(accountInfo.data.slice(32, 64));
            isValidDestination = owner?.equals(new PublicKey(targetWallet)) || false;
            
            if (isValidDestination) {
              console.log('✅ Destination ATA is owned by target wallet:', {
                destination,
                owner: owner.toBase58(),
                targetWallet
              });
            } else {
              console.log('❌ Destination ATA owner mismatch:', {
                destination,
                owner: owner?.toBase58(),
                targetWallet
              });
            }
          } catch (error) {
            console.log('⚠️  Could not verify ATA owner, treating as invalid:', error instanceof Error ? error.message : 'Unknown error');
            isValidDestination = false;
          }
        }
        
        if (isValidDestination) {
          const amount = parsed.type === 'transferChecked'
            ? parseInt(info.tokenAmount?.amount || '0', 10)
            : parseInt(info.amount || '0', 10);

        console.log('✅ Found matching transfer:', {
          amount,
          fromWallet: info.source || info.authority || '',
          toWallet: destination,
          tokenMint: info.mint || tokenMintAddress,
          targetWallet: targetWallet,
          associatedTokenAccount: associatedTokenAccountStr,
          destinationMatch: destination === targetWallet ? 'exact' : 
                           destination === associatedTokenAccountStr ? 'ata' : 'ata_owned'
        });

          return {
            amount,
            fromWallet: info.source || info.authority || '',
            toWallet: destination,
            tokenMint: info.mint || tokenMintAddress,
          };
        } else {
          console.log('❌ Destination mismatch:', {
            destination,
            targetWallet,
            associatedTokenAccount: associatedTokenAccountStr
          });
        }
      }
    }

    console.log('❌ No matching token transfer found');
    return null;
  } catch (error) {
    console.error('Error extracting token transfer:', error);
    return null;
  }
};

/**
 * Verify transaction without memo (Phantom-friendly)
 * Matches based on: amount, token type, destination wallet, and timing
 */
export const verifyTransactionSimple = async (
  signature: string,
  expectedWallet: string,
  expectedTokenType: 'USDC' | 'USDT',
  expectedAmountCents: number,
  paymentRequestCreatedAt: Date
): Promise<{
  isValid: boolean;
  transaction?: SolanaTransaction;
  error?: string;
}> => {
  try {
    console.log('🔍 Verifying transaction:', {
      signature,
      expectedWallet,
      expectedTokenType,
      expectedAmountCents,
      requestCreatedAt: paymentRequestCreatedAt.toISOString()
    });

    // Fetch transaction details
    const parsedTx = await getParsedTransaction(signature);

    if (!parsedTx) {
      return { isValid: false, error: 'Transaction not found on blockchain' };
    }

    console.log('📊 Transaction found:', {
      blockTime: parsedTx.blockTime,
      slot: parsedTx.slot,
      instructionCount: parsedTx.transaction.message.instructions.length,
      hasError: !!parsedTx.meta?.err
    });

    // Check if transaction succeeded
    if (parsedTx.meta?.err) {
      return { isValid: false, error: 'Transaction failed on blockchain' };
    }

    // Check transaction timing (must be after payment request created)
    const txTime = parsedTx.blockTime;
    if (txTime) {
      const txDate = new Date(txTime * 1000);
      if (txDate < paymentRequestCreatedAt) {
        return {
          isValid: false,
          error: 'Transaction occurred before payment request was created',
        };
      }
    }

    // Extract token transfer (accept both USDC and USDT)
    const transfer = await extractTokenTransferRobust(parsedTx, expectedWallet, expectedTokenType);
    if (!transfer) {
      return {
        isValid: false,
        error: `No USDC or USDT transfer found to the specified wallet`,
      };
    }

    // Verify destination wallet and token type
    const expectedUSDC = getTokenMintAddress('USDC');
    const expectedUSDT = getTokenMintAddress('USDT');
    
    // Check for exact matches first
    const isUSDC = transfer.tokenMint === expectedUSDC;
    const isUSDT = transfer.tokenMint === expectedUSDT;
    
    // Determine the actual token type received
    let actualTokenType: 'USDC' | 'USDT';
    if (isUSDC) {
      actualTokenType = 'USDC';
    } else if (isUSDT) {
      actualTokenType = 'USDT';
    } else {
      // Check if it's a test token that might be used as USDC
      if (transfer.tokenMint === 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') {
        // This is the USDT devnet mint, but might be used as USDC test
        actualTokenType = 'USDC'; // Treat as USDC for test purposes
        console.log('⚠️  Using USDT devnet mint as USDC test token');
      } else {
        return {
          isValid: false,
          error: `Unsupported token type. Expected USDC or USDT, got mint: ${transfer.tokenMint}`,
        };
      }
    }

    console.log('✅ Token type verified:', actualTokenType, 'mint:', transfer.tokenMint);

    // Convert amount to cents
    const amountCents = lamportsToCents(transfer.amount);

    // Verify amount (allow 1 cent tolerance for rounding)
    if (Math.abs(amountCents - expectedAmountCents) > 1) {
      return {
        isValid: false,
        error: `Amount mismatch. Expected: $${(expectedAmountCents / 100).toFixed(2)}, Got: $${(amountCents / 100).toFixed(2)}`,
      };
    }

    // Get transaction status
    const status = parsedTx.meta?.err ? 'pending' : 'confirmed';

    // Build transaction object
    const transaction: SolanaTransaction = {
      signature,
      amount: amountCents,
      tokenType: actualTokenType, // Use the actual token type received
      tokenMintAddress: transfer.tokenMint,
      fromWallet: transfer.fromWallet,
      toWallet: transfer.toWallet,
      memo: undefined, // No memo required
      blockTime: parsedTx.blockTime || undefined,
      slot: parsedTx.slot,
      status,
    };

    return { isValid: true, transaction };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Debug function to analyze a transaction signature
 * This helps troubleshoot why verification might fail
 */
export const debugTransaction = async (signature: string): Promise<void> => {
  try {
    console.log('🔍 Debugging transaction:', signature);
    
    const parsedTx = await getParsedTransaction(signature);
    if (!parsedTx) {
      console.log('❌ Transaction not found');
      return;
    }

    console.log('📊 Transaction details:', {
      signature,
      blockTime: parsedTx.blockTime,
      slot: parsedTx.slot,
      hasError: !!parsedTx.meta?.err,
      instructionCount: parsedTx.transaction.message.instructions.length
    });

    console.log('📋 All instructions:');
    parsedTx.transaction.message.instructions.forEach((instruction, index) => {
      console.log(`  ${index + 1}. Program: ${instruction.programId.toBase58()}`);
      if ('parsed' in instruction) {
        console.log(`     Type: ${instruction.parsed.type}`);
        console.log(`     Info:`, JSON.stringify(instruction.parsed.info, null, 2));
      } else {
        console.log(`     Raw instruction`);
      }
    });

    // Check for token transfers
    console.log('💰 Token transfers found:');
    for (const instruction of parsedTx.transaction.message.instructions) {
      if ('parsed' in instruction) {
        const parsed = instruction.parsed;
        if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
          console.log('  ✅ Token transfer:', {
            type: parsed.type,
            mint: parsed.info.mint,
            source: parsed.info.source,
            destination: parsed.info.destination,
            amount: parsed.info.amount || parsed.info.tokenAmount?.amount
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
};

