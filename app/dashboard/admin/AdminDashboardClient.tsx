"use client";

import { WithdrawalFeeRevenueSection } from "./WithdrawalFeeRevenueSection";
import {
  AdminMetricCard,
  AdminSectionTitle,
  adminMutedClass,
  adminOutlineButtonClass,
  adminPanelClass,
  adminPopoverClass,
  adminSegmentClass,
  adminSegmentItemClass,
} from "@/components/admin/AdminMetricCard";
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
  FileText,
  RefreshCw,
  Loader2,
  Users,
  ShieldCheck,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import ContestTypeFilter from "@/components/admin/ContestTypeFilter";
import { AdminDateRangePicker } from "@/components/admin/AdminDateRangePicker";
import {
  countUniqueCreatorsFromByDay,
  filterAndFillGrowthByRange,
  formatGrowthDayLabel,
  getLastNDaysUtcRange,
  type SubmissionCreatorsByDay,
} from "@/lib/admin-date-range";
import { formatCurrencyFromCents, formatCompactCount } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
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
  submissionCreatorsByDay: SubmissionCreatorsByDay[];
}

type StatusGrowthPoint = {
  label: string;
  all: number;
  verified: number;
  pending: number;
  rejected: number;
  paid: number;
};

type ChartStatusGrowthPoint = StatusGrowthPoint & {
  verified_or_paid: number;
  not_rejected: number;
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

type StatusFilter =
  | "all"
  | "verified"
  | "pending"
  | "rejected"
  | "paid"
  | "verified_or_paid"
  | "not_rejected";

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

const COMPOSITE_STATUS_SERIES = [
  {
    key: "verified_or_paid",
    label: "Verified + Paid",
    colorLight: "#0D9488",
    colorDark: "#2DD4BF",
  },
  {
    key: "not_rejected",
    label: "Pending + Verified + Paid",
    colorLight: "#C026D3",
    colorDark: "#E879F9",
  },
] as const;

const CHART_STATUS_SERIES = [
  ...STATUS_SERIES,
  ...COMPOSITE_STATUS_SERIES,
] as const;

function enrichStatusChartData(
  data: StatusGrowthPoint[],
): ChartStatusGrowthPoint[] {
  return data.map((d) => ({
    ...d,
    verified_or_paid: d.verified + d.paid,
    // Match analytics: pending + verified + paid (excludes rejected/unknown)
    not_rejected: d.pending + d.verified + d.paid,
  }));
}

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
  value: number | string;
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

function deriveCompositeStatusTotals(totals: {
  all: number;
  verified: number;
  pending: number;
  rejected: number;
  paid: number;
}) {
  return {
    verifiedOrPaid: totals.verified + totals.paid,
    // Match analytics: pending + verified + paid (excludes rejected/unknown)
    notRejected: totals.pending + totals.verified + totals.paid,
  };
}

function isStatusSeriesVisibleForFilter(
  key: string,
  filter: StatusFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "verified_or_paid") return key === "verified_or_paid";
  if (filter === "not_rejected") return key === "not_rejected";
  return filter === key;
}

function sumCountGrowthPoints(points: CountGrowthPoint[]) {
  return points.reduce((sum, p) => sum + p.all, 0);
}

