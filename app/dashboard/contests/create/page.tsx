"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClientSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, ArrowRight, Check, Image, Info, Trash, Trophy, Upload } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type Step = "basics" | "brief" | "resources" | "prize"

export default function CreateContestPage() {
  const [step, setStep] = useState<Step>("basics")
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<string>("technology")
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [brief, setBrief] = useState("")
  const [rules, setRules] = useState(`Content must be in English
Content must be similar in style to the inspiration content from the brief
If you have earnings on Posted, please show your total earnings as well
You must include a call to action encouraging viewers to download the Posted App to get Paid
You must show the Posted App Store listing in your video`)
  const [resources, setResources] = useState<Record<string, string>>({})
  const [newResourceName, setNewResourceName] = useState("")
  const [newResourceUrl, setNewResourceUrl] = useState("")
  const [inspirationLinks, setInspirationLinks] = useState<string[]>([
    "https://www.tiktok.com/@creator1/video/123456789",
    "https://www.tiktok.com/@creator2/video/987654321"
  ])
  const [newInspirationLink, setNewInspirationLink] = useState("")
  const [priceTier, setPriceTier] = useState<"bronze" | "silver" | "gold" | "diamond">("bronze")
  const [winnerCount, setWinnerCount] = useState<number>(3)
  const [winnerAmounts, setWinnerAmounts] = useState<number[]>([500, 200, 100])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClientSupabaseClient()

  const PRICE_TIERS = {
    bronze: { amount: 1500, description: "Expect posts from smaller creators" },
    silver: { amount: 3000, description: "Expect some posts from larger creators", popular: true },
    gold: { amount: 5000, description: "Expect posts from large creators" },
    diamond: { amount: 0, description: "A fully managed contest by the Posted team" }
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setThumbnail(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          setThumbnailPreview(e.target.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const removeThumbnail = () => {
    setThumbnail(null)
    setThumbnailPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setIsLoading(true)

    if (!user) {
      setError("You must be logged in to create a contest")
      setIsLoading(false)
      return
    }

    try {
      // Calculate total prize amount
      let totalPrize = 0
      for (let i = 0; i < winnerCount; i++) {
        totalPrize += winnerAmounts[i] || 0
      }

      // Format prizes array
      const prizesArray = []
      for (let i = 0; i < winnerCount; i++) {
        prizesArray.push({
          position: i + 1,
          amount: (winnerAmounts[i] || 0) * 100 // convert to cents
        })
      }

      // Upload thumbnail if present
      let thumbnailUrl = null
      if (thumbnail) {
        try {
          const fileName = `contest_thumbnails/${user.id}_${Date.now()}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('contest_assets')
            .upload(fileName, thumbnail)

          if (uploadError) {
            if (uploadError.message.includes("Bucket not found")) {
              setError("Unable to upload thumbnail: Storage not configured. Please contact support.")
              setIsLoading(false)
              return
            }
            throw new Error(`Failed to upload thumbnail: ${uploadError.message}`)
          }

          const { data: publicUrlData } = supabase.storage
            .from('contest_assets')
            .getPublicUrl(fileName)

          thumbnailUrl = publicUrlData.publicUrl
        } catch (error: any) {
          setError(`Thumbnail upload failed: ${error.message}`)
          setIsLoading(false)
          return
        }
      }

      // Create contest
      const { data, error } = await supabase
        .from("contests")
        .insert({
          advertiser_id: user.id,
          title,
          category,
          thumbnail_url: thumbnailUrl,
          platform: "tiktok", // Default to TikTok based on the screenshots
          brief,
          prizes: prizesArray,
          total_prize: totalPrize * 100, // convert to cents
          rules: { list: rules.split("\n") },
          resources,
          inspiration_links: inspirationLinks,
          price_tier: priceTier,
          winner_count: winnerCount
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

  const addResource = () => {
    if (newResourceName && newResourceUrl) {
      setResources({
        ...resources,
        [newResourceName]: newResourceUrl,
      })
      setNewResourceName("")
      setNewResourceUrl("")
    }
  }

  const removeResource = (name: string) => {
    const newResources = { ...resources }
    delete newResources[name]
    setResources(newResources)
  }

  const addInspirationLink = () => {
    if (newInspirationLink && !inspirationLinks.includes(newInspirationLink)) {
      setInspirationLinks([...inspirationLinks, newInspirationLink])
      setNewInspirationLink("")
    }
  }

  const removeInspirationLink = (link: string) => {
    setInspirationLinks(inspirationLinks.filter(l => l !== link))
  }

  const updateWinnerAmount = (index: number, amount: number) => {
    const newAmounts = [...winnerAmounts]
    newAmounts[index] = amount
    setWinnerAmounts(newAmounts)
  }

  const handleWinnerCountChange = (count: number) => {
    setWinnerCount(count)

    // Add more entries if needed
    if (count > winnerAmounts.length) {
      const newAmounts = [...winnerAmounts]
      for (let i = winnerAmounts.length; i < count; i++) {
        newAmounts.push(100) // Default amount for additional winners
      }
      setWinnerAmounts(newAmounts)
    }
  }

  const nextStep = () => {
    if (step === "basics") setStep("brief")
    else if (step === "brief") setStep("resources")
    else if (step === "resources") setStep("prize")
  }

  const prevStep = () => {
    if (step === "prize") setStep("resources")
    else if (step === "resources") setStep("brief")
    else if (step === "brief") setStep("basics")
  }

  const isNextDisabled = () => {
    if (step === "basics") return !title || !category
    return false
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/contests">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Create New Contest</h1>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex justify-center">
          <div className="relative flex w-full max-w-3xl justify-between">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-gray-200"></div>

            <div className={`relative z-10 flex flex-col items-center gap-1`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full 
                ${step === "basics" ? "bg-rose-600 text-white" : "bg-rose-600 text-white"}`}>
                <span className="text-sm font-medium">1</span>
              </div>
              <span className="text-sm font-medium">Get Started</span>
            </div>

            <div className={`relative z-10 flex flex-col items-center gap-1`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full 
                ${step === "brief" || step === "resources" || step === "prize" ? "bg-rose-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                <span className="text-sm font-medium">2</span>
              </div>
              <span className="text-sm font-medium">Create Brief</span>
            </div>

            <div className={`relative z-10 flex flex-col items-center gap-1`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full 
                ${step === "resources" || step === "prize" ? "bg-rose-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                <span className="text-sm font-medium">3</span>
              </div>
              <span className="text-sm font-medium">Resources</span>
            </div>

            <div className={`relative z-10 flex flex-col items-center gap-1`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full 
                ${step === "prize" ? "bg-rose-600 text-white" : "bg-gray-300 text-gray-700"}`}>
                <span className="text-sm font-medium">4</span>
              </div>
              <span className="text-sm font-medium">Prize</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <Card className="mx-auto max-w-4xl">
        {step === "basics" && (
          <>
            <CardHeader>
              <CardTitle>Create a new contest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Add contest title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Posted! Get Paid to Create"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={(value) => setCategory(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crypto-financial">Crypto/Financial</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="dating">Dating</SelectItem>
                      <SelectItem value="food-drink">Food & Drink</SelectItem>
                      <SelectItem value="games-toys">Games & Toys</SelectItem>
                      <SelectItem value="health-wellness">Health & Wellness</SelectItem>
                      <SelectItem value="home-living">Home & Living</SelectItem>
                      <SelectItem value="pets-animals">Pets & Animals</SelectItem>
                      <SelectItem value="sports-outdoors">Sports & Outdoors</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  {thumbnailPreview ? (
                    <div className="relative">
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="mx-auto max-h-64 object-contain"
                      />
                      <div className="mt-2 flex justify-between items-center">
                        <p className="text-sm text-gray-500">
                          {thumbnail?.name} · {(thumbnail?.size ? (thumbnail.size / (1024 * 1024)).toFixed(2) : '0')}MB
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={removeThumbnail}
                          className="text-red-500"
                        >
                          <Trash className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Image className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm font-medium mb-1">Drag, drop or browse thumbnail</p>
                      <p className="text-xs text-gray-500 mb-4">Max file size: 5MB</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" /> Upload
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleThumbnailChange}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </>
        )}

        {step === "brief" && (
          <>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="border rounded p-4">
                  <div className="flex mb-2 border-b pb-2">
                    <button className="p-2 hover:bg-gray-100 rounded">
                      <span className="font-semibold">Paragraph</span>
                    </button>
                    <div className="flex border-l mx-2"></div>
                    <button className="p-2 hover:bg-gray-100 rounded font-bold">B</button>
                    <button className="p-2 hover:bg-gray-100 rounded italic">I</button>
                    <button className="p-2 hover:bg-gray-100 rounded underline">U</button>
                    <button className="p-2 hover:bg-gray-100 rounded line-through">S</button>
                    <div className="flex border-l mx-2"></div>
                    {/* Add more rich text buttons here */}
                  </div>
                  <Textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Posted is the app that pays creators! We help creators connect with brands & get paid to create content!"
                    rows={8}
                    className="border-none resize-none focus-visible:ring-0 p-0"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Inspiration Content:</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {inspirationLinks.map((link, index) => (
                    <li key={index} className="flex items-center justify-between">
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">
                        {link}
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeInspirationLink(link)}
                        className="text-red-500 h-6 w-6 p-0"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add TikTok inspiration link"
                    value={newInspirationLink}
                    onChange={(e) => setNewInspirationLink(e.target.value)}
                  />
                  <Button onClick={addInspirationLink} disabled={!newInspirationLink}>Add</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Set rules</h3>
                <Textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  rows={8}
                  placeholder="Content rules and guidelines"
                />
              </div>
            </CardContent>
          </>
        )}

        {step === "resources" && (
          <>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <div className="text-center">
                    <Image className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm font-medium mb-1">Drag, drop or browse file</p>
                    <p className="text-xs text-gray-500 mb-4">Max file size: 20MB</p>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      <Upload className="h-4 w-4 mr-2" /> Upload
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-center my-4">
                <p>Or</p>
              </div>

              <Input
                placeholder="Paste external folder link"
              />

              <div className="space-y-2">
                <Textarea
                  placeholder="Add description here*"
                  rows={6}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Inspiration Content:</h3>
                {inspirationLinks.map((link, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          This creator went viral in our niche by showing how much money they have made through tiktok! Use this as inspiration!
                        </p>
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-rose-600">
                          {link}
                        </a>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeInspirationLink(link)}
                        className="text-red-500 h-8 w-8 p-0"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </>
        )}

        {step === "prize" && (
          <>
            <CardHeader>
              <CardTitle>Total Prize</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={priceTier} onValueChange={(value) => setPriceTier(value as any)}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className={`relative border rounded-lg p-4 ${priceTier === 'bronze' ? 'border-rose-500 ring-2 ring-rose-200' : ''}`}>
                    <RadioGroupItem value="bronze" id="tier-bronze" className="absolute right-2 top-2" />
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-2 bg-orange-500 rounded-full"></div>
                      <h3 className="font-medium">Bronze Tier</h3>
                      <p className="text-xl font-bold">$1500</p>
                      <p className="text-xs text-gray-500">
                        Expect posts from smaller creators
                      </p>
                    </div>
                  </div>

                  <div className={`relative border rounded-lg p-4 ${priceTier === 'silver' ? 'border-rose-500 ring-2 ring-rose-200' : ''}`}>
                    {PRICE_TIERS.silver.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">
                        Most Popular
                      </div>
                    )}
                    <RadioGroupItem value="silver" id="tier-silver" className="absolute right-2 top-2" />
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-2 bg-gray-300 rounded-full"></div>
                      <h3 className="font-medium">Silver Tier</h3>
                      <p className="text-xl font-bold">$3000</p>
                      <p className="text-xs text-gray-500">
                        Expect some posts from larger creators
                      </p>
                    </div>
                  </div>

                  <div className={`relative border rounded-lg p-4 ${priceTier === 'gold' ? 'border-rose-500 ring-2 ring-rose-200' : ''}`}>
                    <RadioGroupItem value="gold" id="tier-gold" className="absolute right-2 top-2" />
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-2 bg-yellow-400 rounded-full"></div>
                      <h3 className="font-medium">Gold Tier</h3>
                      <p className="text-xl font-bold">$5000</p>
                      <p className="text-xs text-gray-500">
                        Expect posts from large creators
                      </p>
                    </div>
                  </div>

                  <div className={`relative border rounded-lg p-4 ${priceTier === 'diamond' ? 'border-rose-500 ring-2 ring-rose-200' : ''}`}>
                    <RadioGroupItem value="diamond" id="tier-diamond" className="absolute right-2 top-2" />
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-2 bg-blue-300 rounded-full"></div>
                      <h3 className="font-medium">Diamond Tier</h3>
                      <p className="text-xl font-bold">Contact Us</p>
                      <p className="text-xs text-gray-500">
                        A fully managed contest by the Posted team
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Prize distribution</h3>

                <div className="flex items-center gap-4">
                  <Label className="w-48">Number of Winners <span className="text-xs text-gray-500">(Required)</span></Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleWinnerCountChange(Math.max(1, winnerCount - 1))}
                      disabled={winnerCount <= 1}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{winnerCount}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleWinnerCountChange(Math.min(10, winnerCount + 1))}
                      disabled={winnerCount >= 10}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {Array.from({ length: Math.min(winnerCount, 10) }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Label className="w-48">Winner {i + 1}</Label>
                    <Input
                      type="number"
                      value={winnerAmounts[i] || 0}
                      onChange={(e) => updateWinnerAmount(i, parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-48"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </>
        )}

        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={step === "basics" || isLoading}
          >
            Back
          </Button>

          {step === "prize" ? (
            <div className="flex gap-2">
              <Button variant="outline" type="button">
                Save draft
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={isLoading} className="bg-rose-600 hover:bg-rose-700 text-white">
                {isLoading ? "Creating Contest..." : "Finish"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={nextStep}
              disabled={isNextDisabled() || isLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Next
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

