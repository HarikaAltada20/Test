
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { SubmissionWithContest } from "@/types/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsContent as TabsContent,
} from "@/components/ui/enhanced-tabs";
import { ExternalLink, Filter, Video, AlertCircle, Info, ArrowRight, Search, Layers, Clock, CheckCircle2, XCircle, History, DollarSign, Menu, MoreVertical, Eye, Trophy, TrendingUp, Coins, CalendarDays, Tag, ChevronLeft, ChevronRight, ChevronDown, Check, ListOrdered, Gift, CheckCheck, Loader2, ShieldCheck, Star, Hash, SquareArrowOutUpRight } from "lucide-react";
import Image from "next/image";
import React from "react";
import { centsToDollars, formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { getFullRejectionDetails } from "@/lib/submission-metadata";
import { cn } from "@/lib/utils";
import { adjustRewardCents, parsePayoutAdjustment } from "@/lib/payout-rules";
import { computeCpmRawCentsForRow } from "@/lib/cpm-expected-cents";
import { getMilestoneEligibleViewsFromRow } from "@/lib/milestone-contest-expected-spend";
import {
  contestTypeForPlatform,
  resolveCpmContestConfigForPlatform,
  resolveMilestoneContestForPlatform,
} from "@/lib/video-platform-campaigns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { subDays, subWeeks, subMonths, subYears, startOfToday, format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubmissionQualityScoreDisplay } from "@/components/SubmissionQualityScoreCell";
import { parseQualityScore, type QualityScore } from "@/lib/quality-score";
import {
  formatQualityScoreDisplay,
  formatQualitySumDisplay,
  formatTrustScoreDisplay,
} from "@/lib/creator-profile-stats";

// Map human-readable rejection reason labels to their descriptions (new canonical set only)
const REJECTION_REASON_DESCRIPTIONS: Record<string, string> = {
  "Contest brief or rules not followed":
    "Submission does not follow the contest brief or rules",
  "Terms & Conditions violation":
    "Violates the platform or contest terms and conditions",
  "Inappropriate content":
    "Content contains inappropriate, offensive, or unsuitable material for our platform",
  "Copyright issue":
    "Content may violate copyright, trademark, or intellectual property rights",
  "Technical issues":
    "Content has technical problems, is not accessible, or was deleted",
  "Duplicate content":
    "Content appears to be duplicate or very similar to existing submissions or previous work",
  "Quality standards not met":
    "Content quality does not meet the required standards",
  "Custom Reason":
    "Other reason not listed above - please provide specific details",
};


interface PaginationCursor {
  cursor: string;
  cursor_id: string;
}

interface SubmissionsClientProps {
  initialSubmissions: SubmissionWithContest[];
  fetchError?: string;
  creatorStats?: {
    trustScorePct: number | null;
    trustNumber: number | null;
    avgQualityScore: number | null;
    bestQualityScore: number | null;
    totalQualityScore: number | null;
  };
  initialNextCursor?: PaginationCursor | null;
  totalCount?: number;
}

type ContestTypeFilter =
  | "all"
  | "leaderboard"
  | "cpm"
  | "milestone"
  | "dual_rewards";
type StatusFilter =
  | "all"
  | "pending"
  | "verified"
  | "rejected"
  | "paid";
type PlatformFilter = "all" | "youtube" | "instagram" | "tiktok" | "twitter" | "other";
type ViewMode = "all" | "contest";
type SortOrder = "normal" | "newest" | "oldest" | "views_high" | "views_low" | "earnings_high" | "earnings_low" | "submissions_high" | "submissions_low" | "quality_high" | "quality_low";
type DateFilter = "all" | "today" | "3days" | "1week" | "1month" | "1year" | "custom";

type SubmissionQualityFields = SubmissionWithContest & {
  quality_score?: number | null;
  quality_score_backfilled?: boolean | null;
};

function asContestDetails(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function submissionCampaignType(
  submission: SubmissionWithContest,
  contest: {
    contest_type?: string | null;
    contest_based_details?: unknown;
  } | null | undefined,
): string | null | undefined {
  return (
    contestTypeForPlatform(
      (contest?.contest_based_details as Record<string, unknown> | null) ?? null,
      submission.platform,
      contest?.contest_type,
    ) ?? contest?.contest_type
  );
}

function campaignTypeBadgeLabel(type: string | null | undefined): string {
  if (type === "leaderboard") return "Leaderboard";
  if (type === "cpm") return "CPM";
  if (type === "milestone") return "Milestone";
  if (type === "dual_rewards") return "Dual Rewards";
  return type || "—";
}

function isPoolPayoutCampaignType(type: string | null | undefined): boolean {
  return type === "cpm" || type === "milestone" || type === "dual_rewards";
}

function formatTrustNumberDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value >= 0 ? `+${value}` : String(value);
}

function getExplicitSubmissionQualityScore(
  submission: SubmissionWithContest,
): number | null {
  const row = submission as SubmissionQualityFields;
  if (row.quality_score_backfilled === true) return null;
  const status = String(row.status || "").toLowerCase();
  if (status !== "verified" && status !== "paid") return null;
  return parseQualityScore(row.quality_score);
}

function compareSubmissionQualityScores(
  a: SubmissionWithContest,
  b: SubmissionWithContest,
  direction: "high" | "low",
): number {
  const scoreA = getExplicitSubmissionQualityScore(a);
  const scoreB = getExplicitSubmissionQualityScore(b);
  if (scoreA === null && scoreB === null) return 0;
  if (scoreA === null) return 1;
  if (scoreB === null) return -1;
  return direction === "high" ? scoreB - scoreA : scoreA - scoreB;
}

function matchesQualityScoreFilters(
  submission: SubmissionWithContest,
  filters: Array<QualityScore | "unscored">,
): boolean {
  if (filters.length === 0) return true;
  const score = getExplicitSubmissionQualityScore(submission);
  return filters.some((filterValue) => {
    if (filterValue === "unscored") return score === null;
    return score === filterValue;
  });
}

function isVideoCampaignSubmission(submission: SubmissionWithContest): boolean {
  const contest = submission.contests;
  const platform = (contest?.platform || submission.platform || "").toLowerCase();
  const isTwitterTextImage =
    (platform === "twitter" || platform === "x") &&
    (contest as { contest_format?: string | null } | null)?.contest_format ===
      "text_image";
  return !isTwitterTextImage;
}

function getBestExplicitQualityScoreInGroup(
  submissions: SubmissionWithContest[],
): number | null {
  let best: number | null = null;
  for (const sub of submissions) {
    const score = getExplicitSubmissionQualityScore(sub);
    if (score !== null && (best === null || score > best)) {
      best = score;
    }
  }
  return best;
}

function compareGroupQualityScores(
  a: SubmissionWithContest[],
  b: SubmissionWithContest[],
  direction: "high" | "low",
): number {
  const scoreA = getBestExplicitQualityScoreInGroup(a);
  const scoreB = getBestExplicitQualityScoreInGroup(b);
  if (scoreA === null && scoreB === null) return 0;
  if (scoreA === null) return 1;
  if (scoreB === null) return -1;
  return direction === "high" ? scoreB - scoreA : scoreA - scoreB;
}

/**
 * Smart Lock Action Buttons - Enterprise Interaction
 * - Expands on hover (160px)
 * - Neighbor shrinks (36px)
 * - 3s delay before closing on leave
 * - ESC or Click Outside to close
 */
const SubmissionActionButtons = ({
  contentLink,
  contestId,
  contestStatus,
  isGroup = false,
  isFullWidth = false,
  onAction,
}: {
  contentLink: string;
  contestId: string | null | undefined;
  contestStatus?: string | null;
  isGroup?: boolean;
  isFullWidth?: boolean;
  onAction?: () => void;
  disableAnimation?: boolean;
}) => {
  const status = contestStatus || (contestId ? "active" : null);
  const isLive = status === "active" || status === "published" || status == null;
  const contestLink = contestId
    ? `/dashboard/opportunities/${contestId}?tab=leaderboard`
    : "#";
  const contestLabel = isLive ? "View contest" : "View leaderboard";
  const actionLabel = isGroup ? "View submissions" : "View content";
  const pillClass = cn(
    "inline-flex h-9 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-[#E4E4E4] px-3 text-sm font-medium leading-none text-[#171717] shadow-none hover:bg-[#dadada]",
    "dark:border-white/15 dark:bg-[#1a1a1a] dark:text-slate-100 dark:hover:bg-white/10",
    isFullWidth && "flex-1",
  );
  const iconClass = "h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-slate-400";

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        isFullWidth ? "w-full" : "mt-auto w-auto justify-end self-end pt-3",
      )}
    >
      {onAction ? (
        <button type="button" onClick={onAction} className={pillClass}>
          <ExternalLink className={iconClass} />
          <span>{actionLabel}</span>
        </button>
      ) : (
        <Link href={contentLink || "#"} target="_blank" rel="noopener noreferrer" className={pillClass}>
          <ExternalLink className={iconClass} />
          <span>{actionLabel}</span>
        </Link>
      )}
      <Link href={contestLink} className={pillClass}>
        <SquareArrowOutUpRight className={iconClass} />
        <span>{contestLabel}</span>
      </Link>
    </div>
  );
};

