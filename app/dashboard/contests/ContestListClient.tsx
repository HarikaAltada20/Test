"use client";

import React, { useState, useMemo, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsContent as TabsContent,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
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
import { formatLocalDateTime, cn } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { calculateLeaderboardBudgetSpent, Submission } from "@/lib/contest-utils-client";
import { getPlatformIconWithFallback } from "@/lib/platform-icons";

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
  selectedTab?: string;
  onTabChange?: (tab: string) => void;
}

type SortOptionType =
  | "created_at_desc"
  | "created_at_asc"
  | "start_date_desc"
  | "start_date_asc"
  | "end_date_asc"
  | "end_date_desc"
  | "value_desc"
  | "value_asc"
  | "cpm_rate_desc"
  | "cpm_rate_asc"
  | "submissions_desc"
  | "submissions_asc";

// Moderation status configuration
const moderationStatusConfig = {
  draft: {
    label: "Draft",
    color: "bg-gray-500",
    icon: FileText,
    description: "Contest is being created",
  },
  pending_approval: {
    label: "Pending Approval",
    color: "bg-yellow-500",
    icon: Clock,
    description: "Waiting for admin review",
  },
  approved: {
    label: "Ready",
    color: "bg-blue-500",
    icon: CheckCircle,
    description: "Approved and ready to publish",
  },
  published: {
    label: "Published",
    color: "bg-green-500",
    icon: Eye,
    description: "Live on platform",
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-500",
    icon: XCircle,
    description: "Needs revision",
  },
};

// Contest lifecycle status configuration
const contestStatusConfig = {
  upcoming: { label: "Upcoming", color: "bg-purple-500", icon: Calendar },
  active: { label: "Active", color: "bg-green-600", icon: PlayCircle },
  ended: { label: "Ended", color: "bg-gray-600", icon: StopCircle },
};

