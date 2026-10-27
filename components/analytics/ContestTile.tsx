"use client";

import {
  Eye,
  Heart,
  MessageCircle,
  Share,
  Calendar,
  Users,
  Clock,
  TrendingUp,
  Target,
} from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { getContestPlatformIcons } from "@/lib/platform-icons";
import { cn } from "@/lib/utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";

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
    budgetTile?: {
      mode: "filled" | "paid";
      numeratorCents: number;
      denominatorCents: number;
      label: string;
    } | null;
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
          replies?: number;
          retweets?: number;
          quote_reposts?: number;
          impressions?: number;
        };
      };
      status: string;
      created_at: string;
    }>;
  };
  onViewDetails: (contestId: string) => void;
}

const getStatusColor = (status: string, isDark: boolean = false) => {
  if (isDark) {
    switch (status?.toLowerCase()) {
      case "active":
      case "published":
        return "bg-emerald-500/15 text-emerald-300 border-transparent";
      case "draft":
        return "bg-white/10 text-white/80 border-transparent";
      case "pending":
        return "bg-amber-500/15 text-amber-300 border-transparent";
      case "rejected":
        return "bg-rose-500/15 text-rose-300 border-transparent";
      case "completed":
        return "bg-emerald-500/15 text-emerald-300 border-transparent";
      default:
        return "bg-white/10 text-white/80 border-transparent";
    }
  }

  switch (status?.toLowerCase()) {
    case "active":
    case "published":
      return "bg-[#E8F6EE] text-[#17803D] border-transparent";
    case "draft":
      return "bg-[#F4F4F5] text-[#52525B] border-transparent";
    case "pending":
      return "bg-[#FEF6E7] text-[#B45309] border-transparent";
    case "rejected":
      return "bg-[#FDECEC] text-[#B42318] border-transparent";
    case "completed":
      return "bg-[#E8F6EE] text-[#17803D] border-transparent";
    default:
      return "bg-[#F4F4F5] text-[#52525B] border-transparent";
  }
};

