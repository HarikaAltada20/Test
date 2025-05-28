'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { SubmissionWithContest, CpmContestDetails } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Filter, Video, AlertCircle, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from 'next/image';

interface SubmissionsClientProps {
    initialSubmissions: SubmissionWithContest[];
    fetchError?: string;
}

type ContestTypeFilter = 'all' | 'leaderboard' | 'cpm';
type StatusFilter = 'all' | 'active' | 'pending' | 'verified' | 'rejected' | 'ended' | 'paid';
type PlatformFilter = 'all' | 'youtube' | 'instagram' | 'tiktok' | 'other';

export default function SubmissionsClient({
    initialSubmissions,
    fetchError,
}: SubmissionsClientProps) {
    const [allSubmissions, setAllSubmissions] = useState<SubmissionWithContest[]>(initialSubmissions);
    const [filteredSubmissions, setFilteredSubmissions] = useState<SubmissionWithContest[]>(initialSubmissions);

    const [contestTypeFilter, setContestTypeFilter] = useState<ContestTypeFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

    // Helper for dynamic card titles and descriptions
    const filterDisplayInfo: Record<StatusFilter, { title: string; description: string }> = {
        all: { title: "All Submissions", description: "Showing all your submissions across different statuses." },
        active: { title: "Active Submissions", description: "Submissions for ongoing contests with 'pending' or 'verified' status." },
        pending: { title: "Pending Submissions", description: "Submissions that are awaiting verification." },
        verified: { title: "Verified Submissions", description: "Submissions that have been verified by the team." },
        rejected: { title: "Rejected Submissions", description: "Submissions that have been rejected." },
        ended: { title: "Ended Submissions", description: "Submissions for contests that have already ended." },
        paid: { title: "Paid Submissions", description: "Submissions for which earnings have been paid out." },
    };

    useEffect(() => {
        setAllSubmissions(initialSubmissions);
        setFilteredSubmissions(initialSubmissions);
    }, [initialSubmissions]);

    useEffect(() => {
        let submissions = [...allSubmissions];

        // Filter by contest type
        if (contestTypeFilter !== 'all') {
            submissions = submissions.filter(sub => sub.contests?.contest_type === contestTypeFilter);
        }

        // Filter by platform
        if (platformFilter !== 'all') {
            submissions = submissions.filter(sub => sub.platform?.toLowerCase() === platformFilter);
        }

        // Filter by status
        if (statusFilter !== 'all') {
            submissions = submissions.filter(sub => {
                const contestEndDate = sub.contests?.end_date ? new Date(sub.contests.end_date) : null;
                const isEnded = contestEndDate ? contestEndDate < new Date() : false;

                switch (statusFilter) {
                    case 'active':
                        return !isEnded && (sub.status === 'pending' || sub.status === 'verified');
                    case 'pending':
                        return sub.status === 'pending';
                    case 'verified':
                        return sub.status === 'verified';
                    case 'rejected':
                        return sub.status === 'rejected';
                    case 'ended':
                        return isEnded;
                    case 'paid':
                        return sub.status === 'paid';
                    default:
                        return true;
                }
            });
        }

        setFilteredSubmissions(submissions);
    }, [allSubmissions, contestTypeFilter, statusFilter, platformFilter]);

    const getStatusBadgeColor = (status: SubmissionWithContest['status'] | null, contestEndDate?: string | null) => {
        if (contestEndDate && new Date(contestEndDate) < new Date()) return "bg-gray-500"; // Ended
        if (status === 'verified') return "bg-green-500";
        if (status === 'pending') return "bg-yellow-500";
        if (status === 'rejected') return "bg-red-500";
        if (status === 'paid') return "bg-blue-500";
        return "bg-gray-400"; // Default or unknown
    };

    const getDisplayStatus = (submission: SubmissionWithContest): string => {
        const contestEndDate = submission.contests?.end_date ? new Date(submission.contests.end_date) : null;
        const isEnded = contestEndDate ? contestEndDate < new Date() : false;

        if (isEnded) return "Ended";
        if (submission.status === 'verified') return "Verified";
        if (submission.status === 'rejected') return "Rejected";
        if (submission.status === 'paid') return "Paid";
        if (submission.status === 'pending') return "Pending";

        return 'Unknown'; // All known statuses handled, this is a fallback.
    };


    if (fetchError) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-semibold mb-2">Error Fetching Submissions</h2>
                <p className="text-muted-foreground text-center">There was an issue retrieving your submissions: {fetchError}</p>
                <p className="text-muted-foreground text-center mt-2">Please try refreshing the page or contact support if the problem persists.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <h1 className="text-2xl font-bold">My Submissions</h1>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Select value={contestTypeFilter} onValueChange={(value) => setContestTypeFilter(value as ContestTypeFilter)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filter by Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types of Contests</SelectItem>
                            <SelectItem value="leaderboard">Leaderboard</SelectItem>
                            <SelectItem value="cpm">CPM</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={platformFilter} onValueChange={(value) => setPlatformFilter(value as PlatformFilter)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filter by Platform" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Platforms</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                        </SelectContent>
                    </Select>
                    {/* Consider replacing Button with Tabs for status filters for better UX */}
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        <Filter className="h-4 w-4 mr-2" />
                        <span>Filter by Status (Soon)</span>
                    </Button>
                    <Button size="sm" asChild className="w-full sm:w-auto">
                        <Link href="/dashboard/opportunities">Find Opportunities</Link>
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="all" value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)} className="mb-6">
                <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="verified">Verified</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="ended">Ended</TabsTrigger>
                    <TabsTrigger value="paid">Paid</TabsTrigger>
                </TabsList>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle>{filterDisplayInfo[statusFilter].title}</CardTitle>
                    <CardDescription>{filterDisplayInfo[statusFilter].description}</CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredSubmissions && filteredSubmissions.length > 0 ? (
                        <div className="space-y-6">
                            {filteredSubmissions.map((submission) => {
                                const contest = submission.contests;
                                // Correctly extract the nested cpm_contest object and type it
                                const cpmConfig = contest?.contest_type === 'cpm' && contest.contest_based_details && typeof contest.contest_based_details === 'object' && contest.contest_based_details !== null && 'cpm_contest' in contest.contest_based_details
                                    ? contest.contest_based_details.cpm_contest as unknown as CpmContestDetails
                                    : null;

                                const displayStatus = getDisplayStatus(submission);
                                const views = submission.views ?? 0;
                                const contestId = submission.contests?.id;
                                const isEnded = contest?.end_date ? new Date(contest.end_date) < new Date() : false;

                                let earningsLabel = "";
                                let earningsAmount: string | number = 0;
                                let earningsNote: string | undefined = undefined;

                                if (contest?.contest_type === 'cpm') {
                                    console.log('[CPM DEBUG] Submission ID:', submission.id, 'Status:', submission.status, 'Is Ended:', isEnded);
                                    console.log('[CPM DEBUG] Raw Views:', views, 'CPM Config extracted:', cpmConfig);

                                    if (submission.status === 'paid') {
                                        earningsLabel = "Paid";
                                        earningsAmount = submission.earnings?.toFixed(2) || "0.00";
                                    } else if (submission.status === 'rejected') {
                                        earningsLabel = isEnded ? "Earnings" : "Est. Earnings";
                                        earningsAmount = "0.00";
                                    } else { // pending or verified
                                        let effectiveViews = views;
                                        if (cpmConfig?.min_views != null && views < cpmConfig.min_views) {
                                            console.log('[CPM DEBUG] Hit MIN_VIEWS condition: views < min_views');
                                            effectiveViews = 0;
                                        } else if (cpmConfig?.max_views != null && views > cpmConfig.max_views) {
                                            console.log('[CPM DEBUG] Hit MAX_VIEWS condition: views > max_views');
                                            effectiveViews = cpmConfig.max_views;
                                        }
                                        console.log('[CPM DEBUG] Effective Views:', effectiveViews);
                                        const calculatedEarnings = (effectiveViews * (cpmConfig?.cpm_rate_usd || 0) / 1000);
                                        console.log('[CPM DEBUG] Calculated Earnings:', calculatedEarnings);
                                        earningsAmount = calculatedEarnings.toFixed(2);
                                        if (isEnded) {
                                            earningsLabel = "Final Earnings";
                                        } else {
                                            earningsLabel = "Est. Earnings";
                                        }
                                    }
                                } else { // Assumed to be 'leaderboard' if not 'cpm'
                                    if (submission.status === 'paid') {
                                        earningsLabel = "Paid";
                                        earningsAmount = submission.earnings?.toFixed(2) || "0.00";
                                    } else if (submission.status === 'rejected') {
                                        earningsLabel = "Earnings";
                                        earningsAmount = "0.00";
                                    } else { // pending or verified
                                        if (isEnded) {
                                            earningsLabel = "Earnings";
                                            earningsAmount = submission.earnings?.toFixed(2) || "0.00";
                                        } else {
                                            earningsLabel = "Est. Earnings";
                                            earningsAmount = "0.00";
                                            earningsNote = "View contest for leaderboard standing.";
                                        }
                                    }
                                }

                                return (
                                    <div
                                        key={submission.id}
                                        className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-center space-x-4 flex-grow">
                                            {submission.video_thumbnail_url ? (
                                                <Image
                                                    src={submission.video_thumbnail_url}
                                                    alt={submission.video_title || 'Video thumbnail'}
                                                    width={80}
                                                    height={45}
                                                    className="rounded object-cover aspect-video"
                                                />
                                            ) : (
                                                <div className="w-[80px] h-[45px] rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                                    <Video className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                                                </div>
                                            )}
                                            <div className="flex-grow">
                                                {contestId ? (
                                                    <Link href={`/dashboard/opportunities/${contestId}`} className="hover:underline">
                                                        <p className="text-md font-semibold text-primary dark:text-sky-400">
                                                            {contest?.title || 'Contest Title N/A'}
                                                        </p>
                                                    </Link>
                                                ) : (
                                                    <p className="text-md font-semibold">
                                                        {contest?.title || 'Contest Title N/A'}
                                                    </p>
                                                )}
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    <span>Submitted on{" "}
                                                        {submission.formatted_created_at || 'Date N/A'} |{" "}
                                                    </span>
                                                    <Badge variant="outline" className="ml-1 text-xs">
                                                        {submission.platform ? submission.platform.charAt(0).toUpperCase() + submission.platform.slice(1) : 'N/A'}
                                                    </Badge>
                                                    {contest?.contest_type && (
                                                        <Badge variant={contest.contest_type === 'cpm' ? "secondary" : "default"} className="ml-1 text-xs">
                                                            {contest.contest_type.toUpperCase()}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                                            <div className="text-sm text-left sm:text-right p-3 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 min-w-[200px]">
                                                <p className="font-medium text-slate-700 dark:text-slate-300">{views.toLocaleString()} views</p>

                                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                    {earningsLabel}: <span className="text-base">${earningsAmount}</span> USD
                                                </p>
                                                {earningsNote && contestId && (
                                                    <Link href={`/dashboard/opportunities/${contestId}#leaderboard`} className="text-xs text-sky-600 dark:text-sky-400 hover:underline mt-0.5 block">
                                                        {earningsNote}
                                                    </Link>
                                                )}

                                                <Badge
                                                    className={`mt-2 text-xs ${getStatusBadgeColor(submission.status, contest?.end_date)}`}
                                                >
                                                    {displayStatus}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                                                    <Link
                                                        href={submission.content_link || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`flex items-center justify-center ${!submission.content_link ? 'pointer-events-none opacity-50' : ''}`}
                                                    >
                                                        <ExternalLink className="h-4 w-4 mr-1.5" /> View Content
                                                    </Link>
                                                </Button>
                                                {contestId && (
                                                    <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                                                        <Link href={`/dashboard/opportunities/${contestId}`} className="flex items-center justify-center">
                                                            <Info className="h-4 w-4 mr-1.5" /> View Contest
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Video className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-medium">No submissions found</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Try adjusting your filters or find new opportunities.
                            </p>
                            {allSubmissions.length > 0 && (
                                <Button variant="link" onClick={() => { setContestTypeFilter('all'); setStatusFilter('all'); setPlatformFilter('all'); }} className="mt-2">
                                    Clear all filters
                                </Button>
                            )}
                            <Button className="mt-4" asChild>
                                <Link href="/dashboard/opportunities">Find Opportunities</Link>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 