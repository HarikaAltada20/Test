"use client";

import { useState, useEffect } from "react";
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
import {
  EnhancedTabs as Tabs,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";

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

export default function LeaderboardClient() {
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

  // Reset to page 1 when sortBy or platform changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, platform]);

  // Fetch leaderboard data
  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, platform, currentPage, limit]);

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
        return formatMoney(entry.metrics.affiliate_earnings);
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

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 md:py-8">
      {/* Hero Header */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 bg-white shadow-md">
          {/* <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" /> */}
          <div className="relative">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="p-1.5 sm:p-2">
                <Award className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gray-900" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
                Creator Leaderboard
              </h1>
            </div>
            <p className="text-gray-900 text-sm sm:text-base md:text-lg">
              See who's dominating the leaderboard across different metrics.
              Compare your performance and climb the ranks!
            </p>
          </div>
        </div>
      </div>

      {/* Summary Statistics Cards */}
      {summary && (
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
                {summary.totalCreators.toLocaleString()}
              </div>
              <p className="text-xs text-violet-600/80 mt-1 sm:mt-2 font-medium">
                {platform === "all"
                  ? "All platforms"
                  : platform === "youtube"
                  ? "YouTube creators"
                  : "Instagram creators"}
              </p>
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
                {summary.totalContestsWon.toLocaleString()}
              </div>
              <p className="text-xs text-amber-600/80 mt-1 sm:mt-2 font-medium">
                {summary.totalContestsParticipated.toLocaleString()}{" "}
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
                {summary.totalSubmissionsWon.toLocaleString()}
              </div>
              <p className="text-xs text-indigo-600/80 mt-1 sm:mt-2 font-medium">
                {summary.totalSubmissionsMade.toLocaleString()} total
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
                {summary.totalReferrals.toLocaleString()}
              </div>
              <p className="text-xs text-pink-600/80 mt-1 sm:mt-2 font-medium">
                {summary.totalAdvertisersReferred} brands,{" "}
                {summary.totalCreatorsReferred} creators
              </p>
            </CardContent>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-gray-50/30 to-white shadow-md py-4 sm:py-6 px-2 sm:px-3 backdrop-blur-sm">
        <Tabs
          value={sortBy}
          onValueChange={(value) => setSortBy(value as SortBy)}
        >
          <TabsList className="flex gap-1.5 sm:gap-2.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {sortOptions.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="border border-gray-600 text-xs sm:text-sm text-gray-700 inline-flex items-center px-2 sm:px-3 py-2 rounded-full flex-shrink-0"
              >
                {/* <span className="flex-shrink-0">{option.icon}</span> */}
                <span className="whitespace-nowrap">{option.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl sm:rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="w-full md:w-auto">
            <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent truncate">
              {getMetricLabel(sortBy)}
            </h2>
            {/* <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <Users className="w-3 h-3" />
              Showing top 100 creators • {limit} per page
            </p> */}
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <div className="inline-flex items-center gap-1 rounded-lg sm:rounded-xl border-2 border-gray-200 p-0.5 sm:p-1 bg-white overflow-x-auto whitespace-nowrap shadow-inner">
              <Button
                type="button"
                size="sm"
                variant={platform === "all" ? "default" : "ghost"}
                className={
                  platform === "all"
                    ? "shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-violet-300/50 font-bold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 flex-shrink-0"
                    : "text-gray-600 hover:text-violet-600 hover:bg-violet-50/50 transition-all duration-300 font-semibold text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 flex-shrink-0"
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
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-red-700/30 font-bold text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 flex-shrink-0"
                    : "text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-300 font-semibold text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 flex-shrink-0"
                }
                onClick={() => setPlatform("youtube")}
              >
                <Youtube className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 flex-shrink-0" />
                <span >YouTube</span>
                {/* <span className="sm:hidden">YT</span> */}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={platform === "instagram" ? "default" : "ghost"}
                className={
                  platform === "instagram"
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-purple-700/30 font-bold text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 flex-shrink-0"
                    : "text-pink-600 hover:text-pink-700 hover:bg-pink-50 transition-all duration-300 font-semibold text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 flex-shrink-0"
                }
                onClick={() => setPlatform("instagram")}
              >
                <Instagram className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 flex-shrink-0" />
                <span >Instagram</span>
                {/* <span className="sm:hidden">IG</span> */}
              </Button>
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-br from-gray-50/30 to-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-violet-600 mb-4" />
              <p className="text-muted-foreground">Loading leaderboard...</p>
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

                return (
                  <div
                    key={entry.user_id}
                    className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border-2 transition-all duration-300 bg-white border-gray-200 hover:border-violet-300 hover:shadow-lg sm:hover:scale-[1.01]"
                  >
                    {/* Left Section: Rank, Avatar, and User Info */}
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 w-full sm:w-auto">
                      {/* Rank Badge */}
                      <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex-shrink-0">
                        <div className="flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 group-hover:border-violet-400 transition-colors">
                          <span className="text-base sm:text-lg md:text-xl font-bold text-gray-700 group-hover:text-violet-600">
                            {rank}
                          </span>
                        </div>
                      </div>

                      {/* Avatar */}
                      <Avatar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 ring-2 sm:ring-4 ring-offset-1 sm:ring-offset-2 transition-all duration-300 ring-gray-100 group-hover:ring-violet-100 group-hover:shadow-lg flex-shrink-0">
                        <AvatarImage
                          src={entry.profile_picture_url || undefined}
                        />
                        <AvatarFallback className="bg-violet-100 text-violet-600 font-semibold text-sm sm:text-base">
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-base sm:text-lg truncate text-gray-900 group-hover:text-violet-600">
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
                    <div className="text-left sm:text-right flex-shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                      <div className="text-xl sm:text-2xl text-gray-700 font-bold">
                        {metricValue}
                      </div>
                      {sortBy === "winnings" && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-emerald-50/80 border border-emerald-200/60 hover:bg-emerald-100/80 transition-colors">
                            <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-emerald-700">
                              {entry.metrics.contests_participated || 0}
                            </span>
                            <span className="text-xs font-medium text-emerald-600">
                              contests
                            </span>
                            {/* <span className="text-xs font-medium text-emerald-600 sm:hidden">
                              c
                            </span> */}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-blue-50/80 border border-blue-200/60 hover:bg-teal-100/80 transition-colors">
                            <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-blue-700">
                              {entry.metrics.submissions_made || 0}
                            </span>
                            <span className="text-xs font-medium text-blue-600">
                              submissions
                            </span>
                            {/* <span className="text-xs font-medium text-blue-600 sm:hidden">
                              s
                            </span> */}
                          </div>
                        </div>
                      )}
                      {sortBy === "contests_won" && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-blue-50/80 border border-blue-200/60 hover:bg-blue-100/80 transition-colors">
                            <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-blue-700">
                              {entry.metrics.contests_participated || 0}
                            </span>
                            <span className="text-xs font-medium text-blue-600">
                              participated
                            </span>
                            {/* <span className="text-xs font-medium text-blue-600 sm:hidden">
                              p
                            </span> */}
                          </div>
                        </div>
                      )}
                      {sortBy === "submissions_won" && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-indigo-50/80 border border-indigo-200/60 hover:bg-indigo-100/80 transition-colors">
                            <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-indigo-700">
                              {entry.metrics.submissions_made || 0}
                            </span>
                            <span className="text-xs font-medium text-indigo-600">
                              submitted
                            </span>
                            {/* <span className="text-xs font-medium text-indigo-600 sm:hidden">
                              s
                            </span> */}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-emerald-50/80 border border-emerald-200/60 hover:bg-emerald-100/80 transition-colors">
                            <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-emerald-700">
                              {entry.metrics.contests_participated || 0}
                            </span>
                            <span className="text-xs font-medium text-emerald-600">
                              contests
                            </span>
                            {/* <span className="text-xs font-medium text-emerald-600 sm:hidden">
                            contests
                            </span> */}
                          </div>
                        </div>
                      )}
                      {sortBy === "referrals" && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-blue-50/80 border border-blue-200/60 hover:bg-blue-100/80 transition-colors">
                            <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-blue-700">
                              {entry.metrics.advertisers_referred || 0}
                            </span>
                            <span className="text-xs font-medium text-blue-600">
                              brands
                            </span>
                            {/* <span className="text-xs font-medium text-blue-600 sm:hidden">
                              b
                            </span> */}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-purple-50/80 border border-purple-200/60 hover:bg-purple-100/80 transition-colors">
                            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-purple-700">
                              {entry.metrics.creators_referred || 0}
                            </span>
                            <span className="text-xs font-medium text-purple-600">
                              creators
                            </span>
                            {/* <span className="text-xs font-medium text-purple-600 sm:hidden">
                              c
                            </span> */}
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
    </div>
  );
}
