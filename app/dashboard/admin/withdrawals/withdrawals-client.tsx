"use client";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { subDays } from "date-fns";
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
  formatFeePercent,
  formatInrFromPaise,
  formatUsdInrRate,
  withdrawalPayout,
} from "@/lib/payout-fees";
import type {
  WithdrawalPayeeGroup,
  WithdrawalPayoutSeriesGranularity,
  WithdrawalPayoutSeriesPoint,
  WithdrawalsMethodFilter,
} from "@/lib/admin-withdrawals-list";
import { MISSING_PAYEE_LABEL } from "@/lib/admin-withdrawals-list";
import { PayoutHistoryChart } from "./payout-history-chart";
import { PayoutMethodSettingsCard } from "./payout-method-settings-card";
import { WithdrawalFeeRevenueSection } from "../WithdrawalFeeRevenueSection";
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
  ShieldOff,
  RotateCcw,
  MoreVertical,
  Copy,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Paperclip,
  ExternalLink,
  FileImage,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Users,
  Wand2,
  ClipboardPaste,
} from "lucide-react";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
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
  EXPORT_CURRENCY_OPTIONS,
  SKYDO_EXPORT_PRESET,
  WITHDRAWAL_EXPORT_COLUMN_IDS,
  WITHDRAWAL_EXPORT_COLUMN_LABELS,
  type WithdrawalExportColumnId,
} from "@/lib/withdrawal-export-columns";
import { toast } from "sonner";
import { readPayoutDetails } from "@/lib/skydo-payout-import";
import { PayoutRecordCard, type PayoutRecordInput } from "./payout-record-card";
import { SkydoPayoutDialog, type SkydoDialogScope } from "./skydo-payout-dialog";


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
  fee_bps?: number | null;
  fee_cents?: number | null;
  net_amount_cents?: number | null;
  payout_currency?: string | null;
  fx_rate_snapshot?: number | string | null;
  net_amount_local_minor?: number | null;
  /** Structured payout record (Skydo payout ID, UTR, amounts). See lib/skydo-payout-import. */
  payout_details?: unknown;
};

