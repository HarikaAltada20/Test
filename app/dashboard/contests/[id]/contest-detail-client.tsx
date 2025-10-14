"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  getMetricsRefreshCooldownInfoOwner,
  formatRemainingTime,
} from "@/lib/constants";

// Removed global type imports, defining them locally below
// import { type Contest } from "@/types/contest";
// import { type Submission } from "@/types/submission";

import { DeleteContestButton } from "@/components/delete-contest-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsContent as TabsContent,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatLocalDateTime, formatTimeAgo, cn } from "@/lib/utils";
import {
  centsToDollars,
  formatCurrencyFromCents as formatMoney,
} from "@/lib/currency-utils";
import RejectionReasonModal from "@/components/RejectionReasonModal";
import PaymentModal from "@/components/PaymentModal";
import { CreatorSubmissionsModal } from "@/components/CreatorSubmissionsModal";
import { BudgetProgress } from "@/components/BudgetProgress";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Edit,
  ExternalLink,
  FileText,
  Lightbulb,
  ListOrdered,
  MoreVertical,
  PlayCircle,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Share2,
  Eye,
  CheckCircle2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trophy,
  Users,
  Instagram,
  Youtube,
  Loader2,
  Info,
  RefreshCw,
  Trash2,
  Monitor,
  Play,
  Settings,
  Wallet,
  BarChart3,
  TrendingUp,
  CheckCheck,
  Gift,
  Tag,
  Star,
} from "lucide-react";

// --- Local Type Definitions ---
interface Contest {
  id: string;
  title: string;
  // Moderation status (admin workflow)
  moderation_status:
    | "draft"
    | "pending_approval"
    | "approved"
    | "published"
    | "rejected";
  // Contest lifecycle status (only for published contests)
  status: "upcoming" | "active" | "ended" | "incomplete" | "unknown" | null;
  // Post-contest status for ended contests
  post_contest_status?:
    | "pending_review"
    | "in_review"
    | "verification_complete"
    | "payouts_processed"
    | null;
  contest_type?: "leaderboard" | "cpm" | null;
  thumbnail_url?: string | null;
  brief_html?: string | null;
  platform?: string | null;
  start_date: string | null;
  end_date: string | null;
  rules_html?: string | null;
  inspiration_links?: { url: string; description: string }[] | null;
  tracking_links?: { url: string; description: string }[] | null;
  resources?: any | null;
  contest_based_details?: any | null;
  last_metrics_updated?: string | null;
  // New features
  multiple_submissions_enabled?: boolean;
  max_submissions_per_creator?: number;
  max_earnings_per_creator?: number;
  content_type?: string;
  bonus_details?: any;
  // Payment information
  payment_details?: any | null;
  // Moderation tracking fields
  submitted_for_approval_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  published_at?: string | null;
  rejection_reason?: string | null;
}

interface Submission {
  id: string;
  created_at: string;
  content_link: string;
  status: "pending" | "verified" | "rejected" | "paid";
  views: number | null;
  other_stats: Record<string, any> | null;
  platform: string | null;
  video_thumbnail_url: string | null;
  creator_display_name: string | null;
  creator_username: string | null;
  creator_avatar_url: string | null;
  creator_id: string | null;
  earnings?: number | null; // Added for earnings display
}
// --- End Local Type Definitions ---

interface ContestDetailClientProps {
  contest: Contest;
  initialSubmissions: Submission[] | null;
  durationDays: number | null;
  contestId: string;
  isAdminView?: boolean;
  user?: any; // Add user prop for dynamic [creator] replacement
}

