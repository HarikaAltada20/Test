"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Image,
  Trash,
  Upload,
  ExternalLink,
  Check,
  Crown,
  Info,
  AlertTriangle,
  File,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import {
  toLocalDateTimeStrings,
  toUTCISOString,
  validateImageFile,
} from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import {
  DEFAULT_PRIZE_ALLOCATIONS,
  MAX_PRIZE_PER_WINNER,
  MIN_PRIZE_PER_WINNER,
  MIN_CPM_RATE,
  MAX_CPM_RATE,
  MIN_DAYS_UNTIL_START,
  MIN_CONTEST_DURATION_DAYS,
  MAX_CONTEST_DURATION_DAYS,
  subscriptionPlans,
  PRODUCT_IDS,
  DEFAULT_TOTAL_PRIZE_POOL,
  DEFAULT_WINNER_AMOUNTS,
  DEFAULT_WINNER_COUNT,
  TOAST_DURATION_LONG,
  TOAST_DURATION_SHORT,
  API_TIMEOUT_MEDIUM,
  FORM_PLACEHOLDER_SMALL_AMOUNT,
  FORM_PLACEHOLDER_LARGE_AMOUNT,
} from "@/constants/subscriptionPlans";
import { createClient } from "@/utils/supabase/client";
import { UserResponse } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { ContestPaymentSelection } from "@/components/ContestPaymentSelection";
import dynamic from "next/dynamic";
import { canCreateNewContest } from "@/lib/contest-utils-client";

// Dynamically import the Novel editor
const NovelEditor = dynamic(() => import("@/components/novel-editor"), {
  ssr: false,
});

type PlanFeatures = {
  maxActiveContests: number;
  minContestBudget: number;
  maxWinnersPerContest: number;
  commissionPercentage: number; // Make sure this matches your DB json_features key
};

type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  features: PlanFeatures;
};

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

// Add ResourceItem type definition
type ResourceItem = {
  url: string;
  description: string;
  type: "internal" | "external";
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
  resources: ResourceItem[] | null;
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
  subscription_info_of_user?: any | null;
  prizes?: { position: number; amount: number }[];
  total_prize?: number;
  winner_count?: number;
};

