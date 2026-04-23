
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SubmissionWithContest, CpmContestDetails } from "@/types/supabase";
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
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import { ExternalLink, Filter, Video, AlertCircle, Info, ArrowRight, Search, Layers, Clock, CheckCircle2, XCircle, History, DollarSign, Menu, MoreVertical, Eye, Trophy, TrendingUp, Coins, CalendarDays, Tag, ChevronLeft, ChevronRight, Check, ListOrdered, Gift, CheckCheck, Loader2 } from "lucide-react";
import Image from "next/image";
import React from "react";
import { centsToDollars, formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { getFullRejectionDetails } from "@/lib/submission-metadata";
import { cn } from "@/lib/utils";
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


interface SubmissionsClientProps {
  initialSubmissions: SubmissionWithContest[];
  fetchError?: string;
}

type ContestTypeFilter = "all" | "leaderboard" | "cpm" | "milestone";
type StatusFilter =
  | "all"
  | "pending"
  | "verified"
  | "rejected"
  | "paid";
type PlatformFilter = "all" | "youtube" | "instagram" | "tiktok" | "twitter" | "other";
type ViewMode = "all" | "contest";
type SortOrder = "normal" | "newest" | "oldest" | "views_high" | "views_low" | "earnings_high" | "earnings_low" | "submissions_high" | "submissions_low";
type DateFilter = "all" | "today" | "3days" | "1week" | "1month" | "1year" | "custom";

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
  disableAnimation = false
}: {
  contentLink: string;
  contestId: string | null | undefined;
  contestStatus?: string | null;
  isGroup?: boolean;
  isFullWidth?: boolean;
  onAction?: () => void;
  disableAnimation?: boolean;
}) => {
  const [activeButton, setActiveButton] = useState<"content" | "contest" | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const status = contestStatus || (contestId ? "active" : null);
  const isLive = status === "active" || status === "published" || status == null;
  const contestLink = contestId
    ? `/dashboard/opportunities/${contestId}?tab=leaderboard`
    : "#";
  const contestLabel = isLive ? "View Contest" : "View Leaderboard";
  const ContestIcon = isLive ? Info : Trophy;
  const ActionIcon = isGroup ? ListOrdered : Video;
  const actionLabel = isGroup ? "View Submissions" : "View Content";

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleHover = (type: "content" | "contest") => {
    if (disableAnimation) return;
    clearTimer();
    setActiveButton(type);
  };

  const handleLeave = () => {
    if (disableAnimation) return;
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setActiveButton(null);
    }, 3000);
  };

  // Keyboard and Click Outside handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveButton(null);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveButton(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
      clearTimer();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center gap-2",
        isFullWidth ? "w-full" : "w-auto justify-end md:justify-self-end self-center md:self-end"
      )}
    >
      <div className={cn(
        "flex flex-row gap-2 items-center shrink-0",
        isFullWidth ? "w-full" : "w-auto"
      )}>
        {/* Main Action Button (Content or Group) — square icon button */}
        <Button
          asChild={!onAction}
          onMouseEnter={() => handleHover("content")}
          onMouseLeave={handleLeave}
          onClick={onAction ? (e) => {
            e.preventDefault();
            onAction();
          } : undefined}
          className={cn(
            "relative flex items-center justify-center h-10 w-10 min-h-10 min-w-10 rounded-lg transition-all duration-300 ease-in-out p-0 overflow-hidden shadow-sm",
            "bg-[#4211a1] hover:bg-[#350d81] border-none text-white",
            isFullWidth ? (
              (!disableAnimation && activeButton === "content") ? "flex-[2] min-w-0" : (!disableAnimation && activeButton === "contest" ? "flex-[0.5] min-w-0" : "flex-1 min-w-0")
            ) : (
              (!disableAnimation && activeButton === "content") ? "sm:w-[160px] sm:min-w-[160px] z-10 shadow-lg rounded-lg" : "sm:w-10 sm:min-w-10"
            ),
            (!disableAnimation && !isFullWidth && activeButton === "contest") ? "sm:w-9 sm:min-w-9 opacity-60" : "opacity-100"
          )}
        >
          {onAction ? (
            <div className="w-full h-full flex items-center justify-center" title={actionLabel}>
              <ActionIcon className="w-5 h-5 text-white shrink-0" strokeWidth={2.5} />
            </div>
          ) : (
            <Link href={contentLink || "#"} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center" title={actionLabel}>
              <ActionIcon className="w-5 h-5 text-white shrink-0" strokeWidth={2.5} />
            </Link>
          )}
        </Button>

        {/* View Contest / Leaderboard Button — square icon button */}
        <Button
          asChild
          onMouseEnter={() => handleHover("contest")}
          onMouseLeave={handleLeave}
          className={cn(
            "relative flex items-center justify-center h-10 w-10 min-h-10 min-w-10 rounded-lg transition-all duration-300 ease-in-out p-0 overflow-hidden shadow-sm",
            "bg-[#4211a1] hover:bg-[#350d81] border-none text-white",
            isFullWidth ? (
              (!disableAnimation && activeButton === "contest") ? "flex-[2] min-w-0" : (!disableAnimation && activeButton === "content" ? "flex-[0.5] min-w-0" : "flex-1 min-w-0")
            ) : (
              (!disableAnimation && activeButton === "contest") ? "sm:w-[180px] sm:min-w-[180px] z-10 shadow-lg rounded-lg" : "sm:w-10 sm:min-w-10"
            ),
            (!disableAnimation && !isFullWidth && activeButton === "content") ? "sm:w-9 sm:min-w-9 opacity-60" : "opacity-100"
          )}
        >
          <Link href={contestLink} className="w-full h-full flex items-center justify-center" title={contestLabel}>
            <ContestIcon className="w-5 h-5 text-white shrink-0" strokeWidth={2.5} />
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default function SubmissionsClient({
  initialSubmissions,
  fetchError,
}: SubmissionsClientProps) {
  const [allSubmissions, setAllSubmissions] =
    useState<SubmissionWithContest[]>(initialSubmissions);
  const [filteredSubmissions, setFilteredSubmissions] =
    useState<SubmissionWithContest[]>(initialSubmissions);

  const [contestTypeFilter, setContestTypeFilter] =
    useState<string[]>(["leaderboard", "cpm", "milestone"]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<string[]>([
    "youtube", "instagram", "tiktok"
  ]);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
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

  const getMilestoneMatchForSubmission = (
    submission: SubmissionWithContest,
    contest: any,
  ) => {
    const contestDetails = contest?.contest_based_details as any;
    const milestoneContest = contestDetails?.milestone_contest;
    const milestones = Array.isArray(milestoneContest?.milestones)
      ? milestoneContest.milestones
      : [];
    if (milestones.length === 0) return null;

    const submissionViews = Number(submission.views ?? 0);
    const sortedMilestones = [...milestones].sort(
      (a: any, b: any) => Number(b?.target_views || 0) - Number(a?.target_views || 0),
    );

    const matched = sortedMilestones.find((milestone: any) => {
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

  const getSubmissionEarningsAmount = (submission: SubmissionWithContest) => {
    const contest = submission.contests;
    const subStatus = (submission.status as string || "").toLowerCase();
    const paid = isSubmissionPaid(submission);

    // Paid: always use DB values (all contests, all platforms)
    if (paid) {
      return submission.earnings ?? 0;
    }
    if (isPayoutsProcessed(contest)) return 0;

    if (contest?.contest_type === "cpm") {
      // For CPM, treat all non-rejected submissions as having estimated earnings
      // while the contest is still in review. Once payouts are processed, we
      // already short-circuit to 0 above.
      if (subStatus === "rejected") return 0;

      const cpmConfig =
        contest.contest_based_details &&
          typeof contest.contest_based_details === "object" &&
          "cpm_contest" in (contest.contest_based_details as any)
          ? ((contest.contest_based_details as any).cpm_contest as unknown as CpmContestDetails)
          : null;
      const views = submission.views ?? 0;
      let effectiveViews = views;
      if (cpmConfig?.min_views != null && views < cpmConfig.min_views) effectiveViews = 0;
      else if (cpmConfig?.max_views != null && views > cpmConfig.max_views) effectiveViews = cpmConfig.max_views;
      const rateUsd = cpmConfig?.cpm_rate_usd ?? 0;
      return Math.round((effectiveViews * rateUsd) / 10);
    }

    if (contest?.contest_type === "milestone") {
      if (subStatus === "rejected") return 0;
      return getMilestoneEstimatedEarningsCents(submission, contest);
    }

    const data = calculateLeaderboardEarnings(submission, contest);
    return data.amount;
  };

  // For UI display only (cards/modals). This can show CPM estimates for
  // pending/verified submissions, but DOES NOT affect budget/confirmed stats.
  const getSubmissionDisplayEarningsAmount = (submission: SubmissionWithContest) => {
    const contest = submission.contests;
    const subStatus = (submission.status as string || "").toLowerCase();
    const paid = isSubmissionPaid(submission);

    // Paid: always use DB values (all contests, all platforms)
    if (paid) {
      return submission.earnings ?? 0;
    }

    const postContestStatus = contest?.post_contest_status;

    // If contest payouts are fully processed, and this submission isn't paid,
    // there's nothing more to earn.
    if (isPayoutsProcessed(contest)) return 0;

    if (contest?.contest_type === "cpm") {
      // For display, show estimates for any non-rejected CPM submission
      // while the contest is still in review. Once verification is complete,
      // only verified/paid submissions should show earnings; pending ones
      // should be treated as 0.
      if (subStatus === "rejected") return 0;

      const isVerificationComplete = postContestStatus === "verification_complete";
      if (isVerificationComplete) {
        const isConfirmed =
          subStatus === "verified" ||
          subStatus === "paid" ||
          (submission as any).paid === true;
        if (!isConfirmed) return 0;
      }

      const cpmConfig =
        contest.contest_based_details &&
          typeof contest.contest_based_details === "object" &&
          "cpm_contest" in (contest.contest_based_details as any)
          ? ((contest.contest_based_details as any).cpm_contest as unknown as CpmContestDetails)
          : null;
      const views = submission.views ?? 0;
      let effectiveViews = views;
      if (cpmConfig?.min_views != null && views < cpmConfig.min_views) effectiveViews = 0;
      else if (cpmConfig?.max_views != null && views > cpmConfig.max_views) effectiveViews = cpmConfig.max_views;
      const rateUsd = cpmConfig?.cpm_rate_usd ?? 0;
      return Math.round((effectiveViews * rateUsd) / 10);
    }

    if (contest?.contest_type === "milestone") {
      if (subStatus === "rejected") return 0;

      // After verification completes, only verified/paid submissions should keep estimated value.
      const isVerificationComplete = postContestStatus === "verification_complete";
      if (isVerificationComplete) {
        const isConfirmed =
          subStatus === "verified" ||
          subStatus === "paid" ||
          (submission as any).paid === true;
        if (!isConfirmed) return 0;
      }

      return getMilestoneEstimatedEarningsCents(submission, contest);
    }

    // Non-CPM: share the same logic as stats helper.
    const data = calculateLeaderboardEarnings(submission, contest);
    return data.amount;
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
    const flatFeeBonus =
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
  }, [contestTypeFilter, statusFilter, platformFilter, activeSearch, dateFilter, dateRange, itemsPerPage, contestStatusFilter]);

  const isDark = mode === "dark";
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
  }, [initialSubmissions]);



  useEffect(() => {
    let submissions = [...allSubmissions];

    // Filter by contest type
    if (contestTypeFilter.length < 3) {
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
      if (sortOrder === "submissions_high" || sortOrder === "submissions_low") {
        // Fallback to newest for individual submissions view
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

    setFilteredSubmissions(submissions);
  }, [allSubmissions, contestTypeFilter, statusFilter, platformFilter, activeSearch, sortOrder, dateFilter, dateRange, contestStatusFilter]);

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
    const contests = new Set(filteredSubmissions.map(s => s.contest_id).filter(Boolean));
    const totalViews = filteredSubmissions.reduce((sum, s) => sum + (s.views || 0), 0);

    // Cash Earned: only submissions with status "paid"; use submission.earnings (cents).
    // post_contest_status may be verification_complete or payouts_processed — both allowed.
    const totalEarnings = filteredSubmissions.reduce((sum, s) => {
      const subStatus = (s.status as string || "").toLowerCase();
      if (subStatus !== "paid") return sum;
      return sum + (Number((s as any).earnings) || 0);
    }, 0);

    // Bonus Earned: only submissions with status "paid"; use submission.bonus_amount (cents).
    // post_contest_status may be verification_complete or payouts_processed — both allowed.
    const totalBonus = filteredSubmissions.reduce((sum, s) => {
      const subStatus = (s.status as string || "").toLowerCase();
      if (subStatus !== "paid") return sum;
      return sum + (Number((s as any).bonus_amount) || 0);
    }, 0);

    // Estimated earnings: for submissions NOT paid and NOT in payouts_processed contests.
    // EXCLUDES rejected and paid — only pending/verified (not yet paid) count as "estimated".
    const estimatedEarnings = filteredSubmissions.reduce((sum, s) => {
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
    const estimatedBonus = filteredSubmissions.reduce((sum, s) => {
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
  }, [filteredSubmissions]);



  const renderSubmissionCard = (submission: SubmissionWithContest) => {
    const contest = submission.contests;
    const cpmConfig =
      contest?.contest_type === "cpm" &&
        contest.contest_based_details &&
        typeof contest.contest_based_details === "object" &&
        contest.contest_based_details !== null &&
        "cpm_contest" in contest.contest_based_details
        ? (contest.contest_based_details.cpm_contest as unknown as CpmContestDetails)
        : null;

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
    const milestoneMatch =
      contest?.contest_type === "milestone"
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
    } else if (contest?.contest_type === "cpm" || contest?.contest_type === "milestone") {
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
      (contest?.contest_type === "cpm" || contest?.contest_type === "milestone")
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
    const flatFeeBonusForCard =
      contestDetailsForBonus?.cpm_contest?.flat_fee_bonus ||
      contestDetailsForBonus?.leaderboard_contest?.flat_fee_bonus ||
      bonusDetailsForCard?.flat_fee_bonus ||
      0;

    const bonusAmountCents = getSubmissionBonusAmount(submission);
    const bonusAmountDollars = centsToDollars(bonusAmountCents).toFixed(2);
    const isVerifiedForBonus = submission.status === "verified";
    const showEstimatedBonus = !isPaidCard && (isVerifiedForBonus || flatFeeBonusForCard > 0);

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
    const showBonusRow = bonusAmountCents > 0 && (bonusLabel !== "Estimated Bonus" || showEstimatedBonus);

    // Massively expanded thumbnail detection for all social platforms (IG, TikTok, YT, Twitter)
    const meta = submission.metadata as any;

    // Log keys for the first submission to help diagnose field mismatches if any
    if (submission === filteredSubmissions[0]) {
      console.log("DEBUG: First submission fields:", Object.keys(submission));
    }

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
          "relative grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[280px_1fr_220px] gap-6 p-4 md:p-6 rounded-[16px] border shadow-sm transition-none overflow-hidden",
          isDark ? "bg-[#0f172a] border-slate-800" : "bg-white border-slate-200"
        )}
      >
        {/* Contest Status Badge - Absolute on desktop, relative flow on mobile column */}
        <div className="md:absolute md:top-4 md:right-4 z-10 flex flex-row gap-2 mb-2 md:mb-0">
          {(() => {
            const contestStatusInfo = getContestStatusDisplay(contest);
            return (
              <span className={cn(
                "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-sm",
                contestStatusInfo.styles.bg, contestStatusInfo.styles.text, contestStatusInfo.styles.border
              )}>
                {contestStatusInfo.label}
              </span>
            );
          })()}
        </div>

        {/* Column 1: Thumbnail */}
        <div className="relative w-full md:w-[280px] aspect-[16/9] md:aspect-[4/3] rounded-[12px] overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 bg-slate-100 dark:bg-slate-900 group/thumb">

          {(() => {
            const isInstagram = (submission.platform || "").toLowerCase() === "instagram";
            const isBroken = !!brokenThumbs[submission.id];
            const hasThumb = !!bestThumbnail;
            const shouldShowIgPoster = isInstagram && (!hasThumb || isBroken);

            if (shouldShowIgPoster) {
              return (
                <img
                  src="/instagram-poster.svg"
                  alt="Instagram content"
                  className="absolute inset-0 w-full h-full object-cover"
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

        {/* Column 2: Info */}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3
              className={cn(
                "text-[20px] font-bold transition-all duration-300 cursor-default self-start",
                isDark ? "text-white" : "text-slate-900",
                "whitespace-normal overflow-visible lg:truncate lg:hover:whitespace-normal lg:hover:overflow-visible"
              )}
            >
              {contest?.title || "Untitled Contest"}
            </h3>
            {(() => {
              const styles = getStatusBadgeStyles(submission.status, contest?.end_date, contest?.post_contest_status);

              return (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border",
                    styles.bg, styles.text, styles.border
                  )}>
                    {displayStatus}
                  </span>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-2 mt-[-6px]">
            <p
              className={cn(
                "text-[13px] font-medium transition-all duration-300",
                isDark ? "text-slate-400" : "text-slate-500",
                "truncate max-w-[300px] lg:max-w-[500px]"
              )}
            >
              {videoTitle}
            </p>
            {videoTitle.length > 60 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedContestGroup({
                    contest: submission.contests,
                    submissions: [submission],
                    isSingleSubmission: true
                  });
                }}
                className="text-[11px] font-bold text-indigo-500 hover:text-indigo-600 shrink-0 transition-colors"
              >
                View More
              </button>
            )}
          </div>

          <div className={cn("flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap overflow-hidden flex-wrap", isDark ? "text-slate-300" : "text-slate-500")}>
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
              {contest?.contest_type === "leaderboard" ? "Leaderboard" : contest?.contest_type === "cpm" ? "CPM" : contest?.contest_type || "—"}
            </Badge>
            {contest?.contest_type === "leaderboard" && null}
          </div>

          <div className="flex flex-col gap-1 mt-1">
            {earningsDisplay && (
              <div className="flex flex-col items-start gap-1">
                <p className={cn("text-[15px] font-semibold flex items-center gap-1.5", earningsDisplay.color)}>
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
                {contest?.contest_type === "milestone" &&
                  totalEarningsCents > 0 &&
                  milestoneMatch && (
                    <p className={cn("text-[12px] font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
                      {milestoneMatch.order > 0
                        ? `Milestone ${milestoneMatch.order}`
                        : "Milestone"}{" "}
                      • Required Views: {milestoneMatch.targetViews.toLocaleString()}
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
        </div>

        {/* Column 3: Actions - Professional Enterprise Interaction */}
        <SubmissionActionButtons
          contentLink={submission.content_link || "#"}
          contestId={contestId}
          contestStatus={contest?.status}
        />
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
    const flatFeeBonusForContest =
      contestDetailsForBonus?.cpm_contest?.flat_fee_bonus ||
      contestDetailsForBonus?.leaderboard_contest?.flat_fee_bonus ||
      bonusDetailsForContest?.flat_fee_bonus ||
      0;
    const hasFlatFeeBonus = flatFeeBonusForContest > 0;
    const cpmRateUsd =
      contest?.contest_based_details?.cpm_contest?.cpm_rate_usd ?? null;
    const maxSubmissions = contest?.max_submissions_per_creator ?? 1;

    return (
      <Card
        key={group.id}
        className={cn(
          "overflow-hidden rounded-[16px] shadow-sm transition-all duration-300 border flex flex-col md:flex-row group w-full relative",
          isDark ? "bg-[#0f172a] border-slate-800" : "bg-white border-slate-200"
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
        <div className="w-full md:w-[280px] aspect-[16/9] md:aspect-square flex-shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 relative">
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
                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50">
                  {contest.advertiser_profiles.company_name}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border-slate-200 dark:border-slate-800">
                {contest?.platform || "Platform"}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border-slate-200 dark:border-slate-800">
                {contest?.contest_type || "Type"}
              </Badge>
            </div>

            <h3
              className={cn(
                "text-[22px] md:text-[26px] font-black leading-tight mb-2 tracking-tight transition-all duration-300",
                "flex flex-wrap line-clamp-2 group-hover:line-clamp-none break-words",
                isDark ? "text-white group-hover:text-indigo-400" : "text-slate-900 group-hover:text-[#4211a1]"
              )}
            >
              {contest?.title || (contest?.platform || group.submissions[0]?.platform || "Contest").replace(/_/g, " ").toUpperCase()}
            </h3>

            <div className="flex items-center gap-4 flex-wrap">
              <p className={cn("text-[13px] font-semibold flex items-center gap-1.5", isDark ? "text-slate-400" : "text-slate-500")}>
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                {contest?.end_date
                  ? `${isEnded ? 'Ended' : 'Deadline'}: ${format(new Date(contest.end_date), "MMM d, yyyy")}`
                  : 'Deadline: No deadline'}
              </p>
              {contest?.advertiser_profiles?.company_name && (
                <p className={cn("text-[13px] font-medium flex items-center gap-1.5", isDark ? "text-slate-500" : "text-slate-400")}>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  by <span className="font-bold text-indigo-500">{contest.advertiser_profiles.company_name}</span>
                </p>
              )}
            </div>

            {/* Contest meta: CPM rate, bonus availability, submissions allowed */}
            <div className="mt-2 flex flex-wrap gap-2">
              {contest?.contest_type === "cpm" &&
                cpmRateUsd != null &&
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
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
                    if (contest?.contest_type === "leaderboard") return "text-[#7F39EC]";
                    return "text-[#7F39EC]";
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
                <p className={cn("text-[16px] font-black text-purple-500")}>
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
              className="rounded-full h-8 px-4 text-[12px] font-bold border-slate-200 dark:border-slate-700 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div className="max-w-[360px]">
          <h1
            className={cn(
              "text-[24px] font-semibold leading-tight",
              isDark ? "text-white" : "text-slate-900"
            )}
          >
            My Submissions & Earnings
          </h1>
          <p
            className={cn(
              "text-[14px] mt-1 leading-snug",
              isDark ? "text-slate-400" : "text-slate-500"
            )}
          >
            Showing your submissions and analytics across different statuses
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:max-w-[520px] mt-3 md:mt-0 md:justify-end">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={3} />
            <Input
              placeholder="Search by URL or Title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "pl-10 h-10 rounded-lg transition-all shadow-none w-full",
                isDark
                  ? "border-slate-700 bg-[#1e293b] text-slate-100 placeholder:text-slate-500 focus:border-[#6366f1]"
                  : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#4211a1]"
              )}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-none">
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              className={cn(
                "h-10 flex-1 sm:flex-none px-6 rounded-lg bg-[#4211a1] hover:bg-[#350d81] text-white font-bold text-sm uppercase tracking-wide shadow-none shrink-0 transition-all duration-200",
                isSearching && "opacity-90 cursor-wait"
              )}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  <span>Searching...</span>
                </>
              ) : (
                "Search"
              )}
            </Button>

            <Button asChild className="h-10 flex-1 sm:flex-none px-[18px] rounded-[10px] bg-[#4211a1] hover:bg-[#350d81] text-white font-bold text-sm uppercase tracking-wide shadow-none shrink-0 transition-all">
              <button
                onClick={() => {
                  setOpportunitiesLoading(true);
                  setTimeout(() => {
                    window.location.href = '/dashboard/opportunities';
                  }, 100);
                }}
                disabled={opportunitiesLoading}
                className="w-full h-full flex items-center justify-center"
              >
                {opportunitiesLoading ? (
                  <ButtonLoadingSpinner />
                ) : null}
                <span className="ml-2">Find Opportunities</span>
              </button>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Summary — wider cards, consistent height and alignment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3 md:gap-4 items-stretch">
        {[
          { label: "Submitted to", value: stats.contests, sub: "Contests", icon: Trophy, color: "text-blue-500" },
          { label: "Total Views", value: stats.views.toLocaleString(), sub: "", icon: TrendingUp, color: "text-indigo-500" },
          { label: "Cash Earned", value: `$${centsToDollars(stats.earnings).toFixed(2)}`, sub: "USD", icon: DollarSign, color: "text-green-500" },
          { label: "Bonus Earned", value: `$${centsToDollars(stats.bonus).toFixed(2)}`, sub: "USD", icon: Coins, color: "text-purple-500" },
          { label: "Estimated Cash", value: `$${centsToDollars(stats.estimatedEarnings).toFixed(2)}`, sub: "USD", icon: TrendingUp, color: "text-blue-400" },
          { label: "Estimated Bonus", value: `$${centsToDollars(stats.estimatedBonus).toFixed(2)}`, sub: "USD", icon: Coins, color: "text-orange-400" },
        ].map((item, idx) => (
          <Card
            key={idx}
            className={cn(
              "border shadow-none rounded-[16px] w-full min-h-[96px] flex",
              isDark ? "bg-[#1e293b] border-slate-800" : "bg-white border-slate-100"
            )}
          >
            <CardContent className="p-4 flex flex-1 items-center gap-4 min-w-0">
              <div className={cn("p-2.5 rounded-xl shadow-sm shrink-0", isDark ? "bg-slate-800" : "bg-slate-50")}>
                <item.icon className={cn("w-5 h-5", item.color)} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[10px] font-bold uppercase tracking-wider truncate", isDark ? "text-slate-500" : "text-slate-400")}>{item.label}</p>
                <div className="flex items-baseline gap-1.5 leading-tight mt-0.5 flex-wrap">
                  <h3 className={cn("text-[18px] font-black break-words", isDark ? "text-white" : "text-slate-900")}>{item.value}</h3>
                  {item.sub ? <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">{item.sub}</span> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Row (Restored to Top) */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-6">
        {/* Contest Status Multi-select Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full lg:w-[220px] h-10 rounded-lg justify-start text-left font-normal border-slate-200 dark:border-slate-700 shadow-none",
                isDark ? "bg-[#1e293b] text-slate-100 hover:bg-slate-800" : "bg-white text-slate-900 hover:bg-slate-50"
              )}
            >
              <Filter className="mr-2 h-4 w-4 opacity-70" />
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

                  if (contestStatusFilter.length === 5) return "All Contest Status";
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
              <ChevronRight className="ml-auto h-4 w-4 opacity-50 rotate-90" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-[240px] p-2 rounded-xl border-slate-200 dark:border-slate-800", isDark ? "bg-[#0f172a]" : "bg-white")} align="start">
            <div className="flex flex-col gap-1">
              {/* LIVE option */}
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
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
                    : isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
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
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
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
                      : isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
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
                    isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
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
                      : isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
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
              className={cn(
                "w-full lg:w-[180px] h-10 rounded-lg justify-start text-left font-normal border-slate-200 dark:border-slate-700 shadow-none",
                isDark ? "bg-[#1e293b] text-slate-100 hover:bg-slate-800" : "bg-white text-slate-900 hover:bg-slate-50"
              )}
            >
              <Trophy className="mr-2 h-4 w-4 opacity-70" />
              <span className="truncate">
                {contestTypeFilter.length === 3 ? "All Types" :
                  contestTypeFilter.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")}
              </span>
              <ChevronRight className="ml-auto h-4 w-4 opacity-50 rotate-90" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-[200px] p-2 rounded-xl border-slate-200 dark:border-slate-800", isDark ? "bg-[#0f172a]" : "bg-white")} align="start">
            <div className="flex flex-col gap-1">
              {[
                { id: "leaderboard", label: "Leaderboard" },
                { id: "cpm", label: "CPM" },
                { id: "milestone", label: "Milestone" }
              ].map(type => (
                <div
                  key={type.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                    isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
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
                      : isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
                  )}>
                    {contestTypeFilter.includes(type.id) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </div>
                  <span className={cn("text-[13px] font-medium", isDark ? "text-slate-300" : "text-slate-600")}>{type.label}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Platform Multi-select Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full lg:w-[180px] h-10 rounded-lg justify-start text-left font-normal border-slate-200 dark:border-slate-700 shadow-none",
                isDark ? "bg-[#1e293b] text-slate-100 hover:bg-slate-800" : "bg-white text-slate-900 hover:bg-slate-50"
              )}
            >
              <Video className="mr-2 h-4 w-4 opacity-70" />
              <span className="truncate">
                {platformFilter.length === 3 ? "All Platforms" :
                  platformFilter.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}
              </span>
              <ChevronRight className="ml-auto h-4 w-4 opacity-50 rotate-90" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-[200px] p-2 rounded-xl border-slate-200 dark:border-slate-800", isDark ? "bg-[#0f172a]" : "bg-white")} align="start">
            <div className="flex flex-col gap-1">
              {[
                { id: "youtube", label: "YouTube" },
                { id: "instagram", label: "Instagram" },
                { id: "tiktok", label: "TikTok" }
              ].map(platform => (
                <div
                  key={platform.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                    isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                  )}
                  onClick={() => {
                    setPlatformFilter(prev =>
                      prev.includes(platform.id) ? prev.filter(p => p !== platform.id) : [...prev, platform.id]
                    );
                  }}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                    platformFilter.includes(platform.id)
                      ? "bg-[#4211a1] border-[#4211a1]"
                      : isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
                  )}>
                    {platformFilter.includes(platform.id) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </div>
                  <span className={cn("text-[13px] font-medium", isDark ? "text-slate-300" : "text-slate-600")}>{platform.label}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <SelectTrigger className={cn(
            "w-full lg:w-[180px] h-10 rounded-lg transition-none shadow-none",
            isDark ? "border-slate-700 bg-[#1e293b] text-slate-100" : "border-slate-200 bg-white text-slate-900"
          )}><SelectValue placeholder="View Mode" /></SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem isDark={isDark} value="all">Submission View</SelectItem>
            <SelectItem isDark={isDark} value="contest">Contest View</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
          <SelectTrigger className={cn(
            "w-full lg:w-[180px] h-10 rounded-lg transition-none shadow-none",
            isDark ? "border-slate-700 bg-[#1e293b] text-slate-100" : "border-slate-200 bg-white text-slate-900"
          )}><SelectValue placeholder="Sort By" /></SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem isDark={isDark} value="newest">Newest to Oldest</SelectItem>
            <SelectItem isDark={isDark} value="oldest">Oldest to Newest</SelectItem>
            <SelectItem isDark={isDark} value="views_high">Highest to Lowest Views</SelectItem>
            <SelectItem isDark={isDark} value="views_low">Lowest to Highest Views</SelectItem>
            <SelectItem isDark={isDark} value="earnings_high">Most Earnings</SelectItem>
            <SelectItem isDark={isDark} value="earnings_low">Lowest Earnings</SelectItem>
            {viewMode === "contest" && (
              <>
                <SelectItem isDark={isDark} value="submissions_high">Most Submissions</SelectItem>
                <SelectItem isDark={isDark} value="submissions_low">Least Submissions</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Select
            value={dateFilter}
            onValueChange={(value) => setDateFilter(value as DateFilter)}
          >
            <SelectTrigger className={cn(
              "w-full lg:w-[150px] h-10 rounded-lg transition-none shadow-none",
              isDark ? "border-slate-700 bg-[#1e293b] text-slate-100" : "border-slate-200 bg-white text-slate-900"
            )}>
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent isDark={isDark}>
              <SelectItem isDark={isDark} value="all">Anytime</SelectItem>
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
                    "w-full sm:w-[240px] justify-start text-left font-normal h-10 rounded-lg",
                    !dateRange && "text-muted-foreground",
                    isDark ? "bg-[#1e293b] border-slate-700 text-white hover:bg-slate-800" : "bg-white border-slate-200"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-70" strokeWidth={3} />
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
                className="w-min max-w-[calc(100vw-32px)] p-0 rounded-xl overflow-hidden shadow-2xl border-slate-200 dark:border-slate-800 z-[100]"
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
                  className={isDark ? "bg-[#0f172a] text-white" : "bg-white"}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>


      {/* Status Tabs */}
      <Tabs defaultValue="all" value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)} className="w-full">
        <TabsList className="flex gap-2 bg-transparent p-0 h-auto w-full justify-start overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: "all", icon: Layers },
            { id: "pending", icon: Clock },
            { id: "verified", icon: CheckCircle2 },
            { id: "rejected", icon: XCircle },
            { id: "paid", icon: DollarSign },
          ].map(({ id, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className={cn(
                "h-[36px] px-4 rounded-[8px] text-[14px] font-bold uppercase tracking-wider border shadow-none transition-all duration-200",
                isDark ? (
                  statusFilter === id
                    ? "data-[state=active]:bg-[#4211a1] data-[state=active]:text-white data-[state=active]:border-[#4211a1] bg-[#4211a1] text-white shadow-sm"
                    : "bg-transparent border-slate-800 text-white/70 hover:bg-slate-800/50 hover:text-white"
                ) : (
                  statusFilter === id
                    ? "data-[state=active]:bg-[#4211a1] data-[state=active]:text-white data-[state=active]:border-[#4211a1] bg-[#4211a1] text-white border-transparent shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Icon className="w-4 h-4 shrink-0" strokeWidth={3} />
                <span className="font-bold">{id}</span>
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={statusFilter} className="mt-0">
          {/* Submission List Content */}
          <div className="flex flex-col gap-4">
            {viewMode === "contest" ? (
              <>
                {groupedContests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((group) => renderContestGroupCard(group))}
                {groupedContests.length === 0 && (
                  <div className={cn("py-12 text-center rounded-xl border-2 border-dashed", isDark ? "bg-slate-800/20 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <p className={isDark ? "text-slate-400" : "text-slate-500"}>No submissions found matching the criteria.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {filteredSubmissions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((sub) => renderSubmissionCard(sub))}
                {filteredSubmissions.length === 0 && (
                  <div className={cn("py-12 text-center rounded-xl border-2 border-dashed", isDark ? "bg-slate-800/20 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <p className={isDark ? "text-slate-400" : "text-slate-500"}>No submissions found matching the criteria.</p>
                  </div>
                )}
              </>
            )}
          </div>

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
                      isDark ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-200"
                    )}>
                      <SelectValue placeholder="25" />
                    </SelectTrigger>
                    <SelectContent className={cn(
                      "min-w-0 w-[80px]",
                      isDark ? "bg-[#0f172a] border-slate-800" : "bg-white border-slate-200"
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
                    isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-100 text-slate-600"
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
                          variant={isActive ? "default" : "outline"}
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "h-9 w-9 rounded-md border text-[13px] font-bold shadow-none transition-all",
                            isActive
                              ? "bg-[#4211a1] text-white border-[#4211a1] hover:bg-[#350d81]"
                              : isDark
                                ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
                                : "bg-white border-slate-200 hover:bg-slate-100 text-slate-600"
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
                    isDark ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400" : "bg-white border-slate-200 hover:bg-slate-100 text-slate-600"
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
        <DialogContent className={cn("w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin rounded-[20px]", isDark ? "bg-[#0f172a] border-slate-800" : "bg-white border-slate-200")}>
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
              const cpmConfig =
                contest?.contest_type === "cpm" &&
                  contest.contest_based_details &&
                  typeof contest.contest_based_details === "object" &&
                  contest.contest_based_details !== null &&
                  "cpm_contest" in contest.contest_based_details
                  ? (contest.contest_based_details.cpm_contest as unknown as CpmContestDetails)
                  : null;
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
              const milestoneMatchModal =
                contest?.contest_type === "milestone"
                  ? getMilestoneMatchForSubmission(submission, contest)
                  : null;

              const bonusAmountCentsModal = getSubmissionBonusAmount(submission);
              const bonusAmountDollarsModal = centsToDollars(bonusAmountCentsModal).toFixed(2);
              const contestDetailsModal = contest?.contest_based_details as any;
              const bonusDetailsModal = contest?.bonus_details as any;
              const flatFeeBonusModal =
                contestDetailsModal?.cpm_contest?.flat_fee_bonus ||
                contestDetailsModal?.leaderboard_contest?.flat_fee_bonus ||
                bonusDetailsModal?.flat_fee_bonus ||
                0;
              const showEstimatedBonusModal = !isPaidModal && (submission.status === "verified" || flatFeeBonusModal > 0);
              let bonusLabelModal = "Estimated Bonus";
              if (isRejectedModal) bonusLabelModal = "Bonus Won";
              else if (isPaidModal) bonusLabelModal = "Bonus Earned";
              else if (isPayoutsProcessed) bonusLabelModal = "Bonus Earned";
              else if (isVerificationComplete) bonusLabelModal = "Estimated Bonus";
              else bonusLabelModal = "Estimated Bonus";
              const showBonusRowModal = bonusAmountCentsModal > 0 && (bonusLabelModal !== "Estimated Bonus" || showEstimatedBonusModal);
              const bonusColorModal = (bonusLabelModal === "Bonus Earned") ? "text-green-500" : isEnded ? "text-emerald-500" : isDark ? "text-slate-300" : "text-slate-600";

              let earningsDisplay: { label: string; amount: string; color: string; isRejected?: boolean } | null = null;
              if (isRejectedModal) {
                earningsDisplay = { label: "Earnings", amount: "Not Eligible", color: "text-red-500", isRejected: true };
              } else if (isPaidModal) {
                earningsDisplay = {
                  label: "Amount Earned",
                  amount: centsToDollars(submission.earnings ?? 0).toFixed(2),
                  color: "text-green-700",
                };
              } else if (contest?.contest_type === "cpm" || contest?.contest_type === "milestone") {
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

              // Status-based color overrides for CPM submissions in modal
              if (
                earningsDisplay &&
                (contest?.contest_type === "cpm" || contest?.contest_type === "milestone")
              ) {
                if (isPaidModal && isPayoutsProcessed) {
                  earningsDisplay.color = "text-green-700";
                } else if (subStatusLowerModal === "verified") {
                  earningsDisplay.color = isDark ? "text-blue-300" : "text-blue-600";
                } else if (isPendingLikeModal) {
                  earningsDisplay.color = isDark ? "text-yellow-300" : "text-yellow-500";
                }
              }

              const isInstagram = (submission.platform || "").toLowerCase() === "instagram";
              const isBroken = !!brokenThumbs[submission.id];
              const hasThumb = !!bestThumbnail;

              return (
                <div
                  key={submission.id}
                  className={cn(
                    "rounded-[14px] border overflow-hidden transition-all duration-300 group/item hover:shadow-lg min-w-0 w-full",
                    isDark ? "bg-[#1e293b] border-slate-700 hover:border-indigo-500/50" : "bg-white border-slate-200 hover:border-[#4211a1]/30"
                  )}
                >
                  {/* ── SECTION 1: Thumbnail banner ── */}
                  <div className="relative w-full h-[160px] bg-slate-100 dark:bg-slate-900">
                    {isInstagram && (!hasThumb || isBroken) ? (
                      <img src="/instagram-poster.svg" alt="Instagram content" className="absolute inset-0 w-full h-full object-cover" />
                    ) : hasThumb && !isBroken ? (
                      <img
                        src={bestThumbnail}
                        alt="Thumbnail"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={() => setBrokenThumbs((prev) => ({ ...prev, [submission.id]: true }))}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800/30">
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
                  <div className={cn("px-4 pt-3 pb-3 border-b max-w-full overflow-hidden min-w-0 flex-shrink-0", isDark ? "border-slate-700" : "border-slate-100")}>
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
                  <div className={cn("px-4 py-3 flex items-center gap-2 border-b whitespace-nowrap overflow-hidden flex-wrap", isDark ? "border-slate-700" : "border-slate-100")}>
                    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0", isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")}>
                      <CalendarDays className="w-3 h-3 shrink-0" /> {submission.formatted_created_at?.split(',')[0]}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0", isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")}>
                      <Eye className="w-3 h-3 shrink-0" /> {views.toLocaleString()}
                    </span>
                    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex-shrink-0 border", isDark ? "bg-slate-800 text-slate-300 border-slate-600" : "bg-slate-100 text-slate-600 border-slate-200")}>
                      {contest?.contest_type === "leaderboard" ? "Leaderboard" : contest?.contest_type === "cpm" ? "CPM" : contest?.contest_type || "—"}
                    </span>
                    {contest?.contest_type === "leaderboard" && null}
                  </div>

                  {/* ── SECTION 4: Earnings grid ── */}
                  <div className={cn("px-4 py-3 grid gap-3 border-b", isRejectedModal || !showBonusRowModal ? "grid-cols-1" : "grid-cols-2", isDark ? "border-slate-700" : "border-slate-100")}>
                    <div className={cn("rounded-[10px] p-3", isDark ? "bg-slate-800/60" : "bg-slate-50")}>
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
                      {contest?.contest_type === "milestone" &&
                        totalEarningsCents > 0 &&
                        milestoneMatchModal && (
                          <p className={cn("text-[11px] font-semibold mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                            {milestoneMatchModal.order > 0
                              ? `Milestone ${milestoneMatchModal.order}`
                              : "Milestone"}{" "}
                            • Required Views: {milestoneMatchModal.targetViews.toLocaleString()}
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
                      <div className={cn("rounded-[10px] p-3", isDark ? "bg-slate-800/60" : "bg-slate-50")}>
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
                  </div>

                  {/* ── SECTION 5: Rejection block (only if rejected) ── */}
                  {
                    submission.status === "rejected" && rejectionDetails && (
                      <div className={cn("px-4 py-3 border-b", isDark ? "border-slate-700" : "border-slate-100")}>
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
              className={cn("rounded-full font-bold", isDark ? "text-white hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100")}
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
