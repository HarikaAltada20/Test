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
import ContestTypeFilter from "@/components/admin/ContestTypeFilter";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

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
}: AdminDashboardClientProps) {
  // Get theme from parent layout
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      // Check data-mode attribute from parent layout
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode");
        return dataMode === "dark";
      }
      // Fallback to data-theme attribute
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme");
      return dataTheme === "dark";
    }
    return false; // Default to light mode
  });

  // Watch for theme changes from parent layout
  useEffect(() => {
    const checkTheme = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode");
        const newIsDark = currentMode === "dark";
        if (newIsDark !== isDark) {
          setIsDark(newIsDark);
        }
      }
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

  return (
    <div className="space-y-8 pb-8">
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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Contests */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Contests
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-blue-900/30" : "bg-blue-100"
              }`}
            >
              <Trophy
                className={`h-5 w-5 ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              All contests on platform
            </p>
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Users
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-purple-900/30" : "bg-purple-100"
              }`}
            >
              <User
                className={`h-5 w-5 ${
                  isDark ? "text-purple-400" : "text-purple-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalUsers.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Creators + Brands
            </p>
          </CardContent>
        </Card>

        {/* Total Creators */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Creators
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-green-900/30" : "bg-green-100"
              }`}
            >
              <User
                className={`h-5 w-5 ${
                  isDark ? "text-green-400" : "text-green-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalCreators.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Creators
            </p>
          </CardContent>
        </Card>

        {/* Total Brands */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Brands
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-orange-900/30" : "bg-orange-100"
              }`}
            >
              <Building
                className={`h-5 w-5 ${
                  isDark ? "text-orange-400" : "text-orange-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalBrands.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Brands
            </p>
          </CardContent>
        </Card>
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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-6">
        {/* Total Drafts */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Drafts
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <FileText
                className={`h-5 w-5 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalDraftContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Draft contests
            </p>
          </CardContent>
        </Card>

        {/* Total Pending */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Pending
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-yellow-900/30" : "bg-yellow-100"
              }`}
            >
              <Eye
                className={`h-5 w-5 ${
                  isDark ? "text-yellow-400" : "text-yellow-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalPendingContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Pending approval
            </p>
          </CardContent>
        </Card>

        {/* Total Approved */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Approved
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-green-900/30" : "bg-green-100"
              }`}
            >
              <CheckCircle
                className={`h-5 w-5 ${
                  isDark ? "text-green-400" : "text-green-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalApprovedContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Approved contests
            </p>
          </CardContent>
        </Card>

        {/* Total Rejected */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Rejected
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-red-900/30" : "bg-red-100"
              }`}
            >
              <XCircle
                className={`h-5 w-5 ${
                  isDark ? "text-red-400" : "text-red-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalRejectedContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Rejected contests
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Published
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-indigo-900/30" : "bg-indigo-100"
              }`}
            >
              <PlayCircle
                className={`h-5 w-5 ${
                  isDark ? "text-indigo-400" : "text-indigo-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalPublishedContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Published contests
            </p>
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Upcoming
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-cyan-900/30" : "bg-cyan-100"
              }`}
            >
              <PlayCircle
                className={`h-5 w-5 ${
                  isDark ? "text-cyan-400" : "text-cyan-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalUpcomingContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Scheduled contests
            </p>
          </CardContent>
        </Card>

        {/* Live (Active) */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Live
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-emerald-900/30" : "bg-emerald-100"
              }`}
            >
              <Eye
                className={`h-5 w-5 ${
                  isDark ? "text-emerald-400" : "text-emerald-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalActiveContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Currently live
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Ended
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-slate-800" : "bg-slate-100"
              }`}
            >
              <StopCircle
                className={`h-5 w-5 ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalEndedContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Published but ended
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Completed
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-teal-900/30" : "bg-teal-100"
              }`}
            >
              <CheckCircle
                className={`h-5 w-5 ${
                  isDark ? "text-teal-400" : "text-teal-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalCompletedContests}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Payouts processed
            </p>
          </CardContent>
        </Card>
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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle
              className={`text-sm font-semibold ${
                isDark ? "text-gray-200" : "text-gray-700"
              }`}
            >
              Verified Submissions
            </CardTitle>
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-green-900/30" : "bg-green-100"
              }`}
            >
              <CheckCircle
                className={`h-5 w-5 ${
                  isDark ? "text-green-400" : "text-green-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {verifiedSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Verified
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle
              className={`text-sm font-semibold ${
                isDark ? "text-gray-200" : "text-gray-700"
              }`}
            >
              Pending Submissions
            </CardTitle>
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-yellow-900/30" : "bg-yellow-100"
              }`}
            >
              <Eye
                className={`h-5 w-5 ${
                  isDark ? "text-yellow-400" : "text-yellow-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {pendingSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Pending
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle
              className={`text-sm font-semibold ${
                isDark ? "text-gray-200" : "text-gray-700"
              }`}
            >
              Rejected Submissions
            </CardTitle>
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-red-900/30" : "bg-red-100"
              }`}
            >
              <XCircle
                className={`h-5 w-5 ${
                  isDark ? "text-red-400" : "text-red-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {rejectedSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Rejected
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle
              className={`text-sm font-semibold ${
                isDark ? "text-gray-200" : "text-gray-700"
              }`}
            >
              Paid Submissions
            </CardTitle>
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-emerald-900/30" : "bg-emerald-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-emerald-400" : "text-emerald-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {paidSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Paid
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle
              className={`text-sm font-semibold ${
                isDark ? "text-gray-200" : "text-gray-700"
              }`}
            >
              Total Submissions
            </CardTitle>
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-blue-900/30" : "bg-blue-100"
              }`}
            >
              <Video
                className={`h-5 w-5 ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalSubmissions.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              All submissions
            </p>
          </CardContent>
        </Card>
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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-6">
        {/* Expected Views */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Expected Views
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-blue-900/30" : "bg-blue-100"
              }`}
            >
              <Eye
                className={`h-5 w-5 ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalExpectedViews.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Pending + Verified
            </p>
          </CardContent>
        </Card>

        {/* Verified Views */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Verified Views
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-green-900/30" : "bg-green-100"
              }`}
            >
              <CheckCircle
                className={`h-5 w-5 ${
                  isDark ? "text-green-400" : "text-green-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalVerifiedViews.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Verified
            </p>
          </CardContent>
        </Card>

        {/* Pending Views */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Pending Views
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-yellow-900/30" : "bg-yellow-100"
              }`}
            >
              <Eye
                className={`h-5 w-5 ${
                  isDark ? "text-yellow-400" : "text-yellow-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalPendingViews.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Pending
            </p>
          </CardContent>
        </Card>

        {/* Rejected Views */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Rejected Views
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-red-900/30" : "bg-red-100"
              }`}
            >
              <XCircle
                className={`h-5 w-5 ${
                  isDark ? "text-red-400" : "text-red-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalRejectedViews.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              From rejected entries
            </p>
          </CardContent>
        </Card>

        {/* Paid Views */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Paid Views
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-emerald-900/30" : "bg-emerald-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-emerald-400" : "text-emerald-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalPaidViews.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              From paid entries
            </p>
          </CardContent>
        </Card>

        {/* Total Views */}
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Views
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-purple-900/30" : "bg-purple-100"
              }`}
            >
              <Video
                className={`h-5 w-5 ${
                  isDark ? "text-purple-400" : "text-purple-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {totalViews.toLocaleString()}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              All views
            </p>
          </CardContent>
        </Card>
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
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Money Paid (Published)
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-green-900/30" : "bg-green-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-green-400" : "text-green-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {formatCurrencyFromCents(totalMoneyPaidByPublished)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Completed payments for published contests
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Money Paid (Unpublished)
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-yellow-900/30" : "bg-yellow-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-yellow-400" : "text-yellow-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {formatCurrencyFromCents(moneyPaidUnpublished)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Paid but not published
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Money Paid (Published + Unpublished)
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-blue-900/30" : "bg-blue-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {formatCurrencyFromCents(expectedMoneyPaidAll)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              All contests with completed payment
            </p>
          </CardContent>
        </Card>
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
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total (Without Commission)
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-indigo-900/30" : "bg-indigo-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-indigo-400" : "text-indigo-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {formatCurrencyFromCents(paymentsBreakdown.withoutCommission)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Total money paid excluding commission
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Commission
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-purple-900/30" : "bg-purple-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-purple-400" : "text-purple-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {formatCurrencyFromCents(paymentsBreakdown.commission)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Total commission paid
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total (With Commission)
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-teal-900/30" : "bg-teal-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-teal-400" : "text-teal-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {formatCurrencyFromCents(paymentsBreakdown.withCommission)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Total money paid including commission
            </p>
          </CardContent>
        </Card>
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
        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Projected (Without Commission)
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-indigo-900/30" : "bg-indigo-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-indigo-400" : "text-indigo-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {formatCurrencyFromCents(projectedMoneySpent)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Budgets/prize pools set (paid + not-yet-paid)
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Projected (With Commission)
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-teal-900/30" : "bg-teal-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-teal-400" : "text-teal-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {formatCurrencyFromCents(projectedWithCommission)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Includes payments made + budgets set on not-yet-paid contests
            </p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isDark ? "bg-[#170337]" : "bg-white"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Total Money in Draft (Not Paid)
              </CardTitle>
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
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {formatCurrencyFromCents(totalMoneyInDraftNotPaid)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Draft contests only (unpaid)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
