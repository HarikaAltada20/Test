"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // Added for potential future use
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import Link from "next/link"; // Not used directly here if navigation is via router or buttons
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { EnhancedTabs as Tabs, EnhancedTabsContent as TabsContent, EnhancedTabsList as TabsList, EnhancedTabsTrigger as TabsTrigger } from "@/components/ui/enhanced-tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    // DialogTrigger, // Not always needed if controlled by state
    DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    ArrowDownToLine,
    DollarSign,
    Trophy,
    Coins,
    Gift,
    Users,
    PlusCircle,
    Trash2,
    Edit3,
    CreditCard,
    Landmark,
    Wallet as CryptoWalletIcon, // Renamed to avoid conflict
    Sparkles,
    Power,
    Loader2,
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client"; // Client Supabase
import { CashTransaction, CoinTransaction, CreatorProfileData, PayoutMethod, PayoutMethodType, UserData, WithdrawalRequest, PayoutMethodDetails } from "@/types/earnings"; // Centralized types
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { MIN_WITHDRAWAL_AMOUNT } from "@/constants/subscriptionPlans";
import { toast } from "sonner"; // Import toast
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";

const formatCoins = (coins: number | bigint = 0): string => {
    return new Intl.NumberFormat().format(Number(coins));
};

const formatDateTime = (dateString?: string): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
};

interface EarningsClientPageProps {
    initialAuthUser: User | null;
    initialProfile: CreatorProfileData | null;
    initialUserData: UserData | null;
    initialCashTransactions: CashTransaction[];
    initialCoinTransactions: CoinTransaction[];
    initialPayoutMethods: PayoutMethod[];
    initialWithdrawalRequests: WithdrawalRequest[];
}

