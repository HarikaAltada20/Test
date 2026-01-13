"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  getMetricsRefreshCooldownInfoBrand,
  getMetricsRefreshCooldownInfoAdmin,
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
import TwitterRejectionModal from "@/components/TwitterRejectionModal";
import PaymentModal from "@/components/PaymentModal";
import ManualPointsModal from "@/components/ManualPointsModal";
import { CreatorSubmissionsModal } from "@/components/CreatorSubmissionsModal";
import { BudgetProgress } from "@/components/BudgetProgress";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { TwitterFeed } from "@/components/twitter-feed";
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
  Download,
  Trash2,
  Monitor,
  Play,
  Pause,
  Settings,
  Wallet,
  BarChart3,
  TrendingUp,
  CheckCheck,
  Gift,
  Tag,
  Star,
  Globe,
} from "lucide-react";
import { CONTENT_TYPE_CATEGORIES } from "@/constants/contentCategories";

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
  // Twitter-specific fields (now stored in contest_based_details.twitter_campaign)
  contest_format?: string | null;
  // Categories, subcategories, and interests
  categories?: string[] | null;
  subcategories?:
    | Array<{ category: string; subcategory: string }>
    | Record<string, string[]>
    | null; // Can be flat array or grouped object format
  interests?: string[] | null;
  // Region data (JSONB format: { "North America": ["United States", "Canada"], ... })
  region?: Record<string, string[]> | null;
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
  status:
    | "pending"
    | "verified"
    | "rejected"
    | "paid"
    | "mark_bonus_paid"
    | "mark_both_paid";
  views: number | null;
  other_stats: Record<string, any> | null;
  platform: string | null;
  video_thumbnail_url: string | null;
  video_title?: string | null; // For YouTube/Instagram video submissions
  creator_display_name: string | null;
  creator_username: string | null;
  creator_avatar_url: string | null;
  creator_id: string | null;
  earnings?: number | null; // Added for earnings display
  // Twitter-specific fields
  is_twitter_tweet?: boolean; // Flag to identify Twitter tweets
  moderation_status?: "pending" | "verified" | "rejected"; // Twitter moderation status
  manual_points_adjustment?: number; // Manual points adjustment for Twitter tweets
  manual_points_reason?: string | null; // Reason for manual points adjustment
  tweet_id?: string; // Twitter tweet ID
  filter_status?: string | null; // Eligibility filter status: 'pending', 'eligible', 'filtered_out', 'deleted'
  // Nested creator object for compatibility
  creator?: {
    id: string | null;
    username: string | null;
    profile_picture_url?: string | null;
    full_name?: string | null;
  };
  // Additional fields that may be present
  paid?: boolean;
  paid_at?: string | null;
  bonus_paid?: boolean;
  bonus_paid_at?: string | null;
}
// --- End Local Type Definitions ---

interface ContestDetailClientProps {
  contest: Contest;
  initialSubmissions: Submission[] | null;
  durationDays: number | null;
  contestId: string;
  isAdminView?: boolean;
  user?: any; // Add user prop for dynamic [creator] replacement
  creatorModerationData?: Record<
    string,
    {
      moderation_status?: string;
      rejection_reason?: string | null;
      manual_points_adjustment?: number;
      manual_points_reason?: string | null;
      total_points?: number;
      total_eligible_tweets?: number;
      total_likes?: number;
      total_replies?: number;
      total_retweets?: number;
      total_quote_reposts?: number;
      total_impressions?: number;
      current_rank?: number;
      paid?: boolean;
      paid_at?: string | null;
      earnings?: number;
      paid_rank?: number | null;
    }
  >;
}

