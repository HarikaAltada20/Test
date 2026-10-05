"use client";

import { useEffect, useRef, useState } from "react";
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
  Settings2,
  Trash2,
  Edit3,
  CreditCard,
  Landmark,
  Wallet as CryptoWalletIcon,
  Wallet,
  X,
  Sparkles,
  Power,
  Loader2,
  TrendingDown,
  BarChart3,
  Banknote,
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
import {
  formatCurrencyFromCents,
  formatErrorWithCurrency,
} from "@/lib/currency-utils";
import { MIN_WITHDRAWAL_AMOUNT } from "@/constants/subscriptionPlans";
import { toast } from "sonner";
import { toast as appToast } from "@/hooks/use-toast";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { WalletTopUp } from "@/components/WalletTopUp";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";
import { SubscriptionManagement } from "@/components/SubscriptionManagement";
import { SubscriptionManagementBilling } from "@/components/SubscriptionManagementBilling";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { cn } from "@/lib/utils";

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
  const initialTab = searchParams.get("tab") || "cash";
  const { activeTab, setActiveTab } = useTabState(tabs, {
    defaultTab: initialTab,
  });

  // States derived from props, allowing client-side updates
  const [authUser, setAuthUser] = useState<User | null>(initialAuthUser);
  const [profile, setProfile] = useState<AdvertiserProfileData | null>(
    initialProfile
  );
  const [userData, setUserData] = useState<UserData | null>(initialUserData);
  // Note: Cash transactions and coin transactions now handled by pagination hooks
  const [payoutMethods, setPayoutMethods] =
    useState<PayoutMethod[]>(initialPayoutMethods);
  const [withdrawalRequests, setWithdrawalRequests] = useState<
    WithdrawalRequest[]
  >(initialWithdrawalRequests);

  const [isLoading, setIsLoading] = useState(false);
  const [isCancellingWithdrawal, setIsCancellingWithdrawal] = useState<
    string | null
  >(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);
  const processedTopUpRef = useRef<string | null>(null);

  // Modal States
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [payoutDialogView, setPayoutDialogView] = useState<"list" | "add">(
    "list"
  );
  const [pausedPayoutMethodTypes, setPausedPayoutMethodTypes] = useState<
    string[]
  >([]);
  const [enabledPayoutMethodTypes, setEnabledPayoutMethodTypes] = useState<
    string[]
  >(["crypto", "upi", "bank_transfer", "skydo"]);
  // Initialize mode state with proper detection to prevent flash
  const [mode, setMode] = useState<"light" | "dark">(() => {
    // Check if we're in browser environment
    if (typeof window !== "undefined") {
      // Try to get theme from data-theme attribute first
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme") as
        | "light"
        | "dark";
      if (dataTheme) return dataTheme;

      // Fallback to data-mode attribute
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (dataMode) return dataMode;
      }

      // Check localStorage as last resort
      try {
        const savedMode = localStorage.getItem("dashboard-mode") as
          | "light"
          | "dark";
        if (savedMode) return savedMode;

        const preset = localStorage.getItem("dashboard-preset");
        if (preset === "game-of-creators" || preset === "dark-professional") {
          return "dark";
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    return "light";
  });

  const [isCompact, setIsCompact] = useState<boolean>(false);

  // Read mode/compact flags from data attributes with immediate updates
  useEffect(() => {
    const checkFlags = () => {
      const container = document.querySelector("[data-mode][data-compact]");
      const modeElement = container || document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode && currentMode !== mode) {
          setMode(currentMode);
        }
      }
      const compactElement =
        container || document.querySelector("[data-compact]");
      if (compactElement) {
        const compactValue =
          compactElement.getAttribute("data-compact") === "true";
        if (compactValue !== isCompact) {
          setIsCompact(compactValue);
        }
      }
    };

    // Check immediately
    checkFlags();

    // Watch for changes in the data attributes with immediate callback
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "data-mode" ||
            mutation.attributeName === "data-compact")
        ) {
          checkFlags();
        }
      });
    });

    const targetNode =
      document.querySelector("[data-mode][data-compact]") ||
      document.querySelector("[data-mode]") ||
      document.querySelector("[data-compact]");

    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode", "data-compact"],
      });
    }

    // Also listen for storage events to catch theme changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "dashboard-mode" && e.newValue) {
        const newMode = e.newValue as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [mode, isCompact]);

  // Additional effect to catch theme changes more immediately
  useEffect(() => {
    // Listen for custom theme change events that might be dispatched by the theme system
    const handleThemeChange = (event: CustomEvent) => {
      if (event.detail && event.detail.mode) {
        const newMode = event.detail.mode as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
          // Force a re-render by updating a dummy state
          setMode(newMode);
        }
      }
    };

    // Listen for the custom event
    window.addEventListener("theme-change", handleThemeChange as EventListener);

    // Also check for changes on a more frequent interval as a fallback
    const intervalId = setInterval(() => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode && currentMode !== mode) {
          setMode(currentMode);
        }
      }
    }, 50); // Check every 50ms for faster response

    return () => {
      window.removeEventListener(
        "theme-change",
        handleThemeChange as EventListener
      );
      clearInterval(intervalId);
    };
  }, [mode]);

  // Pagination for coin transactions (client-side)
  // Pagination for coin transactions
  const {
    data: paginatedCoinTransactions,
    pagination: coinPagination,
    loading: coinTransactionsLoading,
    error: coinTransactionsError,
    setPage: setCoinPage,
    setLimit: setCoinLimit,
    refresh: refreshCoinTransactions,
  } = usePagination<CoinTransaction>({
    apiEndpoint: "/api/billing/coin-transactions",
    initialLimit: 25,
  });

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

  // Get payout method summary
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
        return "Unknown Method Type";
    }
  };

  const getPayoutMethodSummaryById = (methodId: string | null): string => {
    if (!methodId) return "Payout method deleted or N/A";
    const method = payoutMethods.find((p) => p.id === methodId);
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
    // Note: Cash and coin transactions now handled by pagination hooks
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
        setEnabledPayoutMethodTypes(
          data.enabledMethodTypes || ["crypto", "upi", "bank_transfer", "skydo"]
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPausedPayoutMethodTypes([]);
          setEnabledPayoutMethodTypes([
            "crypto",
            "upi",
            "bank_transfer",
            "skydo",
          ]);
        }
      });
    return () => {
      cancelled = true;
    };
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
      "Calling create_advertiser_withdrawal_request with args:",
      JSON.stringify(rpcArgs, null, 2)
    );

    const { data: rpcResponse, error: rpcError } = await supabase.rpc(
      "create_advertiser_withdrawal_request",
      rpcArgs
    );

    if (rpcError) {
      console.error("Error creating withdrawal request via RPC:", rpcError);
      return { ok: false, message: rpcError.message };
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
      `Withdrawal request for ${
        activeTab === "cash"
          ? formatCurrencyFromCents(createdRequest.amount)
          : formatCoins(createdRequest.amount) + " coins"
      } submitted successfully!`
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
    if (activeTab === "cash") {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              withdrawable_balance:
                (prev.withdrawable_balance || 0) - createdRequest.amount,
            }
          : null
      );
    } else {
      setUserData((prev) =>
        prev
          ? { ...prev, coins: (prev.coins || 0) - createdRequest.amount }
          : null
      );
    }
    return { ok: true };
  };

  // Handle balance update after successful top-up
  const handleBalanceUpdate = (newBalanceInCents: number) => {
    console.log("💰 BillingPage: Balance update received:", newBalanceInCents);
    console.log(
      "💰 BillingPage: Previous balance was:",
      profile?.available_deposit_balance
    );

    setProfile((prev) => {
      const updated = prev
        ? { ...prev, available_deposit_balance: newBalanceInCents }
        : null;
      console.log("💰 BillingPage: Profile updated:", updated);
      return updated;
    });

    // Refresh paginated transactions to show the new deposit
    console.log("🔄 BillingPage: Refreshing transaction history...");
    refreshCashTransactions();
  };

  const handleWalletTopUpSuccess = (
    amountInCents: number,
    newBalanceInCents: number,
  ) => {
    appToast({
      variant: "success",
      title: "Wallet topped up",
      description: `${formatCurrencyFromCents(amountInCents)} has been added to your cash balance and is ready for campaigns.`,
    });
    handleBalanceUpdate(newBalanceInCents);
  };

  const handleCancelWithdrawal = async (
    requestId: string,
    amountToRestore: number,
    amountType: "cash" | "coins"
  ) => {
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
      "cancel_advertiser_withdrawal_request_by_user",
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

  // Payout method icon component
  const PayoutMethodIcon = ({ type }: { type: PayoutMethodType }) => {
    switch (type) {
      case "crypto":
        return <CryptoWalletIcon className="h-5 w-5 mr-3 text-orange-500" />;
      case "upi":
        return <Sparkles className="h-5 w-5 mr-3 text-purple-500" />;
      case "bank_transfer":
        return <Landmark className="h-5 w-5 mr-3 text-blue-500" />;
      case "phantom":
        return <Wallet className="h-5 w-5 mr-3 text-purple-600" />;
      case "skydo":
        return <Mail className="h-5 w-5 mr-3 text-emerald-500" />;
      default:
        return <CreditCard className="h-5 w-5 mr-3 text-gray-500" />;
    }
  };

  // Handle wallet top-up return from Stripe Checkout
  useEffect(() => {
    const topup = searchParams.get("topup");
    const sessionId = searchParams.get("session_id");

    if (topup === "cancelled") {
      const dedupeKey = "topup-cancelled";
      if (processedTopUpRef.current === dedupeKey) return;
      processedTopUpRef.current = dedupeKey;

      appToast({
        variant: "default",
        title: "Top-up cancelled",
        description: "No charge was made.",
      });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (topup === "success" && sessionId) {
      if (processedTopUpRef.current === sessionId) return;
      processedTopUpRef.current = sessionId;

      window.history.replaceState({}, "", window.location.pathname);

      const refreshAfterTopUp = async () => {
        try {
          let amountInCents: number | null = null;

          try {
            const sessionResponse = await fetch(
              `/api/payments/deposit/session?session_id=${encodeURIComponent(sessionId)}`,
            );
            const sessionData = await sessionResponse.json();
            if (sessionResponse.ok && sessionData.amountInCents != null) {
              amountInCents = sessionData.amountInCents;
            }
          } catch (sessionError) {
            console.error("Error fetching top-up session details:", sessionError);
          }

          const formattedAmount =
            amountInCents != null
              ? formatCurrencyFromCents(amountInCents)
              : null;

          appToast({
            variant: "success",
            title: "Wallet topped up",
            description: formattedAmount
              ? `${formattedAmount} has been added to your cash balance and is ready for campaigns.`
              : "Your top-up was successful. Your balance will update shortly.",
          });

          await new Promise((resolve) => setTimeout(resolve, 2000));
          const response = await fetch("/api/payments/balance");
          const data = await response.json();
          if (data.balance !== undefined) {
            handleBalanceUpdate(data.balance);
          }
          refreshCashTransactions();
        } catch (error) {
          console.error("Error refreshing balance after top-up:", error);
          window.location.reload();
        }
      };

      refreshAfterTopUp();
    }
  }, [searchParams]);

  // Handle subscription checkout success - with protection against infinite loops
  useEffect(() => {
    const success = searchParams.get("success");
    const topup = searchParams.get("topup");
    const sessionId = searchParams.get("session_id");

    if (topup) {
      return;
    }

    if (success === "true" && sessionId && !hasProcessedSuccess) {
      console.log("🎉 Payment successful, refreshing subscription data...");
      setHasProcessedSuccess(true);
      toast.success("Payment successful! Your subscription has been updated.");

      // Clear URL parameters to prevent refresh loops
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // Refresh the page data to get updated subscription info
      const refreshData = async () => {
        try {
          // Give the webhook a moment to process
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Refresh the current page to get updated data
          window.location.reload();
        } catch (error) {
          console.error("Error refreshing data:", error);
        }
      };

      refreshData();
    }
  }, [searchParams, hasProcessedSuccess]);

  if (!authUser || !profile || !userData) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center justify-center h-64">
          <PageLoadingSpinner mode="light" />
          <p>Loading billing data or not authenticated...</p>
        </div>
      </div>
    );
  }

  // Derived state for total referrals
  const totalReferrals =
    (userData.advertisers_referred || 0) + (userData.creators_referred || 0);

  // Filter withdrawal requests for display
  const cashWithdrawalRequests = withdrawalRequests.filter(
    (req) => req.amount_type === "cash"
  );
  const coinWithdrawalRequests = withdrawalRequests.filter(
    (req) => req.amount_type === "coins"
  );

  const isDark = mode === "dark";

  return (
    <div
      className={cn(
        "mx-auto py-8 no-theme-transition",
        // Full width in compact (85% zoom) mode, else constrain width
        isCompact ? "max-w-none px-4 md:px-6" : "max-w-[1200px]"
      )}
    >
      <div className="flex items-center justify-between mb-8">
        <h1
          className="text-2xl font-bold"
          style={{
            color: isDark ? "white" : "black",
            transition: "none",
          }}
        >
          Billing & Account
        </h1>
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
        isDark={isDark}
        light={!isDark}
      />

      {/* Cash Account Tab */}
      <TabContent activeTab={activeTab}>
        <TabPanel value="cash" activeTab={activeTab}>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 [@media(min-width:1000px)]:grid-cols-2 [@media(min-width:1101px)]:grid-cols-4 mb-10">
            {/*Total Spent*/}
            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337] text-white" : "bg-white text-black"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1  space-y-3">
                  <p className="text-lg font-medium">Total Spent</p>
                  <p className="text-xl font-bold">
                    {formatCurrencyFromCents(profile.total_money_spent)}
                  </p>
                  <p className="text-md">Lifetime contest spending</p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
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
            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337] text-white" : "bg-white text-black"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 space-y-3">
                  <p className="text-lg font-medium">Campaigns Run</p>
                  <p className="text-xl font-bold">
                    {profile.total_contests_run}
                  </p>
                  <p className="text-md">Total campaigns created</p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
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

            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337] text-white" : "bg-white text-black"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1  space-y-3">
                  <p className="text-lg font-medium">Available Balance</p>
                  <p className="text-xl font-bold">
                    {formatCurrencyFromCents(profile.available_deposit_balance)}
                  </p>
                  <p className="text-md">Ready for contests</p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
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

            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337] text-white" : "bg-white text-black"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 space-y-3">
                  <p className="text-lg font-medium">Withdrawable Balance</p>
                  <p className="text-xl font-bold">
                    {formatCurrencyFromCents(profile.withdrawable_balance)}
                  </p>
                  <p className="text-md">From referrals & bonuses</p>
                </div>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]"
                  )}
                >
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <Button
              size="lg"
              onClick={() => setIsTopUpModalOpen(true)}
              className="gap-2 text-base font-semibold"
              disabled={isLoading}
            >
              <CreditCard className="h-5 w-5" aria-hidden /> Top Up Wallet
            </Button>
            <Button
              className="gap-2 text-base font-semibold"
              onClick={() => setIsWithdrawModalOpen(true)}
              size="lg"
              disabled={
                !profile ||
                (profile.withdrawable_balance || 0) < MIN_WITHDRAWAL_AMOUNT ||
                payoutMethods.length === 0 ||
                isLoading
              }
            >
              <ArrowDownToLine className="h-5 w-5" aria-hidden /> Withdraw
              Balance
            </Button>
            <Button
              className={cn(
                "gap-2 border-2 text-base font-semibold",
                isDark
                  ? "border-[#7F39EC] bg-transparent text-white hover:bg-[#7F39EC]/20"
                  : "border-[#7F39EC] bg-white text-[#4A00BE] hover:bg-[#7F39EC]/10"
              )}
              size="lg"
              variant="outline"
              onClick={() => openPayoutDialog("list")}
              disabled={isLoading}
            >
              <Settings2 className="h-5 w-5" aria-hidden /> Manage Payout
              Methods
            </Button>
          </div>

          {payoutMethods.length === 0 && (
            <p className="text-sm text-black mb-4 text-center">
              Please add a payout method to withdraw your balance.
            </p>
          )}

          <div
            className={cn(
              "rounded-xl shadow",
              isDark ? "bg-[#170337]" : "bg-white "
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
                <TableHeader>
                  <TableRow
                    className={cn(
                      "text-left border-b",
                      isDark
                        ? "bg-[#391A6A] text-white"
                        : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500"
                    )}
                  >
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

          {/* Cash Withdrawal Requests */}
          <div
            className={cn(
              "mt-8 rounded-xl shadow",
              isDark ? "bg-[#170337]" : "bg-white "
            )}
          >
            <CardHeader>
              <CardTitle>Cash Withdrawal Request History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow
                    className={cn(
                      "text-left border-b",
                      isDark
                        ? "bg-[#391A6A] text-white"
                        : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500"
                    )}
                  >
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
            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337] text-white" : "bg-white text-black"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 space-y-3">
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

            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337] text-white" : "bg-white text-black"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 space-y-3">
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

            <div
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337] text-white" : "bg-white text-black"
              )}
            >
              <CardContent className="p-4 flex justify-between">
                <div className="flex-1 space-y-3">
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
            <Button
              className="w-full md:w-auto bg-[#6C43D0] text-md text-white"
              disabled={true}
            >
              <Gift className="h-4 w-4 mr-2" /> Redeem Coins (Coming Soon)
            </Button>
          </div>

          <div
            className={cn(
              "rounded-xl shadow",
              isDark ? "bg-[#170337]" : "bg-white "
            )}
          >
            <CardHeader>
              <CardTitle>Coin Transaction History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {coinTransactionsError && (
                <div className="text-center text-red-500 p-4">
                  Error loading transactions: {coinTransactionsError}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coinTransactionsLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground h-32"
                      >
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : paginatedCoinTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground"
                      >
                        No coin transaction history yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCoinTransactions.map((transaction) => (
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {!coinTransactionsLoading && coinPagination.totalPages > 0 && (
                <PaginationControls
                  page={coinPagination.page}
                  limit={coinPagination.limit}
                  total={coinPagination.total}
                  totalPages={coinPagination.totalPages}
                  hasNextPage={coinPagination.hasNextPage}
                  hasPreviousPage={coinPagination.hasPreviousPage}
                  onPageChange={setCoinPage}
                  onLimitChange={setCoinLimit}
                  loading={coinTransactionsLoading}
                  isDark={isDark}
                />
              )}
            </CardContent>
          </div>

          {/* Coin Withdrawal Requests */}
          <div
            className={cn(
              "mt-8 rounded-xl shadow",
              isDark ? "bg-[#170337]" : "bg-white "
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

        {/* Subscription Tab */}
        <TabPanel value="subscription" activeTab={activeTab}>
          <div className="space-y-6">
            <div
              className={cn(
                "rounded-xl shadow-xl",
                isDark ? "bg-[#170337]" : "bg-white "
              )}
            >
              <CardHeader>
                <CardTitle>Subscription Management</CardTitle>
                <CardDescription className="text-md">
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
        isdark={isDark}
      >
        <DialogContent
          className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(
                "flex items-center gap-2",
                isDark ? "text-white" : "text-gray-800"
              )}
            >
              Top Up Your Wallet
            </DialogTitle>
            <DialogDescription
              className={cn(
                "text-sm leading-relaxed",
                isDark ? "text-gray-300" : "text-gray-600",
              )}
            >
              Add funds for campaign payments. Pay via Stripe (debit, credit,
              UPI, and more) or top up with Solana USDC/USDT.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <WalletTopUp
              currentBalance={profile?.available_deposit_balance || 0}
              onBalanceUpdate={handleBalanceUpdate}
              onTopUpSuccess={handleWalletTopUpSuccess}
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
