"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { DuplicateCampaignDialog } from "@/components/campaign-duplicate/DuplicateCampaignDialog";
import { cn } from "@/lib/utils";
import { isModifiedLinkClick } from "@/lib/navigation-link-utils";
import { KNOWN_POST_CONTEST_STATUSES } from "@/lib/contest-ended-phase-display";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { isCpmContestType } from "@/lib/contest-type";
import { getPoolBudgetSpentCentsForDisplay } from "@/lib/contest-budget-tile-metrics";
import {
  formatContestListCpmRatesText,
  resolveContestPlatformCpmRates,
  resolveContestPoolBudgetCents,
  resolveLeaderboardFlatFeeBonusBudgetCents,
} from "@/lib/video-platform-campaigns";
import { BrandCampaignCard } from "@/components/campaign-list/BrandCampaignCard";
import { BrandCampaignFilters } from "@/components/campaign-list/BrandCampaignFilters";
import { CampaignListPagination } from "@/components/campaign-list/CampaignListPagination";
import { useToast } from "@/hooks/use-toast";
import { PaidPlanUpgradeModal } from "@/components/PaidPlanUpgradeModal";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
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
import { useServerCampaignList } from "@/lib/use-server-campaign-list";
import {
  CAMPAIGN_FILTER_PLATFORMS,
  expandAvailableCampaignPlatforms,
  isAllCampaignPlatformFilter,
  normalizeCampaignPlatformFilter,
  type CampaignFilterPlatform,
} from "@/lib/campaign-platform-filter";
// Define the type for a campaign
type Contest = {
  id: string;
  title: string | null;
  access_mode?: string | null;
  access_list_skips_requirements?: boolean | null;
  /** Restricted campaigns: added by the list API after its cache. */
  applications_open?: boolean | null;
  pending_applications?: number | null;
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
  trust_score?: number | null;
  trust_number?: number | null;
  min_avg_quality_score?: number | null;
  min_best_quality_score?: number | null;
  min_quality_score?: number | null;
  min_platform_earnings?: number | null;
  min_platform_views?: number | null;
  // Twitter participants data (should be populated from twitter_campaign_metrics)
  twitter_participants_count?: number | null;
  twitter_max_participants?: number | null;
};

