import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import BillingClientPage from "./BillingClientPage";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { CashTransaction, CoinTransaction, AdvertiserProfileData, PayoutMethod, UserData, WithdrawalRequest } from "@/types/earnings";

export default async function AdvertiserBillingServerPage() {
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

    if (roleAndCoinsError || !roleAndCoinsData || roleAndCoinsData.user_type !== "advertiser") {
        console.error("Error fetching user role/coins or not an advertiser:", roleAndCoinsError);
        redirect("/dashboard?error=profile_fetch_failed");
    }

    const userData: UserData = {
        coins: roleAndCoinsData.coins || 0,
        advertisers_referred: roleAndCoinsData.advertisers_referred || 0,
        creators_referred: roleAndCoinsData.creators_referred || 0,
        total_lifetime_coins_earned: roleAndCoinsData.total_lifetime_coins_earned || 0,
    };

    // Fetch advertiser profile (money fields)
    const { data: profileData, error: profileError } = await supabase
        .from("advertiser_profiles")
        .select("total_money_spent, total_contests_run, available_deposit_balance, withdrawable_balance, subscription_info")
        .eq("id", authUser.id)
        .single();

    if (profileError || !profileData) {
        console.error("Error fetching advertiser profile:", profileError);
        // Allow page to load with possibly empty profile, client can show error or limited view
    }

    const initialProfile: AdvertiserProfileData | null = profileData ? {
        total_money_spent: profileData.total_money_spent || 0,
        total_contests_run: profileData.total_contests_run || 0,
        available_deposit_balance: profileData.available_deposit_balance || 0,
        withdrawable_balance: profileData.withdrawable_balance || 0,
        subscription_plan: profileData.subscription_info?.product_id || 'prod_Sduka9mKXu35Ii', // Default to EXPLORER
    } : null;

    // Fetch Payout Methods
    const { data: methodsData, error: methodsError } = await supabase
        .from("payout_methods")
        .select("*")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false });

    if (methodsError) {
        console.error("Error fetching payout methods:", methodsError);
    }
    const initialPayoutMethods: PayoutMethod[] = methodsData || [];

    // Fetch Cash Transactions
    const { data: cashData, error: cashError } = await supabase
        .from("money_transactions")
        .select("id, created_at, description, amount, status, type, remarks")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false });

    if (cashError) {
        console.error("Error fetching cash transactions:", cashError);
    }

    interface DbCashTransaction {
        id: string;
        created_at: string;
        description: string | null;
        amount: string | number;
        status: string | null;
        type: string | null;
        remarks: string | null;
    }

    const initialCashTransactions: CashTransaction[] = (cashData || []).map((tx: DbCashTransaction) => ({
        id: tx.id,
        created_at: tx.created_at,
        description: tx.description,
        amount: Math.round(parseFloat(String(tx.amount))) || 0,
        status: tx.status,
        type: tx.type,
        remarks: tx.remarks,
    }));

    // Fetch Coin Transactions
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
        .select("id, created_at, updated_at, amount, currency, status, payout_method_id, user_notes, admin_notes, amount_type, processed_at, transaction_reference, cancelled_at, cancellation_reason, redeemed_item_description, payout_method_type_snapshot, payout_method_details_snapshot")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false });

    if (withdrawalRequestsError) {
        console.error("Error fetching withdrawal requests:", withdrawalRequestsError);
    }
    const initialWithdrawalRequests: WithdrawalRequest[] = withdrawalRequestsData || [];

    return (
        <RouteGuard allowedUserTypes={['advertiser']} fallbackPath="/dashboard/opportunities">
            <BillingClientPage
                initialAuthUser={authUser}
                initialProfile={initialProfile}
                initialUserData={userData}
                initialCashTransactions={initialCashTransactions}
                initialCoinTransactions={initialCoinTransactions}
                initialPayoutMethods={initialPayoutMethods}
                initialWithdrawalRequests={initialWithdrawalRequests}
            />
        </RouteGuard>
    );
} 