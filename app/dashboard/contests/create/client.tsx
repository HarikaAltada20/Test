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

} from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  toLocalDateTimeStrings,
  toUTCISOString,

} from "@/lib/utils";
import { formatCurrency } from "@/lib/currency-utils";
import { toast } from "@/hooks/use-toast"; // Added import
import dynamic from 'next/dynamic';

// Dynamically import the Novel editor
const NovelEditor = dynamic(
  () => import('@/components/novel-editor'),
  { ssr: false }
);

// Re-added constants that were accidentally removed
import {
  subscriptionPlans,
  MIN_PRIZE_PER_WINNER,
  MAX_PRIZE_PER_WINNER,
  DEFAULT_PRIZE_ALLOCATIONS,
  HIGH_BUDGET_THRESHOLD,
} from "@/constants/subscriptionPlans";
import { createClient } from "@/utils/supabase/client";
import { UserResponse } from "@supabase/supabase-js";

// Define types for subscription plan features
type PlanFeatures = {
  maxActiveContests: number;
  minContestBudget: number;
  maxWinnersPerContest: number;
  commisionPercentage: number;
};

// Define type for subscription plan
type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  features: PlanFeatures;
};

type Step = "basics" | "brief" | "resources" | "prize";

export default function CreateContestPage({
  user,
}: {
  user: UserResponse["data"]["user"];
}) {
  const [step, setStep] = useState<Step>("basics");

  // Contest Type and CPM-specific state
  const [contestType, setContestType] = useState<"leaderboard" | "cpm">("leaderboard");
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
  const [resources, setResources] = useState<Record<string, string>>({});
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resourceFilePreview, setResourceFilePreview] = useState<string | null>(
    null
  );
  const [resourceDescription, setResourceDescription] = useState("");
  const [externalResourceDescription, setExternalResourceDescription] =
    useState("");

  const [inspirationLinks, setInspirationLinks] = useState<string[]>([]);
  const [newInspirationLink, setNewInspirationLink] = useState("");

  const [winnerCount, setWinnerCount] = useState<number>(3);
  const [winnerAmounts, setWinnerAmounts] = useState<number[]>([
    5000, 3000, 2000,
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resourceFileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [totalPrizePool, setTotalPrizePool] = useState<number>(10000); // Default total prize pool
  const [hasExceededBudgetThreshold, setHasExceededBudgetThreshold] =
    useState<boolean>(false);

  // New state for contest duration
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [showHighBudgetPrompt, setShowHighBudgetPrompt] = useState(false);



  // Add draft ID state for tracking loaded drafts
  const [draftId, setDraftId] = useState<string | null>(null);

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
  const [formFeedbackType, setFormFeedbackType] = useState<"error" | "success" | null>(null);

  // Section-specific error states for Assets step
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null);
  const [externalLinkError, setExternalLinkError] = useState<string | null>(null);

  // Add ref for the rich text editor
  const richTextEditorRef = useRef<any>(null);
  const rulesRichTextEditorRef = useRef<any>(null);

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
      .replace(/<p><\/p>/g, '') // Remove empty paragraphs
      .replace(/<p>\s*<\/p>/g, '') // Remove paragraphs with only whitespace
      .replace(/<br\s*\/?>/g, '') // Remove line breaks
      .replace(/&nbsp;/g, '') // Remove non-breaking spaces
      .trim();

    if (typeof document !== 'undefined') { // Ensure document is available (client-side)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanHtml;
      const textContent = tempDiv.textContent || tempDiv.innerText || "";
      const isEmpty = textContent.trim().length === 0;
      console.log("isQuillEmpty: textContent='", textContent, "', trim().length=", textContent.trim().length, ", returning", isEmpty);
      return isEmpty;
    }

    // Fallback for server-side: check if cleaned HTML has meaningful content
    const hasContent = cleanHtml.length > 0 && !cleanHtml.match(/^[\s\<\>\/]*$/);
    console.log("isQuillEmpty: server-side check, hasContent=", hasContent);
    return !hasContent;
  };

  // Function to capture content from rich text editor
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

  // Function to manually save content without toggling preview
  const saveCurrentContent = () => {
    captureBriefContent();
    toast({ title: "Success", description: "Content saved successfully!" });
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
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

  const removeThumbnail = () => {
    setThumbnail(null);
    setThumbnailPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    setAssetUploadError(null); // Clear previous asset upload error

    if (!resourceFile) {
      setAssetUploadError("No file selected for upload.");
      return;
    }
    if (!resourceDescription.trim()) {
      setAssetUploadError("Asset description is required for the uploaded file.");
      return;
    }

    try {
      // Use filename as default resource name if none provided
      const resourceName = resourceDescription || resourceFile.name;

      // Store the resource in state
      setResources({
        ...resources,
        [resourceName]:
          resourceFilePreview || URL.createObjectURL(resourceFile),
      });

      // Store the file reference for later upload
      setResourceFiles({
        ...resourceFiles,
        [resourceName]: resourceFile,
      });

      // Reset form
      removeResourceFile();
      toast({ title: "Success", description: "Asset added successfully!" });
    } catch (error: any) {
      console.error("Error adding resource:", error);
      toast({ title: "Error", description: `Failed to add asset: ${error.message}`, variant: "destructive" });
    }
  };

  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleSaveDraft = async () => {
    try {
      // Reset global form feedback
      setFormFeedback(null);
      setFormFeedbackType(null);
      setIsLoading(true);
      setUploadProgress("Saving draft...");

      // Capture brief content if we're on the brief step and not showing preview
      // If showing preview, the content is already captured
      if ((step === "brief" || step === "resources" || step === "prize") && !showBriefPreview) {
        captureBriefContent();
      }

      // Add timeout to clear loading state if something goes wrong
      const draftTimeoutId = setTimeout(() => {
        setIsLoading(false);
        setUploadProgress(null);
        toast({ title: "Error", description: "Draft save timed out. Please try again.", variant: "destructive" });
      }, 30000); // 30 second timeout as safety measure

      // Get the authenticated user first to verify we're logged in
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        toast({ title: "Error", description: "You must be logged in to save drafts", variant: "destructive" });
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
      toast({ title: "Error", description: `Failed to save draft: ${error.message || "Unknown error"}`, variant: "destructive" });
      setIsLoading(false);
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    // Reset global form feedback
    setFormFeedback(null);
    setFormFeedbackType(null);
    setIsLoading(true);


    let prepTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

    try {
      if (isDraft && !title) {
        setFormFeedback("Title is required even for drafts"); // Footer feedback
        setFormFeedbackType("error");
        setIsLoading(false);
        setUploadProgress(null);
        return;
      }

      const userId = user?.id;
      if (!isDraft && !userId) {
        setFormFeedback("User information not available. Please refresh the page and try again."); // Footer feedback
        setFormFeedbackType("error");
        setIsLoading(false);
        setUploadProgress(null);
        return;
      }

      let contestBasedDetails: any = {};

      if (contestType === "leaderboard") {
        // Client-side validation for prize amounts for leaderboard
        for (let i = 0; i < winnerCount; i++) {
          if (!winnerAmounts[i] || winnerAmounts[i] < MIN_PRIZE_PER_WINNER) {
            setFormFeedback(`Prize for Winner ${i + 1} must be at least ${formatCurrency(MIN_PRIZE_PER_WINNER)}`); // Footer feedback
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
            setIsLoading(false); setUploadProgress(null); return;
          }
          if (!totalBudget || parseFloat(totalBudget.toString()) <= 0) {
            setFormFeedback("Total Budget must be a positive number for CPM contests."); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false); setUploadProgress(null); return;
          }
          if (!termsConditions) {
            setFormFeedback("Terms & Conditions are required for CPM contests."); // Footer feedback
            setFormFeedbackType("error");
            setIsLoading(false); setUploadProgress(null); return;
          }
        }
        contestBasedDetails = {
          cpm_contest: {
            cpm_rate_usd: parseFloat(cpmRate.toString()) || 0,
            min_views: minViews && minViews.toString().trim() !== "" ? parseInt(minViews.toString(), 10) : null,
            max_views: maxViews && maxViews.toString().trim() !== "" ? parseInt(maxViews.toString(), 10) : null,
            total_budget: (parseFloat(totalBudget.toString()) || 0) * 100, // Convert to cents
            budget_spent: 0, // Initial value
            terms_conditions: termsConditions,
            // tiered_payouts: [] // Future use
          },
        };
      }

      // Only run these validations if we're not in draft mode
      if (!isDraft) {
        setUploadProgress("Preparing contest...");
        prepTimeoutId = setTimeout(() => {
          if (isLoading && uploadProgress === "Preparing contest...") {
            console.log("Contest creation taking longer than expected...");
            setUploadProgress("Validating contest details...");
          }
        }, 5000);

        // Validate subscription plan requirements
        const planFeatures = getPlanFeatures(userPlan);

        // Validate budget requirements
        if (contestType === "leaderboard") {
          if (totalPrizePool < planFeatures.minContestBudget) {
            setFormFeedback(`The minimum prize pool for your plan is ${formatCurrency(planFeatures.minContestBudget)}. Please increase your prize amounts.`);
            setFormFeedbackType("error");
            setIsLoading(false); setUploadProgress(null); return;
          }

          // Validate maximum winners
          if (winnerCount > planFeatures.maxWinnersPerContest) {
            setFormFeedback(`Your plan allows a maximum of ${planFeatures.maxWinnersPerContest} winners. Please reduce the number of winners.`);
            setFormFeedbackType("error");
            setIsLoading(false); setUploadProgress(null); return;
          }
        } else if (contestType === "cpm") {
          const budgetInCents = (parseFloat(totalBudget.toString()) || 0) * 100;
          if (budgetInCents < planFeatures.minContestBudget) {
            setFormFeedback(`The minimum contest budget for your plan is ${formatCurrency(planFeatures.minContestBudget)}. Please increase your total budget.`);
            setFormFeedbackType("error");
            setIsLoading(false); setUploadProgress(null); return;
          }
        }

        // TODO: Add validation for maximum active contests if needed
        // This would require fetching the current count of active contests for the user
        // and comparing it against planFeatures.maxActiveContests

        if (!thumbnail && !thumbnailPreview) {
          setFormFeedback("Contest thumbnail is required");
          setFormFeedbackType("error");
          setIsLoading(false); setUploadProgress(null); return;
        }
        if (!brief) {
          setFormFeedback("Contest brief is required");
          setFormFeedbackType("error");
          setIsLoading(false); setUploadProgress(null); return;
        }
        // Capture rules content before validation
        const currentRulesHtml = captureRulesContent();
        // Also check the existing rulesHtml state as fallback
        const rulesToValidate = currentRulesHtml || rulesHtml;

        console.log("Rules validation - currentRulesHtml:", currentRulesHtml?.substring(0, 100));
        console.log("Rules validation - rulesHtml state:", rulesHtml?.substring(0, 100));
        console.log("Rules validation - final rulesToValidate:", rulesToValidate?.substring(0, 100));

        if (!rulesToValidate || isQuillEmpty(rulesToValidate)) {
          setFormFeedback("Contest rules are required");
          setFormFeedbackType("error");
          setIsLoading(false); setUploadProgress(null); return;
        }
        if (!startDate || !startTime || !endDate || !endTime) {
          setFormFeedback("Contest start and end dates/times are required for publishing");
          setFormFeedbackType("error");
          setIsLoading(false); setUploadProgress(null); return;
        }
        try {
          const startDateTime = new Date(`${startDate}T${startTime}`);
          const endDateTime = new Date(`${endDate}T${endTime}`);
          const now = new Date();
          if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            setFormFeedback("Invalid date or time format. Please check your entries.");
            setFormFeedbackType("error");
            setIsLoading(false); setUploadProgress(null); return;
          }
          if (startDateTime < now) {
            setFormFeedback("Contest start time must be in the future");
            setFormFeedbackType("error");
            setIsLoading(false); setUploadProgress(null); return;
          }
          if (endDateTime <= startDateTime) {
            setFormFeedback("Contest end time must be after the start time");
            setFormFeedbackType("error");
            setIsLoading(false); setUploadProgress(null); return;
          }
          const durationMs = endDateTime.getTime() - startDateTime.getTime();
          const oneDayMs = 24 * 60 * 60 * 1000;
          if (durationMs < oneDayMs) {
            setFormFeedback("Contest duration must be at least 1 day");
            setFormFeedbackType("error");
            setIsLoading(false); setUploadProgress(null); return;
          }
        } catch (error) {
          console.error("Date validation error:", error);
          setFormFeedback("There was an error with the date/time format. Please check your entries.");
          setFormFeedbackType("error");
          setIsLoading(false); setUploadProgress(null); return;
        }
      }

      let thumbnailUrl = thumbnailPreview && !thumbnail ? thumbnailPreview : ""; // Default to existing preview if no new file

      // Only upload a new thumbnail if a new file is staged and it's different from the preview, or if no preview exists yet.
      if (thumbnail) { // A new file has been selected by the user
        setUploadProgress(isDraft ? "Uploading thumbnail..." : "Uploading thumbnail (1/2)...");
        try {
          const isStorageAvailable = await checkStorageAvailability();
          if (!isStorageAvailable) {
            if (!isDraft) {
              toast({ title: "Storage Error", description: "Unable to upload thumbnail due to storage configuration. Contest will be created without a thumbnail.", variant: "destructive" });
            } else {
              // For drafts, we might allow saving without re-uploading if storage is temporarily down, relying on existing URL if present
              console.warn("Storage not available for draft thumbnail upload. If a previous URL exists, it will be used.");
              if (!thumbnailPreview || thumbnailPreview.startsWith("data:")) {
                thumbnailUrl = ""; // No existing valid URL to reuse
              }
              // else, thumbnailUrl already holds thumbnailPreview from above, so it will be reused.
            }
          } else {
            // New upload logic
            const fileName = `contest_thumbnails/${userId}_${Date.now()}_${thumbnail.name.replace(/\s+/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from("contest-assets").upload(fileName, thumbnail);
            if (uploadError) throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
            const { data: publicUrlData } = supabase.storage.from("contest-assets").getPublicUrl(fileName);
            thumbnailUrl = publicUrlData?.publicUrl || "";
            if (isDraft) {
              setThumbnail(null); // Clear the File object
              setThumbnailPreview(thumbnailUrl); // Update preview to use the URL
            }
          }
        } catch (error: any) {
          toast({ title: "Thumbnail Upload Error", description: `Thumbnail upload failed: ${error.message}`, variant: "destructive" });
          setIsLoading(false); setUploadProgress(null); return;
        }
      } else if (!thumbnailPreview) {
        // If no new file AND no existing preview (e.g., user removed it)
        thumbnailUrl = "";
      }
      // If thumbnail is null BUT thumbnailPreview has a URL (from a previous save), thumbnailUrl is already set to thumbnailPreview correctly.

      if (Object.keys(resourceFiles).length > 0) {
        setUploadProgress(isDraft ? "Uploading assets..." : "Uploading assets (2/2)...");
        try {
          const isStorageAvailable = await checkStorageAvailability();
          if (!isStorageAvailable) {
            if (isDraft) console.warn("Storage not available, continuing with draft save without uploading resources");
          } else {
            const resourceUploadPromises = [];
            const failedUploads = [];
            for (const [name, file] of Object.entries(resourceFiles)) {
              try {
                const fileName = `contest_resources/${userId}_${Date.now()}_${file.name}`;
                const uploadPromise = supabase.storage.from("contest-assets").upload(fileName, file)
                  .then(({ data: uploadData, error: uploadError }) => {
                    if (uploadError) {
                      failedUploads.push(name);
                      if (!isDraft) throw new Error(`Failed to upload resource: ${uploadError.message}`);
                      return null;
                    }
                    const result = supabase.storage.from("contest-assets").getPublicUrl(fileName);
                    const resourceUrl = result.data.publicUrl || "";
                    resources[name] = resourceUrl;
                    return resourceUrl;
                  })
                  .catch((err) => {
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
            await Promise.allSettled(resourceUploadPromises);
            if (failedUploads.length > 0 && isDraft) console.warn(`Some resource uploads failed: ${failedUploads.join(", ")}`);
          }
        } catch (error) {
          console.error("Error handling resource uploads:", error);
          if (!isDraft) {
            setIsLoading(false); setUploadProgress(null); return;
          }
        }
      }

      let formattedStartDate = null;
      let formattedEndDate = null;
      try {
        if (!isDraft) {
          if (startDate && startTime) formattedStartDate = toUTCISOString(startDate, startTime);
          if (endDate && endTime) formattedEndDate = toUTCISOString(endDate, endTime);
          if ((startDate && startTime && !formattedStartDate) || (endDate && endTime && !formattedEndDate)) throw new Error("Invalid date/time format for submission");
        } else {
          if (startDate && startTime) formattedStartDate = toUTCISOString(startDate, startTime);
          if (endDate && endTime) formattedEndDate = toUTCISOString(endDate, endTime);
        }
      } catch (error) {
        console.error("Error formatting dates for submission:", error);
        if (!isDraft) {
          setFormFeedback("There was a problem with the date format. Please check the start and end dates.");
          setFormFeedbackType("error");
          setIsLoading(false); setUploadProgress(null); return;
        }
      }

      setUploadProgress(isDraft ? "Finalizing draft..." : "Creating contest...");
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
        subscription_plan_of_user: userPlan,
        is_draft: isDraft,
        start_date: formattedStartDate,
        end_date: formattedEndDate,
        contest_type: contestType, // Added contest_type
        contest_based_details: contestBasedDetails, // Added contest_based_details
      };

      let responseData, responseError;
      if (draftId) {
        const response = await supabase.from("contests").update(contestData).eq("id", draftId).select();
        responseData = response.data;
        responseError = response.error;
      } else {
        const response = await supabase.from("contests").insert([contestData]).select(); // insert expects an array
        responseData = response.data;
        responseError = response.error;
      }

      if (responseError) throw responseError;

      if (isDraft && !draftId && responseData && responseData.length > 0) {
        setDraftId(responseData[0].id);
      }

      if (!isDraft) {
        setUploadProgress("Contest created successfully! Redirecting...");
        if (prepTimeoutId !== undefined) clearTimeout(prepTimeoutId);
        toast({ title: "Success", description: "Contest created successfully!" });
        setTimeout(() => { router.push("/dashboard/contests"); }, 1000);
      } else {
        // This 'else' block is for draft saving if handleSubmit is directly called with isDraft=true.
        setResourceFiles({});
        if (prepTimeoutId !== undefined) clearTimeout(prepTimeoutId);
        setIsLoading(false);
        setUploadProgress(null);
        toast({ title: "Success", description: "Draft saved successfully!" });
      }
    } catch (err: any) {
      console.error("Error submitting contest:", err);
      if (prepTimeoutId !== undefined) clearTimeout(prepTimeoutId);
      // API errors use toast
      if (err.message && err.message.includes("timestamp with time zone")) {
        toast({ title: "Error", description: "Invalid date format. Please make sure all dates and times are properly set.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: `Failed to ${isDraft ? "save draft" : "create contest"}: ${err.message || "Unknown error"}`, variant: "destructive" });
      }
      setIsLoading(false);
      setUploadProgress(null);
    }
  };

  const addResource = () => {
    setExternalLinkError(null); // Clear previous external link error

    if (!newResourceUrl.trim()) {
      setExternalLinkError("Resource link cannot be empty.");
      return;
    }

    // Basic URL validation
    try {
      new URL(newResourceUrl);
    } catch (_) {
      setExternalLinkError("Invalid URL format.");
      return;
    }

    if (!externalResourceDescription.trim()) {
      setExternalLinkError("Resource description cannot be empty for external link.");
      return;
    }

    // If all checks pass, add the resource
    const resourceName = externalResourceDescription || "External Resource";
    setResources({
      ...resources,
      [resourceName]: newResourceUrl,
    });
    setNewResourceUrl("");
    setExternalResourceDescription("");
    toast({ title: "Success", description: "External resource added!" });
  };

  const removeResource = async (name: string) => {
    try {
      // Get the URL from resources
      const url = resources[name];

      // Only attempt deletion if it's a Supabase storage URL
      if (
        url &&
        url.includes("supabase.co/storage/v1/object/public/contest-assets/")
      ) {
        // Extract file path from URL
        const filePath = url.split("public/contest-assets/")[1];

        if (filePath) {
          // Delete the file from storage
          const { error } = await supabase.storage
            .from("contest-assets")
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
      setInspirationLinks([...inspirationLinks, newInspirationLink]);
      setNewInspirationLink("");
    }
  };

  const removeInspirationLink = (link: string) => {
    setInspirationLinks(inspirationLinks.filter((l) => l !== link));
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
        toast({ title: "Validation Error", description: `Prize amount for Winner ${index + 1} cannot be less than ${formatCurrency(MIN_PRIZE_PER_WINNER)}`, variant: "destructive" });
      } else if (numValue > MAX_PRIZE_PER_WINNER) {
        toast({ title: "Validation Error", description: `Prize amount for Winner ${index + 1} cannot exceed ${formatCurrency(MAX_PRIZE_PER_WINNER)}`, variant: "destructive" });
      }
    }
  };

  // Keep the original function for backward compatibility


  const updateTotalPrizePool = (amounts = winnerAmounts) => {
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    setTotalPrizePool(total);
  };

  const handleWinnerCountChange = (count: number) => {
    const planFeatures = getPlanFeatures(
      userPlan || subscriptionPlans[0].id
    );

    if (count > planFeatures.maxWinnersPerContest) {
      toast({ title: "Plan Limit", description: `Your ${userPlan || "current"} plan is limited to ${planFeatures.maxWinnersPerContest} winners per contest. Upgrade your plan for more.`, variant: "destructive" });
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

  const nextStep = async () => {
    setFormFeedback(null); // Clear previous global form feedback
    setFormFeedbackType(null);

    // Validate only what's needed for the current step
    if (step === "basics") {
      if (!title) {
        setFormFeedback("Please enter a contest title"); // Footer feedback
        setFormFeedbackType("error");
        return;
      }
      if (!thumbnail && !thumbnailPreview) {
        setFormFeedback("Please upload a thumbnail for your contest"); // Footer feedback
        setFormFeedbackType("error");
        return;
      }
      setStep("brief");
    } else if (step === "brief") {
      // Small delay to ensure state is updated from editor
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture content from rich text editor before validation
      const currentBrief = captureBriefContent();
      const currentRules = captureRulesContent();

      // Also check the current brief state as a fallback
      const briefToCheck = currentBrief || briefHtml;
      const rulesToCheck = currentRules || rulesHtml;

      console.log("Brief validation - currentBrief:", currentBrief?.substring(0, 50));
      console.log("Brief validation - briefHtml state:", briefHtml?.substring(0, 50));

      if (isQuillEmpty(briefToCheck)) {
        setFormFeedback("Please enter a brief description for your contest"); // Footer feedback
        setFormFeedbackType("error");
        return;
      }
      if (isQuillEmpty(rulesToCheck)) {
        setFormFeedback("Please provide rules for your contest"); // Footer feedback
        setFormFeedbackType("error");
        return;
      }
      setStep("resources");
    } else if (step === "resources") {
      // No specific blocking validation for the entire "resources" step defined here for nextStep
      // Individual resource additions handle their own feedback internally.
      setStep("prize");
    }
  };

  const prevStep = () => {
    setFormFeedback(null); // Clear feedback when going back
    setFormFeedbackType(null);
    if (step === "prize") setStep("resources");
    else if (step === "resources") setStep("brief");
    else if (step === "brief") setStep("basics");
  };

  const isNextDisabled = () => {
    const planFeatures = getPlanFeatures(userPlan); // Add this line to fix undefined planFeatures

    if (step === "basics") return !title || (!thumbnail && !thumbnailPreview); // Updated to match nextStep validation
    if (step === "brief") {
      // For brief step, we'll allow proceeding and validate in nextStep
      // This prevents the editor from being blocked while user is typing
      return false; // Allow proceeding, validation will happen in nextStep for both brief and rules
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
        setUserPlan(subscriptionPlans[0].id); // Default to free plan
        return;
      }

      const userId = authData.user.id;

      // First check advertiser_profiles
      try {
        const { data: advertiserData, error: advertiserError } = await supabase
          .from("advertiser_profiles")
          .select("subscription_plan")
          .eq("id", userId)
          .single();

        if (!advertiserError && advertiserData?.subscription_plan) {
          setUserPlan(advertiserData.subscription_plan);
          return;
        }
      } catch (err) {
        console.error("Error fetching advertiser profile:", err);
      }

      // If we couldn't find a subscription anywhere, default to 'free'
      setUserPlan(subscriptionPlans[0].id);
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
      // Attempt to find the 'free' plan by name if ID fails, or use the first available plan, or default
      const freePlan = dbSubscriptionPlans.find(
        (p) => p.name.toLowerCase() === "FREE"
      );
      return (
        dbSubscriptionPlans[0]?.features ||
        freePlan?.features ||
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
    setTitle(draft.title || "");
    setCategory(draft.category || "technology");
    setPlatform(draft.platform || "youtube"); // Load platform, default if not present
    // If thumbnail URL is available, show it in the preview
    if (draft.thumbnail_url) {
      setThumbnailPreview(draft.thumbnail_url);
    }
    setDraftId(draft.id);

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
    if (typeof draft.inspiration_links === 'string') {
      try {
        const parsedLinks = JSON.parse(draft.inspiration_links);
        if (Array.isArray(parsedLinks)) {
          setInspirationLinks(parsedLinks);
        } else {
          // Parsed, but not an array - treat as empty or log error
          setInspirationLinks([]);
          console.warn("Parsed inspiration_links was not an array:", parsedLinks);
        }
      } catch (e) {
        // JSON parsing failed - treat as empty or log error
        setInspirationLinks([]);
        console.error("Failed to parse inspiration_links JSON string:", e);
      }
    } else if (Array.isArray(draft.inspiration_links)) {
      // This covers cases where inspiration_links is already an array (e.g., from a previous client-side draft save)
      setInspirationLinks(draft.inspiration_links);
    } else if (draft.inspiration_links === null && Object.prototype.hasOwnProperty.call(draft, 'inspiration_links')) {
      // If inspiration_links is explicitly null in the draft data (e.g. from DB column being NULL)
      setInspirationLinks([]); // Reset to an empty array, overriding the default
    }
    // If draft.inspiration_links is undefined (key not in draft object), the default state from useState remains (empty array as per initial state).



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
    // Function to fetch subscription plans from the database
    const fetchSubscriptionPlans = async () => {
      setIsPlansLoading(true);
      try {
        const { data: plansData, error: plansError } = await supabase
          .from("subscription_plans")
          .select("id, name, price, json_features");

        if (plansError) {
          throw plansError;
        }

        if (plansData) {
          // Map the data from the DB to the SubscriptionPlan structure
          const mappedPlans: SubscriptionPlan[] = plansData.map(
            (plan: any) => ({
              id: plan.id,
              name: plan.name,
              price: plan.price, // Assuming price is stored correctly (e.g., in cents)
              features: {
                // Safely access nested properties from json_features
                // Provide default values if properties are missing
                maxActiveContests:
                  plan.json_features?.maxActiveContests ??
                  subscriptionPlans[0].features.maxActiveContests,
                minContestBudget:
                  plan.json_features?.minContestBudget ??
                  subscriptionPlans[0].features.minContestBudget,
                maxWinnersPerContest:
                  plan.json_features?.maxWinnersPerContest ??
                  subscriptionPlans[0].features.maxWinnersPerContest,
                commisionPercentage:
                  plan.json_features?.commisionPercentage ??
                  subscriptionPlans[0].features.commisionPercentage, // Check DB for actual key name
              },
            })
          );
          setDbSubscriptionPlans(mappedPlans);
        } else {
          setDbSubscriptionPlans([]); // Set to empty array if no data
        }
      } catch (error: any) {
        console.error("Error fetching subscription plans:", error);
        toast({ title: "Error", description: `Failed to load subscription plans: ${error.message}. Using defaults.`, variant: "destructive" });
        setDbSubscriptionPlans([]);
      } finally {
        setIsPlansLoading(false);
      }
    };

    // Modified to handle storage errors more gracefully
    const initializeData = async () => {
      try {
        setIsPlansLoading(true); // Ensure loading state is set initially
        await fetchSubscriptionPlans(); // Fetch plans first
        await checkStorageAvailability();
        await getUserPlan(); // getUserPlan might depend on fetched plans if defaults change
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

  // Get minimum allowed start date and time (current date/time)
  const getMinDateTime = () => {
    const now = new Date();
    return {
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(now.getDate()).padStart(2, "0")}`,
      time: `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`,
    };
  };

  // Get minimum allowed start time for today
  const getMinStartTime = () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;

    // If selected date is today, return current time
    if (startDate === today) {
      return `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes() + 1
      ).padStart(2, "0")}`;
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

    return `${startDateObj.getFullYear()}-${String(
      startDateObj.getMonth() + 1
    ).padStart(2, "0")}-${String(startDateObj.getDate()).padStart(2, "0")}`;
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

  // High Budget Prompt Modal
  const HighBudgetPromptModal = () => {
    if (!showHighBudgetPrompt) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full">
          <h3 className="text-xl font-bold mb-4">High Value Contest</h3>
          <p className="mb-4">
            For contests with budgets over{" "}
            {formatCurrency(HIGH_BUDGET_THRESHOLD)}, we recommend reaching out
            to our team for personalized guidance and support.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowHighBudgetPrompt(false)}
            >
              Continue Anyway
            </Button>
            <Button
              onClick={() => {
                setShowHighBudgetPrompt(false);
                // Logic to contact the team could be added here
                window.open("mailto:support@gameofcreators.com", "_blank");
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
        <CardHeader>
          <CardTitle>
            {contestType === 'leaderboard' ? 'Prize & Duration' : 'CPM Configuration & Duration'}
          </CardTitle>
          <CardDescription>
            Configure the financial aspects, duration, and terms for your contest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Current Plan Details */}
          <div className="border rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">Your Current Plan</h3>
            {currentPlan ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center ${userPlan === subscriptionPlans[0].id
                      ? "bg-gray-300" // Free plan
                      : userPlan === subscriptionPlans[1].id
                        ? "bg-bronze-500" // Bronze plan
                        : userPlan === subscriptionPlans[2].id
                          ? "bg-silver-500" // Silver plan
                          : userPlan === subscriptionPlans[3].id
                            ? "bg-yellow-500" // Gold plan
                            : userPlan === subscriptionPlans[4].id
                              ? "bg-yellow-400" // Platinum plan
                              : userPlan === subscriptionPlans[5].id
                                ? "bg-blue-500" // Diamond plan
                                : "bg-gray-300"
                      }`}

                  >
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">
                      {currentPlan.name || "FREE"} Plan
                    </h4>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(currentPlan.price)}/month
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Max Winners Per Contest:</span>
                    <span className="font-medium">
                      {planFeatures.maxWinnersPerContest}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Budget Per Contest:</span>
                    <span className="font-medium">
                      {formatCurrency(planFeatures.minContestBudget)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Active Contests:</span>
                    <span className="font-medium">
                      {planFeatures.maxActiveContests}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Commission Percentage on Total Prize Pool:</span>
                    <span className="font-medium">
                      {planFeatures.commisionPercentage}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-2">
                  You don't have an active subscription plan.
                </p>
                <Button
                  asChild
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
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
                  min={
                    startDate === getMinDateTime().date
                      ? getMinDateTime().time
                      : undefined
                  }
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
              Contest duration must be at least 1 day. The end date will
              automatically adjust to maintain this minimum duration.
            </p>
          </div>

          <Separator className="my-6" />

          {/* Conditional UI based on contestType */}
          {contestType === 'leaderboard' ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {/* This is the specific "Prize distribution" heading for leaderboard */}
                  <h3 className="text-lg font-medium">Prize Distribution</h3>
                  <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                    <span className="text-sm font-medium">Total Prize Pool:</span>
                    <span className="text-lg font-bold">
                      {formatCurrency(totalPrizePool)}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-4 mb-4">
                    <Label className="w-48">
                      Number of Winners{' '}
                      <span className="text-xs text-gray-500">(Required)</span>
                    </Label>
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
                        Allowed:{' '}
                        {planFeatures.maxWinnersPerContest === Infinity
                          ? 'Unlimited'
                          : planFeatures.maxWinnersPerContest}
                      </span>
                    </div>
                  </div>
                  {Array.from({ length: Math.min(winnerCount, 10) }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 mb-2">
                      <Label className="w-48">Winner {i + 1}</Label>
                      <Input
                        type="number"
                        step="1"
                        // Ensure value is in dollars for display
                        // value={winnerAmounts[i] ? winnerAmounts[i] / 100 : (MIN_PRIZE_PER_WINNER / 100)}
                        value={winnerAmounts[i] / 100}
                        onChange={(e) =>
                          handleWinnerAmountChange(i, e.target.value) // Expects dollars
                        }
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
              </div>
              {totalPrizePool < planFeatures.minContestBudget && (
                <Alert className="mt-2">
                  <AlertDescription>
                    The minimum prize pool for your{' '}
                    {currentPlan?.name || 'current'} plan is{' '}
                    {formatCurrency(planFeatures.minContestBudget)}. Please
                    increase your prize amounts.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : ( // contestType === "cpm"
            <>
              <div className="space-y-6 p-4 border rounded-md">
                <h3 className="text-lg font-medium">CPM Contest Configuration</h3>
                <div className="space-y-2">
                  <Label htmlFor="cpmRatePrize">CPM Rate (USD)</Label>
                  <Input
                    id="cpmRatePrize"
                    type="number"
                    value={cpmRate}
                    onChange={(e) => setCpmRate(e.target.value)}
                    placeholder="e.g., 1.50 for $1.50 per 1000 views"
                    min="0.01"
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">
                    Amount paid to creators per 1000 views.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minViewsPrize">Minimum Views (Optional)</Label>
                    <Input
                      id="minViewsPrize"
                      type="number"
                      value={minViews}
                      onChange={(e) => setMinViews(e.target.value)}
                      placeholder="e.g., 10000"
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum views required for a submission to be eligible for payment.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxViewsPrize">Maximum Views (Optional)</Label>
                    <Input
                      id="maxViewsPrize"
                      type="number"
                      value={maxViews}
                      onChange={(e) => setMaxViews(e.target.value)}
                      placeholder="e.g., 1000000"
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum views for which a submission will be paid.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalBudgetPrize">Total Contest Budget (USD)</Label>
                  <Input
                    id="totalBudgetPrize"
                    type="number"
                    value={totalBudget} // This is a string from state, input type handles conversion
                    onChange={(e) => {
                      const newBudgetString = e.target.value;
                      setTotalBudget(newBudgetString); // Keep as string for input
                      const newBudgetNumber = parseFloat(newBudgetString);
                      if (!isNaN(newBudgetNumber) && newBudgetNumber > HIGH_BUDGET_THRESHOLD && !hasExceededBudgetThreshold) {
                        setShowHighBudgetPrompt(true);
                        setHasExceededBudgetThreshold(true);
                      }
                    }}
                    placeholder="e.g., 10000"
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    The maximum total amount to be paid out for this contest. This is the effective prize pool.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="termsConditionsPrize">Terms & Conditions</Label>
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
              {parseFloat(totalBudget.toString() || "0") * 100 < planFeatures.minContestBudget && (totalBudget.toString() || "0").length > 0 && (
                <Alert className="mt-2">
                  <AlertDescription>
                    The minimum contest budget for your {currentPlan?.name || "current"} plan is{' '}
                    {formatCurrency(planFeatures.minContestBudget)}. Please increase your total budget.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
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
          if (
            url &&
            url.includes("supabase.co/storage/v1/object/public/contest-assets/")
          ) {
            // Extract file path from URL
            const filePath = url.split("public/contest-assets/")[1];

            if (filePath) {
              // Delete the file from storage
              await supabase.storage.from("contest-assets").remove([filePath]);
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
        const { data: resourceFiles, error: resourceError } =
          await supabase.storage
            .from("contest-assets")
            .list(`contest_resources`, {
              search: `${userId}_${contestId}`,
            });

        if (resourceError) {
          console.error("Error listing resource files:", resourceError);
        } else if (resourceFiles && resourceFiles.length > 0) {
          // Delete all found resource files
          const resourceFilePaths = resourceFiles.map(
            (file) => `contest_resources/${file.name}`
          );
          await supabase.storage
            .from("contest-assets")
            .remove(resourceFilePaths);
        }
      } catch (err) {
        console.error("Error deleting resource files:", err);
      }

      // For thumbnails
      try {
        // List files in the contest_thumbnails folder
        const { data: thumbnailFiles, error: thumbnailError } =
          await supabase.storage
            .from("contest-assets")
            .list(`contest_thumbnails`, {
              search: `${userId}_${contestId}`,
            });

        if (thumbnailError) {
          console.error("Error listing thumbnail files:", thumbnailError);
        } else if (thumbnailFiles && thumbnailFiles.length > 0) {
          // Delete all found thumbnail files
          const thumbnailFilePaths = thumbnailFiles.map(
            (file) => `contest_thumbnails/${file.name}`
          );
          await supabase.storage
            .from("contest-assets")
            .remove(thumbnailFilePaths);
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
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full 
                ${step === "basics"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-600 text-white"
                  }`}
              >
                <span className="text-sm font-medium">1</span>
              </div>
              <span className="text-sm font-medium">Get Started</span>
            </div>

            <div className={`relative z-10 flex flex-col items-center gap-1`}>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full 
                ${step === "brief" || step === "resources" || step === "prize"
                    ? "bg-rose-600 text-white"
                    : "bg-gray-300 text-gray-700"
                  }`}
              >
                <span className="text-sm font-medium">2</span>
              </div>
              <span className="text-sm font-medium">Create Brief</span>
            </div>

            <div className={`relative z-10 flex flex-col items-center gap-1`}>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full 
                ${step === "resources" || step === "prize"
                    ? "bg-rose-600 text-white"
                    : "bg-gray-300 text-gray-700"
                  }`}
              >
                <span className="text-sm font-medium">3</span>
              </div>
              <span className="text-sm font-medium">Resources</span>
            </div>

            <div className={`relative z-10 flex flex-col items-center gap-1`}>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full 
                ${step === "prize"
                    ? "bg-rose-600 text-white"
                    : "bg-gray-300 text-gray-700"
                  }`}
              >
                <span className="text-sm font-medium">4</span>
              </div>
              <span className="text-sm font-medium">Prize</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <Card className="mx-auto max-w-4xl">
        {/* Removed global success Alert (for draft save) that was at the top of the card */}

        {step === "basics" && (
          <>
            <CardHeader>
              <CardTitle>Create a new contest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Removed general validationError Alert from CardContent */}

              {/* Contest Type Selection */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Contest Type</Label>
                <RadioGroup
                  value={contestType}
                  onValueChange={(value: "leaderboard" | "cpm") => setContestType(value)}
                  className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-2"
                >
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground cursor-pointer flex-1">
                    <RadioGroupItem value="leaderboard" id="leaderboard" />
                    <Label htmlFor="leaderboard" className="cursor-pointer">
                      <span className="font-medium">Leaderboard Contest</span>
                      <p className="text-xs text-muted-foreground">Creators compete for top spots based on performance. Prizes are awarded to winners.</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground cursor-pointer flex-1">
                    <RadioGroupItem value="cpm" id="cpm" />
                    <Label htmlFor="cpm" className="cursor-pointer">
                      <span className="font-medium">CPM Based Contest</span>
                      <p className="text-xs text-muted-foreground">Creators are paid based on the number of views their content receives, at a pre-defined CPM rate.</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Add contest title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                <p className="text-xs text-muted-foreground mt-1">
                  Choose the platform where creators will submit content.
                </p>
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
                          className="text-red-500"
                        >
                          <Trash className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Image className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm font-medium mb-1">
                        Drag, drop or browse thumbnail
                      </p>
                      <p className="text-xs text-gray-500 mb-4">
                        Max file size: 5MB
                      </p>
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
            <CardFooter className="flex justify-between items-center pt-6">
              {formFeedback && formFeedbackType === 'error' && (
                <div className="text-sm text-red-600 mr-auto flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 shrink-0" /> {formFeedback}
                </div>
              )}
              <div className={`flex gap-2 ${formFeedback && formFeedbackType === 'error' ? 'ml-4' : 'ml-auto'}`}> {/* Adjust margin based on feedback presence */}
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
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
              {/* Optional: Add CardDescription if needed */}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* formFeedback display removed from CardContent for brief step, it's in the CardFooter */}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="project-brief">Brief / Project Description</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={toggleBriefPreview}
                    >
                      {showBriefPreview ? 'Edit' : 'Preview'}
                    </Button>
                  </div>
                </div>

                {showBriefPreview ? (
                  <div className="border rounded-lg p-4 min-h-[300px] bg-white">
                    <h4 className="text-sm font-medium mb-2 text-gray-600">Preview:</h4>
                    <div
                      className="prose prose-lg dark:prose-invert prose-headings:font-title font-default max-w-none"
                      style={{
                        padding: '12px 15px',
                        minHeight: '250px',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: brief || '<p class="text-gray-400">No content yet. Click "Edit" to add content.</p>'
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
                        console.log("Novel editor onChange - html:", html?.substring(0, 50));
                        console.log("Novel editor onChange - json:", json);
                        setBrief(html); // Keep for backward compatibility
                        setBriefHtml(html);
                        setBriefJson(json);
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Inspiration Content:</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {inspirationLinks.map((link, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-rose-600 underline"
                      >
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
                    placeholder="Add any video inspiration link (e.g., instagram, YouTube)"
                    value={newInspirationLink}
                    onChange={(e) => setNewInspirationLink(e.target.value)}
                  />
                  <Button
                    onClick={addInspirationLink}
                    disabled={!newInspirationLink}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Set rules</h3>
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
                      }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center pt-6">
              {formFeedback && formFeedbackType === 'error' && (
                <div className="text-sm text-red-600 mr-auto flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 shrink-0" /> {formFeedback}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isLoading}
                className={`${!(formFeedback && formFeedbackType === 'error') ? 'mr-auto' : ''}`}
              >
                Back
              </Button>
              <div className={`flex gap-2 ${formFeedback && formFeedbackType === 'error' ? 'ml-4' : 'ml-auto'}`}>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
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
              {/* General Alerts for error/success/validation removed from top of CardContent */}

              {/* Resources Section */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-2">
                  Resources for Participants
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add resources that will help participants understand your
                  brand and contest requirements. You can upload assets and add
                  external links.
                </p>

                <div className="space-y-6">
                  {/* File Upload Container */}
                  <div className="border rounded-lg p-4">
                    {/* Section-specific feedback for Upload Asset */}
                    {assetUploadError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="h-4 w-4 mr-1 shrink-0" />
                        <AlertDescription>{assetUploadError}</AlertDescription>
                      </Alert>
                    )}
                    <h4 className="text-md font-medium mb-2">Upload Asset</h4>

                    {/* File Uploader - Placed before description */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4">
                      {resourceFilePreview ? (
                        <div className="relative">
                          {resourceFilePreview.startsWith("data:image") ? (
                            <img
                              src={resourceFilePreview}
                              alt="Resource preview"
                              className="mx-auto max-h-64 object-contain"
                            />
                          ) : (
                            // Display for non-image files (PDF, Video, Audio, etc.)
                            <div className="mx-auto py-4 text-center">
                              {resourceFilePreview.startsWith(
                                "file-type:application/pdf"
                              ) && (
                                  <div className="flex flex-col items-center">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-16 w-16 text-red-500"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M8.267 14.68c-.184 0-.308.018-.372.036v1.178c.076.018.171.023.302.023.479 0 .774-.242.774-.651 0-.366-.254-.586-.704-.586zm3.487.012c-.2 0-.33.018-.407.036v2.61c.077.018.201.018.313.018.817.006 1.349-.444 1.349-1.396.006-.83-.479-1.268-1.255-1.268z" />
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM9.498 16.19c-.309.29-.765.42-1.296.42a2.23 2.23 0 0 1-.308-.018v1.426H7v-3.936A7.558 7.558 0 0 1 8.219 14c.557 0 .953.106 1.22.319.254.202.426.533.426.923-.001.392-.131.723-.367.948zm3.807 1.355c-.42.349-1.059.515-1.84.515-.468 0-.799-.03-1.024-.06v-3.917A7.947 7.947 0 0 1 11.66 14c.757 0 1.249.136 1.633.426.415.308.675.799.675 1.504 0 .763-.279 1.29-.763 1.615zM17 14.77h-1.532v.911H16.9v.734h-1.432v1.604h-.906V14.03H17v.74zM14 9h-1V4l5 5h-4z" />
                                    </svg>
                                    <span className="mt-2 font-medium">
                                      PDF Document
                                    </span>
                                    {resourceFile && <p className="text-xs text-gray-500 mt-1">{resourceFile.name}</p>}
                                  </div>
                                )}
                              {resourceFilePreview.startsWith(
                                "file-type:video/"
                              ) && (
                                  <div className="flex flex-col items-center">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-16 w-16 text-blue-500"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
                                      <path d="m9 17 8-5-8-5z" />
                                    </svg>
                                    <span className="mt-2 font-medium">
                                      Video File
                                    </span>
                                    {resourceFile && <p className="text-xs text-gray-500 mt-1">{resourceFile.name}</p>}
                                  </div>
                                )}
                              {resourceFilePreview.startsWith(
                                "file-type:audio/"
                              ) && (
                                  <div className="flex flex-col items-center">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-16 w-16 text-purple-500"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M19.952 1.651a.991.991 0 0 0-1.164.986v14.522c-.87-.703-2.354-1.062-4.137-1.062-1.636 0-3.52.33-4.7 1.505S9 20.147 9 21.428v.893C9 22.705 9.322 23 9.731 23c.4 0 .726-.286.735-.678v-.009l.007-.407c.001-.921.396-1.762 1.465-2.506.957-.662 2.492-1.046 4.313-1.046s3.356.384 4.313 1.046c1.069.744 1.464 1.585 1.465 2.506l.007.407v.009c.009.392.335.678.735.678.409 0 .731-.295.731-.679v-.893c0-1.281-.297-2.45-1.478-3.625S17.172 16.1 15.532 16.1c-.51 0-1.01.036-1.492.103V5.256l5.227-2.783a.996.996 0 0 0 .571-1.173 1.01 1.01 0 0 0-.876-.749zM8.364 6.4a.771.771 0 0 0-.388 0c-.612.13-1.21.332-1.781.6-1.307.619-2.398 1.525-3.182 2.643a1.773 1.773 0 0 0-.3.507c-.435.941-.671 1.969-.671 3.021 0 1.051.236 2.078.671 3.018.141.299.215.421.3.507.784 1.118 1.875 2.026 3.182 2.644.571.271 1.169.473 1.781.603a.771.771 0 0 0 .388 0c.612-.13 1.21-.332 1.781-.603 1.307-.618 2.398-1.526 3.182-2.644.084-.086.158-.208.3-.507.436-.94.671-1.967.671-3.018 0-1.052-.235-2.08-.671-3.021a1.772 1.772 0 0 0-.3-.507c-.784-1.118-1.875-2.024-3.182-2.643-.571-.268-1.169-.47-1.781-.6zm.134 1.728c.419.089.823.219 1.207.39a7.216 7.216 0 0 1 2.12 1.67c.823 1.003 1.305 2.159 1.347 3.35.055 1.522-.464 3.03-1.534 4.303a7.222 7.222 0 0 1-2.327 1.953 5.683 5.683 0 0 1-.813.329 5.686 5.686 0 0 1-.813-.329 7.222 7.222 0 0 1-2.327-1.953c-1.07-1.273-1.589-2.781-1.534-4.303.042-1.191.524-2.347 1.347-3.35a7.217 7.217 0 0 1 2.119-1.67c.384-.171.789-.301 1.208-.39z" />
                                    </svg>
                                    <span className="mt-2 font-medium">
                                      Audio File
                                    </span>
                                    {resourceFile && <p className="text-xs text-gray-500 mt-1">{resourceFile.name}</p>}
                                  </div>
                                )}
                              {resourceFilePreview.startsWith(
                                "file-type:application/vnd.openxmlformats-officedocument."
                              ) && (
                                  <div className="flex flex-col items-center">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-16 w-16 text-green-500"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                                      <path d="M14 14H8v-2h6v2zm0 3H8v-2h6v2z" />
                                    </svg>
                                    <span className="mt-2 font-medium">
                                      Office Document
                                    </span>
                                    {resourceFile && <p className="text-xs text-gray-500 mt-1">{resourceFile.name}</p>}
                                  </div>
                                )}
                              {!resourceFilePreview.startsWith(
                                "file-type:application/pdf"
                              ) &&
                                !resourceFilePreview.startsWith(
                                  "file-type:video/"
                                ) &&
                                !resourceFilePreview.startsWith(
                                  "file-type:audio/"
                                ) &&
                                !resourceFilePreview.startsWith(
                                  "file-type:application/vnd.openxmlformats-officedocument."
                                ) && (
                                  <div className="flex flex-col items-center">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-16 w-16 text-gray-500"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                    >
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                                      <path d="M8 15h8v2H8zm0-4h8v2H8z" />
                                    </svg>
                                    <span className="mt-2 font-medium">
                                      File ({resourceFile?.type || 'Unknown type'})
                                    </span>
                                    {resourceFile && <p className="text-xs text-gray-500 mt-1">{resourceFile.name}</p>}
                                  </div>
                                )}
                            </div>
                          )}
                          <div className="mt-2 flex justify-between items-center">
                            {resourceFile && (
                              <p className="text-sm text-gray-500">
                                {resourceFile.name} ·{" "}
                                {resourceFile.size
                                  ? (resourceFile.size / (1024 * 1024)).toFixed(2)
                                  : "0"}
                                MB
                              </p>
                            )}
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
                          <p className="text-sm font-medium mb-1">
                            Drag, drop or browse file
                          </p>
                          <p className="text-xs text-gray-500 mb-4">
                            Max file size: 20MB
                          </p>
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

                    {/* Resource Description - Moved below file uploader */}
                    <div className="mb-4">
                      <Label htmlFor="resourceDescription">
                        Asset Description <span className="text-red-500">*</span> (Required)
                      </Label>
                      <Textarea
                        id="resourceDescription"
                        placeholder="Enter a description for this asset"
                        className="mt-1"
                        value={resourceDescription}
                        onChange={(e) => setResourceDescription(e.target.value)}
                      />
                    </div>

                    {/* Add Asset Button - Always visible, conditionally disabled */}
                    <Button
                      type="button"
                      onClick={addFileResource}
                      className="w-full mt-4"
                      disabled={!resourceFile || !resourceDescription.trim()}
                    >
                      Add Asset
                    </Button>
                  </div>

                  {/* External Resource Link */}
                  <div className="border rounded-lg p-4 mt-6">
                    <h4 className="text-md font-medium mb-2">
                      Add External Resource Links
                    </h4>
                    <p className="text-sm text-gray-500 mb-4">
                      You can add any number of external resource links.
                    </p>
                    {/* Section-specific feedback for External Link */}
                    {externalLinkError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="h-4 w-4 mr-1 shrink-0" />
                        <AlertDescription>{externalLinkError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Resource Link Input - Moved above description */}
                    <div className="mb-4">
                      <Label htmlFor="resourceLinkInput">Resource Link</Label>
                      <Input
                        id="resourceLinkInput"
                        type="url"
                        placeholder="https://example.com/resource"
                        value={newResourceUrl}
                        onChange={(e) => setNewResourceUrl(e.target.value)}
                      />
                    </div>

                    {/* External Resource Description - Moved below link input, marked as required */}
                    <div className="mb-4">
                      <Label htmlFor="externalResourceDescription">
                        Resource Description <span className="text-red-500">*</span> (Required)
                      </Label>
                      <Textarea
                        id="externalResourceDescription"
                        placeholder="Enter a description for this external resource"
                        className="mt-1"
                        value={externalResourceDescription}
                        onChange={(e) =>
                          setExternalResourceDescription(e.target.value)
                        }
                      />
                    </div>

                    {/* Add External Resource Button - Always visible, conditionally disabled */}
                    <Button
                      type="button"
                      disabled={!newResourceUrl.trim() || !externalResourceDescription.trim()}
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
                            <li
                              key={name}
                              className="flex justify-between items-center p-2 bg-gray-50 rounded"
                            >
                              <div>
                                <p className="font-medium">{name}</p>
                                <p className="text-sm text-gray-500 truncate max-w-xs">
                                  {url}
                                </p>
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
            <CardFooter className="flex justify-between items-center pt-6">
              {/* General step feedback for "Resources" step, if any (excluding section-specific ones) */}
              {formFeedback && formFeedbackType === 'error' && (
                <div className="text-sm text-red-600 mr-auto flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 shrink-0" /> {formFeedback}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isLoading}
                className={`${!(formFeedback && formFeedbackType === 'error') ? 'mr-auto' : ''}`}
              >
                Back
              </Button>
              <div className={`flex gap-2 ${formFeedback && formFeedbackType === 'error' ? 'ml-4' : 'ml-auto'}`}>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
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
              {/* Removed general validationError Alert from CardContent */}
              {renderPrizeSection()}
            </CardContent>
            <CardFooter className="flex justify-between items-center pt-6">
              {formFeedback && formFeedbackType === 'error' && (
                <div className="text-sm text-red-600 mr-auto flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 shrink-0" /> {formFeedback}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isLoading}
                className={`${!(formFeedback && formFeedbackType === 'error') ? 'mr-auto' : ''}`}
              >
                Back
              </Button>
              <div className={`flex gap-2 ${formFeedback && formFeedbackType === 'error' ? 'ml-4' : 'ml-auto'}`}>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
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
                </Button>
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
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isLoading &&
                    uploadProgress &&
                    !uploadProgress.includes("draft") ? (
                    <div className="flex items-center gap-2">
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
                                    : uploadProgress.includes("Redirecting")
                                      ? 100
                                      : 10
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

      {/* High Budget Prompt Modal */}
      <HighBudgetPromptModal />
    </div>
  );
}
