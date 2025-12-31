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
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Creator {
  id: string;
  username: string;
  profile_picture_url: string | null;
  full_name: string | null;
}

interface Submission {
  id: string;
  creator_id: string;
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
  bonus_amount: number | null;
  created_at: string;
  platform: string | null;
  other_stats: any;
  // Twitter-specific fields
  is_twitter_tweet?: boolean;
  moderation_status?: "pending" | "approved" | "rejected";
  manual_points_adjustment?: number;
  manual_points_reason?: string | null;
  tweet_id?: string;
}

interface CreatorSubmissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: Creator;
  submissions: Submission[];
  contest: any;
  onVerify: (submissionIds: string[]) => void;
  onReject: (submissionIds: string[]) => void;
  onSetPending: (submissionIds: string[]) => void;
  onPayment: (
    submissionId: string,
    type: "standard" | "bonus" | "both"
  ) => void;
  onCustomPayment: (submissionId: string) => void;
  isAdminView?: boolean;
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
}: CreatorSubmissionsModalProps) {
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(
    new Set()
  );
  const [selectAll, setSelectAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "verified_or_paid" | "pending" | "verified" | "rejected" | "paid"
  >("all");
  const [sortBy, setSortBy] = useState<
    "views-desc" | "views-asc" | "date-desc" | "date-asc"
  >("date-desc");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<
    string | null
  >(null);

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

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedSubmissions(new Set());
    } else {
      setSelectedSubmissions(new Set(submissions.map((s) => s.id)));
    }
    setSelectAll(!selectAll);
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
        `/api/admin/download-reel?submissionId=${submissionId}`
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
    setSelectAll(newSet.size === submissions.length);
  };

  const handleBulkAction = (action: "verify" | "reject" | "pending") => {
    const selectedIds = Array.from(selectedSubmissions);
    if (action === "verify") {
      onVerify(selectedIds);
    } else if (action === "reject") {
      onReject(selectedIds);
    } else {
      onSetPending(selectedIds);
    }
    setSelectedSubmissions(new Set());
    setSelectAll(false);
  };

  const handleBulkPayment = async (
    type: "standard" | "bonus" | "both",
    isBulkTransaction: boolean
  ) => {
    const selectedIds = Array.from(selectedSubmissions);

    // Get selected submissions
    const selectedSubs = submissions.filter((s) => selectedIds.includes(s.id));

    // Filter to verified submissions only
    const verifiedSubs = selectedSubs.filter((s) => s.status === "verified");

    if (verifiedSubs.length === 0) {
      alert(
        "No verified submissions selected. Only verified submissions can be paid."
      );
      return;
    }

    // Sort by submission time (earliest first)
    const sortedSubs = [...verifiedSubs].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    if (isBulkTransaction) {
      // OPTION 2: Bulk Transaction (Single API call)
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
          alert(`Bulk payment failed:\n${result.error || "Unknown error"}`);
          return;
        }

        // Show detailed success message
        const { data } = result;
        const message = [
          `✓ Bulk Payment Successful!`,
          ``,
          `Paid Submissions: ${data.paid_count}`,
          `Skipped (already paid): ${data.skipped_count}`,
          ``,
          `CPM Earnings: $${(data.total_cpm / 100).toFixed(2)}`,
          `Flat Fee Bonus: $${(data.total_bonus / 100).toFixed(2)}`,
          `Total Paid: $${(data.total_amount / 100).toFixed(2)}`,
        ];

        if (data.cap_reached) {
          message.push(``, `⚠️ Earnings cap reached!`);
          message.push(
            `Remaining cap: $${(data.remaining_cap / 100).toFixed(2)}`
          );
        }

        alert(message.join("\n"));

        // Refresh the page to show updated data
        window.location.reload();
      } catch (error) {
        console.error("Bulk payment error:", error);
        alert(
          `Bulk payment failed:\n${error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } else {
      // OPTION 1: Individual Transactions (Multiple API calls)
      let successCount = 0;
      let failCount = 0;

      // Pay each submission in order
      for (const sub of sortedSubs) {
        try {
          await onPayment(sub.id, type);
          successCount++;
        } catch (error) {
          console.error(`Failed to pay submission ${sub.id}:`, error);
          failCount++;
          // Continue with next submission even if one fails
        }
      }

      // Show summary
      if (failCount > 0) {
        alert(
          `Payment completed with errors:\n✓ ${successCount} submissions paid\n✗ ${failCount} submissions failed`
        );
      } else {
        alert(`✓ Successfully paid ${successCount} submissions!`);
      }
    }

    // Clear selection
    setSelectedSubmissions(new Set());
    setSelectAll(false);
  };

  const getStatusBadge = (status: string, paid: boolean, isTwitterTweet?: boolean) => {
    const statusLower = status.toLowerCase();

    if (paid && !isTwitterTweet) {
      return <Badge className="bg-green-600 text-white">Paid</Badge>;
    }

    // Handle Twitter moderation_status mapping
    if (isTwitterTweet) {
      if (statusLower === "approved") {
        return <Badge className="bg-green-500 text-white">Approved</Badge>;
      }
      if (statusLower === "rejected") {
        return <Badge className="bg-red-500 text-white">Rejected</Badge>;
      }
      // pending
      return <Badge className="bg-yellow-500 text-white">Pending</Badge>;
    }

    // Regular submission status
    switch (statusLower) {
      case "verified":
        return <Badge className="bg-green-500 text-white">Verified</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 text-white">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-500 text-white">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
  const hasBonus = flatFeeBonus > 0;

  // Check if this is a Twitter text_image contest
  const isTwitterTextImageContest =
    (contest?.platform?.toLowerCase() === "twitter" ||
      contest?.platform?.toLowerCase() === "x") &&
    contest?.contest_format === "text_image";

  // Filter submissions based on status
  // For Twitter tweets, use moderation_status; for others, use status
  const filteredSubmissions = submissions.filter((sub) => {
    const isTwitterTweet = sub.is_twitter_tweet === true;
    const statusToCheck = isTwitterTweet
      ? (sub.moderation_status || sub.status)
      : sub.status;

    // Map Twitter moderation_status to submission status for filtering
    let mappedStatus = statusToCheck;
    if (isTwitterTweet) {
      if (statusToCheck === "approved") mappedStatus = "verified";
      else if (statusToCheck === "rejected") mappedStatus = "rejected";
      else mappedStatus = "pending";
    }

    if (statusFilter === "all") return true;
    if (statusFilter === "verified_or_paid")
      return mappedStatus === "verified" || mappedStatus === "paid";
    if (statusFilter === "paid") return mappedStatus === "paid";
    if (statusFilter === "verified") return mappedStatus === "verified";
    if (statusFilter === "pending") return mappedStatus === "pending";
    if (statusFilter === "rejected") return mappedStatus === "rejected";
    return true;
  });

  // Sort submissions
  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    if (sortBy === "views-desc") return (b.views || 0) - (a.views || 0);
    if (sortBy === "views-asc") return (a.views || 0) - (b.views || 0);
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

  if (maxEarningsPerCreator && maxEarningsPerCreator > 0) {
    // Sort by created_at to apply cap in submission order
    const submissionsByTime = [...sortedSubmissions].sort((a, b) => {
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    let runningTotal = 0;

    submissionsByTime.forEach((sub) => {
      // Calculate base expected reward
      let baseExpectedReward = sub.earnings || 0;

      if (!baseExpectedReward && contest?.contest_type === "cpm") {
        const cpmConfig = (contest?.contest_based_details as any)?.cpm_contest;
        if (cpmConfig?.cpm_rate_usd) {
          let effectiveViews = sub.views || 0;

          if (
            cpmConfig.min_views != null &&
            effectiveViews < cpmConfig.min_views
          ) {
            effectiveViews = 0;
          }

          if (
            cpmConfig.max_views != null &&
            effectiveViews > cpmConfig.max_views
          ) {
            effectiveViews = cpmConfig.max_views;
          }

          const calculatedEarnings =
            (effectiveViews * cpmConfig.cpm_rate_usd * 100) / 1000;
          baseExpectedReward = Math.round(calculatedEarnings);
        }
      }

      // Apply cap
      const remainingCap = maxEarningsPerCreator - runningTotal;
      let cappedExpectedReward = baseExpectedReward;

      if (remainingCap <= 0) {
        cappedExpectedReward = 0;
      } else if (baseExpectedReward > remainingCap) {
        cappedExpectedReward = remainingCap;
      }

      expectedRewardsMap.set(sub.id, cappedExpectedReward);
      runningTotal += Math.min(baseExpectedReward, Math.max(0, remainingCap));
    });
  } else {
    // No cap - use base expected rewards
    sortedSubmissions.forEach((sub) => {
      let baseExpectedReward = sub.earnings || 0;

      if (!baseExpectedReward && contest?.contest_type === "cpm") {
        const cpmConfig = (contest?.contest_based_details as any)?.cpm_contest;
        if (cpmConfig?.cpm_rate_usd) {
          let effectiveViews = sub.views || 0;

          if (
            cpmConfig.min_views != null &&
            effectiveViews < cpmConfig.min_views
          ) {
            effectiveViews = 0;
          }

          if (
            cpmConfig.max_views != null &&
            effectiveViews > cpmConfig.max_views
          ) {
            effectiveViews = cpmConfig.max_views;
          }

          const calculatedEarnings =
            (effectiveViews * cpmConfig.cpm_rate_usd * 100) / 1000;
          baseExpectedReward = Math.round(calculatedEarnings);
        }
      }

      expectedRewardsMap.set(sub.id, baseExpectedReward);
    });
  }

  // Count submissions by status (handle Twitter tweets with moderation_status)
  const statusCounts = {
    all: submissions.length,
    verifiedOrPaid: submissions.filter((s) => {
      const isTwitterTweet = s.is_twitter_tweet === true;
      const status = isTwitterTweet
        ? (s.moderation_status === "approved" ? "verified" : s.status)
        : s.status;
      return status === "verified" || status === "paid";
    }).length,
    pending: submissions.filter((s) => {
      const isTwitterTweet = s.is_twitter_tweet === true;
      if (isTwitterTweet) {
        return (s.moderation_status || s.status) === "pending";
      }
      return s.status === "pending";
    }).length,
    verified: submissions.filter((s) => {
      const isTwitterTweet = s.is_twitter_tweet === true;
      if (isTwitterTweet) {
        return s.moderation_status === "approved";
      }
      return s.status === "verified";
    }).length,
    rejected: submissions.filter((s) => {
      const isTwitterTweet = s.is_twitter_tweet === true;
      if (isTwitterTweet) {
        return s.moderation_status === "rejected";
      }
      return s.status === "rejected";
    }).length,
    paid: submissions.filter((s) => s.status === "paid").length,
  };
  const isDark = mode === "dark";

  return (
    <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
      <DialogContent
        className="max-w-[98vw] max-h-[98vh] p-0 gap-0"
        hideCloseButton
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">
          {creator.username}'s Submissions
        </DialogTitle>
        <div className="flex flex-col h-[98vh] overflow-hidden">
          {/* Header */}
          <div
            className={cn(
              "flex items-center justify-between p-6 border-b flex-shrink-0",
              isDark
                ? "bg-[#170337] "
                : "bg-gradient-to-r from-purple-50 to-blue-50"
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
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  {creator.username}'s Submissions
                </h2>
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-gray-400" : "text-gray-600"
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
                isDark ? "text-white" : "text-gray-600 hover:bg-white/50"
              )}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* Status Filter Tabs */}
          <div
            className={cn(
              "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 border-b flex-shrink-0",
              isDark ? "bg-[#06021D] " : "bg-white"
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
                      : "text-gray-600"
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
                      : "text-gray-600"
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
                      : "text-gray-600"
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
                      : "text-gray-600"
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
                      : "text-gray-600"
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
                      : "text-gray-600"
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
                  isDark ? "text-gray-400" : "text-gray-600"
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
                      isDark ? "text-white border-gray-600" : "text-gray-600"
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
                isDark ? "bg-blue-900/20" : "bg-blue-50"
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={cn(
                    "font-medium",
                    isDark ? "text-blue-300" : "text-blue-900"
                  )}
                >
                  {selectedSubmissions.size} selected
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedSubmissions(new Set());
                    setSelectAll(false);
                  }}
                  className={cn(
                    "text-sm",
                    isDark ? "text-white" : "text-gray-600"
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
                          className={cn(
                            "whitespace-nowrap rounded-md",
                            isDark
                              ? "border bg-green-900/30 text-green-400 border-green-500"
                              : "bg-green-600 text-white hover:bg-green-700 "
                          )}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark as Verified
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleBulkAction("reject")}
                          className={cn(
                            "whitespace-nowrap rounded-md",
                            isDark
                              ? "border bg-red-900/30 text-red-400 border-red-500"
                              : "bg-red-600 text-white hover:bg-red-700 "
                          )}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Mark as Rejected
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleBulkAction("pending")}
                          className={cn(
                            "whitespace-nowrap rounded-md",
                            isDark
                              ? "border bg-yellow-900/30 text-yellow-400 border-yellow-500"
                              : "bg-yellow-600 text-white hover:bg-yellow-700 "
                          )}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Mark as Pending
                        </Button>
                      </>
                    )}
                  {contest?.post_contest_status === "verification_complete" &&
                    contest?.post_contest_status !== "payments_processed" &&
                    isAdminView && (
                      <>
                        <div className="border-l border-gray-300 dark:border-gray-600 h-6 mx-2"></div>
                        <Button
                          size="sm"
                          onClick={() => handleBulkPayment("standard", false)}
                          className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Mark as Paid
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleBulkPayment("standard", true)}
                          className="bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap"
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Mark as Paid (Bulk)
                        </Button>
                        {hasBonus && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleBulkPayment("bonus", false)}
                              className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Mark Bonus as Paid
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleBulkPayment("bonus", true)}
                              className="bg-green-500 hover:bg-green-600 text-white whitespace-nowrap"
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Mark Bonus as Paid (Bulk)
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleBulkPayment("both", false)}
                              className="bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap"
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Mark Both as Paid
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleBulkPayment("both", true)}
                              className="bg-purple-500 hover:bg-purple-600 text-white whitespace-nowrap"
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
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
          <div className="flex-1 overflow-auto px-6 py-4">
            <Table>
              <TableHeader
                className={cn(
                  "sticky top-0 z-20 shadow-sm",
                  isDark ? "bg-[#391A6A] text-white" : "bg-white text-gray-600"
                )}
              >
                <TableRow className="border-b-2">
                  <TableHead
                    className={cn(
                      "w-12",
                      isDark ? "bg-[#391A6A] " : "bg-gray-50"
                    )}
                  >
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all submissions"
                    />
                  </TableHead>
                  <TableHead
                    className={cn(
                      "w-12",
                      isDark ? "bg-[#391A6A] " : "bg-gray-50"
                    )}
                  >
                    #
                  </TableHead>
                  {/* For Twitter text_image contests, show Tweet column; for others, show Content */}
                  {isTwitterTextImageContest ? (
                    <TableHead
                      className={cn(
                        "min-w-[200px]",
                        isDark ? "bg-[#391A6A] " : "bg-gray-50"
                      )}
                    >
                      Tweet
                    </TableHead>
                  ) : (
                    <TableHead
                      className={cn(
                        "min-w-[200px]",
                        isDark ? "bg-[#391A6A] " : "bg-gray-50"
                      )}
                    >
                      Content
                    </TableHead>
                  )}
                  {/* For Twitter text_image contests, show detailed metrics; for others, show simplified */}
                  {isTwitterTextImageContest ? (
                    <>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Total Points
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Base Points
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Manual Points
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Likes
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Replies
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Retweets
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Quote Reposts
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Impressions
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
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
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Views
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Likes
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Comments
                      </TableHead>
                    </>
                  )}
                  {/* Hide reward columns for Twitter text_image contests */}
                  {!isTwitterTextImageContest && (
                    <>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Expected Reward
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Reward Granted
                      </TableHead>
                    </>
                  )}
                  {/* Bonus columns only for non-Twitter contests */}
                  {hasBonus && !isTwitterTextImageContest && (
                    <>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Bonus Expected
                      </TableHead>
                      <TableHead
                        className={cn(
                          "text-center",
                          isDark ? "bg-[#391A6A] " : "bg-gray-50"
                        )}
                      >
                        Bonus Granted
                      </TableHead>
                    </>
                  )}
                  <TableHead
                    className={cn(
                      "text-center",
                      isDark ? "bg-[#391A6A] " : "bg-gray-50"
                    )}
                  >
                    Status
                  </TableHead>
                  <TableHead
                    className={cn(
                      "min-w-[180px]",
                      isDark ? "bg-[#391A6A] " : "bg-gray-50"
                    )}
                  >
                    Submitted
                  </TableHead>
                  <TableHead
                    className={cn(
                      "text-center",
                      isDark ? "bg-[#391A6A] " : "bg-gray-50"
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
                          ? 15 // Checkbox, #, Tweet, Total Points, Base Points, Manual Points, Likes, Replies, Retweets, Quote Reposts, Impressions, Manual Points Reason, Status, Submitted, Actions
                          : hasBonus
                            ? 13 // Checkbox, #, Content, Views, Likes, Comments, Expected Reward, Reward Granted, Bonus Expected, Bonus Granted, Status, Submitted, Actions
                            : 11 // Checkbox, #, Content, Views, Likes, Comments, Expected Reward, Reward Granted, Status, Submitted, Actions
                      }
                      className={cn(
                        "text-center py-8",
                        isDark ? "text-gray-400" : "text-gray-600"
                      )}
                    >
                      No submissions found for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedSubmissions.map((submission, index) => {
                    const isTwitterTweet = submission.is_twitter_tweet === true;

                    // For Twitter tweets, use Twitter metrics; for others, use platform-specific
                    const likes = isTwitterTweet
                      ? submission.other_stats?.likes || 0
                      : submission.other_stats?.youtube?.likes ||
                      submission.other_stats?.instagram?.likes ||
                      0;
                    const comments = isTwitterTweet
                      ? submission.other_stats?.replies || 0
                      : submission.other_stats?.youtube?.comments ||
                      submission.other_stats?.instagram?.comments ||
                      0;

                    // Twitter-specific metrics
                    const retweets = submission.other_stats?.retweets || 0;
                    const quoteReposts = submission.other_stats?.quote_reposts || 0;
                    const impressions = submission.other_stats?.impressions || 0;
                    const basePoints = submission.other_stats?.base_points || submission.other_stats?.points || 0;
                    const manualPointsAdjustment = submission.manual_points_adjustment || 0;
                    const totalPoints = basePoints + manualPointsAdjustment;

                    // Get pre-calculated expected reward (with cap applied in submission time order)
                    // Note: Twitter tweets don't have rewards, so expectedReward will be 0
                    const expectedReward =
                      expectedRewardsMap.get(submission.id) || 0;

                    // Use ACTUAL earnings from database for granted reward (respects cap)
                    // Note: Twitter tweets don't have earnings/rewards
                    const grantedReward = submission.paid
                      ? submission.earnings || 0
                      : 0;
                    const expectedBonus =
                      (submission.status === "verified" ||
                        submission.status === "paid") &&
                        hasBonus &&
                        !isTwitterTweet // Twitter tweets don't have bonuses
                        ? flatFeeBonus
                        : 0;
                    // Use actual bonus_amount from database if available
                    const grantedBonus = submission.bonus_paid && !isTwitterTweet
                      ? (submission as any).bonus_amount || flatFeeBonus
                      : 0;

                    // For Twitter tweets, use moderation_status for status badge
                    const statusToUse = isTwitterTweet
                      ? (submission.moderation_status || submission.status)
                      : submission.status;

                    return (
                      <TableRow
                        key={submission.id}
                        className={cn(isDark ? "text-white" : "text-gray-700")}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedSubmissions.has(submission.id)}
                            onCheckedChange={(checked) =>
                              handleCheckboxChange(
                                submission.id,
                                checked as boolean
                              )
                            }
                            aria-label={`Select submission ${index + 1}`}
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "font-medium",
                            isDark ? "text-white" : "text-gray-700"
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
                                      (submission.other_stats?.tweet_type === "reply" ||
                                        submission.other_stats?.tweet_type === "quote" ||
                                        submission.other_stats?.tweet_type === "retweet")
                                        ? "bg-purple-100 text-purple-700 border-purple-300"
                                        : "bg-blue-100 text-blue-700 border-blue-300"
                                    )}
                                  >
                                    {submission.other_stats?.tweet_type === "reply"
                                      ? "REPLY"
                                      : submission.other_stats?.tweet_type === "quote"
                                        ? "QUOTE"
                                        : submission.other_stats?.tweet_type === "retweet"
                                          ? "RETWEET"
                                          : "TWEET"}
                                  </Badge>
                                  <span
                                    className={cn(
                                      "text-xs",
                                      isDark ? "text-gray-400" : "text-gray-500"
                                    )}
                                  >
                                    from @{creator.username}
                                  </span>
                                </div>
                                {/* Tweet text */}
                                <p
                                  className={cn(
                                    "text-sm line-clamp-3",
                                    isDark ? "text-white" : "text-gray-900"
                                  )}
                                  title={submission.other_stats?.tweet_text || submission.video_title || ""}
                                >
                                  {submission.other_stats?.tweet_text || submission.video_title || "No content"}
                                </p>
                                {/* View tweet link */}
                                {submission.content_link && (
                                  <a
                                    href={submission.content_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "text-xs flex items-center gap-1 hover:underline w-fit",
                                      isDark ? "text-purple-400" : "text-purple-600"
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
                                    isDark ? "text-white" : "text-gray-900"
                                  )}
                                >
                                  {totalPoints}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-400" : "text-gray-500"
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
                                    isDark ? "text-white" : "text-gray-900"
                                  )}
                                >
                                  {basePoints}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-400" : "text-gray-500"
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
                                          : "text-gray-900"
                                  )}
                                >
                                  {manualPointsAdjustment > 0 ? "+" : ""}
                                  {manualPointsAdjustment}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-400" : "text-gray-500"
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
                                      isDark ? "text-white" : "text-gray-900"
                                    )}
                                  >
                                    {likes.toLocaleString()}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-400" : "text-gray-500"
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
                                      isDark ? "text-white" : "text-gray-900"
                                    )}
                                  >
                                    {comments.toLocaleString()}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-400" : "text-gray-500"
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
                                    isDark ? "text-white" : "text-gray-900"
                                  )}
                                >
                                  {retweets.toLocaleString()}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-400" : "text-gray-500"
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
                                    isDark ? "text-white" : "text-gray-900"
                                  )}
                                >
                                  {quoteReposts.toLocaleString()}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-400" : "text-gray-500"
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
                                      isDark ? "text-white" : "text-gray-900"
                                    )}
                                  >
                                    {impressions.toLocaleString()}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-400" : "text-gray-500"
                                  )}
                                >
                                  impressions
                                </span>
                              </div>
                            </TableCell>
                            {/* Manual Points Reason */}
                            <TableCell className="text-center">
                              {submission.manual_points_reason ? (
                                <span
                                  className={cn(
                                    "text-xs italic truncate max-w-[150px] block",
                                    isDark ? "text-gray-400" : "text-gray-600"
                                  )}
                                  title={submission.manual_points_reason}
                                >
                                  {submission.manual_points_reason.length > 20
                                    ? submission.manual_points_reason.substring(0, 20) + "..."
                                    : submission.manual_points_reason}
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-500" : "text-gray-400"
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
                                      submission.video_title || "Video thumbnail"
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
                                            "opacity-50 cursor-not-allowed"
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
                              {submission.views?.toLocaleString() || 0}
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {likes.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {comments.toLocaleString()}
                            </TableCell>
                            {/* Expected Reward and Reward Granted (only for non-Twitter) */}
                            {!isTwitterTextImageContest && (
                              <>
                                <TableCell className="text-center font-medium">
                                  {formatCurrency(expectedReward)}
                                </TableCell>
                                <TableCell className="text-center font-medium text-green-600">
                                  {grantedReward > 0
                                    ? formatCurrency(grantedReward)
                                    : "-"}
                                </TableCell>
                              </>
                            )}
                          </>
                        )}
                        {/* Bonus columns only for non-Twitter submissions */}
                        {hasBonus && !isTwitterTextImageContest && (
                          <>
                            <TableCell className="text-center font-medium">
                              {expectedBonus > 0
                                ? formatCurrency(expectedBonus)
                                : "-"}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-center font-medium text-green-600",
                                isDark ? "text-white" : "text-gray-700"
                              )}
                            >
                              {grantedBonus > 0
                                ? formatCurrency(grantedBonus)
                                : "-"}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          {getStatusBadge(statusToUse, submission.paid, isTwitterTweet)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-400" : "text-gray-600"
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
                                    {(isTwitterTweet
                                      ? submission.moderation_status !== "approved"
                                      : submission.status !== "verified") && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            onVerify([submission.id])
                                          }
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          {isTwitterTweet ? "Approve" : "Verify"}
                                        </DropdownMenuItem>
                                      )}
                                    {(isTwitterTweet
                                      ? submission.moderation_status !== "rejected"
                                      : submission.status !== "rejected") && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            onReject([submission.id])
                                          }
                                        >
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Reject
                                        </DropdownMenuItem>
                                      )}
                                    {(isTwitterTweet
                                      ? submission.moderation_status !== "pending"
                                      : submission.status !== "pending") && (
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

                              {/* Payment options only for non-Twitter submissions */}
                              {contest?.post_contest_status ===
                                "verification_complete" &&
                                !isTwitterTweet &&
                                submission.status === "verified" &&
                                !submission.paid &&
                                isAdminView && (
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
                                    {hasBonus && !submission.bonus_paid && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            onPayment(submission.id, "bonus")
                                          }
                                        >
                                          <DollarSign className="h-4 w-4 mr-2" />
                                          Mark Bonus as Paid
                                        </DropdownMenuItem>
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
                                    {hasBonus &&
                                      !submission.bonus_paid &&
                                      submission.paid && (
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
                                  {isAdminView && (
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
  );
}
