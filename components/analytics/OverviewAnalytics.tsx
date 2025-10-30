"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Users,
  Eye,
  DollarSign,
} from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";
import { cn } from "@/lib/utils";

interface OverviewAnalyticsProps {
  userId: string;
  activeFilter?: string;
}

interface AnalyticsData {
  overview: {
    totalContests: number;
    totalSubmissions: number;
    totalViews: number;
    totalSpent: number;
    avgCostPerView: number;
    avgCostPerSubmission: number;
    avgSubmissionsPerContest: number;
    topContest: {
      id: string;
      title: string;
      views: number;
      submissions: number;
    } | null;
  };
  platformStats: Record<
    string,
    {
      contests: number;
      submissions: number;
      views: number;
      spent: number;
    }
  >;
  monthlyData: Record<
    string,
    {
      contests: number;
      submissions: number;
      views: number;
      spent: number;
    }
  >;
  contestTypeStats: Record<
    string,
    {
      count: number;
      submissions: number;
      views: number;
      spent: number;
    }
  >;
}

export default function OverviewAnalytics({
  userId,
  activeFilter = "all",
}: OverviewAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDark } = useAnalyticsDarkMode();

  useEffect(() => {
    fetchOverviewData();
  }, [userId, activeFilter]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const url =
        activeFilter !== "all"
          ? `/api/analytics/overview?status=${activeFilter}`
          : "/api/analytics/overview";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching overview data:", err);
      setError("Failed to fetch analytics data");
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous)
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (current < previous)
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return "text-green-600";
    if (current < previous) return "text-red-600";
    return "text-gray-600";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">
          {error || "Failed to load analytics"}
        </p>
        <button
          onClick={fetchOverviewData}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { overview, platformStats, monthlyData, contestTypeStats } = data;

  // Get last 6 months of data for trends
  const last6Months = Object.keys(monthlyData).sort().slice(-6);

  const previousMonthData =
    last6Months.length > 1
      ? monthlyData[last6Months[last6Months.length - 2]]
      : { contests: 0, submissions: 0, views: 0, spent: 0 };

  const currentMonthData =
    last6Months.length > 0
      ? monthlyData[last6Months[last6Months.length - 1]]
      : { contests: 0, submissions: 0, views: 0, spent: 0 };

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Total Contests
            </CardTitle>
            <BarChart3
              className={cn(
                "h-4 w-4",
                isDark ? "text-gray-400" : "text-muted-foreground"
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {overview.totalContests}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getTrendIcon(
                currentMonthData.contests,
                previousMonthData.contests
              )}
              <span
                className={getTrendColor(
                  currentMonthData.contests,
                  previousMonthData.contests
                )}
              >
                {currentMonthData.contests} this month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Total Submissions
            </CardTitle>
            <Users
              className={cn(
                "h-4 w-4",
                isDark ? "text-gray-400" : "text-muted-foreground"
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {overview.totalSubmissions.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getTrendIcon(
                currentMonthData.submissions,
                previousMonthData.submissions
              )}
              <span
                className={getTrendColor(
                  currentMonthData.submissions,
                  previousMonthData.submissions
                )}
              >
                {currentMonthData.submissions} this month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Total Views
            </CardTitle>
            <Eye
              className={cn(
                "h-4 w-4",
                isDark ? "text-gray-400" : "text-muted-foreground"
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {overview.totalViews.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getTrendIcon(currentMonthData.views, previousMonthData.views)}
              <span
                className={getTrendColor(
                  currentMonthData.views,
                  previousMonthData.views
                )}
              >
                {currentMonthData.views.toLocaleString()} this month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Total Spent
            </CardTitle>
            <DollarSign
              className={cn(
                "h-4 w-4",
                isDark ? "text-gray-400" : "text-muted-foreground"
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {formatCurrencyFromCents(overview.totalSpent)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getTrendIcon(currentMonthData.spent, previousMonthData.spent)}
              <span
                className={getTrendColor(
                  currentMonthData.spent,
                  previousMonthData.spent
                )}
              >
                {formatCurrencyFromCents(currentMonthData.spent)} this month
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader>
            <CardTitle
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Average Cost Per View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {formatCurrencyFromCents(
                Math.round(overview.avgCostPerView * 100)
              )}
            </div>
            <p className="text-xs text-muted-foreground">Lower is better</p>
          </CardContent>
        </Card>

        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader>
            <CardTitle
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Average Cost Per Submission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {formatCurrencyFromCents(
                Math.round(overview.avgCostPerSubmission * 100)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cost per creator engagement
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader>
            <CardTitle
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Average Submissions Per Contest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {overview.avgSubmissionsPerContest.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Creator participation rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Contest */}
      {overview.topContest && (
        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader>
            <CardTitle
              className={cn("text-lg", isDark ? "text-white" : "text-gray-900")}
            >
              Top Performing Contest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3
                  className={cn(
                    "font-semibold text-lg",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  {overview.topContest.title}
                </h3>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                  <span>
                    {overview.topContest.views.toLocaleString()} views
                  </span>
                  <span>{overview.topContest.submissions} submissions</span>
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  isDark
                    ? "bg-green-900/50 text-green-200 border-green-700"
                    : "bg-green-50 text-green-700 border-green-200",
                  "self-start sm:self-auto"
                )}
              >
                Best Performer
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader>
            <CardTitle
              className={cn("text-lg", isDark ? "text-white" : "text-gray-900")}
            >
              Platform Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(platformStats).map(([platform, stats]) => (
                <div
                  key={platform}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isDark ? "bg-[#FFFFFF36]" : "bg-gray-100"
                      )}
                    >
                      <span className="text-xs font-semibold capitalize">
                        {platform[0]}
                      </span>
                    </div>
                    <div>
                      <p
                        className={cn(
                          "font-medium capitalize",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {platform}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {stats.contests} contests • {stats.submissions}{" "}
                        submissions
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <p
                      className={cn(
                        "font-semibold",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      {stats.views.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
        >
          <CardHeader>
            <CardTitle
              className={cn("text-lg", isDark ? "text-white" : "text-gray-900")}
            >
              Contest Type Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(contestTypeStats).map(([type, stats]) => (
                <div
                  key={type}
                  className="flex flex-wrap items-start justify-between gap-3"
                >
                  <div>
                    <p
                      className={cn(
                        "font-medium capitalize",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      {type.replace("_", " ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {stats.count} contests • {stats.submissions} submissions
                    </p>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <p
                      className={cn(
                        "font-semibold",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      {formatCurrencyFromCents(stats.spent)}
                    </p>
                    <p className="text-sm text-muted-foreground">spent</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card
        className={cn(isDark ? "bg-[#170337] border-[#170337]" : "bg-white")}
      >
        <CardHeader>
          <CardTitle
            className={cn("text-lg", isDark ? "text-white" : "text-gray-900")}
          >
            Monthly Trends (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {last6Months.slice(-3).map((month) => {
              const monthData = monthlyData[month];
              const monthName = new Date(month + "-01").toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  year: "numeric",
                }
              );

              return (
                <div
                  key={month}
                  className={cn(
                    "flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-3 rounded-lg",
                    isDark ? "bg-gray-800" : "bg-gray-50"
                  )}
                >
                  <div>
                    <p
                      className={cn(
                        "font-medium",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      {monthName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 md:gap-6 text-sm md:justify-end">
                    <div className="text-center">
                      <p
                        className={cn(
                          "font-semibold",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {monthData.contests}
                      </p>
                      <p className="text-muted-foreground">Contests</p>
                    </div>
                    <div className="text-center">
                      <p
                        className={cn(
                          "font-semibold",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {monthData.submissions}
                      </p>
                      <p className="text-muted-foreground">Submissions</p>
                    </div>
                    <div className="text-center">
                      <p
                        className={cn(
                          "font-semibold",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {monthData.views.toLocaleString()}
                      </p>
                      <p className="text-muted-foreground">Views</p>
                    </div>
                    <div className="text-center">
                      <p
                        className={cn(
                          "font-semibold",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {formatCurrencyFromCents(monthData.spent)}
                      </p>
                      <p className="text-muted-foreground">Spent</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
