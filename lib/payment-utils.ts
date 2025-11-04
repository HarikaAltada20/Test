import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  stripe,
  formatAmountForStripe,
  formatAmountFromStripe,
} from "./stripe";
import { createOrGetStripeCustomer } from "@/lib/subscription-utils";

// Types for payment operations
export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}
// Global remark for payout reversals so it is consistent app-wide
export const REVERSAL_TRANSACTION_REMARK = "Forfeited due to status reversal";

export interface DepositBalanceResponse {
  success: boolean;
  balance: number;
  error?: string;
}

export interface PaymentProcessingResult {
  success: boolean;
  paymentMethod: "wallet" | "stripe" | "split";
  amountFromWallet?: number;
  amountFromStripe?: number;
  paymentIntent?: PaymentIntent;
  transactionId?: string;
  error?: string;
}

export interface PaymentDetails {
  first_payment_at: string;
  last_updated: string;
  payment_status: "pending" | "completed" | "failed";
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
export async function getAdvertiserDepositBalance(
  userId: string
): Promise<DepositBalanceResponse> {
  try {
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase
      .from("advertiser_profiles")
      .select("available_deposit_balance")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching deposit balance:", error);
      return { success: false, balance: 0, error: error.message };
    }

    return {
      success: true,
      balance: data?.available_deposit_balance || 0, // Already in cents from database
    };
  } catch (error) {
    console.error("Error in getAdvertiserDepositBalance:", error);
    return { success: false, balance: 0, error: "Unknown error occurred" };
  }
}

// Add funds to advertiser's deposit balance (amount in cents)
export async function addToDepositBalance(
  userId: string, 
  amountInCents: number, 
  paymentIntentId: string,
  paymentMethod: 'stripe' | 'solana' | 'phantom' = 'stripe'
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
      .from("advertiser_profiles")
      .update({ available_deposit_balance: newBalance })
      .eq("id", userId)
      .select("available_deposit_balance")
      .single();

    if (error) {
      console.error("Error adding to deposit balance:", error);
      return {
        success: false,
        balance: currentBalance.balance,
        error: error.message,
      };
    }

    // Create meaningful deposit description based on payment method
    const depositDescription = paymentMethod === 'stripe' 
      ? `Wallet top-up via Stripe payment`
      : paymentMethod === 'solana' 
      ? `Wallet top-up via Solana payment`
      : `Wallet top-up via Phantom Wallet`;
    
    const depositRemarks = `Deposit added to wallet balance`;

    // Log the deposit transaction in cents
    await logTransaction(
      userId,
      "deposit",
      amountInCents,
      "success",
      depositDescription,
      paymentIntentId,
      depositRemarks,
      paymentMethod === 'phantom' ? 'solana' : paymentMethod
    );

    return {
      success: true,
      balance: data?.available_deposit_balance || 0, // Already in cents from database
    };
  } catch (error) {
    console.error("Error in addToDepositBalance:", error);
    return { success: false, balance: 0, error: "Unknown error occurred" };
  }
}

// Deduct from advertiser's deposit balance (amount in cents)
export async function deductFromDepositBalance(
  userId: string,
  amountInCents: number,
  description: string,
  paymentMethod: "wallet" | "split" = "wallet" // NEW: Specify if this is wallet-only or part of split
): Promise<DepositBalanceResponse> {
  try {
    const supabase = await getSupabaseClient();

    // Check current balance first (both in cents)
    const currentBalance = await getAdvertiserDepositBalance(userId);
    if (!currentBalance.success) {
      return {
        success: false,
        balance: currentBalance.balance,
        error: "Failed to check wallet balance",
      };
    }

    if (currentBalance.balance < amountInCents) {
      console.error(
        `❌ INSUFFICIENT BALANCE: Attempted to deduct ${amountInCents} cents from ${currentBalance.balance} cents`
      );
      return {
        success: false,
        balance: currentBalance.balance,
        error: `Insufficient balance. Required: $${(
          amountInCents / 100
        ).toFixed(2)}, Available: $${(currentBalance.balance / 100).toFixed(
          2
        )}`,
      };
    }

    // Update the deposit balance (both amounts in cents)
    const newBalance = currentBalance.balance - amountInCents;

    // CRITICAL SAFETY CHECK: Prevent negative balances at database level
    if (newBalance < 0) {
      console.error(
        `🚨 CRITICAL: Attempted to create negative balance! Current: ${currentBalance.balance}, Deducting: ${amountInCents}, Result: ${newBalance}`
      );
      return {
        success: false,
        balance: currentBalance.balance,
        error: `Operation would create negative balance. Available: $${(
          currentBalance.balance / 100
        ).toFixed(2)}, Required: $${(amountInCents / 100).toFixed(2)}`,
      };
    }

    const { data, error } = await supabase
      .from("advertiser_profiles")
      .update({ available_deposit_balance: newBalance })
      .eq("id", userId)
      .select("available_deposit_balance")
      .single();

    if (error) {
      console.error("Error deducting from deposit balance:", error);
      return {
        success: false,
        balance: currentBalance.balance,
        error: error.message,
      };
    }

    // Create meaningful description and remarks based on payment method
    let enhancedDescription = description;
    let remarks = "";

    if (paymentMethod === "wallet") {
      enhancedDescription = `${description} (Wallet Payment)`;
      remarks = "Paid from wallet balance";
    } else if (paymentMethod === "split") {
      enhancedDescription = `${description} (Wallet Portion)`;
      remarks = "Wallet portion of split payment";
    }

    // Log the transaction in cents with payment method
    console.log(
      `📝 Logging wallet transaction: ${amountInCents} cents for user ${userId}`
    );
    const logResult = await logTransaction(
      userId,
      "contest_payment",
      amountInCents,
      "success",
      enhancedDescription,
      undefined, // No payment intent for wallet transactions
      remarks,
      paymentMethod
    );

    if (!logResult) {
      console.error(
        `❌ CRITICAL: Failed to log wallet transaction for user ${userId}, amount: ${amountInCents} cents`
      );
    } else {
      console.log(
        `✅ Wallet transaction logged successfully for user ${userId}`
      );
    }

    return {
      success: true,
      balance: data?.available_deposit_balance || 0, // Already in cents from database
    };
  } catch (error) {
    console.error("Error in deductFromDepositBalance:", error);
    return { success: false, balance: 0, error: "Unknown error occurred" };
  }
}

