"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronDown,
  Eye,
  Loader2,
  MessageSquare,
  Search,
  Target,
  Wallet,
} from "lucide-react";
import { FaYoutube, FaTiktok, FaInstagram } from "react-icons/fa";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";
import { AdminDateRangePicker } from "@/components/admin/AdminDateRangePicker";
import {
  formatCompactCount,
  formatCurrencyFromCents,
} from "@/lib/currency-utils";
import {
  ADMIN_ANALYTICS_PLATFORMS,
  ADMIN_ANALYTICS_CONTEST_TYPES,
  ADMIN_ANALYTICS_CONTEST_TYPE_LABELS,
  formatCpmDisplay,
  type AdminAnalyticsContestType,
  type AdminAnalyticsPlatform,
  type AdminAnalyticsSeriesPoint,
  type AdminAnalyticsSummary,
} from "@/lib/admin-analytics";
import { getLastNDaysUtcRange } from "@/lib/admin-date-range";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type ChartMetric = "views" | "likes" | "comments" | "shares";

type CampaignOption = {
  id: string;
  title: string;
  platform?: string | null;
  contest_type?: string | null;
};

type AnalyticsPayload = {
  from: string;
  to: string;
  platforms: AdminAnalyticsPlatform[];
  types?: AdminAnalyticsContestType[];
  summary: AdminAnalyticsSummary;
  series: AdminAnalyticsSeriesPoint[];
  campaigns: CampaignOption[];
  allCampaigns: CampaignOption[];
  selectedCampaignCount: number;
};

const PLATFORM_META: Record<
  AdminAnalyticsPlatform,
  {
    label: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  youtube: { label: "YouTube", icon: FaYoutube },
  tiktok: { label: "TikTok", icon: FaTiktok },
  instagram: { label: "Instagram", icon: FaInstagram },
};

const CHART_TABS: { id: ChartMetric; label: string }[] = [
  { id: "views", label: "Views" },
  { id: "likes", label: "Likes" },
  { id: "comments", label: "Comments" },
  { id: "shares", label: "Shares" },
];

const EMPTY_SUMMARY: AdminAnalyticsSummary = {
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  totalPayoutsCents: 0,
  effectiveCpm: null,
  originalCpm: null,
  cpmEfficient: null,
  totalSubmissions: 0,
  approvedSubmissions: 0,
  approvalRate: 0,
};

function formatRangeLabel(from: Date, to: Date): string {
  return `${format(from, "MMM d")} - ${format(to, "MMM d, yyyy")}`;
}