export function ContestListClient({
  initialContests,
  isAdminView = false,
  selectedTab: externalSelectedTab,
  onTabChange,
}: ContestListClientProps) {
  const router = useRouter();
  const [sortOption, setSortOption] =
    useState<SortOptionType>("created_at_desc");
  const [internalSelectedTab, setInternalSelectedTab] = useState("all");
  const [mode, setMode] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      const modeElement = document.querySelector("[data-mode]");
      const currentMode = (modeElement?.getAttribute("data-mode") || "") as
        | "light"
        | "dark"
        | "";
      if (currentMode === "light" || currentMode === "dark") {
        return currentMode;
      }
      // Fallback to Tailwind's html.dark class if present
      const isHtmlDark = document.documentElement.classList.contains("dark");
      return isHtmlDark ? "dark" : "light";
    }
    return "light";
  });
  // Use external tab if provided, otherwise use internal state
  const selectedTab =
    externalSelectedTab !== undefined
      ? externalSelectedTab
      : internalSelectedTab;
  const setSelectedTab = onTabChange || setInternalSelectedTab;
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [contestStatusFilter, setContestStatusFilter] = useState<string>("all"); // New contest status filter
  const [contestTypeFilter, setContestTypeFilter] = useState<string>("all"); // New contest type filter
  const [filteredAndSortedContests, setFilteredAndSortedContests] = useState<
    Contest[]
  >([]);

  const availablePlatforms = useMemo(() => {
    const platforms = new Set(
      initialContests.map((c) => c.platform).filter(Boolean) as string[]
    );
    return ["all", ...Array.from(platforms)];
  }, [initialContests]);
  // Read and react to mode changes from data attribute with minimal flicker
  useLayoutEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      const currentMode = (modeElement?.getAttribute("data-mode") || "") as
        | "light"
        | "dark"
        | "";
      if (currentMode === "light" || currentMode === "dark") {
        setMode(currentMode);
        return;
      }
      // Fallback to html.dark if attribute missing
      const isHtmlDark = document.documentElement.classList.contains("dark");
      setMode(isHtmlDark ? "dark" : "light");
    };

    checkMode();

    const targetNode = document.querySelector("[data-mode]");
    let observer: MutationObserver | null = null;
    if (targetNode) {
      observer = new MutationObserver(checkMode);
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, []);

  // Group contests by moderation status and contest lifecycle
  const contestsByStatus = useMemo(() => {
    const groups = {
      all: initialContests,
      draft: initialContests.filter((c) => c.moderation_status === "draft"),
      pending_approval: initialContests.filter(
        (c) => c.moderation_status === "pending_approval"
      ),
      ready: initialContests.filter((c) => c.moderation_status === "approved"),
      active: initialContests.filter(
        (c) =>
          c.moderation_status === "published" &&
          (c.status === "active" || c.status === "upcoming")
      ),
      pending_verification: initialContests.filter(
        (c) =>
          c.moderation_status === "published" &&
          c.status === "ended" &&
          c.post_contest_status !== "verification_complete" &&
          c.post_contest_status !== "payouts_processed"
      ),
      done: initialContests.filter(
        (c) =>
          c.moderation_status === "published" &&
          c.status === "ended" &&
          (c.post_contest_status === "verification_complete" ||
            c.post_contest_status === "payouts_processed")
      ),
      rejected: initialContests.filter(
        (c) => c.moderation_status === "rejected"
      ),
    };
    return groups;
  }, [initialContests]);

  // useEffect for filtering and sorting - copied from opportunities
  useEffect(() => {
    let contestsToDisplay = [...initialContests];

    // Apply contest status filter (Live, Upcoming, Ended, All)
    if (contestStatusFilter !== "all") {
      contestsToDisplay = contestsToDisplay.filter((contest) => {
        if (contestStatusFilter === "live") {
          return (
            contest.moderation_status === "published" &&
            contest.status === "active"
          );
        } else if (contestStatusFilter === "upcoming") {
          return (
            contest.moderation_status === "published" &&
            contest.status === "upcoming"
          );
        } else if (contestStatusFilter === "ended") {
          return (
            contest.moderation_status === "published" &&
            contest.status === "ended"
          );
        }
        return true;
      });
    }

    // Apply platform filter
    if (platformFilter !== "all") {
      contestsToDisplay = contestsToDisplay.filter(
        (contest) => contest.platform === platformFilter
      );
    }

    // Apply contest type filter
    if (contestTypeFilter !== "all") {
      contestsToDisplay = contestsToDisplay.filter(
        (contest) => contest.contest_type === contestTypeFilter
      );
    }

    // Sorting - exact copy from opportunities
    contestsToDisplay.sort((a, b) => {
      switch (sortOption) {
        case "created_at_desc":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "created_at_asc":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "start_date_desc":
          if (!a.start_date) return 1; // push contests without start_date to the bottom
          if (!b.start_date) return -1;
          return (
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          );
        case "start_date_asc":
          if (!a.start_date) return 1; // push contests without start_date to the bottom
          if (!b.start_date) return -1;
          return (
            new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
          );
        case "end_date_asc":
          if (!a.end_date) return 1; // push contests without end_date to the bottom
          if (!b.end_date) return -1;
          return (
            new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
          );
        case "end_date_desc":
          if (!a.end_date) return 1;
          if (!b.end_date) return -1;
          return (
            new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
          );
        case "value_desc":
        case "value_asc":
          let valueA = 0;
          let valueB = 0;
          if (
            a.contest_type === "leaderboard" &&
            a.contest_based_details?.leaderboard_contest?.total_prize
          ) {
            valueA = a.contest_based_details.leaderboard_contest.total_prize;
          } else if (
            a.contest_type === "cpm" &&
            a.contest_based_details?.cpm_contest?.total_budget
          ) {
            valueA = a.contest_based_details.cpm_contest.total_budget;
          }
          if (
            b.contest_type === "leaderboard" &&
            b.contest_based_details?.leaderboard_contest?.total_prize
          ) {
            valueB = b.contest_based_details.leaderboard_contest.total_prize;
          } else if (
            b.contest_type === "cpm" &&
            b.contest_based_details?.cpm_contest?.total_budget
          ) {
            valueB = b.contest_based_details.cpm_contest.total_budget;
          }
          return sortOption === "value_desc"
            ? valueB - valueA
            : valueA - valueB;
        case "cpm_rate_desc":
        case "cpm_rate_asc":
          const rateA =
            a.contest_type === "cpm" &&
            a.contest_based_details?.cpm_contest?.cpm_rate_usd
              ? a.contest_based_details.cpm_contest.cpm_rate_usd
              : -1;
          const rateB =
            b.contest_type === "cpm" &&
            b.contest_based_details?.cpm_contest?.cpm_rate_usd
              ? b.contest_based_details.cpm_contest.cpm_rate_usd
              : -1;
          if (rateA === -1 && rateB === -1) return 0;
          if (rateA === -1) return 1; // a (no rate) comes after b (has rate)
          if (rateB === -1) return -1; // b (no rate) comes after a (has rate)
          return sortOption === "cpm_rate_desc" ? rateB - rateA : rateA - rateB;
        case "submissions_desc":
        case "submissions_asc":
          const countA = a.live_submission_count ?? -1;
          const countB = b.live_submission_count ?? -1;
          if (countA === -1 && countB === -1) return 0;
          if (countA === -1) return 1;
          if (countB === -1) return -1;
          return sortOption === "submissions_desc"
            ? countB - countA
            : countA - countB;
        default:
          return 0;
      }
    });

    setFilteredAndSortedContests(contestsToDisplay);
  }, [
    initialContests,
    contestStatusFilter,
    platformFilter,
    contestTypeFilter,
    sortOption,
  ]);

  const getModerationStatusBadge = (moderationStatus: string) => {
    const config =
      moderationStatusConfig[
        moderationStatus as keyof typeof moderationStatusConfig
      ];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge
        className={`${config.color} text-white px=3 py-1 text-sm bg-[#7F39EC] text-white border-0`}
      >
        {/* <Icon className="w-3 h-3 mr-1" /> */}
        {config.label}
      </Badge>
    );
  };

  const getContestStatusBadge = (status: string | null) => {
    if (!status) return null;

    const config =
      contestStatusConfig[status as keyof typeof contestStatusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white border-0 ml-2`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const isDark = mode === "dark";

  const getContestStatusDisplay = (
    status: string | null,
    postContestStatus: string | null = null
  ) => {
    if (!status)
      return {
        text: "Unknown",
        className: "bg-slate-400 border-slate-400 text-white",
      };
    if (status === "active")
      return {
        text: "Live",
        className: "bg-green-500 border-green-500 text-white",
      };
    if (status === "upcoming")
      return {
        text: "Upcoming",
        className: "bg-blue-500 border-blue-500 text-white",
      };
    if (status === "ended") {
      // Show post-contest status for ended contests with better UX messaging
      if (postContestStatus === "pending_review")
        return {
          text: "Pending Review",
          className: "bg-yellow-500 border-yellow-500 text-white",
        };
      if (postContestStatus === "in_review")
        return {
          text: "In Review",
          className: "bg-orange-500 border-orange-500 text-white",
        };
      if (postContestStatus === "verification_complete")
        return {
          text: "Verified - Payment Processing",
          className: "bg-purple-500 border-purple-500 text-white",
        };
      if (postContestStatus === "payouts_processed")
        return {
          text: "Verified - Payment Released",
          className: "bg-green-600 border-green-600 text-white",
        };
      return {
        text: "Ended",
        className: "bg-gray-500 border-gray-500 text-white",
      };
    }
    return {
      text: status.charAt(0).toUpperCase() + status.slice(1),
      className: "bg-slate-400 border-slate-400 text-white",
    };
  };

  const renderContestCard = (contest: Contest) => {
    const isPublished = contest.moderation_status === "published";

        // Simple opportunities-style design for published contests
        if (isPublished) {
            return (
                <Card
                    key={contest.id}
                    className="overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border border-slate-200 dark:border-slate-700 flex flex-col group bg-white w-full cursor-pointer"
                    onClick={() => {
                        const href = isAdminView
                            ? `/dashboard/admin/contests/${contest.id}`
                            : `/dashboard/contests/${contest.id}`;
                        router.push(href);
                    }}
                >
                    <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                        {contest.thumbnail_url ? (
                            <img
                                src={contest.thumbnail_url || "/placeholder.svg"}
                                alt={contest.title || "Contest thumbnail"}
                                className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                            />
                        ) : (
                            <Trophy className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                        )}
                        <div className="absolute top-2 right-2">
                            <Badge
                                className={cn(
                                    "capitalize text-sm px-3 py-1 font-medium border",
                                    contest.status === "active" && "bg-[#7F39EC] text-white",
                                    contest.status === "upcoming" && "bg-[#7F39EC] text-white",
                                    contest.status === "ended" && "bg-[#7F39EC] text-white",
                                    !["active", "upcoming", "ended"].includes(contest.status || "") && "bg-[#7F39EC] text-white"
                                )}
                            >
                                {contest.status === "active" ? "Live" : (contest.status || "Unknown")}
                            </Badge>
                        </div>
                    </div>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-lg font-bold text-slate-800 transition-colors duration-300 mr-2 leading-tight">
                            {contest.title || "Untitled Contest"}
                        </CardTitle>
                        {/* New Features Indicators */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            {contest.multiple_submissions_enabled && (
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                    <CheckCheck className="h-3 w-3 mr-1" />
                                    {(contest.max_submissions_per_creator ?? 1) > 1 ? `${contest.max_submissions_per_creator} Submissions` : 'Multiple Entries'}
                                </Badge>
                            )}
                            {(contest.contest_based_details?.cpm_contest?.flat_fee_bonus ||
                                contest.contest_based_details?.leaderboard_contest?.flat_fee_bonus) && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                        <Gift className="h-3 w-3 mr-1" />
                                        {formatMoney(contest.contest_based_details?.cpm_contest?.flat_fee_bonus ||
                                            contest.contest_based_details?.leaderboard_contest?.flat_fee_bonus || 0)}/submission
                                    </Badge>
                                )}
                            {contest.content_type && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {contest.content_type.toUpperCase()}
                                </Badge>
                            )}
                            {contest.bonus_details?.description_html && (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                    <Star className="h-3 w-3 mr-1" />
                                    Bonus Available
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 flex-grow flex flex-col justify-between">
                        <div className="space-y-1.5 text-md mb-4 text-slate-600 dark:text-slate-400">
                            <div className="flex items-center">
                                <div className="mr-2 flex-shrink-0">
                                    {getPlatformIconWithFallback(contest.platform, 'sm')}
                                </div>
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
                            {contest.live_submission_count !== null && contest.live_submission_count !== undefined && (
                                <div className="flex items-center">
                                    <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Submissions: <span className="font-medium text-slate-700 dark:text-slate-300">{contest.live_submission_count}</span></span>
                                </div>
                            )}
                            <div className="flex items-center">
                                <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span>Contest Type: <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {contest.contest_type === 'cpm' ? 'CPM Based' : contest.contest_type === 'leaderboard' ? 'Leaderboard' : contest.contest_type ? contest.contest_type.charAt(0).toUpperCase() + contest.contest_type.slice(1) : 'N/A'}
                                </span></span>
                            </div>
                            {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest?.cpm_rate_usd != null && (
                                <div className="flex items-center">
                                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-gray-500" />
                                    <span>CPM Rate: <span className="font-medium text-slate-700 dark:text-slate-300">{formatMoney(contest.contest_based_details.cpm_contest.cpm_rate_usd * 100)} / 1k views</span></span>
                                </div>
                            )}
                            {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest?.total_budget != null && contest.contest_based_details.cpm_contest.total_budget > 0 && (
                                <div className="flex items-center">
                                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-gray-500" />
                                    <span>Total Budget: <span className="font-medium text-slate-700 dark:text-slate-300">{formatMoney(contest.contest_based_details.cpm_contest.total_budget)}</span></span>
                                </div>
                            )}
                            {contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest?.total_prize != null && contest.contest_based_details.leaderboard_contest.total_prize > 0 && (
                                <div className="flex items-center">
                                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-gray-500" />
                                    <span>Total Prize Pool: <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)}
                                    </span></span>
                                </div>
                            )}
                            {contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest?.total_budget != null && contest.contest_based_details.leaderboard_contest.total_budget > 0 && (
                                <div className="flex items-center">
                                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-green-600" />
                                    <span>Total Bonus Budget: <span className="font-medium text-green-700 dark:text-green-300">
                                        {formatMoney(contest.contest_based_details.leaderboard_contest.total_budget)}
                                    </span></span>
                                </div>
                            )}
                        </div>

                        {/* Budget Spent Progress Bar for CPM contests */}
                        {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest?.total_budget != null && contest.contest_based_details.cpm_contest.total_budget > 0 && (() => {
                            const totalBudget = contest.contest_based_details.cpm_contest.total_budget;
                            // Use real-time updated budget_spent field
                            const budgetSpent = contest.contest_based_details.cpm_contest.budget_spent || 0;
                            const percentage = (budgetSpent / totalBudget) * 100;
                            const remaining = totalBudget - budgetSpent;

                            return (
                                <div className="mt-3 mb-3">
                                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300 mb-2">
                                        <span className="font-medium">Budget Tracker</span>
                                        <span className="font-semibold">{formatMoney(budgetSpent)} / {formatMoney(totalBudget)}</span>
                                    </div>
                                    <div
                                        className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden"
                                        title={`Total Budget Spent: ${formatMoney(budgetSpent)}`}
                                    >
                                        <div
                                            className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                        <span>{percentage.toFixed(1)}% used</span>
                                        <span>{formatMoney(remaining)} remaining</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Bonus Budget Tracker for Leaderboard contests */}
                        {contest.contest_type === 'leaderboard' &&
                            contest.contest_based_details?.leaderboard_contest?.total_budget != null &&
                            contest.contest_based_details.leaderboard_contest.total_budget > 0 && (() => {
                                const totalBudget = contest.contest_based_details.leaderboard_contest.total_budget;
                                const budgetSpent = contest.contest_based_details.leaderboard_contest.budget_spent || 0;
                                const percentage = (budgetSpent / totalBudget) * 100;
                                const remaining = totalBudget - budgetSpent;

                                return (
                                    <div className="mt-3 mb-3">
                                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300 mb-2">
                                            <span className="font-medium">Flat Fee Bonus Budget Tracker</span>
                                            <span className="font-semibold">{formatMoney(budgetSpent)} / {formatMoney(totalBudget)}</span>
                                        </div>
                                        <div
                                            className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden"
                                            title={`Flat Fee Bonus Budget Spent: ${formatMoney(budgetSpent)}`}
                                        >
                                            <div
                                                className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500 ease-out"
                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                            <span>{percentage.toFixed(1)}% used</span>
                                            <span>{formatMoney(remaining)} remaining</span>
                                        </div>
                                    </div>
                                );
                            })()}

            <button
              className={cn(
                "flex w-full items-center justify-center gap-2  px-3 py-3 rounded-full",
                isDark
                  ? "bg-[#7F39EC] text-white"
                  : "bg-[#D9C0FF61] text-[#7F39EC]"
              )}
              onClick={(e) => {
                e.stopPropagation();
                const href = isAdminView
                  ? `/dashboard/admin/contests/${contest.id}`
                  : `/dashboard/contests/${contest.id}`;
                router.push(href);
              }}
              // size="sm"
              // variant="outline"
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </button>
          </CardContent>
        </Card>
      );
    }

    // Modified design for unpublished contests with moderation status
    return (
      <Card
        key={contest.id}
        className={cn(
          "overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col group w-full cursor-pointer",
          isDark ? "bg-[#06021D] border-slate-700" : "bg-white border-slate-200"
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) {
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
                src={contest.thumbnail_url || "/placeholder.svg"}
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
            <div className="absolute top-3 right-3 flex flex-wrap gap-1">
              {getModerationStatusBadge(contest.moderation_status)}
            </div>
          </div>

          <CardContent className="flex-grow p-4 flex flex-col">
            <div className="mb-3">
              <h3
                className={cn(
                  "font-bold text-lg leading-tight  line-clamp-2",
                  isDark ? "text-white" : " text-slate-900 dark:text-slate-100 "
                )}
              >
                {contest.title || "Untitled Contest"}
              </h3>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="outline"
                className="text-sm  bg-[#7F39EC] text-white py-1 capitalize"
              >
                {contest.platform || "Platform"}
              </Badge>
              <Badge
                variant="outline"
                className="text-sm  bg-[#7F39EC] text-white py-1 capitalize"
              >
                {contest.contest_type || "Type"}
              </Badge>
            </div>

            <div
              className={cn(
                "space-y-2 text-md mb-4 flex-grow",
                isDark ? "text-white" : "text-slate-600"
              )}
            >
              {contest.start_date && contest.end_date ? (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatLocalDateTime(contest.start_date)} -{" "}
                    {formatLocalDateTime(contest.end_date)}
                  </span>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex items-center gap-1",
                    isDark ? "text-amber-400" : "text-amber-600"
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span>Dates not set</span>
                </div>
              )}
              {contest.contest_based_details && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span>
                    {contest.contest_type === "leaderboard"
                      ? `Prize: ${formatMoney(
                          contest.contest_based_details.leaderboard_contest
                            ?.total_prize || 0
                        )}`
                      : `Budget: ${formatMoney(
                          contest.contest_based_details.cpm_contest
                            ?.total_budget || 0
                        )}`}
                  </span>
                </div>
              )}
              {contest.rejection_reason && (
                <div className="flex items-start gap-1 text-red-600 dark:text-red-400">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">{contest.rejection_reason}</span>
                </div>
              )}
            </div>

                       <div className="flex gap-2 items-center">
                            {contest.moderation_status === 'approved' ? (
                                <>
                                    <button
                                        className="flex w-full items-center justify-center gap-2 bg-[#D9C0FF61] px-3 py-3 text-[#7F39EC] rounded-full"
                                     
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                                const response = await fetch(`/api/contests/${contest.id}/publish`, {
                                                    method: 'POST'
                                                });
                                                if (response.ok) {
                                                    window.location.reload();
                                                } else {
                                                    const error = await response.json();
                                                    alert(error.error || 'Failed to publish contest');
                                                }
                                            } catch (error) {
                                                alert('Failed to publish contest');
                                            }
                                        }}
                                    >
                                        <PlayCircle className="h-4 w-4 mr-1" />
                                        Publish
                                    </button>
                                    <Button
                                        variant="outline"
                                          size="md"
                                          className="text-purple-500 text-[13px]"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/dashboard/contests/${contest.id}/edit?dates=true`);
                                        }}
                                    >
                                        <Calendar className="h-4 w-4" />
                                        Edit Dates
                                    </Button>
                                </>
                            ) : contest.moderation_status !== 'published' ? (
                                // Non-published contests: Show Edit Contest button
                                <button
                                
                                   
                                      className="flex w-full items-center justify-center gap-2 bg-[#D9C0FF61] px-3 py-3 text-[#7F39EC] rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const href = isAdminView
                                            ? `/dashboard/contests/${contest.id}/edit`
                                            : `/dashboard/contests/${contest.id}/edit`;
                                        router.push(href);
                                    }}
                                >
                                      <Edit className="h-4 w-4" />
                                      <span>Edit Contest</span>
                                </button>
                            ) : (
                                <button
                                    // variant="outline"
                                    // size="sm"
                                    className="flex w-full items-center justify-center gap-2 bg-[#D9C0FF61] px-3 py-3 text-[#7F39EC] rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const href = isAdminView
                                            ? `/dashboard/admin/contests/${contest.id}`
                                            : `/dashboard/contests/${contest.id}`;
                                        router.push(href);
                                    }}
                                >
                                    <Eye className="h-4 w-4" />
                                    <span>View Details</span>
                                </button>
                            )}

                            {contest.moderation_status !== 'published' && (
                            
                                <DeleteContestButton
                            
                                    contestId={contest.id}
                                    contestTitle={contest.title || 'this contest'}
                                    isDeletable={true}
                                      className="flex items-center gap-2"
                                />
                            )}
                        </div>
                    </CardContent>
                </div>
            </Card>
        );
    };

  const currentContests =
    contestsByStatus[selectedTab as keyof typeof contestsByStatus] || [];

  // Apply sorting to currentContests when no additional filters are applied
  const sortedCurrentContests = useMemo(() => {
    if (
      contestStatusFilter !== "all" ||
      platformFilter !== "all" ||
      contestTypeFilter !== "all"
    ) {
      return filteredAndSortedContests; // Use filtered and sorted results
    }

    // Apply sorting to tab-based contests
    const sortedContests = [...currentContests];
    sortedContests.sort((a, b) => {
      switch (sortOption) {
        case "created_at_desc":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "created_at_asc":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "start_date_desc":
          if (!a.start_date) return 1; // push contests without start_date to the bottom
          if (!b.start_date) return -1;
          return (
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          );
        case "start_date_asc":
          if (!a.start_date) return 1; // push contests without start_date to the bottom
          if (!b.start_date) return -1;
          return (
            new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
          );
        case "end_date_asc":
          if (!a.end_date) return 1; // push contests without end_date to the bottom
          if (!b.end_date) return -1;
          return (
            new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
          );
        case "end_date_desc":
          if (!a.end_date) return 1;
          if (!b.end_date) return -1;
          return (
            new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
          );
        case "value_desc":
        case "value_asc":
          let valueA = 0;
          let valueB = 0;
          if (
            a.contest_type === "leaderboard" &&
            a.contest_based_details?.leaderboard_contest?.total_prize
          ) {
            valueA = a.contest_based_details.leaderboard_contest.total_prize;
          } else if (
            a.contest_type === "cpm" &&
            a.contest_based_details?.cpm_contest?.total_budget
          ) {
            valueA = a.contest_based_details.cpm_contest.total_budget;
          }
          if (
            b.contest_type === "leaderboard" &&
            b.contest_based_details?.leaderboard_contest?.total_prize
          ) {
            valueB = b.contest_based_details.leaderboard_contest.total_prize;
          } else if (
            b.contest_type === "cpm" &&
            b.contest_based_details?.cpm_contest?.total_budget
          ) {
            valueB = b.contest_based_details.cpm_contest.total_budget;
          }
          return sortOption === "value_desc"
            ? valueB - valueA
            : valueA - valueB;
        case "cpm_rate_desc":
        case "cpm_rate_asc":
          const rateA =
            a.contest_type === "cpm" &&
            a.contest_based_details?.cpm_contest?.cpm_rate_usd
              ? a.contest_based_details.cpm_contest.cpm_rate_usd
              : -1;
          const rateB =
            b.contest_type === "cpm" &&
            b.contest_based_details?.cpm_contest?.cpm_rate_usd
              ? b.contest_based_details.cpm_contest.cpm_rate_usd
              : -1;
          if (rateA === -1 && rateB === -1) return 0;
          if (rateA === -1) return 1; // a (no rate) comes after b (has rate)
          if (rateB === -1) return -1; // b (no rate) comes after a (has rate)
          return sortOption === "cpm_rate_desc" ? rateB - rateA : rateA - rateB;
        case "submissions_desc":
        case "submissions_asc":
          const countA = a.live_submission_count ?? -1;
          const countB = b.live_submission_count ?? -1;
          if (countA === -1 && countB === -1) return 0;
          if (countA === -1) return 1;
          if (countB === -1) return -1;
          return sortOption === "submissions_desc"
            ? countB - countA
            : countA - countB;
        default:
          return 0;
      }
    });

    return sortedContests;
  }, [
    currentContests,
    sortOption,
    filteredAndSortedContests,
    contestStatusFilter,
    platformFilter,
    contestTypeFilter,
    selectedTab,
  ]);

  const displayContests = sortedCurrentContests;

  return (
    <div className="w-full">
      {/* Header with filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Select
              value={sortOption}
              onValueChange={(value) => setSortOption(value as SortOptionType)}
            >
              <SelectTrigger className="w-full sm:w-[200px] border border-gray-400">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem isDark={isDark} value="created_at_desc">
                  Date Created: Latest
                </SelectItem>
                <SelectItem isDark={isDark} value="created_at_asc">
                  Date Created: Earliest
                </SelectItem>
                <SelectItem isDark={isDark} value="start_date_asc">
                  Launch Date: Closest
                </SelectItem>
                <SelectItem isDark={isDark} value="start_date_desc">
                  Launch Date: Farthest
                </SelectItem>
                <SelectItem isDark={isDark} value="end_date_asc">
                  End Date: Closest
                </SelectItem>
                <SelectItem isDark={isDark} value="end_date_desc">
                  End Date: Farthest
                </SelectItem>
                <SelectItem isDark={isDark} value="value_desc">
                  Prize/Budget: High to Low
                </SelectItem>
                <SelectItem isDark={isDark} value="value_asc">
                  Prize/Budget: Low to High
                </SelectItem>
                <SelectItem isDark={isDark} value="cpm_rate_desc">
                  CPM Rate: High to Low
                </SelectItem>
                <SelectItem isDark={isDark} value="cpm_rate_asc">
                  CPM Rate: Low to High
                </SelectItem>
                <SelectItem isDark={isDark} value="submissions_desc">
                  Submissions: High to Low
                </SelectItem>
                <SelectItem isDark={isDark} value="submissions_asc">
                  Submissions: Low to High
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full sm:w-[150px] border border-gray-400">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                {availablePlatforms.map((p) => (
                  <SelectItem isDark={isDark} key={p} value={p}>
                    {p === "all" ? "All Platforms" : p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Contest Status Filter */}
            <Select
              value={contestStatusFilter}
              onValueChange={setContestStatusFilter}
            >
              <SelectTrigger className="w-full sm:w-[150px] border border-gray-400">
                <SelectValue placeholder="Contest Status" />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem isDark={isDark} value="all">
                  All Status
                </SelectItem>
                <SelectItem isDark={isDark} value="live">
                  Live
                </SelectItem>
                <SelectItem isDark={isDark} value="upcoming">
                  Upcoming
                </SelectItem>
                <SelectItem isDark={isDark} value="ended">
                  Ended
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Contest Type Filter */}
            <Select
              value={contestTypeFilter}
              onValueChange={setContestTypeFilter}
            >
              <SelectTrigger className="w-full sm:w-[150px] border border-gray-400">
                <SelectValue placeholder="Contest Type" />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem isDark={isDark} value="all">
                  All Types
                </SelectItem>
                <SelectItem isDark={isDark} value="leaderboard">
                  Leaderboard
                </SelectItem>
                <SelectItem isDark={isDark} value="cpm">
                  CPM
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

            {/* Enhanced Status Filter Tabs - More Responsive */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full mb-8">
                <TabsList className="flex gap-6">
                    <TabsTrigger className="border border-gray-400" value="all">
                        All <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                        {contestsByStatus.all.length}
                        </Badge>
                       
                    </TabsTrigger>
                    <TabsTrigger className="border border-gray-400" value="draft">
                        Draft <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                            {contestsByStatus.draft.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger className="border border-gray-400"value="pending_approval">
                        Pending Approval <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                            {contestsByStatus.pending_approval.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger className="border border-gray-400" value="ready">
                        Ready <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                            {contestsByStatus.ready.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger className="border border-gray-400" value="active">
                        Active <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                            {contestsByStatus.active.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger className="border border-gray-400"value="pending_verification">
                        Pending Verification <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                            {contestsByStatus.pending_verification.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger className="border border-gray-400" value="done">
                        Done <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                            {contestsByStatus.done.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger className="border border-gray-400"value="rejected">
                        Rejected <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                            {contestsByStatus.rejected.length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>
                {Object.keys(contestsByStatus).map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="mt-4">
            <div
              className="grid gap-6"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              }}
            >
              {displayContests.length > 0 ? (
                displayContests.map((contest) => renderContestCard(contest))
              ) : (
                <div className="col-span-full text-center py-12">
                  <h3 className="text-lg font-semibold">No Contests Found</h3>
                  <p className="text-slate-500 mt-2">
                    {platformFilter !== "all" ||
                    contestStatusFilter !== "all" ||
                    contestTypeFilter !== "all"
                      ? `No contests match the current filters for ${tabValue
                          .split("_")
                          .join(" ")} status.`
                      : `No contests found for ${tabValue
                          .split("_")
                          .join(" ")} status.`}
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