export default function ContestDetailClient({
  contest,
  initialSubmissions,
  durationDays,
  contestId,
  isAdminView = false,
  user,
}: ContestDetailClientProps) {
  const supabase = createClient();
  const { toast, toasts } = useToast();
  const [currentSubmissions, setCurrentSubmissions] = useState<Submission[]>(
    initialSubmissions || []
  );

  // Utility function to extract firstName from full_name
  const getFirstName = (fullName: string): string => {
    if (!fullName) return "";
    return fullName.trim().split(" ")[0];
  };

  // Utility function to replace [creator] placeholder with username
  const processUrlWithCreator = (url: string, username: string): string => {
    if (!url || !username) return url;
    return url.replace(/\[creator\]/gi, username);
  };

  // Get current user's username for [creator] replacement
  const getCurrentUserUsername = (): string => {
    if (!user) return "";

    // Try to get username from user metadata first
    const metadata: any = user?.user_metadata || {};
    const username = metadata.username || metadata.user_name;

    if (username && String(username).trim()) {
      return String(username).trim();
    }

    // Fallback to email local part
    const emailLocal = (user?.email || "").split("@")[0];
    return emailLocal || "Creator";
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "submissions", label: `Submissions (${currentSubmissions.length})` },
    { id: "analytics", label: "Analytics" },
  ];

  const { activeTab, setActiveTab } = useTabState(tabs, {
    defaultTab: "overview",
  });
  // Debug: Log current toasts state
  console.log("🔍 Current toasts state:", toasts);
  // const [currentSubmissions, setCurrentSubmissions] = useState<Submission[]>(
  //   initialSubmissions || []
  // );
  const [isLoadingSubmission, setIsLoadingSubmission] = useState<
    Record<string, boolean>
  >({});
  const [currentContest, setCurrentContest] = useState<Contest>(contest);

  // Status update states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusUpdateDialog, setStatusUpdateDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [statusUpdateReason, setStatusUpdateReason] = useState("");
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

  // Derive isDark from mode
  const isDark = mode === "dark";

  // Refresh metrics state
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

  // Rejection modal state
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [pendingRejectionSubmission, setPendingRejectionSubmission] = useState<
    string | null
  >(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingPaymentSubmission, setPendingPaymentSubmission] = useState<
    string | null
  >(null);
  const [confirmReversal, setConfirmReversal] = useState<{
    id: string;
    target: "verified" | "pending" | "rejected";
    needRejectionReason?: boolean;
  } | null>(null);
  const [activeStatusTab, setActiveStatusTab] = useState<
    "all" | "pending" | "verified" | "rejected" | "paid" | "verified_or_paid"
  >("all");
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<
    "all" | "pending" | "verified" | "rejected" | "paid" | "verified_or_paid"
  >("all");
  const [sortOption, setSortOption] = useState<
    "views_desc" | "views_asc" | "time_desc" | "time_asc"
  >("views_desc");

  // Creator-wise view state
  const [viewMode, setViewMode] = useState<"normal" | "creator-wise">("normal");
  const [selectedCreatorForModal, setSelectedCreatorForModal] = useState<
    string | null
  >(null);
  const [customizableHeaders, setCustomizableHeaders] = useState({
    averageViews: false,
    averageLikes: false,
    averageComments: false,
    averageShares: false,
    averageSaves: false,
    averageReach: false,
    averageInteractions: false,
  });

  const cooldownInfo = getMetricsRefreshCooldownInfoOwner(
    currentContest.last_metrics_updated
  );

  // Filter submissions based on active tab
  const filteredSubmissions = currentSubmissions.filter((submission) => {
    if (activeStatusTab === "all") return true;
    if (activeStatusTab === "verified_or_paid") {
      return submission.status === "verified" || submission.status === "paid";
    }
    return submission.status === activeStatusTab;
  });

  // Filter submissions for analytics based on active analytics tab
  const filteredAnalyticsSubmissions = currentSubmissions.filter(
    (submission) => {
      if (activeAnalyticsTab === "all") return true;
      if (activeAnalyticsTab === "verified_or_paid") {
        return submission.status === "verified" || submission.status === "paid";
      }
      return submission.status === activeAnalyticsTab;
    }
  );

  // Creator-wise grouping logic
  const groupSubmissionsByCreator = useMemo(() => {
    if (!filteredSubmissions || viewMode !== "creator-wise") return null;

    const grouped = filteredSubmissions.reduce((acc: any, submission: any) => {
      const creatorId = submission.creator_id;

      if (!acc[creatorId]) {
        acc[creatorId] = {
          creator: {
            id: creatorId,
            username: submission.creator?.username || "Unknown",
            profile_picture_url:
              submission.creator?.profile_picture_url || null,
            full_name: submission.creator?.full_name || null,
          },
          submissions: [],
          totalCount: 0,
          statusCounts: {
            all: 0,
            verified: 0,
            paid: 0,
            pending: 0,
            rejected: 0,
            verified_paid: 0,
          },
          metrics: {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            reach: 0,
            interactions: 0,
          },
          earnings: { expected: 0, granted: 0 },
          earningsBeforeCap: 0,
          bonus: { expected: 0, granted: 0 },
          firstSubmittedAt: submission.created_at,
          isCapped: false,
        };
      }

      const group = acc[creatorId];
      group.submissions.push(submission);
      group.totalCount++;

      // Update status counts
      const status = submission.status?.toLowerCase() || "pending";
      group.statusCounts.all++;
      if (status === "verified") {
        group.statusCounts.verified++;
        if (submission.paid) group.statusCounts.verified_paid++;
      }
      if (submission.paid) group.statusCounts.paid++;
      if (status === "pending") group.statusCounts.pending++;
      if (status === "rejected") group.statusCounts.rejected++;

      // Aggregate metrics
      group.metrics.views += submission.views || 0;
      group.metrics.likes +=
        submission.other_stats?.youtube?.likes ||
        submission.other_stats?.instagram?.likes ||
        0;
      group.metrics.comments +=
        submission.other_stats?.youtube?.comments ||
        submission.other_stats?.instagram?.comments ||
        0;
      group.metrics.shares += submission.other_stats?.instagram?.shares || 0;
      group.metrics.saves += submission.other_stats?.instagram?.saves || 0;
      group.metrics.reach += submission.other_stats?.instagram?.reach || 0;
      group.metrics.interactions +=
        submission.other_stats?.instagram?.interactions || 0;

      // Calculate earnings and bonus
      let expectedEarnings = submission.earnings || 0;

      // If earnings not stored, calculate dynamically for CPM contests
      if (!expectedEarnings && currentContest?.contest_type === "cpm") {
        const cpmConfig = (currentContest?.contest_based_details as any)
          ?.cpm_contest;
        if (cpmConfig?.cpm_rate_usd) {
          let effectiveViews = submission.views || 0;

          // Apply min_views threshold
          if (
            cpmConfig.min_views != null &&
            effectiveViews < cpmConfig.min_views
          ) {
            effectiveViews = 0;
          }

          // Apply max_views cap
          if (
            cpmConfig.max_views != null &&
            effectiveViews > cpmConfig.max_views
          ) {
            effectiveViews = cpmConfig.max_views;
          }

          // Calculate earnings: (views * CPM rate) / 1000, convert to cents
          const calculatedEarnings =
            (effectiveViews * cpmConfig.cpm_rate_usd * 100) / 1000;
          expectedEarnings = Math.round(calculatedEarnings);
        }
      }

      group.earnings.expected += expectedEarnings;

      // For granted earnings, use ACTUAL earnings from database (which respects cap)
      if (submission.paid) {
        group.earnings.granted += submission.earnings || 0;
      }

      // Track uncapped earnings for display purposes
      group.earningsBeforeCap += expectedEarnings;

      // Get flat_fee_bonus from the correct nested location
      const flatFeeBonus =
        currentContest?.contest_type === "cpm"
          ? (currentContest?.contest_based_details as any)?.cpm_contest
              ?.flat_fee_bonus || 0
          : (currentContest?.contest_based_details as any)?.leaderboard_contest
              ?.flat_fee_bonus || 0;

      if (flatFeeBonus > 0 && (status === "verified" || status === "paid")) {
        group.bonus.expected += flatFeeBonus;
      }
      if (submission.bonus_paid) {
        // Use actual bonus_amount from database if available
        const actualBonus = (submission as any).bonus_amount || flatFeeBonus;
        group.bonus.granted += actualBonus;
      }

      // Track earliest submission
      if (submission.created_at < group.firstSubmittedAt) {
        group.firstSubmittedAt = submission.created_at;
      }

      return acc;
    }, {});

    // Apply earnings cap per creator for expected earnings display
    const maxEarnings = currentContest?.max_earnings_per_creator;
    if (maxEarnings && maxEarnings > 0) {
      Object.values(grouped).forEach((group: any) => {
        if (group.earnings.expected > maxEarnings) {
          group.isCapped = true;
          // Cap the expected earnings (performance-based only, bonus remains separate)
          group.earnings.expected = maxEarnings;
        }
        // Do NOT cap granted earnings - it already reflects actual paid amounts from database
      });
    }

    return Object.values(grouped);
  }, [filteredSubmissions, viewMode, currentContest, activeStatusTab]);

  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCurrentSubmissions(initialSubmissions || []);
  }, [initialSubmissions]);

  useEffect(() => {
    setCurrentContest(contest);
  }, [contest]);

  if (!currentContest) {
    return <p>Loading contest details or contest not found...</p>;
  }

  {
    console.log("contest data", currentContest);
  }

  const getStatusBadgeProps = (contest: Contest) => {
    // For unpublished contests, show moderation status
    if (contest.moderation_status !== "published") {
      switch (contest.moderation_status) {
        case "draft":
          return { text: "Draft", className: "bg-gray-500 text-white" };
        case "pending_approval":
          return {
            text: "Pending Approval",
            className: "bg-yellow-500 text-white",
          };
        case "approved":
          return {
            text: "Ready to Publish",
            className: "bg-blue-500 text-white",
          };
        case "rejected":
          return { text: "Rejected", className: "bg-red-500 text-white" };
        default:
          return { text: "Unknown", className: "bg-slate-400 text-white" };
      }
    }

    // For published contests, show lifecycle status
    switch (contest.status) {
      case "active":
        return { text: "Live", className: "bg-green-500 text-white" };
      case "upcoming":
        return { text: "Upcoming", className: "bg-blue-500 text-white" };
      case "ended":
        // Show post-contest status for ended contests
        if (contest.post_contest_status === "pending_review") {
          return {
            text: "Pending Review",
            className: "bg-yellow-500 text-white",
          };
        }
        if (contest.post_contest_status === "in_review") {
          return { text: "In Review", className: "bg-orange-500 text-white" };
        }
        if (contest.post_contest_status === "verification_complete") {
          return {
            text: "Verified - Payment Processing",
            className: "bg-purple-500 text-white",
          };
        }
        if (contest.post_contest_status === "payouts_processed") {
          return {
            text: "Verified - Payment Released",
            className: "bg-green-600 text-white",
          };
        }
        return { text: "Ended", className: "bg-gray-500 text-white" };
      case "incomplete":
        return { text: "Incomplete", className: "bg-yellow-500 text-black" };
      default:
        return { text: "Unknown", className: "bg-slate-400 text-white" };
    }
  };
  const contestStatusBadgeInfo = getStatusBadgeProps(currentContest);

  const getSubmissionStatusBadge = (status: Submission["status"]) => {
    switch (status) {
      case "pending":
        return {
          text: "Pending",
          icon: <AlertTriangle className="h-3 w-3 mr-1.5" />,
          className: "bg-yellow-100 text-yellow-700 border-yellow-300",
        };
      case "verified":
        return {
          text: "Verified",
          icon: <CheckCircle2 className="h-3 w-3 mr-1.5" />,
          className: "bg-green-100 text-green-700 border-green-300",
        };
      case "rejected":
        return {
          text: "Rejected",
          icon: <XCircle className="h-3 w-3 mr-1.5" />,
          className: "bg-red-100 text-red-700 border-red-300",
        };
      case "paid":
        return {
          text: "Paid",
          icon: <DollarSign className="h-3 w-3 mr-1.5" />,
          className: "bg-sky-100 text-sky-700 border-sky-300",
        };
      default:
        return {
          text: "Unknown",
          icon: <AlertTriangle className="h-3 w-3 mr-1.5" />,
          className: "bg-gray-100 text-gray-700 border-gray-300",
        };
    }
  };

  const handleUpdateSubmissionStatus = async (
    submissionId: string,
    newStatus: Submission["status"],
    reason?: string,
    paymentDetails?: { paymentProofUrl: string; paymentDescription: string }
  ) => {
    console.log("🚀 Starting submission status update:", {
      submissionId,
      newStatus,
      reason,
    });
    setIsLoadingSubmission((prev) => ({ ...prev, [submissionId]: true }));
    try {
      const response = await fetch("/api/admin/verify-submission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submissionId,
          action: newStatus,
          reason: reason || null,
          paymentDetails: paymentDetails || null,
        }),
      });

      let result: any = null;
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      try {
        result = isJson ? await response.json() : await response.text();
      } catch (parseErr) {
        // Fall back to text if JSON parsing fails
        try {
          result = await response.text();
        } catch (_) {
          result = null;
        }
      }
      console.log("📡 API Response:", { status: response.status, result });

      if (!response.ok) {
        const message =
          typeof result === "string" && result.trim().length > 0
            ? result
            : result?.error ||
              `Failed to update submission status (HTTP ${response.status})`;
        throw new Error(message);
      }

      // Update the local submissions state with latest fields from API (status + earnings)
      const updated = result?.submission;
      setCurrentSubmissions((prev) =>
        prev.map((sub) => {
          if (sub.id !== submissionId) return sub;
          const merged: any = { ...sub, status: newStatus };
          if (updated && typeof updated.earnings !== "undefined") {
            merged.earnings = updated.earnings;
          }
          return merged;
        })
      );

      // Enhanced toast messages for better UX
      const getToastConfig = (status: Submission["status"]) => {
        switch (status) {
          case "verified":
            return {
              title: "✅ Submission Verified",
              description:
                "Content has been verified and is now eligible for rewards",
              variant: "default" as const,
            };
          case "rejected":
            return {
              title: "❌ Submission Rejected",
              description: reason
                ? `Rejected: ${reason.split("\n")[0]}`
                : "Submission has been rejected",
              variant: "destructive" as const,
            };
          case "pending":
            return {
              title: "⏳ Status Reset to Pending",
              description: "Submission is back in pending review",
              variant: "default" as const,
            };
          case "paid":
            return {
              title: "💰 Payment Confirmed",
              description: "Payment has been processed and confirmed",
              variant: "default" as const,
            };
          default:
            return {
              title: "Status Updated",
              description:
                result.message || `Submission status updated to ${newStatus}`,
              variant: "default" as const,
            };
        }
      };

      const toastConfig = getToastConfig(newStatus);
      console.log("🎉 Calling toast with config:", toastConfig);
      toast(toastConfig);
    } catch (error: any) {
      console.error("Error updating submission status:", error);

      // Enhanced error toast messages
      let errorTitle = "❌ Update Failed";
      let errorDescription =
        error.message || "Failed to update submission status";

      // Provide more specific error messages based on common scenarios
      if (
        error.message?.includes("Unauthorized") ||
        error.message?.includes("Authentication")
      ) {
        errorTitle = "🔒 Access Denied";
        errorDescription = "You don't have permission to perform this action";
      } else if (
        error.message?.includes("504") ||
        error.message?.toLowerCase().includes("gateway timeout")
      ) {
        errorTitle = "⏱️ Request Timed Out";
        errorDescription =
          "The server took too long to respond. Please try again.";
      } else if (error.message?.includes("not found")) {
        errorTitle = "🔍 Not Found";
        errorDescription = "Submission could not be found";
      } else if (
        error.message?.includes("network") ||
        error.message?.includes("fetch")
      ) {
        errorTitle = "🌐 Connection Error";
        errorDescription =
          "Network error. Please check your connection and try again";
      }

      console.log("❌ Calling error toast:", { errorTitle, errorDescription });
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsLoadingSubmission((prev) => ({ ...prev, [submissionId]: false }));
    }
  };

  const handleRejectSubmission = (submissionId: string) => {
    setPendingRejectionSubmission(submissionId);
    setRejectionModalOpen(true);
  };

  const handleRejectionConfirm = (reason: string, additionalNotes?: string) => {
    if (pendingRejectionSubmission) {
      // Combine reason with additional notes if provided
      const fullReason = additionalNotes
        ? `${reason}\n\nAdditional Notes: ${additionalNotes}`
        : reason;
      handleUpdateSubmissionStatus(
        pendingRejectionSubmission,
        "rejected",
        fullReason
      );
      setRejectionModalOpen(false);
      setPendingRejectionSubmission(null);
    }
  };

  const handleMarkAsPaid = (submissionId: string) => {
    setPendingPaymentSubmission(submissionId);
    setPaymentModalOpen(true);
  };

  const handlePaymentConfirm = (paymentDetails: {
    paymentProofUrl: string;
    paymentDescription: string;
    amountInCents?: number;
    isCustom?: boolean;
  }) => {
    if (pendingPaymentSubmission) {
      handleUpdateSubmissionStatus(
        pendingPaymentSubmission,
        "paid",
        undefined,
        paymentDetails as any
      );
      setPaymentModalOpen(false);
      setPendingPaymentSubmission(null);
    }
  };

  const handleConfirmReversal = async () => {
    if (!confirmReversal) return;
    const { id, target, needRejectionReason } = confirmReversal;
    setConfirmReversal(null);
    if (needRejectionReason) {
      // After confirming reversal, open rejection reason modal
      setPendingRejectionSubmission(id);
      setRejectionModalOpen(true);
      return;
    }
    await handleUpdateSubmissionStatus(id, target);
  };

  const handleUpdateContestStatus = async () => {
    if (!selectedStatus) {
      toast({
        title: "Error",
        description: "Please select a status",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/contests/${contestId}/update-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: selectedStatus,
          reason: statusUpdateReason || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update status");
      }

      // Update the local contest state
      setCurrentContest((prev) => ({
        ...prev,
        post_contest_status: selectedStatus as any,
      }));

      // Enhanced contest status update toast
      const getContestStatusToast = (status: string) => {
        switch (status) {
          case "pending_review":
            return {
              title: "📋 Status: Pending Review",
              description: "Contest is now pending review phase",
            };
          case "in_review":
            return {
              title: "🔍 Status: In Review",
              description: "Contest is currently under review",
            };
          case "verification_complete":
            return {
              title: "✅ Status: Verification Complete",
              description: "All submissions have been verified",
            };
          case "payouts_processed":
            return {
              title: "💰 Status: Payouts Processed",
              description: "All payments have been processed",
            };
          default:
            return {
              title: "Status Updated",
              description: result.message,
            };
        }
      };

      const contestToastConfig = getContestStatusToast(selectedStatus);
      toast(contestToastConfig);

      setStatusUpdateDialog(false);
      setSelectedStatus("");
      setStatusUpdateReason("");
    } catch (error: any) {
      console.error("Error updating contest status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update contest status",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const canUpdateContestStatus = () => {
    return (
      currentContest.moderation_status === "published" &&
      currentContest.status === "ended" &&
      currentContest.post_contest_status !== "payouts_processed"
    );
  };

  const getAvailableStatusOptions = () => {
    const current = currentContest.post_contest_status;
    const options = [
      {
        value: "pending_review",
        label: "Pending Review",
        description: "Contest submissions are under initial review",
      },
      {
        value: "in_review",
        label: "In Review",
        description: "Active review of submissions in progress",
      },
      {
        value: "verification_complete",
        label: "Verification Complete",
        description: "All submissions verified, preparing payouts",
      },
      {
        value: "payouts_processed",
        label: "Payouts Processed",
        description: "All payments have been released",
      },
    ];

    // For non-admin users (brands), exclude payouts_processed and only allow moving forward
    if (!isAdminView) {
      const currentIndex = options.findIndex((opt) => opt.value === current);
      return options
        .filter((opt) => opt.value !== "payouts_processed") // Brands cannot set payouts_processed
        .filter((_, index) => index > currentIndex);
    }

    // For admins, show all options except current
    return options.filter((opt) => opt.value !== current);
  };

  const handleRefreshMetrics = async () => {
    // Prevent multiple clicks
    if (isRefreshingMetrics) {
      return;
    }

    // Check rate limiting based on database value
    if (!cooldownInfo.canRefresh) {
      toast({
        title: "Please Wait",
        description: `You can refresh again in ${
          cooldownInfo.remainingMinutes
        } minute${cooldownInfo.remainingMinutes !== 1 ? "s" : ""}`,
        variant: "destructive",
      });
      return;
    }

    setIsRefreshingMetrics(true);

    try {
      // Add timeout for long-running requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch(
        `/api/contests/${contestId}/refresh-metrics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to refresh metrics");
      }

      toast({
        title: "Success! 🎉",
        description: `${result.message}. Budget and leaderboard updated!`,
      });

      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Failed to refresh metrics:", error);

      if (error.name === "AbortError") {
        toast({
          title: "Request Timeout",
          description:
            "The refresh is taking longer than expected. Please check back in a few minutes.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Refresh Failed",
          description:
            error.message || "Could not refresh metrics. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRefreshingMetrics(false);
    }
  };

  const formatStatKey = (key: string) => {
    return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getPlatformIcon = (platform?: string | null) => {
    const lowerPlatform = platform?.toLowerCase();
    if (lowerPlatform?.includes("youtube"))
      return (
        <div className="flex items-center justify-center w-6 h-6">
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <path
              fill="#FF0000"
              d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
            />
          </svg>
        </div>
      );
    if (lowerPlatform?.includes("instagram"))
      return (
        <div className="flex items-center justify-center w-6 h-6">
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <defs>
              <linearGradient
                id="instagram-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#833AB4" />
                <stop offset="50%" stopColor="#FD1D1D" />
                <stop offset="100%" stopColor="#FCB045" />
              </linearGradient>
            </defs>
            <path
              fill="url(#instagram-gradient)"
              d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
            />
          </svg>
        </div>
      );
    return <Share2 className="h-6 w-6 text-gray-600 flex-shrink-0" />;
  };

  const extractPlatformMetrics = (submission: Submission) => {
    const platform = submission.platform?.toLowerCase();
    const stats = submission.other_stats || {};
    const baseViews = submission.views || 0;

    // Extract platform-specific metrics
    if (platform?.includes("youtube")) {
      const youtubeStats = stats.youtube || stats;
      return {
        views: baseViews,
        likes: youtubeStats.likes || youtubeStats.like_count || 0,
        comments: youtubeStats.comments || youtubeStats.comment_count || 0,
        shares: 0, // Not available
        subscribers_gained: 0, // Not available
        watch_time: 0, // Not available
        engagement_rate: 0, // Not available
      };
    } else if (platform?.includes("instagram")) {
      const igStats = stats.instagram || stats;
      return {
        views: baseViews,
        likes: igStats.likes || igStats.like_count || 0,
        comments: igStats.comments || igStats.comment_count || 0,
        shares: igStats.shares || igStats.share_count || 0,
        saves: igStats.saved || 0,
        reach: igStats.reach || 0,
        impressions: igStats.impressions || 0,
        engagement_rate: igStats.engagement_rate || 0,
        total_interactions: igStats.total_interactions || 0,
      };
    } else {
      // Generic platform metrics
      return {
        views: baseViews,
        likes: stats.likes || stats.like_count || 0,
        comments: stats.comments || stats.comment_count || 0,
        shares: stats.shares || stats.share_count || 0,
        engagement_rate: stats.engagement_rate || 0,
      };
    }
  };

  const formatMetricValue = (value: any, isRate = false) => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "number") {
      if (isRate) {
        return `${(value * 100).toFixed(1)}%`;
      }
      return value.toLocaleString();
    }
    return String(value);
  };

  const handleShare = async () => {
    if (contest.status === "ended") {
      toast({
        title: "Contest Completed",
        description:
          "This contest has ended. You can still share it to showcase the results and winners.",
        variant: "default",
      });
      // Allow sharing to proceed for completed contests
    }

    if (contest.status === "upcoming") {
      toast({
        title: "Not Live Yet",
        description:
          "This opportunity is not live yet. You can share it, but creators won't be able to participate until the start date.",
        variant: "default",
      });
      // Allow sharing to proceed
    }

    const shareUrl = `${window.location.origin}/dashboard/opportunities/${contest.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: contest.title,
          text:
            contest.status === "ended"
              ? `Check out this completed contest: ${contest.title}`
              : `Check out this opportunity: ${contest.title}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied",
          description:
            contest.status === "ended"
              ? "Contest link copied to clipboard!"
              : "Opportunity link copied to clipboard!",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast({
        title: "Share Failed",
        description: "There was an error trying to share this opportunity.",
        variant: "destructive",
      });
    }
  };

  const handleCopyTrackingLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link Copied",
        description: "Tracking link copied to clipboard!",
        variant: "default",
      });
    } catch (error) {
      console.error("Error copying link:", error);
      toast({
        title: "Copy Failed",
        description: "There was an error trying to copy this link.",
        variant: "destructive",
      });
    }
  };

  const isContestEditable =
    currentContest.moderation_status === "draft" ||
    currentContest.moderation_status === "rejected" ||
    currentContest.moderation_status === "pending_approval" ||
    (currentContest.moderation_status === "approved" &&
      currentContest.status === "upcoming");
  const isContestDeletable =
    currentContest.moderation_status === "draft" ||
    currentContest.moderation_status === "rejected" ||
    currentContest.moderation_status === "pending_approval";

  return (
    <div>
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
      <div className="flex flex-col px-1 lg:flex-row lg:justify-between lg:items-center gap-4 mb-8 ">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button
            className="cursor-pointer"
            variant="ghost"
            size="icon"
            asChild
          >
            <Link
              href={
                isAdminView
                  ? "/dashboard/admin/contests"
                  : "/dashboard/contests"
              }
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className={cn(
                "text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {currentContest.title}
            </h1>

            {/* Status + Contest type */}

            <div
              className={cn(
                contestStatusBadgeInfo.className,
                "capitalize text-sm px-3 py-1 rounded-full",
                isDark
                  ? "bg-[#FFE19857] text-yellow-300"
                  : "bg-[#FDD36F57] text-[#A87313]"
              )}
            >
              {contestStatusBadgeInfo.text}
            </div>
            {currentContest.contest_type && (
              <div
                // variant={
                //   currentContest.contest_type === "cpm" ? "secondary" : "default"
                // }

                className={cn(
                  "capitalize text-sm px-3 py-1 rounded-full",
                  isDark
                    ? "bg-[#B487FA80] text-purple-300"
                    : "bg-[#7F39EC3B] text-[#4A00BE]"
                )}
              >
                {currentContest.contest_type === "cpm" ? "CPM" : "Leaderboard"}
              </div>
            )}
          </div>
        </div>
        {/* Quick Actions Bar */}
        <div className="flex gap-4 items-center mb-3">
          {/* Contest Status Update Button */}
          {canUpdateContestStatus() && (
            <Dialog
              open={statusUpdateDialog}
              onOpenChange={setStatusUpdateDialog}
              isdark={isDark}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    isDark
                      ? "py-3 border border-purple-400 text-purple-400"
                      : "border-purple-500 text-purple-500"
                  )}
                >
                  <Settings className="h-4 w-4" />
                  Update Status
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Update Contest Status</DialogTitle>
                  <DialogDescription>
                    Change the post-contest status to reflect the current stage
                    of verification and payouts. Current status:{" "}
                    <strong>
                      {currentContest.post_contest_status || "Not set"}
                    </strong>
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="status" className="text-sm font-medium">
                      New Status
                    </label>
                    <Select
                      value={selectedStatus}
                      onValueChange={setSelectedStatus}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select new status" />
                      </SelectTrigger>
                      <SelectContent isDark={isDark}>
                        {getAvailableStatusOptions().map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            isDark={isDark}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {option.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {option.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="reason" className="text-sm font-medium">
                      Reason (Optional)
                    </label>
                    <Textarea
                      id="reason"
                      placeholder="Add a note about this status change..."
                      value={statusUpdateReason}
                      onChange={(e) => setStatusUpdateReason(e.target.value)}
                      className="resize-none"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <button
                    onClick={handleUpdateContestStatus}
                    disabled={isUpdatingStatus || !selectedStatus}
                    className={cn(
                      "w-full text-md rounded-full",
                      isDark
                        ? "bg-[#7F39EC] py-3"
                        : " bg-[#D9C0FF61] py-3 text-[#7F39EC] "
                    )}
                  >
                    {isUpdatingStatus ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Status"
                    )}
                  </button>
                  <button
                    onClick={() => setStatusUpdateDialog(false)}
                    disabled={isUpdatingStatus}
                    className={cn(
                      "w-full text-md rounded-full",
                      isDark
                        ? "py-3 border border-[#FF5353] text-[#FF5353]"
                        : "bg-[#FF323224] text-[#E50000] py-3"
                    )}
                  >
                    Cancel
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {contest.moderation_status === "approved" && (
            <Button
              size="sm"
              className="flex items-center gap-2 mt-3 text-md bg-[#6C43D0] hover:bg-[#6C43D0] text-white transition-all duration-200 hover:scale-105"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const response = await fetch(
                    `/api/contests/${contestId}/publish`,
                    {
                      method: "POST",
                    }
                  );
                  if (response.ok) {
                    window.location.reload();
                  } else {
                    const error = await response.json();
                    alert(error.error || "Failed to publish contest");
                  }
                } catch (error) {
                  alert("Failed to publish contest");
                }
              }}
            >
              <PlayCircle className="h-4 w-4" />
              Publish
            </Button>
          )}
          {currentContest.moderation_status === "published" && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-[#6C43D0] hover:bg-[#6C43D0] text-white transition-all duration-200 hover:scale-105"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Share</span>
            </Button>
          )}

          {isContestEditable && (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2 bg-[#6C43D0] hover:bg-[#6C43D0] text-white transition-all duration-200 hover:scale-105"
              asChild
            >
              <Link
                href={`/dashboard/contests/${contestId}/edit`}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Edit</span>
              </Link>
            </Button>
          )}

          {isContestDeletable && (
            <DeleteContestButton
              contestId={contestId}
              contestTitle={currentContest.title || "this contest"}
              isDeletable={isContestDeletable}
              isdark={isDark}
            />
          )}
        </div>
      </div>

      {/* Modern Contest Overview - Redesigned for better UX */}
      <div className="space-y-6 mb-8">
        {/* Enhanced Contest Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Platform Card */}

          {/* Platform Card */}
          <div className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white shadow-lg border border-gray-200">
                  {getPlatformIcon(currentContest.platform)}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Platform
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {currentContest.platform || "N/A"}
                  </p>
                </div>
              </div>
              <div className="h-1 w-full bg-gradient-to-r from-purple-200 to-purple-300 rounded-full"></div>
            </div>
          </div>
          {/* <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-700/50 hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    {getPlatformIcon(currentContest.platform)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-red-800 dark:text-red-300 uppercase tracking-wide">Platform</p>
                                    <p className="text-lg font-bold text-red-900 dark:text-red-100 capitalize">{currentContest.platform || 'N/A'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </div> */}

          {/* Duration Card */}
          <div className="group bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-blue-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Duration
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {durationDays !== null
                      ? `${durationDays} ${durationDays === 1 ? "day" : "days"}`
                      : "N/A"}
                  </p>
                </div>
              </div>
              {currentContest.start_date && currentContest.end_date && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 font-medium">
                    {formatLocalDateTime(currentContest.start_date, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    -{" "}
                    {formatLocalDateTime(currentContest.end_date, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              )}
              <div className="h-1 w-full bg-gradient-to-r from-blue-200 to-blue-300 rounded-full"></div>
            </div>
          </div>
          {/* <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Duration</p>
                                    <p className="text-lg font-bold text-green-900 dark:text-green-100">{durationDays !== null ? `${durationDays} ${durationDays === 1 ? 'day' : 'days'}` : 'N/A'}</p>
                                    {currentContest.start_date && currentContest.end_date && (
                                        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                                            {formatLocalDateTime(currentContest.start_date, { month: 'short', day: 'numeric' })} - {formatLocalDateTime(currentContest.end_date, { month: 'short', day: 'numeric' })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card> */}

          {/* Prize Pool Card */}
          {currentContest.contest_type === "leaderboard" &&
            currentContest.contest_based_details?.leaderboard_contest
              ?.total_prize != null && (
              <div className="group bg-gradient-to-br from-white to-yellow-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-yellow-100 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg">
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                        Prize Pool
                      </p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatMoney(
                          currentContest.contest_based_details
                            .leaderboard_contest.total_prize
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 font-medium">
                      {
                        currentContest.contest_based_details.leaderboard_contest
                          .winner_count
                      }{" "}
                      winners
                    </p>
                  </div>

                  {/* Total Budget (if set) */}
                  {currentContest.contest_based_details?.leaderboard_contest
                    ?.total_budget && (
                    <div className="border-t border-yellow-200 pt-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                            Total Budget
                          </p>
                          <p className="text-xl font-bold text-blue-600 mt-1">
                            {formatMoney(
                              currentContest.contest_based_details
                                .leaderboard_contest.total_budget
                            )}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            For bonuses & extras
                          </p>
                        </div>
                        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                          <span className="text-lg">💰</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="h-1 w-full bg-gradient-to-r from-yellow-200 to-yellow-300 rounded-full"></div>
                </div>
              </div>
              // <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-700/50 hover:shadow-lg transition-all duration-300">
              //     <CardContent className="p-4">
              //         <div className="flex items-center gap-3">
              //             <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              //                 <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              //             </div>
              //             <div className="flex-1">
              //                 <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">Prize Pool</p>
              //                 <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">{formatMoney(currentContest.contest_based_details.leaderboard_contest.total_prize)}</p>
              //                 <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">{currentContest.contest_based_details.leaderboard_contest.winner_count} winners</p>
              //             </div>
              //         </div>
              //     </CardContent>
              // </Card>
            )}

          {currentContest.contest_type === "cpm" &&
            currentContest.contest_based_details?.cpm_contest?.total_budget !=
              null && (
              <div
                className={cn(
                  "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                  isDark ? "bg-[#170337] text-white" : "bg-white text-black"
                )}
              >
                <CardContent className="p-4 flex justify-between">
                  <div className="flex-1 space-y-3">
                    <p className="text-lg font-medium"> Total Budget</p>
                    <p className="text-xl font-bold">
                      {formatMoney(
                        currentContest.contest_based_details.cpm_contest
                          .total_budget
                      )}
                    </p>
                    <p className="text-md">
                      $
                      {
                        currentContest.contest_based_details.cpm_contest
                          .cpm_rate_usd
                      }{" "}
                      CPM
                    </p>
                  </div>
                  <div
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-full",
                      isDark
                        ? "bg-[#FFFFFF36] text-white"
                        : "bg-[#D8C3FF] text-[#4A00BE]"
                    )}
                  >
                    <DollarSign className="h-5 w-5" />
                  </div>
                </CardContent>
              </div>
              // <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-700/50 hover:shadow-lg transition-all duration-300">
              //   <CardContent className="p-4">
              //     <div className="flex items-center gap-3">
              //       <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              //         <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              //       </div>
              //       <div className="flex-1">
              //         <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">
              //           Total Budget
              //         </p>
              //         <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
              //           {formatMoney(
              //             currentContest.contest_based_details.cpm_contest
              //               .total_budget
              //           )}
              //         </p>
              //         <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              //           $
              //           {
              //             currentContest.contest_based_details.cpm_contest
              //               .cpm_rate_usd
              //           }{" "}
              //           CPM
              //         </p>
              //       </div>
              //     </div>
              //   </CardContent>
              // </Card>
            )}

          {/* Budget Progress Tracker - Two-Color Visualization (CPM) */}
          {currentContest.contest_type === "cpm" &&
            currentContest.contest_based_details?.cpm_contest?.total_budget !=
              null &&
            currentContest.contest_based_details.cpm_contest.total_budget >
              0 && (
              <div className="group bg-gradient-to-br from-white to-indigo-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-indigo-100 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg mr-4">
                      <span className="text-lg">📊</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Budget Tracker
                      </h3>
                      <p className="text-sm text-gray-600">
                        Monitor spending progress
                      </p>
                    </div>
                  </div>
                  <BudgetProgress
                    contest={{
                      total_budget:
                        currentContest.contest_based_details.cpm_contest
                          .total_budget,
                      contest_based_details:
                        currentContest.contest_based_details,
                      contest_type: currentContest.contest_type,
                      max_earnings_per_creator:
                        currentContest.max_earnings_per_creator,
                    }}
                    submissions={currentSubmissions as any}
                    showDetailed={true}
                  />
                </div>
              </div>
            )}

          {/* Budget Progress Tracker - For Leaderboard with total_budget */}
          {currentContest.contest_type === "leaderboard" &&
            currentContest.contest_based_details?.leaderboard_contest
              ?.total_budget != null &&
            currentContest.contest_based_details.leaderboard_contest
              .total_budget > 0 && (
              <div className="group bg-gradient-to-br from-white to-emerald-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-emerald-100 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg mr-4">
                      <span className="text-lg">📊</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Budget Tracker
                      </h3>
                      <p className="text-sm text-gray-600">
                        Monitor bonus spending progress
                      </p>
                    </div>
                  </div>
                  <BudgetProgress
                    contest={{
                      total_budget:
                        currentContest.contest_based_details.leaderboard_contest
                          .total_budget,
                      contest_based_details:
                        currentContest.contest_based_details,
                      contest_type: currentContest.contest_type,
                      max_earnings_per_creator:
                        currentContest.max_earnings_per_creator,
                    }}
                    submissions={currentSubmissions as any}
                    showDetailed={true}
                  />
                </div>
              </div>
            )}

          {/* Submissions Count Card */}
          <div className="group bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-purple-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
                  <Users className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Submissions
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {currentSubmissions.length}
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 font-medium">
                  Total entries
                </p>
              </div>
              <div className="h-1 w-full bg-gradient-to-r from-purple-200 to-purple-300 rounded-full"></div>
            </div>
          </div>
          {/* <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">
                    Submissions
                  </p>
                  <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {currentSubmissions.length}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                    Total entries
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}
        </div>
      </div>

      {/* Main Content Tabs */}

      {/* <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="submissions">
              Submissions{" "}
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0.5 text-xs data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
              >
                ({currentSubmissions.length})
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList> */}
      <EnhancedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mt-12 mb-6"
        isDark={isDark}
        light={!isDark}
      />
      <div className="mt-8">
        <TabContent activeTab={activeTab}>
          <TabPanel value="overview" activeTab={activeTab}>
            <div
              className={cn(
                "px-4 pt-5 pb-4 border-b rounded-t-xl font-semibold shadow-xl",
                isDark
                  ? "bg-[#170337] border-gray-600 text-white"
                  : "bg-white text-purple-500 "
              )}
            >
              <h1 className="text-xl flex items-center gap-2">
                {/* <FileText className="h-5 w-5 text-blue-500" /> */}
                Contest Details
              </h1>
            </div>
            <div
              className={cn(
                "p-4 bg-white rounded-b-xl shadow-xl",
                isDark ? "bg-[#170337]" : "bg-white"
              )}
            >
              <CardContent className="space-y-6 py-6 px-4">
                {currentContest.thumbnail_url && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-foreground">
                      Thumbnail
                    </h3>
                    <div className="flex justify-center">
                      <img
                        src={currentContest.thumbnail_url}
                        alt={`${currentContest.title} thumbnail`}
                        className="max-w-full max-h-80 object-contain border rounded-lg shadow-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Brief</h3>
                  {currentContest.brief_html ? (
                    <div
                      className={cn(
                        "prose prose-md max-w-none p-4 rounded-lg border",
                        isDark
                          ? "bg-[#170337] text-white prose-invert border-gray-600"
                          : "bg-white text-foreground"
                      )}
                      dangerouslySetInnerHTML={{
                        __html: currentContest.brief_html,
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground bg-muted/30 p-4 rounded-lg border">
                      No brief provided
                    </p>
                  )}
                </div>

                {/* Contest Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Platform Card */}
                  <div
                    className={cn(
                      "border rounded-xl transition-all duration-300",
                      isDark ? "border-gray-600" : "border-gray-300"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-full ",
                            isDark
                              ? "bg-[#FFFFFF42] text-white"
                              : "bg-purple-100 text-[#4A00BE]"
                          )}
                        >
                          <Monitor className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-md font-medium tracking-wide",
                              isDark ? "text-white" : "text-black"
                            )}
                          >
                            Platform
                          </p>
                          <p
                            className={cn(
                              "text-lg md:text-xl font-bold capitalize",
                              isDark ? "text-white" : "text-black"
                            )}
                          >
                            {currentContest.platform}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* Status Card */}
                  <div
                    className={cn(
                      "border rounded-xl transition-all duration-300",
                      isDark ? "border-gray-600" : "border-gray-300"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-full ",
                            isDark
                              ? "bg-[#FFFFFF42] text-white"
                              : "bg-purple-100 text-[#4A00BE]"
                          )}
                        >
                          <Info className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-md font-medium tracking-wide",
                              isDark ? "text-white" : "text-black"
                            )}
                          >
                            Status
                          </p>
                          <p
                            className={cn(
                              "text-lg md:text-xl font-bold capitalize",
                              isDark ? "text-white" : "text-black"
                            )}
                          >
                            {contestStatusBadgeInfo.text}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </div>

                {/* Date & Time Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date Card */}
                  <div
                    className={cn(
                      "border rounded-xl transition-all duration-300",
                      isDark ? "border-gray-600" : "border-gray-300"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-full ",
                            isDark
                              ? "bg-[#FFFFFF42] text-white"
                              : "bg-purple-100 text-[#4A00BE]"
                          )}
                        >
                          <Play className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-md font-medium tracking-wide">
                            Start Date & Time
                          </p>
                          <p className="text-lg font-bold ">
                            {formatLocalDateTime(currentContest.start_date)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* End Date Card */}
                  <div
                    className={cn(
                      "border rounded-xl transition-all duration-300",
                      isDark ? "border-gray-600" : "border-gray-300"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-full ",
                            isDark
                              ? "bg-[#FFFFFF42] text-white"
                              : "bg-purple-100 text-[#4A00BE]"
                          )}
                        >
                          <Clock className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium tracking-wide">
                            End Date & Time
                          </p>
                          <p className="text-lg font-bold">
                            {formatLocalDateTime(currentContest.end_date)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </div>

                {/* Conditional Prize Structure / CPM Details */}
                {currentContest.contest_type === "leaderboard" &&
                  currentContest.contest_based_details?.leaderboard_contest && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg text-foreground">
                        Prize Structure
                      </h3>

                      {/* Prize Pool Summary */}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Start Date Card */}
                        <div
                          className={cn(
                            "border rounded-xl transition-all duration-300",
                            isDark ? "border-gray-600" : "border-gray-300"
                          )}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-10 h-10 flex items-center justify-center rounded-full ",
                                  isDark
                                    ? "bg-[#FFFFFF42] text-white"
                                    : "bg-purple-100 text-[#4A00BE]"
                                )}
                              >
                                <Trophy className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <p className="text-md font-medium tracking-wide">
                                  Total Prize Pool
                                </p>
                                <p className="text-lg md:text-xl font-bold ">
                                  {formatMoney(
                                    currentContest.contest_based_details
                                      .leaderboard_contest.total_prize
                                  )}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </div>

                        {/* End Date Card */}
                        <div
                          className={cn(
                            "border rounded-xl transition-all duration-300",
                            isDark ? "border-gray-600" : "border-gray-300"
                          )}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-10 h-10 flex items-center justify-center rounded-full ",
                                  isDark
                                    ? "bg-[#FFFFFF42] text-white"
                                    : "bg-purple-100 text-[#4A00BE]"
                                )}
                              >
                                <Users className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <p className="text-md font-medium tracking-wide">
                                  Total Winners
                                </p>
                                <p className=" text-lg md:text-xl font-bold">
                                  {
                                    currentContest.contest_based_details
                                      .leaderboard_contest.winner_count
                                  }
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </div>
                      </div>
                      {/* <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700/50 rounded-xl p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg">
                              <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">
                                Total Prize Pool
                              </p>
                              <p className="text-xl font-bold text-green-900 dark:text-green-100">
                                {formatMoney(
                                  currentContest.contest_based_details
                                    .leaderboard_contest.total_prize
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
                              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                                Total Winners
                              </p>
                              <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                                {
                                  currentContest.contest_based_details
                                    .leaderboard_contest.winner_count
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      </div> */}

                      {/* Prize Distribution */}
                      <div className="py-4">
                        <h4 className="font-medium text-lg text-foreground mb-3 flex items-center gap-2">
                          {/* <ListOrdered className="h-4 w-4" /> */}
                          Prize Distribution
                        </h4>
                        <div className="space-y-4">
                          {Array.isArray(
                            currentContest.contest_based_details
                              .leaderboard_contest.prizes
                          ) &&
                            currentContest.contest_based_details.leaderboard_contest.prizes
                              .sort((a: any, b: any) => a.position - b.position)
                              .map((prize: any, index: number) => (
                                <div
                                  key={index}
                                  className={cn(
                                    "flex items-center justify-between py-3 px-3 rounded-lg border",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-400"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center border rounded-full font-bold text-sm",
                                        isDark
                                          ? "border-gray-500 text-gray-300"
                                          : "border-gray-500 text-gray-500"
                                      )}
                                    >
                                      {prize.position}
                                    </div>
                                    <span className="font-medium text-foreground">
                                      Position {prize.position}
                                    </span>
                                  </div>
                                  <span
                                    className={cn(
                                      "font-bold text-lg",
                                      isDark ? "text-gray-300" : "text-gray-600"
                                    )}
                                  >
                                    {formatMoney(prize.amount)}
                                  </span>
                                </div>
                              ))}
                        </div>
                      </div>
                    </div>
                  )}

                {currentContest.contest_type === "cpm" &&
                  currentContest.contest_based_details?.cpm_contest && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg text-foreground">
                        CPM Configuration
                      </h3>
                      <div className="grid grid-col-1 md:grid-cols-2 gap-4">
                        <div
                          className={cn(
                            "flex justify-between items-center p-3 rounded border rounded-md",
                            isDark ? "border-gray-600" : "border-gray-400"
                          )}
                        >
                          <span
                            className={cn(
                              "text-md font-medium tracking-wide",
                              isDark ? "text-white" : "text-black"
                            )}
                          >
                            CPM Rate:
                          </span>
                          <span className="font-semibold text-md text-foreground">
                            $
                            {parseFloat(
                              currentContest.contest_based_details.cpm_contest
                                .cpm_rate_usd
                            ).toFixed(2)}{" "}
                            per 1000 views
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex justify-between items-center p-3 rounded border rounded-md",
                            isDark ? "border-gray-600" : "border-gray-400"
                          )}
                        >
                          <span
                            className={cn(
                              "text-md font-medium tracking-wide",
                              isDark ? "text-white" : "text-black"
                            )}
                          >
                            Total Budget:
                          </span>
                          <span className="font-semibold text-md text-foreground">
                            {formatMoney(
                              currentContest.contest_based_details.cpm_contest
                                .total_budget
                            )}
                          </span>
                        </div>
                        {currentContest.contest_based_details.cpm_contest
                          .min_views != null && (
                          <div className="flex justify-between items-center p-3 rounded border">
                            <span className="text-md font-medium text-black">
                              Min Views:
                            </span>
                            <span className="font-semibold text-md text-foreground">
                              {currentContest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {currentContest.contest_based_details.cpm_contest
                          .max_views != null && (
                          <div className="flex justify-between items-center p-3 rounded border">
                            <span className="text-md font-medium text-black">
                              Max Views (Cap):
                            </span>
                            <span className="font-semibold text-md text-foreground">
                              {currentContest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {/* <div>
                          <h4 className="text-sm font-medium mt-3 mb-2 text-foreground">
                            Terms & Conditions
                          </h4>
                          <div className="p-3 border rounded-lg bg-background text-sm text-foreground">
                            <div className="whitespace-pre-wrap break-words">
                              {currentContest.contest_based_details.cpm_contest
                                .terms_conditions ||
                                "No specific terms provided."}
                            </div>
                          </div>
                        </div> */}
                      </div>
                      <div>
                        <h4 className="text-md font-semibold mt-4 mb-2 text-foreground">
                          Terms & Conditions
                        </h4>
                        <div
                          className={cn(
                            "p-3 border rounded-lg text-[13px] text-black",
                            isDark
                              ? "border-gray-600 text-white"
                              : "border-gray-400 text-black"
                          )}
                        >
                          <div className="whitespace-pre-wrap break-words">
                            {currentContest.contest_based_details.cpm_contest
                              .terms_conditions ||
                              "No specific terms provided."}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Payment Information */}
                {(currentContest as any).payment_details && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-foreground">
                      Payment Information
                    </h3>

                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
                            <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                              Prize Pool
                            </p>
                            <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                              {(() => {
                                const paymentDetails =
                                  typeof (currentContest as any)
                                    .payment_details === "string"
                                    ? JSON.parse(
                                        (currentContest as any).payment_details
                                      )
                                    : (currentContest as any).payment_details;
                                return formatMoney(
                                  paymentDetails.total_prize_pool || 0
                                );
                              })()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-800/30 rounded-lg">
                            <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">
                              Commission (
                              {(() => {
                                const paymentDetails =
                                  typeof (currentContest as any)
                                    .payment_details === "string"
                                    ? JSON.parse(
                                        (currentContest as any).payment_details
                                      )
                                    : (currentContest as any).payment_details;
                                return (
                                  paymentDetails.commission_percentage || 0
                                );
                              })()}
                              %)
                            </p>
                            <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                              {(() => {
                                const paymentDetails =
                                  typeof (currentContest as any)
                                    .payment_details === "string"
                                    ? JSON.parse(
                                        (currentContest as any).payment_details
                                      )
                                    : (currentContest as any).payment_details;
                                return formatMoney(
                                  paymentDetails.commission_amount || 0
                                );
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Total Paid and Payment Method */}
                      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg">
                              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">
                                Total Paid
                              </p>
                              <p className="text-lg font-bold text-green-900 dark:text-green-100">
                                {(() => {
                                  const paymentDetails =
                                    typeof (currentContest as any)
                                      .payment_details === "string"
                                      ? JSON.parse(
                                          (currentContest as any)
                                            .payment_details
                                        )
                                      : (currentContest as any).payment_details;
                                  return formatMoney(
                                    paymentDetails.total_amount_paid || 0
                                  );
                                })()}
                              </p>
                            </div>
                          </div>

                          {(() => {
                            const paymentDetails =
                              typeof (currentContest as any).payment_details ===
                              "string"
                                ? JSON.parse(
                                    (currentContest as any).payment_details
                                  )
                                : (currentContest as any).payment_details;
                            const walletUsed =
                              paymentDetails.wallet_amount_used || 0;
                            const stripeUsed =
                              paymentDetails.stripe_amount_paid || 0;

                            if (walletUsed > 0 && stripeUsed > 0) {
                              // Split payment
                              return (
                                <>
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-800/30 rounded-lg">
                                      <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                                        From Wallet
                                      </p>
                                      <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                                        {formatMoney(walletUsed)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-800/30 rounded-lg">
                                      <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300 uppercase tracking-wide">
                                        From Card
                                      </p>
                                      <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                                        {formatMoney(stripeUsed)}
                                      </p>
                                    </div>
                                  </div>
                                </>
                              );
                            } else if (walletUsed > 0) {
                              // Wallet only
                              return (
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-emerald-100 dark:bg-emerald-800/30 rounded-lg">
                                    <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                                      Payment Method
                                    </p>
                                    <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                                      Wallet
                                    </p>
                                  </div>
                                </div>
                              );
                            } else if (stripeUsed > 0) {
                              // Credit card only
                              return (
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-indigo-100 dark:bg-indigo-800/30 rounded-lg">
                                    <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300 uppercase tracking-wide">
                                      Payment Method
                                    </p>
                                    <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                                      Credit Card
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        {/* Payment Status and Date */}
                        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-medium text-green-800 dark:text-green-300">
                              Payment{" "}
                              {(() => {
                                const paymentDetails =
                                  typeof (currentContest as any)
                                    .payment_details === "string"
                                    ? JSON.parse(
                                        (currentContest as any).payment_details
                                      )
                                    : (currentContest as any).payment_details;
                                return paymentDetails.payment_status ===
                                  "completed"
                                  ? "Completed"
                                  : "Pending";
                              })()}
                            </span>
                          </div>
                          {(() => {
                            const paymentDetails =
                              typeof (currentContest as any).payment_details ===
                              "string"
                                ? JSON.parse(
                                    (currentContest as any).payment_details
                                  )
                                : (currentContest as any).payment_details;
                            return paymentDetails.paid_at ? (
                              <span className="text-xs text-blue-700 dark:text-blue-400">
                                Paid on{" "}
                                {formatLocalDateTime(paymentDetails.paid_at, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(currentContest as any).rules_html && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-foreground">
                      Rules
                    </h3>
                    <div
                      className={cn(
                        "border rounded-lg p-4",
                        isDark ? "border-gray-600" : "border-gray-300"
                      )}
                    >
                      <div
                        className={cn(
                          "prose prose-md max-w-none",
                          isDark
                            ? "bg-[#170337] text-white prose-invert border-gray-600"
                            : "bg-white text-foreground"
                        )}
                        dangerouslySetInnerHTML={{
                          __html: (currentContest as any).rules_html,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* New Features Sections (2025-10-01) */}
                {/* Content Type Section */}
                {(currentContest as any).content_type && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                      <Tag className="h-5 w-5 text-blue-600" />
                      Content Type
                    </h3>
                    <div className="border border-blue-300 bg-blue-50/50 rounded-xl p-4">
                      <p className="text-lg font-semibold text-blue-900 uppercase tracking-wide">
                        {(currentContest as any).content_type.toUpperCase()}
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        This contest is looking for{" "}
                        {(currentContest as any).content_type === "ugc"
                          ? "User Generated Content"
                          : (currentContest as any).content_type === "clipping"
                          ? "Clipping/Editing"
                          : "Other"}{" "}
                        type submissions.{" "}
                        {(currentContest as any).content_type === "other"
                          ? "( Check rules for more details what kind of content you can create ) "
                          : ""}
                      </p>
                    </div>
                  </div>
                )}

                {/* Flat Fee Bonus Section */}
                {(currentContest.contest_based_details?.cpm_contest
                  ?.flat_fee_bonus ||
                  currentContest.contest_based_details?.leaderboard_contest
                    ?.flat_fee_bonus) && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                      <Gift className="h-5 w-5 text-green-600" />
                      Guaranteed Flat Bonus
                    </h3>
                    <div className="border border-green-300 bg-green-50/50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-green-900 mb-2">
                        {formatMoney(
                          (
                            currentContest.contest_based_details
                              ?.cpm_contest as any
                          )?.flat_fee_bonus ||
                            (
                              currentContest.contest_based_details
                                ?.leaderboard_contest as any
                            )?.flat_fee_bonus ||
                            0
                        )}{" "}
                        per verified submission
                      </p>
                      <p className="text-sm text-green-700">
                        🎁 Each creator earns this guaranteed amount for EVERY
                        verified submission, regardless of views or ranking!
                        Paid after the contest ends along with other earnings.
                      </p>
                    </div>
                  </div>
                )}

                {/* Multiple Submissions Section */}
                {(currentContest as any).multiple_submissions_enabled && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                      <CheckCheck className="h-5 w-5 text-purple-600" />
                      Multiple Submissions Allowed
                    </h3>
                    <div className="border border-purple-300 bg-purple-50/50 rounded-xl p-4">
                      <p className="text-lg font-semibold text-purple-900 mb-2">
                        Creators can submit up to{" "}
                        {(currentContest as any).max_submissions_per_creator}{" "}
                        entries for this contest!
                      </p>
                      <p className="text-sm text-purple-700 mb-3">
                        Allow multiple submissions to maximize creator
                        engagement. Min/max view requirements (if any) apply to
                        ALL submissions.
                      </p>
                      {(currentContest as any).max_earnings_per_creator && (
                        <div className="mt-3 pt-3 border-t border-purple-200">
                          <p className="text-sm text-purple-800 font-medium">
                            💡 Earnings Cap for This Contest:{" "}
                            {formatMoney(
                              (currentContest as any).max_earnings_per_creator
                            )}
                          </p>
                          <p className="text-xs text-purple-600 mt-1">
                            Creators can still submit after reaching this cap,
                            but won't earn more from THIS specific contest. This
                            cap doesn't affect their earnings from other
                            contests!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Bonus Opportunities Section */}
                {(currentContest as any).bonus_details?.description_html && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                      <Star className="h-5 w-5 text-amber-600" />
                      Additional Bonus Opportunities
                    </h3>
                    <div className="border border-amber-300 bg-amber-50/50 rounded-xl p-4">
                      <div
                        className="prose prose-md max-w-none text-foreground"
                        dangerouslySetInnerHTML={{
                          __html: (currentContest as any).bonus_details
                            .description_html,
                        }}
                      />
                      <p className="text-xs text-amber-700 mt-3 italic">
                        ℹ️ These bonuses are handled manually by you. Make sure
                        to follow through on these commitments to maintain
                        creator trust!
                      </p>
                    </div>
                  </div>
                )}

                {/* Render inspiration links if present */}
                {Array.isArray(currentContest.inspiration_links) &&
                  currentContest.inspiration_links.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        {/* <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div> */}
                        <h3
                          className={cn(
                            "text-xl font-semibold",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          Inspiration Links
                        </h3>
                      </div>

                      <div className="grid gap-4">
                        {currentContest.inspiration_links.map((item, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "border rounded-xl p-6 transition-all duration-200",
                              isDark ? "border-gray-600" : "border-gray-300"
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={cn(
                                  "p-3 rounded-full flex-shrink-0",
                                  isDark
                                    ? "bg-[#FFFFFF42] text-white"
                                    : "bg-purple-100 text-purple-600"
                                )}
                              >
                                <ExternalLink className="h-5 w-5 " />
                              </div>
                              <div className="flex-1 min-w-0">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "block text-base font-medium hover:underline mb-2 break-all",
                                    isDark
                                      ? "text-purple-300"
                                      : "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                  )}
                                >
                                  {item.url}
                                </a>
                                <div
                                  className={cn(
                                    "text-sm leading-relaxed",
                                    isDark
                                      ? "text-white"
                                      : "text-gray-700 dark:text-gray-300"
                                  )}
                                >
                                  {item.description}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Render tracking links if present */}
                {Array.isArray(currentContest.tracking_links) &&
                  currentContest.tracking_links.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex flex-col gap-3">
                        <h3 className="px-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                          Tracking Links
                        </h3>
                        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-600/40 dark:bg-yellow-900/20 dark:text-yellow-200">
                          <span className="font-medium">Note:</span> change the
                          sub1 and sub2 ... according to your submission number
                          if you are doing multiple submissions ..
                        </div>
                      </div>

                      <div className="grid gap-4">
                        {currentContest.tracking_links.map((item, idx) => {
                          // Process URL to replace [creator] with current user's username
                          const username = getCurrentUserUsername();
                          const processedUrl = processUrlWithCreator(
                            item.url,
                            username
                          );

                          return (
                            <div
                              key={idx}
                              className="bg-white border border-gray-300 rounded-xl p-6 transition-all duration-200"
                            >
                              <div className="flex items-start gap-4">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                                  <ExternalLink className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <a
                                      href={processedUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-base font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all flex-1"
                                    >
                                      {processedUrl}
                                    </a>
                                    <button
                                      onClick={() =>
                                        handleCopyTrackingLink(processedUrl)
                                      }
                                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200 flex-shrink-0"
                                      title="Copy link"
                                    >
                                      <Copy className="h-4 w-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200" />
                                    </button>
                                  </div>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                    {item.description}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                {currentContest.resources &&
                  ((Array.isArray(currentContest.resources) &&
                    currentContest.resources.length > 0) ||
                    (typeof currentContest.resources === "object" &&
                      Object.keys(currentContest.resources).length > 0)) && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        {/* <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div> */}
                        <h3
                          className={cn(
                            "text-xl font-semibold",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          Resources
                        </h3>
                      </div>

                      <div className="grid gap-4">
                        {(Array.isArray(currentContest.resources)
                          ? currentContest.resources
                          : Object.entries(currentContest.resources).map(
                              ([description, url]) => ({
                                url,
                                description,
                                type: "external",
                              })
                            )
                        ).map((resource, idx) => {
                          const isImage =
                            resource.url.startsWith("data:image") ||
                            /\.(jpg|jpeg|png|gif|jfif|webp)$/i.test(
                              resource.url
                            );
                          const isPdf = /\.pdf$/i.test(resource.url);
                          const isVideo = /\.(mp4|mov|avi|webm)$/i.test(
                            resource.url
                          );
                          const isInternal = resource.type === "internal";
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "border rounded-xl p-6 transition-all duration-200",
                                isDark ? "border-gray-600" : "border-gray-300"
                              )}
                            >
                              <div className="flex flex-col md:flex-row justify-between">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  {isInternal && isImage && !isPdf ? (
                                    <img
                                      src={resource.url}
                                      alt={resource.description}
                                      className="w-12 h-12 object-cover rounded-lg"
                                    />
                                  ) : isInternal && isPdf ? (
                                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center border border-red-200 dark:border-red-700">
                                      <svg
                                        className="w-6 h-6 text-red-600 dark:text-red-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                  ) : isInternal && isVideo ? (
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-700">
                                      <svg
                                        className="w-6 h-6 text-blue-600 dark:text-blue-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                      </svg>
                                    </div>
                                  ) : isInternal &&
                                    !isImage &&
                                    !isPdf &&
                                    !isVideo ? (
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center border border-green-200 dark:border-green-700">
                                      <svg
                                        className="w-6 h-6 text-green-600 dark:text-green-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                  ) : (
                                    <div
                                      className={cn(
                                        "p-3 rounded-full flex-shrink-0",
                                        isDark
                                          ? "bg-[#FFFFFF42] text-white"
                                          : "bg-purple-100 text-purple-600"
                                      )}
                                    >
                                      <ExternalLink className="h-5 w-5" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <h4
                                      className={cn(
                                        "text-base font-semibold mb-1",
                                        isDark ? "text-white" : "text-gray-900 "
                                      )}
                                    >
                                      {resource.description}
                                    </h4>
                                    <p
                                      className={cn(
                                        "text-sm",
                                        isDark ? "text-white" : "text-gray-600"
                                      )}
                                    >
                                      {resource.type === "external"
                                        ? "External Link"
                                        : "Uploaded File"}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="bg-[#6C43D0] hover:bg-[#6C43D0] mt-3 md:mt-0 rounded-xl text-white px-4 py-2 text-md"
                                >
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center"
                                  >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    {isPdf
                                      ? "Open PDF"
                                      : isVideo
                                      ? "Play Video"
                                      : isImage
                                      ? "View Image"
                                      : "View Resource"}
                                  </a>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </CardContent>
            </div>
          </TabPanel>

          <TabPanel value="submissions" activeTab={activeTab}>
            {currentSubmissions.length > 0 ? (
              <div className="space-y-6">
                {/* Enhanced Header Section */}
                <div className="border border-[#D1B7F9] rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "p-4 rounded-full",
                            isDark
                              ? "bg-[#FFFFFF36] text-white"
                              : "bg-[#D8C3FF] text-[#4A00BE]"
                          )}
                        >
                          <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                          <h2
                            className={cn(
                              "text-2xl font-bold",
                              isDark ? "text-white" : "text-gray-900 "
                            )}
                          >
                            Submissions Leaderboard
                          </h2>
                          <div className="flex flex-wrap items-center mt-1 gap-x-2 gap-y-1 text-sm">
                            <div className="text-sm">
                              {filteredSubmissions.length} submission
                              {filteredSubmissions.length !== 1 ? "s" : ""}
                            </div>
                            <div
                              className={cn(
                                "flex items-center gap-1 text-sm",
                                isDark ? "text-white" : "text-slate-600"
                              )}
                            >
                              <div className="px-[3px]">|</div>
                              {currentContest.platform}
                            </div>
                            {currentContest.last_metrics_updated && (
                              <div
                                className={cn(
                                  "flex items-center gap-1 text-sm",
                                  isDark ? "text-white" : "text-slate-600"
                                )}
                              >
                                <div className="px-[3px]">|</div>
                                Last updated:{" "}
                                {formatTimeAgo(
                                  currentContest.last_metrics_updated
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {currentContest.moderation_status === "published" &&
                          (currentContest.status === "active" ||
                            currentContest.status === "ended") &&
                          currentSubmissions &&
                          currentSubmissions.length > 0 &&
                          currentContest.post_contest_status !== "in_review" &&
                          currentContest.post_contest_status !==
                            "verification_complete" &&
                          currentContest.post_contest_status !==
                            "payouts_processed" && (
                            <button
                              onClick={handleRefreshMetrics}
                              disabled={
                                isRefreshingMetrics || !cooldownInfo.canRefresh
                              }
                              className={`flex items-center py-2 px-4 gap-2 rounded-2xl ${
                                cooldownInfo.canRefresh && !isRefreshingMetrics
                                  ? "bg-[#6C43D0] text-white hover:bg-[#6C43D0]"
                                  : "bg-[#6C43D0] text-white hover:bg-[#6C43D0]"
                              }`}
                              title={
                                !cooldownInfo.canRefresh
                                  ? `Please wait ${
                                      cooldownInfo.remainingMinutes
                                    } more minute${
                                      cooldownInfo.remainingMinutes !== 1
                                        ? "s"
                                        : ""
                                    }`
                                  : undefined
                              }
                            >
                              {isRefreshingMetrics ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              {isRefreshingMetrics
                                ? "Updating..."
                                : !cooldownInfo.canRefresh
                                ? `Wait ${cooldownInfo.remainingMinutes}m`
                                : "Refresh Metrics"}
                            </button>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Enhanced Status Filter Tabs */}
                <div>
                  <div className="py-4">
                    <Tabs
                      value={activeStatusTab}
                      onValueChange={(value) =>
                        setActiveStatusTab(value as any)
                      }
                      className="w-full"
                    >
                      <TabsList className="flex gap-5 w-full h-auto p-1">
                        <TabsTrigger
                          value="all"
                          className={cn(
                            "flex-1 gap-3 items-center px-1 border",
                            isDark
                              ? "text-white border-gray-400"
                              : "text-[#7F39EC] border-[#7F39EC]"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 mr-1 mb-0.5" />
                            <span className="text-[13px] font-medium">All</span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "px-1.5 py-0.5 text-sm h-5",
                              isDark
                                ? "text-white bg-[#FFFFFF36]"
                                : "text-[#7F39EC] bg-purple-200"
                            )}
                          >
                            {currentSubmissions.length}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                          value="verified_or_paid"
                          className={cn(
                            "flex-1 gap-3 items-center px-1 border",
                            isDark
                              ? "text-white border-gray-400"
                              : "text-[#7F39EC] border-[#7F39EC]"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 mb-0.5" />
                            <Wallet className="h-3.5 w-3.5 mr-1" />
                            <span className="text-[13px] font-medium">
                              Verified + Paid
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "px-1.5 py-0.5 text-sm h-5",
                              isDark
                                ? "text-white bg-[#FFFFFF36]"
                                : "text-[#7F39EC] bg-purple-200"
                            )}
                          >
                            {
                              currentSubmissions.filter(
                                (s) =>
                                  s.status === "verified" || s.status === "paid"
                              ).length
                            }
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                          value="pending"
                          className={cn(
                            "flex-1 gap-3 items-center px-1 border",
                            isDark
                              ? "text-white border-gray-400"
                              : "text-[#7F39EC] border-[#7F39EC]"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 mr-1 mb-0.5" />
                            <span className="text-[13px] font-medium">
                              Pending
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "px-1.5 py-0.5 text-sm h-5",
                              isDark
                                ? "text-white bg-[#FFFFFF36]"
                                : "text-[#7F39EC] bg-purple-200"
                            )}
                          >
                            {
                              currentSubmissions.filter(
                                (s) => s.status === "pending"
                              ).length
                            }
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                          value="verified"
                          className={cn(
                            "flex-1 gap-3 items-center px-1 border",
                            isDark
                              ? "text-white border-gray-400"
                              : "text-[#7F39EC] border-[#7F39EC]"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1 mb-0.5" />
                            <span className="text-[13px] font-medium">
                              Verified
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "px-1.5 py-0.5 text-sm h-5",
                              isDark
                                ? "text-white bg-[#FFFFFF36]"
                                : "text-[#7F39EC] bg-purple-200"
                            )}
                          >
                            {
                              currentSubmissions.filter(
                                (s) => s.status === "verified"
                              ).length
                            }
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                          value="rejected"
                          className={cn(
                            "flex-1 gap-3 items-center px-1 border",
                            isDark
                              ? "text-white border-gray-400"
                              : "text-[#7F39EC] border-[#7F39EC]"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5 mr-1 mb-0.5" />
                            <span className="text-[13px] font-medium">
                              Rejected
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "px-1.5 py-0.5 text-sm h-5",
                              isDark
                                ? "text-white bg-[#FFFFFF36]"
                                : "text-[#7F39EC] bg-purple-200"
                            )}
                          >
                            {
                              currentSubmissions.filter(
                                (s) => s.status === "rejected"
                              ).length
                            }
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                          value="paid"
                          className={cn(
                            "flex-1 gap-3 items-center px-1 border",
                            isDark
                              ? "text-white border-gray-400"
                              : "text-[#7F39EC] border-[#7F39EC]"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <Wallet className="h-3.5 w-3.5 mr-1 mb-0.5" />
                            <span className="text-[13px] font-medium">
                              Paid
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "px-1.5 py-0.5 text-sm h-5",
                              isDark
                                ? "text-white bg-[#FFFFFF36]"
                                : "text-[#7F39EC] bg-purple-200"
                            )}
                          >
                            {
                              currentSubmissions.filter(
                                (s) => s.status === "paid"
                              ).length
                            }
                          </Badge>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                {/* Enhanced Submissions Table */}
                <div
                  className={cn(
                    "p-4 rounded-xl shadow-xl",
                    isDark ? "bg-[#170337]" : "bg-white "
                  )}
                >
                  <CardContent className="p-0">
                    <div className="overflow-auto">
                      {/* View Mode Toggle and Sort control */}
                      <div className="flex items-center justify-between px-4 py-2 mb-4">
                        <div className="flex items-center gap-3 text-md">
                          <span className="text-slate-600">View</span>
                          <Select
                            value={viewMode}
                            onValueChange={(v) =>
                              setViewMode(v as "normal" | "creator-wise")
                            }
                          >
                            <SelectTrigger className="h-12 w-[180px]">
                              <SelectValue placeholder="View mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">
                                Normal View
                              </SelectItem>
                              <SelectItem value="creator-wise">
                                Creator-wise
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-3 text-md">
                          <span
                            className={cn(
                              "text-md",
                              isDark ? "text-white" : "text-slate-700"
                            )}
                          >
                            Sort by
                          </span>
                          <Select
                            value={sortOption}
                            onValueChange={(v) => setSortOption(v as any)}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-12 w-[220px]",
                                isDark ? "border-gray-500" : "border-slate-300"
                              )}
                            >
                              <SelectValue placeholder="Sort submissions" />
                            </SelectTrigger>
                            <SelectContent isDark={isDark}>
                              <SelectItem isDark={isDark} value="views_desc">
                                Views • High → Low
                              </SelectItem>
                              <SelectItem value="views_asc" isDark={isDark}>
                                Views • Low → High
                              </SelectItem>
                              <SelectItem value="time_desc" isDark={isDark}>
                                Submitted • Newest First
                              </SelectItem>
                              <SelectItem value="time_asc" isDark={isDark}>
                                Submitted • Oldest First
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {viewMode === "normal" && (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-100 hover:bg-slate-100 border-b border-slate-200">
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Creator</TableHead>
                              <TableHead className="text-center">
                                Views
                              </TableHead>
                              <TableHead className="text-center">
                                Likes
                              </TableHead>
                              <TableHead className="text-center">
                                Comments
                              </TableHead>
                              {/* Dynamic headers based on contest platform */}
                              {currentContest.platform
                                ?.toLowerCase()
                                .includes("instagram") && (
                                <>
                                  <TableHead className="text-center">
                                    Shares
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Saves
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Reach
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Interactions
                                  </TableHead>
                                  {/* <TableHead className="text-center">Engagement Rate</TableHead> */}
                                </>
                              )}
                              <TableHead className="text-center">
                                Expected Reward
                              </TableHead>
                              <TableHead className="text-center">
                                Reward Granted
                              </TableHead>
                              <TableHead className="text-center">
                                Status
                              </TableHead>
                              <TableHead className="text-center">
                                Submitted
                              </TableHead>
                              <TableHead className="text-center">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredSubmissions
                              .sort((a, b) => {
                                switch (sortOption) {
                                  case "views_asc":
                                    return (a.views || 0) - (b.views || 0);
                                  case "time_desc": {
                                    const at = a.created_at
                                      ? new Date(a.created_at).getTime()
                                      : 0;
                                    const bt = b.created_at
                                      ? new Date(b.created_at).getTime()
                                      : 0;
                                    return bt - at;
                                  }
                                  case "time_asc": {
                                    const at = a.created_at
                                      ? new Date(a.created_at).getTime()
                                      : 0;
                                    const bt = b.created_at
                                      ? new Date(b.created_at).getTime()
                                      : 0;
                                    return at - bt;
                                  }
                                  case "views_desc":
                                  default:
                                    return (b.views || 0) - (a.views || 0);
                                }
                              })
                              .map((submission, index) => {
                                const metrics =
                                  extractPlatformMetrics(submission);
                                const submissionStatus =
                                  getSubmissionStatusBadge(submission.status);
                                const isLoading =
                                  isLoadingSubmission[submission.id] || false;
                                const rank = index + 1;

                                // Compute expected and granted rewards separately
                                const getExpectedReward = () => {
                                  if (
                                    currentContest.contest_type ===
                                    "leaderboard"
                                  ) {
                                    const contestDetails =
                                      currentContest.contest_based_details
                                        ?.leaderboard_contest;
                                    if (
                                      contestDetails?.prizes &&
                                      Array.isArray(contestDetails.prizes)
                                    ) {
                                      const currentRank = index + 1; // 1-based ranking
                                      const prizeForRank =
                                        contestDetails.prizes.find(
                                          (prize: any) =>
                                            prize.position === currentRank
                                        );
                                      if (prizeForRank) {
                                        const prizeAmount = centsToDollars(
                                          prizeForRank.amount
                                        );
                                        return {
                                          amount: prizeAmount,
                                          label: "Expected",
                                          className:
                                            "text-slate-700 font-semibold",
                                        };
                                      }
                                      return {
                                        amount: 0,
                                        label: "No Prize",
                                        className: "text-slate-500",
                                      };
                                    }
                                    return {
                                      amount: 0,
                                      label: "N/A",
                                      className: "text-slate-500",
                                    };
                                  }
                                  if (currentContest.contest_type === "cpm") {
                                    const cpmConfig =
                                      currentContest.contest_based_details
                                        ?.cpm_contest;
                                    const views = submission.views || 0;
                                    if (cpmConfig?.cpm_rate_usd) {
                                      let effectiveViews = views;
                                      if (
                                        cpmConfig.min_views != null &&
                                        views < cpmConfig.min_views
                                      ) {
                                        effectiveViews = 0;
                                      } else if (
                                        cpmConfig.max_views != null &&
                                        views > cpmConfig.max_views
                                      ) {
                                        effectiveViews = cpmConfig.max_views;
                                      }
                                      const calculatedEarnings =
                                        (effectiveViews *
                                          cpmConfig.cpm_rate_usd) /
                                        1000;
                                      return {
                                        amount: calculatedEarnings,
                                        label: "Expected",
                                        className:
                                          "text-slate-700 font-semibold",
                                      };
                                    }
                                    return {
                                      amount: 0,
                                      label: "N/A",
                                      className: "text-slate-500",
                                    };
                                  }
                                  return {
                                    amount: 0,
                                    label: "N/A",
                                    className: "text-slate-500",
                                  };
                                };

                                const getGrantedReward = () => {
                                  if (submission.status === "rejected") {
                                    return {
                                      amount: 0,
                                      label: "No Reward",
                                      className: "text-red-600 font-semibold",
                                    };
                                  }
                                  if (submission.status === "paid") {
                                    const dollars = submission.earnings
                                      ? centsToDollars(submission.earnings)
                                      : 0;
                                    return {
                                      amount: dollars,
                                      label: "Paid",
                                      className: "text-blue-600 font-semibold",
                                    };
                                  }
                                  if (
                                    submission.earnings !== null &&
                                    submission.earnings !== undefined &&
                                    submission.earnings > 0
                                  ) {
                                    return {
                                      amount: centsToDollars(
                                        submission.earnings
                                      ),
                                      label: "Pending",
                                      className: "text-amber-600 font-semibold",
                                    };
                                  }
                                  return {
                                    amount: 0,
                                    label: "—",
                                    className: "text-slate-500",
                                  };
                                };

                                const expectedInfo = getExpectedReward();
                                const grantedInfo = getGrantedReward();

                                return (
                                  <TableRow
                                    key={submission.id}
                                    className={cn(
                                      "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200",
                                      rank <= 3 &&
                                        "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/10 border-l-4 border-l-yellow-400"
                                    )}
                                  >
                                    <TableCell className="font-bold text-center">
                                      <div className="flex items-center justify-center">
                                        {rank <= 3 && (
                                          <Trophy
                                            className={cn(
                                              "h-4 w-4 mr-1",
                                              rank === 1
                                                ? isDark
                                                  ? "text-yellow-400"
                                                  : "text-yellow-500"
                                                : rank === 2
                                                ? "text-gray-400"
                                                : "text-amber-600"
                                            )}
                                          />
                                        )}
                                        {rank}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-3">
                                        <Avatar
                                          className={cn(
                                            "h-12 w-12 border-2 shadow-sm",
                                            isDark
                                              ? "border-slate-600"
                                              : "border-slate-200"
                                          )}
                                        >
                                          <AvatarImage
                                            src={
                                              submission.creator_avatar_url ||
                                              undefined
                                            }
                                            alt={
                                              submission.creator_display_name ||
                                              submission.creator_username ||
                                              "Creator"
                                            }
                                          />
                                          <AvatarFallback
                                            className={cn(
                                              "text-sm font-semibold",
                                              isDark
                                                ? "bg-gradient-to-br from-slate-700 to-slate-800 text-slate-200"
                                                : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800"
                                            )}
                                          >
                                            {(
                                              submission.creator_display_name ||
                                              submission.creator_username
                                            )
                                              ?.charAt(0)
                                              .toUpperCase() || "C"}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <p
                                            className={cn(
                                              "font-semibold text-sm truncate",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900"
                                            )}
                                          >
                                            {submission.creator_display_name ||
                                              "Unknown Creator"}
                                          </p>
                                          <p
                                            className={cn(
                                              "text-xs font-mono",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-600"
                                            )}
                                          >
                                            {submission.creator_username ||
                                              "unknown"}
                                          </p>
                                          {submission.video_thumbnail_url && (
                                            <a
                                              href={submission.content_link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={cn(
                                                "text-xs hover:underline flex items-center gap-1 mt-1 transition-colors",
                                                isDark
                                                  ? "text-purple-400"
                                                  : "text-blue-600 hover:text-blue-800"
                                              )}
                                            >
                                              <PlayCircle className="h-3 w-3" />
                                              View Content
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex flex-col items-center">
                                        <span
                                          className={cn(
                                            "font-bold  text-sm",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900"
                                          )}
                                        >
                                          {formatMetricValue(metrics.views)}
                                        </span>
                                        <span
                                          className={cn(
                                            "text-xs ",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-500"
                                          )}
                                        >
                                          views
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1">
                                          <ThumbsUp className="h-3 w-3 text-purple-400" />
                                          <span
                                            className={cn(
                                              "font-bold text-sm",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900"
                                            )}
                                          >
                                            {formatMetricValue(metrics.likes)}
                                          </span>
                                        </div>
                                        <span
                                          className={cn(
                                            "text-xs ",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-500"
                                          )}
                                        >
                                          likes
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1">
                                          <MessageCircle className="h-3 w-3 text-purple-400" />
                                          <span
                                            className={cn(
                                              "font-bold text-sm",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900 dark:text-slate-100"
                                            )}
                                          >
                                            {formatMetricValue(
                                              metrics.comments
                                            )}
                                          </span>
                                        </div>
                                        <span
                                          className={cn(
                                            "text-xs ",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-500"
                                          )}
                                        >
                                          comments
                                        </span>
                                      </div>
                                    </TableCell>
                                    {/* Dynamic data cells based on contest platform */}
                                    {currentContest.platform
                                      ?.toLowerCase()
                                      .includes("instagram") && (
                                      <>
                                        <TableCell className="text-center font-mono text-sm">
                                          <div className="flex items-center justify-center gap-1">
                                            <Share2 className="h-3 w-3 text-purple-500" />
                                            {formatMetricValue(metrics.shares)}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-sm">
                                          {formatMetricValue(
                                            (metrics as any).saves
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-sm">
                                          {formatMetricValue(
                                            (metrics as any).reach
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-sm">
                                          {formatMetricValue(
                                            (metrics as any).total_interactions
                                          )}
                                        </TableCell>
                                        {/* <TableCell className="text-center font-mono text-sm">
                                                                            {formatMetricValue(metrics.engagement_rate, true)}
                                                                        </TableCell> */}
                                      </>
                                    )}
                                    <TableCell className="text-center">
                                      <div className="flex flex-col items-center">
                                        <div className="flex flex-col items-center">
                                          <span
                                            className={cn(
                                              "text-lg font-bold tracking-wide",
                                              expectedInfo.className.includes(
                                                "text-slate-500"
                                              )
                                                ? isDark
                                                  ? "text-slate-400"
                                                  : "text-slate-500"
                                                : expectedInfo.className.includes(
                                                    "text-slate-700"
                                                  )
                                                ? isDark
                                                  ? "text-slate-200"
                                                  : "text-slate-700"
                                                : isDark
                                                ? "text-white"
                                                : "text-slate-900"
                                            )}
                                          >
                                            ${expectedInfo.amount.toFixed(2)}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs uppercase tracking-wide",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-800"
                                            )}
                                          >
                                            {expectedInfo.label}
                                          </span>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex flex-col items-center">
                                        {grantedInfo.amount > 0 ? (
                                          <div className="flex flex-col items-center">
                                            <span
                                              className={cn(
                                                "text-lg font-bold",
                                                grantedInfo.className.includes(
                                                  "text-red-600"
                                                )
                                                  ? isDark
                                                    ? "text-red-400"
                                                    : "text-red-600"
                                                  : grantedInfo.className.includes(
                                                      "text-blue-600"
                                                    )
                                                  ? isDark
                                                    ? "text-blue-400"
                                                    : "text-blue-600"
                                                  : grantedInfo.className.includes(
                                                      "text-amber-600"
                                                    )
                                                  ? isDark
                                                    ? "text-amber-400"
                                                    : "text-amber-600"
                                                  : grantedInfo.className.includes(
                                                      "text-slate-500"
                                                    )
                                                  ? isDark
                                                    ? "text-slate-400"
                                                    : "text-slate-500"
                                                  : isDark
                                                  ? "text-white"
                                                  : "text-slate-900"
                                              )}
                                            >
                                              ${grantedInfo.amount.toFixed(2)}
                                            </span>
                                            <span
                                              className={cn(
                                                "text-xs uppercase tracking-wide",
                                                isDark
                                                  ? "text-slate-400"
                                                  : "text-slate-500"
                                              )}
                                            >
                                              {grantedInfo.label}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center">
                                            <span
                                              className={cn(
                                                "text-sm font-semibold",
                                                grantedInfo.className.includes(
                                                  "text-red-600"
                                                )
                                                  ? isDark
                                                    ? "text-red-400"
                                                    : "text-red-600"
                                                  : grantedInfo.className.includes(
                                                      "text-blue-600"
                                                    )
                                                  ? isDark
                                                    ? "text-blue-400"
                                                    : "text-blue-600"
                                                  : grantedInfo.className.includes(
                                                      "text-amber-600"
                                                    )
                                                  ? isDark
                                                    ? "text-amber-400"
                                                    : "text-amber-600"
                                                  : grantedInfo.className.includes(
                                                      "text-slate-500"
                                                    )
                                                  ? isDark
                                                    ? "text-slate-400"
                                                    : "text-slate-500"
                                                  : isDark
                                                  ? "text-white"
                                                  : "text-slate-900"
                                              )}
                                            >
                                              {grantedInfo.label}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex flex-col items-center">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-xs inline-flex items-center gap-1 px-3 py-1 font-medium",
                                            submissionStatus.className
                                          )}
                                        >
                                          {submissionStatus.icon}{" "}
                                          {submissionStatus.text}
                                        </Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-center text-xs",
                                        isDark ? "text-white" : "text-slate-700"
                                      )}
                                    >
                                      <div className="flex flex-col">
                                        <span>
                                          {formatLocalDateTime(
                                            submission.created_at,
                                            { dateStyle: "short" }
                                          )}
                                        </span>
                                        <span className="text-xs">
                                          {formatLocalDateTime(
                                            submission.created_at,
                                            { timeStyle: "short" }
                                          )}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={isLoading}
                                          >
                                            {isLoading ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <MoreVertical className="h-4 w-4" />
                                            )}
                                            <span className="sr-only">
                                              Actions
                                            </span>
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          className="bg-white"
                                          align="end"
                                        >
                                        {currentContest.post_contest_status !==
                                            "payouts_processed" &&
                                            currentContest.post_contest_status !==
                                            "verification_complete" &&
                                            currentContest.post_contest_status !==
                                            "payments_processed" && (
                                              <>
                                                <DropdownMenuLabel className="text-purple-500">
                                                  Change Status
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                              </>
                                            )}
                                          {submission.status !== "verified" &&
                                            currentContest.post_contest_status !==
                                            "payouts_processed" &&
                                            currentContest.post_contest_status !==
                                            "verification_complete" &&
                                            currentContest.post_contest_status !==
                                            "payments_processed" &&
                                            (submission.status === "paid" ? (
                                              <DropdownMenuItem
                                                disabled={isLoading}
                                                onClick={() =>
                                                  setConfirmReversal({
                                                    id: submission.id,
                                                    target: "verified",
                                                  })
                                                }
                                              >
                                                Mark as Verified
                                              </DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem
                                                disabled={isLoading}
                                                onClick={() =>
                                                  handleUpdateSubmissionStatus(
                                                    submission.id,
                                                    "verified"
                                                  )
                                                }
                                              >
                                                Mark as Verified
                                              </DropdownMenuItem>
                                            ))}
                                            {submission.status !== "rejected" &&
                                            currentContest.post_contest_status !==
                                            "payouts_processed" &&
                                            currentContest.post_contest_status !==
                                            "verification_complete" &&
                                            currentContest.post_contest_status !==
                                            "payments_processed" &&
                                            (submission.status === "paid" ? (
                                              <DropdownMenuItem
                                                disabled={isLoading}
                                                onClick={() =>
                                                  setConfirmReversal({
                                                    id: submission.id,
                                                    target: "rejected",
                                                    needRejectionReason: true,
                                                  })
                                                }
                                                className="text-red-600"
                                              >
                                                Mark as Rejected
                                              </DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem
                                                disabled={isLoading}
                                                onClick={() =>
                                                  handleRejectSubmission(
                                                    submission.id
                                                  )
                                                }
                                                className="text-red-600"
                                              >
                                                Mark as Rejected
                                              </DropdownMenuItem>
                                            ))}
                                              {submission.status !== "pending" &&
                                            currentContest.post_contest_status !==
                                            "payouts_processed" &&
                                            currentContest.post_contest_status !==
                                            "verification_complete" &&
                                            currentContest.post_contest_status !==
                                            "payments_processed" &&
                                            (submission.status === "paid" ? (
                                              <DropdownMenuItem
                                                disabled={isLoading}
                                                onClick={() =>
                                                  setConfirmReversal({
                                                    id: submission.id,
                                                    target: "pending",
                                                  })
                                                }
                                              >
                                                Set to Pending
                                              </DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem
                                                disabled={isLoading}
                                                onClick={() =>
                                                  handleUpdateSubmissionStatus(
                                                    submission.id,
                                                    "pending"
                                                  )
                                                }
                                              >
                                                Set to Pending
                                              </DropdownMenuItem>
                                            ))}
                                          {submission.status !== "paid" &&
                                            isAdminView &&
                                            currentContest.post_contest_status ===
                                              "verification_complete" && (
                                              <>
                                                <DropdownMenuItem
                                                  disabled={isLoading}
                                                  onClick={() =>
                                                    handleUpdateSubmissionStatus(
                                                      submission.id,
                                                      "paid"
                                                    )
                                                  }
                                                >
                                                  Mark as Paid
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  disabled={isLoading}
                                                  onClick={() =>
                                                    handleMarkAsPaid(
                                                      submission.id
                                                    )
                                                  }
                                                >
                                                  Mark as Custom Paid
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          {currentContest.post_contest_status !==
                                            "payouts_processed" && (
                                            <DropdownMenuSeparator />
                                          )}
                                          <DropdownMenuItem asChild>
                                            <a
                                              href={submission.content_link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center"
                                            >
                                              <ExternalLink className="h-3 w-3 mr-2" />
                                              View Content
                                            </a>
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      )}

                      {/* Creator-wise View Table */}
                      {viewMode === "creator-wise" &&
                        groupSubmissionsByCreator && (
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-100 hover:bg-slate-100 border-b border-slate-200">
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Creator</TableHead>
                                <TableHead className="text-center">
                                  Total Submissions
                                </TableHead>
                                <TableHead className="text-center">
                                  Status
                                </TableHead>
                                <TableHead className="text-center">
                                  Views
                                </TableHead>
                                <TableHead className="text-center">
                                  Likes
                                </TableHead>
                                <TableHead className="text-center">
                                  Comments
                                </TableHead>
                                <TableHead className="text-center">
                                  Expected Reward
                                </TableHead>
                                <TableHead className="text-center">
                                  Reward Granted
                                </TableHead>
                                {(() => {
                                  const flatFeeBonus =
                                    currentContest.contest_type === "cpm"
                                      ? (
                                          currentContest.contest_based_details as any
                                        )?.cpm_contest?.flat_fee_bonus
                                      : (
                                          currentContest.contest_based_details as any
                                        )?.leaderboard_contest?.flat_fee_bonus;
                                  return flatFeeBonus > 0;
                                })() && (
                                  <>
                                    <TableHead className="text-center">
                                      Bonus Expected
                                    </TableHead>
                                    <TableHead className="text-center">
                                      Bonus Granted
                                    </TableHead>
                                  </>
                                )}
                                <TableHead className="text-center">
                                  First Submitted
                                </TableHead>
                                <TableHead className="text-center">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(groupSubmissionsByCreator as any[]).length ===
                              0 ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={12}
                                    className="text-center py-8 text-gray-500"
                                  >
                                    No creators found for the selected status
                                    filter.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                (groupSubmissionsByCreator as any[]).map(
                                  (group: any, index: number) => (
                                    <TableRow key={group.creator.id}>
                                      <TableCell className="font-medium">
                                        {index + 1}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-8 w-8">
                                            <AvatarImage
                                              src={
                                                group.creator
                                                  .profile_picture_url ||
                                                undefined
                                              }
                                            />
                                            <AvatarFallback>
                                              {group.creator.username?.[0]?.toUpperCase() ||
                                                "U"}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="font-medium">
                                            {group.creator.username}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center font-semibold">
                                        {group.totalCount}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-wrap gap-1 justify-center">
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            All: {group.statusCounts.all}
                                          </Badge>
                                          {group.statusCounts.verified > 0 && (
                                            <Badge className="bg-green-500 text-white text-xs">
                                              V: {group.statusCounts.verified}
                                            </Badge>
                                          )}
                                          {group.statusCounts.paid > 0 && (
                                            <Badge className="bg-blue-500 text-white text-xs">
                                              P: {group.statusCounts.paid}
                                            </Badge>
                                          )}
                                          {group.statusCounts.pending > 0 && (
                                            <Badge className="bg-yellow-500 text-white text-xs">
                                              Pend: {group.statusCounts.pending}
                                            </Badge>
                                          )}
                                          {group.statusCounts.rejected > 0 && (
                                            <Badge className="bg-red-500 text-white text-xs">
                                              R: {group.statusCounts.rejected}
                                            </Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {group.metrics.views.toLocaleString()}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {group.metrics.likes.toLocaleString()}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {group.metrics.comments.toLocaleString()}
                                      </TableCell>
                                      <TableCell className="text-center font-medium">
                                        <div className="flex items-center justify-center gap-1">
                                          {formatMoney(group.earnings.expected)}
                                          {group.isCapped && (
                                            <span
                                              className="text-amber-600 cursor-help"
                                              title={`Capped at ${formatMoney(
                                                currentContest.max_earnings_per_creator
                                              )}. Original: ${formatMoney(
                                                group.earningsBeforeCap
                                              )}`}
                                            >
                                              ⚠️
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center font-medium text-green-600">
                                        {formatMoney(group.earnings.granted)}
                                      </TableCell>
                                      {(() => {
                                        const flatFeeBonus =
                                          currentContest.contest_type === "cpm"
                                            ? (
                                                currentContest.contest_based_details as any
                                              )?.cpm_contest?.flat_fee_bonus
                                            : (
                                                currentContest.contest_based_details as any
                                              )?.leaderboard_contest
                                                ?.flat_fee_bonus;
                                        return flatFeeBonus > 0;
                                      })() && (
                                        <>
                                          <TableCell className="text-center font-medium">
                                            {formatMoney(group.bonus.expected)}
                                          </TableCell>
                                          <TableCell className="text-center font-medium text-green-600">
                                            {formatMoney(group.bonus.granted)}
                                          </TableCell>
                                        </>
                                      )}
                                      <TableCell className="text-center text-sm">
                                        {formatLocalDateTime(
                                          group.firstSubmittedAt
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            setSelectedCreatorForModal(
                                              group.creator.id
                                            )
                                          }
                                        >
                                          View All ({group.totalCount})
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  )
                                )
                              )}
                            </TableBody>
                          </Table>
                        )}
                    </div>
                  </CardContent>
                </div>
              </div>
            ) : (
              <Card
                className={cn(
                  "shadow-sm border-0",
                  isDark ? "bg-[#170337]" : "bg-purple-50"
                )}
              >
                <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                  <div
                    className={cn(
                      "p-4 rounded-full mb-6",
                      isDark
                        ? "bg-[#FFFFFF36] text-white"
                        : "bg-purple-200 text-purple-500"
                    )}
                  >
                    <FileText className="h-12 w-12 " />
                  </div>
                  <h3
                    className={cn(
                      "text-xl font-semibold mb-2",
                      isDark
                        ? "text-white"
                        : "text-slate-900 dark:text-slate-100"
                    )}
                  >
                    No Submissions Yet
                  </h3>
                  <p
                    className={cn(
                      " max-w-md",
                      isDark
                        ? "text-white"
                        : "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    When creators submit entries for this contest, they will
                    appear here with detailed metrics and status information.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabPanel>

          <TabPanel value="analytics" activeTab={activeTab}>
            <div
              className={cn(
                "rounded-xl shadow-md p-2",
                isDark ? "bg-[#180438]" : "bg-white"
              )}
            >
              <CardHeader>
                <CardTitle>Contest Analytics</CardTitle>
                {/* Analytics Filter Tabs */}
                <div className="mt-4">
                  <Tabs
                    value={activeAnalyticsTab}
                    onValueChange={(value) =>
                      setActiveAnalyticsTab(value as any)
                    }
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-6">
                      <TabsTrigger
                        value="all"
                        className="text-xs data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                      >
                        All ({currentSubmissions?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger
                        value="verified"
                        className="text-xs data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                      >
                        Verified (
                        {currentSubmissions?.filter(
                          (s) => s.status === "verified"
                        ).length || 0}
                        )
                      </TabsTrigger>
                      <TabsTrigger
                        value="paid"
                        className="text-xs data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                      >
                        Paid (
                        {currentSubmissions?.filter((s) => s.status === "paid")
                          .length || 0}
                        )
                      </TabsTrigger>
                      <TabsTrigger
                        value="pending"
                        className="text-xs data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                      >
                        Pending (
                        {currentSubmissions?.filter(
                          (s) => s.status === "pending"
                        ).length || 0}
                        )
                      </TabsTrigger>
                      <TabsTrigger
                        value="rejected"
                        className="text-xs data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                      >
                        Rejected (
                        {currentSubmissions?.filter(
                          (s) => s.status === "rejected"
                        ).length || 0}
                        )
                      </TabsTrigger>
                      <TabsTrigger
                        value="verified_or_paid"
                        className="text-xs data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                      >
                        Verified/Paid (
                        {currentSubmissions?.filter(
                          (s) => s.status === "verified" || s.status === "paid"
                        ).length || 0}
                        )
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">Total Submissions</h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {currentSubmissions?.length || 0}
                    </p>
                  </div> */}

                  <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
                    <CardContent className="p-4 flex justify-between">
                      <div className="flex-1 text-black space-y-3">
                        <p className="text-lg font-medium">Total Submissions</p>
                        <p className="text-xl font-bold">
                          {currentSubmissions?.length || 0}
                        </p>
                        {/* <p className="text-md">Total entries</p> */}
                      </div>
                      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                        <Users className="h-5 w-5 " />
                      </div>
                    </CardContent>
                  </div>

                  <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
                    <CardContent className="p-4 flex justify-between">
                      <div className="flex-1 text-black space-y-3">
                        <p className="text-lg font-medium">Approved Content</p>
                        <p className="text-xl font-bold">
                          {" "}
                          {currentSubmissions?.filter(
                            (s) =>
                              s.status === "verified" || s.status === "paid"
                          ).length || 0}
                        </p>
                        {/* <p className="text-md">Total entries</p> */}
                      </div>
                      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                        <Trophy className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </div>
                  {/* <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">Approved Content</h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {currentSubmissions?.filter(
                        (s) => s.status === "verified"
                      ).length || 0}
                    </p>
                  </div> */}

                  <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2">
                    <CardContent className="p-4 flex justify-between">
                      <div className="flex-1 text-black space-y-3">
                        <p className="text-lg font-medium">Contest Duration</p>
                        <p className="text-xl font-bold">
                          {" "}
                          {durationDays ? `${durationDays} days` : "N/A"}
                        </p>
                        {/* <p className="text-md">Total entries</p> */}
                      </div>
                      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#D8C3FF] text-[#4A00BE]">
                        <Calendar className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </div>
                  {/* <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">Contest Duration</h3>
                    </div>
                    <p className="text-2xl font-bold">
                      {durationDays ? `${durationDays} days` : "N/A"}
                    </p>
                  </div> */}
                </div>

                {/* <Separator className="my-6" /> */}

                <div className="space-y-6">
                  {/* Views Statistics */}
                  <div>
                    <h3 className="font-medium mb-4">Views Statistics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {/* Total Views */}
                      <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Total Views
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {filteredAnalyticsSubmissions
                                ?.reduce((sum, s) => sum + (s.views || 0), 0)
                                .toLocaleString() || 0}
                            </p>
                          </div>
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <Eye className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      {/* Average Views */}
                      <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Avg Views
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {filteredAnalyticsSubmissions?.length > 0
                                ? Math.round(
                                    filteredAnalyticsSubmissions.reduce(
                                      (sum, s) => sum + (s.views || 0),
                                      0
                                    ) / filteredAnalyticsSubmissions.length
                                  ).toLocaleString()
                                : 0}
                            </p>
                          </div>
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-green-100 text-green-600">
                            <BarChart3 className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      {/* Top Submission Views */}
                      <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Highest Views
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {filteredAnalyticsSubmissions?.length > 0
                                ? Math.max(
                                    ...filteredAnalyticsSubmissions.map(
                                      (s) => s.views || 0
                                    )
                                  ).toLocaleString()
                                : 0}
                            </p>
                          </div>
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                            <TrendingUp className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      {/* Filtered Submissions Views */}
                      <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              {activeAnalyticsTab === "verified"
                                ? "Verified Views"
                                : activeAnalyticsTab === "paid"
                                ? "Paid Views"
                                : activeAnalyticsTab === "pending"
                                ? "Pending Views"
                                : activeAnalyticsTab === "rejected"
                                ? "Rejected Views"
                                : activeAnalyticsTab === "verified_or_paid"
                                ? "Verified/Paid Views"
                                : "Filtered Views"}
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {filteredAnalyticsSubmissions
                                ?.reduce((sum, s) => sum + (s.views || 0), 0)
                                .toLocaleString() || 0}
                            </p>
                          </div>
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ROI/Benefit Analysis - Collapsible Section */}
                  <div className="mt-8">
                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <h3 className="font-medium text-gray-800">
                          ROI & Benefit Analysis
                        </h3>
                        <ChevronDown className="h-5 w-5 text-gray-500 group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="mt-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Total Investment */}
                          <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">
                                  Total Investment
                                </p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {(() => {
                                    if (
                                      currentContest.contest_type ===
                                      "leaderboard"
                                    ) {
                                      const totalPrize =
                                        currentContest.contest_based_details
                                          ?.leaderboard_contest?.total_prize ||
                                        0;
                                      return formatMoney(totalPrize);
                                    } else if (
                                      currentContest.contest_type === "cpm"
                                    ) {
                                      // Calculate total paid for CPM contest
                                      const totalPaid =
                                        filteredAnalyticsSubmissions
                                          ?.filter((s) => s.status === "paid")
                                          .reduce(
                                            (sum, s) => sum + (s.earnings || 0),
                                            0
                                          ) || 0;
                                      return formatMoney(totalPaid);
                                    }
                                    return formatMoney(0);
                                  })()}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {currentContest.contest_type === "leaderboard"
                                    ? "Prize Pool"
                                    : "Total Paid"}
                                </p>
                              </div>
                              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 text-red-600">
                                <DollarSign className="h-5 w-5" />
                              </div>
                            </div>
                          </div>

                          {/* Views Generated */}
                          <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">
                                  Views Generated
                                </p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {filteredAnalyticsSubmissions
                                    ?.reduce(
                                      (sum, s) => sum + (s.views || 0),
                                      0
                                    )
                                    .toLocaleString() || 0}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {activeAnalyticsTab === "all"
                                    ? "All Submissions"
                                    : activeAnalyticsTab === "verified"
                                    ? "Verified Only"
                                    : activeAnalyticsTab === "paid"
                                    ? "Paid Only"
                                    : activeAnalyticsTab === "pending"
                                    ? "Pending Only"
                                    : activeAnalyticsTab === "rejected"
                                    ? "Rejected Only"
                                    : activeAnalyticsTab === "verified_or_paid"
                                    ? "Verified/Paid"
                                    : "Filtered"}
                                </p>
                              </div>
                              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                <Eye className="h-5 w-5" />
                              </div>
                            </div>
                          </div>

                          {/* Cost Per View */}
                          <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">
                                  Cost Per View
                                </p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {(() => {
                                    const totalViews =
                                      filteredAnalyticsSubmissions?.reduce(
                                        (sum, s) => sum + (s.views || 0),
                                        0
                                      ) || 0;
                                    if (totalViews === 0) return "$0.00";

                                    let totalCost = 0;
                                    if (
                                      currentContest.contest_type ===
                                      "leaderboard"
                                    ) {
                                      totalCost =
                                        currentContest.contest_based_details
                                          ?.leaderboard_contest?.total_prize ||
                                        0;
                                    } else if (
                                      currentContest.contest_type === "cpm"
                                    ) {
                                      totalCost =
                                        filteredAnalyticsSubmissions
                                          ?.filter((s) => s.status === "paid")
                                          .reduce(
                                            (sum, s) => sum + (s.earnings || 0),
                                            0
                                          ) || 0;
                                    }

                                    // Convert cents to dollars for calculation
                                    const totalCostDollars = totalCost / 100;
                                    const costPerView =
                                      totalCostDollars / totalViews;
                                    return `$${costPerView.toFixed(4)}`;
                                  })()}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {currentContest.contest_type === "leaderboard"
                                    ? "Prize Pool ÷ Views"
                                    : "Paid ÷ Views"}
                                </p>
                              </div>
                              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-green-100 text-green-600">
                                <BarChart3 className="h-5 w-5" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* CPM Contest Specific Metrics */}
                        {currentContest.contest_type === "cpm" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* CPM Rate */}
                            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">
                                    CPM Rate
                                  </p>
                                  <p className="text-2xl font-bold text-gray-900">
                                    $
                                    {currentContest.contest_based_details?.cpm_contest?.cpm_rate_usd?.toFixed(
                                      2
                                    ) || "0.00"}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Per 1,000 views
                                  </p>
                                </div>
                                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600">
                                  <TrendingUp className="h-5 w-5" />
                                </div>
                              </div>
                            </div>

                            {/* Effective CPM */}
                            <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">
                                    Effective CPM
                                  </p>
                                  <p className="text-2xl font-bold text-gray-900">
                                    {(() => {
                                      const totalViews =
                                        filteredAnalyticsSubmissions?.reduce(
                                          (sum, s) => sum + (s.views || 0),
                                          0
                                        ) || 0;
                                      const totalPaid =
                                        filteredAnalyticsSubmissions
                                          ?.filter((s) => s.status === "paid")
                                          .reduce(
                                            (sum, s) => sum + (s.earnings || 0),
                                            0
                                          ) || 0;

                                      if (totalViews === 0) return "$0.00";
                                      // Convert cents to dollars for calculation
                                      const totalPaidDollars = totalPaid / 100;
                                      const effectiveCPM =
                                        (totalPaidDollars / totalViews) * 1000;
                                      return `$${effectiveCPM.toFixed(2)}`;
                                    })()}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Actual rate achieved
                                  </p>
                                </div>
                                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-orange-100 text-orange-600">
                                  <BarChart3 className="h-5 w-5" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Summary Card */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                          <h4 className="font-semibold text-lg mb-3 text-gray-800">
                            Performance Summary
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">
                                Investment Efficiency
                              </p>
                              <p className="text-lg font-semibold text-gray-800">
                                {(() => {
                                  const totalViews =
                                    filteredAnalyticsSubmissions?.reduce(
                                      (sum, s) => sum + (s.views || 0),
                                      0
                                    ) || 0;
                                  let totalCost = 0;
                                  if (
                                    currentContest.contest_type ===
                                    "leaderboard"
                                  ) {
                                    totalCost =
                                      currentContest.contest_based_details
                                        ?.leaderboard_contest?.total_prize || 0;
                                  } else if (
                                    currentContest.contest_type === "cpm"
                                  ) {
                                    totalCost =
                                      filteredAnalyticsSubmissions
                                        ?.filter((s) => s.status === "paid")
                                        .reduce(
                                          (sum, s) => sum + (s.earnings || 0),
                                          0
                                        ) || 0;
                                  }

                                  if (totalCost === 0) return "N/A";
                                  // Convert cents to dollars for calculation
                                  const totalCostDollars = totalCost / 100;
                                  const efficiency =
                                    totalViews / (totalCostDollars / 100); // Views per $100 spent
                                  return `${efficiency.toFixed(
                                    0
                                  )} views per $100`;
                                })()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 mb-1">
                                Contest Type
                              </p>
                              <p className="text-lg font-semibold text-gray-800 capitalize">
                                {currentContest.contest_type} Contest
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* Views Distribution Chart */}
                  <div>
                    <h3 className="font-medium mb-4">Views Distribution</h3>
                    <div className="bg-white rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-6">
                      {filteredAnalyticsSubmissions?.length > 0 ? (
                        <div className="space-y-4">
                          {/* Simple bar chart representation */}
                          {filteredAnalyticsSubmissions
                            .sort((a, b) => (b.views || 0) - (a.views || 0))
                            .slice(0, 10) // Show top 10 submissions
                            .map((submission, index) => {
                              const maxViews = Math.max(
                                ...filteredAnalyticsSubmissions.map(
                                  (s) => s.views || 0
                                )
                              );
                              const views = submission.views || 0;
                              const percentage =
                                maxViews > 0 ? (views / maxViews) * 100 : 0;

                              return (
                                <div
                                  key={submission.id}
                                  className="flex items-center space-x-4"
                                >
                                  <div className="w-8 text-sm font-medium text-gray-600">
                                    #{index + 1}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="text-gray-600">
                                        {submission.creator_username ||
                                          submission.creator_display_name ||
                                          "Unknown Creator"}
                                      </span>
                                      <span className="font-medium">
                                        {views.toLocaleString()} views
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="h-40 flex items-center justify-center">
                          <p className="text-gray-500">
                            No submissions to display
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>
          </TabPanel>
        </TabContent>
      </div>

      {/* Rejection Reason Modal */}
      <RejectionReasonModal
        isOpen={rejectionModalOpen}
        onClose={() => {
          setRejectionModalOpen(false);
          setPendingRejectionSubmission(null);
        }}
        onConfirm={handleRejectionConfirm}
        isLoading={
          isLoadingSubmission[pendingRejectionSubmission || ""] || false
        }
      />

      {/* Custom Pay Modal only */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setPendingPaymentSubmission(null);
        }}
        onConfirm={handlePaymentConfirm}
        isLoading={isLoadingSubmission[pendingPaymentSubmission || ""] || false}
        initialMode="custom"
        showModeSwitcher={false}
        showProofAndDescription={false}
      />

      {/* Reversal confirmation dialog */}
      <Dialog
        open={!!confirmReversal}
        onOpenChange={(open) => !open && setConfirmReversal(null)}
        isdark={isDark}
      >
        <DialogContent
          className={cn("sm:max-w-lg", isDark ? "text-white" : "text-gray-800")}
        >
          <DialogHeader>
            <DialogTitle>Revert payment and update status?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-md ">
            <p>
              Changing status from Paid will reverse the credited amount from
              the creator's wallet and remove related reward transactions.
            </p>
            <p className="font-medium">This action cannot be undone.</p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={handleConfirmReversal}
              className={cn(
                "w-full text-md rounded-full",
                isDark
                  ? "bg-[#7F39EC] py-3"
                  : " bg-[#D9C0FF61] py-4 text-[#7F39EC] "
              )}
            >
              Confirm Reversal
            </button>
            <button
              onClick={() => setConfirmReversal(null)}
              className={cn(
                "w-full text-md rounded-full",
                isDark
                  ? "py-3 border border-[#FF5353] text-[#FF5353]"
                  : "bg-[#FF323224] text-[#E50000] py-4"
              )}
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Creator Submissions Modal */}
      {selectedCreatorForModal && groupSubmissionsByCreator && (
        <CreatorSubmissionsModal
          isOpen={!!selectedCreatorForModal}
          onClose={() => setSelectedCreatorForModal(null)}
          creator={
            (groupSubmissionsByCreator as any[]).find(
              (g: any) => g.creator.id === selectedCreatorForModal
            )?.creator || {}
          }
          submissions={
            (groupSubmissionsByCreator as any[]).find(
              (g: any) => g.creator.id === selectedCreatorForModal
            )?.submissions || []
          }
          contest={currentContest}
          onVerify={async (ids: string[]) => {
            // Handle bulk verify
            for (const id of ids) {
              await handleUpdateSubmissionStatus(id, "verified");
            }
            setSelectedCreatorForModal(null);
          }}
          onReject={(ids: string[]) => {
            // Handle bulk reject - open rejection modal for first, others will need individual handling
            if (ids.length > 0) {
              setPendingRejectionSubmission(ids[0]);
              setRejectionModalOpen(true);
            }
          }}
          onSetPending={async (ids: string[]) => {
            // Handle bulk pending
            for (const id of ids) {
              await handleUpdateSubmissionStatus(id, "pending");
            }
            setSelectedCreatorForModal(null);
          }}
          onPayment={async (
            submissionId: string,
            type: "standard" | "bonus" | "both"
          ) => {
            // Handle payment based on type
            const action =
              type === "bonus"
                ? "mark_bonus_paid"
                : type === "both"
                ? "mark_both_paid"
                : "paid";
            await handleUpdateSubmissionStatus(submissionId, action as any);
          }}
          onCustomPayment={(submissionId: string) => {
            // Handle custom payment
            setPendingPaymentSubmission(submissionId);
            setPaymentModalOpen(true);
          }}
          isAdminView={isAdminView}
        />
      )}
    </div>
  );
}
