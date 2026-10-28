"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Award,
  Target,
  Users,
  Twitter,
  RefreshCw,
  Youtube,
  Instagram,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SortBy =
  | "winnings"
  | "affiliate_and_other_earnings"
  | "contests_won"
  | "verified_views"
  | "submissions_won"
  | "referrals"
  | "total_coins";

type PlatformFilter = "all" | "youtube" | "instagram" | "twitter" | "tiktok";
import { SiTiktok } from "react-icons/si";

const formatMoney = (cents: number): string => {
  const dollars = (Number(cents) || 0) / 100;
  const hasCents = Math.round(Math.abs(dollars) * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(dollars);
};

function creatorIdentity(entry: LeaderboardEntry) {
  const fullName = entry.full_name?.trim() || "";
  const username = entry.username?.trim() || "";
  const name = fullName || username || "Anonymous";
  const handle =
    username && fullName && username.toLowerCase() !== fullName.toLowerCase()
      ? `@${username.replace(/^@/, "")}`
      : null;
  return { name, handle };
}

function initials(name: string) {
  const parts = name.replace(/^@/, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function XMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M9.52 6.77 15.04 0h-1.31L8.94 5.88 4.76 0H.16l5.8 8.45L.16 16h1.31l5.07-6.18L11.24 16h4.6L9.52 6.77Zm-1.8 2.09-.59-.84L2.16 1.04h2.02l3.78 5.41.59.84 4.91 7.03h-2.02L7.72 8.86Z" />
    </svg>
  );
}

function contextPills(entry: LeaderboardEntry, sortBy: SortBy): string[] {
  const metrics = entry.metrics;
  switch (sortBy) {
    case "winnings":
      return [
        `${metrics.contests_won || 0} campaigns won`,
        `${metrics.submissions_won || 0} submissions won`,
      ];
    case "contests_won":
      return [`${metrics.contests_participated || 0} campaigns`];
    case "submissions_won":
      return [
        `${metrics.submissions_made || 0} submitted`,
        `${metrics.contests_participated || 0} campaigns`,
      ];
    case "referrals":
      return [
        `${metrics.advertisers_referred || 0} brands`,
        `${metrics.creators_referred || 0} creators`,
      ];
    case "affiliate_and_other_earnings":
      return [
        `${formatMoney(metrics.affiliate_earnings || 0)} affiliate`,
        `${formatMoney(metrics.other_earnings || 0)} bonuses / other`,
      ];
    default:
      return [];
  }
}

function CreatorAvatar({
  entry,
  showImage,
  onImageError,
  isDark,
  className,
}: {
  entry: LeaderboardEntry;
  showImage: boolean;
  onImageError: (userId: string, url?: string) => void;
  isDark: boolean;
  className?: string;
}) {
  const { name } = creatorIdentity(entry);
  return (
    <Avatar className={cn("shrink-0", className)}>
      {showImage && (
        <AvatarImage
          src={entry.profile_picture_url || undefined}
          alt=""
          onError={() =>
            onImageError(entry.user_id, entry.profile_picture_url || undefined)
          }
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <AvatarFallback
        className={cn(
          "text-base font-medium",
          isDark ? "bg-white/10 text-white" : "bg-[#ececef] text-[#3f3f46]",
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function hexPoints(radius: number) {
  return Array.from({ length: 6 }, (_, k) => {
    const angle = ((-90 + 60 * k) * Math.PI) / 180;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

const RANK_RIM = hexPoints(46);
const RANK_FACE = hexPoints(38);

const RANK_TONES: Record<
  1 | 2 | 3,
  { rim: [string, string, string]; numeral: string }
> = {
  1: { rim: ["#f1e6cd", "#a89466", "#3b3322"], numeral: "#ffffff" },
  2: { rim: ["#e3e6ea", "#8a9099", "#2c2f34"], numeral: "#e8eaed" },
  3: { rim: ["#dcb594", "#946142", "#34210f"], numeral: "#e6d3c3" },
};

function RankPlate({ rank, size }: { rank: 1 | 2 | 3; size: number }) {
  const tone = RANK_TONES[rank];
  const id = `rank-plate-${rank}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id={`${id}-rim`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={tone.rim[0]} />
          <stop offset="0.55" stopColor={tone.rim[1]} />
          <stop offset="1" stopColor={tone.rim[2]} />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#2a2a2a" />
          <stop offset="1" stopColor="#121212" />
        </linearGradient>
      </defs>
      <polygon points={RANK_RIM} fill={`url(#${id}-rim)`} />
      <polygon points={RANK_FACE} fill={`url(#${id}-face)`} />
      <polygon
        points={RANK_FACE}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.1"
        strokeWidth="0.8"
      />
      <text
        x="50"
        y="64"
        textAnchor="middle"
        fill={tone.numeral}
        fontSize="42"
        fontWeight="600"
      >
        {rank}
      </text>
    </svg>
  );
}

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
    has_twitter: boolean;
    has_tiktok: boolean;
  };
};

type SummaryStats = {
  totalCreators: number;
  instagramCreators?: number;
  youtubeCreators?: number;
  twitterCreators?: number;
  tiktokCreators?: number;
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
  const [reloadNonce, setReloadNonce] = useState(0);
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

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: "winnings", label: "Total winnings" },
    { value: "affiliate_and_other_earnings", label: "Affiliate & other" },
    { value: "contests_won", label: "Campaigns won" },
    { value: "verified_views", label: "Verified views" },
    { value: "submissions_won", label: "Submissions won" },
    { value: "referrals", label: "Referrals" },
    { value: "total_coins", label: "Coins earned" },
  ];

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
        handleThemeChange as EventListener,
      );
    };
  }, [mode]);
  const handleSortByChange = (value: SortBy) => {
    setLoading(true);
    setLeaders([]);
    setSortBy(value);
    setCurrentPage(1);
  };

  const handlePlatformChange = (value: PlatformFilter) => {
    setLoading(true);
    setLeaders([]);
    setPlatform(value);
    setCurrentPage(1);
  };

  // Fetch static summary once on mount (always with platform="all")
  useEffect(() => {
    fetchStaticSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch leaderboard data; abort stale requests when filters change.
  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadLeaderboard = async () => {
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
        const response = await fetch(`/api/creators/leaderboard?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!isActive) return;

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch leaderboard");
        }

        setLeaders(data.leaders || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalItems(data.pagination?.totalItems || 0);
        setSummary(data.summary || null);
      } catch (err: any) {
        if (!isActive || err?.name === "AbortError") return;
        setError(err.message || "Failed to load leaderboard");
        console.error("Error fetching leaderboard:", err);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadLeaderboard();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [sortBy, platform, currentPage, limit, showAdminSummary, reloadNonce]);

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

  const getMetricValue = (entry: LeaderboardEntry, metric: SortBy) => {
    switch (metric) {
      case "winnings":
        return formatMoney(entry.metrics.winnings);
      case "affiliate_and_other_earnings":
        return formatMoney(
          (entry.metrics.affiliate_earnings || 0) +
            (entry.metrics.other_earnings || 0),
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
  const showPlatformFilters =
    sortBy !== "referrals" &&
    sortBy !== "total_coins" &&
    sortBy !== "affiliate_and_other_earnings" &&
    sortBy !== "verified_views";

  const showAvatarImage = (entry: LeaderboardEntry) =>
    !!entry.profile_picture_url &&
    avatarLoadErrors[entry.user_id] !== entry.profile_picture_url;

  return (
    <div className="pb-4">
      {!summaryOnly && !hideHeroHeader && (
        <div className="mb-6">
          <h1
            className={cn(
              "text-3xl font-semibold tracking-tight sm:text-[34px]",
              isDark ? "text-white" : "text-[#171717]",
            )}
          >
            Creator leaderboard
          </h1>
          <p
            className={cn(
              "mt-2 text-md",
              isDark ? "text-white/60" : "text-gray-600",
            )}
          >
            The top 100 creators on Game of Creators, all time.
          </p>
        </div>
      )}

      {/* Summary Statistics Cards (admin-only when showAdminSummary is true) */}
      {showAdminSummary && staticSummary && (
        <div className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div
            className={cn(
              "shadow-lg transition-all duration-300 overflow-hidden group rounded-lg sm:rounded-xl",
              isDark ? "bg-[#161616]" : "bg-white",
            )}
          >
            <CardHeader
              className={cn(
                "flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 border-b px-3 sm:px-6 pt-3 sm:pt-6",
                isDark
                  ? "bg-gradient-to-br from-violet-900/30 via-violet-800/20 to-purple-900/20 border-violet-700/30"
                  : "bg-gradient-to-br from-violet-100 via-violet-50 to-purple-50 border-violet-100/50",
              )}
            >
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-semibold",
                  isDark ? "text-violet-300" : "text-violet-800",
                )}
              >
                Total Creators
              </CardTitle>
              <div
                className={cn(
                  "p-1 sm:p-1.5 rounded-lg transition-colors",
                  isDark
                    ? "bg-violet-800/30 group-hover:bg-violet-800/40"
                    : "bg-violet-200/50 group-hover:bg-violet-200",
                )}
              >
                <Users
                  className={cn(
                    "h-3.5 w-3.5 sm:h-4 sm:w-4",
                    isDark ? "text-violet-300" : "text-violet-700",
                  )}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
              <div
                className={cn(
                  "text-2xl sm:text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                  isDark
                    ? "from-violet-300 to-purple-300"
                    : "from-violet-700 to-purple-700",
                )}
              >
                {staticSummary.totalCreators.toLocaleString()}
              </div>

              {/* Platform Breakdown */}
              {(staticSummary.instagramCreators !== undefined ||
                staticSummary.youtubeCreators !== undefined ||
                staticSummary.twitterCreators !== undefined) && (
                <p
                  className={cn(
                    "text-xs mt-1 sm:mt-2 font-medium flex items-center gap-2 flex-wrap",
                    isDark ? "text-violet-300/70" : "text-violet-600/70",
                  )}
                >
                  {staticSummary.instagramCreators !== undefined && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <Instagram className="w-3 h-3 text-pink-600" />
                        {staticSummary.instagramCreators.toLocaleString()}{" "}
                        Instagram
                      </span>
                      {(staticSummary.youtubeCreators !== undefined ||
                        staticSummary.twitterCreators !== undefined ||
                        staticSummary.tiktokCreators !== undefined) && (
                        <span
                          className={
                            isDark ? "text-violet-500" : "text-violet-400"
                          }
                        >
                          |
                        </span>
                      )}
                    </>
                  )}
                  {staticSummary.youtubeCreators !== undefined && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <Youtube className="w-3 h-3 text-red-600" />
                        {staticSummary.youtubeCreators.toLocaleString()} YouTube
                      </span>
                      {(staticSummary.twitterCreators !== undefined ||
                        staticSummary.tiktokCreators !== undefined) && (
                        <span
                          className={
                            isDark ? "text-violet-500" : "text-violet-400"
                          }
                        >
                          |
                        </span>
                      )}
                    </>
                  )}
                  {staticSummary.twitterCreators !== undefined && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <Twitter className="w-3 h-3 text-sky-500" />
                        {staticSummary.twitterCreators.toLocaleString()} Twitter
                      </span>
                      {staticSummary.tiktokCreators !== undefined && (
                        <span
                          className={
                            isDark ? "text-violet-500" : "text-violet-400"
                          }
                        >
                          |
                        </span>
                      )}
                    </>
                  )}
                  {staticSummary.tiktokCreators !== undefined && (
                    <span className="flex items-center gap-1.5">
                      <SiTiktok className="w-3 h-3 text-black dark:text-white" />
                      {staticSummary.tiktokCreators.toLocaleString()} TikTok
                    </span>
                  )}
                </p>
              )}
            </CardContent>
          </div>

          <div
            className={cn(
              "shadow-lg transition-all duration-300 overflow-hidden group rounded-lg sm:rounded-xl",
              isDark ? "bg-[#161616]" : "bg-white",
            )}
          >
            <CardHeader
              className={cn(
                "flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 border-b px-3 sm:px-6 pt-3 sm:pt-6",
                isDark
                  ? "bg-gradient-to-br from-amber-900/30 via-yellow-900/20 to-orange-900/20 border-amber-700/30"
                  : "bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-50 border-amber-100/50",
              )}
            >
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-semibold",
                  isDark ? "text-amber-300" : "text-amber-800",
                )}
              >
                Total Campaigns Won
              </CardTitle>
              <div
                className={cn(
                  "p-1 sm:p-1.5 rounded-lg transition-colors",
                  isDark
                    ? "bg-amber-800/30 group-hover:bg-amber-800/40"
                    : "bg-amber-200/50 group-hover:bg-amber-200",
                )}
              >
                <Award
                  className={cn(
                    "h-3.5 w-3.5 sm:h-4 sm:w-4",
                    isDark ? "text-amber-300" : "text-amber-700",
                  )}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
              <div
                className={cn(
                  "text-2xl sm:text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                  isDark
                    ? "from-amber-300 to-orange-300"
                    : "from-amber-700 to-orange-700",
                )}
              >
                {staticSummary.totalContestsWon.toLocaleString()}
              </div>
              <p
                className={cn(
                  "text-xs mt-1 sm:mt-2 font-medium",
                  isDark ? "text-amber-300/80" : "text-amber-600/80",
                )}
              >
                {staticSummary.totalContestsParticipated.toLocaleString()}{" "}
                participated
              </p>
            </CardContent>
          </div>

          <div
            className={cn(
              "shadow-lg transition-all duration-300 overflow-hidden group rounded-lg sm:rounded-xl",
              isDark ? "bg-[#161616]" : "bg-white",
            )}
          >
            <CardHeader
              className={cn(
                "flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 rounded-t-lg border-b px-3 sm:px-6 pt-3 sm:pt-6",
                isDark
                  ? "bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-blue-900/20 border-indigo-700/30"
                  : "bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-50 border-indigo-100/50",
              )}
            >
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-semibold",
                  isDark ? "text-indigo-300" : "text-indigo-800",
                )}
              >
                Total Submissions Won
              </CardTitle>
              <div
                className={cn(
                  "p-1 sm:p-1.5 rounded-lg transition-colors",
                  isDark
                    ? "bg-indigo-800/30 group-hover:bg-indigo-800/40"
                    : "bg-indigo-200/50 group-hover:bg-indigo-200",
                )}
              >
                <Target
                  className={cn(
                    "h-3.5 w-3.5 sm:h-4 sm:w-4",
                    isDark ? "text-indigo-300" : "text-indigo-700",
                  )}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
              <div
                className={cn(
                  "text-2xl sm:text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                  isDark
                    ? "from-indigo-300 to-purple-300"
                    : "from-indigo-700 to-purple-700",
                )}
              >
                {staticSummary.totalSubmissionsWon.toLocaleString()}
              </div>
              <p
                className={cn(
                  "text-xs mt-1 sm:mt-2 font-medium",
                  isDark ? "text-indigo-300/80" : "text-indigo-600/80",
                )}
              >
                {staticSummary.totalSubmissionsMade.toLocaleString()} total
                submissions
              </p>
            </CardContent>
          </div>

          <div
            className={cn(
              "shadow-lg transition-all duration-300 overflow-hidden group rounded-lg sm:rounded-xl",
              isDark ? "bg-[#161616]" : "bg-white",
            )}
          >
            <CardHeader
              className={cn(
                "flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 rounded-t-lg border-b px-3 sm:px-6 pt-3 sm:pt-6",
                isDark
                  ? "bg-gradient-to-br from-pink-900/30 via-rose-900/20 to-fuchsia-900/20 border-pink-700/30"
                  : "bg-gradient-to-br from-pink-100 via-rose-50 to-fuchsia-50 border-pink-100/50",
              )}
            >
              <CardTitle
                className={cn(
                  "text-xs sm:text-sm font-semibold",
                  isDark ? "text-pink-300" : "text-pink-800",
                )}
              >
                Total Referrals
              </CardTitle>
              <div
                className={cn(
                  "p-1 sm:p-1.5 rounded-lg transition-colors",
                  isDark
                    ? "bg-pink-800/30 group-hover:bg-pink-800/40"
                    : "bg-pink-200/50 group-hover:bg-pink-200",
                )}
              >
                <Users
                  className={cn(
                    "h-3.5 w-3.5 sm:h-4 sm:w-4",
                    isDark ? "text-pink-300" : "text-pink-700",
                  )}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6 pb-3 sm:pb-6">
              <div
                className={cn(
                  "text-2xl sm:text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                  isDark
                    ? "from-pink-300 to-rose-300"
                    : "from-pink-700 to-rose-700",
                )}
              >
                {staticSummary.totalReferrals.toLocaleString()}
              </div>
              <p
                className={cn(
                  "text-xs mt-1 sm:mt-2 font-medium",
                  isDark ? "text-pink-300/80" : "text-pink-600/80",
                )}
              >
                {staticSummary.totalAdvertisersReferred} brands,{" "}
                {staticSummary.totalCreatorsReferred} creators
              </p>
            </CardContent>
          </div>
        </div>
      )}

      {!summaryOnly && (
        <div className="mb-6 flex flex-col items-start gap-3">
          <div
            className={cn(
              "flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              isDark ? "bg-white/10" : "bg-[#E4E4E4]",
            )}
            style={{ borderRadius: 9999 }}
          >
            {sortOptions.map((option) => {
              const active = sortBy === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSortByChange(option.value)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium leading-none transition-colors",
                    active
                      ? isDark
                        ? "bg-white/15 text-white shadow-sm"
                        : "bg-white text-[#1a1a1a] shadow-sm"
                      : isDark
                        ? "text-white/75 hover:bg-white/10 hover:text-white"
                        : "text-[#3f3f46] hover:bg-white/80 hover:text-[#1a1a1a]",
                  )}
                  style={{ borderRadius: 9999 }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {showPlatformFilters && (
            <div
              className={cn(
                "flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                isDark ? "bg-white/10" : "bg-[#ececef]",
              )}
              style={{ borderRadius: 9999 }}
            >
              {(
                [
                  { value: "all", label: "All" },
                  { value: "youtube", label: "YouTube" },
                  { value: "instagram", label: "Instagram" },
                  { value: "twitter", label: "Twitter" },
                  { value: "tiktok", label: "TikTok" },
                ] as const
              ).map((option) => {
                const active = platform === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    onClick={() => handlePlatformChange(option.value)}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium leading-none transition-colors",
                      active
                        ? isDark
                          ? "bg-white/15 text-white"
                          : "bg-white text-[#1a1a1a] shadow-sm"
                        : isDark
                          ? "text-white/80 hover:bg-white/5"
                          : "text-[#2a2a2e] hover:bg-white/70",
                    )}
                    style={{ borderRadius: 9999 }}
                  >
                    {option.value === "youtube" && (
                      <Youtube className="h-4 w-4 text-[#ff0033]" />
                    )}
                    {option.value === "instagram" && (
                      <Instagram className="h-4 w-4 text-[#e1306c]" />
                    )}
                    {option.value === "twitter" && (
                      <XMark className="h-3.5 w-3.5" />
                    )}
                    {option.value === "tiktok" && (
                      <SiTiktok className="h-3.5 w-3.5" />
                    )}
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!summaryOnly && (
        <div>
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex flex-col items-center rounded-2xl border px-6 py-8",
                      isDark
                        ? "border-white/10 bg-white/5"
                        : "border-[#e8e8ec] bg-white",
                    )}
                  >
                    <Skeleton className="h-10 w-9" />
                    <Skeleton className="mt-4 h-14 w-14 rounded-full" />
                    <Skeleton className="mt-4 h-4 w-28" />
                    <Skeleton className="mt-2 h-3 w-20" />
                    <Skeleton className="mt-4 h-8 w-24" />
                    <Skeleton className="mt-2 h-3 w-40" />
                  </div>
                ))}
              </div>
              <div
                className={cn(
                  "overflow-hidden rounded-2xl border",
                  isDark
                    ? "border-white/10 bg-white/5"
                    : "border-[#e8e8ec] bg-white",
                )}
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 border-b border-[#f0f0f2] px-5 py-4 last:border-b-0 dark:border-white/10"
                  >
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="mt-2 h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className={cn(
                  "mb-4 rounded-full p-4",
                  isDark ? "bg-red-500/10" : "bg-red-50",
                )}
              >
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <p
                className={cn(
                  "mb-4 font-semibold",
                  isDark ? "text-red-300" : "text-red-600",
                )}
              >
                {error}
              </p>
              <Button
                onClick={() => setReloadNonce((nonce) => nonce + 1)}
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : leaders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className={cn(
                  "mb-4 rounded-full p-4",
                  isDark ? "bg-white/5" : "bg-[#f3f3f5]",
                )}
              >
                <Users
                  className={cn(
                    "h-10 w-10",
                    isDark ? "text-white/40" : "text-[#a1a1aa]",
                  )}
                />
              </div>
              <p
                className={cn(
                  "text-lg font-semibold",
                  isDark ? "text-white" : "text-[#18181b]",
                )}
              >
                No creators found yet
              </p>
              <p
                className={cn(
                  "mt-1 text-sm",
                  isDark ? "text-white/50" : "text-[#71717a]",
                )}
              >
                Check back later for updates!
              </p>
            </div>
          ) : (
            <>
              {currentPage === 1 && leaders.length > 0 && (
                <div className="mb-4 grid grid-cols-1 items-end gap-4 md:grid-cols-3">
                  {[leaders[1], leaders[0], leaders[2]]
                    .filter((entry): entry is LeaderboardEntry => !!entry)
                    .map((entry) => {
                      const rank =
                        leaders.findIndex(
                          (leader) => leader.user_id === entry.user_id,
                        ) + 1;
                      const { name, handle } = creatorIdentity(entry);
                      const pills = contextPills(entry, sortBy);
                      const isFirst = rank === 1;
                      return (
                        <div
                          key={entry.user_id}
                          className={cn(
                            "flex w-full flex-col items-center rounded-2xl border px-6 text-center",
                            rank === 2 && "order-2 md:order-none md:col-start-1",
                            rank === 1 && "order-1 md:order-none md:col-start-2",
                            rank === 3 && "order-3 md:order-none md:col-start-3",
                            isFirst
                              ? isDark
                                ? "border-[#c4a15a]/45 bg-[linear-gradient(180deg,rgba(196,161,90,0.28)_0%,rgba(14,14,14,0.4)_46%,#0e0e0e_78%)] py-8"
                                : "border-[#f0d7a8] bg-[linear-gradient(180deg,#fff6ea_0%,#fffdf8_40%,#ffffff_70%)] py-8 "
                              : isDark
                                ? "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,#161616_46%)] py-7 "
                                : "border-[#e6e6ea] bg-[linear-gradient(180deg,#f3f3f5_0%,#fafafa_34%,#ffffff_68%)] py-7 ",
                          )}
                        >
                          {rank >= 1 && rank <= 3 && (
                            <RankPlate
                              rank={rank as 1 | 2 | 3}
                              size={isFirst ? 56 : 46}
                            />
                          )}
                          <CreatorAvatar
                            entry={entry}
                            showImage={showAvatarImage(entry)}
                            onImageError={handleAvatarError}
                            isDark={isDark}
                            className={cn(
                              "mt-4",
                              isFirst ? "h-16 w-16" : "h-14 w-14",
                            )}
                          />
                          <div
                            className={cn(
                              "mt-3 max-w-full truncate text-lg font-semibold",
                              isDark ? "text-white" : "text-[#18181b]",
                            )}
                          >
                            {name}
                          </div>
                          {handle && (
                            <div
                              className={cn(
                                "mt-0.5 max-w-full truncate text-base",
                                isDark ? "text-white/50" : "text-[#8b8b93]",
                              )}
                            >
                              {handle}
                            </div>
                          )}
                          <div
                            className={cn(
                              "mt-4 text-4xl font-semibold tracking-tight",
                              isDark ? "text-white" : "text-[#18181b]",
                            )}
                          >
                            {getMetricValue(entry, sortBy)}
                          </div>
                          {pills.length > 0 && (
                            <div
                              className={cn(
                                "mt-2 text-base",
                                isDark ? "text-white/50" : "text-[#8b8b93]",
                              )}
                            >
                              {pills.join(" · ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {(currentPage === 1 ? leaders.slice(3) : leaders).length > 0 && (
                <div
                  className={cn(
                    "overflow-x-auto rounded-2xl border",
                    isDark
                      ? "border-white/10 bg-[#161616]"
                      : "border-[#e8e8ec] bg-white",
                  )}
                >
                  {(currentPage === 1 ? leaders.slice(3) : leaders).map(
                    (entry, index) => {
                      const rank =
                        (currentPage - 1) * limit +
                        index +
                        (currentPage === 1 ? 4 : 1);
                      const { name, handle } = creatorIdentity(entry);
                      const pills = contextPills(entry, sortBy);
                      return (
                        <div
                          key={entry.user_id}
                          className={cn(
                            "flex items-center gap-4 border-b px-4 py-4 last:border-b-0 sm:px-6",
                            isDark ? "border-white/10" : "border-[#f1f1f3]",
                          )}
                        >
                          <span
                            className={cn(
                              "w-8 shrink-0 text-base tabular-nums",
                              isDark ? "text-white/50" : "text-[#8a8a93]",
                            )}
                          >
                            {rank}
                          </span>
                          <CreatorAvatar
                            entry={entry}
                            showImage={showAvatarImage(entry)}
                            onImageError={handleAvatarError}
                            isDark={isDark}
                            className="h-12 w-12 text-base"
                          />
                          <div className="min-w-0 w-36 shrink-0 sm:w-52">
                            <div
                              className={cn(
                                "truncate text-base font-semibold",
                                isDark ? "text-white" : "text-[#1a1a1a]",
                              )}
                            >
                              {name}
                            </div>
                            {handle && (
                              <div
                                className={cn(
                                  "truncate text-sm",
                                  isDark ? "text-white/50" : "text-[#8b8b93]",
                                )}
                              >
                                {handle}
                              </div>
                            )}
                          </div>
                          <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
                            {pills.map((pill) => (
                              <span
                                key={pill}
                                className={cn(
                                  "inline-flex h-8 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium leading-none",
                                  isDark
                                    ? "bg-white/10 text-white"
                                    : "bg-[#f2f2f4] text-[#2f2f33]",
                                )}
                                style={{ borderRadius: 9999 }}
                              >
                                {pill}
                              </span>
                            ))}
                          </div>
                          <div
                            className={cn(
                              "min-w-[6.5rem] shrink-0 text-right text-base font-semibold tabular-nums",
                              isDark ? "text-white" : "text-[#1a1a1a]",
                            )}
                          >
                            {getMetricValue(entry, sortBy)}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </>
          )}

          {!loading && !error && leaders.length > 0 && totalPages > 0 && (
            <div
              className={cn(
                "mt-4 border-t pt-4",
                isDark ? "border-white/10" : "border-[#ececee]",
              )}
            >
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
      )}
    </div>
  );
}
