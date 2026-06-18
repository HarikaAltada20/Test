"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import type { WarmUpAccountListItem, WarmUpOverview } from "@/lib/admin-email/warm-up";
import { isHealthyAccount } from "@/lib/admin-email/warm-up";
import type { EmailProjectCardData } from "./EmailProjectCard";
import WarmUpManualSendModal from "./WarmUpManualSendModal";
import {
  Activity,
  Flame,
  Loader2,
  Mail,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmailWarmUpSkeleton } from "./EmailSkeletons";

type StatusTab = "all" | "healthy" | "warming" | "paused";

type Props = {
  projects: EmailProjectCardData[];
  isDark?: boolean;
  refreshKey?: number;
  isActive?: boolean;
  onManageSenders?: (projectId: string) => void;
};

type WarmUpCacheEntry = {
  accounts: WarmUpAccountListItem[];
  overview: WarmUpOverview | null;
};

const warmUpDataCache = new Map<string, WarmUpCacheEntry>();


const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "healthy", label: "Healthy" },
  { id: "warming", label: "Warm Up" },
  { id: "paused", label: "Paused" },
];

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

function healthBarColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function statusBadgeClass(status: string, isDark?: boolean) {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "Paused":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100";
    case "Healthy":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
    default:
      return isDark
        ? "bg-gray-800 text-gray-200"
        : "bg-gray-100 text-gray-700 hover:bg-gray-100";
  }
}

