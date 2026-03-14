"use client";
import {useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Eye,
  Clock,
  CheckCircle,
  DollarSign,
  XCircle,
  AlertTriangle,
  X,
  User,
  Mail,
  Calendar,
  CreditCard,
  Settings,
  Wallet,
  PauseCircle,
  ShieldOff,
  ClipboardCheck,
  RotateCcw,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/ui/pagination-controls";


type Request = {
  id: string;
  created_at: string;
  amount: number;
  currency: string;
  amount_type: "cash" | "coins";
  status: string;
  user_id: string;
  user_notes?: string | null;
  admin_notes?: string | null;
  processed_at?: string | null;
  transaction_reference?: string | null;
  payout_method_type_snapshot?: string | null;
  payout_method_details_snapshot?: any | null;
  users?: {
    full_name?: string | null;
    email?: string | null;
    username?: string | null;
  } | null;
};

const DEFAULT_PAGE_SIZE = 25;

export default function WithdrawalsClient({
  initialRequests = [],
}: {
  initialRequests?: Request[];
}) {
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalsFromApi, setTotalsFromApi] = useState<{
    all: number;
    pending: number;
    approved: number;
    paid: number;
    rejected: number;
    forfeited: number;
    failed: number;
  } | null>(null);
  const [statusCountsFromApi, setStatusCountsFromApi] = useState<{
    all: number;
    pending: number;
    approved: number;
    paid: number;
    rejected: number;
    forfeited: number;
    failed: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const [active, setActive] = useState<Request | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [txRef, setTxRef] = useState<string>("");
  const [updating, setUpdating] = useState<boolean>(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState<boolean>(false);
  const [rejectRequest, setRejectRequest] = useState<Request | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [forfeitDialogOpen, setForfeitDialogOpen] = useState<boolean>(false);
  const [forfeitRequest, setForfeitRequest] = useState<Request | null>(null);
  const [forfeitReason, setForfeitReason] = useState<string>("");
  const [forfeitNotes, setForfeitNotes] = useState<string>("");
  const [failedDialogOpen, setFailedDialogOpen] = useState<boolean>(false);
  const [failedRequest, setFailedRequest] = useState<Request | null>(null);
  const [failedNotes, setFailedNotes] = useState<string>("");
  const [inReviewDialogOpen, setInReviewDialogOpen] = useState<boolean>(false);
  const [inReviewRequest, setInReviewRequest] = useState<Request | null>(null);
  const [inReviewReason, setInReviewReason] = useState<string>("");
  const [payoutMethodSettings, setPayoutMethodSettings] = useState<{ method_type: string; is_paused: boolean }[]>([]);
  const [loadingPayoutSettings, setLoadingPayoutSettings] = useState<boolean>(true);
  const [updatingPayoutMethod, setUpdatingPayoutMethod] = useState<string | null>(null);
// Get theme from parent layout instead of managing independent state
const [isDark, setIsDark] = useState<boolean>(() => {
  if (typeof window !== "undefined") {
    // Check data-mode attribute from parent layout
    const modeElement = document.querySelector("[data-mode]");
    if (modeElement) {
      const dataMode = modeElement.getAttribute("data-mode");
      return dataMode === "dark";
    }
    // Fallback to data-theme attribute
    const themeElement = document.documentElement;
    const dataTheme = themeElement.getAttribute("data-theme");
    return dataTheme === "dark";
  }
  return false; // Default to light mode
});


  const totals = useMemo(() => {
    if (totalsFromApi) return totalsFromApi;
    const sumCash = (list: Request[]) =>
      list.reduce((s, r) => s + (r.amount_type === "cash" ? r.amount : 0), 0);
    const all = sumCash(requests);
    const pending = sumCash(
      requests.filter((r) => r.status === "pending" || r.status === "in_review")
    );
    const approved = sumCash(requests.filter((r) => r.status === "approved"));
    const paid = sumCash(requests.filter((r) => r.status === "processed"));
    const rejected = sumCash(
      requests.filter((r) => r.status === "rejected" || r.status === "cancelled")
    );
    const forfeited = sumCash(requests.filter((r) => r.status === "forfeited"));
    const failed = sumCash(requests.filter((r) => r.status === "failed"));
    return { all, pending, approved, paid, rejected, forfeited, failed };
  }, [requests, totalsFromApi]);

  const fetchWithdrawals = async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/withdrawals?page=${pageNum}&pageSize=${pageSize}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setRequests(json.data ?? []);
      setTotalCount(json.total ?? 0);
      setTotalsFromApi(json.totals ?? null);
      setStatusCountsFromApi(json.statusCounts ?? null);
      setPage(pageNum);
    } catch (e) {
      console.error("Fetch withdrawals error", e);
      setRequests([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals(page);
  }, [page, pageSize]);

   // Watch for theme changes from parent layout
   useEffect(() => {
    const checkTheme = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode");
        const newIsDark = currentMode === "dark";
        if (newIsDark !== isDark) {
          setIsDark(newIsDark);
        }
      }
    };

    checkTheme();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkTheme);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPayoutSettings(true);
      try {
        const res = await fetch("/api/admin/payout-method-settings");
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        setPayoutMethodSettings(json.settings || []);
      } catch {
        if (!cancelled) setPayoutMethodSettings([]);
      } finally {
        if (!cancelled) setLoadingPayoutSettings(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const PAYOUT_METHOD_LABELS: Record<string, string> = {
    crypto: "Crypto",
    upi: "UPI",
    bank_transfer: "Bank transfer",
    phantom: "Phantom",
  };
  const DEFAULT_METHOD_TYPES = ["crypto", "upi", "bank_transfer", "phantom"];

  const setPayoutMethodPaused = async (methodType: string, isPaused: boolean) => {
    setUpdatingPayoutMethod(methodType);
    try {
      const res = await fetch("/api/admin/payout-method-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method_type: methodType, is_paused: isPaused }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPayoutMethodSettings((prev) => {
        const next = prev.filter((s) => s.method_type !== methodType);
        next.push({ method_type: methodType, is_paused: isPaused });
        next.sort((a, b) => a.method_type.localeCompare(b.method_type));
        return next;
      });
    } catch (e) {
      console.error("Failed to update payout method setting", e);
      alert("Failed to update. Please try again.");
    } finally {
      setUpdatingPayoutMethod(null);
    }
  };

  const updateStatus = async (
    id: string,
    newStatus: string,
    extras?: { transaction_reference?: string; admin_notes?: string; in_review_reason?: string }
  ) => {
    try {
      setUpdating(true);
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...(extras || {}) }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: newStatus,
                transaction_reference:
                  extras?.transaction_reference ?? r.transaction_reference,
                admin_notes: extras?.admin_notes ?? r.admin_notes,
                processed_at:
                  newStatus === "processed"
                    ? new Date().toISOString()
                    : r.processed_at,
              }
            : r
        )
      );
      fetchWithdrawals(page);
    } catch (e) {
      console.error("Failed to update status", e);
      alert("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const cancelRequest = async (req: Request) => {
    if (
      !confirm(
        "Cancel this withdrawal request? Note: Balance refund will need to be handled separately."
      )
    )
      return;
    try {
      setUpdating(true);
      const res = await fetch(`/api/admin/withdrawals/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", user_id: req.user_id }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = "Failed to cancel request";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? ({ ...r, status: "cancelled" } as Request) : r
        )
      );
      setDetailsOpen(false);
      fetchWithdrawals(page);
      alert("Withdrawal request cancelled successfully!");
    } catch (e) {
      console.error("Failed to cancel request", e);
      alert(
        `Failed to cancel request: ${
          e instanceof Error ? e.message : "Unknown error"
        }`
      );
    } finally {
      setUpdating(false);
    }
  };

  const openDetails = (req: Request) => {
    setActive(req);
    setAdminNotes(req.admin_notes || "");
    setTxRef(req.transaction_reference || "");
    setDetailsOpen(true);
  };

  const openRejectDialog = (req: Request) => {
    setRejectRequest(req);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectRequest) return;
    const reason = rejectionReason.trim() || undefined;
    try {
      await updateStatus(rejectRequest.id, "rejected", { admin_notes: reason });
      setRejectDialogOpen(false);
      setRejectRequest(null);
      setRejectionReason("");
      setDetailsOpen(false);
    } catch {
      // updateStatus shows alert; keep dialog open to retry
    }
  };

  const FORFEIT_REASONS = [
    { value: "violation_of_terms", label: "Violation of terms" },
    { value: "fraud_invalid_details", label: "Fraud / invalid details" },
    { value: "duplicate_request", label: "Duplicate request" },
    { value: "other", label: "Other" },
  ] as const;

  const openForfeitDialog = (req: Request) => {
    setForfeitRequest(req);
    setForfeitReason("");
    setForfeitNotes("");
    setForfeitDialogOpen(true);
  };

  const confirmForfeit = async () => {
    if (!forfeitRequest) return;
    const reasonLabel = (FORFEIT_REASONS.find((r) => r.value === forfeitReason)?.label ?? forfeitReason) || "Forfeited";
    const notes = forfeitNotes.trim();
    const admin_notes = notes ? `${reasonLabel}\n\nAdditional notes: ${notes}` : reasonLabel;
    try {
      await updateStatus(forfeitRequest.id, "forfeited", { admin_notes });
      setForfeitDialogOpen(false);
      setForfeitRequest(null);
      setForfeitReason("");
      setForfeitNotes("");
      setDetailsOpen(false);
    } catch {
      // updateStatus shows alert; keep dialog open
    }
  };

  const openFailedDialog = (req: Request) => {
    setFailedRequest(req);
    setFailedNotes("");
    setFailedDialogOpen(true);
  };

  const confirmFailed = async () => {
    if (!failedRequest) return;
    const admin_notes = failedNotes.trim() || undefined;
    try {
      await updateStatus(failedRequest.id, "failed", { admin_notes });
      setFailedDialogOpen(false);
      setFailedRequest(null);
      setFailedNotes("");
      setDetailsOpen(false);
    } catch {
      // updateStatus shows alert; keep dialog open
    }
  };

  const openInReviewDialog = (req: Request) => {
    setInReviewRequest(req);
    setInReviewReason("");
    setInReviewDialogOpen(true);
  };

  const confirmInReview = async () => {
    if (!inReviewRequest) return;
    const reason = inReviewReason.trim();
    try {
      await updateStatus(inReviewRequest.id, "in_review", { in_review_reason: reason || undefined });
      const appendedNote = reason ? `\n\nIn review: ${reason}` : "";
      setRequests((prev) =>
        prev.map((r) =>
          r.id === inReviewRequest.id
            ? { ...r, status: "in_review", admin_notes: (r.admin_notes || "") + appendedNote }
            : r
        )
      );
      setInReviewDialogOpen(false);
      setInReviewRequest(null);
      setInReviewReason("");
      setDetailsOpen(false);
      fetchWithdrawals(page);
    } catch {
      // updateStatus shows alert; keep dialog open
    }
  };

  const getPaymentMethodIcon = (r: Request) => {
    const type = (r.payout_method_type_snapshot || "").toLowerCase();
    if (type === "phantom") return Wallet;
    if (type === "crypto") return CreditCard;
    if (type === "upi") return CreditCard;
    if (type === "bank_transfer") return CreditCard;
    return CreditCard;
  };

  const getPaymentMethodColor = (r: Request) => {
    const type = (r.payout_method_type_snapshot || "").toLowerCase();
    if (type === "phantom") return "text-purple-600 dark:text-purple-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const formatPayoutSummary = (r: Request) => {
    const type = (r.payout_method_type_snapshot || "").toLowerCase();
    const d: any = r.payout_method_details_snapshot || {};
    if (type === "upi")
      return `UPI: ${d?.upi_id || ""} (${d?.account_holder_name || ""})`;
    if (type === "crypto") {
      const network = d?.network || "";
      const currency = d?.currency || "";
      const address = d?.wallet_address || "";
      const addressShort = address
        ? `${address.slice(0, 8)}...${address.slice(-8)}`
        : "";
      return `${network} ${currency ? `(${currency})` : ""} • ${addressShort}`;
    }
    if (type === "bank_transfer")
      return `Bank • ${d?.account_holder_name || ""} • ****${String(
        d?.account_number || ""
      ).slice(-4)} • ${d?.ifsc_code || d?.swift_bic_code || ""}`;
    if (type === "phantom") {
      const friendlyName = d?.friendly_name || "";
      const token = d?.preferred_token || "USDC";
      const network =
        d?.network ||
        (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ||
        process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet"
          ? "mainnet"
          : "devnet");
      const address = d?.wallet_address || "";
      const addressShort = address
        ? `${address.slice(0, 8)}...${address.slice(-8)}`
        : "";
      return `Phantom${
        friendlyName ? ` (${friendlyName})` : ""
      } • ${token} • ${network} • ${addressShort}`;
    }
    return type ? `${type}: ${JSON.stringify(d)}` : "Unknown method";
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        variant: "secondary" as const,
        icon: Clock,
        lightColor: "text-yellow-700",
        darkColor: "text-yellow-400",
        lightBgColor: "bg-yellow-100 border-yellow-300",
        darkBgColor: "bg-yellow-900/30 border-yellow-700",
      },
      in_review: {
        variant: "default" as const,
        icon: Eye,
        lightColor: "text-blue-700",
        darkColor: "text-blue-400",
        lightBgColor: "bg-blue-100 border-blue-300",
        darkBgColor: "bg-blue-900/30 border-blue-700",
      },
      approved: {
        variant: "default" as const,
        icon: CheckCircle,
        lightColor: "text-green-700",
        darkColor: "text-green-400",
        lightBgColor: "bg-green-100 border-green-300",
        darkBgColor: "bg-green-900/30 border-green-700",
      },
      processed: {
        variant: "default" as const,
        icon: DollarSign,
        lightColor: "text-green-700",
        darkColor: "text-green-400",
        lightBgColor: "bg-green-100 border-green-300",
        darkBgColor: "bg-green-900/30 border-green-700",
      },
      rejected: {
        variant: "destructive" as const,
        icon: XCircle,
        lightColor: "text-red-700",
        darkColor: "text-red-400",
        lightBgColor: "bg-red-100 border-red-300",
        darkBgColor: "bg-red-900/30 border-red-700",
      },
      failed: {
        variant: "destructive" as const,
        icon: AlertTriangle,
        lightColor: "text-red-700",
        darkColor: "text-red-400",
        lightBgColor: "bg-red-100 border-red-300",
        darkBgColor: "bg-red-900/30 border-red-700",
      },
      cancelled: {
        variant: "outline" as const,
        icon: X,
        lightColor: "text-gray-700",
        darkColor: "text-gray-400",
        lightBgColor: "bg-gray-100 border-gray-300",
        darkBgColor: "bg-gray-800 border-gray-700",
      },
      forfeited: {
        variant: "destructive" as const,
        icon: ShieldOff,
        lightColor: "text-amber-700",
        darkColor: "text-amber-400",
        lightBgColor: "bg-amber-100 border-amber-300",
        darkBgColor: "bg-amber-900/30 border-amber-700",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge
        variant={config.variant}
        className={cn(
          "inline-flex items-center gap-1 border px-1.5 py-0.5 whitespace-nowrap",
          isDark ? config.darkColor : config.lightColor,
          isDark ? config.darkBgColor : config.lightBgColor
        )}
      >
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const formatUserInfo = (r: Request) => {
    const user = r.users;
    if (!user) return <span className="text-muted-foreground">-</span>;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{user.full_name || "Unknown"}</span>
        </div>
        {user.username && (
          <div className="text-sm text-muted-foreground">@{user.username}</div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-3 w-3" />
          {user.email || "-"}
        </div>
      </div>
    );
  };

  const renderTable = (rows: Request[]) => (
    <div
      className={cn(
        "rounded-xl shadow overflow-x-auto",
        isDark ? "bg-[#170337]" : "bg-white  border border-gray-200"
      )}
    >
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
            <TableHead>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                User Details
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Amount
              </div>
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Method
              </div>
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              className="hover:bg-muted/30 transition-colors"
            >
              <TableCell className="whitespace-nowrap">
                <div className="text-sm text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleTimeString()}
                </div>
              </TableCell>
              <TableCell>{formatUserInfo(r)}</TableCell>
              <TableCell className="whitespace-nowrap">
                <div className="text-lg font-semibold">
                  {r.amount_type === "cash"
                    ? formatCurrencyFromCents(r.amount)
                    : `${r.amount} coins`}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {r.amount_type}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {getStatusBadge(r.status)}
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-sm max-w-xs truncate cursor-help">
                      {formatPayoutSummary(r)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="z-50 max-w-md">
                    <div className="space-y-1 text-xs">
                      {(() => {
                        const type = (
                          r.payout_method_type_snapshot || ""
                        ).toLowerCase();
                        const d: any = r.payout_method_details_snapshot || {};

                        if (type === "phantom") {
                          return (
                            <div className="space-y-1">
                              <div>
                                <strong>Friendly Name:</strong>{" "}
                                {d?.friendly_name || "N/A"}
                              </div>
                              <div>
                                <strong>Network:</strong>{" "}
                                {d?.network ||
                                  (process.env.NEXT_PUBLIC_SOLANA_NETWORK ===
                                    "mainnet-beta" ||
                                  process.env.NEXT_PUBLIC_SOLANA_NETWORK ===
                                    "mainnet"
                                    ? "mainnet"
                                    : "devnet")}
                              </div>
                              <div>
                                <strong>Token:</strong>{" "}
                                {d?.preferred_token || "USDC"}
                              </div>
                              <div>
                                <strong>Wallet Address:</strong>{" "}
                                {d?.wallet_address || "N/A"}
                              </div>
                            </div>
                          );
                        }

                        if (type === "crypto") {
                          return (
                            <div className="space-y-1">
                              <div>
                                <strong>Network:</strong> {d?.network || "N/A"}
                              </div>
                              <div>
                                <strong>Currency:</strong>{" "}
                                {d?.currency || "N/A"}
                              </div>
                              <div>
                                <strong>Wallet Address:</strong>{" "}
                                {d?.wallet_address || "N/A"}
                              </div>
                            </div>
                          );
                        }

                        if (type === "upi") {
                          return (
                            <div className="space-y-1">
                              <div>
                                <strong>UPI ID:</strong> {d?.upi_id || "N/A"}
                              </div>
                              <div>
                                <strong>Account Holder:</strong>{" "}
                                {d?.account_holder_name || "N/A"}
                              </div>
                            </div>
                          );
                        }

                        if (type === "bank_transfer") {
                          return (
                            <div className="space-y-1">
                              <div>
                                <strong>Account Holder:</strong>{" "}
                                {d?.account_holder_name || "N/A"}
                              </div>
                              <div>
                                <strong>Account Number:</strong>{" "}
                                {d?.account_number
                                  ? `****${String(d.account_number).slice(-4)}`
                                  : "N/A"}
                              </div>
                              <div>
                                <strong>IFSC/SWIFT:</strong>{" "}
                                {d?.ifsc_code || d?.swift_bic_code || "N/A"}
                              </div>
                              <div>
                                <strong>Bank Name:</strong>{" "}
                                {d?.bank_name || "N/A"}
                              </div>
                            </div>
                          );
                        }

                        return <div>{JSON.stringify(d, null, 2)}</div>;
                      })()}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {/* View button - always available */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDetails(r)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="z-50">
                      <p>View detailed information</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Mark In Review - pending or in_review (add reason for other reviewers) */}
                  {!isFinalStatus(r.status) && ["pending", "in_review"].includes(r.status) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openInReviewDialog(r)}
                          disabled={updating}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Mark as under review (add internal reason)</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Approve - only for pending and in_review */}
                  {!isFinalStatus(r.status) && ["pending", "in_review"].includes(r.status) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(r.id, "approved")}
                          disabled={updating}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Approve for payment</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Mark Paid - approved or failed (retry after failure) */}
                  {!isFinalStatus(r.status) && ["approved", "failed"].includes(r.status) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => updateStatus(r.id, "processed")}
                          disabled={updating}
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Mark as paid</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Reject - pending, in_review, approved, or failed */}
                  {["pending", "in_review", "approved", "failed"].includes(r.status) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRejectDialog(r)}
                          disabled={updating}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Reject request</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Mark Failed - approved only (internal: payment failed) */}
                  {!isFinalStatus(r.status) && r.status === "approved" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openFailedDialog(r)}
                          disabled={updating}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Mark payment as failed (internal)</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Forfeited - only for approved (no refund) */}
                  {!isFinalStatus(r.status) && r.status === "approved" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openForfeitDialog(r)}
                          disabled={updating}
                        >
                          <ShieldOff className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Forfeit (no refund)</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Cancel - pending and in_review only */}
                  {!isFinalStatus(r.status) && ["pending", "in_review"].includes(r.status) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelRequest(r)}
                          disabled={updating}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Cancel and refund</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Back to pending - in_review only */}
                  {!isFinalStatus(r.status) && r.status === "in_review" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(r.id, "pending")}
                          disabled={updating}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Back to pending</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const FINAL_STATUSES = ["processed", "forfeited", "cancelled", "rejected"];
  const isFinalStatus = (s: string) => FINAL_STATUSES.includes(s);

  const allRows = requests;
  const pendingRows = requests.filter(
    (r) => r.status === "pending" || r.status === "in_review"
  );
  const paidRows = requests.filter((r) => r.status === "processed");
  const approvedRows = requests.filter((r) => r.status === "approved");
  const rejectedRows = requests.filter(
    (r) => r.status === "rejected" || r.status === "cancelled"
  );
  const forfeitedRows = requests.filter((r) => r.status === "forfeited");
  const failedRows = requests.filter((r) => r.status === "failed");

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {/* Total Requested */}
          <div
            className={cn(
              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
              isDark ? "bg-[#170337] text-white" : "bg-white text-black"
            )}
          >
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1 className={cn("text-md font-medium", isDark ? "text-white" : "text-gray-900")}>
                Total Requested
              </h1>
              <div className={cn("w-10 h-10 flex items-center justify-center rounded-full", isDark ? "bg-[#FFFFFF36] text-white" : "bg-[#D8C3FF] text-[#4A00BE]")}>
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyFromCents(totals.all)}</div>
              <p className={cn("text-sm mt-2", isDark ? "text-gray-300" : "text-gray-600")}>
                Total withdrawal amount
              </p>
            </CardContent>
          </div>
          <div className={cn("rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3", isDark ? "bg-[#170337] text-white" : "bg-white text-black")}>
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1 className={cn("text-md font-medium", isDark ? "text-white" : "text-gray-900")}>Pending</h1>
              <div className={cn("w-10 h-10 flex items-center justify-center rounded-full", isDark ? "bg-[#FFFFFF36] text-white" : "bg-[#D8C3FF] text-[#4A00BE]")}>
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyFromCents(totals.pending)}</div>
              <p className={cn("text-sm mt-2", isDark ? "text-gray-300" : "text-gray-600")}>Awaiting review</p>
            </CardContent>
          </div>
          <div className={cn("rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3", isDark ? "bg-[#170337] text-white" : "bg-white text-black")}>
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1 className={cn("text-md font-medium", isDark ? "text-white" : "text-gray-900")}>Approved</h1>
              <div className={cn("w-10 h-10 flex items-center justify-center rounded-full", isDark ? "bg-[#FFFFFF36] text-white" : "bg-[#D8C3FF] text-[#4A00BE]")}>
                <ClipboardCheck className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyFromCents(totals.approved)}</div>
              <p className={cn("text-sm mt-2", isDark ? "text-gray-300" : "text-gray-600")}>Approved for payment</p>
            </CardContent>
          </div>
          <div className={cn("rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3", isDark ? "bg-[#170337] text-white" : "bg-white text-black")}>
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1 className={cn("text-md font-medium", isDark ? "text-white" : "text-gray-900")}>Paid</h1>
              <div className={cn("w-10 h-10 flex items-center justify-center rounded-full", isDark ? "bg-[#FFFFFF36] text-white" : "bg-[#D8C3FF] text-[#4A00BE]")}>
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyFromCents(totals.paid)}</div>
              <p className={cn("text-sm mt-2", isDark ? "text-gray-300" : "text-gray-600")}>Successfully processed</p>
            </CardContent>
          </div>
          <div className={cn("rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3", isDark ? "bg-[#170337] text-white" : "bg-white text-black")}>
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1 className={cn("text-md font-medium", isDark ? "text-white" : "text-gray-900")}>Rejected</h1>
              <div className={cn("w-10 h-10 flex items-center justify-center rounded-full", isDark ? "bg-[#FFFFFF36] text-white" : "bg-[#D8C3FF] text-[#4A00BE]")}>
                <XCircle className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrencyFromCents(totals.rejected)}</div>
              <p className={cn("text-sm mt-2", isDark ? "text-gray-300" : "text-gray-600")}>Rejected or cancelled (refund)</p>
            </CardContent>
          </div>
          <div className={cn("rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3", isDark ? "bg-[#170337] text-white" : "bg-white text-black")}>
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1 className={cn("text-md font-medium", isDark ? "text-white" : "text-gray-900")}>Forfeited</h1>
              <div className={cn("w-10 h-10 flex items-center justify-center rounded-full", isDark ? "bg-[#FFFFFF36] text-white" : "bg-[#D8C3FF] text-[#4A00BE]")}>
                <ShieldOff className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrencyFromCents(totals.forfeited)}</div>
              <p className={cn("text-sm mt-2", isDark ? "text-gray-300" : "text-gray-600")}>No refund (e.g. violation)</p>
            </CardContent>
          </div>
          <div className={cn("rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3", isDark ? "bg-[#170337] text-white" : "bg-white text-black")}>
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1 className={cn("text-md font-medium", isDark ? "text-white" : "text-gray-900")}>Failed</h1>
              <div className={cn("w-10 h-10 flex items-center justify-center rounded-full", isDark ? "bg-[#FFFFFF36] text-white" : "bg-[#D8C3FF] text-[#4A00BE]")}>
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrencyFromCents(totals.failed)}</div>
              <p className={cn("text-sm mt-2", isDark ? "text-gray-300" : "text-gray-600")}>Payment failed (internal)</p>
            </CardContent>
          </div>
        </div>

        {/* Payout method availability – pause/unpause methods globally */}
        <Card
          className={cn(
            "shadow-sm",
            isDark ? "bg-[#170337] border border-gray-700 text-white" : "bg-white text-black"
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <PauseCircle className="h-4 w-4" />
              Payout method availability
            </CardTitle>
            <CardDescription className={cn("text-sm", isDark ? "text-gray-400" : "text-muted-foreground")}>
              When a method is paused, users cannot request withdrawals using that payment method. They will see a message to use another method.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingPayoutSettings ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="flex flex-wrap gap-6">
                {DEFAULT_METHOD_TYPES.map((methodType) => {
                  const setting = payoutMethodSettings.find((s) => s.method_type === methodType);
                  const isPaused = setting ? setting.is_paused : false;
                  const updating = updatingPayoutMethod === methodType;
                  return (
                    <div
                      key={methodType}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 min-w-[180px]",
                        isDark ? "border-gray-600 bg-[#06021D]/50" : "border-slate-200 bg-slate-50/50"
                      )}
                    >
                      <span className="font-medium capitalize">
                        {PAYOUT_METHOD_LABELS[methodType] || methodType}
                      </span>
                      <Switch
                        checked={!isPaused}
                        onCheckedChange={(checked) => setPayoutMethodPaused(methodType, !checked)}
                        disabled={updating}
                        theme={isDark ? "dark" : "light"}
                        variant="theme-aware"
                      />
                      {isPaused && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">Paused</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <EnhancedTabs
          tabs={[
            {
              id: "all",
              label: (
                <span>
                  All{" "}
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs"
                  >
                    {statusCountsFromApi?.all ?? allRows.length}
                  </Badge>
                </span>
              ),
            },
            {
              id: "pending",
              label: (
                <span>
                  Pending{" "}
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs"
                  >
                    {statusCountsFromApi?.pending ?? pendingRows.length}
                  </Badge>
                </span>
              ),
            },
            {
              id: "paid",
              label: (
                <span>
                  Paid{" "}
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs"
                  >
                    {statusCountsFromApi?.paid ?? paidRows.length}
                  </Badge>
                </span>
              ),
            },
            {
              id: "rejected",
              label: (
                <span>
                  Rejected{" "}
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                    {statusCountsFromApi?.rejected ?? rejectedRows.length}
                  </Badge>
                </span>
              ),
            },
            {
              id: "approved",
              label: (
                <span>
                  Approved{" "}
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                    {statusCountsFromApi?.approved ?? approvedRows.length}
                  </Badge>
                </span>
              ),
            },
            {
              id: "forfeited",
              label: (
                <span>
                  Forfeited{" "}
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                    {statusCountsFromApi?.forfeited ?? forfeitedRows.length}
                  </Badge>
                </span>
              ),
            },
            {
              id: "failed",
              label: (
                <span>
                  Failed{" "}
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                    {statusCountsFromApi?.failed ?? failedRows.length}
                  </Badge>
                </span>
              ),
            },
          ]}
          activeTab={selectedTab}
          onTabChange={setSelectedTab}
          className="mb-8"
          isDark={isDark}
          light={!isDark}
        />

        <div className="mt-4">
          {loading ? (
            <div className={cn("py-12 text-center text-sm", isDark ? "text-gray-400" : "text-gray-600")}>
              Loading withdrawals…
            </div>
          ) : (
            <>
              {selectedTab === "all" && renderTable(allRows)}
              {selectedTab === "pending" && renderTable(pendingRows)}
              {selectedTab === "paid" && renderTable(paidRows)}
              {selectedTab === "rejected" && renderTable(rejectedRows)}
              {selectedTab === "approved" && renderTable(approvedRows)}
              {selectedTab === "forfeited" && renderTable(forfeitedRows)}
              {selectedTab === "failed" && renderTable(failedRows)}
              <div className={cn("mt-4 border-t pt-4", isDark ? "border-gray-700" : "border-gray-200")}>
                <PaginationControls
                  page={page}
                  limit={pageSize}
                  total={totalCount}
                  totalPages={Math.ceil(totalCount / pageSize) || 1}
                  hasNextPage={page < (Math.ceil(totalCount / pageSize) || 1)}
                  hasPreviousPage={page > 1}
                  onPageChange={setPage}
                  onLimitChange={(limit) => {
                    setPageSize(limit);
                    setPage(1);
                  }}
                  loading={loading}
                  isDark={isDark}
                />
              </div>
            </>
          )}
        </div>

        {/* Enhanced Details Modal */}
        <Dialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          isdark={isDark}
        >
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle
                className={cn(
                  "flex items-center gap-2",
                  isDark ? "text-white" : "text-black"
                )}
              >
                <DollarSign className="h-5 w-5" />
                Withdrawal Details
              </DialogTitle>
              <DialogDescription>
                Review withdrawal information and manage the request status
              </DialogDescription>
            </DialogHeader>
            {active && (
              <div className="space-y-4 py-4">
                {/* Key Information Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Created Date Card */}
                  <Card
                    className={cn(
                      "border-l-4 border-l-blue-500 shadow-sm",
                      isDark ? "bg-[#170337] text-white" : "bg-white text-black"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-lg",
                            isDark ? "bg-blue-900/20" : "bg-blue-100"
                          )}
                        >
                          <Calendar
                            className={cn(
                              "h-4 w-4",
                              isDark ? "text-blue-400" : "text-blue-600"
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Created
                          </p>
                          <p className="text-sm font-semibold truncate">
                            {new Date(active.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(active.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Amount Card */}
                  <Card
                    className={cn(
                      "border-l-4 border-l-green-500 shadow-sm",
                      isDark ? "bg-[#170337] text-white" : "bg-white text-black"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-lg",
                            isDark ? "bg-green-900/20" : "bg-green-100"
                          )}
                        >
                          <DollarSign
                            className={cn(
                              "h-4 w-4",
                              isDark ? "text-green-400" : "text-green-600"
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Amount
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold truncate",
                              isDark ? "text-green-400" : "text-green-600"
                            )}
                          >
                            {active.amount_type === "cash"
                              ? formatCurrencyFromCents(active.amount)
                              : `${active.amount} coins`}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {active.amount_type}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Status Card */}
                  <Card
                    className={cn(
                      "border-l-4 border-l-purple-500 shadow-sm",
                      isDark ? "bg-[#170337] text-white" : "bg-white text-black"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-lg",
                            isDark ? "bg-purple-900/20" : "bg-purple-100"
                          )}
                        >
                          <Clock
                            className={cn(
                              "h-4 w-4",
                              isDark ? "text-purple-400" : "text-purple-600"
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Status
                          </p>
                          <div className="mt-1">
                            {getStatusBadge(active.status)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* User Information */}
                <Card
                  className={cn(
                    "shadow-sm",
                    isDark
                      ? "bg-[#06021D] border border-gray-600 text-white"
                      : "bg-white text-black"
                  )}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      User Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {formatUserInfo(active)}
                  </CardContent>
                </Card>

                {/* Payment Details */}
                <Card
                  className={cn(
                    "shadow-sm",
                    isDark
                      ? "bg-[#06021D] border border-gray-600 text-white"
                      : "bg-white text-black"
                  )}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          isDark ? "bg-orange-900/20" : "bg-orange-100"
                        )}
                      >
                        {(() => {
                          const IconComponent = getPaymentMethodIcon(active);
                          const colorClass = getPaymentMethodColor(active);
                          return (
                            <IconComponent
                              className={`h-4 w-4 ${colorClass}`}
                            />
                          );
                        })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Payment Method
                        </p>
                        <div className="text-sm bg-muted/50 px-2 py-1 rounded mt-1">
                          {(() => {
                            const type = (
                              active.payout_method_type_snapshot || ""
                            ).toLowerCase();
                            const d: any =
                              active.payout_method_details_snapshot || {};

                            if (type === "phantom") {
                              return (
                                <div className="space-y-2">
                                  <div className="font-medium">
                                    Phantom Wallet
                                  </div>
                                  {d?.friendly_name && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">
                                        Friendly Name:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d.friendly_name}
                                      </span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">
                                        Network:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.network ||
                                          (process.env
                                            .NEXT_PUBLIC_SOLANA_NETWORK ===
                                            "mainnet-beta" ||
                                          process.env
                                            .NEXT_PUBLIC_SOLANA_NETWORK ===
                                            "mainnet"
                                            ? "mainnet"
                                            : "devnet")}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Token:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.preferred_token || "USDC"}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Wallet Address:
                                    </div>
                                    <div className="font-mono text-xs break-all bg-background/50 p-2 rounded border">
                                      {d?.wallet_address || "No address"}
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            if (type === "crypto") {
                              return (
                                <div className="space-y-2">
                                  <div className="font-medium">
                                    Crypto Wallet
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">
                                        Network:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.network || "N/A"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Currency:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.currency || "N/A"}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Wallet Address:
                                    </div>
                                    <div className="font-mono text-xs break-all bg-background/50 p-2 rounded border">
                                      {d?.wallet_address || "No address"}
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            if (type === "upi") {
                              return (
                                <div className="space-y-2">
                                  <div className="font-medium">UPI Payment</div>
                                  <div className="space-y-1 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">
                                        UPI ID:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.upi_id || "N/A"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Account Holder:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.account_holder_name || "N/A"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            if (type === "bank_transfer") {
                              return (
                                <div className="space-y-2">
                                  <div className="font-medium">
                                    Bank Transfer
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">
                                        Account Holder:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.account_holder_name || "N/A"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Account Number:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.account_number
                                          ? `****${String(
                                              d.account_number
                                            ).slice(-4)}`
                                          : "N/A"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        IFSC/SWIFT:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.ifsc_code ||
                                          d?.swift_bic_code ||
                                          "N/A"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Bank Name:
                                      </span>{" "}
                                      <span className="font-medium">
                                        {d?.bank_name || "N/A"}
                                      </span>
                                    </div>
                                    {d?.branch_name && (
                                      <div>
                                        <span className="text-muted-foreground">
                                          Branch:
                                        </span>{" "}
                                        <span className="font-medium">
                                          {d.branch_name}
                                        </span>
                                      </div>
                                    )}
                                    {d?.country && (
                                      <div>
                                        <span className="text-muted-foreground">
                                          Country:
                                        </span>{" "}
                                        <span className="font-medium">
                                          {d.country}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <p className="font-mono break-all">
                                {formatPayoutSummary(active)}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Admin Actions */}
                <Card
                  className={cn(
                    "shadow-sm",
                    isDark
                      ? "bg-[#06021D] border border-gray-600 text-white"
                      : "bg-white text-black"
                  )}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Admin Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label
                          htmlFor="admin_notes"
                          className="text-xs font-medium"
                        >
                          Admin Notes
                        </Label>
                        <Input
                          id="admin_notes"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Add notes for audit trail..."
                          className={cn(
                            "w-full h-8 text-sm",
                            isDark
                              ? "bg-[#06021D] border border-gray-600 text-white"
                              : "bg-white text-black"
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tx_ref" className="text-xs font-medium">
                          Transaction Reference
                        </Label>
                        <Input
                          id="tx_ref"
                          value={txRef}
                          onChange={(e) => setTxRef(e.target.value)}
                          placeholder="UTR / TXID / Reference #"
                          className={cn(
                            "w-full h-8 text-sm",
                            isDark
                              ? "bg-[#06021D] border border-gray-600 text-white"
                              : "bg-white text-black"
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            <DialogFooter className="border-t pt-4 mt-4">
              <div className="flex flex-wrap gap-2 w-full justify-between">
                <div className="flex flex-wrap gap-2">
                  {active && !isFinalStatus(active.status) && (
                    <>
                      {/* Cancel - pending and in_review */}
                      {["pending", "in_review"].includes(active.status) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelRequest(active!)}
                              disabled={updating}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <p>Cancel and refund user balance</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Approve - pending and in_review */}
                      {["pending", "in_review"].includes(active.status) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatus(active!.id, "approved", {
                                  admin_notes: adminNotes,
                                })
                              }
                              disabled={updating}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <p>Approve for payment processing</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Reject - pending, in_review, approved, failed */}
                      {["pending", "in_review", "approved", "failed"].includes(active.status) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRejectDialog(active!)}
                              disabled={updating}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <p>Reject request (optionally add reason for user)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Back to pending - in_review only */}
                      {active.status === "in_review" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(active!.id, "pending")}
                              disabled={updating}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Back to pending
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <p>Revert to pending</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {active && !isFinalStatus(active.status) && (
                    <>
                      {/* Mark In Review - pending or in_review (add internal reason) */}
                      {["pending", "in_review"].includes(active.status) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInReviewDialog(active!)}
                              disabled={updating}
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <p>Mark as under review (add internal reason for other reviewers)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Mark Paid - approved or failed */}
                      {["approved", "failed"].includes(active.status) && (
                        <Button
                          size="sm"
                          onClick={() =>
                            updateStatus(active!.id, "processed", {
                              transaction_reference: txRef,
                              admin_notes: adminNotes,
                            })
                          }
                          disabled={updating}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                      {/* Mark Failed - approved only */}
                      {active.status === "approved" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openFailedDialog(active!)}
                              disabled={updating}
                            >
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              Failed
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <p>Payment failed (internal tracking)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Forfeited - approved only */}
                      {active.status === "approved" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openForfeitDialog(active!)}
                              disabled={updating}
                            >
                              <ShieldOff className="h-4 w-4 mr-1" />
                              Forfeit
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <p>Forfeit (no refund)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject withdrawal – optional reason */}
        <Dialog
          open={rejectDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setRejectDialogOpen(false);
              setRejectRequest(null);
              setRejectionReason("");
            }
          }}
          isdark={isDark}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle
                className={cn(
                  "flex items-center gap-2",
                  isDark ? "text-white" : "text-black"
                )}
              >
                <XCircle className="h-5 w-5 text-red-500" />
                Reject withdrawal request
              </DialogTitle>
              <DialogDescription>
                You can optionally provide a reason for the rejection. It will
                be shared with the user so they understand why the request was
                declined.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <Label
                htmlFor="rejection_reason"
                className={cn(isDark ? "text-white" : "text-gray-800")}
              >
                Reason for rejection (optional)
              </Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Invalid payout details, please add a valid UPI ID and try again."
                rows={3}
                className={cn(
                  "resize-none",
                  isDark
                    ? "bg-[#06021D] border border-gray-600 text-white placeholder:text-gray-400"
                    : "bg-white text-black"
                )}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectRequest(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReject}
                disabled={updating}
              >
                {updating ? "Rejecting…" : "Reject request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark in review – internal reason (visible to other reviewers only) */}
        <Dialog
          open={inReviewDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setInReviewDialogOpen(false);
              setInReviewRequest(null);
              setInReviewReason("");
            }
          }}
          isdark={isDark}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className={cn("flex items-center gap-2", isDark ? "text-white" : "text-black")}>
                <Clock className="h-5 w-5 text-blue-500" />
                Mark as in review
              </DialogTitle>
              <DialogDescription>
                Add an internal reason so other reviewers can see why this request was marked in review. Only visible to admins, not to the user.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <Label className={cn(isDark ? "text-white" : "text-gray-800")}>Reason for review (internal)</Label>
              <Textarea
                value={inReviewReason}
                onChange={(e) => setInReviewReason(e.target.value)}
                placeholder="e.g. Suspicious payout details, need to verify ID..."
                rows={3}
                className={cn(
                  "resize-none",
                  isDark ? "bg-[#06021D] border border-gray-600 text-white placeholder:text-gray-400" : "bg-white text-black"
                )}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setInReviewDialogOpen(false);
                  setInReviewRequest(null);
                  setInReviewReason("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={confirmInReview} disabled={updating}>
                {updating ? "Updating…" : "Mark in review"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Forfeit withdrawal – predefined reason + additional notes (no refund) */}
        <Dialog
          open={forfeitDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setForfeitDialogOpen(false);
              setForfeitRequest(null);
              setForfeitReason("");
              setForfeitNotes("");
            }
          }}
          isdark={isDark}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className={cn("flex items-center gap-2", isDark ? "text-white" : "text-black")}>
                <ShieldOff className="h-5 w-5 text-amber-500" />
                Forfeit withdrawal (no refund)
              </DialogTitle>
              <DialogDescription>
                Use when the user violated terms, cheated, or similar. No refund will be given. Select a reason and optionally add notes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <Label className={cn(isDark ? "text-white" : "text-gray-800")}>Reason (required)</Label>
              <Select value={forfeitReason} onValueChange={setForfeitReason}>
                <SelectTrigger className={cn(isDark ? "bg-[#06021D] border-gray-600 text-white" : "bg-white text-black")}>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {FORFEIT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className={cn(isDark ? "text-white" : "text-gray-800")}>Additional notes (optional)</Label>
              <Textarea
                value={forfeitNotes}
                onChange={(e) => setForfeitNotes(e.target.value)}
                placeholder="Extra details for audit..."
                rows={3}
                className={cn(
                  "resize-none",
                  isDark ? "bg-[#06021D] border border-gray-600 text-white placeholder:text-gray-400" : "bg-white text-black"
                )}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setForfeitDialogOpen(false);
                  setForfeitRequest(null);
                  setForfeitReason("");
                  setForfeitNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmForfeit}
                disabled={updating || !forfeitReason}
              >
                {updating ? "Forfeiting…" : "Forfeit (no refund)"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark Failed – optional internal notes */}
        <Dialog
          open={failedDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setFailedDialogOpen(false);
              setFailedRequest(null);
              setFailedNotes("");
            }
          }}
          isdark={isDark}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className={cn("flex items-center gap-2", isDark ? "text-white" : "text-black")}>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Mark payment as failed
              </DialogTitle>
              <DialogDescription>
                Use when payment failed on our side (e.g. bank error). No refund. You can later reject so the user can request again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <Label className={cn(isDark ? "text-white" : "text-gray-800")}>Internal notes (optional)</Label>
              <Textarea
                value={failedNotes}
                onChange={(e) => setFailedNotes(e.target.value)}
                placeholder="e.g. Bank returned payment, invalid account..."
                rows={3}
                className={cn(
                  "resize-none",
                  isDark ? "bg-[#06021D] border border-gray-600 text-white placeholder:text-gray-400" : "bg-white text-black"
                )}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setFailedDialogOpen(false);
                  setFailedRequest(null);
                  setFailedNotes("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={confirmFailed} disabled={updating}>
                {updating ? "Updating…" : "Mark as failed"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
