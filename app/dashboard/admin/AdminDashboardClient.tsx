"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Trophy,
  Video,
  User,
  Building,
  DollarSign,
  PlayCircle,
  StopCircle,
  CheckCircle,
  XCircle,
  Eye,
  Info,
  FileText,
  RefreshCw,
  Loader2,
  Users,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import ContestTypeFilter from "@/components/admin/ContestTypeFilter";
import { AdminDateRangePicker } from "@/components/admin/AdminDateRangePicker";
import {
  addDaysToDateKey,
  filterAndFillGrowthByRange,
  formatGrowthDayLabel,
  getDateStrInTz,
  getGrowthDayKey,
} from "@/lib/admin-date-range";
import { formatCurrencyFromCents, formatCompactCount } from "@/lib/currency-utils";
import { Button } from "@/components/ui/button";
import { useEffect, useLayoutEffect, useMemo, useState, type ComponentType } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";

const GROWTH_CHART_MARGIN = { top: 10, right: 16, left: 0, bottom: 20 };

type GrowthXAxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value: string };
  index?: number;
};

/** Pick ~6–8 evenly spaced tick indices so 30-day ranges stay readable. */
function getGrowthXAxisTickIndices(dataLength: number): Set<number> {
  if (dataLength <= 0) return new Set();
  if (dataLength <= 8) {
    return new Set(Array.from({ length: dataLength }, (_, i) => i));
  }

  const targetTicks =
    dataLength <= 31 ? 7 : dataLength <= 90 ? 8 : Math.min(10, dataLength);
  const indices = new Set<number>([0, dataLength - 1]);
  const innerCount = targetTicks - 2;

  for (let i = 1; i <= innerCount; i++) {
    indices.add(Math.round((i * (dataLength - 1)) / (innerCount + 1)));
  }

  return indices;
}

function createGrowthXAxisTick(isDark: boolean, dataLength: number) {
  const visibleIndices = getGrowthXAxisTickIndices(dataLength);

  return function GrowthXAxisTick({
    x = 0,
    y = 0,
    payload,
    index = 0,
  }: GrowthXAxisTickProps) {
    if (!visibleIndices.has(index)) {
      return <g />;
    }

    const isFirst = index === 0;
    const isLast = index === dataLength - 1;
    const textAnchor = isFirst ? "start" : isLast ? "end" : "middle";

    return (
      <text
        x={x}
        y={y}
        dy={14}
        textAnchor={textAnchor}
        fontSize={11}
        fill={isDark ? "#9CA3AF" : "#6B7280"}
      >
        {payload?.value}
      </text>
    );
  };
}

interface AdminDashboardClientProps {
  totalContests: number;
  totalPublishedContests: number;
  totalDraftContests: number;
  totalPendingContests: number;
  totalApprovedContests: number;
  totalRejectedContests: number;
  totalActiveContests: number;
  totalUpcomingContests: number;
  totalCompletedContests: number;
  totalEndedContests: number;
  totalViews: number;
  totalVerifiedViews: number;
  totalPaidViews: number;
  totalRejectedViews: number;
  totalPendingViews: number;
  totalExpectedViews: number;
  totalSubmissions: number;
  verifiedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  paidSubmissions: number;
  uniqueCreators: number;
  totalUsers: number;
  totalCreators: number;
  totalBrands: number;
  totalMoneyPaidByPublished: number;
  moneyPaidUnpublished: number;
  expectedMoneyPaidAll: number;
  paymentsBreakdown: {
    withCommission: number;
    withoutCommission: number;
    commission: number;
  };
  projectedMoneySpent: number;
  projectedWithCommission: number;
  totalMoneyInDraftNotPaid: number;
  contestTypeFilter: string;
  userGrowth: {
    byDay: {
      label: string;
      all: number;
      creators: number;
      brands: number;
      admins: number;
    }[];
    byWeek: {
      label: string;
      all: number;
      creators: number;
      brands: number;
      admins: number;
    }[];
    byMonth: {
      label: string;
      all: number;
      creators: number;
      brands: number;
      admins: number;
    }[];
    byYear: {
      label: string;
      all: number;
      creators: number;
      brands: number;
      admins: number;
    }[];
    byDayFull: {
      date: string;
      label: string;
      all: number;
      creators: number;
      brands: number;
      admins: number;
    }[];
  };
  submissionGrowth: StatusGrowthSeries;
  viewsGrowth: StatusGrowthSeries;
  contestGrowth: CountGrowthSeries;
  submissionCreatorDates: {
    created_at: string;
    creator_id: string | null;
  }[];
}

type StatusGrowthPoint = {
  label: string;
  all: number;
  verified: number;
  pending: number;
  rejected: number;
  paid: number;
};

type StatusGrowthSeries = {
  byDay: StatusGrowthPoint[];
  byWeek: StatusGrowthPoint[];
  byMonth: StatusGrowthPoint[];
  byYear: StatusGrowthPoint[];
  byDayFull: (StatusGrowthPoint & { date: string })[];
};

type CountGrowthPoint = { label: string; all: number };

type CountGrowthSeries = {
  byDay: CountGrowthPoint[];
  byWeek: CountGrowthPoint[];
  byMonth: CountGrowthPoint[];
  byYear: CountGrowthPoint[];
  byDayFull: (CountGrowthPoint & { date: string })[];
};

