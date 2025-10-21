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
  const [mode, setMode] = useState<"light" | "dark">("light");
  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  const isDark = mode === "dark";

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
        <div className="bg-white rounded-lg border border-gray-300 py-4">
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className="p-2 rounded-full bg-blue-50">
              <FileText className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-blue-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-center">
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
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {safeOverview.totalDraftContests}
            </div>
            <p className="text-xs text-gray-700">Draft contests</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 py-4">
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className="p-2 rounded-full bg-yellow-100">
              <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-1">
              <CardTitle className="text-xs sm:text-sm font-medium text-center">
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
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {safeOverview.totalPendingContests}
            </div>
            <p className="text-xs text-gray-700">Pending approval</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 py-4">
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className="p-2 rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-center">
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
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {safeOverview.totalApprovedContests}
            </div>
            <p className="text-xs text-gray-700">Approved contests</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 py-4">
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className="p-2 rounded-full bg-purple-100">
              <PlayCircle className="h-6 w-6 sm:h-7 sm:w-7 text-purple-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-center">
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
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {safeOverview.totalPublishedContests}
            </div>
            <p className="text-xs text-gray-700">Published contests</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 py-4">
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className="p-2 rounded-full bg-emerald-50">
              <Eye className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-center">
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
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {safeOverview.totalActiveContests}
            </div>
            <p className="text-xs text-gray-700">Currently live</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 py-4">
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className="p-2 rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-center">
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
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {safeOverview.totalCompletedContests}
            </div>
            <p className="text-xs text-gray-700">Payouts processed</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 py-4">
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className="p-2 rounded-full bg-red-100">
              <XCircle className="h-6 w-6 sm:h-7 sm:w-7 text-red-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-center">
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
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {safeOverview.totalRejectedContests}
            </div>
            <p className="text-xs text-gray-700">Rejected contests</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 py-4">
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className="p-2 rounded-full bg-orange-100">
              <Clock className="h-6 w-6 sm:h-7 sm:w-7  text-orange-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-center">
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
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {safeOverview.totalUpcomingContests}
            </div>
            <p className="text-xs text-muted-foreground">Scheduled contests</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-300 py-4">
          <div className="flex flex-col items-center space-y-2 sm:space-y-3">
            <div className="p-2 rounded-full bg-gray-100">
              <StopCircle className="h-6 w-6 sm:h-7 sm:w-7 text-gray-500" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-center">
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
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">
              {safeOverview.totalEndedContests}
            </div>
            <p className="text-xs text-gray-700">Published but ended</p>
          </div>
        </div>
      </div>

      {/* Submissions Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-white">
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

        <Card className="bg-white">
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

        <Card className="bg-white">
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
