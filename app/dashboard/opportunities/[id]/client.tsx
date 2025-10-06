"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Info,
  Trophy,
  Youtube,
  Instagram,
  User,
  Users,
  Share2,
  ListOrdered,
  ScrollText,
  Link2,
  Lightbulb,
  PlayCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Monitor,
  Play,
  FileText,
  DollarSign,
  CheckCheck,
  Gift,
  Tag,
  Star,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatLocalDateTime, formatTimeAgo } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsContent as TabsContent,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/client";
import {
  getMetricsRefreshCooldownInfoOpportunities,
  formatRemainingTime,
} from "@/lib/constants";
import type { UserResponse } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
// --- START DUMMY DATA CONFIGURATION ---
const USE_DUMMY_DATA_FOR_LEADERBOARD = false; // SWITCHED OFF FOR PRODUCTION
const DUMMY_ENTRIES_COUNT = 250; // Total number of dummy entries to generate
const MY_DUMMY_SUBMISSION_USER_ID = "user_dummy_me_special_id_123"; // A consistent ID for 'my' dummy submission
// --- END DUMMY DATA CONFIGURATION ---

// Define type for prize objects globally within the file
type PrizeInfo = {
  position: number;
  amount: number;
};
const tabs = [
  { id: "details", label: "Contest Details" },
  { id: "leaderboard", label: "Leaderboard" },
];
// LeaderboardEntry type reflects combined data from API
type LeaderboardEntry = {
  id: string;
  creator_id: string;
  video_title: string;
  video_thumbnail_url: string | null;
  views: number;
  earnings: number;
  status: string;
  created_at: string;
  content_link: string;
  platform: string;
  user_platform_username: string;
  user_full_name: string;
  creator_pfp_url: string | null;
  user_platform_pfp_url: string | null;
};

// Store for generated dummy data to avoid re-computation if count doesn't change
let generatedDummyDataCache: {
  entries: LeaderboardEntry[];
  myRank: number | null;
  count: number;
} | null = null;

