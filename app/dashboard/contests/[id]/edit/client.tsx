"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Image, Trash, Upload, ExternalLink, Check, Crown, Info, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { toLocalDateTimeStrings, toUTCISOString } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency-utils"
import { DEFAULT_PRIZE_ALLOCATIONS, MAX_PRIZE_PER_WINNER, MIN_PRIZE_PER_WINNER, subscriptionPlans } from "@/constants/subscriptionPlans"
import { createClient } from "@/utils/supabase/client"
import { UserResponse } from "@supabase/supabase-js"
import { useToast } from "@/hooks/use-toast"
import dynamic from 'next/dynamic'

// Dynamically import the Novel editor
const NovelEditor = dynamic(
    () => import('@/components/novel-editor'),
    { ssr: false }
)

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

type CpmContestDetails = {
    cpm_rate_usd: number;
    min_views?: number | null;
    max_views?: number | null;
    total_budget: number;
    budget_spent?: number;
    terms_conditions: string;
    tiered_payouts?: any[];
};

type LeaderboardContestDetails = {
    prizes: { position: number; amount: number }[];
    total_prize: number;
    winner_count: number;
};

type ContestData = {
    id: string;
    title: string;
    category: string;
    platform?: string;
    thumbnail_url: string | null;
    brief: string | null;
    brief_html?: string | null;
    brief_json?: any | null;
    rules: { list: string[] } | null;
    start_date: string | null;
    end_date: string | null;
    inspiration_links: string[] | string | null; // Allow for parsing
    resources: Record<string, string> | null;
    status: string;
    advertiser_id?: string; // Added, ensure it's selected if needed
    contest_type: "leaderboard" | "cpm" | null;
    contest_based_details: {
        cpm_contest?: CpmContestDetails;
        leaderboard_contest?: LeaderboardContestDetails;
    } | null;
    // Moderation fields
    moderation_status: string;
    rejection_reason: string | null;
    // Old fields to be phased out or mapped from contest_based_details
    prizes?: { position: number; amount: number }[];
    total_prize?: number;
    winner_count?: number;
};

