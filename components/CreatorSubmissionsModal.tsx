"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  X,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  DollarSign,
  ExternalLink,
  ArrowUpDown,
  Download,
  Loader2,
  ThumbsUp,
  MessageCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { applyPayoutAdjustment } from "@/lib/payout-adjustment";
import {
  formatMetadataTimestamp,
  parseSubmissionMetadata,
  getFullRejectionDetails,
} from "@/lib/submission-metadata";

interface Creator {
  id: string;
  username: string;
  profile_picture_url: string | null;
  full_name: string | null;
}

interface Submission {
  id: string;
  creator_id: string | null;
  video_title: string | null;
  video_thumbnail_url: string | null;
  views: number;
  content_link: string;
  status: string;
  earnings: number | null;
  paid: boolean;
  paid_at: string | null;
  bonus_paid: boolean;
  bonus_paid_at: string | null;
  bonus_amount?: number | null;
  created_at: string;
  platform: string | null;
  other_stats: any;
  // Twitter-specific fields
  is_twitter_tweet?: boolean;
  moderation_status?: "pending" | "approved" | "rejected" | "verified" | "paid";
  manual_points_adjustment?: number;
  manual_points_reason?: string | null;
  tweet_id?: string;
  deleted_at?: string | null;
  insights_status?: "ok" | "temporary_failure" | "permanent_failure" | null;
  metadata?: any;
}

/** TikTok Display API uses *_count; older rows may only have views/likes/comments/shares. */
function effectiveTikTokSubmissionViews(sub: Submission): number {
  return Number(
    (sub.other_stats?.tiktok as Record<string, unknown> | undefined)
      ?.view_count ??
      (sub.other_stats?.tiktok as Record<string, unknown> | undefined)?.views ??
      sub.views ??
      0,
  );
}

function effectiveSubmissionViewsForSort(sub: Submission): number {
  if ((sub.platform || "").toLowerCase().includes("tiktok")) {
    return effectiveTikTokSubmissionViews(sub);
  }
  return Number(sub.views ?? 0);
}

interface CreatorSubmissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: Creator;
  submissions: Submission[];
  contest: any;
  onVerify: (submissionIds: string[]) => Promise<void> | void;
  onReject: (submissionIds: string[]) => void;
  onSetPending: (submissionIds: string[]) => void;
  onPayment: (
    submissionId: string,
    type: "standard" | "bonus" | "both",
    options?: { skipReload?: boolean },
  ) => void | Promise<void>;
  onCustomPayment: (submissionId: string) => void;
  isAdminView?: boolean;
  /** For leaderboard contests: creator's rank (1-based) so expected reward per tweet matches main view */
  creatorRank?: number;
  /** For milestone contests: precomputed expected payout per submission from normal view logic */
  milestoneExpectedPayoutBySubmissionId?: Map<string, number>;
  /** For milestone contests: precomputed milestone label per submission from normal view logic */
  milestoneAssignedLabelBySubmissionId?: Map<string, string>;
}

