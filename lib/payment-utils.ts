import { createClient as createServerClient } from '@/utils/supabase/server';
import { stripe, formatAmountForStripe, formatAmountFromStripe } from './stripe';

// Types for payment operations
export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}

export interface DepositBalanceResponse {
  success: boolean;
  balance: number;
  error?: string;
}

export interface PaymentProcessingResult {
  success: boolean;
  paymentMethod: 'wallet' | 'stripe' | 'split';
  amountFromWallet?: number;
  amountFromStripe?: number;
  paymentIntent?: PaymentIntent;
  transactionId?: string;
  error?: string;
}

export interface PaymentDetails {
  first_payment_at: string;
  last_updated: string;
  payment_status: 'pending' | 'completed' | 'failed';
  total_prize_pool: number;
  commission_amount: number;
  total_amount_paid: number;
  commission_percentage: number;
  payment_intent_ids: (string | null)[];
  stripe_amounts_paid: number[];
  wallet_amounts_used: number[];
  amount_changes: number[];
  change_history: string[];
  original_wallet_balance?: number; // For atomic split payment rollback
  wallet_deduction_pending?: boolean; // Flag for pending wallet deduction in split payments
}

// Server-only client getter
async function getSupabaseClient() {
  return await createServerClient();
}

// Get advertiser's current deposit balance
export async function getAdvertiserDepositBalance(userId: string): Promise<DepositBalanceResponse> {
  try {
    const supabase = await getSupabaseClient();
    
    const { data, error } = await supabase
      .from('advertiser_profiles')
      .select('available_deposit_balance')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching deposit balance:', error);
      return { success: false, balance: 0, error: error.message };
    }

    return { 
      success: true, 
      balance: data?.available_deposit_balance || 0  // Already in cents from database
    };
  } catch (error) {
    console.error('Error in getAdvertiserDepositBalance:', error);
    return { success: false, balance: 0, error: 'Unknown error occurred' };
  }
}

// Add funds to advertiser's deposit balance (amount in cents)
export async function addToDepositBalance(
  userId: string, 
  amountInCents: number, 
  paymentIntentId: string
): Promise<DepositBalanceResponse> {
  try {
    const supabase = await getSupabaseClient();
    
    // Get current balance (in cents)
    const currentBalance = await getAdvertiserDepositBalance(userId);
    if (!currentBalance.success) {
      return currentBalance;
    }

    // Add deposit amount to balance (both in cents)
    const newBalance = (currentBalance.balance || 0) + amountInCents;
    const { data, error } = await supabase
      .from('advertiser_profiles')
      .update({ available_deposit_balance: newBalance })
      .eq('id', userId)
      .select('available_deposit_balance')
      .single();

    if (error) {
      console.error('Error adding to deposit balance:', error);
      return { success: false, balance: currentBalance.balance, error: error.message };
    }

    // Create meaningful deposit description
    const depositDescription = `Wallet top-up via Stripe payment`;
    const depositRemarks = `Deposit added to wallet balance`;

    // Log the deposit transaction in cents
    await logTransaction(
      userId, 
      'deposit', 
      amountInCents, 
      'success', 
      depositDescription,
      paymentIntentId,
      depositRemarks,
      'stripe'
    );

    return { 
      success: true, 
      balance: data?.available_deposit_balance || 0  // Already in cents from database
    };
  } catch (error) {
    console.error('Error in addToDepositBalance:', error);
    return { success: false, balance: 0, error: 'Unknown error occurred' };
  }
}

