"use client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefundOldWithdrawalsButton } from "@/components/admin/RefundOldWithdrawalsButton";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";

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

export default function WithdrawalsClient({
  initialRequests,
}: {
  initialRequests: Request[];
}) {
  const { isDark } = useAnalyticsDarkMode();
  const [requests, setRequests] = useState<Request[]>(initialRequests || []);
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const [active, setActive] = useState<Request | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [txRef, setTxRef] = useState<string>("");
  const [updating, setUpdating] = useState<boolean>(false);

  const totals = useMemo(() => {
    const all = requests.reduce(
      (sum, r) => sum + (r.amount_type === "cash" ? r.amount : 0),
      0
    );
    const pending = requests
      .filter((r) => r.status === "pending" || r.status === "in_review")
      .reduce((s, r) => s + (r.amount_type === "cash" ? r.amount : 0), 0);
    const paid = requests
      .filter((r) => r.status === "processed" || r.status === "approved")
      .reduce((s, r) => s + (r.amount_type === "cash" ? r.amount : 0), 0);
    const rejected = requests
      .filter((r) => r.status === "rejected" || r.status === "cancelled")
      .reduce((s, r) => s + (r.amount_type === "cash" ? r.amount : 0), 0);
    return { all, pending, paid, rejected };
  }, [requests]);

  const updateStatus = async (
    id: string,
    newStatus: string,
    extras?: { transaction_reference?: string; admin_notes?: string }
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
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
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
        "rounded-xl shadow overflow-x-auto border",
        isDark ? "bg-[#170337] border-gray-700" : "bg-white border-gray-200"
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

                  {/* Mark In Review - only for pending */}
                  {r.status === "pending" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(r.id, "in_review")}
                          disabled={updating}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Mark as under review</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Approve - only for pending and in_review */}
                  {["pending", "in_review"].includes(r.status) && (
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

                  {/* Mark Paid - only for approved */}
                  {r.status === "approved" && (
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

                  {/* Reject - only for pending, in_review, and approved */}
                  {["pending", "in_review", "approved"].includes(r.status) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(r.id, "rejected")}
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

                  {/* Mark Failed - only for approved */}
                  {r.status === "approved" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(r.id, "failed")}
                          disabled={updating}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p>Mark payment as failed</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Cancel - only for pending and in_review */}
                  {["pending", "in_review"].includes(r.status) && (
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const allRows = requests;
  const pendingRows = requests.filter(
    (r) => r.status === "pending" || r.status === "in_review"
  );
  const paidRows = requests.filter(
    (r) => r.status === "processed" || r.status === "approved"
  );
  const rejectedRows = requests.filter(
    (r) => r.status === "rejected" || r.status === "cancelled"
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div
            className={cn(
              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
              isDark ? "bg-[#170337] text-white" : "bg-white text-black"
            )}
          >
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1
                className={cn(
                  "text-md font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Total
              </h1>
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
            </div>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrencyFromCents(totals.all)}
              </div>
              <p
                className={cn(
                  "text-sm mt-2",
                  isDark ? "text-gray-300" : "text-gray-600"
                )}
              >
                Total withdrawal amount
              </p>
            </CardContent>
          </div>
          <div
            className={cn(
              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
              isDark ? "bg-[#170337] text-white" : "bg-white text-black"
            )}
          >
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1
                className={cn(
                  "text-md font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Pending
              </h1>
              <div
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-full",
                  isDark
                    ? "bg-[#FFFFFF36] text-white"
                    : "bg-[#D8C3FF] text-[#4A00BE]"
                )}
              >
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrencyFromCents(totals.pending)}
              </div>
              <p
                className={cn(
                  "text-sm mt-2",
                  isDark ? "text-gray-300" : "text-gray-600"
                )}
              >
                Awaiting review
              </p>
            </CardContent>
          </div>
          <div
            className={cn(
              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
              isDark ? "bg-[#170337] text-white" : "bg-white text-black"
            )}
          >
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1
                className={cn(
                  "text-md font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Paid
              </h1>
              <div
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-full",
                  isDark
                    ? "bg-[#FFFFFF36] text-white"
                    : "bg-[#D8C3FF] text-[#4A00BE]"
                )}
              >
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrencyFromCents(totals.paid)}
              </div>
              <p
                className={cn(
                  "text-sm mt-2",
                  isDark ? "text-gray-300" : "text-gray-600"
                )}
              >
                Successfully processed
              </p>
            </CardContent>
          </div>
          <div
            className={cn(
              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
              isDark ? "bg-[#170337] text-white" : "bg-white text-black"
            )}
          >
            <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
              <h1
                className={cn(
                  "text-md font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Rejected
              </h1>
              <div
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-full",
                  isDark
                    ? "bg-[#FFFFFF36] text-white"
                    : "bg-[#D8C3FF] text-[#4A00BE]"
                )}
              >
                <XCircle className="h-5 w-5" />
              </div>
            </div>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrencyFromCents(totals.rejected)}
              </div>
              <p
                className={cn(
                  "text-sm mt-2",
                  isDark ? "text-gray-300" : "text-gray-600"
                )}
              >
                Rejected or cancelled
              </p>
            </CardContent>
          </div>
        </div>

        {/* Refund Old Withdrawals Button - Minimized */}
        <div className="flex justify-end">
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Additional Controls
            </summary>
            <div className="mt-2 p-3 border rounded-lg bg-muted/30">
              <RefundOldWithdrawalsButton />
            </div>
          </details>
        </div>

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
                    {allRows.length}
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
                    {pendingRows.length}
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
                    {paidRows.length}
                  </Badge>
                </span>
              ),
            },
            {
              id: "rejected",
              label: (
                <span>
                  Rejected{" "}
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs"
                  >
                    {rejectedRows.length}
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
          {selectedTab === "all" && renderTable(allRows)}
          {selectedTab === "pending" && renderTable(pendingRows)}
          {selectedTab === "paid" && renderTable(paidRows)}
          {selectedTab === "rejected" && renderTable(rejectedRows)}
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
                  {active && (
                    <>
                      {/* Cancel - only for pending and in_review */}
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
                      {/* Approve - only for pending and in_review */}
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
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {active && (
                    <>
                      {/* Mark In Review - only for pending */}
                      {active.status === "pending" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatus(active!.id, "in_review", {
                                  admin_notes: adminNotes,
                                })
                              }
                              disabled={updating}
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <p>Mark as under review</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Mark Paid - only for approved */}
                      {active.status === "approved" && (
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
                    </>
                  )}
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
