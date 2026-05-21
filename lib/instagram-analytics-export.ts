/** Flatten cached Instagram account insights (instagram_archive) into export cells. */

import {
  computeSinceUntilForPreset,
  filterDemographicsErrorsForDisplay,
  normalizeDemographicsTimeframe,
  type AccountInsightsPreset,
} from "@/lib/instagram-account-insights";
import {
  parseInstagramArchive,
  type InstagramAnalyticsEntry,
  type InstagramDemographicRow,
  type InstagramDemographicsBundle,
  type InstagramProfileSnapshot,
} from "@/lib/platform-social-archive";

export type InstagramInsightsExportSelection = {
  preset: AccountInsightsPreset;
  customSince?: number;
  customUntil?: number;
};

/** Max creator IDs per instagram-archives API request (server enforces the same cap). */
export const INSTAGRAM_ARCHIVES_BATCH_SIZE = 500;

export const INSTAGRAM_INSIGHTS_EXPORT_PRESETS: ReadonlyArray<{
  id: AccountInsightsPreset;
  label: string;
}> = [
  { id: "day", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "365d", label: "365d" },
  { id: "overall", label: "Overall (max ~90d)" },
  { id: "custom", label: "Custom" },
] as const;

const METRIC_LABELS: Record<string, string> = {
  reach: "Reach",
  views: "Views",
  accounts_engaged: "Accounts engaged",
  likes: "Likes",
  comments: "Comments",
  saves: "Saves",
  shares: "Shares",
};

const METRIC_ORDER = [
  "reach",
  "views",
  "accounts_engaged",
  "likes",
  "comments",
  "saves",
  "shares",
];

const DEFAULT_PRESET_PREFERENCE: AccountInsightsPreset[] = [
  "overall",
  "30d",
  "7d",
  "day",
  "365d",
];

function humanizeMetricKey(k: string): string {
  return METRIC_LABELS[k] ?? k.replace(/_/g, " ");
}

export function instagramInsightsPresetLabel(
  preset: AccountInsightsPreset,
): string {
  return (
    INSTAGRAM_INSIGHTS_EXPORT_PRESETS.find((p) => p.id === preset)?.label ??
    preset
  );
}

export function resolveInstagramAnalyticsEntryKey(
  selection: InstagramInsightsExportSelection,
  nowSec: number = Math.floor(Date.now() / 1000),
): string {
  return computeSinceUntilForPreset(
    selection.preset,
    nowSec,
    selection.customSince,
    selection.customUntil,
  ).entryKey;
}

function fmtNum(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatMetricValue(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return fmtNum(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return fmtNum(Number(v));
  }
  if (
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "breakdowns" in (v as object)
  ) {
    const breakdowns = (v as { breakdowns?: unknown[] }).breakdowns;
    const count = Array.isArray(breakdowns) ? breakdowns.length : 0;
    return count > 0 ? `Breakdown (${count})` : "";
  }
  return v != null && v !== "" ? String(v) : "";
}

function formatWindow(entry: InstagramAnalyticsEntry): string {
  const { since, until, preset } = entry;
  if (since == null || until == null) {
    return preset ? String(preset) : "";
  }
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const a = new Date(since * 1000).toLocaleString(undefined, opts);
  const b = new Date(until * 1000).toLocaleString(undefined, opts);
  const range = `${a} → ${b}`;
  return preset ? `${preset} · ${range}` : range;
}

type DemographicDimension = "country" | "age" | "gender";

function extractIsoCountryToken(label: string): string | null {
  const parts = label
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (/^[A-Z]{2}$/i.test(p)) return p.toUpperCase();
  }
  const t = label.trim();
  if (/^[A-Z]{2}$/i.test(t)) return t.toUpperCase();
  return null;
}

function expandCountryLabelForExport(label: string): string {
  const code = extractIsoCountryToken(label);
  if (code) {
    try {
      const full = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      if (full) return full;
    } catch {
      /* invalid code for Intl */
    }
    return code;
  }
  return label.trim();
}

const GENDER_EXPAND: Record<string, string> = {
  M: "Male",
  F: "Female",
  U: "Unknown",
  O: "Other",
  m: "Male",
  f: "Female",
  u: "Unknown",
  o: "Other",
  male: "Male",
  female: "Female",
  unknown: "Unknown",
  other: "Other",
};

