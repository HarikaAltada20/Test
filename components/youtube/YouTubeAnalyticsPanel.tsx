"use client";

import {
  BarChart2,
  Clock,
  Eye,
  Share2,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  UserPlus,
  UserMinus,
  ListPlus,
  ListMinus,
  Users,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { YT_ANALYTICS_DEFAULT_WINDOW_DAYS } from "@/lib/youtube-constants";

// ── Types ──────────────────────────────────────────────────────────────────

export interface YouTubeMetrics {
  views?: number;
  likes?: number;
  dislikes?: number;
  comments?: number;
  shares?: number;
  subscribers_gained?: number;
  subscribers_lost?: number;
  videos_added_to_playlists?: number;
  videos_removed_from_playlists?: number;
  estimated_minutes_watched?: number;
  avg_view_duration_seconds?: number;
  avg_view_percentage?: number;
  engaged_views?: number;
  traffic_sources?: Record<string, number> | null;
  demographics?: {
    age_groups?: Record<string, number>;
    gender?: Record<string, number>;
    countries?: Record<string, number>;
  } | null;
  bot_score?: number | null;
  bot_flags?: string[];
  analytics_needs_reauth?: boolean;
  last_basic_update?: string | null;
  last_traffic_update?: string | null;
  last_demographics_update?: string | null;
}

interface Props {
  metrics: YouTubeMetrics;
  isDark?: boolean;
  children: React.ReactNode; // the trigger element
  showCore?: boolean;
  showTraffic?: boolean;
  showDemographics?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n?: number) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDuration(seconds?: number) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtMinutes(minutes?: number) {
  if (!minutes) return "—";
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.round(minutes)}m`;
}

function timeAgo(iso?: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Traffic source labels
const TRAFFIC_LABELS: Record<string, string> = {
  SHORTS: "Shorts Feed",
  YT_SEARCH: "YouTube Search",
  RELATED_VIDEO: "Related Videos",
  YT_CHANNEL: "Channel Page",
  SUBSCRIBER: "Subscriber Feed",
  EXT_URL: "External Links",
  NO_LINK_OTHER: "Direct / Other",
  NO_LINK_EMBEDDED: "Embedded",
  YT_OTHER_PAGE: "Other YouTube",
  HASHTAGS: "Hashtags",
  PLAYLIST: "Playlist",
  SOUND_PAGE: "Sound Page",
  NOTIFICATION: "Notifications",
  END_SCREEN: "End Screen",
};

// Color based on suspicion level
function trafficColor(source: string, pct: number): string {
  if (
    ["EXT_URL", "NO_LINK_OTHER", "NO_LINK_EMBEDDED"].includes(source) &&
    pct > 20
  )
    return "bg-red-400";
  if (
    source === "SHORTS" ||
    source === "YT_SEARCH" ||
    source === "RELATED_VIDEO"
  )
    return "bg-emerald-400";
  if (source === "SUBSCRIBER" || source === "YT_CHANNEL") return "bg-blue-400";
  return "bg-slate-400";
}

// Country flag emoji from ISO-3166-1 alpha-2 code
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const offset = 0x1f1e6 - 65; // 'A' = 65
  return Array.from(code.toUpperCase())
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + offset))
    .join("");
}

// Common country names (ISO-3166-1 alpha-2 → display name)
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  IN: "India",
  GB: "United Kingdom",
  BR: "Brazil",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  MX: "Mexico",
  PH: "Philippines",
  ID: "Indonesia",
  NG: "Nigeria",
  PK: "Pakistan",
  BD: "Bangladesh",
  TR: "Turkey",
  VN: "Vietnam",
  KR: "South Korea",
  JP: "Japan",
  EG: "Egypt",
  TH: "Thailand",
  IT: "Italy",
  ES: "Spain",
  CO: "Colombia",
  AR: "Argentina",
  SA: "Saudi Arabia",
  MY: "Malaysia",
  RU: "Russia",
  ZA: "South Africa",
  NL: "Netherlands",
  PL: "Poland",
  UA: "Ukraine",
  KE: "Kenya",
  GH: "Ghana",
  AE: "UAE",
  SG: "Singapore",
  NZ: "New Zealand",
};

// Age group labels
const AGE_LABELS: Record<string, string> = {
  age13_17: "13–17",
  age18_24: "18–24",
  age25_34: "25–34",
  age35_44: "35–44",
  age45_54: "45–54",
  age55_64: "55–64",
  age65_: "65+",
};

// ── Sub-sections ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  isDark,
}: {
  icon: React.ReactNode;
  title: string;
  isDark?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className={isDark ? "text-purple-400" : "text-purple-500"}>
        {icon}
      </span>
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          isDark ? "text-slate-400" : "text-slate-500",
        )}
      >
        {title}
      </span>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  sub,
  color,
  isDark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  isDark?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div
        className={cn(
          "flex items-center gap-2",
          isDark ? "text-slate-400" : "text-slate-500",
        )}
      >
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            color ?? (isDark ? "text-slate-100" : "text-slate-800"),
          )}
        >
          {value}
        </span>
        {sub && (
          <span
            className={cn(
              "text-[10px]",
              isDark ? "text-slate-500" : "text-slate-400",
            )}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function TrafficSourceBar({
  source,
  pct,
  isDark,
}: {
  source: string;
  pct: number;
  isDark?: boolean;
}) {
  const label = TRAFFIC_LABELS[source] ?? source;
  const color = trafficColor(source, pct);
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span
          className={cn(
            "truncate max-w-[130px]",
            isDark ? "text-slate-300" : "text-slate-600",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            isDark ? "text-slate-200" : "text-slate-700",
          )}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div
        className={cn(
          "h-1.5 rounded-full overflow-hidden",
          isDark ? "bg-slate-800" : "bg-slate-100",
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function YouTubeAnalyticsPanel({
  metrics,
  isDark,
  children,
  showCore = true,
  showTraffic = true,
  showDemographics = true,
}: Props) {
  const dark = !!isDark;

  const hasCore =
    (metrics.estimated_minutes_watched ?? 0) > 0 ||
    (metrics.avg_view_percentage ?? 0) > 0 ||
    (metrics.shares ?? 0) > 0;

  const hasTraffic =
    metrics.traffic_sources && Object.keys(metrics.traffic_sources).length > 0;

  const hasDemographics =
    metrics.demographics &&
    (Object.keys(metrics.demographics.age_groups ?? {}).length > 0 ||
      Object.keys(metrics.demographics.gender ?? {}).length > 0 ||
      Object.keys(metrics.demographics.countries ?? {}).length > 0);

  const botScore = metrics.bot_score;
  const botColor =
    botScore == null
      ? dark
        ? "text-slate-500"
        : "text-slate-400"
      : botScore >= 60
        ? "text-red-600"
        : botScore >= 30
          ? "text-yellow-600"
          : "text-green-600";

  const sortedTraffic = hasTraffic
    ? Object.entries(metrics.traffic_sources!).sort((a, b) => b[1] - a[1])
    : [];

  const ageGroups = hasDemographics
    ? Object.entries(metrics.demographics!.age_groups ?? {}).sort(
        (a, b) => b[1] - a[1],
      )
    : [];
  const genders = hasDemographics
    ? Object.entries(metrics.demographics!.gender ?? {}).sort(
        (a, b) => b[1] - a[1],
      )
    : [];
  const topCountries = hasDemographics
    ? Object.entries(metrics.demographics!.countries ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    : [];

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className={cn(
          "z-[100] w-full max-w-xs sm:w-80 p-4 text-sm shadow-xl border max-h-[80vh] overflow-y-auto overscroll-y-contain",
          isDark
            ? "bg-slate-900 border-slate-700 text-slate-100"
            : "bg-white border-slate-200 text-slate-900",
        )}
        align="end"
        side="left"
        sideOffset={8}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <BarChart2
              className={cn(
                "h-4 w-4",
                dark ? "text-purple-400" : "text-purple-500",
              )}
            />
            <span
              className={cn(
                "font-semibold text-sm",
                dark ? "text-slate-100" : "text-slate-900",
              )}
            >
              YouTube Analytics
            </span>
          </div>
          {metrics.analytics_needs_reauth ? (
            <Badge variant="destructive" className="text-[10px] h-5">
              Needs Reauth
            </Badge>
          ) : botScore != null ? (
            <span className={cn("text-xs font-bold", botColor)}>
              {botScore >= 60 ? "⚠ " : ""}Bot Score: {botScore}/100
            </span>
          ) : null}
        </div>

        {/* Bot flags */}
        {(metrics.bot_flags?.length ?? 0) > 0 && (
          <div
            className={cn(
              "mb-3 rounded-md border p-2 space-y-0.5",
              dark
                ? "bg-red-950/40 border-red-900/70"
                : "bg-red-50 border-red-200",
            )}
          >
            {metrics.bot_flags!.map((flag, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-1.5 text-[11px]",
                  dark ? "text-red-300" : "text-red-700",
                )}
              >
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {flag}
              </div>
            ))}
          </div>
        )}

        {/* ── Core Analytics ──────────────────────────────────── */}
        {hasCore && showCore ? (
          <div className="mb-4">
            <SectionHeader
              isDark={dark}
              icon={<Eye className="h-3.5 w-3.5" />}
              title="Core Analytics"
            />
            <div
              className={cn(
                "rounded-md border px-3 py-1 divide-y",
                isDark
                  ? "border-slate-700 divide-slate-700"
                  : "border-slate-100 divide-slate-100",
              )}
            >
              {(metrics.avg_view_percentage ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<Eye className="h-3.5 w-3.5" />}
                  label="Avg View %"
                  value={`${metrics.avg_view_percentage!.toFixed(1)}%`}
                  color={
                    metrics.avg_view_percentage! < 10
                      ? "text-red-600"
                      : metrics.avg_view_percentage! < 30
                        ? "text-yellow-600"
                        : "text-green-600"
                  }
                />
              )}
              {(metrics.estimated_minutes_watched ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Watch Time"
                  value={fmtMinutes(metrics.estimated_minutes_watched)}
                />
              )}
              {(metrics.avg_view_duration_seconds ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Avg Duration"
                  value={fmtDuration(metrics.avg_view_duration_seconds)}
                />
              )}
              {(metrics.engaged_views ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<Eye className="h-3.5 w-3.5" />}
                  label="Engaged Views"
                  value={fmt(metrics.engaged_views)}
                  sub={
                    metrics.views
                      ? `${((metrics.engaged_views! / metrics.views) * 100).toFixed(0)}%`
                      : undefined
                  }
                />
              )}
              {(metrics.shares ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<Share2 className="h-3.5 w-3.5" />}
                  label="Shares"
                  value={fmt(metrics.shares)}
                />
              )}
              {(metrics.likes ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<ThumbsUp className="h-3.5 w-3.5" />}
                  label="Likes"
                  value={fmt(metrics.likes)}
                />
              )}
              {(metrics.dislikes ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<ThumbsDown className="h-3.5 w-3.5" />}
                  label="Dislikes"
                  value={fmt(metrics.dislikes)}
                  color="text-red-500"
                />
              )}
              {(metrics.subscribers_gained ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<UserPlus className="h-3.5 w-3.5" />}
                  label="Subs Gained"
                  value={`+${fmt(metrics.subscribers_gained)}`}
                  color="text-green-600"
                />
              )}
              {(metrics.subscribers_lost ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<UserMinus className="h-3.5 w-3.5" />}
                  label="Subs Lost"
                  value={`-${fmt(metrics.subscribers_lost)}`}
                  color="text-red-500"
                />
              )}
              {(metrics.videos_added_to_playlists ?? 0) > 0 && (
                <StatRow
                  isDark={dark}
                  icon={<ListPlus className="h-3.5 w-3.5" />}
                  label="Added to Playlists"
                  value={fmt(metrics.videos_added_to_playlists)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <SectionHeader
              isDark={dark}
              icon={<Eye className="h-3.5 w-3.5" />}
              title="Core Analytics"
            />
            <p
              className={cn(
                "text-[11px] italic",
                dark ? "text-slate-500" : "text-slate-400",
              )}
            >
              No data yet — click "Refresh Core Analytics" to fetch.
            </p>
          </div>
        )}

        {/* ── Traffic Sources ─────────────────────────────────── */}
        <div className="mb-4">
          <SectionHeader
            isDark={dark}
            icon={<BarChart2 className="h-3.5 w-3.5" />}
            title="Traffic Sources"
          />
          {hasTraffic && showTraffic ? (
            <div>
              {sortedTraffic.map(([source, pct]) => (
                <TrafficSourceBar
                  isDark={dark}
                  key={source}
                  source={source}
                  pct={pct}
                />
              ))}
              <p
                className={cn(
                  "text-[10px] mt-2",
                  isDark ? "text-slate-500" : "text-slate-400",
                )}
              >
                Updated {timeAgo(metrics.last_traffic_update)}
              </p>
            </div>
          ) : (
            <p
              className={cn(
                "text-[11px] italic",
                dark ? "text-slate-500" : "text-slate-400",
              )}
            >
              No data yet — click "Refresh Traffic Sources".
            </p>
          )}
        </div>

        {/* ── Demographics ────────────────────────────────────── */}
        <div>
          <SectionHeader
            isDark={dark}
            icon={<Users className="h-3.5 w-3.5" />}
            title="Demographics"
          />
          {hasDemographics && showDemographics ? (
            <div>
              {/* Gender */}
              {genders.length > 0 && (
                <div className="flex gap-2 mb-2">
                  {genders.map(([gender, pct]) => (
                    <div
                      key={gender}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-center",
                        isDark
                          ? "bg-slate-800"
                          : "bg-slate-50 border border-slate-100",
                      )}
                    >
                      <div
                        className={cn(
                          "text-[11px] font-bold",
                          dark ? "text-slate-200" : "text-slate-700",
                        )}
                      >
                        {pct.toFixed(0)}%
                      </div>
                      <div
                        className={cn(
                          "text-[10px] capitalize",
                          dark ? "text-slate-500" : "text-slate-400",
                        )}
                      >
                        {gender}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Age groups */}
              {ageGroups.map(([age, pct]) => (
                <div key={age} className="mb-1.5">
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span
                      className={dark ? "text-slate-300" : "text-slate-600"}
                    >
                      {AGE_LABELS[age] ?? age}
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        dark ? "text-slate-200" : "text-slate-700",
                      )}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className={cn(
                      "h-1.5 rounded-full overflow-hidden",
                      dark ? "bg-slate-800" : "bg-slate-100",
                    )}
                  >
                    <div
                      className="h-full rounded-full bg-purple-400 transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}

              {/* Countries */}
              {topCountries.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-1 mb-1.5">
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        dark ? "text-slate-500" : "text-slate-400",
                      )}
                    >
                      Top Countries
                    </span>
                  </div>
                  {topCountries.map(([code, pct]) => (
                    <div key={code} className="mb-1.5">
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span
                          className={cn(
                            "flex items-center gap-1.5",
                            dark ? "text-slate-300" : "text-slate-600",
                          )}
                        >
                          <span>{countryFlag(code)}</span>
                          <span>{COUNTRY_NAMES[code] ?? code}</span>
                        </span>
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            dark ? "text-slate-200" : "text-slate-700",
                          )}
                        >
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div
                        className={cn(
                          "h-1.5 rounded-full overflow-hidden",
                          dark ? "bg-slate-800" : "bg-slate-100",
                        )}
                      >
                        <div
                          className="h-full rounded-full bg-blue-400 transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p
                className={cn(
                  "text-[10px] mt-2",
                  isDark ? "text-slate-500" : "text-slate-400",
                )}
              >
                Updated {timeAgo(metrics.last_demographics_update)}
              </p>
            </div>
          ) : (
            <p
              className={cn(
                "text-[11px] italic",
                dark ? "text-slate-500" : "text-slate-400",
              )}
            >
              No data yet — click "Refresh Demographics".
            </p>
          )}
        </div>

        {/* ── Last updated footer ────────────────────────────── */}
        <div
          className={cn(
            "mt-3 pt-2 border-t text-[10px] flex justify-between",
            isDark
              ? "border-slate-700 text-slate-500"
              : "border-slate-100 text-slate-400",
          )}
        >
          <span>Core: {timeAgo(metrics.last_basic_update)}</span>
          <span>Traffic: {timeAgo(metrics.last_traffic_update)}</span>
          <span>Demo: {timeAgo(metrics.last_demographics_update)}</span>
        </div>
        <p
          className={cn(
            "mt-2 text-[10px]",
            isDark ? "text-slate-500" : "text-slate-400",
          )}
        >
          Max. analytics window: last {YT_ANALYTICS_DEFAULT_WINDOW_DAYS} days
        </p>
      </PopoverContent>
    </Popover>
  );
}