export default function EditContestPage({ user, contestId, datesOnly = false }: { user: UserResponse["data"]["user"], contestId: string, datesOnly?: boolean }) {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()

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

    // Common contest fields
    const [title, setTitle] = useState("")
    const [category, setCategory] = useState<string>("technology") // Or consider platform if that's more accurate
    const [briefHtml, setBriefHtml] = useState("")
    const [briefJson, setBriefJson] = useState<any>(null)
    const [rulesHtml, setRulesHtml] = useState("")
    const [rulesJson, setRulesJson] = useState<any>(null)
    const [showRulesPreview, setShowRulesPreview] = useState(false)
    const [startDate, setStartDate] = useState<string>("")
    const [startTime, setStartTime] = useState<string>("")
    const [endDate, setEndDate] = useState<string>("")
    const [endTime, setEndTime] = useState<string>("")
    const [inspirationLinks, setInspirationLinks] = useState<string[]>([])
    const [newInspirationLink, setNewInspirationLink] = useState("")
    const [thumbnail, setThumbnail] = useState<File | null>(null)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const richTextEditorRef = useRef<any>(null)
    const rulesRichTextEditorRef = useRef<any>(null)

    // Contest Type and Specific Details
    const [contestType, setContestType] = useState<"leaderboard" | "cpm" | null>(null);

    // Leaderboard specific
    const [winnerCount, setWinnerCount] = useState<number>(3)
    const [winnerAmounts, setWinnerAmounts] = useState<number[]>([500, 300, 200]) // Note: these amounts are in cents if formatCurrency expects cents

    // CPM specific
    const [cpmRate, setCpmRate] = useState<number | string>(""); // Store as string for input, parse to number for saving
    const [minViews, setMinViews] = useState<number | string>("");
    const [maxViews, setMaxViews] = useState<number | string>("");
    const [totalBudget, setTotalBudget] = useState<number | string>("");
    const [termsConditions, setTermsConditions] = useState<string>("");

    // Resources State Variables
    const [resources, setResources] = useState<Record<string, string>>({});
    const [resourceFiles, setResourceFiles] = useState<Record<string, File>>({}); // Stores files to be uploaded
    const [newResourceUrl, setNewResourceUrl] = useState("");
    const [resourceFile, setResourceFile] = useState<File | null>(null);
    const [resourceFilePreview, setResourceFilePreview] = useState<string | null>(null);
    const [resourceDescription, setResourceDescription] = useState("");
    const [externalResourceDescription, setExternalResourceDescription] = useState("");
    const resourceFileRef = useRef<HTMLInputElement>(null);
    const [resourceSuccess, setResourceSuccess] = useState<string | null>(null);
    const [resourceError, setResourceError] = useState<string | null>(null);

    // State for bottom error display
    const [formFeedback, setFormFeedback] = useState<string | null>(null);
    const [formFeedbackType, setFormFeedbackType] = useState<"error" | "success" | null>(null);

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
                const freePlanId = dbSubscriptionPlans.find(p => p.name.toLowerCase() === 'FREE')?.id || subscriptionPlans[0].id; // Fallback hardcoded ID
                setUserPlan(freePlanId);
                if (advertiserError && advertiserError.code !== 'PGRST116') { // Ignore 'single row not found'
                    console.error("Error fetching advertiser profile:", advertiserError);
                }
            }
        } catch (error) {
            console.error("Error in getUserPlan:", error);
            const freePlanId = dbSubscriptionPlans.find(p => p.name.toLowerCase() === 'FREE')?.id || subscriptionPlans[0].id; // Fallback hardcoded ID
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
            const freePlan = dbSubscriptionPlans.find(p => p.name.toLowerCase() === 'FREE');
            return freePlan?.features || defaultFreePlanFeatures;
        }

        const plan = dbSubscriptionPlans.find((p: SubscriptionPlan) => p.id === planId);

        if (!plan) {
            const freePlan = dbSubscriptionPlans.find(p => p.name.toLowerCase() === 'FREE');
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
                    .select("*, advertiser_id") // Ensure advertiser_id is fetched for security if needed in RLS
                    .eq("id", contestId)
                    // .eq("advertiser_id", user.id) // RLS should handle this, but explicit check can be added if RLS is not robust
                    .single();

                if (contestError) {
                    if (contestError.code === 'PGRST116') { // 'PGRST116': Row not found
                        setError("Contest not found or you do not have permission to edit it.");
                    } else {
                        throw contestError;
                    }
                    setIsLoading(false);
                    return;
                }

                if (data && data.advertiser_id !== user.id) {
                    setError("You do not have permission to edit this contest.");
                    setIsLoading(false);
                    return;
                }


                if (data) {
                    // Simplified logic: Only check dates if contest is published
                    let canEdit = true;

                    if (data.moderation_status === 'published') {
                        const now = new Date();
                        const contestStartDate = data.start_date ? new Date(data.start_date) : null;
                        const contestEndDate = data.end_date ? new Date(data.end_date) : null;
                        const isLive = contestStartDate && contestStartDate <= now && (!contestEndDate || contestEndDate > now);
                        const isEnded = contestEndDate && contestEndDate <= now;

                        canEdit = !isLive && !isEnded;
                    }
                    // If moderation_status is not 'published', always allow editing regardless of dates

                    if (!canEdit) {
                        setError("This contest is already live or has ended and cannot be edited.");
                        setContest(data as ContestData); // Still set contest to allow viewing some info if needed
                    } else {
                        setContest(data as ContestData);
                        setTitle(data.title || "");
                        setCategory(data.category || "technology"); // Or data.platform

                        // Handle rich text content loading
                        if (data.brief_html && data.brief_json) {
                            setBriefHtml(data.brief_html);
                            setBriefJson(data.brief_json);
                            // Set content in editor if ref is available
                            setTimeout(() => {
                                if (richTextEditorRef.current) {
                                    richTextEditorRef.current.setContent(data.brief_json);
                                }
                            }, 100);
                        }

                        // Handle rules rich text content loading
                        if (data.rules_html && data.rules_json) {
                            setRulesHtml(data.rules_html);
                            setRulesJson(data.rules_json);
                            // Set content in editor if ref is available
                            setTimeout(() => {
                                if (rulesRichTextEditorRef.current) {
                                    rulesRichTextEditorRef.current.setContent(data.rules_json);
                                }
                            }, 100);
                        }

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

                        // Parse inspiration_links
                        let parsedInspirationLinks: string[] = [];
                        if (Array.isArray(data.inspiration_links)) {
                            parsedInspirationLinks = data.inspiration_links.filter((link: any) => typeof link === 'string');
                        } else if (typeof data.inspiration_links === 'string') {
                            try {
                                const parsed = JSON.parse(data.inspiration_links);
                                if (Array.isArray(parsed)) {
                                    parsedInspirationLinks = parsed.filter((link: any) => typeof link === 'string');
                                }
                            } catch (e) {
                                console.error("Failed to parse inspiration_links:", e);
                                // Keep parsedInspirationLinks as empty array
                            }
                        }
                        setInspirationLinks(parsedInspirationLinks);

                        setThumbnailPreview(data.thumbnail_url || null);
                        setContestType(data.contest_type || "leaderboard"); // Default to leaderboard if null for some reason

                        if (data.contest_type === 'leaderboard') {
                            const lbDetails = data.contest_based_details?.leaderboard_contest;
                            if (lbDetails && Array.isArray(lbDetails.prizes)) {
                                setWinnerCount(lbDetails.winner_count || lbDetails.prizes.length);
                                setWinnerAmounts(lbDetails.prizes.map((prize: { amount: number }) => prize.amount));
                            } else if (Array.isArray(data.prizes)) { // Fallback to old structure if new one not present
                                setWinnerCount(data.winner_count || data.prizes.length);
                                setWinnerAmounts(data.prizes.map((prize: { amount: number }) => prize.amount));
                            } else {
                                setWinnerCount(3); // Default
                                setWinnerAmounts([5000, 3000, 2000]); // Default
                            }
                        } else if (data.contest_type === 'cpm') {
                            const cpmDetails = data.contest_based_details?.cpm_contest;
                            if (cpmDetails) {
                                setCpmRate(cpmDetails.cpm_rate_usd?.toString() || "");
                                setMinViews(cpmDetails.min_views?.toString() || "");
                                setMaxViews(cpmDetails.max_views?.toString() || "");
                                setTotalBudget(cpmDetails.total_budget ? (cpmDetails.total_budget / 100).toString() : "");
                                setTermsConditions(cpmDetails.terms_conditions || "");
                            }
                        }

                        // Load existing resources
                        setResources(data.resources || {});
                    }
                } else {
                    setError("Contest not found or you don't have permission to edit it.");
                }
            } catch (error: any) {
                console.error("Error fetching contest data:", error);
                if (error.code === 'PGRST116') {
                    setError("Contest not found.");
                } else {
                    setError(`Failed to load contest: ${error.message}`);
                }
                setContest(null);
            } finally {
                setIsLoading(false);
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

    // Form submission - show toast + bottom error on every save click
    const handleSubmit = async () => {
        const showError = (message: string) => {
            // Always show toast on every save click - nice white UI toast
            toast({
                title: "Validation Error",
                description: message,
                duration: 3000, // 3 seconds
            });

            // Also show at bottom
            setFormFeedback(message);
            setFormFeedbackType("error");
        };

        setError(null);
        setIsSubmitting(true);

        let submitTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
        submitTimeoutId = setTimeout(() => {
            if (isSubmitting) {
                console.log("Edit submission taking longer than expected...");
                toast({
                    title: "Processing...",
                    description: "Operation is taking longer than expected. Please wait...",
                    variant: "default",
                });
            }
        }, 10000);

        if (!user) {
            toast({
                title: "Authentication Error",
                description: "You must be logged in to update a contest",
                variant: "destructive",
            });
            setIsSubmitting(false);
            if (submitTimeoutId) clearTimeout(submitTimeoutId);
            return;
        }

        if (!contest) {
            toast({
                title: "Contest Error",
                description: "Contest data not loaded. Cannot save changes.",
                variant: "destructive",
            });
            setIsSubmitting(false);
            if (submitTimeoutId) clearTimeout(submitTimeoutId);
            return;
        }

        // Validate mandatory fields - skip content validation for datesOnly mode
        if (!datesOnly) {
            if (!title || title.trim() === "") {
                showError("Contest title is required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }

            if (!briefHtml || isRichTextEditorEmpty(richTextEditorRef)) {
                showError("Brief description is required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }

            if (!rulesHtml || isRichTextEditorEmpty(rulesRichTextEditorRef)) {
                showError("Contest rules are required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }

            const validInspirationLinks = inspirationLinks.filter(link => link.trim() !== "");
            if (validInspirationLinks.length === 0) {
                showError("At least one inspiration link is required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }

            const hasUploadedFiles = Object.keys(resourceFiles).length > 0;
            const hasExistingResources = resources && Object.keys(resources).length > 0;
            const totalResources = (hasUploadedFiles ? Object.keys(resourceFiles).length : 0) +
                (hasExistingResources ? Object.keys(resources).length : 0);

            if (totalResources === 0) {
                showError("At least one resource is required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }
        }

        const planFeatures = getPlanFeatures(userPlan);
        let contestBasedDetails: any = {};
        let updatePayload: any = {};

        // Only include content fields if not in datesOnly mode
        if (!datesOnly) {
            updatePayload = {
                title,
                category,
                brief_html: briefHtml,
                brief_json: briefJson,
                rules_html: rulesHtml,
                rules_json: rulesJson,
                inspiration_links: inspirationLinks.filter(link => link.trim() !== ""),
            };
        }

        if (startDate && startTime && endDate && endTime) {
            try {
                const startDateTime = new Date(`${startDate}T${startTime}`);
                const endDateTime = new Date(`${endDate}T${endTime}`);
                const now = new Date();

                if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                    toast({
                        title: "Invalid Date Format",
                        description: "Please check your date and time entries.",
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                // Allow editing start time for contests not yet started, but it must still be in the future from now
                // And if contest.start_date exists, it means we are editing an existing draft, so only check if it has not started.
                const originalStartDate = contest.start_date ? new Date(contest.start_date) : null;
                if (startDateTime < now && (!originalStartDate || originalStartDate > now)) {
                    toast({
                        title: "Invalid Start Time",
                        description: "Contest start time must be in the future.",
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                if (endDateTime <= startDateTime) {
                    toast({
                        title: "Invalid End Time",
                        description: "Contest end time must be after the start time.",
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                const durationMs = endDateTime.getTime() - startDateTime.getTime();
                const oneDayMs = 24 * 60 * 60 * 1000;
                if (durationMs <= oneDayMs) {
                    toast({
                        title: "Invalid Duration",
                        description: "Contest duration must be more than 24 hours (at least 1 day gap).",
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                updatePayload.start_date = toUTCISOString(startDate, startTime);
                updatePayload.end_date = toUTCISOString(endDate, endTime);
            } catch (error) {
                console.error("Date validation error:", error);
                toast({
                    title: "Date Error",
                    description: "There was an error with the date/time format. Please check your entries.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
        } else {
            toast({
                title: "Missing Dates",
                description: "Contest start and end dates/times are required.",
                variant: "destructive",
            });
            setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
        }

        // Skip contest type validation for datesOnly mode
        if (!datesOnly && contestType === 'leaderboard') {
            const currentTotalPrizePool = winnerAmounts.reduce((sum, amount) => sum + (amount || 0), 0);
            if (winnerCount > planFeatures.maxWinnersPerContest) {
                toast({
                    title: "Plan Limit Exceeded",
                    description: `Your current plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners.`,
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            if (currentTotalPrizePool < planFeatures.minContestBudget) {
                toast({
                    title: "Prize Pool Too Low",
                    description: `Your current plan requires a minimum total prize pool of ${formatCurrency(planFeatures.minContestBudget)}.`,
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            for (let i = 0; i < winnerCount; i++) {
                if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
                    toast({
                        title: "Prize Amount Too Low",
                        description: `Prize for Winner ${i + 1} must be at least ${formatCurrency(MIN_PRIZE_PER_WINNER)}`,
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                if (winnerAmounts[i] > MAX_PRIZE_PER_WINNER) {
                    toast({
                        title: "Prize Amount Too High",
                        description: `Prize for Winner ${i + 1} cannot exceed ${formatCurrency(MAX_PRIZE_PER_WINNER)}`,
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
            }
            const prizesArray = winnerAmounts.slice(0, winnerCount).map((amount, i) => ({
                position: i + 1,
                amount: amount || 0,
            }));
            contestBasedDetails.leaderboard_contest = {
                prizes: prizesArray,
                total_prize: currentTotalPrizePool,
                winner_count: winnerCount,
            };
        } else if (!datesOnly && contestType === 'cpm') {
            const numCpmRate = parseFloat(cpmRate as string);
            const numTotalBudget = parseFloat(totalBudget as string);
            const numMinViews = minViews !== "" && minViews !== null ? parseInt(minViews as string, 10) : null;
            const numMaxViews = maxViews !== "" && maxViews !== null ? parseInt(maxViews as string, 10) : null;

            if (isNaN(numCpmRate) || numCpmRate <= 0) {
                toast({
                    title: "Invalid CPM Rate",
                    description: "CPM Rate is required and must be a positive number.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            if (isNaN(numTotalBudget) || numTotalBudget <= 0) {
                toast({
                    title: "Invalid Budget",
                    description: "Total Budget is required and must be a positive number.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            if (numMinViews !== null && (isNaN(numMinViews) || numMinViews < 0)) {
                toast({
                    title: "Invalid Minimum Views",
                    description: "Minimum Views, if provided, must be a non-negative number.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            if (numMaxViews !== null && (isNaN(numMaxViews) || numMaxViews < 0)) {
                toast({
                    title: "Invalid Maximum Views",
                    description: "Maximum Views, if provided, must be a non-negative number.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            if (numMinViews !== null && numMaxViews !== null && numMinViews > numMaxViews) {
                toast({
                    title: "Invalid View Range",
                    description: "Minimum Views cannot be greater than Maximum Views.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            if (!termsConditions || termsConditions.trim() === "") {
                toast({
                    title: "Missing Terms & Conditions",
                    description: "Terms & Conditions are required for CPM contests.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            contestBasedDetails.cpm_contest = {
                cpm_rate_usd: numCpmRate,
                total_budget: numTotalBudget * 100, // Convert dollars to cents
                min_views: numMinViews,
                max_views: numMaxViews,
                terms_conditions: termsConditions,
                budget_spent: contest?.contest_based_details?.cpm_contest?.budget_spent || 0,
            };
        } else if (!datesOnly) {
            toast({
                title: "Invalid Contest Type",
                description: "Invalid contest type selected. Please refresh and try again.",
                variant: "destructive",
            });
            setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
        }

        // Only update contest type and details if not in datesOnly mode
        if (!datesOnly) {
            updatePayload.contest_type = contestType;
            updatePayload.contest_based_details = contestBasedDetails;
        }

        // Initialize final resources object for DB update
        const finalDbResources: Record<string, string> = {};

        try {
            let finalThumbnailUrl = contest.thumbnail_url;
            if (!datesOnly && thumbnail) {
                try {
                    const fileName = `contest_thumbnails/${user.id}_${Date.now()}_${thumbnail.name.replace(/\s+/g, '_')}`;
                    const { error: uploadError } = await supabase.storage
                        .from('contest-assets')
                        .upload(fileName, thumbnail);
                    if (uploadError) {
                        toast({
                            title: "Thumbnail Upload Failed",
                            description: uploadError.message,
                            variant: "destructive",
                        });
                        setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                    }
                    const { data: publicUrlData } = supabase.storage
                        .from('contest-assets')
                        .getPublicUrl(fileName);
                    finalThumbnailUrl = publicUrlData.publicUrl;
                } catch (error: any) {
                    toast({
                        title: "Thumbnail Upload Failed",
                        description: error.message,
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
            }
            if (!datesOnly) {
                updatePayload.thumbnail_url = finalThumbnailUrl;
            }

            // 1. Process Staged File Uploads (New Files) - skip for datesOnly
            if (!datesOnly) {
                for (const resourceName in resourceFiles) {
                    const fileToUpload = resourceFiles[resourceName];
                    const resourceFileName = `contest_resources/${user.id}/${contestId}/${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;
                    const { error: resourceUploadError } = await supabase.storage
                        .from('contest-assets') // Assuming same bucket as thumbnails, or a dedicated one
                        .upload(resourceFileName, fileToUpload);
                    if (resourceUploadError) {
                        throw new Error(`Failed to upload resource "${resourceName}": ${resourceUploadError.message}`);
                    }
                    const { data: publicUrlData } = supabase.storage
                        .from('contest-assets')
                        .getPublicUrl(resourceFileName);
                    finalDbResources[resourceName] = publicUrlData.publicUrl;
                }

                // 2. Add Existing External Links or Already Uploaded Files (that weren't re-staged)
                // These are items in `resources` state that are not in `resourceFiles` (newly staged uploads)
                for (const resourceName in resources) {
                    if (!resourceFiles[resourceName]) { // If it wasn't a new file upload handled above
                        finalDbResources[resourceName] = resources[resourceName];
                    }
                }

                // 3. Handle Deletion of Resources previously in DB but now removed from UI
                const originalDbResources = contest.resources || {};
                for (const originalResourceName in originalDbResources) {
                    if (!finalDbResources[originalResourceName]) { // If this original resource is no longer in our final list
                        const resourceUrlToDelete = originalDbResources[originalResourceName];
                        // Check if it's a Supabase storage URL before attempting to delete from storage
                        if (resourceUrlToDelete && resourceUrlToDelete.includes(supabase.storage.from('contest-assets').getPublicUrl('').data.publicUrl.split('/contest-assets/')[0] + '/contest-assets/')) {
                            try {
                                // Extract file path from URL. This needs to be robust.
                                // Example: https://<project_ref>.supabase.co/storage/v1/object/public/contest-assets/contest_resources/....filePath
                                const pathSegments = new URL(resourceUrlToDelete).pathname.split('/');
                                // Find 'contest-assets' and take everything after it.
                                const bucketName = 'contest-assets'; // Make sure this matches your bucket name
                                const bucketIndex = pathSegments.indexOf(bucketName);
                                if (bucketIndex !== -1 && bucketIndex < pathSegments.length - 1) {
                                    const filePath = pathSegments.slice(bucketIndex + 1).join('/');
                                    console.log(`Attempting to delete from storage: ${filePath}`);
                                    const { error: deleteError } = await supabase.storage
                                        .from(bucketName)
                                        .remove([filePath]);
                                    if (deleteError) {
                                        // Log error but don't block contest update for this, as the link will be removed from DB anyway
                                        console.error(`Failed to delete resource "${originalResourceName}" from storage: ${deleteError.message}`);
                                        // setError(`Failed to delete old resource "${originalResourceName}" from storage. Please check storage manually.`);
                                        // setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                                    }
                                } else {
                                    console.warn(`Could not determine file path for deletion for: ${originalResourceName} with URL ${resourceUrlToDelete}`);
                                }
                            } catch (parseError) {
                                console.warn(`Error parsing URL for deletion or deleting resource ${originalResourceName}:`, parseError);
                            }
                        }
                    }
                }

                updatePayload.resources = finalDbResources; // Add the final map of resources to the payload
            }

            const { error: updateError } = await supabase
                .from("contests")
                .update(updatePayload)
                .eq("id", contestId)
                .eq("advertiser_id", user.id);

            if (updateError) {
                console.error("Supabase update error:", updateError);
                throw updateError;
            }

            // Show success toast
            toast({
                title: datesOnly ? "Contest Dates Updated" : "Contest Updated",
                description: datesOnly ? "Contest dates have been successfully updated." : "Your contest has been successfully updated.",
                variant: "default",
            });

            router.push(`/dashboard/contests/${contestId}`);
        } catch (err: any) {
            toast({
                title: "Update Failed",
                description: err.message || "Failed to update contest",
                variant: "destructive",
            });
        } finally {
            if (submitTimeoutId) clearTimeout(submitTimeoutId);
            setIsSubmitting(false);
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

    const addInspirationLink = () => {
        if (newInspirationLink && !inspirationLinks.includes(newInspirationLink)) {
            setInspirationLinks([...inspirationLinks, newInspirationLink])
            setNewInspirationLink("")
        }
    }

    const removeInspirationLink = (link: string) => {
        setInspirationLinks(inspirationLinks.filter(l => l !== link))
    }

    // Resource Management Handlers
    const handleResourceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setResourceError(null);
        setResourceSuccess(null);
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 20 * 1024 * 1024) { // 20MB limit
                setResourceError("File size should not exceed 20MB.");
                setResourceFile(null); // Clear the invalid file
                setResourceFilePreview(null);
                if (resourceFileRef.current) resourceFileRef.current.value = "";
                return;
            }
            setResourceFile(file);
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (ev) => setResourceFilePreview(ev.target?.result as string);
                reader.readAsDataURL(file);
            } else {
                setResourceFilePreview(`file-type:${file.type}::${file.name}`); // Include name for non-image preview
            }
        }
    };

    const removeResourceFile = () => {
        setResourceFile(null);
        setResourceFilePreview(null);
        setResourceDescription("");
        if (resourceFileRef.current) {
            resourceFileRef.current.value = "";
        }
        setResourceError(null); // Clear any error related to file selection
    };

    const addFileResource = () => {
        setResourceError(null);
        setResourceSuccess(null);
        if (!resourceFile) {
            setResourceError("No file selected or file is too large.");
            return;
        }
        if (!resourceDescription.trim()) {
            setResourceError("Please provide a description for the asset.");
            return;
        }
        const resourceName = resourceDescription.trim();
        if (resources[resourceName] || resourceFiles[resourceName]) { // Check both current and staged
            setResourceError(`A resource with the description "${resourceName}" already exists or is staged. Please use a unique description.`);
            return;
        }

        // Add to resourceFiles for actual upload on submit
        setResourceFiles(prev => ({
            ...prev,
            [resourceName]: resourceFile
        }));
        // Add to resources for immediate UI update with a temporary preview URL or file info
        setResources(prev => ({
            ...prev,
            [resourceName]: resourceFilePreview || URL.createObjectURL(resourceFile)
        }));

        setResourceSuccess(`Asset "${resourceName}" staged for upload. Save changes to complete.`);
        removeResourceFile(); // Clear the input fields (description, file, preview)
    };

    const addExternalResource = () => {
        setResourceError(null);
        setResourceSuccess(null);
        if (!newResourceUrl.trim()) {
            setResourceError("Please enter a URL for the external resource.");
            return;
        }
        if (!externalResourceDescription.trim()) {
            setResourceError("Please provide a description for the external resource.");
            return;
        }
        const resourceName = externalResourceDescription.trim();
        if (resources[resourceName] || resourceFiles[resourceName]) { // Check both current and staged
            setResourceError(`A resource with the description "${resourceName}" already exists or is staged. Please use a unique description.`);
            return;
        }

        try {
            new URL(newResourceUrl); // Validate URL format
        } catch (_) {
            setResourceError("Invalid URL format.");
            return;
        }

        setResources(prev => ({
            ...prev,
            [resourceName]: newResourceUrl
        }));
        setResourceSuccess(`External resource "${resourceName}" added to the list. Save changes to persist.`);
        setNewResourceUrl("");
        setExternalResourceDescription("");
    };

    const removeResource = (name: string) => {
        setResourceError(null);
        setResourceSuccess(null);

        const newUiResources = { ...resources };
        delete newUiResources[name];
        setResources(newUiResources);

        // If it was a newly staged file (not yet uploaded), remove it from resourceFiles
        if (resourceFiles[name]) {
            const newResourceFiles = { ...resourceFiles };
            delete newResourceFiles[name];
            setResourceFiles(newResourceFiles);
            setResourceSuccess(`Staged asset "${name}" removed from the list.`);
        } else {
            // If it was an existing resource (either external link or previously uploaded file),
            // its actual deletion from DB/storage will be handled by handleSubmit based on the final state of `resources`.
            setResourceSuccess(`Resource "${name}" removed from the list. Save changes to persist this removal.`);
        }
    };

    // Helper functions for content management
    const captureBriefContent = () => {
        if (richTextEditorRef.current) {
            const content = richTextEditorRef.current.getContent();
            console.log("Captured brief content:", content ? content.html.substring(0, 100) + "..." : content);
            setBriefHtml(content.html);
            setBriefJson(content.json);
            return content.html;
        }
        return "";
    };

    // Function to capture content from rules rich text editor
    const captureRulesContent = () => {
        if (rulesRichTextEditorRef.current) {
            const content = rulesRichTextEditorRef.current.getContent();
            console.log("Captured rules content:", content ? content.html.substring(0, 100) + "..." : content);
            setRulesHtml(content.html);
            setRulesJson(content.json);
            return content.html;
        }
        return "";
    };

    // Function to preview the rules content
    const toggleRulesPreview = () => {
        if (!showRulesPreview) {
            // Always capture content before showing preview
            captureRulesContent();
        }
        setShowRulesPreview(!showRulesPreview);
    };

    // Helper function to check if rich text editor content is effectively empty
    const isRichTextEditorEmpty = (editorRef: React.RefObject<any>): boolean => {
        if (editorRef.current) {
            const content = editorRef.current.getContent();
            return content === null || content.html === "" || content.html === "<p><br></p>";
        }
        return true;
    };

    const clearBottomError = () => {
        setFormFeedback(null);
        setFormFeedbackType(null);
    };

    // Handle save as draft for rejected contests
    const handleSaveAsDraft = async () => {
        await handleSubmitWithStatus('draft');
    };

    // Handle resubmit for approval for rejected contests  
    const handleResubmitForApproval = async () => {
        await handleSubmitWithStatus('pending_approval');
    };

    // Modified submit function that accepts a moderation status
    const handleSubmitWithStatus = async (moderationStatus?: 'draft' | 'pending_approval') => {
        const showError = (message: string) => {
            toast({
                title: "Validation Error",
                description: message,
                duration: 3000,
            });
            setFormFeedback(message);
            setFormFeedbackType("error");
        };

        setError(null);
        setIsSubmitting(true);

        let submitTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
        submitTimeoutId = setTimeout(() => {
            if (isSubmitting) {
                console.log("Edit submission taking longer than expected...");
                toast({
                    title: "Processing...",
                    description: "Operation is taking longer than expected. Please wait...",
                    variant: "default",
                });
            }
        }, 10000);

        if (!user) {
            toast({
                title: "Authentication Error",
                description: "You must be logged in to update a contest",
                variant: "destructive",
            });
            setIsSubmitting(false);
            if (submitTimeoutId) clearTimeout(submitTimeoutId);
            return;
        }

        if (!contest) {
            toast({
                title: "Contest Error",
                description: "Contest data not loaded. Cannot save changes.",
                variant: "destructive",
            });
            setIsSubmitting(false);
            if (submitTimeoutId) clearTimeout(submitTimeoutId);
            return;
        }

        // Validate mandatory fields - skip content validation for datesOnly mode
        // For draft mode, we can be more lenient with validation
        const isDraftMode = moderationStatus === 'draft';

        if (!datesOnly && !isDraftMode) {
            if (!title || title.trim() === "") {
                showError("Contest title is required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }

            if (!briefHtml || isRichTextEditorEmpty(richTextEditorRef)) {
                showError("Brief description is required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }

            if (!rulesHtml || isRichTextEditorEmpty(rulesRichTextEditorRef)) {
                showError("Contest rules are required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }

            const validInspirationLinks = inspirationLinks.filter(link => link.trim() !== "");
            if (validInspirationLinks.length === 0) {
                showError("At least one inspiration link is required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }

            const hasUploadedFiles = Object.keys(resourceFiles).length > 0;
            const hasExistingResources = resources && Object.keys(resources).length > 0;
            const totalResources = (hasUploadedFiles ? Object.keys(resourceFiles).length : 0) +
                (hasExistingResources ? Object.keys(resources).length : 0);

            if (totalResources === 0) {
                showError("At least one resource is required.");
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }
        }

        const planFeatures = getPlanFeatures(userPlan);
        let contestBasedDetails: any = {};
        let updatePayload: any = {};

        // Only include content fields if not in datesOnly mode
        if (!datesOnly) {
            updatePayload = {
                title,
                category,
                brief_html: briefHtml,
                brief_json: briefJson,
                rules_html: rulesHtml,
                rules_json: rulesJson,
                inspiration_links: inspirationLinks.filter(link => link.trim() !== ""),
            };
        }

        // Add moderation status if specified (for rejected contest workflows)
        if (moderationStatus) {
            updatePayload.moderation_status = moderationStatus;
            if (moderationStatus === 'pending_approval') {
                updatePayload.submitted_for_approval_at = new Date().toISOString();
                // Clear rejection reason when resubmitting
                updatePayload.rejection_reason = null;
            }
        }

        // Continue with the rest of the validation and submission logic...
        // (This is the same as the original handleSubmit function from here on)

        if (startDate && startTime && endDate && endTime) {
            try {
                const startDateTime = new Date(`${startDate}T${startTime}`);
                const endDateTime = new Date(`${endDate}T${endTime}`);
                const now = new Date();

                if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                    toast({
                        title: "Invalid Date Format",
                        description: "Please check your date and time entries.",
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }

                const originalStartDate = contest.start_date ? new Date(contest.start_date) : null;
                if (startDateTime < now && (!originalStartDate || originalStartDate > now)) {
                    toast({
                        title: "Invalid Start Time",
                        description: "Contest start time must be in the future.",
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                if (endDateTime <= startDateTime) {
                    toast({
                        title: "Invalid End Time",
                        description: "Contest end time must be after the start time.",
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                const durationMs = endDateTime.getTime() - startDateTime.getTime();
                const oneDayMs = 24 * 60 * 60 * 1000;
                if (durationMs <= oneDayMs) {
                    toast({
                        title: "Invalid Duration",
                        description: "Contest duration must be more than 24 hours (at least 1 day gap).",
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                updatePayload.start_date = toUTCISOString(startDate, startTime);
                updatePayload.end_date = toUTCISOString(endDate, endTime);
            } catch (error) {
                console.error("Date validation error:", error);
                toast({
                    title: "Date Error",
                    description: "There was an error with the date/time format. Please check your entries.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
        } else {
            toast({
                title: "Missing Dates",
                description: "Contest start and end dates/times are required.",
                variant: "destructive",
            });
            setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
        }

        // Skip contest type validation for datesOnly mode and draft mode
        if (!datesOnly && !isDraftMode && contestType === 'leaderboard') {
            const currentTotalPrizePool = winnerAmounts.reduce((sum, amount) => sum + (amount || 0), 0);
            if (winnerCount > planFeatures.maxWinnersPerContest) {
                toast({
                    title: "Plan Limit Exceeded",
                    description: `Your current plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners.`,
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            if (currentTotalPrizePool < planFeatures.minContestBudget) {
                toast({
                    title: "Prize Pool Too Low",
                    description: `Your current plan requires a minimum total prize pool of ${formatCurrency(planFeatures.minContestBudget)}.`,
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            for (let i = 0; i < winnerCount; i++) {
                if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
                    toast({
                        title: "Prize Amount Too Low",
                        description: `Prize for Winner ${i + 1} must be at least ${formatCurrency(MIN_PRIZE_PER_WINNER)}`,
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                if (winnerAmounts[i] > MAX_PRIZE_PER_WINNER) {
                    toast({
                        title: "Prize Amount Too High",
                        description: `Prize for Winner ${i + 1} cannot exceed ${formatCurrency(MAX_PRIZE_PER_WINNER)}`,
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
            }

            contestBasedDetails.leaderboard_contest = {
                prizes: winnerAmounts.slice(0, winnerCount).map((amount, index) => ({
                    position: index + 1,
                    amount: amount
                })),
                total_prize: currentTotalPrizePool,
                winner_count: winnerCount
            };
            updatePayload.contest_type = 'leaderboard';
            updatePayload.contest_based_details = contestBasedDetails;
        }

        if (!datesOnly && !isDraftMode && contestType === 'cpm') {
            const parsedCpmRate = typeof cpmRate === 'string' ? parseFloat(cpmRate) : cpmRate;
            const parsedMinViews = minViews ? (typeof minViews === 'string' ? parseInt(minViews) : minViews) : null;
            const parsedMaxViews = maxViews ? (typeof maxViews === 'string' ? parseInt(maxViews) : maxViews) : null;
            const parsedTotalBudget = typeof totalBudget === 'string' ? parseFloat(totalBudget) : totalBudget;

            if (!parsedCpmRate || parsedCpmRate <= 0) {
                toast({
                    title: "Invalid CPM Rate",
                    description: "CPM rate must be a positive number.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }

            if (!parsedTotalBudget || (parsedTotalBudget * 100) < planFeatures.minContestBudget) {
                toast({
                    title: "Budget Too Low",
                    description: `Your current plan requires a minimum total budget of ${formatCurrency(planFeatures.minContestBudget)}.`,
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }

            if (parsedMinViews && parsedMaxViews && parsedMinViews >= parsedMaxViews) {
                toast({
                    title: "Invalid View Range",
                    description: "Minimum views must be less than maximum views.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }

            if (!termsConditions || termsConditions.trim() === "") {
                toast({
                    title: "Missing Terms & Conditions",
                    description: "Terms and conditions are required for CPM contests.",
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }

            contestBasedDetails.cpm_contest = {
                cpm_rate_usd: parsedCpmRate,
                min_views: parsedMinViews,
                max_views: parsedMaxViews,
                total_budget: parsedTotalBudget * 100, // Convert to cents for storage
                budget_spent: 0,
                terms_conditions: termsConditions.trim()
            };
            updatePayload.contest_type = 'cpm';
            updatePayload.contest_based_details = contestBasedDetails;
        }

        // Continue with file uploads and database update...
        const finalDbResources: Record<string, string> = {};

        try {
            let finalThumbnailUrl = contest.thumbnail_url;
            if (!datesOnly && thumbnail) {
                try {
                    const fileName = `contest_thumbnails/${user.id}_${Date.now()}_${thumbnail.name.replace(/\s+/g, '_')}`;
                    const { error: uploadError } = await supabase.storage
                        .from('contest-assets')
                        .upload(fileName, thumbnail);
                    if (uploadError) {
                        toast({
                            title: "Thumbnail Upload Failed",
                            description: uploadError.message,
                            variant: "destructive",
                        });
                        setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                    }
                    const { data: publicUrlData } = supabase.storage
                        .from('contest-assets')
                        .getPublicUrl(fileName);
                    finalThumbnailUrl = publicUrlData.publicUrl;
                } catch (error: any) {
                    toast({
                        title: "Thumbnail Upload Failed",
                        description: error.message,
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
            }
            if (!datesOnly) {
                updatePayload.thumbnail_url = finalThumbnailUrl;
            }

            // Process file uploads for resources
            if (!datesOnly) {
                for (const resourceName in resourceFiles) {
                    const fileToUpload = resourceFiles[resourceName];
                    const resourceFileName = `contest_resources/${user.id}/${contestId}/${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`;
                    const { error: resourceUploadError } = await supabase.storage
                        .from('contest-assets')
                        .upload(resourceFileName, fileToUpload);
                    if (resourceUploadError) {
                        throw new Error(`Failed to upload resource "${resourceName}": ${resourceUploadError.message}`);
                    }
                    const { data: publicUrlData } = supabase.storage
                        .from('contest-assets')
                        .getPublicUrl(resourceFileName);
                    finalDbResources[resourceName] = publicUrlData.publicUrl;
                }

                for (const resourceName in resources) {
                    if (!resourceFiles[resourceName]) {
                        finalDbResources[resourceName] = resources[resourceName];
                    }
                }

                updatePayload.resources = finalDbResources;
            }

            const { error: updateError } = await supabase
                .from("contests")
                .update(updatePayload)
                .eq("id", contestId)
                .eq("advertiser_id", user.id);

            if (updateError) {
                console.error("Supabase update error:", updateError);
                throw updateError;
            }

            // Show appropriate success message
            let successMessage = "Contest updated successfully.";
            if (moderationStatus === 'draft') {
                successMessage = "Contest saved as draft successfully.";
            } else if (moderationStatus === 'pending_approval') {
                successMessage = "Contest resubmitted for approval successfully.";
            } else if (datesOnly) {
                successMessage = "Contest dates updated successfully.";
            }

            toast({
                title: "Success",
                description: successMessage,
                variant: "default",
            });

            router.push(`/dashboard/contests/${contestId}`);
        } catch (err: any) {
            toast({
                title: "Update Failed",
                description: err.message || "Failed to update contest",
                variant: "destructive",
            });
        } finally {
            if (submitTimeoutId) clearTimeout(submitTimeoutId);
            setIsSubmitting(false);
        }
    };

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
                <h1 className="text-2xl font-bold">
                    {datesOnly ? 'Edit Contest Dates' : 'Edit Contest'}
                </h1>
            </div>

            {/* Dates Only Warning */}
            {datesOnly && (
                <Alert className="mb-6 border-blue-200 bg-blue-50 text-blue-900">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Dates Only Mode:</strong> This contest is approved. You can only modify start and end dates/times.
                        All other content fields are locked to maintain approval integrity.
                    </AlertDescription>
                </Alert>
            )}

            {/* Current Plan Information */}
            <div className="mb-6">
                <Alert className="border-blue-200 bg-blue-50 text-blue-900">
                    <Crown className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                        <div>
                            <span className="font-medium">Current Plan: </span>
                            {dbSubscriptionPlans.find(p => p.id === userPlan)?.name || 'Free'}
                            <span className="ml-4 text-sm text-blue-700">
                                • Max Winners: {planFeatures.maxWinnersPerContest}
                                • Min Prize Pool: {formatCurrency(planFeatures.minContestBudget)}
                            </span>
                        </div>
                        <Link href="/pricing" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            Upgrade Plan
                        </Link>
                    </AlertDescription>
                </Alert>
            </div>

            <Card className="mx-auto max-w-4xl">
                <CardHeader>
                    <CardTitle>Edit Contest Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!datesOnly && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="title">Contest title</Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                        clearBottomError();
                                    }}
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
                        </>
                    )}

                    {!datesOnly && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="brief">Brief <span className="text-red-500">*</span></Label>
                                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">Required</span>
                            </div>
                            <div className="bg-white rounded min-h-[300px]">
                                <NovelEditor
                                    value={briefHtml}
                                    placeholder="Describe your project, what you want creators to do, key messages, target audience, and any specific requirements..."
                                    height="250px"
                                    ref={richTextEditorRef}
                                    onChange={(html: string, json: any) => {
                                        setBriefHtml(html);
                                        setBriefJson(json);
                                        clearBottomError();
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {!datesOnly && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-medium">Inspiration Links <span className="text-red-500">*</span></h3>
                                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">At least one required</span>
                            </div>
                            <div className="border rounded-md p-4 bg-card">
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
                                        placeholder="Add inspiration link (e.g., instagram, YouTube)"
                                        value={newInspirationLink}
                                        onChange={(e) => {
                                            setNewInspirationLink(e.target.value);
                                            clearBottomError();
                                        }}
                                    />
                                    <Button onClick={addInspirationLink} disabled={!newInspirationLink}>Add</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!datesOnly && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-medium">Set rules <span className="text-red-500">*</span></h3>
                                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">Required</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={toggleRulesPreview}
                                    >
                                        {showRulesPreview ? 'Edit' : 'Preview'}
                                    </Button>
                                </div>
                            </div>

                            {showRulesPreview ? (
                                <div className="border rounded-lg p-4 min-h-[300px] bg-white">
                                    <h4 className="text-sm font-medium mb-2 text-gray-600">Preview:</h4>
                                    <div
                                        className="prose prose-lg dark:prose-invert prose-headings:font-title font-default max-w-none"
                                        style={{
                                            padding: '12px 15px',
                                            minHeight: '250px',
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: rulesHtml || '<p class="text-gray-400">No rules yet. Click "Edit" to add rules.</p>'
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="bg-white rounded min-h-[300px]">
                                    <NovelEditor
                                        value={rulesHtml}
                                        placeholder="Content rules and guidelines..."
                                        height="250px"
                                        ref={rulesRichTextEditorRef}
                                        onChange={(html: string, json: any) => {
                                            console.log("Rules editor onChange - html:", html?.substring(0, 50));
                                            console.log("Rules editor onChange - json:", json);
                                            setRulesHtml(html);
                                            setRulesJson(json);
                                            clearBottomError();
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <Separator />

                    {/* Resources Section START */}
                    {!datesOnly && (
                        <div className="space-y-6"> {/* Main container for entire resources section */}
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-medium">Resources for Participants <span className="text-red-500">*</span></h3>
                                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">At least one required</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Add or remove resources that help participants understand your brand and contest requirements. You need at least one resource (either upload an asset OR add an external link).
                            </p>

                            {resourceSuccess && (
                                <Alert variant="default" className="bg-green-50 border-green-200 text-green-700">
                                    <Check className="h-4 w-4" />
                                    <AlertDescription>{resourceSuccess}</AlertDescription>
                                </Alert>
                            )}
                            {/* General resourceError Alert removed from here */}

                            {/* File Upload Container */}
                            <div className="border rounded-lg p-4 space-y-4">
                                {/* Section-specific error for Upload Asset */}
                                {resourceError &&
                                    (resourceError.includes("No file selected") ||
                                        resourceError.includes("File size") ||
                                        resourceError.includes("description for the asset") ||
                                        resourceError.includes("already exists")) && (
                                        <Alert variant="destructive">
                                            <AlertDescription>{resourceError}</AlertDescription>
                                        </Alert>
                                    )}
                                <h4 className="text-md font-medium">Upload New Asset</h4>
                                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                                    {resourceFilePreview ? (
                                        <div className="relative text-center">
                                            {resourceFilePreview.startsWith("data:image") ? (
                                                <img src={resourceFilePreview} alt="Asset preview" className="mx-auto max-h-40 object-contain mb-2" />
                                            ) : resourceFilePreview.startsWith("file-type:") ? (
                                                <div className="py-4">
                                                    <p className="text-sm font-medium">File: {resourceFilePreview.split("::")[2]}</p>
                                                    <p className="text-xs text-muted-foreground">Type: {resourceFilePreview.split("::")[1]}</p>
                                                </div>
                                            ) : ( /* Fallback for other previews like Object URLs for non-images if needed */
                                                <div className="py-4">
                                                    <p className="text-sm font-medium">Preview not available</p>
                                                    {resourceFile && <p className="text-xs text-muted-foreground">File: {resourceFile.name}</p>}
                                                </div>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={removeResourceFile} className="text-red-500">
                                                <Trash className="h-4 w-4 mr-1" /> Clear Selection
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <Upload className="h-10 w-10 mx-auto text-gray-400 dark:text-gray-500 mb-2" />
                                            <p className="text-sm font-medium mb-1">Drag, drop or browse file</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Max file size: 20MB</p>
                                            <Button variant="outline" size="sm" onClick={() => { if (resourceFileRef.current) { resourceFileRef.current.click(); } }}>
                                                Browse File
                                            </Button>
                                            <input type="file" ref={resourceFileRef} id="resourceFileInputEdit" className="hidden" onChange={handleResourceFileChange} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="resourceDescriptionEdit">Asset Description (Required)</Label>
                                    <Input
                                        id="resourceDescriptionEdit"
                                        placeholder="e.g., Brand Logo, Product Image"
                                        value={resourceDescription}
                                        onChange={(e) => setResourceDescription(e.target.value)}
                                    />
                                </div>
                                <Button type="button" onClick={addFileResource} disabled={!resourceFile || !resourceDescription.trim() || isSubmitting} className="w-full sm:w-auto">
                                    Add Asset to List
                                </Button>
                            </div>

                            {/* External Resource Link */}
                            <div className="border rounded-lg p-4 space-y-4">
                                {/* Section-specific error for External Link */}
                                {resourceError &&
                                    (resourceError.includes("Please enter a URL") ||
                                        resourceError.includes("Invalid URL format") ||
                                        resourceError.includes("description for the external resource") ||
                                        resourceError.includes("already exists")) && (
                                        <Alert variant="destructive">
                                            <AlertDescription>{resourceError}</AlertDescription>
                                        </Alert>
                                    )}
                                <h4 className="text-md font-medium">Add External Resource Link</h4>
                                <div>
                                    <Label htmlFor="newResourceUrlEdit">Resource URL (Required)</Label>
                                    <Input
                                        id="newResourceUrlEdit"
                                        type="url"
                                        placeholder="https://example.com/resource-link"
                                        value={newResourceUrl}
                                        onChange={(e) => setNewResourceUrl(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="externalResourceDescriptionEdit">Link Description (Required)</Label>
                                    <Input
                                        id="externalResourceDescriptionEdit"
                                        placeholder="e.g., Company Website, Style Guide PDF"
                                        value={externalResourceDescription}
                                        onChange={(e) => setExternalResourceDescription(e.target.value)}
                                    />
                                </div>
                                <Button type="button" onClick={addExternalResource} disabled={!newResourceUrl.trim() || !externalResourceDescription.trim() || isSubmitting} className="w-full sm:w-auto">
                                    Add Link to List
                                </Button>
                            </div>

                            {/* List of current/staged resources */}
                            {Object.keys(resources).length > 0 && (
                                <div className="space-y-3 pt-4">
                                    <h4 className="text-md font-medium">Current & Staged Resources:</h4>
                                    <ul className="space-y-2">
                                        {Object.entries(resources).map(([name, url]) => (
                                            <li key={name} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-800 rounded text-sm">
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-slate-100">{name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs md:max-w-md" title={url}>
                                                        {url.startsWith("data:image") ? "Image Preview (Staged/Current)" :
                                                            url.startsWith("file-type:") ? `File: ${url.split("::")[2]} (Staged)` :
                                                                resourceFiles[name] ? `File: ${resourceFiles[name]!.name} (Staged)` :
                                                                    url.startsWith("blob:") ? "Local File Preview (Staged)" :
                                                                        url /* Assumed to be an external link or existing DB URL */}
                                                    </p>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => removeResource(name)} className="text-red-500 hover:text-red-700" disabled={isSubmitting}>
                                                    <Trash className="h-4 w-4 mr-1" /> Remove
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Resources Section END */}

                    <Separator />

                    {/* Contest Type Display (Read-Only) */}
                    {!datesOnly && (
                        <div className="space-y-2">
                            <Label htmlFor="contest-type">Contest Type</Label>
                            <Input
                                id="contest-type"
                                value={contestType === 'cpm' ? 'CPM Based' : 'Leaderboard Based'}
                                readOnly
                                className="bg-gray-100 cursor-not-allowed"
                            />
                        </div>
                    )}

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
                            Contest duration must be more than 24 hours (at least 1 day gap).
                        </p>
                    </div>

                    <Separator />

                    {/* Prize Distribution - Conditional for Leaderboard */}
                    {!datesOnly && contestType === 'leaderboard' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Prize distribution</h3>
                                <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                                    <span className="text-sm font-medium">Total Prize Pool:</span>
                                    <span className="text-lg font-bold">{formatCurrency(totalPrizePool)}</span>
                                </div>
                            </div>

                            {/* Plan Requirements Info */}
                            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    <span className="font-medium">Plan Requirements: </span>
                                    Minimum total prize pool: <strong>{formatCurrency(planFeatures.minContestBudget)}</strong>
                                    • Maximum winners: <strong>{planFeatures.maxWinnersPerContest}</strong>
                                    • Minimum per winner: <strong>{formatCurrency(MIN_PRIZE_PER_WINNER)}</strong>
                                </AlertDescription>
                            </Alert>

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
                                                } else {
                                                    // Show toast notification instead of setValidationError
                                                    toast({
                                                        title: "Plan Limit Reached",
                                                        description: `Your plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners.`,
                                                        variant: "destructive",
                                                    });
                                                }
                                            }}
                                            // Disable based on planFeatures limit
                                            disabled={winnerCount >= planFeatures.maxWinnersPerContest}
                                        >
                                            +
                                        </Button>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        <span>Max: {planFeatures.maxWinnersPerContest}</span>
                                    </div>
                                </div>

                                {Array.from({ length: winnerCount }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4 mb-2">
                                        <Label className="w-48">Winner {i + 1}</Label>
                                        <Input
                                            type="number"
                                            step="1"
                                            value={winnerAmounts[i] / 100}
                                            onChange={(e) => {
                                                const inputValue = e.target.value;

                                                // Allow empty input for typing new values
                                                if (inputValue === "") {
                                                    const newWinnerAmounts = [...winnerAmounts];
                                                    newWinnerAmounts[i] = 0; // Temporarily set to 0
                                                    setWinnerAmounts(newWinnerAmounts);
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

                                                    // Show toast validation messages instead of setValidationError
                                                    if (value < MIN_PRIZE_PER_WINNER) {
                                                        toast({
                                                            title: "Prize Amount Too Low",
                                                            description: `Prize amount cannot be less than ${formatCurrency(MIN_PRIZE_PER_WINNER)}`,
                                                            variant: "destructive",
                                                        });
                                                    } else if (value > MAX_PRIZE_PER_WINNER) {
                                                        toast({
                                                            title: "Prize Amount Too High",
                                                            description: `Prize amount cannot exceed ${formatCurrency(MAX_PRIZE_PER_WINNER)}`,
                                                            variant: "destructive",
                                                        });
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
                            {/* Enhanced validation message for minimum total prize pool */}
                            {totalPrizePool < planFeatures.minContestBudget && (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertDescription>
                                        ⚠️ The minimum prize pool for your current plan is {formatCurrency(planFeatures.minContestBudget)}.
                                        Current total: {formatCurrency(totalPrizePool)}. Please increase prize amounts.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    {/* CPM Configuration - Conditional for CPM */}
                    {!datesOnly && contestType === 'cpm' && (
                        <div className="space-y-6">
                            <Separator />
                            <div>
                                <h3 className="text-lg font-medium">CPM Configuration</h3>
                                <p className="text-sm text-muted-foreground">
                                    Configure the Cost Per Mille (CPM) details for this contest.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="cpmRate">CPM Rate (USD per 1000 views) <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="cpmRate"
                                        type="number"
                                        value={cpmRate}
                                        onChange={(e) => setCpmRate(e.target.value)}
                                        placeholder="e.g., 1.50"
                                        step="0.01"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="totalBudget">Total Budget (USD) <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="totalBudget"
                                        type="number"
                                        value={totalBudget}
                                        onChange={(e) => setTotalBudget(e.target.value)}
                                        placeholder="e.g., 10000"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="minViews">Minimum Views (Optional)</Label>
                                    <Input
                                        id="minViews"
                                        type="number"
                                        value={minViews}
                                        onChange={(e) => setMinViews(e.target.value)}
                                        placeholder="e.g., 10000"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Optional: Minimum views a submission needs to be eligible for earnings.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="maxViews">Maximum Views (Cap, Optional)</Label>
                                    <Input
                                        id="maxViews"
                                        type="number"
                                        value={maxViews}
                                        onChange={(e) => setMaxViews(e.target.value)}
                                        placeholder="e.g., 1000000"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Optional: Maximum views for which a creator can be paid for a single submission.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="termsConditions">Terms & Conditions <span className="text-red-500">*</span></Label>
                                <Textarea
                                    id="termsConditions"
                                    value={termsConditions}
                                    onChange={(e) => setTermsConditions(e.target.value)}
                                    placeholder="Outline the specific terms and conditions for creators participating in this CPM contest..."
                                    rows={6}
                                />
                                <p className="text-xs text-muted-foreground">
                                    These terms will be shown to creators. Be clear and concise.
                                </p>
                            </div>
                        </div>
                    )}

                </CardContent>
                <CardFooter className="flex justify-between items-center pt-6">
                    {/* Show rejection reason banner for rejected contests */}
                    {contest?.moderation_status === 'rejected' && contest?.rejection_reason && (
                        <div className="w-full mb-4">
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <div>
                                    <div className="font-medium">Contest was rejected</div>
                                    <div className="text-sm mt-1">{contest.rejection_reason}</div>
                                    <div className="text-xs mt-2 text-muted-foreground">
                                        Please address the issues above and either save as draft for further editing or submit for approval.
                                    </div>
                                </div>
                            </Alert>
                        </div>
                    )}

                    {/* Modern Error Display exactly like create contest page */}
                    {formFeedback && formFeedbackType === 'error' && (
                        <div className="mr-auto">
                            <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <AlertTriangle className="h-3 w-3 text-white" />
                                    </div>
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">{formFeedback}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isSubmitting} // Disable during submission
                        className={`${!(formFeedback && formFeedbackType === 'error') ? 'mr-auto' : ''}`}
                    >
                        Cancel
                    </Button>

                    <div className={`flex gap-2 ${formFeedback && formFeedbackType === 'error' ? 'ml-4' : 'ml-auto'}`}>
                        {datesOnly ? (
                            // Dates-only mode: Just save changes (no approval needed)
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !!validationError}
                                className="bg-rose-600 hover:bg-rose-700 text-white"
                            >
                                {isSubmitting ? "Saving..." : "Save Changes"}
                            </Button>
                        ) : contest?.moderation_status !== 'published' ? (
                            // Full edit mode for non-published contests: Draft/Save and Submit buttons
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleSaveAsDraft}
                                    disabled={isSubmitting || !!validationError}
                                    className="bg-gray-600 hover:bg-gray-700 text-white"
                                >
                                    {isSubmitting ? "Saving..." : "Save as Draft"}
                                </Button>
                                <Button
                                    onClick={handleResubmitForApproval}
                                    disabled={isSubmitting || !!validationError}
                                    className="bg-orange-600 hover:bg-orange-700 text-white"
                                >
                                    {isSubmitting ? "Submitting..." : "Submit for Approval"}
                                </Button>
                            </>
                        ) : (
                            // Full edit mode for published contests: Just save changes (should rarely happen)
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !!validationError}
                                className="bg-rose-600 hover:bg-rose-700 text-white"
                            >
                                {isSubmitting ? "Saving..." : "Save Changes"}
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </Card>


        </div>
    )
} 