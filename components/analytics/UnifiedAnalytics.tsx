"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  Eye,
  DollarSign,
  Target,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Settings,
  CheckCircle,
  Clock,
  XCircle,
  Wallet,
  Calendar,
  Play,
  Pause,
  AlertCircle,
  FileText,
  X,
  ChevronDown,
  Video,
  Image as ImageIcon,
  Youtube,
  Instagram,
  Twitter,
} from "lucide-react";
import { SiTiktok } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import ContestAnalytics from "./ContestAnalytics";
import CreatorAnalytics from "./CreatorAnalytics";
import BrandDetailedAnalytics from "./BrandDetailedAnalytics";
import BrandAnalyticsGraph from "./BrandAnalyticsGraph";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminDateRangePicker } from "@/components/admin/AdminDateRangePicker";
import { getUtcMonthsAgoRange } from "@/lib/admin-date-range";
import { BRAND_ANALYTICS_MAX_RANGE_DAYS } from "@/lib/brand-analytics-query";
import { buildBrandAnalyticsQueryString } from "@/lib/brand-analytics-query";
import type { BrandAnalyticsDataSource } from "@/lib/brand-analytics-query";

interface UnifiedAnalyticsProps {
  userId: string;
}

interface MetricTile {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  enabled: boolean;
  category: "contests" | "submissions" | "engagement" | "financial";
}

const CONTEST_TYPE_OPTIONS = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "cpm", label: "CPM" },
  { id: "milestone", label: "Milestone" },
  { id: "dual_rewards", label: "Dual Rewards" },
] as const;

const ALL_CONTEST_TYPE_IDS = CONTEST_TYPE_OPTIONS.map((o) => o.id) as string[];

const defaultMetricTiles: MetricTile[] = [
  // Contest Metrics
  {
    id: "total_contests",
    label: "Total Campaigns",
    icon: BarChart3,
    enabled: true,
    category: "contests",
  },
  {
    id: "published_contests",
    label: "Published Campaigns",
    icon: CheckCircle,
    enabled: false,
    category: "contests",
  },
  {
    id: "draft_contests",
    label: "Draft Campaigns",
    icon: FileText,
    enabled: false,
    category: "contests",
  },
  {
    id: "active_contests",
    label: "Active (Live)",
    icon: Play,
    enabled: false,
    category: "contests",
  },
  {
    id: "upcoming_contests",
    label: "Upcoming",
    icon: Calendar,
    enabled: false,
    category: "contests",
  },
  {
    id: "ended_contests",
    label: "Ended",
    icon: Pause,
    enabled: false,
    category: "contests",
  },
  {
    id: "pending_approval",
    label: "Pending Approval",
    icon: AlertCircle,
    enabled: false,
    category: "contests",
  },
  {
    id: "approved_contests",
    label: "Approved",
    icon: CheckCircle,
    enabled: false,
    category: "contests",
  },

  // Submission Metrics
  {
    id: "total_submissions",
    label: "Total Submissions",
    icon: Users,
    enabled: true,
    category: "submissions",
  },
  {
    id: "verified_submissions",
    label: "Verified",
    icon: CheckCircle,
    enabled: false,
    category: "submissions",
  },
  {
    id: "paid_submissions",
    label: "Paid",
    icon: Wallet,
    enabled: false,
    category: "submissions",
  },
  {
    id: "pending_submissions",
    label: "Pending",
    icon: Clock,
    enabled: false,
    category: "submissions",
  },
  {
    id: "rejected_submissions",
    label: "Rejected",
    icon: XCircle,
    enabled: false,
    category: "submissions",
  },

  // Engagement Metrics
  {
    id: "total_views",
    label: "Total Views",
    icon: Eye,
    enabled: true,
    category: "engagement",
  },
  {
    id: "total_likes",
    label: "Total Likes",
    icon: TrendingUp,
    enabled: false,
    category: "engagement",
  },
  {
    id: "total_comments",
    label: "Total Comments",
    icon: Users,
    enabled: false,
    category: "engagement",
  },

  // Financial Metrics
  {
    id: "total_spent",
    label: "Total Budget",
    icon: DollarSign,
    enabled: true,
    category: "financial",
  },
  {
    id: "total_payouts",
    label: "Total Payouts",
    icon: Wallet,
    enabled: true,
    category: "financial",
  },
  {
    id: "effective_cpm",
    label: "Effective CPM",
    icon: Target,
    enabled: true,
    category: "financial",
  },
  {
    id: "avg_cost_per_view",
    label: "Avg Cost/View",
    icon: DollarSign,
    enabled: false,
    category: "financial",
  },
  {
    id: "avg_cost_per_submission",
    label: "Avg Cost/Submission",
    icon: DollarSign,
    enabled: false,
    category: "financial",
  },
];

const ANALYTICS_TILES_STORAGE_KEY = "go-viral:analytics-metric-tiles";