const generateAllDummyLeaderboardData = (
  count: number
): { entries: LeaderboardEntry[]; myRank: number | null } => {
  if (generatedDummyDataCache && generatedDummyDataCache.count === count) {
    return {
      entries: generatedDummyDataCache.entries,
      myRank: generatedDummyDataCache.myRank,
    };
  }

  const entries: LeaderboardEntry[] = [];
  const platforms = ["youtube", "instagram"];
  let tempMyRank: number | null = null;

  for (let i = 0; i < count; i++) {
    const isMyEntry = i === Math.floor(count / 4); // Place 'my' entry deterministically
    const creatorId = isMyEntry
      ? MY_DUMMY_SUBMISSION_USER_ID
      : `user_dummy_${i}`;
    const username = isMyEntry ? "MyAwesomeSelf" : `Creator${i}`;
    const views = Math.floor(Math.random() * 750000) + 500; // Random views, wider range

    entries.push({
      id: `submission_dummy_${i}_${Math.random().toString(36).substring(7)}`,
      creator_id: creatorId,
      video_title: `Epic Content Vol. ${i + 1} - ${username}`,
      video_thumbnail_url: `https://picsum.photos/seed/${username}${i}/200/120`,
      views: views,
      earnings: Math.random() > 0.65 ? Math.floor(Math.random() * 150) + 10 : 0,
      status: "approved",
      created_at: new Date(
        Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000
      ).toISOString(), // random date in last 45 days
      content_link: "https://www.example.com/watch?v=dQw4w9WgXcQ", // A familiar link for all :)
      platform: platforms[i % platforms.length],
      user_platform_username: username,
      user_full_name: `${
        isMyEntry ? "The One And Only" : "Talented"
      } ${username.replace(/\d+/g, "")}`,
      creator_pfp_url: `https://i.pravatar.cc/150?u=${creatorId}`,
      user_platform_pfp_url: `https://i.pravatar.cc/150?u=${creatorId}_platform`,
    });
  }

  entries.sort((a, b) => {
    if (b.views !== a.views) return b.views - a.views;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const myEntryIndex = entries.findIndex(
    (e) => e.creator_id === MY_DUMMY_SUBMISSION_USER_ID
  );
  if (myEntryIndex !== -1) {
    tempMyRank = myEntryIndex + 1;
  }

  generatedDummyDataCache = { entries, myRank: tempMyRank, count };
  return { entries, myRank: tempMyRank };
};

// Client component that receives contestId as a prop
export function ContestClientPage({
  contestId,
  user,
}: {
  contestId: string;
  user: UserResponse["data"]["user"] | null;
}) {
  const [contest, setContest] = useState<any>(null);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const { activeTab, setActiveTab } = useTabState(tabs, {
    defaultTab: "details",
  });

  // Pagination state for leaderboard
  const [leaderboardCurrentPage, setLeaderboardCurrentPage] = useState(1);
  const [leaderboardItemsPerPage, setLeaderboardItemsPerPage] = useState(25); // Or your preferred default
  const [totalLeaderboardEntries, setTotalLeaderboardEntries] = useState(0);
  const [totalLeaderboardPages, setTotalLeaderboardPages] = useState(0);

  // State for logged-in user's submission and rank
  const [myLeaderboardEntry, setMyLeaderboardEntry] = useState<
    (LeaderboardEntry & { rank: number }) | null
  >(null);
  const [loadingMySubmission, setLoadingMySubmission] = useState(false);
  const [contestType, setContestType] = useState<string | null>(null); // Track contest type for verification badges

  // Refresh metrics state for opportunities
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

  // Post-contest status state for creator transparency
  const [postContestStatus, setPostContestStatus] = useState<string | null>(
    null
  );

  const { toast } = useToast();

  const handleRefreshMetrics = async () => {
    if (!contest?.id) return;

    setIsRefreshingMetrics(true);

    try {
      const response = await fetch(
        `/api/contests/${contest.id}/refresh-metrics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-refresh-source": "opportunities", // Identify this as opportunities refresh
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to refresh metrics");
      }

      // Update contest with new last_metrics_updated timestamp
      const newTimestamp =
        result.lastMetricsUpdated || new Date().toISOString();
      setContest((prev: any) => ({
        ...prev,
        last_metrics_updated: newTimestamp,
      }));

      // Refresh BOTH the leaderboard AND the user's own submission data
      await Promise.all([
        fetchLeaderboard(leaderboardCurrentPage),
        fetchMySubmissionData(),
      ]);
    } catch (error: any) {
      console.error("Failed to refresh metrics:", error);
      // In opportunities page, we'll silently handle errors or show a subtle notification
    } finally {
      setIsRefreshingMetrics(false);
    }
  };

  const fetchLeaderboard = async (pageToFetch: number = 1) => {
    if (!isMounted) return;
    setLoadingLeaderboard(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: allEntries } =
        generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const totalEntries = allEntries.length;
      const totalPages = Math.ceil(totalEntries / leaderboardItemsPerPage);
      const startIndex = (pageToFetch - 1) * leaderboardItemsPerPage;
      const endIndex = startIndex + leaderboardItemsPerPage;
      const paginatedEntries = allEntries.slice(startIndex, endIndex);

      setTimeout(() => {
        if (isMounted) {
          setLeaderboard(paginatedEntries);
          setLastUpdated(new Date().toISOString());
          setLeaderboardCurrentPage(pageToFetch);
          setTotalLeaderboardPages(totalPages);
          setTotalLeaderboardEntries(totalEntries);
          setContestType("leaderboard"); // Set dummy contest type
          setLoadingLeaderboard(false);
        }
      }, 300);
      return;
    }

    // Real API Call
    let leaderboardFetchError = null;
    try {
      const response = await fetch(
        `/api/leaderboard/${contestId}?page=${pageToFetch}&limit=${leaderboardItemsPerPage}`
      );
      const data = await response.json();
      if (!response.ok) {
        leaderboardFetchError = data.error || "Failed to fetch leaderboard";
        throw new Error(leaderboardFetchError);
      }
      if (isMounted) {
        setLeaderboard(data.leaderboard || []);
        setLastUpdated(data.lastUpdated);
        setLeaderboardCurrentPage(data.currentPage);
        setTotalLeaderboardPages(data.totalPages);
        setTotalLeaderboardEntries(data.totalEntries);
        setContestType(data.contestType || null); // Set contest type from API
      }
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      if (isMounted && !error) setError(leaderboardFetchError || err.message);
    } finally {
      if (isMounted) setLoadingLeaderboard(false);
    }
  };

  let isMounted = true; // Flag to track component mount status

  // Helper function to render verification badge
  const renderVerificationBadge = (status: string) => {
    if (contestType !== "cpm") return null; // Only show for CPM contests

    switch (status) {
      case "verified":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-xs font-medium"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800 text-xs font-medium"
          >
            <Info className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="destructive"
            className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 text-xs font-medium"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderPostContestStatusBadge = (status: string | null) => {
    if (!status) return null;

    let badgeColor = "bg-gray-500";
    let textColor = "text-white";
    let text = "Unknown";
    let icon = null;

    switch (status?.toLowerCase()) {
      case "pending_review":
        badgeColor = "bg-blue-500";
        text = "Under Review";
        icon = <Clock className="h-3 w-3 mr-1" />;
        break;
      case "in_review":
        badgeColor = "bg-purple-500";
        text = "In Review";
        icon = <RefreshCw className="h-3 w-3 mr-1" />;
        break;
      case "verification_complete":
        badgeColor = "bg-green-500";
        text = "Verification Complete";
        icon = <CheckCircle className="h-3 w-3 mr-1" />;
        break;
      case "payouts_processed":
        badgeColor = "bg-emerald-600";
        text = "Payouts Processed";
        icon = <DollarSign className="h-3 w-3 mr-1" />;
        break;
      default:
        badgeColor = "bg-gray-500";
        text = "Unknown Status";
        break;
    }

    return (
      <Badge
        variant="secondary"
        className={`${badgeColor} ${textColor} text-sm px-3 py-1.5 rounded-full font-medium flex items-center`}
      >
        {icon}
        {text}
      </Badge>
    );
  };

  const getPostContestStatusDescription = (status: string | null) => {
    if (!status) return null;

    switch (status?.toLowerCase()) {
      case "pending_review":
        return "The contest has ended and submissions are being prepared for review.";
      case "in_review":
        return "Contest submissions are currently being reviewed and verified by our team.";
      case "verification_complete":
        return "All submissions have been verified. Winners and payouts are being finalized.";
      case "payouts_processed":
        return "Verification is complete and payouts have been processed to winners.";
      default:
        return "Contest status is being updated.";
    }
  };

  const fetchMySubmissionData = async () => {
    if (!isMounted) return;

    setLoadingMySubmission(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: allEntries, myRank } =
        generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const myEntryData = allEntries.find(
        (e) => e.creator_id === MY_DUMMY_SUBMISSION_USER_ID
      );

      setTimeout(() => {
        if (isMounted) {
          if (myEntryData && myRank !== null) {
            // Add dummy verified status for testing
            setMyLeaderboardEntry({
              ...myEntryData,
              rank: myRank,
              status: "verified",
            });
          } else {
            setMyLeaderboardEntry(null);
          }
          setLoadingMySubmission(false);
        }
      }, 150);
      return;
    }

    // Real API Call
    if (!user || !contestId) {
      if (isMounted) setLoadingMySubmission(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/leaderboard/${contestId}/my-submission`
      );
      const data = await response.json();
      if (!response.ok) {
        console.warn(
          "Failed to fetch user submission data:",
          data.error || "Unknown error"
        );
        if (isMounted) setMyLeaderboardEntry(null);
        return;
      }
      if (isMounted) {
        if (data.mySubmission && data.rank) {
          setMyLeaderboardEntry({ ...data.mySubmission, rank: data.rank });
        } else {
          setMyLeaderboardEntry(null);
        }
      }
    } catch (err: any) {
      console.error("Error fetching user's submission data:", err);
      if (isMounted) setMyLeaderboardEntry(null);
    } finally {
      if (isMounted) setLoadingMySubmission(false);
    }
  };

  const fetchPostContestStatus = async () => {
    if (!isMounted || !contestId) return;

    try {
      const { data: contestData, error } = await supabase
        .from("contests")
        .select("post_contest_status")
        .eq("id", contestId)
        .single();

      if (error) {
        console.error("Error fetching post-contest status:", error);
        return;
      }

      if (isMounted) {
        setPostContestStatus(contestData?.post_contest_status || null);
      }
    } catch (error) {
      console.error("Error fetching post-contest status:", error);
    }
  };

  useEffect(() => {
    isMounted = true;

    // If NOT using dummy data for leaderboard, and user is not available, show loading.
    if (!USE_DUMMY_DATA_FOR_LEADERBOARD && !user) {
      setLoading(true);
      return;
    }

    async function fetchData() {
      if (!isMounted) return;
      setLoading(true); // Start with loading true for both paths initially
      setError(null);

      // Fetch contest details - this is usually needed for prize info, title, etc.
      // regardless of where leaderboard data comes from.
      try {
        const { data: contestData, error: contestError } = await supabase
          .from("contests_with_status")
          .select(`*, advertiser_profiles ( company_name )`)
          .eq("id", contestId)
          .maybeSingle();

        if (contestError) throw contestError;
        if (!contestData) throw new Error("Contest not found.");

        // Only published contests should be available to creators
        if (contestData.moderation_status !== "published") {
          throw new Error("This contest is not available.");
        }

        // Check if published contest has valid dates
        if (contestData.status === "incomplete") {
          throw new Error("This contest has incomplete information.");
        }
        if (isMounted) {
          setContest(contestData);

          // No need to set separate lastMetricsUpdate state - it's part of contest state
        }

        // Fetch existing submission status for the current user (if logged in)
        // This is separate from the main leaderboard logic.
        if (user) {
          const { data: submissionData, error: submissionError } =
            await supabase
              .from("submissions")
              .select("id, created_at")
              .eq("contest_id", contestId)
              .eq("creator_id", user.id)
              .limit(1);

          if (submissionError)
            console.error(
              "Error checking existing submission:",
              submissionError
            );
          else if (submissionData && submissionData.length > 0 && isMounted) {
            setHasSubmitted(true);
            setExistingSubmission(submissionData[0]);
          }
        }
      } catch (err: any) {
        console.error("Error fetching initial page data:", err);
        if (isMounted) setError(err.message || "Failed to load page data");
      } finally {
        // Call leaderboard fetches after initial contest/user data attempt
        if (isMounted) {
          fetchLeaderboard(1);
          fetchMySubmissionData(); // This will use dummy data if flag is true
          fetchPostContestStatus(); // Fetch post-contest status for transparency
          setLoading(false); // Done with initial loading phase
        }
      }
    }

    fetchData();

    // Auto-refresh for leaderboard (only if NOT using dummy data)
    const intervalId = setInterval(() => {
      if (
        isMounted &&
        lastUpdated &&
        !loadingLeaderboard &&
        !USE_DUMMY_DATA_FOR_LEADERBOARD
      ) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (lastUpdateTime < fiveMinutesAgo) {
          fetchLeaderboard(leaderboardCurrentPage);
        }
      }
    }, 60 * 1000);

    // Check for URL hash to set active tab
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash === "#leaderboard") {
        if (isMounted) setActiveTab("leaderboard");
      }
    }

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
    // Added leaderboardItemsPerPage to dependencies as it affects dummy data pagination
  }, [contestId, user, router, supabase, leaderboardItemsPerPage]);

  const handleSubmitContent = () => {
    router.push(`/dashboard/opportunities/${contestId}/submit`);
  };

  const handleViewSubmission = (submissionId: string) => {
    router.push(`/dashboard/submissions`);
  };

  // Helper to format time ago

  // Show loading state ONLY when fetching data (loading state)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[76vh]">
        {/* <div className="text-center">
          <p>Loading contest details...</p>
        </div> */}

        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  // Error UI handling (check error or missing contest AFTER loading is false)
  if (!loading && (error || !contest)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500">
            {error || "Failed to load contest details"}
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push("/dashboard/opportunities")}
          >
            Back to Opportunities
          </Button>
        </div>
      </div>
    );
  }

  const handleShare = async () => {
    if (contest.status === "ended") {
      toast({
        title: "Opportunity Completed",
        description:
          "This opportunity has ended. You can still share it to showcase the results and winners.",
        variant: "default",
      });
      // Allow sharing to proceed for completed opportunities
    }
    if (contest.status === "upcoming") {
      toast({
        title: "Not Live Yet",
        description:
          "This opportunity is not live yet. You can share it, but creators won't be able to participate until the start date.",
        variant: "default",
      });
      // Allow sharing to proceed
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: contest.title,
          text: `Check out this opportunity: ${contest.title}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "Opportunity link copied to clipboard!",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast({
        title: "Share Failed",
        description: "There was an error trying to share this opportunity.",
        variant: "destructive",
      });
    }
  };

  // Render main content
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto py-8 px-2 lg:px-4">
        {/* Improved Header Navigation */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 transition-all duration-200 hover:scale-105"
              onClick={() => router.push("/dashboard/opportunities")}
            >
              <ArrowLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline text-slate-600 dark:text-slate-300 font-medium">
                Back to Opportunities
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-[#4A00BE] text-md text-white"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Share</span>
            </Button>
          </div>

          {/* Enhanced Contest Header Section */}
          <div className="relative overflow-hidden rounded-xl bg-[#7F39EC] shadow-lg">
            {/* Decorative background pattern */}
            {/* <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full transform translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full transform -translate-x-24 translate-y-24"></div> */}

            <div className="relative p-8">
              <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                <div className="flex-1 min-w-0">
                  {/* Contest Title */}
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mb-6 text-white drop-shadow-sm leading-tight">
                    {contest.title}
                  </h1>

                  {/* Status and Type Badges */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Badge
                      className={`text-sm px-4 py-2 font-semibold rounded-full shadow-lg border-2 border-white/30 backdrop-blur-sm ${
                        contest.status === "active"
                          ? "bg-green-400/90 text-green-900"
                          : contest.status === "upcoming"
                          ? "bg-blue-400/90 text-blue-900"
                          : "bg-slate-400/90 text-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {contest.status === "active" ? (
                          <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                        ) : contest.status === "upcoming" ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <Calendar className="w-3 h-3" />
                        )}
                        {contest.status === "active"
                          ? "LIVE"
                          : contest.status.toUpperCase()}
                      </span>
                    </Badge>
                    {contest.contest_type && (
                      <Badge className="capitalize text-sm px-4 py-2 font-semibold rounded-full shadow-lg bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white">
                        {contest.contest_type === "cpm"
                          ? "Performance Based"
                          : "Competition Based"}
                      </Badge>
                    )}
                    {/* Post-contest status badge for ended contests */}
                    {contest.status === "ended" &&
                      postContestStatus &&
                      renderPostContestStatusBadge(postContestStatus)}
                  </div>

                  {/* Contest Duration */}
                  {contest.start_date && contest.end_date && (
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-3 inline-block">
                      <p className="text-white/95 text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {formatLocalDateTime(contest.start_date, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          -{" "}
                          {formatLocalDateTime(contest.end_date, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Right side - Enhanced Prize Pool */}
                <div className="flex-shrink-0 lg:text-right">
                  <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/25 shadow-xl">
                    <div className="text-white/80 text-sm font-medium mb-2 uppercase tracking-wide">
                      {contest.contest_type === "cpm"
                        ? "Total Budget"
                        : "Prize Pool"}
                    </div>
                    <div className="text-3xl lg:text-4xl font-bold text-white mb-1">
                      {contest.contest_type === "cpm" &&
                      contest.contest_based_details?.cpm_contest
                        ? formatMoney(
                            contest.contest_based_details.cpm_contest
                              .total_budget
                          )
                        : contest.contest_type === "leaderboard" &&
                          contest.contest_based_details?.leaderboard_contest
                        ? formatMoney(
                            contest.contest_based_details.leaderboard_contest
                              .total_prize
                          )
                        : contest.total_prize
                        ? formatMoney(contest.total_prize || 0)
                        : "$0.00"}
                    </div>
                    {contest.contest_type === "leaderboard" &&
                      contest.contest_based_details?.leaderboard_contest
                        ?.winner_count && (
                        <div className="text-white/70 text-xs font-medium">
                          {
                            contest.contest_based_details.leaderboard_contest
                              .winner_count
                          }{" "}
                          winner
                          {contest.contest_based_details.leaderboard_contest
                            .winner_count !== 1
                            ? "s"
                            : ""}
                        </div>
                      )}
                    {contest.contest_type === "cpm" &&
                      contest.contest_based_details?.cpm_contest
                        ?.cpm_rate_usd && (
                        <div className="text-white/70 text-xs font-medium">
                          {formatMoney(
                            contest.contest_based_details.cpm_contest
                              .cpm_rate_usd * 100
                          )}{" "}
                          per 1000 views
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {contest.thumbnail_url && (
          <div className="mb-8 aspect-video w-full mx-auto relative overflow-hidden rounded-xl shadow-lg">
            <Image
              src={contest.thumbnail_url}
              alt={`${contest.title} thumbnail`}
              fill
              style={{ objectFit: "cover" }} // cover makes sure it fills width
              priority
              className="bg-slate-100 dark:bg-slate-800"
            />
          </div>
        )}

        {/* Enhanced Action Card: Submit or Status */}
        <Card className="mb-8 border border-[#7F39EC] bg-[#D9C0FF26] overflow-hidden">
          <CardContent className="p-8 text-center relative">
            {/* Decorative background elements */}
            {/* <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-rose-200/30 to-purple-200/30 dark:from-rose-500/10 dark:to-purple-500/10 rounded-full blur-xl transform -translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-blue-200/30 to-cyan-200/30 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-full blur-xl transform translate-x-20 translate-y-20"></div> */}

            <div className="relative z-10">
              {hasSubmitted ? (
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle className="h-10 w-10 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">
                    Submission Complete!
                  </p>
                  <p className="text-base text-slate-600 dark:text-slate-300 mb-1">
                    You have successfully submitted for this opportunity
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Submitted {formatTimeAgo(existingSubmission.created_at)}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-rose-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
                      Ready to Showcase Your Talent?
                    </h2>
                    <p className="text-lg text-black max-w-md mx-auto leading-relaxed">
                      {contest.status === "active"
                        ? "The stage is yours! Submit your content and let your creativity shine."
                        : contest.status === "upcoming"
                        ? "Get ready! This opportunity hasn't started yet, but you can prepare."
                        : "This opportunity has ended or is no longer active."}
                    </p>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleSubmitContent}
                    disabled={contest.status?.toLowerCase() !== "active"}
                    className={`relative overflow-hidden text-lg font-bold py-4  px-8 h-auto rounded-2xl shadow-xl transition-all duration-500 ease-out transform ${
                      contest.status?.toLowerCase() === "active"
                        ? "bg-[#4A00BE] text-white border-0 hover:shadow-2xl"
                        : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {/* Animated shine effect for active button */}
                    {contest.status?.toLowerCase() === "active" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    )}

                    <span className="relative flex items-center gap-3">
                      {contest.status?.toLowerCase() === "upcoming" ? (
                        <>
                          <Clock className="h-6 w-6" />
                          <span>Contest Not Started</span>
                        </>
                      ) : contest.status?.toLowerCase() === "ended" ||
                        contest.status?.toLowerCase() === "completed" ? (
                        <>
                          <Calendar className="h-6 w-6" />
                          <span>Contest Ended</span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <PlayCircle className="h-6 w-6" />
                            <span>Submit Your Entry!</span>
                          </div>
                          {contest.status?.toLowerCase() === "active" && (
                            <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse ml-1"></div>
                          )}
                        </>
                      )}
                    </span>
                  </Button>

                  {contest.status?.toLowerCase() === "active" && (
                    <div className="text-sm text-black mt-4 flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Contest is live! Join now to compete
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Colorful Contest Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Platform Card */}
          <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
            <CardContent className="p-4 flex justify-between">
              <div className="flex-1 text-black space-y-3">
                <p className="text-lg font-medium">Platform</p>
                <p className="text-xl font-bold">
                  {contest.platform || "Not specified"}
                </p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                {contest.platform?.toLowerCase() === "youtube" ? (
                  <Youtube className="h-5 w-5 text-[#4A00BE] " />
                ) : contest.platform?.toLowerCase() === "instagram" ? (
                  <Instagram className="h-5 w-5 text-[#4A00BE]" />
                ) : (
                  <Share2 className="h-5 w-5 text-[#4A00BE]" />
                )}
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-700/50 hover:shadow-lg transition-all duration-300">
  <CardContent className="p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        {contest.platform?.toLowerCase() === "youtube" ? (
          <Youtube className="h-5 w-5 text-red-600 dark:text-red-400" />
        ) : contest.platform?.toLowerCase() === "instagram" ? (
          <Instagram className="h-5 w-5 text-pink-600 dark:text-pink-400" />
        ) : (
          <Share2 className="h-5 w-5 text-red-600 dark:text-red-400" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-red-800 dark:text-red-300 uppercase tracking-wide">
          Platform
        </p>
        <p className="text-lg font-bold text-red-900 dark:text-red-100 capitalize">
          {contest.platform || "Not specified"}
        </p>
      </div>
    </div>
  </CardContent>
</Card> */}
          {/* Duration Card */}
          <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
            <CardContent className="p-4 flex justify-between">
              <div className="flex-1 text-black space-y-3">
                <p className="text-lg font-medium">Duration</p>
                <p className="text-xl font-bold">
                  {(() => {
                    if (!contest.start_date || !contest.end_date)
                      return "Not specified";
                    const start = new Date(contest.start_date);
                    const end = new Date(contest.end_date);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24)
                    );
                    return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
                  })()}
                </p>
                <p className="text-md">
                  {" "}
                  {contest.start_date && contest.end_date
                    ? `${formatLocalDateTime(contest.start_date, {
                        month: "short",
                        day: "numeric",
                      })} - ${formatLocalDateTime(contest.end_date, {
                        month: "short",
                        day: "numeric",
                      })}`
                    : "Dates TBD"}
                </p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                <Calendar className="h-5 w-5" />
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Duration</p>
                  <p className="text-lg font-bold text-green-900 dark:text-green-100">
                    {(() => {
                      if (!contest.start_date || !contest.end_date) return "Not specified";
                      const start = new Date(contest.start_date);
                      const end = new Date(contest.end_date);
                      const diffTime = Math.abs(end.getTime() - start.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                    })()}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    {contest.start_date && contest.end_date ? (
                      `${formatLocalDateTime(contest.start_date, {
                        month: 'short',
                        day: 'numeric',
                      })} - ${formatLocalDateTime(contest.end_date, {
                        month: 'short',
                        day: 'numeric',
                      })}`
                    ) : "Dates TBD"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}

          {/* Prize Pool Card */}
          <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
            <CardContent className="p-4 flex justify-between">
              <div className="flex-1 text-black space-y-3">
                <p className="text-lg font-medium">Prize Pool</p>
                <p className="text-xl font-bold">
                  {contest.contest_type === "cpm" &&
                  contest.contest_based_details?.cpm_contest
                    ? formatMoney(
                        contest.contest_based_details.cpm_contest.total_budget
                      )
                    : contest.contest_type === "leaderboard" &&
                      contest.contest_based_details?.leaderboard_contest
                    ? formatMoney(
                        contest.contest_based_details.leaderboard_contest
                          .total_prize
                      )
                    : contest.total_prize // Fallback to old field if necessary for older data
                    ? formatMoney(contest.total_prize || 0)
                    : "$0.00"}
                </p>
                <p className="text-md">
                  {" "}
                  {contest.contest_type === "leaderboard" &&
                  contest.contest_based_details?.leaderboard_contest
                    ?.winner_count
                    ? `${
                        contest.contest_based_details.leaderboard_contest
                          .winner_count
                      } winner${
                        contest.contest_based_details.leaderboard_contest
                          .winner_count !== 1
                          ? "s"
                          : ""
                      }`
                    : contest.contest_type === "cpm"
                    ? "CPM based"
                    : "Total prize"}
                </p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                <Trophy className="h-5 w-5" />
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">Prize Pool</p>
                  <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                    {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest
                      ? formatMoney(contest.contest_based_details.cpm_contest.total_budget)
                      : contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest
                        ? formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)
                        : contest.total_prize // Fallback to old field if necessary for older data
                          ? formatMoney(contest.total_prize || 0)
                          : "$0.00"}
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                    {contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest?.winner_count
                      ? `${contest.contest_based_details.leaderboard_contest.winner_count} winner${contest.contest_based_details.leaderboard_contest.winner_count !== 1 ? 's' : ''}`
                      : contest.contest_type === 'cpm'
                        ? 'CPM based'
                        : 'Total prize'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}

          {/* Submissions Card */}
          <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
            <CardContent className="p-4 flex justify-between">
              <div className="flex-1 text-black space-y-3">
                <p className="text-lg font-medium">Submissions</p>
                <p className="text-xl font-bold">
                  {contest.live_submission_count !== null &&
                  contest.live_submission_count >= 0
                    ? contest.live_submission_count
                    : 0}
                </p>
                <p className="text-md">Total entries</p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">Submissions</p>
                  <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {contest.live_submission_count !== null && contest.live_submission_count >= 0
                      ? contest.live_submission_count
                      : 0}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">Total entries</p>
                </div>
              </div>
            </CardContent>
          </Card> */}
        </div>

        {/* Post-Contest Status Section for Ended Contests */}
        {contest.status === "ended" && postContestStatus && (
          <Card className="mb-8 shadow-lg border-slate-200 dark:border-slate-700 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-blue-200 dark:border-blue-700/50">
              <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-3">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                Contest Status Update
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Current Status:
                    </h3>
                    {renderPostContestStatusBadge(postContestStatus)}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {getPostContestStatusDescription(postContestStatus)}
                  </p>
                  {postContestStatus === "payouts_processed" && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg">
                      <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Contest Complete!</span>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                        All verification and payout processes have been
                        completed for this contest.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600/50 shadow-sm">
                    <div className="text-center">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                        Contest Ended
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {contest.end_date
                          ? formatLocalDateTime(contest.end_date, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Date not specified"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <EnhancedTabs
          tabs={tabs.map((tab) => ({
            ...tab,
            label: (
              <div className="flex text-center items-center">
                {tab.label}
                {tab.id === "leaderboard" &&
                  contest?.contest_type === "leaderboard" &&
                  totalLeaderboardEntries > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-2 bg-gray-200 text-sm text-gray-700data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
                    >
                      {totalLeaderboardEntries}
                    </Badge>
                  )}
              </div>
            ),
          }))}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="mt-12 mb-6"
        />

        {/* <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="details">Contest Details</TabsTrigger>
            <TabsTrigger value="leaderboard">
              Leaderboard{" "}
              {contest?.contest_type === "leaderboard" &&
                totalLeaderboardEntries > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
                  >
                    {totalLeaderboardEntries}
                  </Badge>
                )}
            </TabsTrigger>
          </TabsList> */}

        <TabContent activeTab={activeTab}>
          <TabPanel value="details" activeTab={activeTab}>
            <div className="bg-white rounded-xl shadow-xl">
              <CardHeader className="border-b">
                <CardTitle className="text-gray-800 flex items-center gap-2">
                  {/* <ScrollText className="h-5 w-5 text-blue-500" /> */}
                  Contest Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="pt-4">
                  <h3 className="font-semibold text-lg mb-4 text-slate-900 dark:text-slate-100">
                    Brief
                  </h3>
                  {contest.brief_html ? (
                    <div
                      className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300"
                      dangerouslySetInnerHTML={{ __html: contest.brief_html }}
                    />
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      No brief provided
                    </p>
                  )}
                </div>
                <Separator />

                {/* Contest Details Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                    {/* <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" /> */}
                    Contest Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Start Date Card */}
                    <div className="border border-gray-300 rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-[#D8C3FF] text-[#4A00BE] rounded-full shadow-sm">
                            <Play className="h-6 w-6 " />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-black uppercase tracking-wide">
                              Start Date & Time
                            </p>
                            <p className="text-lg font-bold text-black">
                              {contest.start_date
                                ? formatLocalDateTime(contest.start_date)
                                : "Not specified"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </div>

                    {/* End Date Card */}
                    <div className="border border-gray-300 rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-[#D8C3FF] text-[#4A00BE] rounded-full shadow-sm">
                            <Clock className="h-6 w-6 " />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-black uppercase tracking-wide">
                              End Date & Time
                            </p>
                            <p className="text-lg font-bold text-black">
                              {contest.end_date
                                ? formatLocalDateTime(contest.end_date)
                                : "Not specified"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </div>

                    {/* Platform Card */}
                    <div className="border border-gray-300 rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-[#D8C3FF] text-[#4A00BE] rounded-full shadow-sm">
                            <Monitor className="h-6 w-6 " />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-black uppercase tracking-wide">
                              Platform
                            </p>
                            <p className="text-lg font-bold text-black capitalize">
                              {contest.platform || "Not specified"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </div>

                    {/* Status Card */}
                    <div className="border border-gray-300 rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-[#D8C3FF] text-[#4A00BE] rounded-full shadow-sm">
                            <Info className="h-6 w-6 " />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-black uppercase tracking-wide">
                              Status
                            </p>
                            <p className="text-lg font-bold text-black capitalize">
                              {contest.status || "Not specified"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </div>

                    {/* Sponsor Card */}
                    {/* <Card className="md:col-span-2 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-700/50 hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                            <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 uppercase tracking-wide">Sponsor</p>
                            <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                              {contest.advertiser_profiles?.company_name ||
                                "Not specified"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card> */}
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100">
                    {contest.contest_type === "cpm"
                      ? "Earnings & Budget"
                      : "Prize Structure"}
                  </h3>
                  {contest.contest_type === "leaderboard" &&
                    (Array.isArray(
                      contest.contest_based_details?.leaderboard_contest?.prizes
                    ) &&
                    contest.contest_based_details.leaderboard_contest.prizes
                      .length > 0 ? (
                      <div className="space-y-4">
                        {/* Prize Pool Summary */}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border border-gray-300 rounded-xl p-4 flex items-center gap-3">
                            <div className="p-3 bg-[#D8C3FF] text-[#4A00BE] rounded-full">
                              <Trophy className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-black uppercase tracking-wide">
                                Total Prize Pool
                              </p>
                              <p className="text-xl font-bold text-black">
                                {formatMoney(
                                  contest.contest_based_details
                                    .leaderboard_contest.total_prize
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="border border-gray-300 rounded-xl p-4 flex items-center gap-3">
                            <div className="p-3 bg-[#D8C3FF] text-[#4A00BE] rounded-full">
                              <Users className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-black uppercase tracking-wide">
                                Total Winners
                              </p>
                              <p className="text-xl font-bold text-black">
                                {
                                  contest.contest_based_details
                                    .leaderboard_contest.winner_count
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Prize Distribution */}
                        <div className="py-4">
                          <h4 className="font-medium text-md text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                            {/* <ListOrdered className="h-4 w-4" /> */}
                            Prize Distribution
                          </h4>
                          <ul className="space-y-3">
                            {[
                              ...(contest.contest_based_details
                                .leaderboard_contest.prizes as PrizeInfo[]),
                            ]
                              .sort((a, b) => a.position - b.position)
                              .map((prize) => (
                                <li
                                  key={prize.position}
                                  className="flex items-center justify-between py-3 px-3 bg-white dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600/50"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center text-black font-bold text-sm">
                                      {prize.position}
                                    </div>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                      Position {prize.position}
                                    </span>
                                  </div>
                                  <span className="font-bold text-black text-lg">
                                    {formatMoney(prize.amount)}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        No prize structure defined for this leaderboard contest.
                      </p>
                    ))}
                  {contest.contest_type === "cpm" &&
                    contest.contest_based_details?.cpm_contest && (
                      <div className="py-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex justify-between items-center border border-gray-300 rounded-xl p-4">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              Pay Rate:
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatMoney(
                                contest.contest_based_details.cpm_contest
                                  .cpm_rate_usd * 100
                              )}{" "}
                              per 1000 views
                            </span>
                          </div>
                          <div className="flex justify-between items-center border border-gray-300 rounded-xl p-4">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              Total Budget:
                            </span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {formatMoney(
                                contest.contest_based_details.cpm_contest
                                  .total_budget
                              )}
                            </span>
                          </div>
                          {contest.contest_based_details.cpm_contest
                            .min_views != null && (
                            <div className="flex justify-between items-center border border-gray-300 rounded-xl p-4">
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                Minimum Views Required:
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {contest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                              </span>
                            </div>
                          )}
                          {contest.contest_based_details.cpm_contest
                            .max_views != null && (
                            <div className="flex justify-between items-center border border-gray-300 rounded-xl p-4">
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                Maximum Views Counted:
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {contest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
                            Terms & Conditions:
                          </h4>
                          <div className="bg-white dark:bg-slate-900 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-700 dark:text-slate-300">
                              {contest.contest_based_details.cpm_contest
                                .terms_conditions ||
                                "No specific terms provided."}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  {contest.contest_type !== "leaderboard" &&
                    contest.contest_type !== "cpm" && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Contest type details not available.
                      </p>
                    )}
                </div>

                <Separator />

                {/* Rules Section - Always Show */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {/* <ScrollText className="h-5 w-5" />  */}
                    Rules & Guidelines
                  </h3>
                  <div className="border border-gray-300 rounded-xl p-4">
                    {/* Check multiple possible rule fields */}
                    {(contest as any).rules_html ? (
                      <div
                        className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300"
                        dangerouslySetInnerHTML={{
                          __html: (contest as any).rules_html,
                        }}
                      />
                    ) : contest.rules ? (
                      <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {contest.rules}
                      </div>
                    ) : contest.rules_description ? (
                      <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {contest.rules_description}
                      </div>
                    ) : (contest as any).rules_text ? (
                      <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {(contest as any).rules_text}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                          <h4 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
                            General Rules:
                          </h4>
                          <ul className="space-y-2 ml-4 list-disc text-slate-600 dark:text-slate-400">
                            <li>
                              <strong>Eligibility:</strong> Only registered
                              creators are eligible to participate in contests.
                            </li>
                            <li>
                              <strong>Age Requirement:</strong> Contestants must
                              be at least 18 years old.
                            </li>
                            <li>
                              <strong>Content Standards:</strong> Content must
                              adhere to the platform's content guidelines and
                              community standards.
                            </li>
                            <li>
                              <strong>Original Work:</strong> All submissions
                              must be original content created by the
                              participant.
                            </li>
                            <li>
                              <strong>Submission Deadline:</strong> Entries must
                              be submitted before the contest end date and time.
                            </li>
                            <li>
                              <strong>Platform Compliance:</strong> Content must
                              comply with the rules and policies of the
                              specified platform (YouTube, Instagram, etc.).
                            </li>
                          </ul>
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-600 pt-3">
                          <h4 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
                            ⚠️ Important Notes:
                          </h4>
                          <ul className="space-y-1 ml-4 list-disc text-slate-600 dark:text-slate-400 text-sm">
                            <li>
                              Violation of rules may result in disqualification
                            </li>
                            <li>
                              Contest organizers reserve the right to verify
                              submissions
                            </li>
                            <li>
                              Winners will be contacted through their registered
                              email
                            </li>
                            <li>
                              Prize distribution is subject to verification and
                              approval
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* New Features Sections (2025-10-01) */}
                {/* Content Type Section */}
                {(contest as any).content_type && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Tag className="h-5 w-5 text-blue-600" />
                        Content Type
                      </h3>
                      <div className="border border-blue-300 bg-blue-50/50 rounded-xl p-4">
                        <p className="text-lg font-semibold text-blue-900 uppercase tracking-wide">
                          {(contest as any).content_type.toUpperCase()}
                        </p>
                        <p className="text-sm text-blue-700 mt-1">
                          This contest is looking for{" "}
                          {(contest as any).content_type === "ugc"
                            ? "User Generated Content"
                            : (contest as any).content_type === "clipping"
                            ? "Clipping/Editing"
                            : "Other"}{" "}
                          type submissions.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Flat Fee Bonus Section */}
                {(contest.contest_based_details?.cpm_contest?.flat_fee_bonus ||
                  contest.contest_based_details?.leaderboard_contest
                    ?.flat_fee_bonus) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Gift className="h-5 w-5 text-green-600" />
                        Guaranteed Flat Fee Bonus
                      </h3>
                      <div className="border border-green-300 bg-green-50/50 rounded-xl p-4">
                        <p className="text-2xl font-bold text-green-900 mb-2">
                          {formatMoney(
                            contest.contest_based_details?.cpm_contest
                              ?.flat_fee_bonus ||
                              contest.contest_based_details?.leaderboard_contest
                                ?.flat_fee_bonus ||
                              0
                          )}{" "}
                          per verified submission
                        </p>
                        <p className="text-sm text-green-700">
                          🎁 Earn this guaranteed amount for EVERY verified
                          submission, regardless of views or ranking! Paid after
                          the contest ends along with other earnings.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Multiple Submissions Section */}
                {(contest as any).multiple_submissions_enabled && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <CheckCheck className="h-5 w-5 text-purple-600" />
                        Multiple Submissions Allowed
                      </h3>
                      <div className="border border-purple-300 bg-purple-50/50 rounded-xl p-4">
                        <p className="text-lg font-semibold text-purple-900 mb-2">
                          You can submit up to{" "}
                          {(contest as any).max_submissions_per_creator} entries
                          for this contest!
                        </p>
                        <p className="text-sm text-purple-700 mb-3">
                          Submit multiple pieces of content to maximize your
                          chances of winning and earning. Min/max view
                          requirements (if any) apply to ALL submissions.
                        </p>
                        {(contest as any).max_earnings_per_creator && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            <p className="text-sm text-purple-800 font-medium">
                              💡 Earnings Cap for This Contest:{" "}
                              {formatMoney(
                                (contest as any).max_earnings_per_creator
                              )}
                            </p>
                            <p className="text-xs text-purple-600 mt-1">
                              You can still submit after reaching this cap, but
                              won't earn more from THIS specific contest. This
                              cap doesn't affect your earnings from other
                              contests!
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Additional Bonus Opportunities Section */}
                {(contest as any).bonus_details?.description_html && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Star className="h-5 w-5 text-amber-600" />
                        Additional Bonus Opportunities
                      </h3>
                      <div className="border border-amber-300 bg-amber-50/50 rounded-xl p-4">
                        <div
                          className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300"
                          dangerouslySetInnerHTML={{
                            __html: (contest as any).bonus_details
                              .description_html,
                          }}
                        />
                        <p className="text-xs text-amber-700 mt-3 italic">
                          ℹ️ These bonuses are handled manually by the contest
                          creator. Read carefully and reach out if you have
                          questions!
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Resources Section - Always Show */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    {/* <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div> */}
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      Resources
                    </h3>
                  </div>

                  {contest.resources &&
                  ((Array.isArray(contest.resources) &&
                    contest.resources.length > 0) ||
                    (typeof contest.resources === "object" &&
                      Object.keys(contest.resources).length > 0)) ? (
                    <div className="grid gap-4">
                      {(Array.isArray(contest.resources)
                        ? contest.resources
                        : Object.entries(contest.resources).map(
                            ([description, url]) => ({
                              url,
                              description,
                              type: "external",
                            })
                          )
                      ).map((resource: any, idx: number) => {
                        const isImage =
                          resource.url &&
                          (resource.url.startsWith("data:image") ||
                            /\.(jpg|jpeg|png|gif|jfif|webp)$/i.test(
                              resource.url
                            ));
                        const isPdf =
                          resource.url && /\.pdf$/i.test(resource.url);
                        const isVideo =
                          resource.url &&
                          /\.(mp4|mov|avi|webm)$/i.test(resource.url);
                        const isInternal = resource.type === "internal";
                        return (
                          <div
                            key={idx}
                            className="border border-gray-300 rounded-xl p-5"
                          >
                            <div className="flex flex-col md:flex-row justify-between">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                {isInternal && isImage && !isPdf ? (
                                  <img
                                    src={resource.url}
                                    alt={resource.description}
                                    className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                                  />
                                ) : isInternal && isPdf ? (
                                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center border border-red-200 dark:border-red-700">
                                    <svg
                                      className="w-6 h-6 text-red-600 dark:text-red-400"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                ) : isInternal && isVideo ? (
                                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-700">
                                    <svg
                                      className="w-6 h-6 text-blue-600 dark:text-blue-400"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                    </svg>
                                  </div>
                                ) : isInternal &&
                                  !isImage &&
                                  !isPdf &&
                                  !isVideo ? (
                                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center border border-green-200 dark:border-green-700">
                                    <svg
                                      className="w-6 h-6 text-green-600 dark:text-green-400"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full flex-shrink-0">
                                    <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                    {resource.description}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {resource.type === "external"
                                      ? "External Link"
                                      : "Uploaded File"}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                asChild
                                className="bg-[#6C43D0] hover:bg-[#6C43D0] mt-3 md:mt-0 rounded-xl text-white px-4 py-2 text-md"
                              >
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center"
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  {isPdf
                                    ? "Open PDF"
                                    : isVideo
                                    ? "Play Video"
                                    : isImage
                                    ? "View Image"
                                    : "View Resource"}
                                </a>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Lightbulb className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        No additional resources provided
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        Check the brief and rules above for all contest
                        requirements.
                      </p>
                    </div>
                  )}
                </div>

                {/* Inspiration Links Section */}
                {(() => {
                  let links = Array.isArray(contest.inspiration_links)
                    ? contest.inspiration_links
                    : [];
                  return links.length > 0 ? (
                    <>
                      <Separator className="my-8" />
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          {/* <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div> */}
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            Inspiration Links
                          </h3>
                        </div>

                        <div className="grid gap-4">
                          {links.map(
                            (
                              item: { url: string; description: string },
                              index: number
                            ) => (
                              <div
                                key={index}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full flex-shrink-0">
                                    <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-base font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline mb-2 break-all"
                                    >
                                      {item.url}
                                    </a>
                                    {item.description && (
                                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </>
                  ) : null;
                })()}

                {/* Tracking Links Section */}
                {(() => {
                  let trackingLinks = Array.isArray(contest.tracking_links)
                    ? contest.tracking_links
                    : [];
                  return trackingLinks.length > 0 ? (
                    <>
                      <Separator className="my-8" />
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            Tracking Links
                          </h3>
                        </div>

                        <div className="grid gap-4">
                          {trackingLinks.map(
                            (
                              item: { url: string; description: string },
                              index: number
                            ) => (
                              <div
                                key={index}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full flex-shrink-0">
                                    <ExternalLink className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-base font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline mb-2 break-all"
                                    >
                                      {item.url}
                                    </a>
                                    {item.description && (
                                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </>
                  ) : null;
                })()}
              </CardContent>
            </div>
          </TabPanel>

          <TabPanel value="leaderboard" activeTab={activeTab}>
            {loadingLeaderboard ? (
              // <p className="text-center py-4">Loading leaderboard...</p>
              <div className="flex items-center justify-center h-[60vh]">
                <PageLoadingSpinner mode="light" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : leaderboard.length === 0 && totalLeaderboardEntries === 0 ? (
              <div className="text-center py-8">
                <Trophy className="mx-auto h-12 w-12 text-slate-400" />
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  No submissions yet. Be the first!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Logged-in User's Rank Card */}
                {loadingMySubmission && (
                  <div className="text-center py-3">
                    <p>Loading your rank...</p>
                  </div>
                )}
                {myLeaderboardEntry && (
                  <Card
                    key={`my-rank-${myLeaderboardEntry.id}`}
                    className="shadow-lg border-2 border-primary/50 bg-primary/5 dark:bg-primary/10 overflow-hidden mb-6"
                  >
                    <CardContent className="p-3 sm:p-4 flex items-center space-x-3 sm:space-x-4">
                      <div className="text-lg sm:text-xl font-bold text-primary w-10 sm:w-12 text-center flex-shrink-0">
                        #{myLeaderboardEntry.rank}
                      </div>
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/30 flex-shrink-0">
                        <AvatarImage
                          src={
                            myLeaderboardEntry.creator_pfp_url ??
                            myLeaderboardEntry.user_platform_pfp_url ??
                            undefined
                          }
                          alt={myLeaderboardEntry.user_platform_username}
                        />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {myLeaderboardEntry.user_platform_username?.[0]?.toUpperCase() ||
                            "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className="text-sm sm:text-base font-semibold text-primary dark:text-primary-foreground truncate"
                            title={myLeaderboardEntry.user_platform_username}
                          >
                            {myLeaderboardEntry.user_platform_username} (You)
                          </p>
                          {renderVerificationBadge(myLeaderboardEntry.status)}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Submitted:{" "}
                          {formatTimeAgo(myLeaderboardEntry.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end space-y-0.5 sm:space-y-1 flex-shrink-0 ml-auto pl-2">
                        <div className="flex items-center space-x-2">
                          <p className="text-base sm:text-lg font-bold text-primary dark:text-primary-foreground">
                            {myLeaderboardEntry.views.toLocaleString()} views
                          </p>
                          {myLeaderboardEntry.content_link && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8 text-primary/80 hover:text-primary dark:text-primary-foreground/80 dark:hover:text-primary-foreground"
                              asChild
                            >
                              <Link
                                href={myLeaderboardEntry.content_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View Your Content"
                              >
                                <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                        {(() => {
                          let prizeDisplay = null;
                          if (myLeaderboardEntry.earnings > 0) {
                            // Show actual earnings for verified or paid submissions; otherwise show expected
                            const isEarned =
                              myLeaderboardEntry.status === "verified" ||
                              myLeaderboardEntry.status === "paid";
                            const earningsLabel = isEarned
                              ? "Earned"
                              : "Expected";
                            prizeDisplay = (
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                {earningsLabel}:{" "}
                                {formatMoney(myLeaderboardEntry.earnings)}
                              </span>
                            );
                          } else if (
                            contest.contest_type === "leaderboard" &&
                            Array.isArray(
                              contest.contest_based_details?.leaderboard_contest
                                ?.prizes
                            ) &&
                            myLeaderboardEntry.rank
                          ) {
                            const prizeInfo = (
                              contest.contest_based_details.leaderboard_contest
                                .prizes as PrizeInfo[]
                            ).find(
                              (p) => p.position === myLeaderboardEntry.rank
                            );
                            if (prizeInfo) {
                              const prizeText =
                                contest.status === "active"
                                  ? "Winning Zone"
                                  : "Prize";
                              prizeDisplay = (
                                <span className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                                  <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                  {prizeText}: {formatMoney(prizeInfo.amount)}
                                </span>
                              );
                            }
                          }
                          return prizeDisplay ? (
                            <div className="text-xs sm:text-sm">
                              {prizeDisplay}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Main Leaderboard List */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-md text-black">
                    Last updated:{" "}
                    {contest?.last_metrics_updated
                      ? formatTimeAgo(contest.last_metrics_updated)
                      : lastUpdated
                      ? formatTimeAgo(lastUpdated)
                      : "Never"}
                    {totalLeaderboardEntries > 0 && (
                      <span className="ml-2">
                        | Total Submissions:{" "}
                        {totalLeaderboardEntries.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Refresh Metrics Button - Only show for active contests with submissions and not finalized */}
                  {contest?.status === "active" &&
                    totalLeaderboardEntries > 0 &&
                    contest?.post_contest_status !== "in_review" &&
                    contest?.post_contest_status !== "verification_complete" &&
                    contest?.post_contest_status !== "payouts_processed" &&
                    (() => {
                      const cooldownInfo =
                        getMetricsRefreshCooldownInfoOpportunities(
                          contest?.last_metrics_updated
                        );

                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshMetrics}
                          disabled={
                            isRefreshingMetrics || !cooldownInfo.canRefresh
                          }
                          className="ml-2 py-2 rounded-lg text-md bg-[#4A00BE] text-white"
                          title={
                            !cooldownInfo.canRefresh
                              ? `Available in ${formatRemainingTime(
                                  cooldownInfo.remainingMs
                                )}`
                              : "Refresh metrics now"
                          }
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              isRefreshingMetrics ? "animate-spin" : ""
                            }`}
                          />
                          {isRefreshingMetrics
                            ? "Updating..."
                            : !cooldownInfo.canRefresh
                            ? `Wait ${formatRemainingTime(
                                cooldownInfo.remainingMs
                              )}`
                            : "Refresh Metrics"}
                        </Button>
                      );
                    })()}
                </div>
                {leaderboard.map((entry, index) => {
                  const rank =
                    (leaderboardCurrentPage - 1) * leaderboardItemsPerPage +
                    index +
                    1;
                  let prizeDisplay = null;

                  if (entry.earnings > 0) {
                    // For CPM contests, show Expected vs Earned based on verification/paid status
                    if (contestType === "cpm") {
                      const isEarned =
                        entry.status === "verified" || entry.status === "paid";
                      const earningsLabel = isEarned ? "Earned" : "Expected";
                      prizeDisplay = (
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {earningsLabel}: {formatMoney(entry.earnings)}
                        </span>
                      );
                    } else {
                      prizeDisplay = (
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          Earned: {formatMoney(entry.earnings)}
                        </span>
                      );
                    }
                  } else if (
                    contest.contest_type === "leaderboard" &&
                    Array.isArray(
                      contest.contest_based_details?.leaderboard_contest?.prizes
                    )
                  ) {
                    const prizeInfo = (
                      contest.contest_based_details.leaderboard_contest
                        .prizes as PrizeInfo[]
                    ).find((p) => p.position === rank);
                    if (prizeInfo) {
                      const prizeText =
                        contest.status === "active" ? "Winning Zone" : "Prize";
                      prizeDisplay = (
                        <span className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                          <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                          {prizeText}: {formatMoney(prizeInfo.amount)}
                        </span>
                      );
                    }
                  }

                  return (
                    <div
                      key={entry.id}
                      className="border border-[#D1B7F9] rounded-xl overflow-hidden"
                    >
                      <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0 justify-between">
                        <div className="flex items-center space-x-3 md:space-x-4">
                          <h2 className="text-lg sm:text-xl font-bold text-slate-400 dark:text-slate-500 w-6 sm:w-8 text-center flex-shrink-0">
                            {rank}
                          </h2>
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border flex-shrink-0">
                            <AvatarImage
                              src={
                                entry.creator_pfp_url ??
                                entry.user_platform_pfp_url ??
                                undefined
                              }
                              alt={entry.user_platform_username}
                            />
                            <AvatarFallback>
                              {entry.user_platform_username?.[0]?.toUpperCase() ||
                                "U"}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm sm:text-base font-semibold truncate text-slate-800 dark:text-slate-100">
                                {entry.user_platform_username}
                              </p>
                              {renderVerificationBadge(entry.status)}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Submitted: {formatTimeAgo(entry.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-0.5 sm:space-y-1 flex-shrink-0 ml-auto pl-2">
                          <div className="flex items-center space-x-2">
                            <p className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-200">
                              {entry.views.toLocaleString()} views
                            </p>
                            {entry.content_link && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 sm:h-8 sm:w-8 text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary"
                                asChild
                              >
                                <Link
                                  href={entry.content_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View Content"
                                >
                                  <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                </Link>
                              </Button>
                            )}
                          </div>
                          {prizeDisplay && (
                            <div className="text-xs sm:text-sm">
                              {prizeDisplay}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  );
                })}

                {/* Pagination Controls */}
                {totalLeaderboardPages > 1 && (
                  <div className="flex items-center justify-center space-x-4 py-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        fetchLeaderboard(leaderboardCurrentPage - 1)
                      }
                      disabled={leaderboardCurrentPage <= 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Page {leaderboardCurrentPage} of {totalLeaderboardPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        fetchLeaderboard(leaderboardCurrentPage + 1)
                      }
                      disabled={leaderboardCurrentPage >= totalLeaderboardPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabPanel>
        </TabContent>
      </div>
    </div>
  );
}
