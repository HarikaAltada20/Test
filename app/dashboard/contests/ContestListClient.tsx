"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  CheckCheck,
  Gift,
  Tag,
  Star,
  AlertTriangle,
  PlayCircle,
  StopCircle,
  Building,
  LayoutGrid,
  List,
  Search,
  X,
  RefreshCw,
  Hourglass,
} from "lucide-react";
import { DeleteContestButton } from "@/components/delete-contest-button";
import { formatLocalDateTime, cn } from "@/lib/utils";
import { isModifiedLinkClick } from "@/lib/navigation-link-utils";
import { compareContestBudgetRemaining, compareContestBudgetUsed } from "@/lib/contest-budget-remaining-sort";
import {
  KNOWN_POST_CONTEST_STATUSES,
  getEndedOpportunityBadgeClassName,
  getEndedOpportunityPhaseLabel,
} from "@/lib/contest-ended-phase-display";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import {
  calculateLeaderboardBudgetSpent,
  Submission,
} from "@/lib/contest-utils-client";
import { getPlatformIconWithFallback } from "@/lib/platform-icons";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useToast } from "@/hooks/use-toast";
import { PaidPlanUpgradeModal } from "@/components/PaidPlanUpgradeModal";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  ADMIN_CONTEST_LIST_TAB_KEY,
  DEFAULT_CAMPAIGN_LIST_TAB,
  readStoredCampaignListTab,
  writeStoredCampaignListTab,
} from "@/lib/campaign-list-tab-storage";
import {
  ADMIN_CONTEST_LIST_FILTERS_KEY,
  BRAND_CONTEST_LIST_FILTERS_KEY,
  readStoredContestListFilters,
  writeStoredContestListFilters,
  type BrandPostPhaseFilterOption,
  type ContestFormatFilterOption,
  type ContestListSortOption,
  type ContestTypeFilterOption,
  type PageSizeOption,
  type ViewModeOption,
} from "@/lib/campaign-list-filters-storage";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Define the type for a campaign
type Contest = {
  id: string;
  title: string | null;
  platform: string | null;
  contest_type: string | null;
  created_at: string;
  moderation_status: string; // Using moderation_status instead of is_draft
  status: string | null; // Contest lifecycle status (only for published contests)
  post_contest_status: string | null; // Post-campaign review status (pending_review, in_review, verification_complete, payouts_processed)
  start_date: string | null;
  end_date: string | null;
  live_submission_count: number | null;
  contest_based_details: {
    leaderboard_contest?: {
      total_prize?: number;
      prizes?: Array<{ amount: number; position: number }>;
      winner_count?: number;
      flat_fee_bonus?: number;
      total_budget?: number;
      budget_spent?: number;
    };
    cpm_contest?: {
      total_budget?: number;
      cpm_rate_usd?: number;
      budget_spent?: number;
      max_views?: number;
      flat_fee_bonus?: number;
    };
    milestone_contest?: {
      total_budget_cents?: number;
      budget_spent?: number;
    };
    /** Dual rewards unified pool (cents); nested CPM/milestone totals may be omitted */
    total_budget_cents?: number;
    twitter_campaign?: {
      campaign_type?: "raid" | "awareness";
      keywords?: string[];
      mentions?: string[];
      keywords_requirement_mode?: "all" | "any" | "";
      mentions_requirement_mode?: "all" | "any" | "";
      allowed_tweet_types?: string[];
      max_participants?: number;
      raid_target?: {
        link?: string | null;
        description?: string | null;
        metrics?: {
          likes?: number | string | null;
          comments?: number | string | null;
          retweets?: number | string | null;
          quote_reposts?: number | string | null;
        };
        keywords_requirement_mode?: string;
      };
    };
  } | null;
  thumbnail_url: string | null;
  advertiser_name?: string;
  // Admin-only fields (populated on the admin contests page)
  verified_submission_count?: number | null;
  pending_submission_count?: number | null;
  rejected_submission_count?: number | null;
  not_rejected_views?: number | null;
  last_metrics_updated?: string | null;
  submitted_for_approval_at?: string | null;
  published_at?: string | null;
  rejection_reason?: string | null;
  multiple_submissions_enabled?: boolean;
  max_submissions_per_creator?: number;
  content_type?: string;
  bonus_details?: any;
  // Text/image vs video campaign format (for display filtering)
  contest_format?: string | null;
  // Twitter participants data (should be populated from twitter_campaign_metrics)
  twitter_participants_count?: number | null;
  twitter_max_participants?: number | null;
};

