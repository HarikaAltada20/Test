"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Trophy, DollarSign, Plus, Video, Coins } from "lucide-react"
import { formatLocalDateTime, formatMoney } from "@/lib/utils"
import { withUsernameCheck } from "@/components/with-username-check"
import { createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

// Wrap component with username check
export default withUsernameCheck(DashboardPage)

// Client component version
function DashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [recentContests, setRecentContests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userCoins, setUserCoins] = useState(0)
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Check session directly with Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Error checking session:", sessionError);
        return;
      }

      // If no session, redirect to signin
      if (!session) {
        if (isMounted) {
          router.push("/auth/signin");
        }
        return;
      }

      try {
        if (isMounted) {
          setIsLoading(true);
        }

        // Get user type
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type, coins")
          .eq("id", session.user.id)
          .single()

        if (userError) {
          console.error("Error fetching user data:", userError);
          return;
        }

        if (!isMounted) return;

        const userType = userData?.user_type
        setUserCoins(userData?.coins || 0)

        if (userType === "advertiser") {
          // For advertisers, fetch their profile and active subscription
          const { data: advertiserProfile, error: profileError } = await supabase
            .from("advertiser_profiles")
            .select("*, subscription_plan")
            .eq("id", session.user.id)
            .single()

          if (profileError) {
            console.error("Error fetching advertiser profile:", profileError);
            return;
          }

          if (!isMounted) return;
          setProfile(advertiserProfile)

          // Fetch recent contests for advertisers
          const { data: contests, error: contestsError } = await supabase
            .from("contests_with_status")
            .select("*")
            .eq("advertiser_id", session.user.id)
            .order("created_at", { ascending: false })
            .limit(3)

          if (contestsError) {
            console.error("Error fetching contests:", contestsError);
            return;
          }

          if (!isMounted) return;
          setRecentContests(contests || [])
        } else if (userType === "creator") {
          const { data: creatorProfile, error: profileError } = await supabase
            .from("creator_profiles")
            .select("*")
            .eq("id", session.user.id)
            .single()

          if (profileError) {
            console.error("Error fetching creator profile:", profileError);
            return;
          }

          if (!isMounted) return;
          setProfile(creatorProfile)

          // For creators, fetch contests they've participated in
          const { data: submissions, error: submissionsError } = await supabase
            .from("submissions")
            .select("*, contests(*)")
            .eq("creator_id", session.user.id)
            .order("created_at", { ascending: false })
            .limit(3)

          if (submissionsError) {
            console.error("Error fetching submissions:", submissionsError);
            return;
          }

          if (!isMounted) return;
          if (submissions) {
            // Extract contests from submissions
            const contests = submissions.map(sub => sub.contests)
            setRecentContests(contests || [])
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false;
    }
  }, [user, supabase, router, authLoading])

  // Show nothing while auth is loading
  if (authLoading) {
    return null;
  }

  // Show loading state only when fetching data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading dashboard...</p>
      </div>
    )
  }

  // Check if user is advertiser or creator based on profile
  const isAdvertiser = profile && "company_name" in profile

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
          // Advertiser stats
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(profile?.total_money_spent || 0)}</div>
                <p className="text-xs text-muted-foreground">Total money spent on contests</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Contests</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profile?.total_contests_run || 0}</div>
                <p className="text-xs text-muted-foreground">Contests created</p>
              </CardContent>
            </Card>
          </>
        ) : (
          // Creator stats
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(profile?.total_money_won || 0)}</div>
                <p className="text-xs text-muted-foreground">Total money earned from contests</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contests Won</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profile?.total_contests_won || 0}</div>
                <p className="text-xs text-muted-foreground">Out of {profile?.total_contests_participated || 0} participated</p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Common stats for both roles */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.total_views || 0}</div>
            <p className="text-xs text-muted-foreground">
              {isAdvertiser ? "Views on your contest content" : "Views on your content"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Coins</CardTitle>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l2 2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCoins}</div>
            <p className="text-xs text-muted-foreground">Coins to redeem or use</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              {isAdvertiser ? "Your recent contests" : "Contests you've participated in recently"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentContests && recentContests.length > 0 ? (
              <div className="space-y-4">
                {recentContests.map((contest) => (
                  <div key={contest.id} className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center space-x-4">
                      <div className="rounded-full bg-gray-100 p-2">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{contest.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {contest.platform} | {formatLocalDateTime(contest.created_at, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/contests/${contest.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center border rounded">
                <p className="text-sm text-muted-foreground">
                  {isAdvertiser ? "No contests created yet" : "No contest activity yet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Analytics Overview</CardTitle>
            <CardDescription>
              Performance insights for your {isAdvertiser ? "contests" : "content"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-center justify-center border rounded">
              <p className="text-sm text-muted-foreground">Detailed analytics available soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

