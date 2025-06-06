'use client';

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
    Trash2 // For Delete button icon (optional, as DeleteContestButton has its own)
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
    status: string; // 'draft', 'incomplete', 'upcoming', 'active', 'ended', 'completed', 'unknown'
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
};

interface ContestListClientProps {
    publishedContests: Contest[];
    draftContests: Contest[];
}

type SortKey = 'created_at' | 'start_date' | 'end_date' | 'status' | 'live_submission_count' | 'total_prize_money_sortable';
type SortDirection = 'asc' | 'desc';
type SortOption = `${SortKey}_${SortDirection}`;

const platformOptions = ["all", "TikTok", "Instagram", "YouTube", "Other"];
const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "upcoming", label: "Upcoming" },
    { value: "active", label: "Live" },
    { value: "ended", label: "Ended/Completed" }, // Combined for filter simplicity
];


export function ContestListClient({ publishedContests, draftContests }: ContestListClientProps) {
    const [sortOption, setSortOption] = useState<SortOption>("created_at_desc");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [platformFilter, setPlatformFilter] = useState<string>("all");

    const availablePlatforms = useMemo(() => {
        const platforms = new Set([...publishedContests, ...draftContests].map(c => c.platform).filter(Boolean) as string[]);
        return ["all", ...Array.from(platforms)];
    }, [publishedContests, draftContests]);

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

    const sortedAndFilteredPublishedContests = useMemo(() => {
        return filterAndSortContests(publishedContests);
    }, [publishedContests, sortOption, statusFilter, platformFilter]);

    const sortedAndFilteredDraftContests = useMemo(() => {
        // Drafts are typically not filtered by live status, but platform filter might apply
        // For now, only applying platform filter and default sort (creation date desc)
        let contests = [...draftContests];
        if (platformFilter !== "all") {
            contests = contests.filter(c => c.platform === platformFilter);
        }
        contests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return contests;
    }, [draftContests, platformFilter]);


    const getStatusDisplay = (status: string) => {
        if (status === "active") return { text: "Live", className: "bg-green-500 border-green-500 text-white" };
        if (status === "upcoming") return { text: "Upcoming", className: "bg-blue-500 border-blue-500 text-white" };
        if (status === "ended" || status === "completed") return { text: "Ended", className: "bg-gray-500 border-gray-500 text-white" };
        if (status === "draft") return { text: "Draft", className: "bg-amber-500 border-amber-500 text-white" };
        if (status === "incomplete") return { text: "Incomplete", className: "bg-yellow-400 border-yellow-400 text-yellow-900" };
        return { text: status.charAt(0).toUpperCase() + status.slice(1), className: "bg-slate-400 border-slate-400 text-white" };
    };

    const renderContestCard = (contest: Contest, isDraft: boolean) => {
        const statusDisplay = getStatusDisplay(contest.status);

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
                className="overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out border dark:border-slate-700 flex flex-col group bg-white dark:bg-slate-850 hover:border-rose-500 dark:hover:border-rose-500"
            >
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
                </CardHeader>
                <CardContent className="p-4 pt-1 flex-grow flex flex-col justify-between">
                    <div className="space-y-1.5 text-sm mb-3 text-slate-600 dark:text-slate-400">
                        <div className="flex items-center">
                            <Trophy className="h-4 w-4 mr-2 flex-shrink-0 text-rose-500" /> {/* Platform was Share2, using Trophy for consistency with icon */}
                            <span>Platform: <span className="font-medium text-slate-700 dark:text-slate-300">{contest.platform || "N/A"}</span></span>
                        </div>
                        {contest.start_date && (
                            <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span>Starts: <span className="font-medium text-slate-700 dark:text-slate-300">{formatLocalDateTime(contest.start_date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                            </div>
                        )}
                        {contest.end_date && (
                            <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span>Ends: <span className="font-medium text-slate-700 dark:text-slate-300">{formatLocalDateTime(contest.end_date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                            </div>
                        )}
                        {!isDraft && contest.live_submission_count !== null && (
                            <div className="flex items-center">
                                <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span>Submissions: <span className="font-medium text-slate-700 dark:text-slate-300">{contest.live_submission_count}</span></span>
                            </div>
                        )}
                        {(leaderboardPrizeMoney !== null || cpmBudget !== null) && (
                            <div className="flex items-center">
                                <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-green-600" />
                                <span>
                                    {contest.contest_type === 'leaderboard' ? "Prize Pool: " : "Budget: "}
                                    <span className="font-bold text-slate-800 dark:text-slate-100">
                                        {contest.contest_type === 'leaderboard' && typeof leaderboardPrizeMoney === 'number'
                                            ? formatMoney(leaderboardPrizeMoney)
                                            : contest.contest_type === 'cpm' && typeof cpmBudget === 'number'
                                                ? formatMoney(cpmBudget)
                                                : "N/A"}
                                    </span>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Budget Spent Progress Bar for CPM contests (Published Only) */}
                    {!isDraft && contest.contest_type === 'cpm' && typeof cpmBudget === 'number' && cpmBudget > 0 && (
                        <div className="mt-2 mb-3">
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                <span>Spent: {formatMoney(budgetSpent)}</span>
                                <span>{budgetProgress.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                <div
                                    className="bg-rose-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${budgetProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    <div className="pt-3 mt-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {isDraft ? (
                            <>
                                <Button variant="default" className="w-full bg-rose-600 hover:bg-rose-700" asChild>
                                    <Link href={`/dashboard/contests/create?draft=${contest.id}`}>
                                        <Edit className="mr-2 h-4 w-4" /> Continue Editing
                                    </Link>
                                </Button>
                                <DeleteContestButton
                                    contestId={contest.id}
                                    contestTitle={contest.title || "Untitled Draft"}
                                    isDeletable={true} // Drafts are always deletable
                                    variant="outline"
                                    className="w-full"
                                />
                            </>
                        ) : (
                            <>
                                <Button variant="outline" className="w-full" asChild>
                                    <Link href={`/dashboard/contests/${contest.id}`}>
                                        <ExternalLink className="mr-2 h-4 w-4" /> View Details
                                    </Link>
                                </Button>
                                <DeleteContestButton
                                    contestId={contest.id}
                                    contestTitle={contest.title || "Untitled Contest"}
                                    isDeletable={!(contest.status === "active" || contest.status === "ended" || contest.status === "completed" || contest.status === "live")}
                                    variant="destructive"
                                    className="w-full"
                                />
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <Tabs defaultValue="published" className="mb-6">
            <TabsList>
                <TabsTrigger value="published">Published Contests</TabsTrigger>
                <TabsTrigger value="drafts">
                    Drafts ({draftContests.length})
                </TabsTrigger>
            </TabsList>

            {/* Filters and Sorting Controls - Common for both tabs or adapt per tab if needed */}
            <div className="my-6 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 min-w-[150px] sm:min-w-[180px]">
                    <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="created_at_desc">Creation Date (Newest)</SelectItem>
                            <SelectItem value="created_at_asc">Creation Date (Oldest)</SelectItem>
                            <SelectItem value="start_date_desc">Start Date (Newest First)</SelectItem>
                            <SelectItem value="start_date_asc">Start Date (Oldest First)</SelectItem>
                            <SelectItem value="end_date_desc">End Date (Newest First)</SelectItem>
                            <SelectItem value="end_date_asc">End Date (Oldest First)</SelectItem>
                            <SelectItem value="live_submission_count_desc">Submissions (High to Low)</SelectItem>
                            <SelectItem value="live_submission_count_asc">Submissions (Low to High)</SelectItem>
                            <SelectItem value="total_prize_money_sortable_desc">Prize/Budget (High to Low)</SelectItem>
                            <SelectItem value="total_prize_money_sortable_asc">Prize/Budget (Low to High)</SelectItem>
                            <SelectItem value="status_asc">Status (A-Z)</SelectItem>
                            <SelectItem value="status_desc">Status (Z-A)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 min-w-[150px] sm:min-w-[180px]">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 min-w-[150px] sm:min-w-[180px]">
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Filter by Platform" />
                        </SelectTrigger>
                        <SelectContent>
                            {availablePlatforms.map(platform => (
                                <SelectItem key={platform} value={platform}>
                                    {platform === "all" ? "All Platforms" : platform}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <TabsContent value="published">
                {sortedAndFilteredPublishedContests.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                        {sortedAndFilteredPublishedContests.map((contest) => renderContestCard(contest, false))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Trophy className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                        <h2 className="text-xl font-medium text-slate-700 dark:text-slate-300 mb-2">
                            No Published Contests
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Try adjusting your filters or create a new contest.
                        </p>
                        <Button className="bg-rose-600 hover:bg-rose-700" asChild>
                            <Link href="/dashboard/contests/create?new=true">Create Contest</Link>
                        </Button>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="drafts">
                {sortedAndFilteredDraftContests.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                        {sortedAndFilteredDraftContests.map((contest) => renderContestCard(contest, true))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Edit className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                        <h2 className="text-xl font-medium text-slate-700 dark:text-slate-300 mb-2">
                            No Drafts
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            You have no draft contests at the moment.
                        </p>
                        <Button className="bg-rose-600 hover:bg-rose-700" asChild>
                            <Link href="/dashboard/contests/create?new=true">Create a Contest</Link>
                        </Button>
                    </div>
                )}
            </TabsContent>
        </Tabs>
    );
} 