function expandGenderLabelForExport(label: string): string {
  const t = label.trim();
  const key = t.length <= 2 ? t : t.toLowerCase();
  return (
    GENDER_EXPAND[t] ??
    GENDER_EXPAND[t.toUpperCase()] ??
    GENDER_EXPAND[key] ??
    t
  );
}

function expandDemographicLabel(
  raw: string,
  dimension: DemographicDimension,
): string {
  if (dimension === "country") return expandCountryLabelForExport(raw);
  if (dimension === "gender") return expandGenderLabelForExport(raw);
  return raw.trim();
}

function formatProfile(
  profile: InstagramProfileSnapshot | undefined,
): string[] {
  if (!profile) return [];
  const lines: string[] = [];
  if (profile.username) lines.push(`@${profile.username}`);
  if (profile.name_of_account) lines.push(`Name: ${profile.name_of_account}`);
  if (profile.account_type) lines.push(`Type: ${profile.account_type}`);
  if (typeof profile.followers_count === "number") {
    lines.push(`Followers: ${fmtNum(profile.followers_count)}`);
  }
  if (typeof profile.follows_count === "number") {
    lines.push(`Following: ${fmtNum(profile.follows_count)}`);
  }
  if (typeof profile.media_count === "number") {
    lines.push(`Media: ${fmtNum(profile.media_count)}`);
  }
  return lines;
}

function topDemographicLines(
  label: string,
  rows: InstagramDemographicRow[] | undefined,
  dimension: DemographicDimension,
  limit = 5,
): string[] {
  if (!rows?.length) return [];
  const total = rows.reduce((s, r) => s + Math.max(0, r.value), 0);
  if (total <= 0) return [];
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
  const parts = sorted.map((r) => {
    const pct = ((r.value / total) * 100).toFixed(1);
    const name = expandDemographicLabel(r.label, dimension);
    return `${name} ${pct}%`;
  });
  return [`${label}: ${parts.join("; ")}`];
}

function formatDemographics(
  bundle: InstagramDemographicsBundle | undefined,
): string[] {
  if (!bundle) return [];
  const lines: string[] = [];
  const tf = normalizeDemographicsTimeframe(bundle.timeframe).replace(
    /_/g,
    " ",
  );
  if (tf) lines.push(`Audience window: ${tf}`);

  const follower = bundle.follower_demographics ?? {};
  const engaged = bundle.engaged_audience_demographics ?? {};

  for (const [dim, label] of [
    ["country", "Followers · Country"],
    ["age", "Followers · Age"],
    ["gender", "Followers · Gender"],
  ] as const) {
    lines.push(
      ...topDemographicLines(
        label,
        follower[dim as keyof typeof follower] as
          | InstagramDemographicRow[]
          | undefined,
        dim,
      ),
    );
  }
  for (const [dim, label] of [
    ["country", "Engaged · Country"],
    ["age", "Engaged · Age"],
    ["gender", "Engaged · Gender"],
  ] as const) {
    lines.push(
      ...topDemographicLines(
        label,
        engaged[dim as keyof typeof engaged] as
          | InstagramDemographicRow[]
          | undefined,
        dim,
      ),
    );
  }

  const displayErrors = filterDemographicsErrorsForDisplay(bundle);
  if (displayErrors.length) {
    lines.push(`Demographics note: ${displayErrors.join("; ")}`);
  }
  return lines;
}

function joinBlock(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  return [title, ...lines].join("\n");
}

function entryMatchesPreset(
  entry: InstagramAnalyticsEntry,
  entryKey: string,
  preset: AccountInsightsPreset,
): boolean {
  if (entryKey === preset) return true;
  if (entry.preset === preset) return true;
  return entryKey.toLowerCase() === preset.toLowerCase();
}

