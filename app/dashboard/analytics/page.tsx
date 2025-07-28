import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, DollarSign, EyeIcon, TrendingUp, Users } from "lucide-react"
import { EnhancedTabs as Tabs, EnhancedTabsList as TabsList, EnhancedTabsTrigger as TabsTrigger, EnhancedTabsContent as TabsContent } from "@/components/ui/enhanced-tabs"
import { formatCurrencyFromCents } from "@/lib/currency-utils"



export default async function AnalyticsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/signin")
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single()

  if (userError) {
    console.error("Error fetching user data:", userError)
    redirect("/dashboard?error=user_fetch_failed")
  }

  // Only allow advertisers to access this page
  if (userData?.user_type !== "advertiser") {
    console.warn(`User ${user.id} with type ${userData?.user_type} attempted to access analytics page.`)
    redirect("/dashboard")
  }

  // Fetch analytics data
  const { data: contests } = await supabase
    .from("contests")
    .select("*")
    .eq("advertiser_id", user.id)

  const { data: submissions } = await supabase
    .from("submissions")
    .select("*, contests!inner(*)")
    .eq("contests.advertiser_id", user.id)

  // Calculate analytics
  const totalContests = contests?.length || 0
  const totalSubmissions = submissions?.length || 0
  const totalViews = submissions?.reduce((sum, sub) => sum + (sub.views || 0), 0) || 0
  const totalSpent = contests?.reduce((sum, contest) => {
    if (contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest?.total_prize) {
      return sum + contest.contest_based_details.leaderboard_contest.total_prize
    } else if (contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest?.total_budget) {
      return sum + contest.contest_based_details.cpm_contest.total_budget
    }
    return sum
  }, 0) || 0

  return (
    <RouteGuard allowedUserTypes={['advertiser']} fallbackPath="/dashboard/opportunities">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>

        {/* Analytics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contests</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalContests}</div>
              <p className="text-xs text-muted-foreground">Contests created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSubmissions}</div>
              <p className="text-xs text-muted-foreground">Creator submissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <EyeIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Across all submissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyFromCents(totalSpent)}</div>
              <p className="text-xs text-muted-foreground">Contest budgets</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contests">Contests</TabsTrigger>
            <TabsTrigger value="creators">Creators</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>Your contest performance overview</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Detailed analytics coming soon. Track your contest performance, creator engagement, and ROI.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contest Performance</CardTitle>
                <CardDescription>Individual contest analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Contest-specific analytics coming soon. View submissions, views, and engagement per contest.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="creators" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Creator Insights</CardTitle>
                <CardDescription>Creator performance and demographics</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Creator analytics coming soon. Understand your creator audience and top performers.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RouteGuard>
  )
}

