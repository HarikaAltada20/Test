"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClientSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function CreateContestPage() {
  const [title, setTitle] = useState("")
  const [platform, setPlatform] = useState<"youtube" | "instagram">("youtube")
  const [brief, setBrief] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [prizes, setPrizes] = useState<{ position: number; amount: number }[]>([
    { position: 1, amount: 10000 },
    { position: 2, amount: 5000 },
    { position: 3, amount: 2500 },
  ])
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
      setError("You must be logged in to create a contest")
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from("contests")
        .insert({
          advertiser_id: user.id,
          title,
          platform,
          brief,
          start_date: startDate || new Date().toISOString(),
          end_date: endDate || null,
          prizes,
          rules: {},
          resources: {},
        })
        .select()

      if (error) throw error

      router.push("/dashboard/contests")
    } catch (err: any) {
      setError(err.message || "Failed to create contest")
    } finally {
      setIsLoading(false)
    }
  }

  const updatePrize = (index: number, amount: number) => {
    const newPrizes = [...prizes]
    newPrizes[index].amount = isNaN(amount) ? 0 : amount
    setPrizes(newPrizes)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Create New Contest</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contest Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Contest Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a name for your contest"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={(value) => setPlatform(value as "youtube" | "instagram")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief">Contest Brief</Label>
              <Textarea
                id="brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Describe what you're looking for in this contest"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4">
              <Label>Prize Structure</Label>
              {prizes.map((prize, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-24">
                    <Label htmlFor={`position-${index}`}>Position {prize.position}</Label>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="mr-2">$</span>
                      <Input
                        id={`prize-${index}`}
                        type="number"
                        value={(prize.amount / 100).toString()}
                        onChange={(e) => {
                          const value = e.target.value === "" ? 0 : Number.parseFloat(e.target.value)
                          updatePrize(index, isNaN(value) ? 0 : Math.round(value * 100))
                        }}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Contest..." : "Create Contest"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

