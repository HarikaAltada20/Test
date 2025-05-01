"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, DollarSign, Filter, Trophy } from "lucide-react"
import { User } from "@supabase/supabase-js"
import { createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { formatMoney } from "@/lib/utils"

export default function OpportunitiesPage() {
  const [availableContests, setAvailableContests] = useState<any[]>([])
  const [isFetchingData, setIsFetchingData] = useState(true)
  const { user, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (isAuthLoading) {
      setIsFetchingData(true)
      return
    }

    if (!user) {
      console.log("OpportunitiesPage: No user found after auth load, redirecting to signin.")
      router.push("/")
      return
    }

    async function fetchData(currentUser: User) {
      setIsFetchingData(true)

      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", currentUser.id)
          .single()

        if (userError) {
          console.error("Error fetching user type:", userError)
          setIsFetchingData(false)
          setAvailableContests([])
          return
        }

        if (userData?.user_type === "advertiser") {
          console.log("OpportunitiesPage: Advertiser detected, redirecting to contests.")
          router.push("/dashboard/contests")
          return
        }

        const { data: contests, error: contestError } = await supabase
          .from("contests_with_status")
          .select("*")
          .not('status', 'eq', 'draft')
          .not('status', 'eq', 'incomplete')
          .order("created_at", { ascending: false })

        if (contestError) {
          console.error("Error fetching contests:", contestError)
          setAvailableContests([])
        } else {
          setAvailableContests(contests || [])
        }
      } catch (error) {
        console.error("Unexpected error in fetchData:", error)
        setAvailableContests([])
      } finally {
        setIsFetchingData(false)
      }
    }

    fetchData(user)
  }, [user, isAuthLoading, router, supabase])

  const handleViewDetails = (id: string) => {
    router.push(`/dashboard/opportunities/${id}`)
  }

  if (isAuthLoading || isFetchingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p>Loading opportunities...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You need to be logged in to view opportunities.</p>
      </div>
    )
  }

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
                      Prize Pool: {formatMoney(contest.total_prize || 0)}
                    </span>
                  </div>
                  <div className="pt-2">
                    <Button className="w-full" onClick={() => handleViewDetails(contest.id)}>
                      View Details
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