export default function AdminAnalyticsClient() {
  const { isDark } = useAnalyticsDarkMode();
  const defaultRange = useMemo(() => getLastNDaysUtcRange(30), []);

  const [dateRange, setDateRange] = useState(defaultRange);
  const [dateRangePresetLabel, setDateRangePresetLabel] = useState(
    "Last 30 Days",
  );
  const [platforms, setPlatforms] = useState<AdminAnalyticsPlatform[]>([
    ...ADMIN_ANALYTICS_PLATFORMS,
  ]);
  const [contestTypes, setContestTypes] = useState<AdminAnalyticsContestType[]>([
    ...ADMIN_ANALYTICS_CONTEST_TYPES,
  ]);
  const [selectedContestIds, setSelectedContestIds] = useState<string[]>([]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("views");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  const typesParam = useMemo(
    () =>
      [...contestTypes]
        .sort()
        .join(","),
    [contestTypes],
  );
  const platformsParam = useMemo(
    () => [...platforms].sort().join(","),
    [platforms],
  );
  const contestIdsParam = useMemo(
    () =>
      selectedContestIds.length > 0
        ? [...selectedContestIds].sort().join(",")
        : "",
    [selectedContestIds],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
          platforms: platformsParam,
          types: typesParam,
        });
        if (contestIdsParam) {
          params.set("contestIds", contestIdsParam);
        }
        const res = await fetch(
          `/api/admin/analytics/overview?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load analytics");
        }
        const json = (await res.json()) as AnalyticsPayload;
        if (active) setData(json);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "Failed to load analytics",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    dateRange.from,
    dateRange.to,
    platformsParam,
    typesParam,
    contestIdsParam,
  ]);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const series = data?.series ?? [];
  const allCampaigns = data?.allCampaigns ?? [];

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    if (!q) return allCampaigns;
    return allCampaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [allCampaigns, campaignSearch]);

  const campaignButtonLabel =
    selectedContestIds.length > 0
      ? `${selectedContestIds.length} campaign${selectedContestIds.length === 1 ? "" : "s"}`
      : `${data?.selectedCampaignCount ?? allCampaigns.length} campaigns`;

  const contestTypeButtonLabel =
    contestTypes.length === ADMIN_ANALYTICS_CONTEST_TYPES.length
      ? "All Campaign types"
      : contestTypes.length === 1
        ? ADMIN_ANALYTICS_CONTEST_TYPE_LABELS[contestTypes[0]]
        : `${contestTypes.length} types`;

  const chartTotal = summary[chartMetric] ?? 0;

  const clearCampaignSelection = () => {
    setSelectedContestIds((prev) => (prev.length === 0 ? prev : []));
  };

  const togglePlatform = (platform: AdminAnalyticsPlatform) => {
    setPlatforms((prev) => {
      if (prev.includes(platform)) {
        if (prev.length === 1) {
          toast.message("Keep at least one platform selected");
          return prev;
        }
        return prev.filter((p) => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const setContestTypeChecked = (
    type: AdminAnalyticsContestType,
    checked: boolean,
  ) => {
    setContestTypes((prev) => {
      if (checked) {
        return prev.includes(type) ? prev : [...prev, type];
      }
      if (!prev.includes(type)) return prev;
      if (prev.length === 1) {
        toast.message("Keep at least one campaign type selected");
        return prev;
      }
      return prev.filter((t) => t !== type);
    });
    clearCampaignSelection();
  };

  const setAllContestTypesChecked = (checked: boolean) => {
    if (checked) {
      setContestTypes([...ADMIN_ANALYTICS_CONTEST_TYPES]);
      clearCampaignSelection();
      return;
    }
    // Unchecking "All" is a no-op while controlled as fully selected;
    // users remove types via the individual checkboxes.
  };

  const allCampaignIds = useMemo(
    () => allCampaigns.map((c) => c.id),
    [allCampaigns],
  );

  const isCampaignChecked = (id: string) =>
    selectedContestIds.length === 0 || selectedContestIds.includes(id);

  const setCampaignChecked = (id: string, checked: boolean) => {
    // Empty selection means "all campaigns"
    if (selectedContestIds.length === 0) {
      if (!checked) {
        // Uncheck one while all selected → all except this campaign
        const next = allCampaignIds.filter((campaignId) => campaignId !== id);
        if (next.length === 0) {
          toast.message("Keep at least one campaign selected");
          return;
        }
        setSelectedContestIds(next);
      }
      return;
    }

    if (checked) {
      const next = selectedContestIds.includes(id)
        ? selectedContestIds
        : [...selectedContestIds, id];
      // If every campaign is selected again, collapse back to "all"
      if (
        allCampaignIds.length > 0 &&
        allCampaignIds.every((campaignId) => next.includes(campaignId))
      ) {
        setSelectedContestIds([]);
      } else {
        setSelectedContestIds(next);
      }
      return;
    }

    const next = selectedContestIds.filter((campaignId) => campaignId !== id);
    if (next.length === 0) {
      toast.message("Keep at least one campaign selected");
      return;
    }
    setSelectedContestIds(next);
  };

  const setAllCampaignsChecked = (checked: boolean) => {
    if (checked) {
      setSelectedContestIds([]);
    }
    // Unchecking "All" is a no-op; deselect via individual checkboxes.
  };

  const cardClass = cn(
    "rounded-2xl border p-4 sm:p-5",
    isDark
      ? "border-white/10 bg-[#121212] text-white"
      : "border-black/5 bg-white text-black shadow-[0px_5px_20px_0px_#0000000D]",
  );

  const pillClass = cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
    isDark
      ? "border-white/10 bg-[#1a1a1a] text-white hover:bg-white/10"
      : "border-black/10 bg-white text-black hover:bg-black/5",
  );

  return (
    <div
      className={cn(
        "relative min-h-[calc(100vh-4rem)] w-full px-3 py-4 sm:px-6 sm:py-6",
        isDark ? "text-white" : "text-black",
      )}
    >
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Analytics
          </h1>
          <p
            className={cn(
              "mt-1 text-sm",
              isDark ? "text-white/50" : "text-black/50",
            )}
          >
            {formatRangeLabel(dateRange.from, dateRange.to)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {/* Platform toggles */}
          <div className="flex items-center gap-1.5">
            {ADMIN_ANALYTICS_PLATFORMS.map((key) => {
              const meta = PLATFORM_META[key];
              const Icon = meta.icon;
              const active = platforms.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  title={meta.label}
                  onClick={() => togglePlatform(key)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border transition-all",
                    active
                      ? isDark
                        ? "border-[#7F39EC] bg-[#7F39EC]/25 text-white"
                        : "border-[#7F39EC] bg-[#7F39EC]/15 text-[#4A00BE]"
                      : isDark
                        ? "border-white/10 bg-[#1a1a1a] text-white/70 hover:bg-white/10"
                        : "border-black/10 bg-white text-black/60 hover:bg-black/5",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          <AdminDateRangePicker
            isDark={isDark}
            value={dateRange}
            presetLabel={dateRangePresetLabel}
            onChange={(next, label) => {
              setDateRange(next);
              setDateRangePresetLabel(label);
            }}
            triggerClassName={cn(pillClass, "h-10")}
            align="end"
          />

          {/* Contest types */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  pillClass,
                  "h-auto min-h-10 py-1.5 flex items-center justify-between gap-2 max-w-full text-left",
                )}
              >
                <span className="whitespace-normal break-words">
                  {contestTypeButtonLabel}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(
                "w-56 bg-white border border-black/5 text-black shadow-lg dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white",
              )}
            >
              <DropdownMenuLabel>Campaign types</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={
                  contestTypes.length === ADMIN_ANALYTICS_CONTEST_TYPES.length
                }
                onCheckedChange={(checked) =>
                  setAllContestTypesChecked(checked === true)
                }
                onSelect={(e) => e.preventDefault()}
              >
                All Campaign types
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {ADMIN_ANALYTICS_CONTEST_TYPES.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={contestTypes.includes(type)}
                  onCheckedChange={(checked) =>
                    setContestTypeChecked(type, checked === true)
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {ADMIN_ANALYTICS_CONTEST_TYPE_LABELS[type]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Campaigns */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(pillClass, "h-10")}>
                <span className="max-w-[140px] truncate">
                  {campaignButtonLabel}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(e) => e.preventDefault()}
              className={cn(
                "w-80 bg-white border border-black/5 text-black shadow-lg dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white",
              )}
            >
              <DropdownMenuLabel>Campaigns</DropdownMenuLabel>
              <div
                className="px-2 pb-2"
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 opacity-40" />
                  <Input
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="Search campaigns…"
                    autoComplete="off"
                    className={cn(
                      "h-9 pl-8",
                      isDark && "border-white/10 bg-[#121212]",
                    )}
                  />
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={selectedContestIds.length === 0}
                onCheckedChange={(checked) =>
                  setAllCampaignsChecked(checked === true)
                }
                onSelect={(e) => e.preventDefault()}
              >
                All campaigns
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <div className="max-h-64 overflow-y-auto">
                {filteredCampaigns.length === 0 ? (
                  <p className="px-3 py-4 text-sm opacity-50">
                    No campaigns found
                  </p>
                ) : (
                  filteredCampaigns.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={isCampaignChecked(c.id)}
                      onCheckedChange={(checked) =>
                        setCampaignChecked(c.id, checked === true)
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      <span className="whitespace-normal break-words">
                        {c.title}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cardClass}>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                isDark ? "bg-white/10" : "bg-[#D8C3FF]",
              )}
            >
              <Eye
                className={cn(
                  "h-4 w-4",
                  isDark ? "text-white" : "text-[#4A00BE]",
                )}
              />
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white/60" : "text-black/55",
              )}
            >
              Views
            </span>
          </div>
          <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {loading ? "…" : summary.views.toLocaleString()}
          </p>
        </div>

        <div className={cardClass}>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                isDark ? "bg-white/10" : "bg-[#D8C3FF]",
              )}
            >
              <Wallet
                className={cn(
                  "h-4 w-4",
                  isDark ? "text-white" : "text-[#4A00BE]",
                )}
              />
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white/60" : "text-black/55",
              )}
            >
              Total Payouts (Gross)
            </span>
          </div>
          <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {loading ? "…" : formatCurrencyFromCents(summary.totalPayoutsCents)}
          </p>
        </div>

        <div className={cardClass}>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                isDark ? "bg-white/10" : "bg-[#D8C3FF]",
              )}
            >
              <Target
                className={cn(
                  "h-4 w-4",
                  isDark ? "text-white" : "text-[#4A00BE]",
                )}
              />
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white/60" : "text-black/55",
              )}
            >
              CPM
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-white/45" : "text-black/45",
                )}
              >
                Effective CPM
              </p>
              <p className="text-lg font-semibold">
                {loading ? "…" : formatCpmDisplay(summary.effectiveCpm)}
              </p>
            </div>
            <div>
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-white/45" : "text-black/45",
                )}
              >
                Original CPM
              </p>
              <p className="text-lg font-semibold">
                {loading ? "…" : formatCpmDisplay(summary.originalCpm)}
              </p>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  isDark ? "bg-white/10" : "bg-[#D8C3FF]",
                )}
              >
                <MessageSquare
                  className={cn(
                    "h-4 w-4",
                    isDark ? "text-white" : "text-[#4A00BE]",
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-white/60" : "text-black/55",
                )}
              >
                Submissions
              </span>
            </div>
            <span className="text-lg font-semibold text-orange-400">
              {loading ? "…" : `${summary.approvalRate}%`}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-white/45" : "text-black/45",
                )}
              >
                Total
              </p>
              <p className="text-lg font-semibold">
                {loading ? "…" : summary.totalSubmissions.toLocaleString()}
              </p>
            </div>
            <div>
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-white/45" : "text-black/45",
                )}
              >
                Approved
              </p>
              <p className="text-lg font-semibold">
                {loading ? "…" : summary.approvedSubmissions.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart card */}
      <div className={cn(cardClass, "min-h-[420px]")}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white/55" : "text-black/55",
              )}
            >
              {selectedContestIds.length === 1
                ? allCampaigns.find((c) => c.id === selectedContestIds[0])
                    ?.title || "Campaign"
                : "All Campaigns"}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {loading ? "…" : chartTotal.toLocaleString()}
            </p>
          </div>

          <div
            className={cn(
              "inline-flex flex-wrap gap-1 rounded-full border p-1",
              isDark ? "border-white/10 bg-[#0d0d0d]" : "border-black/10 bg-[#f5f5f5]",
            )}
          >
            {CHART_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartMetric(tab.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  chartMetric === tab.id
                    ? "bg-[#7F39EC] text-white"
                    : isDark
                      ? "text-white/60 hover:text-white"
                      : "text-black/55 hover:text-black",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-[320px] w-full sm:h-[380px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-inherit/40">
              <Loader2 className="h-7 w-7 animate-spin text-[#7F39EC]" />
            </div>
          )}
          {!loading && series.length === 0 ? (
            <div
              className={cn(
                "flex h-full items-center justify-center text-sm",
                isDark ? "text-white/40" : "text-black/40",
              )}
            >
              No submission activity in this range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={series}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="adminAnalyticsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7F39EC" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#7F39EC" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tick={{
                    fill: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                    fontSize: 12,
                  }}
                />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) => formatCompactCount(Number(v))}
                  tick={{
                    fill: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: isDark ? "#1a1a1a" : "#fff",
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 12,
                    color: isDark ? "#fff" : "#000",
                  }}
                  formatter={(value: number) => [
                    Number(value).toLocaleString(),
                    CHART_TABS.find((t) => t.id === chartMetric)?.label ||
                      chartMetric,
                  ]}
                  labelFormatter={(label) => String(label)}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="#7F39EC"
                  strokeWidth={2.5}
                  fill="url(#adminAnalyticsFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#7F39EC" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