export function EmailWarmUpView({
  projects,
  isDark,
  refreshKey = 0,
  isActive = true,
  onManageSenders,
}: Props) {
  const [accounts, setAccounts] = useState<WarmUpAccountListItem[]>([]);
  const [overview, setOverview] = useState<WarmUpOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState(() => projects[0]?.id ?? "all");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [manualSendOpen, setManualSendOpen] = useState(false);
  const [prefillEmails, setPrefillEmails] = useState<string[]>([]);
  const [prefillAccountId, setPrefillAccountId] = useState("");

  const enterSelectMode = () => {
    if (typeof window === "undefined") return;
    const projectId = projectFilter !== "all" ? projectFilter : (projects[0]?.id ?? "");
    sessionStorage.setItem("wu_mode", "1");
    sessionStorage.setItem("wu_project_id", projectId);
    sessionStorage.removeItem("wu_account_id"); // Clear any row-specific prefilled account!
    window.dispatchEvent(new CustomEvent("wu:enter-select-mode"));
  };

  // Load prefilled emails/accountId from sessionStorage (cross-page selection flow)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedEmails = sessionStorage.getItem("wu_emails");
    const storedAccountId = sessionStorage.getItem("wu_account_id");
    if (storedEmails) {
      try {
        const emails = JSON.parse(storedEmails);
        if (emails.length > 0) {
          setPrefillEmails(emails);
          if (storedAccountId) {
            setPrefillAccountId(storedAccountId);
          }
          setManualSendOpen(true);
        }
      } catch (e) {
        console.error("Failed to parse prefilled warm-up emails", e);
      }
      sessionStorage.removeItem("wu_emails");
      sessionStorage.removeItem("wu_account_id");
    }
  }, []);

  // Fallback: When user returns from users table with selected emails, open the modal
  useEffect(() => {
    const handler = (e: Event) => {
      const emails: string[] = (e as CustomEvent<string[]>).detail ?? [];
      if (emails.length > 0) {
        setPrefillEmails(emails);
        setManualSendOpen(true);
      }
    };
    window.addEventListener("wu:users-selected", handler);
    return () => window.removeEventListener("wu:users-selected", handler);
  }, []);
  const { toast } = useToast();

  const resolvedProjectId = useMemo(() => {
    if (projectFilter !== "all") return projectFilter;
    if (projects.length === 1) return projects[0].id;
    return projects[0]?.id ?? null;
  }, [projectFilter, projects]);

  const cacheKey = resolvedProjectId
    ? `${resolvedProjectId}:${refreshKey}`
    : null;

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!resolvedProjectId || !cacheKey) return;

      const cached = warmUpDataCache.get(cacheKey);
      if (cached && !opts?.force) {
        setAccounts(cached.accounts);
        setOverview(cached.overview);
        setLoading(false);
        return;
      }

      if (!cached) setLoading(true);

      try {
        const params = new URLSearchParams({ project_id: resolvedProjectId });
        if (opts?.force) params.set("sync", "1");
        const res = await fetch(`/api/admin/warm-up/dashboard?${params}`);
        const data = await res.json();

        if (res.ok) {
          const nextAccounts = data.accounts ?? [];
          const nextOverview = data.overview ?? null;
          warmUpDataCache.set(cacheKey, {
            accounts: nextAccounts,
            overview: nextOverview,
          });
          setAccounts(nextAccounts);
          setOverview(nextOverview);
        } else {
          toast({
            title: "Could not load warm-up accounts",
            description: data.error || "Request failed",
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [cacheKey, resolvedProjectId, toast],
  );

  useEffect(() => {
    if (projects.length > 0 && projectFilter === "all") {
      setProjectFilter(projects[0].id);
      return;
    }
    if (!isActive || !resolvedProjectId) return;
    void load();
  }, [isActive, load, projectFilter, projects, refreshKey, resolvedProjectId]);

  const openSenderManagement = () => {
    const projectId = projectFilter !== "all" ? projectFilter : projects[0]?.id;
    if (!projectId) {
      toast({
        title: "Select a project",
        description: "Choose a project before adding a sender email.",
        variant: "destructive",
      });
      return;
    }
    onManageSenders?.(projectId);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (statusTab === "healthy" && !isHealthyAccount(account)) return false;
      if (statusTab === "warming" && account.warm_up_status !== "active") {
        return false;
      }
      if (
        statusTab === "paused" &&
        account.warm_up_status !== "paused" &&
        account.warm_up_status !== "pending"
      ) {
        return false;
      }
      if (!q) return true;
      return (
        account.email.toLowerCase().includes(q) ||
        account.display_name.toLowerCase().includes(q)
      );
    });
  }, [accounts, search, statusTab]);

  const handleStart = async (accountId: string) => {
    setActionId(accountId);
    try {
      const res = await fetch(`/api/admin/warm-up/emails/${accountId}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not start warm-up",
          description: data.error || "Start failed",
          variant: "destructive",
        });
        return;
      }
      await load({ force: true });
      toast({ title: "Warm-up started", description: "Account is now warming up." });
    } finally {
      setActionId(null);
    }
  };

  const handlePause = async (accountId: string) => {
    setActionId(accountId);
    try {
      const res = await fetch(`/api/admin/warm-up/emails/${accountId}/pause`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not pause warm-up",
          description: data.error || "Pause failed",
          variant: "destructive",
        });
        return;
      }
      await load({ force: true });
      toast({ title: "Warm-up paused" });
    } finally {
      setActionId(null);
    }
  };

  const cardClass = cn(
    "rounded-xl border shadow-sm",
    isDark ? "bg-[#170337] border-purple-900/40" : "bg-white border-gray-200",
  );

  if (projects.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        Create an email project first to manage warm-up accounts.
      </p>
    );
  }

  return (
    <>
    <WarmUpManualSendModal
      isOpen={manualSendOpen}
      onClose={() => {
        setManualSendOpen(false);
        setPrefillEmails([]);
        setPrefillAccountId("");
      }}
      projectId={projectFilter !== "all" ? projectFilter : (projects[0]?.id ?? "")}
      projects={projects}
      onSuccess={() => { void load({ force: true }); }}
      prefillEmails={prefillEmails}
      prefillAccountId={prefillAccountId}
    />
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-gray-900")}>
            Emails
          </h2>
          <p className="text-sm text-muted-foreground">
            Warm up sender accounts before campaign outreach
          </p>
        </div>
      </div>

      {loading ? (
        <EmailWarmUpSkeleton isDark={isDark} />
      ) : (
        <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Accounts"
          value={overview?.totalAccounts ?? 0}
          icon={<Users className="h-5 w-5 text-purple-600" />}
          iconBg="bg-purple-100"
        />
        <StatCard
          label="Healthy"
          value={overview?.healthy ?? 0}
          icon={<Activity className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-100"
        />
        <StatCard
          label="Warming Up"
          value={overview?.warmingUp ?? 0}
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          iconBg="bg-orange-100"
        />
        <StatCard
          label="Paused"
          value={overview?.paused ?? 0}
          icon={<Pause className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-100"
        />
        <StatCard
          label="Email Sent Today"
          value={overview?.emailsSentToday ?? 0}
          icon={<Mail className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <StatCard
          label="Avg Health Score"
          value={`${overview?.avgHealthScore ?? 0}%`}
          icon={<Activity className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-100"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[220px] h-11 bg-white border-gray-300">
            <SelectValue placeholder="Select Project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "pl-9 h-11 bg-white border-gray-300",
              isDark && "bg-[#12032e] border-purple-900/40",
            )}
          />
        </div>

        <div className="flex flex-wrap gap-2 ml-auto">
          <Button
            variant="outline"
            className="h-11"
            onClick={openSenderManagement}
          >
            Manage Sender Emails
          </Button>
          <Button
            className="h-11 bg-green-600 hover:bg-green-700"
            onClick={enterSelectMode}
          >
            <Send className="h-4 w-4 mr-1" />
            Send Warm-Up Email
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                statusTab === tab.id
                  ? "bg-purple-100 text-purple-700 border-purple-200"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button
          className="bg-purple-600 hover:bg-purple-700"
          onClick={openSenderManagement}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add new
        </Button>
      </div>

      <Card className={cardClass}>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No warm-up accounts match this filter.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health Score</TableHead>
                  <TableHead className="text-center">Warmup Mails</TableHead>
                  <TableHead>Health %</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{account.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.display_name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(account.status_label, isDark)}>
                        {account.status_label}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              healthBarColor(account.current_health_score),
                            )}
                            style={{ width: `${account.current_health_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium tabular-nums shrink-0 w-9 text-right">
                          {account.current_health_score}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {account.emails_sent_today} of {account.daily_limit}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {account.current_health_score}%
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {account.warm_up_status === "active" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-500"
                            disabled={actionId === account.id}
                            onClick={() => handlePause(account.id)}
                            title="Pause warm-up"
                          >
                            {actionId === account.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Flame className="h-4 w-4 fill-orange-500" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={actionId === account.id}
                            onClick={() => handleStart(account.id)}
                            title="Start warm-up"
                          >
                            {actionId === account.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Flame className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {account.warm_up_status === "active" ? (
                              <DropdownMenuItem onClick={() => handlePause(account.id)}>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleStart(account.id)}>
                                <Play className="h-4 w-4 mr-2" />
                                Start warm-up
                              </DropdownMenuItem>
                            )}
                            {/* <DropdownMenuItem
                              onClick={() => {
                                setPrefillAccountId(account.id);
                                setPrefillEmails([]);
                                setManualSendOpen(true);
                              }}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send manual email
                            </DropdownMenuItem> */}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
    </>
  );
}