/** Pick cached entry for export; uses exact archive key for the selected range. */
export function pickInstagramAnalyticsEntry(
  archiveRaw: unknown,
  selection?: InstagramInsightsExportSelection | null,
): InstagramAnalyticsEntry | null {
  const parsed = parseInstagramArchive(archiveRaw);
  const entries = parsed.analytics?.entries ?? {};
  const entryList = Object.entries(entries);
  if (entryList.length === 0) return null;

  if (selection) {
    const key = resolveInstagramAnalyticsEntryKey(selection);
    if (entries[key]) return entries[key];

    if (selection.preset === "custom") {
      if (selection.customSince != null && selection.customUntil != null) {
        const min = Math.min(selection.customSince, selection.customUntil);
        const max = Math.max(selection.customSince, selection.customUntil);
        const altKey = `custom:${min}:${max}`;
        if (entries[altKey]) return entries[altKey];
        for (const [k, entry] of entryList) {
          if (!k.startsWith("custom:")) continue;
          const parts = k.split(":");
          if (parts.length < 3) continue;
          const ks = Number(parts[1]);
          const ku = Number(parts[2]);
          if (ks === min && ku === max) return entry;
        }
      }
    }

    for (const [entryKey, entry] of entryList) {
      if (entryMatchesPreset(entry, entryKey, selection.preset)) {
        return entry;
      }
    }
    return null;
  }

  for (const key of DEFAULT_PRESET_PREFERENCE) {
    if (entries[key]) return entries[key];
  }

  let best: InstagramAnalyticsEntry | null = null;
  let bestMs = -1;
  for (const entry of Object.values(entries)) {
    const ms = entry.fetched_at ? Date.parse(entry.fetched_at) : 0;
    if (!best || ms >= bestMs) {
      best = entry;
      bestMs = ms;
    }
  }
  return best;
}

/** Match modal: entry profile, else live account snapshot, else any cached entry profile. */
export function resolveInstagramProfileForExport(
  archiveRaw: unknown,
  entry: InstagramAnalyticsEntry | null,
  profileFallback?: InstagramProfileSnapshot | null,
): InstagramProfileSnapshot | undefined {
  if (entry?.profile) return entry.profile;
  if (profileFallback) return profileFallback;
  const parsed = parseInstagramArchive(archiveRaw);
  const entries = parsed.analytics?.entries ?? {};
  let best: InstagramProfileSnapshot | undefined;
  let bestMs = -1;
  for (const e of Object.values(entries)) {
    if (!e.profile) continue;
    const ms = e.fetched_at ? Date.parse(e.fetched_at) : 0;
    if (!best || ms >= bestMs) {
      best = e.profile;
      bestMs = ms;
    }
  }
  return best;
}

export function formatInstagramInsightsForExport(
  archiveRaw: unknown,
  selection?: InstagramInsightsExportSelection | null,
  profileFallback?: InstagramProfileSnapshot | null,
): string {
  const parsed = parseInstagramArchive(archiveRaw);
  const entry = pickInstagramAnalyticsEntry(archiveRaw, selection);
  if (!entry) {
    const profileOnly = resolveInstagramProfileForExport(
      parsed,
      null,
      profileFallback,
    );
    const profileLines = formatProfile(profileOnly);
    if (profileLines.length > 0) {
      return joinBlock("PROFILE", profileLines);
    }
    if (selection) {
      const label = instagramInsightsPresetLabel(selection.preset);
      return `No cached data for ${label}. Refresh from Meta in Instagram insights for this range first.`;
    }
    return "";
  }

  const blocks: string[] = [];

  if (entry.error) {
    blocks.push(`Error: ${entry.error}`);
  }

  const profile = resolveInstagramProfileForExport(
    parsed,
    entry,
    profileFallback,
  );
  const profileLines = formatProfile(profile);
  if (profileLines.length > 0) {
    blocks.push(joinBlock("PROFILE", profileLines));
  }

  const metricKeys = Object.keys(entry.metrics ?? {});
  const ordered = [
    ...METRIC_ORDER.filter((k) => metricKeys.includes(k)),
    ...metricKeys
      .filter((k) => !METRIC_ORDER.includes(k))
      .sort((a, b) => a.localeCompare(b)),
  ];
  const metricLines: string[] = [];
  const window = formatWindow(entry);
  if (window) metricLines.push(`Window: ${window}`);
  if (entry.fetched_at) {
    metricLines.push(`Fetched: ${new Date(entry.fetched_at).toLocaleString()}`);
  }
  for (const key of ordered) {
    const formatted = formatMetricValue(entry.metrics[key]);
    if (formatted) {
      metricLines.push(`${humanizeMetricKey(key)}: ${formatted}`);
    }
  }
  if (metricLines.length > 0) {
    blocks.push(joinBlock("ACCOUNT INSIGHTS", metricLines));
  }

  const demoLines = formatDemographics(entry.demographics);
  if (demoLines.length > 0) {
    blocks.push(joinBlock("AUDIENCE", demoLines));
  }

  return blocks.filter(Boolean).join("\n\n");
}

export function instagramInsightsColumnHeaderSuffix(
  selection?: InstagramInsightsExportSelection | null,
): string {
  if (!selection) return "";
  return ` (${instagramInsightsPresetLabel(selection.preset)})`;
}
