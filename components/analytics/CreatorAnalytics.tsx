"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Trophy,
  TrendingUp,
  Eye,
  MessageCircle,
  Heart,
  Share,
  Youtube,
  Instagram,
  DollarSign,
  Calendar,
} from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";

interface CreatorAnalyticsProps {
  userId: string;
  activeFilter?: string;
}

interface CreatorData {
  leaderboards: {
    topByViews: Array<{
      creator: {
        id: string;
        username: string;
        creator_profiles: {
          total_views: number;
          total_contests_participated: number;
          total_contests_won: number;
          youtube_account: any;
          instagram_account: any;
        };
      };
      totalSubmissions: number;
      totalViews: number;
      totalEarnings: number;
      avgViewsPerSubmission: number;
      platforms: string[];
      firstSubmission: Date;
      lastSubmission: Date;
      daysActive: number;
    }>;
    topBySubmissions: any[];
    topByEarnings: any[];
  };
  summary: {
    totalUniqueCreators: number;
    totalSubmissions: number;
    totalViews: number;
    totalEarnings: number;
    avgSubmissionsPerCreator: number;
    avgViewsPerCreator: number;
    avgEarningsPerCreator: number;
  };
  demographics: {
    platformDemographics: Record<string, number>;
    contestTypePreferences: Record<string, number>;
  };
}

const PlatformIcon = ({ platform }: { platform: string }) => {
  const iconClass = "w-3 h-3 sm:w-5 sm:h-5";

  switch (platform?.toLowerCase()) {
    case "youtube":
      return <Youtube className={iconClass} />;
    case "instagram":
      return <Instagram className={iconClass} />;
    default:
      return <div className={`${iconClass} bg-gray-400 rounded`}></div>;
  }
};

