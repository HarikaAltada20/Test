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
  User,
  ListOrdered,
  ScrollText,
  Link2,
  Lightbulb,
  PlayCircle,
  CheckCircle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatLocalDateTime, formatMoney } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/client";
import type { UserResponse } from "@supabase/supabase-js";

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
let generatedDummyDataCache: { entries: LeaderboardEntry[], myRank: number | null, count: number } | null = null;

const generateAllDummyLeaderboardData = (count: number): { entries: LeaderboardEntry[], myRank: number | null } => {
  if (generatedDummyDataCache && generatedDummyDataCache.count === count) {
    return { entries: generatedDummyDataCache.entries, myRank: generatedDummyDataCache.myRank };
  }

  const entries: LeaderboardEntry[] = [];
  const platforms = ["youtube", "instagram"];
  let tempMyRank: number | null = null;

  for (let i = 0; i < count; i++) {
    const isMyEntry = (i === Math.floor(count / 4)); // Place 'my' entry deterministically
    const creatorId = isMyEntry ? MY_DUMMY_SUBMISSION_USER_ID : `user_dummy_${i}`;
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
      created_at: new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000).toISOString(), // random date in last 45 days
      content_link: "https://www.example.com/watch?v=dQw4w9WgXcQ", // A familiar link for all :)
      platform: platforms[i % platforms.length],
      user_platform_username: username,
      user_full_name: `${isMyEntry ? 'The One And Only' : 'Talented'} ${username.replace(/\d+/g, '')}`,
      creator_pfp_url: `https://i.pravatar.cc/150?u=${creatorId}`,
      user_platform_pfp_url: `https://i.pravatar.cc/150?u=${creatorId}_platform`,
    });
  }

  entries.sort((a, b) => {
    if (b.views !== a.views) return b.views - a.views;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const myEntryIndex = entries.findIndex(e => e.creator_id === MY_DUMMY_SUBMISSION_USER_ID);
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
  const [activeTab, setActiveTab] = useState("details"); // State for controlling active tab

  // Pagination state for leaderboard
  const [leaderboardCurrentPage, setLeaderboardCurrentPage] = useState(1);
  const [leaderboardItemsPerPage, setLeaderboardItemsPerPage] = useState(25); // Or your preferred default
  const [totalLeaderboardEntries, setTotalLeaderboardEntries] = useState(0);
  const [totalLeaderboardPages, setTotalLeaderboardPages] = useState(0);

  // State for logged-in user's submission and rank
  const [myLeaderboardEntry, setMyLeaderboardEntry] = useState<(LeaderboardEntry & { rank: number }) | null>(null);
  const [loadingMySubmission, setLoadingMySubmission] = useState(false);

  const fetchLeaderboard = async (pageToFetch: number = 1) => {
    if (!isMounted) return;
    setLoadingLeaderboard(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: allEntries } = generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const totalEntries = allEntries.length;
      const totalPages = Math.ceil(totalEntries / leaderboardItemsPerPage);
      const startIndex = (pageToFetch - 1) * leaderboardItemsPerPage;
      const endIndex = startIndex + leaderboardItemsPerPage;
      const paginatedEntries = allEntries.slice(startIndex, endIndex);

      setTimeout(() => {
        if (isMounted) {
          setLeaderboard(paginatedEntries);
          setLastUpdated(new Date().toISOString()); // Static for dummy
          setLeaderboardCurrentPage(pageToFetch);
          setTotalLeaderboardPages(totalPages);
          setTotalLeaderboardEntries(totalEntries);
          setLoadingLeaderboard(false);
        }
      }, 300); // Shorter delay for dummy data
      return;
    }

    // Real API Call
    let leaderboardFetchError = null;
    try {
      const response = await fetch(`/api/leaderboard/${contestId}?page=${pageToFetch}&limit=${leaderboardItemsPerPage}`);
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
      }
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      if (isMounted && !error) setError(leaderboardFetchError || err.message);
    } finally {
      if (isMounted) setLoadingLeaderboard(false);
    }
  };

  let isMounted = true; // Flag to track component mount status

  const fetchMySubmissionData = async () => {
    if (!isMounted) return;
    // Removed user check for dummy data path, as 'my' entry is predefined
    // contestId is also not strictly needed for dummy path if MY_DUMMY_SUBMISSION_USER_ID is unique enough

    setLoadingMySubmission(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: allEntries, myRank } = generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const myEntryData = allEntries.find(e => e.creator_id === MY_DUMMY_SUBMISSION_USER_ID);

      setTimeout(() => {
        if (isMounted) {
          if (myEntryData && myRank !== null) {
            setMyLeaderboardEntry({ ...myEntryData, rank: myRank });
          } else {
            setMyLeaderboardEntry(null);
          }
          setLoadingMySubmission(false);
        }
      }, 150); // Shorter delay
      return;
    }

    // Real API Call
    if (!user || !contestId) { // user and contestId ARE needed for real API call
      if (isMounted) setLoadingMySubmission(false);
      return;
    }
    try {
      const response = await fetch(`/api/leaderboard/${contestId}/my-submission`);
      const data = await response.json();
      if (!response.ok) {
        console.warn('Failed to fetch user submission data:', data.error || "Unknown error");
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

        if (["draft", "incomplete"].includes(contestData.status) || contestData.is_draft) {
          throw new Error("This contest is not available.");
        }
        if (isMounted) setContest(contestData);

        // Fetch existing submission status for the current user (if logged in)
        // This is separate from the main leaderboard logic.
        if (user) {
          const { data: submissionData, error: submissionError } = await supabase
            .from("submissions")
            .select("id, created_at")
            .eq("contest_id", contestId)
            .eq("creator_id", user.id)
            .limit(1);

          if (submissionError) console.error("Error checking existing submission:", submissionError);
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
          setLoading(false); // Done with initial loading phase
        }
      }
    }

    fetchData();

    // Auto-refresh for leaderboard (only if NOT using dummy data)
    const intervalId = setInterval(() => {
      if (isMounted && lastUpdated && !loadingLeaderboard && !USE_DUMMY_DATA_FOR_LEADERBOARD) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (lastUpdateTime < fiveMinutesAgo) {
          fetchLeaderboard(leaderboardCurrentPage);
        }
      }
    }, 60 * 1000);

    // Check for URL hash to set active tab
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#leaderboard') {
        if (isMounted) setActiveTab('leaderboard');
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
  const formatTimeAgo = (timestamp: string | null): string => {
    if (!timestamp) return "never";
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);

    if (diffInMinutes < 1) return "just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return past.toLocaleDateString();
  };

  // Show loading state ONLY when fetching data (loading state)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p>Loading contest details...</p>
        </div>
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

  // Render main content
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            className="hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600"
            onClick={() => router.push("/dashboard/opportunities")}
          >
            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </Button>
          {/* Placeholder for potential future actions like share */}
        </div>

        {/* Contest Header Section */}
        <div className="mb-8 p-6 bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 dark:from-rose-600 dark:via-pink-600 dark:to-purple-700 rounded-xl shadow-2xl text-white">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                {contest.title}
              </h1>
              <div className="flex items-center space-x-3 mb-4">
                <Badge
                  className={`text-sm px-3 py-1 font-semibold rounded-full shadow-md border-2 border-white/50 ${contest.status === "active"
                    ? "bg-green-400/80 backdrop-blur-sm"
                    : contest.status === "upcoming"
                      ? "bg-blue-400/80 backdrop-blur-sm"
                      : "bg-slate-400/80 backdrop-blur-sm"
                    }`}
                >
                  {contest.status.toUpperCase()}
                </Badge>
                {contest.contest_type && (
                  <Badge
                    variant={contest.contest_type === 'cpm' ? "outline" : "default"} // Use outline for secondary for better contrast on gradient
                    className="capitalize text-sm px-3 py-1 font-semibold rounded-full shadow-md bg-white/20 backdrop-blur-sm border-2 border-white/50 text-white"
                  >
                    {contest.contest_type === 'cpm' ? 'CPM Based' : 'Leaderboard'}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              {/* Placeholder for a potential countdown timer or key stat like total entries */}
            </div>
          </div>
        </div>

        {contest.thumbnail_url && (
          <div className="mb-8 aspect-video w-full max-w-5xl mx-auto relative overflow-hidden rounded-xl shadow-xl border-4 border-white dark:border-slate-700">
            <Image
              src={contest.thumbnail_url}
              alt={`${contest.title} thumbnail`}
              fill
              style={{ objectFit: "contain" }} // Changed to contain to ensure full image visibility
              priority
              className="bg-slate-100 dark:bg-slate-800"
            />
          </div>
        )}

        {/* Action Card: Submit or Status - More Prominent */}
        <Card className="mb-8 shadow-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardContent className="p-6 text-center">
            {hasSubmitted ? (
              <div className="flex flex-col items-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  You have already submitted for this opportunity!
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Submitted {formatTimeAgo(existingSubmission.created_at)}
                </p>
                {/* Optional: Link to view submission could go here */}
              </div>
            ) : (
              <div>
                <p className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Ready to Showcase Your Talent?
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  {contest.status === "active"
                    ? "The stage is yours! Submit your content to join the game."
                    : contest.status === "upcoming"
                      ? "Get ready! This contest hasn\'t started yet."
                      : "This contest has ended or is no longer active."
                  }
                </p>
                <Button
                  size="lg" // Larger button
                  onClick={handleSubmitContent}
                  disabled={contest.status?.toLowerCase() !== "active"}
                  className={`w-full max-w-xs mx-auto font-bold text-base py-3 rounded-lg shadow-md transition-all duration-300 ease-in-out 
                    ${contest.status?.toLowerCase() === "active"
                      ? "bg-rose-600 hover:bg-rose-700 text-white transform hover:scale-105"
                      : "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    }`}
                >
                  {contest.status?.toLowerCase() === "upcoming"
                    ? (<><Calendar className="mr-2 h-5 w-5" /> Contest Not Started</>)
                    : contest.status?.toLowerCase() === "ended" || contest.status?.toLowerCase() === "completed"
                      ? "Contest Ended"
                      : (<><PlayCircle className="mr-2 h-5 w-5" /> Submit Your Entry!</>)
                  }
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-200 dark:bg-slate-700/50 rounded-lg p-1">
            <TabsTrigger value="details" className="py-2.5 text-sm font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600 data-[state=active]:shadow-md data-[state=active]:text-primary rounded-md transition-all">Contest Details</TabsTrigger>
            <TabsTrigger value="leaderboard" className="py-2.5 text-sm font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600 data-[state=active]:shadow-md data-[state=active]:text-primary rounded-md transition-all">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-bold text-slate-900 dark:text-slate-100">Contest Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100">Brief</h3>
                      {(contest.brief_html || contest.brief) ? (
                        <div
                          className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300"
                          dangerouslySetInnerHTML={{ __html: contest.brief_html || contest.brief || '' }}
                        />
                      ) : (
                        <p className="text-slate-600 dark:text-slate-400 text-sm">No brief provided</p>
                      )}
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold text-base mb-2 text-slate-900 dark:text-slate-100">Start Date & Time</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {contest.start_date
                            ? formatLocalDateTime(contest.start_date)
                            : "Not specified"}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-base mb-2 text-slate-900 dark:text-slate-100">End Date & Time</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {contest.end_date
                            ? formatLocalDateTime(contest.end_date)
                            : "Not specified"}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-base mb-2 text-slate-900 dark:text-slate-100">Platform</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {contest.platform || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-base mb-2 text-slate-900 dark:text-slate-100">Category</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {contest.category || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-base mb-2 text-slate-900 dark:text-slate-100">Sponsor</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {contest.advertiser_profiles?.company_name ||
                            "Not specified"}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100">
                        {contest.contest_type === 'cpm' ? 'CPM Configuration' : 'Prize Structure'}
                      </h3>
                      {contest.contest_type === 'leaderboard' && (
                        Array.isArray(contest.contest_based_details?.leaderboard_contest?.prizes) && contest.contest_based_details.leaderboard_contest.prizes.length > 0 ? (
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                            <ul className="space-y-2">
                              {[...(contest.contest_based_details.leaderboard_contest.prizes as PrizeInfo[])]
                                .sort((a, b) => a.position - b.position)
                                .map((prize) => (
                                  <li key={prize.position} className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                      Position {prize.position}
                                    </span>
                                    <span className="font-bold text-green-600 dark:text-green-400">
                                      {formatMoney(prize.amount)}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            No prize structure defined for this leaderboard contest.
                          </p>
                        )
                      )}
                      {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-800 dark:text-slate-200">CPM Rate:</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {formatMoney(contest.contest_based_details.cpm_contest.cpm_rate_usd * 100)} per 1000 views
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-800 dark:text-slate-200">Total Budget:</span>
                              <span className="font-bold text-green-600 dark:text-green-400">
                                {formatMoney(contest.contest_based_details.cpm_contest.total_budget)}
                              </span>
                            </div>
                            {contest.contest_based_details.cpm_contest.min_views != null && (
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-slate-800 dark:text-slate-200">Minimum Views:</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {contest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {contest.contest_based_details.cpm_contest.max_views != null && (
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-slate-800 dark:text-slate-200">Max Views (Cap):</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {contest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                          <Separator />
                          <div>
                            <h4 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">Terms & Conditions:</h4>
                            <div className="bg-white dark:bg-slate-900 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-700 dark:text-slate-300">
                                {contest.contest_based_details.cpm_contest.terms_conditions || "No specific terms provided."}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                      {contest.contest_type !== 'leaderboard' && contest.contest_type !== 'cpm' && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">Contest type details not available.</p>
                      )}
                    </div>
                    {/* Rules Section */}
                    {(contest.rules || contest.rules_description) && (
                      <div>
                        <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <ScrollText className="h-5 w-5" /> Rules & Guidelines
                        </h3>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                          {contest.rules_description ? (
                            <p className="text-slate-700 dark:text-slate-300">{contest.rules_description}</p>
                          ) : contest.rules &&
                            typeof contest.rules === "object" &&
                            contest.rules.list &&
                            Array.isArray(contest.rules.list) ? (
                            <ul className="space-y-2">
                              {contest.rules.list.map(
                                (rule: string, index: number) => (
                                  <li key={index} className="flex items-start py-1">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                                    <span className="text-slate-700 dark:text-slate-300">{rule}</span>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className="text-slate-600 dark:text-slate-400">No specific rules provided.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Resources Section */}
                    {contest.resources &&
                      typeof contest.resources === "object" &&
                      Object.keys(contest.resources).length > 0 && <Separator />}
                    {contest.resources &&
                      typeof contest.resources === "object" &&
                      Object.keys(contest.resources).length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg mb-4 text-slate-900 dark:text-slate-100">
                            Resources
                          </h3>
                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
                            {Object.entries(contest.resources).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
                                >
                                  <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {key}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
                                  >
                                    <Link
                                      href={value as string}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      View Resource
                                    </Link>
                                  </Button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Inspiration Links Section */}
                    {(() => {
                      let links = [];
                      try {
                        links =
                          typeof contest.inspiration_links === "string"
                            ? JSON.parse(contest.inspiration_links)
                            : Array.isArray(contest.inspiration_links)
                              ? contest.inspiration_links
                              : [];
                      } catch (e) {
                        console.error("Error parsing inspiration_links:", e);
                      }
                      return links.length > 0 ? (
                        <>
                          <Separator />
                          <div>
                            <h3 className="font-semibold text-lg mb-4 text-slate-900 dark:text-slate-100">
                              Inspiration Links
                            </h3>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
                              {links.map((link: string, index: number) => (
                                <div
                                  key={index}
                                  className="flex items-center py-2 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
                                >
                                  <ExternalLink className="h-4 w-4 mr-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                  <Link
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-medium text-sm truncate"
                                  >
                                    {link}
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-bold text-slate-900 dark:text-slate-100">Contest Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Timeframe</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {contest.start_date
                            ? formatLocalDateTime(contest.start_date, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                            : "N/A"}{" "}
                          -{" "}
                          {contest.end_date
                            ? formatLocalDateTime(contest.end_date, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {contest.contest_type === 'cpm' ? 'Total Budget' : 'Total Prize Pool'}
                        </p>
                        <p className="text-xs font-bold text-green-600 dark:text-green-400">
                          {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest
                            ? formatMoney(contest.contest_based_details.cpm_contest.total_budget)
                            : contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest
                              ? formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)
                              : contest.total_prize // Fallback to old field if necessary for older data
                                ? formatMoney(contest.total_prize || 0)
                                : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sponsor</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {contest.advertiser_profiles?.company_name ||
                            "Not specified"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leaderboard">
            {loadingLeaderboard ? (
              <p className="text-center py-4">Loading leaderboard...</p>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : leaderboard.length === 0 && totalLeaderboardEntries === 0 ? (
              <p className="text-center py-4">No submissions yet. Be the first!</p>
            ) : (
              <div className="space-y-3">
                {/* Logged-in User's Rank Card */}
                {loadingMySubmission && (
                  <div className="text-center py-3">
                    <p>Loading your rank...</p>
                  </div>
                )}
                {myLeaderboardEntry && (
                  <Card key={`my-rank-${myLeaderboardEntry.id}`} className="shadow-lg border-2 border-primary/50 bg-primary/5 dark:bg-primary/10 overflow-hidden mb-6">
                    <CardContent className="p-3 sm:p-4 flex items-center space-x-3 sm:space-x-4">
                      <div className="text-lg sm:text-xl font-bold text-primary w-10 sm:w-12 text-center flex-shrink-0">
                        #{myLeaderboardEntry.rank}
                      </div>
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/30 flex-shrink-0">
                        <AvatarImage
                          src={myLeaderboardEntry.creator_pfp_url ?? myLeaderboardEntry.user_platform_pfp_url ?? undefined}
                          alt={myLeaderboardEntry.user_platform_username}
                        />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {myLeaderboardEntry.user_platform_username?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-grow min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-primary dark:text-primary-foreground truncate" title={myLeaderboardEntry.user_platform_username}>
                          {myLeaderboardEntry.user_platform_username} (You)
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Submitted: {formatTimeAgo(myLeaderboardEntry.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end space-y-0.5 sm:space-y-1 flex-shrink-0 ml-auto pl-2">
                        <div className="flex items-center space-x-2">
                          <p className="text-base sm:text-lg font-bold text-primary dark:text-primary-foreground">
                            {myLeaderboardEntry.views.toLocaleString()} views
                          </p>
                          {myLeaderboardEntry.content_link && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-primary/80 hover:text-primary dark:text-primary-foreground/80 dark:hover:text-primary-foreground" asChild>
                              <Link href={myLeaderboardEntry.content_link} target="_blank" rel="noopener noreferrer" title="View Your Content">
                                <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                        {(() => {
                          let prizeDisplay = null;
                          if (myLeaderboardEntry.earnings > 0) {
                            prizeDisplay = <span className="font-semibold text-green-600 dark:text-green-400">Earned: {formatMoney(myLeaderboardEntry.earnings)}</span>;
                          } else if (contest.contest_type === 'leaderboard' && Array.isArray(contest.contest_based_details?.leaderboard_contest?.prizes)) {
                            const prizeInfo = (contest.contest_based_details.leaderboard_contest.prizes as PrizeInfo[])
                              .find(p => p.position === myLeaderboardEntry.rank);
                            if (prizeInfo) {
                              const prizeText = contest.status === 'active' ? "Winning Zone" : "Prize";
                              prizeDisplay = (
                                <span className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                                  <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                  {prizeText}: {formatMoney(prizeInfo.amount)}
                                </span>
                              );
                            }
                          }
                          return prizeDisplay ? <div className="text-xs sm:text-sm">{prizeDisplay}</div> : null;
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Main Leaderboard List */}
                <div className="text-sm text-muted-foreground text-right mb-2">
                  Last updated: {lastUpdated ? formatTimeAgo(lastUpdated) : "Never"}
                  {totalLeaderboardEntries > 0 && (
                    <span className="ml-2">| Total Submissions: {totalLeaderboardEntries.toLocaleString()}</span>
                  )}
                </div>
                {leaderboard.map((entry, index) => {
                  const rank = ((leaderboardCurrentPage - 1) * leaderboardItemsPerPage) + index + 1;
                  let prizeDisplay = null;

                  if (entry.earnings > 0) {
                    prizeDisplay = <span className="font-semibold text-green-600 dark:text-green-400">Earned: {formatMoney(entry.earnings)}</span>;
                  } else if (contest.contest_type === 'leaderboard' && Array.isArray(contest.contest_based_details?.leaderboard_contest?.prizes)) {
                    const prizeInfo = (contest.contest_based_details.leaderboard_contest.prizes as PrizeInfo[])
                      .find(p => p.position === rank);
                    if (prizeInfo) {
                      const prizeText = contest.status === 'active' ? "Winning Zone" : "Prize";
                      prizeDisplay = (
                        <span className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                          <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                          {prizeText}: {formatMoney(prizeInfo.amount)}
                        </span>
                      );
                    }
                  }

                  return (
                    <Card key={entry.id} className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                      <CardContent className="p-3 sm:p-4 flex items-center space-x-3 sm:space-x-4">
                        <div className="text-lg sm:text-xl font-bold text-slate-400 dark:text-slate-500 w-6 sm:w-8 text-center flex-shrink-0">{rank}</div>
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border flex-shrink-0">
                          <AvatarImage
                            src={entry.creator_pfp_url ?? entry.user_platform_pfp_url ?? undefined}
                            alt={entry.user_platform_username}
                          />
                          <AvatarFallback>
                            {entry.user_platform_username?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-grow min-w-0">
                          <p className="text-sm sm:text-base font-semibold truncate text-slate-800 dark:text-slate-100">
                            {entry.user_platform_username}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Submitted: {formatTimeAgo(entry.created_at)}
                          </p>
                        </div>

                        <div className="flex flex-col items-end space-y-0.5 sm:space-y-1 flex-shrink-0 ml-auto pl-2">
                          <div className="flex items-center space-x-2">
                            <p className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-200">
                              {entry.views.toLocaleString()} views
                            </p>
                            {entry.content_link && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary" asChild>
                                <Link href={entry.content_link} target="_blank" rel="noopener noreferrer" title="View Content">
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
                    </Card>
                  );
                })}

                {/* Pagination Controls */}
                {totalLeaderboardPages > 1 && (
                  <div className="flex items-center justify-center space-x-4 py-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchLeaderboard(leaderboardCurrentPage - 1)}
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
                      onClick={() => fetchLeaderboard(leaderboardCurrentPage + 1)}
                      disabled={leaderboardCurrentPage >= totalLeaderboardPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
