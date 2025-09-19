"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, BarChart3, Users, Eye, DollarSign } from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";

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
    platformStats: Record<string, {
        contests: number;
        submissions: number;
        views: number;
        spent: number;
    }>;
    monthlyData: Record<string, {
        contests: number;
        submissions: number;
        views: number;
        spent: number;
    }>;
    contestTypeStats: Record<string, {
        count: number;
        submissions: number;
        views: number;
        spent: number;
    }>;
}

export default function OverviewAnalytics({ userId, activeFilter = "all" }: OverviewAnalyticsProps) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchOverviewData();
    }, [userId, activeFilter]);

    const fetchOverviewData = async () => {
        try {
            setLoading(true);
            const url = activeFilter !== "all"
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
        if (current > previous) return <TrendingUp className="w-4 h-4 text-green-500" />;
        if (current < previous) return <TrendingDown className="w-4 h-4 text-red-500" />;
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
                <p className="text-red-600 mb-4">{error || "Failed to load analytics"}</p>
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
    const last6Months = Object.keys(monthlyData)
        .sort()
        .slice(-6);

    const previousMonthData = last6Months.length > 1 ?
        monthlyData[last6Months[last6Months.length - 2]] :
        { contests: 0, submissions: 0, views: 0, spent: 0 };

    const currentMonthData = last6Months.length > 0 ?
        monthlyData[last6Months[last6Months.length - 1]] :
        { contests: 0, submissions: 0, views: 0, spent: 0 };

    return (
        <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Contests</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overview.totalContests}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {getTrendIcon(currentMonthData.contests, previousMonthData.contests)}
                            <span className={getTrendColor(currentMonthData.contests, previousMonthData.contests)}>
                                {currentMonthData.contests} this month
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overview.totalSubmissions.toLocaleString()}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {getTrendIcon(currentMonthData.submissions, previousMonthData.submissions)}
                            <span className={getTrendColor(currentMonthData.submissions, previousMonthData.submissions)}>
                                {currentMonthData.submissions} this month
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overview.totalViews.toLocaleString()}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {getTrendIcon(currentMonthData.views, previousMonthData.views)}
                            <span className={getTrendColor(currentMonthData.views, previousMonthData.views)}>
                                {currentMonthData.views.toLocaleString()} this month
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrencyFromCents(overview.totalSpent)}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {getTrendIcon(currentMonthData.spent, previousMonthData.spent)}
                            <span className={getTrendColor(currentMonthData.spent, previousMonthData.spent)}>
                                {formatCurrencyFromCents(currentMonthData.spent)} this month
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Average Cost Per View</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrencyFromCents(Math.round(overview.avgCostPerView * 100))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Lower is better
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Average Cost Per Submission</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrencyFromCents(Math.round(overview.avgCostPerSubmission * 100))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Cost per creator engagement
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Average Submissions Per Contest</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overview.avgSubmissionsPerContest.toFixed(1)}</div>
                        <p className="text-xs text-muted-foreground">
                            Creator participation rate
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Top Performing Contest */}
            {overview.topContest && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Top Performing Contest</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-lg">{overview.topContest.title}</h3>
                                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                                    <span>{overview.topContest.views.toLocaleString()} views</span>
                                    <span>{overview.topContest.submissions} submissions</span>
                                </div>
                            </div>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Best Performer
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Platform Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Platform Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {Object.entries(platformStats).map(([platform, stats]) => (
                                <div key={platform} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                            <span className="text-xs font-semibold capitalize">{platform[0]}</span>
                                        </div>
                                        <div>
                                            <p className="font-medium capitalize">{platform}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {stats.contests} contests • {stats.submissions} submissions
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{stats.views.toLocaleString()}</p>
                                        <p className="text-sm text-muted-foreground">views</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Contest Type Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {Object.entries(contestTypeStats).map(([type, stats]) => (
                                <div key={type} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium capitalize">{type.replace('_', ' ')}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {stats.count} contests • {stats.submissions} submissions
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{formatCurrencyFromCents(stats.spent)}</p>
                                        <p className="text-sm text-muted-foreground">spent</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Monthly Trends */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Monthly Trends (Last 6 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {last6Months.slice(-3).map((month) => {
                            const monthData = monthlyData[month];
                            const monthName = new Date(month + '-01').toLocaleDateString('en-US', {
                                month: 'short',
                                year: 'numeric'
                            });

                            return (
                                <div key={month} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium">{monthName}</p>
                                    </div>
                                    <div className="flex gap-6 text-sm">
                                        <div className="text-center">
                                            <p className="font-semibold">{monthData.contests}</p>
                                            <p className="text-muted-foreground">Contests</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-semibold">{monthData.submissions}</p>
                                            <p className="text-muted-foreground">Submissions</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-semibold">{monthData.views.toLocaleString()}</p>
                                            <p className="text-muted-foreground">Views</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-semibold">{formatCurrencyFromCents(monthData.spent)}</p>
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