// Deduct from advertiser's deposit balance (amount in cents)
export async function deductFromDepositBalance(
  userId: string, 
  amountInCents: number, 
  description: string,
  paymentMethod: 'wallet' | 'split' = 'wallet' // NEW: Specify if this is wallet-only or part of split
): Promise<DepositBalanceResponse> {
  try {
    const supabase = await getSupabaseClient();
    
    // Check current balance first (both in cents)
    const currentBalance = await getAdvertiserDepositBalance(userId);
    if (!currentBalance.success) {
      return { 
        success: false, 
        balance: currentBalance.balance, 
        error: 'Failed to check wallet balance' 
      };
    }
    
    if (currentBalance.balance < amountInCents) {
      console.error(`❌ INSUFFICIENT BALANCE: Attempted to deduct ${amountInCents} cents from ${currentBalance.balance} cents`);
      return { 
        success: false, 
        balance: currentBalance.balance, 
        error: `Insufficient balance. Required: $${(amountInCents/100).toFixed(2)}, Available: $${(currentBalance.balance/100).toFixed(2)}` 
      };
    }

    // Update the deposit balance (both amounts in cents)
    const newBalance = currentBalance.balance - amountInCents;
    
    // CRITICAL SAFETY CHECK: Prevent negative balances at database level
    if (newBalance < 0) {
      console.error(`🚨 CRITICAL: Attempted to create negative balance! Current: ${currentBalance.balance}, Deducting: ${amountInCents}, Result: ${newBalance}`);
      return { 
        success: false, 
        balance: currentBalance.balance, 
        error: `Operation would create negative balance. Available: $${(currentBalance.balance/100).toFixed(2)}, Required: $${(amountInCents/100).toFixed(2)}` 
      };
    }
    
    const { data, error } = await supabase
      .from('advertiser_profiles')
      .update({ available_deposit_balance: newBalance })
      .eq('id', userId)
      .select('available_deposit_balance')
      .single();

    if (error) {
      console.error('Error deducting from deposit balance:', error);
      return { success: false, balance: currentBalance.balance, error: error.message };
    }

    // Create meaningful description and remarks based on payment method
    let enhancedDescription = description;
    let remarks = '';
    
    if (paymentMethod === 'wallet') {
      enhancedDescription = `${description} (Wallet Payment)`;
      remarks = 'Paid from wallet balance';
    } else if (paymentMethod === 'split') {
      enhancedDescription = `${description} (Wallet Portion)`;
      remarks = 'Wallet portion of split payment';
    }

    // Log the transaction in cents with payment method
    console.log(`📝 Logging wallet transaction: ${amountInCents} cents for user ${userId}`);
    const logResult = await logTransaction(
      userId, 
      'contest_payment', 
      amountInCents, 
      'success', 
      enhancedDescription,
      undefined, // No payment intent for wallet transactions
      remarks,
      paymentMethod
    );
    
    if (!logResult) {
      console.error(`❌ CRITICAL: Failed to log wallet transaction for user ${userId}, amount: ${amountInCents} cents`);
    } else {
      console.log(`✅ Wallet transaction logged successfully for user ${userId}`);
    }

    return { 
      success: true, 
      balance: data?.available_deposit_balance || 0  // Already in cents from database
    };
  } catch (error) {
    console.error('Error in deductFromDepositBalance:', error);
    return { success: false, balance: 0, error: 'Unknown error occurred' };
  }
}

