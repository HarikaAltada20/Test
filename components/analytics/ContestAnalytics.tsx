"use client";

import { useState, useEffect } from "react";
import ContestTile from "./ContestTile";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";

interface ContestAnalyticsProps {
  userId: string;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  contentType?: "video" | "text_image";
  videoPlatform?: string;
  twitterAnalytics?: boolean;
  contestTypeFilter?: "all" | "leaderboard" | "cpm";
}

interface Contest {
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
}

export default function ContestAnalytics({
  userId,
  activeFilter = "all",
  onFilterChange,
  contentType = "video",
  videoPlatform = "all",
  twitterAnalytics = false,
  contestTypeFilter = "all",
}: ContestAnalyticsProps) {
  const [contests, setContests] = useState<Contest[]>([]);
  const [filteredContests, setFilteredContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDark } = useAnalyticsDarkMode();

  useEffect(() => {
    fetchContests();
  }, [
    userId,
    activeFilter,
    contentType,
    videoPlatform,
    twitterAnalytics,
    contestTypeFilter,
  ]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeFilter && activeFilter !== "all") {
        if (activeFilter === "not_rejected") {
          params.set("notRejected", "true");
        } else {
          params.set("status", activeFilter);
        }
      }
      params.set("contentType", contentType);
      params.set("videoPlatform", videoPlatform);
      // Determine if tiktok is selected based on videoPlatform
      const hasTiktok =
        videoPlatform === "all" ||
        videoPlatform === "tiktok" ||
        videoPlatform.includes("tiktok");
      params.set("tiktok", hasTiktok ? "true" : "false");
      params.set("twitter", twitterAnalytics ? "true" : "false");
      if (contestTypeFilter && contestTypeFilter !== "all") {
        params.set("type", contestTypeFilter);
      }
      const qs = params.toString();
      const url = `/api/analytics/contests${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch contests");
      const json = await res.json();
      const list = json.contests || [];
      setContests(list);
      setFilteredContests(list);
    } catch (err) {
      console.error("Error fetching contests:", err);
      setError("Failed to fetch contests");
      setContests([]);
      setFilteredContests([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummaryStats = () => {
    // Use filtered contests for summary stats
    const totalSubmissions = filteredContests.reduce(
      (sum, contest) => sum + (contest.submissions?.length || 0),
      0,
    );
    const totalViews = filteredContests.reduce(
      (sum, contest) =>
        sum +
        (contest.submissions?.reduce(
          (subSum, sub) => subSum + (sub.views || 0),
          0,
        ) || 0),
      0,
    );

    const totalSpent = filteredContests.reduce((sum, contest) => {
      const details = contest.contest_based_details;
      if (
        contest.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        return sum + details.leaderboard_contest.total_prize;
      } else if (
        contest.contest_type === "cpm" &&
        details?.cpm_contest?.total_budget
      ) {
        return sum + details.cpm_contest.total_budget;
      }
      return sum;
    }, 0);

    const avgCostPerView = totalViews > 0 ? totalSpent / totalViews : 0;
    const avgCostPerSubmission =
      totalSubmissions > 0 ? totalSpent / totalSubmissions : 0;

    return {
      totalContests: filteredContests.length,
      totalSubmissions,
      totalViews,
      totalSpent,
      avgCostPerView: Math.round(avgCostPerView * 100) / 100,
      avgCostPerSubmission: Math.round(avgCostPerSubmission * 100) / 100,
    };
  };

  const handleViewDetails = (contestId: string) => {
    // Navigate to contest details page
    window.location.href = `/dashboard/contests/${contestId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchContests}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = calculateSummaryStats();

  return (
    <div className="space-y-6">
      {/* Filter Indicator */}
      <div className="flex flex-row items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
          <span
            className={cn(
              "text-xs sm:text-sm",
              isDark ? "text-gray-300" : "text-gray-600",
            )}
          >
            Showing stats based on:
          </span>
          <span
            className={cn(
              "px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium inline-flex shrink-0 w-fit",
              isDark
                ? "bg-gray-800 text-gray-100"
                : "bg-gray-100 text-gray-800",
            )}
          >
            {activeFilter === "all"
              ? "All Submissions"
              : activeFilter === "verifiedPaid"
                ? "Verified + Paid Submissions"
                : activeFilter === "verified"
                  ? "Verified Submissions"
                  : activeFilter === "paid"
                    ? "Paid Submissions"
                    : activeFilter === "pending"
                      ? "Pending Submissions"
                      : activeFilter === "rejected"
                        ? "Rejected Submissions"
                        : activeFilter}
          </span>
        </div>
        <div
          className={cn(
            "text-xs sm:text-sm whitespace-nowrap",
            isDark ? "text-gray-300" : "text-gray-500",
          )}
        >
          {filteredContests.length} contest
          {filteredContests.length !== 1 ? "s" : ""} found
        </div>
      </div>

      {/* Contest Tiles */}
      {filteredContests.length === 0 ? (
        <div className="text-center py-12">
          <p className={cn("text-lg", isDark ? "text-white" : "text-gray-500")}>
            No contests found for the selected filter.
          </p>
          <p
            className={cn(
              "text-sm mt-2",
              isDark ? "text-gray-400" : "text-gray-500",
            )}
          >
            Create your first contest to get started!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredContests.map((contest) => (
            <ContestTile
              key={contest.id}
              contest={contest}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}
