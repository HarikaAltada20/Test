'use client';

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Edit,
    Trophy,
    Calendar,
    Clock,
    Users,
    DollarSign,
    ExternalLink, // For View button icon

} from "lucide-react";
import { DeleteContestButton } from "@/components/delete-contest-button";
import { formatLocalDateTime, formatMoney, cn } from "@/lib/utils";

// Define the type for a contest
type Contest = {
    id: string;
    title: string | null;
    platform: string | null;
    contest_type: string | null; // 'leaderboard' or 'cpm'
    created_at: string;
    is_draft: boolean;
    status: string | null; // 'draft', 'incomplete', 'upcoming', 'active', 'ended', 'completed', 'unknown'
    start_date: string | null;
    end_date: string | null;
    live_submission_count: number | null;
    total_prize_money_sortable: number | null; // For leaderboard prize pool sorting
    contest_based_details: {
        leaderboard_contest?: {
            total_prize?: number;
            prizes?: Array<{ amount: number; position: number }>;
            winner_count?: number;
        };
        cpm_contest?: {
            total_budget?: number;
            cpm_rate_usd?: number;
            budget_spent?: number;
            max_views?: number;
        };
    } | null;
    thumbnail_url: string | null; // Added for card display
    advertiser_name?: string; // Optional: for admin view
};

interface ContestListClientProps {
    initialContests: Contest[];
    isAdminView?: boolean;
}

type SortKey = 'created_at' | 'start_date' | 'end_date' | 'status' | 'live_submission_count' | 'total_prize_money_sortable';
type SortDirection = 'asc' | 'desc';
type SortOption = `${SortKey}_${SortDirection}`;

const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "upcoming", label: "Upcoming" },
    { value: "active", label: "Live" },
    { value: "ended", label: "Ended/Completed" }, // Combined for filter simplicity
];


