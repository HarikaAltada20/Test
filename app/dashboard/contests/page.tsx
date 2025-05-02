import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Edit, Plus, Trophy, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DeleteContestButton } from "@/components/delete-contest-button"
import { formatLocalDateTime } from "@/lib/utils"

export default async function ContestsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    console.log("ContestsPage: No session found, redirecting to signin.")
    redirect("/auth/signin")
  }

  // Get user type from the database
  const { data: userData } = await supabase.from("users").select("user_type").eq("id", session.user.id).single()

  // Redirect creators to opportunities
  if (userData?.user_type === "creator") {
    redirect("/dashboard/opportunities")
  }

  // Get all contests for this advertiser
  const { data: contests = [] } = await supabase
    .from("contests_with_status")
    .select("*")
    .eq("advertiser_id", session.user.id)
    .order("created_at", { ascending: false })

  // Separate published and draft contests
  const publishedContests = contests?.filter(contest => !contest.is_draft) || []
  const draftContests = contests?.filter(contest => contest.is_draft) || []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Contests</h1>
        <Button className="bg-rose-600 hover:bg-rose-700" asChild>
          <Link href="/dashboard/contests/create?new=true">
            <Plus className="mr-2 h-4 w-4" /> Create Contest
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="published" className="mb-6">
        <TabsList>
          <TabsTrigger value="published">Published Contests</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({draftContests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="published">
          <Card>
            <CardHeader>
              <CardTitle>Published Contests</CardTitle>
            </CardHeader>
            <CardContent>
              {publishedContests.length > 0 ? (
                <div className="space-y-4">
                  {publishedContests.map((contest) => (
                    <div key={contest.id} className="flex items-center justify-between border-b pb-4">
                      <div className="flex items-center space-x-4">
                        <div className="rounded-full bg-gray-100 p-2">
                          <Trophy className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{contest.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Platform: {contest.platform} | Created: {formatLocalDateTime(contest.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                        <DeleteContestButton
                          contestId={contest.id}
                          contestTitle={contest.title}
                          isLive={contest.status === "live"}
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No published contests yet</p>
                  <Button className="mt-4" asChild>
                    <Link href="/dashboard/contests/create">Create your first contest</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts">
          <Card>
            <CardHeader>
              <CardTitle>Draft Contests</CardTitle>
            </CardHeader>
            <CardContent>
              {draftContests.length > 0 ? (
                <div className="space-y-4">
                  {draftContests.map((contest) => (
                    <div key={contest.id} className="flex items-center justify-between border-b pb-4">
                      <div className="flex items-center space-x-4">
                        <div className="rounded-full bg-gray-100 p-2">
                          <Edit className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{contest.title || "Untitled Contest"}</p>
                          <p className="text-xs text-muted-foreground">
                            Created: {formatLocalDateTime(contest.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-500">Draft</Badge>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/contests/create?draft=${contest.id}`}>Continue</Link>
                        </Button>
                        <DeleteContestButton
                          contestId={contest.id}
                          contestTitle={contest.title || "Untitled Contest"}
                          isLive={false}
                          size="sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No draft contests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

