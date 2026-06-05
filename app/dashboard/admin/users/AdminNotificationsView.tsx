"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAdminScheduledNotificationDelivery,
  useSyncScheduledCampaignTimers,
} from "@/hooks/useAdminScheduledNotificationDelivery";
import { setScheduledDeliveryListener } from "@/lib/admin-notifications/client-delivery-scheduler";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import {
  CampaignDeliveryProgressBar,
  type DeliveryProgressData,
} from "./CampaignDeliveryProgressBar";
import { CampaignNotificationStats } from "./CampaignNotificationStats";

type CampaignListItem = {
  id: string;
  messageTemplate: string;
  recipientCount: number;
  successCount: number;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  readCount: number;
  readPercent: number | null;
  deliveryProgress?: DeliveryProgressData | null;
};

type RecipientRow = {
  userId: string;
  fullName: string;
  email: string;
  userTypeAtSend: string;
  deliveryStatus: string;
  isRead: boolean;
  readAt: string | null;
  sentAt: string | null;
};

type RecipientSortColumn =
  | "fullName"
  | "email"
  | "userTypeAtSend"
  | "deliveryStatus"
  | "isRead"
  | "readAt";

type UserTypeFilter = "all" | "creator" | "advertiser" | "admin";

function compareRecipients(
  a: RecipientRow,
  b: RecipientRow,
  column: RecipientSortColumn,
  order: "asc" | "desc",
): number {
  let cmp = 0;

  switch (column) {
    case "fullName":
      cmp = (a.fullName || "").localeCompare(b.fullName || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "email":
      cmp = (a.email || "").localeCompare(b.email || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "userTypeAtSend":
      cmp = (a.userTypeAtSend || "").localeCompare(b.userTypeAtSend || "");
      break;
    case "deliveryStatus":
      cmp = (a.deliveryStatus || "").localeCompare(b.deliveryStatus || "");
      break;
    case "isRead":
      cmp = Number(a.isRead) - Number(b.isRead);
      break;
    case "readAt": {
      const aTime = a.readAt ? new Date(a.readAt).getTime() : null;
      const bTime = b.readAt ? new Date(b.readAt).getTime() : null;
      if (aTime === null && bTime === null) cmp = 0;
      else if (aTime === null) cmp = 1;
      else if (bTime === null) cmp = -1;
      else cmp = aTime - bTime;
      break;
    }
  }

  return order === "asc" ? cmp : -cmp;
}

type Props = {
  isDark?: boolean;
  timezone: "UTC" | "local";
  highlightCampaignId?: string | null;
  onHighlightConsumed?: () => void;
};

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    partial: "bg-amber-100 text-amber-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
    processing: "bg-purple-100 text-purple-800",
    pending: "bg-slate-100 text-slate-800",
  };
  return (
    <Badge className={cn("capitalize", variants[status] ?? variants.pending)}>
      {status}
    </Badge>
  );
}

function formatWhen(
  iso: string,
  scheduledAt: string | null,
  status: string,
  timezone: "UTC" | "local",
) {
  const d = new Date(status === "scheduled" && scheduledAt ? scheduledAt : iso);
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  };
  if (timezone === "UTC") {
    opts.timeZone = "UTC";
  }
  return d.toLocaleString("en-US", opts);
}

function skeletonTone(isDark?: boolean) {
  return isDark ? "bg-white/10" : undefined;
}

function NotificationStatsSkeleton({ isDark }: { isDark?: boolean }) {
  const tone = skeletonTone(isDark);
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl border p-4 flex flex-col gap-3 min-h-[108px] shadow-sm",
            isDark ? "border-white/10 bg-[#170337]" : "border-border/80 bg-white",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <Skeleton className={cn("h-4 w-24", tone)} />
            <Skeleton className={cn("h-5 w-5 rounded", tone)} />
          </div>
          <Skeleton className={cn("h-8 w-16", tone)} />
          <Skeleton className={cn("h-3 w-28", tone)} />
        </div>
      ))}
    </div>
  );
}

