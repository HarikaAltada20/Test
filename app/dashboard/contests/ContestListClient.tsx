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
    ExternalLink,
    Info,
    Shield,
    CheckCircle,
    XCircle,
    Eye,
    FileText,
    AlertTriangle,
    PlayCircle,
    StopCircle,
    Building,
} from "lucide-react";
import { DeleteContestButton } from "@/components/delete-contest-button";
import { formatLocalDateTime, formatMoney, cn } from "@/lib/utils";

// Define the type for a contest
type Contest = {
    id: string;
    title: string | null;
    platform: string | null;
    contest_type: string | null;
    created_at: string;
    moderation_status: string; // Using moderation_status instead of is_draft
    status: string | null; // Contest lifecycle status (only for published contests)
    post_contest_status: string | null; // Post-contest review status (pending_review, in_review, verification_complete, payouts_processed)
    start_date: string | null;
    end_date: string | null;
    live_submission_count: number | null;
    total_prize_money_sortable: number | null;
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
    thumbnail_url: string | null;
    advertiser_name?: string;
    submitted_for_approval_at?: string | null;
    published_at?: string | null;
    rejection_reason?: string | null;
};

interface ContestListClientProps {
    initialContests: Contest[];
    isAdminView?: boolean;
}

type SortKey = 'created_at' | 'start_date' | 'end_date' | 'status' | 'live_submission_count' | 'total_prize_money_sortable';
type SortDirection = 'asc' | 'desc';
type SortOption = `${SortKey}_${SortDirection}`;

// Moderation status configuration
const moderationStatusConfig = {
    draft: {
        label: "Draft",
        color: "bg-gray-500",
        icon: FileText,
        description: "Contest is being created"
    },
    pending_approval: {
        label: "Pending Approval",
        color: "bg-yellow-500",
        icon: Clock,
        description: "Waiting for admin review"
    },
    approved: {
        label: "Ready",
        color: "bg-blue-500",
        icon: CheckCircle,
        description: "Approved and ready to publish"
    },
    published: {
        label: "Published",
        color: "bg-green-500",
        icon: Eye,
        description: "Live on platform"
    },
    rejected: {
        label: "Rejected",
        color: "bg-red-500",
        icon: XCircle,
        description: "Needs revision"
    },
};

// Contest lifecycle status configuration
const contestStatusConfig = {
    upcoming: { label: "Upcoming", color: "bg-purple-500", icon: Calendar },
    active: { label: "Active", color: "bg-green-600", icon: PlayCircle },
    ended: { label: "Ended", color: "bg-gray-600", icon: StopCircle },
};

