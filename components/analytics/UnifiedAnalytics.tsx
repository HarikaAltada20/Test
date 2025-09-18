"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    Users,
    Eye,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Minus,
    Settings,
    CheckCircle,
    Clock,
    XCircle,
    Wallet,
    Calendar,
    Play,
    Pause,
    AlertCircle,
    FileText
} from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import ContestAnalytics from "./ContestAnalytics";
import CreatorAnalytics from "./CreatorAnalytics";
import BrandDetailedAnalytics from "./BrandDetailedAnalytics";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";

interface UnifiedAnalyticsProps {
    userId: string;
}

interface MetricTile {
    id: string;
    label: string;
    icon: React.ComponentType<any>;
    enabled: boolean;
    category: 'contests' | 'submissions' | 'engagement' | 'financial';
}

const defaultMetricTiles: MetricTile[] = [
    // Contest Metrics
    { id: 'total_contests', label: 'Total Contests', icon: BarChart3, enabled: true, category: 'contests' },
    { id: 'published_contests', label: 'Published Contests', icon: CheckCircle, enabled: false, category: 'contests' },
    { id: 'draft_contests', label: 'Draft Contests', icon: FileText, enabled: false, category: 'contests' },
    { id: 'active_contests', label: 'Active (Live)', icon: Play, enabled: false, category: 'contests' },
    { id: 'upcoming_contests', label: 'Upcoming', icon: Calendar, enabled: false, category: 'contests' },
    { id: 'ended_contests', label: 'Ended', icon: Pause, enabled: false, category: 'contests' },
    { id: 'pending_approval', label: 'Pending Approval', icon: AlertCircle, enabled: false, category: 'contests' },
    { id: 'approved_contests', label: 'Approved', icon: CheckCircle, enabled: false, category: 'contests' },

    // Submission Metrics
    { id: 'total_submissions', label: 'Total Submissions', icon: Users, enabled: true, category: 'submissions' },
    { id: 'verified_submissions', label: 'Verified', icon: CheckCircle, enabled: false, category: 'submissions' },
    { id: 'paid_submissions', label: 'Paid', icon: Wallet, enabled: false, category: 'submissions' },
    { id: 'pending_submissions', label: 'Pending', icon: Clock, enabled: false, category: 'submissions' },
    { id: 'rejected_submissions', label: 'Rejected', icon: XCircle, enabled: false, category: 'submissions' },

    // Engagement Metrics
    { id: 'total_views', label: 'Total Views', icon: Eye, enabled: true, category: 'engagement' },
    { id: 'total_likes', label: 'Total Likes', icon: TrendingUp, enabled: false, category: 'engagement' },
    { id: 'total_comments', label: 'Total Comments', icon: Users, enabled: false, category: 'engagement' },

    // Financial Metrics
    { id: 'total_spent', label: 'Total Spent', icon: DollarSign, enabled: true, category: 'financial' },
    { id: 'avg_cost_per_view', label: 'Avg Cost/View', icon: DollarSign, enabled: false, category: 'financial' },
    { id: 'avg_cost_per_submission', label: 'Avg Cost/Submission', icon: DollarSign, enabled: false, category: 'financial' },
];

const submissionStatusOptions = [
    { id: "all", label: "All Submissions", icon: Users },
    { id: "verified", label: "Verified", icon: CheckCircle },
    { id: "paid", label: "Paid", icon: Wallet },
    { id: "pending", label: "Pending", icon: Clock },
    { id: "rejected", label: "Rejected", icon: XCircle },
    { id: "verifiedPaid", label: "Verified + Paid", icon: CheckCircle },
];

const tabs = [
    { id: "overview", label: "Overview" },
    { id: "detailed", label: "Detailed Analytics" },
    { id: "contests", label: "Contests" },
    { id: "creators", label: "Creators" },
];