const getPlatformColor = (_platform: string, isDark: boolean = false) => {
  return isDark
    ? "bg-white/10 text-white/80 border-transparent"
    : "bg-[#F4F4F5] text-[#3F3F46] border-transparent";
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
  const { isDark, isInitialized } = useAnalyticsDarkMode();

  // Get initial theme from DOM to prevent flash
  const getInitialTheme = () => {
    if (typeof window === "undefined") return false;

    // Check data-theme attribute first
    const themeElement = document.documentElement;
    const dataTheme = themeElement.getAttribute("data-theme");
    if (dataTheme === "dark") return true;

    // Check data-mode attribute
    const modeElement = document.querySelector("[data-mode]");
    if (modeElement) {
      const dataMode = modeElement.getAttribute("data-mode");
      if (dataMode === "dark") return true;
    }

    // Check localStorage
    try {
      const savedMode = localStorage.getItem("dashboard-mode");
      if (savedMode === "dark") return true;

      const preset = localStorage.getItem("dashboard-preset");
      if (preset === "game-of-creators" || preset === "dark-professional") {
        return true;
      }
    } catch (e) {
      // Ignore localStorage errors
    }

    return false;
  };

  // Don't render until dark mode is properly initialized to prevent flash
  if (!isInitialized) {
    const isInitiallyDark = getInitialTheme();
    return (
      <div className="animate-pulse">
        <div
          className={cn(
            "h-40 w-full rounded-2xl border sm:h-48 lg:h-56",
            isInitiallyDark
              ? "border-white/10 bg-[#121212]"
              : "border-neutral-200 bg-[#F6F6F7]",
          )}
        ></div>
      </div>
    );
  }

  // Calculate metrics from filtered submissions
  const filteredSubmissions = contest.submissions || [];
  const platform = contest.platform?.toLowerCase();
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

  const totalReplies = filteredSubmissions.reduce((sum, sub) => {
    return sum + (sub.other_stats?.[platform]?.replies || 0);
  }, 0);

  const totalRetweets = filteredSubmissions.reduce((sum, sub) => {
    return sum + (sub.other_stats?.[platform]?.retweets || 0);
  }, 0);

  const totalQuoteReposts = filteredSubmissions.reduce((sum, sub) => {
    return sum + (sub.other_stats?.[platform]?.quote_reposts || 0);
  }, 0);

  const twitterMetrics = (
    contest as {
      twitter_metrics?: {
        likes: number;
        replies: number;
        retweets: number;
        quote_reposts: number;
        impressions: number;
      };
    }
  ).twitter_metrics;
  const isTwitter = platform === "twitter" || platform === "x";

  const budgetTile = contest.budgetTile;
  const showBudgetRatio =
    budgetTile != null && budgetTile.denominatorCents > 0;

  const daysRemaining = getDaysRemaining(contest.end_date);
  const isActive = daysRemaining > 0;
  const status = isActive ? "Active" : "Completed";

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
    } else if (platform === "tiktok") {
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
      ];
    } else if (
      isTwitter &&
      (twitterMetrics ||
        totalLikes > 0 ||
        totalReplies > 0 ||
        totalRetweets > 0 ||
        totalQuoteReposts > 0)
    ) {
      const likes = twitterMetrics?.likes ?? totalLikes;
      const replies = twitterMetrics?.replies ?? totalReplies;
      const retweets = twitterMetrics?.retweets ?? totalRetweets;
      const quoteReposts = twitterMetrics?.quote_reposts ?? totalQuoteReposts;
      const impressions = twitterMetrics?.impressions ?? totalViews;
      return [
        {
          icon: Users,
          label: "Submissions",
          value: contest.live_submission_count || 0,
        },
        {
          icon: Eye,
          label: "Impressions",
          value: impressions.toLocaleString(),
        },
        { icon: Heart, label: "Likes", value: likes.toLocaleString() },
        {
          icon: MessageCircle,
          label: "Replies",
          value: replies.toLocaleString(),
        },
        { icon: Share, label: "Retweets", value: retweets.toLocaleString() },
        {
          icon: TrendingUp,
          label: "Quote Reposts",
          value: quoteReposts.toLocaleString(),
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
      className={cn(
        "group w-full cursor-pointer rounded-2xl border transition-shadow duration-300",
        isDark
          ? "border-white/10 bg-[#121212] text-white hover:shadow-lg"
          : "border-neutral-200 bg-white text-[#171717] shadow-[0px_5px_20px_0px_#0000000D] hover:shadow-[0px_8px_24px_0px_#00000014]",
      )}
      onClick={() => onViewDetails(contest.id)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 sm:gap-5 lg:gap-6">
          {/* Contest Thumbnail */}
          <div className="flex-shrink-0 flex justify-center lg:justify-start w-full sm:w-auto">
            <div className="w-full sm:w-40 md:w-32 h-40 sm:h-28 md:h-20 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center border-2 border-purple-200 group-hover:border-purple-300 transition-colors overflow-hidden relative">
              {contest.thumbnail_url && contest.thumbnail_url.trim() !== "" ? (
                <img
                  src={contest.thumbnail_url}
                  alt={contest.title}
                  className="w-full h-full object-contain sm:object-cover rounded-lg"
                  onError={(e) => {
                    // Hide image on error and show platform icon instead
                    const img = e.currentTarget;
                    const fallback = img.nextElementSibling as HTMLElement;
                    img.style.display = "none";
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className={cn(
                  "items-center justify-center w-full h-full gap-1",
                  contest.thumbnail_url && contest.thumbnail_url.trim() !== ""
                    ? "hidden"
                    : "flex",
                )}
              >
                {getContestPlatformIcons(contest.platform, "sm")}
              </div>
            </div>
          </div>

          {/* Contest Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <h3
                    className={cn(
                      "flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight sm:text-lg",
                      isDark ? "text-white" : "text-[#171717]",
                    )}
                  >
                    <span className="break-words">{contest.title}</span>
                    {getContestPlatformIcons(contest.platform, "sm")}
                  </h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-7 shrink-0 rounded-full px-2.5 text-xs font-medium",
                      getStatusColor(status, isDark),
                    )}
                  >
                    {status}
                  </Badge>
                  <span
                    className={cn(
                      "inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium",
                      getPlatformColor(contest.platform, isDark),
                    )}
                  >
                    {contest.platform?.toUpperCase()}
                  </span>
                  {isActive && (
                    <span
                      className={cn(
                        "inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-medium",
                        isDark
                          ? "bg-white/10 text-white/80"
                          : "bg-[#F4F4F5] text-[#3F3F46]",
                      )}
                    >
                      {daysRemaining > 0
                        ? `${daysRemaining} days left`
                        : "Ended"}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-left sm:text-right flex-shrink-0">
                {showBudgetRatio ? (
                  <>
                    <div className="mb-1 flex flex-wrap items-baseline justify-start gap-x-1 text-lg font-semibold tracking-tight text-[#7F39EC] sm:justify-end sm:text-xl">
                      <span>
                        {formatCurrencyFromCents(budgetTile!.numeratorCents)}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isDark ? "text-white/40" : "text-[#A1A1AA]",
                        )}
                      >
                        /
                      </span>
                      <span>
                        {formatCurrencyFromCents(budgetTile!.denominatorCents)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "max-w-[12rem] text-xs font-medium sm:max-w-none",
                        isDark ? "text-white/50" : "text-[#737373]",
                      )}
                    >
                      {budgetTile!.label}
                    </div>
                  </>
                ) : (
                  <div
                    className={cn(
                      "text-xs font-medium",
                      isDark ? "text-white/50" : "text-[#737373]",
                    )}
                  >
                    —
                  </div>
                )}
              </div>
            </div>

            {/* Platform-specific Metrics - single row */}
            <div className="flex flex-nowrap gap-2 sm:gap-3 mb-3 sm:mb-4 overflow-x-auto pb-1">
              {platformMetrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex min-w-[4.5rem] flex-1 flex-col items-center rounded-xl border p-2 text-center sm:min-w-[5rem] sm:p-3",
                      isDark
                        ? "border-white/10 bg-white/5 text-white"
                        : "border-black/5 bg-white text-[#171717] shadow-[0px_5px_20px_0px_#0000000D]",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-1 flex h-6 w-6 items-center justify-center rounded-full sm:mb-2 sm:h-8 sm:w-8",
                        isDark
                          ? "bg-white/10 text-white"
                          : "bg-[#F4F4F5] text-[#171717]",
                      )}
                    >
                      <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                    <span
                      className={cn(
                        "mb-1 text-[10px] font-medium sm:text-xs",
                        isDark ? "text-white/60" : "text-[#737373]",
                      )}
                    >
                      {metric.label}
                    </span>
                    <div className="text-sm font-semibold tracking-tight sm:text-base">
                      {metric.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Contest Dates */}
            <div
              className={cn(
                "flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:gap-6 sm:text-sm",
                isDark ? "text-white/70" : "text-[#52525B]",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-[#7F39EC] sm:h-4 sm:w-4" />
                <span className="font-medium">Launch:</span>
                <span className="break-words">
                  {formatDate(contest.start_date)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0 text-[#7F39EC] sm:h-4 sm:w-4" />
                <span className="font-medium">End:</span>
                <span className="break-words">
                  {formatDate(contest.end_date)}
                </span>
              </div>
            </div>
          </div>

          {/* View Details Button */}
          <div className="flex-shrink-0 flex justify-center lg:justify-end">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 w-full rounded-full border-transparent px-4 text-sm font-medium shadow-none transition-all duration-300 sm:w-auto lg:opacity-0 lg:group-hover:opacity-100",
                isDark
                  ? "bg-white text-[#171717] hover:bg-white/90"
                  : "bg-[#171717] text-white hover:bg-[#171717]/90",
              )}
            >
              <span className="hidden sm:inline">View Details →</span>
              <span className="sm:hidden">View Details</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
