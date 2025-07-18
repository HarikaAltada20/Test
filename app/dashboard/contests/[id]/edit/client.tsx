"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Image, Trash, Upload, ExternalLink, Check, Crown, Info, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { toLocalDateTimeStrings, toUTCISOString } from "@/lib/utils"
import { formatCurrencyFromCents } from "@/lib/currency-utils"
import { DEFAULT_PRIZE_ALLOCATIONS, MAX_PRIZE_PER_WINNER, MIN_PRIZE_PER_WINNER, subscriptionPlans } from "@/constants/subscriptionPlans"
import { createClient } from "@/utils/supabase/client"
import { UserResponse } from "@supabase/supabase-js"
import { useToast } from "@/hooks/use-toast"
import { ContestPaymentSelection } from "@/components/ContestPaymentSelection"
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
    commissionPercentage: number; // Make sure this matches your DB json_features key
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
    inspiration_links: { url: string; description: string }[];
    resources: Record<string, string> | null;
    status: string;
    advertiser_id?: string;
    contest_type: "leaderboard" | "cpm" | null;
    contest_based_details: {
        cpm_contest?: CpmContestDetails;
        leaderboard_contest?: LeaderboardContestDetails;
    } | null;
    moderation_status: string;
    rejection_reason: string | null;
    payment_details?: any | null;
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
    const [inspirationLinks, setInspirationLinks] = useState<{ url: string; description: string }[]>([]);
    const [newInspirationUrl, setNewInspirationUrl] = useState("");
    const [newInspirationDescription, setNewInspirationDescription] = useState("");
    const [inspirationError, setInspirationError] = useState<string | null>(null);
    const [thumbnail, setThumbnail] = useState<File | null>(null)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const richTextEditorRef = useRef<any>(null)
    const rulesRichTextEditorRef = useRef<any>(null)

    // Contest Type and Specific Details
    const [contestType, setContestType] = useState<"leaderboard" | "cpm" | null>(null);

    // Leaderboard specific
    const [winnerCount, setWinnerCount] = useState<number>(3)
    const [winnerAmounts, setWinnerAmounts] = useState<number[]>([5000, 3000, 2000]) // Note: these amounts are in cents if formatCurrencyFromCents expects cents

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

    // Payment state management
    const [showPayment, setShowPayment] = useState(false);
    const [isPaymentRequired, setIsPaymentRequired] = useState(false);

    // Budget change tracking
    const [originalBudget, setOriginalBudget] = useState<number>(0); // Store original budget in cents
    const [budgetChanged, setBudgetChanged] = useState(false);
    const [budgetDifference, setBudgetDifference] = useState<number>(0); // Positive = increase, Negative = decrease

    // Add at the top with other useState hooks
    const [isDragActive, setIsDragActive] = useState(false);
    const [assetUploadError, setAssetUploadError] = useState<string | null>(null);
    const [externalLinkError, setExternalLinkError] = useState<string | null>(null);

    // Load subscription plans from constants (new system)
    const loadSubscriptionPlans = async () => {
        setIsPlansLoading(true);
        setError(null);
        try {
            // Import plans from constants (new subscription system)
            const mappedPlans: SubscriptionPlan[] = subscriptionPlans.map((plan) => ({
                id: plan.id, // Now real Stripe product ID
                name: plan.name,
                price: plan.price, // Already in cents
                features: {
                    maxActiveContests: plan.features.maxActiveContests,
                    minContestBudget: plan.features.minContestBudget,
                    maxWinnersPerContest: plan.features.maxWinnersPerContest,
                    commissionPercentage: plan.features.commissionPercentage
                }
            }));
            setDbSubscriptionPlans(mappedPlans);
        } catch (error: any) {
            console.error("Error loading subscription plans:", error);
            setError(`Failed to load subscription plans: ${error.message}. Using defaults.`);
            setDbSubscriptionPlans([]);
        } finally {
            setIsPlansLoading(false);
        }
    };

    // Get the current user's subscription from new subscription system
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
                .select("subscription_info")
                .eq("id", userId)
                .single();

            if (!advertiserError && advertiserData?.subscription_info?.product_id) {
                setUserPlan(advertiserData.subscription_info.product_id);
            } else {
                // Default to EXPLORER plan (free plan) if not found or error
                const explorerPlan = subscriptionPlans.find(p => p.name === 'EXPLORER');
                const explorerPlanId = explorerPlan?.id || subscriptionPlans[0].id;
                setUserPlan(explorerPlanId);
                if (advertiserError && advertiserError.code !== 'PGRST116') { // Ignore 'single row not found'
                    console.error("Error fetching advertiser profile:", advertiserError);
                }
            }
        } catch (error) {
            console.error("Error in getUserPlan:", error);
            // Default to EXPLORER plan (free plan) on error
            const explorerPlan = subscriptionPlans.find(p => p.name === 'EXPLORER');
            const explorerPlanId = explorerPlan?.id || subscriptionPlans[0].id;
            setUserPlan(explorerPlanId);
        } finally {
            setIsUserPlanLoading(false);
        }
    };

    // Get features for a given plan ID using constants
    const getPlanFeatures = (planId: string | null): PlanFeatures => {
        const defaultFreePlanFeatures: PlanFeatures = subscriptionPlans[0].features

        if (!planId) {
            // Find EXPLORER plan by name if planId is null
            const explorerPlan = subscriptionPlans.find(p => p.name === 'EXPLORER');
            return explorerPlan?.features || defaultFreePlanFeatures;
        }

        const plan = subscriptionPlans.find((p) => p.id === planId);

        if (!plan) {
            // Default to EXPLORER plan if plan not found
            const explorerPlan = subscriptionPlans.find(p => p.name === 'EXPLORER');
            return explorerPlan?.features || defaultFreePlanFeatures;
        }
        return plan.features;
    };

    // Fetch contest data and plan data
    useEffect(() => {
        async function fetchInitialData() {
            setIsLoading(true); // General loading state for the page
            await loadSubscriptionPlans(); // Load plans first

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
                        let parsedInspirationLinks: { url: string; description: string }[] = [];
                        if (Array.isArray(data.inspiration_links)) {
                            parsedInspirationLinks = data.inspiration_links;
                        } else {
                            parsedInspirationLinks = [];
                        }
                        setInspirationLinks(parsedInspirationLinks);

                        setThumbnailPreview(data.thumbnail_url || null);
                        setContestType(data.contest_type || "leaderboard"); // Default to leaderboard if null for some reason

                        if (data.contest_type === 'leaderboard') {
                            const lbDetails = data.contest_based_details?.leaderboard_contest;
                            if (lbDetails && Array.isArray(lbDetails.prizes)) {
                                setWinnerCount(lbDetails.winner_count || lbDetails.prizes.length);
                                const prizes = lbDetails.prizes.map((prize: { amount: number }) => prize.amount);
                                setWinnerAmounts(prizes);
                                // Set original budget for tracking changes (prize pool only)
                                const originalBudgetInCents = prizes.reduce((sum: number, amount: number) => sum + amount, 0);
                                setOriginalBudget(originalBudgetInCents);
                            } else if (Array.isArray(data.prizes)) { // Fallback to old structure if new one not present
                                setWinnerCount(data.winner_count || data.prizes.length);
                                const prizes = data.prizes.map((prize: { amount: number }) => prize.amount);
                                setWinnerAmounts(prizes);
                                // Set original budget for tracking changes (prize pool only)
                                const originalBudgetInCents = prizes.reduce((sum: number, amount: number) => sum + amount, 0);
                                setOriginalBudget(originalBudgetInCents);
                            } else {
                                setWinnerCount(3); // Default
                                setWinnerAmounts([5000, 3000, 2000]); // Default
                                // Set default original budget (prize pool only)
                                setOriginalBudget(10000); // Default total
                            }
                        } else if (data.contest_type === 'cpm') {
                            const cpmDetails = data.contest_based_details?.cpm_contest;
                            if (cpmDetails) {
                                setCpmRate(cpmDetails.cpm_rate_usd?.toString() || "");
                                setMinViews(cpmDetails.min_views?.toString() || "");
                                setMaxViews(cpmDetails.max_views?.toString() || "");
                                setTotalBudget(cpmDetails.total_budget ? (cpmDetails.total_budget / 100).toString() : "");
                                setTermsConditions(cpmDetails.terms_conditions || "");
                                // Set original budget for tracking changes (cpm budget is stored in cents, prize pool only)
                                setOriginalBudget(cpmDetails.total_budget || 0);
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

    // Re-check budget changes when original budget is set or contest type changes
    useEffect(() => {
        if (originalBudget > 0) {
            checkBudgetChange();
        }
    }, [originalBudget, contestType]);

    // Refresh contest data function
    const refreshContestData = async () => {
        try {
            const { data, error: contestError } = await supabase
                .from("contests")
                .select("*, advertiser_id")
                .eq("id", contestId)
                .single();

            if (contestError) {
                console.error("Error refreshing contest data:", contestError);
                return;
            }

            if (data) {
                setContest(data as ContestData);
                console.log("✅ Contest data refreshed after payment");

                // Update form fields with latest contest data if it's a budget-related change
                const refreshedContest = data as ContestData;
                if (refreshedContest.contest_based_details) {
                    if (refreshedContest.contest_type === 'leaderboard' && refreshedContest.contest_based_details.leaderboard_contest) {
                        const leaderboardData = refreshedContest.contest_based_details.leaderboard_contest;
                        if (leaderboardData.prizes && Array.isArray(leaderboardData.prizes)) {
                            // Update winner amounts with latest data from database
                            const updatedAmounts = leaderboardData.prizes.map(prize => prize.amount);
                            setWinnerAmounts(updatedAmounts);
                            setWinnerCount(leaderboardData.winner_count || updatedAmounts.length);

                            // Update originalBudget with current total from database
                            const currentTotal = leaderboardData.total_prize || updatedAmounts.reduce((sum, amount) => sum + amount, 0);
                            setOriginalBudget(currentTotal);

                            console.log("🔄 Updated leaderboard amounts from database:", {
                                updatedAmounts,
                                totalPrize: currentTotal,
                                winnerCount: leaderboardData.winner_count
                            });
                        }
                    } else if (refreshedContest.contest_type === 'cpm' && refreshedContest.contest_based_details.cpm_contest) {
                        const cpmData = refreshedContest.contest_based_details.cpm_contest;
                        if (cpmData.total_budget) {
                            // Update total budget with latest data from database
                            const budgetInDollars = cpmData.total_budget / 100; // Convert cents to dollars
                            setTotalBudget(budgetInDollars.toString());

                            // Update originalBudget with current total from database
                            setOriginalBudget(cpmData.total_budget);

                            console.log("🔄 Updated CPM budget from database:", {
                                totalBudgetCents: cpmData.total_budget,
                                totalBudgetDollars: budgetInDollars
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error refreshing contest data:", error);
        }
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

            const validInspirationLinks = inspirationLinks.filter(link => link.url.trim() !== "");
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
                inspiration_links: inspirationLinks.filter(link => link.url.trim() !== ""),
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
                if (durationMs < oneDayMs) {
                    toast({
                        title: "Invalid Duration",
                        description: "Contest duration must be at least 24 hours (minimum 1 day).",
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
                    description: `Your current plan requires a minimum total prize pool of ${formatCurrencyFromCents(planFeatures.minContestBudget)}.`,
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            for (let i = 0; i < winnerCount; i++) {
                if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
                    toast({
                        title: "Prize Amount Too Low",
                        description: `Prize for Winner ${i + 1} must be at least ${formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}`,
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                if (winnerAmounts[i] > MAX_PRIZE_PER_WINNER) {
                    toast({
                        title: "Prize Amount Too High",
                        description: `Prize for Winner ${i + 1} cannot exceed ${formatCurrencyFromCents(MAX_PRIZE_PER_WINNER)}`,
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

    const addInspiration = () => {
        setInspirationError(null);
        if (!newInspirationUrl.trim()) {
            setInspirationError("URL cannot be empty.");
            return;
        }
        try {
            const urlObj = new URL(newInspirationUrl);
            if (urlObj.protocol !== "https:") {
                setInspirationError("URL must start with https://");
                return;
            }
        } catch {
            setInspirationError("Invalid URL format.");
            return;
        }
        if (!newInspirationDescription.trim()) {
            setInspirationError("Description is required.");
            return;
        }

        setInspirationLinks([...inspirationLinks, { url: newInspirationUrl, description: newInspirationDescription }]);
        setNewInspirationUrl("");
        setNewInspirationDescription("");
    };

    const removeInspirationLink = (link: { url: string; description: string }) => {
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
        setAssetUploadError(null);
        setResourceSuccess(null);
        if (!resourceFile) {
            setAssetUploadError("No file selected or file is too large.");
            return;
        }
        if (!resourceDescription.trim()) {
            setAssetUploadError("Please provide a description for the asset.");
            return;
        }
        const resourceName = resourceDescription.trim();
        if (resources[resourceName] || resourceFiles[resourceName]) { // Check both current and staged
            setAssetUploadError(`A resource with the description "${resourceName}" already exists or is staged. Please use a unique description.`);
            return;
        }

        try {
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
        } catch (error: any) {
            setAssetUploadError(`Failed to add asset: ${error.message}`);
        }
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

    // Helper function to check if contest payment has been completed
    const isContestPaid = (): boolean => {
        if (!contest?.payment_details) return false;

        try {
            const paymentDetails = typeof contest.payment_details === 'string'
                ? JSON.parse(contest.payment_details)
                : contest.payment_details;

            return paymentDetails.payment_status === 'completed';
        } catch (error) {
            console.error('Error parsing payment details:', error);
            return false;
        }
    };

    // Helper function to validate form for submission
    const validateFormForSubmission = (): string | null => {
        if (!title || title.trim() === "") {
            return "Contest title is required.";
        }

        if (!briefHtml || isRichTextEditorEmpty(richTextEditorRef)) {
            return "Brief description is required.";
        }

        if (!rulesHtml || isRichTextEditorEmpty(rulesRichTextEditorRef)) {
            return "Contest rules are required.";
        }

        // Validate thumbnail - either uploaded file or existing preview
        if (!thumbnail && !thumbnailPreview) {
            return "Contest thumbnail is required.";
        }

        const validInspirationLinks = inspirationLinks.filter(link => link.url.trim() !== "");
        if (validInspirationLinks.length === 0) {
            return "At least one inspiration link is required.";
        }

        const hasUploadedFiles = Object.keys(resourceFiles).length > 0;
        const hasExistingResources = resources && Object.keys(resources).length > 0;
        const totalResources = (hasUploadedFiles ? Object.keys(resourceFiles).length : 0) +
            (hasExistingResources ? Object.keys(resources).length : 0);

        if (totalResources === 0) {
            return "At least one resource is required.";
        }

        if (!startDate || !startTime || !endDate || !endTime) {
            return "Contest start and end dates/times are required.";
        }

        // Validate dates
        try {
            const startDateTime = new Date(`${startDate}T${startTime}`);
            const endDateTime = new Date(`${endDate}T${endTime}`);
            const now = new Date();

            if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
                return "Please check your date and time entries.";
            }

            const originalStartDate = contest?.start_date ? new Date(contest.start_date) : null;
            if (startDateTime < now && (!originalStartDate || originalStartDate > now)) {
                return "Contest start time must be in the future.";
            }

            if (endDateTime <= startDateTime) {
                return "Contest end time must be after the start time.";
            }

            const durationMs = endDateTime.getTime() - startDateTime.getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            if (durationMs < oneDayMs) {
                return "Contest duration must be at least 24 hours (minimum 1 day).";
            }
        } catch (error) {
            return "There was an error with the date/time format. Please check your entries.";
        }

        // Validate contest type specific fields
        if (contestType === 'leaderboard') {
            const planFeatures = getPlanFeatures(userPlan);
            const currentTotalPrizePool = winnerAmounts.reduce((sum, amount) => sum + (amount || 0), 0);

            if (winnerCount > planFeatures.maxWinnersPerContest) {
                return `Your current plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners.`;
            }

            if (currentTotalPrizePool < planFeatures.minContestBudget) {
                return `Your current plan requires a minimum total prize pool of ${formatCurrencyFromCents(planFeatures.minContestBudget)}.`;
            }

            for (let i = 0; i < winnerCount; i++) {
                if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
                    return `Prize for Winner ${i + 1} must be at least ${formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}`;
                }
                if (winnerAmounts[i] > MAX_PRIZE_PER_WINNER) {
                    return `Prize for Winner ${i + 1} cannot exceed ${formatCurrencyFromCents(MAX_PRIZE_PER_WINNER)}`;
                }
            }
        }

        if (contestType === 'cpm') {
            const planFeatures = getPlanFeatures(userPlan);
            const parsedCpmRate = typeof cpmRate === 'string' ? parseFloat(cpmRate) : cpmRate;
            const parsedTotalBudget = typeof totalBudget === 'string' ? parseFloat(totalBudget) : totalBudget;

            if (!parsedCpmRate || parsedCpmRate <= 0) {
                return "CPM rate must be a positive number.";
            }

            if (!parsedTotalBudget || (parsedTotalBudget * 100) < planFeatures.minContestBudget) {
                return `Your current plan requires a minimum total budget of ${formatCurrencyFromCents(planFeatures.minContestBudget)}.`;
            }

            if (!termsConditions || termsConditions.trim() === "") {
                return "Terms and conditions are required for CPM contests.";
            }
        }

        return null;
    };

    // Payment success handler
    const handlePaymentSuccess = async (paymentDetails: any) => {
        console.log("Payment successful:", paymentDetails);
        setShowPayment(false);

        try {
            // Handle budget changes - both increases and decreases
            if (budgetChanged && Math.abs(budgetDifference) > 0) {
                console.log("🔄 Processing budget change:", {
                    budgetDifference,
                    isIncrease: budgetDifference > 0,
                    isDecrease: budgetDifference < 0
                });

                // Handle budget decrease (refund) - only if not already processed
                if (budgetDifference < 0 && paymentDetails.paymentMethod !== 'refund') {
                    // Calculate total refund amount: prize pool decrease + commission on that decrease
                    const prizePoolDecrease = Math.abs(budgetDifference);
                    const commissionPercentage = getPlanFeatures(userPlan).commissionPercentage;
                    const commissionRefund = Math.round(prizePoolDecrease * (commissionPercentage / 100));
                    const totalRefundAmount = prizePoolDecrease + commissionRefund;

                    console.log(`💰 Processing refund: ${prizePoolDecrease} cents prize pool + ${commissionRefund} cents commission = ${totalRefundAmount} cents total`);

                    // Call refund API endpoint
                    const response = await fetch('/api/payments/refund', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contestId,
                            refundAmount: totalRefundAmount,
                            reason: 'Contest budget decreased'
                        }),
                    });

                    const refundResult = await response.json();

                    if (!response.ok || !refundResult.success) {
                        throw new Error(refundResult.error || 'Failed to process refund');
                    }

                    console.log("✅ Refund processed successfully");

                    // Show detailed refund breakdown if available
                    const refundMessage = refundResult.breakdown
                        ? `Prize pool reduced by $${refundResult.breakdown.prizePoolReduction.toFixed(2)}. Refunded: $${refundResult.breakdown.prizePoolReduction.toFixed(2)} + $${refundResult.breakdown.commissionRefund.toFixed(2)} commission = $${refundResult.breakdown.totalRefunded.toFixed(2)} total.`
                        : `$${(totalRefundAmount / 100).toFixed(2)} has been refunded to your wallet`;

                    toast({
                        title: "Refund Processed",
                        description: refundMessage,
                        variant: "default",
                    });
                } else if (budgetDifference < 0 && paymentDetails.paymentMethod === 'refund') {
                    console.log("✅ Refund already processed, skipping duplicate refund processing");
                }

                // Update ALL contest data in database after payment (including any edits made)
                console.log("💾 Updating complete contest data in database after payment...");

                const contestBasedDetails = contestType === 'leaderboard'
                    ? {
                        leaderboard_contest: {
                            prizes: winnerAmounts.map((amount, index) => ({
                                position: index + 1,
                                amount: amount
                            })),
                            total_prize: winnerAmounts.reduce((sum, amount) => sum + amount, 0),
                            winner_count: winnerCount
                        }
                    }
                    : {
                        cpm_contest: {
                            cpm_rate_usd: parseFloat(cpmRate.toString()),
                            min_views: minViews ? parseInt(minViews.toString()) : null,
                            max_views: maxViews ? parseInt(maxViews.toString()) : null,
                            total_budget: Math.round(parseFloat(totalBudget.toString()) * 100),
                            terms_conditions: termsConditions
                        }
                    };

                // Prepare complete contest update with ALL form data
                const contestUpdate = {
                    title: title.trim(),
                    category,
                    brief_html: briefHtml,
                    brief_json: briefJson,
                    rules_html: rulesHtml,
                    rules_json: rulesJson,
                    start_date: toUTCISOString(startDate, startTime),
                    end_date: toUTCISOString(endDate, endTime),
                    inspiration_links: inspirationLinks.filter(link => link.url.trim() !== ""),
                    resources: {
                        ...resources, ...Object.fromEntries(
                            Object.entries(resourceFiles).map(([key, file]) => [key, file.name])
                        )
                    },
                    contest_type: contestType,
                    contest_based_details: contestBasedDetails,
                    moderation_status: 'draft' // Save as draft after successful payment
                };

                // Update contest with complete data
                if (!user?.id) {
                    throw new Error('User not authenticated');
                }

                const { error: updateError } = await supabase
                    .from('contests')
                    .update(contestUpdate)
                    .eq('id', contestId)
                    .eq('advertiser_id', user.id);

                if (updateError) {
                    console.error("❌ Failed to update complete contest data:", updateError);
                    throw new Error(`Failed to update contest: ${updateError.message}`);
                }

                console.log("✅ Complete contest data updated in database after payment");

            } else {
                // No budget change - save all current form data as draft after successful payment
                console.log("📝 No budget change - saving all form data as draft after payment");

                // Prepare contest data update with all current form data
                const contestBasedDetails = contestType === 'leaderboard'
                    ? {
                        leaderboard_contest: {
                            prizes: winnerAmounts.map((amount, index) => ({
                                position: index + 1,
                                amount: amount
                            })),
                            total_prize: winnerAmounts.reduce((sum, amount) => sum + amount, 0),
                            winner_count: winnerCount
                        }
                    }
                    : {
                        cpm_contest: {
                            cpm_rate_usd: parseFloat(cpmRate.toString()),
                            min_views: minViews ? parseInt(minViews.toString()) : null,
                            max_views: maxViews ? parseInt(maxViews.toString()) : null,
                            total_budget: Math.round(parseFloat(totalBudget.toString()) * 100),
                            terms_conditions: termsConditions
                        }
                    };

                const contestUpdate = {
                    title: title.trim(),
                    category,
                    brief_html: briefHtml,
                    brief_json: briefJson,
                    rules_html: rulesHtml,
                    rules_json: rulesJson,
                    start_date: toUTCISOString(startDate, startTime),
                    end_date: toUTCISOString(endDate, endTime),
                    inspiration_links: inspirationLinks.filter(link => link.url.trim() !== ""),
                    resources: {
                        ...resources, ...Object.fromEntries(
                            Object.entries(resourceFiles).map(([key, file]) => [key, file.name])
                        )
                    },
                    contest_type: contestType,
                    contest_based_details: contestBasedDetails,
                    moderation_status: 'draft' // Save as draft after successful payment
                };

                const { data: updatedContest, error: updateError } = await supabase
                    .from('contests')
                    .update(contestUpdate)
                    .eq('id', contestId)
                    .select()
                    .single();

                if (updateError) {
                    console.error("❌ Failed to save contest as draft:", updateError);
                    throw new Error(`Failed to save contest: ${updateError.message}`);
                }

                console.log("✅ Contest saved as draft with all form data after payment");
            }

            toast({
                title: "Payment Successful",
                description: budgetChanged && budgetDifference !== 0
                    ? budgetDifference > 0
                        ? "Additional payment processed, contest saved as draft. Submitting for approval..."
                        : "Refund processed, contest saved as draft. Submitting for approval..."
                    : "Payment completed, contest saved as draft. Submitting for approval...",
                variant: "default",
            });

            // Reset budget change tracking since payment is now complete
            setBudgetChanged(false);
            setBudgetDifference(0);

            // Update originalBudget to the new budget to prevent false change detection
            if (contestType === 'leaderboard') {
                const newTotalPrize = winnerAmounts.reduce((sum, amount) => sum + amount, 0);
                setOriginalBudget(newTotalPrize);
            } else if (contestType === 'cpm') {
                const newBudgetInCents = Math.round(parseFloat(totalBudget.toString()) * 100);
                setOriginalBudget(newBudgetInCents);
            }

            // Refresh contest data to show updated payment details
            await refreshContestData();

            // Force a re-render by clearing and resetting budget change detection
            console.log("🔄 Forcing budget change check to clear any residual state...");
            setTimeout(() => {
                if (contestType === 'leaderboard') {
                    checkBudgetChange(winnerAmounts);
                } else if (contestType === 'cpm') {
                    checkBudgetChange(undefined, totalBudget.toString());
                }
            }, 100);

            // Now submit for approval using the moderation API with retries
            const submitForApproval = async (retries = 3, delay = 2000) => {
                for (let attempt = 1; attempt <= retries; attempt++) {
                    try {
                        console.log(`Submission attempt ${attempt}/${retries} for contest ${contestId}`);

                        const response = await fetch(`/api/contests/${contestId}/moderation`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                action: 'submit_for_approval'
                            }),
                        });

                        const result = await response.json();

                        if (response.ok && result.success) {
                            toast({
                                title: "Success",
                                description: "Contest submitted for approval successfully!",
                                variant: "default",
                            });
                            router.push(`/dashboard/contests/${contestId}`);
                            return;
                        } else {
                            throw new Error(result.error || 'Failed to submit for approval');
                        }
                    } catch (error: any) {
                        console.log(`Attempt ${attempt} failed:`, error.message);

                        if (attempt === retries) {
                            toast({
                                title: "Submission Failed",
                                description: `Failed to submit contest for approval: ${error.message}`,
                                variant: "destructive",
                            });
                            return;
                        }

                        // Wait before retrying
                        console.log(`Waiting ${delay}ms before retry ${attempt + 1}...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            };

            await submitForApproval();

        } catch (error: any) {
            console.error("❌ Error in payment success handler:", error);
            toast({
                title: "Update Failed",
                description: `Payment succeeded but failed to update contest: ${error.message}`,
                variant: "destructive",
            });
        }
    };

    // Payment error handler
    const handlePaymentError = (error: string) => {
        console.error("Payment failed:", error);
        setShowPayment(false);
        toast({
            title: "Payment Failed",
            description: error,
            variant: "destructive",
        });
    };

    // Budget change detection helper
    const checkBudgetChange = (newWinnerAmounts?: number[], newTotalBudget?: string) => {
        let currentPrizePool = 0;

        if (contestType === 'leaderboard') {
            const amounts = newWinnerAmounts || winnerAmounts;
            currentPrizePool = amounts.reduce((sum: number, amount: number) => sum + amount, 0);
        } else if (contestType === 'cpm') {
            const budget = newTotalBudget || totalBudget;
            currentPrizePool = Math.round(parseFloat(budget.toString()) * 100); // Convert to cents
        }

        // Calculate ONLY the prize pool difference (for better UX)
        const prizePoolDifference = currentPrizePool - originalBudget;

        setBudgetDifference(prizePoolDifference); // Store prize pool difference only
        setBudgetChanged(Math.abs(prizePoolDifference) > 0);

        console.log("💰 Budget change check:", {
            contestType,
            originalBudget,
            currentPrizePool,
            prizePoolDifference,
            budgetChanged: Math.abs(prizePoolDifference) > 0,
            newWinnerAmounts: newWinnerAmounts?.slice(0, 3),
            newTotalBudget
        });

        return { currentBudget: currentPrizePool, difference: prizePoolDifference };
    };

    // Update budget change detection when prize amounts change
    const updateBudgetTracking = (amounts = winnerAmounts) => {
        checkBudgetChange(amounts);
    };

    // Handle save as draft for rejected contests
    const handleSaveAsDraft = async () => {
        await handleSubmitWithStatus('draft');
        // Refresh contest data after saving to ensure UI is up to date
        await refreshContestData();
    };

    // Handle resubmit for approval for rejected contests  
    const handleResubmitForApproval = async () => {
        // First validate the form
        const validationError = validateFormForSubmission();
        if (validationError) {
            toast({
                title: "Validation Error",
                description: validationError,
                variant: "destructive",
            });
            setFormFeedback(validationError);
            setFormFeedbackType("error");
            return;
        }

        // Check if payment has been completed
        if (!contest) {
            toast({
                title: "Error",
                description: "Contest data not loaded. Please refresh the page.",
                variant: "destructive",
            });
            return;
        }

        // Check if payment/refund processing is required 
        // - New contest (no payment) OR budget increased (need payment) OR budget decreased (need refund)
        const paymentProcessingRequired = !isContestPaid() || (budgetChanged && budgetDifference !== 0);

        console.log("🔍 Payment validation:", {
            isContestPaid: isContestPaid(),
            budgetChanged,
            budgetDifference,
            originalBudget,
            currentPrizePool: contestType === 'leaderboard'
                ? winnerAmounts.reduce((sum: number, amount: number) => sum + amount, 0)
                : Math.round(parseFloat(totalBudget.toString()) * 100),
            paymentProcessingRequired
        });

        if (paymentProcessingRequired) {
            const reason = !isContestPaid()
                ? "No payment"
                : budgetDifference > 0
                    ? "Budget increased"
                    : "Budget decreased";
            console.log("Payment processing required for contest submission:", reason);

            // Handle budget decrease (refund) immediately without payment modal
            if (budgetChanged && budgetDifference < 0) {
                try {
                    setIsSubmitting(true);

                    // Calculate total refund amount: prize pool decrease + commission on that decrease
                    const prizePoolDecrease = Math.abs(budgetDifference);
                    const commissionPercentage = getPlanFeatures(userPlan).commissionPercentage;
                    const commissionRefund = Math.round(prizePoolDecrease * (commissionPercentage / 100));
                    const totalRefundAmount = prizePoolDecrease + commissionRefund;

                    console.log(`💰 Processing refund: ${prizePoolDecrease} cents prize pool + ${commissionRefund} cents commission = ${totalRefundAmount} cents total`);

                    // Call refund API endpoint
                    const response = await fetch('/api/payments/refund', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contestId,
                            refundAmount: totalRefundAmount,
                            reason: 'Contest budget decreased'
                        }),
                    });

                    const refundResult = await response.json();

                    if (!response.ok || !refundResult.success) {
                        throw new Error(refundResult.error || 'Failed to process refund');
                    }

                    console.log("✅ Refund processed successfully");

                    // Show detailed refund breakdown if available
                    const refundMessage = refundResult.breakdown
                        ? `Prize pool reduced by $${refundResult.breakdown.prizePoolReduction.toFixed(2)}. Refunded: $${refundResult.breakdown.prizePoolReduction.toFixed(2)} + $${refundResult.breakdown.commissionRefund.toFixed(2)} commission = $${refundResult.breakdown.totalRefunded.toFixed(2)} total.`
                        : `$${(totalRefundAmount / 100).toFixed(2)} has been refunded to your wallet`;

                    toast({
                        title: "Refund Processed",
                        description: refundMessage,
                        variant: "default",
                    });

                    // Now call handlePaymentSuccess to update contest structure
                    await handlePaymentSuccess({
                        paymentMethod: 'refund',
                        refundAmount: totalRefundAmount
                    });

                } catch (error) {
                    console.error("Error processing refund:", error);
                    toast({
                        title: "Error",
                        description: "Failed to process refund. Please try again.",
                        variant: "destructive",
                    });
                } finally {
                    setIsSubmitting(false);
                }
                return;
            }

            // For budget increases or new payments, show payment modal
            try {
                setIsSubmitting(true);

                // CRITICAL: Run comprehensive validation BEFORE processing payment
                const validationError = validateFormForSubmission();
                if (validationError) {
                    toast({
                        title: "Validation Error",
                        description: validationError,
                        variant: "destructive",
                    });
                    setFormFeedback(validationError);
                    setFormFeedbackType("error");
                    setIsSubmitting(false);
                    return;
                }

                await handleSubmitWithStatus('draft', true); // Skip redirect since we're showing payment modal

                // After successful save, show payment modal
                setShowPayment(true);
                setIsPaymentRequired(true);
            } catch (error) {
                console.error("Error saving contest before payment:", error);
                toast({
                    title: "Error",
                    description: "Failed to save contest data before payment. Please try again.",
                    variant: "destructive",
                });
            } finally {
                setIsSubmitting(false);
            }
        } else {
            // Payment already completed, save any pending edits and submit for approval
            try {
                setIsSubmitting(true);

                // First save any pending edits to the contest data
                console.log("💾 Saving any pending edits before submitting for approval...");
                await handleSubmitWithStatus('draft', true); // Save as draft first

                // Then submit for approval using moderation API
                const response = await fetch(`/api/contests/${contestId}/moderation`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'submit_for_approval'
                    }),
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    toast({
                        title: "Success",
                        description: "Contest updated and submitted for approval successfully!",
                        variant: "default",
                    });
                    router.push(`/dashboard/contests/${contestId}`);
                } else {
                    throw new Error(result.error || 'Failed to submit for approval');
                }
            } catch (error: any) {
                console.error("Error submitting for approval:", error);
                toast({
                    title: "Submission Failed",
                    description: error.message || "Failed to submit contest for approval. Please try again.",
                    variant: "destructive",
                });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // Modified submit function that accepts a moderation status and skipRedirect option
    const handleSubmitWithStatus = async (moderationStatus?: 'draft' | 'pending_approval', skipRedirect: boolean = false) => {
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

            const validInspirationLinks = inspirationLinks.filter(link => link.url.trim() !== "");
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
                inspiration_links: inspirationLinks.filter(link => link.url.trim() !== ""),
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
                if (durationMs < oneDayMs) {
                    toast({
                        title: "Invalid Duration",
                        description: "Contest duration must be at least 24 hours (minimum 1 day).",
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
                    description: `Your current plan requires a minimum total prize pool of ${formatCurrencyFromCents(planFeatures.minContestBudget)}.`,
                    variant: "destructive",
                });
                setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
            }
            for (let i = 0; i < winnerCount; i++) {
                if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
                    toast({
                        title: "Prize Amount Too Low",
                        description: `Prize for Winner ${i + 1} must be at least ${formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}`,
                        variant: "destructive",
                    });
                    setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
                }
                if (winnerAmounts[i] > MAX_PRIZE_PER_WINNER) {
                    toast({
                        title: "Prize Amount Too High",
                        description: `Prize for Winner ${i + 1} cannot exceed ${formatCurrencyFromCents(MAX_PRIZE_PER_WINNER)}`,
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
                    description: `Your current plan requires a minimum total budget of ${formatCurrencyFromCents(planFeatures.minContestBudget)}.`,
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

        // Validate active contest limits when submitting for approval
        if (moderationStatus === 'pending_approval') {
            try {
                // Import getActiveContestCount for custom validation
                const { getActiveContestCount } = await import('@/lib/contest-utils-client');
                const countResult = await getActiveContestCount(user.id);

                if (!countResult.success) {
                    toast({
                        title: "Validation Error",
                        description: countResult.error || "Unable to validate contest limits. Please try again.",
                        variant: "destructive",
                    });
                    setIsSubmitting(false);
                    if (submitTimeoutId) clearTimeout(submitTimeoutId);
                    return;
                }

                // Check if current contest would be considered "new" active contest
                // If it's currently draft or rejected, then changing to pending_approval adds +1 to active count
                let effectiveActiveCount = countResult.activeCount;
                if (contest.moderation_status === 'draft' || contest.moderation_status === 'rejected') {
                    effectiveActiveCount += 1; // This contest will become active
                }

                if (effectiveActiveCount > planFeatures.maxActiveContests) {
                    toast({
                        title: "Active Contest Limit Exceeded",
                        description: `You have reached your plan's limit of ${planFeatures.maxActiveContests} active contests. You currently have ${countResult.activeCount} active contests. Please upgrade your plan or wait for existing contests to end.`,
                        variant: "destructive",
                    });
                    setIsSubmitting(false);
                    if (submitTimeoutId) clearTimeout(submitTimeoutId);
                    return;
                }
            } catch (error: any) {
                console.error("Error checking active contest limit:", error);
                toast({
                    title: "Validation Error",
                    description: "Unable to validate contest limits. Please try again.",
                    variant: "destructive",
                });
                setIsSubmitting(false);
                if (submitTimeoutId) clearTimeout(submitTimeoutId);
                return;
            }
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

            // Only redirect if not skipping redirect (e.g., when preparing for payment)
            if (!skipRedirect) {
                // For draft saves, redirect to contests list; for other updates, go to contest detail
                if (moderationStatus === 'draft') {
                    router.push('/dashboard/contests');
                } else {
                    router.push(`/dashboard/contests/${contestId}`);
                }
            }
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

    // Add these handlers near the thumbnail logic
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragActive(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragActive(false);
    };
    const handleThumbnailDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setThumbnail(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setThumbnailPreview(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleResourceDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setResourceFile(file);
            // For image files, create a preview
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        setResourceFilePreview(e.target.result as string);
                    }
                };
                reader.readAsDataURL(file);
            } else {
                setResourceFilePreview(`file-type:${file.type}`);
            }
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
                            {subscriptionPlans.find(p => p.id === userPlan)?.name || 'EXPLORER'}
                            <span className="ml-4 text-sm text-blue-700">
                                • Max Winners: {planFeatures.maxWinnersPerContest}
                                • Min Prize Pool: {formatCurrencyFromCents(planFeatures.minContestBudget)}
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
                                <div
                                    className={`border-2 border-dashed rounded-lg p-4 transition-colors duration-200 cursor-pointer ${isDragActive ? "border-rose-500 bg-rose-50" : "border-gray-300 bg-white"}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleThumbnailDrop}
                                    tabIndex={0}
                                    role="button"
                                    aria-label="Upload thumbnail"
                                >
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
                                                    {thumbnail?.size ? ` · ${(thumbnail.size / (1024 * 1024)).toFixed(2)}MB` : ""}
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
                                        <div className="flex flex-col items-center justify-center h-40">
                                            <Image className="h-16 w-16 text-gray-400 mb-2" />
                                            <p className="text-sm font-medium mb-1">
                                                Drag, drop or browse <span className="text-rose-500">thumbnail</span>
                                            </p>
                                            <p className="text-xs text-gray-500 mb-4">Max file size: 5MB</p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
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

                    {/* Resources for Participants Section */}
                    {!datesOnly && (
                        <Card className="mb-8">
                            <CardHeader>
                                <CardTitle>Resources for Participants <span className="text-red-500">*</span></CardTitle>
                                <CardDescription>
                                    Provide at least one resource to help participants understand your brand and contest requirements. You can upload assets (logos, guidelines, examples) <b>or</b> add external links (website, social media, portfolio).
                                </CardDescription>
                                <span className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-full font-medium mt-2">At least one required</span>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Asset Upload */}
                                <div className="flex flex-col gap-6">
                                    <div className={`border-2 border-dashed rounded-lg p-6 transition-colors duration-200 cursor-pointer ${isDragActive ? 'border-rose-500 bg-rose-50' : 'border-gray-300 bg-white'}`}
                                        onClick={() => resourceFileRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleResourceDrop}
                                        tabIndex={0}
                                        role="button"
                                        aria-label="Upload asset">
                                        {resourceFilePreview ? (
                                            <div className="relative">
                                                <img src={resourceFilePreview} alt="Preview" className="mx-auto max-h-48 object-contain" />
                                                <div className="mt-2 flex justify-between items-center">
                                                    <span className="text-sm text-gray-500">{resourceFile?.name}</span>
                                                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); removeResourceFile(); }} className="text-red-500"><Trash className="h-4 w-4 mr-1" /> Remove</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-32">
                                                <Upload className="h-10 w-10 text-gray-400 mb-2" />
                                                <p className="text-sm font-medium mb-1">Drag, drop or browse file</p>
                                                <p className="text-xs text-gray-500 mb-2">Max file size: 20MB</p>
                                                <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); resourceFileRef.current?.click(); }}><Upload className="h-4 w-4 mr-2" /> Upload</Button>
                                                <input type="file" ref={resourceFileRef} className="hidden" onChange={handleResourceFileChange} />
                                            </div>
                                        )}
                                    </div>
                                    {/* File Description and Add Button */}
                                    {resourceFile && (
                                        <div className="mt-4 flex flex-col gap-4 items-end">
                                            <div className="flex-1 w-full">
                                                <Label htmlFor="fileDescription">Description <span className="text-red-500">*</span></Label>
                                                <Input id="fileDescription" placeholder="Describe this asset" value={resourceDescription} onChange={e => setResourceDescription(e.target.value)} />
                                            </div>
                                            <Button type="button" onClick={addFileResource} disabled={!resourceDescription} className="w-full">Add Asset</Button>
                                        </div>
                                    )}
                                    {assetUploadError && <div className="text-red-500 text-sm mt-2">{assetUploadError}</div>}
                                </div>
                                {/* Or Separator */}
                                <div className="flex items-center my-4">
                                    <div className="flex-grow border-t border-gray-300"></div>
                                    <span className="mx-4 text-gray-500 font-semibold">Or</span>
                                    <div className="flex-grow border-t border-gray-300"></div>
                                </div>
                                {/* External Link Input */}
                                <div className="border rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
                                    <Label htmlFor="resourceLinkUrl">External Link</Label>
                                    <Input id="resourceLinkUrl" type="url" placeholder="https://example.com/resource" value={newResourceUrl} onChange={e => setNewResourceUrl(e.target.value)} className="mb-2" />
                                    <Label htmlFor="resourceLinkDescription">Description <span className="text-red-500">*</span></Label>
                                    <Input id="resourceLinkDescription" placeholder="Describe this link" value={externalResourceDescription} onChange={e => setExternalResourceDescription(e.target.value)} className="mb-2" />
                                    <Button type="button" onClick={addExternalResource} disabled={!newResourceUrl || !externalResourceDescription} className="w-full">Add Link</Button>
                                    {externalLinkError && <div className="text-red-500 text-sm mt-1">{externalLinkError}</div>}
                                </div>
                                {/* Resource List */}
                                <div className="mt-8">
                                    <h4 className="text-md font-medium mb-2">Assets & Resources</h4>
                                    {Object.keys(resources).length === 0 && <div className="text-gray-500">No assets or links added yet.</div>}
                                    <ul className="space-y-3">
                                        {Object.entries(resources).map(([name, url]) => {
                                            const isImage = url.startsWith('data:image');
                                            const isFile = url.startsWith('data:') && !isImage;
                                            const isLink = !url.startsWith('data:') && !url.includes('supabase');
                                            return (
                                                <li key={name} className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                                                    {isImage && (
                                                        <img src={url} alt={name} className="w-12 h-12 object-cover rounded mr-3" />
                                                    )}
                                                    {isFile && <Upload className="w-8 h-8 text-blue-500 mr-3" />}
                                                    {isLink && <ExternalLink className="w-8 h-8 text-green-500 mr-3" />}
                                                    <div className="flex-1">
                                                        <div className="font-medium">{name}</div>
                                                        {isImage && (
                                                            <div className="text-xs text-gray-500">
                                                                {resourceFiles[name]?.name}
                                                                {resourceFiles[name]?.size && (
                                                                    <> · {(resourceFiles[name].size / (1024 * 1024)).toFixed(2)} MB</>
                                                                )}
                                                            </div>
                                                        )}
                                                        {isFile && (
                                                            <div className="text-xs text-gray-500">
                                                                {resourceFiles[name]?.name}
                                                                {resourceFiles[name]?.size && (
                                                                    <> · {(resourceFiles[name].size / (1024 * 1024)).toFixed(2)} MB</>
                                                                )}
                                                            </div>
                                                        )}
                                                        {isLink && (
                                                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">{url}</a>
                                                        )}
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => removeResource(name)} className="text-red-500"><Trash className="h-4 w-4" /></Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Inspiration Content Section */}
                    {!datesOnly && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Inspiration Content <span className="text-red-500">*</span></CardTitle>
                                <CardDescription>
                                    Help creators understand your vision by adding at least one inspiration link (Instagram, YouTube, TikTok, etc.) with a description.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {inspirationError && <div className="text-red-500 text-sm mb-2">{inspirationError}</div>}
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="inspirationUrlInput">Inspiration Link</Label>
                                    <Input id="inspirationUrlInput" type="url" placeholder="https://instagram.com/example" value={newInspirationUrl} onChange={e => setNewInspirationUrl(e.target.value)} />
                                    <Label htmlFor="inspirationDescriptionInput">Inspiration Description <span className="text-red-500">*</span></Label>
                                    <Input id="inspirationDescriptionInput" placeholder="Add description here*" value={newInspirationDescription} onChange={e => setNewInspirationDescription(e.target.value)} />
                                    <Button type="button" onClick={addInspiration} className="w-full mt-2" disabled={!newInspirationUrl || !newInspirationDescription}>Add Inspiration</Button>
                                </div>
                                {/* Inspiration List */}
                                {inspirationLinks.length > 0 && (
                                    <ul className="space-y-3 mt-6">
                                        {inspirationLinks.map((item, index) => (
                                            <li key={index} className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                                                <ExternalLink className="w-8 h-8 text-rose-500 mr-2" />
                                                <div className="flex-1">
                                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline break-all">{item.url}</a>
                                                    <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => setInspirationLinks(inspirationLinks.filter((_, i) => i !== index))} className="text-red-500"><Trash className="h-4 w-4" /></Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    )}

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
                            Contest duration must be at least 24 hours (minimum 1 day).
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
                                    <span className="text-lg font-bold">{formatCurrencyFromCents(totalPrizePool)}</span>
                                </div>
                            </div>

                            {/* Plan Requirements Info */}
                            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    <span className="font-medium">Plan Requirements: </span>
                                    Minimum total prize pool: <strong>{formatCurrencyFromCents(planFeatures.minContestBudget)}</strong>
                                    • Maximum winners: <strong>{planFeatures.maxWinnersPerContest}</strong>
                                    • Minimum per winner: <strong>{formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}</strong>
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
                                                    updateBudgetTracking(newAmounts);
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
                                                    updateBudgetTracking(newAmounts);
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
                                                    updateBudgetTracking(newAmounts);

                                                    // Show toast validation messages instead of setValidationError
                                                    if (value < MIN_PRIZE_PER_WINNER) {
                                                        toast({
                                                            title: "Prize Amount Too Low",
                                                            description: `Prize amount cannot be less than ${formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}`,
                                                            variant: "destructive",
                                                        });
                                                    } else if (value > MAX_PRIZE_PER_WINNER) {
                                                        toast({
                                                            title: "Prize Amount Too High",
                                                            description: `Prize amount cannot exceed ${formatCurrencyFromCents(MAX_PRIZE_PER_WINNER)}`,
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
                                            <span>Min: {formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Enhanced validation message for minimum total prize pool */}
                            {totalPrizePool < planFeatures.minContestBudget && (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertDescription>
                                        ⚠️ The minimum prize pool for your current plan is {formatCurrencyFromCents(planFeatures.minContestBudget)}.
                                        Current total: {formatCurrencyFromCents(totalPrizePool)}. Please increase prize amounts.
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
                                        onChange={(e) => {
                                            setTotalBudget(e.target.value);
                                            checkBudgetChange(undefined, e.target.value);
                                        }}
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
                                {/* Prize Pool Change Warning */}
                                {budgetChanged && isContestPaid() && (
                                    <div className="w-full mb-4">
                                        <Alert variant={budgetDifference > 0 ? "destructive" : "default"} className={budgetDifference > 0 ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}>
                                            <AlertTriangle className="h-4 w-4" />
                                            <div>
                                                <div className="font-medium">Prize Pool Changed</div>
                                                <div className="text-sm mt-1">
                                                    {budgetDifference > 0
                                                        ? `Prize pool increased by ${formatCurrencyFromCents(budgetDifference)}. Additional payment (including commission) will be required.`
                                                        : `Prize pool decreased by ${formatCurrencyFromCents(Math.abs(budgetDifference))}. You will be refunded this amount plus commission.`
                                                    }
                                                </div>
                                            </div>
                                        </Alert>
                                    </div>
                                )}

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
                                    {isSubmitting ? "Processing..." :
                                        (contest && isContestPaid() && !budgetChanged) ? "Submit for Approval" :
                                            (contest && isContestPaid() && budgetChanged && budgetDifference > 0) ? "Update & Pay" :
                                                (contest && isContestPaid() && budgetChanged && budgetDifference < 0) ? "Update Contest" :
                                                    "Submit & Pay"}
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

            {/* Payment Modal */}
            {showPayment && contest && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Contest Payment</h2>
                                <p className="text-gray-600">Complete payment to submit your contest for review</p>
                            </div>

                            {budgetChanged && budgetDifference > 0 && (
                                <Alert className="mb-4 border-orange-200 bg-orange-50">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        <strong>Prize Pool Increased:</strong> Your prize pool increased by {formatCurrencyFromCents(budgetDifference)}. The payment below includes this amount plus commission.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <ContestPaymentSelection
                                contestAmount={budgetChanged && budgetDifference > 0
                                    ? budgetDifference / 100 // Prize pool increase amount in dollars
                                    : contestType === "leaderboard"
                                        ? winnerAmounts.reduce((sum, amount) => sum + (amount || 0), 0) / 100  // Convert cents to dollars
                                        : (parseFloat(totalBudget.toString()) || 0)} // Budget is already in dollars
                                contestTitle={title || "Untitled Contest"}
                                contestId={contestId}
                                commissionPercentage={getPlanFeatures(userPlan).commissionPercentage}
                                onPaymentSuccess={handlePaymentSuccess}
                                onPaymentError={handlePaymentError}
                                disabled={isSubmitting}
                                isIncrease={budgetChanged && budgetDifference > 0}
                                isDecrease={budgetChanged && budgetDifference < 0}
                            />

                            <div className="mt-6 flex justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowPayment(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
} 