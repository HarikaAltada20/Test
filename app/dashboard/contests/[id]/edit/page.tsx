"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Image, Trash, Upload, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { toLocalDateTimeStrings, toUTCISOString } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency-utils"
import { DEFAULT_PRIZE_ALLOCATIONS, MAX_PRIZE_PER_WINNER, MIN_PRIZE_PER_WINNER, subscriptionPlans } from "@/constants/subscriptionPlans"

type PlanFeatures = {
    maxActiveContests: number;
    minContestBudget: number;
    maxWinnersPerContest: number;
    commisionPercentage: number; // Make sure this matches your DB json_features key
}

type SubscriptionPlan = {
    id: string;
    name: string;
    price: number;
    features: PlanFeatures;
}

type ContestData = {
    id: string
    title: string
    category: string
    thumbnail_url: string | null
    brief: string | null
    rules: { list: string[] } | null
    start_date: string | null
    end_date: string | null
    prizes: { position: number; amount: number }[]
    total_prize: number
    winner_count: number
    inspiration_links: string[]
    resources: Record<string, string>
    status: string
}

export default function EditContestPage() {
    const params = useParams()
    const contestId = params.id as string
    const router = useRouter()
    const { user } = useAuth()
    const supabase = createSupabaseClient()

    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false); // Separate state for submission loading
    const [error, setError] = useState<string | null>(null)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [contest, setContest] = useState<ContestData | null>(null)

    // State for subscription plans and user plan
    const [dbSubscriptionPlans, setDbSubscriptionPlans] = useState<SubscriptionPlan[]>([])
    const [isPlansLoading, setIsPlansLoading] = useState(true)
    const [userPlan, setUserPlan] = useState<string | null>(null)
    const [isUserPlanLoading, setIsUserPlanLoading] = useState(true);

    const [title, setTitle] = useState("")
    const [category, setCategory] = useState<string>("technology")
    const [brief, setBrief] = useState("")
    const [rules, setRules] = useState("")
    const [startDate, setStartDate] = useState<string>("")
    const [startTime, setStartTime] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [endTime, setEndTime] = useState<string>("")
    const [winnerCount, setWinnerCount] = useState<number>(3)
    const [winnerAmounts, setWinnerAmounts] = useState<number[]>([500, 300, 200])
    const [inspirationLinks, setInspirationLinks] = useState<string[]>([])
    const [newInspirationLink, setNewInspirationLink] = useState("")
    const [thumbnail, setThumbnail] = useState<File | null>(null)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Fetch subscription plans from the database
    const fetchSubscriptionPlans = async () => {
        setIsPlansLoading(true);
        setError(null);
        try {
            const { data: plansData, error: plansError } = await supabase
                .from("subscription_plans")
                .select("id, name, price, json_features");

            if (plansError) throw plansError;

            if (plansData) {
                const mappedPlans: SubscriptionPlan[] = plansData.map((plan: any, index: number) => ({
                    id: plan.id,
                    name: plan.name,
                    price: plan.price,
                    features: {
                        maxActiveContests: plan.json_features?.maxActiveContests,
                        minContestBudget: plan.json_features?.minContestBudget,
                        maxWinnersPerContest: plan.json_features?.maxWinnersPerContest,
                        commisionPercentage: plan.json_features?.commisionPercentage
                    }
                }));
                setDbSubscriptionPlans(mappedPlans);
            } else {
                setDbSubscriptionPlans([]);
            }
        } catch (error: any) {
            console.error("Error fetching subscription plans:", error);
            setError(`Failed to load subscription plans: ${error.message}. Using defaults.`);
            setDbSubscriptionPlans([]);
        } finally {
            setIsPlansLoading(false);
        }
    };

    // Fetch the current user's subscription plan
    const getUserPlan = async () => {
        if (!user) return;
        setIsUserPlanLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData.user) {
                throw new Error("Authentication error");
            }
            const userId = authData.user.id;

            const { data: advertiserData, error: advertiserError } = await supabase
                .from("advertiser_profiles")
                .select("subscription_plan")
                .eq("id", userId)
                .single();

            if (!advertiserError && advertiserData?.subscription_plan) {
                setUserPlan(advertiserData.subscription_plan);
            } else {
                // Default to free plan if not found or error (assuming ID exists)
                const freePlanId = dbSubscriptionPlans.find(p => p.name.toLowerCase() === 'free')?.id || 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198'; // Fallback hardcoded ID
                setUserPlan(freePlanId);
                if (advertiserError && advertiserError.code !== 'PGRST116') { // Ignore 'single row not found'
                    console.error("Error fetching advertiser profile:", advertiserError);
                }
            }
        } catch (error) {
            console.error("Error in getUserPlan:", error);
            const freePlanId = dbSubscriptionPlans.find(p => p.name.toLowerCase() === 'free')?.id || 'a28ef5c0-3391-44a1-a9ef-f9b999ff0198'; // Fallback hardcoded ID
            setUserPlan(freePlanId); // Default to free plan on error
        } finally {
            setIsUserPlanLoading(false);
        }
    };

    // Get features for a given plan ID
    const getPlanFeatures = (planId: string | null): PlanFeatures => {
        const defaultFreePlanFeatures: PlanFeatures = subscriptionPlans[0].features

        if (isPlansLoading || dbSubscriptionPlans.length === 0) {
            return defaultFreePlanFeatures;
        }

        if (!planId) {
            // Find free plan by name if planId is null
            const freePlan = dbSubscriptionPlans.find(p => p.name.toLowerCase() === 'free');
            return freePlan?.features || defaultFreePlanFeatures;
        }

        const plan = dbSubscriptionPlans.find((p: SubscriptionPlan) => p.id === planId);

        if (!plan) {
            const freePlan = dbSubscriptionPlans.find(p => p.name.toLowerCase() === 'free');
            return freePlan?.features || dbSubscriptionPlans[0]?.features || defaultFreePlanFeatures;
        }
        return plan.features;
    };

    // Fetch contest data and plan data
    useEffect(() => {
        async function fetchInitialData() {
            setIsLoading(true); // General loading state for the page
            await fetchSubscriptionPlans(); // Fetch plans first

            if (!user) {
                setIsLoading(false); // Stop loading if no user
                setError("Please log in to edit contests.");
                return;
            }

            // Fetch user plan *after* plans are loaded to find default free plan ID if needed
            await getUserPlan();

            // Now fetch contest data
            try {
                const { data, error: contestError } = await supabase
                    .from("contests")
                    .select("*")
                    .eq("id", contestId)
                    .eq("advertiser_id", user.id)
                    .single();

                if (contestError) throw contestError;

                if (data) {
                    const now = new Date();
                    const startDate = data.start_date ? new Date(data.start_date) : null;
                    const endDate = data.end_date ? new Date(data.end_date) : null;
                    const isLive = startDate && startDate <= now && (!endDate || endDate > now);
                    const isEnded = endDate && endDate <= now;

                    if (isLive || isEnded) {
                        setError("This contest is already live or has ended and cannot be edited.");
                        // Don't set contest data if editing is disallowed
                    } else {
                        setContest(data as ContestData);
                        setTitle(data.title || "");
                        setCategory(data.category || "technology");
                        setBrief(data.brief || "");
                        setRules(data.rules?.list?.join("\n") || "");

                        if (data.start_date) {
                            const { dateString, timeString } = toLocalDateTimeStrings(data.start_date);
                            setStartDate(dateString);
                            setStartTime(timeString);
                        }
                        if (data.end_date) {
                            const { dateString, timeString } = toLocalDateTimeStrings(data.end_date);
                            setEndDate(dateString);
                            setEndTime(timeString);
                        }
                        if (data.prizes && Array.isArray(data.prizes)) {
                            setWinnerCount(data.prizes.length);
                            setWinnerAmounts(data.prizes.map((prize: { amount: number }) => prize.amount));
                        } else {
                            // Set defaults if no prize data exists
                            setWinnerCount(3);
                            setWinnerAmounts([5000, 3000, 2000]); // Example defaults
                        }
                        // Ensure inspiration_links is always an array
                        setInspirationLinks(Array.isArray(data.inspiration_links) ? data.inspiration_links : []);
                        setThumbnailPreview(data.thumbnail_url || null);
                    }
                } else {
                    setError("Contest not found or you don't have permission to edit it.");
                }
            } catch (error: any) {
                if (error.code === 'PGRST116') { // Handle case where contest ID doesn't exist
                    setError("Contest not found.");
                } else {
                    setError(`Failed to load contest: ${error.message}`);
                }
                setContest(null); // Ensure contest is null on error
            } finally {
                setIsLoading(false); // Stop general loading
            }
        }

        fetchInitialData();
    }, [contestId, user, supabase]); // Rerun if user or contestId changes

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
    }, [startDate, startTime, endDate, endTime]);

    // Form submission with additional validation
    const handleSubmit = async () => {
        setError(null);
        setValidationError(null);
        setIsSubmitting(true); // Use separate submitting state

        let submitTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

        // Add a timeout to prevent hanging in case of unexpected delays
        submitTimeoutId = setTimeout(() => {
            if (isLoading) {
                console.log("Edit submission taking longer than expected...");
                // Keep the UI responsive by updating state but don't stop the operation
                setValidationError("Operation is taking longer than expected. Please wait...");
            }
        }, 5000);

        if (!user) {
            setError("You must be logged in to update a contest");
            setIsSubmitting(false);
            return;
        }

        if (!contest) {
            setError("Contest data not loaded. Cannot save changes.");
            setIsSubmitting(false);
            return;
        }

        // Get current plan features for validation
        const planFeatures = getPlanFeatures(userPlan);
        const totalPrizePool = winnerAmounts.reduce((sum, amount) => sum + (amount || 0), 0);

        try {
            // Validate against plan limits
            if (winnerCount > planFeatures.maxWinnersPerContest) {
                setValidationError(`Your current plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners.`);
                setIsSubmitting(false);
                return;
            }
            if (totalPrizePool < planFeatures.minContestBudget) {
                setValidationError(`Your current plan requires a minimum total prize pool of ${formatCurrency(planFeatures.minContestBudget)}.`);
                setIsSubmitting(false);
                return;
            }
            // Validate individual prize amounts (min $5)
            for (let i = 0; i < winnerCount; i++) {
                if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
                    setValidationError(`Prize for Winner ${i + 1} must be at least ${formatCurrency(MIN_PRIZE_PER_WINNER)}`);
                    setIsSubmitting(false);
                    return;
                }
                if (winnerAmounts[i] > MAX_PRIZE_PER_WINNER) {
                    setValidationError(`Prize for Winner ${i + 1} cannot exceed ${formatCurrency(MAX_PRIZE_PER_WINNER)}`);
                    setIsSubmitting(false);
                    return;
                }
            }

            // Validate dates and times - use local timezone for validation
            if (startDate && startTime && endDate && endTime) {
                try {
                    // Create local date objects in user's timezone
                    const startDateTime = new Date(`${startDate}T${startTime}`);
                    const endDateTime = new Date(`${endDate}T${endTime}`);
                    const now = new Date();

                    // Make sure dates are valid
                    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                        setValidationError("Invalid date or time format. Please check your entries.");
                        setIsSubmitting(false);
                        return;
                    }

                    if (startDateTime < now) {
                        setValidationError("Contest start time must be in the future");
                        setIsSubmitting(false);
                        return;
                    }

                    if (endDateTime <= startDateTime) {
                        setValidationError("Contest end time must be after the start time");
                        setIsSubmitting(false);
                        return;
                    }

                    // Check if duration is at least 1 day (24 hours)
                    const durationMs = endDateTime.getTime() - startDateTime.getTime();
                    const oneDayMs = 24 * 60 * 60 * 1000;
                    if (durationMs < oneDayMs) {
                        setValidationError("Contest duration must be at least 1 day");
                        setIsSubmitting(false);
                        return;
                    }
                } catch (error) {
                    console.error("Date validation error:", error);
                    setValidationError("There was an error with the date/time format. Please check your entries.");
                    setIsSubmitting(false);
                    return;
                }
            } else {
                setValidationError("Contest start and end dates/times are required");
                setIsSubmitting(false);
                return;
            }

            // Format prizes array
            const prizesArray = []
            for (let i = 0; i < winnerCount; i++) {
                prizesArray.push({
                    position: i + 1,
                    amount: (winnerAmounts[i] || 0)
                })
            }

            // Calculate total prize
            let totalPrize = 0
            for (let i = 0; i < winnerCount; i++) {
                totalPrize += winnerAmounts[i] || 0
            }

            // Upload new thumbnail if present
            let thumbnailUrl = contest.thumbnail_url // Use loaded contest data
            if (thumbnail) {
                try {
                    const fileName = `contest_thumbnails/${user.id}_${Date.now()}`
                    const { error: uploadError } = await supabase.storage
                        .from('contest-assets')
                        .upload(fileName, thumbnail)

                    if (uploadError) {
                        throw new Error(`Failed to upload thumbnail: ${uploadError.message}`)
                    }

                    const { data: publicUrlData } = supabase.storage
                        .from('contest-assets')
                        .getPublicUrl(fileName)

                    thumbnailUrl = publicUrlData.publicUrl
                } catch (error: any) {
                    setError(`Thumbnail upload failed: ${error.message}`)
                    setIsSubmitting(false)
                    return
                }
            }

            // Format dates properly to ensure they're in ISO format (UTC)
            let formattedStartDate = null
            let formattedEndDate = null

            if (startDate && startTime) {
                formattedStartDate = toUTCISOString(startDate, startTime);
                if (!formattedStartDate) throw new Error("Invalid start date/time format");
            }

            if (endDate && endTime) {
                formattedEndDate = toUTCISOString(endDate, endTime);
                if (!formattedEndDate) throw new Error("Invalid end date/time format");
            }

            // Update contest
            const { error } = await supabase
                .from("contests")
                .update({
                    title,
                    thumbnail_url: thumbnailUrl,
                    category,
                    brief,
                    prizes: prizesArray,
                    total_prize: totalPrize,
                    rules: { list: rules.split("\n") },
                    inspiration_links: inspirationLinks,
                    winner_count: winnerCount,
                    start_date: formattedStartDate, // Use ISO format for UTC
                    end_date: formattedEndDate // Use ISO format for UTC
                })
                .eq("id", contestId)
                .eq("advertiser_id", user.id)

            if (error) throw error

            router.push(`/dashboard/contests/${contestId}`)
            if (submitTimeoutId !== undefined) clearTimeout(submitTimeoutId);
        } catch (err: any) {
            if (submitTimeoutId !== undefined) clearTimeout(submitTimeoutId);
            setError(err.message || "Failed to update contest")
        } finally {
            setIsSubmitting(false) // Ensure submitting state is always reset
        }
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

    const addInspirationLink = () => {
        if (newInspirationLink && !inspirationLinks.includes(newInspirationLink)) {
            setInspirationLinks([...inspirationLinks, newInspirationLink])
            setNewInspirationLink("")
        }
    }

    const removeInspirationLink = (link: string) => {
        setInspirationLinks(inspirationLinks.filter(l => l !== link))
    }

    if (isLoading || isPlansLoading || isUserPlanLoading) { // Check all loading states
        return (
            <div className="flex items-center justify-center h-full">
                <p>Loading contest data...</p>
            </div>
        )
    }

    // Use the error state to display issues loading contest or plans
    if (error) {
        return (
            <div className="container mx-auto py-8">
                <div className="flex items-center gap-2 mb-6">
                    <Button variant="ghost" size="icon" asChild>
                        {/* Link back to contests list if contest ID is problematic */}
                        <Link href={contestId ? `/dashboard/contests/${contestId}` : "/dashboard/contests"}>
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">Edit Contest</h1>
                </div>
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <div className="flex justify-center">
                    <Button
                        onClick={() => router.push(contestId ? `/dashboard/contests/${contestId}` : "/dashboard/contests")}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                        {error.includes("live or has ended") ? "Return to Contest" : "Back to Contests"}
                    </Button>
                </div>
            </div>
        )
    }

    // Specific check if contest data itself failed to load after loading states are false
    if (!contest) {
        return (
            <div className="container mx-auto py-8">
                <div className="flex items-center gap-2 mb-6">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/contests">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">Edit Contest</h1>
                </div>
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>Failed to load contest data. Please try again or go back.</AlertDescription>
                </Alert>
                <div className="flex justify-center">
                    <Button onClick={() => router.push("/dashboard/contests")} className="bg-rose-600 hover:bg-rose-700 text-white">
                        Back to Contests
                    </Button>
                </div>
            </div>
        );
    }

    // Get plan features for the current user for UI elements
    const planFeatures = getPlanFeatures(userPlan);
    const totalPrizePool = winnerAmounts.reduce((sum, amount) => sum + (amount || 0), 0);

    return (
        <div className="container mx-auto py-8">
            <div className="flex items-center gap-2 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/dashboard/contests/${contestId}`}>
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <h1 className="text-2xl font-bold">Edit Contest</h1>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {validationError && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{validationError}</AlertDescription>
                </Alert>
            )}

            <Card className="mx-auto max-w-4xl">
                <CardHeader>
                    <CardTitle>Edit Contest Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Contest title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Game Of Creators! Get Paid to Create"
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
                                            {thumbnail?.name || "Current thumbnail"}
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

                    <div className="space-y-2">
                        <Label htmlFor="brief">Brief</Label>
                        <Textarea
                            id="brief"
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            placeholder="Game Of Creators is the app that pays creators! We help creators connect with brands & get paid to create content!"
                            rows={6}
                        />
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium mb-2">Inspiration Links</h3>
                        <div className="border rounded-md p-4 bg-gray-50">
                            {inspirationLinks.length > 0 && (
                                <ul className="space-y-2 mb-4">
                                    {inspirationLinks.map((link, index) => (
                                        <li key={index} className="flex items-center justify-between text-sm">
                                            <a
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline flex items-center mr-2"
                                            >
                                                <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                                                <span className="truncate">{link}</span>
                                            </a>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeInspirationLink(link)}
                                                className="text-red-500 h-6 w-6 p-0 flex-shrink-0"
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Add inspiration link (e.g., TikTok, YouTube)"
                                    value={newInspirationLink}
                                    onChange={(e) => setNewInspirationLink(e.target.value)}
                                />
                                <Button onClick={addInspirationLink} disabled={!newInspirationLink}>Add</Button>
                            </div>
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

                    <Separator />

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

                        <p className="text-sm text-gray-500 mt-1">
                            Contest duration must be at least 1 day.
                        </p>
                    </div>

                    <Separator />

                    {/* Prize Distribution */}
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
                                        onClick={() => {
                                            if (winnerCount > 1) {
                                                const newCount = winnerCount - 1;
                                                setWinnerCount(newCount);
                                                const newAmounts = [...winnerAmounts].slice(0, newCount);
                                                setWinnerAmounts(newAmounts);
                                            }
                                        }}
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
                                        onClick={() => {
                                            const newCount = winnerCount + 1;
                                            // Use planFeatures limit
                                            if (newCount <= planFeatures.maxWinnersPerContest) {
                                                setWinnerCount(newCount);
                                                const newAmounts = [...winnerAmounts];
                                                const position = newCount;
                                                newAmounts.push(DEFAULT_PRIZE_ALLOCATIONS[position as keyof typeof DEFAULT_PRIZE_ALLOCATIONS] || MIN_PRIZE_PER_WINNER);
                                                setWinnerAmounts(newAmounts);
                                                setValidationError(null); // Clear potential previous errors
                                            } else {
                                                // Optionally show a temporary message or rely on validationError state
                                                setValidationError(`Your plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners.`);
                                            }
                                        }}
                                        // Disable based on planFeatures limit
                                        disabled={winnerCount >= planFeatures.maxWinnersPerContest}
                                    >
                                        +
                                    </Button>
                                </div>
                                <div className="text-sm text-gray-500">
                                    {/* Display planFeatures limit */}
                                    <span>Max: {planFeatures.maxWinnersPerContest}</span>
                                </div>
                            </div>

                            {Array.from({ length: winnerCount }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 mb-2">
                                    <Label className="w-48">Winner {i + 1}</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={(winnerAmounts[i] || MIN_PRIZE_PER_WINNER) / 100}
                                        onChange={(e) => {
                                            const inputValue = e.target.value;

                                            // Allow empty input for typing new values
                                            if (inputValue === '') {
                                                const newAmounts = [...winnerAmounts];
                                                newAmounts[i] = 0; // Temporarily set to 0
                                                setWinnerAmounts(newAmounts);
                                                return;
                                            }

                                            // Convert from display dollars to cents for storage
                                            const dollars = parseFloat(inputValue);

                                            // Only validate if we have a proper number
                                            if (!isNaN(dollars)) {
                                                // Convert to cents and round to avoid floating point issues
                                                const value = Math.round(dollars * 100);

                                                // Always update the value first for responsiveness
                                                const newAmounts = [...winnerAmounts];
                                                newAmounts[i] = value;
                                                setWinnerAmounts(newAmounts);

                                                // Show validation messages after updating
                                                if (value < MIN_PRIZE_PER_WINNER) {
                                                    setValidationError(`Prize amount cannot be less than ${formatCurrency(MIN_PRIZE_PER_WINNER)}`);
                                                } else if (value > MAX_PRIZE_PER_WINNER) {
                                                    setValidationError(`Prize amount cannot exceed ${formatCurrency(MAX_PRIZE_PER_WINNER)}`);
                                                } else {
                                                    setValidationError(null);
                                                }
                                            }
                                        }}
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
                        {/* Add validation message for minimum total prize pool */}
                        {totalPrizePool < planFeatures.minContestBudget && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertDescription>
                                    The minimum prize pool for your current plan is {formatCurrency(planFeatures.minContestBudget)}. Please increase prize amounts.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isSubmitting} // Disable during submission
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !!validationError} // Disable during submission or if validation errors exist
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
} 