export function ContestListClient({ initialContests, isAdminView = false }: ContestListClientProps) {
    const router = useRouter();
    const [sortOption, setSortOption] = useState<SortOption>("created_at_desc");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [platformFilter, setPlatformFilter] = useState<string>("all");

    const availablePlatforms = useMemo(() => {
        const platforms = new Set(initialContests.map(c => c.platform).filter(Boolean) as string[]);
        return ["all", ...Array.from(platforms)];
    }, [initialContests]);

    const filterAndSortContests = (contestsToProcess: Contest[]) => {
        let contests = [...contestsToProcess];

        if (statusFilter !== "all") {
            if (statusFilter === "ended") { // "ended" filter now covers 'ended' and 'completed'
                contests = contests.filter(c => c.status === 'ended' || c.status === 'completed');
            } else {
                contests = contests.filter(c => c.status === statusFilter);
            }
        }
        if (platformFilter !== "all") {
            contests = contests.filter(c => c.platform === platformFilter);
        }

        contests.sort((a, b) => {
            const parts = sortOption.split("_");
            const key = parts.slice(0, -1).join("_") as SortKey;
            const direction = parts[parts.length - 1] as SortDirection;
            const dir = direction === "asc" ? 1 : -1;

            let valA = a[key];
            let valB = b[key];

            if (valA === null || valA === undefined) return 1 * dir;
            if (valB === null || valB === undefined) return -1 * dir;

            if (key === "created_at" || key === "start_date" || key === "end_date") {
                valA = new Date(valA as string).getTime();
                valB = new Date(valB as string).getTime();
            } else if (key === "live_submission_count" || key === "total_prize_money_sortable") {
                valA = Number(valA);
                valB = Number(valB);
            } else if (key === "status") {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });
        return contests;
    };

    const publishedContests = useMemo(() =>
        initialContests.filter(c => c.status !== 'draft' && c.status !== 'incomplete'),
        [initialContests]
    );

    const draftContests = useMemo(() =>
        initialContests.filter(c => c.status === 'draft' || c.status === 'incomplete'),
        [initialContests]
    );

    const sortedAndFilteredPublishedContests = useMemo(() => {
        return filterAndSortContests(publishedContests);
    }, [publishedContests, sortOption, statusFilter, platformFilter]);

    const sortedAndFilteredDraftContests = useMemo(() => {
        let contests = [...draftContests];
        if (platformFilter !== "all") {
            contests = contests.filter(c => c.platform === platformFilter);
        }
        // Drafts are always sorted by creation date
        contests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return contests;
    }, [draftContests, platformFilter]);


    const getStatusDisplay = (status: string | null) => {
        if (!status) return { text: "Unknown", className: "bg-slate-400 border-slate-400 text-white" };
        if (status === "active") return { text: "Live", className: "bg-green-500 border-green-500 text-white" };
        if (status === "upcoming") return { text: "Upcoming", className: "bg-blue-500 border-blue-500 text-white" };
        if (status === "ended" || status === "completed") return { text: "Ended", className: "bg-gray-500 border-gray-500 text-white" };
        if (status === "draft") return { text: "Draft", className: "bg-amber-500 border-amber-500 text-white" };
        if (status === "incomplete") return { text: "Incomplete", className: "bg-yellow-400 border-yellow-400 text-yellow-900" };
        return { text: status.charAt(0).toUpperCase() + status.slice(1), className: "bg-slate-400 border-slate-400 text-white" };
    };

    const renderContestCard = (contest: Contest) => {
        const statusDisplay = getStatusDisplay(contest.status);
        const isDraft = contest.status === 'draft' || contest.status === 'incomplete';

        // Use the pre-processed total_prize_money_sortable for display
        const leaderboardPrizeMoney = contest.contest_type === 'leaderboard'
            ? contest.total_prize_money_sortable
            : null;

        const cpmBudget = contest.contest_type === 'cpm'
            ? contest.contest_based_details?.cpm_contest?.total_budget
            : null;

        const budgetSpent = contest.contest_type === 'cpm'
            ? contest.contest_based_details?.cpm_contest?.budget_spent ?? 0
            : 0;
        const budgetProgress = (cpmBudget && cpmBudget > 0) ? Math.min((budgetSpent / cpmBudget) * 100, 100) : 0;

        return (
            <Card
                key={contest.id}
                className="overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out border dark:border-slate-700 flex flex-col group bg-white dark:bg-slate-850 hover:border-rose-500 dark:hover:border-rose-500 cursor-pointer"
                onClick={(e) => {
                    // Don't navigate if the click is on a button or interactive element
                    if ((e.target as HTMLElement).closest('button')) {
                        return;
                    }
                    const href = isAdminView ? `/dashboard/admin/contests/${contest.id}` : (isDraft ? `/dashboard/contests/create?draft=${contest.id}` : `/dashboard/contests/${contest.id}`);
                    router.push(href);
                }}
            >
                <div className="flex flex-col flex-grow">
                    <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                        {contest.thumbnail_url ? (
                            <img
                                src={contest.thumbnail_url}
                                alt={contest.title || "Contest thumbnail"}
                                className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                            />
                        ) : (
                            <Trophy className="h-16 w-16 text-slate-300 dark:text-slate-600" />
                        )}
                        <div className="absolute top-2 right-2 flex flex-col space-y-1">
                            <Badge
                                className={cn("capitalize text-xs px-2 py-0.5 font-medium border", statusDisplay.className)}
                            >
                                {statusDisplay.text}
                            </Badge>
                            {contest.contest_type && (
                                <Badge
                                    variant={contest.contest_type === 'cpm' ? "secondary" : "default"}
                                    className="capitalize text-xs px-2 py-0.5 font-medium border"
                                >
                                    {contest.contest_type === 'cpm' ? 'CPM' : 'Leaderboard'}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-300 mr-2 leading-tight truncate">
                            {contest.title || (isDraft ? "Untitled Draft" : "Untitled Contest")}
                        </CardTitle>
                        {isAdminView && contest.advertiser_name && (
                            <p className="text-xs text-muted-foreground pt-1">
                                By: {contest.advertiser_name}
                            </p>
                        )}
                        {isAdminView && !isDraft && contest.live_submission_count !== null && (
                            <p className="text-xs text-muted-foreground pt-1">
                                Submissions: {contest.live_submission_count}
                            </p>
                        )}
                    </CardHeader>
                    <CardContent className="p-4 pt-1 flex-grow flex flex-col justify-between">
                        <div className="space-y-1.5 text-sm mb-3 text-slate-600 dark:text-slate-400">
                            <div className="flex items-center">
                                <Trophy className="h-4 w-4 mr-2 flex-shrink-0 text-rose-500" />
                                <span>Platform: <span className="font-medium text-slate-700 dark:text-slate-300">{contest.platform || "N/A"}</span></span>
                            </div>
                            {contest.start_date && !isDraft && (
                                <div className="flex items-center">
                                    <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Starts: <span className="font-medium text-slate-700 dark:text-slate-300">{formatLocalDateTime(contest.start_date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                                </div>
                            )}
                            {contest.end_date && !isDraft && (
                                <div className="flex items-center">
                                    <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Ends: <span className="font-medium text-slate-700 dark:text-slate-300">{formatLocalDateTime(contest.end_date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                                </div>
                            )}
                            {isDraft && (
                                <div className="flex items-center text-amber-600 dark:text-amber-500">
                                    <Edit className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Created: <span className="font-medium">{formatLocalDateTime(contest.created_at, { month: 'short', day: 'numeric' })}</span></span>
                                </div>
                            )}
                            {!isDraft && !isAdminView && contest.live_submission_count !== null && (
                                <div className="flex items-center">
                                    <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Submissions: <span className="font-medium text-slate-700 dark:text-slate-300">{contest.live_submission_count}</span></span>
                                </div>
                            )}
                            {(leaderboardPrizeMoney !== null || cpmBudget !== null) && (
                                <div className="flex items-center">
                                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>
                                        Prize/Budget:
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                            {' '}{formatMoney(leaderboardPrizeMoney ?? cpmBudget ?? 0)}
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Budget Spent Progress Bar for CPM contests */}
                        {contest.contest_type === 'cpm' && cpmBudget && cpmBudget > 0 && !isDraft && (
                            <div className="mt-2 mb-2">
                                <div className="flex justify-between items-center text-xs mb-1">
                                    <span className="text-slate-500 dark:text-slate-400">Budget Spent</span>
                                    <span className="font-medium text-slate-600 dark:text-slate-300">{formatMoney(budgetSpent)}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                        className="bg-green-500 h-2 rounded-full"
                                        style={{ width: `${budgetProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 border-t dark:border-slate-700 mt-auto">
                            {isDraft ? (
                                <>
                                    <Button size="sm" className="flex-1 bg-rose-600 hover:bg-rose-700" asChild>
                                        <Link href={`/dashboard/contests/create?draft=${contest.id}`}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Continue Editing
                                        </Link>
                                    </Button>
                                    <DeleteContestButton
                                        contestId={contest.id}
                                        contestTitle={contest.title || 'this contest'}
                                        isDeletable={true}
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                                    />
                                </>
                            ) : (
                                <Button size="sm" className="w-full bg-rose-600 hover:bg-rose-700 text-white" asChild>
                                    <Link href={isAdminView ? `/dashboard/admin/contests/${contest.id}` : `/dashboard/contests/${contest.id}`}>
                                        View Details
                                        <ExternalLink className="h-4 w-4 ml-2" />
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </div>
            </Card>
        );
    };

    return (
        <div className="w-full">
            {/* Header with Create Contest Button and Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                    {/* Filter Controls */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        {/* Sorting Dropdown */}
                        <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="created_at_desc">Newest First</SelectItem>
                                <SelectItem value="created_at_asc">Oldest First</SelectItem>
                                <SelectItem value="start_date_asc">Start Date (Asc)</SelectItem>
                                <SelectItem value="end_date_desc">End Date (Desc)</SelectItem>
                                <SelectItem value="total_prize_money_sortable_desc">Prize/Budget (High-Low)</SelectItem>
                                <SelectItem value="total_prize_money_sortable_asc">Prize/Budget (Low-High)</SelectItem>
                                <SelectItem value="live_submission_count_desc">Submissions (High-Low)</SelectItem>
                                <SelectItem value="live_submission_count_asc">Submissions (Low-High)</SelectItem>
                            </SelectContent>
                        </Select>
                        {/* Platform Filter Dropdown */}
                        <Select value={platformFilter} onValueChange={setPlatformFilter}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <SelectValue placeholder="Platform" />
                            </SelectTrigger>
                            <SelectContent>
                                {availablePlatforms.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Platforms' : p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {/* Status Filter Dropdown */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {statusOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>


            </div>

            <Tabs defaultValue={draftContests.length === 0 ? "published" : "drafts"} className="w-full">
                <TabsList>
                    <TabsTrigger value="published">Published ({publishedContests.length})</TabsTrigger>
                    <TabsTrigger value="drafts">Drafts ({draftContests.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="published" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {sortedAndFilteredPublishedContests.length > 0 ? (
                            sortedAndFilteredPublishedContests.map((contest) => renderContestCard(contest))
                        ) : (
                            <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 text-center py-12">
                                <h3 className="text-lg font-semibold">No Published Contests</h3>
                                <p className="text-slate-500 mt-2">
                                    No contests match the current filters.
                                </p>
                            </div>
                        )}
                    </div>
                </TabsContent>
                <TabsContent value="drafts" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:col-span-4 gap-6">
                        {sortedAndFilteredDraftContests.length > 0 ? (
                            sortedAndFilteredDraftContests.map((contest) => renderContestCard(contest))
                        ) : (
                            <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 text-center py-12">
                                <h3 className="text-lg font-semibold">No Drafts</h3>
                                <p className="text-slate-500 mt-2">
                                    You have no draft contests at the moment.
                                </p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}