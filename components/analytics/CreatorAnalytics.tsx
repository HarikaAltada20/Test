"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Trophy,
  TrendingUp,
  Heart,
  Share,
  Youtube,
  Instagram,
  Twitter,
  Calendar,
} from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";

interface CreatorAnalyticsProps {
  userId: string;
  activeFilter?: string;
  contentType?: "video" | "text_image";
  videoPlatform?: string;
  twitterAnalytics?: boolean;
  contestTypeFilter?: string;
  analyticsQueryString: string;
}

interface CreatorData {
  leaderboards: {
    topByViews: Array<{
      creator: {
        id: string;
        username: string;
        creator_profiles: {
          total_views: number;
          total_contests_participated: number;
          total_contests_won: number;
          youtube_account: any;
          instagram_account: any;
        };
      };
      totalSubmissions: number;
      totalViews: number;
      totalEarnings: number;
      viewsYoutubeInstagram?: number;
      viewsTwitter?: number;
      submissionsYoutubeInstagram?: number;
      submissionsYoutube?: number;
      submissionsInstagram?: number;
      submissionsTwitter?: number;
      avgViewsPerSubmission: number;
      avgViewsPerSubmissionYoutubeInstagram?: number;
      avgViewsPerSubmissionTwitter?: number;
      platforms: string[];
      firstSubmission: Date;
      lastSubmission: Date;
      daysActive: number;
    }>;
    topByViewsYoutubeInstagram?: any[];
    topByViewsTwitter?: any[];
    topBySubmissions: any[];
    topByEarnings: any[];
  };
  summary: {
    totalUniqueCreators: number;
    totalSubmissions: number;
    totalViews: number;
    totalEarnings: number;
    totalPayoutsCents?: number;
    avgSubmissionsPerCreator: number;
    avgViewsPerCreator: number;
    avgEarningsPerCreator: number;
    avgPayoutsPerCreator?: number;
  };
  demographics: {
    platformDemographics: Record<string, number>;
    contestTypePreferences: Record<string, number>;
  };
}

const PlatformIcon = ({ platform }: { platform: string }) => {
  const iconClass = "w-3 h-3 sm:w-5 sm:h-5";

  switch (platform?.toLowerCase()) {
    case "youtube":
      return <Youtube className={iconClass} />;
    case "instagram":
      return <Instagram className={iconClass} />;
    case "twitter":
    case "x":
      return <Twitter className={iconClass} />;
    case "tiktok":
      return <SiTiktok className={iconClass} />;
    default:
      return <div className={`${iconClass} bg-gray-400 rounded`}></div>;
  }
};

