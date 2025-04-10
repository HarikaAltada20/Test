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
import { toLocalDateTimeStrings, toUTCISOString, formatLocalDateTime } from "@/lib/utils"
import { formatCurrency, dollarsToCents } from "@/lib/currency-utils"

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
  const [winnerAmounts, setWinnerAmounts] = useState<number[]>([5000, 3000, 2000])
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
  const MIN_PRIZE_PER_WINNER = 500  // $5.00 in cents
  const MAX_PRIZE_PER_WINNER = 100000  // $1,000.00 in cents
  const DEFAULT_PRIZE_ALLOCATIONS = {
    1: 50000, // $500.00
    2: 30000, // $300.00
    3: 20000, // $200.00
    4: 10000, // $100.00
    5: 5000   // $50.00
  }

  // High budget threshold
  const HIGH_BUDGET_THRESHOLD = 100000  // $1,000 in cents


  // Add draft ID state for tracking loaded drafts
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)

  // Add this to the state declarations
  const [resourceFiles, setResourceFiles] = useState<{ [key: string]: File }>({});

  // Add this function for handling resource file uploads
  const handleResourceFileUpload = async (name: string, file: File) => {
    try {
      // Store the file temporarily for preview
      setResourceFiles(prev => ({
        ...prev,
        [name]: file
      }));

      // Update resources object with a temporary URL for preview
      setResources(prev => ({
        ...prev,
        [name]: URL.createObjectURL(file)
      }));
    } catch (error) {
      console.error("Error handling resource file:", error);
    }
  };

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
    if (!resourceFile) {
      setError("No file selected");
      return;
    }

    try {
      // Use filename as default resource name if none provided
      const resourceName = resourceDescription || resourceFile.name;

      // Store the resource in state
      setResources({
        ...resources,
        [resourceName]: resourceFilePreview || URL.createObjectURL(resourceFile)
      });

      // Store the file reference for later upload
      setResourceFiles({
        ...resourceFiles,
        [resourceName]: resourceFile
      });

      // Reset form
      removeResourceFile();
      setSuccess("Resource added!");

    } catch (error: any) {
      console.error("Error adding resource:", error);
      setError(`Failed to add resource: ${error.message}`);
    }
  }

  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleSaveDraft = async () => {
    try {
      // Reset states
      setError(null);
      setValidationError(null);
      setSuccess(null);
      setIsLoading(true);
      setUploadProgress("Saving draft...");

      // Add timeout to clear loading state if something goes wrong
      const draftTimeoutId = setTimeout(() => {
        setIsLoading(false)
        setUploadProgress(null)
        setError("Draft save timed out. Please try again.")
      }, 30000) // 30 second timeout as safety measure

      // Get the authenticated user first to verify we're logged in
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        setError("You must be logged in to save drafts");
        setIsLoading(false);
        setUploadProgress(null);
        clearTimeout(draftTimeoutId);
        return;
      }

      // Now call handleSubmit with draft=true
      await handleSubmit(true);

      // Clear timeout if we got here successfully
      clearTimeout(draftTimeoutId);
    } catch (error: any) {
      console.error("Error saving draft:", error);
      setError(`Failed to save draft: ${error.message || "Unknown error"}`);
      setIsLoading(false);
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    // Reset states
    setError(null)
    setValidationError(null)
    setSuccess(null)
    setIsLoading(true)

    // Add timeout to clear loading state if something goes wrong
    const loadingTimeoutId = setTimeout(() => {
      setIsLoading(false)
      setUploadProgress(null)
      setError("Request timed out. Please try again.")
    }, 30000) // 30 second timeout as safety measure

    // Declare timeout ID at the function scope so it's available in all blocks
    let prepTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

    try {
      // Early return for draft with no title but keep other fields
      if (isDraft && !title) {
        setValidationError("Title is required even for drafts")
        setIsLoading(false)
        setUploadProgress(null)
        clearTimeout(loadingTimeoutId)
        return
      }

      // Client-side validation for prize amounts
      for (let i = 0; i < winnerCount; i++) {
        if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
          setValidationError(`Prize for Winner ${i + 1} must be at least ${formatCurrency(MIN_PRIZE_PER_WINNER)}`)
          setIsLoading(false)
          setUploadProgress(null)
          clearTimeout(loadingTimeoutId)
          return
        }
      }

      // Check if any required user plan information is available
      const userId = user?.id
      if (!isDraft && !userId) {
        setError("User information not available. Please refresh the page and try again.")
        setIsLoading(false)
        setUploadProgress(null)
        clearTimeout(loadingTimeoutId)
        return
      }

      // Only run these validations if we're not in draft mode
      if (!isDraft) {
        setUploadProgress("Preparing contest...");

        // Add this timeout to prevent getting stuck forever
        prepTimeoutId = setTimeout(() => {
          // If we're still at "Preparing contest..." after 5 seconds, 
          // something might be wrong - provide feedback to the user
          if (isLoading && uploadProgress === "Preparing contest...") {
            console.log("Contest creation taking longer than expected...");
            setUploadProgress("Validating contest details...");
          }
        }, 5000);

        if (!thumbnail && !thumbnailPreview) {
          setValidationError("Contest thumbnail is required")
          setIsLoading(false)
          setUploadProgress(null)
          clearTimeout(loadingTimeoutId)
          return
        }

        if (!brief) {
          setValidationError("Contest brief is required")
          setIsLoading(false)
          setUploadProgress(null)
          clearTimeout(loadingTimeoutId)
          return
        }

        if (!rules) {
          setValidationError("Contest rules are required")
          setIsLoading(false)
          setUploadProgress(null)
          clearTimeout(loadingTimeoutId)
          return
        }

        // Validate dates and times for published contests
        if (!startDate || !startTime || !endDate || !endTime) {
          setValidationError("Contest start and end dates/times are required for publishing")
          setIsLoading(false)
          setUploadProgress(null)
          clearTimeout(loadingTimeoutId)
          return
        }

        try {
          const startDateTime = new Date(`${startDate}T${startTime}`)
          const endDateTime = new Date(`${endDate}T${endTime}`)
          const now = new Date()

          // Make sure dates are valid
          if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            setValidationError("Invalid date or time format. Please check your entries.")
            setIsLoading(false)
            setUploadProgress(null)
            clearTimeout(loadingTimeoutId)
            return
          }

          if (startDateTime < now) {
            setValidationError("Contest start time must be in the future")
            setIsLoading(false)
            setUploadProgress(null)
            clearTimeout(loadingTimeoutId)
            return
          }

          if (endDateTime <= startDateTime) {
            setValidationError("Contest end time must be after the start time")
            setIsLoading(false)
            setUploadProgress(null)
            clearTimeout(loadingTimeoutId)
            return
          }

          // Check if duration is at least 1 day (24 hours)
          const durationMs = endDateTime.getTime() - startDateTime.getTime()
          const oneDayMs = 24 * 60 * 60 * 1000
          if (durationMs < oneDayMs) {
            setValidationError("Contest duration must be at least 1 day")
            setIsLoading(false)
            setUploadProgress(null)
            clearTimeout(loadingTimeoutId)
            return
          }
        } catch (error) {
          console.error("Date validation error:", error);
          setValidationError("There was an error with the date/time format. Please check your entries.")
          setIsLoading(false)
          setUploadProgress(null)
          clearTimeout(loadingTimeoutId)
          return
        }
      }

      // Create prize array - store prize amounts in cents
      const prizesArray = Array.from({ length: winnerCount }, (_, i) => ({
        position: i + 1,
        amount: (winnerAmounts[i] || 0)
      }))

      let thumbnailUrl = thumbnailPreview && !thumbnail ? thumbnailPreview : ""

      // Upload thumbnail if provided
      if (thumbnail) {
        setUploadProgress(isDraft ? "Uploading thumbnail..." : "Uploading thumbnail (1/2)...")
        try {
          // Check if storage is available first
          const isStorageAvailable = await checkStorageAvailability()

          if (!isStorageAvailable) {
            // Continue without thumbnail
            setError("Unable to upload thumbnail due to storage configuration. Contest will be created without a thumbnail.")
            // Don't return here, let the form continue submitting
          } else {
            // Use original file name in the path for better organization
            const fileName = `contest_thumbnails/${userId}_${Date.now()}_${thumbnail.name}`
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
          setUploadProgress(null)
          clearTimeout(loadingTimeoutId)
          return
        }
      }

      // Upload resource files to storage if any exist
      if (Object.keys(resourceFiles).length > 0) {
        setUploadProgress(isDraft ? "Uploading assets..." : "Uploading assets (2/2)...")
        try {
          // Check if storage is available first
          const isStorageAvailable = await checkStorageAvailability()

          if (!isStorageAvailable) {
            if (isDraft) {
              // For drafts, just show a warning but continue
              console.warn("Storage not available, continuing with draft save without uploading resources")
            } else {
              setError("File upload is unavailable due to storage configuration. Contest will be created without resources.")
            }
          } else {
            // Track all resource uploads
            const resourceUploadPromises = [];
            const failedUploads = [];

            for (const [name, file] of Object.entries(resourceFiles)) {
              try {
                // Use original file name in the path
                const fileName = `contest_resources/${userId}_${Date.now()}_${file.name}`

                const uploadPromise = supabase.storage
                  .from('contest-assets')
                  .upload(fileName, file)
                  .then(({ data: uploadData, error: uploadError }) => {
                    if (uploadError) {
                      failedUploads.push(name);
                      if (!isDraft) throw new Error(`Failed to upload resource: ${uploadError.message}`);
                      return null;
                    }

                    // getPublicUrl returns an object directly, not a Promise
                    const result = supabase.storage
                      .from('contest-assets')
                      .getPublicUrl(fileName);

                    const resourceUrl = result.data.publicUrl || '';
                    // Update resource URL with the actual storage URL
                    resources[name] = resourceUrl;
                    return resourceUrl;
                  })
                  .catch(err => {
                    console.error(`Error uploading resource ${name}:`, err);
                    failedUploads.push(name);
                    return null;
                  });

                resourceUploadPromises.push(uploadPromise);
              } catch (err) {
                console.error(`Error uploading resource ${name}:`, err);
                failedUploads.push(name);
              }
            }

            // Wait for all uploads to complete
            await Promise.allSettled(resourceUploadPromises);

            // Show warning if some uploads failed but we're in draft mode
            if (failedUploads.length > 0 && isDraft) {
              console.warn(`Some resource uploads failed: ${failedUploads.join(', ')}`);
            }
          }
        } catch (error) {
          console.error("Error handling resource uploads:", error);
          // For drafts, continue despite errors
          if (!isDraft) {
            setError("Failed to upload resources. Please try again.");
            setIsLoading(false);
            setUploadProgress(null);
            clearTimeout(loadingTimeoutId)
            return;
          }
          // Continue with submission using temporary URLs
        }
      }

      // Format dates properly to ensure they're in ISO format (UTC)
      let formattedStartDate = null
      let formattedEndDate = null

      try {
        // For published contests, dates are required and must be formatted
        if (!isDraft) {
          if (startDate && startTime) {
            formattedStartDate = toUTCISOString(startDate, startTime);
            if (!formattedStartDate) throw new Error("Invalid start date/time format");
          }

          if (endDate && endTime) {
            formattedEndDate = toUTCISOString(endDate, endTime);
            if (!formattedEndDate) throw new Error("Invalid end date/time format");
          }
        } else {
          // For drafts, dates are optional and should be null if not provided
          if (startDate && startTime) {
            formattedStartDate = toUTCISOString(startDate, startTime);
          }

          if (endDate && endTime) {
            formattedEndDate = toUTCISOString(endDate, endTime);
          }
        }
      } catch (error) {
        console.error("Error formatting dates:", error)
        // If there's an error formatting dates for a published contest, show an error
        if (!isDraft) {
          setError("There was a problem with the date format. Please check the start and end dates.")
          setIsLoading(false)
          setUploadProgress(null)
          clearTimeout(loadingTimeoutId)
          return
        }
        // For drafts, continue with null dates if there's an error
      }

      // Prepare contest data for submission
      setUploadProgress(isDraft ? "Finalizing draft..." : "Creating contest...")
      const contestData = {
        advertiser_id: userId, // Use userId from auth.getUser()
        title,
        thumbnail_url: thumbnailUrl,
        category,
        platform: "youtube", // Default platform
        brief,
        prizes: prizesArray, // Prize amounts in dollars
        total_prize: prizesArray.reduce((sum, prize) => sum + prize.amount, 0), // Store total in dollars
        rules: { list: rules.split("\n") },
        resources,
        inspiration_links: inspirationLinks,
        subscription_plan: userPlan, // Use subscription_plan instead of price_tier
        winner_count: winnerCount,
        is_draft: isDraft, // Mark as draft
        start_date: formattedStartDate, // Use proper ISO format or null
        end_date: formattedEndDate   // Use proper ISO format or null
        // Note: We do not store status explicitly as it will be calculated by the view
      }

      let responseData, responseError

      if (draftId) {
        // Update existing draft
        const response = await supabase
          .from("contests")
          .update(contestData)
          .eq("id", draftId)
          .select()

        responseData = response.data
        responseError = response.error
      } else {
        // Create new contest
        const response = await supabase
          .from("contests")
          .insert(contestData)
          .select()

        responseData = response.data
        responseError = response.error
      }

      if (responseError) throw responseError

      // Set draft ID if this is a new draft
      if (isDraft && !draftId && responseData && responseData.length > 0) {
        setDraftId(responseData[0].id)
      }

      // Only redirect if not a draft
      if (!isDraft) {
        setUploadProgress("Contest created successfully! Redirecting...");
        // Clear any pending timeouts
        if (prepTimeoutId !== undefined) clearTimeout(prepTimeoutId);
        setTimeout(() => {
          router.push("/dashboard/contests");
        }, 1000);
      } else {
        // Clear resource files after successful draft save to prevent duplicate uploads on next save
        setResourceFiles({});
        // Clear any pending timeouts
        if (prepTimeoutId !== undefined) clearTimeout(prepTimeoutId);
        setIsLoading(false);
        setUploadProgress(null);
        // Show success message for draft
        setSuccess("Draft saved successfully!");
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("Error submitting contest:", err)
      // Clear any pending timeouts
      clearTimeout(loadingTimeoutId)
      if (prepTimeoutId !== undefined) clearTimeout(prepTimeoutId);
      if (err.message && err.message.includes("timestamp with time zone")) {
        setError("Invalid date format. Please make sure all dates and times are properly set.")
      } else {
        setError(`Failed to ${isDraft ? "save draft" : "create contest"}: ${err.message || "Unknown error"}`)
      }
      setIsLoading(false)
      setUploadProgress(null)
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
      setSuccess("External resource added!")
    }
  }

  const removeResource = async (name: string) => {
    try {
      // Get the URL from resources
      const url = resources[name];

      // Only attempt deletion if it's a Supabase storage URL
      if (url && url.includes('supabase.co/storage/v1/object/public/contest-assets/')) {
        // Extract file path from URL
        const filePath = url.split('public/contest-assets/')[1];

        if (filePath) {
          // Delete the file from storage
          const { error } = await supabase.storage
            .from('contest-assets')
            .remove([filePath]);

          if (error) {
            console.error("Error removing file from storage:", error);
          }
        }
      }

      // Remove from state regardless of storage deletion success
      const newResources = { ...resources };
      delete newResources[name];
      setResources(newResources);
    } catch (error) {
      console.error("Error removing resource:", error);
      // Still remove from state even if storage deletion fails
      const newResources = { ...resources };
      delete newResources[name];
      setResources(newResources);
    }
  };

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
    // Don't validate empty inputs to allow users to delete and type new values
    if (value === '') {
      const newWinnerAmounts = [...winnerAmounts]
      newWinnerAmounts[index] = 0 // Set to zero temporarily but don't show validation error
      setWinnerAmounts(newWinnerAmounts)
      updateTotalPrizePool(newWinnerAmounts)
      return
    }

    // Convert from display dollars to cents for storage
    const dollars = parseFloat(value);
    if (!isNaN(dollars)) {
      // Convert dollars to cents for internal storage
      const numValue = Math.round(dollars * 100);

      // Clear previous errors
      setError(null)
      setValidationError(null)

      // Update the value immediately to improve responsiveness
      const newWinnerAmounts = [...winnerAmounts]
      newWinnerAmounts[index] = numValue
      setWinnerAmounts(newWinnerAmounts)

      // Update total prize pool
      updateTotalPrizePool(newWinnerAmounts)

      // Show validation errors only after a complete value is entered
      if (numValue < MIN_PRIZE_PER_WINNER) {
        setValidationError(`Prize amount for Winner ${index + 1} cannot be less than ${formatCurrency(MIN_PRIZE_PER_WINNER)}`)
      } else if (numValue > MAX_PRIZE_PER_WINNER) {
        setValidationError(`Prize amount for Winner ${index + 1} cannot exceed ${formatCurrency(MAX_PRIZE_PER_WINNER)}`)
      }
    }
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
      // First, get the authenticated user properly
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error("Authentication error:", userError);
        setStorageAvailable(false);
        return false;
      }

      // Check if we can access the storage bucket
      const { data, error } = await supabase.storage.getBucket('contest-assets');

      if (error) {
        console.error("Storage access error:", error);

        // Instead of trying to create the bucket, which requires admin privileges,
        // just set storage as unavailable
        setStorageAvailable(false);

        // Only log the error instead of attempting to create the bucket
        console.log("Storage bucket 'contest-assets' is not available. Please contact administrator.");
        return false;
      }

      // Bucket exists
      setStorageAvailable(true);
      return true;
    } catch (error) {
      console.error("Storage check error:", error);
      setStorageAvailable(false);
      return false;
    }
  }

  // New function to get the current user's subscription plan
  const getUserPlan = async () => {
    if (!user) return;

    try {
      // Use getUser() instead of relying on session data
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        console.error("Authentication error in getUserPlan:", authError);
        setUserPlan(null);
        return;
      }

      const userId = authData.user.id;

      // First try to get the subscription from a dedicated subscriptions table
      try {
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from("subscriptions")
          .select("plan_id, status")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!subscriptionError && subscriptionData?.plan_id) {
          setUserPlan(subscriptionData.plan_id);
          return;
        }
      } catch (err) {
        console.error("Error fetching subscription:", err);
      }

      // If that doesn't work, try the users table
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("subscription_plan")
          .eq("id", userId)
          .single();

        if (!userError && userData?.subscription_plan) {
          setUserPlan(userData.subscription_plan);
          return;
        }
      } catch (err) {
        console.error("Error fetching user subscription plan:", err);
      }

      // If no plan is found in either table, check advertiser_profiles
      try {
        const { data: advertiserData, error: advertiserError } = await supabase
          .from("advertiser_profiles")
          .select("subscription_tier")
          .eq("user_id", userId)
          .single();

        if (!advertiserError && advertiserData?.subscription_tier) {
          setUserPlan(advertiserData.subscription_tier);
          return;
        }
      } catch (err) {
        console.error("Error fetching advertiser profile:", err);
      }

      // If we couldn't find a subscription anywhere, default to 'bronze'
      setUserPlan('bronze');
    } catch (error) {
      console.error("Error in getUserPlan:", error);
      setUserPlan('bronze'); // Default to bronze plan on error
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
    try {
      // Use getUser instead of session
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        console.error("Authentication error in loadDraftData:", authError);
        return;
      }

      const userId = authData.user.id;

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
          .eq("advertiser_id", userId) // Security check to make sure user owns this draft
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
        .eq("advertiser_id", userId)
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

    // Convert UTC dates to local timezone for display
    if (draft.start_date) {
      const { dateString, timeString } = toLocalDateTimeStrings(draft.start_date);
      setStartDate(dateString);
      setStartTime(timeString);
    }

    if (draft.end_date) {
      const { dateString, timeString } = toLocalDateTimeStrings(draft.end_date);
      setEndDate(dateString);
      setEndTime(timeString);
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
    // Modified to handle storage errors more gracefully
    const initializeData = async () => {
      try {
        await checkStorageAvailability();
        await getUserPlan();
        await loadDraftData();

        // Set initial default prize allocations for the default 3 winners
        updateTotalPrizePool();
      } catch (error) {
        console.error("Error initializing data:", error);
        // Continue with the application even if there are errors
        // as most functionality will still work without storage
      }
    };

    initializeData();
  }, [user]); // Re-run when user changes

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
          <p className="mb-4">For contests with budgets over {formatCurrency(MAX_CONTEST_BUDGET)}, we recommend speaking with our team for personalized guidance and support.</p>
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
          <p className="mb-4">For contests with budgets over {formatCurrency(HIGH_BUDGET_THRESHOLD)}, we recommend reaching out to our team for personalized guidance and support.</p>
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
                    <p className="text-sm text-gray-500">{formatCurrency(currentPlan.price)}/month</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Max Winners Per Contest:</span>
                    <span className="font-medium">{planFeatures.maxWinnersPerContest === Infinity ? 'Unlimited' : planFeatures.maxWinnersPerContest}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Budget Per Contest:</span>
                    <span className="font-medium">{formatCurrency(planFeatures.minContestBudget)}</span>
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
                <span className="text-lg font-bold">{formatCurrency(totalPrizePool)}</span>
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
                    step="0.01"
                    value={(winnerAmounts[i] || MIN_PRIZE_PER_WINNER) / 100}
                    onChange={(e) => handleWinnerAmountChange(i, e.target.value)}
                    min={MIN_PRIZE_PER_WINNER / 100}
                    max={MAX_PRIZE_PER_WINNER / 100}
                    className="w-48"
                  />
                  <div className="text-sm text-gray-500">
                    <span>Min: {formatCurrency(MIN_PRIZE_PER_WINNER)}</span>
                  </div>
                </div>
              ))}
            </div>

            {totalPrizePool < planFeatures.minContestBudget && (
              <Alert className="mt-2">
                <AlertDescription>
                  The minimum prize pool for your {userPlan || 'current'} plan is {formatCurrency(planFeatures.minContestBudget)}. Please increase your prize amounts.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </>
    );
  };

  // Modify the clearResources function
  const clearResources = async () => {
    // Get references to all resource URLs
    const resourceUrls = Object.values(resources);

    // Only proceed if there are resources to delete
    if (resourceUrls.length > 0) {
      try {
        for (const url of resourceUrls) {
          // Only attempt deletion if it's a Supabase storage URL
          if (url && url.includes('supabase.co/storage/v1/object/public/contest-assets/')) {
            // Extract file path from URL
            const filePath = url.split('public/contest-assets/')[1];

            if (filePath) {
              // Delete the file from storage
              await supabase.storage
                .from('contest-assets')
                .remove([filePath]);
            }
          }
        }
      } catch (error) {
        console.error("Error removing resources from storage:", error);
      }
    }

    // Clear resources state
    setResources({});
  };

  // Create a utility function to clean up all contest assets
  const cleanupContestAssets = async (contestId: string) => {
    try {
      // Get prefix for files related to this contest
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const userId = authData.user.id;

      // For contest resources
      try {
        // List files in the contest_resources folder
        const { data: resourceFiles, error: resourceError } = await supabase.storage
          .from('contest-assets')
          .list(`contest_resources`, {
            search: `${userId}_${contestId}`
          });

        if (resourceError) {
          console.error("Error listing resource files:", resourceError);
        } else if (resourceFiles && resourceFiles.length > 0) {
          // Delete all found resource files
          const resourceFilePaths = resourceFiles.map(file => `contest_resources/${file.name}`);
          await supabase.storage.from('contest-assets').remove(resourceFilePaths);
        }
      } catch (err) {
        console.error("Error deleting resource files:", err);
      }

      // For thumbnails
      try {
        // List files in the contest_thumbnails folder
        const { data: thumbnailFiles, error: thumbnailError } = await supabase.storage
          .from('contest-assets')
          .list(`contest_thumbnails`, {
            search: `${userId}_${contestId}`
          });

        if (thumbnailError) {
          console.error("Error listing thumbnail files:", thumbnailError);
        } else if (thumbnailFiles && thumbnailFiles.length > 0) {
          // Delete all found thumbnail files
          const thumbnailFilePaths = thumbnailFiles.map(file => `contest_thumbnails/${file.name}`);
          await supabase.storage.from('contest-assets').remove(thumbnailFilePaths);
        }
      } catch (err) {
        console.error("Error deleting thumbnail files:", err);
      }
    } catch (error) {
      console.error("Error cleaning up contest assets:", error);
    }
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
                  {isLoading && uploadProgress && uploadProgress.includes("draft") ? (
                    <div className="flex items-center gap-2">
                      <span>{uploadProgress}</span>
                      <Progress value={uploadProgress ? 70 : 0} className="w-10 h-2" />
                    </div>
                  ) : (
                    "Save Draft"
                  )}
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
                  {isLoading && uploadProgress && uploadProgress.includes("draft") ? (
                    <div className="flex items-center gap-2">
                      <span>{uploadProgress}</span>
                      <Progress value={uploadProgress ? 70 : 0} className="w-10 h-2" />
                    </div>
                  ) : (
                    "Save Draft"
                  )}
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
                  You can upload assets and add external links.
                </p>

                {validationError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="mb-4 bg-green-50 border-green-200 text-green-700">
                    <Check className="h-4 w-4 mr-2" />
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

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

                    {/* File Uploader - Exactly like thumbnail uploader */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4">
                      {resourceFilePreview ? (
                        <div className="relative">
                          {resourceFilePreview.startsWith('data:image') ? (
                            <img
                              src={resourceFilePreview}
                              alt="Resource preview"
                              className="mx-auto max-h-64 object-contain"
                            />
                          ) : (
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
                              {/* Rest of the file type renderers */}
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
                              {/* Office document icon */}
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
                            <Upload className="h-4 w-4 mr-2" /> Upload
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

                    {/* Add Asset Button - Shows when file is selected */}
                    {resourceFile && resourceDescription && (
                      <Button
                        type="button"
                        onClick={addFileResource}
                        className="w-full mt-4"
                      >
                        Add Asset
                      </Button>
                    )}
                  </div>

                  {/* External Resource Link - Allow multiple external links */}
                  <div className="border rounded-lg p-4 mt-6">
                    <h4 className="text-md font-medium mb-2">Add External Resource Links</h4>
                    <p className="text-sm text-gray-500 mb-4">You can add any number of external resource links.</p>

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

                    {/* List of added external resources */}
                    {Object.entries(resources).length > 0 && (
                      <div className="mt-4 border-t pt-4">
                        <h5 className="font-medium mb-2">Added Resources:</h5>
                        <ul className="space-y-2">
                          {Object.entries(resources).map(([name, url]) => (
                            <li key={name} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <div>
                                <p className="font-medium">{name}</p>
                                <p className="text-sm text-gray-500 truncate max-w-xs">{url}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeResource(name)}
                                className="text-red-500"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
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
                  {isLoading && uploadProgress && uploadProgress.includes("draft") ? (
                    <div className="flex items-center gap-2">
                      <span>{uploadProgress}</span>
                      <Progress value={uploadProgress ? 70 : 0} className="w-10 h-2" />
                    </div>
                  ) : (
                    "Save Draft"
                  )}
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
                  {isLoading && uploadProgress && uploadProgress.includes("draft") ? (
                    <div className="flex items-center gap-2">
                      <span>{uploadProgress}</span>
                      <Progress value={uploadProgress ? 70 : 0} className="w-10 h-2" />
                    </div>
                  ) : (
                    "Save Draft"
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isLoading || !startDate || !startTime || !endDate || !endTime}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isLoading && uploadProgress && !uploadProgress.includes("draft") ? (
                    <div className="flex items-center gap-2">
                      <span>{uploadProgress}</span>
                      <Progress
                        value={
                          uploadProgress.includes("Preparing") ? 15 :
                            uploadProgress.includes("Validating") ? 25 :
                              uploadProgress.includes("1/2") ? 40 :
                                uploadProgress.includes("2/2") ? 60 :
                                  uploadProgress.includes("Creating") ? 80 :
                                    uploadProgress.includes("Redirecting") ? 100 :
                                      10
                        }
                        className="w-10 h-2"
                      />
                    </div>
                  ) : (
                    "Create Contest"
                  )}
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

