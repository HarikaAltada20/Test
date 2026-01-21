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
} from "lucide-react";
import { DeleteContestButton } from "@/components/delete-contest-button";
import { formatLocalDateTime, cn } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import {
  calculateLeaderboardBudgetSpent,
  Submission,
} from "@/lib/contest-utils-client";
import { getPlatformIconWithFallback } from "@/lib/platform-icons";
import { PaginationControls } from "@/components/ui/pagination-controls";

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
  submitted_for_approval_at?: string | null;
  published_at?: string | null;
  rejection_reason?: string | null;
  multiple_submissions_enabled?: boolean;
  max_submissions_per_creator?: number;
  content_type?: string;
  bonus_details?: any;
  // Text/image vs video contest format (for display filtering)
  contest_format?: string | null;
  // Twitter participants data (should be populated from twitter_campaign_metrics)
  twitter_participants_count?: number | null;
  twitter_max_participants?: number | null;
};

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

const getBudgetTrackerValues = (
  totalBudget: number,
  budgetSpent?: number | null
) => {
  const spent = Math.max(0, budgetSpent ?? 0);
  const clampedSpent = Math.min(spent, totalBudget);
  const percentage = totalBudget > 0 ? (clampedSpent / totalBudget) * 100 : 0;
  const remaining = Math.max(totalBudget - clampedSpent, 0);

  return { spent: clampedSpent, percentage, remaining };
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
  // New: contest format filter (all / text-image / video)
  const [contestFormatFilter, setContestFormatFilter] = useState<
    "all" | "text_image" | "video"
  >("video");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filteredAndSortedContests, setFilteredAndSortedContests] = useState<
    Contest[]
  >([]);
  const [page, setPage] = useState<number>(1);
  // Default to 9 campaigns per page with options: 9, 15, 21, 30
  const [limit, setLimit] = useState<number>(9);
  const [internalViewMode, setInternalViewMode] = useState<"grid" | "list">(
    "grid"
  );

  // Use external viewMode if provided, otherwise use internal state
  const viewMode =
    externalViewMode !== undefined ? externalViewMode : internalViewMode;
  const setViewMode = onViewModeChange || setInternalViewMode;

  const [contests, setContests] = useState<Contest[]>(initialContests);
  const isMountedRef = useRef(true);

  const fetchLatestContests = useCallback(async () => {
    try {
      const response = await fetch("/api/contests/list", {
        cache: "no-store",
      });
      if (!response.ok) {
        console.warn(
          "[ContestListClient] Unable to refresh contests",
          response.status
        );
        return;
      }
      const payload = await response.json();
      if (!Array.isArray(payload?.contests)) {
        return;
      }
      if (!isMountedRef.current) {
        return;
      }
      setContests(payload.contests);
    } catch (error) {
      console.error("[ContestListClient] Error refreshing contests:", error);
    }
  }, []);

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
    fetchLatestContests();
    const intervalId = window.setInterval(fetchLatestContests, 30000);
    return () => window.clearInterval(intervalId);
  }, [fetchLatestContests]);

  useEffect(() => {
    const handleContestRefresh = () => {
      fetchLatestContests();
    };

    window.addEventListener("contests:refresh", handleContestRefresh);
    return () => {
      window.removeEventListener("contests:refresh", handleContestRefresh);
    };
  }, [fetchLatestContests]);

  const availablePlatforms = useMemo(() => {
    const platforms = new Set(
      contests.map((c) => c.platform).filter(Boolean) as string[]
    );
    return ["all", ...Array.from(platforms)];
  }, [contests]);

  // Group contests by moderation status and contest lifecycle
  const contestsByStatus = useMemo(() => {
    const groups = {
      all: contests,
      draft: contests.filter((c) => c.moderation_status === "draft"),
      pending_approval: contests.filter(
        (c) => c.moderation_status === "pending_approval"
      ),
      ready: contests.filter((c) => c.moderation_status === "approved"),
      active: contests.filter(
        (c) =>
          c.moderation_status === "published" &&
          (c.status === "active" || c.status === "upcoming")
      ),
      pending_verification: contests.filter(
        (c) =>
          c.moderation_status === "published" &&
          c.status === "ended" &&
          c.post_contest_status !== "verification_complete" &&
          c.post_contest_status !== "payouts_processed"
      ),
      done: contests.filter(
        (c) =>
          c.moderation_status === "published" &&
          c.status === "ended" &&
          (c.post_contest_status === "verification_complete" ||
            c.post_contest_status === "payouts_processed")
      ),
      rejected: contests.filter((c) => c.moderation_status === "rejected"),
    };
    return groups;
  }, [contests]);

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
        handleThemeChange as EventListener
      );
      clearInterval(intervalId);
    };
  }, [mode]);
  const isDark = mode === "dark";

  // Responsive view mode: switch to grid view on smaller screens if in list view
  useEffect(() => {
    const checkScreenSize = () => {
      // Use 650px as the breakpoint (matches min-[650px] used for view toggle buttons)
      if (window.innerWidth < 650 && viewMode === "list") {
        setViewMode("grid");
      }
    };

    // Check on mount
    checkScreenSize();

    // Check on resize
    window.addEventListener("resize", checkScreenSize);

    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, [viewMode, setViewMode]);

  // useEffect for filtering and sorting - copied from opportunities
  useEffect(() => {
    const baseContests =
      contestsByStatus[selectedTab as keyof typeof contestsByStatus] || [];
    let contestsToDisplay = [...baseContests];

    // Search Filter - filter by title (case-insensitive)
    if (searchQuery.trim() !== "") {
      const searchTerm = searchQuery.trim().toLowerCase();
      contestsToDisplay = contestsToDisplay.filter((contest) => {
        const title = contest.title?.toLowerCase() || "";
        return title.includes(searchTerm);
      });
    }

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

    // Apply contest format filter (text/image vs video)
    if (contestFormatFilter !== "all") {
      contestsToDisplay = contestsToDisplay.filter((contest) => {
        const fmt = contest.contest_format?.toLowerCase() || "";
        if (contestFormatFilter === "text_image") {
          // Treat missing/unknown format as text/image by default
          return (
            fmt === "text_image" ||
            fmt === "text-image" ||
            fmt === "text" ||
            fmt === "image" ||
            fmt === ""
          );
        }
        // video filter
        return fmt === "video";
      });
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
    contestsByStatus,
    selectedTab,
    contestStatusFilter,
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
          className={cn(
            "overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col group w-full cursor-pointer",
            isDark
              ? "bg-[#06021D] border-slate-700"
              : "bg-white border-slate-200"
          )}
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
                  !["active", "upcoming", "ended"].includes(
                    contest.status || ""
                  ) && "bg-[#7F39EC] text-white"
                )}
              >
                {contest.status === "active"
                  ? "Live"
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
              {contest.title || "Untitled Contest"}
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
                            : "bg-cyan-50 text-cyan-700 border-cyan-200"
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
                          : "bg-purple-50 text-purple-700 border-purple-200"
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
                      : "bg-green-50 text-green-700 border-green-200"
                  )}
                >
                  <Gift className="h-3 w-3 mr-1" />
                  {formatMoney(
                    contest.contest_based_details?.cpm_contest
                      ?.flat_fee_bonus ||
                      contest.contest_based_details?.leaderboard_contest
                        ?.flat_fee_bonus ||
                      0
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
                          : "bg-blue-50 text-blue-700 border-blue-200"
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
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  )}
                >
                  <Star className="h-3 w-3 mr-1" />
                  Bonus Available
                </Badge>
              )}
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
              {/* For Twitter text_image contests, show participants instead of submissions */}
              {(() => {
                const isTwitterTextImage =
                  (contest.platform?.toLowerCase() === "twitter" ||
                    contest.platform?.toLowerCase() === "x") &&
                  contest.contest_format === "text_image";

                if (isTwitterTextImage) {
                  // For Twitter contests, show participants count if available
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
                }

                // For non-Twitter contests, show submissions count
                if (
                  contest.live_submission_count !== null &&
                  contest.live_submission_count !== undefined
                ) {
                  return (
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>
                        Submissions:{" "}
                        <span className="font-medium ">
                          {contest.live_submission_count}
                        </span>
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              <div className="flex items-center">
                <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>
                  Contest Type:{" "}
                  <span className="font-medium">
                    {contest.contest_type === "cpm"
                      ? "CPM Based"
                      : contest.contest_type === "leaderboard"
                      ? "Leaderboard"
                      : contest.contest_type
                      ? contest.contest_type.charAt(0).toUpperCase() +
                        contest.contest_type.slice(1)
                      : "N/A"}
                  </span>
                </span>
              </div>
              {contest.contest_type === "cpm" &&
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
                            .cpm_rate_usd * 100
                        )}{" "}
                        {contest.platform?.toLowerCase() === "twitter" ||
                        contest.platform?.toLowerCase() === "x"
                          ? "/ 1k points"
                          : "/ 1k views"}
                      </span>
                    </span>
                  </div>
                )}
              {contest.contest_type === "cpm" &&
                contest.contest_based_details?.cpm_contest?.total_budget !=
                  null &&
                contest.contest_based_details.cpm_contest.total_budget > 0 && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      Total Budget:{" "}
                      <span className="font-medium ">
                        {formatMoney(
                          contest.contest_based_details.cpm_contest.total_budget
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
                            .total_prize
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
                            .total_budget
                        )}
                      </span>
                    </span>
                  </div>
                )}
            </div>

            {/* Budget Spent Progress Bar for CPM contests */}
            {contest.contest_type === "cpm" &&
              contest.contest_based_details?.cpm_contest?.total_budget !=
                null &&
              contest.contest_based_details.cpm_contest.total_budget > 0 &&
              (() => {
                const totalBudget =
                  contest.contest_based_details.cpm_contest.total_budget;
                // Use real-time updated budget_spent field
                const budgetSpent =
                  contest.contest_based_details.cpm_contest.budget_spent || 0;
                const percentage = (budgetSpent / totalBudget) * 100;
                const remaining = totalBudget - budgetSpent;

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
                        isDark ? "bg-[#FFFFFF42]" : "bg-slate-200"
                      )}
                      title={`Total Budget Spent: ${formatMoney(budgetSpent)}`}
                    >
                      <div
                        className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
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

            {/* Bonus Budget Tracker for Leaderboard contests */}
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
                  budgetSpent
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
                        tracker.spent
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
                className="font-bold text-lg leading-tight line-clamp-2"
                style={{
                  color: isDark ? "white" : "#0f172a",
                  transition: "none",
                }}
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
                    isDark ? "text-amber-400" : "text-amber-600"
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
              {contest.moderation_status === "rejected" &&
                contest.rejection_reason && (
                  <div className="flex items-start gap-1 text-red-600 dark:text-red-400">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span className="text-xs">{contest.rejection_reason}</span>
                  </div>
                )}
            </div>

            <div className="flex gap-2 items-center">
              {contest.moderation_status === "approved" ? (
                <>
                  <button
                    className={cn(
                      "flex w-full items-center justify-center gap-2  px-3 py-3 rounded-full",
                      isDark
                        ? "bg-[#7F39EC] text-white"
                        : "bg-[#D9C0FF61] text-[#7F39EC]"
                    )}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const response = await fetch(
                          `/api/contests/${contest.id}/publish`,
                          {
                            method: "POST",
                          }
                        );
                        if (response.ok) {
                          window.location.reload();
                        } else {
                          const error = await response.json();
                          alert(error.error || "Failed to publish contest");
                        }
                      } catch (error) {
                        alert("Failed to publish contest");
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
                        : "text-purple-500"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/dashboard/contests/${contest.id}/edit?dates=true`
                      );
                    }}
                  >
                    <Calendar className="h-4 w-4" />
                    Edit Dates
                  </Button>
                </>
              ) : contest.moderation_status !== "published" ? (
                // Non-published contests: Show Edit Contest button
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

              {contest.moderation_status !== "published" && (
                <DeleteContestButton
                  contestId={contest.id}
                  contestTitle={contest.title || "this contest"}
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
            "overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col sm:flex-row group w-full cursor-pointer relative",
            isDark
              ? "bg-[#06021D] border-slate-700"
              : "bg-white border-slate-200"
          )}
          onClick={() => {
            const href = isAdminView
              ? `/dashboard/admin/contests/${contest.id}`
              : `/dashboard/contests/${contest.id}`;
            router.push(href);
          }}
        >
          {/* Status Badge - Top Right Corner */}
          {(contest.status === "active" ||
            contest.status === "upcoming" ||
            contest.status === "ended") && (
            <div className="absolute top-3 right-3 z-10">
              <Badge
                className={cn(
                  "capitalize text-sm px-3 py-1 font-medium border",
                  contest.status === "active" && "bg-[#7F39EC] text-white",
                  contest.status === "upcoming" && "bg-[#7F39EC] text-white",
                  contest.status === "ended" && "bg-[#7F39EC] text-white"
                )}
              >
                {contest.status === "active"
                  ? "Live"
                  : contest.status === "upcoming"
                  ? "Upcoming"
                  : contest.status === "ended"
                  ? "Ended"
                  : contest.status || "Unknown"}
              </Badge>
            </div>
          )}
          {/* Thumbnail */}
          <div className="w-full sm:w-64 md:w-80 lg:w-72 xl:w-96 sm:h-[200px] md:h-[220px] lg:h-[250px] min-h-[12rem] flex-shrink-0 flex items-center justify-center overflow-hidden relative">
            {contest.thumbnail_url ? (
              <img
                src={contest.thumbnail_url || "/placeholder.svg"}
                alt={contest.title || "Contest thumbnail"}
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
                {contest.title || "Untitled Contest"}
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
                              : "bg-cyan-50 text-cyan-700 border-cyan-200"
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
                            : "bg-purple-50 text-purple-700 border-purple-200"
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
                            : "bg-blue-50 text-blue-700 border-blue-200"
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
                        : "bg-green-50 text-green-700 border-green-200"
                    )}
                  >
                    <Gift className="h-3 w-3 mr-1" />
                    {formatMoney(
                      contest.contest_based_details?.cpm_contest
                        ?.flat_fee_bonus ||
                        contest.contest_based_details?.leaderboard_contest
                          ?.flat_fee_bonus ||
                        0
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
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    )}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Bonus Available
                  </Badge>
                )}
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
                {/* For Twitter text_image contests, show participants instead of submissions */}
                {(() => {
                  const isTwitterTextImage =
                    (contest.platform?.toLowerCase() === "twitter" ||
                      contest.platform?.toLowerCase() === "x") &&
                    contest.contest_format === "text_image";

                  if (isTwitterTextImage) {
                    // For Twitter contests, show participants count if available
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
                  }

                  // For non-Twitter contests, show submissions count
                  if (
                    contest.live_submission_count !== null &&
                    contest.live_submission_count !== undefined
                  ) {
                    return (
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span
                          style={{
                            color: isDark ? "white" : "#475569",
                            transition: "none",
                          }}
                        >
                          Submissions:{" "}
                          <span className="font-medium">
                            {contest.live_submission_count}
                          </span>
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="flex items-center">
                  <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span
                    style={{
                      color: isDark ? "white" : "#475569",
                      transition: "none",
                    }}
                  >
                    Contest Type:{" "}
                    <span className="font-medium">
                      {contest.contest_type === "cpm"
                        ? "CPM Based"
                        : contest.contest_type === "leaderboard"
                        ? "Leaderboard"
                        : contest.contest_type
                        ? contest.contest_type.charAt(0).toUpperCase() +
                          contest.contest_type.slice(1)
                        : "N/A"}
                    </span>
                  </span>
                </div>
                {contest.contest_type === "cpm" &&
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
                              .cpm_rate_usd * 100
                          )}{" "}
                          {contest.platform?.toLowerCase() === "twitter" ||
                          contest.platform?.toLowerCase() === "x"
                            ? "/ 1k points"
                            : "/ 1k views"}
                        </span>
                      </span>
                    </div>
                  )}
                {contest.contest_type === "cpm" &&
                  contest.contest_based_details?.cpm_contest?.total_budget !=
                    null &&
                  contest.contest_based_details.cpm_contest.total_budget >
                    0 && (
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
                            contest.contest_based_details.cpm_contest
                              .total_budget
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
                              .total_prize
                          )}
                        </span>
                      </span>
                    </div>
                  )}
              </div>

              {/* Budget Spent Progress Bar for CPM contests */}
              {contest.contest_type === "cpm" &&
                contest.contest_based_details?.cpm_contest?.total_budget !=
                  null &&
                contest.contest_based_details.cpm_contest.total_budget > 0 &&
                (() => {
                  const totalBudget =
                    contest.contest_based_details.cpm_contest.total_budget;
                  const budgetSpent =
                    contest.contest_based_details.cpm_contest.budget_spent || 0;
                  const percentage = (budgetSpent / totalBudget) * 100;
                  const remaining = totalBudget - budgetSpent;

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
                          isDark ? "bg-[#FFFFFF42]" : "bg-slate-200"
                        )}
                      >
                        <div
                          className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
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

              {/* Bonus Budget Tracker for Leaderboard contests */}
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
                    budgetSpent
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
            </CardContent>
          </div>

          {/* Third Column - View Details Button */}
          <div className="flex flex-col items-center justify-center gap-3 p-4 w-32 sm:w-40 flex-shrink-0">
            <button
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-full whitespace-nowrap",
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
            >
              <Eye className="h-4 w-4" />
              <span className="text-sm font-medium">View Details</span>
            </button>
          </div>
        </Card>
      );
    }

    // List view for unpublished contests
    return (
      <Card
        key={contest.id}
        className={cn(
          "overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col sm:flex-row group w-full cursor-pointer relative",
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
        <div className="absolute top-4 right-3 z-10">
          {getModerationStatusBadge(contest.moderation_status)}
        </div>
        {/* Thumbnail */}
        <div className="w-full sm:w-64 md:w-80 lg:w-72 xl:w-96 sm:h-[200px] md:h-[220px] lg:h-[250px] min-h-[12rem] flex-shrink-0 flex items-center justify-center overflow-hidden relative">
          {contest.thumbnail_url ? (
            <img
              src={contest.thumbnail_url || "/placeholder.svg"}
              alt={contest.title || "Contest thumbnail"}
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
              {contest.title || "Untitled Contest"}
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
              {contest.contest_type || "Type"}
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
                  isDark ? "text-amber-400" : "text-amber-600"
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
        </div>

        {/* Third Column - Action Buttons */}
        <div
          className={cn(
            "flex items-center justify-center gap-2 p-4 flex-shrink-0",
            contest.moderation_status === "approved" ||
              contest.moderation_status !== "published"
              ? "flex-row w-auto sm:w-auto"
              : "flex-col w-32 sm:w-40"
          )}
        >
          {contest.moderation_status === "approved" ? (
            <>
              <button
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-3 rounded-full text-sm font-medium whitespace-nowrap",
                  isDark
                    ? "bg-[#7F39EC] text-white"
                    : "bg-[#D9C0FF61] text-[#7F39EC]"
                )}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const response = await fetch(
                      `/api/contests/${contest.id}/publish`,
                      {
                        method: "POST",
                      }
                    );
                    if (response.ok) {
                      window.location.reload();
                    } else {
                      const error = await response.json();
                      alert(error.error || "Failed to publish contest");
                    }
                  } catch (error) {
                    alert("Failed to publish contest");
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
                  isDark ? "text-purple-400 border-gray-700" : "text-purple-500"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(
                    `/dashboard/contests/${contest.id}/edit?dates=true`
                  );
                }}
              >
                <Calendar className="h-4 w-4" />
                <span>Edit Dates</span>
              </Button>
              <DeleteContestButton
                contestId={contest.id}
                contestTitle={contest.title || "this contest"}
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
                    : "bg-[#D9C0FF61] text-[#7F39EC]"
                )}
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
              <DeleteContestButton
                contestId={contest.id}
                contestTitle={contest.title || "this contest"}
                isDeletable={true}
                className="flex items-center gap-2 justify-center"
              />
            </>
          ) : (
            <button
              className="flex w-full items-center justify-center gap-2 bg-[#D9C0FF61] px-3 py-3 text-[#7F39EC] rounded-full text-sm font-medium"
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
      contestTypeFilter !== "all" ||
      contestFormatFilter !== "all" ||
      searchQuery.trim() !== ""
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
    searchQuery,
    selectedTab,
  ]);

  const displayContests = sortedCurrentContests;

  // Reset to first page whenever filters, sort, or tab changes
  useEffect(() => {
    setPage(1);
  }, [
    selectedTab,
    contestStatusFilter,
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
    page * limit
  );

  return (
    <div className="w-full no-theme-transition">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 mb-3">
        {/* Search and View Toggle Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Input
              type="text"
              placeholder="Search contests by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-10 border w-full",
                searchQuery && "pr-10",
                isDark
                  ? "border-gray-500 bg-[#020817] text-white"
                  : "border-gray-400 text-black"
              )}
            />
          </div>
          <div className="flex gap-2">
            {/* Format Toggle: Text/Image contests vs Video contests */}
            <div className="flex items-center gap-1 border border-gray-400 rounded-md p-1">
              <button
                type="button"
                onClick={() => setContestFormatFilter("text_image")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded transition-colors text-sm font-medium",
                  contestFormatFilter === "text_image"
                    ? isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#7F39EC] text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                title="Text/Image contests"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Text/Image contests</span>
              </button>
              <button
                type="button"
                onClick={() => setContestFormatFilter("video")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded transition-colors text-sm font-medium",
                  contestFormatFilter === "video"
                    ? isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#7F39EC] text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                title="Video contests"
              >
                <PlayCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Video contests</span>
              </button>
            </div>

            {/* View Toggle Buttons */}
            <div className="hidden min-[650px]:flex items-center gap-1 border border-gray-400 rounded-md p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded transition-colors text-sm font-medium",
                  viewMode === "grid"
                    ? isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#7F39EC] text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Grid View</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded transition-colors text-sm font-medium",
                  viewMode === "list"
                    ? isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#7F39EC] text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                title="List View"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">List View</span>
              </button>
            </div>
          </div>
        </div>
        {/* Filters - Wraps to next row when overflow */}
        <div className="flex flex-wrap items-center gap-2 w-full">
          <Select
            value={sortOption}
            onValueChange={(value) => setSortOption(value as SortOptionType)}
          >
            <SelectTrigger className="w-full sm:w-[200px] min-w-[150px] border border-gray-400">
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
            <SelectTrigger className="w-full sm:w-[150px] min-w-[120px] border border-gray-400">
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
            <SelectTrigger className="w-full sm:w-[150px] min-w-[120px] border border-gray-400">
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
            <SelectTrigger className="w-full sm:w-[150px] min-w-[120px] border border-gray-400">
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

      {/* Enhanced Status Filter Tabs - More Responsive */}
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full mb-8"
      >
        <TabsList className="flex gap-6">
          <TabsTrigger
            value="all"
            className={cn(
              "border",
              isDark
                ? "border-gray-400 text-white"
                : "border-gray-500 text-gray-800"
            )}
          >
            All{" "}
            <Badge
              variant="secondary"
              className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
            >
              {contestsByStatus.all.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="draft"
            className={cn(
              "border",
              isDark
                ? "border-gray-400 text-white"
                : "border-gray-500 text-gray-800"
            )}
          >
            Draft{" "}
            <Badge
              variant="secondary"
              className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
            >
              {contestsByStatus.draft.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            className={cn(
              "border",
              isDark
                ? "border-gray-400 text-white"
                : "border-gray-500 text-gray-800"
            )}
            value="pending_approval"
          >
            Pending Approval{" "}
            <Badge
              variant="secondary"
              className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
            >
              {contestsByStatus.pending_approval.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="ready"
            className={cn(
              "border",
              isDark
                ? "border-gray-400 text-white"
                : "border-gray-500 text-gray-800"
            )}
          >
            Ready{" "}
            <Badge
              variant="secondary"
              className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
            >
              {contestsByStatus.ready.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className={cn(
              "border",
              isDark
                ? "border-gray-400 text-white"
                : "border-gray-500 text-gray-800"
            )}
          >
            Active{" "}
            <Badge
              variant="secondary"
              className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
            >
              {contestsByStatus.active.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            className={cn(
              "border",
              isDark
                ? "border-gray-400 text-white"
                : "border-gray-500 text-gray-800"
            )}
            value="pending_verification"
          >
            Pending Verification{" "}
            <Badge
              variant="secondary"
              className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
            >
              {contestsByStatus.pending_verification.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="done"
            className={cn(
              "border",
              isDark
                ? "border-gray-400 text-white"
                : "border-gray-500 text-gray-800"
            )}
          >
            Done{" "}
            <Badge
              variant="secondary"
              className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
            >
              {contestsByStatus.done.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="rejected"
            className={cn(
              "border",
              isDark
                ? "border-gray-400 text-white"
                : "border-gray-500 text-gray-800"
            )}
          >
            Rejected{" "}
            <Badge
              variant="secondary"
              className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
            >
              {contestsByStatus.rejected.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
        {Object.keys(contestsByStatus).map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="mt-4">
            <div>
              {viewMode === "grid" ? (
                <div
                  className="grid gap-6"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(320px, 1fr))",
                  }}
                >
                  {total > 0 ? (
                    paginatedContests.map((contest) =>
                      renderContestCard(contest)
                    )
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <h3
                        className="text-lg font-semibold"
                        style={{
                          color: isDark ? "white" : "black",
                          transition: "none",
                        }}
                      >
                        No Contests Found
                      </h3>
                      <p
                        className="mt-2"
                        style={{
                          color: isDark ? "#94a3b8" : "#64748b",
                          transition: "none",
                        }}
                      >
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
              ) : (
                <div className="flex flex-col gap-4">
                  {total > 0 ? (
                    paginatedContests.map((contest) =>
                      renderContestListItem(contest)
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
                        No Contests Found
                      </h3>
                      <p
                        className="mt-2"
                        style={{
                          color: isDark ? "#94a3b8" : "#64748b",
                          transition: "none",
                        }}
                      >
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
                            isDark && "border border-gray-600"
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          isDark={isDark}
                          className={cn(
                            isDark && "border-gray-600 bg-[#07031D] text-white"
                          )}
                        >
                          {[9, 15, 21, 30].map((size) => (
                            <SelectItem
                              isDark={isDark}
                              key={size}
                              value={size.toString()}
                              className={cn(
                                isDark &&
                                  "bg-[#07031D] text-white focus:bg-slate-800 data-[state=checked]:bg-slate-700"
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
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
