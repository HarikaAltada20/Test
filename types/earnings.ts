import { User } from "@supabase/supabase-js";

// Profile data, assuming money values are stored in CENTS in the DB
export interface CreatorProfileData {
  total_money_won_cents: number; 
  total_contests_won: number;
  withdrawable_balance_cents: number;
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
  amount_cents: number; // Stored as cents
  status: string | null;
  type: string | null;
}

// From your 'coin_transactions' table
export interface CoinTransaction {
  id: string;
  created_at: string;
  description: string | null;
  coins: number; // Can be positive or negative
  status: string | null;
  type: string | null;
}

export type PayoutMethodType = "crypto" | "paypal" | "bank" | "upi";

// For the 'user_payout_info' table
export interface PayoutMethod {
  id: string;
  user_id: string;
  method_type: PayoutMethodType;
  details: any; // Specific details based on method_type
  is_default: boolean;
  created_at: string;
  updated_at?: string; // Optional
}

// For props passed to the client component
export interface EarningsClientPageProps {
  initialAuthUser: User | null;
  initialProfile: CreatorProfileData | null;
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
  amount_cents: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed' | 'cancelled'; // Possible statuses
  payout_method_id: string; 
  user_notes: string | null;
  admin_notes?: string | null; // Optional, if you fetch it
  // You might want to include a summary of the payout method if fetched/joined
  payout_method_summary?: string; 
} 