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
import { Trophy, DollarSign, Plus, Video, User, Building } from "lucide-react";
import { formatLocalDateTime } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useClientAuth } from "@/hooks/use-client-auth";
import { createClient } from "@/utils/supabase/client";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import CreatorGuidelinesModal from "@/components/dashboard/CreatorGuidelinesModal";
import { ContestCreationModal } from "@/components/ContestCreationModal";
import { useContestCreation } from "@/hooks/use-contest-creation";


function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user, isLoading: isAuthLoading, isAuthenticated } = useClientAuth({
    redirectTo: "/auth/signin",
  });
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<any>(null);
  const [recentContests, setRecentContests] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [userCoins, setUserCoins] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { handleCreateContest } = useContestCreation(user?.id);

  // Handle checkout success - with protection against infinite loops
  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');

    if (success === 'true' && sessionId && user && !hasProcessedSuccess) {
      console.log('🎉 Payment successful in dashboard, refreshing profile data...');
      setHasProcessedSuccess(true);

      // Clear URL parameters to prevent refresh loops
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Refresh profile data after a short delay to allow webhook processing
      const refreshProfileData = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Refetch the profile data to get updated subscription info
          if (user.user_type === "advertiser") {
            const { data: advertiserProfile } = await supabase
              .from("advertiser_profiles")
              .select("*, subscription_info")
              .eq("id", user.id)
              .single();

            if (advertiserProfile) {
              setProfile(advertiserProfile);
              console.log('✅ Profile data refreshed after checkout');
            }
          }
        } catch (error) {
          console.error('Error refreshing profile data:', error);
        }
      };

      refreshProfileData();
    }
  }, [searchParams, user, supabase, hasProcessedSuccess]);

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
          .select("user_type, coins")
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
          const totalViews = submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0;
          const totalSpent = contests?.reduce((sum, contest) => {
            if (contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest?.total_prize) {
              return sum + contest.contest_based_details.leaderboard_contest.total_prize;
            } else if (contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest?.total_budget) {
              return sum + contest.contest_based_details.cpm_contest.total_budget;
            }
            return sum;
          }, 0) || 0;

          // Update profile with calculated values
          const updatedProfile = {
            ...advertiserProfile,
            total_contests_run: totalContests,
            total_money_spent: totalSpent,
            total_views: totalViews
          };

          setProfile(updatedProfile);

          // Get recent contests for display
          const recentContests = contests?.slice(0, 3)?.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
            if (creatorProfile.has_seen_guidelines === false) {
              setShowGuidelines(true);
            }
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
            setRecentContests(contests || []);
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

  // Block dashboard if guidelines not seen
  if (profile && profile.has_seen_guidelines === false) {
    return (
      <>
        <CreatorGuidelinesModal
          open={showGuidelines}
          onComplete={async () => {
            setShowGuidelines(false);
            // Update in DB
            await supabase
              .from("creator_profiles")
              .update({ has_seen_guidelines: true })
              .eq("id", user.id);
            setProfile({ ...profile, has_seen_guidelines: true });
          }}
        />
        {/* Optionally, a blur or overlay can be added here to block interaction */}
      </>
    );
  }

  if (isAuthLoading || isFetchingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading dashboard...</p>
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
    const shouldShowModal = await handleCreateContest();
    if (shouldShowModal) {
      setShowModal(true);
    }
  };

  const isAdvertiser = profile && "company_name" in profile;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        {isAdvertiser && (
          <Button variant="white" onClick={handleCreateContestClick}>
            <Plus className="mr-2 h-4 w-4" /> Create Contest
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdvertiser ? (
          <>
            {/* Total Spent Card - Red/Pink */}
            <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-700/50 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                    <DollarSign className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-800 dark:text-red-300 uppercase tracking-wide">Total Spent</p>
                    <p className="text-lg font-bold text-red-900 dark:text-red-100">
                      {formatCurrencyFromCents(profile?.total_money_spent || 0)}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">Money spent on contests</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Contests Card - Blue */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700/50 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                    <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">Total Contests</p>
                    <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                      {profile?.total_contests_run || 0}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Contests created</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Total Earnings Card - Green */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Total Earnings</p>
                    <p className="text-lg font-bold text-green-900 dark:text-green-100">
                      {formatCurrencyFromCents(profile?.total_money_won || 0)}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Money earned from contests</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contests Won Card - Yellow/Gold */}
            <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-700/50 hover:shadow-lg transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                    <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">Contests Won</p>
                    <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                      {profile?.total_contests_won || 0}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                      Out of {profile?.total_contests_participated || 0} participated
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Total Views Card - Purple */}
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">Total Views</p>
                <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                  {(profile?.total_views || 0).toLocaleString()}
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                  {isAdvertiser
                    ? "Views on contest content"
                    : "Views on your content"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Coins Card - Orange */}
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-700/50 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
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
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-orange-800 dark:text-orange-300 uppercase tracking-wide">Available Coins</p>
                <p className="text-lg font-bold text-orange-900 dark:text-orange-100">{userCoins}</p>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">Coins to redeem or use</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              {isAdvertiser
                ? "Your recent contests"
                : "Contests you've participated in recently"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentContests && recentContests.length > 0 ? (
              <div className="space-y-6">
                {recentContests.map((contest) => (
                  <div
                    key={contest.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="rounded-full bg-primary/10 p-3 flex-shrink-0">
                        <Trophy className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{contest.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {contest.platform} • {" "}
                          {formatLocalDateTime(contest.created_at, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="ml-4 flex-shrink-0" asChild>
                      <Link href={isAdvertiser ? `/dashboard/contests/${contest.id}` : `/dashboard/opportunities/${contest.id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center border rounded">
                <p className="text-sm text-muted-foreground">
                  {isAdvertiser
                    ? "No contests created yet"
                    : "No contest activity yet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Analytics Overview</CardTitle>
            <CardDescription>
              Performance insights for your{" "}
              {isAdvertiser ? "contests" : "content"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-center justify-center border rounded">
              <p className="text-sm text-muted-foreground">
                Detailed analytics available soon
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <ContestCreationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        userId={user?.id || ""}
      />
    </div>
  );
}

export default DashboardPage; // Export directly
