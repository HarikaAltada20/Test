import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import BillingClientPage from "./BillingClientPage";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { CashTransaction, CoinTransaction, AdvertiserProfileData, PayoutMethod, UserData, WithdrawalRequest } from "@/types/earnings";

// Helper function to retry database operations (for post-payment scenarios)
async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);

            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }

    throw lastError;
}

export default async function AdvertiserBillingServerPage({
    searchParams,
}: {
    searchParams: Promise<{ session_id?: string; success?: string }>;
}) {
    const supabase = await createClient();
    const resolvedSearchParams = await searchParams;
    const isReturningFromCheckout = resolvedSearchParams.success === 'true' && resolvedSearchParams.session_id;

    const {
        data: { user: authUser },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
        console.error("Auth error or no user, redirecting to login:", authError);
        redirect("/login");
    }

    // For users returning from checkout, use retry logic to handle timing issues
    const fetchUserData = async () => {
        const { data: roleAndCoinsData, error: roleAndCoinsError } = await supabase
            .from("users")
            .select("user_type, coins, advertisers_referred, creators_referred, total_lifetime_coins_earned")
            .eq("id", authUser.id)
            .single();

        if (roleAndCoinsError) {
            throw roleAndCoinsError;
        }

        if (!roleAndCoinsData || roleAndCoinsData.user_type !== "advertiser") {
            throw new Error(`User is not an advertiser: ${roleAndCoinsData?.user_type}`);
        }

        return roleAndCoinsData;
    };

    let roleAndCoinsData;
    try {
        if (isReturningFromCheckout) {
            console.log("🔄 User returning from checkout, using retry logic...");
            roleAndCoinsData = await retryOperation(fetchUserData, 3, 1000);
        } else {
            roleAndCoinsData = await fetchUserData();
        }
    } catch (error) {
        console.error("Error fetching user role/coins or not an advertiser:", error);

        // For checkout returns, give a more specific error
        if (isReturningFromCheckout) {
            console.error("⚠️ User returning from checkout but access denied. This might indicate a timing issue.");
            redirect("/dashboard?error=checkout_access_denied&message=Please try refreshing the page");
        } else {
            redirect("/dashboard?error=profile_fetch_failed");
        }
    }

    const userData: UserData = {
        coins: roleAndCoinsData.coins || 0,
        advertisers_referred: roleAndCoinsData.advertisers_referred || 0,
        creators_referred: roleAndCoinsData.creators_referred || 0,
        total_lifetime_coins_earned: roleAndCoinsData.total_lifetime_coins_earned || 0,
    };

    // Fetch advertiser profile (money fields) - also with retry for checkout returns
    const fetchAdvertiserProfile = async () => {
        const { data: profileData, error: profileError } = await supabase
            .from("advertiser_profiles")
            .select("total_money_spent, total_contests_run, available_deposit_balance, withdrawable_balance, subscription_info")
            .eq("id", authUser.id)
            .single();

        if (profileError) {
            throw profileError;
        }

        return profileData;
    };

    let profileData;
    try {
        if (isReturningFromCheckout) {
            profileData = await retryOperation(fetchAdvertiserProfile, 3, 1000);
        } else {
            profileData = await fetchAdvertiserProfile();
        }
    } catch (error) {
        console.error("Error fetching advertiser profile:", error);
        // Allow page to load with possibly empty profile, client can show error or limited view
        profileData = null;
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