function initialsOf(name: string): string {
  const parts = name.replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** USD cents the payee should receive (after our processing fee). */
function sendCentsOf(r: Request): number {
  if (r.amount_type !== "cash") return 0;
  return r.net_amount_cents ?? r.amount;
}

function skydoEmailOf(r: Request): string {
  const d = (r.payout_method_details_snapshot || {}) as { email?: unknown };
  return typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
}

/** "Send ₹8,100.00 · fee $10.00 (10%)" for requests with a fee or an INR payout. */
function PayoutSendLine({ request, className }: { request: Request; className?: string }) {
  if (request.amount_type !== "cash") return null;
  const p = withdrawalPayout(request);
  if (p.feeCents <= 0 && p.currency === "USD") return null;
  return (
    <div className={cn("text-xs text-muted-foreground", className)}>
      Send <span className="font-semibold text-foreground">{p.receiveLabel}</span>
      {p.feeCents > 0 && ` · fee ${formatCurrencyFromCents(p.feeCents)} (${formatFeePercent(p.feeBps)})`}
    </div>
  );
}

type PayeeGroup = Omit<WithdrawalPayeeGroup, "requests"> & {
  requests: Request[];
};

const DEFAULT_PAGE_SIZE = 25;

const EXPORT_PREFS_STORAGE_KEY = "admin-withdrawals-export-prefs-v1";

const TAB_LABELS: Record<string, string> = {
  all: "All statuses",
  pending: "Pending",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  forfeited: "Forfeited",
  failed: "Failed",
};

const METHOD_FILTER_OPTIONS: { value: WithdrawalsMethodFilter; label: string }[] =
  [
    { value: "all", label: "All methods" },
    { value: "skydo", label: "Skydo" },
    { value: "upi", label: "UPI" },
    { value: "bank_transfer", label: "Bank transfer" },
    { value: "crypto", label: "Crypto" },
    { value: "phantom", label: "Phantom" },
  ];

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
    in_review: number;
    approved: number;
    paid: number;
    rejected: number;
    forfeited: number;
    failed: number;
  } | null>(null);
  /** Processing fees inside each status total; null until the API returns them. */
  const [feesFromApi, setFeesFromApi] = useState<Record<string, number> | null>(null);
  const [statusCountsFromApi, setStatusCountsFromApi] = useState<{
    all: number;
    pending: number;
    in_review: number;
    approved: number;
    paid: number;
    rejected: number;
    forfeited: number;
    failed: number;
  } | null>(null);
  const [payoutSeries, setPayoutSeries] = useState<WithdrawalPayoutSeriesPoint[]>(
    [],
  );
  const [payoutSeriesGranularity, setPayoutSeriesGranularity] =
    useState<WithdrawalPayoutSeriesGranularity>("day");
  const [payoutSeriesLoading, setPayoutSeriesLoading] = useState(true);
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
  const [exportOrder, setExportOrder] = useState<WithdrawalExportColumnId[]>(
    () => [...WITHDRAWAL_EXPORT_COLUMN_IDS],
  );
  const [exportHeaders, setExportHeaders] = useState<Record<string, string>>(
    () => ({ ...WITHDRAWAL_EXPORT_COLUMN_LABELS }),
  );
  const [exportCurrency, setExportCurrency] = useState<string>("USD");
  const [exportRate, setExportRate] = useState<string>("");
  const [exportGroupByPayee, setExportGroupByPayee] = useState(false);
  const [exportPrefsLoaded, setExportPrefsLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [paymentProofLinkDraft, setPaymentProofLinkDraft] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [proofRemoving, setProofRemoving] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [metadataDirty, setMetadataDirty] = useState(false);
  const [metadataSaveMsg, setMetadataSaveMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [methodFilter, setMethodFilter] =
    useState<WithdrawalsMethodFilter>("all");
  const [groupByPayee, setGroupByPayee] = useState(false);
  const [payeeGroups, setPayeeGroups] = useState<PayeeGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [skydoDialogOpen, setSkydoDialogOpen] = useState(false);
  const [skydoScope, setSkydoScope] = useState<SkydoDialogScope | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement>(null);
  const metadataSaveMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  /** Prefer top toasts while the details modal is open so they don't cover footer actions. */
  const notify = useCallback(
    (
      type: "success" | "error",
      message: string,
      opts?: { duration?: number },
    ) => {
      const position = detailsOpen ? "top-center" : undefined;
      if (type === "success") {
        toast.success(message, { position, duration: opts?.duration ?? 2500 });
      } else {
        toast.error(message, { position, duration: opts?.duration });
      }
    },
    [detailsOpen],
  );

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
    const pending = sumCash(requests.filter((r) => r.status === "pending"));
    const in_review = sumCash(
      requests.filter((r) => r.status === "in_review"),
    );
    const approved = sumCash(requests.filter((r) => r.status === "approved"));
    const paid = sumCash(requests.filter((r) => r.status === "processed"));
    const rejected = sumCash(
      requests.filter((r) => r.status === "rejected" || r.status === "cancelled")
    );
    const forfeited = sumCash(requests.filter((r) => r.status === "forfeited"));
    const failed = sumCash(requests.filter((r) => r.status === "failed"));
    return {
      all,
      pending,
      in_review,
      approved,
      paid,
      rejected,
      forfeited,
      failed,
    };
  }, [requests, totalsFromApi]);

  const filterFromMs = filterRange.from.getTime();
  const filterToMs = filterRange.to.getTime();
  const payoutSeriesRangeKeyRef = useRef<string | null>(null);
  const forcePayoutSeriesRefreshRef = useRef(false);

  const reloadWithdrawals = useCallback(async (opts?: {
    refreshPayoutSeries?: boolean;
  }) => {
    const rangeKey = `${filterFromMs}:${filterToMs}`;
    const rangeChanged = payoutSeriesRangeKeyRef.current !== rangeKey;
    const includePayoutSeries =
      rangeChanged ||
      opts?.refreshPayoutSeries === true ||
      forcePayoutSeriesRefreshRef.current;
    forcePayoutSeriesRefreshRef.current = false;

    if (includePayoutSeries) {
      setPayoutSeriesLoading(true);
    }
    setLoading(true);
    let keepLoadingForPageClamp = false;
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        tab: selectedTab,
        sort: sortKey,
        order: sortOrder,
        createdFrom: new Date(filterFromMs).toISOString(),
        createdTo: new Date(filterToMs).toISOString(),
        includePayoutSeries: includePayoutSeries ? "1" : "0",
        method: methodFilter,
      });
      const res = await fetch(
        `/api/admin/withdrawals${groupByPayee ? "/grouped" : ""}?${params}`,
      );
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
        setPayeeGroups([]);
        setTotalCount(0);
        if (includePayoutSeries && rangeChanged) {
          setPayoutSeries([]);
          setPayoutSeriesGranularity("day");
        }
        return;
      }
      const json = await res.json();
      const nextTotal = (groupByPayee ? json.totalGroups : json.total) ?? 0;
      const totalPages = Math.max(1, Math.ceil(nextTotal / pageSize) || 1);

      setTotalCount(nextTotal);
      setTotalsFromApi(json.totals ?? null);
      setFeesFromApi(json.fees ?? null);
      setStatusCountsFromApi(json.statusCounts ?? null);

      if (json.payoutSeriesIncluded && Array.isArray(json.payoutSeries)) {
        setPayoutSeries(json.payoutSeries);
        setPayoutSeriesGranularity(
          json.payoutSeriesGranularity === "week" ||
            json.payoutSeriesGranularity === "month" ||
            json.payoutSeriesGranularity === "day"
            ? (json.payoutSeriesGranularity as WithdrawalPayoutSeriesGranularity)
            : "day",
        );
        payoutSeriesRangeKeyRef.current = rangeKey;
      }

      if (page > totalPages) {
        setRequests([]);
        setPayeeGroups([]);
        keepLoadingForPageClamp = true;
        setPage(totalPages);
        return;
      }

      if (groupByPayee) {
        const groups = (json.groups ?? []) as PayeeGroup[];
        setPayeeGroups(groups);
        setRequests(groups.flatMap((g) => g.requests));
      } else {
        setPayeeGroups([]);
        setRequests(json.data ?? []);
      }
    } catch (e) {
      console.error("Fetch withdrawals error", e);
      setRequests([]);
      setPayeeGroups([]);
      setTotalCount(0);
      if (includePayoutSeries && rangeChanged) {
        setPayoutSeries([]);
        setPayoutSeriesGranularity("day");
      }
    } finally {
      if (!keepLoadingForPageClamp) {
        setLoading(false);
      }
      if (includePayoutSeries) {
        setPayoutSeriesLoading(false);
      }
    }
  }, [
    page,
    pageSize,
    selectedTab,
    sortKey,
    sortOrder,
    filterFromMs,
    filterToMs,
    methodFilter,
    groupByPayee,
  ]);

  useEffect(() => {
    void reloadWithdrawals();
  }, [reloadWithdrawals]);

  // Clear row selection when the list context changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    selectedTab,
    page,
    pageSize,
    filterFromMs,
    filterToMs,
    sortKey,
    sortOrder,
    methodFilter,
    groupByPayee,
  ]);

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [selectedTab, page, pageSize, filterFromMs, filterToMs, methodFilter, groupByPayee]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(EXPORT_PREFS_STORAGE_KEY);
      if (raw) {
        const prefs = JSON.parse(raw) as Partial<{
          columns: Record<string, boolean>;
          order: string[];
          headers: Record<string, string>;
          currency: string;
          rate: string;
          groupByPayee: boolean;
        }>;
        const known = new Set<string>(WITHDRAWAL_EXPORT_COLUMN_IDS);
        if (prefs.columns) {
          setExportColumns((prev) => ({ ...prev, ...prefs.columns }));
        }
        if (Array.isArray(prefs.order)) {
          const saved = prefs.order.filter((id): id is WithdrawalExportColumnId =>
            known.has(id),
          );
          setExportOrder([
            ...saved,
            ...WITHDRAWAL_EXPORT_COLUMN_IDS.filter((id) => !saved.includes(id)),
          ]);
        }
        if (prefs.headers) {
          setExportHeaders((prev) => ({ ...prev, ...prefs.headers }));
        }
        if (typeof prefs.currency === "string") setExportCurrency(prefs.currency);
        if (typeof prefs.rate === "string") setExportRate(prefs.rate);
        if (typeof prefs.groupByPayee === "boolean") {
          setExportGroupByPayee(prefs.groupByPayee);
        }
      }
    } catch {
      /* ignore corrupt prefs */
    }
    setExportPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!exportPrefsLoaded) return;
    try {
      window.localStorage.setItem(
        EXPORT_PREFS_STORAGE_KEY,
        JSON.stringify({
          columns: exportColumns,
          order: exportOrder,
          headers: exportHeaders,
          currency: exportCurrency,
          rate: exportRate,
          groupByPayee: exportGroupByPayee,
        }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [
    exportPrefsLoaded,
    exportColumns,
    exportOrder,
    exportHeaders,
    exportCurrency,
    exportRate,
    exportGroupByPayee,
  ]);

  useEffect(() => {
    return () => {
      if (metadataSaveMsgTimer.current) {
        clearTimeout(metadataSaveMsgTimer.current);
      }
    };
  }, []);

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

  const PAYOUT_METHOD_LABELS: Record<string, string> = {
    crypto: "Crypto",
    upi: "UPI",
    bank_transfer: "Bank transfer",
    phantom: "Phantom",
    skydo: "Skydo",
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
      const body: Record<string, string> = { status: newStatus };
      if (typeof extras?.transaction_reference === "string") {
        body.transaction_reference = extras.transaction_reference;
      }
      if (typeof extras?.admin_notes === "string") {
        body.admin_notes = extras.admin_notes;
      }
      if (typeof extras?.in_review_reason === "string") {
        body.in_review_reason = extras.in_review_reason;
      }
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setActive((prev) =>
        prev && prev.id === id
          ? {
            ...prev,
            status: newStatus,
            transaction_reference:
              extras?.transaction_reference ?? prev.transaction_reference,
            admin_notes: extras?.admin_notes ?? prev.admin_notes,
            processed_at:
              newStatus === "processed"
                ? new Date().toISOString()
                : prev.processed_at,
          }
          : prev,
      );
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (opts?.closeDetails) {
        setDetailsOpen(false);
      }

      toast.success(
        `Status updated to ${newStatus.replace(/_/g, " ")}`,
      );
      void reloadWithdrawals({
        refreshPayoutSeries: newStatus === "processed",
      });
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
      setSelectedIds((prev) => {
        if (!prev.has(req.id)) return prev;
        const next = new Set(prev);
        next.delete(req.id);
        return next;
      });
      toast.success("Withdrawal request cancelled successfully");
      void reloadWithdrawals();
    } catch (e) {
      console.error("Failed to cancel request", e);
      alert(
        `Failed to cancel request: ${e instanceof Error ? e.message : "Unknown error"
        }`
      );
    } finally {
      setUpdating(false);
    }
  };

  const flashMetadataSaved = (message: string) => {
    setMetadataSaveMsg(message);
    if (metadataSaveMsgTimer.current) {
      clearTimeout(metadataSaveMsgTimer.current);
    }
    metadataSaveMsgTimer.current = setTimeout(() => {
      setMetadataSaveMsg(null);
      metadataSaveMsgTimer.current = null;
    }, 3000);
  };

  const openDetails = (req: Request) => {
    setActive(req);
    setAdminNotes(req.admin_notes || "");
    setTxRef(req.transaction_reference || "");
    setPaymentProofLinkDraft(req.payment_proof_link || "");
    setMetadataDirty(false);
    setMetadataSaveMsg(null);
    setDetailsOpen(true);
  };

  const saveMetadata = async (opts?: { silent?: boolean }): Promise<boolean> => {
    if (!active) return false;
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
      const withSavedMetadata = <T extends Request>(r: T): T =>
        r.id === active.id
          ? {
            ...r,
            admin_notes: adminNotes,
            transaction_reference: txRef,
            payment_proof_link: nextLink,
          }
          : r;
      setRequests((prev) => prev.map(withSavedMetadata));
      // Grouped view renders from payeeGroups; keep it in sync so reopening
      // a request doesn't show (and later re-save) the old values.
      setPayeeGroups((prev) =>
        prev.map((g) => ({ ...g, requests: g.requests.map(withSavedMetadata) })),
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
      if (!opts?.silent) {
        flashMetadataSaved("Saved successfully");
        notify("success", "Notes, UTR & proof link saved");
      }
      return true;
    } catch (e) {
      console.error(e);
      notify(
        "error",
        e instanceof Error ? e.message : "Could not save metadata",
      );
      return false;
    } finally {
      setSavingMetadata(false);
    }
  };

  const applyStatusFromDetails = async (
    newStatus: string,
    extras?: {
      transaction_reference?: string;
      admin_notes?: string;
    },
  ) => {
    if (!active) return;
    if (metadataDirty) {
      const saved = await saveMetadata({ silent: true });
      if (!saved) return;
    }
    await updateStatus(active.id, newStatus, extras, { closeDetails: true });
  };

  /** Save the payout record card (one request, never changes status). */
  const savePayoutRecord = async (input: PayoutRecordInput): Promise<boolean> => {
    if (!active) return false;
    const prevDetails = readPayoutDetails(active.payout_details);
    try {
      const res = await fetch("/api/admin/withdrawals/skydo-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          ids: [active.id],
          markPaid: false,
          details: {
            ...input,
            status: prevDetails?.status ?? (input.utr.trim() ? "Completed" : "In progress"),
            payee_name: prevDetails?.payee_name ?? undefined,
            group_request_count: prevDetails?.group_request_count ?? 1,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || json.failedItems?.[0]?.error || "Could not save");
      }
      const details = json.details;
      const txRefNext = input.payout_id.trim() || active.transaction_reference || "";
      const patch = <T extends Request>(r: T): T =>
        r.id === active.id
          ? { ...r, payout_details: details, transaction_reference: txRefNext }
          : r;
      setRequests((prev) => prev.map(patch));
      setPayeeGroups((prev) =>
        prev.map((g) => ({ ...g, requests: g.requests.map(patch) })),
      );
      setActive((prev) => (prev ? patch(prev) : prev));
      if (!metadataDirty) setTxRef(txRefNext);
      notify("success", "Payout record saved");
      return true;
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Could not save payout record");
      return false;
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
      notify("error", "Could not open payment proof file");
    }
  };

  const onPaymentProofFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !active) return;
    if (file.size > PAYMENT_PROOF_MAX_BYTES) {
      notify(
        "error",
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
        notify(
          "error",
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
      notify("success", "Payment proof file uploaded");
      void reloadWithdrawals();
    } catch (e) {
      console.error(e);
      notify("error", e instanceof Error ? e.message : "Upload failed");
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
      notify("success", "Payment proof file removed");
      void reloadWithdrawals();
    } catch (e) {
      console.error(e);
      notify(
        "error",
        e instanceof Error ? e.message : "Could not remove file",
      );
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
    if (type === "skydo") return `Skydo: ${d?.email || ""}`;
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
      return `Phantom${friendlyName ? ` (${friendlyName})` : ""
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
    if (type === "skydo" && d?.email) {
      return [{ label: "Skydo email", value: String(d.email) }];
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

  /** Destination fields for the details modal, with what to copy. */
  const getPayToRows = (
    r: Request,
  ): { label: string; value: string; copy?: string; mono?: boolean; wide?: boolean }[] => {
    const type = (r.payout_method_type_snapshot || "").toLowerCase();
    const d: any = r.payout_method_details_snapshot || {};
    const rows: { label: string; value: string; copy?: string; mono?: boolean; wide?: boolean }[] = [];
    const add = (label: string, v: unknown, opts?: { copy?: boolean; mono?: boolean; wide?: boolean; display?: string }) => {
      if (v === null || v === undefined || String(v).trim() === "") return;
      rows.push({
        label,
        value: opts?.display ?? String(v),
        copy: opts?.copy ? String(v) : undefined,
        mono: opts?.mono,
        wide: opts?.wide,
      });
    };
    if (type === "skydo") {
      add("Skydo email", d?.email, { copy: true, wide: true });
    } else if (type === "upi") {
      add("UPI ID", d?.upi_id, { copy: true });
      add("Account holder", d?.account_holder_name, { copy: true });
    } else if (type === "bank_transfer") {
      add("Account holder", d?.account_holder_name, { copy: true });
      add("Account number", d?.account_number, {
        copy: true,
        mono: true,
        display: d?.account_number ? `•••• ${String(d.account_number).slice(-4)}` : undefined,
      });
      add("IFSC / SWIFT", d?.ifsc_code || d?.swift_bic_code, { copy: true, mono: true });
      add("Bank", d?.bank_name);
      add("Branch", d?.branch_name);
      add("Country", d?.country);
    } else if (type === "crypto") {
      add("Network", d?.network);
      add("Currency", d?.currency);
      add("Wallet address", d?.wallet_address, { copy: true, mono: true, wide: true });
    } else if (type === "phantom") {
      add("Friendly name", d?.friendly_name);
      add("Token", d?.preferred_token || "USDC");
      add(
        "Network",
        d?.network ||
          (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ||
          process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet"
            ? "mainnet"
            : "devnet"),
      );
      add("Wallet address", d?.wallet_address, { copy: true, mono: true, wide: true });
    } else if (type) {
      add("Details", formatPayoutSummary(r), { mono: true, wide: true });
    }
    return rows;
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


  const FINAL_STATUSES = ["processed", "forfeited", "cancelled", "rejected"];
  const isFinalStatus = (s: string) => FINAL_STATUSES.includes(s);
  const isApprovableStatus = (s: string) =>
    s === "pending" || s === "in_review";
  /** Approved rows are selectable too, for Fill details & mark paid. */
  const isSelectableStatus = (s: string) =>
    isApprovableStatus(s) || s === "approved";

  const approvableOnPage = useMemo(
    () => requests.filter((r) => isApprovableStatus(r.status)),
    [requests],
  );
  const allApprovableSelected =
    approvableOnPage.length > 0 &&
    approvableOnPage.every((r) => selectedIds.has(r.id));
  const someApprovableSelected = approvableOnPage.some((r) =>
    selectedIds.has(r.id),
  );

  const toggleSelectId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllApprovable = (
    checked: boolean,
    scope: Request[] = approvableOnPage,
  ) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of scope) {
        if (checked) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  };

  const selectedApproved = useMemo(
    () => requests.filter((r) => r.status === "approved" && selectedIds.has(r.id)),
    [requests, selectedIds],
  );

  const openSkydoImport = () => {
    setSkydoScope({
      kind: "filters",
      createdFrom: new Date(filterFromMs).toISOString(),
      createdTo: new Date(filterToMs).toISOString(),
      label: filterPresetLabel || "Selected dates",
    });
    setSkydoDialogOpen(true);
  };

  const openFillDetails = () => {
    if (selectedApproved.length === 0) return;
    setSkydoScope({
      kind: "selection",
      ids: selectedApproved.map((r) => r.id),
      sendCents: selectedApproved.reduce((sum, r) => sum + sendCentsOf(r), 0),
      payeeCount: new Set(
        selectedApproved.map((r) => skydoEmailOf(r) || formatPayoutSummary(r)),
      ).size,
    });
    setSkydoDialogOpen(true);
  };

  const onSkydoApplied = (paidIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of paidIds) next.delete(id);
      return next;
    });
    void reloadWithdrawals({ refreshPayoutSeries: true });
  };

  const bulkApproveSelected = async () => {
    const ids = approvableOnPage
      .filter((r) => selectedIds.has(r.id))
      .map((r) => r.id);
    if (ids.length === 0) {
      toast.error("Select at least one pending request to approve");
      return;
    }
    if (
      !confirm(
        `Approve ${ids.length} withdrawal request${ids.length === 1 ? "" : "s"}? They will move to Approved status.`,
      )
    ) {
      return;
    }
    setBulkApproving(true);
    try {
      // One request; server processes with limited concurrency (safe up to 200).
      const res = await fetch("/api/admin/withdrawals/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: "approved" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        succeeded?: number;
        failed?: number;
        skipped?: number;
      };
      if (!res.ok) {
        throw new Error(json.error || "Bulk approve failed");
      }

      const succeeded = json.succeeded ?? 0;
      const failed = json.failed ?? 0;
      const skipped = json.skipped ?? 0;
      setSelectedIds(new Set());

      if (succeeded > 0) {
        toast.success(
          `Approved ${succeeded} request${succeeded === 1 ? "" : "s"}`,
        );
      }
      if (failed > 0) {
        toast.error(`${failed} approval${failed === 1 ? "" : "s"} failed`);
      }
      if (skipped > 0) {
        toast.error(
          `${skipped} request${skipped === 1 ? " was" : "s were"} not pending/in review`,
        );
      }
      void reloadWithdrawals();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Bulk approve failed",
      );
    } finally {
      setBulkApproving(false);
    }
  };

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
    className,
  }: {
    colKey: WithdrawalsSortKey;
    label: string;
    icon?: ReactNode;
    className?: string;
  }) => {
    const active = sortKey === colKey;
    return (
      <TableHead
        className={cn(
          "cursor-pointer select-none px-2 sm:px-4",
          isDark ? "hover:bg-white/10" : "hover:bg-slate-100",
          className,
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

  const renderTable = (rows: Request[]) => {
    const scopeApprovable = rows.filter((r) => isSelectableStatus(r.status));
    const scopeAllSelected =
      scopeApprovable.length > 0 &&
      scopeApprovable.every((r) => selectedIds.has(r.id));
    const scopeSomeSelected = scopeApprovable.some((r) =>
      selectedIds.has(r.id),
    );
    return (
    <div
      className={cn(
        "rounded-xl shadow",
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
            <TableHead className="w-10 pr-0 px-2 sm:px-4">
              <Checkbox
                checked={
                  scopeSomeSelected && !scopeAllSelected
                    ? "indeterminate"
                    : scopeAllSelected
                }
                onCheckedChange={(v) =>
                  toggleSelectAllApprovable(v === true, scopeApprovable)
                }
                disabled={loading || scopeApprovable.length === 0 || bulkApproving}
                aria-label="Select all on this page"
                className={cn(isDark && "border-white/60")}
              />
            </TableHead>
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
            <TableHead className="px-2 sm:px-4">Status</TableHead>
            <TableHead className="px-2 sm:px-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment method
              </div>
            </TableHead>
            <TableHead className="w-12 text-right px-2 sm:px-4"> </TableHead>
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
                <TableCell className="w-10 pr-0 align-middle px-2 sm:px-4">
                  <Checkbox
                    checked={selectedIds.has(r.id)}
                    onCheckedChange={(v) =>
                      toggleSelectId(r.id, v === true)
                    }
                    disabled={!isSelectableStatus(r.status) || bulkApproving}
                    aria-label={`Select withdrawal for ${r.users?.full_name || r.id}`}
                    className={cn(isDark && "border-white/60")}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap px-2 sm:px-4">
                  <div className="text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleTimeString()}
                  </div>
                </TableCell>
                <TableCell className="max-w-[160px] px-2 sm:px-4">
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
                  <PayoutSendLine request={r} />
                  <div className="text-xs text-muted-foreground capitalize">
                    {r.amount_type}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {getStatusBadge(r.status)}
                  {(() => {
                    const rec = readPayoutDetails(r.payout_details);
                    if (!rec?.utr && !rec?.payout_id) return null;
                    const value = rec.utr ?? rec.payout_id!;
                    return (
                      <button
                        type="button"
                        className="mt-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                        title={`Copy ${rec.utr ? "UTR" : "payout ID"}`}
                        onClick={() => void copyText(value, rec.utr ? "UTR" : "Payout ID")}
                      >
                        {rec.utr ? "UTR " : ""}
                        {value}
                        <Copy className="h-3 w-3 opacity-60" />
                      </button>
                    );
                  })()}
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

                            if (type === "skydo") {
                              return (
                                <div className="space-y-1">
                                  <div>
                                    <strong>Skydo Email:</strong>{" "}
                                    {d?.email || "N/A"}
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
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderGroupedTable = (groups: PayeeGroup[]) => {
    const pageSelectable = groups.flatMap((g) =>
      g.requests.filter((r) => isSelectableStatus(r.status)),
    );
    const pageAll =
      pageSelectable.length > 0 && pageSelectable.every((r) => selectedIds.has(r.id));
    const pageSome = pageSelectable.some((r) => selectedIds.has(r.id));
    return (
    <div
      className={cn(
        "rounded-xl shadow",
        isDark ? "bg-[#170337]" : "bg-white  border border-gray-200",
      )}
    >
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow
            className={cn(
              "text-left border-b",
              isDark
                ? "bg-[#391A6A] text-white"
                : "bg-[#F9FAFB] border-b border-slate-200 text-gray-500",
            )}
          >
            <TableHead className="w-16 px-2 sm:px-4">
              <Checkbox
                checked={pageSome && !pageAll ? "indeterminate" : pageAll}
                onCheckedChange={(v) => toggleSelectAllApprovable(v === true, pageSelectable)}
                disabled={loading || pageSelectable.length === 0 || bulkApproving}
                aria-label="Select every request in these groups"
                className={cn(isDark && "border-white/60")}
              />
            </TableHead>
            <TableHead className="px-2 sm:px-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payout method
              </div>
            </TableHead>
            <TableHead className="px-2 sm:px-4">Payee</TableHead>
            <TableHead className="px-2 sm:px-4">Requests</TableHead>
            <TableHead className="px-2 sm:px-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usernames
              </div>
            </TableHead>
            <TableHead className="px-2 sm:px-4">Statuses</TableHead>
            <TableHead className="px-2 sm:px-4 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-10 text-center text-muted-foreground"
              >
                No withdrawal requests match these filters.
              </TableCell>
            </TableRow>
          )}
          {groups.map((g) => {
            const expanded = expandedGroups.has(g.key);
            const missing = g.destination === MISSING_PAYEE_LABEL;
            const groupSelectable = g.requests.filter((r) => isSelectableStatus(r.status));
            const groupAll =
              groupSelectable.length > 0 &&
              groupSelectable.every((r) => selectedIds.has(r.id));
            const groupSome = groupSelectable.some((r) => selectedIds.has(r.id));
            return (
              <Fragment key={g.key}>
                <TableRow
                  className={cn(
                    "cursor-pointer hover:bg-muted/30 transition-colors",
                    groupSome && (isDark ? "bg-violet-500/[0.06]" : "bg-violet-50/60"),
                  )}
                  onClick={() => toggleGroupExpanded(g.key)}
                >
                  <TableCell className="w-16 px-2 sm:px-4">
                    <div className="flex items-center gap-2">
                      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                        <Checkbox
                          checked={groupSome && !groupAll ? "indeterminate" : groupAll}
                          onCheckedChange={(v) =>
                            toggleSelectAllApprovable(v === true, groupSelectable)
                          }
                          disabled={groupSelectable.length === 0 || bulkApproving}
                          aria-label={`Select all requests for ${g.destination}`}
                          className={cn(isDark && "border-white/60")}
                        />
                      </span>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-2 sm:px-4 whitespace-nowrap">
                    {PAYOUT_METHOD_LABELS[g.method] || g.method}
                  </TableCell>
                  <TableCell className="px-2 sm:px-4 max-w-[280px]">
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          "text-sm truncate",
                          missing && "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {g.destination}
                      </span>
                      {!missing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyText(g.destination, "Payee");
                          }}
                          aria-label="Copy payee"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-2 sm:px-4">
                    <Badge variant="secondary">{g.count}</Badge>
                  </TableCell>
                  <TableCell className="px-2 sm:px-4 max-w-[320px]">
                    <div className="flex flex-wrap gap-1">
                      {g.usernames.slice(0, 6).map((u) => (
                        <Badge
                          key={u}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          @{u}
                        </Badge>
                      ))}
                      {g.usernames.length > 6 && (
                        <span className="text-xs text-muted-foreground">
                          +{g.usernames.length - 6} more
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-2 sm:px-4">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(g.statuses).map(([s, n]) => (
                        <span key={s} className="inline-flex items-center gap-1">
                          {getStatusBadge(s)}
                          {n > 1 && (
                            <span className="text-xs text-muted-foreground">
                              x{n}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="px-2 sm:px-4 text-right whitespace-nowrap">
                    <div className="text-lg font-semibold">
                      {g.amountType === "cash"
                        ? formatCurrencyFromCents(g.totalCents)
                        : `${g.totalCents} coins`}
                    </div>
                    {g.amountType === "cash" && (g.feeCents > 0 || g.netLocalMinor !== null) && (
                      <div className="text-xs text-muted-foreground">
                        Send{" "}
                        <span className="font-semibold text-foreground">
                          {g.netLocalMinor !== null
                            ? formatInrFromPaise(g.netLocalMinor)
                            : formatCurrencyFromCents(g.netCents)}
                        </span>
                        {g.feeCents > 0 && ` · fees ${formatCurrencyFromCents(g.feeCents)}`}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {g.currency} · {g.amountType}
                    </div>
                  </TableCell>
                </TableRow>
                {expanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className={cn(
                        "p-3",
                        isDark ? "bg-[#0d0222]" : "bg-slate-50",
                      )}
                    >
                      {renderTable(g.requests)}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
    );
  };

  const exportRateNumber = Number(exportRate);
  const exportRateValid =
    exportCurrency === "USD" ||
    (Number.isFinite(exportRateNumber) && exportRateNumber > 0);

  const applySkydoPreset = () => {
    const presetIds = SKYDO_EXPORT_PRESET.map((c) => c.id);
    setExportColumns(
      Object.fromEntries(
        WITHDRAWAL_EXPORT_COLUMN_IDS.map(
          (id) => [id, presetIds.includes(id)] as const,
        ),
      ),
    );
    setExportOrder([
      ...presetIds,
      ...WITHDRAWAL_EXPORT_COLUMN_IDS.filter((id) => !presetIds.includes(id)),
    ]);
    setExportHeaders((prev) => ({
      ...prev,
      ...Object.fromEntries(SKYDO_EXPORT_PRESET.map((c) => [c.id, c.header])),
    }));
    setExportGroupByPayee(true);
    if (methodFilter !== "skydo") {
      setPage(1);
      setMethodFilter("skydo");
    }
    // Only approved requests are ready to pay; other tabs would add paid or
    // rejected amounts to the payout.
    if (selectedTab !== "approved") {
      setPage(1);
      setSelectedTab("approved");
    }
  };

  const resetExportColumns = () => {
    setExportColumns(
      Object.fromEntries(
        WITHDRAWAL_EXPORT_COLUMN_IDS.map((id) => [id, true] as const),
      ),
    );
    setExportOrder([...WITHDRAWAL_EXPORT_COLUMN_IDS]);
    setExportHeaders({ ...WITHDRAWAL_EXPORT_COLUMN_LABELS });
  };

  const moveExportColumn = (id: WithdrawalExportColumnId, delta: -1 | 1) => {
    setExportOrder((prev) => {
      const selected = prev.filter((c) => exportColumns[c] !== false);
      const idx = selected.indexOf(id);
      const swapWith = selected[idx + delta];
      if (idx < 0 || !swapWith) return prev;
      const next = [...prev];
      const a = next.indexOf(id);
      const b = next.indexOf(swapWith);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  const runExportDownload = async () => {
    if (!exportRateValid) {
      toast.error(`Enter a conversion rate for ${exportCurrency}`);
      return;
    }
    const selectedCols = exportOrder.filter((id) => exportColumns[id] !== false);
    const cols = selectedCols.length > 0 ? selectedCols : exportOrder;
    setExporting(true);
    try {
      const res = await fetch("/api/admin/withdrawals/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: selectedTab,
          method: methodFilter,
          sort: sortKey,
          order: sortOrder,
          createdFrom: new Date(filterFromMs).toISOString(),
          createdTo: new Date(filterToMs).toISOString(),
          columns: cols.map((id) => ({
            id,
            header:
              exportHeaders[id]?.trim() || WITHDRAWAL_EXPORT_COLUMN_LABELS[id],
          })),
          currency: {
            code: exportCurrency,
            rate: exportCurrency === "USD" ? 1 : exportRateNumber,
          },
          groupByPayee: exportGroupByPayee,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `withdrawals-${selectedTab}${methodFilter !== "all" ? `-${methodFilter}` : ""
        }${exportGroupByPayee ? "-grouped" : ""}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV download started");
      setExportDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  /** "Sent $90.00 after $10.00 fees" when the bucket includes processing fees. */
  const afterFees = (key: string, verb: string, fallback: string) => {
    const fee = feesFromApi?.[key] ?? 0;
    const amount = (totals as Record<string, number>)[key] ?? 0;
    return fee > 0
      ? `${verb} ${formatCurrencyFromCents(amount - fee)} after ${formatCurrencyFromCents(fee)} fees`
      : fallback;
  };

  const statusSummaryCards: {
    key: string;
    label: string;
    amount: number;
    description: string;
    accent: string;
    muteWhenZero?: boolean;
  }[] = [
      {
        key: "pending",
        label: "Pending",
        amount: totals.pending,
        description: afterFees("pending", "To send", "New requests"),
        accent: isDark ? "bg-amber-400" : "bg-amber-500",
      },
      {
        key: "approved",
        label: "Approved",
        amount: totals.approved,
        description: afterFees("approved", "To send", "Approved for payment"),
        accent: isDark ? "bg-blue-400" : "bg-blue-500",
      },
      {
        key: "paid",
        label: "Paid",
        amount: totals.paid,
        description: afterFees("paid", "Sent", "Successfully processed"),
        accent: isDark ? "bg-emerald-400" : "bg-emerald-500",
      },
      {
        key: "rejected",
        label: "Rejected",
        amount: totals.rejected,
        description: "Rejected or cancelled (refund)",
        accent: isDark ? "bg-red-400" : "bg-red-500",
      },
      {
        key: "forfeited",
        label: "Forfeited",
        amount: totals.forfeited,
        description: "No refund (e.g. violation)",
        accent: isDark ? "bg-slate-500" : "bg-slate-400",
        muteWhenZero: true,
      },
      {
        key: "failed",
        label: "Failed",
        amount: totals.failed,
        description: "Payment failed (internal)",
        accent: isDark ? "bg-slate-500" : "bg-slate-400",
        muteWhenZero: true,
      },
    ];

  const tabDotClass: Record<string, string> = {
    all: isDark ? "bg-slate-400" : "bg-slate-500",
    pending: isDark ? "bg-amber-400" : "bg-amber-500",
    in_review: isDark ? "bg-indigo-400" : "bg-indigo-500",
    approved: isDark ? "bg-blue-400" : "bg-blue-500",
    paid: isDark ? "bg-emerald-400" : "bg-emerald-500",
    rejected: isDark ? "bg-red-400" : "bg-red-500",
    forfeited: isDark ? "bg-slate-500" : "bg-slate-400",
    failed: isDark ? "bg-slate-500" : "bg-slate-400",
  };

  const renderTabLabel = (id: string, label: string, count: number) => {
    const active = selectedTab === id;
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            active ? "bg-white/90" : tabDotClass[id] || tabDotClass.all,
          )}
          aria-hidden
        />
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "text-[11px] font-normal tabular-nums",
            active
              ? "text-white/65"
              : isDark
                ? "text-slate-400"
                : "text-slate-500",
          )}
        >
          {count}
        </span>
      </span>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Hero: Total Requested */}
        <div
          className={cn(
            "rounded-xl border p-5 sm:p-6",
            isDark
              ? "border-white/10 bg-gradient-to-br from-[#1c1038] via-[#14082c] to-[#0c061c] text-white"
              : "border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-white text-slate-900",
          )}
        >
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium tracking-wide",
                isDark ? "text-slate-300" : "text-slate-600",
              )}
            >
              Total Requested
            </p>
            <p className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums">
              {formatCurrencyFromCents(totals.all)}
            </p>
            <p
              className={cn(
                "mt-2 text-sm",
                isDark ? "text-slate-400" : "text-slate-500",
              )}
            >
              Total withdrawal amount
            </p>
          </div>
        </div>

        {/* Status cards: 2-col mobile / 3-col desktop (6 cards, no empty cell) */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {statusSummaryCards.map((card) => {
            const muted = Boolean(card.muteWhenZero && card.amount === 0);
            return (
              <div
                key={card.key}
                className={cn(
                  "relative overflow-hidden rounded-xl border p-3.5 sm:p-4 pl-4 sm:pl-5 transition-opacity",
                  isDark
                    ? "border-white/10 bg-[#170337]"
                    : "border-slate-200 bg-white",
                  muted && "opacity-55",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-3 bottom-3 w-[2px] rounded-full",
                    muted
                      ? isDark
                        ? "bg-slate-600"
                        : "bg-slate-300"
                      : card.accent,
                  )}
                />
                <p
                  className={cn(
                    "text-sm font-medium",
                    muted
                      ? isDark
                        ? "text-slate-500"
                        : "text-slate-400"
                      : isDark
                        ? "text-slate-300"
                        : "text-slate-600",
                  )}
                >
                  {card.label}
                </p>
                <p
                  className={cn(
                    "mt-2 text-xl sm:text-2xl font-semibold tabular-nums tracking-tight",
                    muted
                      ? isDark
                        ? "text-slate-500"
                        : "text-slate-400"
                      : isDark
                        ? "text-white"
                        : "text-slate-900",
                  )}
                >
                  {formatCurrencyFromCents(card.amount)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    muted
                      ? isDark
                        ? "text-slate-600"
                        : "text-slate-400"
                      : isDark
                        ? "text-slate-400"
                        : "text-slate-500",
                  )}
                >
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>

        <PayoutMethodSettingsCard isDark={isDark} />

        <WithdrawalFeeRevenueSection
          from={filterRange.from}
          to={filterRange.to}
          periodLabel={filterPresetLabel || "the selected period"}
          isDark={isDark}
        />

        {/* Toolbar: date range + payout method + grouping + export */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
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
            <Select
              value={methodFilter}
              onValueChange={(v) => {
                setPage(1);
                setMethodFilter(v as WithdrawalsMethodFilter);
              }}
            >
              <SelectTrigger
                className={cn(
                  "w-full sm:w-[180px] rounded-xl",
                  isDark && "border-white/15",
                )}
                aria-label="Payout method filter"
              >
                <CreditCard className="h-4 w-4 mr-2 opacity-70" />
                <SelectValue placeholder="Payout method" />
              </SelectTrigger>
              <SelectContent>
                {METHOD_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer",
                isDark ? "border-white/15" : "border-slate-200",
              )}
            >
              <Switch
                checked={groupByPayee}
                onCheckedChange={(v) => {
                  setPage(1);
                  setGroupByPayee(v);
                }}
                aria-label="Group by payee"
              />
              <Users className="h-4 w-4 opacity-70" />
              Group by payee
            </label>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setExportDialogOpen(true)}
            className={cn(
              "w-full sm:w-auto rounded-xl",
              isDark && "border-white/15",
            )}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <PayoutHistoryChart
          series={payoutSeries}
          loading={payoutSeriesLoading}
          isDark={isDark}
          granularity={payoutSeriesGranularity}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {groupByPayee
              ? "Grouped by payout destination. Click a group to see its requests."
              : "Tip: tap/click any column header to sort."}
          </p>
          {(selectedIds.size > 0 ||
            selectedTab === "pending" ||
            selectedTab === "in_review" ||
            selectedTab === "approved" ||
            selectedTab === "all") && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.size > 0 && (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    {selectedIds.size} selected
                  </span>
                )}
                {(selectedTab !== "approved" || someApprovableSelected) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    selectedIds.size === 0 ||
                    bulkApproving ||
                    updating ||
                    !someApprovableSelected
                  }
                  onClick={() => void bulkApproveSelected()}
                  className={cn("rounded-xl", isDark && "border-white/15")}
                >
                  {bulkApproving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Approve selected
                </Button>
                )}
                {selectedTab === "approved" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={openSkydoImport}
                    disabled={loading}
                    className="rounded-xl gap-1.5 bg-gradient-to-r from-[#8B47F5] to-[#6A2FD0] text-white shadow-md shadow-violet-500/20 hover:from-[#7F39EC] hover:to-[#5d27bd]"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                    Import Skydo payouts
                  </Button>
                )}
                {selectedIds.size > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={bulkApproving}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
        </div>

        <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          <EnhancedTabs
            tabs={[
              {
                id: "all",
                label: renderTabLabel(
                  "all",
                  "All",
                  statusCountsFromApi?.all ?? 0,
                ),
              },
              {
                id: "pending",
                label: renderTabLabel(
                  "pending",
                  "Pending",
                  statusCountsFromApi?.pending ?? 0,
                ),
              },
              {
                id: "in_review",
                label: renderTabLabel(
                  "in_review",
                  "In Review",
                  statusCountsFromApi?.in_review ?? 0,
                ),
              },
              {
                id: "approved",
                label: renderTabLabel(
                  "approved",
                  "Approved",
                  statusCountsFromApi?.approved ?? 0,
                ),
              },
              {
                id: "rejected",
                label: renderTabLabel(
                  "rejected",
                  "Rejected",
                  statusCountsFromApi?.rejected ?? 0,
                ),
              },
              {
                id: "paid",
                label: renderTabLabel(
                  "paid",
                  "Paid",
                  statusCountsFromApi?.paid ?? 0,
                ),
              },
              {
                id: "forfeited",
                label: renderTabLabel(
                  "forfeited",
                  "Forfeited",
                  statusCountsFromApi?.forfeited ?? 0,
                ),
              },
              {
                id: "failed",
                label: renderTabLabel(
                  "failed",
                  "Failed",
                  statusCountsFromApi?.failed ?? 0,
                ),
              },
            ]}
            activeTab={selectedTab}
            onTabChange={(id) => {
              setPage(1);
              setSelectedTab(id);
            }}
            className="mb-4"
            isDark={isDark}
            light={!isDark}
            fillWidth={false}
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
                <PageLoadingSpinner mode={isDark ? "dark" : "light"} />
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
              {groupByPayee
                ? renderGroupedTable(payeeGroups)
                : renderTable(requests)}
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
                Exports rows matching the filters below. Pick columns, rename
                headers, reorder them, and optionally convert currency or
                combine requests sent to the same payee.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  isDark
                    ? "border-violet-700/60 bg-violet-900/20 text-violet-200"
                    : "border-violet-200 bg-violet-50 text-violet-800",
                )}
              >
                Filters applied: {TAB_LABELS[selectedTab] ?? selectedTab},{" "}
                {METHOD_FILTER_OPTIONS.find((o) => o.value === methodFilter)
                  ?.label ?? methodFilter}
                , {filterPresetLabel}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={applySkydoPreset}
                >
                  Skydo bulk payout preset
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={resetExportColumns}
                >
                  Reset columns
                </Button>
              </div>

              <div
                className={cn(
                  "rounded-lg border p-3 text-sm space-y-3",
                  isDark
                    ? "border-gray-600 bg-[#06021D]/80"
                    : "border-slate-200 bg-slate-50/80",
                )}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Payout currency</Label>
                    <Select
                      value={exportCurrency}
                      onValueChange={setExportCurrency}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPORT_CURRENCY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {exportCurrency !== "USD" && (
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="export-fx-rate">
                        1 USD = ? {exportCurrency}
                      </Label>
                      <Input
                        id="export-fx-rate"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.0001"
                        placeholder="e.g. 92"
                        value={exportRate}
                        onChange={(e) => setExportRate(e.target.value)}
                        className={cn(
                          "h-9",
                          !exportRateValid && exportRate !== "" &&
                          "border-red-500",
                        )}
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Applies to the &quot;Payout amount&quot; and &quot;Payout
                  currency&quot; columns. Stored amounts are in USD.
                </p>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Switch
                    checked={exportGroupByPayee}
                    onCheckedChange={setExportGroupByPayee}
                  />
                  Group by payee email (one row per payout destination, amounts
                  summed, usernames listed)
                </label>
              </div>

              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  isDark
                    ? "border-gray-600 bg-[#06021D]/80"
                    : "border-slate-200 bg-slate-50/80",
                )}
              >
                <p className="font-medium mb-2">Columns and headers</p>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {exportOrder.map((id) => {
                    const checked = exportColumns[id] !== false;
                    return (
                      <div key={id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setExportColumns((prev) => ({
                              ...prev,
                              [id]: v === true,
                            }))
                          }
                          aria-label={`Include ${WITHDRAWAL_EXPORT_COLUMN_LABELS[id]}`}
                        />
                        {checked ? (
                          <>
                            <Input
                              value={exportHeaders[id] ?? ""}
                              placeholder={WITHDRAWAL_EXPORT_COLUMN_LABELS[id]}
                              onChange={(e) =>
                                setExportHeaders((prev) => ({
                                  ...prev,
                                  [id]: e.target.value,
                                }))
                              }
                              className="h-7 text-xs flex-1"
                              title={WITHDRAWAL_EXPORT_COLUMN_LABELS[id]}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveExportColumn(id, -1)}
                              aria-label="Move column up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveExportColumn(id, 1)}
                              aria-label="Move column down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="truncate text-muted-foreground">
                            {WITHDRAWAL_EXPORT_COLUMN_LABELS[id]}
                          </span>
                        )}
                      </div>
                    );
                  })}
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
              <Button
                type="button"
                disabled={exporting || !exportRateValid}
                onClick={() => void runExportDownload()}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Selected approved requests: fill payout details */}
        {selectedApproved.length > 0 && !skydoDialogOpen && !detailsOpen && (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
            <div
              role="toolbar"
              aria-label="Selected approved requests"
              className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#140B3A] px-3 py-2 text-white shadow-2xl animate-in slide-in-from-bottom-4"
            >
              <div className="flex items-baseline gap-2 px-1 text-sm">
                <span className="font-semibold tabular-nums">
                  {selectedApproved.length} approved selected
                </span>
                <span className="text-xs text-white/60 tabular-nums">
                  {formatCurrencyFromCents(
                    selectedApproved.reduce((sum, r) => sum + sendCentsOf(r), 0),
                  )}{" "}
                  to send
                </span>
              </div>
              <span className="hidden h-6 w-px bg-white/15 sm:block" aria-hidden />
              <Button
                size="sm"
                onClick={openFillDetails}
                className="h-8 gap-1.5 bg-[#7F39EC] text-white hover:bg-[#6a2fd0]"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Fill details & mark paid
              </Button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                aria-label="Clear selection"
                className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <SkydoPayoutDialog
          open={skydoDialogOpen}
          onOpenChange={setSkydoDialogOpen}
          isDark={isDark}
          scope={skydoScope}
          onApplied={onSkydoApplied}
        />

        {/* Withdrawal Details Modal */}
        <Dialog
          open={detailsOpen}
          onOpenChange={(open) => {
            setDetailsOpen(open);
            if (!open) setMetadataSaveMsg(null);
          }}
          isdark={isDark}
        >
          <DialogContent
            className={cn(
              "sm:max-w-[720px] max-h-[min(92vh,920px)] w-[calc(100%-1.5rem)] p-0 sm:p-0 gap-0 overflow-hidden flex flex-col",
              isDark ? "border-white/10 text-white" : "text-slate-900",
            )}
          >
            <DialogHeader
              className={cn(
                "shrink-0 space-y-0 border-b px-5 sm:px-6 pt-5 pb-4 pr-12 text-left",
                isDark
                  ? "border-white/10 bg-gradient-to-br from-[#2A1060] via-[#140B3A] to-[#06021D]"
                  : "border-slate-200 bg-gradient-to-br from-violet-50 via-white to-white",
              )}
            >
              {active ? (
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9B5CFF] to-[#6A2FD0] text-sm font-semibold text-white shadow-lg shadow-violet-500/25">
                    {initialsOf(active.users?.full_name || active.users?.username || "?")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="truncate text-lg font-semibold leading-tight">
                        {active.users?.full_name || "Unknown user"}
                      </DialogTitle>
                      {getStatusBadge(active.status)}
                    </div>
                    <DialogDescription asChild>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {active.users?.username && <span>@{active.users.username}</span>}
                        {active.users?.email && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                            onClick={() => void copyText(active.users!.email!, "Email")}
                            title="Copy email"
                          >
                            <Mail className="h-3 w-3" />
                            {active.users.email}
                          </button>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(active.created_at).toLocaleString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </DialogDescription>
                  </div>
                </div>
              ) : (
                <>
                  <DialogTitle>Withdrawal details</DialogTitle>
                  <DialogDescription>Review the request and record the payout.</DialogDescription>
                </>
              )}
            </DialogHeader>
            {active && (() => {
              const payout = withdrawalPayout(active);
              const isCash = active.amount_type === "cash";
              const payTo = getPayToRows(active);
              const methodType = (active.payout_method_type_snapshot || "").toLowerCase();
              const MethodIcon = getPaymentMethodIcon(active);
              const showRecord =
                Boolean(active.payout_details) ||
                ["approved", "processed", "failed"].includes(active.status);
              const panel = cn(
                "rounded-xl border",
                isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-white",
              );
              const sectionLabel =
                "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
              const fieldCls = cn(
                "w-full text-sm",
                isDark
                  ? "border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                  : "bg-white text-black",
              );
              return (
                <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
                  {/* Amount */}
                  <div className={cn(panel, "overflow-hidden")}>
                    <div className="grid grid-cols-2 sm:grid-cols-3">
                      <div className={cn("p-4", isDark ? "border-white/10" : "border-slate-100")}>
                        <p className={sectionLabel}>Requested</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                          {isCash
                            ? formatCurrencyFromCents(active.amount)
                            : `${active.amount} coins`}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {active.amount_type}
                        </p>
                      </div>
                      {isCash && (
                        <div
                          className={cn(
                            "p-4 border-l",
                            isDark ? "border-white/10" : "border-slate-100",
                          )}
                        >
                          <p className={sectionLabel}>
                            Fee{payout.feeBps > 0 ? ` · ${formatFeePercent(payout.feeBps)}` : ""}
                          </p>
                          <p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground">
                            {payout.feeCents > 0
                              ? `−${formatCurrencyFromCents(payout.feeCents)}`
                              : "None"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payout.feeCents > 0 ? "Kept by Game of Creators" : "No processing fee"}
                          </p>
                        </div>
                      )}
                      {isCash && (
                        <div
                          className={cn(
                            "col-span-2 sm:col-span-1 p-4 border-t sm:border-t-0 sm:border-l",
                            isDark
                              ? "border-white/10 bg-emerald-500/[0.06]"
                              : "border-slate-100 bg-emerald-50/60",
                          )}
                        >
                          <p className={sectionLabel}>To send</p>
                          <p
                            className={cn(
                              "mt-1 text-2xl font-semibold tabular-nums",
                              isDark ? "text-emerald-300" : "text-emerald-700",
                            )}
                          >
                            {payout.receiveLabel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payout.currency === "INR" && payout.usdInrRate !== null
                              ? `${formatCurrencyFromCents(payout.netCents)} at ${formatUsdInrRate(payout.usdInrRate)} per $1`
                              : payout.currency}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pay to */}
                  <section className="space-y-2">
                    <p className={sectionLabel}>Pay to</p>
                    <div className={cn(panel, "p-4")}>
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            isDark ? "bg-orange-500/10" : "bg-orange-50",
                          )}
                        >
                          <MethodIcon className={cn("h-4 w-4", getPaymentMethodColor(active))} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {PAYOUT_METHOD_LABELS[methodType] || methodType || "Unknown method"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Details saved when the request was made
                          </p>
                        </div>
                      </div>
                      {payTo.length > 0 && (
                        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {payTo.map((row) => (
                            <div
                              key={row.label}
                              className={cn(
                                "min-w-0 rounded-lg px-3 py-2",
                                row.wide && "sm:col-span-2",
                                isDark ? "bg-white/[0.03]" : "bg-slate-50",
                              )}
                            >
                              <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
                              <dd className="mt-0.5 flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "min-w-0 text-sm font-medium",
                                    row.mono ? "break-all font-mono text-xs" : "truncate",
                                  )}
                                >
                                  {row.value}
                                </span>
                                {row.copy && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => void copyText(row.copy!, row.label)}
                                    aria-label={`Copy ${row.label}`}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  </section>

                  {/* Payout record */}
                  {showRecord && (
                    <section className="space-y-2">
                      <p className={sectionLabel}>Payout record</p>
                      <PayoutRecordCard
                        raw={active.payout_details}
                        isDark={isDark}
                        onSave={savePayoutRecord}
                      />
                    </section>
                  )}

                  {active.user_notes && (
                    <section className="space-y-2">
                      <p className={sectionLabel}>Note from user</p>
                      <p
                        className={cn(
                          "rounded-xl border px-4 py-3 text-sm whitespace-pre-wrap",
                          isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-slate-50",
                        )}
                      >
                        {active.user_notes}
                      </p>
                    </section>
                  )}

                  {/* Notes, reference, proof */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className={sectionLabel}>Internal notes & proof</p>
                      {metadataDirty && !savingMetadata && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-medium",
                            isDark ? "text-amber-300" : "text-amber-700",
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Unsaved changes
                        </span>
                      )}
                    </div>
                    <div className={cn(panel, "p-4 space-y-4")}>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
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
                              setMetadataSaveMsg(null);
                            }}
                            placeholder="Skydo payout ID / TXID / reference"
                            className={cn(fieldCls, "h-10 font-mono placeholder:font-sans")}
                          />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <Label htmlFor="payment_proof_link" className="text-xs font-medium">
                            Proof URL <span className="text-muted-foreground">(optional)</span>
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="payment_proof_link"
                              value={paymentProofLinkDraft}
                              onChange={(e) => {
                                setPaymentProofLinkDraft(e.target.value);
                                setMetadataDirty(true);
                                setMetadataSaveMsg(null);
                              }}
                              placeholder="https://…"
                              className={cn(
                                fieldCls,
                                "h-10 min-w-0",
                                /^https?:\/\//i.test(paymentProofLinkDraft.trim())
                                  ? "border-emerald-600/50 focus-visible:ring-emerald-600/30"
                                  : null,
                              )}
                            />
                            {/^https?:\/\//i.test(paymentProofLinkDraft.trim()) ? (
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
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="admin_notes" className="text-xs font-medium">
                          Admin notes
                        </Label>
                        <Textarea
                          id="admin_notes"
                          value={adminNotes}
                          onChange={(e) => {
                            setAdminNotes(e.target.value);
                            setMetadataDirty(true);
                            setMetadataSaveMsg(null);
                          }}
                          rows={3}
                          placeholder="Internal notes, campaign context…"
                          className={cn(fieldCls, "min-h-[76px] resize-y")}
                        />
                      </div>

                      <input
                        ref={proofFileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => void onPaymentProofFile(e.target.files)}
                      />

                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2.5",
                          isDark ? "border-white/15" : "border-slate-300",
                        )}
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {active.payment_proof_storage_path ? (
                          <>
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate text-left font-mono text-xs hover:underline"
                              title={active.payment_proof_storage_path}
                              onClick={() => void openProofInNewTab(active.id)}
                            >
                              {active.payment_proof_storage_path.split("/").pop()}
                            </button>
                            {active.payment_proof_file_size_bytes != null && (
                              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {formatProofFileSize(active.payment_proof_file_size_bytes)}
                              </span>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => void openProofInNewTab(active.id)}
                            >
                              <FileImage className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                              disabled={proofRemoving || proofUploading}
                              title="Remove uploaded file"
                              onClick={() => void removePaymentProofFile()}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                            No proof file. Images or video, max{" "}
                            {PAYMENT_PROOF_MAX_BYTES / 1024 / 1024} MB.
                          </span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-7 gap-1 px-2.5 text-xs",
                            isDark && "border-white/15 bg-transparent hover:bg-white/5",
                          )}
                          disabled={proofUploading || proofRemoving}
                          onClick={() => proofFileInputRef.current?.click()}
                        >
                          {proofUploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {proofUploading
                            ? "Uploading…"
                            : active.payment_proof_storage_path
                              ? "Replace"
                              : "Upload file"}
                        </Button>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        {metadataSaveMsg ? (
                          <p
                            className={cn(
                              "inline-flex items-center gap-1.5 text-sm font-medium order-2 sm:order-1",
                              isDark ? "text-emerald-300" : "text-emerald-700",
                            )}
                            role="status"
                          >
                            <CheckCircle className="h-4 w-4 shrink-0" />
                            {metadataSaveMsg}
                          </p>
                        ) : (
                          <span className="hidden sm:block order-1" />
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full sm:w-auto order-1 sm:order-2",
                            isDark && "border-white/15 bg-transparent hover:bg-white/5",
                          )}
                          disabled={savingMetadata || !metadataDirty}
                          onClick={() => void saveMetadata()}
                        >
                          {savingMetadata ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-1.5 h-4 w-4" />
                          )}
                          {savingMetadata ? "Saving…" : "Save notes, reference & proof"}
                        </Button>
                      </div>
                    </div>
                  </section>

                  <p className="pb-1 text-[11px] text-muted-foreground">
                    Request ID{" "}
                    <button
                      type="button"
                      className="font-mono hover:text-foreground"
                      onClick={() => void copyText(active.id, "Request ID")}
                    >
                      {active.id}
                    </button>
                    {active.processed_at &&
                      ` · Paid ${new Date(active.processed_at).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
                  </p>
                </div>
              );
            })()}
            <DialogFooter
              className={cn(
                "shrink-0 border-t px-5 sm:px-6 py-3 sm:py-3.5",
                isDark ? "bg-[#06021D] border-white/10" : "bg-white border-slate-200",
              )}
            >
              {active && !isFinalStatus(active.status) ? (
                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    {["pending", "in_review"].includes(active.status) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="justify-center"
                            onClick={() => cancelRequest(active)}
                            disabled={updating || savingMetadata}
                          >
                            <X className="h-4 w-4 mr-1 shrink-0" />
                            Cancel
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[60]">
                          <p>Cancel and refund user balance</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {["pending", "in_review"].includes(active.status) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="justify-center"
                            onClick={() => openInReviewDialog(active)}
                            disabled={updating || savingMetadata}
                          >
                            <Clock className="h-4 w-4 mr-1 shrink-0" />
                            Review
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[60]">
                          <p>Mark as under review (add internal reason for other reviewers)</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {active.status === "in_review" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="justify-center"
                            onClick={() =>
                              void updateStatus(active.id, "pending", undefined, {
                                closeDetails: true,
                              })
                            }
                            disabled={updating || savingMetadata}
                          >
                            <RotateCcw className="h-4 w-4 mr-1 shrink-0" />
                            Back to pending
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[60]">
                          <p>Revert to pending</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {["pending", "in_review", "approved", "failed"].includes(active.status) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              "justify-center",
                              isDark
                                ? "text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                                : "text-rose-600 hover:bg-rose-50 hover:text-rose-700",
                            )}
                            onClick={() => openRejectDialog(active)}
                            disabled={updating || savingMetadata}
                          >
                            <XCircle className="h-4 w-4 mr-1 shrink-0" />
                            Reject
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[60]">
                          <p>Reject request (optionally add reason for user)</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {active.status === "approved" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="justify-center"
                            onClick={() => openFailedDialog(active)}
                            disabled={updating || savingMetadata}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1 shrink-0" />
                            Failed
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[60]">
                          <p>Payment failed (internal tracking)</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {active.status === "approved" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="justify-center"
                            onClick={() => openForfeitDialog(active)}
                            disabled={updating || savingMetadata}
                          >
                            <ShieldOff className="h-4 w-4 mr-1 shrink-0" />
                            Forfeit
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[60]">
                          <p>Forfeit (no refund)</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {["pending", "in_review"].includes(active.status) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="w-full sm:w-auto sm:min-w-[150px] justify-center bg-[#7F39EC] text-white hover:bg-[#6a2fd0]"
                          onClick={() =>
                            void applyStatusFromDetails("approved", {
                              admin_notes: adminNotes,
                              transaction_reference: txRef,
                            })
                          }
                          disabled={updating || savingMetadata}
                        >
                          <CheckCircle className="h-4 w-4 mr-1.5 shrink-0" />
                          Approve
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[60]">
                        <p>Approve for payment processing (keeps transaction reference)</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {["approved", "failed"].includes(active.status) && (
                    <Button
                      className="w-full sm:w-auto sm:min-w-[150px] justify-center bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() =>
                        void applyStatusFromDetails("processed", {
                          transaction_reference: txRef,
                          admin_notes: adminNotes,
                        })
                      }
                      disabled={updating || savingMetadata}
                    >
                      <DollarSign className="h-4 w-4 mr-1.5 shrink-0" />
                      Mark Paid
                    </Button>
                  )}
                </div>
              ) : active ? (
                <p className="text-sm text-muted-foreground w-full text-center sm:text-left">
                  This request is in a final status and can no longer be updated.
                </p>
              ) : null}
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
