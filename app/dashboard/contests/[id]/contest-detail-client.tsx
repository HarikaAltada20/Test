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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatLocalDateTime, cn } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import {
    ArrowLeft,
    Calendar,
    ChevronDown,
    Clock,
    DollarSign,
    Edit,
    ExternalLink,
    FileText,
    Lightbulb,
    ListOrdered,
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
    Trash2,
    Monitor,
    Play,
    Settings
} from "lucide-react";

// --- Local Type Definitions ---
interface Contest {
    id: string;
    title: string;
    // Moderation status (admin workflow)
    moderation_status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected';
    // Contest lifecycle status (only for published contests)
    status: 'upcoming' | 'active' | 'ended' | 'incomplete' | 'unknown' | null;
    // Post-contest status for ended contests
    post_contest_status?: 'pending_review' | 'in_review' | 'verification_complete' | 'payouts_processed' | null;
    contest_type?: "leaderboard" | "cpm" | null;
    thumbnail_url?: string | null;
    brief_html?: string | null;
    platform?: string | null;
    start_date: string | null;
    end_date: string | null;
    rules_html?: string | null;
    inspiration_links?: string[] | null;
    resources?: any | null;
    contest_based_details?: any | null;
    last_metrics_updated?: string | null;
    // Moderation tracking fields
    submitted_for_approval_at?: string | null;
    approved_at?: string | null;
    approved_by?: string | null;
    published_at?: string | null;
    rejection_reason?: string | null;
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
    const [currentContest, setCurrentContest] = useState<Contest>(contest);

    // Status update states
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [statusUpdateDialog, setStatusUpdateDialog] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [statusUpdateReason, setStatusUpdateReason] = useState('');

    // Refresh metrics state
    const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

    const cooldownInfo = getMetricsRefreshCooldownInfo(currentContest.last_metrics_updated);

    useEffect(() => {
        setCurrentSubmissions(initialSubmissions || []);
    }, [initialSubmissions]);

    useEffect(() => {
        setCurrentContest(contest);
    }, [contest]);

    if (!currentContest) {
        return <p>Loading contest details or contest not found...</p>;
    }

    { console.log("contest data", currentContest) }

    const getStatusBadgeProps = (contest: Contest) => {
        // For unpublished contests, show moderation status
        if (contest.moderation_status !== 'published') {
            switch (contest.moderation_status) {
                case "draft": return { text: "Draft", className: "bg-gray-500 text-white" };
                case "pending_approval": return { text: "Pending Approval", className: "bg-yellow-500 text-white" };
                case "approved": return { text: "Ready to Publish", className: "bg-blue-500 text-white" };
                case "rejected": return { text: "Rejected", className: "bg-red-500 text-white" };
                default: return { text: "Unknown", className: "bg-slate-400 text-white" };
            }
        }

        // For published contests, show lifecycle status
        switch (contest.status) {
            case "active": return { text: "Live", className: "bg-green-500 text-white" };
            case "upcoming": return { text: "Upcoming", className: "bg-blue-500 text-white" };
            case "ended":
                // Show post-contest status for ended contests
                if (contest.post_contest_status === "pending_review") {
                    return { text: "Pending Review", className: "bg-yellow-500 text-white" };
                }
                if (contest.post_contest_status === "in_review") {
                    return { text: "In Review", className: "bg-orange-500 text-white" };
                }
                if (contest.post_contest_status === "verification_complete") {
                    return { text: "Verified - Payment Processing", className: "bg-purple-500 text-white" };
                }
                if (contest.post_contest_status === "payouts_processed") {
                    return { text: "Verified - Payment Released", className: "bg-green-600 text-white" };
                }
                return { text: "Ended", className: "bg-gray-500 text-white" };
            case "incomplete": return { text: "Incomplete", className: "bg-yellow-500 text-black" };
            default: return { text: "Unknown", className: "bg-slate-400 text-white" };
        }
    };
    const contestStatusBadgeInfo = getStatusBadgeProps(currentContest);

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
                .select()
                .single();

            if (error) throw error;

