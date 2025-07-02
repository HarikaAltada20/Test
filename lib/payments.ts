import { createClient } from '@/utils/supabase/server';
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
  error?: string;
}

// Get advertiser's current deposit balance
export async function getAdvertiserDepositBalance(userId: string): Promise<DepositBalanceResponse> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('advertiser_profiles')
      .select('available_deposit_balance')
      .eq('id', userId)
      .single();

    if (error) {
      return { success: false, balance: 0, error: error.message };
    }

    return { 
      success: true, 
      balance: data?.available_deposit_balance || 0 
    };
  } catch (error) {
    return { success: false, balance: 0, error: 'Unknown error occurred' };
  }
}

// Create Stripe payment intent for wallet top-up
export async function createTopUpPaymentIntent(
  userId: string, 
  amount: number
): Promise<PaymentIntent | null> {
  try {
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

// NOTE: logTransaction has been moved to lib/payment-utils.ts for consistency
// All money transactions should be logged in CENTS, not dollars
// Use the logTransaction function from lib/payment-utils.ts instead 