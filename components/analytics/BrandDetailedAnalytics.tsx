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
  Youtube,
  Instagram,
  Twitter,
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
  contentType?: "video" | "text_image";
  videoPlatform?: string;
  twitterAnalytics?: boolean;
  contestTypeFilter: string;
  onContestTypeFilterChange?: (value: string) => void;
  activeFilter?: string;
  analyticsQueryString: string;
}

export default function BrandDetailedAnalytics({
  userId,
  contentType = "video",
  videoPlatform = "all",
  twitterAnalytics = false,
  contestTypeFilter,
  onContestTypeFilterChange,
  activeFilter = "all",
  analyticsQueryString,
}: BrandDetailedAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const { isDark } = useAnalyticsDarkMode();

  useEffect(() => {
    fetchAnalyticsData();
  }, [analyticsQueryString]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/analytics/brand-detailed?${analyticsQueryString}`;

      const response = await fetch(url, { cache: "no-store" });

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

  if (loading && !analyticsData) {
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

  const { overview, platformStats = {}, twitterStats } = analyticsData;

  // Fallback values to prevent errors when data is missing
  const safeOverview = {
    totalQuoteReposts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
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
    viewsByStatusYoutubeInstagram: {
      expected: 0,
      verified: 0,
      pending: 0,
      rejected: 0,
      paid: 0,
      total: 0,
    },
    viewsByStatusTwitter: {
      expected: 0,
      verified: 0,
      pending: 0,
      rejected: 0,
      paid: 0,
      total: 0,
    },
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
      {/* <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campaign Overview</h2>
        <ContestTypeFilter
          value={contestTypeFilter as any}
          onChange={(value) =>
            onContestTypeFilterChange(
              value as "all" | "leaderboard" | "cpm",
            )
          }
        />
      </div> */}

      {/* Contest Status Overview */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campaign Status Overview</h2>
      </div>

      <div className="grid gap-3 sm:gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-9">
        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-blue-900/50" : "bg-blue-50",
              )}
            >
              <FileText className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-blue-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Draft Campaigns
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Campaigns currently in draft (not submitted for approval)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {safeOverview.totalDraftContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700",
              )}
            >
              Draft campaigns
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-yellow-900/50" : "bg-yellow-100",
              )}
            >
              <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-1">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900",
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
                    Campaigns submitted for approval
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {safeOverview.totalPendingContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700",
              )}
            >
              Pending approval
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-green-900/50" : "bg-green-100",
              )}
            >
              <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900",
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
                    Campaigns approved and ready to publish
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {safeOverview.totalApprovedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700",
              )}
            >
              Approved campaigns
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-purple-900/50" : "bg-purple-100",
              )}
            >
              <PlayCircle className="h-6 w-6 sm:h-7 sm:w-7 text-purple-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900",
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
                    Campaigns with moderation status set to "published"
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {safeOverview.totalPublishedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700",
              )}
            >
              Published campaigns
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-emerald-900/50" : "bg-emerald-100",
              )}
            >
              <Eye className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900",
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
                    Published campaigns currently live
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {safeOverview.totalActiveContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700",
              )}
            >
              Currently live
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-green-900/50" : "bg-green-100",
              )}
            >
              <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900",
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
                    Ended campaigns where payouts are processed
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
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {safeOverview.totalCompletedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700",
              )}
            >
              Payouts processed
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-red-900/50" : "bg-red-100",
              )}
            >
              <XCircle className="h-6 w-6 sm:h-7 sm:w-7 text-red-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900",
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
                    Campaigns that were rejected and need changes
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {safeOverview.totalRejectedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700",
              )}
            >
              Rejected campaigns
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-orange-900/50" : "bg-orange-100",
              )}
            >
              <Clock className="h-6 w-6 sm:h-7 sm:w-7  text-orange-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900",
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
                    Published campaigns with lifecycle status = upcoming
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-center mt-2 sm:mt-3">
            <div
              className={cn(
                "text-lg sm:text-xl lg:text-2xl font-bold",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {safeOverview.totalUpcomingContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-muted-foreground",
              )}
            >
              Scheduled campaigns
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg py-4",
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
          )}
        >
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-gray-700" : "bg-gray-100",
              )}
            >
              <StopCircle className="h-6 w-6 sm:h-7 sm:w-7 text-gray-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-medium text-center",
                  isDark ? "text-white" : "text-gray-900",
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
                    Published campaigns that have ended but payouts are not yet
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
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {safeOverview.totalEndedContests}
            </div>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-300" : "text-gray-700",
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
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
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
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
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
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
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
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
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
            isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
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

      {/* Views by status: one section — YouTube & Instagram when video, Twitter only when Text/Image + Twitter selected */}
      {(contentType === "video" ||
        (contentType === "text_image" && twitterAnalytics)) && (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {(contentType === "video"
              ? [
                  {
                    label: "Expected Views",
                    sub: "Pending + Verified + Paid",
                    tooltip: "Pending + Verified + Paid views",
                    value:
                      safeOverview.viewsByStatusYoutubeInstagram?.expected ?? 0,
                    Icon: Eye,
                  },
                  {
                    label: "Verified Views",
                    sub: "Verified",
                    tooltip: "Views from submissions marked as verified",
                    value:
                      safeOverview.viewsByStatusYoutubeInstagram?.verified ?? 0,
                    Icon: CheckCircle,
                  },
                  {
                    label: "Pending Views",
                    sub: "Pending",
                    tooltip: "Views from submissions marked as pending",
                    value:
                      safeOverview.viewsByStatusYoutubeInstagram?.pending ?? 0,
                    Icon: Eye,
                  },
                  {
                    label: "Rejected Views",
                    sub: "From rejected entries",
                    tooltip: "From rejected  entries",
                    value:
                      safeOverview.viewsByStatusYoutubeInstagram?.rejected ?? 0,
                    Icon: AlertCircle,
                  },
                  {
                    label: "Paid Views",
                    sub: "From paid entries",
                    tooltip: "From paid entries",
                    value:
                      safeOverview.viewsByStatusYoutubeInstagram?.paid ?? 0,
                    Icon: DollarSign,
                  },
                  {
                    label: "Total Views",
                    sub: "All views",
                    tooltip: "All views across submissions",
                    value:
                      safeOverview.viewsByStatusYoutubeInstagram?.total ?? 0,
                    Icon: Video,
                  },
                ]
              : [
                  {
                    label: "Expected Views",
                    sub: "Pending + Verified + Paid",
                    tooltip: "Pending + Verified + Paid views (Twitter)",
                    value: safeOverview.viewsByStatusTwitter?.expected ?? 0,
                    Icon: Eye,
                  },
                  {
                    label: "Verified Views",
                    sub: "Verified",
                    tooltip:
                      "Views from Twitter submissions marked as verified",
                    value: safeOverview.viewsByStatusTwitter?.verified ?? 0,
                    Icon: CheckCircle,
                  },
                  {
                    label: "Pending Views",
                    sub: "Pending",
                    tooltip: "Views from Twitter submissions marked as pending",
                    value: safeOverview.viewsByStatusTwitter?.pending ?? 0,
                    Icon: Eye,
                  },
                  {
                    label: "Rejected Views",
                    sub: "From rejected entries",
                    tooltip: "From rejected Twitter entries",
                    value: safeOverview.viewsByStatusTwitter?.rejected ?? 0,
                    Icon: AlertCircle,
                  },
                  {
                    label: "Paid Views",
                    sub: "From paid entries",
                    tooltip: "From paid Twitter entries",
                    value: safeOverview.viewsByStatusTwitter?.paid ?? 0,
                    Icon: DollarSign,
                  },
                  {
                    label: "Total Views",
                    sub: "All views",
                    tooltip:
                      "All Twitter views (impressions) across submissions",
                    value: safeOverview.viewsByStatusTwitter?.total ?? 0,
                    Icon: Video,
                  },
                ]
            ).map(({ label, sub, tooltip, value, Icon }) => (
              <Card
                key={label}
                className={cn(
                  isDark ? "bg-[#170337]" : "bg-white border border-gray-300",
                )}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {label}
                    </CardTitle>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>{tooltip}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-full",
                      isDark
                        ? "bg-[#FFFFFF36] text-white"
                        : "bg-[#D8C3FF] text-[#4A00BE]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {value.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Financial Breakdown */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Financial Breakdown</h2>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300",
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
                    Sum of completed payments for campaigns that are published
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]",
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
              Completed payments for published campaigns
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300",
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
                    Completed payments for campaigns not yet published
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
                  : "bg-[#D8C3FF] text-[#4A00BE]",
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
              : "bg-white border border-gray-300",
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
                    Sum of completed payments across all campaigns (published and
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
                  : "bg-[#D8C3FF] text-[#4A00BE]",
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.totalMoneyPaid + safeOverview.moneyPaidUnpublished,
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              All campaigns with completed payment
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
              : "bg-white border border-gray-300",
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
                  : "bg-[#D8C3FF] text-[#4A00BE]",
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.paymentsBreakdown.withoutCommission,
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
              : "bg-white border border-gray-300",
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
                  : "bg-[#D8C3FF] text-[#4A00BE]",
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.paymentsBreakdown.commission,
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
              : "bg-white border border-gray-300",
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
                  : "bg-[#D8C3FF] text-[#4A00BE]",
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.paymentsBreakdown.withCommission,
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
              : "bg-white border border-gray-300",
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
                  : "bg-[#D8C3FF] text-[#4A00BE]",
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
              : "bg-white border border-gray-300",
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
                  : "bg-[#D8C3FF] text-[#4A00BE]",
              )}
            >
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(
                safeOverview.totalProjectedSpent +
                  (safeOverview.paymentsBreakdown.commission || 0),
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Includes payments made + budgets set on not-yet-paid campaigns
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337]"
              : "bg-white border border-gray-300",
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
                    Budgets/prize pools on campaigns still in draft and not yet
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
                  : "bg-[#D8C3FF] text-[#4A00BE]",
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
              Draft campaigns only (unpaid)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
