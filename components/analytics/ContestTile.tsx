"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  Heart,
  MessageCircle,
  Share,
  Calendar,
  DollarSign,
  Users,
  Clock,
  TrendingUp,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";

interface ContestTileProps {
  contest: {
    id: string;
    title: string;
    platform: string;
    contest_type: string;
    start_date: string;
    end_date: string;
    created_at: string;
    live_submission_count: number;
    post_contest_status?: string;
    moderation_status?: string;
    contest_based_details?: any;
    thumbnail_url?: string;
    submissions?: Array<{
      id: string;
      views: number;
      other_stats?: {
        [platform: string]: {
          likes?: number;
          comments?: number;
          shares?: number;
          saved?: number;
          reach?: number;
          views?: number;
        };
      };
      status: string;
      created_at: string;
    }>;
  };
  onViewDetails: (contestId: string) => void;
}

const PlatformIcon = ({ platform }: { platform: string }) => {
  const iconClass = "w-5 h-5";
  const gradientId = `instagram-gradient-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  switch (platform?.toLowerCase()) {
    case "youtube":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="#FF0000">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "instagram":
      return (
        <svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill={`url(#${gradientId})`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#833AB4" />
              <stop offset="50%" stopColor="#E1306C" />
              <stop offset="100%" stopColor="#FD1D1D" />
            </linearGradient>
          </defs>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    default:
      return <div className={`${iconClass} bg-gray-400 rounded`}></div>;
  }
};

const getStatusColor = (status: string, isDark: boolean = false) => {
  if (isDark) {
    switch (status?.toLowerCase()) {
      case "active":
      case "published":
        return "bg-gradient-to-r from-emerald-900/30 to-green-900/30 text-emerald-300 border-emerald-700 shadow-emerald-900/20 shadow-sm";
      case "draft":
        return "bg-gradient-to-r from-slate-800/30 to-gray-800/30 text-slate-300 border-slate-600 shadow-slate-900/20 shadow-sm";
      case "pending":
        return "bg-gradient-to-r from-amber-900/30 to-yellow-900/30 text-amber-300 border-amber-700 shadow-amber-900/20 shadow-sm";
      case "rejected":
        return "bg-gradient-to-r from-rose-900/30 to-red-900/30 text-rose-300 border-rose-700 shadow-rose-900/20 shadow-sm";
      case "completed":
        return "bg-gradient-to-r from-green-900/30 to-blue-900/30 text-green-300 border-green-700 shadow-green-900/20 shadow-sm";
      default:
        return "bg-gradient-to-r from-slate-800/30 to-gray-800/30 text-slate-300 border-slate-600 shadow-slate-900/20 shadow-sm";
    }
  }

  switch (status?.toLowerCase()) {
    case "active":
    case "published":
      return "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-200 shadow-emerald-100/50 shadow-sm";
    case "draft":
      return "bg-gradient-to-r from-slate-50 to-gray-50 text-slate-700 border-slate-200 shadow-slate-100/50 shadow-sm";
    case "pending":
      return "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-amber-200 shadow-amber-100/50 shadow-sm";
    case "rejected":
      return "bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border-rose-200 shadow-rose-100/50 shadow-sm";
    case "completed":
      return "bg-gradient-to-r from-green-50 to-blue-50 text-green-800 border-green-200 shadow-green-100/50 shadow-sm";
    default:
      return "bg-gradient-to-r from-slate-50 to-gray-50 text-slate-700 border-slate-200 shadow-slate-100/50 shadow-sm";
  }
};

