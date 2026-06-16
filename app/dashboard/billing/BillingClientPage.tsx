"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const processedTopUpRef = useRef<string | null>(null);

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
  const [cryptoNetwork, setCryptoNetwork] = useState("BNB_SMART_CHAIN");
  const [cryptoCurrency, setCryptoCurrency] = useState("BNB");

  // Wallet validation states
  const [isValidatingWallet, setIsValidatingWallet] = useState<boolean>(false);
  const [walletValidationStatus, setWalletValidationStatus] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [walletValidationError, setWalletValidationError] =
    useState<string>("");
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
  const [pausedPayoutMethodTypes, setPausedPayoutMethodTypes] = useState<
    string[]
  >([]);
  const [enabledPayoutMethodTypes, setEnabledPayoutMethodTypes] = useState<
    string[]
  >(["crypto", "upi", "bank_transfer"]);
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
  // Withdrawal form states
  const [withdrawAmountDollars, setWithdrawAmountDollars] = useState<number>(0);
  const [withdrawAmountCoins, setWithdrawAmountCoins] = useState<number>(0);
  const [selectedWithdrawMethodId, setSelectedWithdrawMethodId] = useState<
    string | null
  >(null);
  const [withdrawalUserNotes, setWithdrawalUserNotes] = useState("");

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
  const [coinPage, setCoinPage] = useState(1);
  const [coinLimit, setCoinLimit] = useState(25);

  const totalCoinTransactions = coinTransactions.length;
  const coinTotalPages =
    totalCoinTransactions > 0
      ? Math.ceil(totalCoinTransactions / coinLimit)
      : 0;
  const coinHasNextPage = coinPage < coinTotalPages;
  const coinHasPreviousPage = coinPage > 1;

  const paginatedCoinTransactions = useMemo(
    () =>
      coinTransactions.slice((coinPage - 1) * coinLimit, coinPage * coinLimit),
    [coinTransactions, coinPage, coinLimit]
  );

  // Reset coin page when data changes
  useEffect(() => {
    setCoinPage(1);
  }, [totalCoinTransactions]);

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
        setEnabledPayoutMethodTypes(
          data.enabledMethodTypes || ["crypto", "upi", "bank_transfer"]
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPausedPayoutMethodTypes([]);
          setEnabledPayoutMethodTypes([
            "crypto",
            "upi",
            "bank_transfer",
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
  };
  const availablePayoutMethodsForWithdraw = payoutMethods.filter((m) =>
    enabledPayoutMethodTypes.includes(m.method_type)
  );

  // Reset form function
  const resetPayoutForm = () => {
    setCurrentPayoutMethod(null);
    setSelectedPayoutType("crypto");
    setCryptoAddress("");
    setCryptoNetwork("BNB_BEP20");
    setUpiId("");
    setBankAccountHolder("");
    setBankAccountNumber("");
    setBankIfscCode("");
    setBankRoutingNumber("");
    setBankName("");
    setBankBranchName("");
    setBankCountry("IN");
    setPayoutFriendlyName("");
    setPayoutCountry("IN");
  };

  // Wallet format validation functions
  const validateWalletAddress = async () => {
    if (!cryptoAddress.trim()) {
      setWalletValidationStatus("idle");
      return;
    }

    setIsValidatingWallet(true);
    setWalletValidationStatus("validating");
    setWalletValidationError("");

    try {
      let isValid = false;

      if (cryptoNetwork === "BNB_SMART_CHAIN") {
        // BNB Smart Chain (BEP20) validation: 0x + 40 hex characters
        isValid = /^0x[a-fA-F0-9]{40}$/.test(cryptoAddress.trim());
        if (!isValid) {
          setWalletValidationError(
            "Invalid BNB Smart Chain (BEP20) address format. Must start with 0x and be 42 characters total."
          );
        }
      } else if (cryptoNetwork === "SOLANA") {
        // Solana validation: 32-44 base58 characters
        isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cryptoAddress.trim());
        if (!isValid) {
          setWalletValidationError(
            "Invalid Solana wallet address format. Must be 32-44 base58 characters."
          );
        }
      }

      if (isValid) {
        setWalletValidationStatus("valid");
        toast.success("Wallet address format is correct!");
      } else {
        setWalletValidationStatus("invalid");
        toast.error("Invalid wallet address format");
      }
    } catch (error: any) {
      setWalletValidationStatus("invalid");
      setWalletValidationError(
        error.message || "Failed to validate wallet address"
      );
      toast.error("Wallet validation failed");
    } finally {
      setIsValidatingWallet(false);
    }
  };

  // Simple BNB Smart Chain (BEP20) wallet validation: 0x + 40 hex chars
  const isValidBep20Address = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  };

  const isAlphabeticName = (name: string): boolean => {
    const cleanedName = name.trim();
    if (!cleanedName) return false;
    return /^[A-Za-z][A-Za-z\s'.-]*$/.test(cleanedName);
  };

  const isValidUpiId = (value: string): boolean => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return false;
    return /^[A-Za-z0-9][A-Za-z0-9.\-_]{1,}@[A-Za-z][A-Za-z0-9]{2,}$/.test(
      trimmedValue
    );
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
    if (/^\d+$/.test(payoutFriendlyName.trim())) {
      toast.error("Invalid friendly name.");
      return;
    }

    let details: PayoutMethodDetails;

    if (selectedPayoutType === "crypto") {
      if (!cryptoAddress.trim() || !cryptoNetwork.trim()) {
        toast.error("Crypto wallet address and network are required.");
        return;
      }
      if (walletValidationStatus !== "valid") {
        toast.error("Please validate your wallet address first.");
        return;
      }
      details = {
        wallet_address: cryptoAddress.trim(),
        network: cryptoNetwork.trim(),
        currency: cryptoCurrency.trim(),
      };
    } else if (selectedPayoutType === "upi") {
      if (!bankAccountHolder.trim() || !upiId.trim()) {
        toast.error("Account holder name and UPI ID are required.");
        return;
      }
      if (!isAlphabeticName(bankAccountHolder)) {
        toast.error("Invalid account holder name.");
        return;
      }
      if (!isValidUpiId(upiId)) {
        toast.error("Please enter a valid UPI ID (e.g., name@bank).");
        return;
      }
      details = {
        account_holder_name: bankAccountHolder.trim(),
        upi_id: upiId.trim(),
      };
    } else if (selectedPayoutType === "bank_transfer") {
      if (
        !bankAccountHolder.trim() ||
        !bankAccountNumber.trim() ||
        !bankIfscCode.trim()
      ) {
        toast.error(
          "Account holder name, account number, and IFSC code are required for bank transfer."
        );
        return;
      }
      const bankDetails: any = {
        account_holder_name: bankAccountHolder.trim(),
        account_number: bankAccountNumber.trim(),
        ifsc_code: bankIfscCode.trim(),
        country: bankCountry.trim(),
      };
      if (bankRoutingNumber.trim())
        bankDetails.swift_bic_code = bankRoutingNumber.trim();
      if (bankName.trim()) bankDetails.bank_name = bankName.trim();
      if (bankBranchName.trim())
        bankDetails.branch_name = bankBranchName.trim();
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
        .from("payout_methods")
        .upsert(methodToSave)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setPayoutMethods((prevMethods) => {
          const index = prevMethods.findIndex((m) => m.id === data.id);
          if (index !== -1) {
            const newMethods = [...prevMethods];
            newMethods[index] = data as PayoutMethod;
            return newMethods;
          } else {
            return [...prevMethods, data as PayoutMethod];
          }
        });
        toast.success(
          `Payout method ${
            currentPayoutMethod ? "updated" : "added"
          } successfully!`
        );
        setIsPayoutModalOpen(false);
        resetPayoutForm();
      } else {
        throw new Error("No data returned after saving payout method.");
      }
    } catch (error: any) {
      console.error("Error saving payout method:", error);
      toast.error(
        `Failed to save payout method: ${error.message || "Unknown error"}`
      );
    }
    setIsLoading(false);
  };

  const handleEditPayoutMethod = (method: PayoutMethod) => {
    setCurrentPayoutMethod(method);
    setSelectedPayoutType(method.method_type);
    setPayoutFriendlyName(method.friendly_name || "");

    if (method.method_type === "crypto" && method.details) {
      setCryptoAddress(method.details.wallet_address || "");
      setCryptoNetwork(method.details.network || "BNB_BEP20");
    } else if (method.method_type === "upi" && method.details) {
      setUpiId(method.details.upi_id || "");
      setBankAccountHolder(method.details.account_holder_name || "");
    } else if (method.method_type === "bank_transfer" && method.details) {
      setBankAccountHolder(method.details.account_holder_name || "");
      setBankAccountNumber(method.details.account_number || "");
      setBankIfscCode(method.details.ifsc_code || "");
      setBankRoutingNumber(method.details.swift_bic_code || "");
      setBankName(method.details.bank_name || "");
      setBankBranchName(method.details.branch_name || "");
      setBankCountry(method.details.country || "IN");
    }
    setIsPayoutModalOpen(true);
  };

  const handleDeletePayoutMethod = async (methodId: string) => {
    if (!confirm("Are you sure you want to delete this payout method?")) return;
    setIsLoading(true);
    const { error } = await supabase
      .from("payout_methods")
      .delete()
      .eq("id", methodId);
    setIsLoading(false);
    if (error) {
      console.error("Error deleting payout method:", error);
      toast.error(`Failed to delete method: ${error.message}`);
    } else {
      setPayoutMethods(payoutMethods.filter((p) => p.id !== methodId));
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
      setPayoutMethods(
        payoutMethods.map((p) => ({ ...p, is_default: p.id === data.id }))
      );
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
    let currencyForRpc = "USD";
    let amountTypeForRpc: "cash" | "coins" = activeTabModal;
    let redeemedItemDescForRpc: any | null = null;

    if (activeTabModal === "cash") {
      if (withdrawAmountDollars <= 0) {
        toast.error("Please enter a valid withdrawal amount.");
        return;
      }
      if (withdrawAmountDollars < minWithdrawalDollars) {
        toast.error(
          `Minimum cash withdrawal amount is ${formatCurrencyFromCents(
            MIN_WITHDRAWAL_AMOUNT
          )}.`
        );
        return;
      }
      amountToWithdraw = Math.round(withdrawAmountDollars * 100); // Convert to cents
      if (amountToWithdraw > (profile.withdrawable_balance || 0)) {
        toast.error("Insufficient cash balance.");
        return;
      }
    } else {
      // activeTabModal === 'coins'
      if (withdrawAmountCoins <= 0) {
        toast.error("Please enter a valid coin amount to redeem.");
        return;
      }
      amountToWithdraw = withdrawAmountCoins;
      currencyForRpc = "COIN";
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
      p_redeemed_item_description: redeemedItemDescForRpc,
    };

    console.log(
      "Calling create_advertiser_withdrawal_request with args:",
      JSON.stringify(rpcArgs, null, 2)
    );

    setIsSubmittingWithdrawal(true);
    const { data: rpcResponse, error: rpcError } = await supabase.rpc(
      "create_advertiser_withdrawal_request",
      rpcArgs
    );
    setIsSubmittingWithdrawal(false);

    if (rpcError) {
      console.error("Error creating withdrawal request via RPC:", rpcError);
      toast.error(`Withdrawal request failed: ${rpcError.message}`);
    } else if (
      rpcResponse &&
      Array.isArray(rpcResponse) &&
      rpcResponse.length > 0
    ) {
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
      setIsWithdrawModalOpen(false);
      setWithdrawAmountDollars(0);
      setWithdrawAmountCoins(0);
      setSelectedWithdrawMethodId(null);
      setWithdrawalUserNotes("");
    } else {
      console.error(
        "Withdrawal request RPC returned unexpected data:",
        rpcResponse
      );
      toast.error(
        "Withdrawal request submitted, but couldn't confirm details. Please check your requests."
      );
    }
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

              {coinTotalPages > 0 && (
                <div className="mt-4">
                  <PaginationControls
                    page={coinPage}
                    limit={coinLimit}
                    total={totalCoinTransactions}
                    totalPages={coinTotalPages}
                    hasNextPage={coinHasNextPage}
                    hasPreviousPage={coinHasPreviousPage}
                    onPageChange={setCoinPage}
                    onLimitChange={(limit) => {
                      setCoinLimit(limit);
                      setCoinPage(1);
                    }}
                    isDark={isDark}
                  />
                </div>
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
      <Dialog
        open={isPayoutModalOpen}
        onOpenChange={(isOpen) => {
          if (isLoading && isOpen) return;
          setIsPayoutModalOpen(isOpen);
          if (!isOpen) resetPayoutForm();
        }}
        isdark={isDark}
      >
        <DialogContent
          hideCloseButton
          className="sm:max-w-2xl sm:w-[95vw] max-w-xl w-[92vw] max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader className="text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle
                  style={{
                    color: isDark ? "white" : "#1f2937",
                    transition: "none",
                  }}
                >
                  {currentPayoutMethod?.id
                    ? "Edit Payout Method"
                    : "Add New Payout Method"}
                </DialogTitle>
                <DialogDescription
                  style={{
                    color: isDark ? "white" : "#1f2937",
                    transition: "none",
                  }}
                >
                  Manage your payout methods. Your default method will be
                  pre-selected for withdrawals.
                </DialogDescription>
              </div>
              <DialogClose
                className={cn(
                  "shrink-0 rounded-full transition-colors",
                  isDark ? "text-white" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Country selector controls which payout methods show */}
            <div
              className={cn(
                "space-y-1",
                isDark ? "text-white" : "text-gray-800"
              )}
            >
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
                <SelectTrigger
                  id="payoutCountry"
                  className={cn(
                    isDark ? "border-gray-600" : "border-slate-300"
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent isDark={isDark}>
                  <SelectItem isDark={isDark} value="IN">
                    India
                  </SelectItem>
                  <SelectItem isDark={isDark} value="OTHER">
                    Other
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Tabs for payout types */}
            <Tabs
              value={selectedPayoutType}
              onValueChange={(value) =>
                setSelectedPayoutType(value as PayoutMethodType)
              }
              className="w-full"
            >
              {payoutCountry === "IN" ? (
                <TabsList className="grid w-full grid-cols-3 gap-2">
                  <TabsTrigger
                    value="upi"
                    className={cn(
                      "border",
                      isDark
                        ? "border-gray-400 text-gray-300"
                        : "border-gray-500 text-gray-800"
                    )}
                  >
                    UPI
                  </TabsTrigger>
                  <TabsTrigger
                    value="bank_transfer"
                    className={cn(
                      "border",
                      isDark
                        ? "border-gray-400 text-gray-300"
                        : "border-gray-500 text-gray-800"
                    )}
                  >
                    Bank Transfer
                  </TabsTrigger>
                  <TabsTrigger
                    value="crypto"
                    className={cn(
                      "border",
                      isDark
                        ? "border-gray-400 text-gray-300"
                        : "border-gray-500 text-gray-800"
                    )}
                  >
                    Crypto
                  </TabsTrigger>
                </TabsList>
              ) : (
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger
                    value="crypto"
                    className={cn(
                      "border",
                      isDark
                        ? "border-gray-400 text-gray-300"
                        : "border-gray-500 text-gray-800"
                    )}
                  >
                    Crypto
                  </TabsTrigger>
                </TabsList>
              )}

              <TabsContent value="crypto" className="pt-4 space-y-2">
                <div
                  className={cn(
                    "space-y-1",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  <Label htmlFor="payoutFriendlyNameCrypto">
                    Friendly Name
                  </Label>
                  <Input
                    id="payoutFriendlyNameCrypto"
                    value={payoutFriendlyName}
                    onChange={(e) => setPayoutFriendlyName(e.target.value)}
                    placeholder="e.g., My Binance USDT"
                    disabled={isLoading}
                    className={cn(
                      isDark
                        ? "bg-[#06021D] border border-gray-600 text-white"
                        : "bg-white text-black"
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "space-y-1",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  <Label htmlFor="cryptoNetwork">Network</Label>
                  <Select
                    value={cryptoNetwork}
                    onValueChange={(val) => {
                      setCryptoNetwork(val);
                      // Reset currency when network changes
                      if (val === "BNB_SMART_CHAIN") {
                        setCryptoCurrency("BNB");
                      } else if (val === "SOLANA") {
                        setCryptoCurrency("SOL");
                      }
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger
                      className={cn(
                        isDark ? "border-gray-600" : "border-slate-300"
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent isDark={isDark}>
                      <SelectItem isDark={isDark} value="BNB_SMART_CHAIN">
                        BNB Smart Chain (BEP20)
                      </SelectItem>
                      <SelectItem isDark={isDark} value="SOLANA">
                        Solana
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div
                  className={cn(
                    "space-y-1",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  <Label htmlFor="cryptoCurrency">Cryptocurrency</Label>
                  <Select
                    value={cryptoCurrency}
                    onValueChange={(val) => setCryptoCurrency(val)}
                    disabled={isLoading}
                  >
                    <SelectTrigger
                      className={cn(
                        isDark ? "border-gray-600" : "border-slate-300"
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent isDark={isDark}>
                      {cryptoNetwork === "BNB_SMART_CHAIN" ? (
                        <>
                          <SelectItem isDark={isDark} value="BNB">
                            BNB
                          </SelectItem>
                          <SelectItem isDark={isDark} value="USDT">
                            USDT (BEP20)
                          </SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem isDark={isDark} value="SOL">
                            SOL
                          </SelectItem>
                          <SelectItem isDark={isDark} value="USDT">
                            USDT
                          </SelectItem>
                          <SelectItem isDark={isDark} value="USDC">
                            USDC
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div
                  className={cn(
                    "space-y-1",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  <Label
                    htmlFor="cryptoAddress"
                    className="flex items-center gap-2"
                  >
                    Your Wallet Address
                    {walletValidationStatus === "valid" && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {walletValidationStatus === "invalid" && (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="cryptoAddress"
                      value={cryptoAddress}
                      onChange={(e) => {
                        setCryptoAddress(e.target.value);
                        // Reset validation status when address changes
                        if (walletValidationStatus !== "idle") {
                          setWalletValidationStatus("idle");
                          setWalletValidationError("");
                        }
                      }}
                      placeholder={`Enter your ${cryptoCurrency} wallet address`}
                      disabled={isLoading}
                      className={cn(
                        "flex-1",
                        isDark
                          ? "bg-[#06021D] border border-gray-600 text-white"
                          : "bg-white text-black"
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={validateWalletAddress}
                      disabled={
                        !cryptoAddress.trim() || isValidatingWallet || isLoading
                      }
                      className={cn(
                        "text-md text-white",
                        isDark ? "bg-[#5F2BB1]" : "bg-[#4A00BE]"
                      )}
                    >
                      {isValidatingWallet ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Validate"
                      )}
                    </Button>
                  </div>

                  {walletValidationStatus === "validating" && (
                    <p className="text-sm text-blue-600">
                      Validating wallet address...
                    </p>
                  )}

                  {walletValidationStatus === "invalid" && (
                    <p className="text-sm text-red-600">
                      {walletValidationError}
                    </p>
                  )}

                  {walletValidationStatus === "valid" && (
                    <p className="text-sm text-green-600">
                      Wallet address format is correct!
                    </p>
                  )}
                </div>
                <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-500 p-2 text-xs">
                  {cryptoNetwork === "BNB_SMART_CHAIN" ? (
                    <>
                      We only support BNB Smart Chain (BEP20). Do not enter
                      ERC20/other chain addresses. Wrong address = funds lost.
                    </>
                  ) : (
                    <>
                      We only support Solana network. Do not enter other chain
                      addresses. Wrong address = funds lost.
                    </>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Crypto payouts are optional digital rewards. By choosing this
                  method, you accept responsibility for declaring and paying
                  taxes as per your country's laws.
                </p>
                <p
                  className={cn(
                    "text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-200",
                    isDark
                      ? "border-amber-200 bg-amber-500/10 text-amber-300"
                      : "border-amber-200 bg-amber-50 text-amber-600"
                  )}
                >
                  <strong>Note:</strong> We only validate the format of your
                  wallet address. Please double-check that you've entered the
                  correct address for your selected network, as sending to the
                  wrong address will result in permanent loss of funds.
                </p>
              </TabsContent>

              {/* Bank Transfer Form (India) */}
              <TabsContent value="bank_transfer" className="pt-4 space-y-2">
                <div
                  className={cn(
                    "space-y-1",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  <Label htmlFor="payoutFriendlyNameBank">Friendly Name</Label>
                  <Input
                    id="payoutFriendlyNameBank"
                    value={payoutFriendlyName}
                    onChange={(e) => setPayoutFriendlyName(e.target.value)}
                    placeholder="e.g., Primary Savings"
                    disabled={isLoading}
                    className={cn(
                      isDark
                        ? "bg-[#06021D] border border-gray-600 text-white"
                        : "bg-white text-black"
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    className={cn(
                      "space-y-1",
                      isDark ? "text-white" : "text-gray-800"
                    )}
                  >
                    <Label htmlFor="bankAccountHolder">
                      Account Holder Name
                    </Label>
                    <Input
                      id="bankAccountHolder"
                      value={bankAccountHolder}
                      onChange={(e) => setBankAccountHolder(e.target.value)}
                      disabled={isLoading}
                      className={cn(
                        isDark
                          ? "bg-[#06021D] border border-gray-600 text-white"
                          : "bg-white text-black"
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "space-y-1",
                      isDark ? "text-white" : "text-gray-800"
                    )}
                  >
                    <Label htmlFor="bankAccountNumber">Account Number</Label>
                    <Input
                      id="bankAccountNumber"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      disabled={isLoading}
                      className={cn(
                        isDark
                          ? "bg-[#06021D] border border-gray-600 text-white"
                          : "bg-white text-black"
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "space-y-1",
                      isDark ? "text-white" : "text-gray-800"
                    )}
                  >
                    <Label htmlFor="bankIfscCode">IFSC Code</Label>
                    <Input
                      id="bankIfscCode"
                      value={bankIfscCode}
                      onChange={(e) => setBankIfscCode(e.target.value)}
                      disabled={isLoading}
                      className={cn(
                        isDark
                          ? "bg-[#06021D] border border-gray-600 text-white"
                          : "bg-white text-black"
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "space-y-1",
                      isDark ? "text-white" : "text-gray-800"
                    )}
                  >
                    <Label htmlFor="bankName">Bank Name (Optional)</Label>
                    <Input
                      id="bankName"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      disabled={isLoading}
                      className={cn(
                        isDark
                          ? "bg-[#06021D] border border-gray-600 text-white"
                          : "bg-white text-black"
                      )}
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
                <div
                  className={cn(
                    "space-y-1",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  <Label htmlFor="payoutFriendlyNameUpi">Friendly Name</Label>
                  <Input
                    id="payoutFriendlyNameUpi"
                    value={payoutFriendlyName}
                    onChange={(e) => setPayoutFriendlyName(e.target.value)}
                    placeholder="e.g., My UPI"
                    disabled={isLoading}
                    className={cn(
                      isDark
                        ? "bg-[#06021D] border border-gray-600 text-white"
                        : "bg-white text-black"
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "space-y-1",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  <Label htmlFor="upiHolder">Account Holder Name</Label>
                  <Input
                    id="upiHolder"
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder="e.g., Rahul Kumar"
                    disabled={isLoading}
                    className={cn(
                      isDark
                        ? "bg-[#06021D] border border-gray-600 text-white"
                        : "bg-white text-black"
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "space-y-1",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  <Label htmlFor="upiId">UPI ID</Label>
                  <Input
                    id="upiId"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@bank"
                    disabled={isLoading}
                    className={cn(
                      isDark
                        ? "bg-[#06021D] border border-gray-600 text-white"
                        : "bg-white text-black"
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  UPI withdrawals are instant and usually free. You are
                  responsible for declaring your earnings and paying any taxes
                  as per Indian law.
                </p>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <button
              onClick={handleSavePayoutMethod}
              disabled={isLoading}
              className={cn(
                "w-full text-md rounded-full",
                isDark
                  ? "bg-[#7F39EC] py-3 text-white"
                  : " bg-[#D9C0FF61] py-3.5 text-[#7F39EC] "
              )}
            >
              {isLoading
                ? "Saving..."
                : currentPayoutMethod?.id
                ? "Save Changes"
                : "Add Method"}
            </button>
            <DialogClose asChild>
              <button
                disabled={isLoading}
                className={cn(
                  "w-full text-md rounded-full",
                  isDark
                    ? "py-3 border border-[#FF5353] text-[#FF5353]"
                    : "bg-[#FF323224] text-[#E50000] py-3.5"
                )}
              >
                Cancel
              </button>
            </DialogClose>
          </DialogFooter>

          {payoutMethods.length > 0 && (
            <div
              className={cn(
                "mt-6 pt-4 border-t",
                isDark
                  ? "border-gray-700 text-white"
                  : "border-gray-200 text-gray-800"
              )}
            >
              <h3 className="text-lg font-medium mb-3">Your Saved Methods</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {payoutMethods.map((method) => (
                  <div
                    key={method.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isDark
                        ? "border-[#C9A7FF]"
                        : "border-[#7F39EC] bg-[#D9C0FF26]"
                    )}
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
                    <div className="flex items-center space-x-3">
                      {!method.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "rounded-lg text-white hover:text-white",
                            isDark
                              ? "bg-[#5B1BD6] hover:bg-[#7240DE]"
                              : "bg-[#4A00BE] hover:bg-[#5B1BD6]"
                          )}
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
                        className={cn(
                          "rounded-full",
                          isDark
                            ? "text-white bg-[#2A0A5E] hover:bg-[#3A1390]"
                            : "text-[#4A00BE] bg-[#D8C3FF] hover:bg-[#C8ABFF]"
                        )}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "rounded-full",
                          isDark
                            ? "text-[#FF6F6F] bg-[#3A1212] hover:bg-[#4D1818]"
                            : "text-[#4A00BE] bg-[#D8C3FF] hover:bg-[#C8ABFF]"
                        )}
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
        isdark={isDark}
      >
        <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle
              style={{
                color: isDark ? "white" : "#1f2937",
                transition: "none",
              }}
            >
              Withdraw {activeTabModal === "cash" ? "Balance" : "Coins"}
            </DialogTitle>
            <DialogDescription
              style={{
                color: isDark ? "white" : "#1f2937",
                transition: "none",
              }}
            >
              Withdraw funds to your preferred payout method. Minimum withdrawal
              is {formatCurrencyFromCents(MIN_WITHDRAWAL_AMOUNT)}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {activeTabModal === "cash" && (
              <>
                <div
                  className={cn(
                    "text-lg",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  Available:{" "}
                  <span className="font-semibold">
                    {profile
                      ? formatCurrencyFromCents(profile.withdrawable_balance)
                      : formatCurrencyFromCents(0)}
                  </span>
                </div>
                <div
                  className={cn(
                    "space-y-2",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
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
                    className={cn(
                      isDark
                        ? "bg-[#06021D] border border-gray-600 text-white"
                        : "bg-white text-black"
                    )}
                  />
                </div>
              </>
            )}
            {activeTabModal === "coins" && (
              <>
                <div
                  className={cn(
                    "text-lg",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  Available Coins:{" "}
                  <span className="font-semibold">
                    {formatCoins(userData?.coins || 0)}
                  </span>
                </div>
                <div className={cn(isDark ? "text-white" : "text-gray-800")}>
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
                    className={cn(
                      isDark
                        ? "bg-[#06021D] border border-gray-600 text-white"
                        : "bg-white text-black"
                    )}
                  />
                </div>
              </>
            )}
            <div
              className={cn(
                "space-y-2",
                isDark ? "text-white" : "text-gray-800"
              )}
            >
              <Label htmlFor="withdrawalUserNotes">Notes (Optional)</Label>
              <Input
                id="withdrawalUserNotes"
                value={withdrawalUserNotes}
                onChange={(e) => setWithdrawalUserNotes(e.target.value)}
                placeholder="Optional notes for your withdrawal request"
                disabled={isLoading}
                className={cn(
                  isDark
                    ? "bg-[#06021D] border border-gray-600 text-white"
                    : "bg-white text-black"
                )}
              />
            </div>
            <div
              className={cn(
                "space-y-2",
                isDark ? "text-white" : "text-gray-800"
              )}
            >
              <Label htmlFor="payoutMethodSelect">Select Payout Method</Label>
              <Select
                value={
                  selectedWithdrawMethodId &&
                  availablePayoutMethodsForWithdraw.some(
                    (m) => m.id === selectedWithdrawMethodId
                  )
                    ? selectedWithdrawMethodId
                    : ""
                }
                onValueChange={setSelectedWithdrawMethodId}
                disabled={
                  isLoading ||
                  payoutMethods.length === 0 ||
                  availablePayoutMethodsForWithdraw.length === 0
                }
              >
                <SelectTrigger id="payoutMethodSelect">
                  <SelectValue placeholder="Choose a method..." />
                </SelectTrigger>
                <SelectContent isDark={isDark}>
                  {availablePayoutMethodsForWithdraw
                    .filter((m) => m.is_default)
                    .map((method) => (
                      <SelectItem
                        key={method.id}
                        value={method.id}
                        isDark={isDark}
                      >
                        {getPayoutMethodSummary(method)} (Default)
                      </SelectItem>
                    ))}
                  {availablePayoutMethodsForWithdraw
                    .filter((m) => !m.is_default)
                    .map((method) => (
                      <SelectItem
                        key={method.id}
                        value={method.id}
                        isDark={isDark}
                      >
                        {getPayoutMethodSummary(method)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {pausedPayoutMethodTypes.length > 0 && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  isDark
                    ? "border-amber-800/50 bg-amber-950/30 text-amber-200"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                )}
              >
                <p className="font-medium">
                  Some payment methods are temporarily unavailable
                </p>
                <p className="mt-1">
                  The following payment methods are not available for withdrawals
                  right now:{" "}
                  <span className="font-medium">
                    {pausedPayoutMethodTypes
                      .map((t) => PAYOUT_METHOD_LABELS[t] || t)
                      .join(", ")}
                  </span>
                  . Please use one of the available methods
                  {enabledPayoutMethodTypes.length > 0
                    ? ` (e.g. ${enabledPayoutMethodTypes
                        .slice(0, 3)
                        .map((t) => PAYOUT_METHOD_LABELS[t] || t)
                        .join(", ")})`
                    : ""}
                  .
                </p>
              </div>
            )}
            {payoutMethods.length === 0 && (
              <p className="text-sm text-red-500">
                You have no payout methods. Please add one first.
              </p>
            )}
            {payoutMethods.length > 0 &&
              availablePayoutMethodsForWithdraw.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  None of your payout methods are currently available for
                  withdrawal. Please try again later or add another payment
                  method.
                </p>
              )}
          </div>
          <DialogFooter>
            <Button
              className="w-full py-6 rounded-full text-md"
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
                (activeTabModal === "cash" &&
                  availablePayoutMethodsForWithdraw.length === 0)
              }
            >
              Request Withdrawal
            </Button>
            <DialogClose asChild>
              <Button
                disabled={isLoading}
                className="bg-[#FF323224] text-md text-[#E50000] py-6 rounded-full"
              >
                Cancel
              </Button>
            </DialogClose>
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
