"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Award,
  TrendingUp,
  Eye,
  Target,
  Users,
  Coins,
  DollarSign,
  Loader2,
  RefreshCw,
  Youtube,
  Instagram,
  AlertCircle,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import { cn } from "@/lib/utils";

type SortBy =
  | "winnings"
  | "affiliate_earnings"
  | "contests_won"
  | "verified_views"
  | "submissions_won"
  | "referrals"
  | "total_coins";

type PlatformFilter = "all" | "youtube" | "instagram";

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

const formatMoney = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

type LeaderboardEntry = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  profile_picture_url: string | null;
  metrics: {
    winnings: number;
    affiliate_earnings: number;
    other_earnings: number;
    contests_won: number;
    verified_views: number;
    submissions_won: number;
    contests_participated: number;
    submissions_made: number;
    referrals: number;
    advertisers_referred?: number;
    creators_referred?: number;
    total_coins: number;
  };
  platforms: {
    has_youtube: boolean;
    has_instagram: boolean;
  };
};

type SummaryStats = {
  totalCreators: number;
  instagramCreators?: number;
  youtubeCreators?: number;
  totalWinnings: number;
  totalAffiliateEarnings: number;
  totalViews: number;
  totalContestsWon: number;
  totalSubmissionsWon: number;
  totalContestsParticipated: number;
  totalSubmissionsMade: number;
  totalReferrals: number;
  totalAdvertisersReferred: number;
  totalCreatorsReferred: number;
  totalCoins: number;
  averageWinnings: number;
  averageViews: number;
};

type LeaderboardClientProps = {
  showAdminSummary?: boolean;
  summaryOnly?: boolean;
  hideHeroHeader?: boolean;
};

