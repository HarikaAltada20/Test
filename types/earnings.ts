import { User } from "@supabase/supabase-js";

// Profile data, assuming money values are stored in CENTS in the DB
export interface CreatorProfileData {
  total_money_won: number;
  total_contests_won: number;
  withdrawable_balance: number;
}

// Advertiser profile data for billing section
export interface AdvertiserProfileData {
  total_money_spent: number;
  total_contests_run: number;
  available_deposit_balance: number;
  withdrawable_balance: number;
  subscription_plan: string;
}

// Data fetched from the 'users' table
export interface UserData {
  coins: number;
  advertisers_referred: number;
  creators_referred: number;
  total_lifetime_coins_earned: number; // From new column
}

// From your 'money_transactions' table, amount is in CENTS
export interface CashTransaction {
  id: string;
  created_at: string;
  description: string | null;
  amount: number; // Renamed from amount_cents
  status: string | null;
  type: string | null;
  withdrawal_request_id?: string | null; // Added for linking to withdrawal requests
}

// From your 'coin_transactions' table
export interface CoinTransaction {
  id: string;
  created_at: string;
  description: string | null;
  coins: number; // Can be positive or negative
  status: string | null;
  type: string | null;
  withdrawal_request_id?: string | null; // Added for linking to withdrawal requests
}

export type PayoutMethodType = "crypto" | "upi" | "bank_transfer";

// For the 'user_payout_info' table
export interface PayoutMethod {
  id: string;
  user_id: string;
  method_type: PayoutMethodType;
  details: PayoutMethodDetails | any;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
  friendly_name?: string | null;
}

export interface CryptoPayoutDetails {
  wallet_address: string;
  network: string;
}

export interface UpiPayoutDetails {
  upi_id: string;
}

export interface BankPayoutDetails {
  account_holder_name: string;
  account_number: string;
  ifsc_code?: string;
  swift_bic_code?: string;
  bank_name: string;
  branch_name?: string;
  country: string;
}

export type PayoutMethodDetails = CryptoPayoutDetails | UpiPayoutDetails | BankPayoutDetails;

// For creator earnings props
export interface EarningsClientPageProps {
  initialAuthUser: User | null;
  initialProfile: CreatorProfileData | null;
  initialUserData: UserData | null;
  initialCashTransactions: CashTransaction[];
  initialCoinTransactions: CoinTransaction[];
  initialPayoutMethods: PayoutMethod[];
  initialWithdrawalRequests: WithdrawalRequest[];
}

// For advertiser billing props
export interface BillingClientPageProps {
  initialAuthUser: User | null;
  initialProfile: AdvertiserProfileData | null;
  initialUserData: UserData | null;
  initialCashTransactions: CashTransaction[];
  initialCoinTransactions: CoinTransaction[];
  initialPayoutMethods: PayoutMethod[];
  initialWithdrawalRequests: WithdrawalRequest[];
}

// For the 'withdrawal_requests' table
export interface WithdrawalRequest {
  id: string;
  created_at: string;
  updated_at?: string;
  amount: number; // Renamed from amount_cents
  currency: string; // e.g., 'USD', 'COIN'
  amount_type: 'cash' | 'coins';
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed' | 'cancelled' | 'in_review'; // Added 'in_review'
  payout_method_id?: string | null; // Optional
  user_notes: string | null;
  admin_notes?: string | null;
  processed_at?: string | null;
  transaction_reference?: string | null;
  payout_method_type_snapshot?: PayoutMethodType | string | null; // Optional
  payout_method_details_snapshot?: PayoutMethodDetails | any | null; // Optional, allow 'any' for broader JSONB compatibility initially
  redeemed_item_description?: any | null; // New field for JSONB data
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  payout_method_summary?: string; // This is a frontend-added field
} 