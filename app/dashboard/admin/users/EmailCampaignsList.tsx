"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import type { EmailProjectCardData } from "./EmailProjectCard";
import {
  Briefcase,
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
  campaigns: EmailCampaignListItem[];
  projects: EmailProjectCardData[];
  isDark?: boolean;
  onCampaignClick: (campaignId: string) => void;
  onAddNew: () => void;
  onRefresh: () => void;
};

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
  campaigns,
  projects,
  isDark,
  onCampaignClick,
  onAddNew,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<EmailCampaignListItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (projectFilter !== "all" && c.project_id !== projectFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      const projectName = c.project?.name?.toLowerCase() ?? "";
      return (
        c.name.toLowerCase().includes(q) || projectName.includes(q)
      );
    });
  }, [campaigns, search, projectFilter, statusFilter]);

  const summary = useMemo(() => {
    const activeCount = campaigns.filter((c) => c.status === "active").length;
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

    return {
      total: campaigns.length,
      active: activeCount,
      totalOpens,
      avgClickRate: avgClickRate.toFixed(1),
    };
  }, [campaigns]);

  const handleStart = async (campaign: EmailCampaignListItem) => {
    if ((campaign.recipient_count ?? 0) <= 0) {
      toast({
        title: "Add leads first",
        description: "Attach recipients before starting this campaign.",
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Campaigns"
          value={summary.total}
          icon={<Briefcase className="h-5 w-5 text-purple-600" />}
          iconBg="bg-purple-100"
        />
        <StatCard
          label="Active Campaigns"
          value={summary.active}
          icon={<UserPlus className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-100"
        />
        <StatCard
          label="Total Opens"
          value={summary.totalOpens}
          icon={<Eye className="h-5 w-5 text-orange-500" />}
          iconBg="bg-orange-100"
        />
        <StatCard
          label="Avg Click Rate"
          value={`${summary.avgClickRate}%`}
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
              {filtered.map((c) => (
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
                  <td className="p-4 align-middle text-muted-foreground">—</td>
                  <td className="p-4 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      {["paused", "draft", "configured", "scheduled"].includes(
                        c.status,
                      ) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 disabled:opacity-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStart(c);
                          }}
                          disabled={(c.recipient_count ?? 0) <= 0}
                          title={
                            (c.recipient_count ?? 0) <= 0
                              ? "Add leads before starting"
                              : "Start campaign"
                          }
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
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
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-12 text-center text-muted-foreground"
                  >
                    {campaigns.length === 0
                      ? "No campaigns yet. Click Add new to create one."
                      : "No campaigns match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
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
