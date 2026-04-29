"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  Eye,
  DollarSign,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import ContestAnalytics from "./ContestAnalytics";
import CreatorAnalytics from "./CreatorAnalytics";
import BrandDetailedAnalytics from "./BrandDetailedAnalytics";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";
import { useIsMobile } from "@/hooks/use-mobile";
import ContestTypeFilter from "@/components/admin/ContestTypeFilter";

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

type ContestTypeFilterType = "all" | "leaderboard" | "cpm" | "milestone";

const defaultMetricTiles: MetricTile[] = [
  // Contest Metrics
  {
    id: "total_contests",
    label: "Total Contests",
    icon: BarChart3,
    enabled: true,
    category: "contests",
  },
  {
    id: "published_contests",
    label: "Published Contests",
    icon: CheckCircle,
    enabled: false,
    category: "contests",
  },
  {
    id: "draft_contests",
    label: "Draft Contests",
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
    label: "Total Spent",
    icon: DollarSign,
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

// Tabs are computed responsively so small screens show shorter labels

export default function UnifiedAnalytics({ userId }: UnifiedAnalyticsProps) {
  const isMobile = useIsMobile();
  const computedTabs = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "detailed", label: isMobile ? "Analytics" : "Detailed Analytics" },
      { id: "contests", label: "Contests" },
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
  const [twitterAnalytics, setTwitterAnalytics] = useState(false);
  const [contestTypeFilter, setContestTypeFilter] =
    useState<ContestTypeFilterType>("all");
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

  useEffect(() => {
    fetchAnalyticsData();
  }, [
    userId,
    activeFilter,
    contentType,
    videoPlatform,
    videoYoutube,
    videoInstagram,
    videoTiktok,
    twitterAnalytics,
    contestTypeFilter,
  ]);

  const buildAnalyticsParams = () => {
    const params = new URLSearchParams();
    if (activeFilter && activeFilter !== "all") {
      if (activeFilter === "not_rejected") {
        params.set("notRejected", "true");
      } else {
        params.set("status", activeFilter);
      }
    }
    // When video platforms (YouTube, Instagram, or TikTok) and Twitter are selected, API needs contentType=video + twitter=true
    const hasVideo = videoYoutube || videoInstagram || videoTiktok;
    params.set("contentType", hasVideo ? "video" : "text_image");
    params.set("videoPlatform", videoPlatform);
    params.set("tiktok", videoTiktok ? "true" : "false");
    params.set("twitter", twitterAnalytics ? "true" : "false");
    if (contestTypeFilter && contestTypeFilter !== "all") {
      params.set("type", contestTypeFilter);
    }
    return params.toString();
  };

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const qs = buildAnalyticsParams();
      const url = `/api/analytics/overview${qs ? `?${qs}` : ""}`;

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

  const getMetricValue = (metricId: string) => {
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

  const toggleMetricTile = (metricId: string) => {
    setMetricTiles((tiles) =>
      tiles.map((tile) =>
        tile.id === metricId ? { ...tile, enabled: !tile.enabled } : tile,
      ),
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">
          {error || "Failed to load analytics"}
        </p>
        <button
          onClick={fetchAnalyticsData}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const enabledTiles = metricTiles.filter((tile) => tile.enabled);
  const categories = ["contests", "submissions", "engagement", "financial"];

  return (
    <div className="space-y-6">
      {/* Unified Filter */}
      <div
        className={cn(
          "rounded-lg p-4 shadow-sm border",
          isDark
            ? "bg-[#170337] border-[#170337] text-white"
            : "bg-white border border-gray-200",
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h3
            className={cn(
              "text-lg font-semibold",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            Filter by Submission Status
          </h3>
          <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex items-center gap-2 min-w-[160px] justify-between",
                    isDark
                      ? "bg-[#170337] text-white border-gray-600"
                      : "bg-white hover:bg-gray-50 text-gray-700 border-gray-400",
                  )}
                >
                  {(videoYoutube || videoInstagram || videoTiktok) &&
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
                  ) : twitterAnalytics ? (
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
                  isDark ? "bg-[#06021D] border-gray-800" : "bg-white",
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
                      if (videoInstagram || videoTiktok || twitterAnalytics) {
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
                      if (videoYoutube || videoTiktok || twitterAnalytics) {
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
                      if (videoYoutube || videoInstagram || twitterAnalytics) {
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
              </DropdownMenuContent>
            </DropdownMenu>
            <ContestTypeFilter
              value={contestTypeFilter}
              onChange={(value) =>
                setContestTypeFilter(value as ContestTypeFilterType)
              }
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTileSettings(!showTileSettings)}
              className={`flex items-center gap-2 ${
                isDark
                  ? "bg-[#170337] text-white border-gray-600"
                  : "bg-white hover:bg-gray-50 text-gray-700 border-gray-400"
              }`}
            >
              <Settings className="w-4 h-4" />
              Customize Tiles
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {submissionStatusOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.id}
                variant={activeFilter === option.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(option.id)}
                className={`flex items-center gap-2 ${
                  activeFilter === option.id
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : isDark
                      ? "bg-[#170337] hover:bg-[#2A0B5A] text-white border-gray-600"
                      : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{option.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Customizable Metric Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {enabledTiles.map((tile) => {
          const Icon = tile.icon;
          const value = getMetricValue(tile.id);

          return (
            <div
              key={tile.id}
              className={cn(
                "rounded-xl shadow-[0px_5px_20px_0px_#0000000D] p-2",
                isDark ? "bg-[#170337] text-white" : "bg-white text-black",
              )}
            >
              <div className="flex flex-row items-center justify-between space-y-0 px-6 pt-2">
                <h1
                  className={cn(
                    "text-lg font-medium",
                    isDark ? "text-white" : "text-gray-900",
                  )}
                >
                  {tile.label}
                </h1>
                <div
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-full",
                    isDark
                      ? "bg-[#FFFFFF36] text-white"
                      : "bg-[#D8C3FF] text-[#4A00BE]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-bold mb-2",
                    isDark ? "text-white" : "text-gray-900",
                  )}
                >
                  {value}
                </div>
                <p
                  className={cn(
                    "text-sm mt-2",
                    isDark ? "text-white" : "text-gray-600",
                  )}
                >
                  {activeFilter === "all"
                    ? "All submissions"
                    : `Filtered by ${
                        submissionStatusOptions.find(
                          (opt) => opt.id === activeFilter,
                        )?.label
                      }`}
                </p>
              </CardContent>
            </div>
          );
        })}
      </div>

      {/* Tile Customization Modal */}
      {showTileSettings && (
        <div
          className={cn(
            "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
            isDark ? "bg-[#100A33]" : "bg-black",
          )}
        >
          <div
            className={cn(
              "rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto",
              isDark ? "bg-[#06021D] border border-gray-800" : "bg-white",
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
                    {category} Metrics
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
                                ? "bg-purple-900/30 border-purple-600/50 text-white"
                                : "bg-purple-50 border-purple-200 text-gray-900"
                              : isDark
                                ? "bg-[#06021D] border-gray-600 text-white"
                                : "border-gray-300 hover:bg-gray-100 text-gray-700",
                          )}
                          onClick={() => toggleMetricTile(tile.id)}
                        >
                          <div className="flex items-center gap-2">
                            <tile.icon
                              className={cn(
                                "w-4 h-4",
                                tile.enabled
                                  ? isDark
                                    ? "text-purple-300"
                                    : "text-purple-600"
                                  : isDark
                                    ? "text-gray-400"
                                    : "text-gray-500",
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
      <EnhancedTabs
        tabs={computedTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-6"
        isDark={isDark}
        light={!isDark}
      />

      {/* Tab Content */}
      <TabContent activeTab={activeTab}>
        <TabPanel value="overview" activeTab={activeTab}>
          <div className="space-y-6">
            {/* Top Performing Contest */}
            {analyticsData.overview.topContest && (
              <Card
                className={cn(
                  "border shadow-smv flex-col sm:flex-row",
                  isDark
                    ? "bg-gradient-to-br from-purple-800/40 to-blue-900/40 border-purple-700/30"
                    : "bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200",
                )}
              >
                <CardHeader>
                  <CardTitle
                    className={cn(
                      "text-lg",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Top Performing Contest
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3
                        className={cn(
                          "font-semibold text-lg",
                          isDark ? "text-white" : "text-gray-900",
                        )}
                      >
                        {analyticsData.overview.topContest.title}
                      </h3>
                      <div
                        className={cn(
                          "flex gap-4 mt-2 text-sm",
                          isDark ? "text-gray-300" : "text-gray-700",
                        )}
                      >
                        <span>
                          {analyticsData.overview.topContest.views.toLocaleString()}{" "}
                          views
                        </span>
                        <span>
                          {analyticsData.overview.topContest.submissions}{" "}
                          submissions
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shadow-sm self-start sm:self-auto",
                        isDark
                          ? "bg-gradient-to-r from-purple-800/40 to-blue-800/40 text-purple-200 border-purple-600/50"
                          : "bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border-purple-300",
                      )}
                    >
                      Best Performer
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Platform Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className={cn(
                  "shadow-sm",
                  isDark ? "bg-[#170337] border-[#170337]" : "bg-white",
                )}
              >
                <CardHeader>
                  <CardTitle
                    className={cn(
                      "text-lg",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Platform Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(analyticsData.platformStats).map(
                      ([platform, stats]: [string, any]) => (
                        <div
                          key={platform}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center",
                                isDark ? "bg-[#FFFFFF36]" : "bg-gray-100",
                              )}
                            >
                              <span className="text-xs font-semibold capitalize">
                                {platform[0]}
                              </span>
                            </div>
                            <div>
                              <p
                                className={cn(
                                  "font-medium capitalize",
                                  isDark ? "text-white" : "text-gray-900",
                                )}
                              >
                                {platform}
                              </p>
                              <p
                                className={cn(
                                  "text-sm",
                                  isDark ? "text-gray-400" : "text-gray-500",
                                )}
                              >
                                {stats.contests} contests •{" "}
                                {stats.submissions?.toLocaleString() ?? 0}{" "}
                                submissions
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                "font-semibold",
                                isDark ? "text-white" : "text-gray-900",
                              )}
                            >
                              {(stats.views ?? 0).toLocaleString()}
                            </p>
                            <p
                              className={cn(
                                "text-sm",
                                isDark ? "text-gray-400" : "text-gray-500",
                              )}
                            >
                              views
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "shadow-sm",
                  isDark ? "bg-[#170337] border-[#170337]" : "bg-white",
                )}
              >
                <CardHeader>
                  <CardTitle
                    className={cn(
                      "text-lg",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Contest Type Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(analyticsData.contestTypeStats).map(
                      ([type, stats]: [string, any]) => (
                        <div
                          key={type}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <p
                              className={cn(
                                "font-medium capitalize",
                                isDark ? "text-white" : "text-gray-900",
                              )}
                            >
                              {type.replace("_", " ")}
                            </p>
                            <p
                              className={cn(
                                "text-sm",
                                isDark ? "text-gray-400" : "text-gray-500",
                              )}
                            >
                              {stats.count} contests • {stats.submissions}{" "}
                              submissions
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                "font-semibold",
                                isDark ? "text-white" : "text-gray-900",
                              )}
                            >
                              {formatCurrencyFromCents(stats.spent)}
                            </p>
                            <p
                              className={cn(
                                "text-sm",
                                isDark ? "text-gray-400" : "text-gray-500",
                              )}
                            >
                              spent
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
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
            twitterAnalytics={twitterAnalytics}
            contestTypeFilter={contestTypeFilter}
            onContestTypeFilterChange={(value) =>
              setContestTypeFilter(value as ContestTypeFilterType)
            }
            activeFilter={activeFilter}
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
            twitterAnalytics={twitterAnalytics}
            contestTypeFilter={contestTypeFilter}
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
            twitterAnalytics={twitterAnalytics}
            contestTypeFilter={contestTypeFilter}
          />
        </TabPanel>
      </TabContent>
    </div>
  );
}