// Create Stripe payment intent for wallet top-up
export async function createTopUpPaymentIntent(
  userId: string, 
  amount: number
): Promise<PaymentIntent | null> {
  try {
    console.log('💳 Creating payment intent with:', { userId, amount });
    
    const paymentIntent = await stripe().paymentIntents.create({
      amount: formatAmountForStripe(amount),
      currency: 'usd',
      metadata: {
        userId,
        type: 'wallet_topup',
        amount: amount.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('✅ Payment intent created with metadata:', paymentIntent.metadata);

    return {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret!,
      amount: formatAmountFromStripe(paymentIntent.amount),
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return null;
  }
}

// Create Stripe payment intent for contest payment
export async function createContestPaymentIntent(
  userId: string, 
  contestId: string,
  amount: number,
  description: string,
  paymentMethod: 'stripe' | 'split' = 'stripe', // NEW: Specify if this is Stripe-only or part of split
  walletAmount?: number, // NEW: Wallet amount for split payments (in cents)
  totalAmount?: number, // NEW: Total amount for split payments (in cents)
  originalWalletBalance?: number // NEW: Original wallet balance for atomic rollback
): Promise<PaymentIntent | null> {
  try {
    // Build metadata object
    const metadata: any = {
      userId,
      contestId,
      type: paymentMethod === 'split' ? 'contest_payment_split' : 'contest_payment',
      amount: amount.toString(),
      description,
      paymentMethod, // NEW: Include payment method in metadata
    };

    // Add split payment specific metadata for atomic transactions
    if (paymentMethod === 'split' && walletAmount !== undefined && totalAmount !== undefined) {
      metadata.walletAmount = (walletAmount / 100).toString(); // Store in dollars for webhook
      metadata.totalAmount = (totalAmount / 100).toString(); // Store in dollars for webhook
      metadata.originalWalletBalance = originalWalletBalance?.toString() || '0'; // Store in cents
    }

    const paymentIntent = await stripe().paymentIntents.create({
      amount: formatAmountForStripe(amount),
      currency: 'usd',
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create meaningful description and remarks based on payment method
    let enhancedDescription = description;
    let remarks = '';
    
    if (paymentMethod === 'stripe') {
      enhancedDescription = `${description} (Stripe Payment)`;
      remarks = 'Stripe payment processing';
    } else if (paymentMethod === 'split') {
      enhancedDescription = `${description} (Stripe Portion)`;
      remarks = 'Stripe portion of split payment';
    }

    // Log initial pending transaction for the Stripe portion
    // This ensures split payments show as two separate transactions
    await logTransaction(
      userId,
      'contest_payment',
      amount, // amount is already in cents
      'pending',
      enhancedDescription,
      paymentIntent.id, // Link to payment intent for webhook updates
      remarks,
      paymentMethod
    );

    return {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret!,
      amount: formatAmountFromStripe(paymentIntent.amount),
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error('Error creating contest payment intent:', error);
    return null;
  }
}

// Process payment for contest (wallet, Stripe, or split)
export async function processContestPayment(
  userId: string,
  contestId: string,
  totalAmount: number,
  description: string,
  useWalletFirst: boolean = true
): Promise<PaymentProcessingResult> {
  try {
    const currentBalance = await getAdvertiserDepositBalance(userId);
    
    if (!currentBalance.success) {
      return {
        success: false,
        paymentMethod: 'wallet',
        error: 'Failed to check wallet balance'
      };
    }

    // Case 1: Sufficient wallet balance
    if (useWalletFirst && currentBalance.balance >= totalAmount) {
      const deductResult = await deductFromDepositBalance(userId, totalAmount, description);
      
      if (deductResult.success) {
        return {
          success: true,
          paymentMethod: 'wallet',
          amountFromWallet: totalAmount,
          amountFromStripe: 0
        };
      } else {
        return {
          success: false,
          paymentMethod: 'wallet',
          error: deductResult.error
        };
      }
    }

    // Case 2: Insufficient wallet balance - need Stripe
    const walletAmount = useWalletFirst ? currentBalance.balance : 0;
    const stripeAmount = totalAmount - walletAmount;

    // Create Stripe payment intent for the remaining amount
    const paymentIntent = await createContestPaymentIntent(
      userId, 
      contestId, 
      stripeAmount, 
      description
    );

    if (!paymentIntent) {
      return {
        success: false,
        paymentMethod: 'stripe',
        error: 'Failed to create payment intent'
      };
    }

    // If using wallet for partial payment, deduct wallet amount first
    if (walletAmount > 0) {
      const deductResult = await deductFromDepositBalance(userId, walletAmount, description);
      
      if (!deductResult.success) {
        return {
          success: false,
          paymentMethod: 'split',
          error: 'Failed to deduct from wallet for split payment'
        };
      }

      return {
        success: true,
        paymentMethod: 'split',
        amountFromWallet: walletAmount,
        amountFromStripe: stripeAmount,
        paymentIntent
      };
    }

    // Full Stripe payment
    return {
      success: true,
      paymentMethod: 'stripe',
      amountFromWallet: 0,
      amountFromStripe: stripeAmount,
      paymentIntent
    };

  } catch (error) {
    console.error('Error in processContestPayment:', error);
    return {
      success: false,
      paymentMethod: 'wallet',
      error: 'Unknown error occurred'
    };
  }
}

// Refund contest payment back to deposit balance (amount in cents)
export async function refundContestPayment(
  userId: string,
  amountInCents: number,
  contestId: string,
  reason: string = 'Contest cancelled'
): Promise<DepositBalanceResponse> {
  try {
    const supabase = await getSupabaseClient();
    
    // Get current balance (in cents)
    const currentBalance = await getAdvertiserDepositBalance(userId);
    if (!currentBalance.success) {
      return currentBalance;
    }

    // Add refund amount to deposit balance (both in cents)
    const newBalance = (currentBalance.balance || 0) + amountInCents;
    const { data, error } = await supabase
      .from('advertiser_profiles')
      .update({ available_deposit_balance: newBalance })
      .eq('id', userId)
      .select('available_deposit_balance')
      .single();

    if (error) {
      console.error('Error processing refund:', error);
      return { success: false, balance: currentBalance.balance, error: error.message };
    }

    // Create meaningful refund description
    const refundDescription = `${reason} - Contest ID: ${contestId}`;
    const refundRemarks = `Refund processed to wallet balance`;

    // Log the refund transaction in cents
    await logTransaction(
      userId, 
      'refund', 
      amountInCents, 
      'success', 
      refundDescription,
      undefined, // No payment intent for refunds
      refundRemarks,
      'refund'
    );

    return { 
      success: true, 
      balance: data?.available_deposit_balance || 0  // Already in cents from database
    };
  } catch (error) {
    console.error('Error in refundContestPayment:', error);
    return { success: false, balance: 0, error: 'Unknown error occurred' };
  }
}

// Enhanced transaction logging with payment method and meaningful descriptions
export async function logTransaction(
  userId: string,
  type: 'deposit' | 'contest_payment' | 'refund' | 'withdrawal',
  amountInCents: number,
  status: 'pending' | 'success' | 'failed',
  description: string,
  paymentIntentId?: string, // Optional payment intent ID for fast lookups
  remarks?: string, // User-friendly status message
  paymentMethod?: 'wallet' | 'stripe' | 'split' | 'refund' // NEW: Payment method for clarity
): Promise<boolean> {
  try {
    console.log('📝 Logging transaction:', {
      userId,
      type,
      amountInCents,
      status,
      paymentIntentId,
      paymentMethod,
      remarks,
      description: description.substring(0, 100) + '...' // Truncate for readability
    });

    const supabase = await getSupabaseClient();
    
    const transactionData = {
      user_id: userId,
      type,
      status,
      amount: amountInCents, // Store in cents (consistent with system)
      description,
      payment_intent_id: paymentIntentId, // Store for lightning-fast lookups
      payment_method: paymentMethod, // NEW: Store payment method for clarity
      remarks, // User-friendly message
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('💾 Inserting transaction data:', transactionData);

    const { data, error } = await supabase
      .from('money_transactions')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error logging transaction:', error);
      console.error('Transaction data that failed:', transactionData);
      return false;
    }

    console.log('✅ Transaction logged successfully:', {
      id: data?.id,
      type: data?.type,
      amount: data?.amount,
      payment_method: data?.payment_method,
      payment_intent_id: data?.payment_intent_id,
      remarks: data?.remarks,
      description: data?.description?.substring(0, 50) + '...'
    });

    return true;
  } catch (error) {
    console.error('❌ Error in logTransaction:', error);
    return false;
  }
}

// 🚀 OPTIMIZED: Get pending transaction by payment intent (lightning fast)
export async function getPendingTransactionByPaymentIntent(
  paymentIntentId: string
): Promise<any | null> {
  try {
    console.log(`🚀 FAST LOOKUP: Getting pending transaction for payment intent: ${paymentIntentId}`);
    
    const supabase = await getSupabaseClient();
    
    // Use optimized database function for sub-millisecond lookups
    const { data, error } = await supabase
      .rpc('get_pending_transaction_by_payment_intent_fast', {
        p_payment_intent_id: paymentIntentId
      });

    if (error) {
      console.error('❌ Error in optimized transaction lookup:', error);
      return null;
    }

    if (data && data.length > 0) {
      console.log(`✅ FAST LOOKUP SUCCESS: Found transaction for payment intent: ${paymentIntentId}`);
      return data[0];
    } else {
      console.log(`❌ No pending transaction found for payment intent: ${paymentIntentId}`);
      return null;
    }

  } catch (error) {
    console.error('❌ Error in getPendingTransactionByPaymentIntent:', error);
    return null;
  }
}

// 🚀 OPTIMIZED: Ultra-fast transaction status update using indexed payment_intent_id
export async function updateTransactionStatus(
  paymentIntentId: string,
  status: 'success' | 'failed',
  newDescription?: string,
  remarks?: string
): Promise<boolean> {
  try {
    console.log(`🚀 FAST UPDATE: Updating transaction for payment intent: ${paymentIntentId}`);
    
    const supabase = await getSupabaseClient();
    
    // Use optimized database function for lightning-fast updates
    const { data, error } = await supabase
      .rpc('update_transaction_status_by_payment_intent_fast', {
        p_payment_intent_id: paymentIntentId,
        p_new_status: status,
        p_new_description: newDescription,
        p_remarks: remarks
      });

    if (error) {
      console.error('❌ Error in optimized transaction update:', error);
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }

    if (data === true) {
      console.log(`✅ FAST UPDATE SUCCESS: Transaction updated to ${status} for payment intent: ${paymentIntentId}`);
      return true;
    } else {
      console.log(`❌ No pending transaction found for payment intent: ${paymentIntentId}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Error in updateTransactionStatus:', error);
    throw error; // Re-throw to ensure failures are not silently ignored
  }
}

// 🚀 NEW: Create initial payment details for a contest
export function createInitialPaymentDetails(
  prizePoolInCents: number,
  commissionPercentage: number,
  walletAmount: number = 0,
  stripeAmount: number = 0,
  paymentIntentId: string | null = null
): PaymentDetails {
  const commissionAmount = Math.round(prizePoolInCents * (commissionPercentage / 100));
  const totalAmount = prizePoolInCents + commissionAmount;
  const now = new Date().toISOString();

  return {
    first_payment_at: now,
    last_updated: now,
    payment_status: 'pending',
    total_prize_pool: prizePoolInCents,
    commission_amount: commissionAmount,
    total_amount_paid: totalAmount,
    commission_percentage: commissionPercentage,
    payment_intent_ids: [paymentIntentId],
    stripe_amounts_paid: [stripeAmount],
    wallet_amounts_used: [walletAmount],
    amount_changes: [totalAmount],
    change_history: ['initial_payment']
  };
}

// 🚀 NEW: Add a budget change to existing payment details
export function addBudgetChangeToPaymentDetails(
  currentPaymentDetails: PaymentDetails,
  prizePoolChangeInCents: number,
  changeType: 'increase' | 'decrease',
  walletAmount: number = 0,
  stripeAmount: number = 0,
  paymentIntentId: string | null = null
): PaymentDetails {
  const commissionOnChange = Math.round(Math.abs(prizePoolChangeInCents) * (currentPaymentDetails.commission_percentage / 100));
  const totalChangeAmount = prizePoolChangeInCents + (prizePoolChangeInCents >= 0 ? commissionOnChange : -commissionOnChange);

  const newPrizePool = currentPaymentDetails.total_prize_pool + prizePoolChangeInCents;
  const newCommissionAmount = Math.round(newPrizePool * (currentPaymentDetails.commission_percentage / 100));
  const newTotalPaid = currentPaymentDetails.total_amount_paid + totalChangeAmount;

  return {
    ...currentPaymentDetails,
    last_updated: new Date().toISOString(),
    total_prize_pool: newPrizePool,
    commission_amount: newCommissionAmount,
    total_amount_paid: newTotalPaid,
    payment_intent_ids: [...currentPaymentDetails.payment_intent_ids, paymentIntentId],
    stripe_amounts_paid: [...currentPaymentDetails.stripe_amounts_paid, stripeAmount],
    wallet_amounts_used: [...currentPaymentDetails.wallet_amounts_used, walletAmount],
    amount_changes: [...currentPaymentDetails.amount_changes, totalChangeAmount],
    change_history: [...currentPaymentDetails.change_history, changeType]
  };
}

// 🚀 NEW: Mark payment as completed
export function markPaymentAsCompleted(paymentDetails: PaymentDetails): PaymentDetails {
  return {
    ...paymentDetails,
    last_updated: new Date().toISOString(),
    payment_status: 'completed'
  };
}

// 🚀 NEW: Enhanced contest payment processing with new schema
export async function processContestPaymentV2(
  userId: string,
  contestId: string,
  prizePoolInCents: number,
  commissionPercentage: number,
  description: string,
  useWalletFirst: boolean = true,
  existingPaymentDetails?: PaymentDetails,
  changeType?: 'increase' | 'decrease'
): Promise<PaymentProcessingResult & { paymentDetails?: PaymentDetails }> {
  try {
    const totalAmount = prizePoolInCents + Math.round(prizePoolInCents * (commissionPercentage / 100));
    
    const currentBalance = await getAdvertiserDepositBalance(userId);
    
    if (!currentBalance.success) {
      return {
        success: false,
        paymentMethod: 'wallet',
        error: 'Failed to check wallet balance'
      };
    }

    let walletAmount = 0;
    let stripeAmount = 0;
    let paymentIntent: PaymentIntent | null = null;

    // Determine payment split
    if (useWalletFirst && currentBalance.balance >= totalAmount) {
      // Full wallet payment
      walletAmount = totalAmount;
      stripeAmount = 0;
    } else if (useWalletFirst && currentBalance.balance > 0) {
      // Split payment
      walletAmount = currentBalance.balance;
      stripeAmount = totalAmount - walletAmount;
    } else {
      // Full Stripe payment
      walletAmount = 0;
      stripeAmount = totalAmount;
    }

    // Create Stripe payment intent if needed
    if (stripeAmount > 0) {
      const stripePaymentMethod = walletAmount > 0 ? 'split' : 'stripe';
      
      // For split payments, pass additional metadata for atomic transactions
      if (stripePaymentMethod === 'split') {
        paymentIntent = await createContestPaymentIntent(
          userId, 
          contestId, 
          stripeAmount, 
          description,
          stripePaymentMethod,
          walletAmount, // Pass wallet amount for atomic transaction
          totalAmount, // Pass total amount for atomic transaction
          currentBalance.balance // Pass original balance for rollback capability
        );
      } else {
        paymentIntent = await createContestPaymentIntent(
          userId, 
          contestId, 
          stripeAmount, 
          description,
          stripePaymentMethod
        );
      }

      if (!paymentIntent) {
        return {
          success: false,
          paymentMethod: 'stripe',
          error: 'Failed to create payment intent'
        };
      }
    }

    // Process wallet payment if needed
    if (walletAmount > 0) {
      const walletPaymentMethod = stripeAmount > 0 ? 'split' : 'wallet';
      
      // FOR ATOMIC TRANSACTIONS: Only deduct wallet immediately for wallet-only payments
      // For split payments, defer wallet deduction until Stripe payment succeeds (handled in webhook)
      if (walletPaymentMethod === 'wallet') {
        // Wallet-only payment - safe to deduct immediately
        console.log(`💰 Processing wallet-only payment: ${walletAmount} cents`);
        const deductResult = await deductFromDepositBalance(
          userId, 
          walletAmount, 
          description,
          walletPaymentMethod
        );
        
        if (!deductResult.success) {
          console.error(`❌ Wallet deduction failed: ${deductResult.error}`);
          return {
            success: false,
            paymentMethod: 'wallet',
            error: deductResult.error || 'Failed to deduct from wallet'
          };
        }
        console.log(`✅ Wallet deduction successful. New balance: ${deductResult.balance} cents`);
      } else {
        // Split payment - defer to webhook
        console.log(`⏳ Split payment detected: Wallet ${walletAmount} cents will be deducted after Stripe success`);
      }
      // NOTE: For split payments, wallet deduction is deferred to webhook after Stripe success
    }

    // Create or update payment details
    let paymentDetails: PaymentDetails;
    const isWalletOnly = walletAmount > 0 && stripeAmount === 0;
    const isSplit = walletAmount > 0 && stripeAmount > 0;
    
    if (existingPaymentDetails && changeType) {
      // This is a budget change
      const prizePoolChange = changeType === 'increase' ? prizePoolInCents : -prizePoolInCents;
      paymentDetails = addBudgetChangeToPaymentDetails(
        existingPaymentDetails,
        prizePoolChange,
        changeType,
        isWalletOnly ? walletAmount : 0, // Only record wallet amount if already deducted
        stripeAmount,
        paymentIntent?.id || null
      );
      
      // CRITICAL: For split payment budget changes, also store atomic transaction metadata
      if (isSplit) {
        paymentDetails.original_wallet_balance = currentBalance.balance;
        paymentDetails.wallet_deduction_pending = true;
      }
    } else {
      // This is initial payment
      paymentDetails = createInitialPaymentDetails(
        prizePoolInCents,
        commissionPercentage,
        isWalletOnly ? walletAmount : 0, // Only record wallet amount if already deducted
        stripeAmount,
        paymentIntent?.id || null
      );
      
      // For split payments, store metadata for atomic transaction
      if (isSplit) {
        paymentDetails.original_wallet_balance = currentBalance.balance;
        paymentDetails.wallet_deduction_pending = true;
      }
    }

    // If no Stripe payment needed, mark as completed immediately
    if (stripeAmount === 0) {
      paymentDetails = markPaymentAsCompleted(paymentDetails);
    }

    const paymentMethod = walletAmount > 0 && stripeAmount > 0 ? 'split' :
                         walletAmount > 0 ? 'wallet' : 'stripe';

    return {
      success: true,
      paymentMethod,
      amountFromWallet: isWalletOnly ? walletAmount : 0, // Only report deducted amounts
      amountFromStripe: stripeAmount,
      paymentIntent: paymentIntent || undefined,
      paymentDetails
    };

  } catch (error) {
    console.error('Error in processContestPaymentV2:', error);
    return {
      success: false,
      paymentMethod: 'wallet',
      error: 'Unknown error occurred'
    };
  }
}

// 🚀 NEW: Enhanced refund with payment details update
export async function refundContestPaymentV2(
  userId: string,
  contestId: string,
  refundAmountInCents: number,
  currentPaymentDetails: PaymentDetails,
  reason: string = 'Contest budget decreased'
): Promise<DepositBalanceResponse & { paymentDetails?: PaymentDetails }> {
  try {
    const supabase = await getSupabaseClient();
    
    // Get current balance (in cents)
    const currentBalance = await getAdvertiserDepositBalance(userId);
    if (!currentBalance.success) {
      return currentBalance;
    }

    // Add refund amount to deposit balance (both in cents)
    const newBalance = (currentBalance.balance || 0) + refundAmountInCents;
    const { data, error } = await supabase
      .from('advertiser_profiles')
      .update({ available_deposit_balance: newBalance })
      .eq('id', userId)
      .select('available_deposit_balance')
      .single();

    if (error) {
      console.error('Error processing refund:', error);
      return { success: false, balance: currentBalance.balance, error: error.message };
    }

    // Create meaningful refund description with breakdown
    const prizePoolDecrease = refundAmountInCents - Math.round(refundAmountInCents * (currentPaymentDetails.commission_percentage / (100 + currentPaymentDetails.commission_percentage)));
    const commissionRefund = refundAmountInCents - prizePoolDecrease;
    
    const refundDescription = `${reason} - Contest ID: ${contestId}`;
    const refundRemarks = `Prize pool reduced by $${(prizePoolDecrease / 100).toFixed(2)}, commission refund: $${(commissionRefund / 100).toFixed(2)}`;

    // Log the refund transaction
    await logTransaction(
      userId, 
      'refund', 
      refundAmountInCents, 
      'success', 
      refundDescription,
      undefined, // No payment intent for refunds
      refundRemarks,
      'refund'
    );

    // Update payment details to reflect the refund
    const updatedPaymentDetails = addBudgetChangeToPaymentDetails(
      currentPaymentDetails,
      -prizePoolDecrease,
      'decrease',
      0, // No wallet involved in refund
      0, // No Stripe involved in refund
      null // No payment intent for refund
    );

    return { 
      success: true, 
      balance: data?.available_deposit_balance || 0,
      paymentDetails: updatedPaymentDetails
    };
  } catch (error) {
    console.error('Error in refundContestPaymentV2:', error);
    return { success: false, balance: 0, error: 'Unknown error occurred' };
  }
} 