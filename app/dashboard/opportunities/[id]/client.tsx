"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Eye,
  Info,
  AlertCircle,
  Trophy,
  Youtube,
  Instagram,
  User,
  Users,
  Share2,
  ListOrdered,
  ScrollText,
  Link2,
  Lightbulb,
  PlayCircle,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Clock,
  Monitor,
  Play,
  FileText,
  DollarSign,
  CheckCheck,
  Gift,
  Tag,
  Star,
  Copy,
  TrendingUp,
  Wallet,
  Video,
  ThumbsUp,
  MessageCircle,
  BarChart3,
  Zap,
  Lock,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RestrictedCampaignPreview } from "@/components/campaign-access/RestrictedCampaignPreview";
import { WelcomeBanner } from "@/components/campaign-access/WelcomeBanner";
import { applicationsApi } from "@/components/campaign-access/api";
import type { ContestPreview } from "@/lib/campaign-access";
import {
  cn,
  formatLocalDateTime,
  formatTimeAgo,
  isContestEnded,
} from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { isCpmContestType, isMilestoneContestType } from "@/lib/contest-type";
import {
  countPendingLeaderboardSubmissions,
  renderLeaderboardStatusBadge,
} from "@/lib/status-badges";
import { CreatorEligibilitySection } from "@/components/CreatorEligibilitySection";
import { CreatorContestRequirementsGate } from "@/components/CreatorContestRequirementsGate";
import { useCreatorContestEligibility } from "@/hooks/useCreatorContestEligibility";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { fetchContestTwitterTweetsAllPages } from "@/lib/fetch-contest-submissions";
import {
  getMetricsRefreshCooldownInfoOpportunities,
  formatRemainingTime,
} from "@/lib/constants";
import type { UserResponse } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import { useTabState } from "@/components/ui/tab-utils";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { CONTENT_TYPE_CATEGORIES } from "@/constants/contentCategories";
import { TwitterFeed } from "@/components/twitter-feed";
import { getTwitterSubmissionActionKind } from "@/lib/twitter/analytics-twitter-submission-kind";
import {
  buildMilestoneMostVerifiedBonusByCreatorMapFromDetails,
  buildMilestoneSubmissionPayoutAssignmentsFromDetails,
  collectMilestoneBonusConfigs,
  winnerCountsByTargetForPlatform,
} from "@/lib/milestone-contest-expected-spend";
import { parsePayoutAdjustment } from "@/lib/payout-rules";
import { trackSubmitEntryClick, type SubmitEntryButton } from "@/lib/gtag";
import {
  leaderboardBannerCountsFromPayload,
  leaderboardSubmissionBannerCounts,
  type LeaderboardSubmissionBannerCounts,
} from "@/lib/leaderboard-submission-counts";
import {
  ALL_PLATFORM_TAB,
  VIDEO_PLATFORM_LABELS,
  flattenContestInspirationLinks,
  flattenContestResources,
  bonusDetailsForPlatform,
  briefHtmlForPlatform,
  contestTypeForPlatform,
  inspirationLinksForPlatform,
  isKeyedMaxEarningsMap,
  isVideoContestPlatform,
  maxEarningsCentsForPlatform,
  parseVideoContestPlatforms,
  readPersistedPlatformCampaigns,
  resolveContestPoolBudgetCents,
  resolveLeaderboardPrizePoolCents,
  resolveLeaderboardWinnerCount,
  getLeaderboardPrizePoolCents,
  resolveMaxEarningsCentsForSubmission,
  resourcesForPlatform,
  rulesHtmlForPlatform,
  withProjectedTopLevelPayout,
  leaderboardPrizeStructuresDifferAcrossPlatforms,
  resolveLeaderboardPrizeRankingPlan,
  flatFeeBonusesDifferAcrossPlatforms,
  leaderboardBonusBudgetsDifferAcrossPlatforms,
  briefsDifferAcrossPlatforms,
  rulesDifferAcrossPlatforms,
  bonusDetailsDifferAcrossPlatforms,
  maxEarningsDifferAcrossPlatforms,
  groupVideoPayoutPlatformsByConfig,
  groupPlatformsByBrief,
  groupPlatformsByRules,
  groupPlatformsByInspirationLinks,
  groupPlatformsByResources,
  preferRichestHtmlAmong,
  type PlatformTabValue,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";
import { resolveSequentialRefreshPollIndex } from "@/lib/multi-platform-metrics-refresh";
import {
  isTerminalPostCampaignRunStatus,
  isTrackedPostCampaignRun,
} from "@/lib/post-campaign-refresh-client";
import { postCampaignEnqueuePathForPlatform } from "@/lib/post-campaign-platforms";
import type { PostCampaignVideoPlatform } from "@/lib/post-campaign-platforms";
import { ContestDetailPlatformTabs } from "@/components/contest/ContestDetailPlatformTabs";
import {
  ContestDetailPlatformScopeCard,
  ContestDetailSharedAcrossPlatformsHint,
} from "@/components/contest/ContestDetailPlatformScopeCard";
import { ContestDetailVideoPayoutSections } from "@/components/contest/ContestDetailVideoPayoutSections";
import { getPlatformIcon } from "@/lib/platform-icons";
import {
  CopyContentButton,
  copyPayloadFromElement,
} from "@/components/contest/CopyContentButton";
import {
  formatLinkListForCopy,
  isCopyableUrl,
  linkCopyPayload,
  type CopyLinkGroup,
} from "@/lib/copy-section";
import {
  ContestDetailsCover,
  contestTypeDisplayLabel,
  platformDisplayLabel,
} from "./ContestDetailsCover";
import { BrandOverviewSectionCard } from "@/components/contest/BrandOverviewSectionCard";
import {
  buildContestEligibilityDisplayItems,
  hasAnyContestCreatorRequirement,
} from "@/lib/creator-requirements";
import { isVideoContestFormat } from "@/lib/trust-score";

// --- START DUMMY DATA CONFIGURATION ---
const USE_DUMMY_DATA_FOR_LEADERBOARD = false; // SWITCHED OFF FOR PRODUCTION
const DUMMY_ENTRIES_COUNT = 250; // Total number of dummy entries to generate
const MY_DUMMY_SUBMISSION_USER_ID = "user_dummy_me_special_id_123"; // A consistent ID for 'my' dummy submission
// --- END DUMMY DATA CONFIGURATION ---

// Define type for prize objects globally within the file
type PrizeInfo = {
  position: number;
  amount: number;
};

type TwitterMetricsRefreshRunSummary = {
  id: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
};
// Tabs will be dynamically generated based on contest platform
type TabConfig = { id: string; label: string };
const getTabs = (platform?: string | null): TabConfig[] => {
  const baseTabs: TabConfig[] = [
    { id: "details", label: "Contest Details" },
    { id: "leaderboard", label: "Leaderboard" },
  ];

  if (platform?.toLowerCase() === "twitter") {
    return [
      ...baseTabs,
      { id: "twitter-feed", label: "Twitter Feed" },
      { id: "analytics", label: "Analytics" },
    ];
  }

  return baseTabs;
};

// Section navigation configuration
type SectionConfig = {
  id: string;
  label: string;
  conditional?:
    | "leaderboard"
    | "inspiration-links"
    | "tracking-links"
    | "creator-eligibility";
};

const BASE_SECTIONS: SectionConfig[] = [
  { id: "earning-opportunities", label: "Earning" },
  {
    id: "prize-structure",
    label: "Prizes",
    conditional: "leaderboard",
  },
  { id: "content-requirements", label: "Requirements" },
  { id: "participation-guidelines", label: "Guidelines" },
  { id: "resources-tools", label: "Resources" },
  {
    id: "inspiration-links",
    label: "Inspiration",
    conditional: "inspiration-links",
  },
  {
    id: "tracking-links",
    label: "Tracking",
    conditional: "tracking-links",
  },
  { id: "contest-details", label: "Contest details" },
  {
    id: "creator-eligibility",
    label: "Eligibility",
    conditional: "creator-eligibility",
  },
];
// LeaderboardEntry type reflects combined data from API
type LeaderboardEntry = {
  id: string;
  creator_id: string;
  video_title: string;
  video_thumbnail_url: string | null;
  views: number;
  earnings: number;
  status: string;
  created_at: string;
  content_link: string;
  platform: string;
  user_platform_username: string;
  user_full_name: string;
  creator_pfp_url: string | null;
  user_platform_pfp_url: string | null;
  /** Global rank (1-based) from API; matches contest/brand side for correct Winning Zone / expected reward */
  rank?: number;
  bonus_paid?: boolean;
  bonus_paid_at?: string | null;
  bonus_amount?: number | null;
  milestone_bonus_paid?: { views?: number; reels?: number } | null;
};

function uniqueVideoPlatformsFromValues(
  values: Array<string | null | undefined>,
): VideoContestPlatform[] {
  const seen = new Set<VideoContestPlatform>();
  const out: VideoContestPlatform[] = [];
  for (const value of values) {
    const platform = parseVideoContestPlatforms(value)[0];
    if (!platform || seen.has(platform)) continue;
    seen.add(platform);
    out.push(platform);
  }
  return out;
}

function LeaderboardRowPlatformIcons({
  values,
  show,
  tab = ALL_PLATFORM_TAB,
}: {
  values: Array<string | null | undefined>;
  show: boolean;
  tab?: PlatformTabValue;
}) {
  if (!show) return null;
  let platforms = uniqueVideoPlatformsFromValues(values);
  if (tab !== ALL_PLATFORM_TAB && isVideoContestPlatform(tab)) {
    platforms = platforms.filter((platform) => platform === tab);
  }
  if (platforms.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {platforms.map((platform) => (
        <span
          key={platform}
          className="inline-flex"
          title={VIDEO_PLATFORM_LABELS[platform]}
        >
          {getPlatformIcon(platform, "sm")}
        </span>
      ))}
    </span>
  );
}

const HEXAGON_CLIP_PATH =
  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

/** Hexagon rank badge (dark hexagon with a gold outline). */
function RankHexBadge({
  rank,
  size = "md",
  isDark,
  title,
  className,
}: {
  rank: number | string;
  size?: "sm" | "md" | "lg";
  isDark?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-[#d9a520]",
        size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9",
        className,
      )}
      style={{ clipPath: HEXAGON_CLIP_PATH }}
    >
      <span
        className={cn(
          "inline-flex h-[calc(100%-3px)] w-[calc(100%-3px)] items-center justify-center font-bold tabular-nums text-white",
          size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm",
          isDark ? "bg-[#0f0220]" : "bg-[#1c1917]",
        )}
        style={{ clipPath: HEXAGON_CLIP_PATH }}
      >
        {rank}
      </span>
    </span>
  );
}

/** Hexagon badge for the top 3 ranks, plain number for everyone else. */
function RankIndicator({
  rank,
  isDark,
  title,
}: {
  rank: number;
  isDark?: boolean;
  title?: string;
}) {
  if (rank <= 3) {
    return <RankHexBadge rank={rank} isDark={isDark} title={title} size="sm" />;
  }
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center text-sm font-semibold tabular-nums",
        isDark ? "text-slate-400" : "text-slate-500",
      )}
    >
      {rank}
    </span>
  );
}

// Store for generated dummy data to avoid re-computation if count doesn't change
let generatedDummyDataCache: {
  entries: LeaderboardEntry[];
  myRank: number | null;
  count: number;
} | null = null;

const generateAllDummyLeaderboardData = (
  count: number,
): { entries: LeaderboardEntry[]; myRank: number | null } => {
  if (generatedDummyDataCache && generatedDummyDataCache.count === count) {
    return {
      entries: generatedDummyDataCache.entries,
      myRank: generatedDummyDataCache.myRank,
    };
  }

  const entries: LeaderboardEntry[] = [];
  const platforms = ["youtube", "instagram"];
  let tempMyRank: number | null = null;

  for (let i = 0; i < count; i++) {
    const isMyEntry = i === Math.floor(count / 4); // Place 'my' entry deterministically
    const creatorId = isMyEntry
      ? MY_DUMMY_SUBMISSION_USER_ID
      : `user_dummy_${i}`;
    const username = isMyEntry ? "MyAwesomeSelf" : `Creator${i}`;
    const views = Math.floor(Math.random() * 750000) + 500; // Random views, wider range

    entries.push({
      id: `submission_dummy_${i}_${Math.random().toString(36).substring(7)}`,
      creator_id: creatorId,
      video_title: `Epic Content Vol. ${i + 1} - ${username}`,
      video_thumbnail_url: `https://picsum.photos/seed/${username}${i}/200/120`,
      views: views,
      earnings: Math.random() > 0.65 ? Math.floor(Math.random() * 150) + 10 : 0,
      status: "approved",
      created_at: new Date(
        Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000,
      ).toISOString(), // random date in last 45 days
      content_link: "https://www.example.com/watch?v=dQw4w9WgXcQ", // A familiar link for all :)
      platform: platforms[i % platforms.length],
      user_platform_username: username,
      user_full_name: `${
        isMyEntry ? "The One And Only" : "Talented"
      } ${username.replace(/\d+/g, "")}`,
      creator_pfp_url: `https://i.pravatar.cc/150?u=${creatorId}`,
      user_platform_pfp_url: `https://i.pravatar.cc/150?u=${creatorId}_platform`,
    });
  }

  entries.sort((a, b) => {
    if (b.views !== a.views) return b.views - a.views;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const myEntryIndex = entries.findIndex(
    (e) => e.creator_id === MY_DUMMY_SUBMISSION_USER_ID,
  );
  if (myEntryIndex !== -1) {
    tempMyRank = myEntryIndex + 1;
  }

  generatedDummyDataCache = { entries, myRank: tempMyRank, count };
  return { entries, myRank: tempMyRank };
};

function EligibilityRequirementCard({
  icon: Icon,
  label,
  value,
  description,
  isDark,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  description: string;
  isDark: boolean;
}) {
  return (
    <div
      className={cn(
        "border-b py-3 first:pt-0 last:border-b-0 last:pb-0",
        isDark ? "border-white/10" : "border-[#e5e5e5]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            "flex items-center gap-2 text-[13px] font-medium",
            isDark ? "text-slate-400" : "text-[#737373]",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </p>
        <p
          className={cn(
            "text-[13px] font-semibold text-right",
            isDark ? "text-white" : "text-[#0a0a0a]",
          )}
        >
          {value}
        </p>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

// Client component that receives contestId as a prop
export function ContestClientPage({
  contestId,
  user,
}: {
  contestId: string;
  user: UserResponse["data"]["user"] | null;
}) {
  const [contest, setContest] = useState<any>(null);
  const showCreatorEligibilitySection = Boolean(
    contest &&
      isVideoContestFormat(contest.contest_format) &&
      hasAnyContestCreatorRequirement(contest),
  );

  const eligibilityDisplayItems = useMemo(() => {
    if (!contest) return [];
    const iconByKey: Record<
      string,
      React.ComponentType<{ className?: string }>
    > = {
      "trust-score": CheckCheck,
      "trust-number": CheckCheck,
      "best-quality": Star,
      "min-quality": Star,
      "avg-quality": Star,
      "platform-earnings": DollarSign,
      "platform-views": Eye,
    };

    return buildContestEligibilityDisplayItems(contest, "brand").map(
      (item) => ({
        ...item,
        icon: iconByKey[item.key] ?? CheckCheck,
      }),
    );
  }, [contest]);
  const {
    items: requirementItems,
    failingItems,
    isBlocked: isRequirementsGateBlocked,
    hasRequirements: hasCreatorRequirements,
    loading: requirementsLoading,
    fetchFailed: requirementsFetchFailed,
    refresh: refreshRequirements,
  } = useCreatorContestEligibility(contestId, contest);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Campaign hidden by access rules, unpublished, or deleted — an expected state, not a failure. */
  const [isUnavailable, setIsUnavailable] = useState(false);
  /** Set when the campaign is restricted and the creator isn't a member yet. */
  const [restrictedPreview, setRestrictedPreview] =
    useState<ContestPreview | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [maxSubmissions, setMaxSubmissions] = useState(1);
  const [joinCampaignLoading, setJoinCampaignLoading] = useState(false);
  const isMountedRef = useRef(true);
  const [hasJoinedTwitterCampaign, setHasJoinedTwitterCampaign] =
    useState(false);
  const [twitterConnectStatus, setTwitterConnectStatus] = useState<
    "loading" | "connected" | "disconnected"
  >("loading");
  const [twitterJoinError, setTwitterJoinError] = useState<{
    kind: "not_connected" | "bio" | "generic";
    message: string;
  } | null>(null);
  const [showAllSubmissionsModal, setShowAllSubmissionsModal] = useState(false);
  const [modalViewMode, setModalViewMode] = useState<"simple" | "detailed">(
    "simple",
  );
  const [rejectionReasonModalOpen, setRejectionReasonModalOpen] =
    useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState<string>("");
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const [modalItemsPerPage] = useState(10); // Show 10 submissions per page
  const [showCreatorVideosModal, setShowCreatorVideosModal] = useState(false);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(
    null,
  );
  /** Lazy-loaded submissions for selected creator in creator-wise view (from API) */
  const [selectedCreatorSubmissions, setSelectedCreatorSubmissions] = useState<
    LeaderboardEntry[]
  >([]);
  const [creatorVideosCurrentPage, setCreatorVideosCurrentPage] = useState(1);
  const [creatorVideosItemsPerPage] = useState(10);
  /** Loading state for All Videos modal when fetching creator submissions */
  const [loadingCreatorVideosModal, setLoadingCreatorVideosModal] =
    useState(false);
  /** Server-side creator-wise leaderboard (combined views across all submissions per creator); used when groupBy=creator */
  const [creatorWiseLeaderboard, setCreatorWiseLeaderboard] = useState<
    Array<{
      creator_id: string;
      creator_username: string;
      creator_full_name: string;
      creator_pfp_url: string | null;
      user_platform_pfp_url: string | null;
      user_platform_username?: string;
      user_full_name?: string;
      submissions: LeaderboardEntry[];
      submission_ranks?: number[];
      total_views: number;
      total_earnings: number;
      best_submission?: LeaderboardEntry | null;
      best_rank: number;
      submission_count: number;
      has_paid_submission?: boolean;
      creator_bonus_paid_total?: number;
      /** Paid cents for milestone "most verified views" bonus (from milestone_bonus_paid.views) */
      most_verified_bonus_paid_views_cents?: number;
      /** Paid cents for milestone "most verified reels" bonus (from milestone_bonus_paid.reels) */
      most_verified_bonus_paid_reels_cents?: number;
    }>
  >([]);
  const tabs = useMemo(() => getTabs(contest?.platform), [contest?.platform]);
  const tabFromUrl = searchParams.get("tab");
  const initialTab = tabFromUrl === "leaderboard" ? "leaderboard" : "details";
  const { activeTab, setActiveTab } = useTabState(tabs, {
    defaultTab: initialTab,
  });

  // Analytics tab filter state
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<
    | "all"
    | "verified"
    | "paid"
    | "pending"
    | "rejected"
    | "verified_or_paid"
    | "not_rejected"
  >("all");

  // Pagination state for leaderboard
  const [leaderboardCurrentPage, setLeaderboardCurrentPage] = useState(1);
  const [leaderboardItemsPerPage, setLeaderboardItemsPerPage] = useState(25); // Or your preferred default
  const [totalLeaderboardEntries, setTotalLeaderboardEntries] = useState(0);
  const [totalLeaderboardPages, setTotalLeaderboardPages] = useState(0);
  const [leaderboardBannerByTab, setLeaderboardBannerByTab] = useState<
    Partial<Record<PlatformTabValue, LeaderboardSubmissionBannerCounts>>
  >({});
  const [creatorTotalEntries, setCreatorTotalEntries] = useState(0);
  const [creatorTotalPages, setCreatorTotalPages] = useState(0);
  const [allMilestoneBonusSubmissions, setAllMilestoneBonusSubmissions] =
    useState<any[]>([]);

  // State for logged-in user's submission and rank
  const [myLeaderboardEntry, setMyLeaderboardEntry] = useState<
    (LeaderboardEntry & { rank?: number }) | null
  >(null);
  /** All of the current user's submissions for this contest from /my-submission (not paginated like `leaderboard`) */
  const [mySubmissionsListFromApi, setMySubmissionsListFromApi] = useState<
    LeaderboardEntry[]
  >([]);
  /** Matches GET /leaderboard?groupBy=creator (non-rejected totals + creator rank) */
  const [myCreatorWiseStats, setMyCreatorWiseStats] = useState<{
    total_views: number;
    total_earnings: number;
    rank: number | null;
  } | null>(null);
  const [loadingMySubmission, setLoadingMySubmission] = useState(false);
  const [contestType, setContestType] = useState<string | null>(null); // Track contest type for verification badges

  // Leaderboard view mode state
  const [leaderboardViewMode, setLeaderboardViewMode] = useState<
    "simple" | "detailed"
  >("simple");

  // Leaderboard display mode state (creator-wise or submission-wise)
  // For Twitter contests, always use creator-wise mode
  const [leaderboardDisplayMode, setLeaderboardDisplayMode] = useState<
    "creator" | "submission"
  >("submission");

  // Force creator-wise mode for Twitter contests
  useEffect(() => {
    if (contest?.platform?.toLowerCase() === "twitter") {
      setLeaderboardDisplayMode("creator");
    }
  }, [contest?.platform]);

  useEffect(() => {
    setMySubmissionsListFromApi([]);
    setMyCreatorWiseStats(null);
  }, [contestId]);

  // Refresh metrics state for opportunities
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

  const { toast } = useToast();

  const [twitterMetricsRun, setTwitterMetricsRun] =
    useState<TwitterMetricsRefreshRunSummary | null>(null);
  const [twitterMetricsRunProgress, setTwitterMetricsRunProgress] =
    useState<number>(0);
  const [twitterMetricsRunElapsedSeconds, setTwitterMetricsRunElapsedSeconds] =
    useState<number | null>(null);
  const RUN_DISABLE_WINDOW_MS = 5 * 60 * 1000;

  const isRunWithinDisableWindow = (
    run: TwitterMetricsRefreshRunSummary | null | undefined,
  ) => {
    if (!run || run.status !== "running" || !run.started_at) return false;
    const startedAtMs = new Date(run.started_at).getTime();
    if (!Number.isFinite(startedAtMs)) return false;
    return Date.now() - startedAtMs < RUN_DISABLE_WINDOW_MS;
  };

  const twitterMetricsRunActiveWithinWindow =
    twitterMetricsRun?.status === "pending" ||
    isRunWithinDisableWindow(twitterMetricsRun);

  const twitterMetricsTargetProgressRef = useRef<number | null>(null);
  const twitterMetricsStartedAtMsRef = useRef<number | null>(null);
  const twitterMetricsProgressTickIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const twitterMetricsStatusPollIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const twitterMetricsTrackedRunIdRef = useRef<string | null>(null);

  const twitterMetricsRunStorageKey = useCallback(() => {
    return `twitter-metrics-run:opportunities:${contestId}`;
  }, [contestId]);

  const clearTwitterMetricsRunIntervals = useCallback(() => {
    if (twitterMetricsProgressTickIntervalRef.current) {
      clearInterval(twitterMetricsProgressTickIntervalRef.current);
      twitterMetricsProgressTickIntervalRef.current = null;
    }
    if (twitterMetricsStatusPollIntervalRef.current) {
      clearInterval(twitterMetricsStatusPollIntervalRef.current);
      twitterMetricsStatusPollIntervalRef.current = null;
    }
  }, []);

  const formatMmSs = useCallback((seconds: number) => {
    const s = Math.max(0, seconds);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, []);

  const startTrackingTwitterMetricsRun = useCallback(
    (run: TwitterMetricsRefreshRunSummary) => {
      if (!contestId) return;
      const runId = run.id;

      // Avoid restarting if we're already tracking this run.
      if (
        twitterMetricsTrackedRunIdRef.current === runId &&
        twitterMetricsProgressTickIntervalRef.current &&
        twitterMetricsStatusPollIntervalRef.current
      ) {
        return;
      }

      twitterMetricsTrackedRunIdRef.current = runId;
      twitterMetricsTargetProgressRef.current = Math.floor(
        90 + Math.random() * 10,
      );
      twitterMetricsStartedAtMsRef.current = run.started_at
        ? new Date(run.started_at).getTime()
        : Date.now();

      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            twitterMetricsRunStorageKey(),
            JSON.stringify({
              runId,
              startedAt: run.started_at ?? new Date().toISOString(),
            }),
          );
        }
      } catch {
        // ignore
      }

      setTwitterMetricsRun(run);
      setTwitterMetricsRunProgress(1);
      setTwitterMetricsRunElapsedSeconds(0);
      setIsRefreshingMetrics(true);

      clearTwitterMetricsRunIntervals();

      const avgMs = 120_000; // 2 minute average for leaderboard/metrics refresh
      twitterMetricsProgressTickIntervalRef.current = setInterval(() => {
        const startedMs = twitterMetricsStartedAtMsRef.current;
        if (!startedMs) return;

        const elapsedMs = Date.now() - startedMs;
        const cap = twitterMetricsTargetProgressRef.current ?? 95;
        const computed = 1 + (elapsedMs / avgMs) * (cap - 1);
        const nextProgress = Math.max(1, Math.min(cap, computed));

        setTwitterMetricsRunProgress(nextProgress);
        setTwitterMetricsRunElapsedSeconds(
          Math.max(0, Math.floor(elapsedMs / 1000)),
        );
      }, 250);

      twitterMetricsStatusPollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/contests/${contestId}/twitter-metrics-refresh/status`,
          );
          if (!res.ok) return;
          const data = await res.json();
          const latestRun = data?.run as TwitterMetricsRefreshRunSummary | null;
          if (!latestRun) return;
          if (latestRun.id !== runId) return;

          setTwitterMetricsRun(latestRun);
          const status = latestRun.status;
          const isTerminal =
            status === "completed" ||
            status === "failed" ||
            status === "cancelled";
          if (!isTerminal) return;

          clearTwitterMetricsRunIntervals();
          setTwitterMetricsRunProgress(100);
          setIsRefreshingMetrics(false);

          try {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(twitterMetricsRunStorageKey());
            }
          } catch {
            // ignore
          }

          if (status === "completed") {
            setTimeout(() => window.location.reload(), 800);
          } else {
            toast({
              title: "Refresh failed",
              description:
                latestRun.error_message?.slice(0, 500) ??
                "The refresh run ended with an error.",
              variant: "destructive",
            });
          }
        } catch {
          // ignore
        }
      }, 3000);
    },
    [
      clearTwitterMetricsRunIntervals,
      contestId,
      toast,
      twitterMetricsRunStorageKey,
    ],
  );

  // Rehydrate loader/progress if a run is already active (e.g. tab switch).
  useEffect(() => {
    if (!contest?.id) return;
    const platformLower = contest.platform?.toLowerCase() ?? "";
    const isTwitterContest =
      platformLower === "twitter" || platformLower === "x";
    if (!isTwitterContest) return;

    let cancelled = false;

    (async () => {
      try {
        try {
          const raw =
            typeof window !== "undefined"
              ? sessionStorage.getItem(twitterMetricsRunStorageKey())
              : null;
          if (raw) {
            const parsed = JSON.parse(raw) as
              | { runId?: string; startedAt?: string }
              | undefined;
            if (parsed?.runId) {
              startTrackingTwitterMetricsRun({
                id: parsed.runId,
                status: "running",
                started_at: parsed.startedAt ?? new Date().toISOString(),
                finished_at: null,
              });
            }
          }
        } catch {
          // ignore
        }

        const res = await fetch(
          `/api/contests/${contest.id}/twitter-metrics-refresh/status`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const run = data?.run as TwitterMetricsRefreshRunSummary | null;
        if (cancelled) return;
        if (!run) {
          try {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(twitterMetricsRunStorageKey());
            }
          } catch {
            // ignore
          }
          return;
        }

        if (run.status === "pending" || run.status === "running") {
          startTrackingTwitterMetricsRun(run);
        } else {
          clearTwitterMetricsRunIntervals();
          setTwitterMetricsRun(null);
          setTwitterMetricsRunProgress(0);
          setTwitterMetricsRunElapsedSeconds(null);
          setIsRefreshingMetrics(false);
          try {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(twitterMetricsRunStorageKey());
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // best-effort only
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    contest?.id,
    contest?.platform,
    clearTwitterMetricsRunIntervals,
    startTrackingTwitterMetricsRun,
    twitterMetricsRunStorageKey,
  ]);

  useEffect(() => {
    return () => {
      clearTwitterMetricsRunIntervals();
    };
  }, [clearTwitterMetricsRunIntervals]);

  // Twitter campaign metrics state
  const [twitterMetrics, setTwitterMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Analytics: State for fetching actual tweet data for metrics calculation
  const [analyticsTweets, setAnalyticsTweets] = useState<any[]>([]);
  const [loadingAnalyticsTweets, setLoadingAnalyticsTweets] = useState(false);

  // Post-contest status state for creator transparency
  const [postContestStatus, setPostContestStatus] = useState<string | null>(
    null,
  );

  // User profile data for link processing
  const [userProfile, setUserProfile] = useState<{
    full_name: string;
    username: string;
  } | null>(null);

  // Creator profile data for filtering categories, subcategories, and interests
  const [creatorCategories, setCreatorCategories] = useState<string[]>([]);
  const [creatorSubcategories, setCreatorSubcategories] = useState<
    Record<string, string[]>
  >({});
  const [creatorInterests, setCreatorInterests] = useState<string[]>([]);

  // Scroll spy state and functionality
  const [activeSection, setActiveSection] = useState("earning-opportunities");
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const briefCopyRef = useRef<HTMLDivElement | null>(null);
  const rulesCopyRef = useRef<HTMLDivElement | null>(null);
  const termsCopyRef = useRef<HTMLDivElement | null>(null);

  // Multi-platform Contest Details scoping (mirrors advertiser contest details)
  const detailVideoPlatforms = useMemo(
    () => parseVideoContestPlatforms(contest?.platform),
    [contest?.platform],
  );
  const [detailPlatformTab, setDetailPlatformTab] =
    useState<PlatformTabValue>(ALL_PLATFORM_TAB);
  const [leaderboardPlatformTab, setLeaderboardPlatformTab] =
    useState<PlatformTabValue>(ALL_PLATFORM_TAB);
  const leaderboardPlatformTabRef = useRef(leaderboardPlatformTab);
  leaderboardPlatformTabRef.current = leaderboardPlatformTab;
  const leaderboardBannerByTabRef = useRef(leaderboardBannerByTab);
  leaderboardBannerByTabRef.current = leaderboardBannerByTab;
  useEffect(() => {
    setLeaderboardBannerByTab({});
  }, [contestId]);
  const showLeaderboardPlatformIcons = detailVideoPlatforms.length >= 2;
  useEffect(() => {
    if (
      detailPlatformTab !== ALL_PLATFORM_TAB &&
      !detailVideoPlatforms.includes(detailPlatformTab)
    ) {
      setDetailPlatformTab(ALL_PLATFORM_TAB);
    }
    if (
      leaderboardPlatformTab !== ALL_PLATFORM_TAB &&
      !detailVideoPlatforms.includes(leaderboardPlatformTab)
    ) {
      setLeaderboardPlatformTab(ALL_PLATFORM_TAB);
    }
  }, [detailVideoPlatforms, detailPlatformTab, leaderboardPlatformTab]);
  const detailScopedPlatform: VideoContestPlatform | null =
    detailPlatformTab !== ALL_PLATFORM_TAB &&
    isVideoContestPlatform(detailPlatformTab)
      ? detailPlatformTab
      : null;
  const detailPersistedCampaigns = useMemo(
    () =>
      readPersistedPlatformCampaigns(
        (contest?.contest_based_details as Record<string, unknown>) || null,
      ),
    [contest?.contest_based_details],
  );
  const buildDetailPayoutContest = useCallback(
    (platform: VideoContestPlatform) => {
      if (!contest) return contest;
      const raw =
        (contest.contest_based_details as Record<string, unknown>) || {};
      const campaign = detailPersistedCampaigns[platform];
      return {
        ...contest,
        platform,
        contest_type:
          contestTypeForPlatform(raw, platform, contest.contest_type) ??
          campaign?.contest_type ??
          contest.contest_type,
        content_type: campaign?.content_type ?? contest.content_type,
        brief_html: briefHtmlForPlatform(contest, platform),
        rules_html: rulesHtmlForPlatform(contest, platform),
        resources: resourcesForPlatform(contest.resources, platform),
        inspiration_links: inspirationLinksForPlatform(
          contest.inspiration_links,
          platform,
        ),
        contest_based_details: withProjectedTopLevelPayout(
          raw,
          contest.platform,
          platform,
        ),
      };
    },
    [contest, detailPersistedCampaigns],
  );
  const detailContest = useMemo(() => {
    if (!contest) return contest;
    if (!detailScopedPlatform || detailVideoPlatforms.length < 2) {
      return contest;
    }
    return buildDetailPayoutContest(detailScopedPlatform);
  }, [
    contest,
    detailScopedPlatform,
    detailVideoPlatforms.length,
    buildDetailPayoutContest,
  ]);
  const detailBriefsDiffer = useMemo(
    () => briefsDifferAcrossPlatforms(contest, detailVideoPlatforms),
    [contest, detailVideoPlatforms],
  );
  const detailRulesDiffer = useMemo(
    () => rulesDifferAcrossPlatforms(contest, detailVideoPlatforms),
    [contest, detailVideoPlatforms],
  );
  const detailBonusDetailsDiffer = useMemo(
    () =>
      bonusDetailsDifferAcrossPlatforms(
        (contest as { bonus_details?: unknown } | null)?.bonus_details,
        detailVideoPlatforms,
      ),
    [contest, detailVideoPlatforms],
  );
  const detailMaxEarningsDiffer = useMemo(
    () =>
      maxEarningsDifferAcrossPlatforms(
        (contest as { max_earnings_per_creator?: unknown } | null)
          ?.max_earnings_per_creator,
        (contest as { bonus_details?: unknown } | null)?.bonus_details,
        detailVideoPlatforms,
      ),
    [contest, detailVideoPlatforms],
  );
  const detailPayoutGroups = useMemo(() => {
    if (detailVideoPlatforms.length < 2) {
      return [
        {
          platforms: [] as VideoContestPlatform[],
          contestPlatform: null as VideoContestPlatform | null,
          showLabels: false,
        },
      ];
    }
    if (detailPlatformTab !== ALL_PLATFORM_TAB) {
      const scoped = detailScopedPlatform
        ? [detailScopedPlatform]
        : detailVideoPlatforms.slice(0, 1);
      return [
        {
          platforms: scoped,
          contestPlatform: scoped[0] ?? null,
          showLabels: false,
        },
      ];
    }
    const groups = groupVideoPayoutPlatformsByConfig(
      contest?.contest_based_details as
        | Record<string, unknown>
        | null
        | undefined,
      detailVideoPlatforms,
    );
    if (groups.length <= 1) {
      return [
        {
          platforms: detailVideoPlatforms,
          contestPlatform: null,
          showLabels: false,
        },
      ];
    }
    return groups.map((platforms) => ({
      platforms,
      contestPlatform: platforms[0] ?? null,
      showLabels: true,
    }));
  }, [
    contest?.contest_based_details,
    detailPlatformTab,
    detailScopedPlatform,
    detailVideoPlatforms,
  ]);
  const showDetailBriefByPlatform =
    detailVideoPlatforms.length >= 2 &&
    detailPlatformTab === ALL_PLATFORM_TAB &&
    detailBriefsDiffer;
  const showDetailRulesByPlatform =
    detailVideoPlatforms.length >= 2 &&
    detailPlatformTab === ALL_PLATFORM_TAB &&
    detailRulesDiffer;
  const showDetailBonusDetailsByPlatform =
    detailVideoPlatforms.length >= 2 &&
    detailPlatformTab === ALL_PLATFORM_TAB &&
    detailBonusDetailsDiffer;
  const showDetailMaxEarningsByPlatform =
    detailVideoPlatforms.length >= 2 &&
    detailPlatformTab === ALL_PLATFORM_TAB &&
    detailMaxEarningsDiffer;
  const detailLeaderboardPrizesDiffer = useMemo(
    () =>
      leaderboardPrizeStructuresDifferAcrossPlatforms(
        detailPersistedCampaigns,
        detailVideoPlatforms,
      ),
    [detailPersistedCampaigns, detailVideoPlatforms],
  );
  const leaderboardPrizeRankingPlan = useMemo(
    () =>
      resolveLeaderboardPrizeRankingPlan(
        (contest?.contest_based_details as Record<string, unknown>) || null,
        contest?.platform,
      ),
    [contest?.contest_based_details, contest?.platform],
  );
  const activeLeaderboardPrizes = useMemo((): PrizeInfo[] => {
    const root = (contest?.contest_based_details?.leaderboard_contest?.prizes ||
      []) as PrizeInfo[];
    if (
      leaderboardPlatformTab !== ALL_PLATFORM_TAB &&
      isVideoContestPlatform(leaderboardPlatformTab)
    ) {
      const scoped =
        leaderboardPrizeRankingPlan.prizesByPlatform[leaderboardPlatformTab];
      if (Array.isArray(scoped) && scoped.length > 0) {
        return scoped as PrizeInfo[];
      }
    }
    if (leaderboardPrizeRankingPlan.sharedPrizes.length > 0) {
      return leaderboardPrizeRankingPlan.sharedPrizes as PrizeInfo[];
    }
    return root;
  }, [
    contest?.contest_based_details,
    leaderboardPlatformTab,
    leaderboardPrizeRankingPlan,
  ]);
  const detailFlatFeeBonusesDiffer = useMemo(
    () =>
      flatFeeBonusesDifferAcrossPlatforms(
        detailPersistedCampaigns,
        detailVideoPlatforms,
      ),
    [detailPersistedCampaigns, detailVideoPlatforms],
  );
  const detailBonusBudgetsDiffer = useMemo(
    () =>
      leaderboardBonusBudgetsDifferAcrossPlatforms(
        detailPersistedCampaigns,
        detailVideoPlatforms,
      ),
    [detailPersistedCampaigns, detailVideoPlatforms],
  );
  const detailUniformPayoutContest = useMemo(() => {
    if (!contest) return contest;
    if (detailScopedPlatform) return detailContest;
    if (
      detailVideoPlatforms.length >= 2 &&
      detailPersistedCampaigns[detailVideoPlatforms[0]]
    ) {
      return buildDetailPayoutContest(detailVideoPlatforms[0]);
    }
    return detailContest;
  }, [
    contest,
    detailScopedPlatform,
    detailContest,
    detailVideoPlatforms,
    detailPersistedCampaigns,
    buildDetailPayoutContest,
  ]);
  const showDetailPrizeByPlatform =
    detailVideoPlatforms.length >= 2 &&
    detailPlatformTab === ALL_PLATFORM_TAB &&
    detailLeaderboardPrizesDiffer;
  const showDetailFlatFeeByPlatform =
    detailVideoPlatforms.length >= 2 &&
    detailPlatformTab === ALL_PLATFORM_TAB &&
    (detailFlatFeeBonusesDiffer || detailBonusBudgetsDiffer);
  const detailPrizeContestList = showDetailPrizeByPlatform
    ? detailVideoPlatforms.map((platform) => ({
        platform,
        contest: buildDetailPayoutContest(platform),
        showLabel: true,
      }))
    : [
        {
          platform: detailScopedPlatform,
          contest: detailUniformPayoutContest,
          showLabel: false,
        },
      ];
  const detailFlatFeeContestList = showDetailFlatFeeByPlatform
    ? detailVideoPlatforms.map((platform) => ({
        platform,
        contest: buildDetailPayoutContest(platform),
        showLabel: true,
      }))
    : [
        {
          platform: detailScopedPlatform,
          contest: detailUniformPayoutContest,
          showLabel: false,
        },
      ];
  const detailPlatformLabel =
    detailScopedPlatform != null
      ? VIDEO_PLATFORM_LABELS[detailScopedPlatform]
      : detailVideoPlatforms.length > 0
        ? detailVideoPlatforms.map((p) => VIDEO_PLATFORM_LABELS[p]).join(", ")
        : contest?.platform || "Not specified";

  const contestPoolBudgetCents = useMemo(() => {
    if (!contest) return 0;
    return resolveContestPoolBudgetCents(
      contest.contest_type,
      (contest.contest_based_details as Record<string, unknown>) || null,
      contest.platform,
    );
  }, [contest]);

  const leaderboardPrizePoolCents = useMemo(() => {
    if (!contest || contest.contest_type !== "leaderboard") return 0;
    const resolved = resolveLeaderboardPrizePoolCents(
      (contest.contest_based_details as Record<string, unknown>) || null,
      contest.platform,
      detailScopedPlatform,
    );
    if (resolved > 0) return resolved;
    return Number(contest.total_prize) || 0;
  }, [contest, detailScopedPlatform]);

  const leaderboardWinnerCountDisplay = useMemo(() => {
    if (!contest || contest.contest_type !== "leaderboard") return 0;
    return resolveLeaderboardWinnerCount(
      (contest.contest_based_details as Record<string, unknown>) || null,
      contest.platform,
      detailScopedPlatform,
    );
  }, [contest, detailScopedPlatform]);

  const hasInspirationLinks = useMemo(() => {
    if (detailVideoPlatforms.length >= 2) {
      return detailVideoPlatforms.some((platform) =>
        inspirationLinksForPlatform(contest?.inspiration_links, platform).some(
          (link) => typeof link?.url === "string" && link.url.trim() !== "",
        ),
      );
    }
    return flattenContestInspirationLinks(contest?.inspiration_links).some(
      (link) => typeof link?.url === "string" && link.url.trim() !== "",
    );
  }, [contest?.inspiration_links, detailVideoPlatforms]);

  const hasTrackingLinks = useMemo(() => {
    const links = Array.isArray(contest?.tracking_links)
      ? contest.tracking_links
      : [];
    return links.some(
      (link: { url?: string }) =>
        typeof link?.url === "string" && link.url.trim() !== "",
    );
  }, [contest?.tracking_links]);

  const visibleSections = useMemo(() => {
    return BASE_SECTIONS.filter((section) => {
      if (!section.conditional) return true;
      if (section.conditional === "leaderboard") {
        return contest?.contest_type === "leaderboard";
      }
      if (section.conditional === "inspiration-links") {
        return hasInspirationLinks;
      }
      if (section.conditional === "tracking-links") {
        return hasTrackingLinks;
      }
      if (section.conditional === "creator-eligibility") {
        return hasCreatorRequirements;
      }
      return true;
    });
  }, [
    contest?.contest_type,
    hasInspirationLinks,
    hasTrackingLinks,
    hasCreatorRequirements,
  ]);

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

  const isDark = mode === "dark";
  // Smooth scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      // Get the sticky navigation height + page header to calculate proper offset
      const navHeight = 180; // Page header (64px) + sticky nav (~60px) + padding
      const elementPosition =
        element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - navHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      // Immediately set the active section when clicking
      setActiveSection(sectionId);
    }
  }, []);

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

  // Memoized user submissions for performance with large datasets.
  // Prefer the full list from /my-submission — `leaderboard` is paginated and excludes rejected rows,
  // so filtering it alone misses submissions on other pages or not shown on the public leaderboard.
  const userSubmissions = useMemo(() => {
    if (!user?.id) return [];

    if (mySubmissionsListFromApi.length > 0) {
      return [...mySubmissionsListFromApi].sort((a, b) => b.views - a.views);
    }

    if (!leaderboard.length) return [];

    return leaderboard
      .filter((entry) => entry.creator_id === user.id)
      .sort((a, b) => b.views - a.views);
  }, [user?.id, leaderboard, mySubmissionsListFromApi]);

  // Memoized best submission (highest views)
  const bestSubmission = useMemo(() => {
    return userSubmissions.length > 0 ? userSubmissions[0] : null;
  }, [userSubmissions]);

  const rankLookupMap = useMemo(() => {
    const map = new Map<string, number>();
    leaderboard.forEach((entry, index) => {
      const rank =
        entry.rank ??
        (leaderboardCurrentPage - 1) * leaderboardItemsPerPage + (index + 1);
      map.set(entry.id, rank);
    });
    return map;
  }, [leaderboard, leaderboardCurrentPage, leaderboardItemsPerPage]);

  // Memoized grouped leaderboard by creator (for creator-wise display)
  // Prefer server-side creatorWiseLeaderboard when in creator mode (non-Twitter) for combined views across ALL submissions
  const groupedLeaderboardByCreator = useMemo(() => {
    if (leaderboardDisplayMode !== "creator") return null;

    // For Twitter contests, leaderboard is already aggregated by creator
    if (contest?.platform === "twitter" || contest?.platform === "x") {
      return leaderboard.map((entry: any, index: number) => {
        const currentRank = entry.current_rank || index + 1;
        return {
          creator_id: entry.creator_id,
          creator_username: entry.app_username || entry.creator_id,
          creator_full_name: entry.app_full_name || null,
          creator_pfp_url: entry.creator_pfp_url ?? null,
          user_platform_pfp_url: entry.user_platform_pfp_url ?? null,
          submissions: [entry],
          total_views: 0,
          // Twitter/X "creator-wise" leaderboard is already aggregated by creator,
          // and the API returns `total_earnings` (not `earnings`).
          total_earnings: entry.total_earnings ?? entry.earnings ?? 0,
          best_submission: entry,
          best_rank: currentRank,
          submission_count: entry.total_eligible_tweets || 0,
          total_points: entry.total_points || 0,
          total_eligible_tweets: entry.total_eligible_tweets || 0,
          total_likes: entry.total_likes || 0,
          total_replies: entry.total_replies || 0,
          total_retweets: entry.total_retweets || 0,
          total_quote_reposts: entry.total_quote_reposts || 0,
          total_impressions: entry.total_impressions || 0,
          paid: entry.moderation_status === "paid",
          paid_at: entry.paid_at,
          moderation_status: entry.moderation_status ?? null,
          status: entry.status ?? null,
          pending_submission_count:
            String(entry.moderation_status || "").toLowerCase() === "pending"
              ? 1
              : 0,
          display_status:
            String(entry.moderation_status || "").toLowerCase() === "pending"
              ? "pending"
              : null,
        };
      });
    }

    // Non-Twitter creator-wise: use server-side aggregated data (combined all views per creator)
    if (creatorWiseLeaderboard.length > 0) {
      return creatorWiseLeaderboard;
    }

    // Fallback: client-side grouping from current page only (legacy)
    const grouped = new Map<
      string,
      {
        creator_id: string;
        creator_username: string;
        creator_full_name: string;
        creator_pfp_url: string | null;
        user_platform_pfp_url: string | null;
        submissions: LeaderboardEntry[];
        submission_ranks: number[];
        total_views: number;
        total_earnings: number;
        best_submission: LeaderboardEntry | null;
        best_rank: number;
        submission_count: number;
      }
    >();

    leaderboard.forEach((entry, index) => {
      const existing = grouped.get(entry.creator_id);
      const currentRank =
        entry.rank ??
        (leaderboardCurrentPage - 1) * leaderboardItemsPerPage + (index + 1);

      if (existing) {
        existing.submissions.push(entry);
        existing.submission_ranks.push(currentRank);
        existing.total_views += entry.views || 0;
        existing.total_earnings += entry.earnings || 0;
        existing.best_rank = Math.min(existing.best_rank, currentRank);
        if (
          !existing.best_submission ||
          entry.views > existing.best_submission.views
        ) {
          existing.best_submission = entry;
        }
        existing.submission_count = existing.submissions.length;
      } else {
        grouped.set(entry.creator_id, {
          creator_id: entry.creator_id,
          creator_username: entry.user_platform_username,
          creator_full_name: entry.user_full_name,
          creator_pfp_url: entry.creator_pfp_url,
          user_platform_pfp_url: entry.user_platform_pfp_url,
          submissions: [entry],
          submission_ranks: [currentRank],
          total_views: entry.views || 0,
          total_earnings: entry.earnings || 0,
          best_submission: entry,
          best_rank: currentRank,
          submission_count: 1,
        });
      }
    });

    // Rank by highest total_views first (then best_rank as tiebreak) to match opportunities creator-wise view
    return Array.from(grouped.values())
      .sort((a, b) => {
        if (b.total_views !== a.total_views)
          return b.total_views - a.total_views;
        return a.best_rank - b.best_rank;
      })
      .map((group) => {
        const pendingCount = countPendingLeaderboardSubmissions(
          group.submissions,
        );
        return {
          ...group,
          pending_submission_count: pendingCount,
          display_status: pendingCount > 0 ? "pending" : null,
        };
      });
  }, [
    leaderboard,
    leaderboardDisplayMode,
    contest?.platform,
    leaderboardCurrentPage,
    leaderboardItemsPerPage,
    creatorWiseLeaderboard,
  ]);

  const opportunityMilestoneBonusConfigs = useMemo(
    () =>
      collectMilestoneBonusConfigs(
        (contest?.contest_based_details as Record<string, unknown>) || null,
        contest?.platform,
      ),
    [contest?.contest_based_details, contest?.platform],
  );
  const opportunityMostVerifiedViewsBonus =
    opportunityMilestoneBonusConfigs.find(
      (bonus) => bonus.most_verified_views,
    )?.most_verified_views;
  const opportunityMostVerifiedReelsBonus =
    opportunityMilestoneBonusConfigs.find(
      (bonus) => bonus.most_verified_reels,
    )?.most_verified_reels;

  const shouldLoadMilestoneBonusSubmissions = Boolean(
    contestId &&
    isMilestoneContestType(contest?.contest_type) &&
    opportunityMilestoneBonusConfigs.length > 0,
  );

  useEffect(() => {
    let cancelled = false;

    const loadAllMilestoneBonusSubmissions = async () => {
      if (!shouldLoadMilestoneBonusSubmissions || !contestId) {
        setAllMilestoneBonusSubmissions([]);
        return;
      }

      try {
        const pageLimit = 1000;
        let page = 1;
        let totalPages = 1;
        const allRows: any[] = [];

        while (page <= totalPages) {
          const response = await fetch(
            `/api/leaderboard/${contestId}?page=${page}&limit=${pageLimit}&fresh=1`,
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data?.error || "Failed to load milestone bonus submissions",
            );
          }

          const pageRows = Array.isArray(data?.leaderboard)
            ? data.leaderboard
            : [];
          allRows.push(...pageRows);

          const resolvedTotalPages = Number(data?.totalPages || 1);
          totalPages = Number.isFinite(resolvedTotalPages)
            ? Math.max(0, resolvedTotalPages)
            : 1;
          if (totalPages === 0) break;
          page += 1;
        }

        if (cancelled) return;

        const seen = new Set<string>();
        const deduped = allRows.filter((row: any) => {
          const id = String(row?.id || "");
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setAllMilestoneBonusSubmissions(deduped);
      } catch (error) {
        console.error(
          "Error loading full milestone bonus submissions for leaderboard:",
          error,
        );
        if (!cancelled) setAllMilestoneBonusSubmissions([]);
      }
    };

    loadAllMilestoneBonusSubmissions();

    return () => {
      cancelled = true;
    };
  }, [contestId, shouldLoadMilestoneBonusSubmissions]);

  const milestoneDerivedData = useMemo<{
    submissionExpectedRewardMap: Map<string, number>;
    creatorMostVerifiedViewsBonusMap: Map<string, number>;
    creatorMostVerifiedReelsBonusMap: Map<string, number>;
    creatorExpectedRewardMap: Map<string, number>;
    winnerCountsByKey: Map<string, number>;
    winnerCountsByMilestone: Map<number, number>;
  }>(() => {
    const empty = {
      submissionExpectedRewardMap: new Map<string, number>(),
      creatorMostVerifiedViewsBonusMap: new Map<string, number>(),
      creatorMostVerifiedReelsBonusMap: new Map<string, number>(),
      creatorExpectedRewardMap: new Map<string, number>(),
      winnerCountsByKey: new Map<string, number>(),
      winnerCountsByMilestone: new Map<number, number>(),
    };

    if (!isMilestoneContestType(contest?.contest_type)) return empty;

    const allSubmissionCandidates: any[] = [
      ...(Array.isArray(allMilestoneBonusSubmissions)
        ? allMilestoneBonusSubmissions
        : []),
      ...(Array.isArray(leaderboard) ? leaderboard : []),
      ...((groupedLeaderboardByCreator || []).flatMap((g: any) =>
        Array.isArray(g?.submissions) ? g.submissions : [],
      ) as any[]),
      ...(Array.isArray(mySubmissionsListFromApi)
        ? mySubmissionsListFromApi
        : []),
    ];

    const seenSubmissionIds = new Set<string>();
    const uniqueSubmissions = allSubmissionCandidates.filter((s: any) => {
      const id = String(s?.id || "");
      if (!id || seenSubmissionIds.has(id)) return false;
      seenSubmissionIds.add(id);
      return true;
    });

    const normalizeMilestoneStatus = (rawStatus: any) => {
      const st = String(rawStatus || "").toLowerCase();
      if (st === "approved") return "verified";
      return st;
    };

    const assignmentRows = uniqueSubmissions.map((sub: any) => ({
      id: String(sub?.id || ""),
      creator_id: String(sub?.creator_id || ""),
      created_at: String(sub?.created_at || ""),
      status: normalizeMilestoneStatus(sub?.status),
      deleted_at: sub?.deleted_at ?? null,
      views: sub?.views != null ? Number(sub.views) : null,
      platform: sub?.platform ?? null,
      other_stats: sub?.other_stats ?? null,
      bonus_paid: Boolean(sub?.bonus_paid),
      bonus_amount:
        sub?.bonus_amount != null ? Number(sub?.bonus_amount || 0) : null,
      milestone_bonus_paid:
        sub?.milestone_bonus_paid ?? sub?.metadata?.milestone_bonus_paid,
      metadata: sub?.metadata ?? null,
    }));

    const assignments = buildMilestoneSubmissionPayoutAssignmentsFromDetails(
      assignmentRows,
      (contest?.contest_based_details as Record<string, unknown>) || null,
      contest?.platform,
    );

    const submissionExpectedRewardMap = new Map(assignments.payoutMap);
    const keyedMax = isKeyedMaxEarningsMap(
      (contest as any)?.max_earnings_per_creator,
    );
    const contestWideMax = keyedMax
      ? 0
      : Number(
          resolveMaxEarningsCentsForSubmission(
            contest as any,
            contest?.platform,
          ) || 0,
        );
    if (keyedMax || contestWideMax > 0) {
      const byCreator = new Map<string, typeof assignmentRows>();
      for (const sub of assignmentRows) {
        const creatorId = String(sub.creator_id || "");
        if (!creatorId) continue;
        const list = byCreator.get(creatorId) || [];
        list.push(sub);
        byCreator.set(creatorId, list);
      }
      for (const list of byCreator.values()) {
        list.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        const running = new Map<string, number>();
        for (const sub of list) {
          const base = Number(submissionExpectedRewardMap.get(sub.id) || 0);
          const max = keyedMax
            ? Number(
                resolveMaxEarningsCentsForSubmission(
                  contest as any,
                  sub.platform,
                ) || 0,
              )
            : contestWideMax;
          if (!max || max <= 0) continue;
          const runKey = keyedMax
            ? String(sub.platform || "").toLowerCase() || "_"
            : "_";
          const used = running.get(runKey) || 0;
          const remaining = max - used;
          const capped =
            remaining <= 0 ? 0 : Math.min(base, Math.max(0, remaining));
          submissionExpectedRewardMap.set(sub.id, capped);
          running.set(runKey, used + Math.min(base, Math.max(0, remaining)));
        }
      }
    }

    const creatorExpectedRewardMap = new Map<string, number>();
    for (const sub of assignmentRows) {
      const st = normalizeMilestoneStatus(sub.status);
      if (st !== "verified" && st !== "paid") continue;
      const payoutCents = submissionExpectedRewardMap.get(sub.id) || 0;
      const creatorId = String(sub.creator_id || "");
      if (!creatorId) continue;
      creatorExpectedRewardMap.set(
        creatorId,
        (creatorExpectedRewardMap.get(creatorId) || 0) + payoutCents,
      );
    }

    const winnerCountsByMilestone = winnerCountsByTargetForPlatform(
      assignments.winnerCountsByKey,
      contest?.platform,
    );

    const creatorMostVerifiedViewsBonusMap = new Map<string, number>();
    const creatorMostVerifiedReelsBonusMap = new Map<string, number>();
    const mvBonusAdj = parsePayoutAdjustment(
      (contest as any)?.payout_adjustment_percentage,
      (contest as any)?.payout_adjustment_mode,
      { contestType: contest?.contest_type ?? null },
    );
    const mostVerifiedBonusByCreator =
      buildMilestoneMostVerifiedBonusByCreatorMapFromDetails(
        assignmentRows,
        (contest?.contest_based_details as Record<string, unknown>) || null,
        contest?.platform,
        undefined,
        {
          shouldAdjustMostVerifiedMilestoneBonus:
            mvBonusAdj.shouldAdjustMostVerifiedMilestoneBonus,
          percentage: mvBonusAdj.percentage,
        },
      );

    mostVerifiedBonusByCreator.forEach((row, creatorId) => {
      if (Number(row.viewsExpectedCents || 0) > 0) {
        creatorMostVerifiedViewsBonusMap.set(
          creatorId,
          Number(row.viewsExpectedCents || 0),
        );
      }
      if (Number(row.expectedCents || 0) > 0) {
        creatorMostVerifiedReelsBonusMap.set(
          creatorId,
          Number(row.expectedCents || 0),
        );
      }
    });

    return {
      submissionExpectedRewardMap,
      creatorMostVerifiedViewsBonusMap,
      creatorMostVerifiedReelsBonusMap,
      creatorExpectedRewardMap,
      winnerCountsByKey: assignments.winnerCountsByKey,
      winnerCountsByMilestone,
    };
  }, [
    contest?.contest_type,
    contest?.contest_based_details,
    contest?.platform,
    (contest as any)?.max_earnings_per_creator,
    (contest as any)?.bonus_details,
    (contest as any)?.payout_adjustment_percentage,
    (contest as any)?.payout_adjustment_mode,
    allMilestoneBonusSubmissions,
    leaderboard,
    groupedLeaderboardByCreator,
    mySubmissionsListFromApi,
  ]);

  const isCreatorModeTotals =
    leaderboardDisplayMode === "creator" &&
    contest?.platform?.toLowerCase() !== "twitter" &&
    contest?.platform?.toLowerCase() !== "x";
  const effectiveLeaderboardTotalEntries = isCreatorModeTotals
    ? creatorTotalEntries
    : totalLeaderboardEntries;
  const effectiveLeaderboardTotalPages = isCreatorModeTotals
    ? creatorTotalPages
    : totalLeaderboardPages;
  const leaderboardBannerCounts =
    leaderboardBannerByTab[leaderboardPlatformTab] ??
    leaderboardSubmissionBannerCounts(0, 0);
  const creatorDetailSubmissionTotal = Math.max(
    Number(contest?.live_submission_count) || 0,
    leaderboardBannerByTab[ALL_PLATFORM_TAB]?.total || 0,
  );

  // Keep track of how many creators are on each page in creator-wise view
  // so we can render continuous creator ranks across pagination
  useEffect(() => {
    if (
      leaderboardDisplayMode === "creator" &&
      groupedLeaderboardByCreator &&
      groupedLeaderboardByCreator.length > 0
    ) {
      creatorsPerPageRef.current[leaderboardCurrentPage] =
        groupedLeaderboardByCreator.length;
    }
  }, [
    leaderboardDisplayMode,
    groupedLeaderboardByCreator,
    leaderboardCurrentPage,
  ]);

  // Lazy-load submissions for selected creator when in creator-wise view (non-Twitter)
  useEffect(() => {
    if (
      !contestId ||
      !selectedCreatorId ||
      leaderboardDisplayMode !== "creator" ||
      contest?.platform?.toLowerCase() === "twitter" ||
      contest?.platform?.toLowerCase() === "x"
    ) {
      if (!selectedCreatorId) setSelectedCreatorSubmissions([]);
      setLoadingCreatorVideosModal(false);
      return;
    }
    if (creatorWiseLeaderboard.length === 0) {
      setSelectedCreatorSubmissions([]);
      setLoadingCreatorVideosModal(false);
      return;
    }
    const existing = creatorWiseLeaderboard.find(
      (r) => r.creator_id === selectedCreatorId,
    );
    if (existing?.submissions?.length) {
      setSelectedCreatorSubmissions(existing.submissions);
      setLoadingCreatorVideosModal(false);
      return;
    }
    setLoadingCreatorVideosModal(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/leaderboard/${contestId}/creators/${selectedCreatorId}/submissions`,
        );
        const data = await res.json();
        if (!cancelled && data.submissions)
          setSelectedCreatorSubmissions(data.submissions);
      } catch (_) {
        if (!cancelled) setSelectedCreatorSubmissions([]);
      } finally {
        if (!cancelled) setLoadingCreatorVideosModal(false);
      }
    })();
    return () => {
      cancelled = true;
      setLoadingCreatorVideosModal(false);
    };
  }, [
    contestId,
    selectedCreatorId,
    leaderboardDisplayMode,
    contest?.platform,
    creatorWiseLeaderboard.length,
    creatorWiseLeaderboard,
  ]);

  // Get user's submissions (now memoized)
  const getUserSubmissions = () => userSubmissions;

  // Get best submission (now memoized)
  const getBestSubmission = () => bestSubmission;

  // Get creator videos (memoized); use API-included submissions when present so "All Videos" opens immediately
  const getCreatorVideos = useMemo(() => {
    if (!selectedCreatorId || !groupedLeaderboardByCreator) return [];
    const creatorGroup = groupedLeaderboardByCreator.find(
      (group) => group.creator_id === selectedCreatorId,
    );
    const isNonTwitterCreatorWise =
      contest?.platform?.toLowerCase() !== "twitter" &&
      contest?.platform?.toLowerCase() !== "x" &&
      leaderboardDisplayMode === "creator" &&
      creatorWiseLeaderboard.length > 0;
    let videos = creatorGroup?.submissions?.length
      ? creatorGroup.submissions
      : isNonTwitterCreatorWise && selectedCreatorSubmissions.length > 0
        ? selectedCreatorSubmissions
        : creatorGroup?.submissions || [];
    if (
      showLeaderboardPlatformIcons &&
      leaderboardPlatformTab !== ALL_PLATFORM_TAB &&
      isVideoContestPlatform(leaderboardPlatformTab)
    ) {
      videos = videos.filter(
        (video: { platform?: string | null }) =>
          parseVideoContestPlatforms(video.platform)[0] ===
          leaderboardPlatformTab,
      );
    }
    return videos;
  }, [
    selectedCreatorId,
    groupedLeaderboardByCreator,
    contest?.platform,
    leaderboardDisplayMode,
    creatorWiseLeaderboard.length,
    selectedCreatorSubmissions,
    showLeaderboardPlatformIcons,
    leaderboardPlatformTab,
  ]);

  const handleRefreshMetrics = async () => {
    if (!contest?.id) return;

    const contestHasEnded = isContestEnded(contest.status);
    if (contestHasEnded) {
      return;
    }

    setIsRefreshingMetrics(true);

    let result:
      | {
          queued?: boolean;
          error?: string;
          lastMetricsUpdated?: string;
          runId?: string;
        }
      | undefined = undefined;
    try {
      const response = await fetch(
        `/api/contests/${contest.id}/refresh-metrics`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Creators always request YouTube basic (server also forces this).
          body: JSON.stringify({ scope: "basic" }),
        },
      );

      result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error ?? "Failed to refresh metrics");
      }

      if (result?.queued) {
        const runId = result.runId;
        const isTwitterPlatform =
          contest?.platform?.toLowerCase() === "twitter" ||
          contest?.platform?.toLowerCase() === "x";

        // Prefer DB run tracking for Twitter so the loader persists across tab switches.
        if (runId && isTwitterPlatform) {
          try {
            const res = await fetch(
              `/api/contests/${contest.id}/twitter-metrics-refresh/status`,
            );
            if (res.ok) {
              const data = await res.json();
              const run = data?.run as TwitterMetricsRefreshRunSummary | null;
              if (
                run?.id === runId &&
                (run.status === "pending" || run.status === "running")
              ) {
                startTrackingTwitterMetricsRun(run);
                return;
              }
            }
          } catch {
            // ignore; we'll fallback to approximate started_at
          }

          startTrackingTwitterMetricsRun({
            id: runId,
            status: "running",
            started_at: new Date().toISOString(),
            finished_at: null,
          });
          return;
        }

        // Multi-platform video chain: wait YouTube → Instagram → TikTok (with client backup).
        type QueuedLiveRun = {
          platform: string;
          platformLabel?: string;
          runId?: string;
          statusPath?: string;
        };
        const queuedRuns: QueuedLiveRun[] = Array.isArray(
          (result as { runs?: QueuedLiveRun[] }).runs,
        )
          ? (result as { runs: QueuedLiveRun[] }).runs.filter(
              (r) => r && typeof r.platform === "string",
            )
          : [];
        const isMultiPlatformChain =
          Boolean((result as { chain?: boolean }).chain) ||
          queuedRuns.length > 1;

        if (isMultiPlatformChain && queuedRuns.length > 0) {
          const refreshStartedMs = Date.now();
          const pollMaxMs = 600_000; // 10 min for full chain
          const STUCK_AFTER_TERMINAL_MS = 45_000;
          let continueInFlight = false;
          let waitingForNextSinceMs: number | null = null;
          let pollInFlight = false;
          let finished = false;

          const statusPathFor = (platform: string) => {
            if (platform === "youtube") return "youtube-metrics-refresh/status";
            if (platform === "tiktok") return "tiktok-metrics-refresh/status";
            return "instagram-insights-refresh/status";
          };

          const tryContinueChain = async (next: QueuedLiveRun) => {
            if (continueInFlight) return;
            if (
              next.platform !== "youtube" &&
              next.platform !== "instagram" &&
              next.platform !== "tiktok"
            ) {
              return;
            }
            continueInFlight = true;
            try {
              const enqueueUrl = postCampaignEnqueuePathForPlatform(
                contest.id,
                next.platform as PostCampaignVideoPlatform,
              );
              const body: Record<string, unknown> = {
                metricsTarget: "submissions",
                chainContinue: true,
              };
              // Creators always use YouTube basic (server also forces this).
              if (next.platform === "youtube") body.scope = "basic";
              const eres = await fetch(enqueueUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
              });
              const edata = await eres.json().catch(() => ({}));
              if (eres.ok && typeof edata.runId === "string") {
                next.runId = edata.runId;
              }
            } catch {
              // ignore; next poll retries
            } finally {
              continueInFlight = false;
            }
          };

          const finishChain = (partial?: boolean) => {
            if (finished) return;
            finished = true;
            clearInterval(pollTimer);
            setIsRefreshingMetrics(false);
            if (partial) {
              toast({
                title: "Refresh finished (partial)",
                description:
                  "A later platform did not start. Metrics may still update shortly — try reloading.",
                variant: "destructive",
                duration: 10000,
              });
            }
            window.location.reload();
          };

          const pollOnce = async () => {
            if (finished || pollInFlight) return;
            if (Date.now() - refreshStartedMs > pollMaxMs) {
              finishChain(true);
              return;
            }
            pollInFlight = true;
            try {
              const states: Array<{
                tracked: boolean;
                terminal: boolean;
              }> = [];

              for (let i = 0; i < queuedRuns.length; i++) {
                const queued = queuedRuns[i]!;
                const statusPath =
                  queued.statusPath || statusPathFor(queued.platform);
                try {
                  const sres = await fetch(
                    `/api/contests/${contest.id}/${statusPath}`,
                  );
                  if (!sres.ok) {
                    states.push({ tracked: false, terminal: false });
                    break;
                  }
                  const sj = await sres.json();
                  const run = sj?.run as {
                    id: string;
                    status: string;
                    started_at?: string;
                    finished_at?: string | null;
                  } | null;
                  const tracked = Boolean(
                    run &&
                    isTrackedPostCampaignRun(run, {
                      activeRunId: queued.runId,
                      refreshStartedMs,
                    }),
                  );
                  const terminal =
                    tracked && isTerminalPostCampaignRunStatus(run?.status);
                  if (tracked && run && !queued.runId) queued.runId = run.id;
                  states.push({ tracked, terminal });
                  if (!tracked || !terminal) break;
                } catch {
                  states.push({ tracked: false, terminal: false });
                  break;
                }
              }
              while (states.length < queuedRuns.length) {
                states.push({ tracked: false, terminal: false });
              }

              const pollIndex = resolveSequentialRefreshPollIndex(states);
              if (pollIndex >= queuedRuns.length) {
                finishChain(false);
                return;
              }

              const current = states[pollIndex];
              if (current && !current.tracked && pollIndex > 0) {
                const prev = states[pollIndex - 1];
                if (prev?.terminal) {
                  if (waitingForNextSinceMs == null) {
                    waitingForNextSinceMs = Date.now();
                  }
                  await tryContinueChain(queuedRuns[pollIndex]!);
                  if (
                    Date.now() - (waitingForNextSinceMs ?? Date.now()) >
                    STUCK_AFTER_TERMINAL_MS
                  ) {
                    finishChain(true);
                    return;
                  }
                }
              } else {
                waitingForNextSinceMs = null;
              }
            } catch {
              // ignore poll errors
            } finally {
              pollInFlight = false;
            }
          };

          void pollOnce();
          const pollTimer = setInterval(() => void pollOnce(), 3000);
          return;
        }

        // Single-platform (or missing runs[]): timestamp-based polling.
        const previousUpdated = contest?.last_metrics_updated ?? null;
        const pollIntervalMs = 3000;
        const pollMaxMs = 120000; // 2 min
        const startedAt = Date.now();
        const pollTimer = setInterval(async () => {
          if (Date.now() - startedAt > pollMaxMs) {
            clearInterval(pollTimer);
            setIsRefreshingMetrics(false);
            toast({
              title: "Refresh taking longer than expected",
              description:
                "Metrics may still be updating in the background. Try reloading the page shortly.",
              variant: "destructive",
            });
            return;
          }
          try {
            const res = await fetch(
              `/api/contests/${contest.id}/last-metrics-updated`,
            );
            if (!res.ok) return;
            const data = await res.json();
            const newUpdated = data.last_metrics_updated ?? null;
            if (newUpdated && newUpdated !== previousUpdated) {
              clearInterval(pollTimer);
              setIsRefreshingMetrics(false);
              window.location.reload();
              return;
            }
          } catch {
            // ignore
          }
        }, pollIntervalMs);
      } else {
        // Sync refresh completed; reload page so all data is fresh
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (error: any) {
      console.error("Failed to refresh metrics:", error);
      toast({
        title: "Cannot refresh yet",
        description:
          error?.message ??
          "Please participate in the campaign before refreshing.",
        variant: "destructive",
      });
    } finally {
      // Only clear loading state here for non-queued path; queued path clears it when poll completes or times out
      if (!result?.queued) {
        setIsRefreshingMetrics(false);
      }
    }
  };

  // Helper function to determine if refresh should be disabled and why
  const getRefreshButtonState = () => {
    if (!contest) {
      return { isDisabled: true, disabledReason: "Contest not loaded" };
    }

    const cooldownInfo = getMetricsRefreshCooldownInfoOpportunities(
      contest?.last_metrics_updated,
    );

    const isLocked =
      contest.post_contest_status === "in_review" ||
      contest.post_contest_status === "verification_complete" ||
      contest.post_contest_status === "payouts_processed";
    const contestHasEnded = isContestEnded(contest.status);

    const isDisabled =
      isRefreshingMetrics ||
      twitterMetricsRunActiveWithinWindow ||
      !cooldownInfo.canRefresh ||
      isLocked ||
      contestHasEnded;

    let disabledReason = "";
    if (isRefreshingMetrics || twitterMetricsRunActiveWithinWindow) {
      disabledReason =
        "A refresh run is already in progress. Please wait up to 5 minutes.";
    } else if (contestHasEnded) {
      disabledReason = "Contest has ended";
    } else if (isLocked) {
      disabledReason = "Metrics are locked after contest review begins";
    } else if (!cooldownInfo.canRefresh) {
      disabledReason = `Please wait ${formatRemainingTime(
        cooldownInfo.remainingMs,
      )}`;
    }

    return {
      isDisabled,
      disabledReason,
      cooldownInfo,
      isContestEnded: contestHasEnded,
    };
  };

  // Detect if user just submitted content (redirect from submit page)
  const justSubmitted = searchParams.get("success") === "content_submitted";

  const fetchLeaderboard = async (
    pageToFetch: number = 1,
    groupByCreator: boolean = false,
    silent: boolean = false,
  ) => {
    if (!isMountedRef.current) return;
    const requestedTab = leaderboardPlatformTabRef.current;
    if (!silent) setLoadingLeaderboard(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: dummyEntries } =
        generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const platformFilter =
        requestedTab !== ALL_PLATFORM_TAB &&
        isVideoContestPlatform(requestedTab)
          ? requestedTab
          : null;
      const allEntries = platformFilter
        ? dummyEntries.filter(
            (entry) =>
              String(entry.platform || "").toLowerCase() === platformFilter,
          )
        : dummyEntries;
      const totalEntries = allEntries.length;
      const totalPages = Math.ceil(totalEntries / leaderboardItemsPerPage);
      const startIndex = (pageToFetch - 1) * leaderboardItemsPerPage;
      const endIndex = startIndex + leaderboardItemsPerPage;
      const paginatedEntries = allEntries.slice(startIndex, endIndex);
      const dummyBanner = leaderboardSubmissionBannerCounts(totalEntries, 0);

      setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!groupByCreator) {
          setLeaderboardBannerByTab((prev) => ({
            ...prev,
            [requestedTab]: dummyBanner,
          }));
        }
        if (leaderboardPlatformTabRef.current !== requestedTab) return;
        setLeaderboard(paginatedEntries);
        setLastUpdated(new Date().toISOString());
        setLeaderboardCurrentPage(pageToFetch);
        setTotalLeaderboardPages(totalPages);
        setTotalLeaderboardEntries(totalEntries);
        setContestType("leaderboard"); // Set dummy contest type

        // Mark as loaded only after successful fetch
        const platform = contest?.platform || "unknown";
        const contestKey = `${contestId}-${platform}-${requestedTab}`;
        leaderboardLoadedRef.current = contestKey;

        // If we got data, reset the empty refetch flag
        if (paginatedEntries.length > 0 || totalEntries > 0) {
          emptyDataRefetchAttemptedRef.current = null;
        }

        if (!silent) setLoadingLeaderboard(false);
      }, 300);
      return;
    }

    // Real API Call (optionally groupBy=creator for combined views per creator)
    let leaderboardFetchError = null;
    try {
      const params = new URLSearchParams({
        page: String(pageToFetch),
        limit: String(leaderboardItemsPerPage),
      });
      if (groupByCreator) params.set("groupBy", "creator");
      if (
        requestedTab !== ALL_PLATFORM_TAB &&
        isVideoContestPlatform(requestedTab)
      ) {
        params.set("platform", requestedTab);
      }
      // Bypass 2h cache after a new submission, or the first load of each tab
      // so All vs YouTube/Instagram/TikTok totals cannot leak from a stale payload.
      if (justSubmitted || !leaderboardBannerByTabRef.current[requestedTab]) {
        params.set("fresh", "1");
      }
      const response = await fetch(
        `/api/leaderboard/${contestId}?${params.toString()}`,
      );
      const data = await response.json();
      if (!response.ok) {
        leaderboardFetchError = data.error || "Failed to fetch leaderboard";
        throw new Error(leaderboardFetchError);
      }
      if (!isMountedRef.current) return;
      if (isMountedRef.current) {
        if (groupByCreator) {
          if (leaderboardPlatformTabRef.current !== requestedTab) return;
          const rows = data.leaderboard || [];
          setCreatorWiseLeaderboard(
            rows.map((r: any) => ({
              creator_id: r.creator_id,
              creator_username: r.creator_username ?? "N/A",
              creator_full_name: r.creator_full_name ?? "Unknown Creator",
              creator_pfp_url: r.creator_pfp_url ?? null,
              user_platform_pfp_url: r.user_platform_pfp_url ?? null,
              user_platform_username:
                r.user_platform_username ?? r.creator_username ?? "N/A",
              user_full_name:
                r.user_full_name ?? r.creator_full_name ?? "Unknown Creator",
              submissions: r.submissions ?? [],
              submission_ranks: r.submission_ranks,
              total_views: r.total_views ?? 0,
              total_earnings: r.total_earnings ?? 0,
              best_rank: r.best_rank ?? 0,
              submission_count: r.submission_count ?? 0,
              has_paid_submission: r.has_paid_submission,
              creator_bonus_paid_total: r.creator_bonus_paid_total ?? 0,
              most_verified_bonus_paid_views_cents:
                r.most_verified_bonus_paid_views_cents ?? 0,
              most_verified_bonus_paid_reels_cents:
                r.most_verified_bonus_paid_reels_cents ?? 0,
              display_status: r.display_status ?? null,
              pending_submission_count: r.pending_submission_count ?? 0,
              platform: r.platform ?? null,
              platforms: Array.isArray(r.platforms) ? r.platforms : [],
            })),
          );
          setCreatorTotalEntries(data.totalEntries ?? 0);
          setCreatorTotalPages(data.totalPages ?? 0);
        } else {
          const banner = leaderboardBannerCountsFromPayload(data);
          setLeaderboardBannerByTab((prev) => ({
            ...prev,
            [requestedTab]: banner,
          }));
          if (leaderboardPlatformTabRef.current !== requestedTab) return;
          setLeaderboard(data.leaderboard || []);
          setTotalLeaderboardEntries(banner.active);
          setTotalLeaderboardPages(
            data.totalPages ??
              (banner.active
                ? Math.ceil(banner.active / leaderboardItemsPerPage)
                : 0),
          );
        }
        setLastUpdated(data.lastUpdated);
        setLeaderboardCurrentPage(data.currentPage ?? pageToFetch);
        setContestType(data.contestType || null);

        const platform = contest?.platform || "unknown";
        const contestKey = `${contestId}-${platform}-${requestedTab}`;
        leaderboardLoadedRef.current = contestKey;
      }
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      if (isMountedRef.current && !error)
        setError(leaderboardFetchError || err.message);
    } finally {
      if (isMountedRef.current && !silent) setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper function to render verification badges (all contest types / platforms)
  const renderVerificationBadges = (
    source:
      | string
      | {
          status?: string | null;
          moderation_status?: string | null;
          display_status?: string | null;
          pending_submission_count?: number | null;
          submissions?: Array<{
            status?: string | null;
            moderation_status?: string | null;
          }>;
        }
      | null
      | undefined,
  ) => renderLeaderboardStatusBadge(source);

  const renderPostContestStatusBadge = (status: string | null) => {
    if (!status) return null;

    let badgeColor = "bg-gray-500";
    let textColor = "text-white";
    let text = "Unknown";
    let icon = null;

    switch (status?.toLowerCase()) {
      case "pending_review":
        badgeColor = "bg-blue-500";
        text = "Under Review";
        icon = <Clock className="h-3 w-3 mr-1" />;
        break;
      case "in_review":
        badgeColor = "bg-purple-500";
        text = "In Review";
        icon = <RefreshCw className="h-3 w-3 mr-1" />;
        break;
      case "verification_complete":
        badgeColor = "bg-green-500";
        text = "Verification Complete";
        icon = <CheckCircle className="h-3 w-3 mr-1" />;
        break;
      case "payouts_processed":
        badgeColor = "bg-emerald-600";
        text = "Payouts Processed";
        icon = <DollarSign className="h-3 w-3 mr-1" />;
        break;
      default:
        badgeColor = "bg-gray-500";
        text = "Unknown Status";
        break;
    }

    return (
      <Badge
        variant="secondary"
        className={`${badgeColor} ${textColor} text-sm px-3 py-1.5 rounded-full font-medium flex items-center`}
      >
        {icon}
        {text}
      </Badge>
    );
  };

  const getPostContestStatusDescription = (status: string | null) => {
    if (!status) return null;

    switch (status?.toLowerCase()) {
      case "pending_review":
        return "The contest has ended and submissions are being prepared for review.";
      case "in_review":
        return "Contest submissions are currently being reviewed and verified by our team.";
      case "verification_complete":
        return "All submissions have been verified. Winners and payouts are being finalized.";
      case "payouts_processed":
        return "Verification is complete and payouts have been processed to winners.";
      default:
        return "Contest status is being updated.";
    }
  };

  const fetchMySubmissionData = async () => {
    if (!isMountedRef.current) return;

    setLoadingMySubmission(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: allEntries, myRank } =
        generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const myEntryData = allEntries.find(
        (e) => e.creator_id === MY_DUMMY_SUBMISSION_USER_ID,
      );

      setTimeout(() => {
        if (isMountedRef.current) {
          if (myEntryData && myRank !== null) {
            // Add dummy verified status for testing
            setMyLeaderboardEntry({
              ...myEntryData,
              rank: myRank,
              status: "verified",
            });
          } else {
            setMyLeaderboardEntry(null);
          }
          setLoadingMySubmission(false);
        }
      }, 150);
      return;
    }

    // Real API Call
    if (!user || !contestId) {
      if (isMountedRef.current) setLoadingMySubmission(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/leaderboard/${contestId}/my-submission`,
      );
      const data = await response.json();
      if (!response.ok) {
        console.warn(
          "Failed to fetch user submission data:",
          data.error || "Unknown error",
        );
        if (isMountedRef.current) {
          setMyLeaderboardEntry(null);
          setMySubmissionsListFromApi([]);
          setMyCreatorWiseStats(null);
        }
        return;
      }
      if (isMountedRef.current) {
        const subs = Array.isArray(data.submissions) ? data.submissions : [];
        setMySubmissionsListFromApi(
          subs.map(
            (s: any): LeaderboardEntry => ({
              id: s.id,
              creator_id: s.creator_id,
              video_title: s.video_title ?? "",
              video_thumbnail_url: s.video_thumbnail_url ?? null,
              views: s.views ?? 0,
              earnings: s.earnings ?? 0,
              status: s.status ?? "",
              created_at: s.created_at,
              content_link: s.content_link ?? "",
              platform: s.platform ?? "",
              user_platform_username: s.user_platform_username ?? "N/A",
              user_full_name: s.user_full_name ?? "",
              creator_pfp_url: s.creator_pfp_url ?? null,
              user_platform_pfp_url: s.user_platform_pfp_url ?? null,
              rank:
                typeof s.leaderboard_rank === "number"
                  ? s.leaderboard_rank
                  : undefined,
            }),
          ),
        );

        setMyCreatorWiseStats(
          data.creator_wise_total_views != null ||
            data.creator_wise_rank != null ||
            data.creator_wise_total_earnings != null
            ? {
                total_views: data.creator_wise_total_views ?? 0,
                total_earnings: data.creator_wise_total_earnings ?? 0,
                rank:
                  data.creator_wise_rank === undefined
                    ? null
                    : data.creator_wise_rank,
              }
            : null,
        );

        if (data.mySubmission) {
          const ms = data.mySubmission as typeof data.mySubmission & {
            leaderboard_rank?: number | null;
          };
          const submissionRank =
            typeof ms.leaderboard_rank === "number"
              ? ms.leaderboard_rank
              : data.rank != null
                ? data.rank
                : undefined;
          setMyLeaderboardEntry({
            ...data.mySubmission,
            ...(submissionRank !== undefined && submissionRank !== null
              ? { rank: submissionRank }
              : {}),
          });
        } else {
          setMyLeaderboardEntry(null);
        }
        // Mark as fetched to prevent repeated calls
        const platform = contest?.platform || "unknown";
        const contestKey = `${contestId}-${platform}`;
        myRankFetchedRef.current = contestKey;
      }
    } catch (err: any) {
      console.error("Error fetching user's submission data:", err);
      if (isMountedRef.current) {
        setMyLeaderboardEntry(null);
        setMySubmissionsListFromApi([]);
        setMyCreatorWiseStats(null);
        // Mark as fetched even on error to prevent infinite retries
        const platform = contest?.platform || "unknown";
        const contestKey = `${contestId}-${platform}`;
        myRankFetchedRef.current = contestKey;
      }
    } finally {
      if (isMountedRef.current) setLoadingMySubmission(false);
    }
  };

  // Fetch Twitter-only leaderboard (aggregated from twitter_campaign_leaderboard)
  const fetchTwitterLeaderboard = async (
    contestTypeOverride?: string | null,
  ) => {
    if (!isMountedRef.current || !contestId) return;

    setLoadingLeaderboard(true);

    try {
      const response = await fetch(
        `/api/contests/${contestId}/twitter-leaderboard?page=1&limit=${leaderboardItemsPerPage}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch Twitter leaderboard");
      }

      if (isMountedRef.current) {
        // twitter_campaign_leaderboard rows already contain aggregated stats per creator.
        // We reuse the existing leaderboard state structure where possible.
        setLeaderboard(data.leaderboard || []);
        setLastUpdated(new Date().toISOString());
        setLeaderboardCurrentPage(data.currentPage || 1);
        setTotalLeaderboardPages(data.totalPages || 1);
        setTotalLeaderboardEntries(data.totalEntries || 0);
        setContestType(
          contestTypeOverride ??
            contest?.contest_type ??
            data.contestType ??
            "leaderboard",
        );

        // Mark as loaded only after successful fetch (even if empty - that's a valid response)
        const platform = contest?.platform || "twitter";
        const contestKey = `${contestId}-${platform}`;
        leaderboardLoadedRef.current = contestKey;

        // If we got data, reset the empty refetch flag (in case data was cleared and refetched)
        if (
          (data.leaderboard?.length || 0) > 0 ||
          (data.totalEntries || 0) > 0
        ) {
          emptyDataRefetchAttemptedRef.current = null;
        }
      }
    } catch (err: any) {
      console.error("Error fetching Twitter leaderboard:", err);
      if (isMountedRef.current && !error) {
        setError(err.message || "Failed to fetch Twitter leaderboard");
      }
    } finally {
      if (isMountedRef.current) setLoadingLeaderboard(false);
    }
  };

  // Fetch current creator's rank/entry from twitter_campaign_leaderboard
  const fetchMyTwitterRank = async () => {
    if (!isMountedRef.current || !contestId) return;

    setLoadingMySubmission(true);

    try {
      const response = await fetch(
        `/api/contests/${contestId}/twitter-my-rank`,
      );
      const data = await response.json();

      if (!response.ok) {
        console.warn(
          "Failed to fetch Twitter my-rank data:",
          data.error || "Unknown error",
        );
        if (isMountedRef.current) setMyLeaderboardEntry(null);
        return;
      }

      if (isMountedRef.current) {
        if (data.entry) {
          // entry already contains current_rank and aggregated stats
          setMyLeaderboardEntry({
            ...data.entry,
            rank: data.entry.current_rank,
          });
        } else {
          setMyLeaderboardEntry(null);
        }
        // Mark as fetched to prevent repeated calls
        const platform = contest?.platform || "twitter";
        const contestKey = `${contestId}-${platform}`;
        myRankFetchedRef.current = contestKey;
      }
    } catch (err: any) {
      console.error("Error fetching Twitter my-rank data:", err);
      if (isMountedRef.current) {
        setMyLeaderboardEntry(null);
        // Mark as fetched even on error to prevent infinite retries
        const platform = contest?.platform || "twitter";
        const contestKey = `${contestId}-${platform}`;
        myRankFetchedRef.current = contestKey;
      }
    } finally {
      if (isMountedRef.current) setLoadingMySubmission(false);
    }
  };

  // Fetch Twitter campaign metrics
  const fetchTwitterMetrics = async () => {
    if (!isMountedRef.current || !contestId) return;

    setLoadingMetrics(true);

    try {
      const response = await fetch(
        `/api/contests/${contestId}/twitter-metrics`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch Twitter metrics");
      }

      if (isMountedRef.current) {
        setTwitterMetrics(data.metrics || null);
      }
    } catch (err: any) {
      console.error("Error fetching Twitter metrics:", err);
      if (isMountedRef.current) setTwitterMetrics(null);
    } finally {
      if (isMountedRef.current) setLoadingMetrics(false);
    }
  };

  // Fetch Twitter tweets for analytics (all tweets, not just eligible ones)
  const fetchAnalyticsTweets = async () => {
    if (
      !isMountedRef.current ||
      !contestId ||
      contest?.platform?.toLowerCase() !== "twitter"
    )
      return;

    setLoadingAnalyticsTweets(true);

    try {
      const { data: tweetsData, error } =
        await fetchContestTwitterTweetsAllPages(
          supabase,
          contestId,
          `
          id,
          tweet_id,
          tweet_url,
          tweet_text,
          tweet_created_at,
          tweet_type,
          twitter_username,
          creator_id,
          likes,
          replies,
          retweets,
          quote_reposts,
          impressions,
          points,
          is_eligible,
          moderation_status,
          manual_points_adjustment,
          manual_points_reason,
          target_tweet_id,
          tweet_type
        `,
          { order: { column: "tweet_created_at", ascending: false } },
        );

      if (error) {
        throw new Error(
          String((error as { message?: string })?.message ?? error) ||
            "Failed to fetch tweets",
        );
      }

      if (isMountedRef.current) {
        // Transform tweets to submission-like format for analytics
        const transformedTweets = (tweetsData || []).map((tweet: any) => ({
          id: tweet.id,
          created_at: tweet.tweet_created_at,
          content_link: tweet.tweet_url,
          status: tweet.moderation_status || "pending",
          views: tweet.impressions || 0,
          earnings: null,
          other_stats: {
            likes: tweet.likes || 0,
            replies: tweet.replies || 0,
            retweets: tweet.retweets || 0,
            quote_reposts: tweet.quote_reposts || 0,
            impressions: tweet.impressions || 0,
            points: (tweet.points || 0) + (tweet.manual_points_adjustment || 0),
            // Calculate base points for raid campaigns
            // For raid campaigns, points field contains base + bonus, so we need to calculate base from tweet_type
            // For regular campaigns, points is just the base points
            base_points: (() => {
              if (tweet.target_tweet_id) {
                // This is a raid engagement - calculate base points from tweet_type
                const tweetType = tweet.tweet_type;
                if (tweetType === "reply" || tweetType === "comment") {
                  return 1; // comment_base_points
                } else if (tweetType === "retweet") {
                  return 5; // retweet_base_points
                } else if (
                  tweetType === "quote" ||
                  tweetType === "quote_repost"
                ) {
                  return 10; // quote_repost_base_points
                } else {
                  // Fallback: if we can't determine type, use points as base (for backwards compatibility)
                  return tweet.points || 0;
                }
              } else {
                // Regular campaign - points is just base points
                return tweet.points || 0;
              }
            })(),
            manual_points_adjustment: tweet.manual_points_adjustment || 0,
            manual_points_reason: tweet.manual_points_reason,
            tweet_type: tweet.tweet_type,
            tweet_text: tweet.tweet_text,
          },
          platform: "twitter",
          video_thumbnail_url: null,
          video_title: tweet.tweet_text?.substring(0, 100) || null,
          creator_id: tweet.creator_id,
          is_twitter_tweet: true,
          tweet_id: tweet.tweet_id,
          moderation_status: tweet.moderation_status || "pending",
          manual_points_adjustment: tweet.manual_points_adjustment || 0,
          manual_points_reason: tweet.manual_points_reason,
        }));
        setAnalyticsTweets(transformedTweets);
      }
    } catch (err: any) {
      console.error("Error fetching analytics tweets:", err);
      if (isMountedRef.current) setAnalyticsTweets([]);
    } finally {
      if (isMountedRef.current) setLoadingAnalyticsTweets(false);
    }
  };

  const fetchPostContestStatus = async () => {
    if (!isMountedRef.current || !contestId) return;

    try {
      const { data: contestData, error } = await supabase
        .from("contests")
        .select("post_contest_status")
        .eq("id", contestId)
        .single();

      if (error) {
        console.error("Error fetching post-contest status:", error);
        return;
      }

      if (isMountedRef.current) {
        setPostContestStatus(contestData?.post_contest_status || null);
      }
    } catch (error) {
      console.error("Error fetching post-contest status:", error);
    }
  };

  // REMOVED: Automatic Twitter API calls on page load
  // Twitter API calls are ONLY made when refresh buttons are clicked
  // This saves API calls - data is only fetched when explicitly requested

  // Fetch analytics tweets and metrics when Analytics tab is active for Twitter campaigns
  useEffect(() => {
    if (
      activeTab === "analytics" &&
      contest?.platform?.toLowerCase() === "twitter" &&
      contestId &&
      isMountedRef.current
    ) {
      fetchAnalyticsTweets();
      // Also fetch Twitter metrics for target metrics display (especially for raid campaigns)
      if (!twitterMetrics) {
        fetchTwitterMetrics();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, contest?.platform, contestId]);

  // Clean up URL parameters on component mount
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "already_submitted") {
      // Clear the error parameter from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, router]);

  // Scroll spy effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry that is most visible
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by intersection ratio to find the most visible section
          const mostVisible = visibleEntries.sort(
            (a, b) => b.intersectionRatio - a.intersectionRatio,
          )[0];
          setActiveSection(mostVisible.target.id);
        }
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
        rootMargin: "-180px 0px -40% 0px", // Adjusted to account for page header + sticky nav height
      },
    );

    visibleSections.forEach((section) => {
      const element = sectionRefs.current[section.id];
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      visibleSections.forEach((section) => {
        const element = sectionRefs.current[section.id];
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [visibleSections]);

  useEffect(() => {
    // If NOT using dummy data for leaderboard, and user is not available, show loading.
    if (!USE_DUMMY_DATA_FOR_LEADERBOARD && !user) {
      setLoading(true);
      return;
    }

    async function fetchData() {
      if (!isMountedRef.current) return;
      setLoading(true); // Start with loading true for both paths initially
      setError(null);
      setIsUnavailable(false);

      // Fetch contest details - this is usually needed for prize info, title, etc.
      // regardless of where leaderboard data comes from.
      let contestData: any = null;
      try {
        const { data: fetchedContestData, error: contestError } = await supabase
          .from("contests_with_status")
          .select(`*, advertiser_profiles ( company_name )`)
          .eq("id", contestId)
          .maybeSingle();

        if (contestError) throw contestError;
        if (
          !fetchedContestData ||
          fetchedContestData.moderation_status !== "published"
        ) {
          const preview = !fetchedContestData
            ? await applicationsApi
                .preview(contestId)
                .then((res) => res.preview)
                .catch(() => null)
            : null;
          if (!isMountedRef.current) return;
          if (preview && !preview.has_access) {
            setRestrictedPreview(preview);
          } else {
            setIsUnavailable(true);
          }
          return;
        }
        if (isMountedRef.current) setRestrictedPreview(null);

        const { data: requirementFields, error: requirementError } =
          await supabase
            .from("contests")
            .select(
              "trust_score, trust_number, min_avg_quality_score, min_best_quality_score, min_quality_score, min_platform_earnings, min_platform_views",
            )
            .eq("id", contestId)
            .maybeSingle();

        if (requirementError) throw requirementError;

        contestData = {
          ...fetchedContestData,
          ...(requirementFields ?? {}),
        };

        // Check if published contest has valid dates
        if (contestData.status === "incomplete") {
          throw new Error("This contest has incomplete information.");
        }
        if (isMountedRef.current) {
          setContest(contestData);
          setContestType(contestData.contest_type ?? null);
          // No need to set separate lastMetricsUpdate state - it's part of contest state
        }

        // Fetch existing submission status for the current user (if logged in)
        // This is separate from the main leaderboard logic.
        if (user) {
          try {
            const response = await fetch(
              `/api/leaderboard/${contestId}/my-submission`,
            );
            if (response.ok) {
              const data = await response.json();
              if (
                data &&
                data.submissions &&
                data.submissions.length > 0 &&
                isMountedRef.current
              ) {
                const maxSubmissions =
                  contestData.max_submissions_per_creator || 1;
                setSubmissionCount(data.submissions.length);
                setMaxSubmissions(maxSubmissions);

                // For multiple submissions, only show "Submission Complete" if max reached
                if (contestData.multiple_submissions_enabled) {
                  if (data.submissions.length >= maxSubmissions) {
                    setHasSubmitted(true);
                    setExistingSubmission(data.submissions[0]);
                  }
                } else {
                  // For single submission contests, show complete if any submission exists
                  setHasSubmitted(true);
                  setExistingSubmission(data.submissions[0]);
                }
              }
            }
          } catch (error) {
            console.error("Error fetching user submissions:", error);
          }
        }
      } catch (err: any) {
        console.error("Error fetching initial page data:", err);
        if (isMountedRef.current)
          setError(err.message || "Failed to load page data");
      } finally {
        // Call leaderboard fetches after initial contest/user data attempt
        if (isMountedRef.current && contestData) {
          // Fetch leaderboard based on platform type
          const isTwitterContest =
            contestData?.platform?.toLowerCase() === "twitter" ||
            contestData?.platform?.toLowerCase() === "x";
          const contestKey = `${contestId}-${contestData.platform}`;

          if (isTwitterContest) {
            fetchTwitterLeaderboard(contestData.contest_type ?? null);
            fetchMyTwitterRank();
            // Note: leaderboardLoadedRef will be set in fetchTwitterLeaderboard after successful fetch
          } else {
            fetchLeaderboard(1);
            fetchMySubmissionData(); // This will use dummy data if flag is true
            // Note: leaderboardLoadedRef will be set in fetchLeaderboard after successful fetch
          }
          fetchPostContestStatus(); // Fetch post-contest status for transparency
          // Fetch Twitter metrics if this is a Twitter campaign
          if (isTwitterContest) {
            fetchTwitterMetrics();
          }
        }
        // Refused / missing campaigns must leave the spinner so the error shows.
        if (isMountedRef.current) setLoading(false);
      }
    }

    fetchData();

    // Auto-refresh for leaderboard (only if NOT using dummy data)
    const intervalId = setInterval(() => {
      if (
        isMountedRef.current &&
        lastUpdated &&
        !loadingLeaderboard &&
        !USE_DUMMY_DATA_FOR_LEADERBOARD
      ) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (lastUpdateTime < fiveMinutesAgo) {
          const isCreatorWise =
            contest?.platform?.toLowerCase() !== "twitter" &&
            contest?.platform?.toLowerCase() !== "x" &&
            leaderboardDisplayMode === "creator";
          fetchLeaderboard(leaderboardCurrentPage, isCreatorWise);
        }
      }
    }, 60 * 1000);

    // Check for URL hash to set active tab
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash === "#leaderboard") {
        if (isMountedRef.current) setActiveTab("leaderboard");
      }
    }

    return () => {
      clearInterval(intervalId);
    };
    // Added leaderboardItemsPerPage to dependencies as it affects dummy data pagination
  }, [contestId, user?.id, leaderboardItemsPerPage]);

  // Track if leaderboard has been loaded for current contest to avoid refetching on tab switch
  const leaderboardLoadedRef = useRef<string | null>(null);
  // Track if we've attempted a refetch for empty data to prevent infinite loops
  const emptyDataRefetchAttemptedRef = useRef<string | null>(null);
  // Track if my rank has been fetched to prevent repeated calls
  const myRankFetchedRef = useRef<string | null>(null);
  // Track how many creators are shown per page in creator-wise view so ranks can be continuous
  const creatorsPerPageRef = useRef<Record<number, number>>({});

  // Reset loaded flag when contest changes
  useEffect(() => {
    if (contestId && contest?.platform) {
      const contestKey = `${contestId}-${contest.platform}`;
      // If contest changed, reset the loaded flag
      if (leaderboardLoadedRef.current !== contestKey) {
        leaderboardLoadedRef.current = null;
        emptyDataRefetchAttemptedRef.current = null;
        myRankFetchedRef.current = null;
      }
    }
  }, [contestId, contest?.platform]);

  // When user switches to the Leaderboard tab, ensure data is loaded:
  // - For Twitter contests, use Twitter-specific leaderboard APIs
  // - For other contests, use the existing generic leaderboard APIs
  // Only fetch once per contest/tab combination to avoid infinite loops
  useEffect(() => {
    if (!contestId || !contest) return;

    if (activeTab !== "leaderboard") return;

    const isTwitterContest =
      contest.platform?.toLowerCase() === "twitter" ||
      contest.platform?.toLowerCase() === "x";
    const contestKey = isTwitterContest
      ? `${contestId}-${contest.platform}`
      : `${contestId}-${contest.platform}-${leaderboardPlatformTab}`;
    const hasLoaded = leaderboardLoadedRef.current === contestKey;

    // Only fetch if we haven't loaded for this contest yet
    // Don't check leaderboard.length, totalLeaderboardEntries, or loadingLeaderboard here
    // as they would cause infinite loops when state changes
    // The ref is set after successful fetch (even if empty), which prevents refetching
    const shouldFetch = !hasLoaded;

    if (isTwitterContest) {
      // Fetch if we haven't loaded for this contest yet
      if (shouldFetch) {
        fetchTwitterLeaderboard();
        // Note: leaderboardLoadedRef will be set in fetchTwitterLeaderboard after successful fetch
      }
      // Only fetch my rank if we don't have it and haven't fetched it yet
      if (!myLeaderboardEntry && myRankFetchedRef.current !== contestKey) {
        fetchMyTwitterRank();
        // Note: myRankFetchedRef will be set in fetchMyTwitterRank after fetch completes
      }
    } else {
      if (shouldFetch) {
        setLeaderboard([]);
        setTotalLeaderboardEntries(
          leaderboardBannerByTabRef.current[leaderboardPlatformTab]?.active ??
            0,
        );
        fetchLeaderboard(1, false);
        fetchLeaderboard(1, true, true);
      }
      if (!myLeaderboardEntry && myRankFetchedRef.current !== contestKey) {
        fetchMySubmissionData();
        // Note: myRankFetchedRef will be set in fetchMySubmissionData after fetch completes
      }
    }
  }, [activeTab, contestId, contest, leaderboardPlatformTab]);
  // Fetch user profile data for link processing
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;

      try {
        const { data: userData, error } = await supabase
          .from("users")
          .select("full_name, username")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          return;
        }

        if (userData) {
          setUserProfile(userData);
        }
      } catch (error) {
        console.error("Error in fetchUserProfile:", error);
      }
    };

    fetchUserProfile();
  }, [user?.id, supabase]);

  // Fetch creator profile data for filtering categories, subcategories, and interests
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (!user?.id) return;

      try {
        let localCreatorCategories: string[] = [];
        let localCreatorSubcategories: Record<string, string[]> = {};
        let localCreatorInterests: string[] = [];

        const { data: creatorProfileData } = await supabase
          .from("creator_profiles")
          .select("categories, subcategories, interests")
          .eq("id", user.id)
          .single();

        if (creatorProfileData) {
          if (creatorProfileData.categories) {
            localCreatorCategories = Array.isArray(
              creatorProfileData.categories,
            )
              ? creatorProfileData.categories
              : [];
          }

          if (creatorProfileData.subcategories) {
            // Handle both object format and array format
            if (Array.isArray(creatorProfileData.subcategories)) {
              // If it's an array of {category, subcategory} objects
              (creatorProfileData.subcategories as any[]).forEach(
                (item: any) => {
                  if (item.category && item.subcategory) {
                    if (!localCreatorSubcategories[item.category]) {
                      localCreatorSubcategories[item.category] = [];
                    }
                    if (
                      !localCreatorSubcategories[item.category].includes(
                        item.subcategory,
                      )
                    ) {
                      localCreatorSubcategories[item.category].push(
                        item.subcategory,
                      );
                    }
                  }
                },
              );
            } else if (typeof creatorProfileData.subcategories === "object") {
              // If it's already an object
              localCreatorSubcategories =
                creatorProfileData.subcategories as Record<string, string[]>;
            }
          }

          if (creatorProfileData.interests) {
            localCreatorInterests = Array.isArray(creatorProfileData.interests)
              ? creatorProfileData.interests
              : [];
          }
        }

        setCreatorCategories(localCreatorCategories);
        setCreatorSubcategories(localCreatorSubcategories);
        setCreatorInterests(localCreatorInterests);
      } catch (error) {
        console.error("Error fetching creator profile:", error);
      }
    };

    fetchCreatorProfile();
  }, [user?.id, supabase]);

  // Reset modal page when modal opens
  useEffect(() => {
    if (showAllSubmissionsModal) {
      setModalCurrentPage(1);
    }
  }, [showAllSubmissionsModal]);

  // Reset creator videos modal page when modal opens
  useEffect(() => {
    if (showCreatorVideosModal) {
      setCreatorVideosCurrentPage(1);
    }
  }, [showCreatorVideosModal, leaderboardPlatformTab]);

  const isTwitterTextImageContest =
    contest?.platform === "twitter" &&
    (contest as any)?.contest_format === "text_image";

  // Twitter text/image: join status + X connection (parallel) for upfront gating
  useEffect(() => {
    const loadTwitterCampaignState = async () => {
      if (!contestId || !isTwitterTextImageContest || !user) return;

      setTwitterConnectStatus("loading");
      try {
        const [joinRes, profileRes] = await Promise.all([
          fetch(
            `/api/twitter-apis/join-status?contestId=${encodeURIComponent(
              contestId,
            )}`,
          ),
          fetch("/api/twitter-apis/get-profile"),
        ]);

        if (joinRes.ok) {
          const joinData = await joinRes.json().catch(() => null);
          if (joinData && typeof joinData.joined === "boolean") {
            setHasJoinedTwitterCampaign(joinData.joined);
          }
        }

        if (profileRes.ok) {
          const profileData = await profileRes.json().catch(() => null);
          if (profileData && typeof profileData.connected === "boolean") {
            setTwitterConnectStatus(
              profileData.connected ? "connected" : "disconnected",
            );
          } else {
            setTwitterConnectStatus("disconnected");
          }
        } else {
          setTwitterConnectStatus("disconnected");
        }
      } catch {
        setTwitterConnectStatus("disconnected");
      }
    };

    loadTwitterCampaignState();
  }, [contestId, isTwitterTextImageContest, user]);

  useEffect(() => {
    if (!justSubmitted || !user?.id || !hasCreatorRequirements) return;
    void refreshRequirements();
  }, [justSubmitted, user?.id, hasCreatorRequirements, refreshRequirements]);

  const isRequirementsBlocked = !!user && isRequirementsGateBlocked;

  const handleSubmitContent = async (button: SubmitEntryButton) => {
    if (isRequirementsBlocked) return;
    await trackSubmitEntryClick(contestId, button);
    router.push(`/dashboard/opportunities/${contestId}/submit`);
  };

  const mapTwitterJoinApiError = (payload: {
    error?: string;
    code?: string;
  }) => {
    const message =
      payload.error ||
      "Failed to join this Twitter (X) campaign. Please try again.";
    switch (payload.code) {
      case "TWITTER_NOT_CONNECTED":
        return { kind: "not_connected" as const, message };
      case "BIO_USERNAME_MISSING":
        return { kind: "bio" as const, message };
      default:
        return { kind: "generic" as const, message };
    }
  };

  const handleJoinTwitterCampaign = async () => {
    if (!contest?.id) return;

    setTwitterJoinError(null);
    setJoinCampaignLoading(true);
    try {
      const res = await fetch("/api/twitter-apis/join-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contestId: contest.id }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        const mapped = mapTwitterJoinApiError(data);
        setTwitterJoinError(mapped);
        if (mapped.kind === "generic") {
          toast({
            title: "Could not join campaign",
            description: mapped.message,
          });
        }
        return;
      }

      toast({
        title: "Joined Twitter Campaign",
        description: "You have successfully joined this Twitter (X) campaign.",
      });

      setHasJoinedTwitterCampaign(true);
    } catch (err: any) {
      const message =
        err?.message ||
        "Something went wrong. Please try again in a few moments.";
      setTwitterJoinError({ kind: "generic", message });
      toast({
        title: "Could not join campaign",
        description: message,
      });
    } finally {
      setJoinCampaignLoading(false);
    }
  };

  const handleViewSubmission = (submissionId: string) => {
    router.push(`/dashboard/submissions`);
  };

  // Helper to format time ago

  // Show loading state ONLY when fetching data (loading state)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[76vh]">
        {/* <div className="text-center">
          <p>Loading contest details...</p>
        </div> */}

        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  if (restrictedPreview) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <RestrictedCampaignPreview
          preview={restrictedPreview}
          onChanged={async () => {
            try {
              const { preview } = await applicationsApi.preview(contestId);
              if (preview.has_access) {
                window.location.reload();
                return;
              }
              setRestrictedPreview(preview);
            } catch {
              window.location.reload();
            }
          }}
        />
      </div>
    );
  }

  if (isUnavailable) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-purple-100 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-950/40">
            <Lock className="h-6 w-6 text-[#4A00BE] dark:text-purple-300" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            This campaign is private or unavailable
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            It may be invite-only, not published yet, or no longer running. If a
            brand invited you, open their invite link to join.
          </p>
          <Button
            className="mt-6 w-full bg-[#4A00BE] text-white hover:bg-[#4A00BE]/90"
            onClick={() => router.push("/dashboard/opportunities")}
          >
            Browse campaigns
          </Button>
        </div>
      </div>
    );
  }

  // Error UI handling (check error or missing contest AFTER loading is false)
  if (!loading && (error || !contest)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500">
            {error || "Failed to load contest details"}
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push("/dashboard/opportunities")}
          >
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const handleShare = async () => {
    if (contest.status === "ended") {
      toast({
        title: "Opportunity Completed",
        description:
          "This opportunity has ended. You can still share it to showcase the results and winners.",
        variant: "default",
      });
      // Allow sharing to proceed for completed opportunities
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
    try {
      if (navigator.share) {
        await navigator.share({
          title: contest.title,
          text: `Check out this opportunity: ${contest.title}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "Opportunity link copied to clipboard!",
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

  const titleClass = cn(
    "font-semibold tracking-tight",
    isDark ? "text-white" : "text-[#0a0a0a]",
  );
  const mutedClass = cn(isDark ? "text-slate-300" : "text-[#737373]");
  const surfaceClass = cn(
    "rounded-[20px] border shadow-[0px_2px_12px_0px_rgba(10,10,10,0.04)]",
    isDark ? "border-slate-700 bg-[#180438]" : "border-[#e5e5e5] bg-white",
  );
  const outlineButtonClass = cn(
    "h-10 rounded-xl px-4 text-sm font-medium shadow-none",
    isDark
      ? "border-slate-600 bg-transparent text-slate-100 hover:bg-white/10"
      : "border-[#e5e5e5] bg-white text-[#0a0a0a] hover:bg-neutral-50",
  );
  const primaryButtonClass =
    "h-11 w-full rounded-xl border border-transparent bg-[#0a0a0a] px-5 text-sm font-semibold text-white hover:bg-[#171717]";
  const disabledButtonClass = cn(
    "h-11 w-full cursor-not-allowed rounded-xl border px-5 text-sm font-semibold shadow-none",
    isDark
      ? "border-white/10 bg-white/5 text-white/40 hover:bg-white/5"
      : "border-transparent bg-[#f5f5f5] text-[#a3a3a3] hover:bg-[#f5f5f5]",
  );

  // Render main content
  return (
    <div className="w-full">
      <div>
        <WelcomeBanner isDark={isDark} />
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="outline"
            className={cn(outlineButtonClass, "gap-2")}
            onClick={() => router.push("/dashboard/opportunities")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Campaigns</span>
          </Button>
          <Button
            variant="outline"
            className={cn(outlineButtonClass, "gap-2")}
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>

        <ContestDetailsCover
          isDark={isDark}
          title={contest.title}
          thumbnailUrl={contest.thumbnail_url}
          status={contest.status}
          contestType={contest.contest_type}
          contestTypeLabel={contestTypeDisplayLabel(contest.contest_type)}
          dateRangeLabel={
            contest.start_date && contest.end_date
              ? `${formatLocalDateTime(contest.start_date, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })} – ${formatLocalDateTime(contest.end_date, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`
              : ""
          }
          durationLabel={(() => {
            if (!contest.start_date || !contest.end_date) return "Not specified";
            const start = new Date(contest.start_date);
            const end = new Date(contest.end_date);
            const diffDays = Math.ceil(
              Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
            );
            return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
          })()}
          durationSubLabel={
            contest.start_date && contest.end_date
              ? `${formatLocalDateTime(contest.start_date, {
                  month: "short",
                  day: "numeric",
                })} – ${formatLocalDateTime(contest.end_date, {
                  month: "short",
                  day: "numeric",
                })}`
              : "Dates TBD"
          }
          budgetLabel={
            contest.contest_type === "cpm" ||
            contest.contest_type === "milestone" ||
            contest.contest_type === "dual_rewards"
              ? "Total Budget"
              : "Prize Pool"
          }
          budgetValue={
            contest.contest_type === "leaderboard"
              ? formatMoney(leaderboardPrizePoolCents)
              : contest.contest_type === "cpm" ||
                  contest.contest_type === "milestone" ||
                  contest.contest_type === "dual_rewards"
                ? formatMoney(contestPoolBudgetCents)
                : contest.total_prize
                  ? formatMoney(contest.total_prize || 0)
                  : "$0.00"
          }
          budgetSubLabel={
            contest.contest_type === "leaderboard" &&
            leaderboardWinnerCountDisplay > 0
              ? `${leaderboardWinnerCountDisplay} winner${
                  leaderboardWinnerCountDisplay !== 1 ? "s" : ""
                }`
              : isCpmContestType(contest.contest_type) &&
                  contest.contest_based_details?.cpm_contest?.cpm_rate_usd
                ? `${formatMoney(
                    contest.contest_based_details.cpm_contest.cpm_rate_usd * 100,
                  )} ${
                    contest.platform?.toLowerCase() === "twitter"
                      ? "per 1000 points"
                      : "per 1000 views"
                  }`
                : null
          }
          platformLabel={platformDisplayLabel(
            detailVideoPlatforms.length > 0
              ? detailVideoPlatforms
              : parseVideoContestPlatforms(contest.platform),
            contest.platform,
          )}
          platformSubLabel={
            detailVideoPlatforms.length > 1
              ? "Multi-platform"
              : contest.platform?.toLowerCase() === "instagram"
                ? "Reels & Shorts"
                : contest.platform?.toLowerCase() === "youtube"
                  ? "Shorts & Videos"
                  : contest.platform?.toLowerCase() === "tiktok"
                    ? "TikTok videos"
                    : null
          }
          platforms={
            detailVideoPlatforms.length > 0
              ? detailVideoPlatforms
              : parseVideoContestPlatforms(contest.platform)
          }
          submissionsLabel={
            (contest?.platform?.toLowerCase() === "twitter" ||
              contest?.platform?.toLowerCase() === "x") &&
            contest?.contest_format === "text_image"
              ? "Participants"
              : "Submissions"
          }
          submissionsValue={
            (contest?.platform?.toLowerCase() === "twitter" ||
              contest?.platform?.toLowerCase() === "x") &&
            contest?.contest_format === "text_image"
              ? twitterMetrics?.max_participants
                ? `${twitterMetrics?.total_participants || 0} / ${twitterMetrics.max_participants}`
                : twitterMetrics?.total_participants ||
                  contest?.contest_based_details?.twitter_campaign
                    ?.max_participants ||
                  0
              : creatorDetailSubmissionTotal
          }
          submissionsSubLabel={
            (contest?.platform?.toLowerCase() === "twitter" ||
              contest?.platform?.toLowerCase() === "x") &&
            contest?.contest_format === "text_image"
              ? twitterMetrics?.max_participants
                ? "Joined / Max limit"
                : "Total joined"
              : "Total entries"
          }
          statusChip={
            contest.status === "ended" && postContestStatus
              ? renderPostContestStatusBadge(postContestStatus)
              : null
          }
          extraBadges={(() => {
            const isTwitterTextImage =
              (contest.platform?.toLowerCase() === "twitter" ||
                contest.platform?.toLowerCase() === "x") &&
              contest.contest_format === "text_image";
            if (!isTwitterTextImage) return null;
            const campaignType =
              contest.contest_based_details?.twitter_campaign?.campaign_type;
            if (campaignType !== "raid" && campaignType !== "awareness")
              return null;
            return (
              <Badge
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold capitalize shadow-none",
                  isDark
                    ? "border-slate-600 bg-transparent text-slate-100"
                    : "border-[#e5e5e5] bg-white text-[#0a0a0a]",
                )}
              >
                {campaignType === "raid" ? "Raid Campaign" : "Awareness Campaign"}
              </Badge>
            );
          })()}
          cta={
            <Button
              size="lg"
              onClick={
                isTwitterTextImageContest && !hasJoinedTwitterCampaign
                  ? handleJoinTwitterCampaign
                  : () => handleSubmitContent("1")
              }
              disabled={
                contest.status?.toLowerCase() !== "active" ||
                isRequirementsBlocked ||
                joinCampaignLoading ||
                (hasSubmitted &&
                  !(
                    submissionCount > 0 &&
                    contest?.multiple_submissions_enabled &&
                    submissionCount < maxSubmissions
                  )) ||
                (isTwitterTextImageContest && hasJoinedTwitterCampaign) ||
                (!!user &&
                  isTwitterTextImageContest &&
                  !hasJoinedTwitterCampaign &&
                  (twitterConnectStatus === "disconnected" ||
                    twitterConnectStatus === "loading"))
              }
              className={cn(
                "w-full",
                contest.status?.toLowerCase() === "active" &&
                  !isRequirementsBlocked &&
                  !joinCampaignLoading &&
                  !(
                    hasSubmitted &&
                    !(
                      submissionCount > 0 &&
                      contest?.multiple_submissions_enabled &&
                      submissionCount < maxSubmissions
                    )
                  ) &&
                  !(isTwitterTextImageContest && hasJoinedTwitterCampaign)
                  ? primaryButtonClass
                  : disabledButtonClass,
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <PlayCircle className="h-5 w-5 shrink-0" />
                {contest.status?.toLowerCase() === "upcoming"
                  ? "Contest Not Started"
                  : contest.status?.toLowerCase() === "ended" ||
                      contest.status?.toLowerCase() === "completed"
                    ? "Contest Ended"
                    : hasSubmitted &&
                        submissionCount > 0 &&
                        contest?.multiple_submissions_enabled &&
                        submissionCount < maxSubmissions
                      ? `Submit More (${maxSubmissions - submissionCount} left)`
                      : hasSubmitted
                        ? "Submitted"
                        : isTwitterTextImageContest
                          ? hasJoinedTwitterCampaign
                            ? "Joined"
                            : joinCampaignLoading
                              ? "Joining..."
                              : user && twitterConnectStatus === "loading"
                                ? "Checking…"
                                : "Join Twitter Campaign"
                          : "Submit Your Entry"}
              </span>
            </Button>
          }
        />

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-x-6">
          <div
            className={cn(
              "space-y-6 empty:hidden",
              activeTab === "details"
                ? "mb-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:mb-0 lg:self-start"
                : "mb-6 lg:col-span-2 lg:col-start-1 lg:row-start-1",
            )}
          >
            {activeTab === "details" && (
              <Card
                className={cn(
                  "overflow-hidden rounded-[20px] border shadow-[0px_2px_12px_0px_rgba(10,10,10,0.04)]",
                  isDark
                    ? "border-slate-700 bg-[#180438]"
                    : "border-[#e5e5e5] bg-white",
                )}
              >
                <CardContent className="relative p-[22px] text-left">
                  {/* Decorative background elements */}
                  {/* <div className="absolute top-0 left-0 w-32 h-32 bg-rose-200/30 dark:from-rose-500/10 dark:to-purple-500/10 rounded-full blur-xl transform -translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-blue-200/30 to-cyan-200/30 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-full blur-xl transform translate-x-20 translate-y-20"></div> */}

                  <div className="relative z-10">
                    {hasSubmitted ? (
                      <div className="flex flex-col items-start">
                        <div className="relative mb-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <CheckCircle className="h-7 w-7" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              ✓
                            </span>
                          </div>
                        </div>
                        <p
                          className={cn(
                            "text-base font-semibold mb-1",
                            isDark ? "text-slate-200" : "text-slate-700",
                          )}
                        >
                          Submission Complete!
                        </p>
                        <p
                          className={cn(
                            "text-sm mb-1",
                            isDark ? "text-slate-300" : "text-slate-600",
                          )}
                        >
                          You have successfully submitted for this opportunity
                        </p>
                        <p
                          className={cn(
                            "text-sm",
                            isDark ? "text-slate-300" : "text-slate-500",
                          )}
                        >
                          {(contest?.platform?.toLowerCase() === "twitter" ||
                          contest?.platform?.toLowerCase() === "x"
                            ? "Joined "
                            : "Submitted ") +
                            formatTimeAgo(
                              contest?.platform?.toLowerCase() === "twitter" ||
                                contest?.platform?.toLowerCase() === "x"
                                ? (existingSubmission as any)?.joined_at ||
                                    existingSubmission.created_at ||
                                    null
                                : existingSubmission.created_at,
                            )}
                        </p>
                      </div>
                    ) : submissionCount > 0 &&
                      contest?.multiple_submissions_enabled ? (
                      <div className="flex flex-col items-start">
                        <div className="relative mb-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff7a1a]/10 text-[#ff7a1a]">
                            <CheckCircle className="h-7 w-7" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {submissionCount}
                            </span>
                          </div>
                        </div>
                        <p
                          className={cn(
                            "text-base font-semibold mb-1",
                            isDark ? "text-slate-200" : "text-slate-700",
                          )}
                        >
                          Submissions in Progress
                        </p>
                        <p
                          className={cn(
                            "text-sm mb-1",
                            isDark ? "text-slate-300" : "text-slate-600",
                          )}
                        >
                          You have submitted {submissionCount} out of{" "}
                          {maxSubmissions} videos
                        </p>
                        <p
                          className={cn(
                            "text-sm mb-4",
                            isDark ? "text-slate-300" : "text-slate-500",
                          )}
                        >
                          You can still submit{" "}
                          {maxSubmissions - submissionCount} more videos
                        </p>

                        {/* Submit Button for Partial Submissions */}
                        <Button
                          size="lg"
                          onClick={() => handleSubmitContent("2")}
                          disabled={
                            contest.status?.toLowerCase() !== "active" ||
                            isRequirementsBlocked
                          }
                          className={cn(
                            contest.status?.toLowerCase() === "active"
                              ? isRequirementsBlocked
                                ? cn(
                                    primaryButtonClass,
                                    "cursor-not-allowed opacity-60",
                                  )
                                : primaryButtonClass
                              : disabledButtonClass,
                          )}
                        >
                          <span>
                            {contest.status?.toLowerCase() === "active"
                              ? `Submit More Videos (${
                                  maxSubmissions - submissionCount
                                } remaining)`
                              : "Contest Not Active"}
                          </span>
                        </Button>
                        {user && hasCreatorRequirements && (
                          <div className="mt-4 text-left">
                            <CreatorContestRequirementsGate
                              items={requirementItems}
                              loading={requirementsLoading}
                              fetchFailed={requirementsFetchFailed}
                              isDark={isDark}
                              className="mb-0"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="mb-4">
                          <h2
                            className={cn(
                              titleClass,
                              "mb-1 text-base tracking-[-0.16px]",
                            )}
                          >
                            Ready to Showcase Your Talent?
                          </h2>
                          <p
                            className={cn(
                              "text-[13px] leading-relaxed",
                              isDark ? "text-slate-300" : "text-[#737373]",
                            )}
                          >
                            {contest.status === "active"
                              ? "The stage is yours! Submit your content and let your creativity shine."
                              : contest.status === "upcoming"
                                ? "Get ready! This opportunity hasn't started yet, but you can prepare."
                                : "This opportunity has ended or is no longer active."}
                          </p>
                        </div>

                        {user &&
                          contest.status?.toLowerCase() === "active" &&
                          isTwitterTextImageContest &&
                          !hasJoinedTwitterCampaign &&
                          twitterConnectStatus === "disconnected" && (
                            <Alert
                              variant="default"
                              className="mb-4 border border-[#ffd9b8] bg-white text-left"
                            >
                              <AlertDescription
                                className={cn(
                                  "text-sm",
                                  isDark ? "text-gray-200" : "text-gray-700",
                                )}
                              >
                                Connect your X (Twitter) account in Settings
                                before you can join this campaign.
                              </AlertDescription>
                              <Link href="/dashboard/settings">
                                <Button
                                  variant="link"
                                  className="mt-1 h-auto p-0 text-[#ff7a1a]"
                                >
                                  Connect X in Settings
                                </Button>
                              </Link>
                            </Alert>
                          )}

                        {user &&
                          contest.status?.toLowerCase() === "active" &&
                          isTwitterTextImageContest &&
                          !hasJoinedTwitterCampaign &&
                          twitterConnectStatus === "loading" && (
                            <p
                              className={cn(
                                "text-sm mb-3",
                                isDark ? "text-slate-400" : "text-slate-600",
                              )}
                            >
                              Checking your X connection…
                            </p>
                          )}

                        <Button
                          size="lg"
                          onClick={
                            isTwitterTextImageContest &&
                            !hasJoinedTwitterCampaign
                              ? handleJoinTwitterCampaign
                              : () => handleSubmitContent("2")
                          }
                          disabled={
                            contest.status?.toLowerCase() !== "active" ||
                            isRequirementsBlocked ||
                            joinCampaignLoading ||
                            (isTwitterTextImageContest &&
                              hasJoinedTwitterCampaign) ||
                            (!!user &&
                              isTwitterTextImageContest &&
                              !hasJoinedTwitterCampaign &&
                              (twitterConnectStatus === "disconnected" ||
                                twitterConnectStatus === "loading"))
                          }
                          className={cn(
                            contest.status?.toLowerCase() === "active"
                              ? isRequirementsBlocked
                                ? cn(
                                    primaryButtonClass,
                                    "cursor-not-allowed opacity-60",
                                  )
                                : primaryButtonClass
                              : disabledButtonClass,
                          )}
                        >
                          <span className="flex items-center gap-3">
                            {contest.status?.toLowerCase() === "upcoming" ? (
                              <>
                                <Clock className="h-4 w-4" />
                                <span>Contest Not Started</span>
                              </>
                            ) : contest.status?.toLowerCase() === "ended" ||
                              contest.status?.toLowerCase() === "completed" ? (
                              <>
                                <Calendar className="h-4 w-4" />
                                <span>Contest Ended</span>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <PlayCircle className="h-4 w-4" />
                                  <span>
                                    {isTwitterTextImageContest
                                      ? hasJoinedTwitterCampaign
                                        ? "Joined"
                                        : joinCampaignLoading
                                          ? "Joining..."
                                          : user &&
                                              twitterConnectStatus === "loading"
                                            ? "Checking…"
                                            : "Join Twitter Campaign"
                                      : "Submit Your Entry!"}
                                  </span>
                                </div>
                              </>
                            )}
                          </span>
                        </Button>
                        {user && hasCreatorRequirements && (
                          <div className="mt-4 text-left">
                            <CreatorContestRequirementsGate
                              items={requirementItems}
                              loading={requirementsLoading}
                              fetchFailed={requirementsFetchFailed}
                              isDark={isDark}
                              className="mb-0"
                            />
                          </div>
                        )}

                        {user &&
                          twitterJoinError &&
                          contest.status?.toLowerCase() === "active" &&
                          isTwitterTextImageContest &&
                          !hasJoinedTwitterCampaign && (
                            <Alert
                              variant={
                                twitterJoinError.kind === "generic"
                                  ? "destructive"
                                  : "default"
                              }
                              className={cn(
                                "mt-4 text-left",
                                twitterJoinError.kind !== "generic" &&
                                  "border border-[#ffd9b8] bg-white",
                              )}
                            >
                              <AlertDescription
                                className={cn(
                                  "text-sm",
                                  twitterJoinError.kind === "generic"
                                    ? ""
                                    : isDark
                                      ? "text-gray-200"
                                      : "text-gray-700",
                                )}
                              >
                                {twitterJoinError.message}
                              </AlertDescription>
                              {(twitterJoinError.kind === "not_connected" ||
                                twitterJoinError.kind === "bio") && (
                                <Link href="/dashboard/settings">
                                  <Button
                                    variant="link"
                                    className="mt-1 h-auto p-0 text-[#ff7a1a]"
                                  >
                                    {twitterJoinError.kind === "bio"
                                      ? "Open Settings to update X bio"
                                      : "Connect X in Settings"}
                                  </Button>
                                </Link>
                              )}
                            </Alert>
                          )}

                        {user &&
                          contest.status?.toLowerCase() === "active" &&
                          isTwitterTextImageContest &&
                          !hasJoinedTwitterCampaign &&
                          twitterConnectStatus === "disconnected" && (
                            <p
                              className={cn(
                                "text-xs mt-2",
                                isDark ? "text-slate-400" : "text-slate-600",
                              )}
                            >
                              After you connect X in Settings, come back here
                              and tap Join.
                            </p>
                          )}

                        {contest.status?.toLowerCase() === "active" && (
                          <div
                            className={cn(
                              "text-sm mt-4 flex items-center gap-2",
                              isDark ? "text-white" : "text-black",
                            )}
                          >
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            Contest is live! Join now to compete
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "details" && showCreatorEligibilitySection && (
              <div
                id="creator-eligibility"
                ref={(el) => {
                  sectionRefs.current["creator-eligibility"] = el;
                }}
              >
                <BrandOverviewSectionCard
                  isDark={isDark}
                  title="Creator Eligibility"
                  subtitle="Minimum creator requirements to submit to this campaign."
                  icon={
                    <img
                      src="/images/contest-details/guide-alert.svg"
                      alt=""
                      className="h-4 w-4"
                    />
                  }
                >
                  <div className="grid grid-cols-1 gap-0">
                    {eligibilityDisplayItems.map((item) => (
                      <EligibilityRequirementCard
                        key={item.key}
                        icon={item.icon}
                        label={item.label}
                        value={item.value}
                        description={item.description}
                        isDark={isDark}
                      />
                    ))}
                  </div>
                </BrandOverviewSectionCard>
              </div>
            )}

            {/* Post-Contest Status Section for Ended Contests */}
            {/* {contest.status === "ended" && postContestStatus && (
          <Card className={cn("overflow-hidden shadow-none", surfaceClass)}>
            <CardHeader
              className={cn(
                "border-b",
                isDark ? "border-slate-700" : "border-neutral-200",
              )}
            >
              <CardTitle className={cn(titleClass, "flex items-center gap-3 text-base")}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff7a1a]/10 text-[#ff7a1a]">
                  <FileText className="h-5 w-5" />
                </div>
                <span>Contest Status Update</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex flex-col gap-4">
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h3
                      className={cn(
                        "text-lg font-semibold transition-colors duration-300",
                        isDark ? "text-slate-100" : "text-slate-900",
                      )}
                    >
                      Current Status:
                    </h3>
                    <div className="flex-shrink-0">
                      {renderPostContestStatusBadge(postContestStatus)}
                    </div>
                  </div>
                  <p
                    className={cn(
                      "leading-relaxed transition-colors duration-300",
                      isDark ? "text-slate-300" : "text-slate-700",
                    )}
                  >
                    {getPostContestStatusDescription(postContestStatus)}
                  </p>
                  {postContestStatus === "payouts_processed" && (
                    <div
                      className={cn(
                        "mt-4 p-4 rounded-xl border-2 transition-all duration-300",
                        isDark
                          ? "bg-green-900/30 border-green-700/50"
                          : "bg-green-50 border-green-200/80",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 transition-colors duration-300",
                          isDark ? "text-green-200" : "text-green-800",
                        )}
                      >
                        <div
                          className={cn(
                            "p-1.5 rounded-full transition-all duration-300",
                            isDark ? "bg-green-500/20" : "bg-green-100/80",
                          )}
                        >
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="font-semibold">Contest Complete!</span>
                      </div>
                      <p
                        className={cn(
                          "text-sm mt-2 transition-colors duration-300",
                          isDark ? "text-green-300/90" : "text-green-700/90",
                        )}
                      >
                        All verification and payout processes have been
                        completed for this contest.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <div
                    className={cn(
                      "rounded-2xl border p-6",
                      isDark
                        ? "border-slate-700 bg-[#12032c]"
                        : "border-neutral-200 bg-[#f6f6f7]",
                    )}
                  >
                    <div className="text-center space-y-2">
                      <div
                        className={cn(
                          "text-xs font-semibold uppercase tracking-wider transition-colors duration-300",
                          isDark ? "text-slate-400" : "text-slate-600",
                        )}
                      >
                        Contest Ended
                      </div>
                      <div
                        className={cn(
                          "text-lg font-bold transition-colors duration-300",
                          isDark ? "text-slate-100" : "text-slate-900",
                        )}
                      >
                        {contest.end_date
                          ? formatLocalDateTime(contest.end_date, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Date not specified"}
                      </div>
                      {contest.end_date && (
                        <div
                          className={cn(
                            "text-xs transition-colors duration-300",
                            isDark ? "text-slate-500" : "text-slate-500",
                          )}
                        >
                          {formatLocalDateTime(contest.end_date, {
                            weekday: "long",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )} */}
          </div>
          <div
            className={cn(
              "min-w-0",
              activeTab === "details"
                ? "lg:col-start-1 lg:row-start-1"
                : "lg:col-span-2 lg:row-start-2",
            )}
          >
            {/* Tabs — Figma segmented control */}
            <div className="mb-6 mt-2 overflow-x-auto">
            <div
              className={cn(
                "inline-flex min-w-0 items-center gap-0.5 rounded-xl p-1",
                isDark ? "bg-white/[0.06]" : "bg-[#f5f5f5]",
              )}
            >
              {tabs.map((tab) => {
                const selected = activeTab === tab.id;
                const TabIcon =
                  tab.id === "details"
                    ? FileText
                    : tab.id === "leaderboard"
                      ? Trophy
                      : null;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-[9px] px-[18px] py-[9px] text-[13px] transition-colors",
                      selected
                        ? isDark
                          ? "bg-white/10 font-semibold text-white shadow-[0px_1px_6px_0px_rgba(10,10,10,0.1)]"
                          : "bg-white font-semibold text-[#0a0a0a] shadow-[0px_1px_6px_0px_rgba(10,10,10,0.1)]"
                        : isDark
                          ? "font-medium text-slate-400 hover:text-white"
                          : "font-medium text-[#737373] hover:text-[#0a0a0a]",
                    )}
                  >
                    {TabIcon ? (
                      <TabIcon className="h-[15px] w-[15px] shrink-0" />
                    ) : null}
                    {tab.label}
                    {tab.id === "leaderboard" &&
                      contest?.contest_type === "leaderboard" &&
                      totalLeaderboardEntries > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "ml-1 px-2 py-0.5 text-xs font-semibold",
                            isDark
                              ? "bg-white/10 text-slate-100"
                              : "bg-[#f5f5f5] text-[#404040]",
                          )}
                        >
                          {totalLeaderboardEntries}
                        </Badge>
                      )}
                  </button>
                );
              })}
            </div>
            </div>

            {/* <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="details">Contest Details</TabsTrigger>
            <TabsTrigger value="leaderboard">
              Leaderboard{" "}
              {contest?.contest_type === "leaderboard" &&
                totalLeaderboardEntries > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
                  >
                    {totalLeaderboardEntries}
                  </Badge>
                )}
            </TabsTrigger>
          </TabsList> */}

            <TabContent activeTab={activeTab}>
              <TabPanel value="details" activeTab={activeTab}>
                <div className="min-w-0 space-y-5">
                  {/* Anchor tabs — Figma underline nav */}
                  {activeTab === "details" && contest && (
                    <div
                      className={cn(
                        "sticky top-16 z-40 -mx-1 overflow-x-auto border-b px-1 lg:top-24",
                        isDark
                          ? "border-slate-700 bg-[#06021D]/95 backdrop-blur"
                          : "border-[#e5e5e5] bg-[#f6f6f7]/95 backdrop-blur",
                      )}
                    >
                      <div className="flex w-full min-w-0 items-stretch">
                        {visibleSections.map((section) => {
                          const selected = activeSection === section.id;
                          return (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => scrollToSection(section.id)}
                              className={cn(
                                "relative shrink-0 whitespace-nowrap px-3 py-3.5 text-[13px] outline-none transition-colors",
                                selected
                                  ? isDark
                                    ? "font-semibold text-white"
                                    : "font-semibold text-[#0a0a0a]"
                                  : isDark
                                    ? "font-medium text-slate-400 hover:text-white"
                                    : "font-medium text-[#737373] hover:text-[#0a0a0a]",
                              )}
                            >
                              {section.label}
                              <span
                                className={cn(
                                  "absolute inset-x-0 bottom-0 h-0.5 rounded-full",
                                  selected
                                    ? isDark
                                      ? "bg-white"
                                      : "bg-[#0a0a0a]"
                                    : "bg-transparent",
                                )}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      "opp-orange min-w-0 space-y-5 overflow-hidden",
                    )}
                  >
                    <style jsx global>{`
                      .opp-orange [class*="bg-gradient"] {
                        background-image: none !important;
                        background-color: rgba(127, 127, 127, 0.06) !important;
                      }
                      .opp-orange [class~="text-blue-900"],
                      .opp-orange [class~="text-blue-700"],
                      .opp-orange [class~="text-pink-900"],
                      .opp-orange [class~="text-pink-700"] {
                        color: inherit !important;
                      }
                      .opp-orange [class~="border-blue-200"],
                      .opp-orange [class~="border-pink-200"],
                      .opp-orange [class~="border-blue-500/30"],
                      .opp-orange [class~="border-pink-500/30"],
                      .opp-orange [class~="border-blue-500/20"],
                      .opp-orange [class~="border-pink-500/20"] {
                        border-color: rgba(127, 127, 127, 0.28) !important;
                      }
                      .opp-orange [class~="bg-blue-100"],
                      .opp-orange [class~="bg-pink-100"],
                      .opp-orange [class~="bg-blue-900/40"],
                      .opp-orange [class~="bg-pink-900/40"] {
                        background-color: rgba(127, 127, 127, 0.1) !important;
                      }
                      .opp-orange [class~="text-purple-500"],
                      .opp-orange [class~="text-purple-600"],
                      .opp-orange [class~="text-purple-700"],
                      .opp-orange [class~="text-purple-800"],
                      .opp-orange [class~="text-[#4A00BE]"],
                      .opp-orange [class~="text-[#7F39EC]"],
                      .opp-orange [class~="text-[#6C43D0]"] {
                        color: #ff7a1a !important;
                      }
                      .opp-orange [class~="text-purple-200"],
                      .opp-orange [class~="text-purple-300"],
                      .opp-orange [class~="text-purple-400"] {
                        color: #ffa35c !important;
                      }
                      .opp-orange [class~="bg-purple-50"],
                      .opp-orange [class~="bg-purple-50/80"],
                      .opp-orange [class~="bg-purple-100"],
                      .opp-orange [class~="bg-purple-200"] {
                        background-color: #fff1e6 !important;
                      }
                      .opp-orange [class~="bg-purple-900/40"],
                      .opp-orange [class~="bg-purple-900/20"],
                      .opp-orange [class~="bg-purple-500/10"],
                      .opp-orange [class~="bg-purple-500/20"] {
                        background-color: rgba(255, 122, 26, 0.12) !important;
                      }
                      .opp-orange [class~="bg-purple-500"],
                      .opp-orange [class~="bg-purple-600"],
                      .opp-orange [class~="bg-[#6C43D0]"],
                      .opp-orange [class~="bg-[#4A00BE]"],
                      .opp-orange [class~="bg-[#7F39EC]"] {
                        background-color: #ff7a1a !important;
                      }
                      .opp-orange [class~="border-purple-100"],
                      .opp-orange [class~="border-purple-200"],
                      .opp-orange [class~="border-purple-200/80"],
                      .opp-orange [class~="border-purple-300"],
                      .opp-orange [class~="border-purple-400"],
                      .opp-orange [class~="border-purple-600"] {
                        border-color: #ffd9b8 !important;
                      }
                      .opp-orange [class~="border-purple-400/50"],
                      .opp-orange [class~="border-purple-500/20"],
                      .opp-orange [class~="border-purple-500/50"],
                      .opp-orange [class~="border-purple-700/50"] {
                        border-color: rgba(255, 122, 26, 0.35) !important;
                      }
                    `}</style>
                    {detailVideoPlatforms.length >= 2 && (
                      <div
                        className={cn(
                          surfaceClass,
                          "flex flex-wrap items-center justify-between gap-3 px-5 py-4",
                        )}
                      >
                        <p className={cn(titleClass, "text-sm font-semibold")}>
                          Platform scope
                        </p>
                        <ContestDetailPlatformTabs
                          platforms={detailVideoPlatforms}
                          active={detailPlatformTab}
                          onChange={setDetailPlatformTab}
                          isDark={isDark}
                        />
                      </div>
                    )}
                    <div className="space-y-5">
                      {/* 1. EARNINGS OVERVIEW - Clean Card Design */}
                      <div
                        id="earning-opportunities"
                        ref={(el) => {
                          sectionRefs.current["earning-opportunities"] = el;
                        }}
                        className={cn(surfaceClass, "empty:hidden overflow-hidden")}
                      >
                        <div className="p-7">
                          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                            <div className="flex flex-1 items-center gap-3.5 sm:gap-4">
                              <div
                                className={cn(
                                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                  isDark
                                    ? "bg-white/10 text-white"
                                    : "bg-[#f5f5f5] text-[#0a0a0a]",
                                )}
                              >
                                <DollarSign className="h-5 w-5" />
                              </div>

                              <div className="flex-1">
                                <h3
                                  className={cn(
                                    titleClass,
                                    "mb-0.5 text-xl tracking-[-0.3px]",
                                  )}
                                >
                                  Earning Opportunities
                                </h3>
                                <p
                                  className={cn(
                                    "text-[13px]",
                                    isDark ? "text-slate-300" : "text-[#737373]",
                                  )}
                                >
                                  {detailContest?.contest_type === "cpm"
                                    ? "Performance-based earnings"
                                    : detailContest?.contest_type ===
                                        "milestone"
                                      ? "Milestone-based rewards"
                                      : detailContest?.contest_type ===
                                          "dual_rewards"
                                        ? "CPM pay plus milestone unlocks"
                                        : "Competition-based prizes"}
                                </p>
                              </div>
                            </div>
                            {/* Platform Badge */}
                            <div
                              className={cn(
                                "flex flex-shrink-0 items-center gap-1.5 self-start rounded-full py-[7px] pl-3 pr-3.5 sm:self-auto",
                                isDark
                                  ? "bg-white/10"
                                  : "bg-[#f5f5f5]",
                              )}
                            >
                              {detailScopedPlatform ? (
                                getPlatformIcon(detailScopedPlatform, "sm")
                              ) : detailVideoPlatforms.length >= 2 ? (
                                <Monitor className="h-5 w-5 text-slate-600" />
                              ) : contest.platform?.toLowerCase() ===
                                "youtube" ? (
                                <Youtube className="h-5 w-5 text-red-600" />
                              ) : contest.platform?.toLowerCase() ===
                                "instagram" ? (
                                <Instagram className="h-5 w-5 text-[#ff7a1a]" />
                              ) : contest.platform?.toLowerCase() ===
                                "tiktok" ? (
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-5 w-5"
                                  fill="#000000"
                                >
                                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.18z" />
                                </svg>
                              ) : (
                                <Share2 className="h-5 w-5 text-slate-600" />
                              )}
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  isDark ? "text-white" : "text-[#0a0a0a]",
                                )}
                              >
                                {detailPlatformLabel}
                              </span>
                            </div>
                          </div>

                          {detailVideoPlatforms.length >= 2 && (
                            <div className="mb-6 space-y-4">
                              {detailPayoutGroups.map((group) => {
                                const payoutContest =
                                  group.contestPlatform != null
                                    ? buildDetailPayoutContest(
                                        group.contestPlatform,
                                      )
                                    : detailUniformPayoutContest;
                                if (!payoutContest) return null;
                                return (
                                  <div
                                    key={group.platforms.join("-") || "primary"}
                                    className="space-y-3"
                                  >
                                    <ContestDetailVideoPayoutSections
                                      contest={payoutContest}
                                      isDark={isDark}
                                      platform={group.contestPlatform}
                                      platforms={group.platforms}
                                      showPlatformLabel={group.showLabels}
                                      sharedPlatformIcons={
                                        detailPlatformTab ===
                                          ALL_PLATFORM_TAB && !group.showLabels
                                          ? detailVideoPlatforms
                                          : undefined
                                      }
                                      winnerCountsByMilestone={winnerCountsByTargetForPlatform(
                                        milestoneDerivedData.winnerCountsByKey,
                                        group.platforms.length > 0
                                          ? group.platforms.join(",")
                                          : group.contestPlatform,
                                      )}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {detailVideoPlatforms.length < 2 && (
                            <div className="space-y-6">
                              {/* Main Earning Information */}
                              <div
                                className={`grid grid-cols-1 gap-4 mb-6 ${
                                  isCpmContestType(contest.contest_type)
                                    ? contest.contest_based_details?.cpm_contest
                                        ?.min_views != null &&
                                      contest.contest_based_details?.cpm_contest
                                        ?.max_views != null
                                      ? "md:grid-cols-2 lg:grid-cols-4"
                                      : "md:grid-cols-2 lg:grid-cols-3"
                                    : "md:grid-cols-2 lg:grid-cols-2"
                                }`}
                              >
                                {/* Pay Rate / Prize Pool / Total Budget */}
                                <div
                                  className={cn(
                                    "rounded-2xl border p-5",
                                    isDark
                                      ? "border-slate-700 bg-[#12032c]"
                                      : "border-neutral-200 bg-white",
                                  )}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="h-4 w-4 text-[#ff7a1a] dark:text-[#ffa35c]" />
                                    <span
                                      className={cn(
                                        "text-sm font-medium",
                                        isDark
                                          ? "text-white"
                                          : "text-slate-600",
                                      )}
                                    >
                                      {isCpmContestType(contest.contest_type) &&
                                      contest.contest_based_details?.cpm_contest
                                        ?.cpm_rate_usd != null
                                        ? "Pay Rate"
                                        : contest.contest_type === "leaderboard"
                                          ? "Prize Pool"
                                          : "Total Budget"}
                                    </span>
                                  </div>
                                  <div
                                    className={cn(
                                      "text-2xl font-bold",
                                      isDark ? "text-white" : "text-slate-900",
                                    )}
                                  >
                                    {isCpmContestType(contest.contest_type) &&
                                    contest.contest_based_details?.cpm_contest
                                      ?.cpm_rate_usd != null
                                      ? formatMoney(
                                          contest.contest_based_details
                                            .cpm_contest.cpm_rate_usd * 100,
                                        )
                                      : contest.contest_type ===
                                            "dual_rewards" &&
                                          contest.contest_based_details
                                        ? formatMoney(contestPoolBudgetCents)
                                        : contest.contest_type === "milestone"
                                          ? formatMoney(contestPoolBudgetCents)
                                          : contest.contest_type ===
                                              "leaderboard"
                                            ? formatMoney(
                                                leaderboardPrizePoolCents,
                                              )
                                            : contest.total_prize
                                              ? formatMoney(
                                                  contest.total_prize || 0,
                                                )
                                              : "$0.00"}
                                  </div>
                                  <div
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-gray-300"
                                        : "text-slate-500",
                                    )}
                                  >
                                    {isCpmContestType(contest.contest_type) &&
                                    contest.contest_based_details?.cpm_contest
                                      ?.cpm_rate_usd != null
                                      ? contest.platform?.toLowerCase() ===
                                        "twitter"
                                        ? "per 1000 points"
                                        : "per 1000 views"
                                      : contest.contest_type === "milestone"
                                        ? "across all milestones"
                                        : contest.contest_type ===
                                            "dual_rewards"
                                          ? "combined prize pool"
                                          : "total prize"}
                                  </div>
                                </div>

                                {/* Total Budget / Winners / Milestones — dual rewards often only store unified pool at root */}
                                {(() => {
                                  const details = contest.contest_based_details;
                                  const hasNestedCpmBudget =
                                    isCpmContestType(contest.contest_type) &&
                                    typeof details?.cpm_contest
                                      ?.total_budget === "number" &&
                                    (details.cpm_contest?.total_budget ?? 0) >
                                      0;
                                  const dualUnifiedCents =
                                    contest.contest_type === "dual_rewards"
                                      ? contestPoolBudgetCents
                                      : 0;
                                  const showDualUnifiedTotal =
                                    contest.contest_type === "dual_rewards" &&
                                    !hasNestedCpmBudget &&
                                    dualUnifiedCents > 0;

                                  const secondCardLabel = hasNestedCpmBudget
                                    ? contest.contest_type === "dual_rewards"
                                      ? "CPM pool"
                                      : "Total Budget"
                                    : showDualUnifiedTotal
                                      ? "Total Budget"
                                      : isMilestoneContestType(
                                            contest.contest_type,
                                          )
                                        ? "Milestones"
                                        : "Winners";

                                  const secondCardValue = hasNestedCpmBudget
                                    ? formatMoney(
                                        details!.cpm_contest!.total_budget!,
                                      )
                                    : showDualUnifiedTotal
                                      ? formatMoney(dualUnifiedCents)
                                      : isMilestoneContestType(
                                            contest.contest_type,
                                          ) && details?.milestone_contest
                                        ? (
                                            details.milestone_contest
                                              .milestones || []
                                          ).length
                                        : contest.contest_type ===
                                              "leaderboard" &&
                                            details?.leaderboard_contest
                                          ? details.leaderboard_contest
                                              .winner_count
                                          : "N/A";

                                  const secondCardHint = hasNestedCpmBudget
                                    ? contest.contest_type === "dual_rewards"
                                      ? "for per-view payouts"
                                      : "in total"
                                    : showDualUnifiedTotal
                                      ? "in total"
                                      : isMilestoneContestType(
                                            contest.contest_type,
                                          )
                                        ? "reward tiers"
                                        : "winners";

                                  return (
                                    <div
                                      className={cn(
                                        "rounded-2xl border p-5",
                                        isDark
                                          ? "border-slate-700 bg-[#12032c]"
                                          : "border-neutral-200 bg-white",
                                      )}
                                    >
                                      <div className="flex items-center gap-2 mb-2">
                                        <Wallet className="h-4 w-4 text-[#ff7a1a] dark:text-[#ffa35c]" />
                                        <span
                                          className={cn(
                                            "text-sm font-medium",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-600",
                                          )}
                                        >
                                          {secondCardLabel}
                                        </span>
                                      </div>
                                      <div
                                        className={cn(
                                          "text-2xl font-bold",
                                          isDark
                                            ? "text-white"
                                            : "text-slate-900",
                                        )}
                                      >
                                        {secondCardValue}
                                      </div>
                                      <div
                                        className={cn(
                                          "text-xs",
                                          isDark
                                            ? "text-gray-300"
                                            : "text-slate-500",
                                        )}
                                      >
                                        {secondCardHint}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* View Requirements for CPM (and dual rewards CPM side) */}
                                {isCpmContestType(contest.contest_type) &&
                                  contest.contest_based_details
                                    ?.cpm_contest && (
                                    <>
                                      {contest.contest_based_details.cpm_contest
                                        .min_views != null && (
                                        <div
                                          className={cn(
                                            "rounded-2xl border p-5",
                                            isDark
                                              ? "border-slate-700 bg-[#12032c]"
                                              : "border-neutral-200 bg-white",
                                          )}
                                        >
                                          <div className="flex items-center gap-2 mb-2">
                                            <Eye className="h-4 w-4 text-[#ff7a1a] dark:text-[#ffa35c]" />
                                            <span
                                              className={cn(
                                                "text-sm font-medium",
                                                isDark
                                                  ? "text-white"
                                                  : "text-slate-600",
                                              )}
                                            >
                                              Min Views
                                            </span>
                                          </div>
                                          <div
                                            className={cn(
                                              "text-2xl font-bold",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900",
                                            )}
                                          >
                                            {contest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                                          </div>
                                          <div
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-gray-300"
                                                : "text-slate-500",
                                            )}
                                          >
                                            required
                                          </div>
                                        </div>
                                      )}
                                      {contest.contest_based_details.cpm_contest
                                        .max_views != null && (
                                        <div
                                          className={cn(
                                            "rounded-2xl border p-5",
                                            isDark
                                              ? "border-slate-700 bg-[#12032c]"
                                              : "border-neutral-200 bg-white",
                                          )}
                                        >
                                          <div className="flex items-center gap-2 mb-2">
                                            <Eye className="h-4 w-4 text-[#ff7a1a] dark:text-[#ffa35c]" />
                                            <span
                                              className={cn(
                                                "text-sm font-medium",
                                                isDark
                                                  ? "text-white"
                                                  : "text-slate-600",
                                              )}
                                            >
                                              Max Views
                                            </span>
                                          </div>
                                          <div
                                            className={cn(
                                              "text-2xl font-bold",
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900",
                                            )}
                                          >
                                            {contest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                                          </div>
                                          <div
                                            className={cn(
                                              "text-xs",
                                              isDark
                                                ? "text-gray-300"
                                                : "text-slate-500",
                                            )}
                                          >
                                            counted
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                              </div>

                              {/* Milestone Details */}
                              {isMilestoneContestType(contest.contest_type) &&
                                (contest.contest_based_details
                                  ?.milestone_contest ||
                                  opportunityMilestoneBonusConfigs.length >
                                    0) && (
                                  <div
                                    className={cn(
                                      "overflow-hidden rounded-2xl border shadow-[0px_1px_3px_0px_rgba(10,10,10,0.04)]",
                                      isDark
                                        ? "border-white/10 bg-[#111113]"
                                        : "border-[#e5e5e5] bg-white",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "flex items-center gap-3 border-b px-5 py-4",
                                        isDark
                                          ? "border-white/10"
                                          : "border-[#e5e5e5]",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                                          isDark ? "bg-white/10" : "bg-[#fafafa]",
                                        )}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src="/images/contest-details/earn-trophy.svg"
                                          alt=""
                                          width={16}
                                          height={16}
                                          className="h-4 w-4"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <h3
                                          className={cn(
                                            "flex items-center gap-2 text-[15px] font-semibold",
                                            isDark ? "text-white" : "text-[#0a0a0a]",
                                          )}
                                        >
                                          Milestone Rewards Ladder
                                        </h3>
                                        <p
                                          className={cn(
                                            "text-sm",
                                            isDark ? "text-slate-400" : "text-[#737373]",
                                          )}
                                        >
                                          Higher view thresholds unlock higher payouts
                                        </p>
                                      </div>
                                    </div>

                                    <div className="space-y-4 px-5 py-5">
                                      {(() => {
                                        const sortedMilestones = (
                                          contest.contest_based_details
                                            ?.milestone_contest?.milestones || []
                                        )
                                          .slice()
                                          .sort(
                                            (a: any, b: any) =>
                                              (a.order || 0) - (b.order || 0),
                                          );
                                        return (
                                          <div className="flex min-w-0 flex-col gap-2.5">
                                            {sortedMilestones.map(
                                              (milestone: any, index: number) => {
                                                const isFinal =
                                                  index === sortedMilestones.length - 1;
                                                const target =
                                                  Number(milestone.target_views) || 0;
                                                const reachedCount =
                                                  milestoneDerivedData.winnerCountsByMilestone?.get(
                                                    Number(milestone.target_views || 0),
                                                  ) || 0;
                                                const payoutLabel = formatMoney(
                                                  milestone.payout_cents || 0,
                                                );
                                                const winnerLimit =
                                                  milestone.winner_limit != null
                                                    ? Number(milestone.winner_limit)
                                                    : null;
                                                const isFull =
                                                  winnerLimit != null &&
                                                  reachedCount >= winnerLimit;

                                                return (
                                                  <div
                                                    key={`${milestone.order ?? index}-${milestone.target_views ?? index}`}
                                                    className={cn(
                                                      "grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-x-4 gap-y-4 overflow-hidden rounded-2xl py-4 pl-5 pr-5 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:pr-6",
                                                      isFinal
                                                        ? "bg-[#0a0a0a] text-white shadow-[0px_10px_20px_0px_rgba(10,10,10,0.2)]"
                                                        : isDark
                                                          ? "border border-white/10 bg-white/[0.04]"
                                                          : "border border-[#e5e5e5] bg-white",
                                                    )}
                                                  >
                                                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center justify-self-start">
                                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                                      <img
                                                        src="/images/contest-details/milestone-hex.svg"
                                                        alt=""
                                                        width={38}
                                                        height={44}
                                                        className="pointer-events-none absolute left-1/2 top-0 h-11 w-[38px] -translate-x-1/2"
                                                      />
                                                      <span className="relative z-10 text-lg font-extrabold text-white">
                                                        {index + 1}
                                                      </span>
                                                    </div>

                                                    <div className="min-w-0 space-y-1">
                                                      <p
                                                        className={cn(
                                                          "text-[11px] font-semibold tracking-[1.1px]",
                                                          isFinal
                                                            ? "text-[#a3a3a3]"
                                                            : isDark
                                                              ? "text-slate-400"
                                                              : "text-[#737373]",
                                                        )}
                                                      >
                                                        MILESTONE {index + 1}
                                                      </p>
                                                      <p
                                                        className={cn(
                                                          "truncate text-xl font-semibold tracking-[-0.3px]",
                                                          isFinal
                                                            ? "text-white"
                                                            : isDark
                                                              ? "text-white"
                                                              : "text-[#0a0a0a]",
                                                        )}
                                                      >
                                                        {target.toLocaleString()} Views
                                                      </p>
                                                      {winnerLimit != null ? (
                                                        <div
                                                          className={cn(
                                                            "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                                            isFinal
                                                              ? "bg-white/12 text-white"
                                                              : isFull
                                                                ? "bg-red-100 text-red-700"
                                                                : isDark
                                                                  ? "bg-white/10 text-slate-200"
                                                                  : "bg-[#f5f5f5] text-[#404040]",
                                                          )}
                                                        >
                                                          Winner limit {reachedCount} / {winnerLimit}
                                                        </div>
                                                      ) : null}
                                                    </div>

                                                    <div className="col-span-2 flex w-full flex-col items-start sm:col-span-1 sm:w-auto sm:items-end">
                                                      <p
                                                        className={cn(
                                                          "text-xs font-medium",
                                                          isFinal
                                                            ? "text-[#a3a3a3]"
                                                            : isDark
                                                              ? "text-slate-400"
                                                              : "text-[#737373]",
                                                        )}
                                                      >
                                                        Payout
                                                      </p>
                                                      <p
                                                        className={cn(
                                                          "whitespace-nowrap text-[26px] font-bold leading-none tracking-[-0.52px]",
                                                          isFinal
                                                            ? "text-white"
                                                            : isDark
                                                              ? "text-white"
                                                              : "text-[#0a0a0a]",
                                                        )}
                                                      >
                                                        {payoutLabel}
                                                      </p>
                                                    </div>
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>
                                        );
                                      })()}

                                      <div
                                        className={cn(
                                          "flex items-start gap-2.5 rounded-xl border px-4 py-3",
                                          isDark
                                            ? "border-white/10 bg-white/[0.04] text-slate-200"
                                            : "border-[#e5e5e5] bg-[#fafafa] text-[#404040]",
                                        )}
                                      >
                                        <Info className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                                        <p className="text-[13px] leading-relaxed">
                                          Once a submission reaches the target
                                          view threshold, the corresponding
                                          milestone reward will be granted.
                                        </p>
                                      </div>

                                      {(opportunityMostVerifiedViewsBonus ||
                                        opportunityMostVerifiedReelsBonus) && (
                                        <div className="space-y-4 pt-2">
                                          <h3
                                            className={cn(
                                              "flex items-center gap-2 text-[15px] font-semibold",
                                              isDark
                                                ? "text-white"
                                                : "text-[#0a0a0a]",
                                            )}
                                          >
                                            <Gift
                                              className={cn(
                                                "h-4 w-4",
                                                isDark
                                                  ? "text-slate-300"
                                                  : "text-[#737373]",
                                              )}
                                            />
                                            Competitive Bonus Tracks
                                          </h3>

                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            {opportunityMostVerifiedViewsBonus && (
                                              <div
                                                className={cn(
                                                  "rounded-xl border p-5",
                                                  isDark
                                                    ? "border-white/10 bg-white/[0.04]"
                                                    : "border-[#e5e5e5] bg-[#fafafa]",
                                                )}
                                              >
                                                <div className="mb-4 flex items-start justify-between">
                                                  <div
                                                    className={cn(
                                                      "rounded-[10px] p-2",
                                                      isDark
                                                        ? "bg-white/10"
                                                        : "border border-[#e5e5e5] bg-white",
                                                    )}
                                                  >
                                                    <Eye
                                                      className={cn(
                                                        "h-5 w-5",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-[#0a0a0a]",
                                                      )}
                                                    />
                                                  </div>
                                                  <Badge
                                                    className={cn(
                                                      "border-none",
                                                      isDark
                                                        ? "bg-white text-[#0a0a0a]"
                                                        : "bg-[#0a0a0a] text-white",
                                                    )}
                                                  >
                                                    {formatMoney(
                                                      opportunityMostVerifiedViewsBonus.payout_cents ||
                                                        0,
                                                    )}
                                                  </Badge>
                                                </div>
                                                <h4
                                                  className={cn(
                                                    "mb-1 text-lg font-bold",
                                                    isDark
                                                      ? "text-white"
                                                      : "text-[#0a0a0a]",
                                                  )}
                                                >
                                                  Most Verified Views
                                                </h4>
                                                <p
                                                  className={cn(
                                                    "text-sm",
                                                    isDark
                                                      ? "text-slate-300"
                                                      : "text-[#404040]",
                                                  )}
                                                >
                                                  Awarded to the creator with the
                                                  highest total verified views.
                                                </p>
                                                {(typeof opportunityMostVerifiedViewsBonus.min_total_views ===
                                                  "number" ||
                                                  typeof opportunityMostVerifiedViewsBonus.min_verified_reels ===
                                                    "number") && (
                                                  <div
                                                    className={cn(
                                                      "mt-4 border-t pt-4",
                                                      isDark
                                                        ? "border-white/10"
                                                        : "border-[#e5e5e5]",
                                                    )}
                                                  >
                                                    <div className="flex items-start justify-between gap-3 text-xs font-semibold">
                                                      <span
                                                        className={cn(
                                                          "uppercase tracking-tighter",
                                                          isDark
                                                            ? "text-slate-400"
                                                            : "text-[#737373]",
                                                        )}
                                                      >
                                                        Eligibility Condition
                                                      </span>
                                                      <div
                                                        className={cn(
                                                          "space-y-1 text-right",
                                                          isDark
                                                            ? "text-slate-200"
                                                            : "text-[#0a0a0a]",
                                                        )}
                                                      >
                                                        {typeof opportunityMostVerifiedViewsBonus.min_total_views ===
                                                          "number" && (
                                                          <div>
                                                            Min.{" "}
                                                            {opportunityMostVerifiedViewsBonus.min_total_views.toLocaleString()}{" "}
                                                            Views
                                                          </div>
                                                        )}
                                                        {typeof opportunityMostVerifiedViewsBonus.min_verified_reels ===
                                                          "number" && (
                                                          <div>
                                                            Min.{" "}
                                                            {opportunityMostVerifiedViewsBonus.min_verified_reels.toLocaleString()}{" "}
                                                            Reels
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {opportunityMostVerifiedReelsBonus && (
                                              <div
                                                className={cn(
                                                  "rounded-xl border p-5",
                                                  isDark
                                                    ? "border-white/10 bg-white/[0.04]"
                                                    : "border-[#e5e5e5] bg-[#fafafa]",
                                                )}
                                              >
                                                <div className="mb-4 flex items-start justify-between">
                                                  <div
                                                    className={cn(
                                                      "rounded-[10px] p-2",
                                                      isDark
                                                        ? "bg-white/10"
                                                        : "border border-[#e5e5e5] bg-white",
                                                    )}
                                                  >
                                                    <Play
                                                      className={cn(
                                                        "h-5 w-5",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-[#0a0a0a]",
                                                      )}
                                                    />
                                                  </div>
                                                  <Badge
                                                    className={cn(
                                                      "border-none",
                                                      isDark
                                                        ? "bg-white text-[#0a0a0a]"
                                                        : "bg-[#0a0a0a] text-white",
                                                    )}
                                                  >
                                                    {formatMoney(
                                                      opportunityMostVerifiedReelsBonus.payout_cents ||
                                                        0,
                                                    )}
                                                  </Badge>
                                                </div>
                                                <h4
                                                  className={cn(
                                                    "mb-1 text-lg font-bold",
                                                    isDark
                                                      ? "text-white"
                                                      : "text-[#0a0a0a]",
                                                  )}
                                                >
                                                  Most Verified Reels
                                                </h4>
                                                <p
                                                  className={cn(
                                                    "text-sm",
                                                    isDark
                                                      ? "text-slate-300"
                                                      : "text-[#404040]",
                                                  )}
                                                >
                                                  Awarded to the creator with the
                                                  most verified reels.
                                                </p>
                                                {(typeof opportunityMostVerifiedReelsBonus.min_verified_reels ===
                                                  "number" ||
                                                  typeof opportunityMostVerifiedReelsBonus.min_total_views ===
                                                    "number") && (
                                                  <div
                                                    className={cn(
                                                      "mt-4 border-t pt-4",
                                                      isDark
                                                        ? "border-white/10"
                                                        : "border-[#e5e5e5]",
                                                    )}
                                                  >
                                                    <div className="flex items-start justify-between gap-3 text-xs font-semibold">
                                                      <span
                                                        className={cn(
                                                          "uppercase tracking-tighter",
                                                          isDark
                                                            ? "text-slate-400"
                                                            : "text-[#737373]",
                                                        )}
                                                      >
                                                        Eligibility Condition
                                                      </span>
                                                      <div
                                                        className={cn(
                                                          "space-y-1 text-right",
                                                          isDark
                                                            ? "text-slate-200"
                                                            : "text-[#0a0a0a]",
                                                        )}
                                                      >
                                                        {typeof opportunityMostVerifiedReelsBonus.min_verified_reels ===
                                                          "number" && (
                                                          <div>
                                                            Min.{" "}
                                                            {opportunityMostVerifiedReelsBonus.min_verified_reels.toLocaleString()}{" "}
                                                            Reels
                                                          </div>
                                                        )}
                                                        {typeof opportunityMostVerifiedReelsBonus.min_total_views ===
                                                          "number" && (
                                                          <div>
                                                            Min.{" "}
                                                            {opportunityMostVerifiedReelsBonus.min_total_views.toLocaleString()}{" "}
                                                            Views
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}

                          {/* Bonus Information — Figma Bonuses & Limits */}
                          <div className="space-y-[22px]">
                           
                            {/* Bonus Budget Tracker for Leaderboard with flat_fee_bonus */}
                            {detailFlatFeeContestList.map((slice) => {
                              const lb =
                                slice.contest?.contest_based_details
                                  ?.leaderboard_contest;
                              if (
                                slice.contest?.contest_type !== "leaderboard" ||
                                !lb?.flat_fee_bonus
                              ) {
                                return null;
                              }
                              const body = (
                                <>
                                  <div className="flex items-center gap-3 mb-3">
                                    <Gift
                                      className={cn(
                                        "h-5 w-5",
                                        isDark
                                          ? "text-[#ffa35c]"
                                          : "text-[#ff7a1a]",
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        "font-semibold flex items-center gap-2",
                                        isDark
                                          ? "text-slate-100"
                                          : "text-slate-900",
                                      )}
                                    >
                                      Bonus Budget
                                      {!slice.showLabel &&
                                      detailVideoPlatforms.length >= 2 &&
                                      detailPlatformTab === ALL_PLATFORM_TAB ? (
                                        <ContestDetailSharedAcrossPlatformsHint
                                          platforms={detailVideoPlatforms}
                                        />
                                      ) : null}
                                    </span>
                                    <div className="group relative">
                                      <Info
                                        className={cn(
                                          "h-4 w-4 cursor-help",
                                          isDark
                                            ? "text-[#ffa35c]"
                                            : "text-[#ff7a1a]",
                                        )}
                                      />
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 min-w-64 max-w-80 text-center">
                                        Additional bonus on top of prize pool.
                                        Every verified submission receives the
                                        per-submission bonus until the total
                                        budget is exhausted.
                                      </div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div
                                      className={cn(
                                        "rounded-xl border p-4",
                                        isDark
                                          ? "bg-slate-800 border-slate-700"
                                          : "bg-white border-neutral-200",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "text-xs mb-1",
                                          isDark
                                            ? "text-[#ffa35c]"
                                            : "text-[#ff7a1a]",
                                        )}
                                      >
                                        Per Submission
                                      </div>
                                      <div
                                        className={cn(
                                          "text-lg font-bold",
                                          isDark
                                            ? "text-slate-100"
                                            : "text-slate-900",
                                        )}
                                      >
                                        {formatMoney(lb.flat_fee_bonus)}
                                      </div>
                                    </div>
                                    {lb.total_budget ? (
                                      <div
                                        className={cn(
                                          "rounded-xl border p-4",
                                          isDark
                                            ? "bg-slate-800 border-slate-700"
                                            : "bg-white border-neutral-200",
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "text-xs mb-1",
                                            isDark
                                              ? "text-[#ffa35c]"
                                              : "text-[#ff7a1a]",
                                          )}
                                        >
                                          Total Budget
                                        </div>
                                        <div
                                          className={cn(
                                            "text-lg font-bold",
                                            isDark
                                              ? "text-slate-100"
                                              : "text-slate-900",
                                          )}
                                        >
                                          {formatMoney(lb.total_budget)}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </>
                              );
                              if (slice.showLabel && slice.platform) {
                                return (
                                  <div
                                    key={`bonus-budget-${slice.platform}`}
                                    className={cn(
                                      "rounded-xl border overflow-hidden",
                                      isDark
                                        ? "border-slate-700"
                                        : "border-neutral-200",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "flex flex-wrap items-center gap-2 border-b px-3 py-2",
                                        isDark
                                          ? "border-slate-700 bg-white/[0.04]"
                                          : "border-neutral-200 bg-[#fafafa]",
                                      )}
                                    >
                                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                                        {getPlatformIcon(slice.platform, "sm")}
                                        <span
                                          className={
                                            isDark
                                              ? "text-slate-100"
                                              : "text-slate-800"
                                          }
                                        >
                                          {
                                            VIDEO_PLATFORM_LABELS[
                                              slice.platform
                                            ]
                                          }
                                        </span>
                                      </span>
                                    </div>
                                    <div
                                      className={cn(
                                        "p-4 ",
                                        isDark
                                          ? "bg-white/[0.04]"
                                          : "bg-[#fafafa]",
                                      )}
                                    >
                                      {body}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={`bonus-budget-${slice.platform ?? "contest"}`}
                                  className={cn(
                                    "rounded-2xl border p-5",
                                    isDark
                                      ? "bg-white/[0.04] border-slate-700"
                                      : "bg-[#fafafa] border-neutral-200",
                                  )}
                                >
                                  {body}
                                </div>
                              );
                            })}

                            {/* Flat Fee Bonus for CPM contests */}
                            {detailFlatFeeContestList.map((slice) => {
                              const cpm =
                                slice.contest?.contest_based_details
                                  ?.cpm_contest;
                              if (
                                !isCpmContestType(
                                  slice.contest?.contest_type,
                                ) ||
                                !cpm?.flat_fee_bonus
                              ) {
                                return null;
                              }
                              const showSharedFlatFeeIcons =
                                detailVideoPlatforms.length >= 2 &&
                                detailPlatformTab === ALL_PLATFORM_TAB &&
                                !slice.showLabel;
                              const body = (
                                <>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <Gift
                                        className={cn(
                                          "h-5 w-5",
                                          isDark
                                            ? "text-[#ffa35c]"
                                            : "text-[#ff7a1a]",
                                        )}
                                      />
                                      <span
                                        className={cn(
                                          "font-medium flex items-center gap-2",
                                          isDark
                                            ? "text-slate-100"
                                            : "text-slate-900",
                                        )}
                                      >
                                        Guaranteed Bonus
                                        {showSharedFlatFeeIcons ? (
                                          <ContestDetailSharedAcrossPlatformsHint
                                            platforms={detailVideoPlatforms}
                                          />
                                        ) : null}
                                      </span>
                                      <div className="group relative">
                                        <Info
                                          className={cn(
                                            "h-4 w-4 cursor-help",
                                            isDark
                                              ? "text-[#ffa35c]"
                                              : "text-[#ff7a1a]",
                                          )}
                                        />
                                        <div
                                          className={cn(
                                            "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 min-w-64 max-w-80 text-center",
                                            isDark
                                              ? "bg-slate-800 text-slate-100"
                                              : "bg-slate-900 text-white",
                                          )}
                                        >
                                          Every submission that gets verified
                                          will receive this guaranteed bonus
                                          amount. Your submission will only get
                                          verified if you follow the brief and
                                          rules & guidelines.
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div
                                        className={cn(
                                          "text-lg font-bold",
                                          isDark
                                            ? "text-slate-100"
                                            : "text-slate-900",
                                        )}
                                      >
                                        {formatMoney(cpm.flat_fee_bonus)}
                                      </div>
                                      <div
                                        className={cn(
                                          "text-xs",
                                          isDark
                                            ? "text-[#ffa35c]"
                                            : "text-[#ff7a1a]",
                                        )}
                                      >
                                        per verified submission
                                      </div>
                                    </div>
                                  </div>
                                  {cpm.flat_fee_bonus_cap ? (
                                    <div className="mt-3">
                                      <p
                                        className={cn(
                                          "text-sm font-medium",
                                          isDark
                                            ? "text-slate-100"
                                            : "text-slate-900",
                                        )}
                                      >
                                        💰 Flat Fee Bonus Cap:{" "}
                                        {formatMoney(cpm.flat_fee_bonus_cap)}
                                      </p>
                                      <p
                                        className={cn(
                                          "text-xs mt-2",
                                          isDark
                                            ? "text-[#ffa35c]"
                                            : "text-[#ff7a1a]",
                                        )}
                                      >
                                        Maximum total flat fee bonus to
                                        distribute across all creators. Once
                                        this cap is reached, no more flat fee
                                        bonuses will be given.
                                      </p>
                                    </div>
                                  ) : null}
                                </>
                              );
                              if (slice.showLabel && slice.platform) {
                                return (
                                  <div
                                    key={`cpm-flat-fee-${slice.platform}`}
                                    className={cn(
                                      "rounded-xl border overflow-hidden",
                                      isDark
                                        ? "border-slate-700"
                                        : "border-neutral-200",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "flex flex-wrap items-center gap-2 border-b px-3 py-2",
                                        isDark
                                          ? "border-slate-700 bg-white/[0.04]"
                                          : "border-neutral-200 bg-[#fafafa]",
                                      )}
                                    >
                                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                                        {getPlatformIcon(slice.platform, "sm")}
                                        <span
                                          className={
                                            isDark
                                              ? "text-slate-100"
                                              : "text-slate-800"
                                          }
                                        >
                                          {
                                            VIDEO_PLATFORM_LABELS[
                                              slice.platform
                                            ]
                                          }
                                        </span>
                                      </span>
                                    </div>
                                    <div
                                      className={cn(
                                        "p-3",
                                        isDark
                                          ? "bg-white/[0.04]"
                                          : "bg-[#fafafa]",
                                      )}
                                    >
                                      {body}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={`cpm-flat-fee-${slice.platform ?? "contest"}`}
                                  className={cn(
                                    "p-3 rounded-lg border transition-all duration-300",
                                    isDark
                                      ? "bg-white/[0.04] border-slate-700"
                                      : "bg-[#fafafa] border-neutral-200",
                                  )}
                                >
                                  {body}
                                </div>
                              );
                            })}

                            {/* Multiple Submissions */}
                            {(contest as any).multiple_submissions_enabled && (
                              <div
                                className={cn(
                                  "mt-4 flex flex-col gap-3 rounded-2xl border px-5 py-[18px] sm:flex-row sm:items-center sm:gap-4",
                                  isDark
                                    ? "border-slate-700 bg-white/[0.04]"
                                    : "border-[#e5e5e5] bg-[#fafafa]",
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl",
                                    isDark ? "bg-white/10" : "bg-white",
                                  )}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src="/images/contest-details/bonus-checks.svg"
                                    alt=""
                                    width={19}
                                    height={19}
                                    className="h-[19px] w-[19px]"
                                  />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={cn(
                                        "text-[15px] font-semibold",
                                        isDark
                                          ? "text-white"
                                          : "text-[#0a0a0a]",
                                      )}
                                    >
                                      Multiple Submissions
                                    </span>
                                    <div className="group relative flex-shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src="/images/contest-details/bonus-info.svg"
                                        alt=""
                                        width={14}
                                        height={14}
                                        className="h-3.5 w-3.5 cursor-help"
                                      />
                                      <div
                                        className={cn(
                                          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-[180px] -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-center text-[10px] opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:w-auto sm:min-w-64 sm:max-w-80 sm:px-3 sm:py-2 sm:text-xs",
                                          isDark
                                            ? "border border-slate-700 bg-slate-800 text-slate-100"
                                            : "bg-slate-900 text-white",
                                        )}
                                      >
                                        You can submit multiple pieces of
                                        content to maximize your chances of
                                        winning and earning. Each submission
                                        must follow the brief and rules &
                                        guidelines.
                                      </div>
                                    </div>
                                    {!showDetailMaxEarningsByPlatform &&
                                    detailVideoPlatforms.length >= 2 &&
                                    detailPlatformTab === ALL_PLATFORM_TAB ? (
                                      <ContestDetailSharedAcrossPlatformsHint
                                        platforms={detailVideoPlatforms}
                                      />
                                    ) : null}
                                  </div>
                                  {(() => {
                                    const platformsForCap =
                                      showDetailMaxEarningsByPlatform
                                        ? detailVideoPlatforms
                                        : ([
                                            detailScopedPlatform ??
                                              detailVideoPlatforms[0] ??
                                              (isVideoContestPlatform(
                                                contest?.platform,
                                              )
                                                ? contest.platform
                                                : null),
                                          ].filter(
                                            Boolean,
                                          ) as VideoContestPlatform[]);
                                    const caps = platformsForCap
                                      .map((platform) => ({
                                        platform: showDetailMaxEarningsByPlatform
                                          ? platform
                                          : null,
                                        cents: maxEarningsCentsForPlatform(
                                          (contest as any)
                                            .max_earnings_per_creator,
                                          (contest as any).bonus_details,
                                          platform,
                                        ),
                                      }))
                                      .filter((row) => row.cents);
                                    const displayCaps =
                                      showDetailMaxEarningsByPlatform
                                        ? caps
                                        : caps.slice(0, 1);
                                    if (displayCaps.length === 0) return null;

                                    if (showDetailMaxEarningsByPlatform) {
                                      return (
                                        <div className="flex flex-wrap gap-2">
                                          {displayCaps.map(
                                            ({ platform, cents }, idx) =>
                                              platform ? (
                                                <div
                                                  key={`cap-${platform}-${idx}`}
                                                  className={cn(
                                                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                                                    isDark
                                                      ? "bg-white/10 text-slate-200"
                                                      : "bg-white text-[#404040]",
                                                  )}
                                                >
                                                  {getPlatformIcon(
                                                    platform,
                                                    "sm",
                                                  )}
                                                  Cap: {formatMoney(cents!)}
                                                </div>
                                              ) : null,
                                          )}
                                        </div>
                                      );
                                    }

                                    return displayCaps.map(({ cents }, idx) => (
                                      <div
                                        key={`cap-shared-${idx}`}
                                        className={cn(
                                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                                          isDark
                                            ? "bg-white/10 text-slate-200"
                                            : "bg-white text-[#404040]",
                                        )}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src="/images/contest-details/bonus-dollar.svg"
                                          alt=""
                                          width={13}
                                          height={13}
                                          className="h-[13px] w-[13px]"
                                        />
                                        Cap: {formatMoney(cents!)}
                                      </div>
                                    ));
                                  })()}
                                </div>
                                <div
                                  className={cn(
                                    "shrink-0 text-[22px] font-bold tracking-[-0.44px]",
                                    isDark ? "text-white" : "text-[#0a0a0a]",
                                  )}
                                >
                                  Up to{" "}
                                  {
                                    (contest as any)
                                      .max_submissions_per_creator
                                  }{" "}
                                  entries
                                </div>
                              </div>
                            )}

                            {/* Additional Bonuses */}
                            {showDetailBonusDetailsByPlatform ? (
                              <div className="space-y-3">
                                {detailVideoPlatforms.map((platform) => {
                                  const bonus = bonusDetailsForPlatform(
                                    (contest as any).bonus_details,
                                    platform,
                                  );
                                  if (!bonus?.description_html) return null;
                                  return (
                                    <div
                                      key={`bonus-${platform}`}
                                      className={cn(
                                        "rounded-xl border overflow-hidden",
                                        isDark
                                          ? "border-slate-700"
                                          : "border-neutral-200",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "flex flex-wrap items-center gap-2 border-b px-3 py-2",
                                          isDark
                                            ? "border-slate-700 bg-white/[0.04]"
                                            : "border-neutral-200 bg-[#fafafa]",
                                        )}
                                      >
                                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                                          {getPlatformIcon(platform, "sm")}
                                          <span
                                            className={
                                              isDark
                                                ? "text-slate-100"
                                                : "text-slate-800"
                                            }
                                          >
                                            {VIDEO_PLATFORM_LABELS[platform]}
                                          </span>
                                        </span>
                                      </div>
                                      <div
                                        className={cn(
                                          "flex flex-col gap-4 px-5 pb-[18px] pt-5",
                                          isDark
                                            ? "bg-white/[0.04]"
                                            : "bg-[#fafafa]",
                                        )}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div
                                            className={cn(
                                              "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl",
                                              isDark
                                                ? "bg-white/10"
                                                : "bg-white",
                                            )}
                                          >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                              src="/images/contest-details/bonus-star.svg"
                                              alt=""
                                              width={19}
                                              height={19}
                                              className="h-[19px] w-[19px]"
                                            />
                                          </div>
                                          <span
                                            className={cn(
                                              "text-[15px] font-semibold",
                                              isDark
                                                ? "text-white"
                                                : "text-[#0a0a0a]",
                                            )}
                                          >
                                            Extra Bonuses
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            "rounded-[14px] border px-5 py-4",
                                            isDark
                                              ? "border-amber-900/40 bg-amber-950/30"
                                              : "border-[#e6d3a3] bg-[#fff3d6]",
                                          )}
                                        >
                                          <div
                                            className={cn(
                                              "prose prose-sm max-w-none text-[13px] font-medium",
                                              isDark
                                                ? "prose-invert text-slate-100"
                                                : "text-[#0a0a0a] [&_*]:text-[#0a0a0a]",
                                            )}
                                            dangerouslySetInnerHTML={{
                                              __html: bonus.description_html,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              bonusDetailsForPlatform(
                                (contest as any).bonus_details,
                                detailScopedPlatform ??
                                  detailVideoPlatforms[0] ??
                                  contest?.platform,
                              )?.description_html && (
                                <div
                                  className={cn(
                                    "flex flex-col gap-4 rounded-2xl border px-5 pb-[18px] pt-5",
                                    isDark
                                      ? "border-slate-700 bg-white/[0.04]"
                                      : "border-[#e5e5e5] bg-[#fafafa]",
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={cn(
                                        "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl",
                                        isDark ? "bg-white/10" : "bg-white",
                                      )}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src="/images/contest-details/bonus-star.svg"
                                        alt=""
                                        width={19}
                                        height={19}
                                        className="h-[19px] w-[19px]"
                                      />
                                    </div>
                                    <span
                                      className={cn(
                                        "flex items-center gap-1.5 text-[15px] font-semibold",
                                        isDark
                                          ? "text-white"
                                          : "text-[#0a0a0a]",
                                      )}
                                    >
                                      Extra Bonuses
                                      {detailVideoPlatforms.length >= 2 &&
                                      detailPlatformTab ===
                                        ALL_PLATFORM_TAB ? (
                                        <ContestDetailSharedAcrossPlatformsHint
                                          platforms={detailVideoPlatforms}
                                        />
                                      ) : null}
                                    </span>
                                    <div className="group relative">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src="/images/contest-details/bonus-info.svg"
                                        alt=""
                                        width={14}
                                        height={14}
                                        className="h-3.5 w-3.5 cursor-help"
                                      />
                                      <div
                                        className={cn(
                                          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 min-w-64 max-w-80 -translate-x-1/2 rounded-lg px-3 py-2 text-center text-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100",
                                          isDark
                                            ? "border border-slate-700 bg-slate-800 text-slate-100"
                                            : "bg-slate-900 text-white",
                                        )}
                                      >
                                        These are additional earning
                                        opportunities. The amount is handled
                                        and credited by the brand separately
                                        from the main contest prizes.
                                      </div>
                                    </div>
                                  </div>
                                  <div
                                    className={cn(
                                      "max-h-40 overflow-y-auto rounded-[14px] border px-5 py-4",
                                      isDark
                                        ? "border-amber-900/40 bg-amber-950/30"
                                        : "border-[#e6d3a3] bg-[#fff3d6]",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "prose prose-sm max-w-none text-[13px] font-medium leading-relaxed",
                                        isDark
                                          ? "prose-invert text-white [&_*]:!text-white"
                                          : "text-[#0a0a0a] [&_*]:text-[#0a0a0a]",
                                      )}
                                      dangerouslySetInnerHTML={{
                                        __html:
                                          bonusDetailsForPlatform(
                                            (contest as any).bonus_details,
                                            detailScopedPlatform ??
                                              detailVideoPlatforms[0] ??
                                              contest?.platform,
                                          )?.description_html || "",
                                      }}
                                    />
                                  </div>
                                  <div
                                    className={cn(
                                      "flex items-center gap-2 border-t pt-4",
                                      isDark
                                        ? "border-slate-700"
                                        : "border-[#e5e5e5]",
                                    )}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src="/images/contest-details/bonus-info-2.svg"
                                      alt=""
                                      width={14}
                                      height={14}
                                      className="h-3.5 w-3.5 shrink-0"
                                    />
                                    <p
                                      className={cn(
                                        "text-xs leading-relaxed",
                                        isDark
                                          ? "text-slate-300"
                                          : "text-[#737373]",
                                      )}
                                    >
                                      These bonuses are handled manually by the
                                      brand. Read carefully and reach out if you
                                      have questions!
                                    </p>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Comprehensive Prize Distribution Section for Leaderboard Contests */}
                      {detailPrizeContestList.some(
                        (slice) =>
                          slice.contest?.contest_type === "leaderboard" &&
                          slice.contest?.contest_based_details
                            ?.leaderboard_contest?.prizes,
                      ) && (
                        <div
                          id="prize-structure"
                          ref={(el) => {
                            sectionRefs.current["prize-structure"] = el;
                          }}
                          className={cn(surfaceClass, "empty:hidden overflow-hidden")}
                        >
                          <div className="p-7">
                            <div className="mb-6 flex items-center gap-3.5">
                              <div
                                className={cn(
                                  "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl",
                                  isDark
                                    ? "bg-white/10 text-white"
                                    : "bg-[#f5f5f5] text-[#0a0a0a]",
                                )}
                              >
                                <Trophy className="h-[19px] w-[19px]" />
                              </div>
                              <div className="min-w-0">
                                <h3
                                  className={cn(
                                    "flex flex-wrap items-center gap-2 text-xl font-semibold tracking-[-0.2px]",
                                    isDark ? "text-white" : "text-[#0a0a0a]",
                                  )}
                                >
                                  Prize Structure
                                  {detailVideoPlatforms.length >= 2 &&
                                  detailPlatformTab === ALL_PLATFORM_TAB &&
                                  !showDetailPrizeByPlatform ? (
                                    <ContestDetailSharedAcrossPlatformsHint
                                      platforms={detailVideoPlatforms}
                                    />
                                  ) : null}
                                </h3>
                                <p
                                  className={cn(
                                    "text-[13px]",
                                    isDark ? "text-slate-300" : "text-[#737373]",
                                  )}
                                >
                                  Complete prize breakdown for all positions
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              {detailPrizeContestList.map((slice) => {
                                const lb =
                                  slice.contest?.contest_based_details
                                    ?.leaderboard_contest;
                                if (
                                  slice.contest?.contest_type !==
                                    "leaderboard" ||
                                  !lb?.prizes
                                ) {
                                  return null;
                                }
                                const sortedPrizes = [...lb.prizes].sort(
                                  (a: any, b: any) => a.position - b.position,
                                );
                                const poolCents =
                                  getLeaderboardPrizePoolCents(lb);
                                const placeLabel = (position: number) =>
                                  position === 1
                                    ? "1st Place"
                                    : position === 2
                                      ? "2nd Place"
                                      : position === 3
                                        ? "3rd Place"
                                        : `${position}th Place`;
                                const poolShare = (amount: number) => {
                                  if (!poolCents) return "0% of pool";
                                  const pct = (amount / poolCents) * 100;
                                  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}% of pool`;
                                };
                                const topPrizes = sortedPrizes.filter(
                                  (p: any) => p.position <= 3,
                                );
                                const otherPrizes = sortedPrizes.filter(
                                  (p: any) => p.position > 3,
                                );
                                const prizeByPos = (pos: number) =>
                                  topPrizes.find(
                                    (p: any) => p.position === pos,
                                  );
                                const first = prizeByPos(1);
                                const second = prizeByPos(2);
                                const third = prizeByPos(3);

                                const prizeBody = (
                                  <div className="space-y-[22px]">
                                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                                      <div
                                        className={cn(
                                          "rounded-2xl border px-[18px] py-4",
                                          isDark
                                            ? "border-slate-700 bg-white/[0.04]"
                                            : "border-[#e5e5e5] bg-[#fafafa]",
                                        )}
                                      >
                                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#737373]">
                                          <Trophy className="h-3.5 w-3.5 text-[#f97316]" />
                                          Total Prize Pool
                                        </div>
                                        <p
                                          className={cn(
                                            "text-[26px] font-bold tracking-[-0.52px]",
                                            isDark
                                              ? "text-white"
                                              : "text-[#0a0a0a]",
                                          )}
                                        >
                                          {formatMoney(poolCents)}
                                        </p>
                                        <p className="mt-1 text-xs text-[#737373]">
                                          distributed across winners
                                        </p>
                                      </div>
                                      <div
                                        className={cn(
                                          "rounded-2xl border px-[18px] py-4",
                                          isDark
                                            ? "border-slate-700 bg-white/[0.04]"
                                            : "border-[#e5e5e5] bg-[#fafafa]",
                                        )}
                                      >
                                        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#737373]">
                                          <Users className="h-3.5 w-3.5 text-[#f97316]" />
                                          Total Winners
                                        </div>
                                        <p
                                          className={cn(
                                            "text-[26px] font-bold tracking-[-0.52px]",
                                            isDark
                                              ? "text-white"
                                              : "text-[#0a0a0a]",
                                          )}
                                        >
                                          {lb.winner_count}
                                        </p>
                                        <p className="mt-1 text-xs text-[#737373]">
                                          positions paid
                                        </p>
                                      </div>
                                    </div>

                                    <div className="space-y-5">
                                      <h4
                                        className={cn(
                                          "text-base font-semibold",
                                          isDark
                                            ? "text-white"
                                            : "text-[#0a0a0a]",
                                        )}
                                      >
                                        Prize Distribution
                                      </h4>

                                      {(first || second || third) && (
                                        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
                                          {second ? (
                                            <div
                                              className={cn(
                                                "flex flex-1 flex-col items-center justify-center gap-2 rounded-[20px] border px-4 py-5 shadow-[0px_4px_12px_0px_rgba(10,10,10,0.06)] sm:min-h-[204px]",
                                                isDark
                                                  ? "border-slate-700 bg-[#12032c]"
                                                  : "border-[#e5e5e5] bg-white",
                                              )}
                                            >
                                              <div className="flex h-12 w-12 items-center justify-center rounded-full border-[2.5px] border-[#a3a3a3] bg-[#f5f5f5] text-xl font-bold text-[#404040]">
                                                2
                                              </div>
                                              <p className="text-[13px] font-semibold text-[#737373]">
                                                2nd Place
                                              </p>
                                              <p
                                                className={cn(
                                                  "text-[28px] font-bold tracking-[-0.56px]",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-[#0a0a0a]",
                                                )}
                                              >
                                                {formatMoney(second.amount)}
                                              </p>
                                              <div className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[11px] font-semibold text-[#404040]">
                                                {poolShare(second.amount)}
                                              </div>
                                            </div>
                                          ) : null}

                                          {first ? (
                                            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-[#e6d3a3] bg-[#fff6e0] px-4 py-5 shadow-[0px_12px_28px_0px_rgba(184,151,90,0.2)] sm:min-h-[244px]">
                                              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0a0a0a] px-2.5 py-1 text-[10px] font-bold tracking-[1px] text-white">
                                                <Trophy className="h-3 w-3 text-[#fbe7b0]" />
                                                GRAND PRIZE
                                              </div>
                                              <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-[2.5px] border-[#b8975a] bg-[#fbe7b0] text-[26px] font-bold text-[#7a5a1e]">
                                                1
                                              </div>
                                              <p className="text-[13px] font-semibold text-[#7a5a1e]">
                                                1st Place
                                              </p>
                                              <p className="text-[34px] font-bold tracking-[-0.68px] text-[#0a0a0a]">
                                                {formatMoney(first.amount)}
                                              </p>
                                              <div className="rounded-full border border-[#e6d3a3] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#7a5a1e]">
                                                {poolShare(first.amount)}
                                              </div>
                                            </div>
                                          ) : null}

                                          {third ? (
                                            <div
                                              className={cn(
                                                "flex flex-1 flex-col items-center justify-center gap-2 rounded-[20px] border px-4 py-5 shadow-[0px_4px_12px_0px_rgba(10,10,10,0.06)] sm:min-h-[188px]",
                                                isDark
                                                  ? "border-slate-700 bg-[#12032c]"
                                                  : "border-[#e5e5e5] bg-white",
                                              )}
                                            >
                                              <div className="flex h-12 w-12 items-center justify-center rounded-full border-[2.5px] border-[#c98b5a] bg-[#fbe9da] text-xl font-bold text-[#8a4b1f]">
                                                3
                                              </div>
                                              <p className="text-[13px] font-semibold text-[#737373]">
                                                3rd Place
                                              </p>
                                              <p
                                                className={cn(
                                                  "text-[28px] font-bold tracking-[-0.56px]",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-[#0a0a0a]",
                                                )}
                                              >
                                                {formatMoney(third.amount)}
                                              </p>
                                              <div className="rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[11px] font-semibold text-[#404040]">
                                                {poolShare(third.amount)}
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      )}

                                      {otherPrizes.length > 0 ? (
                                        <div className="space-y-2.5">
                                          <p className="text-[11px] font-semibold tracking-[0.88px] text-[#737373]">
                                            OTHER POSITIONS
                                          </p>
                                          <div
                                            className={cn(
                                              "overflow-hidden rounded-2xl border",
                                              isDark
                                                ? "border-slate-700"
                                                : "border-[#e5e5e5]",
                                            )}
                                          >
                                            {otherPrizes.map(
                                              (prize: any, index: number) => (
                                                <div
                                                  key={`${slice.platform ?? "contest"}-${prize.position}-${index}`}
                                                  className={cn(
                                                    "flex items-center gap-3.5 px-5 py-3.5",
                                                    index > 0 &&
                                                      (isDark
                                                        ? "border-t border-slate-700"
                                                        : "border-t border-[#e5e5e5]"),
                                                  )}
                                                >
                                                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] text-[13px] font-semibold text-[#404040]">
                                                    {prize.position}
                                                  </div>
                                                  <div className="min-w-0 flex-1">
                                                    <p
                                                      className={cn(
                                                        "text-sm font-semibold",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-[#0a0a0a]",
                                                      )}
                                                    >
                                                      Position {prize.position}
                                                    </p>
                                                    <p className="text-xs text-[#737373]">
                                                      {placeLabel(
                                                        prize.position,
                                                      )}
                                                    </p>
                                                  </div>
                                                  <p
                                                    className={cn(
                                                      "text-base font-semibold",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-[#0a0a0a]",
                                                    )}
                                                  >
                                                    {formatMoney(prize.amount)}
                                                  </p>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                                if (slice.showLabel && slice.platform) {
                                  return (
                                    <ContestDetailPlatformScopeCard
                                      key={`creator-prize-${slice.platform}`}
                                      platforms={[slice.platform]}
                                      isDark={isDark}
                                    >
                                      {prizeBody}
                                    </ContestDetailPlatformScopeCard>
                                  );
                                }
                                return (
                                  <div
                                    key={`creator-prize-${slice.platform ?? "contest"}`}
                                    className="space-y-6"
                                  >
                                    {prizeBody}
                                  </div>
                                );
                              })}
                            </div>

                            {detailFlatFeeContestList.some(
                              (slice) =>
                                slice.contest?.contest_type === "leaderboard" &&
                                slice.contest?.contest_based_details
                                  ?.leaderboard_contest?.flat_fee_bonus,
                            ) ? (
                              <div className="mt-6 space-y-4">
                                <h4
                                  className={cn(
                                    "text-lg font-semibold flex flex-wrap items-center gap-2",
                                    isDark ? "text-white" : "text-slate-900",
                                  )}
                                >
                                  Guaranteed Bonus
                                  {detailVideoPlatforms.length >= 2 &&
                                  detailPlatformTab === ALL_PLATFORM_TAB &&
                                  !detailFlatFeeContestList.some(
                                    (s) => s.showLabel,
                                  ) ? (
                                    <ContestDetailSharedAcrossPlatformsHint
                                      platforms={detailVideoPlatforms}
                                    />
                                  ) : null}
                                </h4>
                                {detailFlatFeeContestList.map((slice) => {
                                  const lb =
                                    slice.contest?.contest_based_details
                                      ?.leaderboard_contest;
                                  if (
                                    slice.contest?.contest_type !==
                                      "leaderboard" ||
                                    !lb?.flat_fee_bonus
                                  ) {
                                    return null;
                                  }
                                  const bonusBody = (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div
                                          className={cn(
                                            "rounded-2xl border p-5",
                                            isDark
                                              ? "bg-white/[0.04] border-slate-700"
                                              : "bg-[#fafafa] border-neutral-200",
                                          )}
                                        >
                                          <div className="flex items-center gap-3">
                                            <Gift
                                              className={cn(
                                                "h-6 w-6",
                                                isDark
                                                  ? "text-[#ffa35c]"
                                                  : "text-[#ff7a1a]",
                                              )}
                                            />
                                            <div>
                                              <div
                                                className={cn(
                                                  "text-sm font-medium",
                                                  isDark
                                                    ? "text-slate-100"
                                                    : "text-slate-900",
                                                )}
                                              >
                                                Bonus Budget
                                              </div>
                                              <div
                                                className={cn(
                                                  "text-2xl font-bold",
                                                  isDark
                                                    ? "text-slate-100"
                                                    : "text-slate-900",
                                                )}
                                              >
                                                {formatMoney(lb.flat_fee_bonus)}
                                              </div>
                                              <div
                                                className={cn(
                                                  "text-xs mt-0.5",
                                                  isDark
                                                    ? "text-[#ffa35c]"
                                                    : "text-[#ff7a1a]",
                                                )}
                                              >
                                                per verified submission
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        {lb.total_budget ? (
                                          <div
                                            className={cn(
                                              "rounded-2xl border p-5",
                                              isDark
                                                ? "bg-white/[0.04] border-slate-700"
                                                : "bg-[#fafafa] border-neutral-200",
                                            )}
                                          >
                                            <div className="flex items-center gap-3">
                                              <Wallet
                                                className={cn(
                                                  "h-6 w-6",
                                                  isDark
                                                    ? "text-[#ffa35c]"
                                                    : "text-[#ff7a1a]",
                                                )}
                                              />
                                              <div>
                                                <div
                                                  className={cn(
                                                    "text-sm font-medium",
                                                    isDark
                                                      ? "text-slate-100"
                                                      : "text-slate-900",
                                                  )}
                                                >
                                                  Total Bonus Cap
                                                </div>
                                                <div
                                                  className={cn(
                                                    "text-2xl font-bold",
                                                    isDark
                                                      ? "text-slate-100"
                                                      : "text-slate-900",
                                                  )}
                                                >
                                                  {formatMoney(lb.total_budget)}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                      <div
                                        className={cn(
                                          "p-4 border rounded-lg",
                                          isDark
                                            ? "bg-white/[0.04] border-slate-700"
                                            : "bg-[#fafafa] border-neutral-200",
                                        )}
                                      >
                                        <div className="flex items-start gap-3">
                                          <Gift
                                            className={cn(
                                              "h-5 w-5 mt-0.5 flex-shrink-0",
                                              isDark
                                                ? "text-[#ffa35c]"
                                                : "text-[#ff7a1a]",
                                            )}
                                          />
                                          <div>
                                            <p
                                              className={cn(
                                                "text-sm font-semibold mb-1",
                                                isDark
                                                  ? "text-slate-100"
                                                  : "text-slate-900",
                                              )}
                                            >
                                              Additional Bonus Earnings
                                            </p>
                                            <p
                                              className={cn(
                                                "text-sm",
                                                isDark
                                                  ? "text-[#ffa35c]"
                                                  : "text-slate-900",
                                              )}
                                            >
                                              Every verified submission receives{" "}
                                              <span className="font-bold">
                                                {formatMoney(lb.flat_fee_bonus)}
                                              </span>{" "}
                                              as a guaranteed bonus, on top of
                                              any prizes won from the
                                              leaderboard positions above
                                              {lb.total_budget ? (
                                                <>
                                                  , until the bonus budget of{" "}
                                                  <span className="font-bold">
                                                    {formatMoney(
                                                      lb.total_budget,
                                                    )}
                                                  </span>{" "}
                                                  is reached
                                                </>
                                              ) : null}
                                              .
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                  if (slice.showLabel && slice.platform) {
                                    return (
                                      <ContestDetailPlatformScopeCard
                                        key={`creator-prize-bonus-${slice.platform}`}
                                        platforms={[slice.platform]}
                                        isDark={isDark}
                                      >
                                        {bonusBody}
                                      </ContestDetailPlatformScopeCard>
                                    );
                                  }
                                  return (
                                    <div
                                      key={`creator-prize-bonus-${slice.platform ?? "contest"}`}
                                    >
                                      {bonusBody}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* 2. CONTEST DETAILS - Essential Information */}
                      <div
                        id="contest-details"
                        ref={(el) => {
                          sectionRefs.current["contest-details"] = el;
                        }}
                        className={cn(
                          surfaceClass,
                          "space-y-[22px] p-7 empty:hidden overflow-hidden",
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={cn(
                              "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl",
                              isDark
                                ? "bg-white/10 text-white"
                                : "bg-[#f5f5f5] text-[#0a0a0a]",
                            )}
                          >
                            <Calendar className="h-[19px] w-[19px]" />
                          </div>
                          <div>
                            <h3
                              className={cn(
                                titleClass,
                                "text-xl tracking-[-0.2px]",
                              )}
                            >
                              Contest Details
                            </h3>
                            <p
                              className={cn(
                                "text-[13px]",
                                isDark ? "text-slate-300" : "text-[#737373]",
                              )}
                            >
                              Schedule and status
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-3">
                          <div
                            className={cn(
                              "flex flex-1 items-center gap-3.5 rounded-2xl border px-5 py-[18px]",
                              isDark
                                ? "border-slate-700 bg-[#12032c]"
                                : "border-[#e5e5e5] bg-[#fafafa]",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                                isDark
                                  ? "bg-white/10 text-white"
                                  : "bg-white text-[#0a0a0a]",
                              )}
                            >
                              <Play className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-[10px] font-semibold tracking-[0.8px]",
                                  isDark ? "text-slate-400" : "text-[#737373]",
                                )}
                              >
                                START DATE & TIME
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-bold tracking-[-0.18px]",
                                  isDark ? "text-white" : "text-[#0a0a0a]",
                                )}
                              >
                                {contest.start_date
                                  ? formatLocalDateTime(contest.start_date, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "Not specified"}
                              </p>
                              {contest.start_date ? (
                                <p
                                  className={cn(
                                    "text-xs",
                                    isDark
                                      ? "text-slate-400"
                                      : "text-[#737373]",
                                  )}
                                >
                                  {formatLocalDateTime(contest.start_date, {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {contest.start_date && contest.end_date ? (
                            <div className="mx-auto shrink-0 rounded-full bg-[#0a0a0a] px-2.5 py-1 text-[11px] font-semibold text-white sm:mx-0">
                              {(() => {
                                const start = new Date(contest.start_date);
                                const end = new Date(contest.end_date);
                                const diffDays = Math.ceil(
                                  Math.abs(end.getTime() - start.getTime()) /
                                    (1000 * 60 * 60 * 24),
                                );
                                return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
                              })()}
                            </div>
                          ) : null}

                          <div
                            className={cn(
                              "flex flex-1 items-center gap-3.5 rounded-2xl border px-5 py-[18px]",
                              isDark
                                ? "border-slate-700 bg-[#12032c]"
                                : "border-[#e5e5e5] bg-[#fafafa]",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                                isDark
                                  ? "bg-white/10 text-white"
                                  : "bg-white text-[#0a0a0a]",
                              )}
                            >
                              <CheckCircle className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-[10px] font-semibold tracking-[0.8px]",
                                  isDark ? "text-slate-400" : "text-[#737373]",
                                )}
                              >
                                END DATE & TIME
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-bold tracking-[-0.18px]",
                                  isDark ? "text-white" : "text-[#0a0a0a]",
                                )}
                              >
                                {contest.end_date
                                  ? formatLocalDateTime(contest.end_date, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "Not specified"}
                              </p>
                              {contest.end_date ? (
                                <p
                                  className={cn(
                                    "text-xs",
                                    isDark
                                      ? "text-slate-400"
                                      : "text-[#737373]",
                                  )}
                                >
                                  {formatLocalDateTime(contest.end_date, {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-3 text-xs font-medium",
                              isDark
                                ? "bg-white/10 text-slate-200"
                                : "bg-[#f5f5f5] text-[#404040]",
                            )}
                          >
                            <Monitor className="h-3.5 w-3.5" />
                            {detailPlatformLabel}
                          </div>
                          <div
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-3 text-xs font-medium capitalize",
                              isDark
                                ? "bg-white/10 text-slate-200"
                                : "bg-[#f5f5f5] text-[#404040]",
                            )}
                          >
                            <Info className="h-3.5 w-3.5" />
                            {contest.status || "Not specified"}
                          </div>
                          {contest.status === "ended" &&
                            postContestStatus === "payouts_processed" && (
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] py-1 pl-2.5 pr-3 text-xs font-medium text-[#15803d]">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Payouts processed
                              </div>
                            )}
                          {/* Campaign Type Card - Only for Twitter campaigns */}
                          {(() => {
                            const isTwitterTextImage =
                              (contest.platform?.toLowerCase() === "twitter" ||
                                contest.platform?.toLowerCase() === "x") &&
                              contest.contest_format === "text_image";
                            if (!isTwitterTextImage) return null;
                            const campaignType =
                              contest.contest_based_details?.twitter_campaign
                                ?.campaign_type;
                            if (
                              campaignType !== "raid" &&
                              campaignType !== "awareness"
                            )
                              return null;
                            return (
                              <div
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-3 text-xs font-medium capitalize",
                                  campaignType === "raid"
                                    ? "bg-red-50 text-red-700"
                                    : isDark
                                      ? "bg-white/10 text-slate-200"
                                      : "bg-[#f5f5f5] text-[#404040]",
                                )}
                              >
                                {campaignType === "raid"
                                  ? "Raid Campaign"
                                  : "Awareness Campaign"}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Categories Section */}
                        {contest.categories &&
                          Array.isArray(contest.categories) &&
                          contest.categories.length > 0 &&
                          creatorCategories.length > 0 &&
                          (() => {
                            // Filter categories to only show those in user's profile
                            const filteredCategories =
                              contest.categories.filter((categoryId: string) =>
                                creatorCategories.includes(categoryId),
                              );

                            return filteredCategories.length > 0 ? (
                              <div className="space-y-3 mt-6">
                                <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                  <Tag className="h-5 w-5 text-[#ff7a1a]" />
                                  Categories
                                </h3>
                                <div
                                  className={cn(
                                    "border rounded-xl p-4",
                                    isDark
                                      ? "border-slate-700 bg-white/[0.04]"
                                      : "border-neutral-200 bg-[#fafafa]",
                                  )}
                                >
                                  <div className="flex flex-wrap gap-2">
                                    {filteredCategories.map(
                                      (categoryId: string) => {
                                        const category =
                                          CONTENT_TYPE_CATEGORIES.find(
                                            (cat) => cat.id === categoryId,
                                          );
                                        return (
                                          <span
                                            key={categoryId}
                                            className={cn(
                                              "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                                              isDark
                                                ? "bg-orange-600/30 text-slate-100 border border-slate-700"
                                                : "bg-[#fafafa] text-slate-900 border border-neutral-200",
                                            )}
                                          >
                                            {category
                                              ? category.name
                                              : categoryId}
                                          </span>
                                        );
                                      },
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : null;
                          })()}

                        {/* Subcategories Section */}
                        {contest.subcategories &&
                          (() => {
                            // Handle both grouped format and flat array format
                            let subcategoriesToDisplay: Array<{
                              category: string;
                              subcategory: string;
                            }> = [];

                            if (Array.isArray(contest.subcategories)) {
                              // Old flat array format
                              subcategoriesToDisplay = contest.subcategories;
                            } else if (
                              typeof contest.subcategories === "object" &&
                              contest.subcategories !== null
                            ) {
                              // New grouped format: {"beauty": ["Skincare", "Makeup"], ...}
                              const grouped = contest.subcategories as Record<
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

                            // Filter subcategories to only show those in user's profile
                            const filteredSubcategories =
                              subcategoriesToDisplay.filter((item) => {
                                // If user has no subcategories in profile, don't show any
                                if (
                                  Object.keys(creatorSubcategories).length === 0
                                ) {
                                  return false;
                                }
                                // Check if this category exists in user's profile
                                const userSubcats =
                                  creatorSubcategories[item.category];
                                if (!userSubcats || userSubcats.length === 0) {
                                  return false;
                                }
                                // Check if this specific subcategory exists in user's profile
                                return userSubcats.includes(item.subcategory);
                              });

                            return filteredSubcategories.length > 0 ? (
                              <div className="space-y-3 mt-6">
                                <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                  <Tag className="h-5 w-5 text-[#ff7a1a]" />
                                  Subcategories
                                </h3>
                                <div
                                  className={cn(
                                    "border rounded-xl p-4",
                                    isDark
                                      ? "border-slate-700 bg-white/[0.04]"
                                      : "border-neutral-200 bg-[#fafafa]",
                                  )}
                                >
                                  <div className="flex flex-wrap gap-2">
                                    {filteredSubcategories.map(
                                      (
                                        item: {
                                          category: string;
                                          subcategory: string;
                                        },
                                        index: number,
                                      ) => {
                                        const category =
                                          CONTENT_TYPE_CATEGORIES.find(
                                            (cat) => cat.id === item.category,
                                          );
                                        return (
                                          <span
                                            key={`${item.category}-${item.subcategory}-${index}`}
                                            className={cn(
                                              "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                                              isDark
                                                ? "bg-indigo-600/30 text-slate-100 border border-slate-700"
                                                : "bg-[#fafafa] text-slate-900 border border-neutral-200",
                                            )}
                                          >
                                            {category
                                              ? category.name
                                              : item.category}
                                            : {item.subcategory}
                                          </span>
                                        );
                                      },
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : null;
                          })()}

                        {/* Interests Section */}
                        {contest.interests &&
                          Array.isArray(contest.interests) &&
                          contest.interests.length > 0 &&
                          creatorInterests.length > 0 &&
                          (() => {
                            // Filter interests to only show those in user's profile
                            const filteredInterests = contest.interests.filter(
                              (interest: string) =>
                                creatorInterests.includes(interest),
                            );

                            return filteredInterests.length > 0 ? (
                              <div className="space-y-3 mt-6">
                                <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                  <Star className="h-5 w-5 text-[#ff7a1a]" />
                                  Interests
                                </h3>
                                <div
                                  className={cn(
                                    "border rounded-xl p-4",
                                    isDark
                                      ? "border-slate-700 bg-white/[0.04]"
                                      : "border-neutral-200 bg-[#fafafa]",
                                  )}
                                >
                                  <div className="flex flex-wrap gap-2">
                                    {filteredInterests.map(
                                      (interest: string) => (
                                        <span
                                          key={interest}
                                          className={cn(
                                            "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                                            isDark
                                              ? "bg-yellow-600/30 text-slate-100 border border-slate-700"
                                              : "bg-[#fafafa] text-slate-900 border border-neutral-200",
                                          )}
                                        >
                                          {interest}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : null;
                          })()}
                      </div>

                      {/* 3. CONTENT REQUIREMENTS - Brief and Content Type */}
                      <div
                        id="content-requirements"
                        ref={(el) => {
                          sectionRefs.current["content-requirements"] = el;
                        }}
                        className={cn(surfaceClass, "space-y-6 p-7 empty:hidden overflow-hidden")}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              isDark ? "bg-white/10" : "bg-[#f5f5f5]",
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/images/contest-details/brief-file.svg"
                              alt=""
                              width={20}
                              height={20}
                              className="h-5 w-5"
                            />
                          </div>
                          <div>
                            <h3
                              className={cn(
                                "text-xl font-semibold tracking-[-0.3px]",
                                isDark ? "text-white" : "text-[#0a0a0a]",
                              )}
                            >
                              Content Requirements
                            </h3>
                            <p
                              className={cn(
                                "text-[13px]",
                                isDark ? "text-slate-300" : "text-[#737373]",
                              )}
                            >
                              Read the brief carefully before you create
                            </p>
                          </div>
                        </div>
                        {/* Twitter raid details for Twitter contests */}
                        {(() => {
                          const twitterCampaign = (contest as any)
                            .contest_based_details?.twitter_campaign;
                          const raidTarget = twitterCampaign?.raid_target;
                          const twitterKeywords =
                            twitterCampaign?.keywords || [];
                          const twitterMentions =
                            twitterCampaign?.mentions || [];
                          const raidCpmPer1000Usd =
                            isCpmContestType(contest.contest_type) &&
                            contest.contest_based_details?.cpm_contest
                              ?.cpm_rate_usd != null
                              ? formatMoney(
                                  contest.contest_based_details.cpm_contest
                                    .cpm_rate_usd * 100,
                                )
                              : null;

                          return (
                            contest.platform?.toLowerCase() === "twitter" &&
                            (contest as any).content_type === "raid" &&
                            raidTarget && (
                              <div
                                className={cn(
                                  "rounded-xl p-6 border space-y-4",
                                  isDark
                                    ? "bg-slate-900/40 border-slate-700"
                                    : "border border-neutral-200 bg-white border-slate-200",
                                )}
                              >
                                <h4
                                  className={cn(
                                    "font-semibold text-lg flex items-center gap-2",
                                    isDark
                                      ? "text-slate-100"
                                      : "text-slate-900",
                                  )}
                                >
                                  <Share2 className="h-5 w-5 text-[#ff7a1a]" />
                                  Target Tweet for This Raid
                                </h4>

                                {raidTarget?.link && (
                                  <div className="space-y-1">
                                    <p
                                      className={cn(
                                        "text-xs uppercase tracking-wide font-medium",
                                        isDark
                                          ? "text-slate-300"
                                          : "text-slate-600",
                                      )}
                                    >
                                      Tweet Link
                                    </p>
                                    <a
                                      href={raidTarget.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "inline-flex items-center gap-1 text-sm font-medium underline break-all",
                                        isDark
                                          ? "text-[#ffa35c] hover:text-slate-100"
                                          : "text-[#ff7a1a] hover:text-[#ff7a1a]",
                                      )}
                                    >
                                      {raidTarget.link}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>
                                )}

                                {raidTarget?.description && (
                                  <div className="space-y-1">
                                    <p
                                      className={cn(
                                        "text-xs uppercase tracking-wide font-medium",
                                        isDark
                                          ? "text-slate-300"
                                          : "text-slate-600",
                                      )}
                                    >
                                      Tweet Description
                                    </p>
                                    <p
                                      className={cn(
                                        "text-sm leading-relaxed",
                                        isDark
                                          ? "text-slate-100"
                                          : "text-slate-800",
                                      )}
                                    >
                                      {raidTarget.description}
                                    </p>
                                  </div>
                                )}

                                {raidTarget?.metrics && (
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div
                                      className={cn(
                                        "rounded-2xl p-5 border flex items-center justify-between gap-4",
                                        isDark
                                          ? "border-slate-700 bg-slate-900/30"
                                          : "border-slate-200 bg-white/80",
                                      )}
                                    >
                                      <div className="min-w-0">
                                        <p
                                          className={cn(
                                            "text-xs uppercase tracking-wide font-medium",
                                            isDark
                                              ? "text-slate-300"
                                              : "text-slate-600",
                                          )}
                                        >
                                          Target Likes
                                        </p>
                                        <p
                                          className={cn(
                                            "text-base font-semibold",
                                            isDark
                                              ? "text-slate-100"
                                              : "text-slate-800",
                                          )}
                                        >
                                          {typeof raidTarget.metrics.likes ===
                                          "number"
                                            ? raidTarget.metrics.likes.toLocaleString()
                                            : (raidTarget.metrics.likes ??
                                              "Not specified")}
                                        </p>
                                      </div>
                                      <div
                                        className={cn(
                                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                          isDark
                                            ? "bg-[#fafafa]0/10 border border-slate-700 text-slate-100"
                                            : "bg-[#fafafa] border border-neutral-200 text-[#ff7a1a]",
                                        )}
                                      >
                                        <ThumbsUp className="h-6 w-6" />
                                      </div>
                                    </div>

                                    <div
                                      className={cn(
                                        "rounded-2xl p-5 border flex items-center justify-between gap-4",
                                        isDark
                                          ? "border-slate-700 bg-slate-900/30"
                                          : "border-slate-200 bg-white/80",
                                      )}
                                    >
                                      <div className="min-w-0">
                                        <p
                                          className={cn(
                                            "text-xs uppercase tracking-wide font-medium",
                                            isDark
                                              ? "text-slate-300"
                                              : "text-slate-600",
                                          )}
                                        >
                                          Target Replies
                                        </p>
                                        <p
                                          className={cn(
                                            "text-base font-semibold",
                                            isDark
                                              ? "text-slate-100"
                                              : "text-slate-800",
                                          )}
                                        >
                                          {typeof raidTarget.metrics
                                            .comments === "number"
                                            ? raidTarget.metrics.comments.toLocaleString()
                                            : (raidTarget.metrics.comments ??
                                              "Not specified")}
                                        </p>
                                      </div>
                                      <div
                                        className={cn(
                                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                          isDark
                                            ? "bg-[#fafafa]0/10 border border-slate-700 text-slate-100"
                                            : "bg-[#fafafa] border border-neutral-200 text-[#ff7a1a]",
                                        )}
                                      >
                                        <MessageCircle className="h-6 w-6" />
                                      </div>
                                    </div>

                                    <div
                                      className={cn(
                                        "rounded-2xl p-5 border flex items-center justify-between gap-4",
                                        isDark
                                          ? "border-slate-700 bg-slate-900/30"
                                          : "border-slate-200 bg-white/80",
                                      )}
                                    >
                                      <div className="min-w-0">
                                        <p
                                          className={cn(
                                            "text-xs uppercase tracking-wide font-medium",
                                            isDark
                                              ? "text-slate-300"
                                              : "text-slate-600",
                                          )}
                                        >
                                          Target Retweets
                                        </p>
                                        <p
                                          className={cn(
                                            "text-base font-semibold",
                                            isDark
                                              ? "text-slate-100"
                                              : "text-slate-800",
                                          )}
                                        >
                                          {typeof raidTarget.metrics
                                            .retweets === "number"
                                            ? raidTarget.metrics.retweets.toLocaleString()
                                            : (raidTarget.metrics.retweets ??
                                              "Not specified")}
                                        </p>
                                      </div>
                                      <div
                                        className={cn(
                                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                          isDark
                                            ? "bg-[#fafafa]0/10 border border-slate-700 text-slate-100"
                                            : "bg-[#fafafa] border border-neutral-200 text-[#ff7a1a]",
                                        )}
                                      >
                                        <Share2 className="h-6 w-6" />
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div
                                  className={cn(
                                    "rounded-xl border p-4 sm:p-5 space-y-3",
                                    isDark
                                      ? "border-slate-700 bg-white/[0.04]"
                                      : "border-neutral-200 bg-white",
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    <Info
                                      className={cn(
                                        "h-5 w-5 shrink-0 mt-0.5",
                                        isDark
                                          ? "text-[#ffa35c]"
                                          : "text-[#ff7a1a]",
                                      )}
                                      aria-hidden
                                    />
                                    <div className="min-w-0 space-y-3">
                                      <p
                                        className={cn(
                                          "text-sm font-semibold",
                                          isDark
                                            ? "text-slate-100"
                                            : "text-slate-900",
                                        )}
                                      >
                                        How points and participation work (raid)
                                      </p>
                                      <p
                                        className={cn(
                                          "text-sm leading-relaxed",
                                          isDark
                                            ? "text-slate-200"
                                            : "text-slate-700",
                                        )}
                                      >
                                        The more you quote-repost, comment, and
                                        retweet in relation to the{" "}
                                        <strong>target tweet</strong>, the more
                                        points you can earn. You can also earn
                                        additional points based on the{" "}
                                        <strong>quality and reach</strong> of
                                        your own posts.
                                      </p>
                                      <p
                                        className={cn(
                                          "text-sm leading-relaxed",
                                          isDark
                                            ? "text-slate-200"
                                            : "text-slate-700",
                                        )}
                                      >
                                        After you engage, open the{" "}
                                        <strong>Leaderboard</strong> or{" "}
                                        <strong>Twitter Feed</strong> tab and
                                        use the <strong>Refresh</strong> button
                                        there to pull the latest numbers.
                                        You&apos;ll see your participation
                                        (tweets, quotes, comments) and your
                                        points and ranking.
                                      </p>
                                      <p
                                        className={cn(
                                          "text-sm leading-relaxed",
                                          isDark
                                            ? "text-slate-200"
                                            : "text-slate-700",
                                        )}
                                      >
                                        <strong>New to raids?</strong> You need
                                        at least one qualifying action—such as a
                                        retweet, quote repost, or comment on the
                                        target tweet—to be eligible for points
                                        (see Brief & Participation Guidelines
                                        for more detailed info & rules). We
                                        don&apos;t publish a fixed points
                                        formula; points reflect engagement
                                        quality and reach: stronger, authentic
                                        engagement generally earns more points.
                                      </p>
                                      <p
                                        className={cn(
                                          "text-sm leading-relaxed",
                                          isDark
                                            ? "text-slate-200"
                                            : "text-slate-700",
                                        )}
                                      >
                                        <strong>Tip:</strong> The more you
                                        engage, the more points you can earn.
                                        Don&apos;t compromise on quality and
                                        avoid spam.
                                      </p>
                                      {raidCpmPer1000Usd ? (
                                        <p
                                          className={cn(
                                            "text-sm leading-relaxed",
                                            isDark
                                              ? "text-slate-200"
                                              : "text-slate-700",
                                          )}
                                        >
                                          <strong>Earnings (CPM):</strong> This
                                          contest pays{" "}
                                          <strong>{raidCpmPer1000Usd}</strong>{" "}
                                          per <strong>1,000 points</strong>—that
                                          rate is the CPM/Pay Rate shown under
                                          Earning Opportunities above.
                                        </p>
                                      ) : (
                                        <p
                                          className={cn(
                                            "text-sm leading-relaxed",
                                            isDark
                                              ? "text-slate-300"
                                              : "text-slate-600",
                                          )}
                                        >
                                          Prize rules for this format are listed
                                          under{" "}
                                          <strong>Earning Opportunities</strong>{" "}
                                          and the contest brief.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {(twitterKeywords.length > 0 ||
                                  twitterMentions.length > 0) && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {twitterKeywords.length > 0 && (
                                      <div>
                                        <p
                                          className={cn(
                                            "text-xs uppercase tracking-wide font-medium mb-1",
                                            isDark
                                              ? "text-slate-300"
                                              : "text-slate-600",
                                          )}
                                        >
                                          Suggested Keywords & Hashtags
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {twitterKeywords.map(
                                            (keyword: string, idx: number) => (
                                              <Badge
                                                key={`${keyword}-${idx}`}
                                                variant="outline"
                                                className={cn(
                                                  "rounded-full text-xs px-3 py-1",
                                                  isDark
                                                    ? "border-slate-600 text-slate-100"
                                                    : "border-slate-300 text-slate-800",
                                                )}
                                              >
                                                {keyword}
                                              </Badge>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {twitterMentions.length > 0 && (
                                      <div>
                                        <p
                                          className={cn(
                                            "text-xs uppercase tracking-wide font-medium mb-1",
                                            isDark
                                              ? "text-slate-300"
                                              : "text-slate-600",
                                          )}
                                        >
                                          Accounts to Mention
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {twitterMentions.map(
                                            (mention: string, idx: number) => (
                                              <Badge
                                                key={`${mention}-${idx}`}
                                                variant="outline"
                                                className={cn(
                                                  "rounded-full text-xs px-3 py-1",
                                                  isDark
                                                    ? "border-slate-600 text-slate-100"
                                                    : "border-slate-300 text-slate-800",
                                                )}
                                              >
                                                {mention}
                                              </Badge>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          );
                        })()}

                        {/* Required Keywords & Mentions for all Twitter contests */}
                        {(() => {
                          const twitterCampaign = (contest as any)
                            .contest_based_details?.twitter_campaign;
                          const twitterKeywords =
                            twitterCampaign?.keywords || [];
                          const twitterMentions =
                            twitterCampaign?.mentions || [];

                          return (
                            contest.platform?.toLowerCase() === "twitter" &&
                            (twitterKeywords.length > 0 ||
                              twitterMentions.length > 0) && (
                              <div
                                className={cn(
                                  "rounded-2xl p-5 border space-y-3",
                                  isDark
                                    ? "bg-slate-900/40 border-slate-700"
                                    : "border border-neutral-200 bg-white border-slate-200",
                                )}
                              >
                                <h4
                                  className={cn(
                                    "font-semibold text-sm flex items-center gap-2",
                                    isDark
                                      ? "text-slate-100"
                                      : "text-slate-900",
                                  )}
                                >
                                  Required Keywords & Mentions
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {twitterKeywords.length > 0 && (
                                    <div>
                                      <p
                                        className={cn(
                                          "text-xs uppercase tracking-wide font-medium mb-1",
                                          isDark
                                            ? "text-slate-300"
                                            : "text-slate-600",
                                        )}
                                      >
                                        Keywords & Hashtags
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {twitterKeywords.map(
                                          (keyword: string, idx: number) => (
                                            <Badge
                                              key={`req-keyword-${keyword}-${idx}`}
                                              variant="outline"
                                              className={cn(
                                                "rounded-full text-xs px-3 py-1",
                                                isDark
                                                  ? "border-slate-600 text-slate-100"
                                                  : "border-slate-300 text-slate-800",
                                              )}
                                            >
                                              {keyword}
                                            </Badge>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {twitterMentions.length > 0 && (
                                    <div>
                                      <p
                                        className={cn(
                                          "text-xs uppercase tracking-wide font-medium mb-1",
                                          isDark
                                            ? "text-slate-300"
                                            : "text-slate-600",
                                        )}
                                      >
                                        Accounts to Mention
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {twitterMentions.map(
                                          (mention: string, idx: number) => (
                                            <Badge
                                              key={`req-mention-${mention}-${idx}`}
                                              variant="outline"
                                              className={cn(
                                                "rounded-full text-xs px-3 py-1",
                                                isDark
                                                  ? "border-slate-600 text-slate-100"
                                                  : "border-slate-300 text-slate-800",
                                              )}
                                            >
                                              {mention}
                                            </Badge>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          );
                        })()}

                        {/* Brief Section — Figma Content Requirements / Brief Card */}
                        <div
                          className={cn(
                            "overflow-hidden rounded-2xl border",
                            isDark
                              ? "border-slate-700 bg-transparent"
                              : "border-[#e5e5e5] bg-white",
                          )}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-between border-b px-5 py-3.5",
                              isDark
                                ? "border-slate-700 bg-white/[0.04]"
                                : "border-[#e5e5e5] bg-[#fafafa]",
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border",
                                  isDark
                                    ? "border-slate-600 bg-white/10"
                                    : "border-[#e5e5e5] bg-white",
                                )}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src="/images/contest-details/brief-file-sm.svg"
                                  alt=""
                                  width={15}
                                  height={15}
                                  className="h-[15px] w-[15px]"
                                />
                              </div>
                              <h4
                                className={cn(
                                  "flex items-center gap-2 text-[15px] font-semibold",
                                  isDark ? "text-white" : "text-[#0a0a0a]",
                                )}
                              >
                                Brief
                                {!showDetailBriefByPlatform &&
                                detailVideoPlatforms.length >= 2 &&
                                detailPlatformTab === ALL_PLATFORM_TAB ? (
                                  <ContestDetailSharedAcrossPlatformsHint
                                    platforms={detailVideoPlatforms}
                                  />
                                ) : null}
                              </h4>
                            </div>
                            <CopyContentButton
                              what="brief"
                              isDark={isDark}
                              getContent={() =>
                                copyPayloadFromElement(briefCopyRef.current)
                              }
                            />
                          </div>
                          <div
                            ref={briefCopyRef}
                            className="space-y-4 px-6 pb-6 pt-[22px]"
                          >
                            {showDetailBriefByPlatform ? (
                              <div className="space-y-3">
                                {groupPlatformsByBrief(
                                  contest,
                                  detailVideoPlatforms,
                                ).map((platforms) => {
                                  const html = preferRichestHtmlAmong(
                                    platforms.map((platform) =>
                                      briefHtmlForPlatform(contest, platform),
                                    ),
                                  );
                                  return (
                                    <ContestDetailPlatformScopeCard
                                      key={`brief-${platforms.join("-")}`}
                                      platforms={platforms}
                                      isDark={isDark}
                                      variant="subtle"
                                    >
                                      {html ? (
                                        <div
                                          className={cn(
                                            "prose prose-sm max-w-none [&_a]:break-words [&_a]:hover:underline",
                                            isDark
                                              ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_a]:!text-[#ffa35c] [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white"
                                              : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700",
                                          )}
                                          dangerouslySetInnerHTML={{
                                            __html: html,
                                          }}
                                        />
                                      ) : (
                                        <p
                                          className={cn(
                                            "text-sm",
                                            isDark
                                              ? "text-slate-300"
                                              : "text-slate-700",
                                          )}
                                        >
                                          No brief provided
                                        </p>
                                      )}
                                    </ContestDetailPlatformScopeCard>
                                  );
                                })}
                              </div>
                            ) : (
                              (() => {
                                const sharedBriefHtml =
                                  detailVideoPlatforms.length >= 2 &&
                                  detailPlatformTab === ALL_PLATFORM_TAB
                                    ? preferRichestHtmlAmong(
                                        detailVideoPlatforms.map((platform) =>
                                          briefHtmlForPlatform(
                                            contest,
                                            platform,
                                          ),
                                        ),
                                      )
                                    : detailContest?.brief_html;
                                return sharedBriefHtml ? (
                                  <div
                                    className={cn(
                                      "prose prose-sm max-w-none [&_a]:break-words [&_a]:hover:underline",
                                      isDark
                                        ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_a]:!text-[#ffa35c] [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white"
                                        : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700",
                                    )}
                                    dangerouslySetInnerHTML={{
                                      __html: sharedBriefHtml,
                                    }}
                                  />
                                ) : (
                                  <p
                                    className={cn(
                                      "text-slate-600 dark:text-slate-400 text-sm",
                                      isDark
                                        ? "text-slate-300"
                                        : "text-slate-700",
                                    )}
                                  >
                                    No brief provided
                                  </p>
                                );
                              })()
                            )}
                          </div>
                        </div>

                        {/* Content Type — Figma CLIPPING row */}
                        {(detailContest as any)?.content_type && (
                          <div
                            className={cn(
                              "flex w-full items-center gap-3 overflow-hidden rounded-[14px] border py-3.5 pl-[18px] pr-5",
                              isDark
                                ? "border-slate-700 bg-white/[0.04]"
                                : "border-[#e5e5e5] bg-[#fafafa]",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border",
                                isDark
                                  ? "border-slate-600 bg-white/10"
                                  : "border-[#e5e5e5] bg-white",
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="/images/contest-details/content-scissors.svg"
                                alt=""
                                width={15}
                                height={15}
                                className="h-[15px] w-[15px]"
                              />
                            </div>
                            <span className="shrink-0 rounded-md bg-[#0a0a0a] px-2.5 py-1 text-[11px] font-bold tracking-[0.88px] text-white">
                              {(
                                detailContest as any
                              ).content_type.toUpperCase()}
                            </span>
                            <p
                              className={cn(
                                "min-w-0 flex-1 text-sm font-medium leading-normal",
                                isDark ? "text-slate-200" : "text-[#404040]",
                              )}
                            >
                              {(detailContest as any).content_type === "ugc"
                                ? "Create Face videos"
                                : (detailContest as any).content_type ===
                                    "clipping"
                                  ? "Video editing and clipping"
                                  : "Check rules to find out what kind of content you need to create"}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 4. PARTICIPATION GUIDELINES - Rules and Terms */}
                      <div
                        id="participation-guidelines"
                        ref={(el) => {
                          sectionRefs.current["participation-guidelines"] = el;
                        }}
                        className={cn(surfaceClass, "space-y-6 p-7 empty:hidden overflow-hidden")}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              isDark ? "bg-white/10" : "bg-[#f5f5f5]",
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/images/contest-details/guide-book.svg"
                              alt=""
                              width={20}
                              height={20}
                              className="h-5 w-5"
                            />
                          </div>
                          <div>
                            <h3
                              className={cn(
                                "text-xl font-semibold tracking-[-0.3px]",
                                isDark ? "text-white" : "text-[#0a0a0a]",
                              )}
                            >
                              Participation Guidelines
                            </h3>
                            <p
                              className={cn(
                                "text-[13px]",
                                isDark ? "text-slate-300" : "text-[#737373]",
                              )}
                            >
                              Rules & guidelines — breaking them may lead to
                              rejection
                            </p>
                          </div>
                        </div>
                        {/* Rules & Guidelines Section — Figma Rules Card */}
                        <div
                          className={cn(
                            "overflow-hidden rounded-2xl border",
                            isDark
                              ? "border-slate-700 bg-transparent"
                              : "border-[#e5e5e5] bg-white",
                          )}
                        >
                          <div
                            className={cn(
                              "flex flex-col gap-3 border-b px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between",
                              isDark
                                ? "border-slate-700 bg-white/[0.04]"
                                : "border-[#e5e5e5] bg-[#fafafa]",
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div
                                className={cn(
                                  "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border",
                                  isDark
                                    ? "border-slate-600 bg-white/10"
                                    : "border-[#e5e5e5] bg-white",
                                )}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src="/images/contest-details/guide-scroll.svg"
                                  alt=""
                                  width={15}
                                  height={15}
                                  className="h-[15px] w-[15px]"
                                />
                              </div>
                              <h4
                                className={cn(
                                  "flex flex-wrap items-center gap-2 text-[15px] font-semibold",
                                  isDark ? "text-white" : "text-[#0a0a0a]",
                                )}
                              >
                                Rules & Guidelines
                                {!showDetailRulesByPlatform &&
                                detailVideoPlatforms.length >= 2 &&
                                detailPlatformTab === ALL_PLATFORM_TAB ? (
                                  <ContestDetailSharedAcrossPlatformsHint
                                    platforms={detailVideoPlatforms}
                                  />
                                ) : null}
                              </h4>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <CopyContentButton
                                what="rules"
                                isDark={isDark}
                                getContent={() =>
                                  copyPayloadFromElement(rulesCopyRef.current)
                                }
                              />
                              <div className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-[#e6d3a3] bg-[#fff6e0] py-[5px] pl-2.5 pr-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src="/images/contest-details/guide-alert.svg"
                                  alt=""
                                  width={13}
                                  height={13}
                                  className="h-[13px] w-[13px]"
                                />
                                <span className="text-xs font-semibold text-[#8a6a1f]">
                                  Breaking rules may lead to rejection
                                </span>
                              </div>
                            </div>
                          </div>
                          <div
                            ref={rulesCopyRef}
                            className="space-y-4 px-6 pb-6 pt-[22px]"
                          >
                            {/* Check multiple possible rule fields */}
                            {showDetailRulesByPlatform ? (
                              <div className="space-y-3">
                                {groupPlatformsByRules(
                                  contest,
                                  detailVideoPlatforms,
                                ).map((platforms) => {
                                  const html = preferRichestHtmlAmong(
                                    platforms.map((platform) =>
                                      rulesHtmlForPlatform(contest, platform),
                                    ),
                                  );
                                  return (
                                    <ContestDetailPlatformScopeCard
                                      key={`rules-${platforms.join("-")}`}
                                      platforms={platforms}
                                      isDark={isDark}
                                      variant="subtle"
                                    >
                                      {html ? (
                                        <div
                                          className={cn(
                                            "prose prose-sm max-w-none [&_a]:break-words [&_a]:hover:underline",
                                            isDark
                                              ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_a]:!text-[#ffa35c] [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white"
                                              : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700",
                                          )}
                                          dangerouslySetInnerHTML={{
                                            __html: html,
                                          }}
                                        />
                                      ) : (
                                        <p
                                          className={cn(
                                            "text-sm",
                                            isDark
                                              ? "text-slate-300"
                                              : "text-slate-700",
                                          )}
                                        >
                                          No rules provided
                                        </p>
                                      )}
                                    </ContestDetailPlatformScopeCard>
                                  );
                                })}
                              </div>
                            ) : (
                              (() => {
                                const sharedRulesHtml =
                                  detailVideoPlatforms.length >= 2 &&
                                  detailPlatformTab === ALL_PLATFORM_TAB
                                    ? preferRichestHtmlAmong(
                                        detailVideoPlatforms.map((platform) =>
                                          rulesHtmlForPlatform(
                                            contest,
                                            platform,
                                          ),
                                        ),
                                      )
                                    : (detailContest as any)?.rules_html;
                                return (
                                  <>
                                    {sharedRulesHtml ? (
                                      <div
                                        className={cn(
                                          "prose prose-sm max-w-none [&_a]:break-words [&_a]:hover:underline",
                                          isDark
                                            ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_a]:!text-[#ffa35c] [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white"
                                            : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700",
                                        )}
                                        dangerouslySetInnerHTML={{
                                          __html: sharedRulesHtml,
                                        }}
                                      />
                                    ) : contest.rules ? (
                                      <div
                                        className={cn(
                                          "text-sm leading-relaxed whitespace-pre-wrap",
                                          isDark
                                            ? "text-slate-300"
                                            : "text-slate-700",
                                        )}
                                      >
                                        {contest.rules}
                                      </div>
                                    ) : contest.rules_description ? (
                                      <div
                                        className={cn(
                                          "text-sm leading-relaxed whitespace-pre-wrap",
                                          isDark
                                            ? "text-slate-300"
                                            : "text-slate-700",
                                        )}
                                      >
                                        {contest.rules_description}
                                      </div>
                                    ) : (contest as any).rules_text ? (
                                      <div
                                        className={cn(
                                          "text-sm leading-relaxed whitespace-pre-wrap",
                                          isDark
                                            ? "text-slate-300"
                                            : "text-slate-700",
                                        )}
                                      >
                                        {(contest as any).rules_text}
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        <div
                                          className={cn(
                                            "text-sm leading-relaxed",
                                            isDark
                                              ? "text-slate-300"
                                              : "text-slate-700",
                                          )}
                                        >
                                          <h4
                                            className={cn(
                                              "font-semibold mb-2",
                                              isDark
                                                ? "text-slate-100"
                                                : "text-slate-900",
                                            )}
                                          >
                                            General Rules:
                                          </h4>
                                          <ul
                                            className={cn(
                                              "space-y-2 ml-4 list-disc",
                                              isDark
                                                ? "text-slate-400"
                                                : "text-slate-600",
                                            )}
                                          >
                                            <li>
                                              <strong>Eligibility:</strong> Only
                                              registered creators are eligible
                                              to participate in contests.
                                            </li>
                                            <li>
                                              <strong>Age Requirement:</strong>{" "}
                                              Contestants must be at least 18
                                              years old.
                                            </li>
                                            <li>
                                              <strong>
                                                Content Standards:
                                              </strong>{" "}
                                              Content must adhere to the
                                              platform's content guidelines and
                                              community standards.
                                            </li>
                                            <li>
                                              <strong>Original Work:</strong>{" "}
                                              All submissions must be original
                                              content created by the
                                              participant.
                                            </li>
                                            <li>
                                              <strong>
                                                Submission Deadline:
                                              </strong>{" "}
                                              Entries must be submitted before
                                              the contest end date and time.
                                            </li>
                                            <li>
                                              <strong>
                                                Platform Compliance:
                                              </strong>{" "}
                                              Content must comply with the rules
                                              and policies of the specified
                                              platform (YouTube, Instagram,
                                              etc.).
                                            </li>
                                          </ul>
                                        </div>

                                        <div
                                          className={cn(
                                            "border-t pt-3",
                                            isDark
                                              ? "border-slate-600"
                                              : "border-slate-200",
                                          )}
                                        >
                                          <h4
                                            className={cn(
                                              "font-semibold mb-2",
                                              isDark
                                                ? "text-slate-100"
                                                : "text-slate-900",
                                            )}
                                          >
                                            ⚠️ Important Notes:
                                          </h4>
                                          <ul
                                            className={cn(
                                              "space-y-1 ml-4 list-disc text-sm",
                                              isDark
                                                ? "text-slate-400"
                                                : "text-slate-600",
                                            )}
                                          >
                                            <li>
                                              Violation of rules may result in
                                              disqualification
                                            </li>
                                            <li>
                                              Contest organizers reserve the
                                              right to verify submissions
                                            </li>
                                            <li>
                                              Winners will be contacted through
                                              their registered email
                                            </li>
                                            <li>
                                              Prize distribution is subject to
                                              verification and approval
                                            </li>
                                          </ul>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()
                            )}
                          </div>
                        </div>

                        {/* Terms & Conditions for CPM contests — Figma card */}
                        {isCpmContestType(detailContest?.contest_type) &&
                          detailContest?.contest_based_details?.cpm_contest
                            ?.terms_conditions && (
                            <div
                              className={cn(
                                "overflow-hidden rounded-2xl border",
                                isDark
                                  ? "border-slate-700 bg-transparent"
                                  : "border-[#e5e5e5] bg-white",
                              )}
                            >
                              <div
                                className={cn(
                                  "flex w-full items-center gap-2.5 border-b px-5 py-3.5",
                                  isDark
                                    ? "border-slate-700 bg-white/[0.04]"
                                    : "border-[#e5e5e5] bg-[#fafafa]",
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border",
                                    isDark
                                      ? "border-slate-600 bg-white/10"
                                      : "border-[#e5e5e5] bg-white",
                                  )}
                                >
                                  <ScrollText
                                    className={cn(
                                      "h-[15px] w-[15px]",
                                      isDark
                                        ? "text-slate-200"
                                        : "text-[#404040]",
                                    )}
                                  />
                                </div>
                                <h4
                                  className={cn(
                                    "min-w-0 flex-1 text-[15px] font-semibold",
                                    isDark ? "text-white" : "text-[#0a0a0a]",
                                  )}
                                >
                                  Terms & Conditions
                                </h4>
                                <CopyContentButton
                                  what="terms"
                                  isDark={isDark}
                                  getContent={() =>
                                    copyPayloadFromElement(termsCopyRef.current)
                                  }
                                />
                              </div>
                              <div
                                ref={termsCopyRef}
                                className="px-6 pb-6 pt-[22px]"
                              >
                                <div
                                  className={cn(
                                    "rounded-xl border px-[18px] py-4",
                                    isDark
                                      ? "border-slate-700 bg-white/[0.04]"
                                      : "border-[#e5e5e5] bg-[#fafafa]",
                                  )}
                                >
                                  <pre
                                    className={cn(
                                      "whitespace-pre-wrap break-words font-sans text-[13px] leading-[1.7]",
                                      isDark
                                        ? "text-slate-200"
                                        : "text-[#404040]",
                                    )}
                                  >
                                    {
                                      detailContest.contest_based_details
                                        .cpm_contest.terms_conditions
                                    }
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>

                      {/* 5. RESOURCES & TOOLS - Essential for Participation */}
                      <div
                        id="resources-tools"
                        ref={(el) => {
                          sectionRefs.current["resources-tools"] = el;
                        }}
                        className={cn(surfaceClass, "space-y-6 p-7 empty:hidden overflow-hidden")}
                      >
                        {(() => {
                          const resourceGroups =
                            detailVideoPlatforms.length >= 2
                              ? detailPlatformTab === ALL_PLATFORM_TAB
                                ? (() => {
                                    const groups = groupPlatformsByResources(
                                      contest.resources,
                                      detailVideoPlatforms,
                                    );
                                    const showLabels = groups.length > 1;
                                    return groups.map((platforms) => ({
                                      platforms: showLabels ? platforms : null,
                                      items: resourcesForPlatform(
                                        contest.resources,
                                        platforms[0],
                                      ),
                                    }));
                                  })()
                                : [
                                    {
                                      platforms: null as
                                        | VideoContestPlatform[]
                                        | null,
                                      items: resourcesForPlatform(
                                        contest.resources,
                                        detailScopedPlatform,
                                      ),
                                    },
                                  ]
                              : [
                                  {
                                    platforms: null as
                                      | VideoContestPlatform[]
                                      | null,
                                    items: flattenContestResources(
                                      contest.resources,
                                    ),
                                  },
                                ];
                          const hasAny = resourceGroups.some(
                            (group) => group.items.length > 0,
                          );
                          const showSharedIcons =
                            detailVideoPlatforms.length >= 2 &&
                            detailPlatformTab === ALL_PLATFORM_TAB &&
                            resourceGroups.length === 1 &&
                            resourceGroups[0]?.platforms == null;
                          return (
                            <>
                              <h3
                                className={cn(
                                  titleClass,
                                  "flex items-center gap-2 text-xl",
                                )}
                              >
                                <Lightbulb className="h-5 w-5 text-[#ff7a1a]" />
                                Resources & Tools
                                {showSharedIcons ? (
                                  <ContestDetailSharedAcrossPlatformsHint
                                    platforms={detailVideoPlatforms}
                                  />
                                ) : null}
                                {hasAny ? (
                                  <CopyContentButton
                                    what="resources"
                                    isDark={isDark}
                                    className="ml-auto"
                                    getContent={() =>
                                      formatLinkListForCopy(
                                        "Resources & Tools",
                                        resourceGroups.map(
                                          (group): CopyLinkGroup => ({
                                            label: group.platforms
                                              ?.map(
                                                (pl) =>
                                                  VIDEO_PLATFORM_LABELS[pl],
                                              )
                                              .join(", "),
                                            items: group.items.map(
                                              (r: any) => ({
                                                url: r.url,
                                                title: r.description,
                                              }),
                                            ),
                                          }),
                                        ),
                                      )
                                    }
                                  />
                                ) : null}
                              </h3>
                              {!hasAny ? (
                                <p
                                  className={cn(
                                    "text-sm",
                                    isDark
                                      ? "text-slate-300"
                                      : "text-slate-600",
                                  )}
                                >
                                  No resources provided for this campaign.
                                </p>
                              ) : (
                                <div className="space-y-6">
                                  {resourceGroups.map((group, groupIdx) => {
                                    if (group.items.length === 0) return null;
                                    const itemsGrid = (
                                      <div className="grid gap-4">
                                        {group.items.map(
                                          (resource: any, idx: number) => {
                                            const isImage =
                                              resource.url &&
                                              (resource.url.startsWith(
                                                "data:image",
                                              ) ||
                                                /\.(jpg|jpeg|png|gif|jfif|webp)$/i.test(
                                                  resource.url,
                                                ));
                                            const isPdf =
                                              resource.url &&
                                              /\.pdf$/i.test(resource.url);
                                            const isVideo =
                                              resource.url &&
                                              /\.(mp4|mov|avi|webm)$/i.test(
                                                resource.url,
                                              );
                                            const isInternal =
                                              resource.type === "internal";
                                            return (
                                              <div
                                                key={`${group.platforms?.join("-") ?? "all"}-${idx}`}
                                                className={cn(
                                                  "rounded-2xl border p-4",
                                                  isDark
                                                    ? "border-slate-700 bg-[#12032c]"
                                                    : "border-neutral-200 bg-[#fafafa]",
                                                )}
                                              >
                                                <div className="flex flex-col md:flex-row justify-between">
                                                  <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    {isInternal &&
                                                    isImage &&
                                                    !isPdf ? (
                                                      <img
                                                        src={resource.url}
                                                        alt={
                                                          resource.description
                                                        }
                                                        className="w-12 h-12 object-cover rounded-lg dark:border-slate-700"
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
                                                    ) : isInternal &&
                                                      isVideo ? (
                                                      <div className="w-12 h-12 bg-[#fafafa] dark:bg-white/[0.04] rounded-lg flex items-center justify-center border border-neutral-200 dark:border-slate-700">
                                                        <svg
                                                          className="w-6 h-6 text-[#ff7a1a] dark:text-[#ffa35c]"
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
                                                      <div className="w-12 h-12 bg-[#fafafa] dark:bg-white/[0.04] rounded-lg flex items-center justify-center border border-neutral-200 dark:border-slate-700">
                                                        <svg
                                                          className="w-6 h-6 text-[#ff7a1a] dark:text-[#ffa35c]"
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
                                                            : "bg-[#fff1e6] text-[#ff7a1a]",
                                                        )}
                                                      >
                                                        <ExternalLink className="h-5 w-5" />
                                                      </div>
                                                    )}
                                                    <div className="min-w-0">
                                                      <h4
                                                        className={cn(
                                                          "text-base font-semibold text-gray-900 dark:text-gray-100 mb-1",
                                                          isDark
                                                            ? "text-white"
                                                            : "text-slate-700",
                                                        )}
                                                      >
                                                        {resource.description}
                                                      </h4>
                                                      <p
                                                        className={cn(
                                                          "text-sm text-gray-600 dark:text-gray-400",
                                                          isDark
                                                            ? "text-gray-300"
                                                            : "text-slate-700",
                                                        )}
                                                      >
                                                        {resource.type ===
                                                        "external"
                                                          ? "External Link"
                                                          : "Uploaded File"}
                                                      </p>
                                                    </div>
                                                  </div>
                                                  <div className="mt-3 flex items-center gap-2 md:mt-0">
                                                    {isCopyableUrl(
                                                      resource.url,
                                                    ) ? (
                                                      <CopyContentButton
                                                        what="link"
                                                        variant="item"
                                                        isDark={isDark}
                                                        className="h-9 w-9"
                                                        getContent={() =>
                                                          linkCopyPayload(
                                                            resource.url,
                                                          )
                                                        }
                                                      />
                                                    ) : null}
                                                    <Button
                                                      size="sm"
                                                      asChild
                                                      className="rounded-full goc-btn-primary px-4 py-2 text-sm"
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
                                              </div>
                                            );
                                          },
                                        )}
                                      </div>
                                    );
                                    if (
                                      group.platforms &&
                                      group.platforms.length > 0
                                    ) {
                                      return (
                                        <ContestDetailPlatformScopeCard
                                          key={
                                            group.platforms.join("-") ??
                                            `all-${groupIdx}`
                                          }
                                          platforms={group.platforms}
                                          isDark={isDark}
                                        >
                                          {itemsGrid}
                                        </ContestDetailPlatformScopeCard>
                                      );
                                    }
                                    return (
                                      <div key={`all-${groupIdx}`}>
                                        {itemsGrid}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Inspiration Links Section */}
                      {(() => {
                        const inspirationGroups =
                          detailVideoPlatforms.length >= 2
                            ? detailPlatformTab === ALL_PLATFORM_TAB
                              ? (() => {
                                  const groups =
                                    groupPlatformsByInspirationLinks(
                                      contest.inspiration_links,
                                      detailVideoPlatforms,
                                    );
                                  const showLabels = groups.length > 1;
                                  return groups.map((platforms) => ({
                                    platforms: showLabels ? platforms : null,
                                    links: inspirationLinksForPlatform(
                                      contest.inspiration_links,
                                      platforms[0],
                                    ).filter(
                                      (link) =>
                                        typeof link?.url === "string" &&
                                        link.url.trim() !== "",
                                    ),
                                  }));
                                })()
                              : [
                                  {
                                    platforms: null as
                                      | VideoContestPlatform[]
                                      | null,
                                    links: inspirationLinksForPlatform(
                                      contest.inspiration_links,
                                      detailScopedPlatform,
                                    ).filter(
                                      (link) =>
                                        typeof link?.url === "string" &&
                                        link.url.trim() !== "",
                                    ),
                                  },
                                ]
                            : [
                                {
                                  platforms: null as
                                    | VideoContestPlatform[]
                                    | null,
                                  links: flattenContestInspirationLinks(
                                    contest.inspiration_links,
                                  ).filter(
                                    (link) =>
                                      typeof link?.url === "string" &&
                                      link.url.trim() !== "",
                                  ),
                                },
                              ];
                        const hasLinks = inspirationGroups.some(
                          (group) => group.links.length > 0,
                        );
                        if (!hasLinks) return null;

                        return (
                          <>
                            <div
                              id="inspiration-links"
                              ref={(el) => {
                                sectionRefs.current["inspiration-links"] = el;
                              }}
                              className={cn(surfaceClass, "space-y-6 scroll-mt-48 p-7 overflow-hidden")}
                            >
                              <div className="flex items-center gap-3">
                                <h3
                                  className={cn(
                                    "text-xl font-semibold flex flex-1 items-center gap-2",
                                    isDark ? "text-white" : "text-slate-900",
                                  )}
                                >
                                  Inspiration Links
                                  {detailVideoPlatforms.length >= 2 &&
                                  detailPlatformTab === ALL_PLATFORM_TAB &&
                                  inspirationGroups.length === 1 &&
                                  inspirationGroups[0]?.platforms == null ? (
                                    <ContestDetailSharedAcrossPlatformsHint
                                      platforms={detailVideoPlatforms}
                                    />
                                  ) : null}
                                </h3>
                                <CopyContentButton
                                  what="inspiration links"
                                  isDark={isDark}
                                  getContent={() =>
                                    formatLinkListForCopy(
                                      "Inspiration Links",
                                      inspirationGroups.map(
                                        (group): CopyLinkGroup => ({
                                          label: group.platforms
                                            ?.map(
                                              (pl) =>
                                                VIDEO_PLATFORM_LABELS[pl],
                                            )
                                            .join(", "),
                                          items: group.links.map((link) => ({
                                            url: processUrlWithCreator(
                                              link.url,
                                              userProfile?.username || "",
                                            ),
                                            note: link.description,
                                          })),
                                        }),
                                      ),
                                    )
                                  }
                                />
                              </div>

                              <div className="space-y-6">
                                {inspirationGroups.map((group, groupIdx) => {
                                  if (group.links.length === 0) return null;
                                  const linksGrid = (
                                    <div className="grid gap-4">
                                      {group.links.map(
                                        (
                                          item: {
                                            url: string;
                                            description: string;
                                          },
                                          index: number,
                                        ) => {
                                          const username =
                                            userProfile?.username || "";
                                          const processedUrl =
                                            processUrlWithCreator(
                                              item.url,
                                              username,
                                            );

                                          return (
                                            <div
                                              key={`${group.platforms?.join("-") ?? "all"}-${index}`}
                                              className={cn(
                                                "rounded-2xl border p-4",
                                                isDark
                                                  ? "border-slate-700 bg-[#12032c]"
                                                  : "border-neutral-200 bg-[#fafafa]",
                                              )}
                                            >
                                              <div className="flex items-start gap-4">
                                                <div
                                                  className={cn(
                                                    "p-3 rounded-full flex-shrink-0",
                                                    isDark
                                                      ? "bg-[#FFFFFF42] text-white"
                                                      : "bg-[#fff1e6] text-[#ff7a1a]",
                                                  )}
                                                >
                                                  <ExternalLink className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <a
                                                    href={processedUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={cn(
                                                      "block text-base font-medium text-[#ff7a1a] hover:underline mb-2 break-all",
                                                      isDark
                                                        ? "text-[#ffa35c]"
                                                        : "text-[#ff7a1a] dark:text-[#ffa35c] hover:text-slate-900 dark:hover:text-[#ffa35c]",
                                                    )}
                                                  >
                                                    {processedUrl}
                                                  </a>
                                                  {item.description && (
                                                    <p
                                                      className={cn(
                                                        "text-sm leading-relaxed",
                                                        isDark
                                                          ? "text-gray-300"
                                                          : "text-gray-700",
                                                      )}
                                                    >
                                                      {item.description}
                                                    </p>
                                                  )}
                                                </div>
                                                <CopyContentButton
                                                  what="link"
                                                  variant="item"
                                                  isDark={isDark}
                                                  getContent={() =>
                                                    linkCopyPayload(
                                                      processedUrl,
                                                    )
                                                  }
                                                />
                                              </div>
                                            </div>
                                          );
                                        },
                                      )}
                                    </div>
                                  );
                                  if (
                                    group.platforms &&
                                    group.platforms.length > 0
                                  ) {
                                    return (
                                      <ContestDetailPlatformScopeCard
                                        key={
                                          group.platforms.join("-") ??
                                          `insp-all-${groupIdx}`
                                        }
                                        platforms={group.platforms}
                                        isDark={isDark}
                                      >
                                        {linksGrid}
                                      </ContestDetailPlatformScopeCard>
                                    );
                                  }
                                  return (
                                    <div key={`insp-all-${groupIdx}`}>
                                      {linksGrid}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      {/* Tracking Links Section */}
                      {(() => {
                        let trackingLinks = Array.isArray(
                          contest.tracking_links,
                        )
                          ? contest.tracking_links
                          : [];
                        return trackingLinks.length > 0 ? (
                          <>
                            <div
                              id="tracking-links"
                              ref={(el) => {
                                sectionRefs.current["tracking-links"] = el;
                              }}
                              className={cn(surfaceClass, "space-y-4 scroll-mt-48 p-7 overflow-hidden")}
                            >
                              <div className="flex items-center gap-3">
                                <h4
                                  className={cn(
                                    "flex flex-1 items-center gap-2 text-xl font-semibold",
                                    isDark ? "text-white" : "text-slate-900",
                                  )}
                                >
                                  <Copy className="h-5 w-5 text-[#ff7a1a] dark:text-[#ffa35c]" />
                                  Tracking Links
                                </h4>
                                <CopyContentButton
                                  what="tracking links"
                                  isDark={isDark}
                                  getContent={() =>
                                    formatLinkListForCopy(
                                      "Tracking Links",
                                      [
                                        {
                                          items: trackingLinks.map(
                                            (item: {
                                              url: string;
                                              description: string;
                                            }) => ({
                                              url: processUrlWithCreator(
                                                item.url,
                                                userProfile?.username || "",
                                              ),
                                              note: item.description,
                                            }),
                                          ),
                                        },
                                      ],
                                    )
                                  }
                                />
                              </div>
                              {/* {contest.multiple_submissions_enabled && (
                        <div
                          className={cn(
                            "rounded-2xl border p-5",
                            isDark
                              ? "border-[#ffd9b8] bg-[#ff7a1a]/15"
                              : "bg-[#fafafa] border-neutral-200",
                          )}
                        >
                          <p
                            className={cn(
                              "text-sm flex items-start gap-2",
                              isDark ? "text-white" : "text-slate-900",
                            )}
                          >
                            <span className="text-base flex-shrink-0">📝</span>
                            <span>
                              <span className="font-semibold">Note:</span>{" "}
                              Change the sub1 and sub2 parameters according to
                              your submission number if you are doing multiple
                              submissions.
                            </span>
                          </p>
                        </div>
                      )} */}

                              <div className="grid gap-4">
                                {trackingLinks.map(
                                  (
                                    item: { url: string; description: string },
                                    index: number,
                                  ) => {
                                    // Process URL to replace [creator] with username
                                    const username =
                                      userProfile?.username || "";
                                    const processedUrl = processUrlWithCreator(
                                      item.url,
                                      username,
                                    );

                                    const handleCopyLink = async () => {
                                      try {
                                        await navigator.clipboard.writeText(
                                          processedUrl,
                                        );
                                        toast({
                                          title: "Link Copied!",
                                          description:
                                            "Tracking link has been copied to clipboard.",
                                          variant: "default",
                                        });
                                      } catch (error) {
                                        console.error(
                                          "Failed to copy link:",
                                          error,
                                        );
                                        toast({
                                          title: "Copy Failed",
                                          description:
                                            "Failed to copy link to clipboard.",
                                          variant: "destructive",
                                        });
                                      }
                                    };

                                    return (
                                      <div
                                        key={index}
                                        className={cn(
                                          "border rounded-lg p-4 hover:shadow-md transition-shadow duration-200",
                                          isDark
                                            ? "border-slate-700"
                                            : "bg-white border-slate-200",
                                        )}
                                      >
                                        <div className="flex items-start gap-3">
                                          <div
                                            className={cn(
                                              "mt-0.5 p-3 rounded-full flex-shrink-0",
                                              isDark
                                                ? "bg-white/[0.04] text-[#ffa35c]"
                                                : "bg-[#fafafa] text-[#ff7a1a]",
                                            )}
                                          >
                                            <Link2 className="h-5 w-5" />
                                          </div>
                                          <div className="flex-1 min-w-0 space-y-2">
                                            <div className="flex items-center justify-between gap-3">
                                              <p
                                                className={cn(
                                                  "text-md font-medium break-all transition-colors",
                                                  isDark
                                                    ? "text-[#ffa35c]"
                                                    : "text-black",
                                                )}
                                              >
                                                {processedUrl}
                                              </p>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleCopyLink}
                                                className={cn(
                                                  "p-2 h-auto rounded-md transition-colors duration-200 flex-shrink-0",
                                                  isDark
                                                    ? "text-white"
                                                    : "hover:bg-slate-100 text-slate-600",
                                                )}
                                                title="Copy link"
                                              >
                                                <Copy className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            {item.description && (
                                              <p
                                                className={cn(
                                                  "text-sm leading-relaxed",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-slate-600",
                                                )}
                                              >
                                                {item.description}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          </>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </TabPanel>

              {contest?.platform?.toLowerCase() === "twitter" && (
                <TabPanel value="twitter-feed" activeTab={activeTab}>
                  <div className="p-6">
                    <TwitterFeed
                      contestId={contestId}
                      contestTitle={contest?.title || "Contest"}
                      isDark={isDark}
                      showHeader={true}
                      lastMetricsUpdated={contest?.last_metrics_updated}
                      cooldownType="opportunities"
                      contestStatus={contest?.status}
                      postContestStatus={contest?.post_contest_status}
                      disableRefreshWhenContestEnded
                      creatorOnlyUserId={user?.id ?? null}
                    />
                  </div>
                </TabPanel>
              )}

              <TabPanel value="leaderboard" activeTab={activeTab}>
                {loadingLeaderboard ? (
                  <div className="p-6 space-y-4">
                    {(() => {
                      const twitterLb =
                        contest?.platform?.toLowerCase() === "twitter" ||
                        contest?.platform?.toLowerCase() === "x";
                      return (
                        <>
                          <div
                            className={cn(
                              surfaceClass,
                              "flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5",
                            )}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={cn(
                                    "inline-flex h-2 w-2 shrink-0 rounded-full animate-pulse",
                                    "bg-[var(--accent-btn-base)]",
                                  )}
                                  aria-hidden
                                />
                                <h2
                                  className={cn(
                                    titleClass,
                                    "truncate text-lg sm:text-xl",
                                  )}
                                >
                                  Leaderboard
                                </h2>
                              </div>
                              <p
                                className={cn(
                                  "text-xs sm:text-sm max-w-xl leading-relaxed",
                                  isDark ? "text-gray-400" : "text-gray-600",
                                )}
                              >
                                {twitterLb
                                  ? "Ranks and scores reflect data we already have for this contest. When the list appears, use Leaderboard Metrics to refresh all participants from X if you need the latest."
                                  : "Loading rankings and eligible submissions for this contest."}
                              </p>
                            </div>
                          </div>
                          <Card
                            className={cn(
                              "overflow-hidden shadow-none",
                              surfaceClass,
                            )}
                          >
                            <CardContent className="flex flex-col items-center justify-center gap-2 py-8 px-6">
                              <PageLoadingSpinner
                                mode={isDark ? "dark" : "light"}
                              />
                              <div className="text-center space-y-1">
                                <p
                                  className={cn(
                                    "text-sm font-semibold",
                                    isDark ? "text-white" : "text-gray-900",
                                  )}
                                >
                                  Loading leaderboard
                                </p>
                                <p
                                  className={cn(
                                    "text-xs max-w-sm mx-auto",
                                    isDark ? "text-gray-400" : "text-gray-600",
                                  )}
                                >
                                  {twitterLb
                                    ? "Fetching rows from the contest database. This is separate from syncing X; use Refresh all participants after load if you need a full pull."
                                    : "Fetching leaderboard data. Thanks for waiting."}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </>
                      );
                    })()}
                  </div>
                ) : error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {/* Show empty state if no leaderboard entries */}
                    {(isCreatorModeTotals
                      ? creatorWiseLeaderboard.length
                      : leaderboard.length) === 0 &&
                    effectiveLeaderboardTotalEntries === 0 ? (
                      <div className="text-center py-8">
                        <Trophy className="mx-auto h-12 w-12 text-slate-400" />
                        <p
                          className={cn(
                            "mb-2",
                            isDark ? "text-slate-300" : "text-slate-600",
                          )}
                        >
                          No submissions yet. Be the first!
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mb-3 grid grid-cols-1 gap-3 empty:hidden xl:grid-cols-2 [&>*:only-child]:col-span-full">
                        {/* Earnings View Mode Toggle - Show for both CPM and leaderboard contests with bonus */}
                        {/* Only show if contest is ended and payouts are processed */}
                        {(contest?.contest_type === "leaderboard" ||
                          isCpmContestType(contest?.contest_type) ||
                          isMilestoneContestType(contest?.contest_type)) &&
                          (contest.contest_based_details?.leaderboard_contest
                            ?.flat_fee_bonus ||
                            contest.contest_based_details?.cpm_contest
                              ?.flat_fee_bonus ||
                            (contest as any).bonus_details?.description_html ||
                            (opportunityMostVerifiedViewsBonus?.payout_cents ||
                              0) > 0 ||
                            (opportunityMostVerifiedReelsBonus?.payout_cents ||
                              0) > 0) &&
                          contest?.status?.toLowerCase() === "ended" &&
                          contest?.post_contest_status ===
                            "payouts_processed" && (
                            <div
                              className={cn(
                                "flex flex-col gap-3 p-4 rounded-2xl border sm:flex-row sm:items-center sm:justify-between",
                                isDark
                                  ? "bg-[#180438] border-slate-700"
                                  : "bg-white border-neutral-200",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "p-2 rounded-lg",
                                    isDark
                                      ? "bg-white/10 text-white"
                                      : "bg-[#fff1e6] text-[#ff7a1a]",
                                  )}
                                >
                                  <Eye className="h-4 w-4" />
                                </div>
                                <div>
                                  <span
                                    className={cn(
                                      "text-sm font-semibold",
                                      isDark ? "text-white" : "text-[#171717]",
                                    )}
                                  >
                                    Earnings Display
                                  </span>
                                  <p
                                    className={cn(
                                      "text-xs mt-0.5",
                                      isDark ? "text-white" : "text-slate-700",
                                    )}
                                  >
                                    Choose how to view your earnings breakdown
                                  </p>
                                </div>
                              </div>
                              <div
                                className={cn(
                                  "flex gap-1 rounded-xl p-1 w-full sm:w-auto sm:min-w-[15rem] sm:shrink-0",
                                  isDark ? "bg-white/[0.06]" : "bg-neutral-100",
                                )}
                              >
                                <Button
                                  variant={
                                    leaderboardViewMode === "simple"
                                      ? "default"
                                      : "ghost"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    setLeaderboardViewMode("simple")
                                  }
                                  className={`text-xs px-4 py-1.5 rounded-lg shadow-none transition-all duration-200 flex-1 ${
                                    leaderboardViewMode === "simple"
                                      ? isDark
                                        ? "goc-btn-primary"
                                        : "goc-btn-primary"
                                      : isDark
                                        ? "text-slate-300 hover:text-white hover:!bg-white/10"
                                        : "!text-neutral-500 hover:!text-neutral-900 hover:!bg-neutral-100"
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    Simple
                                  </span>
                                </Button>
                                <Button
                                  variant={
                                    leaderboardViewMode === "detailed"
                                      ? "default"
                                      : "ghost"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    setLeaderboardViewMode("detailed")
                                  }
                                  className={`text-xs px-4 py-1.5 rounded-lg shadow-none transition-all duration-200 flex-1 ${
                                    leaderboardViewMode === "detailed"
                                      ? isDark
                                        ? "goc-btn-primary"
                                        : "goc-btn-primary"
                                      : isDark
                                        ? "text-slate-300 hover:text-white hover:!bg-white/10"
                                        : "!text-neutral-500 hover:!text-neutral-900 hover:!bg-neutral-100"
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    Detailed
                                  </span>
                                </Button>
                              </div>
                            </div>
                          )}

                        {/* Leaderboard Display Mode Toggle - Only show when multiple submissions are enabled and NOT Twitter */}
                        {contest?.multiple_submissions_enabled &&
                          contest?.platform?.toLowerCase() !== "twitter" && (
                            <div
                              className={cn(
                                "flex flex-col gap-3 p-4 rounded-2xl border sm:flex-row sm:items-center sm:justify-between",
                                isDark
                                  ? "bg-[#180438] border-slate-700"
                                  : "bg-white border-neutral-200",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "p-2 rounded-lg",
                                    isDark
                                      ? "bg-white/10 text-white"
                                      : "bg-[#fff1e6] text-[#ff7a1a]",
                                  )}
                                >
                                  <ListOrdered className="h-4 w-4" />
                                </div>
                                <div>
                                  <span
                                    className={cn(
                                      "text-sm font-semibold",
                                      isDark ? "text-white" : "text-[#171717]",
                                    )}
                                  >
                                    Leaderboard Display
                                  </span>
                                  <p
                                    className={cn(
                                      "text-xs mt-0.5",
                                      isDark ? "text-white" : "text-slate-700",
                                    )}
                                  >
                                    View by creator or individual submissions
                                  </p>
                                </div>
                              </div>
                              <div
                                className={cn(
                                  "flex gap-1 rounded-xl p-1 w-full sm:w-auto sm:min-w-[15rem] sm:shrink-0",
                                  isDark ? "bg-white/[0.06]" : "bg-neutral-100",
                                )}
                              >
                                <Button
                                  variant={
                                    leaderboardDisplayMode === "submission"
                                      ? "default"
                                      : "ghost"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    setLeaderboardDisplayMode("submission")
                                  }
                                  className={`text-xs px-4 py-1.5 rounded-lg shadow-none transition-all duration-200 flex-1 ${
                                    leaderboardDisplayMode === "submission"
                                      ? isDark
                                        ? "goc-btn-primary"
                                        : "goc-btn-primary"
                                      : isDark
                                        ? "text-slate-300 hover:text-white hover:!bg-white/10"
                                        : "!text-neutral-500 hover:!text-neutral-900 hover:!bg-neutral-100"
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    Submission Wise
                                  </span>
                                </Button>
                                <Button
                                  variant={
                                    leaderboardDisplayMode === "creator"
                                      ? "default"
                                      : "ghost"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    setLeaderboardDisplayMode("creator")
                                  }
                                  className={`text-xs px-4 py-1.5 rounded-lg shadow-none transition-all duration-200 flex-1 ${
                                    leaderboardDisplayMode === "creator"
                                      ? isDark
                                        ? "goc-btn-primary"
                                        : "goc-btn-primary"
                                      : isDark
                                        ? "text-slate-300 hover:text-white hover:!bg-white/10"
                                        : "!text-neutral-500 hover:!text-neutral-900 hover:!bg-neutral-100"
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    Creator Wise
                                  </span>
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Logged-in User's Rank Card */}
                        {loadingMySubmission && (
                          <div className="text-center py-3">
                            <p>Loading your rank...</p>
                          </div>
                        )}
                        {(() => {
                          // Show best submission if user has multiple, otherwise show current leaderboard entry
                          const bestSubmission = getBestSubmission();
                          const displayEntry =
                            bestSubmission || myLeaderboardEntry;

                          const isCreatorWiseMyCard =
                            leaderboardDisplayMode === "creator" &&
                            contest?.platform?.toLowerCase() !== "twitter" &&
                            contest?.platform?.toLowerCase() !== "x";

                          const eligibleSubs = getUserSubmissions().filter(
                            (s) => s.status !== "rejected",
                          );
                          const clientEligibleViewsSum = eligibleSubs.reduce(
                            (a, s) => a + (s.views || 0),
                            0,
                          );
                          const clientEligibleEarningsSum = eligibleSubs.reduce(
                            (a, s) => a + (s.earnings || 0),
                            0,
                          );

                          const myCreatorGroupOnPage =
                            groupedLeaderboardByCreator?.find(
                              (g) => g.creator_id === user?.id,
                            );

                          const combinedViewsForCard = isCreatorWiseMyCard
                            ? (myCreatorWiseStats?.total_views ??
                              myCreatorGroupOnPage?.total_views ??
                              clientEligibleViewsSum)
                            : null;

                          const combinedRankForCard = isCreatorWiseMyCard
                            ? (myCreatorGroupOnPage?.best_rank ??
                              myCreatorWiseStats?.rank ??
                              null)
                            : null;

                          const combinedEarningsForCard = isCreatorWiseMyCard
                            ? (myCreatorWiseStats?.total_earnings ??
                              (
                                myCreatorGroupOnPage as {
                                  total_earnings?: number;
                                }
                              )?.total_earnings ??
                              clientEligibleEarningsSum)
                            : null;

                          const cardPlatform =
                            contest?.platform?.toLowerCase() ?? "";
                          const isTwitterCard =
                            cardPlatform === "twitter" || cardPlatform === "x";
                          const joinedAtForMyCard = isTwitterCard
                            ? (myLeaderboardEntry as any)?.joined_at ||
                              (displayEntry as any)?.joined_at ||
                              myLeaderboardEntry?.created_at ||
                              displayEntry?.created_at ||
                              null
                            : (displayEntry?.created_at ?? null);

                          const prizeRankForZone = isCreatorWiseMyCard
                            ? (combinedRankForCard ?? myLeaderboardEntry?.rank)
                            : myLeaderboardEntry?.rank;

                          return (
                            displayEntry && (
                              <Card
                                key={`my-rank-${displayEntry.id}`}
                                className={cn(
                                  "overflow-hidden mb-3 rounded-2xl border shadow-none",
                                  isDark
                                    ? "border-[#ff7a1a]/40 bg-[#12032c]"
                                    : "border-[#ffd9b8] bg-[#fff8f2]",
                                )}
                              >
                                <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                  <div className="flex flex-1 items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                                    <div
                                      className={cn(
                                        "flex flex-col items-center justify-center w-10 sm:w-12 flex-shrink-0 rounded-xl px-1 py-1.5 shadow-sm",
                                        isDark
                                          ? "bg-[#ff7a1a]/15 text-[#ffa35c]"
                                          : "bg-[#fff1e6] text-[#ff7a1a]",
                                      )}
                                    >
                                      <div className="text-lg sm:text-xl font-extrabold leading-none tabular-nums">
                                        {isCreatorWiseMyCard
                                          ? (combinedRankForCard ?? "?")
                                          : bestSubmission
                                            ? typeof bestSubmission.rank ===
                                              "number"
                                              ? bestSubmission.rank
                                              : bestSubmission.status ===
                                                  "rejected"
                                                ? "—"
                                                : (rankLookupMap.get(
                                                    bestSubmission.id,
                                                  ) ?? "?")
                                            : (myLeaderboardEntry?.rank ?? "?")}
                                      </div>
                                      {!isCreatorWiseMyCard &&
                                        bestSubmission &&
                                        myLeaderboardEntry &&
                                        bestSubmission.id !==
                                          myLeaderboardEntry.id && (
                                          <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary">
                                            Best
                                          </span>
                                        )}
                                    </div>

                                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                      <Avatar
                                        className={cn(
                                          "h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 border-2 transition-all",
                                          isDark
                                            ? "border-white/15"
                                            : "border-neutral-200",
                                        )}
                                      >
                                        <AvatarImage
                                          src={
                                            displayEntry.user_platform_pfp_url ??
                                            displayEntry.creator_pfp_url ??
                                            undefined
                                          }
                                          alt={
                                            contest?.platform === "twitter"
                                              ? (displayEntry as any)
                                                  .app_username ||
                                                displayEntry.user_platform_username
                                              : displayEntry.user_platform_username
                                          }
                                          referrerPolicy="no-referrer"
                                          loading="lazy"
                                        />
                                        <AvatarFallback
                                          className={cn(
                                            "bg-primary/20",
                                            isDark
                                              ? "text-white"
                                              : "text-gray-900",
                                          )}
                                        >
                                          {(contest?.platform === "twitter"
                                            ? ((displayEntry as any)
                                                .app_username as
                                                | string
                                                | undefined)
                                            : displayEntry.user_platform_username)?.[0]?.toUpperCase() ||
                                            "U"}
                                        </AvatarFallback>
                                      </Avatar>

                                      <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-0.5 min-w-0">
                                          {(() => {
                                            const isTwitter =
                                              contest?.platform?.toLowerCase() ===
                                                "twitter" ||
                                              contest?.platform?.toLowerCase() ===
                                                "x";
                                            const displayName = isTwitter
                                              ? ((displayEntry as any)
                                                  .app_full_name as
                                                  | string
                                                  | null
                                                  | undefined) ||
                                                ((myLeaderboardEntry as any)
                                                  ?.app_full_name as
                                                  | string
                                                  | null
                                                  | undefined) ||
                                                ((displayEntry as any)
                                                  .app_username as
                                                  | string
                                                  | null
                                                  | undefined) ||
                                                displayEntry.user_platform_username
                                              : displayEntry.user_platform_username;
                                            const handleRaw = isTwitter
                                              ? ((displayEntry as any)
                                                  .app_username as
                                                  | string
                                                  | null
                                                  | undefined) ||
                                                displayEntry.user_platform_username
                                              : null;
                                            const handle = handleRaw
                                              ? String(handleRaw).replace(
                                                  /^@/,
                                                  "",
                                                )
                                              : "";
                                            return (
                                              <div className="flex items-center gap-2 min-w-0">
                                                <p
                                                  className={cn(
                                                    "text-sm sm:text-base font-semibold truncate",
                                                    isDark
                                                      ? "text-white"
                                                      : "text-gray-900",
                                                  )}
                                                  title={
                                                    displayName || undefined
                                                  }
                                                >
                                                  {displayName || "You"}
                                                </p>
                                                <LeaderboardRowPlatformIcons
                                                  show={
                                                    showLeaderboardPlatformIcons &&
                                                    !isTwitter
                                                  }
                                                  values={
                                                    isCreatorWiseMyCard
                                                      ? [
                                                          ...eligibleSubs.map(
                                                            (submission: {
                                                              platform?:
                                                                | string
                                                                | null;
                                                            }) =>
                                                              submission.platform,
                                                          ),
                                                          ...(
                                                            myCreatorGroupOnPage?.submissions ||
                                                            []
                                                          ).map(
                                                            (submission: {
                                                              platform?:
                                                                | string
                                                                | null;
                                                            }) =>
                                                              submission.platform,
                                                          ),
                                                        ]
                                                      : [displayEntry.platform]
                                                  }
                                                  tab={leaderboardPlatformTab}
                                                />
                                                {!isTwitter && (
                                                  <span
                                                    className={cn(
                                                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border shrink-0",
                                                      isDark
                                                        ? "bg-[#ff7a1a]/15 border-[#ff7a1a]/30 text-[#ffa35c]"
                                                        : "bg-[#fff1e6] border-[#ffd9b8] text-[#ff7a1a]",
                                                    )}
                                                  >
                                                    You
                                                  </span>
                                                )}
                                                {!isTwitter && handle ? (
                                                  <span
                                                    className={cn(
                                                      "text-xs font-medium truncate",
                                                      isDark
                                                        ? "text-slate-400"
                                                        : "text-slate-500",
                                                    )}
                                                    title={`@${handle}`}
                                                  >
                                                    @{handle}
                                                  </span>
                                                ) : null}
                                              </div>
                                            );
                                          })()}
                                          {!isCreatorWiseMyCard &&
                                            bestSubmission &&
                                            myLeaderboardEntry &&
                                            bestSubmission.id !==
                                              myLeaderboardEntry.id && (
                                              <span className="text-xs text-primary/70 ml-2">
                                                • Best Performance
                                              </span>
                                            )}
                                          {isCreatorWiseMyCard &&
                                            eligibleSubs.length > 1 && (
                                              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                                                • Combined eligible submissions
                                              </span>
                                            )}
                                          {renderVerificationBadges(
                                            isCreatorWiseMyCard &&
                                              eligibleSubs.length > 0
                                              ? {
                                                  submissions: eligibleSubs,
                                                  pending_submission_count:
                                                    countPendingLeaderboardSubmissions(
                                                      eligibleSubs,
                                                    ),
                                                }
                                              : displayEntry,
                                          )}
                                        </div>
                                        {/* Show rejection reason if available - compact UI */}
                                        {contest?.platform === "twitter" &&
                                          (displayEntry as any)
                                            .moderation_status === "rejected" &&
                                          (displayEntry as any)
                                            .rejection_reason && (
                                            <div className="flex items-center gap-2 mt-1 mb-2">
                                              <AlertCircle
                                                className={cn(
                                                  "h-4 w-4 flex-shrink-0",
                                                  isDark
                                                    ? "text-red-400"
                                                    : "text-red-600",
                                                )}
                                              />
                                              <p
                                                className={cn(
                                                  "text-xs flex-1 truncate",
                                                  isDark
                                                    ? "text-red-300"
                                                    : "text-red-600",
                                                )}
                                              >
                                                <span className="font-medium">
                                                  Rejection Reason:
                                                </span>{" "}
                                                {(displayEntry as any)
                                                  .rejection_reason.length > 50
                                                  ? `${(
                                                      displayEntry as any
                                                    ).rejection_reason.substring(
                                                      0,
                                                      50,
                                                    )}...`
                                                  : (displayEntry as any)
                                                      .rejection_reason}
                                              </p>
                                              {(displayEntry as any)
                                                .rejection_reason.length >
                                                50 && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                  onClick={() => {
                                                    setRejectionReasonModalOpen(
                                                      true,
                                                    );
                                                    setRejectionReasonText(
                                                      (displayEntry as any)
                                                        .rejection_reason,
                                                    );
                                                  }}
                                                >
                                                  More
                                                </Button>
                                              )}
                                            </div>
                                          )}
                                        {/* Show explanation for rejected entries */}
                                        {contest?.platform === "twitter" &&
                                          (displayEntry as any)
                                            .moderation_status ===
                                            "rejected" && (
                                            <p
                                              className={cn(
                                                "text-xs mb-2",
                                                isDark
                                                  ? "text-red-300"
                                                  : "text-red-600",
                                              )}
                                            >
                                              Your entry has been rejected.
                                            </p>
                                          )}
                                        {!(
                                          contest?.platform === "twitter" &&
                                          (displayEntry as any)
                                            .moderation_status === "rejected"
                                        ) && (
                                          <p
                                            className={cn(
                                              "text-xs mb-2",
                                              isDark
                                                ? "text-gray-300"
                                                : "text-slate-500",
                                            )}
                                          >
                                            {isTwitterCard
                                              ? "Joined"
                                              : "Submitted"}
                                            : {formatTimeAgo(joinedAtForMyCard)}
                                          </p>
                                        )}
                                        {/* Twitter Metrics - Horizontal Layout - Hide for rejected entries */}
                                        {isTwitterCard &&
                                          (displayEntry as any)
                                            .total_eligible_tweets !==
                                            undefined &&
                                          !(
                                            (displayEntry as any)
                                              .moderation_status === "rejected"
                                          ) && (
                                            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1">
                                              {[
                                                {
                                                  Icon: FileText,
                                                  iconClass: isDark
                                                    ? "text-slate-400"
                                                    : "text-slate-500",
                                                  chipBg: isDark
                                                    ? "bg-white/[0.04] border-slate-700"
                                                    : "bg-[#fafafa] border-neutral-200",
                                                  text: `${(displayEntry as any).total_eligible_tweets || 0} Tweets`,
                                                  title: `Tweets: ${(displayEntry as any).total_eligible_tweets || 0}`,
                                                },
                                                {
                                                  Icon: Eye,
                                                  iconClass: isDark
                                                    ? "text-slate-400"
                                                    : "text-slate-500",
                                                  chipBg: isDark
                                                    ? "bg-white/[0.04] border-slate-700"
                                                    : "bg-[#fafafa] border-neutral-200",
                                                  text: `${((displayEntry as any).total_impressions || 0).toLocaleString()} Impressions`,
                                                  title: `Impressions: ${((displayEntry as any).total_impressions || 0).toLocaleString()}`,
                                                },
                                                {
                                                  Icon: ThumbsUp,
                                                  iconClass: isDark
                                                    ? "text-slate-400"
                                                    : "text-slate-500",
                                                  chipBg: isDark
                                                    ? "bg-white/[0.04] border-slate-700"
                                                    : "bg-[#fafafa] border-neutral-200",
                                                  text: `${(displayEntry as any).total_likes || 0} Likes`,
                                                  title: `Likes: ${(displayEntry as any).total_likes || 0}`,
                                                },
                                                {
                                                  Icon: RefreshCw,
                                                  iconClass: isDark
                                                    ? "text-slate-400"
                                                    : "text-slate-500",
                                                  chipBg: isDark
                                                    ? "bg-white/[0.04] border-slate-700"
                                                    : "bg-[#fafafa] border-neutral-200",
                                                  text: `${(displayEntry as any).total_retweets || 0} Retweets`,
                                                  title: `Retweets: ${(displayEntry as any).total_retweets || 0}`,
                                                },
                                                {
                                                  Icon: MessageCircle,
                                                  iconClass: isDark
                                                    ? "text-slate-400"
                                                    : "text-slate-500",
                                                  chipBg: isDark
                                                    ? "bg-white/[0.04] border-slate-700"
                                                    : "bg-[#fafafa] border-neutral-200",
                                                  text: `${(displayEntry as any).total_replies || 0} Replies`,
                                                  title: `Replies: ${(displayEntry as any).total_replies || 0}`,
                                                },
                                              ].map(
                                                ({
                                                  Icon,
                                                  iconClass,
                                                  chipBg,
                                                  text,
                                                  title,
                                                }) => (
                                                  <div
                                                    key={`${title}-${text}`}
                                                    className={cn(
                                                      "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] sm:text-xs font-medium tabular-nums",
                                                      chipBg,
                                                      isDark
                                                        ? "text-slate-200"
                                                        : "text-slate-700",
                                                    )}
                                                    title={title}
                                                  >
                                                    <Icon
                                                      className={cn(
                                                        "h-3.5 w-3.5 shrink-0",
                                                        iconClass,
                                                      )}
                                                      aria-hidden
                                                    />
                                                    <span className="whitespace-nowrap">
                                                      {text}
                                                    </span>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end space-y-0.5 sm:space-y-1 flex-shrink-0 ml-auto pl-2">
                                    <div className="flex items-center space-x-2">
                                      <p
                                        className={cn(
                                          "text-base sm:text-lg font-bold tabular-nums ml-auto text-right",
                                          isDark
                                            ? "text-white"
                                            : "text-gray-900",
                                        )}
                                      >
                                        {contest?.platform === "twitter" ? (
                                          <>
                                            {typeof (displayEntry as any)
                                              .total_points === "number"
                                              ? (
                                                  displayEntry as any
                                                ).total_points.toLocaleString()
                                              : "0"}{" "}
                                            points
                                          </>
                                        ) : (
                                          <>
                                            {isCreatorWiseMyCard ? (
                                              <>
                                                {(
                                                  combinedViewsForCard ?? 0
                                                ).toLocaleString()}{" "}
                                                views
                                              </>
                                            ) : (
                                              <>
                                                {displayEntry.views
                                                  ? displayEntry.views.toLocaleString()
                                                  : "0"}{" "}
                                                views
                                              </>
                                            )}
                                          </>
                                        )}
                                      </p>
                                    </div>
                                    {((): React.ReactNode => {
                                      // Don't show winning zone for rejected entries
                                      if (
                                        contest?.platform === "twitter" &&
                                        (displayEntry as any)
                                          .moderation_status === "rejected"
                                      ) {
                                        return null;
                                      }

                                      let prizeDisplay = null;
                                      const earningsBase = isCreatorWiseMyCard
                                        ? (combinedEarningsForCard ?? 0)
                                        : displayEntry.earnings;
                                      if (earningsBase > 0) {
                                        // Twitter: show Paid when payouts_processed or paid; others use verified/paid only
                                        const isTwitter =
                                          contest?.platform === "twitter" ||
                                          contest?.platform === "x";
                                        const isEarned =
                                          displayEntry.status === "verified" ||
                                          displayEntry.status === "paid" ||
                                          (isTwitter &&
                                            ((displayEntry as any)
                                              .moderation_status === "paid" ||
                                              contest?.post_contest_status ===
                                                "payouts_processed"));
                                        const milestoneOnlyContest =
                                          isMilestoneContestType(
                                            contest?.contest_type,
                                          ) &&
                                          !isCpmContestType(
                                            contest?.contest_type,
                                          );
                                        const earningsLabel = isEarned
                                          ? isTwitter &&
                                            contest?.post_contest_status ===
                                              "payouts_processed"
                                            ? milestoneOnlyContest
                                              ? "Earned"
                                              : "Paid"
                                            : "Earned"
                                          : milestoneOnlyContest
                                            ? "Earned"
                                            : "Expected";

                                        const flatFeeBonus = isCpmContestType(
                                          contestType,
                                        )
                                          ? (
                                              contest.contest_based_details as any
                                            )?.cpm_contest?.flat_fee_bonus || 0
                                          : (
                                              contest.contest_based_details as any
                                            )?.leaderboard_contest
                                              ?.flat_fee_bonus || 0;

                                        const hasPayoutsProcessedMyCard =
                                          contest?.status === "ended" &&
                                          contest?.post_contest_status ===
                                            "payouts_processed";
                                        const creatorBonusPaidTotalMyCard =
                                          Number(
                                            (myLeaderboardEntry as any)
                                              ?.creator_bonus_paid_total ||
                                              (myCreatorGroupOnPage as any)
                                                ?.creator_bonus_paid_total ||
                                              0,
                                          );

                                        // Milestone-only: paid bonuses count toward "Earned". Dual uses CPM flat fee like pure CPM.
                                        const bonusAmount =
                                          isMilestoneContestType(contestType) &&
                                          !isCpmContestType(contestType)
                                            ? creatorBonusPaidTotalMyCard
                                            : flatFeeBonus;

                                        const isSubmissionWiseBestPerformanceCard =
                                          leaderboardDisplayMode ===
                                            "submission" &&
                                          !isCreatorWiseMyCard &&
                                          Boolean(bestSubmission) &&
                                          Boolean(myLeaderboardEntry) &&
                                          bestSubmission?.id !==
                                            myLeaderboardEntry?.id;

                                        const effectiveBonusAmount =
                                          isSubmissionWiseBestPerformanceCard
                                            ? 0
                                            : bonusAmount;

                                        const totalEarnings =
                                          earningsBase + effectiveBonusAmount;
                                        const baseAmount = earningsBase;
                                        const baseLabel =
                                          isMilestoneContestType(contestType) &&
                                          !isCpmContestType(contestType)
                                            ? "Milestone"
                                            : isCpmContestType(contestType)
                                              ? "CPM"
                                              : "Prize";

                                        if (
                                          leaderboardViewMode === "detailed" &&
                                          effectiveBonusAmount > 0
                                        ) {
                                          prizeDisplay = (
                                            <div className="space-y-1">
                                              <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                                {earningsLabel}:{" "}
                                                {formatMoney(totalEarnings)}
                                              </div>
                                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                                <span className="whitespace-nowrap">
                                                  {formatMoney(baseAmount)}{" "}
                                                  {baseLabel}
                                                </span>
                                                <span className="text-green-600 dark:text-green-400">
                                                  +
                                                </span>
                                                <span className="whitespace-nowrap">
                                                  {formatMoney(
                                                    effectiveBonusAmount,
                                                  )}{" "}
                                                  Bonus
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        } else {
                                          prizeDisplay = (
                                            <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                              {earningsLabel}:{" "}
                                              {formatMoney(totalEarnings)}
                                            </div>
                                          );
                                        }
                                      } else if (
                                        contest.contest_type ===
                                          "leaderboard" &&
                                        Array.isArray(
                                          activeLeaderboardPrizes,
                                        ) &&
                                        activeLeaderboardPrizes.length > 0 &&
                                        prizeRankForZone != null
                                      ) {
                                        const prizeInfo =
                                          activeLeaderboardPrizes.find(
                                            (p) =>
                                              p.position === prizeRankForZone,
                                          );
                                        if (prizeInfo) {
                                          const prizeText =
                                            contest.status === "active"
                                              ? "Winning Zone"
                                              : "Prize";

                                          // Check for flat fee bonus in detailed mode
                                          if (
                                            leaderboardViewMode === "detailed"
                                          ) {
                                            const flatFeeBonus =
                                              (
                                                contest.contest_based_details as any
                                              )?.leaderboard_contest
                                                ?.flat_fee_bonus || 0;

                                            if (flatFeeBonus > 0) {
                                              const totalEarnings =
                                                prizeInfo.amount + flatFeeBonus;
                                              prizeDisplay = (
                                                <div className="font-semibold text-[#ff7a1a] dark:text-[#ffa35c] flex items-center">
                                                  <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                  <div>
                                                    <div>
                                                      {prizeText}:{" "}
                                                      {formatMoney(
                                                        totalEarnings,
                                                      )}
                                                    </div>
                                                    <div className="text-xs text-[#ff7a1a] dark:text-[#ff7a1a]">
                                                      (
                                                      {formatMoney(
                                                        prizeInfo.amount,
                                                      )}{" "}
                                                      Prize +{" "}
                                                      {formatMoney(
                                                        flatFeeBonus,
                                                      )}{" "}
                                                      Bonus)
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            } else {
                                              prizeDisplay = (
                                                <span className="font-semibold text-[#ff7a1a] dark:text-[#ffa35c] flex items-center">
                                                  <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                  {prizeText}:{" "}
                                                  {formatMoney(
                                                    prizeInfo.amount,
                                                  )}
                                                </span>
                                              );
                                            }
                                          } else {
                                            // Simple view - show total if bonus exists
                                            const flatFeeBonus =
                                              (
                                                contest.contest_based_details as any
                                              )?.leaderboard_contest
                                                ?.flat_fee_bonus || 0;
                                            const totalEarnings =
                                              prizeInfo.amount + flatFeeBonus;

                                            prizeDisplay = (
                                              <span className="font-semibold text-[#ff7a1a] dark:text-[#ffa35c] flex items-center">
                                                <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                {prizeText}:{" "}
                                                {formatMoney(totalEarnings)}
                                              </span>
                                            );
                                          }
                                        }
                                      }
                                      return prizeDisplay ? (
                                        <div className="text-xs sm:text-sm">
                                          {prizeDisplay}
                                        </div>
                                      ) : null;
                                    })()}
                                  </div>
                                </CardContent>

                                {/* View All Submissions Button - Only show if user has multiple submissions */}
                                {getUserSubmissions().length > 1 && (
                                  <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                                    <Dialog
                                      open={showAllSubmissionsModal}
                                      onOpenChange={setShowAllSubmissionsModal}
                                      isdark={isDark}
                                    >
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="flex w-full items-center justify-center gap-2 px-3 py-3 rounded-full"
                                          style={{
                                            backgroundColor: isDark
                                              ? "#7F39EC"
                                              : "#D9C0FF61",
                                            color: isDark ? "white" : "#7F39EC",
                                            transition: "none",
                                          }}
                                        >
                                          <ListOrdered className="h-3 w-3 mr-2" />
                                          View All Your Submissions (
                                          {getUserSubmissions().length})
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                                        <DialogHeader className="flex-shrink-0">
                                          <DialogTitle className="flex items-center gap-2">
                                            <ListOrdered className="h-5 w-5" />
                                            All Your Submissions (
                                            {getUserSubmissions().length})
                                          </DialogTitle>

                                          {/* View Mode Toggle for Modal */}
                                          {(contest?.contest_type ===
                                            "leaderboard" ||
                                            isCpmContestType(
                                              contest?.contest_type,
                                            )) &&
                                            (contest.contest_based_details
                                              ?.leaderboard_contest
                                              ?.flat_fee_bonus ||
                                              contest.contest_based_details
                                                ?.cpm_contest?.flat_fee_bonus ||
                                              (contest as any).bonus_details
                                                ?.description_html) && (
                                              <div className="flex justify-center mt-4">
                                                <div
                                                  className={cn(
                                                    "flex rounded-lg p-1",
                                                    isDark
                                                      ? "bg-[#180438]"
                                                      : "bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600",
                                                  )}
                                                >
                                                  <Button
                                                    variant={
                                                      modalViewMode === "simple"
                                                        ? "default"
                                                        : "ghost"
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                      setModalViewMode("simple")
                                                    }
                                                    className={`text-xs px-3 py-1.5 transition-all duration-200 ${
                                                      modalViewMode === "simple"
                                                        ? isDark
                                                          ? "goc-btn-primary"
                                                          : "goc-btn-primary"
                                                        : isDark
                                                          ? "text-slate-300 hover:text-white hover:!bg-white/10"
                                                          : "!text-neutral-500 hover:!text-neutral-900 hover:!bg-neutral-100"
                                                    }`}
                                                  >
                                                    Simple
                                                  </Button>
                                                  <Button
                                                    variant={
                                                      modalViewMode ===
                                                      "detailed"
                                                        ? "default"
                                                        : "ghost"
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                      setModalViewMode(
                                                        "detailed",
                                                      )
                                                    }
                                                    className={`text-xs px-3 py-1.5 transition-all duration-200 ${
                                                      modalViewMode ===
                                                      "detailed"
                                                        ? isDark
                                                          ? "goc-btn-primary"
                                                          : "goc-btn-primary"
                                                        : isDark
                                                          ? "text-slate-300 hover:text-white hover:!bg-white/10"
                                                          : "!text-neutral-500 hover:!text-neutral-900 hover:!bg-neutral-100"
                                                    }`}
                                                  >
                                                    Detailed
                                                  </Button>
                                                </div>
                                              </div>
                                            )}
                                        </DialogHeader>

                                        {/* Scrollable Content Area */}
                                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                          {getUserSubmissions().length === 0 ? (
                                            <div className="text-center py-8">
                                              <p
                                                className={cn(
                                                  "text-sm",
                                                  isDark
                                                    ? "text-gray-400"
                                                    : "text-gray-600",
                                                )}
                                              >
                                                No submissions found
                                              </p>
                                            </div>
                                          ) : (
                                            (() => {
                                              const userSubmissions =
                                                getUserSubmissions();
                                              const totalPages = Math.ceil(
                                                userSubmissions.length /
                                                  modalItemsPerPage,
                                              );
                                              const startIndex =
                                                (modalCurrentPage - 1) *
                                                modalItemsPerPage;
                                              const endIndex =
                                                startIndex + modalItemsPerPage;
                                              const currentSubmissions =
                                                userSubmissions.slice(
                                                  startIndex,
                                                  endIndex,
                                                );

                                              return (
                                                <>
                                                  {currentSubmissions.map(
                                                    (submission, index) => {
                                                      const actualRank =
                                                        typeof submission.rank ===
                                                        "number"
                                                          ? submission.rank
                                                          : submission.status ===
                                                              "rejected"
                                                            ? null
                                                            : (rankLookupMap.get(
                                                                submission.id,
                                                              ) ?? null);

                                                      // Earnings display based on modal view mode
                                                      let prizeDisplay = null;
                                                      if (
                                                        submission.earnings > 0
                                                      ) {
                                                        const isTwitter =
                                                          contest?.platform ===
                                                            "twitter" ||
                                                          contest?.platform ===
                                                            "x";
                                                        const isEarned =
                                                          submission.status ===
                                                            "verified" ||
                                                          submission.status ===
                                                            "paid" ||
                                                          (isTwitter &&
                                                            ((submission as any)
                                                              .moderation_status ===
                                                              "paid" ||
                                                              (
                                                                submission as any
                                                              ).paid === true ||
                                                              contest?.post_contest_status ===
                                                                "payouts_processed"));
                                                        const milestoneOnlyContestModal =
                                                          isMilestoneContestType(
                                                            contest?.contest_type,
                                                          ) &&
                                                          !isCpmContestType(
                                                            contest?.contest_type,
                                                          );
                                                        const earningsLabel =
                                                          isEarned
                                                            ? isTwitter &&
                                                              contest?.post_contest_status ===
                                                                "payouts_processed"
                                                              ? milestoneOnlyContestModal
                                                                ? "Earned"
                                                                : "Paid"
                                                              : "Earned"
                                                            : milestoneOnlyContestModal
                                                              ? "Earned"
                                                              : "Expected";

                                                        const flatFeeBonus =
                                                          isCpmContestType(
                                                            contestType,
                                                          )
                                                            ? (
                                                                contest.contest_based_details as any
                                                              )?.cpm_contest
                                                                ?.flat_fee_bonus ||
                                                              0
                                                            : (
                                                                contest.contest_based_details as any
                                                              )
                                                                ?.leaderboard_contest
                                                                ?.flat_fee_bonus ||
                                                              0;
                                                        const totalEarnings =
                                                          submission.earnings +
                                                          flatFeeBonus;

                                                        if (
                                                          modalViewMode ===
                                                            "detailed" &&
                                                          isCpmContestType(
                                                            contest?.contest_type,
                                                          ) &&
                                                          flatFeeBonus > 0
                                                        ) {
                                                          prizeDisplay = (
                                                            <div className="space-y-1">
                                                              <div
                                                                className={cn(
                                                                  "font-semibold text-green-600 dark:text-green-400 text-sm",
                                                                  isDark
                                                                    ? "text-green-400"
                                                                    : "text-green-600",
                                                                )}
                                                              >
                                                                {earningsLabel}:{" "}
                                                                {formatMoney(
                                                                  totalEarnings,
                                                                )}
                                                              </div>
                                                              <div
                                                                className={cn(
                                                                  "flex flex-wrap items-center gap-1.5 text-xs",
                                                                  isDark
                                                                    ? "text-green-400 bg-green-900/20 border border-green-800"
                                                                    : "text-green-600 bg-green-50 border border-green-200",
                                                                )}
                                                              >
                                                                <div
                                                                  className={cn(
                                                                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                                                    isDark
                                                                      ? "bg-green-400"
                                                                      : "bg-green-500",
                                                                  )}
                                                                ></div>
                                                                <span className="whitespace-nowrap">
                                                                  {formatMoney(
                                                                    submission.earnings,
                                                                  )}{" "}
                                                                  {isCpmContestType(
                                                                    contestType,
                                                                  )
                                                                    ? "CPM"
                                                                    : isMilestoneContestType(
                                                                          contestType,
                                                                        ) &&
                                                                        !isCpmContestType(
                                                                          contestType,
                                                                        )
                                                                      ? "Milestone"
                                                                      : "Prize"}
                                                                </span>
                                                                <span
                                                                  className={cn(
                                                                    "text-green-600 dark:text-green-400",
                                                                    isDark
                                                                      ? "text-green-400"
                                                                      : "text-green-600",
                                                                  )}
                                                                >
                                                                  +
                                                                </span>
                                                                <span className="whitespace-nowrap">
                                                                  {formatMoney(
                                                                    flatFeeBonus,
                                                                  )}{" "}
                                                                  Bonus
                                                                </span>
                                                              </div>
                                                            </div>
                                                          );
                                                        } else if (
                                                          modalViewMode ===
                                                            "detailed" &&
                                                          contest?.contest_type ===
                                                            "milestone"
                                                        ) {
                                                          prizeDisplay = (
                                                            <div className="space-y-1">
                                                              <div
                                                                className={cn(
                                                                  "font-semibold text-green-600 dark:text-green-400 text-sm",
                                                                  isDark
                                                                    ? "text-green-400"
                                                                    : "text-green-600",
                                                                )}
                                                              >
                                                                {earningsLabel}:{" "}
                                                                {formatMoney(
                                                                  submission.earnings,
                                                                )}
                                                              </div>
                                                            </div>
                                                          );
                                                        } else {
                                                          prizeDisplay = (
                                                            <span
                                                              className={cn(
                                                                "font-semibold text-green-600 dark:text-green-400",
                                                                isDark
                                                                  ? "text-green-400"
                                                                  : "text-green-600",
                                                              )}
                                                            >
                                                              {earningsLabel}:{" "}
                                                              {formatMoney(
                                                                totalEarnings,
                                                              )}
                                                            </span>
                                                          );
                                                        }
                                                      }

                                                      // No safety check needed - data comes from existing leaderboard

                                                      return (
                                                        <Card
                                                          key={submission.id}
                                                          className="border border-slate-200 dark:border-slate-700"
                                                        >
                                                          <CardContent className="p-3 sm:p-4 flex items-center space-x-3 sm:space-x-4">
                                                            <div className="text-lg sm:text-xl font-bold text-primary w-10 sm:w-12 text-center flex-shrink-0 tabular-nums">
                                                              {actualRank !=
                                                              null
                                                                ? actualRank
                                                                : "—"}
                                                            </div>
                                                            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/30 flex-shrink-0">
                                                              <AvatarImage
                                                                src={
                                                                  submission.user_platform_pfp_url ??
                                                                  submission.creator_pfp_url ??
                                                                  undefined
                                                                }
                                                                alt={
                                                                  submission.user_platform_username
                                                                }
                                                                referrerPolicy="no-referrer"
                                                                loading="lazy"
                                                              />
                                                              <AvatarFallback
                                                                className={cn(
                                                                  "bg-primary/20 text-primary",
                                                                  isDark
                                                                    ? "text-primary-foreground"
                                                                    : "text-primary",
                                                                )}
                                                              >
                                                                {submission.user_platform_username?.[0]?.toUpperCase() ||
                                                                  "U"}
                                                              </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-grow min-w-0">
                                                              <div className="flex items-center gap-2 mb-1">
                                                                <p
                                                                  className={cn(
                                                                    "text-sm sm:text-base font-semibold truncate",
                                                                    isDark
                                                                      ? "text-white"
                                                                      : "text-gray-900",
                                                                  )}
                                                                >
                                                                  {contest?.platform ===
                                                                  "twitter"
                                                                    ? (
                                                                        submission as any
                                                                      )
                                                                        .app_username ||
                                                                      submission.user_platform_username
                                                                    : submission.user_platform_username}{" "}
                                                                  {submission.id ===
                                                                    myLeaderboardEntry?.id &&
                                                                    "(You)"}
                                                                </p>
                                                                {renderVerificationBadges(
                                                                  submission,
                                                                )}
                                                              </div>
                                                              <p
                                                                className={cn(
                                                                  "text-xs text-slate-600 dark:text-slate-400 mb-2",
                                                                  isDark
                                                                    ? "text-gray-400"
                                                                    : "text-gray-600",
                                                                )}
                                                              >
                                                                {contest?.platform?.toLowerCase() ===
                                                                  "twitter" ||
                                                                contest?.platform?.toLowerCase() ===
                                                                  "x"
                                                                  ? "Joined: "
                                                                  : "Submitted: "}{" "}
                                                                {formatTimeAgo(
                                                                  contest?.platform?.toLowerCase() ===
                                                                    "twitter" ||
                                                                    contest?.platform?.toLowerCase() ===
                                                                      "x"
                                                                    ? (
                                                                        submission as any
                                                                      )
                                                                        ?.joined_at ||
                                                                        submission.created_at ||
                                                                        null
                                                                    : submission.created_at,
                                                                )}
                                                              </p>
                                                              <div
                                                                className={cn(
                                                                  "flex items-center gap-4 text-xs",
                                                                  isDark
                                                                    ? "text-gray-400"
                                                                    : "text-gray-600",
                                                                )}
                                                              >
                                                                <div className="flex items-center gap-1">
                                                                  <Eye className="h-3 w-3" />
                                                                  {submission.views.toLocaleString()}{" "}
                                                                  views
                                                                </div>
                                                                {prizeDisplay}
                                                              </div>
                                                            </div>
                                                          </CardContent>
                                                        </Card>
                                                      );
                                                    },
                                                  )}

                                                  {/* Pagination Controls */}
                                                  {(() => {
                                                    const userSubmissions =
                                                      getUserSubmissions();
                                                    const totalPages =
                                                      Math.ceil(
                                                        userSubmissions.length /
                                                          modalItemsPerPage,
                                                      );

                                                    if (totalPages <= 1)
                                                      return null;

                                                    return (
                                                      <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                        <Button
                                                          variant="outline"
                                                          size="sm"
                                                          onClick={() =>
                                                            setModalCurrentPage(
                                                              (prev) =>
                                                                Math.max(
                                                                  1,
                                                                  prev - 1,
                                                                ),
                                                            )
                                                          }
                                                          disabled={
                                                            modalCurrentPage ===
                                                            1
                                                          }
                                                          className="flex items-center gap-1"
                                                        >
                                                          <ChevronLeft className="h-4 w-4" />
                                                          Previous
                                                        </Button>

                                                        <div className="flex items-center gap-1">
                                                          {Array.from(
                                                            {
                                                              length: Math.min(
                                                                5,
                                                                totalPages,
                                                              ),
                                                            },
                                                            (_, i) => {
                                                              let pageNum: number = 1;
                                                              if (
                                                                totalPages <= 5
                                                              ) {
                                                                pageNum = i + 1;
                                                              } else if (
                                                                modalCurrentPage <=
                                                                3
                                                              ) {
                                                                pageNum = i + 1;
                                                              } else if (
                                                                modalCurrentPage >=
                                                                totalPages - 2
                                                              ) {
                                                                pageNum =
                                                                  totalPages -
                                                                  4 +
                                                                  i;
                                                              } else {
                                                                pageNum =
                                                                  modalCurrentPage -
                                                                  2 +
                                                                  i;
                                                              }

                                                              return (
                                                                <Button
                                                                  key={pageNum}
                                                                  variant={
                                                                    modalCurrentPage ===
                                                                    pageNum
                                                                      ? "default"
                                                                      : "outline"
                                                                  }
                                                                  size="sm"
                                                                  onClick={() =>
                                                                    setModalCurrentPage(
                                                                      pageNum,
                                                                    )
                                                                  }
                                                                  className="w-8 h-8 p-0"
                                                                >
                                                                  {pageNum}
                                                                </Button>
                                                              );
                                                            },
                                                          )}
                                                        </div>

                                                        <Button
                                                          variant="outline"
                                                          size="sm"
                                                          onClick={() =>
                                                            setModalCurrentPage(
                                                              (prev) =>
                                                                Math.min(
                                                                  totalPages,
                                                                  prev + 1,
                                                                ),
                                                            )
                                                          }
                                                          disabled={
                                                            modalCurrentPage ===
                                                            totalPages
                                                          }
                                                          className="flex items-center gap-1"
                                                        >
                                                          Next
                                                          <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                      </div>
                                                    );
                                                  })()}
                                                </>
                                              );
                                            })()
                                          )}
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                )}
                              </Card>
                            )
                          );
                        })()}

                        {/* Leaderboard Metrics - Moved after user's rank card for better UX */}
                        {(() => {
                          const {
                            isDisabled,
                            disabledReason,
                            cooldownInfo,
                            isContestEnded,
                          } = getRefreshButtonState();
                          const isTwitterLeaderboardRefresh =
                            contest?.platform?.toLowerCase() === "twitter" ||
                            contest?.platform?.toLowerCase() === "x";
                          const isButtonBusy =
                            isRefreshingMetrics ||
                            twitterMetricsRunActiveWithinWindow;
                          const busyPct = twitterMetricsRunProgress
                            ? Math.max(
                                1,
                                Math.min(
                                  100,
                                  Math.floor(twitterMetricsRunProgress),
                                ),
                              )
                            : 1;
                          const idleLabelLarge = isContestEnded
                            ? "Contest Ended"
                            : !cooldownInfo?.canRefresh
                              ? `Wait ${cooldownInfo?.remainingMinutes}m`
                              : "Refresh";
                          const idleLabelSmall = isContestEnded
                            ? "Ended"
                            : !cooldownInfo?.canRefresh
                              ? `${cooldownInfo?.remainingMinutes}m`
                              : "Refresh";
                          const refreshTitle =
                            disabledReason ||
                            (isTwitterLeaderboardRefresh
                              ? "Fetches the latest tweets and metrics for everyone on this leaderboard (full contest sync)."
                              : "Refresh metrics and leaderboard");
                          return (
                            <div
                              className={cn(
                                surfaceClass,
                                "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
                                contest?.platform !== "twitter"
                                  ? "mb-0 rounded-b-none border-b-0"
                                  : "mb-3",
                              )}
                            >
                              <div className="min-w-0 flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={cn(
                                      "inline-flex h-2 w-2 shrink-0 rounded-full",
                                      isButtonBusy
                                        ? isDark
                                          ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse"
                                          : "bg-amber-500 animate-pulse"
                                        : "hidden",
                                    )}
                                    aria-hidden
                                  />
                                  <h3
                                    className={cn(
                                      "text-sm sm:text-base font-semibold tracking-tight",
                                      isDark ? "text-white" : "text-gray-900",
                                    )}
                                  >
                                    Leaderboard Metrics
                                  </h3>
                                </div>
                                <p
                                  className={cn(
                                    "text-xs sm:text-sm max-w-2xl leading-relaxed",
                                    isDark ? "text-gray-400" : "text-gray-600",
                                  )}
                                >
                                  {isButtonBusy
                                    ? isTwitterLeaderboardRefresh
                                      ? "Fetching the latest posts and metrics for everyone on the leaderboard. Large contests often take a couple of minutes."
                                      : "Refreshing metrics and leaderboard…"
                                    : isTwitterLeaderboardRefresh
                                      ? "Scores reflect data we last pulled from X. Refresh when you need the whole leaderboard up to date."
                                      : "Refresh to update engagement and rankings from the platform."}
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-row items-center gap-4">
                                <p
                                  className={cn(
                                    "text-xs font-medium min-w-0",
                                    isDark ? "text-gray-500" : "text-gray-500",
                                  )}
                                >
                                  {contest?.last_metrics_updated
                                    ? `Last updated ${formatTimeAgo(
                                        contest.last_metrics_updated,
                                      )}`
                                    : "Metrics not yet updated"}
                                </p>
                                <Button
                                  onClick={handleRefreshMetrics}
                                  disabled={isDisabled}
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "shrink-0 h-9 px-4 rounded-full font-medium gap-2 border shadow-none transition-all w-auto",
                                    isDark
                                      ? "border-slate-600 bg-transparent text-white hover:bg-white/10"
                                      : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
                                    isDisabled &&
                                      "opacity-55 cursor-not-allowed hover:bg-transparent",
                                    isButtonBusy &&
                                      (isDark
                                        ? "border-[#ff7a1a]/50 bg-[#ff7a1a]/10"
                                        : "border-[#ff7a1a]/50 bg-[#fff1e6]"),
                                  )}
                                  title={refreshTitle}
                                >
                                  {isButtonBusy ? (
                                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 shrink-0" />
                                  )}
                                  <span className="truncate hidden sm:inline">
                                    {isButtonBusy
                                      ? "Updating..."
                                      : idleLabelLarge}
                                  </span>
                                  <span className="truncate sm:hidden">
                                    {isButtonBusy
                                      ? "Updating…"
                                      : idleLabelSmall}
                                  </span>
                                </Button>
                              </div>

                              {isButtonBusy && isTwitterLeaderboardRefresh ? (
                                <div
                                  className={cn(
                                    "mt-1 w-full basis-full space-y-1.5 border-t pt-3",
                                    isDark
                                      ? "border-white/10"
                                      : "border-slate-200/80",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex items-center justify-between gap-2 text-[11px]",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-600",
                                    )}
                                  >
                                    <span className="min-w-0 truncate">
                                      {twitterMetricsRunElapsedSeconds !== null
                                        ? `Elapsed ${formatMmSs(
                                            twitterMetricsRunElapsedSeconds,
                                          )}`
                                        : "Starting…"}
                                    </span>
                                    <span
                                      className={cn(
                                        "text-[10px] tabular-nums font-semibold shrink-0",
                                        "text-[#ff7a1a]",
                                      )}
                                    >
                                      {busyPct}%
                                    </span>
                                  </div>
                                  <div
                                    className={cn(
                                      "h-2 w-full rounded-full overflow-hidden",
                                      isDark ? "bg-white/10" : "bg-[#fff1e6]",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-[width] duration-300 ease-out shadow-sm",
                                        "bg-[var(--accent-btn-base)]",
                                      )}
                                      style={{ width: `${busyPct}%` }}
                                    />
                                  </div>
                                  <p
                                    className={cn(
                                      "text-[10px] hidden sm:block",
                                      isDark
                                        ? "text-gray-500"
                                        : "text-gray-500",
                                    )}
                                  >
                                    Large contests can take a few minutes.
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}

                        {/* Creator Videos Modal */}
                        <Dialog
                          open={showCreatorVideosModal}
                          onOpenChange={setShowCreatorVideosModal}
                          isdark={isDark}
                        >
                          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                            <DialogHeader className="flex-shrink-0 mb-6">
                              <div className="flex flex-col gap-4">
                                <DialogTitle
                                  className={cn(
                                    "flex items-center gap-2 text-xl font-bold",
                                    isDark ? "text-white" : "text-gray-900",
                                  )}
                                >
                                  <Eye className="h-5 w-5 text-primary" />
                                  {(() => {
                                    const creatorGroup =
                                      groupedLeaderboardByCreator?.find(
                                        (group) =>
                                          group.creator_id ===
                                          selectedCreatorId,
                                      );
                                    return creatorGroup
                                      ? `All Videos by ${(creatorGroup as any).user_platform_username ?? creatorGroup.creator_username}`
                                      : "Creator Videos";
                                  })()}
                                </DialogTitle>

                                {/* Summary Cards */}
                                {(() => {
                                  if (loadingCreatorVideosModal) return null;
                                  if (
                                    !isMilestoneContestType(
                                      contest?.contest_type,
                                    )
                                  )
                                    return null;

                                  const isTwitter =
                                    contest?.platform?.toLowerCase() ===
                                      "twitter" ||
                                    contest?.platform?.toLowerCase() === "x";

                                  const verifiedVideos =
                                    getCreatorVideos.filter(
                                      (v) =>
                                        v.status === "verified" ||
                                        v.status === "paid" ||
                                        (isTwitter &&
                                          ((v as any).moderation_status ===
                                            "paid" ||
                                            (v as any).paid === true)),
                                    );
                                  const pendingVideos = getCreatorVideos.filter(
                                    (v) => v.status === "pending",
                                  );

                                  const vReels = verifiedVideos.length;
                                  const vViews = verifiedVideos.reduce(
                                    (sum, v) => sum + (v.views || 0),
                                    0,
                                  );

                                  const pReels = pendingVideos.length;
                                  const pViews = pendingVideos.reduce(
                                    (sum, v) => sum + (v.views || 0),
                                    0,
                                  );

                                  const totalReels = vReels + pReels;
                                  const totalViews = vViews + pViews;

                                  return (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full">
                                      {/* Verified Reels */}
                                      <div
                                        className={cn(
                                          "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                          isDark
                                            ? "bg-emerald-500/5 border-emerald-500/20"
                                            : "bg-emerald-50/50 border-emerald-100",
                                        )}
                                      >
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                          <span
                                            className={cn(
                                              "text-[9px] uppercase tracking-wider font-bold",
                                              isDark
                                                ? "text-emerald-400/80"
                                                : "text-emerald-600",
                                            )}
                                          >
                                            Verified Reels
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            "text-base font-bold tabular-nums",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900",
                                          )}
                                        >
                                          {vReels}
                                        </div>
                                      </div>

                                      {/* Verified Views */}
                                      <div
                                        className={cn(
                                          "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                          isDark
                                            ? "bg-emerald-500/5 border-emerald-500/20"
                                            : "bg-emerald-50/50 border-emerald-100",
                                        )}
                                      >
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <Eye className="h-3 w-3 text-emerald-500" />
                                          <span
                                            className={cn(
                                              "text-[9px] uppercase tracking-wider font-bold",
                                              isDark
                                                ? "text-emerald-400/80"
                                                : "text-emerald-600",
                                            )}
                                          >
                                            Verified Views
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            "text-base font-bold tabular-nums",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900",
                                          )}
                                        >
                                          {vViews.toLocaleString()}
                                        </div>
                                      </div>

                                      {/* Pending Reels */}
                                      <div
                                        className={cn(
                                          "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                          isDark
                                            ? "bg-amber-500/5 border-amber-500/20"
                                            : "bg-amber-50/50 border-amber-100",
                                        )}
                                      >
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <Clock className="h-3 w-3 text-amber-500" />
                                          <span
                                            className={cn(
                                              "text-[9px] uppercase tracking-wider font-bold",
                                              isDark
                                                ? "text-amber-400/80"
                                                : "text-amber-600",
                                            )}
                                          >
                                            Pending Reels
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            "text-base font-bold tabular-nums",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900",
                                          )}
                                        >
                                          {pReels}
                                        </div>
                                      </div>

                                      {/* Pending Views */}
                                      <div
                                        className={cn(
                                          "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                          isDark
                                            ? "bg-amber-500/5 border-amber-500/20"
                                            : "bg-amber-50/50 border-amber-100",
                                        )}
                                      >
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <TrendingUp className="h-3 w-3 text-amber-500" />
                                          <span
                                            className={cn(
                                              "text-[9px] uppercase tracking-wider font-bold",
                                              isDark
                                                ? "text-amber-400/80"
                                                : "text-amber-600",
                                            )}
                                          >
                                            Pending Views
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            "text-base font-bold tabular-nums",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900",
                                          )}
                                        >
                                          {pViews.toLocaleString()}
                                        </div>
                                      </div>

                                      {/* All Reels */}
                                      <div
                                        className={cn(
                                          "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                          isDark
                                            ? "bg-blue-500/5 border-blue-500/20"
                                            : "bg-blue-50/50 border-blue-100",
                                        )}
                                      >
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <Video className="h-3 w-3 text-blue-500" />
                                          <span
                                            className={cn(
                                              "text-[9px] uppercase tracking-wider font-bold",
                                              isDark
                                                ? "text-blue-400/80"
                                                : "text-blue-600",
                                            )}
                                          >
                                            All Reels
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            "text-base font-bold tabular-nums",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900",
                                          )}
                                        >
                                          {totalReels}
                                        </div>
                                      </div>

                                      {/* All Views */}
                                      <div
                                        className={cn(
                                          "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                          isDark
                                            ? "bg-blue-500/5 border-blue-500/20"
                                            : "bg-blue-50/50 border-blue-100",
                                        )}
                                      >
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <BarChart3 className="h-3 w-3 text-blue-500" />
                                          <span
                                            className={cn(
                                              "text-[9px] uppercase tracking-wider font-bold",
                                              isDark
                                                ? "text-blue-400/80"
                                                : "text-blue-600",
                                            )}
                                          >
                                            All Views
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            "text-base font-bold tabular-nums",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900",
                                          )}
                                        >
                                          {totalViews.toLocaleString()}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </DialogHeader>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                              {loadingCreatorVideosModal ? (
                                <div className="flex items-center justify-center min-h-[200px]">
                                  <PageLoadingSpinner
                                    mode={isDark ? "dark" : "light"}
                                  />
                                </div>
                              ) : getCreatorVideos.length === 0 ? (
                                <div className="text-center py-8">
                                  <p
                                    className={cn(
                                      "text-sm",
                                      isDark
                                        ? "text-gray-400"
                                        : "text-gray-600",
                                    )}
                                  >
                                    No videos found
                                  </p>
                                </div>
                              ) : (
                                (() => {
                                  const totalPages = Math.ceil(
                                    getCreatorVideos.length /
                                      creatorVideosItemsPerPage,
                                  );
                                  const startIndex =
                                    (creatorVideosCurrentPage - 1) *
                                    creatorVideosItemsPerPage;
                                  const endIndex =
                                    startIndex + creatorVideosItemsPerPage;
                                  const currentVideos = getCreatorVideos.slice(
                                    startIndex,
                                    endIndex,
                                  );
                                  const creatorGroup =
                                    groupedLeaderboardByCreator?.find(
                                      (group) =>
                                        group.creator_id === selectedCreatorId,
                                    );

                                  return (
                                    <>
                                      {currentVideos.map((video, index) => {
                                        // Calculate sequential rank within the modal (starting from 1)
                                        const modalRank =
                                          startIndex + index + 1;
                                        // Get actual leaderboard rank for prize lookup
                                        const actualRank =
                                          rankLookupMap.get(video.id) || null;

                                        // Earnings display - match leaderboard format
                                        let prizeDisplay = null;
                                        if (video.earnings > 0) {
                                          // For CPM contests, show Expected vs Earned based on verification/paid status (YouTube/Instagram - no Twitter-specific logic)
                                          const isTwitter =
                                            contest?.platform === "twitter" ||
                                            contest?.platform === "x";
                                          const isEarned =
                                            video.status === "verified" ||
                                            video.status === "paid" ||
                                            (isTwitter &&
                                              ((video as any)
                                                .moderation_status === "paid" ||
                                                (video as any).paid === true ||
                                                contest?.post_contest_status ===
                                                  "payouts_processed"));
                                          const milestoneOnlyVideoModal =
                                            isMilestoneContestType(
                                              contest?.contest_type,
                                            ) &&
                                            !isCpmContestType(
                                              contest?.contest_type,
                                            );
                                          const earningsLabel = isEarned
                                            ? isTwitter &&
                                              contest?.post_contest_status ===
                                                "payouts_processed" &&
                                              !milestoneOnlyVideoModal
                                              ? "Paid"
                                              : "Earned"
                                            : milestoneOnlyVideoModal
                                              ? "Earned"
                                              : "Expected";

                                          if (isCpmContestType(contestType)) {
                                            // Check if there's a flat fee bonus
                                            const flatFeeBonus =
                                              (
                                                contest.contest_based_details as any
                                              )?.cpm_contest?.flat_fee_bonus ||
                                              0;

                                            // Calculate total earnings (CPM + Bonus if applicable)
                                            const totalEarnings =
                                              video.earnings + flatFeeBonus;

                                            // Show detailed breakdown if in detailed mode and bonus exists
                                            if (
                                              leaderboardViewMode ===
                                                "detailed" &&
                                              flatFeeBonus > 0
                                            ) {
                                              prizeDisplay = (
                                                <div className="space-y-1">
                                                  <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                                    {earningsLabel}:{" "}
                                                    {formatMoney(totalEarnings)}
                                                  </div>
                                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                                    <span className="whitespace-nowrap">
                                                      {formatMoney(
                                                        video.earnings,
                                                      )}{" "}
                                                      CPM
                                                    </span>
                                                    <span className="text-green-600 dark:text-green-400">
                                                      +
                                                    </span>
                                                    <span className="whitespace-nowrap">
                                                      {formatMoney(
                                                        flatFeeBonus,
                                                      )}{" "}
                                                      Bonus
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            } else {
                                              prizeDisplay = (
                                                <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                                  {earningsLabel}:{" "}
                                                  {formatMoney(totalEarnings)}
                                                </div>
                                              );
                                            }
                                          } else {
                                            // For leaderboard or milestone contests with earnings in detailed view
                                            if (
                                              (contestType === "leaderboard" ||
                                                contestType === "milestone") &&
                                              leaderboardViewMode === "detailed"
                                            ) {
                                              const flatFeeBonus =
                                                contestType === "leaderboard"
                                                  ? (
                                                      contest.contest_based_details as any
                                                    )?.leaderboard_contest
                                                      ?.flat_fee_bonus || 0
                                                  : 0;
                                              const bonusAmount =
                                                contestType === "leaderboard"
                                                  ? flatFeeBonus
                                                  : 0;

                                              if (
                                                contestType === "leaderboard" &&
                                                bonusAmount > 0
                                              ) {
                                                const totalEarnings =
                                                  video.earnings + bonusAmount;
                                                prizeDisplay = (
                                                  <div className="space-y-1">
                                                    <div
                                                      className={cn(
                                                        "font-semibold text-base",
                                                        isDark
                                                          ? "text-green-300"
                                                          : "text-green-600",
                                                      )}
                                                    >
                                                      {earningsLabel}:{" "}
                                                      {formatMoney(
                                                        totalEarnings,
                                                      )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                                                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                                      <span className="whitespace-nowrap">
                                                        {formatMoney(
                                                          video.earnings,
                                                        )}{" "}
                                                        Prize
                                                      </span>
                                                      <span className="text-green-600 dark:text-green-400">
                                                        +
                                                      </span>
                                                      <span className="whitespace-nowrap">
                                                        {formatMoney(
                                                          bonusAmount,
                                                        )}{" "}
                                                        Bonus
                                                      </span>
                                                    </div>
                                                  </div>
                                                );
                                              } else {
                                                prizeDisplay = (
                                                  <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                                    {earningsLabel}:{" "}
                                                    {formatMoney(
                                                      video.earnings,
                                                    )}
                                                  </div>
                                                );
                                              }
                                            } else {
                                              // Simple view for leaderboard or milestone contests
                                              prizeDisplay = (
                                                <span className="font-semibold text-green-600 dark:text-green-400 text-base">
                                                  {earningsLabel}:{" "}
                                                  {formatMoney(video.earnings)}
                                                </span>
                                              );
                                            }
                                          }
                                        } else if (
                                          contest.contest_type ===
                                            "leaderboard" &&
                                          Array.isArray(
                                            activeLeaderboardPrizes,
                                          ) &&
                                          activeLeaderboardPrizes.length > 0
                                        ) {
                                          const prizeInfo = actualRank
                                            ? activeLeaderboardPrizes.find(
                                                (p) =>
                                                  p.position === actualRank,
                                              )
                                            : null;
                                          if (prizeInfo) {
                                            const prizeText =
                                              contest.status === "active"
                                                ? "Winning Zone"
                                                : "Prize";

                                            // In detailed mode, show bonus information if available
                                            if (
                                              leaderboardViewMode === "detailed"
                                            ) {
                                              const flatFeeBonus =
                                                (
                                                  contest.contest_based_details as any
                                                )?.leaderboard_contest
                                                  ?.flat_fee_bonus || 0;

                                              if (flatFeeBonus > 0) {
                                                const totalEarnings =
                                                  prizeInfo.amount +
                                                  flatFeeBonus;
                                                prizeDisplay = (
                                                  <div
                                                    className={`font-semibold flex items-center ${"text-[#ff7a1a] dark:text-[#ffa35c]"}`}
                                                  >
                                                    <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    <div>
                                                      <div>
                                                        {prizeText}:{" "}
                                                        {formatMoney(
                                                          totalEarnings,
                                                        )}
                                                      </div>
                                                      <div className="text-xs text-[#ff7a1a] dark:text-[#ff7a1a]">
                                                        (
                                                        {formatMoney(
                                                          prizeInfo.amount,
                                                        )}{" "}
                                                        Prize +{" "}
                                                        {formatMoney(
                                                          flatFeeBonus,
                                                        )}{" "}
                                                        Bonus)
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              } else {
                                                prizeDisplay = (
                                                  <span
                                                    className={`font-semibold flex items-center ${"text-[#ff7a1a] dark:text-[#ffa35c]"}`}
                                                  >
                                                    <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                    {prizeText}:{" "}
                                                    {formatMoney(
                                                      prizeInfo.amount,
                                                    )}
                                                  </span>
                                                );
                                              }
                                            } else {
                                              // Simple view
                                              prizeDisplay = (
                                                <span
                                                  className={`font-semibold flex items-center ${"text-[#ff7a1a] dark:text-[#ffa35c]"}`}
                                                >
                                                  <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                  {prizeText}:{" "}
                                                  {formatMoney(
                                                    prizeInfo.amount,
                                                  )}
                                                </span>
                                              );
                                            }
                                          }
                                        }

                                        return (
                                          <div
                                            key={video.id}
                                            className="border border-neutral-200 rounded-xl overflow-hidden"
                                          >
                                            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0 justify-between">
                                              <div className="flex items-center space-x-3 md:space-x-4">
                                                <h2 className="text-lg sm:text-xl font-bold text-slate-400 dark:text-slate-500 w-6 sm:w-8 text-center flex-shrink-0">
                                                  {modalRank}
                                                </h2>
                                                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border flex-shrink-0">
                                                  <AvatarImage
                                                    src={
                                                      video.user_platform_pfp_url ??
                                                      video.creator_pfp_url ??
                                                      undefined
                                                    }
                                                    alt={
                                                      video.user_platform_username
                                                    }
                                                    referrerPolicy="no-referrer"
                                                    loading="lazy"
                                                  />
                                                  <AvatarFallback className="bg-[#fff1e6] text-[#ff7a1a] font-semibold text-xs sm:text-base">
                                                    {video.user_platform_username?.[0]?.toUpperCase() ||
                                                      "U"}
                                                  </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-grow min-w-0">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <p
                                                      className={cn(
                                                        "text-sm sm:text-base font-semibold truncate",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-gray-700",
                                                      )}
                                                    >
                                                      {contest?.platform ===
                                                      "twitter"
                                                        ? (video as any)
                                                            .app_username ||
                                                          video.user_platform_username
                                                        : video.user_platform_username}
                                                    </p>
                                                    <LeaderboardRowPlatformIcons
                                                      show={
                                                        showLeaderboardPlatformIcons &&
                                                        contest?.platform?.toLowerCase() !==
                                                          "twitter" &&
                                                        contest?.platform?.toLowerCase() !==
                                                          "x"
                                                      }
                                                      values={[video.platform]}
                                                      tab={
                                                        leaderboardPlatformTab
                                                      }
                                                    />
                                                    {renderVerificationBadges(
                                                      video,
                                                    )}
                                                  </div>
                                                  <p
                                                    className={cn(
                                                      "text-xs",
                                                      isDark
                                                        ? "text-gray-300"
                                                        : "text-slate-500",
                                                    )}
                                                  >
                                                    {contest?.platform?.toLowerCase() ===
                                                      "twitter" ||
                                                    contest?.platform?.toLowerCase() ===
                                                      "x"
                                                      ? "Joined: "
                                                      : "Submitted: "}{" "}
                                                    {formatTimeAgo(
                                                      contest?.platform?.toLowerCase() ===
                                                        "twitter" ||
                                                        contest?.platform?.toLowerCase() ===
                                                          "x"
                                                        ? (video as any)
                                                            ?.joined_at ||
                                                            video.created_at ||
                                                            null
                                                        : video.created_at,
                                                    )}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="flex flex-col items-end space-y-0.5 sm:space-y-1 flex-shrink-0 ml-auto pl-2">
                                                <div className="flex items-center space-x-2">
                                                  <p
                                                    className={cn(
                                                      "text-base sm:text-lg font-bold",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-gray-700",
                                                    )}
                                                  >
                                                    {video.views
                                                      ? video.views.toLocaleString()
                                                      : "0"}{" "}
                                                    views
                                                  </p>
                                                </div>
                                                {prizeDisplay && (
                                                  <div className="text-xs sm:text-sm">
                                                    {prizeDisplay}
                                                  </div>
                                                )}
                                              </div>
                                            </CardContent>
                                          </div>
                                        );
                                      })}

                                      {/* Pagination Controls */}
                                      {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              setCreatorVideosCurrentPage(
                                                (prev) => Math.max(1, prev - 1),
                                              )
                                            }
                                            disabled={
                                              creatorVideosCurrentPage === 1
                                            }
                                            className="flex items-center gap-1"
                                          >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                          </Button>

                                          <div className="flex items-center gap-1">
                                            {Array.from(
                                              {
                                                length: Math.min(5, totalPages),
                                              },
                                              (_, i) => {
                                                let pageNum: number = 1;
                                                if (totalPages <= 5) {
                                                  pageNum = i + 1;
                                                } else if (
                                                  creatorVideosCurrentPage <= 3
                                                ) {
                                                  pageNum = i + 1;
                                                } else if (
                                                  creatorVideosCurrentPage >=
                                                  totalPages - 2
                                                ) {
                                                  pageNum = totalPages - 4 + i;
                                                } else {
                                                  pageNum =
                                                    creatorVideosCurrentPage -
                                                    2 +
                                                    i;
                                                }

                                                return (
                                                  <Button
                                                    key={pageNum}
                                                    variant={
                                                      creatorVideosCurrentPage ===
                                                      pageNum
                                                        ? "default"
                                                        : "outline"
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                      setCreatorVideosCurrentPage(
                                                        pageNum,
                                                      )
                                                    }
                                                    className="w-8 h-8 p-0"
                                                  >
                                                    {pageNum}
                                                  </Button>
                                                );
                                              },
                                            )}
                                          </div>

                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              setCreatorVideosCurrentPage(
                                                (prev) =>
                                                  Math.min(
                                                    totalPages,
                                                    prev + 1,
                                                  ),
                                              )
                                            }
                                            disabled={
                                              creatorVideosCurrentPage ===
                                              totalPages
                                            }
                                            className="flex items-center gap-1"
                                          >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Submission Stats and Info - only relevant for non-Twitter contests */}
                        {contest?.platform !== "twitter" && (
                          <div
                            className={cn(
                              "!mt-0 mb-3 rounded-2xl rounded-t-none border border-t-0 px-5 pb-4 pt-0",
                              isDark
                                ? "border-slate-700 bg-[#180438]"
                                : "border-neutral-200 bg-white",
                            )}
                          >
                            {(leaderboardBannerCounts.total > 0 ||
                              effectiveLeaderboardTotalEntries > 0) &&
                              (() => {
                                const isCreatorCounts =
                                  leaderboardDisplayMode === "creator" &&
                                  creatorWiseLeaderboard.length > 0;
                                const showRejectedAndTotal =
                                  (showLeaderboardPlatformIcons ||
                                    leaderboardBannerCounts.rejected > 0) &&
                                  !isCreatorCounts;
                                const countBoxes: {
                                  label: string;
                                  value: number;
                                  dot: string;
                                }[] = [
                                  {
                                    label: isCreatorCounts
                                      ? "Active creators"
                                      : "Active",
                                    value: isCreatorCounts
                                      ? effectiveLeaderboardTotalEntries
                                      : leaderboardBannerCounts.active,
                                    dot: "bg-green-500",
                                  },
                                  ...(showRejectedAndTotal
                                    ? [
                                        {
                                          label: "Rejected",
                                          value:
                                            leaderboardBannerCounts.rejected,
                                          dot: "bg-red-500",
                                        },
                                        {
                                          label: "Total submissions",
                                          value: leaderboardBannerCounts.total,
                                          dot: "bg-slate-400",
                                        },
                                      ]
                                    : []),
                                ];
                                return (
                                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {countBoxes.map((box) => (
                                      <div
                                        key={box.label}
                                        className={cn(
                                          "rounded-xl border px-4 py-3",
                                          isDark
                                            ? "border-slate-700 bg-white/[0.04]"
                                            : "border-neutral-200 bg-[#fafafa]",
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "flex items-center gap-1.5 text-xs font-medium",
                                            isDark
                                              ? "text-slate-400"
                                              : "text-slate-500",
                                          )}
                                        >
                                          <span
                                            className={cn(
                                              "h-1.5 w-1.5 rounded-full",
                                              box.dot,
                                            )}
                                            aria-hidden
                                          />
                                          {box.label}
                                        </div>
                                        <div
                                          className={cn(
                                            "mt-1 text-2xl font-bold tabular-nums",
                                            isDark
                                              ? "text-white"
                                              : "text-[#171717]",
                                          )}
                                        >
                                          {box.value.toLocaleString()}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            <div className="flex items-start gap-2">
                              <div
                                className={cn(
                                  "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5",
                                  isDark ? "text-slate-400" : "text-slate-500",
                                )}
                              >
                                <Info className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1">
                                <p
                                  className={cn(
                                    "text-xs font-semibold",
                                    isDark ? "text-white" : "text-[#171717]",
                                  )}
                                >
                                  Leaderboard Display
                                </p>
                                <div
                                  className={cn(
                                    "text-xs mt-0.5 space-y-1",
                                    isDark ? "text-gray-300" : "text-slate-500",
                                  )}
                                >
                                  <p>
                                    Only non-rejected submissions are shown in
                                    the leaderboard.
                                    {contest?.multiple_submissions_enabled &&
                                      leaderboardDisplayMode === "creator" &&
                                      " Currently viewing by creator (all submissions grouped)."}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {showLeaderboardPlatformIcons &&
                          contest?.platform?.toLowerCase() !== "twitter" &&
                          contest?.platform?.toLowerCase() !== "x" && (
                            <div className="mb-4">
                              <ContestDetailPlatformTabs
                                platforms={detailVideoPlatforms}
                                active={leaderboardPlatformTab}
                                onChange={setLeaderboardPlatformTab}
                                isDark={isDark}
                                fullWidth
                              />
                            </div>
                          )}
                        {/* Top creators podium (top 3 of the current first page) */}
                        {(() => {
                          const isTwitterLb =
                            contest?.platform?.toLowerCase() === "twitter" ||
                            contest?.platform?.toLowerCase() === "x";
                          if (isTwitterLb || leaderboardCurrentPage !== 1) {
                            return null;
                          }
                          const useCreatorRows =
                            leaderboardDisplayMode === "creator" &&
                            !!groupedLeaderboardByCreator;
                          const isVerifiedStatus = (s: any) =>
                            s?.status === "verified" || s?.status === "paid";
                          const podiumEntries: {
                            rank: number;
                            name: string;
                            pfp: string | null | undefined;
                            views: number;
                            earnings: number;
                            verified: boolean;
                            badgeSource: any;
                          }[] = useCreatorRows
                            ? (groupedLeaderboardByCreator || [])
                                .slice(0, 3)
                                .map((g: any, i: number) => ({
                                  rank: i + 1,
                                  name:
                                    g.user_platform_username ??
                                    g.creator_username ??
                                    "",
                                  pfp:
                                    g.user_platform_pfp_url ??
                                    g.creator_pfp_url,
                                  views: Number(g.total_views || 0),
                                  earnings: Number(g.total_earnings || 0),
                                  verified:
                                    g.has_paid_submission === true ||
                                    (g.submissions || []).some(isVerifiedStatus),
                                  badgeSource: g,
                                }))
                            : leaderboard.slice(0, 3).map((e: any, i) => ({
                                rank: i + 1,
                                name: e.user_platform_username ?? "",
                                pfp: e.user_platform_pfp_url ?? e.creator_pfp_url,
                                views: Number(e.views || 0),
                                earnings: Number(e.earnings || 0),
                                verified: isVerifiedStatus(e),
                                badgeSource: e,
                              }));
                          if (podiumEntries.length === 0) return null;
                          const podiumOrder = [2, 1, 3]
                            .map((r) => podiumEntries.find((p) => p.rank === r))
                            .filter((p): p is (typeof podiumEntries)[number] =>
                              Boolean(p),
                            );
                          return (
                            <div
                              className={cn(
                                surfaceClass,
                                "p-5",
                                (useCreatorRows
                                  ? (groupedLeaderboardByCreator || []).length
                                  : leaderboard.length) > 3
                                  ? "mb-0 rounded-b-none border-b-0"
                                  : "mb-3",
                              )}
                            >
                              <div className="mb-5 flex items-center gap-3">
                                <div
                                  className={cn(
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                                    isDark
                                      ? "border-slate-700 bg-white/10 text-white"
                                      : "border-neutral-200 bg-[#fff6d6] text-[#b7791f]",
                                  )}
                                >
                                  <Trophy className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <h3
                                    className={cn(
                                      "text-sm font-semibold",
                                      isDark ? "text-white" : "text-[#171717]",
                                    )}
                                  >
                                    {useCreatorRows
                                      ? "All creators"
                                      : "All submissions"}
                                  </h3>
                                  {/* <p
                                    className={cn(
                                      "text-xs",
                                      isDark
                                        ? "text-slate-400"
                                        : "text-slate-500",
                                    )}
                                  >
                                    {useCreatorRows
                                      ? "Highest total views among approved creators"
                                      : "Highest views among approved submissions"}
                                  </p> */}
                                </div>
                                <span
                                  className={cn(
                                    "ml-auto shrink-0 self-start text-xs",
                                    isDark
                                      ? "text-slate-400"
                                      : "text-slate-500",
                                  )}
                                >
                                  Ranked by views
                                </span>
                              </div>
                              <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
                                {podiumOrder.map((p) => {
                                  const isFirst = p.rank === 1;
                                  return (
                                    <div
                                      key={p.rank}
                                      className={cn(
                                        "relative flex min-w-0 flex-col items-center rounded-2xl border px-2 text-center sm:px-4",
                                        isFirst
                                          ? cn(
                                              "pb-6 pt-8 shadow-sm",
                                              isDark
                                                ? "border-amber-400/40 bg-amber-500/10"
                                                : "border-[#f0d58a] bg-gradient-to-b from-[#fff9e6] to-[#fff1c2]",
                                            )
                                          : cn(
                                              "pb-5 pt-5",
                                              isDark
                                                ? "border-slate-700 bg-white/[0.04]"
                                                : "border-neutral-200 bg-white",
                                            ),
                                      )}
                                    >
                                      {isFirst ? (
                                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1c1917] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                          {useCreatorRows
                                            ? "Top creator"
                                            : "Top submission"}
                                        </span>
                                      ) : null}
                                      <RankHexBadge
                                        rank={p.rank}
                                        size={isFirst ? "lg" : "md"}
                                        isDark={isDark}
                                      />
                                      <Avatar
                                        className={cn(
                                          "mt-3 rounded-full border-0",
                                          isFirst
                                            ? "h-14 w-14 sm:h-16 sm:w-16"
                                            : "h-10 w-10 sm:h-12 sm:w-12",
                                        )}
                                      >
                                        <AvatarImage
                                          src={p.pfp ?? undefined}
                                          alt={p.name}
                                          referrerPolicy="no-referrer"
                                          loading="lazy"
                                        />
                                        <AvatarFallback
                                          className={cn(
                                            "rounded-full font-semibold",
                                            isDark
                                              ? "bg-white/10 text-slate-200"
                                              : "bg-[#1c1917] text-white",
                                          )}
                                        >
                                          {p.name?.[0]?.toUpperCase() || "U"}
                                        </AvatarFallback>
                                      </Avatar>
                                      <p
                                        className={cn(
                                          "mt-2 w-full truncate text-xs font-semibold sm:text-sm",
                                          isDark
                                            ? "text-white"
                                            : "text-[#171717]",
                                        )}
                                        title={p.name}
                                      >
                                        {p.name}
                                      </p>
                                      <div className="mt-1 flex min-h-[1.25rem] max-w-full justify-center">
                                        {renderVerificationBadges(p.badgeSource)}
                                      </div>
                                      <p
                                        className={cn(
                                          "mt-1 font-bold tabular-nums",
                                          isFirst
                                            ? "text-2xl sm:text-3xl"
                                            : "text-lg sm:text-xl",
                                          isDark
                                            ? "text-white"
                                            : "text-[#171717]",
                                        )}
                                      >
                                        {p.views.toLocaleString()}
                                      </p>
                                      <p
                                        className={cn(
                                          "text-[11px]",
                                          isDark
                                            ? "text-slate-400"
                                            : "text-slate-500",
                                        )}
                                      >
                                        views
                                      </p>
                                     
                                        <p
                                          className={cn(
                                            "mt-2 text-xs font-semibold tabular-nums sm:text-sm",
                                            p.verified
                                              ? isDark
                                                ? "text-green-300"
                                                : "text-green-600"
                                              : isDark
                                                ? "text-slate-300"
                                                : "text-slate-600",
                                          )}
                                        >
                                          {p.verified ? "Earned" : "Expected"}:{" "}
                                          {formatMoney(p.earnings)}
                                        </p>
                                     
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Render leaderboard based on display mode */}
                        <div
                          className={cn(
                            surfaceClass,
                            "divide-y overflow-hidden empty:hidden",
                            isDark ? "divide-slate-700" : "divide-neutral-200",
                            contest?.platform?.toLowerCase() !== "twitter" &&
                              contest?.platform?.toLowerCase() !== "x" &&
                              leaderboardCurrentPage === 1 &&
                              (leaderboardDisplayMode === "creator" &&
                              groupedLeaderboardByCreator
                                ? groupedLeaderboardByCreator.length
                                : leaderboard.length) > 0 &&
                              (leaderboardDisplayMode === "creator" &&
                              groupedLeaderboardByCreator
                                ? groupedLeaderboardByCreator.length
                                : leaderboard.length) > 3 &&
                              "!mt-0 rounded-t-none",
                          )}
                        >
                          {(leaderboardDisplayMode === "creator" &&
                          groupedLeaderboardByCreator
                            ? groupedLeaderboardByCreator.length
                            : leaderboard.length) > 0 &&
                            !(
                              contest?.platform?.toLowerCase() !== "twitter" &&
                              contest?.platform?.toLowerCase() !== "x" &&
                              leaderboardCurrentPage === 1
                            ) && (
                            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                              <h3
                                className={cn(
                                  "text-sm font-semibold",
                                  isDark ? "text-white" : "text-[#171717]",
                                )}
                              >
                                {leaderboardDisplayMode === "creator" &&
                                groupedLeaderboardByCreator
                                  ? "All creators"
                                  : "All submissions"}
                              </h3>
                              <span
                                className={cn(
                                  "text-xs",
                                  isDark ? "text-slate-400" : "text-slate-500",
                                )}
                              >
                                Ranked by{" "}
                                {contest?.platform?.toLowerCase() ===
                                  "twitter" ||
                                contest?.platform?.toLowerCase() === "x"
                                  ? "points"
                                  : "views"}
                              </span>
                            </div>
                          )}
                          {leaderboardDisplayMode === "creator" &&
                          groupedLeaderboardByCreator
                            ? // Creator-wise display
                              groupedLeaderboardByCreator.map(
                                (creatorGroup, index) => {
                                  // Top 3 are shown in the "Top creators" podium above (first page, non-Twitter)
                                  if (
                                    index < 3 &&
                                    leaderboardCurrentPage === 1 &&
                                    contest?.platform?.toLowerCase() !==
                                      "twitter" &&
                                    contest?.platform?.toLowerCase() !== "x"
                                  ) {
                                    return null;
                                  }
                                  // For Twitter, use current_rank from API.
                                  // For server-side creator-wise (non-Twitter), best_rank is global creator rank from API.
                                  // Otherwise use continuous creator rank from client-side pagination.
                                  const isTwitterCreator =
                                    contest?.platform === "twitter" ||
                                    contest?.platform === "x";
                                  const isServerCreatorWise =
                                    !isTwitterCreator &&
                                    creatorWiseLeaderboard.length > 0;

                                  let rank: number;
                                  if (
                                    (isTwitterCreator || isServerCreatorWise) &&
                                    (creatorGroup as any).best_rank != null
                                  ) {
                                    rank = (creatorGroup as any).best_rank;
                                  } else {
                                    const creatorOffset = Object.entries(
                                      creatorsPerPageRef.current,
                                    )
                                      .filter(
                                        ([page]) =>
                                          Number(page) > 0 &&
                                          Number(page) < leaderboardCurrentPage,
                                      )
                                      .reduce(
                                        (sum, [, count]) =>
                                          sum + (count as number),
                                        0,
                                      );
                                    rank = creatorOffset + index + 1;
                                  }
                                  let prizeDisplay = null;
                                  let milestoneCreatorExpectedDisplay: React.ReactNode =
                                    null;
                                  const isMilestoneContest =
                                    isMilestoneContestType(
                                      contest?.contest_type,
                                    );
                                  const isTwitter =
                                    contest?.platform === "twitter" ||
                                    contest?.platform === "x";

                                  const contestStatus = contest?.status;
                                  const postContestStatus =
                                    contest?.post_contest_status;
                                  const isLeaderboardContest =
                                    contest?.contest_type === "leaderboard";
                                  const hasPayoutsProcessed =
                                    contestStatus === "ended" &&
                                    postContestStatus === "payouts_processed";

                                  const hasPaidSubmission =
                                    (creatorGroup as any)
                                      .has_paid_submission === true ||
                                    creatorGroup.submissions.some(
                                      (submission: any) => {
                                        const ex =
                                          submission?.granted_amount_cents ??
                                          submission?.paid_amount_cents ??
                                          submission?.other_stats
                                            ?.paid_amount_cents ??
                                          submission?.other_stats
                                            ?.granted_amount_cents;
                                        return (
                                          submission.status === "paid" ||
                                          submission.paid === true ||
                                          Boolean(submission?.paid_at) ||
                                          (ex != null && Number(ex) > 0)
                                        );
                                      },
                                    );

                                  const twitterPaid =
                                    isTwitter &&
                                    (creatorGroup as any).paid === true;
                                  const shouldShowActualEarnings =
                                    hasPaidSubmission ||
                                    twitterPaid ||
                                    (isTwitter && hasPayoutsProcessed);

                                  const earningsLabel = shouldShowActualEarnings
                                    ? isTwitter &&
                                      (hasPayoutsProcessed || twitterPaid)
                                      ? "Paid"
                                      : "Earned"
                                    : isMilestoneContest
                                      ? "Earned"
                                      : contestStatus === "active" &&
                                          isLeaderboardContest
                                        ? "Winning Zone"
                                        : "Expected";

                                  // Calculate total earnings including bonuses
                                  const flatFeeBonus = isCpmContestType(
                                    contestType,
                                  )
                                    ? (contest.contest_based_details as any)
                                        ?.cpm_contest?.flat_fee_bonus || 0
                                    : (contest.contest_based_details as any)
                                        ?.leaderboard_contest?.flat_fee_bonus ||
                                      0;

                                  const totalEarnings =
                                    creatorGroup.total_earnings +
                                    flatFeeBonus *
                                      creatorGroup.submission_count;

                                  if (isMilestoneContest) {
                                    const creatorId = String(
                                      (creatorGroup as any).creator_id || "",
                                    );

                                    const creatorEarnedAmount = Number(
                                      (creatorGroup as any).total_earnings || 0,
                                    );
                                    const hasPaidAtSubmission = (
                                      creatorGroup.submissions || []
                                    ).some((submission: any) =>
                                      Boolean(submission?.paid_at),
                                    );
                                    const creatorPaidFromSubmissions = (
                                      creatorGroup.submissions || []
                                    ).reduce((sum: number, submission: any) => {
                                      const explicitPaidAmount =
                                        submission?.granted_amount_cents ??
                                        submission?.paid_amount_cents ??
                                        submission?.other_stats
                                          ?.paid_amount_cents ??
                                        submission?.other_stats
                                          ?.granted_amount_cents;
                                      const isPaid =
                                        submission.status === "paid" ||
                                        submission?.paid === true ||
                                        Boolean(submission?.paid_at) ||
                                        (explicitPaidAmount != null &&
                                          Number(explicitPaidAmount) > 0);
                                      if (!isPaid) return sum;
                                      const amount =
                                        explicitPaidAmount != null &&
                                        Number(explicitPaidAmount) > 0
                                          ? Number(explicitPaidAmount)
                                          : Number(submission?.earnings || 0);
                                      return sum + amount;
                                    }, 0);
                                    const creatorBonusPaidFromSubmissions = (
                                      creatorGroup.submissions || []
                                    ).reduce((sum: number, submission: any) => {
                                      const explicitBonusAmount =
                                        submission?.bonus_amount ??
                                        submission?.other_stats?.bonus_amount;
                                      const hasBonusPaid =
                                        submission?.bonus_paid === true ||
                                        Boolean(submission?.bonus_paid_at) ||
                                        (explicitBonusAmount != null &&
                                          Number(explicitBonusAmount) > 0);
                                      if (!hasBonusPaid) return sum;
                                      const amount =
                                        explicitBonusAmount != null &&
                                        Number(explicitBonusAmount) > 0
                                          ? Number(explicitBonusAmount)
                                          : 0;
                                      return sum + amount;
                                    }, 0);
                                    const creatorBonusPaidTotal = Math.max(
                                      creatorBonusPaidFromSubmissions,
                                      Number(
                                        (creatorGroup as any)
                                          .creator_bonus_paid_total || 0,
                                      ),
                                    );
                                    const expectedReward =
                                      milestoneDerivedData.creatorExpectedRewardMap.get(
                                        creatorId,
                                      ) || 0;
                                    const mostVerifiedViewsBonus =
                                      milestoneDerivedData.creatorMostVerifiedViewsBonusMap.get(
                                        creatorId,
                                      ) || 0;
                                    const mostVerifiedReelsBonus =
                                      milestoneDerivedData.creatorMostVerifiedReelsBonusMap.get(
                                        creatorId,
                                      ) || 0;
                                    const totalExpected =
                                      expectedReward +
                                      mostVerifiedViewsBonus +
                                      mostVerifiedReelsBonus;

                                    const paidMostVerifiedViewsCents =
                                      Number(
                                        (creatorGroup as any)
                                          .most_verified_bonus_paid_views_cents ??
                                          0,
                                      ) || 0;
                                    const paidMostVerifiedReelsCents =
                                      Number(
                                        (creatorGroup as any)
                                          .most_verified_bonus_paid_reels_cents ??
                                          0,
                                      ) || 0;

                                    const milestoneHasEarnedSignal =
                                      creatorPaidFromSubmissions > 0 ||
                                      creatorBonusPaidTotal > 0 ||
                                      paidMostVerifiedViewsCents > 0 ||
                                      paidMostVerifiedReelsCents > 0 ||
                                      hasPaidSubmission ||
                                      hasPaidAtSubmission ||
                                      (hasPayoutsProcessed &&
                                        creatorEarnedAmount > 0);

                                    if (milestoneHasEarnedSignal) {
                                      const submissionPaidTotal =
                                        creatorPaidFromSubmissions;
                                      const bonusPaidRemainingBase = Math.max(
                                        0,
                                        creatorBonusPaidTotal,
                                      );
                                      const mostVerifiedViewsBonusGranted =
                                        paidMostVerifiedViewsCents > 0
                                          ? paidMostVerifiedViewsCents
                                          : Math.min(
                                              mostVerifiedViewsBonus,
                                              bonusPaidRemainingBase,
                                            );
                                      const viewsAllocated =
                                        paidMostVerifiedViewsCents > 0
                                          ? paidMostVerifiedViewsCents
                                          : mostVerifiedViewsBonusGranted;
                                      const mostVerifiedReelsBonusGranted =
                                        paidMostVerifiedReelsCents > 0
                                          ? paidMostVerifiedReelsCents
                                          : Math.min(
                                              mostVerifiedReelsBonus,
                                              Math.max(
                                                0,
                                                bonusPaidRemainingBase -
                                                  viewsAllocated,
                                              ),
                                            );
                                      const otherBonusPaid = Math.max(
                                        0,
                                        creatorBonusPaidTotal -
                                          mostVerifiedViewsBonusGranted -
                                          mostVerifiedReelsBonusGranted,
                                      );
                                      const milestoneBonusTotal =
                                        mostVerifiedViewsBonusGranted +
                                        mostVerifiedReelsBonusGranted +
                                        otherBonusPaid;
                                      // `total_earnings` from the server is sum(submission.earnings) and does not
                                      // include `bonus_amount` / most-verified payout. Creator-wise rows often have
                                      // `submissions: []`, so `submissionPaidTotal` is 0 while `creatorEarnedAmount`
                                      // still has milestone slot payouts. Never replace (slots + bonuses) with
                                      // `creatorEarnedAmount` alone — that dropped paid most-verified bonuses.
                                      const slotBest = Math.max(
                                        submissionPaidTotal,
                                        creatorEarnedAmount,
                                      );
                                      const milestoneEarnedAmount =
                                        slotBest + milestoneBonusTotal;

                                      const milestoneBaseAmount =
                                        milestoneEarnedAmount -
                                        milestoneBonusTotal;

                                      prizeDisplay = (
                                        <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                          <div className="flex flex-col items-end">
                                            <span>
                                              {earningsLabel}:{" "}
                                              {formatMoney(
                                                milestoneEarnedAmount,
                                              )}
                                            </span>
                                            {leaderboardViewMode ===
                                              "detailed" &&
                                              milestoneBonusTotal > 0 && (
                                                <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md border border-green-200 dark:border-green-800 mt-1">
                                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                                  <span className="whitespace-nowrap">
                                                    {formatMoney(
                                                      milestoneBaseAmount,
                                                    )}{" "}
                                                    Milestone
                                                  </span>
                                                  <span className="text-green-600 dark:text-green-400">
                                                    +
                                                  </span>
                                                  <span className="whitespace-nowrap">
                                                    {formatMoney(
                                                      milestoneBonusTotal,
                                                    )}{" "}
                                                    Bonus
                                                  </span>
                                                </div>
                                              )}
                                          </div>
                                        </div>
                                      );
                                      if (
                                        mostVerifiedViewsBonusGranted > 0 ||
                                        mostVerifiedReelsBonusGranted > 0
                                      ) {
                                        milestoneCreatorExpectedDisplay = (
                                          <div className="flex flex-col items-end gap-1.5 mt-1">
                                            {mostVerifiedViewsBonusGranted >
                                              0 && (
                                              <div
                                                className={cn(
                                                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-sm whitespace-nowrap cursor-help",
                                                  isDark
                                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5"
                                                    : "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-200/20",
                                                )}
                                                title="You have achieved the highest number of verified views among all creators in this contest."
                                              >
                                                <Trophy className="h-3 w-3" />
                                                <span>
                                                  MOST VIEWS BONUS WINNER:{" "}
                                                  {formatMoney(
                                                    mostVerifiedViewsBonusGranted,
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                            {mostVerifiedReelsBonusGranted >
                                              0 && (
                                              <div
                                                className={cn(
                                                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-sm whitespace-nowrap cursor-help",
                                                  isDark
                                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5"
                                                    : "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-200/20",
                                                )}
                                                title="You have achieved the highest number of verified reels among all creators in this contest."
                                              >
                                                <Video className="h-3 w-3" />
                                                <span>
                                                  MOST REELS BONUS WINNER:{" "}
                                                  {formatMoney(
                                                    mostVerifiedReelsBonusGranted,
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }
                                    } else if (
                                      !hasPayoutsProcessed &&
                                      (totalExpected > 0 ||
                                        leaderboardViewMode === "detailed")
                                    ) {
                                      milestoneCreatorExpectedDisplay = (
                                        <div className="flex flex-col items-end gap-1.5 mt-1">
                                          {mostVerifiedViewsBonus > 0 && (
                                            <div
                                              className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-sm whitespace-nowrap cursor-help",
                                                isDark
                                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/5"
                                                  : "bg-amber-50 border-amber-200 text-amber-700 shadow-amber-200/20",
                                              )}
                                              title="You currently have the highest number of verified views. You will win this bonus if you maintain this lead until the contest ends."
                                            >
                                              <TrendingUp className="h-3 w-3" />
                                              <span>
                                                MOST VERIFIED VIEWS BONUS
                                                (EXPECTED):{" "}
                                                {formatMoney(
                                                  mostVerifiedViewsBonus,
                                                )}
                                              </span>
                                            </div>
                                          )}
                                          {mostVerifiedReelsBonus > 0 && (
                                            <div
                                              className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-sm whitespace-nowrap cursor-help",
                                                isDark
                                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/5"
                                                  : "bg-amber-50 border-amber-200 text-amber-700 shadow-amber-200/20",
                                              )}
                                              title="You currently have the highest number of verified reels. You will win this bonus if you maintain this lead until the contest ends."
                                            >
                                              <Video className="h-3 w-3" />
                                              <span>
                                                MOST VERIFIED REELS BONUS
                                                (EXPECTED):{" "}
                                                {formatMoney(
                                                  mostVerifiedReelsBonus,
                                                )}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                  } else {
                                    const hasEarningsToDisplay =
                                      creatorGroup.total_earnings > 0 ||
                                      flatFeeBonus > 0;
                                    const shouldDisplayEarnings =
                                      shouldShowActualEarnings &&
                                      hasEarningsToDisplay;

                                    if (shouldDisplayEarnings) {
                                      if (
                                        leaderboardViewMode === "detailed" &&
                                        flatFeeBonus > 0
                                      ) {
                                        prizeDisplay = (
                                          <div className="space-y-1">
                                            <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                              {earningsLabel}:{" "}
                                              {formatMoney(totalEarnings)}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                              <span className="whitespace-nowrap">
                                                {formatMoney(
                                                  creatorGroup.total_earnings,
                                                )}{" "}
                                                {isCpmContestType(contestType)
                                                  ? "CPM"
                                                  : "Prize"}
                                              </span>
                                              <span className="text-green-600 dark:text-green-400">
                                                +
                                              </span>
                                              <span className="whitespace-nowrap">
                                                {formatMoney(
                                                  flatFeeBonus *
                                                    creatorGroup.submission_count,
                                                )}{" "}
                                                Bonus (
                                                {creatorGroup.submission_count}{" "}
                                                sub.)
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        prizeDisplay = (
                                          <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                            {earningsLabel}:{" "}
                                            {formatMoney(totalEarnings)}
                                          </div>
                                        );
                                      }
                                    } else if (
                                      contest.contest_type === "leaderboard" &&
                                      Array.isArray(activeLeaderboardPrizes) &&
                                      activeLeaderboardPrizes.length > 0
                                    ) {
                                      const prizes = activeLeaderboardPrizes;
                                      // Sum prize for each of this creator's submissions
                                      const submissionRanks = (
                                        creatorGroup as {
                                          submission_ranks?: number[];
                                        }
                                      ).submission_ranks ?? [
                                        creatorGroup.best_rank,
                                      ];
                                      let totalPrizeAmount = 0;
                                      for (const rank of submissionRanks) {
                                        const info = prizes.find(
                                          (p) => p.position === rank,
                                        );
                                        if (info)
                                          totalPrizeAmount += info.amount;
                                      }
                                      if (totalPrizeAmount > 0) {
                                        const prizeText =
                                          contest.status === "active"
                                            ? "Winning Zone"
                                            : "Prize";
                                        const totalPrize =
                                          totalPrizeAmount +
                                          flatFeeBonus *
                                            creatorGroup.submission_count;

                                        if (
                                          leaderboardViewMode === "detailed" &&
                                          flatFeeBonus > 0
                                        ) {
                                          prizeDisplay = (
                                            <div className="space-y-1">
                                              <div
                                                className={`font-semibold text-base flex items-center ${"text-[#ff7a1a] dark:text-[#ffa35c]"}`}
                                              >
                                                <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                {prizeText}:{" "}
                                                {formatMoney(totalPrize)}
                                              </div>
                                              <div className="text-xs text-[#ff7a1a] dark:text-[#ff7a1a]">
                                                ({formatMoney(totalPrizeAmount)}{" "}
                                                Prize
                                                {submissionRanks.length > 1 &&
                                                  ` (${submissionRanks.length} videos)`}{" "}
                                                +{" "}
                                                {formatMoney(
                                                  flatFeeBonus *
                                                    creatorGroup.submission_count,
                                                )}{" "}
                                                Bonus)
                                              </div>
                                            </div>
                                          );
                                        } else {
                                          prizeDisplay = (
                                            <span
                                              className={`font-semibold flex items-center ${"text-[#ff7a1a] dark:text-[#ffa35c]"}`}
                                            >
                                              <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                              {prizeText}:{" "}
                                              {formatMoney(totalPrize)}
                                            </span>
                                          );
                                        }
                                      }
                                    }
                                  }

                                  const twitterDisplayName = isTwitter
                                    ? (creatorGroup as any).app_full_name ||
                                      (creatorGroup as any).app_username ||
                                      creatorGroup.creator_username
                                    : ((creatorGroup as any)
                                        .user_platform_username ??
                                      creatorGroup.creator_username);
                                  const twitterHandleRaw =
                                    (creatorGroup as any).app_username ??
                                    (creatorGroup as any)
                                      .user_platform_username ??
                                    creatorGroup.creator_username;
                                  const twitterHandle = twitterHandleRaw
                                    ? String(twitterHandleRaw).replace(/^@/, "")
                                    : "";
                                  const showTwitterHandle =
                                    isTwitter &&
                                    twitterHandle &&
                                    twitterDisplayName
                                      .replace(/^@/, "")
                                      .toLowerCase() !==
                                      twitterHandle.toLowerCase();

                                  return (
                                    <div
                                      key={creatorGroup.creator_id}
                                      className={cn(
                                        "group relative overflow-hidden transition-colors",
                                        isDark
                                          ? "hover:bg-white/[0.03]"
                                          : "hover:bg-neutral-50",
                                      )}
                                    >
                                      <CardContent className="px-5 py-3.5">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:justify-between">
                                          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-3">
                                            <RankIndicator
                                              rank={rank}
                                              isDark={isDark}
                                              title={`Rank ${rank}`}
                                            />
                                            <Avatar
                                              className={cn(
                                                "shrink-0 transition-all duration-200",
                                                isTwitter
                                                  ? cn(
                                                      "h-10 w-10 rounded-lg border-0",
                                                      isDark
                                                        ? "border-white/15 border-slate-700"
                                                        : "border-neutral-200 border-neutral-200",
                                                    )
                                                  : cn(
                                                      "h-10 w-10 rounded-lg border-0",
                                                      isDark
                                                        ? "border-slate-600"
                                                        : "border-slate-200",
                                                    ),
                                              )}
                                            >
                                              <AvatarImage
                                                src={
                                                  creatorGroup.user_platform_pfp_url ??
                                                  creatorGroup.creator_pfp_url ??
                                                  undefined
                                                }
                                                alt={
                                                  (creatorGroup as any)
                                                    .user_platform_username ??
                                                  (creatorGroup as any)
                                                    .user_platform_username ??
                                                  creatorGroup.creator_username
                                                }
                                                referrerPolicy="no-referrer"
                                                loading="lazy"
                                              />
                                              <AvatarFallback
                                                className={cn(
                                                  "rounded-lg font-semibold text-xs sm:text-sm",
                                                  isTwitter
                                                    ? isDark
                                                      ? "bg-white/10 text-slate-200"
                                                      : "bg-neutral-100 text-neutral-700"
                                                    : isDark
                                                      ? "bg-white/10 text-slate-200"
                                                      : "bg-neutral-100 text-neutral-700",
                                                )}
                                              >
                                                {((creatorGroup as any)
                                                  .user_platform_username ??
                                                  creatorGroup.creator_username)?.[0]?.toUpperCase() ||
                                                  "U"}
                                              </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1 space-y-0.5">
                                              <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                  <span
                                                    className={cn(
                                                      "min-w-0 text-sm sm:text-base font-semibold leading-snug",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-900",
                                                    )}
                                                  >
                                                    {twitterDisplayName}
                                                  </span>
                                                  <LeaderboardRowPlatformIcons
                                                    show={
                                                      showLeaderboardPlatformIcons &&
                                                      !isTwitter
                                                    }
                                                    values={[
                                                      ...((
                                                        creatorGroup as {
                                                          platforms?: string[];
                                                        }
                                                      ).platforms || []),
                                                      ...(
                                                        creatorGroup.submissions ||
                                                        []
                                                      ).map(
                                                        (submission: {
                                                          platform?:
                                                            | string
                                                            | null;
                                                        }) =>
                                                          submission.platform,
                                                      ),
                                                      (
                                                        creatorGroup as {
                                                          platform?:
                                                            | string
                                                            | null;
                                                        }
                                                      ).platform,
                                                    ]}
                                                    tab={leaderboardPlatformTab}
                                                  />
                                                  {renderVerificationBadges(
                                                    creatorGroup,
                                                  )}
                                                </div>

                                                {showTwitterHandle ? (
                                                  <p
                                                    className={cn(
                                                      "text-xs font-medium truncate mt-0.5",
                                                      isDark
                                                        ? "text-slate-400"
                                                        : "text-slate-500",
                                                    )}
                                                  >
                                                    @{twitterHandle}
                                                  </p>
                                                ) : null}
                                              </div>
                                              {isTwitter ? (
                                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                                  {[
                                                    {
                                                      Icon: FileText,
                                                      iconClass: isDark
                                                        ? "text-[#ffa35c]"
                                                        : "text-[#ff7a1a]",
                                                      chipBg: isDark
                                                        ? "bg-white/[0.04] border-slate-700"
                                                        : "bg-[#fff1e6] border-neutral-200",
                                                      text: String(
                                                        (creatorGroup as any)
                                                          .total_eligible_tweets ||
                                                          0,
                                                      ),
                                                      title: `Tweets: ${(creatorGroup as any).total_eligible_tweets || 0}`,
                                                    },
                                                    {
                                                      Icon: Eye,
                                                      iconClass: isDark
                                                        ? "text-emerald-300"
                                                        : "text-emerald-600",
                                                      chipBg: isDark
                                                        ? "bg-emerald-500/10 border-emerald-500/25"
                                                        : "bg-emerald-50 border-emerald-100",
                                                      text: String(
                                                        (
                                                          (creatorGroup as any)
                                                            .total_impressions ||
                                                          0
                                                        ).toLocaleString(),
                                                      ),
                                                      title: `Impressions: ${((creatorGroup as any).total_impressions || 0).toLocaleString()}`,
                                                    },
                                                    {
                                                      Icon: ThumbsUp,
                                                      iconClass: isDark
                                                        ? "text-pink-300"
                                                        : "text-pink-600",
                                                      chipBg: isDark
                                                        ? "bg-pink-500/10 border-pink-500/25"
                                                        : "bg-pink-50 border-pink-100",
                                                      text: String(
                                                        (creatorGroup as any)
                                                          .total_likes || 0,
                                                      ),
                                                      title: `Likes: ${(creatorGroup as any).total_likes || 0}`,
                                                    },
                                                    {
                                                      Icon: RefreshCw,
                                                      iconClass: isDark
                                                        ? "text-teal-300"
                                                        : "text-teal-600",
                                                      chipBg: isDark
                                                        ? "bg-teal-500/10 border-teal-500/25"
                                                        : "bg-teal-50 border-teal-100",
                                                      text: String(
                                                        (creatorGroup as any)
                                                          .total_retweets || 0,
                                                      ),
                                                      title: `Retweets: ${(creatorGroup as any).total_retweets || 0}`,
                                                    },
                                                    {
                                                      Icon: MessageCircle,
                                                      iconClass: isDark
                                                        ? "text-sky-300"
                                                        : "text-sky-600",
                                                      chipBg: isDark
                                                        ? "bg-sky-500/10 border-sky-500/25"
                                                        : "bg-sky-50 border-sky-100",
                                                      text: String(
                                                        (creatorGroup as any)
                                                          .total_replies || 0,
                                                      ),
                                                      title: `Replies: ${(creatorGroup as any).total_replies || 0}`,
                                                    },
                                                  ].map(
                                                    ({
                                                      Icon,
                                                      iconClass,
                                                      chipBg,
                                                      text,
                                                      title,
                                                    }) => (
                                                      <div
                                                        key={`${title}-${text}`}
                                                        className={cn(
                                                          "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] sm:text-xs font-medium tabular-nums",
                                                          chipBg,
                                                          isDark
                                                            ? "text-slate-200"
                                                            : "text-slate-700",
                                                        )}
                                                        title={title}
                                                      >
                                                        <Icon
                                                          className={cn(
                                                            "h-3.5 w-3.5 shrink-0",
                                                            iconClass,
                                                          )}
                                                          aria-hidden
                                                        />
                                                        <span>{text}</span>
                                                      </div>
                                                    ),
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1.5">
                                                  <Video
                                                    className={cn(
                                                      "h-3.5 w-3.5 shrink-0 opacity-80",
                                                      isDark
                                                        ? "text-slate-500"
                                                        : "text-slate-500",
                                                    )}
                                                  />
                                                  <p
                                                    className={cn(
                                                      "text-xs font-normal leading-snug",
                                                      isDark
                                                        ? "text-slate-500"
                                                        : "text-slate-500",
                                                    )}
                                                  >
                                                    {
                                                      creatorGroup.submission_count
                                                    }{" "}
                                                    {creatorGroup.submission_count ===
                                                    1
                                                      ? "submission"
                                                      : "submissions"}
                                                  </p>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div
                                            className={cn(
                                              isTwitter
                                                ? "flex flex-col gap-2 sm:items-end sm:text-right shrink-0 w-full sm:w-auto sm:min-w-[7.5rem] border-t sm:border-t-0 pt-3 sm:pt-0"
                                                : "flex flex-col items-end gap-1.5 shrink-0 sm:text-right",
                                              isDark
                                                ? "border-white/10"
                                                : "border-neutral-200",
                                            )}
                                          >
                                            {isTwitter ? (
                                              <p
                                                className={cn(
                                                  "text-base sm:text-lg font-bold tabular-nums ml-auto text-right",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-gray-900",
                                                )}
                                              >
                                                {typeof (creatorGroup as any)
                                                  .total_points === "number"
                                                  ? (
                                                      creatorGroup as any
                                                    ).total_points.toLocaleString()
                                                  : "0"}{" "}
                                                points
                                              </p>
                                            ) : null}
                                            {!isTwitter && (
                                              <div className="flex items-center justify-end gap-1">
                                                <p
                                                  className={cn(
                                                    "text-sm sm:text-base font-semibold tabular-nums whitespace-nowrap",
                                                    isDark
                                                      ? "text-slate-100"
                                                      : "text-slate-800",
                                                  )}
                                                >
                                                  {creatorGroup.total_views.toLocaleString()}{" "}
                                                  views
                                                </p>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                    setSelectedCreatorId(
                                                      creatorGroup.creator_id,
                                                    );
                                                    setShowCreatorVideosModal(
                                                      true,
                                                    );
                                                    setCreatorVideosCurrentPage(
                                                      1,
                                                    );
                                                  }}
                                                  className="h-7 w-7 p-0 shrink-0"
                                                  title="View all videos by this creator"
                                                >
                                                  <Eye
                                                    className={cn(
                                                      "h-4 w-4",
                                                      isDark
                                                        ? "text-slate-400"
                                                        : "text-slate-600",
                                                    )}
                                                  />
                                                </Button>
                                              </div>
                                            )}
                                            {!isTwitter && prizeDisplay && (
                                              <div className="text-xs sm:text-sm w-full sm:w-auto">
                                                {prizeDisplay}
                                              </div>
                                            )}
                                            {!isTwitter &&
                                              isMilestoneContest &&
                                              milestoneCreatorExpectedDisplay && (
                                                <div className="mt-1 w-full">
                                                  {
                                                    milestoneCreatorExpectedDisplay
                                                  }
                                                </div>
                                              )}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </div>
                                  );
                                },
                              )
                            : // Submission-wise display (original)
                              leaderboard.map((entry, index) => {
                                // Top 3 are shown in the "Top creators" podium above (first page, non-Twitter)
                                if (
                                  index < 3 &&
                                  leaderboardCurrentPage === 1 &&
                                  contest?.platform?.toLowerCase() !==
                                    "twitter" &&
                                  contest?.platform?.toLowerCase() !== "x"
                                ) {
                                  return null;
                                }
                                const rank =
                                  (leaderboardCurrentPage - 1) *
                                    leaderboardItemsPerPage +
                                  index +
                                  1;
                                let prizeDisplay = null;
                                const isMilestoneContest =
                                  isMilestoneContestType(contest?.contest_type);

                                if (isMilestoneContest) {
                                  const hasPayoutsProcessed =
                                    contest?.post_contest_status ===
                                    "payouts_processed";
                                  const milestoneTrackBonusesPaidCents =
                                    (Number(
                                      (entry as any).milestone_bonus_paid
                                        ?.views,
                                    ) || 0) +
                                    (Number(
                                      (entry as any).milestone_bonus_paid
                                        ?.reels,
                                    ) || 0);
                                  const explicitBonusPaidAmount =
                                    (entry as any).bonus_amount ??
                                    (entry as any).other_stats?.bonus_amount;
                                  const explicitPaidAmount =
                                    (entry as any).granted_amount_cents ??
                                    (entry as any).paid_amount_cents ??
                                    (entry as any).other_stats
                                      ?.paid_amount_cents ??
                                    (entry as any).other_stats
                                      ?.granted_amount_cents;
                                  const isMilestonePaid =
                                    entry.status === "paid" ||
                                    (entry as any).paid === true ||
                                    Boolean((entry as any).paid_at) ||
                                    (entry as any).bonus_paid === true ||
                                    Boolean((entry as any).bonus_paid_at) ||
                                    (explicitBonusPaidAmount != null &&
                                      Number(explicitBonusPaidAmount) > 0) ||
                                    milestoneTrackBonusesPaidCents > 0 ||
                                    (explicitPaidAmount != null &&
                                      Number(explicitPaidAmount) > 0);
                                  const milestoneHasEarnedSignal =
                                    isMilestonePaid ||
                                    (hasPayoutsProcessed &&
                                      Number(entry.earnings || 0) > 0);
                                  const expectedReward =
                                    milestoneDerivedData.submissionExpectedRewardMap.get(
                                      entry.id,
                                    ) || 0;
                                  if (milestoneHasEarnedSignal) {
                                    const submissionPaidCents =
                                      explicitPaidAmount != null &&
                                      Number(explicitPaidAmount) > 0
                                        ? Number(explicitPaidAmount)
                                        : 0;
                                    const totalBonusCents =
                                      explicitBonusPaidAmount != null &&
                                      Number(explicitBonusPaidAmount) > 0
                                        ? Number(explicitBonusPaidAmount)
                                        : milestoneTrackBonusesPaidCents > 0
                                          ? milestoneTrackBonusesPaidCents
                                          : 0;
                                    // Submission-wise: "Earned" is milestone slot payout only (bonuses are separate).
                                    const submissionEarnedCents =
                                      submissionPaidCents > 0
                                        ? submissionPaidCents
                                        : Number(entry.earnings) > 0
                                          ? Number(entry.earnings)
                                          : totalBonusCents > 0
                                            ? 0
                                            : expectedReward;
                                    prizeDisplay =
                                      leaderboardViewMode === "detailed" &&
                                      totalBonusCents > 0 ? (
                                        <div className="space-y-1">
                                          <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                            Earned:{" "}
                                            {formatMoney(submissionEarnedCents)}
                                          </div>
                                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                            {submissionEarnedCents > 0 ? (
                                              <>
                                                <span className="whitespace-nowrap">
                                                  {formatMoney(
                                                    submissionEarnedCents,
                                                  )}{" "}
                                                  Milestone
                                                </span>
                                                <span className="text-green-600 dark:text-green-400">
                                                  +
                                                </span>
                                              </>
                                            ) : null}
                                            <span className="whitespace-nowrap">
                                              {formatMoney(totalBonusCents)}{" "}
                                              Bonus
                                            </span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                          Earned:{" "}
                                          {formatMoney(submissionEarnedCents)}
                                        </div>
                                      );
                                  }
                                } else if (entry.earnings > 0) {
                                  // Twitter CPM/leaderboard: show Paid when payouts_processed; others use verified/paid only
                                  const isTwitter =
                                    contest?.platform === "twitter" ||
                                    contest?.platform === "x";
                                  if (isCpmContestType(contestType)) {
                                    const isEarned =
                                      entry.status === "verified" ||
                                      entry.status === "paid" ||
                                      (isTwitter &&
                                        ((entry as any).moderation_status ===
                                          "paid" ||
                                          contest?.post_contest_status ===
                                            "payouts_processed"));
                                    const earningsLabel = isEarned
                                      ? isTwitter &&
                                        contest?.post_contest_status ===
                                          "payouts_processed"
                                        ? "Paid"
                                        : "Earned"
                                      : contest?.contest_type === "milestone"
                                        ? "Earned"
                                        : "Expected";

                                    // Check if there's a flat fee bonus
                                    const flatFeeBonus =
                                      (contest.contest_based_details as any)
                                        ?.cpm_contest?.flat_fee_bonus || 0;

                                    // Calculate total earnings (CPM + Bonus if applicable)
                                    const totalEarnings =
                                      entry.earnings + flatFeeBonus;

                                    // Show detailed breakdown if in detailed mode and bonus exists
                                    if (
                                      leaderboardViewMode === "detailed" &&
                                      flatFeeBonus > 0
                                    ) {
                                      prizeDisplay = (
                                        <div className="space-y-1">
                                          <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                            {earningsLabel}:{" "}
                                            {formatMoney(totalEarnings)}
                                          </div>
                                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                            <span className="whitespace-nowrap">
                                              {formatMoney(entry.earnings)} CPM
                                            </span>
                                            <span className="text-green-600 dark:text-green-400">
                                              +
                                            </span>
                                            <span className="whitespace-nowrap">
                                              {formatMoney(flatFeeBonus)} Bonus
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      prizeDisplay = (
                                        <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                          {earningsLabel}:{" "}
                                          {formatMoney(totalEarnings)}
                                        </div>
                                      );
                                    }
                                  } else {
                                    // For leaderboard contests with earnings (Twitter: "Paid" when payouts_processed)
                                    const leaderboardLabel =
                                      isTwitter &&
                                      contest?.post_contest_status ===
                                        "payouts_processed"
                                        ? "Paid"
                                        : "Earned";
                                    if (
                                      contestType === "leaderboard" &&
                                      leaderboardViewMode === "detailed"
                                    ) {
                                      // Check for flat fee bonus in leaderboard contests
                                      const flatFeeBonus =
                                        (contest.contest_based_details as any)
                                          ?.leaderboard_contest
                                          ?.flat_fee_bonus || 0;

                                      if (flatFeeBonus > 0) {
                                        const totalEarnings =
                                          entry.earnings + flatFeeBonus;
                                        prizeDisplay = (
                                          <div className="space-y-1">
                                            <div
                                              className={cn(
                                                "font-semibold text-base",
                                                isDark
                                                  ? "text-green-300"
                                                  : "text-green-600",
                                              )}
                                            >
                                              {leaderboardLabel}:{" "}
                                              {formatMoney(totalEarnings)}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                              <span className="whitespace-nowrap">
                                                {formatMoney(entry.earnings)}{" "}
                                                Prize
                                              </span>
                                              <span className="text-green-600 dark:text-green-400">
                                                +
                                              </span>
                                              <span className="whitespace-nowrap">
                                                {formatMoney(flatFeeBonus)}{" "}
                                                Bonus
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        prizeDisplay = (
                                          <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                            {leaderboardLabel}:{" "}
                                            {formatMoney(entry.earnings)}
                                          </div>
                                        );
                                      }
                                    } else {
                                      // Simple view for leaderboard or non-CPM contests
                                      prizeDisplay = (
                                        <span className="font-semibold text-green-600 dark:text-green-400">
                                          {leaderboardLabel}:{" "}
                                          {formatMoney(entry.earnings)}
                                        </span>
                                      );
                                    }
                                  }
                                } else if (
                                  contest.contest_type === "leaderboard" &&
                                  Array.isArray(
                                    contest.contest_based_details
                                      ?.leaderboard_contest?.prizes,
                                  )
                                ) {
                                  const prizeInfo = (
                                    contest.contest_based_details
                                      .leaderboard_contest.prizes as PrizeInfo[]
                                  ).find((p) => p.position === rank);
                                  if (prizeInfo) {
                                    const prizeText =
                                      contest.status === "active"
                                        ? "Winning Zone"
                                        : "Prize";

                                    // In detailed mode, show bonus information if available
                                    if (leaderboardViewMode === "detailed") {
                                      const flatFeeBonus =
                                        (contest.contest_based_details as any)
                                          ?.leaderboard_contest
                                          ?.flat_fee_bonus || 0;

                                      if (
                                        flatFeeBonus > 0 ||
                                        (isMilestoneContestType(contestType) &&
                                          (milestoneDerivedData.creatorMostVerifiedViewsBonusMap.get(
                                            String(
                                              myLeaderboardEntry?.creator_id ||
                                                "",
                                            ),
                                          ) || 0) +
                                            (milestoneDerivedData.creatorMostVerifiedReelsBonusMap.get(
                                              String(
                                                myLeaderboardEntry?.creator_id ||
                                                  "",
                                              ),
                                            ) || 0) >
                                            0)
                                      ) {
                                        const totalEarnings =
                                          prizeInfo.amount + flatFeeBonus;
                                        prizeDisplay = (
                                          <div
                                            className={`font-semibold flex items-center ${"text-[#ff7a1a] dark:text-[#ffa35c]"}`}
                                          >
                                            <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                            <div>
                                              <div>
                                                {prizeText}:{" "}
                                                {formatMoney(totalEarnings)}
                                              </div>
                                              <div className="text-xs text-[#ff7a1a] dark:text-[#ff7a1a]">
                                                ({formatMoney(prizeInfo.amount)}{" "}
                                                Prize +{" "}
                                                {formatMoney(flatFeeBonus)}{" "}
                                                Bonus)
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        prizeDisplay = (
                                          <span
                                            className={`font-semibold flex items-center ${"text-[#ff7a1a] dark:text-[#ffa35c]"}`}
                                          >
                                            <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                            {prizeText}:{" "}
                                            {formatMoney(prizeInfo.amount)}
                                          </span>
                                        );
                                      }
                                    } else {
                                      // Simple view
                                      prizeDisplay = (
                                        <span
                                          className={`font-semibold flex items-center ${"text-[#ff7a1a] dark:text-[#ffa35c]"}`}
                                        >
                                          <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                          {prizeText}:{" "}
                                          {formatMoney(prizeInfo.amount)}
                                        </span>
                                      );
                                    }
                                  }
                                }

                                const entryIsTwitter =
                                  contest?.platform === "twitter" ||
                                  contest?.platform === "x";

                                return (
                                  <div
                                    key={entry.id}
                                    className={cn(
                                      "overflow-hidden transition-colors",
                                      isDark
                                        ? "hover:bg-white/[0.03]"
                                        : "hover:bg-neutral-50",
                                    )}
                                  >
                                    <CardContent className="px-5 py-3.5">
                                      <div className="flex items-center gap-3 sm:gap-3.5">
                                        <RankIndicator
                                          rank={rank}
                                          isDark={isDark}
                                          title={`Rank ${rank}`}
                                        />
                                        <Avatar
                                          className={cn(
                                            "h-10 w-10 shrink-0 rounded-lg border-0",
                                            isDark
                                              ? "border-slate-600"
                                              : "border-slate-200",
                                          )}
                                        >
                                          <AvatarImage
                                            src={
                                              entry.user_platform_pfp_url ??
                                              entry.creator_pfp_url ??
                                              undefined
                                            }
                                            alt={
                                              entryIsTwitter
                                                ? (entry as any).app_username ||
                                                  entry.user_platform_username
                                                : entry.user_platform_username
                                            }
                                            referrerPolicy="no-referrer"
                                            loading="lazy"
                                          />
                                          <AvatarFallback
                                            className={cn(
                                              "font-semibold text-xs sm:text-sm",
                                              isDark
                                                ? "bg-white/10 text-slate-200"
                                                : "bg-neutral-100 text-neutral-700",
                                            )}
                                          >
                                            {(entryIsTwitter
                                              ? ((entry as any).app_username as
                                                  | string
                                                  | undefined)
                                              : entry.user_platform_username)?.[0]?.toUpperCase() ||
                                              "U"}
                                          </AvatarFallback>
                                        </Avatar>

                                        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                                          <div className="min-w-0 space-y-1">
                                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                              <p
                                                className={cn(
                                                  "text-sm sm:text-base font-semibold leading-tight",
                                                  isDark
                                                    ? "text-white"
                                                    : "text-slate-900",
                                                )}
                                              >
                                                {entry.user_platform_username}
                                              </p>
                                              <LeaderboardRowPlatformIcons
                                                show={
                                                  showLeaderboardPlatformIcons &&
                                                  !entryIsTwitter
                                                }
                                                values={[entry.platform]}
                                                tab={leaderboardPlatformTab}
                                              />
                                              {renderVerificationBadges(entry)}
                                            </div>
                                            <p
                                              className={cn(
                                                "text-xs leading-tight",
                                                isDark
                                                  ? "text-slate-500"
                                                  : "text-slate-500",
                                              )}
                                            >
                                              {entryIsTwitter
                                                ? "Joined: "
                                                : "Submitted: "}{" "}
                                              {formatTimeAgo(
                                                entryIsTwitter
                                                  ? (entry as any)?.joined_at ||
                                                      entry.created_at ||
                                                      null
                                                  : entry.created_at,
                                              )}
                                            </p>
                                          </div>
                                          <div className="shrink-0 text-right pl-2">
                                            <p
                                              className={cn(
                                                "text-sm font-medium tabular-nums sm:text-base leading-tight",
                                                isDark
                                                  ? "text-slate-100"
                                                  : "text-slate-800",
                                              )}
                                            >
                                              {entryIsTwitter ? (
                                                <>
                                                  {typeof (entry as any)
                                                    .total_points === "number"
                                                    ? (
                                                        entry as any
                                                      ).total_points.toLocaleString()
                                                    : "0"}{" "}
                                                  points
                                                </>
                                              ) : (
                                                <>
                                                  {entry.views
                                                    ? entry.views.toLocaleString()
                                                    : "0"}{" "}
                                                  views
                                                </>
                                              )}
                                            </p>
                                            {prizeDisplay ? (
                                              <div className="mt-1 text-xs sm:text-sm">
                                                {prizeDisplay}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </div>
                                );
                              })}
                        </div>

                        {/* Pagination Controls */}
                        {effectiveLeaderboardTotalPages > 1 && (
                          <div
                            className={cn(
                              surfaceClass,
                              "mt-3 flex flex-wrap items-center justify-between gap-3 px-5 py-3",
                            )}
                          >
                            <span
                              className={cn(
                                "text-xs",
                                isDark ? "text-slate-400" : "text-slate-500",
                              )}
                            >
                              Showing{" "}
                              {(leaderboardDisplayMode === "creator" &&
                              groupedLeaderboardByCreator
                                ? groupedLeaderboardByCreator.length
                                : leaderboard.length
                              ).toLocaleString()}{" "}
                              of {effectiveLeaderboardTotalEntries.toLocaleString()}
                            </span>
                            <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                fetchLeaderboard(
                                  leaderboardCurrentPage - 1,
                                  contest?.platform?.toLowerCase() !==
                                    "twitter" &&
                                    contest?.platform?.toLowerCase() !== "x" &&
                                    leaderboardDisplayMode === "creator",
                                )
                              }
                              disabled={leaderboardCurrentPage <= 1}
                            >
                              Previous
                            </Button>
                            <span
                              className={cn(
                                "text-sm font-medium",
                                isDark ? "text-gray-300" : "text-slate-500",
                              )}
                            >
                              Page {leaderboardCurrentPage} of{" "}
                              {effectiveLeaderboardTotalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                fetchLeaderboard(
                                  leaderboardCurrentPage + 1,
                                  contest?.platform?.toLowerCase() !==
                                    "twitter" &&
                                    contest?.platform?.toLowerCase() !== "x" &&
                                    leaderboardDisplayMode === "creator",
                                )
                              }
                              disabled={
                                leaderboardCurrentPage >=
                                effectiveLeaderboardTotalPages
                              }
                            >
                              Next
                            </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </TabPanel>

              {/* Analytics Tab */}
              <TabPanel value="analytics" activeTab={activeTab}>
                {(() => {
                  // For Twitter campaigns, use analyticsTweets; for others, use leaderboard
                  const allSubmissionsForAnalytics =
                    contest?.platform?.toLowerCase() === "twitter"
                      ? analyticsTweets
                      : leaderboard;

                  // Helper to normalize status for analytics filtering/counts
                  const getAnalyticsStatus = (submission: any) => {
                    const isTwitterTweet = submission.is_twitter_tweet === true;

                    if (!isTwitterTweet) {
                      return submission.status;
                    }

                    const baseStatus = submission.status;
                    const moderationStatus =
                      submission.moderation_status || "pending";

                    // If a Twitter submission has been marked as paid via status,
                    // treat it as "paid" regardless of moderation_status so
                    // Verified/Paid tabs/counts include both.
                    if (baseStatus === "paid") {
                      return "paid";
                    }

                    return moderationStatus;
                  };

                  // Filter submissions for analytics based on active analytics tab
                  const filteredAnalyticsSubmissions =
                    allSubmissionsForAnalytics.filter((submission: any) => {
                      const status = getAnalyticsStatus(submission);

                      if (activeAnalyticsTab === "all") return true;
                      if (activeAnalyticsTab === "not_rejected")
                        return status !== "rejected";
                      if (activeAnalyticsTab === "verified_or_paid") {
                        return status === "verified" || status === "paid";
                      }
                      return status === activeAnalyticsTab;
                    });

                  // Calculate Twitter campaign metrics from filtered submissions
                  const calculateTwitterMetrics = () => {
                    const metrics = {
                      total_tweets: 0,
                      total_likes: 0,
                      /** Count of reply/comment *submissions* (not “replies on your tweet”). */
                      total_replies: 0,
                      /** Count of retweet *submissions*. */
                      total_retweets: 0,
                      /** Count of quote *submissions*. */
                      total_quote_reposts: 0,
                      total_engagement: 0,
                      total_impressions: 0,
                      total_points: 0,
                    };

                    // Identify if this is a points-based Twitter contest (leaderboard or CPM)
                    const isTwitterPointsContest =
                      (contest?.platform?.toLowerCase() === "twitter" ||
                        contest?.platform?.toLowerCase() === "x") &&
                      contest?.contest_format === "text_image" &&
                      (contest?.contest_type === "leaderboard" ||
                        isCpmContestType(contest?.contest_type));

                    // Track creator ids that match the active analytics filter
                    const filteredCreatorIds = new Set<string>();

                    filteredAnalyticsSubmissions.forEach((sub: any) => {
                      if (sub.is_twitter_tweet && sub.other_stats) {
                        metrics.total_tweets += 1;
                        metrics.total_likes += sub.other_stats.likes || 0;
                        const actionKind = getTwitterSubmissionActionKind(sub);
                        if (actionKind === "reply") metrics.total_replies += 1;
                        if (actionKind === "retweet")
                          metrics.total_retweets += 1;
                        if (actionKind === "quote")
                          metrics.total_quote_reposts += 1;
                        metrics.total_impressions += sub.views || 0;

                        // Calculate points as base_points + manual adjustment (avoid double counting)
                        const basePoints =
                          typeof sub.other_stats.base_points === "number"
                            ? sub.other_stats.base_points
                            : sub.other_stats.points || 0;
                        const manualPoints =
                          typeof sub.other_stats.manual_points_adjustment ===
                          "number"
                            ? sub.other_stats.manual_points_adjustment
                            : 0;
                        metrics.total_points += basePoints + manualPoints;

                        if (sub.creator_id) {
                          filteredCreatorIds.add(sub.creator_id);
                        }
                      }
                    });

                    // If we have leaderboard data (already includes creator-level manual adjustments),
                    // prefer it for total_points so analytics matches the leaderboard view.
                    if (isTwitterPointsContest && leaderboard.length > 0) {
                      let leaderboardPointsTotal = 0;
                      let hasLeaderboardPoints = false;

                      leaderboard.forEach((entry: any) => {
                        const creatorId = entry.creator_id;
                        if (!creatorId) return;

                        // When a filter is active, only include creators present in the filtered submissions
                        if (
                          activeAnalyticsTab !== "all" &&
                          filteredCreatorIds.size > 0 &&
                          !filteredCreatorIds.has(creatorId)
                        ) {
                          return;
                        }

                        const entryPoints =
                          typeof entry.total_points === "number"
                            ? entry.total_points
                            : null;
                        if (entryPoints !== null) {
                          leaderboardPointsTotal += entryPoints;
                          hasLeaderboardPoints = true;
                        }
                      });

                      if (hasLeaderboardPoints) {
                        metrics.total_points = leaderboardPointsTotal;
                      }
                    }

                    metrics.total_engagement =
                      metrics.total_likes +
                      metrics.total_replies +
                      metrics.total_retweets +
                      metrics.total_quote_reposts;

                    return metrics;
                  };

                  // Calculate metrics from filtered submissions (for display in Campaign Metrics)
                  const calculatedMetrics =
                    contest?.platform?.toLowerCase() === "twitter"
                      ? calculateTwitterMetrics()
                      : null;

                  // Use the API twitterMetrics state for target metrics (raid campaigns),
                  // but use calculatedMetrics for the general campaign metrics display
                  const metricsForDisplay = calculatedMetrics || twitterMetrics;

                  return (
                    <div
                      className={cn(
                        "rounded-xl shadow-md p-2",
                        isDark ? "bg-[#180438]" : "bg-white",
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
                            <TabsList className="grid w-full grid-cols-7">
                              <TabsTrigger
                                value="all"
                                className={cn(
                                  "text-sm",
                                  isDark
                                    ? "text-white border border-gray-500"
                                    : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600",
                                )}
                              >
                                All ({allSubmissionsForAnalytics?.length || 0})
                              </TabsTrigger>
                              <TabsTrigger
                                value="not_rejected"
                                className={cn(
                                  "text-sm",
                                  isDark
                                    ? "text-white border border-gray-500"
                                    : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600",
                                )}
                              >
                                Not Rejected (
                                {allSubmissionsForAnalytics?.filter(
                                  (s: any) =>
                                    getAnalyticsStatus(s) !== "rejected",
                                ).length || 0}
                                )
                              </TabsTrigger>
                              <TabsTrigger
                                value="verified"
                                className={cn(
                                  "text-sm",
                                  isDark
                                    ? "text-white border border-gray-500"
                                    : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600",
                                )}
                              >
                                Verified (
                                {allSubmissionsForAnalytics?.filter(
                                  (s: any) =>
                                    getAnalyticsStatus(s) === "verified",
                                ).length || 0}
                                )
                              </TabsTrigger>
                              <TabsTrigger
                                value="paid"
                                className={cn(
                                  "text-sm",
                                  isDark
                                    ? "text-white border border-gray-500"
                                    : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600",
                                )}
                              >
                                Paid (
                                {allSubmissionsForAnalytics?.filter(
                                  (s: any) => getAnalyticsStatus(s) === "paid",
                                ).length || 0}
                                )
                              </TabsTrigger>
                              <TabsTrigger
                                value="pending"
                                className={cn(
                                  "text-sm",
                                  isDark
                                    ? "text-white border border-gray-500"
                                    : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600",
                                )}
                              >
                                Pending (
                                {allSubmissionsForAnalytics?.filter(
                                  (s: any) =>
                                    getAnalyticsStatus(s) === "pending",
                                ).length || 0}
                                )
                              </TabsTrigger>
                              <TabsTrigger
                                value="rejected"
                                className={cn(
                                  "text-sm",
                                  isDark
                                    ? "text-white border border-gray-500"
                                    : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600",
                                )}
                              >
                                Rejected (
                                {allSubmissionsForAnalytics?.filter(
                                  (s: any) =>
                                    getAnalyticsStatus(s) === "rejected",
                                ).length || 0}
                                )
                              </TabsTrigger>
                              <TabsTrigger
                                value="verified_or_paid"
                                className={cn(
                                  "text-sm",
                                  isDark
                                    ? "text-white border border-gray-500"
                                    : "data-[state=inactive]:bg-gray-100 data-[state=inactive]:text-gray-600",
                                )}
                              >
                                Verified/Paid (
                                {allSubmissionsForAnalytics?.filter(
                                  (s: any) => {
                                    const status = getAnalyticsStatus(s);
                                    return (
                                      status === "verified" || status === "paid"
                                    );
                                  },
                                ).length || 0}
                                )
                              </TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Loading state for analytics tweets */}
                        {loadingAnalyticsTweets &&
                          contest?.platform?.toLowerCase() === "twitter" && (
                            <div className="flex items-center justify-center py-12">
                              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                            </div>
                          )}

                        {/* Campaign Metrics for Twitter Campaigns */}
                        {!loadingAnalyticsTweets &&
                          contest?.platform?.toLowerCase() === "twitter" &&
                          !twitterMetrics &&
                          !calculatedMetrics && (
                            <div className="text-center py-8 text-gray-500">
                              <p>
                                No analytics data available yet. Data will
                                appear once tweets are submitted.
                              </p>
                            </div>
                          )}
                        {!loadingAnalyticsTweets &&
                          contest?.platform?.toLowerCase() === "twitter" &&
                          (twitterMetrics || calculatedMetrics) && (
                            <div className="space-y-6">
                              {/* For Raid Campaigns: Show Target Tweet, Target Metrics, and Current Achieved */}
                              {(() => {
                                const isRaid =
                                  (contest as any).content_type === "raid" &&
                                  contest?.contest_format === "text_image";

                                if (!isRaid) return null;

                                // Get raid target data from contest_based_details (source of truth) or twitterMetrics (synced)
                                const raidTarget = (contest as any)
                                  ?.contest_based_details?.twitter_campaign
                                  ?.raid_target;
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
                                    ? parseInt(
                                        String(targetMetrics.comments),
                                        10,
                                      )
                                    : null);
                                const targetRetweets =
                                  twitterMetrics?.target_retweets ??
                                  (targetMetrics.retweets
                                    ? parseInt(
                                        String(targetMetrics.retweets),
                                        10,
                                      )
                                    : null);
                                const targetQuoteReposts =
                                  twitterMetrics?.target_quote_reposts ??
                                  (targetMetrics.quote_reposts
                                    ? parseInt(
                                        String(targetMetrics.quote_reposts),
                                        10,
                                      )
                                    : null);

                                return (
                                  <>
                                    {/* Target Tweet Section - Show first */}
                                    {targetTweetUrl && (
                                      <div className="mb-6">
                                        <h3
                                          className={cn(
                                            "text-lg font-semibold mb-4 flex items-center gap-2",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900",
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
                                              : "bg-slate-50 border-slate-200",
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
                                                : "text-sky-600 hover:text-sky-700",
                                            )}
                                          >
                                            {targetTweetUrl}
                                            <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                          </a>
                                        </div>
                                      </div>
                                    )}

                                    {/* Target Metrics Section - Only show metrics that are set (not null, not 0) */}
                                    {(() => {
                                      const hasTargetMetrics =
                                        (targetLikes !== null &&
                                          targetLikes > 0) ||
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
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900",
                                            )}
                                          >
                                            Target Metrics
                                          </h3>
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {targetLikes !== null &&
                                              targetLikes > 0 && (
                                                <div
                                                  className={cn(
                                                    "overflow-hidden rounded-2xl border shadow-none",
                                                    isDark
                                                      ? "border-slate-700 bg-[#180438]"
                                                      : "border-neutral-200 bg-white",
                                                  )}
                                                >
                                                  <CardContent className="p-6 flex justify-between items-center">
                                                    <div
                                                      className={cn(
                                                        "flex-1 space-y-2",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-slate-800",
                                                      )}
                                                    >
                                                      <p
                                                        className={cn(
                                                          "text-sm font-medium",
                                                          isDark
                                                            ? "text-slate-200"
                                                            : "text-slate-600",
                                                        )}
                                                      >
                                                        Target Likes
                                                      </p>
                                                      <p
                                                        className={cn(
                                                          "text-2xl font-semibold",
                                                          isDark
                                                            ? "text-white"
                                                            : "text-slate-800",
                                                        )}
                                                      >
                                                        {targetLikes.toLocaleString()}
                                                      </p>
                                                    </div>
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a]/10 text-[#ff7a1a]">
                                                      <ThumbsUp className="h-7 w-7" />
                                                    </div>
                                                  </CardContent>
                                                </div>
                                              )}
                                            {targetComments !== null &&
                                              targetComments > 0 && (
                                                <div
                                                  className={cn(
                                                    "overflow-hidden rounded-2xl border shadow-none",
                                                    isDark
                                                      ? "border-slate-700 bg-[#180438]"
                                                      : "border-neutral-200 bg-white",
                                                  )}
                                                >
                                                  <CardContent className="p-6 flex justify-between items-center">
                                                    <div
                                                      className={cn(
                                                        "flex-1 space-y-2",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-slate-800",
                                                      )}
                                                    >
                                                      <p
                                                        className={cn(
                                                          "text-sm font-medium",
                                                          isDark
                                                            ? "text-slate-200"
                                                            : "text-slate-600",
                                                        )}
                                                      >
                                                        Target Comments
                                                      </p>
                                                      <p
                                                        className={cn(
                                                          "text-2xl font-semibold",
                                                          isDark
                                                            ? "text-white"
                                                            : "text-slate-800",
                                                        )}
                                                      >
                                                        {targetComments.toLocaleString()}
                                                      </p>
                                                    </div>
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a]/10 text-[#ff7a1a]">
                                                      <MessageCircle className="h-7 w-7" />
                                                    </div>
                                                  </CardContent>
                                                </div>
                                              )}
                                            {targetRetweets !== null &&
                                              targetRetweets > 0 && (
                                                <div
                                                  className={cn(
                                                    "overflow-hidden rounded-2xl border shadow-none",
                                                    isDark
                                                      ? "border-slate-700 bg-[#180438]"
                                                      : "border-neutral-200 bg-white",
                                                  )}
                                                >
                                                  <CardContent className="p-6 flex justify-between items-center">
                                                    <div
                                                      className={cn(
                                                        "flex-1 space-y-2",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-slate-800",
                                                      )}
                                                    >
                                                      <p
                                                        className={cn(
                                                          "text-sm font-medium",
                                                          isDark
                                                            ? "text-slate-200"
                                                            : "text-slate-600",
                                                        )}
                                                      >
                                                        Target Retweets
                                                      </p>
                                                      <p
                                                        className={cn(
                                                          "text-2xl font-semibold",
                                                          isDark
                                                            ? "text-white"
                                                            : "text-slate-800",
                                                        )}
                                                      >
                                                        {targetRetweets.toLocaleString()}
                                                      </p>
                                                    </div>
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a]/10 text-[#ff7a1a]">
                                                      <Share2 className="h-7 w-7" />
                                                    </div>
                                                  </CardContent>
                                                </div>
                                              )}
                                            {targetQuoteReposts !== null &&
                                              targetQuoteReposts > 0 && (
                                                <div
                                                  className={cn(
                                                    "overflow-hidden rounded-2xl border shadow-none",
                                                    isDark
                                                      ? "border-slate-700 bg-[#180438]"
                                                      : "border-neutral-200 bg-white",
                                                  )}
                                                >
                                                  <CardContent className="p-6 flex justify-between items-center">
                                                    <div
                                                      className={cn(
                                                        "flex-1 space-y-2",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-slate-800",
                                                      )}
                                                    >
                                                      <p
                                                        className={cn(
                                                          "text-sm font-medium",
                                                          isDark
                                                            ? "text-slate-200"
                                                            : "text-slate-600",
                                                        )}
                                                      >
                                                        Target Quote Reposts
                                                      </p>
                                                      <p
                                                        className={cn(
                                                          "text-2xl font-semibold",
                                                          isDark
                                                            ? "text-white"
                                                            : "text-slate-800",
                                                        )}
                                                      >
                                                        {targetQuoteReposts.toLocaleString()}
                                                      </p>
                                                    </div>
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a]/10 text-[#ff7a1a]">
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
                                              isDark
                                                ? "text-white"
                                                : "text-slate-900",
                                            )}
                                          >
                                            Current Progress
                                          </h3>
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                                            {twitterMetrics.target_current_likes !==
                                              null &&
                                              (() => {
                                                const current =
                                                  twitterMetrics.target_current_likes ||
                                                  0;
                                                const target = targetLikes;
                                                const isReached =
                                                  target !== null &&
                                                  current >= target;
                                                const progress =
                                                  target !== null && target > 0
                                                    ? Math.min(
                                                        100,
                                                        (current / target) *
                                                          100,
                                                      )
                                                    : 0;

                                                return (
                                                  <div
                                                    className={cn(
                                                      "overflow-hidden rounded-2xl border shadow-none",
                                                      isDark
                                                        ? "border-slate-700 bg-[#180438]"
                                                        : "border-neutral-200 bg-white",
                                                    )}
                                                  >
                                                    <CardContent className="p-6">
                                                      <div className="flex justify-between items-start mb-3">
                                                        <div
                                                          className={cn(
                                                            "flex-1 space-y-1",
                                                            isDark
                                                              ? "text-white"
                                                              : "text-slate-800",
                                                          )}
                                                        >
                                                          <p
                                                            className={cn(
                                                              "text-xs font-semibold uppercase tracking-wide",
                                                              isDark
                                                                ? "text-slate-200"
                                                                : "text-slate-600",
                                                            )}
                                                          >
                                                            Current Likes
                                                          </p>
                                                          <p
                                                            className={cn(
                                                              "text-2xl font-semibold",
                                                              isDark
                                                                ? "text-white"
                                                                : "text-slate-800",
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
                                                                  : "text-slate-500",
                                                              )}
                                                            >
                                                              of{" "}
                                                              {target.toLocaleString()}{" "}
                                                              target
                                                            </p>
                                                          )}
                                                        </div>
                                                        <div
                                                          className={cn(
                                                            "w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300",
                                                            isReached
                                                              ? "bg-green-500"
                                                              : "bg-pink-500",
                                                          )}
                                                        >
                                                          {isReached ? (
                                                            <CheckCircle2 className="h-7 w-7" />
                                                          ) : (
                                                            <ThumbsUp className="h-7 w-7" />
                                                          )}
                                                        </div>
                                                      </div>
                                                      {target !== null &&
                                                        target > 0 && (
                                                          <div className="mt-3">
                                                            <div
                                                              className={cn(
                                                                "h-2 rounded-full overflow-hidden",
                                                                isDark
                                                                  ? "bg-slate-700"
                                                                  : "bg-slate-200",
                                                              )}
                                                            >
                                                              <div
                                                                className={cn(
                                                                  "h-full transition-all duration-500",
                                                                  isReached
                                                                    ? "bg-green-500"
                                                                    : "bg-pink-500",
                                                                )}
                                                                style={{
                                                                  width: `${progress}%`,
                                                                }}
                                                              />
                                                            </div>
                                                            <p
                                                              className={cn(
                                                                "text-xs mt-1 text-center",
                                                                isDark
                                                                  ? "text-slate-400"
                                                                  : "text-slate-500",
                                                              )}
                                                            >
                                                              {progress.toFixed(
                                                                0,
                                                              )}
                                                              % complete
                                                            </p>
                                                          </div>
                                                        )}
                                                    </CardContent>
                                                  </div>
                                                );
                                              })()}
                                            {twitterMetrics.target_current_comments !==
                                              null &&
                                              (() => {
                                                const current =
                                                  twitterMetrics.target_current_comments ||
                                                  0;
                                                const target = targetComments;
                                                const isReached =
                                                  target !== null &&
                                                  current >= target;
                                                const progress =
                                                  target !== null && target > 0
                                                    ? Math.min(
                                                        100,
                                                        (current / target) *
                                                          100,
                                                      )
                                                    : 0;

                                                return (
                                                  <div
                                                    className={cn(
                                                      "overflow-hidden rounded-2xl border shadow-none",
                                                      isDark
                                                        ? "border-slate-700 bg-[#180438]"
                                                        : "border-neutral-200 bg-white",
                                                    )}
                                                  >
                                                    <CardContent className="p-6">
                                                      <div className="flex justify-between items-start mb-3">
                                                        <div
                                                          className={cn(
                                                            "flex-1 space-y-1",
                                                            isDark
                                                              ? "text-white"
                                                              : "text-slate-800",
                                                          )}
                                                        >
                                                          <p
                                                            className={cn(
                                                              "text-xs font-semibold uppercase tracking-wide",
                                                              isDark
                                                                ? "text-slate-200"
                                                                : "text-slate-600",
                                                            )}
                                                          >
                                                            Current Comments
                                                          </p>
                                                          <p
                                                            className={cn(
                                                              "text-2xl font-semibold",
                                                              isDark
                                                                ? "text-white"
                                                                : "text-slate-800",
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
                                                                  : "text-slate-500",
                                                              )}
                                                            >
                                                              of{" "}
                                                              {target.toLocaleString()}{" "}
                                                              target
                                                            </p>
                                                          )}
                                                        </div>
                                                        <div
                                                          className={cn(
                                                            "w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300",
                                                            isReached
                                                              ? "bg-green-500"
                                                              : "bg-orange-500",
                                                          )}
                                                        >
                                                          {isReached ? (
                                                            <CheckCircle2 className="h-7 w-7" />
                                                          ) : (
                                                            <MessageCircle className="h-7 w-7" />
                                                          )}
                                                        </div>
                                                      </div>
                                                      {target !== null &&
                                                        target > 0 && (
                                                          <div className="mt-3">
                                                            <div
                                                              className={cn(
                                                                "h-2 rounded-full overflow-hidden",
                                                                isDark
                                                                  ? "bg-slate-700"
                                                                  : "bg-slate-200",
                                                              )}
                                                            >
                                                              <div
                                                                className={cn(
                                                                  "h-full transition-all duration-500",
                                                                  isReached
                                                                    ? "bg-green-500"
                                                                    : "bg-orange-500",
                                                                )}
                                                                style={{
                                                                  width: `${progress}%`,
                                                                }}
                                                              />
                                                            </div>
                                                            <p
                                                              className={cn(
                                                                "text-xs mt-1 text-center",
                                                                isDark
                                                                  ? "text-slate-400"
                                                                  : "text-slate-500",
                                                              )}
                                                            >
                                                              {progress.toFixed(
                                                                0,
                                                              )}
                                                              % complete
                                                            </p>
                                                          </div>
                                                        )}
                                                    </CardContent>
                                                  </div>
                                                );
                                              })()}
                                            {twitterMetrics.target_current_retweets !==
                                              null &&
                                              (() => {
                                                const current =
                                                  twitterMetrics.target_current_retweets ||
                                                  0;
                                                const target = targetRetweets;
                                                const isReached =
                                                  target !== null &&
                                                  current >= target;
                                                const progress =
                                                  target !== null && target > 0
                                                    ? Math.min(
                                                        100,
                                                        (current / target) *
                                                          100,
                                                      )
                                                    : 0;

                                                return (
                                                  <div
                                                    className={cn(
                                                      "overflow-hidden rounded-2xl border shadow-none",
                                                      isDark
                                                        ? "border-slate-700 bg-[#180438]"
                                                        : "border-neutral-200 bg-white",
                                                    )}
                                                  >
                                                    <CardContent className="p-6">
                                                      <div className="flex justify-between items-start mb-3">
                                                        <div
                                                          className={cn(
                                                            "flex-1 space-y-1",
                                                            isDark
                                                              ? "text-white"
                                                              : "text-slate-800",
                                                          )}
                                                        >
                                                          <p
                                                            className={cn(
                                                              "text-xs font-semibold uppercase tracking-wide",
                                                              isDark
                                                                ? "text-slate-200"
                                                                : "text-slate-600",
                                                            )}
                                                          >
                                                            Current Retweets
                                                          </p>
                                                          <p
                                                            className={cn(
                                                              "text-2xl font-semibold",
                                                              isDark
                                                                ? "text-white"
                                                                : "text-slate-800",
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
                                                                  : "text-slate-500",
                                                              )}
                                                            >
                                                              of{" "}
                                                              {target.toLocaleString()}{" "}
                                                              target
                                                            </p>
                                                          )}
                                                        </div>
                                                        <div
                                                          className={cn(
                                                            "w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300",
                                                            isReached
                                                              ? "bg-green-500"
                                                              : "bg-cyan-500",
                                                          )}
                                                        >
                                                          {isReached ? (
                                                            <CheckCircle2 className="h-7 w-7" />
                                                          ) : (
                                                            <Share2 className="h-7 w-7" />
                                                          )}
                                                        </div>
                                                      </div>
                                                      {target !== null &&
                                                        target > 0 && (
                                                          <div className="mt-3">
                                                            <div
                                                              className={cn(
                                                                "h-2 rounded-full overflow-hidden",
                                                                isDark
                                                                  ? "bg-slate-700"
                                                                  : "bg-slate-200",
                                                              )}
                                                            >
                                                              <div
                                                                className={cn(
                                                                  "h-full transition-all duration-500",
                                                                  isReached
                                                                    ? "bg-green-500"
                                                                    : "bg-cyan-500",
                                                                )}
                                                                style={{
                                                                  width: `${progress}%`,
                                                                }}
                                                              />
                                                            </div>
                                                            <p
                                                              className={cn(
                                                                "text-xs mt-1 text-center",
                                                                isDark
                                                                  ? "text-slate-400"
                                                                  : "text-slate-500",
                                                              )}
                                                            >
                                                              {progress.toFixed(
                                                                0,
                                                              )}
                                                              % complete
                                                            </p>
                                                          </div>
                                                        )}
                                                    </CardContent>
                                                  </div>
                                                );
                                              })()}
                                            {twitterMetrics.target_current_quote_reposts !==
                                              null &&
                                              (() => {
                                                const current =
                                                  twitterMetrics.target_current_quote_reposts ||
                                                  0;
                                                const target =
                                                  targetQuoteReposts;
                                                const isReached =
                                                  target !== null &&
                                                  current >= target;
                                                const progress =
                                                  target !== null && target > 0
                                                    ? Math.min(
                                                        100,
                                                        (current / target) *
                                                          100,
                                                      )
                                                    : 0;

                                                return (
                                                  <div
                                                    className={cn(
                                                      "overflow-hidden rounded-2xl border shadow-none",
                                                      isDark
                                                        ? "border-slate-700 bg-[#180438]"
                                                        : "border-neutral-200 bg-white",
                                                    )}
                                                  >
                                                    <CardContent className="p-6">
                                                      <div className="flex justify-between items-start mb-3">
                                                        <div
                                                          className={cn(
                                                            "flex-1 space-y-1",
                                                            isDark
                                                              ? "text-white"
                                                              : "text-slate-800",
                                                          )}
                                                        >
                                                          <p
                                                            className={cn(
                                                              "text-xs font-semibold uppercase tracking-wide",
                                                              isDark
                                                                ? "text-slate-200"
                                                                : "text-slate-600",
                                                            )}
                                                          >
                                                            Current Quote
                                                            Reposts
                                                          </p>
                                                          <p
                                                            className={cn(
                                                              "text-2xl font-semibold",
                                                              isDark
                                                                ? "text-white"
                                                                : "text-slate-800",
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
                                                                  : "text-slate-500",
                                                              )}
                                                            >
                                                              of{" "}
                                                              {target.toLocaleString()}{" "}
                                                              target
                                                            </p>
                                                          )}
                                                        </div>
                                                        <div
                                                          className={cn(
                                                            "w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300",
                                                            isReached
                                                              ? "bg-green-500"
                                                              : "bg-indigo-500",
                                                          )}
                                                        >
                                                          {isReached ? (
                                                            <CheckCircle2 className="h-7 w-7" />
                                                          ) : (
                                                            <RefreshCw className="h-7 w-7" />
                                                          )}
                                                        </div>
                                                      </div>
                                                      {target !== null &&
                                                        target > 0 && (
                                                          <div className="mt-3">
                                                            <div
                                                              className={cn(
                                                                "h-2 rounded-full overflow-hidden",
                                                                isDark
                                                                  ? "bg-slate-700"
                                                                  : "bg-slate-200",
                                                              )}
                                                            >
                                                              <div
                                                                className={cn(
                                                                  "h-full transition-all duration-500",
                                                                  isReached
                                                                    ? "bg-green-500"
                                                                    : "bg-indigo-500",
                                                                )}
                                                                style={{
                                                                  width: `${progress}%`,
                                                                }}
                                                              />
                                                            </div>
                                                            <p
                                                              className={cn(
                                                                "text-xs mt-1 text-center",
                                                                isDark
                                                                  ? "text-slate-400"
                                                                  : "text-slate-500",
                                                              )}
                                                            >
                                                              {progress.toFixed(
                                                                0,
                                                              )}
                                                              % complete
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
                                                  "overflow-hidden rounded-2xl border shadow-none",
                                                  isDark
                                                    ? "border-slate-700 bg-[#180438]"
                                                    : "border-neutral-200 bg-white",
                                                )}
                                              >
                                                <CardContent className="p-6 flex justify-between items-center">
                                                  <div
                                                    className={cn(
                                                      "flex-1 space-y-2",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-800",
                                                    )}
                                                  >
                                                    <p
                                                      className={cn(
                                                        "text-sm font-medium",
                                                        isDark
                                                          ? "text-slate-200"
                                                          : "text-slate-600",
                                                      )}
                                                    >
                                                      Current Views
                                                    </p>
                                                    <p
                                                      className={cn(
                                                        "text-2xl font-semibold",
                                                        isDark
                                                          ? "text-white"
                                                          : "text-slate-800",
                                                      )}
                                                    >
                                                      {(
                                                        twitterMetrics.target_current_views ||
                                                        0
                                                      ).toLocaleString()}
                                                    </p>
                                                  </div>
                                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a]/10 text-[#ff7a1a]">
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
                                                    : "bg-yellow-50 border-yellow-200",
                                              )}
                                            >
                                              {twitterMetrics.targets_reached ? (
                                                <CheckCircle2
                                                  className={cn(
                                                    "h-6 w-6 flex-shrink-0",
                                                    isDark
                                                      ? "text-green-400"
                                                      : "text-green-600",
                                                  )}
                                                />
                                              ) : (
                                                <Clock
                                                  className={cn(
                                                    "h-6 w-6 flex-shrink-0",
                                                    isDark
                                                      ? "text-yellow-400"
                                                      : "text-yellow-600",
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
                                                        : "text-yellow-800",
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
                                                        : "text-yellow-700",
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

                              {/* General Campaign Metrics Section (for both raid and awareness) */}
                              <div>
                                <h3
                                  className={cn(
                                    "text-lg font-semibold mb-4",
                                    isDark ? "text-white" : "text-slate-900",
                                  )}
                                >
                                  Campaign Metrics
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
                                  {/* Helper function for metric cards */}
                                  {(() => {
                                    const renderMetricCard = (
                                      icon: React.ReactNode,
                                      label: string,
                                      value: string | number,
                                      iconBgClass: string,
                                      barGradientClass: string,
                                      hint?: string,
                                    ) => (
                                      <div
                                        className={cn(
                                          "group rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden relative min-w-0",
                                          isDark
                                            ? "bg-[#180438] border border-white/20 backdrop-blur-2xl"
                                            : "bg-white border border-blue-100",
                                        )}
                                        title={hint}
                                      >
                                        <div className="p-3 sm:p-4 relative z-10">
                                          <div className="flex items-start gap-3 mb-2">
                                            <div
                                              className={cn(
                                                "w-10 h-10 shrink-0 flex items-center justify-center rounded-lg shadow-md backdrop-blur-sm",
                                                iconBgClass,
                                              )}
                                            >
                                              {icon}
                                            </div>
                                            <div className="min-w-0">
                                              <p
                                                className={cn(
                                                  "text-[11px] sm:text-xs font-medium uppercase tracking-wide leading-tight line-clamp-2",
                                                  isDark
                                                    ? "text-white/90 drop-shadow-sm"
                                                    : "text-gray-500",
                                                )}
                                              >
                                                {label}
                                              </p>
                                              <p
                                                className={cn(
                                                  "text-lg sm:text-xl font-bold mt-0.5 tabular-nums",
                                                  isDark
                                                    ? "text-white drop-shadow-lg bg-white bg-clip-text text-transparent"
                                                    : "text-gray-900",
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
                                              barGradientClass,
                                            )}
                                          ></div>
                                        </div>
                                      </div>
                                    );

                                    return (
                                      <>
                                        {renderMetricCard(
                                          <FileText className="h-5 w-5 text-white" />,
                                          "Total Tweets",
                                          metricsForDisplay?.total_tweets || 0,
                                          isDark
                                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                            : "bg-blue-500 text-white",
                                          isDark
                                            ? "bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 shadow-lg shadow-blue-400/70 animate-pulse"
                                            : "bg-blue-200",
                                        )}
                                        {renderMetricCard(
                                          <Zap className="h-5 w-5 text-white" />,
                                          "Total engagement",
                                          metricsForDisplay?.total_engagement ??
                                            0,
                                          isDark
                                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                            : "bg-violet-500 text-white",
                                          isDark
                                            ? "bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 shadow-lg shadow-violet-400/70 animate-pulse"
                                            : "bg-violet-200",
                                          "Sum of likes plus reply, retweet, and quote submission counts.",
                                        )}
                                        {renderMetricCard(
                                          <ThumbsUp className="h-5 w-5 text-white" />,
                                          "Total Likes",
                                          metricsForDisplay?.total_likes || 0,
                                          isDark
                                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                            : "bg-pink-500 text-white",
                                          isDark
                                            ? "bg-gradient-to-r from-pink-400 via-rose-400 to-red-400 shadow-lg shadow-pink-400/70 animate-pulse"
                                            : "bg-pink-200",
                                        )}
                                        {renderMetricCard(
                                          <MessageCircle className="h-5 w-5 text-white" />,
                                          "Reply posts",
                                          metricsForDisplay?.total_replies || 0,
                                          isDark
                                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                            : "bg-orange-500 text-white",
                                          isDark
                                            ? "bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 shadow-lg shadow-orange-400/70 animate-pulse"
                                            : "bg-orange-200",
                                        )}
                                        {renderMetricCard(
                                          <Share2 className="h-5 w-5 text-white" />,
                                          "Retweet posts",
                                          metricsForDisplay?.total_retweets ||
                                            0,
                                          isDark
                                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                            : "bg-cyan-500 text-white",
                                          isDark
                                            ? "bg-gradient-to-r from-cyan-400 via-teal-400 to-green-400 shadow-lg shadow-cyan-400/70 animate-pulse"
                                            : "bg-cyan-200",
                                        )}
                                        {renderMetricCard(
                                          <RefreshCw className="h-5 w-5 text-white" />,
                                          "Quote posts",
                                          metricsForDisplay?.total_quote_reposts ||
                                            0,
                                          isDark
                                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                            : "bg-indigo-500 text-white",
                                          isDark
                                            ? "bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 shadow-lg shadow-indigo-400/70 animate-pulse"
                                            : "bg-indigo-200",
                                        )}
                                        {renderMetricCard(
                                          <Eye className="h-5 w-5 text-white" />,
                                          "Total Impressions",
                                          metricsForDisplay?.total_impressions ||
                                            0,
                                          isDark
                                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                            : "bg-green-500 text-white",
                                          isDark
                                            ? "bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 shadow-lg shadow-green-400/70 animate-pulse"
                                            : "bg-green-200",
                                        )}
                                        {renderMetricCard(
                                          <TrendingUp className="h-5 w-5 text-white" />,
                                          "Total Points",
                                          metricsForDisplay?.total_points || 0,
                                          isDark
                                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                            : "bg-yellow-500 text-white",
                                          isDark
                                            ? "bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 shadow-lg shadow-yellow-400/70 animate-pulse"
                                            : "bg-yellow-200",
                                        )}
                                        {renderMetricCard(
                                          <Users className="h-5 w-5 text-white" />,
                                          "Submissions",
                                          filteredAnalyticsSubmissions.length,
                                          isDark
                                            ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                            : "bg-purple-500 text-white",
                                          isDark
                                            ? "bg-gradient-to-r from-purple-400 via-indigo-400 to-violet-400 shadow-lg shadow-purple-400/70 animate-pulse"
                                            : "bg-purple-200",
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}

                        {/* General Analytics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div
                            className={cn(
                              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                              isDark
                                ? "bg-[#180438] border border-[#D1B7F9]"
                                : "bg-white",
                            )}
                          >
                            <CardContent className="p-4 flex justify-between">
                              <div
                                className={cn(
                                  "flex-1 space-y-3",
                                  isDark ? "text-white" : "text-black",
                                )}
                              >
                                <p className="text-lg font-medium">
                                  Total Submissions
                                </p>
                                <p className="text-xl font-bold">
                                  {filteredAnalyticsSubmissions.length}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "w-10 h-10 flex items-center justify-center rounded-full",
                                  isDark
                                    ? "bg-[#FFFFFF42] text-white"
                                    : "bg-purple-100 text-[#4A00BE]",
                                )}
                              >
                                <Users className="h-5 w-5" />
                              </div>
                            </CardContent>
                          </div>

                          <div
                            className={cn(
                              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                              isDark
                                ? "bg-[#180438] border border-[#D1B7F9]"
                                : "bg-white",
                            )}
                          >
                            <CardContent className="p-4 flex justify-between">
                              <div
                                className={cn(
                                  "flex-1 space-y-3",
                                  isDark ? "text-white" : "text-black",
                                )}
                              >
                                <p className="text-lg font-medium">
                                  Approved Content
                                </p>
                                <p className="text-xl font-bold">
                                  {
                                    filteredAnalyticsSubmissions.filter(
                                      (s: any) => {
                                        const isTwitter = s.is_twitter_tweet;
                                        if (isTwitter)
                                          return (
                                            s.moderation_status === "verified"
                                          );
                                        return (
                                          s.status === "verified" ||
                                          s.status === "paid"
                                        );
                                      },
                                    ).length
                                  }
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "w-10 h-10 flex items-center justify-center rounded-full",
                                  isDark
                                    ? "bg-[#FFFFFF42] text-white"
                                    : "bg-purple-100 text-[#4A00BE]",
                                )}
                              >
                                <Trophy className="h-4 w-4" />
                              </div>
                            </CardContent>
                          </div>

                          <div
                            className={cn(
                              "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                              isDark
                                ? "bg-[#180438] border border-[#D1B7F9]"
                                : "bg-white",
                            )}
                          >
                            <CardContent className="p-4 flex justify-between">
                              <div
                                className={cn(
                                  "flex-1 space-y-3",
                                  isDark ? "text-white" : "text-black",
                                )}
                              >
                                <p className="text-lg font-medium">
                                  Campaign Duration
                                </p>
                                <p className="text-xl font-bold">
                                  {contest?.start_date && contest?.end_date
                                    ? (() => {
                                        const start = new Date(
                                          contest.start_date,
                                        );
                                        const end = new Date(contest.end_date);
                                        const diffTime = Math.abs(
                                          end.getTime() - start.getTime(),
                                        );
                                        const diffDays = Math.ceil(
                                          diffTime / (1000 * 60 * 60 * 24),
                                        );
                                        return `${diffDays} days`;
                                      })()
                                    : "N/A"}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "w-10 h-10 flex items-center justify-center rounded-full",
                                  isDark
                                    ? "bg-[#FFFFFF42] text-white"
                                    : "bg-purple-100 text-[#4A00BE]",
                                )}
                              >
                                <Calendar className="h-4 w-4" />
                              </div>
                            </CardContent>
                          </div>
                        </div>

                        {/* Views Statistics */}
                        <div className="space-y-6">
                          <div>
                            <h3
                              className={cn(
                                "font-medium mb-4",
                                isDark ? "text-white" : "text-gray-900",
                              )}
                            >
                              Views Statistics
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                              {/* Total Views */}
                              <div
                                className={cn(
                                  "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                                  isDark
                                    ? "bg-[#180438] border border-[#D1B7F9]"
                                    : "bg-white",
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p
                                      className={cn(
                                        "text-sm font-medium",
                                        isDark ? "text-white" : "text-gray-600",
                                      )}
                                    >
                                      Total Views
                                    </p>
                                    <p
                                      className={cn(
                                        "text-2xl font-bold",
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                    >
                                      {filteredAnalyticsSubmissions
                                        ?.reduce(
                                          (sum: number, s: any) =>
                                            sum + (s.views || 0),
                                          0,
                                        )
                                        .toLocaleString() || 0}
                                    </p>
                                  </div>
                                  <div
                                    className={cn(
                                      "w-10 h-10 flex items-center justify-center rounded-full",
                                      isDark
                                        ? "bg-blue-900/50 text-blue-300"
                                        : "bg-blue-100 text-blue-600",
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
                                    ? "bg-[#180438] border border-[#D1B7F9]"
                                    : "bg-white",
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p
                                      className={cn(
                                        "text-sm font-medium",
                                        isDark ? "text-white" : "text-gray-600",
                                      )}
                                    >
                                      Avg Views
                                    </p>
                                    <p
                                      className={cn(
                                        "text-2xl font-bold",
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                    >
                                      {filteredAnalyticsSubmissions?.length > 0
                                        ? Math.round(
                                            filteredAnalyticsSubmissions.reduce(
                                              (sum: number, s: any) =>
                                                sum + (s.views || 0),
                                              0,
                                            ) /
                                              filteredAnalyticsSubmissions.length,
                                          ).toLocaleString()
                                        : 0}
                                    </p>
                                  </div>
                                  <div
                                    className={cn(
                                      "w-10 h-10 flex items-center justify-center rounded-full",
                                      isDark
                                        ? "bg-green-900/50 text-green-400"
                                        : "bg-green-100 text-green-600",
                                    )}
                                  >
                                    <BarChart3 className="h-5 w-5" />
                                  </div>
                                </div>
                              </div>

                              {/* Highest Views */}
                              <div
                                className={cn(
                                  "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                                  isDark
                                    ? "bg-[#180438] border border-[#D1B7F9]"
                                    : "bg-white",
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p
                                      className={cn(
                                        "text-sm font-medium",
                                        isDark ? "text-white" : "text-gray-600",
                                      )}
                                    >
                                      Highest Views
                                    </p>
                                    <p
                                      className={cn(
                                        "text-2xl font-bold",
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                    >
                                      {filteredAnalyticsSubmissions?.length > 0
                                        ? Math.max(
                                            ...filteredAnalyticsSubmissions.map(
                                              (s: any) => s.views || 0,
                                            ),
                                          ).toLocaleString()
                                        : 0}
                                    </p>
                                  </div>
                                  <div
                                    className={cn(
                                      "w-10 h-10 flex items-center justify-center rounded-full",
                                      isDark
                                        ? "bg-yellow-900/50 text-yellow-400"
                                        : "bg-yellow-100 text-yellow-600",
                                    )}
                                  >
                                    <TrendingUp className="h-5 w-5" />
                                  </div>
                                </div>
                              </div>

                              {/* Filtered Views */}
                              <div
                                className={cn(
                                  "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-4",
                                  isDark
                                    ? "bg-[#180438] border border-[#D1B7F9]"
                                    : "bg-white",
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p
                                      className={cn(
                                        "text-sm font-medium",
                                        isDark ? "text-white" : "text-gray-600",
                                      )}
                                    >
                                      Filtered Views
                                    </p>
                                    <p
                                      className={cn(
                                        "text-2xl font-bold",
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                    >
                                      {filteredAnalyticsSubmissions
                                        ?.reduce(
                                          (sum: number, s: any) =>
                                            sum + (s.views || 0),
                                          0,
                                        )
                                        .toLocaleString() || 0}
                                    </p>
                                  </div>
                                  <div
                                    className={cn(
                                      "w-10 h-10 flex items-center justify-center rounded-full",
                                      isDark
                                        ? "bg-purple-900/50 text-purple-300"
                                        : "bg-purple-100 text-purple-600",
                                    )}
                                  >
                                    <CheckCircle2 className="h-5 w-5" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  );
                })()}
              </TabPanel>
            </TabContent>
          </div>
        </div>
      </div>

      {/* Rejection Reason Modal */}
      <Dialog
        open={rejectionReasonModalOpen}
        onOpenChange={setRejectionReasonModalOpen}
      >
        <DialogContent
          className={cn(
            "max-w-md",
            isDark
              ? "bg-[#1a1a1a] border-gray-700"
              : "bg-white border-gray-300",
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              Rejection Reason
            </DialogTitle>
          </DialogHeader>
          <div
            className={cn(
              "mt-4 p-4 rounded-lg",
              isDark
                ? "bg-[#2a2a2a] text-gray-200"
                : "bg-gray-50 text-gray-800",
            )}
          >
            <p className="text-sm whitespace-pre-wrap">{rejectionReasonText}</p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => setRejectionReasonModalOpen(false)}
              variant="outline"
              className={cn(isDark ? "border-gray-700 hover:bg-gray-800" : "")}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