function formatCompactCount(value: number): string {
  const n = Math.max(0, value);
  if (n >= 1_000_000) {
    const millions = n / 1_000_000;
    return millions >= 10
      ? `${Math.round(millions)}M`
      : `${millions.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const thousands = n / 1_000;
    return thousands >= 10
      ? `${Math.round(thousands)}K`
      : `${thousands.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString();
}

function getAdminSubmissionTotal(contest: Contest): number {
  const verified = contest.verified_submission_count ?? 0;
  const pending = contest.pending_submission_count ?? 0;
  const rejected = contest.rejected_submission_count ?? 0;
  const fromStatusCounts = verified + pending + rejected;

  if (
    contest.live_submission_count !== null &&
    contest.live_submission_count !== undefined
  ) {
    return Math.max(contest.live_submission_count, fromStatusCounts);
  }

  return fromStatusCounts;
}

/** Live: (verified + paid) / total. Ended: non-rejected / total. */
function getAdminApprovalPercent(contest: Contest): number | null {
  const total = getAdminSubmissionTotal(contest);
  if (total <= 0) return null;

  const verified = contest.verified_submission_count ?? 0;
  const pending = contest.pending_submission_count ?? 0;
  const isEnded = contest.status === "ended";
  const numerator = isEnded ? verified + pending : verified;

  return Math.min(100, Math.round((numerator / total) * 100));
}

interface ContestListClientProps {
  initialContests: Contest[];
  isAdminView?: boolean;
  selectedTab?: string;
  onTabChange?: (tab: string) => void;
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
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
  | "budget_remaining_desc"
  | "budget_remaining_asc"
  | "budget_used_desc"
  | "budget_used_asc"
  | "approval_rate_desc"
  | "approval_rate_asc"
  | "views_desc"
  | "views_asc"
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
    description: "Campaign is being created",
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

const BRAND_CONTEST_TAB_IDS = [
  "all",
  "draft",
  "pending_approval",
  "ready",
  "upcoming",
  "live",
  "ended",
  "rejected",
] as const;

type BrandContestTabId = (typeof BRAND_CONTEST_TAB_IDS)[number];

const BRAND_POST_PHASE_IDS = [
  "all",
  "post_pending_review",
  "post_in_review",
  "post_payment_pending",
  "post_paid",
] as const;

type BrandPostPhaseId = (typeof BRAND_POST_PHASE_IDS)[number];

const POST_PHASE_SUB_TABS = new Set<string>([
  "post_pending_review",
  "post_in_review",
  "post_payment_pending",
  "post_paid",
]);

const LEGACY_BRAND_CONTEST_TAB_MAP: Record<string, BrandContestTabId> = {
  active: "live",
  pending_verification: "ended",
  done: "ended",
};

function normalizeBrandContestTabId(tab: string): BrandContestTabId {
  if (POST_PHASE_SUB_TABS.has(tab)) {
    return "ended";
  }
  const mapped = LEGACY_BRAND_CONTEST_TAB_MAP[tab] ?? tab;
  return (BRAND_CONTEST_TAB_IDS as readonly string[]).includes(mapped)
    ? (mapped as BrandContestTabId)
    : "all";
}

function contestMatchesPostPhase(
  c: Contest,
  phase: Exclude<BrandPostPhaseId, "all">,
): boolean {
  if (c.moderation_status !== "published" || c.status !== "ended") {
    return false;
  }
  const s = c.post_contest_status ?? "";
  switch (phase) {
    case "post_pending_review":
      return (
        !s ||
        !KNOWN_POST_CONTEST_STATUSES.has(s) ||
        s === "pending_review"
      );
    case "post_in_review":
      return s === "in_review";
    case "post_payment_pending":
      return s === "verification_complete";
    case "post_paid":
      return s === "payouts_processed";
    default:
      return false;
  }
}

function brandTabFilterPhrase(tab: BrandContestTabId): string {
  const phrases: Record<BrandContestTabId, string> = {
    all: "this view",
    draft: "Draft",
    pending_approval: "Pending approval",
    ready: "Ready to publish",
    live: "Live",
    upcoming: "Upcoming",
    ended: "Ended",
    rejected: "Rejected",
  };
  return phrases[tab];
}

function brandPostPhasePhrase(phase: BrandPostPhaseId): string {
  if (phase === "all") {
    return "All payout phases";
  }
  const phrases: Record<Exclude<BrandPostPhaseId, "all">, string> = {
    post_pending_review: "Pending review",
    post_in_review: "In review",
    post_payment_pending: "Payment pending",
    post_paid: "Completed paid",
  };
  return phrases[phase];
}

function brandListFilterPhrase(
  tab: BrandContestTabId,
  postPhase: BrandPostPhaseId,
): string {
  if (
    (tab === "all" || tab === "ended") &&
    postPhase !== "all"
  ) {
    return `${brandTabFilterPhrase(tab)} · ${brandPostPhasePhrase(postPhase)}`;
  }
  return brandTabFilterPhrase(tab);
}

function canPublishContestFromList(
  moderationStatus: string,
  isAdminView: boolean,
): boolean {
  if (moderationStatus === "approved") return true;
  return isAdminView && moderationStatus === "pending_approval";
}

const getBudgetTrackerValues = (
  totalBudget: number,
  budgetSpent?: number | null,
) => {
  const spent = Math.max(0, budgetSpent ?? 0);
  const clampedSpent = Math.min(spent, totalBudget);
  const percentage = totalBudget > 0 ? (clampedSpent / totalBudget) * 100 : 0;
  const remaining = Math.max(totalBudget - clampedSpent, 0);

  return { spent: clampedSpent, percentage, remaining };
};

const getContestTypeLabel = (contestType: string | null | undefined) => {
  if (contestType === "cpm") return "CPM Based";
  if (contestType === "leaderboard") return "Leaderboard";
  if (contestType === "milestone") return "Milestone";
  if (contestType === "dual_rewards") return "Dual Rewards";
  if (!contestType) return "N/A";
  return contestType.charAt(0).toUpperCase() + contestType.slice(1);
};

/** Unified pool tracker spend: dual splits spend across CPM + milestone nested objects */
function getPoolBudgetSpentForTrackerDisplay(contest: Contest): number {
  const cpm =
    contest.contest_based_details?.cpm_contest?.budget_spent ?? 0;
  if (contest.contest_type !== "dual_rewards") return cpm;
  const milestone =
    contest.contest_based_details?.milestone_contest?.budget_spent ?? 0;
  return cpm + milestone;
}

const getContestValueForSort = (contest: Contest): number => {
  if (
    contest.contest_type === "leaderboard" &&
    contest.contest_based_details?.leaderboard_contest?.total_prize
  ) {
    return contest.contest_based_details.leaderboard_contest.total_prize;
  }
  if (
    contest.contest_type === "cpm" &&
    contest.contest_based_details?.cpm_contest?.total_budget
  ) {
    return contest.contest_based_details.cpm_contest.total_budget;
  }
  if (
    contest.contest_type === "milestone" &&
    contest.contest_based_details?.milestone_contest?.total_budget_cents
  ) {
    return contest.contest_based_details.milestone_contest.total_budget_cents;
  }
  if (
    contest.contest_type === "dual_rewards" &&
    contest.contest_based_details
  ) {
    return getPoolBudgetCentsFromDetails(
      contest.contest_type,
      contest.contest_based_details,
    );
  }
  return 0;
};

const getContestPrimaryFinancialText = (contest: Contest): string => {
  if (contest.contest_type === "leaderboard") {
    return `Prize: ${formatMoney(
      contest.contest_based_details?.leaderboard_contest?.total_prize || 0,
    )}`;
  }
  if (contest.contest_type === "milestone") {
    return `Budget: ${formatMoney(
      contest.contest_based_details?.milestone_contest?.total_budget_cents || 0,
    )}`;
  }
  if (contest.contest_type === "cpm" || contest.contest_type === "dual_rewards") {
    return `Budget: ${formatMoney(
      getPoolBudgetCentsFromDetails(
        contest.contest_type,
        contest.contest_based_details,
      ),
    )}`;
  }
  return `Budget: ${formatMoney(0)}`;
};

export function ContestListClient({
  initialContests,
  isAdminView = false,
  selectedTab: externalSelectedTab,
  onTabChange,
  viewMode: externalViewMode,
  onViewModeChange,
}: ContestListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigatingContestId, setNavigatingContestId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setNavigatingContestId(null);
  }, [pathname]);

  const getContestDetailHref = useCallback(
    (contestId: string) =>
      isAdminView
        ? `/dashboard/admin/contests/${contestId}`
        : `/dashboard/contests/${contestId}`,
    [isAdminView],
  );

  const handleContestDetailLinkClick = useCallback(
    (contestId: string, e: React.MouseEvent) => {
      if (isModifiedLinkClick(e)) return;
      setNavigatingContestId(contestId);
    },
    [],
  );

  const renderContestCardLink = (contest: Contest) => (
    <Link
      href={getContestDetailHref(contest.id)}
      prefetch={false}
      className="absolute inset-0 z-[1]"
      aria-label={`View ${contest.title || "campaign"} details`}
      onClick={(e) => handleContestDetailLinkClick(contest.id, e)}
    />
  );

  const renderViewDetailsLink = (
    contest: Contest,
    className?: string,
    options?: { fullWidth?: boolean; eyeClassName?: string; textClassName?: string },
  ) => (
    <Link
      href={getContestDetailHref(contest.id)}
      prefetch={false}
      className={cn(
        "pointer-events-auto relative z-[2] flex items-center justify-center gap-2 rounded-full",
        isDark ? "bg-[#7F39EC] text-white" : "bg-[#D9C0FF61] text-[#7F39EC]",
        options?.fullWidth && "w-full",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        handleContestDetailLinkClick(contest.id, e);
      }}
    >
      {navigatingContestId === contest.id ? (
        <ButtonLoadingSpinner />
      ) : (
        <Eye className={cn("h-4 w-4", options?.eyeClassName)} />
      )}
      <span className={options?.textClassName}>View Details</span>
    </Link>
  );
  const { toast } = useToast();
  const [sortOption, setSortOption] =
    useState<SortOptionType>("created_at_desc");
  const [internalSelectedTab, setInternalSelectedTab] = useState(
    DEFAULT_CAMPAIGN_LIST_TAB,
  );
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const contestListTabStorageKey = isAdminView
    ? ADMIN_CONTEST_LIST_TAB_KEY
    : null;
  const contestListFiltersStorageKey = isAdminView
    ? ADMIN_CONTEST_LIST_FILTERS_KEY
    : BRAND_CONTEST_LIST_FILTERS_KEY;

  useEffect(() => {
    if (externalSelectedTab !== undefined || !contestListTabStorageKey) return;
    const stored = readStoredCampaignListTab(
      contestListTabStorageKey,
      BRAND_CONTEST_TAB_IDS,
      DEFAULT_CAMPAIGN_LIST_TAB,
    );
    setInternalSelectedTab(stored);
  }, [externalSelectedTab, contestListTabStorageKey]);
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

  const rawSelectedTab =
    externalSelectedTab !== undefined
      ? externalSelectedTab
      : internalSelectedTab;
  const selectedTab = normalizeBrandContestTabId(rawSelectedTab);
  const setSelectedTab = useCallback(
    (tab: string) => {
      if (onTabChange) {
        onTabChange(tab);
      } else {
        setInternalSelectedTab(tab);
        if (contestListTabStorageKey) {
          writeStoredCampaignListTab(contestListTabStorageKey, tab);
        }
      }
    },
    [onTabChange, contestListTabStorageKey],
  );

  const showPostContestPipeline =
    selectedTab === "all" || selectedTab === "ended";
  const [postContestPhaseFilter, setPostContestPhaseFilter] =
    useState<BrandPostPhaseId>("all");

  useEffect(() => {
    if (POST_PHASE_SUB_TABS.has(rawSelectedTab)) {
      setPostContestPhaseFilter(rawSelectedTab as BrandPostPhaseId);
    }
  }, [rawSelectedTab]);

  useEffect(() => {
    if (selectedTab !== "all" && selectedTab !== "ended") {
      setPostContestPhaseFilter("all");
    }
  }, [selectedTab]);

  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [contestTypeFilter, setContestTypeFilter] = useState<string>("all"); // New campaign type filter
  // New: campaign format filter (all / text-image / video)
  const [contestFormatFilter, setContestFormatFilter] = useState<
    "all" | "text_image" | "video"
  >("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filteredAndSortedContests, setFilteredAndSortedContests] = useState<
    Contest[]
  >([]);
  const [isCheckingCpmAccess, setIsCheckingCpmAccess] = useState(false);
  const [showCpmUpgradeModal, setShowCpmUpgradeModal] = useState(false);
  const [upgradeFeatureName, setUpgradeFeatureName] =
    useState<string>("CPM Campaign");
  const [page, setPage] = useState<number>(1);
  // Default to 9 campaigns per page with options: 9, 15, 21, 30
  const [limit, setLimit] = useState<number>(9);
  const [internalViewMode, setInternalViewMode] = useState<"grid" | "list">(
    "grid",
  );
  /** List layout only at lg+ (1024px), same as creator Opportunities */
  const [layoutAllowsListView, setLayoutAllowsListView] = useState(false);
  const brandContestsResultsRef = useRef<HTMLDivElement>(null);

  // Use external viewMode if provided, otherwise use internal state
  const viewMode =
    externalViewMode !== undefined ? externalViewMode : internalViewMode;
  const setViewMode = onViewModeChange || setInternalViewMode;
  const displayViewMode: "grid" | "list" = layoutAllowsListView
    ? viewMode
    : "grid";

  const postPhaseFilterRestoredRef = useRef(false);

  useEffect(() => {
    const stored = readStoredContestListFilters(contestListFiltersStorageKey);
    setSortOption(stored.sortOption as SortOptionType);
    setPlatformFilter(stored.platformFilter);
    setContestTypeFilter(stored.contestTypeFilter);
    setContestFormatFilter(stored.contestFormatFilter);
    setLimit(stored.limit);
    if (externalViewMode === undefined) {
      setInternalViewMode(stored.viewMode);
    }
    setFiltersHydrated(true);
  }, [contestListFiltersStorageKey, externalViewMode]);

  useEffect(() => {
    if (!filtersHydrated || postPhaseFilterRestoredRef.current) return;
    if (selectedTab !== "all" && selectedTab !== "ended") return;

    const stored = readStoredContestListFilters(contestListFiltersStorageKey);
    setPostContestPhaseFilter(stored.postContestPhaseFilter);
    postPhaseFilterRestoredRef.current = true;
  }, [
    filtersHydrated,
    selectedTab,
    contestListFiltersStorageKey,
  ]);

  useEffect(() => {
    if (!filtersHydrated) return;

    const existing = readStoredContestListFilters(contestListFiltersStorageKey);
    const payload: Parameters<typeof writeStoredContestListFilters>[1] = {
      sortOption: sortOption as ContestListSortOption,
      platformFilter,
      contestTypeFilter: contestTypeFilter as ContestTypeFilterOption,
      contestFormatFilter: contestFormatFilter as ContestFormatFilterOption,
      postContestPhaseFilter: showPostContestPipeline
        ? (postContestPhaseFilter as BrandPostPhaseFilterOption)
        : existing.postContestPhaseFilter,
      limit: limit as PageSizeOption,
    };

    if (externalViewMode === undefined) {
      payload.viewMode = internalViewMode as ViewModeOption;
    }

    writeStoredContestListFilters(contestListFiltersStorageKey, payload);
  }, [
    filtersHydrated,
    contestListFiltersStorageKey,
    sortOption,
    platformFilter,
    contestTypeFilter,
    contestFormatFilter,
    postContestPhaseFilter,
    showPostContestPipeline,
    limit,
    internalViewMode,
    externalViewMode,
  ]);

  const [contests, setContests] = useState<Contest[]>(initialContests);
  const isMountedRef = useRef(true);

  // Loading states for buttons
  const [loadingButtons, setLoadingButtons] = useState<{
    [key: string]: {
      edit?: boolean;
      editDates?: boolean;
    };
  }>({});

  // Helper functions for loading states
  const setButtonLoading = (contestId: string, action: 'edit' | 'editDates', isLoading: boolean) => {
    setLoadingButtons(prev => ({
      ...prev,
      [contestId]: {
        ...prev[contestId],
        [action]: isLoading
      }
    }));
  };

  const fetchLatestContests = useCallback(async () => {
    if (isAdminView) {
      return;
    }
    try {
      await fetch("/api/contests/clear-cache", { method: "POST" });

      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      console.log(
        `[ContestListClient] Fetching contests with timestamp: ${timestamp}`,
      );
      const response = await fetch(`/api/contests/list?t=${timestamp}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        console.warn(
          "[ContestListClient] Unable to refresh contests",
          response.status,
        );
        return;
      }
      const payload = await response.json();
      console.log(
        "[ContestListClient] Received fresh contests data:",
        payload.contests?.length,
        "contests",
      );

      if (!Array.isArray(payload?.contests)) {
        return;
      }
      if (!isMountedRef.current) {
        return;
      }

      // Log budget spent values for debugging
      // payload.contests.forEach((contest: any, index: number) => {
      //   if (contest.contest_type === "cpm") {
      //     console.log(`[ContestListClient] CPM Campaign ${index + 1} (${contest.id}): budget_spent =`,
      //       contest.contest_based_details?.cpm_contest?.budget_spent);
      //   } else if (contest.contest_type === "leaderboard") {
      //     console.log(`[ContestListClient] Leaderboard Campaign ${index + 1} (${contest.id}): budget_spent =`,
      //       contest.contest_based_details?.leaderboard_contest?.budget_spent);
      //   }
      // });

      setContests(payload.contests);
    } catch (error) {
      console.error("[ContestListClient] Error refreshing contests:", error);
    }
  }, [isAdminView]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setContests(initialContests);
  }, [initialContests]);

  useEffect(() => {
    if (isAdminView) {
      return;
    }

    const handleContestRefresh = async () => {
      console.log("[ContestListClient] Handling contest refresh event...");
      try {
        // Clear server-side cache first
        console.log("[ContestListClient] Clearing server-side cache...");
        const cacheResponse = await fetch("/api/contests/clear-cache", {
          method: "POST",
        });
        const cacheResult = await cacheResponse.json();
        console.log("[ContestListClient] Cache clear result:", cacheResult);

        // Add a small delay to ensure cache clearing is fully processed
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error("[ContestListClient] Failed to clear cache:", error);
      }
      // Then fetch latest contests with updated budget calculations
      console.log("[ContestListClient] Fetching latest contests...");
      fetchLatestContests();
    };

    window.addEventListener("contests:refresh", handleContestRefresh);
    return () => {
      window.removeEventListener("contests:refresh", handleContestRefresh);
    };
  }, [fetchLatestContests, isAdminView]);

  // Helper function to get contests filtered by format
  const getContestsByFormat = useCallback(
    (contestsList: Contest[], format: string) => {
      return contestsList.filter((contest) => {
        const fmt = contest.contest_format?.toLowerCase() || "";

        if (format === "all") {
          return true; // Show all contests
        } else if (format === "text_image") {
          // Treat missing/unknown format as text/image by default
          return (
            fmt === "text_image" ||
            fmt === "text-image" ||
            fmt === "text" ||
            fmt === "image" ||
            fmt === ""
          );
        } else if (format === "video") {
          return fmt === "video";
        }
        return true;
      });
    },
    [],
  );

  // Group contests by moderation status, lifecycle, and post-contest phase
  const contestsByStatus = useMemo(() => {
    const filteredContests = getContestsByFormat(contests, contestFormatFilter);

    const endedPublished = (c: Contest) =>
      c.moderation_status === "published" && c.status === "ended";

    const groups: Record<BrandContestTabId, Contest[]> = {
      all: filteredContests,
      draft: filteredContests.filter((c) => c.moderation_status === "draft"),
      pending_approval: filteredContests.filter(
        (c) => c.moderation_status === "pending_approval",
      ),
      ready: filteredContests.filter((c) => c.moderation_status === "approved"),
      live: filteredContests.filter(
        (c) =>
          c.moderation_status === "published" && c.status === "active",
      ),
      upcoming: filteredContests.filter(
        (c) =>
          c.moderation_status === "published" && c.status === "upcoming",
      ),
      ended: filteredContests.filter(endedPublished),
      rejected: filteredContests.filter(
        (c) => c.moderation_status === "rejected",
      ),
    };
    return groups;
  }, [contests, contestFormatFilter, getContestsByFormat]);

  const postPhaseCounts = useMemo(() => {
    const ended = contestsByStatus.ended;
    return {
      post_pending_review: ended.filter((c) =>
        contestMatchesPostPhase(c, "post_pending_review"),
      ).length,
      post_in_review: ended.filter((c) =>
        contestMatchesPostPhase(c, "post_in_review"),
      ).length,
      post_payment_pending: ended.filter((c) =>
        contestMatchesPostPhase(c, "post_payment_pending"),
      ).length,
      post_paid: ended.filter((c) =>
        contestMatchesPostPhase(c, "post_paid"),
      ).length,
    };
  }, [contestsByStatus.ended]);

  const availablePlatforms = useMemo(() => {
    // Get contests for the current tab
    const contestsForCurrentTab =
      contestsByStatus[selectedTab as keyof typeof contestsByStatus] || [];
    const platforms = new Set(
      contestsForCurrentTab.map((c) => c.platform).filter(Boolean) as string[],
    );
    return ["all", ...Array.from(platforms)];
  }, [contestsByStatus, selectedTab]);

  // Read and react to mode changes from data attribute with immediate updates
  useLayoutEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      const currentMode = (modeElement?.getAttribute("data-mode") || "") as
        | "light"
        | "dark"
        | "";
      if (currentMode === "light" || currentMode === "dark") {
        if (currentMode !== mode) {
          setMode(currentMode);
        }
        return;
      }
      // Fallback to html.dark if attribute missing
      const isHtmlDark = document.documentElement.classList.contains("dark");
      const fallbackMode = isHtmlDark ? "dark" : "light";
      if (fallbackMode !== mode) {
        setMode(fallbackMode);
      }
    };

    // Check immediately
    checkMode();

    // Watch for changes in the data attributes with immediate callback
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-mode"
        ) {
          checkMode();
        }
      });
    });

    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    // Also listen for storage events to catch theme changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "dashboard-mode" && e.newValue) {
        const newMode = e.newValue as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [mode]);

  // Additional effect to catch theme changes more immediately
  useEffect(() => {
    // Listen for custom theme change events that might be dispatched by the theme system
    const handleThemeChange = (event: CustomEvent) => {
      if (event.detail && event.detail.mode) {
        const newMode = event.detail.mode as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
        }
      }
    };

    // Listen for the custom event
    window.addEventListener("theme-change", handleThemeChange as EventListener);

    // Also check for changes on a more frequent interval as a fallback
    const intervalId = setInterval(() => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode && currentMode !== mode) {
          setMode(currentMode);
        }
      }
    }, 50); // Check every 50ms for faster response

    return () => {
      window.removeEventListener(
        "theme-change",
        handleThemeChange as EventListener,
      );
      clearInterval(intervalId);
    };
  }, [mode]);
  const isDark = mode === "dark";

  // Verified/pending submission badges (header row)
  const renderAdminSubmissionBadges = (
    contest: Contest,
    size: "compact" | "default" = "compact",
  ) => {
    const sizeClass =
      size === "compact" ? "text-[12px]" : "text-sm px-3 py-1 font-medium";

    return (
      <>
        <Badge
          variant="outline"
          className={cn(
            sizeClass,
            isDark
              ? "bg-green-900/30 text-green-300 border-green-700/50"
              : "bg-green-50 text-green-700 border-green-200",
          )}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified: {contest.verified_submission_count ?? 0}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            sizeClass,
            isDark
              ? "bg-amber-900/30 text-amber-300 border-amber-700/50"
              : "bg-amber-50 text-amber-700 border-amber-200",
          )}
        >
          <Hourglass className="h-3 w-3 mr-1" />
          Pending: {contest.pending_submission_count ?? 0}
        </Badge>
      </>
    );
  };

  // Card footer: approval %, views, submissions
  const renderAdminStatsFooter = (contest: Contest) => {
    const total = getAdminSubmissionTotal(contest);
    const approval = getAdminApprovalPercent(contest);
    const views = contest.not_rejected_views ?? 0;
    const isEnded = contest.status === "ended";
    const isLive = contest.status === "active";
    const approvalHint = isEnded
      ? "Non-rejected ÷ total submissions"
      : isLive
        ? "Verified + paid ÷ total submissions"
        : "Verified + paid ÷ total submissions (live formula)";

    const labelClass = cn(
      "text-[10px] uppercase tracking-wide font-medium",
      isDark ? "text-slate-400" : "text-slate-500",
    );
    const valueClass = cn(
      "text-sm font-semibold tabular-nums mt-0.5",
      isDark ? "text-white" : "text-slate-900",
    );

    return (
      <TooltipProvider delayDuration={0}>
        <div
          className={cn(
            "mt-3 pt-3 border-t",
            isDark ? "border-slate-700" : "border-slate-200",
          )}
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className={labelClass}>Approval</div>
                  <div className={valueClass}>
                    {approval !== null ? `${approval}%` : "—"}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">{approvalHint}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <div className={labelClass}>Views</div>
                  <div className={valueClass}>{formatCompactCount(views)}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {views.toLocaleString()} views (excludes rejected)
              </TooltipContent>
            </Tooltip>
            <div>
              <div className={labelClass}>Submissions</div>
              <div className={valueClass}>{total.toLocaleString()}</div>
            </div>
          </div>
          {contest.last_metrics_updated && (
            <p
              className={cn(
                "text-[10px] text-center mt-2",
                isDark ? "text-slate-500" : "text-slate-400",
              )}
            >
              Metrics updated{" "}
              {formatLocalDateTime(contest.last_metrics_updated, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </TooltipProvider>
    );
  };

  const brandPipelineTabs = useMemo(() => {
    const countBadge = (n: number) => (
      <Badge
        variant="secondary"
        className={cn(
          "ml-1.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
          isDark
            ? "border-0 bg-white/20 text-white"
            : "border-0 bg-white text-gray-800 shadow-sm",
        )}
      >
        {n}
      </Badge>
    );
    const row = (text: string, n: number) => (
      <span className="flex items-center justify-center gap-0.5">
        <span>{text}</span>
        {countBadge(n)}
      </span>
    );
    return [
      { id: "all", label: row("All", contestsByStatus.all.length) },
      { id: "draft", label: row("Draft", contestsByStatus.draft.length) },
      {
        id: "pending_approval",
        label: row("Pending approval", contestsByStatus.pending_approval.length),
      },
      { id: "ready", label: row("Ready", contestsByStatus.ready.length) },
      {
        id: "upcoming",
        label: row("Upcoming", contestsByStatus.upcoming.length),
      },
      { id: "live", label: row("Live", contestsByStatus.live.length) },
      { id: "ended", label: row("Ended", contestsByStatus.ended.length) },
      { id: "rejected", label: row("Rejected", contestsByStatus.rejected.length) },
    ];
  }, [contestsByStatus, isDark]);

  const brandPostContestTabs = useMemo(() => {
    const countBadge = (n: number) => (
      <Badge
        variant="secondary"
        className={cn(
          "ml-1.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
          isDark
            ? "border-0 bg-white/20 text-white"
            : "border-0 bg-white text-gray-800 shadow-sm",
        )}
      >
        {n}
      </Badge>
    );
    const row = (
      text: string,
      n: number,
      title?: string,
    ) => (
      <span
        className="flex items-center justify-center gap-0.5 max-w-[min(100%,14rem)]"
        title={title}
      >
        <span className="leading-tight text-center">{text}</span>
        {countBadge(n)}
      </span>
    );
    const endedTotal = contestsByStatus.ended.length;
    return [
      {
        id: "all",
        label: row(
          "All phases",
          endedTotal,
          "All ended campaigns — any payout step",
        ),
      },
      {
        id: "post_pending_review",
        label: row(
          "Pending review",
          postPhaseCounts.post_pending_review,
          "Ended campaigns awaiting initial review",
        ),
      },
      {
        id: "post_in_review",
        label: row(
          "In review",
          postPhaseCounts.post_in_review,
          "Verification in progress",
        ),
      },
      {
        id: "post_payment_pending",
        label: row(
          "Payment pending",
          postPhaseCounts.post_payment_pending,
          "Verification complete — payment pending",
        ),
      },
      {
        id: "post_paid",
        label: row(
          "Completed paid",
          postPhaseCounts.post_paid,
          "Payout completed",
        ),
      },
    ];
  }, [contestsByStatus.ended.length, isDark, postPhaseCounts]);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      setLayoutAllowsListView(mq.matches);
      if (!mq.matches) setViewMode("grid");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setViewMode]);

  // useEffect for filtering and sorting - copied from opportunities
  useEffect(() => {
    const baseContests =
      contestsByStatus[selectedTab as keyof typeof contestsByStatus] || [];
    let contestsToDisplay = [...baseContests];

    if (
      showPostContestPipeline &&
      postContestPhaseFilter !== "all"
    ) {
      contestsToDisplay = contestsToDisplay.filter((c) =>
        contestMatchesPostPhase(c, postContestPhaseFilter),
      );
    }

    // Search Filter - filter by title (case-insensitive)
    if (searchQuery.trim() !== "") {
      const searchTerm = searchQuery.trim().toLowerCase();
      contestsToDisplay = contestsToDisplay.filter((contest) => {
        const title = contest.title?.toLowerCase() || "";
        return title.includes(searchTerm);
      });
    }

    // Apply platform filter
    if (platformFilter !== "all") {
      contestsToDisplay = contestsToDisplay.filter(
        (contest) => contest.platform === platformFilter,
      );
    }

    // Apply campaign type filter
    if (contestTypeFilter !== "all") {
      contestsToDisplay = contestsToDisplay.filter(
        (contest) => contest.contest_type === contestTypeFilter,
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
          const valueA = getContestValueForSort(a);
          const valueB = getContestValueForSort(b);
          return sortOption === "value_desc"
            ? valueB - valueA
            : valueA - valueB;
        case "budget_remaining_desc":
        case "budget_remaining_asc":
          return compareContestBudgetRemaining(a, b, sortOption);
        case "budget_used_desc":
        case "budget_used_asc":
          return compareContestBudgetUsed(a, b, sortOption);
        case "approval_rate_desc":
        case "approval_rate_asc": {
          const approvalA = getAdminApprovalPercent(a) ?? -1;
          const approvalB = getAdminApprovalPercent(b) ?? -1;
          if (approvalA === -1 && approvalB === -1) return 0;
          if (approvalA === -1) return 1;
          if (approvalB === -1) return -1;
          return sortOption === "approval_rate_desc"
            ? approvalB - approvalA
            : approvalA - approvalB;
        }
        case "views_desc":
        case "views_asc": {
          const viewsA =
            a.not_rejected_views !== null && a.not_rejected_views !== undefined
              ? a.not_rejected_views
              : -1;
          const viewsB =
            b.not_rejected_views !== null && b.not_rejected_views !== undefined
              ? b.not_rejected_views
              : -1;
          if (viewsA === -1 && viewsB === -1) return 0;
          if (viewsA === -1) return 1;
          if (viewsB === -1) return -1;
          return sortOption === "views_desc" ? viewsB - viewsA : viewsA - viewsB;
        }
        case "cpm_rate_desc":
        case "cpm_rate_asc":
          const rateA =
            isCpmContestType(a.contest_type) &&
              a.contest_based_details?.cpm_contest?.cpm_rate_usd
              ? a.contest_based_details.cpm_contest.cpm_rate_usd
              : -1;
          const rateB =
            isCpmContestType(b.contest_type) &&
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
    contestsByStatus,
    selectedTab,
    showPostContestPipeline,
    postContestPhaseFilter,
    platformFilter,
    contestTypeFilter,
    contestFormatFilter,
    sortOption,
    searchQuery,
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
        className={`${config.color} text-white px=3 py-1 text-sm bg-[#7F39EC] border-0`}
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

  const renderContestCard = (contest: Contest) => {
    const isPublished = contest.moderation_status === "published";

    // Simple opportunities-style design for published contests
    if (isPublished) {
      return (
        <Card
          key={contest.id}
          className={cn(
            "relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col group w-full cursor-pointer",
            isDark
              ? "bg-[#06021D] border-slate-700"
              : "bg-white border-slate-200",
          )}
        >
          {renderContestCardLink(contest)}
          <div className="pointer-events-none flex flex-col flex-grow">
          <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
            {contest.thumbnail_url ? (
              <img
                src={contest.thumbnail_url || "/placeholder.svg"}
                alt={contest.title || "Campaign thumbnail"}
                className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
              />
            ) : (
              <Trophy className="h-16 w-16 text-slate-400 dark:text-slate-500" />
            )}
            <div className="absolute top-2 right-2">
              <Badge
                className={cn(
                  "text-sm px-3 py-1 font-medium border",
                  contest.status === "active" &&
                  "capitalize bg-[#7F39EC] text-white border-[#7F39EC]",
                  contest.status === "upcoming" &&
                  "capitalize bg-[#7F39EC] text-white border-[#7F39EC]",
                  contest.status === "ended" &&
                  `normal-case ${getEndedOpportunityBadgeClassName(isDark, contest.post_contest_status)}`,
                  !["active", "upcoming", "ended"].includes(
                    contest.status || "",
                  ) && "capitalize bg-[#7F39EC] text-white border-[#7F39EC]",
                )}
              >
                {contest.status === "active"
                  ? "Live"
                  : contest.status === "upcoming"
                    ? "Upcoming"
                    : contest.status === "ended"
                      ? getEndedOpportunityPhaseLabel(contest.post_contest_status)
                      : contest.status || "Unknown"}
              </Badge>
            </div>
          </div>
          <CardHeader className="p-4 pb-2">
            <CardTitle
              className="text-lg font-bold mr-2 leading-tight"
              style={{
                color: isDark ? "white" : "#1e293b",
                transition: "none",
              }}
            >
              {contest.title || "Untitled Campaign"}
            </CardTitle>
            {/* New Features Indicators */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Show campaign type badge (RAID/AWARENESS) for Twitter text_image contests */}
              {(() => {
                const isTwitterTextImage =
                  (contest.platform?.toLowerCase() === "twitter" ||
                    contest.platform?.toLowerCase() === "x") &&
                  contest.contest_format === "text_image";

                if (isTwitterTextImage) {
                  const campaignType =
                    contest.contest_based_details?.twitter_campaign
                      ?.campaign_type;
                  if (campaignType === "raid" || campaignType === "awareness") {
                    return (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[12px]",
                          isDark
                            ? campaignType === "raid"
                              ? "bg-red-900/30 text-red-300 border-red-700/50"
                              : "bg-cyan-900/30 text-cyan-300 border-cyan-700/50"
                            : campaignType === "raid"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-cyan-50 text-cyan-700 border-cyan-200",
                        )}
                      >
                        {campaignType.toUpperCase()}
                      </Badge>
                    );
                  }
                  return null;
                }

                if (contest.multiple_submissions_enabled) {
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[12px]",
                        isDark
                          ? "bg-purple-900/30 text-purple-300 border-purple-700/50"
                          : "bg-purple-50 text-purple-700 border-purple-200",
                      )}
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      {(contest.max_submissions_per_creator ?? 1) > 1
                        ? `${contest.max_submissions_per_creator} Submissions`
                        : "Multiple Entries"}
                    </Badge>
                  );
                }
                return null;
              })()}
              {(contest.contest_based_details?.cpm_contest?.flat_fee_bonus ||
                contest.contest_based_details?.leaderboard_contest
                  ?.flat_fee_bonus) && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[12px]",
                      isDark
                        ? "bg-green-900/30 text-green-300 border-green-700/50"
                        : "bg-green-50 text-green-700 border-green-200",
                    )}
                  >
                    <Gift className="h-3 w-3 mr-1" />
                    {formatMoney(
                      contest.contest_based_details?.cpm_contest
                        ?.flat_fee_bonus ||
                      contest.contest_based_details?.leaderboard_contest
                        ?.flat_fee_bonus ||
                      0,
                    )}
                    /submission
                  </Badge>
                )}
              {/* Don't show content_type badge for Twitter text_image contests (we show campaign_type badge instead) */}
              {(() => {
                const isTwitterTextImage =
                  (contest.platform?.toLowerCase() === "twitter" ||
                    contest.platform?.toLowerCase() === "x") &&
                  contest.contest_format === "text_image";

                if (isTwitterTextImage) {
                  return null;
                }

                if (contest.content_type) {
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[12px]",
                        isDark
                          ? "bg-blue-900/30 text-blue-300 border-blue-700/50"
                          : "bg-blue-50 text-blue-700 border-blue-200",
                      )}
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {contest.content_type.toUpperCase()}
                    </Badge>
                  );
                }
                return null;
              })()}
              {contest.bonus_details?.description_html && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[12px]",
                    isDark
                      ? "bg-amber-900/30 text-amber-300 border-amber-700/50"
                      : "bg-amber-50 text-amber-700 border-amber-200",
                  )}
                >
                  <Star className="h-3 w-3 mr-1" />
                  Bonus Available
                </Badge>
              )}
              {renderAdminSubmissionBadges(contest, "compact")}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex-grow flex flex-col justify-between">
            <div
              className="space-y-2 text-md mb-4"
              style={{
                color: isDark ? "white" : "#475569",
                transition: "none",
              }}
            >
              <div className="flex items-center">
                <div className="mr-2 flex-shrink-0">
                  {getPlatformIconWithFallback(contest.platform, "sm")}
                </div>
                <span>
                  Platform:{" "}
                  <span className="font-medium ">
                    {contest.platform || "N/A"}
                  </span>
                </span>
              </div>
              {contest.start_date && (
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>
                    Starts:{" "}
                    <span className="font-medium">
                      {formatLocalDateTime(contest.start_date, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
              )}
              {contest.end_date && (
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>
                    Ends:{" "}
                    <span className="font-medium ">
                      {formatLocalDateTime(contest.end_date, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
              )}
              {(() => {
                const isTwitterTextImage =
                  (contest.platform?.toLowerCase() === "twitter" ||
                    contest.platform?.toLowerCase() === "x") &&
                  contest.contest_format === "text_image";

                if (!isTwitterTextImage) return null;

                const participantsCount =
                  contest.twitter_participants_count ?? 0;
                const maxParticipants = contest.twitter_max_participants;
                const displayValue = maxParticipants
                  ? `${participantsCount} / ${maxParticipants}`
                  : participantsCount;

                return (
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      Participants:{" "}
                      <span className="font-medium ">{displayValue}</span>
                    </span>
                  </div>
                );
              })()}
              <div className="flex items-center">
                <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>
                  Campaign Type:{" "}
                  <span className="font-medium">
                    {getContestTypeLabel(contest.contest_type)}
                  </span>
                </span>
              </div>
              {isCpmContestType(contest.contest_type) &&
                contest.contest_based_details?.cpm_contest?.cpm_rate_usd !=
                null && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      {contest.platform?.toLowerCase() === "twitter" ||
                        contest.platform?.toLowerCase() === "x"
                        ? "Points Rate: "
                        : "CPM Rate: "}
                      <span className="font-medium">
                        {formatMoney(
                          contest.contest_based_details.cpm_contest
                            .cpm_rate_usd * 100,
                        )}{" "}
                        {contest.platform?.toLowerCase() === "twitter" ||
                          contest.platform?.toLowerCase() === "x"
                          ? "/ 1k points"
                          : "/ 1k views"}
                      </span>
                    </span>
                  </div>
                )}
              {isCpmContestType(contest.contest_type) &&
                getPoolBudgetCentsFromDetails(
                  contest.contest_type,
                  contest.contest_based_details,
                ) > 0 && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      Total Budget:{" "}
                      <span className="font-medium ">
                        {formatMoney(
                          getPoolBudgetCentsFromDetails(
                            contest.contest_type,
                            contest.contest_based_details,
                          ),
                        )}
                      </span>
                    </span>
                  </div>
                )}
              {contest.contest_type === "leaderboard" &&
                contest.contest_based_details?.leaderboard_contest
                  ?.total_prize != null &&
                contest.contest_based_details.leaderboard_contest.total_prize >
                0 && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      Total Prize Pool:{" "}
                      <span className="font-medium">
                        {formatMoney(
                          contest.contest_based_details.leaderboard_contest
                            .total_prize,
                        )}
                      </span>
                    </span>
                  </div>
                )}
              {contest.contest_type === "leaderboard" &&
                contest.contest_based_details?.leaderboard_contest
                  ?.total_budget != null &&
                contest.contest_based_details.leaderboard_contest.total_budget >
                0 && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-green-600" />
                    <span>
                      Total Bonus Budget:{" "}
                      <span className="font-medium text-green-700 dark:text-green-300">
                        {formatMoney(
                          contest.contest_based_details.leaderboard_contest
                            .total_budget,
                        )}
                      </span>
                    </span>
                  </div>
                )}
              {isMilestoneContestType(contest.contest_type) &&
                contest.contest_based_details?.milestone_contest
                  ?.total_budget_cents != null &&
                contest.contest_based_details.milestone_contest
                  .total_budget_cents > 0 && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-blue-600" />
                    <span>
                      Total Budget:{" "}
                      <span className="font-medium text-blue-700 dark:text-blue-300">
                        {formatMoney(
                          contest.contest_based_details.milestone_contest
                            .total_budget_cents,
                        )}
                      </span>
                    </span>
                  </div>
                )}
            </div>

            {/* Budget Spent Progress Bar for CPM and dual contests */}
            {isCpmContestType(contest.contest_type) &&
              getPoolBudgetCentsFromDetails(
                contest.contest_type,
                contest.contest_based_details,
              ) > 0 &&
              (() => {
                const totalBudget = getPoolBudgetCentsFromDetails(
                  contest.contest_type,
                  contest.contest_based_details,
                );
                const budgetSpent =
                  getPoolBudgetSpentForTrackerDisplay(contest);
                const { percentage, remaining } = getBudgetTrackerValues(
                  totalBudget,
                  budgetSpent,
                );

                return (
                  <div className="mt-3 mb-3">
                    <div
                      className="flex justify-between text-sm mb-2"
                      style={{
                        color: isDark ? "#d1d5db" : "#374151",
                        transition: "none",
                      }}
                    >
                      <span className="font-medium">Budget Tracker</span>
                      <span className="font-semibold">
                        {formatMoney(budgetSpent)} / {formatMoney(totalBudget)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden",
                        isDark ? "bg-[#FFFFFF42]" : "bg-slate-200",
                      )}
                      title={`Total Budget Spent: ${formatMoney(budgetSpent)}`}
                    >
                      <div
                        className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div
                      className="flex justify-between text-xs mt-1.5"
                      style={{
                        color: isDark ? "#d1d5db" : "#64748b",
                        transition: "none",
                      }}
                    >
                      <span>{percentage.toFixed(1)}% used</span>
                      <span>{formatMoney(remaining)} remaining</span>
                    </div>
                  </div>
                );
              })()}

            {/* Bonus Budget Tracker for Leaderboard campaigns */}
            {contest.contest_type === "leaderboard" &&
              contest.contest_based_details?.leaderboard_contest
                ?.total_budget != null &&
              contest.contest_based_details.leaderboard_contest.total_budget >
              0 &&
              (() => {
                const totalBudget =
                  contest.contest_based_details.leaderboard_contest
                    .total_budget;
                const budgetSpent =
                  contest.contest_based_details.leaderboard_contest
                    .budget_spent || 0;
                const tracker = getBudgetTrackerValues(
                  totalBudget,
                  budgetSpent,
                );

                return (
                  <div className="mt-3 mb-3">
                    <div
                      className="flex justify-between text-sm mb-2"
                      style={{
                        color: isDark ? "#cbd5e1" : "#475569",
                        transition: "none",
                      }}
                    >
                      <span className="font-medium">
                        Flat Fee Bonus Budget Tracker
                      </span>
                      <span className="font-semibold">
                        {formatMoney(tracker.spent)} /{" "}
                        {formatMoney(totalBudget)}
                      </span>
                    </div>
                    <div
                      className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden"
                      title={`Flat Fee Bonus Budget Spent: ${formatMoney(
                        tracker.spent,
                      )}`}
                    >
                      <div
                        className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${tracker.percentage}%` }}
                      ></div>
                    </div>
                    <div
                      className="flex justify-between text-xs mt-1.5"
                      style={{
                        color: isDark ? "#94a3b8" : "#64748b",
                        transition: "none",
                      }}
                    >
                      <span>{tracker.percentage.toFixed(1)}% used</span>
                      <span>{formatMoney(tracker.remaining)} remaining</span>
                    </div>
                  </div>
                );
              })()}
            {/* Budget Tracker for Milestone campaigns — budget_spent is enriched server-side
                (per-submission milestone model + verified-only ladder + creator bonus expected),
                same basis as contest detail / opportunities. */}
            {contest.contest_type === "milestone" &&
              contest.contest_based_details?.milestone_contest
                ?.total_budget_cents != null &&
              contest.contest_based_details.milestone_contest.total_budget_cents >
              0 &&
              (() => {
                const totalBudget =
                  contest.contest_based_details.milestone_contest
                    .total_budget_cents;
                const budgetSpent =
                  contest.contest_based_details.milestone_contest.budget_spent ||
                  0;
                const { percentage, remaining } = getBudgetTrackerValues(
                  totalBudget,
                  budgetSpent,
                );

                return (
                  <div className="mt-3 mb-3">
                    <div
                      className="flex justify-between text-sm mb-2"
                      style={{
                        color: isDark ? "#d1d5db" : "#374151",
                        transition: "none",
                      }}
                    >
                      <span className="font-medium">Budget Tracker</span>
                      <span className="font-semibold">
                        {formatMoney(budgetSpent)} /{" "}
                        {formatMoney(totalBudget)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "relative w-full rounded-full h-3 overflow-hidden",
                        isDark ? "bg-[#FFFFFF42]" : "bg-slate-200",
                      )}
                      title={`Total Budget Spent: ${formatMoney(budgetSpent)}`}
                    >
                      <div
                        className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div
                      className="flex justify-between text-xs mt-1.5"
                      style={{
                        color: isDark ? "#d1d5db" : "#64748b",
                        transition: "none",
                      }}
                    >
                      <span>{percentage.toFixed(1)}% used</span>
                      <span>{formatMoney(remaining)} remaining</span>
                    </div>
                  </div>
                );
              })()}

            {renderAdminStatsFooter(contest)}

            {renderViewDetailsLink(contest, "px-3 py-3", {
              fullWidth: true,
              eyeClassName: "mr-1",
            })}
          </CardContent>
          </div>
        </Card>
      );
    }

    return (
      <Card
        key={contest.id}
        className={cn(
          "relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col group w-full cursor-pointer",
          isDark
            ? "bg-[#06021D] border-slate-700"
            : "bg-white border-slate-200",
        )}
      >
        {renderContestCardLink(contest)}
        <div className="pointer-events-none flex flex-col flex-grow">
          <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
            {contest.thumbnail_url ? (
              <img
                src={contest.thumbnail_url || "/placeholder.svg"}
                alt={contest.title || "Campaign thumbnail"}
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
                className="font-bold text-lg leading-tight line-clamp-2"
                style={{
                  color: isDark ? "white" : "#0f172a",
                  transition: "none",
                }}
              >
                {contest.title || "Untitled Campaign"}
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
                {getContestTypeLabel(contest.contest_type)}
              </Badge>
            </div>

            <div
              className="space-y-2 text-md mb-4 flex-grow"
              style={{
                color: isDark ? "white" : "#475569",
                transition: "none",
              }}
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
                    isDark ? "text-amber-400" : "text-amber-600",
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span>Dates not set</span>
                </div>
              )}
              {contest.submitted_for_approval_at && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    Submitted:{" "}
                    <span className="font-medium">
                      {formatLocalDateTime(contest.submitted_for_approval_at, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
              )}
              {contest.published_at && (
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  <span>
                    Published:{" "}
                    <span className="font-medium">
                      {formatLocalDateTime(contest.published_at, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
              )}
              {contest.contest_based_details && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span>{getContestPrimaryFinancialText(contest)}</span>
                </div>
              )}
              {contest.moderation_status === "rejected" &&
                contest.rejection_reason && (
                  <div className="flex items-start gap-1 text-red-600 dark:text-red-400">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="text-xs">{contest.rejection_reason}</span>
                  </div>
                )}
            </div>

            <div className="pointer-events-auto relative z-[2] flex gap-2 items-center">
              {canPublishContestFromList(
                contest.moderation_status,
                isAdminView,
              ) ? (
                <>
                  <button
                    className={cn(
                      "flex w-full items-center justify-center gap-2  px-3 py-3 rounded-full",
                      isDark
                        ? "bg-[#7F39EC] text-white"
                        : "bg-[#D9C0FF61] text-[#7F39EC]",
                    )}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const response = await fetch(
                          `/api/contests/${contest.id}/publish`,
                          {
                            method: "POST",
                          },
                        );
                        if (response.ok) {
                          window.location.reload();
                        } else {
                          const error = await response.json();
                          alert(error.error || "Failed to publish campaign");
                        }
                      } catch (error) {
                        alert("Failed to publish campaign");
                      }
                    }}
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Publish
                  </button>
                  <Button
                    variant="outline"
                    size="md"
                    className={cn(
                      "text-[13px]",
                      isDark
                        ? "text-purple-400 border-gray-700"
                        : "text-purple-500",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setButtonLoading(contest.id, 'editDates', true);
                      router.push(
                        `/dashboard/contests/${contest.id}/edit?dates=true`,
                      );
                    }}
                    disabled={loadingButtons[contest.id]?.editDates}
                  >
                    {loadingButtons[contest.id]?.editDates ? (
                      <ButtonLoadingSpinner />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                    <span>Edit Dates</span>
                  </Button>
                </>
              ) : contest.moderation_status !== "published" ? (
                // Non-published contests: Show Edit Campaign button
                <button
                  className={cn(
                    "flex w-full items-center justify-center gap-2  px-3 py-3 rounded-full",
                    isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#D9C0FF61] text-[#7F39EC]",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setButtonLoading(contest.id, 'edit', true);
                    const href = isAdminView
                      ? `/dashboard/contests/${contest.id}/edit`
                      : `/dashboard/contests/${contest.id}/edit`;
                    router.push(href);
                  }}
                  disabled={loadingButtons[contest.id]?.edit}
                >
                  {loadingButtons[contest.id]?.edit ? (
                    <ButtonLoadingSpinner />
                  ) : (
                    <Edit className="h-4 w-4" />
                  )}
                  <span>Edit Campaign</span>
                </button>
              ) : (
                renderViewDetailsLink(contest, "px-3 py-3", { fullWidth: true })
              )}

              {contest.moderation_status !== "published" && (
                <DeleteContestButton
                  contestId={contest.id}
                  contestTitle={contest.title || "this campaign"}
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

  const renderContestListItem = (contest: Contest) => {
    const isPublished = contest.moderation_status === "published";

    if (isPublished) {
      return (
        <Card
          key={contest.id}
          className={cn(
            "relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col sm:flex-row group w-full cursor-pointer",
            isDark
              ? "bg-[#06021D] border-slate-700"
              : "bg-white border-slate-200",
          )}
        >
          {renderContestCardLink(contest)}
          <div className="pointer-events-none flex flex-col sm:flex-row flex-1 w-full">
          {/* Status Badge - Top Right Corner */}
          {(contest.status === "active" ||
            contest.status === "upcoming" ||
            contest.status === "ended") && (
              <div className="absolute top-3 right-3 z-10">
                <Badge
                  className={cn(
                    "text-sm px-3 py-1 font-medium border",
                    contest.status === "active" &&
                    "capitalize bg-[#7F39EC] text-white border-[#7F39EC]",
                    contest.status === "upcoming" &&
                    "capitalize bg-[#7F39EC] text-white border-[#7F39EC]",
                    contest.status === "ended" &&
                    `normal-case ${getEndedOpportunityBadgeClassName(isDark, contest.post_contest_status)}`,
                  )}
                >
                  {contest.status === "active"
                    ? "Live"
                    : contest.status === "upcoming"
                      ? "Upcoming"
                      : contest.status === "ended"
                        ? getEndedOpportunityPhaseLabel(contest.post_contest_status)
                        : contest.status || "Unknown"}
                </Badge>
              </div>
            )}
          {/* Thumbnail */}
          <div className="w-full sm:w-64 md:w-80 lg:w-72 xl:w-96 sm:h-[200px] md:h-[220px] lg:h-[250px] min-h-[12rem] flex-shrink-0 flex items-center justify-center overflow-hidden relative">
            {contest.thumbnail_url ? (
              <img
                src={contest.thumbnail_url || "/placeholder.svg"}
                alt={contest.title || "Campaign thumbnail"}
                className="w-full h-full object-contain transition-transform duration-300 ease-in-out group-hover:scale-105"
              />
            ) : (
              <Trophy className="h-16 w-16 text-slate-400 dark:text-slate-500" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col p-3 sm:p-4">
            <CardHeader className="p-0 pb-2">
              <CardTitle
                className="text-base sm:text-lg font-bold leading-tight mb-2"
                style={{
                  color: isDark ? "white" : "#1e293b",
                  transition: "none",
                }}
              >
                {contest.title || "Untitled Campaign"}
              </CardTitle>
              {/* Badges */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Show campaign type badge (RAID/AWARENESS) for Twitter text_image contests */}
                {(() => {
                  const isTwitterTextImage =
                    (contest.platform?.toLowerCase() === "twitter" ||
                      contest.platform?.toLowerCase() === "x") &&
                    contest.contest_format === "text_image";

                  if (isTwitterTextImage) {
                    const campaignType =
                      contest.contest_based_details?.twitter_campaign
                        ?.campaign_type;
                    if (
                      campaignType === "raid" ||
                      campaignType === "awareness"
                    ) {
                      return (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-sm px-3 py-1 font-medium",
                            isDark
                              ? campaignType === "raid"
                                ? "bg-red-900/30 text-red-300 border-red-700/50"
                                : "bg-cyan-900/30 text-cyan-300 border-cyan-700/50"
                              : campaignType === "raid"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-cyan-50 text-cyan-700 border-cyan-200",
                          )}
                        >
                          {campaignType.toUpperCase()}
                        </Badge>
                      );
                    }
                    return null;
                  }

                  if (contest.multiple_submissions_enabled) {
                    return (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-sm px-3 py-1 font-medium",
                          isDark
                            ? "bg-purple-900/30 text-purple-300 border-purple-700/50"
                            : "bg-purple-50 text-purple-700 border-purple-200",
                        )}
                      >
                        <CheckCheck className="h-3 w-3 mr-1" />
                        {(contest.max_submissions_per_creator ?? 1) > 1
                          ? `${contest.max_submissions_per_creator} Submissions`
                          : "Multiple Entries"}
                      </Badge>
                    );
                  }
                  return null;
                })()}
                {/* Content Type Badge (UGC, Clipping, etc.) - Don't show for Twitter text_image contests (we show campaign_type badge instead) */}
                {(() => {
                  const isTwitterTextImage =
                    (contest.platform?.toLowerCase() === "twitter" ||
                      contest.platform?.toLowerCase() === "x") &&
                    contest.contest_format === "text_image";

                  if (isTwitterTextImage) {
                    return null;
                  }

                  if (contest.content_type) {
                    return (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-sm px-3 py-1 font-medium",
                          isDark
                            ? "bg-blue-900/30 text-blue-300 border-blue-700/50"
                            : "bg-blue-50 text-blue-700 border-blue-200",
                        )}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {contest.content_type.toUpperCase()}
                      </Badge>
                    );
                  }
                  return null;
                })()}
                {/* Flat Fee Bonus Badge */}
                {(contest.contest_based_details?.cpm_contest?.flat_fee_bonus ||
                  contest.contest_based_details?.leaderboard_contest
                    ?.flat_fee_bonus) && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-sm px-3 py-1 font-medium",
                        isDark
                          ? "bg-green-900/30 text-green-300 border-green-700/50"
                          : "bg-green-50 text-green-700 border-green-200",
                      )}
                    >
                      <Gift className="h-3 w-3 mr-1" />
                      {formatMoney(
                        contest.contest_based_details?.cpm_contest
                          ?.flat_fee_bonus ||
                        contest.contest_based_details?.leaderboard_contest
                          ?.flat_fee_bonus ||
                        0,
                      )}
                      /submission
                    </Badge>
                  )}
                {/* Bonus Available Badge */}
                {contest.bonus_details?.description_html && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-sm px-3 py-1 font-medium",
                      isDark
                        ? "bg-amber-900/30 text-amber-300 border-amber-700/50"
                        : "bg-amber-50 text-amber-700 border-amber-200",
                    )}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Bonus Available
                  </Badge>
                )}
                {renderAdminSubmissionBadges(contest, "default")}
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-2 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-2 text-resp">
                <div className="flex items-center">
                  <div className="mr-2 flex-shrink-0">
                    {getPlatformIconWithFallback(contest.platform, "sm")}
                  </div>
                  <span
                    style={{
                      color: isDark ? "white" : "#475569",
                      transition: "none",
                    }}
                  >
                    Platform:{" "}
                    <span className="font-medium">
                      {contest.platform || "N/A"}
                    </span>
                  </span>
                </div>
                {contest.start_date && (
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span
                      style={{
                        color: isDark ? "white" : "#475569",
                        transition: "none",
                      }}
                    >
                      Starts:{" "}
                      <span className="font-medium">
                        {formatLocalDateTime(contest.start_date, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </div>
                )}
                {contest.end_date && (
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span
                      style={{
                        color: isDark ? "white" : "#475569",
                        transition: "none",
                      }}
                    >
                      Ends:{" "}
                      <span className="font-medium">
                        {formatLocalDateTime(contest.end_date, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </div>
                )}
                {(() => {
                  const isTwitterTextImage =
                    (contest.platform?.toLowerCase() === "twitter" ||
                      contest.platform?.toLowerCase() === "x") &&
                    contest.contest_format === "text_image";

                  if (!isTwitterTextImage) return null;

                  const participantsCount =
                    contest.twitter_participants_count ?? 0;
                  const maxParticipants = contest.twitter_max_participants;
                  const displayValue = maxParticipants
                    ? `${participantsCount} / ${maxParticipants}`
                    : participantsCount;

                  return (
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span
                        style={{
                          color: isDark ? "white" : "#475569",
                          transition: "none",
                        }}
                      >
                        Participants:{" "}
                        <span className="font-medium">{displayValue}</span>
                      </span>
                    </div>
                  );
                })()}
                <div className="flex items-center">
                  <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span
                    style={{
                      color: isDark ? "white" : "#475569",
                      transition: "none",
                    }}
                  >
                    Campaign Type:{" "}
                    <span className="font-medium">
                      {getContestTypeLabel(contest.contest_type)}
                    </span>
                  </span>
                </div>
                {isCpmContestType(contest.contest_type) &&
                  contest.contest_based_details?.cpm_contest?.cpm_rate_usd !=
                  null && (
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span
                        style={{
                          color: isDark ? "white" : "#475569",
                          transition: "none",
                        }}
                      >
                        {contest.platform?.toLowerCase() === "twitter" ||
                          contest.platform?.toLowerCase() === "x"
                          ? "Points Rate: "
                          : "CPM Rate: "}
                        <span className="font-medium">
                          {formatMoney(
                            contest.contest_based_details.cpm_contest
                              .cpm_rate_usd * 100,
                          )}{" "}
                          {contest.platform?.toLowerCase() === "twitter" ||
                            contest.platform?.toLowerCase() === "x"
                            ? "/ 1k points"
                            : "/ 1k views"}
                        </span>
                      </span>
                    </div>
                  )}
                {isCpmContestType(contest.contest_type) &&
                  getPoolBudgetCentsFromDetails(
                    contest.contest_type,
                    contest.contest_based_details,
                  ) > 0 && (
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span
                        style={{
                          color: isDark ? "white" : "#475569",
                          transition: "none",
                        }}
                      >
                        Total Budget:{" "}
                        <span className="font-medium">
                          {formatMoney(
                            getPoolBudgetCentsFromDetails(
                              contest.contest_type,
                              contest.contest_based_details,
                            ),
                          )}
                        </span>
                      </span>
                    </div>
                  )}
                {contest.contest_type === "leaderboard" &&
                  contest.contest_based_details?.leaderboard_contest
                    ?.total_prize != null &&
                  contest.contest_based_details.leaderboard_contest
                    .total_prize > 0 && (
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span
                        style={{
                          color: isDark ? "white" : "#475569",
                          transition: "none",
                        }}
                      >
                        Total Prize Pool:{" "}
                        <span className="font-medium">
                          {formatMoney(
                            contest.contest_based_details.leaderboard_contest
                              .total_prize,
                          )}
                        </span>
                      </span>
                    </div>
                  )}
                {isMilestoneContestType(contest.contest_type) &&
                  contest.contest_based_details?.milestone_contest
                    ?.total_budget_cents != null &&
                  contest.contest_based_details.milestone_contest
                    .total_budget_cents > 0 && (
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-blue-600" />
                      <span
                        style={{
                          color: isDark ? "white" : "#475569",
                          transition: "none",
                        }}
                      >
                        Total Budget:{" "}
                        <span className="font-medium text-blue-700 dark:text-blue-300">
                          {formatMoney(
                            contest.contest_based_details.milestone_contest
                              .total_budget_cents,
                          )}
                        </span>
                      </span>
                    </div>
                  )}
              </div>

              {/* Budget Spent Progress Bar for CPM and dual contests */}
              {isCpmContestType(contest.contest_type) &&
                getPoolBudgetCentsFromDetails(
                  contest.contest_type,
                  contest.contest_based_details,
                ) > 0 &&
                (() => {
                  const totalBudget = getPoolBudgetCentsFromDetails(
                    contest.contest_type,
                    contest.contest_based_details,
                  );
                  const budgetSpent =
                    getPoolBudgetSpentForTrackerDisplay(contest);
                  const { percentage, remaining } = getBudgetTrackerValues(
                    totalBudget,
                    budgetSpent,
                  );

                  return (
                    <div className="mt-3">
                      <div
                        className="flex justify-between text-sm mb-2"
                        style={{
                          color: isDark ? "#d1d5db" : "#374151",
                          transition: "none",
                        }}
                      >
                        <span className="font-medium">Budget Tracker</span>
                        <span className="font-semibold">
                          {formatMoney(budgetSpent)} /{" "}
                          {formatMoney(totalBudget)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden",
                          isDark ? "bg-[#FFFFFF42]" : "bg-slate-200",
                        )}
                      >
                        <div
                          className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div
                        className="flex justify-between text-xs mt-1.5"
                        style={{
                          color: isDark ? "#d1d5db" : "#64748b",
                          transition: "none",
                        }}
                      >
                        <span>{percentage.toFixed(1)}% used</span>
                        <span>{formatMoney(remaining)} remaining</span>
                      </div>
                    </div>
                  );
                })()}

              {/* Bonus Budget Tracker for Leaderboard campaigns */}
              {contest.contest_type === "leaderboard" &&
                contest.contest_based_details?.leaderboard_contest
                  ?.total_budget != null &&
                contest.contest_based_details.leaderboard_contest.total_budget >
                0 &&
                (() => {
                  const totalBudget =
                    contest.contest_based_details.leaderboard_contest
                      .total_budget;
                  const budgetSpent =
                    contest.contest_based_details.leaderboard_contest
                      .budget_spent || 0;
                  const tracker = getBudgetTrackerValues(
                    totalBudget,
                    budgetSpent,
                  );

                  return (
                    <div className="mt-3">
                      <div
                        className="flex justify-between text-sm mb-2"
                        style={{
                          color: isDark ? "#cbd5e1" : "#475569",
                          transition: "none",
                        }}
                      >
                        <span className="font-medium">
                          Flat Fee Bonus Budget Tracker
                        </span>
                        <span className="font-semibold">
                          {formatMoney(tracker.spent)} /{" "}
                          {formatMoney(totalBudget)}
                        </span>
                      </div>
                      <div className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div
                          className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${tracker.percentage}%` }}
                        ></div>
                      </div>
                      <div
                        className="flex justify-between text-xs mt-1.5"
                        style={{
                          color: isDark ? "#94a3b8" : "#64748b",
                          transition: "none",
                        }}
                      >
                        <span>{tracker.percentage.toFixed(1)}% used</span>
                        <span>{formatMoney(tracker.remaining)} remaining</span>
                      </div>
                    </div>
                  );
                })()}
              {/* Milestone budget_spent: server-enriched, same model as contest detail */}
              {contest.contest_type === "milestone" &&
                contest.contest_based_details?.milestone_contest
                  ?.total_budget_cents != null &&
                contest.contest_based_details.milestone_contest
                  .total_budget_cents > 0 &&
                (() => {
                  const totalBudget =
                    contest.contest_based_details.milestone_contest
                      .total_budget_cents;
                  const budgetSpent =
                    contest.contest_based_details.milestone_contest
                      .budget_spent || 0;
                  const { percentage, remaining } = getBudgetTrackerValues(
                    totalBudget,
                    budgetSpent,
                  );

                  return (
                    <div className="mt-3">
                      <div
                        className="flex justify-between text-sm mb-2"
                        style={{
                          color: isDark ? "#d1d5db" : "#374151",
                          transition: "none",
                        }}
                      >
                        <span className="font-medium">Budget Tracker</span>
                        <span className="font-semibold">
                          {formatMoney(budgetSpent)} /{" "}
                          {formatMoney(totalBudget)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "relative w-full rounded-full h-3 overflow-hidden",
                          isDark ? "bg-[#FFFFFF42]" : "bg-slate-200",
                        )}
                        title={`Total Budget Spent: ${formatMoney(budgetSpent)}`}
                      >
                        <div
                          className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div
                        className="flex justify-between text-xs mt-1.5"
                        style={{
                          color: isDark ? "#d1d5db" : "#64748b",
                          transition: "none",
                        }}
                      >
                        <span>{percentage.toFixed(1)}% used</span>
                        <span>{formatMoney(remaining)} remaining</span>
                      </div>
                    </div>
                  );
                })()}
            {renderAdminStatsFooter(contest)}
            </CardContent>
          </div>

          {/* Third Column - View Details Button */}
          <div className="flex flex-col items-center justify-center gap-3 p-4 w-32 sm:w-40 flex-shrink-0">
            {renderViewDetailsLink(contest, "px-4 py-3 whitespace-nowrap", {
              textClassName: "text-sm font-medium",
            })}
          </div>
          </div>
        </Card>
      );
    }

    // List view for unpublished contests
    return (
      <Card
        key={contest.id}
        className={cn(
          "relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col sm:flex-row group w-full cursor-pointer",
          isDark
            ? "bg-[#06021D] border-slate-700"
            : "bg-white border-slate-200",
        )}
      >
        {renderContestCardLink(contest)}
        <div className="pointer-events-none flex flex-col sm:flex-row flex-1 w-full">
        <div className="absolute top-4 right-3 z-10">
          {getModerationStatusBadge(contest.moderation_status)}
        </div>
        {/* Thumbnail */}
        <div className="w-full sm:w-64 md:w-80 lg:w-72 xl:w-96 sm:h-[200px] md:h-[220px] lg:h-[250px] min-h-[12rem] flex-shrink-0 flex items-center justify-center overflow-hidden relative">
          {contest.thumbnail_url ? (
            <img
              src={contest.thumbnail_url || "/placeholder.svg"}
              alt={contest.title || "Campaign thumbnail"}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Trophy className="h-12 w-12 mb-2" />
              <span className="text-sm font-medium">No Image</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-4">
          <div className="mb-3">
            <h3
              className="font-bold text-lg leading-tight line-clamp-2"
              style={{
                color: isDark ? "white" : "#0f172a",
                transition: "none",
              }}
            >
              {contest.title || "Untitled Campaign"}
            </h3>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Badge
              variant="outline"
              className="text-sm bg-[#7F39EC] text-white py-1 capitalize"
            >
              {contest.platform || "Platform"}
            </Badge>
            <Badge
              variant="outline"
              className="text-sm bg-[#7F39EC] text-white py-1 capitalize"
            >
              {getContestTypeLabel(contest.contest_type)}
            </Badge>
          </div>

          <div
            className="space-y-2 flex-grow"
            style={{
              color: isDark ? "white" : "#475569",
              transition: "none",
            }}
          >
            {contest.start_date && contest.end_date ? (
              <div className="flex items-center gap-1 text-base">
                <Calendar className="h-3 w-3" />
                <span>
                  {formatLocalDateTime(contest.start_date)} -{" "}
                  {formatLocalDateTime(contest.end_date)}
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-1 text-base",
                  isDark ? "text-amber-400" : "text-amber-600",
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Dates not set</span>
              </div>
            )}
            {contest.submitted_for_approval_at && (
              <div className="flex items-center gap-1 text-base">
                <Clock className="h-3 w-3" />
                <span>
                  Submitted:{" "}
                  <span className="font-medium">
                    {formatLocalDateTime(contest.submitted_for_approval_at, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </div>
            )}
            {contest.published_at && (
              <div className="flex items-center gap-1 text-base">
                <Eye className="h-3 w-3" />
                <span>
                  Published:{" "}
                  <span className="font-medium">
                    {formatLocalDateTime(contest.published_at, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </div>
            )}
            {contest.contest_based_details && (
              <div className="flex items-center gap-1 text-base">
                <DollarSign className="h-3 w-3" />
                <span>{getContestPrimaryFinancialText(contest)}</span>
              </div>
            )}
            {contest.rejection_reason && (
              <div className="flex items-start gap-1 text-red-600 dark:text-red-400">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="text-xs">{contest.rejection_reason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Third Column - Action Buttons */}
        <div
          className={cn(
            "pointer-events-auto relative z-[2] flex items-center justify-center gap-2 p-4 flex-shrink-0",
            contest.moderation_status === "approved" ||
              contest.moderation_status !== "published"
              ? "flex-row w-auto sm:w-auto"
              : "flex-col w-32 sm:w-40",
          )}
        >
          {canPublishContestFromList(
            contest.moderation_status,
            isAdminView,
          ) ? (
            <>
              <button
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-3 rounded-full text-sm font-medium whitespace-nowrap",
                  isDark
                    ? "bg-[#7F39EC] text-white"
                    : "bg-[#D9C0FF61] text-[#7F39EC]",
                )}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const response = await fetch(
                      `/api/contests/${contest.id}/publish`,
                      {
                        method: "POST",
                      },
                    );
                    if (response.ok) {
                      window.location.reload();
                    } else {
                      const error = await response.json();
                      alert(error.error || "Failed to publish campaign");
                    }
                  } catch (error) {
                    alert("Failed to publish campaign");
                  }
                }}
              >
                <PlayCircle className="h-4 w-4" />
                <span>Publish</span>
              </button>
              <Button
                variant="outline"
                size="md"
                className={cn(
                  "text-[13px] whitespace-nowrap",
                  isDark
                    ? "text-purple-400 border-gray-700"
                    : "text-purple-500",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setButtonLoading(contest.id, 'editDates', true);
                  router.push(
                    `/dashboard/contests/${contest.id}/edit?dates=true`,
                  );
                }}
                disabled={loadingButtons[contest.id]?.editDates}
              >
                {loadingButtons[contest.id]?.editDates ? (
                  <ButtonLoadingSpinner />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                <span>Edit Dates</span>
              </Button>
              <DeleteContestButton
                contestId={contest.id}
                contestTitle={contest.title || "this campaign"}
                isDeletable={true}
                className="flex items-center gap-2 justify-center"
              />
            </>
          ) : contest.moderation_status !== "published" ? (
            <>
              <button
                className={cn(
                  "flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-medium whitespace-nowrap min-w-[140px]",
                  isDark
                    ? "bg-[#7F39EC] text-white"
                    : "bg-[#D9C0FF61] text-[#7F39EC]",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setButtonLoading(contest.id, 'edit', true);
                  const href = isAdminView
                    ? `/dashboard/contests/${contest.id}/edit`
                    : `/dashboard/contests/${contest.id}/edit`;
                  router.push(href);
                }}
                disabled={loadingButtons[contest.id]?.edit}
              >
                {loadingButtons[contest.id]?.edit ? (
                  <ButtonLoadingSpinner />
                ) : (
                  <Edit className="h-4 w-4" />
                )}
                <span>Edit Campaign</span>
              </button>
              <DeleteContestButton
                contestId={contest.id}
                contestTitle={contest.title || "this campaign"}
                isDeletable={true}
                className="flex items-center gap-2 justify-center"
              />
            </>
          ) : (
            renderViewDetailsLink(contest, "px-3 py-3 text-sm font-medium", {
              fullWidth: true,
            })
          )}
        </div>
        </div>
      </Card>
    );
  };

  const currentContests =
    contestsByStatus[selectedTab as keyof typeof contestsByStatus] || [];

  // Apply sorting to currentContests when no additional filters are applied
  const sortedCurrentContests = useMemo(() => {
    if (
      platformFilter !== "all" ||
      contestTypeFilter !== "all" ||
      contestFormatFilter !== "all" ||
      searchQuery.trim() !== "" ||
      (showPostContestPipeline && postContestPhaseFilter !== "all")
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
            a.contest_type === "milestone" &&
            a.contest_based_details?.milestone_contest?.total_budget_cents
          ) {
            valueA =
              a.contest_based_details.milestone_contest.total_budget_cents;
          } else if (
            isCpmContestType(a.contest_type) &&
            a.contest_based_details
          ) {
            valueA = getPoolBudgetCentsFromDetails(
              a.contest_type,
              a.contest_based_details,
            );
          }
          if (
            b.contest_type === "leaderboard" &&
            b.contest_based_details?.leaderboard_contest?.total_prize
          ) {
            valueB = b.contest_based_details.leaderboard_contest.total_prize;
          } else if (
            b.contest_type === "milestone" &&
            b.contest_based_details?.milestone_contest?.total_budget_cents
          ) {
            valueB =
              b.contest_based_details.milestone_contest.total_budget_cents;
          } else if (
            isCpmContestType(b.contest_type) &&
            b.contest_based_details
          ) {
            valueB = getPoolBudgetCentsFromDetails(
              b.contest_type,
              b.contest_based_details,
            );
          }
          return sortOption === "value_desc"
            ? valueB - valueA
            : valueA - valueB;
        case "budget_remaining_desc":
        case "budget_remaining_asc":
          return compareContestBudgetRemaining(a, b, sortOption);
        case "budget_used_desc":
        case "budget_used_asc":
          return compareContestBudgetUsed(a, b, sortOption);
        case "approval_rate_desc":
        case "approval_rate_asc": {
          const approvalA = getAdminApprovalPercent(a) ?? -1;
          const approvalB = getAdminApprovalPercent(b) ?? -1;
          if (approvalA === -1 && approvalB === -1) return 0;
          if (approvalA === -1) return 1;
          if (approvalB === -1) return -1;
          return sortOption === "approval_rate_desc"
            ? approvalB - approvalA
            : approvalA - approvalB;
        }
        case "views_desc":
        case "views_asc": {
          const viewsA =
            a.not_rejected_views !== null && a.not_rejected_views !== undefined
              ? a.not_rejected_views
              : -1;
          const viewsB =
            b.not_rejected_views !== null && b.not_rejected_views !== undefined
              ? b.not_rejected_views
              : -1;
          if (viewsA === -1 && viewsB === -1) return 0;
          if (viewsA === -1) return 1;
          if (viewsB === -1) return -1;
          return sortOption === "views_desc" ? viewsB - viewsA : viewsA - viewsB;
        }
        case "cpm_rate_desc":
        case "cpm_rate_asc":
          const rateSortA =
            isCpmContestType(a.contest_type) &&
              a.contest_based_details?.cpm_contest?.cpm_rate_usd
              ? a.contest_based_details.cpm_contest.cpm_rate_usd
              : -1;
          const rateSortB =
            isCpmContestType(b.contest_type) &&
              b.contest_based_details?.cpm_contest?.cpm_rate_usd
              ? b.contest_based_details.cpm_contest.cpm_rate_usd
              : -1;
          if (rateSortA === -1 && rateSortB === -1) return 0;
          if (rateSortA === -1) return 1; // a (no rate) comes after b (has rate)
          if (rateSortB === -1) return -1; // b (no rate) comes after a (has rate)
          return sortOption === "cpm_rate_desc"
            ? rateSortB - rateSortA
            : rateSortA - rateSortB;
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
    platformFilter,
    contestTypeFilter,
    searchQuery,
    selectedTab,
    showPostContestPipeline,
    postContestPhaseFilter,
  ]);

  const displayContests = sortedCurrentContests;

  // Reset to first page whenever filters, sort, or tab changes
  useEffect(() => {
    setPage(1);
  }, [
    selectedTab,
    postContestPhaseFilter,
    platformFilter,
    contestTypeFilter,
    contestFormatFilter,
    sortOption,
    searchQuery,
  ]);

  const total = displayContests.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;
  const paginatedContests = displayContests.slice(
    (page - 1) * limit,
    page * limit,
  );
  const hasCreatedContests = contests.length > 0;
  const hasPendingApprovalOrPublishedContest = contests.some((contest) =>
    ["pending_approval", "approved", "published", "rejected"].includes(
      contest.moderation_status,
    ),
  );
  const shouldShowContestTypeGuide = !hasPendingApprovalOrPublishedContest;

  const handleCreateCpmContest = useCallback(async () => {
    if (isCheckingCpmAccess) return;

    setIsCheckingCpmAccess(true);
    try {
      const response = await fetch(`/api/subscriptions/current?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subscription details");
      }

      const data = await response.json();
      const canCreateCpm = Boolean(
        data?.plan?.features?.contestTypes?.includes("cpm"),
      );

      if (!canCreateCpm) {
        setUpgradeFeatureName("CPM Campaign");
        setShowCpmUpgradeModal(true);
        return;
      }

      router.push("/dashboard/contests/create?new=true&contestType=cpm");
    } catch (error) {
      console.error("Error checking CPM contest access:", error);
      toast({
        title: "Unable to verify your plan",
        description: "Please try again. If needed, upgrade your plan in Billing.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingCpmAccess(false);
    }
  }, [isCheckingCpmAccess, router, toast]);

  const handleCreateMilestoneContest = useCallback(async () => {
    if (isCheckingCpmAccess) return;

    setIsCheckingCpmAccess(true);
    try {
      const response = await fetch(`/api/subscriptions/current?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subscription details");
      }

      const data = await response.json();
      const canCreatePaidContest = Boolean(
        data?.plan?.features?.contestTypes?.includes("cpm"),
      );

      if (!canCreatePaidContest) {
        setUpgradeFeatureName("Milestone Campaign");
        setShowCpmUpgradeModal(true);
        return;
      }

      router.push("/dashboard/contests/create?new=true&contestType=milestone");
    } catch (error) {
      console.error("Error checking milestone contest access:", error);
      toast({
        title: "Unable to verify your plan",
        description: "Please try again. If needed, upgrade your plan in Billing.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingCpmAccess(false);
    }
  }, [isCheckingCpmAccess, router, toast]);

  const handleCreateDualRewardsContest = useCallback(async () => {
    if (isCheckingCpmAccess) return;

    setIsCheckingCpmAccess(true);
    try {
      const response = await fetch(`/api/subscriptions/current?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subscription details");
      }

      const data = await response.json();
      const canCreatePaidContest = Boolean(
        data?.plan?.features?.contestTypes?.includes("cpm"),
      );

      if (!canCreatePaidContest) {
        setUpgradeFeatureName("Dual Rewards Campaign");
        setShowCpmUpgradeModal(true);
        return;
      }

      router.push("/dashboard/contests/create?new=true&contestType=dual_rewards");
    } catch (error) {
      console.error("Error checking dual rewards contest access:", error);
      toast({
        title: "Unable to verify your plan",
        description: "Please try again. If needed, upgrade your plan in Billing.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingCpmAccess(false);
    }
  }, [isCheckingCpmAccess, router, toast]);

  const contestTypeGuideCards = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card
        className={cn(
          "shadow-lg",
          isDark ? "border border-gray-700 bg-[#07031D]" : "border border-gray-200 bg-white",
        )}
      >
        <div
          className={cn(
            "aspect-[16/10] flex items-center justify-center overflow-hidden relative rounded-md border",
            isDark
              ? "bg-slate-900 border-gray-700"
              : "bg-slate-100 border-gray-100",
          )}
        >
          <img
            src="/images/leaderboard.avif"
            alt="Leaderboard campaign preview"
            className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          />
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CardTitle className={cn("text-base", isDark ? "text-white" : "text-gray-900")}>
                Leaderboard Campaign
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={cn("space-y-4 text-md leading-6", isDark ? "text-slate-300" : "text-slate-700")}>
            <div>
              <p className="mt-2">
                A Leaderboard Campaign is a performance-based campaign where
                creators compete to deliver the highest number of{" "}
                <strong>organic views</strong> for your brand&apos;s content.
                Creators are ranked on a live leaderboard, and top performers win
                prize money.
              </p>
            </div>

            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  1
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Create Your Contest
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Set your brief, start &amp; end dates, select the platform where creators should post, set the prize pool distribution according to each winning position.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  2
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Creators Participate
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Creators produce original content based on the campaign requirements and publish it on the selected social media platforms within the campaign duration.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  3
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Reward Top Performers
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Once the campaign ends, rankings are finalized and payouts are
                    made to creators based on their leaderboard position.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-purple-600 text-md rounded-lg font-medium text-white py-2 hover:bg-purple-700"
              onClick={() =>
                router.push(
                  "/dashboard/contests/create?new=true&contestType=leaderboard",
                )
              }
            >
              Create Leaderboard Campaign
            </button>
            <a
              href="https://calendly.com/guptavishesh2/30min"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "w-full text-md rounded-lg font-medium py-2 flex items-center justify-center gap-2 border transition-colors",
                isDark
                  ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50",
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              Need Help? Book a Call with Founder
            </a>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "shadow-lg",
          isDark ? "border border-gray-700 bg-[#07031D]" : "border border-gray-200 bg-white",
        )}
      >
        <div
          className={cn(
            "aspect-[16/10] flex items-center justify-center overflow-hidden relative rounded-md border",
            isDark ? "bg-slate-900 border-gray-700" : "bg-slate-100 border-gray-100",
          )}
        >
          <img
            src="/images/cpm-contest.avif"
            alt="CPM campaign preview"
            className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          />
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CardTitle className={cn("text-base", isDark ? "text-white" : "text-gray-900")}>CPM Campaign</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={cn("space-y-4 text-md leading-6", isDark ? "text-slate-300" : "text-slate-800")}>
            <div className="rounded-lg">
              <p className="mt-2">
                CPM-based campaigns pay creators purely based on the number of views they generate, at a fixed rate per 1,000 views. This gives you predictable, performance-based costs and allows you to scale content efficiently.
              </p>
            </div>

            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  1
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Create Your Contest
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Set your brief, start and end dates, total budget,
                    platform(s) for posting, and the{" "}
                    <strong>CPM rate</strong> (payment per 1,000 views).
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  2
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Creators Participate
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Creators produce original content based on the campaign requirements and publish it on the selected social media platforms within the campaign duration.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  3
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Views Determine Payout
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Payouts are calculated based on the number of views (per
                    thousand views) each creator generates.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-purple-600 text-md rounded-lg font-medium text-white py-2 hover:bg-purple-700"
              onClick={handleCreateCpmContest}
              disabled={isCheckingCpmAccess}
            >
              Create CPM Campaign
            </button>
            <a
              href="https://calendly.com/guptavishesh2/30min"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "w-full text-md rounded-lg font-medium py-2 flex items-center justify-center gap-2 border transition-colors",
                isDark
                  ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50",
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              Need Help? Book a Call with Founder
            </a>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "shadow-lg",
          isDark ? "border border-gray-700 bg-[#07031D]" : "border border-gray-200 bg-white",
        )}
      >
        <div
          className={cn(
            "aspect-[16/10] flex items-center justify-center overflow-hidden relative rounded-md border",
            isDark ? "bg-slate-900 border-gray-700" : "bg-slate-100 border-gray-100",
          )}
        >
          <img
            src="/images/Milestones.avif"
            alt="Milestone campaign preview"
            className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          />
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CardTitle className={cn("text-base", isDark ? "text-white" : "text-gray-900")}>Milestone Campaign</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={cn("space-y-4 text-md leading-6", isDark ? "text-slate-300" : "text-slate-800")}>
            <div className="rounded-lg">
              <p className="mt-2">
                Milestone campaigns reward creators as they reach specific view targets. This provides guaranteed payouts for creators and guaranteed results for your brand, with full control over the maximum budget.
              </p>
            </div>

            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  1
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Define Milestones
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Set specific view targets (e.g., 10K, 50K, 100K) and the payout amount for each. You can also set a cap on the number of winners per milestone.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  2
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Creators Participate
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Creators produce and publish content. As their videos gain organic views, our system tracks their progress towards the milestones you set.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  3
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Payouts Based on Achieved Milestones
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    When a creator reaches a milestone, the payout is calculated and credited based only the milestone they have actually achieved for that submission.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-purple-600 text-md rounded-lg font-medium text-white py-2 hover:bg-purple-700"
              onClick={handleCreateMilestoneContest}
              disabled={isCheckingCpmAccess}
            >
              Create Milestone Campaign
            </button>
            <a
              href="https://calendly.com/guptavishesh2/30min"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "w-full text-md rounded-lg font-medium py-2 flex items-center justify-center gap-2 border transition-colors",
                isDark
                  ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50",
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              Need Help? Book a Call with Founder
            </a>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "shadow-lg",
          isDark ? "border border-gray-700 bg-[#07031D]" : "border border-gray-200 bg-white",
        )}
      >
        <div
          className={cn(
            "aspect-[16/10] flex items-center justify-center overflow-hidden relative rounded-md border",
            isDark ? "bg-slate-900 border-gray-700" : "bg-slate-100 border-gray-100",
          )}
        >
          <img
            src="/images/dual-rewards.avif"
            alt="Dual rewards campaign preview"
            className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          />
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CardTitle className={cn("text-base", isDark ? "text-white" : "text-gray-900")}>Dual Rewards Campaign</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={cn("space-y-4 text-md leading-6", isDark ? "text-slate-300" : "text-slate-800")}>
            <div className="rounded-lg">
              <p className="mt-2">
                Dual Rewards combines both payout models in one campaign: creators
                earn milestone-based rewards for hitting view targets and CPM-based
                rewards from ongoing performance, all under a unified budget pool.
              </p>
            </div>

            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  1
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Configure Combined Rewards
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Define milestone tiers and set the CPM rate in the same contest
                    setup so both reward tracks run together.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  2
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Creators Publish and Grow
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Creators submit content and continue building organic views.
                    Their progress contributes to both milestone eligibility and
                    CPM-based earnings.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark ? "border-gray-700 bg-[#0b1020]" : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-purple-900/60 text-purple-200" : "bg-purple-100 text-purple-700",
                  )}
                >
                  3
                </span>
                <div>
                  <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>
                    Reward Through Both Paths
                  </p>
                  <p className={cn("mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                    Payouts are calculated from achieved milestones and view-based
                    CPM performance, giving creators a blended earning model in one
                    campaign.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-purple-600 text-md rounded-lg font-medium text-white py-2 hover:bg-purple-700"
              onClick={handleCreateDualRewardsContest}
              disabled={isCheckingCpmAccess}
            >
              Create Dual Rewards Campaign
            </button>
            <a
              href="https://calendly.com/guptavishesh2/30min"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "w-full text-md rounded-lg font-medium py-2 flex items-center justify-center gap-2 border transition-colors",
                isDark
                  ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50",
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              Need Help? Book a Call with Founder
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="w-full no-theme-transition">
      <PaidPlanUpgradeModal
        isOpen={showCpmUpgradeModal}
        onClose={() => setShowCpmUpgradeModal(false)}
        featureName={upgradeFeatureName}
      />
      {hasCreatedContests ? (
        <>
          {/* Header with filters */}
          <div className="flex flex-col gap-4 mb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch w-full min-w-0 lg:max-w-xl xl:max-w-2xl">
              <div className="relative flex-1 min-w-0">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                  aria-hidden
                />
                {searchQuery.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-md"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <Input
                  type="text"
                  role="searchbox"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="Search by title…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim() !== "") {
                      e.preventDefault();
                      brandContestsResultsRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }
                  }}
                  className={cn(
                    "pl-10 h-11 w-full text-sm sm:text-base border rounded-xl shadow-sm",
                    searchQuery.trim() !== "" && "pr-10",
                    isDark
                      ? "border-gray-600 bg-[#020817] text-white placeholder:text-gray-500"
                      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-500",
                  )}
                />
              </div>
              {searchQuery.trim() !== "" && (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-11 w-full sm:w-auto shrink-0 rounded-xl font-semibold text-sm",
                    isDark
                      ? "border-violet-400/60 text-violet-100 bg-transparent hover:bg-white/10 hover:text-white"
                      : "border-[#7F39EC] text-[#7F39EC] bg-[#D9C0FF26] hover:bg-[#D9C0FF61]",
                  )}
                  onClick={() =>
                    brandContestsResultsRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                >
                  Search
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between lg:gap-4">
              <div
                className={cn(
                  "w-full min-w-0 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 sm:overflow-visible",
                  "[scrollbar-width:thin]",
                )}
              >
                <div
                  role="group"
                  aria-label="Contest format"
                  className={cn(
                    "flex w-full sm:w-auto rounded-xl border p-1 gap-1 min-h-[2.75rem] box-border",
                    isDark
                      ? "border-gray-600 bg-[#020817]/60"
                      : "border-gray-300 bg-gray-50/90",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setContestFormatFilter("all")}
                    title="All campaigns"
                    className={cn(
                      "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[2.5rem] transition-colors",
                      contestFormatFilter === "all"
                        ? "bg-[#7F39EC] text-white shadow-sm"
                        : isDark
                          ? "text-gray-300 hover:text-white hover:bg-white/10"
                          : "text-gray-700 hover:bg-white hover:text-gray-900",
                    )}
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0 opacity-90" />
                    <span>All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContestFormatFilter("text_image")}
                    title="Text and image campaigns"
                    className={cn(
                      "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[2.5rem] transition-colors",
                      contestFormatFilter === "text_image"
                        ? "bg-[#7F39EC] text-white shadow-sm"
                        : isDark
                          ? "text-gray-300 hover:text-white hover:bg-white/10"
                          : "text-gray-700 hover:bg-white hover:text-gray-900",
                    )}
                  >
                    <FileText className="h-4 w-4 shrink-0 opacity-90" />
                    <span>Text & image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContestFormatFilter("video")}
                    title="Video campaigns"
                    className={cn(
                      "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[2.5rem] transition-colors",
                      contestFormatFilter === "video"
                        ? "bg-[#7F39EC] text-white shadow-sm"
                        : isDark
                          ? "text-gray-300 hover:text-white hover:bg-white/10"
                          : "text-gray-700 hover:bg-white hover:text-gray-900",
                    )}
                  >
                    <PlayCircle className="h-4 w-4 shrink-0 opacity-90" />
                    <span>Video</span>
                  </button>
                </div>
              </div>

              <div
                role="group"
                aria-label="Layout"
                className={cn(
                  "hidden lg:flex w-full sm:w-auto shrink-0 rounded-xl border p-1 gap-1 min-h-[2.75rem] items-stretch box-border",
                  isDark
                    ? "border-gray-600 bg-[#020817]/60"
                    : "border-gray-300 bg-gray-50/90",
                )}
              >
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                  className={cn(
                    "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[2.5rem] transition-colors min-w-[5.5rem]",
                    displayViewMode === "grid"
                      ? "bg-[#7F39EC] text-white shadow-sm"
                      : isDark
                        ? "text-gray-300 hover:text-white hover:bg-white/10"
                        : "text-gray-700 hover:bg-white hover:text-gray-900",
                  )}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0 opacity-90" />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  title="List view"
                  className={cn(
                    "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap min-h-[2.5rem] transition-colors min-w-[5.5rem]",
                    displayViewMode === "list"
                      ? "bg-[#7F39EC] text-white shadow-sm"
                      : isDark
                        ? "text-gray-300 hover:text-white hover:bg-white/10"
                        : "text-gray-700 hover:bg-white hover:text-gray-900",
                  )}
                >
                  <List className="h-4 w-4 shrink-0 opacity-90" />
                  <span>List</span>
                </button>
              </div>
            </div>
            {/* Sort, platform, type — workflow status is in tabs below */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 w-full">
              <Select
                value={sortOption}
                onValueChange={(value) =>
                  setSortOption(value as SortOptionType)
                }
              >
                <SelectTrigger className="w-full min-w-0 border border-gray-400 rounded-xl">
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
                  <SelectItem isDark={isDark} value="budget_remaining_desc">
                    Budget Left: Most
                  </SelectItem>
                  <SelectItem isDark={isDark} value="budget_remaining_asc">
                    Budget Left: Least
                  </SelectItem>
                  <SelectItem isDark={isDark} value="budget_used_desc">
                    Budget Used: Most
                  </SelectItem>
                  <SelectItem isDark={isDark} value="budget_used_asc">
                    Budget Used: Least
                  </SelectItem>
                  <SelectItem isDark={isDark} value="approval_rate_desc">
                    Approval Rate: High
                  </SelectItem>
                  <SelectItem isDark={isDark} value="approval_rate_asc">
                    Approval Rate: Low
                  </SelectItem>
                  <SelectItem isDark={isDark} value="views_desc">
                    Views: High
                  </SelectItem>
                  <SelectItem isDark={isDark} value="views_asc">
                    Views: Low
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
                <SelectTrigger className="w-full min-w-0 border border-gray-400 rounded-xl">
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

              {/* Campaign Type Filter */}
              <Select
                value={contestTypeFilter}
                onValueChange={setContestTypeFilter}
              >
                <SelectTrigger className="w-full min-w-0 border border-gray-400 rounded-xl">
                  <SelectValue placeholder="Campaign Type" />
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
                  <SelectItem isDark={isDark} value="milestone">
                    Milestone
                  </SelectItem>
                  <SelectItem isDark={isDark} value="dual_rewards">
                    Dual Rewards
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status — workflow row; payout phases only for All / Ended */}
          <div className="w-full space-y-4 mb-8">
            <div className="w-full overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] scrollbar-hide">
              <EnhancedTabs
                tabs={brandPipelineTabs}
                activeTab={
                  brandPipelineTabs.some((t) => t.id === selectedTab)
                    ? selectedTab
                    : ""
                }
                onTabChange={(id) => setSelectedTab(id)}
                isDark={isDark}
                light={!isDark}
                fillWidth={false}
                className="shadow-sm"
              />
            </div>
            {showPostContestPipeline ? (
              <div
                className={cn(
                  "rounded-2xl border p-3 sm:p-4 space-y-3 transition-colors",
                  isDark
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-gray-200/90 bg-gray-50/70",
                )}
              >
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <p
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      isDark ? "text-gray-400" : "text-gray-500",
                    )}
                  >
                    After contest ends
                  </p>
                  <p
                    className={cn(
                      "text-xs leading-snug max-w-xl",
                      isDark ? "text-gray-500" : "text-gray-600",
                    )}
                  >
                    Narrow by payout step — only applies to{" "}
                    {selectedTab === "all" ? (
                      <>
                        <span className="font-medium text-[#7F39EC]">
                          ended
                        </span>{" "}
                        contests in this list.
                      </>
                    ) : (
                      <>your ended campaigns.</>
                    )}
                  </p>
                </div>
                <div className="w-full overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] scrollbar-hide">
                  <EnhancedTabs
                    tabs={brandPostContestTabs}
                    activeTab={postContestPhaseFilter}
                    onTabChange={(id) =>
                      setPostContestPhaseFilter(id as BrandPostPhaseId)
                    }
                    isDark={isDark}
                    light={!isDark}
                    fillWidth={false}
                    className="shadow-sm"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div
            ref={brandContestsResultsRef}
            id="brand-contests-results"
            className="scroll-mt-4 mt-4"
          >
            {displayViewMode === "grid" ? (
              <div
                className="grid gap-6"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                }}
              >
                {total > 0 ? (
                  paginatedContests.map((contest) => renderContestCard(contest))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <h3
                      className="text-lg font-semibold"
                      style={{
                        color: isDark ? "white" : "black",
                        transition: "none",
                      }}
                    >
                      No Campaigns Found
                    </h3>
                    <p
                      className="mt-2"
                      style={{
                        color: isDark ? "#94a3b8" : "#64748b",
                        transition: "none",
                      }}
                    >
                      {platformFilter !== "all" ||
                        contestTypeFilter !== "all" ||
                        searchQuery.trim() !== "" ||
                        contestFormatFilter !== "all"
                        ? `No contests match the current filters for ${brandListFilterPhrase(selectedTab, postContestPhaseFilter)}.`
                        : `No contests found for ${brandListFilterPhrase(selectedTab, postContestPhaseFilter)}.`}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {total > 0 ? (
                  paginatedContests.map((contest) =>
                    renderContestListItem(contest),
                  )
                ) : (
                  <div className="text-center py-12">
                    <h3
                      className="text-lg font-semibold"
                      style={{
                        color: isDark ? "white" : "black",
                        transition: "none",
                      }}
                    >
                      No Campaigns Found
                    </h3>
                    <p
                      className="mt-2"
                      style={{
                        color: isDark ? "#94a3b8" : "#64748b",
                        transition: "none",
                      }}
                    >
                      {platformFilter !== "all" ||
                        contestTypeFilter !== "all" ||
                        searchQuery.trim() !== "" ||
                        contestFormatFilter !== "all"
                        ? `No contests match the current filters for ${brandListFilterPhrase(selectedTab, postContestPhaseFilter)}.`
                        : `No contests found for ${brandListFilterPhrase(selectedTab, postContestPhaseFilter)}.`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {total > 0 && (
              <div className="mt-6 flex flex-col gap-2 items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <div
                    className="text-sm"
                    style={{
                      color: isDark ? "#cbd5e1" : "#4b5563",
                      transition: "none",
                    }}
                  >
                    {(() => {
                      const startItem = (page - 1) * limit + 1;
                      const endItem = Math.min(page * limit, total);
                      return `Showing ${startItem}-${endItem} of ${total} contests`;
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm"
                      style={{
                        color: isDark ? "#cbd5e1" : "#4b5563",
                        transition: "none",
                      }}
                    >
                      Show:
                    </span>
                    <Select
                      value={limit.toString()}
                      onValueChange={(value) => {
                        const newLimit = parseInt(value, 10);
                        setLimit(newLimit);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          "w-20",
                          isDark && "border border-gray-600",
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        isDark={isDark}
                        className={cn(
                          isDark &&
                          "border-gray-600 bg-[#07031D] text-white",
                        )}
                      >
                        {[9, 15, 21, 30].map((size) => (
                          <SelectItem
                            isDark={isDark}
                            key={size}
                            value={size.toString()}
                            className={cn(
                              isDark &&
                              "bg-[#07031D] text-white focus:bg-slate-800 data-[state=checked]:bg-slate-700",
                            )}
                          >
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span
                      className="text-sm"
                      style={{
                        color: isDark ? "#cbd5e1" : "#4b5563",
                        transition: "none",
                      }}
                    >
                      per page
                    </span>
                  </div>
                </div>
                {totalPages > 1 && (
                  <PaginationControls
                    page={page}
                    limit={limit}
                    total={total}
                    totalPages={totalPages}
                    hasNextPage={hasNextPage}
                    hasPreviousPage={hasPreviousPage}
                    onPageChange={setPage}
                    onLimitChange={setLimit}
                    loading={false}
                    isDark={isDark}
                    showResultInfo={false}
                    showPageSizeSelector={false}
                    showEdgeButtons={false}
                    showPrevNextButtons={true}
                    pageSizeOptions={[9, 15, 21, 30]}
                  />
                )}
              </div>
            )}
          </div>
          {shouldShowContestTypeGuide && (
            <div className="mt-10">{contestTypeGuideCards}</div>
          )}
        </>
      ) : (
        <div className="py-10">
          {contestTypeGuideCards}
        </div>
      )}
    </div>
  );
}
