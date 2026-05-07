"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  cn,
  formatLocalDateTime,
  formatTimeAgo,
  isContestEnded,
} from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import { renderStatusBadge } from "@/lib/status-badges";
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
import {
  getMetricsRefreshCooldownInfoOpportunities,
  formatRemainingTime,
} from "@/lib/constants";
import type { UserResponse } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
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
import { buildMilestoneMostVerifiedBonusByCreatorMap } from "@/lib/milestone-contest-expected-spend";
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
const sections = [
  { id: "earning-opportunities", label: "Earning Opportunities" },
  {
    id: "prize-structure",
    label: "Prize Structure",
    conditional: "leaderboard",
  }, // Only for leaderboard contests
  { id: "contest-details", label: "Contest Details" },
  { id: "content-requirements", label: "Content Requirements" },
  { id: "participation-guidelines", label: "Participation Guidelines" },
  { id: "resources-tools", label: "Resources & Tools" },
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

// Client component that receives contestId as a prop
export function ContestClientPage({
  contestId,
  user,
}: {
  contestId: string;
  user: UserResponse["data"]["user"] | null;
}) {
  const [contest, setContest] = useState<any>(null);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [maxSubmissions, setMaxSubmissions] = useState(1);
  const [joinCampaignLoading, setJoinCampaignLoading] = useState(false);
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

  const twitterMetricsRunActive =
    twitterMetricsRun?.status === "pending" ||
    twitterMetricsRun?.status === "running";

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
    return Array.from(grouped.values()).sort((a, b) => {
      if (b.total_views !== a.total_views) return b.total_views - a.total_views;
      return a.best_rank - b.best_rank;
    });
  }, [
    leaderboard,
    leaderboardDisplayMode,
    contest?.platform,
    leaderboardCurrentPage,
    leaderboardItemsPerPage,
    creatorWiseLeaderboard,
  ]);

  const shouldLoadMilestoneBonusSubmissions = Boolean(
    contestId &&
      isMilestoneContestType(contest?.contest_type) &&
      (contest?.contest_based_details as any)?.milestone_contest?.bonus?.enabled,
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
    winnerCountsByMilestone: Map<string, number>;
  }>(() => {
    const empty = {
      submissionExpectedRewardMap: new Map<string, number>(),
      creatorMostVerifiedViewsBonusMap: new Map<string, number>(),
      creatorMostVerifiedReelsBonusMap: new Map<string, number>(),
      creatorExpectedRewardMap: new Map<string, number>(),
      winnerCountsByMilestone: new Map<string, number>(),
    };

    if (!isMilestoneContestType(contest?.contest_type)) return empty;

    const milestoneContest = (contest?.contest_based_details as any)
      ?.milestone_contest;
    const milestones = Array.isArray(milestoneContest?.milestones)
      ? milestoneContest.milestones
      : [];
    if (milestones.length === 0) return empty;

    const sortedMilestones = [...milestones].sort(
      (a: any, b: any) =>
        Number(b?.target_views || 0) - Number(a?.target_views || 0),
    );

    const allSubmissionCandidates: any[] = [
      ...(Array.isArray(allMilestoneBonusSubmissions)
        ? allMilestoneBonusSubmissions
        : []),
      ...(Array.isArray(leaderboard) ? leaderboard : []),
      ...((groupedLeaderboardByCreator || []).flatMap((g: any) =>
        Array.isArray(g?.submissions) ? g.submissions : [],
      ) as any[]),
      ...(Array.isArray(mySubmissionsListFromApi) ? mySubmissionsListFromApi : []),
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

    const submissionIsPaidForMilestone = (s: any) => {
      const st = normalizeMilestoneStatus(s?.status);
      if (st === "paid") return true;
      if (s?.paid === true) return true;
      if (Boolean(s?.paid_at)) return true;
      const explicit =
        s?.granted_amount_cents ??
        s?.paid_amount_cents ??
        s?.other_stats?.paid_amount_cents ??
        s?.other_stats?.granted_amount_cents;
      return explicit != null && Number(explicit) > 0;
    };

    const eligibleSubmissions = uniqueSubmissions
      .filter((s: any) => {
        const st = normalizeMilestoneStatus(s?.status);
        return st === "pending" || st === "verified" || st === "paid";
      })
      .sort((a: any, b: any) => {
        const at = new Date(a?.created_at || 0).getTime();
        const bt = new Date(b?.created_at || 0).getTime();
        return at - bt;
      });

    // Do not treat already-paid rows as still "expected" for milestone slots / amounts
    const eligibleForExpectedPayout = eligibleSubmissions.filter(
      (s: any) => !submissionIsPaidForMilestone(s),
    );

    const winnerCountsByMilestone = new Map<string, number>();
    const submissionExpectedRewardMap = new Map<string, number>();
    const creatorExpectedRewardMap = new Map<string, number>();

    eligibleForExpectedPayout.forEach((sub: any) => {
      const subViews = Number(sub?.views || 0);
      let payoutCents = 0;

      for (const milestone of sortedMilestones) {
        const targetViews = Number(milestone?.target_views || 0);
        if (subViews < targetViews) continue;

        const winnerLimit = milestone?.winner_limit;
        const milestoneKey = `${Number(milestone?.order || 0)}:${targetViews}`;
        if (winnerLimit != null) {
          const used = winnerCountsByMilestone.get(milestoneKey) || 0;
          if (used >= Number(winnerLimit)) continue;
          winnerCountsByMilestone.set(milestoneKey, used + 1);
        }

        payoutCents = Number(milestone?.payout_cents || 0);
        break;
      }

      const submissionId = String(sub?.id || "");
      if (submissionId) {
        submissionExpectedRewardMap.set(submissionId, payoutCents);
      }

      const creatorId = String(sub?.creator_id || "");
      if (creatorId) {
        const current = creatorExpectedRewardMap.get(creatorId) || 0;
        creatorExpectedRewardMap.set(creatorId, current + payoutCents);
      }
    });

    const creatorMostVerifiedViewsBonusMap = new Map<string, number>();
    const creatorMostVerifiedReelsBonusMap = new Map<string, number>();
    const bonus = milestoneContest?.bonus;
    const mostVerifiedBonusByCreator = buildMilestoneMostVerifiedBonusByCreatorMap(
      uniqueSubmissions.map((sub: any) => ({
        id: String(sub?.id || ""),
        creator_id: String(sub?.creator_id || ""),
        created_at: String(sub?.created_at || ""),
        status: normalizeMilestoneStatus(sub?.status),
        deleted_at: sub?.deleted_at ?? null,
        views: Number(sub?.views || 0),
        bonus_paid: Boolean(sub?.bonus_paid),
        bonus_amount:
          sub?.bonus_amount != null ? Number(sub?.bonus_amount || 0) : null,
        milestone_bonus_paid:
          sub?.milestone_bonus_paid ?? sub?.metadata?.milestone_bonus_paid,
        metadata: sub?.metadata ?? null,
        platform: contest?.platform ?? null,
        other_stats: sub?.other_stats ?? null,
      })),
      bonus,
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
      winnerCountsByMilestone,
    };
  }, [
    contest?.contest_type,
    contest?.contest_based_details,
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
    if (creatorGroup?.submissions?.length) return creatorGroup.submissions;
    if (isNonTwitterCreatorWise && selectedCreatorSubmissions.length > 0)
      return selectedCreatorSubmissions;
    return creatorGroup?.submissions || [];
  }, [
    selectedCreatorId,
    groupedLeaderboardByCreator,
    contest?.platform,
    leaderboardDisplayMode,
    creatorWiseLeaderboard.length,
    selectedCreatorSubmissions,
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

        // Fallback for non-Twitter (or if runId is missing): timestamp-based polling.
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
      twitterMetricsRunActive ||
      !cooldownInfo.canRefresh ||
      isLocked ||
      contestHasEnded;

    let disabledReason = "";
    if (isRefreshingMetrics || twitterMetricsRunActive) {
      disabledReason = "Refreshing metrics...";
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
    if (!isMounted) return;
    if (!silent) setLoadingLeaderboard(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: allEntries } =
        generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const totalEntries = allEntries.length;
      const totalPages = Math.ceil(totalEntries / leaderboardItemsPerPage);
      const startIndex = (pageToFetch - 1) * leaderboardItemsPerPage;
      const endIndex = startIndex + leaderboardItemsPerPage;
      const paginatedEntries = allEntries.slice(startIndex, endIndex);

      setTimeout(() => {
        if (isMounted) {
          setLeaderboard(paginatedEntries);
          setLastUpdated(new Date().toISOString());
          setLeaderboardCurrentPage(pageToFetch);
          setTotalLeaderboardPages(totalPages);
          setTotalLeaderboardEntries(totalEntries);
          setContestType("leaderboard"); // Set dummy contest type

          // Mark as loaded only after successful fetch
          const platform = contest?.platform || "unknown";
          const contestKey = `${contestId}-${platform}`;
          leaderboardLoadedRef.current = contestKey;

          // If we got data, reset the empty refetch flag
          if (paginatedEntries.length > 0 || totalEntries > 0) {
            emptyDataRefetchAttemptedRef.current = null;
          }

          if (!silent) setLoadingLeaderboard(false);
        }
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
      // Bypass server cache when user just submitted (to avoid stale empty data)
      if (justSubmitted) params.set("fresh", "1");
      const response = await fetch(
        `/api/leaderboard/${contestId}?${params.toString()}`,
      );
      const data = await response.json();
      if (!response.ok) {
        leaderboardFetchError = data.error || "Failed to fetch leaderboard";
        throw new Error(leaderboardFetchError);
      }
      if (isMounted) {
        if (groupByCreator) {
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
            })),
          );
          setCreatorTotalEntries(data.totalEntries ?? 0);
          setCreatorTotalPages(data.totalPages ?? 0);
        } else {
          setLeaderboard(data.leaderboard || []);
          setTotalLeaderboardEntries(data.totalEntries ?? 0);
          setTotalLeaderboardPages(data.totalPages ?? 0);
        }
        setLastUpdated(data.lastUpdated);
        setLeaderboardCurrentPage(data.currentPage ?? pageToFetch);
        setContestType(data.contestType || null);

        const platform = contest?.platform || "unknown";
        const contestKey = `${contestId}-${platform}`;
        leaderboardLoadedRef.current = contestKey;
      }
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      if (isMounted && !error) setError(leaderboardFetchError || err.message);
    } finally {
      if (isMounted && !silent) setLoadingLeaderboard(false);
    }
  };

  let isMounted = true; // Flag to track component mount status

  // Helper function to render verification badges
  const renderVerificationBadges = (status: string) => {
    // For Twitter (X) contests, leaderboard rows come from twitter_campaign_leaderboard
    // and do not have a per-submission verification status. Skip badges in that case.
    if (!status || contest?.platform === "twitter") return null;

    return renderStatusBadge(status as any, contestType);
  };

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
    if (!isMounted) return;

    setLoadingMySubmission(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: allEntries, myRank } =
        generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const myEntryData = allEntries.find(
        (e) => e.creator_id === MY_DUMMY_SUBMISSION_USER_ID,
      );

      setTimeout(() => {
        if (isMounted) {
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
      if (isMounted) setLoadingMySubmission(false);
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
        if (isMounted) {
          setMyLeaderboardEntry(null);
          setMySubmissionsListFromApi([]);
          setMyCreatorWiseStats(null);
        }
        return;
      }
      if (isMounted) {
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
      if (isMounted) {
        setMyLeaderboardEntry(null);
        setMySubmissionsListFromApi([]);
        setMyCreatorWiseStats(null);
        // Mark as fetched even on error to prevent infinite retries
        const platform = contest?.platform || "unknown";
        const contestKey = `${contestId}-${platform}`;
        myRankFetchedRef.current = contestKey;
      }
    } finally {
      if (isMounted) setLoadingMySubmission(false);
    }
  };

  // Fetch Twitter-only leaderboard (aggregated from twitter_campaign_leaderboard)
  const fetchTwitterLeaderboard = async (
    contestTypeOverride?: string | null,
  ) => {
    if (!isMounted || !contestId) return;

    setLoadingLeaderboard(true);

    try {
      const response = await fetch(
        `/api/contests/${contestId}/twitter-leaderboard?page=1&limit=${leaderboardItemsPerPage}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch Twitter leaderboard");
      }

      if (isMounted) {
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
      if (isMounted && !error) {
        setError(err.message || "Failed to fetch Twitter leaderboard");
      }
    } finally {
      if (isMounted) setLoadingLeaderboard(false);
    }
  };

  // Fetch current creator's rank/entry from twitter_campaign_leaderboard
  const fetchMyTwitterRank = async () => {
    if (!isMounted || !contestId) return;

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
        if (isMounted) setMyLeaderboardEntry(null);
        return;
      }

      if (isMounted) {
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
      if (isMounted) {
        setMyLeaderboardEntry(null);
        // Mark as fetched even on error to prevent infinite retries
        const platform = contest?.platform || "twitter";
        const contestKey = `${contestId}-${platform}`;
        myRankFetchedRef.current = contestKey;
      }
    } finally {
      if (isMounted) setLoadingMySubmission(false);
    }
  };

  // Fetch Twitter campaign metrics
  const fetchTwitterMetrics = async () => {
    if (!isMounted || !contestId) return;

    setLoadingMetrics(true);

    try {
      const response = await fetch(
        `/api/contests/${contestId}/twitter-metrics`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch Twitter metrics");
      }

      if (isMounted) {
        setTwitterMetrics(data.metrics || null);
      }
    } catch (err: any) {
      console.error("Error fetching Twitter metrics:", err);
      if (isMounted) setTwitterMetrics(null);
    } finally {
      if (isMounted) setLoadingMetrics(false);
    }
  };

  // Fetch Twitter tweets for analytics (all tweets, not just eligible ones)
  const fetchAnalyticsTweets = async () => {
    if (
      !isMounted ||
      !contestId ||
      contest?.platform?.toLowerCase() !== "twitter"
    )
      return;

    setLoadingAnalyticsTweets(true);

    try {
      // Fetch all tweets from database (including rejected ones for analytics)
      const { data: tweetsData, error } = await supabase
        .from("twitter_campaign_tweets")
        .select(
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
        )
        .eq("contest_id", contestId)
        .order("tweet_created_at", { ascending: false });

      if (error) {
        throw new Error(error.message || "Failed to fetch tweets");
      }

      if (isMounted) {
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
      if (isMounted) setAnalyticsTweets([]);
    } finally {
      if (isMounted) setLoadingAnalyticsTweets(false);
    }
  };

  const fetchPostContestStatus = async () => {
    if (!isMounted || !contestId) return;

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

      if (isMounted) {
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
      isMounted
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

    sections.forEach((section) => {
      const element = sectionRefs.current[section.id];
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      sections.forEach((section) => {
        const element = sectionRefs.current[section.id];
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, []);

  useEffect(() => {
    isMounted = true;

    // If NOT using dummy data for leaderboard, and user is not available, show loading.
    if (!USE_DUMMY_DATA_FOR_LEADERBOARD && !user) {
      setLoading(true);
      return;
    }

    async function fetchData() {
      if (!isMounted) return;
      setLoading(true); // Start with loading true for both paths initially
      setError(null);

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
        if (!fetchedContestData) throw new Error("Contest not found.");

        contestData = fetchedContestData;

        // Only published contests should be available to creators
        if (contestData.moderation_status !== "published") {
          throw new Error("This contest is not available.");
        }

        // Check if published contest has valid dates
        if (contestData.status === "incomplete") {
          throw new Error("This contest has incomplete information.");
        }
        if (isMounted) {
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
                isMounted
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
        if (isMounted) setError(err.message || "Failed to load page data");
      } finally {
        // Call leaderboard fetches after initial contest/user data attempt
        if (isMounted && contestData) {
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
          setLoading(false); // Done with initial loading phase
        }
      }
    }

    fetchData();

    // Auto-refresh for leaderboard (only if NOT using dummy data)
    const intervalId = setInterval(() => {
      if (
        isMounted &&
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
        if (isMounted) setActiveTab("leaderboard");
      }
    }

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
    // Added leaderboardItemsPerPage to dependencies as it affects dummy data pagination
  }, [contestId, user, router, supabase, leaderboardItemsPerPage]);

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
    if (!isMounted || !contestId || !contest) return;

    if (activeTab !== "leaderboard") return;

    const isTwitterContest =
      contest.platform?.toLowerCase() === "twitter" ||
      contest.platform?.toLowerCase() === "x";
    const contestKey = `${contestId}-${contest.platform}`;
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
        fetchLeaderboard(1, false);
        fetchLeaderboard(1, true, true);
      }
      if (!myLeaderboardEntry && myRankFetchedRef.current !== contestKey) {
        fetchMySubmissionData();
        // Note: myRankFetchedRef will be set in fetchMySubmissionData after fetch completes
      }
    }
  }, [activeTab, contestId, contest]);
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
  }, [showCreatorVideosModal]);

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

  const handleSubmitContent = () => {
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
            Back to Opportunities
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

  // Render main content
  return (
    <div className={cn("min-h-screen", isDark ? "bg-black" : "bg-slate-50")}>
      <div className="container mx-auto py-8 px-2 lg:px-4">
        {/* Improved Header Navigation */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "flex items-center gap-2 transition-all duration-200 hover:scale-105",
                isDark
                  ? "border-gray-500"
                  : "hover:bg-slate-100 border-slate-300 ",
              )}
              onClick={() => router.push("/dashboard/opportunities")}
            >
              <ArrowLeft
                className={cn(
                  "h-4 w-4",
                  isDark ? "text-slate-300" : "text-slate-600",
                )}
              />
              <span
                className={cn(
                  "hidden sm:inline font-medium",
                  isDark ? "text-slate-300" : "text-slate-600",
                )}
              >
                Back to Opportunities
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-[#4A00BE] text-md text-white"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Share</span>
            </Button>
          </div>

          {/* Modern Hero Section with Enhanced Design */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7F39EC] via-[#6C43D0] to-[#5A2D91] shadow-2xl">
            {/* Animated background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full transform translate-x-32 -translate-y-32 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full transform -translate-x-40 translate-y-40 animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/5 rounded-full transform -translate-x-16 -translate-y-16 animate-pulse delay-500"></div>

            <div className="relative p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                <div className="flex-1 min-w-0">
                  {/* Contest Title with enhanced typography */}
                  <h1 className="text-3xl lg:text-5xl font-black tracking-tight mb-6 text-white drop-shadow-2xl leading-tight bg-gradient-to-r from-white to-white/90 bg-clip-text">
                    {contest.title}
                  </h1>

                  {/* Enhanced Status and Type Badges */}
                  <div className="flex flex-wrap items-center gap-4 mb-6">
                    <Badge
                      className={`text-sm px-6 py-3 font-bold rounded-full shadow-xl border-2 border-white/40 backdrop-blur-md transition-all duration-300 hover:scale-105 ${
                        contest.status === "active"
                          ? "bg-gradient-to-r from-green-400 to-emerald-500 text-green-900 shadow-green-500/25"
                          : contest.status === "upcoming"
                            ? "bg-gradient-to-r from-blue-400 to-cyan-500 text-blue-900 shadow-blue-500/25"
                            : "bg-gradient-to-r from-slate-400 to-gray-500 text-slate-900 shadow-slate-500/25"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {contest.status === "active" ? (
                          <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse shadow-lg"></div>
                        ) : contest.status === "upcoming" ? (
                          <Clock className="w-4 h-4" />
                        ) : (
                          <Calendar className="w-4 h-4" />
                        )}
                        {contest.status === "active"
                          ? "LIVE NOW"
                          : contest.status.toUpperCase()}
                      </span>
                    </Badge>
                    {contest.contest_type && (
                      <Badge className="capitalize text-sm px-6 py-3 font-bold rounded-full shadow-xl bg-white/25 backdrop-blur-md border-2 border-white/40 text-white hover:scale-105 transition-all duration-300">
                        {contest.contest_type === "cpm"
                          ? "Performance Based"
                          : contest.contest_type === "dual_rewards"
                            ? "Dual Rewards"
                            : contest.contest_type === "milestone"
                              ? "Milestone Based"
                              : "Competition Based"}
                      </Badge>
                    )}
                    {/* Campaign Type Badge for Twitter campaigns */}
                    {(() => {
                      const isTwitterTextImage =
                        (contest.platform?.toLowerCase() === "twitter" ||
                          contest.platform?.toLowerCase() === "x") &&
                        contest.contest_format === "text_image";

                      if (isTwitterTextImage) {
                        const campaignType =
                          contest.contest_based_details?.twitter_campaign
                            ?.campaign_type;
                        if (
                          campaignType === "raid" ||
                          campaignType === "awareness"
                        ) {
                          return (
                            <Badge className="capitalize text-sm px-6 py-3 font-bold rounded-full shadow-xl backdrop-blur-md border-2 border-white/40 text-white hover:scale-105 transition-all duration-300 bg-white/25">
                              {campaignType === "raid"
                                ? "Raid Campaign"
                                : "Awareness Campaign"}
                            </Badge>
                          );
                        }
                      }
                      return null;
                    })()}
                    {/* Post-contest status badge for ended contests */}
                    {contest.status === "ended" &&
                      postContestStatus &&
                      renderPostContestStatusBadge(postContestStatus)}
                  </div>

                  {/* Enhanced Contest Duration */}
                  {contest.start_date && contest.end_date && (
                    <div className="bg-white/20 backdrop-blur-md rounded-xl px-6 py-4 inline-block border border-white/30 shadow-lg">
                      <p className="text-white/95 text-base font-semibold flex items-center gap-3">
                        <Calendar className="w-5 h-5" />
                        <span>
                          {formatLocalDateTime(contest.start_date, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          -{" "}
                          {formatLocalDateTime(contest.end_date, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Enhanced Prize Pool Card */}
                <div className="flex-shrink-0 lg:text-right">
                  <div className="bg-white/20 backdrop-blur-xl rounded-3xl p-8 border border-white/30 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105">
                    <div className="text-white/90 text-sm font-bold mb-3 uppercase tracking-wider">
                      {contest.contest_type === "cpm" ||
                      contest.contest_type === "milestone" ||
                      contest.contest_type === "dual_rewards"
                        ? "Total Budget"
                        : "Prize Pool"}
                    </div>
                    <div className="text-4xl lg:text-6xl font-black text-white mb-2 drop-shadow-lg">
                      {contest.contest_type === "cpm" &&
                      contest.contest_based_details?.cpm_contest
                        ? formatMoney(
                            contest.contest_based_details.cpm_contest
                              .total_budget,
                          )
                        : contest.contest_type === "dual_rewards" &&
                            contest.contest_based_details
                          ? formatMoney(
                              getPoolBudgetCentsFromDetails(
                                contest.contest_type,
                                contest.contest_based_details,
                              ),
                            )
                          : contest.contest_type === "milestone" &&
                              contest.contest_based_details?.milestone_contest
                            ? formatMoney(
                                contest.contest_based_details.milestone_contest
                                  .total_budget_cents || 0,
                              )
                            : contest.contest_type === "leaderboard" &&
                                contest.contest_based_details
                                  ?.leaderboard_contest
                              ? formatMoney(
                                  contest.contest_based_details
                                    .leaderboard_contest.total_prize,
                                )
                              : contest.total_prize
                                ? formatMoney(contest.total_prize || 0)
                                : "$0.00"}
                    </div>
                    {contest.contest_type === "leaderboard" &&
                      contest.contest_based_details?.leaderboard_contest
                        ?.winner_count && (
                        <div className="text-white/80 text-sm font-semibold">
                          {
                            contest.contest_based_details.leaderboard_contest
                              .winner_count
                          }{" "}
                          winner
                          {contest.contest_based_details.leaderboard_contest
                            .winner_count !== 1
                            ? "s"
                            : ""}
                        </div>
                      )}
                    {isCpmContestType(contest.contest_type) &&
                      contest.contest_based_details?.cpm_contest
                        ?.cpm_rate_usd && (
                        <div className="text-white/80 text-sm font-semibold">
                          {formatMoney(
                            contest.contest_based_details.cpm_contest
                              .cpm_rate_usd * 100,
                          )}{" "}
                          {contest.platform?.toLowerCase() === "twitter"
                            ? "per 1000 points"
                            : "per 1000 views"}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {contest.thumbnail_url && (
          <div className="mb-8 aspect-video w-full mx-auto relative overflow-hidden rounded-xl shadow-lg">
            <Image
              src={contest.thumbnail_url}
              alt={`${contest.title} thumbnail`}
              fill
              style={{ objectFit: "cover" }} // cover makes sure it fills width
              priority
              className="bg-slate-100 dark:bg-slate-800"
            />
          </div>
        )}

        {/* Enhanced Action Card: Submit or Status */}
        <Card
          className={cn(
            "mb-8 border overflow-hidden",
            isDark
              ? "border-purple-700/60 bg-purple-700/30"
              : "border-[#7F39EC] bg-[#D9C0FF26]",
          )}
        >
          <CardContent className="p-8 text-center relative">
            {/* Decorative background elements */}
            {/* <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-rose-200/30 to-purple-200/30 dark:from-rose-500/10 dark:to-purple-500/10 rounded-full blur-xl transform -translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-blue-200/30 to-cyan-200/30 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-full blur-xl transform translate-x-20 translate-y-20"></div> */}

            <div className="relative z-10">
              {hasSubmitted ? (
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle className="h-10 w-10 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold mb-2",
                      isDark ? "text-slate-200" : "text-slate-700",
                    )}
                  >
                    Submission Complete!
                  </p>
                  <p
                    className={cn(
                      "text-base mb-1",
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
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle className="h-10 w-10 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {submissionCount}
                      </span>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold mb-2",
                      isDark ? "text-slate-200" : "text-slate-700",
                    )}
                  >
                    Submissions in Progress
                  </p>
                  <p
                    className={cn(
                      "text-base mb-1",
                      isDark ? "text-slate-300" : "text-slate-600",
                    )}
                  >
                    You have submitted {submissionCount} out of {maxSubmissions}{" "}
                    videos
                  </p>
                  <p
                    className={cn(
                      "text-sm mb-6",
                      isDark ? "text-slate-300" : "text-slate-500",
                    )}
                  >
                    You can still submit {maxSubmissions - submissionCount} more
                    videos
                  </p>

                  {/* Submit Button for Partial Submissions */}
                  <Button
                    size="lg"
                    onClick={handleSubmitContent}
                    disabled={contest.status?.toLowerCase() !== "active"}
                    className={`relative overflow-hidden text-lg font-bold py-4 px-8 h-auto rounded-2xl shadow-xl transition-all duration-500 ease-out transform ${
                      contest.status?.toLowerCase() === "active"
                        ? "bg-[#4A00BE] text-white border-0 hover:shadow-2xl hover:scale-105"
                        : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <span className="relative z-10">
                      {contest.status?.toLowerCase() === "active"
                        ? `Submit More Videos (${
                            maxSubmissions - submissionCount
                          } remaining)`
                        : "Contest Not Active"}
                    </span>
                    {contest.status?.toLowerCase() === "active" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
                    )}
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-rose-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
                      Ready to Showcase Your Talent?
                    </h2>
                    <p
                      className={cn(
                        "text-lg max-w-md mx-auto leading-relaxed",
                        isDark ? "text-white" : "text-black",
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
                        className="mb-4 max-w-lg mx-auto text-center border border-[#7F39EC] bg-[#D9C0FF26]"
                      >
                        <AlertDescription
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-200" : "text-gray-700",
                          )}
                        >
                          Connect your X (Twitter) account in Settings before
                          you can join this campaign.
                        </AlertDescription>
                        <Link href="/dashboard/settings">
                          <Button
                            variant="link"
                            className="mt-1 text-[#7F39EC]"
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
                          "text-sm mb-3 text-center",
                          isDark ? "text-slate-400" : "text-slate-600",
                        )}
                      >
                        Checking your X connection…
                      </p>
                    )}

                  <Button
                    size="lg"
                    onClick={
                      isTwitterTextImageContest && !hasJoinedTwitterCampaign
                        ? handleJoinTwitterCampaign
                        : handleSubmitContent
                    }
                    disabled={
                      contest.status?.toLowerCase() !== "active" ||
                      joinCampaignLoading ||
                      (isTwitterTextImageContest && hasJoinedTwitterCampaign) ||
                      (!!user &&
                        isTwitterTextImageContest &&
                        !hasJoinedTwitterCampaign &&
                        (twitterConnectStatus === "disconnected" ||
                          twitterConnectStatus === "loading"))
                    }
                    className={`relative overflow-hidden text-lg font-bold py-4  px-8 h-auto rounded-2xl shadow-xl transition-all duration-500 ease-out transform ${
                      contest.status?.toLowerCase() === "active"
                        ? "bg-[#4A00BE] text-white border-0 hover:shadow-2xl"
                        : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {/* Animated shine effect for active button */}
                    {contest.status?.toLowerCase() === "active" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    )}

                    <span className="relative flex items-center gap-3">
                      {contest.status?.toLowerCase() === "upcoming" ? (
                        <>
                          <Clock className="h-6 w-6" />
                          <span>Contest Not Started</span>
                        </>
                      ) : contest.status?.toLowerCase() === "ended" ||
                        contest.status?.toLowerCase() === "completed" ? (
                        <>
                          <Calendar className="h-6 w-6" />
                          <span>Contest Ended</span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <PlayCircle className="h-6 w-6" />
                            <span>
                              {isTwitterTextImageContest
                                ? hasJoinedTwitterCampaign
                                  ? "Joined"
                                  : joinCampaignLoading
                                    ? "Joining..."
                                    : user && twitterConnectStatus === "loading"
                                      ? "Checking…"
                                      : "Join Twitter Campaign"
                                : "Submit Your Entry!"}
                            </span>
                          </div>
                          {contest.status?.toLowerCase() === "active" && (
                            <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse ml-1"></div>
                          )}
                        </>
                      )}
                    </span>
                  </Button>

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
                          "mt-4 max-w-lg mx-auto text-center",
                          twitterJoinError.kind !== "generic" &&
                            "border border-[#7F39EC] bg-[#D9C0FF26]",
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
                              className="mt-1 text-[#7F39EC]"
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
                          "text-xs mt-2 text-center max-w-md mx-auto",
                          isDark ? "text-slate-400" : "text-slate-600",
                        )}
                      >
                        After you connect X in Settings, come back here and tap
                        Join.
                      </p>
                    )}

                  {/* Preserve existing pulse indicator for non-joined Twitter contests */}
                  {contest.status?.toLowerCase() === "active" &&
                    !isTwitterTextImageContest && (
                      <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse ml-1"></div>
                    )}

                  {contest.status?.toLowerCase() === "active" && (
                    <div
                      className={cn(
                        "text-sm mt-4 flex items-center justify-center gap-2",
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

        {/* Colorful Contest Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Platform Card */}
          <div
            className={cn(
              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",

              isDark ? "bg-[#170337]" : "bg-white border border-slate-200 ",
            )}
          >
            <CardContent className="p-6 flex justify-between items-center">
              <div
                className={cn(
                  "flex-1 space-y-2",
                  isDark ? "text-white" : "text-slate-800",
                )}
              >
                <p
                  className={cn(
                    "text-sm font-semibold uppercase tracking-wide",

                    isDark ? "text-slate-200" : "text-slate-600",
                  )}
                >
                  Platform
                </p>
                <p
                  className={cn(
                    "text-2xl font-black capitalize",
                    isDark ? "text-white" : "text-slate-800",
                  )}
                >
                  {contest.platform || "Not specified"}
                </p>
              </div>
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                {contest.platform?.toLowerCase() === "youtube" ? (
                  <Youtube className="h-7 w-7" />
                ) : contest.platform?.toLowerCase() === "instagram" ? (
                  <Instagram className="h-7 w-7" />
                ) : contest.platform?.toLowerCase() === "tiktok" ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7"
                    fill="currentColor"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.18z" />
                  </svg>
                ) : contest.platform?.toLowerCase() === "twitter" ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                ) : (
                  <Share2 className="h-7 w-7" />
                )}
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-700/50 hover:shadow-lg transition-all duration-300">
  <CardContent className="p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        {contest.platform?.toLowerCase() === "youtube" ? (
          <Youtube className="h-5 w-5 text-red-600 dark:text-red-400" />
        ) : contest.platform?.toLowerCase() === "instagram" ? (
          <Instagram className="h-5 w-5 text-pink-600 dark:text-pink-400" />
        ) : (
          <Share2 className="h-5 w-5 text-red-600 dark:text-red-400" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-red-800 dark:text-red-300 uppercase tracking-wide">
          Platform
        </p>
        <p className="text-lg font-bold text-red-900 dark:text-red-100 capitalize">
          {contest.platform || "Not specified"}
        </p>
      </div>
    </div>
  </CardContent>
</Card> */}
          {/* Duration Card */}
          <div
            className={cn(
              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",

              isDark ? "bg-[#170337]" : "bg-white border border-slate-200 ",
            )}
          >
            <CardContent className="p-6 flex justify-between items-center">
              <div className="flex-1 text-slate-800 dark:text-slate-100 space-y-2">
                <p
                  className={cn(
                    "text-sm font-semibold uppercase tracking-wide",

                    isDark ? "text-slate-200" : "text-slate-600",
                  )}
                >
                  Duration
                </p>
                <p
                  className={cn(
                    "text-2xl font-black",

                    isDark ? "text-white" : "text-slate-800",
                  )}
                >
                  {(() => {
                    if (!contest.start_date || !contest.end_date)
                      return "Not specified";
                    const start = new Date(contest.start_date);
                    const end = new Date(contest.end_date);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24),
                    );
                    return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
                  })()}
                </p>
                <p
                  className={cn(
                    "text-sm",

                    isDark ? "text-slate-200" : "text-slate-600",
                  )}
                >
                  {contest.start_date && contest.end_date
                    ? `${formatLocalDateTime(contest.start_date, {
                        month: "short",
                        day: "numeric",
                      })} - ${formatLocalDateTime(contest.end_date, {
                        month: "short",
                        day: "numeric",
                      })}`
                    : "Dates TBD"}
                </p>
              </div>
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                <Calendar className="h-7 w-7" />
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Duration</p>
                  <p className="text-lg font-bold text-green-900 dark:text-green-100">
                    {(() => {
                      if (!contest.start_date || !contest.end_date) return "Not specified";
                      const start = new Date(contest.start_date);
                      const end = new Date(contest.end_date);
                      const diffTime = Math.abs(end.getTime() - start.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                    })()}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    {contest.start_date && contest.end_date ? (
                      `${formatLocalDateTime(contest.start_date, {
                        month: 'short',
                        day: 'numeric',
                      })} - ${formatLocalDateTime(contest.end_date, {
                        month: 'short',
                        day: 'numeric',
                      })}`
                    ) : "Dates TBD"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}

          {/* Prize Pool Card */}
          <div
            className={cn(
              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",

              isDark ? "bg-[#170337]" : "bg-white border border-slate-200 ",
            )}
          >
            <CardContent className="p-6 flex justify-between items-center">
              <div
                className={cn(
                  "flex-1 space-y-2",
                  isDark ? "text-white" : "text-slate-800",
                )}
              >
                <p
                  className={cn(
                    "text-sm font-semibold uppercase tracking-wide",

                    isDark ? "text-slate-200" : "text-slate-600",
                  )}
                >
                  {contest.contest_type === "cpm" ||
                  contest.contest_type === "milestone" ||
                  contest.contest_type === "dual_rewards"
                    ? "Total Budget"
                    : "Prize Pool"}
                </p>
                <p
                  className={cn(
                    "text-2xl font-black",

                    isDark ? "text-white" : "text-slate-800",
                  )}
                >
                  {contest.contest_type === "cpm" &&
                  contest.contest_based_details?.cpm_contest
                    ? formatMoney(
                        contest.contest_based_details.cpm_contest.total_budget,
                      )
                    : contest.contest_type === "dual_rewards" &&
                        contest.contest_based_details
                      ? formatMoney(
                          getPoolBudgetCentsFromDetails(
                            contest.contest_type,
                            contest.contest_based_details,
                          ),
                        )
                      : contest.contest_type === "milestone" &&
                          contest.contest_based_details?.milestone_contest
                        ? formatMoney(
                            contest.contest_based_details.milestone_contest
                              .total_budget_cents || 0,
                          )
                        : contest.contest_type === "leaderboard" &&
                            contest.contest_based_details?.leaderboard_contest
                          ? formatMoney(
                              contest.contest_based_details.leaderboard_contest
                                .total_prize,
                            )
                          : contest.total_prize // Fallback to old field if necessary for older data
                            ? formatMoney(contest.total_prize || 0)
                            : "$0.00"}
                </p>
                <p
                  className={cn(
                    "text-sm",

                    isDark ? "text-slate-200" : "text-slate-600",
                  )}
                >
                  {contest.contest_type === "leaderboard" &&
                  contest.contest_based_details?.leaderboard_contest
                    ?.winner_count
                    ? `${
                        contest.contest_based_details.leaderboard_contest
                          .winner_count
                      } winner${
                        contest.contest_based_details.leaderboard_contest
                          .winner_count !== 1
                          ? "s"
                          : ""
                      }`
                    : contest.contest_type === "cpm"
                      ? "CPM based"
                      : contest.contest_type === "milestone"
                        ? "Milestone based"
                        : contest.contest_type === "dual_rewards"
                          ? "CPM + milestones"
                          : "Total prize"}
                </p>
              </div>
              <div
                className={cn(
                  "w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300",

                  isDark
                    ? "bg-[#170337]"
                    : "bg-gradient-to-br from-purple-500 to-purple-600",
                )}
              >
                <Trophy className="h-7 w-7" />
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">Prize Pool</p>
                  <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest
                      ? formatMoney(contest.contest_based_details.cpm_contest.total_budget)
                      : contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest
                        ? formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)
                        : contest.total_prize // Fallback to old field if necessary for older data
                          ? formatMoney(contest.total_prize || 0)
                          : "$0.00"}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                    {contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest?.winner_count
                      ? `${contest.contest_based_details.leaderboard_contest.winner_count} winner${contest.contest_based_details.leaderboard_contest.winner_count !== 1 ? 's' : ''}`
                      : contest.contest_type === 'cpm'
                        ? 'CPM based'
                        : 'Total prize'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}

          {/* Submissions/Participants Card */}
          {(() => {
            const isTwitterTextImage =
              (contest?.platform?.toLowerCase() === "twitter" ||
                contest?.platform?.toLowerCase() === "x") &&
              contest?.contest_format === "text_image";

            if (isTwitterTextImage) {
              // For Twitter contests, show participants instead of submissions
              const participantsCount = twitterMetrics?.total_participants || 0;
              const maxParticipants =
                twitterMetrics?.max_participants ||
                contest?.contest_based_details?.twitter_campaign
                  ?.max_participants;
              const displayValue = maxParticipants
                ? `${participantsCount} / ${maxParticipants}`
                : participantsCount;

              return (
                <div
                  className={cn(
                    "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                    isDark
                      ? "bg-[#170337]"
                      : "bg-white border border-slate-200 ",
                  )}
                >
                  <CardContent className="p-6 flex justify-between items-center">
                    <div
                      className={cn(
                        "flex-1 space-y-2",
                        isDark ? "text-white" : "text-slate-800",
                      )}
                    >
                      <p
                        className={cn(
                          "text-sm font-semibold uppercase tracking-wide",
                          isDark ? "text-slate-200" : "text-slate-600",
                        )}
                      >
                        Participants
                      </p>
                      <p
                        className={cn(
                          "text-2xl font-black",
                          isDark ? "text-white" : "text-slate-800",
                        )}
                      >
                        {displayValue}
                      </p>
                      <p
                        className={cn(
                          "text-sm",
                          isDark ? "text-slate-200" : "text-slate-600",
                        )}
                      >
                        {maxParticipants
                          ? "Joined / Max limit"
                          : "Total joined"}
                      </p>
                    </div>
                    <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                      <Users className="h-7 w-7" />
                    </div>
                  </CardContent>
                </div>
              );
            }

            // For non-Twitter contests, show submissions
            return (
              <div
                className={cn(
                  "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                  isDark ? "bg-[#170337]" : "bg-white border border-slate-200 ",
                )}
              >
                <CardContent className="p-6 flex justify-between items-center">
                  <div
                    className={cn(
                      "flex-1 space-y-2",
                      isDark ? "text-white" : "text-slate-800",
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-semibold uppercase tracking-wide",
                        isDark ? "text-slate-200" : "text-slate-600",
                      )}
                    >
                      Submissions
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-black",
                        isDark ? "text-white" : "text-slate-800",
                      )}
                    >
                      {contest.live_submission_count !== null &&
                      contest.live_submission_count >= 0
                        ? contest.live_submission_count
                        : 0}
                    </p>
                    <p
                      className={cn(
                        "text-sm",
                        isDark ? "text-slate-200" : "text-slate-600",
                      )}
                    >
                      Total entries
                    </p>
                  </div>
                  <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                    <Users className="h-7 w-7" />
                  </div>
                </CardContent>
              </div>
            );
          })()}
          {/* <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">Submissions</p>
                  <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {contest.live_submission_count !== null && contest.live_submission_count >= 0
                      ? contest.live_submission_count
                      : 0}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">Total entries</p>
                </div>
              </div>
            </CardContent>
          </Card> */}
        </div>

        {/* Post-Contest Status Section for Ended Contests */}
        {contest.status === "ended" && postContestStatus && (
          <Card
            className={cn(
              "mb-8 shadow-xl border-2 transition-all duration-300 hover:shadow-2xl overflow-hidden",
              isDark
                ? "border-slate-700/60 bg-gradient-to-br from-slate-800/90 via-slate-900/80 to-slate-800/90 backdrop-blur-sm"
                : "border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-indigo-50/80 to-purple-50/90 backdrop-blur-sm",
            )}
          >
            <CardHeader
              className={cn(
                "border-b transition-all duration-300",
                isDark
                  ? "bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-purple-600/20 border-blue-800/40"
                  : "bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-purple-500/15 border-blue-200/60",
              )}
            >
              <CardTitle
                className={cn(
                  "flex items-center gap-3 transition-colors duration-300",
                  isDark ? "text-blue-100" : "text-blue-900",
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-lg transition-all duration-300",
                    isDark
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-blue-100/80 text-blue-600",
                  )}
                >
                  <FileText className="h-6 w-6" />
                </div>
                <span className="font-bold">Contest Status Update</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
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
                          ? "bg-gradient-to-r from-green-900/30 to-emerald-900/20 border-green-700/50"
                          : "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/80",
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
                      "rounded-2xl p-6 border-2 shadow-lg transition-all duration-300 hover:scale-105",
                      isDark
                        ? "bg-gradient-to-br from-slate-800/80 to-slate-900/60 border-slate-600/40 backdrop-blur-sm"
                        : "bg-gradient-to-br from-white/90 to-blue-50/50 border-blue-200/60 backdrop-blur-sm",
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
        )}

        {/* Tabs */}
        <EnhancedTabs
          tabs={tabs.map((tab) => ({
            ...tab,
            label: (
              <div className="flex text-center items-center">
                {tab.label}
                {tab.id === "leaderboard" &&
                  contest?.contest_type === "leaderboard" &&
                  totalLeaderboardEntries > 0 && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "ml-1 sm:ml-2 px-2 py-0.5 text-xs sm:text-sm text-gray-700 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground",
                        isDark ? "text-gray-300" : "text-gray-600 bg-gray-200",
                      )}
                    >
                      {totalLeaderboardEntries}
                    </Badge>
                  )}
              </div>
            ),
          }))}
          activeTab={activeTab}
          isDark={isDark}
          light={!isDark}
          onTabChange={setActiveTab}
          className="mt-12 mb-6"
        />

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
            {/* Sticky Section Navigation */}
            {activeTab === "details" && contest && (
              <div
                className={cn(
                  "sticky top-16 z-40 rounded-xl shadow-md mb-8 -mx-2 lg:-mx-4",
                  isDark
                    ? "bg-[#170337] border-b"
                    : "border-b bg-white border border-slate-200",
                )}
              >
                <div className="container mx-auto px-4 py-3">
                  <div
                    className="flex space-x-4 overflow-x-auto"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    <style jsx>{`
                      div::-webkit-scrollbar {
                        display: none;
                      }
                    `}</style>
                    {sections
                      .filter(
                        (section: any) =>
                          !section.conditional ||
                          section.conditional === contest.contest_type,
                      )
                      .map((section) => (
                        <button
                          key={section.id}
                          onClick={() => scrollToSection(section.id)}
                          className={`px-4 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
                            activeSection === section.id
                              ? isDark
                                ? "bg-blue-900/30 text-blue-300 border-b-2 border-blue-500"
                                : "bg-blue-100 text-blue-700 border-b-2 border-blue-500"
                              : isDark
                                ? "text-slate-200 hover:text-slate-200"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          }`}
                        >
                          {section.label}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
            <div
              className={cn(
                "bg-white rounded-xl shadow-xl",
                isDark ? "bg-[#170337]" : "bg-white",
              )}
            >
              <CardHeader className="border-b">
                <CardTitle
                  className={cn(
                    "text-gray-800 flex items-center gap-2",
                    isDark ? "text-white" : "text-gray-800",
                  )}
                >
                  {/* <ScrollText className="h-5 w-5 text-blue-500" /> */}
                  Contest Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* 1. EARNINGS OVERVIEW - Clean Card Design */}
                <div
                  id="earning-opportunities"
                  ref={(el) => {
                    sectionRefs.current["earning-opportunities"] = el;
                  }}
                  className={cn(
                    "mt-6 dark:bg-slate-800 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200",
                    isDark
                      ? "bg-[#170337] border-gray-600"
                      : "bg-white border-slate-200",
                  )}
                >
                  <div className="p-6">
                    {/* Header with Icon and Title */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
                      <div className="flex items-center gap-3 sm:gap-4 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                          <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>

                        <div className="flex-1">
                          <h3
                            className={cn(
                              "text-xl font-bold text-slate-900 dark:text-slate-100 mb-1",
                              isDark ? "text-white" : "text-slate-900",
                            )}
                          >
                            Earning Opportunities
                          </h3>
                          <p
                            className={cn(
                              "text-sm",
                              isDark ? "text-gray-300" : "text-slate-600",
                            )}
                          >
                            {contest.contest_type === "cpm"
                              ? "Performance-based earnings"
                              : contest.contest_type === "milestone"
                                ? "Milestone-based rewards"
                                : contest.contest_type === "dual_rewards"
                                  ? "CPM pay plus milestone unlocks"
                                  : "Competition-based prizes"}
                          </p>
                        </div>
                      </div>
                      {/* Platform Badge */}
                      <div
                        className={cn(
                          "flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg flex-shrink-0 self-start sm:self-auto",
                          isDark
                            ? "bg-[#C9A7FF26] border border-[#C9A7FF]"
                            : "bg-slate-100",
                        )}
                      >
                        {contest.platform?.toLowerCase() === "youtube" ? (
                          <Youtube className="h-5 w-5 text-red-600" />
                        ) : contest.platform?.toLowerCase() === "instagram" ? (
                          <Instagram className="h-5 w-5 text-pink-600" />
                        ) : contest.platform?.toLowerCase() === "tiktok" ? (
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
                            "text-sm font-medium capitalize",
                            isDark ? "text-white" : "text-slate-700",
                          )}
                        >
                          {contest.platform || "Multi-platform"}
                        </span>
                      </div>
                    </div>

                    {/* Main Earning Information */}
                    <div
                      className={`grid grid-cols-1 gap-4 mb-6 ${
                        // Dynamic grid based on contest type and available data
                        isCpmContestType(contest.contest_type)
                          ? contest.contest_based_details?.cpm_contest
                              ?.min_views != null &&
                            contest.contest_based_details?.cpm_contest
                              ?.max_views != null
                            ? "md:grid-cols-2 lg:grid-cols-4" // 4 cards: Pay Rate, Total Budget, Min Views, Max Views
                            : "md:grid-cols-2 lg:grid-cols-3" // 3 cards: Pay Rate, Total Budget, + one view requirement
                          : "md:grid-cols-2 lg:grid-cols-2" // 2 cards
                      }`}
                    >
                      {/* Pay Rate / Prize Pool / Total Budget */}
                      <div
                        className={cn(
                          "rounded-lg p-4",
                          isDark ? "border border-[#D1B7F9]" : "bg-slate-50",
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isDark ? "text-white" : "text-slate-600",
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
                                contest.contest_based_details.cpm_contest
                                  .cpm_rate_usd * 100,
                              )
                            : contest.contest_type === "dual_rewards" &&
                                contest.contest_based_details
                              ? formatMoney(
                                  getPoolBudgetCentsFromDetails(
                                    contest.contest_type,
                                    contest.contest_based_details,
                                  ),
                                )
                              : contest.contest_type === "milestone" &&
                                  contest.contest_based_details?.milestone_contest
                                ? formatMoney(
                                    contest.contest_based_details
                                      .milestone_contest.total_budget_cents ||
                                      0,
                                  )
                                : contest.contest_type === "leaderboard" &&
                                    contest.contest_based_details
                                      ?.leaderboard_contest
                                  ? formatMoney(
                                      contest.contest_based_details
                                        .leaderboard_contest.total_prize,
                                    )
                                  : contest.total_prize
                                    ? formatMoney(contest.total_prize || 0)
                                    : "$0.00"}
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            isDark ? "text-gray-300" : "text-slate-500",
                          )}
                        >
                          {isCpmContestType(contest.contest_type) &&
                          contest.contest_based_details?.cpm_contest
                            ?.cpm_rate_usd != null
                            ? contest.platform?.toLowerCase() === "twitter"
                              ? "per 1000 points"
                              : "per 1000 views"
                            : contest.contest_type === "milestone"
                              ? "across all milestones"
                              : contest.contest_type === "dual_rewards"
                                ? "combined prize pool"
                                : "total prize"}
                        </div>
                      </div>

                      {/* Total Budget / Winners / Milestones — dual rewards often only store unified pool at root */}
                      {(() => {
                        const details = contest.contest_based_details;
                        const hasNestedCpmBudget =
                          isCpmContestType(contest.contest_type) &&
                          typeof details?.cpm_contest?.total_budget ===
                            "number" &&
                          (details.cpm_contest?.total_budget ?? 0) > 0;
                        const dualUnifiedCents =
                          contest.contest_type === "dual_rewards" && details
                            ? getPoolBudgetCentsFromDetails(
                                "dual_rewards",
                                details,
                              )
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
                            : isMilestoneContestType(contest.contest_type)
                              ? "Milestones"
                              : "Winners";

                        const secondCardValue = hasNestedCpmBudget
                          ? formatMoney(details!.cpm_contest!.total_budget!)
                          : showDualUnifiedTotal
                            ? formatMoney(dualUnifiedCents)
                            : isMilestoneContestType(contest.contest_type) &&
                                details?.milestone_contest
                              ? (
                                  details.milestone_contest.milestones || []
                                ).length
                              : contest.contest_type === "leaderboard" &&
                                  details?.leaderboard_contest
                                ? details.leaderboard_contest.winner_count
                                : "N/A";

                        const secondCardHint = hasNestedCpmBudget
                          ? contest.contest_type === "dual_rewards"
                            ? "for per-view payouts"
                            : "in total"
                          : showDualUnifiedTotal
                            ? "in total"
                            : isMilestoneContestType(contest.contest_type)
                              ? "reward tiers"
                              : "winners";

                        return (
                          <div
                            className={cn(
                              "rounded-lg p-4",
                              isDark
                                ? "border border-[#D1B7F9]"
                                : "bg-slate-50",
                            )}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  isDark ? "text-white" : "text-slate-600",
                                )}
                              >
                                {secondCardLabel}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "text-2xl font-bold",
                                isDark ? "text-white" : "text-slate-900",
                              )}
                            >
                              {secondCardValue}
                            </div>
                            <div
                              className={cn(
                                "text-xs",
                                isDark ? "text-gray-300" : "text-slate-500",
                              )}
                            >
                              {secondCardHint}
                            </div>
                          </div>
                        );
                      })()}

                      {/* View Requirements for CPM (and dual rewards CPM side) */}
                      {isCpmContestType(contest.contest_type) &&
                        contest.contest_based_details?.cpm_contest && (
                          <>
                            {contest.contest_based_details.cpm_contest
                              .min_views != null && (
                              <div
                                className={cn(
                                  "rounded-lg p-4",
                                  isDark
                                    ? "border border-[#D1B7F9]"
                                    : "bg-slate-50",
                                )}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <Eye className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-slate-600",
                                    )}
                                  >
                                    Min Views
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark ? "text-white" : "text-slate-900",
                                  )}
                                >
                                  {contest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                                </div>
                                <div
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-300" : "text-slate-500",
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
                                  "rounded-lg p-4",
                                  isDark
                                    ? "border border-[#D1B7F9]"
                                    : "bg-slate-50",
                                )}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-slate-600",
                                    )}
                                  >
                                    Max Views
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark ? "text-white" : "text-slate-900",
                                  )}
                                >
                                  {contest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                                </div>
                                <div
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-300" : "text-slate-500",
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
                      contest.contest_based_details?.milestone_contest && (
                        <div className="space-y-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                Milestone Rewards Ladder
                              </h3>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              {(
                                contest.contest_based_details.milestone_contest
                                  .milestones || []
                              )
                                .sort((a: any, b: any) => a.order - b.order)
                                .map((milestone: any, index: number) => (
                                  <div
                                    key={`${milestone.order}-${index}`}
                                    className={cn(
                                      "rounded-lg border p-4 flex items-center justify-between",
                                      isDark
                                        ? "bg-[#170337] border-gray-600"
                                        : "bg-slate-50 border-slate-200",
                                    )}
                                  >
                                    <div>
                                      <div
                                        className={cn(
                                          "text-xs font-semibold uppercase tracking-wide",
                                          isDark
                                            ? "text-purple-300"
                                            : "text-purple-700",
                                        )}
                                      >
                                        Milestone {index + 1}
                                      </div>
                                      <div
                                        className={cn(
                                          "text-lg font-bold",
                                          isDark
                                            ? "text-white"
                                            : "text-slate-900",
                                        )}
                                      >
                                        {milestone.target_views?.toLocaleString?.() ||
                                          0}{" "}
                                        Views
                                      </div>
                                      {milestone.winner_limit != null && (
                                        (() => {
                                          const reachedCount = milestoneDerivedData.winnerCountsByMilestone?.get(
                                            `${Number(milestone.order || 0)}:${Number(milestone.target_views || 0)}`,
                                          ) || 0;
                                          const isFull = reachedCount >= Number(milestone.winner_limit);
                                          return (
                                            <div
                                              className={cn(
                                                "text-xs mt-1 font-semibold",
                                                isFull
                                                  ? "text-red-500 dark:text-red-400"
                                                  : "text-green-600 dark:text-green-400",
                                              )}
                                            >
                                              Winner limit: {reachedCount} / {milestone.winner_limit}
                                            </div>
                                          );
                                        })()
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div
                                        className={cn(
                                          "text-xs",
                                          isDark
                                            ? "text-gray-300"
                                            : "text-slate-500",
                                        )}
                                      >
                                        Payout
                                      </div>
                                      <div
                                        className={cn(
                                          "text-xl font-bold",
                                          isDark
                                            ? "text-green-400"
                                            : "text-green-700",
                                        )}
                                      >
                                        {formatMoney(
                                          milestone.payout_cents || 0,
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                            
                            <Alert className={cn(
                              "mt-2 border-purple-600 shadow-sm",
                              isDark ? "bg-purple-900/20 text-purple-200" : "bg-purple-50 text-purple-800"
                            )}>
                              <Info className="h-4 w-4" />
                              <AlertDescription className="text-sm font-medium mt-0.5">
                               Once a submission reaches the target view threshold, the corresponding milestone reward will be granted.
                              </AlertDescription>
                            </Alert>
                          </div>

                          {contest.contest_based_details.milestone_contest.bonus
                            ?.enabled && (
                            <div className="space-y-4">
                              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                <Gift className="h-5 w-5 text-pink-500" />
                                Competitive Bonus Tracks
                              </h3>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {contest.contest_based_details.milestone_contest
                                  .bonus.most_verified_views && (
                                  <div
                                    className={cn(
                                      "rounded-lg border p-4",
                                      isDark
                                        ? "bg-blue-950/20 border-blue-500/30"
                                        : "bg-blue-50 border-blue-200",
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Eye className="h-4 w-4 text-blue-500" />
                                        <span
                                          className={cn(
                                            "font-semibold",
                                            isDark
                                              ? "text-blue-200"
                                              : "text-blue-900",
                                          )}
                                        >
                                          Most Verified Views
                                        </span>
                                      </div>
                                      <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-none">
                                        {formatMoney(
                                          contest.contest_based_details
                                            .milestone_contest.bonus
                                            .most_verified_views.payout_cents ||
                                            0,
                                        )}
                                      </Badge>
                                    </div>
                                    <p
                                      className={cn(
                                        "text-sm",
                                        isDark
                                          ? "text-blue-200/80"
                                          : "text-blue-800",
                                      )}
                                    >
                                      {typeof contest.contest_based_details
                                        .milestone_contest.bonus
                                        .most_verified_views.min_total_views ===
                                        "number" && (
                                        <>
                                          Min.{" "}
                                          {contest.contest_based_details.milestone_contest.bonus.most_verified_views.min_total_views.toLocaleString()}{" "}
                                          views required.
                                        </>
                                      )}
                                      {typeof contest.contest_based_details
                                        .milestone_contest.bonus
                                        .most_verified_views
                                        .min_verified_reels === "number" && (
                                        <>
                                          <br />
                                          Min.{" "}
                                          {contest.contest_based_details.milestone_contest.bonus.most_verified_views.min_verified_reels.toLocaleString()}{" "}
                                          verified reels required.
                                        </>
                                      )}
                                    </p>
                                  </div>
                                )}

                                {contest.contest_based_details.milestone_contest
                                  .bonus.most_verified_reels && (
                                  <div
                                    className={cn(
                                      "rounded-lg border p-4",
                                      isDark
                                        ? "bg-pink-950/20 border-pink-500/30"
                                        : "bg-pink-50 border-pink-200",
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Play className="h-4 w-4 text-pink-500" />
                                        <span
                                          className={cn(
                                            "font-semibold",
                                            isDark
                                              ? "text-pink-200"
                                              : "text-pink-900",
                                          )}
                                        >
                                          Most Verified Reels
                                        </span>
                                      </div>
                                      <Badge className="bg-pink-500 hover:bg-pink-600 text-white border-none">
                                        {formatMoney(
                                          contest.contest_based_details
                                            .milestone_contest.bonus
                                            .most_verified_reels.payout_cents ||
                                            0,
                                        )}
                                      </Badge>
                                    </div>
                                    <p
                                      className={cn(
                                        "text-sm",
                                        isDark
                                          ? "text-pink-200/80"
                                          : "text-pink-800",
                                      )}
                                    >
                                      {typeof contest.contest_based_details
                                        .milestone_contest.bonus
                                        .most_verified_reels
                                        .min_verified_reels === "number" && (
                                        <>
                                          Min.{" "}
                                          {contest.contest_based_details.milestone_contest.bonus.most_verified_reels.min_verified_reels.toLocaleString()}{" "}
                                          verified reels required.
                                        </>
                                      )}
                                      {typeof contest.contest_based_details
                                        .milestone_contest.bonus
                                        .most_verified_reels.min_total_views ===
                                        "number" && (
                                        <>
                                          <br />
                                          Min.{" "}
                                          {contest.contest_based_details.milestone_contest.bonus.most_verified_reels.min_total_views.toLocaleString()}{" "}
                                          views required.
                                        </>
                                      )}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Bonus Information */}
                    <div className="space-y-3">
                      {/* Bonus Budget Tracker for Leaderboard with flat_fee_bonus */}
                      {contest.contest_type === "leaderboard" &&
                        contest.contest_based_details?.leaderboard_contest
                          ?.flat_fee_bonus && (
                          <div
                            className={cn(
                              "bg-gradient-to-r rounded-lg border p-4",
                              isDark
                                ? "from-green-900/20 to-emerald-900/20 border-green-700/50"
                                : "from-green-50 to-emerald-50 border-green-200",
                            )}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <Gift
                                className={cn(
                                  "h-5 w-5",
                                  isDark ? "text-green-400" : "text-green-600",
                                )}
                              />
                              <span
                                className={cn(
                                  "font-semibold",
                                  isDark ? "text-green-100" : "text-green-900",
                                )}
                              >
                                Bonus Budget
                              </span>
                              <div className="group relative">
                                <Info
                                  className={cn(
                                    "h-4 w-4 cursor-help",
                                    isDark
                                      ? "text-green-400"
                                      : "text-green-600",
                                  )}
                                />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 min-w-64 max-w-80 text-center">
                                  Additional bonus on top of prize pool. Every
                                  verified submission receives the
                                  per-submission bonus until the total budget is
                                  exhausted.
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div
                                className={cn(
                                  "rounded-lg p-3 border",
                                  isDark
                                    ? "bg-slate-800 border-green-700/30"
                                    : "bg-white border-green-200",
                                )}
                              >
                                <div
                                  className={cn(
                                    "text-xs mb-1",
                                    isDark
                                      ? "text-green-300"
                                      : "text-green-700",
                                  )}
                                >
                                  Per Submission
                                </div>
                                <div
                                  className={cn(
                                    "text-lg font-bold",
                                    isDark
                                      ? "text-green-100"
                                      : "text-green-900",
                                  )}
                                >
                                  {formatMoney(
                                    contest.contest_based_details
                                      .leaderboard_contest.flat_fee_bonus,
                                  )}
                                </div>
                              </div>
                              {contest.contest_based_details.leaderboard_contest
                                .total_budget && (
                                <div
                                  className={cn(
                                    "rounded-lg p-3 border",
                                    isDark
                                      ? "bg-slate-800 border-green-700/30"
                                      : "bg-white border-green-200",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "text-xs mb-1",
                                      isDark
                                        ? "text-green-300"
                                        : "text-green-700",
                                    )}
                                  >
                                    Total Budget
                                  </div>
                                  <div
                                    className={cn(
                                      "text-lg font-bold",
                                      isDark
                                        ? "text-green-100"
                                        : "text-green-900",
                                    )}
                                  >
                                    {formatMoney(
                                      contest.contest_based_details
                                        .leaderboard_contest.total_budget,
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* Flat Fee Bonus for CPM contests */}
                      {isCpmContestType(contest.contest_type) &&
                        contest.contest_based_details?.cpm_contest
                          ?.flat_fee_bonus && (
                          <div
                            className={cn(
                              "p-3 rounded-lg border transition-all duration-300",
                              isDark
                                ? "bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-green-400/40"
                                : "bg-gradient-to-r from-green-50 to-green-50 border-green-200",
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Gift
                                  className={cn(
                                    "h-5 w-5",
                                    isDark
                                      ? "text-green-400"
                                      : "text-green-600",
                                  )}
                                />
                                <span
                                  className={cn(
                                    "font-medium",
                                    isDark
                                      ? "text-slate-100"
                                      : "text-slate-900",
                                  )}
                                >
                                  Guaranteed Bonus
                                </span>
                                <div className="group relative">
                                  <Info
                                    className={cn(
                                      "h-4 w-4 cursor-help",
                                      isDark
                                        ? "text-green-400"
                                        : "text-green-600",
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
                                    Every submission that gets verified will
                                    receive this guaranteed bonus amount. Your
                                    submission will only get verified if you
                                    follow the brief and rules & guidelines.
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div
                                  className={cn(
                                    "text-lg font-bold",
                                    isDark
                                      ? "text-green-100"
                                      : "text-green-900",
                                  )}
                                >
                                  {formatMoney(
                                    contest.contest_based_details.cpm_contest
                                      .flat_fee_bonus,
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "text-xs",
                                    isDark
                                      ? "text-green-300"
                                      : "text-green-700",
                                  )}
                                >
                                  per verified submission
                                </div>
                              </div>
                            </div>
                            {/* Flat Fee Bonus Cap (for CPM contests) */}
                            {contest.contest_based_details?.cpm_contest
                              ?.flat_fee_bonus_cap && (
                              <div className="mt-3">
                                <p
                                  className={cn(
                                    "text-sm font-medium",
                                    isDark
                                      ? "text-green-200"
                                      : "text-green-800",
                                  )}
                                >
                                  💰 Flat Fee Bonus Cap:{" "}
                                  {formatMoney(
                                    contest.contest_based_details.cpm_contest
                                      .flat_fee_bonus_cap,
                                  )}
                                </p>
                                <p
                                  className={cn(
                                    "text-xs mt-2",
                                    isDark
                                      ? "text-green-400"
                                      : "text-green-600",
                                  )}
                                >
                                  Maximum total flat fee bonus to distribute
                                  across all creators. Once this cap is reached,
                                  no more flat fee bonuses will be given.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                      {/* Multiple Submissions */}
                      {(contest as any).multiple_submissions_enabled && (
                        <div
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-lg border transition-all duration-300",
                            isDark
                              ? "bg-gradient-to-r from-purple-500/20 to-violet-500/20 border-purple-400/50"
                              : "bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200",
                          )}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <CheckCheck
                              className={cn(
                                "h-5 w-5",
                                isDark ? "text-purple-400" : "text-purple-600",
                              )}
                            />
                            <span
                              className={cn(
                                "font-medium text-sm sm:text-base",
                                isDark ? "text-slate-100" : "text-slate-900",
                              )}
                            >
                              Multiple Submissions
                            </span>
                            <div className="group relative flex-shrink-0">
                              <Info
                                className={cn(
                                  "h-3.5 w-3.5 sm:h-4 sm:w-4 cursor-help",
                                  isDark
                                    ? "text-purple-400"
                                    : "text-purple-600",
                                )}
                              />
                              <div
                                className={cn(
                                  "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 w-[180px] sm:w-auto sm:min-w-64 sm:max-w-80 text-center",
                                  isDark
                                    ? "bg-slate-800 text-slate-100 border border-slate-700"
                                    : "bg-slate-900 text-white",
                                )}
                              >
                                You can submit multiple pieces of content to
                                maximize your chances of winning and earning.
                                Each submission must follow the brief and rules
                                & guidelines.
                              </div>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div
                              className={cn(
                                "text-base sm:text-lg font-bold",
                                isDark ? "text-purple-100" : "text-purple-900",
                              )}
                            >
                              Up to{" "}
                              {(contest as any).max_submissions_per_creator}{" "}
                              entries
                            </div>
                            {(contest as any).max_earnings_per_creator && (
                              <div
                                className={cn(
                                  "text-[10px] sm:text-xs mt-0.5",
                                  isDark
                                    ? "text-purple-300"
                                    : "text-purple-700",
                                )}
                              >
                                Cap:{" "}
                                {formatMoney(
                                  (contest as any).max_earnings_per_creator,
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Additional Bonuses */}
                      {(contest as any).bonus_details?.description_html && (
                        <div
                          className={cn(
                            "p-3 rounded-lg border transition-all duration-300",
                            isDark
                              ? "bg-gradient-to-r from-yellow-900/40 to-amber-900/40 border-yellow-400/40"
                              : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200",
                          )}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <Star
                              className={cn(
                                "h-5 w-5",
                                isDark ? "text-amber-400" : "text-amber-600",
                              )}
                            />
                            <span
                              className={cn(
                                "font-medium",
                                isDark ? "text-slate-100" : "text-slate-900",
                              )}
                            >
                              Extra Bonuses
                            </span>
                            <div className="group relative">
                              <Info
                                className={cn(
                                  "h-4 w-4 cursor-help",
                                  isDark ? "text-amber-400" : "text-amber-600",
                                )}
                              />
                              <div
                                className={cn(
                                  "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 min-w-64 max-w-80 text-center",
                                  isDark
                                    ? "bg-slate-800 text-slate-100 border border-slate-700"
                                    : "bg-slate-900 text-white",
                                )}
                              >
                                These are additional earning opportunities. The
                                amount is handled and credited by the brand
                                separately from the main contest prizes.
                              </div>
                            </div>
                          </div>
                          <div className="max-h-40 overflow-y-auto pr-2">
                            <div
                              className={cn(
                                "prose prose-sm max-w-none",
                                isDark
                                  ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_li]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white [&_a]:!text-white"
                                  : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700",
                              )}
                              dangerouslySetInnerHTML={{
                                __html: (contest as any).bonus_details
                                  .description_html,
                              }}
                            />
                          </div>
                          <div
                            className={cn(
                              "mt-2 pt-2 border-t",
                              isDark
                                ? "border-amber-400/50"
                                : "border-amber-200",
                            )}
                          >
                            <p
                              className={cn(
                                "text-xs flex items-center gap-1",
                                isDark ? "text-amber-300" : "text-amber-700",
                              )}
                            >
                              <Info className="h-3 w-3" />
                              These bonuses are handled manually by the brand.
                              Read carefully and reach out if you have
                              questions!
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Comprehensive Prize Distribution Section for Leaderboard Contests */}
                {contest.contest_type === "leaderboard" &&
                  contest.contest_based_details?.leaderboard_contest
                    ?.prizes && (
                    <div
                      id="prize-structure"
                      ref={(el) => {
                        sectionRefs.current["prize-structure"] = el;
                      }}
                      className={cn(
                        "rounded-xl border shadow-sm",
                        isDark
                          ? "border-gray-600"
                          : "bg-white border-slate-200",
                      )}
                    >
                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Trophy className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3
                              className={cn(
                                "text-xl font-bold",
                                isDark ? "text-white" : "text-slate-900",
                              )}
                            >
                              Prize Structure
                            </h3>
                            <p
                              className={cn(
                                "text-sm",
                                isDark ? "text-gray-300" : "text-slate-600",
                              )}
                            >
                              Complete prize breakdown for all positions
                            </p>
                          </div>
                        </div>

                        {/* Prize Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                          <div
                            className={cn(
                              "bg-gradient-to-r rounded-lg p-4 border",
                              isDark
                                ? "from-purple-900/20 to-violet-900/20 border-purple-700/50"
                                : "from-purple-50 to-violet-50 border-purple-200",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Trophy
                                className={cn(
                                  "h-6 w-6",
                                  isDark
                                    ? "text-purple-400"
                                    : "text-purple-600",
                                )}
                              />
                              <div>
                                <div
                                  className={cn(
                                    "text-sm font-medium",
                                    isDark
                                      ? "text-purple-200"
                                      : "text-purple-800",
                                  )}
                                >
                                  Total Prize Pool
                                </div>
                                <div
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark
                                      ? "text-purple-100"
                                      : "text-purple-900",
                                  )}
                                >
                                  {formatMoney(
                                    contest.contest_based_details
                                      .leaderboard_contest.total_prize,
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "rounded-lg p-4 border border-blue-200 dark:border-blue-700/50",
                              isDark
                                ? "border-blue-700/50 bg-blue-900/30"
                                : "border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Users
                                className={cn(
                                  "h-6 w-6",
                                  isDark ? "text-blue-400" : "text-blue-600",
                                )}
                              />
                              <div>
                                <div
                                  className={cn(
                                    "text-sm font-medium",
                                    isDark ? "text-blue-300" : "text-blue-800",
                                  )}
                                >
                                  Total Winners
                                </div>
                                <div
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark ? "text-blue-200" : "text-blue-900",
                                  )}
                                >
                                  {
                                    contest.contest_based_details
                                      .leaderboard_contest.winner_count
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                          {contest.contest_based_details.leaderboard_contest
                            .flat_fee_bonus && (
                            <div
                              className={cn(
                                "bg-gradient-to-r rounded-lg p-4 border",
                                isDark
                                  ? "from-green-900/20 to-emerald-900/20 border-green-700/50"
                                  : "from-green-50 to-emerald-50 border-green-200",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <Gift
                                  className={cn(
                                    "h-6 w-6",
                                    isDark
                                      ? "text-green-400"
                                      : "text-green-600",
                                  )}
                                />
                                <div>
                                  <div
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark
                                        ? "text-green-200"
                                        : "text-green-800",
                                    )}
                                  >
                                    Bonus Budget
                                  </div>
                                  <div
                                    className={cn(
                                      "text-2xl font-bold",
                                      isDark
                                        ? "text-green-100"
                                        : "text-green-900",
                                    )}
                                  >
                                    {formatMoney(
                                      contest.contest_based_details
                                        .leaderboard_contest.flat_fee_bonus,
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      "text-xs mt-0.5",
                                      isDark
                                        ? "text-green-300"
                                        : "text-green-700",
                                    )}
                                  >
                                    per verified submission
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bonus Budget Note */}
                        {contest.contest_based_details.leaderboard_contest
                          .flat_fee_bonus && (
                          <div
                            className={cn(
                              "mb-6 p-4 border rounded-lg",
                              isDark
                                ? "bg-green-900/10 border-green-700/50"
                                : "bg-green-50 border-green-200",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Gift
                                className={cn(
                                  "h-5 w-5 mt-0.5 flex-shrink-0",
                                  isDark ? "text-green-400" : "text-green-600",
                                )}
                              />
                              <div>
                                <p
                                  className={cn(
                                    "text-sm font-semibold mb-1",
                                    isDark
                                      ? "text-green-200"
                                      : "text-green-900",
                                  )}
                                >
                                  Additional Bonus Earnings
                                </p>
                                <p
                                  className={cn(
                                    "text-sm",
                                    isDark
                                      ? "text-green-300"
                                      : "text-green-800",
                                  )}
                                >
                                  Every verified submission receives{" "}
                                  <span className="font-bold">
                                    {formatMoney(
                                      contest.contest_based_details
                                        .leaderboard_contest.flat_fee_bonus,
                                    )}
                                  </span>{" "}
                                  as a guaranteed bonus, on top of any prizes
                                  won from the leaderboard positions above
                                  {contest.contest_based_details
                                    .leaderboard_contest.total_budget && (
                                    <>
                                      , until the bonus budget of{" "}
                                      <span className="font-bold">
                                        {formatMoney(
                                          contest.contest_based_details
                                            .leaderboard_contest.total_budget,
                                        )}
                                      </span>{" "}
                                      is reached
                                    </>
                                  )}
                                  .
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Prize Distribution List */}
                        <div>
                          <h4
                            className={cn(
                              "text-lg font-semibold mb-4",
                              isDark ? "text-white" : "text-slate-900",
                            )}
                          >
                            Prize Distribution
                          </h4>
                          <div
                            className={cn(
                              "rounded-lg border border-slate-200 dark:border-slate-700 max-h-80 overflow-y-auto",
                              isDark
                                ? "border-slate-700"
                                : "bg-slate-50 border-slate-200",
                            )}
                          >
                            <div
                              className={cn(
                                "divide-y",
                                isDark
                                  ? "divide-slate-700"
                                  : "divide-slate-200",
                              )}
                            >
                              {contest.contest_based_details.leaderboard_contest.prizes
                                .sort(
                                  (a: any, b: any) => a.position - b.position,
                                )
                                .map((prize: any, index: number) => (
                                  <div
                                    key={index}
                                    className={cn(
                                      "p-4 transition-colors",
                                      isDark
                                        ? "hover:bg-purple-900/30"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800 ",
                                    )}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                                          {prize.position}
                                        </div>
                                        <div>
                                          <div
                                            className={cn(
                                              "font-medium",
                                              isDark
                                                ? "text-slate-100"
                                                : "text-slate-900",
                                            )}
                                          >
                                            Position {prize.position}
                                            {prize.position === 1 && " 🥇"}
                                            {prize.position === 2 && " 🥈"}
                                            {prize.position === 3 && " 🥉"}
                                          </div>
                                          <div
                                            className={cn(
                                              "text-sm",
                                              isDark
                                                ? "text-slate-400"
                                                : "text-slate-600",
                                            )}
                                          >
                                            {prize.position === 1
                                              ? "1st Place"
                                              : prize.position === 2
                                                ? "2nd Place"
                                                : prize.position === 3
                                                  ? "3rd Place"
                                                  : `${prize.position}th Place`}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div
                                          className={cn(
                                            "text-xl font-bold",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900",
                                          )}
                                        >
                                          {formatMoney(prize.amount)}
                                        </div>
                                        <div
                                          className={cn(
                                            "text-sm",
                                            isDark
                                              ? "text-slate-400"
                                              : "text-slate-600",
                                          )}
                                        >
                                          {(
                                            (prize.amount /
                                              contest.contest_based_details
                                                .leaderboard_contest
                                                .total_prize) *
                                            100
                                          ).toFixed(1)}
                                          % of total
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* 2. CONTEST DETAILS - Essential Information */}
                <div
                  id="contest-details"
                  ref={(el) => {
                    sectionRefs.current["contest-details"] = el;
                  }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold text-xl text-foreground flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    Contest Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Start Date Card */}
                    <div
                      className={cn(
                        "rounded-xl p-4 border shadow-sm",
                        isDark
                          ? "border-blue-400/50"
                          : "bg-white border-blue-200 dark:border-blue-700/30",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-3 rounded-full",
                            isDark
                              ? "bg-blue-500/30 text-blue-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
                          )}
                        >
                          <Play className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-xs font-medium uppercase tracking-wide",
                              isDark ? "text-slate-300" : "text-slate-600",
                            )}
                          >
                            Start Date & Time
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                          >
                            {contest.start_date
                              ? formatLocalDateTime(contest.start_date)
                              : "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* End Date Card */}
                    <div
                      className={cn(
                        "rounded-xl p-4 border shadow-sm",
                        isDark
                          ? "border-blue-400/50"
                          : "bg-white border-blue-200 dark:border-blue-700/30",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-3 rounded-full",
                            isDark
                              ? "bg-blue-500/30 text-blue-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
                          )}
                        >
                          <Clock className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-xs font-medium uppercase tracking-wide",
                              isDark ? "text-slate-300" : "text-slate-600",
                            )}
                          >
                            End Date & Time
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                          >
                            {contest.end_date
                              ? formatLocalDateTime(contest.end_date)
                              : "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Platform Card */}
                    <div
                      className={cn(
                        "rounded-xl p-4 border shadow-sm",
                        isDark
                          ? "border-blue-400/50"
                          : "bg-white border-blue-200 dark:border-blue-700/30",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-3 rounded-full",
                            isDark
                              ? "bg-blue-500/30 text-blue-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
                          )}
                        >
                          <Monitor className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide",
                              isDark ? "text-slate-300" : "text-slate-600",
                            )}
                          >
                            Platform
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                          >
                            {contest.platform || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status Card */}
                    <div
                      className={cn(
                        "rounded-xl p-4 border shadow-sm",
                        isDark
                          ? "border-blue-400/50"
                          : "bg-white border-blue-200 dark:border-blue-700/30",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-3 rounded-full",
                            isDark
                              ? "bg-blue-500/30 text-blue-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
                          )}
                        >
                          <Info className="h-5 w-5 " />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide",
                              isDark ? "text-slate-300" : "text-slate-600",
                            )}
                          >
                            Status
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                          >
                            {contest.status || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Campaign Type Card - Only for Twitter campaigns */}
                    {(() => {
                      const isTwitterTextImage =
                        (contest.platform?.toLowerCase() === "twitter" ||
                          contest.platform?.toLowerCase() === "x") &&
                        contest.contest_format === "text_image";

                      if (isTwitterTextImage) {
                        const campaignType =
                          contest.contest_based_details?.twitter_campaign
                            ?.campaign_type;
                        if (
                          campaignType === "raid" ||
                          campaignType === "awareness"
                        ) {
                          return (
                            <div
                              className={cn(
                                "rounded-xl p-4 border shadow-sm",
                                isDark
                                  ? campaignType === "raid"
                                    ? "border-red-400/50 bg-red-900/20"
                                    : "border-cyan-400/50 bg-cyan-900/20"
                                  : campaignType === "raid"
                                    ? "bg-white border-red-200"
                                    : "bg-white border-cyan-200",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "p-3 rounded-full",
                                    isDark
                                      ? campaignType === "raid"
                                        ? "bg-red-500/30 text-red-400"
                                        : "bg-cyan-500/30 text-cyan-400"
                                      : campaignType === "raid"
                                        ? "bg-red-100 text-red-600"
                                        : "bg-cyan-100 text-cyan-600",
                                  )}
                                >
                                  <Tag className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                  <p
                                    className={cn(
                                      "text-xs font-medium uppercase tracking-wide",
                                      isDark
                                        ? campaignType === "raid"
                                          ? "text-red-300"
                                          : "text-cyan-300"
                                        : campaignType === "raid"
                                          ? "text-red-600"
                                          : "text-cyan-600",
                                    )}
                                  >
                                    Campaign Type
                                  </p>
                                  <p
                                    className={cn(
                                      "text-lg font-bold",
                                      isDark
                                        ? campaignType === "raid"
                                          ? "text-red-100"
                                          : "text-cyan-100"
                                        : campaignType === "raid"
                                          ? "text-red-900"
                                          : "text-cyan-900",
                                    )}
                                  >
                                    {campaignType === "raid"
                                      ? "Raid Campaign"
                                      : "Awareness Campaign"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>

                  {/* Categories Section */}
                  {contest.categories &&
                    Array.isArray(contest.categories) &&
                    contest.categories.length > 0 &&
                    creatorCategories.length > 0 &&
                    (() => {
                      // Filter categories to only show those in user's profile
                      const filteredCategories = contest.categories.filter(
                        (categoryId: string) =>
                          creatorCategories.includes(categoryId),
                      );

                      return filteredCategories.length > 0 ? (
                        <div className="space-y-3 mt-6">
                          <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                            <Tag className="h-5 w-5 text-purple-600" />
                            Categories
                          </h3>
                          <div
                            className={cn(
                              "border rounded-xl p-4",
                              isDark
                                ? "border-purple-600 bg-purple-950/50"
                                : "border-purple-300 bg-purple-50/50",
                            )}
                          >
                            <div className="flex flex-wrap gap-2">
                              {filteredCategories.map((categoryId: string) => {
                                const category = CONTENT_TYPE_CATEGORIES.find(
                                  (cat) => cat.id === categoryId,
                                );
                                return (
                                  <span
                                    key={categoryId}
                                    className={cn(
                                      "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                                      isDark
                                        ? "bg-purple-600/30 text-purple-200 border border-purple-500/50"
                                        : "bg-purple-100 text-purple-800 border border-purple-300",
                                    )}
                                  >
                                    {category ? category.name : categoryId}
                                  </span>
                                );
                              })}
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
                          if (Object.keys(creatorSubcategories).length === 0) {
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
                            <Tag className="h-5 w-5 text-indigo-600" />
                            Subcategories
                          </h3>
                          <div
                            className={cn(
                              "border rounded-xl p-4",
                              isDark
                                ? "border-indigo-600 bg-indigo-950/50"
                                : "border-indigo-300 bg-indigo-50/50",
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
                                  const category = CONTENT_TYPE_CATEGORIES.find(
                                    (cat) => cat.id === item.category,
                                  );
                                  return (
                                    <span
                                      key={`${item.category}-${item.subcategory}-${index}`}
                                      className={cn(
                                        "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                                        isDark
                                          ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/50"
                                          : "bg-indigo-100 text-indigo-800 border border-indigo-300",
                                      )}
                                    >
                                      {category ? category.name : item.category}
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
                            <Star className="h-5 w-5 text-yellow-600" />
                            Interests
                          </h3>
                          <div
                            className={cn(
                              "border rounded-xl p-4",
                              isDark
                                ? "border-yellow-600 bg-yellow-950/50"
                                : "border-yellow-300 bg-yellow-50/50",
                            )}
                          >
                            <div className="flex flex-wrap gap-2">
                              {filteredInterests.map((interest: string) => (
                                <span
                                  key={interest}
                                  className={cn(
                                    "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                                    isDark
                                      ? "bg-yellow-600/30 text-yellow-200 border border-yellow-500/50"
                                      : "bg-yellow-100 text-yellow-800 border border-yellow-300",
                                  )}
                                >
                                  {interest}
                                </span>
                              ))}
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
                  className="space-y-6"
                >
                  <h3 className="font-semibold text-xl text-foreground flex items-center gap-2">
                    <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    Content Requirements
                  </h3>
                  {/* Twitter raid details for Twitter contests */}
                  {(() => {
                    const twitterCampaign = (contest as any)
                      .contest_based_details?.twitter_campaign;
                    const raidTarget = twitterCampaign?.raid_target;
                    const twitterKeywords = twitterCampaign?.keywords || [];
                    const twitterMentions = twitterCampaign?.mentions || [];
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
                              : "bg-slate-50 border-slate-200",
                          )}
                        >
                          <h4
                            className={cn(
                              "font-semibold text-lg flex items-center gap-2",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                          >
                            <Share2 className="h-5 w-5 text-sky-500" />
                            Target Tweet for This Raid
                          </h4>

                          {raidTarget?.link && (
                            <div className="space-y-1">
                              <p
                                className={cn(
                                  "text-xs uppercase tracking-wide font-medium",
                                  isDark ? "text-slate-300" : "text-slate-600",
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
                                    ? "text-sky-300 hover:text-sky-200"
                                    : "text-sky-600 hover:text-sky-700",
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
                                  isDark ? "text-slate-300" : "text-slate-600",
                                )}
                              >
                                Tweet Description
                              </p>
                              <p
                                className={cn(
                                  "text-sm leading-relaxed",
                                  isDark ? "text-slate-100" : "text-slate-800",
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
                                  "rounded-xl p-4 border flex items-center justify-between gap-4",
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
                                      ? "bg-pink-500/10 border border-pink-500/25 text-pink-200"
                                      : "bg-pink-50 border border-pink-100 text-pink-600",
                                  )}
                                >
                                  <ThumbsUp className="h-6 w-6" />
                                </div>
                              </div>

                              <div
                                className={cn(
                                  "rounded-xl p-4 border flex items-center justify-between gap-4",
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
                                    {typeof raidTarget.metrics.comments ===
                                    "number"
                                      ? raidTarget.metrics.comments.toLocaleString()
                                      : (raidTarget.metrics.comments ??
                                        "Not specified")}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                    isDark
                                      ? "bg-orange-500/10 border border-orange-500/25 text-orange-200"
                                      : "bg-orange-50 border border-orange-100 text-orange-600",
                                  )}
                                >
                                  <MessageCircle className="h-6 w-6" />
                                </div>
                              </div>

                              <div
                                className={cn(
                                  "rounded-xl p-4 border flex items-center justify-between gap-4",
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
                                    {typeof raidTarget.metrics.retweets ===
                                    "number"
                                      ? raidTarget.metrics.retweets.toLocaleString()
                                      : (raidTarget.metrics.retweets ??
                                        "Not specified")}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                    isDark
                                      ? "bg-sky-500/10 border border-sky-500/25 text-sky-200"
                                      : "bg-sky-50 border border-sky-100 text-sky-600",
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
                                ? "border-violet-500/30 bg-violet-950/25"
                                : "border-violet-200 bg-gradient-to-br from-white to-violet-50/70",
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <Info
                                className={cn(
                                  "h-5 w-5 shrink-0 mt-0.5",
                                  isDark
                                    ? "text-violet-300"
                                    : "text-violet-600",
                                )}
                                aria-hidden
                              />
                              <div className="min-w-0 space-y-3">
                                <p
                                  className={cn(
                                    "text-sm font-semibold",
                                    isDark
                                      ? "text-violet-100"
                                      : "text-violet-900",
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
                                  <strong>target tweet</strong>, the more points
                                  you can earn. You can also earn additional
                                  points based on the{" "}
                                  <strong>quality and reach</strong> of your own
                                  posts.
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
                                  <strong>Twitter Feed</strong> tab and use the{" "}
                                  <strong>Refresh</strong> button there to pull
                                  the latest numbers. You&apos;ll see your
                                  participation (tweets, quotes, comments) and
                                  your points and ranking.
                                </p>
                                <p
                                  className={cn(
                                    "text-sm leading-relaxed",
                                    isDark
                                      ? "text-slate-200"
                                      : "text-slate-700",
                                  )}
                                >
                                  <strong>New to raids?</strong> You need at
                                  least one qualifying action—such as a retweet,
                                  quote repost, or comment on the target
                                  tweet—to be eligible for points (see Brief &
                                  Participation Guidelines for more detailed
                                  info & rules). We don&apos;t publish a fixed
                                  points formula; points reflect engagement
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
                                  <strong>Tip:</strong> The more you engage, the
                                  more points you can earn. Don&apos;t
                                  compromise on quality and avoid spam.
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
                                    <strong>{raidCpmPer1000Usd}</strong> per{" "}
                                    <strong>1,000 points</strong>—that rate is
                                    the CPM/Pay Rate shown under Earning
                                    Opportunities above.
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
                                    Prize rules for this format are listed under{" "}
                                    <strong>Earning Opportunities</strong> and
                                    the contest brief.
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
                    const twitterKeywords = twitterCampaign?.keywords || [];
                    const twitterMentions = twitterCampaign?.mentions || [];

                    return (
                      contest.platform?.toLowerCase() === "twitter" &&
                      (twitterKeywords.length > 0 ||
                        twitterMentions.length > 0) && (
                        <div
                          className={cn(
                            "rounded-xl p-4 border space-y-3",
                            isDark
                              ? "bg-slate-900/40 border-slate-700"
                              : "bg-slate-50 border-slate-200",
                          )}
                        >
                          <h4
                            className={cn(
                              "font-semibold text-sm flex items-center gap-2",
                              isDark ? "text-slate-100" : "text-slate-900",
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

                  {/* Brief Section */}
                  <div
                    className={cn(
                      "rounded-xl p-6 border",
                      isDark
                        ? "bg-purple-500/10 border-purple-400/50"
                        : "bg-purple-50 border-purple-200",
                    )}
                  >
                    <h4
                      className={cn(
                        "font-semibold text-lg mb-4",
                        isDark ? "text-slate-100" : "text-slate-900",
                      )}
                    >
                      📝 Brief
                    </h4>
                    {contest.brief_html ? (
                      <div
                        className={cn(
                          "prose prose-sm max-w-none [&_a]:break-words [&_a]:hover:underline",
                          isDark
                            ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_a]:!text-blue-400 [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white"
                            : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700",
                        )}
                        dangerouslySetInnerHTML={{ __html: contest.brief_html }}
                      />
                    ) : (
                      <p
                        className={cn(
                          "text-slate-600 dark:text-slate-400 text-sm",
                          isDark ? "text-slate-300" : "text-slate-700",
                        )}
                      >
                        No brief provided
                      </p>
                    )}
                  </div>

                  {/* Content Type Info Tag */}
                  {(contest as any).content_type && (
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-2",
                        isDark
                          ? "bg-blue-900/30 border border-blue-700/50"
                          : "bg-blue-50 border border-blue-200",
                      )}
                    >
                      <Tag
                        className={cn(
                          "h-4 w-4",
                          isDark ? "text-blue-400" : "text-blue-600",
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isDark ? "text-blue-100" : "text-blue-900",
                        )}
                      >
                        {(contest as any).content_type.toUpperCase()} -{" "}
                        {(contest as any).content_type === "ugc"
                          ? "Create Face videos"
                          : (contest as any).content_type === "clipping"
                            ? "Video editing and clipping"
                            : "Check rules to find out what kind of content you need to create"}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. PARTICIPATION GUIDELINES - Rules and Terms */}
                <div
                  id="participation-guidelines"
                  ref={(el) => {
                    sectionRefs.current["participation-guidelines"] = el;
                  }}
                  className="space-y-6"
                >
                  <h3 className="font-semibold text-xl text-foreground flex items-center gap-2">
                    <ScrollText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    Participation Guidelines
                  </h3>
                  {/* Rules & Guidelines Section */}
                  <div
                    className={cn(
                      "rounded-xl p-6 border",
                      isDark ? "border-gray-600" : "bg-white border-orange-200",
                    )}
                  >
                    <h4
                      className={cn(
                        "font-semibold text-lg mb-4 flex items-center gap-2",
                        isDark ? "text-slate-100" : "text-slate-900",
                      )}
                    >
                      <ScrollText
                        className={cn(
                          "h-5 w-5",
                          isDark ? "text-orange-400" : "text-orange-600",
                        )}
                      />
                      Rules & Guidelines
                    </h4>
                    {/* Check multiple possible rule fields */}
                    {(contest as any).rules_html ? (
                      <div
                        className={cn(
                          "prose prose-sm max-w-none [&_a]:break-words [&_a]:hover:underline",
                          isDark
                            ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_a]:!text-blue-400 [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white"
                            : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700",
                        )}
                        dangerouslySetInnerHTML={{
                          __html: (contest as any).rules_html,
                        }}
                      />
                    ) : contest.rules ? (
                      <div
                        className={cn(
                          "text-sm leading-relaxed whitespace-pre-wrap",
                          isDark ? "text-slate-300" : "text-slate-700",
                        )}
                      >
                        {contest.rules}
                      </div>
                    ) : contest.rules_description ? (
                      <div
                        className={cn(
                          "text-sm leading-relaxed whitespace-pre-wrap",
                          isDark ? "text-slate-300" : "text-slate-700",
                        )}
                      >
                        {contest.rules_description}
                      </div>
                    ) : (contest as any).rules_text ? (
                      <div
                        className={cn(
                          "text-sm leading-relaxed whitespace-pre-wrap",
                          isDark ? "text-slate-300" : "text-slate-700",
                        )}
                      >
                        {(contest as any).rules_text}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div
                          className={cn(
                            "text-sm leading-relaxed",
                            isDark ? "text-slate-300" : "text-slate-700",
                          )}
                        >
                          <h4
                            className={cn(
                              "font-semibold mb-2",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                          >
                            General Rules:
                          </h4>
                          <ul
                            className={cn(
                              "space-y-2 ml-4 list-disc",
                              isDark ? "text-slate-400" : "text-slate-600",
                            )}
                          >
                            <li>
                              <strong>Eligibility:</strong> Only registered
                              creators are eligible to participate in contests.
                            </li>
                            <li>
                              <strong>Age Requirement:</strong> Contestants must
                              be at least 18 years old.
                            </li>
                            <li>
                              <strong>Content Standards:</strong> Content must
                              adhere to the platform's content guidelines and
                              community standards.
                            </li>
                            <li>
                              <strong>Original Work:</strong> All submissions
                              must be original content created by the
                              participant.
                            </li>
                            <li>
                              <strong>Submission Deadline:</strong> Entries must
                              be submitted before the contest end date and time.
                            </li>
                            <li>
                              <strong>Platform Compliance:</strong> Content must
                              comply with the rules and policies of the
                              specified platform (YouTube, Instagram, etc.).
                            </li>
                          </ul>
                        </div>

                        <div
                          className={cn(
                            "border-t pt-3",
                            isDark ? "border-slate-600" : "border-slate-200",
                          )}
                        >
                          <h4
                            className={cn(
                              "font-semibold mb-2",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                          >
                            ⚠️ Important Notes:
                          </h4>
                          <ul
                            className={cn(
                              "space-y-1 ml-4 list-disc text-sm",
                              isDark ? "text-slate-400" : "text-slate-600",
                            )}
                          >
                            <li>
                              Violation of rules may result in disqualification
                            </li>
                            <li>
                              Contest organizers reserve the right to verify
                              submissions
                            </li>
                            <li>
                              Winners will be contacted through their registered
                              email
                            </li>
                            <li>
                              Prize distribution is subject to verification and
                              approval
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Terms & Conditions for CPM contests */}
                  {isCpmContestType(contest.contest_type) &&
                    contest.contest_based_details?.cpm_contest
                      ?.terms_conditions && (
                      <div
                        className={cn(
                          "rounded-xl p-6 border mt-6",
                          isDark
                            ? "border-slate-600"
                            : "bg-white border-orange-200",
                        )}
                      >
                        <h4
                          className={cn(
                            "font-semibold text-lg mb-4",
                            isDark ? "text-slate-100" : "text-slate-900",
                          )}
                        >
                          📋 Terms & Conditions
                        </h4>
                        <div
                          className={cn(
                            "rounded-lg p-4 border",
                            isDark
                              ? "border-gray-700"
                              : "bg-slate-50 border-slate-200",
                          )}
                        >
                          <pre
                            className={cn(
                              "whitespace-pre-wrap break-words font-sans text-sm",
                              isDark ? "text-white" : "text-slate-700",
                            )}
                          >
                            {
                              contest.contest_based_details.cpm_contest
                                .terms_conditions
                            }
                          </pre>
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
                  className="space-y-6"
                >
                  <h3 className="font-semibold text-xl text-foreground flex items-center gap-2">
                    <Lightbulb className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    Resources & Tools
                  </h3>

                  {contest.resources &&
                  ((Array.isArray(contest.resources) &&
                    contest.resources.length > 0) ||
                    (typeof contest.resources === "object" &&
                      Object.keys(contest.resources).length > 0)) ? (
                    <div className="grid gap-4">
                      {(Array.isArray(contest.resources)
                        ? contest.resources
                        : Object.entries(contest.resources).map(
                            ([description, url]) => ({
                              url,
                              description,
                              type: "external",
                            }),
                          )
                      ).map((resource: any, idx: number) => {
                        const isImage =
                          resource.url &&
                          (resource.url.startsWith("data:image") ||
                            /\.(jpg|jpeg|png|gif|jfif|webp)$/i.test(
                              resource.url,
                            ));
                        const isPdf =
                          resource.url && /\.pdf$/i.test(resource.url);
                        const isVideo =
                          resource.url &&
                          /\.(mp4|mov|avi|webm)$/i.test(resource.url);
                        const isInternal = resource.type === "internal";
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "border rounded-xl p-5",
                              isDark ? "border-gray-600" : "border-gray-300",
                            )}
                          >
                            <div className="flex flex-col md:flex-row justify-between">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                {isInternal && isImage && !isPdf ? (
                                  <img
                                    src={resource.url}
                                    alt={resource.description}
                                    className="w-12 h-12 object-cover rounded-lg dark:border-gray-600"
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
                                        : "bg-purple-100 text-purple-600",
                                    )}
                                  >
                                    <ExternalLink className="h-5 w-5" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4
                                    className={cn(
                                      "text-base font-semibold text-gray-900 dark:text-gray-100 mb-1",
                                      isDark ? "text-white" : "text-slate-700",
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
                                    {resource.type === "external"
                                      ? "External Link"
                                      : "Uploaded File"}
                                  </p>
                                </div>
                              </div>
                              <Button
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
                  ) : (
                    <div
                      className={cn(
                        "text-center py-12 rounded-xl border border-gray-300",
                        isDark ? "text-gray-300" : "bg-gray-50 text-slate-700",
                      )}
                    >
                      <div
                        className={cn(
                          "w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center",
                          isDark ? "bg-blue-500/30" : "bg-blue-100",
                        )}
                      >
                        <Lightbulb className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h4
                        className={cn(
                          "text-lg font-medium text-gray-900 dark:text-gray-100 mb-2",
                          isDark ? "text-white" : "text-slate-700",
                        )}
                      >
                        No additional resources provided
                      </h4>
                      <p
                        className={cn(
                          "text-gray-600 dark:text-gray-400",
                          isDark ? "text-gray-300" : "text-slate-700",
                        )}
                      >
                        Check the brief and rules above for all contest
                        requirements.
                      </p>
                    </div>
                  )}
                </div>

                {/* Inspiration Links Section */}
                {(() => {
                  let links = Array.isArray(contest.inspiration_links)
                    ? contest.inspiration_links
                    : [];
                  return links.length > 0 ? (
                    <>
                      <Separator className="my-8" />
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          {/* <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div> */}
                          <h3
                            className={cn(
                              "text-xl font-semibold",
                              isDark ? "text-white" : "text-slate-900",
                            )}
                          >
                            Inspiration Links
                          </h3>
                        </div>

                        <div className="grid gap-4">
                          {links.map(
                            (
                              item: { url: string; description: string },
                              index: number,
                            ) => {
                              // Process URL to replace [creator] with username
                              const username = userProfile?.username || "";
                              const processedUrl = processUrlWithCreator(
                                item.url,
                                username,
                              );

                              return (
                                <div
                                  key={index}
                                  className={cn(
                                    "border rounded-xl p-5",
                                    isDark
                                      ? "border-gray-600"
                                      : "bg-white border-gray-300",
                                  )}
                                >
                                  <div className="flex items-start gap-4">
                                    <div
                                      className={cn(
                                        "p-3 rounded-full flex-shrink-0",
                                        isDark
                                          ? "bg-[#FFFFFF42] text-white"
                                          : "bg-purple-100 text-purple-600",
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
                                          "block text-base font-medium text-blue-600 hover:underline mb-2 break-all",
                                          isDark
                                            ? "text-purple-300"
                                            : "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300",
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

                {/* Tracking Links Section */}
                {(() => {
                  let trackingLinks = Array.isArray(contest.tracking_links)
                    ? contest.tracking_links
                    : [];
                  return trackingLinks.length > 0 ? (
                    <div className="space-y-4">
                      <h4
                        className={cn(
                          "text-xl font-semibold flex items-center gap-2",
                          isDark ? "text-white" : "text-slate-900",
                        )}
                      >
                        <Copy className="h-5 w-5 text-green-600 dark:text-green-400" />
                        Tracking Links
                      </h4>
                      {contest.multiple_submissions_enabled && (
                        <div
                          className={cn(
                            "rounded-lg border p-4",
                            isDark
                              ? "border-[#C9A7FF] bg-[#C9A7FF26]"
                              : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200",
                          )}
                        >
                          <p
                            className={cn(
                              "text-sm flex items-start gap-2",
                              isDark ? "text-white" : "text-yellow-800",
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
                      )}

                      <div className="grid gap-4">
                        {trackingLinks.map(
                          (
                            item: { url: string; description: string },
                            index: number,
                          ) => {
                            // Process URL to replace [creator] with username
                            const username = userProfile?.username || "";
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
                                console.error("Failed to copy link:", error);
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
                                    ? "border-gray-600"
                                    : "bg-white border-slate-200",
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      "mt-0.5 p-3 rounded-full flex-shrink-0",
                                      isDark
                                        ? "bg-green-900/40 text-green-400"
                                        : "bg-green-100 text-green-600",
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
                                            ? "text-purple-300"
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
                  ) : null;
                })()}
              </CardContent>
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
                          "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between rounded-xl border p-4 sm:p-5 shadow-sm",
                          isDark
                            ? "bg-gradient-to-b from-[#1a0a3d]/90 to-[#170337] border-white/10"
                            : "bg-gradient-to-b from-white to-purple-50/35 border-gray-200/90",
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                "inline-flex h-2 w-2 shrink-0 rounded-full animate-pulse",
                                isDark
                                  ? "bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.6)]"
                                  : "bg-purple-500",
                              )}
                              aria-hidden
                            />
                            <h2
                              className={cn(
                                "text-lg sm:text-xl font-bold tracking-tight truncate",
                                isDark ? "text-white" : "text-gray-900",
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
                          "border overflow-hidden",
                          isDark
                            ? "bg-[#180438]/80 border-purple-500/20"
                            : "bg-gradient-to-br from-white to-purple-50/50 border-purple-100",
                        )}
                      >
                        <CardContent className="flex flex-col items-center justify-center gap-4 py-14 px-6">
                          <div className="relative">
                            <div
                              className={cn(
                                "absolute inset-0 rounded-full blur-xl opacity-40",
                                isDark ? "bg-fuchsia-500" : "bg-purple-400",
                              )}
                            />
                            <Loader2
                              className={cn(
                                "relative h-10 w-10 animate-spin",
                                isDark ? "text-fuchsia-300" : "text-purple-600",
                              )}
                            />
                          </div>
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
                        ((contest.contest_based_details as any)
                          ?.milestone_contest?.bonus?.most_verified_views
                          ?.payout_cents || 0) > 0 ||
                        ((contest.contest_based_details as any)
                          ?.milestone_contest?.bonus?.most_verified_reels
                          ?.payout_cents || 0) > 0) &&
                      contest?.status?.toLowerCase() === "ended" &&
                      contest?.post_contest_status === "payouts_processed" && (
                        <div
                          className={cn(
                            "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 p-4 rounded-xl border shadow-sm",
                            isDark
                              ? "bg-[#C9A7FF26] border-[#C9A7FF]"
                              : "bg-[#D9C0FF26] border-[#D9C0FF]",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-lg",
                                isDark
                                  ? "bg-[#FFFFFF42] text-white"
                                  : "bg-[#D8C3FF] text-[#4A00BE]",
                              )}
                            >
                              <Eye className="h-4 w-4" />
                            </div>
                            <div>
                              <span
                                className={cn(
                                  "text-sm font-semibold",
                                  isDark ? "text-white" : "text-slate-800",
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
                              "flex rounded-lg p-1 w-full sm:w-auto",
                              isDark
                                ? "bg-[#C9A7FF26]  border-[#C9A7FF]"
                                : "bg-[#D9C0FF26] border-[#D9C0FF]",
                            )}
                          >
                            <Button
                              variant={
                                leaderboardViewMode === "simple"
                                  ? "default"
                                  : "ghost"
                              }
                              size="sm"
                              onClick={() => setLeaderboardViewMode("simple")}
                              className={`text-xs px-3 py-1.5 transition-all duration-200 flex-1 sm:flex-none ${
                                leaderboardViewMode === "simple"
                                  ? isDark
                                    ? "bg-purple-600 text-white"
                                    : "bg-purple-500 text-white"
                                  : isDark
                                    ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                                    : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-current opacity-60" />
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
                              onClick={() => setLeaderboardViewMode("detailed")}
                              className={`text-xs px-3 py-1.5 transition-all duration-200 flex-1 sm:flex-none ${
                                leaderboardViewMode === "detailed"
                                  ? isDark
                                    ? "bg-purple-600 text-white"
                                    : "bg-purple-500 text-white"
                                  : isDark
                                    ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                                    : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-current opacity-60" />
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
                            "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 p-4 rounded-xl border shadow-sm",
                            isDark
                              ? "bg-[#C9A7FF26] border-[#C9A7FF]"
                              : "bg-[#D9C0FF26] border-[#D9C0FF]",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-lg",
                                isDark
                                  ? "bg-[#FFFFFF42] text-white"
                                  : "bg-[#D8C3FF] text-[#4A00BE]",
                              )}
                            >
                              <ListOrdered className="h-4 w-4" />
                            </div>
                            <div>
                              <span
                                className={cn(
                                  "text-sm font-semibold",
                                  isDark ? "text-white" : "text-slate-800",
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
                              "flex rounded-lg p-1 w-full sm:w-auto",
                              isDark
                                ? "bg-[#C9A7FF26]  border-[#C9A7FF]"
                                : "bg-[#D9C0FF26] border-[#D9C0FF]",
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
                              className={`text-xs px-3 py-1.5 transition-all duration-200 flex-1 sm:flex-none ${
                                leaderboardDisplayMode === "submission"
                                  ? isDark
                                    ? "bg-purple-600 text-white"
                                    : "bg-purple-500 text-white"
                                  : isDark
                                    ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                                    : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-current opacity-60" />
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
                              className={`text-xs px-3 py-1.5 transition-all duration-200 flex-1 sm:flex-none ${
                                leaderboardDisplayMode === "creator"
                                  ? isDark
                                    ? "bg-purple-600 text-white"
                                    : "bg-purple-500 text-white"
                                  : isDark
                                    ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                                    : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-current opacity-60" />
                                Creator Wise
                              </span>
                            </Button>
                          </div>
                        </div>
                      )}

                    {/* Logged-in User's Rank Card */}
                    {loadingMySubmission && (
                      <div className="text-center py-3">
                        <p>Loading your rank...</p>
                      </div>
                    )}
                    {(() => {
                      // Show best submission if user has multiple, otherwise show current leaderboard entry
                      const bestSubmission = getBestSubmission();
                      const displayEntry = bestSubmission || myLeaderboardEntry;

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
                          (myCreatorGroupOnPage as { total_earnings?: number })
                            ?.total_earnings ??
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
                              "overflow-hidden mb-6 border",
                              isDark
                                ? "border-[#C9A7FF] bg-[#000000]"
                                : "border-[#D9C0FF] bg-white",
                            )}
                          >
                            <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                              <div className="flex flex-1 items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                                <div
                                  className={cn(
                                    "flex flex-col items-center justify-center w-10 sm:w-12 flex-shrink-0 rounded-xl px-1 py-1.5 shadow-sm",
                                    isDark
                                      ? "bg-[#C9A7FF26] text-[#F5EBFF]"
                                      : "bg-[#D9C0FF40] text-[#4A00BE]",
                                  )}
                                >
                                  <div className="text-lg sm:text-xl font-extrabold leading-none tabular-nums">
                                    {isCreatorWiseMyCard
                                      ? (combinedRankForCard ?? "?")
                                      : bestSubmission
                                        ? typeof bestSubmission.rank ===
                                          "number"
                                          ? bestSubmission.rank
                                          : bestSubmission.status === "rejected"
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
                                        ? "border-white/15 shadow-[0_0_0_3px_rgba(201,167,255,0.08)]"
                                        : "border-violet-200 shadow-[0_0_0_3px_rgba(139,92,246,0.10)]",
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
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                    >
                                      {(contest?.platform === "twitter"
                                        ? ((displayEntry as any)
                                            .app_username as string | undefined)
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
                                          ? String(handleRaw).replace(/^@/, "")
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
                                              title={displayName || undefined}
                                            >
                                              {displayName || "You"}
                                            </p>
                                            {!isTwitter && (
                                              <span
                                                className={cn(
                                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border shrink-0",
                                                  isDark
                                                    ? "bg-white/[0.06] border-white/10 text-violet-100"
                                                    : "bg-violet-50 border-violet-100 text-violet-700",
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
                                                    ? "text-fuchsia-200/80"
                                                    : "text-violet-600",
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
                                        displayEntry.status,
                                      )}
                                      {/* Show rejected badge for Twitter entries */}
                                      {contest?.platform === "twitter" &&
                                        (displayEntry as any)
                                          .moderation_status === "rejected" && (
                                          <Badge
                                            className="ml-2 bg-red-500 text-white text-xs"
                                            variant="destructive"
                                          >
                                            Rejected
                                          </Badge>
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
                                            .rejection_reason.length > 50 && (
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
                                        .moderation_status === "rejected" && (
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
                                        {isTwitterCard ? "Joined" : "Submitted"}
                                        : {formatTimeAgo(joinedAtForMyCard)}
                                      </p>
                                    )}
                                    {/* Twitter Metrics - Horizontal Layout - Hide for rejected entries */}
                                    {isTwitterCard &&
                                      (displayEntry as any)
                                        .total_eligible_tweets !== undefined &&
                                      !(
                                        (displayEntry as any)
                                          .moderation_status === "rejected"
                                      ) && (
                                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1">
                                          {[
                                            {
                                              Icon: FileText,
                                              iconClass: isDark
                                                ? "text-violet-300"
                                                : "text-violet-600",
                                              chipBg: isDark
                                                ? "bg-violet-500/10 border-violet-500/25"
                                                : "bg-violet-50 border-violet-100",
                                              text: `${(displayEntry as any).total_eligible_tweets || 0} Tweets`,
                                              title: `Tweets: ${(displayEntry as any).total_eligible_tweets || 0}`,
                                            },
                                            {
                                              Icon: Eye,
                                              iconClass: isDark
                                                ? "text-emerald-300"
                                                : "text-emerald-600",
                                              chipBg: isDark
                                                ? "bg-emerald-500/10 border-emerald-500/25"
                                                : "bg-emerald-50 border-emerald-100",
                                              text: `${((displayEntry as any).total_impressions || 0).toLocaleString()} Impressions`,
                                              title: `Impressions: ${((displayEntry as any).total_impressions || 0).toLocaleString()}`,
                                            },
                                            {
                                              Icon: ThumbsUp,
                                              iconClass: isDark
                                                ? "text-pink-300"
                                                : "text-pink-600",
                                              chipBg: isDark
                                                ? "bg-pink-500/10 border-pink-500/25"
                                                : "bg-pink-50 border-pink-100",
                                              text: `${(displayEntry as any).total_likes || 0} Likes`,
                                              title: `Likes: ${(displayEntry as any).total_likes || 0}`,
                                            },
                                            {
                                              Icon: RefreshCw,
                                              iconClass: isDark
                                                ? "text-teal-300"
                                                : "text-teal-600",
                                              chipBg: isDark
                                                ? "bg-teal-500/10 border-teal-500/25"
                                                : "bg-teal-50 border-teal-100",
                                              text: `${(displayEntry as any).total_retweets || 0} Retweets`,
                                              title: `Retweets: ${(displayEntry as any).total_retweets || 0}`,
                                            },
                                            {
                                              Icon: MessageCircle,
                                              iconClass: isDark
                                                ? "text-sky-300"
                                                : "text-sky-600",
                                              chipBg: isDark
                                                ? "bg-sky-500/10 border-sky-500/25"
                                                : "bg-sky-50 border-sky-100",
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
                                      isDark ? "text-white" : "text-gray-900",
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
                                {(() : React.ReactNode => {
                                  // Don't show winning zone for rejected entries
                                  if (
                                    contest?.platform === "twitter" &&
                                    (displayEntry as any).moderation_status ===
                                      "rejected"
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
                                      !isCpmContestType(contest?.contest_type);
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

                                    const flatFeeBonus =
                                      isCpmContestType(contestType)
                                        ? (
                                            contest.contest_based_details as any
                                          )?.cpm_contest?.flat_fee_bonus || 0
                                        : (
                                            contest.contest_based_details as any
                                          )?.leaderboard_contest?.flat_fee_bonus ||
                                          0;

                                    const hasPayoutsProcessedMyCard =
                                      contest?.status === "ended" &&
                                      contest?.post_contest_status ===
                                        "payouts_processed";
                                    const creatorBonusPaidTotalMyCard = Number(
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
                                      leaderboardDisplayMode === "submission" &&
                                      !isCreatorWiseMyCard &&
                                      Boolean(bestSubmission) &&
                                      Boolean(myLeaderboardEntry) &&
                                      bestSubmission?.id !== myLeaderboardEntry?.id;

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
                                              {formatMoney(effectiveBonusAmount)}{" "}
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
                                    contest.contest_type === "leaderboard" &&
                                    Array.isArray(
                                      contest.contest_based_details
                                        ?.leaderboard_contest?.prizes,
                                    ) &&
                                    prizeRankForZone != null
                                  ) {
                                    const prizeInfo = (
                                      contest.contest_based_details
                                        .leaderboard_contest
                                        .prizes as PrizeInfo[]
                                    ).find(
                                      (p) => p.position === prizeRankForZone,
                                    );
                                    if (prizeInfo) {
                                      const prizeText =
                                        contest.status === "active"
                                          ? "Winning Zone"
                                          : "Prize";

                                      // Check for flat fee bonus in detailed mode
                                      if (leaderboardViewMode === "detailed") {
                                        const flatFeeBonus =
                                          (contest.contest_based_details as any)
                                            ?.leaderboard_contest
                                            ?.flat_fee_bonus || 0;

                                        if (flatFeeBonus > 0) {
                                          const totalEarnings =
                                            prizeInfo.amount + flatFeeBonus;
                                          prizeDisplay = (
                                            <div className="font-semibold text-purple-500 dark:text-purple-400 flex items-center">
                                              <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                              <div>
                                                <div>
                                                  {prizeText}:{" "}
                                                  {formatMoney(totalEarnings)}
                                                </div>
                                                <div className="text-xs text-purple-600 dark:text-purple-500">
                                                  (
                                                  {formatMoney(
                                                    prizeInfo.amount,
                                                  )}{" "}
                                                  Prize +{" "}
                                                  {formatMoney(flatFeeBonus)}{" "}
                                                  Bonus)
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        } else {
                                          prizeDisplay = (
                                            <span className="font-semibold text-purple-500 dark:text-purple-400 flex items-center">
                                              <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                              {prizeText}:{" "}
                                              {formatMoney(prizeInfo.amount)}
                                            </span>
                                          );
                                        }
                                      } else {
                                        // Simple view - show total if bonus exists
                                        const flatFeeBonus =
                                          (contest.contest_based_details as any)
                                            ?.leaderboard_contest
                                            ?.flat_fee_bonus || 0;
                                        const totalEarnings =
                                          prizeInfo.amount + flatFeeBonus;

                                        prizeDisplay = (
                                          <span className="font-semibold text-purple-500 dark:text-purple-400 flex items-center">
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
                                                  ? "bg-[#170337]"
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
                                                      ? "bg-purple-600 text-white"
                                                      : "bg-purple-500 text-white"
                                                    : isDark
                                                      ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                                                      : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
                                                }`}
                                              >
                                                Simple
                                              </Button>
                                              <Button
                                                variant={
                                                  modalViewMode === "detailed"
                                                    ? "default"
                                                    : "ghost"
                                                }
                                                size="sm"
                                                onClick={() =>
                                                  setModalViewMode("detailed")
                                                }
                                                className={`text-xs px-3 py-1.5 transition-all duration-200 ${
                                                  modalViewMode === "detailed"
                                                    ? isDark
                                                      ? "bg-purple-600 text-white"
                                                      : "bg-purple-500 text-white"
                                                    : isDark
                                                      ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                                                      : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
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
                                                  if (submission.earnings > 0) {
                                                    const isTwitter =
                                                      contest?.platform ===
                                                        "twitter" ||
                                                      contest?.platform === "x";
                                                    const isEarned =
                                                      submission.status ===
                                                        "verified" ||
                                                      submission.status ===
                                                        "paid" ||
                                                      (isTwitter &&
                                                        ((submission as any)
                                                          .moderation_status ===
                                                          "paid" ||
                                                          (submission as any)
                                                            .paid === true ||
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
                                                      isCpmContestType(contestType)
                                                        ? (
                                                            contest.contest_based_details as any
                                                          )?.cpm_contest
                                                            ?.flat_fee_bonus ||
                                                          0
                                                        : (
                                                            contest.contest_based_details as any
                                                          )?.leaderboard_contest
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
                                                          {actualRank != null
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
                                                              submission.status,
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
                                                const totalPages = Math.ceil(
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
                                                        modalCurrentPage === 1
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
                                                          if (totalPages <= 5) {
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
                        isRefreshingMetrics || twitterMetricsRunActive;
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
                            "flex flex-col gap-2 p-3.5 sm:p-4 rounded-xl border shadow-sm mb-3",
                            isDark
                              ? "bg-gradient-to-b from-[#1a0a3d]/90 to-[#180438] border-white/10"
                              : "bg-gradient-to-b from-white to-purple-50/35 border-gray-200/90",
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
                                    : isDark
                                      ? "bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.6)]"
                                      : "bg-purple-500",
                                )}
                                aria-hidden
                              />
                              <h3
                                className={cn(
                                  "text-base sm:text-lg font-bold tracking-tight",
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

                          <div className="flex flex-row items-center justify-between gap-3 pt-0.5">
                            <p
                              className={cn(
                                "text-xs font-medium min-w-0 flex-1",
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
                                "shrink-0 h-9 px-3 sm:px-4 rounded-lg font-medium gap-2 border-2 transition-all w-auto",
                                isDark
                                  ? "border-purple-400/40 text-purple-100 hover:bg-purple-950/50 hover:border-purple-400/60"
                                  : "border-purple-400/50 text-purple-700 hover:bg-purple-50 hover:border-purple-500",
                                isDisabled &&
                                  "opacity-55 cursor-not-allowed hover:bg-transparent",
                                isButtonBusy &&
                                  (isDark
                                    ? "border-purple-400/50 bg-purple-950/30"
                                    : "border-purple-500/60 bg-purple-50/80"),
                              )}
                              title={refreshTitle}
                            >
                              {isButtonBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              ) : (
                                <RefreshCw className="h-4 w-4 shrink-0" />
                              )}
                              <span className="truncate hidden sm:inline">
                                {isButtonBusy ? "Updating..." : idleLabelLarge}
                              </span>
                              <span className="truncate sm:hidden">
                                {isButtonBusy ? "Updating…" : idleLabelSmall}
                              </span>
                            </Button>
                          </div>

                          {isButtonBusy && isTwitterLeaderboardRefresh ? (
                            <div
                              className={cn(
                                "mt-2 space-y-1.5 border-t pt-3",
                                isDark
                                  ? "border-white/10"
                                  : "border-slate-200/80",
                              )}
                            >
                              <div
                                className={cn(
                                  "flex items-center justify-between gap-2 text-[11px]",
                                  isDark ? "text-gray-400" : "text-gray-600",
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
                                    isDark
                                      ? "text-fuchsia-200"
                                      : "text-purple-600",
                                  )}
                                >
                                  {busyPct}%
                                </span>
                              </div>
                              <div
                                className={cn(
                                  "h-2 w-full rounded-full overflow-hidden",
                                  isDark ? "bg-white/10" : "bg-purple-100/80",
                                )}
                              >
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-[width] duration-300 ease-out shadow-sm",
                                    isDark
                                      ? "bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400"
                                      : "bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500",
                                  )}
                                  style={{ width: `${busyPct}%` }}
                                />
                              </div>
                              <p
                                className={cn(
                                  "text-[10px] hidden sm:block",
                                  isDark ? "text-gray-500" : "text-gray-500",
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
                                      group.creator_id === selectedCreatorId,
                                  );
                                return creatorGroup
                                  ? `All Videos by ${(creatorGroup as any).user_platform_username ?? creatorGroup.creator_username}`
                                  : "Creator Videos";
                              })()}
                            </DialogTitle>

                            {/* Summary Cards */}
                            {(() => {
                              if (loadingCreatorVideosModal) return null;
                              if (!isMilestoneContestType(contest?.contest_type))
                                return null;
                              
                              const isTwitter = contest?.platform?.toLowerCase() === "twitter" || contest?.platform?.toLowerCase() === "x";
                              
                              const verifiedVideos = getCreatorVideos.filter(v => 
                                v.status === 'verified' || 
                                v.status === 'paid' ||
                                (isTwitter && ((v as any).moderation_status === 'paid' || (v as any).paid === true))
                              );
                              const pendingVideos = getCreatorVideos.filter(v => v.status === 'pending');
                              
                              const vReels = verifiedVideos.length;
                              const vViews = verifiedVideos.reduce((sum, v) => sum + (v.views || 0), 0);
                              
                              const pReels = pendingVideos.length;
                              const pViews = pendingVideos.reduce((sum, v) => sum + (v.views || 0), 0);
                              
                              const totalReels = vReels + pReels;
                              const totalViews = vViews + pViews;

                              return (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full">
                                  {/* Verified Reels */}
                                  <div className={cn(
                                    "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                    isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50/50 border-emerald-100"
                                  )}>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      <span className={cn("text-[9px] uppercase tracking-wider font-bold", isDark ? "text-emerald-400/80" : "text-emerald-600")}>
                                        Verified Reels
                                      </span>
                                    </div>
                                    <div className={cn("text-base font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                                      {vReels}
                                    </div>
                                  </div>

                                  {/* Verified Views */}
                                  <div className={cn(
                                    "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                    isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50/50 border-emerald-100"
                                  )}>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <Eye className="h-3 w-3 text-emerald-500" />
                                      <span className={cn("text-[9px] uppercase tracking-wider font-bold", isDark ? "text-emerald-400/80" : "text-emerald-600")}>
                                        Verified Views
                                      </span>
                                    </div>
                                    <div className={cn("text-base font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                                      {vViews.toLocaleString()}
                                    </div>
                                  </div>

                                  {/* Pending Reels */}
                                  <div className={cn(
                                    "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                    isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50/50 border-amber-100"
                                  )}>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <Clock className="h-3 w-3 text-amber-500" />
                                      <span className={cn("text-[9px] uppercase tracking-wider font-bold", isDark ? "text-amber-400/80" : "text-amber-600")}>
                                        Pending Reels
                                      </span>
                                    </div>
                                    <div className={cn("text-base font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                                      {pReels}
                                    </div>
                                  </div>

                                  {/* Pending Views */}
                                  <div className={cn(
                                    "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                    isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50/50 border-amber-100"
                                  )}>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <TrendingUp className="h-3 w-3 text-amber-500" />
                                      <span className={cn("text-[9px] uppercase tracking-wider font-bold", isDark ? "text-amber-400/80" : "text-amber-600")}>
                                        Pending Views
                                      </span>
                                    </div>
                                    <div className={cn("text-base font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                                      {pViews.toLocaleString()}
                                    </div>
                                  </div>

                                  {/* All Reels */}
                                  <div className={cn(
                                    "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                    isDark ? "bg-blue-500/5 border-blue-500/20" : "bg-blue-50/50 border-blue-100"
                                  )}>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <Video className="h-3 w-3 text-blue-500" />
                                      <span className={cn("text-[9px] uppercase tracking-wider font-bold", isDark ? "text-blue-400/80" : "text-blue-600")}>
                                        All Reels
                                      </span>
                                    </div>
                                    <div className={cn("text-base font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                                      {totalReels}
                                    </div>
                                  </div>

                                  {/* All Views */}
                                  <div className={cn(
                                    "flex flex-col p-2 rounded-lg border shadow-sm transition-all duration-200",
                                    isDark ? "bg-blue-500/5 border-blue-500/20" : "bg-blue-50/50 border-blue-100"
                                  )}>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <BarChart3 className="h-3 w-3 text-blue-500" />
                                      <span className={cn("text-[9px] uppercase tracking-wider font-bold", isDark ? "text-blue-400/80" : "text-blue-600")}>
                                        All Views
                                      </span>
                                    </div>
                                    <div className={cn("text-base font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
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
                                  isDark ? "text-gray-400" : "text-gray-600",
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
                                    const modalRank = startIndex + index + 1;
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
                                          ((video as any).moderation_status ===
                                            "paid" ||
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
                                          (contest.contest_based_details as any)
                                            ?.cpm_contest?.flat_fee_bonus || 0;

                                        // Calculate total earnings (CPM + Bonus if applicable)
                                        const totalEarnings =
                                          video.earnings + flatFeeBonus;

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
                                                  {formatMoney(video.earnings)}{" "}
                                                  CPM
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
                                                  {formatMoney(totalEarnings)}
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
                                                    {formatMoney(bonusAmount)}{" "}
                                                    Bonus
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          } else {
                                            prizeDisplay = (
                                              <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                                {earningsLabel}:{" "}
                                                {formatMoney(video.earnings)}
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
                                      contest.contest_type === "leaderboard" &&
                                      Array.isArray(
                                        contest.contest_based_details
                                          ?.leaderboard_contest?.prizes,
                                      )
                                    ) {
                                      const prizeInfo = actualRank
                                        ? (
                                            contest.contest_based_details
                                              .leaderboard_contest
                                              .prizes as PrizeInfo[]
                                          ).find(
                                            (p) => p.position === actualRank,
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
                                              prizeInfo.amount + flatFeeBonus;
                                            prizeDisplay = (
                                              <div
                                                className={`font-semibold flex items-center ${"text-purple-500 dark:text-purple-400"}`}
                                              >
                                                <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                                <div>
                                                  <div>
                                                    {prizeText}:{" "}
                                                    {formatMoney(totalEarnings)}
                                                  </div>
                                                  <div className="text-xs text-purple-600 dark:text-purple-500">
                                                    (
                                                    {formatMoney(
                                                      prizeInfo.amount,
                                                    )}{" "}
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
                                                className={`font-semibold flex items-center ${"text-purple-500 dark:text-purple-400"}`}
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
                                              className={`font-semibold flex items-center ${"text-purple-500 dark:text-purple-400"}`}
                                            >
                                              <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                              {prizeText}:{" "}
                                              {formatMoney(prizeInfo.amount)}
                                            </span>
                                          );
                                        }
                                      }
                                    }

                                    return (
                                      <div
                                        key={video.id}
                                        className="border border-[#D1B7F9] rounded-xl overflow-hidden"
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
                                              <AvatarFallback className="bg-violet-100 text-violet-600 font-semibold text-xs sm:text-base">
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
                                                {renderVerificationBadges(
                                                  video.status,
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
                                          setCreatorVideosCurrentPage((prev) =>
                                            Math.max(1, prev - 1),
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
                                          setCreatorVideosCurrentPage((prev) =>
                                            Math.min(totalPages, prev + 1),
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
                          "border rounded-lg p-3 mb-4",
                          isDark
                            ? "bg-blue-700/30 border-blue-700/50"
                            : "bg-blue-50 border-blue-200",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
                              isDark
                                ? "bg-blue-500/30 text-white"
                                : "bg-blue-100 text-blue-600",
                            )}
                          >
                            <Info className="w-3 h-3" />
                          </div>
                          <div className="flex-1">
                            <p
                              className={cn(
                                "text-md font-medium",
                                isDark ? "text-white" : "text-blue-900",
                              )}
                            >
                              Leaderboard Display
                            </p>
                            <div
                              className={cn(
                                "text-sm mt-1 space-y-1",
                                isDark ? "text-gray-300" : "text-blue-700",
                              )}
                            >
                              <p>
                                Only non-rejected submissions are shown in the
                                leaderboard.
                                {contest?.multiple_submissions_enabled &&
                                  leaderboardDisplayMode === "creator" &&
                                  " Currently viewing by creator (all submissions grouped)."}
                              </p>
                              {contest?.live_submission_count !== null &&
                                contest?.live_submission_count !==
                                  undefined && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="font-medium">
                                      {leaderboardDisplayMode === "creator" &&
                                      creatorWiseLeaderboard.length > 0
                                        ? "Creators:"
                                        : "Submissions:"}
                                    </span>
                                    <span className="text-green-700 font-semibold">
                                      {effectiveLeaderboardTotalEntries} active
                                    </span>
                                    {contest.live_submission_count !==
                                      effectiveLeaderboardTotalEntries &&
                                      !(
                                        leaderboardDisplayMode === "creator" &&
                                        creatorWiseLeaderboard.length > 0
                                      ) && (
                                        <>
                                          <span
                                            className={cn(
                                              "text-blue-600",
                                              isDark
                                                ? "text-gray-400"
                                                : "text-blue-700",
                                            )}
                                          >
                                            |
                                          </span>
                                          <span className="text-red-700 font-semibold">
                                            {contest.live_submission_count -
                                              effectiveLeaderboardTotalEntries}{" "}
                                            rejected
                                          </span>
                                          <span
                                            className={cn(
                                              "text-blue-600",
                                              isDark
                                                ? "text-gray-400"
                                                : "text-blue-700",
                                            )}
                                          >
                                            |
                                          </span>
                                          <span
                                            className={cn(
                                              "text-blue-700",
                                              isDark
                                                ? "text-gray-400"
                                                : "text-blue-700",
                                            )}
                                          >
                                            {contest.live_submission_count}{" "}
                                            total
                                          </span>
                                        </>
                                      )}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Render leaderboard based on display mode */}
                    {leaderboardDisplayMode === "creator" &&
                    groupedLeaderboardByCreator
                      ? // Creator-wise display
                        groupedLeaderboardByCreator.map(
                          (creatorGroup, index) => {
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
                                  (sum, [, count]) => sum + (count as number),
                                  0,
                                );
                              rank = creatorOffset + index + 1;
                            }
                            let prizeDisplay = null;
                            let milestoneCreatorExpectedDisplay: React.ReactNode =
                              null;
                            const isMilestoneContest = isMilestoneContestType(
                              contest?.contest_type,
                            );
                            const isTwitter =
                              contest?.platform === "twitter" ||
                              contest?.platform === "x";

                             const contestStatus = contest?.status;
                             const postContestStatus = contest?.post_contest_status;
                             const isLeaderboardContest = contest?.contest_type === "leaderboard";
                             const hasPayoutsProcessed = contestStatus === "ended" && postContestStatus === "payouts_processed";

                             const hasPaidSubmission =
                               (creatorGroup as any).has_paid_submission === true ||
                               creatorGroup.submissions.some((submission: any) => {
                                 const ex =
                                   submission?.granted_amount_cents ??
                                   submission?.paid_amount_cents ??
                                   submission?.other_stats?.paid_amount_cents ??
                                   submission?.other_stats?.granted_amount_cents;
                                 return (
                                   submission.status === "paid" ||
                                   submission.paid === true ||
                                   Boolean(submission?.paid_at) ||
                                   (ex != null && Number(ex) > 0)
                                 );
                               });

                             const twitterPaid = isTwitter && (creatorGroup as any).paid === true;
                             const shouldShowActualEarnings = hasPaidSubmission || twitterPaid || (isTwitter && hasPayoutsProcessed);

                             const earningsLabel = shouldShowActualEarnings
                               ? isTwitter && (hasPayoutsProcessed || twitterPaid)
                                 ? "Paid"
                                 : "Earned"
                               : isMilestoneContest
                                 ? "Earned"
                                 : contestStatus === "active" && isLeaderboardContest
                                   ? "Winning Zone"
                                   : "Expected";

                             // Calculate total earnings including bonuses
                             const flatFeeBonus =
                               isCpmContestType(contestType)
                                 ? (contest.contest_based_details as any)
                                     ?.cpm_contest?.flat_fee_bonus || 0
                                 : (contest.contest_based_details as any)
                                     ?.leaderboard_contest?.flat_fee_bonus || 0;

                             const totalEarnings =
                               creatorGroup.total_earnings +
                               flatFeeBonus * creatorGroup.submission_count;

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
                                  submission?.other_stats?.paid_amount_cents ??
                                  submission?.other_stats?.granted_amount_cents;
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
                                  milestoneEarnedAmount - milestoneBonusTotal;

                                prizeDisplay = (
                                  <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                    <div className="flex flex-col items-end">
                                      <span>
                                        {earningsLabel}:{" "}
                                        {formatMoney(milestoneEarnedAmount)}
                                      </span>
                                      {leaderboardViewMode === "detailed" &&
                                        milestoneBonusTotal > 0 && (
                                          <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md border border-green-200 dark:border-green-800 mt-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                            <span className="whitespace-nowrap">
                                              {formatMoney(milestoneBaseAmount)}{" "}
                                              Milestone
                                            </span>
                                            <span className="text-green-600 dark:text-green-400">
                                              +
                                            </span>
                                            <span className="whitespace-nowrap">
                                              {formatMoney(milestoneBonusTotal)}{" "}
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
                                      {mostVerifiedViewsBonusGranted > 0 && (
                                        <div 
                                          className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-sm whitespace-nowrap cursor-help",
                                            isDark 
                                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5" 
                                              : "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-200/20"
                                          )}
                                          title="You have achieved the highest number of verified views among all creators in this contest."
                                        >
                                          <Trophy className="h-3 w-3" />
                                          <span>MOST VIEWS BONUS WINNER: {formatMoney(mostVerifiedViewsBonusGranted)}</span>
                                        </div>
                                      )}
                                      {mostVerifiedReelsBonusGranted > 0 && (
                                        <div 
                                          className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-sm whitespace-nowrap cursor-help",
                                            isDark 
                                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5" 
                                              : "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-200/20"
                                          )}
                                          title="You have achieved the highest number of verified reels among all creators in this contest."
                                        >
                                          <Video className="h-3 w-3" />
                                          <span>MOST REELS BONUS WINNER: {formatMoney(mostVerifiedReelsBonusGranted)}</span>
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
                                            : "bg-amber-50 border-amber-200 text-amber-700 shadow-amber-200/20"
                                        )}
                                        title="You currently have the highest number of verified views. You will win this bonus if you maintain this lead until the contest ends."
                                      >
                                        <TrendingUp className="h-3 w-3" />
                                        <span>MOST VERIFIED VIEWS BONUS (EXPECTED): {formatMoney(mostVerifiedViewsBonus)}</span>
                                      </div>
                                    )}
                                    {mostVerifiedReelsBonus > 0 && (
                                      <div 
                                        className={cn(
                                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-sm whitespace-nowrap cursor-help",
                                          isDark 
                                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/5" 
                                            : "bg-amber-50 border-amber-200 text-amber-700 shadow-amber-200/20"
                                        )}
                                        title="You currently have the highest number of verified reels. You will win this bonus if you maintain this lead until the contest ends."
                                      >
                                        <Video className="h-3 w-3" />
                                        <span>MOST VERIFIED REELS BONUS (EXPECTED): {formatMoney(mostVerifiedReelsBonus)}</span>
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
                                          Bonus ({creatorGroup.submission_count}{" "}
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
                                Array.isArray(
                                  contest.contest_based_details
                                    ?.leaderboard_contest?.prizes,
                                )
                              ) {
                                const prizes = contest.contest_based_details
                                  .leaderboard_contest.prizes as PrizeInfo[];
                                // Sum prize for each of this creator's submissions
                                const submissionRanks = (
                                  creatorGroup as {
                                    submission_ranks?: number[];
                                  }
                                ).submission_ranks ?? [creatorGroup.best_rank];
                                let totalPrizeAmount = 0;
                                for (const rank of submissionRanks) {
                                  const info = prizes.find(
                                    (p) => p.position === rank,
                                  );
                                  if (info) totalPrizeAmount += info.amount;
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
                                          className={`font-semibold text-base flex items-center ${"text-purple-500 dark:text-purple-400"}`}
                                        >
                                          <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                          {prizeText}: {formatMoney(totalPrize)}
                                        </div>
                                        <div className="text-xs text-purple-600 dark:text-purple-500">
                                          ({formatMoney(totalPrizeAmount)} Prize
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
                                        className={`font-semibold flex items-center ${"text-purple-500 dark:text-purple-400"}`}
                                      >
                                        <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                        {prizeText}: {formatMoney(totalPrize)}
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
                              : ((creatorGroup as any).user_platform_username ??
                                creatorGroup.creator_username);
                            const twitterHandleRaw =
                              (creatorGroup as any).app_username ??
                              (creatorGroup as any).user_platform_username ??
                              creatorGroup.creator_username;
                            const twitterHandle = twitterHandleRaw
                              ? String(twitterHandleRaw).replace(/^@/, "")
                              : "";
                            const showTwitterHandle =
                              isTwitter &&
                              twitterHandle &&
                              twitterDisplayName
                                .replace(/^@/, "")
                                .toLowerCase() !== twitterHandle.toLowerCase();

                            return (
                              <div
                                key={creatorGroup.creator_id}
                                className={cn(
                                  "group relative overflow-hidden border transition-all duration-200",
                                  isTwitter
                                    ? cn(
                                        "rounded-2xl hover:shadow-lg hover:border-violet-400/45",
                                        isDark
                                          ? "bg-gradient-to-br from-[#1f0d45]/95 to-[#180438] border-white/10 shadow-md shadow-black/25"
                                          : "bg-gradient-to-br from-white via-white to-violet-50/60 border-violet-200/85 shadow-sm",
                                      )
                                    : cn(
                                        "rounded-xl hover:border-slate-300/80",
                                        isDark
                                          ? "bg-[#170337] border-slate-600/70"
                                          : "bg-white border-slate-200/90 shadow-sm",
                                      ),
                                )}
                              >
                                <CardContent className="p-3 sm:p-4">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:justify-between">
                                    <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-3">
                                      <div
                                        className={cn(
                                          "flex shrink-0 items-center justify-center rounded-lg font-semibold tabular-nums",
                                          isTwitter
                                            ? cn(
                                                "h-11 w-11 sm:h-12 sm:w-12 text-sm sm:text-base",
                                                rank === 1 &&
                                                  (isDark
                                                    ? "bg-gradient-to-br from-amber-500/30 to-amber-800/20 text-amber-100 ring-1 ring-amber-400/50"
                                                    : "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-950 ring-1 ring-amber-300/70 shadow-sm"),
                                                rank === 2 &&
                                                  (isDark
                                                    ? "bg-gradient-to-br from-slate-400/25 to-slate-700/15 text-slate-100 ring-1 ring-slate-400/40"
                                                    : "bg-gradient-to-br from-slate-100 to-white text-slate-800 ring-1 ring-slate-300/70 shadow-sm"),
                                                rank === 3 &&
                                                  (isDark
                                                    ? "bg-gradient-to-br from-orange-500/28 to-amber-900/20 text-orange-100 ring-1 ring-orange-400/45"
                                                    : "bg-gradient-to-br from-orange-100 to-amber-50 text-orange-950 ring-1 ring-orange-300/65 shadow-sm"),
                                                rank > 3 &&
                                                  (isDark
                                                    ? "bg-white/[0.06] text-slate-400 ring-1 ring-white/10"
                                                    : "bg-violet-50/90 text-slate-600 ring-1 ring-violet-100"),
                                              )
                                            : cn(
                                                "h-8 w-8 text-sm",
                                                isDark
                                                  ? "text-slate-400"
                                                  : "text-slate-500",
                                              ),
                                        )}
                                        title={`Rank ${rank}`}
                                      >
                                        {rank}
                                      </div>
                                      <Avatar
                                        className={cn(
                                          "shrink-0 transition-all duration-200",
                                          isTwitter
                                            ? cn(
                                                "h-11 w-11 sm:h-12 sm:w-12 border-2",
                                                isDark
                                                  ? "border-white/15 group-hover:border-fuchsia-400/50 group-hover:shadow-[0_0_0_3px_rgba(232,121,249,0.15)]"
                                                  : "border-violet-100 group-hover:border-violet-300 group-hover:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]",
                                              )
                                            : cn(
                                                "h-10 w-10 sm:h-11 sm:w-11 border",
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
                                            "font-semibold text-xs sm:text-sm",
                                            isTwitter
                                              ? isDark
                                                ? "bg-fuchsia-950/50 text-fuchsia-200"
                                                : "bg-violet-100 text-violet-700"
                                              : isDark
                                                ? "bg-slate-700/50 text-slate-200"
                                                : "bg-violet-50 text-violet-700",
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
                                          <div className="flex items-start justify-between gap-2 min-w-0">
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
                                          </div>

                                          {showTwitterHandle ? (
                                            <p
                                              className={cn(
                                                "text-xs font-medium truncate mt-0.5",
                                                isDark
                                                  ? "text-fuchsia-300/90"
                                                  : "text-violet-600",
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
                                                  ? "text-violet-300"
                                                  : "text-violet-600",
                                                chipBg: isDark
                                                  ? "bg-violet-500/10 border-violet-500/25"
                                                  : "bg-violet-50 border-violet-100",
                                                text: String(
                                                  (creatorGroup as any)
                                                    .total_eligible_tweets || 0,
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
                                                      .total_impressions || 0
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
                                              {creatorGroup.submission_count}{" "}
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
                                          : "border-violet-100",
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
                                              setShowCreatorVideosModal(true);
                                              setCreatorVideosCurrentPage(1);
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
                                            {milestoneCreatorExpectedDisplay}
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
                          const rank =
                            (leaderboardCurrentPage - 1) *
                              leaderboardItemsPerPage +
                            index +
                            1;
                          let prizeDisplay = null;
                          const isMilestoneContest = isMilestoneContestType(
                            contest?.contest_type,
                          );

                          if (isMilestoneContest) {
                            const hasPayoutsProcessed =
                              contest?.post_contest_status ===
                              "payouts_processed";
                            const milestoneTrackBonusesPaidCents =
                              (Number((entry as any).milestone_bonus_paid?.views) ||
                                0) +
                              (Number((entry as any).milestone_bonus_paid?.reels) ||
                                0);
                            const explicitBonusPaidAmount =
                              (entry as any).bonus_amount ??
                              (entry as any).other_stats?.bonus_amount;
                            const explicitPaidAmount =
                              (entry as any).granted_amount_cents ??
                              (entry as any).paid_amount_cents ??
                              (entry as any).other_stats?.paid_amount_cents ??
                              (entry as any).other_stats?.granted_amount_cents;
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
                                          {formatMoney(submissionEarnedCents)}{" "}
                                          Milestone
                                        </span>
                                        <span className="text-green-600 dark:text-green-400">
                                          +
                                        </span>
                                      </>
                                    ) : null}
                                    <span className="whitespace-nowrap">
                                      {formatMoney(totalBonusCents)} Bonus
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
                                    ?.leaderboard_contest?.flat_fee_bonus || 0;

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
                                          {formatMoney(entry.earnings)} Prize
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
                              contest.contest_based_details?.leaderboard_contest
                                ?.prizes,
                            )
                          ) {
                            const prizeInfo = (
                              contest.contest_based_details.leaderboard_contest
                                .prizes as PrizeInfo[]
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
                                    ?.leaderboard_contest?.flat_fee_bonus || 0;

                                if (flatFeeBonus > 0 || (isMilestoneContestType(contestType) && (milestoneDerivedData.creatorMostVerifiedViewsBonusMap.get(String(myLeaderboardEntry?.creator_id || "")) || 0) + (milestoneDerivedData.creatorMostVerifiedReelsBonusMap.get(String(myLeaderboardEntry?.creator_id || "")) || 0) > 0)) {
                                  const totalEarnings =
                                    prizeInfo.amount + flatFeeBonus;
                                  prizeDisplay = (
                                    <div
                                      className={`font-semibold flex items-center ${"text-purple-500 dark:text-purple-400"}`}
                                    >
                                      <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                      <div>
                                        <div>
                                          {prizeText}:{" "}
                                          {formatMoney(totalEarnings)}
                                        </div>
                                        <div className="text-xs text-purple-600 dark:text-purple-500">
                                          ({formatMoney(prizeInfo.amount)} Prize
                                          + {formatMoney(flatFeeBonus)} Bonus)
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  prizeDisplay = (
                                    <span
                                      className={`font-semibold flex items-center ${"text-purple-500 dark:text-purple-400"}`}
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
                                    className={`font-semibold flex items-center ${"text-purple-500 dark:text-purple-400"}`}
                                  >
                                    <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                    {prizeText}: {formatMoney(prizeInfo.amount)}
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
                                "rounded-xl overflow-hidden border",
                                entryIsTwitter
                                  ? "border-[#D1B7F9]"
                                  : isDark
                                    ? "border-slate-600/70 bg-[#170337]"
                                    : "border-slate-200/90 bg-white shadow-sm",
                              )}
                            >
                              <CardContent className="p-3.5 sm:p-4">
                                <div className="flex items-center gap-3 sm:gap-3.5">
                                  <div
                                    className={cn(
                                      "w-7 shrink-0 pt-0.5 text-center text-sm font-semibold tabular-nums",
                                      entryIsTwitter
                                        ? isDark
                                          ? "text-slate-400"
                                          : "text-slate-400"
                                        : isDark
                                          ? "text-slate-400"
                                          : "text-slate-500",
                                    )}
                                  >
                                    {rank}
                                  </div>
                                  <Avatar
                                    className={cn(
                                      "h-10 w-10 shrink-0 border sm:h-11 sm:w-11",
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
                                          ? "bg-slate-700/50 text-slate-200"
                                          : "bg-violet-50 text-violet-700",
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
                                        {renderVerificationBadges(entry.status)}
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
                                          "text-base font-semibold tabular-nums sm:text-lg leading-tight",
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

                    {/* Pagination Controls */}
                    {effectiveLeaderboardTotalPages > 1 && (
                      <div className="flex items-center justify-center space-x-4 py-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            fetchLeaderboard(
                              leaderboardCurrentPage - 1,
                              contest?.platform?.toLowerCase() !== "twitter" &&
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
                              contest?.platform?.toLowerCase() !== "twitter" &&
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
                    if (actionKind === "retweet") metrics.total_retweets += 1;
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
                              (s: any) => getAnalyticsStatus(s) !== "rejected",
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
                              (s: any) => getAnalyticsStatus(s) === "verified",
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
                              (s: any) => getAnalyticsStatus(s) === "pending",
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
                              (s: any) => getAnalyticsStatus(s) === "rejected",
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
                            {allSubmissionsForAnalytics?.filter((s: any) => {
                              const status = getAnalyticsStatus(s);
                              return status === "verified" || status === "paid";
                            }).length || 0}
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
                            No analytics data available yet. Data will appear
                            once tweets are submitted.
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
                                                "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                                isDark
                                                  ? "bg-[#170337]"
                                                  : "bg-white border border-slate-200",
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
                                                      "text-sm font-semibold uppercase tracking-wide",
                                                      isDark
                                                        ? "text-slate-200"
                                                        : "text-slate-600",
                                                    )}
                                                  >
                                                    Target Likes
                                                  </p>
                                                  <p
                                                    className={cn(
                                                      "text-2xl font-black",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-800",
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
                                                  : "bg-white border border-slate-200",
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
                                                      "text-sm font-semibold uppercase tracking-wide",
                                                      isDark
                                                        ? "text-slate-200"
                                                        : "text-slate-600",
                                                    )}
                                                  >
                                                    Target Comments
                                                  </p>
                                                  <p
                                                    className={cn(
                                                      "text-2xl font-black",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-800",
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
                                                  : "bg-white border border-slate-200",
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
                                                      "text-sm font-semibold uppercase tracking-wide",
                                                      isDark
                                                        ? "text-slate-200"
                                                        : "text-slate-600",
                                                    )}
                                                  >
                                                    Target Retweets
                                                  </p>
                                                  <p
                                                    className={cn(
                                                      "text-2xl font-black",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-800",
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
                                                  : "bg-white border border-slate-200",
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
                                                      "text-sm font-semibold uppercase tracking-wide",
                                                      isDark
                                                        ? "text-slate-200"
                                                        : "text-slate-600",
                                                    )}
                                                  >
                                                    Target Quote Reposts
                                                  </p>
                                                  <p
                                                    className={cn(
                                                      "text-2xl font-black",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-slate-800",
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
                                                    (current / target) * 100,
                                                  )
                                                : 0;

                                            return (
                                              <div
                                                className={cn(
                                                  "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                                  isDark
                                                    ? "bg-[#170337]"
                                                    : "bg-white border border-slate-200",
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
                                                          "text-2xl font-black",
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
                                                          ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                                          : "bg-gradient-to-br from-pink-500 to-rose-600",
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
                                                                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                                                : "bg-gradient-to-r from-pink-500 to-rose-600",
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
                                                          {progress.toFixed(0)}%
                                                          complete
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
                                                    (current / target) * 100,
                                                  )
                                                : 0;

                                            return (
                                              <div
                                                className={cn(
                                                  "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                                  isDark
                                                    ? "bg-[#170337]"
                                                    : "bg-white border border-slate-200",
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
                                                          "text-2xl font-black",
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
                                                          ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                                          : "bg-gradient-to-br from-orange-500 to-amber-600",
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
                                                                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                                                : "bg-gradient-to-r from-orange-500 to-amber-600",
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
                                                          {progress.toFixed(0)}%
                                                          complete
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
                                                    (current / target) * 100,
                                                  )
                                                : 0;

                                            return (
                                              <div
                                                className={cn(
                                                  "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                                  isDark
                                                    ? "bg-[#170337]"
                                                    : "bg-white border border-slate-200",
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
                                                          "text-2xl font-black",
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
                                                          ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                                          : "bg-gradient-to-br from-cyan-500 to-teal-600",
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
                                                                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                                                : "bg-gradient-to-r from-cyan-500 to-teal-600",
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
                                                          {progress.toFixed(0)}%
                                                          complete
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
                                            const target = targetQuoteReposts;
                                            const isReached =
                                              target !== null &&
                                              current >= target;
                                            const progress =
                                              target !== null && target > 0
                                                ? Math.min(
                                                    100,
                                                    (current / target) * 100,
                                                  )
                                                : 0;

                                            return (
                                              <div
                                                className={cn(
                                                  "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",
                                                  isDark
                                                    ? "bg-[#170337]"
                                                    : "bg-white border border-slate-200",
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
                                                        Current Quote Reposts
                                                      </p>
                                                      <p
                                                        className={cn(
                                                          "text-2xl font-black",
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
                                                          ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                                          : "bg-gradient-to-br from-indigo-500 to-violet-600",
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
                                                                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                                                : "bg-gradient-to-r from-indigo-500 to-violet-600",
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
                                                          {progress.toFixed(0)}%
                                                          complete
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
                                                : "bg-white border border-slate-200",
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
                                                    "text-sm font-semibold uppercase tracking-wide",
                                                    isDark
                                                      ? "text-slate-200"
                                                      : "text-slate-600",
                                                  )}
                                                >
                                                  Current Views
                                                </p>
                                                <p
                                                  className={cn(
                                                    "text-2xl font-black",
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
                                        : "bg-gradient-to-br from-white to-blue-50 border border-blue-100",
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
                                                ? "text-white drop-shadow-lg bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent"
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
                                        : "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
                                      isDark
                                        ? "bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 shadow-lg shadow-blue-400/70 animate-pulse"
                                        : "bg-gradient-to-r from-blue-200 to-blue-300",
                                    )}
                                    {renderMetricCard(
                                      <Zap className="h-5 w-5 text-white" />,
                                      "Total engagement",
                                      metricsForDisplay?.total_engagement ?? 0,
                                      isDark
                                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                        : "bg-gradient-to-br from-violet-500 to-violet-600 text-white",
                                      isDark
                                        ? "bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 shadow-lg shadow-violet-400/70 animate-pulse"
                                        : "bg-gradient-to-r from-violet-200 to-fuchsia-200",
                                      "Sum of likes plus reply, retweet, and quote submission counts.",
                                    )}
                                    {renderMetricCard(
                                      <ThumbsUp className="h-5 w-5 text-white" />,
                                      "Total Likes",
                                      metricsForDisplay?.total_likes || 0,
                                      isDark
                                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                        : "bg-gradient-to-br from-pink-500 to-pink-600 text-white",
                                      isDark
                                        ? "bg-gradient-to-r from-pink-400 via-rose-400 to-red-400 shadow-lg shadow-pink-400/70 animate-pulse"
                                        : "bg-gradient-to-r from-pink-200 to-pink-300",
                                    )}
                                    {renderMetricCard(
                                      <MessageCircle className="h-5 w-5 text-white" />,
                                      "Reply posts",
                                      metricsForDisplay?.total_replies || 0,
                                      isDark
                                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                        : "bg-gradient-to-br from-orange-500 to-orange-600 text-white",
                                      isDark
                                        ? "bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 shadow-lg shadow-orange-400/70 animate-pulse"
                                        : "bg-gradient-to-r from-orange-200 to-orange-300",
                                    )}
                                    {renderMetricCard(
                                      <Share2 className="h-5 w-5 text-white" />,
                                      "Retweet posts",
                                      metricsForDisplay?.total_retweets || 0,
                                      isDark
                                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                        : "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white",
                                      isDark
                                        ? "bg-gradient-to-r from-cyan-400 via-teal-400 to-green-400 shadow-lg shadow-cyan-400/70 animate-pulse"
                                        : "bg-gradient-to-r from-cyan-200 to-cyan-300",
                                    )}
                                    {renderMetricCard(
                                      <RefreshCw className="h-5 w-5 text-white" />,
                                      "Quote posts",
                                      metricsForDisplay?.total_quote_reposts ||
                                        0,
                                      isDark
                                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                        : "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white",
                                      isDark
                                        ? "bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 shadow-lg shadow-indigo-400/70 animate-pulse"
                                        : "bg-gradient-to-r from-indigo-200 to-indigo-300",
                                    )}
                                    {renderMetricCard(
                                      <Eye className="h-5 w-5 text-white" />,
                                      "Total Impressions",
                                      metricsForDisplay?.total_impressions || 0,
                                      isDark
                                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                        : "bg-gradient-to-br from-green-500 to-green-600 text-white",
                                      isDark
                                        ? "bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 shadow-lg shadow-green-400/70 animate-pulse"
                                        : "bg-gradient-to-r from-green-200 to-green-300",
                                    )}
                                    {renderMetricCard(
                                      <TrendingUp className="h-5 w-5 text-white" />,
                                      "Total Points",
                                      metricsForDisplay?.total_points || 0,
                                      isDark
                                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                        : "bg-gradient-to-br from-yellow-500 to-yellow-600 text-white",
                                      isDark
                                        ? "bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 shadow-lg shadow-yellow-400/70 animate-pulse"
                                        : "bg-gradient-to-r from-yellow-200 to-yellow-300",
                                    )}
                                    {renderMetricCard(
                                      <Users className="h-5 w-5 text-white" />,
                                      "Submissions",
                                      filteredAnalyticsSubmissions.length,
                                      isDark
                                        ? "bg-white/20 border border-white/30 backdrop-blur-2xl shadow-lg shadow-white/20"
                                        : "bg-gradient-to-br from-purple-500 to-purple-600 text-white",
                                      isDark
                                        ? "bg-gradient-to-r from-purple-400 via-indigo-400 to-violet-400 shadow-lg shadow-purple-400/70 animate-pulse"
                                        : "bg-gradient-to-r from-purple-200 to-purple-300",
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
                            ? "bg-[#170337] border border-[#D1B7F9]"
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
                            ? "bg-[#170337] border border-[#D1B7F9]"
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
                                      return s.moderation_status === "verified";
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
                            ? "bg-[#170337] border border-[#D1B7F9]"
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
                              Contest Duration
                            </p>
                            <p className="text-xl font-bold">
                              {contest?.start_date && contest?.end_date
                                ? (() => {
                                    const start = new Date(contest.start_date);
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
                                ? "bg-[#170337] border border-[#D1B7F9]"
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
                                ? "bg-[#170337] border border-[#D1B7F9]"
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
                                        ) / filteredAnalyticsSubmissions.length,
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
                                ? "bg-[#170337] border border-[#D1B7F9]"
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
                                ? "bg-[#170337] border border-[#D1B7F9]"
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