type StatusFilter = "all" | "verified" | "pending" | "rejected" | "paid";

const STATUS_SERIES = [
  { key: "all", label: "All", colorLight: "#7C3AED", colorDark: "#A78BFA" },
  {
    key: "verified",
    label: "Verified",
    colorLight: "#059669",
    colorDark: "#34D399",
  },
  {
    key: "pending",
    label: "Pending",
    colorLight: "#D97706",
    colorDark: "#FBBF24",
  },
  {
    key: "rejected",
    label: "Rejected",
    colorLight: "#DC2626",
    colorDark: "#F87171",
  },
  { key: "paid", label: "Paid", colorLight: "#2563EB", colorDark: "#60A5FA" },
] as const;

function toStatusCumulative(data: StatusGrowthPoint[]): StatusGrowthPoint[] {
  let sumAll = 0;
  let sumVerified = 0;
  let sumPending = 0;
  let sumRejected = 0;
  let sumPaid = 0;
  return data.map((d) => {
    sumAll += d.all;
    sumVerified += d.verified;
    sumPending += d.pending;
    sumRejected += d.rejected;
    sumPaid += d.paid;
    return {
      label: d.label,
      all: sumAll,
      verified: sumVerified,
      pending: sumPending,
      rejected: sumRejected,
      paid: sumPaid,
    };
  });
}

type GrowthMetricTab = "users" | "submissions" | "views";

const GROWTH_METRIC_CONFIG: Record<
  GrowthMetricTab,
  {
    dailyTitle: string;
    cumulativeTitle: string;
    dailyTabLabel: string;
    cumulativeTabLabel: string;
    allFilterLabel: string;
  }
> = {
  users: {
    dailyTitle: "Daily signup growth",
    cumulativeTitle: "Users growth",
    dailyTabLabel: "Daily signup growth",
    cumulativeTabLabel: "Users growth",
    allFilterLabel: "All Users",
  },
  submissions: {
    dailyTitle: "Daily submission growth",
    cumulativeTitle: "Submissions growth",
    dailyTabLabel: "Daily submission growth",
    cumulativeTabLabel: "Submissions growth",
    allFilterLabel: "All Submissions",
  },
  views: {
    dailyTitle: "Daily views growth",
    cumulativeTitle: "Views growth",
    dailyTabLabel: "Daily views growth",
    cumulativeTabLabel: "Views growth",
    allFilterLabel: "All Views",
  },
};

const readIsDarkFromDom = () => {
  const modeElement = document.querySelector("[data-mode]");
  if (modeElement) {
    return modeElement.getAttribute("data-mode") === "dark";
  }

  const themeElement = document.documentElement;
  return themeElement.getAttribute("data-theme") === "dark";
};

type SummaryMetricCardProps = {
  title: string;
  value: number;
  subtitle: string;
  tooltip?: string;
  icon: ComponentType<{ className?: string }>;
  isDark: boolean | null;
};

function sumUserGrowthPoints(points: {
  all: number;
  creators: number;
  brands: number;
  admins: number;
}[]) {
  return points.reduce(
    (acc, p) => ({
      all: acc.all + p.all,
      creators: acc.creators + p.creators,
      brands: acc.brands + p.brands,
      admins: acc.admins + p.admins,
    }),
    { all: 0, creators: 0, brands: 0, admins: 0 },
  );
}

function sumStatusGrowthPoints(points: StatusGrowthPoint[]) {
  return points.reduce(
    (acc, p) => ({
      all: acc.all + p.all,
      verified: acc.verified + p.verified,
      pending: acc.pending + p.pending,
      rejected: acc.rejected + p.rejected,
      paid: acc.paid + p.paid,
    }),
    { all: 0, verified: 0, pending: 0, rejected: 0, paid: 0 },
  );
}

function sumCountGrowthPoints(points: CountGrowthPoint[]) {
  return points.reduce((sum, p) => sum + p.all, 0);
}

function countUniqueCreatorsInRange(
  records: { created_at: string; creator_id: string | null }[],
  from: Date,
  to: Date,
) {
  const fromStr = getDateStrInTz(from);
  const toStr = getDateStrInTz(to);
  const ids = new Set<string>();
  for (const record of records) {
    if (!record.creator_id) continue;
    const dayKey = getGrowthDayKey(record.created_at);
    if (dayKey >= fromStr && dayKey <= toStr) ids.add(record.creator_id);
  }
  return ids.size;
}

