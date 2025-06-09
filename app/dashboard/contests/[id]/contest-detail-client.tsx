"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getMetricsRefreshCooldownInfo, formatRemainingTime } from "@/lib/constants";

// Removed global type imports, defining them locally below
// import { type Contest } from "@/types/contest"; 
// import { type Submission } from "@/types/submission"; 

import { DeleteContestButton } from "@/components/delete-contest-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";
import { formatLocalDateTime, formatMoney, cn } from "@/lib/utils";
import {
    ArrowLeft,
    Calendar,
    ChevronDown,
    Clock,
    DollarSign,
    Edit,
    ExternalLink,
    FileText,
    MoreVertical,
    PlayCircle,
    ThumbsUp,
    ThumbsDown,
    MessageCircle,
    Share2,
    Eye,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Trophy,
    Users,
    Instagram,
    Youtube,
    Loader2,
    Info,
    RefreshCw,
    Trash2
} from "lucide-react";

// --- Local Type Definitions ---
interface Contest {
    id: string;
    title: string;
    status: 'draft' | 'upcoming' | 'active' | 'ended' | 'completed' | 'incomplete' | 'unknown';
    contest_type?: "leaderboard" | "cpm" | null;
    thumbnail_url?: string | null;
    brief_html?: string | null;
    brief?: string | null;
    platform?: string | null;
    start_date: string | null;
    end_date: string | null;
    rules?: any | null;
    inspiration_links?: string[] | null;
    resources?: any | null;
    contest_based_details?: any | null;
    last_metrics_updated?: string | null;
}

interface Submission {
    id: string;
    created_at: string;
    content_link: string;
    status: 'pending' | 'verified' | 'rejected' | 'paid';
    views: number | null;
    other_stats: Record<string, any> | null;
    platform: string | null;
    video_thumbnail_url: string | null;
    creator_username: string | null;
    creator_avatar_url: string | null;
    creator_id: string | null;
}
// --- End Local Type Definitions ---

interface ContestDetailClientProps {
    contest: Contest;
    initialSubmissions: Submission[] | null;
    durationDays: number | null;
    contestId: string;
    isAdminView?: boolean;
}

