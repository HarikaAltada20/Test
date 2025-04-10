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
import { ArrowLeft, ArrowRight, Check, Image, Info, Trash, Trophy, Upload, AlertTriangle, AlertCircle, Trash2, ExternalLink, X } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { subscriptionPlans, MAX_CONTEST_BUDGET } from "@/constants/subscriptionPlans"
import { Progress } from "@/components/ui/progress"

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
  const [externalResourceDescription, setExternalResourceDescription] = useState("")
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null)
  const [inspirationLinks, setInspirationLinks] = useState<string[]>([
    "https://www.tiktok.com/@creator1/video/123456789",
    "https://www.tiktok.com/@creator2/video/987654321"
  ])
  const [newInspirationLink, setNewInspirationLink] = useState("")
  const [priceTier, setPriceTier] = useState<"bronze" | "silver" | "gold" | "platinum" | "diamond">("bronze")
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
  const [success, setSuccess] = useState<string | null>(null)
  const [totalPrizePool, setTotalPrizePool] = useState<number>(1000) // Default total prize pool
  const [hasExceededBudgetThreshold, setHasExceededBudgetThreshold] = useState<boolean>(false)

  // New state for contest duration
  const [startDate, setStartDate] = useState<string>("")
  const [startTime, setStartTime] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [endTime, setEndTime] = useState<string>("")
  const [showHighBudgetPrompt, setShowHighBudgetPrompt] = useState(false)

  // Add resourceUploadProgress to state variables
  const [resourceUploadProgress, setResourceUploadProgress] = useState<number>(0)

  // Constants
  const MIN_PRIZE_PER_WINNER = 5 // Minimum prize amount per winner in dollars
  const MAX_PRIZE_PER_WINNER = 1000 // Maximum prize amount per winner in dollars
  const DEFAULT_PRIZE_ALLOCATIONS = {
    1: 500,
    2: 300,
    3: 200,
    4: 100,
    5: 50
  }

  // High budget threshold
  const HIGH_BUDGET_THRESHOLD = 1000


  // Add draft ID state for tracking loaded drafts
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)

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

      // For image files, create a preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            setResourceFilePreview(e.target.result as string)
          }
        }
        reader.readAsDataURL(file)
      } else {
        // For non-image files, we just set a special flag to indicate file type
        setResourceFilePreview(`file-type:${file.type}`)
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

      setIsLoading(true)
      setResourceUploadProgress(10) // Start with 10% to show activity

      // Use original file name in the path
      const fileName = `contest_resources/${user.id}_${Date.now()}_${resourceFile.name}`

      // Simple upload without options - Supabase JS client doesn't support progress
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contest-assets')
        .upload(fileName, resourceFile)

      // Simulate progress after upload starts
      setResourceUploadProgress(70)

      if (uploadError) {
        throw new Error(`Failed to upload resource: ${uploadError.message}`)
      }

      setResourceUploadProgress(90)

      const { data: publicUrlData } = supabase.storage
        .from('contest-assets')
        .getPublicUrl(fileName)

      const resourceUrl = publicUrlData?.publicUrl || ''
      setResourceUploadProgress(100)

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
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveDraft = async () => {
    await handleSubmit(true);
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    setError(null)
    setValidationError(null)
    setSuccess(null)
    setIsLoading(true)

    if (!user) {
      setError("You must be logged in to create a contest")
      setIsLoading(false)
      return
    }

    // Validate required fields if not a draft
    if (!isDraft) {
      if (!title) {
        setValidationError("Contest title is required");
        setIsLoading(false);
        return;
      }

      if (!thumbnail && !thumbnailPreview) {
        setValidationError("Contest thumbnail is required");
        setIsLoading(false);
        return;
      }

      if (!brief) {
        setValidationError("Contest brief is required");
        setIsLoading(false);
        return;
      }

      if (!rules) {
        setValidationError("Contest rules are required");
        setIsLoading(false);
        return;
      }

      // Validate dates and times
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

      // Check if budget exceeds threshold - only if not a draft
      if (!isDraft && totalPrize > HIGH_BUDGET_THRESHOLD) {
        setShowHighBudgetPrompt(true)
        setIsLoading(false)
        return
      }

      // Validate against plan features - only if not a draft
      const planFeatures = getPlanFeatures(userPlan)

      // Perform validations only if not saving as draft
      if (!isDraft) {
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
        try {
          const { count, error: countError } = await supabase
            .from("contests")
            .select("*", { count: "exact", head: true })
            .eq("advertiser_id", user.id)
            .eq("is_draft", false)
            .or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`)

          if (countError) {
            console.error("Error checking active contests:", countError)
            // Continue with default count of 0
          }

          if (count && count >= planFeatures.maxActiveContests) {
            setValidationError(`Your ${userPlan || 'current'} plan is limited to ${planFeatures.maxActiveContests} active contests. Please upgrade your plan or wait for current contests to complete.`)
            setIsLoading(false)
            return
          }
        } catch (err) {
          console.error("Error checking active contests:", err)
          // Continue with submission as fallback
        }
      }

      // Create prize array
      const prizesArray = Array.from({ length: winnerCount }, (_, i) => ({
        position: i + 1,
        amount: winnerAmounts[i] || 0
      }))

      let thumbnailUrl = thumbnailPreview && !thumbnail ? thumbnailPreview : ""

      if (thumbnail) {
        try {
          // Check if storage is available first
          const isStorageAvailable = await checkStorageAvailability()

          if (!isStorageAvailable) {
            // Continue without thumbnail
            setError("Unable to upload thumbnail due to storage configuration. Contest will be created without a thumbnail.")
            // Don't return here, let the form continue submitting
          } else {
            // Use original file name in the path for better organization
            const fileName = `contest_thumbnails/${user.id}_${Date.now()}_${thumbnail.name}`
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('contest-assets')
              .upload(fileName, thumbnail)

            if (uploadError) {
              throw new Error(`Failed to upload thumbnail: ${uploadError.message}`)
            }

            const { data: publicUrlData } = supabase.storage
              .from('contest-assets')
              .getPublicUrl(fileName)

            thumbnailUrl = publicUrlData?.publicUrl || ''
          }
        } catch (error: any) {
          setError(`Thumbnail upload failed: ${error.message}`)
          setIsLoading(false)
          return
        }
      }

      // Prepare contest data for submission
      const contestData = {
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
        subscription_plan: userPlan, // Use subscription_plan instead of price_tier
        winner_count: winnerCount,
        is_draft: isDraft, // Mark as draft
        start_date: `${startDate}T${startTime}`, // Always store dates for both drafts and published
        end_date: `${endDate}T${endTime}`  // Always store dates for both drafts and published
        // Note: We do not store status explicitly as it will be calculated by the view
      }

      let responseData, responseError;

      if (draftId) {
        // Update existing draft
        const response = await supabase
          .from("contests")
          .update(contestData)
          .eq("id", draftId)
          .select()

        responseData = response.data;
        responseError = response.error;
      } else {
        // Create new contest
        const response = await supabase
          .from("contests")
          .insert(contestData)
          .select()

        responseData = response.data;
        responseError = response.error;
      }

      if (responseError) throw responseError

      // Set draft ID if this is a new draft
      if (isDraft && !draftId && responseData && responseData.length > 0) {
        setDraftId(responseData[0].id);
      }

      // Only redirect if not a draft
      if (!isDraft) {
        router.push("/dashboard/contests")
      } else {
        setIsLoading(false)
        // Show success message for draft
        setSuccess("Draft saved successfully!")
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      setError(err.message || "Failed to create contest")
      setIsLoading(false)
    }
  }

  const addResource = () => {
    if (newResourceUrl) {
      const resourceName = externalResourceDescription || "External Resource"
      setResources({
        ...resources,
        [resourceName]: newResourceUrl,
      })
      setNewResourceUrl("")
      setExternalResourceDescription("")
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

  const handleWinnerAmountChange = (index: number, value: string) => {
    const numValue = Number(value)

    // Validate the amount is within allowed limits
    if (numValue < MIN_PRIZE_PER_WINNER) {
      setError(`Prize amount cannot be less than $${MIN_PRIZE_PER_WINNER}`)
      return
    }

    if (numValue > MAX_PRIZE_PER_WINNER) {
      setError(`Prize amount cannot exceed $${MAX_PRIZE_PER_WINNER}`)
      return
    }

    setError(null)
    const newWinnerAmounts = [...winnerAmounts]
    newWinnerAmounts[index] = numValue
    setWinnerAmounts(newWinnerAmounts)

    // Update total prize pool
    updateTotalPrizePool(newWinnerAmounts)
  }

  // Keep the original function for backward compatibility
  const updateWinnerAmount = (index: number, amount: number) => {
    // Ensure amount is at least MIN_PRIZE_PER_WINNER and at most MAX_PRIZE_PER_WINNER
    amount = Math.max(Math.min(amount, MAX_PRIZE_PER_WINNER), MIN_PRIZE_PER_WINNER);

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
    setValidationError(null);

    // Validate only what's needed for the current step
    if (step === "basics") {
      // For basics step, only validate title and thumbnail if not a draft
      if (!title) {
        setValidationError("Please enter a contest title");
        return;
      }

      // Only check for thumbnail if we don't have a preview (from a draft) 
      if (!thumbnail && !thumbnailPreview) {
        setValidationError("Please upload a thumbnail for your contest");
        return;
      }

      setStep("brief");
    } else if (step === "brief") {
      if (!brief) {
        setValidationError("Please enter a brief description for your contest");
        return;
      }
      if (!rules) {
        setValidationError("Please provide rules for your contest");
        return;
      }
      setStep("resources");
    } else if (step === "resources") {
      setStep("prize");
    }
  }

  const prevStep = () => {
    if (step === "prize") setStep("resources")
    else if (step === "resources") setStep("brief")
    else if (step === "brief") setStep("basics")
  }

  const isNextDisabled = () => {
    const planFeatures = getPlanFeatures(userPlan);  // Add this line to fix undefined planFeatures

    if (step === "basics") return !title;
    if (step === "brief") return !brief || !rules;
    return false;
  }

  // Check if storage is available and create bucket if missing
  const checkStorageAvailability = async () => {
    try {
      // Check if we can access the storage bucket
      const { data, error } = await supabase.storage.getBucket('contest-assets')

      if (error) {
        console.error("Storage access error:", error);
        // Try to create the bucket if it doesn't exist
        try {
          // Create the bucket with public access
          const { data: createData, error: createError } = await supabase.storage.createBucket('contest-assets', {
            public: true, // Make bucket public
            fileSizeLimit: 20 * 1024 * 1024, // 20MB limit
          })

          if (createError) {
            console.error("Failed to create storage bucket:", createError);
            setStorageAvailable(false)
            return false
          }

          console.log("Created storage bucket successfully")
          setStorageAvailable(true)
          return true
        } catch (createErr) {
          console.error("Error creating bucket:", createErr);
          setStorageAvailable(false)
          return false
        }
      }

      // If bucket exists but doesn't have correct settings, update it
      if (data && (!data.file_size_limit || data.file_size_limit !== 20 * 1024 * 1024)) {
        try {
          const { error: updateError } = await supabase.storage.updateBucket('contest-assets', {
            public: true,
            fileSizeLimit: 20 * 1024 * 1024, // 20MB limit
          })

          if (updateError) {
            console.error("Failed to update storage bucket:", updateError)
          }
        } catch (updateErr) {
          console.error("Error updating bucket:", updateErr)
        }
      }

      setStorageAvailable(true)
      return true
    } catch (error) {
      console.error("Storage check error:", error);
      setStorageAvailable(false)
      return false
    }
  }

  // New function to get the current user's subscription plan
  const getUserPlan = async () => {
    if (!user) return

    try {
      // First try to get the subscription from a dedicated subscriptions table
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select("plan_id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (!subscriptionError && subscriptionData?.plan_id) {
        setUserPlan(subscriptionData.plan_id)
        return
      }

      // If that doesn't work, try the users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("subscription_plan")
        .eq("id", user.id)
        .single()

      if (!userError && userData?.subscription_plan) {
        setUserPlan(userData.subscription_plan)
        return
      }

      // If no plan is found in either table, check advertiser_profiles
      const { data: advertiserData, error: advertiserError } = await supabase
        .from("advertiser_profiles")
        .select("subscription_tier")
        .eq("user_id", user.id)
        .single()

      if (!advertiserError && advertiserData?.subscription_tier) {
        setUserPlan(advertiserData.subscription_tier)
        return
      }

      // If we couldn't find a subscription anywhere, don't set a default
      // The UI will handle showing the appropriate message
      setUserPlan(null)
    } catch (error) {
      console.error("Error in getUserPlan:", error)
      setUserPlan(null) // Don't default to any plan on error
    }
  }

  // Get the features for the current plan
  const getPlanFeatures = (planId: string | null): PlanFeatures => {
    if (!planId) {
      // Return basic features if no plan is found
      return {
        maxActiveContests: 1,
        minContestBudget: 0,
        maxWinnersPerContest: 3,
        accessToCreators: false,
        contestBranding: "Branded",
        analytics: false,
        support: "Email"
      }
    }
    const plan = subscriptionPlans.find((p: SubscriptionPlan) => p.id === planId)
    return plan?.features || subscriptionPlans[0].features
  }

  // Validate if the user can perform certain actions based on their plan
  const canPerformAction = (action: string, value: number) => {
    const features = getPlanFeatures(userPlan)

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

  // Function to load draft data
  const loadDraftData = async () => {
    if (!user) return;

    try {
      // Check if there's a 'new' parameter in the URL - if so, don't load any draft
      const urlParams = new URLSearchParams(window.location.search);
      const isNewContest = urlParams.get('new') === 'true';

      if (isNewContest) {
        // User explicitly wants a new contest - don't load any draft
        return;
      }

      // Check if there's a draft ID in the URL query parameters
      const draftIdFromUrl = urlParams.get('draft');

      if (draftIdFromUrl) {
        // Load specific draft from URL parameter
        const { data: specificDraft, error: specificError } = await supabase
          .from("contests")
          .select("*")
          .eq("id", draftIdFromUrl)
          .eq("advertiser_id", user.id) // Security check to make sure user owns this draft
          .single();

        if (specificError) {
          console.error("Error fetching specific draft:", specificError);
          return;
        }

        if (specificDraft) {
          populateDraftData(specificDraft);
          return;
        }
      }

      // If no draft ID in URL or draft not found, try to load the most recent draft
      const { data: draftContests, error } = await supabase
        .from("contests")
        .select("*")
        .eq("advertiser_id", user.id)
        .eq("is_draft", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching draft:", error);
        return;
      }

      if (!draftContests || draftContests.length === 0) {
        // No drafts found
        return;
      }

      populateDraftData(draftContests[0]);
    } catch (err) {
      console.error("Error loading draft data:", err);
    }
  };

  // Helper function to populate form with draft data
  const populateDraftData = (draft: any) => {
    setDraftId(draft.id);

    console.log("Loading draft data:", draft); // For debugging

    // Pre-fill form fields with draft data
    if (draft.title) setTitle(draft.title);
    if (draft.category) setCategory(draft.category);
    if (draft.brief) setBrief(draft.brief);
    if (draft.rules?.list) setRules(draft.rules.list.join("\n"));

    // Set resources if available
    if (draft.resources && typeof draft.resources === 'object') {
      setResources(draft.resources);
    }

    // Set inspiration links if available
    if (draft.inspiration_links && Array.isArray(draft.inspiration_links)) {
      setInspirationLinks(draft.inspiration_links);
    }

    // Set subscription plan if available (check both price_tier and subscription_plan for compatibility)
    if (draft.subscription_plan) {
      setPriceTier(draft.subscription_plan as "bronze" | "silver" | "gold" | "platinum" | "diamond");
    } else if (draft.price_tier) {
      setPriceTier(draft.price_tier as "bronze" | "silver" | "gold" | "platinum" | "diamond");
    }

    // Set winner count and amounts if available
    if (draft.winner_count) {
      setWinnerCount(draft.winner_count);
    }

    if (draft.prizes && Array.isArray(draft.prizes)) {
      const amounts = draft.prizes.map((prize: { amount?: number, position?: number }) => prize.amount || 0);
      setWinnerAmounts(amounts);
      updateTotalPrizePool(amounts);
    }

    // Set dates and times if available
    if (draft.start_date) {
      const startDateTime = new Date(draft.start_date);
      setStartDate(startDateTime.toISOString().split('T')[0]);
      setStartTime(startDateTime.toISOString().split('T')[1].substring(0, 5));
    }

    if (draft.end_date) {
      const endDateTime = new Date(draft.end_date);
      setEndDate(endDateTime.toISOString().split('T')[0]);
      setEndTime(endDateTime.toISOString().split('T')[1].substring(0, 5));
    }

    // If thumbnail URL is available, show it in the preview
    if (draft.thumbnail_url) {
      setThumbnailPreview(draft.thumbnail_url);
    }

    setDraftLoaded(true);
    console.log("Draft loaded successfully, thumbnail preview:", draft.thumbnail_url);
  };

  // Call this once when component mounts
  useEffect(() => {
    checkStorageAvailability()
    getUserPlan()
    loadDraftData() // Load draft data if available

    // Set initial default prize allocations for the default 3 winners
    updateTotalPrizePool()
  }, [user]) // Re-run when user changes

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
    return {
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    };
  };

  // Get minimum allowed start time for today
  const getMinStartTime = () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // If selected date is today, return current time
    if (startDate === today) {
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes() + 1).padStart(2, '0')}`;
    }

    // If selected date is in future, return any time
    return "00:00";
  };

  // Get minimum allowed end date (at least 1 day after the start date)
  const getMinEndDate = () => {
    if (!startDate || !startTime) return getMinDateTime().date;

    const startDateObj = new Date(`${startDate}T${startTime}`);
    // Add one day to the start date to ensure minimum 1 day duration
    startDateObj.setDate(startDateObj.getDate() + 1);

    return `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;
  };

  // Get minimum allowed end time based on start date/time
  const getMinEndTime = () => {
    if (!startDate || !startTime || !endDate) return "00:00";

    const startDateObj = new Date(`${startDate}T${startTime}`);
    const endDateObj = new Date(`${endDate}T00:00:00`);
    const oneDayLater = new Date(startDateObj);
    oneDayLater.setDate(oneDayLater.getDate() + 1);

    // If end date is exactly 1 day after start date, minimum end time should be same as start time
    if (endDateObj.toDateString() === oneDayLater.toDateString()) {
      return startTime;
    }

    // If end date is more than 1 day after start date, any time is valid
    return "00:00";
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
                <p className="text-gray-500 mb-2">You don't have an active subscription plan.</p>
                <Button asChild className="bg-rose-600 hover:bg-rose-700 text-white">
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
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    // If new date is today, check if time needs adjustment
                    const minTime = getMinStartTime();
                    if (startTime < minTime) {
                      setStartTime(minTime);
                    }
                  }}
                  min={getMinDateTime().date}
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
                  min={startDate === getMinDateTime().date ? getMinDateTime().time : undefined}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    // If new end date requires time adjustment
                    const minEndTime = getMinEndTime();
                    if (endTime < minEndTime) {
                      setEndTime(minEndTime);
                    }
                  }}
                  min={getMinEndDate()}
                  className="w-full"
                  disabled={!startDate || !startTime}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  min={endDate === getMinEndDate() ? getMinEndTime() : undefined}
                  className="w-full"
                  disabled={!startDate || !startTime || !endDate}
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
                    onChange={(e) => handleWinnerAmountChange(i, e.target.value)}
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
        {/* Show success message when a draft is saved */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 mx-4 mt-4 flex justify-between items-center">
            <div className="flex items-center">
              <Check className="h-5 w-5 mr-2" />
              {success}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccess(null)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "basics" && (
          <>
            <CardHeader>
              <CardTitle>Create a new contest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {validationError && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

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
                          {thumbnail?.name || "Saved thumbnail"}
                          {thumbnail?.size ? ` · ${(thumbnail.size / (1024 * 1024)).toFixed(2)}MB` : ''}
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
            <CardFooter className="flex justify-between">
              <div></div> {/* Empty div for spacing */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={isNextDisabled() || isLoading}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Next
                </Button>
              </div>
            </CardFooter>
          </>
        )}

        {step === "brief" && (
          <>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {validationError && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

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
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isLoading}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={isNextDisabled() || isLoading}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Next
                </Button>
              </div>
            </CardFooter>
          </>
        )}

        {step === "resources" && (
          <>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {validationError && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              {/* Resources Section */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-2">Resources for Participants</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add resources that will help participants understand your brand and contest requirements.
                </p>

                <div className="space-y-6">
                  {/* File Upload Container */}
                  <div className="border rounded-lg p-4">
                    <h4 className="text-md font-medium mb-2">Upload Asset</h4>

                    {/* Resource Description */}
                    <div className="mb-4">
                      <Label htmlFor="resourceDescription">Asset Description</Label>
                      <Textarea
                        id="resourceDescription"
                        placeholder="Enter a description for this asset"
                        className="mt-1"
                        value={resourceDescription}
                        onChange={(e) => setResourceDescription(e.target.value)}
                      />
                    </div>

                    {/* File Uploader */}
                    {storageAvailable ? (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4">
                        {resourceFilePreview ? (
                          <div className="relative">
                            {resourceFilePreview.startsWith('data:image') ? (
                              // Image file preview
                              <img
                                src={resourceFilePreview}
                                alt="Resource preview"
                                className="mx-auto max-h-64 object-contain"
                              />
                            ) : (
                              // Non-image file preview
                              <div className="mx-auto py-4 text-center">
                                {resourceFilePreview.startsWith('file-type:application/pdf') && (
                                  <div className="flex flex-col items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M8.267 14.68c-.184 0-.308.018-.372.036v1.178c.076.018.171.023.302.023.479 0 .774-.242.774-.651 0-.366-.254-.586-.704-.586zm3.487.012c-.2 0-.33.018-.407.036v2.61c.077.018.201.018.313.018.817.006 1.349-.444 1.349-1.396.006-.83-.479-1.268-1.255-1.268z" />
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM9.498 16.19c-.309.29-.765.42-1.296.42a2.23 2.23 0 0 1-.308-.018v1.426H7v-3.936A7.558 7.558 0 0 1 8.219 14c.557 0 .953.106 1.22.319.254.202.426.533.426.923-.001.392-.131.723-.367.948zm3.807 1.355c-.42.349-1.059.515-1.84.515-.468 0-.799-.03-1.024-.06v-3.917A7.947 7.947 0 0 1 11.66 14c.757 0 1.249.136 1.633.426.415.308.675.799.675 1.504 0 .763-.279 1.29-.763 1.615zM17 14.77h-1.532v.911H16.9v.734h-1.432v1.604h-.906V14.03H17v.74zM14 9h-1V4l5 5h-4z" />
                                    </svg>
                                    <span className="mt-2 font-medium">PDF Document</span>
                                  </div>
                                )}
                                {resourceFilePreview.startsWith('file-type:video/') && (
                                  <div className="flex flex-col items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
                                      <path d="m9 17 8-5-8-5z" />
                                    </svg>
                                    <span className="mt-2 font-medium">Video File</span>
                                  </div>
                                )}
                                {resourceFilePreview.startsWith('file-type:audio/') && (
                                  <div className="flex flex-col items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M19.952 1.651a.991.991 0 0 0-1.164.986v14.522c-.87-.703-2.354-1.062-4.137-1.062-1.636 0-3.52.33-4.7 1.505S9 20.147 9 21.428v.893C9 22.705 9.322 23 9.731 23c.4 0 .726-.286.735-.678v-.009l.007-.407c.001-.921.396-1.762 1.465-2.506.957-.662 2.492-1.046 4.313-1.046s3.356.384 4.313 1.046c1.069.744 1.464 1.585 1.465 2.506l.007.407v.009c.009.392.335.678.735.678.409 0 .731-.295.731-.679v-.893c0-1.281-.297-2.45-1.478-3.625S17.172 16.1 15.532 16.1c-.51 0-1.01.036-1.492.103V5.256l5.227-2.783a.996.996 0 0 0 .571-1.173 1.01 1.01 0 0 0-.876-.749zM8.364 6.4a.771.771 0 0 0-.388 0c-.612.13-1.21.332-1.781.6-1.307.619-2.398 1.525-3.182 2.643a1.773 1.773 0 0 0-.3.507c-.435.941-.671 1.969-.671 3.021 0 1.051.236 2.078.671 3.018.141.299.215.421.3.507.784 1.118 1.875 2.026 3.182 2.644.571.271 1.169.473 1.781.603a.771.771 0 0 0 .388 0c.612-.13 1.21-.332 1.781-.603 1.307-.618 2.398-1.526 3.182-2.644.084-.086.158-.208.3-.507.436-.94.671-1.967.671-3.018 0-1.052-.235-2.08-.671-3.021a1.772 1.772 0 0 0-.3-.507c-.784-1.118-1.875-2.024-3.182-2.643-.571-.268-1.169-.47-1.781-.6zm.134 1.728c.419.089.823.219 1.207.39a7.216 7.216 0 0 1 2.12 1.67c.823 1.003 1.305 2.159 1.347 3.35.055 1.522-.464 3.03-1.534 4.303a7.222 7.222 0 0 1-2.327 1.953 5.683 5.683 0 0 1-.813.329 5.686 5.686 0 0 1-.813-.329 7.222 7.222 0 0 1-2.327-1.953c-1.07-1.273-1.589-2.781-1.534-4.303.042-1.191.524-2.347 1.347-3.35a7.217 7.217 0 0 1 2.119-1.67c.384-.171.789-.301 1.208-.39z" />
                                    </svg>
                                    <span className="mt-2 font-medium">Audio File</span>
                                  </div>
                                )}
                                {resourceFilePreview.startsWith('file-type:application/vnd.openxmlformats-officedocument.') && (
                                  <div className="flex flex-col items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                                      <path d="M14 14H8v-2h6v2zm0 3H8v-2h6v2z" />
                                    </svg>
                                    <span className="mt-2 font-medium">Office Document</span>
                                  </div>
                                )}
                                {/* Default file icon for other file types */}
                                {!resourceFilePreview.startsWith('file-type:application/pdf') &&
                                  !resourceFilePreview.startsWith('file-type:video/') &&
                                  !resourceFilePreview.startsWith('file-type:audio/') &&
                                  !resourceFilePreview.startsWith('file-type:application/vnd.openxmlformats-officedocument.') && (
                                    <div className="flex flex-col items-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                                        <path d="M8 15h8v2H8zm0-4h8v2H8z" />
                                      </svg>
                                      <span className="mt-2 font-medium">File</span>
                                    </div>
                                  )}
                              </div>
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
                          <div className="text-center py-6">
                            <Upload className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm font-medium mb-1">Drag, drop or browse file</p>
                            <p className="text-xs text-gray-500 mb-4">Max file size: 20MB</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resourceFileRef.current?.click()}
                            >
                              <Upload className="h-4 w-4 mr-2" /> Select File
                            </Button>
                            <input
                              type="file"
                              ref={resourceFileRef}
                              id="resourceFileInput"
                              className="hidden"
                              onChange={handleResourceFileChange}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-amber-600 text-sm mb-4">
                        <AlertTriangle className="inline w-4 h-4 mr-1" />
                        Asset upload unavailable. Please use external links.
                      </div>
                    )}

                    {/* Upload Button */}
                    {resourceFile && resourceDescription && (
                      <Button
                        type="button"
                        onClick={addFileResource}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading ? (
                          <>
                            Uploading...
                            <Progress value={resourceUploadProgress || 0} className="ml-2 w-20 h-2" />
                          </>
                        ) : (
                          <>Upload Asset</>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* External Resource Container */}
                  <div className="border rounded-lg p-4">
                    <h4 className="text-md font-medium mb-2">Add External Resource</h4>

                    {/* External Resource Description */}
                    <div className="mb-4">
                      <Label htmlFor="externalResourceDescription">Resource Description</Label>
                      <Textarea
                        id="externalResourceDescription"
                        placeholder="Enter a description for this external resource"
                        className="mt-1"
                        value={externalResourceDescription}
                        onChange={(e) => setExternalResourceDescription(e.target.value)}
                      />
                    </div>

                    {/* Resource Link Input */}
                    <div className="mb-4">
                      <Label htmlFor="resourceLink">Resource Link</Label>
                      <Input
                        id="resourceLinkInput"
                        type="url"
                        placeholder="https://example.com/resource"
                        value={newResourceUrl}
                        onChange={(e) => setNewResourceUrl(e.target.value)}
                      />
                    </div>

                    {/* Add External Resource Button */}
                    <Button
                      type="button"
                      disabled={!newResourceUrl || !externalResourceDescription}
                      onClick={addResource}
                      className="w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Add External Resource
                    </Button>
                  </div>

                  {/* Resource file upload error */}
                  {error && (
                    <div className="mt-2 text-red-600 text-sm">
                      <AlertCircle className="inline w-4 h-4 mr-1" />
                      {error}
                    </div>
                  )}

                  {/* Added Resources */}
                  {resources && Object.keys(resources).length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Added Resources:</h4>
                      <div className="space-y-2">
                        {Object.entries(resources).map(([name, url]) => (
                          <div key={name} className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <div className="font-medium">{name}</div>
                              <div className="text-sm text-gray-600 truncate max-w-xs">
                                {url}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeResource(name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isLoading}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={isNextDisabled() || isLoading}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Next
                </Button>
              </div>
            </CardFooter>
          </>
        )}

        {step === "prize" && (
          <>
            <CardHeader>
              <CardTitle>Prize Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {validationError && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              {renderPrizeSection()}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isLoading}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isLoading || !startDate || !startTime || !endDate || !endTime}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isLoading ? "Creating..." : "Create Contest"}
                </Button>
              </div>
            </CardFooter>
          </>
        )}
      </Card>

      {/* Contact Modal for high budget contests */}
      <ContactModal />

      {/* High Budget Prompt Modal */}
      <HighBudgetPromptModal />
    </div>
  )
}

