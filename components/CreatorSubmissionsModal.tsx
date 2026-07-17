"use client";

import { useEffect, useMemo, useState } from "react";
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
  ThumbsDown,
  Share2,
  BarChart2,
  CircleHelp,
  AlertTriangle,
  Star,
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
  dualRewardsPayoutAdjustmentAppliesToCpm,
  dualRewardsPayoutAdjustmentAppliesToMilestone,
  parsePayoutAdjustment,
} from "@/lib/payout-rules";
import {
  buildDualRewardCreatorCapSplitMaps,
  splitDualPaidTotalByExpectedWeights,
} from "@/lib/dual-rewards-creator-cap";
import {
  excludeMostVerifiedBonusFromPaidTotalCents,
  getCpmGrantedCentsFromSubmission,
  getDualPayoutScopeFromSubmission,
  getDualRemainingPayableCents,
  getMilestoneLadderGrantedCentsFromSubmission,
  parseDualRewardsPayoutJson,
  tryDualRewardGrantedBreakdownFromStoredPayout,
} from "@/lib/dual-rewards-payout";
import {
  formatDualBulkPaymentToastDescription,
  getBulkPaymentToastMeta,
} from "@/lib/bulk-payment-toast";
import { buildFlatFeeBonusExpectedCentsBySubmissionId } from "@/lib/twitter-cpm-bonus-expected";
import { parseQualityScore } from "@/lib/quality-score";
import type { QualityScore } from "@/lib/quality-score";
import { submissionIsPaidRow } from "@/lib/paid-reversal-preview";
import {
  buildYouTubeContentViewUrl,
  formatClipDurationSeconds,
} from "@/lib/youtube-url";
import {
  postContestStatusLocksSubmissionModeration,
  submissionModerationUiAllowed,
  SUBMISSION_MODERATION_LOCKED_MESSAGE,
} from "@/lib/post-contest-moderation-lock";
import { SubmissionQualityScoreCell } from "@/components/SubmissionQualityScoreCell";
import { VerifyQualityDialog } from "@/components/VerifyQualityDialog";
import { YouTubeAnalyticsPanel } from "@/components/youtube/YouTubeAnalyticsPanel";
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
  dual_rewards_payout?: unknown;
  quality_score?: number | null;
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
  ytVisibleColumns?: string[];
  canSeeCore?: boolean;
  canSeeTraffic?: boolean;
  /** Match submission-wise YouTube analytics: demographics when admin or brand allowed */
  canSeeDemographics?: boolean;
  /**
   * Full contest submission list for flat-fee bonus cap (FCFS by created_at).
   * When omitted, falls back to `submissions` (per-creator only — wrong cap scope).
   */
  bonusCapSubmissions?: Submission[];
  /** True while parent runs bulk/single verify API after paid-reversal confirm (Creator modal stays open). */
  parentBulkActionLoading?: boolean;
  /**
   * Post-campaign overlay: metrics-only — hide verify/reject/pending/paid actions
   * and selection checkboxes (same as PC leaderboard table).
   */
  isPostCampaignView?: boolean;
  /** Called after a submission quality score is saved (updates parent list + creator aggregates). */
  onQualityScoreUpdated?: (payload: {
    submissionId: string;
    qualityScore: number;
    creatorId: string;
    avgQualityScore: number | null;
    bestQualityScore: number | null;
    qualityScoreSum: number | null;
    qualityScoreCounts?: {
      score1: number;
      score2: number;
      score3: number;
    };
  }) => void;
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
  ytVisibleColumns,
  canSeeCore = true,
  canSeeTraffic = true,
  canSeeDemographics = false,
  bonusCapSubmissions,
  parentBulkActionLoading = false,
  isPostCampaignView = false,
  onQualityScoreUpdated,
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
  const bulkStatusActionsBusy = bulkVerifyLoading || parentBulkActionLoading;
  type BulkPaymentActiveKey =
    | "standard:0"
    | "standard:1"
    | "bonus:0"
    | "bonus:1"
    | "both:0"
    | "both:1";
  const [bulkPaymentActiveKey, setBulkPaymentActiveKey] =
    useState<BulkPaymentActiveKey | null>(null);
  const bulkPayKey = (
    payType: "standard" | "bonus" | "both",
    isBulk: boolean,
  ): BulkPaymentActiveKey =>
    `${payType}:${isBulk ? "1" : "0"}` as BulkPaymentActiveKey;
  const isBulkPayBtnLoading = (
    payType: "standard" | "bonus" | "both",
    isBulk: boolean,
  ) => bulkPaymentActiveKey === bulkPayKey(payType, isBulk);
  const isAnyBulkPaymentBusy = bulkPaymentActiveKey !== null;
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<
    string | null
  >(null);
  const [rejectionDetailsModalSubmission, setRejectionDetailsModalSubmission] =
    useState<{ id: string; metadata: any } | null>(null);
  const [qualityEditSubmissionIds, setQualityEditSubmissionIds] = useState<
    string[]
  >([]);
  const [qualityEditLoading, setQualityEditLoading] = useState(false);

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

  const handleBulkAction = async (action: "verify" | "reject" | "pending") => {
    if (postContestStatusLocksSubmissionModeration(contest?.post_contest_status)) {
      toast({
        title: "Action blocked",
        description: SUBMISSION_MODERATION_LOCKED_MESSAGE,
        variant: "destructive",
      });
      return;
    }

    const selectedIds = Array.from(selectedSubmissions);
    if (action === "verify") {
      const selectedSubs = submissions.filter((s) =>
        selectedIds.includes(s.id),
      );
      const isVideoContest = contest?.contest_format !== "text_image";
      const hasPaidSelected = selectedSubs.some((s) => {
        const isTwitterTweet = s.is_twitter_tweet === true;
        const rawStatus =
          (isTwitterTweet ? s.moderation_status || s.status : s.status) ||
          "pending";
        const st = String(rawStatus).toLowerCase();
        return st === "paid" || s.paid === true;
      });

      if (hasPaidSelected) {
        setBulkVerifyLoading(true);
        try {
          await onVerify(selectedIds);
          setSelectedSubmissions(new Set());
        } finally {
          setBulkVerifyLoading(false);
        }
        return;
      }

      const allAlreadyVerifiedOnly =
        isVideoContest &&
        selectedSubs.length > 0 &&
        selectedSubs.every((s) => {
          const isTwitterTweet = s.is_twitter_tweet === true;
          const rawStatus =
            (isTwitterTweet ? s.moderation_status || s.status : s.status) ||
            "pending";
          const st = String(rawStatus).toLowerCase();
          if (isTwitterTweet) {
            return st === "approved" || st === "verified";
          }
          return st === "verified" && s.paid !== true;
        });

      if (allAlreadyVerifiedOnly) {
        setQualityEditSubmissionIds(selectedIds);
        return;
      }

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

    const hasTwitterTweetsSelected = selectedSubs.some(
      (s) => (s as any).is_twitter_tweet === true,
    );
    const isTwitterCpmContestFlag =
      contest.contest_type === "cpm" &&
      (contest.platform?.toLowerCase() === "twitter" ||
        contest.platform?.toLowerCase() === "x");

    // Standard/both: verified only.
    // Twitter CPM bonus-only: only already-paid tweets with unpaid bonus.
    // Other bonus-only (non-Twitter or Twitter leaderboard): verified rows with
    // unpaid bonus, OR already-paid rows whose bonus is still unpaid (parallel
    // to the Twitter CPM path so admins can pay bonus after standard).
    let paySubs: typeof selectedSubs;
    if (
      type === "bonus" &&
      hasTwitterTweetsSelected &&
      isTwitterCpmContestFlag
    ) {
      paySubs = selectedSubs.filter((s) => {
        if (!(s as any).is_twitter_tweet) return false;
        const st = getNormalizedSubmissionStatus(s);
        if (s.bonus_paid) return false;
        return st === "paid" || s.paid === true;
      });
    } else if (type === "bonus") {
      paySubs = selectedSubs.filter((s) => {
        if (s.bonus_paid) return false;
        const status = (s as any).is_twitter_tweet
          ? (s as any).moderation_status || s.status
          : s.status;
        const st = String(status || "").toLowerCase();
        return (
          st === "verified" ||
          st === "approved" ||
          st === "paid" ||
          s.paid === true
        );
      });
    } else {
      paySubs = selectedSubs.filter((s) => {
        const status = (s as any).is_twitter_tweet
          ? (s as any).moderation_status || s.status
          : s.status;
        const st = String(status || "").toLowerCase();
        return st === "verified" || st === "approved";
      });
    }

    if (paySubs.length === 0) {
      toast({
        title: "Cannot pay",
        description:
          type === "bonus" &&
          hasTwitterTweetsSelected &&
          isTwitterCpmContestFlag
            ? "No selected paid tweets with unpaid bonus found."
            : type === "bonus"
              ? "No selected submissions have an unpaid bonus. Bonus can be paid on verified or already-paid rows whose bonus has not been paid yet."
              : "No verified submissions selected. Only verified submissions can be paid.",
        variant: "destructive",
      });
      return;
    }

    setBulkPaymentActiveKey(bulkPayKey(type, isBulkTransaction));
    try {
      // Sort by submission time (earliest first)
      const sortedSubs = [...paySubs].sort(
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
      const isDual = contest.contest_type === "dual_rewards";

      if (isDual) {
        if (isBulkTransaction) {
          try {
            const response = await fetch("/api/admin/bulk-payment", {
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
              toast({
                title: "Bulk payment failed",
                description: result.error || "Unknown error",
                variant: "destructive",
              });
              return;
            }
            setSelectedSubmissions(new Set());
            const dualBulkToast = getBulkPaymentToastMeta(
              result.data?.paid_count ?? 0,
              result.data?.skipped_count ?? 0,
            );
            toast({
              title: dualBulkToast.title,
              description: formatDualBulkPaymentToastDescription({
                successCount: result.data?.paid_count ?? 0,
                skippedCount: result.data?.skipped_count ?? 0,
                totalCpmCents: result.data?.total_cpm ?? 0,
                totalMilestoneCents: result.data?.total_milestone ?? 0,
              }),
              variant: dualBulkToast.variant,
            });
            setTimeout(() => window.location.reload(), 700);
          } catch (error) {
            console.error("Dual bulk payment error:", error);
            toast({
              title: "Bulk payment failed",
              description:
                error instanceof Error ? error.message : "Unknown error",
              variant: "destructive",
            });
          }
          return;
        }

        let successCount = 0;
        let skippedCount = 0;
        let totalCpmCents = 0;
        let totalMilestoneCents = 0;
        const component =
          type === "standard" ? "cpm" : type === "bonus" ? "milestone" : "both";

        const dualPayableSubs = sortedSubs.filter((sub) => {
          const { cpmExpected, milestoneExpected } =
            computeDualExpectedPayableForSubmission(sub);
          return (
            getDualRemainingPayableCents(
              component,
              cpmExpected,
              milestoneExpected,
              sub.dual_rewards_payout,
            ).totalRemaining > 0
          );
        });

        if (dualPayableSubs.length === 0) {
          const componentLabel =
            component === "cpm"
              ? "CPM"
              : component === "milestone"
                ? "Milestone"
                : "CPM and milestone";
          toast({
            title: "Cannot pay",
            description: `No selected submissions have unpaid ${componentLabel.toLowerCase()} remaining. They may already be paid or have $0 expected for this component.`,
            variant: "destructive",
          });
          return;
        }

        skippedCount = sortedSubs.length - dualPayableSubs.length;

        for (const sub of dualPayableSubs) {
          try {
            const payResult = await handleDualSubmissionPayment(sub, component, {
              skipReload: true,
            });
            if (payResult.paid) {
              successCount++;
              totalCpmCents += payResult.cpmCents;
              totalMilestoneCents += payResult.milestoneCents;
            } else {
              skippedCount++;
            }
          } catch (error) {
            console.error(
              `Dual payment skipped for submission ${sub.id}:`,
              error,
            );
            skippedCount++;
          }
        }
        const dualBulkToast = getBulkPaymentToastMeta(successCount, skippedCount);
        toast({
          title: dualBulkToast.title,
          description: formatDualBulkPaymentToastDescription({
            successCount,
            skippedCount,
            totalCpmCents,
            totalMilestoneCents,
          }),
          variant: dualBulkToast.variant,
        });
        if (skippedCount === 0) {
          setSelectedSubmissions(new Set());
        }
        setTimeout(() => window.location.reload(), 700);
        return;
      }

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
            toast({
              title: "Bulk payment failed",
              description: result.error || "Unknown error",
              variant: "destructive",
            });
            return;
          }

          setSelectedSubmissions(new Set());

          const { data } = result;
          const isMilestoneContest = contest.contest_type === "milestone";
          const lines = isMilestoneContest
            ? [
                `Paid items: ${data.paid_count}`,
                `Skipped: ${data.skipped_count}`,
                ``,
                `Total paid: $${(data.total_amount / 100).toFixed(2)}`,
              ]
            : [
                `Paid items: ${data.paid_count}`,
                `Skipped: ${data.skipped_count}`,
                ``,
                `CPM earnings: $${(data.total_cpm / 100).toFixed(2)}`,
                `Flat fee bonus: $${(data.total_bonus / 100).toFixed(2)}`,
                `Total paid: $${(data.total_amount / 100).toFixed(2)}`,
              ];

          if (data.cap_reached) {
            lines.push(
              ``,
              `Earnings cap reached. Remaining cap: $${(data.remaining_cap / 100).toFixed(2)}`,
            );
          }

          toast({
            title: "Bulk payment successful",
            description: lines.join("\n"),
            variant: "payment",
          });

          setTimeout(() => window.location.reload(), 700);
        } catch (error) {
          console.error("Bulk payment error:", error);
          toast({
            title: "Bulk payment failed",
            description:
              error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      } else {
        // OPTION 1: Individual Transactions (Multiple API calls)
        let successCount = 0;
        let skippedCount = 0;

        // Pay each submission in order (skipReload so parent doesn't reload after each)
        for (const sub of sortedSubs) {
          try {
            await onPayment(sub.id, type, { skipReload: true });
            successCount++;
          } catch (error) {
            console.error(`Payment skipped for submission ${sub.id}:`, error);
            skippedCount++;
            // Continue with next submission even if one is skipped
          }
        }

        // Show summary and reload once so data is fresh (same style as bulk CPM / dual)
        toast({
          title: "Bulk payment successful",
          description: [
            `Paid items: ${successCount}`,
            `Skipped: ${skippedCount}`,
          ].join("\n"),
          variant: "payment",
        });
        if (skippedCount === 0) {
          setSelectedSubmissions(new Set());
        }
        setTimeout(() => window.location.reload(), 700);
      }
    } finally {
      setBulkPaymentActiveKey(null);
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
  const calculateRawSubmissionCpmExpectedReward = (submission: Submission) => {
    const cpmConfig = (contest?.contest_based_details as any)?.cpm_contest;
    const cpmRateUsd = cpmConfig?.cpm_rate_usd;
    if (!cpmRateUsd) return 0;

    const platform = (submission.platform || "").toLowerCase();
    const isTwitterSubmission =
      submission.is_twitter_tweet === true ||
      platform === "twitter" ||
      platform === "x";

    if (isTwitterSubmission) {
      const basePoints = submission.other_stats?.base_points || 0;
      const manualAdjustment = submission.manual_points_adjustment || 0;
      const totalPoints = Math.max(basePoints + manualAdjustment, 0);
      return Math.max(Math.round((totalPoints * cpmRateUsd * 100) / 1000), 0);
    }

    let effectiveViews = submission.views || 0;
    if (cpmConfig?.min_views != null && effectiveViews < cpmConfig.min_views) {
      effectiveViews = 0;
    }
    if (cpmConfig?.max_views != null && effectiveViews > cpmConfig.max_views) {
      effectiveViews = cpmConfig.max_views;
    }
    return Math.max(Math.round((effectiveViews * cpmRateUsd * 100) / 1000), 0);
  };

  const dualAndCpmCapMaps = useMemo(() => {
    const cpmMap = new Map<string, number>();
    const dualMilestoneCappedMap = new Map<string, number>();
    const details = contest?.contest_based_details as any;
    const maxResolved =
      contest?.max_earnings_per_creator ??
      details?.cpm_contest?.max_earnings_per_creator ??
      (contest?.contest_type === "leaderboard"
        ? details?.leaderboard_contest?.max_earnings_per_creator
        : null) ??
      null;
    const maxEarningsPerCreator = Number(maxResolved);

    const fillUncappedMilestoneForAllSubs = () => {
      submissions.forEach((sub) => {
        dualMilestoneCappedMap.set(
          sub.id,
          Number(milestoneExpectedPayoutBySubmissionId?.get(sub.id) || 0),
        );
      });
    };

    const groupByCreator = () => {
      const grouped = new Map<string, Submission[]>();
      for (const sub of submissions) {
        const cid = String(sub.creator_id || "");
        if (!cid) continue;
        const arr = grouped.get(cid) || [];
        arr.push(sub);
        grouped.set(cid, arr);
      }
      return grouped;
    };

    if (!Number.isFinite(maxEarningsPerCreator) || maxEarningsPerCreator <= 0) {
      submissions.forEach((sub) => {
        cpmMap.set(sub.id, calculateRawSubmissionCpmExpectedReward(sub));
      });
      fillUncappedMilestoneForAllSubs();
      return { cpmMap, dualMilestoneCappedMap };
    }

    if (contest?.contest_type === "dual_rewards") {
      for (const list of groupByCreator().values()) {
        list.sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime(),
        );
        const rows = list.map((sub) => ({
          id: sub.id,
          created_at: String(sub.created_at || ""),
          mRawCents: Number(
            milestoneExpectedPayoutBySubmissionId?.get(sub.id) || 0,
          ),
          cRawCents: calculateRawSubmissionCpmExpectedReward(sub),
        }));
        const { milestoneCappedBySubmissionId, cpmCappedBySubmissionId } =
          buildDualRewardCreatorCapSplitMaps(rows, maxEarningsPerCreator);
        for (const row of rows) {
          cpmMap.set(row.id, cpmCappedBySubmissionId.get(row.id) ?? 0);
          dualMilestoneCappedMap.set(
            row.id,
            milestoneCappedBySubmissionId.get(row.id) ?? 0,
          );
        }
      }
      submissions.forEach((sub) => {
        if (!cpmMap.has(sub.id)) {
          cpmMap.set(sub.id, calculateRawSubmissionCpmExpectedReward(sub));
          dualMilestoneCappedMap.set(
            sub.id,
            Number(milestoneExpectedPayoutBySubmissionId?.get(sub.id) || 0),
          );
        }
      });
      return { cpmMap, dualMilestoneCappedMap };
    }

    for (const list of groupByCreator().values()) {
      list.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      let runningTotal = 0;
      for (const sub of list) {
        const rawCpm = calculateRawSubmissionCpmExpectedReward(sub);
        let cappedCpm = rawCpm;
        if (runningTotal + rawCpm > maxEarningsPerCreator) {
          cappedCpm = Math.max(0, maxEarningsPerCreator - runningTotal);
        }
        cpmMap.set(sub.id, cappedCpm);
        runningTotal += cappedCpm;
      }
    }
    submissions.forEach((sub) => {
      if (!cpmMap.has(sub.id)) {
        cpmMap.set(sub.id, calculateRawSubmissionCpmExpectedReward(sub));
      }
    });
    fillUncappedMilestoneForAllSubs();
    return { cpmMap, dualMilestoneCappedMap };
  }, [submissions, contest, milestoneExpectedPayoutBySubmissionId]);

  const calculateSubmissionCpmExpectedReward = (submission: Submission) => {
    return dualAndCpmCapMaps.cpmMap.get(submission.id) ?? 0;
  };

  const computeDualExpectedPayableForSubmission = (submission: Submission) => {
    const cpmExpectedRaw = calculateRawSubmissionCpmExpectedReward(submission);
    const milestoneExpectedRaw = Math.max(
      Number(milestoneExpectedPayoutBySubmissionId?.get(submission.id) || 0),
      0,
    );
    const cpmCappedBase =
      dualAndCpmCapMaps.cpmMap.get(submission.id) ?? cpmExpectedRaw;
    const milestoneCappedBase =
      dualAndCpmCapMaps.dualMilestoneCappedMap.get(submission.id) ??
      milestoneExpectedRaw;
    const mode = (contest as any)?.payout_adjustment_mode as string | null;
    const pct = Number((contest as any)?.payout_adjustment_percentage ?? 0);
    const hasAdj = pct > 0 && !!mode;
    const adjCpm = hasAdj && dualRewardsPayoutAdjustmentAppliesToCpm(mode);
    const adjMs = hasAdj && dualRewardsPayoutAdjustmentAppliesToMilestone(mode);
    const cpmExpected = adjCpm
      ? applyPayoutAdjustment(cpmCappedBase, pct)
      : cpmCappedBase;
    const milestoneExpected = adjMs
      ? applyPayoutAdjustment(milestoneCappedBase, pct)
      : milestoneCappedBase;
    return { cpmExpected, milestoneExpected };
  };

  const handleDualSubmissionPayment = async (
    submission: Submission,
    component: "cpm" | "milestone" | "both",
    options?: { skipReload?: boolean },
  ): Promise<{ paid: boolean; cpmCents: number; milestoneCents: number }> => {
    const emptyResult = { paid: false, cpmCents: 0, milestoneCents: 0 };
    const { cpmExpected, milestoneExpected } =
      computeDualExpectedPayableForSubmission(submission);
    const { cpmRemaining, milestoneRemaining, totalRemaining } =
      getDualRemainingPayableCents(
        component,
        cpmExpected,
        milestoneExpected,
        submission.dual_rewards_payout,
      );
    if (totalRemaining <= 0) {
      if (!options?.skipReload) {
        const componentLabel =
          component === "cpm"
            ? "CPM"
            : component === "milestone"
              ? "Milestone"
              : "CPM and milestone";
        toast({
          title: "Nothing to pay",
          description:
            cpmRemaining <= 0 &&
            milestoneRemaining <= 0 &&
            (cpmExpected > 0 || milestoneExpected > 0)
              ? `${componentLabel} is already paid for this submission.`
              : `No payable ${componentLabel.toLowerCase()} amount. Check views, milestone eligibility, creator cap, or payout adjustment.`,
          variant: "default",
        });
      }
      return emptyResult;
    }
    const prevPayout = parseDualRewardsPayoutJson(submission.dual_rewards_payout);
    const prevCpmCents = prevPayout?.cpm_cents ?? 0;
    const prevMilestoneCents = prevPayout?.milestone_cents ?? 0;
    const amountInCents = totalRemaining;
    const res = await fetch("/api/admin/verify-submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId: submission.id,
        action: "paid",
        paymentDetails: {
          amountInCents,
          isCustom: true,
          customRemarks: `dual_component:${component}`,
        },
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result?.error || "Failed to pay submission");

    const nextPayout = parseDualRewardsPayoutJson(
      result.submission?.dual_rewards_payout,
    );
    let cpmPaidCents = Math.max(0, (nextPayout?.cpm_cents ?? 0) - prevCpmCents);
    let milestonePaidCents = Math.max(
      0,
      (nextPayout?.milestone_cents ?? 0) - prevMilestoneCents,
    );
    if (cpmPaidCents === 0 && milestonePaidCents === 0) {
      if (component === "cpm") cpmPaidCents = cpmRemaining;
      else if (component === "milestone") milestonePaidCents = milestoneRemaining;
      else {
        cpmPaidCents = cpmRemaining;
        milestonePaidCents = milestoneRemaining;
      }
    }

    if (!options?.skipReload) {
      setTimeout(() => window.location.reload(), 800);
    }
    return {
      paid: true,
      cpmCents: cpmPaidCents,
      milestoneCents: milestonePaidCents,
    };
  };

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
          let effectiveViews =
            isTikTokContest && !isTwitterSubmission
              ? effectiveTikTokSubmissionViews(submission)
              : (submission.views ?? 0);
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

  const payoutAdjustment = parsePayoutAdjustment(
    (contest as any)?.payout_adjustment_percentage,
    (contest as any)?.payout_adjustment_mode,
    { contestType: contest?.contest_type ?? null },
  );
  const payoutAdjustmentPercentage = payoutAdjustment.percentage;
  const payoutAdjustmentMode = payoutAdjustment.mode;
  const hasPayoutAdjustment = payoutAdjustment.hasAdjustment;
  const shouldAdjustReward = payoutAdjustment.shouldAdjustReward;
  const shouldAdjustBonus = payoutAdjustment.shouldAdjustBonus;

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
  const isDualRewardsContest = contest?.contest_type === "dual_rewards";
  const dualAdjustCpmForModal =
    isDualRewardsContest &&
    hasPayoutAdjustment &&
    dualRewardsPayoutAdjustmentAppliesToCpm(payoutAdjustmentMode);
  const dualAdjustMilestoneForModal =
    isDualRewardsContest &&
    hasPayoutAdjustment &&
    dualRewardsPayoutAdjustmentAppliesToMilestone(payoutAdjustmentMode);
  const showDualPayoutAdjBreakdownColumns =
    isDualRewardsContest &&
    hasPayoutAdjustment &&
    (dualAdjustCpmForModal || dualAdjustMilestoneForModal);

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
  const isVideoContest = contest?.contest_format !== "text_image";

  const getSubmissionContentViewHref = (submission: Submission) => {
    const link = submission.content_link || "";
    if (!link) return "#";
    const platform = (
      submission.platform ||
      contest?.platform ||
      ""
    ).toLowerCase();
    const isYouTube =
      platform.includes("youtube") || /youtu\.?be/i.test(link);
    if (!isYouTube) return link;
    const ytStats =
      (submission.other_stats as any)?.youtube ||
      submission.other_stats ||
      {};
    const durationSeconds = Number(ytStats.duration_seconds);
    return buildYouTubeContentViewUrl(
      link,
      Number.isFinite(durationSeconds) && durationSeconds > 0
        ? durationSeconds
        : null,
    );
  };

  const canEditQualityScore = isVideoContest && !isPostCampaignView;
  // Post-campaign overlay is metrics-only — no verify/reject/pending/paid.
  const showSelectionCheckboxes = !isPostCampaignView;
  const showBulkModerationActions =
    !isPostCampaignView &&
    submissionModerationUiAllowed(contest?.post_contest_status, {
      forBulkBar: true,
    });
  const showRowModerationActions = (submission: (typeof submissions)[number]) =>
    !isPostCampaignView &&
    submissionModerationUiAllowed(contest?.post_contest_status, {
      isPaidRow: submissionIsPaidRow(submission),
    });
  const showPaymentActions =
    !isPostCampaignView &&
    isAdminView &&
    contest?.post_contest_status === "verification_complete";
  const qualityEditFirstSubmission = qualityEditSubmissionIds[0]
    ? submissions.find((s) => s.id === qualityEditSubmissionIds[0]) ?? null
    : null;
  const qualityEditInitialScore: QualityScore =
    parseQualityScore(qualityEditFirstSubmission?.quality_score) ?? 1;

  const handleSaveQualityScore = async (qualityScore: QualityScore) => {
    if (qualityEditSubmissionIds.length === 0) return;
    setQualityEditLoading(true);
    try {
      const res = await fetch("/api/admin/submissions/bulk-quality-score", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionIds: qualityEditSubmissionIds,
          qualityScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update quality score");
      }

      const creatorQualityByCreatorId = (data.creatorQualityByCreatorId ||
        {}) as Record<
        string,
        {
          avg_quality_score: number | null;
          best_quality_score: number | null;
          quality_score_sum: number | null;
          quality_score_counts?: {
            score1: number;
            score2: number;
            score3: number;
          };
        }
      >;

      for (const updated of data.submissions || []) {
        const creatorId = String(updated.creator_id || "");
        const creatorQuality = creatorQualityByCreatorId[creatorId];
        onQualityScoreUpdated?.({
          submissionId: String(updated.id),
          qualityScore,
          creatorId,
          avgQualityScore: creatorQuality?.avg_quality_score ?? null,
          bestQualityScore: creatorQuality?.best_quality_score ?? null,
          qualityScoreSum: creatorQuality?.quality_score_sum ?? null,
          qualityScoreCounts: creatorQuality?.quality_score_counts,
        });
      }

      toast({
        title:
          qualityEditSubmissionIds.length > 1
            ? "Quality scores updated"
            : "Quality score updated",
        description: `Saved as ${qualityScore}/3.`,
        variant: "success",
      });
      setQualityEditSubmissionIds([]);
      setSelectedSubmissions(new Set());
    } catch (error: unknown) {
      toast({
        title: "Could not update quality score",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setQualityEditLoading(false);
    }
  };
  const ytVisibleColumnsEffective =
    ytVisibleColumns && ytVisibleColumns.length > 0
      ? ytVisibleColumns
      : [
          "views",
          "likes",
          "comments",
          "dislikes",
          "shares",
          "avg_view_pct",
          "watch_time",
          "avg_duration",
          "clip_duration",
          "engaged_views",
          "subs_gained",
          "bot_score",
          "analytics",
          "top_traffic_source",
          "insights_status",
          "expected_reward",
          "adjusted_reward",
          "reward_granted",
          "status",
          "submitted",
        ];
  const showYtColumn = (columnId: string) => {
    if (!isYouTubeContest) return false;
    if (!ytVisibleColumnsEffective.includes(columnId)) return false;
    if (
      [
        "dislikes",
        "shares",
        "avg_view_pct",
        "watch_time",
        "avg_duration",
        "engaged_views",
        "subs_gained",
        "bot_score",
        "analytics",
      ].includes(columnId)
    ) {
      return canSeeCore;
    }
    if (columnId === "top_traffic_source") return canSeeTraffic;
    return true;
  };
  const dualPayoutAdjModalBreakdownColumnCount =
    showDualPayoutAdjBreakdownColumns &&
    (!isYouTubeContest || showYtColumn("adjusted_reward"))
      ? 1 +
        (dualAdjustCpmForModal ? 1 : 0) +
        (dualAdjustMilestoneForModal ? 1 : 0)
      : 0;
  const YT_TRAFFIC_SOURCE_LABELS: Record<string, string> = {
    SHORTS: "Shorts",
    YT_SEARCH: "YouTube Search",
    RELATED_VIDEO: "Related",
    YT_CHANNEL: "Channel",
    SUBSCRIBER: "Subscriber",
    EXT_URL: "External",
    NO_LINK_OTHER: "Direct",
    YT_OTHER_PAGE: "Other YT",
    PLAYLIST: "Playlist",
    NOTIFICATION: "Notifications",
    END_SCREEN: "End Screen",
    HASHTAGS: "Hashtags",
    SOUND_PAGE: "Sound",
    NO_LINK_EMBEDDED: "Embedded",
  };

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
        help:
          "Insights cannot be fetched for this post; refresh can retry once every 24 hours" +
          errorSuffix,
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

  const expectedBonusMap = useMemo(
    () =>
      buildFlatFeeBonusExpectedCentsBySubmissionId(
        contest,
        bonusCapSubmissions ?? submissions,
      ),
    [contest, bonusCapSubmissions, submissions],
  );

  // For leaderboard, expected reward per tweet = prize for creator's rank (no cap); match normal view
  const isLeaderboard = contest?.contest_type === "leaderboard";
  if (maxEarningsPerCreator && maxEarningsPerCreator > 0 && !isLeaderboard) {
    // Sort by created_at to apply creator cap in submission order
    const submissionsByTime = [...submissions].sort((a, b) => {
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
    });
  } else {
    // No cap (or leaderboard): use formula-only expected per submission
    submissions.forEach((sub) => {
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
  const creatorDisplayName =
    creator.username?.trim() ||
    creator.full_name?.trim() ||
    "Unknown";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
        <DialogContent
          className="max-w-[98vw] max-h-[98vh] p-0 gap-0"
          hideCloseButton
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">
            {creatorDisplayName}&apos;s Submissions
          </DialogTitle>
          <div className="flex flex-col h-[98vh] min-h-0 overflow-hidden relative">
            {parentBulkActionLoading && (
              <div
                className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-lg bg-black/45 px-4"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="h-10 w-10 animate-spin text-purple-300" />
                <p className="text-center text-sm font-medium text-white">
                  Processing submission updates…
                </p>
              </div>
            )}
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
                    {creatorDisplayName[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2
                    className={cn(
                      "text-2xl font-bold text-gray-900 dark:text-white",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    {creatorDisplayName}&apos;s Submissions
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
                disabled={parentBulkActionLoading}
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
            {showSelectionCheckboxes && selectedSubmissions.size > 0 && (
              <div
                className={cn(
                  "border-b p-2 sm:p-3",
                  isDark ? "bg-blue-900/20" : "bg-blue-50",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isDark ? "text-blue-300" : "text-blue-900",
                      )}
                    >
                      {selectedSubmissions.size} selected
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedSubmissions(new Set())}
                      disabled={bulkStatusActionsBusy}
                      className={cn(
                        "h-8 text-sm",
                        isDark ? "text-white" : "text-gray-600",
                      )}
                    >
                      Clear
                    </Button>
                  </div>

                  {showBulkModerationActions && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleBulkAction("verify")}
                          loading={bulkStatusActionsBusy}
                          loadingText={
                            parentBulkActionLoading
                              ? "Processing updates..."
                              : "Verifying submissions..."
                          }
                          className={cn(
                            "h-8 shrink-0 whitespace-nowrap rounded-md",
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
                          disabled={bulkStatusActionsBusy}
                          className={cn(
                            "h-8 shrink-0 whitespace-nowrap rounded-md",
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
                          disabled={bulkStatusActionsBusy}
                          className={cn(
                            "h-8 shrink-0 whitespace-nowrap rounded-md",
                            isDark
                              ? "border bg-yellow-900/30 text-yellow-400 border-yellow-500"
                              : "bg-yellow-600 text-white hover:bg-yellow-700 ",
                          )}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Mark as Pending
                        </Button>
                        {bulkStatusActionsBusy && (
                          <span
                            className={cn(
                              "text-xs self-center whitespace-nowrap",
                              isDark ? "text-blue-200" : "text-blue-700",
                            )}
                          >
                            {parentBulkActionLoading
                              ? "Processing submission updates…"
                              : "Verifying submissions…"}
                          </span>
                        )}
                      </>
                    )}

                  {showPaymentActions &&
                    contest?.post_contest_status !== "payouts_processed" &&
                    !isTwitterLeaderboardContest && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "shrink-0 rounded p-1",
                                isDark
                                  ? "text-blue-300/90 hover:bg-white/10"
                                  : "text-blue-800/80 hover:bg-blue-100/80",
                              )}
                              aria-label="How payout works"
                            >
                              <CircleHelp className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            className="max-w-[min(100vw-2rem,22rem)] text-left text-xs leading-snug"
                          >
                            Left group: one payment per checked row. (Bulk)
                            buttons: same checked rows, one combined payout
                            request. Only verified rows qualify.
                          </TooltipContent>
                        </Tooltip>
                        <div className="-mx-1 flex min-h-9 min-w-0 max-w-full flex-[1_1_200px] items-center overflow-x-auto overscroll-x-contain px-1 [-webkit-overflow-scrolling:touch]">
                          <div className="flex w-max items-center gap-1.5 py-0.5">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleBulkPayment("standard", false)
                              }
                              disabled={isAnyBulkPaymentBusy}
                              className="h-8 shrink-0 bg-blue-600 text-white hover:bg-blue-700"
                            >
                              {isBulkPayBtnLoading("standard", false) ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <DollarSign className="h-3.5 w-3.5" />
                              )}
                              {isDualRewardsContest
                                ? "Mark as Paid (CPM)"
                                : "Mark as Paid"}
                            </Button>
                            {hasFlatFeeBonus || isDualRewardsContest ? (
                              <>
                                {(!isTwitterCpmContest ||
                                  isDualRewardsContest) && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleBulkPayment("bonus", false)
                                    }
                                    disabled={isAnyBulkPaymentBusy}
                                    className="h-8 shrink-0 bg-green-600 text-white hover:bg-green-700"
                                  >
                                    {isBulkPayBtnLoading("bonus", false) ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <DollarSign className="h-3.5 w-3.5" />
                                    )}
                                    {isDualRewardsContest
                                      ? "Mark as Paid (Milestone)"
                                      : "Mark Bonus as Paid"}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleBulkPayment("both", false)
                                  }
                                  disabled={isAnyBulkPaymentBusy}
                                  className="h-8 shrink-0 bg-purple-600 text-white hover:bg-purple-700"
                                >
                                  {isBulkPayBtnLoading("both", false) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <DollarSign className="h-3.5 w-3.5" />
                                  )}
                                  {isDualRewardsContest
                                    ? "Mark Both as Paid (CPM+Milestone)"
                                    : "Mark Both as Paid"}
                                </Button>
                                <span
                                  className={cn(
                                    "hidden h-6 w-px shrink-0 self-center sm:block",
                                    isDark ? "bg-white/15" : "bg-border",
                                  )}
                                  aria-hidden
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleBulkPayment("standard", true)
                                  }
                                  disabled={isAnyBulkPaymentBusy}
                                  className="h-8 shrink-0 border border-blue-500/80 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300"
                                >
                                  {isBulkPayBtnLoading("standard", true) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <DollarSign className="h-3.5 w-3.5" />
                                  )}
                                  {isDualRewardsContest
                                    ? "Mark as Paid Bulk (CPM)"
                                    : "Mark as Paid (Bulk)"}
                                </Button>
                                {(!isTwitterCpmContest ||
                                  isDualRewardsContest) && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleBulkPayment("bonus", true)
                                    }
                                    disabled={isAnyBulkPaymentBusy}
                                    className="h-8 shrink-0 border border-green-500/80 bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:text-green-300"
                                  >
                                    {isBulkPayBtnLoading("bonus", true) ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <DollarSign className="h-3.5 w-3.5" />
                                    )}
                                    {isDualRewardsContest
                                      ? "Mark as Paid Bulk (Milestone)"
                                      : "Mark Bonus as Paid (Bulk)"}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleBulkPayment("both", true)
                                  }
                                  disabled={isAnyBulkPaymentBusy}
                                  className="h-8 shrink-0 border border-purple-500/80 bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 dark:text-purple-300"
                                >
                                  {isBulkPayBtnLoading("both", true) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <DollarSign className="h-3.5 w-3.5" />
                                  )}
                                  {isDualRewardsContest
                                    ? "Mark Both as Paid Bulk (CPM+Milestone)"
                                    : "Mark Both as Paid (Bulk)"}
                                </Button>
                              </>
                            ) : (
                              <>
                                <span
                                  className={cn(
                                    "hidden h-6 w-px shrink-0 self-center sm:block",
                                    isDark ? "bg-white/15" : "bg-border",
                                  )}
                                  aria-hidden
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleBulkPayment("standard", true)
                                  }
                                  disabled={isAnyBulkPaymentBusy}
                                  className="h-8 shrink-0 border border-blue-500/80 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300"
                                >
                                  {isBulkPayBtnLoading("standard", true) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <DollarSign className="h-3.5 w-3.5" />
                                  )}
                                  Mark as Paid (Bulk)
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
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
                    {showSelectionCheckboxes && (
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
                    )}
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
                          {contest?.contest_type === "dual_rewards"
                            ? "Total Expected Reward"
                            : "Expected Reward"}
                        </TableHead>
                        {hasPayoutAdjustment &&
                          shouldAdjustReward &&
                          (!isYouTubeContest ||
                            showYtColumn("adjusted_reward")) &&
                          (!isDualRewardsContest ||
                            !showDualPayoutAdjBreakdownColumns) && (
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Adjusted Reward
                            </TableHead>
                          )}
                        {contest?.contest_type === "dual_rewards" && (
                          <>
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Expected Reward (CPM)
                            </TableHead>
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Expected Reward (Milestone)
                            </TableHead>
                            {showDualPayoutAdjBreakdownColumns &&
                              (!isYouTubeContest ||
                                showYtColumn("adjusted_reward")) && (
                                <>
                                  <TableHead
                                    className={cn(
                                      "text-center",
                                      isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                    )}
                                  >
                                    Total Adjusted Reward
                                  </TableHead>
                                  {dualAdjustCpmForModal && (
                                    <TableHead
                                      className={cn(
                                        "text-center",
                                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                      )}
                                    >
                                      Adjusted Reward (CPM)
                                    </TableHead>
                                  )}
                                  {dualAdjustMilestoneForModal && (
                                    <TableHead
                                      className={cn(
                                        "text-center",
                                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                      )}
                                    >
                                      Adjusted Reward (Milestone)
                                    </TableHead>
                                  )}
                                </>
                              )}
                          </>
                        )}
                        {(contest?.contest_type === "milestone" ||
                          contest?.contest_type === "dual_rewards") && (
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
                          {contest?.contest_type === "dual_rewards"
                            ? "Total Reward Granted"
                            : "Reward Granted"}
                        </TableHead>
                        {contest?.contest_type === "dual_rewards" && (
                          <>
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Reward Granted (CPM)
                            </TableHead>
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Reward Granted (Milestone)
                            </TableHead>
                          </>
                        )}
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
                        {(!isYouTubeContest || showYtColumn("views")) && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Views
                          </TableHead>
                        )}
                        {(!isYouTubeContest || showYtColumn("likes")) && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Likes
                          </TableHead>
                        )}
                        {(!isYouTubeContest || showYtColumn("comments")) && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Comments
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("dislikes") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Dislikes
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("shares") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Shares
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("avg_view_pct") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Avg View %
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("watch_time") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Watch Time
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("avg_duration") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Avg Duration
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("clip_duration") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Total duration of clip
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("engaged_views") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Engaged Views
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("subs_gained") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Subs Gained
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("bot_score") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Bot Score
                          </TableHead>
                        )}
                        {isYouTubeContest && showYtColumn("analytics") && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Analytics
                          </TableHead>
                        )}
                        {isYouTubeContest &&
                          showYtColumn("top_traffic_source") && (
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Top Traffic Source
                            </TableHead>
                          )}
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
                                <TableHead
                                  className={cn(
                                    "text-center",
                                    isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                  )}
                                >
                                  Reel duration
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
                        {isVideoContest && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Quality Score
                          </TableHead>
                        )}
                        {(!isYouTubeContest ||
                          showYtColumn("expected_reward")) && (
                          <TableHead
                            className={cn(
                              "text-center",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            {contest?.contest_type === "dual_rewards"
                              ? "Total Expected Reward"
                              : "Expected Reward"}
                          </TableHead>
                        )}
                        {hasPayoutAdjustment &&
                          shouldAdjustReward &&
                          (!isYouTubeContest ||
                            showYtColumn("adjusted_reward")) &&
                          (!isDualRewardsContest ||
                            !showDualPayoutAdjBreakdownColumns) && (
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Adjusted Reward
                            </TableHead>
                          )}
                        {contest?.contest_type === "dual_rewards" && (
                          <>
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Expected Reward (CPM)
                            </TableHead>
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              Expected Reward (Milestone)
                            </TableHead>
                            {showDualPayoutAdjBreakdownColumns &&
                              (!isYouTubeContest ||
                                showYtColumn("adjusted_reward")) && (
                                <>
                                  <TableHead
                                    className={cn(
                                      "text-center",
                                      isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                    )}
                                  >
                                    Total Adjusted Reward
                                  </TableHead>
                                  {dualAdjustCpmForModal && (
                                    <TableHead
                                      className={cn(
                                        "text-center",
                                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                      )}
                                    >
                                      Adjusted Reward (CPM)
                                    </TableHead>
                                  )}
                                  {dualAdjustMilestoneForModal && (
                                    <TableHead
                                      className={cn(
                                        "text-center",
                                        isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                      )}
                                    >
                                      Adjusted Reward (Milestone)
                                    </TableHead>
                                  )}
                                </>
                              )}
                          </>
                        )}
                        {(contest?.contest_type === "milestone" ||
                          contest?.contest_type === "dual_rewards") && (
                          <TableHead
                            className={cn(
                              "text-center min-w-[170px]",
                              isDark ? "bg-[#391A6A] " : "bg-gray-50",
                            )}
                          >
                            Milestone
                          </TableHead>
                        )}
                        {(!isYouTubeContest ||
                          showYtColumn("reward_granted")) && (
                          <>
                            <TableHead
                              className={cn(
                                "text-center",
                                isDark ? "bg-[#391A6A] " : "bg-gray-50",
                              )}
                            >
                              {contest?.contest_type === "dual_rewards"
                                ? "Total Reward Granted"
                                : "Reward Granted"}
                            </TableHead>
                            {contest?.contest_type === "dual_rewards" && (
                              <>
                                <TableHead
                                  className={cn(
                                    "text-center",
                                    isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                  )}
                                >
                                  Reward Granted (CPM)
                                </TableHead>
                                <TableHead
                                  className={cn(
                                    "text-center",
                                    isDark ? "bg-[#391A6A] " : "bg-gray-50",
                                  )}
                                >
                                  Reward Granted (Milestone)
                                </TableHead>
                              </>
                            )}
                          </>
                        )}
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
                      (!isYouTubeContest || showYtColumn("insights_status")) &&
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
                    {(!isYouTubeContest || showYtColumn("status")) && (
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50",
                        )}
                      >
                        Status
                      </TableHead>
                    )}
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
                    {(!isYouTubeContest || showYtColumn("submitted")) && (
                      <TableHead
                        className={cn(
                          "min-w-[180px]",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50",
                        )}
                      >
                        Submitted
                      </TableHead>
                    )}
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
                          (showSelectionCheckboxes ? 0 : -1) +
                          (isTwitterTextImageContest
                            ? 18 + // Checkbox, #, Tweet, Total Points, Base Points, Manual Points, Likes, Replies, Retweets, Quote Reposts, Impressions, Expected Reward, Reward Granted, Manual Points Reason, Status, Rejection reason, Submitted, Actions
                              (contest?.contest_type === "dual_rewards"
                                ? 4
                                : 0) + // Dual: Expected/Granted CPM + Milestone
                              (showDualPayoutAdjBreakdownColumns &&
                              (!isYouTubeContest ||
                                showYtColumn("adjusted_reward"))
                                ? dualPayoutAdjModalBreakdownColumnCount
                                : 0) +
                              (contest?.contest_type === "milestone" ||
                              contest?.contest_type === "dual_rewards"
                                ? 1
                                : 0) // Milestone column
                            : 3 + // Checkbox, #, Content
                              3 + // Views, Likes, Comments
                              (isInstagramContest || isTikTokContest
                                ? isTikTokContest
                                  ? 3
                                  : 6
                                : 0) + // TT: Shares + total engagement + engagement rate; IG: +Saves, Reach, Interactions, Avg/Total watch
                              2 + // Expected Reward, Reward Granted
                              (contest?.contest_type === "dual_rewards"
                                ? 4
                                : 0) + // Dual: Expected/Granted CPM + Milestone
                              (showDualPayoutAdjBreakdownColumns &&
                              (!isYouTubeContest ||
                                showYtColumn("adjusted_reward"))
                                ? dualPayoutAdjModalBreakdownColumnCount
                                : 0) +
                              (contest?.contest_type === "milestone" ||
                              contest?.contest_type === "dual_rewards"
                                ? 1
                                : 0) + // Milestone
                              (hasFlatFeeBonus ? 2 : 0) + // Bonus Expected, Bonus Granted
                              (isVideoContest ? 1 : 0) + // Quality Score
                              (isAdminView &&
                              (isInstagramContest ||
                                isTikTokContest ||
                                isYouTubeContest)
                                ? 1
                                : 0) + // Insights status (admin only)
                              4) // Status, Rejection reason, Submitted, Actions
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
                      const youtubeStats =
                        (submission.other_stats as any)?.youtube || {};
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
                      const ytDislikes = Number(youtubeStats.dislikes ?? 0);
                      const ytShares = Number(youtubeStats.shares ?? 0);
                      const ytAvgViewPct = Number(
                        youtubeStats.avg_view_percentage ?? 0,
                      );
                      const ytWatchTimeMinutes = Number(
                        youtubeStats.estimated_minutes_watched ?? 0,
                      );
                      const ytAvgDurationSeconds = Number(
                        youtubeStats.avg_view_duration_seconds ?? 0,
                      );
                      const ytClipDurationSeconds = Number(
                        youtubeStats.duration_seconds ?? 0,
                      );
                      const igReelDurationSeconds = Number(
                        (platformStats as any)?.duration_seconds ?? 0,
                      );
                      const ytEngagedViews = Number(
                        youtubeStats.engaged_views ?? 0,
                      );
                      const ytSubsGained = Number(
                        youtubeStats.subscribers_gained ?? 0,
                      );

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
                      const expectedRewardForDisplay = expectedReward;

                      const milestoneUncappedForDual =
                        contest?.contest_type === "dual_rewards"
                          ? Math.max(
                              Number(
                                milestoneExpectedPayoutBySubmissionId?.get(
                                  submission.id,
                                ) || 0,
                              ),
                              0,
                            )
                          : 0;
                      const milestoneExpectedForDual =
                        contest?.contest_type === "dual_rewards"
                          ? Math.max(
                              Number(
                                dualAndCpmCapMaps.dualMilestoneCappedMap.get(
                                  submission.id,
                                ) || 0,
                              ),
                              0,
                            )
                          : 0;
                      const cpmExpectedForDual =
                        contest?.contest_type === "dual_rewards"
                          ? Math.max(
                              calculateSubmissionCpmExpectedReward(submission),
                              0,
                            )
                          : 0;
                      const adjustedCpmExpectedForDual = dualAdjustCpmForModal
                        ? applyPayoutAdjustment(
                            cpmExpectedForDual,
                            payoutAdjustmentPercentage,
                          )
                        : cpmExpectedForDual;
                      const adjustedMilestoneExpectedForDual =
                        dualAdjustMilestoneForModal
                          ? applyPayoutAdjustment(
                              milestoneExpectedForDual,
                              payoutAdjustmentPercentage,
                            )
                          : milestoneExpectedForDual;
                      const totalExpectedForDual =
                        contest?.contest_type === "dual_rewards"
                          ? adjustedCpmExpectedForDual +
                            adjustedMilestoneExpectedForDual
                          : 0;
                      const rawCpmUncappedForDual =
                        contest?.contest_type === "dual_rewards"
                          ? calculateRawSubmissionCpmExpectedReward(submission)
                          : 0;
                      const uncappedCpmAdjustedForDualTooltip =
                        contest?.contest_type === "dual_rewards"
                          ? dualAdjustCpmForModal
                            ? applyPayoutAdjustment(
                                rawCpmUncappedForDual,
                                payoutAdjustmentPercentage,
                              )
                            : rawCpmUncappedForDual
                          : 0;
                      const detailsForCap = contest?.contest_based_details as any;
                      const activeCreatorCapCents = Number(
                        (contest as any)?.max_earnings_per_creator ??
                          detailsForCap?.cpm_contest?.max_earnings_per_creator ??
                          (contest?.contest_type === "leaderboard"
                            ? detailsForCap?.leaderboard_contest
                                ?.max_earnings_per_creator
                            : 0) ??
                          0,
                      );
                      const dualCreatorCapWarning =
                        contest?.contest_type === "dual_rewards" &&
                        activeCreatorCapCents > 0 &&
                        cpmExpectedForDual + milestoneExpectedForDual <
                          rawCpmUncappedForDual + milestoneUncappedForDual;
                      const uncappedTotalForDualTooltip =
                        contest?.contest_type === "dual_rewards"
                          ? uncappedCpmAdjustedForDualTooltip +
                            (dualAdjustMilestoneForModal
                              ? applyPayoutAdjustment(
                                  milestoneUncappedForDual,
                                  payoutAdjustmentPercentage,
                                )
                              : milestoneUncappedForDual)
                          : 0;
                      const uncappedMilestoneAdjustedForDualTooltip =
                        contest?.contest_type === "dual_rewards"
                          ? dualAdjustMilestoneForModal
                            ? applyPayoutAdjustment(
                                milestoneUncappedForDual,
                                payoutAdjustmentPercentage,
                              )
                            : milestoneUncappedForDual
                          : 0;
                      const dualMilestoneCapWarning =
                        contest?.contest_type === "dual_rewards" &&
                        activeCreatorCapCents > 0 &&
                        milestoneUncappedForDual > 0 &&
                        milestoneExpectedForDual < milestoneUncappedForDual;

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
                          : submission.earnings && submission.earnings > 0
                            ? submission.earnings
                            : contest?.contest_type === "milestone"
                              ? shouldAdjustReward
                                ? adjustedExpectedReward
                                : expectedReward
                              : expectedReward
                        : 0;
                      const isDualPaid =
                        contest?.contest_type === "dual_rewards" &&
                        isPaidForGranted;
                      const dualScope = getDualPayoutScopeFromSubmission(
                        submission as any,
                        isPaidForGranted && grantedReward > 0
                          ? {
                              paidTotalCents: grantedReward,
                              cpmExpectedCents: adjustedCpmExpectedForDual,
                              milestoneExpectedCents:
                                adjustedMilestoneExpectedForDual,
                            }
                          : undefined,
                      );
                      const dualPaidComponent = dualScope ?? "";
                      const totalGrantedForDual =
                        contest?.contest_type === "dual_rewards"
                          ? grantedReward
                          : 0;
                      let milestoneGrantedForDual = 0;
                      let cpmGrantedForDual = 0;
                      if (contest?.contest_type === "dual_rewards") {
                        const fromStoredPayout =
                          tryDualRewardGrantedBreakdownFromStoredPayout(
                            submission as any,
                          );
                        if (fromStoredPayout) {
                          cpmGrantedForDual = fromStoredPayout.cpmCents;
                          milestoneGrantedForDual =
                            fromStoredPayout.milestoneCents;
                        } else if (dualPaidComponent === "milestone") {
                          milestoneGrantedForDual = getMilestoneLadderGrantedCentsFromSubmission(
                            submission as any,
                          );
                        } else if (dualPaidComponent === "cpm") {
                          cpmGrantedForDual = getCpmGrantedCentsFromSubmission(
                            submission as any,
                          );
                        } else if (
                          dualPaidComponent === "both" ||
                          (isDualPaid && !dualPaidComponent)
                        ) {
                          const paidTotalExMv =
                            excludeMostVerifiedBonusFromPaidTotalCents(
                              totalGrantedForDual,
                              submission as any,
                            );
                          const sp = splitDualPaidTotalByExpectedWeights(
                            paidTotalExMv,
                            adjustedCpmExpectedForDual,
                            adjustedMilestoneExpectedForDual,
                            {
                              cpmUncappedCents: rawCpmUncappedForDual,
                              milestoneUncappedCents: milestoneUncappedForDual,
                            },
                          );
                          cpmGrantedForDual = sp.cpmCents;
                          milestoneGrantedForDual = sp.milestoneCents;
                        }
                      }
                      const uncappedExpectedReward =
                        calculateSubmissionBaseExpectedReward(
                          submission,
                          false,
                        );
                      const uncappedExpectedRewardAdjusted = shouldAdjustReward
                        ? applyPayoutAdjustment(
                            uncappedExpectedReward,
                            payoutAdjustmentPercentage,
                          )
                        : uncappedExpectedReward;
                      const isCappedToZeroWithPotential =
                        expectedReward === 0 &&
                        uncappedExpectedRewardAdjusted > 0;
                      const expectedBonus =
                        expectedBonusMap.get(submission.id) || 0;
                      const adjustedExpectedBonus = shouldAdjustBonus
                        ? applyPayoutAdjustment(
                            expectedBonus,
                            payoutAdjustmentPercentage,
                          )
                        : expectedBonus;
                      // Use actual bonus_amount from database if available.
                      // Twitter CPM: only count granted bonus when tweet is paid.
                      const grantedBonus =
                        submission.bonus_paid &&
                        (contest?.contest_type !== "cpm" ||
                          !isTwitterTweet ||
                          statusForGranted === "paid")
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
                        contest?.contest_type === "milestone" ||
                        contest?.contest_type === "dual_rewards"
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
                          {showSelectionCheckboxes && (
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
                          )}
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
                                {contest?.contest_type === "dual_rewards"
                                  ? formatCurrency(
                                      cpmExpectedForDual +
                                        milestoneExpectedForDual,
                                    )
                                  : formatCurrency(expectedRewardForDisplay)}
                              </TableCell>
                              {hasPayoutAdjustment &&
                                shouldAdjustReward &&
                                (!isYouTubeContest ||
                                  showYtColumn("adjusted_reward")) &&
                                (!isDualRewardsContest ||
                                  !showDualPayoutAdjBreakdownColumns) && (
                                  <TableCell className="text-center font-medium text-sm">
                                    {formatCurrency(adjustedExpectedReward)}
                                  </TableCell>
                                )}
                              {contest?.contest_type === "dual_rewards" && (
                                <>
                                  <TableCell className="text-center font-medium text-sm">
                                    <div className="inline-flex items-center justify-center gap-1 flex-wrap">
                                      <span>
                                        {formatCurrency(cpmExpectedForDual)}
                                      </span>
                                      {dualCreatorCapWarning && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-[260px] text-left whitespace-pre-line">
                                            Creator cap exhausted for expected
                                            payout order.
                                            {"\n"}
                                            {totalGrantedForDual > 0 ? (
                                              <>
                                                Actual granted amount:{" "}
                                                {formatCurrency(
                                                  totalGrantedForDual,
                                                )}
                                              </>
                                            ) : (
                                              <>
                                                Else expected total would be:{" "}
                                                {formatCurrency(
                                                  uncappedTotalForDualTooltip,
                                                )}
                                              </>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-medium text-sm">
                                    <div className="inline-flex items-center justify-center gap-1 flex-wrap">
                                      <span>
                                        {formatCurrency(
                                          milestoneExpectedForDual,
                                        )}
                                      </span>
                                      {dualMilestoneCapWarning && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-[260px] text-left whitespace-pre-line">
                                            Creator cap exhausted for expected
                                            payout order.
                                            {"\n"}
                                            {milestoneGrantedForDual > 0 ? (
                                              <>
                                                Actual granted milestone:{" "}
                                                {formatCurrency(
                                                  milestoneGrantedForDual,
                                                )}
                                              </>
                                            ) : (
                                              <>
                                                Else expected milestone would
                                                be:{" "}
                                                {formatCurrency(
                                                  uncappedMilestoneAdjustedForDualTooltip,
                                                )}
                                              </>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </TableCell>
                                  {showDualPayoutAdjBreakdownColumns &&
                                    (!isYouTubeContest ||
                                      showYtColumn("adjusted_reward")) && (
                                      <>
                                        <TableCell className="text-center font-medium text-sm">
                                          {formatCurrency(
                                            adjustedCpmExpectedForDual +
                                              adjustedMilestoneExpectedForDual,
                                          )}
                                        </TableCell>
                                        {dualAdjustCpmForModal && (
                                          <TableCell className="text-center font-medium text-sm">
                                            {formatCurrency(
                                              adjustedCpmExpectedForDual,
                                            )}
                                          </TableCell>
                                        )}
                                        {dualAdjustMilestoneForModal && (
                                          <TableCell className="text-center font-medium text-sm">
                                            {formatCurrency(
                                              adjustedMilestoneExpectedForDual,
                                            )}
                                          </TableCell>
                                        )}
                                      </>
                                    )}
                                </>
                              )}
                              {(contest?.contest_type === "milestone" ||
                                contest?.contest_type === "dual_rewards") && (
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
                                {(contest?.contest_type === "dual_rewards"
                                  ? totalGrantedForDual
                                  : grantedReward) > 0
                                  ? formatCurrency(
                                      contest?.contest_type === "dual_rewards"
                                        ? totalGrantedForDual
                                        : grantedReward,
                                    )
                                  : "-"}
                              </TableCell>
                              {contest?.contest_type === "dual_rewards" && (
                                <>
                                  <TableCell className="text-center font-medium text-green-600">
                                    {cpmGrantedForDual > 0
                                      ? formatCurrency(cpmGrantedForDual)
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="text-center font-medium text-green-600">
                                    {milestoneGrantedForDual > 0
                                      ? formatCurrency(milestoneGrantedForDual)
                                      : "-"}
                                  </TableCell>
                                </>
                              )}
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
                                          href={getSubmissionContentViewHref(
                                            submission,
                                          )}
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
                              {(!isYouTubeContest || showYtColumn("views")) && (
                                <TableCell className="text-center font-mono">
                                  {(isTikTokContest && !isTwitterTweet
                                    ? effectiveTikTokSubmissionViews(submission)
                                    : Number(submission.views ?? 0)
                                  ).toLocaleString()}
                                </TableCell>
                              )}
                              {(!isYouTubeContest || showYtColumn("likes")) && (
                                <TableCell className="text-center font-mono">
                                  {likes.toLocaleString()}
                                </TableCell>
                              )}
                              {(!isYouTubeContest ||
                                showYtColumn("comments")) && (
                                <TableCell className="text-center font-mono">
                                  {comments.toLocaleString()}
                                </TableCell>
                              )}
                              {/* YouTube-specific metrics for non-Twitter submissions */}
                              {isYouTubeContest && showYtColumn("dislikes") && (
                                <TableCell className="text-center font-mono">
                                  {formatMetricValue(ytDislikes)}
                                </TableCell>
                              )}
                              {isYouTubeContest && showYtColumn("shares") && (
                                <TableCell className="text-center font-mono">
                                  {ytShares > 0
                                    ? formatMetricValue(ytShares)
                                    : "—"}
                                </TableCell>
                              )}
                              {isYouTubeContest &&
                                showYtColumn("avg_view_pct") && (
                                  <TableCell className="text-center font-mono">
                                    {ytAvgViewPct > 0
                                      ? `${ytAvgViewPct.toFixed(1)}%`
                                      : "—"}
                                  </TableCell>
                                )}
                              {isYouTubeContest &&
                                showYtColumn("watch_time") && (
                                  <TableCell className="text-center font-mono">
                                    {ytWatchTimeMinutes > 0
                                      ? formatWatchTime(
                                          ytWatchTimeMinutes * 60 * 1000,
                                        )
                                      : "—"}
                                  </TableCell>
                                )}
                              {isYouTubeContest &&
                                showYtColumn("avg_duration") && (
                                  <TableCell className="text-center font-mono">
                                    {ytAvgDurationSeconds > 0
                                      ? `${ytAvgDurationSeconds}s`
                                      : "—"}
                                  </TableCell>
                                )}
                              {isYouTubeContest &&
                                showYtColumn("clip_duration") && (
                                  <TableCell className="text-center font-mono">
                                    {formatClipDurationSeconds(
                                      ytClipDurationSeconds > 0
                                        ? ytClipDurationSeconds
                                        : null,
                                    )}
                                  </TableCell>
                                )}
                              {isYouTubeContest &&
                                showYtColumn("engaged_views") && (
                                  <TableCell className="text-center font-mono">
                                    {ytEngagedViews > 0
                                      ? formatMetricValue(ytEngagedViews)
                                      : "—"}
                                  </TableCell>
                                )}
                              {isYouTubeContest &&
                                showYtColumn("subs_gained") && (
                                  <TableCell className="text-center font-mono text-sm">
                                    {youtubeStats.subscribers_gained != null ? (
                                      <span
                                        className={cn(
                                          "font-bold",
                                          Number(
                                            youtubeStats.subscribers_gained,
                                          ) > 0
                                            ? "text-green-600"
                                            : isDark
                                              ? "text-slate-400"
                                              : "text-slate-600",
                                        )}
                                      >
                                        {Number(
                                          youtubeStats.subscribers_gained,
                                        ) > 0
                                          ? "+"
                                          : ""}
                                        {youtubeStats.subscribers_gained}
                                      </span>
                                    ) : (
                                      <span
                                        className={cn(
                                          "text-xs",
                                          isDark
                                            ? "text-slate-500"
                                            : "text-slate-400",
                                        )}
                                      >
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                )}
                              {isYouTubeContest &&
                                showYtColumn("bot_score") && (
                                  <TableCell className="text-center">
                                    {youtubeStats.bot_score !== null &&
                                    youtubeStats.bot_score !== undefined ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span
                                          className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border",
                                            Number(youtubeStats.bot_score) >= 60
                                              ? "bg-red-100 text-red-700 border-red-300"
                                              : Number(
                                                    youtubeStats.bot_score,
                                                  ) >= 30
                                                ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                                                : "bg-green-100 text-green-600 border-green-300",
                                          )}
                                          title={
                                            Array.isArray(
                                              youtubeStats.bot_flags,
                                            )
                                              ? youtubeStats.bot_flags.join(
                                                  "\n",
                                                )
                                              : "No flags"
                                          }
                                        >
                                          {Number(youtubeStats.bot_score) >= 60
                                            ? "⚠ "
                                            : ""}
                                          {youtubeStats.bot_score}
                                          /100
                                        </span>
                                        {youtubeStats.bot_flags &&
                                          youtubeStats.bot_flags.length > 0 && (
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-slate-400"
                                                  : "text-slate-500",
                                              )}
                                            >
                                              {youtubeStats.bot_flags.length}{" "}
                                              flag
                                              {youtubeStats.bot_flags.length !==
                                              1
                                                ? "s"
                                                : ""}
                                            </span>
                                          )}
                                      </div>
                                    ) : (
                                      <span
                                        className={cn(
                                          "text-xs",
                                          isDark
                                            ? "text-slate-500"
                                            : "text-slate-400",
                                        )}
                                      >
                                        No data
                                      </span>
                                    )}
                                  </TableCell>
                                )}
                              {isYouTubeContest &&
                                showYtColumn("analytics") && (
                                  <TableCell className="text-center">
                                    <YouTubeAnalyticsPanel
                                      metrics={{
                                        views:
                                          youtubeStats.views ??
                                          submission.views ??
                                          0,
                                        likes: youtubeStats.likes ?? 0,
                                        dislikes: youtubeStats.dislikes ?? 0,
                                        comments: youtubeStats.comments ?? 0,
                                        shares: youtubeStats.shares ?? 0,
                                        subscribers_gained:
                                          youtubeStats.subscribers_gained ?? 0,
                                        subscribers_lost:
                                          youtubeStats.subscribers_lost ?? 0,
                                        videos_added_to_playlists:
                                          youtubeStats.videos_added_to_playlists ??
                                          0,
                                        videos_removed_from_playlists:
                                          youtubeStats.videos_removed_from_playlists ??
                                          0,
                                        estimated_minutes_watched:
                                          youtubeStats.estimated_minutes_watched ??
                                          0,
                                        avg_view_duration_seconds:
                                          youtubeStats.avg_view_duration_seconds ??
                                          0,
                                        avg_view_percentage:
                                          youtubeStats.avg_view_percentage ?? 0,
                                        engaged_views:
                                          youtubeStats.engaged_views ?? 0,
                                        traffic_sources:
                                          youtubeStats.traffic_sources ?? null,
                                        traffic_source_details:
                                          youtubeStats.traffic_source_details ??
                                          null,
                                        subscribed_status:
                                          youtubeStats.subscribed_status ?? null,
                                        demographics:
                                          youtubeStats.demographics ?? null,
                                        devices: youtubeStats.devices ?? null,
                                        audience_retention:
                                          youtubeStats.audience_retention ?? null,
                                        bot_score:
                                          youtubeStats.bot_score ?? null,
                                        bot_flags: youtubeStats.bot_flags ?? [],
                                        analytics_needs_reauth:
                                          youtubeStats.analytics_needs_reauth ??
                                          false,
                                        last_basic_update:
                                          youtubeStats.last_basic_update ??
                                          null,
                                        last_traffic_update:
                                          youtubeStats.last_traffic_update ??
                                          null,
                                        last_demographics_update:
                                          youtubeStats.last_demographics_update ??
                                          null,
                                      }}
                                      isDark={isDark}
                                      showCore={canSeeCore}
                                      showTraffic={canSeeTraffic}
                                      showDemographics={canSeeDemographics}
                                    >
                                      <button
                                        className={cn(
                                          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors",
                                          isDark
                                            ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                            : "bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700",
                                        )}
                                      >
                                        <BarChart2 className="h-3 w-3" />
                                        Details
                                      </button>
                                    </YouTubeAnalyticsPanel>
                                  </TableCell>
                                )}
                              {isYouTubeContest &&
                                showYtColumn("top_traffic_source") && (
                                  <TableCell className="text-center font-mono text-xs">
                                    {(() => {
                                      const ts =
                                        youtubeStats.traffic_sources as
                                          | Record<string, number>
                                          | undefined;
                                      if (!ts || Object.keys(ts).length === 0)
                                        return "—";
                                      const entries = Object.entries(ts);
                                      const top = entries.reduce(
                                        (best, [k, v]) =>
                                          v > best.pct
                                            ? { key: k, pct: v }
                                            : best,
                                        {
                                          key: entries[0][0],
                                          pct: entries[0][1],
                                        },
                                      );
                                      const label =
                                        YT_TRAFFIC_SOURCE_LABELS[top.key] ||
                                        top.key;
                                      return `${label} ${top.pct.toFixed(1)}%`;
                                    })()}
                                  </TableCell>
                                )}
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
                                      <TableCell className="text-center font-mono">
                                        {formatClipDurationSeconds(
                                          igReelDurationSeconds > 0
                                            ? igReelDurationSeconds
                                            : null,
                                        )}
                                      </TableCell>
                                    </>
                                  )}
                                </>
                              )}
                              {/* Expected Reward and Reward Granted (only for non-Twitter) */}
                              {!isTwitterTextImageContest && (
                                <>
                                  {isVideoContest && (
                                    <TableCell className="text-center">
                                      <SubmissionQualityScoreCell
                                        qualityScore={submission.quality_score}
                                        isDark={isDark}
                                      />
                                    </TableCell>
                                  )}
                                  {(!isYouTubeContest ||
                                    showYtColumn("expected_reward")) && (
                                    <TableCell className="text-center font-medium">
                                      {contest?.contest_type ===
                                      "dual_rewards" ? (
                                        <div className="inline-flex items-center justify-center gap-1 flex-wrap">
                                          <span>
                                            {formatCurrency(
                                              cpmExpectedForDual +
                                                milestoneExpectedForDual,
                                            )}
                                          </span>
                                          {dualCreatorCapWarning && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help shrink-0" />
                                              </TooltipTrigger>
                                              <TooltipContent className="max-w-[260px] text-left whitespace-pre-line">
                                                Creator cap exhausted for
                                                expected payout order.
                                                {"\n"}
                                                {totalGrantedForDual > 0 ? (
                                                  <>
                                                    Actual granted amount:{" "}
                                                    {formatCurrency(
                                                      totalGrantedForDual,
                                                    )}
                                                  </>
                                                ) : (
                                                  <>
                                                    Else expected total would
                                                    be:{" "}
                                                    {formatCurrency(
                                                      uncappedTotalForDualTooltip,
                                                    )}
                                                  </>
                                                )}
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </div>
                                      ) : isCappedToZeroWithPotential ? (
                                        <div className="inline-flex items-center gap-1">
                                          <span>{formatCurrency(0)}</span>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[260px] text-left">
                                              Creator cap exhausted for expected
                                              payout order.
                                              <br />
                                              {grantedReward > 0 ? (
                                                <>
                                                  Actual granted amount:{" "}
                                                  {formatCurrency(
                                                    grantedReward,
                                                  )}
                                                </>
                                              ) : (
                                                <>
                                                  Else expected reward would be:{" "}
                                                  {formatCurrency(
                                                    uncappedExpectedRewardAdjusted,
                                                  )}
                                                </>
                                              )}
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                      ) : (
                                        formatCurrency(expectedReward)
                                      )}
                                    </TableCell>
                                  )}
                                  {hasPayoutAdjustment &&
                                    shouldAdjustReward &&
                                    (!isYouTubeContest ||
                                      showYtColumn("adjusted_reward")) &&
                                    (!isDualRewardsContest ||
                                      !showDualPayoutAdjBreakdownColumns) && (
                                      <TableCell className="text-center font-medium">
                                        {isCappedToZeroWithPotential
                                          ? formatCurrency(0)
                                          : formatCurrency(
                                              adjustedExpectedReward,
                                            )}
                                      </TableCell>
                                    )}
                                  {contest?.contest_type === "dual_rewards" && (
                                    <>
                                      <TableCell className="text-center font-medium">
                                        <div className="inline-flex items-center justify-center gap-1 flex-wrap">
                                          <span>
                                            {formatCurrency(cpmExpectedForDual)}
                                          </span>
                                          {dualCreatorCapWarning && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help shrink-0" />
                                              </TooltipTrigger>
                                              <TooltipContent className="max-w-[260px] text-left whitespace-pre-line">
                                                Creator cap exhausted for
                                                expected payout order.
                                                {"\n"}
                                                {totalGrantedForDual > 0 ? (
                                                  <>
                                                    Actual granted amount:{" "}
                                                    {formatCurrency(
                                                      totalGrantedForDual,
                                                    )}
                                                  </>
                                                ) : (
                                                  <>
                                                    Else expected reward would
                                                    be:{" "}
                                                    {formatCurrency(
                                                      uncappedCpmAdjustedForDualTooltip,
                                                    )}
                                                  </>
                                                )}
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center font-medium">
                                        <div className="inline-flex items-center justify-center gap-1 flex-wrap">
                                          <span>
                                            {formatCurrency(
                                              milestoneExpectedForDual,
                                            )}
                                          </span>
                                          {dualMilestoneCapWarning && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help shrink-0" />
                                              </TooltipTrigger>
                                              <TooltipContent className="max-w-[260px] text-left whitespace-pre-line">
                                                Creator cap exhausted for
                                                expected payout order.
                                                {"\n"}
                                                {milestoneGrantedForDual > 0 ? (
                                                  <>
                                                    Actual granted milestone:{" "}
                                                    {formatCurrency(
                                                      milestoneGrantedForDual,
                                                    )}
                                                  </>
                                                ) : (
                                                  <>
                                                    Else expected milestone would
                                                    be:{" "}
                                                    {formatCurrency(
                                                      uncappedMilestoneAdjustedForDualTooltip,
                                                    )}
                                                  </>
                                                )}
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </div>
                                      </TableCell>
                                      {showDualPayoutAdjBreakdownColumns &&
                                        (!isYouTubeContest ||
                                          showYtColumn("adjusted_reward")) && (
                                          <>
                                            <TableCell className="text-center font-medium">
                                              {formatCurrency(
                                                adjustedCpmExpectedForDual +
                                                  adjustedMilestoneExpectedForDual,
                                              )}
                                            </TableCell>
                                            {dualAdjustCpmForModal && (
                                              <TableCell className="text-center font-medium">
                                                {formatCurrency(
                                                  adjustedCpmExpectedForDual,
                                                )}
                                              </TableCell>
                                            )}
                                            {dualAdjustMilestoneForModal && (
                                              <TableCell className="text-center font-medium">
                                                {formatCurrency(
                                                  adjustedMilestoneExpectedForDual,
                                                )}
                                              </TableCell>
                                            )}
                                          </>
                                        )}
                                    </>
                                  )}
                                  {(contest?.contest_type === "milestone" ||
                                    contest?.contest_type ===
                                      "dual_rewards") && (
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
                                  {(!isYouTubeContest ||
                                    showYtColumn("reward_granted")) && (
                                    <>
                                      <TableCell className="text-center font-medium text-green-600">
                                        {(contest?.contest_type ===
                                        "dual_rewards"
                                          ? totalGrantedForDual
                                          : grantedReward) > 0
                                          ? formatCurrency(
                                              contest?.contest_type ===
                                                "dual_rewards"
                                                ? totalGrantedForDual
                                                : grantedReward,
                                            )
                                          : "-"}
                                      </TableCell>
                                      {contest?.contest_type ===
                                        "dual_rewards" && (
                                        <>
                                          <TableCell className="text-center font-medium text-green-600">
                                            {cpmGrantedForDual > 0
                                              ? formatCurrency(
                                                  cpmGrantedForDual,
                                                )
                                              : "-"}
                                          </TableCell>
                                          <TableCell className="text-center font-medium text-green-600">
                                            {milestoneGrantedForDual > 0
                                              ? formatCurrency(
                                                  milestoneGrantedForDual,
                                                )
                                              : "-"}
                                          </TableCell>
                                        </>
                                      )}
                                    </>
                                  )}
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
                            (!isYouTubeContest ||
                              showYtColumn("insights_status")) &&
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
                          {(!isYouTubeContest || showYtColumn("status")) && (
                            <TableCell>
                              {getStatusBadge(
                                normalizedStatus,
                                submission.paid,
                              )}
                            </TableCell>
                          )}
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
                          {(!isYouTubeContest || showYtColumn("submitted")) && (
                            <TableCell
                              className={cn(
                                "text-sm",
                                isDark ? "text-gray-400" : "text-gray-600",
                              )}
                            >
                              {formatDate(submission.created_at)}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {showRowModerationActions(submission) && (
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
                                {showPaymentActions &&
                                  getNormalizedSubmissionStatus(submission) ===
                                    "verified" &&
                                  !submission.paid &&
                                  !isTwitterLeaderboardContest && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          isDualRewardsContest
                                            ? handleDualSubmissionPayment(
                                                submission,
                                                "cpm",
                                              )
                                            : onPayment(
                                                submission.id,
                                                "standard",
                                              )
                                        }
                                      >
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        {isDualRewardsContest
                                          ? "Mark as Paid (CPM)"
                                          : "Mark as Paid"}
                                      </DropdownMenuItem>
                                      {(hasFlatFeeBonus ||
                                        isDualRewardsContest) &&
                                        !submission.bonus_paid && (
                                          <>
                                            {(!isTwitterCpmContest ||
                                              isDualRewardsContest) && (
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  isDualRewardsContest
                                                    ? handleDualSubmissionPayment(
                                                        submission,
                                                        "milestone",
                                                      )
                                                    : onPayment(
                                                        submission.id,
                                                        "bonus",
                                                      )
                                                }
                                              >
                                                <DollarSign className="h-4 w-4 mr-2" />
                                                {isDualRewardsContest
                                                  ? "Mark as Paid (Milestone)"
                                                  : "Mark Bonus as Paid"}
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                              onClick={() =>
                                                isDualRewardsContest
                                                  ? handleDualSubmissionPayment(
                                                      submission,
                                                      "both",
                                                    )
                                                  : onPayment(
                                                      submission.id,
                                                      "both",
                                                    )
                                              }
                                            >
                                              <DollarSign className="h-4 w-4 mr-2" />
                                              {isDualRewardsContest
                                                ? "Mark Both as Paid (CPM+Milestone)"
                                                : "Mark Both as Paid"}
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                    </>
                                  )}

                                {showPaymentActions &&
                                  !isTwitterLeaderboardContest &&
                                  isTwitterCpmContest &&
                                  isTwitterTweet &&
                                  hasFlatFeeBonus &&
                                  !submission.bonus_paid &&
                                  isPaidForGranted && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          onPayment(submission.id, "bonus")
                                        }
                                      >
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Mark Bonus as Paid
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                {/* Non-Twitter contests: allow paying bonus
                                    after the standard reward has already been
                                    paid (mirrors Twitter CPM behavior above). */}
                                {showPaymentActions &&
                                  !isTwitterLeaderboardContest &&
                                  !isTwitterCpmContest &&
                                  !isTwitterTweet &&
                                  hasFlatFeeBonus &&
                                  !submission.bonus_paid &&
                                  submission.paid === true && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          onPayment(submission.id, "bonus")
                                        }
                                      >
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Mark Bonus as Paid
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                {showPaymentActions &&
                                  contest?.post_contest_status !==
                                    "payouts_processed" && (
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

                                {canEditQualityScore &&
                                  !isTwitterTweet &&
                                  (normalizedStatus === "verified" ||
                                    normalizedStatus === "paid") && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setQualityEditSubmissionIds([
                                            submission.id,
                                          ])
                                        }
                                      >
                                        <Star className="h-4 w-4 mr-2" />
                                        {parseQualityScore(
                                          submission.quality_score,
                                        ) !== null
                                          ? "Edit quality score"
                                          : "Set quality score"}
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                {submission.content_link && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                      <a
                                        href={getSubmissionContentViewHref(
                                          submission,
                                        )}
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

      <VerifyQualityDialog
        open={qualityEditSubmissionIds.length > 0}
        onOpenChange={(open) => {
          if (!open && !qualityEditLoading) {
            setQualityEditSubmissionIds([]);
          }
        }}
        variant="edit"
        submissionCount={qualityEditSubmissionIds.length}
        initialQuality={qualityEditInitialScore}
        onConfirm={handleSaveQualityScore}
        loading={qualityEditLoading}
      />
    </>
  );
}
