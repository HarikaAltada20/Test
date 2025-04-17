import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Filter, Video } from "lucide-react"

export default async function CreatorContentPage() {
  const supabase = await createSupabaseServerClient()

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

  // Get submissions for this creator
  const { data: submissions } = await supabase
    .from("submissions")
    .select("*, contests(title, platform)")
    .eq("creator_id", session.user.id)
    .order("submitted_at", { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Content</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" /> Filter
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/opportunities">Find Opportunities</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Submissions</CardTitle>
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
                      <p className="text-xs text-muted-foreground">
                        Submitted on {new Date(submission.submitted_at).toLocaleDateString()} |{" "}
                        {submission.contests?.platform}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-right">
                      <p className="font-medium">{submission.current_views.toLocaleString()} views</p>
                      <Badge
                        className={
                          submission.status === "approved"
                            ? "bg-green-500"
                            : submission.status === "pending"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }
                      >
                        {submission.status}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={submission.content_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" /> View
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/content/${submission.id}`}>Details</Link>
                      </Button>
                    </div>
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
    </div>
  )
}