function RecipientTableSkeletonRows({
  rows,
  isDark,
}: {
  rows: number;
  isDark?: boolean;
}) {
  const tone = skeletonTone(isDark);
  const cellWidths = ["w-28", "w-36", "w-20", "w-24", "w-20", "w-32"];

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {cellWidths.map((width, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className={cn("h-4", width, tone)} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function CampaignRecipientPanelSkeleton({
  isDark,
  rowCount,
}: {
  isDark?: boolean;
  rowCount: number;
}) {
  const tone = skeletonTone(isDark);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className={cn("h-10 w-full max-w-xs sm:max-w-sm", tone)} />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className={cn("h-10 w-[150px]", tone)} />
          <Skeleton className={cn("h-10 w-[150px]", tone)} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {["Name", "Email", "User Type", "Delivered", "Read status", "Read at"].map(
                (label) => (
                  <TableHead key={label}>{label}</TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            <RecipientTableSkeletonRows rows={rowCount} isDark={isDark} />
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className={cn("h-4 w-40", tone)} />
        <div className="flex items-center gap-2">
          <Skeleton className={cn("h-9 w-9", tone)} />
          <Skeleton className={cn("h-9 w-9", tone)} />
          <Skeleton className={cn("h-9 w-9", tone)} />
          <Skeleton className={cn("h-9 w-9", tone)} />
        </div>
      </div>
    </div>
  );
}

function CampaignListSkeleton({ isDark }: { isDark?: boolean }) {
  const tone = skeletonTone(isDark);
  const rowWidths = [
    ["w-28", "w-48", "w-12", "w-16", "w-20", "w-16"],
    ["w-32", "w-56", "w-14", "w-20", "w-24", "w-16"],
    ["w-24", "w-40", "w-12", "w-14", "w-20", "w-16"],
    ["w-28", "w-52", "w-16", "w-16", "w-20", "w-16"],
    ["w-32", "w-44", "w-12", "w-16", "w-24", "w-16"],
    ["w-24", "w-48", "w-14", "w-20", "w-20", "w-16"],
  ];

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {["Sent at", "Message", "Users", "Read", "Status", ""].map(
              (label) => (
                <TableHead key={label || "action"}>{label}</TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowWidths.map((widths, rowIndex) => (
            <TableRow key={rowIndex}>
              {widths.map((width, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton className={cn("h-4", width, tone)} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminNotificationsView({
  isDark = false,
  timezone,
  highlightCampaignId,
  onHighlightConsumed,
}: Props) {
  useAdminScheduledNotificationDelivery(true);

  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>("all");
  const [summary, setSummary] = useState<{
    sent: number;
    read: number;
    readPercent: number;
    byType: Record<string, { sent: number; read: number }>;
  } | null>(null);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [recipientTotalPages, setRecipientTotalPages] = useState(1);
  const [allRecipients, setAllRecipients] = useState<RecipientRow[]>([]);
  const [allRecipientsReady, setAllRecipientsReady] = useState(false);
  const [campaignMeta, setCampaignMeta] = useState<{
    messageTemplate: string;
    status: string;
    recipientCount: number;
  } | null>(null);
  const [detailProgress, setDetailProgress] =
    useState<DeliveryProgressData | null>(null);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientLimit, setRecipientLimit] = useState(25);
  const campaignsRef = useRef(campaigns);
  campaignsRef.current = campaigns;
  const [recipientSearch, setRecipientSearch] = useState("");
  const [readStatusFilter, setReadStatusFilter] = useState<
    "all" | "read" | "unread"
  >("all");
  const [recipientSortColumn, setRecipientSortColumn] =
    useState<RecipientSortColumn | null>(null);
  const [recipientSortOrder, setRecipientSortOrder] = useState<
    "asc" | "desc" | null
  >(null);

  const loadCampaigns = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications/campaigns?limit=50");
      const data = await res.json();
      if (res.ok) {
        setCampaigns(data.campaigns ?? []);
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    setScheduledDeliveryListener(() => {
      const needsRefresh = campaignsRef.current.some(
        (c) =>
          c.status === "scheduled" ||
          c.status === "processing" ||
          c.status === "pending",
      );
      if (needsRefresh) {
        void loadCampaigns({ silent: true });
      }
    });
    return () => setScheduledDeliveryListener(null);
  }, [loadCampaigns]);

  useSyncScheduledCampaignTimers(campaigns, true);

  const hasActiveDelivery = campaigns.some(
    (c) => c.status === "processing" || c.status === "pending",
  );

  useEffect(() => {
    if (!hasActiveDelivery) return;
    const interval = setInterval(() => {
      void loadCampaigns({ silent: true });
    }, 2000);
    return () => clearInterval(interval);
  }, [hasActiveDelivery, loadCampaigns]);

  useEffect(() => {
    if (highlightCampaignId) {
      setSelectedId(highlightCampaignId);
      onHighlightConsumed?.();
    }
  }, [highlightCampaignId, onHighlightConsumed]);

  const loadDetail = useCallback(
    async (
      campaignId: string,
      options: {
        userType: UserTypeFilter;
        page: number;
        limit: number;
        readStatus: "all" | "read" | "unread";
        search: string;
        sortColumn: RecipientSortColumn | null;
        sortOrder: "asc" | "desc" | null;
        showFullPageLoader?: boolean;
      },
    ) => {
      if (options.showFullPageLoader) {
        setDetailLoading(true);
      }
      setRecipientsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(options.page));
        params.set("limit", String(options.limit));
        if (options.userType !== "all") {
          params.set("userType", options.userType);
        }
        if (options.readStatus !== "all") {
          params.set("readStatus", options.readStatus);
        }
        if (options.search.trim()) {
          params.set("search", options.search.trim());
        }
        if (options.sortColumn && options.sortOrder) {
          params.set("sortColumn", options.sortColumn);
          params.set("sortOrder", options.sortOrder);
        }

        const res = await fetch(
          `/api/admin/notifications/campaigns/${campaignId}?${params}`,
        );
        const data = await res.json();
        if (res.ok) {
          setSummary(data.summary);
          setRecipients(data.recipients ?? []);
          setRecipientTotal(data.recipientsTotal ?? 0);
          setRecipientTotalPages(data.recipientsTotalPages ?? 1);
          setCampaignMeta({
            messageTemplate: data.campaign.messageTemplate,
            status: data.campaign.status,
            recipientCount: data.campaign.recipientCount ?? 0,
          });
          setDetailProgress(data.deliveryProgress ?? null);
        }
      } finally {
        setRecipientsLoading(false);
        if (options.showFullPageLoader) {
          setDetailLoading(false);
        }
      }
    },
    [],
  );

  const preloadAllRecipients = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(
        `/api/admin/notifications/campaigns/${campaignId}?allRecipients=true`,
      );
      const data = await res.json();
      if (!res.ok) return;
      setAllRecipients(data.allRecipients ?? []);
      setAllRecipientsReady(true);
      setSummary(data.summary);
      setCampaignMeta({
        messageTemplate: data.campaign.messageTemplate,
        status: data.campaign.status,
        recipientCount: data.campaign.recipientCount ?? 0,
      });
      setDetailProgress(data.deliveryProgress ?? null);
    } catch {
      /* ignore preload errors */
    }
  }, []);

  const reloadDetail = useCallback(
    (showFullPageLoader = false) => {
      if (!selectedId) return;
      void loadDetail(selectedId, {
        userType: userTypeFilter,
        page: recipientPage,
        limit: recipientLimit,
        readStatus: readStatusFilter,
        search: recipientSearch,
        sortColumn: recipientSortColumn,
        sortOrder: recipientSortOrder,
        showFullPageLoader,
      });
    },
    [
      selectedId,
      userTypeFilter,
      recipientPage,
      recipientLimit,
      readStatusFilter,
      recipientSearch,
      recipientSortColumn,
      recipientSortOrder,
      loadDetail,
    ],
  );

  const pollDetailProgress = useCallback(
    async (campaignId: string) => {
      try {
        const res = await fetch(
          `/api/admin/notifications/campaigns/${campaignId}/progress`,
        );
        const data = await res.json();
        if (!res.ok) return;
        setDetailProgress({
          deliveredCount: data.deliveredCount,
          failedCount: data.failedCount,
          pendingCount: data.pendingCount,
          processedCount: data.processedCount,
          recipientCount: data.recipientCount,
          percentComplete: data.percentComplete,
        });
        if (data.status !== "processing" && data.status !== "pending") {
          setCampaignMeta((prev) =>
            prev ? { ...prev, status: data.status } : prev,
          );
          void loadCampaigns();
          reloadDetail();
        }
      } catch {
        /* ignore poll errors */
      }
    },
    [loadCampaigns, reloadDetail],
  );

  useEffect(() => {
    if (!selectedId || campaignMeta?.status !== "processing") {
      return;
    }
    void pollDetailProgress(selectedId);
    const interval = setInterval(() => {
      void pollDetailProgress(selectedId);
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedId, campaignMeta?.status, pollDetailProgress]);

  useEffect(() => {
    if (!selectedId) return;
    reloadDetail(true);
    void preloadAllRecipients(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || allRecipientsReady) return;
    reloadDetail();
  }, [
    selectedId,
    allRecipientsReady,
    recipientPage,
    recipientLimit,
    userTypeFilter,
    readStatusFilter,
    recipientSortColumn,
    recipientSortOrder,
  ]);

  useEffect(() => {
    if (!selectedId || allRecipientsReady) return;
    const timer = setTimeout(() => {
      reloadDetail();
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedId, allRecipientsReady, recipientSearch, reloadDetail]);

  useEffect(() => {
    setRecipientPage(1);
  }, [selectedId, userTypeFilter, readStatusFilter, recipientSearch]);

  useEffect(() => {
    setRecipientSearch("");
    setUserTypeFilter("all");
    setReadStatusFilter("all");
    setRecipientSortColumn(null);
    setRecipientSortOrder(null);
    setRecipients([]);
    setRecipientTotal(0);
    setRecipientTotalPages(1);
    setAllRecipients([]);
    setAllRecipientsReady(false);
  }, [selectedId]);

  const filteredRecipients = useMemo(() => {
    let filtered = allRecipients;

    if (userTypeFilter !== "all") {
      filtered = filtered.filter(
        (row) => row.userTypeAtSend === userTypeFilter,
      );
    }

    if (readStatusFilter === "read") {
      filtered = filtered.filter((row) => row.isRead);
    } else if (readStatusFilter === "unread") {
      filtered = filtered.filter(
        (row) => row.deliveryStatus === "delivered" && !row.isRead,
      );
    }

    const search = recipientSearch.trim().toLowerCase();
    if (search) {
      filtered = filtered.filter(
        (row) =>
          (row.fullName || "").toLowerCase().includes(search) ||
          (row.email || "").toLowerCase().includes(search),
      );
    }

    if (recipientSortColumn && recipientSortOrder) {
      filtered = [...filtered].sort((a, b) =>
        compareRecipients(a, b, recipientSortColumn, recipientSortOrder),
      );
    }

    return filtered;
  }, [
    allRecipients,
    userTypeFilter,
    readStatusFilter,
    recipientSearch,
    recipientSortColumn,
    recipientSortOrder,
  ]);

  const clientRecipientTotal = filteredRecipients.length;
  const clientRecipientTotalPages = Math.max(
    1,
    Math.ceil(filteredRecipients.length / recipientLimit),
  );

  const paginatedRecipients = useMemo(() => {
    const start = (recipientPage - 1) * recipientLimit;
    return filteredRecipients.slice(start, start + recipientLimit);
  }, [filteredRecipients, recipientPage, recipientLimit]);

  useEffect(() => {
    const totalPages = allRecipientsReady
      ? clientRecipientTotalPages
      : recipientTotalPages;
    if (recipientPage > totalPages) {
      setRecipientPage(totalPages);
    }
  }, [
    recipientPage,
    allRecipientsReady,
    clientRecipientTotalPages,
    recipientTotalPages,
  ]);

  const displayRecipients = allRecipientsReady ? paginatedRecipients : recipients;
  const displayRecipientTotal = allRecipientsReady
    ? clientRecipientTotal
    : recipientTotal;
  const displayRecipientTotalPages = allRecipientsReady
    ? clientRecipientTotalPages
    : recipientTotalPages;

  const RecipientSortableHeader = ({
    columnId,
    label,
  }: {
    columnId: RecipientSortColumn;
    label: string;
  }) => (
    <TableHead
      className={cn(
        "whitespace-nowrap",
        isDark ? "bg-[#391A6A]" : "bg-[#F9FAFB]",
      )}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setRecipientSortColumn(columnId);
                setRecipientSortOrder("asc");
                setRecipientPage(1);
              }}
              className={cn(
                recipientSortColumn === columnId &&
                  recipientSortOrder === "asc" &&
                  "bg-accent",
              )}
            >
              Sort by Ascending
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setRecipientSortColumn(columnId);
                setRecipientSortOrder("desc");
                setRecipientPage(1);
              }}
              className={cn(
                recipientSortColumn === columnId &&
                  recipientSortOrder === "desc" &&
                  "bg-accent",
              )}
            >
              Sort by Descending
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setRecipientSortColumn(null);
                setRecipientSortOrder(null);
                setRecipientPage(1);
              }}
            >
              Clear Sort
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  );

  const handleCancel = async (campaignId: string) => {
    const res = await fetch(
      `/api/admin/notifications/campaigns/${campaignId}/cancel`,
      { method: "PATCH" },
    );
    if (res.ok) {
      await loadCampaigns();
      if (selectedId === campaignId) {
        reloadDetail(true);
      }
    }
  };

  const handleDeliverNow = async (campaignId: string) => {
    const res = await fetch(
      `/api/admin/notifications/campaigns/${campaignId}/deliver`,
      { method: "POST" },
    );
    if (res.ok) {
      await loadCampaigns();
      if (selectedId === campaignId) {
        reloadDetail(true);
      }
    }
  };

  const hasActiveRecipientFilters =
    recipientSearch.trim().length > 0 ||
    userTypeFilter !== "all" ||
    readStatusFilter !== "all";

  const readStatusBadge = (row: RecipientRow) => {
    if (row.deliveryStatus === "failed") {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (row.deliveryStatus !== "delivered") {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {campaignMeta?.status === "scheduled" ? "Not sent yet" : "Pending"}
        </Badge>
      );
    }
    return row.isRead ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        Read
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-amber-400 text-amber-700 bg-amber-50"
      >
        Unread
      </Badge>
    );
  };

  if (selectedId) {
    return (
      <Card
        className={cn(
          "rounded-xl shadow",
          isDark ? "bg-[#170337]" : "bg-white",
        )}
      >
        <CardContent className="px-6 py-4 space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => {
              setSelectedId(null);
              setUserTypeFilter("all");
              setRecipientPage(1);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            All notifications
          </Button>

          {campaignMeta ? (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {campaignMeta.messageTemplate}
            </p>
          ) : detailLoading ? (
            <Skeleton className={cn("h-5 w-3/4 max-w-xl", skeletonTone(isDark))} />
          ) : null}

          {campaignMeta?.status === "processing" && detailProgress && (
            <CampaignDeliveryProgressBar progress={detailProgress} />
          )}

          {summary ? (
            <CampaignNotificationStats summary={summary} isDark={isDark} />
          ) : detailLoading ? (
            <NotificationStatsSkeleton isDark={isDark} />
          ) : null}

          {detailLoading && !summary ? (
            <CampaignRecipientPanelSkeleton
              isDark={isDark}
              rowCount={recipientLimit}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative w-full max-w-xs min-w-[200px] sm:w-auto sm:flex-1 sm:max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search name or email..."
                    value={recipientSearch}
                    onChange={(e) => {
                      setRecipientSearch(e.target.value);
                      setRecipientPage(1);
                    }}
                    className={cn(
                      "pl-8",
                      isDark && "bg-[#07031D] border-gray-700 text-white",
                    )}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={userTypeFilter}
                    onValueChange={(value) => {
                      setUserTypeFilter(value as UserTypeFilter);
                      setRecipientPage(1);
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-[150px]",
                        isDark && "bg-[#07031D] border-gray-700",
                      )}
                    >
                      <SelectValue placeholder="User type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="creator">Creators</SelectItem>
                      <SelectItem value="advertiser">Advertisers</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={readStatusFilter}
                    onValueChange={(value) => {
                      setReadStatusFilter(value as "all" | "read" | "unread");
                      setRecipientPage(1);
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-[150px]",
                        isDark && "bg-[#07031D] border-gray-700",
                      )}
                    >
                      <SelectValue placeholder="Read status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All read status</SelectItem>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="unread">Unread</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasActiveRecipientFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRecipientSearch("");
                        setUserTypeFilter("all");
                        setReadStatusFilter("all");
                        setRecipientPage(1);
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <RecipientSortableHeader
                        columnId="fullName"
                        label="Name"
                      />
                      <RecipientSortableHeader columnId="email" label="Email" />
                      <RecipientSortableHeader
                        columnId="userTypeAtSend"
                        label="User Type"
                      />
                      <RecipientSortableHeader
                        columnId="deliveryStatus"
                        label="Delivered"
                      />
                      <RecipientSortableHeader
                        columnId="isRead"
                        label="Read status"
                      />
                      <RecipientSortableHeader
                        columnId="readAt"
                        label="Read at"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipientsLoading ? (
                      <RecipientTableSkeletonRows
                        rows={recipientLimit}
                        isDark={isDark}
                      />
                    ) : displayRecipientTotal === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm">
                          No recipients match this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayRecipients.map((r) => (
                        <TableRow key={r.userId}>
                          <TableCell>{r.fullName || "—"}</TableCell>
                          <TableCell className="text-sm">{r.email}</TableCell>
                          <TableCell className="capitalize">
                            {r.userTypeAtSend === "advertiser"
                              ? "Advertiser"
                              : r.userTypeAtSend}
                          </TableCell>
                          <TableCell>
                            {r.deliveryStatus === "delivered"
                              ? "✓ Delivered"
                              : r.deliveryStatus}
                          </TableCell>
                          <TableCell>{readStatusBadge(r)}</TableCell>
                          <TableCell className="text-sm">
                            {r.readAt
                              ? formatWhen(
                                  r.readAt,
                                  null,
                                  "completed",
                                  timezone,
                                )
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {displayRecipientTotal > 0 && (
                <PaginationControls
                  page={recipientPage}
                  limit={recipientLimit}
                  total={displayRecipientTotal}
                  totalPages={displayRecipientTotalPages}
                  hasNextPage={recipientPage < displayRecipientTotalPages}
                  hasPreviousPage={recipientPage > 1}
                  onPageChange={setRecipientPage}
                  onLimitChange={(limit) => {
                    setRecipientLimit(limit);
                    setRecipientPage(1);
                  }}
                  loading={recipientsLoading && !allRecipientsReady}
                  isDark={isDark}
                  pageSizeOptions={[10, 25, 50, 100]}
                  hide200Option
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("rounded-xl shadow", isDark ? "bg-[#170337]" : "bg-white")}
    >
      <CardContent className="px-6 py-4 space-y-4">
        {loading ? (
          <CampaignListSkeleton isDark={isDark} />
        ) : campaigns.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            No notification campaigns yet. Select users on the Table tab and
            send your first announcement.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent at</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Read</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatWhen(
                        c.createdAt,
                        c.scheduledAt,
                        c.status,
                        timezone,
                      )}
                      {c.status === "scheduled" && c.scheduledAt && (
                        <span className="block text-xs text-blue-600">
                          Scheduled
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {c.messageTemplate}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.status === "processing" && c.deliveryProgress ? (
                        <div className="min-w-[140px] max-w-[220px]">
                          <CampaignDeliveryProgressBar
                            progress={c.deliveryProgress}
                            compact
                          />
                        </div>
                      ) : (
                        `${c.recipientCount} users`
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.status === "scheduled" || c.status === "processing"
                        ? "—"
                        : `${c.readCount}/${c.successCount || c.recipientCount}`}
                    </TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {c.status === "scheduled" && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleDeliverNow(c.id)}
                          >
                            Send now
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Cancel schedule"
                            onClick={() => handleCancel(c.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