export default function SubmissionsClient({
  initialSubmissions,
  fetchError,
  creatorStats,
  initialNextCursor,
  totalCount,
}: SubmissionsClientProps) {
  const [allSubmissions, setAllSubmissions] =
    useState<SubmissionWithContest[]>(initialSubmissions);
  const [filteredSubmissions, setFilteredSubmissions] =
    useState<SubmissionWithContest[]>(initialSubmissions);
  // Used for analytics/statistics cards. Intentionally ignores Quality Score filter
  // so selecting a Quality Score in the Submissions table doesn't filter analytics.
  const [analyticsFilteredSubmissions, setAnalyticsFilteredSubmissions] =
    useState<SubmissionWithContest[]>(initialSubmissions);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allPagesLoaded, setAllPagesLoaded] = useState(!initialNextCursor);
  const nextCursorRef = useRef<PaginationCursor | null>(initialNextCursor ?? null);

  const fetchRemainingPages = useCallback(async () => {
    if (!nextCursorRef.current || isLoadingMore) return;
    setIsLoadingMore(true);
    const accumulated: SubmissionWithContest[] = [];
    let cursor = nextCursorRef.current;

    try {
      while (cursor) {
        const params = new URLSearchParams({
          cursor: cursor.cursor,
          cursor_id: cursor.cursor_id,
          limit: "50",
        });
        const res = await fetch(`/api/submissions/list?${params}`);
        if (!res.ok) break;
        const data = await res.json();
        accumulated.push(...(data.submissions ?? []));
        cursor = data.nextCursor ?? null;
      }
    } catch (err) {
      console.error("Error loading remaining submissions:", err);
    }

    if (accumulated.length > 0) {
      setAllSubmissions((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const unique = accumulated.filter((s) => !existingIds.has(s.id));
        return [...prev, ...unique];
      });
    }
    nextCursorRef.current = null;
    setAllPagesLoaded(true);
    setIsLoadingMore(false);
  }, [isLoadingMore]);

  useEffect(() => {
    if (initialNextCursor) {
      fetchRemainingPages();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [contestTypeFilter, setContestTypeFilter] = useState<string[]>([
    "leaderboard",
    "cpm",
    "milestone",
    "dual_rewards",
  ]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<string[]>([
    "youtube", "instagram", "tiktok"
  ]);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [qualityScoreFilters, setQualityScoreFilters] = useState<
    Array<QualityScore | "unscored">
  >([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});
  const [selectedContestGroup, setSelectedContestGroup] = useState<any>(null);
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);

  // Contest Status Multi-select State
  const [contestStatusFilter, setContestStatusFilter] = useState<string[]>([
    "live",
    "pending_review",
    "in_review",
    "verification_complete",
    "payouts_processed",
  ]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Payout semantics helpers (centralized)
  const isPayoutsProcessed = (c: any) => c?.post_contest_status === "payouts_processed";
  const isSubmissionPaid = (s: SubmissionWithContest) =>
    (s.status as string || "").toLowerCase() === "paid" || (s as any).paid === true;

  const formatContestTypeFilterLabel = (id: string) => {
    if (id === "dual_rewards") return "Dual Rewards";
    if (id === "cpm") return "CPM";
    return id.charAt(0).toUpperCase() + id.slice(1);
  };

  const getMilestoneMatchForSubmission = (
    submission: SubmissionWithContest,
    contest: any,
  ) => {
    const milestoneContest = resolveMilestoneContestForPlatform(
      contest?.contest_based_details,
      submission.platform,
      contest?.platform,
    );
    const rawMilestones = milestoneContest?.milestones;
    const milestones = Array.isArray(rawMilestones) ? rawMilestones : [];
    if (milestones.length === 0) return null;

    const submissionViews = getMilestoneEligibleViewsFromRow(submission);
    const sortedMilestones = [...milestones].sort(
      (a, b) => Number(b?.target_views || 0) - Number(a?.target_views || 0),
    );

    const matched = sortedMilestones.find((milestone) => {
      const targetViews = Number(milestone?.target_views || 0);
      return submissionViews >= targetViews;
    });

    if (!matched) return null;
    return {
      order: Number(matched?.order || 0),
      targetViews: Number(matched?.target_views || 0),
      payoutCents: Number(matched?.payout_cents || 0),
    };
  };

  const getMilestoneEstimatedEarningsCents = (
    submission: SubmissionWithContest,
    contest: any,
  ) => {
    const matchedMilestone = getMilestoneMatchForSubmission(submission, contest);
    return Number(matchedMilestone?.payoutCents || 0);
  };

  /** CPM-only portion (cents), using the submission platform's rate. */
  const getDualRewardsCpmEstimatedCents = (
    submission: SubmissionWithContest,
    contest: any,
  ) => {
    return computeCpmRawCentsForRow(
      submission,
      contest?.contest_based_details,
      contest?.platform,
    );
  };

  const applyContestRewardAdjustment = (
    amountCents: number,
    contest: any,
    contestType?: string | null,
  ) => {
    const adjustment = parsePayoutAdjustment(
      contest?.payout_adjustment_percentage,
      contest?.payout_adjustment_mode,
      { contestType: contestType ?? contest?.contest_type ?? null },
    );
    return adjustRewardCents(amountCents, {
      shouldAdjustReward: adjustment.shouldAdjustReward,
      percentage: adjustment.percentage,
    });
  };

  const getSubmissionEarningsAmount = (submission: SubmissionWithContest) => {
    const contest = submission.contests;
    const subStatus = (submission.status as string || "").toLowerCase();
    const paid = isSubmissionPaid(submission);
    const campaignType = submissionCampaignType(submission, contest);

    // Paid: always use DB values (all contests, all platforms)
    if (paid) {
      return submission.earnings ?? 0;
    }
    if (isPayoutsProcessed(contest)) return 0;

    if (campaignType === "cpm") {
      if (subStatus === "rejected") return 0;
      const rawAmount = computeCpmRawCentsForRow(
        submission,
        asContestDetails(contest?.contest_based_details),
        contest?.platform,
      );
      return applyContestRewardAdjustment(rawAmount, contest, campaignType);
    }

    if (campaignType === "milestone") {
      if (subStatus === "rejected") return 0;
      return applyContestRewardAdjustment(
        getMilestoneEstimatedEarningsCents(submission, contest),
        contest,
        campaignType,
      );
    }

    if (campaignType === "dual_rewards") {
      if (subStatus === "rejected") return 0;
      return applyContestRewardAdjustment(
        getDualRewardsCpmEstimatedCents(submission, contest) +
          getMilestoneEstimatedEarningsCents(submission, contest),
        contest,
        campaignType,
      );
    }

    const data = calculateLeaderboardEarnings(submission, contest);
    return applyContestRewardAdjustment(data.amount, contest, campaignType);
  };

  // For UI display only (cards/modals). This can show CPM estimates for
  // pending/verified submissions, but DOES NOT affect budget/confirmed stats.
  const getSubmissionDisplayEarningsAmount = (submission: SubmissionWithContest) => {
    const contest = submission.contests;
    const subStatus = (submission.status as string || "").toLowerCase();
    const paid = isSubmissionPaid(submission);
    const campaignType = submissionCampaignType(submission, contest);

    // Paid: always use DB values (all contests, all platforms)
    if (paid) {
      return submission.earnings ?? 0;
    }

    const postContestStatus = contest?.post_contest_status;

    // If contest payouts are fully processed, and this submission isn't paid,
    // there's nothing more to earn.
    if (isPayoutsProcessed(contest)) return 0;

    if (campaignType === "cpm") {
      if (subStatus === "rejected") return 0;

      const isVerificationComplete = postContestStatus === "verification_complete";
      if (isVerificationComplete) {
        const isConfirmed =
          subStatus === "verified" ||
          subStatus === "paid" ||
          (submission as any).paid === true;
        if (!isConfirmed) return 0;
      }

      const rawAmount = computeCpmRawCentsForRow(
        submission,
        asContestDetails(contest?.contest_based_details),
        contest?.platform,
      );
      return applyContestRewardAdjustment(rawAmount, contest, campaignType);
    }

    if (campaignType === "milestone") {
      if (subStatus === "rejected") return 0;

      const isVerificationComplete = postContestStatus === "verification_complete";
      if (isVerificationComplete) {
        const isConfirmed =
          subStatus === "verified" ||
          subStatus === "paid" ||
          (submission as any).paid === true;
        if (!isConfirmed) return 0;
      }

      return applyContestRewardAdjustment(
        getMilestoneEstimatedEarningsCents(submission, contest),
        contest,
        campaignType,
      );
    }

    if (campaignType === "dual_rewards") {
      if (subStatus === "rejected") return 0;

      const isVerificationComplete =
        postContestStatus === "verification_complete";
      if (isVerificationComplete) {
        const isConfirmed =
          subStatus === "verified" ||
          subStatus === "paid" ||
          (submission as any).paid === true;
        if (!isConfirmed) return 0;
      }

      return applyContestRewardAdjustment(
        getDualRewardsCpmEstimatedCents(submission, contest) +
          getMilestoneEstimatedEarningsCents(submission, contest),
        contest,
        campaignType,
      );
    }

    const data = calculateLeaderboardEarnings(submission, contest);
    return applyContestRewardAdjustment(data.amount, contest, campaignType);
  };

  const getSubmissionBonusAmount = (submission: SubmissionWithContest) => {
    if (isSubmissionPaid(submission)) {
      return (submission as any).bonus_amount ?? 0;
    }
    const contest = submission.contests;
    const subStatus = (submission.status as string || "").toLowerCase();
    const isVerified = subStatus === "verified" || subStatus === "paid";
    const isRejected = subStatus === "rejected";

    if (isRejected) return 0;

    // Gate: Participant bonus (flat fee) is ONLY shown/calculated once verified.
    // However, if an admin has ALREADY manually assigned a bonus_amount, we respect that immediately.
    const assignedBonus = (submission as any).bonus_amount || 0;
    if (!isVerified && assignedBonus === 0) return 0;

    const postContestStatus = contest?.post_contest_status;
    const isPayoutsProcessed = postContestStatus === "payouts_processed";
    const isVerificationComplete = postContestStatus === "verification_complete";
    const isFinalized = isPayoutsProcessed || isVerificationComplete;

    const bonusPaid = (submission as any).bonus_paid === true;

    if (isPayoutsProcessed) {
      return bonusPaid ? assignedBonus : 0;
    }

    // Prioritize assigned bonus amount if it exists
    if (assignedBonus > 0) return assignedBonus;

    // Fallback to flat fee bonus (participation bonus) ONLY if not finalized
    // Once finalized (Verification Completed), only count confirmed bonuses
    if (isFinalized) return 0;

    const contestDetails = contest?.contest_based_details as any;
    const bonusDetails = contest?.bonus_details as any;
    const platformCpmConfig = resolveCpmContestConfigForPlatform(
      contestDetails,
      submission.platform,
      contest?.platform,
    );
    const flatFeeBonus =
      platformCpmConfig?.flat_fee_bonus ||
      contestDetails?.cpm_contest?.flat_fee_bonus ||
      contestDetails?.leaderboard_contest?.flat_fee_bonus ||
      bonusDetails?.flat_fee_bonus || 0;

    return flatFeeBonus;
  };

  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const handleSearch = () => {
    if (isSearching) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setIsSearching(true);
    setActiveSearch(searchTerm);
    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(false);
      searchTimeoutRef.current = null;
    }, 450);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getStatusBadgeStyles = (
    status: SubmissionWithContest["status"] | null,
    contestEndDate?: string | null,
    postContestStatus?: string | null
  ): { bg: string; text: string; border: string } => {
    // If status is "paid", but payouts aren't processed, fallback to "verified" styling
    const effectiveStatus = (status === "paid" && postContestStatus !== "payouts_processed")
      ? "verified"
      : status;

    if (effectiveStatus === "rejected")
      return { bg: "bg-red-500/15", text: "text-red-500", border: "border-red-500/40" };
    if (effectiveStatus === "paid")
      return { bg: "bg-green-500/15", text: "text-green-500", border: "border-green-500/40" };
    if (effectiveStatus === "active" as any)
      return { bg: "bg-[#7F39EC]/20", text: "text-[#a855f7]", border: "border-[#7F39EC]/40" };
    if (effectiveStatus === "verified")
      return { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/40" };
    if (effectiveStatus === "pending")
      return { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/40" };
    if (contestEndDate && new Date(contestEndDate) < new Date())
      return { bg: "bg-gray-500/15", text: "text-gray-400", border: "border-gray-500/40" };
    return { bg: "bg-gray-500/15", text: "text-gray-400", border: "border-gray-500/40" };
  };

  const getContestStatusDisplay = (contest: any): { label: string; styles: { bg: string; text: string; border: string } } => {
    if (!contest) return { label: "Unknown", styles: { bg: "bg-gray-500/15", text: "text-gray-400", border: "border-gray-500/40" } };

    const isEnded = contest.end_date ? new Date(contest.end_date) < new Date() : false;
    const currentStatus = contest.status || contest.moderation_status;
    const isLive = !isEnded && (currentStatus === "active" || currentStatus === "published" || currentStatus == null);
    const postContestStatus = contest.post_contest_status;

    // 1. If payouts are processed, it's COMPLETELY done
    if (postContestStatus === "payouts_processed") {
      return { label: "Completed / Payouts processed", styles: { bg: "bg-green-500/15", text: "text-green-500", border: "border-green-500/40" } };
    }

    // 2. If verification is done
    if (postContestStatus === "verification_complete") {
      return { label: "Verification completed", styles: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/40" } };
    }

    // 3. If it's in review
    if (postContestStatus === "in_review") {
      return { label: "In Review", styles: { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/40" } };
    }

    // 3.5 If it's pending review
    if (postContestStatus === "pending_review") {
      return { label: "Pending Review", styles: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/40" } };
    }

    // 4. If contest is still running (Active)
    if (isLive) {
      return { label: "Live", styles: { bg: "bg-[#7F39EC]/20", text: "text-[#a855f7]", border: "border-[#7F39EC]/40" } };
    }

    // 5. Fallback for ended contests before review starts
    return { label: "Pending Review", styles: { bg: "bg-gray-500/15", text: "text-gray-400", border: "border-gray-500/40" } };
  };

  const calculateLeaderboardEarnings = (
    submission: SubmissionWithContest,
    contest: any
  ) => {
    if (!contest?.contest_based_details) {
      return { amount: 0, label: "Earnings" };
    }

    try {
      const contestDetails = contest.contest_based_details as any;
      const leaderboardConfig = contestDetails.leaderboard_contest;

      if (!leaderboardConfig || !leaderboardConfig.prizes) {
        return { amount: 0, label: "Estimated Earnings" };
      }

      const postContestStatus = contest.post_contest_status;
      const isPayoutsProcessed = postContestStatus === "payouts_processed";
      const isVerificationComplete = postContestStatus === "verification_complete";
      const isRejected = submission.status === "rejected";

      if (isRejected) {
        return { amount: 0, label: "Earnings", isRejected: true };
      }

      const isLive = contest.status === "active";
      const amount = submission.earnings || 0;


      const subStatus = (submission.status as string || "").toLowerCase();
      const isPaid = subStatus === "paid" || (submission as any).paid === true;

      if (isPayoutsProcessed) {
        return { amount: isPaid ? amount : 0, label: "Amount Earned" };
      }
      if (isVerificationComplete) {
        if (isPaid && amount > 0) return { amount, label: "Amount Earned" };
        return { amount: 0, label: "Check your rank" };
      }
      if (isLive) {
        if (amount > 0) return { amount, label: "Winning Zone" };
        return { amount: 0, label: "Check your rank" };
      }

      return { amount: 0, label: "Check your rank" };
    } catch (error) {
      console.warn("Error calculating leaderboard earnings:", error);
      return { amount: 0, label: "Estimated Earnings" };
    }
  };



  const getDisplayStatus = (submission: SubmissionWithContest): string => {
    if (!submission.status) return "Unknown";
    if (submission.status === "paid") return "Paid";
    return submission.status.charAt(0).toUpperCase() + submission.status.slice(1);
  };

  const postContestStatusMap: Record<string, string> = {
    pending_review: "Pending Review",
    in_review: "In Review",
    verification_complete: "Verification Complete",
    payouts_processed: "Payouts Processed",
  };

  const toggleCaption = (id: string) => {
    setExpandedCaptions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleReason = (id: string) => {
    setExpandedReasons(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleNote = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  // Handle desktop/mobile calendar months
  const [calendarMonths, setCalendarMonths] = useState(2);
  useEffect(() => {
    const handleResize = () => {
      setCalendarMonths(window.innerWidth < 640 ? 1 : 2);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reset sort order if current sort order is not available in the new view mode
  useEffect(() => {
    setCurrentPage(1); // Reset to first page on view mode change
    if (viewMode !== "contest") {
      if (sortOrder === "submissions_high" || sortOrder === "submissions_low") {
        setSortOrder("newest");
      }
    }
  }, [viewMode, sortOrder]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [contestTypeFilter, statusFilter, platformFilter, activeSearch, dateFilter, dateRange, itemsPerPage, contestStatusFilter, qualityScoreFilters]);

  const qualityScoreFilterButtonLabel = useMemo(() => {
    if (qualityScoreFilters.length === 0) return "All Quality Scores";
    const labels: Array<{ value: QualityScore | "unscored"; label: string }> = [
      { value: 5, label: "Score 5/5" },
      { value: 4, label: "Score 4/5" },
      { value: 3, label: "Score 3/5" },
      { value: 2, label: "Score 2/5" },
      { value: 1, label: "Score 1/5" },
      { value: "unscored", label: "No Quality Score" },
    ];
    const ordered = labels
      .filter((l) => qualityScoreFilters.includes(l.value))
      .map((l) => l.label);
    return ordered.length > 0 ? ordered.join(", ") : "All Quality Scores";
  }, [qualityScoreFilters]);

  const showQualityScoreFilter = useMemo(
    () => allSubmissions.some(isVideoCampaignSubmission),
    [allSubmissions],
  );

  useEffect(() => {
    if (!showQualityScoreFilter) {
      setQualityScoreFilters([]);
    }
  }, [showQualityScoreFilter]);

  const isDark = mode === "dark";
  const filterPillClass = cn(
    "!h-11 !min-w-[168px] !w-auto !justify-between !rounded-full !border !px-4 !py-0 text-sm font-medium shadow-none",
    isDark
      ? "!border-white/15 !bg-[#1a1a1a] !text-white hover:!bg-white/10"
      : "!border-neutral-200 !bg-[#E4E4E4] !text-[#171717] hover:!bg-[#dadada]",
  );
  const platformSelectValue =
    platformFilter.length === 1
      ? platformFilter[0] === "x"
        ? "twitter"
        : platformFilter[0]
      : platformFilter.length > 0 &&
          platformFilter.every((platform) => platform === "twitter" || platform === "x")
        ? "twitter"
        : "all";
  // Helper for dynamic card titles and descriptions
  const filterDisplayInfo: Record<
    StatusFilter,
    { title: string; description: string }
  > = {
    all: {
      title: "Submission view",
      description: "Showing all your submissions across different statuses.",
    },
    pending: {
      title: "Pending Submissions",
      description: "Submissions that are awaiting verification.",
    },
    verified: {
      title: "Verified Submissions",
      description: "Submissions that have been verified by the team.",
    },
    rejected: {
      title: "Rejected Submissions",
      description: "Submissions that have been rejected.",
    },
    paid: {
      title: "Paid Submissions",
      description: "Submissions for which earnings have been paid out.",
    },
  };

  useEffect(() => {
    setAllSubmissions(initialSubmissions);
    setFilteredSubmissions(initialSubmissions);
    setAnalyticsFilteredSubmissions(initialSubmissions);
  }, [initialSubmissions]);



  useEffect(() => {
    let submissions = [...allSubmissions];

    // Filter by contest type
    if (contestTypeFilter.length < 4) {
      submissions = submissions.filter(
        (sub) => sub.contests?.contest_type && contestTypeFilter.includes(sub.contests.contest_type)
      );
    }

    // Filter by platform
    if (platformFilter.length < 3) {
      submissions = submissions.filter(
        (sub) => sub.platform?.toLowerCase() && platformFilter.includes(sub.platform.toLowerCase())
      );
    }

    // Filter by search query (URL or Title)
    if (activeSearch.trim() !== "") {
      const query = activeSearch.toLowerCase();
      submissions = submissions.filter(
        (sub) =>
          sub.content_link?.toLowerCase().includes(query) ||
          sub.contests?.title?.toLowerCase().includes(query)
      );
    }

    // Filter by Search or Status
    submissions = submissions.filter((sub) => {
      const contestEndDate = sub.contests?.end_date
        ? new Date(sub.contests.end_date)
        : null;
      const isEnded = contestEndDate ? contestEndDate < new Date() : false;

      // 1. ALWAYS Filter by Contest Status (Live/Ended subcategories)
      const contestPostStatus = sub.contests?.post_contest_status || "pending_review";
      if (isEnded) {
        if (!contestStatusFilter.includes(contestPostStatus)) return false;
      } else {
        if (!contestStatusFilter.includes("live")) return false;
      }
      return true;
    });

    // Filter by status tab (Pending, Verified, etc.)
    if (statusFilter !== "all") {
      console.log("🔍 Filtering submissions by status:", statusFilter);
      console.log(
        "📊 All submissions before filtering:",
        allSubmissions.map((sub) => ({
          id: sub.id,
          status: sub.status,
          contestType: sub.contests?.contest_type,
          isEnded: sub.contests?.end_date
            ? new Date(sub.contests.end_date) < new Date()
            : false,
          earnings: sub.earnings, // in cents
          earningsInDollars: sub.earnings ? centsToDollars(sub.earnings) : null,
          postContestStatus: sub.contests?.post_contest_status,
        }))
      );

      submissions = submissions.filter((sub) => {
        const contestEndDate = sub.contests?.end_date
          ? new Date(sub.contests.end_date)
          : null;
        const isEnded = contestEndDate ? contestEndDate < new Date() : false;

        let shouldInclude = false;
        switch (statusFilter) {
          case "pending":
            shouldInclude = sub.status === "pending";
            break;
          case "verified":
            shouldInclude = sub.status === "verified";
            break;
          case "rejected":
            shouldInclude = sub.status === "rejected";
            break;
          case "paid":
            // Check if submission should be considered "paid" based on earnings and contest status
            const hasEarnings =
              sub.earnings !== null &&
              sub.earnings !== undefined &&
              sub.earnings > 0;
            const isContestCompleted =
              sub.contests?.post_contest_status === "verification_complete" ||
              sub.contests?.post_contest_status === "payouts_processed";
            const shouldBeConsideredPaid =
              sub.status === "paid" || (hasEarnings && isContestCompleted); // This means even the submission status is not paid and contest is ended and user has earnings show as paid ..

            console.log(`💰 Paid check for ${sub.id}:`, {
              status: sub.status,
              hasEarnings,
              earningsInCents: sub.earnings,
              earningsInDollars: sub.earnings
                ? centsToDollars(sub.earnings)
                : null,
              isContestCompleted,
              postContestStatus: sub.contests?.post_contest_status,
              shouldBeConsideredPaid,
            });

            shouldInclude = shouldBeConsideredPaid;
            break;
          default:
            shouldInclude = true;
        }

        console.log(
          `📋 Submission ${sub.id} (${sub.status}) - isEnded: ${isEnded}, shouldInclude: ${shouldInclude}`
        );
        return shouldInclude;
      });

      console.log(
        "✅ Filtered submissions:",
        submissions.map((sub) => ({
          id: sub.id,
          status: sub.status,
          contestType: sub.contests?.contest_type,
          earnings: sub.earnings ? centsToDollars(sub.earnings) : null,
        }))
      );
    }

    // Filter by Date
    if (dateFilter !== "all") {
      const now = new Date();
      let start: Date | null = null;
      let end = now;

      switch (dateFilter) {
        case "today":
          start = startOfToday();
          break;
        case "3days":
          start = subDays(now, 3);
          break;
        case "1week":
          start = subWeeks(now, 1);
          break;
        case "1month":
          start = subMonths(now, 1);
          break;
        case "1year":
          start = subYears(now, 1);
          break;
        case "custom":
          if (dateRange?.from) {
            start = dateRange.from;
            if (dateRange.to) {
              const endOfDay = new Date(dateRange.to);
              endOfDay.setHours(23, 59, 59, 999);
              end = endOfDay;
            } else {
              const endOfFromDay = new Date(dateRange.from);
              endOfFromDay.setHours(23, 59, 59, 999);
              end = endOfFromDay;
            }
          }
          break;
      }

      if (start) {
        submissions = submissions.filter((sub) => {
          const createdAt = new Date(sub.created_at);
          return createdAt >= start! && createdAt <= end;
        });
      }
    }

    // Analytics should reflect the same filters (status/search/date/type/platform)
    // but NOT be affected by the Quality Score filter used in the Submissions list.
    const submissionsForAnalytics = [...submissions];

    if (qualityScoreFilters.length > 0) {
      submissions = submissions.filter((sub) =>
        matchesQualityScoreFilters(sub, qualityScoreFilters),
      );
    }

    // Sort submissions
    submissions.sort((a, b) => {
      if (sortOrder === "normal" || sortOrder === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOrder === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOrder === "views_high") {
        return (b.views || 0) - (a.views || 0);
      }
      if (sortOrder === "views_low") {
        return (a.views || 0) - (b.views || 0);
      }
      if (sortOrder === "earnings_high") {
        const earningsA = getSubmissionEarningsAmount(a);
        const earningsB = getSubmissionEarningsAmount(b);
        return earningsB - earningsA;
      }
      if (sortOrder === "earnings_low") {
        const earningsA = getSubmissionEarningsAmount(a);
        const earningsB = getSubmissionEarningsAmount(b);
        return earningsA - earningsB;
      }
      if (sortOrder === "quality_high") {
        return compareSubmissionQualityScores(a, b, "high");
      }
      if (sortOrder === "quality_low") {
        return compareSubmissionQualityScores(a, b, "low");
      }
      if (sortOrder === "submissions_high" || sortOrder === "submissions_low") {
        // Fallback to newest for individual submissions view
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

    setAnalyticsFilteredSubmissions(submissionsForAnalytics);
    setFilteredSubmissions(submissions);
  }, [allSubmissions, contestTypeFilter, statusFilter, platformFilter, activeSearch, sortOrder, dateFilter, dateRange, contestStatusFilter, qualityScoreFilters]);

  const groupedContests = useMemo(() => {
    const groups: Record<string, {
      id: string;
      contest: any;
      submissions: SubmissionWithContest[];
      totalViews: number;
      totalEarnings: number;
      totalBonus: number;
      videoCount: number;
    }> = {};

    filteredSubmissions.forEach((sub, idx) => {
      const contestId = sub.contest_id || "unknown";
      const contest = sub.contests;
      if (!groups[contestId]) {
        groups[contestId] = {
          id: contestId,
          contest: contest,
          submissions: [],
          totalViews: 0,
          totalEarnings: 0,
          totalBonus: 0,
          videoCount: 0,
        };
      }
      groups[contestId].submissions.push(sub);
      groups[contestId].videoCount += 1;

      const subStatus = (sub.status as string || "").toLowerCase();
      const isRejected = subStatus === "rejected";
      const postContestStatus = contest?.post_contest_status;
      const isVerificationComplete = postContestStatus === "verification_complete";

      // 1. EXCLUDE Rejected submissions from all totals
      if (!isRejected) {
        // Only count views of valid submissions in the card total
        groups[contestId].totalViews += sub.views || 0;

        // For earnings/bonus in Verification Complete, only count confirmed
        // submissions (verified/paid). Pending items should no longer be
        // treated as having estimated earnings once verification is done.
        let includeForTotals = true;
        if (isVerificationComplete) {
          const isConfirmed =
            subStatus === "verified" ||
            subStatus === "paid" ||
            (sub as any).paid === true;
          if (!isConfirmed) includeForTotals = false;
        }

        if (includeForTotals) {
          // Add Earnings
          groups[contestId].totalEarnings += getSubmissionEarningsAmount(sub);

          // Add Bonus using unified logic
          groups[contestId].totalBonus += getSubmissionBonusAmount(sub);
        }
      }
    });

    return Object.values(groups).sort((a, b) => {
      switch (sortOrder) {
        case "submissions_high":
          return b.videoCount - a.videoCount;
        case "submissions_low":
          return a.videoCount - b.videoCount;
        case "earnings_high":
          return b.totalEarnings - a.totalEarnings;
        case "earnings_low":
          return a.totalEarnings - b.totalEarnings;
        case "views_high":
          return b.totalViews - a.totalViews;
        case "views_low":
          return a.totalViews - b.totalViews;
        case "quality_high":
          return compareGroupQualityScores(a.submissions, b.submissions, "high");
        case "quality_low":
          return compareGroupQualityScores(a.submissions, b.submissions, "low");
        case "oldest": {
          const earliestA = Math.min(...a.submissions.map((s) => new Date(s.created_at).getTime()));
          const earliestB = Math.min(...b.submissions.map((s) => new Date(s.created_at).getTime()));
          return earliestA - earliestB;
        }
        case "newest":
        case "normal":
        default: {
          const latestA = Math.max(...a.submissions.map((s) => new Date(s.created_at).getTime()));
          const latestB = Math.max(...b.submissions.map((s) => new Date(s.created_at).getTime()));
          return latestB - latestA;
        }
      }
    });
  }, [filteredSubmissions, sortOrder]);

  const stats = useMemo(() => {
    const contests = new Set(
      analyticsFilteredSubmissions.map((s) => s.contest_id).filter(Boolean),
    );
    const totalViews = analyticsFilteredSubmissions.reduce(
      (sum, s) => sum + (s.views || 0),
      0,
    );

    // Cash Earned: only submissions with status "paid"; use submission.earnings (cents).
    // post_contest_status may be verification_complete or payouts_processed — both allowed.
    const totalEarnings = analyticsFilteredSubmissions.reduce((sum, s) => {
      const subStatus = (s.status as string || "").toLowerCase();
      if (subStatus !== "paid") return sum;
      return sum + (Number((s as any).earnings) || 0);
    }, 0);

    // Bonus Earned: only submissions with status "paid"; use submission.bonus_amount (cents).
    // post_contest_status may be verification_complete or payouts_processed — both allowed.
    const totalBonus = analyticsFilteredSubmissions.reduce((sum, s) => {
      const subStatus = (s.status as string || "").toLowerCase();
      if (subStatus !== "paid") return sum;
      return sum + (Number((s as any).bonus_amount) || 0);
    }, 0);

    // Estimated earnings: for submissions NOT paid and NOT in payouts_processed contests.
    // EXCLUDES rejected and paid — only pending/verified (not yet paid) count as "estimated".
    const estimatedEarnings = analyticsFilteredSubmissions.reduce((sum, s) => {
      const contest = s.contests;
      if (!contest) return sum;
      const isPayoutsProcessed = contest.post_contest_status === "payouts_processed";
      if (isPayoutsProcessed) return sum;

      const subStatus = (s.status as string || "").toLowerCase();
      if (subStatus === "rejected") return sum;
      if (subStatus === "paid" || (s as any).paid === true) return sum;

      const isVerificationComplete = contest.post_contest_status === "verification_complete";
      if (isVerificationComplete) {
        const isConfirmed = subStatus === "verified";
        if (!isConfirmed) return sum;
      }

      return sum + getSubmissionEarningsAmount(s);
    }, 0);

    // Estimated bonus: for submissions NOT paid and NOT in payouts_processed contests.
    // EXCLUDES paid — only pending/verified (not yet paid) count as "estimated".
    const estimatedBonus = analyticsFilteredSubmissions.reduce((sum, s) => {
      const contest = s.contests;
      if (!contest) return sum;
      const isPayoutsProcessed = contest.post_contest_status === "payouts_processed";
      if (isPayoutsProcessed) return sum;

      const subStatus = (s.status as string || "").toLowerCase();
      if (subStatus === "paid" || (s as any).paid === true) return sum;

      return sum + getSubmissionBonusAmount(s);
    }, 0);

    return {
      contests: contests.size,
      views: totalViews,
      earnings: totalEarnings,
      bonus: totalBonus,
      estimatedEarnings,
      estimatedBonus,
    };
  }, [analyticsFilteredSubmissions]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: allSubmissions.length,
      pending: 0,
      verified: 0,
      rejected: 0,
      paid: 0,
    };
    for (const sub of allSubmissions) {
      if (sub.status === "pending") counts.pending += 1;
      if (sub.status === "verified") counts.verified += 1;
      if (sub.status === "rejected") counts.rejected += 1;
      const hasEarnings = sub.earnings != null && sub.earnings > 0;
      const isContestCompleted =
        sub.contests?.post_contest_status === "verification_complete" ||
        sub.contests?.post_contest_status === "payouts_processed";
      if (sub.status === "paid" || (hasEarnings && isContestCompleted)) {
        counts.paid += 1;
      }
    }
    return counts;
  }, [allSubmissions]);



  const renderSubmissionCard = (submission: SubmissionWithContest) => {
    const contest = submission.contests;

    const displayStatus = getDisplayStatus(submission);
    const views = submission.views ?? 0;
    const contestId = contest?.id;
    const isEnded = contest?.end_date ? new Date(contest.end_date) < new Date() : false;
    const rejectionDetails = submission.status === "rejected" ? getFullRejectionDetails(submission.metadata) : null;
    const systemNote = rejectionDetails?.reason ? REJECTION_REASON_DESCRIPTIONS[rejectionDetails.reason] : null;
    const displayNote = rejectionDetails?.additionalNotes || systemNote;

    const isPayoutsProcessedVal = isPayoutsProcessed(contest);
    const isVerificationComplete = contest?.post_contest_status === "verification_complete";
    const isRejected = submission.status === "rejected";
    const isPaidCard = isSubmissionPaid(submission);
    const subStatusLower = (submission.status as string || "").toLowerCase();
    const isPendingLike =
      !isPaidCard &&
      !isRejected &&
      contest?.post_contest_status !== "verification_complete" &&
      contest?.post_contest_status !== "payouts_processed" &&
      (subStatusLower === "pending" ||
        subStatusLower === "pending_review" ||
        subStatusLower === "submitted" ||
        subStatusLower === "in_review");

    const totalEarningsCents = getSubmissionDisplayEarningsAmount(submission);
    const earningsInDollars = centsToDollars(totalEarningsCents);
    const campaignType = submissionCampaignType(submission, contest);
    const milestoneMatch =
      campaignType === "milestone" || campaignType === "dual_rewards"
        ? getMilestoneMatchForSubmission(submission, contest)
        : null;

    let earningsDisplay: { label: string; amount: string; color: string; isRejected?: boolean } | null = null;

    if (isRejected) {
      earningsDisplay = { label: "Earnings", amount: "Not Eligible", color: "text-red-500", isRejected: true };
    } else if (isPaidCard) {
      earningsDisplay = {
        label: "Amount Earned",
        amount: centsToDollars(submission.earnings ?? 0).toFixed(2),
        // Finalized, fully earned amount in dark green
        color: "text-green-700",
      };
    } else if (isPoolPayoutCampaignType(campaignType)) {
      const label = isPayoutsProcessedVal
        ? "Amount Earned"
        : "Estimated Earnings";
      earningsDisplay = {
        label,
        amount: earningsInDollars.toFixed(2),
        // Base color; will be overridden below by status-based scheme
        color: isPayoutsProcessedVal ? "text-green-700" : isDark ? "text-blue-300" : "text-blue-600",
      };
    } else {
      const data = calculateLeaderboardEarnings(submission, contest) as any;
      const isCheckRank = data.label === "Check your rank";
      let color = isDark ? "text-emerald-400" : "text-emerald-600";
      if (data.isRejected) color = "text-red-500";
      else if (data.label === "Amount Earned") color = "text-green-500";
      else if (data.label === "Winning Zone") color = "text-purple-500";
      else if (data.label === "View Leaderboard" || data.label === "Check your rank") color = "text-[#7F39EC]";
      else if (data.label === "Estimated Earnings") color = isDark ? "text-blue-400" : "text-blue-600";

      earningsDisplay = {
        label: isCheckRank ? "Estimated Earnings" : data.label,
        amount: data.isRejected ? "Not Eligible" : isCheckRank ? "Check Ranking" : earningsInDollars.toFixed(2),
        color
      };
    }

    // Status-based color overrides for CPM submissions
    if (
      earningsDisplay &&
      isPoolPayoutCampaignType(campaignType)
    ) {
      if (isPaidCard && isPayoutsProcessedVal) {
        // Fully finalized
        earningsDisplay.color = "text-green-700";
      } else if (subStatusLower === "verified") {
        // Verified estimated earnings in blue
        earningsDisplay.color = isDark ? "text-blue-300" : "text-blue-600";
      } else if (isPendingLike) {
        // Pending estimated earnings in yellow
        earningsDisplay.color = isDark ? "text-yellow-300" : "text-yellow-500";
      }
    }

    const contestDetailsForBonus = contest?.contest_based_details as any;
    const bonusDetailsForCard = contest?.bonus_details as any;
    const platformCpmConfig = resolveCpmContestConfigForPlatform(
      contestDetailsForBonus,
      submission.platform,
      contest?.platform,
    );
    const flatFeeBonusForCard =
      platformCpmConfig?.flat_fee_bonus ||
      contestDetailsForBonus?.cpm_contest?.flat_fee_bonus ||
      contestDetailsForBonus?.leaderboard_contest?.flat_fee_bonus ||
      bonusDetailsForCard?.flat_fee_bonus ||
      0;

    const bonusAmountCents = getSubmissionBonusAmount(submission);
    const bonusAmountDollars = centsToDollars(bonusAmountCents).toFixed(2);
    const isVerifiedForBonus = submission.status === "verified";
    const isMilestoneContest = campaignType === "milestone";
    const showEstimatedBonus = !isMilestoneContest && !isPaidCard && (isVerifiedForBonus || flatFeeBonusForCard > 0);

    let bonusLabel = "Estimated Bonus";
    if (isRejected) {
      bonusLabel = "Bonus Won";
    } else if (isPaidCard) {
      bonusLabel = "Bonus Earned";
    } else if (isPayoutsProcessedVal) {
      bonusLabel = "Bonus Earned";
    } else if (isVerificationComplete) {
      bonusLabel = "Estimated Bonus";
    } else {
      bonusLabel = "Estimated Bonus";
    }
    const bonusColor = (bonusLabel === "Bonus Earned") ? "text-green-500" : isEnded ? "text-emerald-500" : isDark ? "text-slate-300" : "text-slate-600";
    const showBonusRow = !isMilestoneContest && bonusAmountCents > 0 && (bonusLabel !== "Estimated Bonus" || showEstimatedBonus);
    const explicitQualityScore = getExplicitSubmissionQualityScore(submission);

    // Massively expanded thumbnail detection for all social platforms (IG, TikTok, YT, Twitter)
    const meta = submission.metadata as any;

    // Capture the primary DB column and every possible variation from metadata (IG/TikTok/YT)
    const bestThumbnail = submission.video_thumbnail_url ||
      (submission as any).thumbnail_url ||
      (submission as any).thumbnail ||
      meta?.video_thumbnail_url ||
      meta?.thumbnail_url ||
      meta?.thumbnail ||
      meta?.display_url ||
      meta?.thumbnail_src ||
      meta?.image_url ||
      meta?.cover_image_url ||
      meta?.cover ||
      meta?.video?.cover ||
      meta?.shortcode_media?.display_url ||
      meta?.image_versions2?.candidates?.[0]?.url ||
      meta?.candidates?.[0]?.url ||
      meta?.video_details?.thumbnail_url;

    // Extract video title using exact logic from the View Submission modal
    const videoTitle = submission.video_title ||
      meta?.video_title ||
      meta?.title ||
      meta?.video_details?.title ||
      meta?.edge_media_to_caption?.edges?.[0]?.node?.text ||
      meta?.caption ||
      meta?.description ||
      meta?.desc ||
      meta?.text ||
      meta?.video?.description ||
      meta?.video?.desc ||
      "Untitled Submission";

    return (
      <div
        key={submission.id}
        className={cn(
          "rounded-2xl border p-4",
          isDark ? "border-white/10 bg-[#161616]" : "border-neutral-200 bg-white"
        )}
      >
        <div className="flex flex-col items-stretch gap-4 md:flex-row">
        <div className="relative w-full shrink-0 overflow-hidden rounded-[12px] border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-[#161616] md:w-[280px] md:aspect-[4/3] aspect-[16/9]">

          {(() => {
            const platformLower = (submission.platform || "").toLowerCase();
            const isInstagram = platformLower === "instagram";
            const isTiktok = platformLower.includes("tiktok");
            const isBroken = !!brokenThumbs[submission.id];
            const hasThumb = !!bestThumbnail;
            const shouldShowIgPoster = isInstagram && (!hasThumb || isBroken);
            const shouldShowTiktokPoster = isTiktok && (!hasThumb || isBroken);

            if (shouldShowIgPoster) {
              return (
                <img
                  src="/instagram-poster.svg"
                  alt="Instagram content"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              );
            }

            if (shouldShowTiktokPoster) {
              return (
                <div
                  className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-950 via-cyan-950 to-pink-950"
                  aria-label="TikTok content"
                />
              );
            }

            if (hasThumb && !isBroken) {
              return (
                <img
                  src={bestThumbnail}
                  alt="Thumbnail"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                  onError={() => setBrokenThumbs((prev) => ({ ...prev, [submission.id]: true }))}
                />
              );
            }

            return (
              <div className="flex flex-col items-center justify-center h-full bg-slate-50 dark:bg-slate-800/20 gap-2">
                <Video className="h-12 w-12 text-slate-300 dark:text-slate-700" />
                {isBroken && (
                  <span className="text-[10px] font-black uppercase tracking-tighter text-red-500/80">Link Expired</span>
                )}
              </div>
            );
          })()}
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 rounded text-[10px] font-bold text-white uppercase tracking-wider">
            {submission.platform || "Video"}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 self-stretch">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className={cn("min-w-0 truncate text-base font-semibold", isDark ? "text-white" : "text-[#171717]")}>
                {videoTitle}
              </h3>
              {videoTitle.length > 60 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedContestGroup({
                      contest: submission.contests,
                      submissions: [submission],
                      isSingleSubmission: true
                    });
                  }}
                  className="shrink-0 text-[11px] font-semibold text-[#525252] underline underline-offset-2 hover:text-[#171717]"
                >
                  View More
                </button>
              )}
            </div>
            {(() => {
              const styles = getStatusBadgeStyles(submission.status, contest?.end_date, contest?.post_contest_status);
              return (
                <span className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  styles.bg, styles.text, styles.border
                )}>
                  {displayStatus}
                </span>
              );
            })()}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            {(() => {
              const contestStatusInfo = getContestStatusDisplay(contest);
              return (
                <span className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  contestStatusInfo.styles.bg, contestStatusInfo.styles.text, contestStatusInfo.styles.border
                )}>
                  {contestStatusInfo.label}
                </span>
              );
            })()}
            <p className={cn("truncate text-sm font-medium", isDark ? "text-slate-200" : "text-[#292524]")}>
              {contest?.title || "Untitled Contest"}
            </p>
          </div>

          <div className={cn("flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap overflow-hidden flex-wrap", isDark ? "text-slate-200" : "text-[#44403c]")}>
            <span className="flex items-center gap-1 flex-shrink-0">
              <History className="w-3 h-3 opacity-60" />
              {submission.formatted_created_at?.split(',')[0] || "Date N/A"}
            </span>
            <span className="opacity-40 flex-shrink-0">•</span>
            <span className="flex items-center gap-1 flex-shrink-0">
              <Eye className="w-3 h-3 opacity-60" />
              {views.toLocaleString()}
            </span>
            <span className="opacity-40 flex-shrink-0">•</span>
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0 rounded-full border-slate-300 dark:border-slate-600">
              {campaignTypeBadgeLabel(campaignType)}
            </Badge>
            {campaignType === "leaderboard" && null}
          </div>

          <div className="mt-3 flex min-w-0 flex-col gap-1">
            {earningsDisplay && (
              <div className="flex flex-col items-start gap-1">
                <p className={cn("flex items-center gap-1.5 text-[15px] font-semibold", isDark ? "text-white" : "text-[#171717]")}>
                  {earningsDisplay.label === "Winning Zone" && <Trophy className="h-4 w-4" />}
                  {earningsDisplay.label}:{" "}
                  {earningsDisplay.amount === "Check Ranking" ? (
                    <Link
                      href={`/dashboard/opportunities/${contestId}?tab=leaderboard`}
                      className="underline hover:opacity-80 transition-opacity"
                    >
                      Check your rank <ExternalLink className="inline h-3 w-3 ml-1" />
                    </Link>
                  ) : earningsDisplay.amount === "Not Eligible" ? (
                    "Not Eligible"
                  ) : (
                    `$${earningsDisplay.amount} USD`
                  )}
                </p>
                {campaignType === "milestone" &&
                  totalEarningsCents > 0 &&
                  milestoneMatch && (
                    <p className={cn("text-[12px] font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
                      {milestoneMatch.order > 0
                        ? `Milestone ${milestoneMatch.order}`
                        : "Milestone"}{" "}
                      • Required Views: {milestoneMatch.targetViews.toLocaleString()}
                    </p>
                  )}
                {campaignType === "dual_rewards" && milestoneMatch && (
                    <p className={cn("text-[12px] font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
                      {milestoneMatch.order > 0
                        ? `Milestone ${milestoneMatch.order}`
                        : "Milestone"}{" "}
                      • Required Views:{" "}
                      {milestoneMatch.targetViews.toLocaleString()}
                    </p>
                  )}
                {isPayoutsProcessedVal && (submission as any).paid_at && (
                  <span className="text-[12px] font-medium text-slate-400">
                    (Paid on: {format(new Date((submission as any).paid_at), "MMM d, yyyy")})
                  </span>
                )}
              </div>
            )}
            {/* Detailed helper text replaced by tooltip on the label */}
            {!earningsDisplay && submission.status === "rejected" && (
              <p className="text-[15px] font-semibold text-red-500">
                No Prize Won: $0.00 USD
              </p>
            )}
            {!isRejected && showBonusRow && (
              <div className="flex items-center gap-2">
                <p className={cn("text-[15px] font-medium", bonusColor)}>
                  {bonusLabel}: ${bonusAmountDollars} USD
                </p>
                {isPayoutsProcessedVal && (submission as any).bonus_paid_at && (
                  <span className="text-[12px] font-medium text-slate-400">
                    (Paid on: {format(new Date((submission as any).bonus_paid_at), "MMM d, yyyy")})
                  </span>
                )}
              </div>
            )}
            {explicitQualityScore !== null && (
              <SubmissionQualityScoreDisplay
                qualityScore={explicitQualityScore}
                isDark={isDark}
                variant="inline"
                className="mt-1"
              />
            )}
          </div>

          {submission.status === "rejected" && rejectionDetails && (
            <div className="mt-3 p-3 bg-red-500/5 border-l-4 border-red-500 rounded-r-lg flex flex-col gap-2 overflow-hidden">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[11px] font-black text-red-600 uppercase tracking-widest shrink-0">Rejection Reason:</span>
                <div className="flex items-center gap-2 min-w-0">
                  <p className={cn(
                    "text-[14px] font-bold text-red-700 dark:text-red-300 transition-all duration-300 min-w-0 flex-1",
                    "truncate"
                  )}>
                    {rejectionDetails.reason}
                  </p>
                  {rejectionDetails.reason.length > 60 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContestGroup({
                          contest: submission.contests,
                          submissions: [submission],
                          isSingleSubmission: true
                        });
                      }}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 shrink-0 transition-colors"
                    >
                      View More
                    </button>
                  )}
                </div>
              </div>
              {displayNote && (
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[11px] font-black text-red-600 uppercase tracking-widest shrink-0">Note:</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <p className={cn(
                      "text-[14px] font-medium text-red-600/80 dark:text-red-400/80 italic transition-all duration-300 min-w-0 flex-1",
                      "truncate"
                    )}>
                      {displayNote}
                    </p>
                    {displayNote.length > 60 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContestGroup({
                            contest: submission.contests,
                            submissions: [submission],
                            isSingleSubmission: true
                          });
                        }}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 shrink-0 transition-colors"
                      >
                        View More
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        <SubmissionActionButtons
          contentLink={submission.content_link || "#"}
          contestId={contestId}
          contestStatus={contest?.status}
        />
        </div>
        </div>
      </div>
    );
  };

  const renderContestGroupCard = (group: {
    id: string;
    contest: any;
    submissions: SubmissionWithContest[];
    totalViews: number;
    totalEarnings: number;
    totalBonus: number;
    videoCount: number;
  }) => {
    const { contest, totalViews, totalEarnings, totalBonus, videoCount } = group;
    const isEnded = contest?.end_date ? new Date(contest.end_date) < new Date() : false;
    const isPaidOut = contest?.post_contest_status === "payouts_processed";
    const isVerificationComplete = contest?.post_contest_status === "verification_complete";
    const contestId = contest?.id;

    const contestDetailsForBonus = contest?.contest_based_details as any;
    const bonusDetailsForContest = contest?.bonus_details as any;
    const groupCpmConfig = resolveCpmContestConfigForPlatform(
      contestDetailsForBonus,
      group.submissions[0]?.platform,
      contest?.platform,
    );
    const flatFeeBonusForContest =
      groupCpmConfig?.flat_fee_bonus ||
      contestDetailsForBonus?.cpm_contest?.flat_fee_bonus ||
      contestDetailsForBonus?.leaderboard_contest?.flat_fee_bonus ||
      bonusDetailsForContest?.flat_fee_bonus ||
      0;
    const hasFlatFeeBonus = flatFeeBonusForContest > 0;
    const cpmRateUsd =
      groupCpmConfig?.cpm_rate_usd ??
      contest?.contest_based_details?.cpm_contest?.cpm_rate_usd ??
      null;
    const maxSubmissions = contest?.max_submissions_per_creator ?? 1;

    return (
      <Card
        key={group.id}
        className={cn(
          "overflow-hidden rounded-[16px] shadow-none transition-all duration-300 border flex flex-col md:flex-row group w-full relative",
          isDark ? "bg-[#161616] border-white/10" : "bg-white border-neutral-200"
        )}
      >
        {/* Status Badge - Fixed overlap issues on mobile */}
        <div className="md:absolute md:top-4 md:right-4 z-10 flex flex-row gap-2 p-4 md:p-0">
          {(() => {
            const statusInfo = getContestStatusDisplay(contest);
            return (
              <Badge
                className={cn(
                  "capitalize text-[11px] px-3 py-1 font-bold tracking-wider border rounded-full",
                  statusInfo.styles.bg,
                  statusInfo.styles.text,
                  statusInfo.styles.border
                )}
              >
                {statusInfo.label}
              </Badge>
            );
          })()}
        </div>

        {/* Thumbnail Section - Corrected logic for Thumbnail vs Logo */}
        <div className="w-full md:w-[280px] aspect-[16/9] md:aspect-square flex-shrink-0 overflow-hidden bg-slate-100 dark:bg-[#161616] border-b md:border-b-0 md:border-r border-slate-100 dark:border-white/10 relative">
          {contest?.thumbnail_url ? (
            <img
              src={contest.thumbnail_url}
              alt={contest?.title || "Contest Thumbnail"}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-800/20 relative group-hover:bg-slate-100 dark:group-hover:bg-slate-800/40 transition-colors duration-300">
              <Avatar className="h-24 w-24 border-4 border-white dark:border-slate-700 shadow-xl transition-transform duration-300 group-hover:scale-110">
                {/* Fallback to advertiser logo if contest thumbnail is missing */}
                <AvatarImage src={contest?.users?.profile_picture_url || contest?.advertiser_profiles?.users?.profile_picture_url} className="object-cover" referrerPolicy="no-referrer" />
                <AvatarFallback className="bg-slate-200 dark:bg-slate-800 text-2xl font-black text-slate-400">
                  {contest?.title?.[0]?.toUpperCase() || group.submissions?.[0]?.platform?.[0]?.toUpperCase() || <Trophy className="h-10 w-10 text-slate-300" />}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {contest?.advertiser_profiles?.company_name && (
                <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#E4E4E4] text-neutral-700 border-neutral-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                  {contest.advertiser_profiles.company_name}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border-slate-200 dark:border-white/10">
                {contest?.platform || "Platform"}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border-slate-200 dark:border-white/10">
                {contest?.contest_type || "Type"}
              </Badge>
            </div>

            <h3
              className={cn(
                "text-[22px] md:text-[26px] font-black leading-tight mb-2 tracking-tight transition-all duration-300",
                "flex flex-wrap line-clamp-2 group-hover:line-clamp-none break-words",
                isDark ? "text-white" : "text-neutral-950"
              )}
            >
              {contest?.title || (contest?.platform || group.submissions[0]?.platform || "Contest").replace(/_/g, " ").toUpperCase()}
            </h3>

            <div className="flex items-center gap-4 flex-wrap">
              <p className={cn("text-[13px] font-semibold flex items-center gap-1.5", isDark ? "text-slate-400" : "text-slate-500")}>
                <Clock className={cn("w-3.5 h-3.5", isDark ? "text-slate-400" : "text-neutral-500")} />
                {contest?.end_date
                  ? `${isEnded ? 'Ended' : 'Deadline'}: ${format(new Date(contest.end_date), "MMM d, yyyy")}`
                  : 'Deadline: No deadline'}
              </p>
              {contest?.advertiser_profiles?.company_name && (
                <p className={cn("text-[13px] font-medium flex items-center gap-1.5", isDark ? "text-slate-500" : "text-slate-400")}>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  by <span className={cn("font-semibold", isDark ? "text-slate-200" : "text-neutral-800")}>{contest.advertiser_profiles.company_name}</span>
                </p>
              )}
            </div>

            {/* Contest meta: CPM rate, bonus availability, submissions allowed */}
            <div className="mt-2 flex flex-wrap gap-2">
              {cpmRateUsd != null &&
                !Number.isNaN(cpmRateUsd) &&
                cpmRateUsd > 0 && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] font-semibold flex items-center gap-1.5 rounded-full",
                      isDark
                        ? "bg-slate-800/70 text-slate-100 border-slate-700"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    )}
                  >
                    <DollarSign className="w-3 h-3" />
                    <span>
                      CPM:{" "}
                      <span className="font-bold">
                        {formatMoney(Math.round(cpmRateUsd * 100))} / 1k views
                      </span>
                    </span>
                  </Badge>
                )}

              {hasFlatFeeBonus && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] font-semibold flex items-center gap-1.5 rounded-full",
                    isDark
                      ? "bg-green-900/30 text-green-300 border-green-700/50"
                      : "bg-green-50 text-green-700 border-green-200"
                  )}
                >
                  <Gift className="w-3 h-3" />
                  <span>
                    Bonus available:{" "}
                    <span className="font-bold">
                      {formatMoney(flatFeeBonusForContest)} / submission
                    </span>
                  </span>
                </Badge>
              )}

              {maxSubmissions > 1 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] font-semibold flex items-center gap-1.5 rounded-full",
                    isDark
                      ? "bg-purple-900/30 text-purple-200 border-purple-700/50"
                      : "bg-purple-50 text-purple-700 border-purple-200"
                  )}
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>
                    {(maxSubmissions ?? 1) > 1
                      ? `${maxSubmissions} submissions allowed`
                      : "Multiple entries allowed"}
                  </span>
                </Badge>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-white/10">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Video className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Videos</span>
              </div>
              <p className={cn("text-[16px] font-black", isDark ? "text-white" : "text-slate-900")}>
                {videoCount}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-slate-400">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {(() => {
                    if (statusFilter === "rejected") return "Estimated Earnings";
                    // Paid tab or contest payouts done: show Amount Earned (including leaderboard paid)
                    if (statusFilter === "paid" || isPaidOut) return "Amount Earned";
                    return "Estimated Earnings";
                  })()}
                </span>
              </div>
              <p
                className={cn(
                  "text-[16px] font-black",
                  (() => {
                    if (statusFilter === "pending") return "text-yellow-500";
                    if (statusFilter === "verified") return "text-blue-600";
                    if (statusFilter === "rejected") return "text-red-500";
                    if (statusFilter === "paid" || isPaidOut) return "text-green-700";
                    // Leaderboard when not paid: "Check your rank" link in purple
                    if (contest?.contest_type === "leaderboard") return isDark ? "text-white" : "text-neutral-950";
                    return isDark ? "text-white" : "text-neutral-950";
                  })()
                )}
              >
                {statusFilter === "rejected" ? (
                  "Not Eligible"
                ) : (statusFilter === "paid" || isPaidOut) ? (
                  <>${centsToDollars(totalEarnings).toFixed(2)}</>
                ) : contest?.contest_type === "leaderboard" ? (
                  <Link
                    href={contestId ? `/dashboard/opportunities/${contestId}?tab=leaderboard` : "#"}
                    className="underline hover:opacity-80 transition-opacity"
                  >
                    Check your rank
                  </Link>
                ) : (
                  <>${centsToDollars(totalEarnings).toFixed(2)}</>
                )}
              </p>
            </div>

            {statusFilter !== "rejected" && statusFilter !== "pending" && (hasFlatFeeBonus || totalBonus > 0) && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Coins className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {(statusFilter === "paid" || isPaidOut) ? "Bonus Earned" : "Estimated Bonus"}
                  </span>
                </div>
                <p className={cn("text-[16px] font-black", isDark ? "text-white" : "text-neutral-950")}>
                  ${centsToDollars(totalBonus).toFixed(2)}
                </p>
              </div>
            )}

            {statusFilter !== "rejected" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Views</span>
                </div>
                <p className={cn("text-[16px] font-black", isDark ? "text-white" : "text-slate-900")}>
                  {totalViews.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-full border-neutral-200 bg-[#E4E4E4] px-4 text-[12px] font-semibold text-neutral-800 shadow-none hover:bg-[#dadada] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              onClick={() => setSelectedContestGroup(group)}
            >
              View Submissions
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          Error Fetching Submissions
        </h2>
        <p className="text-muted-foreground text-center">
          There was an issue retrieving your submissions: {fetchError}
        </p>
        <p className="text-muted-foreground text-center mt-2">
          Please try refreshing the page or contact support if the problem
          persists.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto py-[24px] px-[16px] flex flex-col gap-[24px]">
      {/* Page Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className={cn("text-[28px] font-semibold leading-tight tracking-tight", isDark ? "text-white" : "text-neutral-950")}>
            My submissions & earnings
          </h1>
          <p className={cn("mt-2 text-md", isDark ? "text-slate-400" : "text-neutral-700")}>
            Every post you&apos;ve submitted, where it stands, and what it earned.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <div className={cn(
            "flex h-11 w-full items-center rounded-full border px-4 sm:w-[320px]",
            isDark ? "border-white/15 bg-[#1a1a1a]" : "border-neutral-200 bg-[#E4E4E4]",
          )}>
            <Search className={cn("h-4 w-4 shrink-0", isDark ? "text-slate-400" : "text-neutral-500")} />
            <Input
              placeholder="Search by link or title"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "h-9 flex-1 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                isDark ? "text-slate-100 placeholder:text-slate-500" : "text-neutral-900 placeholder:text-neutral-500",
              )}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={handleSearch}
              disabled={isSearching}
              className={cn(
                "h-8 shrink-0 rounded-full bg-transparent px-3 text-sm font-semibold shadow-none",
                isDark ? "text-white hover:bg-white/10" : "text-[#171717] hover:bg-[#dadada]",
                isSearching && "cursor-wait opacity-90",
              )}
            >
              {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Search"}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={opportunitiesLoading}
            onClick={() => {
              setOpportunitiesLoading(true);
              setTimeout(() => {
                window.location.href = "/dashboard/opportunities";
              }, 100);
            }}
            className={cn(
              "h-11 shrink-0 rounded-full px-4 text-sm font-medium shadow-none",
              isDark
                ? "border-white/20 bg-transparent text-white hover:bg-white/10"
                : "border-neutral-200 bg-[#E4E4E4] text-neutral-800 hover:bg-[#dadada]",
            )}
          >
            {opportunitiesLoading ? <ButtonLoadingSpinner /> : null}
            Find campaigns
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.55fr)]">
        <section className={cn("flex min-h-[176px] flex-col rounded-2xl border p-5", isDark ? "border-white/10 bg-[#161616]" : "border-neutral-200 bg-white")}>
          <div className={cn("flex items-center gap-2 text-sm font-medium", isDark ? "text-slate-200" : "text-neutral-700")}>
            <ShieldCheck className="h-4 w-4" />
            Your account
          </div>
          <p className={cn("mt-4 text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Trust</p>
          <p className={cn("mt-1.5 text-[28px] font-semibold leading-none tracking-tight", isDark ? "text-white" : "text-neutral-950")}>
            {creatorStats?.trustScorePct != null ? formatTrustScoreDisplay(creatorStats.trustScorePct) : "—"}
          </p>
          <div className={cn("mt-auto flex items-end justify-between gap-4 border-t pt-4", isDark ? "border-white/10" : "border-neutral-200")}>
            <span className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Trust score</span>
            <span className={cn("mt-1 text-base font-semibold", isDark ? "text-slate-100" : "text-neutral-900")}>{formatTrustNumberDisplay(creatorStats?.trustNumber)}</span>
          </div>
        </section>

        <section className={cn("flex min-h-[176px] flex-col rounded-2xl border p-5", isDark ? "border-white/10 bg-[#161616]" : "border-neutral-200 bg-white")}>
          <div className={cn("flex items-center gap-2 text-sm font-medium", isDark ? "text-slate-200" : "text-neutral-700")}>
            <Star className="h-4 w-4" />
            Quality
          </div>
          <p className={cn("mt-4 text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Average</p>
          <p className={cn("mt-1.5 text-[28px] font-semibold leading-none tracking-tight", isDark ? "text-white" : "text-neutral-950")}>
            {formatQualityScoreDisplay(creatorStats?.avgQualityScore)}
          </p>
          <div className={cn("mt-auto grid grid-cols-2 gap-x-6 gap-y-1 border-t pt-4", isDark ? "border-white/10" : "border-neutral-200")}>
            <div>
              <p className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Best</p>
              <p className={cn("mt-1 text-base font-semibold", isDark ? "text-slate-100" : "text-neutral-900")}>{formatQualityScoreDisplay(creatorStats?.bestQualityScore)}</p>
            </div>
            <div>
              <p className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Total score</p>
              <p className={cn("mt-1 text-base font-semibold", isDark ? "text-slate-100" : "text-neutral-900")}>{formatQualitySumDisplay(creatorStats?.totalQualityScore)}</p>
            </div>
          </div>
        </section>

        <section className={cn("flex min-h-[176px] flex-col rounded-2xl border p-5", isDark ? "border-white/10 bg-[#161616]" : "border-neutral-200 bg-white")}>
          <div className={cn("flex items-center gap-2 text-sm font-medium", isDark ? "text-slate-200" : "text-neutral-700")}>
            <Eye className="h-4 w-4" />
            Reach
          </div>
          <p className={cn("mt-4 text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Total views</p>
          <p className={cn("mt-1.5 text-[28px] font-semibold leading-none tracking-tight", isDark ? "text-white" : "text-neutral-950")}>
            {stats.views.toLocaleString()}
          </p>
          <div className={cn("mt-auto flex items-end justify-between gap-4 border-t pt-4", isDark ? "border-white/10" : "border-neutral-200")}>
            <span className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Campaigns</span>
            <span className={cn("mt-1 text-base font-semibold", isDark ? "text-slate-100" : "text-neutral-900")}>{stats.contests}</span>
          </div>
        </section>

        <section className={cn("flex min-h-[176px] flex-col rounded-2xl border p-5 md:col-span-2 xl:col-span-1", isDark ? "border-white/10 bg-[#161616]" : "border-neutral-200 bg-white")}>
          <div className={cn("flex items-center gap-2 text-sm font-medium", isDark ? "text-slate-200" : "text-neutral-700")}>
            <DollarSign className="h-4 w-4" />
            Earnings
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Cash earned</p>
              <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight", isDark ? "text-white" : "text-neutral-950")}>${centsToDollars(stats.earnings).toFixed(2)}</p>
            </div>
            <div>
              <p className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Estimated cash</p>
              <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight", isDark ? "text-white" : "text-neutral-950")}>${centsToDollars(stats.estimatedEarnings).toFixed(2)}</p>
            </div>
          </div>
          <div className={cn("mt-5 grid grid-cols-2 gap-x-8 gap-y-1 border-t pt-4", isDark ? "border-white/10" : "border-neutral-200")}>
            <div>
              <p className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Bonus earned</p>
              <p className={cn("mt-1 text-base font-semibold", isDark ? "text-slate-100" : "text-neutral-900")}>${centsToDollars(stats.bonus).toFixed(2)}</p>
            </div>
            <div>
              <p className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-[#44403c]")}>Estimated bonus</p>
              <p className={cn("mt-1 text-base font-semibold", isDark ? "text-slate-100" : "text-neutral-900")}>${centsToDollars(stats.estimatedBonus).toFixed(2)}</p>
            </div>
          </div>
        </section>
      </div>

      <Tabs defaultValue="all" value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)} className="flex w-full flex-col gap-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div
            className={cn(
              "flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              isDark ? "bg-white/10" : "bg-[#E4E4E4]",
            )}
          >
            {([
              { id: "all", label: "All" },
              { id: "pending", label: "Pending" },
              { id: "verified", label: "Verified" },
              { id: "rejected", label: "Rejected" },
              { id: "paid", label: "Paid" },
            ] as const).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium leading-none transition-colors",
                    active
                      ? isDark
                        ? "bg-white/15 text-white shadow-sm"
                        : "bg-white text-[#1a1a1a] shadow-sm"
                      : isDark
                        ? "text-white/75 hover:bg-white/10 hover:text-white"
                        : "text-[#3f3f46] hover:bg-white/80 hover:text-[#1a1a1a]",
                  )}
                >
                  {tab.label}
                  <span className={cn("tabular-nums text-[13px] font-medium", active ? (isDark ? "text-white/70" : "text-[#71717a]") : isDark ? "text-white/45" : "text-[#71717a]")}>
                    {statusCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={cn("inline-flex h-11 items-center self-start rounded-full p-1", isDark ? "bg-white/10" : "bg-[#E4E4E4]")}>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium leading-none transition-colors",
                viewMode === "all"
                  ? isDark
                    ? "bg-white/15 text-white shadow-sm"
                    : "bg-white text-[#1a1a1a] shadow-sm"
                  : isDark
                    ? "text-white/75 hover:bg-white/10"
                    : "text-[#3f3f46] hover:bg-white/80",
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              Submissions
            </button>
            <button
              type="button"
              onClick={() => setViewMode("contest")}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium leading-none transition-colors",
                viewMode === "contest"
                  ? isDark
                    ? "bg-white/15 text-white shadow-sm"
                    : "bg-white text-[#1a1a1a] shadow-sm"
                  : isDark
                    ? "text-white/75 hover:bg-white/10"
                    : "text-[#3f3f46] hover:bg-white/80",
              )}
            >
              <Trophy className="h-3.5 w-3.5" />
              Campaigns
            </button>
          </div>
        </div>

      <div className="flex flex-wrap items-center gap-3 mt-2">
        <Select
          value={platformSelectValue}
          onValueChange={(value) => {
            if (value === "all") setPlatformFilter(["youtube", "instagram", "tiktok"]);
            else if (value === "twitter") setPlatformFilter(["twitter", "x"]);
            else setPlatformFilter([value]);
          }}
        >
          <SelectTrigger className={cn(filterPillClass, "w-[180px]")} aria-label="Platform">
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem isDark={isDark} value="all">All platforms</SelectItem>
            <SelectItem isDark={isDark} value="youtube">YouTube</SelectItem>
            <SelectItem isDark={isDark} value="instagram">Instagram</SelectItem>
            <SelectItem isDark={isDark} value="twitter">Twitter</SelectItem>
            <SelectItem isDark={isDark} value="tiktok">TikTok</SelectItem>
          </SelectContent>
        </Select>
        {/* Contest Status Multi-select Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(filterPillClass, "max-w-[260px] text-left")}
            >
              <span className="truncate">
                {(() => {
                  const statusMap: Record<string, string> = {
                    live: "Live",
                    pending_review: "Review Pending",
                    in_review: "In Review",
                    verification_complete: "Verification Completed",
                    payouts_processed: "Payouts Processed"
                  };
                  const endedStatuses = ["pending_review", "in_review", "verification_complete", "payouts_processed"];
                  const allEndedSelected = endedStatuses.every(s => contestStatusFilter.includes(s));

                  if (contestStatusFilter.length === 5) return "All statuses";
                  if (contestStatusFilter.length === 0) return "No Status Selected";

                  const parts: string[] = [];
                  if (contestStatusFilter.includes("live")) parts.push("Live");
                  if (allEndedSelected) {
                    parts.push("Ended");
                  } else {
                    contestStatusFilter.forEach(s => {
                      if (s !== "live" && statusMap[s]) parts.push(statusMap[s]);
                    });
                  }

                  const label = parts.join(", ");
                  return label.length > 20 ? `${parts.length} Selected` : label;
                })()}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-80" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-[240px] p-2 rounded-xl border-slate-200 dark:border-white/10", isDark ? "bg-[#161616]" : "bg-white")} align="start">
            <div className="flex flex-col gap-1">
              {/* LIVE option */}
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                  isDark ? "hover:bg-white/10" : "hover:bg-slate-50"
                )}
                onClick={() => {
                  setContestStatusFilter(prev =>
                    prev.includes("live") ? prev.filter(s => s !== "live") : [...prev, "live"]
                  );
                }}
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-all",
                  contestStatusFilter.includes("live")
                    ? "bg-[#4211a1] border-[#4211a1]"
                    : isDark ? "border-white/10 bg-[#161616]" : "border-slate-300 bg-white"
                )}>
                  {contestStatusFilter.includes("live") && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                </div>
                <span className={cn("text-[13px] font-bold", isDark ? "text-slate-200" : "text-slate-700")}>Live</span>
              </div>

              <div className={cn("h-[1px] my-1", isDark ? "bg-slate-800" : "bg-slate-100")} />

              {/* ENDED group */}
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                  isDark ? "hover:bg-white/10" : "hover:bg-slate-50"
                )}
                onClick={() => {
                  const endedStatuses = ["pending_review", "in_review", "verification_complete", "payouts_processed"];
                  const allEndedSelected = endedStatuses.every(s => contestStatusFilter.includes(s));
                  if (allEndedSelected) {
                    setContestStatusFilter(prev => prev.filter(s => !endedStatuses.includes(s)));
                  } else {
                    setContestStatusFilter(prev => Array.from(new Set([...prev, ...endedStatuses])));
                  }
                }}
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-all",
                  ["pending_review", "in_review", "verification_complete", "payouts_processed"].every(s => contestStatusFilter.includes(s))
                    ? "bg-[#4211a1] border-[#4211a1]"
                    : ["pending_review", "in_review", "verification_complete", "payouts_processed"].some(s => contestStatusFilter.includes(s))
                      ? "bg-[#4211a1]/50 border-[#4211a1]"
                      : isDark ? "border-white/10 bg-[#161616]" : "border-slate-300 bg-white"
                )}>
                  {["pending_review", "in_review", "verification_complete", "payouts_processed"].every(s => contestStatusFilter.includes(s)) && (
                    <Check className="w-3 h-3 text-white" strokeWidth={4} />
                  )}
                </div>
                <span className={cn("text-[13px] font-black uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>Ended</span>
              </div>

              {/* ENDED children */}
              {[
                { id: "pending_review", label: "Review Pending" },
                { id: "in_review", label: "In Review" },
                { id: "verification_complete", label: "Verification Completed" },
                { id: "payouts_processed", label: "Payouts Processed" },
              ].map(child => (
                <div
                  key={child.id}
                  className={cn(
                    "flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                    isDark ? "hover:bg-white/10" : "hover:bg-slate-50"
                  )}
                  onClick={() => {
                    setContestStatusFilter(prev =>
                      prev.includes(child.id) ? prev.filter(s => s !== child.id) : [...prev, child.id]
                    );
                  }}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                    contestStatusFilter.includes(child.id)
                      ? "bg-[#4211a1] border-[#4211a1]"
                      : isDark ? "border-white/10 bg-[#161616]" : "border-slate-300 bg-white"
                  )}>
                    {contestStatusFilter.includes(child.id) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </div>
                  <span className={cn("text-[13px] font-medium", isDark ? "text-slate-300" : "text-slate-600")}>{child.label}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Contest Type Multi-select Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(filterPillClass, "max-w-[240px] text-left")}
            >
              <span className="truncate">
                {contestTypeFilter.length === 4 ? "All types" :
                  contestTypeFilter.map((t) => formatContestTypeFilterLabel(t)).join(", ")}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-80" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-[200px] p-2 rounded-xl border-slate-200 dark:border-white/10", isDark ? "bg-[#161616]" : "bg-white")} align="start">
            <div className="flex flex-col gap-1">
              {[
                { id: "leaderboard", label: "Leaderboard" },
                { id: "cpm", label: "CPM" },
                { id: "milestone", label: "Milestone" },
                { id: "dual_rewards", label: "Dual Rewards" },
              ].map(type => (
                <div
                  key={type.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                    isDark ? "hover:bg-white/10" : "hover:bg-slate-50"
                  )}
                  onClick={() => {
                    setContestTypeFilter(prev =>
                      prev.includes(type.id) ? prev.filter(t => t !== type.id) : [...prev, type.id]
                    );
                  }}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                    contestTypeFilter.includes(type.id)
                      ? "bg-[#4211a1] border-[#4211a1]"
                      : isDark ? "border-white/10 bg-[#161616]" : "border-slate-300 bg-white"
                  )}>
                    {contestTypeFilter.includes(type.id) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </div>
                  <span className={cn("text-[13px] font-medium", isDark ? "text-slate-300" : "text-slate-600")}>{type.label}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <Select
            value={dateFilter}
            onValueChange={(value) => setDateFilter(value as DateFilter)}
          >
            <SelectTrigger className={cn(filterPillClass, "w-[180px]")} aria-label="Date">
              <SelectValue placeholder="All dates" />
            </SelectTrigger>
            <SelectContent isDark={isDark}>
              <SelectItem isDark={isDark} value="all">All dates</SelectItem>
              <SelectItem isDark={isDark} value="today">Today</SelectItem>
              <SelectItem isDark={isDark} value="3days">Last 3 Days</SelectItem>
              <SelectItem isDark={isDark} value="1week">Last 1 Week</SelectItem>
              <SelectItem isDark={isDark} value="1month">Last 1 Month</SelectItem>
              <SelectItem isDark={isDark} value="1year">Last 1 Year</SelectItem>
              <SelectItem isDark={isDark} value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {dateFilter === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    filterPillClass,
                    "w-full justify-start text-left font-normal sm:w-[240px]",
                    !dateRange && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                  {dateRange?.from ? (
                    dateRange?.to ? (
                      <span className="truncate">
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </span>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="z-[100] w-min max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border-slate-200 p-0 shadow-2xl dark:border-white/10"
                align={calendarMonths === 1 ? "center" : "start"}
                sideOffset={4}
              >
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={calendarMonths}
                  className={isDark ? "bg-[#161616] text-white" : "bg-white"}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
          <SelectTrigger className={cn(filterPillClass, "w-[180px]")} aria-label="Sort">
            <SelectValue placeholder="Newest first" />
          </SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem isDark={isDark} value="newest">Newest first</SelectItem>
            <SelectItem isDark={isDark} value="oldest">Oldest first</SelectItem>
            <SelectItem isDark={isDark} value="views_high">Most views</SelectItem>
            <SelectItem isDark={isDark} value="views_low">Fewest views</SelectItem>
            <SelectItem isDark={isDark} value="earnings_high">Most earnings</SelectItem>
            <SelectItem isDark={isDark} value="earnings_low">Least earnings</SelectItem>
            <SelectItem isDark={isDark} value="quality_high">Highest quality</SelectItem>
            <SelectItem isDark={isDark} value="quality_low">Lowest quality</SelectItem>
            {viewMode === "contest" && (
              <>
                <SelectItem isDark={isDark} value="submissions_high">Most submissions</SelectItem>
                <SelectItem isDark={isDark} value="submissions_low">Fewest submissions</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>

        {showQualityScoreFilter && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(filterPillClass, "max-w-[260px] text-left")}
            >
              <span className="truncate">
                {qualityScoreFilterButtonLabel}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-80" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn(
              "w-[240px] p-2 rounded-xl border-slate-200 dark:border-white/10",
              isDark ? "bg-[#161616]" : "bg-white",
            )}
            align="start"
          >
            <div className="flex flex-col gap-1">
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                  isDark ? "hover:bg-white/10" : "hover:bg-slate-50",
                )}
                onClick={() => setQualityScoreFilters([])}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                    qualityScoreFilters.length === 0
                      ? "bg-[#4211a1] border-[#4211a1]"
                      : isDark
                        ? "border-white/15 bg-[#161616]"
                        : "border-slate-300 bg-white",
                  )}
                >
                  {qualityScoreFilters.length === 0 && (
                    <Check className="w-3 h-3 text-white" strokeWidth={4} />
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isDark ? "text-slate-300" : "text-slate-700",
                  )}
                >
                  All Quality Scores
                </span>
              </div>

              {(
                [
                  { value: 5, label: "Score 5/5" },
                  { value: 4, label: "Score 4/5" },
                  { value: 3, label: "Score 3/5" },
                  { value: 2, label: "Score 2/5" },
                  { value: 1, label: "Score 1/5" },
                  { value: "unscored", label: "No Quality Score" },
                ] as Array<{ value: QualityScore | "unscored"; label: string }>
              ).map((opt) => {
                const checked = qualityScoreFilters.includes(opt.value);
                return (
                  <div
                    key={String(opt.value)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                      isDark ? "hover:bg-white/10" : "hover:bg-slate-50",
                    )}
                    onClick={() => {
                      setQualityScoreFilters((prev) =>
                        prev.includes(opt.value)
                          ? prev.filter((v) => v !== opt.value)
                          : [...prev, opt.value],
                      );
                    }}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                        checked
                          ? "bg-[#4211a1] border-[#4211a1]"
                          : isDark
                            ? "border-white/15 bg-[#161616]"
                            : "border-slate-300 bg-white",
                      )}
                    >
                      {checked && (
                        <Check className="w-3 h-3 text-white" strokeWidth={4} />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isDark ? "text-slate-300" : "text-slate-700",
                      )}
                    >
                      {opt.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        )}
      </div>


        <TabsContent value={statusFilter} className="mt-0">
          {/* Submission List Content */}
          <div className="flex flex-col gap-4">
            {viewMode === "contest" ? (
              <>
                {groupedContests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((group) => renderContestGroupCard(group))}
                {groupedContests.length === 0 && (
                  allSubmissions.length === 0 ? (
                    <div className="px-4 py-16 text-center">
                      <h3 className={cn("text-xl font-semibold", isDark ? "text-white" : "text-neutral-950")}>No submissions yet</h3>
                      <p className={cn("mt-2 text-sm", isDark ? "text-slate-400" : "text-neutral-500")}>
                        Join a campaign and submit your first post.
                      </p>
                      <div className={cn("mx-auto mb-4 mt-8 h-1.5 w-10 rounded-full", isDark ? "bg-slate-200" : "bg-neutral-800")} />
                      <Button
                        type="button"
                        disabled={opportunitiesLoading}
                        onClick={() => {
                          setOpportunitiesLoading(true);
                          setTimeout(() => {
                            window.location.href = "/dashboard/opportunities";
                          }, 100);
                        }}
                        className="h-11 rounded-full goc-btn-primary px-6 text-sm font-semibold"
                      >
                        {opportunitiesLoading ? <ButtonLoadingSpinner /> : null}
                        Find campaigns
                      </Button>
                    </div>
                  ) : (
                    <div className={cn("rounded-xl border-2 border-dashed py-12 text-center", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
                      <p className={isDark ? "text-slate-400" : "text-slate-500"}>No submissions found matching the criteria.</p>
                    </div>
                  )
                )}
              </>
            ) : (
              <>
                {filteredSubmissions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((sub) => renderSubmissionCard(sub))}
                {filteredSubmissions.length === 0 && (
                  allSubmissions.length === 0 ? (
                    <div className="px-4 py-16 text-center">
                      <h3 className={cn("text-2xl font-semibold", isDark ? "text-white" : "text-neutral-950")}>No submissions yet</h3>
                      <p className={cn("mt-2 text-md", isDark ? "text-slate-400" : "text-neutral-600")}>
                        Join a campaign and submit your first post.
                      </p>
                      {/* <div className={cn("mx-auto mb-4 mt-8 h-1.5 w-10 rounded-full", isDark ? "bg-slate-200" : "bg-neutral-800")} /> */}
                      <Button
                        type="button"
                        disabled={opportunitiesLoading}
                        onClick={() => {
                          setOpportunitiesLoading(true);
                          setTimeout(() => {
                            window.location.href = "/dashboard/opportunities";
                          }, 100);
                        }}
                        className="h-11 mt-4 rounded-full goc-btn-primary px-6 text-sm font-semibold"
                      >
                        {opportunitiesLoading ? <ButtonLoadingSpinner /> : null}
                        Find campaigns
                      </Button>
                    </div>
                  ) : (
                    <div className={cn("rounded-xl border-2 border-dashed py-12 text-center", isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50")}>
                      <p className={isDark ? "text-slate-400" : "text-slate-500"}>No submissions found matching the criteria.</p>
                    </div>
                  )
                )}
              </>
            )}
          </div>

          {isLoadingMore && (
            <div className={cn("text-center py-3 text-sm animate-pulse", isDark ? "text-slate-400" : "text-slate-500")}>
              Loading remaining submissions…
            </div>
          )}

          {/* Pagination Bar - Moved down as requested */}
          {(viewMode === "contest" ? groupedContests.length : filteredSubmissions.length) > 0 && (
            <div className={cn(
              "flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-2 transition-all duration-300 mt-4",
              isDark ? "text-slate-400" : "text-slate-500"
            )}>
              {/* Left Side: Stats and Show per page */}
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
                <div className="text-[14px] font-medium whitespace-nowrap">
                  Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, viewMode === "contest" ? groupedContests.length : filteredSubmissions.length)} of {viewMode === "contest" ? groupedContests.length : filteredSubmissions.length} submissions
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-medium">Show:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={(v) => {
                    setItemsPerPage(parseInt(v));
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className={cn(
                      "h-10 w-[80px] rounded-lg border shadow-none text-sm font-bold",
                      isDark ? "bg-[#1a1a1a] border-white/15" : "bg-white border-slate-200"
                    )}>
                      <SelectValue placeholder="25" />
                    </SelectTrigger>
                    <SelectContent className={cn(
                      "min-w-0 w-[80px]",
                      isDark ? "bg-[#161616] border-white/10" : "bg-white border-slate-200"
                    )}>
                      <SelectItem value="25" isDark={isDark}>25</SelectItem>
                      <SelectItem value="50" isDark={isDark}>50</SelectItem>
                      <SelectItem value="100" isDark={isDark}>100</SelectItem>
                      <SelectItem value="200" isDark={isDark}>200</SelectItem>
                      <SelectItem value="500" isDark={isDark}>500</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[14px] font-medium">per page</span>
                </div>
              </div>

              {/* Right Side: Navigation */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    "h-9 w-9 rounded-md border shadow-none transition-colors",
                    isDark ? "border-white/10 bg-transparent text-white/75 hover:bg-white/10 hover:text-white" : "border-[#ececef] bg-white text-[#3a3a40] hover:bg-[#e6e6e8] hover:text-[#1a1a1a]"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1.5">
                  {[...Array(Math.ceil((viewMode === "contest" ? groupedContests.length : filteredSubmissions.length) / itemsPerPage))].map((_, i) => {
                    const pageNum = i + 1;
                    const totalPages = Math.ceil((viewMode === "contest" ? groupedContests.length : filteredSubmissions.length) / itemsPerPage);

                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      const isActive = currentPage === pageNum;
                      return (
                        <Button
                          key={pageNum}
                          variant="outline"
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "h-9 w-9 rounded-md border text-[13px] font-bold shadow-none transition-all",
                            isActive
                              ? isDark
                                ? "border-white bg-white text-[#1a1a1a] hover:bg-white hover:text-[#1a1a1a]"
                                : "border-[#1a1a1a] bg-[#1a1a1a] text-white hover:bg-black hover:text-white"
                              : isDark
                                ? "border-white/10 bg-transparent text-white/75 hover:bg-white/10 hover:text-white"
                                : "border-[#ececef] bg-white text-[#3a3a40] hover:bg-[#e6e6e8] hover:text-[#1a1a1a]"
                          )}
                        >
                          {pageNum}
                        </Button>
                      );
                    } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <span key={pageNum} className="px-1 text-slate-400 font-bold">...</span>;
                    }
                    return null;
                  })}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil((viewMode === "contest" ? groupedContests.length : filteredSubmissions.length) / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil((viewMode === "contest" ? groupedContests.length : filteredSubmissions.length) / itemsPerPage)}
                  className={cn(
                    "h-9 w-9 rounded-md border shadow-none transition-colors",
                    isDark ? "border-white/10 bg-transparent text-white/75 hover:bg-white/10 hover:text-white" : "border-[#ececef] bg-white text-[#3a3a40] hover:bg-[#e6e6e8] hover:text-[#1a1a1a]"
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Contest Submissions Modal */}
      <Dialog open={!!selectedContestGroup} onOpenChange={(open) => !open && setSelectedContestGroup(null)} isdark={isDark}>
        <DialogContent className={cn("w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin rounded-[20px]", isDark ? "bg-[#161616] border-white/10" : "bg-white border-slate-200")}>
          <DialogHeader>
            <DialogTitle
              className={cn("text-xl font-black break-words leading-tight", isDark ? "text-white" : "text-slate-900")}
            >
              {selectedContestGroup?.isSingleSubmission ? "Submission Details" : (selectedContestGroup?.contest?.title || "Contest Submissions")}
            </DialogTitle>
            <DialogDescription className={cn("text-[13px]", isDark ? "text-slate-400" : "text-slate-500")}>
              {selectedContestGroup?.isSingleSubmission
                ? "Full details for this specific submission."
                : `Showing all ${selectedContestGroup?.submissions?.length} submissions for this contest.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-4 w-full min-w-0">
            {selectedContestGroup?.submissions?.map((submission: SubmissionWithContest) => {
              const contest = submission.contests;
              const views = submission.views ?? 0;
              const contestId = contest?.id;
              const isEnded = contest?.end_date ? new Date(contest.end_date) < new Date() : false;
              const isLive = !isEnded;
              const postContestStatus = contest?.post_contest_status;
              const isPayoutsProcessed = postContestStatus === "payouts_processed";

              const displayStatus = getDisplayStatus(submission);

              const statusStyles = getStatusBadgeStyles(
                isLive
                  ? "active" as any
                  : ((submission.status as string) === "paid" && !isPayoutsProcessed)
                    ? "verified"
                    : submission.status,
                contest?.end_date,
                postContestStatus
              );
              const rejectionDetails = submission.status === "rejected" ? getFullRejectionDetails(submission.metadata) : null;
              const systemNote = rejectionDetails?.reason ? REJECTION_REASON_DESCRIPTIONS[rejectionDetails.reason] : null;
              const displayNote = rejectionDetails?.additionalNotes || systemNote;

              // Thumbnail
              const meta = submission.metadata as any;
              const bestThumbnail = submission.video_thumbnail_url ||
                (submission as any).thumbnail_url ||
                (submission as any).thumbnail ||
                meta?.video_thumbnail_url ||
                meta?.thumbnail_url ||
                meta?.thumbnail ||
                meta?.display_url ||
                meta?.thumbnail_src ||
                meta?.image_url ||
                meta?.cover_image_url ||
                meta?.cover ||
                meta?.video?.cover ||
                meta?.shortcode_media?.display_url ||
                meta?.image_versions2?.candidates?.[0]?.url ||
                meta?.candidates?.[0]?.url ||
                meta?.video_details?.thumbnail_url;
              // Final Status Flags
              const isVerificationComplete = contest?.post_contest_status === "verification_complete";
              const isRejectedModal = submission.status === "rejected";
              const isVerifiedOrPaidModal = submission.status === "verified" || (submission.status as string) === "paid" || ((submission as any).bonus_paid === true);

              const isPaidModal = isSubmissionPaid(submission);
              const subStatusLowerModal = (submission.status as string || "").toLowerCase();
              const isPendingLikeModal =
                !isPaidModal &&
                !isRejectedModal &&
                contest?.post_contest_status !== "verification_complete" &&
                contest?.post_contest_status !== "payouts_processed" &&
                (subStatusLowerModal === "pending" ||
                  subStatusLowerModal === "pending_review" ||
                  subStatusLowerModal === "submitted" ||
                  subStatusLowerModal === "in_review");

              const totalEarningsCents = getSubmissionDisplayEarningsAmount(submission);
              const earningsInDollars = centsToDollars(totalEarningsCents);
              const campaignTypeModal = submissionCampaignType(submission, contest);
              const milestoneMatchModal =
                campaignTypeModal === "milestone" ||
                campaignTypeModal === "dual_rewards"
                  ? getMilestoneMatchForSubmission(submission, contest)
                  : null;

              const bonusAmountCentsModal = getSubmissionBonusAmount(submission);
              const bonusAmountDollarsModal = centsToDollars(bonusAmountCentsModal).toFixed(2);
              const contestDetailsModal = contest?.contest_based_details as any;
              const bonusDetailsModal = contest?.bonus_details as any;
              const platformCpmConfigModal = resolveCpmContestConfigForPlatform(
                contestDetailsModal,
                submission.platform,
                contest?.platform,
              );
              const flatFeeBonusModal =
                platformCpmConfigModal?.flat_fee_bonus ||
                contestDetailsModal?.cpm_contest?.flat_fee_bonus ||
                contestDetailsModal?.leaderboard_contest?.flat_fee_bonus ||
                bonusDetailsModal?.flat_fee_bonus ||
                0;
              const isMilestoneContestModal = campaignTypeModal === "milestone";
              const showEstimatedBonusModal = !isMilestoneContestModal && !isPaidModal && (submission.status === "verified" || flatFeeBonusModal > 0);
              let bonusLabelModal = "Estimated Bonus";
              if (isRejectedModal) bonusLabelModal = "Bonus Won";
              else if (isPaidModal) bonusLabelModal = "Bonus Earned";
              else if (isPayoutsProcessed) bonusLabelModal = "Bonus Earned";
              else if (isVerificationComplete) bonusLabelModal = "Estimated Bonus";
              else bonusLabelModal = "Estimated Bonus";
              const showBonusRowModal = !isMilestoneContestModal && bonusAmountCentsModal > 0 && (bonusLabelModal !== "Estimated Bonus" || showEstimatedBonusModal);
              const bonusColorModal = (bonusLabelModal === "Bonus Earned") ? "text-green-500" : isEnded ? "text-emerald-500" : isDark ? "text-slate-300" : "text-slate-600";
              const explicitQualityScoreModal = getExplicitSubmissionQualityScore(submission);

              let earningsDisplay: { label: string; amount: string; color: string; isRejected?: boolean } | null = null;
              if (isRejectedModal) {
                earningsDisplay = { label: "Earnings", amount: "Not Eligible", color: "text-red-500", isRejected: true };
              } else if (isPaidModal) {
                earningsDisplay = {
                  label: "Amount Earned",
                  amount: centsToDollars(submission.earnings ?? 0).toFixed(2),
                  color: "text-green-700",
                };
              } else if (isPoolPayoutCampaignType(campaignTypeModal)) {
                const label = isPayoutsProcessed
                  ? "Amount Earned"
                  : "Estimated Earnings";
                earningsDisplay = {
                  label,
                  amount: earningsInDollars.toFixed(2),
                  // Base color; will be overridden below by status-based scheme
                  color: isPayoutsProcessed ? "text-green-700" : isDark ? "text-blue-300" : "text-blue-600",
                };
              } else {
                const data = calculateLeaderboardEarnings(submission, contest) as any;
                const isCheckRank = data.label === "Check your rank";
                let color = isDark ? "text-emerald-400" : "text-emerald-600";
                if (data.isRejected) color = "text-red-500";
                else if (data.label === "Amount Earned") color = "text-green-500";
                else if (data.label === "Winning Zone") color = "text-purple-500";
                else if (data.label === "View Leaderboard" || data.label === "Check your rank") color = "text-[#7F39EC]";
                else if (data.label === "Estimated Earnings") color = isDark ? "text-blue-400" : "text-blue-600";

                earningsDisplay = {
                  label: isCheckRank ? "Estimated Earnings" : data.label,
                  amount: data.isRejected ? "Not Eligible" : isCheckRank ? "Check Ranking" : earningsInDollars.toFixed(2),
                  color
                };
              }

              // Status-based color overrides for CPM / milestone / dual in modal
              if (
                earningsDisplay &&
                isPoolPayoutCampaignType(campaignTypeModal)
              ) {
                if (isPaidModal && isPayoutsProcessed) {
                  earningsDisplay.color = "text-green-700";
                } else if (subStatusLowerModal === "verified") {
                  earningsDisplay.color = isDark ? "text-blue-300" : "text-blue-600";
                } else if (isPendingLikeModal) {
                  earningsDisplay.color = isDark ? "text-yellow-300" : "text-yellow-500";
                }
              }

              const platformLowerModal = (submission.platform || "").toLowerCase();
              const isInstagram = platformLowerModal === "instagram";
              const isTiktok = platformLowerModal.includes("tiktok");
              const isBroken = !!brokenThumbs[submission.id];
              const hasThumb = !!bestThumbnail;

              return (
                <div
                  key={submission.id}
                  className={cn(
                    "rounded-[14px] border overflow-hidden transition-all duration-300 group/item hover:shadow-lg min-w-0 w-full",
                    isDark ? "bg-[#0e0e0e] border-white/10" : "bg-white border-neutral-200"
                  )}
                >
                  {/* ── SECTION 1: Thumbnail banner ── */}
                  <div className="relative w-full h-[160px] bg-slate-100 dark:bg-[#161616]">
                    {isInstagram && (!hasThumb || isBroken) ? (
                      <img src="/instagram-poster.svg" alt="Instagram content" className="absolute inset-0 w-full h-full object-cover" />
                    ) : isTiktok && (!hasThumb || isBroken) ? (
                      <div
                        className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-950 via-cyan-950 to-pink-950"
                        aria-label="TikTok content"
                      />
                    ) : hasThumb && !isBroken ? (
                      <img
                        src={bestThumbnail}
                        alt="Thumbnail"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={() => setBrokenThumbs((prev) => ({ ...prev, [submission.id]: true }))}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-white/5">
                        <Video className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                      </div>
                    )}
                    {/* Gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {/* Platform badge – top left */}
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/75 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-wider">
                      {submission.platform || "Video"}
                    </div>
                    {/* Status badges – top right */}
                    <div className="absolute top-3 right-3 flex items-center gap-2 flex-wrap justify-end max-w-[calc(100%-80px)]">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm",
                        statusStyles.bg, statusStyles.text, statusStyles.border
                      )}>
                        {displayStatus}
                      </span>
                      {(() => {
                        const contestStatusInfo = getContestStatusDisplay(contest);
                        return (
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm",
                            contestStatusInfo.styles.bg, contestStatusInfo.styles.text, contestStatusInfo.styles.border
                          )}>
                            {contestStatusInfo.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── SECTION 2: Title row ── */}
                  <div className={cn("px-4 pt-3 pb-3 border-b max-w-full overflow-hidden min-w-0 flex-shrink-0", isDark ? "border-white/10" : "border-slate-100")}>
                    <h4
                      className={cn(
                        "text-[15px] font-bold leading-snug transition-all duration-300 w-full truncate hover:whitespace-normal group-hover:whitespace-normal",
                        isDark ? "text-white" : "text-slate-900"
                      )}
                      title={submission.video_title || meta?.video_title || meta?.caption || "Untitled Submission"}
                    >
                      {submission.video_title ||
                        meta?.video_title ||
                        meta?.title ||
                        meta?.video_details?.title ||
                        meta?.edge_media_to_caption?.edges?.[0]?.node?.text ||
                        meta?.caption ||
                        meta?.description ||
                        meta?.desc ||
                        meta?.text ||
                        meta?.video?.description ||
                        meta?.video?.desc ||
                        "Untitled Submission"}
                    </h4>
                  </div>

                  {/* ── SECTION 3: Meta chips row ── */}
                  <div className={cn("px-4 py-3 flex items-center gap-2 border-b whitespace-nowrap overflow-hidden flex-wrap", isDark ? "border-white/10" : "border-slate-100")}>
                    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0", isDark ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-600")}>
                      <CalendarDays className="w-3 h-3 shrink-0" /> {submission.formatted_created_at?.split(',')[0]}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0", isDark ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-600")}>
                      <Eye className="w-3 h-3 shrink-0" /> {views.toLocaleString()}
                    </span>
                    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex-shrink-0 border", isDark ? "bg-white/10 text-white/80 border-white/10" : "bg-slate-100 text-slate-600 border-slate-200")}>
                      {campaignTypeBadgeLabel(campaignTypeModal)}
                    </span>
                    {campaignTypeModal === "leaderboard" && null}
                  </div>

                  {/* ── SECTION 4: Earnings grid ── */}
                  <div className={cn(
                    "px-4 py-3 grid gap-3 border-b",
                    isRejectedModal
                      ? "grid-cols-1"
                      : explicitQualityScoreModal !== null
                        ? showBonusRowModal
                          ? "grid-cols-1 sm:grid-cols-3"
                          : "grid-cols-1 sm:grid-cols-2"
                        : !showBonusRowModal
                          ? "grid-cols-1"
                          : "grid-cols-2",
                    isDark ? "border-white/10" : "border-slate-100"
                  )}>
                    <div className={cn("rounded-[10px] p-3", isDark ? "bg-white/5" : "bg-slate-50")}>
                      <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isDark ? "text-slate-500" : "text-slate-400")}>
                        {earningsDisplay?.label || "Estimated Earnings"}
                      </p>
                      <p className={cn("text-[16px] font-black flex items-center gap-1.5 whitespace-nowrap", earningsDisplay?.color || (isDark ? "text-emerald-400" : "text-emerald-600"))}>
                        {(earningsDisplay as any)?.label === "Winning Zone" && <Trophy className="h-4 w-4" />}
                        {earningsDisplay?.amount === "Check Ranking" ? (
                          <Link href={`/dashboard/opportunities/${contestId}?tab=leaderboard`} className="underline hover:opacity-80 transition-opacity text-[13px]">
                            Check your rank <ExternalLink className="inline h-3 w-3 ml-1" />
                          </Link>
                        ) : earningsDisplay?.amount === "Not Eligible" ? (
                          "Not Eligible"
                        ) : `$${earningsDisplay?.amount || "0.00"} USD`}
                      </p>
                      {campaignTypeModal === "milestone" &&
                        totalEarningsCents > 0 &&
                        milestoneMatchModal && (
                          <p className={cn("text-[11px] font-semibold mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                            {milestoneMatchModal.order > 0
                              ? `Milestone ${milestoneMatchModal.order}`
                              : "Milestone"}{" "}
                            • Required Views: {milestoneMatchModal.targetViews.toLocaleString()}
                          </p>
                        )}
                      {campaignTypeModal === "dual_rewards" && milestoneMatchModal && (
                          <p className={cn("text-[11px] font-semibold mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                            {milestoneMatchModal.order > 0
                              ? `Milestone ${milestoneMatchModal.order}`
                              : "Milestone"}{" "}
                            • Required Views:{" "}
                            {milestoneMatchModal.targetViews.toLocaleString()}
                          </p>
                        )}
                      {isPayoutsProcessed && (submission as any).paid_at && (
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                          Paid on: {format(new Date((submission as any).paid_at), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    {/* Detailed helper text replaced by tooltip on the label */}
                    {!isRejectedModal && showBonusRowModal && (
                      <div className={cn("rounded-[10px] p-3", isDark ? "bg-white/5" : "bg-slate-50")}>
                        <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isDark ? "text-slate-500" : "text-slate-400")}>
                          {bonusLabelModal}
                        </p>
                        <p className={cn("text-[16px] font-black", bonusColorModal)}>
                          {bonusAmountDollarsModal === "Not Eligible" ? "Not Eligible" : `$${bonusAmountDollarsModal} USD`}
                        </p>
                        {isPayoutsProcessed && (submission as any).bonus_paid_at && (
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                            Paid on: {format(new Date((submission as any).bonus_paid_at), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    )}
                    {explicitQualityScoreModal !== null && (
                      <SubmissionQualityScoreDisplay
                        qualityScore={explicitQualityScoreModal}
                        isDark={isDark}
                        variant="tile"
                      />
                    )}
                  </div>

                  {/* ── SECTION 5: Rejection block (only if rejected) ── */}
                  {
                    submission.status === "rejected" && rejectionDetails && (
                      <div className={cn("px-4 py-3 border-b", isDark ? "border-white/10" : "border-slate-100")}>
                        <div className="rounded-[10px] border-l-4 border-red-500 bg-red-500/5 px-3 py-2.5 flex flex-col gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Rejection Reason</p>
                            <div className="flex items-center gap-2 min-w-0">
                              <p className={cn(
                                "text-[13px] font-bold text-red-700 dark:text-red-300 transition-all duration-300 min-w-0 flex-1",
                                expandedReasons[submission.id] ? "whitespace-normal break-words" : "truncate"
                              )}>
                                {rejectionDetails.reason}
                              </p>
                              {(rejectionDetails.reason.length > 60 || expandedReasons[submission.id]) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleReason(submission.id);
                                  }}
                                  className="text-[11px] font-bold text-red-600 hover:text-red-700 shrink-0 transition-colors"
                                >
                                  {expandedReasons[submission.id] ? "(Show Less)" : "View More"}
                                </button>
                              )}
                            </div>
                          </div>
                          {displayNote && (
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Note</p>
                              <div className="flex items-center gap-2 min-w-0">
                                <p className={cn(
                                  "text-[13px] font-medium text-red-600/80 dark:text-red-400/80 italic transition-all duration-300 min-w-0 flex-1",
                                  expandedNotes[submission.id] ? "whitespace-normal break-words" : "truncate"
                                )}>
                                  {displayNote}
                                </p>
                                {(displayNote.length > 60 || expandedNotes[submission.id]) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleNote(submission.id);
                                    }}
                                    className="text-[11px] font-bold text-red-600 hover:text-red-700 shrink-0 transition-colors"
                                  >
                                    {expandedNotes[submission.id] ? "(Show Less)" : "View More"}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  <div className="px-4 py-3 w-full">
                    <SubmissionActionButtons
                      contentLink={submission.content_link || "#"}
                      contestId={contestId}
                      contestStatus={contest?.status}
                      isGroup={false}
                      isFullWidth={true}
                      disableAnimation={true}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end mt-4">
            <Button
              variant="ghost"
              className={cn(
                "rounded-full font-bold",
                isDark
                  ? "border border-white/20 bg-transparent text-white hover:bg-white/10"
                  : "text-slate-600 hover:bg-slate-100",
              )}
              onClick={() => setSelectedContestGroup(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
