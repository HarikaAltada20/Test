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
    
    // Get current balance and add the new amount (both in cents)
    const currentBalance = await getAdvertiserDepositBalance(userId);
    if (!currentBalance.success) {
      return currentBalance;
    }

    const newBalance = (currentBalance.balance || 0) + amountInCents;
    
    // Update the deposit balance
    const { data, error } = await supabase
      .from('advertiser_profiles')
      .update({ available_deposit_balance: newBalance })
      .eq('id', userId)
      .select('available_deposit_balance')
      .single();

    if (error) {
      console.error('Error updating deposit balance:', error);
      return { success: false, balance: 0, error: error.message };
    }

    // Log the transaction in cents
    await logTransaction(userId, 'deposit', amountInCents, 'success', `Deposit via Stripe: ${paymentIntentId}`, paymentIntentId);

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
  description: string
): Promise<DepositBalanceResponse> {
  try {
    const supabase = await getSupabaseClient();
    
    // Check current balance first (both in cents)
    const currentBalance = await getAdvertiserDepositBalance(userId);
    if (!currentBalance.success || currentBalance.balance < amountInCents) {
      return { 
        success: false, 
        balance: currentBalance.balance, 
        error: 'Insufficient balance' 
      };
    }

    // Update the deposit balance (both amounts in cents)
    const newBalance = currentBalance.balance - amountInCents;
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

    // Log the transaction in cents
    await logTransaction(userId, 'contest_payment', amountInCents, 'success', description);

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
    
    const paymentIntent = await stripe.paymentIntents.create({
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
  description: string
): Promise<PaymentIntent | null> {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount),
      currency: 'usd',
      metadata: {
        userId,
        contestId,
        type: 'contest_payment',
        amount: amount.toString(),
        description,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

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
      const deductResult = await deductFromDepositBalance(userId, walletAmount, `Partial payment for: ${description}`);
      
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

    // Log the refund transaction in cents
    await logTransaction(
      userId, 
      'refund', 
      amountInCents, 
      'success', 
      `${reason} - Contest ID: ${contestId}`
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

// Log transaction to money_transactions table (amount in cents)
// Enhanced transaction logging with payment_intent_id for performance
export async function logTransaction(
  userId: string,
  type: 'deposit' | 'contest_payment' | 'refund' | 'withdrawal',
  amountInCents: number,
  status: 'pending' | 'success' | 'failed',
  description: string,
  paymentIntentId?: string, // NEW: Optional payment intent ID for fast lookups
  remarks?: string // NEW: User-friendly status message
): Promise<boolean> {
  try {
    console.log('📝 Logging transaction:', {
      userId,
      type,
      amountInCents,
      status,
      paymentIntentId,
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
      payment_intent_id: paymentIntentId, // NEW: Store for lightning-fast lookups
      remarks, // NEW: User-friendly message
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