            // Update the local submissions state
            setCurrentSubmissions(prev =>
                prev.map(sub =>
                    sub.id === submissionId
                        ? { ...sub, status: newStatus }
                        : sub
                )
            );

            toast({
                title: "Status Updated",
                description: `Submission status updated to ${newStatus}`,
            });
        } catch (error) {
            console.error('Error updating submission status:', error);
            toast({
                title: "Error",
                description: "Failed to update submission status",
                variant: "destructive",
            });
        } finally {
            setIsLoadingSubmission(prev => ({ ...prev, [submissionId]: false }));
        }
    };

    const handleUpdateContestStatus = async () => {
        if (!selectedStatus) {
            toast({
                title: "Error",
                description: "Please select a status",
                variant: "destructive",
            });
            return;
        }

        setIsUpdatingStatus(true);
        try {
            const response = await fetch(`/api/contests/${contestId}/update-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: selectedStatus,
                    reason: statusUpdateReason || null,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update status');
            }

            // Update the local contest state
            setCurrentContest(prev => ({
                ...prev,
                post_contest_status: selectedStatus as any,
            }));

            toast({
                title: "Status Updated",
                description: result.message,
            });

            setStatusUpdateDialog(false);
            setSelectedStatus('');
            setStatusUpdateReason('');
        } catch (error: any) {
            console.error('Error updating contest status:', error);
            toast({
                title: "Error",
                description: error.message || "Failed to update contest status",
                variant: "destructive",
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const canUpdateContestStatus = () => {
        return currentContest.moderation_status === 'published' &&
            currentContest.status === 'ended' &&
            currentContest.post_contest_status !== 'payouts_processed';
    };

    const getAvailableStatusOptions = () => {
        const current = currentContest.post_contest_status;
        const options = [
            { value: 'pending_review', label: 'Pending Review', description: 'Contest submissions are under initial review' },
            { value: 'in_review', label: 'In Review', description: 'Active review of submissions in progress' },
            { value: 'verification_complete', label: 'Verification Complete', description: 'All submissions verified, preparing payouts' },
            { value: 'payouts_processed', label: 'Payouts Processed', description: 'All payments have been released' },
        ];

        // For non-admin users (brands), exclude payouts_processed and only allow moving forward
        if (!isAdminView) {
            const currentIndex = options.findIndex(opt => opt.value === current);
            return options
                .filter(opt => opt.value !== 'payouts_processed') // Brands cannot set payouts_processed
                .filter((_, index) => index > currentIndex);
        }

        // For admins, show all options except current
        return options.filter(opt => opt.value !== current);
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
        if (lowerPlatform?.includes("youtube")) return <Youtube className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
        if (lowerPlatform?.includes("instagram")) return <Instagram className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
        return <Share2 className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
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

    const isContestEditable = currentContest.moderation_status === 'draft' || currentContest.moderation_status === 'rejected' ||
        (currentContest.moderation_status === 'approved' && currentContest.status === 'upcoming');
    const isContestDeletable = currentContest.moderation_status === 'draft' || currentContest.moderation_status === 'rejected';

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={isAdminView ? "/dashboard/admin/contests" : "/dashboard/contests"}>
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold text-gray-900">{currentContest.title}</h1>
                <Badge className={cn(contestStatusBadgeInfo.className, "ml-3 text-xs shadow-sm")}>
                    {contestStatusBadgeInfo.text}
                </Badge>
                {currentContest.contest_type && (
                    <Badge
                        variant={currentContest.contest_type === 'cpm' ? 'secondary' : 'default'}
                        className="capitalize ml-2 text-xs shadow-sm"
                    >
                        {currentContest.contest_type === 'cpm' ? 'CPM' : 'Leaderboard'}
                    </Badge>
                )}
            </div>

            {/* Modern Contest Overview - Redesigned for better UX */}
            <div className="space-y-6 mb-8">
                {/* Quick Actions Bar */}
                <div className="flex items-center justify-end gap-2 mb-6">
                    {(currentContest.moderation_status === 'published' && (currentContest.status === 'active' || currentContest.status === 'ended')) && currentSubmissions && currentSubmissions.length > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            className={`shadow-sm ${cooldownInfo.canRefresh && !isRefreshingMetrics
                                ? 'border-green-200 text-green-700 hover:bg-green-50'
                                : 'border-gray-200 text-gray-500 cursor-not-allowed'
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
                                !cooldownInfo.canRefresh ? `Wait ${cooldownInfo.remainingMinutes}m` : 'Refresh Metrics'}
                        </Button>
                    )}

                    {/* Contest Status Update Button */}
                    {canUpdateContestStatus() && (
                        <Dialog open={statusUpdateDialog} onOpenChange={setStatusUpdateDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm">
                                    <Settings className="mr-2 h-4 w-4" />
                                    Update Status
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Update Contest Status</DialogTitle>
                                    <DialogDescription>
                                        Change the post-contest status to reflect the current stage of verification and payouts.
                                        Current status: <strong>{currentContest.post_contest_status || 'Not set'}</strong>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <label htmlFor="status" className="text-sm font-medium">
                                            New Status
                                        </label>
                                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select new status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {getAvailableStatusOptions().map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{option.label}</span>
                                                            <span className="text-xs text-muted-foreground">{option.description}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="reason" className="text-sm font-medium">
                                            Reason (Optional)
                                        </label>
                                        <Textarea
                                            id="reason"
                                            placeholder="Add a note about this status change..."
                                            value={statusUpdateReason}
                                            onChange={(e) => setStatusUpdateReason(e.target.value)}
                                            className="resize-none"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => setStatusUpdateDialog(false)}
                                        disabled={isUpdatingStatus}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleUpdateContestStatus}
                                        disabled={isUpdatingStatus || !selectedStatus}
                                    >
                                        {isUpdatingStatus ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Updating...
                                            </>
                                        ) : (
                                            'Update Status'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
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
                            asChild
                        >
                            <DeleteContestButton
                                contestId={contestId}
                                contestTitle={currentContest.title || 'this contest'}
                                isDeletable={isContestDeletable}
                            />
                        </Button>
                    )}
                </div>

                {/* Colorful Contest Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Platform Card */}
                    <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-700/50 hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    {getPlatformIcon(currentContest.platform)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-red-800 dark:text-red-300 uppercase tracking-wide">Platform</p>
                                    <p className="text-lg font-bold text-red-900 dark:text-red-100 capitalize">{currentContest.platform || 'N/A'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Duration Card */}
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Duration</p>
                                    <p className="text-lg font-bold text-green-900 dark:text-green-100">{durationDays !== null ? `${durationDays} ${durationDays === 1 ? 'day' : 'days'}` : 'N/A'}</p>
                                    {currentContest.start_date && currentContest.end_date && (
                                        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                                            {formatLocalDateTime(currentContest.start_date, { month: 'short', day: 'numeric' })} - {formatLocalDateTime(currentContest.end_date, { month: 'short', day: 'numeric' })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Prize/Budget Card */}
                    {(currentContest.contest_type === 'leaderboard' && currentContest.contest_based_details?.leaderboard_contest?.total_prize != null) && (
                        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-700/50 hover:shadow-lg transition-all duration-300">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                        <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">Prize Pool</p>
                                        <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">{formatMoney(currentContest.contest_based_details.leaderboard_contest.total_prize)}</p>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">{currentContest.contest_based_details.leaderboard_contest.winner_count} winners</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {(currentContest.contest_type === 'cpm' && currentContest.contest_based_details?.cpm_contest?.total_budget != null) && (
                        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-700/50 hover:shadow-lg transition-all duration-300">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                        <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">Total Budget</p>
                                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatMoney(currentContest.contest_based_details.cpm_contest.total_budget)}</p>
                                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">${currentContest.contest_based_details.cpm_contest.cpm_rate_usd} CPM</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Submissions Count Card */}
                    <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">Submissions</p>
                                    <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{currentSubmissions.length}</p>
                                    <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">Total entries</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Main Content Tabs */}
            <div className="mt-8">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 h-14 p-1.5 bg-muted/30 border border-border/50 shadow-sm">
                        <TabsTrigger
                            value="overview"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Overview
                        </TabsTrigger>
                        <TabsTrigger
                            value="submissions"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Submissions <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">({currentSubmissions.length})</Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="analytics"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
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
                            <CardContent className="space-y-6 p-6">
                                {currentContest.thumbnail_url && (
                                    <div className="space-y-3">
                                        <h3 className="font-semibold text-lg text-foreground">Thumbnail</h3>
                                        <div className="flex justify-center">
                                            <img
                                                src={currentContest.thumbnail_url}
                                                alt={`${currentContest.title} thumbnail`}
                                                className="max-w-full max-h-80 object-contain border rounded-lg shadow-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <h3 className="font-semibold text-lg text-foreground">Brief</h3>
                                    {currentContest.brief_html ? (
                                        <div
                                            className="prose prose-sm max-w-none text-foreground bg-muted/30 p-4 rounded-lg border"
                                            dangerouslySetInnerHTML={{ __html: currentContest.brief_html }}
                                        />
                                    ) : (
                                        <p className="text-muted-foreground bg-muted/30 p-4 rounded-lg border">No brief provided</p>
                                    )}
                                </div>

                                {/* Contest Info Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Platform Card */}
                                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700/50 hover:shadow-lg transition-all duration-300">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">Platform</p>
                                                    <p className="text-lg font-bold text-blue-900 dark:text-blue-100 capitalize">
                                                        {currentContest.platform}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Status Card */}
                                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Info className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">Status</p>
                                                    <p className="text-lg font-bold text-purple-900 dark:text-purple-100 capitalize">
                                                        {contestStatusBadgeInfo.text}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Date & Time Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Start Date Card */}
                                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Play className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Start Date & Time</p>
                                                    <p className="text-lg font-bold text-green-900 dark:text-green-100">
                                                        {formatLocalDateTime(currentContest.start_date)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* End Date Card */}
                                    <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-700/50 hover:shadow-lg transition-all duration-300">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-orange-800 dark:text-orange-300 uppercase tracking-wide">End Date & Time</p>
                                                    <p className="text-lg font-bold text-orange-900 dark:text-orange-100">
                                                        {formatLocalDateTime(currentContest.end_date)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Conditional Prize Structure / CPM Details */}
                                {currentContest.contest_type === 'leaderboard' && currentContest.contest_based_details?.leaderboard_contest && (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-lg text-foreground">Prize Structure</h3>

                                        {/* Prize Pool Summary */}
                                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700/50 rounded-xl p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg">
                                                        <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Total Prize Pool</p>
                                                        <p className="text-xl font-bold text-green-900 dark:text-green-100">
                                                            {formatMoney(currentContest.contest_based_details.leaderboard_contest.total_prize)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
                                                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">Total Winners</p>
                                                        <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                                                            {currentContest.contest_based_details.leaderboard_contest.winner_count}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Prize Distribution */}
                                        <div className="bg-muted/30 rounded-lg p-4 border">
                                            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                                                <ListOrdered className="h-4 w-4" />
                                                Prize Distribution
                                            </h4>
                                            <div className="space-y-2">
                                                {Array.isArray(currentContest.contest_based_details.leaderboard_contest.prizes) &&
                                                    currentContest.contest_based_details.leaderboard_contest.prizes
                                                        .sort((a: any, b: any) => a.position - b.position)
                                                        .map((prize: any, index: number) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center justify-between py-3 px-3 bg-background rounded-lg border border-border"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                                        {prize.position}
                                                                    </div>
                                                                    <span className="font-medium text-foreground">
                                                                        Position {prize.position}
                                                                    </span>
                                                                </div>
                                                                <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                                                                    {formatMoney(prize.amount)}
                                                                </span>
                                                            </div>
                                                        ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentContest.contest_type === 'cpm' && currentContest.contest_based_details?.cpm_contest && (
                                    <div className="space-y-3">
                                        <h3 className="font-semibold text-lg text-foreground">CPM Configuration</h3>
                                        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                            <div className="flex justify-between items-center p-2 bg-background rounded border">
                                                <span className="text-sm font-medium text-muted-foreground">CPM Rate:</span>
                                                <span className="font-semibold text-foreground">
                                                    ${parseFloat(currentContest.contest_based_details.cpm_contest.cpm_rate_usd).toFixed(2)} per 1000 views
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center p-2 bg-background rounded border">
                                                <span className="text-sm font-medium text-muted-foreground">Total Budget:</span>
                                                <span className="font-semibold text-foreground">
                                                    {formatMoney(currentContest.contest_based_details.cpm_contest.total_budget)}
                                                </span>
                                            </div>
                                            {currentContest.contest_based_details.cpm_contest.min_views != null && (
                                                <div className="flex justify-between items-center p-2 bg-background rounded border">
                                                    <span className="text-sm font-medium text-muted-foreground">Min Views:</span>
                                                    <span className="font-semibold text-foreground">
                                                        {currentContest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            {currentContest.contest_based_details.cpm_contest.max_views != null && (
                                                <div className="flex justify-between items-center p-2 bg-background rounded border">
                                                    <span className="text-sm font-medium text-muted-foreground">Max Views (Cap):</span>
                                                    <span className="font-semibold text-foreground">
                                                        {currentContest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="text-sm font-medium mt-3 mb-2 text-foreground">Terms & Conditions</h4>
                                                <div className="p-3 border rounded-lg bg-background text-sm text-foreground">
                                                    <div className="whitespace-pre-wrap break-words">
                                                        {currentContest.contest_based_details.cpm_contest.terms_conditions || "No specific terms provided."}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(currentContest as any).rules_html && (
                                    <div className="space-y-3">
                                        <h3 className="font-semibold text-lg text-foreground">Rules</h3>
                                        <div className="border rounded-lg p-4 bg-muted/30">
                                            <div
                                                className="prose prose-sm max-w-none text-foreground"
                                                dangerouslySetInnerHTML={{ __html: (currentContest as any).rules_html }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {Array.isArray(currentContest.inspiration_links) &&
                                    currentContest.inspiration_links.length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                                <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                                Inspiration Links
                                            </h3>
                                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700/50 rounded-xl p-4">
                                                <div className="space-y-3">
                                                    {currentContest.inspiration_links.map(
                                                        (link: string, idx: number) => (
                                                            <Card
                                                                key={idx}
                                                                className="bg-white dark:bg-slate-800/50 border border-purple-200 dark:border-purple-700/30 hover:shadow-md transition-all duration-300"
                                                            >
                                                                <CardContent className="p-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-purple-100 dark:bg-purple-800/30 rounded-lg">
                                                                            <ExternalLink className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                                                        </div>
                                                                        <a
                                                                            href={link}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 hover:underline font-semibold text-sm truncate flex-1"
                                                                        >
                                                                            {link}
                                                                        </a>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                {currentContest.resources &&
                                    Object.keys(currentContest.resources).length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                                <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                Resources
                                            </h3>
                                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700/50 rounded-xl p-4">
                                                <div className="space-y-3">
                                                    {Object.entries(currentContest.resources).map(
                                                        ([name, url]) => (
                                                            <Card
                                                                key={name}
                                                                className="bg-white dark:bg-slate-800/50 border border-green-200 dark:border-green-700/30 hover:shadow-md transition-all duration-300"
                                                            >
                                                                <CardContent className="p-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg">
                                                                                <Lightbulb className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                                            </div>
                                                                            <span className="font-semibold text-green-900 dark:text-green-100">{name}</span>
                                                                        </div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            asChild
                                                                            className="text-green-600 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-800/20 flex-shrink-0 font-medium"
                                                                        >
                                                                            <a
                                                                                href={url as string}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                            >
                                                                                <ExternalLink className="h-4 w-4 mr-1" />
                                                                                View Resource
                                                                            </a>
                                                                        </Button>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        )
                                                    )}
                                                </div>
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
                                                    {currentContest.platform?.toLowerCase().includes('instagram') && (
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
                                                                {currentContest.platform?.toLowerCase().includes('instagram') && (
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
                                                                            {submission.status !== 'paid' && currentContest.contest_type === 'cpm' &&
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