function getInitialMetricTiles(): MetricTile[] {
  if (typeof window === "undefined") return defaultMetricTiles;
  try {
    const raw = localStorage.getItem(ANALYTICS_TILES_STORAGE_KEY);
    if (!raw) return defaultMetricTiles;
    const saved = JSON.parse(raw) as { id: string; enabled: boolean }[];
    if (!Array.isArray(saved)) return defaultMetricTiles;
    const byId = new Map(saved.map((s) => [s.id, s.enabled]));
    return defaultMetricTiles.map((tile) => ({
      ...tile,
      enabled: byId.has(tile.id) ? byId.get(tile.id)! : tile.enabled,
    }));
  } catch {
    return defaultMetricTiles;
  }
}

const submissionStatusOptions = [
  { id: "all", label: "All Submissions", icon: Users },
  { id: "verified", label: "Verified", icon: CheckCircle },
  { id: "paid", label: "Paid", icon: Wallet },
  { id: "pending", label: "Pending", icon: Clock },
  { id: "not_rejected", label: "Not Rejected", icon: Users },
  { id: "rejected", label: "Rejected", icon: XCircle },
  { id: "verifiedPaid", label: "Verified + Paid", icon: CheckCircle },
];

const DATA_SOURCE_TABS = [
  { id: "submissions", label: "Submissions" },
  { id: "pc_submissions", label: "PC Submissions" },
] as const;

// Tabs are computed responsively so small screens show shorter labels

