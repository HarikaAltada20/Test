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
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle,
  ChevronDown,
  Clock,
  Eye,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Wallet,
  XCircle,
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
  ADMIN_ANALYTICS_STATUS_FILTERS,
  ADMIN_ANALYTICS_STATUS_CARDS,
  expandStatusFilterIds,
  formatCpmDisplay,
  type AdminAnalyticsAdvertiserOption,
  type AdminAnalyticsContestType,
  type AdminAnalyticsPlatform,
  type AdminAnalyticsSeriesPoint,
  type AdminAnalyticsStatusCardId,
  type AdminAnalyticsStatusFilterId,
  type AdminAnalyticsSummary,
  type AdminAnalyticsViewsByStatus,
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
  advertiser_id?: string | null;
};

type AnalyticsPayload = {
  from: string;
  to: string;
  platforms: AdminAnalyticsPlatform[];
  types?: AdminAnalyticsContestType[];
  statuses?: string[];
  advertiserIds?: string[];
  summary: AdminAnalyticsSummary;
  series: AdminAnalyticsSeriesPoint[];
  viewsByStatus?: AdminAnalyticsViewsByStatus;
  campaigns: CampaignOption[];
  allAdvertisers?: AdminAnalyticsAdvertiserOption[];
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

type AnalyticsMetricCardId =
  | "views"
  | "total_payouts"
  | "effective_cpm"
  | "submissions"
  | AdminAnalyticsStatusCardId;

const METRIC_CARD_OPTIONS: { id: AnalyticsMetricCardId; label: string }[] = [
  { id: "views", label: "Views" },
  { id: "total_payouts", label: "Total Payouts" },
  { id: "effective_cpm", label: "Effective CPM" },
  { id: "submissions", label: "Submissions" },
  { id: "pending", label: "Pending Views" },
  { id: "verified", label: "Verified Views" },
  { id: "paid", label: "Paid Views" },
  { id: "rejected", label: "Rejected Views" },
  { id: "not_rejected", label: "Non Rejected Views" },
  { id: "verified_paid", label: "Verified + Paid Views" },
];

const DEFAULT_VISIBLE_CARDS: AnalyticsMetricCardId[] = METRIC_CARD_OPTIONS.map(
  (c) => c.id,
);

const STATUS_CARD_ICONS: Record<
  AdminAnalyticsStatusCardId,
  ComponentType<{ className?: string }>
> = {
  pending: Clock,
  verified: CheckCircle,
  paid: Wallet,
  rejected: XCircle,
  not_rejected: ShieldCheck,
  verified_paid: CheckCircle,
};

const EMPTY_SUMMARY: AdminAnalyticsSummary = {
  views: 0,
  filteredViews: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  totalPayoutsCents: 0,
  effectiveCpm: null,
  totalSubmissions: 0,
  approvedSubmissions: 0,
  approvalRate: 0,
};

const EMPTY_VIEWS_BY_STATUS: AdminAnalyticsViewsByStatus = {
  all: 0,
  pending: 0,
  verified: 0,
  paid: 0,
  rejected: 0,
  notRejected: 0,
  verifiedPaid: 0,
};

function viewsForStatusCard(
  id: AdminAnalyticsStatusCardId,
  viewsByStatus: AdminAnalyticsViewsByStatus,
): number {
  switch (id) {
    case "pending":
      return viewsByStatus.pending;
    case "verified":
      return viewsByStatus.verified;
    case "paid":
      return viewsByStatus.paid;
    case "rejected":
      return viewsByStatus.rejected;
    case "not_rejected":
      return viewsByStatus.notRejected;
    case "verified_paid":
      return viewsByStatus.verifiedPaid;
    default:
      return 0;
  }
}

const STATUS_SERIES: {
  id: AdminAnalyticsStatusFilterId;
  dataKey: keyof AdminAnalyticsSeriesPoint;
  color: string;
  label: string;
}[] = [
  {
    id: "pending",
    dataKey: "pendingViews",
    color: "#F59E0B",
    label: "Pending Views",
  },
  {
    id: "verified",
    dataKey: "verifiedViews",
    color: "#22C55E",
    label: "Verified Views",
  },
  {
    id: "paid",
    dataKey: "paidViews",
    color: "#3B82F6",
    label: "Paid Views",
  },
  {
    id: "rejected",
    dataKey: "rejectedViews",
    color: "#EF4444",
    label: "Rejected Views",
  },
];

function formatRangeLabel(from: Date, to: Date): string {
  return `${format(from, "MMM d")} - ${format(to, "MMM d, yyyy")}`;
}

function AnalyticsChartTooltip({
  active,
  payload,
  label,
  isDark,
  chartMetric,
  statusSeries,
}: {
  active?: boolean;
  payload?: Array<{ payload?: AdminAnalyticsSeriesPoint }>;
  label?: string;
  isDark: boolean;
  chartMetric: ChartMetric;
  statusSeries: typeof STATUS_SERIES;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const metricLabel =
    CHART_TABS.find((t) => t.id === chartMetric)?.label || chartMetric;
  const metricValue = Number(row[chartMetric] ?? 0);

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 shadow-lg text-sm",
        isDark
          ? "border-white/10 bg-[#1a1a1a] text-white"
          : "border-black/10 bg-white text-black",
      )}
    >
      <p className="font-medium mb-1.5">{String(label)}</p>
      <p className="text-[#7F39EC] mb-1">
        {metricLabel} : {metricValue.toLocaleString()}
      </p>
      {chartMetric === "views" && statusSeries.length > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-black/5 dark:border-white/10">
          {statusSeries.map((s) => (
            <p key={s.id} style={{ color: s.color }}>
              {s.label} : {Number(row[s.dataKey] ?? 0).toLocaleString()}
            </p>
          ))}
        </div>
      )}
    </div>
  );
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
  const [selectedAdvertiserIds, setSelectedAdvertiserIds] = useState<
    string[] | null
  >(null);
  const [selectedContestIds, setSelectedContestIds] = useState<string[] | null>(
    null,
  );
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<
    AdminAnalyticsStatusFilterId[]
  >(ADMIN_ANALYTICS_STATUS_FILTERS.map((f) => f.id));
  const [advertiserSearch, setAdvertiserSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [visibleCards, setVisibleCards] = useState<AnalyticsMetricCardId[]>(
    DEFAULT_VISIBLE_CARDS,
  );
  const [chartMetric, setChartMetric] = useState<ChartMetric>("views");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsPayload | null>(null);

  const typesParam = useMemo(() => {
    if (contestTypes.length === 0) return "__none__";
    if (contestTypes.length === ADMIN_ANALYTICS_CONTEST_TYPES.length) {
      return [...contestTypes].sort().join(",");
    }
    return [...contestTypes].sort().join(",");
  }, [contestTypes]);
  const platformsParam = useMemo(
    () => [...platforms].sort().join(","),
    [platforms],
  );
  const statusesParam = useMemo(() => {
    if (selectedStatusFilters.length === 0) return "__none__";
    return expandStatusFilterIds(selectedStatusFilters).sort().join(",");
  }, [selectedStatusFilters]);
  const advertiserIdsParam = useMemo(() => {
    if (selectedAdvertiserIds === null) return "";
    if (selectedAdvertiserIds.length === 0) return "__none__";
    return [...selectedAdvertiserIds].sort().join(",");
  }, [selectedAdvertiserIds]);
  const contestIdsParam = useMemo(() => {
    if (selectedContestIds === null) return "";
    if (selectedContestIds.length === 0) return "__none__";
    return [...selectedContestIds].sort().join(",");
  }, [selectedContestIds]);

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
          statuses: statusesParam,
        });
        if (advertiserIdsParam) {
          params.set("advertiserIds", advertiserIdsParam);
        }
        if (contestIdsParam) {
          params.set("contestIds", contestIdsParam);
        }
        const res = await fetch(
          `/api/admin/analytics/overview?${params.toString()}`,
          { signal: controller.signal, cache: "no-store" },
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
    statusesParam,
    advertiserIdsParam,
    contestIdsParam,
  ]);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const series = data?.series ?? [];
  const allAdvertisers = data?.allAdvertisers ?? [];
  const allCampaigns = data?.allCampaigns ?? [];
  const viewsByStatus = data?.viewsByStatus ?? EMPTY_VIEWS_BY_STATUS;

  // Drop advertiser/campaign picks that are no longer in the current scope
  useEffect(() => {
    setSelectedAdvertiserIds((prev) => {
      if (prev === null || prev.length === 0 || allAdvertisers.length === 0) {
        return prev;
      }
      const valid = new Set(allAdvertisers.map((a) => a.id));
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [allAdvertisers]);

  useEffect(() => {
    setSelectedContestIds((prev) => {
      if (prev === null || prev.length === 0 || allCampaigns.length === 0) {
        return prev;
      }
      const valid = new Set(allCampaigns.map((c) => c.id));
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [allCampaigns]);

  const filteredAdvertisers = useMemo(() => {
    const q = advertiserSearch.trim().toLowerCase();
    if (!q) return allAdvertisers;
    return allAdvertisers.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
    );
  }, [allAdvertisers, advertiserSearch]);

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    if (!q) return allCampaigns;
    return allCampaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [allCampaigns, campaignSearch]);

  const advertiserButtonLabel =
    selectedAdvertiserIds === null
      ? `${allAdvertisers.length} advertisers`
      : selectedAdvertiserIds.length === 0
        ? "No advertisers"
        : selectedAdvertiserIds.length === 1
          ? allAdvertisers.find((a) => a.id === selectedAdvertiserIds[0])
              ?.name || "1 advertiser"
          : `${selectedAdvertiserIds.length} advertisers`;

  const campaignButtonLabel =
    selectedContestIds === null
      ? `${data?.selectedCampaignCount ?? allCampaigns.length} campaigns`
      : selectedContestIds.length === 0
        ? "No campaigns"
        : `${selectedContestIds.length} campaign${selectedContestIds.length === 1 ? "" : "s"}`;

  const contestTypeButtonLabel =
    contestTypes.length === 0
      ? "No campaign types"
      : contestTypes.length === ADMIN_ANALYTICS_CONTEST_TYPES.length
        ? "All Campaign types"
        : contestTypes.length === 1
          ? ADMIN_ANALYTICS_CONTEST_TYPE_LABELS[contestTypes[0]]
          : `${contestTypes.length} types`;

  const statusButtonLabel =
    selectedStatusFilters.length === 0
      ? "No view statuses"
      : selectedStatusFilters.length === ADMIN_ANALYTICS_STATUS_FILTERS.length
        ? "All view statuses"
        : selectedStatusFilters.length === 1
          ? ADMIN_ANALYTICS_STATUS_FILTERS.find(
              (f) => f.id === selectedStatusFilters[0],
            )?.label || "1 status"
          : `${selectedStatusFilters.length} statuses`;

  const chartTotal =
    chartMetric === "views"
      ? (summary.filteredViews ?? summary.views)
      : (summary[chartMetric] ?? 0);

  const visibleStatusSeries = useMemo(
    () =>
      STATUS_SERIES.filter((s) => selectedStatusFilters.includes(s.id)),
    [selectedStatusFilters],
  );

  const clearCampaignSelection = () => {
    setSelectedContestIds((prev) => (prev === null ? prev : null));
  };

  const clearAdvertiserSelection = () => {
    setSelectedAdvertiserIds((prev) => (prev === null ? prev : null));
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
      return prev.filter((t) => t !== type);
    });
    clearCampaignSelection();
  };

  const setAllContestTypesChecked = (checked: boolean) => {
    if (checked) {
      setContestTypes([...ADMIN_ANALYTICS_CONTEST_TYPES]);
    } else {
      setContestTypes([]);
    }
    clearCampaignSelection();
  };

  const allAdvertiserIds = useMemo(
    () => allAdvertisers.map((a) => a.id),
    [allAdvertisers],
  );

  const isAdvertiserChecked = (id: string) =>
    selectedAdvertiserIds === null || selectedAdvertiserIds.includes(id);

  const setAdvertiserChecked = (id: string, checked: boolean) => {
    if (selectedAdvertiserIds === null) {
      if (!checked) {
        setSelectedAdvertiserIds(
          allAdvertiserIds.filter((advertiserId) => advertiserId !== id),
        );
        clearCampaignSelection();
      }
      return;
    }

    if (checked) {
      const next = selectedAdvertiserIds.includes(id)
        ? selectedAdvertiserIds
        : [...selectedAdvertiserIds, id];
      if (
        allAdvertiserIds.length > 0 &&
        allAdvertiserIds.every((advertiserId) => next.includes(advertiserId))
      ) {
        setSelectedAdvertiserIds(null);
      } else {
        setSelectedAdvertiserIds(next);
      }
      clearCampaignSelection();
      return;
    }

    setSelectedAdvertiserIds(
      selectedAdvertiserIds.filter((advertiserId) => advertiserId !== id),
    );
    clearCampaignSelection();
  };

  const setAllAdvertisersChecked = (checked: boolean) => {
    if (checked) {
      setSelectedAdvertiserIds(null);
    } else {
      setSelectedAdvertiserIds([]);
    }
    clearCampaignSelection();
  };

  const allCampaignIds = useMemo(
    () => allCampaigns.map((c) => c.id),
    [allCampaigns],
  );

  const isCampaignChecked = (id: string) =>
    selectedContestIds === null || selectedContestIds.includes(id);

  const setCampaignChecked = (id: string, checked: boolean) => {
    if (selectedContestIds === null) {
      if (!checked) {
        setSelectedContestIds(
          allCampaignIds.filter((campaignId) => campaignId !== id),
        );
      }
      return;
    }

    if (checked) {
      const next = selectedContestIds.includes(id)
        ? selectedContestIds
        : [...selectedContestIds, id];
      if (
        allCampaignIds.length > 0 &&
        allCampaignIds.every((campaignId) => next.includes(campaignId))
      ) {
        setSelectedContestIds(null);
      } else {
        setSelectedContestIds(next);
      }
      return;
    }

    setSelectedContestIds(
      selectedContestIds.filter((campaignId) => campaignId !== id),
    );
  };

  const setAllCampaignsChecked = (checked: boolean) => {
    if (checked) {
      setSelectedContestIds(null);
    } else {
      setSelectedContestIds([]);
    }
  };

  const setStatusFilterChecked = (
    id: AdminAnalyticsStatusFilterId,
    checked: boolean,
  ) => {
    setSelectedStatusFilters((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  };

  const setAllStatusFiltersChecked = (checked: boolean) => {
    if (checked) {
      setSelectedStatusFilters(ADMIN_ANALYTICS_STATUS_FILTERS.map((f) => f.id));
    } else {
      setSelectedStatusFilters([]);
    }
  };

  const isCardVisible = (id: AnalyticsMetricCardId) =>
    visibleCards.includes(id);

  const setCardVisible = (id: AnalyticsMetricCardId, checked: boolean) => {
    setVisibleCards((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  };

  const setAllCardsVisible = (checked: boolean) => {
    if (checked) {
      setVisibleCards(DEFAULT_VISIBLE_CARDS);
    } else {
      setVisibleCards([]);
    }
  };

  const visibleTopCards = useMemo(
    () =>
      (
        [
          "views",
          "total_payouts",
          "effective_cpm",
          "submissions",
        ] as AnalyticsMetricCardId[]
      ).filter((id) => visibleCards.includes(id)),
    [visibleCards],
  );

  const visibleStatusCards = useMemo(
    () =>
      ADMIN_ANALYTICS_STATUS_CARDS.filter((c) => visibleCards.includes(c.id)),
    [visibleCards],
  );

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
              clearAdvertiserSelection();
              clearCampaignSelection();
            }}
            triggerClassName={cn(pillClass, "h-10")}
            align="end"
          />

          {/* Advertisers */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(pillClass, "h-10")}>
                <span className="max-w-[160px] truncate">
                  {advertiserButtonLabel}
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
              <DropdownMenuLabel>Advertisers</DropdownMenuLabel>
              <div
                className="px-2 pb-2"
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 opacity-40" />
                  <Input
                    value={advertiserSearch}
                    onChange={(e) => setAdvertiserSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="Search advertisers…"
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
                checked={selectedAdvertiserIds === null}
                onCheckedChange={(checked) =>
                  setAllAdvertisersChecked(checked === true)
                }
                onSelect={(e) => e.preventDefault()}
              >
                All advertisers
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <div className="max-h-64 overflow-y-auto">
                {filteredAdvertisers.length === 0 ? (
                  <p className="px-3 py-4 text-sm opacity-50">
                    No advertisers found
                  </p>
                ) : (
                  filteredAdvertisers.map((a) => (
                    <DropdownMenuCheckboxItem
                      key={a.id}
                      checked={isAdvertiserChecked(a.id)}
                      onCheckedChange={(checked) =>
                        setAdvertiserChecked(a.id, checked === true)
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      <span className="whitespace-normal break-words">
                        {a.name}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

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
                checked={selectedContestIds === null}
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

          {/* View statuses */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(pillClass, "h-10")}>
                <span className="max-w-[150px] truncate">
                  {statusButtonLabel}
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(
                "w-64 bg-white border border-black/5 text-black shadow-lg dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white",
              )}
            >
              <DropdownMenuLabel>View statuses</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={
                  selectedStatusFilters.length ===
                  ADMIN_ANALYTICS_STATUS_FILTERS.length
                }
                onCheckedChange={(checked) =>
                  setAllStatusFiltersChecked(checked === true)
                }
                onSelect={(e) => e.preventDefault()}
              >
                All view statuses
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {ADMIN_ANALYTICS_STATUS_FILTERS.map((filter) => (
                <DropdownMenuCheckboxItem
                  key={filter.id}
                  checked={selectedStatusFilters.includes(filter.id)}
                  onCheckedChange={(checked) =>
                    setStatusFilterChecked(filter.id, checked === true)
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {filter.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Customize cards */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(pillClass, "h-10")}>
                <SlidersHorizontal className="h-4 w-4 opacity-70" />
                <span>Customize</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(
                "w-64 bg-white border border-black/5 text-black shadow-lg dark:border-white/10 dark:bg-[#1a1a1a] dark:text-white",
              )}
            >
              <DropdownMenuLabel>Customize cards</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={
                  visibleCards.length === METRIC_CARD_OPTIONS.length
                }
                onCheckedChange={(checked) =>
                  setAllCardsVisible(checked === true)
                }
                onSelect={(e) => e.preventDefault()}
              >
                All cards
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {METRIC_CARD_OPTIONS.map((card) => (
                <DropdownMenuCheckboxItem
                  key={card.id}
                  checked={visibleCards.includes(card.id)}
                  onCheckedChange={(checked) =>
                    setCardVisible(card.id, checked === true)
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {card.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metric cards */}
      {visibleTopCards.length > 0 && (
        <div
          className={cn(
            "mb-3 grid gap-3",
            visibleTopCards.length === 1
              ? "grid-cols-1"
              : visibleTopCards.length === 2
                ? "sm:grid-cols-2"
                : visibleTopCards.length === 3
                  ? "sm:grid-cols-2 xl:grid-cols-3"
                  : "sm:grid-cols-2 xl:grid-cols-4",
          )}
        >
          {isCardVisible("views") && (
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
          )}

          {isCardVisible("total_payouts") && (
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
                {loading
                  ? "…"
                  : formatCurrencyFromCents(summary.totalPayoutsCents)}
              </p>
            </div>
          )}

          {isCardVisible("effective_cpm") && (
            <div className={cardClass}>
              <div className="mb-3 flex items-center gap-2">
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
                  Effective CPM
                </span>
              </div>
              <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {loading ? "…" : formatCpmDisplay(summary.effectiveCpm)}
              </p>
            </div>
          )}

          {isCardVisible("submissions") && (
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
                    {loading
                      ? "…"
                      : summary.totalSubmissions.toLocaleString()}
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
                    {loading
                      ? "…"
                      : summary.approvedSubmissions.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Views by status cards (outside graph) */}
      {visibleStatusCards.length > 0 && (
        <div
          className={cn(
            "mb-5 grid gap-3 grid-cols-2 sm:grid-cols-3",
            visibleStatusCards.length >= 6
              ? "xl:grid-cols-6"
              : visibleStatusCards.length >= 4
                ? "xl:grid-cols-4"
                : "xl:grid-cols-3",
          )}
        >
          {visibleStatusCards.map((card) => {
            const Icon = STATUS_CARD_ICONS[card.id];
            const value = viewsForStatusCard(card.id, viewsByStatus);
            return (
              <div key={card.id} className={cardClass}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg",
                      isDark ? "bg-white/10" : "bg-[#D8C3FF]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        isDark ? "text-white" : "text-[#4A00BE]",
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium leading-tight",
                      isDark ? "text-white/60" : "text-black/55",
                    )}
                  >
                    {card.label}
                  </span>
                </div>
                <p className="text-lg font-semibold tracking-tight tabular-nums sm:text-xl">
                  {loading ? "…" : value.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

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
              {selectedContestIds === null
                ? "All Campaigns"
                : selectedContestIds.length === 0
                  ? "No Campaigns"
                  : selectedContestIds.length === 1
                    ? allCampaigns.find((c) => c.id === selectedContestIds[0])
                        ?.title || "Campaign"
                    : `${selectedContestIds.length} Campaigns`}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {loading ? "…" : chartTotal.toLocaleString()}
            </p>
          </div>

          <div
            className={cn(
              "inline-flex flex-wrap gap-1 rounded-full border p-1",
              isDark
                ? "border-white/10 bg-[#0d0d0d]"
                : "border-black/10 bg-[#f5f5f5]",
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
                  <linearGradient
                    id="adminAnalyticsFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#7F39EC" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#7F39EC" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke={
                    isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
                  }
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tick={{
                    fill: isDark
                      ? "rgba(255,255,255,0.45)"
                      : "rgba(0,0,0,0.45)",
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
                    fill: isDark
                      ? "rgba(255,255,255,0.45)"
                      : "rgba(0,0,0,0.45)",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  content={
                    <AnalyticsChartTooltip
                      isDark={isDark}
                      chartMetric={chartMetric}
                      statusSeries={visibleStatusSeries}
                    />
                  }
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
                {chartMetric === "views" &&
                  visibleStatusSeries.map((s) => (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={s.dataKey}
                      stroke={s.color}
                      strokeWidth={1.75}
                      dot={false}
                      activeDot={{ r: 3, fill: s.color }}
                    />
                  ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
