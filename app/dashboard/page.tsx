import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Trophy, Users, BarChart, DollarSign, Plus, Video } from "lucide-react"
import { formatLocalDateTime } from "@/lib/utils"

// Add this utility function to convert cents to dollars for display
const formatCurrency = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  // Get user role from the database
  const { data: userData } = await supabase.from("users").select("role").eq("id", session.user.id).single()

  const userRole = (userData?.role as "advertiser" | "creator") || "advertiser"

  if (userRole === "advertiser") {
    return <AdvertiserDashboard userId={session.user.id} />
  } else {
    return <CreatorDashboard userId={session.user.id} />
  }
}

async function AdvertiserDashboard({ userId }: { userId: string }) {
  const supabase = createServerSupabaseClient()

  // Get advertiser profile
  const { data: profile } = await supabase.from("advertiser_profiles").select("*").eq("user_id", userId).single()

  // Get contests
  const { data: contests } = await supabase
    .from("contests_with_status")
    .select("*")
    .eq("advertiser_id", userId)
    .order("created_at", { ascending: false })
    .limit(3)

  // Get total submissions
  const { count: submissionsCount } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .in("contest_id", contests?.map((contest) => contest.id) || [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Brand Dashboard</h1>
        <Button className="bg-rose-600 hover:bg-rose-700" asChild>
          <Link href="/dashboard/contests/create">
            <Plus className="mr-2 h-4 w-4" /> Create Contest
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contests</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contests?.filter((c) => c.status === "live").length || 0}</div>
            <p className="text-xs text-muted-foreground">Total: {contests?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Creators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Across all contests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{submissionsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Across all contests</p>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Recent Contests</CardTitle>
            <CardDescription>Your most recent creator contests</CardDescription>
          </CardHeader>
          <CardContent>
            {contests && contests.length > 0 ? (
              <div className="space-y-4">
                {contests.map((contest) => (
                  <div key={contest.id} className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center space-x-4">
                      <div className="rounded-full bg-gray-100 p-2">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{contest.title}</p>
                        <div className="text-xs text-muted-foreground">
                          Created on {formatLocalDateTime(contest.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-sm text-right">
                        <p className="font-medium">Status: {contest.status}</p>
                        <p className="text-xs text-muted-foreground">
                          {contest.status === "live" &&
                            contest.end_date &&
                            `Ends: ${new Date(contest.end_date).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/contests/${contest.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No contests yet</p>
                <Button className="mt-4" asChild>
                  <Link href="/dashboard/contests/create">Create your first contest</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" asChild>
              <Link href="/dashboard/contests/create">
                <Plus className="mr-2 h-4 w-4" /> Create New Contest
              </Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard/contests">View All Contests</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard/analytics">View Analytics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function CreatorDashboard({ userId }: { userId: string }) {
  const supabase = createServerSupabaseClient()

  // Get creator profile
  const { data: profile } = await supabase.from("creator_profiles").select("*").eq("user_id", userId).single()

  // Get submissions
  const { data: submissions } = await supabase
    .from("submissions")
    .select("*, contests(*)")
    .eq("creator_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(5)

  // Get available contests
  const { data: availableContests } = await supabase
    .from("contests_with_status")
    .select("*")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(3)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Creator Dashboard</h1>
        <Button className="bg-rose-600 hover:bg-rose-700" asChild>
          <Link href="/dashboard/opportunities">
            <Plus className="mr-2 h-4 w-4" /> Find Opportunities
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions?.reduce((sum, sub) => sum + (sub.current_views || 0), 0).toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">Across all submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(profile?.prize_money_earned || 0)}
            </div>
            <p className="text-xs text-muted-foreground">From all contests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contests</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableContests?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Available to join</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submissions</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{submissions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total submissions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Recent Submissions</CardTitle>
            <CardDescription>Your recent content submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {submissions && submissions.length > 0 ? (
              <div className="space-y-4">
                {submissions.map((submission) => (
                  <div key={submission.id} className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center space-x-4">
                      <div className="rounded-full bg-gray-100 p-2">
                        <Video className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{submission.contests?.title}</p>
                        <div className="text-xs text-muted-foreground">
                          Submitted on {formatLocalDateTime(submission.submitted_at, { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-sm text-right">
                        <p className="font-medium">{submission.current_views.toLocaleString()} views</p>
                        <p className="text-xs text-muted-foreground">Status: {submission.status}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={submission.content_link} target="_blank" rel="noopener noreferrer">
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No submissions yet</p>
                <Button className="mt-4" asChild>
                  <Link href="/dashboard/opportunities">Find opportunities</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Available Contests</CardTitle>
            <CardDescription>Contests you can join now</CardDescription>
          </CardHeader>
          <CardContent>
            {availableContests && availableContests.length > 0 ? (
              <div className="space-y-4">
                {availableContests.map((contest) => (
                  <div key={contest.id} className="flex flex-col space-y-2 border-b pb-4">
                    <p className="font-medium">{contest.title}</p>
                    <p className="text-xs text-muted-foreground">Platform: {contest.platform}</p>
                    <p className="text-xs text-muted-foreground">
                      Ends: {contest.end_date ? new Date(contest.end_date).toLocaleDateString() : "N/A"}
                    </p>
                    <Button size="sm" className="mt-2" asChild>
                      <Link href={`/dashboard/opportunities/${contest.id}`}>View Details</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No active contests available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