const getPlatformColor = (platform: string, isDark: boolean = false) => {
  if (isDark) {
    switch (platform?.toLowerCase()) {
      case "youtube":
        return "bg-red-900/30 text-red-300 border-red-700";
      case "instagram":
        return "bg-gradient-to-r from-purple-900/30 to-pink-900/30 text-purple-300 border-purple-700";
      default:
        return "bg-gray-800/30 text-gray-300 border-gray-600";
    }
  }

  switch (platform?.toLowerCase()) {
    case "youtube":
      return "bg-red-50 text-red-700 border-red-200";
    case "instagram":
      return "bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-purple-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDaysRemaining = (endDate: string) => {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function ContestTile({
  contest,
  onViewDetails,
}: ContestTileProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate metrics from filtered submissions
  const filteredSubmissions = contest.submissions || [];
  const platform = contest.platform?.toLowerCase();
  // Initialize mode state with proper detection to prevent flash
  const [mode, setMode] = useState<"light" | "dark">(() => {
    // Check if we're in browser environment
    if (typeof window !== "undefined") {
      // Try to get theme from data-theme attribute first
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme") as
        | "light"
        | "dark";
      if (dataTheme) return dataTheme;

      // Fallback to data-mode attribute
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (dataMode) return dataMode;
      }

      // Check localStorage as last resort
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
  // Extract metrics from nested other_stats structure
  const totalViews = filteredSubmissions.reduce((sum, sub) => {
    // Use platform-specific views from other_stats, fallback to direct views
    const platformViews = sub.other_stats?.[platform]?.views || 0;
    const directViews = sub.views || 0;
    // Use the higher value or platform-specific if available
    return sum + (platformViews > 0 ? platformViews : directViews);
  }, 0);

  const totalLikes = filteredSubmissions.reduce((sum, sub) => {
    return sum + (sub.other_stats?.[platform]?.likes || 0);
  }, 0);

  const totalComments = filteredSubmissions.reduce((sum, sub) => {
    return sum + (sub.other_stats?.[platform]?.comments || 0);
  }, 0);

  const totalShares = filteredSubmissions.reduce((sum, sub) => {
    return sum + (sub.other_stats?.[platform]?.shares || 0);
  }, 0);

  const totalSaved = filteredSubmissions.reduce((sum, sub) => {
    return sum + (sub.other_stats?.[platform]?.saved || 0);
  }, 0);

  const totalReach = filteredSubmissions.reduce((sum, sub) => {
    return sum + (sub.other_stats?.[platform]?.reach || 0);
  }, 0);

  // Calculate total spent
  let totalSpent = 0;
  if (
    contest.contest_type === "leaderboard" &&
    contest.contest_based_details?.leaderboard_contest?.total_prize
  ) {
    totalSpent = contest.contest_based_details.leaderboard_contest.total_prize;
  } else if (
    contest.contest_type === "cpm" &&
    contest.contest_based_details?.cpm_contest?.total_budget
  ) {
    totalSpent = contest.contest_based_details.cpm_contest.total_budget;
  }

  const daysRemaining = getDaysRemaining(contest.end_date);
  const isActive = daysRemaining > 0;
  const status = isActive ? "Active" : "Completed";
  // Read mode from data attribute with immediate updates
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode && currentMode !== mode) {
          setMode(currentMode);
        }
      }
    };

    // Check immediately
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

  const isDark = mode === "dark";
  // Platform-specific metrics
  const getPlatformMetrics = () => {
    const platform = contest.platform?.toLowerCase();

    if (platform === "instagram") {
      return [
        {
          icon: Users,
          label: "Submissions",
          value: contest.live_submission_count || 0,
        },
        { icon: Eye, label: "Views", value: totalViews.toLocaleString() },
        { icon: Heart, label: "Likes", value: totalLikes.toLocaleString() },
        {
          icon: MessageCircle,
          label: "Comments",
          value: totalComments.toLocaleString(),
        },
        { icon: Share, label: "Shares", value: totalShares.toLocaleString() },
        {
          icon: TrendingUp,
          label: "Reach",
          value: totalReach.toLocaleString(),
        },
        { icon: Target, label: "Saved", value: totalSaved.toLocaleString() },
      ];
    } else if (platform === "youtube") {
      return [
        {
          icon: Users,
          label: "Submissions",
          value: contest.live_submission_count || 0,
        },
        { icon: Eye, label: "Views", value: totalViews.toLocaleString() },
        { icon: Heart, label: "Likes", value: totalLikes.toLocaleString() },
        {
          icon: MessageCircle,
          label: "Comments",
          value: totalComments.toLocaleString(),
        },
      ];
    } else {
      return [
        {
          icon: Users,
          label: "Submissions",
          value: contest.live_submission_count || 0,
        },
        { icon: Eye, label: "Views", value: totalViews.toLocaleString() },
        { icon: Heart, label: "Likes", value: totalLikes.toLocaleString() },
        {
          icon: MessageCircle,
          label: "Comments",
          value: totalComments.toLocaleString(),
        },
      ];
    }
  };

  const platformMetrics = getPlatformMetrics();

  return (
    <div
      className={`transition-all duration-300 rounded-xl hover:shadow-lg cursor-pointer group border hover:border-purple-300 ${
        isDark
          ? ` ${isHovered ? "shadow-lg border-purple-300" : "border-gray-600"}`
          : `bg-white ${
              isHovered ? "shadow-lg border-purple-300" : "border-gray-400"
            }`
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onViewDetails(contest.id)}
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-6">
          {/* Contest Thumbnail */}
          <div className="flex-shrink-0">
            <div className="w-32 h-20 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center border-2 border-purple-200 group-hover:border-purple-300 transition-colors overflow-hidden">
              {contest.thumbnail_url && contest.thumbnail_url.trim() !== "" ? (
                <img
                  src={contest.thumbnail_url}
                  alt={contest.title}
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    // Hide image on error and show platform icon instead
                    const img = e.currentTarget;
                    const fallback = img.nextElementSibling as HTMLElement;
                    img.style.display = "none";
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <div className="hidden flex items-center justify-center w-full h-full">
                <PlatformIcon platform={contest.platform} />
              </div>
            </div>
          </div>

          {/* Contest Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <h3
                    className={cn(
                      "text-xl font-bold flex items-center gap-2",
                      isDark
                        ? "text-white"
                        : "text-gray-900 group-hover:text-purple-700 transition-colors "
                    )}
                  >
                    {contest.title}
                    <PlatformIcon platform={contest.platform} />
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-sm px-3 py-1 ${getStatusColor(
                      status,
                      isDark
                    )} font-medium`}
                  >
                    {status}
                  </Badge>
                  <span
                    className={`text-sm px-3 py-1 rounded-full border ${getPlatformColor(
                      contest.platform,
                      isDark
                    )}`}
                  >
                    {contest.platform?.toUpperCase()}
                  </span>
                  {isActive && (
                    <span
                      className={cn(
                        "text-sm px-3 py-1 rounded-full border",
                        isDark
                          ? "text-purple-300 bg-purple-900/30 border-purple-700"
                          : "text-gray-600 bg-purple-50 border-purple-200"
                      )}
                    >
                      ⏰{" "}
                      {daysRemaining > 0
                        ? `${daysRemaining} days left`
                        : "Ended"}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    "text-2xl font-bold mb-1",
                    isDark ? "text-purple-400" : "text-purple-600"
                  )}
                >
                  {formatCurrencyFromCents(totalSpent)}
                </div>
                <div
                  className={cn(
                    "text-xs font-medium",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}
                >
                  Total Payout
                </div>
              </div>
            </div>

            {/* Platform-specific Metrics */}
            <div
              className={`grid gap-3 mb-4 ${
                platform === "instagram"
                  ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
                  : "grid-cols-2 md:grid-cols-4"
              }`}
            >
              {platformMetrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={index}
                    className={cn(
                      "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3 flex flex-col items-center text-center",
                      isDark ? "bg-[#170337] text-white" : "bg-white text-black"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-full mb-2",
                        isDark
                          ? "bg-[#FFFFFF36] text-white"
                          : "bg-[#D8C3FF] text-[#4A00BE]"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={cn(
                        "text-[12px] font-medium mb-1",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      {metric.label}
                    </span>
                    <div
                      className={cn(
                        "text-lg font-bold",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      {metric.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Contest Dates */}
            <div
              className={cn(
                "flex items-center gap-6 text-sm",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              <div className="flex items-center gap-2">
                <Calendar
                  className={cn(
                    "w-4 h-4",
                    isDark ? "text-purple-400" : "text-purple-600"
                  )}
                />
                <span className="font-medium">Launch:</span>
                <span>{formatDate(contest.start_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock
                  className={cn(
                    "w-4 h-4",
                    isDark ? "text-purple-400" : "text-purple-600"
                  )}
                />
                <span className="font-medium">End:</span>
                <span>{formatDate(contest.end_date)}</span>
              </div>
            </div>
          </div>

          {/* View Details Button */}
          <div className="flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "opacity-0 group-hover:opacity-100 transition-all duration-300",
                isDark
                  ? "text-purple-400 border-purple-300"
                  : "text-purple-600 border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
              )}
            >
              View Details →
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