function hexPoints(radius: number) {
  return Array.from({ length: 6 }, (_, k) => {
    const angle = ((-90 + 60 * k) * Math.PI) / 180;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

const RANK_RIM = hexPoints(46);
const RANK_FACE = hexPoints(38);
const RANK_TONES: Record<1 | 2 | 3, { rim: [string, string, string]; numeral: string }> = {
  1: { rim: ["#f1e6cd", "#a89466", "#3b3322"], numeral: "#ffffff" },
  2: { rim: ["#e3e6ea", "#8a9099", "#2c2f34"], numeral: "#e8eaed" },
  3: { rim: ["#dcb594", "#946142", "#34210f"], numeral: "#e6d3c3" },
};

function RankPlate({ rank, size }: { rank: 1 | 2 | 3; size: number }) {
  const tone = RANK_TONES[rank];
  const id = `analytics-rank-plate-${rank}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={tone.rim[0]} />
          <stop offset="0.55" stopColor={tone.rim[1]} />
          <stop offset="1" stopColor={tone.rim[2]} />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#2a2a2a" />
          <stop offset="1" stopColor="#121212" />
        </linearGradient>
      </defs>
      <polygon points={RANK_RIM} fill={`url(#${id}-rim)`} />
      <polygon points={RANK_FACE} fill={`url(#${id}-face)`} />
      <polygon points={RANK_FACE} fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="0.8" />
      <text x="50" y="64" textAnchor="middle" fill={tone.numeral} fontSize="42" fontWeight="600">
        {rank}
      </text>
    </svg>
  );
}

export default function CreatorAnalytics({
  userId,
  activeFilter = "all",
  contentType = "video",
  videoPlatform = "all",
  twitterAnalytics = false,
  contestTypeFilter = "all",
  analyticsQueryString,
}: CreatorAnalyticsProps) {
  const [data, setData] = useState<CreatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("views");
  const { isDark } = useAnalyticsDarkMode();

  useEffect(() => {
    fetchCreatorData();
  }, [analyticsQueryString]);

  const fetchCreatorData = async () => {
    try {
      setLoading(true);
      const url = `/api/analytics/creators?${analyticsQueryString}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch creator data");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching creator data:", err);
      setError("Failed to fetch creator data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#171717]"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">
          {error || "Failed to load creator analytics"}
        </p>
        <button
          onClick={fetchCreatorData}
          className="px-4 py-2 h-10 rounded-full bg-[#171717] px-5 text-sm text-white hover:bg-[#171717]/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const { leaderboards, summary, demographics } = data;

  const getCurrentLeaderboard = () => {
    switch (activeTab) {
      case "submissions":
        return leaderboards.topBySubmissions;
      case "earnings":
        return leaderboards.topByEarnings;
      case "views":
        return leaderboards.topByViews;
      default:
        return leaderboards.topByViews;
    }
  };

  const getLeaderboardTitle = () => {
    switch (activeTab) {
      case "submissions":
        return "Most Active Creators";
      case "earnings":
        return "Top Earners";
      case "views":
        return "Top Performers by Views";
      default:
        return "Top Performers by Views";
    }
  };

  const getLeaderboardMetric = (creator: any) => {
    switch (activeTab) {
      case "submissions":
        return creator.totalSubmissions;
      case "earnings":
        return formatCurrencyFromCents(creator.totalEarnings);
      case "views":
        return creator.totalViews.toLocaleString();
      default:
        return creator.totalViews.toLocaleString();
    }
  };

  const submissionDetails = (creator: any) => (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {(creator.submissionsYoutubeInstagram ?? 0) > 0 || (creator.submissionsTwitter ?? 0) > 0 ? (
        <>
          {(creator.submissionsYoutubeInstagram ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-sm text-[#737373]">
              {Array.isArray(creator.platforms) &&
                creator.platforms.some((platform: string) => {
                  const normalized = platform?.toString().toLowerCase();
                  return normalized === "tiktok" || normalized === "tik_tok" || normalized === "tik-tok";
                }) && <SiTiktok className={cn("h-3.5 w-3.5", isDark ? "text-white" : "text-black")} />}
              {(creator.submissionsYoutube ?? 0) > 0 && <Youtube className={cn("h-3.5 w-3.5", isDark ? "text-white" : "text-black")} />}
              {(creator.submissionsInstagram ?? 0) > 0 && <Instagram className={cn("h-3.5 w-3.5", isDark ? "text-white" : "text-black")} />}
              <span className="whitespace-nowrap">{creator.submissionsYoutubeInstagram} submissions</span>
            </span>
          )}
          {(creator.submissionsTwitter ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-sm text-[#737373]">
              <Twitter className={cn("h-3.5 w-3.5", isDark ? "text-white" : "text-black")} />
              <span className="whitespace-nowrap">{creator.submissionsTwitter} submissions</span>
            </span>
          )}
        </>
      ) : (
        <>
          {creator.platforms?.map((platform: string) => (
            <PlatformIcon key={platform} platform={platform} />
          ))}
          <span className="whitespace-nowrap text-sm text-[#737373]">{creator.totalSubmissions} submissions</span>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div
        className={cn(
          "grid grid-cols-1 overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-4",
          isDark
            ? "border-white/10 bg-[#161616] text-white"
            : "border-neutral-200 bg-white text-[#171717]",
        )}
      >
        {[
          {
            label: "Total Creators",
            value: summary.totalUniqueCreators.toLocaleString(),
            caption: "Unique creators engaged",
          },
          {
            label: "Total Submissions",
            value: summary.totalSubmissions.toLocaleString(),
            caption: `${summary.avgSubmissionsPerCreator.toFixed(1)} per creator`,
          },
          {
            label: "Total Views",
            value: summary.totalViews.toLocaleString(),
            caption: `${summary.avgViewsPerCreator.toLocaleString()} per creator`,
          },
          {
            label: "Total Earnings",
            value: formatCurrencyFromCents(
              summary.totalPayoutsCents ?? summary.totalEarnings,
            ),
            caption: `${formatCurrencyFromCents(
              Math.round(
                (summary.avgPayoutsPerCreator ?? summary.avgEarningsPerCreator) *
                  100,
              ),
            )} per creator`,
          },
        ].map((card, index) => (
          <div
            key={card.label}
            className={cn(
              "px-5 py-4",
              isDark ? "border-white/10" : "border-neutral-200",
              index > 0 && "border-t sm:border-t-0",
              index % 2 === 1 && "sm:border-l",
              index >= 2 && "sm:border-t lg:border-t-0",
              index > 0 && "lg:border-l",
            )}
          >
            <p className="text-sm font-medium">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
              {card.value}
            </p>
            <p className={cn("mt-1 text-sm", isDark ? "text-slate-200" : "text-[#44403c]")}>
              {card.caption}
            </p>
          </div>
        ))}
      </div>

      {/* Demographics */}
      <div
        className={cn(
          "grid grid-cols-1 overflow-hidden rounded-xl border md:grid-cols-2",
          isDark
            ? "border-white/10 bg-[#161616] text-white"
            : "border-[#E8E8EC] bg-white text-[#171717]",
        )}
      >
        <section
          className={cn(
            "min-w-0",
            isDark ? "md:border-r md:border-white/10" : "md:border-r md:border-[#E8E8EC]",
          )}
        >
          <h3
            className={cn(
              "border-b px-5 py-4 text-[15px] font-medium",
              isDark ? "border-white/10" : "border-[#E8E8EC]",
            )}
          >
            Platform Distribution
          </h3>
          <div>
            {Object.entries(demographics.platformDemographics).map(
              ([platform, count]) => {
                const percentage =
                  summary.totalSubmissions > 0
                    ? ((count / summary.totalSubmissions) * 100).toFixed(1)
                    : "0.0";

                return (
                  <div
                    key={platform}
                    className={cn(
                      "flex items-center gap-3 border-b px-5 py-3.5",
                      isDark ? "border-white/10" : "border-[#E8E8EC]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        isDark ? "border-white/15 bg-white/5" : "border-[#E8E8EC] bg-white",
                      )}
                    >
                      <PlatformIcon platform={platform} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium capitalize">
                      {platform}
                    </span>
                    <span className="w-12 text-right text-sm font-semibold tabular-nums">
                      {count}
                    </span>
                    <span
                      className={cn(
                        "w-14 text-right text-sm tabular-nums",
                        isDark ? "text-slate-400" : "text-[#8A8A93]",
                      )}
                    >
                      {percentage}%
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </section>

        <section className="min-w-0">
          <h3
            className={cn(
              "border-b px-5 py-4 text-[15px] font-medium",
              isDark ? "border-white/10" : "border-[#E8E8EC]",
            )}
          >
            Campaign Type Preferences
          </h3>
          <div>
            {Object.entries(demographics.contestTypePreferences).map(
              ([type, count]) => {
                const percentage =
                  summary.totalSubmissions > 0
                    ? ((count / summary.totalSubmissions) * 100).toFixed(1)
                    : "0.0";

                return (
                  <div
                    key={type}
                    className={cn(
                      "flex items-center gap-3 border-b px-5 py-3.5",
                      isDark ? "border-white/10" : "border-[#E8E8EC]",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium capitalize">
                      {type.replace(/_/g, " ")}
                    </span>
                    <span className="w-12 text-right text-sm font-semibold tabular-nums">
                      {count}
                    </span>
                    <span
                      className={cn(
                        "w-14 text-right text-sm tabular-nums",
                        isDark ? "text-slate-400" : "text-[#8A8A93]",
                      )}
                    >
                      {percentage}%
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </section>
      </div>

      {/* Creator Leaderboard */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border shadow-none",
          isDark ? "border-white/10 bg-[#161616] text-white" : "border-[#e8e8ec] bg-white text-[#1a1a1a]",
        )}
      >
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h3 className="text-base font-semibold">{getLeaderboardTitle()}</h3>
          <div
            className={cn(
              "inline-flex w-fit items-center gap-0.5 rounded-full p-1",
              isDark ? "bg-white/10" : "bg-[#E4E4E4]",
            )}
          >
            {(
              [
                ["views", "Views"],
                ["submissions", "Submissions"],
                ["earnings", "Earnings"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium leading-none outline-none transition-colors",
                  activeTab === id
                    ? isDark
                      ? "bg-white/15 text-white shadow-sm"
                      : "bg-white text-[#1a1a1a] shadow-sm"
                    : isDark
                      ? "text-white/75 hover:bg-white/10 hover:text-white"
                      : "text-[#3f3f46] hover:bg-white/80 hover:text-[#1a1a1a]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {getCurrentLeaderboard().length === 0 ? (
          <p className={cn("border-t px-6 py-8 text-center text-sm", isDark ? "border-white/10 text-slate-400" : "border-[#f1f1f3] text-[#737373]")}>
            No creators
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 items-end gap-4 px-4 sm:grid-cols-3 sm:px-6">
              {[1, 0, 2]
                .map((index) => getCurrentLeaderboard().slice(0, 3)[index])
                .filter(Boolean)
                .map((creator: any) => {
                  const rank = (getCurrentLeaderboard().slice(0, 3).findIndex((item: any) => item.creator.id === creator.creator.id) + 1) as 1 | 2 | 3;
                  const isFirst = rank === 1;
                  const initials = String(creator.creator.username || "C").slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={creator.creator.id}
                      className={cn(
                        "flex w-full flex-col items-center rounded-2xl border px-6 text-center",
                        rank === 2 && "order-2 sm:order-none sm:col-start-1",
                        rank === 1 && "order-1 sm:order-none sm:col-start-2",
                        rank === 3 && "order-3 sm:order-none sm:col-start-3",
                        isFirst
                          ? isDark
                            ? "border-[#c4a15a]/50 bg-[linear-gradient(180deg,rgba(196,161,90,0.22)_0%,rgba(14,14,14,0.35)_46%,#161616_78%)] py-8"
                            : "border-[#f0d7a8] bg-[linear-gradient(180deg,#fff6ea_0%,#fffdf8_40%,#ffffff_70%)] py-8"
                          : isDark
                            ? "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,#161616_46%)] py-7"
                            : "border-[#e6e6ea] bg-[linear-gradient(180deg,#f3f3f5_0%,#fafafa_34%,#ffffff_68%)] py-7",
                      )}
                    >
                      <RankPlate rank={rank} size={isFirst ? 56 : 46} />
                      <div
                        className={cn(
                          "mt-4 flex items-center justify-center rounded-full font-semibold",
                          isDark
                            ? "bg-white/10 text-white"
                            : "bg-[#E8E8EA] text-[#171717]",
                          isFirst ? "h-16 w-16 text-lg" : "h-14 w-14 text-base",
                        )}
                      >
                        {initials}
                      </div>
                      <p className={cn("mt-3 max-w-full truncate text-lg font-semibold", isDark ? "text-white" : "text-[#18181b]")}>
                        @{creator.creator.username}
                      </p>
                      <div className="flex justify-center">{submissionDetails(creator)}</div>
                      <p className={cn("mt-4 text-4xl font-semibold tracking-tight tabular-nums", isDark ? "text-white" : "text-[#18181b]")}>
                        {getLeaderboardMetric(creator)}
                      </p>
                      <p className={cn("mt-2 text-base", isDark ? "text-white/50" : "text-[#8b8b93]")}>
                        {creator.avgViewsPerSubmission.toFixed(0)} avg views/submission
                      </p>
                    </div>
                  );
                })}
            </div>
            {getCurrentLeaderboard().slice(3, 10).length > 0 && (
              <div className={cn("border-t", isDark ? "border-white/10" : "border-[#f1f1f3]")}>
                {getCurrentLeaderboard()
                  .slice(3, 10)
                  .map((creator: any, index: number) => (
                    <div
                      key={creator.creator.id}
                      className={cn(
                        "flex items-center gap-4 border-b px-4 py-4 last:border-b-0 sm:px-6",
                        isDark ? "border-white/10" : "border-[#f1f1f3]",
                      )}
                    >
                      <span className={cn("w-8 shrink-0 text-base tabular-nums", isDark ? "text-white/50" : "text-[#8a8a93]")}>
                        {index + 4}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold">@{creator.creator.username}</h3>
                        {submissionDetails(creator)}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-base font-semibold tabular-nums">{getLeaderboardMetric(creator)}</div>
                        <div className={cn("mt-0.5 whitespace-nowrap text-sm", isDark ? "text-white/50" : "text-[#8b8b93]")}>
                          {creator.avgViewsPerSubmission.toFixed(0)} avg views/submission
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Top Creator Spotlight */}
      {leaderboards.topByViews.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-5 rounded-2xl border px-6 py-5 sm:flex-row sm:items-center sm:justify-between",
            isDark
              ? "border-[#c4a15a]/50 bg-[linear-gradient(180deg,rgba(196,161,90,0.22)_0%,rgba(14,14,14,0.35)_46%,#161616_78%)] text-white"
              : "border-[#f0d7a8] bg-[linear-gradient(180deg,#fff6ea_0%,#fffdf8_40%,#ffffff_70%)] text-[#18181b]",
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-[#8a6a32]">
              <Trophy className="h-4 w-4" />
              Top Creator Spotlight
            </div>
            <p className="mt-2 truncate text-xl font-semibold">
              @{leaderboards.topByViews[0].creator.username}
            </p>
            <p className={cn("mt-0.5 text-sm", isDark ? "text-white/50" : "text-[#8b8b93]")}>
              Top performer across all campaigns
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium", isDark ? "bg-white/10 text-white" : "bg-[#f2f2f4] text-[#2f2f33]")}>
                {leaderboards.topByViews[0].totalSubmissions} submissions
              </span>
              <span className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium", isDark ? "bg-white/10 text-white" : "bg-[#f2f2f4] text-[#2f2f33]")}>
                {formatCurrencyFromCents(leaderboards.topByViews[0].totalEarnings)} earned
              </span>
              <span className="inline-flex h-8 items-center gap-1 rounded-full bg-[#171717] px-3.5 text-sm font-medium text-white">
                <Trophy className="h-3.5 w-3.5" />
                Champion
              </span>
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {leaderboards.topByViews[0].totalViews.toLocaleString()}
            </p>
            <p className={cn("mt-1 text-sm", isDark ? "text-white/50" : "text-[#8b8b93]")}>views</p>
          </div>
        </div>
      )}
    </div>
  );
}
