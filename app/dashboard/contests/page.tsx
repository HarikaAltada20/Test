import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default async function ContestsPage() {
  const supabase = createServerSupabaseClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  // Get user role from the database
  const { data: userData } = await supabase.from("users").select("role").eq("id", session.user.id).single()

  if (userData?.role !== "advertiser") {
    redirect("/dashboard")
  }

  // Get all contests for this advertiser
  const { data: contests } = await supabase
    .from("contests_with_status")
    .select("*")
    .eq("advertiser_id", session.user.id)
    .order("created_at", { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Contests</h1>
        <Button className="bg-rose-600 hover:bg-rose-700" asChild>
          <Link href="/dashboard/contests/create">
            <Plus className="mr-2 h-4 w-4" /> Create Contest
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Contests</CardTitle>
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
                      <p className="text-xs text-muted-foreground">
                        Platform: {contest.platform} | Created: {new Date(contest.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge
                      className={
                        contest.status === "live"
                          ? "bg-green-500"
                          : contest.status === "upcoming"
                            ? "bg-blue-500"
                            : "bg-gray-500"
                      }
                    >
                      {contest.status}
                    </Badge>
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
    </div>
  )
}