export default function ContestDetailClient({
    contest,
    initialSubmissions,
    durationDays,
    contestId,
    isAdminView = false,
}: ContestDetailClientProps) {
    const supabase = createClient();
    const { toast } = useToast();
    const [currentSubmissions, setCurrentSubmissions] = useState<Submission[]>(initialSubmissions || []);
    const [isLoadingSubmission, setIsLoadingSubmission] = useState<Record<string, boolean>>({});

    // Refresh metrics state
    const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

    const cooldownInfo = getMetricsRefreshCooldownInfo(contest.last_metrics_updated);

    useEffect(() => {
        setCurrentSubmissions(initialSubmissions || []);
    }, [initialSubmissions]);

    if (!contest) {
        return <p>Loading contest details or contest not found...</p>;
    }

    { console.log("contest data", contest) }

    const getStatusBadgeProps = (status: Contest['status']) => {
        switch (status) {
            case "active": return { text: "Live", className: "bg-green-500 text-white" };
            case "upcoming": return { text: "Upcoming", className: "bg-blue-500 text-white" };
            case "ended":
            case "completed": return { text: "Ended", className: "bg-gray-500 text-white" };
            case "draft": return { text: "Draft", className: "bg-amber-500 text-white" };
            case "incomplete": return { text: "Incomplete", className: "bg-yellow-500 text-black" };
            default: return { text: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown", className: "bg-slate-400 text-white" };
        }
    };
    const contestStatusBadgeInfo = getStatusBadgeProps(contest.status);

    const getSubmissionStatusBadge = (status: Submission['status']) => {
        switch (status) {
            case "pending": return { text: "Pending", icon: <AlertTriangle className="h-3 w-3 mr-1.5" />, className: "bg-yellow-100 text-yellow-700 border-yellow-300" };
            case "verified": return { text: "Verified", icon: <CheckCircle2 className="h-3 w-3 mr-1.5" />, className: "bg-green-100 text-green-700 border-green-300" };
            case "rejected": return { text: "Rejected", icon: <XCircle className="h-3 w-3 mr-1.5" />, className: "bg-red-100 text-red-700 border-red-300" };
            case "paid": return { text: "Paid", icon: <DollarSign className="h-3 w-3 mr-1.5" />, className: "bg-sky-100 text-sky-700 border-sky-300" };
            default: return { text: "Unknown", icon: <AlertTriangle className="h-3 w-3 mr-1.5" />, className: "bg-gray-100 text-gray-700 border-gray-300" };
        }
    };

    const handleUpdateSubmissionStatus = async (submissionId: string, newStatus: Submission['status']) => {
        setIsLoadingSubmission(prev => ({ ...prev, [submissionId]: true }));
        try {
            const { data, error } = await supabase
                .from('submissions')
                .update({ status: newStatus })
                .eq('id', submissionId)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                throw new Error("No submission was updated. This is likely due to Row Level Security (RLS) policies. Please ensure you have permissions to update and select this submission.");
            }

            const updatedSubmission = data[0];

            setCurrentSubmissions(prevSubs =>
                prevSubs.map(sub => (sub.id === submissionId ? updatedSubmission : sub))
            );

            toast({
                title: "Success",
                description: `Submission status updated to ${newStatus}.`,
            });

        } catch (error: any) {
            console.error("Failed to update submission status:", error);
            toast({
                title: "Update Failed",
                description: error.message || "Could not update submission. Please check your permissions and try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoadingSubmission(prev => ({ ...prev, [submissionId]: false }));
        }
    };

    const handleRefreshMetrics = async () => {
        // Prevent multiple clicks
        if (isRefreshingMetrics) {
            return;
        }

        // Check rate limiting based on database value
        if (!cooldownInfo.canRefresh) {
            toast({
                title: "Please Wait",
                description: `You can refresh again in ${cooldownInfo.remainingMinutes} minute${cooldownInfo.remainingMinutes !== 1 ? 's' : ''}`,
                variant: "destructive",
            });
            return;
        }

        setIsRefreshingMetrics(true);

        try {
            // Add timeout for long-running requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

            const response = await fetch(`/api/contests/${contestId}/refresh-metrics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to refresh metrics');
            }

            toast({
                title: "Success! 🎉",
                description: `${result.message}. Budget and leaderboard updated!`,
            });

            // Refresh the page to show updated data
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error: any) {
            console.error('Failed to refresh metrics:', error);

            if (error.name === 'AbortError') {
                toast({
                    title: "Request Timeout",
                    description: "The refresh is taking longer than expected. Please check back in a few minutes.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Refresh Failed",
                    description: error.message || "Could not refresh metrics. Please try again.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsRefreshingMetrics(false);
        }
    };

    const formatStatKey = (key: string) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getPlatformIcon = (platform?: string | null) => {
        const lowerPlatform = platform?.toLowerCase();
        if (lowerPlatform?.includes("youtube")) return <Youtube className="h-5 w-5 text-red-500 flex-shrink-0" />;
        if (lowerPlatform?.includes("instagram")) return <Instagram className="h-5 w-5 text-pink-500 flex-shrink-0" />;
        return <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />;
    }

    const extractPlatformMetrics = (submission: Submission) => {
        const platform = submission.platform?.toLowerCase();
        const stats = submission.other_stats || {};
        const baseViews = submission.views || 0;

        // Extract platform-specific metrics
        if (platform?.includes('youtube')) {
            const youtubeStats = stats.youtube || stats;
            return {
                views: baseViews,
                likes: youtubeStats.likes || youtubeStats.like_count || 0,
                comments: youtubeStats.comments || youtubeStats.comment_count || 0,
                shares: 0, // Not available
                subscribers_gained: 0, // Not available
                watch_time: 0, // Not available
                engagement_rate: 0, // Not available
            };
        } else if (platform?.includes('instagram')) {
            const igStats = stats.instagram || stats;
            return {
                views: baseViews,
                likes: igStats.likes || igStats.like_count || 0,
                comments: igStats.comments || igStats.comment_count || 0,
                shares: igStats.shares || igStats.share_count || 0,
                saves: igStats.saved || 0,
                reach: igStats.reach || 0,
                impressions: igStats.impressions || 0,
                engagement_rate: igStats.engagement_rate || 0,
                total_interactions: igStats.total_interactions || 0,
            };
        } else {
            // Generic platform metrics
            return {
                views: baseViews,
                likes: stats.likes || stats.like_count || 0,
                comments: stats.comments || stats.comment_count || 0,
                shares: stats.shares || stats.share_count || 0,
                engagement_rate: stats.engagement_rate || 0,
            };
        }
    };

    const formatMetricValue = (value: any, isRate = false) => {
        if (value === null || value === undefined || value === '') return '-';
        if (typeof value === 'number') {
            if (isRate) {
                return `${(value * 100).toFixed(1)}%`;
            }
            return value.toLocaleString();
        }
        return String(value);
    };

    const isContestEditable = contest.status === 'draft' || contest.status === 'upcoming';
    const isContestDeletable = !(contest.status === 'active' || contest.status === 'ended' || contest.status === 'completed');

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={isAdminView ? "/dashboard/admin/contests" : "/dashboard/contests"}>
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold text-gray-900">{contest.title}</h1>
                <Badge className={cn(contestStatusBadgeInfo.className, "ml-3 text-xs shadow-sm")}>
                    {contestStatusBadgeInfo.text}
                </Badge>
                {contest.contest_type && (
                    <Badge
                        variant={contest.contest_type === 'cpm' ? 'secondary' : 'default'}
                        className="capitalize ml-2 text-xs shadow-sm"
                    >
                        {contest.contest_type === 'cpm' ? 'CPM' : 'Leaderboard'}
                    </Badge>
                )}
            </div>

            {/* Modern Contest Overview - Redesigned for better UX */}
            <div className="space-y-6 mb-8">
                {/* Contest Status Banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                <Trophy className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Contest Status</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge className={cn(contestStatusBadgeInfo.className, "text-xs")}>{contestStatusBadgeInfo.text}</Badge>
                                    <span className="text-sm text-gray-600">•</span>
                                    <span className="text-sm font-medium text-gray-700 capitalize">{contest.contest_type || 'N/A'} Contest</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions Buttons */}
                        <div className="flex items-center gap-2">
                            {(contest.status === 'active' || contest.status === 'ended') && currentSubmissions && currentSubmissions.length > 0 && (
                                <Button
                                    size="sm"
                                    className={`shadow-sm ${cooldownInfo.canRefresh && !isRefreshingMetrics
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                    onClick={handleRefreshMetrics}
                                    disabled={isRefreshingMetrics || !cooldownInfo.canRefresh}
                                    title={!cooldownInfo.canRefresh ? `Please wait ${cooldownInfo.remainingMinutes} more minute${cooldownInfo.remainingMinutes !== 1 ? 's' : ''}` : undefined}
                                >
                                    {isRefreshingMetrics ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                    )}
                                    {isRefreshingMetrics ? 'Updating...' :
                                        !cooldownInfo.canRefresh ? `Wait ${cooldownInfo.remainingMinutes}m` : 'Refresh'}
                                </Button>
                            )}

                            <Button size="sm" variant="outline" className="shadow-sm" asChild>
                                <Link href={isAdminView ? `/dashboard/admin/contests/${contestId}/share` : `/dashboard/contests/${contestId}/share`}>
                                    <Share2 className="mr-2 h-4 w-4" /> Share
                                </Link>
                            </Button>

                            {isContestEditable && (
                                <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" asChild>
                                    <Link href={isAdminView ? `/dashboard/admin/contests/${contestId}/edit` : `/dashboard/contests/${contestId}/edit`}>
                                        <Edit className="h-4 w-4" />
                                    </Link>
                                </Button>
                            )}

                            {isContestDeletable && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-200 text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                        if (confirm('Are you sure you want to delete this contest? This action cannot be undone.')) {
                                            console.log('Delete contest', contestId);
                                        }
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Platform Card */}
                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    {getPlatformIcon(contest.platform)}
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Platform</p>
                                    <p className="text-lg font-bold text-gray-900 capitalize">{contest.platform || 'N/A'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline Card */}
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Calendar className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Duration</p>
                                    <p className="text-lg font-bold text-gray-900">{durationDays !== null ? `${durationDays} ${durationDays === 1 ? 'day' : 'days'}` : 'N/A'}</p>
                                    {contest.start_date && contest.end_date && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            {formatLocalDateTime(contest.start_date, { month: 'short', day: 'numeric' })} - {formatLocalDateTime(contest.end_date, { month: 'short', day: 'numeric' })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Prize/Budget Card */}
                    {(contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest?.total_prize != null) && (
                        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                        <DollarSign className="h-5 w-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Prize Pool</p>
                                        <p className="text-lg font-bold text-green-600">{formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)}</p>
                                        <p className="text-xs text-gray-500 mt-1">{contest.contest_based_details.leaderboard_contest.winner_count} winners</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {(contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest?.total_budget != null) && (
                        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                        <DollarSign className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Budget</p>
                                        <p className="text-lg font-bold text-blue-600">{formatMoney(contest.contest_based_details.cpm_contest.total_budget)}</p>
                                        <p className="text-xs text-gray-500 mt-1">${contest.contest_based_details.cpm_contest.cpm_rate_usd} CPM</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Submissions Count Card */}
                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Users className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Submissions</p>
                                    <p className="text-lg font-bold text-gray-900">{currentSubmissions.length}</p>
                                    <p className="text-xs text-gray-500 mt-1">Total entries</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Main Content Tabs */}
            <div className="w-full">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-gray-50 to-gray-100 p-1 rounded-xl shadow-sm">
                        <TabsTrigger
                            value="overview"
                            className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-600 font-medium rounded-lg transition-all"
                        >
                            Overview
                        </TabsTrigger>
                        <TabsTrigger
                            value="submissions"
                            className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-600 font-medium rounded-lg transition-all"
                        >
                            Submissions ({currentSubmissions.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="analytics"
                            className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-600 font-medium rounded-lg transition-all"
                        >
                            Analytics
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-6 space-y-6">
                        <Card className="shadow-sm">
                            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                                <CardTitle className="text-gray-800 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-500" />
                                    Contest Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {contest.thumbnail_url && (
                                    <div>
                                        <h3 className="font-medium mb-2">Thumbnail</h3>
                                        <img
                                            src={contest.thumbnail_url}
                                            alt={`${contest.title} thumbnail`}
                                            className="w-full max-h-64 object-contain border rounded-md"
                                        />
                                    </div>
                                )}

                                <div>
                                    <h3 className="font-medium mb-2">Brief</h3>
                                    {(contest.brief_html || contest.brief) ? (
                                        <div
                                            className="prose prose-sm max-w-none text-muted-foreground"
                                            dangerouslySetInnerHTML={{ __html: contest.brief_html || contest.brief || '' }}
                                        />
                                    ) : (
                                        <p className="text-muted-foreground">No brief provided</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="font-medium mb-2">Platform</h3>
                                        <p className="capitalize">{contest.platform}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-medium mb-2">Status</h3>
                                        <Badge className={contestStatusBadgeInfo.className}>{contestStatusBadgeInfo.text}</Badge>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="font-medium mb-2">Start Date & Time</h3>
                                        <p>{formatLocalDateTime(contest.start_date)}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-medium mb-2">End Date & Time</h3>
                                        <p>{formatLocalDateTime(contest.end_date)}</p>
                                    </div>
                                </div>

                                {/* Conditional Prize Structure / CPM Details */}
                                {contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest && (
                                    <div>
                                        <h3 className="font-medium mb-2">Prize Structure</h3>
                                        <div className="space-y-2 border p-3 rounded-md bg-gray-50">
                                            <div className="flex items-center justify-between">
                                                <span>Total Prize Pool</span>
                                                <span className="font-semibold">
                                                    {formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Number of Winners</span>
                                                <span className="font-semibold">
                                                    {contest.contest_based_details.leaderboard_contest.winner_count}
                                                </span>
                                            </div>
                                            {Array.isArray(contest.contest_based_details.leaderboard_contest.prizes) &&
                                                contest.contest_based_details.leaderboard_contest.prizes.map((prize: any, index: number) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center justify-between pl-4"
                                                    >
                                                        <span>Position {prize.position}</span>
                                                        <span>{formatMoney(prize.amount)}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest && (
                                    <div>
                                        <h3 className="font-medium mb-2">CPM Configuration</h3>
                                        <div className="space-y-3 border p-3 rounded-md bg-gray-50">
                                            <div>
                                                <span className="text-sm text-muted-foreground">CPM Rate: </span>
                                                <span className="font-semibold">
                                                    ${parseFloat(contest.contest_based_details.cpm_contest.cpm_rate_usd).toFixed(2)} per 1000 views
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-sm text-muted-foreground">Total Budget: </span>
                                                <span className="font-semibold">
                                                    {formatMoney(contest.contest_based_details.cpm_contest.total_budget)}
                                                </span>
                                            </div>
                                            {contest.contest_based_details.cpm_contest.min_views != null && (
                                                <div>
                                                    <span className="text-sm text-muted-foreground">Min Views: </span>
                                                    <span className="font-semibold">
                                                        {contest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            {contest.contest_based_details.cpm_contest.max_views != null && (
                                                <div>
                                                    <span className="text-sm text-muted-foreground">Max Views (Cap): </span>
                                                    <span className="font-semibold">
                                                        {contest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="text-sm font-medium mt-2 mb-1">Terms & Conditions</h4>
                                                <div className="prose prose-sm max-w-none p-2 border rounded bg-white text-xs">
                                                    <pre className="whitespace-pre-wrap break-words font-sans">
                                                        {contest.contest_based_details.cpm_contest.terms_conditions || "No specific terms provided."}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {contest.rules && contest.rules.list && (
                                    <div>
                                        <h3 className="font-medium mb-2">Rules</h3>
                                        <div className="border rounded-md p-4 bg-gray-50">
                                            {Array.isArray(contest.rules.list) ? (
                                                <ul className="list-disc list-inside space-y-1">
                                                    {contest.rules.list.map(
                                                        (rule: string, idx: number) => (
                                                            <li key={idx} className="text-sm">
                                                                {rule}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            ) : (
                                                <p className="text-muted-foreground">
                                                    No rules specified
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {Array.isArray(contest.inspiration_links) &&
                                    contest.inspiration_links.length > 0 && (
                                        <div>
                                            <h3 className="font-medium mb-2">Inspiration Links</h3>
                                            <div className="border rounded-md p-4 bg-gray-50">
                                                <ul className="space-y-2">
                                                    {contest.inspiration_links.map(
                                                        (link: string, idx: number) => (
                                                            <li key={idx} className="text-sm">
                                                                <a
                                                                    href={link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:underline flex items-center"
                                                                >
                                                                    <ExternalLink className="h-3 w-3 mr-1" />
                                                                    {link}
                                                                </a>
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                {contest.resources &&
                                    Object.keys(contest.resources).length > 0 && (
                                        <div>
                                            <h3 className="font-medium mb-2">Resources</h3>
                                            <div className="border rounded-md p-4 bg-gray-50">
                                                <ul className="space-y-2">
                                                    {Object.entries(contest.resources).map(
                                                        ([name, url]) => (
                                                            <li key={name} className="text-sm">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-medium">{name}</span>
                                                                    <a
                                                                        href={url as string}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-blue-600 hover:underline flex items-center"
                                                                    >
                                                                        <ExternalLink className="h-3 w-3 mr-1" />
                                                                        View Resource
                                                                    </a>
                                                                </div>
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="submissions" className="mt-6">
                        {currentSubmissions.length > 0 ? (
                            <Card className="shadow-sm">
                                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                                    <CardTitle className="flex items-center gap-2 text-gray-800">
                                        <Trophy className="h-5 w-5 text-amber-500" />
                                        Submissions Leaderboard ({currentSubmissions.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gray-50 hover:bg-gray-50">
                                                    <TableHead className="w-12">#</TableHead>
                                                    <TableHead>Creator</TableHead>
                                                    <TableHead>Platform</TableHead>
                                                    <TableHead className="text-center">Views</TableHead>
                                                    <TableHead className="text-center">Likes</TableHead>
                                                    <TableHead className="text-center">Comments</TableHead>
                                                    {/* Dynamic headers based on contest platform */}
                                                    {contest.platform?.toLowerCase().includes('instagram') && (
                                                        <>
                                                            <TableHead className="text-center">Shares</TableHead>
                                                            <TableHead className="text-center">Saves</TableHead>
                                                            <TableHead className="text-center">Reach</TableHead>
                                                            <TableHead className="text-center">Interactions</TableHead>
                                                            {/* <TableHead className="text-center">Engagement Rate</TableHead> */}
                                                        </>
                                                    )}
                                                    <TableHead className="text-center">Status</TableHead>
                                                    <TableHead className="text-center">Submitted</TableHead>
                                                    <TableHead className="text-center">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {currentSubmissions
                                                    .sort((a, b) => (b.views || 0) - (a.views || 0)) // Sort by views descending
                                                    .map((submission, index) => {
                                                        const metrics = extractPlatformMetrics(submission);
                                                        const submissionStatus = getSubmissionStatusBadge(submission.status);
                                                        const isLoading = isLoadingSubmission[submission.id] || false;
                                                        const rank = index + 1;

                                                        return (
                                                            <TableRow key={submission.id} className={cn(
                                                                "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                                                                rank <= 3 && "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/10"
                                                            )}>
                                                                <TableCell className="font-bold text-center">
                                                                    <div className="flex items-center justify-center">
                                                                        {rank <= 3 && <Trophy className={cn("h-4 w-4 mr-1",
                                                                            rank === 1 ? "text-yellow-500" :
                                                                                rank === 2 ? "text-gray-400" :
                                                                                    "text-amber-600")} />}
                                                                        {rank}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-3">
                                                                        <Avatar className="h-10 w-10 border">
                                                                            <AvatarImage src={submission.creator_avatar_url || undefined} alt={submission.creator_username || "Creator"} />
                                                                            <AvatarFallback className="text-xs">{submission.creator_username?.charAt(0).toUpperCase() || "C"}</AvatarFallback>
                                                                        </Avatar>
                                                                        <div>
                                                                            <p className="font-medium text-sm">{submission.creator_username || "Unknown Creator"}</p>
                                                                            {submission.video_thumbnail_url && (
                                                                                <a href={submission.content_link} target="_blank" rel="noopener noreferrer"
                                                                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                                                    <PlayCircle className="h-3 w-3" />
                                                                                    View Content
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-2">
                                                                        {getPlatformIcon(submission.platform)}
                                                                        <span className="text-sm capitalize">{submission.platform || "N/A"}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center font-mono text-sm">
                                                                    {formatMetricValue(metrics.views)}
                                                                </TableCell>
                                                                <TableCell className="text-center font-mono text-sm">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <ThumbsUp className="h-3 w-3 text-blue-500" />
                                                                        {formatMetricValue(metrics.likes)}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center font-mono text-sm">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <MessageCircle className="h-3 w-3 text-green-500" />
                                                                        {formatMetricValue(metrics.comments)}
                                                                    </div>
                                                                </TableCell>
                                                                {/* Dynamic data cells based on contest platform */}
                                                                {contest.platform?.toLowerCase().includes('instagram') && (
                                                                    <>
                                                                        <TableCell className="text-center font-mono text-sm">
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <Share2 className="h-3 w-3 text-purple-500" />
                                                                                {formatMetricValue(metrics.shares)}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-center font-mono text-sm">
                                                                            {formatMetricValue((metrics as any).saves)}
                                                                        </TableCell>
                                                                        <TableCell className="text-center font-mono text-sm">
                                                                            {formatMetricValue((metrics as any).reach)}
                                                                        </TableCell>
                                                                        <TableCell className="text-center font-mono text-sm">
                                                                            {formatMetricValue((metrics as any).total_interactions)}
                                                                        </TableCell>
                                                                        {/* <TableCell className="text-center font-mono text-sm">
                                                                            {formatMetricValue(metrics.engagement_rate, true)}
                                                                        </TableCell> */}
                                                                    </>
                                                                )}
                                                                <TableCell className="text-center">
                                                                    <Badge variant="outline" className={cn("text-xs inline-flex items-center", submissionStatus.className)}>
                                                                        {submissionStatus.icon} {submissionStatus.text}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs text-muted-foreground">
                                                                    {formatLocalDateTime(submission.created_at, { dateStyle: 'short' })}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="sm" disabled={isLoading}>
                                                                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                                                                                <span className="sr-only">Actions</span>
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator />
                                                                            {submission.status !== 'verified' &&
                                                                                <DropdownMenuItem disabled={isLoading} onClick={() => handleUpdateSubmissionStatus(submission.id, 'verified')}>
                                                                                    Mark as Verified
                                                                                </DropdownMenuItem>}
                                                                            {submission.status !== 'rejected' &&
                                                                                <DropdownMenuItem disabled={isLoading} onClick={() => handleUpdateSubmissionStatus(submission.id, 'rejected')} className="text-red-600">
                                                                                    Mark as Rejected
                                                                                </DropdownMenuItem>}
                                                                            {submission.status !== 'pending' &&
                                                                                <DropdownMenuItem disabled={isLoading} onClick={() => handleUpdateSubmissionStatus(submission.id, 'pending')}>
                                                                                    Set to Pending
                                                                                </DropdownMenuItem>}
                                                                            {submission.status !== 'paid' && contest.contest_type === 'cpm' &&
                                                                                <DropdownMenuItem disabled={isLoading} onClick={() => handleUpdateSubmissionStatus(submission.id, 'paid')}>
                                                                                    Mark as Paid (CPM)
                                                                                </DropdownMenuItem>}
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem asChild>
                                                                                <a href={submission.content_link} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                                                                    <ExternalLink className="h-3 w-3 mr-2" />
                                                                                    View Content
                                                                                </a>
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="mt-4">
                                <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                                    <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
                                    <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">No Submissions Yet</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        When creators submit entries for this contest, they will appear here.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-4">
                        <Card>
                            <CardHeader><CardTitle>Contest Analytics</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="border rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="font-medium">Total Submissions</h3>
                                        </div>
                                        <p className="text-2xl font-bold">
                                            {currentSubmissions?.length || 0}
                                        </p>
                                    </div>
                                    <div className="border rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Trophy className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="font-medium">Approved Content</h3>
                                        </div>
                                        <p className="text-2xl font-bold">
                                            {currentSubmissions?.filter((s) => s.status === "verified")
                                                .length || 0}
                                        </p>
                                    </div>
                                    <div className="border rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="font-medium">Contest Duration</h3>
                                        </div>
                                        <p className="text-2xl font-bold">
                                            {durationDays ? `${durationDays} days` : "N/A"}
                                        </p>
                                    </div>
                                </div>

                                <Separator className="my-6" />

                                <div className="space-y-6">
                                    <div>
                                        <h3 className="font-medium mb-4">Views Distribution</h3>
                                        <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <p className="text-muted-foreground">
                                                Analytics visualization would appear here
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
} 