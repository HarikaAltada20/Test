
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, DollarSign, EyeIcon, TrendingUp, Users } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { createClient } from "@/utils/supabase/server"

// Add the formatCurrency utility function
// Add this utility function to convert cents to dollars for display
const formatCurrency = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  // Verify user authentication with server
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    console.log("AnalyticsPage: User is not authenticated, redirecting to signin, :2")
    redirect("/auth/signin")
  }

  // Get user data from the database
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single()

  if (userError) {
    console.error("Error fetching user data:", userError)
    redirect("/auth/signin")
  }

  // Only allow advertisers to access this page
  if (userData?.user_type !== "advertiser") {
    redirect("/dashboard")
  }

  // Get advertiser profile
  const { data: profile } = await supabase
    .from("advertiser_profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  // Get contests
  const { data: contests } = await supabase
    .from("contests_with_status")
    .select("*")
    .eq("advertiser_id", user.id)
    .order("created_at", { ascending: false })

  // Get submissions
  const { data: submissions } = await supabase
    .from("submissions")
    .select("*, contests!inner(*)")
    .eq("contests.advertiser_id", user.id)

  // Calculate total views
  const totalViews = submissions?.reduce((sum, sub) => sum + (sub.current_views || 0), 0) || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <EyeIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all contests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Creators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(submissions?.map((s) => s.creator_id)).size || 0}</div>
            <p className="text-xs text-muted-foreground">Participating creators</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Engagement Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5.2%</div>
            <p className="text-xs text-muted-foreground">Platform average: 3.1%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(profile?.total_spent || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total budget</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contests">Contests</TabsTrigger>
          <TabsTrigger value="creators">Creators</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>Views and engagement across all contests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center bg-muted rounded-md">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Performance chart would appear here</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Platform Distribution</CardTitle>
                <CardDescription>Content distribution by platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center bg-muted rounded-md">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Platform chart would appear here</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contests">
          <Card>
            <CardHeader>
              <CardTitle>Contest Performance</CardTitle>
              <CardDescription>Performance metrics for all contests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contests && contests.length > 0 ? (
                  contests.map((contest) => {
                    const contestSubmissions = submissions?.filter((s) => s.contest_id === contest.id) || []
                    const contestViews = contestSubmissions.reduce((sum, sub) => sum + (sub.current_views || 0), 0)

                    return (
                      <div key={contest.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium">{contest.title}</h3>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${contest.status === "live"
                              ? "bg-green-100 text-green-800"
                              : contest.status === "upcoming"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {contest.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Submissions</p>
                            <p className="text-lg font-medium">{contestSubmissions.length}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Views</p>
                            <p className="text-lg font-medium">{contestViews.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg. Views</p>
                            <p className="text-lg font-medium">
                              {contestSubmissions.length
                                ? Math.round(contestViews / contestSubmissions.length).toLocaleString()
                                : "0"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No contests yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="creators">
          <Card>
            <CardHeader>
              <CardTitle>Creator Performance</CardTitle>
              <CardDescription>Performance metrics for top creators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center bg-muted rounded-md">
                <BarChart className="h-8 w-8 text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Creator performance chart would appear here</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