export default function EditContestPage({ user, contestId, datesOnly = false, isAdmin = false }: { user: UserResponse["data"]["user"], contestId: string, datesOnly?: boolean, isAdmin?: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false); // Separate state for submission loading
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [contest, setContest] = useState<ContestData | null>(null)

  // State for subscription plans and user plan
  const [dbSubscriptionPlans, setDbSubscriptionPlans] = useState<
    SubscriptionPlan[]
  >([]);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [isUserPlanLoading, setIsUserPlanLoading] = useState(true);

  // Common contest fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("technology"); // Or consider platform if that's more accurate
  const [briefHtml, setBriefHtml] = useState("");
  const [briefJson, setBriefJson] = useState<any>(null);
  const [rulesHtml, setRulesHtml] = useState("");
  const [rulesJson, setRulesJson] = useState<any>(null);
  const [showRulesPreview, setShowRulesPreview] = useState(false);
  const [showBriefPreview, setShowBriefPreview] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [inspirationLinks, setInspirationLinks] = useState<
    { url: string; description: string }[]
  >([]);
  const [newInspirationUrl, setNewInspirationUrl] = useState("");
  const [newInspirationDescription, setNewInspirationDescription] =
    useState("");
  const [inspirationError, setInspirationError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const richTextEditorRef = useRef<any>(null);
  const rulesRichTextEditorRef = useRef<any>(null);

  // Contest Type and Specific Details
  const [contestType, setContestType] = useState<"leaderboard" | "cpm" | null>(
    null
  );

  // Leaderboard specific
  const [winnerCount, setWinnerCount] = useState<number>(3);
  const [winnerAmounts, setWinnerAmounts] = useState<number[]>([
    5000, 3000, 2000,
  ]); // Note: these amounts are in cents if formatCurrencyFromCents expects cents

  // CPM specific
  const [cpmRate, setCpmRate] = useState<number | string>(""); // Store as string for input, parse to number for saving
  const [minViews, setMinViews] = useState<number | string>("");
  const [maxViews, setMaxViews] = useState<number | string>("");
  const [totalBudget, setTotalBudget] = useState<number | string>("");
  const [termsConditions, setTermsConditions] = useState<string>("");

  // Resources State Variables
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resourceFilePreview, setResourceFilePreview] = useState<string | null>(
    null
  );
  const [resourceDescription, setResourceDescription] = useState("");
  const [externalResourceDescription, setExternalResourceDescription] =
    useState("");
  const [newExternalResourceUrl, setNewExternalResourceUrl] = useState("");
  const resourceFileRef = useRef<HTMLInputElement>(null);
  const [resourceSuccess, setResourceSuccess] = useState<string | null>(null);
  const [resourceError, setResourceError] = useState<string | null>(null);

  // State for bottom error display
  const [formFeedback, setFormFeedback] = useState<string | null>(null);
  const [formFeedbackType, setFormFeedbackType] = useState<
    "error" | "success" | null
  >(null);

  // Payment state management
  const [showPayment, setShowPayment] = useState(false);
  const [isPaymentRequired, setIsPaymentRequired] = useState(false);

  // Refund preview modal state
  const [showRefundPreview, setShowRefundPreview] = useState(false);
  const [refundDetails, setRefundDetails] = useState<{
    prizePoolDecrease: number;
    commissionRefund: number;
    totalRefund: number;
    commissionPercentage: number;
  } | null>(null);

  // Budget change tracking
  const [originalBudget, setOriginalBudget] = useState<number>(0); // Store original budget in cents
  const [budgetChanged, setBudgetChanged] = useState(false);
  const [budgetDifference, setBudgetDifference] = useState<number>(0); // Positive = increase, Negative = decrease

  // Add at the top with other useState hooks
  const [isDragActive, setIsDragActive] = useState(false);
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null);
  const [externalLinkError, setExternalLinkError] = useState<string | null>(
    null
  );
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);

  console.log({ isLoading, isPlansLoading, isUserPlanLoading, error, contest });
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
          commissionPercentage: plan.features.commissionPercentage,
        },
      }));
      setDbSubscriptionPlans(mappedPlans);
    } catch (error: any) {
      console.error("Error loading subscription plans:", error);
      setError(
        `Failed to load subscription plans: ${error.message}. Using defaults.`
      );
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
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
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
        const explorerPlan = subscriptionPlans.find(
          (p) => p.name === "EXPLORER"
        );
        const explorerPlanId = explorerPlan?.id || subscriptionPlans[0].id;
        setUserPlan(explorerPlanId);
        if (advertiserError && advertiserError.code !== "PGRST116") {
          // Ignore 'single row not found'
          console.error("Error fetching advertiser profile:", advertiserError);
        }
      }
    } catch (error) {
      console.error("Error in getUserPlan:", error);
      // Default to EXPLORER plan (free plan) on error
      const explorerPlan = subscriptionPlans.find((p) => p.name === "EXPLORER");
      const explorerPlanId = explorerPlan?.id || subscriptionPlans[0].id;
      setUserPlan(explorerPlanId);
    } finally {
      setIsUserPlanLoading(false);
    }
  };

  // Get features for a given plan ID using constants
  const getPlanFeatures = (planId: string | null): PlanFeatures => {
    const defaultFreePlanFeatures: PlanFeatures = subscriptionPlans[0].features;

    if (!planId) {
      // Find EXPLORER plan by name if planId is null
      const explorerPlan = subscriptionPlans.find((p) => p.name === "EXPLORER");
      return explorerPlan?.features || defaultFreePlanFeatures;
    }

    const plan = subscriptionPlans.find((p) => p.id === planId);

    if (!plan) {
      // Default to EXPLORER plan if plan not found
      const explorerPlan = subscriptionPlans.find((p) => p.name === "EXPLORER");
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
          if (contestError.code === "PGRST116") {
            // 'PGRST116': Row not found
            setError(
              "Contest not found or you do not have permission to edit it."
            );
          } else {
            throw contestError;
          }
          setIsLoading(false);
          return;
        }

        if (!isAdmin && data && data.advertiser_id !== user.id) {
          setError("You do not have permission to edit this contest.");
          setIsLoading(false);
          return;
        }


        if (data) {
          // Simplified logic: Only check dates if contest is published
          let canEdit = true;

          if (data.moderation_status === "published") {
            const now = new Date();
            const contestStartDate = data.start_date
              ? new Date(data.start_date)
              : null;
            const contestEndDate = data.end_date
              ? new Date(data.end_date)
              : null;
            const isLive =
              contestStartDate &&
              contestStartDate <= now &&
              (!contestEndDate || contestEndDate > now);
            const isEnded = contestEndDate && contestEndDate <= now;

            canEdit = !isLive && !isEnded;
          }
          // If moderation_status is not 'published', always allow editing regardless of dates

          if (!canEdit) {
            setError(
              "This contest is already live or has ended and cannot be edited."
            );
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
              const { dateString, timeString } = toLocalDateTimeStrings(
                data.start_date
              );
              setStartDate(dateString);
              setStartTime(timeString);
            }
            if (data.end_date) {
              const { dateString, timeString } = toLocalDateTimeStrings(
                data.end_date
              );
              setEndDate(dateString);
              setEndTime(timeString);
            }

            // Parse inspiration_links
            let parsedInspirationLinks: { url: string; description: string }[] =
              [];
            if (Array.isArray(data.inspiration_links)) {
              parsedInspirationLinks = data.inspiration_links;
            } else {
              parsedInspirationLinks = [];
            }
            setInspirationLinks(parsedInspirationLinks);

            setThumbnailPreview(data.thumbnail_url || null);
            setContestType(data.contest_type || "leaderboard"); // Default to leaderboard if null for some reason

            if (data.contest_type === "leaderboard") {
              const lbDetails = data.contest_based_details?.leaderboard_contest;
              if (lbDetails && Array.isArray(lbDetails.prizes)) {
                setWinnerCount(
                  lbDetails.winner_count || lbDetails.prizes.length
                );
                const prizes = lbDetails.prizes.map(
                  (prize: { amount: number }) => prize.amount
                );
                setWinnerAmounts(prizes);
                // Set original budget for tracking changes (prize pool only)
                const originalBudgetInCents = prizes.reduce(
                  (sum: number, amount: number) => sum + amount,
                  0
                );
                setOriginalBudget(originalBudgetInCents);
              } else if (Array.isArray(data.prizes)) {
                // Fallback to old structure if new one not present
                setWinnerCount(data.winner_count || data.prizes.length);
                const prizes = data.prizes.map(
                  (prize: { amount: number }) => prize.amount
                );
                setWinnerAmounts(prizes);
                // Set original budget for tracking changes (prize pool only)
                const originalBudgetInCents = prizes.reduce(
                  (sum: number, amount: number) => sum + amount,
                  0
                );
                setOriginalBudget(originalBudgetInCents);
              } else {
                setWinnerCount(DEFAULT_WINNER_COUNT); // Default
                setWinnerAmounts(DEFAULT_WINNER_AMOUNTS); // Default
                // Set default original budget (prize pool only)
                setOriginalBudget(DEFAULT_TOTAL_PRIZE_POOL); // Default total
              }
            } else if (data.contest_type === "cpm") {
              const cpmDetails = data.contest_based_details?.cpm_contest;
              if (cpmDetails) {
                setCpmRate(cpmDetails.cpm_rate_usd?.toString() || "");
                setMinViews(cpmDetails.min_views?.toString() || "");
                setMaxViews(cpmDetails.max_views?.toString() || "");
                setTotalBudget(
                  cpmDetails.total_budget
                    ? (cpmDetails.total_budget / 100).toString()
                    : ""
                );
                setTermsConditions(cpmDetails.terms_conditions || "");
                // Set original budget for tracking changes (cpm budget is stored in cents, prize pool only)
                setOriginalBudget(cpmDetails.total_budget || 0);
              }
            }

            // Load existing resources (array format only)
            setResources(data.resources || []);
          }
        } else {
          setError(
            "Contest not found or you don't have permission to edit it."
          );
        }
      } catch (error: any) {
        console.error("Error fetching contest data:", error);
        if (error.code === "PGRST116") {
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
          if (
            refreshedContest.contest_type === "leaderboard" &&
            refreshedContest.contest_based_details.leaderboard_contest
          ) {
            const leaderboardData =
              refreshedContest.contest_based_details.leaderboard_contest;
            if (
              leaderboardData.prizes &&
              Array.isArray(leaderboardData.prizes)
            ) {
              // Update winner amounts with latest data from database
              const updatedAmounts = leaderboardData.prizes.map(
                (prize) => prize.amount
              );
              setWinnerAmounts(updatedAmounts);
              setWinnerCount(
                leaderboardData.winner_count || updatedAmounts.length
              );

              // Update originalBudget with current total from database
              const currentTotal =
                leaderboardData.total_prize ||
                updatedAmounts.reduce((sum, amount) => sum + amount, 0);
              setOriginalBudget(currentTotal);

              console.log("🔄 Updated leaderboard amounts from database:", {
                updatedAmounts,
                totalPrize: currentTotal,
                winnerCount: leaderboardData.winner_count,
              });
            }
          } else if (
            refreshedContest.contest_type === "cpm" &&
            refreshedContest.contest_based_details.cpm_contest
          ) {
            const cpmData = refreshedContest.contest_based_details.cpm_contest;
            if (cpmData.total_budget) {
              // Update total budget with latest data from database
              const budgetInDollars = cpmData.total_budget / 100; // Convert cents to dollars
              setTotalBudget(budgetInDollars.toString());

              // Update originalBudget with current total from database
              setOriginalBudget(cpmData.total_budget);

              console.log("🔄 Updated CPM budget from database:", {
                totalBudgetCents: cpmData.total_budget,
                totalBudgetDollars: budgetInDollars,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error refreshing contest data:", error);
    }
  };

  // Helper function to delete files from Supabase storage
  const deleteFromStorage = async (fileUrl: string) => {
    try {
      // Extract file path from Supabase URL
      const url = new URL(fileUrl);
      const pathSegments = url.pathname.split("/");
      const bucketIndex = pathSegments.findIndex(
        (segment) => segment === "contest-assets"
      );

      if (bucketIndex !== -1 && bucketIndex < pathSegments.length - 1) {
        const filePath = pathSegments.slice(bucketIndex + 1).join("/");

        const { error: deleteError } = await supabase.storage
          .from("contest-assets")
          .remove([filePath]);

        if (deleteError) {
          console.error("Failed to delete file from storage:", deleteError);
        }
      }
    } catch (error) {
      console.error("Error parsing file URL for deletion:", error);
    }
  };

  // Helper function to instantly update contest resources in DB
  const updateContestResourcesInDB = async (newResources: ResourceItem[]) => {
    if (!user?.id || !contestId) return;

    try {
      let query = supabase
        .from("contests")
        .update({ resources: newResources })
        .eq("id", contestId);
      if (!isAdmin) {
        query = query.eq("advertiser_id", user.id);
      }
      const { error } = await query;

      if (error) {
        console.error("Error updating resources in DB:", error);
        toast({
          title: "Database Update Failed",
          description:
            "Resources updated in UI but failed to save to database. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating resources in DB:", error);
    }
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Helper function to get file size from URL (for internal resources)
  const getFileSizeFromUrl = async (url: string): Promise<string | null> => {
    if (!url.includes("supabase.co/storage")) return null;

    try {
      const response = await fetch(url, { method: "HEAD" });
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        return formatFileSize(parseInt(contentLength));
      }
    } catch (error) {
      console.error("Error getting file size:", error);
    }
    return null;
  };

  // Get minimum allowed start date and time (current date/time)
  const getMinDateTime = () => {
    const now = new Date();
    const minStartDate = new Date(now);
    minStartDate.setDate(minStartDate.getDate() + MIN_DAYS_UNTIL_START);

    const year = minStartDate.getFullYear();
    const month = String(minStartDate.getMonth() + 1).padStart(2, "0");
    const day = String(minStartDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Get minimum allowed end time based on start date/time
  const getMinEndTime = () => {
    if (!startDate || !startTime || !endDate) return "00:00";

    const startDateObj = new Date(`${startDate}T${startTime}`);
    const endDateObj = new Date(`${endDate}T00:00:00`);
    const minEndDate = new Date(startDateObj);
    minEndDate.setDate(minEndDate.getDate() + MIN_CONTEST_DURATION_DAYS);

    // If end date is exactly minimum duration days after start date, minimum end time should be same as start time
    if (endDateObj.toDateString() === minEndDate.toDateString()) {
      return startTime;
    }

    // If end date is more than minimum duration days after start date, any time is valid
    return "00:00";
  };

  // Calculate and format contest duration (for user-friendly info)
  const getContestDuration = () => {
    if (!startDate || !startTime || !endDate || !endTime) return null;

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    const now = new Date();

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime()))
      return null;

    // Calculate time until start
    const msUntilStart = startDateTime.getTime() - now.getTime();
    const daysUntilStart = Math.floor(msUntilStart / (1000 * 60 * 60 * 24));
    const hoursUntilStart = Math.floor(
      (msUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    // Calculate contest duration
    const msDuration = endDateTime.getTime() - startDateTime.getTime();
    const durationDays = Math.floor(msDuration / (1000 * 60 * 60 * 24));
    const durationHours = Math.floor(
      (msDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    let startMessage = "";
    if (daysUntilStart > 0) {
      startMessage = `Your contest will be live in ${daysUntilStart} day${daysUntilStart !== 1 ? "s" : ""
        }`;
      if (hoursUntilStart > 0)
        startMessage += ` and ${hoursUntilStart} hour${hoursUntilStart !== 1 ? "s" : ""
          }`;
    } else if (hoursUntilStart > 0) {
      startMessage = `Your contest will be live in ${hoursUntilStart} hour${hoursUntilStart !== 1 ? "s" : ""
        }`;
    } else {
      startMessage = "Your contest will be live soon";
    }

    const durationMessage = `and will run for ${durationDays} day${durationDays !== 1 ? "s" : ""
      }${durationHours > 0
        ? ` and ${durationHours} hour${durationHours !== 1 ? "s" : ""}`
        : ""
      }`;

    return `${startMessage} ${durationMessage}`;
  };

  // Format helper: "August 2nd" based on user timezone
  const formatDateWithOrdinal = (date: Date) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const day = date.getDate();
    const j = day % 10,
      k = day % 100;
    let suffix = "th";
    if (j === 1 && k !== 11) suffix = "st";
    else if (j === 2 && k !== 12) suffix = "nd";
    else if (j === 3 && k !== 13) suffix = "rd";
    return `${months[date.getMonth()]} ${day}${suffix}`;
  };

  // Build dynamic example text for start date rule using local timezone
  const getStartDateRuleExample = () => {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const minStartDate = new Date(startOfToday);
    minStartDate.setDate(minStartDate.getDate() + MIN_DAYS_UNTIL_START);

    const disallowed: string[] = [];
    for (let i = 0; i < MIN_DAYS_UNTIL_START; i++) {
      const d = new Date(startOfToday);
      d.setDate(startOfToday.getDate() + i);
      disallowed.push(formatDateWithOrdinal(d));
    }
    const disallowedText =
      disallowed.length === 1
        ? disallowed[0]
        : disallowed.slice(0, -1).join(", ") +
        " and " +
        disallowed[disallowed.length - 1];

    return `For example, if today is ${formatDateWithOrdinal(
      startOfToday
    )}, you can create contests starting from ${formatDateWithOrdinal(
      minStartDate
    )} (00:00 onwards). ${disallowedText} ${disallowed.length > 1 ? "are" : "is"
      } not allowed.`;
  };
  // Get minimum allowed end date (at least 3 days after the start date)
  const getMinEndDate = () => {
    if (!startDate) return getMinDateTime();

    const startDateObj = new Date(startDate);
    // Add minimum duration days to the start date
    startDateObj.setDate(startDateObj.getDate() + MIN_CONTEST_DURATION_DAYS);

    const year = startDateObj.getFullYear();
    const month = String(startDateObj.getMonth() + 1).padStart(2, "0");
    const day = String(startDateObj.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Update end date/time when start date/time changes to ensure minimum duration
  useEffect(() => {
    if (!startDate || !startTime) return;

    const startDateTime = new Date(`${startDate}T${startTime}`);

    // If end date/time is set and is less than minimum duration after start, update it
    if (endDate && endTime) {
      const endDateTime = new Date(`${endDate}T${endTime}`);
      const minEndDateTime = new Date(startDateTime);
      minEndDateTime.setDate(
        minEndDateTime.getDate() + MIN_CONTEST_DURATION_DAYS
      );

      if (endDateTime < minEndDateTime) {
        // Set end date/time to be exactly minimum duration after start
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
        title: "Form Validation Error",
        description: message,
        duration: TOAST_DURATION_SHORT, // 3 seconds
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
          description:
            "Operation is taking longer than expected. Please wait...",
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

      const validInspirationLinks = inspirationLinks.filter(
        (link) => link.url.trim() !== ""
      );
      if (validInspirationLinks.length === 0) {
        showError("At least one inspiration link is required.");
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }

      const hasExistingResources = resources && resources.length > 0;
      const totalResources = hasExistingResources ? resources.length : 0;

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
        inspiration_links: inspirationLinks.filter(
          (link) => link.url.trim() !== ""
        ),
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
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }

        // FIXED: Handle date input properly to avoid timezone issues
        // The HTML date input gives us YYYY-MM-DD format, we need to parse it correctly
        const startDateParts = startDate.split("-");
        const startYear = parseInt(startDateParts[0]);
        const startMonth = parseInt(startDateParts[1]) - 1; // Month is 0-indexed
        const startDay = parseInt(startDateParts[2]);

        // Create date in local timezone
        const startDateOnly = new Date(startYear, startMonth, startDay);
        const todayOnly = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const daysUntilStart = Math.floor(
          (startDateOnly.getTime() - todayOnly.getTime()) /
          (1000 * 60 * 60 * 24)
        );

        const originalStartDate = contest?.start_date
          ? new Date(contest.start_date)
          : null;
        const isNewContest = !originalStartDate || originalStartDate > now;

        if (isNewContest) {
          // CRITICAL: Use exact same logic as getMinDateTime for consistency
          if (daysUntilStart < MIN_DAYS_UNTIL_START) {
            toast({
              title: "Invalid Start Date",
              description: `Contest must start at least ${MIN_DAYS_UNTIL_START} days from today (${MIN_DAYS_UNTIL_START - 1
                } day gap required).`,
              variant: "destructive",
            });
            setIsSubmitting(false);
            if (submitTimeoutId) clearTimeout(submitTimeoutId);
            return;
          }
        } else if (startDateTime < now) {
          toast({
            title: "Invalid Start Time",
            description: "Contest start time must be in the future.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }

        if (endDateTime <= startDateTime) {
          toast({
            title: "Invalid End Time",
            description: "Contest end time must be after the start time.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }

        // Check contest duration limits
        const durationMs = endDateTime.getTime() - startDateTime.getTime();
        const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

        if (durationDays < MIN_CONTEST_DURATION_DAYS) {
          toast({
            title: "Invalid Duration",
            description: `Contest duration must be at least ${MIN_CONTEST_DURATION_DAYS} days.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }

        if (durationDays > MAX_CONTEST_DURATION_DAYS) {
          toast({
            title: "Invalid Duration",
            description: `Contest duration cannot exceed ${MAX_CONTEST_DURATION_DAYS} days.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }
        updatePayload.start_date = toUTCISOString(startDate, startTime);
        updatePayload.end_date = toUTCISOString(endDate, endTime);
      } catch (error) {
        console.error("Date validation error:", error);
        toast({
          title: "Date Error",
          description:
            "There was an error with the date/time format. Please check your entries.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
    } else {
      toast({
        title: "Missing Dates",
        description: "Contest start and end dates/times are required.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      if (submitTimeoutId) clearTimeout(submitTimeoutId);
      return;
    }

    // Skip contest type validation for datesOnly mode
    if (!datesOnly && contestType === "leaderboard") {
      const currentTotalPrizePool = winnerAmounts.reduce(
        (sum, amount) => sum + (amount || 0),
        0
      );
      if (winnerCount > planFeatures.maxWinnersPerContest) {
        toast({
          title: "Plan Limit Exceeded",
          description: `Your current plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
      if (currentTotalPrizePool < planFeatures.minContestBudget) {
        toast({
          title: "Prize Pool Too Low",
          description: `Your current plan requires a minimum total prize pool of ${formatCurrencyFromCents(
            planFeatures.minContestBudget
          )}.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
      for (let i = 0; i < winnerCount; i++) {
        if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
          toast({
            title: "Prize Amount Too Low",
            description: `Prize for Winner ${i + 1
              } must be at least ${formatCurrencyFromCents(
                MIN_PRIZE_PER_WINNER
              )}`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }
        if (winnerAmounts[i] > MAX_PRIZE_PER_WINNER) {
          toast({
            title: "Prize Amount Too High",
            description: `Prize for Winner ${i + 1
              } cannot exceed ${formatCurrencyFromCents(MAX_PRIZE_PER_WINNER)}`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }
      }
      const prizesArray = winnerAmounts
        .slice(0, winnerCount)
        .map((amount, i) => ({
          position: i + 1,
          amount: amount || 0,
        }));
      contestBasedDetails.leaderboard_contest = {
        prizes: prizesArray,
        total_prize: currentTotalPrizePool,
        winner_count: winnerCount,
      };
    } else if (!datesOnly && contestType === "cpm") {
      const numCpmRate = parseFloat(cpmRate as string);
      const numTotalBudget = parseFloat(totalBudget as string);
      const numMinViews =
        minViews !== "" && minViews !== null
          ? parseInt(minViews as string, 10)
          : null;
      const numMaxViews =
        maxViews !== "" && maxViews !== null
          ? parseInt(maxViews as string, 10)
          : null;

      if (isNaN(numCpmRate) || numCpmRate <= 0) {
        toast({
          title: "Invalid CPM Rate",
          description: "CPM Rate is required and must be a positive number.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }

      if (numCpmRate < MIN_CPM_RATE) {
        toast({
          title: "CPM Rate Too Low",
          description: `CPM Rate must be at least $${MIN_CPM_RATE} per 1000 views.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }

      if (numCpmRate > MAX_CPM_RATE) {
        toast({
          title: "CPM Rate Too High",
          description: `CPM Rate cannot exceed $${MAX_CPM_RATE} per 1000 views.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
      if (isNaN(numTotalBudget) || numTotalBudget <= 0) {
        toast({
          title: "Invalid Budget",
          description:
            "Total Budget is required and must be a positive number.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
      if (numMinViews !== null && (isNaN(numMinViews) || numMinViews < 0)) {
        toast({
          title: "Invalid Minimum Views",
          description:
            "Minimum Views, if provided, must be a non-negative number.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
      if (numMaxViews !== null && (isNaN(numMaxViews) || numMaxViews < 0)) {
        toast({
          title: "Invalid Maximum Views",
          description:
            "Maximum Views, if provided, must be a non-negative number.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
      if (
        numMinViews !== null &&
        numMaxViews !== null &&
        numMinViews > numMaxViews
      ) {
        toast({
          title: "Invalid View Range",
          description: "Minimum Views cannot be greater than Maximum Views.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
      if (!termsConditions || termsConditions.trim() === "") {
        toast({
          title: "Missing Terms & Conditions",
          description: "Terms & Conditions are required for CPM contests.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
      contestBasedDetails.cpm_contest = {
        cpm_rate_usd: numCpmRate,
        total_budget: numTotalBudget * 100, // Convert dollars to cents
        min_views: numMinViews,
        max_views: numMaxViews,
        terms_conditions: termsConditions,
        budget_spent:
          contest?.contest_based_details?.cpm_contest?.budget_spent || 0,
      };
    } else if (!datesOnly) {
      toast({
        title: "Invalid Contest Type",
        description:
          "Invalid contest type selected. Please refresh and try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      if (submitTimeoutId) clearTimeout(submitTimeoutId);
      return;
    }

    // Only update contest type and details if not in datesOnly mode
    if (!datesOnly) {
      updatePayload.contest_type = contestType;
      updatePayload.contest_based_details = contestBasedDetails;
    }
    try {
      // Use the already-uploaded thumbnail URL (from thumbnailPreview)
      let finalThumbnailUrl = contest.thumbnail_url;
      if (!datesOnly) {
        // If a new thumbnail was uploaded, use its URL; otherwise, keep the existing one
        finalThumbnailUrl = thumbnailPreview || contest.thumbnail_url || "";
        updatePayload.thumbnail_url = finalThumbnailUrl;
        // Save resources array directly (files are already uploaded when added)
        updatePayload.resources = resources;
      }

      // For admins, call a secure API that uses the service role to bypass RLS
      if (isAdmin) {
        const resp = await fetch(`/api/admin/contests/${contestId}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          throw new Error(j.error || 'Admin update failed');
        }
      } else {
        let updateQuery = supabase
          .from("contests")
          .update(updatePayload)
          .eq("id", contestId)
          .eq("advertiser_id", user.id);
        const { error: updateError } = await updateQuery;
        if (updateError) {
          throw updateError;
        }
      }


      // Show success toast
      toast({
        title: datesOnly ? "Contest Dates Updated" : "Contest Updated",
        description: datesOnly
          ? "Contest dates have been successfully updated."
          : "Your contest has been successfully updated.",
        variant: "default",
      });

      router.push(`/dashboard/contests/${contestId}`);
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update contest",
        variant: "destructive",
      });
    }
  };

  const handleThumbnailChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate image file type
      const imageValidation = validateImageFile(file);
      if (!imageValidation.isValid) {
        toast({
          title: "Invalid File Type",
          description:
            imageValidation.error || "Please upload a valid image file.",
          variant: "destructive",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: "Thumbnail must be 5MB or smaller. Please choose a smaller file.",
          variant: "destructive"
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      try {
        if (!user?.id) {
          toast({ title: "Authentication Error", description: "User not authenticated. Please sign in again.", variant: "destructive" });
          return;
        }
        // Remove any existing thumbnail for this contest (all extensions)
        const { data: existingFiles } = await supabase.storage
          .from("contest-assets")
          .list("contest_thumbnails");
        if (existingFiles) {
          const matching = existingFiles.filter(f => f.name.startsWith(`${contestId}_`));
          if (matching.length > 0) {
            const paths = matching.map(f => `contest_thumbnails/${f.name}`);
            await supabase.storage.from("contest-assets").remove(paths);
          }
        }
        // Get extension and timestamp
        const ext = file.name.split('.').pop() || 'jpg';
        const timestamp = Date.now();
        const fileName = `contest_thumbnails/${contestId}_${timestamp}.${ext}`;
        setThumbnail(file);
        setThumbnailPreview("uploading");
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("contest-assets")
          .upload(fileName, file);
        if (uploadError) {
          throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
        }
        const { data: publicUrlData } = supabase.storage
          .from("contest-assets")
          .getPublicUrl(fileName);
        const publicUrl = publicUrlData?.publicUrl || "";
        if (!publicUrl) {
          throw new Error("Failed to get public URL for uploaded thumbnail");
        }
        setThumbnail(null);
        setThumbnailPreview(publicUrl);
        let thumbQuery = supabase
          .from("contests")
          .update({ thumbnail_url: publicUrl })
          .eq("id", contestId);
        if (!isAdmin) {
          thumbQuery = thumbQuery.eq("advertiser_id", user.id);
        }
        await thumbQuery;
        toast({ title: "Success", description: "Thumbnail uploaded successfully!" });
      } catch (error: any) {
        console.error("Error uploading thumbnail:", error);
        setThumbnail(null);
        setThumbnailPreview(null);
        toast({ title: "Upload Error", description: `Failed to upload thumbnail: ${error.message}`, variant: "destructive" });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const removeThumbnail = async () => {
    try {
      // If there's a Supabase URL, delete it from storage
      if (
        thumbnailPreview &&
        thumbnailPreview.includes("supabase.co/storage")
      ) {
        await deleteFromStorage(thumbnailPreview);

        // Update DB to remove thumbnail URL
        if (contestId && user) {
          let clearThumbQuery = supabase
            .from("contests")
            .update({ thumbnail_url: null })
            .eq("id", contestId);
          if (!isAdmin) {
            clearThumbQuery = clearThumbQuery.eq("advertiser_id", user.id);
          }
          await clearThumbQuery;
        }

        toast({
          title: "Success",
          description: "Thumbnail removed successfully!",
        });
      }
    } catch (error: any) {
      console.error("Error removing thumbnail:", error);
      toast({
        title: "Warning",
        description:
          "Thumbnail removed from preview but may not have been deleted from storage.",
        variant: "destructive",
      });
    } finally {
      // Always clear the UI state regardless of storage deletion success
      setThumbnail(null);
      setThumbnailPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const addInspiration = () => {
    setInspirationError(null);
    if (!newInspirationUrl.trim()) {
      setInspirationError("URL cannot be empty.");
      toast({
        title: "Invalid Link",
        description: "URL cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    try {
      const urlObj = new URL(newInspirationUrl);
      if (urlObj.protocol !== "https:") {
        setInspirationError("URL must start with https://");
        toast({
          title: "Invalid Link",
          description: "URL must start with https://",
          variant: "destructive",
        });
        return;
      }
    } catch {
      setInspirationError("Invalid URL format.");
      toast({
        title: "Invalid Link",
        description: "Invalid URL format.",
        variant: "destructive",
      });
      return;
    }
    if (!newInspirationDescription.trim()) {
      setInspirationError("Description is required.");
      toast({
        title: "Missing Description",
        description: "Description is required.",
        variant: "destructive",
      });
      return;
    }
    // Duplicate check: same URL and description
    if (
      inspirationLinks.some(
        (link) =>
          link.url === newInspirationUrl &&
          link.description === newInspirationDescription
      )
    ) {
      setInspirationError(
        "This inspiration link and description have already been added. Please use a different link or description."
      );
      toast({
        title: "Duplicate Inspiration Link & Description",
        description:
          "This inspiration link and description have already been added. Please use a different link or description.",
        variant: "destructive",
      });
      return;
    }
    // Duplicate check: same URL
    if (inspirationLinks.some((link) => link.url === newInspirationUrl)) {
      setInspirationError(
        "This inspiration link has already been added. Please use a different link."
      );
      toast({
        title: "Duplicate Inspiration Link",
        description:
          "This inspiration link has already been added. Please use a different link.",
        variant: "destructive",
      });
      return;
    }
    setInspirationLinks([
      ...inspirationLinks,
      { url: newInspirationUrl, description: newInspirationDescription },
    ]);
    setNewInspirationUrl("");
    setNewInspirationDescription("");
    toast({ title: "Success", description: "Inspiration link added!" });
  };

  const removeInspirationLink = (index: number) => {
    setInspirationLinks(inspirationLinks.filter((_, i) => i !== index));
    toast({ title: "Success", description: "Inspiration link removed!" });
  };

  // Resource Management Handlers
  const handleResourceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResourceError(null);
    setResourceSuccess(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 20 * 1024 * 1024) {
        // 20MB limit
        setResourceError("File size should not exceed 20MB.");
        setResourceFile(null); // Clear the invalid file
        setResourceFilePreview(null);
        if (resourceFileRef.current) resourceFileRef.current.value = "";
        return;
      }
      setResourceFile(file);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) =>
          setResourceFilePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        // For non-image files, we just set a special flag to indicate file type
        setResourceFilePreview(`file-type:${file.type}`);
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

  const addFileResource = async () => {
    setAssetUploadError(null);
    setResourceSuccess(null);
    if (!resourceFile) {
      setAssetUploadError("No file selected or file is too large.");
      toast({
        title: "Upload Error",
        description: "No file selected or file is too large.",
        variant: "destructive",
      });
      return;
    }
    if (!resourceDescription.trim()) {
      setAssetUploadError("Please provide a description for the asset.");
      toast({
        title: "Missing Description",
        description: "Please provide a description for the asset.",
        variant: "destructive",
      });
      return;
    }
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (resourceFile.size > maxSize) {
      setAssetUploadError(
        "File must be 20MB or smaller. Please choose a smaller file."
      );
      toast({
        title: "File Too Large",
        description:
          "File must be 20MB or smaller. Please choose a smaller file.",
        variant: "destructive",
      });
      return;
    }
    const resourceName = resourceDescription.trim();
    if (resources.some((r) => r.description === resourceName)) {
      setAssetUploadError(
        `A resource with the description \"${resourceName}\" already exists. Please use a unique description.`
      );
      toast({
        title: "Duplicate Description",
        description: `A resource with the description \"${resourceName}\" already exists. Please use a unique description.`,
        variant: "destructive",
      });
      return;
    }
    try {
      if (!user?.id) {
        setAssetUploadError("User not authenticated. Please sign in again.");
        return;
      }
      setIsUploadingAsset(true);
      // Use per-contest folder
      const fileName = `contest_resources/${contestId}/${resourceFile.name.replace(
        /\s+/g,
        "_"
      )}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("contest-assets")
        .upload(fileName, resourceFile);
      if (uploadError) {
        let userMessage = `Failed to upload asset: ${uploadError.message}`;
        if (
          uploadError.message &&
          uploadError.message.toLowerCase().includes("resource already exists")
        ) {
          userMessage =
            "A file with this name already exists for this contest. Please rename your file or remove the existing one before uploading.";
        }
        setAssetUploadError(userMessage);
        toast({
          title: "Upload Error",
          description: userMessage,
          variant: "destructive",
        });
        return;
      }
      const { data: publicUrlData } = supabase.storage
        .from("contest-assets")
        .getPublicUrl(fileName);
      const publicUrl = publicUrlData?.publicUrl || "";
      if (!publicUrl) {
        throw new Error("Failed to get public URL for uploaded file");
      }
      const newResources: ResourceItem[] = [
        ...resources,
        {
          url: publicUrl,
          description: resourceName,
          type: "internal",
        },
      ];
      setResources(newResources);
      await updateContestResourcesInDB(newResources);
      setResourceSuccess(`Asset \"${resourceName}\" uploaded successfully!`);
      toast({ title: "Success", description: "Asset uploaded successfully!" });
      removeResourceFile();
      setAssetUploadError(null);
    } catch (error: any) {
      setAssetUploadError(`Failed to upload asset: ${error.message}`);
      toast({
        title: "Upload Error",
        description: `Failed to upload asset: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const addExternalResource = async () => {
    setResourceError(null);
    setResourceSuccess(null);
    if (!newExternalResourceUrl.trim()) {
      setResourceError("Please enter a valid external link URL.");
      toast({
        title: "Invalid Link",
        description: "External link URL cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (!externalResourceDescription.trim()) {
      setResourceError(
        "Please provide a description for the external resource."
      );
      toast({
        title: "Missing Description",
        description: "Please provide a description for the external resource.",
        variant: "destructive",
      });
      return;
    }
    const resourceName = externalResourceDescription.trim();
    // Check if both URL and description are the same as an existing external link (most specific)
    if (
      resources.some(
        (r) =>
          r.type === "external" &&
          r.url === newExternalResourceUrl &&
          r.description === resourceName
      )
    ) {
      setResourceError(
        "This external link and description have already been added. Please use a different link or description."
      );
      toast({
        title: "Duplicate Link & Description",
        description:
          "This external link and description have already been added. Please use a different link or description.",
        variant: "destructive",
      });
      return;
    }
    // Check if external link with same URL already exists
    if (
      resources.some(
        (r) => r.type === "external" && r.url === newExternalResourceUrl
      )
    ) {
      setResourceError(
        "This external link has already been added. Please use a different link."
      );
      toast({
        title: "Duplicate Link",
        description:
          "This external link has already been added. Please use a different link.",
        variant: "destructive",
      });
      return;
    }
    try {
      const urlObj = new URL(newExternalResourceUrl);
      if (urlObj.protocol !== "https:") {
        setResourceError("URL must start with https://");
        toast({
          title: "Invalid Link",
          description: "URL must start with https://",
          variant: "destructive",
        });
        return;
      }
    } catch (_) {
      setResourceError("Invalid URL format.");
      toast({
        title: "Invalid Link",
        description: "Invalid URL format.",
        variant: "destructive",
      });
      return;
    }
    const newResources: ResourceItem[] = [
      ...resources,
      {
        url: newExternalResourceUrl,
        description: resourceName,
        type: "external",
      },
    ];
    setResources(newResources);
    await updateContestResourcesInDB(newResources);
    setResourceSuccess(
      `External resource \"${resourceName}\" added successfully!`
    );
    toast({ title: "Success", description: "External resource added!" });
    setNewExternalResourceUrl("");
    setExternalResourceDescription("");
  };

  const removeResource = async (index: number) => {
    setResourceError(null);
    setResourceSuccess(null);
    const resourceToRemove = resources[index];
    if (!resourceToRemove) return;

    try {
      // If it's an internal resource with a Supabase URL, delete it from storage
      if (
        resourceToRemove.type === "internal" &&
        resourceToRemove.url.includes("supabase.co/storage")
      ) {
        // Extract file path from Supabase URL
        const url = new URL(resourceToRemove.url);
        const pathSegments = url.pathname.split("/");
        const bucketIndex = pathSegments.findIndex(
          (segment) => segment === "contest-assets"
        );
        if (bucketIndex !== -1 && bucketIndex < pathSegments.length - 1) {
          const filePath = pathSegments.slice(bucketIndex + 1).join("/");
          await supabase.storage.from("contest-assets").remove([filePath]);
        }
        setResourceSuccess(
          `Resource "${resourceToRemove.description}" deleted successfully!`
        );
        toast({
          title: "Success",
          description: "Resource deleted successfully!",
        });
      } else {
        // For external resources, show success message
        toast({
          title: "Success",
          description: "External link removed successfully!",
        });
      }
    } catch (error: any) {
      console.error("Error deleting resource from storage:", error);
      setResourceSuccess(
        `Resource removed from list but may not have been deleted from storage.`
      );
      toast({
        title: "Warning",
        description:
          "Resource removed from list but may not have been deleted from storage.",
        variant: "destructive",
      });
    } finally {
      // Always remove from UI regardless of storage deletion success
      const newResources = resources.filter((_, i) => i !== index);
      setResources(newResources);
      await updateContestResourcesInDB(newResources);
    }
  };

  // Helper functions for content management
  const captureBriefContent = () => {
    if (richTextEditorRef.current) {
      const content = richTextEditorRef.current.getContent();
      console.log(
        "Captured brief content:",
        content ? content.html.substring(0, 100) + "..." : content
      );
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
      console.log(
        "Captured rules content:",
        content ? content.html.substring(0, 100) + "..." : content
      );
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
      const html = content?.html?.replace(/&nbsp;|\s|<br\s*\/?>/gi, "") || "";
      return content === null || html === "" || html === "<p></p>";
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
      const paymentDetails =
        typeof contest.payment_details === "string"
          ? JSON.parse(contest.payment_details)
          : contest.payment_details;

      return paymentDetails.payment_status === "completed";
    } catch (error) {
      console.error("Error parsing payment details:", error);
      return false;
    }
  };

  // Process refund after user confirmation
  const processRefund = async () => {
    if (!refundDetails) return;

    setIsSubmitting(true);
    try {
      console.log(
        `💰 Processing refund: ${refundDetails.prizePoolDecrease} cents prize pool + ${refundDetails.commissionRefund} cents commission (${refundDetails.commissionPercentage}%) = ${refundDetails.totalRefund} cents total`
      );

      // Call refund API endpoint
      const response = await fetch("/api/payments/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contestId,
          refundAmount: refundDetails.totalRefund,
          reason: "Contest budget decreased",
        }),
      });

      const refundResult = await response.json();

      if (!response.ok || !refundResult.success) {
        throw new Error(refundResult.error || "Failed to process refund");
      }

      console.log("✅ Refund processed successfully");

      // Update contest_based_details with new prize pool amounts
      await updateContestDetailsAfterRefund();

      // Show detailed refund breakdown if available
      const refundMessage = refundResult.breakdown
        ? `Prize pool reduced by $${refundResult.breakdown.prizePoolReduction.toFixed(
          2
        )}. Refunded: $${refundResult.breakdown.prizePoolReduction.toFixed(
          2
        )} + $${refundResult.breakdown.commissionRefund.toFixed(
          2
        )} commission (${refundDetails.commissionPercentage}%) = $${refundResult.breakdown.totalRefunded.toFixed(
          2
        )} total.`
        : `$${(refundDetails.totalRefund / 100).toFixed(
          2
        )} has been refunded to your wallet (using original ${refundDetails.commissionPercentage}% commission rate)`;

      toast({
        title: "Refund Processed",
        description: refundMessage,
        variant: "default",
      });

      // Reset budget change tracking since refund is now complete
      setBudgetChanged(false);
      setBudgetDifference(0);
      setRefundDetails(null);
      setShowRefundPreview(false);

      // Refresh contest data to show updated payment details
      await refreshContestData();

      // Submit for approval after successful refund
      await submitForApproval();

    } catch (error: any) {
      console.error("❌ Error processing refund:", error);
      toast({
        title: "Refund Failed",
        description: `Failed to process refund: ${error.message}`,
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  // Update contest details after refund
  const updateContestDetailsAfterRefund = async () => {
    if (!refundDetails) return;

    try {
      const contestBasedDetails = contestType === "leaderboard"
        ? {
          leaderboard_contest: {
            prizes: winnerAmounts.map((amount, index) => ({
              position: index + 1,
              amount: amount,
            })),
            total_prize: winnerAmounts.reduce(
              (sum, amount) => sum + amount,
              0
            ),
            winner_count: winnerCount,
          },
        }
        : {
          cpm_contest: {
            cpm_rate_usd: parseFloat(cpmRate.toString()),
            min_views: minViews ? parseInt(minViews.toString()) : null,
            max_views: maxViews ? parseInt(maxViews.toString()) : null,
            total_budget: Math.round(
              parseFloat(totalBudget.toString()) * 100
            ),
            terms_conditions: termsConditions,
          },
        };

      const { error: updateError } = await supabase
        .from('contests')
        .update({
          contest_based_details: contestBasedDetails,
          moderation_status: "draft" // Save as draft after successful refund
        })
        .eq('id', contestId)
        .eq('advertiser_id', user?.id);

      if (updateError) {
        console.error("Error updating contest details after refund:", updateError);
        throw new Error("Failed to update contest details");
      }

      console.log("✅ Contest details updated after refund");
    } catch (error) {
      console.error("❌ Error updating contest details after refund:", error);
      throw error;
    }
  };

  // Helper function to submit contest for approval with retries
  const submitForApproval = async (retries = 3, delay = 2000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(
          `Submission attempt ${attempt}/${retries} for contest ${contestId}`
        );

        const response = await fetch(
          `/api/contests/${contestId}/moderation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "submit_for_approval",
            }),
          }
        );

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
          throw new Error(result.error || "Failed to submit for approval");
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
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
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
    console.log("Rules", rulesHtml);

    if (!rulesHtml || isRichTextEditorEmpty(rulesRichTextEditorRef)) {
      return "Contest rules are required.";
    }

    // Validate thumbnail - either uploaded file or existing preview
    if (!thumbnail && !thumbnailPreview) {
      return "Contest thumbnail is required.";
    }

    const validInspirationLinks = inspirationLinks.filter(
      (link) => link.url.trim() !== ""
    );
    if (validInspirationLinks.length === 0) {
      return "At least one inspiration link is required.";
    }

    const hasExistingResources = resources && resources.length > 0;
    const totalResources = hasExistingResources ? resources.length : 0;

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

      // FIXED: Handle date input properly to avoid timezone issues
      // The HTML date input gives us YYYY-MM-DD format, we need to parse it correctly
      const startDateParts = startDate.split("-");
      const startYear = parseInt(startDateParts[0]);
      const startMonth = parseInt(startDateParts[1]) - 1; // Month is 0-indexed
      const startDay = parseInt(startDateParts[2]);

      // Create date in local timezone
      const startDateOnly = new Date(startYear, startMonth, startDay);
      const todayOnly = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const daysUntilStart = Math.floor(
        (startDateOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24)
      );

      const originalStartDate = contest?.start_date
        ? new Date(contest.start_date)
        : null;
      const isNewContest = !originalStartDate || originalStartDate > now;

      if (isNewContest) {
        // CRITICAL: Use exact same logic as getMinDateTime for consistency
        if (daysUntilStart < MIN_DAYS_UNTIL_START) {
          return `Contest must start at least ${MIN_DAYS_UNTIL_START} days from today (${MIN_DAYS_UNTIL_START - 1
            } day gap required).`;
        }
      } else if (startDateTime < now) {
        return "Contest start time must be in the future.";
      }

      if (endDateTime <= startDateTime) {
        return "Contest end time must be after the start time.";
      }

      // Check contest duration limits
      const durationMs = endDateTime.getTime() - startDateTime.getTime();
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

      if (durationDays < MIN_CONTEST_DURATION_DAYS) {
        return `Contest duration must be at least ${MIN_CONTEST_DURATION_DAYS} days.`;
      }

      if (durationDays > MAX_CONTEST_DURATION_DAYS) {
        return `Contest duration cannot exceed ${MAX_CONTEST_DURATION_DAYS} days.`;
      }
    } catch (error) {
      return "There was an error with the date/time format. Please check your entries.";
    }

    // Validate contest type specific fields
    if (contestType === "leaderboard") {
      const planFeatures = getPlanFeatures(userPlan);
      const currentTotalPrizePool = winnerAmounts.reduce(
        (sum, amount) => sum + (amount || 0),
        0
      );

      if (winnerCount > planFeatures.maxWinnersPerContest) {
        return `Your current plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners.`;
      }

      if (currentTotalPrizePool < planFeatures.minContestBudget) {
        return `Your current plan requires a minimum total prize pool of ${formatCurrencyFromCents(
          planFeatures.minContestBudget
        )}.`;
      }

      for (let i = 0; i < winnerCount; i++) {
        if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
          return `Prize for Winner ${i + 1
            } must be at least ${formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}`;
        }
        if (winnerAmounts[i] > MAX_PRIZE_PER_WINNER) {
          return `Prize for Winner ${i + 1
            } cannot exceed ${formatCurrencyFromCents(MAX_PRIZE_PER_WINNER)}`;
        }
      }
    }

    if (contestType === "cpm") {
      const planFeatures = getPlanFeatures(userPlan);
      const parsedCpmRate =
        typeof cpmRate === "string" ? parseFloat(cpmRate) : cpmRate;
      const parsedTotalBudget =
        typeof totalBudget === "string" ? parseFloat(totalBudget) : totalBudget;

      if (!parsedCpmRate || parsedCpmRate <= 0) {
        return "CPM rate must be a positive number.";
      }

      if (parsedCpmRate < MIN_CPM_RATE) {
        return `CPM rate must be at least $${MIN_CPM_RATE} per 1000 views.`;
      }

      if (parsedCpmRate > MAX_CPM_RATE) {
        return `CPM rate cannot exceed $${MAX_CPM_RATE} per 1000 views.`;
      }

      if (
        !parsedTotalBudget ||
        parsedTotalBudget * 100 < planFeatures.minContestBudget
      ) {
        return `Your current plan requires a minimum total budget of ${formatCurrencyFromCents(
          planFeatures.minContestBudget
        )}.`;
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
    setIsSubmitting(true);
    setShowPayment(false);
    try {
      // Handle budget changes - only increases (decreases are handled directly in main flow)
      if (budgetChanged && budgetDifference > 0) {
        console.log("🔄 Processing budget increase:", {
          budgetDifference,
          isIncrease: budgetDifference > 0,
        });

        // Update ALL contest data in database after payment (including any edits made)
        console.log(
          "💾 Updating complete contest data in database after payment..."
        );

        const contestBasedDetails =
          contestType === "leaderboard"
            ? {
              leaderboard_contest: {
                prizes: winnerAmounts.map((amount, index) => ({
                  position: index + 1,
                  amount: amount,
                })),
                total_prize: winnerAmounts.reduce(
                  (sum, amount) => sum + amount,
                  0
                ),
                winner_count: winnerCount,
              },
            }
            : {
              cpm_contest: {
                cpm_rate_usd: parseFloat(cpmRate.toString()),
                min_views: minViews ? parseInt(minViews.toString()) : null,
                max_views: maxViews ? parseInt(maxViews.toString()) : null,
                total_budget: Math.round(
                  parseFloat(totalBudget.toString()) * 100
                ),
                terms_conditions: termsConditions,
              },
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
          inspiration_links: inspirationLinks.filter(
            (link) => link.url.trim() !== ""
          ),
          resources,
          contest_type: contestType,
          contest_based_details: contestBasedDetails,
          moderation_status: "draft", // Save as draft after successful payment
        };

        // Update contest with complete data
        if (!user?.id) {
          throw new Error("User not authenticated");
        }

        const { error: updateError } = await supabase
          .from("contests")
          .update(contestUpdate)
          .eq("id", contestId)
          .eq("advertiser_id", user.id);

        if (updateError) {
          console.error(
            "❌ Failed to update complete contest data:",
            updateError
          );
          throw new Error(`Failed to update contest: ${updateError.message}`);
        }

        console.log(
          "✅ Complete contest data updated in database after payment"
        );
      } else {
        // No budget change - save all current form data as draft after successful payment
        console.log(
          "📝 No budget change - saving all form data as draft after payment"
        );

        // Prepare contest data update with all current form data
        const contestBasedDetails =
          contestType === "leaderboard"
            ? {
              leaderboard_contest: {
                prizes: winnerAmounts.map((amount, index) => ({
                  position: index + 1,
                  amount: amount,
                })),
                total_prize: winnerAmounts.reduce(
                  (sum, amount) => sum + amount,
                  0
                ),
                winner_count: winnerCount,
              },
            }
            : {
              cpm_contest: {
                cpm_rate_usd: parseFloat(cpmRate.toString()),
                min_views: minViews ? parseInt(minViews.toString()) : null,
                max_views: maxViews ? parseInt(maxViews.toString()) : null,
                total_budget: Math.round(
                  parseFloat(totalBudget.toString()) * 100
                ),
                terms_conditions: termsConditions,
              },
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
          inspiration_links: inspirationLinks.filter(
            (link) => link.url.trim() !== ""
          ),
          resources,
          contest_type: contestType,
          contest_based_details: contestBasedDetails,
          moderation_status: "draft", // Save as draft after successful payment
        };

        const { data: updatedContest, error: updateError } = await supabase
          .from("contests")
          .update(contestUpdate)
          .eq("id", contestId)
          .select()
          .single();

        if (updateError) {
          console.error("❌ Failed to save contest as draft:", updateError);
          throw new Error(`Failed to save contest: ${updateError.message}`);
        }

        console.log(
          "✅ Contest saved as draft with all form data after payment"
        );
      }

      toast({
        title: "Payment Successful",
        description:
          budgetChanged && budgetDifference > 0
            ? "Additional payment processed, contest saved as draft. Submitting for approval..."
            : "Payment completed, contest saved as draft. Submitting for approval...",
        variant: "default",
      });

      // Reset budget change tracking since payment is now complete
      setBudgetChanged(false);
      setBudgetDifference(0);

      // Update originalBudget to the new budget to prevent false change detection
      if (contestType === "leaderboard") {
        const newTotalPrize = winnerAmounts.reduce(
          (sum, amount) => sum + amount,
          0
        );
        setOriginalBudget(newTotalPrize);
      } else if (contestType === "cpm") {
        const newBudgetInCents = Math.round(
          parseFloat(totalBudget.toString()) * 100
        );
        setOriginalBudget(newBudgetInCents);
      }

      // Refresh contest data to show updated payment details
      await refreshContestData();

      // Force a re-render by clearing and resetting budget change detection
      console.log(
        "🔄 Forcing budget change check to clear any residual state..."
      );
      setTimeout(() => {
        if (contestType === "leaderboard") {
          checkBudgetChange(winnerAmounts);
        } else if (contestType === "cpm") {
          checkBudgetChange(undefined, totalBudget.toString());
        }
      }, 100);

      // Submit for approval using the shared function
      await submitForApproval();
    } catch (error: any) {
      console.error("❌ Error in payment success handler:", error);
      toast({
        title: "Update Failed",
        description: `Payment succeeded but failed to update contest: ${error.message}`,
        variant: "destructive",
      });
      setIsSubmitting(false);
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
  const checkBudgetChange = (
    newWinnerAmounts?: number[],
    newTotalBudget?: string
  ) => {
    let currentPrizePool = 0;

    if (contestType === "leaderboard") {
      const amounts = newWinnerAmounts || winnerAmounts;
      currentPrizePool = amounts.reduce(
        (sum: number, amount: number) => sum + amount,
        0
      );
    } else if (contestType === "cpm") {
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
      newTotalBudget,
    });

    return { currentBudget: currentPrizePool, difference: prizePoolDifference };
  };

  // Update budget change detection when prize amounts change
  const updateBudgetTracking = (amounts = winnerAmounts) => {
    checkBudgetChange(amounts);
  };

  // Handle save as draft for rejected contests
  const handleSaveAsDraft = async () => {
    await handleSubmitWithStatus("draft");
    // Refresh contest data after saving to ensure UI is up to date
    await refreshContestData();
  };

  // Add async comprehensive validation for edit contest (mirrors creation)
  const validateContestForEdit = async (
    userId: string,
    planFeatures: any
  ): Promise<{ isValid: boolean; error?: string }> => {
    // 1. Field validation (reuse existing logic)
    const error = validateFormForSubmission();
    if (error) {
      setIsSubmitting(false);
      return { isValid: false, error };
    }
    // 2. Plan and contest type checks
    if (contestType === "cpm") {
      const hasCpmAccess =
        planFeatures.contestTypes && planFeatures.contestTypes.includes("cpm");
      if (!hasCpmAccess) {
        setIsSubmitting(false);
        return {
          isValid: false,
          error:
            "CPM-based contests are only available with paid plans. Please upgrade your subscription or change to a Leaderboard contest.",
        };
      }
    }
    // 3. Active contest limit (only if submitting for approval, not draft)
    try {
      const activeCheck = await canCreateNewContest(
        userId,
        planFeatures.maxActiveContests,
        contestId
      );
      if (!activeCheck.canCreate) {
        setIsSubmitting(false);
        return {
          isValid: false,
          error:
            activeCheck.error ||
            `You have reached your plan limit of ${planFeatures.maxActiveContests} active contests. Please upgrade your plan or wait for existing contests to end.`,
        };
      }
    } catch (err) {
      setIsSubmitting(false);
      return {
        isValid: false,
        error: "Unable to validate contest limits. Please try again.",
      };
    }
    return { isValid: true };
  };

  // In handleResubmitForApproval, replace validation logic with async comprehensive validation
  const handleResubmitForApproval = async () => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to update a contest",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    const planFeatures = getPlanFeatures(userPlan);
    const validationResult = await validateContestForEdit(
      user.id,
      planFeatures
    );
    if (!validationResult.isValid) {
      toast({
        title: "Contest Validation Error",
        description: validationResult.error,
        variant: "destructive",
      });
      setFormFeedback(validationResult.error!);
      setFormFeedbackType("error");
      return;
    }
    // Check if payment/refund processing is required
    const paid = isContestPaid();
    const needsPayment = !paid || (budgetChanged && budgetDifference > 0);
    const needsRefund = budgetChanged && budgetDifference < 0;

    if (needsRefund) {
      // Show refund preview modal instead of processing directly
      try {
        await handleSubmitWithStatus("draft", true); // Save contest data first

        // Calculate refund details for preview
        const prizePoolDecrease = Math.abs(budgetDifference);

        // Get commission percentage from original payment details, not current plan
        let commissionPercentage = null;

        // First try to get from payment details (most accurate)
        if (contest?.payment_details) {
          try {
            const paymentDetails = typeof contest.payment_details === "string"
              ? JSON.parse(contest.payment_details)
              : contest.payment_details;
            if (paymentDetails.commission_percentage) {
              commissionPercentage = paymentDetails.commission_percentage;
              console.log(`💰 Using original commission percentage from payment details: ${commissionPercentage}%`);
            }
          } catch (error) {
            console.warn("Failed to parse payment details:", error);
          }
        }

        // If not found in payment details, try to get from subscription info
        else if (!commissionPercentage && contest?.subscription_info_of_user) {
          try {
            const subscriptionInfo = typeof contest.subscription_info_of_user === "string"
              ? JSON.parse(contest.subscription_info_of_user)
              : contest.subscription_info_of_user;

            // Get plan features from the subscription that was active when contest was created
            // Pass the product_id to getPlanFeatures
            const subscriptionPlanFeatures = getPlanFeatures(subscriptionInfo.product_id);
            if (subscriptionPlanFeatures.commissionPercentage) {
              commissionPercentage = subscriptionPlanFeatures.commissionPercentage;
              console.log(`💰 Using commission percentage from original subscription (product_id: ${subscriptionInfo.product_id}): ${commissionPercentage}%`);
            }
          } catch (error) {
            console.warn("Failed to parse subscription info:", error);
          }
        }

        // Final fallback to current plan (should rarely happen)
        if (!commissionPercentage) {
          commissionPercentage = getPlanFeatures(userPlan).commissionPercentage;
          console.warn(`💰 Using current plan commission as fallback: ${commissionPercentage}%`);
        }

        const commissionRefund = Math.round(
          prizePoolDecrease * (commissionPercentage / 100)
        );
        const totalRefundAmount = prizePoolDecrease + commissionRefund;

        // Set refund details and show preview modal
        setRefundDetails({
          prizePoolDecrease,
          commissionRefund,
          totalRefund: totalRefundAmount,
          commissionPercentage
        });
        setShowRefundPreview(true);
        setIsSubmitting(false);
        return;

      } catch (error: any) {
        console.error("❌ Error preparing refund preview:", error);
        toast({
          title: "Error",
          description: `Failed to prepare refund preview: ${error.message}`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    if (needsPayment) {
      try {
        await handleSubmitWithStatus("draft", true); // Skip redirect since we're showing payment modal
        setShowPayment(true);
        setIsPaymentRequired(true);
      } catch (error) {
        console.error("Error saving contest before payment:", error);
        toast({
          title: "Error",
          description:
            "Failed to save contest data before payment. Please try again.",
          variant: "destructive",
        });
      }
      setIsSubmitting(false);
      return;
    }

    // --- FIX: Handle the case where no payment/refund is required ---
    try {
      // Save any pending edits as draft
      await handleSubmitWithStatus("draft", true);

      // Submit for approval
      const response = await fetch(`/api/contests/${contestId}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_for_approval" }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Success",
          description:
            "Contest updated and submitted for approval successfully!",
          variant: "default",
        });
        router.push(`/dashboard/contests/${contestId}`);
      } else {
        throw new Error(result.error || "Failed to submit for approval");
      }
    } catch (error: any) {
      console.error("Error submitting for approval:", error);
      toast({
        title: "Submission Failed",
        description:
          error.message ||
          "Failed to submit contest for approval. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  // Modified submit function that accepts a moderation status and skipRedirect option
  const handleSubmitWithStatus = async (
    moderationStatus?: "draft" | "pending_approval",
    skipRedirect: boolean = false
  ) => {
    const showError = (message: string) => {
      toast({
        title: "Form Validation Error",
        description: message,
        duration: TOAST_DURATION_SHORT,
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
          description:
            "Operation is taking longer than expected. Please wait...",
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
    const isDraftMode = moderationStatus === "draft";

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

      const validInspirationLinks = inspirationLinks.filter(
        (link) => link.url.trim() !== ""
      );
      if (validInspirationLinks.length === 0) {
        showError("At least one inspiration link is required.");
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }

      const hasExistingResources = resources && resources.length > 0;
      const totalResources = hasExistingResources ? resources.length : 0;

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
        inspiration_links: inspirationLinks.filter(
          (link) => link.url.trim() !== ""
        ),
      };
    }

    // Add moderation status if specified (for rejected contest workflows)
    if (moderationStatus) {
      updatePayload.moderation_status = moderationStatus;
      if (moderationStatus === "pending_approval") {
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
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }

        // FIXED: Handle date input properly to avoid timezone issues
        // The HTML date input gives us YYYY-MM-DD format, we need to parse it correctly
        const startDateParts = startDate.split("-");
        const startYear = parseInt(startDateParts[0]);
        const startMonth = parseInt(startDateParts[1]) - 1; // Month is 0-indexed
        const startDay = parseInt(startDateParts[2]);

        // Create date in local timezone
        const startDateOnly = new Date(startYear, startMonth, startDay);
        const todayOnly = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const daysUntilStart = Math.floor(
          (startDateOnly.getTime() - todayOnly.getTime()) /
          (1000 * 60 * 60 * 24)
        );

        const originalStartDate = contest?.start_date
          ? new Date(contest.start_date)
          : null;
        const isNewContest = !originalStartDate || originalStartDate > now;

        if (isNewContest) {
          // CRITICAL: Use exact same logic as getMinDateTime for consistency
          if (daysUntilStart < MIN_DAYS_UNTIL_START) {
            toast({
              title: "Invalid Start Date",
              description: `Contest must start at least ${MIN_DAYS_UNTIL_START} days from today (${MIN_DAYS_UNTIL_START - 1
                } day gap required).`,
              variant: "destructive",
            });
            setIsSubmitting(false);
            if (submitTimeoutId) clearTimeout(submitTimeoutId);
            return;
          }
        } else if (startDateTime < now) {
          toast({
            title: "Invalid Start Time",
            description: "Contest start time must be in the future.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }

        if (endDateTime <= startDateTime) {
          toast({
            title: "Invalid End Time",
            description: "Contest end time must be after the start time.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }

        // Check contest duration limits
        const durationMs = endDateTime.getTime() - startDateTime.getTime();
        const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

        if (durationDays < MIN_CONTEST_DURATION_DAYS) {
          toast({
            title: "Invalid Duration",
            description: `Contest duration must be at least ${MIN_CONTEST_DURATION_DAYS} days.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }

        if (durationDays > MAX_CONTEST_DURATION_DAYS) {
          toast({
            title: "Invalid Duration",
            description: `Contest duration cannot exceed ${MAX_CONTEST_DURATION_DAYS} days.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }
        updatePayload.start_date = toUTCISOString(startDate, startTime);
        updatePayload.end_date = toUTCISOString(endDate, endTime);
      } catch (error) {
        console.error("Date validation error:", error);
        toast({
          title: "Date Error",
          description:
            "There was an error with the date/time format. Please check your entries.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
    } else {
      toast({
        title: "Missing Dates",
        description: "Contest start and end dates/times are required.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      if (submitTimeoutId) clearTimeout(submitTimeoutId);
      return;
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
          amount: amount,
        })),
        total_prize: currentTotalPrizePool,
        winner_count: winnerCount,
      };
      updatePayload.contest_type = "leaderboard";
      updatePayload.contest_based_details = contestBasedDetails;
    }

    if (!datesOnly && contestType === 'cpm') {
      const parsedCpmRate = typeof cpmRate === 'string' ? parseFloat(cpmRate) : cpmRate;
      const parsedMinViews = minViews ? (typeof minViews === 'string' ? parseInt(minViews) : minViews) : null;
      const parsedMaxViews = maxViews ? (typeof maxViews === 'string' ? parseInt(maxViews) : maxViews) : null;
      const parsedTotalBudget = typeof totalBudget === 'string' ? parseFloat(totalBudget) : totalBudget;

      if (!isDraftMode) {
        if (!parsedCpmRate || parsedCpmRate <= 0) {
          toast({
            title: "Invalid CPM Rate",
            description: "CPM rate must be a positive number.",
            variant: "destructive",
          });
          setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
        }

        if (parsedCpmRate < MIN_CPM_RATE) {
          toast({
            title: "CPM Rate Too Low",
            description: `CPM rate must be at least $${MIN_CPM_RATE} per 1000 views.`,
            variant: "destructive",
          });
          setIsSubmitting(false); if (submitTimeoutId) clearTimeout(submitTimeoutId); return;
        }

        if (parsedCpmRate > MAX_CPM_RATE) {
          toast({
            title: "CPM Rate Too High",
            description: `CPM rate cannot exceed $${MAX_CPM_RATE} per 1000 views.`,
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
      }

      contestBasedDetails.cpm_contest = {
        cpm_rate_usd: parsedCpmRate || 0,
        min_views: parsedMinViews,
        max_views: parsedMaxViews,
        total_budget: parsedTotalBudget ? parsedTotalBudget * 100 : 0, // cents
        budget_spent: contest?.contest_based_details?.cpm_contest?.budget_spent || 0,
        terms_conditions: (termsConditions || '').trim()
      };
      updatePayload.contest_type = 'cpm';
      updatePayload.contest_based_details = contestBasedDetails;
    }

    // Validate active contest limits when submitting for approval
    if (moderationStatus === "pending_approval") {
      try {
        // Import getActiveContestCount for custom validation
        const { getActiveContestCount } = await import(
          "@/lib/contest-utils-client"
        );
        const countResult = await getActiveContestCount(user.id, contestId);

        if (!countResult.success) {
          toast({
            title: "Contest Limit Check Failed",
            description:
              countResult.error ||
              "Unable to validate contest limits. Please try again.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          if (submitTimeoutId) clearTimeout(submitTimeoutId);
          return;
        }

        // Check if current contest would be considered "new" active contest
        // If it's currently draft or rejected, then changing to pending_approval adds +1 to active count
        let effectiveActiveCount = countResult.activeCount;
        if (
          contest.moderation_status === "draft" ||
          contest.moderation_status === "rejected"
        ) {
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
          title: "Contest Limit Check Failed",
          description: "Unable to validate contest limits. Please try again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        if (submitTimeoutId) clearTimeout(submitTimeoutId);
        return;
      }
    }

    try {
      if (!datesOnly) {
        // Use the already-uploaded thumbnail URL (from thumbnailPreview) if it exists, otherwise keep the existing one
        updatePayload.thumbnail_url =
          thumbnailPreview || contest.thumbnail_url || "";
        // Save resources array directly (files are already uploaded when added)
        updatePayload.resources = resources;
      }

      if (isAdmin) {
        const resp = await fetch(`/api/admin/contests/${contestId}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          throw new Error(j.error || 'Admin update failed');
        }
      } else {
        const { error: updateError } = await supabase
          .from("contests")
          .update(updatePayload)
          .eq("id", contestId)
          .eq("advertiser_id", user.id);

        if (updateError) {
          console.error("Supabase update error:", updateError);
          throw updateError;
        }
      }

      // Show appropriate success message
      let successMessage = "Contest updated successfully.";
      if (moderationStatus === "draft") {
        successMessage = "Contest saved as draft successfully.";
      } else if (moderationStatus === "pending_approval") {
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
        if (moderationStatus === "draft") {
          router.push("/dashboard/contests");
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
      setIsSubmitting(false);
    } finally {
      if (submitTimeoutId) clearTimeout(submitTimeoutId);
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
  const handleThumbnailDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];

      // Validate image file type
      const imageValidation = validateImageFile(file);
      if (!imageValidation.isValid) {
        setAssetUploadError(
          imageValidation.error || "Please upload a valid image file."
        );
        return;
      }

      setThumbnail(file);
      if (!user?.id) {
        setAssetUploadError("User not authenticated. Please sign in again.");
        return;
      }
      // Immediately upload to Supabase with new naming and cleanup
      try {
        // Remove any existing thumbnail for this contest (all extensions)
        const { data: existingFiles } = await supabase.storage
          .from("contest-assets")
          .list("contest_thumbnails");
        if (existingFiles) {
          const matching = existingFiles.filter((f) =>
            f.name.startsWith(`${contestId}_`)
          );
          if (matching.length > 0) {
            const paths = matching.map((f) => `contest_thumbnails/${f.name}`);
            await supabase.storage.from("contest-assets").remove(paths);
          }
        }
        // Get extension and timestamp
        const ext = file.name.split(".").pop() || "jpg";
        const timestamp = Date.now();
        const fileName = `contest_thumbnails/${contestId}_${timestamp}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("contest-assets")
          .upload(fileName, file);
        if (uploadError) {
          toast({
            title: "Thumbnail Upload Failed",
            description: uploadError.message,
            variant: "destructive",
          });
          return;
        }
        const { data: publicUrlData } = supabase.storage
          .from("contest-assets")
          .getPublicUrl(fileName);
        setThumbnailPreview(publicUrlData?.publicUrl || "");
        await supabase
          .from("contests")
          .update({ thumbnail_url: publicUrlData?.publicUrl || "" })
          .eq("id", contestId)
          .eq("advertiser_id", user.id);
      } catch (error: any) {
        toast({
          title: "Thumbnail Upload Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleResourceDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 20 * 1024 * 1024) {
        setResourceError("File size should not exceed 20MB.");
        return;
      }
      const description = prompt("Enter a description for this asset:");
      if (!description || !description.trim()) {
        setResourceError("Asset description is required.");
        return;
      }
      if (resources.some((r) => r.description === description.trim())) {
        setResourceError(
          `A resource with the description \"${description.trim()}\" already exists. Please use a unique description.`
        );
        return;
      }
      try {
        setIsUploadingAsset(true);
        // Use per-contest folder
        const fileName = `contest_resources/${contestId}/${file.name.replace(
          /\s+/g,
          "_"
        )}`;
        const { error: uploadError } = await supabase.storage
          .from("contest-assets")
          .upload(fileName, file);
        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }
        const { data: publicUrlData } = supabase.storage
          .from("contest-assets")
          .getPublicUrl(fileName);
        const publicUrl = publicUrlData?.publicUrl || "";
        if (!publicUrl) {
          throw new Error("Failed to get public URL for uploaded file");
        }
        const newResources: ResourceItem[] = [
          ...resources,
          {
            url: publicUrl,
            description: description.trim(),
            type: "internal",
          },
        ];
        setResources(newResources);
        await updateContestResourcesInDB(newResources);
        setResourceSuccess(
          `Asset \"${description.trim()}\" uploaded successfully!`
        );
      } catch (error: any) {
        console.error("Error uploading resource:", error);
        setResourceError(`Failed to upload asset: ${error.message}`);
      } finally {
        setIsUploadingAsset(false);
      }
    }
  };

  if (isLoading || isPlansLoading || isUserPlanLoading) {
    // Check all loading states
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading contest data...</p>
      </div>
    );
  }

  // Use the error state to display issues loading contest or plans
  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex  items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" asChild>
            {/* Link back to contests list if contest ID is problematic */}
            <Link
              href={
                contestId
                  ? `/dashboard/contests/${contestId}`
                  : "/dashboard/contests"
              }
            >
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
            onClick={() =>
              router.push(
                contestId
                  ? `/dashboard/contests/${contestId}`
                  : "/dashboard/contests"
              )
            }
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {error.includes("live or has ended")
              ? "Return to Contest"
              : "Back to Contests"}
          </Button>
        </div>
      </div>
    );
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
          <AlertDescription>
            Failed to load contest data. Please try again or go back.
          </AlertDescription>
        </Alert>
        <div className="flex justify-center">
          <Button
            onClick={() => router.push("/dashboard/contests")}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            Back to Contests
          </Button>
        </div>
      </div>
    );
  }

  // Get plan features for the current user for UI elements
  const planFeatures = getPlanFeatures(userPlan);
  const totalPrizePool = winnerAmounts.reduce(
    (sum, amount) => sum + (amount || 0),
    0
  );

  return (
    <div className="container max-w-[1200px] mx-auto py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/contests/${contestId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {datesOnly ? "Edit Contest Dates" : "Edit Contest"}
        </h1>
      </div>

      {/* Dates Only Warning */}
      {datesOnly && (
        <Alert className="mb-6 border-blue-200 bg-blue-50 text-blue-900">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Dates Only Mode:</strong> This contest is approved. You can
            only modify start and end dates/times. All other content fields are
            locked to maintain approval integrity.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan Information */}
      <div className="mb-6">
        <div className="border border-[#7F39EC] bg-[#D9C0FF26] text-black px-4 py-3 rounded-lg">
          <AlertDescription className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2 ">
              <Crown className="h-5 w-5 text-[#7F39EC]" />

              <div>
                <span className="font-medium text-md">Current Plan: </span>
                {subscriptionPlans.find((p) => p.id === userPlan)?.name ||
                  "EXPLORER"}
                <span className="ml-3 text-md text-black">
                  • Max Winners: {planFeatures.maxWinnersPerContest}• Min Prize
                  Pool: {formatCurrencyFromCents(planFeatures.minContestBudget)}
                </span>
              </div>
            </div>
            {userPlan !== PRODUCT_IDS.CHAMPION && (
              <Link href="/dashboard/billing?tab=subscription" className="px-4 py-2 rounded-lg bg-[#4A00BE] text-white text-sm font-medium hover:bg-[#6b2ed4] transition text-center">
                Upgrade Plan
              </Link>
            )}
          </AlertDescription>
        </div>
      </div>

      <div className="mx-auto bg-white rounded-xl shadow-xl px-2 py-4">
        <CardHeader>
          <CardTitle>Edit Contest Details</CardTitle>
        </CardHeader>
        <div className="px-3 md:p-6 space-y-6">
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
                  <Select
                    value={category}
                    onValueChange={(value) => setCategory(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crypto-financial">
                        Crypto/Financial
                      </SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="dating">Dating</SelectItem>
                      <SelectItem value="food-drink">Food & Drink</SelectItem>
                      <SelectItem value="games-toys">Games & Toys</SelectItem>
                      <SelectItem value="health-wellness">
                        Health & Wellness
                      </SelectItem>
                      <SelectItem value="home-living">Home & Living</SelectItem>
                      <SelectItem value="pets-animals">
                        Pets & Animals
                      </SelectItem>
                      <SelectItem value="sports-outdoors">
                        Sports & Outdoors
                      </SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 transition-colors duration-200 cursor-pointer ${isDragActive
                    ? "border-rose-500 bg-rose-50"
                    : "border-gray-300 bg-white"
                    }`}
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
                          {thumbnail?.size
                            ? ` · ${(thumbnail.size / (1024 * 1024)).toFixed(
                              2
                            )}MB`
                            : ""}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={removeThumbnail}
                          className="text-purple-500"
                        >
                          <Trash className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40">
                      <Image className="h-16 w-16 text-gray-400 mb-2" />
                      <p className="text-sm font-medium mb-1">
                        Drag, drop or browse{" "}
                        <span className="text-rose-500">thumbnail</span>
                      </p>
                      <p className="text-xs text-gray-500 mb-4">
                        Max file size: 5MB
                      </p>
                      <Button
                        className="bg-[#4A00BE] text-white px-4 py-2 rounded-lg text-md hover:bg-[#4A00BE]"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="project-brief">
                    Brief / Product Description
                  </Label>
                  <span className="text-red-500 font-bold text-lg">*</span>
                  <span className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-full font-medium">
                    Required
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-[#6C43D0] px-6 py-4 rounded-lg text-md text-white hover:bg-[#6C43D0] hover:text-white"
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBriefPreview(!showBriefPreview)}
                  >
                    {showBriefPreview ? "Edit" : "Preview"}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Provide a detailed description of your Product, what you want
                creators to do, key messages, target audience, and specific
                requirements.
              </p>

              {showBriefPreview ? (
                <div className="border rounded-lg p-4 min-h-[300px] bg-white">
                  <h4 className="text-sm font-medium mb-2 text-gray-600">
                    Preview:
                  </h4>
                  <div
                    className="prose prose-lg dark:prose-invert prose-headings:font-title font-default max-w-none"
                    style={{
                      padding: "12px 15px",
                      minHeight: "250px",
                    }}
                    dangerouslySetInnerHTML={{
                      __html:
                        briefHtml ||
                        '<p class="text-gray-400">No content yet. Click "Edit" to add content.</p>',
                    }}
                  />
                </div>
              ) : (
                <NovelEditor
                  value={briefHtml}
                  placeholder="Describe your product, what you want creators to do, key messages, target audience, and any specific requirements..."
                  height="250px"
                  ref={richTextEditorRef}
                  onChange={(html: string, json: any) => {
                    setBriefHtml(html);
                    setBriefJson(json);
                  }}
                />
              )}
            </div>
          )}

          {!datesOnly && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">
                    Set rules <span className="text-red-500">*</span>
                  </h3>
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                    Required
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-[#6C43D0] px-6 py-4 rounded-lg text-md text-white hover:bg-[#6C43D0] hover:text-white"
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleRulesPreview}
                  >
                    {showRulesPreview ? "Edit" : "Preview"}
                  </Button>
                </div>
              </div>

              {showRulesPreview ? (
                <div className="border rounded-lg p-4 min-h-[300px] bg-white">
                  <h4 className="text-sm font-medium mb-2 text-gray-600">
                    Preview:
                  </h4>
                  <div
                    className="prose prose-lg dark:prose-invert prose-headings:font-title font-default max-w-none"
                    style={{
                      padding: "12px 15px",
                      minHeight: "250px",
                    }}
                    dangerouslySetInnerHTML={{
                      __html:
                        rulesHtml ||
                        '<p class="text-gray-400">No rules yet. Click "Edit" to add rules.</p>',
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
                      console.log(
                        "Rules editor onChange - html:",
                        html?.substring(0, 50)
                      );
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
            <div className="mb-12">
              <div>
                <CardTitle className="mb-3 text-lg md:text-2xl">
                  Resources for Participants{" "}
                  <span className="text-red-500">*</span>
                </CardTitle>
                <CardDescription className="text-sm md:text-[13px]">
                  Provide at least one resource to help participants understand
                  your brand and contest requirements. You can upload assets
                  (logos, guidelines, examples) <b>or</b> add external links
                  (website, social media, portfolio).
                </CardDescription>
                <span className="text-xs text-red-600 px-2 py-1 rounded-full font-medium mt-2">
                  At least one required
                </span>
              </div>
              <div className="mt-1 space-y-6">
                {/* Asset Upload */}
                <div className="flex flex-col gap-6">
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 transition-colors duration-200 cursor-pointer ${isDragActive
                      ? "border-rose-500 bg-rose-50"
                      : "border-gray-300 bg-white"
                      }`}
                    onClick={() => resourceFileRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleResourceDrop}
                    tabIndex={0}
                    role="button"
                    aria-label="Upload asset"
                  >
                    {resourceFilePreview ? (
                      <div className="relative">
                        {resourceFilePreview.startsWith("file-type:") ? (
                          <div className="flex flex-col items-center justify-center h-32">
                            <File className="h-10 w-10 text-gray-400 mb-2" />
                            <p className="text-sm font-medium mb-1">
                              File Selected
                            </p>
                            <p className="text-xs text-gray-500">
                              {resourceFile?.name}
                            </p>
                            <div className="mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeResourceFile();
                                }}
                                className="text-purple-500"
                              >
                                <Trash className="h-4 w-4 mr-1" /> Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={resourceFilePreview}
                            alt="Preview"
                            className="mx-auto max-h-48 object-contain"
                          />
                        )}
                        {!resourceFilePreview.startsWith("file-type:") && (
                          <div className="mt-2 flex justify-between items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeResourceFile();
                              }}
                              className="text-red-500"
                            >
                              <Trash className="h-4 w-4 mr-1" /> Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-32">
                        <Upload className="h-10 w-10 text-gray-400 mb-2" />
                        <p className="text-sm font-medium mb-1">
                          Drag, drop or browse file
                        </p>
                        <p className="text-xs text-gray-500 mb-2">
                          Max file size: 20MB
                        </p>
                        <Button
                          className="bg-[#4A00BE] text-white px-4 py-2 rounded-lg text-md hover:bg-[#4A00BE]"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            resourceFileRef.current?.click();
                          }}
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
                  {/* File Description and Add Button */}
                  {resourceFile && (
                    <div className="mt-4 flex flex-col gap-4 items-end">
                      <div className="flex-1 w-full">
                        <Label htmlFor="fileDescription">
                          Description <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="fileDescription"
                          placeholder="Describe this asset"
                          value={resourceDescription}
                          onChange={(e) =>
                            setResourceDescription(e.target.value)
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={addFileResource}
                        disabled={!resourceDescription || isUploadingAsset}
                        className="w-full"
                      >
                        {isUploadingAsset ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Uploading...
                          </div>
                        ) : (
                          "Add Asset"
                        )}
                      </Button>
                    </div>
                  )}
                  {assetUploadError && (
                    <div className="text-red-500 text-sm mt-2">
                      {assetUploadError}
                    </div>
                  )}
                </div>
                {/* Or Separator */}
                <div className="flex items-center mt-4">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <span className="mx-4 text-gray-500 font-semibold">Or</span>
                  <div className="flex-grow border-t border-gray-300"></div>
                </div>
                {/* External Link Input */}
                <div>
                  <Label htmlFor="resourceLinkUrl">External Link</Label>
                  <Input
                    id="resourceLinkUrl"
                    type="url"
                    placeholder="https://example.com/resource"
                    value={newExternalResourceUrl}
                    onChange={(e) => setNewExternalResourceUrl(e.target.value)}
                    className="mb-4"
                  />
                  <Label htmlFor="resourceLinkDescription">
                    Description <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="resourceLinkDescription"
                    placeholder="Describe this link"
                    value={externalResourceDescription}
                    onChange={(e) =>
                      setExternalResourceDescription(e.target.value)
                    }
                    className="mb-5"
                  />
                  <Button
                    type="button"
                    onClick={addExternalResource}
                    disabled={
                      !newExternalResourceUrl || !externalResourceDescription
                    }
                    className="w-full mt-6 py-6 text-md bg-[#6C43D0] hover:bg-[#6C43D0]"
                  >
                    Add Link
                  </Button>
                  {externalLinkError && (
                    <div className="text-red-500 text-sm mt-1">
                      {externalLinkError}
                    </div>
                  )}
                </div>
                {/* Resource List */}
                <div className="mt-8">
                  <h4 className="text-md font-medium mb-2">
                    Assets & Resources
                  </h4>
                  {resources.length === 0 && (
                    <div className="text-gray-500">
                      No assets or links added yet.
                    </div>
                  )}
                  <ul className="space-y-3">
                    {resources.map((resource, idx) => {
                      const isSupabaseUrl = resource.url.includes(
                        "supabase.co/storage"
                      );
                      const isInternal = resource.type === "internal";

                      // Enhanced file type detection using URL extension
                      const isImage =
                        /\.(jpg|jpeg|png|gif|jfif|webp|svg|bmp)(\?|$)/i.test(
                          resource.url
                        );
                      const isPdf = /\.pdf(\?|$)/i.test(resource.url);
                      const isVideo =
                        /\.(mp4|mov|avi|webm|mkv|flv|wmv)(\?|$)/i.test(
                          resource.url
                        );
                      const isAudio = /\.(mp3|wav|flac|aac|ogg)(\?|$)/i.test(
                        resource.url
                      );
                      const isDocument =
                        /\.(doc|docx|xls|xlsx|ppt|pptx|txt|rtf)(\?|$)/i.test(
                          resource.url
                        );
                      const isArchive = /\.(zip|rar|7z|tar|gz)(\?|$)/i.test(
                        resource.url
                      );

                      return (
                        <li
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white dark:bg-gray-800 
                        border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"
                        >
                          {/* File Type Icons */}
                          {isInternal && isImage && (
                            <img
                              src={resource.url}
                              alt={resource.description}
                              className="w-16 h-16 object-cover rounded mr-3"
                            />
                          )}
                          {isInternal && isPdf && (
                            <span className="inline-block mr-2 align-middle">
                              <svg
                                width="40"
                                height="40"
                                fill="none"
                                viewBox="0 0 40 40"
                              >
                                <rect
                                  width="40"
                                  height="40"
                                  rx="8"
                                  fill="#F87171"
                                />
                                <path d="M12 8h16v24H12V8z" fill="#fff" />
                                <path
                                  d="M14 12h12M14 16h12M14 20h8"
                                  stroke="#F87171"
                                  strokeWidth="1"
                                />
                                <text
                                  x="20"
                                  y="28"
                                  textAnchor="middle"
                                  fill="#F87171"
                                  fontSize="8"
                                  fontWeight="bold"
                                >
                                  PDF
                                </text>
                              </svg>
                            </span>
                          )}
                          {isInternal && isVideo && (
                            <span className="inline-block mr-2 align-middle">
                              <svg
                                width="40"
                                height="40"
                                fill="none"
                                viewBox="0 0 40 40"
                              >
                                <rect
                                  width="40"
                                  height="40"
                                  rx="8"
                                  fill="#38BDF8"
                                />
                                <rect
                                  x="10"
                                  y="12"
                                  width="20"
                                  height="16"
                                  rx="2"
                                  fill="#fff"
                                />
                                <path d="M16 16l6 4-6 4V16z" fill="#38BDF8" />
                                <circle cx="32" cy="14" r="3" fill="#FF4444" />
                              </svg>
                            </span>
                          )}
                          {isInternal && isAudio && (
                            <span className="inline-block mr-2 align-middle">
                              <svg
                                width="40"
                                height="40"
                                fill="none"
                                viewBox="0 0 40 40"
                              >
                                <rect
                                  width="40"
                                  height="40"
                                  rx="8"
                                  fill="#8B5CF6"
                                />
                                <circle cx="20" cy="20" r="8" fill="#fff" />
                                <circle cx="20" cy="20" r="4" fill="#8B5CF6" />
                                <path d="M16 12h8v16h-8z" fill="#8B5CF6" />
                              </svg>
                            </span>
                          )}
                          {isInternal && isDocument && (
                            <span className="inline-block mr-2 align-middle">
                              <svg
                                width="40"
                                height="40"
                                fill="none"
                                viewBox="0 0 40 40"
                              >
                                <rect
                                  width="40"
                                  height="40"
                                  rx="8"
                                  fill="#F59E0B"
                                />
                                <rect
                                  x="10"
                                  y="8"
                                  width="18"
                                  height="24"
                                  rx="1"
                                  fill="#fff"
                                />
                                <rect
                                  x="12"
                                  y="10"
                                  width="14"
                                  height="2"
                                  fill="#F59E0B"
                                />
                                <rect
                                  x="12"
                                  y="14"
                                  width="14"
                                  height="1"
                                  fill="#F59E0B"
                                />
                                <rect
                                  x="12"
                                  y="17"
                                  width="14"
                                  height="1"
                                  fill="#F59E0B"
                                />
                                <rect
                                  x="12"
                                  y="20"
                                  width="10"
                                  height="1"
                                  fill="#F59E0B"
                                />
                                <rect
                                  x="12"
                                  y="23"
                                  width="12"
                                  height="1"
                                  fill="#F59E0B"
                                />
                                <rect
                                  x="12"
                                  y="26"
                                  width="8"
                                  height="1"
                                  fill="#F59E0B"
                                />
                              </svg>
                            </span>
                          )}
                          {isInternal && isArchive && (
                            <span className="inline-block mr-2 align-middle">
                              <svg
                                width="40"
                                height="40"
                                fill="none"
                                viewBox="0 0 40 40"
                              >
                                <rect
                                  width="40"
                                  height="40"
                                  rx="8"
                                  fill="#6B7280"
                                />
                                <rect
                                  x="8"
                                  y="12"
                                  width="24"
                                  height="16"
                                  rx="1"
                                  fill="#fff"
                                />
                                <rect
                                  x="8"
                                  y="12"
                                  width="24"
                                  height="4"
                                  fill="#6B7280"
                                />
                                <path
                                  d="M12 16h16M12 20h16M12 24h12"
                                  stroke="#6B7280"
                                  strokeWidth="1"
                                />
                              </svg>
                            </span>
                          )}
                          {isInternal &&
                            !isImage &&
                            !isPdf &&
                            !isVideo &&
                            !isAudio &&
                            !isDocument &&
                            !isArchive && (
                              <span className="inline-block mr-2 align-middle">
                                <svg
                                  width="40"
                                  height="40"
                                  fill="none"
                                  viewBox="0 0 40 40"
                                >
                                  <rect
                                    width="40"
                                    height="40"
                                    rx="8"
                                    fill="#10B981"
                                  />
                                  <rect
                                    x="10"
                                    y="8"
                                    width="18"
                                    height="24"
                                    rx="1"
                                    fill="#fff"
                                  />
                                  <rect
                                    x="12"
                                    y="10"
                                    width="14"
                                    height="2"
                                    fill="#10B981"
                                  />
                                  <rect
                                    x="12"
                                    y="14"
                                    width="14"
                                    height="1"
                                    fill="#10B981"
                                  />
                                  <rect
                                    x="12"
                                    y="17"
                                    width="14"
                                    height="1"
                                    fill="#10B981"
                                  />
                                  <rect
                                    x="12"
                                    y="20"
                                    width="10"
                                    height="1"
                                    fill="#10B981"
                                  />
                                  <rect
                                    x="12"
                                    y="23"
                                    width="12"
                                    height="1"
                                    fill="#10B981"
                                  />
                                  <rect
                                    x="12"
                                    y="26"
                                    width="8"
                                    height="1"
                                    fill="#10B981"
                                  />
                                </svg>
                              </span>
                            )}
                          {resource.type === "external" && (
                            <div className="text-[#4A00BE] bg-[#D8C3FF] rounded-full flex items-center justify-center w-12 h-12 mr-2">
                              <ExternalLink className="w-6= h-6" />
                            </div>
                          )}

                          <div className="flex-1">
                            <div className="font-medium">
                              {resource.description}
                            </div>
                            <div className="text-xs text-gray-700 mt-1 flex items-center gap-2">
                              <span>
                                {resource.type === "internal"
                                  ? "Uploaded File"
                                  : "External Link"}
                              </span>
                              {isInternal && isSupabaseUrl && (
                                <span className="text-gray-500">•</span>
                              )}
                            </div>
                            {resource.type === "external" && (
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline break-all"
                              >
                                {resource.url}
                              </a>
                            )}
                            {isInternal && isSupabaseUrl && (
                              <div className="flex items-center gap-2 mt-1">
                                {isImage ? null : isPdf ? (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center"
                                  >
                                    Open PDF
                                  </a>
                                ) : isVideo ? (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center"
                                  >
                                    Play Video
                                  </a>
                                ) : isAudio ? (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center"
                                  >
                                    Play Audio
                                  </a>
                                ) : (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center"
                                  >
                                    Open File
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          <button

                            onClick={() => removeResource(idx)}
                            className="text-[#4A00BE] bg-[#D8C3FF] p-3 rounded-full flex-shrink-0 self-end sm:self-auto"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Inspiration Content Section */}
          {!datesOnly && (
            <div>
              <div>
                <CardTitle className="mb-2 text-lg md:text-2xl">
                  Inspiration Content <span className="text-red-500">*</span>
                </CardTitle>
                <CardDescription className="mb-6 text-md">
                  Help creators understand your vision by adding at least one
                  inspiration link (Instagram, YouTube, TikTok, etc.) with a
                  description.
                </CardDescription>
              </div>
              <div className="space-y-4">
                {inspirationError && (
                  <div className="text-red-500 text-sm mb-2">
                    {inspirationError}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="inspirationUrlInput">
                    Inspiration Link{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="inspirationUrlInput"
                    type="url"
                    placeholder="https://instagram.com/example"
                    value={newInspirationUrl}
                    onChange={(e) => setNewInspirationUrl(e.target.value)}
                  />
                  <Label htmlFor="inspirationDescriptionInput">
                    Inspiration Description{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="inspirationDescriptionInput"
                    placeholder="Add description here*"
                    value={newInspirationDescription}
                    onChange={(e) =>
                      setNewInspirationDescription(e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    onClick={addInspiration}
                    className="w-full mt-6 py-6 text-md bg-[#6C43D0] hover:bg-[#6C43D0]"
                    disabled={!newInspirationUrl || !newInspirationDescription}
                  >
                    Add Inspiration
                  </Button>
                </div>
                {/* Inspiration List */}
                {inspirationLinks.length > 0 && (
                  <ul className="space-y-3 mt-6">
                    {inspirationLinks.map((item, index) => (
                      <li
                        key={index}
                        className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white dark:bg-gray-800 
                        border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"

                      >
                        <div className="text-[#4A00BE] bg-[#D8C3FF] rounded-full flex items-center justify-center w-12 h-12 mr-2">
                          <ExternalLink className="w-6= h-6" />
                        </div>
                        <div className="flex-1">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline break-all"
                          >
                            {item.url}
                          </a>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.description}
                          </div>
                        </div>
                        <button


                          onClick={() => removeInspirationLink(index)}
                          className="text-[#4A00BE] bg-[#D8C3FF] p-3 rounded-full flex-shrink-0 self-end sm:self-auto"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Contest Type Display (Read-Only) */}
          {!datesOnly && (
            <div className="space-y-2">
              <Label htmlFor="contest-type">Contest Type</Label>
              <Input
                id="contest-type"
                value={
                  contestType === "cpm" ? "CPM Based" : "Leaderboard Based"
                }
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
                  min={
                    endDate === getMinEndDate() ? getMinEndTime() : undefined
                  }
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
              <strong>Start Date Rule:</strong> Contest must start at least{" "}
              {MIN_DAYS_UNTIL_START} days from today.{" "}
              {getStartDateRuleExample()}
              <br />
              <strong>Duration:</strong> Contest must run between{" "}
              {MIN_CONTEST_DURATION_DAYS} and {MAX_CONTEST_DURATION_DAYS} days.
              The end date will automatically adjust to maintain minimum
              duration.
            </p>
          </div>

          <Separator />

          {/* Prize Distribution - Conditional for Leaderboard */}
          {!datesOnly && contestType === "leaderboard" && (
            <div className="space-y-4">
              <div className="flex items-center flex-col gap-3 md:flex-row md:justify-between">
                <h3 className="text-lg font-medium">Prize distribution</h3>
                <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                  <span className="text-sm font-medium">Total Prize Pool:</span>
                  <span className="text-lg font-bold">
                    {formatCurrencyFromCents(totalPrizePool)}
                  </span>
                </div>
              </div>

              {/* Plan Requirements Info */}


              <div className="mb-6">
                <div className="border border-[#7F39EC] bg-[#D9C0FF26] text-black px-4 py-3 rounded-lg">
                  <AlertDescription className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Info className="h-4 w-4 shrink-0" />
                      <span className="font-medium">Plan Requirements: </span>
                      <span className="whitespace-normal">Minimum total prize pool:{" "}
                        <strong>
                          {formatCurrencyFromCents(planFeatures.minContestBudget)}
                        </strong>
                      </span>
                      <span className="whitespace-normal">
                        • Maximum winners:{" "}
                        <strong>{planFeatures.maxWinnersPerContest}</strong>
                      </span>
                      <span className="whitespace-normal">
                        • Minimum
                        per winner:{" "}
                        <strong>
                          {formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}
                        </strong>
                      </span>
                    </div>


                  </AlertDescription>
                </div>
              </div>
              {/* <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Plan Requirements: </span>
                  Minimum total prize pool:{" "}
                  <strong>
                    {formatCurrencyFromCents(planFeatures.minContestBudget)}
                  </strong>
                  • Maximum winners:{" "}
                  <strong>{planFeatures.maxWinnersPerContest}</strong>• Minimum
                  per winner:{" "}
                  <strong>
                    {formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}
                  </strong>
                </AlertDescription>
              </Alert> */}

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <Label className="w-32 md:w-48">
                    Number of Winners{" "}
                    <span className="text-xs text-gray-500">(Required)</span>
                  </Label>
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
                          const newAmounts = [...winnerAmounts].slice(
                            0,
                            newCount
                          );
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
                          newAmounts.push(
                            DEFAULT_PRIZE_ALLOCATIONS[
                            position as keyof typeof DEFAULT_PRIZE_ALLOCATIONS
                            ] || MIN_PRIZE_PER_WINNER
                          );
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
                      disabled={
                        winnerCount >= planFeatures.maxWinnersPerContest
                      }
                    >
                      +
                    </Button>
                  </div>
                  <div className="text-sm text-gray-500">
                    <span>Max: {planFeatures.maxWinnersPerContest}</span>
                  </div>
                </div>

                {Array.from({ length: winnerCount }).map((_, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                    <Label className="w-40 md:w-48">Winner {i + 1}</Label>
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
                              description: `Prize amount cannot be less than ${formatCurrencyFromCents(
                                MIN_PRIZE_PER_WINNER
                              )}`,
                              variant: "destructive",
                            });
                          } else if (value > MAX_PRIZE_PER_WINNER) {
                            toast({
                              title: "Prize Amount Too High",
                              description: `Prize amount cannot exceed ${formatCurrencyFromCents(
                                MAX_PRIZE_PER_WINNER
                              )}`,
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                      min={MIN_PRIZE_PER_WINNER / 100}
                      className="w-full sm:w-40 md:w-48"
                    />
                    <div className="text-xs sm:text-sm text-gray-500">
                      <span>
                        Min: {formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Enhanced validation message for minimum total prize pool */}
              {totalPrizePool < planFeatures.minContestBudget && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>
                    ⚠️ The minimum prize pool for your current plan is{" "}
                    {formatCurrencyFromCents(planFeatures.minContestBudget)}.
                    Current total: {formatCurrencyFromCents(totalPrizePool)}.
                    Please increase prize amounts.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* CPM Configuration - Conditional for CPM */}
          {!datesOnly && contestType === "cpm" && (
            <div className="space-y-6">
              {/* <Separator /> */}
              <div>
                <h3 className="text-lg font-medium">CPM Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Configure the Cost Per Mille (CPM) details for this contest.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="cpmRate">
                    CPM Rate (USD per 1000 views){" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cpmRate"
                    type="number"
                    value={cpmRate}
                    onChange={(e) => setCpmRate(e.target.value)}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const numValue = parseFloat(value);

                      if (value && numValue < MIN_CPM_RATE) {
                        setCpmRate(MIN_CPM_RATE.toString());
                        toast({
                          title: "CPM Rate Too Low",
                          description: `CPM Rate must be at least $${MIN_CPM_RATE} per 1000 views.`,
                          variant: "destructive",
                        });
                      } else if (value && numValue > MAX_CPM_RATE) {
                        setCpmRate(MAX_CPM_RATE.toString());
                        toast({
                          title: "CPM Rate Too High",
                          description: `CPM Rate cannot exceed $${MAX_CPM_RATE} per 1000 views.`,
                          variant: "destructive",
                        });
                      }
                    }}
                    placeholder="e.g., 1.50"
                    min={MIN_CPM_RATE}
                    max={MAX_CPM_RATE}
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">
                    Range: ${MIN_CPM_RATE} - ${MAX_CPM_RATE} per 1000 views
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalBudget">
                    Total Budget (USD) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="totalBudget"
                    type="number"
                    value={totalBudget}
                    onChange={(e) => {
                      setTotalBudget(e.target.value);
                      checkBudgetChange(undefined, e.target.value);
                    }}
                    placeholder={`e.g., ${FORM_PLACEHOLDER_SMALL_AMOUNT}`}
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
                    onChange={(e) => {
                      const value = e.target.value;
                      setMinViews(value);

                      // Real-time validation
                      const minViewsValue =
                        value && value.trim() !== ""
                          ? parseInt(value, 10)
                          : null;
                      const maxViewsValue =
                        maxViews && maxViews.toString().trim() !== ""
                          ? parseInt(maxViews.toString(), 10)
                          : null;

                      if (
                        minViewsValue !== null &&
                        maxViewsValue !== null &&
                        minViewsValue >= maxViewsValue
                      ) {
                        toast({
                          title: "Invalid View Range",
                          description:
                            "Minimum views must be less than maximum views.",
                          variant: "destructive",
                        });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const minViewsValue =
                        value && value.trim() !== ""
                          ? parseInt(value, 10)
                          : null;
                      const maxViewsValue =
                        maxViews && maxViews.toString().trim() !== ""
                          ? parseInt(maxViews.toString(), 10)
                          : null;

                      if (
                        minViewsValue !== null &&
                        maxViewsValue !== null &&
                        minViewsValue >= maxViewsValue
                      ) {
                        toast({
                          title: "Invalid View Range",
                          description:
                            "Minimum views must be less than maximum views.",
                          variant: "destructive",
                        });
                      }
                    }}
                    placeholder={`e.g., ${FORM_PLACEHOLDER_SMALL_AMOUNT}`}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Minimum views a submission needs to be eligible
                    for earnings.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxViews">
                    Maximum Views (Cap, Optional)
                  </Label>
                  <Input
                    id="maxViews"
                    type="number"
                    value={maxViews}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMaxViews(value);

                      // Real-time validation
                      const maxViewsValue =
                        value && value.trim() !== ""
                          ? parseInt(value, 10)
                          : null;
                      const minViewsValue =
                        minViews && minViews.toString().trim() !== ""
                          ? parseInt(minViews.toString(), 10)
                          : null;

                      if (
                        minViewsValue !== null &&
                        maxViewsValue !== null &&
                        minViewsValue >= maxViewsValue
                      ) {
                        toast({
                          title: "Invalid View Range",
                          description:
                            "Minimum views must be less than maximum views.",
                          variant: "destructive",
                        });
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const maxViewsValue =
                        value && value.trim() !== ""
                          ? parseInt(value, 10)
                          : null;
                      const minViewsValue =
                        minViews && minViews.toString().trim() !== ""
                          ? parseInt(minViews.toString(), 10)
                          : null;

                      if (
                        minViewsValue !== null &&
                        maxViewsValue !== null &&
                        minViewsValue >= maxViewsValue
                      ) {
                        toast({
                          title: "Invalid View Range",
                          description:
                            "Minimum views must be less than maximum views.",
                          variant: "destructive",
                        });
                      }
                    }}
                    placeholder={`e.g., ${FORM_PLACEHOLDER_LARGE_AMOUNT}`}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Maximum views for which a creator can be paid for
                    a single submission.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="termsConditions">
                  Terms & Conditions <span className="text-red-500">*</span>
                </Label>
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
        </div>
        <CardFooter className="flex flex-col gap-4 pt-6">
          {/* Show rejection reason banner for rejected contests */}
          {contest?.moderation_status === "rejected" &&
            contest?.rejection_reason && (
              <div className="w-full">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Contest was rejected</div>
                    <div className="text-sm mt-1">
                      {contest.rejection_reason}
                    </div>
                    <div className="text-xs mt-2 text-muted-foreground">
                      Please address the issues above and either save as draft
                      for further editing or submit for approval.
                    </div>
                  </div>
                </Alert>
              </div>
            )}

          {/* Modern Error Display exactly like create contest page */}
          {formFeedback && formFeedbackType === "error" && (
            <div className="mr-auto">
              <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-3 w-3 text-white" />
                  </div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    {formFeedback}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Prize Pool Change Warning - Moved above all buttons for better responsive layout */}
          {budgetChanged && isContestPaid() && (
            <div className="w-full">
              <Alert
                variant={budgetDifference > 0 ? "destructive" : "default"}
                className={
                  budgetDifference > 0
                    ? "w-full border-orange-200 bg-orange-50"
                    : "w-full border-green-200 bg-green-50"
                }
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">Prize Pool Changed</div>
                  <div className="text-sm mt-1 break-words">
                    {budgetDifference > 0
                      ? `Prize pool increased by ${formatCurrencyFromCents(
                        budgetDifference
                      )}. Original: ${formatCurrencyFromCents(originalBudget)} → New Total: ${formatCurrencyFromCents(originalBudget + budgetDifference)}. Additional payment (including commission) will be required.`
                      : `Prize pool decreased by ${formatCurrencyFromCents(
                        Math.abs(budgetDifference)
                      )}. You will be refunded this amount plus commission.`}
                  </div>
                </div>
              </Alert>
            </div>
          )}

          {/* Button Row - Cancel on left, Save/Submit on right */}
          <div className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 w-full">
            {/* Cancel button on the left */}
            <button
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="border font-semibold border-[#4A00BE] px-4 py-2 rounded-lg text-md text-[#4A00BE] w-full sm:w-auto"
            >
              Cancel
            </button>

            {/* Save/Submit buttons on the right */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {datesOnly ? (
                // Dates-only mode: Just save changes (no approval needed)
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !!validationError}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </div>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              ) : contest?.moderation_status !== "published" ? (
                // Full edit mode for non-published contests: Draft/Save and Submit buttons
                <>

                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <button
                      className="border h-[38px] font-semibold border-[#4A00BE] px-3 sm:px-4 py-2 rounded-lg text-sm text-[#4A00BE] w-full sm:w-auto flex-shrink-0 whitespace-nowrap"
                      onClick={handleSaveAsDraft}
                      disabled={isSubmitting || !!validationError}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Saving...</span>
                        </div>
                      ) : (
                        "Save as Draft"
                      )}
                    </button>
                    <Button
                      onClick={handleResubmitForApproval}
                      disabled={isSubmitting || !!validationError}
                      className="bg-[#4A00BE] cursor-pointer px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm text-white hover:bg-[#4A00BE] w-full sm:w-auto sm:min-w-[160px] flex-shrink-0 whitespace-nowrap"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Processing...</span>
                        </div>
                      ) : contest?.moderation_status === "pending_approval" ? (
                        <>
                          <span className="hidden xl:inline">Update & Resubmit for Approval</span>
                          <span className="hidden md:inline xl:hidden">Update & Resubmit</span>
                          <span className="hidden sm:inline md:hidden">Update & Submit</span>
                          <span className="sm:hidden">Update</span>
                        </>
                      ) : contest && isContestPaid() && !budgetChanged ? (
                        "Submit for Approval"
                      ) : contest &&
                        isContestPaid() &&
                        budgetChanged &&
                        budgetDifference > 0 ? (
                        "Update & Pay"
                      ) : contest &&
                        isContestPaid() &&
                        budgetChanged &&
                        budgetDifference < 0 ? (
                        "Update Contest"
                      ) : (
                        "Submit & Pay"
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                // Full edit mode for published contests: Just save changes (should rarely happen)
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !!validationError}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </div>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      </div>

      {/* Refund Preview Modal */}
      {showRefundPreview && refundDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Refund Preview
                </h2>
                <p className="text-gray-600">
                  Review the refund details before proceeding
                </p>
              </div>

              <div className="mb-6">
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Prize Pool Decreased:</strong> Your prize pool
                    decreased by {formatCurrencyFromCents(refundDetails.prizePoolDecrease)}.
                    You will receive a refund of this amount plus commission.
                  </AlertDescription>
                </Alert>

                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold text-gray-900 mb-3">Refund Breakdown</h3>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Prize Pool Reduction:</span>
                      <span className="font-medium">{formatCurrencyFromCents(refundDetails.prizePoolDecrease)}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span>Commission Refund ({refundDetails.commissionPercentage}%):</span>
                      <span className="font-medium">{formatCurrencyFromCents(refundDetails.commissionRefund)}</span>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total Refund Amount:</span>
                      <span className="text-green-600">{formatCurrencyFromCents(refundDetails.totalRefund)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This refund will be processed to your wallet balance.
                    The contest will be saved as draft and submitted for approval after the refund is completed.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRefundPreview(false);
                    setRefundDetails(null);
                    setIsSubmitting(false);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={processRefund}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Refund...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Process Refund
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && contest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Contest Payment
                </h2>
                <p className="text-gray-600">
                  Complete payment to submit your contest for review
                </p>
              </div>

              {budgetChanged && budgetDifference > 0 && (
                <Alert className="mb-4 border-orange-200 bg-orange-50 w-full">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <AlertDescription className="min-w-0">
                    <strong>Prize Pool Increased:</strong> Your prize pool
                    increased by {formatCurrencyFromCents(budgetDifference)}.
                    <br />
                    <span className="text-sm text-gray-600 break-words">
                      Original: {formatCurrencyFromCents(originalBudget)} → New Total: {formatCurrencyFromCents(originalBudget + budgetDifference)}
                    </span>
                    <br />
                    The payment below includes this amount plus commission.
                  </AlertDescription>
                </Alert>
              )}

              <ContestPaymentSelection
                contestAmount={
                  budgetChanged && budgetDifference > 0
                    ? budgetDifference / 100 // Prize pool increase amount in dollars
                    : contestType === "leaderboard"
                      ? winnerAmounts.reduce(
                        (sum, amount) => sum + (amount || 0),
                        0
                      ) / 100 // Convert cents to dollars
                      : parseFloat(totalBudget.toString()) || 0
                } // Budget is already in dollars
                contestTitle={title || "Untitled Contest"}
                contestId={contestId}
                commissionPercentage={
                  getPlanFeatures(userPlan).commissionPercentage
                }
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                disabled={isSubmitting}
                isIncrease={budgetChanged && budgetDifference > 0}
                isDecrease={false} // Budget decreases are now handled directly, not through payment modal
              />

              <div className="mt-6">
                <Button

                  className="w-full bg-[#FF323224] text-[#E50000] py-6 text-md rounded-full"
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
  );
}