export default function UnifiedAnalytics({ userId }: UnifiedAnalyticsProps) {
    const { activeTab, setActiveTab } = useTabState(tabs, { defaultTab: "overview" });
    const [activeFilter, setActiveFilter] = useState("all");
    const [metricTiles, setMetricTiles] = useState<MetricTile[]>(defaultMetricTiles);
    const [showTileSettings, setShowTileSettings] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analyticsData, setAnalyticsData] = useState<any>(null);

    useEffect(() => {
        fetchAnalyticsData();
    }, [userId, activeFilter]);

    const fetchAnalyticsData = async () => {
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
            setAnalyticsData(result);
        } catch (err) {
            console.error("Error fetching analytics data:", err);
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

    const getMetricValue = (metricId: string) => {
        if (!analyticsData) return 0;

        switch (metricId) {
            case 'total_contests':
                return analyticsData.overview.totalContests;
            case 'total_submissions':
                return analyticsData.overview.totalSubmissions;
            case 'total_views':
                return analyticsData.overview.totalViews;
            case 'total_spent':
                return formatCurrencyFromCents(analyticsData.overview.totalSpent);
            case 'avg_cost_per_view':
                return formatCurrencyFromCents(Math.round(analyticsData.overview.avgCostPerView * 100));
            case 'avg_cost_per_submission':
                return formatCurrencyFromCents(Math.round(analyticsData.overview.avgCostPerSubmission * 100));
            default:
                return 0;
        }
    };

    const toggleMetricTile = (metricId: string) => {
        setMetricTiles(tiles =>
            tiles.map(tile =>
                tile.id === metricId
                    ? { ...tile, enabled: !tile.enabled }
                    : tile
            )
        );
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
                <p className="text-red-600 mb-4">{error || "Failed to load analytics"}</p>
                <button
                    onClick={fetchAnalyticsData}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    const enabledTiles = metricTiles.filter(tile => tile.enabled);
    const categories = ['contests', 'submissions', 'engagement', 'financial'];

    return (
        <div className="space-y-6">
            {/* Unified Filter */}
            <div className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Filter by Submission Status</h3>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTileSettings(!showTileSettings)}
                        className="flex items-center gap-2"
                    >
                        <Settings className="w-4 h-4" />
                        Customize Tiles
                    </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                    {submissionStatusOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                            <Button
                                key={option.id}
                                variant={activeFilter === option.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveFilter(option.id)}
                                className={`flex items-center gap-2 ${activeFilter === option.id
                                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                                    : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="text-sm font-medium">{option.label}</span>
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* Customizable Metric Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {enabledTiles.map((tile) => {
                    const Icon = tile.icon;
                    const value = getMetricValue(tile.id);

                    return (
                        <Card key={tile.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{tile.label}</CardTitle>
                                <Icon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{value}</div>
                                <p className="text-xs text-muted-foreground">
                                    {activeFilter === "all" ? "All submissions" : `Filtered by ${submissionStatusOptions.find(opt => opt.id === activeFilter)?.label}`}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Tile Customization Modal */}
            {showTileSettings && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">Customize Analytics Tiles</h2>
                            <Button
                                variant="outline"
                                onClick={() => setShowTileSettings(false)}
                            >
                                Close
                            </Button>
                        </div>

                        <div className="space-y-6">
                            {categories.map(category => (
                                <div key={category}>
                                    <h3 className="text-lg font-medium capitalize mb-3">{category} Metrics</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {metricTiles
                                            .filter(tile => tile.category === category)
                                            .map(tile => (
                                                <div
                                                    key={tile.id}
                                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${tile.enabled
                                                        ? "bg-purple-50 border-purple-200"
                                                        : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                                                        }`}
                                                    onClick={() => toggleMetricTile(tile.id)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <tile.icon className="w-4 h-4" />
                                                        <span className="text-sm font-medium">{tile.label}</span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <EnhancedTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                className="mb-6"
            />

            {/* Tab Content */}
            <TabContent activeTab={activeTab}>
                <TabPanel value="overview" activeTab={activeTab}>
                    <div className="space-y-6">
                        {/* Top Performing Contest */}
                        {analyticsData.overview.topContest && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Top Performing Contest</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-lg">{analyticsData.overview.topContest.title}</h3>
                                            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                                                <span>{analyticsData.overview.topContest.views.toLocaleString()} views</span>
                                                <span>{analyticsData.overview.topContest.submissions} submissions</span>
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
                                        {Object.entries(analyticsData.platformStats).map(([platform, stats]: [string, any]) => (
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
                                        {Object.entries(analyticsData.contestTypeStats).map(([type, stats]: [string, any]) => (
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
                    </div>
                </TabPanel>

                <TabPanel value="detailed" activeTab={activeTab}>
                    <BrandDetailedAnalytics userId={userId} />
                </TabPanel>

                <TabPanel value="contests" activeTab={activeTab}>
                    <ContestAnalytics userId={userId} activeFilter={activeFilter} />
                </TabPanel>

                <TabPanel value="creators" activeTab={activeTab}>
                    <CreatorAnalytics userId={userId} activeFilter={activeFilter} />
                </TabPanel>
            </TabContent>
        </div>
    );
}
