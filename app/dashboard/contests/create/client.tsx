"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Image,
  Trash,
  Trophy,
  Upload,
  AlertTriangle,
  ExternalLink,
  GitGraphIcon,
} from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  cn,
  toLocalDateTimeStrings,
  toUTCISOString,
  validateImageFile,
} from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { toast } from "@/hooks/use-toast"; // Added import
import dynamic from "next/dynamic";
import REGIONS_AND_COUNTRIES_DATA from "@/data/regions-and-countries.json";

// Dynamically import the Novel editor
const NovelEditor = dynamic(() => import("@/components/novel-editor"), {
  ssr: false,
});

// Re-added constants that were accidentally removed
import {
  subscriptionPlans,
  MIN_PRIZE_PER_WINNER,
  MAX_PRIZE_PER_WINNER,
  MIN_MILESTONE_PAYOUT_CENTS,
  MIN_CPM_RATE,
  MAX_CPM_RATE,
  MIN_DAYS_UNTIL_START,
  MIN_CONTEST_DURATION_DAYS,
  MAX_CONTEST_DURATION_DAYS,
  DEFAULT_PRIZE_ALLOCATIONS,
  HIGH_BUDGET_THRESHOLD,
  PRODUCT_IDS,
  PRICE_IDS,
  DEFAULT_TOTAL_PRIZE_POOL,
  DEFAULT_WINNER_AMOUNTS,
  DEFAULT_WINNER_COUNT,
  TOAST_DURATION_LONG,
  FORM_PLACEHOLDER_SMALL_AMOUNT,
  FORM_PLACEHOLDER_LARGE_AMOUNT,
  PLAN_PRICE_THRESHOLD_STARTER,
  HIGH_MIN_BUDGET_THRESHOLD,
} from "@/constants/subscriptionPlans";
import { createClient } from "@/utils/supabase/client";
import { UserResponse } from "@supabase/supabase-js";
import { ContestPaymentSelection } from "@/components/ContestPaymentSelection";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatName } from "@/lib/name-utils";
import { RotateCcw } from "lucide-react";
import {
  CONTENT_TYPE_CATEGORIES,
  INTEREST_CATEGORIES,
  INTERESTS,
} from "@/constants/contentCategories";

// Define types for subscription plan features
type PlanFeatures = {
  maxActiveContests: number;
  minContestBudget: number;
  maxWinnersPerContest: number;
  commissionPercentage: number;
  contestTypes?: string[];
  analytics?: string;
  support?: string;
  description?: string;
};

// Define type for subscription plan
type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  features: PlanFeatures;
};

type Step = "basics" | "brief" | "resources" | "prize" | "payment";

const STEP_PROGRESS: Record<Step, number> = {
  basics: 8,
  brief: 35,
  resources: 70,
  prize: 100,
  payment: 100,
};

// Add ResourceItem type at the top (after imports)
type ResourceItem = {
  url: string;
  description: string;
  type: "internal" | "external";
};

type MilestoneFormRow = {
  id: string;
  target_views: number | string;
  payout_dollars: number | string;
  /** Empty = unlimited winners for this milestone */
  winner_limit: number | string;
};

function createEmptyMilestoneRow(): MilestoneFormRow {
  return {
    id:
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `m-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    target_views: "",
    payout_dollars: "",
    winner_limit: "",
  };
}

// Regions and countries data
const REGIONS_AND_COUNTRIES: Record<string, string[]> =
  REGIONS_AND_COUNTRIES_DATA;

// Helper function to build region JSONB object from selected regions and countries
const buildRegionData = (
  selectedRegions: string[],
  selectedCountries: string[],
): Record<string, string[]> | null => {
  if (selectedRegions.length === 0 && selectedCountries.length === 0) {
    return null;
  }

  const regionData: Record<string, string[]> = {};

  // For each selected region, get the countries that are selected
  selectedRegions.forEach((region) => {
    const regionKey = region as keyof typeof REGIONS_AND_COUNTRIES;
    const regionCountries = REGIONS_AND_COUNTRIES[regionKey] || [];
    const countriesArray = Array.isArray(regionCountries)
      ? regionCountries.map((c) => String(c))
      : [];

    // Filter to only include countries that are actually selected
    const selectedCountriesInRegion = countriesArray.filter((country) =>
      selectedCountries.includes(country),
    );

    // Only add region if it has selected countries
    if (selectedCountriesInRegion.length > 0) {
      regionData[region] = selectedCountriesInRegion;
    }
  });

  // Also handle countries that might be selected without their region being selected
  // Group them by their region
  const ungroupedCountries = selectedCountries.filter((country) => {
    // Check if this country belongs to any selected region
    return !selectedRegions.some((region) => {
      const regionKey = region as keyof typeof REGIONS_AND_COUNTRIES;
      const regionCountries = REGIONS_AND_COUNTRIES[regionKey] || [];
      const countriesArray = Array.isArray(regionCountries)
        ? regionCountries.map((c) => String(c))
        : [];
      return countriesArray.includes(country);
    });
  });

  // Find which region each ungrouped country belongs to
  ungroupedCountries.forEach((country) => {
    Object.keys(REGIONS_AND_COUNTRIES).forEach((region) => {
      const regionKey = region as keyof typeof REGIONS_AND_COUNTRIES;
      const regionCountries = REGIONS_AND_COUNTRIES[regionKey] || [];
      const countriesArray = Array.isArray(regionCountries)
        ? regionCountries.map((c) => String(c))
        : [];

      if (countriesArray.includes(country)) {
        if (!regionData[region]) {
          regionData[region] = [];
        }
        if (!regionData[region].includes(country)) {
          regionData[region].push(country);
        }
      }
    });
  });

  return Object.keys(regionData).length > 0 ? regionData : null;
};

// Helper function to extract regions and countries from region JSONB data
const extractRegionsAndCountries = (
  regionData: Record<string, string[]> | null,
): { regions: string[]; countries: string[] } => {
  if (!regionData || typeof regionData !== "object") {
    return { regions: [], countries: [] };
  }

  const regions: string[] = [];
  const countries: string[] = [];

  Object.keys(regionData).forEach((region) => {
    const regionCountries = regionData[region];
    if (Array.isArray(regionCountries)) {
      regions.push(region);
      regionCountries.forEach((country) => {
        if (!countries.includes(country)) {
          countries.push(country);
        }
      });
    }
  });

  return { regions, countries };
};

export default function CreateContestPage({
  user,
}: {
  user: UserResponse["data"]["user"];
}) {
  // Add debugging logs at component initialization
  console.log("=== CreateContestPage Component Initialized ===");
  console.log("User:", user?.id);

  const [step, setStep] = useState<Step>("basics");
  const [trackingLinksOpen, setTrackingLinksOpen] = useState(false);
  const [trackingLinks, setTrackingLinks] = useState<
    { url: string; description: string }[]
  >([]);
  const [newTrackingUrl, setNewTrackingUrl] = useState("");
  const [newTrackingDescription, setNewTrackingDescription] = useState("");
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const currentUserFirstName = (() => {
    const metadata: any = (user as any)?.user_metadata || {};
    const rawFirst =
      metadata.first_name ||
      metadata.given_name ||
      (metadata.full_name ? String(metadata.full_name).split(" ")[0] : null);
    if (rawFirst && String(rawFirst).trim())
      return formatName(String(rawFirst));
    const emailLocal = (user?.email || "").split("@")[0];
    return emailLocal ? formatName(emailLocal) : "Creator";
  })();
  const addTrackingLink = () => {
    setTrackingError(null);
    const url = newTrackingUrl.trim();
    const description = newTrackingDescription.trim();
    if (!url) {
      setTrackingError("URL cannot be empty.");
      return;
    }
    // Store the URL with [creator] placeholder intact for dynamic replacement
    const processedUrl = url;
    // Validate URL format - create a test URL with placeholder replaced for validation
    const testUrl = url.includes("[creator]")
      ? url.replace(/\[creator\]/gi, "testcreator")
      : url;
    try {
      const urlObj = new URL(testUrl);
      if (urlObj.protocol !== "https:") {
        setTrackingError("URL must start with https://");
        return;
      }
    } catch {
      setTrackingError("Invalid URL format.");
      return;
    }
    if (!description) {
      setTrackingError("Description is required.");
      return;
    }
    if (trackingLinks.some((link) => link.url === processedUrl)) {
      setTrackingError("This tracking link has already been added.");
      return;
    }
    setTrackingLinks([...trackingLinks, { url: processedUrl, description }]);
    setNewTrackingUrl("");
    setNewTrackingDescription("");
    toast({ title: "Success", description: "Tracking link added!" });
  };

  const removeTrackingLink = (index: number) => {
    setTrackingLinks(trackingLinks.filter((_, i) => i !== index));
    toast({ title: "Success", description: "Tracking link removed!" });
  };
  const [showPayment, setShowPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  // Contest Type and CPM-specific state
  const [contestType, setContestType] = useState<
    "leaderboard" | "cpm" | "milestone"
  >("leaderboard");
  const [cpmRate, setCpmRate] = useState<number | string>("");
  const [minViews, setMinViews] = useState<number | string>("");
  const [maxViews, setMaxViews] = useState<number | string>("");
  const [totalBudget, setTotalBudget] = useState<number | string>("");
  const [termsConditions, setTermsConditions] = useState<string>("");

  // CPM Points Configuration (similar to RAID_POINTS_CONFIG)
  const [cpmPointsConfig, setCpmPointsConfig] = useState<{
    // Base points
    comment_base_points: number | string;
    retweet_base_points: number | string;
    quote_repost_base_points: number | string;
    // Comment engagement multipliers
    comment_likes_multiplier: number | string;
    comment_replies_multiplier: number | string;
    comment_impressions_multiplier: number | string;
    comment_retweets_multiplier: number | string;
    comment_quote_reposts_multiplier: number | string;
    // Retweet engagement multipliers
    retweet_likes_multiplier: number | string;
    retweet_replies_multiplier: number | string;
    retweet_impressions_multiplier: number | string;
    retweet_retweets_multiplier: number | string;
    retweet_quote_reposts_multiplier: number | string;
    // Quote repost engagement multipliers
    quote_repost_likes_multiplier: number | string;
    quote_repost_replies_multiplier: number | string;
    quote_repost_impressions_multiplier: number | string;
    quote_repost_retweets_multiplier: number | string;
    quote_repost_quote_reposts_multiplier: number | string;
  }>({
    comment_base_points: "1",
    retweet_base_points: "5",
    quote_repost_base_points: "10",
    comment_likes_multiplier: "0.1",
    comment_replies_multiplier: "1",
    comment_impressions_multiplier: "0.001",
    comment_retweets_multiplier: "0",
    comment_quote_reposts_multiplier: "0",
    retweet_likes_multiplier: "0.05",
    retweet_replies_multiplier: "0.05",
    retweet_impressions_multiplier: "0.001",
    retweet_retweets_multiplier: "0.05",
    retweet_quote_reposts_multiplier: "0",
    quote_repost_likes_multiplier: "0.1",
    quote_repost_replies_multiplier: "0.1",
    quote_repost_impressions_multiplier: "0.001",
    quote_repost_retweets_multiplier: "0.1",
    quote_repost_quote_reposts_multiplier: "0.1",
  });
  // Milestone contest (video only) — see docs/MILESTONE_CONTEST_GUIDE.md
  const [milestoneRows, setMilestoneRows] = useState<MilestoneFormRow[]>([
    createEmptyMilestoneRow(),
  ]);
  const [milestoneSequenceError, setMilestoneSequenceError] = useState<
    string | null
  >(null);
  const lastMilestoneSequenceToastRef = useRef<string | null>(null);
  const [milestoneBonusEnabled, setMilestoneBonusEnabled] = useState(false);
  const [milestoneBonusTopViewsMin, setMilestoneBonusTopViewsMin] = useState<
    number | ""
  >("");
  const [milestoneBonusTopViewsPayout, setMilestoneBonusTopViewsPayout] =
    useState<string>("");
  const [milestoneBonusTopViewsMinReels, setMilestoneBonusTopViewsMinReels] =
    useState<number | "">("");
  const [milestoneBonusTopReelsMin, setMilestoneBonusTopReelsMin] = useState<
    number | ""
  >("");
  const [milestoneBonusTopReelsMinViews, setMilestoneBonusTopReelsMinViews] =
    useState<number | "">("");
  const [milestoneBonusTopReelsPayout, setMilestoneBonusTopReelsPayout] =
    useState<string>("");
  // End Contest Type and CPM-specific state

  // New features state (2025-10-01)
  const [multipleSubmissionsEnabled, setMultipleSubmissionsEnabled] =
    useState(false);
  const [maxSubmissionsPerCreator, setMaxSubmissionsPerCreator] =
    useState<number>(1);
  const [contentType, setContentType] = useState<
    "ugc" | "clipping" | "other" | "" | "raid" | "awareness"
  >("");
  const [keywords, setKeywords] = useState<string[]>([""]); // For brief step
  const [mentions, setMentions] = useState<string[]>([""]); // Tracking (@mentions)
  const [maxParticipants, setMaxParticipants] = useState<number | "">(""); // Max participants for Twitter campaigns
  const [targetLikes, setTargetLikes] = useState<number | "">("");
  const [targetReplies, setTargetReplies] = useState<number | "">("");
  const [targetRetweets, setTargetRetweets] = useState<number | "">("");
  const [targetQuoteReposts, setTargetQuoteReposts] = useState<number | "">("");
  // Twitter CPM points configuration (Points Model): metric weights (empty = disabled)
  const [twitterPointsConfig, setTwitterPointsConfig] = useState<{
    likesWeight: number | string;
    commentsWeight: number | string;
    retweetsWeight: number | string;
    quoteRepostsWeight: number | string;
    impressionsWeight: number | string; // optional "views" points (impressions)
  }>({
    likesWeight: "",
    commentsWeight: "",
    retweetsWeight: "",
    quoteRepostsWeight: "",
    impressionsWeight: "",
  });
  const [flatFeeBonus, setFlatFeeBonus] = useState<number | string>(""); // In dollars
  const [flatFeeBonusCap, setFlatFeeBonusCap] = useState<number | string>(""); // In dollars - for CPM contests only

  // Checkboxes to show/hide engagement multiplier sections
  const [showCommentMultipliers, setShowCommentMultipliers] = useState(false);
  const [showRetweetMultipliers, setShowRetweetMultipliers] = useState(false);
  const [showQuoteRepostMultipliers, setShowQuoteRepostMultipliers] =
    useState(false);
  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [bonusHtml, setBonusHtml] = useState("");
  const [bonusJson, setBonusJson] = useState<any>(null);
  const [showBonusPreview, setShowBonusPreview] = useState(false);
  const [maxEarningsPerCreator, setMaxEarningsPerCreator] = useState<
    number | string
  >(""); // In dollars
  // Initialize theme state with proper detection to prevent flash
  const [mode, setMode] = useState<"light" | "dark">(() => {
    // Check if we're in browser environment
    if (typeof window !== "undefined") {
      // Try to get theme from data-theme attribute first
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme") as
        | "light"
        | "dark";
      if (dataTheme) return dataTheme;

      // Fallback to data-mode attribute
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (dataMode) return dataMode;
      }

      // Check localStorage as last resort
      try {
        const savedMode = localStorage.getItem("dashboard-mode") as
          | "light"
          | "dark";
        if (savedMode) return savedMode;

        const preset = localStorage.getItem("dashboard-preset");
        if (preset === "game-of-creators" || preset === "dark-professional") {
          return "dark";
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    return "light";
  });

  const isDark = mode === "dark";
  const [title, setTitle] = useState("");

  const [contestCategories, setContestCategories] = useState<string[]>([]);
  const [contestSubcategories, setContestSubcategories] = useState<
    Array<{ category: string; subcategory: string }>
  >([]);
  const [contestInterests, setContestInterests] = useState<string[]>([]);
  // Show/hide targeting sections
  const [showTargetingSections, setShowTargetingSections] = useState(false);
  // Regions and countries state
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  // Toggle states for collapsible sections
  const [categoriesOpen, setCategoriesOpen] = useState(true); // Categories expanded by default
  const [subcategoriesOpen, setSubcategoriesOpen] = useState(false);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [briefHtml, setBriefHtml] = useState("");
  const [briefJson, setBriefJson] = useState<any>(null);
  const [showBriefPreview, setShowBriefPreview] = useState(false); // Default to editor mode for better UX
  const [rulesHtml, setRulesHtml] = useState("");
  const [rulesJson, setRulesJson] = useState<any>(null);
  const [showRulesPreview, setShowRulesPreview] = useState(false);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resourceFilePreview, setResourceFilePreview] = useState<string | null>(
    null,
  );
  const [resourceDescription, setResourceDescription] = useState("");
  const [externalResourceDescription, setExternalResourceDescription] =
    useState("");

  const [inspirationLinks, setInspirationLinks] = useState<
    { url: string; description: string }[]
  >([]);
  const [newInspirationUrl, setNewInspirationUrl] = useState("");
  const [newInspirationDescription, setNewInspirationDescription] =
    useState("");
  const [inspirationError, setInspirationError] = useState<string | null>(null);

  const mobileProgressPercent = STEP_PROGRESS[step] ?? 0;

  const [winnerCount, setWinnerCount] = useState<number>(3);
  const [winnerAmounts, setWinnerAmounts] = useState<number[]>(
    DEFAULT_WINNER_AMOUNTS,
  );
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resourceFileRef = useRef<HTMLInputElement>(null);
  const bonusRichTextEditorRef = useRef<any>(null);
  const router = useRouter();
  const supabase = createClient();
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [totalPrizePool, setTotalPrizePool] = useState<number>(
    DEFAULT_TOTAL_PRIZE_POOL,
  ); // Default total prize pool

  // New state for contest duration
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  // Add draft ID state for tracking loaded drafts
  const [draftId, setDraftId] = useState<string | null>(null);

  // Refresh protection state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showRefreshWarning, setShowRefreshWarning] = useState(false);

  // Read mode from data attribute with immediate updates
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode && currentMode !== mode) {
          setMode(currentMode);
        }
      }
    };

    // Check immediately
    checkMode();

    // Watch for changes in the data attribute with immediate callback
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-mode"
        ) {
          checkMode();
        }
      });
    });

    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    // Also listen for storage events to catch theme changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "dashboard-mode" && e.newValue) {
        const newMode = e.newValue as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
        }
      }
    };

    // Listen for custom theme-change events for immediate updates
    const handleThemeChange = (e: CustomEvent) => {
      const newMode = e.detail?.mode;
      if (newMode && newMode !== mode) {
        setMode(newMode);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("theme-change", handleThemeChange as EventListener);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "theme-change",
        handleThemeChange as EventListener,
      );
    };
  }, [mode]);
  useEffect(() => {
    if (showPayment) {
      // Disable background scroll
      document.body.style.overflow = "hidden";
    } else {
      // Re-enable background scroll
      document.body.style.overflow = "";
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [showPayment]);

  // Refresh protection - track changes and warn before refresh
  useEffect(() => {
    // Check if there are any unsaved changes
    const hasChanges =
      title ||
      thumbnail ||
      brief ||
      rulesHtml ||
      resources.length > 0 ||
      startDate ||
      endDate ||
      winnerAmounts.some((amount) => amount > 0) ||
      (contestType === "cpm" &&
        (cpmRate || minViews || maxViews || totalBudget || termsConditions)) ||
      (contestType === "milestone" &&
        (milestoneRows.some(
          (r) =>
            r.target_views !== "" ||
            r.payout_dollars !== "" ||
            r.winner_limit !== "",
        ) ||
          totalBudget));

    setHasUnsavedChanges(!!hasChanges);

    // Set up beforeunload event listener
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Add keyboard shortcut for refresh protection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F5" ||
        (e.ctrlKey && e.key === "r") ||
        (e.metaKey && e.key === "r")
      ) {
        if (hasChanges) {
          e.preventDefault();
          setShowRefreshWarning(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    title,
    thumbnail,
    brief,
    rulesHtml,
    resources,
    startDate,
    endDate,
    winnerAmounts,
    contestType,
    cpmRate,
    minViews,
    maxViews,
    totalBudget,
    termsConditions,
    milestoneRows,
    hasUnsavedChanges,
  ]);

  // Add this to the state declarations
  const [resourceFiles, setResourceFiles] = useState<{ [key: string]: File }>(
    {},
  );
  const [contestFormat, setContestFormat] = useState<"text_image" | "video">(
    "video",
  );
  const [platform, setPlatform] = useState<string>("youtube"); // Default platform
  const [category, setCategory] = useState<string>("technology");
  const isRaidTwitter = platform === "twitter" && contentType === "raid";

  useEffect(() => {
    if (contestFormat !== "video" && contestType === "milestone") {
      setContestType("leaderboard");
    }
  }, [contestFormat, contestType]);

  const [keywordsRequirementMode, setKeywordsRequirementMode] = useState<
    "all" | "any"
  >("all");
  const [mentionsRequirementMode, setMentionsRequirementMode] = useState<
    "all" | "any"
  >("all");

  // State for fetched subscription plans
  const [dbSubscriptionPlans, setDbSubscriptionPlans] = useState<
    SubscriptionPlan[]
  >([]);
  const [isPlansLoading, setIsPlansLoading] = useState(true); // Start as true

  // State for inline form feedback (especially for blocking validation errors)
  const [formFeedback, setFormFeedback] = useState<string | null>(null);
  const [formFeedbackType, setFormFeedbackType] = useState<
    "error" | "success" | null
  >(null);
  const [toastErrorMessage, setToastErrorMessage] = useState<string | null>(
    null,
  );

  const parseMilestoneViews = (value: number | string): number =>
    value === "" ? NaN : parseInt(String(value), 10);

  const parseMilestonePayout = (value: number | string): number =>
    value === "" ? NaN : parseFloat(String(value));

  const getMilestoneSequenceError = (
    rows: MilestoneFormRow[],
  ): string | null => {
    for (let i = 1; i < rows.length; i++) {
      const prevViews = parseMilestoneViews(rows[i - 1].target_views);
      const currentViews = parseMilestoneViews(rows[i].target_views);
      const prevPayout = parseMilestonePayout(rows[i - 1].payout_dollars);
      const currentPayout = parseMilestonePayout(rows[i].payout_dollars);

      if (!isNaN(currentViews) && !isNaN(prevViews) && currentViews <= prevViews) {
        return `Milestone ${i + 1}: target views must be higher than milestone ${i}.`;
      }

      if (
        !isNaN(currentPayout) &&
        !isNaN(prevPayout) &&
        currentPayout <= prevPayout
      ) {
        return `Milestone ${i + 1}: payout must be higher than milestone ${i}.`;
      }
    }

    return null;
  };

  const canAddNextMilestone = (rows: MilestoneFormRow[]): boolean => {
    if (rows.length === 0) return false;
    const last = rows[rows.length - 1];
    const lastViews = parseMilestoneViews(last.target_views);
    const lastPayout = parseMilestonePayout(last.payout_dollars);

    if (isNaN(lastViews) || lastViews <= 0) return false;
    if (isNaN(lastPayout) || lastPayout <= 0) return false;

    if (rows.length === 1) return true;

    const previous = rows[rows.length - 2];
    const previousViews = parseMilestoneViews(previous.target_views);
    const previousPayout = parseMilestonePayout(previous.payout_dollars);

    return lastViews > previousViews && lastPayout > previousPayout;
  };

  const updateMilestoneRowsWithValidation = (rows: MilestoneFormRow[]) => {
    const sequenceError = getMilestoneSequenceError(rows);
    setMilestoneSequenceError(sequenceError);
  };

  const handleAddMilestoneRow = () => {
    if (!canAddNextMilestone(milestoneRows)) return;

    const previousRow = milestoneRows[milestoneRows.length - 1];
    setMilestoneRows((prev) => [
      ...prev,
      {
        ...createEmptyMilestoneRow(),
        target_views: previousRow.target_views,
        payout_dollars: previousRow.payout_dollars,
        winner_limit: previousRow.winner_limit,
      },
    ]);
  };

  useEffect(() => {
    if (!milestoneSequenceError) {
      lastMilestoneSequenceToastRef.current = null;
      return;
    }
    if (lastMilestoneSequenceToastRef.current === milestoneSequenceError) return;
    toast({
      title: "Invalid Milestone Sequence",
      description: milestoneSequenceError,
      variant: "destructive",
    });
    lastMilestoneSequenceToastRef.current = milestoneSequenceError;
  }, [milestoneSequenceError]);

  // Section-specific error states for Assets step
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null);
  const [externalLinkError, setExternalLinkError] = useState<string | null>(
    null,
  );
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [contestId, setContestId] = useState<string | null>(null);

  // Add ref for the rich text editor
  const richTextEditorRef = useRef<any>(null);
  const rulesRichTextEditorRef = useRef<any>(null);

  // Add at top-level state
  const [showBackModal, setShowBackModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Add this function for handling resource file uploads

  useEffect(() => {
    console.log("Brief state updated:", brief);
    console.log("isQuillEmpty(brief) result:", isQuillEmpty(brief));
  }, [brief]);

  // Automatically show targeting sections when any targeting data is selected
  useEffect(() => {
    const hasTargetingData =
      contestCategories.length > 0 ||
      contestSubcategories.length > 0 ||
      contestInterests.length > 0 ||
      selectedRegions.length > 0 ||
      selectedCountries.length > 0;

    if (hasTargetingData && !showTargetingSections) {
      setShowTargetingSections(true);
    }
  }, [
    contestCategories,
    contestSubcategories,
    contestInterests,
    selectedRegions,
    selectedCountries,
    showTargetingSections,
  ]);

  // Helper function to check if rich text editor content is effectively empty
  const isQuillEmpty = (htmlString: string | null | undefined): boolean => {
    console.log("isQuillEmpty received:", htmlString);
    if (!htmlString) {
      console.log("isQuillEmpty: htmlString is null/undefined, returning true");
      return true;
    }

    // Remove common empty patterns from Novel/TipTap editor
    let cleanHtml = htmlString
      .replace(/<p><\/p>/g, "") // Remove empty paragraphs
      .replace(/<p>\s*<\/p>/g, "") // Remove paragraphs with only whitespace
      .replace(/<br\s*\/?>/g, "") // Remove line breaks
      .replace(/&nbsp;/g, "") // Remove non-breaking spaces
      .trim();

    if (typeof document !== "undefined") {
      // Ensure document is available (client-side)
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = cleanHtml;
      const textContent = tempDiv.textContent || tempDiv.innerText || "";
      const isEmpty = textContent.trim().length === 0;
      console.log(
        "isQuillEmpty: textContent='",
        textContent,
        "', trim().length=",
        textContent.trim().length,
        ", returning",
        isEmpty,
      );
      return isEmpty;
    }

    // Fallback for server-side: check if cleaned HTML has meaningful content
    const hasContent =
      cleanHtml.length > 0 && !cleanHtml.match(/^[\s\<\>\/]*$/);
    console.log("isQuillEmpty: server-side check, hasContent=", hasContent);
    return !hasContent;
  };

  // Function to capture content from rich text editor
  const captureBriefContent = () => {
    if (richTextEditorRef.current) {
      const content = richTextEditorRef.current.getContent();
      console.log(
        "Captured brief content:",
        content ? content.html.substring(0, 100) + "..." : content,
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
        content ? content.html.substring(0, 100) + "..." : content,
      );
      setRulesHtml(content.html);
      setRulesJson(content.json);
      return content.html;
    }
    return "";
  };

  // Function to capture content from bonus rich text editor
  const captureBonusContent = () => {
    if (bonusRichTextEditorRef.current) {
      const content = bonusRichTextEditorRef.current.getContent();
      console.log(
        "Captured bonus content:",
        content ? content.html.substring(0, 100) + "..." : content,
      );
      setBonusHtml(content.html);
      setBonusJson(content.json);
      return content.html;
    }
    return "";
  };

  // Function to preview the brief content
  const toggleBriefPreview = () => {
    if (!showBriefPreview) {
      // Always capture content before showing preview
      captureBriefContent();
    }
    setShowBriefPreview(!showBriefPreview);
  };

  // Function to preview the rules content
  const toggleRulesPreview = () => {
    if (!showRulesPreview) {
      // Always capture content before showing preview
      captureRulesContent();
    }
    setShowRulesPreview(!showRulesPreview);
  };

  // Function to preview the bonus content
  const toggleBonusPreview = () => {
    if (!showBonusPreview) {
      // Always capture content before showing preview
      captureBonusContent();
    }
    setShowBonusPreview(!showBonusPreview);
  };

  // Function to clear toast error when user starts interacting
  const clearToastError = () => {
    if (toastErrorMessage) {
      setToastErrorMessage(null);
    }
  };

  // Handler for region selection - automatically selects all countries in the region
  const handleRegionToggle = (region: string, checked: boolean) => {
    const regionKey = region as keyof typeof REGIONS_AND_COUNTRIES;
    const regionCountries = REGIONS_AND_COUNTRIES[regionKey] || [];
    const countriesArray = Array.isArray(regionCountries)
      ? [...regionCountries]
      : [];

    if (checked) {
      // Add region and all its countries
      setSelectedRegions([...selectedRegions, region]);
      setSelectedCountries([
        ...new Set([...selectedCountries, ...countriesArray]),
      ]);
    } else {
      // Remove region and all its countries
      setSelectedRegions(selectedRegions.filter((r) => r !== region));
      setSelectedCountries(
        selectedCountries.filter(
          (country) => !countriesArray.includes(country),
        ),
      );
    }
  };

  // Handler for individual country selection
  const handleCountryToggle = (country: string, checked: boolean) => {
    if (checked) {
      setSelectedCountries([...selectedCountries, country]);
    } else {
      setSelectedCountries(selectedCountries.filter((c) => c !== country));
      // If all countries from a region are deselected, remove the region
      const regionKeys = Object.keys(REGIONS_AND_COUNTRIES) as Array<
        keyof typeof REGIONS_AND_COUNTRIES
      >;
      regionKeys.forEach((region) => {
        const regionCountries = REGIONS_AND_COUNTRIES[region];
        const countriesArray = Array.isArray(regionCountries)
          ? [...regionCountries]
          : [];
        if (countriesArray.includes(country)) {
          const remainingCountries = countriesArray.filter(
            (c) => c !== country && selectedCountries.includes(c),
          );
          if (remainingCountries.length === 0) {
            setSelectedRegions(selectedRegions.filter((r) => r !== region));
          }
        }
      });
    }
  };

  // Handler to uncheck all countries in a specific region
  const handleUncheckAllCountriesInRegion = (region: string) => {
    const regionKey = region as keyof typeof REGIONS_AND_COUNTRIES;
    const regionCountries = REGIONS_AND_COUNTRIES[regionKey] || [];
    const countriesArray = Array.isArray(regionCountries)
      ? [...regionCountries]
      : [];

    // Remove all countries from this region from selectedCountries
    // Keep the region selected so users can manually select specific countries
    setSelectedCountries(
      selectedCountries.filter((country) => !countriesArray.includes(country)),
    );
  };

  // Helper function to delete thumbnail from Supabase storage
  const deleteFromStorage = async (thumbnailUrl: string) => {
    try {
      // Extract file path from Supabase URL
      const url = new URL(thumbnailUrl);
      const pathSegments = url.pathname.split("/");
      const bucketIndex = pathSegments.findIndex(
        (segment) => segment === "contest-assets",
      );

      if (bucketIndex !== -1 && bucketIndex < pathSegments.length - 1) {
        const filePath = pathSegments.slice(bucketIndex + 1).join("/");

        const { error: deleteError } = await supabase.storage
          .from("contest-assets")
          .remove([filePath]);

        if (deleteError) {
          console.error(
            "Failed to delete thumbnail from storage:",
            deleteError,
          );
        }
      }
    } catch (error) {
      console.error("Error parsing thumbnail URL for deletion:", error);
    }
  };

  // Helper function to create a draft contest in DB
  const createDraftContest = async (): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from("contests")
        .insert({
          advertiser_id: user.id,
          title: title || "No Title - Draft",
          brief_html: "",
          brief_json: null,
          rules_html: "",
          rules_json: null,
          inspiration_links: [],
          resources: [],
          thumbnail_url: null,
          start_date: null,
          end_date: null,
          moderation_status: "draft",
          contest_type: contestType || "leaderboard",
          contest_based_details:
            contestType === "leaderboard"
              ? {
                  leaderboard_contest: {
                    prizes: [],
                    total_prize: 0,
                    winner_count: 3,
                  },
                }
              : contestType === "cpm"
                ? {
                    cpm_contest: {
                      cpm_rate_usd: 0,
                      total_budget: 0,
                      terms_conditions: "",
                    },
                  }
                : contestType === "milestone"
                  ? {
                      milestone_contest: {
                        milestones: [],
                        total_budget_cents: 0,
                      },
                    }
                  : null,
          // Categories, subcategories, and interests
          categories: contestCategories.length > 0 ? contestCategories : null,
          subcategories: (() => {
            if (!contestSubcategories || contestSubcategories.length === 0)
              return null;
            // Group by category and remove duplicates
            const grouped: Record<string, string[]> = {};
            contestSubcategories.forEach((item) => {
              if (!grouped[item.category]) {
                grouped[item.category] = [];
              }
              if (!grouped[item.category].includes(item.subcategory)) {
                grouped[item.category].push(item.subcategory);
              }
            });
            return Object.keys(grouped).length > 0 ? grouped : null;
          })(),
          interests:
            contestInterests.length > 0 ? [...new Set(contestInterests)] : null,
          // Regions and countries as JSONB
          region: buildRegionData(selectedRegions, selectedCountries),
          // New features (2025-10-01)
          multiple_submissions_enabled: false,
          max_submissions_per_creator: 1,
          content_type: null,
          bonus_details: null,
          max_earnings_per_creator: null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating draft contest:", error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error("Error creating draft contest:", error);
      return null;
    }
  };

  // Helper function to instantly update contest in DB
  const updateContestInDB = async (
    updateObj: Partial<{
      resources: ResourceItem[];
      thumbnail_url: string | null;
      title?: string;
      brief_html?: string;
      brief_json?: any;
      rules_html?: string;
      rules_json?: any;
      inspiration_links?: { url: string; description: string }[];
      start_date?: string | null;
      end_date?: string | null;
      contest_type?: "leaderboard" | "cpm" | "milestone";
      contest_based_details?: any;
      categories?: string[] | null;
      subcategories?: Array<{ category: string; subcategory: string }> | null;
      interests?: string[] | null;
      contest_format?: "text_image" | "video";
    }>,
  ) => {
    const currentContestId = contestId || draftId;
    if (!user?.id || !currentContestId) return;

    try {
      const { error } = await supabase
        .from("contests")
        .update(updateObj)
        .eq("id", currentContestId)
        .eq("advertiser_id", user.id);

      if (error) {
        console.error("Error updating contest in DB:", error);
        toast({
          title: "Database Update Failed",
          description:
            "Changes updated in UI but failed to save to database. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating contest in DB:", error);
    }
  };

  const handleThumbnailChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
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
          description:
            "Thumbnail must be 5MB or smaller. Please choose a smaller file.",
          variant: "destructive",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      try {
        const isStorageAvailable = await checkStorageAvailability();
        if (!isStorageAvailable) {
          toast({
            title: "Storage Error",
            description: "Storage is not available. Please try again later.",
            variant: "destructive",
          });
          return;
        }
        if (!user?.id) {
          toast({
            title: "Authentication Error",
            description: "User not authenticated. Please sign in again.",
            variant: "destructive",
          });
          return;
        }
        let currentContestId = contestId || draftId;
        if (!currentContestId) {
          const newContestId = await createDraftContest();
          if (newContestId) {
            setContestId(newContestId);
            setDraftId(newContestId);
            currentContestId = newContestId;
          }
        }
        // Remove any existing thumbnail for this contest (all extensions)
        const { data: existingFiles } = await supabase.storage
          .from("contest-assets")
          .list("contest_thumbnails");
        if (existingFiles) {
          const matching = existingFiles.filter((f) =>
            f.name.startsWith(`${currentContestId}_`),
          );
          if (matching.length > 0) {
            const paths = matching.map((f) => `contest_thumbnails/${f.name}`);
            await supabase.storage.from("contest-assets").remove(paths);
          }
        }
        // Get extension and timestamp
        const ext = file.name.split(".").pop() || "jpg";
        const timestamp = Date.now();
        const fileName = `contest_thumbnails/${currentContestId}_${timestamp}.${ext}`;
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
        if (currentContestId) {
          await updateContestInDB({ thumbnail_url: publicUrl });
        }
        toast({
          title: "Success",
          description: "Thumbnail uploaded successfully!",
        });
      } catch (error: any) {
        console.error("Error uploading thumbnail:", error);
        setThumbnail(null);
        setThumbnailPreview(null);
        toast({
          title: "Upload Error",
          description: `Failed to upload thumbnail: ${error.message}`,
          variant: "destructive",
        });
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
        if (contestId || draftId) {
          await updateContestInDB({ thumbnail_url: null });
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

  const handleResourceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
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
  };

  const addFileResource = async () => {
    setAssetUploadError(null);
    if (!resourceFile) {
      setAssetUploadError("No file selected for upload.");
      return;
    }
    if (!resourceDescription.trim()) {
      setAssetUploadError(
        "Asset description is required for the uploaded file.",
      );
      return;
    }
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (resourceFile.size > maxSize) {
      setAssetUploadError(
        "File must be 20MB or smaller. Please choose a smaller file.",
      );
      return;
    }
    try {
      const isStorageAvailable = await checkStorageAvailability();
      if (!isStorageAvailable) {
        setAssetUploadError(
          "Storage is not available. Please try again later.",
        );
        return;
      }
      if (!user?.id) {
        setAssetUploadError("User not authenticated. Please sign in again.");
        return;
      }
      setIsUploadingAsset(true);
      let currentContestId = contestId || draftId;
      if (!currentContestId) {
        const newContestId = await createDraftContest();
        if (newContestId) {
          setContestId(newContestId);
          setDraftId(newContestId);
          currentContestId = newContestId;
        }
      }
      // Use per-contest folder
      const fileName = `contest_resources/${currentContestId}/${resourceFile.name.replace(
        /\s+/g,
        "_",
      )}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("contest-assets")
        .upload(fileName, resourceFile);
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
          description: resourceDescription,
          type: "internal",
        },
      ];
      setResources(newResources);
      if (currentContestId) {
        await updateContestInDB({ resources: newResources });
      }
      removeResourceFile();
      setAssetUploadError(null);
      toast({ title: "Success", description: "Asset uploaded successfully!" });
    } catch (error: any) {
      console.error("Error uploading resource:", error);
      setAssetUploadError(`Failed to upload asset: ${error.message}`);
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleSaveDraft = async () => {
    try {
      // Reset global form feedback
      setIsLoading(true);
      setFormFeedback(null);
      setFormFeedbackType(null);
      setUploadProgress("Saving draft...");

      // Capture brief content if we're on the brief step and not showing preview
      // If showing preview, the content is already captured
      if (
        (step === "brief" || step === "resources" || step === "prize") &&
        !showBriefPreview
      ) {
        captureBriefContent();
      }

      // Capture bonus content if enabled and on prize step
      if (step === "prize" && bonusEnabled && !showBonusPreview) {
        captureBonusContent();
      }

      // Add timeout to clear loading state if something goes wrong
      const draftTimeoutId = setTimeout(() => {
        setIsLoading(false);
        setUploadProgress(null);
        toast({
          title: "Error",
          description: "Draft save timed out. Please try again.",
          variant: "destructive",
        });
      }, 30000); // 30 second timeout as safety measure

      // Get the authenticated user first to verify we're logged in
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        toast({
          title: "Error",
          description: "You must be logged in to save drafts",
          variant: "destructive",
        });
        setIsLoading(false);
        setUploadProgress(null);
        clearTimeout(draftTimeoutId);
        return;
      }

      // Now call handleSubmit with draft=true
      await handleSubmit(true);

      // Clear timeout if we got here successfully
      console.log("Draft saved successfully, clearing timeout");
      clearTimeout(draftTimeoutId);
    } catch (error: any) {
      console.error("Error saving draft:", error);
      toast({
        title: "Error",
        description: `Failed to save draft: ${
          error.message || "Unknown error"
        }`,
        variant: "destructive",
      });
      setIsLoading(false);
      setUploadProgress(null);
    }
  };

  /**
   * Comprehensive validation function that checks ALL contest requirements
   * before allowing payment. This prevents users from paying and then
   * getting validation errors.
   */
  const validateContestForPayment = async (
    userId: string,
    planFeatures: any,
  ): Promise<{ isValid: boolean; error?: string }> => {
    try {
      // 1. Basic field validation
      if (!title.trim()) {
        return { isValid: false, error: "Contest title is required" };
      }

      if (!thumbnail && !thumbnailPreview) {
        return { isValid: false, error: "Contest thumbnail is required" };
      }

      // 2. Brief and rules validation
      const currentBrief = captureBriefContent();
      const briefToValidate = currentBrief || briefHtml;
      if (!briefToValidate || isQuillEmpty(briefToValidate)) {
        return { isValid: false, error: "Contest brief is required" };
      }

      const currentRulesHtml = captureRulesContent();
      const rulesToValidate = currentRulesHtml || rulesHtml;
      if (!rulesToValidate || isQuillEmpty(rulesToValidate)) {
        return { isValid: false, error: "Contest rules are required" };
      }

      // Capture bonus content if enabled
      if (bonusEnabled) {
        captureBonusContent();
      }

      // 3. Resources validation
      const hasUploadedAssets = resources.some((r) => r.type === "internal");
      const hasExternalLinks = resources.some((r) => r.type === "external");

      if (!hasUploadedAssets && !hasExternalLinks) {
        return {
          isValid: false,
          error:
            "At least one resource is required - upload an asset OR add an external resource link",
        };
      }

      // 4. Date validation
      if (!startDate || !startTime || !endDate || !endTime) {
        return {
          isValid: false,
          error: "Contest start and end dates/times are required",
        };
      }

      try {
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);
        const now = new Date();

        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          return {
            isValid: false,
            error: "Invalid date or time format. Please check your entries.",
          };
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
          now.getDate(),
        );
        const daysUntilStart = Math.floor(
          (startDateOnly.getTime() - todayOnly.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        // CRITICAL: Use exact same logic as getMinDateTime for consistency
        if (daysUntilStart < MIN_DAYS_UNTIL_START) {
          return {
            isValid: false,
            error: `Contest must start at least ${MIN_DAYS_UNTIL_START} days from today (${
              MIN_DAYS_UNTIL_START - 1
            } day gap required)`,
          };
        }

        if (endDateTime <= startDateTime) {
          return {
            isValid: false,
            error: "Contest end time must be after the start time",
          };
        }

        // Check contest duration limits
        const durationMs = endDateTime.getTime() - startDateTime.getTime();
        const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

        if (durationDays < MIN_CONTEST_DURATION_DAYS) {
          return {
            isValid: false,
            error: `Contest duration must be at least ${MIN_CONTEST_DURATION_DAYS} days`,
          };
        }

        if (durationDays > MAX_CONTEST_DURATION_DAYS) {
          return {
            isValid: false,
            error: `Contest duration cannot exceed ${MAX_CONTEST_DURATION_DAYS} days`,
          };
        }
      } catch (error) {
        return {
          isValid: false,
          error:
            "There was an error with the date/time format. Please check your entries.",
        };
      }

      // 5. Contest type specific validation
      if (contestType === "leaderboard") {
        // Prize amount validation
        for (let i = 0; i < winnerCount; i++) {
          if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
            return {
              isValid: false,
              error: `Prize for Winner ${
                i + 1
              } must be at least ${formatCurrencyFromCents(
                MIN_PRIZE_PER_WINNER,
              )}`,
            };
          }

          // CRITICAL: Check maximum prize per winner (this was missing!)
          if (winnerAmounts[i] > MAX_PRIZE_PER_WINNER) {
            return {
              isValid: false,
              error: `Prize for Winner ${
                i + 1
              } cannot exceed ${formatCurrencyFromCents(
                MAX_PRIZE_PER_WINNER,
              )}. Please reduce the prize amount.`,
            };
          }
        }

        // Total prize pool validation
        if (totalPrizePool < planFeatures.minContestBudget) {
          return {
            isValid: false,
            error: `The minimum prize pool for your plan is ${formatCurrencyFromCents(
              planFeatures.minContestBudget,
            )}. Please increase your prize amounts.`,
          };
        }

        // Winner count validation
        if (winnerCount > planFeatures.maxWinnersPerContest) {
          return {
            isValid: false,
            error: `Your plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners. Please reduce the number of winners.`,
          };
        }

        // Total Budget validation when Flat Fee Bonus is enabled
        const flatFeeBonusValue =
          flatFeeBonus && parseFloat(flatFeeBonus.toString()) > 0;
        if (flatFeeBonusValue) {
          const flatFeeBonusDollars = parseFloat(flatFeeBonus.toString());

          if (!totalBudget || parseFloat(totalBudget.toString()) <= 0) {
            return {
              isValid: false,
              error:
                "Total Budget is required when Flat Fee Bonus is enabled. Please enter a budget amount.",
            };
          }

          // Validate: Flat fee bonus cannot exceed total bonus budget (leaderboard)
          const totalBudgetDollars = parseFloat(totalBudget.toString());
          if (flatFeeBonusDollars > totalBudgetDollars) {
            return {
              isValid: false,
              error: "Flat Fee Bonus cannot exceed Total Budget.",
            };
          }
        }
      } else if (contestType === "milestone") {
        if (contestFormat !== "video") {
          return {
            isValid: false,
            error: "Milestone contests are only available for video contests.",
          };
        }

        const effectiveMilestoneRows = milestoneRows.filter(
          (r) =>
            r.target_views !== "" ||
            r.payout_dollars !== "" ||
            r.winner_limit !== "",
        );

        if (effectiveMilestoneRows.length === 0) {
          return {
            isValid: false,
            error:
              "Add at least one milestone with target views and payout amount.",
          };
        }

        if (!totalBudget || parseFloat(totalBudget.toString()) <= 0) {
          return {
            isValid: false,
            error: "Total contest budget is required for milestone contests.",
          };
        }

        const budgetCents = Math.round(
          parseFloat(totalBudget.toString()) * 100,
        );
        if (budgetCents < planFeatures.minContestBudget) {
          return {
            isValid: false,
            error: `The minimum contest budget for your plan is ${formatCurrencyFromCents(
              planFeatures.minContestBudget,
            )}. Please increase your total budget.`,
          };
        }

        const parsed: Array<{
          target_views: number;
          payout_cents: number;
          winner_limit: number | null;
        }> = [];

        for (let i = 0; i < effectiveMilestoneRows.length; i++) {
          const row = effectiveMilestoneRows[i];
          const tv =
            row.target_views === ""
              ? NaN
              : parseInt(String(row.target_views), 10);
          const payoutD =
            row.payout_dollars === ""
              ? NaN
              : parseFloat(String(row.payout_dollars));
          const payoutCents = Math.round((payoutD || 0) * 100);
          const wlRaw = row.winner_limit;
          const winnerLimit =
            wlRaw === "" ? null : parseInt(String(wlRaw), 10);

          if (isNaN(tv) || tv <= 0) {
            return {
              isValid: false,
              error: `Milestone ${i + 1}: enter a valid target view count (greater than 0).`,
            };
          }
          if (isNaN(payoutD) || payoutCents < MIN_MILESTONE_PAYOUT_CENTS) {
            return {
              isValid: false,
              error: `Milestone ${i + 1}: payout must be at least ${formatCurrencyFromCents(
                MIN_MILESTONE_PAYOUT_CENTS,
              )} per tier.`,
            };
          }
          if (
            winnerLimit !== null &&
            (isNaN(winnerLimit) || winnerLimit < 1)
          ) {
            return {
              isValid: false,
              error: `Milestone ${i + 1}: winner limit must be at least 1, or leave blank for unlimited winners.`,
            };
          }
          parsed.push({
            target_views: tv,
            payout_cents: payoutCents,
            winner_limit:
              winnerLimit !== null && !isNaN(winnerLimit) ? winnerLimit : null,
          });
        }

        for (let j = 1; j < parsed.length; j++) {
          if (parsed[j].target_views <= parsed[j - 1].target_views) {
            return {
              isValid: false,
              error:
                "Milestone view targets must be strictly increasing (each tier higher than the previous).",
            };
          }
          if (parsed[j].payout_cents <= parsed[j - 1].payout_cents) {
            return {
              isValid: false,
              error:
                "Milestone payouts must be strictly increasing (each tier higher than the previous).",
            };
          }
        }

        if (milestoneBonusEnabled) {
          const vMinViewsFilled = milestoneBonusTopViewsMin !== "";
          const vMinReelsFilled = milestoneBonusTopViewsMinReels !== "";
          const vPayFilled = milestoneBonusTopViewsPayout !== "";
          const rMinViewsFilled = milestoneBonusTopReelsMinViews !== "";
          const rMinFilled = milestoneBonusTopReelsMin !== "";
          const rPayFilled = milestoneBonusTopReelsPayout !== "";

          const viewsTrackHasAnyField =
            vMinViewsFilled || vMinReelsFilled || vPayFilled;
          const reelsTrackHasAnyField =
            rMinViewsFilled || rMinFilled || rPayFilled;
          const viewsRequiredFilled = vMinViewsFilled && vPayFilled;
          const reelsRequiredFilled = rMinFilled && rPayFilled;

          if (viewsTrackHasAnyField && !viewsRequiredFilled) {
            return {
              isValid: false,
              error:
                "Bonus (most verified views): enter minimum total views and payout, or clear the category. Minimum verified reels is optional.",
            };
          }
          if (reelsTrackHasAnyField && !reelsRequiredFilled) {
            return {
              isValid: false,
              error:
                "Bonus (most verified reels): enter minimum verified reels and payout, or clear the category. Minimum total verified views is optional.",
            };
          }

          const viewsOk =
            vMinViewsFilled &&
            vPayFilled &&
            Number(milestoneBonusTopViewsMin) > 0 &&
            (!vMinReelsFilled || Number(milestoneBonusTopViewsMinReels) >= 1) &&
            Math.round(
              parseFloat(String(milestoneBonusTopViewsPayout)) * 100,
            ) >= MIN_MILESTONE_PAYOUT_CENTS;
          const reelsOk =
            rMinFilled &&
            rPayFilled &&
            Number(milestoneBonusTopReelsMin) >= 1 &&
            (!rMinViewsFilled || Number(milestoneBonusTopReelsMinViews) > 0) &&
            Math.round(
              parseFloat(String(milestoneBonusTopReelsPayout)) * 100,
            ) >= MIN_MILESTONE_PAYOUT_CENTS;

          if (!viewsOk && !reelsOk) {
            return {
              isValid: false,
              error:
                "With milestone bonus enabled, configure at least one bonus category (verified views or verified reels) with threshold and payout.",
            };
          }
        }
      } else if (contestType === "cpm") {
        // CPM validation
        if (!cpmRate || parseFloat(cpmRate.toString()) <= 0) {
          return {
            isValid: false,
            error: "CPM Rate must be a positive number.",
          };
        }

        const cpmRateValue = parseFloat(cpmRate.toString());
        if (cpmRateValue < MIN_CPM_RATE) {
          return {
            isValid: false,
            error:
              platform === "twitter" && contestFormat === "text_image"
                ? `CPM Rate must be at least $${MIN_CPM_RATE} per 1000 points.`
                : `CPM Rate must be at least $${MIN_CPM_RATE} per 1000 views.`,
          };
        }

        if (cpmRateValue > MAX_CPM_RATE) {
          return {
            isValid: false,
            error:
              platform === "twitter" && contestFormat === "text_image"
                ? `CPM Rate cannot exceed $${MAX_CPM_RATE} per 1000 points.`
                : `CPM Rate cannot exceed $${MAX_CPM_RATE} per 1000 views.`,
          };
        }

        if (!totalBudget || parseFloat(totalBudget.toString()) <= 0) {
          return {
            isValid: false,
            error: "Total Budget must be a positive number for CPM contests.",
          };
        }

        if (!termsConditions) {
          return {
            isValid: false,
            error: "Terms & Conditions are required for CPM contests.",
          };
        }

        // Twitter CPM (Points Model): require at least one metric weight > 0
        if (platform === "twitter" && contestFormat === "text_image") {
          const commentsWeight =
            parseFloat(cpmPointsConfig.comment_base_points.toString()) || 0;
          const retweetsWeight =
            parseFloat(cpmPointsConfig.retweet_base_points.toString()) || 0;
          const quoteRepostsWeight =
            parseFloat(cpmPointsConfig.quote_repost_base_points.toString()) ||
            0;

          // For raid campaigns, only check comments/replies, retweets, and quote reposts
          // (likes and impressions are not base points for raid campaigns)
          if (contentType === "raid") {
            if (
              commentsWeight <= 0 &&
              retweetsWeight <= 0 &&
              quoteRepostsWeight <= 0
            ) {
              return {
                isValid: false,
                error:
                  "For Twitter CPM raid contests, please enable at least one metric (comments/replies, retweets, or quote reposts) to count towards points and payout.",
              };
            }
          } else {
            // For non-raid campaigns, check all metrics including likes and impressions
            // Normalize Twitter points inputs (blank => 0) so unused metrics can be skipped
            const likesWeightStr = twitterPointsConfig.likesWeight
              .toString()
              .trim();
            const impressionsWeightStr = twitterPointsConfig.impressionsWeight
              .toString()
              .trim();

            // When engagement multiplier sections are enabled, all multiplier fields must be filled (0 allowed)
            if (showCommentMultipliers) {
              const requiredCommentFields = [
                cpmPointsConfig.comment_likes_multiplier,
                cpmPointsConfig.comment_replies_multiplier,
                cpmPointsConfig.comment_impressions_multiplier,
                cpmPointsConfig.comment_retweets_multiplier,
                cpmPointsConfig.comment_quote_reposts_multiplier,
              ];

              const hasEmptyCommentMultiplier = requiredCommentFields.some(
                (v) => v?.toString().trim() === "",
              );

              if (hasEmptyCommentMultiplier) {
                return {
                  isValid: false,
                  error:
                    "Comment Engagement Multipliers cannot be empty. Please enter a value for each field (use 0 if you don't want a metric to add points).",
                };
              }
            }

            if (showRetweetMultipliers) {
              const requiredRetweetFields = [
                cpmPointsConfig.retweet_likes_multiplier,
                cpmPointsConfig.retweet_replies_multiplier,
                cpmPointsConfig.retweet_impressions_multiplier,
                cpmPointsConfig.retweet_retweets_multiplier,
                cpmPointsConfig.retweet_quote_reposts_multiplier,
              ];

              const hasEmptyRetweetMultiplier = requiredRetweetFields.some(
                (v) => v?.toString().trim() === "",
              );

              if (hasEmptyRetweetMultiplier) {
                return {
                  isValid: false,
                  error:
                    "Retweet Engagement Multipliers cannot be empty. Please enter a value for each field (use 0 if you don't want a metric to add points).",
                };
              }
            }

            if (showQuoteRepostMultipliers) {
              const requiredQuoteFields = [
                cpmPointsConfig.quote_repost_likes_multiplier,
                cpmPointsConfig.quote_repost_replies_multiplier,
                cpmPointsConfig.quote_repost_impressions_multiplier,
                cpmPointsConfig.quote_repost_retweets_multiplier,
                cpmPointsConfig.quote_repost_quote_reposts_multiplier,
              ];

              const hasEmptyQuoteMultiplier = requiredQuoteFields.some(
                (v) => v?.toString().trim() === "",
              );

              if (hasEmptyQuoteMultiplier) {
                return {
                  isValid: false,
                  error:
                    "Quote Repost Engagement Multipliers cannot be empty. Please enter a value for each field (use 0 if you don't want a metric to add points).",
                };
              }
            }

            const likesWeight = parseFloat(likesWeightStr) || 0;
            const impressionsWeight = parseFloat(impressionsWeightStr) || 0;

            if (
              likesWeight <= 0 &&
              commentsWeight <= 0 &&
              retweetsWeight <= 0 &&
              quoteRepostsWeight <= 0 &&
              impressionsWeight <= 0
            ) {
              return {
                isValid: false,
                error:
                  "For Twitter CPM contests, please enable at least one metric (likes, comments/replies, retweets, quote reposts, or views) to count towards points and payout.",
              };
            }
          }
        }

        // Validate minimum views vs maximum views
        const minViewsValue =
          minViews && minViews.toString().trim() !== ""
            ? parseInt(minViews.toString(), 10)
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
          return {
            isValid: false,
            error: "Minimum views must be less than maximum views.",
          };
        }

        const budgetInCents = (parseFloat(totalBudget.toString()) || 0) * 100;
        if (budgetInCents < planFeatures.minContestBudget) {
          return {
            isValid: false,
            error: `The minimum contest budget for your plan is ${formatCurrencyFromCents(
              planFeatures.minContestBudget,
            )}. Please increase your total budget.`,
          };
        }

        // Validate: Total Budget is mandatory for CPM contests
        if (!totalBudget || parseFloat(totalBudget.toString()) <= 0) {
          return {
            isValid: false,
            error: "Total Budget is mandatory for CPM contests.",
          };
        }

        // Validate: Flat fee bonus selected but total budget missing
        const flatFeeBonusValue =
          flatFeeBonus && parseFloat(flatFeeBonus.toString()) > 0;
        if (flatFeeBonusValue) {
          if (!totalBudget || parseFloat(totalBudget.toString()) <= 0) {
            return {
              isValid: false,
              error: "Total Budget is required when Flat Fee Bonus is enabled.",
            };
          }

          // Validate: Flat Fee Bonus Cap is required when flat fee bonus is enabled (CPM)
          if (!flatFeeBonusCap || parseFloat(flatFeeBonusCap.toString()) <= 0) {
            return {
              isValid: false,
              error:
                "Flat Fee Bonus Cap is required when Flat Fee Bonus is enabled for CPM contests.",
            };
          }
        }

        // Validate: Flat Fee Bonus Cap must be greater than or equal to Flat Fee Bonus (CPM)
        const flatFeeBonusCapValue =
          flatFeeBonusCap && parseFloat(flatFeeBonusCap.toString()) > 0;
        if (flatFeeBonusValue && flatFeeBonusCapValue) {
          const bonusDollars = parseFloat(flatFeeBonus.toString());
          const capDollars = parseFloat(flatFeeBonusCap.toString());
          if (capDollars < bonusDollars) {
            return {
              isValid: false,
              error:
                "Flat Fee Bonus Cap must be greater than or equal to the Flat Fee Bonus amount.",
            };
          }
        }

        // Validate: Flat Fee Bonus Cap must not exceed Total Budget (CPM)
        if (flatFeeBonusCapValue && totalBudget) {
          const capInDollars = parseFloat(flatFeeBonusCap.toString());
          const budgetInDollars = parseFloat(totalBudget.toString());
          if (capInDollars > budgetInDollars) {
            return {
              isValid: false,
              error: "Flat Fee Bonus Cap cannot exceed Total Budget.",
            };
          }
        }

        // Validate: Prevent contest creation if total money a single creator can earn > total budget
        if (totalBudget) {
          const totalBudgetDollars = parseFloat(totalBudget.toString());
          const totalBudgetCents = totalBudgetDollars * 100;
          let maxCreatorEarnings = 0;

          // Add max earnings per creator if set
          if (
            maxEarningsPerCreator &&
            parseFloat(maxEarningsPerCreator.toString()) > 0
          ) {
            maxCreatorEarnings +=
              parseFloat(maxEarningsPerCreator.toString()) * 100;
          }

          // Add flat fee bonus cap if set (for CPM)
          if (flatFeeBonusCapValue) {
            maxCreatorEarnings += parseFloat(flatFeeBonusCap.toString()) * 100;
          } else if (flatFeeBonusValue) {
            // If no cap but flat fee bonus exists, calculate potential max
            // (flat fee bonus * max submissions per creator)
            const maxSubmissions = multipleSubmissionsEnabled
              ? maxSubmissionsPerCreator
              : 1;
            const flatFeeBonusCents = parseFloat(flatFeeBonus.toString()) * 100;
            maxCreatorEarnings += flatFeeBonusCents * maxSubmissions;
          }

          if (maxCreatorEarnings > totalBudgetCents) {
            return {
              isValid: false,
              error:
                "The maximum amount a single creator can earn exceeds the total budget. Please adjust the budget or reduce creator earnings limits.",
            };
          }
        }
      }

      // 6. Plan and subscription validation
      if (contestType === "cpm" || contestType === "milestone") {
        const hasCpmAccess =
          planFeatures.contestTypes &&
          planFeatures.contestTypes.includes("cpm");
        if (!hasCpmAccess) {
          return {
            isValid: false,
            error:
              "CPM and Milestone contests are only available with paid plans. Please upgrade your subscription or change to a Leaderboard contest.",
          };
        }
      }

      // 7. Active contest limit validation
      try {
        const response = await fetch("/api/contests/validate-limit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            maxActiveContests: planFeatures.maxActiveContests,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to validate contest limit");
        }

        const activeCheck = await response.json();

        if (!activeCheck.canCreate) {
          return {
            isValid: false,
            error:
              activeCheck.error ||
              `You have reached your plan's limit of ${planFeatures.maxActiveContests} active contests. Please upgrade your plan or wait for existing contests to end.`,
          };
        }
      } catch (error: any) {
        console.error("Error checking active contest limit:", error);
        return {
          isValid: false,
          error: "Unable to validate contest limits. Please try again.",
        };
      }

      return { isValid: true };
    } catch (error: any) {
      console.error("Error in validateContestForPayment:", error);
      return {
        isValid: false,
        error:
          "An unexpected error occurred during validation. Please try again.",
      };
    }
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    console.log("=== handleSubmit called ===");
    console.log("isDraft:", isDraft);
    console.log("contestId:", contestId);
    console.log("draftId:", draftId);
    console.log("title:", title);

    // Reset global form feedback
    setIsLoading(true);
    setFormFeedback(null);
    setFormFeedbackType(null);

    let prepTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

    try {
      // Basic validation for drafts - only require title
      if (isDraft && !title.trim()) {
        setFormFeedback("Title is required to save draft");
        setFormFeedbackType("error");
        setIsLoading(false);
        setUploadProgress(null);
        return;
      }

      const userId = user?.id;
      if (!isDraft && !userId) {
        setFormFeedback(
          "User information not available. Please refresh the page and try again.",
        ); // Footer feedback
        setFormFeedbackType("error");
        setIsLoading(false);
        setUploadProgress(null);
        return;
      }

      // CRITICAL: For non-draft submissions, run comprehensive validation BEFORE any processing
      if (!isDraft) {
        const planFeatures = getPlanFeatures(userPlan);
        const validationResult = await validateContestForPayment(
          userId!,
          planFeatures,
        );

        if (!validationResult.isValid) {
          setFormFeedback(validationResult.error!);
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }
      }

      let contestBasedDetails: any = {};

      if (contestType === "leaderboard") {
        // Client-side validation for prize amounts for leaderboard
        for (let i = 0; i < winnerCount; i++) {
          if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
            setFormFeedback(
              `Prize for Winner ${
                i + 1
              } must be at least ${formatCurrencyFromCents(
                MIN_PRIZE_PER_WINNER,
              )}`,
            ); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
        }
        const prizesArray = Array.from({ length: winnerCount }, (_, i) => ({
          position: i + 1,
          amount: winnerAmounts[i] || 0, // Stored in cents
        }));
        const flatFeeBonusCents =
          flatFeeBonus && parseFloat(flatFeeBonus.toString()) > 0
            ? Math.round(parseFloat(flatFeeBonus.toString()) * 100)
            : undefined;

        // Validate total budget when flat fee bonus is enabled
        if (
          flatFeeBonusCents &&
          (!totalBudget || parseFloat(totalBudget.toString()) <= 0)
        ) {
          setFormFeedback(
            "Total Budget is required when Flat Fee Bonus is enabled. Please enter a budget amount.",
          );
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }

        const totalBudgetCents =
          totalBudget && parseFloat(totalBudget.toString()) > 0
            ? Math.round(parseFloat(totalBudget.toString()) * 100)
            : undefined;

        contestBasedDetails = {
          leaderboard_contest: {
            prizes: prizesArray,
            total_prize: totalPrizePool, // Already in cents
            winner_count: winnerCount,
            ...(flatFeeBonusCents && { flat_fee_bonus: flatFeeBonusCents }), // Only include if set
            ...(totalBudgetCents && { total_budget: totalBudgetCents }), // Only include if set
          },
        };
      } else if (contestType === "milestone") {
        const effectiveMilestoneRows = milestoneRows.filter(
          (r) =>
            r.target_views !== "" ||
            r.payout_dollars !== "" ||
            r.winner_limit !== "",
        );

        const milestonesPayload: Array<{
          order: number;
          target_views: number;
          payout_cents: number;
          winner_limit: number | null;
        }> = [];

        for (let i = 0; i < effectiveMilestoneRows.length; i++) {
          const row = effectiveMilestoneRows[i];
          const tv =
            row.target_views === ""
              ? NaN
              : parseInt(String(row.target_views), 10);
          const payoutD =
            row.payout_dollars === ""
              ? NaN
              : parseFloat(String(row.payout_dollars));
          const payoutCents = Math.round((payoutD || 0) * 100);
          const wlRaw = row.winner_limit;
          const winnerLimit =
            wlRaw === "" ? null : parseInt(String(wlRaw), 10);

          if (isDraft) {
            if (isNaN(tv) || tv <= 0) continue;
            milestonesPayload.push({
              order: milestonesPayload.length + 1,
              target_views: tv,
              payout_cents: isNaN(payoutCents) ? 0 : payoutCents,
              winner_limit:
                winnerLimit !== null && !isNaN(winnerLimit)
                  ? winnerLimit
                  : null,
            });
            continue;
          }

          if (isNaN(tv) || tv <= 0) {
            setFormFeedback(
              `Milestone ${i + 1}: enter target views (whole number > 0).`,
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
          if (isNaN(payoutD) || payoutCents < MIN_MILESTONE_PAYOUT_CENTS) {
            setFormFeedback(
              `Milestone ${i + 1}: payout must be at least ${formatCurrencyFromCents(
                MIN_MILESTONE_PAYOUT_CENTS,
              )}.`,
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
          if (
            winnerLimit !== null &&
            (isNaN(winnerLimit) || winnerLimit < 1)
          ) {
            setFormFeedback(
              `Milestone ${i + 1}: winner limit must be ≥ 1 or leave blank for unlimited.`,
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
          milestonesPayload.push({
            order: milestonesPayload.length + 1,
            target_views: tv,
            payout_cents: payoutCents,
            winner_limit:
              winnerLimit !== null && !isNaN(winnerLimit)
                ? winnerLimit
                : null,
          });
        }

        if (!isDraft) {
          if (contestFormat !== "video") {
            setFormFeedback(
              "Milestone contests require the Video contest format.",
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
          if (milestonesPayload.length === 0) {
            setFormFeedback(
              "Add at least one milestone with target views and payout.",
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
          for (let j = 1; j < milestonesPayload.length; j++) {
            if (
              milestonesPayload[j].target_views <=
              milestonesPayload[j - 1].target_views
            ) {
              setFormFeedback(
                "Milestone view targets must increase at each step (e.g. 1,000 then 5,000 views).",
              );
              setFormFeedbackType("error");
              setIsLoading(false);
              setUploadProgress(null);
              return;
            }
            if (
              milestonesPayload[j].payout_cents <=
              milestonesPayload[j - 1].payout_cents
            ) {
              const payoutSequenceError =
                "Milestone payouts must increase at each step (each tier payout should be higher than the previous tier).";
              setFormFeedback(payoutSequenceError);
              setFormFeedbackType("error");
              toast({
                title: "Invalid Milestone Sequence",
                description: payoutSequenceError,
                variant: "destructive",
              });
              setIsLoading(false);
              setUploadProgress(null);
              return;
            }
          }
          if (!totalBudget || parseFloat(totalBudget.toString()) <= 0) {
            setFormFeedback(
              "Total contest budget is required for milestone contests.",
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
          if (milestoneBonusEnabled) {
            const vMinViewsFilled = milestoneBonusTopViewsMin !== "";
            const vMinReelsFilled = milestoneBonusTopViewsMinReels !== "";
            const vPayFilled = milestoneBonusTopViewsPayout !== "";
            const rMinViewsFilled = milestoneBonusTopReelsMinViews !== "";
            const rMinFilled = milestoneBonusTopReelsMin !== "";
            const rPayFilled = milestoneBonusTopReelsPayout !== "";
            const viewsTrackHasAnyField =
              vMinViewsFilled || vMinReelsFilled || vPayFilled;
            const reelsTrackHasAnyField =
              rMinViewsFilled || rMinFilled || rPayFilled;
            const viewsRequiredFilled = vMinViewsFilled && vPayFilled;
            const reelsRequiredFilled = rMinFilled && rPayFilled;
            if (viewsTrackHasAnyField && !viewsRequiredFilled) {
              setFormFeedback(
                "Bonus (most verified views): enter minimum total views and payout, or clear the category. Minimum verified reels is optional.",
              );
              setFormFeedbackType("error");
              setIsLoading(false);
              setUploadProgress(null);
              return;
            }
            if (reelsTrackHasAnyField && !reelsRequiredFilled) {
              setFormFeedback(
                "Bonus (most verified reels): enter minimum verified reels and payout, or clear the category. Minimum total verified views is optional.",
              );
              setFormFeedbackType("error");
              setIsLoading(false);
              setUploadProgress(null);
              return;
            }
            const viewsOk =
              vMinViewsFilled &&
              vPayFilled &&
              Number(milestoneBonusTopViewsMin) > 0 &&
              (!vMinReelsFilled ||
                Number(milestoneBonusTopViewsMinReels) >= 1) &&
              Math.round(
                parseFloat(String(milestoneBonusTopViewsPayout)) * 100,
              ) >= MIN_MILESTONE_PAYOUT_CENTS;
            const reelsOk =
              rMinFilled &&
              rPayFilled &&
              Number(milestoneBonusTopReelsMin) >= 1 &&
              (!rMinViewsFilled || Number(milestoneBonusTopReelsMinViews) > 0) &&
              Math.round(
                parseFloat(String(milestoneBonusTopReelsPayout)) * 100,
              ) >= MIN_MILESTONE_PAYOUT_CENTS;
            if (!viewsOk && !reelsOk) {
              setFormFeedback(
                "With bonus enabled, add at least one bonus category (verified views or verified reels).",
              );
              setFormFeedbackType("error");
              setIsLoading(false);
              setUploadProgress(null);
              return;
            }
          }
        }

        let bonusPayload: Record<string, unknown> | undefined;
        if (milestoneBonusEnabled) {
          bonusPayload = { enabled: true };
          if (
            milestoneBonusTopViewsMin !== "" &&
            milestoneBonusTopViewsPayout !== ""
          ) {
            const mostVerifiedViewsPayload: Record<string, unknown> = {
              min_total_views: Number(milestoneBonusTopViewsMin),
              payout_cents: Math.round(
                parseFloat(String(milestoneBonusTopViewsPayout)) * 100,
              ),
            };
            if (milestoneBonusTopViewsMinReels !== "") {
              mostVerifiedViewsPayload.min_verified_reels = Number(
                milestoneBonusTopViewsMinReels,
              );
            }
            (bonusPayload as Record<string, unknown>).most_verified_views =
              mostVerifiedViewsPayload;
          }
          if (
            milestoneBonusTopReelsMin !== "" &&
            milestoneBonusTopReelsPayout !== ""
          ) {
            const mostVerifiedReelsPayload: Record<string, unknown> = {
              min_verified_reels: Number(milestoneBonusTopReelsMin),
              payout_cents: Math.round(
                parseFloat(String(milestoneBonusTopReelsPayout)) * 100,
              ),
            };
            if (milestoneBonusTopReelsMinViews !== "") {
              mostVerifiedReelsPayload.min_total_views = Number(
                milestoneBonusTopReelsMinViews,
              );
            }
            (bonusPayload as Record<string, unknown>).most_verified_reels =
              mostVerifiedReelsPayload;
          }
        }

        const totalBudgetCentsMilestone = Math.round(
          (parseFloat(totalBudget.toString()) || 0) * 100,
        );

        contestBasedDetails = {
          milestone_contest: {
            milestones: milestonesPayload.map((m, idx) => ({
              ...m,
              order: idx + 1,
            })),
            total_budget_cents: totalBudgetCentsMilestone,
            ...(bonusPayload ? { bonus: bonusPayload } : {}),
          },
        };
      } else if (contestType === "cpm") {
        if (!isDraft) {
          if (!cpmRate || parseFloat(cpmRate.toString()) <= 0) {
            setFormFeedback("CPM Rate must be a positive number."); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          const cpmRateValue = parseFloat(cpmRate.toString());
          if (cpmRateValue < MIN_CPM_RATE) {
            setFormFeedback(
              `CPM Rate must be at least $${MIN_CPM_RATE} per 1000 views.`,
            ); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          if (cpmRateValue > MAX_CPM_RATE) {
            setFormFeedback(
              `CPM Rate cannot exceed $${MAX_CPM_RATE} per 1000 views.`,
            ); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          if (!totalBudget || parseFloat(totalBudget.toString()) <= 0) {
            setFormFeedback(
              "Total Budget must be a positive number for CPM contests.",
            ); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
          if (!termsConditions) {
            setFormFeedback(
              "Terms & Conditions are required for CPM contests.",
            ); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          // Validate minimum views vs maximum views
          const minViewsValue =
            minViews && minViews.toString().trim() !== ""
              ? parseInt(minViews.toString(), 10)
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
            setFormFeedback("Minimum views must be less than maximum views."); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
        }
        const flatFeeBonusCents =
          flatFeeBonus && parseFloat(flatFeeBonus.toString()) > 0
            ? Math.round(parseFloat(flatFeeBonus.toString()) * 100)
            : undefined;

        const flatFeeBonusCapCents =
          flatFeeBonusCap && parseFloat(flatFeeBonusCap.toString()) > 0
            ? Math.round(parseFloat(flatFeeBonusCap.toString()) * 100)
            : undefined;

        // Check if this is a Twitter CPM contest - exclude min_views and max_views for Twitter
        const isTwitterCpmContest =
          platform === "twitter" &&
          contestFormat === "text_image" &&
          contestType === "cpm";

        const cpmContestDetails: any = {
          cpm_rate_usd: parseFloat(cpmRate.toString()) || 0,
          total_budget: (parseFloat(totalBudget.toString()) || 0) * 100, // Convert to cents
          budget_spent: 0, // Initial value
          terms_conditions: termsConditions,
          ...(flatFeeBonusCents && { flat_fee_bonus: flatFeeBonusCents }), // Only include if set
          ...(flatFeeBonusCapCents && {
            flat_fee_bonus_cap: flatFeeBonusCapCents,
          }), // Only include if set
          // Note: CPM Points Configuration multipliers are saved in twitter_campaign.points_config
          // tiered_payouts: [] // Future use
        };

        // Only include min_views and max_views for non-Twitter CPM contests
        if (!isTwitterCpmContest) {
          cpmContestDetails.min_views =
            minViews && minViews.toString().trim() !== ""
              ? parseInt(minViews.toString(), 10)
              : null;
          cpmContestDetails.max_views =
            maxViews && maxViews.toString().trim() !== ""
              ? parseInt(maxViews.toString(), 10)
              : null;
        }

        contestBasedDetails = {
          cpm_contest: cpmContestDetails,
        };
      }

      // Build Twitter campaign config and merge with contestBasedDetails
      // This ensures Twitter data is preserved when saving the final contest
      if (platform === "twitter" && contestFormat === "text_image") {
        const filteredKeywords = keywords.filter((k) => k.trim() !== "");
        const filteredMentions = mentions.filter((m) => m.trim() !== "");

        const twitterCampaign: any = {
          campaign_type: contentType === "raid" ? "raid" : "awareness",
          allowed_tweet_types: ["tweet", "quote", "retweet", "reply"],
        };

        if (filteredKeywords.length > 0) {
          twitterCampaign.keywords = filteredKeywords;
        }
        if (filteredMentions.length > 0) {
          twitterCampaign.mentions = filteredMentions;
        }
        if (
          maxParticipants &&
          typeof maxParticipants === "number" &&
          maxParticipants > 0
        ) {
          twitterCampaign.max_participants = maxParticipants;
        }

        if (contestType === "cpm") {
          // CPM-based Twitter contests (Points Model): configure metric weights
          // Stored in contest_based_details.twitter_campaign.points_config
          const commentsWeight =
            parseFloat(cpmPointsConfig.comment_base_points.toString()) || 0;
          const retweetsWeight =
            parseFloat(cpmPointsConfig.retweet_base_points.toString()) || 0;
          const quoteRepostsWeight =
            parseFloat(cpmPointsConfig.quote_repost_base_points.toString()) ||
            0;

          // Build points_config with nested multipliers inside comments_weight, retweets_weight, quote_reposts_weight
          // For raid campaigns, don't save likes_weight and impressions_weight
          const pointsConfig: any = {};
          if (contentType !== "raid") {
            // Normalize Twitter points inputs (blank => 0) so users can skip metrics they don't need
            const likesWeightStr = twitterPointsConfig.likesWeight
              .toString()
              .trim();
            const impressionsWeightStr = twitterPointsConfig.impressionsWeight
              .toString()
              .trim();

            const likesWeight = parseFloat(likesWeightStr) || 0;
            const impressionsWeight = parseFloat(impressionsWeightStr) || 0;
            pointsConfig.likes_weight = likesWeight;
            pointsConfig.impressions_weight = impressionsWeight;
          }

          // Add comments_weight - always save multipliers (defaults or user values)
          // Checkbox only controls visibility, not whether multipliers are saved
          const commentMultipliers: any = {};
          if (showCommentMultipliers) {
            // Checkbox is checked - use user values if provided, otherwise use defaults
            const commentLikes = getMultiplierValue(
              cpmPointsConfig.comment_likes_multiplier,
            );
            const commentReplies = getMultiplierValue(
              cpmPointsConfig.comment_replies_multiplier,
            );
            const commentImpressions = getMultiplierValue(
              cpmPointsConfig.comment_impressions_multiplier,
            );
            const commentRetweets = getMultiplierValue(
              cpmPointsConfig.comment_retweets_multiplier,
            );
            const commentQuoteReposts = getMultiplierValue(
              cpmPointsConfig.comment_quote_reposts_multiplier,
            );

            commentMultipliers.likes_multiplier =
              commentLikes !== undefined ? commentLikes : 0.1;
            commentMultipliers.replies_multiplier =
              commentReplies !== undefined ? commentReplies : 1;
            commentMultipliers.impressions_multiplier =
              commentImpressions !== undefined ? commentImpressions : 0.001;
            commentMultipliers.retweets_multiplier =
              commentRetweets !== undefined ? commentRetweets : 0;
            commentMultipliers.quote_reposts_multiplier =
              commentQuoteReposts !== undefined ? commentQuoteReposts : 0;
          } else {
            // Checkbox is unchecked - always use default multipliers
            commentMultipliers.likes_multiplier = 0.1;
            commentMultipliers.replies_multiplier = 1;
            commentMultipliers.impressions_multiplier = 0.001;
            commentMultipliers.retweets_multiplier = 0;
            commentMultipliers.quote_reposts_multiplier = 0;
          }

          pointsConfig.comments_weight = {
            ...(commentsWeight > 0 && { base_weight: commentsWeight }),
            ...commentMultipliers,
            _showMultipliers: showCommentMultipliers, // Flag to track checkbox state
          };

          // Add retweets_weight - always save multipliers (defaults or user values)
          // Checkbox only controls visibility, not whether multipliers are saved
          const retweetMultipliers: any = {};
          if (showRetweetMultipliers) {
            // Checkbox is checked - use user values if provided, otherwise use defaults
            const retweetLikes = getMultiplierValue(
              cpmPointsConfig.retweet_likes_multiplier,
            );
            const retweetReplies = getMultiplierValue(
              cpmPointsConfig.retweet_replies_multiplier,
            );
            const retweetImpressions = getMultiplierValue(
              cpmPointsConfig.retweet_impressions_multiplier,
            );
            const retweetRetweets = getMultiplierValue(
              cpmPointsConfig.retweet_retweets_multiplier,
            );
            const retweetQuoteReposts = getMultiplierValue(
              cpmPointsConfig.retweet_quote_reposts_multiplier,
            );

            retweetMultipliers.likes_multiplier =
              retweetLikes !== undefined ? retweetLikes : 0.05;
            retweetMultipliers.replies_multiplier =
              retweetReplies !== undefined ? retweetReplies : 0.05;
            retweetMultipliers.impressions_multiplier =
              retweetImpressions !== undefined ? retweetImpressions : 0.001;
            retweetMultipliers.retweets_multiplier =
              retweetRetweets !== undefined ? retweetRetweets : 0.05;
            retweetMultipliers.quote_reposts_multiplier =
              retweetQuoteReposts !== undefined ? retweetQuoteReposts : 0;
          } else {
            // Checkbox is unchecked - always use default multipliers
            retweetMultipliers.likes_multiplier = 0.05;
            retweetMultipliers.replies_multiplier = 0.05;
            retweetMultipliers.impressions_multiplier = 0.001;
            retweetMultipliers.retweets_multiplier = 0.05;
            retweetMultipliers.quote_reposts_multiplier = 0;
          }

          pointsConfig.retweets_weight = {
            ...(retweetsWeight > 0 && { base_weight: retweetsWeight }),
            ...retweetMultipliers,
            _showMultipliers: showRetweetMultipliers, // Flag to track checkbox state
          };

          // Add quote_reposts_weight - always save multipliers (defaults or user values)
          // Checkbox only controls visibility, not whether multipliers are saved
          const quoteRepostMultipliers: any = {};
          if (showQuoteRepostMultipliers) {
            // Checkbox is checked - use user values if provided, otherwise use defaults
            const quoteRepostLikes = getMultiplierValue(
              cpmPointsConfig.quote_repost_likes_multiplier,
            );
            const quoteRepostReplies = getMultiplierValue(
              cpmPointsConfig.quote_repost_replies_multiplier,
            );
            const quoteRepostImpressions = getMultiplierValue(
              cpmPointsConfig.quote_repost_impressions_multiplier,
            );
            const quoteRepostRetweets = getMultiplierValue(
              cpmPointsConfig.quote_repost_retweets_multiplier,
            );
            const quoteRepostQuoteReposts = getMultiplierValue(
              cpmPointsConfig.quote_repost_quote_reposts_multiplier,
            );

            quoteRepostMultipliers.likes_multiplier =
              quoteRepostLikes !== undefined ? quoteRepostLikes : 0.1;
            quoteRepostMultipliers.replies_multiplier =
              quoteRepostReplies !== undefined ? quoteRepostReplies : 0.1;
            quoteRepostMultipliers.impressions_multiplier =
              quoteRepostImpressions !== undefined
                ? quoteRepostImpressions
                : 0.001;
            quoteRepostMultipliers.retweets_multiplier =
              quoteRepostRetweets !== undefined ? quoteRepostRetweets : 0.1;
            quoteRepostMultipliers.quote_reposts_multiplier =
              quoteRepostQuoteReposts !== undefined
                ? quoteRepostQuoteReposts
                : 0.1;
          } else {
            // Checkbox is unchecked - always use default multipliers
            quoteRepostMultipliers.likes_multiplier = 0.1;
            quoteRepostMultipliers.replies_multiplier = 0.1;
            quoteRepostMultipliers.impressions_multiplier = 0.001;
            quoteRepostMultipliers.retweets_multiplier = 0.1;
            quoteRepostMultipliers.quote_reposts_multiplier = 0.1;
          }

          pointsConfig.quote_reposts_weight = {
            ...(quoteRepostsWeight > 0 && {
              base_weight: quoteRepostsWeight,
            }),
            ...quoteRepostMultipliers,
            _showMultipliers: showQuoteRepostMultipliers, // Flag to track checkbox state
          };

          twitterCampaign.points_config = pointsConfig;
        }

        if (contentType !== "raid") {
          if (keywordsRequirementMode) {
            twitterCampaign.keywords_requirement_mode = keywordsRequirementMode;
          }
          if (mentionsRequirementMode) {
            twitterCampaign.mentions_requirement_mode = mentionsRequirementMode;
          }
        }

        if (
          (contentType === "raid" || contentType === "awareness") &&
          inspirationLinks.length > 0
        ) {
          twitterCampaign.raid_target = {
            link: inspirationLinks[0]?.url || null,
            description: inspirationLinks[0]?.description || null,
            metrics: {
              likes: targetLikes === "" ? null : targetLikes,
              comments: targetReplies === "" ? null : targetReplies,
              retweets: targetRetweets === "" ? null : targetRetweets,
              quote_reposts:
                targetQuoteReposts === "" ? null : targetQuoteReposts,
            },
            keywords_requirement_mode:
              contentType === "raid" ? "" : keywordsRequirementMode,
            mentions_requirement_mode:
              contentType === "raid" ? "" : mentionsRequirementMode,
          };
        }

        // Merge Twitter campaign with existing contestBasedDetails
        contestBasedDetails = {
          ...contestBasedDetails,
          twitter_campaign: twitterCampaign,
        };
      }

      // Only run old validation logic if we're submitting for approval (after the new comprehensive validation passed)
      if (!isDraft) {
        setUploadProgress("Preparing contest...");
        prepTimeoutId = setTimeout(() => {
          if (isLoading && uploadProgress === "Preparing contest...") {
            console.log("Contest creation taking longer than expected...");
            setUploadProgress("Validating contest details...");
          }
        }, 5000);

        // These validations are now redundant as they're covered in validateContestForPayment,
        // but keeping them for backwards compatibility during transition
        const planFeatures = getPlanFeatures(userPlan);

        // Validate contest type access
        if (contestType === "cpm" || contestType === "milestone") {
          const hasCpmAccess =
            planFeatures.contestTypes &&
            planFeatures.contestTypes.includes("cpm");
          if (!hasCpmAccess) {
            setFormFeedback(
              "CPM and Milestone contests are only available with paid plans. Please upgrade your subscription or change to a Leaderboard contest.",
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
        }

        // Validate budget requirements
        if (contestType === "leaderboard") {
          if (totalPrizePool < planFeatures.minContestBudget) {
            setFormFeedback(
              `The minimum prize pool for your plan is ${formatCurrencyFromCents(
                planFeatures.minContestBudget,
              )}. Please increase your prize amounts.`,
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          // Validate maximum winners
          if (winnerCount > planFeatures.maxWinnersPerContest) {
            setFormFeedback(
              `Your plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners. Please reduce the number of winners.`,
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
        } else if (contestType === "cpm" || contestType === "milestone") {
          const budgetInCents = (parseFloat(totalBudget.toString()) || 0) * 100;
          if (budgetInCents < planFeatures.minContestBudget) {
            setFormFeedback(
              `The minimum contest budget for your plan is ${formatCurrencyFromCents(
                planFeatures.minContestBudget,
              )}. Please increase your total budget.`,
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
        }

        if (!thumbnail && !thumbnailPreview) {
          setFormFeedback("Contest thumbnail is required for submission");
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }

        // Capture content before validation
        const currentBrief = captureBriefContent();
        const briefToValidate = currentBrief || briefHtml;

        if (!briefToValidate || isQuillEmpty(briefToValidate)) {
          setFormFeedback("Contest brief is required for submission");
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }

        // Capture bonus content if enabled
        if (bonusEnabled) {
          captureBonusContent();
        }

        // Capture rules content before validation
        const currentRulesHtml = captureRulesContent();
        const rulesToValidate = currentRulesHtml || rulesHtml;

        if (!rulesToValidate || isQuillEmpty(rulesToValidate)) {
          setFormFeedback("Contest rules are required for submission");
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }

        // Validate that at least one resource is provided
        const hasUploadedAssets = resources.some((r) => r.type === "internal");
        const hasExternalLinks = resources.some((r) => r.type === "external");

        if (!hasUploadedAssets && !hasExternalLinks) {
          setFormFeedback(
            "At least one resource is required for submission - upload an asset OR add an external resource link",
          );
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }

        if (!startDate || !startTime || !endDate || !endTime) {
          setFormFeedback(
            "Contest start and end dates/times are required for submission",
          );
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }

        try {
          const startDateTime = new Date(`${startDate}T${startTime}`);
          const endDateTime = new Date(`${endDate}T${endTime}`);
          const now = new Date();

          if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            setFormFeedback(
              "Invalid date or time format. Please check your entries.",
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          // // Check minimum days until start (1 day gap)
          // const daysUntilStart = Math.floor((startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          // if (daysUntilStart < MIN_DAYS_UNTIL_START) {
          //   console.log("daysUntilStart", daysUntilStart, MIN_DAYS_UNTIL_START)
          //   setFormFeedback(`Contest must start at least ${MIN_DAYS_UNTIL_START} days from today (${MIN_DAYS_UNTIL_START - 1} day gap required)`);
          //   setFormFeedbackType("error");
          //   setIsLoading(false); setUploadProgress(null); return;
          // }

          if (endDateTime <= startDateTime) {
            setFormFeedback("Contest end time must be after the start time");
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          // Check contest duration limits
          const durationMs = endDateTime.getTime() - startDateTime.getTime();
          const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

          if (durationDays < MIN_CONTEST_DURATION_DAYS) {
            setFormFeedback(
              `Contest duration must be at least ${MIN_CONTEST_DURATION_DAYS} days`,
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          if (durationDays > MAX_CONTEST_DURATION_DAYS) {
            setFormFeedback(
              `Contest duration cannot exceed ${MAX_CONTEST_DURATION_DAYS} days`,
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
        } catch (error) {
          console.error("Date validation error:", error);
          setFormFeedback(
            "There was an error with the date/time format. Please check your entries.",
          );
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }
      }

      let thumbnailUrl = thumbnailPreview || "";

      // Only upload a new thumbnail if a new file is staged and it's different from the preview, or if no preview exists yet.
      if (thumbnail) {
        // A new file has been selected by the user
        setUploadProgress(
          isDraft ? "Uploading thumbnail..." : "Uploading thumbnail (1/2)...",
        );
        try {
          const isStorageAvailable = await checkStorageAvailability();
          if (!isStorageAvailable) {
            if (!isDraft) {
              toast({
                title: "Storage Error",
                description:
                  "Unable to upload thumbnail due to storage configuration. Contest will be created without a thumbnail.",
                variant: "destructive",
              });
            } else {
              // For drafts, we might allow saving without re-uploading if storage is temporarily down, relying on existing URL if present
              console.warn(
                "Storage not available for draft thumbnail upload. If a previous URL exists, it will be used.",
              );
              if (!thumbnailPreview || thumbnailPreview.startsWith("data:")) {
                thumbnailUrl = ""; // No existing valid URL to reuse
              }
              // else, thumbnailUrl already holds thumbnailPreview from above, so it will be reused.
            }
          } else {
            // New upload logic
            const fileName = `contest_thumbnails/${userId}_${Date.now()}_${thumbnail.name.replace(
              /\s+/g,
              "_",
            )}`;
            const { data: uploadData, error: uploadError } =
              await supabase.storage
                .from("contest-assets")
                .upload(fileName, thumbnail);
            if (uploadError)
              throw new Error(
                `Failed to upload thumbnail: ${uploadError.message}`,
              );
            const { data: publicUrlData } = supabase.storage
              .from("contest-assets")
              .getPublicUrl(fileName);
            thumbnailUrl = publicUrlData?.publicUrl || "";
            if (isDraft) {
              setThumbnail(null); // Clear the File object
              setThumbnailPreview(thumbnailUrl); // Update preview to use the URL
            }
          }
        } catch (error: any) {
          toast({
            title: "Thumbnail Upload Error",
            description: `Thumbnail upload failed: ${error.message}`,
            variant: "destructive",
          });
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }
      } else if (!thumbnailPreview) {
        // If no new file AND no existing preview (e.g., user removed it)
        thumbnailUrl = "";
      }
      // If thumbnail is null BUT thumbnailPreview has a URL (from a previous save), thumbnailUrl is already set to thumbnailPreview correctly.

      // Thumbnail is already uploaded immediately when selected, just use the preview URL
      // Update thumbnailUrl to use the preview URL (thumbnails are uploaded immediately)

      // Resources are already uploaded when added, so no need for upload logic here
      // Just use the resources array as-is

      let formattedStartDate = null;
      let formattedEndDate = null;
      try {
        if (!isDraft) {
          if (startDate && startTime)
            formattedStartDate = toUTCISOString(startDate, startTime);
          if (endDate && endTime)
            formattedEndDate = toUTCISOString(endDate, endTime);
          if (
            (startDate && startTime && !formattedStartDate) ||
            (endDate && endTime && !formattedEndDate)
          )
            throw new Error("Invalid date/time format for submission");
        } else {
          if (startDate && startTime)
            formattedStartDate = toUTCISOString(startDate, startTime);
          if (endDate && endTime)
            formattedEndDate = toUTCISOString(endDate, endTime);
        }
      } catch (error) {
        console.error("Error formatting dates for submission:", error);
        if (!isDraft) {
          setFormFeedback(
            "There was a problem with the date format. Please check the start and end dates.",
          );
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }
      }

      setUploadProgress(
        isDraft
          ? "Finalizing draft..."
          : contestId
            ? "Updating contest..."
            : "Creating contest...",
      );

      // Helper function to process and group subcategories by category
      const processSubcategories = (
        subcategories: Array<{ category: string; subcategory: string }>,
      ) => {
        if (!subcategories || subcategories.length === 0) return null;

        // Group by category and remove duplicates
        const grouped: Record<string, string[]> = {};

        subcategories.forEach((item) => {
          if (!grouped[item.category]) {
            grouped[item.category] = [];
          }
          // Only add if not already in the array for this category
          if (!grouped[item.category].includes(item.subcategory)) {
            grouped[item.category].push(item.subcategory);
          }
        });

        // Return grouped object format: { "beauty": ["Skincare", "Makeup"], ... }
        return Object.keys(grouped).length > 0 ? grouped : null;
      };

      const contestData = {
        advertiser_id: userId,
        title,
        thumbnail_url: thumbnailUrl,
        platform: platform,
        contest_format: contestFormat,
        category: category || null,
        brief_html: briefHtml,
        brief_json: briefJson,
        rules_html: rulesHtml,
        // Only persist the original rulesJson content
        rules_json:
          rulesJson && typeof rulesJson === "object" ? { ...rulesJson } : {},
        // Twitter data is now stored in contest_based_details.twitter_campaign (JSONB)
        resources,
        // For Twitter raids, target tweet is stored in contest_based_details.twitter_campaign.raid_target,
        // so we avoid duplicating it in inspiration_links.
        inspiration_links: isRaidTwitter ? null : inspirationLinks,
        tracking_links: trackingLinks,
        // Categories, subcategories, and interests as direct columns
        categories: contestCategories.length > 0 ? contestCategories : null,
        subcategories: processSubcategories(contestSubcategories),
        interests:
          contestInterests.length > 0 ? [...new Set(contestInterests)] : null, // Remove duplicate interests
        // Regions and countries as JSONB
        region: buildRegionData(selectedRegions, selectedCountries),
        subscription_info_of_user: await (async () => {
          try {
            // Get user's subscription info using new system
            const { getUserSubscription } =
              await import("@/lib/subscription-utils-client");
            const subscription = await getUserSubscription(user?.id || "");

            if (subscription && subscription.subscription_info) {
              return subscription.subscription_info;
            } else {
              // Fallback: create subscription info from current plan
              const { subscriptionPlans } =
                await import("@/constants/subscriptionPlans");
              const plan =
                subscriptionPlans.find((p) => p.id === userPlan) ||
                subscriptionPlans[0];
              return {
                product_id: PRODUCT_IDS.EXPLORER, // EXPLORER
                price_id: PRICE_IDS.EXPLORER_MONTHLY, // EXPLORER monthly
                subscription_id: "no-subscription", // Will be updated when user subscribes
                last_synced: new Date().toISOString(),
              };
            }
          } catch (error) {
            console.error("Error getting subscription info:", error);
            // Fallback to EXPLORER plan
            return {
              product_id: PRODUCT_IDS.EXPLORER, // EXPLORER
              price_id: PRICE_IDS.EXPLORER_MONTHLY, // EXPLORER monthly
              subscription_id: "no-subscription",
              last_synced: new Date().toISOString(),
            };
          }
        })(),
        moderation_status: "draft", // Always create as draft first, payment will update to pending_approval
        submitted_for_approval_at: null,
        start_date: formattedStartDate,
        end_date: formattedEndDate,
        contest_type: contestType,
        contest_based_details: contestBasedDetails,
        // New features (2025-10-01)
        multiple_submissions_enabled: multipleSubmissionsEnabled,
        max_submissions_per_creator: multipleSubmissionsEnabled
          ? maxSubmissionsPerCreator
          : 1,
        content_type: contentType || null,
        bonus_details:
          bonusEnabled && bonusHtml
            ? {
                description_html: bonusHtml,
                description_json: bonusJson,
              }
            : null,
        max_earnings_per_creator:
          maxEarningsPerCreator &&
          parseFloat(maxEarningsPerCreator.toString()) > 0
            ? Math.round(parseFloat(maxEarningsPerCreator.toString()) * 100)
            : null,
        // Note: flat_fee_bonus is now stored in contest_based_details (in cents)
      };

      let responseData, responseError;
      console.log("=== Database operation decision ===");
      console.log("contestId:", contestId);
      console.log("draftId:", draftId);
      console.log("contestId || draftId:", contestId || draftId);

      if (contestId || draftId) {
        // Use contestId from instant DB sync if available, otherwise fall back to draftId
        const existingContestId = contestId || draftId;
        console.log(
          `Updating existing contest: ${existingContestId} (contestId: ${contestId}, draftId: ${draftId})`,
        );
        const response = await supabase
          .from("contests")
          .update(contestData)
          .eq("id", existingContestId)
          .select();
        responseData = response.data;
        responseError = response.error;
        console.log("Update response:", responseData);
      } else {
        console.log(
          "Creating new contest (no existing contestId or draftId found)",
        );
        const response = await supabase
          .from("contests")
          .insert([contestData])
          .select(); // insert expects an array
        responseData = response.data;
        responseError = response.error;
        console.log("Insert response:", responseData);
      }

      if (responseError) throw responseError;

      // Set contestId and draftId for both draft and non-draft contests to ensure we have the contest ID
      if (responseData && responseData.length > 0) {
        const newContestId = responseData[0].id;
        console.log("=== Setting state after database operation ===");
        console.log("newContestId:", newContestId);
        console.log("current contestId:", contestId);
        console.log("current draftId:", draftId);

        if (!contestId) {
          console.log("Setting contestId to:", newContestId);
          setContestId(newContestId);
        }
        if (!draftId) {
          console.log("Setting draftId to:", newContestId);
          setDraftId(newContestId);
        }

        // Sync Twitter campaign metrics if this is a Twitter contest
        if (platform === "twitter" && contestBasedDetails?.twitter_campaign) {
          try {
            await fetch(`/api/contests/${newContestId}/sync-metrics`, {
              method: "POST",
            });
            console.log("Twitter metrics synced for contest:", newContestId);
          } catch (syncError) {
            console.error("Error syncing Twitter metrics:", syncError);
            // Don't fail the request if sync fails
          }
        }
      }

      if (!isDraft) {
        // Show payment interface before final submission
        setShowPayment(true);
        setIsLoading(false);
        setUploadProgress(null);
        return;
      } else {
        // This 'else' block is for draft saving if handleSubmit is directly called with isDraft=true.
        if (prepTimeoutId !== undefined) clearTimeout(prepTimeoutId);
        setUploadProgress(null);
        toast({
          title: "Draft Saved",
          description: "Your contest draft has been saved successfully!",
        });
        // Redirect to contests list page to see the draft among all contests
        router.push("/dashboard/contests");
      }
    } catch (err: any) {
      console.error("Error submitting contest:", err);
      if (prepTimeoutId !== undefined) clearTimeout(prepTimeoutId);
      // API errors use toast
      if (err.message && err.message.includes("timestamp with time zone")) {
        toast({
          title: "Error",
          description:
            "Invalid date format. Please make sure all dates and times are properly set.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to ${
            isDraft ? "save draft" : "create contest"
          }: ${err.message || "Unknown error"}`,
          variant: "destructive",
        });
      }
      setIsLoading(false);
      setUploadProgress(null);
    }
  };

  const handlePaymentSuccess = async (paymentDetails: any) => {
    setIsLoading(true);
    setPaymentCompleted(true);
    setShowPayment(false);

    toast({
      title: "Payment Successful!",
      description:
        "Contest payment processed. We are now submitting your contest for review...",
    });

    const contestId = draftId || paymentDetails?.contestId;
    if (!contestId) {
      toast({
        title: "Submission Error",
        description:
          "Could not find Contest ID after payment. Please refresh and visit the contest page to submit manually.",
        variant: "destructive",
      });
      return;
    }

    const submitForApproval = async (retries = 3, delay = 2000) => {
      try {
        console.log(
          `Attempting to submit contest for approval. Retries left: ${retries}`,
        );
        const response = await fetch(`/api/contests/${contestId}/moderation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "submit_for_approval",
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          // If the error is that the payment is not completed, retry.
          if (
            result.error?.includes("payment must be completed") &&
            retries > 0
          ) {
            console.warn(
              `Submission failed (payment pending), retrying in ${
                delay / 1000
              }s...`,
            );
            await new Promise((res) => setTimeout(res, delay));
            return submitForApproval(retries - 1, delay);
          }
          // For other errors, throw immediately.
          throw new Error(
            result.error || "Failed to submit contest for approval",
          );
        }

        // Success!
        console.log("Contest submitted for approval successfully!");
        toast({
          title: "Contest Submitted!",
          description: "Your contest is now pending for admin review.",
        });
        router.push(`/dashboard/contests/${contestId}`);
      } catch (error: any) {
        console.error("Fatal error submitting contest for approval:", error);
        toast({
          title: "Submission Error",
          description: `Payment was successful but we failed to automatically submit your contest. Please go to the contest page and click 'Submit for Approval'. Error: ${error.message}`,
          variant: "destructive",
          duration: TOAST_DURATION_LONG,
        });
        // Still redirect to contest page so user can retry submission manually
        router.push(`/dashboard/contests/${contestId}`);
        setIsLoading(false);
      }
    };

    // Initial call to start the submission process
    await submitForApproval();
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: `Contest creation failed: ${error}`,
      variant: "destructive",
    });
    setShowPayment(false);
  };

  const addResource = async () => {
    setExternalLinkError(null);
    if (!newResourceUrl.trim()) {
      setExternalLinkError("Resource link cannot be empty.");
      toast({
        title: "Invalid Input",
        description: "Resource link cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    try {
      const urlObj = new URL(newResourceUrl);
      if (urlObj.protocol !== "https:") {
        setExternalLinkError("URL must start with https://");
        toast({
          title: "Invalid URL",
          description: "URL must start with https://",
          variant: "destructive",
        });
        return;
      }
    } catch (_) {
      setExternalLinkError("Invalid URL format.");
      toast({
        title: "Invalid URL",
        description: "Invalid URL format.",
        variant: "destructive",
      });
      return;
    }
    if (!externalResourceDescription.trim()) {
      setExternalLinkError(
        "Resource description cannot be empty for external link.",
      );
      toast({
        title: "Missing Description",
        description: "Resource description cannot be empty for external link.",
        variant: "destructive",
      });
      return;
    }
    // Check if both URL and description are the same as an existing external link (most specific)
    if (
      resources.some(
        (r) =>
          r.type === "external" &&
          r.url === newResourceUrl &&
          r.description === externalResourceDescription,
      )
    ) {
      setExternalLinkError(
        "This external link and description have already been added. Please use a different link or description.",
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
      resources.some((r) => r.type === "external" && r.url === newResourceUrl)
    ) {
      setExternalLinkError(
        "This external link has already been added. Please use a different link.",
      );
      toast({
        title: "Duplicate Link",
        description:
          "This external link has already been added. Please use a different link.",
        variant: "destructive",
      });
      return;
    }
    // Create draft contest if it doesn't exist yet
    let currentContestId = contestId || draftId;
    if (!currentContestId) {
      const newContestId = await createDraftContest();
      if (newContestId) {
        setContestId(newContestId);
        setDraftId(newContestId);
        currentContestId = newContestId;
      }
    }
    const newResources: ResourceItem[] = [
      ...resources,
      {
        url: newResourceUrl,
        description: externalResourceDescription,
        type: "external",
      },
    ];
    setResources(newResources);
    // Instantly update DB with new resources array
    if (currentContestId) {
      await updateContestInDB({ resources: newResources });
    }
    setNewResourceUrl("");
    setExternalResourceDescription("");
    toast({ title: "Success", description: "External resource added!" });
  };

  const removeResource = async (index: number) => {
    const resource = resources[index];

    try {
      // If it's an internal resource with a Supabase URL, delete it from storage
      if (
        resource.type === "internal" &&
        resource.url.includes("supabase.co/storage")
      ) {
        await deleteFromStorage(resource.url); // Reuse the same deletion logic
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

      // Instantly update DB with new resources array
      if (contestId || draftId) {
        await updateContestInDB({ resources: newResources });
      }
    }
  };

  const handleWinnerAmountChange = (index: number, value: string) => {
    // Don't validate empty inputs to allow users to delete and type new values
    if (value === "") {
      const newWinnerAmounts = [...winnerAmounts];
      newWinnerAmounts[index] = 0; // Set to zero temporarily but don't show validation error
      setWinnerAmounts(newWinnerAmounts);
      updateTotalPrizePool(newWinnerAmounts);
      return;
    }

    // Convert from display dollars to cents for storage
    const dollars = parseFloat(value);
    if (!isNaN(dollars)) {
      // Convert dollars to cents for internal storage
      const numValue = Math.round(dollars * 100);

      // Update the value immediately to improve responsiveness
      const newWinnerAmounts = [...winnerAmounts];
      newWinnerAmounts[index] = numValue;
      setWinnerAmounts(newWinnerAmounts);

      // Update total prize pool
      updateTotalPrizePool(newWinnerAmounts);

      // Show validation errors only after a complete value is entered
      if (numValue < MIN_PRIZE_PER_WINNER) {
        toast({
          title: "Prize Amount Too Low",
          description: `Prize amount for Winner ${
            index + 1
          } cannot be less than ${formatCurrencyFromCents(
            MIN_PRIZE_PER_WINNER,
          )}`,
          variant: "destructive",
        });
      } else if (numValue > MAX_PRIZE_PER_WINNER) {
        toast({
          title: "Prize Amount Too High",
          description: `Prize amount for Winner ${
            index + 1
          } cannot exceed ${formatCurrencyFromCents(MAX_PRIZE_PER_WINNER)}`,
          variant: "destructive",
        });
      }
    }
  };

  // Keep the original function for backward compatibility
  // Keep the original function for backward compatibility

  const updateTotalPrizePool = (amounts = winnerAmounts) => {
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    setTotalPrizePool(total);
  };

  const handleWinnerCountChange = (count: number) => {
    const planFeatures = getPlanFeatures(userPlan || subscriptionPlans[0].id);

    if (count > planFeatures.maxWinnersPerContest) {
      toast({
        title: "Plan Limit",
        description: `Your ${userPlan || "current"} plan is limited to ${
          planFeatures.maxWinnersPerContest
        } winners per contest. Upgrade your plan for more.`,
        variant: "destructive",
      });
      return;
    }

    setWinnerCount(count);

    // Add more entries if needed, using default allocations or minimum prize
    if (count > winnerAmounts.length) {
      const newAmounts = [...winnerAmounts];
      for (let i = winnerAmounts.length; i < count; i++) {
        // Use default allocation if available, otherwise use minimum prize
        const position = i + 1;
        newAmounts.push(
          DEFAULT_PRIZE_ALLOCATIONS[
            position as keyof typeof DEFAULT_PRIZE_ALLOCATIONS
          ] || MIN_PRIZE_PER_WINNER,
        );
      }
      setWinnerAmounts(newAmounts);
      updateTotalPrizePool(newAmounts);
    } else if (count < winnerAmounts.length) {
      // Remove extra entries
      const newAmounts = winnerAmounts.slice(0, count);
      setWinnerAmounts(newAmounts);
      updateTotalPrizePool(newAmounts);
    }
  };

  // Add this function to save basics as draft
  const saveBasicsAsDraft = async () => {
    if (!title.trim()) return; // Don't save empty titles
    let currentContestId = contestId;
    try {
      // Filter out empty values
      const filteredKeywords = keywords.filter((k) => k.trim() !== "");
      const filteredMentions = mentions.filter((m) => m.trim() !== "");

      // Prepare basics data - only include fields that have actual values
      // to prevent overwriting existing data with empty values
      const basicsData: Record<string, any> = {
        advertiser_id: user?.id,
        title,
        platform,
        category: category || null,
        contest_type: contestType,
        thumbnail_url: thumbnailPreview || null,
        moderation_status: "draft",
        contest_format: contestFormat,
      };

      // Only include content_type if it has a value (not empty string)
      if (contentType) {
        basicsData.content_type = contentType;
      }

      // Build Twitter campaign config in contest_based_details
      // raid: target a specific tweet and do like, comment, retweet, and quote repost around that tweet
      // awareness: tweet openly with specified keywords/hashtags and mentions
      if (platform === "twitter" && contestFormat === "text_image") {
        const twitterCampaign: any = {
          campaign_type: contentType === "raid" ? "raid" : "awareness", // Only 2 types: raid or awareness
          // Include all tweet types by default (tweet, quote, retweet, reply) to support reposts and retweets
          allowed_tweet_types: ["tweet", "quote", "retweet", "reply"],
        };

        if (filteredKeywords.length > 0) {
          twitterCampaign.keywords = filteredKeywords;
        }
        if (filteredMentions.length > 0) {
          twitterCampaign.mentions = filteredMentions;
        }
        if (
          maxParticipants &&
          typeof maxParticipants === "number" &&
          maxParticipants > 0
        ) {
          twitterCampaign.max_participants = maxParticipants;
        }

        if (contestType === "cpm") {
          // CPM-based Twitter contests (Points Model): configure metric weights
          const likesWeight =
            parseFloat(twitterPointsConfig.likesWeight.toString()) || 0;
          const commentsWeight =
            parseFloat(cpmPointsConfig.comment_base_points.toString()) || 0;
          const retweetsWeight =
            parseFloat(cpmPointsConfig.retweet_base_points.toString()) || 0;
          const quoteRepostsWeight =
            parseFloat(cpmPointsConfig.quote_repost_base_points.toString()) ||
            0;
          const impressionsWeight =
            parseFloat(twitterPointsConfig.impressionsWeight.toString()) || 0;

          // Build points_config with nested multipliers inside comments_weight, retweets_weight, quote_reposts_weight
          const pointsConfig: any = {
            likes_weight: likesWeight,
            impressions_weight: impressionsWeight,
          };

          // Add comments_weight - always save multipliers (defaults or user values)
          // Checkbox only controls visibility, not whether multipliers are saved
          const commentMultipliers: any = {};
          if (showCommentMultipliers) {
            // Checkbox is checked - use user values if provided, otherwise use defaults
            const commentLikes = getMultiplierValue(
              cpmPointsConfig.comment_likes_multiplier,
            );
            const commentReplies = getMultiplierValue(
              cpmPointsConfig.comment_replies_multiplier,
            );
            const commentImpressions = getMultiplierValue(
              cpmPointsConfig.comment_impressions_multiplier,
            );
            const commentRetweets = getMultiplierValue(
              cpmPointsConfig.comment_retweets_multiplier,
            );
            const commentQuoteReposts = getMultiplierValue(
              cpmPointsConfig.comment_quote_reposts_multiplier,
            );

            commentMultipliers.likes_multiplier =
              commentLikes !== undefined ? commentLikes : 0.1;
            commentMultipliers.replies_multiplier =
              commentReplies !== undefined ? commentReplies : 1;
            commentMultipliers.impressions_multiplier =
              commentImpressions !== undefined ? commentImpressions : 0.001;
            commentMultipliers.retweets_multiplier =
              commentRetweets !== undefined ? commentRetweets : 0;
            commentMultipliers.quote_reposts_multiplier =
              commentQuoteReposts !== undefined ? commentQuoteReposts : 0;
          } else {
            // Checkbox is unchecked - always use default multipliers
            commentMultipliers.likes_multiplier = 0.1;
            commentMultipliers.replies_multiplier = 1;
            commentMultipliers.impressions_multiplier = 0.001;
            commentMultipliers.retweets_multiplier = 0;
            commentMultipliers.quote_reposts_multiplier = 0;
          }

          pointsConfig.comments_weight = {
            ...(commentsWeight > 0 && { base_weight: commentsWeight }),
            ...commentMultipliers,
            _showMultipliers: showCommentMultipliers, // Flag to track checkbox state
          };

          // Add retweets_weight - always save multipliers (defaults or user values)
          // Checkbox only controls visibility, not whether multipliers are saved
          const retweetMultipliers: any = {};
          if (showRetweetMultipliers) {
            // Checkbox is checked - use user values if provided, otherwise use defaults
            const retweetLikes = getMultiplierValue(
              cpmPointsConfig.retweet_likes_multiplier,
            );
            const retweetReplies = getMultiplierValue(
              cpmPointsConfig.retweet_replies_multiplier,
            );
            const retweetImpressions = getMultiplierValue(
              cpmPointsConfig.retweet_impressions_multiplier,
            );
            const retweetRetweets = getMultiplierValue(
              cpmPointsConfig.retweet_retweets_multiplier,
            );
            const retweetQuoteReposts = getMultiplierValue(
              cpmPointsConfig.retweet_quote_reposts_multiplier,
            );

            retweetMultipliers.likes_multiplier =
              retweetLikes !== undefined ? retweetLikes : 0.05;
            retweetMultipliers.replies_multiplier =
              retweetReplies !== undefined ? retweetReplies : 0.05;
            retweetMultipliers.impressions_multiplier =
              retweetImpressions !== undefined ? retweetImpressions : 0.001;
            retweetMultipliers.retweets_multiplier =
              retweetRetweets !== undefined ? retweetRetweets : 0.05;
            retweetMultipliers.quote_reposts_multiplier =
              retweetQuoteReposts !== undefined ? retweetQuoteReposts : 0;
          } else {
            // Checkbox is unchecked - always use default multipliers
            retweetMultipliers.likes_multiplier = 0.05;
            retweetMultipliers.replies_multiplier = 0.05;
            retweetMultipliers.impressions_multiplier = 0.001;
            retweetMultipliers.retweets_multiplier = 0.05;
            retweetMultipliers.quote_reposts_multiplier = 0;
          }

          pointsConfig.retweets_weight = {
            ...(retweetsWeight > 0 && { base_weight: retweetsWeight }),
            ...retweetMultipliers,
            _showMultipliers: showRetweetMultipliers, // Flag to track checkbox state
          };

          // Add quote_reposts_weight - always save multipliers (defaults or user values)
          // Checkbox only controls visibility, not whether multipliers are saved
          const quoteRepostMultipliers: any = {};
          if (showQuoteRepostMultipliers) {
            // Checkbox is checked - use user values if provided, otherwise use defaults
            const quoteRepostLikes = getMultiplierValue(
              cpmPointsConfig.quote_repost_likes_multiplier,
            );
            const quoteRepostReplies = getMultiplierValue(
              cpmPointsConfig.quote_repost_replies_multiplier,
            );
            const quoteRepostImpressions = getMultiplierValue(
              cpmPointsConfig.quote_repost_impressions_multiplier,
            );
            const quoteRepostRetweets = getMultiplierValue(
              cpmPointsConfig.quote_repost_retweets_multiplier,
            );
            const quoteRepostQuoteReposts = getMultiplierValue(
              cpmPointsConfig.quote_repost_quote_reposts_multiplier,
            );

            quoteRepostMultipliers.likes_multiplier =
              quoteRepostLikes !== undefined ? quoteRepostLikes : 0.1;
            quoteRepostMultipliers.replies_multiplier =
              quoteRepostReplies !== undefined ? quoteRepostReplies : 0.1;
            quoteRepostMultipliers.impressions_multiplier =
              quoteRepostImpressions !== undefined
                ? quoteRepostImpressions
                : 0.001;
            quoteRepostMultipliers.retweets_multiplier =
              quoteRepostRetweets !== undefined ? quoteRepostRetweets : 0.1;
            quoteRepostMultipliers.quote_reposts_multiplier =
              quoteRepostQuoteReposts !== undefined
                ? quoteRepostQuoteReposts
                : 0.1;
          } else {
            // Checkbox is unchecked - always use default multipliers
            quoteRepostMultipliers.likes_multiplier = 0.1;
            quoteRepostMultipliers.replies_multiplier = 0.1;
            quoteRepostMultipliers.impressions_multiplier = 0.001;
            quoteRepostMultipliers.retweets_multiplier = 0.1;
            quoteRepostMultipliers.quote_reposts_multiplier = 0.1;
          }

          pointsConfig.quote_reposts_weight = {
            ...(quoteRepostsWeight > 0 && {
              base_weight: quoteRepostsWeight,
            }),
            ...quoteRepostMultipliers,
            _showMultipliers: showQuoteRepostMultipliers, // Flag to track checkbox state
          };

          twitterCampaign.points_config = pointsConfig;
        }

        if (contentType !== "raid") {
          if (keywordsRequirementMode) {
            twitterCampaign.keywords_requirement_mode = keywordsRequirementMode;
          }
          if (mentionsRequirementMode) {
            twitterCampaign.mentions_requirement_mode = mentionsRequirementMode;
          }
        }

        if (
          (contentType === "raid" || contentType === "awareness") &&
          inspirationLinks.length > 0
        ) {
          twitterCampaign.raid_target = {
            link: inspirationLinks[0]?.url || null,
            description: inspirationLinks[0]?.description || null,
            metrics: {
              likes: targetLikes === "" ? null : targetLikes,
              comments: targetReplies === "" ? null : targetReplies,
              retweets: targetRetweets === "" ? null : targetRetweets,
              quote_reposts:
                targetQuoteReposts === "" ? null : targetQuoteReposts,
            },
            keywords_requirement_mode:
              contentType === "raid" ? "" : keywordsRequirementMode,
            mentions_requirement_mode:
              contentType === "raid" ? "" : mentionsRequirementMode,
          };
        }

        // Update contest_based_details with twitter_campaign
        if (!basicsData.contest_based_details) {
          basicsData.contest_based_details = {};
        }
        basicsData.contest_based_details = {
          ...basicsData.contest_based_details,
          twitter_campaign: twitterCampaign,
        };
      }

      // Categories, subcategories, and interests
      if (contestCategories.length > 0) {
        basicsData.categories = contestCategories;
      }
      if (contestSubcategories && contestSubcategories.length > 0) {
        const grouped: Record<string, string[]> = {};
        contestSubcategories.forEach((item) => {
          if (!grouped[item.category]) {
            grouped[item.category] = [];
          }
          if (!grouped[item.category].includes(item.subcategory)) {
            grouped[item.category].push(item.subcategory);
          }
        });
        if (Object.keys(grouped).length > 0) {
          basicsData.subcategories = grouped;
        }
      }
      if (contestInterests.length > 0) {
        basicsData.interests = [...new Set(contestInterests)];
      }

      if (!currentContestId) {
        // Create new draft contest
        const { data, error } = await supabase
          .from("contests")
          .insert(basicsData)
          .select()
          .single();
        if (error) {
          console.error("Error creating basics draft:", error);
          return;
        }
        setContestId(data.id);
        setDraftId(data.id);
        return data.id;
      } else {
        // Update existing draft contest
        // Fetch existing contest_based_details to preserve leaderboard/CPM data
        const { data: existingContest } = await supabase
          .from("contests")
          .select("contest_based_details")
          .eq("id", currentContestId)
          .eq("advertiser_id", user?.id)
          .maybeSingle();

        // Preserve existing contest_based_details when updating
        if (
          existingContest?.contest_based_details &&
          basicsData.contest_based_details
        ) {
          basicsData.contest_based_details = {
            ...existingContest.contest_based_details,
            ...basicsData.contest_based_details,
          };
        }

        const { error } = await supabase
          .from("contests")
          .update(basicsData)
          .eq("id", currentContestId)
          .eq("advertiser_id", user?.id);
        if (error) {
          console.error("Error updating basics draft:", error);
        }
        return currentContestId;
      }
    } catch (error) {
      console.error("Error in saveBasicsAsDraft:", error);
    }
  };

  // Helper function to check if a multiplier value is valid (not blank/empty/NaN)
  const isValidMultiplierValue = (value: number | string): boolean => {
    if (value === null || value === undefined) return false;
    const strValue = value.toString().trim();
    if (strValue === "" || strValue === null) return false;
    const numValue = parseFloat(strValue);
    return !isNaN(numValue);
  };

  // Helper function to get multiplier value or undefined if invalid
  const getMultiplierValue = (value: number | string): number | undefined => {
    if (!isValidMultiplierValue(value)) return undefined;
    return parseFloat(value.toString().trim());
  };

  // Save CPM points config as draft when checkboxes are toggled
  const saveCpmAsDraft = async () => {
    // Ensure we have a contest ID first
    let currentContestId = contestId;
    if (!currentContestId) {
      // If no contest ID, try to save basics first to create one
      if (!title.trim()) return; // Don't save if no title
      const newContestId = await saveBasicsAsDraft();
      if (newContestId) {
        currentContestId = newContestId;
      } else {
        return; // Failed to create contest
      }
    }

    try {
      // Fetch existing contest_based_details to preserve other data
      const { data: existingContest } = await supabase
        .from("contests")
        .select("contest_based_details")
        .eq("id", currentContestId)
        .eq("advertiser_id", user?.id)
        .maybeSingle();

      const existingDetails = existingContest?.contest_based_details || {};

      // Check if this is a Twitter CPM contest
      const isTwitterCpmContest =
        platform?.toLowerCase() === "twitter" &&
        contestFormat === "text_image" &&
        contestType === "cpm";

      // Update Twitter campaign points_config with multipliers
      if (isTwitterCpmContest && contestType === "cpm") {
        const existingTwitterCampaign = existingDetails.twitter_campaign || {};
        const existingPointsConfig =
          existingTwitterCampaign.points_config || {};

        // Get base weights from current cpmPointsConfig (user's input)
        const commentsWeight =
          parseFloat(cpmPointsConfig.comment_base_points.toString()) || 0;
        const retweetsWeight =
          parseFloat(cpmPointsConfig.retweet_base_points.toString()) || 0;
        const quoteRepostsWeight =
          parseFloat(cpmPointsConfig.quote_repost_base_points.toString()) || 0;

        // Build points_config with nested multipliers inside comments_weight, retweets_weight, quote_reposts_weight
        // For raid campaigns, don't save likes_weight and impressions_weight
        const pointsConfig: any = {};
        if (contentType !== "raid") {
          const likesWeight = existingPointsConfig.likes_weight || 0;
          const impressionsWeight =
            existingPointsConfig.impressions_weight || 0;
          pointsConfig.likes_weight = likesWeight;
          pointsConfig.impressions_weight = impressionsWeight;
        }

        // Add comments_weight - always save multipliers (defaults or user values)
        // Checkbox only controls visibility, not whether multipliers are saved
        const commentMultipliers: any = {};
        if (showCommentMultipliers) {
          // Checkbox is checked - use user values if provided, otherwise use defaults
          const commentLikes = getMultiplierValue(
            cpmPointsConfig.comment_likes_multiplier,
          );
          const commentReplies = getMultiplierValue(
            cpmPointsConfig.comment_replies_multiplier,
          );
          const commentImpressions = getMultiplierValue(
            cpmPointsConfig.comment_impressions_multiplier,
          );
          const commentRetweets = getMultiplierValue(
            cpmPointsConfig.comment_retweets_multiplier,
          );
          const commentQuoteReposts = getMultiplierValue(
            cpmPointsConfig.comment_quote_reposts_multiplier,
          );

          commentMultipliers.likes_multiplier =
            commentLikes !== undefined ? commentLikes : 0.1;
          commentMultipliers.replies_multiplier =
            commentReplies !== undefined ? commentReplies : 1;
          commentMultipliers.impressions_multiplier =
            commentImpressions !== undefined ? commentImpressions : 0.001;
          commentMultipliers.retweets_multiplier =
            commentRetweets !== undefined ? commentRetweets : 0;
          commentMultipliers.quote_reposts_multiplier =
            commentQuoteReposts !== undefined ? commentQuoteReposts : 0;
        } else {
          // Checkbox is unchecked - always use default multipliers
          commentMultipliers.likes_multiplier = 0.1;
          commentMultipliers.replies_multiplier = 1;
          commentMultipliers.impressions_multiplier = 0.001;
          commentMultipliers.retweets_multiplier = 0;
          commentMultipliers.quote_reposts_multiplier = 0;
        }

        pointsConfig.comments_weight = {
          ...(commentsWeight > 0 && { base_weight: commentsWeight }),
          ...commentMultipliers,
          _showMultipliers: showCommentMultipliers, // Flag to track checkbox state
        };

        // Add retweets_weight - always save multipliers (defaults or user values)
        // Checkbox only controls visibility, not whether multipliers are saved
        const retweetMultipliers: any = {};
        if (showRetweetMultipliers) {
          // Checkbox is checked - use user values if provided, otherwise use defaults
          const retweetLikes = getMultiplierValue(
            cpmPointsConfig.retweet_likes_multiplier,
          );
          const retweetReplies = getMultiplierValue(
            cpmPointsConfig.retweet_replies_multiplier,
          );
          const retweetImpressions = getMultiplierValue(
            cpmPointsConfig.retweet_impressions_multiplier,
          );
          const retweetRetweets = getMultiplierValue(
            cpmPointsConfig.retweet_retweets_multiplier,
          );
          const retweetQuoteReposts = getMultiplierValue(
            cpmPointsConfig.retweet_quote_reposts_multiplier,
          );

          retweetMultipliers.likes_multiplier =
            retweetLikes !== undefined ? retweetLikes : 0.05;
          retweetMultipliers.replies_multiplier =
            retweetReplies !== undefined ? retweetReplies : 0.05;
          retweetMultipliers.impressions_multiplier =
            retweetImpressions !== undefined ? retweetImpressions : 0.001;
          retweetMultipliers.retweets_multiplier =
            retweetRetweets !== undefined ? retweetRetweets : 0.05;
          retweetMultipliers.quote_reposts_multiplier =
            retweetQuoteReposts !== undefined ? retweetQuoteReposts : 0;
        } else {
          // Checkbox is unchecked - always use default multipliers
          retweetMultipliers.likes_multiplier = 0.05;
          retweetMultipliers.replies_multiplier = 0.05;
          retweetMultipliers.impressions_multiplier = 0.001;
          retweetMultipliers.retweets_multiplier = 0.05;
          retweetMultipliers.quote_reposts_multiplier = 0;
        }

        pointsConfig.retweets_weight = {
          ...(retweetsWeight > 0 && { base_weight: retweetsWeight }),
          ...retweetMultipliers,
          _showMultipliers: showRetweetMultipliers, // Flag to track checkbox state
        };

        // Add quote_reposts_weight - always save multipliers (defaults or user values)
        // Checkbox only controls visibility, not whether multipliers are saved
        const quoteRepostMultipliers: any = {};
        if (showQuoteRepostMultipliers) {
          // Checkbox is checked - use user values if provided, otherwise use defaults
          const quoteRepostLikes = getMultiplierValue(
            cpmPointsConfig.quote_repost_likes_multiplier,
          );
          const quoteRepostReplies = getMultiplierValue(
            cpmPointsConfig.quote_repost_replies_multiplier,
          );
          const quoteRepostImpressions = getMultiplierValue(
            cpmPointsConfig.quote_repost_impressions_multiplier,
          );
          const quoteRepostRetweets = getMultiplierValue(
            cpmPointsConfig.quote_repost_retweets_multiplier,
          );
          const quoteRepostQuoteReposts = getMultiplierValue(
            cpmPointsConfig.quote_repost_quote_reposts_multiplier,
          );

          quoteRepostMultipliers.likes_multiplier =
            quoteRepostLikes !== undefined ? quoteRepostLikes : 0.1;
          quoteRepostMultipliers.replies_multiplier =
            quoteRepostReplies !== undefined ? quoteRepostReplies : 0.1;
          quoteRepostMultipliers.impressions_multiplier =
            quoteRepostImpressions !== undefined
              ? quoteRepostImpressions
              : 0.001;
          quoteRepostMultipliers.retweets_multiplier =
            quoteRepostRetweets !== undefined ? quoteRepostRetweets : 0.1;
          quoteRepostMultipliers.quote_reposts_multiplier =
            quoteRepostQuoteReposts !== undefined
              ? quoteRepostQuoteReposts
              : 0.1;
        } else {
          // Checkbox is unchecked - always use default multipliers
          quoteRepostMultipliers.likes_multiplier = 0.1;
          quoteRepostMultipliers.replies_multiplier = 0.1;
          quoteRepostMultipliers.impressions_multiplier = 0.001;
          quoteRepostMultipliers.retweets_multiplier = 0.1;
          quoteRepostMultipliers.quote_reposts_multiplier = 0.1;
        }

        pointsConfig.quote_reposts_weight = {
          ...(quoteRepostsWeight > 0 && {
            base_weight: quoteRepostsWeight,
          }),
          ...quoteRepostMultipliers,
          _showMultipliers: showQuoteRepostMultipliers, // Flag to track checkbox state
        };

        // Update twitter_campaign with new points_config
        const updatedTwitterCampaign = {
          ...existingTwitterCampaign,
          points_config: pointsConfig,
        };

        const updatedDetails = {
          ...existingDetails,
          twitter_campaign: updatedTwitterCampaign,
        };

        const { error } = await supabase
          .from("contests")
          .update({
            contest_based_details: updatedDetails,
            moderation_status: "draft",
          })
          .eq("id", currentContestId)
          .eq("advertiser_id", user?.id);

        if (error) {
          console.error("Error saving CPM draft:", error);
        }
      }
    } catch (error) {
      console.error("Error in saveCpmAsDraft:", error);
    }
  };

  // Update nextStep to auto-save basics as draft before moving to brief
  const nextStep = async () => {
    setIsLoading(true);

    try {
      // Helper function to set error for UI display (for steps other than basics)
      const setError = (message: string) => {
        setFormFeedback(message);
        setFormFeedbackType("error");
        setToastErrorMessage(message);
        toast({ title: "Error", description: message, variant: "destructive" });
      };

      // Helper function to show only toast (for basics step)
      const setToastError = (message: string) => {
        toast({
          title: "Validation Error",
          description: message,
          variant: "destructive",
          duration: 5000,
        });
      };

      // Validate only what's needed for the current step
      if (step === "basics") {
        // Collect all missing required fields
        const missingFields: string[] = [];

        if (!title || !title.trim()) {
          missingFields.push("Contest Title");
        }
        if (!platform || platform.trim() === "") {
          missingFields.push("Platform");
        }
        if (!category || category.trim() === "") {
          missingFields.push("Category");
        }
        if (!thumbnail && !thumbnailPreview) {
          missingFields.push("Thumbnail");
        }

        // Validate contest type access
        if (contestType === "cpm" || contestType === "milestone") {
          const planFeatures = getPlanFeatures(userPlan);
          const hasCpmAccess =
            planFeatures.contestTypes &&
            planFeatures.contestTypes.includes("cpm");

          if (!hasCpmAccess) {
            setToastError(
              "CPM and Milestone contests are only available with paid plans. Please upgrade your subscription or select Leaderboard contest type.",
            );
            setIsLoading(false);
            return;
          }
        }

        // Show comprehensive error if any fields are missing
        if (missingFields.length > 0) {
          const errorMessage =
            missingFields.length === 1
              ? `Please fill in the following required field: ${missingFields[0]}`
              : `Please fill in the following required fields: ${missingFields.join(
                  ", ",
                )}`;
          // Use toast-only error for basics step (no CardFooter alert)
          setToastError(errorMessage);
          setIsLoading(false);
          return;
        }

        // Auto-save basics as draft before moving to next step
        await saveBasicsAsDraft();
        setStep("brief");
      } else if (step === "brief") {
        // Small delay to ensure state is updated from editor
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Capture content from rich text editor before validation
        const currentBrief = captureBriefContent();
        const currentRules = captureRulesContent();

        // Capture bonus content if enabled
        if (bonusEnabled) {
          captureBonusContent();
        }

        // Also check the current brief state as a fallback
        const briefToCheck = currentBrief || briefHtml;
        const rulesToCheck = currentRules || rulesHtml;

        console.log(
          "Brief validation - currentBrief:",
          currentBrief?.substring(0, 50),
        );
        console.log(
          "Brief validation - briefHtml state:",
          briefHtml?.substring(0, 50),
        );

        if (isQuillEmpty(briefToCheck)) {
          setError("Please enter a brief description for your contest");
          setIsLoading(false);
          return;
        }
        if (isQuillEmpty(rulesToCheck)) {
          setError("Please provide rules for your contest");
          setIsLoading(false);
          return;
        }
        setStep("resources");
      } else if (step === "resources") {
        // Validate that at least one resource is provided (either uploaded asset or external link)
        const hasUploadedAssets = resources.some((r) => r.type === "internal");
        const hasExternalLinks = resources.some((r) => r.type === "external");
        if (!hasUploadedAssets && !hasExternalLinks) {
          setError(
            "Please provide at least one resource - either upload an asset OR add an external resource link to help creators understand your requirements",
          );
          setIsLoading(false);
          return;
        }
        if (inspirationLinks.length === 0) {
          setError(
            "Please add at least one inspiration link to help creators understand your vision",
          );
          setIsLoading(false);
          return;
        }
        setStep("prize");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const prevStep = () => {
    setFormFeedback(null); // Clear feedback when going back
    setFormFeedbackType(null);
    setToastErrorMessage(null); // Clear toast error when going back
    if (step === "prize") setStep("resources");
    else if (step === "resources") setStep("brief");
    else if (step === "brief") setStep("basics");
  };

  const isNextDisabled = () => {
    if (step === "basics") return !title || (!thumbnail && !thumbnailPreview); // Updated to match nextStep validation
    if (step === "brief") {
      // Check if both brief and rules content are empty using current state
      return isQuillEmpty(briefHtml) || isQuillEmpty(rulesHtml);
    }
    // For the "resources" step, no specific blocking validation for the entire step is defined for isNextDisabled
    // Individual resource additions handle their own feedback internally.
    // If you wanted to block "Next" if no resources are added, you'd check Object.keys(resources).length === 0 here.
    return false;
  };

  // Check if storage is available and create bucket if missing
  const checkStorageAvailability = async () => {
    try {
      // First, get the authenticated user properly
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) {
        console.error("Authentication error:", userError);
        return false;
      }

      // Test storage access by attempting to list files (this is allowed for authenticated users)
      const { data, error } = await supabase.storage
        .from("contest-assets")
        .list();

      if (error) {
        console.error("Storage access error:", error);
        return false;
      }

      // Storage is accessible
      return true;
    } catch (error) {
      console.error("Storage check error:", error);
      return false;
    }
  };

  // New function to get the current user's subscription plan
  const getUserPlan = async () => {
    if (!user) return;

    try {
      // Use getUser() instead of relying on session data
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        console.error("Authentication error in getUserPlan:", authError);
        setUserPlan(subscriptionPlans[0].id); // Default to EXPLORER plan
        return;
      }

      const userId = authData.user.id;

      // Use new subscription utilities to get user's subscription
      try {
        const { getUserSubscription } =
          await import("@/lib/subscription-utils-client");
        const subscription = await getUserSubscription(userId);

        if (subscription && subscription.product_id) {
          // Map real Stripe product ID to plan name for UI compatibility
          const { subscriptionPlans } =
            await import("@/constants/subscriptionPlans");
          const plan = subscriptionPlans.find(
            (p) => p.id === subscription.product_id,
          );

          if (plan) {
            setUserPlan(plan.id); // Use Stripe product ID
          } else {
            console.warn("Unknown product ID:", subscription.product_id);
            setUserPlan(subscriptionPlans[0].id); // Default to EXPLORER
          }
        } else {
          // No active subscription found, default to EXPLORER (free) plan
          setUserPlan(subscriptionPlans[0].id);
        }
      } catch (err) {
        console.error("Error fetching subscription with new system:", err);
        setUserPlan(subscriptionPlans[0].id);
      }
    } catch (error) {
      console.error("Error in getUserPlan:", error);
      setUserPlan(subscriptionPlans[0].id);
    }
  };

  // Get the features for the current plan
  const getPlanFeatures = (planId: string | null): PlanFeatures => {
    // Define a default free plan structure in case DB fetch fails or planId is null
    const defaultFreePlanFeatures: PlanFeatures = subscriptionPlans[0].features;

    if (isPlansLoading) {
      // Return defaults while loading
      console.log("Subscription plans are loading, using default features.");
      return defaultFreePlanFeatures;
    }

    if (!planId || dbSubscriptionPlans.length === 0) {
      // Return defaults if no planId or DB fetch failed/returned empty
      console.log(
        "No planId or failed to fetch plans, using default features.",
      );
      return defaultFreePlanFeatures;
    }

    const plan = dbSubscriptionPlans.find(
      (p: SubscriptionPlan) => p.id === planId,
    );

    if (!plan) {
      console.warn(
        `Plan with ID ${planId} not found in fetched plans. Using default features.`,
      );
      // Attempt to find the 'explorer' plan by name if ID fails, or use the first available plan, or default
      const explorerPlan = dbSubscriptionPlans.find(
        (p) => p.name.toLowerCase() === "EXPLORER",
      );
      return (
        explorerPlan?.features ||
        dbSubscriptionPlans[0]?.features ||
        defaultFreePlanFeatures
      );
    }

    return plan.features;
  };

  // Function to load draft data
  const loadDraftData = async () => {
    try {
      // Use getUser instead of session
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        console.error("Authentication error in loadDraftData:", authError);
        return;
      }

      const userId = authData.user.id;

      // Allow pre-selecting contest type from URL.
      const urlParams = new URLSearchParams(window.location.search);
      const selectedTypeParam = (
        urlParams.get("contestType") ||
        urlParams.get("type") ||
        ""
      )
        .trim()
        .toLowerCase();
      if (
        selectedTypeParam === "leaderboard" ||
        selectedTypeParam === "cpm" ||
        selectedTypeParam === "milestone"
      ) {
        if (selectedTypeParam === "milestone") {
          setContestFormat("video");
        }
        setContestType(selectedTypeParam);
      }

      // Check if there's a 'new' parameter in the URL - if so, don't load any draft
      const isNewContest = urlParams.get("new") === "true";

      if (isNewContest) {
        // User explicitly wants a new contest - don't load any draft
        return;
      }

      // Check if there's a draft ID in the URL query parameters
      const draftIdFromUrl = urlParams.get("draft");

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
        .eq("moderation_status", "draft")
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
    console.log("=== populateDraftData called ===");
    console.log("Full draft object:", JSON.stringify(draft, null, 2));
    console.log("Draft ID:", draft.id);
    console.log("Draft title:", draft.title);
    console.log("Draft platform:", draft.platform);
    console.log("Draft contest_format:", draft.contest_format);
    console.log("Draft content_type:", draft.content_type);
    console.log(
      "Draft twitter_campaign:",
      draft.contest_based_details?.twitter_campaign,
    );

    // Set draft/contest IDs first
    setDraftId(draft.id);
    setContestId(draft.id);

    // Basic contest fields
    setTitle(draft.title || "");

    // Contest type
    if (
      draft.contest_type === "leaderboard" ||
      draft.contest_type === "cpm" ||
      draft.contest_type === "milestone"
    ) {
      setContestType(draft.contest_type);
    }

    // Set platform
    const draftPlatform = draft.platform || "youtube";
    console.log("Setting platform to:", draftPlatform);
    setPlatform(draftPlatform);

    setCategory(draft.category || "technology");

    // Set contest format - important for showing Keywords/Mentions sections
    const draftFormat = draft.contest_format || "video";
    console.log("Setting contestFormat to:", draftFormat);
    setContestFormat(draftFormat);

    // Content type - set with setTimeout to ensure platform is applied first
    // (Content type options depend on platform)
    if (draft.content_type) {
      const validTypes = ["ugc", "clipping", "other", "raid", "awareness"];
      if (validTypes.includes(draft.content_type)) {
        console.log("Setting contentType to:", draft.content_type);
        setTimeout(() => {
          setContentType(draft.content_type);
        }, 50);
      } else {
        console.log("Invalid content_type:", draft.content_type);
      }
    }

    // Thumbnail
    if (draft.thumbnail_url) {
      setThumbnailPreview(draft.thumbnail_url);
    }

    // Keywords and Mentions - set with setTimeout to ensure contestFormat is applied first
    // (Keywords/Mentions section only renders when contestFormat === "text_image")
    setTimeout(() => {
      // Read from contest_based_details.twitter_campaign (single source of truth)
      const twitterCampaign = draft.contest_based_details?.twitter_campaign;

      if (twitterCampaign) {
        // Keywords from twitter_campaign.keywords
        if (
          Array.isArray(twitterCampaign.keywords) &&
          twitterCampaign.keywords.length > 0
        ) {
          console.log("✅ Setting keywords to:", twitterCampaign.keywords);
          setKeywords(twitterCampaign.keywords);
        }

        // Mentions from twitter_campaign.mentions
        if (
          Array.isArray(twitterCampaign.mentions) &&
          twitterCampaign.mentions.length > 0
        ) {
          console.log("✅ Setting mentions to:", twitterCampaign.mentions);
          setMentions(twitterCampaign.mentions);
        }

        // Requirement modes
        if (twitterCampaign.keywords_requirement_mode) {
          setKeywordsRequirementMode(twitterCampaign.keywords_requirement_mode);
        }
        if (twitterCampaign.mentions_requirement_mode) {
          setMentionsRequirementMode(twitterCampaign.mentions_requirement_mode);
        }
        if (twitterCampaign.max_participants) {
          setMaxParticipants(twitterCampaign.max_participants);
        }

        // Twitter CPM points configuration (Points Model) - load weights from JSONB if present
        const pointsConfig = twitterCampaign.points_config || {};
        setTwitterPointsConfig({
          likesWeight:
            typeof pointsConfig.likes_weight === "number" &&
            pointsConfig.likes_weight > 0
              ? pointsConfig.likes_weight
              : "",
          commentsWeight:
            typeof pointsConfig.comments_weight === "number" &&
            pointsConfig.comments_weight > 0
              ? pointsConfig.comments_weight
              : "",
          retweetsWeight:
            typeof pointsConfig.retweets_weight === "number" &&
            pointsConfig.retweets_weight > 0
              ? pointsConfig.retweets_weight
              : "",
          quoteRepostsWeight:
            typeof pointsConfig.quote_reposts_weight === "number" &&
            pointsConfig.quote_reposts_weight > 0
              ? pointsConfig.quote_reposts_weight
              : "",
          impressionsWeight:
            typeof pointsConfig.impressions_weight === "number" &&
            pointsConfig.impressions_weight > 0
              ? pointsConfig.impressions_weight
              : "",
        });
      }
    }, 100);

    // Brief rich text
    if (draft.brief_html) {
      setBrief(draft.brief_html);
      setBriefHtml(draft.brief_html);
    }
    if (draft.brief_json) {
      setBriefJson(draft.brief_json);
      if (richTextEditorRef.current) {
        richTextEditorRef.current.setContent(draft.brief_json);
      }
    }

    // Rules rich text
    if (draft.rules_html) {
      setRulesHtml(draft.rules_html);
    }
    if (draft.rules_json) {
      setRulesJson(draft.rules_json);
      setTimeout(() => {
        if (rulesRichTextEditorRef.current) {
          rulesRichTextEditorRef.current.setContent(draft.rules_json);
        }
      }, 100);
    }

    // Target metrics from contest_based_details.twitter_campaign.raid_target
    const twitterCampaign = draft.contest_based_details?.twitter_campaign;
    if (twitterCampaign?.raid_target) {
      const raidTarget = twitterCampaign.raid_target;
      if (raidTarget.metrics && typeof raidTarget.metrics === "object") {
        if (
          raidTarget.metrics.likes !== undefined &&
          raidTarget.metrics.likes !== null
        ) {
          setTargetLikes(raidTarget.metrics.likes);
        }
        if (
          raidTarget.metrics.comments !== undefined &&
          raidTarget.metrics.comments !== null
        ) {
          setTargetReplies(raidTarget.metrics.comments);
        }
        if (
          raidTarget.metrics.retweets !== undefined &&
          raidTarget.metrics.retweets !== null
        ) {
          setTargetRetweets(raidTarget.metrics.retweets);
        }
        if (
          raidTarget.metrics.quote_reposts !== undefined &&
          raidTarget.metrics.quote_reposts !== null
        ) {
          setTargetQuoteReposts(raidTarget.metrics.quote_reposts);
        }
      }
      if (
        raidTarget.keywords_requirement_mode === "all" ||
        raidTarget.keywords_requirement_mode === "any"
      ) {
        setKeywordsRequirementMode(raidTarget.keywords_requirement_mode);
      }
      if (
        raidTarget.mentions_requirement_mode === "all" ||
        raidTarget.mentions_requirement_mode === "any"
      ) {
        setMentionsRequirementMode(raidTarget.mentions_requirement_mode);
      }
    }

    // Resources
    if (draft.resources && typeof draft.resources === "object") {
      setResources(draft.resources);
    }

    // Inspiration links
    if (Array.isArray(draft.inspiration_links)) {
      setInspirationLinks(draft.inspiration_links);
    }

    // Tracking links
    if (Array.isArray(draft.tracking_links)) {
      setTrackingLinks(draft.tracking_links);
    }

    // Contest-based details (leaderboard & CPM specific data)
    const contestDetails = draft.contest_based_details || {};

    // Leaderboard contest details (winners, prizes, flat fee bonus, bonus budget)
    if (
      contestDetails.leaderboard_contest &&
      draft.contest_type === "leaderboard"
    ) {
      const lc = contestDetails.leaderboard_contest;
      if (lc.winner_count) {
        setWinnerCount(lc.winner_count);
      }
      if (Array.isArray(lc.prizes)) {
        const amounts = lc.prizes.map(
          (prize: { amount?: number }) => prize.amount || 0,
        );
        setWinnerAmounts(amounts);
        updateTotalPrizePool(amounts);
      }

      // Restore flat fee bonus (stored in cents)
      if (
        typeof lc.flat_fee_bonus === "number" &&
        !isNaN(lc.flat_fee_bonus) &&
        lc.flat_fee_bonus > 0
      ) {
        setFlatFeeBonus((lc.flat_fee_bonus / 100).toString());
      }

      // Restore total budget for bonuses (stored in cents as total_budget)
      if (
        typeof lc.total_budget === "number" &&
        !isNaN(lc.total_budget) &&
        lc.total_budget > 0
      ) {
        setTotalBudget((lc.total_budget / 100).toString());
      }
    }

    // Milestone contest (video)
    if (
      contestDetails.milestone_contest &&
      draft.contest_type === "milestone"
    ) {
      const mc = contestDetails.milestone_contest;
      if (Array.isArray(mc.milestones) && mc.milestones.length > 0) {
        setMilestoneRows(
          mc.milestones.map((m: any) => ({
            id: createEmptyMilestoneRow().id,
            target_views:
              typeof m.target_views === "number" ? m.target_views : "",
            payout_dollars:
              typeof m.payout_cents === "number"
                ? (m.payout_cents / 100).toString()
                : "",
            winner_limit:
              m.winner_limit === null || m.winner_limit === undefined
                ? ""
                : m.winner_limit,
          })),
        );
      }
      if (
        typeof mc.total_budget_cents === "number" &&
        mc.total_budget_cents > 0
      ) {
        setTotalBudget((mc.total_budget_cents / 100).toString());
      }
      const bonus = mc.bonus;
      if (bonus && typeof bonus === "object") {
        if (bonus.enabled) {
          setMilestoneBonusEnabled(true);
        }
        if (bonus.most_verified_views) {
          const mv = bonus.most_verified_views;
          if (typeof mv.min_total_views === "number") {
            setMilestoneBonusTopViewsMin(mv.min_total_views);
          }
          if (typeof mv.min_verified_reels === "number") {
            setMilestoneBonusTopViewsMinReels(mv.min_verified_reels);
          }
          if (typeof mv.payout_cents === "number") {
            setMilestoneBonusTopViewsPayout((mv.payout_cents / 100).toString());
          }
        }
        if (bonus.most_verified_reels) {
          const mr = bonus.most_verified_reels;
          if (typeof mr.min_total_views === "number") {
            setMilestoneBonusTopReelsMinViews(mr.min_total_views);
          }
          if (typeof mr.min_verified_reels === "number") {
            setMilestoneBonusTopReelsMin(mr.min_verified_reels);
          }
          if (typeof mr.payout_cents === "number") {
            setMilestoneBonusTopReelsPayout((mr.payout_cents / 100).toString());
          }
        }
      }
    }

    // CPM contest details (rate, views, total budget, terms, flat fee bonus & cap)
    if (contestDetails.cpm_contest && draft.contest_type === "cpm") {
      const cc = contestDetails.cpm_contest;

      // Ensure contest type is CPM when CPM details exist
      setContestType("cpm");

      if (
        typeof cc.cpm_rate_usd === "number" &&
        !isNaN(cc.cpm_rate_usd) &&
        cc.cpm_rate_usd > 0
      ) {
        setCpmRate(cc.cpm_rate_usd.toString());
      }

      if (cc.min_views !== undefined && cc.min_views !== null) {
        setMinViews(cc.min_views);
      }
      if (cc.max_views !== undefined && cc.max_views !== null) {
        setMaxViews(cc.max_views);
      }

      if (
        typeof cc.total_budget === "number" &&
        !isNaN(cc.total_budget) &&
        cc.total_budget > 0
      ) {
        // Stored in cents, convert back to dollars
        setTotalBudget((cc.total_budget / 100).toString());
      }

      if (typeof cc.terms_conditions === "string") {
        setTermsConditions(cc.terms_conditions);
      }

      // Load CPM Points Configuration from twitter_campaign.points_config (multipliers are nested inside comments_weight, retweets_weight, quote_reposts_weight)
      const twitterCampaign = draft.contest_based_details?.twitter_campaign;
      if (twitterCampaign?.points_config) {
        const pc = twitterCampaign.points_config;

        // Extract multipliers from nested structure
        const commentsWeightObj =
          typeof pc.comments_weight === "object" ? pc.comments_weight : {};
        const retweetsWeightObj =
          typeof pc.retweets_weight === "object" ? pc.retweets_weight : {};
        const quoteRepostsWeightObj =
          typeof pc.quote_reposts_weight === "object"
            ? pc.quote_reposts_weight
            : {};

        // Check if checkbox was checked (weight is an object) even if no multipliers were saved
        const commentWeightIsObject = typeof pc.comments_weight === "object";
        const retweetWeightIsObject = typeof pc.retweets_weight === "object";
        const quoteRepostWeightIsObject =
          typeof pc.quote_reposts_weight === "object";

        // Load values from database
        // If weight is an object (checkbox was checked), use empty string for missing values (user left them blank)
        // If weight is a number (checkbox was unchecked or never configured), use defaults when checkbox is checked
        // Extract base weights from saved data
        const savedCommentsWeight =
          typeof pc.comments_weight === "object" &&
          pc.comments_weight.base_weight !== undefined
            ? pc.comments_weight.base_weight
            : typeof pc.comments_weight === "number"
              ? pc.comments_weight
              : 0;
        const savedRetweetsWeight =
          typeof pc.retweets_weight === "object" &&
          pc.retweets_weight.base_weight !== undefined
            ? pc.retweets_weight.base_weight
            : typeof pc.retweets_weight === "number"
              ? pc.retweets_weight
              : 0;
        const savedQuoteRepostsWeight =
          typeof pc.quote_reposts_weight === "object" &&
          pc.quote_reposts_weight.base_weight !== undefined
            ? pc.quote_reposts_weight.base_weight
            : typeof pc.quote_reposts_weight === "number"
              ? pc.quote_reposts_weight
              : 0;

        setCpmPointsConfig({
          comment_base_points:
            savedCommentsWeight > 0 ? savedCommentsWeight.toString() : "1", // Load saved base points or default
          retweet_base_points:
            savedRetweetsWeight > 0 ? savedRetweetsWeight.toString() : "5", // Load saved base points or default
          quote_repost_base_points:
            savedQuoteRepostsWeight > 0
              ? savedQuoteRepostsWeight.toString()
              : "10", // Load saved base points or default
          comment_likes_multiplier:
            commentsWeightObj.likes_multiplier !== undefined &&
            commentsWeightObj.likes_multiplier !== null
              ? commentsWeightObj.likes_multiplier.toString()
              : commentWeightIsObject
                ? ""
                : "0.1", // Empty if checkbox checked but no value, default if checkbox unchecked
          comment_replies_multiplier:
            commentsWeightObj.replies_multiplier !== undefined &&
            commentsWeightObj.replies_multiplier !== null
              ? commentsWeightObj.replies_multiplier.toString()
              : commentWeightIsObject
                ? ""
                : "1",
          comment_impressions_multiplier:
            commentsWeightObj.impressions_multiplier !== undefined &&
            commentsWeightObj.impressions_multiplier !== null
              ? commentsWeightObj.impressions_multiplier.toString()
              : commentWeightIsObject
                ? ""
                : "0.001",
          comment_retweets_multiplier:
            commentsWeightObj.retweets_multiplier !== undefined &&
            commentsWeightObj.retweets_multiplier !== null
              ? commentsWeightObj.retweets_multiplier.toString()
              : commentWeightIsObject
                ? ""
                : "0",
          comment_quote_reposts_multiplier:
            commentsWeightObj.quote_reposts_multiplier !== undefined &&
            commentsWeightObj.quote_reposts_multiplier !== null
              ? commentsWeightObj.quote_reposts_multiplier.toString()
              : commentWeightIsObject
                ? ""
                : "0",
          retweet_likes_multiplier:
            retweetsWeightObj.likes_multiplier !== undefined &&
            retweetsWeightObj.likes_multiplier !== null
              ? retweetsWeightObj.likes_multiplier.toString()
              : retweetWeightIsObject
                ? ""
                : "0.05",
          retweet_replies_multiplier:
            retweetsWeightObj.replies_multiplier !== undefined &&
            retweetsWeightObj.replies_multiplier !== null
              ? retweetsWeightObj.replies_multiplier.toString()
              : retweetWeightIsObject
                ? ""
                : "0.05",
          retweet_impressions_multiplier:
            retweetsWeightObj.impressions_multiplier !== undefined &&
            retweetsWeightObj.impressions_multiplier !== null
              ? retweetsWeightObj.impressions_multiplier.toString()
              : retweetWeightIsObject
                ? ""
                : "0.001",
          retweet_retweets_multiplier:
            retweetsWeightObj.retweets_multiplier !== undefined &&
            retweetsWeightObj.retweets_multiplier !== null
              ? retweetsWeightObj.retweets_multiplier.toString()
              : retweetWeightIsObject
                ? ""
                : "0.05",
          retweet_quote_reposts_multiplier:
            retweetsWeightObj.quote_reposts_multiplier !== undefined &&
            retweetsWeightObj.quote_reposts_multiplier !== null
              ? retweetsWeightObj.quote_reposts_multiplier.toString()
              : retweetWeightIsObject
                ? ""
                : "0",
          quote_repost_likes_multiplier:
            quoteRepostsWeightObj.likes_multiplier !== undefined &&
            quoteRepostsWeightObj.likes_multiplier !== null
              ? quoteRepostsWeightObj.likes_multiplier.toString()
              : quoteRepostWeightIsObject
                ? ""
                : "0.1",
          quote_repost_replies_multiplier:
            quoteRepostsWeightObj.replies_multiplier !== undefined &&
            quoteRepostsWeightObj.replies_multiplier !== null
              ? quoteRepostsWeightObj.replies_multiplier.toString()
              : quoteRepostWeightIsObject
                ? ""
                : "0.1",
          quote_repost_impressions_multiplier:
            quoteRepostsWeightObj.impressions_multiplier !== undefined &&
            quoteRepostsWeightObj.impressions_multiplier !== null
              ? quoteRepostsWeightObj.impressions_multiplier.toString()
              : quoteRepostWeightIsObject
                ? ""
                : "0.001",
          quote_repost_retweets_multiplier:
            quoteRepostsWeightObj.retweets_multiplier !== undefined &&
            quoteRepostsWeightObj.retweets_multiplier !== null
              ? quoteRepostsWeightObj.retweets_multiplier.toString()
              : quoteRepostWeightIsObject
                ? ""
                : "0.1",
          quote_repost_quote_reposts_multiplier:
            quoteRepostsWeightObj.quote_reposts_multiplier !== undefined &&
            quoteRepostsWeightObj.quote_reposts_multiplier !== null
              ? quoteRepostsWeightObj.quote_reposts_multiplier.toString()
              : quoteRepostWeightIsObject
                ? ""
                : "0.1",
        });

        // Set checkbox states from saved flag
        // We save _showMultipliers flag to track checkbox state
        setShowCommentMultipliers(
          commentWeightIsObject && commentsWeightObj._showMultipliers === true,
        );
        setShowRetweetMultipliers(
          retweetWeightIsObject && retweetsWeightObj._showMultipliers === true,
        );
        setShowQuoteRepostMultipliers(
          quoteRepostWeightIsObject &&
            quoteRepostsWeightObj._showMultipliers === true,
        );
      }

      // Restore flat fee bonus (stored in cents)
      if (
        typeof cc.flat_fee_bonus === "number" &&
        !isNaN(cc.flat_fee_bonus) &&
        cc.flat_fee_bonus > 0
      ) {
        setFlatFeeBonus((cc.flat_fee_bonus / 100).toString());
      }

      // Restore flat fee bonus cap (stored in cents)
      if (
        typeof cc.flat_fee_bonus_cap === "number" &&
        !isNaN(cc.flat_fee_bonus_cap) &&
        cc.flat_fee_bonus_cap > 0
      ) {
        setFlatFeeBonusCap((cc.flat_fee_bonus_cap / 100).toString());
      }
    }

    // Dates (convert from UTC to local)
    if (draft.start_date) {
      const { dateString, timeString } = toLocalDateTimeStrings(
        draft.start_date,
      );
      setStartDate(dateString);
      setStartTime(timeString);
    }
    if (draft.end_date) {
      const { dateString, timeString } = toLocalDateTimeStrings(draft.end_date);
      setEndDate(dateString);
      setEndTime(timeString);
    }

    // Categories, subcategories, interests
    if (Array.isArray(draft.categories)) {
      setContestCategories(draft.categories);
    }
    if (draft.subcategories) {
      if (Array.isArray(draft.subcategories)) {
        setContestSubcategories(draft.subcategories);
      } else if (typeof draft.subcategories === "object") {
        const grouped = draft.subcategories as Record<string, string[]>;
        const flatArray: Array<{ category: string; subcategory: string }> = [];
        Object.keys(grouped).forEach((category) => {
          const subcats = grouped[category];
          if (Array.isArray(subcats)) {
            subcats.forEach((subcat) => {
              flatArray.push({ category, subcategory: subcat });
            });
          }
        });
        setContestSubcategories(flatArray);
      }
    }
    if (Array.isArray(draft.interests)) {
      setContestInterests(draft.interests);
    }

    // Regions / countries
    if (draft.region && typeof draft.region === "object") {
      const { regions, countries } = extractRegionsAndCountries(
        draft.region as Record<string, string[]>,
      );
      setSelectedRegions(regions);
      setSelectedCountries(countries);
    }

    console.log("Draft loaded successfully");
  };

  // Call this once when component mounts
  useEffect(() => {
    // Load subscription plans from constants (new system)
    const loadSubscriptionPlans = async () => {
      setIsPlansLoading(true);
      try {
        // Import plans from constants (new subscription system)
        const { subscriptionPlans } =
          await import("@/constants/subscriptionPlans");

        // Convert to the format expected by the UI
        const mappedPlans: SubscriptionPlan[] = subscriptionPlans.map(
          (plan) => ({
            id: plan.id, // Now real Stripe product ID
            name: plan.name,
            price: plan.price, // Already in cents
            features: {
              maxActiveContests: plan.features.maxActiveContests,
              minContestBudget: plan.features.minContestBudget,
              maxWinnersPerContest: plan.features.maxWinnersPerContest,
              commissionPercentage: plan.features.commissionPercentage,
              contestTypes: plan.features.contestTypes,
              analytics: plan.features.analytics,
              support: plan.features.support,
              description: plan.features.description,
            },
          }),
        );

        setDbSubscriptionPlans(mappedPlans);
      } catch (error: any) {
        console.error("Error loading subscription plans:", error);
        toast({
          title: "Error",
          description: `Failed to load subscription plans: ${error.message}. Using defaults.`,
          variant: "destructive",
        });
        setDbSubscriptionPlans([]);
      } finally {
        setIsPlansLoading(false);
      }
    };

    // Modified to handle storage errors more gracefully
    const initializeData = async () => {
      try {
        setIsPlansLoading(true); // Ensure loading state is set initially
        await loadSubscriptionPlans(); // Load plans first
        await checkStorageAvailability();
        await getUserPlan(); // getUserPlan might depend on loaded plans if defaults change
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

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime()))
      return null;

    // Calculate days until contest starts
    const msUntilStart = startDateTime.getTime() - now.getTime();
    const daysUntilStart = Math.floor(msUntilStart / (1000 * 60 * 60 * 24));
    const hoursUntilStart = Math.floor(
      (msUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );

    // Calculate contest duration
    const msDuration = endDateTime.getTime() - startDateTime.getTime();
    const durationDays = Math.floor(msDuration / (1000 * 60 * 60 * 24));
    const durationHours = Math.floor(
      (msDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );

    let startMessage = "";
    if (daysUntilStart > 0) {
      startMessage = `Your contest will be live in ${daysUntilStart} day${
        daysUntilStart !== 1 ? "s" : ""
      }`;
      if (hoursUntilStart > 0)
        startMessage += ` and ${hoursUntilStart} hour${
          hoursUntilStart !== 1 ? "s" : ""
        }`;
    } else if (hoursUntilStart > 0) {
      startMessage = `Your contest will be live in ${hoursUntilStart} hour${
        hoursUntilStart !== 1 ? "s" : ""
      }`;
    } else {
      startMessage = "Your contest will be live soon";
    }

    const durationMessage = `and will run for ${durationDays} day${
      durationDays !== 1 ? "s" : ""
    }${
      durationHours > 0
        ? ` and ${durationHours} hour${durationHours !== 1 ? "s" : ""}`
        : ""
    }`;

    return `${startMessage} ${durationMessage}`;
  };

  // Get minimum allowed start date and time (2 days from today)
  const getMinDateTime = () => {
    // SIMPLE AND CORRECT: Just add days to current date
    const now = new Date();

    // Create minimum start date by adding MIN_DAYS_UNTIL_START days to today
    const minStartDate = new Date(now);
    minStartDate.setDate(now.getDate() + MIN_DAYS_UNTIL_START);

    // Format as YYYY-MM-DD
    const year = minStartDate.getFullYear();
    const month = String(minStartDate.getMonth() + 1).padStart(2, "0");
    const day = String(minStartDate.getDate()).padStart(2, "0");

    const result = `${year}-${month}-${day}`;

    return {
      date: result,
      time: "00:00", // Always start at 00:00 since we only care about date
    };
  };

  // Get minimum allowed start time (always 00:00 since we only care about date)
  const getMinStartTime = () => {
    return "00:00"; // Always allow 00:00 since we only care about date, not time
  };

  // Get minimum allowed end date (at least 3 days after the start date)
  const getMinEndDate = () => {
    if (!startDate || !startTime) return getMinDateTime().date;

    const startDateObj = new Date(`${startDate}T${startTime}`);
    // Add minimum duration days to the start date
    startDateObj.setDate(startDateObj.getDate() + MIN_CONTEST_DURATION_DAYS);

    return `${startDateObj.getFullYear()}-${String(
      startDateObj.getMonth() + 1,
    ).padStart(2, "0")}-${String(startDateObj.getDate()).padStart(2, "0")}`;
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

  // Update end date/time when start date/time changes to ensure minimum duration
  useEffect(() => {
    if (!startDate || !startTime) return;

    const startDateTime = new Date(`${startDate}T${startTime}`);

    // If end date/time is set and is less than minimum duration after start, update it
    if (endDate && endTime) {
      const endDateTime = new Date(`${endDate}T${endTime}`);
      const minEndDateTime = new Date(startDateTime);
      minEndDateTime.setDate(
        minEndDateTime.getDate() + MIN_CONTEST_DURATION_DAYS,
      );

      if (endDateTime < minEndDateTime) {
        // Set end date/time to be exactly minimum duration after start
        const newEndDate = getMinEndDate();
        setEndDate(newEndDate);
        setEndTime(startTime); // Keep the same time of day
      }
    }
  }, [startDate, startTime]);

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
      today.getDate(),
    );
    const minStartDate = new Date(startOfToday);
    minStartDate.setDate(minStartDate.getDate() + MIN_DAYS_UNTIL_START);

    // Disallowed dates list: today .. (minStartDate - 1)
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
      startOfToday,
    )}, you can create contests starting from ${formatDateWithOrdinal(
      minStartDate,
    )} (00:00 onwards). ${disallowedText} ${
      disallowed.length > 1 ? "are" : "is"
    } not allowed.`;
  };

  // High Budget Prompt Modal
  // Modern Error Alert Component with auto-dismiss
  const ErrorAlert = ({ message }: { message: string }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000); // Auto-dismiss after 3 seconds

      return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-4 rounded-lg shadow-2xl border border-red-400 max-w-md">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">Validation Error</h4>
              <p className="text-sm text-red-50">{message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Prize section
  const renderPrizeSection = () => {
    const currentPlan =
      dbSubscriptionPlans.find((p) => p.id === userPlan) || null;
    const planFeatures = getPlanFeatures(userPlan);

    if (isPlansLoading) {
      return (
        <CardContent className="space-y-6">
          <div className="text-center py-6">Loading plan details...</div>
        </CardContent>
      );
    }

    return (
      <>
        {/* <CardHeader>
          <CardTitle>
            {contestType === "leaderboard"
              ? "Prize & Duration"
              : "CPM Configuration & Duration"}
          </CardTitle>
          <CardDescription>
            Configure the financial aspects, duration, and terms for your
            contest.
          </CardDescription>
        </CardHeader> */}
        <div className="space-y-12">
          {/* Current Plan Details */}
          <div
          // className={`relative overflow-hidden border-2 rounded-2xl p-8 mb-8 shadow-xl ${
          //   currentPlan && currentPlan.price === 0
          //     ? "bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 border-gray-300"
          //     : currentPlan &&
          //       currentPlan.price <= PLAN_PRICE_THRESHOLD_STARTER
          //     ? "bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 border-orange-200"
          //     : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-200/50"
          // }`}
          >
            {/* Background decorative elements */}
            {/* <div
              className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl ${
                currentPlan && currentPlan.price === 0
                  ? "bg-gradient-to-br from-gray-300/20 to-gray-400/20" 
                  : currentPlan &&
                    currentPlan.price <= PLAN_PRICE_THRESHOLD_STARTER
                  ? "bg-gradient-to-br from-orange-300/20 to-amber-400/20" 
                  : "bg-gradient-to-br from-blue-400/20 to-purple-400/20" 
              }`}
            ></div>
            <div
              className={`absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl ${
                currentPlan && currentPlan.price === 0
                  ? "bg-gradient-to-br from-gray-400/15 to-slate-400/15"
                  : currentPlan &&
                    currentPlan.price <= PLAN_PRICE_THRESHOLD_STARTER
                  ? "bg-gradient-to-br from-amber-400/15 to-orange-400/15"
                  : "bg-gradient-to-br from-indigo-400/15 to-pink-400/15"
              }`}
            ></div> */}

            <div>
              {/* Header Section */}

              <div
                className={cn(
                  "px-6 pt-6 pb-5 border-b rounded-tl-xl rounded-tr-xl shadow-xl space-y-6",
                  isDark
                    ? "bg-[#180438] border-gray-600 text-white"
                    : " border-[#D0D0D0] bg-white text-purple-600",
                )}
              >
                <h2 className="font-semibold text-xl">Rewards & Timeline</h2>
              </div>
              <div
                className={cn(
                  "max-w-[1100px] mx-auto shadow-md px-6 pt-3",
                  isDark
                    ? "bg-[#180438] text-white"
                    : "bg-white text-purple-600",
                )}
              >
                <h3 className="text-lg font-bold mb-4">Your Plan Details</h3>
                <div className="flex items-start justify-between ">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "rounded-full p-3.5",
                        isDark
                          ? "bg-[#FFFFFF36] text-white"
                          : "text-[#4A00BE] bg-[#D8C3FF]",
                      )}
                    >
                      <Trophy className="h-8 w-8" />
                    </div>
                    <div>
                      <h3
                        className={cn(
                          "text-xl md:text-2xl font-bold ",
                          isDark ? "text-white" : "text-gray-900",
                        )}
                      >
                        Your Current Subscription Plan
                      </h3>
                      <p
                        className={cn(
                          "text-gray-600 text-md leading-relaxed",
                          isDark ? "text-white" : "text-gray-600",
                        )}
                      >
                        {currentPlan && currentPlan.price === 0 ? (
                          <>
                            Get started with basic features.{" "}
                            <span className="font-medium text-orange-600">
                              Upgrade for better rates and more flexibility!
                            </span>
                          </>
                        ) : currentPlan &&
                          currentPlan.price <= PLAN_PRICE_THRESHOLD_STARTER ? (
                          <>
                            Good for small campaigns.{" "}
                            <span className="font-medium text-blue-600">
                              Higher plans offer better commission rates!
                            </span>
                          </>
                        ) : (
                          <>
                            Your plan determines contest limits, commission
                            rates, and available features. Higher plans offer
                            better rates and more flexibility for your marketing
                            campaigns.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {currentPlan ? (
                <div className="space-y-12">
                  <div
                    className={cn(
                      "rounded-bl-xl rounded-br-xl px-6 pt-6 pb-8 shadow-lg",
                      isDark ? "bg-[#180438]" : "bg-white",
                    )}
                    // className={`backdrop-blur-sm rounded-bl-xl rounded-br-xl px-6 pt-6 pb-8 shadow-lg ${
                    //   currentPlan.price === 0
                    //     ? "bg-white/90 border-gray-200" // Free plan
                    //     : currentPlan.price <= PLAN_PRICE_THRESHOLD_STARTER
                    //     ? "bg-white/90 border-gray-200" // Bronze plan
                    //     : "bg-white/90 border-gray-200" // Higher plans
                    // }`}
                  >
                    <div
                      className={cn(
                        "flex flex-col  lg:flex-row items-start lg:items-center border rounded-xl p-4 sm:p-6 justify-between gap-6",
                        isDark ? "border-gray-500" : "border-gray-300",
                      )}
                    >
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div
                          className={cn(
                            "rounded-full p-3",
                            isDark
                              ? "bg-[#FFFFFF36] text-white"
                              : "text-[#4A00BE] bg-[#D8C3FF]",
                          )}
                          // className={`w-16 h-16 rounded-full flex items-center justify-center ${
                          //   userPlan === subscriptionPlans[0].id
                          //     ? "bg-[#D8C3FF] text-[#4A00BE]" // Free plan
                          //     : userPlan === subscriptionPlans[1].id
                          //     ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                          //     : userPlan === subscriptionPlans[2].id
                          //     ? "bg-gradient-to-br from-gray-400 to-slate-500 text-white"
                          //     : userPlan === subscriptionPlans[3].id
                          //     ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white"
                          //     : userPlan === subscriptionPlans[4].id
                          //     ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
                          //     : userPlan === subscriptionPlans[5].id
                          //     ? "bg-gradient-to-br from-blue-500 to-cyan-600 text-white"
                          //     : "bg-gradient-to-br from-gray-500 to-gray-600 text-white"
                          // }`}
                        >
                          <Trophy className="h-6 w-6 sm:h-8 sm:w-8" />
                        </div>
                        <div>
                          <h4
                            className={cn(
                              "text-lg sm:text-xl font-bold mb-1",
                              isDark ? "text-white" : "text-gray-900",
                            )}
                          >
                            {currentPlan.name || "FREE"} Plan
                          </h4>
                          <div className="flex items-center gap-2">
                            <span
                              // className={`text-3xl font-bold ${
                              //   currentPlan.price === 0
                              //     ? "text-gray-600"
                              //     : "text-blue-600"
                              // }`}
                              className="text-3xl font-bold text-[#7F39EC]"
                            >
                              {formatCurrencyFromCents(currentPlan.price)}
                            </span>
                            <span className="text-3xl text-[#7F39EC]">
                              /month
                            </span>
                            {currentPlan.price === 0 && (
                              <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                                Limited Features
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-start md:items-end gap-2">
                        {currentPlan.price > 0 ? (
                          <>
                            <div
                              className={cn(
                                "px-5 py-2.5 rounded-xl bg-[#4A00BE] text-white text-sm md:text-[13px] ",
                                isDark ? "bg-[#7F39EC]" : "bg-[#4A00BE]",
                              )}
                            >
                              Active Subscription
                            </div>
                            <p
                              className={cn(
                                "text-xs",
                                isDark ? "text-white" : "text-gray-500",
                              )}
                            >
                              Billed monthly
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="px-5 py-2 rounded-xl bg-[#4A00BE] text-white text-sm md:text-[13px]">
                              Free Plan
                            </div>
                            <p className="text-xs text-orange-600 font-medium">
                              Consider upgrading
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Plan Features with Descriptions */}
                  <div>
                    <div
                      className={cn(
                        "px-6 pt-6 pb-4 border-b rounded-t-xl shadow-xl space-y-6",
                        isDark
                          ? "bg-[#180438] text-white border-gray-600"
                          : "bg-white border-[#D0D0D0] text-black",
                      )}
                    >
                      <h2 className="font-semibold text-2xl">Plan Features</h2>
                    </div>
                    <div
                      className={cn(
                        "max-w-[1100px] mx-auto rounded-b-xl shadow-lg roundex-xl px-6 pt-6 pb-8",
                        isDark ? "bg-[#180438]" : "bg-white",
                      )}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Max Winners Feature - Only show for Leaderboard contests */}
                        {contestType === "leaderboard" && (
                          <div
                            className={cn(
                              "border rounded-xl p-4 flex flex-col justify-between shadow-sm",
                              isDark ? "border-gray-500" : "border-gray-300",
                            )}
                            // className={`backdrop-blur-sm border rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 ${
                            //   planFeatures.maxWinnersPerContest <= 3
                            //     ? "bg-orange-50/80 border-orange-200"
                            //     : "bg-white/80 border-gray-200/50"
                            // }`}
                          >
                            <div className="flex items-start gap-4">
                              {/* <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                              planFeatures.maxWinnersPerContest <= 3
                                ? "bg-gradient-to-br from-orange-500 to-orange-600"
                                : "bg-gradient-to-br from-blue-500 to-blue-600" 
                            }`}
                          >
                            <span className="text-white font-bold text-lg">
                              W
                            </span>
                          </div> */}
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h5
                                    className={cn(
                                      "text-lg font-semibold mb-2",
                                      isDark ? "text-white" : "text-gray-900",
                                    )}
                                  >
                                    Maximum Winners
                                  </h5>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-green-600 border border-green-600 rounded-full px-6">
                                      {planFeatures.maxWinnersPerContest ===
                                      Infinity
                                        ? "∞"
                                        : planFeatures.maxWinnersPerContest}
                                    </span>
                                    {planFeatures.maxWinnersPerContest <= 3 && (
                                      <span className="text-orange-500 text-sm">
                                        ⚠️
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p
                                  className={cn(
                                    "text-sm leading-relaxed mb-4",
                                    isDark ? "text-white" : "text-gray-600",
                                  )}
                                >
                                  The maximum number of creators you can reward
                                  in a single leaderboard contest. More winners
                                  means broader reach and engagement for your
                                  brand.
                                </p>
                                <div
                                  className={cn(
                                    "rounded-lg px-3 py-2 text-center border text-sm font-medium",
                                    isDark
                                      ? "border-gray-600"
                                      : "bg-[#F0E7FD] border-purple-500 text-purple-600",
                                  )}
                                  // className={`mt-3 text-sm font-medium ${
                                  //   planFeatures.maxWinnersPerContest <= 3
                                  //     ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                  //     : "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                  // }`}
                                >
                                  {planFeatures.maxWinnersPerContest <= 3
                                    ? "Upgrade for more winner slots!"
                                    : "Tip: More winners = higher participation rates"}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* CPM Rate Info - Only show for CPM contests */}
                        {contestType === "cpm" && (
                          <div
                            className={cn(
                              "border rounded-xl p-4 flex flex-col justify-between shadow-sm",
                              isDark ? "border-gray-500" : "border-gray-300",
                            )}
                          >
                            <div className="flex items-start gap-4">
                              {/* <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-purple-500 to-purple-600">
                                <span className="text-white font-bold text-lg">
                                  <GitGraphIcon />
                                </span>
                              </div> */}
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-3">
                                  <h5
                                    className={cn(
                                      "text-lg font-semibold",
                                      isDark ? "text-white" : "text-gray-900",
                                    )}
                                  >
                                    Total Winners
                                  </h5>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-green-600 border border-green-600 rounded-full px-6">
                                      ∞
                                    </span>
                                  </div>
                                </div>
                                <p
                                  className={cn(
                                    "text-sm leading-relaxed",
                                    isDark ? "text-white" : "text-gray-600",
                                  )}
                                >
                                  In CPM contests, there's no limit on winners.
                                  All participating creators get paid based on
                                  their content's performance (views) &
                                  eligibility.
                                </p>
                                <div
                                  className={cn(
                                    "mt-5 text-sm font-medium border text-center rounded-lg px-3 py-2",
                                    isDark
                                      ? "border-gray-600"
                                      : "bg-[#F0E7FD] border-purple-500 text-purple-600",
                                  )}
                                >
                                  Pay for performance - reward creators based on
                                  actual results
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {contestType === "milestone" && (
                          <div
                            className={cn(
                              "border rounded-xl p-4 flex flex-col justify-between shadow-sm",
                              isDark ? "border-gray-500" : "border-gray-300",
                            )}
                          >
                            <div className="flex-1">
                              <h5
                                className={cn(
                                  "text-lg font-semibold mb-2",
                                  isDark ? "text-white" : "text-gray-900",
                                )}
                              >
                                Milestone rewards
                              </h5>
                              <p
                                className={cn(
                                  "text-sm leading-relaxed mb-3",
                                  isDark ? "text-white" : "text-gray-600",
                                )}
                              >
                                Define view thresholds and payouts. You set an
                                overall contest budget upfront; optional caps
                                per tier limit how many creators can earn each
                                reward.
                              </p>
                              <div
                                className={cn(
                                  "text-sm font-medium border text-center rounded-lg px-3 py-2",
                                  isDark
                                    ? "border-gray-600"
                                    : "bg-[#F0E7FD] border-purple-500 text-purple-600",
                                )}
                              >
                                Video contests only — rewards are based on
                                verified views
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Min Budget Feature */}
                        <div
                          className={cn(
                            "backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300",
                            isDark ? "border-gray-500" : "border-gray-300",
                          )}

                          // className={`backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300 ${
                          //   planFeatures.minContestBudget >=
                          //   HIGH_MIN_BUDGET_THRESHOLD
                          //     ? "bg-white"
                          //     : "bg-white/80 border-gray-200/50"
                          // }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                            planFeatures.minContestBudget >=
                            HIGH_MIN_BUDGET_THRESHOLD
                              ? "bg-gradient-to-br from-orange-500 to-red-600"
                              : "bg-gradient-to-br from-green-500 to-emerald-600"
                          }`}
                        >
                          <span className="text-white font-bold text-lg">
                            $
                          </span>
                        </div> */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h5
                                  className={cn(
                                    "text-lg font-semibold",
                                    isDark ? "text-white" : "text-gray-900",
                                  )}
                                >
                                  Minimum Budget
                                </h5>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xl font-bold ${
                                      planFeatures.minContestBudget >=
                                      HIGH_MIN_BUDGET_THRESHOLD
                                        ? "text-green-600 border border-green-600 rounded-full px-6"
                                        : "text-green-600 border border-green-600 rounded-full px-6"
                                    }`}
                                  >
                                    {formatCurrencyFromCents(
                                      planFeatures.minContestBudget,
                                    )}
                                  </span>
                                  {planFeatures.minContestBudget >=
                                    HIGH_MIN_BUDGET_THRESHOLD && (
                                    <span className="text-orange-500 text-sm">
                                      ⚠️
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p
                                className={cn(
                                  "text-sm leading-relaxed",
                                  isDark ? "text-white" : "text-gray-600",
                                )}
                              >
                                The minimum total prize pool required to create
                                a contest. Lower minimums give you more
                                flexibility for smaller campaigns.
                              </p>
                              <div
                                className={cn(
                                  "mt-4 rounded-lg px-3 py-2 text-center border text-sm font-medium",
                                  isDark
                                    ? "border-gray-600"
                                    : "bg-[#F0E7FD] border-purple-500 text-purple-600",
                                )}
                                // className={`mt-4 text-sm font-medium ${
                                //   planFeatures.minContestBudget >=
                                //   HIGH_MIN_BUDGET_THRESHOLD
                                //     ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                //     : "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                // }`}
                              >
                                {planFeatures.minContestBudget >=
                                HIGH_MIN_BUDGET_THRESHOLD
                                  ? "Upgrade for lower minimum budgets!"
                                  : "Tip: Start with smaller budgets to test campaigns"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Active Contests Feature */}
                        <div
                          className={cn(
                            "backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300",
                            isDark ? "border-gray-500" : "border-gray-300",
                          )}

                          // className={`backdrop-blur-sm border rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 ${
                          //   planFeatures.maxActiveContests <= 1
                          //     ? "bg-white"
                          //     : planFeatures.maxActiveContests <= 5
                          //     ? "bg-orange-50/80 border-orange-200"
                          //     : "bg-white/80 border-gray-200/50"
                          // }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                            planFeatures.maxActiveContests <= 1
                              ? "bg-gradient-to-br from-red-500 to-red-600" 
                              : planFeatures.maxActiveContests <= 5
                              ? "bg-gradient-to-br from-orange-500 to-orange-600" 
                              : "bg-gradient-to-br from-purple-500 to-indigo-600" 
                          }`}
                        >
                          <span className="text-white font-bold text-lg">
                            C
                          </span>
                        </div> */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h5
                                  className={cn(
                                    "text-lg font-semibold",
                                    isDark ? "text-white" : "text-gray-900",
                                  )}
                                >
                                  Active Contests
                                </h5>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xl font-bold ${
                                      planFeatures.maxActiveContests <= 1
                                        ? "text-green-600 border border-green-600 rounded-full px-6"
                                        : planFeatures.maxActiveContests <= 5
                                          ? "text-green-600 border border-green-600 rounded-full px-6"
                                          : "text-green-600 border border-green-600 rounded-full px-6"
                                    }`}
                                  >
                                    {planFeatures.maxActiveContests === Infinity
                                      ? "∞"
                                      : planFeatures.maxActiveContests}
                                  </span>
                                  {planFeatures.maxActiveContests <= 5 && (
                                    <span
                                      className={`text-sm ${
                                        planFeatures.maxActiveContests <= 1
                                          ? "text-red-500"
                                          : "text-orange-500"
                                      }`}
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p
                                className={cn(
                                  "text-sm leading-relaxed",
                                  isDark ? "text-white" : "text-gray-900",
                                )}
                              >
                                How many contests you can run simultaneously.
                                Run multiple campaigns to maximize your brand's
                                exposure across different audiences.
                              </p>
                              <div
                                className={cn(
                                  "mt-4 rounded-lg px-3 py-2 text-center border text-sm font-medium",
                                  isDark
                                    ? "border-gray-600"
                                    : "bg-[#F0E7FD] border-purple-500 text-purple-600",
                                )}
                                // className={`mt-4 text-sm font-medium ${
                                //   planFeatures.maxActiveContests <= 1
                                //     ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                //     : planFeatures.maxActiveContests <= 5
                                //     ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                //     : "mt-4 border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                // }`}
                              >
                                {planFeatures.maxActiveContests <= 1
                                  ? "Only 1 contest allowed - upgrade now!"
                                  : planFeatures.maxActiveContests <= 5
                                    ? "Upgrade for more simultaneous campaigns!"
                                    : "Tip: Run parallel campaigns for different products"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Commission Feature */}
                        <div
                          className={cn(
                            "backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300",
                            isDark ? "border-gray-500" : "border-gray-300",
                          )}

                          // className={`backdrop-blur-sm border rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 ${
                          //   planFeatures.commissionPercentage >= 40
                          //     ? "bg-red-50/80 border-red-200"
                          //     : planFeatures.commissionPercentage >= 20
                          //     ? "bg-orange-50/80 border-orange-200"
                          //     : "bg-white/80 border-gray-200/50"
                          // }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                            planFeatures.commissionPercentage >= 40
                              ? "bg-gradient-to-br from-red-500 to-red-600" 
                              : planFeatures.commissionPercentage >= 20
                              ? "bg-gradient-to-br from-orange-500 to-red-600"
                              : "bg-gradient-to-br from-green-500 to-emerald-600" 
                          }`}
                        >
                          <span className="text-white font-bold text-lg">
                            %
                          </span>
                        </div> */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h5
                                  className={cn(
                                    "text-lg font-semibold",
                                    isDark ? "text-white" : "text-gray-900",
                                  )}
                                >
                                  Platform Commission
                                </h5>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xl font-bold ${
                                      planFeatures.commissionPercentage >= 40
                                        ? "text-green-600 border border-green-600 rounded-full px-6"
                                        : planFeatures.commissionPercentage >=
                                            20
                                          ? "text-green-600 border border-green-600 rounded-full px-6"
                                          : "text-green-600 border border-green-600 rounded-full px-6"
                                    }`}
                                  >
                                    {planFeatures.commissionPercentage}%
                                  </span>
                                  {planFeatures.commissionPercentage >= 20 && (
                                    <span
                                      className={`text-sm ${
                                        planFeatures.commissionPercentage >= 40
                                          ? "text-red-500"
                                          : "text-orange-500"
                                      }`}
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p
                                className={cn(
                                  "text-sm leading-relaxed",
                                  isDark ? "text-white" : "text-gray-600 ",
                                )}
                              >
                                Our service fee taken from your total prize
                                pool. Higher-tier plans have lower commission
                                rates, saving you money on larger campaigns.
                              </p>
                              <div
                                className={cn(
                                  "mt-4 rounded-lg px-3 py-2 text-center border text-sm font-medium",
                                  isDark
                                    ? "border-gray-600"
                                    : "bg-[#F0E7FD] border-purple-500 text-purple-600",
                                )}
                                // className={`mt-4 text-sm font-medium ${
                                //   planFeatures.commissionPercentage >= 40
                                //     ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                //     : planFeatures.commissionPercentage >= 20
                                //     ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                //     : "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                // }`}
                              >
                                {planFeatures.maxActiveContests <= 1
                                  ? "Only 1 contest allowed - upgrade now!"
                                  : planFeatures.maxActiveContests <= 5
                                    ? "Upgrade for more simultaneous campaigns!"
                                    : "Tip: Run parallel campaigns for different products"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Enhanced Plan Benefits Summary */}
                  <div
                    className={cn(
                      "rounded-xl p-8 text-black shadow-lg relative overflow-hidden",
                      isDark
                        ? "bg-[#180438] text-white"
                        : "bg-white text-black",
                    )}
                    // className={`rounded-xl p-8 text-black shadow-lg relative overflow-hidden ${
                    //   currentPlan.price === 0
                    //     ? "bg-white" // Free plan - modern slate
                    //     : currentPlan.price <= PLAN_PRICE_THRESHOLD_STARTER
                    //     ? "bg-white" // Bronze plan - warm
                    //     : "bg-white" // Higher plans - premium
                    // }`}
                  >
                    {/* Background Pattern */}
                    {/* <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
                    </div> */}

                    <div className="relative z-10">
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-6">
                        <div
                          className={cn(
                            "rounded-full p-3.5",
                            isDark
                              ? "bg-[#FFFFFF36] text-white"
                              : "text-[#4A00BE] bg-[#D8C3FF]",
                          )}
                        >
                          <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-xl font-bold">
                            {currentPlan.price === 0
                              ? `${currentPlan.name} Plan`
                              : `${currentPlan.name} Plan`}
                          </h4>
                          <p className="text-sm opacity-90 font-medium">
                            {currentPlan.price === 0
                              ? "Get started for free, then upgrade!"
                              : "Your current plan benefits"}
                          </p>
                        </div>
                      </div>

                      {/* Features Grid */}
                      <div
                        className={cn(
                          "border py-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-2 mb-2",
                          isDark ? "border-gray-600" : "border-gray-300",
                        )}
                      >
                        <div className="flex items-start gap-3 group">
                          <div className="w-3 h-3 mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                          <div>
                            <span className="text-md font-medium">
                              Launch up to{" "}
                              {planFeatures.maxActiveContests === Infinity
                                ? "unlimited"
                                : planFeatures.maxActiveContests}{" "}
                              simultaneous campaigns
                            </span>
                          </div>
                        </div>

                        {/* Only show winner limit for leaderboard contests */}
                        {contestType === "leaderboard" && (
                          <div className="flex items-start gap-3 group">
                            <div className="w-3 h-3  mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                            <div>
                              <span className="text-md font-medium">
                                Reward up to{" "}
                                {planFeatures.maxWinnersPerContest === Infinity
                                  ? "unlimited"
                                  : planFeatures.maxWinnersPerContest}{" "}
                                creators per contest
                              </span>
                              <span className="text-xs opacity-75 block">
                                (Leaderboard)
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Show CPM info for CPM contests */}
                        {contestType === "cpm" && (
                          <div className="flex items-start gap-3 group">
                            <div className="w-3 h-3 mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                            <div>
                              <span className="text-md font-medium">
                                Performance-based rewards
                              </span>
                              <span className="text-xs opacity-75 block">
                                (No winner limits - CPM)
                              </span>
                            </div>
                          </div>
                        )}

                        {contestType === "milestone" && (
                          <div className="flex items-start gap-3 group">
                            <div className="w-3 h-3 mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                            <div>
                              <span className="text-md font-medium">
                                View-tier rewards with optional winner caps
                              </span>
                              <span className="text-xs opacity-75 block">
                                (Milestone — video only)
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3 group">
                          <div className="w-3 h-3  mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                          <div>
                            <span className="text-md font-medium">
                              Start campaigns from just{" "}
                              {formatCurrencyFromCents(
                                planFeatures.minContestBudget,
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 group">
                          <div className="w-3 h-3 mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                          <div>
                            <span className="text-md font-medium">
                              Only {planFeatures.commissionPercentage}% platform
                              fee
                            </span>
                            <span className="text-xs opacity-75 block">
                              on your budget
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Upgrade CTA for lower tier plans */}
                      {(currentPlan.price === 0 ||
                        planFeatures.commissionPercentage >= 20) && (
                        <div className="rounded-2xl py-6 px-4 mt-4 border border-gray-300">
                          <div className="flex items-start justify-between gap-6">
                            <div className="flex-1 min-w-0">
                              <h5 className="text-base font-bold">
                                {currentPlan.price === 0
                                  ? "Ready to unlock more potential?"
                                  : "Want better rates and more features?"}
                              </h5>
                              <p className="text-sm opacity-90 leading-relaxed pr-4">
                                {currentPlan.price === 0
                                  ? "Upgrade to reduce commission and get more winners"
                                  : "Higher plans offer lower commission rates and more flexibility"}
                              </p>
                            </div>
                            {userPlan !== PRODUCT_IDS.CHAMPION && (
                              <div className="flex-shrink-0">
                                <button
                                  className="px-5 py-2 rounded-xl bg-[#4A00BE] text-white"
                                  onClick={() => setShowUpgradeModal(true)}
                                >
                                  Upgrade Plan
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Trophy className="h-10 w-10 text-white" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-3">
                    No Active Subscription Plan
                  </h4>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
                    You need an active subscription plan to create contests and
                    start your marketing campaigns. Choose a plan that fits your
                    marketing needs and budget.
                  </p>
                  <Button
                    asChild
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    <Link href="/pricing">View Pricing Plans →</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Contest Duration */}

          <div
            className={cn(
              "space-y-6 max-w-[1100px] mx-auto bg-white shadow-xl p-6 rounded-xl",
              isDark ? "bg-[#180438] text-white" : "bg-white text-black",
            )}
          >
            <h3 className="text-xl font-semibold">Contest Duration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                  }}
                  min={getMinDateTime().date}
                  className={cn(
                    "w-full",
                    isDark
                      ? "bg-[#180438] border border-gray-600 [&::-webkit-calendar-picker-indicator]:invert"
                      : "bg-white [&::-webkit-calendar-picker-indicator]:filter-none",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={cn(
                    "w-full",
                    isDark
                      ? "bg-[#180438] border border-gray-600 [&::-webkit-calendar-picker-indicator]:invert"
                      : "bg-white [&::-webkit-calendar-picker-indicator]:filter-none",
                  )}
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
                    const minEndTime = getMinEndTime();
                    if (endTime < minEndTime) {
                      setEndTime(minEndTime);
                    }
                  }}
                  min={getMinEndDate()}
                  className={cn(
                    "w-full",
                    isDark
                      ? "bg-[#180438] border border-gray-600 [&::-webkit-calendar-picker-indicator]:invert"
                      : "bg-white [&::-webkit-calendar-picker-indicator]:filter-none",
                  )}
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
                  min={
                    endDate === getMinEndDate() ? getMinEndTime() : undefined
                  }
                  className={cn(
                    "w-full",
                    isDark
                      ? "bg-[#180438] border border-gray-600 [&::-webkit-calendar-picker-indicator]:invert"
                      : "bg-white [&::-webkit-calendar-picker-indicator]:filter-none",
                  )}
                  disabled={!startDate || !startTime || !endDate}
                />
              </div>
            </div>
            {getContestDuration() && (
              <Alert
                className={cn(
                  "mt-2 border",
                  isDark
                    ? "bg-[#C9A7FF26] border border-[#C9A7FF]"
                    : "bg-green-50 border-green-200 text-green-700",
                )}
              >
                <AlertDescription>{getContestDuration()}</AlertDescription>
              </Alert>
            )}
            <p
              className={cn(
                "text-sm mt-1",
                isDark ? "text-white" : "text-gray-600",
              )}
            >
              <strong>Start Date Rule:</strong> Contest must start at least{" "}
              {MIN_DAYS_UNTIL_START} days from today.{" "}
              {getStartDateRuleExample()}
              <br />
              <strong>Duration:</strong> Contest must run between{" "}
              {MIN_CONTEST_DURATION_DAYS} and {MAX_CONTEST_DURATION_DAYS} days.
              The end date will automatically adjust to maintain minimum
              duration.
            </p>
            {/* <Separator className="my-6" /> */}

            {/* Conditional UI based on contestType */}

            {contestType === "leaderboard" ? (
              <>
                <div className="space-y-4">
                  <div className="flex px-1 items-center flex-col gap-3 md:flex-row md:justify-between">
                    {/* This is the specific "Prize distribution" heading for leaderboard */}
                    <h3 className="text-lg font-medium">Prize Distribution</h3>
                    <div
                      className={cn(
                        "flex items-center gap-2  px-4 py-2 rounded-full",
                        isDark
                          ? "bg-[#180438] text-purple-400"
                          : "bg-gray-100 text-black",
                      )}
                    >
                      <span className="text-md font-medium">
                        Total Prize Pool:
                      </span>
                      <span className="text-lg font-bold">
                        {formatCurrencyFromCents(totalPrizePool)}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      isDark
                        ? "bg-[#180438]p-2 sm:p-4"
                        : "bg-gray-50 p-2 sm:p-4 rounded-lg",
                    )}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <Label className="w-32 md:w-48">
                        Number of Winners{" "}
                        <span className="text-xs text-gray-500">
                          (Required)
                        </span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() =>
                            handleWinnerCountChange(winnerCount - 1)
                          }
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
                          onClick={() =>
                            handleWinnerCountChange(winnerCount + 1)
                          }
                          disabled={
                            winnerCount >= planFeatures.maxWinnersPerContest
                          }
                        >
                          +
                        </Button>
                      </div>
                      <div
                        className={cn(
                          "text-sm",
                          isDark ? "text-white" : "text-gray-600",
                        )}
                      >
                        <span>
                          Allowed:{" "}
                          {planFeatures.maxWinnersPerContest === Infinity
                            ? "Unlimited"
                            : planFeatures.maxWinnersPerContest}
                        </span>
                      </div>
                    </div>
                    {Array.from({ length: Math.min(winnerCount, 10) }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4"
                        >
                          <Label className="w-40 md:w-48">Winner {i + 1}</Label>
                          <Input
                            type="number"
                            step="1"
                            // Ensure value is in dollars for display
                            // value={winnerAmounts[i] ? winnerAmounts[i] / 100 : (MIN_PRIZE_PER_WINNER / 100)}
                            value={winnerAmounts[i] / 100}
                            onChange={
                              (e) => handleWinnerAmountChange(i, e.target.value) // Expects dollars
                            }
                            min={MIN_PRIZE_PER_WINNER / 100}
                            className={cn(
                              "w-full sm:w-40 md:w-48",
                              isDark
                                ? "bg-[#180438] border border-gray-600 [&::-webkit-calendar-picker-indicator]:invert"
                                : "bg-white [&::-webkit-calendar-picker-indicator]:filter-none",
                            )}
                          />
                          <div
                            className={cn(
                              "text-sm",
                              isDark ? "text-white" : "text-gray-600",
                            )}
                          >
                            <span>
                              Min:{" "}
                              {formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
                {totalPrizePool < planFeatures.minContestBudget && (
                  <Alert
                    className={cn(
                      "mt-2",
                      isDark
                        ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                        : "bg-[#D9C0FF26] border-[#7F39EC] text-gray-900",
                    )}
                  >
                    <AlertDescription>
                      The minimum prize pool for your{" "}
                      {currentPlan?.name || "current"} plan is{" "}
                      {formatCurrencyFromCents(planFeatures.minContestBudget)}.
                      Please increase your prize amounts.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : contestType === "milestone" ? (
              <>
                <div className="space-y-6 py-4 px-1">
                  <h3 className="text-lg font-medium">
                    Milestone contest configuration
                  </h3>
                  <Alert
                    className={cn(
                      "border",
                      isDark
                        ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                        : "bg-[#F0E7FD] border-[#4A00BE] text-purple-800",
                    )}
                  >
                    <AlertDescription>
                      <strong>Non-cumulative payouts:</strong> each creator
                      receives only the reward for the{" "}
                      <strong>highest</strong> milestone they reach (not the sum
                      of all tiers below it). Each tier payout must be at least{" "}
                      {formatCurrencyFromCents(MIN_MILESTONE_PAYOUT_CENTS)}.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-4">
                    {milestoneRows.map((row, idx) => {
                      const winnerLimitValue =
                        row.winner_limit === ""
                          ? NaN
                          : parseInt(String(row.winner_limit), 10);
                      const payoutDollarsValue = parseFloat(
                        String(row.payout_dollars),
                      );
                      const estimatedPayoutCents =
                        !isNaN(winnerLimitValue) &&
                        winnerLimitValue > 0 &&
                        !isNaN(payoutDollarsValue) &&
                        payoutDollarsValue > 0
                          ? Math.round(payoutDollarsValue * 100 * winnerLimitValue)
                          : null;

                      return (
                      <div
                        key={row.id}
                        className={cn(
                          "grid gap-3 md:grid-cols-12 md:items-end p-4 border rounded-lg",
                          isDark ? "border-gray-600" : "border-gray-300",
                        )}
                      >
                        <div className="md:col-span-12">
                          <h4 className="text-sm font-semibold">Milestone {idx + 1}</h4>
                        </div>
                        <div className="md:col-span-3 space-y-2">
                          <Label>Target views</Label>
                          <Input
                            type="number"
                            min={1}
                            value={row.target_views}
                            onChange={(e) => {
                              const v = e.target.value;
                              const updatedRows = milestoneRows.map((r) =>
                                r.id === row.id
                                  ? { ...r, target_views: v === "" ? "" : v }
                                  : r,
                              );
                              setMilestoneRows(updatedRows);
                              updateMilestoneRowsWithValidation(updatedRows);
                            }}
                            className={cn(
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "",
                            )}
                            placeholder="e.g. 1000"
                          />
                        </div>
                        <div className="md:col-span-3 space-y-2">
                          <Label>Payout (USD)</Label>
                          <Input
                            type="number"
                            min={MIN_MILESTONE_PAYOUT_CENTS / 100}
                            step="0.01"
                            value={row.payout_dollars}
                            onChange={(e) => {
                              const updatedRows = milestoneRows.map((r) =>
                                r.id === row.id
                                  ? { ...r, payout_dollars: e.target.value }
                                  : r,
                              );
                              setMilestoneRows(updatedRows);
                              updateMilestoneRowsWithValidation(updatedRows);
                            }}
                            className={cn(
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "",
                            )}
                            placeholder="e.g. 5.00"
                          />
                        </div>
                        <div className="md:col-span-3 space-y-2">
                          <p className="text-xs">
                            <span className="font-medium">
                              Winner cap (optional):
                            </span>{" "}
                            <span className="text-muted-foreground">
                              First N creators to reach this tier, or leave blank
                              for everyone who qualifies.
                            </span>
                          </p>
                          <Input
                            type="number"
                            min={1}
                            value={row.winner_limit}
                            onChange={(e) =>
                              setMilestoneRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, winner_limit: e.target.value }
                                    : r,
                                ),
                              )
                            }
                            className={cn(
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "",
                            )}
                            placeholder="0"
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          {estimatedPayoutCents !== null && (
                            <>
                              <Label>Estimated payout</Label>
                              <div
                                className={cn(
                                  "h-10 rounded-md border px-3 flex items-center text-sm",
                                  isDark
                                    ? "bg-[#180438] border-gray-600 text-white"
                                    : "bg-muted/40 border-input",
                                )}
                              >
                                {formatCurrencyFromCents(estimatedPayoutCents)}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="md:col-span-1 flex md:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            disabled={milestoneRows.length <= 1}
                            onClick={() => {
                              const updatedRows = milestoneRows.filter(
                                (r) => r.id !== row.id,
                              );
                              setMilestoneRows(updatedRows);
                              updateMilestoneRowsWithValidation(updatedRows);
                            }}
                            aria-label={`Remove milestone ${idx + 1}`}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                    })}
                    {milestoneSequenceError && (
                      <Alert variant="destructive">
                        <AlertDescription>{milestoneSequenceError}</AlertDescription>
                      </Alert>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canAddNextMilestone(milestoneRows)}
                      onClick={handleAddMilestoneRow}
                    >
                      Add milestone
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="milestoneTotalBudget">
                      Total contest budget (USD){" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="milestoneTotalBudget"
                      type="number"
                      value={totalBudget}
                      onChange={(e) => setTotalBudget(e.target.value)}
                      min="1"
                      step="0.01"
                      className={cn(
                        isDark
                          ? "bg-[#180438] border border-gray-600 text-white"
                          : "bg-white",
                      )}
                      placeholder="Maximum amount reserved for this contest"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the pool you fund upfront (similar to a CPM
                      budget). Payouts are drawn from it as creators hit
                      milestones.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "space-y-3 p-4 border rounded-lg",
                      isDark
                        ? "bg-blue-950/50 border-blue-800"
                        : "bg-blue-50 border-blue-200",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎯</span>
                      <Label
                        htmlFor="milestoneMaxEarnings"
                        className="text-base font-semibold"
                      >
                        Maximum Earnings Per Creator (Optional)
                      </Label>
                    </div>
                    <Input
                      id="milestoneMaxEarnings"
                      type="number"
                      min="0"
                      step="0.01"
                      value={maxEarningsPerCreator}
                      className={cn(
                        isDark
                          ? "bg-[#180438] border border-gray-600 text-white"
                          : "bg-white text-black",
                      )}
                      onChange={(e) => setMaxEarningsPerCreator(e.target.value)}
                      placeholder="e.g., 500 for $500 max per creator"
                    />
                    <p className="text-sm text-muted-foreground">
                      Set a maximum earning cap per creator for{" "}
                      <strong>THIS CONTEST ONLY</strong>. Once reached, they can
                      still submit but won't earn more from this campaign. This
                      does NOT affect their earnings from other contests on the
                      platform. Helps ensure fair reward distribution within this
                      campaign.
                    </p>
                    {maxEarningsPerCreator &&
                      parseFloat(maxEarningsPerCreator.toString()) > 0 && (
                        <Alert
                          className={cn(
                            isDark
                              ? "bg-blue-900/30 border-blue-900"
                              : "bg-blue-100 border-blue-300",
                          )}
                        >
                          <AlertDescription
                            className={cn(
                              isDark ? "text-blue-200" : "text-blue-800",
                            )}
                          >
                            ℹ️ Each creator can earn up to{" "}
                            <strong>
                              $
                              {parseFloat(
                                maxEarningsPerCreator.toString(),
                              ).toFixed(2)}
                            </strong>{" "}
                            from this contest.
                          </AlertDescription>
                        </Alert>
                      )}
                  </div>
                  <div
                    className={cn(
                      "space-y-4 p-4 border rounded-lg",
                      isDark ? "border-gray-600" : "border-gray-300",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="milestoneBonusToggle"
                        checked={milestoneBonusEnabled}
                        onCheckedChange={(c) =>
                          setMilestoneBonusEnabled(c === true)
                        }
                      />
                      <Label
                        htmlFor="milestoneBonusToggle"
                        className="cursor-pointer text-md font-medium"
                      >
                        Creator Bonus (verified creators)
                      </Label>
                    </div>
                    {milestoneBonusEnabled && (
                      <div className="space-y-4 pl-1">
                        <p className="text-sm text-muted-foreground">
                          Optional extras for top performers. Configure at least
                          one category when bonus is enabled.
                        </p>
                        <h4 className="text-sm font-semibold">
                          Most Verified Views 
                        </h4>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label>
                             Minimum total verified views
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              value={milestoneBonusTopViewsMin}
                              onChange={(e) =>
                                setMilestoneBonusTopViewsMin(
                                  e.target.value === ""
                                    ? ""
                                    : parseInt(e.target.value, 10),
                                )
                              }
                              className={cn(
                                isDark
                                  ? "bg-[#180438] border border-gray-600"
                                  : "",
                              )}
                              placeholder="e.g. 200000"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>
                              Minimum verified reels
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              value={milestoneBonusTopViewsMinReels}
                              onChange={(e) =>
                                setMilestoneBonusTopViewsMinReels(
                                  e.target.value === ""
                                    ? ""
                                    : parseInt(e.target.value, 10),
                                )
                              }
                              className={cn(
                                isDark
                                  ? "bg-[#180438] border border-gray-600"
                                  : "",
                              )}
                              placeholder="e.g. 5"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Winner bonus (USD)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={MIN_MILESTONE_PAYOUT_CENTS / 100}
                              value={milestoneBonusTopViewsPayout}
                              onChange={(e) =>
                                setMilestoneBonusTopViewsPayout(e.target.value)
                              }
                              className={cn(
                                isDark
                                  ? "bg-[#180438] border border-gray-600"
                                  : "",
                              )}
                              placeholder="e.g. 100"
                            />
                          </div>
                        </div>
                        <h4 className="text-sm font-semibold">
                          Most Verified Reels 
                        </h4>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label>
                              Minimum total verified views
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              value={milestoneBonusTopReelsMinViews}
                              onChange={(e) =>
                                setMilestoneBonusTopReelsMinViews(
                                  e.target.value === ""
                                    ? ""
                                    : parseInt(e.target.value, 10),
                                )
                              }
                              className={cn(
                                isDark
                                  ? "bg-[#180438] border border-gray-600"
                                  : "",
                              )}
                              placeholder="e.g. 200000"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Minimum verified reels</Label>
                            <Input
                              type="number"
                              min={1}
                              value={milestoneBonusTopReelsMin}
                              onChange={(e) =>
                                setMilestoneBonusTopReelsMin(
                                  e.target.value === ""
                                    ? ""
                                    : parseInt(e.target.value, 10),
                                )
                              }
                              className={cn(
                                isDark
                                  ? "bg-[#180438] border border-gray-600"
                                  : "",
                              )}
                              placeholder="e.g. 5"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Winner bonus (USD)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={MIN_MILESTONE_PAYOUT_CENTS / 100}
                              value={milestoneBonusTopReelsPayout}
                              onChange={(e) =>
                                setMilestoneBonusTopReelsPayout(e.target.value)
                              }
                              className={cn(
                                isDark
                                  ? "bg-[#180438] border border-gray-600"
                                  : "",
                              )}
                              placeholder="e.g. 50"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {parseFloat(totalBudget.toString() || "0") * 100 <
                  planFeatures.minContestBudget &&
                  (totalBudget.toString() || "0").length > 0 && (
                    <Alert
                      className={cn(
                        "border",
                        isDark
                          ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                          : "bg-[#F0E7FD] border-[#4A00BE] text-purple-700",
                      )}
                    >
                      <AlertDescription>
                        The minimum contest budget for your{" "}
                        {currentPlan?.name || "current"} plan is{" "}
                        {formatCurrencyFromCents(planFeatures.minContestBudget)}
                        . Please increase your total budget.
                      </AlertDescription>
                    </Alert>
                  )}
              </>
            ) : (
              <>
                <div className="space-y-6 py-4 px-1">
                  <h3 className="text-lg font-medium">
                    CPM Contest Configuration
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="cpmRatePrize">
                      {platform === "twitter" && contestFormat === "text_image"
                        ? "CPM Rate (USD per 1000 points)"
                        : "CPM Rate (USD)"}
                    </Label>
                    <Input
                      id="cpmRatePrize"
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
                            description:
                              platform === "twitter" &&
                              contestFormat === "text_image"
                                ? `CPM Rate must be at least $${MIN_CPM_RATE} per 1000 points.`
                                : `CPM Rate must be at least $${MIN_CPM_RATE} per 1000 views.`,
                            variant: "destructive",
                          });
                        } else if (value && numValue > MAX_CPM_RATE) {
                          setCpmRate(MAX_CPM_RATE.toString());
                          toast({
                            title: "CPM Rate Too High",
                            description:
                              platform === "twitter" &&
                              contestFormat === "text_image"
                                ? `CPM Rate cannot exceed $${MAX_CPM_RATE} per 1000 points.`
                                : `CPM Rate cannot exceed $${MAX_CPM_RATE} per 1000 views.`,
                            variant: "destructive",
                          });
                        }
                      }}
                      placeholder={
                        platform === "twitter" && contestFormat === "text_image"
                          ? "e.g., 4.00 for $4.00 per 1000 points"
                          : "e.g., 1.50 for $1.50 per 1000 views"
                      }
                      className={cn(
                        isDark
                          ? "bg-[#180438] border border-gray-600 text-white"
                          : "bg-white",
                      )}
                      min={MIN_CPM_RATE}
                      max={MAX_CPM_RATE}
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground">
                      {platform === "twitter" && contestFormat === "text_image"
                        ? `Amount paid to creators per 1000 points. Points are calculated from the metric weights below. Range: $${MIN_CPM_RATE} - $${MAX_CPM_RATE} per 1000 points.`
                        : `Amount paid to creators per 1000 views. Range: $${MIN_CPM_RATE} - $${MAX_CPM_RATE} per 1000 views.`}
                    </p>
                  </div>
                  {platform === "twitter" && contestFormat === "text_image" && (
                    <div className="space-y-3 mt-4">
                      <h4 className="text-md font-medium">
                        Twitter (X) CPM – Points Model
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Choose which metrics count and set how many points each
                        metric is worth. Payout is calculated from total points.
                      </p>

                      <div className="space-y-3">
                        {contentType !== "raid" && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <label className="flex items-center gap-2 text-sm">
                              <span>Likes</span>
                            </label>
                            <div className="sm:col-span-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={twitterPointsConfig.likesWeight}
                                onChange={(e) =>
                                  setTwitterPointsConfig((prev) => ({
                                    ...prev,
                                    likesWeight: e.target.value,
                                  }))
                                }
                                placeholder="e.g., 1"
                                className={cn(
                                  isDark
                                    ? "bg-[#180438] border border-gray-600 text-white"
                                    : "bg-white",
                                )}
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <label className="flex items-center gap-2 text-sm">
                              <span>Comments / Replies</span>
                            </label>
                            <div className="sm:col-span-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={cpmPointsConfig.comment_base_points}
                                onChange={(e) =>
                                  setCpmPointsConfig((prev) => ({
                                    ...prev,
                                    comment_base_points: e.target.value,
                                  }))
                                }
                                placeholder="e.g., 1"
                                className={cn(
                                  isDark
                                    ? "bg-[#180438] border border-gray-600 text-white"
                                    : "bg-white",
                                )}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-0 sm:ml-[calc(33.333%+0.75rem)]">
                            <Checkbox
                              id="showCommentMultipliers"
                              checked={showCommentMultipliers}
                              onCheckedChange={async (checked) => {
                                setShowCommentMultipliers(checked === true);
                                // Save to draft when checkbox is toggled
                                await saveCpmAsDraft();
                              }}
                            />
                            <Label
                              htmlFor="showCommentMultipliers"
                              className="text-sm cursor-pointer"
                            >
                              Keep all values set to 0 if you do not want to
                              award points for comment engagement.
                            </Label>
                          </div>
                          {showCommentMultipliers && (
                            <div className="ml-0 sm:ml-[calc(33.333%+0.75rem)] mt-3 p-4 border rounded-lg space-y-3">
                              <h5 className="text-sm font-medium">
                                Comment Engagement Multipliers
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="commentLikesMultiplier">
                                    Likes
                                  </Label>
                                  <Input
                                    id="commentLikesMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.comment_likes_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        comment_likes_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="commentRepliesMultiplier">
                                    Replies
                                  </Label>
                                  <Input
                                    id="commentRepliesMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.comment_replies_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        comment_replies_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="commentImpressionsMultiplier">
                                    Impressions
                                  </Label>
                                  <Input
                                    id="commentImpressionsMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    value={
                                      cpmPointsConfig.comment_impressions_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        comment_impressions_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="commentRetweetsMultiplier">
                                    Retweets
                                  </Label>
                                  <Input
                                    id="commentRetweetsMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.comment_retweets_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        comment_retweets_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="commentQuoteRepostsMultiplier">
                                    Quote Reposts
                                  </Label>
                                  <Input
                                    id="commentQuoteRepostsMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.comment_quote_reposts_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        comment_quote_reposts_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <label className="flex items-center gap-2 text-sm">
                              <span>Retweets</span>
                            </label>
                            <div className="sm:col-span-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={cpmPointsConfig.retweet_base_points}
                                onChange={(e) =>
                                  setCpmPointsConfig((prev) => ({
                                    ...prev,
                                    retweet_base_points: e.target.value,
                                  }))
                                }
                                placeholder="e.g., 5"
                                className={cn(
                                  isDark
                                    ? "bg-[#180438] border border-gray-600 text-white"
                                    : "bg-white",
                                )}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-0 sm:ml-[calc(33.333%+0.75rem)]">
                            <Checkbox
                              id="showRetweetMultipliers"
                              checked={showRetweetMultipliers}
                              onCheckedChange={async (checked) => {
                                setShowRetweetMultipliers(checked === true);
                                // Save to draft when checkbox is toggled
                                await saveCpmAsDraft();
                              }}
                            />
                            <Label
                              htmlFor="showRetweetMultipliers"
                              className="text-sm cursor-pointer"
                            >
                              Keep all values set to 0 if you do not want to
                              award points for retweet engagement
                            </Label>
                          </div>
                          {showRetweetMultipliers && (
                            <div className="ml-0 sm:ml-[calc(33.333%+0.75rem)] mt-3 p-4 border rounded-lg space-y-3">
                              <h5 className="text-sm font-medium">
                                Retweet Engagement Multipliers
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="retweetLikesMultiplier">
                                    Likes
                                  </Label>
                                  <Input
                                    id="retweetLikesMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.retweet_likes_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        retweet_likes_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="retweetRepliesMultiplier">
                                    Replies
                                  </Label>
                                  <Input
                                    id="retweetRepliesMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.retweet_replies_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        retweet_replies_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="retweetImpressionsMultiplier">
                                    Impressions
                                  </Label>
                                  <Input
                                    id="retweetImpressionsMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    value={
                                      cpmPointsConfig.retweet_impressions_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        retweet_impressions_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="retweetRetweetsMultiplier">
                                    Retweets
                                  </Label>
                                  <Input
                                    id="retweetRetweetsMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.retweet_retweets_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        retweet_retweets_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="retweetQuoteRepostsMultiplier">
                                    Quote Reposts
                                  </Label>
                                  <Input
                                    id="retweetQuoteRepostsMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.retweet_quote_reposts_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        retweet_quote_reposts_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <label className="flex items-center gap-2 text-sm">
                              <span>Reposts / Quotes</span>
                            </label>
                            <div className="sm:col-span-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={cpmPointsConfig.quote_repost_base_points}
                                onChange={(e) =>
                                  setCpmPointsConfig((prev) => ({
                                    ...prev,
                                    quote_repost_base_points: e.target.value,
                                  }))
                                }
                                placeholder="e.g., 10"
                                className={cn(
                                  isDark
                                    ? "bg-[#180438] border border-gray-600 text-white"
                                    : "bg-white",
                                )}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-0 sm:ml-[calc(33.333%+0.75rem)]">
                            <Checkbox
                              id="showQuoteRepostMultipliers"
                              checked={showQuoteRepostMultipliers}
                              onCheckedChange={async (checked) => {
                                setShowQuoteRepostMultipliers(checked === true);
                                // Save to draft when checkbox is toggled
                                await saveCpmAsDraft();
                              }}
                            />
                            <Label
                              htmlFor="showQuoteRepostMultipliers"
                              className="text-sm cursor-pointer"
                            >
                              Keep all values set to 0 if you do not want to
                              award points for quote repost engagement.
                            </Label>
                          </div>
                          {showQuoteRepostMultipliers && (
                            <div className="ml-0 sm:ml-[calc(33.333%+0.75rem)] mt-3 p-4 border rounded-lg space-y-3">
                              <h5 className="text-sm font-medium">
                                Quote Repost Engagement Multipliers
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="quoteRepostLikesMultiplier">
                                    Likes
                                  </Label>
                                  <Input
                                    id="quoteRepostLikesMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.quote_repost_likes_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        quote_repost_likes_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="quoteRepostRepliesMultiplier">
                                    Replies
                                  </Label>
                                  <Input
                                    id="quoteRepostRepliesMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.quote_repost_replies_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        quote_repost_replies_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="quoteRepostImpressionsMultiplier">
                                    Impressions
                                  </Label>
                                  <Input
                                    id="quoteRepostImpressionsMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    value={
                                      cpmPointsConfig.quote_repost_impressions_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        quote_repost_impressions_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="quoteRepostRetweetsMultiplier">
                                    Retweets
                                  </Label>
                                  <Input
                                    id="quoteRepostRetweetsMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.quote_repost_retweets_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        quote_repost_retweets_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="quoteRepostQuoteRepostsMultiplier">
                                    Quote Reposts
                                  </Label>
                                  <Input
                                    id="quoteRepostQuoteRepostsMultiplier"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={
                                      cpmPointsConfig.quote_repost_quote_reposts_multiplier
                                    }
                                    onChange={(e) =>
                                      setCpmPointsConfig((prev) => ({
                                        ...prev,
                                        quote_repost_quote_reposts_multiplier:
                                          e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      isDark
                                        ? "bg-[#180438] border border-gray-600 text-white"
                                        : "bg-white",
                                    )}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {contentType !== "raid" && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <label className="flex items-center gap-2 text-sm">
                              <span>Views</span>
                            </label>
                            <div className="sm:col-span-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={twitterPointsConfig.impressionsWeight}
                                onChange={(e) =>
                                  setTwitterPointsConfig((prev) => ({
                                    ...prev,
                                    impressionsWeight: e.target.value,
                                  }))
                                }
                                placeholder="e.g., 0.001"
                                className={cn(
                                  isDark
                                    ? "bg-[#180438] border border-gray-600 text-white"
                                    : "bg-white",
                                )}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {platform === "twitter" && contestFormat === "text_image" ? (
                    <Alert
                      className={cn(
                        "border",
                        isDark
                          ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                          : "bg-[#F0E7FD] border-[#4A00BE] text-purple-700",
                      )}
                    >
                      <AlertDescription>
                        Twitter CPM contests use the{" "}
                        <strong>Points Model</strong>. Payout is calculated
                        based on total points earned and the CPM rate per 1,000
                        points.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="minViewsPrize">
                          Minimum Views (Optional)
                        </Label>
                        <Input
                          id="minViewsPrize"
                          type="number"
                          className={cn(
                            isDark
                              ? "bg-[#180438] border border-gray-600 text-white"
                              : "bg-white",
                          )}
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
                          placeholder={`e.g., ${FORM_PLACEHOLDER_SMALL_AMOUNT}`}
                          min="0"
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum views required for a submission to be eligible
                          for payment.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxViewsPrize">
                          Maximum Views (Optional)
                        </Label>
                        <Input
                          id="maxViewsPrize"
                          type="number"
                          value={maxViews}
                          className={cn(
                            isDark
                              ? "bg-[#180438] border border-gray-600 text-white"
                              : "bg-white",
                          )}
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
                          placeholder={`e.g., ${FORM_PLACEHOLDER_LARGE_AMOUNT}`}
                          min="0"
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum views for which a submission will be paid.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="totalBudgetPrize">
                      Total Contest Budget (USD){" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="totalBudgetPrize"
                      type="number"
                      required
                      className={cn(
                        isDark
                          ? "bg-[#180438] border border-gray-600 text-white"
                          : "bg-white",
                      )}
                      value={totalBudget} // This is a string from state, input type handles conversion
                      onChange={(e) => {
                        const newBudgetString = e.target.value;
                        setTotalBudget(newBudgetString); // Keep as string for input
                      }}
                      placeholder={`e.g., ${FORM_PLACEHOLDER_SMALL_AMOUNT}`}
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Required: The maximum total amount to be paid out for this
                      contest. This is the effective prize pool.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="termsConditionsPrize">
                      Terms & Conditions
                    </Label>
                    <Textarea
                      id="termsConditionsPrize"
                      value={termsConditions}
                      onChange={(e) => setTermsConditions(e.target.value)}
                      className={cn(
                        isDark
                          ? "bg-[#180438] border border-gray-600 text-white"
                          : "bg-white",
                      )}
                      placeholder="Enter or paste your contest terms and conditions for CPM participants. This will be shown to them before they can submit."
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Specific rules and agreements for CPM participants.
                    </p>
                  </div>
                </div>
                {/* Min budget alert for CPM */}
                {/* Ensure totalBudget is treated as a number for comparison, and it has a value */}
                {parseFloat(totalBudget.toString() || "0") * 100 <
                  planFeatures.minContestBudget &&
                  (totalBudget.toString() || "0").length > 0 && (
                    <Alert
                      className={cn(
                        "border",
                        isDark
                          ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                          : "bg-[#F0E7FD] border-[#4A00BE] text-purple-700",
                      )}
                    >
                      <AlertDescription>
                        The minimum contest budget for your{" "}
                        {currentPlan?.name || "current"} plan is{" "}
                        {formatCurrencyFromCents(planFeatures.minContestBudget)}
                        . Please increase your total budget.
                      </AlertDescription>
                    </Alert>
                  )}
              </>
            )}

            {/* Creator earning opportunities */}
            {true && (
              <div className="space-y-6 py-6 px-0 sm:px-2 border-t-2 border-dashed mt-6">
              <div>
                <h3
                  className={cn(
                    "text-xl font-semibold mb-4",
                    isDark ? "text-white" : "text-purple-600",
                  )}
                >
                  💰 Creator Earning Opportunities
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Motivate creators with additional earning opportunities beyond
                  the main prize pool or CPM rate.
                </p>
              </div>

              {contestType !== "milestone" && (
                <>
                  {/* Flat Fee Bonus */}
                  <div
                    className={`space-y-3 p-4 border rounded-lg ${
                      isDark
                        ? "bg-green-950/40 border-green-800"
                        : "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎁</span>
                      <Label
                        htmlFor="flatFeeBonus"
                        className="text-base font-semibold"
                      >
                        Flat Fee Bonus (Per Verified Submission)
                      </Label>
                    </div>
                    <Input
                      id="flatFeeBonus"
                      type="number"
                      min="0"
                      step="0.01"
                      value={flatFeeBonus}
                      onChange={(e) => setFlatFeeBonus(e.target.value)}
                      placeholder="e.g., 10 for $10 per submission"
                      className={cn(
                        isDark
                          ? "bg-green-950/40 border border-gray-600 text-white"
                          : "bg-white",
                      )}
                    />
                    <p className="text-sm text-muted-foreground">
                      Optional: Give creators a guaranteed payment for each
                      verified submission, regardless of views or ranking. This
                      bonus is paid after the contest ends. Great for encouraging
                      participation!
                    </p>
                    {flatFeeBonus && parseFloat(flatFeeBonus.toString()) > 0 && (
                      <Alert
                        className={cn(
                          "border",
                          isDark
                            ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                            : "bg-[#F0E7FD] border-[#4A00BE] text-green-800",
                        )}
                      >
                        <AlertDescription>
                          ✓ Creators will earn{" "}
                          <strong>
                            ${parseFloat(flatFeeBonus.toString()).toFixed(2)}
                          </strong>{" "}
                          for each verified submission!
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

              {/* Flat Fee Bonus Cap (Only for CPM contests with flat fee bonus) */}
              {contestType === "cpm" &&
                flatFeeBonus &&
                parseFloat(flatFeeBonus.toString()) > 0 && (
                  <div
                    className={cn(
                      "space-y-3 p-4 border rounded-lg",
                      isDark
                        ? "bg-purple-950/40 border-purple-800"
                        : "bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💰</span>
                      <Label
                        htmlFor="flatFeeBonusCap"
                        className="text-base font-semibold"
                      >
                        Flat Fee Bonus Cap{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                    </div>
                    <Input
                      id="flatFeeBonusCap"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={flatFeeBonusCap}
                      onChange={(e) => setFlatFeeBonusCap(e.target.value)}
                      placeholder="e.g., 20 for $20 total cap"
                      className={cn(
                        isDark
                          ? "bg-[#180438] border border-gray-600 text-white"
                          : "bg-white text-black",
                      )}
                    />
                    <p className="text-sm text-muted-foreground">
                      Required: Maximum total flat fee bonus to distribute
                      across all creators. Once this cap is reached, no more
                      flat fee bonuses will be given. Must not exceed Total
                      Budget.
                    </p>
                    {flatFeeBonusCap &&
                      parseFloat(flatFeeBonusCap.toString()) > 0 && (
                        <Alert
                          className={cn(
                            isDark
                              ? "bg-purple-900/30 border-purple-900"
                              : "bg-purple-100 border-purple-300",
                          )}
                        >
                          <AlertDescription>
                            ✓ Maximum flat fee bonus cap set to{" "}
                            <strong>
                              $
                              {parseFloat(flatFeeBonusCap.toString()).toFixed(
                                2,
                              )}
                            </strong>
                            . Once this amount is distributed, no more flat fee
                            bonuses will be given.
                          </AlertDescription>
                        </Alert>
                      )}
                  </div>
                )}

              {/* Total Budget for Bonuses (Only for Leaderboard contests with flat fee bonus) */}
              {contestType === "leaderboard" &&
                flatFeeBonus &&
                parseFloat(flatFeeBonus.toString()) > 0 && (
                  <div
                    className={cn(
                      "space-y-3 p-4 border rounded-lg",
                      isDark
                        ? "bg-blue-950/50 border-blue-800"
                        : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💰</span>
                      <Label
                        htmlFor="totalBudget"
                        className="text-base font-semibold"
                      >
                        Total Budget for Bonuses{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                    </div>
                    <Input
                      id="totalBudget"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={totalBudget}
                      onChange={(e) => setTotalBudget(e.target.value)}
                      placeholder="e.g., 500 for $500 total budget"
                      className={cn(
                        isDark
                          ? "bg-[#180438] border border-gray-600 text-white"
                          : "bg-white text-black",
                      )}
                    />
                    <p className="text-sm text-muted-foreground">
                      Required: Set a budget limit for flat fee bonuses. This
                      budget is required when Flat Fee Bonus is enabled.
                      <br />
                      <strong>Prize Pool:</strong>{" "}
                      {formatCurrencyFromCents(totalPrizePool)} (for rankings)
                      <br />
                      <strong>Total Budget:</strong>{" "}
                      {totalBudget
                        ? `$${parseFloat(totalBudget.toString()).toFixed(2)}`
                        : "No limit"}{" "}
                      (for bonuses & extras)
                    </p>
                    {totalBudget && parseFloat(totalBudget.toString()) > 0 && (
                      <Alert
                        className={cn(
                          isDark
                            ? "bg-blue-900/30 border-blue-900"
                            : "bg-blue-100 border-blue-300",
                        )}
                      >
                        <AlertDescription
                          className={cn(
                            isDark ? "text-blue-200" : "text-blue-800",
                          )}
                        >
                          ✓ Budget set to{" "}
                          <strong>
                            ${parseFloat(totalBudget.toString()).toFixed(2)}
                          </strong>{" "}
                          for bonuses and extras!
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                  {/* Max Earnings Per Creator */}
                  {multipleSubmissionsEnabled && (
                    <div
                      className={cn(
                        "space-y-3 p-4 border rounded-lg",
                        isDark
                          ? "bg-blue-950/50 border-blue-800"
                          : "bg-blue-50 border-blue-200",
                      )}
                    >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎯</span>
                    <Label
                      htmlFor="maxEarnings"
                      className="text-base font-semibold"
                    >
                      Maximum Earnings Per Creator (Optional)
                    </Label>
                  </div>
                  <Input
                    id="maxEarnings"
                    type="number"
                    min="0"
                    step="0.01"
                    value={maxEarningsPerCreator}
                    className={cn(
                      isDark
                        ? "bg-[#180438] border border-gray-600 text-white"
                        : "bg-white text-black",
                    )}
                    onChange={(e) => setMaxEarningsPerCreator(e.target.value)}
                    placeholder="e.g., 500 for $500 max per creator"
                  />
                  <p className="text-sm text-muted-foreground">
                    Set a maximum earning cap per creator for{" "}
                    <strong>THIS CONTEST ONLY</strong>. Once reached, they can
                    still submit but won't earn more from this campaign. This
                    does NOT affect their earnings from other contests on the
                    platform. Helps ensure fair reward distribution within this
                    campaign.
                  </p>
                  {maxEarningsPerCreator &&
                    parseFloat(maxEarningsPerCreator.toString()) > 0 && (
                      <Alert
                        className={cn(
                          isDark
                            ? "bg-blue-900/30 border-blue-900"
                            : "bg-blue-100 border-blue-300",
                        )}
                      >
                        <AlertDescription
                          className={cn(
                            isDark ? "text-blue-200" : "text-blue-800",
                          )}
                        >
                          ℹ️ Each creator can earn up to{" "}
                          <strong>
                            $
                            {parseFloat(
                              maxEarningsPerCreator.toString(),
                            ).toFixed(2)}
                          </strong>{" "}
                          from this contest.
                        </AlertDescription>
                      </Alert>
                    )}
                    </div>
                  )}
                </>
              )}

              {/* Additional Bonus Section */}
              <div
                className={cn(
                  "space-y-3 p-4 border rounded-lg",
                  isDark
                    ? "bg-purple-950/50 border-purple-800"
                    : "bg-purple-50 border-purple-200",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🏆</span>
                    <Label
                      htmlFor="bonusToggle"
                      className="text-base font-semibold"
                    >
                      Additional Bonus Opportunities
                    </Label>
                  </div>
                  <Checkbox
                    id="bonusToggle"
                    checked={bonusEnabled}
                    onCheckedChange={(checked) =>
                      setBonusEnabled(checked === true)
                    }
                    className="h-5 w-5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 data-[state=checked]:text-white"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Offer additional bonuses that you'll handle manually (e.g.,
                  top creators bonus, affiliate commissions, special rewards).
                </p>

                {bonusEnabled && (
                  <div className="space-y-3 pt-3 border-t border-purple-300">
                    <div className="flex items-center justify-between">
                      <Label>Bonus Details</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={toggleBonusPreview}
                        className="text-xs"
                      >
                        {showBonusPreview ? "Edit" : "Preview"}
                      </Button>
                    </div>

                    {showBonusPreview ? (
                      <div
                        className={cn(
                          "prose max-w-none p-4 border rounded-lg min-h-[200px]",
                          isDark
                            ? "bg-[#180438] border-gray-600 text-white"
                            : "bg-white",
                        )}
                      >
                        <div dangerouslySetInnerHTML={{ __html: bonusHtml }} />
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg border">
                        <NovelEditor
                          value={bonusHtml}
                          isDark={isDark}
                          enableImages={false}
                          placeholder="Example:
• Top 3 creators get $100 each
• Affiliate link available: https://yoursite.com/ref - 10% commission on sales  
• Most creative submission gets an extra $50 bonus
• Special reward for first 10 submissions"
                          height="250px"
                          ref={bonusRichTextEditorRef}
                          onChange={(html: string, json: any) => {
                            setBonusHtml(html);
                            setBonusJson(json);
                          }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Describe all additional bonus opportunities. These will be
                      visible to creators and handled manually by you. Use
                      formatting, links, and bullet points to make it clear!
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}

            <CardFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-6">
              {/* Modern Error Display for Prize step */}
              {formFeedback && formFeedbackType === "error" && (
                <div className="w-full sm:w-auto sm:mr-auto">
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
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isLoading}
                className={cn(
                  "w-full sm:w-auto",
                  !(formFeedback && formFeedbackType === "error")
                    ? cn(
                        "sm:mr-auto border font-semibold px-4 py-2 rounded-lg text-md",
                        isDark
                          ? "text-white bg-[#170337] border-gray-400"
                          : "border-[#4A00BE] bg-white text-[#4A00BE]",
                      )
                    : "",
                )}
              >
                Back
              </Button>
              <div
                className={`flex flex-col sm:flex-row gap-3 w-full sm:w-auto ${
                  formFeedback && formFeedbackType === "error"
                    ? "sm:ml-4"
                    : "sm:ml-auto"
                }`}
              >
                <button
                  className={cn(
                    "border font-semibold px-4 py-2 rounded-lg text-md t w-full sm:w-auto",
                    isDark
                      ? "text-white border-gray-400"
                      : "border-[#4A00BE] bg-white text-[#4A00BE]",
                  )}
                  onClick={handleSaveDraft}
                  disabled={isLoading || !title.trim()}
                >
                  {isLoading &&
                  uploadProgress &&
                  uploadProgress.includes("draft") ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span>{uploadProgress}</span>
                      <Progress
                        value={uploadProgress ? 70 : 0}
                        className="w-10 h-2"
                      />
                    </div>
                  ) : (
                    "Save Draft"
                  )}
                </button>
                <Button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={
                    isLoading ||
                    !startDate ||
                    !startTime ||
                    !endDate ||
                    !endTime
                  }
                  className={cn(
                    "px-5 py-4 rounded-lg transition w-full sm:w-auto",
                    isDark ? "bg-[#7F39EC]" : "bg-[#4A00BE]",
                  )}
                >
                  {isLoading &&
                  uploadProgress &&
                  !uploadProgress.includes("draft") ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{uploadProgress}</span>
                      <Progress
                        value={
                          uploadProgress.includes("Preparing")
                            ? 15
                            : uploadProgress.includes("Validating")
                              ? 25
                              : uploadProgress.includes("1/2")
                                ? 40
                                : uploadProgress.includes("2/2")
                                  ? 60
                                  : uploadProgress.includes("Creating")
                                    ? 80
                                    : uploadProgress.includes("submitted")
                                      ? 100
                                      : 10
                        }
                        className="w-10 h-2"
                      />
                    </div>
                  ) : (
                    "Submit for Review"
                  )}
                </Button>
              </div>
            </CardFooter>
          </div>
        </div>
      </>
    );
  };

  // Modify the clearResources function

  // Create a utility function to clean up all contest assets
  const cleanupContestAssets = async (contestId: string) => {
    try {
      try {
        const { data: resourceFiles, error: resourceError } =
          await supabase.storage
            .from("contest-assets")
            .list(`contest_resources/${contestId}`);
        if (resourceError) {
          console.error("Error listing resource files:", resourceError);
        } else if (resourceFiles && resourceFiles.length > 0) {
          const resourceFilePaths = resourceFiles.map(
            (file) => `contest_resources/${contestId}/${file.name}`,
          );
          await supabase.storage
            .from("contest-assets")
            .remove(resourceFilePaths);
        }
      } catch (err) {
        console.error("Error deleting resource files:", err);
      }
      // Delete all thumbnails for this contest (all extensions)
      try {
        const { data: thumbnailFiles, error: thumbnailError } =
          await supabase.storage
            .from("contest-assets")
            .list("contest_thumbnails");
        if (thumbnailError) {
          console.error("Error listing thumbnail files:", thumbnailError);
        } else if (thumbnailFiles && thumbnailFiles.length > 0) {
          const matching = thumbnailFiles.filter((f) =>
            f.name.startsWith(`${contestId}_`),
          );
          if (matching.length > 0) {
            const thumbnailFilePaths = matching.map(
              (f) => `contest_thumbnails/${f.name}`,
            );
            await supabase.storage
              .from("contest-assets")
              .remove(thumbnailFilePaths);
          }
        }
      } catch (err) {
        console.error("Error deleting thumbnail files:", err);
      }
    } catch (error) {
      console.error("Error cleaning up contest assets:", error);
    }
  };

  // Add this state for drag feedback
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleThumbnailChange({ target: { files: e.dataTransfer.files } } as any);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const addInspiration = () => {
    setInspirationError(null);
    // For Twitter raid campaigns, allow only a single campaign tweet
    if (isRaidTwitter && inspirationLinks.length >= 1) {
      return;
    }
    if (!newInspirationUrl.trim()) {
      setInspirationError("URL cannot be empty.");
      toast({
        title: "Invalid Input",
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
          title: "Invalid URL",
          description: "URL must start with https://",
          variant: "destructive",
        });
        return;
      }
    } catch {
      setInspirationError("Invalid URL format.");
      toast({
        title: "Invalid URL",
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
          link.description === newInspirationDescription,
      )
    ) {
      setInspirationError(
        "This inspiration link and description have already been added. Please use a different link or description.",
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
        "This inspiration link has already been added. Please use a different link.",
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

  // Add this function near your other handlers:
  const handleResourceDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (file.size > maxSize) {
        setAssetUploadError(
          "File must be 20MB or smaller. Please choose a smaller file.",
        );
        return;
      }
      const description = prompt("Enter a description for this asset:");
      if (!description || !description.trim()) {
        setAssetUploadError("Asset description is required.");
        return;
      }
      if (resources.some((r) => r.description === description.trim())) {
        setAssetUploadError(
          `A resource with the description \"${description.trim()}\" already exists. Please use a unique description.`,
        );
        return;
      }
      if (!user?.id) {
        setAssetUploadError("User not authenticated. Please sign in again.");
        return;
      }
      try {
        setIsUploadingAsset(true);
        let currentContestId = contestId || draftId;
        if (!currentContestId) {
          const newContestId = await createDraftContest();
          if (newContestId) {
            setContestId(newContestId);
            setDraftId(newContestId);
            currentContestId = newContestId;
          }
        }
        // Use per-contest folder
        const fileName = `contest_resources/${currentContestId}/${file.name.replace(
          /\s+/g,
          "_",
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
        if (currentContestId) {
          await updateContestInDB({ resources: newResources });
        }
        setAssetUploadError(null);
        toast({
          title: "Success",
          description: "Asset uploaded successfully!",
        });
      } catch (error: any) {
        console.error("Error uploading resource:", error);
        setAssetUploadError(`Failed to upload asset: ${error.message}`);
      } finally {
        setIsUploadingAsset(false);
      }
    }
  };

  // Handler for Back to Contests button
  // const handleBackToContests = (e?: React.MouseEvent) => {
  //   if (e) e.preventDefault();
  //   setShowBackModal(true);
  // };

  useEffect(() => {
    // Push dummy state so we can trap the back button (preserve query string)
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      setShowBackModal(true); // ✅ Show modal instead of navigating
      // Push dummy state again to cancel the back navigation
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // In-app Back button → show modal
  const handleBackToContests = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setShowBackModal(true);
  };

  // Handler for Save as Draft in modal
  const handleSaveDraftAndBack = async () => {
    await handleSaveDraft();
    router.push("/dashboard/contests");
  };

  // Handler for Delete in modal
  const handleDeleteAndBack = async () => {
    if (!contestId) {
      router.push("/dashboard/contests");
      return;
    }
    setIsDeleting(true);
    try {
      await cleanupContestAssets(contestId);
      // Delete contest from DB
      await supabase.from("contests").delete().eq("id", contestId);
    } catch (err) {
      console.error("Error deleting contest and assets:", err);
    } finally {
      setIsDeleting(false);
      router.push("/dashboard/contests");
    }
  };

  // Upgrade modal handlers
  const handleSaveDraftAndUpgrade = async () => {
    setShowUpgradeModal(false);
    try {
      // Save current progress as draft first
      await handleSaveDraft();
      // Then redirect to pricing page
      router.push("/pricing");
    } catch (error) {
      console.error("Error saving draft before upgrade:", error);
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpgradeWithoutSaving = () => {
    setShowUpgradeModal(false);
    // Direct redirect to pricing page without saving
    router.push("/pricing");
  };

  const handleCancelUpgrade = () => {
    setShowUpgradeModal(false);
  };

  // Refresh protection handlers
  const handleRefreshWarning = () => {
    if (hasUnsavedChanges) {
      setShowRefreshWarning(true);
    }
  };

  const handleConfirmRefresh = () => {
    setShowRefreshWarning(false);
    setHasUnsavedChanges(false);
    window.location.reload();
  };

  const handleCancelRefresh = () => {
    setShowRefreshWarning(false);
  };

  // Custom Back Modal component
  const BackModal = () => (
    <div
      className={cn(
        "fixed inset-0 bg-opacity-65 flex items-center justify-center z-50",
        isDark ? "bg-[#100A33]" : "bg-black",
      )}
    >
      <div
        className={cn(
          "rounded-lg p-6 max-w-md w-full shadow-xl",
          isDark ? "bg-[#06021D]  border border-gray-800" : "bg-white",
        )}
      >
        <h2 className="text-xl font-bold mb-4">Leave Contest Creation?</h2>
        <p className="mb-6">
          Do you want to save this contest as a draft or delete it? All progress
          will be lost if you delete.
        </p>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBackModal(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAndBack}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
          <Button onClick={handleSaveDraftAndBack} disabled={isDeleting}>
            Save as Draft
          </Button>
        </div>
      </div>
    </div>
  );

  // Upgrade Modal component
  const UpgradeModal = () => (
    <div
      className={cn(
        "fixed inset-0 bg-opacity-65 flex items-center justify-center z-50",
        isDark ? "bg-[#100A33]" : "bg-black",
      )}
    >
      <div
        className={cn(
          "rounded-lg p-6 max-w-lg w-full shadow-xl",
          isDark
            ? "bg-[#06021D] border border-gray-800 text-white"
            : "bg-white text-black",
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isDark
                ? "bg-[#FFFFFF36] text-white"
                : "bg-purple-200 text-purple-600",
            )}
          >
            <Trophy className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold">Upgrade Your Plan</h2>
        </div>
        <p className="mb-6">
          You have unsaved contest data. Would you like to save your progress
          before upgrading your plan?
        </p>
        <div className="space-y-4">
          <Button
            onClick={handleSaveDraftAndUpgrade}
            className={cn(
              "w-full text-md rounded-full font-semibold",
              isDark
                ? "bg-[#7F39EC] py-3 text-white"
                : " bg-[#D9C0FF61] py-4 text-[#7F39EC] ",
            )}
          >
            Save Draft & Upgrade
          </Button>
          <Button
            variant="outline"
            onClick={handleUpgradeWithoutSaving}
            className={cn(
              "w-full border text-md py-3 rounded-full",
              isDark
                ? "border-gray-400 text-gray-300"
                : "border-[#7F39EC] text-[#7F39EC]",
            )}
          >
            Upgrade without saving draft
          </Button>
          <Button
            variant="outline"
            onClick={handleCancelUpgrade}
            className={cn(
              "w-full rounded-full text-md",
              isDark
                ? "border-[#FF5353] text-[#FF5353]"
                : "border-[#FF323224] bg-[#FF323224] text-[#E50000]",
            )}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  // Refresh Warning Modal
  const RefreshWarningModal = () => (
    <div
      className={cn(
        "fixed inset-0 bg-opacity-65 flex items-center justify-center z-50",
        isDark ? "bg-[#100A33]" : "bg-black",
      )}
    >
      <div
        className={cn(
          "rounded-lg p-6 max-w-md w-full shadow-xl",
          isDark
            ? "bg-[#06021D] border border-gray-800 text-white"
            : "bg-white text-black",
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl font-bold">Unsaved Changes</h2>
        </div>
        <p className="mb-6">
          You have unsaved changes. Refreshing the page will lose all your
          progress. What would you like to do?
        </p>
        <div className="space-y-3">
          <Button
            onClick={handleSaveDraftAndBack}
            className={cn(
              "w-full text-md rounded-full font-semibold",
              isDark
                ? "bg-[#7F39EC] py-3 text-white"
                : " bg-[#D9C0FF61] py-4 text-[#7F39EC] ",
            )}
          >
            Save Draft
          </Button>
          <Button
            variant="outline"
            onClick={handleConfirmRefresh}
            className={cn(
              "w-full border text-md py-3 rounded-full",
              isDark
                ? "border-gray-400 text-gray-300"
                : "border-[#7F39EC] text-[#7F39EC]",
            )}
          >
            Refresh Anyway
          </Button>
          <Button
            variant="ghost"
            onClick={handleCancelRefresh}
            className={cn(
              "w-full rounded-full text-md",
              isDark
                ? "border-[#FF5353] text-[#FF5353]"
                : "border-[#FF323224] bg-[#FF323224] text-[#E50000]",
            )}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-8 bg-background text-foreground no-theme-transition">
      {/* Prevent theme flash during navigation */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var html = document.documentElement;
                var getTheme = function() {
                  // Check data-theme attribute first
                  var dataTheme = html.getAttribute('data-theme');
                  if (dataTheme === 'dark' || dataTheme === 'light') {
                    return dataTheme;
                  }
                  
                  // Check data-mode attribute
                  var modeElement = document.querySelector('[data-mode]');
                  if (modeElement) {
                    var dataMode = modeElement.getAttribute('data-mode');
                    if (dataMode === 'dark' || dataMode === 'light') {
                      return dataMode;
                    }
                  }
                  
                  // Check localStorage
                  try {
                    var savedMode = localStorage.getItem('dashboard-mode');
                    if (savedMode === 'dark' || savedMode === 'light') {
                      return savedMode;
                    }
                    
                    var preset = localStorage.getItem('dashboard-preset');
                    if (preset === 'game-of-creators' || preset === 'dark-professional') {
                      return 'dark';
                    }
                  } catch(e) {}
                  
                  return 'light';
                };
                
                var theme = getTheme();
                html.setAttribute('data-theme', theme);
                if (theme === 'dark') {
                  html.style.backgroundColor = '#07031E';
                  html.style.color = 'rgb(248, 250, 252)';
                } else {
                  html.style.backgroundColor = '#ffffff';
                  html.style.color = '#111827';
                }
              } catch(e) {}
            })();
          `,
        }}
      />
      {/* Enhanced Header with Better Back Button */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            asChild={false}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200"
            onClick={handleBackToContests}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Back to Contests</span>
          </Button>
        </div>
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Create New Contest
          </h1>
          <p className="text-muted-foreground text-lg">
            Build your contest in 4 simple steps
          </p>
        </div>
      </div>

      {/* Modern Progress Stepper */}
      <div className="mb-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Desktop Stepper */}
          <div className="hidden md:block">
            <div className="relative">
              {/* Background Progress Line */}
              <div className="absolute top-8 left-0 right-0 h-2 bg-[#E9E9E9] rounded-full">
                <div
                  className="h-full rounded-full bg-purple-600 transition-all duration-700 ease-out"
                  style={{
                    width:
                      step === "basics"
                        ? "8%"
                        : step === "brief"
                          ? "35%"
                          : step === "resources"
                            ? "70%"
                            : "100%",
                    // background:
                    //   "linear-gradient(270deg, #E9E9E9 60%, #7F39EC 100%)",
                  }}
                ></div>
              </div>

              {/* Step Items */}
              <div className="relative flex justify-between">
                {[
                  {
                    key: "basics",
                    number: "1",
                    title: "Get Started",
                    description: "Basic information",
                  },
                  {
                    key: "brief",
                    number: "2",
                    title: "Create Brief",
                    description: "Project details",
                  },
                  {
                    key: "resources",
                    number: "3",
                    title: "Resources",
                    description: "Assets & links",
                  },
                  {
                    key: "prize",
                    number: "4",
                    title: "Prize",
                    description: "Rewards & timeline",
                  },
                ].map((stepItem, index) => {
                  const isActive = step === stepItem.key;
                  const isCompleted =
                    (stepItem.key === "basics" &&
                      (step === "brief" ||
                        step === "resources" ||
                        step === "prize")) ||
                    (stepItem.key === "brief" &&
                      (step === "resources" || step === "prize")) ||
                    (stepItem.key === "resources" && step === "prize");
                  const isUpcoming = !isActive && !isCompleted;

                  return (
                    <div
                      key={stepItem.key}
                      className="relative flex flex-col items-center group"
                    >
                      {/* Step Circle */}
                      <div className="relative">
                        {/* Glow Effect for Active Step */}
                        {isActive && (
                          <div className="absolute inset-0 bg-[#7F39EC] rounded-full blur-lg opacity-30 animate-pulse"></div>
                        )}

                        <div
                          className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                            isActive
                              ? "bg-[#7F39EC] border-[#7F39EC] text-white"
                              : isCompleted
                                ? "bg-[#7F39EC] border-[#7F39EC] text-white"
                                : isDark
                                  ? "bg-white border-white text-slate-500 shadow-md"
                                  : "bg-white border-slate-200 text-slate-400 shadow-md"
                          }`}
                        >
                          {isCompleted ? (
                            <svg
                              className="h-6 w-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <span className="text-lg font-bold">
                              {stepItem.number}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Step Content */}
                      <div className="mt-4 text-center max-w-32">
                        <h3
                          className={`text-[14px] font-semibold transition-colors duration-300 ${
                            isActive
                              ? isDark
                                ? "text-white"
                                : "text-black"
                              : isCompleted
                                ? isDark
                                  ? "text-white"
                                  : "text-black"
                                : isDark
                                  ? "text-slate-400 text-md"
                                  : "text-slate-500 text-md"
                          }`}
                        >
                          {stepItem.title}
                        </h3>
                        <p
                          className={`text-[12px] mt-1 transition-colors duration-300 ${
                            isActive
                              ? isDark
                                ? "text-white"
                                : "text-black"
                              : isCompleted
                                ? isDark
                                  ? "text-white"
                                  : "text-black"
                                : isDark
                                  ? "text-slate-400"
                                  : "text-slate-400"
                          }`}
                        >
                          {stepItem.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile Stepper */}
          <div className="md:hidden">
            <div
              className={cn(
                "rounded-xl p-4 shadow-lg border transition-colors duration-300",
                isDark
                  ? "bg-[#180438] border-[#3A2C63]"
                  : "bg-white border-slate-200",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7F39EC] text-white font-bold">
                    {step === "basics"
                      ? "1"
                      : step === "brief"
                        ? "2"
                        : step === "resources"
                          ? "3"
                          : "4"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {step === "basics"
                        ? "Get Started"
                        : step === "brief"
                          ? "Create Brief"
                          : step === "resources"
                            ? "Resources"
                            : "Prize"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Step{" "}
                      {step === "basics"
                        ? "1"
                        : step === "brief"
                          ? "2"
                          : step === "resources"
                            ? "3"
                            : "4"}{" "}
                      of 4
                    </p>
                  </div>
                </div>
              </div>

              {/* Mobile Progress Bar */}
              <div
                className={cn(
                  "h-2 rounded-full overflow-hidden transition-colors duration-300",
                  isDark ? "bg-[#2D1B55]" : "bg-slate-200",
                )}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isDark ? "bg-[#9C7BFF]" : "bg-[#7F39EC]",
                  )}
                  style={{ width: `${mobileProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-[1100px] mx-auto no-theme-transition">
        {/* Removed global success Alert (for draft save) that was at the top of the card */}

        {step === "basics" && (
          <>
            <div
              className={cn(
                "p-6 border-b rounded-tl-xl rounded-tr-xl shadow-xl space-y-6",
                isDark
                  ? "bg-[#180438] border-gray-600"
                  : "bg-white border-[#D0D0D0]",
              )}
            >
              <h2
                className={cn(
                  "font-semibold text-2xl ",
                  isDark ? "text-white" : "text-purple-600",
                )}
              >
                Customize your Contest
              </h2>
            </div>
            <div
              className={cn(
                "space-y-6 p-6 rounded-bl-xl rounded-br-xl shadow-xl",
                isDark ? "bg-[#180438]" : "bg-white",
              )}
            >
              {/* Removed general validationError Alert from CardContent */}

              {/* Contest Format Toggle */}
              <div className="space-y-2 ">
                <Label className="text-xl font-semibold">Contest Format</Label>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    type="button"
                    variant={
                      contestFormat === "text_image" ? "default" : "outline"
                    }
                    className={cn(
                      "flex-1 justify-center",
                      contestFormat === "text_image" &&
                        "bg-[#7F39EC] text-white",
                    )}
                    onClick={() => {
                      setContestFormat("text_image");
                      // Text/Image contests default to Twitter platform
                      if (platform !== "twitter") {
                        setPlatform("twitter");
                      }
                      // Instantly persist contest_format change
                      updateContestInDB({ contest_format: "text_image" });
                    }}
                  >
                    Text / Image Contest
                  </Button>
                  <Button
                    type="button"
                    variant={contestFormat === "video" ? "default" : "outline"}
                    className={cn(
                      "flex-1 justify-center",
                      contestFormat === "video" && "bg-[#7F39EC] text-white",
                    )}
                    onClick={() => {
                      setContestFormat("video");
                      // Default to YouTube when switching back to video if currently on Twitter
                      if (platform === "twitter") {
                        setPlatform("youtube");
                      }
                      // Instantly persist contest_format change
                      updateContestInDB({ contest_format: "video" });
                    }}
                  >
                    Video Contest
                  </Button>
                </div>
              </div>

              {/* Contest Type Selection */}
              <div className="space-y-2 ">
                <Label className="text-xl font-semibold">Contest Type</Label>
                <RadioGroup
                  value={contestType}
                  onValueChange={(
                    value: "leaderboard" | "cpm" | "milestone",
                  ) => {
                    const planFeatures = getPlanFeatures(userPlan);
                    const hasCpmAccess =
                      planFeatures.contestTypes &&
                      planFeatures.contestTypes.includes("cpm");

                    if (
                      (value === "cpm" || value === "milestone") &&
                      !hasCpmAccess
                    ) {
                      return;
                    }
                    if (value === "milestone" && contestFormat !== "video") {
                      return;
                    }
                    setContestType(value);
                  }}
                  className="flex flex-col lg:flex-row flex-wrap gap-3 lg:gap-4 pt-2"
                >
                  <div
                    className={`flex items-center space-x-2 p-4 border ${
                      isDark ? "border-gray-600" : "border-gray-300"
                    } rounded-lg cursor-pointer flex-1 
        hover:bg-[#D9C0FF26] 
        ${
          contestType === "leaderboard" ? "bg-[#D9C0FF26] border-[#7F39EC]" : ""
        }`}
                  >
                    <RadioGroupItem value="leaderboard" id="leaderboard" />
                    <Label htmlFor="leaderboard" className="cursor-pointer">
                      <span className="font-semibold text-lg">
                        Leaderboard Contest
                      </span>
                      <p className="text-[14px] leading-tight mt-[2px] text-muted-foreground">
                        Creators compete for top spots based on performance.
                        Prizes are awarded to winners.
                      </p>
                    </Label>
                  </div>
                  {(() => {
                    const planFeatures = getPlanFeatures(userPlan);
                    const hasCpmAccess =
                      planFeatures.contestTypes &&
                      planFeatures.contestTypes.includes("cpm");
                    const currentPlan = dbSubscriptionPlans.find(
                      (p) => p.id === userPlan,
                    );
                    const isFreePlan = !currentPlan || currentPlan.price === 0;

                    // CPM is allowed for:
                    // - Video contests (YouTube/Instagram)
                    // - Twitter text/image contests
                    const isDisabledForFormat = false;
                    const isDisabled = !hasCpmAccess || isDisabledForFormat;

                    return (
                      <div
                        className={`flex items-center space-x-2 p-4 border ${
                          isDark ? "border-gray-600" : "border-gray-300"
                        } rounded-lg flex-1 relative 
                        ${
                          isDisabled
                            ? isDark
                              ? "opacity-50 cursor-not-allowed bg-slate-800"
                              : "opacity-50 cursor-not-allowed bg-gray-50"
                            : `cursor-pointer hover:bg-[#D9C0FF26] ${
                                contestType === "cpm"
                                  ? "bg-[#D9C0FF26] border-[#7F39EC]"
                                  : ""
                              }`
                        }`}
                      >
                        <RadioGroupItem
                          value="cpm"
                          id="cpm"
                          disabled={isDisabled}
                        />
                        <Label
                          htmlFor="cpm"
                          className={
                            isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                          }
                        >
                          <span className="font-semibold text-lg">
                            CPM Based Contest
                          </span>
                          <p className="text-[14px] leading-tight mt-[2px] text-muted-foreground">
                            Creators are paid based on the number of views their
                            content receives, at a pre-defined CPM rate.
                          </p>
                          {isDisabledForFormat && (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                className={cn(
                                  "text-white text-md px-3 rounded-full py-1 h-8",
                                  isDark ? "bg-[#7F39EC]" : "bg-[#4A00BE]",
                                )}
                              >
                                Coming Soon
                              </button>
                              <p
                                className={cn(
                                  "text-sm font-medium",
                                  isDark ? "text-white" : "text-black",
                                )}
                              >
                                Not available for text/image contests
                              </p>
                            </div>
                          )}
                          {!hasCpmAccess && !isDisabledForFormat && (
                            <div className="mt-2 flex items-center gap-2">
                              {isFreePlan && (
                                <button
                                  className={cn(
                                    "text-white text-md px-3 rounded-full py-1 h-8",
                                    isDark ? "bg-[#7F39EC]" : "bg-[#4A00BE]",
                                  )}
                                >
                                  <Link href="/dashboard/billing?tab=subscription">
                                    Upgrade Plan
                                  </Link>
                                </button>
                              )}
                              <p
                                className={cn(
                                  "text-sm font-medium",
                                  isDark ? "text-white" : "text-black",
                                )}
                              >
                                Available in paid plans only
                              </p>
                            </div>
                          )}
                        </Label>
                        {/* {!hasCpmAccess && (
                          <div className="absolute top-2 right-2">
                            <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-full text-xs font-medium">
                              Premium
                            </span>
                          </div>
                        )} */}
                      </div>
                    );
                  })()}
                  {contestFormat === "video" &&
                    (() => {
                      const planFeatures = getPlanFeatures(userPlan);
                      const hasCpmAccess =
                        planFeatures.contestTypes &&
                        planFeatures.contestTypes.includes("cpm");
                      const currentPlan = dbSubscriptionPlans.find(
                        (p) => p.id === userPlan,
                      );
                      const isFreePlan = !currentPlan || currentPlan.price === 0;
                      const isDisabled = !hasCpmAccess;

                      return (
                        <div
                          className={`flex items-center space-x-2 p-4 border ${
                            isDark ? "border-gray-600" : "border-gray-300"
                          } rounded-lg flex-1 min-w-[220px] ${
                            isDisabled
                              ? isDark
                                ? "opacity-50 cursor-not-allowed bg-slate-800"
                                : "opacity-50 cursor-not-allowed bg-gray-50"
                              : `cursor-pointer hover:bg-[#D9C0FF26] ${
                                  contestType === "milestone"
                                    ? "bg-[#D9C0FF26] border-[#7F39EC]"
                                    : ""
                                }`
                          }`}
                        >
                          <RadioGroupItem
                            value="milestone"
                            id="milestone"
                            disabled={isDisabled}
                          />
                          <Label
                            htmlFor="milestone"
                            className={
                              isDisabled
                                ? "cursor-not-allowed"
                                : "cursor-pointer"
                            }
                          >
                            <span className="font-semibold text-lg">
                              Milestone Based Contest
                            </span>
                            <p className="text-[14px] leading-tight mt-[2px] text-muted-foreground">
                          Creators will be rewarded upon reaching milestone based on views, according to the defined view targets and payout for each milestone.
                            </p>
                            {!hasCpmAccess && (
                              <div className="mt-2 flex items-center gap-2">
                                {isFreePlan && (
                                  <button
                                    className={cn(
                                      "text-white text-md px-3 rounded-full py-1 h-8",
                                      isDark ? "bg-[#7F39EC]" : "bg-[#4A00BE]",
                                    )}
                                  >
                                    <Link href="/dashboard/billing?tab=subscription">
                                      Upgrade Plan
                                    </Link>
                                  </button>
                                )}
                                <p
                                  className={cn(
                                    "text-sm font-medium",
                                    isDark ? "text-white" : "text-black",
                                  )}
                                >
                                  Available in paid plans only
                                </p>
                              </div>
                            )}
                          </Label>
                        </div>
                      );
                    })()}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Add contest title</Label>
                <Input
                  id="title"
                  value={title}
                  className={cn(
                    isDark ? "bg-[#180438] border border-gray-600" : "bg-white",
                  )}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    clearToastError(); // Clear toast error when user starts typing
                  }}
                  placeholder="e.g., Create a Viral shorts/video for our New App"
                  maxLength={100}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">
                  {title.length} / 100
                </p>
              </div>

              <div>
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={platform}
                  onValueChange={(value) => {
                    setPlatform(value);
                    if (value === "twitter") {
                      // Default Twitter content type to Raid campaign
                      setContentType("raid");
                    }
                  }}
                >
                  <SelectTrigger
                    id="platform"
                    className={cn(
                      isDark
                        ? "bg-[#180438] border border-gray-600"
                        : "bg-white",
                    )}
                  >
                    <SelectValue placeholder="Select contest platform" />
                  </SelectTrigger>
                  <SelectContent isDark={isDark}>
                    {contestFormat === "text_image" ? (
                      <SelectItem isDark={isDark} value="twitter">
                        Twitter
                      </SelectItem>
                    ) : (
                      <>
                        <SelectItem isDark={isDark} value="youtube">
                          YouTube
                        </SelectItem>
                        <SelectItem isDark={isDark} value="instagram">
                          Instagram
                        </SelectItem>
                        <SelectItem isDark={isDark} value="tiktok">
                          TikTok
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose the platform where creators will submit content.
                </p>
              </div>

              {/* Content Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="contentType">Content Type</Label>
                <Select
                  value={contentType}
                  onValueChange={(value: any) => setContentType(value)}
                >
                  <SelectTrigger
                    id="contentType"
                    className={cn(
                      isDark ? "border-gray-600" : "border-gray-300",
                    )}
                  >
                    <SelectValue placeholder="Select content type (optional)" />
                  </SelectTrigger>
                  <SelectContent isDark={isDark}>
                    {platform === "twitter" ? (
                      <>
                        <SelectItem value="raid" isDark={isDark}>
                          ⚔️ Raid (creators like/comment your tweet)
                        </SelectItem>
                        <SelectItem value="awareness" isDark={isDark}>
                          📣 Awareness (creators post their own tweet)
                        </SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="ugc" isDark={isDark}>
                          📹 UGC (User Generated Content)
                        </SelectItem>
                        <SelectItem value="clipping" isDark={isDark}>
                          ✂️ Clipping (Short clips/repurposed content)
                        </SelectItem>
                        <SelectItem value="other" isDark={isDark}>
                          📋 Other (Check Rules for details)
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Specify the type of content you need from creators. This helps
                  creators filter opportunities.
                </p>
              </div>

              {/* Multiple Submissions Configuration */}
              <div
                className={cn(
                  "space-y-4 p-4 border rounded-lg",
                  isDark
                    ? "bg-[#C9A7FF26] border border-[#C9A7FF]"
                    : "bg-gray-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <Label
                      htmlFor="multipleSubmissions"
                      className="text-base font-semibold"
                    >
                      Multiple Submissions
                    </Label>
                    <p
                      className={cn(
                        "text-sm mt-1",
                        isDark ? "text-gray-300" : "text-gray-600",
                      )}
                    >
                      Allow creators to submit multiple entries to this contest
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multipleSubmissions"
                      checked={multipleSubmissionsEnabled}
                      onCheckedChange={(checked: any) => {
                        setMultipleSubmissionsEnabled(Boolean(checked));
                        if (!checked) {
                          setMaxSubmissionsPerCreator(1);
                        } else {
                          setMaxSubmissionsPerCreator(2);
                        }
                      }}
                      className={cn(
                        "border h-5 w-5",
                        isDark ? "border-gray-300" : "border-gray-500",
                      )}
                    />
                  </div>
                </div>

                {multipleSubmissionsEnabled && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="maxSubmissions">
                      Maximum Submissions Per Creator
                    </Label>
                    <Input
                      id="maxSubmissions"
                      type="number"
                      min="2"
                      max="100"
                      value={maxSubmissionsPerCreator}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (value >= 2 && value <= 100) {
                          setMaxSubmissionsPerCreator(value);
                        }
                      }}
                      className={cn(
                        isDark
                          ? "bg-[#C9A7FF26] border border-gray-400 text-white"
                          : "bg-white text-black",
                      )}
                      placeholder="Enter number between 2-100"
                    />
                    <p className="text-sm text-muted-foreground">
                      Each creator can submit up to {maxSubmissionsPerCreator}{" "}
                      entries. Min/max view limits will apply to all
                      submissions.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value)}
                >
                  <SelectTrigger
                    className={cn(
                      isDark
                        ? "bg-[#180438] border border-gray-600"
                        : "bg-white",
                    )}
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent isDark={isDark}>
                    <SelectItem value="crypto-financial" isDark={isDark}>
                      Crypto/Financial
                    </SelectItem>
                    <SelectItem value="education" isDark={isDark}>
                      Education
                    </SelectItem>
                    <SelectItem value="dating" isDark={isDark}>
                      Dating
                    </SelectItem>
                    <SelectItem value="food-drink" isDark={isDark}>
                      Food & Drink
                    </SelectItem>
                    <SelectItem value="games-toys" isDark={isDark}>
                      Games & Toys
                    </SelectItem>
                    <SelectItem value="health-wellness" isDark={isDark}>
                      Health & Wellness
                    </SelectItem>
                    <SelectItem value="home-living" isDark={isDark}>
                      Home & Living
                    </SelectItem>
                    <SelectItem value="pets-animals" isDark={isDark}>
                      Pets & Animals
                    </SelectItem>
                    <SelectItem value="sports-outdoors" isDark={isDark}>
                      Sports & Outdoors
                    </SelectItem>
                    <SelectItem value="technology" isDark={isDark}>
                      Technology
                    </SelectItem>
                    <SelectItem value="other" isDark={isDark}>
                      Other
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Targeting Toggle Checkbox */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-targeting-sections"
                    checked={
                      showTargetingSections ||
                      contestCategories.length > 0 ||
                      contestSubcategories.length > 0 ||
                      contestInterests.length > 0 ||
                      selectedRegions.length > 0 ||
                      selectedCountries.length > 0
                    }
                    disabled={isLoading}
                    onCheckedChange={(checked) => {
                      // Prevent unchecking if any targeting data is selected
                      const hasTargetingData =
                        contestCategories.length > 0 ||
                        contestSubcategories.length > 0 ||
                        contestInterests.length > 0 ||
                        selectedRegions.length > 0 ||
                        selectedCountries.length > 0;

                      if (!checked && hasTargetingData) {
                        toast({
                          title: "Cannot disable targeting",
                          description:
                            "Please remove all selected categories, subcategories, interests, and regions before disabling targeting.",
                          variant: "destructive",
                          duration: 3000,
                        });
                        return;
                      }
                      // If checked and there's targeting data but sections are collapsed, expand them
                      if (
                        checked &&
                        hasTargetingData &&
                        !showTargetingSections
                      ) {
                        setShowTargetingSections(true);
                      } else {
                        setShowTargetingSections(checked === true);
                      }
                    }}
                    className={cn(
                      isDark
                        ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                        : "border-gray-400 data-[state=checked]:bg-purple-600",
                    )}
                  />
                  <label
                    htmlFor="show-targeting-sections"
                    className={cn(
                      "text-sm font-medium cursor-pointer",
                      isDark ? "text-gray-300" : "text-gray-700",
                    )}
                  >
                    Target specific creators by selecting categories,
                    subcategories, interests, or regions. Only matching creators
                    will see this contest.
                  </label>
                </div>
              </div>

              {/* Categories Selection */}
              {showTargetingSections && (
                <div className="space-y-3">
                  <Collapsible
                    open={categoriesOpen}
                    onOpenChange={setCategoriesOpen}
                  >
                    <div
                      className={cn(
                        "rounded-lg border",
                        isDark
                          ? "bg-[#180438] border-gray-300"
                          : "bg-white border-gray-300",
                      )}
                    >
                      <div className="relative">
                        <CollapsibleTrigger
                          className={cn(
                            "w-full flex items-center justify-between p-4 pr-12 hover:bg-opacity-80 transition-colors",
                            isDark ? "" : "hover:bg-gray-50",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium cursor-pointer">
                              Categories{" "}
                              {/* <span className="text-xs text-gray-500">
                                (Select up to 3)
                              </span> */}
                            </span>
                            {contestCategories.length > 0 && (
                              <span
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  isDark
                                    ? "bg-purple-600 text-white"
                                    : "bg-purple-100 text-purple-700",
                                )}
                              >
                                {contestCategories.length} selected
                              </span>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <div
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            id="categories-checkbox"
                            checked={categoriesOpen}
                            onCheckedChange={(checked) =>
                              setCategoriesOpen(checked as boolean)
                            }
                            className={cn(
                              isDark
                                ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                : "border-gray-400 data-[state=checked]:bg-purple-600",
                            )}
                          />
                        </div>
                      </div>
                      <CollapsibleContent className="px-4 pb-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {CONTENT_TYPE_CATEGORIES.map((cat) => {
                            const isChecked = contestCategories.includes(
                              cat.id,
                            );
                            return (
                              <div
                                key={cat.id}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`contest-category-${cat.id}`}
                                  checked={isChecked}
                                  disabled={isLoading}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setContestCategories([
                                        ...contestCategories,
                                        cat.id,
                                      ]);
                                      // Automatically add all subcategories when category is selected
                                      const newSubcategories =
                                        cat.subcategories.map(
                                          (subcategory) => ({
                                            category: cat.id,
                                            subcategory: subcategory,
                                          }),
                                        );
                                      // Add subcategories that aren't already in the list
                                      setContestSubcategories((prev) => {
                                        const existing = new Set(
                                          prev.map(
                                            (item) =>
                                              `${item.category}:${item.subcategory}`,
                                          ),
                                        );
                                        const toAdd = newSubcategories.filter(
                                          (item) =>
                                            !existing.has(
                                              `${item.category}:${item.subcategory}`,
                                            ),
                                        );
                                        return [...prev, ...toAdd];
                                      });
                                    } else {
                                      // Remove category and all its subcategories
                                      setContestCategories(
                                        contestCategories.filter(
                                          (id) => id !== cat.id,
                                        ),
                                      );
                                      setContestSubcategories(
                                        contestSubcategories.filter(
                                          (item) => item.category !== cat.id,
                                        ),
                                      );
                                    }
                                  }}
                                  className={cn(
                                    isDark
                                      ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                      : "border-gray-400 data-[state=checked]:bg-purple-600",
                                  )}
                                />
                                <label
                                  htmlFor={`contest-category-${cat.id}`}
                                  className={cn(
                                    "text-sm font-normal cursor-pointer",
                                    isDark ? "text-gray-300" : "text-gray-700",
                                  )}
                                >
                                  {cat.name}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                        {contestCategories.length > 0 && (
                          <div className="flex items-center justify-end mt-2">
                            {/* <p
                              className={cn(
                                "text-xs",
                                isDark ? "text-gray-400" : "text-gray-500"
                              )}
                            >
                              {contestCategories.length} selected
                            </p> */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setContestCategories([]);
                                setContestSubcategories([]);
                              }}
                              disabled={isLoading}
                              className={cn(
                                "h-7 px-2 text-xs",
                                isDark
                                  ? "border-gray-400 text-gray-300"
                                  : "border-gray-400 text-gray-700 hover:bg-gray-100",
                              )}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </Button>
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </div>
              )}

              {/* Subcategories Selection */}
              {showTargetingSections && (
                <div className="space-y-3">
                  <Collapsible
                    open={subcategoriesOpen}
                    onOpenChange={setSubcategoriesOpen}
                  >
                    <div
                      className={cn(
                        "rounded-lg border",
                        isDark
                          ? "bg-[#180438] border-gray-300"
                          : "bg-white border-gray-300",
                      )}
                    >
                      <div className="relative">
                        <CollapsibleTrigger
                          className={cn(
                            "w-full flex items-center justify-between p-4 pr-12 hover:bg-opacity-80 transition-colors",
                            isDark ? "" : "hover:bg-gray-50",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium cursor-pointer">
                              Subcategories
                            </span>
                            {contestSubcategories.length > 0 && (
                              <span
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  isDark
                                    ? "bg-purple-600 text-white"
                                    : "bg-purple-100 text-purple-700",
                                )}
                              >
                                {contestSubcategories.length} selected
                              </span>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <div
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            id="subcategories-checkbox"
                            checked={subcategoriesOpen}
                            onCheckedChange={(checked) =>
                              setSubcategoriesOpen(checked as boolean)
                            }
                            className={cn(
                              isDark
                                ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                : "border-gray-400 data-[state=checked]:bg-purple-600",
                            )}
                          />
                        </div>
                      </div>
                      <CollapsibleContent className="px-4 pb-4 space-y-3">
                        <Accordion type="multiple" className="w-full">
                          {CONTENT_TYPE_CATEGORIES.map((category) => {
                            // Get selected subcategories for this category
                            const selectedSubcategoriesForCategory =
                              contestSubcategories.filter(
                                (item) => item.category === category.id,
                              );
                            const selectedCount =
                              selectedSubcategoriesForCategory.length;

                            return (
                              <AccordionItem
                                key={category.id}
                                value={category.id}
                                className="border-b border-gray-200 dark:border-gray-700"
                              >
                                <AccordionTrigger
                                  className={cn(
                                    "text-sm font-medium hover:no-underline py-3",
                                    isDark ? "text-gray-300" : "text-gray-700",
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{category.name}</span>
                                    {selectedCount > 0 && (
                                      <span
                                        className={cn(
                                          "text-xs px-2 py-0.5 rounded-full",
                                          isDark
                                            ? "bg-purple-600 text-white"
                                            : "bg-purple-100 text-purple-700",
                                        )}
                                      >
                                        {selectedCount} selected
                                      </span>
                                    )}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {category.subcategories.map(
                                      (subcategory) => {
                                        const isChecked =
                                          contestSubcategories.some(
                                            (item) =>
                                              item.category === category.id &&
                                              item.subcategory === subcategory,
                                          );
                                        return (
                                          <div
                                            key={`${category.id}-${subcategory}`}
                                            className="flex items-center space-x-2"
                                          >
                                            <Checkbox
                                              id={`contest-subcategory-${category.id}-${subcategory}`}
                                              checked={isChecked}
                                              disabled={isLoading}
                                              onCheckedChange={(checked) => {
                                                if (checked) {
                                                  setContestSubcategories([
                                                    ...contestSubcategories,
                                                    {
                                                      category: category.id,
                                                      subcategory: subcategory,
                                                    },
                                                  ]);
                                                } else {
                                                  setContestSubcategories(
                                                    contestSubcategories.filter(
                                                      (item) =>
                                                        !(
                                                          item.category ===
                                                            category.id &&
                                                          item.subcategory ===
                                                            subcategory
                                                        ),
                                                    ),
                                                  );
                                                }
                                              }}
                                              className={cn(
                                                isDark
                                                  ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                                  : "border-gray-400 data-[state=checked]:bg-purple-600",
                                              )}
                                            />
                                            <label
                                              htmlFor={`contest-subcategory-${category.id}-${subcategory}`}
                                              className={cn(
                                                "text-sm font-normal cursor-pointer",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700",
                                              )}
                                            >
                                              {subcategory}
                                            </label>
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                        {contestSubcategories.length > 0 && (
                          <div className="flex items-center justify-end mt-2">
                            {/* <p
                              className={cn(
                                "text-xs",
                                isDark ? "text-gray-400" : "text-gray-500"
                              )}
                            >
                              {contestSubcategories.length} subcategories
                              selected
                            </p> */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setContestSubcategories([])}
                              disabled={isLoading}
                              className={cn(
                                "h-7 px-2 text-xs",
                                isDark
                                  ? "border-gray-400 text-gray-300"
                                  : "border-gray-400 text-gray-700 hover:bg-gray-100",
                              )}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </Button>
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </div>
              )}

              {/* Interests Selection */}
              {showTargetingSections && (
                <div className="space-y-3">
                  <Collapsible
                    open={interestsOpen}
                    onOpenChange={setInterestsOpen}
                  >
                    <div
                      className={cn(
                        "rounded-lg border",
                        isDark
                          ? "bg-[#180438] border-gray-300"
                          : "bg-white border-gray-300",
                      )}
                    >
                      <div className="relative">
                        <CollapsibleTrigger
                          className={cn(
                            "w-full flex items-center justify-between p-4 pr-12 hover:bg-opacity-80 transition-colors",
                            isDark ? "" : "hover:bg-gray-50",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium cursor-pointer">
                              Interests
                            </span>
                            {contestInterests.length > 0 && (
                              <span
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  isDark
                                    ? "bg-purple-600 text-white"
                                    : "bg-purple-100 text-purple-700",
                                )}
                              >
                                {contestInterests.length} selected
                              </span>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <div
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            id="interests-checkbox"
                            checked={interestsOpen}
                            onCheckedChange={(checked) =>
                              setInterestsOpen(checked as boolean)
                            }
                            className={cn(
                              isDark
                                ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                : "border-gray-400 data-[state=checked]:bg-purple-600",
                            )}
                          />
                        </div>
                      </div>
                      <CollapsibleContent className="px-4 pb-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {INTERESTS.map((interest) => {
                            const isChecked =
                              contestInterests.includes(interest);
                            return (
                              <div
                                key={interest}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`contest-interest-${interest}`}
                                  checked={isChecked}
                                  disabled={isLoading}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setContestInterests([
                                        ...contestInterests,
                                        interest,
                                      ]);
                                    } else {
                                      setContestInterests(
                                        contestInterests.filter(
                                          (item) => item !== interest,
                                        ),
                                      );
                                    }
                                  }}
                                  className={cn(
                                    isDark
                                      ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                      : "border-gray-400 data-[state=checked]:bg-purple-600",
                                  )}
                                />
                                <label
                                  htmlFor={`contest-interest-${interest}`}
                                  className={cn(
                                    "text-sm font-normal cursor-pointer",
                                    isDark ? "text-gray-300" : "text-gray-700",
                                  )}
                                >
                                  {interest}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                        {contestInterests.length > 0 && (
                          <div className="flex items-center justify-end mt-2">
                            {/* <p
                              className={cn(
                                "text-xs",
                                isDark ? "text-gray-400" : "text-gray-500"
                              )}
                            >
                              {contestInterests.length} interests selected
                            </p> */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setContestInterests([])}
                              disabled={isLoading}
                              className={cn(
                                "h-7 px-2 text-xs",
                                isDark
                                  ? "border-gray-400 text-gray-300"
                                  : "border-gray-400 text-gray-700 hover:bg-gray-100",
                              )}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </Button>
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </div>
              )}

              {/* Regions and Countries Selection */}
              {showTargetingSections && (
                <div className="space-y-3">
                  <Collapsible open={regionsOpen} onOpenChange={setRegionsOpen}>
                    <div
                      className={cn(
                        "rounded-lg border",
                        isDark
                          ? "bg-[#180438] border-gray-300"
                          : "bg-white border-gray-300",
                      )}
                    >
                      <div className="relative">
                        <CollapsibleTrigger
                          className={cn(
                            "w-full flex items-center justify-between p-4 pr-12 hover:bg-opacity-80 transition-colors",
                            isDark ? "" : "hover:bg-gray-50",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium cursor-pointer">
                              Regions
                            </span>
                            {/* {selectedRegions.length > 0 && (
                              <span
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  isDark
                                    ? "bg-purple-600 text-white"
                                    : "bg-purple-100 text-purple-700"
                                )}
                              >
                                {selectedRegions.length} selected
                              </span>
                            )} */}
                            {selectedCountries.length > 0 && (
                              <span
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  isDark
                                    ? "bg-purple-600 text-white"
                                    : "bg-purple-100 text-purple-700",
                                )}
                              >
                                {selectedCountries.length} selected
                              </span>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <div
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            id="regions-checkbox"
                            checked={regionsOpen}
                            onCheckedChange={(checked) =>
                              setRegionsOpen(checked as boolean)
                            }
                            className={cn(
                              isDark
                                ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                : "border-gray-400 data-[state=checked]:bg-purple-600",
                            )}
                          />
                        </div>
                      </div>
                      <CollapsibleContent className="px-4 pb-4 space-y-4">
                        <div className="space-y-4">
                          {Object.keys(REGIONS_AND_COUNTRIES).map((region) => {
                            const regionKey =
                              region as keyof typeof REGIONS_AND_COUNTRIES;
                            const regionCountries =
                              REGIONS_AND_COUNTRIES[regionKey];
                            if (!regionCountries) return null;
                            const countriesArray: string[] = Array.isArray(
                              regionCountries,
                            )
                              ? regionCountries.map((c) => String(c))
                              : [];
                            const isRegionSelected =
                              selectedRegions.includes(region);
                            const selectedCountriesInRegion =
                              countriesArray.filter((country) =>
                                selectedCountries.includes(country),
                              );
                            const isPartiallySelected =
                              selectedCountriesInRegion.length > 0 &&
                              selectedCountriesInRegion.length <
                                countriesArray.length;
                            const hasAnySelected =
                              selectedCountriesInRegion.length > 0;

                            return (
                              <div key={region} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2 flex-1">
                                    <Checkbox
                                      id={`region-${region}`}
                                      checked={isRegionSelected}
                                      disabled={isLoading}
                                      onCheckedChange={(checked) => {
                                        handleRegionToggle(
                                          region,
                                          checked as boolean,
                                        );
                                      }}
                                      className={cn(
                                        isDark
                                          ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                          : "border-gray-400 data-[state=checked]:bg-purple-600",
                                      )}
                                    />
                                    <label
                                      htmlFor={`region-${region}`}
                                      className={cn(
                                        "text-sm font-semibold cursor-pointer flex items-center gap-2",
                                        isDark
                                          ? "text-gray-300"
                                          : "text-gray-700",
                                      )}
                                    >
                                      <span>{region}</span>
                                      {hasAnySelected && (
                                        <span
                                          className={cn(
                                            "text-xs px-2 py-0.5 rounded-full",
                                            isDark
                                              ? "bg-purple-600 text-white"
                                              : "bg-purple-100 text-purple-700",
                                          )}
                                        >
                                          {selectedCountriesInRegion.length}{" "}
                                          selected
                                        </span>
                                      )}
                                    </label>
                                  </div>
                                  {hasAnySelected && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUncheckAllCountriesInRegion(
                                          region,
                                        );
                                      }}
                                      disabled={isLoading}
                                      className={cn(
                                        "h-7 px-2 text-xs",
                                        isDark
                                          ? "text-gray-400 hover:text-gray-300 hover:bg-gray-800"
                                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                                      )}
                                    >
                                      Uncheck all
                                    </Button>
                                  )}
                                </div>
                                {(isRegionSelected || hasAnySelected) && (
                                  <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {countriesArray.map((country: string) => {
                                      const isCountrySelected =
                                        selectedCountries.includes(country);
                                      return (
                                        <div
                                          key={country}
                                          className="flex items-center space-x-2"
                                        >
                                          <Checkbox
                                            id={`country-${region}-${country}`}
                                            checked={isCountrySelected}
                                            disabled={isLoading}
                                            onCheckedChange={(checked) => {
                                              handleCountryToggle(
                                                country,
                                                checked as boolean,
                                              );
                                            }}
                                            className={cn(
                                              isDark
                                                ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                                : "border-gray-400 data-[state=checked]:bg-purple-600",
                                            )}
                                          />
                                          <label
                                            htmlFor={`country-${region}-${country}`}
                                            className={cn(
                                              "text-sm font-normal cursor-pointer",
                                              isDark
                                                ? "text-gray-300"
                                                : "text-gray-700",
                                            )}
                                          >
                                            {country}
                                          </label>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {selectedCountries.length > 0 && (
                          <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRegions([]);
                                setSelectedCountries([]);
                              }}
                              disabled={isLoading}
                              className={cn(
                                "h-7 px-2 text-xs",
                                isDark
                                  ? "border-gray-400 text-gray-300"
                                  : "border-gray-400 text-gray-700 hover:bg-gray-100",
                              )}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </Button>
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </div>
              )}

              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 transition-colors duration-200 cursor-pointer ${
                    isDragActive
                      ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
                      : isDark
                        ? "border-slate-600 bg-[#170337]"
                        : "border-gray-300 bg-white"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  tabIndex={0}
                  role="button"
                  aria-label="Upload thumbnail"
                >
                  {thumbnailPreview ? (
                    <div className="relative">
                      {thumbnailPreview === "uploading" ? (
                        <div
                          className={cn(
                            "flex flex-col items-center justify-center h-64 rounded",
                            isDark ? "bg-[#180438]" : "bg-gray-50",
                          )}
                        >
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mb-2"></div>
                          <p className="text-sm text-gray-600">
                            Uploading thumbnail...
                          </p>
                        </div>
                      ) : (
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          className="mx-auto max-h-64 object-contain"
                        />
                      )}
                      <div className="mt-2 flex justify-between items-center">
                        <p className="text-sm text-gray-500">
                          {thumbnailPreview === "uploading"
                            ? "Uploading..."
                            : thumbnail?.name || "Saved thumbnail"}
                          {thumbnail?.size
                            ? ` · ${(thumbnail.size / (1024 * 1024)).toFixed(
                                2,
                              )}MB`
                            : ""}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={removeThumbnail}
                          className="text-purple-500"
                          disabled={thumbnailPreview === "uploading"}
                        >
                          <Trash className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40">
                      <Upload className="mx-auto text-gray-500 text-3xl mb-2" />

                      <p className="text-md font-medium mb-1">
                        Drag, drop or browse{" "}
                        <span className="text-purple-500">thumbnail</span>
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        Max file size: 5MB
                      </p>
                      <Button
                        className={cn(
                          "px-4 py-4 rounded-lg text-sm hover:text-white",
                          isDark
                            ? "bg-[#7F39EC] text-white"
                            : "bg-[#4A00BE] text-white",
                        )}
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-4 w-4" /> Upload
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

              <CardFooter className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6">
                {/* Display error message if validation fails (not shown in basics step - uses toast only) */}
                {formFeedback &&
                  formFeedbackType === "error" &&
                  step !== "basics" && (
                    <div className="w-full sm:w-auto sm:mr-auto">
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
                <div
                  className={`flex gap-2 ${
                    formFeedback &&
                    formFeedbackType === "error" &&
                    step !== "basics"
                      ? "ml-auto"
                      : "ml-auto"
                  }`}
                >
                  <button
                    className={cn(
                      "border font-semibold px-4 py-2 rounded-lg text-md",
                      isDark
                        ? "border-gray-300 text-gray-300"
                        : "border-[#4A00BE] text-[#4A00BE]",
                    )}
                    onClick={handleSaveDraft}
                    disabled={isLoading || !title.trim()}
                  >
                    {isLoading &&
                    uploadProgress &&
                    uploadProgress.includes("draft") ? (
                      <div className="flex items-center gap-2">
                        <span>{uploadProgress}</span>
                        <Progress
                          value={uploadProgress ? 70 : 0}
                          className="w-10 h-2"
                        />
                      </div>
                    ) : (
                      "Save Draft"
                    )}
                  </button>
                  <button
                    className={cn(
                      "px-8 py-2 rounded-lg text-md cursor-pointer",
                      isDark
                        ? "bg-[#7F39EC] text-white hover:bg-[#6B2FD6]"
                        : "bg-[#4A00BE] text-white hover:bg-[#3A00A0]",
                      isLoading && "opacity-50 cursor-not-allowed",
                    )}
                    type="button"
                    onClick={nextStep}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Next
                      </div>
                    ) : (
                      "Next"
                    )}
                  </button>
                </div>
              </CardFooter>
            </div>
          </>
        )}

        {step === "brief" && (
          <>
            <div
              className={cn(
                "p-6 border-b rounded-t-xl shadow-xl space-y-6",
                isDark
                  ? "bg-[#180438] border-gray-600"
                  : "border-[#D0D0D0] bg-white",
              )}
            >
              <h2
                className={cn(
                  "font-semibold text-2xl ",
                  isDark ? "text-white" : "text-purple-600",
                )}
              >
                Project Overview
              </h2>
            </div>
            <CardContent
              className={cn(
                "space-y-6 p-6 rounded-bl-xl rounded-br-xl shadow-xl",
                isDark ? "bg-[#180438]" : "bg-white",
              )}
            >
              {/* formFeedback display removed from CardContent for brief step, it's in the CardFooter */}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="project-brief" className="text-lg">
                      Brief / Project Description
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
                      onClick={toggleBriefPreview}
                    >
                      {showBriefPreview ? "Edit" : "Preview"}
                    </Button>
                  </div>
                </div>
                <p
                  className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-600 dark:text-gray-400",
                  )}
                >
                  {platform === "twitter"
                    ? "Provide a detailed description of your project, what you want creators to post on X (Twitter), key messages, target audience, and specific requirements. If you want creators to mention specific accounts or hashtags, write them exactly as they should appear in the post (for example: @brandname, @creator, #BrandCampaign)."
                    : "Provide a detailed description of your project, what you want creators to do, key messages, target audience, and specific requirements."}
                </p>

                {showBriefPreview ? (
                  <div
                    className={cn(
                      "border rounded-lg p-4 min-h-[300px]",
                      isDark ? "border-gray-600" : "border-gray-400",
                    )}
                  >
                    <h4
                      className={cn(
                        "text-sm font-medium mb-2",
                        isDark ? "text-white" : "text-gray-600",
                      )}
                    >
                      Preview:
                    </h4>
                    <div
                      className={cn(
                        "prose prose-lg dark:prose-invert prose-headings:font-title font-default max-w-none",
                        isDark ? "text-white" : "text-gray-600",
                      )}
                      style={{
                        padding: "12px 15px",
                        minHeight: "250px",
                      }}
                      dangerouslySetInnerHTML={{
                        __html:
                          brief ||
                          '<p class="text-gray-400">No content yet. Click "Edit" to add content.</p>',
                      }}
                    />
                  </div>
                ) : (
                  <div className="min-h-[300px]">
                    <NovelEditor
                      value={brief}
                      placeholder="Describe your project, what you want creators to do, key messages, target audience, and any specific requirements..."
                      height="250px"
                      isDark={isDark}
                      enableImages={false}
                      ref={richTextEditorRef}
                      onChange={(html: string, json: any) => {
                        console.log(
                          "Novel editor onChange - html:",
                          html?.substring(0, 50),
                        );
                        console.log("Novel editor onChange - json:", json);
                        setBrief(html); // Keep for backward compatibility
                        setBriefHtml(html);
                        setBriefJson(json);
                        clearToastError(); // Clear toast error when user starts typing
                      }}
                    />
                  </div>
                )}
              </div>
              {contestFormat === "text_image" && !isRaidTwitter && (
                <>
                  {/* Keywords section */}
                  <div className="space-y-3 mt-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">Keywords</h3>
                        {/* <span className="text-red-500 font-bold text-lg">*</span> */}
                      </div>
                      <p
                        className={cn(
                          "text-xs",
                          isDark ? "text-gray-300" : "text-gray-500",
                        )}
                      >
                        Add search keywords and hashtags (e.g. product name,
                        theme, #BrandCampaign). For hashtags, start with #.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {keywords.map((kw, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={kw}
                            onChange={(e) => {
                              const raw = e.target.value;
                              // Disallow spaces in keywords; strip all whitespace
                              const sanitized = raw.replace(/\s+/g, "");
                              const next = [...keywords];
                              next[index] = sanitized;
                              setKeywords(next);
                            }}
                            placeholder="Add keyword"
                            className={cn(
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                          />
                          {keywords.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const next = keywords.filter(
                                  (_, i) => i !== index,
                                );
                                setKeywords(next.length ? next : [""]);
                              }}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "mt-1 border-dashed",
                        isDark
                          ? "border-gray-500 text-gray-200"
                          : "border-gray-400 text-gray-700",
                      )}
                      onClick={() => setKeywords([...keywords, ""])}
                    >
                      + Add keyword
                    </Button>

                    {/* Keyword requirement (for keywords section) */}
                    <div className="mt-4 space-y-2">
                      <p
                        className={cn(
                          "text-xs font-medium",
                          isDark ? "text-gray-200" : "text-gray-700",
                        )}
                      >
                        How strict should keywords be?
                      </p>
                      <RadioGroup
                        value={keywordsRequirementMode}
                        onValueChange={(val: "all" | "any") =>
                          setKeywordsRequirementMode(val)
                        }
                        className="flex flex-col gap-1 sm:flex-row sm:gap-4"
                      >
                        <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                          <RadioGroupItem value="all" id="req-all-keywords" />
                          <span
                            className={cn(
                              "leading-snug",
                              isDark ? "text-gray-200" : "text-gray-700",
                            )}
                          >
                            All are mandatory
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                          <RadioGroupItem value="any" id="req-any-keywords" />
                          <span
                            className={cn(
                              "leading-snug",
                              isDark ? "text-gray-200" : "text-gray-700",
                            )}
                          >
                            Any is acceptable
                          </span>
                        </label>
                      </RadioGroup>
                    </div>
                  </div>

                  {/* Mentions section */}
                  <div className="space-y-3 mt-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">Mentions</h3>
                      </div>
                      <p
                        className={cn(
                          "text-xs",
                          isDark ? "text-gray-300" : "text-gray-500",
                        )}
                      >
                        Add up to 3 @mentions to track (e.g. @brandname,
                        @partner)
                      </p>
                    </div>

                    <div className="space-y-2">
                      {mentions.map((mention, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={mention}
                            onChange={(e) => {
                              const next = [...mentions];
                              next[index] = e.target.value;
                              setMentions(next);
                            }}
                            placeholder="@username"
                            className={cn(
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                          />
                          {mentions.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const next = mentions.filter(
                                  (_, i) => i !== index,
                                );
                                setMentions(next.length ? next : [""]);
                              }}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "mt-1 border-dashed",
                        mentions.length >= 3 && "opacity-50 cursor-not-allowed",
                        isDark
                          ? "border-gray-500 text-gray-200"
                          : "border-gray-400 text-gray-700",
                      )}
                      disabled={mentions.length >= 3}
                      onClick={() => {
                        if (mentions.length < 3) {
                          setMentions([...mentions, ""]);
                        }
                      }}
                    >
                      + Add mention
                    </Button>

                    {/* Mention requirement (for mentions section) */}
                    <div className="mt-4 space-y-2">
                      <p
                        className={cn(
                          "text-xs font-medium",
                          isDark ? "text-gray-200" : "text-gray-700",
                        )}
                      >
                        How strict should mentions be?
                      </p>
                      <RadioGroup
                        value={mentionsRequirementMode}
                        onValueChange={(val: "all" | "any") =>
                          setMentionsRequirementMode(val)
                        }
                        className="flex flex-col gap-1 sm:flex-row sm:gap-4"
                      >
                        <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                          <RadioGroupItem value="all" id="req-all-mentions" />
                          <span
                            className={cn(
                              "leading-snug",
                              isDark ? "text-gray-200" : "text-gray-700",
                            )}
                          >
                            All are mandatory
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                          <RadioGroupItem value="any" id="req-any-mentions" />
                          <span
                            className={cn(
                              "leading-snug",
                              isDark ? "text-gray-200" : "text-gray-700",
                            )}
                          >
                            Any is acceptable
                          </span>
                        </label>
                      </RadioGroup>
                    </div>
                  </div>

                  {/* Max Participants section */}
                  <div className="space-y-3 mt-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium">
                          Max Participants
                        </h3>
                      </div>
                      <p
                        className={cn(
                          "text-xs",
                          isDark ? "text-gray-300" : "text-gray-500",
                        )}
                      >
                        Optional: Limit the maximum number of participants for
                        this campaign
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      value={maxParticipants}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMaxParticipants(
                          value === "" ? "" : parseInt(value, 10),
                        );
                      }}
                      placeholder="No limit (leave empty)"
                      className={cn(
                        isDark
                          ? "bg-[#180438] border border-gray-600"
                          : "bg-white",
                      )}
                    />
                  </div>
                </>
              )}

              <div className="space-y-4 mt-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">Set rules</h3>
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
                      onClick={toggleRulesPreview}
                    >
                      {showRulesPreview ? "Edit" : "Preview"}
                    </Button>
                  </div>
                </div>
                <p
                  className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-600 dark:text-gray-400",
                  )}
                >
                  Define clear rules and guidelines for participants to follow
                  when creating content for your contest.
                </p>

                {showRulesPreview ? (
                  <div
                    className={cn(
                      "border rounded-lg p-4 min-h-[300px]",
                      isDark ? "border-gray-600" : "border-gray-400",
                    )}
                  >
                    <h4
                      className={cn(
                        "text-sm font-medium mb-2",
                        isDark ? "text-white" : "text-gray-600",
                      )}
                    >
                      Preview:
                    </h4>
                    <div
                      className={cn(
                        "prose prose-lg dark:prose-invert prose-headings:font-title font-default max-w-none",
                        isDark ? "text-white" : "text-gray-600",
                      )}
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
                  <div className="min-h-[300px]">
                    <NovelEditor
                      value={rulesHtml}
                      placeholder="Content rules and guidelines..."
                      height="250px"
                      isDark={isDark}
                      enableImages={false}
                      ref={rulesRichTextEditorRef}
                      onChange={(html: string, json: any) => {
                        console.log(
                          "Rules editor onChange - html:",
                          html?.substring(0, 50),
                        );
                        console.log("Rules editor onChange - json:", json);
                        setRulesHtml(html);
                        setRulesJson(json);
                        clearToastError(); // Clear toast error when user starts typing
                      }}
                    />
                  </div>
                )}
              </div>

              <CardFooter className="flex justify-between items-center pt-6">
                {/* Modern Error Display for Brief step */}
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
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={isLoading}
                  className={cn(
                    "mr-auto border font-semibold px-4 py-2 rounded-lg text-md",
                    !(formFeedback && formFeedbackType === "error") &&
                      (isDark
                        ? "border-gray-300 text-gray-300"
                        : "border-[#4A00BE] text-[#4A00BE]"),
                  )}
                >
                  Back
                </button>
                <div
                  className={`flex gap-2 ${
                    formFeedback && formFeedbackType === "error"
                      ? "ml-4"
                      : "ml-auto"
                  }`}
                >
                  <button
                    className={cn(
                      "mr-auto border font-semibold px-4 py-2 rounded-lg text-md",
                      isDark
                        ? "border-gray-300 text-gray-300"
                        : "border-[#4A00BE] text-[#4A00BE]",
                    )}
                    onClick={handleSaveDraft}
                    disabled={isLoading || !title.trim()}
                  >
                    {isLoading &&
                    uploadProgress &&
                    uploadProgress.includes("draft") ? (
                      <div className="flex items-center gap-2">
                        <span>{uploadProgress}</span>
                        <Progress
                          value={uploadProgress ? 70 : 0}
                          className="w-10 h-2"
                        />
                      </div>
                    ) : (
                      "Save Draft"
                    )}
                  </button>
                  <button
                    className={cn(
                      "cursor-pointer px-8 py-2 rounded-lg text-md ",
                      isDark
                        ? "bg-[#7F39EC] text-white"
                        : "bg-[#4A00BE] text-white",
                    )}
                    type="button"
                    onClick={nextStep}
                    disabled={isNextDisabled() || isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Next
                      </div>
                    ) : (
                      "Next"
                    )}
                  </button>
                </div>
              </CardFooter>
            </CardContent>
          </>
        )}

        {step === "resources" && (
          <>
            {/* Resources for Participants Section */}
            <div className="mb-8">
              <div
                className={cn(
                  "px-6 py-4 border-b rounded-tl-xl rounded-tr-xl bg-white shadow-xl space-y-6",
                  isDark
                    ? "bg-[#180438] border-gray-600"
                    : "bg-white border-[#D0D0D0]",
                )}
              >
                <h2
                  className={cn(
                    "font-semibold text-2xl ",
                    isDark ? "text-white" : "text-purple-600",
                  )}
                >
                  Add Resources
                </h2>
              </div>
              <div
                className={cn(
                  "space-y-6 px-1 rounded-b-xl pb-5 shadow-xl",
                  isDark ? "bg-[#180438]" : "bg-white",
                )}
              >
                <div className="px-6 pt-6">
                  <CardTitle className="mb-3">
                    Resources for Participants{" "}
                    <span className="text-red-500">*</span>
                  </CardTitle>
                  <CardDescription className="text-[13px]">
                    Provide at least one resource to help participants
                    understand your brand and contest requirements. You can
                    upload assets (logos, guidelines, examples) <b>or</b> add
                    external links (website, social media, portfolio).
                  </CardDescription>
                  <span className="text-sm text-red-600 font-medium mt-2">
                    At least one required
                  </span>
                </div>
                <CardContent className="space-y-6">
                  {/* Asset Upload */}
                  <div className="flex flex-col gap-6">
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 transition-colors duration-200 cursor-pointer ${
                        isDragActive
                          ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
                          : isDark
                            ? "border-slate-600 bg-[#170337]"
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
                      {resourceFile ? (
                        <div className="relative flex items-center gap-3">
                          {resourceFile.type.startsWith("image/") &&
                          resourceFilePreview ? (
                            <img
                              src={resourceFilePreview}
                              alt="Preview"
                              className="w-16 h-16 object-cover rounded mr-3"
                            />
                          ) : resourceFile.name
                              .toLowerCase()
                              .endsWith(".pdf") ? (
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
                          ) : /\.(mp4|mov|avi|webm)$/i.test(
                              resourceFile.name,
                            ) ? (
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
                          ) : (
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
                          <div>
                            <div className="font-medium">
                              {resourceFile.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {resourceFile.size >= 1024 * 1024
                                ? (resourceFile.size / (1024 * 1024)).toFixed(
                                    2,
                                  ) + " MB"
                                : (resourceFile.size / 1024).toFixed(2) + " KB"}
                            </div>
                            {resourceDescription && (
                              <div className="text-xs text-gray-700 mt-1">
                                {resourceDescription}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeResourceFile();
                            }}
                            className="text-purple-500 ml-auto flex items-center gap-1"
                          >
                            <Trash className="h-4 w-4" /> Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-32">
                          <Upload className="h-10 w-10 text-3xl text-gray-400 mb-2" />
                          <p className="text-md font-medium mb-1">
                            Drag, drop or browse file
                          </p>
                          <p className="text-sm text-gray-500 mb-2">
                            Max file size: 5MB
                          </p>
                          <Button
                            className={cn(
                              "px-4 py-2 rounded-lg text-md",
                              isDark
                                ? "bg-[#7F39EC] text-white"
                                : "bg-[#4A00BE] text-white",
                            )}
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              resourceFileRef.current?.click();
                            }}
                          >
                            <Upload className="h-4 w-4" /> Upload File
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
                        <div className="flex-1 w-full space-y-2">
                          <Label htmlFor="fileDescription">
                            Description <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="fileDescription"
                            placeholder="Describe this asset"
                            className={cn(
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
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
                          className="w-full py-5 text-md bg-[#6C43D0] hover:bg-[#6C43D0]"
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
                  <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="mx-4 text-gray-500 font-semibold">Or</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                  </div>
                  {/* External Link Input */}
                  <div>
                    <div className="space-y-2">
                      <Label htmlFor="resourceLinkUrl">External Link</Label>
                      <Input
                        id="resourceLinkUrl"
                        type="url"
                        placeholder="https://example.com/resource"
                        value={newResourceUrl}
                        onChange={(e) => setNewResourceUrl(e.target.value)}
                        className={cn(
                          isDark
                            ? "bg-[#180438] border border-gray-600"
                            : "bg-white",
                        )}
                      />
                    </div>
                    <div className="space-y-2 mt-4 mb-4">
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
                        className={cn(
                          isDark
                            ? "bg-[#180438] border border-gray-600"
                            : "bg-white",
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={addResource}
                      disabled={!newResourceUrl || !externalResourceDescription}
                      className="w-full py-6 text-md bg-[#6C43D0] hover:bg-[#6C43D0]"
                    >
                      Add Link
                    </Button>
                    {externalLinkError && (
                      <div className="text-red-500 text-sm mt-2">
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
                          "supabase.co/storage",
                        );
                        const isInternal = resource.type === "internal";

                        // File type detection using URL extension
                        const isImage =
                          /\.(jpg|jpeg|png|gif|jfif|webp)(\?|$)/i.test(
                            resource.url,
                          );
                        const isPdf = /\.pdf(\?|$)/i.test(resource.url);
                        const isVideo = /\.(mp4|mov|avi|webm)(\?|$)/i.test(
                          resource.url,
                        );

                        return (
                          <li
                            key={idx}
                            className={cn(
                              "flex items-center gap-3 border rounded-lg p-4",
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : " bg-white border-gray-300",
                            )}
                          >
                            {isInternal && isImage && !isPdf && (
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
                                  <circle
                                    cx="32"
                                    cy="14"
                                    r="3"
                                    fill="#FF4444"
                                  />
                                </svg>
                              </span>
                            )}
                            {isInternal && !isImage && !isPdf && !isVideo && (
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
                              <div
                                className={cn(
                                  "rounded-full flex items-center justify-center w-12 h-12",
                                  isDark
                                    ? "bg-[#FFFFFF36] text-white"
                                    : "text-[#4A00BE] bg-[#D8C3FF]",
                                )}
                              >
                                <ExternalLink className="w-6 h-6" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="font-medium">
                                {resource.description}
                              </div>
                              <div
                                className={cn(
                                  "text-xs mt-1",
                                  isDark ? "text-white" : "text-gray-700",
                                )}
                              >
                                {resource.type === "internal"
                                  ? "Uploaded File"
                                  : "External Link"}
                              </div>
                              {resource.type === "external" && (
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "text-sm hover:underline break-all",
                                    isDark
                                      ? "text-purple-400"
                                      : "text-blue-600",
                                  )}
                                >
                                  {resource.url}
                                </a>
                              )}
                              {isInternal &&
                                isSupabaseUrl &&
                                (isImage ? null : isPdf ? (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center mt-1"
                                  >
                                    Open PDF
                                  </a>
                                ) : isVideo ? (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center mt-1"
                                  >
                                    Play Video
                                  </a>
                                ) : (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center mt-1"
                                  >
                                    Open File
                                  </a>
                                ))}
                            </div>
                            <button
                              onClick={() => removeResource(idx)}
                              className={cn(
                                "p-3 rounded-full flex-shrink-0 self-end sm:self-auto mr-2",
                                isDark
                                  ? "bg-[#FFFFFF36] text-white"
                                  : "text-[#4A00BE] bg-[#D8C3FF]",
                              )}
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </CardContent>
                <div>
                  {/* Inspiration / Target Tweet Section */}
                  <div>
                    <CardTitle className="px-6 pb-2">
                      {isRaidTwitter ? "Target Tweet" : "Inspiration Content"}{" "}
                      <span className="text-red-500">*</span>
                    </CardTitle>
                    <CardDescription className="text-[14px] px-6 pb-4">
                      {isRaidTwitter
                        ? "Add the link to the tweet creators should engage with, plus a short description."
                        : "Help creators understand your vision by adding at least one inspiration link (Instagram, YouTube, TikTok,Twitter etc.) with a description."}
                    </CardDescription>
                  </div>
                  <CardContent className="space-y-4">
                    {isRaidTwitter ? (
                      // Simplified UI for Raid: Direct inputs, no add button or list
                      <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="raidTweetLink" className="mb-[2px]">
                            Tweet Link <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="raidTweetLink"
                            type="url"
                            placeholder="https://x.com/yourbrand/status/1234567890"
                            value={inspirationLinks[0]?.url || ""}
                            className={cn(
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                            onChange={(e) => {
                              const url = e.target.value;
                              if (inspirationLinks.length > 0) {
                                setInspirationLinks([
                                  { ...inspirationLinks[0], url },
                                ]);
                              } else {
                                setInspirationLinks([{ url, description: "" }]);
                              }
                              setInspirationError(null);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="raidTweetDescription"
                            className="mb-[2px]"
                          >
                            Tweet Description{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="raidTweetDescription"
                            placeholder="Explain what this tweet is about (for creators)"
                            value={inspirationLinks[0]?.description || ""}
                            className={cn(
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                            onChange={(e) => {
                              const description = e.target.value;
                              if (inspirationLinks.length > 0) {
                                setInspirationLinks([
                                  { ...inspirationLinks[0], description },
                                ]);
                              } else {
                                setInspirationLinks([{ url: "", description }]);
                              }
                              setInspirationError(null);
                            }}
                          />
                        </div>
                        {inspirationError && (
                          <div className="text-red-500 text-sm mt-1">
                            {inspirationError}
                          </div>
                        )}
                      </div>
                    ) : (
                      // Full UI for Awareness: Add button and list
                      <>
                        <div className="flex flex-col gap-2">
                          <Label
                            htmlFor="inspirationUrlInput"
                            className="mb-[2px]"
                          >
                            Inspiration Link{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="inspirationUrlInput"
                            type="url"
                            placeholder="https://instagram.com/example"
                            value={newInspirationUrl}
                            className={cn(
                              "mb-3",
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                            onChange={(e) =>
                              setNewInspirationUrl(e.target.value)
                            }
                          />
                          <Label
                            htmlFor="inspirationDescriptionInput"
                            className="mb-[2px]"
                          >
                            Inspiration Description{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="inspirationDescriptionInput"
                            placeholder="Add description here*"
                            value={newInspirationDescription}
                            className={cn(
                              "mb-4",
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                            onChange={(e) =>
                              setNewInspirationDescription(e.target.value)
                            }
                          />
                          <Button
                            type="button"
                            className={cn(
                              "w-full py-6 text-md",
                              isDark
                                ? "bg-[#6C43D0] hover:bg-[#6C43D0]"
                                : "bg-[#4A00BE] hover:bg-[#4A00BE]",
                            )}
                            onClick={addInspiration}
                            disabled={
                              !newInspirationUrl || !newInspirationDescription
                            }
                          >
                            Add Inspiration
                          </Button>
                          {inspirationError && (
                            <div className="text-red-500 text-sm mt-1">
                              {inspirationError}
                            </div>
                          )}
                        </div>
                        {inspirationLinks.length > 0 && (
                          <ul className="space-y-3 mt-6">
                            {inspirationLinks.map((item, index) => (
                              <li
                                key={index}
                                className={cn(
                                  "flex items-center gap-3 border rounded-lg p-4",
                                  isDark
                                    ? "bg-[#180438] border border-gray-600"
                                    : " bg-white border-gray-300",
                                )}
                              >
                                <div
                                  className={cn(
                                    "rounded-full flex items-center justify-center w-12 h-12",
                                    isDark
                                      ? "bg-[#FFFFFF36] text-white"
                                      : "text-[#4A00BE] bg-[#D8C3FF]",
                                  )}
                                >
                                  <ExternalLink className="w-6 h-6" />
                                </div>

                                <div className="flex-1">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "font-medium hover:underline break-all",
                                      isDark
                                        ? "text-purple-400"
                                        : "text-blue-600",
                                    )}
                                  >
                                    {item.url}
                                  </a>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {item.description}
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeInspirationLink(index)}
                                  className={cn(
                                    "p-3 rounded-full flex-shrink-0 self-end sm:self-auto mr-2",
                                    isDark
                                      ? "bg-[#FFFFFF36] text-white"
                                      : "text-[#4A00BE] bg-[#D8C3FF]",
                                  )}
                                >
                                  <Trash className="h-4 w-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </CardContent>
                  {/* Raid-only Target Metrics */}
                  {isRaidTwitter && (
                    <CardContent className="space-y-3 pt-0">
                      <h4 className="px-0 text-md font-medium">
                        Target metrics (optional)
                      </h4>
                      <p
                        className={cn(
                          "text-sm",
                          isDark ? "text-gray-300" : "text-gray-500",
                        )}
                      >
                        Set soft targets for engagement on the target tweet.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="targetLikes">Target likes</Label>
                          <Input
                            id="targetLikes"
                            type="number"
                            min={0}
                            value={targetLikes}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTargetLikes(
                                v === "" ? "" : Math.max(0, Number(v) || 0),
                              );
                            }}
                            placeholder="e.g. 500"
                            className={cn(
                              "text-sm",
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="targetReplies">Target comments</Label>
                          <Input
                            id="targetReplies"
                            type="number"
                            min={0}
                            value={targetReplies}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTargetReplies(
                                v === "" ? "" : Math.max(0, Number(v) || 0),
                              );
                            }}
                            placeholder="e.g. 100"
                            className={cn(
                              "text-sm",
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="targetRetweets">
                            Target reposts/retweets
                          </Label>
                          <Input
                            id="targetRetweets"
                            type="number"
                            min={0}
                            value={targetRetweets}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTargetRetweets(
                                v === "" ? "" : Math.max(0, Number(v) || 0),
                              );
                            }}
                            placeholder="e.g. 200"
                            className={cn(
                              "text-sm",
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="targetQuoteReposts">
                            Target quote reposts
                          </Label>
                          <Input
                            id="targetQuoteReposts"
                            type="number"
                            min={0}
                            value={targetQuoteReposts}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTargetQuoteReposts(
                                v === "" ? "" : Math.max(0, Number(v) || 0),
                              );
                            }}
                            placeholder="e.g. 50"
                            className={cn(
                              "text-sm",
                              isDark
                                ? "bg-[#180438] border border-gray-600"
                                : "bg-white",
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                  {/* Tracking Links (Collapsible) */}
                  {!isRaidTwitter && (
                    <div className="px-6">
                      <div className="my-6 border-t border-gray-300"></div>
                      <Collapsible
                        open={trackingLinksOpen}
                        onOpenChange={setTrackingLinksOpen}
                      >
                        <CollapsibleTrigger
                          className={cn(
                            "w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 text-md font-semibold transition",
                            isDark
                              ? "border-gray-500"
                              : "border-gray-400 hover:bg-accent/50",
                          )}
                        >
                          <span>Tracking Links</span>
                          <span
                            className={cn(
                              "text-sm font-normal",
                              isDark ? "text-gray-300" : "text-gray-600",
                            )}
                          >
                            {trackingLinksOpen ? "Hide" : "Show"}
                          </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4 space-y-3">
                          {trackingError && (
                            <div className="text-red-500 text-sm">
                              {trackingError}
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor="trackingUrlInput">
                              External Link
                            </Label>
                            <Input
                              id="trackingUrlInput"
                              type="url"
                              placeholder="https://example.com/tracking-link"
                              value={newTrackingUrl}
                              onChange={(e) =>
                                setNewTrackingUrl(e.target.value)
                              }
                              className={cn(
                                isDark
                                  ? "bg-[#180438] border border-gray-600 text-white"
                                  : "bg-white text-black",
                              )}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="trackingDescriptionInput">
                              Description
                            </Label>
                            <Input
                              id="trackingDescriptionInput"
                              placeholder="Describe this link"
                              value={newTrackingDescription}
                              onChange={(e) =>
                                setNewTrackingDescription(e.target.value)
                              }
                              className={cn(
                                isDark
                                  ? "bg-[#180438] border border-gray-600 text-white"
                                  : "bg-white text-black",
                              )}
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={addTrackingLink}
                            disabled={
                              !newTrackingUrl || !newTrackingDescription
                            }
                            className={cn(
                              "w-full py-6 text-md",
                              isDark
                                ? "bg-[#6C43D0] hover:bg-[#6C43D0]"
                                : "bg-[#4A00BE] hover:bg-[#4A00BE]",
                            )}
                          >
                            Add Tracking Link
                          </Button>
                          {trackingLinks.length > 0 && (
                            <ul className="space-y-3 mt-2">
                              {trackingLinks.map((item, index) => (
                                <li
                                  key={index}
                                  className={cn(
                                    "flex items-center gap-3 rounded-lg p-4 border shadow-sm",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-300",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "rounded-full flex items-center justify-center w-12 h-12 mr-2",
                                      isDark
                                        ? "bg-[#FFFFFF36] text-white"
                                        : "text-[#4A00BE] bg-[#D8C3FF]",
                                    )}
                                  >
                                    <ExternalLink className="w-6 h-6" />
                                  </div>
                                  <div className="flex-1">
                                    <a
                                      href={
                                        item.url.includes("[creator]")
                                          ? item.url.replace(
                                              /\[creator\]/gi,
                                              encodeURIComponent(
                                                currentUserFirstName,
                                              ),
                                            )
                                          : item.url
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "font-medium hover:underline break-all",
                                        isDark
                                          ? "text-purple-400"
                                          : "text-blue-600",
                                      )}
                                    >
                                      {item.url.includes("[creator]")
                                        ? item.url.replace(
                                            /\[creator\]/gi,
                                            currentUserFirstName,
                                          )
                                        : item.url}
                                    </a>
                                    <div
                                      className={cn(
                                        "text-xs mt-1",
                                        isDark ? "text-white" : "text-gray-600",
                                      )}
                                    >
                                      {item.description}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => removeTrackingLink(index)}
                                    className={cn(
                                      "p-3 rounded-full flex-shrink-0 self-end sm:self-auto mr-2",
                                      isDark
                                        ? "bg-[#FFFFFF36] text-white"
                                        : "text-[#4A00BE] bg-[#D8C3FF]",
                                    )}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </div>
                <CardFooter className="py-6 px-6">
                  <button
                    className={cn(
                      "mr-auto border font-semibold px-4 py-2 rounded-lg text-md",
                      isDark
                        ? "text-white border-gray-400"
                        : "border-[#4A00BE] text-[#4A00BE]",
                    )}
                    type="button"
                    onClick={prevStep}
                    disabled={isLoading}
                  >
                    Back
                  </button>
                  <div className="flex gap-2 ml-auto">
                    <div className="flex gap-2 ml-auto">
                      <button
                        className={cn(
                          "mr-auto border font-semibold px-4 py-2 rounded-lg text-md",
                          isDark
                            ? "text-white border-gray-400"
                            : "border-[#4A00BE] text-[#4A00BE]",
                        )}
                        onClick={handleSaveDraft}
                        disabled={isLoading || !title.trim()}
                      >
                        {isLoading &&
                        uploadProgress &&
                        uploadProgress.includes("draft") ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            <span>Saving...</span>
                          </div>
                        ) : (
                          "Save Draft"
                        )}
                      </button>
                      <button
                        className={cn(
                          "cursor-pointer px-8 py-2 rounded-lg text-md",
                          isDark
                            ? "bg-[#7F39EC] text-white"
                            : "bg-[#4A00BE] text-white",
                        )}
                        type="button"
                        onClick={nextStep}
                        disabled={
                          resources.length === 0 ||
                          isLoading ||
                          inspirationLinks.length === 0
                        }
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Next
                          </div>
                        ) : (
                          "Next"
                        )}
                      </button>
                    </div>
                  </div>
                </CardFooter>
              </div>
            </div>
          </>
        )}

        {step === "prize" && (
          <>
            {/*           
            <CardHeader>
              <CardTitle>Prize Distribution</CardTitle>
            </CardHeader> */}
            <div className="space-y-6">
              {/* Removed general validationError Alert from CardContent */}
              {renderPrizeSection()}
            </div>
          </>
        )}
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div
          className={cn(
            "fixed inset-0 bg-black bg-opacity-65 flex items-center justify-center p-2 sm:p-4 z-50",
            isDark ? "bg-[#100A33]" : "bg-black",
          )}
        >
          <div
            className={cn(
              "rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto",
              isDark
                ? "bg-[#06021D] border border-gray-800 text-white"
                : "bg-white text-gray-900 ",
            )}
          >
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Contest Payment</h2>
                <p>Complete payment to submit your contest for review</p>
              </div>

              <ContestPaymentSelection
                contestAmount={
                  contestType === "leaderboard"
                    ? (() => {
                        // For leaderboard contests, charge prize pool + total budget (if flat fee bonus is enabled)
                        const prizePoolDollars = totalPrizePool / 100;
                        const flatFeeBonusEnabled =
                          flatFeeBonus &&
                          parseFloat(flatFeeBonus.toString()) > 0;
                        const totalBudgetDollars =
                          flatFeeBonusEnabled &&
                          totalBudget &&
                          parseFloat(totalBudget.toString()) > 0
                            ? parseFloat(totalBudget.toString())
                            : 0;
                        return prizePoolDollars + totalBudgetDollars;
                      })()
                    : parseFloat(totalBudget.toString()) || 0
                } // Budget is already in dollars
                prizePoolAmount={
                  contestType === "leaderboard"
                    ? totalPrizePool / 100
                    : undefined
                }
                bonusBudgetAmount={
                  contestType === "leaderboard"
                    ? (() => {
                        const flatFeeBonusEnabled =
                          flatFeeBonus &&
                          parseFloat(flatFeeBonus.toString()) > 0;
                        const totalBudgetDollars =
                          flatFeeBonusEnabled &&
                          totalBudget &&
                          parseFloat(totalBudget.toString()) > 0
                            ? parseFloat(totalBudget.toString())
                            : 0;
                        return totalBudgetDollars || undefined;
                      })()
                    : undefined
                }
                contestTitle={title || "Untitled Contest"}
                contestId={draftId || undefined}
                commissionPercentage={
                  getPlanFeatures(userPlan).commissionPercentage
                }
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                disabled={isLoading}
              />

              <div className="w-full mt-3">
                <Button
                  className={cn(
                    "w-full text-md rounded-full",
                    isDark
                      ? "py-3 border bg-[#06021D] border-[#FF5353] text-[#FF5353]"
                      : "bg-[#FF323224] text-[#E50000] py-4",
                  )}
                  onClick={() => setShowPayment(false)}
                  disabled={isLoading}
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Error Alert */}
      {toastErrorMessage && (
        <ErrorAlert key={toastErrorMessage} message={toastErrorMessage} />
      )}
      {/* Render BackModal if needed */}
      {showBackModal && <BackModal />}

      {/* Render UpgradeModal if needed */}
      {showUpgradeModal && <UpgradeModal />}

      {/* Render RefreshWarningModal if needed */}
      {showRefreshWarning && <RefreshWarningModal />}
    </div>
  );
}
