"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { createClientSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SubmitContentPage({ params }: { params: { id: string } }) {
  const [contentLink, setContentLink] = useState("")
  const [views, setViews] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClientSupabaseClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!user) {
      setError("You must be logged in to submit content")
      setIsLoading(false)
      return
    }

    // Validate content link
    if (!contentLink) {
      setError("Please enter a content link")
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          contest_id: params.id,
          creator_id: user.id,
          content_link: contentLink,
          current_views: views,
          status: "pending",
        })
        .select()

      if (error) throw error

      router.push("/dashboard/content")
    } catch (err: any) {
      setError(err.message || "Failed to submit content")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/opportunities/${params.id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Submit Content</h1>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Content Submission</CardTitle>
          <CardDescription>
            Submit your content for this contest. Make sure your content follows the contest guidelines.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="content-link">Content Link</Label>
              <Input
                id="content-link"
                value={contentLink}
                onChange={(e) => setContentLink(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
              <p className="text-xs text-muted-foreground">Enter the direct link to your content on the platform</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="views">Current Views (Optional)</Label>
              <Input
                id="views"
                type="number"
                value={views.toString()}
                onChange={(e) => setViews(Number.parseInt(e.target.value) || 0)}
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Enter the current number of views if your content is already published
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Submitting..." : "Submit Content"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

