"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatLocalDateTime, cn } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Calendar,
  Building,
  AlertTriangle,
  FileText,
  Trophy,
  Users,
  DollarSign,
  ExternalLink,
  PlayCircle,
  StopCircle,
  CheckCheck,
  Gift,
  Tag,
  Star,
  Inbox,
} from "lucide-react";

interface Contest {
  id: string;
  title: string;
  platform: string;
  contest_type: string;
  moderation_status: string;
  status: string;
  created_at: string;
  submitted_for_approval_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  published_at: string | null;
  rejection_reason: string | null;
  thumbnail_url: string | null;
  brief_html: string | null;
  start_date: string | null;
  end_date: string | null;
  advertiser_name: string;
  advertiser_id: string;
  contest_based_details: any;
  // New feature fields
  multiple_submissions_enabled?: boolean;
  max_submissions_per_creator?: number;
  content_type?: string;
  bonus_details?: {
    description_html?: string;
  };
}

const moderationStatusConfig = {
  pending_approval: {
    label: "Pending Approval",
    color: "bg-yellow-500",
    icon: Clock,
    description: "Awaiting admin review",
  },
  approved: {
    label: "Approved",
    color: "bg-blue-500",
    icon: CheckCircle,
    description: "Approved and ready to publish",
  },
  published: {
    label: "Published",
    color: "bg-green-500",
    icon: Eye,
    description: "Live on platform",
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-500",
    icon: XCircle,
    description: "Rejected and needs revision",
  },
  draft: {
    label: "Draft",
    color: "bg-gray-500",
    icon: FileText,
    description: "Still being created by brand",
  },
};

const contestStatusConfig = {
  upcoming: { label: "Upcoming", color: "bg-purple-500", icon: Calendar },
  active: { label: "Active", color: "bg-green-600", icon: PlayCircle },
  ended: { label: "Ended", color: "bg-gray-600", icon: StopCircle },
};

interface ContestModerationClientProps {
  initialContests?: Contest[];
  initialStatus?: string;
  hasInitialData?: boolean; // Flag to indicate if server provided initial data
}