export default function UnifiedAnalytics({ userId }: UnifiedAnalyticsProps) {
  const isMobile = useIsMobile();
  const computedTabs = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "graph", label: "Graph" },
      { id: "detailed", label: isMobile ? "Analytics" : "Detailed Analytics" },
      { id: "contests", label: "Campaigns" },
      { id: "creators", label: "Creators" },
    ],
    [isMobile],
  );

  const { activeTab, setActiveTab } = useTabState(computedTabs, {
    defaultTab: "overview",
  });
  const [activeFilter, setActiveFilter] = useState("all");
  const [metricTiles, setMetricTiles] = useState<MetricTile[]>(
    getInitialMetricTiles,
  );
  const [showTileSettings, setShowTileSettings] = useState(false);

  // Persist metric tile selection to localStorage when it changes
  useEffect(() => {
    try {
      const toSave = metricTiles.map((t) => ({ id: t.id, enabled: t.enabled }));
      localStorage.setItem(ANALYTICS_TILES_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignore quota or parse errors
    }
  }, [metricTiles]);
  // Content type: Video (checkboxes: YouTube, Instagram) | Text/Image (checkbox: Twitter)
  const [contentType, setContentType] = useState<"video" | "text_image">(
    "video",
  );
  const [videoYoutube, setVideoYoutube] = useState(true);
  const [videoInstagram, setVideoInstagram] = useState(true);
  const [videoTiktok, setVideoTiktok] = useState(true);
  // All platforms selected by default so campaign counts cover every campaign.
  const [twitterAnalytics, setTwitterAnalytics] = useState(false);
  // Multi-select campaign types (all selected by default).
  const [contestTypes, setContestTypes] = useState<string[]>([
    ...ALL_CONTEST_TYPE_IDS,
  ]);
  // Serialized value sent to the API: "all", "__none__", or comma list.
  const contestTypeParam =
    contestTypes.length === ALL_CONTEST_TYPE_IDS.length
      ? "all"
      : contestTypes.length === 0
        ? "__none__"
        : contestTypes.join(",");
  // Brand campaign filter (null = all)
  const [selectedContestIds, setSelectedContestIds] = useState<string[] | null>(
    null,
  );
  const [campaignSearch, setCampaignSearch] = useState("");
  // Date range (drives the Graph tab). Shown in the top filter bar.
  const [dateRange, setDateRange] = useState(() => getUtcMonthsAgoRange(12));
  const [dateRangePresetLabel, setDateRangePresetLabel] =
    useState("Last 12 Months");
  const [dataSource, setDataSource] =
    useState<BrandAnalyticsDataSource>("submissions");
  const isPcSubmissions = dataSource === "pc_submissions";
  const videoPlatform: string =
    videoYoutube && videoInstagram && videoTiktok
      ? "all"
      : videoYoutube && videoInstagram
        ? "youtube_instagram"
        : videoYoutube && videoTiktok
          ? "youtube_tiktok"
          : videoInstagram && videoTiktok
            ? "instagram_tiktok"
            : videoYoutube
              ? "youtube"
              : videoInstagram
                ? "instagram"
                : videoTiktok
                  ? "tiktok"
                  : "all";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const { isDark } = useAnalyticsDarkMode();

  const analyticsQueryString = useMemo(
    () =>
      buildBrandAnalyticsQueryString({
        activeFilter,
        contentType:
          !isPcSubmissions &&
          twitterAnalytics &&
          !videoYoutube &&
          !videoInstagram &&
          !videoTiktok
            ? "text_image"
            : videoYoutube || videoInstagram || videoTiktok
              ? "video"
              : contentType,
        videoPlatform,
        videoTiktok,
        twitterAnalytics: isPcSubmissions ? false : twitterAnalytics,
        contestTypeParam,
        selectedContestIds,
        dateRange,
        dataSource,
      }),
    [
      activeFilter,
      contentType,
      videoYoutube,
      videoInstagram,
      videoTiktok,
      videoPlatform,
      twitterAnalytics,
      isPcSubmissions,
      contestTypeParam,
      selectedContestIds,
      dateRange,
      dataSource,
    ],
  );

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const url = `/api/analytics/overview?${analyticsQueryString}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const result = await response.json();
      setAnalyticsData(result);
    } catch (err) {
      console.error("Error fetching analytics data:", err);
      setError("Failed to fetch analytics data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [userId, analyticsQueryString]);

  // PC Submissions is video-only (no Twitter overlay).
  useEffect(() => {
    if (!isPcSubmissions) return;
    setTwitterAnalytics(false);
    if (!videoYoutube && !videoInstagram && !videoTiktok) {
      setVideoYoutube(true);
      setVideoInstagram(true);
      setVideoTiktok(true);
    }
    setContentType("video");
  }, [isPcSubmissions, videoYoutube, videoInstagram, videoTiktok]);

  // When the scope changes (platform/type), campaign selection can become invalid.
  useEffect(() => {
    setSelectedContestIds(null);
  }, [contentType, videoPlatform, twitterAnalytics, contestTypeParam]);

  // Switching data source or date range can change which campaigns are in scope.
  useEffect(() => {
    setSelectedContestIds(null);
  }, [dataSource, dateRange.from.toISOString(), dateRange.to.toISOString()]);

  // Keep campaign selection consistent with the current campaign list.
  useEffect(() => {
    const campaignList: { id: string }[] = analyticsData?.campaigns ?? [];
    setSelectedContestIds((prev) => {
      if (prev === null) return prev;
      if (prev.length === 0) return prev;
      const validSet = new Set(campaignList.map((c) => c.id));
      const next = prev.filter((id) => validSet.has(id));
      if (next.length === prev.length) return prev;
      // Stale ids after tab/filter change — fall back to all, not "none selected".
      if (next.length === 0 && campaignList.length > 0) return null;
      // Selection now matches every campaign in scope -> treat as "all".
      return next.length === campaignList.length ? null : next;
    });
  }, [analyticsData]);

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous)
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (current < previous)
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return "text-green-600";
    if (current < previous) return "text-red-600";
    return "text-gray-600";
  };

  const getMetricValue = (metricId: string): string | number => {
    if (!analyticsData?.overview) return 0;
    const o = analyticsData.overview;

    switch (metricId) {
      case "total_contests":
        return o.totalContests ?? 0;
      case "published_contests":
        return o.publishedContests ?? 0;
      case "draft_contests":
        return o.draftContests ?? 0;
      case "active_contests":
        return o.activeContests ?? 0;
      case "upcoming_contests":
        return o.upcomingContests ?? 0;
      case "ended_contests":
        return o.endedContests ?? 0;
      case "pending_approval":
        return o.pendingApprovalContests ?? 0;
      case "approved_contests":
        return o.approvedContests ?? 0;
      case "total_submissions":
        return o.totalSubmissions ?? 0;
      case "verified_submissions":
        return o.verifiedSubmissions ?? 0;
      case "paid_submissions":
        return o.paidSubmissions ?? 0;
      case "pending_submissions":
        return o.pendingSubmissions ?? 0;
      case "rejected_submissions":
        return o.rejectedSubmissions ?? 0;
      case "total_views":
        return o.totalViews ?? 0;
      case "total_likes":
        return o.totalLikes ?? 0;
      case "total_comments":
        return o.totalComments ?? 0;
      case "total_spent":
        return formatCurrencyFromCents(o.totalSpent ?? 0);
      case "total_payouts":
        return formatCurrencyFromCents(o.totalPayoutsCents ?? 0);
      case "effective_cpm":
        if (o.effectiveCpm == null) return "—";
        return `$${Number(o.effectiveCpm).toFixed(
          Number(o.effectiveCpm) >= 1 ? 2 : 3,
        )}`;
      case "avg_cost_per_view":
        return formatCurrencyFromCents(
          Math.round((o.avgCostPerView ?? 0) * 100),
        );
      case "avg_cost_per_submission":
        return formatCurrencyFromCents(
          Math.round((o.avgCostPerSubmission ?? 0) * 100),
        );
      default:
        return 0;
    }
  };

  /** Same loading UX as admin analytics: show "…" while refetching. */
  const metricsLoading = loading;

  const formatMetricTileValue = (value: string | number): string => {
    if (metricsLoading) return "…";
    if (typeof value === "number") return value.toLocaleString();
    return value;
  };

  const toggleMetricTile = (metricId: string) => {
    setMetricTiles((tiles) =>
      tiles.map((tile) =>
        tile.id === metricId ? { ...tile, enabled: !tile.enabled } : tile,
      ),
    );
  };

  if (error && !analyticsData) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">
          {error || "Failed to load analytics"}
        </p>
        <button
          onClick={fetchAnalyticsData}
          className="h-10 rounded-full bg-[#171717] px-5 text-sm font-medium text-white hover:bg-[#171717]/90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#171717]"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#171717]"></div>
      </div>
    );
  }

  const enabledTiles = metricTiles.filter((tile) => tile.enabled);
  const campaigns: { id: string; title: string }[] = analyticsData?.campaigns ?? [];
  const allCampaignIds = campaigns.map((c) => c.id);
  const filteredCampaigns = (() => {
    const q = campaignSearch.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  })();

  const isCampaignChecked = (id: string) =>
    selectedContestIds === null || selectedContestIds.includes(id);

  const setAllCampaignsChecked = (checked: boolean) => {
    setSelectedContestIds(checked ? null : []);
  };

  const setCampaignChecked = (id: string, checked: boolean) => {
    // `null` means "all campaigns selected" (no contestIds filter sent).
    if (selectedContestIds === null) {
      if (checked) return; // already all selected
      const next = allCampaignIds.filter((cid) => cid !== id);
      // If everything is still selected (e.g. ids list empty), keep null.
      setSelectedContestIds(next.length === allCampaignIds.length ? null : next);
      return;
    }

    if (checked) {
      const nextSet = new Set(selectedContestIds);
      nextSet.add(id);
      const next = Array.from(nextSet);
      setSelectedContestIds(next.length === allCampaignIds.length ? null : next);
      return;
    }

    // unchecked
    const next = selectedContestIds.filter((cid) => cid !== id);
    setSelectedContestIds(next.length === allCampaignIds.length ? null : next);
  };

  const campaignButtonLabel =
    selectedContestIds === null
      ? campaigns.length > 0
        ? `${campaigns.length} campaigns`
        : "All Campaigns"
      : selectedContestIds.length === 0
        ? "No Campaigns"
        : selectedContestIds.length === 1
          ? campaigns.find((c) => c.id === selectedContestIds[0])?.title ??
            "Campaign"
          : `${selectedContestIds.length} Campaigns`;

  const isContestTypeChecked = (id: string) => contestTypes.includes(id);

  const setAllContestTypesChecked = (checked: boolean) => {
    setContestTypes(checked ? [...ALL_CONTEST_TYPE_IDS] : []);
  };

  const setContestTypeChecked = (id: string, checked: boolean) => {
    setContestTypes((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((t) => t !== id);
    });
  };

  const contestTypeButtonLabel =
    contestTypes.length === ALL_CONTEST_TYPE_IDS.length
      ? "All Campaign Types"
      : contestTypes.length === 0
        ? "No Campaign Types"
        : contestTypes.length === 1
          ? CONTEST_TYPE_OPTIONS.find((o) => o.id === contestTypes[0])?.label ??
            "Campaign Type"
          : `${contestTypes.length} Campaign Types`;

  const categories = ["contests", "submissions", "engagement", "financial"];
  const categoryMetricLabels: Record<string, string> = {
    contests: "Campaign",
    submissions: "Submission",
    engagement: "Engagement",
    financial: "Financial",
  };

  return (
    <div className="space-y-6">
     

      {/* Unified Filter */}
      <div
        className={cn(
          "rounded-2xl border p-4 shadow-none",
          isDark
            ? "border-white/10 bg-white/5 text-white"
            : "border-neutral-200 bg-white text-[#171717]",
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h3
            className={cn(
              "text-base font-semibold tracking-tight",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            Filters
          </h3>
          <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 min-w-[160px] justify-between",
                    "h-10 rounded-full border shadow-none",
                    isDark
                      ? "border-white/15 bg-transparent text-white hover:bg-white/10"
                      : "border-neutral-300 bg-white text-[#171717] hover:bg-[#F6F6F7]",
                  )}
                >
                  {(videoYoutube || videoInstagram || videoTiktok) &&
                  !isPcSubmissions &&
                  twitterAnalytics ? (
                    <>
                      <Video className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {[
                          videoYoutube && "YouTube",
                          videoInstagram && "Instagram",
                          videoTiktok && "TikTok",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                        {" + Twitter"}
                      </span>
                    </>
                  ) : videoYoutube || videoInstagram || videoTiktok ? (
                    <>
                      <Video className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        Video
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          (
                          {[
                            videoYoutube && "YouTube",
                            videoInstagram && "Instagram",
                            videoTiktok && "TikTok",
                          ]
                            .filter(Boolean)
                            .join(", ")}
                          )
                        </span>
                      </span>
                    </>
                  ) : !isPcSubmissions && twitterAnalytics ? (
                    <>
                      <ImageIcon className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        Text/Image
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          (Twitter)
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="truncate text-muted-foreground">
                        Select platforms
                      </span>
                    </>
                  )}
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn(
                  "min-w-[220px]",
                  isDark ? "bg-[#161616] border-gray-800" : "bg-white",
                )}
              >
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer font-semibold",
                    isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                  )}
                  onClick={() => {
                    if (videoYoutube || videoInstagram || videoTiktok) {
                      if (isPcSubmissions) {
                        toast({
                          title: "At least one platform required",
                          description:
                            "PC Submissions only includes video platforms (YouTube, Instagram, TikTok).",
                          variant: "destructive",
                        });
                        return;
                      }
                      if (!twitterAnalytics) {
                        toast({
                          title: "At least one platform required",
                          description:
                            "Please keep at least one platform selected (e.g. Twitter) before unchecking Video.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setVideoYoutube(false);
                      setVideoInstagram(false);
                      setVideoTiktok(false);
                    } else {
                      setContentType("video");
                      setVideoYoutube(true);
                      setVideoInstagram(true);
                      setVideoTiktok(true);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={videoYoutube || videoInstagram || videoTiktok}
                    readOnly
                    className="h-4 w-4 rounded border-gray-400"
                  />
                  <Video className="w-4 h-4" />
                  Video
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer pl-8",
                    isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                  )}
                  onClick={() => {
                    if (videoYoutube) {
                      if (
                        videoInstagram ||
                        videoTiktok ||
                        (!isPcSubmissions && twitterAnalytics)
                      ) {
                        setVideoYoutube(false);
                      } else {
                        toast({
                          title: "At least one platform required",
                          description:
                            "Please keep at least one platform selected before unchecking.",
                          variant: "destructive",
                        });
                      }
                    } else {
                      setVideoYoutube(true);
                      setContentType("video");
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={videoYoutube}
                    readOnly
                    className="h-4 w-4 rounded border-gray-400"
                  />
                  <Youtube className="w-4 h-4 mr-2" />
                  YouTube
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer pl-8",
                    isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                  )}
                  onClick={() => {
                    if (videoInstagram) {
                      if (
                        videoYoutube ||
                        videoTiktok ||
                        (!isPcSubmissions && twitterAnalytics)
                      ) {
                        setVideoInstagram(false);
                      } else {
                        toast({
                          title: "At least one platform required",
                          description:
                            "Please keep at least one platform selected before unchecking.",
                          variant: "destructive",
                        });
                      }
                    } else {
                      setVideoInstagram(true);
                      setContentType("video");
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={videoInstagram}
                    readOnly
                    className="h-4 w-4 rounded border-gray-400"
                  />
                  <Instagram className="w-4 h-4 mr-2" />
                  Instagram
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer pl-8",
                    isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                  )}
                  onClick={() => {
                    if (videoTiktok) {
                      if (
                        videoYoutube ||
                        videoInstagram ||
                        (!isPcSubmissions && twitterAnalytics)
                      ) {
                        setVideoTiktok(false);
                      } else {
                        toast({
                          title: "At least one platform required",
                          description:
                            "Please keep at least one platform selected before unchecking.",
                          variant: "destructive",
                        });
                      }
                    } else {
                      setVideoTiktok(true);
                      setContentType("video");
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={videoTiktok}
                    readOnly
                    className="h-4 w-4 rounded border-gray-400"
                  />
                  <SiTiktok className="w-4 h-4 mr-2" />
                  TikTok
                </DropdownMenuItem>
                {!isPcSubmissions && (
                  <>
                <DropdownMenuSeparator
                  className={isDark ? "bg-gray-700" : "bg-gray-200"}
                />
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer font-semibold",
                    isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                  )}
                  onClick={() => {
                    if (twitterAnalytics) {
                      if (videoYoutube || videoInstagram || videoTiktok) {
                        setTwitterAnalytics(false);
                      } else {
                        toast({
                          title: "At least one platform required",
                          description:
                            "Please keep at least one platform selected (e.g. YouTube, Instagram, or TikTok) before unchecking Text/Image.",
                          variant: "destructive",
                        });
                      }
                    } else {
                      setContentType("text_image");
                      setTwitterAnalytics(true);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={twitterAnalytics}
                    readOnly
                    className="h-4 w-4 rounded border-gray-400"
                  />
                  <ImageIcon className="w-4 h-4" />
                  Text/Image
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer pl-8",
                    isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                  )}
                  onClick={() => {
                    if (twitterAnalytics) {
                      if (videoYoutube || videoInstagram || videoTiktok) {
                        setTwitterAnalytics(false);
                      } else {
                        toast({
                          title: "At least one platform required",
                          description:
                            "Please keep at least one platform selected (e.g. YouTube, Instagram, or TikTok) before unchecking.",
                          variant: "destructive",
                        });
                      }
                    } else {
                      setTwitterAnalytics(true);
                      setContentType("text_image");
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={twitterAnalytics}
                    readOnly
                    className="h-4 w-4 rounded border-gray-400"
                  />
                  <Twitter className="w-4 h-4 mr-2" />
                  Twitter
                </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Campaign type filter (multi-select) */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 min-w-[180px] justify-between",
                    "h-10 rounded-full border shadow-none",
                    isDark
                      ? "border-white/15 bg-transparent text-white hover:bg-white/10"
                      : "border-neutral-300 bg-white text-[#171717] hover:bg-[#F6F6F7]",
                  )}
                >
                  <span className="max-w-[150px] truncate">
                    {contestTypeButtonLabel}
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                onCloseAutoFocus={(e) => e.preventDefault()}
                className={cn(
                  "w-56 border shadow-lg",
                  isDark
                    ? "bg-[#161616] border-gray-800 text-white"
                    : "bg-white border-black/5 text-black",
                )}
              >
                <DropdownMenuCheckboxItem
                  checked={contestTypes.length === ALL_CONTEST_TYPE_IDS.length}
                  onCheckedChange={(checked) =>
                    setAllContestTypesChecked(checked === true)
                  }
                  onSelect={(e) => e.preventDefault()}
                  className={cn(
                    "cursor-pointer font-semibold",
                    isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                  )}
                >
                  All Campaign Types
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {CONTEST_TYPE_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.id}
                    checked={isContestTypeChecked(option.id)}
                    onCheckedChange={(checked) =>
                      setContestTypeChecked(option.id, checked === true)
                    }
                    onSelect={(e) => e.preventDefault()}
                    className={cn(
                      "cursor-pointer font-medium",
                      isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                    )}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Campaign filter */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 min-w-[200px] justify-between",
                    "h-10 rounded-full border shadow-none",
                    isDark
                      ? "border-white/15 bg-transparent text-white hover:bg-white/10"
                      : "border-neutral-300 bg-white text-[#171717] hover:bg-[#F6F6F7]",
                  )}
                >
                  <span className="max-w-[160px] truncate">{campaignButtonLabel}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(e) => e.preventDefault()}
                className={cn(
                  "w-96 border shadow-lg",
                  isDark
                    ? "bg-[#161616] border-gray-800 text-white"
                    : "bg-white border-black/5 text-black",
                )}
              >
                <DropdownMenuCheckboxItem
                  checked={selectedContestIds === null}
                  onCheckedChange={(checked) => setAllCampaignsChecked(checked === true)}
                  onSelect={(e) => e.preventDefault()}
                  className={cn(
                    "cursor-pointer font-semibold",
                    isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                  )}
                >
                  All Campaigns
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <div
                  className="px-2 pb-2"
                  onKeyDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 opacity-40" />
                    <Input
                      value={campaignSearch}
                      onChange={(e) => setCampaignSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      placeholder="Search campaigns…"
                      autoComplete="off"
                      className={cn(
                        "h-9 pl-8",
                        isDark && "border-white/10 bg-[#121212]",
                      )}
                    />
                  </div>
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto">
                  {filteredCampaigns.length === 0 ? (
                    <p className="px-3 py-4 text-sm opacity-50">No campaigns found</p>
                  ) : (
                    filteredCampaigns.map((c) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={c.id}
                          checked={isCampaignChecked(c.id)}
                          onCheckedChange={(checked) =>
                            setCampaignChecked(c.id, checked === true)
                          }
                          onSelect={(e) => e.preventDefault()}
                          className={cn(
                            "cursor-pointer font-medium break-words",
                            isDark ? "text-white focus:bg-white/10" : "text-gray-900",
                          )}
                        >
                          <span className="whitespace-normal break-words">{c.title}</span>
                        </DropdownMenuCheckboxItem>
                      );
                    })
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTileSettings(!showTileSettings)}
              className={cn(
                "h-10 rounded-full border px-4 shadow-none",
                isDark
                  ? "border-white/15 bg-transparent text-white hover:bg-white/10"
                  : "border-neutral-300 bg-white text-[#171717] hover:bg-[#F6F6F7]",
              )}
            >
              <Settings className="w-4 h-4" />
              Customize Tiles
            </Button>
          </div>
        </div>

        {/* Submissions vs PC Submissions — drives overview tiles + graph */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className={cn(
              "inline-flex w-fit items-center gap-0.5 rounded-full p-1",
              isDark ? "bg-white/10" : "bg-[#E4E4E4]",
            )}
          >
            {DATA_SOURCE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDataSource(tab.id)}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium leading-none outline-none transition-colors",
                  dataSource === tab.id
                    ? isDark
                      ? "bg-white/15 text-white shadow-sm"
                      : "bg-white text-[#1a1a1a] shadow-sm"
                    : isDark
                      ? "text-white/75 hover:bg-white/10 hover:text-white"
                      : "text-[#3f3f46] hover:bg-white/80 hover:text-[#1a1a1a]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <AdminDateRangePicker
            isDark={isDark}
            value={dateRange}
            presetLabel={dateRangePresetLabel}
            maxHistoryDays={BRAND_ANALYTICS_MAX_RANGE_DAYS}
            onChange={(next, label) => {
              setDateRange(next);
              setDateRangePresetLabel(label);
            }}
            align="end"
          />
        </div>

        <div
          className={cn(
            "mt-3 inline-flex max-w-full flex-wrap gap-0.5 rounded-full p-1",
            isDark ? "bg-white/10" : "bg-[#E4E4E4]",
          )}
        >
          {submissionStatusOptions.map((option) => {
            const Icon = option.icon;
            const isActive = activeFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveFilter(option.id)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium leading-none outline-none transition-colors",
                  isActive
                    ? isDark
                      ? "bg-white/15 text-white shadow-sm"
                      : "bg-white text-[#1a1a1a] shadow-sm"
                    : isDark
                      ? "text-white/75 hover:bg-white/10 hover:text-white"
                      : "text-[#3f3f46] hover:bg-white/80 hover:text-[#1a1a1a]",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Customizable Metric Tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {enabledTiles.map((tile) => {
          const Icon = tile.icon;
          const value = getMetricValue(tile.id);
          const displayValue = formatMetricTileValue(value);

          return (
            <div
              key={tile.id}
              className={cn(
                "rounded-2xl border px-4 py-4 shadow-none",
                isDark
                  ? "border-white/10 bg-white/5 text-white"
                  : "border-neutral-200 bg-white text-[#171717]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("text-sm", isDark ? "text-slate-400" : "text-[#737373]")}>
                    {tile.label}
                  </p>
                  <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", isDark ? "text-white" : "text-[#171717]")}>
                    {displayValue}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    isDark ? "bg-white/10 text-white" : "bg-[#F4F4F5] text-[#171717]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tile Customization Modal */}
      {showTileSettings && (
        <div
          className={cn(
            "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
            isDark ? "bg-black/70" : "bg-black",
          )}
        >
          <div
            className={cn(
              "rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto",
              isDark ? "bg-[#161616] border border-gray-800" : "bg-white",
            )}
          >
            <div className="flex items-center justify-between mb-6">
              <h2
                className={cn(
                  "text-xl font-semibold",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Customize Analytics Tiles
              </h2>
              <p
                onClick={() => setShowTileSettings(false)}
                className={cn(
                  "cursor-pointer",
                  isDark
                    ? "text-white hover:text-gray-300"
                    : "text-gray-600 hover:text-gray-800",
                )}
              >
                <X className="w-4 h-4" />
              </p>
            </div>

            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category}>
                  <h3
                    className={cn(
                      "text-lg font-medium capitalize mb-3",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    {categoryMetricLabels[category] ?? category} Metrics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {metricTiles
                      .filter((tile) => tile.category === category)
                      .map((tile) => (
                        <div
                          key={tile.id}
                          className={cn(
                            "p-3 border rounded-lg cursor-pointer transition-all",
                            tile.enabled
                              ? isDark
                                ? "border-white bg-white/10 text-white"
                                : "border-[#171717] bg-[#F6F6F7] text-[#171717]"
                              : isDark
                                ? "border-white/15 bg-transparent text-white"
                                : "border-neutral-200 bg-white text-[#44403c] hover:bg-[#F6F6F7]",
                          )}
                          onClick={() => toggleMetricTile(tile.id)}
                        >
                          <div className="flex items-center gap-2">
                            <tile.icon
                              className={cn(
                                "w-4 h-4",
                                tile.enabled
                                  ? isDark
                                    ? "text-white"
                                    : "text-[#171717]"
                                  : isDark
                                    ? "text-slate-400"
                                    : "text-[#737373]",
                              )}
                            />
                            <span
                              className={cn(
                                "text-sm font-medium",
                                tile.enabled
                                  ? isDark
                                    ? "text-white"
                                    : "text-gray-900"
                                  : isDark
                                    ? "text-gray-300"
                                    : "text-gray-700",
                              )}
                            >
                              {tile.label}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className={cn(
          "flex max-w-full gap-x-6 gap-y-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          isDark ? "border-white/15" : "border-[#d9d9de]",
        )}
      >
        {computedTabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-3 text-base outline-none transition-colors focus:outline-none focus-visible:outline-none",
                active
                  ? isDark
                    ? "border-white font-semibold text-white"
                    : "border-[#1a1a1a] font-semibold text-[#1a1a1a]"
                  : isDark
                    ? "border-transparent font-medium text-white"
                    : "border-transparent font-medium text-[#1a1a1a]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <TabContent activeTab={activeTab}>
        <TabPanel value="overview" activeTab={activeTab}>
          <div className="space-y-6">
            {analyticsData.overview.topContest && (
              <section
                className={cn(
                  "overflow-hidden rounded-2xl border",
                  isDark
                    ? "border-[#f0d7a8]/40 bg-[linear-gradient(180deg,rgba(255,246,234,0.16)_0%,rgba(255,255,255,0.04)_70%)] text-white"
                    : "border-[#f0d7a8] bg-[linear-gradient(180deg,#fff6ea_0%,#fffdf8_46%,#ffffff_100%)] text-[#171717]",
                )}
              >
                <div className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", isDark ? "text-[#f0d7a8]" : "text-[#8a6a32]")}>
                      Top Performing Campaign
                    </p>
                    <h3 className="mt-1 text-xl font-semibold">
                      {analyticsData.overview.topContest.title}
                    </h3>
                  </div>
                  <p className={cn("shrink-0 text-sm font-semibold", isDark ? "text-[#f0d7a8]" : "text-[#8a6a32]")}>
                    Best Performer
                  </p>
                </div>
                <div className={cn("grid grid-cols-2 border-t", isDark ? "border-[#f0d7a8]/30" : "border-[#f3e6d0]")}>
                  <div className="px-5 py-4">
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">
                      {analyticsData.overview.topContest.views.toLocaleString()}
                    </p>
                    <p className={cn("mt-1 text-sm", isDark ? "text-slate-200" : "text-[#44403c]")}>views</p>
                  </div>
                  <div className={cn("border-l px-5 py-4", isDark ? "border-[#f0d7a8]/30" : "border-[#f3e6d0]")}>
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">
                      {analyticsData.overview.topContest.submissions}
                    </p>
                    <p className={cn("mt-1 text-sm", isDark ? "text-slate-200" : "text-[#44403c]")}>submissions</p>
                  </div>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
              <section
                className={cn(
                  "flex h-full flex-col overflow-hidden rounded-2xl border",
                  isDark ? "border-white/10 bg-white/5 text-white" : "border-neutral-200 bg-white text-[#171717]",
                )}
              >
                <h3 className={cn("border-b px-5 py-4 text-base font-semibold", isDark ? "border-white/10" : "border-neutral-200")}>
                  Platform Performance
                </h3>
                <div className="flex-1">
                  {Object.entries(analyticsData.platformStats).map(([platform, stats]: [string, any], index) => {
                    const key = platform.toLowerCase();
                    const iconClass = "h-4 w-4";
                    const icon =
                      key === "youtube" ? (
                        <Youtube className={iconClass} />
                      ) : key === "instagram" ? (
                        <Instagram className={iconClass} />
                      ) : key === "tiktok" ? (
                        <SiTiktok className={iconClass} />
                      ) : key === "twitter" || key === "x" ? (
                        <Twitter className={iconClass} />
                      ) : null;
                    return (
                      <div
                        key={platform}
                        className={cn(
                          "flex items-center justify-between gap-4 px-5 py-3.5",
                          index > 0 && "border-t",
                          isDark ? "border-white/10" : "border-[#f1f1f3]",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium capitalize">
                            {icon}
                            {platform}
                          </p>
                          <p className={cn("mt-0.5 text-sm", isDark ? "text-slate-200" : "text-[#44403c]")}>
                            {stats.contests} campaigns · {stats.submissions?.toLocaleString() ?? 0} submissions
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold tabular-nums">{(stats.views ?? 0).toLocaleString()}</p>
                          <p className={cn("text-sm", isDark ? "text-slate-200" : "text-[#44403c]")}>views</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section
                className={cn(
                  "flex h-full flex-col overflow-hidden rounded-2xl border",
                  isDark ? "border-white/10 bg-white/5 text-white" : "border-neutral-200 bg-white text-[#171717]",
                )}
              >
                <h3 className={cn("border-b px-5 py-4 text-base font-semibold", isDark ? "border-white/10" : "border-neutral-200")}>
                  Campaign Type Performance
                </h3>
                <div className="flex-1">
                  {Object.entries(analyticsData.contestTypeStats).map(([type, stats]: [string, any], index) => (
                    <div
                      key={type}
                      className={cn(
                        "flex items-center justify-between gap-4 px-5 py-3.5",
                        index > 0 && "border-t",
                        isDark ? "border-white/10" : "border-[#f1f1f3]",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">{type.replaceAll("_", " ")}</p>
                        <p className={cn("mt-0.5 text-sm", isDark ? "text-slate-200" : "text-[#44403c]")}>
                          {stats.count} campaigns · {stats.submissions} submissions
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold tabular-nums">{formatCurrencyFromCents(stats.spent)}</p>
                        <p className={cn("text-sm", isDark ? "text-slate-200" : "text-[#44403c]")}>budget</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="graph" activeTab={activeTab}>
          <BrandAnalyticsGraph analyticsQueryString={analyticsQueryString} />
        </TabPanel>

        <TabPanel value="detailed" activeTab={activeTab}>
          <BrandDetailedAnalytics
            userId={userId}
            contentType={
              videoYoutube || videoInstagram || videoTiktok
                ? "video"
                : contentType
            }
            videoPlatform={videoPlatform}
            twitterAnalytics={isPcSubmissions ? false : twitterAnalytics}
            contestTypeFilter={contestTypeParam}
            activeFilter={activeFilter}
            analyticsQueryString={analyticsQueryString}
          />
        </TabPanel>

        <TabPanel value="contests" activeTab={activeTab}>
          <ContestAnalytics
            userId={userId}
            activeFilter={activeFilter}
            contentType={
              videoYoutube || videoInstagram || videoTiktok
                ? "video"
                : contentType
            }
            videoPlatform={videoPlatform}
            twitterAnalytics={isPcSubmissions ? false : twitterAnalytics}
            contestTypeFilter={contestTypeParam}
            analyticsQueryString={analyticsQueryString}
          />
        </TabPanel>

        <TabPanel value="creators" activeTab={activeTab}>
          <CreatorAnalytics
            userId={userId}
            activeFilter={activeFilter}
            contentType={
              videoYoutube || videoInstagram || videoTiktok
                ? "video"
                : contentType
            }
            videoPlatform={videoPlatform}
            twitterAnalytics={isPcSubmissions ? false : twitterAnalytics}
            contestTypeFilter={contestTypeParam}
            analyticsQueryString={analyticsQueryString}
          />
        </TabPanel>
      </TabContent>
    </div>
  );
}
