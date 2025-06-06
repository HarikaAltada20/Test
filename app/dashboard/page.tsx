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
import { useRouter } from "next/navigation";
import { useClientAuth } from "@/hooks/use-client-auth";
import { createClient } from "@/utils/supabase/client";
import { formatCurrency } from "@/lib/currency-utils";


function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [recentContests, setRecentContests] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [userCoins, setUserCoins] = useState(0);
  const {
    user,
    isLoading: isAuthLoading,
    isAuthenticated,
  } = useClientAuth({
    redirectTo: "/auth/signin",
  });
  const router = useRouter();
  const supabase = createClient();

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
              .select("*, subscription_plan")
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

  const isAdvertiser = profile && "company_name" in profile;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        {isAdvertiser && (
          <Button className="bg-rose-600 hover:bg-rose-700" asChild>
            <Link href="/dashboard/contests/create">
              <Plus className="mr-2 h-4 w-4" /> Create Contest
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdvertiser ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Spent
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(profile?.total_money_spent || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total money spent on contests
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Contests
                </CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {profile?.total_contests_run || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Contests created
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Earnings
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(profile?.total_money_won || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total money earned from contests
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Contests Won
                </CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {profile?.total_contests_won || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Out of {profile?.total_contests_participated || 0}{" "}
                  participated
                </p>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(profile?.total_views || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {isAdvertiser
                ? "Views on your contest content"
                : "Views on your content"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Available Coins
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-muted-foreground"
            >
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l2 2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCoins}</div>
            <p className="text-xs text-muted-foreground">
              Coins to redeem or use
            </p>
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
              <div className="space-y-4">
                {recentContests.map((contest) => (
                  <div
                    key={contest.id}
                    className="flex items-center justify-between border-b pb-4"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="rounded-full bg-gray-100 p-2">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{contest.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {contest.platform} |{" "}
                          {formatLocalDateTime(contest.created_at, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/contests/${contest.id}`}>
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
    </div>
  );
}

export default DashboardPage; // Export directly