export default function ContestModerationClient({
  initialContests = [],
  initialStatus = "pending_approval",
  hasInitialData = false,
}: ContestModerationClientProps) {
  // Memoize whether we have valid initial data
  const hasValidInitialData = hasInitialData && initialContests.length > 0;

  // Helper function to calculate counts from contests array
  const calculateCounts = (contestsList: Contest[]) => {
    return {
      pending_approval: contestsList.filter(
        (c) => c.moderation_status === "pending_approval"
      ).length,
      approved: contestsList.filter(
        (c) => c.moderation_status === "approved"
      ).length,
      published: contestsList.filter(
        (c) => c.moderation_status === "published"
      ).length,
      rejected: contestsList.filter(
        (c) => c.moderation_status === "rejected"
      ).length,
      all: contestsList.length,
    };
  };

  const [contests, setContests] = useState<Contest[]>(initialContests);
  const [hasInitialized, setHasInitialized] = useState(hasValidInitialData);
  const [loading, setLoading] = useState(!hasValidInitialData);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingAction, setProcessingAction] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(9);
  const { toast } = useToast();

  // Separate state for counts to persist across tab switches
  const [contestCounts, setContestCounts] = useState(() =>
    calculateCounts(initialContests)
  );

  // Use refs to track state without causing re-renders
  const hasFetchedInitialRef = useRef(!hasValidInitialData);
  const isInitialStatusRef = useRef(true);

  // Get theme from parent layout
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      // Check data-mode attribute from parent layout
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode");
        return dataMode === "dark";
      }
      // Fallback to html.dark class
      const isHtmlDark = document.documentElement.classList.contains("dark");
      return isHtmlDark;
    }
    return false; // Default to light mode
  });

  // Watch for theme changes
  useLayoutEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode");
        setIsDark(dataMode === "dark");
        return;
      }
      // Fallback to html.dark
      const isHtmlDark = document.documentElement.classList.contains("dark");
      setIsDark(isHtmlDark);
    };

    // Check immediately
    checkMode();

    // Watch for changes in the data attribute
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

    // Also watch for html class changes
    const htmlObserver = new MutationObserver(checkMode);
    htmlObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      if (observer) observer.disconnect();
      if (htmlObserver) htmlObserver.disconnect();
    };
  }, []);

  // Fetch counts for all tabs (optimized - only updates counts, doesn't fetch contests)
  const fetchAllCounts = async () => {
    try {
      const response = await fetch("/api/admin/contest-moderation");
      if (!response.ok) return;

      const data = await response.json();
      const allContests = data.contests || [];
      setContestCounts(calculateCounts(allContests));
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  };

  const fetchContests = async (status: string) => {
    try {
      setLoading(true);
      const url =
        status === "all"
          ? "/api/admin/contest-moderation"
          : `/api/admin/contest-moderation?status=${status}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch contests");
      }

      const data = await response.json();
      const fetchedContests = data.contests || [];

      // Always update contests, even if empty array
      setContests(fetchedContests);

      // Update counts based on fetched data
      if (status === "all") {
        // If fetching all, update all counts
        setContestCounts(calculateCounts(fetchedContests));
      } else {
        // Update only the current tab's count
        setContestCounts((prev) => ({
          ...prev,
          [status]: fetchedContests.length,
        }));
      }
    } catch (error) {
      console.error("Error fetching contests:", error);
      // Set empty array on error to show "no contests found" instead of stale data
      setContests([]);
      toast({
        title: "Error",
        description: "Failed to fetch contests. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Always set loading to false, even on error
      setLoading(false);
      setHasInitialized(true);
    }
  };

  // Initialize with server data synchronously (before first paint) to prevent flash
  useLayoutEffect(() => {
    if (hasValidInitialData && selectedStatus === initialStatus) {
      setContests(initialContests);
      setHasInitialized(true);
      setLoading(false);
      hasFetchedInitialRef.current = true;
    }
  }, []); // Only run once on mount

  // Fetch counts on mount (non-blocking, runs after initial render)
  useEffect(() => {
    fetchAllCounts();
  }, []);

  // Handle status changes and initial fetch
  useEffect(() => {
    setPage(1); // Reset to first page when tab changes

    // Skip fetch if we have initial data for the current status
    if (
      hasValidInitialData &&
      selectedStatus === initialStatus &&
      hasFetchedInitialRef.current
    ) {
      isInitialStatusRef.current = false;
      return;
    }

    // Mark that we're no longer on initial status
    if (selectedStatus !== initialStatus) {
      isInitialStatusRef.current = false;
    }

    // Fetch contests for the selected status
    fetchContests(selectedStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  // Keep current page in range when the data size or page size changes
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(contests.length / limit || 1));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [contests.length, limit, page]);

  const handleApprove = async (contestId: string) => {
    try {
      setProcessingAction(true);

      const response = await fetch("/api/admin/contest-moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          action: "approve",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve contest");
      }

      toast({
        title: "✅ Contest Approved",
        description: "Contest is now ready to be published by the brand",
      });

      await fetchContests(selectedStatus);
      await fetchAllCounts(); // Refresh all counts after approval
      setShowApprovalDialog(false);
      setSelectedContest(null);
    } catch (error) {
      console.error("Error approving contest:", error);
      toast({
        title: "❌ Approval Failed",
        description: "Could not approve contest. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async (contestId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessingAction(true);

      const response = await fetch("/api/admin/contest-moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          action: "reject",
          reason: rejectionReason.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject contest");
      }

      toast({
        title: "❌ Contest Rejected",
        description: "Brand has been notified and can make changes",
      });

      await fetchContests(selectedStatus);
      await fetchAllCounts(); // Refresh all counts after rejection
      setShowRejectionDialog(false);
      setSelectedContest(null);
      setRejectionReason("");
    } catch (error) {
      console.error("Error rejecting contest:", error);
      toast({
        title: "❌ Rejection Failed",
        description: "Could not reject contest. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return formatLocalDateTime(dateString, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getModerationStatusBadge = (moderationStatus: string) => {
    const config =
      moderationStatusConfig[
      moderationStatus as keyof typeof moderationStatusConfig
      ];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white border-0`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getContestStatusBadge = (status: string | null) => {
    if (!status) return null;

    const config =
      contestStatusConfig[status as keyof typeof contestStatusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white border-0 ml-2`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const renderContestCard = (contest: Contest) => {
    const leaderboardPrizeMoney =
      contest.contest_type === "leaderboard" &&
      contest.contest_based_details?.leaderboard_contest?.total_prize;

    const poolBudgetCents = getPoolBudgetCentsFromDetails(
      contest.contest_type,
      contest.contest_based_details,
    );

    const budgetSpent =
      contest.contest_type === "cpm" ||
      contest.contest_type === "dual_rewards"
        ? contest.contest_based_details?.cpm_contest?.budget_spent ?? 0
        : 0;

    return (
      <Card
        key={contest.id}
        className={cn(
          "overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col group w-full min-w-0",
          isDark ? "bg-[#06021D] border-slate-700" : "bg-white border-slate-200"
        )}
      >
        <div className="flex flex-col flex-grow">
          <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
            {contest.thumbnail_url ? (
              <img
                src={contest.thumbnail_url}
                alt={contest.title || "Contest thumbnail"}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <Trophy className="h-12 w-12 mb-2" />
                <span className="text-sm font-medium">No Image</span>
              </div>
            )}
            <div className="absolute top-3 right-3 flex flex-wrap gap-1">
              {getModerationStatusBadge(contest.moderation_status)}
              {contest.moderation_status === "published" &&
                getContestStatusBadge(contest.status)}
            </div>
          </div>

          <CardContent className="flex-grow p-3 sm:p-4 flex flex-col">
            <div className="mb-2 sm:mb-3">
              <h3
                className="font-bold text-base sm:text-lg leading-tight line-clamp-2"
                style={{
                  color: isDark ? "white" : "#0f172a",
                  transition: "none",
                }}
              >
                {contest.title}
              </h3>
            </div>

            <div
              className="flex items-center gap-2 mb-2 sm:mb-3 text-xs sm:text-sm"
              style={{
                color: isDark ? "white" : "#475569",
                transition: "none",
              }}
            >
              <Building className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="truncate">{contest.advertiser_name}</span>
            </div>

            {/* New Features Indicators */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              {contest.multiple_submissions_enabled && (
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs bg-purple-50 text-purple-700 border-purple-200 py-0.5 px-1.5 sm:px-2"
                >
                  <CheckCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  <span className="hidden sm:inline">
                    {(contest.max_submissions_per_creator ?? 1) > 1
                      ? `${contest.max_submissions_per_creator} Submissions`
                      : "Multiple Entries"}
                  </span>
                  <span className="sm:hidden">Multi</span>
                </Badge>
              )}
              {(contest.contest_based_details?.cpm_contest?.flat_fee_bonus ||
                contest.contest_based_details?.leaderboard_contest
                  ?.flat_fee_bonus) && (
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs bg-green-50 text-green-700 border-green-200 py-0.5 px-1.5 sm:px-2"
                >
                  <Gift className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  <span className="hidden sm:inline">
                    {formatMoney(
                      contest.contest_based_details?.cpm_contest
                        ?.flat_fee_bonus ||
                        contest.contest_based_details?.leaderboard_contest
                          ?.flat_fee_bonus ||
                        0
                    )}
                    /submission
                  </span>
                  <span className="sm:hidden">Bonus</span>
                </Badge>
              )}
              {contest.content_type && (
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs bg-blue-50 text-blue-700 border-blue-200 py-0.5 px-1.5 sm:px-2"
                >
                  <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  {contest.content_type.toUpperCase()}
                </Badge>
              )}
              {contest.bonus_details?.description_html && (
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs bg-amber-50 text-amber-700 border-amber-200 py-0.5 px-1.5 sm:px-2"
                >
                  <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  <span className="hidden sm:inline">Bonus Available</span>
                  <span className="sm:hidden">Bonus</span>
                </Badge>
              )}
            </div>

            {/* Contest Details Section */}
            <div
              className="space-y-1.5 sm:space-y-2 text-md mb-3 sm:mb-4 flex-grow"
              style={{
                color: isDark ? "white" : "#475569",
                transition: "none",
              }}
            >
              {contest.start_date && contest.end_date ? (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span className="break-words">
                    {formatLocalDateTime(contest.start_date)} -{" "}
                    {formatLocalDateTime(contest.end_date)}
                  </span>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex items-center gap-1",
                    isDark ? "text-amber-400" : "text-amber-600"
                  )}
                >
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span>Dates not set</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Trophy className="h-3 w-3 flex-shrink-0" />
                <span className="min-w-0">
                  Platform:{" "}
                  <span className="font-medium">
                    {contest.platform || "N/A"}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 flex-shrink-0" />
                <span className="min-w-0">
                  Campaign Type:{" "}
                  <span className="font-medium">
                    {contest.contest_type === "cpm"
                      ? "CPM Based"
                      : contest.contest_type === "leaderboard"
                        ? "Leaderboard"
                        : contest.contest_type === "dual_rewards"
                          ? "Dual Rewards"
                          : contest.contest_type
                            ? contest.contest_type.charAt(0).toUpperCase() +
                              contest.contest_type.slice(1)
                            : "N/A"}
                  </span>
                </span>
              </div>
              {(leaderboardPrizeMoney || poolBudgetCents > 0) && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 flex-shrink-0" />
                  <span className="break-words">
                    {contest.contest_type === "leaderboard"
                      ? `Prize: ${formatMoney(leaderboardPrizeMoney)}`
                      : `Budget: ${formatMoney(poolBudgetCents)}`}
                  </span>
                </div>
              )}
            </div>

            {/* Show rejection reason based on current status */}
            {contest.rejection_reason && (
              <div
                className={cn(
                  "mb-2 sm:mb-3 p-2 sm:p-3 rounded-lg border",
                  contest.moderation_status === "rejected"
                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                )}
              >
                <div className="flex items-start gap-1.5 sm:gap-2">
                  <AlertTriangle
                    className={cn(
                      "h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 flex-shrink-0",
                      contest.moderation_status === "rejected"
                        ? "text-red-500"
                        : "text-amber-500"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "text-xs sm:text-sm font-medium",
                        contest.moderation_status === "rejected"
                          ? "text-red-800 dark:text-red-200"
                          : "text-amber-800 dark:text-amber-200"
                      )}
                    >
                      {contest.moderation_status === "rejected"
                        ? "Rejection Reason"
                        : "Previous Rejection Reason"}
                    </div>
                    <div
                      className={cn(
                        "text-xs sm:text-sm mt-0.5 sm:mt-1 break-words",
                        contest.moderation_status === "rejected"
                          ? "text-red-700 dark:text-red-300"
                          : "text-amber-700 dark:text-amber-300"
                      )}
                    >
                      {contest.rejection_reason}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-auto min-w-0 pt-3">
              {contest.moderation_status === "pending_approval" ? (
                <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-3">
                  <button
                    type="button"
                    className={cn(
                      "col-span-2 flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs sm:text-sm lg:col-span-1 lg:text-base",
                      isDark
                        ? "bg-[#7F39EC] text-white"
                        : "bg-[#D9C0FF61] text-[#7F39EC]"
                    )}
                    onClick={() =>
                      window.open(
                        `/dashboard/admin/contests/${contest.id}`,
                        "_blank"
                      )
                    }
                  >
                    <Eye className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate">View Details</span>
                  </button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedContest(contest);
                      setShowApprovalDialog(true);
                    }}
                    className="flex min-h-[44px] min-w-0 w-full items-center justify-center gap-1 bg-green-600 px-2 text-[11px] hover:bg-green-700 sm:gap-1.5 sm:px-3 sm:text-xs lg:text-sm"
                  >
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate">Approve</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setSelectedContest(contest);
                      setShowRejectionDialog(true);
                    }}
                    className="flex min-h-[44px] min-w-0 w-full items-center justify-center gap-1 px-2 text-[11px] sm:gap-1.5 sm:px-3 sm:text-xs lg:text-sm"
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate">Reject</span>
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(
                    "flex min-h-[44px] w-full min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm sm:text-base",
                    isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#D9C0FF61] text-[#7F39EC]"
                  )}
                  onClick={() =>
                    window.open(
                      `/dashboard/admin/contests/${contest.id}`,
                      "_blank"
                    )
                  }
                >
                  <Eye className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate">View Details</span>
                </button>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      {/* Responsive wrapper for EnhancedTabs */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .contest-moderation-tabs-wrapper > div {
          min-width: max-content;
        }
        
        @media (max-width: 360px) {
          .contest-moderation-tabs-wrapper button {
            flex: 0 0 auto !important;
            min-width: fit-content !important;
            padding: 0.25rem 0.375rem !important;
            font-size: 0.625rem !important;
            gap: 0.125rem !important;
          }
          .contest-moderation-tabs-wrapper .badge {
            font-size: 0.625rem !important;
            padding: 0.125rem 0.25rem !important;
            margin-left: 0.125rem !important;
          }
        }

        /* Small phones in landscape / very small devices */
        @media (min-width: 360px) and (max-width: 460px) {
          .contest-moderation-tabs-wrapper button {
            flex: 0 0 auto !important;
            min-width: fit-content !important;
            padding: 0.375rem 0.5rem !important;
            font-size: 0.75rem !important;
            gap: 0.25rem !important;
          }
        }

        /* Requested: 460px - 640px breakpoint for better tab responsiveness */
        @media (min-width: 460px) and (max-width: 640px) {
          .contest-moderation-tabs-wrapper button {
            flex: 1 1 auto !important;
            min-width: 0 !important;
            padding: 0.5rem 0.75rem !important;
            font-size: 0.8rem !important;
            gap: 0.3rem !important;
          }
          .contest-moderation-tabs-wrapper .badge {
            font-size: 0.7rem !important;
            padding: 0.15rem 0.35rem !important;
          }
        }
        
        @media (min-width: 640px) and (max-width: 768px) {
          .contest-moderation-tabs-wrapper button {
            padding: 0.5rem 0.75rem !important;
            font-size: 0.875rem !important;
          }
        }
      `,
        }}
      />
      <div className="contest-moderation-tabs-wrapper overflow-x-auto scrollbar-hide mb-4 sm:mb-6 md:mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
        <EnhancedTabs
          tabs={[
            {
              id: "pending_approval",
              label: (
                <span className="flex items-center gap-0.5 sm:gap-1">
                  Pending
                  <Badge
                    variant="secondary"
                    className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold"
                  >
                    {contestCounts.pending_approval}
                  </Badge>
                </span>
              ),
            },
            {
              id: "approved",
              label: (
                <span className="flex items-center gap-0.5 sm:gap-1">
                  Approved
                  <Badge
                    variant="secondary"
                    className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold"
                  >
                    {contestCounts.approved}
                  </Badge>
                </span>
              ),
            },
            {
              id: "published",
              label: (
                <span className="flex items-center gap-0.5 sm:gap-1">
                  Published
                  <Badge
                    variant="secondary"
                    className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold"
                  >
                    {contestCounts.published}
                  </Badge>
                </span>
              ),
            },
            {
              id: "rejected",
              label: (
                <span className="flex items-center gap-0.5 sm:gap-1">
                  Rejected
                  <Badge
                    variant="secondary"
                    className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold"
                  >
                    {contestCounts.rejected}
                  </Badge>
                </span>
              ),
            },
            {
              id: "all",
              label: (
                <span className="flex items-center gap-0.5 sm:gap-1">
                  All
                  <Badge
                    variant="secondary"
                    className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold"
                  >
                    {contestCounts.all}
                  </Badge>
                </span>
              ),
            },
          ]}
          activeTab={selectedStatus}
          onTabChange={setSelectedStatus}
          className="w-full sm:w-auto"
          isDark={isDark}
          light={!isDark}
        />
      </div>

      <div className="mt-2 sm:mt-4 w-full min-w-0">
        {loading || !hasInitialized ? (
          <PageLoadingSpinner mode={isDark ? "dark" : "light"} />
        ) : contests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-12 w-12 mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No contests found for this status
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {contests
                .slice((page - 1) * limit, page * limit)
                .map((contest) => renderContestCard(contest))}
            </div>

            <div className="flex flex-col gap-2 sm:gap-3 items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div
                  className="text-xs sm:text-sm"
                  style={{
                    color: isDark ? "#cbd5e1" : "#4b5563",
                    transition: "none",
                  }}
                >
                  {(() => {
                    const total = contests.length;
                    const startItem = Math.min((page - 1) * limit + 1, total);
                    const endItem = Math.min(page * limit, total);
                    return `Showing ${startItem}-${endItem} of ${total} contests`;
                  })()}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <span
                    style={{
                      color: isDark ? "#cbd5e1" : "#4b5563",
                      transition: "none",
                    }}
                  >
                    Show:
                  </span>
                  <Select
                    value={limit.toString()}
                    onValueChange={(value) => {
                      const newLimit = parseInt(value, 10);
                      setLimit(newLimit);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-16 sm:w-20 h-8 sm:h-9 text-xs sm:text-sm",
                        isDark && "border border-gray-600"
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      isDark={isDark}
                      className={cn(
                        isDark && "border-gray-600 bg-[#07031D] text-white"
                      )}
                    >
                      {[9, 15, 21, 30].map((size) => (
                        <SelectItem
                          isDark={isDark}
                          key={size}
                          value={size.toString()}
                          className={cn(
                            isDark &&
                            "bg-[#07031D] text-white focus:bg-slate-800 data-[state=checked]:bg-slate-700"
                          )}
                        >
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span
                    className="text-xs sm:text-sm"
                    style={{
                      color: isDark ? "#cbd5e1" : "#4b5563",
                      transition: "none",
                    }}
                  >
                    per page
                  </span>
                </div>
              </div>
              <PaginationControls
                page={page}
                limit={limit}
                total={contests.length}
                totalPages={Math.max(
                  1,
                  Math.ceil(contests.length / limit || 1)
                )}
                hasNextPage={
                  page < Math.max(1, Math.ceil(contests.length / limit || 1))
                }
                hasPreviousPage={page > 1}
                onPageChange={setPage}
                onLimitChange={setLimit}
                loading={loading}
                isDark={isDark}
                showResultInfo={false}
                showEdgeButtons={false}
                showPrevNextButtons={true}
                showPageSizeSelector={false}
                pageSizeOptions={[9, 15, 21, 30]}
              />
            </div>
          </div>
        )}
      </div>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Contest</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve "{selectedContest?.title}"? The
              contest will be marked as ready for publication.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedContest && handleApprove(selectedContest.id)
              }
              disabled={processingAction}
              className="bg-green-600 hover:bg-green-700"
            >
              {processingAction ? "Approving..." : "Approve Contest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Contest</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting "{selectedContest?.title}".
              This will help the advertiser understand what needs to be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4">
            <Textarea
              placeholder="Explain why this contest is being rejected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectionDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedContest && handleReject(selectedContest.id)
              }
              disabled={processingAction || !rejectionReason.trim()}
            >
              {processingAction ? "Rejecting..." : "Reject Contest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
