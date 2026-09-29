"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { cn } from "@/lib/utils";
import type { EmailCampaignListItem } from "@/lib/admin-email/campaign-list";
import { getCampaignStartReadiness } from "@/lib/admin-email/campaign-readiness";
import type { EmailProjectCardData } from "./EmailProjectCard";
import {
  Briefcase,
  Copy,
  Eye,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  projects: EmailProjectCardData[];
  isDark?: boolean;
  refreshKey?: number;
  onTotalChange?: (total: number) => void;
  onCampaignClick: (campaignId: string) => void;
  onAddNew: () => void;
  onRefresh: () => void;
};

const DEFAULT_PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "configured", label: "Configured" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "partial", label: "Partial" },
];

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "paused":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100";
    case "completed":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "scheduled":
      return "bg-purple-100 text-purple-800 hover:bg-purple-100";
    default:
      return "bg-gray-100 text-gray-700 hover:bg-gray-100";
  }
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconBg: string;
}) {
  return (
    <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
            iconBg,
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmailCampaignsList({
  projects,
  isDark,
  refreshKey = 0,
  onTotalChange,
  onCampaignClick,
  onAddNew,
  onRefresh,
}: Props) {
  const [campaigns, setCampaigns] = useState<EmailCampaignListItem[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listSummary, setListSummary] = useState({ total: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<EmailCampaignListItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [projectFilter, statusFilter, debouncedSearch, limit]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (projectFilter !== "all") params.set("projectId", projectFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

    fetch(`/api/admin/email-campaigns?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          toast({
            title: "Could not load campaigns",
            description: data.error,
            variant: "destructive",
          });
          return;
        }
        setCampaigns(data.campaigns ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setListSummary(data.summary ?? { total: data.total ?? 0, active: 0 });
        onTotalChange?.(data.total ?? 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onTotalChange/toast are stable enough
  }, [
    page,
    limit,
    projectFilter,
    statusFilter,
    debouncedSearch,
    refreshKey,
  ]);

  const pageStats = useMemo(() => {
    const totalOpens = campaigns.reduce(
      (sum, c) => sum + c.stats.openCount,
      0,
    );
    const clickRates = campaigns
      .filter((c) => c.sent_count > 0)
      .map((c) => c.stats.clickRate);
    const avgClickRate =
      clickRates.length > 0
        ? (clickRates.reduce((a, b) => a + b, 0) / clickRates.length) * 100
        : 0;
    return { totalOpens, avgClickRate: avgClickRate.toFixed(1) };
  }, [campaigns]);

  const handleStart = async (campaign: EmailCampaignListItem) => {
    const readiness = getCampaignStartReadiness({
      recipientCount: campaign.recipient_count,
      emailSubject: campaign.email_subject,
      messageTemplate: campaign.message_template,
      fromEmail: campaign.from_email,
    });
    if (!readiness.canStart) {
      toast({
        title: "Campaign not ready",
        description: readiness.disabledReason ?? "Complete setup before starting",
        variant: "destructive",
      });
      return;
    }
    const res = await fetch(`/api/admin/email-campaigns/${campaign.id}/start`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast({
        title: "Could not start campaign",
        description: data.error || "Start failed",
        variant: "destructive",
      });
      return;
    }
    onRefresh();
  };

  const handlePause = async (campaignId: string) => {
    await fetch(`/api/admin/email-campaigns/${campaignId}/pause`, {
      method: "POST",
    });
    onRefresh();
  };

  const handleDuplicate = async (campaign: EmailCampaignListItem) => {
    setDuplicatingId(campaign.id);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaign.id}/duplicate`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not duplicate campaign",
          description: data.error || "Duplicate failed",
          variant: "destructive",
        });
        return;
      }
      onRefresh();
      toast({
        title: "Campaign duplicated",
        description:
          data.copiedRecipientCount > 0
            ? `"${data.campaign.name}" was created with ${data.copiedRecipientCount} leads.`
            : `"${data.campaign.name}" was created as a copy.`,
      });
      onCampaignClick(data.campaign.id);
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not delete campaign",
          description: data.error || "Delete failed",
          variant: "destructive",
        });
        return;
      }
      setDeleteTarget(null);
      onRefresh();
      toast({
        title: "Campaign deleted",
        description: `"${deleteTarget.name}" was removed.`,
      });
    } finally {
      setDeleting(false);
    }
  };

  const projectFilterLabel = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    if (!p) return "All Projects";
    const verified = p.ses_verification_status === "verified";
    return verified ? `${p.name} (Verified)` : p.name;
  };

  const cardClass = cn(
    "rounded-xl border shadow-sm",
    isDark ? "bg-[#170337] border-purple-900/40" : "bg-white border-gray-200",
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          label="Total Campaigns"
          value={listSummary.total}
          icon={<Briefcase className="h-5 w-5 text-purple-600" />}
          iconBg="bg-purple-100"
        />
        {/* <StatCard
          label="Active Campaigns"
          value={listSummary.active}
          icon={<UserPlus className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-100"
        /> */}
        <StatCard
          label="Opens"
          value={pageStats.totalOpens}
          icon={<Eye className="h-5 w-5 text-orange-500" />}
          iconBg="bg-orange-100"
        />
        <StatCard
          label="Avg Click"
          value={`${pageStats.avgClickRate}%`}
          icon={<Send className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-100"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "pl-9 h-11 bg-white border-gray-300",
              isDark && "bg-[#12032e] border-purple-900/40",
            )}
          />
        </div>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[220px] h-11 bg-white border-gray-300">
            <SelectValue>
              {projectFilter === "all"
                ? "All Projects"
                : projectFilterLabel(projectFilter)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.ses_verification_status === "verified"
                  ? `${p.name} (Verified)`
                  : p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-11 bg-white border-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="h-11 bg-[#662EBD] hover:bg-[#5524a8] shrink-0"
          onClick={onAddNew}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add new
        </Button>
      </div>

      <Card className={cardClass}>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-4 text-left font-medium">Campaign</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-left font-medium min-w-[120px]">
                  Progress
                </th>
                <th className="p-4 text-left font-medium">Sent</th>
                <th className="p-4 text-left font-medium">Click</th>
                <th className="p-4 text-left font-medium">Replies</th>
                <th className="p-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="p-4">
                        <div className="h-4 w-20 rounded-md bg-muted animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                campaigns.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td
                    className="p-4 align-middle cursor-pointer"
                    onClick={() => onCampaignClick(c.id)}
                  >
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {c.project?.name ?? "—"}
                    </p>
                  </td>
                  <td className="p-4 align-middle">
                    <Badge className={cn("capitalize", statusBadgeClass(c.status))}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="p-4 align-middle min-w-[120px]">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {Math.round(c.stats.progressPercent)}%
                      </p>
                      <Progress
                        value={c.stats.progressPercent}
                        className="h-1.5"
                      />
                    </div>
                  </td>
                  <td className="p-4 align-middle text-muted-foreground">
                    {c.sent_count > 0 ? c.sent_count : "—"}
                  </td>
                  <td className="p-4 align-middle text-muted-foreground">
                    {c.stats.clickCount > 0
                      ? `${(c.stats.clickRate * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="p-4 align-middle text-muted-foreground">
                    {c.stats.replyCount > 0 ? c.stats.replyCount : "—"}
                  </td>
                  <td className="p-4 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      {["paused", "draft", "configured", "scheduled"].includes(
                        c.status,
                      ) && (() => {
                        const readiness = getCampaignStartReadiness({
                          recipientCount: c.recipient_count,
                          emailSubject: c.email_subject,
                          messageTemplate: c.message_template,
                          fromEmail: c.from_email,
                        });
                        return (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 disabled:opacity-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStart(c);
                          }}
                          disabled={!readiness.canStart}
                          title={
                            readiness.disabledReason ?? "Start campaign"
                          }
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        );
                      })()}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onCampaignClick(c.id)}
                          >
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={duplicatingId === c.id}
                            onClick={() => void handleDuplicate(c)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            {duplicatingId === c.id ? "Duplicating..." : "Duplicate"}
                          </DropdownMenuItem>
                          {c.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => handlePause(c.id)}
                            >
                              Pause
                            </DropdownMenuItem>
                          )}
                          {c.status !== "active" && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeleteTarget(c)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && campaigns.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-12 text-center text-muted-foreground"
                  >
                    {total === 0 &&
                    !debouncedSearch &&
                    projectFilter === "all" &&
                    statusFilter === "all"
                      ? "No campaigns yet. Click Add new to create one."
                      : "No campaigns match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
        {total > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <PaginationControls
              page={page}
              limit={limit}
              total={total}
              totalPages={totalPages}
              hasNextPage={page < totalPages}
              hasPreviousPage={page > 1}
              onPageChange={setPage}
              onLimitChange={setLimit}
              loading={loading}
              isDark={isDark}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </div>
        )}
      </Card>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot; and
              all of its leads, sequence, and tracking data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
