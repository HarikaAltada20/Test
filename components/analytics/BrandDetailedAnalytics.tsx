"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle,
  AlertCircle,
  FileText,
  Trophy,
  Video,
  Building,
  PlayCircle,
  StopCircle,
  Info,
  DollarSign,
  Users,
  Eye,
  XCircle,
  Clock,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import ContestTypeFilter from "@/components/admin/ContestTypeFilter";
import { cn } from "@/lib/utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";

interface BrandDetailedAnalyticsProps {
  userId: string;
}

export default function BrandDetailedAnalytics({
  userId,
}: BrandDetailedAnalyticsProps) {
  const [contestTypeFilter, setContestTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const { isDark } = useAnalyticsDarkMode();

  useEffect(() => {
    fetchAnalyticsData();
  }, [contestTypeFilter]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const url = `/api/analytics/brand-detailed?type=${contestTypeFilter}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const result = await response.json();
      setAnalyticsData(result);
    } catch (err) {
      console.error("Error fetching brand detailed analytics data:", err);
      setError("Failed to fetch brand detailed analytics data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">
          {error || "Failed to load brand detailed analytics"}
        </p>
        <button
          onClick={fetchAnalyticsData}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { overview } = analyticsData;

  // Fallback values to prevent errors when data is missing
  const safeOverview = {
    totalContests: 0,
    totalDraftContests: 0,
    totalPendingContests: 0,
    totalApprovedContests: 0,
    totalPublishedContests: 0,
    totalRejectedContests: 0,
    totalActiveContests: 0,
    totalUpcomingContests: 0,
    totalEndedContests: 0,
    totalCompletedContests: 0,
    totalSubmissions: 0,
    verifiedSubmissions: 0,
    pendingSubmissions: 0,
    rejectedSubmissions: 0,
    paidSubmissions: 0,
    totalViews: 0,
    totalVerifiedViews: 0,
    totalPendingViews: 0,
    totalRejectedViews: 0,
    totalPaidViews: 0,
    totalExpectedViews: 0,
    totalMoneyPaid: 0,
    totalProjectedSpent: 0,
    moneyPaidUnpublished: 0,
    moneyInDraftNotPaid: 0,
    paymentsBreakdown: {
      withCommission: 0,
      withoutCommission: 0,
      commission: 0,
    },
    ...overview,
  };

  return (
    <div className="space-y-8 ">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Brand Analytics</h2>
          <p className="text-muted-foreground">
            Detailed performance metrics for your campaigns
          </p>
        </div>
      </div>

      {/* Contest Type Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contest Overview</h2>
        <ContestTypeFilter
          value={contestTypeFilter as any}
          onChange={(value) => setContestTypeFilter(value)}
        />
      </div>

      {/* Contest Status Overview */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contest Status Overview</h2>
      </div>

      <div className="grid gap-3 sm:gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-9">
        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-blue-900/50" : "bg-blue-50"
              )}
            >
              <FileText className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-blue-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Draft Contests
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Contests currently in draft (not submitted for approval)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {safeOverview.totalDraftContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Draft contests
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-yellow-900/50" : "bg-yellow-100"
              )}
            >
              <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-1">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Pending Approval
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Contests submitted for approval
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {safeOverview.totalPendingContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Pending approval
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-green-900/50" : "bg-green-100"
              )}
            >
              <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Approved
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Contests approved and ready to publish
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {safeOverview.totalApprovedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Approved contests
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-purple-900/50" : "bg-purple-100"
              )}
            >
              <PlayCircle className="h-6 w-6 sm:h-7 sm:w-7 text-purple-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Published
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Contests with moderation status set to "published"
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {safeOverview.totalPublishedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Published contests
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-emerald-900/50" : "bg-emerald-100"
              )}
            >
              <Eye className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Active (Live)
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Published contests currently live
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {safeOverview.totalActiveContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Currently live
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-green-900/50" : "bg-green-100"
              )}
            >
              <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Completed
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Ended contests where payouts are processed
                    (post_contest_status = payouts_processed)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {safeOverview.totalCompletedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Payouts processed
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-red-900/50" : "bg-red-100"
              )}
            >
              <XCircle className="h-6 w-6 sm:h-7 sm:w-7 text-red-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Total Rejected
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Contests that were rejected and need changes
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {safeOverview.totalRejectedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Rejected contests
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-orange-900/50" : "bg-orange-100"
              )}
            >
              <Clock className="h-6 w-6 sm:h-7 sm:w-7  text-orange-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Upcoming
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Published contests with lifecycle status = upcoming
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {safeOverview.totalUpcomingContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-muted-foreground"
              )}
            >
              Scheduled contests
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-gray-700" : "bg-gray-100"
              )}
            >
              <StopCircle className="h-6 w-6 sm:h-7 sm:w-7 text-gray-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Ended
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Published contests that have ended but payouts are not yet
                    processed
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {safeOverview.totalEndedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Published but ended
            </p>
          </div>
        </div>
      </div>

      {/* Submissions Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Verified Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.verifiedSubmissions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.pendingSubmissions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Rejected Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.rejectedSubmissions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Paid Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.paidSubmissions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Paid</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.totalSubmissions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All submissions</p>
          </CardContent>
        </Card>
      </div>

      {/* View Analytics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Expected Views
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Pending + Verified + Paid views
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <Eye className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.totalExpectedViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Pending + Verified</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Verified Views
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Views from submissions marked as verified
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <CheckCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.totalVerifiedViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Pending Views
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Views from submissions marked as pending
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <Eye className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.totalPendingViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Rejected Views
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>From rejected entries</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.totalRejectedViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              From rejected entries
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Paid Views</CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>From paid entries</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.totalPaidViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">From paid entries</p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    All views across all submissions
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <Video className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeOverview.totalViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All views</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Breakdown */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Financial Breakdown</h2>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Money Paid (Published)
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Sum of completed payments for contests that are published
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(safeOverview.totalMoneyPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              Completed payments for published contests
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Money Paid (Unpublished)
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Completed payments for contests not yet published
                    (draft/approved)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(safeOverview.moneyPaidUnpublished)}
            </div>
            <p className="text-xs text-muted-foreground">
              Paid but not published
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Money Paid (Published + Unpublished)
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Sum of completed payments across all contests (published and
                    unpublished)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.totalMoneyPaid + safeOverview.moneyPaidUnpublished
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              All contests with completed payment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Money Breakdown */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Total (Without Commission)
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Sum of prize pool / CPM budget only (excludes commission)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.paymentsBreakdown.withoutCommission
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total money paid excluding commission
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Total Commission
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Commission collected from completed payments
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.paymentsBreakdown.commission
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total commission paid
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Total (With Commission)
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Total payments received (includes commission)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.paymentsBreakdown.withCommission
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total money paid including commission
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projected Breakdown */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Projected (Without Commission)
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Projected prize pool / CPM budgets only (excludes
                    commission)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(safeOverview.totalProjectedSpent)}
            </div>
            <p className="text-xs text-muted-foreground">
              Budgets/prize pools set (paid + not-yet-paid)
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Projected (With Commission)
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Projected budgets plus estimated commission (based on
                    payment details)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.totalProjectedSpent +
                  (safeOverview.paymentsBreakdown.commission || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Includes payments made + budgets set on not-yet-paid contests
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Total Money in Draft (Not Paid)
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Budgets/prize pools on contests still in draft and not yet
                    paid
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(safeOverview.moneyInDraftNotPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              Draft contests only (unpaid)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
