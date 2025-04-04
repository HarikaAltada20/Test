import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, ExternalLink, Info, Trophy, User } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export default async function OpportunityDetailPage({ params }: { params: { id: string } }) {
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

  // Get contest details
  const { data: contest } = await supabase
    .from("contests_with_status")
    .select("*, advertiser_profiles(company_name)")
    .eq("id", params.id)
    .single()

  if (!contest) {
    redirect("/dashboard/opportunities")
  }

  // Check if user has already submitted to this contest
  const { data: existingSubmission } = await supabase
    .from("submissions")
    .select("*")
    .eq("contest_id", params.id)
    .eq("creator_id", session.user.id)
    .single()

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/opportunities">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{contest.title}</h1>
        <Badge
          className={
            contest.status === "live"
              ? "bg-green-500 ml-2"
              : contest.status === "upcoming"
                ? "bg-blue-500 ml-2"
                : "bg-gray-500 ml-2"
          }
        >
          {contest.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Contest Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Brief</h3>
                <p className="text-muted-foreground">{contest.brief || "No brief provided"}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Platform</h3>
                  <p className="capitalize">{contest.platform}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Sponsor</h3>
                  <p>{contest.advertiser_profiles?.company_name || "Unknown"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Start Date</h3>
                  <p>{contest.start_date ? new Date(contest.start_date).toLocaleDateString() : "Not specified"}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">End Date</h3>
                  <p>{contest.end_date ? new Date(contest.end_date).toLocaleDateString() : "Not specified"}</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Prize Structure</h3>
                <div className="space-y-2">
                  {Array.isArray(contest.prizes) &&
                    contest.prizes.map((prize: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <span>Position {prize.position}</span>
                        <span>${(prize.amount / 100).toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Rules & Guidelines</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Content must be original and created specifically for this contest.</li>
                    <li>Content must comply with {contest.platform} community guidelines.</li>
                    <li>All submissions must include the hashtags provided in the brief (if specified).</li>
                    <li>
                      By submitting content, you grant the sponsor the right to use your content for promotional
                      purposes.
                    </li>
                    <li>Winners will be selected based on engagement metrics and quality of content.</li>
                  </ul>
                </div>
              </div>

              {contest.resources && Object.keys(contest.resources).length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Resources</h3>
                  <div className="bg-muted p-4 rounded-lg">
                    <p>The sponsor has provided these resources to help with your submission:</p>
                    <div className="mt-2 space-y-2">
                      {Object.entries(contest.resources).map(([key, value]) => (
                        <div key={key} className="flex items-center">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          <Link href={value as string} className="text-primary hover:underline">
                            {key}
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contest Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-medium">Timeframe</h3>
                  <p className="text-sm text-muted-foreground">
                    {contest.start_date ? new Date(contest.start_date).toLocaleDateString() : "Not set"} -{" "}
                    {contest.end_date ? new Date(contest.end_date).toLocaleDateString() : "Not set"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-medium">Total Prize Pool</h3>
                  <p className="text-sm text-muted-foreground">
                    $
                    {Array.isArray(contest.prizes)
                      ? (
                          contest.prizes.reduce((sum: number, prize: any) => sum + (prize.amount || 0), 0) / 100
                        ).toFixed(2)
                      : "0.00"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-medium">Sponsor</h3>
                  <p className="text-sm text-muted-foreground">
                    {contest.advertiser_profiles?.company_name || "Unknown"}
                  </p>
                </div>
              </div>

              <Separator />

              {existingSubmission ? (
                <div>
                  <div className="bg-muted p-4 rounded-lg text-center mb-4">
                    <Info className="h-5 w-5 mx-auto mb-2" />
                    <p className="text-sm font-medium">You've already submitted to this contest</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      You submitted on {new Date(existingSubmission.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button className="w-full" asChild>
                    <Link href={`/dashboard/content/${existingSubmission.id}`}>View My Submission</Link>
                  </Button>
                </div>
              ) : contest.status === "live" ? (
                <Button className="w-full" asChild>
                  <Link href={`/dashboard/opportunities/${params.id}/submit`}>Submit Content</Link>
                </Button>
              ) : contest.status === "upcoming" ? (
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-sm font-medium">This contest is not yet active</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Come back on{" "}
                    {contest.start_date ? new Date(contest.start_date).toLocaleDateString() : "the start date"}
                  </p>
                </div>
              ) : (
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-sm font-medium">This contest has ended</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ended on {contest.end_date ? new Date(contest.end_date).toLocaleDateString() : "the end date"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

