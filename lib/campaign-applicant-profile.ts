import { getCreatorStatsFromProfile } from "@/lib/creator-profile-stats";

/**
 * What a brand may see about a creator who applied to a Restricted campaign.
 * Built on the server from creator_profiles; the stored social accounts also
 * hold OAuth tokens, so only whitelisted public fields are copied out.
 */
export type ApplicantSocialPlatform = "youtube" | "instagram" | "tiktok" | "twitter";

export type ApplicantSocialAccount = {
  platform: ApplicantSocialPlatform;
  /** Handle or channel name to show. */
  label: string;
  /** Public profile link, when one can be built. */
  url: string | null;
  followers: number | null;
};

export type ApplicantProfile = {
  accounts: ApplicantSocialAccount[];
  trustScore: number | null;
  verifiedSubmissions: number;
  totalSubmissions: number;
  avgQualityScore: number | null;
  bestQualityScore: number | null;
  qualityScoreSum: number | null;
  totalViews: number;
  campaignsJoined: number | null;
  country: string | null;
  languages: string[];
  categories: string[];
  /** Details an admin hid from the brand for this campaign. */
  hiddenFields?: ApplicantField[];
  /** True when hidden details were removed (the brand's copy); admins get the full copy. */
  redacted?: boolean;
};

/** Columns read from creator_profiles to build an ApplicantProfile. */
export const APPLICANT_PROFILE_COLUMNS =
  "id, youtube_account, instagram_account, tiktok_account, twitter_account, trust_score_metrics, avg_quality_score, best_quality_score, quality_score_sum, total_views, total_contests_participated, country, languages, categories";

