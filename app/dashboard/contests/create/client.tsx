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
  toLocalDateTimeStrings,
  toUTCISOString,
  validateImageFile,
} from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { toast } from "@/hooks/use-toast"; // Added import
import dynamic from "next/dynamic";

// Dynamically import the Novel editor
const NovelEditor = dynamic(() => import("@/components/novel-editor"), {
  ssr: false,
});

// Re-added constants that were accidentally removed
import {
  subscriptionPlans,
  MIN_PRIZE_PER_WINNER,
  MAX_PRIZE_PER_WINNER,
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

// Add ResourceItem type at the top (after imports)
type ResourceItem = {
  url: string;
  description: string;
  type: "internal" | "external";
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
  const [showPayment, setShowPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  // Contest Type and CPM-specific state
  const [contestType, setContestType] = useState<"leaderboard" | "cpm">(
    "leaderboard"
  );
  const [cpmRate, setCpmRate] = useState<number | string>("");
  const [minViews, setMinViews] = useState<number | string>("");
  const [maxViews, setMaxViews] = useState<number | string>("");
  const [totalBudget, setTotalBudget] = useState<number | string>("");
  const [termsConditions, setTermsConditions] = useState<string>("");
  // End Contest Type and CPM-specific state

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("technology");
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
    null
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

  const [winnerCount, setWinnerCount] = useState<number>(3);
  const [winnerAmounts, setWinnerAmounts] = useState<number[]>(
    DEFAULT_WINNER_AMOUNTS
  );
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resourceFileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [totalPrizePool, setTotalPrizePool] = useState<number>(
    DEFAULT_TOTAL_PRIZE_POOL
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
        (cpmRate || minViews || maxViews || totalBudget || termsConditions));

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
    hasUnsavedChanges,
  ]);

  // Add this to the state declarations
  const [resourceFiles, setResourceFiles] = useState<{ [key: string]: File }>(
    {}
  );
  const [platform, setPlatform] = useState<string>("youtube"); // Default platform

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
    null
  );

  // Section-specific error states for Assets step
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null);
  const [externalLinkError, setExternalLinkError] = useState<string | null>(
    null
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
        isEmpty
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

  // Function to clear toast error when user starts interacting
  const clearToastError = () => {
    if (toastErrorMessage) {
      setToastErrorMessage(null);
    }
  };

  // Helper function to delete thumbnail from Supabase storage
  const deleteFromStorage = async (thumbnailUrl: string) => {
    try {
      // Extract file path from Supabase URL
      const url = new URL(thumbnailUrl);
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
          console.error(
            "Failed to delete thumbnail from storage:",
            deleteError
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
          category: "technology",
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
              : null,
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
      category?: string;
      brief_html?: string;
      brief_json?: any;
      rules_html?: string;
      rules_json?: any;
      inspiration_links?: { url: string; description: string }[];
      start_date?: string | null;
      end_date?: string | null;
      contest_type?: "leaderboard" | "cpm";
      contest_based_details?: any;
    }>
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
            f.name.startsWith(`${currentContestId}_`)
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
        "Asset description is required for the uploaded file."
      );
      return;
    }
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (resourceFile.size > maxSize) {
      setAssetUploadError(
        "File must be 20MB or smaller. Please choose a smaller file."
      );
      return;
    }
    try {
      const isStorageAvailable = await checkStorageAvailability();
      if (!isStorageAvailable) {
        setAssetUploadError(
          "Storage is not available. Please try again later."
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
        "_"
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
    planFeatures: any
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
          now.getDate()
        );
        const daysUntilStart = Math.floor(
          (startDateOnly.getTime() - todayOnly.getTime()) /
            (1000 * 60 * 60 * 24)
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
                MIN_PRIZE_PER_WINNER
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
                MAX_PRIZE_PER_WINNER
              )}. Please reduce the prize amount.`,
            };
          }
        }

        // Total prize pool validation
        if (totalPrizePool < planFeatures.minContestBudget) {
          return {
            isValid: false,
            error: `The minimum prize pool for your plan is ${formatCurrencyFromCents(
              planFeatures.minContestBudget
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
            error: `CPM Rate must be at least $${MIN_CPM_RATE} per 1000 views.`,
          };
        }

        if (cpmRateValue > MAX_CPM_RATE) {
          return {
            isValid: false,
            error: `CPM Rate cannot exceed $${MAX_CPM_RATE} per 1000 views.`,
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
              planFeatures.minContestBudget
            )}. Please increase your total budget.`,
          };
        }
      }

      // 6. Plan and subscription validation
      if (contestType === "cpm") {
        const hasCpmAccess =
          planFeatures.contestTypes &&
          planFeatures.contestTypes.includes("cpm");
        if (!hasCpmAccess) {
          return {
            isValid: false,
            error:
              "CPM-based contests are only available with paid plans. Please upgrade your subscription or change to a Leaderboard contest.",
          };
        }
      }

      // 7. Active contest limit validation
      try {
        const { canCreateNewContest } = await import(
          "@/lib/contest-utils-client"
        );
        const activeCheck = await canCreateNewContest(
          userId,
          planFeatures.maxActiveContests
        );
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
          "User information not available. Please refresh the page and try again."
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
          planFeatures
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
                MIN_PRIZE_PER_WINNER
              )}`
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
        contestBasedDetails = {
          leaderboard_contest: {
            prizes: prizesArray,
            total_prize: totalPrizePool, // Already in cents
            winner_count: winnerCount,
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
              `CPM Rate must be at least $${MIN_CPM_RATE} per 1000 views.`
            ); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          if (cpmRateValue > MAX_CPM_RATE) {
            setFormFeedback(
              `CPM Rate cannot exceed $${MAX_CPM_RATE} per 1000 views.`
            ); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          if (!totalBudget || parseFloat(totalBudget.toString()) <= 0) {
            setFormFeedback(
              "Total Budget must be a positive number for CPM contests."
            ); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
          if (!termsConditions) {
            setFormFeedback(
              "Terms & Conditions are required for CPM contests."
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
        contestBasedDetails = {
          cpm_contest: {
            cpm_rate_usd: parseFloat(cpmRate.toString()) || 0,
            min_views:
              minViews && minViews.toString().trim() !== ""
                ? parseInt(minViews.toString(), 10)
                : null,
            max_views:
              maxViews && maxViews.toString().trim() !== ""
                ? parseInt(maxViews.toString(), 10)
                : null,
            total_budget: (parseFloat(totalBudget.toString()) || 0) * 100, // Convert to cents
            budget_spent: 0, // Initial value
            terms_conditions: termsConditions,
            // tiered_payouts: [] // Future use
          },
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
        if (contestType === "cpm") {
          const hasCpmAccess =
            planFeatures.contestTypes &&
            planFeatures.contestTypes.includes("cpm");
          if (!hasCpmAccess) {
            setFormFeedback(
              "CPM-based contests are only available with paid plans. Please upgrade your subscription or change to a Leaderboard contest."
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
                planFeatures.minContestBudget
              )}. Please increase your prize amounts.`
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          // Validate maximum winners
          if (winnerCount > planFeatures.maxWinnersPerContest) {
            setFormFeedback(
              `Your plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners. Please reduce the number of winners.`
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
        } else if (contestType === "cpm") {
          const budgetInCents = (parseFloat(totalBudget.toString()) || 0) * 100;
          if (budgetInCents < planFeatures.minContestBudget) {
            setFormFeedback(
              `The minimum contest budget for your plan is ${formatCurrencyFromCents(
                planFeatures.minContestBudget
              )}. Please increase your total budget.`
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
        }

        // Validate active contest limits before submission
        if (userId) {
          try {
            const { canCreateNewContest } = await import(
              "@/lib/contest-utils-client"
            );
            const activeCheck = await canCreateNewContest(
              userId,
              planFeatures.maxActiveContests
            );
            if (!activeCheck.canCreate) {
              setFormFeedback(
                activeCheck.error ||
                  `You have reached your plan's limit of ${planFeatures.maxActiveContests} active contests. Please upgrade your plan or wait for existing contests to end.`
              );
              setFormFeedbackType("error");
              setIsLoading(false);
              setUploadProgress(null);
              return;
            }
          } catch (error: any) {
            console.error("Error checking active contest limit:", error);
            setFormFeedback(
              "Unable to validate contest limits. Please try again."
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
            "At least one resource is required for submission - upload an asset OR add an external resource link"
          );
          setFormFeedbackType("error");
          setIsLoading(false);
          setUploadProgress(null);
          return;
        }

        if (!startDate || !startTime || !endDate || !endTime) {
          setFormFeedback(
            "Contest start and end dates/times are required for submission"
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
              "Invalid date or time format. Please check your entries."
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
              `Contest duration must be at least ${MIN_CONTEST_DURATION_DAYS} days`
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }

          if (durationDays > MAX_CONTEST_DURATION_DAYS) {
            setFormFeedback(
              `Contest duration cannot exceed ${MAX_CONTEST_DURATION_DAYS} days`
            );
            setFormFeedbackType("error");
            setIsLoading(false);
            setUploadProgress(null);
            return;
          }
        } catch (error) {
          console.error("Date validation error:", error);
          setFormFeedback(
            "There was an error with the date/time format. Please check your entries."
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
          isDraft ? "Uploading thumbnail..." : "Uploading thumbnail (1/2)..."
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
                "Storage not available for draft thumbnail upload. If a previous URL exists, it will be used."
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
              "_"
            )}`;
            const { data: uploadData, error: uploadError } =
              await supabase.storage
                .from("contest-assets")
                .upload(fileName, thumbnail);
            if (uploadError)
              throw new Error(
                `Failed to upload thumbnail: ${uploadError.message}`
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
            "There was a problem with the date format. Please check the start and end dates."
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
          : "Creating contest..."
      );
      const contestData = {
        advertiser_id: userId,
        title,
        thumbnail_url: thumbnailUrl,
        category,
        platform: platform,
        brief_html: briefHtml,
        brief_json: briefJson,
        rules_html: rulesHtml,
        rules_json: rulesJson,
        resources,
        inspiration_links: inspirationLinks,
        subscription_info_of_user: await (async () => {
          try {
            // Get user's subscription info using new system
            const { getUserSubscription } = await import(
              "@/lib/subscription-utils-client"
            );
            const subscription = await getUserSubscription(user?.id || "");

            if (subscription && subscription.subscription_info) {
              return subscription.subscription_info;
            } else {
              // Fallback: create subscription info from current plan
              const { subscriptionPlans } = await import(
                "@/constants/subscriptionPlans"
              );
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
          `Updating existing contest: ${existingContestId} (contestId: ${contestId}, draftId: ${draftId})`
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
          "Creating new contest (no existing contestId or draftId found)"
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
          `Attempting to submit contest for approval. Retries left: ${retries}`
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
              }s...`
            );
            await new Promise((res) => setTimeout(res, delay));
            return submitForApproval(retries - 1, delay);
          }
          // For other errors, throw immediately.
          throw new Error(
            result.error || "Failed to submit contest for approval"
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
        "Resource description cannot be empty for external link."
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
          r.description === externalResourceDescription
      )
    ) {
      setExternalLinkError(
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
      resources.some((r) => r.type === "external" && r.url === newResourceUrl)
    ) {
      setExternalLinkError(
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
            MIN_PRIZE_PER_WINNER
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
          ] || MIN_PRIZE_PER_WINNER
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
      // Prepare basics data
      const basicsData = {
        advertiser_id: user?.id,
        title,
        category,
        platform,
        contest_type: contestType,
        thumbnail_url: thumbnailPreview || null,
        moderation_status: "draft",
      };
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

  // Update nextStep to auto-save basics as draft before moving to brief
  const nextStep = async () => {
    setFormFeedback(null); // Clear previous global form feedback
    setFormFeedbackType(null);
    setToastErrorMessage(null); // Clear previous toast error

    // Helper function to set both form and toast error
    const setError = (message: string) => {
      setFormFeedback(message);
      setFormFeedbackType("error");
      setToastErrorMessage(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    };

    // Validate only what's needed for the current step
    if (step === "basics") {
      if (!title) {
        setError("Please enter a contest title");
        return;
      }
      if (!thumbnail && !thumbnailPreview) {
        setError("Please upload a thumbnail for your contest");
        return;
      }

      // Validate contest type access
      if (contestType === "cpm") {
        const planFeatures = getPlanFeatures(userPlan);
        const hasCpmAccess =
          planFeatures.contestTypes &&
          planFeatures.contestTypes.includes("cpm");

        if (!hasCpmAccess) {
          setError(
            "CPM-based contests are only available with paid plans. Please upgrade your subscription or select Leaderboard contest type."
          );
          return;
        }
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

      // Also check the current brief state as a fallback
      const briefToCheck = currentBrief || briefHtml;
      const rulesToCheck = currentRules || rulesHtml;

      console.log(
        "Brief validation - currentBrief:",
        currentBrief?.substring(0, 50)
      );
      console.log(
        "Brief validation - briefHtml state:",
        briefHtml?.substring(0, 50)
      );

      if (isQuillEmpty(briefToCheck)) {
        setError("Please enter a brief description for your contest");
        return;
      }
      if (isQuillEmpty(rulesToCheck)) {
        setError("Please provide rules for your contest");
        return;
      }
      setStep("resources");
    } else if (step === "resources") {
      // Validate that at least one resource is provided (either uploaded asset or external link)
      const hasUploadedAssets = resources.some((r) => r.type === "internal");
      const hasExternalLinks = resources.some((r) => r.type === "external");
      if (!hasUploadedAssets && !hasExternalLinks) {
        setError(
          "Please provide at least one resource - either upload an asset OR add an external resource link to help creators understand your requirements"
        );
        return;
      }
      if (inspirationLinks.length === 0) {
        setError(
          "Please add at least one inspiration link to help creators understand your vision"
        );
        return;
      }
      setStep("prize");
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
        const { getUserSubscription } = await import(
          "@/lib/subscription-utils-client"
        );
        const subscription = await getUserSubscription(userId);

        if (subscription && subscription.product_id) {
          // Map real Stripe product ID to plan name for UI compatibility
          const { subscriptionPlans } = await import(
            "@/constants/subscriptionPlans"
          );
          const plan = subscriptionPlans.find(
            (p) => p.id === subscription.product_id
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
        "No planId or failed to fetch plans, using default features."
      );
      return defaultFreePlanFeatures;
    }

    const plan = dbSubscriptionPlans.find(
      (p: SubscriptionPlan) => p.id === planId
    );

    if (!plan) {
      console.warn(
        `Plan with ID ${planId} not found in fetched plans. Using default features.`
      );
      // Attempt to find the 'explorer' plan by name if ID fails, or use the first available plan, or default
      const explorerPlan = dbSubscriptionPlans.find(
        (p) => p.name.toLowerCase() === "EXPLORER"
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

      // Check if there's a 'new' parameter in the URL - if so, don't load any draft
      const urlParams = new URLSearchParams(window.location.search);
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
    console.log("Draft ID:", draft.id);
    console.log("Draft title:", draft.title);

    setTitle(draft.title || "");
    setCategory(draft.category || "technology");
    setPlatform(draft.platform || "youtube"); // Load platform, default if not present
    // If thumbnail URL is available, show it in the preview
    if (draft.thumbnail_url) {
      setThumbnailPreview(draft.thumbnail_url);
    }
    setDraftId(draft.id);
    // CRITICAL FIX: Also set contestId when loading a draft
    setContestId(draft.id);

    console.log("Loading draft data:", draft); // For debugging

    // Pre-fill form fields with draft data using rich text format
    if (draft.brief_html && draft.brief_json) {
      setBrief(draft.brief_html);
      setBriefHtml(draft.brief_html);
      setBriefJson(draft.brief_json);
      // Set content in editor if ref is available
      if (richTextEditorRef.current) {
        richTextEditorRef.current.setContent(draft.brief_json);
      }
    }

    // Handle rules rich text content loading
    if (draft.rules_html && draft.rules_json) {
      setRulesHtml(draft.rules_html);
      setRulesJson(draft.rules_json);
      // Set content in editor if ref is available
      setTimeout(() => {
        if (rulesRichTextEditorRef.current) {
          rulesRichTextEditorRef.current.setContent(draft.rules_json);
        }
      }, 100);
    }

    // Set resources if available
    if (draft.resources && typeof draft.resources === "object") {
      setResources(draft.resources);
    }

    // Set inspiration links if available
    if (Array.isArray(draft.inspiration_links)) {
      setInspirationLinks(draft.inspiration_links);
    } else {
      setInspirationLinks([]);
    }

    // Set winner count and amounts if available
    if (draft.winner_count) {
      setWinnerCount(draft.winner_count);
    }

    if (draft.prizes && Array.isArray(draft.prizes)) {
      const amounts = draft.prizes.map(
        (prize: { amount?: number; position?: number }) => prize.amount || 0
      );
      setWinnerAmounts(amounts);
      updateTotalPrizePool(amounts);
    }

    // Convert UTC dates to local timezone for display
    if (draft.start_date) {
      const { dateString, timeString } = toLocalDateTimeStrings(
        draft.start_date
      );
      setStartDate(dateString);
      setStartTime(timeString);
    }

    if (draft.end_date) {
      const { dateString, timeString } = toLocalDateTimeStrings(draft.end_date);
      setEndDate(dateString);
      setEndTime(timeString);
    }

    console.log(
      "Draft loaded successfully, thumbnail preview:",
      draft.thumbnail_url
    );
  };

  // Call this once when component mounts
  useEffect(() => {
    // Load subscription plans from constants (new system)
    const loadSubscriptionPlans = async () => {
      setIsPlansLoading(true);
      try {
        // Import plans from constants (new subscription system)
        const { subscriptionPlans } = await import(
          "@/constants/subscriptionPlans"
        );

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
          })
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
      startDateObj.getMonth() + 1
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
        minEndDateTime.getDate() + MIN_CONTEST_DURATION_DAYS
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
      today.getDate()
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
      startOfToday
    )}, you can create contests starting from ${formatDateWithOrdinal(
      minStartDate
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

              <div className="px-6 pt-6 pb-4 border-b border-[#D0D0D0] rounded-tl-xl rounded-tr-xl bg-white shadow-xl space-y-6">
                <h2 className="text-purple-600 font-semibold text-xl">
                  Rewards & Timeline
                </h2>
              </div>
              <div className="max-w-[1100px] mx-auto bg-white shadow-md px-6 pt-3">
                <h3 className="text-lg font-bold mb-4">Your Plan Details</h3>
                <div className="flex items-start justify-between ">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-full ${
                        currentPlan && currentPlan.price === 0
                          ? "bg-[#D8C3FF] text-[#4A00BE]" // Free plan
                          : currentPlan &&
                            currentPlan.price <= PLAN_PRICE_THRESHOLD_STARTER
                          ? "bg-[#D8C3FF] text-[#4A00BE]" // Bronze plan
                          : "bg-[#D8C3FF] text-[#4A00BE]" // Higher plans
                      }`}
                    >
                      <Trophy className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Your Current Subscription Plan
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
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
                  {/* Plan Header Card */}

                  <div
                    className={`backdrop-blur-sm rounded-bl-xl rounded-br-xl px-6 pt-6 pb-8 shadow-lg ${
                      currentPlan.price === 0
                        ? "bg-white/90 border-gray-200" // Free plan
                        : currentPlan.price <= PLAN_PRICE_THRESHOLD_STARTER
                        ? "bg-white/90 border-gray-200" // Bronze plan
                        : "bg-white/90 border-gray-200" // Higher plans
                    }`}
                  >
                    <div className="flex flex-col  lg:flex-row items-start lg:items-center border border-gray-300 rounded-xl p-4 sm:p-6 justify-between gap-6">
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div
                          className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center bg-[#D8C3FF] text-[#4A00BE]"
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
                          <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
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
                      <div className="flex flex-col items-end gap-2">
                        {currentPlan.price > 0 ? (
                          <>
                            <div className="px-5 py-2 rounded-xl bg-[#4A00BE] text-white text-sm md:text-[13px] ">
                              Active Subscription
                            </div>
                            <p className="text-xs text-gray-500">
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
                    <div className="px-6 pt-6 pb-4 border-b border-[#D0D0D0] rounded-tl-xl rounded-tr-xl bg-white shadow-xl space-y-6">
                      <h2 className="text-black font-semibold text-2xl">
                        Plan Features
                      </h2>
                    </div>
                    <div className="max-w-[1100px] mx-auto bg-white rounded-bl-xl rounded-br-xl shadow-lg roundex-xl px-6 pt-6 pb-8">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Max Winners Feature - Only show for Leaderboard contests */}
                        {contestType === "leaderboard" && (
                          <div
                            className="border rounded-xl p-4 flex flex-col justify-between shadow-sm"
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
                                  <h5 className="text-lg font-semibold text-gray-900">
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
                                <p className="text-sm text-gray-600 leading-relaxed">
                                  The maximum number of creators you can reward
                                  in a single leaderboard contest. More winners
                                  means broader reach and engagement for your
                                  brand.
                                </p>
                                <div
                                  className={`mt-3 text-sm font-medium ${
                                    planFeatures.maxWinnersPerContest <= 3
                                      ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                      : "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                  }`}
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
                          <div className="backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300">
                            <div className="flex items-start gap-4">
                              {/* <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-purple-500 to-purple-600">
                                <span className="text-white font-bold text-lg">
                                  <GitGraphIcon />
                                </span>
                              </div> */}
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="text-lg font-semibold text-gray-900">
                                    Total Winners
                                  </h5>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-green-600 border border-green-600 rounded-full px-6">
                                      ∞
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                  In CPM contests, there's no limit on winners.
                                  All participating creators get paid based on
                                  their content's performance (views) &
                                  eligibility.
                                </p>
                                <div className="mt-4 text-sm font-medium border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2">
                                  Pay for performance - reward creators based on
                                  actual results
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Min Budget Feature */}
                        <div
                          className="backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300"
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
                                <h5 className="text-lg font-semibold text-gray-900">
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
                                      planFeatures.minContestBudget
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
                              <p className="text-sm text-gray-600 leading-relaxed">
                                The minimum total prize pool required to create
                                a contest. Lower minimums give you more
                                flexibility for smaller campaigns.
                              </p>
                              <div
                                className={`mt-4 text-sm font-medium ${
                                  planFeatures.minContestBudget >=
                                  HIGH_MIN_BUDGET_THRESHOLD
                                    ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                    : "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                }`}
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
                          className="backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300"
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
                                <h5 className="text-lg font-semibold text-gray-900">
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
                              <p className="text-sm text-gray-600 leading-relaxed">
                                How many contests you can run simultaneously.
                                Run multiple campaigns to maximize your brand's
                                exposure across different audiences.
                              </p>
                              <div
                                className={`mt-4 text-sm font-medium ${
                                  planFeatures.maxActiveContests <= 1
                                    ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                    : planFeatures.maxActiveContests <= 5
                                    ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                    : "mt-4 border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                }`}
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
                          className="backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300"
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
                                <h5 className="text-lg font-semibold text-gray-900">
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
                              <p className="text-sm text-gray-600 leading-relaxed">
                                Our service fee taken from your total prize
                                pool. Higher-tier plans have lower commission
                                rates, saving you money on larger campaigns.
                              </p>
                              <div
                                className={`mt-4 text-sm font-medium ${
                                  planFeatures.commissionPercentage >= 40
                                    ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                    : planFeatures.commissionPercentage >= 20
                                    ? "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                    : "border bg-[#F0E7FD] text-center border-purple-500 text-purple-600 rounded-lg px-3 py-2"
                                }`}
                              >
                                {planFeatures.commissionPercentage >= 40
                                  ? "High commission rate - upgrade to save!"
                                  : planFeatures.commissionPercentage >= 20
                                  ? "Upgrade to reduce commission fees!"
                                  : "Tip: Great rate - you're saving on fees!"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Enhanced Plan Benefits Summary */}
                  <div
                    className={`rounded-xl p-8 text-black shadow-lg relative overflow-hidden ${
                      currentPlan.price === 0
                        ? "bg-white" // Free plan - modern slate
                        : currentPlan.price <= PLAN_PRICE_THRESHOLD_STARTER
                        ? "bg-white" // Bronze plan - warm
                        : "bg-white" // Higher plans - premium
                    }`}
                  >
                    {/* Background Pattern */}
                    {/* <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
                    </div> */}

                    <div className="relative z-10">
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-[#D8C3FF] backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                          <Trophy className="h-6 w-6 text-[#4A00BE]" />
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
                      <div className="border border-bg-[#757272] py-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                        <div className="flex items-start gap-3 group">
                          <div className="w-3 h-3 bg-white rounded-full mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
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
                            <div className="w-3 h-3 bg-white rounded-full mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
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
                            <div className="w-3 h-3 bg-white rounded-full mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
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

                        <div className="flex items-start gap-3 group">
                          <div className="w-3 h-3 bg-white rounded-full mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
                          <div>
                            <span className="text-md font-medium">
                              Start campaigns from just{" "}
                              {formatCurrencyFromCents(
                                planFeatures.minContestBudget
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 group">
                          <div className="w-3 h-3 bg-white rounded-full mt-2 flex-shrink-0 group-hover:scale-110 transition-transform"></div>
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
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl py-6 px-4 border border-white/20">
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

          <div className="space-y-6 max-w-[1100px] mx-auto bg-white shadow-xl p-6 rounded-xl">
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
                  onChange={(e) => {
                    setEndDate(e.target.value);
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
                  min={
                    endDate === getMinEndDate() ? getMinEndTime() : undefined
                  }
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
                  <div className="flex items-center justify-between">
                    {/* This is the specific "Prize distribution" heading for leaderboard */}
                    <h3 className="text-lg font-medium">Prize Distribution</h3>
                    <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                      <span className="text-sm font-medium">
                        Total Prize Pool:
                      </span>
                      <span className="text-lg font-bold">
                        {formatCurrencyFromCents(totalPrizePool)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-4 mb-4">
                      <Label className="w-48">
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
                            winnerCount >= planFeatures.maxWinnersPerContest ||
                            winnerCount >= 10
                          }
                        >
                          +
                        </Button>
                      </div>
                      <div className="text-sm text-gray-500">
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
                        <div key={i} className="flex items-center gap-4 mb-2">
                          <Label className="w-48">Winner {i + 1}</Label>
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
                            className="w-48"
                          />
                          <div className="text-sm text-gray-500">
                            <span>
                              Min:{" "}
                              {formatCurrencyFromCents(MIN_PRIZE_PER_WINNER)}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
                {totalPrizePool < planFeatures.minContestBudget && (
                  <Alert className="mt-2">
                    <AlertDescription>
                      The minimum prize pool for your{" "}
                      {currentPlan?.name || "current"} plan is{" "}
                      {formatCurrencyFromCents(planFeatures.minContestBudget)}.
                      Please increase your prize amounts.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              // contestType === "cpm"
              <>
                <div className="space-y-6 p-4 border rounded-md">
                  <h3 className="text-lg font-medium">
                    CPM Contest Configuration
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="cpmRatePrize">CPM Rate (USD)</Label>
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
                      placeholder="e.g., 1.50 for $1.50 per 1000 views"
                      min={MIN_CPM_RATE}
                      max={MAX_CPM_RATE}
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground">
                      Amount paid to creators per 1000 views. Range: $
                      {MIN_CPM_RATE} - ${MAX_CPM_RATE} per 1000 views.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minViewsPrize">
                        Minimum Views (Optional)
                      </Label>
                      <Input
                        id="minViewsPrize"
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
                  <div className="space-y-2">
                    <Label htmlFor="totalBudgetPrize">
                      Total Contest Budget (USD)
                    </Label>
                    <Input
                      id="totalBudgetPrize"
                      type="number"
                      value={totalBudget} // This is a string from state, input type handles conversion
                      onChange={(e) => {
                        const newBudgetString = e.target.value;
                        setTotalBudget(newBudgetString); // Keep as string for input
                      }}
                      placeholder={`e.g., ${FORM_PLACEHOLDER_SMALL_AMOUNT}`}
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      The maximum total amount to be paid out for this contest.
                      This is the effective prize pool.
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
                    <Alert className="mt-2">
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
                className={`w-full sm:w-auto ${
                  !(formFeedback && formFeedbackType === "error")
                    ? "sm:mr-auto border font-semibold border-[#4A00BE] px-4 py-2 rounded-lg text-md text-[#4A00BE]"
                    : ""
                }`}
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
                  className="border font-semibold border-[#4A00BE] px-4 py-2 rounded-lg text-md text-[#4A00BE] w-full sm:w-auto"
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
                  className="px-5 py-4 rounded-lg bg-[#4A00BE] text-white hover:bg-[#4A00BE] transition w-full sm:w-auto"
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
            (file) => `contest_resources/${contestId}/${file.name}`
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
            f.name.startsWith(`${contestId}_`)
          );
          if (matching.length > 0) {
            const thumbnailFilePaths = matching.map(
              (f) => `contest_thumbnails/${f.name}`
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

  // Add this function near your other handlers:
  const handleResourceDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (file.size > maxSize) {
        setAssetUploadError(
          "File must be 20MB or smaller. Please choose a smaller file."
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
          `A resource with the description \"${description.trim()}\" already exists. Please use a unique description.`
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
            <Trophy className="h-5 w-5 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold">Upgrade Your Plan</h2>
        </div>
        <p className="mb-6 text-gray-600">
          You have unsaved contest data. Would you like to save your progress
          before upgrading your plan?
        </p>
        <div className="space-y-3">
          <Button
            onClick={handleSaveDraftAndUpgrade}
            className="w-full bg-[#D9C0FF61] rounded-full text-[#7F39EC] font-semibold"
          >
            Save Draft & Upgrade
          </Button>
          <Button
            variant="outline"
            onClick={handleUpgradeWithoutSaving}
            className="w-full border-2 rounded-full border-[#7F39EC] text-[#7F39EC] "
          >
            Upgrade without saving draft
          </Button>
          <Button
            variant="outline"
            onClick={handleCancelUpgrade}
            className="w-full rounded-full border-[#FF323224] bg-[#FF323224] text-[#E50000]"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  // Refresh Warning Modal
  const RefreshWarningModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl font-bold">Unsaved Changes</h2>
        </div>
        <p className="mb-6 text-gray-600">
          You have unsaved changes. Refreshing the page will lose all your
          progress. What would you like to do?
        </p>
        <div className="space-y-3">
          <Button
            onClick={handleSaveDraftAndBack}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
          >
            Save Draft
          </Button>
          <Button
            variant="outline"
            onClick={handleConfirmRefresh}
            className="w-full border-2 hover:bg-gray-50"
          >
            Refresh Anyway
          </Button>
          <Button
            variant="ghost"
            onClick={handleCancelRefresh}
            className="w-full text-gray-600 hover:text-gray-800"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-8">
      {/* Enhanced Header with Better Back Button */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            asChild={false}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
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
                              ? "bg-[#7F39EC] border-[#7F39EC] text-white "
                              : isCompleted
                              ? "bg-[#7F39EC] border-[#7F39EC] text-white "
                              : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 shadow-md"
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
                              ? "text-black text-[14px]"
                              : isCompleted
                              ? "text-black text-[14px]"
                              : "text-slate-500 text-md dark:text-slate-400"
                          }`}
                        >
                          {stepItem.title}
                        </h3>
                        <p
                          className={`text-[12px] mt-1 transition-colors duration-300 ${
                            isActive
                              ? "text-black text-[12px]"
                              : isCompleted
                              ? "text-black text-[12px]"
                              : "text-slate-400 dark:text-slate-500"
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
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-lg border">
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
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#7F39EC] transition-all duration-500 ease-out"
                  style={{
                    width:
                      step === "basics"
                        ? "25%"
                        : step === "brief"
                        ? "50%"
                        : step === "resources"
                        ? "75%"
                        : "100%",
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-[1100px] mx-auto ">
        {/* Removed global success Alert (for draft save) that was at the top of the card */}

        {step === "basics" && (
          <>
            <div className="p-6 border-b border-[#D0D0D0] rounded-tl-xl rounded-tr-xl bg-white shadow-xl space-y-6">
              <h2 className="text-purple-600 font-semibold text-2xl ">
                Customize your Contest
              </h2>
            </div>
            <div className="space-y-6 p-6 rounded-bl-xl rounded-br-xl bg-white shadow-xl">
              {/* Removed general validationError Alert from CardContent */}

              {/* Contest Type Selection */}
              <div className="space-y-2 ">
                <Label className="text-base text-xl font-semibold">
                  Contest Type
                </Label>
                <RadioGroup
                  value={contestType}
                  onValueChange={(value: "leaderboard" | "cpm") => {
                    const planFeatures = getPlanFeatures(userPlan);
                    const hasCpmAccess =
                      planFeatures.contestTypes &&
                      planFeatures.contestTypes.includes("cpm");

                    // Only allow CPM selection if user has access
                    if (value === "cpm" && !hasCpmAccess) {
                      return; // Don't change the value
                    }
                    setContestType(value);
                  }}
                  className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-2"
                >
                  <div
                    className={`flex items-center space-x-2 p-4 border rounded-lg cursor-pointer flex-1 
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
                      (p) => p.id === userPlan
                    );
                    const isFreePlan = !currentPlan || currentPlan.price === 0;

                    return (
                      <div
                        className={`flex items-center space-x-2 p-4 border rounded-lg flex-1 relative 
                        ${
                          !hasCpmAccess
                            ? "opacity-50 cursor-not-allowed bg-gray-50"
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
                          disabled={!hasCpmAccess}
                        />
                        <Label
                          htmlFor="cpm"
                          className={
                            hasCpmAccess
                              ? "cursor-pointer"
                              : "cursor-not-allowed"
                          }
                        >
                          <span className="font-semibold text-lg">
                            CPM Based Contest
                          </span>
                          <p className="text-[14px] leading-tight mt-[2px] text-muted-foreground">
                            Creators are paid based on the number of views their
                            content receives, at a pre-defined CPM rate.
                          </p>
                          {!hasCpmAccess && (
                            <div className="mt-2 flex items-center gap-2">
                              {isFreePlan && (
                                <button className="bg-[#4A00BE] hover:bg-[#4A00BE] text-white text-md px-3 rounded-full py-1 h-8">
                                  <Link href="/pricing">Upgrade Plan</Link>
                                </button>
                              )}
                              <p className="text-sm text-black font-medium">
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
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Add contest title</Label>
                <Input
                  id="title"
                  value={title}
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
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="Select contest platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose the platform where creators will submit content.
                </p>
              </div>

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
                    <SelectItem value="pets-animals">Pets & Animals</SelectItem>
                    <SelectItem value="sports-outdoors">
                      Sports & Outdoors
                    </SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 transition-colors duration-200 cursor-pointer ${
                    isDragActive
                      ? "border-rose-500 bg-rose-50"
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
                        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded">
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
                                2
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
                        className="bg-[#4A00BE] text-white px-4 py-4 rounded-lg text-sm hover:bg-[#4A00BE] hover:text-white"
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

              <CardFooter className="flex justify-between items-center pt-6">
                {/* Only show red styled error, removed black error display */}
                <div className="flex gap-2 ml-auto">
                  <button
                    className="border font-semibold border-[#4A00BE] px-4 py-2 rounded-lg text-md text-[#4A00BE]"
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
                    className="bg-[#4A00BE] cursor-pointer px-8 py-2 rounded-lg text-md text-white hover:bg-[#4A00BE]"
                    type="button"
                    onClick={nextStep}
                    disabled={isNextDisabled() || isLoading}
                  >
                    Next
                  </button>
                </div>
              </CardFooter>
            </div>
          </>
        )}

        {step === "brief" && (
          <>
            {/* <CardHeader>
              <CardTitle>Project Overview</CardTitle>
              
            </CardHeader> */}

            <div className="p-6 border-b border-[#D0D0D0] rounded-tl-xl rounded-tr-xl bg-white shadow-xl space-y-6">
              <h2 className="text-purple-600 font-semibold text-2xl">
                Project Overview
              </h2>
            </div>
            <CardContent className="space-y-6 p-6 rounded-bl-xl rounded-br-xl bg-white shadow-xl">
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
                <p className="text-md text-gray-600 dark:text-gray-400">
                  Provide a detailed description of your project, what you want
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
                          brief ||
                          '<p class="text-gray-400">No content yet. Click "Edit" to add content.</p>',
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-white rounded min-h-[300px]">
                    <NovelEditor
                      value={brief}
                      placeholder="Describe your project, what you want creators to do, key messages, target audience, and any specific requirements..."
                      height="250px"
                      ref={richTextEditorRef}
                      onChange={(html: string, json: any) => {
                        console.log(
                          "Novel editor onChange - html:",
                          html?.substring(0, 50)
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

              <div className="space-y-4">
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
                <p className="text-md text-gray-600 dark:text-gray-400">
                  Define clear rules and guidelines for participants to follow
                  when creating content for your contest.
                </p>

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
                  className={`${
                    !(formFeedback && formFeedbackType === "error")
                      ? "mr-auto border font-semibold border-[#4A00BE] px-4 py-2 rounded-lg text-md text-[#4A00BE]"
                      : ""
                  }`}
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
                    className="mr-auto border font-semibold border-[#4A00BE] px-4 py-2 rounded-lg text-md text-[#4A00BE]"
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
                    className="bg-[#4A00BE] cursor-pointer px-8 py-2 rounded-lg text-md text-white hover:bg-[#4A00BE]"
                    type="button"
                    onClick={nextStep}
                    disabled={isNextDisabled() || isLoading}
                  >
                    Next
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
              <div className="px-6 py-5 border-b border-[#D0D0D0] rounded-tl-xl rounded-tr-xl bg-white shadow-xl space-y-6">
                <h2 className="text-purple-600 font-semibold text-2xl">
                  Add Resources
                </h2>
              </div>
              <div className="space-y-6 px-1 rounded-bl-xl rounded-br-xl bg-white shadow-xl">
                <CardHeader>
                  <CardTitle>
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
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Asset Upload */}
                  <div className="flex flex-col gap-6">
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 transition-colors duration-200 cursor-pointer ${
                        isDragActive
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
                              resourceFile.name
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
                                    2
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
                            className="text-purple-500 ml-auto"
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
                            className="bg-[#4A00BE] text-white px-4 py-2 rounded-lg text-md hover:bg-[#4A00BE]"
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
                  <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="mx-4 text-gray-500 font-semibold">Or</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                  </div>
                  {/* External Link Input */}
                  <div className="">
                    <Label htmlFor="resourceLinkUrl">External Link</Label>
                    <Input
                      id="resourceLinkUrl"
                      type="url"
                      placeholder="https://example.com/resource"
                      value={newResourceUrl}
                      onChange={(e) => setNewResourceUrl(e.target.value)}
                      className="mb-6 mt-[3px]"
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
                      className="mb-6 mt-[3px]"
                    />
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
                          "supabase.co/storage"
                        );
                        const isInternal = resource.type === "internal";

                        // File type detection using URL extension
                        const isImage =
                          /\.(jpg|jpeg|png|gif|jfif|webp)(\?|$)/i.test(
                            resource.url
                          );
                        const isPdf = /\.pdf(\?|$)/i.test(resource.url);
                        const isVideo = /\.(mp4|mov|avi|webm)(\?|$)/i.test(
                          resource.url
                        );

                        return (
                          <li
                            key={idx}
                            className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"
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
                            <div className="text-[#4A00BE] bg-[#D8C3FF] rounded-full flex items-center justify-center w-12 h-12 mr-2">
                            <ExternalLink className="w-6= h-6" />
                          </div>

                            )}
                            <div className="flex-1">
                              <div className="font-medium">
                                {resource.description}
                              </div>
                              <div className="text-xs text-gray-700 mt-1">
                                {resource.type === "internal"
                                  ? "Uploaded File"
                                  : "External Link"}
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
                              className="text-[#4A00BE] p-3 mr-2 rounded-full bg-[#D8C3FF]"
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
                  {/* Inspiration Content Section */}
                  <CardHeader>
                    <CardTitle>
                      Inspiration Content{" "}
                      <span className="text-red-500">*</span>
                    </CardTitle>
                    <CardDescription className="text-[13px]">
                      Help creators understand your vision by adding at least
                      one inspiration link (Instagram, YouTube, TikTok, etc.)
                      with a description.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="inspirationUrlInput" className="mb-[2px]">
                        Inspiration Link
                      </Label>
                      <Input
                        id="inspirationUrlInput"
                        type="url"
                        placeholder="https://instagram.com/example"
                        value={newInspirationUrl}
                        className="mb-5"
                        onChange={(e) => setNewInspirationUrl(e.target.value)}
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
                        className="mb-5"
                        onChange={(e) =>
                          setNewInspirationDescription(e.target.value)
                        }
                      />
                      <Button
                        type="button"
                        className="w-full py-6 text-md bg-[#6C43D0] hover:bg-[#6C43D0]"
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
                    {/* Inspiration List */}
                    {inspirationLinks.length > 0 && (
                      <ul className="space-y-3 mt-6">
                        {inspirationLinks.map((item, index) => (
                          <li
                            key={index}
                            className="flex items-center  gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"
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
                              className="text-[#4A00BE] bg-[#D8C3FF]  p-3 mr-2 rounded-full"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                  <CardFooter className="py-6 px-4">
                    <button
                      className="mr-auto border font-semibold border-[#4A00BE] px-4 py-2 rounded-lg text-md text-[#4A00BE]"
                      type="button"
                      onClick={prevStep}
                      disabled={isLoading}
                    >
                      Back
                    </button>
                    <div className="flex gap-2 ml-auto">
                      <button
                        className="mr-auto border font-semibold border-[#4A00BE] px-4 py-2 rounded-lg text-md text-[#4A00BE]"
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
                        className="bg-[#4A00BE] cursor-pointer px-8 py-2 rounded-lg text-md text-white hover:bg-[#4A00BE]"
                        type="button"
                        onClick={nextStep}
                        disabled={
                          resources.length === 0 ||
                          isLoading ||
                          inspirationLinks.length === 0
                        }
                      >
                        Next
                      </button>
                    </div>
                  </CardFooter>
                </div>
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

              <ContestPaymentSelection
                contestAmount={
                  contestType === "leaderboard"
                    ? totalPrizePool / 100 // Convert cents to dollars
                    : parseFloat(totalBudget.toString()) || 0
                } // Budget is already in dollars
                contestTitle={title || "Untitled Contest"}
                contestId={draftId || undefined}
                commissionPercentage={
                  getPlanFeatures(userPlan).commissionPercentage
                }
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                disabled={isLoading}
              />

              <div className="mt-6 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowPayment(false)}
                  disabled={isLoading}
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