function SummaryMetricCard({
  title,
  value,
  subtitle,
  tooltip,
  icon: Icon,
  isDark,
}: SummaryMetricCardProps) {
  return (
    <div
      className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
        isDark ? "bg-[#170337] text-white" : "bg-white text-black"
      }`}
    >
      <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
        <div className="flex items-center gap-2">
          <h1
            className={`text-md font-medium ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {title}
          </h1>
          {tooltip ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info
                    className={`h-3.5 w-3.5 cursor-help ${
                      isDark
                        ? "text-gray-400 hover:text-gray-300"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  />
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        <div
          className={`w-10 h-10 flex items-center justify-center rounded-full ${
            isDark
              ? "bg-[#FFFFFF36] text-white"
              : "bg-[#D8C3FF] text-[#4A00BE]"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p
          className={`text-sm mt-2 ${
            isDark ? "text-gray-300" : "text-gray-600"
          }`}
        >
          {subtitle}
        </p>
      </CardContent>
    </div>
  );
}

export default function AdminDashboardClient({
  totalContests,
  totalPublishedContests,
  totalDraftContests,
  totalPendingContests,
  totalApprovedContests,
  totalRejectedContests,
  totalActiveContests,
  totalUpcomingContests,
  totalCompletedContests,
  totalEndedContests,
  totalViews,
  totalVerifiedViews,
  totalPaidViews,
  totalRejectedViews,
  totalPendingViews,
  totalExpectedViews,
  totalSubmissions,
  verifiedSubmissions,
  pendingSubmissions,
  rejectedSubmissions,
  paidSubmissions,
  uniqueCreators,
  totalUsers,
  totalCreators,
  totalBrands,
  totalMoneyPaidByPublished,
  moneyPaidUnpublished,
  expectedMoneyPaidAll,
  paymentsBreakdown,
  projectedMoneySpent,
  projectedWithCommission,
  totalMoneyInDraftNotPaid,
  contestTypeFilter,
  userGrowth,
  submissionGrowth,
  viewsGrowth,
  contestGrowth,
  submissionCreatorDates,
}: AdminDashboardClientProps) {
  // Get theme from parent layout
  const [isDark, setIsDark] = useState<boolean | null>(null);
  const [growthMetricTab, setGrowthMetricTab] =
    useState<GrowthMetricTab>("users");
  const [growthMode, setGrowthMode] = useState<"daily" | "cumulative">("daily");
  const [userTypeFilter, setUserTypeFilter] = useState<
    "all" | "creators" | "brands" | "admins"
  >("all");
  const [submissionStatusFilter, setSubmissionStatusFilter] =
    useState<StatusFilter>("all");
  const [viewsStatusFilter, setViewsStatusFilter] =
    useState<StatusFilter>("all");

  const now = new Date();
  const todayKey = getGrowthDayKey(now);
  const fromKey = addDaysToDateKey(todayKey, -30);
  const [fromYear, fromMonth, fromDay] = fromKey.split("-").map(Number);
  const [toYear, toMonth, toDay] = todayKey.split("-").map(Number);
  const defaultRangeStart = new Date(
    Date.UTC(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0),
  );
  const defaultRangeEnd = new Date(
    Date.UTC(toYear, toMonth - 1, toDay, 23, 59, 59, 999),
  );
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: defaultRangeStart,
    to: defaultRangeEnd,
  });
  const [dateRangePresetLabel, setDateRangePresetLabel] =
    useState<string>("Last 30 Days");
  const [isSyncingAllCreatorViews, setIsSyncingAllCreatorViews] =
    useState(false);
  const [syncAllViewsDialogOpen, setSyncAllViewsDialogOpen] = useState(false);

  const handleSyncAllCreatorViews = async () => {
    setIsSyncingAllCreatorViews(true);
    try {
      const response = await fetch("/api/admin/sync-all-creator-views", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to sync creator profile views");
      }

      const sync = result?.views_sync ?? {};
      const updated = Number(sync.upserted_or_updated) || 0;
      const rejectedRemoved = Number(sync.deleted_rejected_credits) || 0;
      const platformPass = Number(sync.platform_aware_submissions) || 0;

      toast.success("Creator profile views synced", {
        description: [
          updated > 0
            ? `${updated} credited snapshot${updated === 1 ? "" : "s"} updated`
            : "Credited snapshots were already up to date",
          rejectedRemoved > 0
            ? `${rejectedRemoved} rejected credit${rejectedRemoved === 1 ? "" : "s"} removed`
            : null,
          `${platformPass} submission${platformPass === 1 ? "" : "s"} checked (platform-aware pass)`,
        ]
          .filter(Boolean)
          .join(" Â· "),
      });
      setSyncAllViewsDialogOpen(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to sync creator profile views";
      toast.error("Sync failed", { description: message });
    } finally {
      setIsSyncingAllCreatorViews(false);
    }
  };

  type GrowthPoint = {
    label: string;
    all: number;
    creators: number;
    brands: number;
    admins: number;
  };

  const toCumulative = (data: GrowthPoint[]): GrowthPoint[] => {
    let sumAll = 0;
    let sumCreators = 0;
    let sumBrands = 0;
    let sumAdmins = 0;
    return data.map((d) => {
      sumAll += d.all;
      sumCreators += d.creators;
      sumBrands += d.brands;
      sumAdmins += d.admins;
      return {
        label: d.label,
        all: sumAll,
        creators: sumCreators,
        brands: sumBrands,
        admins: sumAdmins,
      };
    });
  };

  const isLast12MonthsPreset = dateRangePresetLabel === "Last 12 Months";

  const rawUsersChartData: GrowthPoint[] = isLast12MonthsPreset
    ? userGrowth.byMonth.slice(-12)
    : filterAndFillGrowthByRange(
        userGrowth.byDayFull as (GrowthPoint & { date: string })[],
        dateRange.from,
        dateRange.to,
        (dateKey) => ({
          label: formatGrowthDayLabel(dateKey),
          date: dateKey,
          all: 0,
          creators: 0,
          brands: 0,
          admins: 0,
        }),
      );
  const usersChartData =
    growthMode === "cumulative"
      ? toCumulative(rawUsersChartData)
      : rawUsersChartData;

  const activeStatusGrowth =
    growthMetricTab === "submissions" ? submissionGrowth : viewsGrowth;
  const activeStatusFilter =
    growthMetricTab === "submissions"
      ? submissionStatusFilter
      : viewsStatusFilter;
  const rawStatusChartData: StatusGrowthPoint[] = isLast12MonthsPreset
    ? activeStatusGrowth.byMonth.slice(-12)
    : filterAndFillGrowthByRange(
        activeStatusGrowth.byDayFull,
        dateRange.from,
        dateRange.to,
        (dateKey) => ({
          label: formatGrowthDayLabel(dateKey),
          date: dateKey,
          all: 0,
          verified: 0,
          pending: 0,
          rejected: 0,
          paid: 0,
        }),
      );
  const statusChartData =
    growthMode === "cumulative"
      ? toStatusCumulative(rawStatusChartData)
      : rawStatusChartData;

  const overviewMetrics = useMemo(() => {
    const usersInRange: {
      all: number;
      creators: number;
      brands: number;
      admins: number;
    }[] = isLast12MonthsPreset
      ? userGrowth.byMonth.slice(-12)
      : filterAndFillGrowthByRange(
          userGrowth.byDayFull,
          dateRange.from,
          dateRange.to,
          (dateKey) => ({
            label: formatGrowthDayLabel(dateKey),
            date: dateKey,
            all: 0,
            creators: 0,
            brands: 0,
            admins: 0,
          }),
        );

    const submissionsInRange: StatusGrowthPoint[] = isLast12MonthsPreset
      ? submissionGrowth.byMonth.slice(-12)
      : filterAndFillGrowthByRange(
          submissionGrowth.byDayFull,
          dateRange.from,
          dateRange.to,
          (dateKey) => ({
            label: formatGrowthDayLabel(dateKey),
            date: dateKey,
            all: 0,
            verified: 0,
            pending: 0,
            rejected: 0,
            paid: 0,
          }),
        );

    const viewsInRange: StatusGrowthPoint[] = isLast12MonthsPreset
      ? viewsGrowth.byMonth.slice(-12)
      : filterAndFillGrowthByRange(
          viewsGrowth.byDayFull,
          dateRange.from,
          dateRange.to,
          (dateKey) => ({
            label: formatGrowthDayLabel(dateKey),
            date: dateKey,
            all: 0,
            verified: 0,
            pending: 0,
            rejected: 0,
            paid: 0,
          }),
        );

    const contestsInRange: CountGrowthPoint[] = isLast12MonthsPreset
      ? contestGrowth.byMonth.slice(-12)
      : filterAndFillGrowthByRange(
          contestGrowth.byDayFull,
          dateRange.from,
          dateRange.to,
          (dateKey) => ({
            label: formatGrowthDayLabel(dateKey),
            date: dateKey,
            all: 0,
          }),
        );

    const userTotals = sumUserGrowthPoints(usersInRange);
    const submissionTotals = sumStatusGrowthPoints(submissionsInRange);
    const viewTotals = sumStatusGrowthPoints(viewsInRange);

    return {
      campaigns: sumCountGrowthPoints(contestsInRange),
      users: userTotals.all,
      creators: userTotals.creators,
      brands: userTotals.brands,
      submissions: submissionTotals,
      views: viewTotals,
      uniqueCreators: countUniqueCreatorsInRange(
        submissionCreatorDates,
        dateRange.from,
        dateRange.to,
      ),
    };
  }, [
    contestGrowth,
    dateRange.from,
    dateRange.to,
    isLast12MonthsPreset,
    submissionCreatorDates,
    submissionGrowth,
    userGrowth,
    viewsGrowth,
  ]);

  const overviewPeriodLabel = dateRangePresetLabel || "selected period";

  const metricConfig = GROWTH_METRIC_CONFIG[growthMetricTab];
  const sectionTitle =
    growthMode === "daily"
      ? metricConfig.dailyTitle
      : metricConfig.cumulativeTitle;

  const growthTabButtonClass = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
      active
        ? isDark
          ? "bg-[#4A00BE] text-white"
          : "bg-primary text-primary-foreground"
        : isDark
          ? "text-gray-300 hover:bg-white/10"
          : "text-muted-foreground hover:bg-muted"
    }`;

  const isStatusSeriesVisible = (key: string) =>
    activeStatusFilter === "all" || activeStatusFilter === key;

  const statusChartConfig = Object.fromEntries(
    STATUS_SERIES.map((s) => [
      s.key,
      { label: s.label, color: isDark ? s.colorDark : s.colorLight },
    ]),
  );

  // Resolve theme before first paint to avoid flash between modes
  useLayoutEffect(() => {
    setIsDark(readIsDarkFromDom());
  }, []);

  // Watch for theme changes from parent layout
  useEffect(() => {
    const checkTheme = () => {
      const newIsDark = readIsDarkFromDom();
      setIsDark((prev) => (prev === newIsDark ? prev : newIsDark));
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

  if (isDark === null) {
    return null;
  }

  return (
    <div className="space-y-8 pb-8 w-full min-w-0 overflow-visible">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className={`text-3xl font-bold tracking-tight ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Admin Dashboard
          </h2>
          <p
            className={`mt-1 ${
              isDark ? "text-gray-400" : "text-muted-foreground"
            }`}
          >
            Platform-wide statistics and management
          </p>
        </div>
        <AlertDialog
          open={syncAllViewsDialogOpen}
          onOpenChange={(open) => {
            if (!isSyncingAllCreatorViews) setSyncAllViewsDialogOpen(open);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className={
                isDark
                  ? "border-emerald-400/60 text-emerald-300 hover:bg-white/5"
                  : "border-emerald-500/50 text-emerald-700 hover:bg-emerald-50"
              }
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync All Creator Views
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className={isDark ? "bg-[#170337] text-white border-white/10" : ""}>
            <AlertDialogHeader>
              <AlertDialogTitle>Sync all creator profile views?</AlertDialogTitle>
              <AlertDialogDescription
                className={isDark ? "text-gray-300" : undefined}
              >
                This recalculates creator leaderboard totals from all campaigns.
                Pending, verified, and paid submissions will be credited;
                rejected submissions will be excluded. Safe to run more than
                once.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSyncingAllCreatorViews}>
                Cancel
              </AlertDialogCancel>
              <Button
                onClick={handleSyncAllCreatorViews}
                disabled={isSyncingAllCreatorViews}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSyncingAllCreatorViews ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncingâ€¦
                  </>
                ) : (
                  "Sync now"
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Platform Overview */}
      <div className="mt-8 space-y-4 w-full min-w-0">
        <h2
          className={`text-xl font-bold shrink-0 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Platform Overview
        </h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {growthMetricTab === "users" ? (
            <>
              <SummaryMetricCard
                title="Total Campaigns"
                value={overviewMetrics.campaigns}
                subtitle={`Created in ${overviewPeriodLabel}`}
                tooltip="Campaigns created in the selected date range"
                icon={Trophy}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Total Users"
                value={overviewMetrics.users}
                subtitle={`Signed up in ${overviewPeriodLabel}`}
                tooltip="Users registered in the selected date range"
                icon={User}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Total Creators"
                value={overviewMetrics.creators}
                subtitle={`Signed up in ${overviewPeriodLabel}`}
                tooltip="Creators registered in the selected date range"
                icon={User}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Total Brands"
                value={overviewMetrics.brands}
                subtitle={`Signed up in ${overviewPeriodLabel}`}
                tooltip="Brands registered in the selected date range"
                icon={Building}
                isDark={isDark}
              />
            </>
          ) : null}
          {growthMetricTab === "submissions" ? (
            <>
              <SummaryMetricCard
                title="Total Campaigns"
                value={overviewMetrics.campaigns}
                subtitle={`Created in ${overviewPeriodLabel}`}
                tooltip="Campaigns created in the selected date range"
                icon={Trophy}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Total Submissions"
                value={overviewMetrics.submissions.all}
                subtitle={`Submitted in ${overviewPeriodLabel}`}
                tooltip="Submissions created in the selected date range"
                icon={Video}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Verified Submissions"
                value={overviewMetrics.submissions.verified}
                subtitle={`Verified in ${overviewPeriodLabel}`}
                tooltip="Verified submissions in the selected date range"
                icon={CheckCircle}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Pending Submissions"
                value={overviewMetrics.submissions.pending}
                subtitle={`Pending in ${overviewPeriodLabel}`}
                tooltip="Pending submissions in the selected date range"
                icon={Eye}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Rejected Submissions"
                value={overviewMetrics.submissions.rejected}
                subtitle={`Rejected in ${overviewPeriodLabel}`}
                tooltip="Rejected submissions in the selected date range"
                icon={XCircle}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Paid Submissions"
                value={overviewMetrics.submissions.paid}
                subtitle={`Paid in ${overviewPeriodLabel}`}
                tooltip="Paid submissions in the selected date range"
                icon={DollarSign}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Unique Creators"
                value={overviewMetrics.uniqueCreators}
                subtitle={`Submitted in ${overviewPeriodLabel}`}
                tooltip="Distinct creators who submitted in the selected date range"
                icon={Users}
                isDark={isDark}
              />
            </>
          ) : null}
          {growthMetricTab === "views" ? (
            <>
              <SummaryMetricCard
                title="Total Campaigns"
                value={overviewMetrics.campaigns}
                subtitle={`Created in ${overviewPeriodLabel}`}
                tooltip="Campaigns created in the selected date range"
                icon={Trophy}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Verified Views"
                value={overviewMetrics.views.verified}
                subtitle={`Verified in ${overviewPeriodLabel}`}
                tooltip="Views from verified submissions created in the selected date range"
                icon={CheckCircle}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Pending Views"
                value={overviewMetrics.views.pending}
                subtitle={`Pending in ${overviewPeriodLabel}`}
                tooltip="Views from pending submissions created in the selected date range"
                icon={Eye}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Rejected Views"
                value={overviewMetrics.views.rejected}
                subtitle={`Rejected in ${overviewPeriodLabel}`}
                tooltip="Views from rejected submissions created in the selected date range"
                icon={XCircle}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Paid Views"
                value={overviewMetrics.views.paid}
                subtitle={`Paid in ${overviewPeriodLabel}`}
                tooltip="Views from paid submissions created in the selected date range"
                icon={DollarSign}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Total Views"
                value={overviewMetrics.views.all}
                subtitle={`Submitted in ${overviewPeriodLabel}`}
                tooltip="All views from submissions created in the selected date range"
                icon={Video}
                isDark={isDark}
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Platform Growth Chart */}
      <div className="mt-8 space-y-4 w-full min-w-0 overflow-visible">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            className={`text-xl font-bold shrink-0 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {sectionTitle}
          </h2>
          <div className="flex flex-wrap items-center gap-3 min-w-0 flex-shrink">
            <div className="flex items-center shrink-0">
              <AdminDateRangePicker
                isDark={isDark}
                value={dateRange}
                presetLabel={dateRangePresetLabel}
                onChange={(next, label) => {
                  setDateRange(next);
                  setDateRangePresetLabel(label);
                }}
              />
            </div>
            <div className="flex items-center shrink-0">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(
                  [
                    { value: "users" as const, label: "Users" },
                    { value: "submissions" as const, label: "Submissions" },
                    { value: "views" as const, label: "Views" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGrowthMetricTab(value)}
                    className={growthTabButtonClass(growthMetricTab === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center shrink-0">
              {growthMetricTab === "users" ? (
                <Select
                  value={userTypeFilter}
                  onValueChange={(
                    v: "all" | "creators" | "brands" | "admins",
                  ) => setUserTypeFilter(v)}
                >
                  <SelectTrigger
                    className={`min-w-[140px] h-9 text-sm ${
                      isDark ? "border-white/20 bg-white/5 text-white" : ""
                    }`}
                  >
                    <SelectValue placeholder="User type" />
                  </SelectTrigger>
                  <SelectContent
                    className={isDark ? "border-white/20 bg-[#170337]" : ""}
                  >
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="creators">Creators</SelectItem>
                    <SelectItem value="brands">Advertisers</SelectItem>
                    <SelectItem value="admins">Admins</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={activeStatusFilter}
                  onValueChange={(v: StatusFilter) =>
                    growthMetricTab === "submissions"
                      ? setSubmissionStatusFilter(v)
                      : setViewsStatusFilter(v)
                  }
                >
                  <SelectTrigger
                    className={`min-w-[160px] h-9 text-sm ${
                      isDark ? "border-white/20 bg-white/5 text-white" : ""
                    }`}
                  >
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent
                    className={isDark ? "border-white/20 bg-[#170337]" : ""}
                  >
                    <SelectItem value="all">
                      {metricConfig.allFilterLabel}
                    </SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center shrink-0">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(
                  [
                    {
                      value: "daily" as const,
                      label: metricConfig.dailyTabLabel,
                    },
                    {
                      value: "cumulative" as const,
                      label: metricConfig.cumulativeTabLabel,
                    },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGrowthMode(value)}
                    className={growthTabButtonClass(growthMode === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4 w-full min-w-0 overflow-visible ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          {growthMetricTab === "users" ? (
            <>
              <ChartContainer
                config={{
                  all: {
                    label: "All Users",
                    color: isDark ? "#A78BFA" : "#7C3AED",
                  },
                  creators: {
                    label: "Creators",
                    color: isDark ? "#34D399" : "#059669",
                  },
                  brands: {
                    label: "Advertisers",
                    color: isDark ? "#FBBF24" : "#D97706",
                  },
                  admins: {
                    label: "Admins",
                    color: isDark ? "#F87171" : "#DC2626",
                  },
                }}
                className="h-[320px] w-full min-w-0 overflow-visible"
              >
                <LineChart
                  data={usersChartData}
                  margin={GROWTH_CHART_MARGIN}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className={isDark ? "stroke-white/10" : "stroke-border"}
                  />
                  <XAxis
                    dataKey="label"
                    tick={createGrowthXAxisTick(isDark, usersChartData.length)}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    height={36}
                    padding={{ left: 12, right: 12 }}
                  />
                  <YAxis
                    width={44}
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#9CA3AF" : "#6B7280",
                    }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(value) =>
                      formatCompactCount(Number(value))
                    }
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="all"
                    stroke="var(--color-all)"
                    strokeWidth={2}
                    dot={userTypeFilter === "all" ? { r: 2 } : false}
                    strokeOpacity={userTypeFilter === "all" ? 1 : 0}
                    hide={userTypeFilter !== "all"}
                    name="All Users"
                  />
                  <Line
                    type="monotone"
                    dataKey="creators"
                    stroke="var(--color-creators)"
                    strokeWidth={2}
                    dot={
                      userTypeFilter === "all" ||
                      userTypeFilter === "creators"
                        ? { r: 2 }
                        : false
                    }
                    strokeOpacity={
                      userTypeFilter === "all" ||
                      userTypeFilter === "creators"
                        ? 1
                        : 0
                    }
                    hide={
                      userTypeFilter !== "all" &&
                      userTypeFilter !== "creators"
                    }
                    name="Creators"
                  />
                  <Line
                    type="monotone"
                    dataKey="brands"
                    stroke="var(--color-brands)"
                    strokeWidth={2}
                    dot={
                      userTypeFilter === "all" || userTypeFilter === "brands"
                        ? { r: 2 }
                        : false
                    }
                    strokeOpacity={
                      userTypeFilter === "all" || userTypeFilter === "brands"
                        ? 1
                        : 0
                    }
                    hide={
                      userTypeFilter !== "all" && userTypeFilter !== "brands"
                    }
                    name="Advertisers"
                  />
                  <Line
                    type="monotone"
                    dataKey="admins"
                    stroke="var(--color-admins)"
                    strokeWidth={2}
                    dot={
                      userTypeFilter === "all" || userTypeFilter === "admins"
                        ? { r: 2 }
                        : false
                    }
                    strokeOpacity={
                      userTypeFilter === "all" || userTypeFilter === "admins"
                        ? 1
                        : 0
                    }
                    hide={
                      userTypeFilter !== "all" && userTypeFilter !== "admins"
                    }
                    name="Admins"
                  />
                </LineChart>
              </ChartContainer>
              <div className="flex flex-wrap gap-6 mt-4 justify-center text-sm">
                {userTypeFilter === "all" && (
                  <span
                    className={`flex items-center gap-1.5 ${
                      isDark ? "text-gray-300" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: isDark ? "#A78BFA" : "#7C3AED",
                      }}
                    />
                    All Users
                  </span>
                )}
                {(userTypeFilter === "all" ||
                  userTypeFilter === "creators") && (
                  <span
                    className={`flex items-center gap-1.5 ${
                      isDark ? "text-gray-300" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: isDark ? "#34D399" : "#059669",
                      }}
                    />
                    Creators
                  </span>
                )}
                {(userTypeFilter === "all" || userTypeFilter === "brands") && (
                  <span
                    className={`flex items-center gap-1.5 ${
                      isDark ? "text-gray-300" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: isDark ? "#FBBF24" : "#D97706",
                      }}
                    />
                    Advertisers
                  </span>
                )}
                {(userTypeFilter === "all" || userTypeFilter === "admins") && (
                  <span
                    className={`flex items-center gap-1.5 ${
                      isDark ? "text-gray-300" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: isDark ? "#F87171" : "#DC2626",
                      }}
                    />
                    Admins
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <ChartContainer
                config={statusChartConfig}
                className="h-[320px] w-full min-w-0 overflow-visible"
              >
                <LineChart
                  data={statusChartData}
                  margin={GROWTH_CHART_MARGIN}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className={isDark ? "stroke-white/10" : "stroke-border"}
                  />
                  <XAxis
                    dataKey="label"
                    tick={createGrowthXAxisTick(isDark, statusChartData.length)}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    height={36}
                    padding={{ left: 12, right: 12 }}
                  />
                  <YAxis
                    width={44}
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#9CA3AF" : "#6B7280",
                    }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(value) =>
                      formatCompactCount(Number(value))
                    }
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {STATUS_SERIES.map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      stroke={`var(--color-${series.key})`}
                      strokeWidth={2}
                      dot={
                        isStatusSeriesVisible(series.key) ? { r: 2 } : false
                      }
                      strokeOpacity={
                        isStatusSeriesVisible(series.key) ? 1 : 0
                      }
                      hide={!isStatusSeriesVisible(series.key)}
                      name={series.label}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
              <div className="flex flex-wrap gap-6 mt-4 justify-center text-sm">
                {STATUS_SERIES.filter((series) =>
                  isStatusSeriesVisible(series.key),
                ).map((series) => (
                  <span
                    key={series.key}
                    className={`flex items-center gap-1.5 ${
                      isDark ? "text-gray-300" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: isDark
                          ? series.colorDark
                          : series.colorLight,
                      }}
                    />
                    {series.key === "all" ? "All" : series.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contest Overview */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <h2
          className={`text-xl font-bold ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Campaign Overview
        </h2>
        <ContestTypeFilter value={contestTypeFilter as any} />
      </div>

      {/* Contest Metrics */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Total Drafts */}
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Total Drafts
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Campaigns currently in draft (not submitted for approval)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalDraftContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Draft campaigns
            </p>
          </CardContent>
        </div>

        {/* Total Pending */}
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Total Pending
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Campaigns submitted for approval
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <Eye className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalPendingContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Pending approval
            </p>
          </CardContent>
        </div>

        {/* Total Approved */}
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Total Approved
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Campaigns approved and ready to publish
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalApprovedContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Approved campaigns
            </p>
          </CardContent>
        </div>

        {/* Total Rejected */}
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Total Rejected
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Campaigns that were rejected and need changes
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalRejectedContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Rejected campaigns
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Total Published
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Campaigns with moderation status set to "published"
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <PlayCircle className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalPublishedContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Published campaigns
            </p>
          </CardContent>
        </div>

        {/* Upcoming */}
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Upcoming
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Published campaigns with lifecycle status = upcoming
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <PlayCircle className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalUpcomingContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Scheduled campaigns
            </p>
          </CardContent>
        </div>

        {/* Live (Active) */}
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Live
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Published campaigns currently live
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <Eye className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalActiveContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Currently live
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Ended
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Published campaigns with lifecycle status = ended
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <StopCircle className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalEndedContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Published but ended
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Completed
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Ended campaigns where payouts are processed
                    (post_contest_status = payouts_processed)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompletedContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Payouts processed
            </p>
          </CardContent>
        </div>
      </div>

      {/* Submissions Metrics */}
      <div className="mt-8 mb-4">
        <h2
          className={`text-xl font-bold mb-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Submissions Metrics
        </h2>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SummaryMetricCard
          title="Verified Submissions"
          value={verifiedSubmissions}
          subtitle="Verified"
          tooltip="Submissions marked as verified"
          icon={CheckCircle}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Pending Submissions"
          value={pendingSubmissions}
          subtitle="Pending"
          tooltip="Submissions awaiting review"
          icon={Eye}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Rejected Submissions"
          value={rejectedSubmissions}
          subtitle="Rejected"
          tooltip="Submissions marked as rejected"
          icon={XCircle}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Paid Submissions"
          value={paidSubmissions}
          subtitle="Paid"
          tooltip="Submissions that have been paid out"
          icon={DollarSign}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Total Submissions"
          value={totalSubmissions}
          subtitle="All submissions"
          tooltip="All submissions across campaigns"
          icon={Video}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Unique Creators"
          value={uniqueCreators}
          subtitle="Creators with submissions"
          tooltip="Distinct creators who have submitted"
          icon={Users}
          isDark={isDark}
        />
      </div>

      {/* Views Metrics */}
      <div className="mt-8 mb-4">
        <h2
          className={`text-xl font-bold mb-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Views Metrics
        </h2>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SummaryMetricCard
          title="Expected Views"
          value={totalExpectedViews}
          subtitle="Pending + Verified"
          tooltip="Pending + Verified views"
          icon={Eye}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Verified Views"
          value={totalVerifiedViews}
          subtitle="Verified"
          tooltip="Views from submissions marked as verified"
          icon={CheckCircle}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Pending Views"
          value={totalPendingViews}
          subtitle="Pending"
          tooltip="Views from submissions marked as pending"
          icon={Eye}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Rejected Views"
          value={totalRejectedViews}
          subtitle="From rejected entries"
          tooltip="Views from rejected submissions"
          icon={XCircle}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Paid Views"
          value={totalPaidViews}
          subtitle="From paid entries"
          tooltip="Views from paid submissions"
          icon={DollarSign}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Total Views"
          value={totalViews}
          subtitle="All views"
          tooltip="All views across all submissions"
          icon={Video}
          isDark={isDark}
        />
      </div>

      {/* Admin actions */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <h2
          className={`text-xl font-bold ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Actions
        </h2>
        <form action="/api/jobs/process-now" method="post">
          <Button type="submit" variant="default" className="shadow-md">
            Process Payout Queue Now
          </Button>
        </form>
      </div>

      {/* Money Metrics */}
      <div className="mt-8 mb-4">
        {/* <h2
          className={`text-xl font-bold mb-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Financial Metrics
        </h2> */}
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Money Paid (Published)
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Sum of completed payments for campaigns that are published
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(totalMoneyPaidByPublished)}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Completed payments for published campaigns
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Money Paid (Unpublished)
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Completed payments for campaigns not yet published
                    (draft/approved)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(moneyPaidUnpublished)}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Paid but not published
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Money Paid (Published + Unpublished)
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Sum of completed payments across all campaigns (published and
                    unpublished)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(expectedMoneyPaidAll)}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              All campaigns with completed payment
            </p>
          </CardContent>
        </div>
      </div>

      {/* Money Breakdown (Expected payments) */}
      <div className="mt-8 mb-4">
        {/* <h2
          className={`text-xl font-bold mb-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Payment Breakdown
        </h2> */}
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Total (Without Commission)
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Sum of prize pool / CPM budget only (excludes commission)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(paymentsBreakdown.withoutCommission)}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Total money paid excluding commission
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Total Commission
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Commission collected from completed payments
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(paymentsBreakdown.commission)}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Total commission paid
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Total (With Commission)
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Total payments received (includes commission)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(paymentsBreakdown.withCommission)}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Total money paid including commission
            </p>
          </CardContent>
        </div>
      </div>

      {/* Projected Breakdown */}
      <div className="mt-8 mb-4">
        {/* <h2
          className={`text-xl font-bold mb-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Projected Breakdown
        </h2> */}
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Projected (Without Commission)
              </h1>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Projected prize pool / CPM budgets only (excludes
                    commission)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(projectedMoneySpent)}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Budgets/prize pools set (paid + not-yet-paid)
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Projected (With Commission)
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Projected budgets plus estimated commission (based on
                    payment details)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(projectedWithCommission)}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Includes payments made + budgets set on not-yet-paid campaigns
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <div className="flex items-center gap-2">
              <h1
                className={`text-md font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Total Money in Draft (Not Paid)
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={`h-3.5 w-3.5 cursor-help ${
                        isDark
                          ? "text-gray-400 hover:text-gray-300"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Budgets/prize pools on campaigns still in draft and not yet
                    paid
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(totalMoneyInDraftNotPaid)}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Draft campaigns only (unpaid)
            </p>
          </CardContent>
        </div>
      </div>
    </div>
  );
}
