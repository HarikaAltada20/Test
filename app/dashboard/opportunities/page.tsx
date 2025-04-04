import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Calendar, DollarSign, Filter, Trophy } from "lucide-react"

export default async function OpportunitiesPage() {
  const supabase = createServerSupabaseClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  // Get user role from the database
  const { data: userData } = await supabase.from("users").select("role").eq("id", session.user.id).single()

  if (userData?.role !== "creator") {
    redirect("/dashboard")
  }

  // Get available contests
  const { data: availableContests } = await supabase
    .from("contests_with_status")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Opportunities</h1>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" /> Filter
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {availableContests && availableContests.length > 0 ? (
          availableContests.map((contest) => (
            <Card key={contest.id} className="overflow-hidden">
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                {contest.thumbnail_url ? (
                  <img
                    src={contest.thumbnail_url || "/placeholder.svg"}
                    alt={contest.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Trophy className="h-12 w-12 text-gray-400" />
                )}
              </div>
              <CardHeader className="p-4 pb-0">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{contest.title}</CardTitle>
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
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>
                      {contest.end_date ? `Ends ${new Date(contest.end_date).toLocaleDateString()}` : "No end date"}
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <DollarSign className="h-4 w-4 mr-2" />
                    <span>
                      Prize Pool: $
                      {Array.isArray(contest.prizes)
                        ? (
                            contest.prizes.reduce((sum: number, prize: any) => sum + (prize.amount || 0), 0) / 100
                          ).toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                  <div className="pt-2">
                    <Button className="w-full" asChild>
                      <Link href={`/dashboard/opportunities/${contest.id}`}>View Details</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-medium mb-2">No contests available</h2>
            <p className="text-muted-foreground mb-4">Check back later for new opportunities</p>
          </div>
        )}
      </div>
    </div>
  )
}

