import { createClient } from "@/utils/supabase/server"; // Changed to server client
import { redirect } from "next/navigation";
import EarningsClientPage from "./EarningsClientPage"; // New client component
import { CashTransaction, CoinTransaction, CreatorProfileData, PayoutMethod, UserData, WithdrawalRequest } from "@/types/earnings"; // Assuming types are moved

// Helper to safely parse numeric values from DB, converting to cents if they are dollars, or keeping as is if cents
export default async function CreatorEarningsServerPage() {
  // Assuming createClient might be async based on linter errors.
  // If createClient is synchronous, this await should be removed and the underlying issue with types investigated.
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    console.error("Auth error or no user, redirecting to login:", authError);
    redirect("/login");
  }

  // Fetch user role, coins, and referral data
  const { data: roleAndCoinsData, error: roleAndCoinsError } = await supabase
    .from("users")
    .select("user_type, coins, advertisers_referred, creators_referred, total_lifetime_coins_earned")
    .eq("id", authUser.id)
    .single();

  if (roleAndCoinsError || !roleAndCoinsData || roleAndCoinsData.user_type !== "creator") {
    console.error("Error fetching user role/coins or not a creator:", roleAndCoinsError);
    redirect("/dashboard?error=profile_fetch_failed"); // Or a more specific error page
  }

  const userData: UserData = {
    coins: roleAndCoinsData.coins || 0,
    advertisers_referred: roleAndCoinsData.advertisers_referred || 0,
    creators_referred: roleAndCoinsData.creators_referred || 0,
    total_lifetime_coins_earned: roleAndCoinsData.total_lifetime_coins_earned || 0,
  };

  // Fetch creator profile (money fields)
  const { data: profileData, error: profileError } = await supabase
    .from("creator_profiles")
    .select("total_money_won, total_contests_won, withdrawable_balance")
    .eq("id", authUser.id)
    .single();

  if (profileError || !profileData) {
    console.error("Error fetching creator profile:", profileError);
    // Allow page to load with possibly empty profile, client can show error or limited view
    // Or redirect: redirect("/dashboard?error=profile_fetch_failed");
  }

  // IMPORTANT: Adjust parsing based on actual DB storage (cents vs dollars)
  const initialProfile: CreatorProfileData | null = profileData ? {
    total_money_won: profileData.total_money_won,
    total_contests_won: profileData.total_contests_won || 0,
    withdrawable_balance: profileData.withdrawable_balance,
  } : null;


  // Fetch Payout Methods (from payout_methods table)
  const { data: methodsData, error: methodsError } = await supabase
    .from("payout_methods") // Updated table name
    .select("*")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false });

  if (methodsError) {
    console.error("Error fetching payout methods:", methodsError);
    // Continue without methods, client can handle
  }
  const initialPayoutMethods: PayoutMethod[] = methodsData || [];

  // Fetch Cash Transactions (from money_transactions table)
  const { data: cashData, error: cashError } = await supabase
    .from("money_transactions")
    .select("id, created_at, description, amount, status, type") // 'amount' here is assumed to be in CENTS as per user's decision
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false });

  if (cashError) {
    console.error("Error fetching cash transactions:", cashError);
  }
  // Assuming 'amount' from money_transactions is already in CENTS
  // Define an interface for the raw transaction data from the DB for typing 'tx'
  interface DbCashTransaction {
    id: string;
    created_at: string;
    description: string | null;
    amount: string | number; // Raw amount from DB (already in cents)
    status: string | null;
    type: string | null;
  }
  const initialCashTransactions: CashTransaction[] = (cashData || []).map((tx: DbCashTransaction) => ({
    id: tx.id,
    created_at: tx.created_at,
    description: tx.description,
    amount_cents: Math.round(parseFloat(String(tx.amount))) || 0, // Ensure amount is a number (cents)
    status: tx.status,
    type: tx.type,
  }));


  // Fetch Coin Transactions (from coin_transactions table)
  const { data: coinData, error: coinError } = await supabase
    .from("coin_transactions")
    .select("id, created_at, description, coins, status, type")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false });

  if (coinError) {
    console.error("Error fetching coin transactions:", coinError);
  }
  const initialCoinTransactions: CoinTransaction[] = coinData || [];

  // Fetch Withdrawal Requests
  const { data: withdrawalRequestsData, error: withdrawalRequestsError } = await supabase
    .from("withdrawal_requests")
    .select("id, created_at, updated_at, amount_cents, currency, status, payout_method_id, user_notes, admin_notes, amount_type, processed_at, transaction_reference, cancelled_at, cancellation_reason")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false });

  if (withdrawalRequestsError) {
    console.error("Error fetching withdrawal requests:", withdrawalRequestsError);
    // Continue, client can handle empty or error state
  }
  const initialWithdrawalRequests: WithdrawalRequest[] = withdrawalRequestsData || [];

  // Remove Link import if not used here
  // import Link from "next/link"; 

  return (
    <EarningsClientPage
      initialAuthUser={authUser}
      initialProfile={initialProfile}
      initialUserData={userData}
      initialCashTransactions={initialCashTransactions}
      initialCoinTransactions={initialCoinTransactions}
      initialPayoutMethods={initialPayoutMethods}
      initialWithdrawalRequests={initialWithdrawalRequests}
    />
  );
}
