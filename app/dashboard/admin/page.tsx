import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Trophy, Video, User, Building, DollarSign, PlayCircle, StopCircle, CheckCircle, XCircle, Eye, Info, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ContestTypeFilter from "@/components/admin/ContestTypeFilter";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
    // Verify admin access
    const { isAdmin, error } = await verifyAdminAccess();

    if (!isAdmin) {
        console.log('Non-admin user attempted to access admin dashboard:', error);
        redirect("/dashboard");
    }

    const supabase = await createClient();
    const resolvedSearch = await (searchParams || Promise.resolve({} as Record<string, string | undefined>));
    const contestTypeFilter = (resolvedSearch?.["type"] as string) || "all";

    try {
        // Fetch platform-wide statistics for admin
        const [
            { data: allContests },
            { data: allSubmissions },
            { data: allUsers }
        ] = await Promise.all([
            supabase
                .from("contests_with_status")
                .select("id, contest_type, contest_based_details, created_at, moderation_status, status, post_contest_status, payment_details"),
            supabase.from("submissions").select("id, views, status, contest_id"),
            supabase.from("users").select("id, user_type, created_at")
        ]);

        // Apply optional contest type filter
        const contests = (allContests || []).filter((c: any) =>
            contestTypeFilter === "all" ? true : c.contest_type === contestTypeFilter
        );

        // Calculate platform statistics and advanced metrics
        const totalContests = contests.length || 0;
        const totalPublishedContests = contests.filter((c: any) => c.moderation_status === 'published').length || 0;
        const totalDraftContests = contests.filter((c: any) => c.moderation_status === 'draft').length || 0;
        const totalPendingContests = contests.filter((c: any) => c.moderation_status === 'pending_approval').length || 0;
        const totalApprovedContests = contests.filter((c: any) => c.moderation_status === 'approved').length || 0;
        const totalRejectedContests = contests.filter((c: any) => c.moderation_status === 'rejected').length || 0;
        const totalActiveContests = contests.filter((c: any) => c.moderation_status === 'published' && c.status === 'active').length || 0;
        const totalUpcomingContests = contests.filter((c: any) => c.moderation_status === 'published' && c.status === 'upcoming').length || 0;
        // Completed contests are those ended AND payouts processed
        const totalCompletedContests = contests.filter((c: any) => c.moderation_status === 'published' && c.status === 'ended' && c.post_contest_status === 'payouts_processed').length || 0;
        // Ended contests should EXCLUDE the ones that are completed
        const totalEndedContests = contests.filter((c: any) => c.moderation_status === 'published' && c.status === 'ended' && c.post_contest_status !== 'payouts_processed').length || 0;

        const submissions = allSubmissions || [];
        const contestIdSet = new Set(contests.map((c: any) => c.id));
        const filteredSubmissions = contestTypeFilter === 'all'
            ? submissions
            : submissions.filter((s: any) => contestIdSet.has(s.contest_id));

        const totalViews = filteredSubmissions.reduce((sum: number, sub: any) => sum + (sub.views || 0), 0) || 0;
        const totalVerifiedViews = filteredSubmissions.reduce((sum: number, sub: any) => sum + (sub.status === 'verified' ? (sub.views || 0) : 0), 0) || 0;
        const totalPaidViews = filteredSubmissions.reduce((sum: number, sub: any) => sum + (sub.status === 'paid' ? (sub.views || 0) : 0), 0) || 0;
        const totalRejectedViews = filteredSubmissions.reduce((sum: number, sub: any) => sum + (sub.status === 'rejected' ? (sub.views || 0) : 0), 0) || 0;
        const totalPendingViews = filteredSubmissions.reduce((sum: number, sub: any) => sum + (sub.status === 'pending' ? (sub.views || 0) : 0), 0) || 0;
        const totalExpectedViews = filteredSubmissions.reduce((sum: number, sub: any) => sum + ((sub.status === 'pending' || sub.status === 'verified' || sub.status === 'paid') ? (sub.views || 0) : 0), 0) || 0;

        const totalSubmissions = filteredSubmissions.length;
        const verifiedSubmissions = filteredSubmissions.filter((s: any) => s.status === 'verified').length;
        const pendingSubmissions = filteredSubmissions.filter((s: any) => s.status === 'pending').length;
        const rejectedSubmissions = filteredSubmissions.filter((s: any) => s.status === 'rejected').length;
        const paidSubmissions = filteredSubmissions.filter((s: any) => s.status === 'paid').length;
        const totalUsers = allUsers?.length || 0;
        const totalCreators = allUsers?.filter((user: any) => user.user_type === 'creator').length || 0;
        const totalBrands = allUsers?.filter((user: any) => user.user_type === 'advertiser').length || 0;

        const parsePayment = (pd: any) => {
            if (!pd) return null as any;
            try { return typeof pd === 'string' ? JSON.parse(pd) : pd; } catch { return pd; }
        };
        const totalMoneyPaidByPublished = contests.reduce((sum: number, c: any) => {
            if (c.moderation_status !== 'published') return sum;
            const pd = parsePayment(c.payment_details);
            if (pd?.payment_status === 'completed' && typeof pd.total_amount_paid === 'number') {
                return sum + pd.total_amount_paid;
            }
            return sum;
        }, 0);

        const expectedMoneyPaidAll = contests.reduce((sum: number, c: any) => {
            const pd = parsePayment(c.payment_details);
            if (pd?.payment_status === 'completed' && typeof pd.total_amount_paid === 'number') {
                return sum + pd.total_amount_paid;
            }
            return sum;
        }, 0);

        const moneyPaidUnpublished = contests.reduce((sum: number, c: any) => {
            const pd = parsePayment(c.payment_details);
            if (c.moderation_status !== 'published' && pd?.payment_status === 'completed' && typeof pd.total_amount_paid === 'number') {
                return sum + pd.total_amount_paid;
            }
            return sum;
        }, 0);

        const projectedMoneySpent = contests.reduce((sum: number, c: any) => {
            const details = c?.contest_based_details || {};
            if (c.contest_type === 'leaderboard' && details?.leaderboard_contest?.total_prize) {
                return sum + (details.leaderboard_contest.total_prize || 0);
            }
            if (c.contest_type === 'cpm' && details?.cpm_contest?.total_budget) {
                return sum + (details.cpm_contest.total_budget || 0);
            }
            return sum;
        }, 0);

        // Budgets set on contests that are still in draft and not paid
        const totalMoneyInDraftNotPaid = contests.reduce((sum: number, c: any) => {
            if (c.moderation_status !== 'draft') return sum;
            const details = c?.contest_based_details || {};
            if (c.contest_type === 'leaderboard' && details?.leaderboard_contest?.total_prize) {
                return sum + (details.leaderboard_contest.total_prize || 0);
            }
            if (c.contest_type === 'cpm' && details?.cpm_contest?.total_budget) {
                return sum + (details.cpm_contest.total_budget || 0);
            }
            return sum;
        }, 0);

        // Payment breakdown (expected payments only)
        const paymentsBreakdown = contests.reduce((acc: any, c: any) => {
            const pd = parsePayment(c.payment_details);
            if (pd?.payment_status === 'completed') {
                const withCommission = typeof pd.total_amount_paid === 'number' ? pd.total_amount_paid : 0;
                const commission = typeof pd.commission_amount === 'number' ? pd.commission_amount : 0;
                let withoutCommission = 0;
                if (typeof pd.total_prize_pool === 'number') {
                    withoutCommission = pd.total_prize_pool;
                } else if (withCommission >= commission) {
                    withoutCommission = withCommission - commission;
                }
                acc.withCommission += withCommission;
                acc.withoutCommission += withoutCommission;
                acc.commission += commission;
            }
            return acc;
        }, { withCommission: 0, withoutCommission: 0, commission: 0 });

        // Projected breakdown (based on contest budgets + available commission info)
        const projectedCommission = contests.reduce((sum: number, c: any) => {
            const details = c?.contest_based_details || {};
            let base = 0;
            if (c.contest_type === 'leaderboard' && details?.leaderboard_contest?.total_prize) {
                base = details.leaderboard_contest.total_prize || 0;
            } else if (c.contest_type === 'cpm' && details?.cpm_contest?.total_budget) {
                base = details.cpm_contest.total_budget || 0;
            }
            const pd = parsePayment(c.payment_details);
            if (pd) {
                if (typeof pd.commission_amount === 'number') {
                    return sum + pd.commission_amount;
                }
                if (typeof pd.commission_percentage === 'number' && base > 0) {
                    return sum + Math.round(base * (pd.commission_percentage / 100));
                }
            }
            return sum;
        }, 0);
        const projectedWithCommission = projectedMoneySpent + projectedCommission;

        // Get recent activity
        const recentContests = allContests?.slice(0, 5)?.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ) || [];

        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
                        <p className="text-muted-foreground">Platform-wide statistics and management</p>
                    </div>
                </div>

                {/* Top Summary */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Total Contests */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Contests</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Includes all contests (draft + published)
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalContests}</div>
                            <p className="text-xs text-muted-foreground">All contests on platform</p>
                        </CardContent>
                    </Card>

                    {/* Total Users */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>All registered users</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <User className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Creators + Brands</p>
                        </CardContent>
                    </Card>

                    {/* Total Creators */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Creators</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>Users with role creator</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <User className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalCreators.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Creators</p>
                        </CardContent>
                    </Card>

                    {/* Total Brands */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Brands</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>Users with role advertiser</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Building className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalBrands.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Brands</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Contest Overview */}
                <div className="flex items-center justify-between mt-6">
                    <h2 className="text-lg font-semibold">Contest Overview</h2>
                    <ContestTypeFilter value={contestTypeFilter as any} />
                </div>

                {/* Contest Metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">

                    {/* Total Drafts */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Drafts</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Contests currently in draft (not submitted for approval)
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalDraftContests}</div>
                            <p className="text-xs text-muted-foreground">Draft contests</p>
                        </CardContent>
                    </Card>

                    {/* Total Pending */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Contests submitted for approval
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalPendingContests}</div>
                            <p className="text-xs text-muted-foreground">Pending approval</p>
                        </CardContent>
                    </Card>

                    {/* Total Approved */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Approved</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Contests approved and ready to publish
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalApprovedContests}</div>
                            <p className="text-xs text-muted-foreground">Approved contests</p>
                        </CardContent>
                    </Card>

                    {/* Total Rejected */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Rejected</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Contests that were rejected and need changes
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalRejectedContests}</div>
                            <p className="text-xs text-muted-foreground">Rejected contests</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Published</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Contests with moderation status set to "published"
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <PlayCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalPublishedContests}</div>
                            <p className="text-xs text-muted-foreground">Published contests</p>
                        </CardContent>
                    </Card>

                    {/* Upcoming */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Published contests with lifecycle status = upcoming
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <PlayCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalUpcomingContests}</div>
                            <p className="text-xs text-muted-foreground">Scheduled contests</p>
                        </CardContent>
                    </Card>

                    {/* Live (Active) */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Live</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Published contests currently live
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalActiveContests}</div>
                            <p className="text-xs text-muted-foreground">Currently live</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Ended</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Published contests with lifecycle status = ended
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <StopCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalEndedContests}</div>
                            <p className="text-xs text-muted-foreground">Published but ended</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Ended contests where payouts are processed (post_contest_status = payouts_processed)
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalCompletedContests}</div>
                            <p className="text-xs text-muted-foreground">Payouts processed</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Users metrics moved to Top Summary; section intentionally removed to avoid duplication */}

                {/* Submissions Metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Verified Submissions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{verifiedSubmissions.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Verified</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Submissions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{pendingSubmissions.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Pending</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Rejected Submissions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{rejectedSubmissions.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Rejected</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Paid Submissions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{paidSubmissions.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Paid</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalSubmissions.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">All submissions</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                    {/* Expected Views */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Expected Views</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>Pending + Verified + Paid views</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalExpectedViews.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Pending + Verified</p>
                        </CardContent>
                    </Card>

                    {/* Verified Views */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Verified Views</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>Views from submissions marked as verified</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalVerifiedViews.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Verified</p>
                        </CardContent>
                    </Card>

                    {/* Pending Views */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Pending Views</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>Views from submissions marked as pending</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalPendingViews.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Pending</p>
                        </CardContent>
                    </Card>

                    {/* Rejected Views */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Rejected Views</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>From rejected entries</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalRejectedViews.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">From rejected entries</p>
                        </CardContent>
                    </Card>

                    {/* Paid Views */}
                    <Card>
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
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalPaidViews.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">From paid entries</p>
                        </CardContent>
                    </Card>

                    {/* Total Views */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>All views across all submissions</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Video className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">All views</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Admin actions */}
                <div className="flex items-center justify-between mt-6">
                    <h2 className="text-lg font-semibold">Actions</h2>
                    <form action="/api/jobs/process-now" method="post">
                        <Button type="submit" variant="default">Process Payout Queue Now</Button>
                    </form>
                </div>

                {/* Money Metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Money Paid (Published)</CardTitle>
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
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(totalMoneyPaidByPublished)}</div>
                            <p className="text-xs text-muted-foreground">Completed payments for published contests</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Money Paid (Unpublished)</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Completed payments for contests not yet published (draft/approved)
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(moneyPaidUnpublished)}</div>
                            <p className="text-xs text-muted-foreground">Paid but not published</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Money Paid (Published + Unpublished)</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Sum of completed payments across all contests (published and unpublished)
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(expectedMoneyPaidAll)}</div>
                            <p className="text-xs text-muted-foreground">All contests with completed payment</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Money Breakdown (Expected payments) */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total (Without Commission)</CardTitle>
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
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(paymentsBreakdown.withoutCommission)}</div>
                            <p className="text-xs text-muted-foreground">Total money paid excluding commission</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
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
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(paymentsBreakdown.commission)}</div>
                            <p className="text-xs text-muted-foreground">Total commission paid</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total (With Commission)</CardTitle>
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
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(paymentsBreakdown.withCommission)}</div>
                            <p className="text-xs text-muted-foreground">Total money paid including commission</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Projected Breakdown */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Projected (Without Commission)</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Projected prize pool / CPM budgets only (excludes commission)
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(projectedMoneySpent)}</div>
                            <p className="text-xs text-muted-foreground">Budgets/prize pools set (paid + not-yet-paid)</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Projected (With Commission)</CardTitle>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Projected budgets plus estimated commission (based on payment details)
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(projectedWithCommission)}</div>
                            <p className="text-xs text-muted-foreground">Includes payments made + budgets set on not-yet-paid contests</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Money in Draft (Not Paid)</CardTitle>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Budgets/prize pools on contests still in draft and not yet paid
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(totalMoneyInDraftNotPaid)}</div>
                            <p className="text-xs text-muted-foreground">Draft contests only (unpaid)</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Removed extra overview sections for a cleaner admin dashboard */}
            </div>
        );

    } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Error loading admin dashboard</p>
            </div>
        );
    }
} 