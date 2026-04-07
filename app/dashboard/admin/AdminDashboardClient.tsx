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
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { Button } from "@/components/ui/button";
import { useEffect, useLayoutEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";

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
}

const readIsDarkFromDom = () => {
  const modeElement = document.querySelector("[data-mode]");
  if (modeElement) {
    return modeElement.getAttribute("data-mode") === "dark";
  }

  const themeElement = document.documentElement;
  return themeElement.getAttribute("data-theme") === "dark";
};

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
}: AdminDashboardClientProps) {
  // Get theme from parent layout
  const [isDark, setIsDark] = useState<boolean | null>(null);
  const [growthMode, setGrowthMode] = useState<"daily" | "cumulative">("daily");
  const [userTypeFilter, setUserTypeFilter] = useState<
    "all" | "creators" | "brands" | "admins"
  >("all");

  const now = new Date();
  const defaultRangeEnd = new Date(now);
  defaultRangeEnd.setHours(23, 59, 59, 999);
  const defaultRangeStart = subDays(now, 30);
  defaultRangeStart.setHours(0, 0, 0, 0);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: defaultRangeStart,
    to: defaultRangeEnd,
  });
  const [dateRangePresetLabel, setDateRangePresetLabel] =
    useState<string>("Last 30 Days");

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

  function getUTCDateStr(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const fromStr = getUTCDateStr(dateRange.from);
  const toStr = getUTCDateStr(dateRange.to);
  const filteredByDayFull = userGrowth.byDayFull.filter(
    (p) => p.date >= fromStr && p.date <= toStr,
  );

  const isLast12MonthsPreset = dateRangePresetLabel === "Last 12 Months";

  const rawChartData: GrowthPoint[] = isLast12MonthsPreset
    ? userGrowth.byMonth.slice(-12)
    : (filteredByDayFull as GrowthPoint[]);
  const chartData =
    growthMode === "cumulative" ? toCumulative(rawChartData) : rawChartData;

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
      <div className="flex items-center justify-between">
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
      </div>

      {/* Top Summary */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Total Contests */}
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
                Total Contests
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
                    Includes all contests (draft + published)
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
              <Trophy className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">{totalContests}</div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              All contests on platform
            </p>
          </CardContent>
        </div>

        {/* Total Users */}
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
                Total Users
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
                  <TooltipContent>All registered users</TooltipContent>
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
              <User className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalUsers.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Creators + Brands
            </p>
          </CardContent>
        </div>

        {/* Total Creators */}
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
                Total Creators
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
                  <TooltipContent>Users with role creator</TooltipContent>
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
              <User className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCreators.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Creators
            </p>
          </CardContent>
        </div>

        {/* Total Brands */}
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
                Total Brands
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
                  <TooltipContent>Users with role advertiser</TooltipContent>
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
              <Building className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalBrands.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Brands
            </p>
          </CardContent>
        </div>
      </div>

      {/* Users Growth Chart */}
      <div className="mt-8 space-y-4 w-full min-w-0 overflow-visible">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            className={`text-xl font-bold shrink-0 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {growthMode === "daily" ? "Daily signup growth" : "Users growth"}
          </h2>
          <div className="flex flex-wrap items-center gap-3 min-w-0 flex-shrink">
            {/* Column 1: Date range picker */}
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
            {/* Column 2: User type */}
            <div className="flex items-center shrink-0">
              <Select
                value={userTypeFilter}
                onValueChange={(v: "all" | "creators" | "brands" | "admins") =>
                  setUserTypeFilter(v)
                }
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
            </div>
            {/* Column 3: Daily signups vs Cumulative growth */}
            <div className="flex items-center shrink-0">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(
                  [
                    {
                      value: "daily" as const,
                      label: "Daily signup growth",
                    },
                    {
                      value: "cumulative" as const,
                      label: "Users growth",
                    },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGrowthMode(value)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                      growthMode === value
                        ? isDark
                          ? "bg-[#4A00BE] text-white"
                          : "bg-primary text-primary-foreground"
                        : isDark
                          ? "text-gray-300 hover:bg-white/10"
                          : "text-muted-foreground hover:bg-muted"
                    }`}
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
            className="h-[320px] w-full min-w-0"
          >
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className={isDark ? "stroke-white/10" : "stroke-border"}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: isDark ? "#9CA3AF" : "#6B7280" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: isDark ? "#9CA3AF" : "#6B7280" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
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
                  userTypeFilter === "all" || userTypeFilter === "creators"
                    ? { r: 2 }
                    : false
                }
                strokeOpacity={
                  userTypeFilter === "all" || userTypeFilter === "creators"
                    ? 1
                    : 0
                }
                hide={userTypeFilter !== "all" && userTypeFilter !== "creators"}
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
                hide={userTypeFilter !== "all" && userTypeFilter !== "brands"}
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
                hide={userTypeFilter !== "all" && userTypeFilter !== "admins"}
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
            {(userTypeFilter === "all" || userTypeFilter === "creators") && (
              <span
                className={`flex items-center gap-1.5 ${
                  isDark ? "text-gray-300" : "text-muted-foreground"
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: isDark ? "#34D399" : "#059669" }}
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
                  style={{ backgroundColor: isDark ? "#FBBF24" : "#D97706" }}
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
                  style={{ backgroundColor: isDark ? "#F87171" : "#DC2626" }}
                />
                Admins
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contest Overview */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <h2
          className={`text-xl font-bold ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Contest Overview
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
                    Contests currently in draft (not submitted for approval)
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
              Draft contests
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
                    Contests submitted for approval
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
                    Contests approved and ready to publish
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
              Approved contests
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
                    Contests that were rejected and need changes
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
              Rejected contests
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
                    Contests with moderation status set to "published"
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
              Published contests
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
                    Published contests with lifecycle status = upcoming
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
              Scheduled contests
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
                    Published contests currently live
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
                    Published contests with lifecycle status = ended
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
                    Ended contests where payouts are processed
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
        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <h1
              className={`text-md font-medium ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Verified Submissions
            </h1>
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
            <div className="text-2xl font-bold">
              {verifiedSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Verified
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <h1
              className={`text-md font-medium ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Pending Submissions
            </h1>
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
            <div className="text-2xl font-bold">
              {pendingSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Pending
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <h1
              className={`text-md font-medium ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Rejected Submissions
            </h1>
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
            <div className="text-2xl font-bold">
              {rejectedSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Rejected
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <h1
              className={`text-md font-medium ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Paid Submissions
            </h1>
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
              {paidSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Paid
            </p>
          </CardContent>
        </div>

        <div
          className={`rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 ${
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          }`}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <h1
              className={`text-md font-medium ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Total Submissions
            </h1>
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              }`}
            >
              <Video className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              All submissions
            </p>
          </CardContent>
        </div>
      </div>

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
        {/* Expected Views */}
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
                Expected Views
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
                    Pending + Verified + Paid views
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
            <div className="text-2xl font-bold">
              {totalExpectedViews.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Pending + Verified
            </p>
          </CardContent>
        </div>

        {/* Verified Views */}
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
                Verified Views
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
                    Views from submissions marked as verified
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
            <div className="text-2xl font-bold">
              {totalVerifiedViews.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Verified
            </p>
          </CardContent>
        </div>

        {/* Pending Views */}
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
                Pending Views
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
                    Views from submissions marked as pending
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
            <div className="text-2xl font-bold">
              {totalPendingViews.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Pending
            </p>
          </CardContent>
        </div>

        {/* Rejected Views */}
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
                Rejected Views
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
                  <TooltipContent>From rejected entries</TooltipContent>
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
            <div className="text-2xl font-bold">
              {totalRejectedViews.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              From rejected entries
            </p>
          </CardContent>
        </div>

        {/* Paid Views */}
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
                Paid Views
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
                  <TooltipContent>From paid entries</TooltipContent>
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
              {totalPaidViews.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              From paid entries
            </p>
          </CardContent>
        </div>

        {/* Total Views */}
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
                Total Views
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
                    All views across all submissions
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
              <Video className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalViews.toLocaleString()}
            </div>
            <p
              className={`text-sm mt-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              All views
            </p>
          </CardContent>
        </div>
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
                    Sum of completed payments for contests that are published
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
              Completed payments for published contests
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
                    Completed payments for contests not yet published
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
                    Sum of completed payments across all contests (published and
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
              All contests with completed payment
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
              Includes payments made + budgets set on not-yet-paid contests
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
                    Budgets/prize pools on contests still in draft and not yet
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
              Draft contests only (unpaid)
            </p>
          </CardContent>
        </div>
      </div>
    </div>
  );
}
