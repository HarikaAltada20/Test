"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

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
    Info
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
}

export default function ContestDetailClient({
    contest,
    initialSubmissions,
    durationDays,
    contestId,
}: ContestDetailClientProps) {
    const supabase = createClient();
    const { toast } = useToast();
    const [currentSubmissions, setCurrentSubmissions] = useState<Submission[]>(initialSubmissions || []);
    const [isLoadingSubmission, setIsLoadingSubmission] = useState<Record<string, boolean>>({});

    useEffect(() => {
        setCurrentSubmissions(initialSubmissions || []);
    }, [initialSubmissions]);

    if (!contest) {
        return <p>Loading contest details or contest not found...</p>;
    }

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
            <div className="flex items-center gap-2 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/contests">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">{contest.title}</h1>
                <Badge className={cn(contestStatusBadgeInfo.className, "ml-2")}>
                    {contestStatusBadgeInfo.text}
                </Badge>
                {contest.contest_type && (
                    <Badge
                        variant={contest.contest_type === 'cpm' ? 'secondary' : 'default'}
                        className="capitalize ml-2"
                    >
                        {contest.contest_type === 'cpm' ? 'CPM' : 'Leaderboard'}
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Tabs defaultValue="overview">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="submissions">Submissions ({currentSubmissions.length})</TabsTrigger>
                            <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="mt-4 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contest Details</CardTitle>
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

                        <TabsContent value="submissions" className="mt-4">
                            {currentSubmissions.length > 0 ? (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Trophy className="h-5 w-5" />
                                            Submissions Leaderboard ({currentSubmissions.length})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
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

                <div className="lg:col-span-1 space-y-6">
                    {/* Sidebar: Contest Summary and Actions (MANUALLY APPLY THIS STRUCTURE) */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Contest Summary Card (Always Visible) */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Contest Summary</CardTitle>
                                <Info className="h-5 w-5 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status:</span>
                                    <Badge className={cn(contestStatusBadgeInfo.className, "text-xs")}>{contestStatusBadgeInfo.text}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Type:</span>
                                    <span className="font-medium capitalize">{contest.contest_type || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Platform:</span>
                                    <span className="font-medium capitalize">{contest.platform || 'N/A'}</span>
                                </div>
                                {contest.start_date && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Starts:</span>
                                        <span className="font-medium">{formatLocalDateTime(contest.start_date, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                    </div>
                                )}
                                {contest.end_date && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Ends:</span>
                                        <span className="font-medium">{formatLocalDateTime(contest.end_date, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                    </div>
                                )}
                                {durationDays !== null && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Duration:</span>
                                        <span className="font-medium">{durationDays} {durationDays === 1 ? 'day' : 'days'}</span>
                                    </div>
                                )}
                                {(contest.contest_type === 'leaderboard' && contest.contest_based_details?.total_prize != null) && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Prize Pool:</span>
                                        <span className="font-medium">{formatMoney(contest.contest_based_details.total_prize)}</span>
                                    </div>
                                )}
                                {(contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest?.total_budget != null) && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Budget:</span>
                                        <span className="font-medium">{formatMoney(contest.contest_based_details.cpm_contest.total_budget)}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Conditionally render Manage Contest card */}
                        {(isContestEditable || isContestDeletable) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Manage Contest</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {isContestEditable && (
                                        <Button className="w-full" asChild>
                                            <Link href={`/dashboard/contests/${contestId}/edit`}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit Contest
                                            </Link>
                                        </Button>
                                    )}
                                    {isContestDeletable && (
                                        <DeleteContestButton
                                            contestId={contestId}
                                            contestTitle={contest.title || "Untitled Contest"}
                                            isDeletable={true}
                                            variant="outline"
                                            size="default"
                                            className="w-full"
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 