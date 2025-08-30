import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Trophy, Video, User, Building, DollarSign, PlayCircle, StopCircle, CheckCircle, XCircle, Eye, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrencyFromCents } from "@/lib/currency-utils";

export default async function AdminDashboardPage() {
    // Verify admin access
    const { isAdmin, error } = await verifyAdminAccess();

    if (!isAdmin) {
        console.log('Non-admin user attempted to access admin dashboard:', error);
        redirect("/dashboard");
    }

    const supabase = await createClient();

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
            supabase.from("submissions").select("id, views, status"),
            supabase.from("users").select("id, user_type, created_at")
        ]);

        // Calculate platform statistics and advanced metrics
        const totalContests = allContests?.length || 0;
        const totalPublishedContests = allContests?.filter((c: any) => c.moderation_status === 'published').length || 0;
        const totalActiveContests = allContests?.filter((c: any) => c.moderation_status === 'published' && c.status === 'active').length || 0;
        const totalEndedContests = allContests?.filter((c: any) => c.moderation_status === 'published' && c.status === 'ended').length || 0;
        const totalCompletedContests = allContests?.filter((c: any) => c.moderation_status === 'published' && c.status === 'ended' && c.post_contest_status === 'payouts_processed').length || 0;

        const totalViews = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.views || 0), 0) || 0;
        const totalVerifiedViews = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.status === 'verified' ? (sub.views || 0) : 0), 0) || 0;
        const totalPaidViews = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.status === 'paid' ? (sub.views || 0) : 0), 0) || 0;
        const totalRejectedViews = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.status === 'rejected' ? (sub.views || 0) : 0), 0) || 0;
        const totalExpectedViews = allSubmissions?.reduce((sum: number, sub: any) => sum + ((sub.status === 'pending' || sub.status === 'verified' || sub.status === 'paid') ? (sub.views || 0) : 0), 0) || 0;
        const totalCreators = allUsers?.filter(user => user.user_type === 'creator').length || 0;
        const totalBrands = allUsers?.filter(user => user.user_type === 'advertiser').length || 0;

        const parsePayment = (pd: any) => {
            if (!pd) return null as any;
            try { return typeof pd === 'string' ? JSON.parse(pd) : pd; } catch { return pd; }
        };
        const totalMoneyPaidByPublished = (allContests || []).reduce((sum: number, c: any) => {
            if (c.moderation_status !== 'published') return sum;
            const pd = parsePayment(c.payment_details);
            if (pd?.payment_status === 'completed' && typeof pd.total_amount_paid === 'number') {
                return sum + pd.total_amount_paid;
            }
            return sum;
        }, 0);

        const expectedMoneyPaidAll = (allContests || []).reduce((sum: number, c: any) => {
            const pd = parsePayment(c.payment_details);
            if (pd?.payment_status === 'completed' && typeof pd.total_amount_paid === 'number') {
                return sum + pd.total_amount_paid;
            }
            return sum;
        }, 0);

        const moneyPaidUnpublished = (allContests || []).reduce((sum: number, c: any) => {
            const pd = parsePayment(c.payment_details);
            if (c.moderation_status !== 'published' && pd?.payment_status === 'completed' && typeof pd.total_amount_paid === 'number') {
                return sum + pd.total_amount_paid;
            }
            return sum;
        }, 0);

        const projectedMoneySpent = (allContests || []).reduce((sum: number, c: any) => {
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
        const paymentsBreakdown = (allContests || []).reduce((acc: any, c: any) => {
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
        const projectedCommission = (allContests || []).reduce((sum: number, c: any) => {
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

                {/* Contests Metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
                            <p className="text-xs text-muted-foreground">
                                All contests on platform
                            </p>
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

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Active</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Published contests with lifecycle status = active (currently live)
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalActiveContests}</div>
                            <p className="text-xs text-muted-foreground">Currently live contests</p>
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

                {/* Views Metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Sum of views from all submissions, regardless of status
                                        </TooltipContent>
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

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Verified Views</CardTitle>
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
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalVerifiedViews.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Verified</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Paid Views</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Views from submissions marked as paid
                                        </TooltipContent>
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

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Rejected Views</CardTitle>
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Views from submissions marked as rejected
                                        </TooltipContent>
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

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium">Expected Views</CardTitle>
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
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalExpectedViews.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Pending + Verified</p>
                        </CardContent>
                    </Card>
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
                </div>

                {/* Money Breakdown (Expected payments) */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                </div>

                {/* Projected Breakdown (Budgets + commission estimation) */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                                <CardTitle className="text-sm font-medium">Projected Commission</CardTitle>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Estimated commission on projected budgets
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrencyFromCents(projectedCommission)}</div>
                            <p className="text-xs text-muted-foreground">Estimated commission on projected budgets</p>
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