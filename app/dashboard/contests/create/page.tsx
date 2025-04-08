"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
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
import { subscriptionPlans, MAX_CONTEST_BUDGET } from "@/constants/subscriptionPlans"

// Define types for subscription plan features
type PlanFeatures = {
  maxActiveContests: number;
  minContestBudget: number;
  maxWinnersPerContest: number;
  accessToCreators: boolean;
  contestBranding: string;
  analytics: boolean;
  support: string;
}

// Define type for subscription plan
type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  features: PlanFeatures;
}

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
If you have earnings on Go Viral, please show your total earnings as well
You must include a call to action encouraging viewers to download the Go Viral App to get Paid
You must show the Go Viral App Store listing in your video`)
  const [resources, setResources] = useState<Record<string, string>>({})
  const [newResourceUrl, setNewResourceUrl] = useState("")
  const [resourceFile, setResourceFile] = useState<File | null>(null)
  const [resourceFilePreview, setResourceFilePreview] = useState<string | null>(null)
  const [resourceDescription, setResourceDescription] = useState("")
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null)
  const [inspirationLinks, setInspirationLinks] = useState<string[]>([
    "https://www.tiktok.com/@creator1/video/123456789",
    "https://www.tiktok.com/@creator2/video/987654321"
  ])
  const [newInspirationLink, setNewInspirationLink] = useState("")
  const [priceTier, setPriceTier] = useState<"bronze" | "silver" | "gold" | "diamond">("bronze")
  const [winnerCount, setWinnerCount] = useState<number>(3)
  const [winnerAmounts, setWinnerAmounts] = useState<number[]>([500, 300, 200])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resourceFileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClientSupabaseClient()
  const [userPlan, setUserPlan] = useState<string | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [totalPrizePool, setTotalPrizePool] = useState<number>(1000) // Default total prize pool
  const [hasExceededBudgetThreshold, setHasExceededBudgetThreshold] = useState<boolean>(false)

  // New state for contest duration
  const [startDate, setStartDate] = useState<string>("")
  const [startTime, setStartTime] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [endTime, setEndTime] = useState<string>("")
  const [showHighBudgetPrompt, setShowHighBudgetPrompt] = useState(false)

  // Constants
  const MIN_PRIZE_PER_WINNER = 5 // Minimum prize amount per winner in dollars
  const DEFAULT_PRIZE_ALLOCATIONS = {
    1: 500,
    2: 300,
    3: 200,
    4: 100,
    5: 50
  }

  // High budget threshold
  const HIGH_BUDGET_THRESHOLD = 1000

  const PRICE_TIERS = {
    bronze: { amount: 1500, description: "Expect posts from smaller creators" },
    silver: { amount: 3000, description: "Expect some posts from larger creators", popular: true },
    gold: { amount: 5000, description: "Expect posts from large creators" },
    diamond: { amount: 0, description: "A fully managed contest by the Go Viral team" }
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

  const handleResourceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setResourceFile(file)

      // For non-image files, we might not need a preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            setResourceFilePreview(e.target.result as string)
          }
        }
        reader.readAsDataURL(file)
      } else {
        // For non-image files, we can set a generic preview or file info
        setResourceFilePreview(null)
      }
    }
  }

  const removeResourceFile = () => {
    setResourceFile(null)
    setResourceFilePreview(null)
    setResourceDescription("")
    if (resourceFileRef.current) {
      resourceFileRef.current.value = ""
    }
  }

  const addFileResource = async () => {
    if (!user) {
      setError("You must be logged in to upload resources")
      return
    }

    if (!resourceFile) {
      return
    }

    try {
      // Check storage availability first
      const isStorageAvailable = await checkStorageAvailability()

      if (!isStorageAvailable) {
        setError("File upload is unavailable due to storage configuration. Please use external resource links instead.")
        return
      }

      const fileName = `contest_resources/${user.id}_${Date.now()}_${resourceFile.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contest-assets')
        .upload(fileName, resourceFile)

      if (uploadError) {
        // Check for bucket not found error - different ways the error might appear
        if (uploadError.message.includes("Bucket not found") ||
          (uploadError as any).statusCode === "404" ||
          (uploadError as any).error === "Bucket not found") {
          setError("Storage bucket 'contest-assets' not found. Please ask your administrator to create this bucket in the Supabase dashboard.")
          return
        }
        throw new Error(`Failed to upload resource: ${uploadError.message}`)
      }

      const { data: publicUrlData } = supabase.storage
        .from('contest-assets')
        .getPublicUrl(fileName)

      const resourceUrl = publicUrlData.publicUrl

      // Use filename as default resource name if none provided
      const resourceName = resourceDescription || resourceFile.name

      setResources({
        ...resources,
        [resourceName]: resourceUrl,
      })

      // Reset form
      removeResourceFile()

    } catch (error: any) {
      setError(`Resource upload failed: ${error.message}`)
    }
  }

  const handleSubmit = async (isDraft: boolean = false) => {
    setError(null)
    setValidationError(null)
    setIsLoading(true)

    if (!user) {
      setError("You must be logged in to create a contest")
      setIsLoading(false)
      return
    }

    // Validate dates and times if not a draft
    if (!isDraft) {
      if (!startDate || !startTime || !endDate || !endTime) {
        setValidationError("Contest start and end dates/times are required")
        setIsLoading(false)
        return
      }

      const startDateTime = new Date(`${startDate}T${startTime}`)
      const endDateTime = new Date(`${endDate}T${endTime}`)
      const now = new Date()

      if (startDateTime < now) {
        setValidationError("Contest start time must be in the future")
        setIsLoading(false)
        return
      }

      if (endDateTime <= startDateTime) {
        setValidationError("Contest end time must be after the start time")
        setIsLoading(false)
        return
      }

      // Check if duration is at least 1 day (24 hours)
      const durationMs = endDateTime.getTime() - startDateTime.getTime()
      const oneDayMs = 24 * 60 * 60 * 1000
      if (durationMs < oneDayMs) {
        setValidationError("Contest duration must be at least 1 day")
        setIsLoading(false)
        return
      }
    }

    try {
      // Calculate total prize amount
      let totalPrize = 0
      for (let i = 0; i < winnerCount; i++) {
        totalPrize += winnerAmounts[i] || 0
      }

      // Check if budget exceeds threshold
      if (totalPrize > HIGH_BUDGET_THRESHOLD) {
        setShowHighBudgetPrompt(true)
        setIsLoading(false)
        return
      }

      // Validate against plan features
      const planFeatures = getPlanFeatures(userPlan || 'bronze')

      if (!isDraft) { // Only validate if not saving as draft
        // Check winner count
        if (winnerCount > planFeatures.maxWinnersPerContest) {
          setValidationError(`Your ${userPlan || 'current'} plan is limited to ${planFeatures.maxWinnersPerContest} winners per contest. Upgrade your plan for more.`)
          setIsLoading(false)
          return
        }

        // Check minimum contest budget
        if (totalPrize < planFeatures.minContestBudget) {
          setValidationError(`The minimum contest budget for your ${userPlan || 'current'} plan is $${planFeatures.minContestBudget}. Please increase your prize pool.`)
          setIsLoading(false)
          return
        }

        // Check if budget exceeds maximum recommended
        if (totalPrize > MAX_CONTEST_BUDGET) {
          setShowContactModal(true)
          setIsLoading(false)
          return
        }

        // Check active contests limit (would require a database check)
        // This is a simplified version, in production you'd check against actual data
        const { count } = await supabase
          .from("contests")
          .select("*", { count: "exact", head: true })
          .eq("advertiser_id", user.id)
          .eq("is_draft", false)
          .or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`)

        if (count && count >= planFeatures.maxActiveContests) {
          setValidationError(`Your ${userPlan || 'current'} plan is limited to ${planFeatures.maxActiveContests} active contests. Please upgrade your plan or wait for current contests to complete.`)
          setIsLoading(false)
          return
        }
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
          // Check if storage is available first
          const isStorageAvailable = await checkStorageAvailability()

          if (!isStorageAvailable) {
            // Continue without thumbnail
            setError("Unable to upload thumbnail due to storage configuration. Contest will be created without a thumbnail.")
            // Don't return here, let the form continue submitting
          } else {
            const fileName = `contest_thumbnails/${user.id}_${Date.now()}`
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('contest-assets')
              .upload(fileName, thumbnail)

            if (uploadError) {
              // Check for bucket not found error - different ways the error might appear
              if (uploadError.message.includes("Bucket not found") ||
                (uploadError as any).statusCode === "404" ||
                (uploadError as any).error === "Bucket not found") {
                setError("Storage bucket 'contest-assets' not found. Please ask your administrator to create this bucket in the Supabase dashboard.")
                setIsLoading(false)
                return
              }
              throw new Error(`Failed to upload thumbnail: ${uploadError.message}`)
            }

            const { data: publicUrlData } = supabase.storage
              .from('contest-assets')
              .getPublicUrl(fileName)

            thumbnailUrl = publicUrlData.publicUrl
          }
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
          thumbnail_url: thumbnailUrl,
          category,
          platform: "youtube", // Default platform
          brief,
          prizes: prizesArray,
          total_prize: totalPrize * 100, // convert to cents
          rules: { list: rules.split("\n") },
          resources,
          inspiration_links: inspirationLinks,
          price_tier: userPlan,
          winner_count: winnerCount,
          is_draft: isDraft, // Add draft flag
          start_date: isDraft ? null : `${startDate}T${startTime}`,
          end_date: isDraft ? null : `${endDate}T${endTime}`
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
    if (newResourceUrl) {
      const resourceName = resourceDescription || "External Resource"
      setResources({
        ...resources,
        [resourceName]: newResourceUrl,
      })
      setNewResourceUrl("")
      setResourceDescription("")
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
    // Ensure amount is at least MIN_PRIZE_PER_WINNER
    amount = Math.max(amount, MIN_PRIZE_PER_WINNER);

    const newAmounts = [...winnerAmounts]
    newAmounts[index] = amount
    setWinnerAmounts(newAmounts)

    // Update total prize pool
    updateTotalPrizePool(newAmounts)
  }

  const updateTotalPrizePool = (amounts = winnerAmounts) => {
    const total = amounts.reduce((sum, amount) => sum + amount, 0)
    setTotalPrizePool(total)
  }

  const handleWinnerCountChange = (count: number) => {
    const planFeatures = getPlanFeatures(userPlan || 'bronze')

    if (count > planFeatures.maxWinnersPerContest) {
      setValidationError(`Your ${userPlan || 'current'} plan is limited to ${planFeatures.maxWinnersPerContest} winners per contest. Upgrade your plan for more.`)
      return
    }

    setValidationError(null)
    setWinnerCount(count)

    // Add more entries if needed, using default allocations or minimum prize
    if (count > winnerAmounts.length) {
      const newAmounts = [...winnerAmounts]
      for (let i = winnerAmounts.length; i < count; i++) {
        // Use default allocation if available, otherwise use minimum prize
        const position = i + 1
        newAmounts.push(DEFAULT_PRIZE_ALLOCATIONS[position as keyof typeof DEFAULT_PRIZE_ALLOCATIONS] || MIN_PRIZE_PER_WINNER)
      }
      setWinnerAmounts(newAmounts)
      updateTotalPrizePool(newAmounts)
    } else if (count < winnerAmounts.length) {
      // Remove extra entries
      const newAmounts = winnerAmounts.slice(0, count)
      setWinnerAmounts(newAmounts)
      updateTotalPrizePool(newAmounts)
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

  // Check if storage is available
  const checkStorageAvailability = async () => {
    try {
      // Try to list buckets or access storage to see if it's configured
      const { data, error } = await supabase.storage.getBucket('contest-assets')

      if (error) {
        if (error.message.includes("Bucket not found") ||
          (error as any).statusCode === "404" ||
          (error as any).error === "Bucket not found") {
          setStorageAvailable(false)
          return false
        }
      }

      setStorageAvailable(true)
      return true
    } catch (error) {
      setStorageAvailable(false)
      return false
    }
  }

  // New function to get the current user's subscription plan
  const getUserPlan = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from("users")
        .select("subscription_plan")
        .eq("id", user.id)
        .single()

      if (error) throw error

      if (data?.subscription_plan) {
        setUserPlan(data.subscription_plan)
      } else {
        setUserPlan(null) // No plan assigned
      }
    } catch (error) {
      console.error("Error fetching user plan:", error)
      setUserPlan(null) // Default to no plan on error
    }
  }

  // Get the features for the current plan
  const getPlanFeatures = (planId: string): PlanFeatures => {
    const plan = subscriptionPlans.find((p: SubscriptionPlan) => p.id === planId)
    return plan?.features || subscriptionPlans[0].features
  }

  // Validate if the user can perform certain actions based on their plan
  const canPerformAction = (action: string, value: number) => {
    const features = getPlanFeatures(userPlan || 'bronze')

    switch (action) {
      case 'createContest':
        return value <= features.maxActiveContests
      case 'contestBudget':
        return value >= features.minContestBudget
      case 'winnerCount':
        return value <= features.maxWinnersPerContest
      default:
        return true
    }
  }

  // Call this once when component mounts
  useEffect(() => {
    checkStorageAvailability()
    getUserPlan()

    // Set initial default prize allocations for the default 3 winners
    updateTotalPrizePool()
  }, [])

  // Calculate and format contest duration
  const getContestDuration = () => {
    if (!startDate || !startTime || !endDate || !endTime) return null;

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    const now = new Date();

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) return null;

    // Calculate days until contest starts
    const msUntilStart = startDateTime.getTime() - now.getTime();
    const daysUntilStart = Math.floor(msUntilStart / (1000 * 60 * 60 * 24));
    const hoursUntilStart = Math.floor((msUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // Calculate contest duration
    const msDuration = endDateTime.getTime() - startDateTime.getTime();
    const durationDays = Math.floor(msDuration / (1000 * 60 * 60 * 24));
    const durationHours = Math.floor((msDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    let startMessage = '';
    if (daysUntilStart > 0) {
      startMessage = `Your contest will be live in ${daysUntilStart} day${daysUntilStart !== 1 ? 's' : ''}`;
      if (hoursUntilStart > 0) startMessage += ` and ${hoursUntilStart} hour${hoursUntilStart !== 1 ? 's' : ''}`;
    } else if (hoursUntilStart > 0) {
      startMessage = `Your contest will be live in ${hoursUntilStart} hour${hoursUntilStart !== 1 ? 's' : ''}`;
    } else {
      startMessage = 'Your contest will be live soon';
    }

    const durationMessage = `and will run for ${durationDays} day${durationDays !== 1 ? 's' : ''}${durationHours > 0 ? ` and ${durationHours} hour${durationHours !== 1 ? 's' : ''}` : ''}`;

    return `${startMessage} ${durationMessage}`;
  };

  // Get minimum allowed start date and time (current date/time)
  const getMinDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  // Get minimum allowed end date (at least 1 day after the start date)
  const getMinEndDate = () => {
    if (!startDate) return getMinDateTime();

    const startDateObj = new Date(startDate);
    // Add one day to the start date to ensure minimum 1 day duration
    startDateObj.setDate(startDateObj.getDate() + 1);

    const year = startDateObj.getFullYear();
    const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(startDateObj.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  // Update end date/time when start date/time changes to ensure minimum 1-day duration
  useEffect(() => {
    if (!startDate || !startTime) return;

    const startDateTime = new Date(`${startDate}T${startTime}`);

    // If end date/time is set and is less than 1 day after start, update it
    if (endDate && endTime) {
      const endDateTime = new Date(`${endDate}T${endTime}`);
      const minEndDateTime = new Date(startDateTime);
      minEndDateTime.setDate(minEndDateTime.getDate() + 1);

      if (endDateTime < minEndDateTime) {
        // Set end date/time to be exactly 1 day after start
        const newEndDate = getMinEndDate();
        setEndDate(newEndDate);
        setEndTime(startTime); // Keep the same time of day
      }
    }
  }, [startDate, startTime]);

  // Modal for high budget contests
  const ContactModal = () => {
    if (!showContactModal) return null

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full">
          <h3 className="text-xl font-bold mb-4">High Budget Contest</h3>
          <p className="mb-4">For contests with budgets over ${MAX_CONTEST_BUDGET}, we recommend speaking with our team for personalized guidance and support.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowContactModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                // Logic to handle high budget contest request
                setShowContactModal(false)
                // Could open a form, send an email, etc.
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Contact Us
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // High Budget Prompt Modal
  const HighBudgetPromptModal = () => {
    if (!showHighBudgetPrompt) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full">
          <h3 className="text-xl font-bold mb-4">High Value Contest</h3>
          <p className="mb-4">For contests with budgets over ${HIGH_BUDGET_THRESHOLD}, we recommend reaching out to our team for personalized guidance and support.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowHighBudgetPrompt(false)}>Continue Anyway</Button>
            <Button
              onClick={() => {
                setShowHighBudgetPrompt(false)
                // Logic to contact the team could be added here
                window.open('mailto:support@goviral.ai', '_blank');
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Contact Our Team
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Add this to track prize pool value and show high budget prompt only when first exceeding threshold
  useEffect(() => {
    // Only show the prompt when exceeding the threshold for the first time
    if (totalPrizePool > HIGH_BUDGET_THRESHOLD && !hasExceededBudgetThreshold) {
      setShowHighBudgetPrompt(true);
      setHasExceededBudgetThreshold(true);
    }
  }, [totalPrizePool, hasExceededBudgetThreshold]);

  // Prize section
  const renderPrizeSection = () => {
    // Get current plan details
    const currentPlan = subscriptionPlans.find(p => p.id === userPlan) || null;
    const planFeatures = getPlanFeatures(userPlan || 'bronze');

    return (
      <>
        <CardHeader>
          <CardTitle>Total Prize</CardTitle>
          <CardDescription>Configure prize distribution for your contest</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {validationError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Current Plan Details */}
          <div className="border rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">Your Current Plan</h3>

            {currentPlan ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${userPlan === 'bronze' ? 'bg-orange-500' :
                    userPlan === 'silver' ? 'bg-gray-300' :
                      userPlan === 'gold' ? 'bg-yellow-400' :
                        userPlan === 'platinum' ? 'bg-indigo-400' : 'bg-blue-300'
                    }`}>
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">{currentPlan.name} Plan</h4>
                    <p className="text-sm text-gray-500">${currentPlan.price}/month</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Max Winners Per Contest:</span>
                    <span className="font-medium">{planFeatures.maxWinnersPerContest === Infinity ? 'Unlimited' : planFeatures.maxWinnersPerContest}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Budget Per Contest:</span>
                    <span className="font-medium">${planFeatures.minContestBudget}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Active Contests:</span>
                    <span className="font-medium">{planFeatures.maxActiveContests === Infinity ? 'Unlimited' : planFeatures.maxActiveContests}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-2">You currently have no subscription plan.</p>
                <Button asChild>
                  <Link href="/pricing">View Pricing Plans</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Contest Duration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contest Duration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={getMinDateTime()}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={getMinEndDate()}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {getContestDuration() && (
              <Alert className="mt-2 bg-green-50 border-green-200 text-green-700">
                <AlertDescription>{getContestDuration()}</AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-gray-500 mt-1">
              Contest duration must be at least 1 day. The end date will automatically adjust to maintain this minimum duration.
            </p>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Prize distribution</h3>
              <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                <span className="text-sm font-medium">Total Prize Pool:</span>
                <span className="text-lg font-bold">${totalPrizePool}</span>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-4 mb-4">
                <Label className="w-48">Number of Winners <span className="text-xs text-gray-500">(Required)</span></Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => handleWinnerCountChange(winnerCount - 1)}
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
                    onClick={() => handleWinnerCountChange(winnerCount + 1)}
                    disabled={winnerCount >= planFeatures.maxWinnersPerContest || winnerCount >= 10}
                  >
                    +
                  </Button>
                </div>
                <div className="text-sm text-gray-500">
                  <span>Allowed: {planFeatures.maxWinnersPerContest === Infinity ? 'Unlimited' : planFeatures.maxWinnersPerContest}</span>
                </div>
              </div>

              {Array.from({ length: Math.min(winnerCount, 10) }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 mb-2">
                  <Label className="w-48">Winner {i + 1}</Label>
                  <Input
                    type="number"
                    value={winnerAmounts[i] || MIN_PRIZE_PER_WINNER}
                    onChange={(e) => updateWinnerAmount(i, parseInt(e.target.value) || MIN_PRIZE_PER_WINNER)}
                    min={MIN_PRIZE_PER_WINNER}
                    className="w-48"
                  />
                  <div className="text-sm text-gray-500">
                    <span>Min: ${MIN_PRIZE_PER_WINNER}</span>
                  </div>
                </div>
              ))}
            </div>

            {totalPrizePool < planFeatures.minContestBudget && (
              <Alert className="mt-2">
                <AlertDescription>
                  The minimum prize pool for your {userPlan || 'current'} plan is ${planFeatures.minContestBudget}. Please increase your prize amounts.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </>
    );
  };

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
                  placeholder="Go Viral! Get Paid to Create"
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
                      <SelectItem value="other">Other</SelectItem>
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
                    placeholder="Go Viral is the app that pays creators! We help creators connect with brands & get paid to create content!"
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
              {storageAvailable === false && (
                <Alert className="mb-4">
                  <AlertDescription>
                    File upload functionality is currently unavailable. You can still add external resource links below.
                  </AlertDescription>
                </Alert>
              )}

              {storageAvailable !== false && (
                <>
                  <div className="space-y-2">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                      {resourceFile ? (
                        <div className="relative">
                          {resourceFilePreview && (
                            <img
                              src={resourceFilePreview}
                              alt="Resource preview"
                              className="mx-auto max-h-64 object-contain"
                            />
                          )}
                          <div className="mt-2 flex justify-between items-center">
                            <p className="text-sm text-gray-500">
                              {resourceFile?.name} · {(resourceFile?.size ? (resourceFile.size / (1024 * 1024)).toFixed(2) : '0')}MB
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={removeResourceFile}
                              className="text-red-500"
                            >
                              <Trash className="h-4 w-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Image className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm font-medium mb-1">Drag, drop or browse file</p>
                          <p className="text-xs text-gray-500 mb-4">Max file size: 20MB</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resourceFileRef.current?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" /> Upload
                          </Button>
                          <input
                            type="file"
                            ref={resourceFileRef}
                            className="hidden"
                            onChange={handleResourceFileChange}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center my-4">
                    <p>Or</p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="resource-link">External resource link</Label>
                <Input
                  id="resource-link"
                  placeholder="Paste external folder link"
                  value={newResourceUrl}
                  onChange={(e) => setNewResourceUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resource-description">Resource Description</Label>
                <Textarea
                  id="resource-description"
                  placeholder="Add description here*"
                  rows={6}
                  value={resourceDescription}
                  onChange={(e) => setResourceDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {resourceFile ? (
                  <Button onClick={addFileResource} disabled={!resourceFile}>
                    Add Resource File
                  </Button>
                ) : (
                  <Button
                    onClick={addResource}
                    disabled={!newResourceUrl}
                  >
                    Add External Resource
                  </Button>
                )}
              </div>

              {Object.keys(resources).length > 0 && (
                <div className="space-y-4 mt-4">
                  <h3 className="text-lg font-medium">Added Resources:</h3>
                  <div className="space-y-2">
                    {Object.entries(resources).map(([name, url]) => (
                      <div key={name} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-medium">{name}</p>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-rose-600 text-sm">
                            {url}
                          </a>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeResource(name)}
                          className="text-red-500 h-8 w-8 p-0"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Inspiration Content:</h3>
                <ul className="space-y-2">
                  {inspirationLinks.map((link, index) => (
                    <li key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">
                            Inspiration link {index + 1}
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
            </CardContent>
          </>
        )}

        {step === "prize" && renderPrizeSection()}

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
              <Button
                variant="outline"
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isLoading}
              >
                Save draft
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isLoading || (totalPrizePool < getPlanFeatures(userPlan || 'bronze').minContestBudget)}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
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

      {/* Contact Modal for high budget contests */}
      <ContactModal />

      {/* High Budget Prompt Modal */}
      <HighBudgetPromptModal />
    </div>
  )
}

