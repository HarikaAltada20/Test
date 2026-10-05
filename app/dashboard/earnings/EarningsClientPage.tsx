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
  // DialogTrigger, // Not always needed if controlled by state
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
  Info,
  Trophy,
  Coins,
  Gift,
  Users,
  PlusCircle,
  Settings2,
  Trash2,
  Edit3,
  CreditCard,
  Landmark,
  Wallet as CryptoWalletIcon, // Renamed to avoid conflict
  Wallet,
  Sparkles,
  Power,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Mail,
} from "lucide-react";
import { SkydoStatusBadge } from "@/components/payouts/SkydoStatusBadge";
import {
  PayoutMethodDialog,
  type PayoutSaveResult,
} from "@/components/payouts/payout-method-dialog/PayoutMethodDialog";
import {
  WithdrawBalanceDialog,
  type WithdrawRequest,
  type WithdrawSubmitResult,
} from "@/components/payouts/withdraw-dialog/WithdrawBalanceDialog";
import { canRemoveSkydo, getSkydoStatus, isSkydoUsable } from "@/lib/skydo-payout";
import {
  getSupabaseErrorMessage,
  type PayoutMethodDraft,
} from "@/lib/payout-method-validation";
import { User } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client"; // Client Supabase
import {
  CashTransaction,
  CoinTransaction,
  CreatorProfileData,
  PayoutMethod,
  PayoutMethodType,
  UserData,
  WithdrawalRequest,
  PayoutMethodDetails,
} from "@/types/earnings"; // Centralized types
import {
  formatCurrencyFromCents,
  formatErrorWithCurrency,
} from "@/lib/currency-utils";
import { MIN_WITHDRAWAL_AMOUNT } from "@/constants/subscriptionPlans";
import { toast } from "sonner"; // Import toast
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { cn } from "@/lib/utils";
import { WITHDRAWAL_REVIEW_TRIGGER_EVENT } from "@/lib/review-events";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const tabs = [
  { id: "cash", label: "Cash" },
  { id: "coins", label: "Coins" },
];
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
  const { activeTab, setActiveTab } = useTabState(tabs, { defaultTab: "cash" });

  // States derived from props, allowing client-side updates
  const [authUser, setAuthUser] = useState<User | null>(initialAuthUser);
  const [profile, setProfile] = useState<CreatorProfileData | null>(
    initialProfile
  );
  const [userData, setUserData] = useState<UserData | null>(initialUserData);
  // Note: Cash transactions now handled by pagination hook
  const [coinTransactions, setCoinTransactionsState] = useState<
    CoinTransaction[]
  >(initialCoinTransactions);
  const [payoutMethods, setPayoutMethods] =
    useState<PayoutMethod[]>(initialPayoutMethods);
  // Initialize withdrawalRequests without summary first, then add summary in useEffect
  const [withdrawalRequests, setWithdrawalRequests] = useState<
    WithdrawalRequest[]
  >(initialWithdrawalRequests);

  const [isLoading, setIsLoading] = useState(false); // For client-side actions
  const [isCancellingWithdrawal, setIsCancellingWithdrawal] = useState<
    string | null
  >(null); // Stores ID of withdrawal being cancelled

  // Modal States (same as before)
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutDialogView, setPayoutDialogView] = useState<"list" | "add">("list");
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Coupon/code redemption
  const [redeemCode, setRedeemCode] = useState<string>("");
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);

  // Payout method availability (admin can pause methods globally)
  const [pausedPayoutMethodTypes, setPausedPayoutMethodTypes] = useState<string[]>([]);
  const [enabledPayoutMethodTypes, setEnabledPayoutMethodTypes] = useState<string[]>([
    "crypto",
    "upi",
    "bank_transfer",
    "skydo",
  ]);

  const getInitialMode = (): "light" | "dark" => {
    if (typeof document === "undefined") return "light";
    const dataMode = document
      .querySelector("[data-mode]")
      ?.getAttribute("data-mode");
    if (dataMode === "dark" || dataMode === "light") {
      return dataMode;
    }
    if (document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  };

  const [mode, setMode] = useState<"light" | "dark">(getInitialMode);
  const [isCompact, setIsCompact] = useState<boolean>(false);

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
    apiEndpoint: "/api/money-transactions",
    initialLimit: 25,
  });

  // Read mode from data attribute and html class, respond to changes
  useEffect(() => {
    const readMode = (): "light" | "dark" => {
      const el = document.querySelector("[data-mode]");
      const attr = el?.getAttribute("data-mode");
      if (attr === "dark" || attr === "light") return attr;
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
    };

    const readCompact = (): boolean => {
      const compactElement = document.querySelector("[data-compact]");
      return compactElement?.getAttribute("data-compact") === "true";
    };

    // Set immediately on mount to avoid any flicker
    setMode(readMode());
    setIsCompact(readCompact());

    // Watch for changes on either data-mode or html class
    const observer = new MutationObserver(() => {
      setMode(readMode());
      setIsCompact(readCompact());
    });
    const dataModeTarget = document.querySelector("[data-mode]");
    if (dataModeTarget) {
      observer.observe(dataModeTarget, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const isDark = mode === "dark";

  const getPayoutMethodSummary = (method: PayoutMethod): string => {
    switch (method.method_type) {
      case "crypto":
        return `${
          method.details?.network?.toUpperCase() || "Crypto"
        } Wallet: ...${method.details?.wallet_address?.slice(-4) || "XXXX"} (${
          method.friendly_name || "Crypto"
        })`;
      case "upi":
        return `UPI: ${method.details?.upi_id || "N/A"} (${
          method.friendly_name || "UPI"
        })`;
      case "bank_transfer":
        return `Bank: ...${
          method.details?.account_number?.slice(-4) || "XXXX"
        } (${method.friendly_name || "Bank"})`;
      case "phantom":
        return `Phantom: ...${
          method.details?.wallet_address?.slice(-4) || "XXXX"
        } (${method.friendly_name || "Phantom Wallet"})`;
      case "skydo":
        return `Skydo: ${method.details?.email || "N/A"}`;
      default:
        const exhaustiveCheck: never = method.method_type;
        return "Unknown Method Type";
    }
  };

  const getPayoutMethodSummaryById = (methodId: string | null): string => {
    if (!methodId) return "Payout method deleted or N/A";
    const method = payoutMethods.find((p) => p.id === methodId);
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
      initialWithdrawalRequests.map((wr) => ({
        ...wr,
        payout_method_summary: getPayoutMethodSummaryById(
          wr.payout_method_id === undefined ? null : wr.payout_method_id
        ),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialAuthUser,
    initialProfile,
    initialUserData,
    initialCoinTransactions,
    initialPayoutMethods,
    initialWithdrawalRequests,
    router,
  ]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payout-method-settings")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setPausedPayoutMethodTypes(data.pausedMethodTypes || []);
        setEnabledPayoutMethodTypes(data.enabledMethodTypes || ["crypto", "upi", "bank_transfer", "skydo"]);
      })
      .catch(() => {
        if (!cancelled) {
          setPausedPayoutMethodTypes([]);
          setEnabledPayoutMethodTypes(["crypto", "upi", "bank_transfer", "skydo"]);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const PAYOUT_METHOD_LABELS: Record<string, string> = {
    crypto: "Crypto",
    upi: "UPI",
    bank_transfer: "Bank transfer",
    phantom: "Phantom",
    skydo: "Skydo",
  };
  const availablePayoutMethodsForWithdraw = payoutMethods.filter(
    (m) => enabledPayoutMethodTypes.includes(m.method_type) && isSkydoUsable(m)
  );
  const existingSkydoMethod =
    payoutMethods.find((m) => m.method_type === "skydo") ?? null;
  const hasUnverifiedSkydo =
    !!existingSkydoMethod && !isSkydoUsable(existingSkydoMethod);
  const withdrawableBalanceCents = profile?.withdrawable_balance ?? 0;

  const openPayoutDialog = (view: "list" | "add") => {
    setPayoutDialogView(view);
    setIsPayoutModalOpen(true);
  };

  const savePayoutMethod = async (
    draft: PayoutMethodDraft
  ): Promise<PayoutSaveResult> => {
    if (!authUser) {
      toast.error("Authentication error.");
      return { ok: false, message: "Authentication error. Please sign in again." };
    }
    const methodToSave = { user_id: authUser.id, ...draft };
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("payout_methods")
        .upsert(methodToSave)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error("No data returned after saving payout method.");

      setPayoutMethods((prevMethods) => {
        const index = prevMethods.findIndex((m) => m.id === data.id);
        if (index !== -1) {
          const newMethods = [...prevMethods];
          newMethods[index] = data as PayoutMethod;
          return newMethods;
        }
        return [...prevMethods, data as PayoutMethod];
      });
      toast.success(
        draft.method_type === "skydo"
          ? "Skydo payout method added. Watch for an email from Skydo Payouts within 24 hours."
          : `Payout method ${draft.id ? "updated" : "added"} successfully!`
      );
      return { ok: true };
    } catch (error) {
      console.error("Error saving payout method:", error, methodToSave);
      const message = getSupabaseErrorMessage(error);
      toast.error(`Failed to save payout method: ${message}`);
      return { ok: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  const deletePayoutMethod = async (method: PayoutMethod): Promise<boolean> => {
    const isSkydo = method.method_type === "skydo";
    if (isSkydo && !canRemoveSkydo(method)) {
      toast.error("Your Skydo email can't be removed after Skydo has emailed you.");
      return false;
    }
    setIsLoading(true);
    const { error } = await supabase
      .from("payout_methods")
      .delete()
      .eq("id", method.id);
    setIsLoading(false);
    if (error) {
      console.error("Error deleting payout method:", error);
      toast.error(`Failed to delete method: ${error.message}`);
      return false;
    }
    setPayoutMethods((prev) => prev.filter((p) => p.id !== method.id));
    toast.success(
      isSkydo
        ? "Skydo email removed. You can add a different one now."
        : "Payout method deleted."
    );
    return true;
  };

  const setDefaultPayoutMethod = async (method: PayoutMethod): Promise<boolean> => {
    if (!authUser) return false;
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
      .eq("id", method.id)
      .eq("user_id", authUser.id)
      .select()
      .single();
    setIsLoading(false);

    if (error) {
      console.error("Error setting default payout method:", error);
      toast.error(`Failed to set default method: ${error.message}`);
      return false;
    }
    if (data) {
      setPayoutMethods((prev) => prev.map((p) => ({ ...p, is_default: p.id === data.id })));
      toast.success("Default payout method updated.");
    }
    return true;
  };

  const submitWithdrawal = async ({
    amountCents,
    payoutMethodId,
    notes,
  }: WithdrawRequest): Promise<WithdrawSubmitResult> => {
    if (!authUser || !profile || !userData) {
      return { ok: false, message: "User profile or data not loaded." };
    }

    const rpcArgs = {
      p_user_id: authUser.id,
      p_payout_method_id: payoutMethodId,
      p_amount: amountCents,
      p_currency: "USD",
      p_amount_type: "cash" as const,
      p_user_notes: notes,
      p_redeemed_item_description: null,
    };

    console.log(
      "Calling create_withdrawal_request with args:",
      JSON.stringify(rpcArgs, null, 2)
    );

    const { data: rpcResponse, error: rpcError } = await supabase.rpc(
      "create_withdrawal_request",
      rpcArgs
    );

    if (rpcError) {
      console.error("Error creating withdrawal request via RPC:", rpcError);
      return {
        ok: false,
        message: formatErrorWithCurrency(rpcError.message || "Unknown error"),
      };
    }
    if (!rpcResponse || !Array.isArray(rpcResponse) || rpcResponse.length === 0) {
      console.error(
        "Withdrawal request RPC returned unexpected data:",
        rpcResponse
      );
      return {
        ok: false,
        message:
          "Withdrawal request submitted, but couldn't confirm details. Please check your requests.",
      };
    }

    const createdRequest = rpcResponse[0] as WithdrawalRequest;
    toast.success(
      `Withdrawal request for ${formatCurrencyFromCents(
        createdRequest.amount
      )} submitted successfully!`
    );
    setWithdrawalRequests((prev) => [
      {
        ...createdRequest,
        payout_method_summary: getPayoutMethodSummaryById(
          createdRequest.payout_method_id === undefined
            ? null
            : createdRequest.payout_method_id
        ),
      },
      ...prev,
    ]);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            withdrawable_balance:
              (prev.withdrawable_balance || 0) - createdRequest.amount,
          }
        : null
    );

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(WITHDRAWAL_REVIEW_TRIGGER_EVENT));
    }
    return { ok: true };
  };

  const handleCancelWithdrawal = async (
    requestId: string,
    amountToRestore: number,
    amountType: "cash" | "coins"
  ) => {
    // amountCents renamed to amountToRestore
    if (!authUser || !profile || !userData) return;
    if (
      !confirm(
        "Are you sure you want to cancel this withdrawal request? The funds will be returned to your balance."
      )
    ) {
      return;
    }
    setIsCancellingWithdrawal(requestId);

    const { data: rpcSuccess, error: rpcError } = await supabase.rpc(
      "cancel_withdrawal_request_by_user",
      {
        p_request_id: requestId,
        p_user_id: authUser.id,
      }
    );

    setIsCancellingWithdrawal(null);

    if (rpcError) {
      console.error("Error cancelling withdrawal request via RPC:", rpcError);
      toast.error(`Failed to cancel request: ${rpcError.message}`);
    } else if (rpcSuccess === true) {
      if (amountType === "cash") {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                withdrawable_balance:
                  (prev.withdrawable_balance || 0) + amountToRestore,
              }
            : null
        );
      } else {
        // coins
        setUserData((prev) =>
          prev ? { ...prev, coins: (prev.coins || 0) + amountToRestore } : null
        );
      }
      setWithdrawalRequests((prevReqs) =>
        prevReqs.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status: "cancelled",
                payout_method_summary: getPayoutMethodSummaryById(
                  req.payout_method_id === undefined
                    ? null
                    : req.payout_method_id
                ),
                cancelled_at: new Date().toISOString(),
                cancellation_reason: "Cancelled by user",
              }
            : req
        )
      );
      toast.success(
        "Withdrawal Cancelled: The funds have been returned to your balance."
      );
    } else {
      console.error(
        "RPC call to cancel withdrawal did not return true. Response:",
        rpcSuccess
      );
      toast.error(
        "Failed to cancel the withdrawal request. Please try again or contact support."
      );
    }
  };

  const PayoutMethodIcon = ({ type }: { type: PayoutMethodType }) => {
    if (type === "crypto") return <CryptoWalletIcon className="mr-2 h-5 w-5" />;
    if (type === "bank_transfer") return <Landmark className="mr-2 h-5 w-5" />;
    if (type === "upi") return <Sparkles className="mr-2 h-5 w-5" />;
    if (type === "phantom")
      return <Wallet className="mr-2 h-5 w-5 text-purple-600" />;
    if (type === "skydo") return <Mail className="mr-2 h-5 w-5" />;
    return <CreditCard className="mr-2 h-5 w-5" />;
  };

  if (!authUser || !profile || !userData) {
    // This case should ideally be handled by the redirect in the server component for initial load.
    // This check is more for ensuring props are passed correctly.
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading earnings data or not authenticated...</p>
        </div>
      </div>
    );
  }

  // Derived state for total referrals
  const totalReferrals =
    (userData.advertisers_referred || 0) + (userData.creators_referred || 0);

  const contestCashCents = profile.total_money_won ?? 0;
  const affiliateEarningsCents = userData.affiliate_earnings ?? 0;
  const otherEarningsCents = userData.other_earnings ?? 0;
  const totalCashEarnedCents =
    contestCashCents + affiliateEarningsCents + otherEarningsCents;

  // Filter withdrawal requests for display
  const cashWithdrawalRequests = withdrawalRequests.filter(
    (req) => req.amount_type === "cash"
  );
  const coinWithdrawalRequests = withdrawalRequests.filter(
    (req) => req.amount_type === "coins"
  );

  return (
    <div className="container mx-auto py-8 md:px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Earnings</h1>
      </div>
      {/* Tabs */}
      <EnhancedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mt-10 mb-10"
        isDark={isDark}
        light={!isDark}
      />
      {/* <Tabs defaultValue="cash" className="w-full" onValueChange={(value) => setActiveTab(value as 'cash' | 'coins')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="cash">
                        <DollarSign className="h-5 w-5 mr-2" /> Cash Wallet
                    </TabsTrigger>
                    <TabsTrigger value="coins">
                        <Coins className="h-5 w-5 mr-2" /> Coin Wallet
                    </TabsTrigger>
                </TabsList> */}

      {/* Cash Wallet Tab */}
      <TabContent activeTab={activeTab}>
        <TabPanel value="cash" activeTab={activeTab}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337]" : "bg-white"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div
                  className={cn(
                    "flex-1 space-y-3",
                    isDark ? "text-white" : "text-black"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <p className="text-lg font-medium">Total Cash Earned</p>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                              isDark
                                ? "text-white/80 focus-visible:ring-white/40"
                                : "text-muted-foreground focus-visible:ring-[#4A00BE]/30"
                            )}
                            aria-label="How total cash earned is calculated"
                          >
                            <Info className="h-4 w-4 shrink-0" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[280px] space-y-2 p-3 text-left"
                        >
                          <p className="text-xs leading-snug">
                            <span className="font-medium">
                              Contest & opportunity winnings
                            </span>
                            <span className="text-muted-foreground"> — </span>
                            {formatCurrencyFromCents(contestCashCents)}
                          </p>
                          <p className="text-xs leading-snug">
                            <span className="font-medium">
                              Affiliate earnings
                            </span>
                            <span className="text-muted-foreground"> — </span>
                            {formatCurrencyFromCents(affiliateEarningsCents)}
                          </p>
                          <p className="text-xs leading-snug">
                            <span className="font-medium">
                              Other earnings (bonuses, coupons, etc.)
                            </span>
                            <span className="text-muted-foreground"> — </span>
                            {formatCurrencyFromCents(otherEarningsCents)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xl font-bold">
                    {formatCurrencyFromCents(totalCashEarnedCents)}
                  </p>
                  <p className="text-md">Lifetime cash earnings</p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Cash Won</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrencyFromCents(profile.total_money_won)}</div>
                                <p className="text-xs text-muted-foreground">Lifetime cash earnings</p>
                            </CardContent>
                        </Card> */}
            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337]" : "bg-white"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div
                  className={cn(
                    "flex-1 space-y-3",
                    isDark ? "text-white" : "text-black"
                  )}
                >
                  <p className="text-lg font-medium">
                    Available for Withdrawal
                  </p>
                  <p className="text-xl font-bold">
                    {formatCurrencyFromCents(profile.withdrawable_balance)}
                  </p>
                  <p className="text-md">
                    Minimum withdrawal:{" "}
                    {formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}
                  </p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
                  <ArrowDownToLine className="h-5 w-5" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Available for Withdrawal</CardTitle>
                                <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrencyFromCents(profile.withdrawable_balance)}</div>
                                <p className="text-xs text-muted-foreground">Minimum withdrawal: {formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}</p>
                            </CardContent>
                        </Card> */}
            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337]" : "bg-white"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div
                  className={cn(
                    "flex-1 space-y-3",
                    isDark ? "text-white" : "text-black"
                  )}
                >
                  <p className="text-lg font-medium">Cash Campaigns Won</p>
                  <p className="text-xl font-bold">
                    {profile.total_contests_won}
                  </p>
                  <p className="text-md">Total cash campaign victories</p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
                  <Trophy className="h-5 w-5" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Cash Contests Won</CardTitle>
                                <Trophy className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{profile.total_contests_won}</div>
                                <p className="text-xs text-muted-foreground">Total cash contest victories</p>
                            </CardContent>
                        </Card> */}
          </div>

          {/* Code Redemption */}
          <div
            className={cn(
              "mb-6 p-4 rounded-md",
              isDark ? "bg-[#170337]" : "border bg-white"
            )}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-md" htmlFor="redeemCode">
                  Redeem a Code
                </Label>
                <Input
                  id="redeemCode"
                  className={cn(
                    isDark
                      ? "bg-[#180438] border border-gray-600 text-white"
                      : "bg-white text-black"
                  )}
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
                    const res = await fetch("/api/coupons/redeem", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ code: redeemCode.trim() }),
                    });
                    const data = await res.json();
                    if (!res.ok || data.error) {
                      toast.error(data.error || "Failed to redeem code");
                    } else {
                      // If server signals already redeemed, show neutral feedback
                      if (
                        typeof data.message === "string" &&
                        data.message.toLowerCase().includes("already redeemed")
                      ) {
                        toast("Code already redeemed on this account.");
                        setRedeemCode("");
                        return;
                      }
                      const creditedParts: string[] = [];
                      if (
                        typeof data.cash_cents === "number" &&
                        data.cash_cents > 0
                      ) {
                        setProfile((prev) =>
                          prev
                            ? {
                                ...prev,
                                withdrawable_balance:
                                  (prev.withdrawable_balance || 0) +
                                  data.cash_cents,
                              }
                            : prev
                        );
                        creditedParts.push(
                          `$${(data.cash_cents / 100).toFixed(
                            2
                          )} to withdrawable balance`
                        );
                      }
                      if (typeof data.coins === "number" && data.coins > 0) {
                        setUserData((prev) =>
                          prev
                            ? {
                                ...prev,
                                coins: (prev.coins || 0) + data.coins,
                                total_lifetime_coins_earned:
                                  (prev.total_lifetime_coins_earned || 0) +
                                  data.coins,
                              }
                            : prev
                        );
                        creditedParts.push(`${data.coins} coins`);
                      }
                      const successMsg =
                        creditedParts.length > 0
                          ? `Code redeemed: ${creditedParts.join(" + ")}`
                          : "Code redeemed successfully";
                      toast.success(successMsg);
                      setRedeemCode("");
                    }
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to redeem code");
                  } finally {
                    setIsRedeeming(false);
                  }
                }}
                disabled={isRedeeming || redeemCode.trim().length === 0}
              >
                {isRedeeming ? "Redeeming..." : "Redeem Code"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Enter any valid code shared via Discord, email, or campaigns.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-8">
            {(() => {
              const balance = profile?.withdrawable_balance || 0;
              const canOpenWithdraw =
                !!profile && balance >= MIN_WITHDRAWAL_AMOUNT && !isLoading;
              const hasPayoutMethods = payoutMethods.length > 0;
              const primaryClass = "flex-1 gap-2 text-base font-semibold";
              if (canOpenWithdraw && hasPayoutMethods) {
                return (
                  <Button
                    size="lg"
                    onClick={() => setIsWithdrawModalOpen(true)}
                    className={primaryClass}
                  >
                    <ArrowDownToLine className="h-5 w-5" aria-hidden />
                    Withdraw Balance
                  </Button>
                );
              }
              if (canOpenWithdraw && !hasPayoutMethods) {
                return (
                  <Button
                    size="lg"
                    onClick={() => openPayoutDialog("add")}
                    className={primaryClass}
                  >
                    <PlusCircle className="h-5 w-5" aria-hidden />
                    Add Payout Method to Withdraw
                  </Button>
                );
              }
              // Fallback: disabled button with reason
              const reason =
                !profile || isLoading
                  ? "Loading account..."
                  : balance < MIN_WITHDRAWAL_AMOUNT
                  ? `Minimum withdrawal: ${formatCurrencyFromCents(
                      MIN_WITHDRAWAL_AMOUNT
                    )}`
                  : "Withdraw Balance";
              return (
                <Button size="lg" className={primaryClass} disabled>
                  <ArrowDownToLine className="h-5 w-5" aria-hidden />
                  {reason}
                </Button>
              );
            })()}

            <Button
              size="lg"
              variant="outline"
              onClick={() => openPayoutDialog("list")}
              className={cn(
                "flex-1 gap-2 border-2 text-base font-semibold",
                isDark
                  ? "border-[#7F39EC] bg-transparent text-white hover:bg-[#7F39EC]/20"
                  : "border-[#7F39EC] bg-white text-[#4A00BE] hover:bg-[#7F39EC]/10"
              )}
              disabled={isLoading}
            >
              <Settings2 className="h-5 w-5" aria-hidden />
              Manage Payout Methods
            </Button>
          </div>
          {payoutMethods.length === 0 &&
            profile &&
            (profile.withdrawable_balance || 0) >= MIN_WITHDRAWAL_AMOUNT && (
              <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-4 text-center">
                Please add a payout method to withdraw your balance.
              </p>
            )}

          <div
            className={cn(
              "rounded-xl shadow",
              isDark ? "bg-[#170337]" : "bg-white"
            )}
          >
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
                <TableHeader
                  className={cn(
                    "text-left border-b",
                    isDark
                      ? "bg-[#391A6A] text-white"
                      : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500"
                  )}
                >
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
                        No cash transaction history yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCashTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {formatDateTime(transaction.created_at)}
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
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
                              ${
                                transaction.status === "completed" ||
                                transaction.status === "credited" ||
                                transaction.status === "success"
                                  ? isDark
                                    ? "bg-[#57D3034F] text-[#57D303]"
                                    : "bg-green-100 text-green-700 border-green-300"
                                  : transaction.status === "pending"
                                  ? isDark
                                    ? "bg-[#FDD36F61] text-[#FDD36F]"
                                    : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                  : transaction.status === "failed"
                                  ? isDark
                                    ? "bg-red-900 text-red-300"
                                    : "bg-red-100 text-red-700 border-red-300"
                                  : isDark
                                  ? "bg-gray-800 text-gray-300"
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
                  isDark={isDark}
                />
              )}
            </CardContent>
          </div>

          {/* Cash Withdrawal Requests Section - Moved inside cash tab */}
          <div
            className={cn(
              "mt-8 rounded-xl shadow",
              isDark ? "bg-[#170337]" : "bg-white"
            )}
          >
            <CardHeader>
              <CardTitle>Cash Withdrawal Request History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader
                  className={cn(
                    "text-left border-b",
                    isDark
                      ? "bg-[#391A6A] text-white"
                      : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500"
                  )}
                >
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
                        className="text-center py-4 text-muted-foreground"
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
            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337]" : "bg-white"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div
                  className={cn(
                    "flex-1 space-y-3",
                    isDark ? "text-white" : "text-black"
                  )}
                >
                  <p className="text-lg font-medium">Total Coins Earned</p>
                  <p className="text-xl font-bold">
                    {formatCoins(userData.total_lifetime_coins_earned)}
                  </p>
                  <p className="text-md">Lifetime coin earnings</p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
                  <Coins className="h-5 w-5" />
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
            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337]" : "bg-white"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div
                  className={cn(
                    "flex-1 space-y-3",
                    isDark ? "text-white" : "text-black"
                  )}
                >
                  <p className="text-lg font-medium">Coins Available</p>
                  <p className="text-xl font-bold">
                    {formatCoins(userData.coins)}
                  </p>
                  <p className="text-md">Your current coin balance</p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
                  <CryptoWalletIcon className="h-5 w-5" />
                </div>
              </CardContent>
            </div>
            {/* <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Coins Available
                </CardTitle>
                <CryptoWalletIcon className="h-4 w-4 text-muted-foreground" />{" "}
               
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
            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337]" : "bg-white"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div
                  className={cn(
                    "flex-1 space-y-3",
                    isDark ? "text-white" : "text-black"
                  )}
                >
                  <p className="text-lg font-medium">Total Referrals</p>
                  <p className="text-xl font-bold">{totalReferrals}</p>
                  <p className="text-md">Successful referrals</p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
                  <Users className="h-5 w-5" />
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
            <Button className="w-full md:w-auto" disabled={true}>
              {" "}
              {/* Button disabled */}
              <Gift className="h-4 w-4 mr-2" /> Redeem Coins (Coming Soon){" "}
              {/* Text updated */}
            </Button>
          </div>

          <div
            className={cn(
              "rounded-xl shadow",
              isDark ? "bg-[#170337]" : "bg-white"
            )}
          >
            <CardHeader>
              <CardTitle>Coin Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader
                  className={cn(
                    "text-left border-b",
                    isDark
                      ? "bg-[#391A6A] text-white"
                      : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500"
                  )}
                >
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
                      <TableRow key={tx.id}>
                        <TableCell>{formatDateTime(tx.created_at)}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell className="capitalize">
                          {tx.type?.replace(/_/g, " ") || "N/A"}
                        </TableCell>
                        <TableCell
                          className={
                            tx.coins > 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {tx.coins > 0 ? "+" : ""}
                          {formatCoins(tx.coins)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tx.status === "completed" ||
                              tx.status === "credited"
                                ? "default"
                                : tx.status === "pending"
                                ? "secondary"
                                : tx.status === "failed"
                                ? "destructive"
                                : "outline"
                            }
                            className={`capitalize px-3 py-1 rounded-full text-sm font-medium
                              ${
                                tx.status === "completed" ||
                                tx.status === "credited" ||
                                tx.status === "success"
                                  ? isDark
                                    ? "bg-[#57D3034F] text-[#57D303]"
                                    : "bg-green-100 text-green-700 border-green-300"
                                  : tx.status === "pending"
                                  ? isDark
                                    ? "bg-[#FDD36F61] text-[#FDD36F]"
                                    : "bg-yellow-100 text-yellow-700 border-yellow-300"
                                  : tx.status === "failed"
                                  ? isDark
                                    ? "bg-red-900 text-red-300"
                                    : "bg-red-100 text-red-700 border-red-300"
                                  : isDark
                                  ? "bg-gray-800 text-gray-300"
                                  : "bg-gray-100 text-gray-700 border-gray-300"
                              }
                            `}
                          >
                            {tx.status?.replace(/_/g, " ") || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tx.withdrawal_request_id || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-4 text-muted-foreground"
                      >
                        No coin transaction history yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </div>

          {/* Coin Redemption Requests Section - Stays inside coin tab */}
          <div
            className={cn(
              "mt-8 rounded-xl shadow",
              isDark ? "bg-[#170337]" : "bg-white"
            )}
          >
            <CardHeader>
              <CardTitle>Coin Redemption History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader
                  className={cn(
                    "text-left border-b",
                    isDark
                      ? "bg-[#391A6A] text-white"
                      : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500"
                  )}
                >
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
      </TabContent>

      {/* Payout Methods Modal (Dialog) */}
      <PayoutMethodDialog
        open={isPayoutModalOpen}
        onOpenChange={setIsPayoutModalOpen}
        initialView={payoutDialogView}
        isDark={isDark}
        payoutMethods={payoutMethods}
        withdrawableBalanceCents={withdrawableBalanceCents}
        pausedMethodTypes={pausedPayoutMethodTypes}
        onSave={savePayoutMethod}
        onDelete={deletePayoutMethod}
        onSetDefault={setDefaultPayoutMethod}
      />

      {/* Withdraw Balance Modal */}
      <WithdrawBalanceDialog
        open={isWithdrawModalOpen}
        onOpenChange={setIsWithdrawModalOpen}
        isDark={isDark}
        availableBalanceCents={profile?.withdrawable_balance ?? 0}
        minWithdrawalCents={MIN_WITHDRAWAL_AMOUNT}
        payoutMethods={payoutMethods}
        availableMethodIds={availablePayoutMethodsForWithdraw.map((m) => m.id)}
        pausedMethodTypes={pausedPayoutMethodTypes}
        onManageMethods={() => {
          setIsWithdrawModalOpen(false);
          openPayoutDialog("list");
        }}
        onSubmit={submitWithdrawal}
      />
    </div>
  );
}