export default function ContestDetailClient({
  contest,
  initialSubmissions,
  durationDays,
  contestId,
  isAdminView = false,
  user,
  creatorModerationData = {},
}: ContestDetailClientProps) {
  const supabase = createClient();
  const { toast, toasts } = useToast();
  const [currentSubmissions, setCurrentSubmissions] = useState<Submission[]>(
    initialSubmissions || []
  );
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<
    string | null
  >(null);

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
    ...(contest?.platform?.toLowerCase() === "twitter"
      ? [{ id: "twitter-feed", label: "Twitter Feed" }]
      : []),
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
  // Get theme from parent layout instead of managing independent state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      // Check data-mode attribute from parent layout
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode");
        return dataMode === "dark";
      }
      // Fallback to data-theme attribute
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme");
      return dataTheme === "dark";
    }
    return false; // Default to light mode
  });

  // Refresh metrics state
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

  // Twitter campaign metrics state
  const [twitterMetrics, setTwitterMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Rejection modal state
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [pendingRejectionSubmission, setPendingRejectionSubmission] = useState<
    string | null
  >(null);

  // Twitter rejection modal state
  const [twitterRejectionModalOpen, setTwitterRejectionModalOpen] =
    useState(false);
  const [pendingTwitterRejection, setPendingTwitterRejection] = useState<{
    id: string;
    type: "tweet" | "creator";
    creatorId?: string;
    creatorUsername?: string;
  } | null>(null);

  // Manual points adjustment modal state
  const [manualPointsModalOpen, setManualPointsModalOpen] = useState(false);
  const [pendingManualPointsSubmission, setPendingManualPointsSubmission] =
    useState<{
      id: string;
      type: "tweet" | "leaderboard";
      creatorId?: string;
    } | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingPaymentSubmission, setPendingPaymentSubmission] = useState<
    string | null
  >(null);
  const [pendingTwitterPaymentCreator, setPendingTwitterPaymentCreator] =
    useState<string | null>(null);
  const [confirmReversal, setConfirmReversal] = useState<{
    id: string;
    target: "verified" | "pending" | "rejected";
    needRejectionReason?: boolean;
  } | null>(null);
  const [confirmTwitterCreatorReversal, setConfirmTwitterCreatorReversal] =
    useState<{
      creatorId: string;
      action: "approve" | "reject";
      needRejectionReason?: boolean;
      creatorUsername?: string;
    } | null>(null);
  const [activeStatusTab, setActiveStatusTab] = useState<
    "all" | "pending" | "verified" | "rejected" | "paid" | "verified_or_paid"
  >("all");
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<
    "all" | "pending" | "verified" | "rejected" | "paid" | "verified_or_paid"
  >("all");
  // Eligibility filter for Twitter tweets
  const [activeEligibilityTab, setActiveEligibilityTab] = useState<
    "all" | "eligible" | "not_eligible"
  >("all");

  // Participant filter for Twitter contests (creator-wise view)
  const [participantFilter, setParticipantFilter] = useState<
    "all" | "rejected" | "available"
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [creatorWisePage, setCreatorWisePage] = useState(1);
  const [creatorWiseItemsPerPage, setCreatorWiseItemsPerPage] = useState(25);

  // Twitter Feed state
  const [twitterTweets, setTwitterTweets] = useState<any[]>([]);
  const [twitterCreators, setTwitterCreators] = useState<any[]>([]);
  const [selectedTwitterCreator, setSelectedTwitterCreator] = useState<
    string | null
  >(null);
  const [isLoadingTwitterFeed, setIsLoadingTwitterFeed] = useState(false);
  const [twitterFeedPage, setTwitterFeedPage] = useState(1);
  const [twitterFeedTotalPages, setTwitterFeedTotalPages] = useState(1);
  const [isLive, setIsLive] = useState(false);

  // Use admin cooldown if admin view, otherwise use brand cooldown
  const cooldownInfo = isAdminView
    ? getMetricsRefreshCooldownInfoAdmin(currentContest.last_metrics_updated)
    : getMetricsRefreshCooldownInfoBrand(currentContest.last_metrics_updated);

  // Helper function to get status for both Twitter tweets and regular submissions
  const getStatus = (submission: Submission) => {
    const isTwitterTweet = (submission as any).is_twitter_tweet === true;
    return isTwitterTweet
      ? (submission as any).moderation_status || "pending"
      : submission.status;
  };

  // Filter submissions based on active status tab
  // For Twitter tweets, use moderation_status; for regular submissions, use status
  const filteredSubmissions = currentSubmissions.filter((submission) => {
    const status = getStatus(submission);
    const isTwitterTweet = (submission as any).is_twitter_tweet === true;

    // Apply status tab filter
    if (activeStatusTab !== "all") {
      if (activeStatusTab === "verified_or_paid") {
        if (!(status === "verified" || status === "paid")) return false;
      } else {
        if (status !== activeStatusTab) return false;
      }
    }

    // Apply eligibility filter for Twitter tweets
    if (isTwitterTweet && activeEligibilityTab !== "all") {
      const filterStatus = (submission as any).filter_status;
      if (activeEligibilityTab === "eligible") {
        // Show only eligible tweets
        if (filterStatus !== "eligible") return false;
      } else if (activeEligibilityTab === "not_eligible") {
        // Show only not eligible tweets (deleted, filtered_out, pending, etc.)
        if (filterStatus === "eligible") return false;
      }
    }

    return true;
  });

  // Sort filtered submissions
  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortOption) {
      case "views_asc":
        return (a.views || 0) - (b.views || 0);
      case "time_desc": {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      }
      case "time_asc": {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return at - bt;
      }
      case "views_desc":
      default:
        return (b.views || 0) - (a.views || 0);
    }
  });

  // Pagination calculations for normal view
  const totalPages = Math.ceil(sortedSubmissions.length / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;
  const paginatedSubmissions = sortedSubmissions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Filter submissions for analytics based on active analytics tab
  // For Twitter tweets, use moderation_status; for regular submissions, use status
  const filteredAnalyticsSubmissions = currentSubmissions.filter(
    (submission) => {
      const status = getStatus(submission);

      if (activeAnalyticsTab === "all") return true;
      if (activeAnalyticsTab === "verified_or_paid") {
        return status === "verified" || status === "paid";
      }
      return status === activeAnalyticsTab;
    }
  );

  // Creator-wise grouping logic
  const groupSubmissionsByCreator = useMemo(() => {
    if (!filteredSubmissions || viewMode !== "creator-wise") return null;

    // Check if this is a Twitter leaderboard campaign
    const isTwitterLeaderboard =
      (currentContest?.platform?.toLowerCase() === "twitter" ||
        currentContest?.platform?.toLowerCase() === "x") &&
      currentContest?.contest_format === "text_image" &&
      currentContest?.contest_type === "leaderboard";

    // For Twitter leaderboard campaigns, use data directly from twitter_campaign_leaderboard
    if (isTwitterLeaderboard) {
      const grouped: Record<string, any> = {};

      // Get unique creator IDs from submissions to build the structure
      const creatorIds = new Set<string>();
      filteredSubmissions.forEach((submission: any) => {
        if (submission.creator_id) {
          creatorIds.add(submission.creator_id);
        }
      });

      // Only include creators from leaderboard data if we're showing all submissions
      // Otherwise, only include creators who have matching submissions in the filter
      if (activeStatusTab === "all") {
        Object.keys(creatorModerationData).forEach((creatorId) => {
          creatorIds.add(creatorId);
        });
      }

      creatorIds.forEach((creatorId) => {
        const leaderboardData = creatorModerationData[creatorId] || {};
        const creatorSubmissions = filteredSubmissions.filter(
          (s: any) => s.creator_id === creatorId
        );
        const firstSubmission = creatorSubmissions[0];

        // Calculate base_points from submissions (for raid campaigns, this correctly uses base_points from other_stats)
        // For leaderboard, we need to sum base_points from all eligible submissions
        let calculatedBasePoints = 0;
        creatorSubmissions.forEach((submission: any) => {
          const status =
            (submission.is_twitter_tweet &&
              (submission as any).moderation_status) ||
            submission.status;
          // Only count pending or verified submissions (not rejected)
          if (status !== "rejected") {
            calculatedBasePoints += submission.other_stats?.base_points || 0;
          }
        });

        // If we have leaderboard data but no submissions in the current filter, use leaderboard calculation
        // For raid campaigns, total_points includes base + bonus + manual, so we can't just subtract manual
        // Instead, use the calculated base_points from submissions, or fallback to a safer calculation
        const basePoints =
          calculatedBasePoints > 0
            ? calculatedBasePoints
            : Math.max(
                0,
                (leaderboardData.total_points || 0) -
                  (leaderboardData.manual_points_adjustment || 0)
              );

        grouped[creatorId] = {
          creator: {
            id: creatorId,
            username: firstSubmission?.creator?.username || "Unknown",
            profile_picture_url:
              firstSubmission?.creator?.profile_picture_url || null,
            full_name: firstSubmission?.creator?.full_name || null,
          },
          submissions: creatorSubmissions,
          totalCount:
            leaderboardData.total_eligible_tweets || creatorSubmissions.length,
          statusCounts: {
            all: creatorSubmissions.length,
            verified: creatorSubmissions.filter((s: any) => {
              const status =
                (s.is_twitter_tweet && (s as any).moderation_status) ||
                s.status;
              return status === "verified";
            }).length,
            paid: creatorSubmissions.filter((s: any) => s.paid).length,
            pending: creatorSubmissions.filter(
              (s: any) =>
                (s.is_twitter_tweet &&
                  (!(s as any).moderation_status ||
                    (s as any).moderation_status === "pending")) ||
                (!s.is_twitter_tweet && s.status === "pending")
            ).length,
            rejected: creatorSubmissions.filter(
              (s: any) =>
                (s.is_twitter_tweet &&
                  (s as any).moderation_status === "rejected") ||
                (!s.is_twitter_tweet && s.status === "rejected")
            ).length,
            verified_paid: creatorSubmissions.filter((s: any) => {
              const status =
                (s.is_twitter_tweet && (s as any).moderation_status) ||
                s.status;
              return status === "verified" && s.paid;
            }).length,
          },
          metrics: {
            views: 0, // Not applicable for Twitter
            likes: leaderboardData.total_likes || 0,
            comments: leaderboardData.total_replies || 0,
            shares: 0,
            saves: 0,
            reach: 0,
            interactions: 0,
            retweets: leaderboardData.total_retweets || 0,
            quote_reposts: leaderboardData.total_quote_reposts || 0,
            impressions: leaderboardData.total_impressions || 0,
            points: leaderboardData.total_points || 0,
            base_points: basePoints,
            manual_points_adjustment:
              leaderboardData.manual_points_adjustment || 0,
            manual_points_reason: leaderboardData.manual_points_reason || null,
          },
          earnings: { expected: 0, granted: 0 },
          earningsBeforeCap: 0,
          bonus: { expected: 0, granted: 0 },
          firstSubmittedAt:
            creatorSubmissions.length > 0
              ? creatorSubmissions[0].created_at
              : new Date().toISOString(),
          isCapped: false,
          creator_moderation_status:
            leaderboardData.moderation_status || "pending",
          creator_rejection_reason: leaderboardData.rejection_reason || null,
          current_rank: leaderboardData.current_rank || null,
          paid: leaderboardData.paid || false,
          paid_at: leaderboardData.paid_at || null,
          earnings_from_db: leaderboardData.earnings || 0,
          paid_rank: leaderboardData.paid_rank || null,
        };
      });

      // Calculate earnings based on rank for Twitter leaderboard campaigns
      // Only consider verified creators when calculating ranks (same as YouTube/Instagram)
      const contestDetails =
        currentContest?.contest_based_details?.leaderboard_contest;
      const prizes = contestDetails?.prizes || [];

      // Filter to only verified creators and sort by points to recalculate ranks
      const verifiedCreators = Object.values(grouped).filter((group: any) => {
        return group.creator_moderation_status === "verified";
      });

      // Sort verified creators by total points (descending)
      // Note: metrics.points already includes manual_points_adjustment for Twitter campaigns
      verifiedCreators.sort((a: any, b: any) => {
        const pointsA = a.metrics?.points || 0;
        const pointsB = b.metrics?.points || 0;
        return pointsB - pointsA;
      });

      // Assign expected earnings based on recalculated rank among verified creators only
      verifiedCreators.forEach((group: any, index: number) => {
        const verifiedRank = index + 1; // Rank among verified creators only (1, 2, 3, ...)
        const prizeForRank = prizes.find(
          (p: any) => p.position === verifiedRank
        );
        if (prizeForRank) {
          group.earnings.expected = prizeForRank.amount;
          // Use paid status from leaderboard (creator-level payment)
          if (
            group.paid &&
            group.earnings_from_db &&
            group.earnings_from_db > 0
          ) {
            group.earnings.granted = group.earnings_from_db; // Use actual earnings from database
          }
        }
      });

      // Filter out groups with no submissions when status filter is active (to avoid undefined/empty groups)
      const groupsArray = Object.values(grouped);
      if (activeStatusTab !== "all") {
        return groupsArray.filter(
          (group: any) => group.submissions && group.submissions.length > 0
        );
      }

      return groupsArray;
    }

    // For non-Twitter leaderboard campaigns, use the original aggregation logic
    const grouped = filteredSubmissions.reduce((acc: any, submission: any) => {
      const creatorId = submission.creator_id;

      if (!acc[creatorId]) {
        // Get creator-level moderation data if available
        const creatorModeration = creatorModerationData[creatorId] || {};
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
            avg_watch_time_ms: 0,
            total_watch_time_ms: 0,
            // Twitter-specific metrics
            retweets: 0,
            quote_reposts: 0,
            impressions: 0,
            points: 0,
            base_points: 0,
            manual_points_adjustment: 0,
            manual_points_reason: null as string | null,
          },
          earnings: { expected: 0, granted: 0 },
          earningsBeforeCap: 0,
          bonus: { expected: 0, granted: 0 },
          firstSubmittedAt: submission.created_at,
          isCapped: false,
          // Creator-level moderation data
          creator_moderation_status:
            creatorModeration.moderation_status || "pending",
          creator_rejection_reason: creatorModeration.rejection_reason || null,
        };
      }

      const group = acc[creatorId];
      group.submissions.push(submission);
      group.totalCount++;

      // Update status counts
      // For Twitter tweets, use moderation_status; for others, use status
      const isTwitterTweet =
        submission.is_twitter_tweet ||
        submission.platform?.toLowerCase() === "twitter";
      const status = isTwitterTweet
        ? ((submission as any).moderation_status || "pending")?.toLowerCase()
        : submission.status?.toLowerCase() || "pending";

      // Map Twitter moderation_status to standard status for counting
      const normalizedStatus = isTwitterTweet
        ? status === "approved"
          ? "verified"
          : status === "rejected"
          ? "rejected"
          : "pending"
        : status;

      group.statusCounts.all++;
      if (normalizedStatus === "verified" || normalizedStatus === "approved") {
        group.statusCounts.verified++;
        if (submission.paid) group.statusCounts.verified_paid++;
      }
      if (submission.paid) group.statusCounts.paid++;
      if (normalizedStatus === "pending") group.statusCounts.pending++;
      if (normalizedStatus === "rejected") group.statusCounts.rejected++;

      // Aggregate metrics
      group.metrics.views += submission.views || 0;

      // Reuse isTwitterTweet from above (already declared)
      if (isTwitterTweet) {
        // Aggregate Twitter-specific metrics
        group.metrics.likes += submission.other_stats?.likes || 0;
        group.metrics.comments += submission.other_stats?.replies || 0;
        group.metrics.retweets =
          (group.metrics.retweets || 0) +
          (submission.other_stats?.retweets || 0);
        group.metrics.quote_reposts =
          (group.metrics.quote_reposts || 0) +
          (submission.other_stats?.quote_reposts || 0);
        group.metrics.impressions =
          (group.metrics.impressions || 0) +
          (submission.other_stats?.impressions || 0);
        // Don't accumulate points field - it's the total (base + manual), which causes double-counting
        // Only accumulate base_points and manual_points_adjustment separately
        // Use base_points directly, don't fallback to points (which is total)
        group.metrics.base_points =
          (group.metrics.base_points || 0) +
          (submission.other_stats?.base_points || 0);
        group.metrics.manual_points_adjustment =
          (group.metrics.manual_points_adjustment || 0) +
          ((submission as any).manual_points_adjustment || 0);
        // Store manual points reason (use the latest one if multiple)
        if ((submission as any).manual_points_reason) {
          group.metrics.manual_points_reason = (
            submission as any
          ).manual_points_reason;
        }
      } else {
        // Aggregate YouTube/Instagram metrics
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
          submission.other_stats?.instagram?.total_interactions || 0;
        // Aggregate watch time metrics for Instagram
        const instagramStats = submission.other_stats?.instagram || {};
        const avgWatchTime = instagramStats.avg_watch_time_ms || 0;
        const totalWatchTime = instagramStats.total_watch_time_ms || 0;
        // Sum average watch times (we'll calculate the mean average when displaying)
        group.metrics.avg_watch_time_ms += avgWatchTime;
        // Sum total watch times (this is cumulative across all submissions)
        group.metrics.total_watch_time_ms += totalWatchTime;
      }

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
        // For Twitter leaderboard, prize is per creator, so we'll calculate granted earnings after grouping
        // For other contests, accumulate earnings per submission
        if (!isTwitterTweet) {
          group.earnings.granted += submission.earnings || 0;
        } else {
          // For Twitter leaderboard, mark that this creator has paid submissions
          // We'll set the granted earnings to the prize amount after determining creator rank
          if (!(group as any).hasPaidSubmissions) {
            (group as any).hasPaidSubmissions = true;
            // Store the earnings from the paid submission (should be the prize amount)
            (group as any).paidEarnings = submission.earnings || 0;
          }
        }
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

    // For Twitter leaderboard contests, calculate expected earnings based on creator rank
    // Note: isTwitterLeaderboard was already checked above, but we need to check again for non-leaderboard path
    const isTwitterLeaderboardForEarnings =
      (currentContest?.platform?.toLowerCase() === "twitter" ||
        currentContest?.platform?.toLowerCase() === "x") &&
      currentContest?.contest_format === "text_image" &&
      currentContest?.contest_type === "leaderboard";

    if (isTwitterLeaderboardForEarnings) {
      // Calculate total points per creator and sort to determine ranks
      const creatorPointsArray = Object.values(grouped).map((group: any) => ({
        creatorId: group.creator.id,
        totalPoints:
          (group.metrics.base_points || 0) +
          (group.metrics.manual_points_adjustment || 0),
        group: group,
      }));

      // Sort by total points (descending)
      creatorPointsArray.sort((a, b) => b.totalPoints - a.totalPoints);

      // Get prize structure
      const contestDetails =
        currentContest?.contest_based_details?.leaderboard_contest;
      const prizes = contestDetails?.prizes || [];

      // Assign expected earnings and granted earnings based on creator rank
      creatorPointsArray.forEach((item, index) => {
        const rank = index + 1;
        const prizeForRank = prizes.find((p: any) => p.position === rank);
        if (prizeForRank) {
          // Set expected earnings to the prize amount (already in cents)
          item.group.earnings.expected = prizeForRank.amount;

          // If this creator has any paid submissions, set granted earnings to the prize amount
          // Use the prize amount (not the stored paidEarnings) since prize is per creator
          if ((item.group as any).hasPaidSubmissions) {
            item.group.earnings.granted = prizeForRank.amount;
          }
        } else {
          item.group.earnings.expected = 0;
        }
      });
    }

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

  // Creator ranking for Twitter leaderboard contests (based on total points per creator)
  const creatorRankingMap = useMemo(() => {
    // Only calculate for Twitter leaderboard contests
    const isTwitterLeaderboard =
      (currentContest?.platform?.toLowerCase() === "twitter" ||
        currentContest?.platform?.toLowerCase() === "x") &&
      currentContest?.contest_format === "text_image" &&
      currentContest?.contest_type === "leaderboard";

    if (
      !isTwitterLeaderboard ||
      !filteredSubmissions ||
      filteredSubmissions.length === 0
    ) {
      return new Map<string, number>();
    }

    // Group submissions by creator and calculate total points per creator
    const creatorPointsMap = new Map<string, number>();

    filteredSubmissions.forEach((submission: any) => {
      const creatorId = submission.creator_id;
      if (!creatorId) return;

      const isTwitterTweet = submission.is_twitter_tweet === true;
      if (!isTwitterTweet) return;

      // Calculate total points for this submission (base + manual)
      const basePoints = submission.other_stats?.base_points || 0;
      const manualPoints = (submission as any).manual_points_adjustment || 0;
      const totalPoints = basePoints + manualPoints;

      // Add to creator's total
      const currentTotal = creatorPointsMap.get(creatorId) || 0;
      creatorPointsMap.set(creatorId, currentTotal + totalPoints);
    });

    // Sort creators by total points (descending) and assign ranks
    const sortedCreators = Array.from(creatorPointsMap.entries()).sort(
      (a, b) => b[1] - a[1] // Sort by points descending
    );

    // Create map: creatorId -> rank (1-based)
    const rankingMap = new Map<string, number>();
    sortedCreators.forEach(([creatorId], index) => {
      rankingMap.set(creatorId, index + 1);
    });

    return rankingMap;
  }, [filteredSubmissions, currentContest]);

  // Sort creator groups by total points for Twitter leaderboard contests
  const sortedCreatorGroups = useMemo(() => {
    if (!groupSubmissionsByCreator) return [];

    const isTwitterLeaderboard =
      (currentContest?.platform?.toLowerCase() === "twitter" ||
        currentContest?.platform?.toLowerCase() === "x") &&
      currentContest?.contest_format === "text_image" &&
      currentContest?.contest_type === "leaderboard";

    if (isTwitterLeaderboard) {
      // Sort by total points (descending)
      return [...groupSubmissionsByCreator].sort((a: any, b: any) => {
        const totalPointsA =
          (a.metrics.base_points || 0) +
          (a.metrics.manual_points_adjustment || 0);
        const totalPointsB =
          (b.metrics.base_points || 0) +
          (b.metrics.manual_points_adjustment || 0);
        return totalPointsB - totalPointsA; // Descending order
      });
    }

    // For other contests, return as-is (may be sorted differently)
    return groupSubmissionsByCreator;
  }, [groupSubmissionsByCreator, currentContest]);

  // Check if we should show rejection reason column
  const showRejectionReasonColumn = useMemo(() => {
    if (!groupSubmissionsByCreator) return false;
    return groupSubmissionsByCreator.some(
      (g: any) => g.creator_rejection_reason || g.statusCounts.rejected > 0
    );
  }, [groupSubmissionsByCreator]);

  // Filter creator groups by participant filter and eligibility (for Twitter contests)
  const filteredCreatorGroups = useMemo(() => {
    if (!sortedCreatorGroups) return [];

    const isTwitterContest =
      (currentContest?.platform?.toLowerCase() === "twitter" ||
        currentContest?.platform?.toLowerCase() === "x") &&
      currentContest?.contest_format === "text_image";

    let filtered = sortedCreatorGroups;

    // Apply eligibility filter for Twitter contests
    // Check against all submissions, not filtered ones, to determine if creator has eligible tweets
    if (isTwitterContest && activeEligibilityTab !== "all") {
      filtered = filtered.filter((group: any) => {
        const creatorId = group.creator?.id;
        if (!creatorId) return false;

        // Check all submissions for this creator (not filtered ones)
        const creatorAllSubmissions = currentSubmissions.filter(
          (s: any) =>
            s.creator_id === creatorId && (s as any).is_twitter_tweet === true
        );

        // Check if creator has at least one eligible tweet
        const hasEligibleTweet = creatorAllSubmissions.some(
          (s: any) => (s as any).filter_status === "eligible"
        );

        if (activeEligibilityTab === "eligible") {
          return hasEligibleTweet;
        } else if (activeEligibilityTab === "not_eligible") {
          return !hasEligibleTweet;
        }
        return true;
      });
    }

    // Apply participant filter for Twitter contests
    if (isTwitterContest && participantFilter !== "all") {
      filtered = filtered.filter((group: any) => {
        const moderationStatus = group.creator_moderation_status || "pending";
        if (participantFilter === "rejected") {
          return moderationStatus === "rejected";
        } else if (participantFilter === "available") {
          return moderationStatus !== "rejected";
        }
        return true;
      });
    }

    return filtered;
  }, [
    sortedCreatorGroups,
    participantFilter,
    activeEligibilityTab,
    currentContest,
    currentSubmissions,
  ]);

  // Pagination calculations for creator-wise view
  const creatorWiseTotalPages = filteredCreatorGroups
    ? Math.ceil(filteredCreatorGroups.length / creatorWiseItemsPerPage)
    : 0;
  const creatorWiseHasNextPage = creatorWisePage < creatorWiseTotalPages;
  const creatorWiseHasPreviousPage = creatorWisePage > 1;
  const paginatedCreatorGroups = filteredCreatorGroups
    ? filteredCreatorGroups.slice(
        (creatorWisePage - 1) * creatorWiseItemsPerPage,
        creatorWisePage * creatorWiseItemsPerPage
      )
    : [];

  // Reset to page 1 when filter or sort changes
  useEffect(() => {
    setCurrentPage(1);
    setCreatorWisePage(1);
  }, [activeStatusTab, viewMode, sortOption, participantFilter]);

  // Watch for theme changes from parent layout
  useEffect(() => {
    const checkTheme = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode");
        const newIsDark = currentMode === "dark";
        if (newIsDark !== isDark) {
          setIsDark(newIsDark);
        }
      }
    };

    checkTheme();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkTheme);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, [isDark]);

  useEffect(() => {
    setCurrentSubmissions(initialSubmissions || []);
  }, [initialSubmissions]);

  useEffect(() => {
    setCurrentContest(contest);
  }, [contest]);

  // Fetch Twitter metrics on load if this is a Twitter campaign
  useEffect(() => {
    if (currentContest?.platform?.toLowerCase() === "twitter") {
      fetchTwitterMetrics();
    }
  }, [currentContest?.platform, contestId]);

  // Fetch Twitter metrics when Analytics tab is active for Twitter campaigns
  useEffect(() => {
    if (
      activeTab === "analytics" &&
      currentContest?.platform?.toLowerCase() === "twitter" &&
      contestId
    ) {
      if (!twitterMetrics) {
        fetchTwitterMetrics();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentContest?.platform, contestId]);

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

  const getSubmissionStatusBadge = (status: Submission["status"] | string) => {
    // Map Twitter moderation status to standard status
    const normalizedStatus = status === "approved" ? "verified" : status;

    switch (normalizedStatus) {
      case "pending":
        return {
          text: "Pending",
          icon: <AlertTriangle className="h-3 w-3 mr-1.5" />,
          className: isDark
            ? "bg-yellow-900/30 text-yellow-300 border-yellow-500/50"
            : "bg-yellow-100 text-yellow-700 border-yellow-300",
        };
      case "verified":
        return {
          text: "Verified",
          icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
          className: isDark
            ? "bg-green-900/40 text-green-300 border-green-500/50"
            : "bg-green-100 text-green-700 border-green-300",
        };
      case "rejected":
        return {
          text: "Rejected",
          icon: <XCircle className="h-3 w-3 mr-1" />,
          className: isDark
            ? "bg-red-900/40 text-red-300 border-red-500/50"
            : "bg-red-100 text-red-700 border-red-300",
        };
      case "paid":
        return {
          text: "Paid",
          icon: <DollarSign className="h-3 w-3" />,
          className: isDark
            ? "bg-sky-900/40 text-sky-200 border-sky-500/50"
            : "bg-sky-100 text-sky-700 border-sky-300",
        };
      default:
        return {
          text: "Unknown",
          icon: <AlertTriangle className="h-3 w-3 mr-1" />,
          className: isDark
            ? "bg-gray-900/30 text-gray-300 border-gray-500/50"
            : "bg-gray-100 text-gray-700 border-gray-300",
        };
    }
  };

  type SubmissionAction =
    | Submission["status"]
    | "mark_bonus_paid"
    | "mark_both_paid";

  const handleUpdateSubmissionStatus = async (
    submissionId: string,
    newStatus: SubmissionAction,
    reason?: string,
    paymentDetails?: { paymentProofUrl: string; paymentDescription: string }
  ) => {
    console.log("🚀 Starting submission status update:", {
      submissionId,
      newStatus,
      reason,
    });

    // Check if this is a Twitter tweet - if so, use Twitter moderation endpoint
    const submission = currentSubmissions.find((s) => s.id === submissionId);
    if ((submission as any)?.is_twitter_tweet) {
      // Map status to Twitter moderation action
      if (newStatus === "verified") {
        await handleModerateTwitterTweet(submissionId, "approve");
      } else if (newStatus === "rejected") {
        await handleModerateTwitterTweet(submissionId, "reject");
      } else if (newStatus === "pending") {
        await handleModerateTwitterTweet(submissionId, "pending");
      } else {
        toast({
          title: "Error",
          description: `Action "${newStatus}" is not supported for Twitter tweets`,
          variant: "destructive",
        });
      }
      return;
    }

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

      // Update the local submissions state with latest fields from API (status + payouts + bonus)
      const updated = result?.submission;
      setCurrentSubmissions((prev) =>
        prev.map((sub) => {
          if (sub.id !== submissionId) return sub;

          const merged: any = { ...sub };
          if (updated?.status) {
            merged.status = updated.status;
          } else if (newStatus === "mark_bonus_paid") {
            // Bonus-only payments shouldn't change status
            merged.status = sub.status;
          } else if (newStatus === "mark_both_paid") {
            merged.status = "paid";
          } else {
            merged.status = newStatus;
          }

          if (updated) {
            if (typeof updated.earnings !== "undefined") {
              merged.earnings = updated.earnings;
            }
            if (typeof updated.paid !== "undefined") {
              merged.paid = updated.paid;
            }
            if (typeof updated.paid_at !== "undefined") {
              merged.paid_at = updated.paid_at;
            }
            if (typeof updated.bonus_paid !== "undefined") {
              merged.bonus_paid = updated.bonus_paid;
            }
            if (typeof updated.bonus_paid_at !== "undefined") {
              merged.bonus_paid_at = updated.bonus_paid_at;
            }
          }

          return merged;
        })
      );

      // Enhanced toast messages for better UX
      const getToastConfig = (status: SubmissionAction) => {
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
          case "mark_bonus_paid":
            return {
              title: "🎁 Bonus Paid",
              description: "Flat fee bonus marked as paid",
              variant: "default" as const,
            };
          case "mark_both_paid":
            return {
              title: "💰 Payment & Bonus Paid",
              description: "Standard reward and bonus paid together",
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

  const handleRejectionConfirm = async (
    reason: string,
    additionalNotes?: string
  ) => {
    if (pendingRejectionSubmission) {
      // Combine reason with additional notes if provided
      const fullReason = additionalNotes
        ? `${reason}\n\nAdditional Notes: ${additionalNotes}`
        : reason;

      // Check if this is a Twitter tweet
      const submission = currentSubmissions.find(
        (s) => s.id === pendingRejectionSubmission
      );
      if ((submission as any)?.is_twitter_tweet) {
        // Use Twitter moderation endpoint
        await handleModerateTwitterTweet(
          pendingRejectionSubmission,
          "reject",
          fullReason
        );
        // Update the reason separately if needed
        // The moderation endpoint will handle the status update
      } else {
        // Use regular submission status update
        handleUpdateSubmissionStatus(
          pendingRejectionSubmission,
          "rejected",
          fullReason
        );
      }
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
    customRemarks?: string;
  }) => {
    if (pendingTwitterPaymentCreator) {
      // Handle Twitter creator payment
      handlePayTwitterCreator(pendingTwitterPaymentCreator, paymentDetails);
      setPaymentModalOpen(false);
      setPendingTwitterPaymentCreator(null);
    } else if (pendingPaymentSubmission) {
      // Handle regular submission payment (Instagram/YouTube)
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

  // Handler for paying Twitter creators
  const handlePayTwitterCreator = async (
    creatorId: string,
    paymentDetails: {
      amountInCents?: number;
      isCustom?: boolean;
      customRemarks?: string;
    }
  ) => {
    setIsLoadingSubmission((prev) => ({ ...prev, [creatorId]: true }));
    try {
      const response = await fetch(
        `/api/contests/${contestId}/pay-twitter-creator`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            creatorId,
            amountInCents: paymentDetails.amountInCents,
            isCustom: paymentDetails.isCustom,
            customRemarks: paymentDetails.customRemarks,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process payment");
      }

      toast({
        title: "Success",
        description: "Creator payment processed successfully",
        variant: "default",
      });

      // Refresh page after a delay to show updated payment status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error("Error paying Twitter creator:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSubmission((prev) => ({ ...prev, [creatorId]: false }));
    }
  };

  // Check if running in development/localhost
  const isDevelopment = () => {
    if (typeof window === "undefined") return false;
    return (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.includes("localhost")
    );
  };

  // Check cookie status for Instagram downloads (development only)
  const checkCookieStatus = async () => {
    if (!isDevelopment()) {
      console.log("🍪 [DEBUG] Not in development mode, skipping cookie check");
      return null;
    }

    try {
      console.log("🍪 [DEBUG] Checking cookie status...");
      const response = await fetch(
        `/api/admin/download-reel?checkCookies=true`
      );

      if (response.ok) {
        const data = await response.json();
        console.log("🍪 [DEBUG] Cookie status response:", data);
        return data;
      } else {
        console.warn(
          "🍪 [DEBUG] Cookie status check failed:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.warn("🍪 [DEBUG] Error response:", errorText);
      }
    } catch (error) {
      console.error("🍪 [DEBUG] Failed to check cookie status:", error);
    }
    return null;
  };

  // Log cookie information to console (development only)
  const logCookieStatus = (cookieData: any, isInstagram: boolean) => {
    console.log("🍪 [DEBUG] logCookieStatus called with:", {
      cookieData,
      isInstagram,
      isDev: isDevelopment(),
    });

    if (!isDevelopment() || !isInstagram) {
      console.log(
        "🍪 [DEBUG] Skipping logCookieStatus - not dev or not Instagram"
      );
      return;
    }

    console.group("🍪 Instagram Cookie Status");
    console.log("Source:", cookieData?.source || "unknown");
    console.log("Status:", cookieData?.status || "unknown");
    console.log("Message:", cookieData?.message || "N/A");

    if (cookieData?.cookies) {
      const cookies = cookieData.cookies;
      console.log("Cookie Details:", {
        exists: cookies.exists,
        valid: cookies.valid,
        hasSessionId: cookies.hasSessionId,
        hasCsrfToken: cookies.hasCsrfToken,
        expired: cookies.expired,
        expiresSoon: cookies.expiresSoon,
        path: cookies.path,
        error: cookies.error,
      });
    }

    if (cookieData?.recommendations && cookieData.recommendations.length > 0) {
      console.warn("Recommendations:", cookieData.recommendations);
    }
    console.groupEnd();
  };

  const handleDownloadReel = async (submissionId: string) => {
    const requestStartTime = Date.now();
    console.log(
      `[DOWNLOAD] [DEBUG] Starting download for submission: ${submissionId}`
    );

    // Set loading state
    setDownloadingSubmissionId(submissionId);

    try {
      // Find the submission to check if it's Instagram
      const submission = currentSubmissions.find((s) => s.id === submissionId);
      const isInstagram =
        submission?.content_link?.includes("instagram.com") || false;

      console.log(`[DOWNLOAD] [DEBUG] Submission details:`, {
        submissionId,
        found: !!submission,
        contentLink: submission?.content_link,
        isInstagram,
        platform: submission?.platform,
      });

      // Check cookie status for Instagram downloads (development only)
      if (isInstagram) {
        console.log(
          "🍪 [DOWNLOAD] [DEBUG] Instagram submission detected, checking cookies..."
        );
        const cookieData = await checkCookieStatus();
        console.log("🍪 [DOWNLOAD] [DEBUG] Cookie data received:", cookieData);
        if (cookieData) {
          logCookieStatus(cookieData, isInstagram);
        } else {
          console.warn(
            "🍪 [DOWNLOAD] [DEBUG] No cookie data returned from checkCookieStatus"
          );
        }
      } else {
        console.log(
          "🍪 [DOWNLOAD] [DEBUG] Not an Instagram submission, skipping cookie check"
        );
      }

      toast({
        title: "Downloading...",
        description: "Please wait while downloading.",
      });

      const apiUrl = `/api/admin/download-reel?submissionId=${submissionId}`;
      console.log(`[DOWNLOAD] [DEBUG] Fetching from API: ${apiUrl}`);

      const fetchStartTime = Date.now();
      const response = await fetch(apiUrl);
      const fetchTime = Date.now() - fetchStartTime;

      console.log(`[DOWNLOAD] [DEBUG] API response received:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        fetchTime: `${fetchTime}ms`,
        headers: Object.fromEntries(response.headers.entries()),
      });

      const contentType = response.headers.get("content-type");
      console.log(`[DOWNLOAD] [DEBUG] Content-Type: ${contentType}`);

      // Log cookie status from response headers (development only)
      if (isDevelopment() && isInstagram) {
        const cookieStatus = response.headers.get("X-Cookie-Status");
        const cookieWarning = response.headers.get("X-Cookie-Warning");
        if (cookieStatus) {
          console.log(
            "🍪 [DOWNLOAD] Cookie Status from Response:",
            cookieStatus
          );
          if (cookieWarning) {
            console.warn("⚠️ [DOWNLOAD] Cookie Warning:", cookieWarning);
          }
        }
      }

      if (!response.ok || contentType?.includes("application/json")) {
        // Handle error response
        console.error(
          `[DOWNLOAD] [ERROR] API returned error status: ${response.status}`
        );
        let errorData;
        try {
          const responseText = await response.text();
          console.log(`[DOWNLOAD] [DEBUG] Error response body:`, responseText);
          errorData = JSON.parse(responseText);
          console.log(`[DOWNLOAD] [DEBUG] Parsed error data:`, errorData);
        } catch (parseError: any) {
          console.error(
            `[DOWNLOAD] [ERROR] Failed to parse error response:`,
            parseError
          );
          // If response is not JSON, create a generic error
          errorData = {
            error: `Failed to download video (HTTP ${response.status}). Please try again.`,
          };
        }

        // Show error toast with message from API
        console.error(`[DOWNLOAD] [ERROR] Download failed:`, {
          error: errorData.error,
          reason: errorData.reason,
          suggestions: errorData.suggestions,
          debug: errorData.debug,
        });

        toast({
          title: "Download Failed",
          description:
            errorData.error || "Failed to download video. Please try again.",
          variant: "destructive",
        });
        setDownloadingSubmissionId(null);
        return;
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "video.mp4";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      console.log(`[DOWNLOAD] [DEBUG] Filename: ${filename}`);

      // Create blob and download
      console.log(`[DOWNLOAD] [DEBUG] Creating blob from response...`);
      const blobStartTime = Date.now();
      const blob = await response.blob();
      const blobTime = Date.now() - blobStartTime;
      console.log(`[DOWNLOAD] [DEBUG] Blob created:`, {
        size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
        type: blob.type,
        blobTime: `${blobTime}ms`,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const totalTime = Date.now() - requestStartTime;
      console.log(
        `[DOWNLOAD] [DEBUG] Download completed successfully in ${totalTime}ms`
      );

      toast({
        title: "Download Started",
        description: "Your video download has started.",
      });
      setDownloadingSubmissionId(null);
    } catch (error: any) {
      const totalTime = Date.now() - requestStartTime;
      console.error(`[DOWNLOAD] [ERROR] Error downloading reel:`, {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        submissionId,
        totalTime: `${totalTime}ms`,
      });
      toast({
        title: "Download Failed",
        description:
          error.message || "Failed to download video. Please try again.",
        variant: "destructive",
      });
      setDownloadingSubmissionId(null);
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

  // Fetch Twitter campaign metrics
  const fetchTwitterMetrics = async () => {
    if (!contestId) return;

    setLoadingMetrics(true);

    try {
      const response = await fetch(
        `/api/contests/${contestId}/twitter-metrics`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch Twitter metrics");
      }

      setTwitterMetrics(data.metrics || null);
    } catch (err: any) {
      console.error("Error fetching Twitter metrics:", err);
      setTwitterMetrics(null);
    } finally {
      setLoadingMetrics(false);
    }
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
      // Twitter refresh can take 60-90+ seconds (especially for raid campaigns with multiple API calls)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (2 minutes)

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

      // Refresh Twitter metrics after refresh
      if (currentContest.platform?.toLowerCase() === "twitter") {
        fetchTwitterMetrics();
      }

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

  // Helper function to determine if refresh should be disabled and why
  const getRefreshButtonState = () => {
    const isLocked = 
      currentContest.post_contest_status === "in_review" ||
      currentContest.post_contest_status === "verification_complete" ||
      currentContest.post_contest_status === "payouts_processed";
    
    const isDisabled = isRefreshingMetrics || !cooldownInfo.canRefresh || isLocked;
    
    let disabledReason = "";
    if (isRefreshingMetrics) {
      disabledReason = "Refreshing metrics...";
    } else if (isLocked) {
      disabledReason = "Metrics are locked after contest review begins";
    } else if (!cooldownInfo.canRefresh) {
      disabledReason = `Please wait ${cooldownInfo.remainingMinutes} more minute${cooldownInfo.remainingMinutes !== 1 ? "s" : ""}`;
    }
    
    return { isDisabled, disabledReason };
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
    if (lowerPlatform?.includes("twitter") || lowerPlatform?.includes("x.com"))
      return (
        <div className="flex items-center justify-center w-6 h-6">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#1DA1F2">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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
        avg_watch_time_ms: igStats.avg_watch_time_ms || 0,
        total_watch_time_ms: igStats.total_watch_time_ms || 0,
      };
    } else if (platform?.includes("twitter")) {
      const twitterStats = stats.twitter || stats;
      return {
        views: baseViews,
        likes: twitterStats.likes || twitterStats.favorites || 0,
        comments: twitterStats.replies || 0,
        shares: twitterStats.retweets || 0,
        impressions: twitterStats.impressions || 0,
        quote_reposts: twitterStats.quote_reposts || 0,
        engagement_rate: twitterStats.engagement_rate || 0,
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

  const formatWatchTime = (milliseconds: number): string => {
    if (!milliseconds || milliseconds === 0) return "0s";

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
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

  // Twitter moderation handlers
  const handleModerateTwitterTweet = async (
    tweetId: string,
    action: "approve" | "reject" | "pending",
    reason?: string
  ) => {
    setIsLoadingSubmission((prev) => ({ ...prev, [tweetId]: true }));
    try {
      const response = await fetch(
        `/api/contests/${contestId}/moderate-submission`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tweetId,
            action:
              action === "approve"
                ? "approve"
                : action === "reject"
                ? "reject"
                : "pending",
            reason:
              reason || (action === "reject" ? "Rejected by admin" : null),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to moderate tweet");
      }

      // Update local state
      setCurrentSubmissions((prev) =>
        prev.map((sub) =>
          sub.id === tweetId
            ? {
                ...sub,
                moderation_status:
                  action === "approve"
                    ? "verified"
                    : action === "reject"
                    ? "rejected"
                    : "pending",
              }
            : sub
        )
      );

      toast({
        title: "Success",
        description: `Tweet ${
          action === "approve"
            ? "approved"
            : action === "reject"
            ? "rejected"
            : "set to pending"
        } successfully`,
      });

      // Refresh page after a delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error("Error moderating tweet:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to moderate tweet",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSubmission((prev) => ({ ...prev, [tweetId]: false }));
    }
  };

  // Handle Twitter creator reversal confirmation
  const handleConfirmTwitterCreatorReversal = async () => {
    if (!confirmTwitterCreatorReversal) return;
    const { creatorId, action, needRejectionReason, creatorUsername } =
      confirmTwitterCreatorReversal;
    setConfirmTwitterCreatorReversal(null);

    if (needRejectionReason) {
      // After confirming reversal, open rejection reason modal
      setPendingTwitterRejection({
        id: creatorId,
        type: "creator",
        creatorId: creatorId,
        creatorUsername: creatorUsername,
      });
      setTwitterRejectionModalOpen(true);
      return;
    }

    // Execute the moderation action (reversal is handled in the API)
    setIsLoadingSubmission((prev) => ({
      ...prev,
      [creatorId]: true,
    }));

    try {
      const response = await fetch(
        `/api/contests/${contestId}/moderate-creator`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId: creatorId,
            action: action,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} creator`);
      }

      toast({
        title: "Success",
        description: `Creator ${
          action === "approve" ? "approved" : "rejected"
        } and payment reversed successfully`,
      });

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error(
        `Error ${action === "approve" ? "approving" : "rejecting"} creator:`,
        error
      );
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} creator`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingSubmission((prev) => {
        const newState = { ...prev };
        delete newState[creatorId];
        return newState;
      });
    }
  };

  // Handle Twitter rejection confirmation
  const handleTwitterRejectionConfirm = async (
    reason: string,
    additionalNotes?: string
  ) => {
    if (!pendingTwitterRejection) return;

    const fullReason = additionalNotes
      ? `${reason}\n\nAdditional Notes: ${additionalNotes}`
      : reason;

    if (pendingTwitterRejection.type === "creator") {
      // Use creator-level moderation API
      setIsLoadingSubmission((prev) => ({
        ...prev,
        [pendingTwitterRejection.creatorId || ""]: true,
      }));

      try {
        const response = await fetch(
          `/api/contests/${contestId}/moderate-creator`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              creatorId: pendingTwitterRejection.creatorId,
              action: "reject",
              reason: fullReason,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to reject creator");
        }

        toast({
          title: "Success",
          description: `Creator @${
            pendingTwitterRejection.creatorUsername || "creator"
          } has been rejected`,
        });

        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error: any) {
        console.error("Error rejecting creator:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to reject creator",
          variant: "destructive",
        });
      } finally {
        setIsLoadingSubmission((prev) => {
          const newState = { ...prev };
          delete newState[pendingTwitterRejection.creatorId || ""];
          return newState;
        });
      }
    } else {
      // Reject single tweet
      await handleModerateTwitterTweet(
        pendingTwitterRejection.id,
        "reject",
        fullReason
      );
    }

    setTwitterRejectionModalOpen(false);
    setPendingTwitterRejection(null);
  };

  const handleRejectTwitterTweet = (tweetId: string) => {
    setPendingRejectionSubmission(tweetId);
    setRejectionModalOpen(true);
  };

  // Manual points adjustment handler
  const handleManualPointsConfirm = async (points: number, reason: string) => {
    if (!pendingManualPointsSubmission) return;

    setIsLoadingSubmission((prev) => ({
      ...prev,
      [pendingManualPointsSubmission.id]: true,
    }));

    try {
      const response = await fetch(
        `/api/contests/${contestId}/adjust-manual-points`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adjustmentType:
              pendingManualPointsSubmission.type === "tweet"
                ? "twitter_tweet"
                : "twitter_leaderboard",
            tweetId:
              pendingManualPointsSubmission.type === "tweet"
                ? pendingManualPointsSubmission.id
                : undefined,
            creatorId:
              pendingManualPointsSubmission.type === "leaderboard"
                ? pendingManualPointsSubmission.creatorId
                : undefined,
            points,
            reason,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to adjust points");
      }

      toast({
        title: "Success",
        description: `Points adjusted successfully`,
      });

      setManualPointsModalOpen(false);
      setPendingManualPointsSubmission(null);

      // Refresh page after a delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error("Error adjusting points:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to adjust points",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSubmission((prev) => ({
        ...prev,
        [pendingManualPointsSubmission.id]: false,
      }));
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
    currentContest?.status !== "ended" && // Never allow editing ended contests
    (isAdminView || // Admins can edit non-ended contests
      currentContest?.moderation_status === "draft" ||
      currentContest?.moderation_status === "rejected" ||
      currentContest?.moderation_status === "pending_approval" ||
      (currentContest?.moderation_status === "approved" &&
        currentContest?.status === "upcoming"));
  const isContestDeletable =
    currentContest?.moderation_status === "draft" ||
    currentContest?.moderation_status === "rejected" ||
    currentContest?.moderation_status === "pending_approval";

  if (!currentContest) {
    return <p>Loading contest details or contest not found...</p>;
  }

  const contestStatusBadgeInfo = getStatusBadgeProps(currentContest);

  return (
    <div>
      <div className="flex flex-col px-1 lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
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
                  <DialogTitle
                    className={cn(isDark ? "text-white" : "text-gray-900")}
                  >
                    Update Contest Status
                  </DialogTitle>
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
                    <label
                      htmlFor="status"
                      className={cn(
                        "text-sm font-medium",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
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
                    <label
                      htmlFor="reason"
                      className={cn(
                        "text-sm font-medium",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
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
                      "w-full text-md rounded-full flex items-center justify-center",
                      isDark
                        ? "bg-[#7F39EC] py-3 text-white"
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
                  {!isUpdatingStatus && (
                    <button
                      onClick={() => setStatusUpdateDialog(false)}
                      className={cn(
                        "w-full text-md rounded-full",
                        isDark
                          ? "py-3 border border-[#FF5353] text-[#FF5353]"
                          : "bg-[#FF323224] text-[#E50000] py-3"
                      )}
                    >
                      Cancel
                    </button>
                  )}
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
                href={
                  isAdminView
                    ? `/dashboard/admin/contests/${contestId}/edit`
                    : `/dashboard/contests/${contestId}/edit`
                }
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
          <div
            className={cn(
              "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
              isDark
                ? "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-purple-500/20"
                : "bg-gradient-to-br from-white to-gray-50 border border-gray-100"
            )}
          >
            <div className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div
                  className={cn(
                    "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm",
                    isDark
                      ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                      : "bg-white border border-gray-200"
                  )}
                >
                  {getPlatformIcon(currentContest.platform)}
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-sm font-medium uppercase tracking-wide",
                      isDark ? "text-white/90 drop-shadow-sm" : "text-gray-500"
                    )}
                  >
                    Platform
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold mt-1",
                      isDark
                        ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent"
                        : "text-gray-900"
                    )}
                  >
                    {currentContest.platform || "N/A"}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  "h-1 w-full rounded-full",
                  isDark
                    ? "bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 shadow-lg shadow-purple-400/70 animate-pulse"
                    : "bg-gradient-to-r from-purple-200 to-purple-300"
                )}
              ></div>
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
          <div
            className={cn(
              "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
              isDark
                ? "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-blue-500/20"
                : "bg-gradient-to-br from-white to-blue-50 border border-blue-100"
            )}
          >
            <div className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div
                  className={cn(
                    "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm",
                    isDark
                      ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                      : "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                  )}
                >
                  <Calendar
                    className={cn(
                      "h-6 w-6",
                      isDark ? "text-white" : "text-white"
                    )}
                  />
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-sm font-medium uppercase tracking-wide",
                      isDark ? "text-white/90 drop-shadow-sm" : "text-gray-500"
                    )}
                  >
                    Duration
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold mt-1",
                      isDark
                        ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent"
                        : "text-gray-900"
                    )}
                  >
                    {durationDays !== null
                      ? `${durationDays} ${durationDays === 1 ? "day" : "days"}`
                      : "N/A"}
                  </p>
                </div>
              </div>
              {currentContest.start_date && currentContest.end_date && (
                <div className="mb-3">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isDark ? "text-white/80 drop-shadow-sm" : "text-gray-600"
                    )}
                  >
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
              <div
                className={cn(
                  "h-1 w-full rounded-full",
                  isDark
                    ? "bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 shadow-lg shadow-blue-400/70 animate-pulse"
                    : "bg-gradient-to-r from-blue-200 to-blue-300"
                )}
              ></div>
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
              <div
                className={cn(
                  "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
                  isDark
                    ? "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-yellow-500/20"
                    : "bg-gradient-to-br from-white to-yellow-50 border border-yellow-100"
                )}
              >
                <div className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={cn(
                        "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm",
                        isDark
                          ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                          : "bg-gradient-to-br from-yellow-500 to-yellow-600 text-white"
                      )}
                    >
                      <Trophy
                        className={cn(
                          "h-6 w-6",
                          isDark ? "text-white" : "text-white"
                        )}
                      />
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-medium uppercase tracking-wide",
                          isDark
                            ? "text-white/90 drop-shadow-sm"
                            : "text-gray-500"
                        )}
                      >
                        Prize Pool
                      </p>
                      <p
                        className={cn(
                          "text-2xl font-bold mt-1",
                          isDark
                            ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-yellow-200 bg-clip-text text-transparent"
                            : "text-gray-900"
                        )}
                      >
                        {formatMoney(
                          currentContest.contest_based_details
                            .leaderboard_contest.total_prize
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isDark
                          ? "text-white/80 drop-shadow-sm"
                          : "text-gray-600"
                      )}
                    >
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
                    <div
                      className={cn(
                        "pt-4 mb-4",
                        isDark
                          ? "border-t border-white/30"
                          : "border-t border-yellow-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-sm font-medium uppercase tracking-wide",
                              isDark
                                ? "text-white/90 drop-shadow-sm"
                                : "text-gray-500"
                            )}
                          >
                            Total Budget
                          </p>
                          <p
                            className={cn(
                              "text-xl font-bold mt-1",
                              isDark
                                ? "text-cyan-300 drop-shadow-sm"
                                : "text-blue-600"
                            )}
                          >
                            {formatMoney(
                              currentContest.contest_based_details
                                .leaderboard_contest.total_budget
                            )}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-1",
                              isDark
                                ? "text-white/70 drop-shadow-sm"
                                : "text-gray-600"
                            )}
                          >
                            For bonuses & extras
                          </p>
                        </div>
                        <div
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-lg",
                            isDark
                              ? "bg-cyan-400/30 text-cyan-300 backdrop-blur-sm"
                              : "bg-blue-100 text-blue-600"
                          )}
                        >
                          <span className="text-lg">💰</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      "h-1 w-full rounded-full",
                      isDark
                        ? "bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 shadow-lg shadow-yellow-400/70 animate-pulse"
                        : "bg-gradient-to-r from-yellow-200 to-yellow-300"
                    )}
                  ></div>
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

          {/* Campaign Type Card - Show for Twitter text_image contests */}
          {(() => {
            const isTwitterTextImage =
              (currentContest?.platform?.toLowerCase() === "twitter" ||
                currentContest?.platform?.toLowerCase() === "x") &&
              currentContest?.contest_format === "text_image";

            if (isTwitterTextImage) {
              const campaignType =
                currentContest?.contest_based_details?.twitter_campaign
                  ?.campaign_type;
              if (campaignType === "raid" || campaignType === "awareness") {
                return (
                  <div
                    className={cn(
                      "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
                      isDark
                        ? campaignType === "raid"
                          ? "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-red-500/20"
                          : "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-cyan-500/20"
                        : campaignType === "raid"
                        ? "bg-gradient-to-br from-white to-red-50 border border-red-100"
                        : "bg-gradient-to-br from-white to-cyan-50 border border-cyan-100"
                    )}
                  >
                    <div className="p-6 relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className={cn(
                            "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm",
                            isDark
                              ? campaignType === "raid"
                                ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                : "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                              : campaignType === "raid"
                              ? "bg-gradient-to-br from-red-500 to-red-600 text-white"
                              : "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white"
                          )}
                        >
                          <Tag
                            className={cn(
                              "h-6 w-6",
                              isDark ? "text-white" : "text-white"
                            )}
                          />
                        </div>
                        <div className="text-right">
                          <p
                            className={cn(
                              "text-sm font-medium uppercase tracking-wide",
                              isDark
                                ? campaignType === "raid"
                                  ? "text-white/90 drop-shadow-sm"
                                  : "text-white/90 drop-shadow-sm"
                                : campaignType === "raid"
                                ? "text-gray-500"
                                : "text-gray-500"
                            )}
                          >
                            Campaign Type
                          </p>
                          <p
                            className={cn(
                              "text-2xl font-bold mt-1",
                              isDark
                                ? campaignType === "raid"
                                  ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-red-200 bg-clip-text text-transparent"
                                  : "text-white drop-shadow-lg bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent"
                                : campaignType === "raid"
                                ? "text-gray-900"
                                : "text-gray-900"
                            )}
                          >
                            {campaignType === "raid" ? "Raid" : "Awareness"}
                          </p>
                        </div>
                      </div>
                      <div className="mb-4">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isDark
                              ? campaignType === "raid"
                                ? "text-white/80 drop-shadow-sm"
                                : "text-white/80 drop-shadow-sm"
                              : campaignType === "raid"
                              ? "text-gray-600"
                              : "text-gray-600"
                          )}
                        >
                          {campaignType === "raid"
                            ? "Raid Campaign"
                            : "Awareness Campaign"}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "h-1 w-full rounded-full",
                          isDark
                            ? campaignType === "raid"
                              ? "bg-gradient-to-r from-red-400 via-pink-400 to-orange-400 shadow-lg shadow-red-400/70 animate-pulse"
                              : "bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 shadow-lg shadow-cyan-400/70 animate-pulse"
                            : campaignType === "raid"
                            ? "bg-gradient-to-r from-red-200 to-red-300"
                            : "bg-gradient-to-r from-cyan-200 to-cyan-300"
                        )}
                      ></div>
                    </div>
                  </div>
                );
              }
            }
            return null;
          })()}

          {/* Participants Card - Show for Twitter text_image contests */}
          {(() => {
            const isTwitterTextImage =
              (currentContest?.platform?.toLowerCase() === "twitter" ||
                currentContest?.platform?.toLowerCase() === "x") &&
              currentContest?.contest_format === "text_image";

            if (isTwitterTextImage) {
              const participantsCount = twitterMetrics?.total_participants || 0;
              const maxParticipants =
                twitterMetrics?.max_participants ||
                currentContest?.contest_based_details?.twitter_campaign
                  ?.max_participants;
              const displayValue = maxParticipants
                ? `${participantsCount} / ${maxParticipants}`
                : participantsCount;

              return (
                <div
                  className={cn(
                    "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
                    isDark
                      ? "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-purple-500/20"
                      : "bg-gradient-to-br from-white to-purple-50 border border-purple-100"
                  )}
                >
                  <div className="p-6 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={cn(
                          "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm",
                          isDark
                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                            : "bg-gradient-to-br from-purple-500 to-purple-600 text-white"
                        )}
                      >
                        <Users
                          className={cn(
                            "h-6 w-6",
                            isDark ? "text-white" : "text-white"
                          )}
                        />
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-medium uppercase tracking-wide",
                            isDark
                              ? "text-white/90 drop-shadow-sm"
                              : "text-gray-500"
                          )}
                        >
                          Participants
                        </p>
                        <p
                          className={cn(
                            "text-2xl font-bold mt-1",
                            isDark
                              ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent"
                              : "text-gray-900"
                          )}
                        >
                          {displayValue}
                        </p>
                      </div>
                    </div>
                    <div className="mb-4">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isDark
                            ? "text-white/80 drop-shadow-sm"
                            : "text-gray-600"
                        )}
                      >
                        {maxParticipants
                          ? "Joined / Max limit"
                          : "Total joined"}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "h-1 w-full rounded-full",
                        isDark
                          ? "bg-gradient-to-r from-purple-400 via-indigo-400 to-violet-400 shadow-lg shadow-purple-400/70 animate-pulse"
                          : "bg-gradient-to-r from-purple-200 to-purple-300"
                      )}
                    ></div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {currentContest.contest_type === "cpm" &&
            currentContest.contest_based_details?.cpm_contest?.total_budget !=
              null && (
              <div
                className={cn(
                  "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
                  isDark
                    ? "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-emerald-500/20"
                    : "bg-white border border-gray-100"
                )}
              >
                <div className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={cn(
                        "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm",
                        isDark
                          ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                          : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                      )}
                    >
                      <DollarSign
                        className={cn(
                          "h-6 w-6",
                          isDark ? "text-white" : "text-white"
                        )}
                      />
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-medium uppercase tracking-wide",
                          isDark
                            ? "text-white/90 drop-shadow-sm"
                            : "text-gray-500"
                        )}
                      >
                        Total Budget
                      </p>
                      <p
                        className={cn(
                          "text-2xl font-bold mt-1",
                          isDark
                            ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent"
                            : "text-gray-900"
                        )}
                      >
                        {formatMoney(
                          currentContest.contest_based_details.cpm_contest
                            .total_budget
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isDark
                          ? "text-white/80 drop-shadow-sm"
                          : "text-gray-600"
                      )}
                    >
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
                      "h-1 w-full rounded-full",
                      isDark
                        ? "bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 shadow-lg shadow-emerald-400/70 animate-pulse"
                        : "bg-gradient-to-r from-emerald-200 to-emerald-300"
                    )}
                  ></div>
                </div>
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
        </div>

        {/* Budget Progress Tracker - Two-Color Visualization (CPM) */}
        {currentContest.contest_type === "cpm" &&
          currentContest.contest_based_details?.cpm_contest?.total_budget !=
            null &&
          currentContest.contest_based_details.cpm_contest.total_budget > 0 && (
            <div
              className={cn(
                "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
                isDark
                  ? "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-indigo-500/20"
                  : "bg-gradient-to-br from-white to-indigo-50 border border-indigo-100"
              )}
            >
              <div className="p-6 relative z-10">
                <div className="flex items-center mb-4">
                  <div
                    className={cn(
                      "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm mr-4",
                      isDark
                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                        : "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white"
                    )}
                  >
                    <BarChart3
                      className={cn(
                        "h-6 w-6",
                        isDark ? "text-white" : "text-white"
                      )}
                    />
                  </div>
                  <div>
                    <h3
                      className={cn(
                        "text-lg font-bold",
                        isDark
                          ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent"
                          : "text-gray-900"
                      )}
                    >
                      Budget Tracker
                    </h3>
                    <p
                      className={cn(
                        "text-sm",
                        isDark
                          ? "text-white/80 drop-shadow-sm"
                          : "text-gray-600"
                      )}
                    >
                      Monitor spending progress
                    </p>
                  </div>
                </div>
                <BudgetProgress
                  contest={{
                    total_budget:
                      currentContest.contest_based_details.cpm_contest
                        .total_budget,
                    contest_based_details: currentContest.contest_based_details,
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
            <div
              className={cn(
                "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
                isDark
                  ? "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-emerald-500/20"
                  : "bg-gradient-to-br from-white to-emerald-50 border border-emerald-100"
              )}
            >
              <div className="p-6 relative z-10">
                <div className="flex items-center mb-4">
                  <div
                    className={cn(
                      "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm mr-4",
                      isDark
                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                        : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                    )}
                  >
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3
                      className={cn(
                        "text-lg font-bold",
                        isDark
                          ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent"
                          : "text-gray-900"
                      )}
                    >
                      Budget Tracker
                    </h3>
                    <p
                      className={cn(
                        "text-sm",
                        isDark
                          ? "text-white/80 drop-shadow-sm"
                          : "text-gray-600"
                      )}
                    >
                      Monitor bonus spending progress
                    </p>
                  </div>
                </div>
                <BudgetProgress
                  contest={{
                    total_budget:
                      currentContest.contest_based_details.leaderboard_contest
                        .total_budget,
                    contest_based_details: currentContest.contest_based_details,
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
        <div
          className={cn(
            "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
            isDark
              ? "bg-[#180438] border border-white/20 backdrop-blur-2xl shadow-2xl shadow-purple-500/20"
              : "bg-gradient-to-br from-white to-purple-50 border border-purple-100"
          )}
        >
          <div className="p-6 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div
                className={cn(
                  "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm",
                  isDark
                    ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                    : "bg-gradient-to-br from-purple-500 to-purple-600 text-white"
                )}
              >
                <Users
                  className={cn(
                    "h-6 w-6",
                    isDark ? "text-white" : "text-white"
                  )}
                />
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-medium uppercase tracking-wide",
                    isDark ? "text-white/90 drop-shadow-sm" : "text-gray-500"
                  )}
                >
                  Submissions
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold mt-1",
                    isDark
                      ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent"
                      : "text-gray-900"
                  )}
                >
                  {currentSubmissions.length}
                </p>
              </div>
            </div>
            <div className="mb-4">
              <p
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-white/80 drop-shadow-sm" : "text-gray-600"
                )}
              >
                Total entries
              </p>
            </div>
            <div
              className={cn(
                "h-1 w-full rounded-full",
                isDark
                  ? "bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 shadow-lg shadow-purple-400/70 animate-pulse"
                  : "bg-gradient-to-r from-purple-200 to-purple-300"
              )}
            ></div>
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
                        className="max-w-full max-h-80 object-contain shadow-sm"
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
                          ? "bg-[#170337] text-white border-gray-600 [&_*]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_em]:!text-white [&_a]:!text-blue-300 [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white [&_table]:!text-white [&_th]:!text-white [&_td]:!text-white"
                          : "bg-white text-foreground"
                      )}
                      style={isDark ? { color: "white" } : undefined}
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

                {/* Regions Card */}
                {currentContest.region &&
                  Object.keys(currentContest.region).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg text-foreground">
                        Available Regions
                      </h3>
                      <div
                        className={cn(
                          "border rounded-xl transition-all duration-300",
                          isDark ? "border-gray-600" : "border-gray-300"
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div
                              className={cn(
                                "w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0",
                                isDark
                                  ? "bg-[#FFFFFF42] text-white"
                                  : "bg-purple-100 text-[#4A00BE]"
                              )}
                            >
                              <Globe className="h-5 w-5" />
                            </div>
                            <div className="flex-1 space-y-3">
                              {Object.entries(currentContest.region).map(
                                ([regionName, countries]) => (
                                  <div
                                    key={regionName}
                                    className={cn(
                                      "p-3 rounded-lg border",
                                      isDark
                                        ? "bg-[#170337] border-gray-600"
                                        : "bg-gray-50 border-gray-200"
                                    )}
                                  >
                                    <p
                                      className={cn(
                                        "font-semibold text-base mb-2",
                                        isDark ? "text-white" : "text-gray-900"
                                      )}
                                    >
                                      {regionName}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {countries.map((country) => (
                                        <Badge
                                          key={country}
                                          variant="secondary"
                                          className={cn(
                                            "text-xs",
                                            isDark
                                              ? "bg-gray-700 text-gray-200 border-gray-600"
                                              : "bg-white text-gray-700 border-gray-300"
                                          )}
                                        >
                                          {country}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    </div>
                  )}

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
                                        "w-8 h-8 rounded-full flex items-center justify-center border font-bold text-sm",
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
                            "flex justify-between items-center p-3 rounded-md border",
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
                            "flex justify-between items-center p-3 rounded-md border",
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
                          <div
                            className={cn(
                              "flex justify-between items-center p-3 rounded-md border",
                              isDark ? "border-gray-600" : "border-gray-400"
                            )}
                          >
                            <span
                              className={cn(
                                "text-md font-medium",
                                isDark ? "text-white" : "text-black"
                              )}
                            >
                              Min Views:
                            </span>
                            <span className="font-semibold text-md text-foreground">
                              {currentContest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {currentContest.contest_based_details.cpm_contest
                          .max_views != null && (
                          <div
                            className={cn(
                              "flex justify-between items-center p-3 rounded-md border",
                              isDark ? "border-gray-600" : "border-gray-400"
                            )}
                          >
                            <span
                              className={cn(
                                "text-md font-medium",
                                isDark ? "text-white" : "text-black"
                              )}
                            >
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

                {/* Points Configuration */}
                {(() => {
                  // Check for Twitter CPM points config
                  const twitterPointsConfig =
                    currentContest.contest_based_details?.twitter_campaign
                      ?.points_config;
                  // Check for CPM contest points config
                  const cpmPointsConfig =
                    currentContest.contest_based_details?.cpm_contest
                      ?.points_config;
                  
                  const hasPointsConfig =
                    (twitterPointsConfig &&
                      Object.keys(twitterPointsConfig).length > 0) ||
                    (cpmPointsConfig &&
                      Object.keys(cpmPointsConfig).length > 0);

                  if (!hasPointsConfig) return null;

                  return (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg text-foreground">
                        Points Configuration
                      </h3>
                      <div className="space-y-4">
                        {/* Twitter CPM Points Config */}
                        {twitterPointsConfig && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-foreground/80">
                              Base Weights
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {twitterPointsConfig.likes_weight != null && (
                                <div
                                  className={cn(
                                    "flex justify-between items-center p-3 rounded-md border",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-400"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-black"
                                    )}
                                  >
                                    Likes Weight:
                                  </span>
                                  <span className="font-semibold text-sm text-foreground">
                                    {typeof twitterPointsConfig.likes_weight ===
                                    "number"
                                      ? twitterPointsConfig.likes_weight.toFixed(
                                          2
                                        )
                                      : twitterPointsConfig.likes_weight}
                                  </span>
                                </div>
                              )}
                              {twitterPointsConfig.comments_weight != null && (
                                <div
                                  className={cn(
                                    "flex justify-between items-center p-3 rounded-md border",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-400"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-black"
                                    )}
                                  >
                                    Comments Weight:
                                  </span>
                                  <span className="font-semibold text-sm text-foreground">
                                    {typeof twitterPointsConfig
                                      .comments_weight === "object"
                                      ? twitterPointsConfig.comments_weight
                                          .base_weight?.toFixed(2) ||
                                        "N/A"
                                      : typeof twitterPointsConfig
                                            .comments_weight === "number"
                                        ? twitterPointsConfig.comments_weight.toFixed(
                                            2
                                          )
                                        : twitterPointsConfig.comments_weight}
                                  </span>
                                </div>
                              )}
                              {twitterPointsConfig.retweets_weight != null && (
                                <div
                                  className={cn(
                                    "flex justify-between items-center p-3 rounded-md border",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-400"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-black"
                                    )}
                                  >
                                    Retweets Weight:
                                  </span>
                                  <span className="font-semibold text-sm text-foreground">
                                    {typeof twitterPointsConfig
                                      .retweets_weight === "object"
                                      ? twitterPointsConfig.retweets_weight
                                          .base_weight?.toFixed(2) ||
                                        "N/A"
                                      : typeof twitterPointsConfig
                                            .retweets_weight === "number"
                                        ? twitterPointsConfig.retweets_weight.toFixed(
                                            2
                                          )
                                        : twitterPointsConfig.retweets_weight}
                                  </span>
                                </div>
                              )}
                              {twitterPointsConfig.quote_reposts_weight !=
                                null && (
                                <div
                                  className={cn(
                                    "flex justify-between items-center p-3 rounded-md border",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-400"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-black"
                                    )}
                                  >
                                    Quote Reposts Weight:
                                  </span>
                                  <span className="font-semibold text-sm text-foreground">
                                    {typeof twitterPointsConfig
                                      .quote_reposts_weight === "object"
                                      ? twitterPointsConfig.quote_reposts_weight
                                          .base_weight?.toFixed(2) ||
                                        "N/A"
                                      : typeof twitterPointsConfig
                                            .quote_reposts_weight === "number"
                                        ? twitterPointsConfig.quote_reposts_weight.toFixed(
                                            2
                                          )
                                        : twitterPointsConfig.quote_reposts_weight}
                                  </span>
                                </div>
                              )}
                              {twitterPointsConfig.impressions_weight !=
                                null && (
                                <div
                                  className={cn(
                                    "flex justify-between items-center p-3 rounded-md border",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-400"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-black"
                                    )}
                                  >
                                    Impressions Weight:
                                  </span>
                                  <span className="font-semibold text-sm text-foreground">
                                    {typeof twitterPointsConfig
                                      .impressions_weight === "number"
                                      ? twitterPointsConfig.impressions_weight.toFixed(
                                          2
                                        )
                                      : twitterPointsConfig.impressions_weight}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Engagement Multipliers */}
                            {(() => {
                              const commentsWeightObj =
                                typeof twitterPointsConfig.comments_weight ===
                                "object"
                                  ? twitterPointsConfig.comments_weight
                                  : null;
                              const retweetsWeightObj =
                                typeof twitterPointsConfig.retweets_weight ===
                                "object"
                                  ? twitterPointsConfig.retweets_weight
                                  : null;
                              const quoteRepostsWeightObj =
                                typeof twitterPointsConfig.quote_reposts_weight ===
                                "object"
                                  ? twitterPointsConfig.quote_reposts_weight
                                  : null;

                              const hasMultipliers =
                                (commentsWeightObj &&
                                  Object.keys(commentsWeightObj).some(
                                    (k) => k !== "base_weight"
                                  )) ||
                                (retweetsWeightObj &&
                                  Object.keys(retweetsWeightObj).some(
                                    (k) => k !== "base_weight"
                                  )) ||
                                (quoteRepostsWeightObj &&
                                  Object.keys(quoteRepostsWeightObj).some(
                                    (k) => k !== "base_weight"
                                  ));

                              if (!hasMultipliers) return null;

                              return (
                                <div className="space-y-3 mt-4">
                                  <h4 className="text-sm font-medium text-foreground/80">
                                    Engagement Multipliers
                                  </h4>
                                  
                                  {/* Comment Multipliers */}
                                  {commentsWeightObj &&
                                    Object.keys(commentsWeightObj).some(
                                      (k) => k !== "base_weight"
                                    ) && (
                                      <div className="space-y-2">
                                        <h5 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                                          Comment Engagement
                                        </h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                          {commentsWeightObj.likes_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Likes:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {commentsWeightObj.likes_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {commentsWeightObj.replies_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Replies:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {commentsWeightObj.replies_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {commentsWeightObj.impressions_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Impressions:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {commentsWeightObj.impressions_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {commentsWeightObj.retweets_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Retweets:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {commentsWeightObj.retweets_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {commentsWeightObj.quote_reposts_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Quote Reposts:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {commentsWeightObj.quote_reposts_multiplier}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                  {/* Retweet Multipliers */}
                                  {retweetsWeightObj &&
                                    Object.keys(retweetsWeightObj).some(
                                      (k) => k !== "base_weight"
                                    ) && (
                                      <div className="space-y-2">
                                        <h5 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                                          Retweet Engagement
                                        </h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                          {retweetsWeightObj.likes_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Likes:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {retweetsWeightObj.likes_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {retweetsWeightObj.replies_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Replies:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {retweetsWeightObj.replies_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {retweetsWeightObj.impressions_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Impressions:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {retweetsWeightObj.impressions_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {retweetsWeightObj.retweets_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Retweets:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {retweetsWeightObj.retweets_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {retweetsWeightObj.quote_reposts_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Quote Reposts:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {retweetsWeightObj.quote_reposts_multiplier}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                  {/* Quote Repost Multipliers */}
                                  {quoteRepostsWeightObj &&
                                    Object.keys(quoteRepostsWeightObj).some(
                                      (k) => k !== "base_weight"
                                    ) && (
                                      <div className="space-y-2">
                                        <h5 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                                          Quote Repost Engagement
                                        </h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                          {quoteRepostsWeightObj.likes_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Likes:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {quoteRepostsWeightObj.likes_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {quoteRepostsWeightObj.replies_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Replies:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {quoteRepostsWeightObj.replies_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {quoteRepostsWeightObj.impressions_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Impressions:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {quoteRepostsWeightObj.impressions_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {quoteRepostsWeightObj.retweets_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Retweets:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {quoteRepostsWeightObj.retweets_multiplier}
                                              </span>
                                            </div>
                                          )}
                                          {quoteRepostsWeightObj.quote_reposts_multiplier !=
                                            null && (
                                            <div
                                              className={cn(
                                                "flex justify-between items-center p-2 rounded-md border text-xs",
                                                isDark
                                                  ? "border-gray-700"
                                                  : "border-gray-300"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-700"
                                                )}
                                              >
                                                Quote Reposts:
                                              </span>
                                              <span className="font-medium text-xs text-foreground">
                                                {quoteRepostsWeightObj.quote_reposts_multiplier}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* CPM Contest Points Config */}
                        {cpmPointsConfig && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-foreground/80">
                              Base Points
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {cpmPointsConfig.comment_base_points != null && (
                                <div
                                  className={cn(
                                    "flex justify-between items-center p-3 rounded-md border",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-400"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-black"
                                    )}
                                  >
                                    Comment Base Points:
                                  </span>
                                  <span className="font-semibold text-sm text-foreground">
                                    {cpmPointsConfig.comment_base_points}
                                  </span>
                                </div>
                              )}
                              {cpmPointsConfig.retweet_base_points != null && (
                                <div
                                  className={cn(
                                    "flex justify-between items-center p-3 rounded-md border",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-400"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-black"
                                    )}
                                  >
                                    Retweet Base Points:
                                  </span>
                                  <span className="font-semibold text-sm text-foreground">
                                    {cpmPointsConfig.retweet_base_points}
                                  </span>
                                </div>
                              )}
                              {cpmPointsConfig.quote_repost_base_points !=
                                null && (
                                <div
                                  className={cn(
                                    "flex justify-between items-center p-3 rounded-md border",
                                    isDark
                                      ? "border-gray-600"
                                      : "border-gray-400"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-black"
                                    )}
                                  >
                                    Quote Repost Base Points:
                                  </span>
                                  <span className="font-semibold text-sm text-foreground">
                                    {cpmPointsConfig.quote_repost_base_points}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Engagement Multipliers for CPM */}
                            {(() => {
                              const hasCommentMultipliers =
                                cpmPointsConfig.comment_likes_multiplier !=
                                  null ||
                                cpmPointsConfig.comment_replies_multiplier !=
                                  null ||
                                cpmPointsConfig.comment_impressions_multiplier !=
                                  null ||
                                cpmPointsConfig.comment_retweets_multiplier !=
                                  null ||
                                cpmPointsConfig.comment_quote_reposts_multiplier !=
                                  null;

                              const hasRetweetMultipliers =
                                cpmPointsConfig.retweet_likes_multiplier !=
                                  null ||
                                cpmPointsConfig.retweet_replies_multiplier !=
                                  null ||
                                cpmPointsConfig.retweet_impressions_multiplier !=
                                  null ||
                                cpmPointsConfig.retweet_retweets_multiplier !=
                                  null ||
                                cpmPointsConfig.retweet_quote_reposts_multiplier !=
                                  null;

                              const hasQuoteRepostMultipliers =
                                cpmPointsConfig.quote_repost_likes_multiplier !=
                                  null ||
                                cpmPointsConfig.quote_repost_replies_multiplier !=
                                  null ||
                                cpmPointsConfig.quote_repost_impressions_multiplier !=
                                  null ||
                                cpmPointsConfig.quote_repost_retweets_multiplier !=
                                  null ||
                                cpmPointsConfig.quote_repost_quote_reposts_multiplier !=
                                  null;

                              if (
                                !hasCommentMultipliers &&
                                !hasRetweetMultipliers &&
                                !hasQuoteRepostMultipliers
                              )
                                return null;

                              return (
                                <div className="space-y-3 mt-4">
                                  <h4 className="text-sm font-medium text-foreground/80">
                                    Engagement Multipliers
                                  </h4>

                                  {/* Comment Multipliers */}
                                  {hasCommentMultipliers && (
                                    <div className="space-y-2">
                                      <h5 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                                        Comment Engagement
                                      </h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {cpmPointsConfig.comment_likes_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Likes:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.comment_likes_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.comment_replies_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Replies:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.comment_replies_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.comment_impressions_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Impressions:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.comment_impressions_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.comment_retweets_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Retweets:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.comment_retweets_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.comment_quote_reposts_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Quote Reposts:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.comment_quote_reposts_multiplier}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Retweet Multipliers */}
                                  {hasRetweetMultipliers && (
                                    <div className="space-y-2">
                                      <h5 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                                        Retweet Engagement
                                      </h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {cpmPointsConfig.retweet_likes_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Likes:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.retweet_likes_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.retweet_replies_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Replies:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.retweet_replies_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.retweet_impressions_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Impressions:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.retweet_impressions_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.retweet_retweets_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Retweets:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.retweet_retweets_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.retweet_quote_reposts_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Quote Reposts:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.retweet_quote_reposts_multiplier}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Quote Repost Multipliers */}
                                  {hasQuoteRepostMultipliers && (
                                    <div className="space-y-2">
                                      <h5 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                                        Quote Repost Engagement
                                      </h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {cpmPointsConfig.quote_repost_likes_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Likes:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.quote_repost_likes_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.quote_repost_replies_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Replies:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.quote_repost_replies_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.quote_repost_impressions_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Impressions:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.quote_repost_impressions_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.quote_repost_retweets_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Retweets:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.quote_repost_retweets_multiplier}
                                            </span>
                                          </div>
                                        )}
                                        {cpmPointsConfig.quote_repost_quote_reposts_multiplier !=
                                          null && (
                                          <div
                                            className={cn(
                                              "flex justify-between items-center p-2 rounded-md border text-xs",
                                              isDark
                                                ? "border-gray-700"
                                                : "border-gray-300"
                                            )}
                                          >
                                            <span
                                              className={cn(
                                                "text-xs",
                                                isDark
                                                  ? "text-gray-300"
                                                  : "text-gray-700"
                                              )}
                                            >
                                              Quote Reposts:
                                            </span>
                                            <span className="font-medium text-xs text-foreground">
                                              {cpmPointsConfig.quote_repost_quote_reposts_multiplier}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Payment Information */}
                {(currentContest as any).payment_details && (
                  <div className="space-y-4">
                    <h3
                      className={cn(
                        "font-semibold text-lg",
                        isDark ? "text-white" : "text-foreground"
                      )}
                    >
                      Payment Information
                    </h3>

                    <div
                      className={cn(
                        "rounded-xl p-4",
                        isDark
                          ? "bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-700/50"
                          : "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200"
                      )}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-2 rounded-lg",
                              isDark ? "bg-blue-800/30" : "bg-blue-100"
                            )}
                          >
                            <Trophy
                              className={cn(
                                "h-5 w-5",
                                isDark ? "text-blue-400" : "text-blue-600"
                              )}
                            />
                          </div>
                          <div>
                            <p
                              className={cn(
                                "text-xs font-medium uppercase tracking-wide",
                                isDark ? "text-blue-300" : "text-blue-800"
                              )}
                            >
                              Prize Pool
                            </p>
                            <p
                              className={cn(
                                "text-xl font-bold",
                                isDark ? "text-blue-100" : "text-blue-900"
                              )}
                            >
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
                          <div
                            className={cn(
                              "p-2 rounded-lg",
                              isDark ? "bg-purple-800/30" : "bg-purple-100"
                            )}
                          >
                            <CreditCard
                              className={cn(
                                "h-5 w-5",
                                isDark ? "text-purple-400" : "text-purple-600"
                              )}
                            />
                          </div>
                          <div>
                            <p
                              className={cn(
                                "text-xs font-medium uppercase tracking-wide",
                                isDark ? "text-purple-300" : "text-purple-800"
                              )}
                            >
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
                            <p
                              className={cn(
                                "text-xl font-bold",
                                isDark ? "text-purple-100" : "text-purple-900"
                              )}
                            >
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
                      <div
                        className={cn(
                          "mt-4 pt-4 border-t",
                          isDark ? "border-blue-700/50" : "border-blue-200"
                        )}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-lg",
                                isDark ? "bg-green-800/30" : "bg-green-100"
                              )}
                            >
                              <DollarSign
                                className={cn(
                                  "h-5 w-5",
                                  isDark ? "text-green-400" : "text-green-600"
                                )}
                              />
                            </div>
                            <div>
                              <p
                                className={cn(
                                  "text-xs font-medium uppercase tracking-wide",
                                  isDark ? "text-green-300" : "text-green-800"
                                )}
                              >
                                Total Paid
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-bold",
                                  isDark ? "text-green-100" : "text-green-900"
                                )}
                              >
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
                                    <div
                                      className={cn(
                                        "p-2 rounded-lg",
                                        isDark
                                          ? "bg-emerald-800/30"
                                          : "bg-emerald-100"
                                      )}
                                    >
                                      <Wallet
                                        className={cn(
                                          "h-5 w-5",
                                          isDark
                                            ? "text-emerald-400"
                                            : "text-emerald-600"
                                        )}
                                      />
                                    </div>
                                    <div>
                                      <p
                                        className={cn(
                                          "text-xs font-medium uppercase tracking-wide",
                                          isDark
                                            ? "text-emerald-300"
                                            : "text-emerald-800"
                                        )}
                                      >
                                        From Wallet
                                      </p>
                                      <p
                                        className={cn(
                                          "text-lg font-bold",
                                          isDark
                                            ? "text-emerald-100"
                                            : "text-emerald-900"
                                        )}
                                      >
                                        {formatMoney(walletUsed)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={cn(
                                        "p-2 rounded-lg",
                                        isDark
                                          ? "bg-indigo-800/30"
                                          : "bg-indigo-100"
                                      )}
                                    >
                                      <CreditCard
                                        className={cn(
                                          "h-5 w-5",
                                          isDark
                                            ? "text-indigo-400"
                                            : "text-indigo-600"
                                        )}
                                      />
                                    </div>
                                    <div>
                                      <p
                                        className={cn(
                                          "text-xs font-medium uppercase tracking-wide",
                                          isDark
                                            ? "text-indigo-300"
                                            : "text-indigo-800"
                                        )}
                                      >
                                        From Card
                                      </p>
                                      <p
                                        className={cn(
                                          "text-lg font-bold",
                                          isDark
                                            ? "text-indigo-100"
                                            : "text-indigo-900"
                                        )}
                                      >
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
                                  <div
                                    className={cn(
                                      "p-2 rounded-lg",
                                      isDark
                                        ? "bg-emerald-800/30"
                                        : "bg-emerald-100"
                                    )}
                                  >
                                    <Wallet
                                      className={cn(
                                        "h-5 w-5",
                                        isDark
                                          ? "text-emerald-400"
                                          : "text-emerald-600"
                                      )}
                                    />
                                  </div>
                                  <div>
                                    <p
                                      className={cn(
                                        "text-xs font-medium uppercase tracking-wide",
                                        isDark
                                          ? "text-emerald-300"
                                          : "text-emerald-800"
                                      )}
                                    >
                                      Payment Method
                                    </p>
                                    <p
                                      className={cn(
                                        "text-lg font-bold",
                                        isDark
                                          ? "text-emerald-100"
                                          : "text-emerald-900"
                                      )}
                                    >
                                      Wallet
                                    </p>
                                  </div>
                                </div>
                              );
                            } else if (stripeUsed > 0) {
                              // Credit card only
                              return (
                                <div className="flex items-center gap-3">
                                  <div
                                    className={cn(
                                      "p-2 rounded-lg",
                                      isDark
                                        ? "bg-indigo-800/30"
                                        : "bg-indigo-100"
                                    )}
                                  >
                                    <CreditCard
                                      className={cn(
                                        "h-5 w-5",
                                        isDark
                                          ? "text-indigo-400"
                                          : "text-indigo-600"
                                      )}
                                    />
                                  </div>
                                  <div>
                                    <p
                                      className={cn(
                                        "text-xs font-medium uppercase tracking-wide",
                                        isDark
                                          ? "text-indigo-300"
                                          : "text-indigo-800"
                                      )}
                                    >
                                      Payment Method
                                    </p>
                                    <p
                                      className={cn(
                                        "text-lg font-bold",
                                        isDark
                                          ? "text-indigo-100"
                                          : "text-indigo-900"
                                      )}
                                    >
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
                        <div
                          className={cn(
                            "mt-4 pt-4 border-t flex items-center justify-between",
                            isDark ? "border-blue-700/50" : "border-blue-200"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2
                              className={cn(
                                "h-4 w-4",
                                isDark ? "text-green-400" : "text-green-600"
                              )}
                            />
                            <span
                              className={cn(
                                "text-sm font-medium",
                                isDark ? "text-green-300" : "text-green-800"
                              )}
                            >
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
                              <span
                                className={cn(
                                  "text-xs",
                                  isDark ? "text-blue-400" : "text-blue-700"
                                )}
                              >
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
                    <div
                      className={cn(
                        "border rounded-xl p-4",
                        isDark
                          ? "border-blue-600 bg-blue-950/50"
                          : "border-blue-300 bg-blue-50/50"
                      )}
                    >
                      <p
                        className={cn(
                          "text-lg font-semibold uppercase tracking-wide",
                          isDark ? "text-blue-300" : "text-blue-900"
                        )}
                      >
                        {(currentContest as any).content_type.toUpperCase()}
                      </p>
                      <p
                        className={cn(
                          "text-sm mt-1",
                          isDark ? "text-blue-400" : "text-blue-700"
                        )}
                      >
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

                {/* Categories Section */}
                {currentContest.categories &&
                  Array.isArray(currentContest.categories) &&
                  currentContest.categories.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                        <Tag className="h-5 w-5 text-purple-600" />
                        Categories
                      </h3>
                      <div
                        className={cn(
                          "border rounded-xl p-4",
                          isDark
                            ? "border-purple-600 bg-purple-950/50"
                            : "border-purple-300 bg-purple-50/50"
                        )}
                      >
                        <div className="flex flex-wrap gap-2">
                          {currentContest.categories.map(
                            (categoryId: string) => {
                              const category = CONTENT_TYPE_CATEGORIES.find(
                                (cat) => cat.id === categoryId
                              );
                              return (
                                <span
                                  key={categoryId}
                                  className={cn(
                                    "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                                    isDark
                                      ? "bg-purple-600/30 text-purple-200 border border-purple-500/50"
                                      : "bg-purple-100 text-purple-800 border border-purple-300"
                                  )}
                                >
                                  {category ? category.name : categoryId}
                                </span>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Subcategories Section */}
                {currentContest.subcategories &&
                  (() => {
                    // Handle both grouped format and flat array format
                    let subcategoriesToDisplay: Array<{
                      category: string;
                      subcategory: string;
                    }> = [];

                    if (Array.isArray(currentContest.subcategories)) {
                      // Old flat array format
                      subcategoriesToDisplay = currentContest.subcategories;
                    } else if (
                      typeof currentContest.subcategories === "object" &&
                      currentContest.subcategories !== null
                    ) {
                      // New grouped format: {"beauty": ["Skincare", "Makeup"], ...}
                      const grouped = currentContest.subcategories as Record<
                        string,
                        string[]
                      >;
                      Object.keys(grouped).forEach((category) => {
                        const subcats = grouped[category];
                        if (Array.isArray(subcats)) {
                          subcats.forEach((subcat) => {
                            subcategoriesToDisplay.push({
                              category,
                              subcategory: subcat,
                            });
                          });
                        }
                      });
                    }

                    return subcategoriesToDisplay.length > 0 ? (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                          <Tag className="h-5 w-5 text-indigo-600" />
                          Subcategories
                        </h3>
                        <div
                          className={cn(
                            "border rounded-xl p-4",
                            isDark
                              ? "border-indigo-600 bg-indigo-950/50"
                              : "border-indigo-300 bg-indigo-50/50"
                          )}
                        >
                          <div className="flex flex-wrap gap-2">
                            {subcategoriesToDisplay.map(
                              (
                                item: { category: string; subcategory: string },
                                index: number
                              ) => {
                                const category = CONTENT_TYPE_CATEGORIES.find(
                                  (cat) => cat.id === item.category
                                );
                                return (
                                  <span
                                    key={`${item.category}-${item.subcategory}-${index}`}
                                    className={cn(
                                      "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                                      isDark
                                        ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/50"
                                        : "bg-indigo-100 text-indigo-800 border border-indigo-300"
                                    )}
                                  >
                                    {category ? category.name : item.category}:{" "}
                                    {item.subcategory}
                                  </span>
                                );
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}

                {/* Interests Section */}
                {currentContest.interests &&
                  Array.isArray(currentContest.interests) &&
                  currentContest.interests.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-600" />
                        Interests
                      </h3>
                      <div
                        className={cn(
                          "border rounded-xl p-4",
                          isDark
                            ? "border-yellow-600 bg-yellow-950/50"
                            : "border-yellow-300 bg-yellow-50/50"
                        )}
                      >
                        <div className="flex flex-wrap gap-2">
                          {currentContest.interests.map((interest: string) => (
                            <span
                              key={interest}
                              className={cn(
                                "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                                isDark
                                  ? "bg-yellow-600/30 text-yellow-200 border border-yellow-500/50"
                                  : "bg-yellow-100 text-yellow-800 border border-yellow-300"
                              )}
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
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
                    <div
                      className={cn(
                        "border p-4 rounded-lg",
                        isDark
                          ? "bg-green-950/40 border-green-800"
                          : "border-green-300 bg-green-50/50 rounded-xl p-4"
                      )}
                    >
                      <p
                        className={cn(
                          "text-2xl font-bold mb-2",
                          isDark ? "text-green-300" : "text-green-900"
                        )}
                      >
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
                      <p
                        className={cn(
                          "text-sm",
                          isDark ? "text-green-400" : "text-green-700"
                        )}
                      >
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
                      <CheckCheck
                        className={cn(
                          "h-5 w-5",
                          isDark ? "text-purple-400" : "text-purple-600"
                        )}
                      />
                      Multiple Submissions Allowed
                    </h3>
                    <div
                      className={cn(
                        "border rounded-xl p-4",
                        isDark
                          ? "border-purple-600/50 bg-purple-900/20"
                          : "border-purple-300 bg-purple-50/50"
                      )}
                    >
                      <p
                        className={cn(
                          "text-lg font-semibold mb-2",
                          isDark ? "text-purple-200" : "text-purple-900"
                        )}
                      >
                        Creators can submit up to{" "}
                        {(currentContest as any).max_submissions_per_creator}{" "}
                        entries for this contest!
                      </p>
                      <p
                        className={cn(
                          "text-sm mb-3",
                          isDark ? "text-purple-300" : "text-purple-700"
                        )}
                      >
                        Allow multiple submissions to maximize creator
                        engagement. Min/max view requirements (if any) apply to
                        ALL submissions.
                      </p>
                      {(currentContest as any).max_earnings_per_creator && (
                        <div
                          className={cn(
                            "mt-3 pt-3 border-t",
                            isDark
                              ? "border-purple-700/50"
                              : "border-purple-200"
                          )}
                        >
                          <p
                            className={cn(
                              "text-sm font-medium",
                              isDark ? "text-purple-200" : "text-purple-800"
                            )}
                          >
                            💡 Earnings Cap for This Contest:{" "}
                            {formatMoney(
                              (currentContest as any).max_earnings_per_creator
                            )}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-1",
                              isDark ? "text-purple-400" : "text-purple-600"
                            )}
                          >
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
                    <h3
                      className={cn(
                        "font-semibold text-lg flex items-center gap-2",
                        isDark ? "text-white" : "text-foreground"
                      )}
                    >
                      <Star className="h-5 w-5 text-amber-600" />
                      Additional Bonus Opportunities
                    </h3>
                    <div
                      className={cn(
                        "border rounded-xl p-4",
                        isDark
                          ? "border-amber-500"
                          : "border-amber-300 bg-amber-50/50"
                      )}
                    >
                      <div
                        className={cn(
                          "prose prose-md max-w-none",
                          isDark
                            ? "text-white [&_*]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_em]:!text-white [&_a]:!text-blue-300 [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white [&_table]:!text-white [&_th]:!text-white [&_td]:!text-white"
                            : "text-foreground"
                        )}
                        style={isDark ? { color: "white" } : undefined}
                        dangerouslySetInnerHTML={{
                          __html: (currentContest as any).bonus_details
                            .description_html,
                        }}
                      />
                      <p
                        className={cn(
                          "text-xs mt-3 italic",
                          isDark ? "text-amber-300" : "text-amber-700"
                        )}
                      >
                        ℹ️ These bonuses are handled manually by you. Make sure
                        to follow through on these commitments to maintain
                        creator trust!
                      </p>
                    </div>
                  </div>
                )}

                {/* Twitter raid: show target tweet + metrics from contest_based_details.twitter_campaign */}
                {currentContest.platform?.toLowerCase() === "twitter" &&
                  currentContest.content_type === "raid" &&
                  currentContest.contest_based_details?.twitter_campaign
                    ?.raid_target && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <h3
                          className={cn(
                            "text-xl font-semibold flex items-center gap-2",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          <Share2 className="h-5 w-5" />
                          Target Tweet
                        </h3>
                      </div>

                      <div className="grid gap-4">
                        <div
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
                                  : "bg-sky-100 text-sky-600"
                              )}
                            >
                              <ExternalLink className="h-5 w-5 " />
                            </div>
                            <div className="flex-1 min-w-0 space-y-3">
                              {currentContest.contest_based_details
                                ?.twitter_campaign?.raid_target?.link && (
                                <a
                                  href={
                                    currentContest.contest_based_details
                                      ?.twitter_campaign?.raid_target?.link
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "block text-base font-medium hover:underline mb-1 break-all",
                                    isDark
                                      ? "text-sky-300"
                                      : "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                  )}
                                >
                                  {
                                    currentContest.contest_based_details
                                      ?.twitter_campaign?.raid_target?.link
                                  }
                                </a>
                              )}

                              {currentContest.contest_based_details
                                ?.twitter_campaign?.raid_target
                                ?.description && (
                                <div
                                  className={cn(
                                    "text-sm leading-relaxed",
                                    isDark
                                      ? "text-white"
                                      : "text-gray-700 dark:text-gray-300"
                                  )}
                                >
                                  {
                                    currentContest.contest_based_details
                                      ?.twitter_campaign?.raid_target
                                      ?.description
                                  }
                                </div>
                              )}

                              {currentContest.contest_based_details
                                ?.twitter_campaign?.raid_target?.metrics && (
                                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                                  {typeof currentContest.contest_based_details
                                    ?.twitter_campaign?.raid_target?.metrics
                                    ?.likes === "number" && (
                                    <div className="flex items-center gap-1">
                                      <ThumbsUp className="h-4 w-4" />
                                      <span>Target Likes:</span>
                                      <span className="font-medium">
                                        {currentContest.contest_based_details?.twitter_campaign?.raid_target?.metrics.likes?.toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  {typeof currentContest.contest_based_details
                                    ?.twitter_campaign?.raid_target?.metrics
                                    ?.comments === "number" && (
                                    <div className="flex items-center gap-1">
                                      <MessageCircle className="h-4 w-4" />
                                      <span>Target Comments:</span>
                                      <span className="font-medium">
                                        {currentContest.contest_based_details?.twitter_campaign?.raid_target?.metrics.comments?.toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  {typeof currentContest.contest_based_details
                                    ?.twitter_campaign?.raid_target?.metrics
                                    ?.quote_reposts === "number" && (
                                    <div className="flex items-center gap-1">
                                      <MessageCircle className="h-4 w-4" />
                                      <span>Target Quote Reposts:</span>
                                      <span className="font-medium">
                                        {currentContest.contest_based_details?.twitter_campaign?.raid_target?.metrics.quote_reposts?.toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  {typeof currentContest.contest_based_details
                                    ?.twitter_campaign?.raid_target?.metrics
                                    ?.retweets === "number" && (
                                    <div className="flex items-center gap-1">
                                      {/* <Repeat className="h-4 w-4" /> */}
                                      <span>Target Retweets:</span>
                                      <span className="font-medium">
                                        {currentContest.contest_based_details?.twitter_campaign?.raid_target?.metrics.retweets?.toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {(currentContest.contest_based_details
                                ?.twitter_campaign?.keywords &&
                                currentContest.contest_based_details
                                  .twitter_campaign.keywords.length > 0) ||
                              (currentContest.contest_based_details
                                ?.twitter_campaign?.mentions &&
                                currentContest.contest_based_details
                                  .twitter_campaign.mentions.length > 0) ? (
                                <div className="mt-4 space-y-2">
                                  {currentContest.contest_based_details
                                    ?.twitter_campaign?.keywords &&
                                    currentContest.contest_based_details
                                      .twitter_campaign.keywords.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide">
                                          Keywords
                                        </span>
                                        {currentContest.contest_based_details.twitter_campaign.keywords.map(
                                          (kw: string, idx: number) => (
                                            <span
                                              key={idx}
                                              className={cn(
                                                "inline-flex items-center px-2 py-1 rounded-full text-xs",
                                                isDark
                                                  ? "bg-purple-900/50 text-purple-200 border border-purple-500/60"
                                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                                              )}
                                            >
                                              <Tag className="h-3 w-3 mr-1" />
                                              {kw}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    )}
                                  {currentContest.contest_based_details
                                    ?.twitter_campaign?.mentions &&
                                    currentContest.contest_based_details
                                      .twitter_campaign.mentions.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide">
                                          Mentions
                                        </span>
                                        {currentContest.contest_based_details.twitter_campaign.mentions.map(
                                          (m: string, idx: number) => (
                                            <span
                                              key={idx}
                                              className={cn(
                                                "inline-flex items-center px-2 py-1 rounded-full text-xs",
                                                isDark
                                                  ? "bg-slate-800 text-slate-100 border border-slate-600"
                                                  : "bg-slate-50 text-slate-700 border border-slate-200"
                                              )}
                                            >
                                              @{m.replace(/^@/, "")}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Render inspiration links for non-Twitter contests */}
                {currentContest.platform?.toLowerCase() !== "twitter" &&
                  Array.isArray(currentContest.inspiration_links) &&
                  currentContest.inspiration_links.length > 0 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
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
                        <h3
                          className={cn(
                            "px-2 text-xl font-semibold",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          Tracking Links
                        </h3>
                        <div
                          className={cn(
                            "rounded-md border p-3 text-sm",
                            isDark
                              ? "border-[#C9A7FF] bg-[#C9A7FF26] text-white"
                              : "border-yellow-200 bg-yellow-50 text-yellow-900"
                          )}
                        >
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
                              className={cn(
                                "border rounded-xl p-6 transition-all duration-200",
                                isDark
                                  ? "border-gray-600"
                                  : "border-gray-300 bg-white"
                              )}
                            >
                              <div className="flex items-start gap-4">
                                <div
                                  className={cn(
                                    "p-3 rounded-full flex-shrink-0",
                                    isDark ? "bg-green-900/40" : "bg-green-100"
                                  )}
                                >
                                  <ExternalLink
                                    className={cn(
                                      "h-5 w-5",
                                      isDark
                                        ? "text-green-400"
                                        : "text-green-600"
                                    )}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <p
                                      // href={processedUrl}
                                      // target="_blank"
                                      // rel="noopener noreferrer"
                                      className={cn(
                                        "text-base font-medium hover:underline break-all flex-1",
                                        isDark
                                          ? "text-purple-300"
                                          : "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                      )}
                                    >
                                      {processedUrl}
                                    </p>
                                    <button
                                      onClick={() =>
                                        handleCopyTrackingLink(processedUrl)
                                      }
                                      className={cn(
                                        "p-1.5 rounded-md transition-colors duration-200 flex-shrink-0",
                                        isDark
                                          ? "text-gray-300"
                                          : "hover:bg-gray-100 text-gray-600"
                                      )}
                                      title="Copy link"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                  </div>
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
                        {(() => {
                          const { isDisabled, disabledReason } = getRefreshButtonState();
                          return (
                            <button
                              onClick={handleRefreshMetrics}
                              disabled={isDisabled}
                              className={cn(
                                "flex items-center py-2 px-4 gap-2 rounded-2xl transition-all",
                                isDisabled
                                  ? "bg-gray-400 text-white cursor-not-allowed opacity-60"
                                  : "bg-[#6C43D0] text-white hover:bg-[#5A35B8]"
                              )}
                              title={disabledReason || "Refresh metrics and leaderboard"}
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
                          );
                        })()}
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
                              currentSubmissions.filter((s) => {
                                const status = getStatus(s);
                                return (
                                  status === "verified" || status === "paid"
                                );
                              }).length
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
                              currentSubmissions.filter((s) => {
                                const status = getStatus(s);
                                return status === "pending";
                              }).length
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
                              currentSubmissions.filter((s) => {
                                const status = getStatus(s);
                                return status === "verified";
                              }).length
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
                              currentSubmissions.filter((s) => {
                                const status = getStatus(s);
                                return status === "paid";
                              }).length
                            }
                          </Badge>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                {/* Eligibility Filter Tabs - Only for Twitter campaigns */}
                {(currentContest?.platform?.toLowerCase() === "twitter" ||
                  currentContest?.platform?.toLowerCase() === "x") &&
                  currentContest?.contest_format === "text_image" && (
                    <div>
                      <div className="py-2">
                        <Tabs
                          value={activeEligibilityTab}
                          onValueChange={(value) =>
                            setActiveEligibilityTab(value as any)
                          }
                          className="w-full"
                        >
                          <TabsList className="flex gap-3 w-full h-auto p-1">
                            <TabsTrigger
                              value="all"
                              className={cn(
                                "flex-1 gap-2 items-center px-2 border",
                                isDark
                                  ? "text-white border-gray-400"
                                  : "text-[#7F39EC] border-[#7F39EC]"
                              )}
                            >
                              <div className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5 mr-1" />
                                <span className="text-[13px] font-medium">
                                  All
                                </span>
                              </div>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "px-1.5 py-0.5 text-xs h-5",
                                  isDark
                                    ? "text-white bg-[#FFFFFF36]"
                                    : "text-[#7F39EC] bg-purple-200"
                                )}
                              >
                                {
                                  currentSubmissions.filter(
                                    (s) => (s as any).is_twitter_tweet === true
                                  ).length
                                }
                              </Badge>
                            </TabsTrigger>
                            <TabsTrigger
                              value="eligible"
                              className={cn(
                                "flex-1 gap-2 items-center px-2 border",
                                isDark
                                  ? "text-white border-gray-400"
                                  : "text-[#7F39EC] border-[#7F39EC]"
                              )}
                            >
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                <span className="text-[13px] font-medium">
                                  Eligible
                                </span>
                              </div>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "px-1.5 py-0.5 text-xs h-5",
                                  isDark
                                    ? "text-white bg-[#FFFFFF36]"
                                    : "text-[#7F39EC] bg-purple-200"
                                )}
                              >
                                {
                                  currentSubmissions.filter(
                                    (s) =>
                                      (s as any).is_twitter_tweet === true &&
                                      (s as any).filter_status === "eligible"
                                  ).length
                                }
                              </Badge>
                            </TabsTrigger>
                            <TabsTrigger
                              value="not_eligible"
                              className={cn(
                                "flex-1 gap-2 items-center px-2 border",
                                isDark
                                  ? "text-white border-gray-400"
                                  : "text-[#7F39EC] border-[#7F39EC]"
                              )}
                            >
                              <div className="flex items-center gap-1">
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                <span className="text-[13px] font-medium">
                                  Not Eligible
                                </span>
                              </div>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "px-1.5 py-0.5 text-xs h-5",
                                  isDark
                                    ? "text-white bg-[#FFFFFF36]"
                                    : "text-[#7F39EC] bg-purple-200"
                                )}
                              >
                                {
                                  currentSubmissions.filter(
                                    (s) =>
                                      (s as any).is_twitter_tweet === true &&
                                      (s as any).filter_status !== "eligible"
                                  ).length
                                }
                              </Badge>
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                    </div>
                  )}

                {/* Enhanced Submissions Table */}
                <div
                  className={cn(
                    "p-4 rounded-xl shadow-xl",
                    isDark ? "bg-[#170337]" : "bg-white "
                  )}
                >
                  <CardContent className="p-0">
                    <div className="overflow-auto">
                      {/* View Mode Toggle, Sort control, and Refresh Button */}
                      <div className="flex flex-col gap-4 px-4 py-2 mb-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-col gap-2 text-md sm:flex-row sm:items-center sm:gap-3">
                          <span
                            className={cn(
                              isDark ? "text-white" : "text-slate-600"
                            )}
                          >
                            View
                          </span>
                          <Select
                            value={viewMode}
                            onValueChange={(v) =>
                              setViewMode(v as "normal" | "creator-wise")
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                "h-12 w-full sm:w-[180px]",
                                isDark ? "border-gray-500" : "border-gray-300"
                              )}
                            >
                              <SelectValue placeholder="View mode" />
                            </SelectTrigger>
                            <SelectContent isDark={isDark}>
                              <SelectItem value="normal" isDark={isDark}>
                                Normal View
                              </SelectItem>
                              <SelectItem value="creator-wise" isDark={isDark}>
                                Creator-wise
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <div className="flex flex-col gap-2 text-md sm:flex-row sm:items-center sm:gap-3">
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
                                  "h-12 w-full sm:w-[220px]",
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
                      </div>
                      {viewMode === "normal" && (
                        <Table>
                          <TableHeader>
                            <TableRow
                              className={cn(
                                "border-b",
                                isDark
                                  ? "bg-[#391A6A] border-gray-600"
                                  : "bg-slate-100 hover:bg-slate-100 border-slate-200"
                              )}
                            >
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Creator</TableHead>
                              {/* For Twitter campaigns, show tweet content column */}
                              {(currentContest.platform?.toLowerCase() ===
                                "twitter" ||
                                currentContest.platform?.toLowerCase() ===
                                  "x") &&
                                currentContest.contest_format ===
                                  "text_image" && (
                                  <TableHead className="min-w-[200px]">
                                    Tweet
                                  </TableHead>
                                )}
                              {/* For Twitter campaigns, show different headers */}
                              {(currentContest.platform?.toLowerCase() ===
                                "twitter" ||
                                currentContest.platform?.toLowerCase() ===
                                  "x") &&
                              currentContest.contest_format === "text_image" ? (
                                <>
                                  <TableHead className="text-center">
                                    Total Points
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Base Points
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Manual Points
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Likes
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Replies
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Retweets
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Quote Reposts
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Impressions
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Manual Points Reason
                                  </TableHead>
                                </>
                              ) : (
                                <>
                                  <TableHead className="text-center">
                                    Views
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Likes
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Comments
                                  </TableHead>
                                </>
                              )}
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
                                  <TableHead className="text-center">
                                    Avg Watch Time
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Total Watch Time
                                  </TableHead>
                                  {/* <TableHead className="text-center">Engagement Rate</TableHead> */}
                                </>
                              )}
                              {/* Show reward columns for leaderboard contests, hide for Twitter CPM campaigns */}
                              {!(
                                (currentContest.platform?.toLowerCase() ===
                                  "twitter" ||
                                  currentContest.platform?.toLowerCase() ===
                                    "x") &&
                                currentContest.contest_format === "text_image"
                              ) ||
                              (currentContest.contest_type === "leaderboard" &&
                                (currentContest.platform?.toLowerCase() ===
                                  "twitter" ||
                                  currentContest.platform?.toLowerCase() ===
                                    "x") &&
                                currentContest.contest_format ===
                                  "text_image") ? (
                                <>
                                  <TableHead className="text-center">
                                    Expected Reward
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Reward Granted
                                  </TableHead>
                                </>
                              ) : null}
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
                            {paginatedSubmissions.map((submission, index) => {
                              const globalIndex =
                                (currentPage - 1) * itemsPerPage + index;
                              const metrics =
                                extractPlatformMetrics(submission);
                              const isTwitterTweet =
                                (submission as any).is_twitter_tweet === true;
                              const statusToUse = isTwitterTweet
                                ? (submission as any).moderation_status ||
                                  submission.status
                                : submission.status;
                              // Use status directly (no normalization needed since we use "verified" instead of "approved")
                              const normalizedStatusForBadge = statusToUse;
                              const submissionStatus = getSubmissionStatusBadge(
                                normalizedStatusForBadge
                              );
                              const isLoading =
                                isLoadingSubmission[submission.id] || false;
                              const rank = globalIndex + 1;
                              // Check if tweet is deleted (filter_status === "deleted")
                              const isDeleted =
                                isTwitterTweet &&
                                (submission as any).filter_status === "deleted";

                              // Compute expected and granted rewards separately
                              const getExpectedReward = () => {
                                if (
                                  currentContest.contest_type === "leaderboard"
                                ) {
                                  const contestDetails =
                                    currentContest.contest_based_details
                                      ?.leaderboard_contest;
                                  if (
                                    contestDetails?.prizes &&
                                    Array.isArray(contestDetails.prizes)
                                  ) {
                                    // For Twitter leaderboard contests, use creator rank instead of submission rank
                                    let currentRank: number;
                                    const isTwitterLeaderboard =
                                      isTwitterTweet &&
                                      (currentContest.platform?.toLowerCase() ===
                                        "twitter" ||
                                        currentContest.platform?.toLowerCase() ===
                                          "x") &&
                                      currentContest.contest_format ===
                                        "text_image";

                                    if (isTwitterLeaderboard) {
                                      // Use creator's rank based on total points
                                      currentRank =
                                        creatorRankingMap.get(
                                          submission.creator_id || ""
                                        ) || 0;
                                    } else {
                                      // For other platforms, use submission rank
                                      currentRank = index + 1; // 1-based ranking
                                    }

                                    if (currentRank > 0) {
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
                                      className: "text-slate-700 font-semibold",
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

                                // For Twitter leaderboard contests, use creator's prize amount
                                const isTwitterLeaderboard =
                                  isTwitterTweet &&
                                  currentContest.contest_type ===
                                    "leaderboard" &&
                                  (currentContest.platform?.toLowerCase() ===
                                    "twitter" ||
                                    currentContest.platform?.toLowerCase() ===
                                      "x") &&
                                  currentContest.contest_format ===
                                    "text_image";

                                if (submission.status === "paid") {
                                  let dollars = 0;

                                  if (isTwitterLeaderboard) {
                                    // For Twitter leaderboard, use creator's prize amount based on rank
                                    const creatorRank = creatorRankingMap.get(
                                      submission.creator_id || ""
                                    );
                                    if (creatorRank) {
                                      const contestDetails =
                                        currentContest.contest_based_details
                                          ?.leaderboard_contest;
                                      const prizeForRank =
                                        contestDetails?.prizes?.find(
                                          (p: any) => p.position === creatorRank
                                        );
                                      if (prizeForRank) {
                                        dollars = centsToDollars(
                                          prizeForRank.amount
                                        );
                                      }
                                    }
                                    // Fallback to submission.earnings if rank lookup fails
                                    if (dollars === 0 && submission.earnings) {
                                      dollars = centsToDollars(
                                        submission.earnings
                                      );
                                    }
                                  } else {
                                    // For other contests, use submission.earnings directly
                                    dollars = submission.earnings
                                      ? centsToDollars(submission.earnings)
                                      : 0;
                                  }

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
                                    amount: centsToDollars(submission.earnings),
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
                                    "transition-colors duration-200",
                                    isDeleted && "opacity-60",
                                    isDark ? "" : "bg-white hover:bg-slate-100",
                                    rank <= 3 &&
                                      !isDeleted &&
                                      (isDark
                                        ? "bg-gradient-to-r from-violet-900/20 to-transparent border-l-4 border-l-violet-400"
                                        : "bg-gradient-to-r from-yellow-50 to-transparent border-l-4 border-l-yellow-400")
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
                                      <Avatar className="bg-violet-100 text-violet-600 font-semibold text-xs sm:text-base">
                                        <AvatarImage
                                          src={
                                            submission.creator
                                              ?.profile_picture_url || undefined
                                          }
                                          alt={
                                            submission.creator_display_name ||
                                            submission.creator_username ||
                                            "Creator"
                                          }
                                        />
                                        <AvatarFallback className="bg-violet-100 text-violet-600 font-semibold text-xs sm:text-base">
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
                                          <div className="flex items-center gap-2 mt-1">
                                            <a
                                              href={submission.content_link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={cn(
                                                "text-xs hover:underline flex items-center gap-1 transition-colors whitespace-nowrap",
                                                isDark
                                                  ? "text-purple-400"
                                                  : "text-blue-600 hover:text-blue-800"
                                              )}
                                            >
                                              <PlayCircle className="h-3 w-3" />
                                              View Content
                                            </a>
                                            {isAdminView && (
                                              <button
                                                onClick={() =>
                                                  handleDownloadReel(
                                                    submission.id
                                                  )
                                                }
                                                disabled={
                                                  downloadingSubmissionId ===
                                                  submission.id
                                                }
                                                className={cn(
                                                  "text-xs hover:underline flex items-center gap-1 transition-colors whitespace-nowrap",
                                                  isDark
                                                    ? "text-purple-400 hover:text-purple-300"
                                                    : "text-blue-600 hover:text-blue-800",
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
                                  {/* For Twitter tweets, show tweet text */}
                                  {isTwitterTweet && (
                                    <TableCell className="min-w-[200px] max-w-[300px]">
                                      <div className="flex flex-col gap-2">
                                        {/* Tweet type badge */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-xs px-2 py-0.5",
                                              submission.other_stats
                                                ?.tweet_type === "reply" ||
                                                submission.other_stats
                                                  ?.tweet_type === "quote" ||
                                                submission.other_stats
                                                  ?.tweet_type === "retweet"
                                                ? "bg-purple-100 text-purple-700 border-purple-300"
                                                : "bg-blue-100 text-blue-700 border-blue-300"
                                            )}
                                          >
                                            {submission.other_stats
                                              ?.tweet_type === "reply"
                                              ? "REPLY"
                                              : submission.other_stats
                                                  ?.tweet_type === "quote"
                                              ? "QUOTE"
                                              : submission.other_stats
                                                  ?.tweet_type === "retweet"
                                              ? "RETWEET"
                                              : "TWEET"}
                                          </Badge>
                                          {isDeleted && (
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
                                                ? "text-slate-400"
                                                : "text-slate-500"
                                            )}
                                          >
                                            from @{submission.creator_username}
                                          </span>
                                        </div>
                                        {/* Tweet text */}
                                        <p
                                          className={cn(
                                            "text-sm line-clamp-3",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900"
                                          )}
                                          title={
                                            submission.other_stats
                                              ?.tweet_text ||
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
                                              "text-xs flex items-center gap-1 hover:underline",
                                              isDark
                                                ? "text-purple-400"
                                                : "text-purple-600"
                                            )}
                                          >
                                            Click to view tweet
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        )}
                                      </div>
                                    </TableCell>
                                  )}
                                  {/* For Twitter tweets, show different metrics */}
                                  {isTwitterTweet ? (
                                    <>
                                      {/* Total Points */}
                                      <TableCell className="text-center">
                                        <div className="flex flex-col items-center">
                                          <span
                                            className={cn(
                                              "font-bold text-sm",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900"
                                            )}
                                          >
                                            {formatMetricValue(
                                              (submission.other_stats
                                                ?.base_points || 0) +
                                                ((submission as any)
                                                  .manual_points_adjustment ||
                                                  0)
                                            )}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-500"
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
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900"
                                            )}
                                          >
                                            {formatMetricValue(
                                              submission.other_stats
                                                ?.base_points ||
                                                submission.other_stats
                                                  ?.points ||
                                                0
                                            )}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-500"
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
                                              (submission as any)
                                                .manual_points_adjustment > 0
                                                ? "text-green-600"
                                                : (submission as any)
                                                    .manual_points_adjustment <
                                                  0
                                                ? "text-red-600"
                                                : isDark
                                                ? "text-white"
                                                : "text-slate-900"
                                            )}
                                          >
                                            {(submission as any)
                                              .manual_points_adjustment > 0
                                              ? "+"
                                              : ""}
                                            {formatMetricValue(
                                              (submission as any)
                                                .manual_points_adjustment || 0
                                            )}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-500"
                                            )}
                                          >
                                            manual
                                          </span>
                                          {(submission as any)
                                            .manual_points_reason && (
                                            <span
                                              className={cn(
                                                "text-xs mt-0.5 italic truncate max-w-[100px]",
                                                isDark
                                                  ? "text-slate-400"
                                                  : "text-slate-600"
                                              )}
                                              title={
                                                (submission as any)
                                                  .manual_points_reason
                                              }
                                            >
                                              {(submission as any)
                                                .manual_points_reason.length >
                                              15
                                                ? (
                                                    submission as any
                                                  ).manual_points_reason.substring(
                                                    0,
                                                    15
                                                  ) + "..."
                                                : (submission as any)
                                                    .manual_points_reason}
                                            </span>
                                          )}
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
                                                isDark
                                                  ? "text-white"
                                                  : "text-slate-900"
                                              )}
                                            >
                                              {formatMetricValue(
                                                submission.other_stats?.likes ||
                                                  0
                                              )}
                                            </span>
                                          </div>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-500"
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
                                                isDark
                                                  ? "text-white"
                                                  : "text-slate-900"
                                              )}
                                            >
                                              {formatMetricValue(
                                                submission.other_stats
                                                  ?.replies || 0
                                              )}
                                            </span>
                                          </div>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-500"
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
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900"
                                            )}
                                          >
                                            {formatMetricValue(
                                              submission.other_stats
                                                ?.retweets || 0
                                            )}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-500"
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
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900"
                                            )}
                                          >
                                            {formatMetricValue(
                                              submission.other_stats
                                                ?.quote_reposts || 0
                                            )}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-500"
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
                                                isDark
                                                  ? "text-white"
                                                  : "text-slate-900"
                                              )}
                                            >
                                              {formatMetricValue(
                                                submission.other_stats
                                                  ?.impressions || 0
                                              )}
                                            </span>
                                          </div>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-500"
                                            )}
                                          >
                                            impressions
                                          </span>
                                        </div>
                                      </TableCell>
                                      {/* Manual Points Reason */}
                                      <TableCell className="text-center">
                                        {(submission as any)
                                          .manual_points_reason ? (
                                          <div className="flex flex-col items-center">
                                            <span
                                              className={cn(
                                                "text-xs italic truncate max-w-[150px]",
                                                isDark
                                                  ? "text-slate-400"
                                                  : "text-slate-600"
                                              )}
                                              title={
                                                (submission as any)
                                                  .manual_points_reason
                                              }
                                            >
                                              {(submission as any)
                                                .manual_points_reason.length >
                                              20
                                                ? (
                                                    submission as any
                                                  ).manual_points_reason.substring(
                                                    0,
                                                    20
                                                  ) + "..."
                                                : (submission as any)
                                                    .manual_points_reason}
                                            </span>
                                          </div>
                                        ) : (
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-slate-500"
                                                : "text-slate-400"
                                            )}
                                          >
                                            —
                                          </span>
                                        )}
                                      </TableCell>
                                    </>
                                  ) : (
                                    <>
                                      {/* Regular submissions (YouTube/Instagram) */}
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
                                    </>
                                  )}
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
                                      <TableCell className="text-center font-mono text-sm">
                                        <div className="flex flex-col items-center">
                                          <span className="font-bold">
                                            {formatWatchTime(
                                              (metrics as any).avg_watch_time_ms
                                            )}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-slate-400"
                                                : "text-slate-500"
                                            )}
                                          >
                                            avg
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center font-mono text-sm">
                                        <div className="flex flex-col items-center">
                                          <span className="font-bold">
                                            {formatWatchTime(
                                              (metrics as any)
                                                .total_watch_time_ms
                                            )}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-slate-400"
                                                : "text-slate-500"
                                            )}
                                          >
                                            total
                                          </span>
                                        </div>
                                      </TableCell>
                                      {/* <TableCell className="text-center font-mono text-sm">
                                                                            {formatMetricValue(metrics.engagement_rate, true)}
                                                                        </TableCell> */}
                                    </>
                                  )}
                                  {/* Show reward cells for leaderboard contests, hide for Twitter CPM campaigns */}
                                  {!(
                                    (currentContest.platform?.toLowerCase() ===
                                      "twitter" ||
                                      currentContest.platform?.toLowerCase() ===
                                        "x") &&
                                    currentContest.contest_format ===
                                      "text_image"
                                  ) ||
                                  (currentContest.contest_type ===
                                    "leaderboard" &&
                                    (currentContest.platform?.toLowerCase() ===
                                      "twitter" ||
                                      currentContest.platform?.toLowerCase() ===
                                        "x") &&
                                    currentContest.contest_format ===
                                      "text_image") ? (
                                    <>
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
                                    </>
                                  ) : null}
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
                                        className={cn(
                                          "border",
                                          isDark ? "bg-black" : "bg-white"
                                        )}
                                        align="end"
                                      >
                                        {/* Twitter-specific moderation controls */}
                                        {isTwitterTweet ? (
                                          <>
                                            <DropdownMenuLabel className="text-purple-500">
                                              Moderation
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {statusToUse !== "verified" && (
                                              <DropdownMenuItem
                                                disabled={isLoading}
                                                onClick={() =>
                                                  handleModerateTwitterTweet(
                                                    submission.id,
                                                    "approve"
                                                  )
                                                }
                                              >
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                Verify Tweet
                                              </DropdownMenuItem>
                                            )}
                                            {statusToUse !== "rejected" && (
                                              <DropdownMenuItem
                                                disabled={isLoading}
                                                onClick={() => {
                                                  setPendingRejectionSubmission(
                                                    submission.id
                                                  );
                                                  setRejectionModalOpen(true);
                                                }}
                                                className="text-red-600"
                                              >
                                                <XCircle className="h-4 w-4 mr-2" />
                                                Reject Tweet
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel className="text-purple-500">
                                              Points
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem
                                              disabled={isLoading}
                                              onClick={() => {
                                                setPendingManualPointsSubmission(
                                                  {
                                                    id: submission.id,
                                                    type: "tweet",
                                                  }
                                                );
                                                setManualPointsModalOpen(true);
                                              }}
                                            >
                                              <Star className="h-4 w-4 mr-2" />
                                              Adjust Tweet Points
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              disabled={isLoading}
                                              onClick={() => {
                                                setPendingManualPointsSubmission(
                                                  {
                                                    id: submission.id,
                                                    type: "leaderboard",
                                                    creatorId:
                                                      submission.creator_id ||
                                                      undefined,
                                                  }
                                                );
                                                setManualPointsModalOpen(true);
                                              }}
                                            >
                                              <Users className="h-4 w-4 mr-2" />
                                              Adjust Creator Points (All Tweets)
                                            </DropdownMenuItem>
                                          </>
                                        ) : (
                                          <>
                                            {/* Regular submission controls */}
                                            {currentContest.post_contest_status !==
                                              "payouts_processed" && (
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
                                          </>
                                        )}
                                        {submission.status !== "pending" &&
                                          currentContest.post_contest_status !==
                                            "payouts_processed" &&
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
                                        {/* Show payment options only when contest status is verification_complete */}
                                        {/* Note: For Twitter, payments are handled at creator level in creator-wise view, not here */}
                                        {!isTwitterTweet &&
                                          submission.status !== "paid" &&
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

                      {/* Pagination Controls for Normal View */}
                      {viewMode === "normal" &&
                        sortedSubmissions.length > 0 && (
                          <div className="mt-6 px-4">
                            <PaginationControls
                              page={currentPage}
                              limit={itemsPerPage}
                              total={sortedSubmissions.length}
                              totalPages={totalPages}
                              hasNextPage={hasNextPage}
                              hasPreviousPage={hasPreviousPage}
                              onPageChange={setCurrentPage}
                              onLimitChange={(limit) => {
                                setItemsPerPage(limit);
                                setCurrentPage(1);
                              }}
                              isDark={isDark}
                            />
                          </div>
                        )}

                      {/* Creator-wise View Table */}
                      {viewMode === "creator-wise" &&
                        groupSubmissionsByCreator && (
                          <>
                            {/* Participant Filter Tabs for Twitter contests */}
                            {(currentContest?.platform?.toLowerCase() ===
                              "twitter" ||
                              currentContest?.platform?.toLowerCase() ===
                                "x") &&
                              currentContest?.contest_format ===
                                "text_image" && (
                                <div className="mb-4 px-4">
                                  <Tabs
                                    value={participantFilter}
                                    onValueChange={(v) => {
                                      setParticipantFilter(
                                        v as "all" | "rejected" | "available"
                                      );
                                      setCreatorWisePage(1);
                                    }}
                                  >
                                    <TabsList className="grid w-full grid-cols-3">
                                      <TabsTrigger
                                        value="all"
                                        className="text-sm"
                                      >
                                        All Participants
                                        <Badge
                                          variant="secondary"
                                          className={cn(
                                            "ml-2 px-1.5 py-0.5 text-xs h-5",
                                            isDark
                                              ? "text-white bg-[#FFFFFF36]"
                                              : "text-[#7F39EC] bg-purple-200"
                                          )}
                                        >
                                          {sortedCreatorGroups?.length || 0}
                                        </Badge>
                                      </TabsTrigger>
                                      <TabsTrigger
                                        value="rejected"
                                        className="text-sm"
                                      >
                                        Rejected Participants
                                        <Badge
                                          variant="secondary"
                                          className={cn(
                                            "ml-2 px-1.5 py-0.5 text-xs h-5",
                                            isDark
                                              ? "text-white bg-[#FFFFFF36]"
                                              : "text-red-600 bg-red-200"
                                          )}
                                        >
                                          {sortedCreatorGroups?.filter(
                                            (g: any) =>
                                              (g.creator_moderation_status ||
                                                "pending") === "rejected"
                                          ).length || 0}
                                        </Badge>
                                      </TabsTrigger>
                                      <TabsTrigger
                                        value="available"
                                        className="text-sm"
                                      >
                                        Available Participants
                                        <Badge
                                          variant="secondary"
                                          className={cn(
                                            "ml-2 px-1.5 py-0.5 text-xs h-5",
                                            isDark
                                              ? "text-white bg-[#FFFFFF36]"
                                              : "text-green-600 bg-green-200"
                                          )}
                                        >
                                          {sortedCreatorGroups?.filter(
                                            (g: any) =>
                                              (g.creator_moderation_status ||
                                                "pending") !== "rejected"
                                          ).length || 0}
                                        </Badge>
                                      </TabsTrigger>
                                    </TabsList>
                                  </Tabs>
                                </div>
                              )}
                            <Table>
                              <TableHeader>
                                <TableRow
                                  className={cn(
                                    "border-b",
                                    isDark
                                      ? "bg-[#391A6A] border-gray-600"
                                      : "bg-slate-100 hover:bg-slate-100 border-slate-200"
                                  )}
                                >
                                  <TableHead className="w-12">#</TableHead>
                                  <TableHead>Creator</TableHead>
                                  <TableHead className="text-center">
                                    Total Submissions
                                  </TableHead>
                                  <TableHead className="text-center">
                                    Status
                                  </TableHead>
                                  {/* For Twitter campaigns, show Twitter-specific metrics */}
                                  {(currentContest.platform?.toLowerCase() ===
                                    "twitter" ||
                                    currentContest.platform?.toLowerCase() ===
                                      "x") &&
                                  currentContest.contest_format ===
                                    "text_image" ? (
                                    <>
                                      <TableHead className="text-center">
                                        Total Points
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Base Points
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Manual Points
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Likes
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Replies
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Retweets
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Quote Reposts
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Impressions
                                      </TableHead>
                                    </>
                                  ) : (
                                    <>
                                      <TableHead className="text-center">
                                        Views
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Likes
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Comments
                                      </TableHead>
                                      {/* Instagram-specific metrics */}
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
                                          <TableHead className="text-center">
                                            Avg Watch Time
                                          </TableHead>
                                          <TableHead className="text-center">
                                            Total Watch Time
                                          </TableHead>
                                        </>
                                      )}
                                    </>
                                  )}
                                  {/* Show reward columns for leaderboard contests, hide for Twitter CPM campaigns */}
                                  {!(
                                    (currentContest.platform?.toLowerCase() ===
                                      "twitter" ||
                                      currentContest.platform?.toLowerCase() ===
                                        "x") &&
                                    currentContest.contest_format ===
                                      "text_image"
                                  ) ||
                                  (currentContest.contest_type ===
                                    "leaderboard" &&
                                    (currentContest.platform?.toLowerCase() ===
                                      "twitter" ||
                                      currentContest.platform?.toLowerCase() ===
                                        "x") &&
                                    currentContest.contest_format ===
                                      "text_image") ? (
                                    <>
                                      <TableHead className="text-center">
                                        Expected Reward
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Reward Granted
                                      </TableHead>
                                    </>
                                  ) : null}
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
                                      <TableHead className="text-center">
                                        Bonus Expected
                                      </TableHead>
                                      <TableHead className="text-center">
                                        Bonus Granted
                                      </TableHead>
                                    </>
                                  )}
                                  {/* Manual Points Adjustment and Reason Columns - Show for Twitter leaderboard campaigns */}
                                  {(currentContest.platform?.toLowerCase() ===
                                    "twitter" ||
                                    currentContest.platform?.toLowerCase() ===
                                      "x") &&
                                    currentContest.contest_format ===
                                      "text_image" &&
                                    currentContest.contest_type ===
                                      "leaderboard" && (
                                      <>
                                        <TableHead className="text-center">
                                          Manual Points Adjustment
                                        </TableHead>
                                        <TableHead className="text-center">
                                          Manual Points Reason
                                        </TableHead>
                                      </>
                                    )}
                                  {/* Rejection Reason Column - Show if there are any rejected creators */}
                                  {showRejectionReasonColumn && (
                                    <TableHead className="text-center">
                                      Rejection Reason
                                    </TableHead>
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
                                {paginatedCreatorGroups.length === 0 ? (
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
                                  paginatedCreatorGroups.map(
                                    (group: any, index: number) => {
                                      const globalIndex =
                                        (creatorWisePage - 1) *
                                          creatorWiseItemsPerPage +
                                        index;
                                      return (
                                        <TableRow key={group.creator.id}>
                                          <TableCell className="font-medium">
                                            {globalIndex + 1}
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
                                                <AvatarFallback className="bg-violet-100 text-violet-600 font-semibold text-xs sm:text-base">
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
                                            <div className="flex flex-col items-center gap-1">
                                              {/* Creator-level moderation status for Twitter campaigns */}
                                              {(currentContest.platform?.toLowerCase() ===
                                                "twitter" ||
                                                currentContest.platform?.toLowerCase() ===
                                                  "x") &&
                                              currentContest.contest_format ===
                                                "text_image" &&
                                              group.creator_moderation_status ? (
                                                <>
                                                  {group.creator_moderation_status ===
                                                  "rejected" ? (
                                                    <Badge className="bg-red-500 text-white text-xs">
                                                      Rejected
                                                    </Badge>
                                                  ) : group.paid ? (
                                                    <Badge className="bg-blue-500 text-white text-xs">
                                                      Paid
                                                    </Badge>
                                                  ) : group.creator_moderation_status ===
                                                      "verified" ||
                                                    group.statusCounts
                                                      .verified > 0 ? (
                                                    <Badge className="bg-green-500 text-white text-xs">
                                                      Verified
                                                    </Badge>
                                                  ) : (
                                                    <Badge className="bg-yellow-500 text-white text-xs">
                                                      Pending
                                                    </Badge>
                                                  )}
                                                  {group.creator_rejection_reason && (
                                                    <span
                                                      className={cn(
                                                        "text-xs italic truncate max-w-[150px] text-center",
                                                        isDark
                                                          ? "text-red-400"
                                                          : "text-red-600"
                                                      )}
                                                      title={
                                                        group.creator_rejection_reason
                                                      }
                                                    >
                                                      {group
                                                        .creator_rejection_reason
                                                        .length > 20
                                                        ? group.creator_rejection_reason.substring(
                                                            0,
                                                            20
                                                          ) + "..."
                                                        : group.creator_rejection_reason}
                                                    </span>
                                                  )}
                                                </>
                                              ) : (
                                                <div className="flex flex-wrap gap-1 justify-center">
                                                  <Badge
                                                    variant="outline"
                                                    className="text-xs"
                                                  >
                                                    All:{" "}
                                                    {group.statusCounts.all}
                                                  </Badge>
                                                  {group.statusCounts.verified >
                                                    0 && (
                                                    <Badge className="bg-green-500 text-white text-xs">
                                                      V:{" "}
                                                      {
                                                        group.statusCounts
                                                          .verified
                                                      }
                                                    </Badge>
                                                  )}
                                                  {group.statusCounts.paid >
                                                    0 && (
                                                    <Badge className="bg-blue-500 text-white text-xs">
                                                      P:{" "}
                                                      {group.statusCounts.paid}
                                                    </Badge>
                                                  )}
                                                  {group.statusCounts.pending >
                                                    0 && (
                                                    <Badge className="bg-yellow-500 text-white text-xs">
                                                      Pend:{" "}
                                                      {
                                                        group.statusCounts
                                                          .pending
                                                      }
                                                    </Badge>
                                                  )}
                                                  {group.statusCounts.rejected >
                                                    0 && (
                                                    <Badge className="bg-red-500 text-white text-xs">
                                                      R:{" "}
                                                      {
                                                        group.statusCounts
                                                          .rejected
                                                      }
                                                    </Badge>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </TableCell>
                                          {/* For Twitter campaigns, show Twitter-specific metrics */}
                                          {(currentContest.platform?.toLowerCase() ===
                                            "twitter" ||
                                            currentContest.platform?.toLowerCase() ===
                                              "x") &&
                                          currentContest.contest_format ===
                                            "text_image" ? (
                                            <>
                                              {/* Total Points */}
                                              <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                  <span
                                                    className={cn(
                                                      "font-bold text-sm",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-900"
                                                    )}
                                                  >
                                                    {formatMetricValue(
                                                      (group.metrics
                                                        .base_points || 0) +
                                                        (group.metrics
                                                          .manual_points_adjustment ||
                                                          0)
                                                    )}
                                                  </span>
                                                  <span
                                                    className={cn(
                                                      "text-xs",
                                                      isDark
                                                        ? "text-slate-400"
                                                        : "text-slate-500"
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
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-900"
                                                    )}
                                                  >
                                                    {formatMetricValue(
                                                      group.metrics
                                                        .base_points || 0
                                                    )}
                                                  </span>
                                                  <span
                                                    className={cn(
                                                      "text-xs",
                                                      isDark
                                                        ? "text-slate-400"
                                                        : "text-slate-500"
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
                                                      group.metrics
                                                        .manual_points_adjustment >
                                                        0
                                                        ? "text-green-600"
                                                        : group.metrics
                                                            .manual_points_adjustment <
                                                          0
                                                        ? "text-red-600"
                                                        : isDark
                                                        ? "text-white"
                                                        : "text-slate-900"
                                                    )}
                                                  >
                                                    {group.metrics
                                                      .manual_points_adjustment >
                                                    0
                                                      ? "+"
                                                      : ""}
                                                    {formatMetricValue(
                                                      group.metrics
                                                        .manual_points_adjustment ||
                                                        0
                                                    )}
                                                  </span>
                                                  <span
                                                    className={cn(
                                                      "text-xs",
                                                      isDark
                                                        ? "text-slate-400"
                                                        : "text-slate-500"
                                                    )}
                                                  >
                                                    manual
                                                  </span>
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {formatMetricValue(
                                                  group.metrics.likes || 0
                                                )}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {formatMetricValue(
                                                  group.metrics.comments || 0
                                                )}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {formatMetricValue(
                                                  group.metrics.retweets || 0
                                                )}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {formatMetricValue(
                                                  group.metrics.quote_reposts ||
                                                    0
                                                )}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {formatMetricValue(
                                                  group.metrics.impressions || 0
                                                )}
                                              </TableCell>
                                            </>
                                          ) : (
                                            <>
                                              <TableCell className="text-center">
                                                {group.metrics.views.toLocaleString()}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {group.metrics.likes.toLocaleString()}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {group.metrics.comments.toLocaleString()}
                                              </TableCell>
                                              {/* Instagram-specific metrics */}
                                              {currentContest.platform
                                                ?.toLowerCase()
                                                .includes("instagram") && (
                                                <>
                                                  <TableCell className="text-center font-mono text-sm">
                                                    <div className="flex items-center justify-center gap-1">
                                                      <Share2 className="h-3 w-3 text-purple-500" />
                                                      {formatMetricValue(
                                                        group.metrics.shares ||
                                                          0
                                                      )}
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="text-center font-mono text-sm">
                                                    {formatMetricValue(
                                                      group.metrics.saves || 0
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="text-center font-mono text-sm">
                                                    {formatMetricValue(
                                                      group.metrics.reach || 0
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="text-center font-mono text-sm">
                                                    {formatMetricValue(
                                                      group.metrics
                                                        .interactions || 0
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="text-center font-mono text-sm">
                                                    <div className="flex flex-col items-center">
                                                      <span className="font-bold">
                                                        {formatWatchTime(
                                                          group.totalCount >
                                                            0 &&
                                                            group.metrics
                                                              .avg_watch_time_ms >
                                                              0
                                                            ? Math.round(
                                                                (group.metrics
                                                                  .avg_watch_time_ms ||
                                                                  0) /
                                                                  group.totalCount
                                                              )
                                                            : 0
                                                        )}
                                                      </span>
                                                      <span
                                                        className={cn(
                                                          "text-xs",
                                                          isDark
                                                            ? "text-slate-400"
                                                            : "text-slate-500"
                                                        )}
                                                      >
                                                        avg
                                                      </span>
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="text-center font-mono text-sm">
                                                    <div className="flex flex-col items-center">
                                                      <span className="font-bold">
                                                        {formatWatchTime(
                                                          group.metrics
                                                            .total_watch_time_ms ||
                                                            0
                                                        )}
                                                      </span>
                                                      <span
                                                        className={cn(
                                                          "text-xs",
                                                          isDark
                                                            ? "text-slate-400"
                                                            : "text-slate-500"
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
                                          {/* Show reward columns for leaderboard contests, hide for Twitter CPM campaigns */}
                                          {!(
                                            (currentContest.platform?.toLowerCase() ===
                                              "twitter" ||
                                              currentContest.platform?.toLowerCase() ===
                                                "x") &&
                                            currentContest.contest_format ===
                                              "text_image"
                                          ) ||
                                          (currentContest.contest_type ===
                                            "leaderboard" &&
                                            (currentContest.platform?.toLowerCase() ===
                                              "twitter" ||
                                              currentContest.platform?.toLowerCase() ===
                                                "x") &&
                                            currentContest.contest_format ===
                                              "text_image") ? (
                                            <>
                                              <TableCell className="text-center font-medium">
                                                <div className="flex items-center justify-center gap-1">
                                                  {formatMoney(
                                                    group.earnings.expected
                                                  )}
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
                                                {formatMoney(
                                                  group.earnings.granted
                                                )}
                                              </TableCell>
                                            </>
                                          ) : null}
                                          {(() => {
                                            const flatFeeBonus =
                                              currentContest.contest_type ===
                                              "cpm"
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
                                                {formatMoney(
                                                  group.bonus.expected
                                                )}
                                              </TableCell>
                                              <TableCell className="text-center font-medium text-green-600">
                                                {formatMoney(
                                                  group.bonus.granted
                                                )}
                                              </TableCell>
                                            </>
                                          )}
                                          {/* Manual Points Adjustment and Reason Columns - Show for Twitter leaderboard campaigns */}
                                          {(currentContest.platform?.toLowerCase() ===
                                            "twitter" ||
                                            currentContest.platform?.toLowerCase() ===
                                              "x") &&
                                            currentContest.contest_format ===
                                              "text_image" &&
                                            currentContest.contest_type ===
                                              "leaderboard" && (
                                              <>
                                                <TableCell className="text-center">
                                                  <div className="flex flex-col items-center">
                                                    <span
                                                      className={cn(
                                                        "font-semibold text-sm",
                                                        group.metrics
                                                          .manual_points_adjustment >
                                                          0
                                                          ? "text-green-600"
                                                          : group.metrics
                                                              .manual_points_adjustment <
                                                            0
                                                          ? "text-red-600"
                                                          : isDark
                                                          ? "text-white"
                                                          : "text-slate-900"
                                                      )}
                                                    >
                                                      {group.metrics
                                                        .manual_points_adjustment >
                                                      0
                                                        ? "+"
                                                        : ""}
                                                      {formatMetricValue(
                                                        group.metrics
                                                          .manual_points_adjustment ||
                                                          0
                                                      )}
                                                    </span>
                                                  </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                  {group.metrics
                                                    .manual_points_reason ? (
                                                    <div className="flex flex-col items-center max-w-[200px] mx-auto">
                                                      <span
                                                        className={cn(
                                                          "text-xs italic truncate",
                                                          isDark
                                                            ? "text-slate-300"
                                                            : "text-slate-700"
                                                        )}
                                                        title={
                                                          group.metrics
                                                            .manual_points_reason
                                                        }
                                                      >
                                                        {group.metrics
                                                          .manual_points_reason
                                                          .length > 30
                                                          ? group.metrics.manual_points_reason.substring(
                                                              0,
                                                              30
                                                            ) + "..."
                                                          : group.metrics
                                                              .manual_points_reason}
                                                      </span>
                                                    </div>
                                                  ) : (
                                                    <span
                                                      className={cn(
                                                        "text-xs",
                                                        isDark
                                                          ? "text-slate-500"
                                                          : "text-slate-400"
                                                      )}
                                                    >
                                                      —
                                                    </span>
                                                  )}
                                                </TableCell>
                                              </>
                                            )}
                                          {/* Rejection Reason Column */}
                                          {showRejectionReasonColumn && (
                                            <TableCell className="text-center">
                                              {group.creator_rejection_reason ? (
                                                <div className="flex flex-col items-center max-w-[200px] mx-auto">
                                                  <span
                                                    className={cn(
                                                      "text-xs italic truncate",
                                                      isDark
                                                        ? "text-red-400"
                                                        : "text-red-600"
                                                    )}
                                                    title={
                                                      group.creator_rejection_reason
                                                    }
                                                  >
                                                    {group
                                                      .creator_rejection_reason
                                                      .length > 30
                                                      ? group.creator_rejection_reason.substring(
                                                          0,
                                                          30
                                                        ) + "..."
                                                      : group.creator_rejection_reason}
                                                  </span>
                                                </div>
                                              ) : (
                                                <span
                                                  className={cn(
                                                    "text-xs",
                                                    isDark
                                                      ? "text-slate-500"
                                                      : "text-slate-400"
                                                  )}
                                                >
                                                  —
                                                </span>
                                              )}
                                            </TableCell>
                                          )}
                                          <TableCell className="text-center text-sm">
                                            {formatLocalDateTime(
                                              group.firstSubmittedAt
                                            )}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            <div className="flex flex-col items-center gap-2">
                                              <div className="flex items-center gap-2">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className={cn(
                                                    "border",
                                                    isDark
                                                      ? "bg-[#170337] border-gray-600 text-white"
                                                      : "border-gray-400 bg-white text-gray-800"
                                                  )}
                                                  onClick={() =>
                                                    setSelectedCreatorForModal(
                                                      group.creator.id
                                                    )
                                                  }
                                                >
                                                  View All ({group.totalCount})
                                                </Button>
                                                {/* Creator moderation and payment options for Twitter campaigns */}
                                                {(currentContest.platform?.toLowerCase() ===
                                                  "twitter" ||
                                                  currentContest.platform?.toLowerCase() ===
                                                    "x") &&
                                                  currentContest.contest_format ===
                                                    "text_image" && (
                                                    <DropdownMenu>
                                                      <DropdownMenuTrigger
                                                        asChild
                                                      >
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-8 w-8 p-0"
                                                        >
                                                          <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                      </DropdownMenuTrigger>
                                                      <DropdownMenuContent align="end">
                                                        {group.creator_moderation_status !==
                                                          "verified" && (
                                                          <DropdownMenuItem
                                                            onClick={() => {
                                                              if (group.paid) {
                                                                // Show reversal confirmation for paid creators
                                                                setConfirmTwitterCreatorReversal(
                                                                  {
                                                                    creatorId:
                                                                      group
                                                                        .creator
                                                                        .id,
                                                                    action:
                                                                      "approve",
                                                                  }
                                                                );
                                                              } else {
                                                                // Direct approval for non-paid creators
                                                                (async () => {
                                                                  try {
                                                                    const response =
                                                                      await fetch(
                                                                        `/api/contests/${contestId}/moderate-creator`,
                                                                        {
                                                                          method:
                                                                            "POST",
                                                                          headers:
                                                                            {
                                                                              "Content-Type":
                                                                                "application/json",
                                                                            },
                                                                          body: JSON.stringify(
                                                                            {
                                                                              creatorId:
                                                                                group
                                                                                  .creator
                                                                                  .id,
                                                                              action:
                                                                                "approve",
                                                                            }
                                                                          ),
                                                                        }
                                                                      );
                                                                    if (
                                                                      response.ok
                                                                    ) {
                                                                      window.location.reload();
                                                                    } else {
                                                                      const error =
                                                                        await response.json();
                                                                      alert(
                                                                        error.error ||
                                                                          "Failed to approve creator"
                                                                      );
                                                                    }
                                                                  } catch (error) {
                                                                    console.error(
                                                                      "Error approving creator:",
                                                                      error
                                                                    );
                                                                    alert(
                                                                      "Failed to approve creator"
                                                                    );
                                                                  }
                                                                })();
                                                              }
                                                            }}
                                                            className="text-green-600"
                                                          >
                                                            <CheckCircle className="h-4 w-4 mr-2" />
                                                            Approve Creator
                                                          </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                          onClick={() => {
                                                            if (group.paid) {
                                                              // Show reversal confirmation for paid creators
                                                              setConfirmTwitterCreatorReversal(
                                                                {
                                                                  creatorId:
                                                                    group
                                                                      .creator
                                                                      .id,
                                                                  action:
                                                                    "reject",
                                                                  needRejectionReason:
                                                                    true,
                                                                  creatorUsername:
                                                                    group
                                                                      .creator
                                                                      .username,
                                                                }
                                                              );
                                                            } else {
                                                              // Direct rejection for non-paid creators
                                                              setPendingTwitterRejection(
                                                                {
                                                                  id: group
                                                                    .creator.id,
                                                                  type: "creator",
                                                                  creatorId:
                                                                    group
                                                                      .creator
                                                                      .id,
                                                                  creatorUsername:
                                                                    group
                                                                      .creator
                                                                      .username,
                                                                }
                                                              );
                                                              setTwitterRejectionModalOpen(
                                                                true
                                                              );
                                                            }
                                                          }}
                                                          className="text-red-600"
                                                        >
                                                          <XCircle className="h-4 w-4 mr-2" />
                                                          Reject Creator
                                                        </DropdownMenuItem>
                                                        {/* Payment options for Twitter creators */}
                                                        {currentContest.post_contest_status ===
                                                          "verification_complete" &&
                                                          !group.paid &&
                                                          isAdminView &&
                                                          currentContest.contest_type ===
                                                            "leaderboard" && (
                                                            <>
                                                              <DropdownMenuSeparator />
                                                              <DropdownMenuItem
                                                                onClick={async () => {
                                                                  setIsLoadingSubmission(
                                                                    (prev) => ({
                                                                      ...prev,
                                                                      [group
                                                                        .creator
                                                                        .id]:
                                                                        true,
                                                                    })
                                                                  );
                                                                  try {
                                                                    const response =
                                                                      await fetch(
                                                                        `/api/contests/${contestId}/pay-twitter-creator`,
                                                                        {
                                                                          method:
                                                                            "POST",
                                                                          headers:
                                                                            {
                                                                              "Content-Type":
                                                                                "application/json",
                                                                            },
                                                                          body: JSON.stringify(
                                                                            {
                                                                              creatorId:
                                                                                group
                                                                                  .creator
                                                                                  .id,
                                                                            }
                                                                          ),
                                                                        }
                                                                      );
                                                                    if (
                                                                      !response.ok
                                                                    ) {
                                                                      const error =
                                                                        await response.json();
                                                                      throw new Error(
                                                                        error.error ||
                                                                          "Failed to process payment"
                                                                      );
                                                                    }
                                                                    toast({
                                                                      title:
                                                                        "Success",
                                                                      description:
                                                                        "Creator payment processed successfully",
                                                                      variant:
                                                                        "default",
                                                                    });
                                                                    setTimeout(
                                                                      () => {
                                                                        window.location.reload();
                                                                      },
                                                                      1000
                                                                    );
                                                                  } catch (error: any) {
                                                                    console.error(
                                                                      "Error paying Twitter creator:",
                                                                      error
                                                                    );
                                                                    toast({
                                                                      title:
                                                                        "Error",
                                                                      description:
                                                                        error.message ||
                                                                        "Failed to process payment",
                                                                      variant:
                                                                        "destructive",
                                                                    });
                                                                  } finally {
                                                                    setIsLoadingSubmission(
                                                                      (
                                                                        prev
                                                                      ) => ({
                                                                        ...prev,
                                                                        [group
                                                                          .creator
                                                                          .id]:
                                                                          false,
                                                                      })
                                                                    );
                                                                  }
                                                                }}
                                                                disabled={
                                                                  isLoadingSubmission[
                                                                    group
                                                                      .creator
                                                                      .id
                                                                  ]
                                                                }
                                                              >
                                                                <DollarSign className="h-4 w-4 mr-2" />
                                                                Mark as Paid
                                                              </DropdownMenuItem>
                                                              <DropdownMenuItem
                                                                onClick={() => {
                                                                  setPendingTwitterPaymentCreator(
                                                                    group
                                                                      .creator
                                                                      .id
                                                                  );
                                                                  setPaymentModalOpen(
                                                                    true
                                                                  );
                                                                }}
                                                                disabled={
                                                                  isLoadingSubmission[
                                                                    group
                                                                      .creator
                                                                      .id
                                                                  ]
                                                                }
                                                              >
                                                                <DollarSign className="h-4 w-4 mr-2" />
                                                                Mark as Custom
                                                                Paid
                                                              </DropdownMenuItem>
                                                            </>
                                                          )}
                                                      </DropdownMenuContent>
                                                    </DropdownMenu>
                                                  )}
                                              </div>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    }
                                  )
                                )}
                              </TableBody>
                            </Table>
                          </>
                        )}

                      {/* Pagination Controls for Creator-wise View */}
                      {viewMode === "creator-wise" &&
                        filteredCreatorGroups &&
                        filteredCreatorGroups.length > 0 && (
                          <div className="mt-6 px-4">
                            <PaginationControls
                              page={creatorWisePage}
                              limit={creatorWiseItemsPerPage}
                              total={filteredCreatorGroups.length}
                              totalPages={creatorWiseTotalPages}
                              hasNextPage={creatorWiseHasNextPage}
                              hasPreviousPage={creatorWiseHasPreviousPage}
                              onPageChange={setCreatorWisePage}
                              onLimitChange={(limit) => {
                                setCreatorWiseItemsPerPage(limit);
                                setCreatorWisePage(1);
                              }}
                              isDark={isDark}
                            />
                          </div>
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

          {contest?.platform?.toLowerCase() === "twitter" && (
            <TabPanel value="twitter-feed" activeTab={activeTab}>
              <div className="p-6">
                <TwitterFeed
                  contestId={contestId}
                  contestTitle={currentContest?.title || "Contest"}
                  isDark={isDark}
                  showHeader={true}
                  lastMetricsUpdated={currentContest?.last_metrics_updated}
                  cooldownType={
                    (isAdminView ? "admin" : "brand") as
                      | "opportunities"
                      | "brand"
                      | "admin"
                  }
                />
              </div>
            </TabPanel>
          )}

          <TabPanel value="analytics" activeTab={activeTab}>
            <div
              className={cn(
                "rounded-xl shadow-md p-2",
                isDark ? "bg-[#180438]" : "bg-white"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Contest Analytics</CardTitle>
                  {/* Refresh Metrics Button - Only show for Twitter campaigns */}
                  {currentContest?.platform?.toLowerCase() === "twitter" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshMetrics}
                      disabled={isRefreshingMetrics || !cooldownInfo.canRefresh}
                      className={cn(
                        "flex items-center gap-2",
                        isDark
                          ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      )}
                      title={
                        !cooldownInfo.canRefresh
                          ? `Please wait ${
                              cooldownInfo.remainingMinutes
                            } more minute${
                              cooldownInfo.remainingMinutes !== 1 ? "s" : ""
                            }`
                          : "Refresh metrics from Twitter API"
                      }
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          isRefreshingMetrics && "animate-spin"
                        )}
                      />
                      {isRefreshingMetrics
                        ? "Updating..."
                        : !cooldownInfo.canRefresh
                        ? `Wait ${cooldownInfo.remainingMinutes}m`
                        : "Refresh Metrics"}
                    </Button>
                  )}
                </div>
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
                        className={cn(
                          "text-sm",
                          isDark
                            ? "text-white border border-gray-500"
                            : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                        )}
                      >
                        All ({currentSubmissions?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger
                        value="verified"
                        className={cn(
                          "text-sm",
                          isDark
                            ? "text-white border border-gray-500"
                            : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                        )}
                      >
                        Verified (
                        {currentSubmissions?.filter(
                          (s) => s.status === "verified"
                        ).length || 0}
                        )
                      </TabsTrigger>
                      <TabsTrigger
                        value="paid"
                        className={cn(
                          "text-sm",
                          isDark
                            ? "text-white border border-gray-500"
                            : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                        )}
                      >
                        Paid (
                        {currentSubmissions?.filter((s) => s.status === "paid")
                          .length || 0}
                        )
                      </TabsTrigger>
                      <TabsTrigger
                        value="pending"
                        className={cn(
                          "text-sm",
                          isDark
                            ? "text-white border border-gray-500"
                            : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                        )}
                      >
                        Pending (
                        {currentSubmissions?.filter(
                          (s) => s.status === "pending"
                        ).length || 0}
                        )
                      </TabsTrigger>
                      <TabsTrigger
                        value="rejected"
                        className={cn(
                          "text-sm",
                          isDark
                            ? "text-white border border-gray-500"
                            : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                        )}
                      >
                        Rejected (
                        {currentSubmissions?.filter(
                          (s) => s.status === "rejected"
                        ).length || 0}
                        )
                      </TabsTrigger>
                      <TabsTrigger
                        value="verified_or_paid"
                        className={cn(
                          "text-sm",
                          isDark
                            ? "text-white border border-gray-500"
                            : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600"
                        )}
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
                {/* Twitter Campaign Metrics Display */}
                {currentContest?.platform?.toLowerCase() === "twitter" &&
                  (() => {
                    // Calculate Twitter metrics from current submissions
                    const calculateTwitterMetrics = () => {
                      const metrics = {
                        total_tweets: 0,
                        total_likes: 0,
                        total_replies: 0,
                        total_retweets: 0,
                        total_quote_reposts: 0,
                        total_impressions: 0,
                        total_points: 0,
                      };

                      filteredAnalyticsSubmissions.forEach((sub: any) => {
                        const isTwitterTweet =
                          sub.is_twitter_tweet === true ||
                          sub.platform?.toLowerCase() === "twitter";
                        if (isTwitterTweet && sub.other_stats) {
                          metrics.total_tweets += 1;
                          metrics.total_likes += sub.other_stats.likes || 0;
                          metrics.total_replies += sub.other_stats.replies || 0;
                          metrics.total_retweets +=
                            sub.other_stats.retweets || 0;
                          metrics.total_quote_reposts +=
                            sub.other_stats.quote_reposts || 0;
                          metrics.total_impressions += sub.views || 0;
                          metrics.total_points +=
                            (sub.other_stats.points || 0) +
                            (sub.other_stats.manual_points_adjustment || 0);
                        }
                      });

                      return metrics;
                    };

                    const calculatedMetrics = calculateTwitterMetrics();
                    const metricsForDisplay =
                      calculatedMetrics || twitterMetrics;

                    return (
                      <div className="space-y-8 mb-8">
                        {/* For Raid Campaigns: Show Target Tweet, Target Metrics, and Current Achieved */}
                        {(() => {
                          const isRaid =
                            (currentContest as any).content_type === "raid" &&
                            currentContest?.contest_format === "text_image";

                          if (!isRaid) return null;

                          // Get raid target data from contest_based_details (source of truth) or twitterMetrics (synced)
                          const raidTarget =
                            currentContest?.contest_based_details
                              ?.twitter_campaign?.raid_target;
                          const targetTweetUrl =
                            twitterMetrics?.target_tweet_url ||
                            raidTarget?.link ||
                            null;
                          const targetMetrics = raidTarget?.metrics || {};

                          // Get target values - prefer twitterMetrics (synced) but fallback to contest data
                          const targetLikes =
                            twitterMetrics?.target_likes ??
                            (targetMetrics.likes
                              ? parseInt(String(targetMetrics.likes), 10)
                              : null);
                          const targetComments =
                            twitterMetrics?.target_comments ??
                            (targetMetrics.comments
                              ? parseInt(String(targetMetrics.comments), 10)
                              : null);
                          const targetRetweets =
                            twitterMetrics?.target_retweets ??
                            (targetMetrics.retweets
                              ? parseInt(String(targetMetrics.retweets), 10)
                              : null);
                          const targetQuoteReposts =
                            twitterMetrics?.target_quote_reposts ??
                            (targetMetrics.quote_reposts
                              ? parseInt(
                                  String(targetMetrics.quote_reposts),
                                  10
                                )
                              : null);

                          return (
                            <>
                              {/* Target Tweet Section */}
                              {targetTweetUrl && (
                                <div className="mb-6">
                                  <h3
                                    className={cn(
                                      "text-lg font-semibold mb-4 flex items-center gap-2",
                                      isDark ? "text-white" : "text-slate-900"
                                    )}
                                  >
                                    <Share2 className="h-5 w-5 text-sky-500" />
                                    Target Tweet
                                  </h3>
                                  <div
                                    className={cn(
                                      "rounded-xl p-6 border",
                                      isDark
                                        ? "bg-slate-900/40 border-slate-700"
                                        : "bg-slate-50 border-slate-200"
                                    )}
                                  >
                                    <a
                                      href={targetTweetUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "inline-flex items-center gap-2 text-sm font-medium break-all hover:underline",
                                        isDark
                                          ? "text-sky-300 hover:text-sky-200"
                                          : "text-sky-600 hover:text-sky-700"
                                      )}
                                    >
                                      {targetTweetUrl}
                                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* Target Metrics Section */}
                              {(() => {
                                const hasTargetMetrics =
                                  (targetLikes !== null && targetLikes > 0) ||
                                  (targetComments !== null &&
                                    targetComments > 0) ||
                                  (targetRetweets !== null &&
                                    targetRetweets > 0) ||
                                  (targetQuoteReposts !== null &&
                                    targetQuoteReposts > 0);

                                return hasTargetMetrics ? (
                                  <div className="mb-6">
                                    <h3
                                      className={cn(
                                        "text-lg font-semibold mb-4",
                                        isDark ? "text-white" : "text-slate-900"
                                      )}
                                    >
                                      Target Metrics
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                      {targetLikes !== null &&
                                        targetLikes > 0 && (
                                          <div
                                            className={cn(
                                              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                              isDark
                                                ? "bg-[#170337]"
                                                : "bg-white border border-slate-200"
                                            )}
                                          >
                                            <CardContent className="p-6 flex justify-between items-center">
                                              <div
                                                className={cn(
                                                  "flex-1 space-y-2",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-slate-800"
                                                )}
                                              >
                                                <p
                                                  className={cn(
                                                    "text-sm font-semibold uppercase tracking-wide",
                                                    isDark
                                                      ? "text-slate-200"
                                                      : "text-slate-600"
                                                  )}
                                                >
                                                  Target Likes
                                                </p>
                                                <p
                                                  className={cn(
                                                    "text-2xl font-black",
                                                    isDark
                                                      ? "text-white"
                                                      : "text-slate-800"
                                                  )}
                                                >
                                                  {targetLikes.toLocaleString()}
                                                </p>
                                              </div>
                                              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                                                <ThumbsUp className="h-7 w-7" />
                                              </div>
                                            </CardContent>
                                          </div>
                                        )}
                                      {targetComments !== null &&
                                        targetComments > 0 && (
                                          <div
                                            className={cn(
                                              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                              isDark
                                                ? "bg-[#170337]"
                                                : "bg-white border border-slate-200"
                                            )}
                                          >
                                            <CardContent className="p-6 flex justify-between items-center">
                                              <div
                                                className={cn(
                                                  "flex-1 space-y-2",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-slate-800"
                                                )}
                                              >
                                                <p
                                                  className={cn(
                                                    "text-sm font-semibold uppercase tracking-wide",
                                                    isDark
                                                      ? "text-slate-200"
                                                      : "text-slate-600"
                                                  )}
                                                >
                                                  Target Comments
                                                </p>
                                                <p
                                                  className={cn(
                                                    "text-2xl font-black",
                                                    isDark
                                                      ? "text-white"
                                                      : "text-slate-800"
                                                  )}
                                                >
                                                  {targetComments.toLocaleString()}
                                                </p>
                                              </div>
                                              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                                                <MessageCircle className="h-7 w-7" />
                                              </div>
                                            </CardContent>
                                          </div>
                                        )}
                                      {targetRetweets !== null &&
                                        targetRetweets > 0 && (
                                          <div
                                            className={cn(
                                              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                              isDark
                                                ? "bg-[#170337]"
                                                : "bg-white border border-slate-200"
                                            )}
                                          >
                                            <CardContent className="p-6 flex justify-between items-center">
                                              <div
                                                className={cn(
                                                  "flex-1 space-y-2",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-slate-800"
                                                )}
                                              >
                                                <p
                                                  className={cn(
                                                    "text-sm font-semibold uppercase tracking-wide",
                                                    isDark
                                                      ? "text-slate-200"
                                                      : "text-slate-600"
                                                  )}
                                                >
                                                  Target Retweets
                                                </p>
                                                <p
                                                  className={cn(
                                                    "text-2xl font-black",
                                                    isDark
                                                      ? "text-white"
                                                      : "text-slate-800"
                                                  )}
                                                >
                                                  {targetRetweets.toLocaleString()}
                                                </p>
                                              </div>
                                              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                                                <Share2 className="h-7 w-7" />
                                              </div>
                                            </CardContent>
                                          </div>
                                        )}
                                      {targetQuoteReposts !== null &&
                                        targetQuoteReposts > 0 && (
                                          <div
                                            className={cn(
                                              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                              isDark
                                                ? "bg-[#170337]"
                                                : "bg-white border border-slate-200"
                                            )}
                                          >
                                            <CardContent className="p-6 flex justify-between items-center">
                                              <div
                                                className={cn(
                                                  "flex-1 space-y-2",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-slate-800"
                                                )}
                                              >
                                                <p
                                                  className={cn(
                                                    "text-sm font-semibold uppercase tracking-wide",
                                                    isDark
                                                      ? "text-slate-200"
                                                      : "text-slate-600"
                                                  )}
                                                >
                                                  Target Quote Reposts
                                                </p>
                                                <p
                                                  className={cn(
                                                    "text-2xl font-black",
                                                    isDark
                                                      ? "text-white"
                                                      : "text-slate-800"
                                                  )}
                                                >
                                                  {targetQuoteReposts.toLocaleString()}
                                                </p>
                                              </div>
                                              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                                                <RefreshCw className="h-7 w-7" />
                                              </div>
                                            </CardContent>
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                ) : null;
                              })()}

                              {/* Current Progress Section (from target_current_*) */}
                              {(() => {
                                if (!twitterMetrics) return null;

                                const hasCurrentMetrics =
                                  twitterMetrics.target_current_likes !==
                                    null ||
                                  twitterMetrics.target_current_comments !==
                                    null ||
                                  twitterMetrics.target_current_retweets !==
                                    null ||
                                  twitterMetrics.target_current_quote_reposts !==
                                    null ||
                                  twitterMetrics.target_current_views !==
                                    null ||
                                  twitterMetrics.targets_reached !== null;

                                return hasCurrentMetrics ? (
                                  <div className="mb-6">
                                    <h3
                                      className={cn(
                                        "text-lg font-semibold mb-4",
                                        isDark ? "text-white" : "text-slate-900"
                                      )}
                                    >
                                      Current Progress
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                                      {twitterMetrics.target_current_likes !==
                                        null && (() => {
                                          const current = twitterMetrics.target_current_likes || 0;
                                          const target = targetLikes;
                                          const isReached = target !== null && current >= target;
                                          const progress = target !== null && target > 0 ? Math.min(100, (current / target) * 100) : 0;
                                          
                                          return (
                                            <div
                                              className={cn(
                                                "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                                isDark
                                                  ? "bg-[#170337]"
                                                  : "bg-white border border-slate-200"
                                              )}
                                            >
                                              <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-3">
                                                  <div
                                                    className={cn(
                                                      "flex-1 space-y-1",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-800"
                                                    )}
                                                  >
                                                    <p
                                                      className={cn(
                                                        "text-xs font-semibold uppercase tracking-wide",
                                                        isDark
                                                          ? "text-slate-200"
                                                          : "text-slate-600"
                                                      )}
                                                    >
                                                      Current Likes
                                                    </p>
                                                    <p
                                                      className={cn(
                                                        "text-2xl font-black",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-slate-800"
                                                      )}
                                                    >
                                                      {current.toLocaleString()}
                                                    </p>
                                                    {target !== null && (
                                                      <p
                                                        className={cn(
                                                          "text-xs",
                                                          isDark
                                                            ? "text-slate-400"
                                                            : "text-slate-500"
                                                        )}
                                                      >
                                                        of {target.toLocaleString()} target
                                                      </p>
                                                    )}
                                                  </div>
                                                  <div className={cn(
                                                    "w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300",
                                                    isReached
                                                      ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                                      : "bg-gradient-to-br from-pink-500 to-rose-600"
                                                  )}>
                                                    {isReached ? (
                                                      <CheckCircle2 className="h-7 w-7" />
                                                    ) : (
                                                      <ThumbsUp className="h-7 w-7" />
                                                    )}
                                                  </div>
                                                </div>
                                                {target !== null && target > 0 && (
                                                  <div className="mt-3">
                                                    <div className={cn(
                                                      "h-2 rounded-full overflow-hidden",
                                                      isDark ? "bg-slate-700" : "bg-slate-200"
                                                    )}>
                                                      <div
                                                        className={cn(
                                                          "h-full transition-all duration-500",
                                                          isReached
                                                            ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                                            : "bg-gradient-to-r from-pink-500 to-rose-600"
                                                        )}
                                                        style={{ width: `${progress}%` }}
                                                      />
                                                    </div>
                                                    <p className={cn(
                                                      "text-xs mt-1 text-center",
                                                      isDark ? "text-slate-400" : "text-slate-500"
                                                    )}>
                                                      {progress.toFixed(0)}% complete
                                                    </p>
                                                  </div>
                                                )}
                                              </CardContent>
                                            </div>
                                          );
                                        })()}
                                      {twitterMetrics.target_current_comments !==
                                        null && (() => {
                                          const current = twitterMetrics.target_current_comments || 0;
                                          const target = targetComments;
                                          const isReached = target !== null && current >= target;
                                          const progress = target !== null && target > 0 ? Math.min(100, (current / target) * 100) : 0;
                                          
                                          return (
                                            <div
                                              className={cn(
                                                "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                                isDark
                                                  ? "bg-[#170337]"
                                                  : "bg-white border border-slate-200"
                                              )}
                                            >
                                              <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-3">
                                                  <div
                                                    className={cn(
                                                      "flex-1 space-y-1",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-800"
                                                    )}
                                                  >
                                                    <p
                                                      className={cn(
                                                        "text-xs font-semibold uppercase tracking-wide",
                                                        isDark
                                                          ? "text-slate-200"
                                                          : "text-slate-600"
                                                      )}
                                                    >
                                                      Current Comments
                                                    </p>
                                                    <p
                                                      className={cn(
                                                        "text-2xl font-black",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-slate-800"
                                                      )}
                                                    >
                                                      {current.toLocaleString()}
                                                    </p>
                                                    {target !== null && (
                                                      <p
                                                        className={cn(
                                                          "text-xs",
                                                          isDark
                                                            ? "text-slate-400"
                                                            : "text-slate-500"
                                                        )}
                                                      >
                                                        of {target.toLocaleString()} target
                                                      </p>
                                                    )}
                                                  </div>
                                                  <div className={cn(
                                                    "w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300",
                                                    isReached
                                                      ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                                      : "bg-gradient-to-br from-orange-500 to-amber-600"
                                                  )}>
                                                    {isReached ? (
                                                      <CheckCircle2 className="h-7 w-7" />
                                                    ) : (
                                                      <MessageCircle className="h-7 w-7" />
                                                    )}
                                                  </div>
                                                </div>
                                                {target !== null && target > 0 && (
                                                  <div className="mt-3">
                                                    <div className={cn(
                                                      "h-2 rounded-full overflow-hidden",
                                                      isDark ? "bg-slate-700" : "bg-slate-200"
                                                    )}>
                                                      <div
                                                        className={cn(
                                                          "h-full transition-all duration-500",
                                                          isReached
                                                            ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                                            : "bg-gradient-to-r from-orange-500 to-amber-600"
                                                        )}
                                                        style={{ width: `${progress}%` }}
                                                      />
                                                    </div>
                                                    <p className={cn(
                                                      "text-xs mt-1 text-center",
                                                      isDark ? "text-slate-400" : "text-slate-500"
                                                    )}>
                                                      {progress.toFixed(0)}% complete
                                                    </p>
                                                  </div>
                                                )}
                                              </CardContent>
                                            </div>
                                          );
                                        })()}
                                      {twitterMetrics.target_current_retweets !==
                                        null && (() => {
                                          const current = twitterMetrics.target_current_retweets || 0;
                                          const target = targetRetweets;
                                          const isReached = target !== null && current >= target;
                                          const progress = target !== null && target > 0 ? Math.min(100, (current / target) * 100) : 0;
                                          
                                          return (
                                            <div
                                              className={cn(
                                                "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                                isDark
                                                  ? "bg-[#170337]"
                                                  : "bg-white border border-slate-200"
                                              )}
                                            >
                                              <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-3">
                                                  <div
                                                    className={cn(
                                                      "flex-1 space-y-1",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-800"
                                                    )}
                                                  >
                                                    <p
                                                      className={cn(
                                                        "text-xs font-semibold uppercase tracking-wide",
                                                        isDark
                                                          ? "text-slate-200"
                                                          : "text-slate-600"
                                                      )}
                                                    >
                                                      Current Retweets
                                                    </p>
                                                    <p
                                                      className={cn(
                                                        "text-2xl font-black",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-slate-800"
                                                      )}
                                                    >
                                                      {current.toLocaleString()}
                                                    </p>
                                                    {target !== null && (
                                                      <p
                                                        className={cn(
                                                          "text-xs",
                                                          isDark
                                                            ? "text-slate-400"
                                                            : "text-slate-500"
                                                        )}
                                                      >
                                                        of {target.toLocaleString()} target
                                                      </p>
                                                    )}
                                                  </div>
                                                  <div className={cn(
                                                    "w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300",
                                                    isReached
                                                      ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                                      : "bg-gradient-to-br from-cyan-500 to-teal-600"
                                                  )}>
                                                    {isReached ? (
                                                      <CheckCircle2 className="h-7 w-7" />
                                                    ) : (
                                                      <Share2 className="h-7 w-7" />
                                                    )}
                                                  </div>
                                                </div>
                                                {target !== null && target > 0 && (
                                                  <div className="mt-3">
                                                    <div className={cn(
                                                      "h-2 rounded-full overflow-hidden",
                                                      isDark ? "bg-slate-700" : "bg-slate-200"
                                                    )}>
                                                      <div
                                                        className={cn(
                                                          "h-full transition-all duration-500",
                                                          isReached
                                                            ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                                            : "bg-gradient-to-r from-cyan-500 to-teal-600"
                                                        )}
                                                        style={{ width: `${progress}%` }}
                                                      />
                                                    </div>
                                                    <p className={cn(
                                                      "text-xs mt-1 text-center",
                                                      isDark ? "text-slate-400" : "text-slate-500"
                                                    )}>
                                                      {progress.toFixed(0)}% complete
                                                    </p>
                                                  </div>
                                                )}
                                              </CardContent>
                                            </div>
                                          );
                                        })()}
                                      {twitterMetrics.target_current_quote_reposts !==
                                        null && (() => {
                                          const current = twitterMetrics.target_current_quote_reposts || 0;
                                          const target = targetQuoteReposts;
                                          const isReached = target !== null && current >= target;
                                          const progress = target !== null && target > 0 ? Math.min(100, (current / target) * 100) : 0;
                                          
                                          return (
                                            <div
                                              className={cn(
                                                "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                                isDark
                                                  ? "bg-[#170337]"
                                                  : "bg-white border border-slate-200"
                                              )}
                                            >
                                              <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-3">
                                                  <div
                                                    className={cn(
                                                      "flex-1 space-y-1",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-800"
                                                    )}
                                                  >
                                                    <p
                                                      className={cn(
                                                        "text-xs font-semibold uppercase tracking-wide",
                                                        isDark
                                                          ? "text-slate-200"
                                                          : "text-slate-600"
                                                      )}
                                                    >
                                                      Current Quote Reposts
                                                    </p>
                                                    <p
                                                      className={cn(
                                                        "text-2xl font-black",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-slate-800"
                                                      )}
                                                    >
                                                      {current.toLocaleString()}
                                                    </p>
                                                    {target !== null && (
                                                      <p
                                                        className={cn(
                                                          "text-xs",
                                                          isDark
                                                            ? "text-slate-400"
                                                            : "text-slate-500"
                                                        )}
                                                      >
                                                        of {target.toLocaleString()} target
                                                      </p>
                                                    )}
                                                  </div>
                                                  <div className={cn(
                                                    "w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300",
                                                    isReached
                                                      ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                                      : "bg-gradient-to-br from-indigo-500 to-violet-600"
                                                  )}>
                                                    {isReached ? (
                                                      <CheckCircle2 className="h-7 w-7" />
                                                    ) : (
                                                      <RefreshCw className="h-7 w-7" />
                                                    )}
                                                  </div>
                                                </div>
                                                {target !== null && target > 0 && (
                                                  <div className="mt-3">
                                                    <div className={cn(
                                                      "h-2 rounded-full overflow-hidden",
                                                      isDark ? "bg-slate-700" : "bg-slate-200"
                                                    )}>
                                                      <div
                                                        className={cn(
                                                          "h-full transition-all duration-500",
                                                          isReached
                                                            ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                                            : "bg-gradient-to-r from-indigo-500 to-violet-600"
                                                        )}
                                                        style={{ width: `${progress}%` }}
                                                      />
                                                    </div>
                                                    <p className={cn(
                                                      "text-xs mt-1 text-center",
                                                      isDark ? "text-slate-400" : "text-slate-500"
                                                    )}>
                                                      {progress.toFixed(0)}% complete
                                                    </p>
                                                  </div>
                                                )}
                                              </CardContent>
                                            </div>
                                          );
                                        })()}
                                      {twitterMetrics.target_current_views !==
                                        null && (
                                        <div
                                          className={cn(
                                            "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                            isDark
                                              ? "bg-[#170337]"
                                              : "bg-white border border-slate-200"
                                          )}
                                        >
                                          <CardContent className="p-6 flex justify-between items-center">
                                            <div
                                              className={cn(
                                                "flex-1 space-y-2",
                                                isDark
                                                  ? "text-white"
                                                  : "text-slate-800"
                                              )}
                                            >
                                              <p
                                                className={cn(
                                                  "text-sm font-semibold uppercase tracking-wide",
                                                  isDark
                                                    ? "text-slate-200"
                                                    : "text-slate-600"
                                                )}
                                              >
                                                Current Views
                                              </p>
                                              <p
                                                className={cn(
                                                  "text-2xl font-black",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-slate-800"
                                                )}
                                              >
                                                {(
                                                  twitterMetrics.target_current_views ||
                                                  0
                                                ).toLocaleString()}
                                              </p>
                                            </div>
                                            <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                                              <Eye className="h-7 w-7" />
                                            </div>
                                          </CardContent>
                                        </div>
                                      )}
                                    </div>
                                    {/* Targets Reached Status */}
                                    {twitterMetrics.targets_reached !==
                                      null && (
                                      <div
                                        className={cn(
                                          "rounded-xl p-4 border flex items-center gap-3",
                                          twitterMetrics.targets_reached
                                            ? isDark
                                              ? "bg-green-900/30 border-green-700"
                                              : "bg-green-50 border-green-200"
                                            : isDark
                                            ? "bg-yellow-900/30 border-yellow-700"
                                            : "bg-yellow-50 border-yellow-200"
                                        )}
                                      >
                                        {twitterMetrics.targets_reached ? (
                                          <CheckCircle2
                                            className={cn(
                                              "h-6 w-6 flex-shrink-0",
                                              isDark
                                                ? "text-green-400"
                                                : "text-green-600"
                                            )}
                                          />
                                        ) : (
                                          <Clock
                                            className={cn(
                                              "h-6 w-6 flex-shrink-0",
                                              isDark
                                                ? "text-yellow-400"
                                                : "text-yellow-600"
                                            )}
                                          />
                                        )}
                                        <div>
                                          <p
                                            className={cn(
                                              "text-sm font-semibold",
                                              twitterMetrics.targets_reached
                                                ? isDark
                                                  ? "text-green-300"
                                                  : "text-green-800"
                                                : isDark
                                                ? "text-yellow-300"
                                                : "text-yellow-800"
                                            )}
                                          >
                                            {twitterMetrics.targets_reached
                                              ? "Targets Reached"
                                              : "Targets Not Yet Reached"}
                                          </p>
                                          <p
                                            className={cn(
                                              "text-xs mt-1",
                                              twitterMetrics.targets_reached
                                                ? isDark
                                                  ? "text-green-400"
                                                  : "text-green-700"
                                                : isDark
                                                ? "text-yellow-400"
                                                : "text-yellow-700"
                                            )}
                                          >
                                            {twitterMetrics.targets_reached
                                              ? "All target metrics have been achieved. Contest will end when targets are reached."
                                              : "Keep engaging with the target tweet to reach the goals!"}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : null;
                              })()}
                            </>
                          );
                        })()}

                        {/* Campaign Metrics Section */}
                        <div>
                          <h3
                            className={cn(
                              "text-lg font-semibold mb-4",
                              isDark ? "text-white" : "text-slate-900"
                            )}
                          >
                            Campaign Metrics
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            {(() => {
                              const renderMetricCard = (
                                icon: React.ReactNode,
                                label: string,
                                value: string | number,
                                iconBgClass: string,
                                barGradientClass: string
                              ) => (
                                <div
                                  className={cn(
                                    "group rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative",
                                    isDark
                                      ? "bg-[#180438] border border-white/20 backdrop-blur-2xl"
                                      : "bg-gradient-to-br from-white to-blue-50 border border-blue-100"
                                  )}
                                >
                                  <div className="p-6 relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                      <div
                                        className={cn(
                                          "w-12 h-12 flex items-center justify-center rounded-xl shadow-lg backdrop-blur-sm",
                                          iconBgClass
                                        )}
                                      >
                                        {icon}
                                      </div>
                                      <div className="text-right">
                                        <p
                                          className={cn(
                                            "text-sm font-medium uppercase tracking-wide",
                                            isDark
                                              ? "text-white/90 drop-shadow-sm"
                                              : "text-gray-500"
                                          )}
                                        >
                                          {label}
                                        </p>
                                        <p
                                          className={cn(
                                            "text-2xl font-bold mt-1",
                                            isDark
                                              ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent"
                                              : "text-gray-900"
                                          )}
                                        >
                                          {typeof value === "number"
                                            ? value.toLocaleString()
                                            : value}
                                        </p>
                                      </div>
                                    </div>
                                    <div
                                      className={cn(
                                        "h-1 w-full rounded-full",
                                        barGradientClass
                                      )}
                                    ></div>
                                  </div>
                                </div>
                              );

                              return (
                                <>
                                  {renderMetricCard(
                                    <FileText className="h-6 w-6 text-white" />,
                                    "Total Tweets",
                                    metricsForDisplay?.total_tweets || 0,
                                    isDark
                                      ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                      : "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
                                    isDark
                                      ? "bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 shadow-lg shadow-blue-400/70 animate-pulse"
                                      : "bg-gradient-to-r from-blue-200 to-blue-300"
                                  )}
                                  {renderMetricCard(
                                    <ThumbsUp className="h-6 w-6 text-white" />,
                                    "Total Likes",
                                    metricsForDisplay?.total_likes || 0,
                                    isDark
                                      ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                      : "bg-gradient-to-br from-pink-500 to-pink-600 text-white",
                                    isDark
                                      ? "bg-gradient-to-r from-pink-400 via-rose-400 to-red-400 shadow-lg shadow-pink-400/70 animate-pulse"
                                      : "bg-gradient-to-r from-pink-200 to-pink-300"
                                  )}
                                  {renderMetricCard(
                                    <MessageCircle className="h-6 w-6 text-white" />,
                                    "Total Replies",
                                    metricsForDisplay?.total_replies || 0,
                                    isDark
                                      ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                      : "bg-gradient-to-br from-orange-500 to-orange-600 text-white",
                                    isDark
                                      ? "bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 shadow-lg shadow-orange-400/70 animate-pulse"
                                      : "bg-gradient-to-r from-orange-200 to-orange-300"
                                  )}
                                  {renderMetricCard(
                                    <Share2 className="h-6 w-6 text-white" />,
                                    "Total Retweets",
                                    metricsForDisplay?.total_retweets || 0,
                                    isDark
                                      ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                      : "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white",
                                    isDark
                                      ? "bg-gradient-to-r from-cyan-400 via-teal-400 to-green-400 shadow-lg shadow-cyan-400/70 animate-pulse"
                                      : "bg-gradient-to-r from-cyan-200 to-cyan-300"
                                  )}
                                  {renderMetricCard(
                                    <RefreshCw className="h-6 w-6 text-white" />,
                                    "Total Quote Reposts",
                                    metricsForDisplay?.total_quote_reposts || 0,
                                    isDark
                                      ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                      : "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white",
                                    isDark
                                      ? "bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 shadow-lg shadow-indigo-400/70 animate-pulse"
                                      : "bg-gradient-to-r from-indigo-200 to-indigo-300"
                                  )}
                                  {renderMetricCard(
                                    <Eye className="h-6 w-6 text-white" />,
                                    "Total Impressions",
                                    metricsForDisplay?.total_impressions || 0,
                                    isDark
                                      ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                      : "bg-gradient-to-br from-green-500 to-green-600 text-white",
                                    isDark
                                      ? "bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 shadow-lg shadow-green-400/70 animate-pulse"
                                      : "bg-gradient-to-r from-green-200 to-green-300"
                                  )}
                                  {renderMetricCard(
                                    <TrendingUp className="h-6 w-6 text-white" />,
                                    "Total Points",
                                    metricsForDisplay?.total_points || 0,
                                    isDark
                                      ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                      : "bg-gradient-to-br from-yellow-500 to-yellow-600 text-white",
                                    isDark
                                      ? "bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 shadow-lg shadow-yellow-400/70 animate-pulse"
                                      : "bg-gradient-to-r from-yellow-200 to-yellow-300"
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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

                  <div
                    className={cn(
                      "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                      isDark
                        ? "bg-[#170337] border border-[#D1B7F9]"
                        : "bg-white"
                    )}
                  >
                    <CardContent className="p-4 flex justify-between">
                      <div
                        className={cn(
                          "flex-1 space-y-3",
                          isDark ? "text-white" : "text-black"
                        )}
                      >
                        <p className="text-lg font-medium">Total Submissions</p>
                        <p className="text-xl font-bold">
                          {currentSubmissions?.length || 0}
                        </p>
                        {/* <p className="text-md">Total entries</p> */}
                      </div>
                      <div
                        className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-full ",
                          isDark
                            ? "bg-[#FFFFFF42] text-white"
                            : "bg-purple-100 text-[#4A00BE]"
                        )}
                      >
                        <Users className="h-5 w-5 " />
                      </div>
                    </CardContent>
                  </div>

                  <div
                    className={cn(
                      "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                      isDark
                        ? "bg-[#170337] border border-[#D1B7F9]"
                        : "bg-white"
                    )}
                  >
                    <CardContent className="p-4 flex justify-between">
                      <div
                        className={cn(
                          "flex-1 space-y-3",
                          isDark ? "text-white" : "text-black"
                        )}
                      >
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
                      <div
                        className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-full",
                          isDark
                            ? "bg-[#FFFFFF42] text-white"
                            : "bg-purple-100 text-[#4A00BE]"
                        )}
                      >
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

                  <div
                    className={cn(
                      "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                      isDark
                        ? "bg-[#170337] border border-[#D1B7F9]"
                        : "bg-white"
                    )}
                  >
                    <CardContent className="p-4 flex justify-between">
                      <div
                        className={cn(
                          "flex-1 space-y-3",
                          isDark ? "text-white" : "text-black"
                        )}
                      >
                        <p className="text-lg font-medium">Contest Duration</p>
                        <p className="text-xl font-bold">
                          {" "}
                          {durationDays ? `${durationDays} days` : "N/A"}
                        </p>
                        {/* <p className="text-md">Total entries</p> */}
                      </div>
                      <div
                        className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-full",
                          isDark
                            ? "bg-[#FFFFFF42] text-white"
                            : "bg-purple-100 text-[#4A00BE]"
                        )}
                      >
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
                      <div
                        className={cn(
                          "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                          isDark
                            ? "bg-[#170337] border border-[#D1B7F9]"
                            : "bg-white"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p
                              className={cn(
                                "text-sm font-medium",
                                isDark ? "text-white" : "text-gray-600"
                              )}
                            >
                              Total Views
                            </p>
                            <p
                              className={cn(
                                "text-2xl font-bold",
                                isDark ? "text-white" : "text-gray-900"
                              )}
                            >
                              {filteredAnalyticsSubmissions
                                ?.reduce((sum, s) => sum + (s.views || 0), 0)
                                .toLocaleString() || 0}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "w-10 h-10 flex items-center justify-center rounded-full",
                              isDark
                                ? "bg-blue-900/50 text-blue-300"
                                : "bg-blue-100 text-blue-600"
                            )}
                          >
                            <Eye className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      {/* Average Views */}
                      <div
                        className={cn(
                          "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                          isDark
                            ? "bg-[#170337] border border-[#D1B7F9]"
                            : "bg-white"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p
                              className={cn(
                                "text-sm font-medium",
                                isDark ? "text-white" : "text-gray-600"
                              )}
                            >
                              Avg Views
                            </p>
                            <p
                              className={cn(
                                "text-2xl font-bold",
                                isDark ? "text-white" : "text-gray-900"
                              )}
                            >
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
                          <div
                            className={cn(
                              "w-10 h-10 flex items-center justify-center rounded-full",
                              isDark
                                ? "bg-green-900/50 text-green-400"
                                : "bg-green-100 text-green-600"
                            )}
                          >
                            <BarChart3 className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      {/* Top Submission Views */}
                      <div
                        className={cn(
                          "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                          isDark
                            ? "bg-[#170337] border border-[#D1B7F9]"
                            : "bg-white"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p
                              className={cn(
                                "text-sm font-medium",
                                isDark ? "text-white" : "text-gray-600"
                              )}
                            >
                              Highest Views
                            </p>
                            <p
                              className={cn(
                                "text-2xl font-bold",
                                isDark ? "text-white" : "text-gray-900"
                              )}
                            >
                              {filteredAnalyticsSubmissions?.length > 0
                                ? Math.max(
                                    ...filteredAnalyticsSubmissions.map(
                                      (s) => s.views || 0
                                    )
                                  ).toLocaleString()
                                : 0}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "w-10 h-10 flex items-center justify-center rounded-full",
                              isDark
                                ? "bg-yellow-900/50 text-yellow-400"
                                : "bg-yellow-100 text-yellow-600"
                            )}
                          >
                            <TrendingUp className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      {/* Filtered Submissions Views */}
                      <div
                        className={cn(
                          "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                          isDark
                            ? "bg-[#170337] border border-[#D1B7F9]"
                            : "bg-white"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p
                              className={cn(
                                "text-sm font-medium",
                                isDark ? "text-white" : "text-gray-600"
                              )}
                            >
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
                            <p
                              className={cn(
                                "text-2xl font-bold",
                                isDark ? "text-white" : "text-gray-900"
                              )}
                            >
                              {filteredAnalyticsSubmissions
                                ?.reduce((sum, s) => sum + (s.views || 0), 0)
                                .toLocaleString() || 0}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "w-10 h-10 flex items-center justify-center rounded-full",
                              isDark
                                ? "bg-purple-900/50 text-purple-300"
                                : "bg-purple-100 text-purple-600"
                            )}
                          >
                            <CheckCircle className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ROI/Benefit Analysis - Collapsible Section */}
                  <div className="mt-8">
                    <details className="group">
                      <summary
                        className={cn(
                          "flex items-center justify-between cursor-pointer p-4 rounded-lg transition-colors",
                          isDark
                            ? "border border-[#D1B7F9]"
                            : "bg-gray-50 hover:bg-gray-100"
                        )}
                      >
                        <h3
                          className={cn(
                            "font-medium",
                            isDark ? "text-white" : "text-gray-800"
                          )}
                        >
                          ROI & Benefit Analysis
                        </h3>
                        <ChevronDown className="h-5 w-5 text-gray-500 group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="mt-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Total Investment */}
                          <div
                            className={cn(
                              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                              isDark
                                ? "bg-[#170337] border border-gray-600"
                                : "bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p
                                  className={cn(
                                    "text-sm font-medium",
                                    isDark ? "text-white" : "text-gray-600"
                                  )}
                                >
                                  Total Investment
                                </p>
                                <p
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark ? "text-white" : "text-gray-900"
                                  )}
                                >
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
                                <p
                                  className={cn(
                                    "text-xs text-gray-500 mt-1",
                                    isDark ? "text-white" : "text-gray-500"
                                  )}
                                >
                                  {currentContest.contest_type === "leaderboard"
                                    ? "Prize Pool"
                                    : "Total Paid"}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "w-10 h-10 flex items-center justify-center rounded-full",
                                  isDark
                                    ? "bg-red-900/50 text-red-300"
                                    : "bg-red-100 text-red-600"
                                )}
                              >
                                <DollarSign className="h-5 w-5" />
                              </div>
                            </div>
                          </div>

                          {/* Views Generated */}
                          <div
                            className={cn(
                              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                              isDark
                                ? "bg-[#170337] border border-gray-600"
                                : "bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p
                                  className={cn(
                                    "text-sm font-medium",
                                    isDark ? "text-white" : "text-gray-600"
                                  )}
                                >
                                  Views Generated
                                </p>
                                <p
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark ? "text-white" : "text-gray-900"
                                  )}
                                >
                                  {filteredAnalyticsSubmissions
                                    ?.reduce(
                                      (sum, s) => sum + (s.views || 0),
                                      0
                                    )
                                    .toLocaleString() || 0}
                                </p>
                                <p
                                  className={cn(
                                    "text-xs text-gray-500 mt-1",
                                    isDark ? "text-white" : "text-gray-500"
                                  )}
                                >
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
                              <div
                                className={cn(
                                  "w-10 h-10 flex items-center justify-center rounded-full",
                                  isDark
                                    ? "bg-blue-900/50 text-blue-300"
                                    : "bg-blue-100 text-blue-600"
                                )}
                              >
                                <Eye className="h-5 w-5" />
                              </div>
                            </div>
                          </div>

                          {/* Cost Per View */}
                          <div
                            className={cn(
                              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                              isDark
                                ? "bg-[#170337] border border-gray-600"
                                : "bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p
                                  className={cn(
                                    "text-sm font-medium",
                                    isDark ? "text-white" : "text-gray-600"
                                  )}
                                >
                                  Cost Per View
                                </p>
                                <p
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark ? "text-white" : "text-gray-900"
                                  )}
                                >
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
                                <p
                                  className={cn(
                                    "text-xs text-gray-500 mt-1",
                                    isDark ? "text-white" : "text-gray-500"
                                  )}
                                >
                                  {currentContest.contest_type === "leaderboard"
                                    ? "Prize Pool ÷ Views"
                                    : "Paid ÷ Views"}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "w-10 h-10 flex items-center justify-center rounded-full",
                                  isDark
                                    ? "bg-green-900/50 text-green-400"
                                    : "bg-green-100 text-green-600"
                                )}
                              >
                                <BarChart3 className="h-5 w-5" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* CPM Contest Specific Metrics */}
                        {currentContest.contest_type === "cpm" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* CPM Rate */}
                            <div
                              className={cn(
                                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                                isDark
                                  ? "bg-[#170337] border border-gray-600"
                                  : "bg-white"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-gray-600"
                                    )}
                                  >
                                    CPM Rate
                                  </p>
                                  <p
                                    className={cn(
                                      "text-2xl font-bold",
                                      isDark ? "text-white" : "text-gray-900"
                                    )}
                                  >
                                    $
                                    {currentContest.contest_based_details?.cpm_contest?.cpm_rate_usd?.toFixed(
                                      2
                                    ) || "0.00"}
                                  </p>
                                  <p
                                    className={cn(
                                      "text-xs text-gray-500 mt-1",
                                      isDark ? "text-white" : "text-gray-500"
                                    )}
                                  >
                                    Per 1,000 views
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-full",
                                    isDark
                                      ? "bg-purple-900/50 text-purple-300"
                                      : "bg-purple-100 text-purple-600"
                                  )}
                                >
                                  <TrendingUp className="h-5 w-5" />
                                </div>
                              </div>
                            </div>

                            {/* Effective CPM */}
                            <div
                              className={cn(
                                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                                isDark
                                  ? "bg-[#170337] border border-gray-600"
                                  : "bg-white"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-gray-600"
                                    )}
                                  >
                                    Effective CPM
                                  </p>
                                  <p
                                    className={cn(
                                      "text-2xl font-bold",
                                      isDark ? "text-white" : "text-gray-900"
                                    )}
                                  >
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
                                  <p
                                    className={cn(
                                      "text-xs text-gray-500 mt-1",
                                      isDark ? "text-white" : "text-gray-500"
                                    )}
                                  >
                                    Actual rate achieved
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-full",
                                    isDark
                                      ? "bg-orange-900/50 text-orange-300"
                                      : "bg-orange-100 text-orange-600"
                                  )}
                                >
                                  <BarChart3 className="h-5 w-5" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Summary Card */}
                        <div
                          className={cn(
                            "rounded-xl p-6 border",
                            isDark
                              ? "bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-white/20 backdrop-blur-2xl"
                              : "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200"
                          )}
                        >
                          <h4
                            className={cn(
                              "font-semibold text-lg mb-3",
                              isDark ? "text-white" : "text-gray-800"
                            )}
                          >
                            Performance Summary
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p
                                className={cn(
                                  "text-sm mb-1",
                                  isDark ? "text-white/70" : "text-gray-600"
                                )}
                              >
                                Investment Efficiency
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-semibold",
                                  isDark ? "text-white" : "text-gray-800"
                                )}
                              >
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
                              <p
                                className={cn(
                                  "text-sm mb-1",
                                  isDark ? "text-white/70" : "text-gray-600"
                                )}
                              >
                                Contest Type
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-semibold capitalize",
                                  isDark ? "text-white" : "text-gray-800"
                                )}
                              >
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
                    <h3
                      className={cn(
                        "font-medium mb-4",
                        isDark ? "text-white" : "text-gray-900"
                      )}
                    >
                      Views Distribution
                    </h3>
                    <div
                      className={cn(
                        "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-6",
                        isDark
                          ? "bg-[#180438] border border-white/20 backdrop-blur-2xl"
                          : "bg-white"
                      )}
                    >
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
                                  <div
                                    className={cn(
                                      "w-8 text-sm font-medium",
                                      isDark ? "text-white/70" : "text-gray-600"
                                    )}
                                  >
                                    #{index + 1}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between text-sm mb-1">
                                      <span
                                        className={cn(
                                          isDark
                                            ? "text-white/80"
                                            : "text-gray-600"
                                        )}
                                      >
                                        {submission.creator_username ||
                                          submission.creator_display_name ||
                                          "Unknown Creator"}
                                      </span>
                                      <span
                                        className={cn(
                                          "font-medium",
                                          isDark
                                            ? "text-white"
                                            : "text-gray-900"
                                        )}
                                      >
                                        {views.toLocaleString()} views
                                      </span>
                                    </div>
                                    <div
                                      className={cn(
                                        "w-full rounded-full h-2",
                                        isDark ? "bg-white/20" : "bg-gray-200"
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "h-2 rounded-full transition-all duration-300",
                                          isDark
                                            ? "bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 shadow-lg shadow-purple-400/50"
                                            : "bg-gradient-to-r from-blue-500 to-purple-600"
                                        )}
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
                          <p
                            className={cn(
                              isDark ? "text-white/60" : "text-gray-500"
                            )}
                          >
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

      {/* Twitter-specific rejection modal */}
      <TwitterRejectionModal
        isOpen={twitterRejectionModalOpen}
        onClose={() => {
          setTwitterRejectionModalOpen(false);
          setPendingTwitterRejection(null);
        }}
        onConfirm={handleTwitterRejectionConfirm}
        isLoading={
          pendingTwitterRejection
            ? pendingTwitterRejection.type === "creator"
              ? Object.values(isLoadingSubmission).some((v) => v)
              : isLoadingSubmission[pendingTwitterRejection.id] || false
            : false
        }
        isCreatorRejection={pendingTwitterRejection?.type === "creator"}
        creatorUsername={pendingTwitterRejection?.creatorUsername}
      />

      {/* Custom Pay Modal only */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setPendingPaymentSubmission(null);
          setPendingTwitterPaymentCreator(null);
        }}
        onConfirm={handlePaymentConfirm}
        isLoading={
          (pendingPaymentSubmission &&
            isLoadingSubmission[pendingPaymentSubmission || ""]) ||
          (pendingTwitterPaymentCreator &&
            isLoadingSubmission[pendingTwitterPaymentCreator || ""]) ||
          false
        }
        initialMode="custom"
        showModeSwitcher={false}
        showProofAndDescription={false}
      />

      {/* Manual Points Adjustment Modal */}
      <ManualPointsModal
        isOpen={manualPointsModalOpen}
        onClose={() => {
          setManualPointsModalOpen(false);
          setPendingManualPointsSubmission(null);
        }}
        onConfirm={handleManualPointsConfirm}
        isLoading={
          pendingManualPointsSubmission
            ? isLoadingSubmission[pendingManualPointsSubmission.id] || false
            : false
        }
        adjustmentType={pendingManualPointsSubmission?.type || "tweet"}
        currentPoints={
          pendingManualPointsSubmission
            ? (() => {
                const submission = currentSubmissions.find(
                  (s) => s.id === pendingManualPointsSubmission.id
                );
                if (pendingManualPointsSubmission.type === "leaderboard") {
                  // Get total points from leaderboard (would need to fetch or calculate)
                  return submission?.other_stats?.points || 0;
                }
                return submission?.other_stats?.points || 0;
              })()
            : 0
        }
        creatorName={
          pendingManualPointsSubmission
            ? (() => {
                const submission = currentSubmissions.find(
                  (s) => s.id === pendingManualPointsSubmission.id
                );
                return (
                  submission?.creator_display_name ||
                  submission?.creator_username ||
                  undefined
                );
              })()
            : undefined
        }
      />

      {/* Reversal confirmation dialog for submissions */}
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

      {/* Reversal confirmation dialog for Twitter creators */}
      <Dialog
        open={!!confirmTwitterCreatorReversal}
        onOpenChange={(open) => !open && setConfirmTwitterCreatorReversal(null)}
        isdark={isDark}
      >
        <DialogContent
          className={cn("sm:max-w-lg", isDark ? "text-white" : "text-gray-800")}
        >
          <DialogHeader>
            <DialogTitle>Revert payment and update creator status?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-md ">
            <p>
              Changing creator status from Paid will reverse the credited amount
              from the creator's wallet and remove related reward transactions.
            </p>
            <p className="font-medium">This action cannot be undone.</p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={handleConfirmTwitterCreatorReversal}
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
              onClick={() => setConfirmTwitterCreatorReversal(null)}
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
            await handleUpdateSubmissionStatus(submissionId, action);
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
