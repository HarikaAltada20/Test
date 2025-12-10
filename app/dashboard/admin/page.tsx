import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { verifyAdminAccess } from "@/utils/admin-auth";
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
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  // Verify admin access
  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log("Non-admin user attempted to access admin dashboard:", error);
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const resolvedSearch = await (searchParams ||
    Promise.resolve({} as Record<string, string | undefined>));
  const contestTypeFilter = (resolvedSearch?.["type"] as string) || "all";

  try {
    // Fetch platform-wide statistics for admin
    const [
      { data: allContests },
      { data: allSubmissions },
      { data: allUsers },
    ] = await Promise.all([
      supabase
        .from("contests_with_status")
        .select(
          "id, contest_type, contest_based_details, created_at, moderation_status, status, post_contest_status, payment_details"
        ),
      supabase.from("submissions").select("id, views, status, contest_id"),
      supabase.from("users").select("id, user_type, created_at"),
    ]);

    // Apply optional contest type filter
    const contests = (allContests || []).filter((c: any) =>
      contestTypeFilter === "all" ? true : c.contest_type === contestTypeFilter
    );

    // Calculate platform statistics and advanced metrics
    const totalContests = contests.length || 0;
    const totalPublishedContests =
      contests.filter((c: any) => c.moderation_status === "published").length ||
      0;
    const totalDraftContests =
      contests.filter((c: any) => c.moderation_status === "draft").length || 0;
    const totalPendingContests =
      contests.filter((c: any) => c.moderation_status === "pending_approval")
        .length || 0;
    const totalApprovedContests =
      contests.filter((c: any) => c.moderation_status === "approved").length ||
      0;
    const totalRejectedContests =
      contests.filter((c: any) => c.moderation_status === "rejected").length ||
      0;
    const totalActiveContests =
      contests.filter(
        (c: any) => c.moderation_status === "published" && c.status === "active"
      ).length || 0;
    const totalUpcomingContests =
      contests.filter(
        (c: any) =>
          c.moderation_status === "published" && c.status === "upcoming"
      ).length || 0;
    // Completed contests are those ended AND payouts processed
    const totalCompletedContests =
      contests.filter(
        (c: any) =>
          c.moderation_status === "published" &&
          c.status === "ended" &&
          c.post_contest_status === "payouts_processed"
      ).length || 0;
    // Ended contests should EXCLUDE the ones that are completed
    const totalEndedContests =
      contests.filter(
        (c: any) =>
          c.moderation_status === "published" &&
          c.status === "ended" &&
          c.post_contest_status !== "payouts_processed"
      ).length || 0;

    const submissions = allSubmissions || [];
    const contestIdSet = new Set(contests.map((c: any) => c.id));
    const filteredSubmissions =
      contestTypeFilter === "all"
        ? submissions
        : submissions.filter((s: any) => contestIdSet.has(s.contest_id));

    const totalViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) => sum + (sub.views || 0),
        0
      ) || 0;
    const totalVerifiedViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "verified" ? sub.views || 0 : 0),
        0
      ) || 0;
    const totalPaidViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "paid" ? sub.views || 0 : 0),
        0
      ) || 0;
    const totalRejectedViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "rejected" ? sub.views || 0 : 0),
        0
      ) || 0;
    const totalPendingViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "pending" ? sub.views || 0 : 0),
        0
      ) || 0;
    const totalExpectedViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum +
          (sub.status === "pending" ||
          sub.status === "verified" ||
          sub.status === "paid"
            ? sub.views || 0
            : 0),
        0
      ) || 0;

    const totalSubmissions = filteredSubmissions.length;
    const verifiedSubmissions = filteredSubmissions.filter(
      (s: any) => s.status === "verified"
    ).length;
    const pendingSubmissions = filteredSubmissions.filter(
      (s: any) => s.status === "pending"
    ).length;
    const rejectedSubmissions = filteredSubmissions.filter(
      (s: any) => s.status === "rejected"
    ).length;
    const paidSubmissions = filteredSubmissions.filter(
      (s: any) => s.status === "paid"
    ).length;
    const totalUsers = allUsers?.length || 0;
    const totalCreators =
      allUsers?.filter((user: any) => user.user_type === "creator").length || 0;
    const totalBrands =
      allUsers?.filter((user: any) => user.user_type === "advertiser").length ||
      0;

    const parsePayment = (pd: any) => {
      if (!pd) return null as any;
      try {
        return typeof pd === "string" ? JSON.parse(pd) : pd;
      } catch {
        return pd;
      }
    };
    const totalMoneyPaidByPublished = contests.reduce((sum: number, c: any) => {
      if (c.moderation_status !== "published") return sum;
      const pd = parsePayment(c.payment_details);
      if (
        pd?.payment_status === "completed" &&
        typeof pd.total_amount_paid === "number"
      ) {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const expectedMoneyPaidAll = contests.reduce((sum: number, c: any) => {
      const pd = parsePayment(c.payment_details);
      if (
        pd?.payment_status === "completed" &&
        typeof pd.total_amount_paid === "number"
      ) {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const moneyPaidUnpublished = contests.reduce((sum: number, c: any) => {
      const pd = parsePayment(c.payment_details);
      if (
        c.moderation_status !== "published" &&
        pd?.payment_status === "completed" &&
        typeof pd.total_amount_paid === "number"
      ) {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const projectedMoneySpent = contests.reduce((sum: number, c: any) => {
      const details = c?.contest_based_details || {};
      if (
        c.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        return sum + (details.leaderboard_contest.total_prize || 0);
      }
      if (c.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
        return sum + (details.cpm_contest.total_budget || 0);
      }
      return sum;
    }, 0);

    // Budgets set on contests that are still in draft and not paid
    const totalMoneyInDraftNotPaid = contests.reduce((sum: number, c: any) => {
      if (c.moderation_status !== "draft") return sum;
      const details = c?.contest_based_details || {};
      if (
        c.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        return sum + (details.leaderboard_contest.total_prize || 0);
      }
      if (c.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
        return sum + (details.cpm_contest.total_budget || 0);
      }
      return sum;
    }, 0);

    // Payment breakdown (expected payments only)
    const paymentsBreakdown = contests.reduce(
      (acc: any, c: any) => {
        const pd = parsePayment(c.payment_details);
        if (pd?.payment_status === "completed") {
          const withCommission =
            typeof pd.total_amount_paid === "number" ? pd.total_amount_paid : 0;
          const commission =
            typeof pd.commission_amount === "number" ? pd.commission_amount : 0;
          let withoutCommission = 0;
          if (typeof pd.total_prize_pool === "number") {
            withoutCommission = pd.total_prize_pool;
          } else if (withCommission >= commission) {
            withoutCommission = withCommission - commission;
          }
          acc.withCommission += withCommission;
          acc.withoutCommission += withoutCommission;
          acc.commission += commission;
        }
        return acc;
      },
      { withCommission: 0, withoutCommission: 0, commission: 0 }
    );

    // Projected breakdown (based on contest budgets + available commission info)
    const projectedCommission = contests.reduce((sum: number, c: any) => {
      const details = c?.contest_based_details || {};
      let base = 0;
      if (
        c.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        base = details.leaderboard_contest.total_prize || 0;
      } else if (
        c.contest_type === "cpm" &&
        details?.cpm_contest?.total_budget
      ) {
        base = details.cpm_contest.total_budget || 0;
      }
      const pd = parsePayment(c.payment_details);
      if (pd) {
        if (typeof pd.commission_amount === "number") {
          return sum + pd.commission_amount;
        }
        if (typeof pd.commission_percentage === "number" && base > 0) {
          return sum + Math.round(base * (pd.commission_percentage / 100));
        }
      }
      return sum;
    }, 0);
    const projectedWithCommission = projectedMoneySpent + projectedCommission;

    // Get recent activity
    const recentContests =
      allContests
        ?.slice(0, 5)
        ?.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ) || [];

    return (
      <div className="space-y-8 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Admin Dashboard
            </h2>
            <p className="text-muted-foreground mt-1">
              Platform-wide statistics and management
            </p>
          </div>
        </div>

        {/* Top Summary */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Contests */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Contests
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Includes all contests (draft + published)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                All contests on platform
              </p>
            </CardContent>
          </Card>

          {/* Total Users */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Users
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>All registered users</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <User className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalUsers.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Creators + Brands</p>
            </CardContent>
          </Card>

          {/* Total Creators */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Creators
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>Users with role creator</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <User className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalCreators.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Creators</p>
            </CardContent>
          </Card>

          {/* Total Brands */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Brands
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>Users with role advertiser</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Building className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalBrands.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Brands</p>
            </CardContent>
          </Card>
        </div>

        {/* Contest Overview */}
        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Contest Overview</h2>
          <ContestTypeFilter value={contestTypeFilter as any} />
        </div>

        {/* Contest Metrics */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-6">
          {/* Total Drafts */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Drafts
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Contests currently in draft (not submitted for approval)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-gray-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalDraftContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">Draft contests</p>
            </CardContent>
          </Card>

          {/* Total Pending */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Pending
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Contests submitted for approval
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Eye className="h-5 w-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalPendingContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">Pending approval</p>
            </CardContent>
          </Card>

          {/* Total Approved */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Approved
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Contests approved and ready to publish
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalApprovedContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">Approved contests</p>
            </CardContent>
          </Card>

          {/* Total Rejected */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Rejected
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Contests that were rejected and need changes
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalRejectedContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">Rejected contests</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Published
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Contests with moderation status set to "published"
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <PlayCircle className="h-5 w-5 text-indigo-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalPublishedContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">Published contests</p>
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Upcoming
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Published contests with lifecycle status = upcoming
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                <PlayCircle className="h-5 w-5 text-cyan-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalUpcomingContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">Scheduled contests</p>
            </CardContent>
          </Card>

          {/* Live (Active) */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Live
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Published contests currently live
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Eye className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalActiveContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">Currently live</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Ended
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Published contests with lifecycle status = ended
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <StopCircle className="h-5 w-5 text-slate-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalEndedContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">Published but ended</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Completed
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Ended contests where payouts are processed
                      (post_contest_status = payouts_processed)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-teal-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalCompletedContests}
              </div>
              <p className="text-xs text-gray-500 mt-1">Payouts processed</p>
            </CardContent>
          </Card>
        </div>

        {/* Users metrics moved to Top Summary; section intentionally removed to avoid duplication */}

        {/* Submissions Metrics */}
        <div className="mt-8 mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Submissions Metrics
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Verified Submissions
              </CardTitle>
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {verifiedSubmissions.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Verified</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Pending Submissions
              </CardTitle>
              <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Eye className="h-5 w-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {pendingSubmissions.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Pending</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Rejected Submissions
              </CardTitle>
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {rejectedSubmissions.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Rejected</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Paid Submissions
              </CardTitle>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {paidSubmissions.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Paid</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Total Submissions
              </CardTitle>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Video className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalSubmissions.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">All submissions</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Views Metrics
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-6">
          {/* Expected Views */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Expected Views
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Pending + Verified + Paid views
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalExpectedViews.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Pending + Verified</p>
            </CardContent>
          </Card>

          {/* Verified Views */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Verified Views
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Views from submissions marked as verified
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalVerifiedViews.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Verified</p>
            </CardContent>
          </Card>

          {/* Pending Views */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Pending Views
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Views from submissions marked as pending
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Eye className="h-5 w-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalPendingViews.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Pending</p>
            </CardContent>
          </Card>

          {/* Rejected Views */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Rejected Views
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>From rejected entries</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalRejectedViews.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                From rejected entries
              </p>
            </CardContent>
          </Card>

          {/* Paid Views */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Paid Views
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>From paid entries</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalPaidViews.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">From paid entries</p>
            </CardContent>
          </Card>

          {/* Total Views */}
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Views
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      All views across all submissions
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Video className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {totalViews.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">All views</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin actions */}
        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Actions</h2>
          <form action="/api/jobs/process-now" method="post">
            <Button type="submit" variant="default" className="shadow-md">
              Process Payout Queue Now
            </Button>
          </form>
        </div>

        {/* Money Metrics */}
        <div className="mt-8 mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Financial Metrics
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Money Paid (Published)
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Sum of completed payments for contests that are published
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrencyFromCents(totalMoneyPaidByPublished)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Completed payments for published contests
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Money Paid (Unpublished)
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Completed payments for contests not yet published
                      (draft/approved)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrencyFromCents(moneyPaidUnpublished)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Paid but not published
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Money Paid (Published + Unpublished)
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Sum of completed payments across all contests (published
                      and unpublished)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrencyFromCents(expectedMoneyPaidAll)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                All contests with completed payment
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Money Breakdown (Expected payments) */}
        <div className="mt-8 mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Payment Breakdown
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total (Without Commission)
                </CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Sum of prize pool / CPM budget only (excludes commission)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-indigo-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrencyFromCents(paymentsBreakdown.withoutCommission)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total money paid excluding commission
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Commission
                </CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Commission collected from completed payments
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrencyFromCents(paymentsBreakdown.commission)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total commission paid
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total (With Commission)
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Total payments received (includes commission)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-teal-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrencyFromCents(paymentsBreakdown.withCommission)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total money paid including commission
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Projected Breakdown */}
        <div className="mt-8 mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Projected Breakdown
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Projected (Without Commission)
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Projected prize pool / CPM budgets only (excludes
                      commission)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-indigo-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrencyFromCents(projectedMoneySpent)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Budgets/prize pools set (paid + not-yet-paid)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Projected (With Commission)
                </CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Projected budgets plus estimated commission (based on
                      payment details)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-teal-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrencyFromCents(projectedWithCommission)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Includes payments made + budgets set on not-yet-paid contests
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Money in Draft (Not Paid)
                </CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Budgets/prize pools on contests still in draft and not yet
                      paid
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-gray-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrencyFromCents(totalMoneyInDraftNotPaid)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Draft contests only (unpaid)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Removed extra overview sections for a cleaner admin dashboard */}
      </div>
    );
  } catch (error) {
    console.error("Error fetching admin dashboard data:", error);
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Error loading admin dashboard</p>
      </div>
    );
  }
}