interface ContestListClientProps {
  initialContests: Contest[];
  /** Total matching rows for the initial SSR page (server-sorted). */
  initialTotal?: number;
  initialTabCounts?: {
    all: number;
    draft: number;
    pending_approval: number;
    ready: number;
    upcoming: number;
    live: number;
    ended: number;
    rejected: number;
  };
  initialPostPhaseCounts?: {
    post_pending_review: number;
    post_in_review: number;
    post_payment_pending: number;
    post_paid: number;
  };
  initialAvailablePlatforms?: string[];
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
        !s || !KNOWN_POST_CONTEST_STATUSES.has(s) || s === "pending_review"
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
  if ((tab === "all" || tab === "ended") && postPhase !== "all") {
    return `${brandTabFilterPhrase(tab)} ? ${brandPostPhasePhrase(postPhase)}`;
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
  // Dollar labels use actual spend (may exceed reserved pool).
  // Bar fill is capped at 100% via Math.min in the width style callers.
  const percentage = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
  const remaining = Math.max(totalBudget - spent, 0);

  return { spent, percentage, remaining };
};

const getContestTypeLabel = (contestType: string | null | undefined) => {
  if (contestType === "cpm") return "CPM Based";
  if (contestType === "leaderboard") return "Leaderboard";
  if (contestType === "milestone") return "Milestone";
  if (contestType === "dual_rewards") return "Dual Rewards";
  if (!contestType) return "N/A";
  return contestType.charAt(0).toUpperCase() + contestType.slice(1);
};

const getContestBudgetSpentForTracker = (contest: Contest): number =>
  getPoolBudgetSpentCentsForDisplay({
    contest_type: contest.contest_type,
    post_contest_status: contest.post_contest_status,
    contest_based_details: contest.contest_based_details,
    platform: contest.platform,
  });

const getContestListPoolBudgetCents = (contest: Contest): number =>
  resolveContestPoolBudgetCents(
    contest.contest_type,
    contest.contest_based_details,
    contest.platform,
  );

const getContestListLeaderboardBonusBudgetCents = (contest: Contest): number =>
  contest.contest_type === "leaderboard"
    ? resolveLeaderboardFlatFeeBonusBudgetCents(
        contest.contest_based_details as unknown as Record<string, unknown> | null,
        contest.platform,
      )
    : 0;

const isTwitterLikePlatform = (platform?: string | null) => {
  const lower = platform?.toLowerCase();
  return lower === "twitter" || lower === "x";
};

const getContestListCpmRateRow = (
  contest: Contest,
): { label: string; value: string } | null => {
  if (!isCpmContestType(contest.contest_type)) return null;

  if (isTwitterLikePlatform(contest.platform)) {
    const rate =
      contest.contest_based_details?.cpm_contest?.cpm_rate_usd;
    if (rate == null) return null;
    return {
      label: "Points Rate: ",
      value: `${formatMoney(rate * 100)} / 1k points`,
    };
  }

  const rates = resolveContestPlatformCpmRates(
    contest.contest_based_details as Record<string, unknown> | null | undefined,
    contest.platform,
  );
  const value = formatContestListCpmRatesText(rates, formatMoney);
  if (!value) return null;
  return { label: "CPM Rate: ", value };
};

const getContestPrimaryFinancialText = (contest: Contest): string => {
  if (contest.contest_type === "leaderboard") {
    return `Prize: ${formatMoney(
      contest.contest_based_details?.leaderboard_contest?.total_prize || 0,
    )}`;
  }
  if (contest.contest_type === "milestone") {
    return `Budget: ${formatMoney(getContestListPoolBudgetCents(contest))}`;
  }
  if (
    contest.contest_type === "cpm" ||
    contest.contest_type === "dual_rewards"
  ) {
    return `Budget: ${formatMoney(getContestListPoolBudgetCents(contest))}`;
  }
  return `Budget: ${formatMoney(0)}`;
};

export function ContestListClient({
  initialContests,
  initialTotal,
  initialTabCounts,
  initialPostPhaseCounts,
  initialAvailablePlatforms,
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
  const pageSizeScrollAnchorRef = useRef<{
    distanceFromBottom: number;
    previousContests: Contest[];
    targetLimit: number;
  } | null>(null);

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
    setPlatformFilter(normalizeCampaignPlatformFilter(stored.platformFilter));
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
  }, [filtersHydrated, selectedTab, contestListFiltersStorageKey]);

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

  // Server-paginated list: filter ? sort (full set) ? page. Do not re-sort page rows.
  const {
    contests: serverContests,
    total: serverTotal,
    tabCounts: serverTabCounts,
    postPhaseCounts: serverPostPhaseCounts,
    availablePlatforms: serverAvailablePlatforms,
    loading: listLoading,
    isValidating: listValidating,
    error: listError,
    refresh: refreshServerList,
    retry: retryServerList,
  } = useServerCampaignList<Contest>(
    {
      isAdminView,
      tab: selectedTab,
      sort: sortOption,
      page,
      limit,
      platform: platformFilter,
      contestType: contestTypeFilter,
      contestFormat: contestFormatFilter,
      postContestPhase: showPostContestPipeline
        ? postContestPhaseFilter
        : "all",
      search: searchQuery,
      enabled: filtersHydrated,
    },
    {
      contests: initialContests,
      total: initialTotal ?? initialContests.length,
      tabCounts: initialTabCounts,
      postPhaseCounts: initialPostPhaseCounts,
      availablePlatforms: initialAvailablePlatforms,
    },
  );

  useEffect(() => {
    setContests(serverContests);
  }, [serverContests]);

  // Loading states for buttons
  const [loadingButtons, setLoadingButtons] = useState<{
    [key: string]: {
      edit?: boolean;
      editDates?: boolean;
    };
  }>({});

