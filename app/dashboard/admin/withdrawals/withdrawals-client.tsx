"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { subDays } from "date-fns";
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
  MoreVertical,
  Copy,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Paperclip,
  Link2,
  ExternalLink,
  FileImage,
  Trash2,
  Loader2,
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
import { AdminDateRangePicker } from "@/components/admin/AdminDateRangePicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { compressImage } from "@/lib/image-compression";
import {
  WITHDRAWAL_EXPORT_COLUMN_IDS,
  WITHDRAWAL_EXPORT_COLUMN_LABELS,
} from "@/lib/withdrawal-export-columns";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";


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
  payment_proof_link?: string | null;
  payment_proof_storage_path?: string | null;
  payment_proof_file_size_bytes?: number | null;
};

const DEFAULT_PAGE_SIZE = 25;

/** Must match server `MAX_PROOF_FILE_BYTES` in payment-proof route. */
const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;

function formatProofFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type WithdrawalsSortKey =
  | "created_at"
  | "amount"
  | "user_full_name"
  | "username"
  | "email";

function defaultFilterRange() {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = subDays(now, 29);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

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
  const [filterRange, setFilterRange] = useState(defaultFilterRange);
  const [filterPresetLabel, setFilterPresetLabel] = useState("Last 30 Days");
  const [sortKey, setSortKey] = useState<WithdrawalsSortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        WITHDRAWAL_EXPORT_COLUMN_IDS.map((id) => [id, true] as const),
      ),
  );
  const [paymentProofLinkDraft, setPaymentProofLinkDraft] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [proofRemoving, setProofRemoving] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [metadataDirty, setMetadataDirty] = useState(false);
  const proofFileInputRef = useRef<HTMLInputElement>(null);

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

  const filterFromMs = filterRange.from.getTime();
  const filterToMs = filterRange.to.getTime();

  const reloadWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        tab: selectedTab,
        sort: sortKey,
        order: sortOrder,
        createdFrom: new Date(filterFromMs).toISOString(),
        createdTo: new Date(filterToMs).toISOString(),
      });
      const res = await fetch(`/api/admin/withdrawals?${params}`);
      if (!res.ok) {
        let message = `Withdrawals request failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* ignore */
        }
        toast.error(message);
        setRequests([]);
        setTotalCount(0);
        return;
      }
      const json = await res.json();
      setRequests(json.data ?? []);
      setTotalCount(json.total ?? 0);
      setTotalsFromApi(json.totals ?? null);
      setStatusCountsFromApi(json.statusCounts ?? null);
    } catch (e) {
      console.error("Fetch withdrawals error", e);
      setRequests([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    selectedTab,
    sortKey,
    sortOrder,
    filterFromMs,
    filterToMs,
  ]);

  useEffect(() => {
    void reloadWithdrawals();
  }, [reloadWithdrawals]);

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
  const DEFAULT_METHOD_TYPES = ["crypto", "upi", "bank_transfer"];

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
    extras?: {
      transaction_reference?: string;
      admin_notes?: string;
      in_review_reason?: string;
    },
    opts?: { closeDetails?: boolean },
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
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
      if (opts?.closeDetails) {
        setDetailsOpen(false);
      }
      void reloadWithdrawals();
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
      void reloadWithdrawals();
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
    setPaymentProofLinkDraft(req.payment_proof_link || "");
    setMetadataDirty(false);
    setDetailsOpen(true);
  };

  const saveMetadata = async () => {
    if (!active) return;
    setSavingMetadata(true);
    try {
      const linkTrim = paymentProofLinkDraft.trim();
      const res = await fetch(`/api/admin/withdrawals/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "metadata",
          admin_notes: adminNotes,
          transaction_reference: txRef,
          payment_proof_link: linkTrim.length ? linkTrim : null,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      const nextLink = linkTrim.length ? linkTrim : null;
      setMetadataDirty(false);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === active.id
            ? {
                ...r,
                admin_notes: adminNotes,
                transaction_reference: txRef,
                payment_proof_link: nextLink,
              }
            : r,
        ),
      );
      setActive((prev) =>
        prev && prev.id === active.id
          ? {
              ...prev,
              admin_notes: adminNotes,
              transaction_reference: txRef,
              payment_proof_link: nextLink,
            }
          : prev,
      );
      toast.success("Notes and proof link saved");
      void reloadWithdrawals();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Could not save metadata",
      );
    } finally {
      setSavingMetadata(false);
    }
  };

  const openProofInNewTab = async (requestId: string) => {
    try {
      const res = await fetch(
        `/api/admin/withdrawals/${requestId}/payment-proof-url`,
      );
      if (!res.ok) throw new Error("Could not get proof URL");
      const json = (await res.json()) as { url?: string };
      if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      toast.error("Could not open payment proof file");
    }
  };

  const onPaymentProofFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !active) return;
    if (file.size > PAYMENT_PROOF_MAX_BYTES) {
      toast.error(
        `File is too large. Maximum size is ${PAYMENT_PROOF_MAX_BYTES / 1024 / 1024} MB.`,
      );
      return;
    }
    setProofUploading(true);
    try {
      let uploadFile = file;
      if (file.type.startsWith("image/")) {
        uploadFile = await compressImage(file);
      }
      if (uploadFile.size > PAYMENT_PROOF_MAX_BYTES) {
        toast.error(
          `File is still too large after processing. Maximum size is ${PAYMENT_PROOF_MAX_BYTES / 1024 / 1024} MB.`,
        );
        return;
      }
      const fd = new FormData();
      fd.set("file", uploadFile);
      const res = await fetch(
        `/api/admin/withdrawals/${active.id}/payment-proof`,
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const t = await res.text();
        let message = t;
        try {
          const j = JSON.parse(t) as { error?: string };
          if (j?.error) message = j.error;
        } catch {
          /* keep raw */
        }
        throw new Error(message);
      }
      const json = (await res.json()) as {
        payment_proof_storage_path?: string;
        payment_proof_file_size_bytes?: number;
      };
      const path = json.payment_proof_storage_path ?? null;
      const sizeBytes = json.payment_proof_file_size_bytes ?? null;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === active.id
            ? {
                ...r,
                payment_proof_storage_path: path,
                payment_proof_file_size_bytes: sizeBytes,
              }
            : r,
        ),
      );
      setActive((prev) =>
        prev && prev.id === active.id
          ? {
              ...prev,
              payment_proof_storage_path: path,
              payment_proof_file_size_bytes: sizeBytes,
            }
          : prev,
      );
      toast.success("Payment proof file uploaded");
      void reloadWithdrawals();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProofUploading(false);
      if (proofFileInputRef.current) proofFileInputRef.current.value = "";
    }
  };

  const removePaymentProofFile = async () => {
    if (!active?.payment_proof_storage_path) return;
    if (
      !confirm(
        "Remove the uploaded payment proof file from this withdrawal? This cannot be undone.",
      )
    ) {
      return;
    }
    setProofRemoving(true);
    try {
      const res = await fetch(
        `/api/admin/withdrawals/${active.id}/payment-proof`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const t = await res.text();
        let message = t;
        try {
          const j = JSON.parse(t) as { error?: string };
          if (j?.error) message = j.error;
        } catch {
          /* keep raw */
        }
        throw new Error(message);
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === active.id
            ? {
                ...r,
                payment_proof_storage_path: null,
                payment_proof_file_size_bytes: null,
              }
            : r,
        ),
      );
      setActive((prev) =>
        prev && prev.id === active.id
          ? {
              ...prev,
              payment_proof_storage_path: null,
              payment_proof_file_size_bytes: null,
            }
          : prev,
      );
      toast.success("Payment proof file removed");
      void reloadWithdrawals();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not remove file");
    } finally {
      setProofRemoving(false);
    }
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
      void reloadWithdrawals();
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

  const getCopyablePayoutParts = (
    r: Request,
  ): { label: string; value: string }[] => {
    const type = (r.payout_method_type_snapshot || "").toLowerCase();
    const d: any = r.payout_method_details_snapshot || {};
    if (type === "upi") {
      const parts: { label: string; value: string }[] = [];
      if (d?.upi_id) parts.push({ label: "UPI ID", value: String(d.upi_id) });
      if (d?.account_holder_name)
        parts.push({
          label: "Account holder",
          value: String(d.account_holder_name),
        });
      return parts;
    }
    if (type === "crypto" || type === "phantom") {
      if (d?.wallet_address)
        return [{ label: "Wallet", value: String(d.wallet_address) }];
    }
    if (type === "bank_transfer") {
      const parts: { label: string; value: string }[] = [];
      if (d?.account_holder_name)
        parts.push({
          label: "Account holder",
          value: String(d.account_holder_name),
        });
      if (d?.account_number)
        parts.push({ label: "Account #", value: String(d.account_number) });
      const ifsc = d?.ifsc_code || d?.swift_bic_code;
      if (ifsc) parts.push({ label: "IFSC / SWIFT", value: String(ifsc) });
      return parts;
    }
    return [];
  };

  const copyText = async (text: string, doneLabel: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${doneLabel} copied`);
    } catch {
      toast.error("Could not copy");
    }
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

  const FINAL_STATUSES = ["processed", "forfeited", "cancelled", "rejected"];
  const isFinalStatus = (s: string) => FINAL_STATUSES.includes(s);

  const handleSortColumn = (key: WithdrawalsSortKey) => {
    setPage(1);
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder(key === "created_at" ? "desc" : "asc");
    }
  };

  const SortableTh = ({
    colKey,
    label,
    icon,
  }: {
    colKey: WithdrawalsSortKey;
    label: string;
    icon?: ReactNode;
  }) => {
    const active = sortKey === colKey;
    return (
      <TableHead
        className={cn(
          "cursor-pointer select-none",
          isDark ? "hover:bg-white/10" : "hover:bg-slate-100",
        )}
        onClick={() => handleSortColumn(colKey)}
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {icon}
          <span>{label}</span>
          {active ? (
            sortOrder === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-45" />
          )}
        </div>
      </TableHead>
    );
  };

  const renderTable = (rows: Request[]) => (
    <div
      className={cn(
        "rounded-xl shadow overflow-x-auto",
        isDark ? "bg-[#170337]" : "bg-white  border border-gray-200"
      )}
    >
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow
            className={cn(
              "text-left border-b",
              isDark
                ? "bg-[#391A6A] text-white"
                : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500"
            )}
          >
            <SortableTh
              colKey="created_at"
              label="Created"
              icon={<Calendar className="h-4 w-4" />}
            />
            <SortableTh
              colKey="user_full_name"
              label="Name"
              icon={<User className="h-4 w-4" />}
            />
            <SortableTh
              colKey="username"
              label="Username"
            />
            <SortableTh
              colKey="email"
              label="Email"
              icon={<Mail className="h-4 w-4" />}
            />
            <SortableTh
              colKey="amount"
              label="Amount"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <TableHead>Status</TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment method
              </div>
            </TableHead>
            <TableHead className="w-12 text-right"> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const user = r.users;
            const copyParts = getCopyablePayoutParts(r);
            return (
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
                <TableCell className="max-w-[160px]">
                  <span className="font-medium truncate block">
                    {user?.full_name || "—"}
                  </span>
                </TableCell>
                <TableCell className="max-w-[120px]">
                  {user?.username ? (
                    <span className="text-sm truncate block">
                      @{user.username}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  {user?.email ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm truncate">{user.email}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() =>
                          void copyText(user.email!, "Email")
                        }
                        aria-label="Copy email"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
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
                  <div className="flex flex-col gap-1 max-w-xs">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-sm truncate cursor-help">
                          {formatPayoutSummary(r)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="z-50 max-w-md">
                        <div className="space-y-1 text-xs">
                          {(() => {
                            const type = (
                              r.payout_method_type_snapshot || ""
                            ).toLowerCase();
                            const d: any =
                              r.payout_method_details_snapshot || {};

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
                                      (process.env
                                        .NEXT_PUBLIC_SOLANA_NETWORK ===
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
                                    <strong>Network:</strong>{" "}
                                    {d?.network || "N/A"}
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
                                    <strong>UPI ID:</strong>{" "}
                                    {d?.upi_id || "N/A"}
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
                                      ? `****${String(
                                          d.account_number,
                                        ).slice(-4)}`
                                      : "N/A"}
                                  </div>
                                  <div>
                                    <strong>IFSC/SWIFT:</strong>{" "}
                                    {d?.ifsc_code ||
                                      d?.swift_bic_code ||
                                      "N/A"}
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
                    {copyParts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {copyParts.map((p) => (
                          <Button
                            key={p.label}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => void copyText(p.value, p.label)}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Row actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className={cn(isDark && "bg-[#170337] border-gray-600")}
                    >
                      <DropdownMenuItem onSelect={() => openDetails(r)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View details
                      </DropdownMenuItem>
                      {r.payment_proof_link && (
                        <DropdownMenuItem
                          onSelect={() =>
                            window.open(
                              r.payment_proof_link!,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          Open proof link
                        </DropdownMenuItem>
                      )}
                      {r.payment_proof_storage_path && (
                        <DropdownMenuItem
                          onSelect={() => void openProofInNewTab(r.id)}
                        >
                          Open proof file
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {!isFinalStatus(r.status) &&
                        ["pending", "in_review"].includes(r.status) && (
                          <DropdownMenuItem
                            disabled={updating}
                            onSelect={() => openInReviewDialog(r)}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Mark in review
                          </DropdownMenuItem>
                        )}
                      {!isFinalStatus(r.status) &&
                        ["pending", "in_review"].includes(r.status) && (
                          <DropdownMenuItem
                            disabled={updating}
                            onSelect={() =>
                              void updateStatus(r.id, "approved")
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                        )}
                      {!isFinalStatus(r.status) &&
                        ["approved", "failed"].includes(r.status) && (
                          <DropdownMenuItem
                            disabled={updating}
                            onSelect={() =>
                              void updateStatus(r.id, "processed")
                            }
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Mark paid
                          </DropdownMenuItem>
                        )}
                      {["pending", "in_review", "approved", "failed"].includes(
                        r.status,
                      ) && (
                        <DropdownMenuItem
                          disabled={updating}
                          onSelect={() => openRejectDialog(r)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </DropdownMenuItem>
                      )}
                      {!isFinalStatus(r.status) &&
                        r.status === "approved" && (
                          <>
                            <DropdownMenuItem
                              disabled={updating}
                              onSelect={() => openFailedDialog(r)}
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Mark failed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={updating}
                              onSelect={() => openForfeitDialog(r)}
                            >
                              <ShieldOff className="h-4 w-4 mr-2" />
                              Forfeit
                            </DropdownMenuItem>
                          </>
                        )}
                      {!isFinalStatus(r.status) &&
                        ["pending", "in_review"].includes(r.status) && (
                          <DropdownMenuItem
                            disabled={updating}
                            onSelect={() => void cancelRequest(r)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel / refund
                          </DropdownMenuItem>
                        )}
                      {!isFinalStatus(r.status) &&
                        r.status === "in_review" && (
                          <DropdownMenuItem
                            disabled={updating}
                            onSelect={() =>
                              void updateStatus(r.id, "pending")
                            }
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Back to pending
                          </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const runExportDownload = async () => {
    const selectedCols = WITHDRAWAL_EXPORT_COLUMN_IDS.filter(
      (id) => exportColumns[id],
    );
    const columns =
      selectedCols.length > 0
        ? selectedCols.join(",")
        : WITHDRAWAL_EXPORT_COLUMN_IDS.join(",");
    const params = new URLSearchParams({
      tab: selectedTab,
      sort: sortKey,
      order: sortOrder,
      columns,
      createdFrom: new Date(filterFromMs).toISOString(),
      createdTo: new Date(filterToMs).toISOString(),
    });
    try {
      const res = await fetch(
        `/api/admin/withdrawals/export?${params.toString()}`,
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `withdrawals-${selectedTab}-${
        new Date().toISOString().slice(0, 10)
      }.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV download started");
      setExportDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-4">
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:w-auto">
            <AdminDateRangePicker
              isDark={isDark}
              value={filterRange}
              presetLabel={filterPresetLabel}
              onChange={(next, label) => {
                setPage(1);
                setFilterRange(next);
                setFilterPresetLabel(label);
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setExportDialogOpen(true)}
            className={cn("w-full sm:w-auto", isDark && "border-gray-600")}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="mb-2 text-xs text-muted-foreground">
          Tip: tap/click any column header to sort.
        </div>

        <div className="overflow-x-auto pb-1">
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
                    {statusCountsFromApi?.all ?? 0}
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
                    {statusCountsFromApi?.pending ?? 0}
                  </Badge>
                </span>
              ),
            },
            {
              id: "approved",
              label: (
                <span>
                  Approved{" "}
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs"
                  >
                    {statusCountsFromApi?.approved ?? 0}
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
                    {statusCountsFromApi?.rejected ?? 0}
                  </Badge>
                </span>
              ),
            },
            {
              id: "paid",
              label: (
                <span>
                  Paid{" "}
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                    {statusCountsFromApi?.paid ?? 0}
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
                    {statusCountsFromApi?.forfeited ?? 0}
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
                    {statusCountsFromApi?.failed ?? 0}
                  </Badge>
                </span>
              ),
            },
            ]}
            activeTab={selectedTab}
            onTabChange={(id) => {
              setPage(1);
              setSelectedTab(id);
            }}
            className="mb-8 min-w-[760px]"
            isDark={isDark}
            light={!isDark}
          />
        </div>

        <div className="mt-4">
          {loading ? (
            <div
              className={cn(
                "rounded-xl border py-14 px-6",
                isDark
                  ? "bg-[#12042A] border-gray-700 text-gray-300"
                  : "bg-slate-50 border-slate-200 text-slate-600",
              )}
            >
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div
                  className={cn(
                    "mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full",
                    isDark ? "bg-violet-900/30" : "bg-violet-100",
                  )}
                >
                  <Loader2
                    className={cn(
                      "h-6 w-6 animate-spin",
                      isDark ? "text-violet-300" : "text-violet-600",
                    )}
                  />
                </div>
                <p
                  className={cn(
                    "text-base font-semibold",
                    isDark ? "text-white" : "text-slate-800",
                  )}
                >
                  Loading withdrawals
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fetching latest requests, filters, and totals...
                </p>
              </div>
            </div>
          ) : (
            <>
              {renderTable(requests)}
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

        <Dialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          isdark={isDark}
        >
          <DialogContent
            className={cn(
              "sm:max-w-lg max-h-[90vh] overflow-y-auto",
              isDark && "border-gray-600",
            )}
          >
            <DialogHeader>
              <DialogTitle
                className={cn(isDark ? "text-white" : "text-black")}
              >
                Export withdrawals (CSV)
              </DialogTitle>
              <DialogDescription>
                Uses the current status tab and date range above. Choose
                columns to include (empty selection exports all).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  isDark
                    ? "border-gray-600 bg-[#06021D]/80"
                    : "border-slate-200 bg-slate-50/80",
                )}
              >
                <p className="font-medium mb-2">Columns</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {WITHDRAWAL_EXPORT_COLUMN_IDS.map((id) => (
                    <label
                      key={id}
                      className="flex items-center gap-2 cursor-pointer text-xs"
                    >
                      <Checkbox
                        checked={exportColumns[id] !== false}
                        onCheckedChange={(checked) =>
                          setExportColumns((prev) => ({
                            ...prev,
                            [id]: checked === true,
                          }))
                        }
                      />
                      <span className="truncate">
                        {WITHDRAWAL_EXPORT_COLUMN_LABELS[id]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExportDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void runExportDownload()}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                  <CardContent className="pt-0 space-y-5">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Notes & transaction reference
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <Label
                            htmlFor="admin_notes"
                            className="text-xs font-medium"
                          >
                            Admin notes
                          </Label>
                          <Input
                            id="admin_notes"
                            value={adminNotes}
                            onChange={(e) => {
                              setAdminNotes(e.target.value);
                              setMetadataDirty(true);
                            }}
                            placeholder="Internal notes, campaign context…"
                            className={cn(
                              "w-full h-10 text-sm",
                              isDark
                                ? "bg-[#06021D] border border-gray-600 text-white"
                                : "bg-white text-black"
                            )}
                          />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <Label htmlFor="tx_ref" className="text-xs font-medium">
                            Transaction reference
                          </Label>
                          <Input
                            id="tx_ref"
                            value={txRef}
                            onChange={(e) => {
                              setTxRef(e.target.value);
                              setMetadataDirty(true);
                            }}
                            placeholder="UTR / TXID / reference #"
                            className={cn(
                              "w-full h-10 text-sm",
                              isDark
                                ? "bg-[#06021D] border border-gray-600 text-white"
                                : "bg-white text-black"
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator
                      className={isDark ? "bg-gray-600" : undefined}
                    />

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Payment proof
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {active.payment_proof_storage_path ? (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs font-normal gap-1",
                                isDark &&
                                  "bg-emerald-900/40 text-emerald-200 border-emerald-700",
                              )}
                            >
                              <FileImage className="h-3 w-3" />
                              File on record
                            </Badge>
                          ) : null}
                          {active.payment_proof_link ? (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs font-normal gap-1 max-w-[220px] truncate",
                                isDark &&
                                  "bg-sky-900/40 text-sky-200 border-sky-700",
                              )}
                              title={active.payment_proof_link}
                            >
                              <Link2 className="h-3 w-3 shrink-0" />
                              Link on record
                            </Badge>
                          ) : null}
                          {!active.payment_proof_storage_path &&
                          !active.payment_proof_link ? (
                            <span className="text-xs text-muted-foreground">
                              None attached yet
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        <Label
                          htmlFor="payment_proof_link"
                          className="text-xs font-medium"
                        >
                          Proof URL (optional)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="payment_proof_link"
                            value={paymentProofLinkDraft}
                            onChange={(e) => {
                              setPaymentProofLinkDraft(e.target.value);
                              setMetadataDirty(true);
                            }}
                            placeholder="https://…"
                            className={cn(
                              "w-full min-w-0 h-10 text-sm",
                              isDark
                                ? "bg-[#06021D] border border-gray-600 text-white"
                                : "bg-white text-black",
                              /^https?:\/\//i.test(
                                paymentProofLinkDraft.trim(),
                              )
                                ? "border-emerald-600/50 focus-visible:ring-emerald-600/30"
                                : null,
                            )}
                          />
                          {/^https?:\/\//i.test(
                            paymentProofLinkDraft.trim(),
                          ) ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 shrink-0"
                              title="Open URL in new tab"
                              onClick={() =>
                                window.open(
                                  paymentProofLinkDraft.trim(),
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              }
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <input
                        ref={proofFileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) =>
                          void onPaymentProofFile(e.target.files)
                        }
                      />

                      <div className="flex flex-col gap-3 pt-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className={cn(
                              "gap-2 shadow-sm",
                              isDark && "bg-violet-600 hover:bg-violet-500",
                            )}
                            disabled={
                              proofUploading || proofRemoving || !active
                            }
                            onClick={() => proofFileInputRef.current?.click()}
                          >
                            <Paperclip className="h-4 w-4" />
                            {proofUploading ? "Uploading…" : "Upload file"}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Max {PAYMENT_PROOF_MAX_BYTES / 1024 / 1024} MB
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {active.payment_proof_link ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() =>
                                window.open(
                                  active.payment_proof_link!,
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              }
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open saved link
                            </Button>
                          ) : null}
                          {active.payment_proof_storage_path ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() =>
                                void openProofInNewTab(active.id)
                              }
                            >
                              <FileImage className="h-3.5 w-3.5" />
                              View file
                            </Button>
                          ) : null}
                        </div>
                        {active.payment_proof_storage_path ? (
                          <div
                            className={cn(
                              "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                              isDark
                                ? "border-gray-600 bg-[#0a0524]/60"
                                : "border-slate-200 bg-slate-50/80",
                            )}
                          >
                            <span
                              className="font-mono truncate min-w-0 flex-1"
                              title={active.payment_proof_storage_path}
                            >
                              {active.payment_proof_storage_path
                                .split("/")
                                .pop()}
                            </span>
                            {active.payment_proof_file_size_bytes != null ? (
                              <span className="text-muted-foreground shrink-0 tabular-nums">
                                {formatProofFileSize(
                                  active.payment_proof_file_size_bytes,
                                )}
                              </span>
                            ) : null}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              disabled={proofRemoving || proofUploading}
                              title="Remove uploaded file"
                              onClick={() => void removePaymentProofFile()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        className={cn(
                          "w-full sm:w-auto min-w-[200px]",
                          isDark && "bg-violet-600 hover:bg-violet-500",
                        )}
                        disabled={savingMetadata || !metadataDirty}
                        onClick={() => void saveMetadata()}
                      >
                        {savingMetadata
                          ? "Saving…"
                          : "Save notes, UTR & proof link"}
                      </Button>
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
                                }, { closeDetails: true })
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
                              onClick={() =>
                                updateStatus(
                                  active!.id,
                                  "pending",
                                  undefined,
                                  { closeDetails: true },
                                )
                              }
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
                            }, { closeDetails: true })
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
