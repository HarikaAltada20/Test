'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { SubmissionWithContest, CpmContestDetails } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Filter, Video, AlertCircle, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnhancedTabs as Tabs, EnhancedTabsContent as TabsContent, EnhancedTabsList as TabsList, EnhancedTabsTrigger as TabsTrigger } from "@/components/ui/enhanced-tabs";
import Image from 'next/image';
import React from 'react';

interface SubmissionsClientProps {
    initialSubmissions: SubmissionWithContest[];
    fetchError?: string;
}

type ContestTypeFilter = 'all' | 'leaderboard' | 'cpm';
type StatusFilter = 'all' | 'active' | 'pending' | 'verified' | 'rejected' | 'ended' | 'paid';
type PlatformFilter = 'all' | 'youtube' | 'instagram' | 'other';

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
        if (!submission.status) return 'Unknown'; // Fallback for missing status
        // Capitalize first letter of submission.status for display
        return submission.status.charAt(0).toUpperCase() + submission.status.slice(1);
    };

    const postContestStatusMap: Record<string, string> = {
        'pending_review': 'Pending Review',
        'in_review': 'In Review',
        'verification_complete': 'Verification Complete',
        'payouts_processed': 'Payouts Processed'
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

            {/* Enhanced Tabs with better visual distinction and responsive design */}
            <Tabs defaultValue="all" value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)} className="mb-8">
                <TabsList>
                    <TabsTrigger value="all">
                        All
                    </TabsTrigger>
                    <TabsTrigger value="active">
                        Active
                    </TabsTrigger>
                    <TabsTrigger value="pending">
                        Pending
                    </TabsTrigger>
                    <TabsTrigger value="verified">
                        Verified
                    </TabsTrigger>
                    <TabsTrigger value="rejected">
                        Rejected
                    </TabsTrigger>
                    <TabsTrigger value="ended">
                        Ended
                    </TabsTrigger>
                    <TabsTrigger value="paid">
                        Paid
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={statusFilter} className="space-y-4">
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl font-bold">{filterDisplayInfo[statusFilter].title}</CardTitle>
                                    <CardDescription className="mt-1">{filterDisplayInfo[statusFilter].description}</CardDescription>
                                </div>
                                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
                                    {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6">
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

                                    let primaryEarningsDisplay: React.ReactNode | null = null;

                                    if (contest?.contest_type === 'cpm') {
                                        let cpmLabel = "";
                                        let cpmAmount: string | number = "0.00";

                                        if (submission.status === 'paid') {
                                            cpmLabel = "Paid";
                                            cpmAmount = submission.earnings?.toFixed(2) || "0.00";
                                        } else if (submission.status === 'rejected') {
                                            cpmLabel = isEnded ? "Earnings" : "Est. Earnings";
                                            cpmAmount = "0.00";
                                        } else { // pending or verified
                                            let effectiveViews = views;
                                            if (cpmConfig?.min_views != null && views < cpmConfig.min_views) {
                                                effectiveViews = 0;
                                            } else if (cpmConfig?.max_views != null && views > cpmConfig.max_views) {
                                                effectiveViews = cpmConfig.max_views;
                                            }
                                            const calculatedEarnings = (effectiveViews * (cpmConfig?.cpm_rate_usd || 0) / 1000);
                                            cpmAmount = calculatedEarnings.toFixed(2);
                                            if (isEnded) {
                                                cpmLabel = "Final Earnings";
                                            } else {
                                                cpmLabel = "Est. Earnings";
                                            }
                                        }
                                        primaryEarningsDisplay = (
                                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                {cpmLabel}: <span className="text-base">${cpmAmount}</span> USD
                                            </p>
                                        );

                                    } else if (contest?.contest_type === 'leaderboard') {
                                        if (!isEnded) { // LIVE Leaderboard
                                            if (contestId) {
                                                primaryEarningsDisplay = (
                                                    <Link href={`/dashboard/opportunities/${contestId}#leaderboard`} className="text-xs text-sky-600 dark:text-sky-400 hover:underline mt-0.5 block">
                                                        View contest for leaderboard standing.
                                                    </Link>
                                                );
                                            }
                                        } else { // ENDED Leaderboard
                                            // Uses the new contest.post_contest_status field
                                            const postContestStatus = submission.contests?.post_contest_status as string | undefined;
                                            const calculatedAmount = submission.earnings?.toFixed(2) || "0.00";
                                            let leaderBoardLabel = "";

                                            if (submission.status === 'paid') {
                                                leaderBoardLabel = "Paid";
                                            } else {
                                                switch (postContestStatus) {
                                                    case 'pending_review':
                                                    case 'in_review':
                                                        leaderBoardLabel = "Est. Earnings";
                                                        break;
                                                    case 'verification_complete':
                                                    case 'payouts_processed':
                                                        leaderBoardLabel = "Final Earnings";
                                                        break;
                                                    default: // Fallback if post_contest_status is not set or has an unexpected value
                                                        leaderBoardLabel = "Earnings";
                                                }
                                            }
                                            primaryEarningsDisplay = (
                                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                    {leaderBoardLabel}: <span className="text-base">${calculatedAmount}</span> USD
                                                </p>
                                            );
                                        }
                                    }
                                    // If contest_type is other than 'cpm' or 'leaderboard', primaryEarningsDisplay remains null.

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
                                                        {isEnded && submission.contests?.post_contest_status && postContestStatusMap[submission.contests.post_contest_status] && (
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                                Contest Stage: <span className="font-medium">{postContestStatusMap[submission.contests.post_contest_status]}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                                                <div className="text-sm text-left sm:text-right p-3 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 min-w-[200px]">
                                                    <p className="font-medium text-slate-700 dark:text-slate-300">{views.toLocaleString()} views</p>

                                                    {primaryEarningsDisplay}

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
                        </CardContent>
                    </Card>

                    {filteredSubmissions.length === 0 && (
                        <div className="col-span-full text-center py-12">
                            <Video className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                            <h2 className="text-xl font-medium mb-2">No submissions found</h2>
                            <p className="text-muted-foreground mb-4">
                                You haven't submitted any content for contests matching the current filter criteria.
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/opportunities">Browse Opportunities</Link>
                            </Button>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
} 