export default function EarningsClientPage({
    initialAuthUser,
    initialProfile,
    initialUserData,
    initialCashTransactions,
    initialCoinTransactions,
    initialPayoutMethods,
    initialWithdrawalRequests,
}: EarningsClientPageProps) {
    const supabase = createClient();
    const router = useRouter(); // Initialize router

    // Define getPayoutMethodSummaryById earlier, but it depends on payoutMethods state
    // To handle this, we'll adjust how withdrawalRequests is initialized slightly

    // States derived from props, allowing client-side updates
    const [authUser, setAuthUser] = useState<User | null>(initialAuthUser);
    const [profile, setProfile] = useState<CreatorProfileData | null>(initialProfile);
    const [userData, setUserData] = useState<UserData | null>(initialUserData);
    // Note: Cash transactions now handled by pagination hook
    const [coinTransactions, setCoinTransactionsState] = useState<CoinTransaction[]>(initialCoinTransactions);
    const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>(initialPayoutMethods);
    // Initialize withdrawalRequests without summary first, then add summary in useEffect
    const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>(initialWithdrawalRequests);

    const [isLoading, setIsLoading] = useState(false); // For client-side actions
    const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false); // Specific loading for withdrawal submission
    const [isCancellingWithdrawal, setIsCancellingWithdrawal] = useState<string | null>(null); // Stores ID of withdrawal being cancelled

    // Modal States (same as before)
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [currentPayoutMethod, setCurrentPayoutMethod] = useState<PayoutMethod | null>(null);
    const [selectedPayoutType, setSelectedPayoutType] = useState<PayoutMethodType>("crypto");

    const [cryptoAddress, setCryptoAddress] = useState('');
    const [bankAccountHolder, setBankAccountHolder] = useState('');
    const [bankAccountNumber, setBankAccountNumber] = useState('');
    const [bankBranchName, setBankBranchName] = useState('');
    const [bankCountry, setBankCountry] = useState('IN');
    const [bankSortCode, setBankSortCode] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankRoutingNumber, setBankRoutingNumber] = useState('');
    const [bankIfscCode, setBankIfscCode] = useState('');
    const [upiId, setUpiId] = useState('');

    const [withdrawAmountDollars, setWithdrawAmountDollars] = useState<number>(0); // Amount in dollars for input
    const [selectedWithdrawMethodId, setSelectedWithdrawMethodId] = useState<string | null>(null);
    const [withdrawalUserNotes, setWithdrawalUserNotes] = useState<string>(""); // New state for user notes

    const [activeTab, setActiveTab] = useState<'cash' | 'coins'>('cash'); // State for current tab
    const [withdrawAmountCoins, setWithdrawAmountCoins] = useState<number>(0); // Example for coin withdrawal amount

    const [cryptoNetwork, setCryptoNetwork] = useState<string>('BNB_BEP20'); // Added for crypto network
    const [payoutFriendlyName, setPayoutFriendlyName] = useState<string>(''); // Added for friendly name
    const [payoutCountry, setPayoutCountry] = useState<'IN' | 'OTHER'>('IN');

    // Coupon/code redemption
    const [redeemCode, setRedeemCode] = useState<string>('');
    const [isRedeeming, setIsRedeeming] = useState<boolean>(false);

    // Pagination for cash transactions
    const {
        data: paginatedCashTransactions,
        pagination: cashPagination,
        loading: cashTransactionsLoading,
        error: cashTransactionsError,
        setPage: setCashPage,
        setLimit: setCashLimit,
        refresh: refreshCashTransactions,
    } = usePagination<CashTransaction>({
        apiEndpoint: '/api/money-transactions',
        initialLimit: 25,
    });

    const getPayoutMethodSummary = (method: PayoutMethod): string => {
        switch (method.method_type) {
            case "crypto":
                return `${method.details?.network?.toUpperCase() || 'Crypto'} Wallet: ...${method.details?.wallet_address?.slice(-4) || 'XXXX'} (${method.friendly_name || 'Crypto'})`;
            case "upi":
                return `UPI: ${method.details?.upi_id || 'N/A'} (${method.friendly_name || 'UPI'})`;
            case "bank_transfer":
                return `Bank: ...${method.details?.account_number?.slice(-4) || 'XXXX'} (${method.friendly_name || 'Bank'})`;
            default:
                const exhaustiveCheck: never = method.method_type;
                return "Unknown Method Type";
        }
    };

    const getPayoutMethodSummaryById = (methodId: string | null): string => {
        if (!methodId) return "Payout method deleted or N/A";
        const method = payoutMethods.find(p => p.id === methodId);
        return method ? getPayoutMethodSummary(method) : "Unknown Method";
    };

    useEffect(() => {
        if (!initialAuthUser) {
            router.push("/login");
            return;
        }
        setAuthUser(initialAuthUser);
        setProfile(initialProfile);
        setUserData(initialUserData);
        // Note: Cash transactions now handled by pagination hook
        setCoinTransactionsState(initialCoinTransactions);
        setPayoutMethods(initialPayoutMethods);
        setWithdrawalRequests(
            initialWithdrawalRequests.map(wr => ({
                ...wr,
                payout_method_summary: getPayoutMethodSummaryById(wr.payout_method_id === undefined ? null : wr.payout_method_id)
            }))
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialAuthUser, initialProfile, initialUserData, initialCoinTransactions, initialPayoutMethods, initialWithdrawalRequests, router]);

    const handleSavePayoutMethod = async () => {
        if (!authUser) {
            toast.error("Authentication error.");
            return;
        }
        if (!payoutFriendlyName.trim()) {
            toast.error("Please provide a friendly name for this payout method.");
            return;
        }

        let details: PayoutMethodDetails;

        if (selectedPayoutType === 'crypto') {
            if (!cryptoAddress.trim() || !cryptoNetwork.trim()) {
                toast.error("Crypto wallet address and network are required.");
                return;
            }
            if (cryptoNetwork !== 'BNB_BEP20') {
                toast.error("Only BNB Smart Chain (BEP20) is supported.");
                return;
            }
            if (!/^0x[a-fA-F0-9]{40}$/.test(cryptoAddress.trim())) {
                toast.error("Enter a valid BNB Smart Chain (BEP20) address (starts with 0x, 42 chars).");
                return;
            }
            details = { wallet_address: cryptoAddress.trim(), network: cryptoNetwork.trim() };
        } else if (selectedPayoutType === 'upi') {
            if (!bankAccountHolder.trim() || !upiId.trim()) {
                toast.error("Account holder name and UPI ID are required.");
                return;
            }
            details = { account_holder_name: bankAccountHolder.trim(), upi_id: upiId.trim() };
        } else if (selectedPayoutType === 'bank_transfer') {
            if (!bankAccountHolder.trim() || !bankAccountNumber.trim() || !bankIfscCode.trim()) {
                toast.error("Account holder name, account number, and IFSC code are required for bank transfer.");
                return;
            }
            const bankDetails: any = {
                account_holder_name: bankAccountHolder.trim(),
                account_number: bankAccountNumber.trim(),
                ifsc_code: bankIfscCode.trim(),
                country: bankCountry.trim(),
            };
            if (bankRoutingNumber.trim()) bankDetails.swift_bic_code = bankRoutingNumber.trim();
            if (bankName.trim()) bankDetails.bank_name = bankName.trim();
            if (bankBranchName.trim()) bankDetails.branch_name = bankBranchName.trim();
            details = bankDetails;
        } else {
            const exhaustiveCheck: never = selectedPayoutType;
            toast.error("Invalid payout method type selected.");
            return;
        }

        setIsLoading(true);
        const methodToSave = {
            user_id: authUser.id,
            method_type: selectedPayoutType,
            details: details,
            friendly_name: payoutFriendlyName.trim(),
            ...(currentPayoutMethod ? { id: currentPayoutMethod.id } : {}),
        };

        console.log("Attempting to save payout method:", JSON.stringify(methodToSave, null, 2)); // Log the object being sent

        try {
            const { data, error } = await supabase
                .from('payout_methods')
                .upsert(methodToSave)
                .select()
                .single(); // Assuming upserting one record and expecting one back

            if (error) throw error;

            if (data) {
                setPayoutMethods(prevMethods => {
                    const index = prevMethods.findIndex(m => m.id === data.id);
                    if (index !== -1) {
                        const newMethods = [...prevMethods];
                        newMethods[index] = data as PayoutMethod;
                        return newMethods;
                    } else {
                        return [...prevMethods, data as PayoutMethod];
                    }
                });
                toast.success(`Payout method ${currentPayoutMethod ? 'updated' : 'added'} successfully!`);
                setIsPayoutModalOpen(false);
                resetPayoutForm();
            } else {
                throw new Error("No data returned after saving payout method.")
            }
        } catch (error: any) {
            console.error("---------------- ERROR SAVING PAYOUT METHOD ----------------");
            console.error("Timestamp:", new Date().toISOString());
            console.error("Method to save:", JSON.stringify(methodToSave, null, 2));
            console.error("Raw error object:", error);
            if (error) {
                console.error("Error message:", error.message);
                console.error("Error code:", error.code);
                console.error("Error details:", error.details);
                console.error("Error stack:", error.stack);
                try {
                    console.error("Stringified error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                } catch (e) {
                    console.error("Could not stringify error with getOwnPropertyNames:", e);
                    try {
                        console.error("Stringified error (basic):", JSON.stringify(error, null, 2));
                    } catch (e2) {
                        console.error("Could not stringify error at all:", e2);
                    }
                }
            }

            let errorMessage = "An unknown error occurred. Check the console for details.";
            if (error && typeof error.message === 'string' && error.message.trim() !== '') {
                errorMessage = error.message;
            } else if (typeof error === 'string' && error.trim() !== '') {
                errorMessage = error;
            } else if (error && error.details && typeof error.details === 'string' && error.details.trim() !== '') {
                errorMessage = error.details;
            } else if (error && error.code && typeof error.code === 'string' && error.code.trim() !== '') {
                errorMessage = `Error code: ${error.code}`;
            }

            toast.error(`Failed to save payout method: ${errorMessage}`);
            console.error("---------------- END ERROR SAVING PAYOUT METHOD ----------------");
        }
        setIsLoading(false);
    };

    const resetPayoutForm = () => {
        setCurrentPayoutMethod(null);
        setSelectedPayoutType('crypto');
        setCryptoAddress('');
        setCryptoNetwork('BNB_BEP20');
        setUpiId('');
        setBankAccountHolder('');
        setBankAccountNumber('');
        setBankIfscCode('');
        setBankRoutingNumber('');
        setBankName('');
        setBankBranchName('');
        setBankCountry('IN');
        setPayoutFriendlyName('');
    };

    const handleEditPayoutMethod = (method: PayoutMethod) => {
        setCurrentPayoutMethod(method);
        setSelectedPayoutType(method.method_type);
        setPayoutFriendlyName(method.friendly_name || '');

        if (method.method_type === 'crypto' && method.details) {
            setCryptoAddress(method.details.wallet_address || '');
            setCryptoNetwork(method.details.network || 'BNB_BEP20');
        } else if (method.method_type === 'upi' && method.details) {
            setUpiId(method.details.upi_id || '');
        } else if (method.method_type === 'bank_transfer' && method.details) {
            setBankAccountHolder(method.details.account_holder_name || '');
            setBankAccountNumber(method.details.account_number || '');
            setBankIfscCode(method.details.ifsc_code || '');
            setBankRoutingNumber(method.details.swift_bic_code || '');
            setBankName(method.details.bank_name || '');
            setBankBranchName(method.details.branch_name || '');
            setBankCountry(method.details.country || 'IN');
        }
        setIsPayoutModalOpen(true);
    };

    const handleDeletePayoutMethod = async (methodId: string) => {
        if (!confirm("Are you sure you want to delete this payout method?")) return;
        setIsLoading(true);
        const { error } = await supabase.from("payout_methods").delete().eq("id", methodId); // Updated table name
        setIsLoading(false);
        if (error) {
            console.error("Error deleting payout method:", error);
            alert(`Failed to delete method: ${error.message}`);
        } else {
            setPayoutMethods(payoutMethods.filter(p => p.id !== methodId));
            alert("Payout method deleted.");
        }
    };

    const handleSetDefaultPayoutMethod = async (methodId: string) => {
        if (!authUser) return;
        setIsLoading(true);
        // Set all others to false for this user
        const { error: unsetError } = await supabase
            .from("payout_methods") // Updated table name
            .update({ is_default: false })
            .eq("user_id", authUser.id);

        if (unsetError) {
            console.error("Error unsetting other defaults:", unsetError);
            // Decide if you want to proceed or show error and stop
        }

        const { data, error } = await supabase
            .from("payout_methods") // Updated table name
            .update({ is_default: true })
            .eq("id", methodId)
            .eq("user_id", authUser.id) // Ensure user owns this method
            .select()
            .single();
        setIsLoading(false);

        if (error) {
            console.error("Error setting default payout method:", error);
            alert(`Failed to set default method: ${error.message}`);
        } else if (data) {
            setPayoutMethods(payoutMethods.map(p => ({ ...p, is_default: p.id === data.id })));
            alert("Default payout method updated.");
        }
    };

    const handleWithdraw = async () => {
        if (!authUser || !selectedWithdrawMethodId) {
            toast.error("Please select a payout method.");
            return;
        }
        if (!profile || !userData) {
            toast.error("User profile or data not loaded.");
            return;
        }

        const minWithdrawalDollars = MIN_WITHDRAWAL_AMOUNT / 100;
        let amountToWithdraw = 0;
        let currencyForRpc = 'USD';
        let amountTypeForRpc: 'cash' | 'coins' = activeTab;
        let redeemedItemDescForRpc: any | null = null; // For p_redeemed_item_description

        if (activeTab === 'cash') {
            if (withdrawAmountDollars <= 0) {
                toast.error("Please enter a valid withdrawal amount.");
                return;
            }
            if (withdrawAmountDollars < minWithdrawalDollars) {
                toast.error(`Minimum cash withdrawal amount is ${formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}.`);
                return;
            }
            amountToWithdraw = Math.round(withdrawAmountDollars * 100); // This is the 'amount' for cash (in cents)
            if (amountToWithdraw > (profile.withdrawable_balance || 0)) {
                toast.error("Insufficient cash balance.");
                return;
            }
        } else { // activeTab === 'coins'
            if (withdrawAmountCoins <= 0) {
                toast.error("Please enter a valid coin amount to redeem.");
                return;
            }
            amountToWithdraw = withdrawAmountCoins; // This is the 'amount' for coins (quantity)
            currencyForRpc = 'COIN';
            // For now, as coin redemption isn't fully active via shop, set a placeholder or null
            // In future, this would come from the selected item in the shop flow
            redeemedItemDescForRpc = { placeholder: "Item to be redeemed" }; // Or null
            if (amountToWithdraw > (userData.coins || 0)) {
                toast.error("Insufficient coin balance.");
                return;
            }
        }

        const rpcArgs = {
            p_user_id: authUser.id,
            p_payout_method_id: selectedWithdrawMethodId,
            p_amount: amountToWithdraw,
            p_currency: currencyForRpc,
            p_amount_type: amountTypeForRpc,
            p_user_notes: withdrawalUserNotes,
            p_redeemed_item_description: redeemedItemDescForRpc
        };

        console.log("Calling create_withdrawal_request with args:", JSON.stringify(rpcArgs, null, 2)); // Log arguments

        setIsSubmittingWithdrawal(true);
        const { data: rpcResponse, error: rpcError } = await supabase.rpc('create_withdrawal_request', rpcArgs);
        setIsSubmittingWithdrawal(false);

        if (rpcError) {
            console.error("Error creating withdrawal request via RPC:", rpcError);
            toast.error(`Withdrawal request failed: ${rpcError.message}`);
        } else if (rpcResponse && Array.isArray(rpcResponse) && rpcResponse.length > 0) {
            const createdRequest = rpcResponse[0] as WithdrawalRequest;
            toast.success(`Withdrawal request for ${activeTab === 'cash' ? formatCurrencyFromCents(createdRequest.amount) : formatCoins(createdRequest.amount) + ' coins'} submitted successfully!`);
            setWithdrawalRequests(prev => [{
                ...createdRequest,
                payout_method_summary: getPayoutMethodSummaryById(createdRequest.payout_method_id === undefined ? null : createdRequest.payout_method_id)
            }, ...prev]);
            if (activeTab === 'cash') {
                setProfile(prev => prev ? ({ ...prev, withdrawable_balance: (prev.withdrawable_balance || 0) - createdRequest.amount }) : null);
            } else {
                setUserData(prev => prev ? ({ ...prev, coins: (prev.coins || 0) - createdRequest.amount }) : null);
            }
            setIsWithdrawModalOpen(false);
            setWithdrawAmountDollars(0);
            setWithdrawAmountCoins(0);
            setSelectedWithdrawMethodId(null);
            setWithdrawalUserNotes("");
        } else {
            console.error("Withdrawal request RPC returned unexpected data:", rpcResponse);
            toast.error("Withdrawal request submitted, but couldn't confirm details. Please check your requests.");
        }
    };

    const handleCancelWithdrawal = async (requestId: string, amountToRestore: number, amountType: 'cash' | 'coins') => { // amountCents renamed to amountToRestore
        if (!authUser || !profile || !userData) return;
        if (!confirm("Are you sure you want to cancel this withdrawal request? The funds will be returned to your balance.")) {
            return;
        }
        setIsCancellingWithdrawal(requestId);

        const { data: rpcSuccess, error: rpcError } = await supabase.rpc('cancel_withdrawal_request_by_user', {
            p_request_id: requestId,
            p_user_id: authUser.id
        });

        setIsCancellingWithdrawal(null);

        if (rpcError) {
            console.error("Error cancelling withdrawal request via RPC:", rpcError);
            toast.error(`Failed to cancel request: ${rpcError.message}`);
        } else if (rpcSuccess === true) {
            if (amountType === 'cash') {
                setProfile(prev => prev ? ({ ...prev, withdrawable_balance: (prev.withdrawable_balance || 0) + amountToRestore }) : null);
            } else { // coins
                setUserData(prev => prev ? ({ ...prev, coins: (prev.coins || 0) + amountToRestore }) : null);
            }
            setWithdrawalRequests(prevReqs =>
                prevReqs.map(req =>
                    req.id === requestId
                        ? {
                            ...req,
                            status: 'cancelled',
                            payout_method_summary: getPayoutMethodSummaryById(req.payout_method_id === undefined ? null : req.payout_method_id),
                            cancelled_at: new Date().toISOString(),
                            cancellation_reason: 'Cancelled by user'
                        }
                        : req
                )
            );
            toast.success("Withdrawal Cancelled: The funds have been returned to your balance.");
        } else {
            console.error("RPC call to cancel withdrawal did not return true. Response:", rpcSuccess);
            toast.error("Failed to cancel the withdrawal request. Please try again or contact support.");
        }
    };

    const PayoutMethodIcon = ({ type }: { type: PayoutMethodType }) => {
        if (type === 'crypto') return <CryptoWalletIcon className="mr-2 h-5 w-5" />;
        if (type === 'bank_transfer') return <Landmark className="mr-2 h-5 w-5" />;
        if (type === 'upi') return <Sparkles className="mr-2 h-5 w-5" />;
        return <CreditCard className="mr-2 h-5 w-5" />;
    };

    if (!authUser || !profile || !userData) {
        // This case should ideally be handled by the redirect in the server component for initial load.
        // This check is more for ensuring props are passed correctly.
        return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                <div className="flex items-center justify-center h-64"><p>Loading earnings data or not authenticated...</p></div>
            </div>
        );
    }

    // Derived state for total referrals
    const totalReferrals = (userData.advertisers_referred || 0) + (userData.creators_referred || 0);

    // Filter withdrawal requests for display
    const cashWithdrawalRequests = withdrawalRequests.filter(req => req.amount_type === 'cash');
    const coinWithdrawalRequests = withdrawalRequests.filter(req => req.amount_type === 'coins');

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">My Earnings</h1>
            </div>

            <Tabs defaultValue="cash" className="w-full" onValueChange={(value) => setActiveTab(value as 'cash' | 'coins')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="cash">
                        <DollarSign className="h-5 w-5 mr-2" /> Cash Wallet
                    </TabsTrigger>
                    <TabsTrigger value="coins">
                        <Coins className="h-5 w-5 mr-2" /> Coin Wallet
                    </TabsTrigger>
                </TabsList>

                {/* Cash Wallet Tab */}
                <TabsContent value="cash">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Cash Won</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrencyFromCents(profile.total_money_won)}</div>
                                <p className="text-xs text-muted-foreground">Lifetime cash earnings</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Available for Withdrawal</CardTitle>
                                <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrencyFromCents(profile.withdrawable_balance)}</div>
                                <p className="text-xs text-muted-foreground">Minimum withdrawal: {formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Cash Contests Won</CardTitle>
                                <Trophy className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{profile.total_contests_won}</div>
                                <p className="text-xs text-muted-foreground">Total cash contest victories</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Code Redemption */}
                    <div className="mb-6 p-4 border rounded-md bg-muted/30">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
                            <div className="flex-1">
                                <Label htmlFor="redeemCode">Redeem a Code</Label>
                                <Input
                                    id="redeemCode"
                                    placeholder="Enter coupon or promo code"
                                    value={redeemCode}
                                    onChange={(e) => setRedeemCode(e.target.value)}
                                    disabled={isRedeeming}
                                />
                            </div>
                            <Button
                                onClick={async () => {
                                    setIsRedeeming(true);
                                    try {
                                        const res = await fetch('/api/coupons/redeem', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ code: redeemCode.trim() })
                                        });
                                        const data = await res.json();
                                        if (!res.ok || data.error) {
                                            toast.error(data.error || 'Failed to redeem code');
                                        } else {
                                            // If server signals already redeemed, show neutral feedback
                                            if (typeof data.message === 'string' && data.message.toLowerCase().includes('already redeemed')) {
                                                toast('Code already redeemed on this account.');
                                                setRedeemCode('');
                                                return;
                                            }
                                            const creditedParts: string[] = [];
                                            if (typeof data.cash_cents === 'number' && data.cash_cents > 0) {
                                                setProfile(prev => prev ? ({ ...prev, withdrawable_balance: (prev.withdrawable_balance || 0) + data.cash_cents }) : prev);
                                                creditedParts.push(`$${(data.cash_cents / 100).toFixed(2)} to withdrawable balance`);
                                            }
                                            if (typeof data.coins === 'number' && data.coins > 0) {
                                                setUserData(prev => prev ? ({ ...prev, coins: (prev.coins || 0) + data.coins, total_lifetime_coins_earned: (prev.total_lifetime_coins_earned || 0) + data.coins }) : prev);
                                                creditedParts.push(`${data.coins} coins`);
                                            }
                                            const successMsg = creditedParts.length > 0
                                                ? `Code redeemed: ${creditedParts.join(' + ')}`
                                                : 'Code redeemed successfully';
                                            toast.success(successMsg);
                                            setRedeemCode('');
                                        }
                                    } catch (err: any) {
                                        toast.error(err?.message || 'Failed to redeem code');
                                    } finally {
                                        setIsRedeeming(false);
                                    }
                                }}
                                disabled={isRedeeming || redeemCode.trim().length === 0}
                            >
                                {isRedeeming ? 'Redeeming...' : 'Redeem Code'}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Enter any valid code shared via Discord, email, or campaigns.</p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        {(() => {
                            const balance = (profile?.withdrawable_balance || 0);
                            const canOpenWithdraw = !!profile && balance >= MIN_WITHDRAWAL_AMOUNT && !isLoading;
                            const hasPayoutMethods = payoutMethods.length > 0;
                            if (canOpenWithdraw && hasPayoutMethods) {
                                return (
                                    <Button onClick={() => setIsWithdrawModalOpen(true)} className="flex-1">
                                        <ArrowDownToLine className="h-4 w-4 mr-2" /> Withdraw Balance
                                    </Button>
                                );
                            }
                            if (canOpenWithdraw && !hasPayoutMethods) {
                                return (
                                    <Button
                                        onClick={() => { resetPayoutForm(); setIsPayoutModalOpen(true); }}
                                        className="flex-1"
                                    >
                                        <PlusCircle className="h-4 w-4 mr-2" /> Add Payout Method to Withdraw
                                    </Button>
                                );
                            }
                            // Fallback: disabled button with reason
                            const reason = !profile || isLoading
                                ? 'Loading account...'
                                : balance < MIN_WITHDRAWAL_AMOUNT
                                    ? `Minimum withdrawal: ${formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}`
                                    : 'Withdraw Balance';
                            return (
                                <Button className="flex-1" disabled>
                                    <ArrowDownToLine className="h-4 w-4 mr-2" /> {reason}
                                </Button>
                            );
                        })()}

                        <Button
                            variant="outline"
                            onClick={() => { resetPayoutForm(); setIsPayoutModalOpen(true); }}
                            className="flex-1"
                            disabled={isLoading}
                        >
                            <PlusCircle className="h-4 w-4 mr-2" /> Manage Payout Methods
                        </Button>
                    </div>
                    {payoutMethods.length === 0 && profile && (profile.withdrawable_balance || 0) >= MIN_WITHDRAWAL_AMOUNT && (
                        <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-4 text-center">
                            Please add a payout method to withdraw your balance.
                        </p>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Cash Transaction History</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {cashTransactionsError && (
                                <div className="text-center text-red-500 p-4">
                                    Error loading transactions: {cashTransactionsError}
                                </div>
                            )}

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Message</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cashTransactionsLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                                                <div className="flex items-center justify-center">
                                                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                    Loading transactions...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : paginatedCashTransactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                                                No cash transaction history yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedCashTransactions.map((transaction) => (
                                            <TableRow key={transaction.id}>
                                                <TableCell>{formatDateTime(transaction.created_at)}</TableCell>
                                                <TableCell>{transaction.description}</TableCell>
                                                <TableCell className="capitalize">{transaction.type?.replace(/_/g, ' ') || 'N/A'}</TableCell>
                                                <TableCell>{formatCurrencyFromCents(transaction.amount)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={transaction.status === "completed" || transaction.status === "credited" || transaction.status === "success" ? "default" : transaction.status === "pending" ? "secondary" : transaction.status === "failed" ? "destructive" : "outline"} className="capitalize">
                                                        {transaction.status?.replace(/_/g, ' ') || 'N/A'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-xs">
                                                    {transaction.remarks || "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

                            {/* Pagination Controls */}
                            {!cashTransactionsLoading && cashPagination.totalPages > 0 && (
                                <PaginationControls
                                    page={cashPagination.page}
                                    limit={cashPagination.limit}
                                    total={cashPagination.total}
                                    totalPages={cashPagination.totalPages}
                                    hasNextPage={cashPagination.hasNextPage}
                                    hasPreviousPage={cashPagination.hasPreviousPage}
                                    onPageChange={setCashPage}
                                    onLimitChange={setCashLimit}
                                    loading={cashTransactionsLoading}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {/* Cash Withdrawal Requests Section - Moved inside cash tab */}
                    <Card className="mt-8">
                        <CardHeader>
                            <CardTitle>Cash Withdrawal Request History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date Submitted</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Your Notes</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cashWithdrawalRequests.length > 0 ? (
                                        cashWithdrawalRequests.map((req) => (
                                            <TableRow key={req.id}><TableCell>{formatDateTime(req.created_at)}</TableCell><TableCell>{formatCurrencyFromCents(req.amount)}</TableCell><TableCell>{req.payout_method_summary}</TableCell><TableCell><Badge variant={req.status === "processed" ? "default" : req.status === "pending" || req.status === "approved" ? "secondary" : req.status === "cancelled" ? "outline" : "destructive"} className="capitalize">{req.status.replace(/_/g, ' ')}</Badge></TableCell><TableCell className="max-w-xs truncate">{req.user_notes || "N/A"}</TableCell><TableCell>{req.status === 'pending' && (<Button variant="ghost" size="sm" onClick={() => handleCancelWithdrawal(req.id, req.amount, req.amount_type)} disabled={isCancellingWithdrawal === req.id}>{isCancellingWithdrawal === req.id ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : ("Cancel")}</Button>)}</TableCell></TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No cash withdrawal requests yet.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Coin Wallet Tab */}
                <TabsContent value="coins">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Coins Earned</CardTitle>
                                <Coins className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCoins(userData.total_lifetime_coins_earned)}</div>
                                <p className="text-xs text-muted-foreground">Lifetime coin earnings</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Coins Available</CardTitle>
                                <CryptoWalletIcon className="h-4 w-4 text-muted-foreground" /> {/* Using renamed icon */}
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCoins(userData.coins)}</div>
                                <p className="text-xs text-muted-foreground">Your current coin balance</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalReferrals}</div>
                                <p className="text-xs text-muted-foreground">Successful referrals</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mb-6">
                        <Button className="w-full md:w-auto" disabled={true}> {/* Button disabled */}
                            <Gift className="h-4 w-4 mr-2" /> Redeem Coins (Coming Soon) {/* Text updated */}
                        </Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Coin Transaction History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Request ID</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {coinTransactions.length > 0 ? (
                                        coinTransactions.map((tx) => (
                                            <TableRow key={tx.id}><TableCell>{formatDateTime(tx.created_at)}</TableCell><TableCell>{tx.description}</TableCell><TableCell className="capitalize">{tx.type?.replace(/_/g, ' ') || 'N/A'}</TableCell><TableCell className={tx.coins > 0 ? "text-green-600" : "text-red-600"}>{tx.coins > 0 ? "+" : ""}{formatCoins(tx.coins)}</TableCell><TableCell><Badge variant={tx.status === "completed" || tx.status === "credited" ? "default" : tx.status === "pending" ? "secondary" : tx.status === "failed" ? "destructive" : "outline"} className="capitalize">{tx.status?.replace(/_/g, ' ') || 'N/A'}</Badge></TableCell><TableCell>{tx.withdrawal_request_id || "N/A"}</TableCell></TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No coin transaction history yet.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Coin Redemption Requests Section - Stays inside coin tab */}
                    <Card className="mt-8">
                        <CardHeader>
                            <CardTitle>Coin Redemption History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date Submitted</TableHead>
                                        <TableHead>Coins</TableHead>
                                        <TableHead>Redeemed Item</TableHead>
                                        <TableHead>User Notes</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {coinWithdrawalRequests.length > 0 ? (
                                        coinWithdrawalRequests.map((req) => (
                                            <TableRow key={req.id}><TableCell>{formatDateTime(req.created_at)}</TableCell><TableCell>{formatCoins(req.amount)}</TableCell><TableCell className="max-w-xs truncate">{req.redeemed_item_description ? (typeof req.redeemed_item_description === 'string' ? req.redeemed_item_description : (req.redeemed_item_description as any)?.name || JSON.stringify(req.redeemed_item_description)) : "N/A"}</TableCell><TableCell className="max-w-xs truncate">{req.user_notes || "N/A"}</TableCell><TableCell><Badge variant={req.status === "processed" ? "default" : req.status === "pending" || req.status === "approved" ? "secondary" : req.status === "cancelled" ? "outline" : "destructive"} className="capitalize">{req.status.replace(/_/g, ' ')}</Badge></TableCell><TableCell>{req.status === 'pending' && (<Button variant="ghost" size="sm" onClick={() => handleCancelWithdrawal(req.id, req.amount, req.amount_type)} disabled={isCancellingWithdrawal === req.id}>{isCancellingWithdrawal === req.id ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : ("Cancel")}</Button>)}</TableCell></TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No coin redemption requests yet.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Payout Methods Modal (Dialog) */}
            <Dialog open={isPayoutModalOpen} onOpenChange={(isOpen) => { if (isLoading && isOpen) return; setIsPayoutModalOpen(isOpen); if (!isOpen) resetPayoutForm(); }}>
                <DialogContent className="sm:max-w-[625px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{currentPayoutMethod?.id ? "Edit Payout Method" : "Add New Payout Method"}</DialogTitle>
                        <DialogDescription>
                            Manage your payout methods. Your default method will be pre-selected for withdrawals.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {/* Country selector controls which payout methods show */}
                        <div>
                            <Label htmlFor="payoutCountry">Country</Label>
                            <Select value={payoutCountry} onValueChange={(val) => {
                                const v = (val as 'IN' | 'OTHER');
                                setPayoutCountry(v);
                                setSelectedPayoutType(v === 'IN' ? 'upi' : 'crypto');
                            }} disabled={isLoading}>
                                <SelectTrigger id="payoutCountry"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="IN">India</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Tabs for payout types */}
                        <Tabs defaultValue={selectedPayoutType} onValueChange={(value) => setSelectedPayoutType(value as PayoutMethodType)} className="w-full">
                            {payoutCountry === 'IN' ? (
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="upi">UPI</TabsTrigger>
                                    <TabsTrigger value="bank_transfer">Bank Transfer</TabsTrigger>
                                    <TabsTrigger value="crypto">BNB (BEP20)</TabsTrigger>
                                </TabsList>
                            ) : (
                                <TabsList className="grid w-full grid-cols-1">
                                    <TabsTrigger value="crypto">BNB (BEP20)</TabsTrigger>
                                </TabsList>
                            )}
                            {/* Content for each payout type */}
                            <TabsContent value="crypto" className="pt-4 space-y-3">
                                <Label htmlFor="payoutFriendlyNameCrypto">Friendly Name</Label>
                                <Input id="payoutFriendlyNameCrypto" value={payoutFriendlyName} onChange={(e) => setPayoutFriendlyName(e.target.value)} placeholder="e.g., My Binance USDT" disabled={isLoading} />
                                <Label htmlFor="cryptoNetwork">Network</Label>
                                <Select value={cryptoNetwork} onValueChange={(val) => setCryptoNetwork(val)} disabled={isLoading}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BNB_BEP20">BNB Smart Chain (BEP20)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 p-2 text-xs">
                                    We only support BNB Smart Chain (BEP20). Do not enter ERC20/other chain addresses. Wrong address = funds lost.
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Crypto payouts are optional digital rewards. By choosing this method, you accept responsibility for declaring and paying taxes as per your country’s laws.
                                </p>
                                <Label htmlFor="cryptoAddress">Your Wallet Address</Label>
                                <Input id="cryptoAddress" value={cryptoAddress} onChange={(e) => setCryptoAddress(e.target.value)} placeholder={`Enter your ${cryptoNetwork} wallet address`} disabled={isLoading} />
                            </TabsContent>
                            {/* Bank Transfer Form (India) */}
                            <TabsContent value="bank_transfer" className="pt-4 space-y-3">
                                <Label htmlFor="payoutFriendlyNameBank">Friendly Name</Label>
                                <Input id="payoutFriendlyNameBank" value={payoutFriendlyName} onChange={(e) => setPayoutFriendlyName(e.target.value)} placeholder="e.g., Primary Savings" disabled={isLoading} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div><Label htmlFor="bankAccountHolder">Account Holder Name</Label><Input id="bankAccountHolder" value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} disabled={isLoading} /></div>
                                    <div><Label htmlFor="bankAccountNumber">Account Number</Label><Input id="bankAccountNumber" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} disabled={isLoading} /></div>
                                    <div><Label htmlFor="bankIfscCode">IFSC Code</Label><Input id="bankIfscCode" value={bankIfscCode} onChange={(e) => setBankIfscCode(e.target.value)} disabled={isLoading} /></div>
                                    <div><Label htmlFor="bankName">Bank Name (Optional)</Label><Input id="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={isLoading} /></div>
                                </div>
                                <p className="text-xs text-muted-foreground">Bank transfers may take 2–24 hours. Your bank may charge a small fee. You are responsible for declaring your earnings and paying any taxes as per Indian law.</p>
                            </TabsContent>

                            {/* UPI Form (India, default) */}
                            <TabsContent value="upi" className="pt-4 space-y-3">
                                <Label htmlFor="payoutFriendlyNameUpi">Friendly Name</Label>
                                <Input id="payoutFriendlyNameUpi" value={payoutFriendlyName} onChange={(e) => setPayoutFriendlyName(e.target.value)} placeholder="e.g., My UPI" disabled={isLoading} />
                                <Label htmlFor="upiHolder">Account Holder Name</Label>
                                <Input id="upiHolder" value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} placeholder="e.g., Rahul Kumar" disabled={isLoading} />
                                <Label htmlFor="upiId">UPI ID</Label>
                                <Input id="upiId" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@bank" disabled={isLoading} />
                                <p className="text-xs text-muted-foreground">UPI withdrawals are instant and usually free. You are responsible for declaring your earnings and paying any taxes as per Indian law.</p>
                            </TabsContent>
                        </Tabs>
                    </div>
                    <DialogFooter className="sm:justify-between">
                        <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                        <Button onClick={handleSavePayoutMethod} disabled={isLoading}>
                            {isLoading ? "Saving..." : (currentPayoutMethod?.id ? "Save Changes" : "Add Method")}
                        </Button>
                    </DialogFooter>

                    {payoutMethods.length > 0 && (
                        <div className="mt-6 pt-4 border-t">
                            <h3 className="text-lg font-medium mb-3">Your Saved Methods</h3>
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                {payoutMethods.map(method => (
                                    <div key={method.id} className="flex items-center justify-between p-3 border rounded-md bg-slate-50 dark:bg-slate-800">
                                        <div className="flex items-center">
                                            <PayoutMethodIcon type={method.method_type} />
                                            <div>
                                                <p className="font-medium text-sm">{getPayoutMethodSummary(method)}</p>
                                                {method.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {!method.is_default && <Button variant="ghost" size="sm" onClick={() => handleSetDefaultPayoutMethod(method.id)} disabled={isLoading}>Set Default</Button>}
                                            <Button variant="ghost" size="icon" onClick={() => handleEditPayoutMethod(method)} disabled={isLoading}><Edit3 className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDeletePayoutMethod(method.id)} disabled={isLoading}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Withdraw Balance Modal */}
            <Dialog open={isWithdrawModalOpen} onOpenChange={(isOpen) => { if (isSubmittingWithdrawal && isOpen) return; setIsWithdrawModalOpen(isOpen); }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Withdraw {activeTab === 'cash' ? 'Balance' : 'Coins'}</DialogTitle>
                        <DialogDescription>
                            Withdraw funds to your preferred payout method. Minimum withdrawal is {formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {activeTab === 'cash' && (
                            <>
                                <div className="text-lg">Available: <span className="font-semibold">{profile ? formatCurrencyFromCents(profile.withdrawable_balance) : formatCurrencyFromCents(0)}</span></div>
                                <div>
                                    <Label htmlFor="withdrawAmountDollars">Amount to Withdraw (USD)</Label>
                                    <Input id="withdrawAmountDollars" type="number" value={withdrawAmountDollars <= 0 ? '' : withdrawAmountDollars} onChange={(e) => setWithdrawAmountDollars(parseFloat(e.target.value) || 0)} min={MIN_WITHDRAWAL_AMOUNT / 100} step="0.01" placeholder="e.g., 50.00" disabled={isLoading} />
                                </div>
                            </>
                        )}
                        {activeTab === 'coins' && (
                            <>
                                <div className="text-lg">Available Coins: <span className="font-semibold">{formatCoins(userData?.coins || 0)}</span></div>
                                <div>
                                    <Label htmlFor="withdrawAmountCoins">Coins to Redeem</Label>
                                    <Input id="withdrawAmountCoins" type="number" value={withdrawAmountCoins <= 0 ? '' : withdrawAmountCoins} onChange={(e) => setWithdrawAmountCoins(parseInt(e.target.value, 10) || 0)} placeholder="e.g., 1000" disabled={isLoading} />
                                </div>
                            </>
                        )}
                        <div>
                            <Label htmlFor="withdrawalUserNotes">Notes (Optional)</Label>
                            <Input
                                id="withdrawalUserNotes"
                                value={withdrawalUserNotes}
                                onChange={(e) => setWithdrawalUserNotes(e.target.value)}
                                placeholder="Optional notes for your withdrawal request"
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <Label htmlFor="payoutMethodSelect">Select Payout Method</Label>
                            <Select
                                value={selectedWithdrawMethodId || ""}
                                onValueChange={setSelectedWithdrawMethodId}
                                disabled={isLoading || payoutMethods.length === 0}
                            >
                                <SelectTrigger id="payoutMethodSelect">
                                    <SelectValue placeholder="Choose a method..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {payoutMethods.filter(m => m.is_default).map(method => (
                                        <SelectItem key={method.id} value={method.id}>{getPayoutMethodSummary(method)} (Default)</SelectItem>
                                    ))}
                                    {payoutMethods.filter(m => !m.is_default).map(method => (
                                        <SelectItem key={method.id} value={method.id}>{getPayoutMethodSummary(method)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {payoutMethods.length === 0 && <p className="text-sm text-red-500">You have no payout methods. Please add one first.</p>}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                        <Button
                            onClick={handleWithdraw}
                            loading={isSubmittingWithdrawal}
                            loadingText="Processing..."
                            disabled={
                                !selectedWithdrawMethodId ||
                                (activeTab === 'cash' && withdrawAmountDollars < (MIN_WITHDRAWAL_AMOUNT / 100)) ||
                                (activeTab === 'cash' && (!profile || (withdrawAmountDollars * 100) > (profile.withdrawable_balance || 0))) ||
                                (activeTab === 'coins' && (!userData || withdrawAmountCoins > (userData.coins || 0) || withdrawAmountCoins <= 0)) ||
                                // For coins, payoutMethod is optional, so don't disable if it's not selected and tab is coins
                                (activeTab === 'cash' && !selectedWithdrawMethodId) ||
                                (activeTab === 'cash' && payoutMethods.length === 0)
                            }
                        >
                            Request Withdrawal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}