  // "Duplicate" on a card opens the copy dialog for that campaign.
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);

  // Helper functions for loading states
  const setButtonLoading = (
    contestId: string,
    action: "edit" | "editDates",
    isLoading: boolean,
  ) => {
    setLoadingButtons((prev) => ({
      ...prev,
      [contestId]: {
        ...prev[contestId],
        [action]: isLoading,
      },
    }));
  };

  const fetchLatestContests = useCallback(async () => {
    await refreshServerList();
  }, [refreshServerList]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // SSR seeding lives in useServerCampaignList (only when query matches SSR defaults).
  // Do not re-apply initialContests here ? that races filter hydration and page 2+.

  useEffect(() => {
    const handleContestRefresh = async () => {
      console.log("[ContestListClient] Handling contest refresh event...");
      await refreshServerList();
    };

    window.addEventListener("contests:refresh", handleContestRefresh);
    return () => {
      window.removeEventListener("contests:refresh", handleContestRefresh);
    };
  }, [refreshServerList]);

  const postPhaseCounts = serverPostPhaseCounts;
  const platformFilterOptions = useMemo(() => {
    const expanded = expandAvailableCampaignPlatforms(
      serverAvailablePlatforms,
    ).filter((platform): platform is CampaignFilterPlatform => platform !== "all");
    return expanded.length > 0 ? expanded : [...CAMPAIGN_FILTER_PLATFORMS];
  }, [serverAvailablePlatforms]);

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

  const renderContestCard = (
    contest: Contest,
    layout: "grid" | "list" = "grid",
  ) => (
    <BrandCampaignCard
      key={contest.id}
      contest={contest}
      isDark={isDark}
      layout={layout}
      detailHref={getContestDetailHref(contest.id)}
      navigating={navigatingContestId === contest.id}
      onDetailClick={(event) => handleContestDetailLinkClick(contest.id, event)}
      onDuplicate={() => setDuplicateSourceId(contest.id)}
      canPublish={canPublishContestFromList(
        contest.moderation_status,
        !!isAdminView,
      )}
      editLoading={!!loadingButtons[contest.id]?.edit}
      editDatesLoading={!!loadingButtons[contest.id]?.editDates}
      onEdit={() => {
        setButtonLoading(contest.id, "edit", true);
        router.push(`/dashboard/contests/${contest.id}/edit`);
      }}
      onEditDates={() => {
        setButtonLoading(contest.id, "editDates", true);
        router.push(`/dashboard/contests/${contest.id}/edit?dates=true`);
      }}
      onPublish={() => {
        void (async () => {
          try {
            const response = await fetch(`/api/contests/${contest.id}/publish`, {
              method: "POST",
            });
            if (response.ok) {
              window.location.reload();
            } else {
              const error = await response.json();
              alert(error.error || "Failed to publish campaign");
            }
          } catch {
            alert("Failed to publish campaign");
          }
        })();
      }}
    />
  );

  // Server already returned the sorted page ? do not re-sort or re-slice.
  const paginatedContests = contests;

  useEffect(() => {
    if (!filtersHydrated) return;
    setPage(1);
  }, [
    filtersHydrated,
    selectedTab,
    postContestPhaseFilter,
    platformFilter,
    contestTypeFilter,
    contestFormatFilter,
    sortOption,
    searchQuery,
  ]);

  const total = serverTotal;
  const campaignResultStart = total > 0 ? (page - 1) * limit + 1 : 0;
  const campaignResultEnd = total > 0 ? Math.min(page * limit, total) : 0;
  const campaignResultSummary =
    total > 0
      ? `Showing ${campaignResultStart}-${campaignResultEnd} of ${total} ${total === 1 ? "campaign" : "campaigns"}`
      : "Showing 0 campaigns";

  const handleCampaignPageSizeChange = useCallback(
    (nextLimit: number) => {
      if (nextLimit === limit) return;
      const documentHeight = document.documentElement.scrollHeight;
      pageSizeScrollAnchorRef.current = {
        distanceFromBottom: Math.max(
          0,
          documentHeight - (window.scrollY + window.innerHeight),
        ),
        previousContests: contests,
        targetLimit: nextLimit,
      };
      setLimit(nextLimit);
      setPage(1);
    },
    [contests, limit],
  );

  useLayoutEffect(() => {
    const anchor = pageSizeScrollAnchorRef.current;
    if (!anchor || anchor.targetLimit !== limit) return;

    const restoreBottomDistance = () => {
      const targetTop = Math.max(
        0,
        document.documentElement.scrollHeight -
          window.innerHeight -
          anchor.distanceFromBottom,
      );
      if (Math.abs(window.scrollY - targetTop) > 1) {
        window.scrollTo({ top: targetTop, behavior: "auto" });
      }
    };

    restoreBottomDistance();
    const replacementPageRendered = contests !== anchor.previousContests;
    if (replacementPageRendered && !listLoading && !listValidating) {
      pageSizeScrollAnchorRef.current = null;
      requestAnimationFrame(restoreBottomDistance);
    }
  }, [contests, limit, listLoading, listValidating, total]);
  const hasCreatedContests = serverTabCounts.all > 0;
  const hasPendingApprovalOrPublishedContest =
    serverTabCounts.pending_approval +
      serverTabCounts.ready +
      serverTabCounts.upcoming +
      serverTabCounts.live +
      serverTabCounts.ended +
      serverTabCounts.rejected >
    0;
  const shouldShowContestTypeGuide = !hasPendingApprovalOrPublishedContest;

  const handleCreateCpmContest = useCallback(async () => {
    if (isCheckingCpmAccess) return;

    setIsCheckingCpmAccess(true);
    try {
      const response = await fetch(
        `/api/subscriptions/current?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

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
        description:
          "Please try again. If needed, upgrade your plan in Billing.",
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
      const response = await fetch(
        `/api/subscriptions/current?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

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
        description:
          "Please try again. If needed, upgrade your plan in Billing.",
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
      const response = await fetch(
        `/api/subscriptions/current?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

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

      router.push(
        "/dashboard/contests/create?new=true&contestType=dual_rewards",
      );
    } catch (error) {
      console.error("Error checking dual rewards contest access:", error);
      toast({
        title: "Unable to verify your plan",
        description:
          "Please try again. If needed, upgrade your plan in Billing.",
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
          isDark
            ? "border border-gray-700 bg-[#07031D]"
            : "border border-gray-200 bg-white",
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
              <CardTitle
                className={cn(
                  "text-base",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Leaderboard Campaign
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            className={cn(
              "space-y-4 text-md leading-6",
              isDark ? "text-slate-300" : "text-slate-700",
            )}
          >
            <div>
              <p className="mt-2">
                A Leaderboard Campaign is a performance-based campaign where
                creators compete to deliver the highest number of{" "}
                <strong>organic views</strong> for your brand&apos;s content.
                Creators are ranked on a live leaderboard, and top performers
                win prize money.
              </p>
            </div>

            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  1
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Create Your Contest
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Set your brief, start &amp; end dates, select the platform
                    where creators should post, set the prize pool distribution
                    according to each winning position.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  2
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Creators Participate
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Creators produce original content based on the campaign
                    requirements and publish it on the selected social media
                    platforms within the campaign duration.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  3
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Reward Top Performers
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Once the campaign ends, rankings are finalized and payouts
                    are made to creators based on their leaderboard position.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-[#1a1a1a] text-md rounded-lg font-semibold text-white py-2.5 hover:bg-black dark:bg-white dark:text-[#1a1a1a] dark:hover:bg-white/90 shadow-sm transition-colors"
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Need Help? Book a Call with Founder
            </a>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "shadow-lg",
          isDark
            ? "border border-gray-700 bg-[#07031D]"
            : "border border-gray-200 bg-white",
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
            src="/images/cpm-contest.avif"
            alt="CPM campaign preview"
            className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          />
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CardTitle
                className={cn(
                  "text-base",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                CPM Campaign
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            className={cn(
              "space-y-4 text-md leading-6",
              isDark ? "text-slate-300" : "text-slate-800",
            )}
          >
            <div className="rounded-lg">
              <p className="mt-2">
                CPM-based campaigns pay creators purely based on the number of
                views they generate, at a fixed rate per 1,000 views. This gives
                you predictable, performance-based costs and allows you to scale
                content efficiently.
              </p>
            </div>

            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  1
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Create Your Contest
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Set your brief, start and end dates, total budget,
                    platform(s) for posting, and the <strong>CPM rate</strong>{" "}
                    (payment per 1,000 views).
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  2
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Creators Participate
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Creators produce original content based on the campaign
                    requirements and publish it on the selected social media
                    platforms within the campaign duration.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  3
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Views Determine Payout
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Payouts are calculated based on the number of views (per
                    thousand views) each creator generates.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-[#1a1a1a] text-md rounded-lg font-semibold text-white py-2.5 hover:bg-black dark:bg-white dark:text-[#1a1a1a] dark:hover:bg-white/90 shadow-sm transition-colors"
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Need Help? Book a Call with Founder
            </a>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "shadow-lg",
          isDark
            ? "border border-gray-700 bg-[#07031D]"
            : "border border-gray-200 bg-white",
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
            src="/images/Milestones.avif"
            alt="Milestone campaign preview"
            className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          />
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CardTitle
                className={cn(
                  "text-base",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Milestone Campaign
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            className={cn(
              "space-y-4 text-md leading-6",
              isDark ? "text-slate-300" : "text-slate-800",
            )}
          >
            <div className="rounded-lg">
              <p className="mt-2">
                Milestone campaigns reward creators as they reach specific view
                targets. This provides guaranteed payouts for creators and
                guaranteed results for your brand, with full control over the
                maximum budget.
              </p>
            </div>

            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  1
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Define Milestones
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Set specific view targets (e.g., 10K, 50K, 100K) and the
                    payout amount for each. You can also set a cap on the number
                    of winners per milestone.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  2
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Creators Participate
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Creators produce and publish content. As their videos gain
                    organic views, our system tracks their progress towards the
                    milestones you set.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  3
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Payouts Based on Achieved Milestones
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    When a creator reaches a milestone, the payout is calculated
                    and credited based only the milestone they have actually
                    achieved for that submission.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-[#1a1a1a] text-md rounded-lg font-semibold text-white py-2.5 hover:bg-black dark:bg-white dark:text-[#1a1a1a] dark:hover:bg-white/90 shadow-sm transition-colors"
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Need Help? Book a Call with Founder
            </a>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "shadow-lg",
          isDark
            ? "border border-gray-700 bg-[#07031D]"
            : "border border-gray-200 bg-white",
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
            src="/images/dual-rewards.avif"
            alt="Dual rewards campaign preview"
            className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          />
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CardTitle
                className={cn(
                  "text-base",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Dual Rewards Campaign
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            className={cn(
              "space-y-4 text-md leading-6",
              isDark ? "text-slate-300" : "text-slate-800",
            )}
          >
            <div className="rounded-lg">
              <p className="mt-2">
                Dual Rewards combines both payout models in one campaign:
                creators earn milestone-based rewards for hitting view targets
                and CPM-based rewards from ongoing performance, all under a
                unified budget pool.
              </p>
            </div>

            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  1
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Configure Combined Rewards
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Define milestone tiers and set the CPM rate in the same
                    contest setup so both reward tracks run together.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  2
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Creators Publish and Grow
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Creators submit content and continue building organic views.
                    Their progress contributes to both milestone eligibility and
                    CPM-based earnings.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
                  isDark
                    ? "border-gray-700 bg-[#0b1020]"
                    : "border-slate-200 bg-white",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  3
                </span>
                <div>
                  <p
                    className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    Reward Through Both Paths
                  </p>
                  <p
                    className={cn(
                      "mt-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    Payouts are calculated from achieved milestones and
                    view-based CPM performance, giving creators a blended
                    earning model in one campaign.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-[#1a1a1a] text-md rounded-lg font-semibold text-white py-2.5 hover:bg-black dark:bg-white dark:text-[#1a1a1a] dark:hover:bg-white/90 shadow-sm transition-colors"
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
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
      <DuplicateCampaignDialog
        open={duplicateSourceId !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicateSourceId(null);
        }}
        isAdmin={!!isAdminView}
        sourceContestId={duplicateSourceId}
        allowChangeTarget={!!isAdminView}
      />
      {hasCreatedContests ? (
        <>
          <BrandCampaignFilters
            isDark={isDark}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearchSubmit={() =>
              brandContestsResultsRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
            contestFormatFilter={contestFormatFilter}
            onContestFormatChange={setContestFormatFilter}
            displayViewMode={displayViewMode}
            layoutAllowsListView={layoutAllowsListView}
            onViewModeChange={(mode) => setViewMode(mode)}
            sortOption={sortOption}
            onSortChange={(value) => setSortOption(value as SortOptionType)}
            platformFilter={platformFilter}
            onPlatformFilterChange={setPlatformFilter}
            platformOptions={platformFilterOptions}
            contestTypeFilter={contestTypeFilter}
            onContestTypeChange={setContestTypeFilter}
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            tabCounts={serverTabCounts}
            showPostContestPipeline={showPostContestPipeline}
            postContestPhaseFilter={postContestPhaseFilter}
            onPostPhaseChange={(phase) =>
              setPostContestPhaseFilter(phase as BrandPostPhaseId)
            }
            phaseCounts={postPhaseCounts}
          />

          <div
            ref={brandContestsResultsRef}
            id="brand-contests-results"
            className="scroll-mt-4 mt-4"
            aria-busy={listLoading || listValidating}
          >
            <div
              className="mb-4 flex min-h-7 items-center justify-end"
              aria-live="polite"
            >
              <span
                className={cn(
                  "rounded-full border px-[11px] py-[5px] text-xs font-medium",
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-neutral-300"
                    : "border-[#e5e5e5] bg-[#fafafa] text-[#737373]",
                )}
              >
                {listError && contests.length === 0
                  ? "Campaigns couldn’t load"
                  : listLoading && contests.length === 0
                  ? "Loading campaigns…"
                  : listValidating && contests.length > 0
                    ? "Updating campaigns…"
                  : campaignResultSummary}
              </span>
            </div>
            {listError && contests.length > 0 && (
              <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
                Campaigns could not be refreshed. Showing the last loaded results for these filters.
              </p>
            )}
            {listError && contests.length === 0 ? (
              <div
                role="alert"
                className={cn(
                  "flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border px-6 py-12 text-center",
                  isDark
                    ? "border-white/10 bg-white/[0.03] text-slate-300"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  We couldn’t load these campaigns.
                </p>
                <p className="text-sm">Check your connection and try again.</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void retryServerList()}
                  className="mt-1"
                >
                  <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : listLoading || (listValidating && contests.length === 0) ? (
              <div className="flex min-h-[40vh] items-center justify-center py-16">
                <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
                  <PageLoadingSpinner mode={isDark ? "dark" : "light"} />
                  <span className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
                    Loading campaigns…
                  </span>
                </div>
              </div>
            ) : displayViewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                      {!isAllCampaignPlatformFilter(platformFilter) ||
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
                  paginatedContests.map((contest) => renderContestCard(contest, "list"))
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
                      {!isAllCampaignPlatformFilter(platformFilter) ||
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
              <CampaignListPagination
                page={page}
                limit={limit}
                total={total}
                onPageChange={setPage}
                onLimitChange={handleCampaignPageSizeChange}
                // Keep navigation available during background refreshes.
                loading={listLoading || (listValidating && contests.length === 0)}
                isDark={isDark}
              />
            )}
          </div>
          {shouldShowContestTypeGuide && (
            <div className="mt-10">{contestTypeGuideCards}</div>
          )}
        </>
      ) : (
        <div className="py-10">{contestTypeGuideCards}</div>
      )}
    </div>
  );
}
