/**
 * Solana Utility Functions for Phantom Wallet Integration
 * Handles USDC/USDT payment processing on Solana blockchain
 */

import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  ConfirmedSignatureInfo,
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';

// =====================================================
// CONFIGURATION & CONSTANTS
// =====================================================

// Solana network configuration (devnet or mainnet-beta)
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';

// RPC endpoint
export const SOLANA_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT ||
  (SOLANA_NETWORK === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com');

// Helius API key for enhanced RPC (optional)
export const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

// Enhanced RPC endpoint if Helius is configured
export const getRpcEndpoint = () => {
  if (HELIUS_API_KEY) {
    return `https://rpc${SOLANA_NETWORK === 'devnet' ? '-devnet' : ''}.helius.xyz/?api-key=${HELIUS_API_KEY}`;
  }
  return SOLANA_RPC_ENDPOINT;
};

// Our Phantom wallet address for receiving payments
export const PHANTOM_WALLET_ADDRESS = process.env.PHANTOM_WALLET_ADDRESS || '';

// Token mint addresses
export const TOKEN_ADDRESSES = {
  USDC: {
    mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // USDC devnet
  },
  USDT: {
    mainnet: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    devnet: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // USDT devnet (actual)
  },
};

// Get token mint address based on network
export const getTokenMintAddress = (tokenType: 'USDC' | 'USDT'): string => {
  return TOKEN_ADDRESSES[tokenType][
    SOLANA_NETWORK === 'mainnet-beta' ? 'mainnet' : 'devnet'
  ];
};

// Payment request expiration time (24 hours)
export const PAYMENT_EXPIRATION_HOURS = 24;

// =====================================================
// TYPES
// =====================================================

export interface PaymentRequest {
  referenceId: string;
  amount: number; // Amount in cents
  tokenType: 'USDC' | 'USDT';
  memo: string;
  walletAddress: string;
  expiresAt: Date;
}

export interface ParsedMemo {
  username?: string;
  amount?: number;
  referenceId?: string;
  isValid: boolean;
}

export interface SolanaTransaction {
  signature: string;
  amount: number; // Amount in cents
  tokenType: 'USDC' | 'USDT';
  tokenMintAddress: string;
  fromWallet: string;
  toWallet: string;
  memo?: string;
  blockTime?: number;
  slot?: number;
  status: 'pending' | 'confirmed' | 'finalized';
}

// =====================================================
// CONNECTION & WALLET UTILITIES
// =====================================================

/**
 * Create Solana connection instance
 */
export const createSolanaConnection = (): Connection => {
  return new Connection(getRpcEndpoint(), 'confirmed');
};

/**
 * Validate wallet address format
 */
export const isValidWalletAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get associated token account address for a wallet and token mint
 */
export const getTokenAccountAddress = async (
  walletAddress: string,
  tokenMintAddress: string
): Promise<string> => {
  const walletPublicKey = new PublicKey(walletAddress);
  const tokenMintPublicKey = new PublicKey(tokenMintAddress);

  const associatedTokenAddress = await getAssociatedTokenAddress(
    tokenMintPublicKey,
    walletPublicKey
  );

  return associatedTokenAddress.toBase58();
};

// =====================================================
// REFERENCE ID & MEMO UTILITIES
// =====================================================

/**
 * Generate unique reference ID for payment request
 * Format: 8 character alphanumeric (e.g., "AB12CD34")
 */
export const generateReferenceId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Create memo string for payment
 * Format: "Username: [username] Amount: [amount] ReferenceID: [referenceId]"
 */
export const createPaymentMemo = (
  username: string,
  amount: number,
  referenceId: string
): string => {
  return `Username: ${username} Amount: ${amount} ReferenceID: ${referenceId}`;
};

/**
 * Parse memo from transaction
 * Extracts username, amount, and reference ID
 */
export const parseMemo = (memo: string): ParsedMemo => {
  const result: ParsedMemo = { isValid: false };

  try {
    // Parse format: "Username: [username] Amount: [amount] ReferenceID: [referenceId]"
    const usernameMatch = memo.match(/Username:\s*([^\s]+)/);
    const amountMatch = memo.match(/Amount:\s*([\d.]+)/);
    const referenceMatch = memo.match(/ReferenceID:\s*([A-Z0-9]+)/);

    if (usernameMatch) result.username = usernameMatch[1];
    if (amountMatch) result.amount = parseFloat(amountMatch[1]);
    if (referenceMatch) result.referenceId = referenceMatch[1];

    // Valid if all three fields are present
    result.isValid = !!(result.username && result.amount && result.referenceId);
  } catch (error) {
    console.error('Error parsing memo:', error);
  }

  return result;
};

// =====================================================
// TRANSACTION FETCHING & PARSING
// =====================================================

/**
 * Get recent transactions for a wallet address
 */
export const getRecentTransactions = async (
  walletAddress: string,
  limit: number = 10
): Promise<ConfirmedSignatureInfo[]> => {
  const connection = createSolanaConnection();
  const publicKey = new PublicKey(walletAddress);

  try {
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      limit,
    });
    return signatures;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

/**
 * Get parsed transaction details
 */
export const getParsedTransaction = async (
  signature: string
): Promise<ParsedTransactionWithMeta | null> => {
  const connection = createSolanaConnection();

  try {
    const transaction = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    return transaction;
  } catch (error) {
    console.error('Error fetching parsed transaction:', error);
    throw error;
  }
};

/**
 * Extract memo from transaction
 */
export const extractMemoFromTransaction = (
  transaction: ParsedTransactionWithMeta
): string | null => {
  try {
    const instructions = transaction.transaction.message.instructions;

    for (const instruction of instructions) {
      if ('parsed' in instruction) {
        // Skip parsed instructions
        continue;
      }

      // Check if this is a memo program instruction
      const programId = instruction.programId.toBase58();
      if (
        programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' || // Memo v1
        programId === 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo' // Memo v2
      ) {
        // Decode memo data
        const data = instruction.data;
        if (typeof data === 'string') {
          // Base58 encoded
          const decoded = bs58.decode(data);
          return Buffer.from(decoded).toString('utf8');
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting memo:', error);
    return null;
  }
};

/**
 * Extract SPL token transfer information from transaction
 */
export const extractTokenTransfer = (
  transaction: ParsedTransactionWithMeta,
  targetWallet: string,
  tokenType: 'USDC' | 'USDT'
): {
  amount: number; // Amount in token's smallest unit (lamports)
  fromWallet: string;
  toWallet: string;
  tokenMint: string;
} | null => {
  try {
    const instructions = transaction.transaction.message.instructions;
    const tokenMintAddress = getTokenMintAddress(tokenType);

    for (const instruction of instructions) {
      if (!('parsed' in instruction)) continue;

      const parsed = instruction.parsed;

      // Check for SPL token transfer
      if (
        parsed.type === 'transfer' ||
        parsed.type === 'transferChecked'
      ) {
        const info = parsed.info;

        // Verify it's the correct token mint
        if (info.mint && info.mint !== tokenMintAddress) {
          continue;
        }

        // Extract destination address (can be token account or wallet)
        const destination = info.destination;

        // Get amount (in token's smallest unit)
        const amount =
          parsed.type === 'transferChecked'
            ? parseInt(info.tokenAmount?.amount || '0', 10)
            : parseInt(info.amount || '0', 10);

        return {
          amount,
          fromWallet: info.source || info.authority || '',
          toWallet: destination || '',
          tokenMint: info.mint || tokenMintAddress,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting token transfer:', error);
    return null;
  }
};

/**
 * Convert token amount from lamports to dollars
 * USDC/USDT have 6 decimals
 */
export const lamportsToDollars = (lamports: number): number => {
  return lamports / 1_000_000; // 6 decimals
};

/**
 * Convert dollars to cents
 */
export const dollarsToCents = (dollars: number): number => {
  return Math.round(dollars * 100);
};

/**
 * Convert token lamports to cents
 */
export const lamportsToCents = (lamports: number): number => {
  return dollarsToCents(lamportsToDollars(lamports));
};

// =====================================================
// PAYMENT VERIFICATION
// =====================================================

/**
 * Verify a transaction matches a payment request
 */
export const verifyTransaction = async (
  signature: string,
  expectedWallet: string,
  expectedTokenType: 'USDC' | 'USDT',
  expectedReferenceId: string,
  expectedAmountCents: number
): Promise<{
  isValid: boolean;
  transaction?: SolanaTransaction;
  error?: string;
}> => {
  try {
    // Fetch transaction details
    const parsedTx = await getParsedTransaction(signature);

    if (!parsedTx) {
      return { isValid: false, error: 'Transaction not found' };
    }

    // Check if transaction succeeded
    if (parsedTx.meta?.err) {
      return { isValid: false, error: 'Transaction failed on blockchain' };
    }

    // Extract memo
    const memo = extractMemoFromTransaction(parsedTx);
    if (!memo) {
      return { isValid: false, error: 'No memo found in transaction' };
    }

    // Parse memo
    const parsedMemo = parseMemo(memo);
    if (!parsedMemo.isValid) {
      return { isValid: false, error: 'Invalid memo format' };
    }

    // Verify reference ID
    if (parsedMemo.referenceId !== expectedReferenceId) {
      return {
        isValid: false,
        error: `Reference ID mismatch. Expected: ${expectedReferenceId}, Got: ${parsedMemo.referenceId}`,
      };
    }

    // Extract token transfer
    const transfer = extractTokenTransfer(parsedTx, expectedWallet, expectedTokenType);
    if (!transfer) {
      return {
        isValid: false,
        error: `No ${expectedTokenType} transfer found in transaction`,
      };
    }

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
      tokenType: expectedTokenType,
      tokenMintAddress: transfer.tokenMint,
      fromWallet: transfer.fromWallet,
      toWallet: transfer.toWallet,
      memo,
      blockTime: parsedTx.blockTime || undefined,
      slot: parsedTx.slot,
      status,
    };

    return { isValid: true, transaction };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Monitor wallet for new transactions
 * Used by webhook/polling service
 */
export const monitorWalletForNewTransactions = async (
  walletAddress: string,
  lastProcessedSignature?: string
): Promise<ConfirmedSignatureInfo[]> => {
  const connection = createSolanaConnection();
  const publicKey = new PublicKey(walletAddress);

  try {
    const options = lastProcessedSignature
      ? { until: lastProcessedSignature }
      : { limit: 10 };

    const signatures = await connection.getSignaturesForAddress(
      publicKey,
      options
    );

    return signatures;
  } catch (error) {
    console.error('Error monitoring wallet:', error);
    throw error;
  }
};

// =====================================================
// WALLET VALIDATION
// =====================================================

/**
 * Check if Phantom wallet address is configured
 */
export const isWalletConfigured = (): boolean => {
  return !!PHANTOM_WALLET_ADDRESS && isValidWalletAddress(PHANTOM_WALLET_ADDRESS);
};

/**
 * Get wallet configuration status and info
 */
export const getWalletConfig = () => {
  return {
    isConfigured: isWalletConfigured(),
    walletAddress: PHANTOM_WALLET_ADDRESS,
    network: SOLANA_NETWORK,
    rpcEndpoint: getRpcEndpoint(),
    supportedTokens: ['USDC', 'USDT'],
  };
};

