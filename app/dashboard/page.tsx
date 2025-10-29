"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Trophy,
  DollarSign,
  Plus,
  Video,
  User,
  Building,
  HelpCircle,
  Eye,
  Coins,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { formatLocalDateTime } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useClientAuth } from "@/hooks/use-client-auth";
import { createClient } from "@/utils/supabase/client";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { useIsMobile } from "@/hooks/use-mobile";

import { ContestCreationModal } from "@/components/ContestCreationModal";
import { useContestCreation } from "@/hooks/use-contest-creation";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import GettingStartedModal from "@/components/GettingStartedModal";
import { SurveyModal } from "@/components/SurveyModal";
import { hasSubmitted } from "@/lib/form-submissions";

function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const {
    user,
    isLoading: isAuthLoading,
    isAuthenticated,
  } = useClientAuth({
    redirectTo: "/auth/signin",
  });
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<any>(null);
  const [recentContests, setRecentContests] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [userCoins, setUserCoins] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);
  const [userDetails, setUserDetails] = useState<{
    email: string;
    username: string;
    fullName: string;
  } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { handleCreateContest } = useContestCreation(user?.id);
  const [showPopup, setShowPopup] = useState(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isSurveyCompleted, setIsSurveyCompleted] = useState(false);
  // Handle checkout success - with protection against infinite loops
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");

    if (success === "true" && sessionId && user && !hasProcessedSuccess) {
      console.log(
        "🎉 Payment successful in dashboard, refreshing profile data..."
      );
      setHasProcessedSuccess(true);

      // Clear URL parameters to prevent refresh loops
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // Refresh profile data after a short delay to allow webhook processing
      const refreshProfileData = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Refetch the profile data to get updated subscription info
          if (user.user_type === "advertiser") {
            const { data: advertiserProfile } = await supabase
              .from("advertiser_profiles")
              .select("*, subscription_info")
              .eq("id", user.id)
              .single();

            if (advertiserProfile) {
              setProfile(advertiserProfile);
              console.log("✅ Profile data refreshed after checkout");
            }
          }
        } catch (error) {
          console.error("Error refreshing profile data:", error);
        }
      };

      refreshProfileData();
    }
  }, [searchParams, user, supabase, hasProcessedSuccess]);

  // Effect to auto-open WelcomePopup ONLY once after login
  useEffect(() => {
    if (
      profile &&
      "company_name" in profile && // ✅ advertiser check
      (!profile?.total_contests_run || profile.total_contests_run === 0) // ✅ no contests
    ) {
      // ✅ Check if user already saw the popup
      const hasSeenPopup = localStorage.getItem("gettingStartedPopupShown");

      if (!hasSeenPopup) {
        setShowPopup(true); // ✅ Open popup first time
        localStorage.setItem("gettingStartedPopupShown", "true"); // ✅ Mark as seen
      }
    }
  }, [profile]);

  // Check survey completion status
  useEffect(() => {
    const checkSurveyStatus = async () => {
      if (userDetails?.email) {
        try {
          const submitted = await hasSubmitted(userDetails.email);
          setIsSurveyCompleted(submitted);
        } catch (error) {
          console.error("Error checking survey status:", error);
        }
      }
    };
    checkSurveyStatus();
  }, [userDetails?.email]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!user) {
        console.warn("DashboardPage: Fetch attempt skipped, no user found.");
        if (isMounted) setIsFetchingData(false);
        return;
      }

      if (isMounted) setIsFetchingData(true);

      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type, coins, email, username, full_name")
          .eq("id", user.id)
          .single();

        if (!isMounted) return;

        if (userError) {
          console.error("Error fetching user data:", userError);
          if (isMounted) setIsFetchingData(false);
          return;
        }

        const userType = userData?.user_type;
        setUserCoins(userData?.coins || 0);

        // Set user details for survey
        setUserDetails({
          email: userData?.email || user?.email || "",
          username: userData?.username || "",
          fullName: userData?.full_name || user?.user_metadata?.full_name || "",
        });

        if (userType === "advertiser") {
          // Fetch advertiser profile
          const { data: advertiserProfile, error: profileError } =
            await supabase
              .from("advertiser_profiles")
              .select("*, subscription_info")
              .eq("id", user.id)
              .single();

          if (!isMounted) return;
          if (profileError) {
            console.error("Error fetching advertiser profile:", profileError);
          }

          // Fetch contests data for accurate calculations
          const { data: contests, error: contestsError } = await supabase
            .from("contests")
            .select("*")
            .eq("advertiser_id", user.id);

          if (!isMounted) return;
          if (contestsError) {
            console.error("Error fetching contests:", contestsError);
          }

          // Fetch submissions for views calculation
          const { data: submissions, error: submissionsError } = await supabase
            .from("submissions")
            .select("*, contests!inner(*)")
            .eq("contests.advertiser_id", user.id);

          if (!isMounted) return;
          if (submissionsError) {
            console.error("Error fetching submissions:", submissionsError);
          }

          // Calculate actual statistics
          const totalContests = contests?.length || 0;
          const totalViews =
            submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
          const totalSpent =
            contests?.reduce((sum, contest) => {
              if (
                contest.contest_type === "leaderboard" &&
                contest.contest_based_details?.leaderboard_contest?.total_prize
              ) {
                return (
                  sum +
                  contest.contest_based_details.leaderboard_contest.total_prize
                );
              } else if (
                contest.contest_type === "cpm" &&
                contest.contest_based_details?.cpm_contest?.total_budget
              ) {
                return (
                  sum + contest.contest_based_details.cpm_contest.total_budget
                );
              }
              return sum;
            }, 0) || 0;

          // Update profile with calculated values
          const updatedProfile = {
            ...advertiserProfile,
            total_contests_run: totalContests,
            total_money_spent: totalSpent,
            total_views: totalViews,
          };

          setProfile(updatedProfile);

          // Get recent contests for display
          const recentContests =
            contests
              ?.slice(0, 3)
              ?.sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              ) || [];

          setRecentContests(recentContests);
        } else if (userType === "creator") {
          const { data: creatorProfile, error: profileError } = await supabase
            .from("creator_profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (!isMounted) return;
          if (profileError) {
            console.error("Error fetching creator profile:", profileError);
          } else {
            setProfile(creatorProfile);
          }

          const { data: submissions, error: submissionsError } = await supabase
            .from("submissions")
            .select("*, contests(*)")
            .eq("creator_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3);

          if (!isMounted) return;
          if (submissionsError) {
            console.error("Error fetching submissions:", submissionsError);
          } else if (submissions) {
            const contests = submissions
              .map((sub) => sub.contests)
              .filter(Boolean);

            // Remove duplicate contests by keeping only unique contest IDs
            const uniqueContests = contests.reduce(
              (acc: any[], contest: any) => {
                if (!acc.find((c) => c.id === contest.id)) {
                  acc.push(contest);
                }
                return acc;
              },
              []
            );

            setRecentContests(uniqueContests || []);
          }
        } else if (userType === "admin") {
          // Redirect admin users to their dedicated admin dashboard
          router.push("/dashboard/admin");
          return;
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        if (isMounted) {
          setIsFetchingData(false);
        }
      }
    }

    if (isAuthenticated && !isAuthLoading) {
      fetchData();
    } else if (!isAuthLoading && !isAuthenticated) {
      setIsFetchingData(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user, isAuthLoading, isAuthenticated, supabase, router]);

  // Guidelines check moved to opportunities page for creators

  if (isAuthLoading || isFetchingData) {
    return (
      <div className="flex items-center justify-center h-[76vh]">
        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="text-center p-8">
        Please sign in to view the dashboard.
      </div>
    );
  }

  const handleCreateContestClick = async () => {
    setLoading(true);
    const shouldShowModal = await handleCreateContest();
    if (shouldShowModal) {
      setShowModal(true);
      setLoading(false);
    }
  };

  const isAdvertiser = profile && "company_name" in profile;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="pl-2 text-2xl md:text-3xl font-bold tracking-tight">
          Dashboard
        </h2>
        <div className="flex items-center gap-3">
          {/* Survey Button - Only show for creators and if survey not completed */}
          {!isAdvertiser && !isSurveyCompleted && (
            <button
              onClick={() => setIsSurveyModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-md rounded-xl bg-[#4A00BE] text-white font-medium"
            >
              <MessageSquare className="h-4 w-4" />
              Take Survey
            </button>
          )}
          {isAdvertiser && (
            <button
              onClick={handleCreateContestClick}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 text-md rounded-xl bg-[#4A00BE] text-white font-medium"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Contest
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdvertiser ? (
          <>
            {/* Total Spent Card - Red/Pink */}
            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4">
                <div className="flex justify-between">
                  {/* <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 mb-4">
                    <DollarSign className="w-5 h-5" />
                  </div> */}
                  <div className="flex-1 text-black space-y-2">
                    <p className="text-lg font-medium">Total Spent</p>
                    <p className="text-xl font-bold ">
                      {formatCurrencyFromCents(profile?.total_money_spent || 0)}
                    </p>
                    <p className="text-md mt-0.5">Money spent on contests</p>
                  </div>
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </div>

            {/* Total Contests Card - Blue */}
            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4">
                <div className="flex justify-between">
                  {/* <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                    <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div> */}
                  <div className="flex-1 text-black space-y-2">
                    <p className="text-lg font-medium">Total Contests</p>
                    <p className="text-xl font-bold">
                      {profile?.total_contests_run || 0}
                    </p>
                    <p className="text-md mt-0.5">Contests created</p>
                  </div>
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
                    <Trophy className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </div>
          </>
        ) : (
          <>
            {/* Total Earnings Card - Green */}

            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4">
                <div className="flex justify-between">
                  <div className="flex-1 text-black space-y-2">
                    <p className="text-lg font-medium">Total Earnings</p>
                    <p className="text-xl font-bold">
                      {formatCurrencyFromCents(profile?.total_money_won || 0)}
                    </p>
                    <p className="text-md  mt-0.5">
                      Money earned from contests
                    </p>
                  </div>
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </div>
            {/* <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">
                      Total Earnings
                    </p>
                    <p className="text-lg font-bold text-green-900 dark:text-green-100">
                      {formatCurrencyFromCents(profile?.total_money_won || 0)}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                      Money earned from contests
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card> */}

            {/* Contests Won Card - Yellow/Gold */}

            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
              <CardContent className="p-4">
                <div className="flex justify-between">
                  <div className="flex-1 text-black space-y-2">
                    <p className="text-lg font-medium">Contests Won</p>
                    <p className="text-xl font-bold">
                      {profile?.total_contests_won || 0}
                    </p>
                    <p className="text-md  mt-0.5">
                      Out of {profile?.total_contests_participated || 0}{" "}
                      participated
                    </p>
                  </div>
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
                    <Trophy className="h-6 w-6" />
                  </div>
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
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">
                      Contests Won
                    </p>
                    <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                      {profile?.total_contests_won || 0}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                      Out of {profile?.total_contests_participated || 0}{" "}
                      participated
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card> */}
          </>
        )}

        {/* Total Views Card - Purple */}
        <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
          <CardContent className="p-4">
            <div className="flex justify-between">
              {/* <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div> */}
              <div className="flex-1 text-black space-y-2">
                <p className="text-lg font-medium">Total Views</p>
                <p className="text-xl font-bold">
                  {(profile?.total_views || 0).toLocaleString()}
                </p>
                <p className="text-md  mt-0.5">
                  {isAdvertiser
                    ? "Views on contest content"
                    : "Views on your content"}
                </p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
                <Eye className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </div>

        {/* Available Coins Card - Orange */}
        <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
          <CardContent className="p-4">
            <div className="flex justify-between">
              {/* <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-600 dark:text-orange-400"
                >
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v4l2 2" />
                </svg>
              </div> */}
              <div className="flex-1 text-black space-y-2">
                <p className="text-lg font-medium">Available Coins</p>
                <p className="text-lg font-bold">{userCoins}</p>
                <p className="text-md mt-0.5">Coins to redeem or use</p>
              </div>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE] mb-4">
                <Coins className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </div>
      </div>

      {/* Getting Started Section - Only show for advertisers with no contests */}
      {isAdvertiser &&
        (!profile?.total_contests_run || profile.total_contests_run === 0) && (
          <Card className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700/50 rounded-xl">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex items-start sm:items-center space-x-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full flex-shrink-0">
                    <HelpCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      New to Game Of Creators?
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                      Learn about our two contest types: Leaderboard and CPM
                      contests
                    </p>
                  </div>
                </div>
                {/* <Link href="/dashboard/getting-started">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Get Started
                  </Button>
                </Link> */}
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center sm:justify-start px-4 py-2"
                  onClick={() => setShowPopup(true)}
                >
                  <HelpCircle className="w-4 h-4" />
                  Get Started
                </Button>
                <GettingStartedModal
                  open={showPopup}
                  onClose={() => setShowPopup(false)}
                />
              </div>
            </CardContent>
          </Card>
        )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white min-h-[300px] rounded-xl shadow-md flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              {isAdvertiser
                ? "Your recent contests"
                : "Contests you've participated in recently"}
            </CardDescription>
          </CardHeader>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4">
            {recentContests && recentContests.length > 0 ? (
              <div className="space-y-4">
                {recentContests.map((contest) => (
                  <div
                    key={contest.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-[#D1B7F9]"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* <div className="rounded-full bg-primary/10 p-3 flex-shrink-0">
                        
                        <Trophy className="h-5 w-5 text-primary" />
                      </div> */}

                      <div className="rounded-full flex-shrink-0 h-8 w-8 md:w-14 md:h-14 overflow-hidden">
                        <img
                          src={contest.thumbnail_url}
                          alt="Thumbnail"
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-foreground break-words">
                          {contest.title}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                          {contest.platform} •{" "}
                          {formatLocalDateTime(contest.created_at, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={
                        isAdvertiser
                          ? `/dashboard/contests/${contest.id}`
                          : `/dashboard/opportunities/${contest.id}`
                      }
                      className="block w-full sm:w-auto"
                    >
                      <button className="w-full px-4 py-2 rounded-xl bg-[#6C43D0] text-white">
                        View
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-md text-muted-foreground">
                  {isAdvertiser
                    ? "No contests created yet"
                    : "No contest activity yet"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md">
          <CardHeader>
            <CardTitle>Analytics Overview</CardTitle>
            <CardDescription>
              Performance insights for your{" "}
              {isAdvertiser ? "contests" : "content"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[270px] bg-[#7F39EC26] items-center justify-center border border-[#D1B7F9] rounded-xl">
              <p className="text-lg text-black font-semibold">
                Detailed analytics available soon
              </p>
            </div>
          </CardContent>
        </div>
      </div>
      <ContestCreationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        userId={user?.id || ""}
      />
      {/* Survey Modal */}
      <SurveyModal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
      />
    </div>
  );
}

export default DashboardPage; // Export directly
