"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAdminScheduledNotificationDelivery,
  useSyncScheduledCampaignTimers,
} from "@/hooks/useAdminScheduledNotificationDelivery";
import { setScheduledDeliveryListener } from "@/lib/admin-notifications/client-delivery-scheduler";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, X } from "lucide-react";

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
  const d = new Date(
    status === "scheduled" && scheduledAt ? scheduledAt : iso,
  );
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
  const [detailTab, setDetailTab] = useState("all");
  const [summary, setSummary] = useState<{
    sent: number;
    read: number;
    readPercent: number;
    byType: Record<string, { sent: number; read: number }>;
  } | null>(null);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [campaignMeta, setCampaignMeta] = useState<{
    messageTemplate: string;
    status: string;
  } | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications/campaigns?limit=50");
      const data = await res.json();
      if (res.ok) {
        setCampaigns(data.campaigns ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    setScheduledDeliveryListener(() => {
      void loadCampaigns();
    });
    return () => setScheduledDeliveryListener(null);
  }, [loadCampaigns]);

  useSyncScheduledCampaignTimers(campaigns, true);

  useEffect(() => {
    if (highlightCampaignId) {
      setSelectedId(highlightCampaignId);
      onHighlightConsumed?.();
    }
  }, [highlightCampaignId, onHighlightConsumed]);

  const loadDetail = useCallback(
    async (campaignId: string, tab: string) => {
      setDetailLoading(true);
      try {
        const params = new URLSearchParams();
        if (tab === "creators") params.set("userType", "creator");
        if (tab === "brands") params.set("userType", "advertiser");
        if (tab === "unread") params.set("readFilter", "unread");
        const res = await fetch(
          `/api/admin/notifications/campaigns/${campaignId}?${params}`,
        );
        const data = await res.json();
        if (res.ok) {
          setSummary(data.summary);
          setRecipients(data.recipients ?? []);
          setCampaignMeta({
            messageTemplate: data.campaign.messageTemplate,
            status: data.campaign.status,
          });
        }
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId, detailTab);
    }
  }, [selectedId, detailTab, loadDetail]);

  const handleCancel = async (campaignId: string) => {
    const res = await fetch(
      `/api/admin/notifications/campaigns/${campaignId}/cancel`,
      { method: "PATCH" },
    );
    if (res.ok) {
      await loadCampaigns();
      if (selectedId === campaignId) {
        await loadDetail(campaignId, detailTab);
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
        await loadDetail(campaignId, detailTab);
      }
    }
  };

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
              setDetailTab("all");
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            All notifications
          </Button>

          {campaignMeta && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {campaignMeta.messageTemplate}
            </p>
          )}

          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-semibold">{summary.sent}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-semibold">
                  {summary.read} ({summary.readPercent}%)
                </p>
                <p className="text-xs text-muted-foreground">Read</p>
              </div>
              {summary.byType.creator?.sent > 0 && (
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-sm font-semibold">
                    Creators: {summary.byType.creator.read}/
                    {summary.byType.creator.sent} read
                  </p>
                </div>
              )}
              {summary.byType.advertiser?.sent > 0 && (
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-sm font-semibold">
                    Brands: {summary.byType.advertiser.read}/
                    {summary.byType.advertiser.sent} read
                  </p>
                </div>
              )}
            </div>
          )}

          <EnhancedTabs
            tabs={[
              { id: "all", label: "All" },
              { id: "creators", label: "Creators" },
              { id: "brands", label: "Brands" },
              { id: "unread", label: "Unread only" },
            ]}
            activeTab={detailTab}
            onTabChange={setDetailTab}
            isDark={isDark}
          />

          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Read status</TableHead>
                    <TableHead>Read at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm">
                        No recipients match this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recipients.map((r) => (
                      <TableRow key={r.userId}>
                        <TableCell>{r.fullName || "—"}</TableCell>
                        <TableCell className="text-sm">{r.email}</TableCell>
                        <TableCell className="capitalize">
                          {r.userTypeAtSend === "advertiser"
                            ? "Brand"
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
                            ? formatWhen(r.readAt, null, "completed", timezone)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
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
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
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
                  <TableHead>When</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Audience</TableHead>
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
                      {formatWhen(c.createdAt, c.scheduledAt, c.status, timezone)}
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
                      {c.recipientCount} users
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.status === "scheduled"
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
