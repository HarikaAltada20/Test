"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation"; // Added for potential future use
import { Card, CardContent } from "@/components/ui/card";
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
  Ticket,
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
import { WithdrawalReceiveNote } from "@/components/payouts/WithdrawalReceiveNote";
import {
  DEFAULT_PAYOUT_FEE_SETTINGS,
  parsePayoutFeeSettings,
  type PayoutFeeSettings,
} from "@/lib/payout-fees";
import {
  WithdrawBalanceDialog,
  type WithdrawRequest,
  type WithdrawSubmitResult,
} from "@/components/payouts/withdraw-dialog/WithdrawBalanceDialog";
import {
  canRemoveSkydo,
  getSkydoStatus,
  isSkydoUsable,
} from "@/lib/skydo-payout";
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
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { cn } from "@/lib/utils";
import { WITHDRAWAL_REVIEW_TRIGGER_EVENT } from "@/lib/review-events";

const formatCoins = (coins: number | bigint = 0): string => {
  return new Intl.NumberFormat().format(Number(coins));
};

const formatDateTime = (dateString?: string): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString();
};

function EarningsStatCard({
  isDark,
  icon,
  title,
  label,
  value,
}: {
  isDark: boolean;
  icon: ReactNode;
  title: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border p-5",
        isDark
          ? "border-white/10 bg-[#161616]"
          : "border-neutral-200 bg-white",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-base font-semibold",
          isDark ? "text-white" : "text-[#171717]",
        )}
      >
        {icon}
        {title}
      </div>
      <p
        className={cn(
          "mt-5 text-base font-medium",
          isDark ? "text-slate-200" : "text-[#66666F]",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-[34px] font-semibold leading-none tracking-tight",
          isDark ? "text-white" : "text-[#171717]",
        )}
      >
        {value}
      </p>
    </section>
  );
}

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
    initialProfile,
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
  const [payoutDialogView, setPayoutDialogView] = useState<"list" | "add">(
    "list",
  );
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [coinPage, setCoinPage] = useState(1);
  const [coinLimit, setCoinLimit] = useState(25);

  // Coupon/code redemption
  const [redeemCode, setRedeemCode] = useState<string>("");
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);

  // Payout method availability (admin can pause methods globally)
  const [pausedPayoutMethodTypes, setPausedPayoutMethodTypes] = useState<
    string[]
  >([]);
  const [enabledPayoutMethodTypes, setEnabledPayoutMethodTypes] = useState<
    string[]
  >(["crypto", "upi", "bank_transfer", "skydo"]);

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
          wr.payout_method_id === undefined ? null : wr.payout_method_id,
        ),
      })),
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

  const [payoutFeeSettings, setPayoutFeeSettings] = useState<PayoutFeeSettings>(
    DEFAULT_PAYOUT_FEE_SETTINGS,
  );

  const loadPayoutSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/payout-method-settings");
      const data = await res.json();
      setPausedPayoutMethodTypes(data.pausedMethodTypes || []);
      setEnabledPayoutMethodTypes(
        data.enabledMethodTypes || ["crypto", "upi", "bank_transfer", "skydo"],
      );
      setPayoutFeeSettings(parsePayoutFeeSettings(data));
    } catch {
      setPausedPayoutMethodTypes([]);
      setEnabledPayoutMethodTypes(["crypto", "upi", "bank_transfer", "skydo"]);
    }
  }, []);

  useEffect(() => {
    void loadPayoutSettings();
  }, [loadPayoutSettings]);

  const PAYOUT_METHOD_LABELS: Record<string, string> = {
    crypto: "Crypto",
    upi: "UPI",
    bank_transfer: "Bank transfer",
    phantom: "Phantom",
    skydo: "Skydo",
  };
  const availablePayoutMethodsForWithdraw = payoutMethods.filter(
    (m) => enabledPayoutMethodTypes.includes(m.method_type) && isSkydoUsable(m),
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
    draft: PayoutMethodDraft,
  ): Promise<PayoutSaveResult> => {
    if (!authUser) {
      toast.error("Authentication error.");
      return {
        ok: false,
        message: "Authentication error. Please sign in again.",
      };
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
      if (!data)
        throw new Error("No data returned after saving payout method.");

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
          : `Payout method ${draft.id ? "updated" : "added"} successfully!`,
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
      toast.error(
        "Your Skydo email can't be removed after Skydo has emailed you.",
      );
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
        : "Payout method deleted.",
    );
    return true;
  };

  const setDefaultPayoutMethod = async (
    method: PayoutMethod,
  ): Promise<boolean> => {
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
      setPayoutMethods((prev) =>
        prev.map((p) => ({ ...p, is_default: p.id === data.id })),
      );
      toast.success("Default payout method updated.");
    }
    return true;
  };

  const submitWithdrawal = async ({
    amountCents,
    payoutMethodId,
    notes,
    expectedFeeBps,
    expectedUsdInrRate,
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
      p_expected_fee_bps: expectedFeeBps,
      p_expected_usd_inr_rate: expectedUsdInrRate,
    };

    console.log(
      "Calling create_withdrawal_request with args:",
      JSON.stringify(rpcArgs, null, 2),
    );

    const { data: rpcResponse, error: rpcError } = await supabase.rpc(
      "create_withdrawal_request",
      rpcArgs,
    );

    if (rpcError) {
      console.error("Error creating withdrawal request via RPC:", rpcError);
      // The fee or rate changed since the dialog loaded them: show the new amounts.
      if (rpcError.message?.includes("Fees were just updated"))
        void loadPayoutSettings();
      return {
        ok: false,
        message: formatErrorWithCurrency(rpcError.message || "Unknown error"),
      };
    }
    if (
      !rpcResponse ||
      !Array.isArray(rpcResponse) ||
      rpcResponse.length === 0
    ) {
      console.error(
        "Withdrawal request RPC returned unexpected data:",
        rpcResponse,
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
        createdRequest.amount,
      )} submitted successfully!`,
    );
    setWithdrawalRequests((prev) => [
      {
        ...createdRequest,
        payout_method_summary: getPayoutMethodSummaryById(
          createdRequest.payout_method_id === undefined
            ? null
            : createdRequest.payout_method_id,
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
        : null,
    );

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(WITHDRAWAL_REVIEW_TRIGGER_EVENT));
    }
    return { ok: true };
  };

  const handleCancelWithdrawal = async (
    requestId: string,
    amountToRestore: number,
    amountType: "cash" | "coins",
  ) => {
    // amountCents renamed to amountToRestore
    if (!authUser || !profile || !userData) return;
    if (
      !confirm(
        "Are you sure you want to cancel this withdrawal request? The funds will be returned to your balance.",
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
      },
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
            : null,
        );
      } else {
        // coins
        setUserData((prev) =>
          prev ? { ...prev, coins: (prev.coins || 0) + amountToRestore } : null,
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
                    : req.payout_method_id,
                ),
                cancelled_at: new Date().toISOString(),
                cancellation_reason: "Cancelled by user",
              }
            : req,
        ),
      );
      toast.success(
        "Withdrawal Cancelled: The funds have been returned to your balance.",
      );
    } else {
      console.error(
        "RPC call to cancel withdrawal did not return true. Response:",
        rpcSuccess,
      );
      toast.error(
        "Failed to cancel the withdrawal request. Please try again or contact support.",
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
    (req) => req.amount_type === "cash",
  );
  const coinWithdrawalRequests = withdrawalRequests.filter(
    (req) => req.amount_type === "coins",
  );

  const coinTotal = coinTransactions.length;
  const coinTotalPages = Math.ceil(coinTotal / coinLimit);
  const safeCoinPage = Math.min(coinPage, Math.max(1, coinTotalPages || 1));
  const visibleCoinTransactions = coinTransactions.slice(
    (safeCoinPage - 1) * coinLimit,
    safeCoinPage * coinLimit,
  );
  const balance = profile?.withdrawable_balance || 0;
  const canOpenWithdraw =
    !!profile && balance >= MIN_WITHDRAWAL_AMOUNT && !isLoading;
  const hasPayoutMethods = payoutMethods.length > 0;
  const withdrawLabel =
    !profile || isLoading
      ? "Loading account..."
      : balance < MIN_WITHDRAWAL_AMOUNT
        ? `Minimum withdrawal: ${formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}`
        : "Withdraw Balance";

  return (
    <div className="container mx-auto py-8 md:px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className={cn(
              "text-[28px] font-semibold tracking-tight",
              isDark ? "text-white" : "text-[#171717]",
            )}
          >
            My earnings
          </h1>
          <p
            className={cn(
              "mt-1.5 text-md",
              isDark ? "text-slate-200" : "text-[#55555F]",
            )}
          >
            Your cash and coins, what you can withdraw, and where it goes.
          </p>
        </div>
        {activeTab === "coins" ? (
          <Button
            type="button"
            disabled
            className="h-10 shrink-0 rounded-full bg-[#d4d4d8] px-4 text-sm font-medium text-[#525252] shadow-none hover:bg-[#d4d4d8] disabled:opacity-100"
          >
            <Gift className="mr-1.5 h-4 w-4" />
            Redeem coins · Coming soon
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {canOpenWithdraw && hasPayoutMethods ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWithdrawModalOpen(true)}
                className={cn(
                  "h-10 rounded-full px-4 text-md font-medium shadow-none",
                  isDark
                    ? "border-white/20 bg-transparent text-white hover:bg-white/10"
                    : "border-neutral-300 bg-white text-[#171717] hover:bg-neutral-50",
                )}
              >
                <ArrowDownToLine className="mr-1.5 h-4 w-4" />
                Withdraw Balance
              </Button>
            ) : canOpenWithdraw ? (
              <Button
                type="button"
                onClick={() => openPayoutDialog("add")}
                className={cn(
                  "h-10 rounded-full px-4 text-md font-medium shadow-none",
                  isDark
                    ? "bg-white text-[#171717] hover:bg-neutral-200"
                    : "border border-neutral-300 bg-white text-[#171717] hover:bg-neutral-50",
                )}
              >
                <PlusCircle className="mr-1.5 h-4 w-4" />
                Add Payout Method to Withdraw
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled
                className={cn(
                  "h-10 rounded-full px-4 text-md font-medium shadow-none disabled:opacity-60",
                  isDark
                    ? "border-white/20 bg-transparent text-white"
                    : "border-neutral-300 bg-white text-[#171717]",
                )}
              >
                <ArrowDownToLine className="mr-1.5 h-4 w-4" />
                {withdrawLabel}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => openPayoutDialog("list")}
              disabled={isLoading}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-medium shadow-none",
                isDark
                  ? "border border-white/20 bg-transparent text-white hover:bg-white/10"
                  : "bg-[#171717] text-white hover:bg-[#2a2a2a]",
              )}
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              Manage Payout Methods
            </Button>
          </div>
        )}
      </div>

      <div
        className={cn(
          "mt-8 flex gap-6 border-b",
          isDark ? "border-white/10" : "border-neutral-200",
        )}
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px border-b-2 px-1 pb-2.5 text-base font-semibold transition-colors",
                selected
                  ? isDark
                    ? "border-white text-white"
                    : "border-[#171717] text-[#171717]"
                  : isDark
                    ? "border-transparent text-slate-200 hover:text-white"
                    : "border-transparent text-[#292524] hover:text-[#171717]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* Cash Wallet Tab */}
      <TabContent activeTab={activeTab}>
        <TabPanel value="cash" activeTab={activeTab}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <EarningsStatCard
              isDark={isDark}
              icon={<Trophy className="h-4 w-4" />}
              title="Earned"
              label="Total cash earned"
              value={formatCurrencyFromCents(totalCashEarnedCents)}
            />
            <EarningsStatCard
              isDark={isDark}
              icon={<Wallet className="h-4 w-4" />}
              title="Balance"
              label="Available for withdrawal"
              value={formatCurrencyFromCents(profile.withdrawable_balance)}
            />
            <EarningsStatCard
              isDark={isDark}
              icon={<Gift className="h-4 w-4" />}
              title="Campaigns"
              label="Cash campaigns won"
              value={profile.total_contests_won}
            />
          </div>

          {payoutMethods.length === 0 &&
            (profile.withdrawable_balance || 0) >= MIN_WITHDRAWAL_AMOUNT && (
              <p className="mt-4 text-sm text-yellow-600 dark:text-yellow-500">
                Please add a payout method to withdraw your balance.
              </p>
            )}

          <div
            className={cn(
              "mt-4 flex flex-col gap-3 rounded-2xl border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between",
              isDark
                ? "border-white/10 bg-[#161616]"
                : "border-neutral-200 bg-white",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", isDark ? "bg-[#2a1a10] text-[#ff7a1a]" : "bg-[#fff1e6] text-[#ff7a1a]")}>
                <Ticket className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-lg font-semibold",
                    isDark ? "text-white" : "text-[#171717]",
                  )}
                >
                  Redeem a code
                </p>
                <p
                  className={cn(
                    "text-md",
                    isDark ? "text-slate-200" : "text-[#66666F]",
                  )}
                >
                  Codes from Discord, email or campaigns add cash, coins or
                  both.
                </p>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Input
                id="redeemCode"
                className={cn(
                  "h-10 w-full rounded-full border-0 px-4 text-sm shadow-none sm:w-[380px]",
                  isDark
                    ? "bg-[#1a1a1a] text-white placeholder:text-slate-400"
                    : "bg-[#f3f3f4] text-[#171717] placeholder:text-[#a3a3a3]",
                )}
                placeholder="Enter coupon or promo code"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                disabled={isRedeeming}
              />
              <button
                type="button"
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
                            : prev,
                        );
                        creditedParts.push(
                          `$${(data.cash_cents / 100).toFixed(2)} to withdrawable balance`,
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
                            : prev,
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
                className={cn(
                  "shrink-0 text-sm font-semibold disabled:opacity-40",
                  isDark ? "text-white" : "text-[#171717]",
                )}
              >
                {isRedeeming ? "Redeeming..." : "Redeem"}
              </button>
            </div>
          </div>

          <h2
            id="cash-transactions"
            className={cn(
              "mb-3 mt-8 text-base font-semibold",
              isDark ? "text-white" : "text-[#171717]",
            )}
          >
            Cash transactions
          </h2>
          <div
            className={cn(
              "overflow-hidden rounded-2xl border",
              isDark
                ? "border-white/10 bg-[#161616]"
                : "border-neutral-200 bg-white",
            )}
          >
            <CardContent className="space-y-4 px-2 py-3 sm:px-4">
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
                      ? "border-b border-white/10 text-slate-400"
                      : "border-b border-neutral-200 text-[#737373]",
                  )}
                >
                  <TableRow>
                    <TableHead>Date & time</TableHead>
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
                        No transactions yet.
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
          <h2
            className={cn(
              "mb-3 mt-8 text-base font-semibold",
              isDark ? "text-white" : "text-[#171717]",
            )}
          >
            Cash withdrawals
          </h2>
          <div
            className={cn(
              "overflow-hidden rounded-2xl border",
              isDark
                ? "border-white/10 bg-[#161616]"
                : "border-neutral-200 bg-white",
            )}
          >
            <CardContent>
              <Table>
                <TableHeader
                  className={cn(
                    "text-left border-b",
                    isDark
                      ? "border-b border-white/10 text-slate-400"
                      : "border-b border-neutral-200 text-[#737373]",
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
                          <WithdrawalReceiveNote request={req} />
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
                                  req.amount_type,
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <EarningsStatCard
              isDark={isDark}
              icon={<Coins className="h-4 w-4" />}
              title="Earned"
              label="Total coins earned"
              value={formatCoins(userData.total_lifetime_coins_earned)}
            />
            <EarningsStatCard
              isDark={isDark}
              icon={<Wallet className="h-4 w-4" />}
              title="Available"
              label="Coins available"
              value={formatCoins(userData.coins)}
            />
            <EarningsStatCard
              isDark={isDark}
              icon={<Users className="h-4 w-4" />}
              title="Referrals"
              label="Total referrals · 100 coins each"
              value={totalReferrals}
            />
          </div>

          <h2
            id="coin-transactions"
            className={cn(
              "mb-3 mt-8 text-base font-semibold",
              isDark ? "text-white" : "text-[#171717]",
            )}
          >
            Coin transactions
          </h2>
          <div
            className={cn(
              "overflow-hidden rounded-2xl border",
              isDark
                ? "border-white/10 bg-[#161616]"
                : "border-neutral-200 bg-white",
            )}
          >
            <CardContent className="space-y-4 px-2 py-3 sm:px-4">
              <Table>
                <TableHeader
                  className={cn(
                    "text-left border-b",
                    isDark
                      ? "border-b border-white/10 text-slate-400"
                      : "border-b border-neutral-200 text-[#737373]",
                  )}
                >
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Coins</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Request ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coinTransactions.length > 0 ? (
                    visibleCoinTransactions.map((tx) => (
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
                        No transactions yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {coinTotal > 0 && (
                <PaginationControls
                  page={safeCoinPage}
                  limit={coinLimit}
                  total={coinTotal}
                  totalPages={coinTotalPages}
                  hasNextPage={safeCoinPage < coinTotalPages}
                  hasPreviousPage={safeCoinPage > 1}
                  onPageChange={setCoinPage}
                  onLimitChange={(next) => {
                    setCoinLimit(next);
                    setCoinPage(1);
                  }}
                  isDark={isDark}
                />
              )}
            </CardContent>
          </div>

          <h2
            className={cn(
              "mb-3 mt-8 text-base font-semibold",
              isDark ? "text-white" : "text-[#171717]",
            )}
          >
            Coin redemptions
          </h2>
          <div
            className={cn(
              "overflow-hidden rounded-2xl border",
              isDark
                ? "border-white/10 bg-[#161616]"
                : "border-neutral-200 bg-white",
            )}
          >
            <CardContent>
              <Table>
                <TableHeader
                  className={cn(
                    "text-left border-b",
                    isDark
                      ? "border-b border-white/10 text-slate-400"
                      : "border-b border-neutral-200 text-[#737373]",
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
                                  req.amount_type,
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
        feeSettings={payoutFeeSettings}
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
        feeSettings={payoutFeeSettings}
        onOpenRefresh={loadPayoutSettings}
        onManageMethods={() => {
          setIsWithdrawModalOpen(false);
          openPayoutDialog("list");
        }}
        onSubmit={submitWithdrawal}
      />
    </div>
  );
}
