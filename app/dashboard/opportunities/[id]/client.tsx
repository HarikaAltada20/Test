"use client";

import { useState, useEffect } from "react";
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

// Define type for prize objects globally within the file
type PrizeInfo = {
  position: number;
  amount: number;
};

// LeaderboardEntry type reflects combined data from API
type LeaderboardEntry = {
  // Submission fields
  id: string;
  creator_id: string;
  video_title: string;
  views: number;
  earnings: number;
  status: string;
  created_at: string;
  content_link: string;
  // Added 'users' field containing data from the joined users table
  users: {
    id: string;
    username: string;
    profile_picture_url: string | null; // It can be null
    full_name: string | null; // It can be null
  } | null;
  // Added creator_profile data
  creator_profile: {
    id: string;
    youtube_account: {
      channel_thumbnail?: string; // Added optional youtube thumbnail
      // Add other fields from youtube_account if needed
    } | null;
    // Add other creator_profile fields if needed
  } | null;
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

  // Function to fetch leaderboard data
  const fetchLeaderboard = async () => {
    if (!isMounted) return;
    setLoadingLeaderboard(true);
    let leaderboardFetchError = null;
    try {
      const response = await fetch(`/api/leaderboard/${contestId}`);
      const data = await response.json();
      if (!response.ok) {
        leaderboardFetchError = data.error || "Failed to fetch leaderboard";
        throw new Error(leaderboardFetchError);
      }
      if (isMounted) {
        setLeaderboard(data.leaderboard || []);
        setLastUpdated(data.lastUpdated);
      }
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      if (isMounted && !error) setError(leaderboardFetchError || err.message);
    } finally {
      if (isMounted) setLoadingLeaderboard(false);
    }
  };

  let isMounted = true; // Flag to track component mount status

  useEffect(() => {
    isMounted = true;

    // Only run fetch logic if the user object is available
    if (!user) {
      // Keep showing the initial loading state
      setLoading(true);
      return;
    }

    // User object exists, proceed to fetch data
    async function fetchData() {
      if (!isMounted) return;
      setLoading(true);
      setError(null);

      try {
        // Explicit check inside try block, though outer check should suffice
        if (!user) {
          throw new Error("User not available for fetching data.");
        }

        // Get user role from the database
        const { data: userData } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", user.id)
          .single(); // Can remove assertion now

        if (userData?.user_type !== "creator") {
          // Keep redirect for wrong user type
          router.push("/dashboard");
          return;
        }

        // Fetch contest details using maybeSingle()
        const { data: contestData, error: contestError } = await supabase
          .from("contests_with_status") // Use the view
          .select(
            `
                        *,
                        advertiser_profiles ( company_name )
                    `
          )
          .eq("id", contestId)
          .maybeSingle(); // Handles not found gracefully

        // Handle potential errors during fetch
        if (contestError) {
          console.error("Error fetching contest details:", contestError);
          if (isMounted) {
            setError(`Contest fetch error: ${contestError.message}`);
            setLoading(false);
          }
          return; // Stop execution if there was a DB error
        }

        // Handle case where contest is not found (maybeSingle returns null data)
        if (!contestData) {
          if (isMounted) {
            setError("Contest not found.");
            setLoading(false);
          }
          return; // Stop execution if contest not found
        }

        // Check contest status
        if (
          ["draft", "incomplete"].includes(contestData.status) ||
          contestData.is_draft
        ) {
          if (isMounted) {
            setError("This contest is not available.");
            setLoading(false);
          }
          return;
        }

        // Fetch existing submission (only if contest data is valid)
        let submissionResult = null;
        // Ensure user.id is accessed safely (already handled by initial !user check)
        const { data: submissionData, error: submissionError } = await supabase
          .from("submissions")
          .select("id, created_at")
          .eq("contest_id", contestId)
          .eq("creator_id", user.id) // user is guaranteed non-null here
          .limit(1);
        submissionResult =
          submissionData && submissionData.length > 0
            ? submissionData[0]
            : null;

        if (submissionError) {
          console.error("Error checking existing submission:", submissionError);
          // Handle error appropriately, maybe show a toast
        } else if (submissionResult) {
          setHasSubmitted(true);
          // Store the timestamp as well if needed, e.g., for display
          // setSubmissionTime(submissionResult.created_at);
        }

        // Update state if component is still mounted
        if (isMounted) {
          setContest(contestData);
          setExistingSubmission(submissionResult);
          setLoading(false);
          fetchLeaderboard(); // Fetch leaderboard after contest details are confirmed
        }
      } catch (err: any) {
        console.error("Error fetching contest data:", err);
        if (isMounted) {
          setError(
            err.message || "An unexpected error occurred during contest fetch"
          );
          setLoading(false);
        }
      }
    }

    fetchData();

    // Set up auto-refresh for leaderboard every 5 minutes
    const intervalId = setInterval(() => {
      if (isMounted && lastUpdated && !loadingLeaderboard) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (lastUpdateTime < fiveMinutesAgo) {
          fetchLeaderboard();
        }
      }
    }, 60 * 1000); // Check every minute if refresh is needed

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
  }, [contestId, user, router, supabase]);

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
                    <CardTitle className="font-bold">Contest Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Brief</h3>
                      <p className="text-muted-foreground text-sm">
                        {contest.brief || "No brief provided"}
                      </p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold text-base mb-1">Start Date & Time</h3>
                        <p className="text-sm text-muted-foreground">
                          {contest.start_date
                            ? formatLocalDateTime(contest.start_date)
                            : "Not specified"}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-base mb-1">End Date & Time</h3>
                        <p className="text-sm text-muted-foreground">
                          {contest.end_date
                            ? formatLocalDateTime(contest.end_date)
                            : "Not specified"}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-base mb-1">Platform</h3>
                        <p className="text-sm text-muted-foreground">
                          {contest.platform || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-base mb-1">Category</h3>
                        <p className="text-sm text-muted-foreground">
                          {contest.category || "Not specified"}
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-base mb-1">Sponsor</h3>
                        <p className="text-sm text-muted-foreground">
                          {contest.advertiser_profiles?.company_name ||
                            "Not specified"}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-lg mb-2">
                        {contest.contest_type === 'cpm' ? 'CPM Configuration' : 'Prize Structure'}
                      </h3>
                      {contest.contest_type === 'leaderboard' && (
                        Array.isArray(contest.contest_based_details?.leaderboard_contest?.prizes) && contest.contest_based_details.leaderboard_contest.prizes.length > 0 ? (
                          <ul className="space-y-1 list-disc list-inside text-sm text-muted-foreground">
                            {[...(contest.contest_based_details.leaderboard_contest.prizes as PrizeInfo[])]
                              .sort((a, b) => a.position - b.position)
                              .map((prize) => (
                                <li key={prize.position}>
                                  Position {prize.position}: {formatMoney(prize.amount)}
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No prize structure defined for this leaderboard contest.
                          </p>
                        )
                      )}
                      {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest && (
                        <div className="space-y-3 text-sm text-muted-foreground">
                          <p><strong className="font-semibold text-slate-700 dark:text-slate-300">CPM Rate:</strong> {formatMoney(contest.contest_based_details.cpm_contest.cpm_rate_usd * 100)} per 1000 views</p>
                          <p><strong className="font-semibold text-slate-700 dark:text-slate-300">Total Budget:</strong> {formatMoney(contest.contest_based_details.cpm_contest.total_budget)}</p>
                          {contest.contest_based_details.cpm_contest.min_views != null && (
                            <p><strong className="font-semibold text-slate-700 dark:text-slate-300">Minimum Views:</strong> {contest.contest_based_details.cpm_contest.min_views.toLocaleString()}</p>
                          )}
                          {contest.contest_based_details.cpm_contest.max_views != null && (
                            <p><strong className="font-semibold text-slate-700 dark:text-slate-300">Max Views (Cap):</strong> {contest.contest_based_details.cpm_contest.max_views.toLocaleString()}</p>
                          )}
                          <div>
                            <h4 className="font-semibold mt-1 mb-1 text-slate-700 dark:text-slate-300">Terms & Conditions:</h4>
                            <div className="prose prose-sm max-w-none p-2 border rounded bg-slate-50 dark:bg-slate-700/50 text-xs">
                              <pre className="whitespace-pre-wrap break-words font-sans text-muted-foreground">
                                {contest.contest_based_details.cpm_contest.terms_conditions || "No specific terms provided."}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                      {contest.contest_type !== 'leaderboard' && contest.contest_type !== 'cpm' && (
                        <p className="text-sm text-muted-foreground">Contest type details not available.</p>
                      )}
                    </div>
                    {/* Rules Section */}
                    {(contest.rules || contest.rules_description) && (
                      <Separator />
                    )}
                    {(contest.rules || contest.rules_description) && (
                      <div>
                        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                          <ScrollText className="h-5 w-5" /> Rules & Guidelines
                        </h3>
                        <div className="prose prose-sm text-muted-foreground max-w-none">
                          {contest.rules_description ? (
                            <p>{contest.rules_description}</p>
                          ) : contest.rules &&
                            typeof contest.rules === "object" &&
                            contest.rules.list &&
                            Array.isArray(contest.rules.list) ? (
                            <ul className="list-disc pl-5 space-y-1">
                              {contest.rules.list.map(
                                (rule: string, index: number) => (
                                  <li key={index}>{rule}</li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p>No specific rules provided.</p>
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
                          <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                            <Link2 className="h-5 w-5" /> Resources
                          </h3>
                          <div className="space-y-2">
                            {Object.entries(contest.resources).map(
                              ([key, value]) => (
                                <Button
                                  key={key}
                                  variant="outline"
                                  size="sm"
                                  asChild
                                >
                                  <Link
                                    href={value as string}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    {key}
                                  </Link>
                                </Button>
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
                            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                              <Lightbulb className="h-5 w-5" /> Inspiration Links
                            </h3>
                            <div className="space-y-2">
                              {links.map((link: string, index: number) => (
                                <Button
                                  key={index}
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="text-primary hover:underline p-0 h-auto justify-start"
                                >
                                  <Link
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1.5" />
                                    Inspiration Example {index + 1}
                                  </Link>
                                </Button>
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
                    <CardTitle className="font-bold">Contest Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold">Timeframe</p>
                        <p className="text-xs text-muted-foreground">
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
                    <div className="flex items-center gap-3">
                      <Trophy className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold">
                          {contest.contest_type === 'cpm' ? 'Total Budget' : 'Total Prize Pool'}
                        </p>
                        <p className="text-xs text-muted-foreground">
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
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold">Sponsor</p>
                        <p className="text-xs text-muted-foreground">
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-bold">Leaderboard</CardTitle>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Last updated: {formatTimeAgo(lastUpdated)}
                  </p>
                  {loadingLeaderboard && (
                    <p className="text-xs text-blue-500 animate-pulse">
                      Updating...
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Handle overall fetch error affecting leaderboard */}
                {error && !loadingLeaderboard && leaderboard.length === 0 && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>
                      Error loading leaderboard: {error}
                    </AlertDescription>
                  </Alert>
                )}
                {
                  loadingLeaderboard && leaderboard.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading leaderboard...
                    </div>
                  ) : !error && leaderboard.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No submissions yet. Be the first!
                    </div>
                  ) : leaderboard.length > 0 ? (
                    <div className="space-y-3">
                      {leaderboard.map((entry, index) => {
                        const rank = index + 1;
                        // Use contest.prizes for prize lookup
                        let prizeInfo = null;
                        if (contest.contest_type === 'leaderboard' && Array.isArray(contest.contest_based_details?.leaderboard_contest?.prizes)) {
                          prizeInfo = (contest.contest_based_details.leaderboard_contest.prizes as PrizeInfo[]).find(
                            (p) => p.position === rank
                          );
                        }
                        const prizeAmount = prizeInfo ? prizeInfo.amount : null;
                        const userData = entry.users; // Use entry.users
                        const creatorProfileData = entry.creator_profile;
                        const videoUrl = entry.content_link || "#";
                        const displayName =
                          userData?.full_name ||
                          userData?.username ||
                          "Unknown Creator";
                        // Prioritize profile_picture_url, then youtube thumbnail
                        const profilePicUrl = userData?.profile_picture_url;
                        const youtubeThumbnail =
                          creatorProfileData?.youtube_account?.channel_thumbnail;

                        return (
                          <div
                            key={entry.id}
                            className="flex items-center gap-3 p-3 border rounded-md bg-background hover:bg-muted/50 transition-colors"
                          >
                            {/* Rank */}
                            <span
                              className={`font-bold text-lg w-8 text-center flex-shrink-0 ${prizeAmount
                                ? "text-primary"
                                : "text-muted-foreground"
                                }`}
                            >
                              {rank}
                            </span>

                            {/* --- Use Avatar Component --- */}
                            <Avatar className="h-10 w-10 rounded-full flex-shrink-0 border">
                              <AvatarImage
                                src={
                                  profilePicUrl || youtubeThumbnail || undefined
                                }
                                alt={displayName}
                              />
                              <AvatarFallback>
                                {displayName?.[0]?.toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            {/* --- End Avatar Component --- */}

                            {/* Info using full_name / username */}
                            <div className="flex-1 min-w-0">
                              <p
                                className="font-semibold text-sm truncate"
                                title={displayName}
                              >
                                {displayName}
                              </p>
                              {userData?.full_name &&
                                userData?.username &&
                                userData.full_name !== userData.username && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    @{userData.username}
                                  </p>
                                )}
                            </div>
                            {/* Right Aligned Section */}
                            <div className="flex items-center gap-3 ml-auto pl-2 flex-shrink-0">
                              {/* Play Button */}
                              <Link
                                href={videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Watch Video"
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                >
                                  <PlayCircle className="h-5 w-5" />
                                </Button>
                              </Link>

                              {/* Views & Prize */}
                              <div className="text-right w-24 space-y-0.5">
                                <p className="font-semibold text-sm truncate">
                                  {entry.views?.toLocaleString() || 0} views
                                </p>
                                {prizeAmount && contest.contest_type === 'leaderboard' && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs font-medium bg-green-100 text-green-700 border-green-200 px-1.5 py-0.5 whitespace-nowrap"
                                  >
                                    Winning Zone: {formatMoney(prizeAmount)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null /* Should be covered by loading/error/empty states */
                }
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