export function CreatorSubmissionsModal({
  isOpen,
  onClose,
  creator,
  submissions,
  contest,
  onVerify,
  onReject,
  onSetPending,
  onPayment,
  onCustomPayment,
  isAdminView = false,
  creatorRank,
  milestoneExpectedPayoutBySubmissionId,
  milestoneAssignedLabelBySubmissionId,
}: CreatorSubmissionsModalProps) {
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(
    new Set(),
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "verified_or_paid" | "pending" | "verified" | "rejected" | "paid"
  >("all");
  const [sortBy, setSortBy] = useState<
    "views-desc" | "views-asc" | "date-desc" | "date-asc"
  >("date-desc");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [bulkVerifyLoading, setBulkVerifyLoading] = useState(false);
  const [bulkPaymentLoading, setBulkPaymentLoading] = useState(false);
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<
    string | null
  >(null);
  const [rejectionDetailsModalSubmission, setRejectionDetailsModalSubmission] =
    useState<{ id: string; metadata: any } | null>(null);

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

  const handleSelectAll = (currentFiltered: Submission[]) => {
    const filteredIds = currentFiltered.map((s) => s.id);
    const allFilteredSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedSubmissions.has(id));
    if (allFilteredSelected) {
      setSelectedSubmissions(new Set());
    } else {
      setSelectedSubmissions(new Set(filteredIds));
    }
  };

  const handleDownloadReel = async (submissionId: string) => {
    // Set loading state
    setDownloadingSubmissionId(submissionId);

    // Show downloading toast
    toast({
      title: "Downloading...",
      description: "Please wait while downloading.",
    });

    try {
      const response = await fetch(
        `/api/admin/download-reel?submissionId=${submissionId}`,
      );

      const contentType = response.headers.get("content-type");

      if (!response.ok || contentType?.includes("application/json")) {
        // Handle error response
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          // If response is not JSON, create a generic error
          errorData = { error: "Failed to download video. Please try again." };
        }

        // Show error toast with message from API
        toast({
          title: "Download Failed",
          description:
            errorData.error || "Failed to download video. Please try again.",
          variant: "destructive",
        });
        setDownloadingSubmissionId(null);
        return;
      }

      const contentDisposition = response.headers.get("content-disposition");
      let filename = "video.mp4";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success toast
      toast({
        title: "Download Started",
        description: "Your video download has started.",
      });
      setDownloadingSubmissionId(null);
    } catch (error: any) {
      console.error("Error downloading reel:", error);
      toast({
        title: "Download Failed",
        description:
          error.message || "Failed to download video. Please try again.",
        variant: "destructive",
      });
      setDownloadingSubmissionId(null);
    }
  };

  const handleCheckboxChange = (submissionId: string, checked: boolean) => {
    const newSet = new Set(selectedSubmissions);
    if (checked) {
      newSet.add(submissionId);
    } else {
      newSet.delete(submissionId);
    }
    setSelectedSubmissions(newSet);
  };

  const handleBulkAction = async (
    action: "verify" | "reject" | "pending",
  ) => {
    const selectedIds = Array.from(selectedSubmissions);
    if (action === "verify") {
      setBulkVerifyLoading(true);
      try {
        await onVerify(selectedIds);
        setSelectedSubmissions(new Set());
      } finally {
        setBulkVerifyLoading(false);
      }
      return;
    } else if (action === "reject") {
      onReject(selectedIds);
    } else {
      onSetPending(selectedIds);
    }
    setSelectedSubmissions(new Set());
  };

  const handleBulkPayment = async (
    type: "standard" | "bonus" | "both",
    isBulkTransaction: boolean,
  ) => {
    const selectedIds = Array.from(selectedSubmissions);

    // Get selected submissions
    const selectedSubs = submissions.filter((s) => selectedIds.includes(s.id));

    // Filter to verified submissions only (Twitter: use moderation_status)
    const verifiedSubs = selectedSubs.filter((s) => {
      const status = (s as any).is_twitter_tweet
        ? (s as any).moderation_status || s.status
        : s.status;
      const st = String(status || "").toLowerCase();
      return st === "verified" || st === "approved";
    });

    if (verifiedSubs.length === 0) {
      alert(
        "No verified submissions selected. Only verified submissions can be paid.",
      );
      return;
    }

    setBulkPaymentLoading(true);
    try {
      // Sort by submission time (earliest first)
      const sortedSubs = [...verifiedSubs].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      const hasTwitterTweets = sortedSubs.some(
        (s) => (s as any).is_twitter_tweet === true,
      );
      const isTwitterCpm =
        contest.contest_type === "cpm" &&
        (contest.platform?.toLowerCase() === "twitter" ||
          contest.platform?.toLowerCase() === "x");
      const useInstagramBulkApi = isBulkTransaction && !hasTwitterTweets;
      const useTwitterCpmBulkApi =
        isBulkTransaction && hasTwitterTweets && isTwitterCpm;

      if (useInstagramBulkApi || useTwitterCpmBulkApi) {
        try {
          const response = useTwitterCpmBulkApi
            ? await fetch(`/api/contests/${contest.id}/bulk-pay-twitter-cpm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tweet_ids: sortedSubs.map((s) => s.id),
                  payment_type: type,
                  creator_id: creator.id,
                }),
              })
            : await fetch("/api/admin/bulk-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  submission_ids: sortedSubs.map((s) => s.id),
                  payment_type: type,
                  contest_id: contest.id,
                  creator_id: creator.id,
                }),
              });

          const result = await response.json();

          if (!response.ok) {
            alert(`Bulk payment failed:\n${result.error || "Unknown error"}`);
            return;
          }

          setSelectedSubmissions(new Set());

          const { data } = result;
          const isMilestoneContest = contest.contest_type === "milestone";
          const message = isMilestoneContest
            ? [
                `✓ Bulk Payment Successful!`,
                ``,
                `Paid items: ${data.paid_count}`,
                `Skipped: ${data.skipped_count}`,
                ``,

                `Total Paid: $${(data.total_amount / 100).toFixed(2)}`,
              ]
            : [
                `✓ Bulk Payment Successful!`,
                ``,
                `Paid items: ${data.paid_count}`,
                `Skipped: ${data.skipped_count}`,
                ``,
                `CPM Earnings: $${(data.total_cpm / 100).toFixed(2)}`,
                `Flat Fee Bonus: $${(data.total_bonus / 100).toFixed(2)}`,
                `Total Paid: $${(data.total_amount / 100).toFixed(2)}`,
              ];

          if (data.cap_reached) {
            message.push(``, `⚠️ Earnings cap reached!`);
            message.push(
              `Remaining cap: $${(data.remaining_cap / 100).toFixed(2)}`,
            );
          }

          alert(message.join("\n"));

          window.location.reload();
        } catch (error) {
          console.error("Bulk payment error:", error);
          alert(
            `Bulk payment failed:\n${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }
      } else {
        // OPTION 1: Individual Transactions (Multiple API calls)
        let successCount = 0;
        let failCount = 0;

        // Pay each submission in order (skipReload so parent doesn't reload after each)
        for (const sub of sortedSubs) {
          try {
            await onPayment(sub.id, type, { skipReload: true });
            successCount++;
          } catch (error) {
            console.error(`Failed to pay submission ${sub.id}:`, error);
            failCount++;
            // Continue with next submission even if one fails
          }
        }

        // Show summary and reload once so data is fresh
        if (failCount > 0) {
          toast({
            title: "Payment completed with errors",
            description: `✓ ${successCount} paid, ✗ ${failCount} failed`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: `Successfully paid ${successCount} submission(s).`,
            variant: "default",
          });
          setSelectedSubmissions(new Set());
        }
        window.location.reload();
      }
    } finally {
      setBulkPaymentLoading(false);
    }
  };

  const getStatusBadge = (status: string, paid: boolean) => {
    const statusLower = status?.toLowerCase() || "pending";

    if (paid || statusLower === "paid") {
      return <Badge className="bg-green-600 text-white">Paid</Badge>;
    }

    switch (statusLower) {
      case "verified":
        return <Badge className="bg-green-500 text-white">Verified</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 text-white">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-500 text-white">Rejected</Badge>;
      default:
        return (
          <Badge variant="outline">
            {statusLower.charAt(0).toUpperCase() + statusLower.slice(1)}
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    } as any);
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  /** Base expected reward. When useStoredEarnings is false, always compute from formula so Expected column does not equal Granted after payment. */
  const calculateSubmissionBaseExpectedReward = (
    submission: Submission,
    useStoredEarnings = true,
  ) => {
    let baseExpectedReward =
      useStoredEarnings && submission.earnings ? submission.earnings : 0;

    // Leaderboard: expected reward per tweet = prize for this creator's rank (same as normal view)
    if (
      contest?.contest_type === "leaderboard" &&
      creatorRank != null &&
      creatorRank > 0
    ) {
      const leaderboardContest = (contest?.contest_based_details as any)
        ?.leaderboard_contest;
      const prizes = leaderboardContest?.prizes;
      if (Array.isArray(prizes)) {
        const prizeForRank = prizes.find(
          (p: any) => p.position === creatorRank,
        );
        if (prizeForRank?.amount != null) {
          // Prize amounts are stored in cents; modal uses cents for formatCurrency
          return Math.max(Number(prizeForRank.amount), 0);
        }
      }
      return 0;
    }

    // Milestone: use the globally precomputed per-submission payout map from normal view.
    if (contest?.contest_type === "milestone") {
      const milestonePayout =
        milestoneExpectedPayoutBySubmissionId?.get(submission.id) ?? 0;
      return Math.max(Number(milestonePayout) || 0, 0);
    }

    if (contest?.contest_type === "cpm" && !baseExpectedReward) {
      const cpmConfig = (contest?.contest_based_details as any)?.cpm_contest;
      const cpmRateUsd = cpmConfig?.cpm_rate_usd;
      if (cpmRateUsd) {
        const platform = (submission.platform || "").toLowerCase();
        const isTwitterSubmission =
          submission.is_twitter_tweet === true ||
          platform === "twitter" ||
          platform === "x";

        if (isTwitterSubmission) {
          const basePoints = submission.other_stats?.base_points || 0;
          const manualAdjustment = submission.manual_points_adjustment || 0;
          const totalPoints = Math.max(basePoints + manualAdjustment, 0);
          const calculatedEarnings = (totalPoints * cpmRateUsd * 100) / 1000;
          baseExpectedReward = Math.round(calculatedEarnings);
        } else {
          let effectiveViews = submission.views || 0;
          if (
            cpmConfig?.min_views != null &&
            effectiveViews < cpmConfig.min_views
          ) {
            effectiveViews = 0;
          }
          if (
            cpmConfig?.max_views != null &&
            effectiveViews > cpmConfig.max_views
          ) {
            effectiveViews = cpmConfig.max_views;
          }
          const calculatedEarnings = (effectiveViews * cpmRateUsd * 100) / 1000;
          baseExpectedReward = Math.round(calculatedEarnings);
        }
      }
    }

    return Math.max(baseExpectedReward, 0);
  };

  // Get flat_fee_bonus from the correct nested location based on contest type
  const getFlatFeeBonus = () => {
    if (contest?.contest_type === "cpm") {
      return (
        (contest?.contest_based_details as any)?.cpm_contest?.flat_fee_bonus ||
        0
      );
    } else if (contest?.contest_type === "leaderboard") {
      return (
        (contest?.contest_based_details as any)?.leaderboard_contest
          ?.flat_fee_bonus || 0
      );
    }
    return 0;
  };

  const flatFeeBonus = getFlatFeeBonus();
  const hasFlatFeeBonus = flatFeeBonus > 0;

  // Simple contest-level payout adjustment (percentage + mode)
  const payoutAdjustmentPercentage = Number(
    (contest as any)?.payout_adjustment_percentage ?? 0,
  );
  const payoutAdjustmentMode = (contest as any)?.payout_adjustment_mode as
    | "cpm_only"
    | "bonus_only"
    | "combined"
    | null;
  const hasPayoutAdjustment =
    payoutAdjustmentPercentage > 0 && !!payoutAdjustmentMode;
  const shouldAdjustReward =
    hasPayoutAdjustment &&
    (payoutAdjustmentMode === "combined" ||
      payoutAdjustmentMode === "cpm_only");
  const shouldAdjustBonus =
    hasPayoutAdjustment &&
    (payoutAdjustmentMode === "combined" ||
      payoutAdjustmentMode === "bonus_only");

  const isTwitterLeaderboardContest =
    contest?.contest_type === "leaderboard" &&
    (contest?.platform?.toLowerCase() === "twitter" ||
      contest?.platform?.toLowerCase() === "x") &&
    contest?.contest_format === "text_image";

  const isTwitterCpmContest =
    contest?.contest_type === "cpm" &&
    (contest?.platform?.toLowerCase() === "twitter" ||
      contest?.platform?.toLowerCase() === "x") &&
    contest?.contest_format === "text_image";

  // Check if this is a Twitter text_image contest
  const isTwitterTextImageContest =
    (contest?.platform?.toLowerCase() === "twitter" ||
      contest?.platform?.toLowerCase() === "x") &&
    contest?.contest_format === "text_image";

  const isInstagramContest =
    contest?.platform?.toLowerCase().includes("instagram") ?? false;

  const isTikTokContest =
    contest?.platform?.toLowerCase().includes("tiktok") ?? false;

  const isYouTubeContest =
    contest?.platform?.toLowerCase().includes("youtube") ?? false;

  const getInsightsMeta = (
    status: Submission["insights_status"],
    errorMsg?: string,
  ): { help: string; dotClass: string; pillClass: string } => {
    const isDark = mode === "dark";
    const errorSuffix = errorMsg ? `\n\nDetails: ${errorMsg}` : "";

    if (status === "ok") {
      return {
        help: "Insights fetched successfully",
        dotClass: "bg-emerald-500",
        pillClass: isDark
          ? "border-emerald-700/60 bg-emerald-950/40"
          : "border-emerald-200 bg-emerald-50",
      };
    }
    if (status === "temporary_failure") {
      return {
        help:
          "Temporary error fetching insights\nWill retry later" + errorSuffix,
        dotClass: "bg-amber-400",
        pillClass: isDark
          ? "border-amber-700/60 bg-amber-950/35"
          : "border-amber-200 bg-amber-50",
      };
    }
    if (status === "permanent_failure") {
      return {
        help: "Insights cannot be fetched for this post" + errorSuffix,
        dotClass: "bg-rose-500",
        pillClass: isDark
          ? "border-rose-700/60 bg-rose-950/35"
          : "border-rose-200 bg-rose-50",
      };
    }
    return {
      help: "Never refreshed yet",
      dotClass: "bg-slate-400",
      pillClass: isDark
        ? "border-slate-600 bg-slate-900/30"
        : "border-slate-200 bg-slate-50",
    };
  };

  const formatMetricValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "number") {
      return value.toLocaleString();
    }
    return String(value);
  };

  const formatWatchTime = (milliseconds: number): string => {
    if (!milliseconds || milliseconds === 0) return "0s";

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }

    if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }

    return `${seconds}s`;
  };

  const getNormalizedSubmissionStatus = (submission: Submission) => {
    const isTwitterTweet = submission.is_twitter_tweet === true;
    const rawStatus =
      (isTwitterTweet
        ? submission.moderation_status || submission.status
        : submission.status) || "pending";
    const statusLower = String(rawStatus).toLowerCase();

    if (isTwitterTweet) {
      if (statusLower === "paid") return "paid";
      if (statusLower === "approved" || statusLower === "verified")
        return "verified";
      if (statusLower === "rejected") return "rejected";
      return "pending";
    }

    return statusLower;
  };

  // Filter submissions based on status
  // For Twitter tweets, use moderation_status; for others, use status
  const filteredSubmissions = submissions.filter((sub) => {
    const normalizedStatus = getNormalizedSubmissionStatus(sub);
    const isPaidSubmission = normalizedStatus === "paid" || sub.paid === true;

    if (statusFilter === "all") return true;
    if (statusFilter === "verified_or_paid")
      return normalizedStatus === "verified" || isPaidSubmission;
    if (statusFilter === "paid") return isPaidSubmission;
    if (statusFilter === "verified") return normalizedStatus === "verified";
    if (statusFilter === "pending") return normalizedStatus === "pending";
    if (statusFilter === "rejected") return normalizedStatus === "rejected";
    return true;
  });

  // Sort submissions
  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    if (sortBy === "views-desc")
      return (
        effectiveSubmissionViewsForSort(b) - effectiveSubmissionViewsForSort(a)
      );
    if (sortBy === "views-asc")
      return (
        effectiveSubmissionViewsForSort(a) - effectiveSubmissionViewsForSort(b)
      );
    if (sortBy === "date-desc")
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    if (sortBy === "date-asc")
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    return 0;
  });

  // Pre-calculate expected rewards with cap logic (in submission time order)
  const expectedRewardsMap = new Map<string, number>();
  const maxEarningsPerCreator =
    (contest as any)?.max_earnings_per_creator || null;

  // Pre-calculate expected bonuses with budget constraints
  const expectedBonusMap = new Map<string, number>();

  if (hasFlatFeeBonus) {
    // Get budget information
    const totalBudget =
      contest?.contest_type === "cpm"
        ? (contest?.contest_based_details as any)?.cpm_contest?.total_budget ||
          0
        : (contest?.contest_based_details as any)?.leaderboard_contest
            ?.total_budget || 0;

    const bonusBudget =
      contest?.contest_type === "cpm"
        ? (contest?.contest_based_details as any)?.cpm_contest
            ?.flat_fee_bonus_cap || totalBudget
        : totalBudget;

    // Sort submissions by created_at to process in order
    const submissionsByTime = [...submissions].sort((a, b) => {
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    let currentTotalExpectedBonus = 0;

    submissionsByTime.forEach((sub) => {
      const normalizedStatus = getNormalizedSubmissionStatus(sub);
      const isBonusStatus =
        normalizedStatus === "verified" ||
        normalizedStatus === "paid" ||
        sub.paid === true;
      const isEligibleForBonus = hasFlatFeeBonus && isBonusStatus;

      if (isEligibleForBonus) {
        // Calculate remaining budget for bonuses
        const remainingBudget = bonusBudget - currentTotalExpectedBonus;

        if (remainingBudget > 0) {
          if (remainingBudget >= flatFeeBonus) {
            // Full bonus can be granted
            expectedBonusMap.set(sub.id, flatFeeBonus);
            currentTotalExpectedBonus += flatFeeBonus;
          } else {
            // Only partial bonus remaining - distribute the remaining amount
            expectedBonusMap.set(sub.id, remainingBudget);
            currentTotalExpectedBonus += remainingBudget;
          }
        } else {
          expectedBonusMap.set(sub.id, 0);
        }
      } else {
        expectedBonusMap.set(sub.id, 0);
      }
    });
  }

  let creatorCapApplied = false;
  let cappedTwitterSubmissionId: string | null = null;

  // For leaderboard, expected reward per tweet = prize for creator's rank (no cap); match normal view
  const isLeaderboard = contest?.contest_type === "leaderboard";
  if (maxEarningsPerCreator && maxEarningsPerCreator > 0 && !isLeaderboard) {
    // Sort by created_at to apply creator cap in submission order
    const submissionsByTime = [...sortedSubmissions].sort((a, b) => {
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    let runningTotal = 0;

    submissionsByTime.forEach((sub) => {
      // Formula-only so Expected Reward column does not become equal to Reward Granted after payment
      const baseExpectedReward = calculateSubmissionBaseExpectedReward(
        sub,
        false,
      );
      const remainingCap = maxEarningsPerCreator - runningTotal;
      let cappedExpectedReward = baseExpectedReward;

      if (remainingCap <= 0) {
        cappedExpectedReward = 0;
      } else if (baseExpectedReward > remainingCap) {
        cappedExpectedReward = remainingCap;
      }

      expectedRewardsMap.set(sub.id, cappedExpectedReward);
      const amountApplied = Math.min(
        baseExpectedReward,
        Math.max(0, remainingCap),
      );
      runningTotal += amountApplied;

      if (
        !creatorCapApplied &&
        cappedExpectedReward < baseExpectedReward &&
        sub.is_twitter_tweet === true
      ) {
        creatorCapApplied = true;
        cappedTwitterSubmissionId = sub.id;
      }
    });
  } else {
    // No cap (or leaderboard): use formula-only expected per submission
    sortedSubmissions.forEach((sub) => {
      const baseExpectedReward = calculateSubmissionBaseExpectedReward(
        sub,
        false,
      );
      expectedRewardsMap.set(sub.id, baseExpectedReward);
    });
  }

  // Count submissions by status (handle Twitter tweets with moderation_status)
  const statusCounts = {
    all: submissions.length,
    verifiedOrPaid: submissions.filter((s) => {
      const normalizedStatus = getNormalizedSubmissionStatus(s);
      return (
        normalizedStatus === "verified" ||
        normalizedStatus === "paid" ||
        s.paid === true
      );
    }).length,
    pending: submissions.filter((s) => {
      const normalizedStatus = getNormalizedSubmissionStatus(s);
      return normalizedStatus === "pending";
    }).length,
    verified: submissions.filter((s) => {
      const normalizedStatus = getNormalizedSubmissionStatus(s);
      return normalizedStatus === "verified";
    }).length,
    rejected: submissions.filter((s) => {
      const normalizedStatus = getNormalizedSubmissionStatus(s);
      return normalizedStatus === "rejected";
    }).length,
    paid: submissions.filter((s) => {
      const normalizedStatus = getNormalizedSubmissionStatus(s);
      return normalizedStatus === "paid" || s.paid === true;
    }).length,
  };
  const isDark = mode === "dark";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
        <DialogContent
          className="max-w-[98vw] max-h-[98vh] p-0 gap-0"
          hideCloseButton
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">
            {creator.username}'s Submissions
          </DialogTitle>
          <div className="flex flex-col h-[98vh] min-h-0 overflow-hidden">
            {/* Header */}
            <div
              className={cn(
                "flex items-center justify-between p-6 border-b flex-shrink-0",
                isDark
                  ? "bg-[#170337] "
                  : "bg-gradient-to-r from-purple-50 to-blue-50",
              )}
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={creator.profile_picture_url || undefined} />
                  <AvatarFallback>
                    {creator.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2
                    className={cn(
                      "text-2xl font-bold text-gray-900 dark:text-white",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    {creator.username}'s Submissions
                  </h2>
                  <p
                    className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  >
                    {submissions.length} total{" "}
                    {submissions.length === 1 ? "submission" : "submissions"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className={cn(
                  isDark ? "text-white" : "text-gray-600 hover:bg-white/50",
                )}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Status Filter Tabs */}
            <div
              className={cn(
                "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 border-b flex-shrink-0",
                isDark ? "bg-[#06021D] " : "bg-white",
              )}
            >
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <Button
                  size="sm"
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                  className={cn(
                    statusFilter === "all"
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "",
                    isDark
                      ? "text-white border-gray-600"
                      : statusFilter === "all"
                        ? "text-white"
                        : "text-gray-600",
                  )}
                >
                  All{" "}
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.all}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={
                    statusFilter === "verified_or_paid" ? "default" : "outline"
                  }
                  onClick={() => setStatusFilter("verified_or_paid")}
                  className={cn(
                    statusFilter === "verified_or_paid"
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "",
                    isDark
                      ? "text-white border-gray-600"
                      : statusFilter === "verified_or_paid"
                        ? "text-white"
                        : "text-gray-600",
                  )}
                >
                  Verified + Paid{" "}
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.verifiedOrPaid}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "pending" ? "default" : "outline"}
                  onClick={() => setStatusFilter("pending")}
                  className={cn(
                    statusFilter === "pending"
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "",
                    isDark
                      ? "text-white border-gray-600"
                      : statusFilter === "pending"
                        ? "text-white"
                        : "text-gray-600",
                  )}
                >
                  Pending{" "}
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.pending}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "verified" ? "default" : "outline"}
                  onClick={() => setStatusFilter("verified")}
                  className={cn(
                    statusFilter === "verified"
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "",
                    isDark
                      ? "text-white border-gray-600"
                      : statusFilter === "verified"
                        ? "text-white"
                        : "text-gray-600",
                  )}
                >
                  Verified{" "}
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.verified}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "rejected" ? "default" : "outline"}
                  onClick={() => setStatusFilter("rejected")}
                  className={cn(
                    statusFilter === "rejected"
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "",
                    isDark
                      ? "text-white border-gray-600"
                      : statusFilter === "rejected"
                        ? "text-white"
                        : "text-gray-600",
                  )}
                >
                  Rejected{" "}
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.rejected}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "paid" ? "default" : "outline"}
                  onClick={() => setStatusFilter("paid")}
                  className={cn(
                    statusFilter === "paid"
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "",
                    isDark
                      ? "text-white border-gray-600"
                      : statusFilter === "paid"
                        ? "text-white"
                        : "text-gray-600",
                  )}
                >
                  Paid{" "}
                  <Badge variant="secondary" className="ml-2">
                    {statusCounts.paid}
                  </Badge>
                </Button>
              </div>
              <div className="flex items-center gap-2 w-full flex-wrap justify-between sm:w-auto sm:flex-nowrap sm:justify-end">
                <span
                  className={cn(
                    "text-sm",
                    isDark ? "text-gray-400" : "text-gray-600",
                  )}
                >
                  Sort by
                </span>
                <div className="flex-1 sm:flex-none">
                  <Select
                    value={sortBy}
                    onValueChange={(v) => setSortBy(v as any)}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full sm:w-[180px]",
                        isDark ? "text-white border-gray-600" : "text-gray-600",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent isDark={isDark}>
                      <SelectItem value="date-desc" isDark={isDark}>
                        Date (Newest First)
                      </SelectItem>
                      <SelectItem value="date-asc" isDark={isDark}>
                        Date (Oldest First)
                      </SelectItem>
                      <SelectItem value="views-desc" isDark={isDark}>
                        Views (High → Low)
                      </SelectItem>
                      <SelectItem value="views-asc" isDark={isDark}>
                        Views (Low → High)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedSubmissions.size > 0 && (
              <div
                className={cn(
                  "p-4 border-b",
                  isDark ? "bg-blue-900/20" : "bg-blue-50",
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-blue-300" : "text-blue-900",
                    )}
                  >
                    {selectedSubmissions.size} selected
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedSubmissions(new Set())}
                    className={cn(
                      "text-sm",
                      isDark ? "text-white" : "text-gray-600",
                    )}
                  >
                    Clear
                  </Button>
                </div>

                {/* Scrollable buttons container */}
                <div className="overflow-x-auto pb-2 -mx-1 px-1">
                  <div className="flex gap-2 min-w-max">
                    {contest?.post_contest_status !== "verification_complete" &&
                      contest?.post_contest_status !== "payments_processed" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleBulkAction("verify")}
                            loading={bulkVerifyLoading}
                            loadingText="Verifying submissions..."
                            className={cn(
                              "whitespace-nowrap rounded-md",
                              isDark
                                ? "border bg-green-900/30 text-green-400 border-green-500"
                                : "bg-green-600 text-white hover:bg-green-700 ",
                            )}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark as Verified
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleBulkAction("reject")}
                            disabled={bulkVerifyLoading}
                            className={cn(
                              "whitespace-nowrap rounded-md",
                              isDark
                                ? "border bg-red-900/30 text-red-400 border-red-500"
                                : "bg-red-600 text-white hover:bg-red-700 ",
                            )}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Mark as Rejected
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleBulkAction("pending")}
                            disabled={bulkVerifyLoading}
                            className={cn(
                              "whitespace-nowrap rounded-md",
                              isDark
                                ? "border bg-yellow-900/30 text-yellow-400 border-yellow-500"
                                : "bg-yellow-600 text-white hover:bg-yellow-700 ",
                            )}
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            Mark as Pending
                          </Button>
                          {bulkVerifyLoading && (
                            <span
                              className={cn(
                                "text-xs self-center whitespace-nowrap",
                                isDark ? "text-blue-200" : "text-blue-700",
                              )}
                            >
                              Verifying submissions...
                            </span>
                          )}
                        </>
                      )}
                    {contest?.post_contest_status === "verification_complete" &&
                      contest?.post_contest_status !== "payments_processed" &&
                      isAdminView &&
                      // Hide all payment buttons for Twitter leaderboard contests
                      !isTwitterLeaderboardContest && (
                        <>
                          <div className="border-l border-gray-300 dark:border-gray-600 h-6 mx-2"></div>
                          <Button
                            size="sm"
                            onClick={() => handleBulkPayment("standard", false)}
                            disabled={bulkPaymentLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                          >
                            {bulkPaymentLoading ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <DollarSign className="h-4 w-4 mr-1" />
                            )}
                            Mark as Paid
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleBulkPayment("standard", true)}
                            disabled={bulkPaymentLoading}
                            className="bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap"
                          >
                            {bulkPaymentLoading ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <DollarSign className="h-4 w-4 mr-1" />
                            )}
                            Mark as Paid (Bulk)
                          </Button>
                          {hasFlatFeeBonus && (
                            <>
                              {!isTwitterCpmContest && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleBulkPayment("bonus", false)
                                    }
                                    disabled={bulkPaymentLoading}
                                    className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                                  >
                                    {bulkPaymentLoading ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                      <DollarSign className="h-4 w-4 mr-1" />
                                    )}
                                    Mark Bonus as Paid
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleBulkPayment("bonus", true)
                                    }
                                    disabled={bulkPaymentLoading}
                                    className="bg-green-500 hover:bg-green-600 text-white whitespace-nowrap"
                                  >
                                    {bulkPaymentLoading ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                      <DollarSign className="h-4 w-4 mr-1" />
                                    )}
                                    Mark Bonus as Paid (Bulk)
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleBulkPayment("both", false)}
                                disabled={bulkPaymentLoading}
                                className="bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap"
                              >
                                {bulkPaymentLoading ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <DollarSign className="h-4 w-4 mr-1" />
                                )}
                                Mark Both as Paid
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleBulkPayment("both", true)}
                                disabled={bulkPaymentLoading}
                                className="bg-purple-500 hover:bg-purple-600 text-white whitespace-nowrap"
                              >
                                {bulkPaymentLoading ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <DollarSign className="h-4 w-4 mr-1" />
                                )}
                                Mark Both as Paid (Bulk)
                              </Button>
                            </>
                          )}
                        </>
                      )}
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable Table */}
            <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
              <Table>
                <TableHeader
                  className={cn(
                    "sticky top-0 z-20 shadow-sm",
                    isDark
                      ? "bg-[#391A6A] text-white"
                      : "bg-white text-gray-600",
                  )}
                >
                  <TableRow className="border-b-2">
                    <TableHead
                      className={cn(
                        "w-12",
                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                      )}
                    >
                      <Checkbox
                        checked={
                          filteredSubmissions.length > 0 &&
                          filteredSubmissions.every((s) =>
                            selectedSubmissions.has(s.id),
                          )
                        }
                        onCheckedChange={() =>
                          handleSelectAll(filteredSubmissions)
                        }
                        aria-label="Select all submissions in current tab"
                      />
                    </TableHead>
                    <TableHead
                      className={cn(
                        "w-12",
                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                      )}
                    >
                      #
                    </TableHead>
                    {/* For Twitter text_image contests, show Tweet column; for others, show Content */}
                    {isTwitterTextImageContest ? (
                      <TableHead
                        className={cn(
                          "min-w-[200px]",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50",
                        )}
                      >
                        Tweet
                      </TableHead>
                    ) : (
                      <TableHead
                        className={cn(
                          "min-w-[200px]",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50",
                        )}
                      >
                        Content
                      </TableHead>
                    )}
                    {/* For Twitter text_image contests, show detailed metrics; for others, show simplified (with Instagram extras) */}
                    {isTwitterTextImageContest ? (
                      <>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Total Points
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Base Points
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Manual Points
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Likes
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Replies
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Retweets
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Quote Reposts
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Impressions
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Expected Reward
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Reward Granted
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Manual Points Reason
                        </TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Views
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Likes
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Comments
                        </TableHead>
                        {(isInstagramContest || isTikTokContest) && (
                          <>
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Shares
                            </TableHead>
                            {/* Saves: Instagram only — not in TikTok Display API */}
                            {!isTikTokContest && (
                              <TableHead
                                className={cn(
                                  "text-center",
                                  isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                )}
                              >
                                Saves
                              </TableHead>
                            )}
                            {/* Reach and Interactions commented out for TikTok per user request */}
                            {!isTikTokContest && (
                              <>
                                <TableHead
                                  className={cn(
                                    "text-center",
                                    isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                  )}
                                >
                                  Reach
                                </TableHead>
                                <TableHead
                                  className={cn(
                                    "text-center",
                                    isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                  )}
                                >
                                  Interactions
                                </TableHead>
                              </>
                            )}
                            {isTikTokContest ? (
                              <>
                                <TableHead
                                  className={cn(
                                    "text-center",
                                    isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                  )}
                                >
                                  Total engagement
                                </TableHead>
                                <TableHead
                                  className={cn(
                                    "text-center",
                                    isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                  )}
                                >
                                  Engagement rate
                                </TableHead>
                              </>
                            ) : (
                              <>
                                <TableHead
                                  className={cn(
                                    "text-center",
                                    isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                  )}
                                >
                                  Avg Watch Time
                                </TableHead>
                                <TableHead
                                  className={cn(
                                    "text-center",
                                    isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                  )}
                                >
                                  Total Watch Time
                                </TableHead>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {/* Hide reward columns for Twitter text_image contests */}
                    {!isTwitterTextImageContest && (
                      <>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Expected Reward
                        </TableHead>
                        {contest?.contest_type === "milestone" && (
                          <TableHead
                            className={cn(
                              "text-center min-w-[170px]",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Milestone
                          </TableHead>
                        )}
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Reward Granted
                        </TableHead>
                      </>
                    )}
                    {/* Bonus columns */}
                    {hasFlatFeeBonus && (
                      <>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Bonus Expected
                        </TableHead>
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Bonus Granted
                        </TableHead>
                      </>
                    )}
                    {isAdminView &&
                      (isInstagramContest ||
                        isTikTokContest ||
                        isYouTubeContest) && (
                        <TableHead
                          className={cn(
                            "text-center",
                            isDark ? "bg-[#391A6A] " : "bg-gray-50",
                          )}
                        >
                          Insights status
                        </TableHead>
                      )}
                    <TableHead
                      className={cn(
                        "text-center",
                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                      )}
                    >
                      Status
                    </TableHead>
                    {/* <TableHead
                    className={cn(
                      "min-w-[180px]",
                      isDark ? "bg-[#391A6A] " : "bg-gray-50"
                    )}
                  >
                    Rejection reason
                  </TableHead> */}
                    <TableHead
                      className={cn(
                        "min-w-[180px]",
                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                      )}
                    >
                      Rejection reason
                    </TableHead>
                    <TableHead
                      className={cn(
                        "min-w-[180px]",
                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                      )}
                    >
                      Submitted
                    </TableHead>
                    <TableHead
                      className={cn(
                        "text-center",
                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                      )}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={
                          isTwitterTextImageContest
                            ? 18 // Checkbox, #, Tweet, Total Points, Base Points, Manual Points, Likes, Replies, Retweets, Quote Reposts, Impressions, Expected Reward, Reward Granted, Manual Points Reason, Status, Rejection reason, Submitted, Actions
                            : 3 + // Checkbox, #, Content
                              3 + // Views, Likes, Comments
                              (isInstagramContest || isTikTokContest
                                ? isTikTokContest
                                  ? 3
                                  : 6
                                : 0) + // TT: Shares + total engagement + engagement rate; IG: +Saves, Reach, Interactions, Avg/Total watch
                              2 + // Expected Reward, Reward Granted
                              (contest?.contest_type === "milestone" ? 1 : 0) + // Milestone
                              (hasFlatFeeBonus ? 2 : 0) + // Bonus Expected, Bonus Granted
                              (isAdminView &&
                              (isInstagramContest ||
                                isTikTokContest ||
                                isYouTubeContest)
                                ? 1
                                : 0) + // Insights status (admin only)
                              4 // Status, Rejection reason, Submitted, Actions
                        }
                        className={cn(
                          "text-center py-8",
                          isDark ? "text-gray-400" : "text-gray-600",
                        )}
                      >
                        No submissions found for this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedSubmissions.map((submission, index) => {
                      const isTwitterTweet =
                        submission.is_twitter_tweet === true;

                      // For Twitter tweets, use Twitter metrics; for others, use platform-specific
                      const tt = submission.other_stats?.tiktok as
                        | Record<string, unknown>
                        | undefined;
                      const isTikTokRow = (submission.platform || "")
                        .toLowerCase()
                        .includes("tiktok");

                      const likes = isTwitterTweet
                        ? submission.other_stats?.likes || 0
                        : submission.other_stats?.youtube?.likes ||
                          submission.other_stats?.instagram?.likes ||
                          (isTikTokRow
                            ? Number(tt?.like_count ?? tt?.likes ?? 0)
                            : 0);
                      const comments = isTwitterTweet
                        ? submission.other_stats?.replies || 0
                        : submission.other_stats?.youtube?.comments ||
                          submission.other_stats?.instagram?.comments ||
                          (isTikTokRow
                            ? Number(tt?.comment_count ?? tt?.comments ?? 0)
                            : 0);
                      const platformStats =
                        submission.other_stats?.instagram ||
                        submission.other_stats?.tiktok ||
                        submission.other_stats ||
                        {};
                      const shares = isTikTokRow
                        ? Number(tt?.share_count ?? tt?.shares ?? 0)
                        : Number(
                            (platformStats as any)?.share_count ??
                              (platformStats as any)?.shares ??
                              0,
                          );
                      const saves =
                        (platformStats as any)?.saves ||
                        (platformStats as any)?.saved ||
                        0;
                      const reach = (platformStats as any)?.reach || 0;
                      const totalInteractions =
                        (platformStats as any)?.total_interactions || 0;
                      const avgWatchTimeMs =
                        (platformStats as any)?.avg_watch_time_ms || 0;
                      const totalWatchTimeMs =
                        (platformStats as any)?.total_watch_time_ms || 0;

                      const tiktokViewsForRate =
                        isTikTokContest && !isTwitterTweet
                          ? effectiveTikTokSubmissionViews(submission)
                          : 0;
                      const tiktokTotalEngagement =
                        isTikTokContest && !isTwitterTweet
                          ? Number(likes) + Number(comments) + Number(shares)
                          : 0;
                      const tiktokEngagementRatePct =
                        isTikTokContest &&
                        !isTwitterTweet &&
                        tiktokViewsForRate > 0
                          ? Math.round(
                              (tiktokTotalEngagement / tiktokViewsForRate) *
                                10000,
                            ) / 100
                          : 0;

                      // Twitter-specific metrics
                      const retweets = submission.other_stats?.retweets || 0;
                      const quoteReposts =
                        submission.other_stats?.quote_reposts || 0;
                      const impressions =
                        submission.other_stats?.impressions || 0;
                      const basePoints =
                        submission.other_stats?.base_points ||
                        submission.other_stats?.points ||
                        0;
                      const manualPointsAdjustment =
                        submission.manual_points_adjustment || 0;
                      const totalPoints = basePoints + manualPointsAdjustment;
                      const isDeletedTweet =
                        isTwitterTweet &&
                        !!(submission as any).deleted_at &&
                        (submission as any).deleted_at !== "";

                      // Get pre-calculated expected reward (with cap applied in submission time order)
                      const expectedReward =
                        expectedRewardsMap.get(submission.id) || 0;
                      const adjustedExpectedReward = shouldAdjustReward
                        ? applyPayoutAdjustment(
                            expectedReward,
                            payoutAdjustmentPercentage,
                          )
                        : expectedReward;
                      let expectedRewardForDisplay = expectedReward;

                      if (creatorCapApplied && submission.is_twitter_tweet) {
                        if (submission.id === cappedTwitterSubmissionId) {
                          expectedRewardForDisplay =
                            maxEarningsPerCreator || expectedReward;
                        } else {
                          expectedRewardForDisplay = 0;
                        }
                      }

                      // Use ACTUAL earnings for granted reward (includes custom pay amount)
                      // For Twitter CPM: treat as paid when paid flag or moderation_status is 'paid'
                      // Prefer: explicit paid/granted amount (custom pay) > submission.earnings > expected reward
                      const statusForGranted =
                        getNormalizedSubmissionStatus(submission);
                      const isPaidForGranted =
                        submission.paid ||
                        (isTwitterTweet && statusForGranted === "paid");
                      const explicitPaidAmount =
                        (submission as any).granted_amount_cents ??
                        (submission as any).paid_amount_cents ??
                        submission.other_stats?.paid_amount_cents ??
                        submission.other_stats?.granted_amount_cents;
                      const grantedReward = isPaidForGranted
                        ? explicitPaidAmount != null && explicitPaidAmount > 0
                          ? Number(explicitPaidAmount)
                          : contest?.contest_type === "milestone"
                            ? shouldAdjustReward
                              ? adjustedExpectedReward
                              : expectedReward
                            : submission.earnings && submission.earnings > 0
                              ? submission.earnings
                              : expectedReward
                        : 0;
                      const expectedBonus =
                        expectedBonusMap.get(submission.id) || 0;
                      const adjustedExpectedBonus = shouldAdjustBonus
                        ? applyPayoutAdjustment(
                            expectedBonus,
                            payoutAdjustmentPercentage,
                          )
                        : expectedBonus;
                      // Use actual bonus_amount from database if available
                      const grantedBonus = submission.bonus_paid
                        ? (submission as any).bonus_amount || flatFeeBonus
                        : 0;

                      const normalizedStatus =
                        getNormalizedSubmissionStatus(submission);
                      const isSubmissionVerified =
                        normalizedStatus === "verified";
                      const isSubmissionRejected =
                        normalizedStatus === "rejected";
                      const isSubmissionPending =
                        normalizedStatus === "pending";
                      const milestoneAssignmentLabel =
                        contest?.contest_type === "milestone"
                          ? (milestoneAssignedLabelBySubmissionId?.get(
                              submission.id,
                            ) ?? "Not eligible")
                          : "—";
                      const milestoneAssignmentParts =
                        milestoneAssignmentLabel.split(" • ");
                      const milestonePrimaryLabel =
                        milestoneAssignmentParts[0] || "—";
                      const milestoneViewsLabel =
                        milestoneAssignmentParts[1] || "—";

                      return (
                        <TableRow
                          key={submission.id}
                          className={cn(
                            isDark ? "text-white" : "text-gray-700",
                            isDeletedTweet && "opacity-60",
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedSubmissions.has(submission.id)}
                              onCheckedChange={(checked) =>
                                handleCheckboxChange(
                                  submission.id,
                                  checked as boolean,
                                )
                              }
                              aria-label={`Select submission ${index + 1}`}
                            />
                          </TableCell>
                          <TableCell
                            className={cn(
                              "font-medium",
                              isDark ? "text-white" : "text-gray-700",
                            )}
                          >
                            {index + 1}
                          </TableCell>
                          {/* For Twitter text_image contests, show Tweet column; for others, show Content */}
                          {isTwitterTextImageContest && isTwitterTweet ? (
                            <>
                              {/* Tweet Column */}
                              <TableCell className="min-w-[200px] max-w-[300px]">
                                <div className="flex flex-col gap-2">
                                  {/* Tweet type badge */}
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-xs px-2 py-0.5",
                                        submission.other_stats?.tweet_type ===
                                          "reply" ||
                                          submission.other_stats?.tweet_type ===
                                            "quote" ||
                                          submission.other_stats?.tweet_type ===
                                            "retweet"
                                          ? "bg-purple-100 text-purple-700 border-purple-300"
                                          : "bg-blue-100 text-blue-700 border-blue-300",
                                      )}
                                    >
                                      {submission.other_stats?.tweet_type ===
                                      "reply"
                                        ? "REPLY"
                                        : submission.other_stats?.tweet_type ===
                                            "quote"
                                          ? "QUOTE"
                                          : submission.other_stats
                                                ?.tweet_type === "retweet"
                                            ? "RETWEET"
                                            : "TWEET"}
                                    </Badge>
                                    {isDeletedTweet && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs px-2 py-0.5 bg-red-100 text-red-700 border-red-300"
                                      >
                                        DELETED
                                      </Badge>
                                    )}
                                    <span
                                      className={cn(
                                        "text-xs",
                                        isDark
                                          ? "text-gray-400"
                                          : "text-gray-500",
                                      )}
                                    >
                                      from @{creator.username}
                                    </span>
                                  </div>
                                  {/* Tweet text */}
                                  <p
                                    className={cn(
                                      "text-sm line-clamp-3",
                                      isDark ? "text-white" : "text-gray-900",
                                    )}
                                    title={
                                      submission.other_stats?.tweet_text ||
                                      submission.video_title ||
                                      ""
                                    }
                                  >
                                    {submission.other_stats?.tweet_text ||
                                      submission.video_title ||
                                      "No content"}
                                  </p>
                                  {/* View tweet link */}
                                  {submission.content_link && (
                                    <a
                                      href={submission.content_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "text-xs flex items-center gap-1 hover:underline w-fit",
                                        isDark
                                          ? "text-purple-400"
                                          : "text-purple-600",
                                      )}
                                    >
                                      Click to view tweet
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </TableCell>
                              {/* Total Points */}
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center">
                                  <span
                                    className={cn(
                                      "font-bold text-sm",
                                      isDark ? "text-white" : "text-gray-900",
                                    )}
                                  >
                                    {totalPoints}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-500",
                                    )}
                                  >
                                    total
                                  </span>
                                </div>
                              </TableCell>
                              {/* Base Points */}
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center">
                                  <span
                                    className={cn(
                                      "font-bold text-sm",
                                      isDark ? "text-white" : "text-gray-900",
                                    )}
                                  >
                                    {basePoints}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-500",
                                    )}
                                  >
                                    base
                                  </span>
                                </div>
                              </TableCell>
                              {/* Manual Points */}
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center">
                                  <span
                                    className={cn(
                                      "font-bold text-sm",
                                      manualPointsAdjustment > 0
                                        ? "text-green-600"
                                        : manualPointsAdjustment < 0
                                          ? "text-red-600"
                                          : isDark
                                            ? "text-white"
                                            : "text-gray-900",
                                    )}
                                  >
                                    {manualPointsAdjustment > 0 ? "+" : ""}
                                    {manualPointsAdjustment}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-500",
                                    )}
                                  >
                                    manual
                                  </span>
                                </div>
                              </TableCell>
                              {/* Likes */}
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3 text-purple-400" />
                                    <span
                                      className={cn(
                                        "font-bold text-sm",
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                    >
                                      {likes.toLocaleString()}
                                    </span>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-500",
                                    )}
                                  >
                                    likes
                                  </span>
                                </div>
                              </TableCell>
                              {/* Replies */}
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3 text-purple-400" />
                                    <span
                                      className={cn(
                                        "font-bold text-sm",
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                    >
                                      {comments.toLocaleString()}
                                    </span>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-500",
                                    )}
                                  >
                                    replies
                                  </span>
                                </div>
                              </TableCell>
                              {/* Retweets */}
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center">
                                  <span
                                    className={cn(
                                      "font-bold text-sm",
                                      isDark ? "text-white" : "text-gray-900",
                                    )}
                                  >
                                    {retweets.toLocaleString()}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-500",
                                    )}
                                  >
                                    retweets
                                  </span>
                                </div>
                              </TableCell>
                              {/* Quote Reposts */}
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center">
                                  <span
                                    className={cn(
                                      "font-bold text-sm",
                                      isDark ? "text-white" : "text-gray-900",
                                    )}
                                  >
                                    {quoteReposts.toLocaleString()}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-500",
                                    )}
                                  >
                                    quote reposts
                                  </span>
                                </div>
                              </TableCell>
                              {/* Impressions */}
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center">
                                  <div className="flex items-center gap-1">
                                    <Eye className="h-3 w-3 text-purple-400" />
                                    <span
                                      className={cn(
                                        "font-bold text-sm",
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                    >
                                      {impressions.toLocaleString()}
                                    </span>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-500",
                                    )}
                                  >
                                    impressions
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-medium text-sm">
                                {formatCurrency(expectedRewardForDisplay)}
                              </TableCell>
                              <TableCell className="text-center font-medium text-green-600">
                                {grantedReward > 0
                                  ? formatCurrency(grantedReward)
                                  : "-"}
                              </TableCell>
                              {/* Manual Points Reason */}
                              <TableCell className="text-center">
                                {submission.manual_points_reason ? (
                                  <span
                                    className={cn(
                                      "text-xs italic truncate max-w-[150px] block",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-600",
                                    )}
                                    title={submission.manual_points_reason}
                                  >
                                    {submission.manual_points_reason.length > 20
                                      ? submission.manual_points_reason.substring(
                                          0,
                                          20,
                                        ) + "..."
                                      : submission.manual_points_reason}
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-500"
                                        : "text-gray-400",
                                    )}
                                  >
                                    —
                                  </span>
                                )}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              {/* Content Column for non-Twitter submissions */}
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {submission.video_thumbnail_url && (
                                    <img
                                      src={submission.video_thumbnail_url}
                                      alt={
                                        submission.video_title ||
                                        "Video thumbnail"
                                      }
                                      className="w-16 h-9 object-cover rounded"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate max-w-xs">
                                      {submission.video_title || "Untitled"}
                                    </p>
                                    {submission.content_link && (
                                      <div className="flex items-center gap-2">
                                        <a
                                          href={submission.content_link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                          View Content
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                        {isAdminView && (
                                          <button
                                            onClick={() =>
                                              handleDownloadReel(submission.id)
                                            }
                                            disabled={
                                              downloadingSubmissionId ===
                                              submission.id
                                            }
                                            className={cn(
                                              "text-xs text-blue-600 hover:underline flex items-center gap-1",
                                              downloadingSubmissionId ===
                                                submission.id &&
                                                "opacity-50 cursor-not-allowed",
                                            )}
                                            title="Download Reel/Short"
                                          >
                                            {downloadingSubmissionId ===
                                            submission.id ? (
                                              <>
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Downloading...
                                              </>
                                            ) : (
                                              <>
                                                <Download className="h-3 w-3" />
                                                Download
                                              </>
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              {/* Views, Likes, Comments for non-Twitter submissions */}
                              <TableCell className="text-center font-mono">
                                {(isTikTokContest && !isTwitterTweet
                                  ? effectiveTikTokSubmissionViews(submission)
                                  : Number(submission.views ?? 0)
                                ).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center font-mono">
                                {likes.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center font-mono">
                                {comments.toLocaleString()}
                              </TableCell>
                              {/* Instagram-specific metrics for non-Twitter submissions */}
                              {(isInstagramContest || isTikTokContest) && (
                                <>
                                  <TableCell className="text-center font-mono">
                                    {formatMetricValue(shares)}
                                  </TableCell>
                                  {!isTikTokContest && (
                                    <TableCell className="text-center font-mono">
                                      {formatMetricValue(saves)}
                                    </TableCell>
                                  )}
                                  {/* Reach and Interactions commented out for TikTok per user request */}
                                  {!isTikTokContest && (
                                    <>
                                      <TableCell className="text-center font-mono">
                                        {formatMetricValue(reach)}
                                      </TableCell>
                                      <TableCell className="text-center font-mono">
                                        {formatMetricValue(totalInteractions)}
                                      </TableCell>
                                    </>
                                  )}
                                  {isTikTokContest ? (
                                    <>
                                      <TableCell className="text-center font-mono">
                                        {formatMetricValue(
                                          tiktokTotalEngagement,
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center font-mono">
                                        {tiktokViewsForRate > 0
                                          ? `${formatMetricValue(tiktokEngagementRatePct)}%`
                                          : "—"}
                                      </TableCell>
                                    </>
                                  ) : (
                                    <>
                                      <TableCell className="text-center font-mono">
                                        <div className="flex flex-col items-center">
                                          <span className="font-bold">
                                            {formatWatchTime(avgWatchTimeMs)}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-gray-400"
                                                : "text-gray-500",
                                            )}
                                          >
                                            avg
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center font-mono">
                                        <div className="flex flex-col items-center">
                                          <span className="font-bold">
                                            {formatWatchTime(totalWatchTimeMs)}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-gray-400"
                                                : "text-gray-500",
                                            )}
                                          >
                                            total
                                          </span>
                                        </div>
                                      </TableCell>
                                    </>
                                  )}
                                </>
                              )}
                              {/* Expected Reward and Reward Granted (only for non-Twitter) */}
                              {!isTwitterTextImageContest && (
                                <>
                                  <TableCell className="text-center font-medium">
                                    {hasPayoutAdjustment && shouldAdjustReward
                                      ? `${formatCurrency(
                                          expectedReward,
                                        )} → ${formatCurrency(
                                          adjustedExpectedReward,
                                        )}`
                                      : formatCurrency(expectedReward)}
                                  </TableCell>
                                  {contest?.contest_type === "milestone" && (
                                    <TableCell className="text-center">
                                      {milestoneAssignmentLabel === "—" ? (
                                        <span
                                          className={cn(
                                            "text-xs font-medium",
                                            isDark
                                              ? "text-slate-400"
                                              : "text-slate-500",
                                          )}
                                        >
                                          —
                                        </span>
                                      ) : (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-semibold">
                                            {milestonePrimaryLabel}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs font-medium whitespace-nowrap",
                                              isDark
                                                ? "text-slate-200"
                                                : "text-slate-700",
                                            )}
                                          >
                                            {milestoneViewsLabel}
                                          </span>
                                        </div>
                                      )}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-center font-medium text-green-600">
                                    {grantedReward > 0
                                      ? formatCurrency(grantedReward)
                                      : "-"}
                                  </TableCell>
                                </>
                              )}
                            </>
                          )}
                          {/* Bonus columns */}
                          {hasFlatFeeBonus && (
                            <>
                              <TableCell className="text-center font-medium">
                                {expectedBonus > 0
                                  ? hasPayoutAdjustment && shouldAdjustBonus
                                    ? `${formatCurrency(
                                        expectedBonus,
                                      )} → ${formatCurrency(
                                        adjustedExpectedBonus,
                                      )}`
                                    : formatCurrency(expectedBonus)
                                  : "-"}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-center font-medium",
                                  isDark ? "text-green-400" : "text-green-600",
                                )}
                              >
                                {grantedBonus > 0
                                  ? formatCurrency(grantedBonus)
                                  : "-"}
                              </TableCell>
                            </>
                          )}
                          {isAdminView &&
                            (isInstagramContest ||
                              isTikTokContest ||
                              isYouTubeContest) && (
                              <TableCell className="text-center">
                                {(() => {
                                  const meta = getInsightsMeta(
                                    submission.insights_status ?? null,
                                    (submission.other_stats as any)
                                      ?.tiktok_error ||
                                      (submission.other_stats as any)
                                        ?.instagram_error ||
                                      (submission.other_stats as any)?.youtube
                                        ?.insights_error,
                                  );
                                  return (
                                    <div className="flex items-center justify-center">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className={cn(
                                              "inline-flex items-center justify-center rounded-full border px-2 py-1",
                                              meta.pillClass,
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "h-2.5 w-2.5 rounded-full",
                                                meta.dotClass,
                                              )}
                                            />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="whitespace-pre-line">
                                          {meta.help}
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                            )}
                          <TableCell>
                            {getStatusBadge(normalizedStatus, submission.paid)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-center text-xs max-w-[220px]",
                              isDark ? "text-gray-300" : "text-gray-700",
                            )}
                          >
                            {normalizedStatus === "rejected" ? (
                              (() => {
                                const details = getFullRejectionDetails(
                                  submission.metadata,
                                );
                                const reason = details?.reason ?? null;
                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    {reason ? (
                                      <span
                                        className="truncate block max-w-[180px]"
                                        title={reason}
                                      >
                                        {reason.length > 25
                                          ? `${reason.slice(0, 25)}...`
                                          : reason}
                                      </span>
                                    ) : (
                                      <span
                                        className={
                                          isDark
                                            ? "text-gray-500"
                                            : "text-gray-400"
                                        }
                                      >
                                        —
                                      </span>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-6 px-2"
                                      onClick={() =>
                                        setRejectionDetailsModalSubmission({
                                          id: submission.id,
                                          metadata: submission.metadata,
                                        })
                                      }
                                    >
                                      Check
                                    </Button>
                                  </div>
                                );
                              })()
                            ) : (
                              <span
                                className={
                                  isDark ? "text-gray-500" : "text-gray-400"
                                }
                              >
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-sm",
                              isDark ? "text-gray-400" : "text-gray-600",
                            )}
                          >
                            {formatDate(submission.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {contest?.post_contest_status !==
                                  "verification_complete" &&
                                  contest?.post_contest_status !==
                                    "payments_processed" && (
                                    <>
                                      {/* For Twitter tweets, check moderation_status; for others, check status */}
                                      {!isSubmissionVerified && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            onVerify([submission.id])
                                          }
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          {isTwitterTweet
                                            ? "Approve"
                                            : "Verify"}
                                        </DropdownMenuItem>
                                      )}
                                      {!isSubmissionRejected && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            onReject([submission.id])
                                          }
                                        >
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Reject
                                        </DropdownMenuItem>
                                      )}
                                      {!isSubmissionPending && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            onSetPending([submission.id])
                                          }
                                        >
                                          <Clock className="h-4 w-4 mr-2" />
                                          Set Pending
                                        </DropdownMenuItem>
                                      )}
                                    </>
                                  )}

                                {/* Payment options: verified submissions (hide for Twitter leaderboard contests) */}
                                {contest?.post_contest_status ===
                                  "verification_complete" &&
                                  getNormalizedSubmissionStatus(submission) ===
                                    "verified" &&
                                  !submission.paid &&
                                  isAdminView &&
                                  !isTwitterLeaderboardContest && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          onPayment(submission.id, "standard")
                                        }
                                      >
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Mark as Paid
                                      </DropdownMenuItem>
                                      {hasFlatFeeBonus &&
                                        !submission.bonus_paid && (
                                          <>
                                            {!isTwitterCpmContest && (
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  onPayment(
                                                    submission.id,
                                                    "bonus",
                                                  )
                                                }
                                              >
                                                <DollarSign className="h-4 w-4 mr-2" />
                                                Mark Bonus as Paid
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                              onClick={() =>
                                                onPayment(submission.id, "both")
                                              }
                                            >
                                              <DollarSign className="h-4 w-4 mr-2" />
                                              Mark Both as Paid
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      {hasFlatFeeBonus &&
                                        !submission.bonus_paid &&
                                        submission.paid &&
                                        !isTwitterCpmContest && (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              onPayment(submission.id, "bonus")
                                            }
                                          >
                                            <DollarSign className="h-4 w-4 mr-2" />
                                            Mark Bonus as Paid
                                          </DropdownMenuItem>
                                        )}
                                    </>
                                  )}

                                {contest?.post_contest_status ===
                                  "verification_complete" &&
                                  contest?.post_contest_status !==
                                    "payments_processed" &&
                                  isAdminView && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          onCustomPayment(submission.id)
                                        }
                                      >
                                        Custom Pay
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                {submission.content_link && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                      <a
                                        href={submission.content_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Content
                                      </a>
                                    </DropdownMenuItem>
                                    {isAdminView &&
                                      contest?.platform?.toLowerCase() !==
                                        "twitter" &&
                                      contest?.platform?.toLowerCase() !==
                                        "x" && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleDownloadReel(submission.id)
                                          }
                                          disabled={
                                            downloadingSubmissionId ===
                                            submission.id
                                          }
                                          className={
                                            downloadingSubmissionId ===
                                            submission.id
                                              ? "opacity-50 cursor-not-allowed"
                                              : ""
                                          }
                                        >
                                          {downloadingSubmissionId ===
                                          submission.id ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Downloading...
                                            </>
                                          ) : (
                                            <>
                                              <Download className="h-4 w-4 mr-2" />
                                              Download Reel/Short
                                            </>
                                          )}
                                        </DropdownMenuItem>
                                      )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectionDetailsModalSubmission}
        onOpenChange={(open) => {
          if (!open) setRejectionDetailsModalSubmission(null);
        }}
      >
        <DialogContent
          className={cn(
            "max-w-md",
            isDark ? "bg-[#1a0a2e] border-gray-700 text-white" : "bg-white",
          )}
        >
          <DialogTitle className="flex items-center gap-2">
            Rejection reason
          </DialogTitle>
          {rejectionDetailsModalSubmission &&
            (() => {
              const parsed = parseSubmissionMetadata(
                rejectionDetailsModalSubmission.metadata,
              );
              const hasStructured = parsed && parsed.type === "rejection";
              const reason = hasStructured ? parsed.reason : null;
              const additionalNotes = hasStructured
                ? parsed.additionalNotes
                : undefined;
              const timestamp = hasStructured ? parsed.timestamp : undefined;
              const updatedBy = hasStructured ? parsed.updatedBy : undefined;

              if (!reason && !additionalNotes) {
                return (
                  <p
                    className={cn(
                      "text-sm",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  >
                    No rejection details available.
                  </p>
                );
              }

              return (
                <div className="space-y-4 text-sm">
                  {reason && (
                    <div>
                      <span
                        className={cn(
                          "font-medium",
                          isDark ? "text-gray-300" : "text-gray-700",
                        )}
                      >
                        Reason
                      </span>
                      <p
                        className={cn(
                          "mt-1",
                          isDark ? "text-gray-200" : "text-gray-900",
                        )}
                      >
                        {reason}
                      </p>
                    </div>
                  )}
                  {additionalNotes && (
                    <div>
                      <span
                        className={cn(
                          "font-medium",
                          isDark ? "text-gray-300" : "text-gray-700",
                        )}
                      >
                        Additional notes
                      </span>
                      <p
                        className={cn(
                          "mt-1 whitespace-pre-wrap",
                          isDark ? "text-gray-200" : "text-gray-900",
                        )}
                      >
                        {additionalNotes}
                      </p>
                    </div>
                  )}
                  {timestamp && (
                    <div
                      className={cn(
                        "text-xs",
                        isDark ? "text-gray-500" : "text-gray-500",
                      )}
                    >
                      <span>
                        {formatMetadataTimestamp(timestamp)}
                        {updatedBy ? " · Updated by moderator" : ""}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setRejectionDetailsModalSubmission(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