export function ContestListClient({ initialContests, isAdminView = false }: ContestListClientProps) {
    const router = useRouter();
    const [sortOption, setSortOption] = useState<SortOption>("created_at_desc");
    const [selectedTab, setSelectedTab] = useState("all");
    const [platformFilter, setPlatformFilter] = useState<string>("all");

    const availablePlatforms = useMemo(() => {
        const platforms = new Set(initialContests.map(c => c.platform).filter(Boolean) as string[]);
        return ["all", ...Array.from(platforms)];
    }, [initialContests]);

    // Group contests by moderation status and contest lifecycle
    const contestsByStatus = useMemo(() => {
        const groups = {
            all: initialContests,
            draft: initialContests.filter(c => c.moderation_status === 'draft'),
            pending_approval: initialContests.filter(c => c.moderation_status === 'pending_approval'),
            ready: initialContests.filter(c => c.moderation_status === 'approved'),
            active: initialContests.filter(c => c.moderation_status === 'published' && (c.status === 'active' || c.status === 'upcoming')),
            pending_verification: initialContests.filter(c =>
                c.moderation_status === 'published' &&
                c.status === 'ended' &&
                c.post_contest_status !== 'verification_complete' &&
                c.post_contest_status !== 'payouts_processed'
            ),
            done: initialContests.filter(c =>
                c.moderation_status === 'published' &&
                c.status === 'ended' &&
                (c.post_contest_status === 'verification_complete' || c.post_contest_status === 'payouts_processed')
            ),
            rejected: initialContests.filter(c => c.moderation_status === 'rejected'),
        };
        return groups;
    }, [initialContests]);

    const filterAndSortContests = (contestsToProcess: Contest[]) => {
        let contests = [...contestsToProcess];

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

    const getModerationStatusBadge = (moderationStatus: string) => {
        const config = moderationStatusConfig[moderationStatus as keyof typeof moderationStatusConfig];
        if (!config) return null;

        const Icon = config.icon;
        return (
            <Badge className={`${config.color} text-white border-0`}>
                <Icon className="w-3 h-3 mr-1" />
                {config.label}
            </Badge>
        );
    };

    const getContestStatusBadge = (status: string | null) => {
        if (!status) return null;

        const config = contestStatusConfig[status as keyof typeof contestStatusConfig];
        if (!config) return null;

        const Icon = config.icon;
        return (
            <Badge className={`${config.color} text-white border-0 ml-2`}>
                <Icon className="w-3 h-3 mr-1" />
                {config.label}
            </Badge>
        );
    };

    const getContestStatusDisplay = (status: string | null, postContestStatus: string | null = null) => {
        if (!status) return { text: "Unknown", className: "bg-slate-400 border-slate-400 text-white" };
        if (status === "active") return { text: "Live", className: "bg-green-500 border-green-500 text-white" };
        if (status === "upcoming") return { text: "Upcoming", className: "bg-blue-500 border-blue-500 text-white" };
        if (status === "ended") {
            // Show post-contest status for ended contests with better UX messaging
            if (postContestStatus === "pending_review") return { text: "Pending Review", className: "bg-yellow-500 border-yellow-500 text-white" };
            if (postContestStatus === "in_review") return { text: "In Review", className: "bg-orange-500 border-orange-500 text-white" };
            if (postContestStatus === "verification_complete") return { text: "Verified - Payment Processing", className: "bg-purple-500 border-purple-500 text-white" };
            if (postContestStatus === "payouts_processed") return { text: "Verified - Payment Released", className: "bg-green-600 border-green-600 text-white" };
            return { text: "Ended", className: "bg-gray-500 border-gray-500 text-white" };
        }
        return { text: status.charAt(0).toUpperCase() + status.slice(1), className: "bg-slate-400 border-slate-400 text-white" };
    };

    const renderContestCard = (contest: Contest) => {
        const isDraft = contest.moderation_status === 'draft';
        const isRejected = contest.moderation_status === 'rejected';
        const isPublished = contest.moderation_status === 'published';

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
        const budgetProgress = (cpmBudget && cpmBudget !== undefined && cpmBudget > 0) ? Math.min((budgetSpent / cpmBudget) * 100, 100) : 0;

        // Original design for published contests
        if (isPublished) {
            const statusDisplay = getContestStatusDisplay(contest.status, contest.post_contest_status);

            return (
                <Card
                    key={contest.id}
                    className="overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out border dark:border-slate-700 flex flex-col group bg-white dark:bg-slate-850 hover:border-rose-500 dark:hover:border-rose-500 cursor-pointer w-full"
                    onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) {
                            return;
                        }
                        const href = isAdminView
                            ? `/dashboard/admin/contests/${contest.id}`
                            : `/dashboard/contests/${contest.id}`;
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
                            <div className="absolute top-2 right-2">
                                <Badge
                                    className={cn("capitalize text-xs px-2 py-0.5 font-medium border", statusDisplay.className)}
                                >
                                    {statusDisplay.text}
                                </Badge>
                            </div>
                        </div>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-300 mr-2 leading-tight truncate">
                                {contest.title || "Untitled Contest"}
                            </CardTitle>
                            {isAdminView && contest.advertiser_name && (
                                <p className="text-xs text-muted-foreground pt-1">
                                    By: {contest.advertiser_name}
                                </p>
                            )}
                            {contest.live_submission_count !== null && (
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
                                <div className="flex items-center">
                                    <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Contest Type: <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {contest.contest_type === 'cpm' ? 'CPM Based' : contest.contest_type === 'leaderboard' ? 'Leaderboard' : contest.contest_type ? contest.contest_type.charAt(0).toUpperCase() + contest.contest_type.slice(1) : 'N/A'}
                                    </span></span>
                                </div>
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
                            {contest.contest_type === 'cpm' && cpmBudget && cpmBudget > 0 && (
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
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const href = isAdminView ? `/dashboard/admin/contests/${contest.id}` : `/dashboard/contests/${contest.id}`;
                                        router.push(href);
                                    }}
                                >
                                    View Details
                                    <ExternalLink className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </div>
                </Card>
            );
        }

        // Modern design for unpublished contests (draft, pending, approved, rejected)
        return (
            <Card
                key={contest.id}
                className={cn(
                    "overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out border flex flex-col group bg-white dark:bg-slate-850 cursor-pointer w-full",
                    isRejected
                        ? "border-red-200 dark:border-red-800 hover:border-red-400"
                        : "dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500"
                )}
                onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) {
                        return;
                    }
                    const href = isAdminView
                        ? `/dashboard/admin/contests/${contest.id}`
                        : (isDraft ? `/dashboard/contests/create?draft=${contest.id}` : `/dashboard/contests/${contest.id}`);
                    router.push(href);
                }}
            >
                <div className="flex flex-col flex-grow">
                    <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                        {contest.thumbnail_url ? (
                            <img
                                src={contest.thumbnail_url}
                                alt={contest.title || "Contest thumbnail"}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                <Trophy className="h-12 w-12 mb-2" />
                                <span className="text-sm font-medium">No Image</span>
                            </div>
                        )}
                        {/* Status badges overlay */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                            {getModerationStatusBadge(contest.moderation_status)}
                        </div>
                    </div>

                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-300">
                                {contest.title || "Untitled Contest"}
                            </CardTitle>
                        </div>
                        {isAdminView && contest.advertiser_name && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Building className="h-4 w-4" />
                                {contest.advertiser_name}
                            </div>
                        )}
                    </CardHeader>

                    <CardContent className="pt-0 flex-grow">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                    <span className="font-medium capitalize">{contest.platform}</span>
                                    <span>•</span>
                                    <span className="capitalize">{contest.contest_type}</span>
                                </div>
                            </div>

                            {/* Show dates for unpublished contests */}
                            <div className="space-y-2">
                                {contest.start_date && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                        <Calendar className="h-4 w-4" />
                                        <span>Starts {formatLocalDateTime(contest.start_date)}</span>
                                    </div>
                                )}
                                {contest.end_date && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                        <Clock className="h-4 w-4" />
                                        <span>Ends {formatLocalDateTime(contest.end_date)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                {(leaderboardPrizeMoney !== null && leaderboardPrizeMoney > 0) && (
                                    <div className="flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-yellow-500" />
                                        <div className="text-sm">
                                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                                                {formatMoney(leaderboardPrizeMoney)}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                Prize Pool
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(cpmBudget !== null && cpmBudget !== undefined && cpmBudget > 0) && (
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-green-500" />
                                        <div className="text-sm">
                                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                                                {formatMoney(budgetSpent)} / {formatMoney(cpmBudget)}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                Budget ({Math.round(budgetProgress)}%)
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {isRejected && contest.rejection_reason && (
                                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <div className="text-sm font-medium text-red-800 dark:text-red-200">
                                                Rejection Reason
                                            </div>
                                            <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                                                {contest.rejection_reason}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex gap-2">
                            {isDraft ? (
                                <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/dashboard/contests/create?draft=${contest.id}`);
                                    }}
                                >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Continue Editing
                                </Button>
                            ) : contest.moderation_status === 'approved' ? (
                                // Approved contests: Show Publish, Edit Dates, and Delete options
                                <>
                                    <Button
                                        size="sm"
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                        onClick={async (e) => {
                                            e.stopPropagation();

                                            try {
                                                const response = await fetch(`/api/contests/${contest.id}/publish`, {
                                                    method: 'POST'
                                                });

                                                const result = await response.json();

                                                if (response.ok) {
                                                    // Refresh the page to show updated status
                                                    window.location.reload();
                                                } else {
                                                    alert(result.error || 'Failed to publish contest');
                                                }
                                            } catch (error) {
                                                console.error('Error publishing contest:', error);
                                                alert('Failed to publish contest');
                                            }
                                        }}
                                    >
                                        <PlayCircle className="h-4 w-4 mr-1" />
                                        Publish
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/dashboard/contests/${contest.id}/edit?dates=true`);
                                        }}
                                    >
                                        <Calendar className="h-4 w-4 mr-1" />
                                        Edit Dates
                                    </Button>
                                </>
                            ) : contest.moderation_status !== 'published' ? (
                                // Non-published contests: Show Edit Contest button
                                <Button
                                    size="sm"
                                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/dashboard/contests/${contest.id}/edit`);
                                    }}
                                >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit Contest
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const href = isAdminView
                                            ? `/dashboard/admin/contests/${contest.id}`
                                            : `/dashboard/contests/${contest.id}`;
                                        router.push(href);
                                    }}
                                >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View Details
                                </Button>
                            )}

                            {!isAdminView && contest.moderation_status !== 'published' && (
                                <DeleteContestButton
                                    contestId={contest.id}
                                    contestTitle={contest.title || 'this contest'}
                                    isDeletable={true}
                                />
                            )}
                        </div>
                    </CardContent>
                </div>
            </Card>
        );
    };

    const currentContests = contestsByStatus[selectedTab as keyof typeof contestsByStatus] || [];
    const sortedAndFilteredContests = useMemo(() => {
        return filterAndSortContests(currentContests);
    }, [currentContests, sortOption, platformFilter]);

    return (
        <div className="w-full">
            {/* Header with filters */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
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

                        <Select value={platformFilter} onValueChange={setPlatformFilter}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <SelectValue placeholder="Platform" />
                            </SelectTrigger>
                            <SelectContent>
                                {availablePlatforms.map(p =>
                                    <SelectItem key={p} value={p}>
                                        {p === 'all' ? 'All Platforms' : p}
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Enhanced Status Filter Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                <div className="overflow-x-auto">
                    <TabsList className="grid w-full grid-cols-8 h-14 p-1.5 bg-muted/30 border border-border/50 shadow-sm mb-8 min-w-[900px]">
                        <TabsTrigger
                            value="all"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            All <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestsByStatus.all.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="draft"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Draft <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestsByStatus.draft.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="pending_approval"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Pending Approval <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestsByStatus.pending_approval.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="ready"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Ready <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestsByStatus.ready.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="active"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Active <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestsByStatus.active.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="pending_verification"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Pending Verification <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestsByStatus.pending_verification.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="done"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Done <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestsByStatus.done.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="rejected"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Rejected <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestsByStatus.rejected.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>

                {Object.keys(contestsByStatus).map((tabValue) => (
                    <TabsContent key={tabValue} value={tabValue} className="mt-4">
                        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                            {sortedAndFilteredContests.length > 0 ? (
                                sortedAndFilteredContests.map((contest) => renderContestCard(contest))
                            ) : (
                                <div className="col-span-full text-center py-12">
                                    <h3 className="text-lg font-semibold">No Contests Found</h3>
                                    <p className="text-slate-500 mt-2">
                                        {platformFilter !== "all"
                                            ? `No contests match the current filters for ${tabValue} status.`
                                            : `No contests found for ${tabValue} status.`
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}