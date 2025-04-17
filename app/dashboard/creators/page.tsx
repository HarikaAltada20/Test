import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Filter, Users } from "lucide-react"
import Link from "next/link"

export default async function CreatorsPage() {
  const supabase = await createSupabaseServerClient()

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

  // Get creator profiles with submissions
  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("*, users(email, profile_pic)")
    .order("contests_won", { ascending: false })
    .limit(20)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Creators</h1>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" /> Filter
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Creators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {creators && creators.length > 0 ? (
              creators.map((creator) => (
                <div key={creator.user_id} className="border rounded-lg p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={(creator.users as any)?.profile_pic || ""} />
                      <AvatarFallback>{creator.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{creator.username}</h3>
                      <p className="text-sm text-muted-foreground">
                        {creator.contests_participated} contests participated
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {creator.linked_platforms &&
                      typeof creator.linked_platforms === "object" &&
                      Object.entries(creator.linked_platforms).map(([platform, _]) => (
                        <Badge key={platform} variant="outline" className="capitalize">
                          {platform}
                        </Badge>
                      ))}
                    {(!creator.linked_platforms ||
                      typeof creator.linked_platforms !== "object" ||
                      Object.keys(creator.linked_platforms).length === 0) && (
                        <Badge variant="outline">No platforms linked</Badge>
                      )}
                  </div>

                  <div className="mt-auto flex justify-between items-center">
                    <div>
                      <span className="text-sm font-medium">{creator.contests_won} wins</span>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/creators/${creator.user_id}`}>View Profile</Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-8">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-muted-foreground">No creators found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

