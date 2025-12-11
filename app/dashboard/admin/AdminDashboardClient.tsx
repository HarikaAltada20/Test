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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
