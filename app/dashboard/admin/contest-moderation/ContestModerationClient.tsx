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
import { useToast } from "@/hooks/use-toast";
import { formatLocalDateTime, cn } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
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
  const [contests, setContests] = useState<Contest[]>(initialContests);
  // Start with loading false if server provided initial data, true otherwise
  const [loading, setLoading] = useState(() => {
    // If server provided initial data, we don't need to load
    return !hasInitialData;
  });
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingAction, setProcessingAction] = useState(false);
  const { toast } = useToast();

  // Separate state for counts to persist across tab switches
  const [contestCounts, setContestCounts] = useState({
    pending_approval: initialContests.filter(
      (c) => c.moderation_status === "pending_approval"
    ).length,
    approved: 0,
    published: 0,
    rejected: 0,
    all: 0,
  });

  // Track if component has mounted to prevent flash
  const hasMountedRef = useRef(false);

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

  // Fetch counts for all tabs (silently, doesn't affect loading state)
  const fetchAllCounts = async () => {
    try {
      const response = await fetch("/api/admin/contest-moderation");
      if (response.ok) {
        const data = await response.json();
        const allContests = data.contests || [];
        setContestCounts({
          pending_approval: allContests.filter(
            (c: Contest) => c.moderation_status === "pending_approval"
          ).length,
          approved: allContests.filter(
            (c: Contest) => c.moderation_status === "approved"
          ).length,
          published: allContests.filter(
            (c: Contest) => c.moderation_status === "published"
          ).length,
          rejected: allContests.filter(
            (c: Contest) => c.moderation_status === "rejected"
          ).length,
          all: allContests.length,
        });
      }
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
        setContestCounts({
          pending_approval: fetchedContests.filter(
            (c: Contest) => c.moderation_status === "pending_approval"
          ).length,
          approved: fetchedContests.filter(
            (c: Contest) => c.moderation_status === "approved"
          ).length,
          published: fetchedContests.filter(
            (c: Contest) => c.moderation_status === "published"
          ).length,
          rejected: fetchedContests.filter(
            (c: Contest) => c.moderation_status === "rejected"
          ).length,
          all: fetchedContests.length,
        });
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
    }
  };

  // Set loading to false synchronously if we have initial data (before first paint)
  // This prevents the flash of "no contests found" -> loading -> contests
  useLayoutEffect(() => {
    hasMountedRef.current = true;
    if (hasInitialData && selectedStatus === initialStatus && loading) {
      // Server provided initial data, ensure loading is false before first paint
      // Only set if loading is currently true (defensive check)
      setLoading(false);
    }
  }, []); // Only run once on mount

  // Track if this is the first render
  const isFirstRender = useRef(true);

  // Fetch all counts on mount (don't block UI)
  useEffect(() => {
    fetchAllCounts();
  }, []);

  useEffect(() => {
    // On first render, if we have initial data for the current status, skip fetch
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (hasInitialData && selectedStatus === initialStatus) {
        // Server provided initial data, loading already set to false in useLayoutEffect
        // Don't fetch, use initial data
        return; // Skip fetch, use initial data
      }
      // If no initial data from server, loading is already true, just fetch
    }

    // Fetch when status changes (always fetch when switching tabs)
    // This will only execute if:
    // 1. First render with no initial data from server, OR
    // 2. Tab change (isFirstRender.current is already false)
    fetchContests(selectedStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

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

    const cpmBudget =
      contest.contest_type === "cpm" &&
      contest.contest_based_details?.cpm_contest?.total_budget;

    const budgetSpent =
      contest.contest_type === "cpm"
        ? contest.contest_based_details?.cpm_contest?.budget_spent ?? 0
        : 0;

    return (
      <Card
        key={contest.id}
        className={cn(
          "overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col group w-full",
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

          <CardContent className="flex-grow p-4 flex flex-col">
            <div className="mb-3">
              <h3
                className="font-bold text-lg leading-tight line-clamp-2"
                style={{
                  color: isDark ? "white" : "#0f172a",
                  transition: "none",
                }}
              >
                {contest.title}
              </h3>
            </div>

            <div
              className="flex items-center gap-2 mb-3 text-sm"
              style={{
                color: isDark ? "white" : "#475569",
                transition: "none",
              }}
            >
              <Building className="h-4 w-4" />
              <span>{contest.advertiser_name}</span>
            </div>

            {/* New Features Indicators */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {contest.multiple_submissions_enabled && (
                <Badge
                  variant="outline"
                  className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  {(contest.max_submissions_per_creator ?? 1) > 1
                    ? `${contest.max_submissions_per_creator} Submissions`
                    : "Multiple Entries"}
                </Badge>
              )}
              {(contest.contest_based_details?.cpm_contest?.flat_fee_bonus ||
                contest.contest_based_details?.leaderboard_contest
                  ?.flat_fee_bonus) && (
                <Badge
                  variant="outline"
                  className="text-xs bg-green-50 text-green-700 border-green-200"
                >
                  <Gift className="h-3 w-3 mr-1" />
                  {formatMoney(
                    contest.contest_based_details?.cpm_contest
                      ?.flat_fee_bonus ||
                      contest.contest_based_details?.leaderboard_contest
                        ?.flat_fee_bonus ||
                      0
                  )}
                  /submission
                </Badge>
              )}
              {contest.content_type && (
                <Badge
                  variant="outline"
                  className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {contest.content_type.toUpperCase()}
                </Badge>
              )}
              {contest.bonus_details?.description_html && (
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                >
                  <Star className="h-3 w-3 mr-1" />
                  Bonus Available
                </Badge>
              )}
            </div>

            {/* Contest Details Section */}
            <div
              className="space-y-2 text-md mb-4 flex-grow"
              style={{
                color: isDark ? "white" : "#475569",
                transition: "none",
              }}
            >
              {contest.start_date && contest.end_date ? (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
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
                  <AlertTriangle className="h-3 w-3" />
                  <span>Dates not set</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                <span>
                  Platform:{" "}
                  <span className="font-medium">
                    {contest.platform || "N/A"}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>
                  Contest Type:{" "}
                  <span className="font-medium">
                    {contest.contest_type === "cpm"
                      ? "CPM Based"
                      : contest.contest_type === "leaderboard"
                      ? "Leaderboard"
                      : contest.contest_type
                      ? contest.contest_type.charAt(0).toUpperCase() +
                        contest.contest_type.slice(1)
                      : "N/A"}
                  </span>
                </span>
              </div>
              {(leaderboardPrizeMoney || cpmBudget) && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span>
                    {contest.contest_type === "leaderboard"
                      ? `Prize: ${formatMoney(leaderboardPrizeMoney)}`
                      : `Budget: ${formatMoney(cpmBudget)}`}
                  </span>
                </div>
              )}
            </div>

            {contest.moderation_status === "rejected" &&
              contest.rejection_reason && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-red-800 dark:text-red-200">
                        Rejection Reason
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {contest.rejection_reason}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            <div className="flex gap-2 mt-auto pt-3">
              <button
                className={cn(
                  "flex w-full items-center justify-center gap-2 px-3 py-3 rounded-full",
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
                <Eye className="h-4 w-4" />
                View Details
              </button>

              {contest.moderation_status === "pending_approval" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedContest(contest);
                      setShowApprovalDialog(true);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setSelectedContest(contest);
                      setShowRejectionDialog(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <EnhancedTabs
        tabs={[
          {
            id: "pending_approval",
            label: (
              <span>
                Pending{" "}
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.5 text-xs"
                >
                  {contestCounts.pending_approval}
                </Badge>
              </span>
            ),
          },
          {
            id: "approved",
            label: (
              <span>
                Approved{" "}
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.5 text-xs"
                >
                  {contestCounts.approved}
                </Badge>
              </span>
            ),
          },
          {
            id: "published",
            label: (
              <span>
                Published{" "}
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.5 text-xs"
                >
                  {contestCounts.published}
                </Badge>
              </span>
            ),
          },
          {
            id: "rejected",
            label: (
              <span>
                Rejected{" "}
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.5 text-xs"
                >
                  {contestCounts.rejected}
                </Badge>
              </span>
            ),
          },
          {
            id: "all",
            label: (
              <span>
                All{" "}
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.5 text-xs"
                >
                  {contestCounts.all}
                </Badge>
              </span>
            ),
          },
        ]}
        activeTab={selectedStatus}
        onTabChange={setSelectedStatus}
        className="mb-8"
        isDark={isDark}
        light={!isDark}
      />

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : contests.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                No contests found for this status
              </p>
            </CardContent>
          </Card>
        ) : (
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            }}
          >
            {contests.map((contest) => renderContestCard(contest))}
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
