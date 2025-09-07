"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsContent as TabsContent,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Wallet as CryptoWalletIcon,
  Sparkles,
  Power,
  Loader2,
  TrendingDown,
  BarChart3,
  Banknote,
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import {
  CashTransaction,
  CoinTransaction,
  AdvertiserProfileData,
  PayoutMethod,
  PayoutMethodType,
  UserData,
  WithdrawalRequest,
  PayoutMethodDetails,
  BillingClientPageProps,
} from "@/types/earnings";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { MIN_WITHDRAWAL_AMOUNT } from "@/constants/subscriptionPlans";
import { toast } from "sonner";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { WalletTopUp } from "@/components/WalletTopUp";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { SubscriptionManagement } from "@/components/SubscriptionManagement";
import { SubscriptionManagementBilling } from "@/components/SubscriptionManagementBilling";

const formatCoins = (coins: number | bigint = 0): string => {
  return new Intl.NumberFormat().format(Number(coins));
};

const formatDateTime = (dateString?: string): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString();
};
const tabs = [
  { id: "cash", label: "Cash Account" },
  { id: "coins", label: "Coin Wallet" },
  { id: "subscription", label: "Subscription" },
];

export default function BillingClientPage({
  initialAuthUser,
  initialProfile,
  initialUserData,
  initialCashTransactions, // Note: Not used anymore, kept for compatibility
  initialCoinTransactions,
  initialPayoutMethods,
  initialWithdrawalRequests,
}: BillingClientPageProps) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get initial tab from URL parameter, fallback to "cash"
  const initialTab = searchParams.get('tab') || "cash";
  const { activeTab, setActiveTab } = useTabState(tabs, { defaultTab: initialTab });

  // States derived from props, allowing client-side updates
  const [authUser, setAuthUser] = useState<User | null>(initialAuthUser);
  const [profile, setProfile] = useState<AdvertiserProfileData | null>(
    initialProfile
  );
  const [userData, setUserData] = useState<UserData | null>(initialUserData);
  // Note: Cash transactions now handled by pagination hook
  const [coinTransactions, setCoinTransactionsState] = useState<
    CoinTransaction[]
  >(initialCoinTransactions);
  const [payoutMethods, setPayoutMethods] =
    useState<PayoutMethod[]>(initialPayoutMethods);
  const [withdrawalRequests, setWithdrawalRequests] = useState<
    WithdrawalRequest[]
  >(initialWithdrawalRequests);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [isCancellingWithdrawal, setIsCancellingWithdrawal] = useState<
    string | null
  >(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);

  // Modal States
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [currentPayoutMethod, setCurrentPayoutMethod] =
    useState<PayoutMethod | null>(null);
  const [activeTabModal, setActiveTabModal] = useState<"cash" | "coins">(
    "cash"
  );
  const [selectedPayoutType, setSelectedPayoutType] =
    useState<PayoutMethodType>("crypto");

  // Form States for Payout Methods
  const [payoutFriendlyName, setPayoutFriendlyName] = useState("");
  const [payoutCountry, setPayoutCountry] = useState<"IN" | "OTHER">("IN");
  const [cryptoNetwork, setCryptoNetwork] = useState("BNB_BEP20");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranchName, setBankBranchName] = useState("");
  const [bankCountry, setBankCountry] = useState("IN");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");

  // Withdrawal form states
  const [withdrawAmountDollars, setWithdrawAmountDollars] = useState<number>(0);
  const [withdrawAmountCoins, setWithdrawAmountCoins] = useState<number>(0);
  const [selectedWithdrawMethodId, setSelectedWithdrawMethodId] = useState<
    string | null
  >(null);
  const [withdrawalUserNotes, setWithdrawalUserNotes] = useState("");


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

  // Get payout method summary
  const getPayoutMethodSummary = (method: PayoutMethod): string => {
    switch (method.method_type) {
      case "crypto":
        return `${method.details?.network?.toUpperCase() || 'Crypto'} Wallet: ...${method.details?.wallet_address?.slice(-4) || 'XXXX'} (${method.friendly_name || 'Crypto'})`;
      case "upi":
        return `UPI: ${method.details?.upi_id || 'N/A'} (${method.friendly_name || 'UPI'})`;
      case "bank_transfer":
        return `Bank: ...${method.details?.account_number?.slice(-4) || 'XXXX'} (${method.friendly_name || 'Bank'})`;
      default:
        return "Unknown Method Type";
    }
  };

  const getPayoutMethodSummaryById = (methodId: string | null): string => {
    if (!methodId) return "Payout method deleted or N/A";
    const method = payoutMethods.find(p => p.id === methodId);
    return method ? getPayoutMethodSummary(method) : "Unknown Method";
  };

  // Initialize data when props change
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

  // Reset form function
  const resetPayoutForm = () => {
    setCurrentPayoutMethod(null);
    setSelectedPayoutType("crypto");
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
    setPayoutCountry('IN');
  };

  // Simple BNB Smart Chain (BEP20) wallet validation: 0x + 40 hex chars
  const isValidBep20Address = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  };

  // Handle save payout method
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
      if (!isValidBep20Address(cryptoAddress)) {
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

    try {
      const { data, error } = await supabase
        .from('payout_methods')
        .upsert(methodToSave)
        .select()
        .single();

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
      console.error("Error saving payout method:", error);
      toast.error(`Failed to save payout method: ${error.message || 'Unknown error'}`);
    }
    setIsLoading(false);
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
    const { error } = await supabase.from("payout_methods").delete().eq("id", methodId);
    setIsLoading(false);
    if (error) {
      console.error("Error deleting payout method:", error);
      toast.error(`Failed to delete method: ${error.message}`);
    } else {
      setPayoutMethods(payoutMethods.filter(p => p.id !== methodId));
      toast.success("Payout method deleted.");
    }
  };

  const handleSetDefaultPayoutMethod = async (methodId: string) => {
    if (!authUser) return;
    setIsLoading(true);
    // Set all others to false for this user
    const { error: unsetError } = await supabase
      .from("payout_methods")
      .update({ is_default: false })
      .eq("user_id", authUser.id);

    if (unsetError) {
      console.error("Error unsetting other defaults:", unsetError);
    }

    const { data, error } = await supabase
      .from("payout_methods")
      .update({ is_default: true })
      .eq("id", methodId)
      .eq("user_id", authUser.id)
      .select()
      .single();
    setIsLoading(false);

    if (error) {
      console.error("Error setting default payout method:", error);
      toast.error(`Failed to set default method: ${error.message}`);
    } else if (data) {
      setPayoutMethods(payoutMethods.map(p => ({ ...p, is_default: p.id === data.id })));
      toast.success("Default payout method updated.");
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
    let amountTypeForRpc: 'cash' | 'coins' = activeTabModal;
    let redeemedItemDescForRpc: any | null = null;

    if (activeTabModal === 'cash') {
      if (withdrawAmountDollars <= 0) {
        toast.error("Please enter a valid withdrawal amount.");
        return;
      }
      if (withdrawAmountDollars < minWithdrawalDollars) {
        toast.error(`Minimum cash withdrawal amount is ${formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}.`);
        return;
      }
      amountToWithdraw = Math.round(withdrawAmountDollars * 100); // Convert to cents
      if (amountToWithdraw > (profile.withdrawable_balance || 0)) {
        toast.error("Insufficient cash balance.");
        return;
      }
    } else { // activeTabModal === 'coins'
      if (withdrawAmountCoins <= 0) {
        toast.error("Please enter a valid coin amount to redeem.");
        return;
      }
      amountToWithdraw = withdrawAmountCoins;
      currencyForRpc = 'COIN';
      redeemedItemDescForRpc = { placeholder: "Item to be redeemed" };
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

    console.log("Calling create_advertiser_withdrawal_request with args:", JSON.stringify(rpcArgs, null, 2));

    setIsSubmittingWithdrawal(true);
    const { data: rpcResponse, error: rpcError } = await supabase.rpc('create_advertiser_withdrawal_request', rpcArgs);
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
        setProfile(prev => prev ? ({ ...prev, withdrawable_balance: (prev.withdrawable_balance || 0) - (createdRequest.amount) }) : null);
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

  // Handle balance update after successful top-up
  const handleBalanceUpdate = (newBalanceInCents: number) => {
    console.log('💰 BillingPage: Balance update received:', newBalanceInCents);
    console.log('💰 BillingPage: Previous balance was:', profile?.available_deposit_balance);

    setProfile(prev => {
      const updated = prev ? { ...prev, available_deposit_balance: newBalanceInCents } : null;
      console.log('💰 BillingPage: Profile updated:', updated);
      return updated;
    });

    // Refresh paginated transactions to show the new deposit
    console.log('🔄 BillingPage: Refreshing transaction history...');
    refreshCashTransactions();
  };

  const handleCancelWithdrawal = async (requestId: string, amountToRestore: number, amountType: 'cash' | 'coins') => {
    if (!authUser || !profile || !userData) return;
    if (!confirm("Are you sure you want to cancel this withdrawal request? The funds will be returned to your balance.")) {
      return;
    }
    setIsCancellingWithdrawal(requestId);

    const { data: rpcSuccess, error: rpcError } = await supabase.rpc('cancel_advertiser_withdrawal_request_by_user', {
      p_request_id: requestId,
      p_user_id: authUser.id
    });

    setIsCancellingWithdrawal(null);

    if (rpcError) {
      console.error("Error cancelling withdrawal request via RPC:", rpcError);
      toast.error(`Failed to cancel request: ${rpcError.message}`);
    } else if (rpcSuccess === true) {
      if (amountType === 'cash') {
        setProfile(prev => prev ? ({ ...prev, withdrawable_balance: (prev.withdrawable_balance || 0) + (amountToRestore) }) : null);
      } else {
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

  // Payout method icon component
  const PayoutMethodIcon = ({ type }: { type: PayoutMethodType }) => {
    switch (type) {
      case "crypto":
        return <CryptoWalletIcon className="h-5 w-5 mr-3 text-orange-500" />;
      case "upi":
        return <Sparkles className="h-5 w-5 mr-3 text-purple-500" />;
      case "bank_transfer":
        return <Landmark className="h-5 w-5 mr-3 text-blue-500" />;
      default:
        return <CreditCard className="h-5 w-5 mr-3 text-gray-500" />;
    }
  };

  // Handle checkout success - with protection against infinite loops
  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');

    if (success === 'true' && sessionId && !hasProcessedSuccess) {
      console.log('🎉 Payment successful, refreshing subscription data...');
      setHasProcessedSuccess(true);
      toast.success('Payment successful! Your subscription has been updated.');

      // Clear URL parameters to prevent refresh loops
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Refresh the page data to get updated subscription info
      const refreshData = async () => {
        try {
          // Give the webhook a moment to process
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Refresh the current page to get updated data
          window.location.reload();
        } catch (error) {
          console.error('Error refreshing data:', error);
        }
      };

      refreshData();
    }
  }, [searchParams, hasProcessedSuccess]);

  if (!authUser || !profile || !userData) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading billing data or not authenticated...</p>
        </div>
      </div>
    );
  }

  // Derived state for total referrals
  const totalReferrals = (userData.advertisers_referred || 0) + (userData.creators_referred || 0);

  // Filter withdrawal requests for display
  const cashWithdrawalRequests = withdrawalRequests.filter(req => req.amount_type === 'cash');
  const coinWithdrawalRequests = withdrawalRequests.filter(req => req.amount_type === 'coins');


  return (
    <div className="container max-w-[1200px] mx-auto py-8 md:px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Billing & Account</h1>
      </div>

      {/* <Tabs defaultValue="cash" className="w-full" onValueChange={(value) => setActiveTab(value as 'cash' | 'coins')}>
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="cash">
                        <DollarSign className="h-5 w-5 mr-2" /> Cash Account
                    </TabsTrigger>
                    <TabsTrigger value="coins">
                        <Coins className="h-5 w-5 mr-2" /> Coin Wallet
                    </TabsTrigger>
                    <TabsTrigger value="subscription">
                        <CreditCard className="h-5 w-5 mr-2" /> Subscription
                    </TabsTrigger>
                </TabsList> */}
      {/* Tabs */}
      <EnhancedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mt-12 mb-10"
      />

      {/* Cash Account Tab */}
      <TabContent activeTab={activeTab}>
        <TabPanel value="cash" activeTab={activeTab}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-10">
            {/*Total Spent*/}
            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 text-black space-y-3">
                  <p className="text-lg font-medium">Total Spent</p>
                  <p className="text-xl font-bold">
                    {formatCurrencyFromCents(profile.total_money_spent)}
                  </p>
                  <p className="text-md">Lifetime contest spending</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Spent
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrencyFromCents(profile.total_money_spent)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Lifetime contest spending
                </p>
              </CardContent>
            </Card> */}
            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 text-black space-y-3">
                  <p className="text-lg font-medium">Contests Run</p>
                  <p className="text-xl font-bold">
                    {profile.total_contests_run}
                  </p>
                  <p className="text-md">Total contests created</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Contests Run
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {profile.total_contests_run}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total contests created
                </p>
              </CardContent>
            </Card> */}

            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 text-black space-y-3">
                  <p className="text-lg font-medium">Available Balance</p>
                  <p className="text-xl font-bold">
                    {formatCurrencyFromCents(profile.available_deposit_balance)}
                  </p>
                  <p className="text-md">Ready for contests</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                  <Banknote className="h-5 w-5" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Available Balance
                </CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold transition-all duration-300 ease-in-out">
                  {formatCurrencyFromCents(profile.available_deposit_balance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ready for contests
                </p>
              </CardContent>
            </Card> */}

            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 text-black space-y-3">
                  <p className="text-lg font-medium">Withdrawable Balance</p>
                  <p className="text-xl font-bold">
                    {formatCurrencyFromCents(profile.withdrawable_balance)}
                  </p>
                  <p className="text-md">From referrals & bonuses</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                  <Banknote className="h-5 w-5" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Withdrawable Balance
                </CardTitle>
                <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrencyFromCents(profile.withdrawable_balance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From referrals & bonuses
                </p>
              </CardContent>
            </Card> */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Button
              size="lg"
              onClick={() => setIsTopUpModalOpen(true)}
              className="bg-[#6C43D0] text-md text-white"
              disabled={isLoading}
            >
              <CreditCard className="h-5 w-5" /> Top Up Wallet
            </Button>
            <Button
              className="bg-[#6C43D0] text-md text-white"
              onClick={() => setIsWithdrawModalOpen(true)}
              size="lg"
              variant="outline"
              disabled={
                !profile ||
                (profile.withdrawable_balance || 0) < MIN_WITHDRAWAL_AMOUNT ||
                payoutMethods.length === 0 ||
                isLoading
              }
            >
              <ArrowDownToLine className="h-4 w-4 mr-2" /> Withdraw Balance
            </Button>
            <Button
              className="bg-[#6C43D0] text-md text-white"
              size="lg"
              variant="outline"
              onClick={() => {
                resetPayoutForm();
                setIsPayoutModalOpen(true);
              }}
              disabled={isLoading}
            >
              <PlusCircle className="h-4 w-4 mr-2" /> Manage Payout Methods
            </Button>
          </div>

          {payoutMethods.length === 0 && (
            <p className="text-sm text-black mb-4 text-center">
              Please add a payout method to withdraw your balance.
            </p>
          )}

          <div className="bg-white rounded-xl shadow">
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
                  <TableRow className="text-left bg-[#F9FAFB] text-gray-500 border-b">
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
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground h-32"
                      >
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin mr-2" />
                          Loading transactions...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedCashTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground h-32"
                      >
                        No cash transaction history yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCashTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDateTime(transaction.created_at)}
                        </TableCell>
                        <TableCell>
                          {transaction.description || "No description"}
                        </TableCell>
                        <TableCell className="capitalize">
                          {transaction.type?.replace(/_/g, " ") || "N/A"}
                        </TableCell>
                        <TableCell>
                          {formatCurrencyFromCents(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.status === "completed" ||
                                transaction.status === "credited" ||
                                transaction.status === "success"
                                ? "default"
                                : transaction.status === "pending"
                                  ? "secondary"
                                  : transaction.status === "failed"
                                    ? "destructive"
                                    : "outline"
                            }
                            className={`capitalize px-3 py-1 rounded-full text-sm font-medium
                              ${transaction.status === "completed" ||
                                transaction.status === "credited" ||
                                transaction.status === "success"
                                ? "bg-green-100 text-green-700 border-green-300"
                                : transaction.status === "pending"
                                  ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                                  : transaction.status === "failed"
                                    ? "bg-red-100 text-red-700 border-red-300"
                                    : "bg-gray-100 text-gray-700 border-gray-300"
                              }
                            `}
                          >
                            {transaction.status?.replace(/_/g, " ") || "N/A"}
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
          </div>

          {/* Cash Withdrawal Requests */}
          <div className="mt-8 bg-white rounded-xl shadow">
            <CardHeader>
              <CardTitle>Cash Withdrawal Request History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="text-left bg-[#F9FAFB] text-gray-500 border-b">
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
                      <TableRow key={req.id}>
                        <TableCell>{formatDateTime(req.created_at)}</TableCell>
                        <TableCell>
                          {formatCurrencyFromCents(req.amount)}
                        </TableCell>
                        <TableCell>{req.payout_method_summary}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              req.status === "processed"
                                ? "default"
                                : req.status === "pending" ||
                                  req.status === "approved"
                                  ? "secondary"
                                  : req.status === "cancelled"
                                    ? "outline"
                                    : "destructive"
                            }
                            className="capitalize"
                          >
                            {req.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {req.user_notes || "N/A"}
                        </TableCell>
                        <TableCell>
                          {req.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleCancelWithdrawal(
                                  req.id,
                                  req.amount,
                                  req.amount_type
                                )
                              }
                              disabled={isCancellingWithdrawal === req.id}
                            >
                              {isCancellingWithdrawal === req.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                "Cancel"
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-12 text-muted-foreground"
                      >
                        No cash withdrawal requests yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </div>
        </TabPanel>

        {/* Coin Wallet Tab */}
        <TabPanel value="coins" activeTab={activeTab}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 text-black space-y-3">
                  <p className="text-lg font-medium">Total Coins Earned</p>
                  <p className="text-xl font-bold">
                    {formatCoins(userData.total_lifetime_coins_earned)}
                  </p>
                  <p className="text-md">Lifetime coin earnings</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                  <Banknote className="h-5 w-5" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Coins Earned
                </CardTitle>
                <Coins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCoins(userData.total_lifetime_coins_earned)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Lifetime coin earnings
                </p>
              </CardContent>
            </Card> */}

            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 text-black space-y-3">
                  <p className="text-lg font-medium">Coins Available</p>
                  <p className="text-xl font-bold">
                    {formatCoins(userData.coins)}
                  </p>
                  <p className="text-md">Your current coin balance</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                  <CryptoWalletIcon className="h-4 w-4" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Coins Available
                </CardTitle>
                <CryptoWalletIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCoins(userData.coins)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Your current coin balance
                </p>
              </CardContent>
            </Card> */}

            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 text-black space-y-3">
                  <p className="text-lg font-medium">Total Referrals</p>
                  <p className="text-xl font-bold">{totalReferrals}</p>
                  <p className="text-md">Successful referrals</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                  <Users className="h-4 w-4" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Referrals
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalReferrals}</div>
                <p className="text-xs text-muted-foreground">
                  Successful referrals
                </p>
              </CardContent>
            </Card> */}
          </div>

          <div className="mb-6">
            <Button className="w-full md:w-auto bg-[#6C43D0] text-md text-white" disabled={true}>
              <Gift className="h-4 w-4 mr-2" /> Redeem Coins (Coming Soon)
            </Button>
          </div>

          <div className="bg-white rounded-xl shadow">
            <CardHeader>
              <CardTitle>Coin Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="text-left bg-[#F9FAFB] text-gray-500 border-b">
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coinTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground"
                      >
                        No coin transaction history yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    coinTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDateTime(transaction.created_at)}
                        </TableCell>
                        <TableCell>
                          {transaction.description || "No description"}
                        </TableCell>
                        <TableCell className="capitalize">
                          {transaction.type?.replace(/_/g, " ") || "N/A"}
                        </TableCell>
                        <TableCell
                          className={
                            transaction.coins > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {transaction.coins > 0 ? "+" : ""}
                          {formatCoins(transaction.coins)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.status === "completed" ||
                                transaction.status === "credited"
                                ? "default"
                                : transaction.status === "pending"
                                  ? "secondary"
                                  : transaction.status === "failed"
                                    ? "destructive"
                                    : "outline"
                            }
                            className="capitalize"
                          >
                            {transaction.status?.replace(/_/g, " ") || "N/A"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </div>

          {/* Coin Withdrawal Requests */}
          <div className="mt-8 bg-white rounded-xl shadow">
            <CardHeader>
              <CardTitle>Coin Redemption History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="text-left bg-[#F9FAFB] text-gray-500 border-b">
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
                      <TableRow key={req.id}>
                        <TableCell>{formatDateTime(req.created_at)}</TableCell>
                        <TableCell>{formatCoins(req.amount)}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {req.redeemed_item_description
                            ? typeof req.redeemed_item_description === "string"
                              ? req.redeemed_item_description
                              : (req.redeemed_item_description as any)?.name ||
                              JSON.stringify(req.redeemed_item_description)
                            : "N/A"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {req.user_notes || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              req.status === "processed"
                                ? "default"
                                : req.status === "pending" ||
                                  req.status === "approved"
                                  ? "secondary"
                                  : req.status === "cancelled"
                                    ? "outline"
                                    : "destructive"
                            }
                            className="capitalize"
                          >
                            {req.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {req.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleCancelWithdrawal(
                                  req.id,
                                  req.amount,
                                  req.amount_type
                                )
                              }
                              disabled={isCancellingWithdrawal === req.id}
                            >
                              {isCancellingWithdrawal === req.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                "Cancel"
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-4 text-muted-foreground"
                      >
                        No coin redemption requests yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </div>
        </TabPanel>

        {/* Subscription Tab */}
        <TabPanel value="subscription" activeTab={activeTab}>
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-xl">
              <CardHeader>
                <CardTitle>Subscription Management</CardTitle>
                <CardDescription>
                  Manage your subscription plan, billing, and payment methods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionManagementBilling />
              </CardContent>
            </div>
          </div>
        </TabPanel>
      </TabContent>

      {/* Payout Methods Modal */}
      <Dialog
        open={isPayoutModalOpen}
        onOpenChange={(isOpen) => {
          if (isLoading && isOpen) return;
          setIsPayoutModalOpen(isOpen);
          if (!isOpen) resetPayoutForm();
        }}
      >
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {currentPayoutMethod?.id
                ? "Edit Payout Method"
                : "Add New Payout Method"}
            </DialogTitle>
            <DialogDescription>
              Manage your payout methods. Your default method will be
              pre-selected for withdrawals.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Country selector controls which payout methods show */}
            <div>
              <Label htmlFor="payoutCountry">Country</Label>
              <Select
                value={payoutCountry}
                onValueChange={(val) => {
                  const v = val as "IN" | "OTHER";
                  setPayoutCountry(v);
                  setSelectedPayoutType(v === "IN" ? "upi" : "crypto");
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="payoutCountry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">India</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Tabs for payout types */}
            <Tabs
              defaultValue={selectedPayoutType}
              onValueChange={(value) =>
                setSelectedPayoutType(value as PayoutMethodType)
              }
              className="w-full"
            >
              {payoutCountry === "IN" ? (
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

              <TabsContent value="crypto" className="pt-4 space-y-3">
                <Label htmlFor="payoutFriendlyNameCrypto">Friendly Name</Label>
                <Input
                  id="payoutFriendlyNameCrypto"
                  value={payoutFriendlyName}
                  onChange={(e) => setPayoutFriendlyName(e.target.value)}
                  placeholder="e.g., My Binance USDT"
                  disabled={isLoading}
                />
                <Label htmlFor="cryptoNetwork">Network</Label>
                <Select
                  value={cryptoNetwork}
                  onValueChange={(val) => setCryptoNetwork(val)}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BNB_BEP20">
                      BNB Smart Chain (BEP20)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Label htmlFor="cryptoAddress">Your Wallet Address</Label>
                <Input
                  id="cryptoAddress"
                  value={cryptoAddress}
                  onChange={(e) => setCryptoAddress(e.target.value)}
                  placeholder={`Enter your ${cryptoNetwork} wallet address`}
                  disabled={isLoading}
                />
                <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 p-2 text-xs">
                  We only support BNB Smart Chain (BEP20). Do not enter
                  ERC20/other chain addresses. Wrong address = funds lost.
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Crypto payouts are optional digital rewards. By choosing this
                  method, you accept responsibility for declaring and paying
                  taxes as per your country’s laws.
                </p>
              </TabsContent>

              {/* Bank Transfer Form (India) */}
              <TabsContent value="bank_transfer" className="pt-4 space-y-3">
                <Label htmlFor="payoutFriendlyNameBank">Friendly Name</Label>
                <Input
                  id="payoutFriendlyNameBank"
                  value={payoutFriendlyName}
                  onChange={(e) => setPayoutFriendlyName(e.target.value)}
                  placeholder="e.g., Primary Savings"
                  disabled={isLoading}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bankAccountHolder">
                      Account Holder Name
                    </Label>
                    <Input
                      id="bankAccountHolder"
                      value={bankAccountHolder}
                      onChange={(e) => setBankAccountHolder(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankAccountNumber">Account Number</Label>
                    <Input
                      id="bankAccountNumber"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankIfscCode">IFSC Code</Label>
                    <Input
                      id="bankIfscCode"
                      value={bankIfscCode}
                      onChange={(e) => setBankIfscCode(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankName">Bank Name (Optional)</Label>
                    <Input
                      id="bankName"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bank transfers may take 2–24 hours. Your bank may charge a
                  small fee. You are responsible for declaring your earnings and
                  paying any taxes as per Indian law.
                </p>
              </TabsContent>

              {/* UPI Form (India, default) */}
              <TabsContent value="upi" className="pt-4 space-y-3">
                <Label htmlFor="payoutFriendlyNameUpi">Friendly Name</Label>
                <Input
                  id="payoutFriendlyNameUpi"
                  value={payoutFriendlyName}
                  onChange={(e) => setPayoutFriendlyName(e.target.value)}
                  placeholder="e.g., My UPI"
                  disabled={isLoading}
                />
                <Label htmlFor="upiHolder">Account Holder Name</Label>
                <Input
                  id="upiHolder"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder="e.g., Rahul Kumar"
                  disabled={isLoading}
                />
                <Label htmlFor="upiId">UPI ID</Label>
                <Input
                  id="upiId"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="yourname@bank"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  UPI withdrawals are instant and usually free. You are
                  responsible for declaring your earnings and paying any taxes
                  as per Indian law.
                </p>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="sm:justify-between">
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleSavePayoutMethod} disabled={isLoading}>
              {isLoading
                ? "Saving..."
                : currentPayoutMethod?.id
                  ? "Save Changes"
                  : "Add Method"}
            </Button>
          </DialogFooter>

          {payoutMethods.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-lg font-medium mb-3">Your Saved Methods</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {payoutMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-3 border rounded-md bg-slate-50 dark:bg-slate-800"
                  >
                    <div className="flex items-center">
                      <PayoutMethodIcon type={method.method_type} />
                      <div>
                        <p className="font-medium text-sm">
                          {getPayoutMethodSummary(method)}
                        </p>
                        {method.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!method.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleSetDefaultPayoutMethod(method.id)
                          }
                          disabled={isLoading}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditPayoutMethod(method)}
                        disabled={isLoading}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDeletePayoutMethod(method.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Balance Modal */}
      <Dialog
        open={isWithdrawModalOpen}
        onOpenChange={(isOpen) => {
          if (isSubmittingWithdrawal && isOpen) return;
          setIsWithdrawModalOpen(isOpen);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Withdraw {activeTabModal === "cash" ? "Balance" : "Coins"}
            </DialogTitle>
            <DialogDescription>
              Withdraw funds to your preferred payout method. Minimum withdrawal
              is {formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {activeTabModal === "cash" && (
              <>
                <div className="text-lg">
                  Available:{" "}
                  <span className="font-semibold">
                    {profile
                      ? formatCurrencyFromCents(profile.withdrawable_balance)
                      : formatCurrencyFromCents(0)}
                  </span>
                </div>
                <div>
                  <Label htmlFor="withdrawAmountDollars">
                    Amount to Withdraw (USD)
                  </Label>
                  <Input
                    id="withdrawAmountDollars"
                    type="number"
                    value={
                      withdrawAmountDollars <= 0 ? "" : withdrawAmountDollars
                    }
                    onChange={(e) =>
                      setWithdrawAmountDollars(parseFloat(e.target.value) || 0)
                    }
                    min={MIN_WITHDRAWAL_AMOUNT / 100}
                    step="0.01"
                    placeholder="e.g., 50.00"
                    disabled={isLoading}
                  />
                </div>
              </>
            )}
            {activeTabModal === "coins" && (
              <>
                <div className="text-lg">
                  Available Coins:{" "}
                  <span className="font-semibold">
                    {formatCoins(userData?.coins || 0)}
                  </span>
                </div>
                <div>
                  <Label htmlFor="withdrawAmountCoins">Coins to Redeem</Label>
                  <Input
                    id="withdrawAmountCoins"
                    type="number"
                    value={withdrawAmountCoins <= 0 ? "" : withdrawAmountCoins}
                    onChange={(e) =>
                      setWithdrawAmountCoins(parseInt(e.target.value, 10) || 0)
                    }
                    placeholder="e.g., 1000"
                    disabled={isLoading}
                  />
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
                  {payoutMethods
                    .filter((m) => m.is_default)
                    .map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {getPayoutMethodSummary(method)} (Default)
                      </SelectItem>
                    ))}
                  {payoutMethods
                    .filter((m) => !m.is_default)
                    .map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {getPayoutMethodSummary(method)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {payoutMethods.length === 0 && (
              <p className="text-sm text-red-500">
                You have no payout methods. Please add one first.
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleWithdraw}
              loading={isSubmittingWithdrawal}
              loadingText="Processing..."
              disabled={
                !selectedWithdrawMethodId ||
                (activeTabModal === "cash" &&
                  withdrawAmountDollars < MIN_WITHDRAWAL_AMOUNT / 100) ||
                (activeTabModal === "cash" &&
                  (!profile ||
                    withdrawAmountDollars * 100 >
                    (profile.withdrawable_balance || 0))) ||
                (activeTabModal === "coins" &&
                  (!userData ||
                    withdrawAmountCoins > (userData.coins || 0) ||
                    withdrawAmountCoins <= 0)) ||
                (activeTabModal === "cash" && !selectedWithdrawMethodId) ||
                (activeTabModal === "cash" && payoutMethods.length === 0)
              }
            >
              Request Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top Up Wallet Modal */}
      <Dialog
        open={isTopUpModalOpen}
        onOpenChange={(open) => {
          // Prevent closing if payment is processing
          if (!open && isProcessingPayment) {
            return; // Don't close
          }
          setIsTopUpModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Top Up Your Wallet
              {isProcessingPayment && (
                <span className="text-sm text-orange-600 font-normal">
                  (Processing - Please wait)
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Add funds to your wallet balance for contest payments. Your wallet
              balance can be used for all contest fees.
              {isProcessingPayment && (
                <span className="block mt-2 text-orange-600 text-sm">
                  ⚠️ Please don't close this window while payment is processing
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <WalletTopUp
              currentBalance={profile?.available_deposit_balance || 0}
              onBalanceUpdate={handleBalanceUpdate}
              onClose={() => setIsTopUpModalOpen(false)}
              onTransactionUpdate={() => {
                // Refresh paginated transaction history
                console.log(
                  "🔄 BillingPage: Refreshing transaction history from WalletTopUp..."
                );
                refreshCashTransactions();
              }}
              onProcessingChange={setIsProcessingPayment}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