export default function LeaderboardClient({
  showAdminSummary = false,
  summaryOnly = false,
  hideHeroHeader = false,
}: LeaderboardClientProps) {
  const [sortBy, setSortBy] = useState<SortBy>("winnings");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [staticSummary, setStaticSummary] = useState<SummaryStats | null>(null);
  const [creatorCardPlatform, setCreatorCardPlatform] =
    useState<PlatformFilter>("all");
  const [avatarLoadErrors, setAvatarLoadErrors] = useState<
    Record<string, string>
  >({});
  // Initialize mode state with proper detection to prevent flash
  const [mode, setMode] = useState<"light" | "dark">(() => {
    // Check if we're in browser environment
    if (typeof window !== "undefined") {
      // Try to get theme from data-mode attribute first
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (dataMode) return dataMode;
      }

      // Check localStorage as fallback
      try {
        const savedMode = localStorage.getItem("dashboard-mode") as
          | "light"
          | "dark";
        if (savedMode) return savedMode;

        const preset = localStorage.getItem("dashboard-preset");
        if (preset === "game-of-creators" || preset === "dark-professional") {
          return "dark";
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    return "light";
  });

  const sortOptions: {
    value: SortBy;
    label: string;
    icon: React.ReactElement;
  }[] = [
    {
      value: "winnings",
      label: "Total Winnings",
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      value: "affiliate_earnings",
      label: "Affiliate & Additional Earnings",
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      value: "contests_won",
      label: "Contests Won",
      icon: <Award className="w-4 h-4" />,
    },
    {
      value: "verified_views",
      label: "Total Verified Views",
      icon: <Eye className="w-4 h-4" />,
    },
    {
      value: "submissions_won",
      label: "Total Submissions Won",
      icon: <Target className="w-4 h-4" />,
    },
    {
      value: "referrals",
      label: "Total Referrals",
      icon: <Users className="w-4 h-4" />,
    },
    {
      value: "total_coins",
      label: "Total Coins Earned",
      icon: <Coins className="w-4 h-4" />,
    },
  ];

  const getMetricLabel = (metric: SortBy) => {
    const option = sortOptions.find((opt) => opt.value === metric);
    return option?.label || metric;
  };

  // Read mode from data attribute with immediate updates using useLayoutEffect
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

    // Listen for custom theme-change events for immediate updates
    const handleThemeChange = (e: CustomEvent) => {
      const newMode = e.detail?.mode;
      if (newMode && newMode !== mode) {
        setMode(newMode);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("theme-change", handleThemeChange as EventListener);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "theme-change",
        handleThemeChange as EventListener
      );
    };
  }, [mode]);
  // Reset to page 1 when sortBy or platform changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, platform]);

  // Fetch static summary once on mount (always with platform="all")
  useEffect(() => {
    fetchStaticSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch leaderboard data
  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, platform, currentPage, limit]);

  const fetchStaticSummary = async () => {
    try {
      // Fetch summary with platform="all" to get stats for all platforms
      const params = new URLSearchParams({
        sortBy: "winnings", // Default sort, we only need the summary
        platform: "all",
        page: "1",
        limit: "1", // Minimal limit since we only need summary
      });
      if (showAdminSummary) {
        params.set("admin", "1");
      }
      const response = await fetch(`/api/creators/leaderboard?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch summary");
      }

      setStaticSummary(data.summary || null);
    } catch (err: any) {
      console.error("Error fetching static summary:", err);
      // Don't set error state here to avoid blocking the UI
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sortBy,
        platform,
        page: currentPage.toString(),
        limit: limit.toString(),
      });
      if (showAdminSummary) {
        params.set("admin", "1");
      }
      const response = await fetch(`/api/creators/leaderboard?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch leaderboard");
      }

      setLeaders(data.leaders || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalItems(data.pagination?.totalItems || 0);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message || "Failed to load leaderboard");
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const getUsernameToShow = (entry: LeaderboardEntry) => {
    return entry.username || entry.full_name || "Anonymous";
  };

  const getMetricValue = (entry: LeaderboardEntry, metric: SortBy) => {
    switch (metric) {
      case "winnings":
        return formatMoney(entry.metrics.winnings);
      case "affiliate_earnings":
        // Return combined value for sorting/display purposes
        return formatMoney(
          (entry.metrics.affiliate_earnings || 0) +
            (entry.metrics.other_earnings || 0)
        );
      case "contests_won":
        return entry.metrics.contests_won.toString();
      case "verified_views":
        return (entry.metrics.verified_views || 0).toLocaleString();
      case "submissions_won":
        return entry.metrics.submissions_won.toString();
      case "referrals":
        return entry.metrics.referrals.toString();
      case "total_coins":
        return (entry.metrics.total_coins || 0).toLocaleString();
      default:
        return "0";
    }
  };

  const handleAvatarError = useCallback((userId: string, url?: string) => {
    setAvatarLoadErrors((prev) => {
      if (prev[userId] === url) return prev;
      return { ...prev, [userId]: url || "__error__" };
    });
  }, []);

  const isDark = mode === "dark";

  return (
    <div className="sm:px-2 py-4 sm:py-6 md:py-8">
      {/* Hero Header */}
      {!summaryOnly && !hideHeroHeader && (
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div
            className={cn(
              "relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-md",
              isDark ? "bg-[#170337] text-white" : "bg-white"
            )}
          >
            {/* <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" /> */}
            <div className="relative">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2">
                  <Award
                    className={cn(
                      "w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  />
                </div>
                <h1
                  className={cn(
                    "text-2xl sm:text-3xl md:text-4xl font-bold",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  Creator Leaderboard
                </h1>
              </div>
              <p
                className={cn(
                  "text-sm sm:text-base md:text-lg",
                  isDark ? "text-gray-400" : "text-gray-900"
                )}
              >
                Explore the Top 100 creators across every metric—compare your
                performance and climb the ranks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Statistics Cards (admin-only when showAdminSummary is true) */}
      {showAdminSummary && staticSummary && (
        <div className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white shadow-lg transition-all duration-300 overflow-hidden group rounded-lg sm:rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 bg-gradient-to-br from-violet-100 via-violet-50 to-purple-50 border-b border-violet-100/50 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-semibold text-violet-800">
                Total Creators
              </CardTitle>
              <div className="p-1 sm:p-1.5 rounded-lg bg-violet-200/50 group-hover:bg-violet-200 transition-colors">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-700" />
              </div>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-700 to-purple-700 bg-clip-text text-transparent">
                {staticSummary.totalCreators.toLocaleString()}
              </div>

              {/* Platform Breakdown */}
              {staticSummary.instagramCreators !== undefined &&
                staticSummary.youtubeCreators !== undefined && (
                  <p className="text-xs text-violet-600/70 mt-1 sm:mt-2 font-medium flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Instagram className="w-3 h-3 text-pink-600" />
                      {staticSummary.instagramCreators.toLocaleString()}{" "}
                      Instagram
                    </span>
                    <span className="text-violet-400">|</span>
                    <span className="flex items-center gap-1.5">
                      <Youtube className="w-3 h-3 text-red-600" />
                      {staticSummary.youtubeCreators.toLocaleString()} YouTube
                    </span>
                  </p>
                )}
            </CardContent>
          </div>

          <div className="bg-white shadow-lg transition-all duration-300 overflow-hidden group rounded-lg sm:rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-50 border-b border-amber-100/50 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-semibold text-amber-800">
                Total Contests Won
              </CardTitle>
              <div className="p-1 sm:p-1.5 rounded-lg bg-amber-200/50 group-hover:bg-amber-200 transition-colors">
                <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-700" />
              </div>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-700 to-orange-700 bg-clip-text text-transparent">
                {staticSummary.totalContestsWon.toLocaleString()}
              </div>
              <p className="text-xs text-amber-600/80 mt-1 sm:mt-2 font-medium">
                {staticSummary.totalContestsParticipated.toLocaleString()}{" "}
                participated
              </p>
            </CardContent>
          </div>

          <div className="bg-white shadow-lg transition-all duration-300 overflow-hidden group rounded-lg sm:rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-50 rounded-t-lg border-b border-indigo-100/50 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-semibold text-indigo-800">
                Total Submissions Won
              </CardTitle>
              <div className="p-1 sm:p-1.5 rounded-lg bg-indigo-200/50 group-hover:bg-indigo-200 transition-colors">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-700" />
              </div>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                {staticSummary.totalSubmissionsWon.toLocaleString()}
              </div>
              <p className="text-xs text-indigo-600/80 mt-1 sm:mt-2 font-medium">
                {staticSummary.totalSubmissionsMade.toLocaleString()} total
                submissions
              </p>
            </CardContent>
          </div>

          <div className="bg-white shadow-lg transition-all duration-300 overflow-hidden group rounded-lg sm:rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 bg-gradient-to-br from-pink-100 via-rose-50 to-fuchsia-50 rounded-t-lg border-b border-pink-100/50 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-semibold text-pink-800">
                Total Referrals
              </CardTitle>
              <div className="p-1 sm:p-1.5 rounded-lg bg-pink-200/50 group-hover:bg-pink-200 transition-colors">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-pink-700" />
              </div>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-700 to-rose-700 bg-clip-text text-transparent">
                {staticSummary.totalReferrals.toLocaleString()}
              </div>
              <p className="text-xs text-pink-600/80 mt-1 sm:mt-2 font-medium">
                {staticSummary.totalAdvertisersReferred} brands,{" "}
                {staticSummary.totalCreatorsReferred} creators
              </p>
            </CardContent>
          </div>
        </div>
      )}

      {/* Filters */}
      {!summaryOnly && (
        <div
          className={cn(
            "mb-4 sm:mb-6 rounded-xl sm:rounded-2xl shadow-md py-4 sm:py-6 px-2 sm:px-3",
            isDark
              ? "bg-[#170337]"
              : "bg-white border border-gray-200 bg-gradient-to-br from-white via-gray-50/30 to-white backdrop-blur-sm"
          )}
        >
          <Tabs
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortBy)}
          >
            <TabsList className="flex gap-1.5 sm:gap-2.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {sortOptions.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "border border-gray-600 text-xs sm:text-sm text-gray-700 inline-flex items-center px-2 sm:px-3 py-2 rounded-full flex-shrink-0",
                    isDark
                      ? "text-white border-gray-500"
                      : "text-gray-700 border-gray-600"
                  )}
                >
                  {/* <span className="flex-shrink-0">{option.icon}</span> */}
                  <span className="whitespace-nowrap">{option.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Leaderboard */}
      {!summaryOnly && (
        <div
          className={cn(
            "rounded-xl sm:rounded-2xl shadow-xl overflow-hidden",
            isDark
              ? "bg-[#170337]"
              : "bg-white border border-gray-200 bg-gradient-to-br from-white via-gray-50/30 to-white"
          )}
        >
          <div
            className={cn(
              "flex flex-row items-center justify-between gap-2  border-b sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5  overflow-hidden",
              isDark
                ? "bg-[#170337]"
                : "bg-white border-gray-200 bg-gradient-to-r from-gray-50 to-white"
            )}
          >
            <h2
              className={cn(
                "text-lg sm:text-xl font-bold  min-w-0 flex-1",
                isDark
                  ? "text-white"
                  : "bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent truncate"
              )}
            >
              {getMetricLabel(sortBy)}
            </h2>
            {sortBy !== "referrals" &&
              sortBy !== "total_coins" &&
              sortBy !== "affiliate_earnings" &&
              sortBy !== "verified_views" && (
                <div className="flex items-center gap-1 sm:gap-1.5 sm:gap-2 flex-shrink-0">
                  <div
                    className={cn(
                      "inline-flex items-center gap-0.5 sm:gap-1 rounded-lg sm:rounded-xl p-0.5 sm:p-1 overflow-x-auto whitespace-nowrap shadow-inner",
                      isDark
                        ? "border border-gray-600 bg-transparent"
                        : "border-2 border-gray-200 bg-white"
                    )}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant={platform === "all" ? "default" : "ghost"}
                      className={
                        platform === "all"
                          ? "shadow-lg hover:shadow-xl transition-all duration-300 font-bold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-xs sm:text-sm px-1.5 sm:px-3 py-1 sm:py-1.5 flex-shrink-0"
                          : cn(
                              "transition-all duration-300 font-semibold text-xs sm:text-sm px-1.5 sm:px-3 py-1 sm:py-1.5 flex-shrink-0",
                              isDark
                                ? "text-gray-200 hover:text-violet-300 hover:bg-violet-900/20"
                                : "text-gray-600 hover:text-violet-600 hover:bg-violet-50/50"
                            )
                      }
                      onClick={() => setPlatform("all")}
                    >
                      Both
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={platform === "youtube" ? "default" : "ghost"}
                      className={
                        platform === "youtube"
                          ? "bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-red-700/30 font-bold text-xs sm:text-sm px-1.5 sm:px-3 py-1 sm:py-1.5 flex-shrink-0"
                          : cn(
                              "transition-all duration-300 font-semibold text-xs sm:text-sm px-1.5 sm:px-3 py-1 sm:py-1.5 flex-shrink-0",
                              isDark
                                ? "text-red-300 hover:text-red-200 hover:bg-red-900/20"
                                : "text-red-600 hover:text-red-700 hover:bg-red-50"
                            )
                      }
                      onClick={() => setPlatform("youtube")}
                    >
                      <Youtube className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="hidden sm:inline ml-1 sm:ml-1.5">
                        YouTube
                      </span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={platform === "instagram" ? "default" : "ghost"}
                      className={
                        platform === "instagram"
                          ? "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-purple-700/30 font-bold text-xs sm:text-sm px-1.5 sm:px-3 py-1 sm:py-1.5 flex-shrink-0"
                          : cn(
                              "transition-all duration-300 font-semibold text-xs sm:text-sm px-1.5 sm:px-3 py-1 sm:py-1.5 flex-shrink-0",
                              isDark
                                ? "text-pink-300 hover:text-pink-200 hover:bg-pink-900/20"
                                : "text-pink-600 hover:text-pink-700 hover:bg-pink-50"
                            )
                      }
                      onClick={() => setPlatform("instagram")}
                    >
                      <Instagram className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="hidden sm:inline ml-1 sm:ml-1.5">
                        Instagram
                      </span>
                    </Button>
                  </div>
                </div>
              )}
          </div>
          <div
            className={cn(
              "p-3 sm:p-4 md:p-6",
              isDark
                ? "bg-[#170337]"
                : "bg-gradient-to-br from-gray-50/30 to-white"
            )}
          >
            {loading ? (
              <div className="space-y-2 sm:space-y-3">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "group relative flex flex-row items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border-2",
                      isDark
                        ? "border-gray-600 bg-[#170337]"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    {/* Left Section: Rank, Avatar, and User Info */}
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
                      {/* Rank Badge Skeleton */}
                      <div className="flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14 flex-shrink-0">
                        <Skeleton className="w-full h-full rounded-full" />
                      </div>

                      {/* Avatar Skeleton */}
                      <Skeleton className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex-shrink-0" />

                      {/* User Info Skeleton */}
                      <div className="flex-1 min-w-0">
                        <Skeleton className="h-4 sm:h-5 w-32 sm:w-48 rounded-md" />
                      </div>
                    </div>

                    {/* Right Section: Metric Value Skeleton */}
                    <div className="text-right flex-shrink-0">
                      <Skeleton className="h-6 sm:h-8 w-20 sm:w-28 rounded-md ml-auto" />
                      {/* Additional badges skeleton - conditionally shown based on sortBy */}
                      {(sortBy === "winnings" ||
                        sortBy === "contests_won" ||
                        sortBy === "submissions_won" ||
                        sortBy === "referrals" ||
                        sortBy === "affiliate_earnings") && (
                        <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 sm:gap-2.5">
                          {sortBy === "winnings" && (
                            <>
                              <Skeleton className="h-6 sm:h-7 w-16 sm:w-20 rounded-md" />
                              <Skeleton className="h-6 sm:h-7 w-20 sm:w-24 rounded-md" />
                            </>
                          )}
                          {sortBy === "contests_won" && (
                            <Skeleton className="h-6 sm:h-7 w-20 sm:w-24 rounded-md" />
                          )}
                          {sortBy === "submissions_won" && (
                            <>
                              <Skeleton className="h-6 sm:h-7 w-16 sm:w-20 rounded-md" />
                              <Skeleton className="h-6 sm:h-7 w-16 sm:w-20 rounded-md" />
                            </>
                          )}
                          {sortBy === "referrals" && (
                            <>
                              <Skeleton className="h-6 sm:h-7 w-14 sm:w-16 rounded-md" />
                              <Skeleton className="h-6 sm:h-7 w-16 sm:w-20 rounded-md" />
                            </>
                          )}
                          {sortBy === "affiliate_earnings" && (
                            <>
                              <Skeleton className="h-6 sm:h-7 w-16 sm:w-20 rounded-md" />
                              <Skeleton className="h-6 sm:h-7 w-20 sm:w-24 rounded-md" />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-red-50 rounded-full mb-4">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <p className="text-destructive font-semibold mb-4">{error}</p>
                <Button
                  onClick={fetchLeaderboard}
                  variant="outline"
                  className="hover:bg-violet-50 hover:border-violet-400 hover:text-violet-600"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try again
                </Button>
              </div>
            ) : leaders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-gray-100 rounded-full mb-4">
                  <Users className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-muted-foreground font-semibold text-lg">
                  No creators found yet
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Check back later for updates!
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {leaders.map((entry, index) => {
                  const rank = (currentPage - 1) * limit + index + 1;
                  const displayName = getUsernameToShow(entry);
                  const metricValue = getMetricValue(entry, sortBy);
                  const showAvatarImage =
                    !!entry.profile_picture_url &&
                    avatarLoadErrors[entry.user_id] !==
                      entry.profile_picture_url;

                  return (
                    <div
                      key={entry.user_id}
                      className={cn(
                        "group relative flex flex-row items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border-2 transition-all duration-300 hover:border-violet-300 hover:shadow-lg sm:hover:scale-[1.01]",
                        isDark ? "bg-[#170337]" : "bg-white border-gray-200"
                      )}
                    >
                      {/* Left Section: Rank, Avatar, and User Info */}
                      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
                        {/* Rank Badge */}
                        <div className="flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14 flex-shrink-0">
                          <div
                            className={cn(
                              "flex items-center justify-center w-full h-full rounded-full group-hover:border-violet-400 ",
                              isDark
                                ? "bg-[#170337] border-2 border-gray-600"
                                : "bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 transition-colors"
                            )}
                          >
                            <span
                              className={cn(
                                "text-sm sm:text-lg md:text-xl font-bold",
                                isDark
                                  ? "text-gray-300 group-hover:text-violet-400"
                                  : "text-gray-700 group-hover:text-violet-600"
                              )}
                            >
                              {rank}
                            </span>
                          </div>
                        </div>

                        {/* Avatar */}
                        <Avatar
                          className={cn(
                            "w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 transition-all duration-300 group-hover:ring-violet-100 group-hover:shadow-lg flex-shrink-0",
                            isDark
                              ? "ring-2 ring-offset-1 ring-gray-300"
                              : "ring-2 sm:ring-3 ring-offset-1 sm:ring-offset-2 ring-gray-200"
                          )}
                        >
                          {showAvatarImage && (
                            <AvatarImage
                              src={entry.profile_picture_url || undefined}
                              onError={() =>
                                handleAvatarError(
                                  entry.user_id,
                                  entry.profile_picture_url || undefined
                                )
                              }
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <AvatarFallback className="bg-violet-100 text-violet-600 font-semibold text-xs sm:text-base">
                            {displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              "font-bold text-sm sm:text-lg truncate",
                              isDark
                                ? "text-white"
                                : "text-gray-900 group-hover:text-violet-600"
                            )}
                          >
                            {displayName}
                          </div>
                          {/* <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                          {entry.platforms.has_youtube && (
                            <Badge
                              variant="secondary"
                              className="bg-red-100 text-red-800 border-red-200 px-1.5 sm:px-2 py-0.5 text-xs font-semibold"
                            >
                              <Youtube className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                              <span >YouTube</span>
                             
                            </Badge>
                          )}
                          {entry.platforms.has_instagram && (
                            <Badge
                              variant="secondary"
                              className="bg-pink-100 text-pink-800 border-pink-200 px-1.5 sm:px-2 py-0.5 text-xs font-semibold"
                            >
                              <Instagram className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                              <span >
                                Instagram
                              </span>
                             
                            </Badge>
                          )}
                        </div> */}
                        </div>
                      </div>

                      {/* Right Section: Metric Value */}
                      <div className="text-right flex-shrink-0">
                        <div
                          className={cn(
                            "text-lg sm:text-2xl font-bold",
                            isDark ? "text-white" : "text-gray-700"
                          )}
                        >
                          {metricValue}
                        </div>
                        {sortBy === "winnings" && (
                          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 sm:gap-2.5">
                            <div
                              className={cn(
                                "flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg transition-colors",
                                isDark
                                  ? "bg-emerald-800/20 border border-emerald-400/20 hover:bg-emerald-800/20"
                                  : "bg-emerald-50/80 border border-emerald-200/60 hover:bg-emerald-100/80"
                              )}
                            >
                              <Award
                                className={cn(
                                  "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                                  isDark
                                    ? "text-emerald-300"
                                    : "text-emerald-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-bold",
                                  isDark
                                    ? "text-emerald-300"
                                    : "text-emerald-700"
                                )}
                              >
                                {entry.metrics.contests_participated || 0}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-medium hidden sm:inline",
                                  isDark
                                    ? "text-emerald-300"
                                    : "text-emerald-600"
                                )}
                              >
                                contests
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium sm:hidden",
                                  isDark
                                    ? "text-emerald-300"
                                    : "text-emerald-600"
                                )}
                              >
                                c
                              </span>
                            </div>
                            <div
                              className={cn(
                                "flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg transition-colors",
                                isDark
                                  ? "bg-blue-800/20 border border-blue-400/20 hover:bg-blue-800/20"
                                  : "bg-blue-50/80 border border-blue-200/60 hover:bg-teal-100/80"
                              )}
                            >
                              <Target
                                className={cn(
                                  "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                                  isDark ? "text-blue-300" : "text-blue-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-bold",
                                  isDark ? "text-blue-300" : "text-blue-700"
                                )}
                              >
                                {entry.metrics.submissions_made || 0}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-medium hidden sm:inline",
                                  isDark ? "text-blue-400" : "text-blue-600"
                                )}
                              >
                                submissions
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium sm:hidden",
                                  isDark ? "text-blue-400" : "text-blue-600"
                                )}
                              >
                                s
                              </span>
                            </div>
                          </div>
                        )}
                        {sortBy === "contests_won" && (
                          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 sm:gap-2.5">
                            <div
                              className={cn(
                                "flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg transition-colors",
                                isDark
                                  ? "bg-blue-800/20 border border-blue-400/20 hover:bg-blue-800/20"
                                  : "bg-blue-50/80 border border-blue-200/60 hover:bg-blue-100/80"
                              )}
                            >
                              <Award
                                className={cn(
                                  "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                                  isDark ? "text-blue-300" : "text-blue-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-bold",
                                  isDark ? "text-blue-300" : "text-blue-700"
                                )}
                              >
                                {entry.metrics.contests_participated || 0}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-medium sm:inline",
                                  isDark ? "text-blue-300" : "text-blue-600"
                                )}
                              >
                                contests
                              </span>
                            </div>
                          </div>
                        )}
                        {sortBy === "submissions_won" && (
                          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 sm:gap-2.5">
                            <div
                              className={cn(
                                "flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg transition-colors",
                                isDark
                                  ? "bg-indigo-800/20 border border-indigo-400/30 hover:bg-indigo-800/20"
                                  : "bg-indigo-50/80 border border-indigo-200/60 hover:bg-indigo-100/80"
                              )}
                            >
                              <Target
                                className={cn(
                                  "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                                  isDark ? "text-indigo-300" : "text-indigo-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-bold",
                                  isDark ? "text-indigo-300" : "text-indigo-700"
                                )}
                              >
                                {entry.metrics.submissions_made || 0}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-medium hidden sm:inline",
                                  isDark ? "text-indigo-300" : "text-indigo-600"
                                )}
                              >
                                submitted
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium sm:hidden",
                                  isDark ? "text-indigo-400" : "text-indigo-600"
                                )}
                              >
                                s
                              </span>
                            </div>
                            <div
                              className={cn(
                                "flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg transition-colors",
                                isDark
                                  ? "bg-emerald-400/10 border border-emerald-400/30 hover:bg-emerald-400/20"
                                  : "bg-emerald-50/80 border border-emerald-200/60 hover:bg-emerald-100/80"
                              )}
                            >
                              <Award
                                className={cn(
                                  "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                                  isDark
                                    ? "text-emerald-300"
                                    : "text-emerald-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-bold",
                                  isDark
                                    ? "text-emerald-300"
                                    : "text-emerald-700"
                                )}
                              >
                                {entry.metrics.contests_participated || 0}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-medium hidden sm:inline",
                                  isDark
                                    ? "text-emerald-400"
                                    : "text-emerald-600"
                                )}
                              >
                                contests
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium sm:hidden",
                                  isDark
                                    ? "text-emerald-400"
                                    : "text-emerald-600"
                                )}
                              >
                                c
                              </span>
                            </div>
                          </div>
                        )}
                        {sortBy === "referrals" && (
                          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 sm:gap-2.5">
                            <div
                              className={cn(
                                "flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg transition-colors",
                                isDark
                                  ? "bg-blue-400/10 border border-blue-400/30 hover:bg-blue-400/20"
                                  : "bg-blue-50/80 border border-blue-200/60 hover:bg-blue-100/80"
                              )}
                            >
                              <Building2
                                className={cn(
                                  "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                                  isDark ? "text-blue-300" : "text-blue-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-bold",
                                  isDark ? "text-blue-300" : "text-blue-700"
                                )}
                              >
                                {entry.metrics.advertisers_referred || 0}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-medium hidden sm:inline",
                                  isDark ? "text-blue-400" : "text-blue-600"
                                )}
                              >
                                brands
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium sm:hidden",
                                  isDark ? "text-blue-400" : "text-blue-600"
                                )}
                              >
                                b
                              </span>
                            </div>
                            <div
                              className={cn(
                                "flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg transition-colors",
                                isDark
                                  ? "bg-purple-400/10 border border-purple-400/30 hover:bg-purple-400/20"
                                  : "bg-purple-50/80 border border-purple-200/60 hover:bg-purple-100/80"
                              )}
                            >
                              <Users
                                className={cn(
                                  "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                                  isDark ? "text-purple-300" : "text-purple-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-bold",
                                  isDark ? "text-purple-300" : "text-purple-700"
                                )}
                              >
                                {entry.metrics.creators_referred || 0}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-medium hidden sm:inline",
                                  isDark ? "text-purple-400" : "text-purple-600"
                                )}
                              >
                                creators
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium sm:hidden",
                                  isDark ? "text-purple-400" : "text-purple-600"
                                )}
                              >
                                c
                              </span>
                            </div>
                          </div>
                        )}
                        {sortBy === "affiliate_earnings" && (
                          <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 sm:gap-2.5">
                            <div
                              className={cn(
                                "flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg transition-colors",
                                isDark
                                  ? "bg-green-400/10 border border-green-400/30 hover:bg-green-400/20"
                                  : "bg-green-50/80 border border-green-200/60 hover:bg-green-100/80"
                              )}
                            >
                              <TrendingUp
                                className={cn(
                                  "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                                  isDark ? "text-green-300" : "text-green-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-bold",
                                  isDark ? "text-green-300" : "text-green-700"
                                )}
                              >
                                {formatMoney(
                                  entry.metrics.affiliate_earnings || 0
                                )}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-medium hidden sm:inline",
                                  isDark ? "text-green-400" : "text-green-600"
                                )}
                              >
                                Affiliate
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium sm:hidden",
                                  isDark ? "text-green-400" : "text-green-600"
                                )}
                              >
                                A
                              </span>
                            </div>
                            <div
                              className={cn(
                                "flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1.5 rounded-md sm:rounded-lg transition-colors",
                                isDark
                                  ? "bg-teal-400/10 border border-teal-400/30 hover:bg-teal-400/20"
                                  : "bg-teal-50/80 border border-teal-200/60 hover:bg-teal-100/80"
                              )}
                            >
                              <DollarSign
                                className={cn(
                                  "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0",
                                  isDark ? "text-teal-300" : "text-teal-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-bold",
                                  isDark ? "text-teal-300" : "text-teal-700"
                                )}
                              >
                                {formatMoney(entry.metrics.other_earnings || 0)}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] sm:text-xs font-medium hidden sm:inline",
                                  isDark ? "text-teal-400" : "text-teal-600"
                                )}
                              >
                                Other Earnings
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium sm:hidden",
                                  isDark ? "text-teal-400" : "text-teal-600"
                                )}
                              >
                                E
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && !error && leaders.length > 0 && totalPages > 0 && (
              <div className="border-t border-gray-200 pt-4 sm:pt-6 mt-4 sm:mt-6">
                <PaginationControls
                  page={currentPage}
                  limit={limit}
                  isDark={isDark}
                  total={totalItems}
                  totalPages={totalPages}
                  hasNextPage={currentPage < totalPages}
                  hasPreviousPage={currentPage > 1}
                  onPageChange={setCurrentPage}
                  onLimitChange={setLimit}
                  loading={loading}
                  hide200Option
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