function parseJson(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function count(...values: unknown[]): number | null {
  for (const v of values) {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return null;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

const handleOnly = (value: string) => value.replace(/^@+/, "");

/** Public summary of one stored social account, or null when it isn't usable. */
export function publicSocialAccount(
  platform: ApplicantSocialPlatform,
  raw: unknown,
): ApplicantSocialAccount | null {
  const a = parseJson(raw);
  if (!a) return null;
  const metrics = parseJson(a.public_metrics);

  if (platform === "youtube") {
    const custom = text(a.channel_custom_url);
    const channelId = text(a.channel_id);
    const label = text(a.channel_title) ?? custom ?? channelId;
    if (!label) return null;
    const url = custom
      ? `https://www.youtube.com/${custom.startsWith("@") ? custom : `@${custom}`}`
      : channelId
        ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`
        : null;
    return { platform, label, url, followers: count(a.subscriber_count, a.subscriberCount) };
  }

  if (platform === "instagram") {
    const username = text(a.username);
    const label = username ? `@${handleOnly(username)}` : text(a.name_of_account);
    if (!label) return null;
    return {
      platform,
      label,
      url: username ? `https://www.instagram.com/${encodeURIComponent(handleOnly(username))}` : null,
      followers: count(a.followers_count, a.follower_count),
    };
  }

  if (platform === "tiktok") {
    const username = text(a.username);
    const label = username ? `@${handleOnly(username)}` : text(a.display_name);
    if (!label) return null;
    return {
      platform,
      label,
      url: username ? `https://www.tiktok.com/@${encodeURIComponent(handleOnly(username))}` : text(a.profile_deep_link),
      followers: count(a.follower_count, a.followers_count),
    };
  }

  const username = text(a.username) ?? text(a.screen_name);
  const label = username ? `@${handleOnly(username)}` : text(a.name);
  if (!label) return null;
  return {
    platform,
    label,
    url: username ? `https://x.com/${encodeURIComponent(handleOnly(username))}` : null,
    followers: count(a.followers_count, metrics?.followers_count),
  };
}

/** Builds the brand-safe applicant summary from a creator_profiles row. */
export function buildApplicantProfile(row: Record<string, unknown> | null | undefined): ApplicantProfile | null {
  if (!row) return null;
  const accounts = (
    [
      ["youtube", row.youtube_account],
      ["instagram", row.instagram_account],
      ["tiktok", row.tiktok_account],
      ["twitter", row.twitter_account],
    ] as const
  )
    .map(([platform, raw]) => publicSocialAccount(platform, raw))
    .filter((a): a is ApplicantSocialAccount => !!a);

  const stats = getCreatorStatsFromProfile(row);
  const hasHistory = stats.trustMetrics.total_reels > 0;
  return {
    accounts,
    trustScore: hasHistory ? stats.trustMetrics.trust_score : null,
    verifiedSubmissions: stats.trustMetrics.verified_reels,
    totalSubmissions: stats.trustMetrics.total_reels,
    avgQualityScore: stats.qualityMetrics.avg_quality_score,
    bestQualityScore: stats.qualityMetrics.best_quality_score,
    qualityScoreSum: stats.qualityMetrics.quality_score_sum,
    totalViews: stats.totalViews,
    campaignsJoined: count(row.total_contests_participated),
    country: text(row.country),
    languages: stringList(row.languages),
    categories: stringList(row.categories),
  };
}

/** Largest follower count across the creator's connected accounts. */
export function topFollowerCount(profile: ApplicantProfile | null | undefined): number | null {
  const counts = (profile?.accounts ?? [])
    .map((a) => a.followers)
    .filter((n): n is number => n != null);
  return counts.length ? Math.max(...counts) : null;
}

/** Compact follower count, e.g. 12.3K or 1.2M. */
export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

/** Applicant details an admin can hide from the brand, per campaign. */
export const APPLICANT_FIELDS = ["accounts", "followers", "trust", "quality", "activity", "basics"] as const;
export type ApplicantField = (typeof APPLICANT_FIELDS)[number];
export type ApplicantVisibility = Record<ApplicantField, boolean>;

export const APPLICANT_FIELD_LABELS: Record<ApplicantField, { label: string; hint: string }> = {
  accounts: { label: "Connected accounts", hint: "Links to YouTube, Instagram, TikTok and X" },
  followers: { label: "Follower counts", hint: "Subscribers and followers on each account" },
  trust: { label: "Trust score", hint: "Out of 100, from past submissions" },
  quality: { label: "Quality scores", hint: "Average, best and total quality" },
  activity: { label: "Submissions and views", hint: "Verified submissions, total views, campaigns joined" },
  basics: { label: "Basic information", hint: "Country, languages and categories" },
};

/** Stored visibility with every field defaulting to visible. */
export function parseApplicantVisibility(raw: unknown): ApplicantVisibility {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(APPLICANT_FIELDS.map((f) => [f, obj[f] !== false])) as ApplicantVisibility;
}

/** Validates a visibility update; only known fields with true/false are accepted. */
export function validateApplicantVisibility(
  input: unknown,
): { visibility: ApplicantVisibility } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "visibility must be an object" };
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!(APPLICANT_FIELDS as readonly string[]).includes(key)) return { error: `Unknown field: ${key}` };
    if (typeof value !== "boolean") return { error: `${key} must be true or false` };
  }
  return { visibility: parseApplicantVisibility(input) };
}

/** Removes hidden details from an applicant summary before it reaches the brand. */
export function applyApplicantVisibility(
  profile: ApplicantProfile | null,
  visibility: ApplicantVisibility,
): ApplicantProfile | null {
  if (!profile) return null;
  const hidden = APPLICANT_FIELDS.filter((f) => !visibility[f]);
  if (hidden.length === 0) return profile;
  const p: ApplicantProfile = { ...profile, hiddenFields: hidden, redacted: true };
  if (!visibility.accounts) p.accounts = [];
  else if (!visibility.followers) p.accounts = p.accounts.map((a) => ({ ...a, followers: null }));
  if (!visibility.trust) p.trustScore = null;
  if (!visibility.quality) {
    p.avgQualityScore = null;
    p.bestQualityScore = null;
    p.qualityScoreSum = null;
  }
  if (!visibility.activity) {
    p.verifiedSubmissions = 0;
    p.totalSubmissions = 0;
    p.totalViews = 0;
    p.campaignsJoined = null;
  }
  if (!visibility.basics) {
    p.country = null;
    p.languages = [];
    p.categories = [];
  }
  return p;
}