// Create Stripe payment intent for wallet top-up
export async function createTopUpPaymentIntent(
  userId: string,
  amount: number
): Promise<PaymentIntent | null> {
  try {
    console.log("💳 Creating payment intent with:", { userId, amount });

    // Get or create Stripe customer for this user
    const customerId = await createOrGetStripeCustomer(userId);
    if (!customerId) {
      console.error(
        "❌ Failed to create or get Stripe customer for user:",
        userId
      );
      return null;
    }

    const paymentIntent = await stripe().paymentIntents.create({
      amount: formatAmountForStripe(amount),
      currency: "usd",
      customer: customerId, // Link to customer
      metadata: {
        userId,
        type: "wallet_topup",
        amount: amount.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log("✅ Payment intent created with customer:", {
      paymentIntentId: paymentIntent.id,
      customerId: customerId,
      metadata: paymentIntent.metadata,
    });

    return {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret!,
      amount: formatAmountFromStripe(paymentIntent.amount),
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return null;
  }
}

// Create Stripe payment intent for contest payment
export async function createContestPaymentIntent(
  userId: string,
  contestId: string,
  amount: number,
  description: string,
  paymentMethod: "stripe" | "split" = "stripe", // NEW: Specify if this is Stripe-only or part of split
  walletAmount?: number, // NEW: Wallet amount for split payments (in cents)
  totalAmount?: number, // NEW: Total amount for split payments (in cents)
  originalWalletBalance?: number // NEW: Original wallet balance for atomic rollback
): Promise<PaymentIntent | null> {
  try {
    // Get or create Stripe customer for this user
    const customerId = await createOrGetStripeCustomer(userId);
    if (!customerId) {
      console.error(
        "❌ Failed to create or get Stripe customer for user:",
        userId
      );
      return null;
    }

    // Build metadata object
    const metadata: any = {
      userId,
      contestId,
      type:
        paymentMethod === "split" ? "contest_payment_split" : "contest_payment",
      amount: amount.toString(),
      description,
      paymentMethod, // NEW: Include payment method in metadata
    };

    // Add split payment specific metadata for atomic transactions
    if (
      paymentMethod === "split" &&
      walletAmount !== undefined &&
      totalAmount !== undefined
    ) {
      metadata.walletAmount = (walletAmount / 100).toString(); // Store in dollars for webhook
      metadata.totalAmount = (totalAmount / 100).toString(); // Store in dollars for webhook
      metadata.originalWalletBalance = originalWalletBalance?.toString() || "0"; // Store in cents
    }

    const paymentIntent = await stripe().paymentIntents.create({
      amount: amount, // amount is already in cents, no conversion needed
      currency: "usd",
      customer: customerId, // Link to customer
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log("✅ Contest payment intent created with customer:", {
      paymentIntentId: paymentIntent.id,
      customerId: customerId,
      contestId: contestId,
      amount: amount,
      paymentMethod: paymentMethod,
    });

    // Create meaningful description and remarks based on payment method
    let enhancedDescription = description;
    let remarks = "";

    if (paymentMethod === "stripe") {
      enhancedDescription = `${description} (Stripe Payment)`;
      remarks = "Stripe payment processing";
    } else if (paymentMethod === "split") {
      enhancedDescription = `${description} (Stripe Portion)`;
      remarks = "Stripe portion of split payment";
    }

    // Log initial pending transaction for the Stripe portion
    // This ensures split payments show as two separate transactions
    await logTransaction(
      userId,
      "contest_payment",
      amount, // amount is already in cents
      "pending",
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
    console.error("Error creating contest payment intent:", error);
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
        paymentMethod: "wallet",
        error: "Failed to check wallet balance",
      };
    }

    // Case 1: Sufficient wallet balance
    if (useWalletFirst && currentBalance.balance >= totalAmount) {
      const deductResult = await deductFromDepositBalance(
        userId,
        totalAmount,
        description
      );

      if (deductResult.success) {
        return {
          success: true,
          paymentMethod: "wallet",
          amountFromWallet: totalAmount,
          amountFromStripe: 0,
        };
      } else {
        return {
          success: false,
          paymentMethod: "wallet",
          error: deductResult.error,
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
        paymentMethod: "stripe",
        error: "Failed to create payment intent",
      };
    }

    // If using wallet for partial payment, deduct wallet amount first
    if (walletAmount > 0) {
      const deductResult = await deductFromDepositBalance(
        userId,
        walletAmount,
        description
      );

      if (!deductResult.success) {
        return {
          success: false,
          paymentMethod: "split",
          error: "Failed to deduct from wallet for split payment",
        };
      }

      return {
        success: true,
        paymentMethod: "split",
        amountFromWallet: walletAmount,
        amountFromStripe: stripeAmount,
        paymentIntent,
      };
    }

    // Full Stripe payment
    return {
      success: true,
      paymentMethod: "stripe",
      amountFromWallet: 0,
      amountFromStripe: stripeAmount,
      paymentIntent,
    };
  } catch (error) {
    console.error("Error in processContestPayment:", error);
    return {
      success: false,
      paymentMethod: "wallet",
      error: "Unknown error occurred",
    };
  }
}

// Refund contest payment back to deposit balance (amount in cents)
export async function refundContestPayment(
  userId: string,
  amountInCents: number,
  contestId: string,
  reason: string = "Contest cancelled"
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
      .from("advertiser_profiles")
      .update({ available_deposit_balance: newBalance })
      .eq("id", userId)
      .select("available_deposit_balance")
      .single();

    if (error) {
      console.error("Error processing refund:", error);
      return {
        success: false,
        balance: currentBalance.balance,
        error: error.message,
      };
    }

    // Create meaningful refund description
    const refundDescription = `${reason} - Contest ID: ${contestId}`;
    const refundRemarks = `Refund processed to wallet balance`;

    // Log the refund transaction in cents
    await logTransaction(
      userId,
      "refund",
      amountInCents,
      "success",
      refundDescription,
      undefined, // No payment intent for refunds
      refundRemarks,
      "refund"
    );

    return {
      success: true,
      balance: data?.available_deposit_balance || 0, // Already in cents from database
    };
  } catch (error) {
    console.error("Error in refundContestPayment:", error);
    return { success: false, balance: 0, error: "Unknown error occurred" };
  }
}

// Enhanced transaction logging with payment method and meaningful descriptions
export async function logTransaction(
  userId: string,
  type:
    | "deposit"
    | "contest_payment"
    | "refund"
    | "withdrawal"
    | "subscription_payment"
    | "reward",
  amountInCents: number,
  status: "pending" | "success" | "failed" | "cancelled" | "completed",
  description: string,
  paymentIntentId?: string, // Optional payment intent ID for fast lookups
  remarks?: string, // User-friendly status message
  paymentMethod?: 'wallet' | 'stripe' | 'split' | 'refund' | 'solana', // NEW: Payment method for clarity
  metadata?: any, // NEW: Flexible metadata for subscription payments
  stripeInvoiceId?: string, // NEW: Stripe invoice ID for subscription payments
  stripeSubscriptionId?: string, // NEW: Stripe subscription ID for subscription payments
  stripeCustomerId?: string // NEW: Stripe customer ID for transaction tracking
): Promise<boolean> {
  try {
    console.log("📝 Logging transaction:", {
      userId,
      type,
      amountInCents,
      status,
      paymentIntentId,
      paymentMethod,
      remarks,
      stripeCustomerId,
      description: description.substring(0, 100) + "...", // Truncate for readability
    });

    const supabase = await getSupabaseClient();

    // If no customer ID provided but we have a payment intent, try to get customer info
    let finalMetadata = metadata || {};
    if (!stripeCustomerId && paymentIntentId) {
      try {
        const paymentIntent = await stripe().paymentIntents.retrieve(
          paymentIntentId
        );
        if (paymentIntent.customer) {
          stripeCustomerId = paymentIntent.customer as string;
          finalMetadata = {
            ...finalMetadata,
            stripe_customer_id: stripeCustomerId,
          };
        }
      } catch (error) {
        console.log(
          "⚠️ Could not retrieve payment intent for customer info:",
          error
        );
      }
    } else if (stripeCustomerId) {
      finalMetadata = {
        ...finalMetadata,
        stripe_customer_id: stripeCustomerId,
      };
    }

    const transactionData = {
      user_id: userId,
      type,
      status,
      amount: amountInCents, // Store in cents (consistent with system)
      description,
      payment_intent_id: paymentIntentId, // Store for lightning-fast lookups
      payment_method: paymentMethod, // NEW: Store payment method for clarity
      remarks, // User-friendly message
      metadata: finalMetadata, // NEW: Store flexible metadata with customer info
      stripe_invoice_id: stripeInvoiceId, // NEW: Store Stripe invoice ID
      stripe_subscription_id: stripeSubscriptionId, // NEW: Store Stripe subscription ID
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("💾 Inserting transaction data:", transactionData);

    const { data, error } = await supabase
      .from("money_transactions")
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error("❌ Error logging transaction:", error);
      console.error("Transaction data that failed:", transactionData);
      return false;
    }

    console.log("✅ Transaction logged successfully:", {
      id: data?.id,
      type: data?.type,
      amount: data?.amount,
      payment_method: data?.payment_method,
      payment_intent_id: data?.payment_intent_id,
      remarks: data?.remarks,
      customer_id: stripeCustomerId,
      description: data?.description?.substring(0, 50) + "...",
    });

    return true;
  } catch (error) {
    console.error("❌ Error in logTransaction:", error);
    return false;
  }
}

// 🆕 Creator balance helpers (withdrawable balance in cents)
export async function creditCreatorWithdrawableBalance(
  creatorId: string,
  amountInCents: number,
  description: string,
  opts?: { remarks?: string; metadata?: any }
): Promise<{
  success: boolean;
  newBalance?: number;
  transactionId?: string;
  error?: string;
}> {
  try {
    if (amountInCents <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    // Use service role to bypass RLS when crediting other users
    const supabase = createAdminClient();

    // Read current balances
    const { data: profile, error: readErr } = await supabase
      .from("creator_profiles")
      .select("withdrawable_balance, total_money_won")
      .eq("id", creatorId)
      .single();

    if (readErr) {
      return { success: false, error: readErr.message };
    }

    const currentBalance = profile?.withdrawable_balance || 0;
    const currentTotalWon = profile?.total_money_won || 0;
    const newBalance = currentBalance + amountInCents;
    const newTotalWon = currentTotalWon + amountInCents;

    const { error: updateErr } = await supabase
      .from("creator_profiles")
      .update({
        withdrawable_balance: newBalance,
        total_money_won: newTotalWon,
      })
      .eq("id", creatorId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Log reward transaction
    const supabaseInsert = await supabase
      .from("money_transactions")
      .insert({
        user_id: creatorId,
        type: "reward",
        status: "success",
        amount: amountInCents,
        description,
        remarks: opts?.remarks,
        metadata: opts?.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (supabaseInsert.error) {
      return { success: false, error: supabaseInsert.error.message };
    }

    return {
      success: true,
      newBalance,
      transactionId: supabaseInsert.data?.id,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "Unknown error" };
  }
}

export async function debitCreatorWithdrawableBalance(
  creatorId: string,
  amountInCents: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    if (amountInCents <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    // Use service role to bypass RLS when touching other users
    const supabase = createAdminClient();

    const { data: profile, error: readErr } = await supabase
      .from("creator_profiles")
      .select("withdrawable_balance, total_money_won")
      .eq("id", creatorId)
      .single();

    if (readErr) {
      return { success: false, error: readErr.message };
    }

    const currentBalance = profile?.withdrawable_balance || 0;
    const currentTotalWon = profile?.total_money_won || 0;
    const newBalance = Math.max(0, currentBalance - amountInCents);
    const newTotalWon = Math.max(0, currentTotalWon - amountInCents);

    const { error: updateErr } = await supabase
      .from("creator_profiles")
      .update({
        withdrawable_balance: newBalance,
        total_money_won: newTotalWon,
      })
      .eq("id", creatorId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true, newBalance };
  } catch (error: any) {
    return { success: false, error: error?.message || "Unknown error" };
  }
}

// 🆕 Generic wallet credit for any user (creator or advertiser) without touching contest win totals
export async function creditUserWithdrawableBalance(
  userId: string,
  amountInCents: number,
  description: string,
  opts?: { remarks?: string; metadata?: any }
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    if (amountInCents <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    const supabase = createAdminClient();

    // Determine user type
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", userId)
      .single();
    if (userErr || !userRow?.user_type) {
      return { success: false, error: userErr?.message || "User not found" };
    }

    const isCreator = userRow.user_type === "creator";
    const table = isCreator ? "creator_profiles" : "advertiser_profiles";

    // Read current balance
    const { data: profile, error: readErr } = await supabase
      .from(table)
      .select("withdrawable_balance")
      .eq("id", userId)
      .single();
    if (readErr) {
      return { success: false, error: readErr.message };
    }

    const currentBalance = profile?.withdrawable_balance || 0;
    const newBalance = currentBalance + amountInCents;

    const { error: updateErr } = await supabase
      .from(table)
      .update({ withdrawable_balance: newBalance })
      .eq("id", userId);
    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Also increment users.affiliate_earnings for analytics/reporting (atomic)
    const { error: incErr } = await supabase.rpc("increment_other_earnings", {
      p_user_id: userId,
      p_amount: amountInCents,
    });
    if (incErr) {
      console.warn("increment_other_earnings RPC failed:", incErr.message);
    }

    // Log as reward for now (category specified in metadata)
    const { error: insertErr } = await supabase
      .from("money_transactions")
      .insert({
        user_id: userId,
        type: "reward",
        status: "success",
        amount: amountInCents,
        description,
        remarks: opts?.remarks,
        metadata: opts?.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    return { success: true, newBalance };
  } catch (error: any) {
    return { success: false, error: error?.message || "Unknown error" };
  }
}

// 🆕 Admin-privileged transaction logger (bypasses RLS for cross-user entries)
export async function logTransactionAsAdmin(
  userId: string,
  type:
    | "deposit"
    | "contest_payment"
    | "refund"
    | "withdrawal"
    | "subscription_payment"
    | "reward",
  amountInCents: number,
  status: "pending" | "success" | "failed" | "cancelled" | "completed",
  description: string,
  extra?: {
    remarks?: string;
    paymentMethod?: "wallet" | "stripe" | "split" | "refund";
    metadata?: any;
    paymentIntentId?: string;
    stripeInvoiceId?: string;
    stripeSubscriptionId?: string;
  }
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("money_transactions").insert({
      user_id: userId,
      type,
      status,
      amount: amountInCents,
      description,
      remarks: extra?.remarks,
      payment_method: extra?.paymentMethod,
      metadata: extra?.metadata,
      payment_intent_id: extra?.paymentIntentId,
      stripe_invoice_id: extra?.stripeInvoiceId,
      stripe_subscription_id: extra?.stripeSubscriptionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

// 🚀 OPTIMIZED: Get pending transaction by payment intent (lightning fast)
export async function getPendingTransactionByPaymentIntent(
  paymentIntentId: string
): Promise<any | null> {
  try {
    console.log(
      `🚀 FAST LOOKUP: Getting pending transaction for payment intent: ${paymentIntentId}`
    );

    const supabase = await getSupabaseClient();

    // Use optimized database function for sub-millisecond lookups
    const { data, error } = await supabase.rpc(
      "get_pending_transaction_by_payment_intent_fast",
      {
        p_payment_intent_id: paymentIntentId,
      }
    );

    if (error) {
      console.error("❌ Error in optimized transaction lookup:", error);
      return null;
    }

    if (data && data.length > 0) {
      console.log(
        `✅ FAST LOOKUP SUCCESS: Found transaction for payment intent: ${paymentIntentId}`
      );
      return data[0];
    } else {
      console.log(
        `❌ No pending transaction found for payment intent: ${paymentIntentId}`
      );
      return null;
    }
  } catch (error) {
    console.error("❌ Error in getPendingTransactionByPaymentIntent:", error);
    return null;
  }
}

// 🚀 OPTIMIZED: Ultra-fast transaction status update using indexed payment_intent_id
export async function updateTransactionStatus(
  paymentIntentId: string,
  status: "success" | "failed",
  newDescription?: string,
  remarks?: string
): Promise<boolean> {
  try {
    console.log(
      `🚀 FAST UPDATE: Updating transaction for payment intent: ${paymentIntentId}`
    );

    const supabase = await getSupabaseClient();

    // Use optimized database function for lightning-fast updates
    const { data, error } = await supabase.rpc(
      "update_transaction_status_by_payment_intent_fast",
      {
        p_payment_intent_id: paymentIntentId,
        p_new_status: status,
        p_new_description: newDescription,
        p_remarks: remarks,
      }
    );

    if (error) {
      console.error("❌ Error in optimized transaction update:", error);
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }

    if (data === true) {
      console.log(
        `✅ FAST UPDATE SUCCESS: Transaction updated to ${status} for payment intent: ${paymentIntentId}`
      );
      return true;
    } else {
      console.log(
        `❌ No pending transaction found for payment intent: ${paymentIntentId}`
      );
      return false;
    }
  } catch (error) {
    console.error("❌ Error in updateTransactionStatus:", error);
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
  const commissionAmount = Math.round(
    prizePoolInCents * (commissionPercentage / 100)
  );
  const totalAmount = prizePoolInCents + commissionAmount;
  const now = new Date().toISOString();

  return {
    first_payment_at: now,
    last_updated: now,
    payment_status: "pending",
    total_prize_pool: prizePoolInCents,
    commission_amount: commissionAmount,
    total_amount_paid: totalAmount,
    commission_percentage: commissionPercentage,
    payment_intent_ids: [paymentIntentId],
    stripe_amounts_paid: [stripeAmount],
    wallet_amounts_used: [walletAmount],
    amount_changes: [totalAmount],
    change_history: ["initial_payment"],
  };
}

// 🚀 NEW: Add a budget change to existing payment details
export function addBudgetChangeToPaymentDetails(
  currentPaymentDetails: PaymentDetails,
  prizePoolChangeInCents: number,
  changeType: "increase" | "decrease",
  walletAmount: number = 0,
  stripeAmount: number = 0,
  paymentIntentId: string | null = null
): PaymentDetails {
  const commissionOnChange = Math.round(
    Math.abs(prizePoolChangeInCents) *
      (currentPaymentDetails.commission_percentage / 100)
  );
  const totalChangeAmount =
    prizePoolChangeInCents +
    (prizePoolChangeInCents >= 0 ? commissionOnChange : -commissionOnChange);

  const newPrizePool =
    currentPaymentDetails.total_prize_pool + prizePoolChangeInCents;
  const newCommissionAmount = Math.round(
    newPrizePool * (currentPaymentDetails.commission_percentage / 100)
  );
  const newTotalPaid =
    currentPaymentDetails.total_amount_paid + totalChangeAmount;

  return {
    ...currentPaymentDetails,
    last_updated: new Date().toISOString(),
    total_prize_pool: newPrizePool,
    commission_amount: newCommissionAmount,
    total_amount_paid: newTotalPaid,
    payment_intent_ids: [
      ...currentPaymentDetails.payment_intent_ids,
      paymentIntentId,
    ],
    stripe_amounts_paid: [
      ...currentPaymentDetails.stripe_amounts_paid,
      stripeAmount,
    ],
    wallet_amounts_used: [
      ...currentPaymentDetails.wallet_amounts_used,
      walletAmount,
    ],
    amount_changes: [
      ...currentPaymentDetails.amount_changes,
      totalChangeAmount,
    ],
    change_history: [...currentPaymentDetails.change_history, changeType],
  };
}

// 🚀 NEW: Mark payment as completed
export function markPaymentAsCompleted(
  paymentDetails: PaymentDetails
): PaymentDetails {
  return {
    ...paymentDetails,
    last_updated: new Date().toISOString(),
    payment_status: "completed",
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
  changeType?: "increase" | "decrease"
): Promise<PaymentProcessingResult & { paymentDetails?: PaymentDetails }> {
  try {
    const totalAmount =
      prizePoolInCents +
      Math.round(prizePoolInCents * (commissionPercentage / 100));

    const currentBalance = await getAdvertiserDepositBalance(userId);

    if (!currentBalance.success) {
      return {
        success: false,
        paymentMethod: "wallet",
        error: "Failed to check wallet balance",
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
      const stripePaymentMethod = walletAmount > 0 ? "split" : "stripe";

      // For split payments, pass additional metadata for atomic transactions
      if (stripePaymentMethod === "split") {
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
          paymentMethod: "stripe",
          error: "Failed to create payment intent",
        };
      }
    }

    // Process wallet payment if needed
    if (walletAmount > 0) {
      const walletPaymentMethod = stripeAmount > 0 ? "split" : "wallet";

      // FOR ATOMIC TRANSACTIONS: Only deduct wallet immediately for wallet-only payments
      // For split payments, defer wallet deduction until Stripe payment succeeds (handled in webhook)
      if (walletPaymentMethod === "wallet") {
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
            paymentMethod: "wallet",
            error: deductResult.error || "Failed to deduct from wallet",
          };
        }
        console.log(
          `✅ Wallet deduction successful. New balance: ${deductResult.balance} cents`
        );
      } else {
        // Split payment - defer to webhook
        console.log(
          `⏳ Split payment detected: Wallet ${walletAmount} cents will be deducted after Stripe success`
        );
      }
      // NOTE: For split payments, wallet deduction is deferred to webhook after Stripe success
    }

    // Create or update payment details
    let paymentDetails: PaymentDetails;
    const isWalletOnly = walletAmount > 0 && stripeAmount === 0;
    const isSplit = walletAmount > 0 && stripeAmount > 0;

    if (existingPaymentDetails && changeType) {
      // This is a budget change
      const prizePoolChange =
        changeType === "increase" ? prizePoolInCents : -prizePoolInCents;
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

    const paymentMethod =
      walletAmount > 0 && stripeAmount > 0
        ? "split"
        : walletAmount > 0
        ? "wallet"
        : "stripe";

    return {
      success: true,
      paymentMethod,
      amountFromWallet: isWalletOnly ? walletAmount : 0, // Only report deducted amounts
      amountFromStripe: stripeAmount,
      paymentIntent: paymentIntent || undefined,
      paymentDetails,
    };
  } catch (error) {
    console.error("Error in processContestPaymentV2:", error);
    return {
      success: false,
      paymentMethod: "wallet",
      error: "Unknown error occurred",
    };
  }
}

// 🚀 NEW: Enhanced refund with payment details update
export async function refundContestPaymentV2(
  userId: string,
  contestId: string,
  refundAmountInCents: number,
  currentPaymentDetails: PaymentDetails,
  reason: string = "Contest budget decreased"
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
      .from("advertiser_profiles")
      .update({ available_deposit_balance: newBalance })
      .eq("id", userId)
      .select("available_deposit_balance")
      .single();

    if (error) {
      console.error("Error processing refund:", error);
      return {
        success: false,
        balance: currentBalance.balance,
        error: error.message,
      };
    }

    // Create meaningful refund description with breakdown
    const prizePoolDecrease =
      refundAmountInCents -
      Math.round(
        refundAmountInCents *
          (currentPaymentDetails.commission_percentage /
            (100 + currentPaymentDetails.commission_percentage))
      );
    const commissionRefund = refundAmountInCents - prizePoolDecrease;

    const refundDescription = `${reason} - Contest ID: ${contestId}`;
    const refundRemarks = `Prize pool reduced by $${(
      prizePoolDecrease / 100
    ).toFixed(2)}, commission refund: $${(commissionRefund / 100).toFixed(2)}`;

    // Log the refund transaction
    await logTransaction(
      userId,
      "refund",
      refundAmountInCents,
      "success",
      refundDescription,
      undefined, // No payment intent for refunds
      refundRemarks,
      "refund"
    );

    // Update payment details to reflect the refund
    const updatedPaymentDetails = addBudgetChangeToPaymentDetails(
      currentPaymentDetails,
      -prizePoolDecrease,
      "decrease",
      0, // No wallet involved in refund
      0, // No Stripe involved in refund
      null // No payment intent for refund
    );

    return {
      success: true,
      balance: data?.available_deposit_balance || 0,
      paymentDetails: updatedPaymentDetails,
    };
  } catch (error) {
    console.error("Error in refundContestPaymentV2:", error);
    return { success: false, balance: 0, error: "Unknown error occurred" };
  }
}

// Utility function to get customer information for any user
export async function getCustomerInfo(
  userId: string
): Promise<{ customerId?: string; email?: string } | null> {
  try {
    const supabase = await getSupabaseClient();

    // Get customer ID from customers table
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (customerError) {
      console.error("Error fetching customer data:", customerError);
      return null;
    }

    // Get user email from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("Error fetching user data:", userError);
      return null;
    }

    return {
      customerId: customerData?.stripe_customer_id,
      email: userData?.email,
    };
  } catch (error) {
    console.error("Error in getCustomerInfo:", error);
    return null;
  }
}

// 🆕 UTILITY FUNCTION TO CHECK AND SET DEFAULT PAYMENT METHOD
// This function checks if a customer has a default payment method and sets one if they don't
// Also updates the local customers table for redundancy and easier access
export async function ensureDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<boolean> {
  try {
    console.log(
      `🔧 Ensuring default payment method for customer ${customerId}`
    );

    // First, check if customer already has a default payment method in Stripe
    const customer = await stripe().customers.retrieve(customerId);

    // Check if customer is deleted or doesn't exist
    if (customer.deleted) {
      console.log(
        `❌ Customer ${customerId} is deleted, cannot set default payment method`
      );
      return false;
    }

    let shouldUpdateStripe = false;
    let shouldUpdateLocal = false;

    // Check if Stripe needs updating
    if (!customer.invoice_settings?.default_payment_method) {
      console.log(
        `🆕 Customer ${customerId} has no default payment method in Stripe, setting ${paymentMethodId} as default`
      );
      shouldUpdateStripe = true;
    } else {
      console.log(
        `✅ Customer ${customerId} already has default payment method in Stripe: ${customer.invoice_settings.default_payment_method}`
      );
    }

    // Check if local database needs updating
    const supabase = await getSupabaseClient();
    const { data: localCustomer, error: localError } = await supabase
      .from("customers")
      .select("default_payment_method_id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (localError) {
      console.log(
        `⚠️ Could not check local customer record: ${localError.message}`
      );
    } else if (!localCustomer?.default_payment_method_id) {
      console.log(
        `🆕 Customer ${customerId} has no default payment method in local DB, setting ${paymentMethodId} as default`
      );
      shouldUpdateLocal = true;
    } else {
      console.log(
        `✅ Customer ${customerId} already has default payment method in local DB: ${localCustomer.default_payment_method_id}`
      );
    }

    // Update Stripe if needed
    if (shouldUpdateStripe) {
      try {
        const updatedCustomer = await stripe().customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
        console.log(
          `✅ Successfully set payment method ${paymentMethodId} as default in Stripe for customer ${customerId}`
        );
        console.log(
          `📋 Stripe customer default payment method: ${updatedCustomer.invoice_settings.default_payment_method}`
        );
      } catch (stripeError) {
        console.error(
          `❌ Error setting default payment method in Stripe for customer ${customerId}:`,
          stripeError
        );
        // Continue with local update even if Stripe fails
      }
    }

    // Update local database if needed
    if (shouldUpdateLocal) {
      try {
        const { error: updateError } = await supabase
          .from("customers")
          .update({
            default_payment_method_id: paymentMethodId,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);

        if (updateError) {
          console.error(
            `❌ Error setting default payment method in local DB for customer ${customerId}:`,
            updateError
          );
        } else {
          console.log(
            `✅ Successfully set payment method ${paymentMethodId} as default in local DB for customer ${customerId}`
          );
        }
      } catch (localUpdateError) {
        console.error(
          `❌ Exception setting default payment method in local DB for customer ${customerId}:`,
          localUpdateError
        );
      }
    }

    return shouldUpdateStripe || shouldUpdateLocal;
  } catch (error) {
    console.error(
      `❌ Error ensuring default payment method for customer ${customerId}:`,
      error
    );
    return false;
  }
}

// 🆕 UTILITY FUNCTION TO GET DEFAULT PAYMENT METHOD
// This function retrieves the default payment method for a customer from both Stripe and local database
// Returns the payment method ID or null if not found
export async function getDefaultPaymentMethod(
  customerId: string
): Promise<string | null> {
  try {
    console.log(`🔍 Getting default payment method for customer ${customerId}`);

    // First try to get from local database (faster)
    const supabase = await getSupabaseClient();
    const { data: localCustomer, error: localError } = await supabase
      .from("customers")
      .select("default_payment_method_id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (!localError && localCustomer?.default_payment_method_id) {
      console.log(
        `✅ Found default payment method in local DB: ${localCustomer.default_payment_method_id}`
      );
      return localCustomer.default_payment_method_id;
    }

    // Fallback to Stripe if not found locally
    console.log(
      `🔄 Default payment method not found in local DB, checking Stripe...`
    );
    const customer = await stripe().customers.retrieve(customerId);

    if (customer.deleted) {
      console.log(`❌ Customer ${customerId} is deleted`);
      return null;
    }

    const stripeDefaultMethod =
      customer.invoice_settings?.default_payment_method;
    if (stripeDefaultMethod) {
      // Handle both string and PaymentMethod object types
      const paymentMethodId =
        typeof stripeDefaultMethod === "string"
          ? stripeDefaultMethod
          : stripeDefaultMethod.id;

      console.log(
        `✅ Found default payment method in Stripe: ${paymentMethodId}`
      );

      // Update local database to sync with Stripe
      try {
        await supabase
          .from("customers")
          .update({
            default_payment_method_id: paymentMethodId,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);
        console.log(`✅ Synced default payment method from Stripe to local DB`);
      } catch (syncError) {
        console.error(
          `⚠️ Could not sync default payment method to local DB:`,
          syncError
        );
      }

      return paymentMethodId;
    }

    console.log(
      `❌ No default payment method found for customer ${customerId}`
    );
    return null;
  } catch (error) {
    console.error(
      `❌ Error getting default payment method for customer ${customerId}:`,
      error
    );
    return null;
  }
}

// 🆕 UTILITY FUNCTION TO SET DEFAULT PAYMENT METHOD FORCEFULLY
// This function sets a payment method as default regardless of current state
// Useful for when you want to explicitly change the default payment method
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<boolean> {
  try {
    console.log(
      `🔧 Setting payment method ${paymentMethodId} as default for customer ${customerId}`
    );

    // Update Stripe
    try {
      const updatedCustomer = await stripe().customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      console.log(
        `✅ Successfully set payment method ${paymentMethodId} as default in Stripe for customer ${customerId}`
      );
    } catch (stripeError) {
      console.error(
        `❌ Error setting default payment method in Stripe for customer ${customerId}:`,
        stripeError
      );
      return false;
    }

    // Update local database
    try {
      const supabase = await getSupabaseClient();
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          default_payment_method_id: paymentMethodId,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);

      if (updateError) {
        console.error(
          `❌ Error setting default payment method in local DB for customer ${customerId}:`,
          updateError
        );
        return false;
      } else {
        console.log(
          `✅ Successfully set payment method ${paymentMethodId} as default in local DB for customer ${customerId}`
        );
      }
    } catch (localUpdateError) {
      console.error(
        `❌ Exception setting default payment method in local DB for customer ${customerId}:`,
        localUpdateError
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `❌ Error setting default payment method for customer ${customerId}:`,
      error
    );
    return false;
  }
}