function SummaryMetricCard(props: SummaryMetricCardProps) {
  return <AdminMetricCard {...props} />;
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
  submissionCreatorsByDay,
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

  const defaultRange = getLastNDaysUtcRange(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(
    defaultRange,
  );
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
          .join(" \u00b7 "),
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
  const statusChartData = enrichStatusChartData(
    growthMode === "cumulative"
      ? toStatusCumulative(rawStatusChartData)
      : rawStatusChartData,
  );

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
    const submissionComposite = deriveCompositeStatusTotals(submissionTotals);
    const viewComposite = deriveCompositeStatusTotals(viewTotals);

    return {
      campaigns: sumCountGrowthPoints(contestsInRange),
      users: userTotals.all,
      creators: userTotals.creators,
      brands: userTotals.brands,
      submissions: {
        ...submissionTotals,
        verifiedOrPaid: submissionComposite.verifiedOrPaid,
        notRejected: submissionComposite.notRejected,
      },
      views: {
        ...viewTotals,
        verifiedOrPaid: viewComposite.verifiedOrPaid,
        notRejected: viewComposite.notRejected,
      },
      uniqueCreators: countUniqueCreatorsFromByDay(
        submissionCreatorsByDay,
        dateRange.from,
        dateRange.to,
      ),
    };
  }, [
    contestGrowth,
    dateRange.from,
    dateRange.to,
    isLast12MonthsPreset,
    submissionCreatorsByDay,
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
    adminSegmentItemClass(active, isDark);

  const isStatusSeriesVisible = (key: string) =>
    isStatusSeriesVisibleForFilter(key, activeStatusFilter);

  const statusChartConfig = Object.fromEntries(
    CHART_STATUS_SERIES.map((s) => [
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
            className={cn(
              "text-2xl font-bold tracking-tight md:text-3xl",
              isDark ? "text-white" : "text-[#1a1a1a]",
            )}
          >
            Admin Dashboard
          </h2>
          <p className={cn("mt-1", adminMutedClass(isDark))}>
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
              className={adminOutlineButtonClass(isDark)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync All Creator Views
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className={adminPopoverClass(isDark)}>
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
                    Syncing{"\u2026"}
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
        <AdminSectionTitle isDark={isDark}>Platform Overview</AdminSectionTitle>
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
                title="Verified + Paid Submissions"
                value={overviewMetrics.submissions.verifiedOrPaid}
                subtitle={`Verified or paid in ${overviewPeriodLabel}`}
                tooltip="Submissions that are verified or paid in the selected date range"
                icon={CheckCircle}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Non Rejected Submissions"
                value={overviewMetrics.submissions.notRejected}
                subtitle={`Pending + verified + paid in ${overviewPeriodLabel}`}
                tooltip="Pending + verified + paid submissions (excludes rejected and unknown statuses)"
                icon={ShieldCheck}
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
                tooltip="Current view counts from verified submissions, grouped by submission created date"
                icon={CheckCircle}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Pending Views"
                value={overviewMetrics.views.pending}
                subtitle={`Pending in ${overviewPeriodLabel}`}
                tooltip="Current view counts from pending submissions, grouped by submission created date"
                icon={Eye}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Rejected Views"
                value={overviewMetrics.views.rejected}
                subtitle={`Rejected in ${overviewPeriodLabel}`}
                tooltip="Current view counts from rejected submissions, grouped by submission created date"
                icon={XCircle}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Paid Views"
                value={overviewMetrics.views.paid}
                subtitle={`Paid in ${overviewPeriodLabel}`}
                tooltip="Current view counts from paid submissions, grouped by submission created date"
                icon={DollarSign}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Total Views"
                value={overviewMetrics.views.all}
                subtitle={`Submitted in ${overviewPeriodLabel}`}
                tooltip="Current view counts from all submissions, grouped by submission created date (not when views were earned)"
                icon={Video}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Verified + Paid Views"
                value={overviewMetrics.views.verifiedOrPaid}
                subtitle={`Verified or paid in ${overviewPeriodLabel}`}
                tooltip="Current view counts from verified or paid submissions, grouped by submission created date"
                icon={CheckCircle}
                isDark={isDark}
              />
              <SummaryMetricCard
                title="Non Rejected Views"
                value={overviewMetrics.views.notRejected}
                subtitle={`Pending + verified + paid in ${overviewPeriodLabel}`}
                tooltip="Current views from pending + verified + paid submissions (excludes rejected and unknown); grouped by submission created date"
                icon={ShieldCheck}
                isDark={isDark}
              />
            </>
          ) : null}
        </div>
      </div>

      <WithdrawalFeeRevenueSection
        from={dateRange.from}
        to={dateRange.to}
        periodLabel={overviewPeriodLabel}
        isDark={isDark}
        className="mt-8"
      />

      {/* Platform Growth Chart */}
      <div className="mt-8 space-y-4 w-full min-w-0 overflow-visible">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <AdminSectionTitle isDark={isDark} className="shrink-0">
            {sectionTitle}
          </AdminSectionTitle>
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
              <div className={adminSegmentClass(isDark)}>
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
                    className={cn(
                      "h-9 min-w-[140px] rounded-full text-sm",
                      isDark
                        ? "border-white/10 bg-[#161616] text-white"
                        : "border-[#e6e6e8] bg-white text-[#1a1a1a]",
                    )}
                  >
                    <SelectValue placeholder="User type" />
                  </SelectTrigger>
                  <SelectContent
                    className={adminPopoverClass(isDark)}
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
                    className={cn(
                      "h-9 min-w-[160px] rounded-full text-sm",
                      isDark
                        ? "border-white/10 bg-[#161616] text-white"
                        : "border-[#e6e6e8] bg-white text-[#1a1a1a]",
                    )}
                  >
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent
                    className={adminPopoverClass(isDark)}
                  >
                    <SelectItem value="all">
                      {metricConfig.allFilterLabel}
                    </SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="verified_or_paid">
                      Verified + Paid
                    </SelectItem>
                    <SelectItem value="not_rejected">
                      Pending + Verified + Paid
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center shrink-0">
              <div className={adminSegmentClass(isDark)}>
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
          className={cn(
            adminPanelClass(isDark),
            "w-full min-w-0 overflow-visible p-4",
          )}
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
                  {CHART_STATUS_SERIES.map((series) => (
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
                {CHART_STATUS_SERIES.filter((series) =>
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
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSectionTitle isDark={isDark}>Campaign Overview</AdminSectionTitle>
        <ContestTypeFilter value={contestTypeFilter as any} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SummaryMetricCard
          title="Total Drafts"
          value={totalDraftContests}
          subtitle="Draft campaigns"
          tooltip="Campaigns currently in draft (not submitted for approval)"
          icon={FileText}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Total Pending"
          value={totalPendingContests}
          subtitle="Pending approval"
          tooltip="Campaigns submitted for approval"
          icon={Eye}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Total Approved"
          value={totalApprovedContests}
          subtitle="Approved campaigns"
          tooltip="Campaigns approved and ready to publish"
          icon={CheckCircle}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Total Rejected"
          value={totalRejectedContests}
          subtitle="Rejected campaigns"
          tooltip="Campaigns that were rejected and need changes"
          icon={XCircle}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Total Published"
          value={totalPublishedContests}
          subtitle="Published campaigns"
          tooltip='Campaigns with moderation status set to "published"'
          icon={PlayCircle}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Upcoming"
          value={totalUpcomingContests}
          subtitle="Scheduled campaigns"
          tooltip="Published campaigns with lifecycle status = upcoming"
          icon={PlayCircle}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Live"
          value={totalActiveContests}
          subtitle="Currently live"
          tooltip="Published campaigns currently live"
          icon={Eye}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Ended"
          value={totalEndedContests}
          subtitle="Published but ended"
          tooltip="Published campaigns with lifecycle status = ended"
          icon={StopCircle}
          isDark={isDark}
        />
        <SummaryMetricCard
          title="Completed"
          value={totalCompletedContests}
          subtitle="Payouts processed"
          tooltip="Ended campaigns where payouts are processed (post_contest_status = payouts_processed)"
          icon={CheckCircle}
          isDark={isDark}
        />
      </div>

      <div className="mt-8 mb-4">
        <AdminSectionTitle isDark={isDark}>Submissions Metrics</AdminSectionTitle>
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
          tooltip="All submissions across all campaigns"
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

      <div className="mt-8 mb-4">
        <AdminSectionTitle isDark={isDark}>Views Metrics</AdminSectionTitle>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SummaryMetricCard
          title="Expected Views"
          value={totalExpectedViews}
          subtitle="Pending + Verified + Paid views"
          tooltip="Pending + verified + paid views"
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

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSectionTitle isDark={isDark}>Actions</AdminSectionTitle>
        <form action="/api/jobs/process-now" method="post">
          <Button
            type="submit"
            className="h-10 rounded-full bg-[#1a1a1a] px-5 text-white hover:bg-black"
          >
            Process Payout Queue Now
          </Button>
        </form>
      </div>

      <div className="mt-8 space-y-4">
        <AdminSectionTitle isDark={isDark}>Financial Metrics</AdminSectionTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SummaryMetricCard
            title="Money Paid (Published)"
            value={formatCurrencyFromCents(totalMoneyPaidByPublished)}
            subtitle="Completed payments for published campaigns"
            tooltip="Sum of completed payments for campaigns that are published"
            icon={DollarSign}
            isDark={isDark}
          />
          <SummaryMetricCard
            title="Money Paid (Unpublished)"
            value={formatCurrencyFromCents(moneyPaidUnpublished)}
            subtitle="Paid but not published"
            tooltip="Completed payments for campaigns not yet published (draft/approved)"
            icon={DollarSign}
            isDark={isDark}
          />
          <SummaryMetricCard
            title="Money Paid (All)"
            value={formatCurrencyFromCents(expectedMoneyPaidAll)}
            subtitle="All campaigns with completed payment"
            tooltip="Sum of completed payments across all campaigns (published and unpublished)"
            icon={DollarSign}
            isDark={isDark}
          />
          <SummaryMetricCard
            title="Total (Without Commission)"
            value={formatCurrencyFromCents(paymentsBreakdown.withoutCommission)}
            subtitle="Total money paid excluding commission"
            tooltip="Sum of prize pool / CPM budget only (excludes commission)"
            icon={DollarSign}
            isDark={isDark}
          />
          <SummaryMetricCard
            title="Total Commission"
            value={formatCurrencyFromCents(paymentsBreakdown.commission)}
            subtitle="Total commission paid"
            tooltip="Commission collected from completed payments"
            icon={DollarSign}
            isDark={isDark}
          />
          <SummaryMetricCard
            title="Total (With Commission)"
            value={formatCurrencyFromCents(paymentsBreakdown.withCommission)}
            subtitle="Total money paid including commission"
            tooltip="Total payments received (includes commission)"
            icon={DollarSign}
            isDark={isDark}
          />
          <SummaryMetricCard
            title="Projected (Without Commission)"
            value={formatCurrencyFromCents(projectedMoneySpent)}
            subtitle="Budgets and prize pools set"
            tooltip="Projected prize pool / CPM budgets only (excludes commission)"
            icon={DollarSign}
            isDark={isDark}
          />
          <SummaryMetricCard
            title="Projected (With Commission)"
            value={formatCurrencyFromCents(projectedWithCommission)}
            subtitle="Payments made plus unpaid budgets"
            tooltip="Projected budgets plus estimated commission (based on payment details)"
            icon={DollarSign}
            isDark={isDark}
          />
          <SummaryMetricCard
            title="Draft Money (Not Paid)"
            value={formatCurrencyFromCents(totalMoneyInDraftNotPaid)}
            subtitle="Draft campaigns only (unpaid)"
            tooltip="Budgets/prize pools on campaigns still in draft and not yet paid"
            icon={DollarSign}
            isDark={isDark}
          />
            </div>
        </div>

    </div>
  );
}