export default function CreatorAnalytics({
  userId,
  activeFilter = "all",
}: CreatorAnalyticsProps) {
  const [data, setData] = useState<CreatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("views");
  const { isDark } = useAnalyticsDarkMode();

  useEffect(() => {
    fetchCreatorData();
  }, [userId, activeFilter]);

  const fetchCreatorData = async () => {
    try {
      setLoading(true);
      const url =
        activeFilter !== "all"
          ? `/api/analytics/creators?status=${activeFilter}`
          : "/api/analytics/creators";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch creator data");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching creator data:", err);
      setError("Failed to fetch creator data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">
          {error || "Failed to load creator analytics"}
        </p>
        <button
          onClick={fetchCreatorData}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { leaderboards, summary, demographics } = data;

  const getCurrentLeaderboard = () => {
    switch (activeTab) {
      case "submissions":
        return leaderboards.topBySubmissions;
      case "earnings":
        return leaderboards.topByEarnings;
      default:
        return leaderboards.topByViews;
    }
  };

  const getLeaderboardTitle = () => {
    switch (activeTab) {
      case "submissions":
        return "Most Active Creators";
      case "earnings":
        return "Top Earners";
      default:
        return "Top Performers by Views";
    }
  };

  const getLeaderboardMetric = (creator: any) => {
    switch (activeTab) {
      case "submissions":
        return creator.totalSubmissions;
      case "earnings":
        return formatCurrencyFromCents(creator.totalEarnings);
      default:
        return creator.totalViews.toLocaleString();
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={cn(
            "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          )}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <h1
              className={cn(
                "text-md font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Total Creators
            </h1>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <Users className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalUniqueCreators}
            </div>
            <p
              className={cn(
                "text-sm mt-2",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              Unique creators engaged
            </p>
          </CardContent>
        </div>

        <div
          className={cn(
            "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          )}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <h1 className="text-md font-medium">Total Submissions</h1>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <MessageCircle className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalSubmissions.toLocaleString()}
            </div>
            <p
              className={cn(
                "text-sm mt-2",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              {summary.avgSubmissionsPerCreator.toFixed(1)} per creator
            </p>
          </CardContent>
        </div>

        <div
          className={cn(
            "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          )}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <h1 className="text-md font-medium">Total Views</h1>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <Eye className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalViews.toLocaleString()}
            </div>
            <p
              className={cn(
                "text-sm mt-2",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              {summary.avgViewsPerCreator.toLocaleString()} per creator
            </p>
          </CardContent>
        </div>

        <div
          className={cn(
            "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-3",
            isDark ? "bg-[#170337] text-white" : "bg-white text-black"
          )}
        >
          <div className="flex flex-row items-center justify-between space-y-0 px-5 pt-2">
            <h1 className="text-md font-medium">Total Earnings</h1>
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-full",
                isDark
                  ? "bg-[#FFFFFF36] text-white"
                  : "bg-[#D8C3FF] text-[#4A00BE]"
              )}
            >
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyFromCents(summary.totalEarnings)}
            </div>
            <p
              className={cn(
                "text-sm mt-2",
                isDark ? "text-gray-300" : "text-gray-600"
              )}
            >
              {formatCurrencyFromCents(
                Math.round(summary.avgEarningsPerCreator * 100)
              )}{" "}
              per creator
            </p>
          </CardContent>
        </div>
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337] text-white"
              : "bg-white text-black"
          )}
        >
          <CardHeader>
            <CardTitle className="text-lg">Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(demographics.platformDemographics).map(
                ([platform, count]) => {
                  const percentage =
                    summary.totalSubmissions > 0
                      ? ((count / summary.totalSubmissions) * 100).toFixed(1)
                      : 0;

                  return (
                    <div
                      key={platform}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <PlatformIcon platform={platform} />
                        <span className="font-medium capitalize">
                          {platform}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{count}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({percentage}%)
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337] text-white"
              : "bg-white text-black"
          )}
        >
          <CardHeader>
            <CardTitle className="text-lg">Contest Type Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(demographics.contestTypePreferences).map(
                ([type, count]) => {
                  const percentage =
                    summary.totalSubmissions > 0
                      ? ((count / summary.totalSubmissions) * 100).toFixed(1)
                      : 0;

                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium capitalize">
                        {type.replace("_", " ")}
                      </span>
                      <div className="text-right">
                        <span className="font-semibold">{count}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({percentage}%)
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Creator Leaderboard */}
      <Card
        className={cn(
          isDark
            ? "bg-[#170337] border-[#170337] text-white"
            : "bg-white text-black"
        )}
      >
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">{getLeaderboardTitle()}</CardTitle>
            <div
              className={cn(
                "flex gap-2 flex-wrap sm:flex-nowrap sm:justify-end",
                isDark ? "text-purple-300" : "text-purple-700"
              )}
            >
              <Button
                variant={activeTab === "views" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("views")}
                className={cn(
                  "border",
                  activeTab === "views"
                    ? isDark
                      ? "border-purple-400 bg-purple-600/20"
                      : "border-purple-500 bg-purple-100 text-purple-700"
                    : isDark
                    ? "border-purple-300 bg-[#170337]"
                    : "border-purple-500/50"
                )}
              >
                Views
              </Button>
              <Button
                variant={activeTab === "submissions" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("submissions")}
                className={cn(
                  "border",
                  activeTab === "submissions"
                    ? isDark
                      ? "border-purple-400 bg-purple-600/20 "
                      : "border-purple-500 bg-purple-100 text-purple-700"
                    : isDark
                    ? "border-purple-300 bg-[#170337]"
                    : "border-purple-500/50"
                )}
              >
                Submissions
              </Button>
              <Button
                variant={activeTab === "earnings" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("earnings")}
                className={cn(
                  "border",
                  activeTab === "earnings"
                    ? isDark
                      ? "border-purple-400 bg-purple-600/20"
                      : "border-purple-500 bg-purple-100 text-purple-700"
                    : isDark
                    ? "border-purple-300 bg-[#170337]"
                    : "border-purple-500/50"
                )}
              >
                Earnings
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {getCurrentLeaderboard()
              .slice(0, 10)
              .map((creator: any, index: number) => (
                <div
                  key={creator.creator.id}
                  className={cn(
                    "flex flex-row items-center justify-between gap-2 p-2 sm:p-4 rounded-lg",
                    isDark
                      ? "bg-[#170337] border border-gray-600"
                      : "bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs sm:text-sm font-semibold text-purple-600">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm sm:text-base truncate">
                        @{creator.creator.username}
                      </h3>
                      <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
                        {creator.platforms.map((platform: string) => (
                          <PlatformIcon key={platform} platform={platform} />
                        ))}
                        <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                          {creator.totalSubmissions} submissions
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm sm:text-lg font-bold whitespace-nowrap">
                      {getLeaderboardMetric(creator)}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                      {creator.avgViewsPerSubmission.toFixed(0)} avg
                      views/submission
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Creator Spotlight */}
      {leaderboards.topByViews.length > 0 && (
        <Card
          className={cn(
            isDark
              ? "bg-[#170337] border-[#170337] text-white"
              : "bg-white text-black"
          )}
        >
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Top Creator Spotlight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4 sm:p-6 rounded-lg",
                isDark
                  ? "bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-white/20 backdrop-blur-2xl"
                  : "bg-gradient-to-r from-purple-50 to-blue-50"
              )}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-purple-600">1</span>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold">
                    @{leaderboards.topByViews[0].creator.username}
                  </h3>
                  <p className="text-muted-foreground">
                    Top performer across all contests
                  </p>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {leaderboards.topByViews[0].totalViews.toLocaleString()}{" "}
                      views
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {leaderboards.topByViews[0].totalSubmissions} submissions
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {formatCurrencyFromCents(
                        leaderboards.topByViews[0].totalEarnings
                      )}{" "}
                      earned
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-left md:text-right self-start md:self-auto">
                <Badge
                  variant="outline"
                  className="bg-yellow-50 text-yellow-700 border-yellow-200"
                >
                  <Trophy className="w-4 h-4 mr-1" />
                  Champion
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
