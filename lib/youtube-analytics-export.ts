/** Flatten YouTube analytics (popover) into export cells. */

import { Country } from "country-state-city";

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

const AGE_LABELS: Record<string, string> = {
  age13_17: "13-17",
  age18_24: "18-24",
  age25_34: "25-34",
  age35_44: "35-44",
  age45_54: "45-54",
  age55_64: "55-64",
  age65_: "65+",
};

/** ISO-3166-1 alpha-2 → display name (matches YouTube analytics panel). */
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
  AE: "United Arab Emirates",
  SG: "Singapore",
  NZ: "New Zealand",
  NP: "Nepal",
  LK: "Sri Lanka",
};

function formatCountryName(code: string): string {
  const normalized = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!normalized) return code;
  const fromLib = Country.getCountryByCode(normalized);
  if (fromLib?.name) return fromLib.name;
  return COUNTRY_NAMES[normalized] ?? code;
}

export type YoutubeAnalyticsExportVisibility = {
  showCore: boolean;
  showTraffic: boolean;
  showDemographics: boolean;
};

function fmtNum(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function fmtDuration(seconds: unknown): string {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function fmtMinutes(minutes: unknown): string {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return "";
  if (m >= 60) return `${(m / 60).toFixed(1)}h`;
  return `${Math.round(m)}m`;
}

function num(metrics: Record<string, unknown>, key: string): number {
  const v = Number(metrics[key]);
  return Number.isFinite(v) ? v : 0;
}

type DemographicsShape = {
  age_groups?: Record<string, number>;
  gender?: Record<string, number>;
  countries?: Record<string, number>;
};

function getDemographics(
  metrics: Record<string, unknown>,
): DemographicsShape | null {
  const demo = metrics.demographics as DemographicsShape | null | undefined;
  return demo ?? null;
}

export function hasTrafficData(metrics: Record<string, unknown>): boolean {
  const sources = metrics.traffic_sources as Record<string, number> | null;
  return Boolean(sources && Object.keys(sources).length > 0);
}

export function hasDemographicsData(metrics: Record<string, unknown>): boolean {
  const demo = getDemographics(metrics);
  if (!demo) return false;
  return (
    Object.keys(demo.age_groups ?? {}).length > 0 ||
    Object.keys(demo.gender ?? {}).length > 0 ||
    Object.keys(demo.countries ?? {}).length > 0
  );
}

/** Merge submission.other_stats with metrics from extractPlatformMetrics. */
export function parseYouTubeAnalyticsMetrics(
  submission: Record<string, unknown>,
  fromGetMetrics?: Record<string, unknown>,
): Record<string, unknown> {
  let stats: Record<string, unknown> = {};
  const raw = submission.other_stats;
  if (typeof raw === "string") {
    try {
      stats = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      stats = {};
    }
  } else if (raw && typeof raw === "object") {
    stats = raw as Record<string, unknown>;
  }
  const yt = (stats.youtube ?? stats) as Record<string, unknown>;
  const base = fromGetMetrics ?? {};

  return {
    views: num(base, "views") || Number(submission.views) || num(yt, "views"),
    likes: num(base, "likes") || num(yt, "likes") || num(yt, "like_count"),
    dislikes: num(base, "dislikes") || num(yt, "dislikes"),
    comments: num(base, "comments") || num(yt, "comments") || num(yt, "comment_count"),
    shares: num(base, "shares") || num(yt, "shares"),
    subscribers_gained:
      num(base, "subscribers_gained") || num(yt, "subscribers_gained"),
    subscribers_lost:
      num(base, "subscribers_lost") || num(yt, "subscribers_lost"),
    videos_added_to_playlists:
      num(base, "videos_added_to_playlists") ||
      num(yt, "videos_added_to_playlists"),
    videos_removed_from_playlists:
      num(base, "videos_removed_from_playlists") ||
      num(yt, "videos_removed_from_playlists"),
    estimated_minutes_watched:
      num(base, "estimated_minutes_watched") ||
      num(yt, "estimated_minutes_watched"),
    avg_view_duration_seconds:
      num(base, "avg_view_duration_seconds") ||
      num(yt, "avg_view_duration_seconds"),
    avg_view_percentage:
      num(base, "avg_view_percentage") || num(yt, "avg_view_percentage"),
    engaged_views: num(base, "engaged_views") || num(yt, "engaged_views"),
    traffic_sources:
      (base.traffic_sources as Record<string, number> | null | undefined) ??
      (yt.traffic_sources as Record<string, number> | null | undefined) ??
      null,
    demographics:
      (base.demographics as Record<string, unknown> | null | undefined) ??
      (yt.demographics as Record<string, unknown> | null | undefined) ??
      null,
    bot_score:
      base.bot_score != null
        ? base.bot_score
        : yt.bot_score != null
          ? yt.bot_score
          : null,
    bot_flags:
      (base.bot_flags as string[] | undefined) ??
      (yt.bot_flags as string[] | undefined) ??
      [],
    analytics_needs_reauth:
      base.analytics_needs_reauth === true ||
      yt.analytics_needs_reauth === true,
    last_traffic_update:
      base.last_traffic_update ?? yt.last_traffic_update ?? null,
    last_demographics_update:
      base.last_demographics_update ?? yt.last_demographics_update ?? null,
  };
}

function hasMeaningfulCoreAnalytics(metrics: Record<string, unknown>): boolean {
  return (
    num(metrics, "estimated_minutes_watched") > 0 ||
    num(metrics, "avg_view_percentage") > 0 ||
    num(metrics, "avg_view_duration_seconds") > 0 ||
    num(metrics, "engaged_views") > 0 ||
    num(metrics, "shares") > 0 ||
    num(metrics, "likes") > 0 ||
    num(metrics, "dislikes") > 0 ||
    num(metrics, "comments") > 0 ||
    num(metrics, "subscribers_gained") > 0 ||
    num(metrics, "subscribers_lost") > 0 ||
    num(metrics, "videos_added_to_playlists") > 0
  );
}

function buildBotSection(metrics: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (metrics.analytics_needs_reauth === true) {
    lines.push("Needs Reauth: Creator must reconnect YouTube");
  }
  const botScore = metrics.bot_score;
  if (botScore != null && botScore !== "" && Number.isFinite(Number(botScore))) {
    lines.push(`Bot Score: ${Number(botScore)}/100`);
  }
  const botFlags = (metrics.bot_flags as string[] | undefined) ?? [];
  for (const flag of botFlags) {
    lines.push(`Warning: ${flag}`);
  }
  return lines;
}

function buildCoreSection(metrics: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const avgPct = num(metrics, "avg_view_percentage");
  if (avgPct > 0) lines.push(`Avg View %: ${avgPct.toFixed(1)}%`);

  const watch = fmtMinutes(metrics.estimated_minutes_watched);
  if (watch) lines.push(`Watch Time: ${watch}`);

  const avgDur = fmtDuration(metrics.avg_view_duration_seconds);
  if (avgDur) lines.push(`Avg Duration: ${avgDur}`);

  const engaged = num(metrics, "engaged_views");
  const views = num(metrics, "views");
  if (engaged > 0) {
    const pct = views > 0 ? ` (${((engaged / views) * 100).toFixed(0)}%)` : "";
    lines.push(`Engaged Views: ${fmtNum(engaged)}${pct}`);
  }

  const shares = num(metrics, "shares");
  if (shares > 0) lines.push(`Shares: ${fmtNum(shares)}`);

  const likes = num(metrics, "likes");
  if (likes > 0) lines.push(`Likes: ${fmtNum(likes)}`);

  const dislikes = num(metrics, "dislikes");
  if (dislikes > 0) lines.push(`Dislikes: ${fmtNum(dislikes)}`);

  const comments = num(metrics, "comments");
  if (comments > 0) lines.push(`Comments: ${fmtNum(comments)}`);

  const subsGained = num(metrics, "subscribers_gained");
  if (subsGained > 0) lines.push(`Subs Gained: +${fmtNum(subsGained)}`);

  const subsLost = num(metrics, "subscribers_lost");
  if (subsLost > 0) lines.push(`Subs Lost: -${fmtNum(subsLost)}`);

  const addedPlaylists = num(metrics, "videos_added_to_playlists");
  if (addedPlaylists > 0) {
    lines.push(`Added to Playlists: ${fmtNum(addedPlaylists)}`);
  }

  return lines;
}

export function buildTrafficSection(metrics: Record<string, unknown>): string[] {
  const sources = metrics.traffic_sources as Record<string, number> | null;
  if (!sources || Object.keys(sources).length === 0) {
    return [];
  }
  const lines = Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([key, pct]) =>
        `${TRAFFIC_LABELS[key] ?? key}: ${Number(pct).toFixed(1)}%`,
    );
  const updated = metrics.last_traffic_update;
  if (updated) lines.push(`Updated: ${String(updated)}`);
  return lines;
}

export function buildDemographicsSection(
  metrics: Record<string, unknown>,
): string[] {
  const demo = getDemographics(metrics);
  if (!demo) return [];

  const lines: string[] = [];
  const ages = demo.age_groups ?? {};
  for (const [age, pct] of Object.entries(ages).sort((a, b) => b[1] - a[1])) {
    lines.push(`${AGE_LABELS[age] ?? age}: ${Number(pct).toFixed(1)}%`);
  }
  const gender = demo.gender ?? {};
  for (const [g, pct] of Object.entries(gender)) {
    const label = g.charAt(0).toUpperCase() + g.slice(1);
    lines.push(`${label}: ${Number(pct).toFixed(1)}%`);
  }
  const updated = metrics.last_demographics_update;
  if (lines.length > 0 && updated) {
    lines.push(`Updated: ${String(updated)}`);
  }
  return lines;
}

export function buildTopCountriesSection(
  metrics: Record<string, unknown>,
): string[] {
  const demo = getDemographics(metrics);
  const countries = demo?.countries ?? {};
  if (Object.keys(countries).length === 0) return [];

  const lines = Object.entries(countries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(
      ([code, pct]) =>
        `${formatCountryName(code)}: ${Number(pct).toFixed(1)}%`,
    );
  const updated = metrics.last_demographics_update;
  if (updated) lines.push(`Updated: ${String(updated)}`);
  return lines;
}

function joinBlock(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  return [title, ...lines].join("\n");
}

export function formatYouTubeTrafficForExport(
  submission: Record<string, unknown>,
  fromGetMetrics: Record<string, unknown>,
  visibility: Pick<YoutubeAnalyticsExportVisibility, "showTraffic">,
): string {
  if (!visibility.showTraffic) return "";
  const metrics = parseYouTubeAnalyticsMetrics(submission, fromGetMetrics);
  const lines = buildTrafficSection(metrics);
  return lines.length > 0 ? joinBlock("TRAFFIC SOURCES", lines) : "";
}

export function formatYouTubeDemographicsForExport(
  submission: Record<string, unknown>,
  fromGetMetrics: Record<string, unknown>,
  visibility: Pick<YoutubeAnalyticsExportVisibility, "showDemographics">,
): string {
  if (!visibility.showDemographics) return "";
  const metrics = parseYouTubeAnalyticsMetrics(submission, fromGetMetrics);
  const lines = buildDemographicsSection(metrics);
  return lines.length > 0 ? joinBlock("DEMOGRAPHICS", lines) : "";
}

export function formatYouTubeTopCountriesForExport(
  submission: Record<string, unknown>,
  fromGetMetrics: Record<string, unknown>,
  visibility: Pick<YoutubeAnalyticsExportVisibility, "showDemographics">,
): string {
  if (!visibility.showDemographics) return "";
  const metrics = parseYouTubeAnalyticsMetrics(submission, fromGetMetrics);
  const lines = buildTopCountriesSection(metrics);
  return lines.length > 0 ? joinBlock("TOP COUNTRIES", lines) : "";
}

export function formatYouTubeAnalyticsForExport(
  submission: Record<string, unknown>,
  fromGetMetrics: Record<string, unknown>,
  visibility: YoutubeAnalyticsExportVisibility,
): string {
  const metrics = parseYouTubeAnalyticsMetrics(submission, fromGetMetrics);
  const blocks: string[] = [];

  const botLines = buildBotSection(metrics);
  if (botLines.length > 0) blocks.push(botLines.join("\n"));

  if (visibility.showCore && hasMeaningfulCoreAnalytics(metrics)) {
    const coreLines = buildCoreSection(metrics);
    if (coreLines.length > 0) {
      blocks.push(joinBlock("CORE ANALYTICS", coreLines));
    }
  }

  if (visibility.showTraffic && hasTrafficData(metrics)) {
    const traffic = buildTrafficSection(metrics);
    if (traffic.length > 0) {
      blocks.push(joinBlock("TRAFFIC SOURCES", traffic));
    }
  }

  if (visibility.showDemographics && hasDemographicsData(metrics)) {
    const demo = buildDemographicsSection(metrics);
    if (demo.length > 0) {
      blocks.push(joinBlock("DEMOGRAPHICS", demo));
    }
    const countries = buildTopCountriesSection(metrics);
    if (countries.length > 0) {
      blocks.push(joinBlock("TOP COUNTRIES", countries));
    }
  }

  return blocks.filter(Boolean).join("\n\n");
}
